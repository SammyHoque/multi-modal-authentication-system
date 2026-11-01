// -------------------- Voice prompt recognition --------------------
export function listenForPrompt(targetText, seconds = 4, promptWordMatch) {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      resolve({ ok: false, reason: "SpeechRecognition not supported" });
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    let done = false;

    rec.onresult = (e) => {
      if (done) return;
      done = true;
      const said = e.results[0][0].transcript.toLowerCase().trim();
      const tgt = targetText.toLowerCase().trim();
      resolve({ ok: promptWordMatch(said, tgt), said });
      rec.stop();
    };

    rec.onerror = () => {
      if (done) return;
      done = true;
      resolve({ ok: false, reason: "SpeechRecognition error" });
    };

    rec.onend = () => {
      if (done) return;
      done = true;
      resolve({ ok: false, reason: "No speech captured" });
    };

    rec.start();
    setTimeout(() => { try { rec.stop(); } catch {} }, seconds * 1000);
  });
}

// -------------------- Voice: feature extraction (simple voiceprint) --------------------
export async function recordAudioSeconds(seconds = 3) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mediaRecorder = new MediaRecorder(stream);
  const chunks = [];

  return new Promise((resolve, reject) => {
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onerror = reject;

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: "audio/webm" });
      resolve(blob);
    };

    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), seconds * 1000);
  });
}

export async function blobToAudioBuffer(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

// Simple spectral summary = demo voiceprint (robust enough for prototype)
export function extractVoiceprint(audioBuffer) {
  const data = audioBuffer.getChannelData(0);

  // take a middle slice (avoid start/end noise)
  const mid = Math.floor(data.length * 0.5);
  const half = Math.floor(audioBuffer.sampleRate * 0.5);
  const start = Math.max(0, mid - half);
  const end = Math.min(data.length, mid + half);
  const slice = data.slice(start, end);

  // energy
  let sumSq = 0;
  for (let i = 0; i < slice.length; i++) sumSq += slice[i] * slice[i];
  const rms = Math.sqrt(sumSq / slice.length);

  // zero-crossing rate (rough pitch-ish proxy)
  let zc = 0;
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i - 1] >= 0 && slice[i] < 0) || (slice[i - 1] < 0 && slice[i] >= 0)) zc++;
  }
  const zcr = zc / slice.length;

  // Use a coarse spectral snapshot rather than a full biometric model; this keeps the demo lightweight.
  // short-time FFT bands (coarse)
  const N = 2048;
  const hop = 1024;
  const bands = new Array(8).fill(0);
  let frames = 0;

  // naive DFT magnitude (small N) — ok for demo; not MFCC
  function magSpectrum(frame) {
    const mags = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const ang = (2 * Math.PI * k * n) / N;
        re += frame[n] * Math.cos(ang);
        im -= frame[n] * Math.sin(ang);
      }
      mags[k] = Math.sqrt(re * re + im * im);
    }
    return mags;
  }

  for (let i = 0; i + N < slice.length; i += hop) {
    const frame = slice.slice(i, i + N);
    const mags = magSpectrum(frame);

    // bucket into 8 coarse frequency bands
    for (let b = 0; b < 8; b++) {
      const from = Math.floor((b * mags.length) / 8);
      const to = Math.floor(((b + 1) * mags.length) / 8);
      let s = 0;
      for (let j = from; j < to; j++) s += mags[j];
      bands[b] += s / Math.max(to - from, 1);
    }

    frames++;
  }

  // normalise bands
  const normBands = bands.map(v => v / Math.max(frames, 1));
  const norm = Math.sqrt(normBands.reduce((a, v) => a + v * v, 0)) || 1;
  const bandVec = normBands.map(v => v / norm);

  // final template vector
  return [rms, zcr, ...bandVec];
}

// -------------------- Voice helpers (moved from login.js) --------------------
export function promptWordMatch(said, target) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const saidNorm = ` ${norm(said)} `;
  const targetNorm = ` ${norm(target)} `;

  // Allow the stored passphrase to appear inside a longer recognition result to tolerate browser ASR quirks.
  return saidNorm.includes(targetNorm);
}

// Simple cosine similarity
export function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb) || 1);
}
