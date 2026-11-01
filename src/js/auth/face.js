// ---- Blendshape names (MediaPipe) ----
const FACE = {
  EYE_BLINK_L: "eyeBlinkLeft",
  EYE_BLINK_R: "eyeBlinkRight",

  JAW_OPEN: "jawOpen",

  SMILE_L: "mouthSmileLeft",
  SMILE_R: "mouthSmileRight",

  BROW_UP_L: "browOuterUpLeft",
  BROW_UP_R: "browOuterUpRight",

  BROW_DOWN_L: "browDownLeft",
  BROW_DOWN_R: "browDownRight",

  PUCKER: "mouthPucker",
  FUNNEL: "mouthFunnel",

  CHEEK_PUFF: "cheekPuff",
};

// ---- Tunable thresholds ----
const TH = {
  WINK: 0.58,
  BLINK: 0.58,
  BLINK_BALANCE: 0.16,
  WINK_OTHER_EYE_MAX: 0.35,
  WINK_GAP: 0.24,
  JAW_OPEN: 0.55,
  SMILE: 0.55,
  BROW_UP: 0.50,
  BROW_DOWN: 0.50,
  PUCKER: 0.68,
  FUNNEL: 0.55,
  CHEEK_PUFF: 0.55,

  // Head pose thresholds (degrees)
  HEAD_YAW: 18,
  HEAD_PITCH_UP: 16,
  HEAD_PITCH_DOWN: 17,
  HEAD_ROLL: 15,
};

// avoid duplicates every frame
const COOLDOWN_MS = 450;
const lastEventAt = Object.create(null);

function getBlendshapeScore(categories, name) {
  const c = categories.find(x => x.categoryName === name);
  return c ? c.score : 0;
}

function cooldownOk(evt) {
  const now = Date.now();
  const last = lastEventAt[evt] || 0;
  if (now - last < COOLDOWN_MS) return false;
  lastEventAt[evt] = now;
  return true;
}

// Returns {yaw, pitch, roll} in degrees.
function estimateHeadPose(landmarks) {
  // Indices: nose tip, left eye outer, right eye outer, forehead, chin
  const NOSE = 1, LEFT = 33, RIGHT = 263, FOREHEAD = 10, CHIN = 152;

  const n = landmarks?.[NOSE], l = landmarks?.[LEFT], r = landmarks?.[RIGHT];
  const forehead = landmarks?.[FOREHEAD], chin = landmarks?.[CHIN];
  if (!n || !l || !r || !forehead || !chin) return null;

  // Face horizontal vector
  const dx = r.x - l.x;
  const dy = r.y - l.y;

  // Roll
  const roll = Math.atan2(dy, dx) * (180 / Math.PI);

  // Yaw
  const mx = (l.x + r.x) / 2;
  const yaw = (n.x - mx) / Math.max(Math.abs(dx), 1e-6) * 60;

  // Pitch:
  // use the nose position relative to the eye line, normalized by face height.
  // This is more stable than using eye width, which can overreact to small posture shifts.
  const my = (l.y + r.y) / 2;
  const faceHeight = Math.max(Math.abs(chin.y - forehead.y), 1e-6);
  const pitch = (n.y - my) / faceHeight * 90;

  return { yaw, pitch, roll };
}

export function getHeadPose(landmarks) {
  return estimateHeadPose(landmarks);
}

