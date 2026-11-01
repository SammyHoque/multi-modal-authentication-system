// Landmark indices (MediaPipe Hands)
const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;

// -------------------- Vector helpers --------------------
function dist2D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rot2D(x, y, ang) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [x * c - y * s, x * s + y * c];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function midpoint(a, b) {
  return { 
    x: lerp(a.x, b.x, 0.5), 
    y: lerp(a.y, b.y, 0.5) 
  };
}



// -------------------- Feature extraction --------------------
export function landmarksToFeature(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[WRIST];
  const middle = landmarks[MIDDLE_MCP];
  const indexMcp = landmarks[INDEX_MCP];
  const pinkyMcp = landmarks[PINKY_MCP];
  const palmMid = midpoint(indexMcp, pinkyMcp);

  // Normalise by palm size/orientation so the same gesture can match across distance and slight rotation.
  const scale = dist2D(wrist, middle) || 1e-6;
  // Compute angle of wrist -> palm midpoint vector
  const vx = (palmMid.x - wrist.x) / scale;
  const vy = (palmMid.y - wrist.y) / scale;
  const ang = -Math.atan2(vy, vx); // rotate so this vector becomes horizontal

  const feat = new Float32Array(42);
  let k = 0;

  for (let i = 0; i < 21; i++) {
    const px = (landmarks[i].x - wrist.x) / scale;
    const py = (landmarks[i].y - wrist.y) / scale;
    const [rx, ry] = rot2D(px, py, ang);

    feat[k++] = rx;
    feat[k++] = ry;
  }
  return feat;
}

function featureDistance(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Exponential smoothing of feature frames
export function smoothSequence(seq, alpha = 0.65) {
  if (!seq || seq.length === 0) return [];

  const out = [seq[0].slice()];
  for (let i = 1; i < seq.length; i++) {
    const prev = out[i - 1];
    const curr = seq[i];
    const smoothed = new Array(curr.length);

    for (let j = 0; j < curr.length; j++) {
      smoothed[j] = alpha * curr[j] + (1 - alpha) * prev[j];
    }
    out.push(smoothed);
  }
  return out;
}

// Remove near-identical consecutive frames
export function dedupeSequence(seq, epsilon = 0.015) {
  if (!seq || seq.length === 0) return [];

  const out = [seq[0]];
  for (let i = 1; i < seq.length; i++) {
    if (featureDistance(seq[i], out[out.length - 1]) > epsilon) {
      out.push(seq[i]);
    }
  }
  return out;
}

// Append a frame to a recording buffer
export function recordFreehandFrame(frameBuffer, landmarks) {
  const feat = landmarksToFeature(landmarks);
  if (!feat) return;

  frameBuffer.push(Array.from(feat));
}

// Resample a sequence of frames to a fixed length
export function resampleSequence(seq, targetFrames = 60) {
  if (!seq || seq.length === 0) return [];
  if (seq.length === 1) return Array.from({ length: targetFrames }, () => seq[0].slice());

  const out = [];
  const last = seq.length - 1;

  for (let i = 0; i < targetFrames; i++) {
    const pos = (i * last) / (targetFrames - 1);
    const left = Math.floor(pos);
    const right = Math.min(last, Math.ceil(pos));
    const t = pos - left;

    const a = seq[left];
    const b = seq[right];
    const frame = new Array(a.length);

    for (let j = 0; j < a.length; j++) {
      frame[j] = lerp(a[j], b[j], t);
    }
    out.push(frame);
  }

  return out;
}

// -------------------- DTW algorithm --------------------
// Euclidean distance between two feature frames
export function frameDistance(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Dynamic Time Warping distance between two sequences of feature frames
export function dtwDistance(seqA, seqB, bandRatio = 0.15) {
  const n = seqA.length;
  const m = seqB.length;
  if (!n || !m) return Infinity;

  const band = Math.max(2, Math.floor(Math.max(n, m) * bandRatio));
  const big = 1e18;
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(big));
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    const jStart = Math.max(1, i - band);
    const jEnd = Math.min(m, i + band);

    for (let j = jStart; j <= jEnd; j++) {
      const cost = frameDistance(seqA[i - 1], seqB[j - 1]);
      const bestPrev = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      dp[i][j] = cost + bestPrev;
    }
  }

  return dp[n][m] / (n + m);
}

function sequenceMotionAmount(seq) {
  if (!seq || seq.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < seq.length; i++) {
    total += featureDistance(seq[i], seq[i - 1]);
  }
  return total;
}

function endpointPenalty(seqA, seqB) {
  if (!seqA.length || !seqB.length) return Infinity;
  const start = frameDistance(seqA[0], seqB[0]);
  const end = frameDistance(seqA[seqA.length - 1], seqB[seqB.length - 1]);
  return (start + end) / 2;
}

function lengthRatioPenalty(seqA, seqB) {
  const a = seqA.length;
  const b = seqB.length;
  const ratio = Math.max(a, b) / Math.max(1, Math.min(a, b));
  return ratio - 1; // 0 if same length, grows when lengths differ
}

function preprocessSequence(rawFrames, targetFrames = 60) {
  // DTW works best on stable, fixed-length sequences rather than raw webcam frame streams.
  let seq = rawFrames.map(f => Array.from(f));
  seq = dedupeSequence(seq, 0.015);
  seq = smoothSequence(seq, 0.65);

  if (seq.length < 5) return [];
  seq = resampleSequence(seq, targetFrames);
  return seq;
}

export function buildGestureTemplate(rawFrames, maxFrames = 60) {
  const frames = preprocessSequence(rawFrames, maxFrames);

  return {
    type: "freehand_dtw",
    maxFrames,
    frames,
    motion: sequenceMotionAmount(frames)
  };
}

export function matchGestureTemplate(attemptFrames, savedTemplate, opts = {}) {
  const {
    maxAttemptFrames = savedTemplate?.maxFrames || 60,
    minFrames = 20,
    dtwThreshold = 0.32,
    endpointThreshold = 0.30,
    motionTolerance = 0.35,
    lengthPenaltyThreshold = 0.45
  } = opts;

  if (!savedTemplate?.frames?.length) {
    return { ok: false, dist: Infinity, reason: "no_template" };
  }

  if (!attemptFrames || attemptFrames.length < minFrames) {
    return { ok: false, dist: Infinity, reason: "too_short" };
  }

  const attempt = preprocessSequence(attemptFrames, maxAttemptFrames);
  if (attempt.length < 5) {
    return { ok: false, dist: Infinity, reason: "insufficient_motion" };
  }

  const dtw = dtwDistance(attempt, savedTemplate.frames, 0.15);
  const endpoint = endpointPenalty(attempt, savedTemplate.frames);
  const motion = sequenceMotionAmount(attempt);
  const templateMotion = savedTemplate.motion || sequenceMotionAmount(savedTemplate.frames);

  const motionRatio = Math.abs(motion - templateMotion) / Math.max(templateMotion, 1e-6);
  const lenPenalty = lengthRatioPenalty(attempt, savedTemplate.frames);

  // Combine several lightweight checks so a low DTW score alone does not accept a poor replay.
  const ok =
    dtw < dtwThreshold &&
    endpoint < endpointThreshold &&
    motionRatio < motionTolerance &&
    lenPenalty < lengthPenaltyThreshold;

  return {
    ok,
    dist: dtw,
    endpoint,
    motion,
    templateMotion,
    motionRatio,
    lenPenalty,
    reason: ok ? "match" : "rejected"
  };
}