// Detect ONE event per frame (priority-based)
export function detectFaceEvent(blendshapes, landmarks, options = {}) {
  if (!blendshapes?.categories) return null;
  const { headPoseBaseline = null } = options;
  const cats = blendshapes.categories;

  const blinkL = getBlendshapeScore(cats, FACE.EYE_BLINK_L);
  const blinkR = getBlendshapeScore(cats, FACE.EYE_BLINK_R);

  const jawOpen = getBlendshapeScore(cats, FACE.JAW_OPEN);

  const smileL = getBlendshapeScore(cats, FACE.SMILE_L);
  const smileR = getBlendshapeScore(cats, FACE.SMILE_R);

  const browUpL = getBlendshapeScore(cats, FACE.BROW_UP_L);
  const browUpR = getBlendshapeScore(cats, FACE.BROW_UP_R);

  const browDownL = getBlendshapeScore(cats, FACE.BROW_DOWN_L);
  const browDownR = getBlendshapeScore(cats, FACE.BROW_DOWN_R);

  const pucker = getBlendshapeScore(cats, FACE.PUCKER);
  const funnel = getBlendshapeScore(cats, FACE.FUNNEL);

  const cheekPuff = getBlendshapeScore(cats, FACE.CHEEK_PUFF);

  // Eye events come first because they are used both for facial-motion passwords and Face ID liveness.
  // ---- Eye events ----
  // Both-eye blink
  const blinkBoth = Math.min(blinkL, blinkR);
  const blinkGap = Math.abs(blinkL - blinkR);
  if (blinkBoth >= TH.BLINK && blinkGap <= TH.BLINK_BALANCE && cooldownOk("BLINK")) {
    return "BLINK";
  }

  // Winks require one eye to be strongly closed while the other stays noticeably more open.
  if (
    blinkL >= TH.WINK &&
    blinkR <= TH.WINK_OTHER_EYE_MAX &&
    blinkL - blinkR >= TH.WINK_GAP &&
    cooldownOk("WINK_LEFT")
  ) {
    return "WINK_LEFT";
  }

  if (
    blinkR >= TH.WINK &&
    blinkL <= TH.WINK_OTHER_EYE_MAX &&
    blinkR - blinkL >= TH.WINK_GAP &&
    cooldownOk("WINK_RIGHT")
  ) {
    return "WINK_RIGHT";
  }

  // Fall back to coarse head-pose estimates for motion-password gestures like turns and tilts.
  // Check these before mouth events so looking down/up is not overshadowed by lip-shape noise.
  if (landmarks && landmarks.length) {
    const pose = estimateHeadPose(landmarks);
    if (pose) {
      const yaw = pose.yaw - (headPoseBaseline?.yaw || 0);
      const pitch = pose.pitch - (headPoseBaseline?.pitch || 0);
      const roll = pose.roll - (headPoseBaseline?.roll || 0);

      if (yaw >= TH.HEAD_YAW && cooldownOk("HEAD_RIGHT")) return "HEAD_RIGHT";
      if (yaw <= -TH.HEAD_YAW && cooldownOk("HEAD_LEFT")) return "HEAD_LEFT";

      if (pitch >= TH.HEAD_PITCH_DOWN && cooldownOk("HEAD_DOWN")) return "HEAD_DOWN";
      if (pitch <= -TH.HEAD_PITCH_UP && cooldownOk("HEAD_UP")) return "HEAD_UP";

      if (roll >= TH.HEAD_ROLL && cooldownOk("TILT_RIGHT")) return "TILT_RIGHT";
      if (roll <= -TH.HEAD_ROLL && cooldownOk("TILT_LEFT")) return "TILT_LEFT";
    }
  }

  // ---- Mouth events ----
  if (jawOpen >= TH.JAW_OPEN && cooldownOk("MOUTH_OPEN")) return "MOUTH_OPEN";

  const smile = Math.max(smileL, smileR);
  if (smile >= TH.SMILE && cooldownOk("SMILE")) return "SMILE";

  if (pucker >= TH.PUCKER && cooldownOk("PUCKER")) return "PUCKER";
  if (funnel >= TH.FUNNEL && cooldownOk("FUNNEL")) return "FUNNEL";

  if (cheekPuff >= TH.CHEEK_PUFF && cooldownOk("CHEEK_PUFF")) return "CHEEK_PUFF";

  // ---- Brow events ----
  const browUp = Math.max(browUpL, browUpR);
  if (browUp >= TH.BROW_UP && cooldownOk("BROW_UP")) return "BROW_UP";

  const browDown = Math.max(browDownL, browDownR);
  if (browDown >= TH.BROW_DOWN && cooldownOk("BROW_DOWN")) return "BROW_DOWN";

  return null;
}
