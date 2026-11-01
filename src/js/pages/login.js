import { GestureRecognizer, FilesetResolver, DrawingUtils, FaceLandmarker }
  from "../utils/mediapipe.js";

import {
  listenForPrompt,
  recordAudioSeconds,
  blobToAudioBuffer,
  extractVoiceprint,
  promptWordMatch,
  cosineSim
} from "../auth/voice.js";

import { detectFaceEvent, getHeadPose } from "../auth/face.js";

import { recordFreehandFrame, matchGestureTemplate } from "../auth/gesture_dtw.js";

import {
  isFaceWellPositioned,
  captureFaceImageFromVideo
} from "../auth/faceid.js";

import { getAuthState, saveAuthState } from "../utils/authState.js";

// -------------------- DOM refs --------------------
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const enableBtn = document.getElementById('enableCam');
const voicePromptEl = document.getElementById('voicePrompt');
const faceIdPromptEl = document.getElementById('faceIdPrompt');
const methodsSummaryEl = document.getElementById("methodsSummary");
const loginGestureCard = document.getElementById("loginGestureCard");
const loginFaceMotionCard = document.getElementById("loginFaceMotionCard");
const loginVoiceCard = document.getElementById("loginVoiceCard");
const loginFaceIdCard = document.getElementById("loginFaceIdCard");
const loginGestureState = document.getElementById("loginGestureState");
const loginFaceMotionState = document.getElementById("loginFaceMotionState");
const loginVoiceState = document.getElementById("loginVoiceState");
const loginFaceIdState = document.getElementById("loginFaceIdState");

// -------------------- Load saved settings --------------------
const { userId: loginUserId, enabledMethods: enabledDb } = getAuthState();

const enabled = {
  gesture: enabledDb?.gesture || false,
  faceMotion: enabledDb?.faceMotion || false,
  voice: enabledDb?.voice || false,
  faceId: enabledDb?.faceId || false
};

let savedGestureTemplate = null;
let savedFacePassword = [];
let savedVoicePassphrase = "";
let savedVoiceTemplate = null;
let savedFaceIdTemplate = null;
let authDataLoaded = false;
let authDataPromise = null;

function hasGestureSetup() {
  return !!savedGestureTemplate?.frames?.length;
}

function hasFaceMotionSetup() {
  return Array.isArray(savedFacePassword) && savedFacePassword.length > 0;
}

function hasVoiceSetup() {
  return !!savedVoiceTemplate && !!savedVoicePassphrase;
}

function hasFaceIdSetup() {
  return !!savedFaceIdTemplate;
}

// -------------------- recognizer state --------------------
let gestureRecognizer, faceLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;
let lastTime = -1;

let attemptGestureFrames = [];
let detectedFaceEvents = [];
let faceMotionBaseline = null;

let gestureGoodFrames = 0;
let faceGoodFrames = 0;

let gestureSeeing = false;
let faceSeeing = false;

let voiceGoodFrames = 0;
let voicePassed = false;
let voiceSeeing = false; 
let promptMatched = false;
let currentPrompt = "";

let voiceAttempts = 0;
const MAX_VOICE_ATTEMPTS = 5;

let faceIdGoodFrames = 0;
let faceIdSeeing = false;
let faceIdWellPositioned = false;

let faceIdState = "idle"; 
let faceIdScanStartTime = 0;
let faceIdCooldownUntil = 0;
let voicePromptTimeout = null;
let faceIdPromptTimeout = null;
let statusTimeout = null;
let statusOverrideMessage = "";

// -------------------- Session state --------------------
const LOGIN_TIMEOUT_MS = 60000; 

let loginSession = {
  startedAt: 0,
  expiresAt: 0,
  completed: {
    gesture: false,
    faceMotion: false,
    faceId: false,
    voice: false
  }
};

async function loadLoginAuthData() {
  if (authDataPromise) return authDataPromise;

  authDataPromise = (async () => {
  if (!loginUserId) {
    status.textContent = "No login user found. Please sign in first.";
    return false;
  }

  try {
    const res = await fetch(`http://localhost:4000/login-auth-data/${loginUserId}`, {
      credentials: "include"
    });
    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.message || "Failed to load login data.";
      return false;
    }

    savedGestureTemplate = data.gestureTemplate;
    savedFacePassword = data.faceSequence || [];
    savedVoiceTemplate = data.voiceTemplate;
    savedVoicePassphrase = (data.voicePassphrase || "").trim();
    savedFaceIdTemplate = data.faceIdTemplate;

    // The backend is the source of truth for which methods this account actually has enabled.
    const backendEnabled = {
      gesture: !!data.methods?.gesture_enabled,
      faceMotion: !!data.methods?.face_motion_enabled,
      voice: !!data.methods?.voice_enabled,
      faceId: !!data.methods?.face_id_enabled
    };

    // Also require the expected stored data to exist so the UI cannot show a broken method.
    enabled.gesture = backendEnabled.gesture && hasGestureSetup();
    enabled.faceMotion = backendEnabled.faceMotion && hasFaceMotionSetup();
    enabled.voice = backendEnabled.voice && hasVoiceSetup();
    enabled.faceId = backendEnabled.faceId && hasFaceIdSetup();
    authDataLoaded = true;

    saveAuthState({
      userId: loginUserId,
      username: getAuthState().username,
      enabledMethods: {
        gesture: enabled.gesture,
        faceMotion: enabled.faceMotion,
        voice: enabled.voice,
        faceId: enabled.faceId
      }
    });

    return true;
  } catch (err) {
    console.error(err);
    status.textContent = "Error loading login authentication data.";
    authDataPromise = null;
    return false;
  }
  })();

  return authDataPromise;
}

function setStatusMessage(message, options = {}) {
  const { transient = false, duration = 1500 } = options;

  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  statusOverrideMessage = message;
  status.textContent = message;

  if (!transient) return;

  statusTimeout = setTimeout(() => {
    statusOverrideMessage = "";
    statusTimeout = null;
    renderStatus();
  }, duration);
}

// -------------------- Combined status rendering --------------------
function renderStatus() {
  renderMethodChecklist();

  if (statusOverrideMessage) {
    status.textContent = statusOverrideMessage;
    return;
  }

  if (!enabled.gesture && !enabled.faceMotion && !enabled.voice && !enabled.faceId) {
    status.textContent = "No login methods enabled.";
    return;
  }

  // Show the most immediate camera-driven action first, then fall back to background tasks like voice.
  if (enabled.faceId && !loginSession.completed.faceId && faceIdState === "scanning") {
    status.textContent = "Verifying Face ID...";
    return;
  }

  if (enabled.faceMotion && !loginSession.completed.faceMotion && faceSeeing) {
    status.textContent = "Verifying facial motion...";
    return;
  }

  if (enabled.gesture && !loginSession.completed.gesture && gestureSeeing) {
    status.textContent = "Verifying gesture...";
    return;
  }

  if (enabled.voice && !loginSession.completed.voice && voiceSeeing) {
    status.textContent = "Listening for your voice...";
    return;
  }

  const requiredMethods = Object.values(enabled).filter(Boolean).length;
  const completedMethods = Object.values(loginSession.completed).filter(Boolean).length;

  if (completedMethods > 0 && completedMethods < requiredMethods) {
    status.textContent = "Continue with your remaining methods.";
    return;
  }

  status.textContent = "Complete your enabled methods.";
}

function setMethodState(element, value) {
  if (!element) return;

  const states = {
    pending: "Waiting",
    active: "In Progress",
    done: "Complete",
    unavailable: "Not Set"
  };

  element.textContent = states[value] || states.pending;
  element.className = `method-progress-state ${value}`;
}

function renderMethodChecklist() {
  const allCards = [
    loginGestureCard,
    loginFaceMotionCard,
    loginVoiceCard,
    loginFaceIdCard
  ];

  if (!authDataLoaded) {
    for (const card of allCards) {
      if (card) card.hidden = true;
    }

    if (methodsSummaryEl) {
      methodsSummaryEl.textContent = "Enable webcam to load your registered methods.";
    }
    return;
  }

  const items = [
    {
      enabled: enabled.gesture,
      configured: enabled.gesture && hasGestureSetup(),
      card: loginGestureCard,
      stateEl: loginGestureState,
      state: !(enabled.gesture && hasGestureSetup())
        ? "unavailable"
        : loginSession.completed.gesture
          ? "done"
          : gestureSeeing || gestureGoodFrames > 0
            ? "active"
            : "pending"
    },
    {
      enabled: enabled.faceMotion,
      configured: enabled.faceMotion && hasFaceMotionSetup(),
      card: loginFaceMotionCard,
      stateEl: loginFaceMotionState,
      state: !(enabled.faceMotion && hasFaceMotionSetup())
        ? "unavailable"
        : loginSession.completed.faceMotion
          ? "done"
          : faceSeeing || faceGoodFrames > 0
            ? "active"
            : "pending"
    },
    {
      enabled: enabled.voice,
      configured: enabled.voice && hasVoiceSetup(),
      card: loginVoiceCard,
      stateEl: loginVoiceState,
      state: !(enabled.voice && hasVoiceSetup())
        ? "unavailable"
        : loginSession.completed.voice
          ? "done"
          : voiceSeeing || voiceGoodFrames > 0
            ? "active"
            : "pending"
    },
    {
      enabled: enabled.faceId,
      configured: enabled.faceId && hasFaceIdSetup(),
      card: loginFaceIdCard,
      stateEl: loginFaceIdState,
      state: !(enabled.faceId && hasFaceIdSetup())
        ? "unavailable"
        : loginSession.completed.faceId
          ? "done"
          : faceIdSeeing || faceIdState !== "idle"
            ? "active"
            : "pending"
    }
  ];

  const requiredItems = items.filter(item => item.configured);

  for (const item of items) {
    if (!item.card) continue;
    item.card.hidden = false;
    setMethodState(item.stateEl, item.state);
  }

  if (!methodsSummaryEl) return;

  if (!requiredItems.length) {
    methodsSummaryEl.textContent = "No password methods are enabled for this account.";
    return;
  }

  const completedCount = requiredItems.filter(item => item.state === "done").length;
  methodsSummaryEl.textContent =
    completedCount === requiredItems.length
      ? "All required methods are complete."
      : `${completedCount} of ${requiredItems.length} required methods completed.`;
}

renderMethodChecklist();

loadLoginAuthData().then(() => {
  renderMethodChecklist();
  renderStatus();
});

function startLoginSession() {
  loginSession.startedAt = Date.now();
  loginSession.expiresAt = loginSession.startedAt + LOGIN_TIMEOUT_MS;

  loginSession.completed = {
    gesture: false,
    faceMotion: false,
    faceId: false,
    voice: false
  };
}

function hasLoginTimedOut() {
  return webcamRunning && Date.now() > loginSession.expiresAt;
}

function completeMethod(method) {
  if (loginSession.completed[method]) return;

  loginSession.completed[method] = true;

  const methodMessages = {
    gesture: "Gesture verified!",
    faceMotion: "Facial motion verified!",
    voice: "Voice verified!",
    faceId: "Face ID verified!"
  };

  if (methodMessages[method]) {
    setStatusMessage(methodMessages[method], {
      transient: true,
      duration: 1500
    });
  }
}

function clearPromptMessage(element, timeoutKey) {
  if (timeoutKey === "voice" && voicePromptTimeout) {
    clearTimeout(voicePromptTimeout);
    voicePromptTimeout = null;
  }

  if (timeoutKey === "faceId" && faceIdPromptTimeout) {
    clearTimeout(faceIdPromptTimeout);
    faceIdPromptTimeout = null;
  }

  element.textContent = "";
  element.style.display = "none";
}

function setPromptMessage(element, message, options = {}) {
  const { transient = false, duration = 1800, timeoutKey = null } = options;

  if (timeoutKey === "voice" && voicePromptTimeout) {
    clearTimeout(voicePromptTimeout);
    voicePromptTimeout = null;
  }

  if (timeoutKey === "faceId" && faceIdPromptTimeout) {
    clearTimeout(faceIdPromptTimeout);
    faceIdPromptTimeout = null;
  }

  element.style.display = "block";
  element.textContent = message;

  if (!transient || !timeoutKey) return;

  const timeoutId = setTimeout(() => {
    if (element.textContent === message) {
      element.textContent = "";
      element.style.display = "none";
    }

    if (timeoutKey === "voice") voicePromptTimeout = null;
    if (timeoutKey === "faceId") faceIdPromptTimeout = null;
  }, duration);

  if (timeoutKey === "voice") voicePromptTimeout = timeoutId;
  if (timeoutKey === "faceId") faceIdPromptTimeout = timeoutId;
}

function resetLoginAttempt(message = "Login timed out. Please try again.") {
  statusOverrideMessage = "";
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  // Reset method progress
  attemptGestureFrames = [];
  detectedFaceEvents = [];
  faceMotionBaseline = null;

  gestureGoodFrames = 0;
  faceGoodFrames = 0;
  voiceGoodFrames = 0;
  faceIdGoodFrames = 0;

  gestureSeeing = false;
  faceSeeing = false;
  voiceSeeing = false;
  faceIdSeeing = false;

  voicePassed = false;
  promptMatched = false;

  faceIdCooldownUntil = 0;
  resetFaceIdAttempt();

  // Reset completed session state
  startLoginSession();

  clearPromptMessage(voicePromptEl, "voice");
  clearPromptMessage(faceIdPromptEl, "faceId");

  if (enabled.voice && savedVoiceTemplate && currentPrompt) {
    runVoiceAttemptLoop();
  }

  renderStatus();
  status.textContent = message;
}

// -------------------- Models --------------------
async function initRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  if (enabled.gesture) {
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "../models/gesture_recognizer.task", delegate: "GPU" },
      runningMode
    });
  }

  if (enabled.faceMotion || enabled.faceId) {
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "../models/face_landmarker.task", delegate: "GPU" },
      runningMode,
      numFaces: 1,
      outputFaceBlendshapes: true
    });
  }

  renderStatus();
}

// -------------------- Matching helpers --------------------
// Face
function isSubsequence(events, pattern) {
  if (!pattern || pattern.length === 0) return false;
  let j = 0;
  for (let i = 0; i < events.length && j < pattern.length; i++) {
    if (String(events[i]).toLowerCase() === String(pattern[j]).toLowerCase()) j++;
  }
  return j === pattern.length;
}

async function verifyFaceIdWithBackend(userId, videoEl) {
  // Face ID verification stays server-side so the client never decides the final image match alone.
  const imageBlob = await captureFaceImageFromVideo(videoEl);

  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("faceIdImage", imageBlob, "faceid-login.jpg");

  const res = await fetch("http://localhost:4000/verify-face-id", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.message || "Face ID backend verification failed");
  }

  return data;
}

function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;

    const oscillatorA = audioContext.createOscillator();
    const oscillatorB = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillatorA.type = "sine";
    oscillatorB.type = "sine";
    oscillatorA.frequency.setValueAtTime(880, now);
    oscillatorB.frequency.setValueAtTime(1320, now + 0.08);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    oscillatorA.connect(gainNode);
    oscillatorB.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillatorA.start(now);
    oscillatorA.stop(now + 0.22);
    oscillatorB.start(now + 0.08);
    oscillatorB.stop(now + 0.45);

    setTimeout(() => {
      audioContext.close().catch(() => {});
    }, 650);
  } catch (error) {
    console.warn("Could not play success chime:", error);
  }
}

// Access helper
function grantAccess(type) {
  statusOverrideMessage = "";
  if (statusTimeout) {
    clearTimeout(statusTimeout);
    statusTimeout = null;
  }

  status.textContent = "✅ Access Granted";
  playSuccessChime();
  webcamRunning = false;

  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(t => t.stop());

  setTimeout(() => {
    window.location.href = "dashboard.html";
  }, 1000);
}

function resetFaceIdAttempt() {
  faceIdGoodFrames = 0;
  faceIdWellPositioned = false;
  faceIdScanStartTime = 0;
  faceIdState = "idle";
}

function failFaceIdAttempt(now) {
  faceIdGoodFrames = 0;
  faceIdWellPositioned = false;
  faceIdScanStartTime = 0;
  faceIdState = "failed";
  faceIdCooldownUntil = now + 1200;
}

// Simple spectral summary = demo voiceprint (robust enough for prototype)

async function runVoiceAttemptLoop() {
  if (!enabled.voice || !savedVoiceTemplate) return;

  if (!currentPrompt) {
    setPromptMessage(voicePromptEl, "No voice passphrase saved. Go to Register and set one.", {
      timeoutKey: "voice"
    });
    return;
  }

  voiceAttempts = 0;

  while (webcamRunning && voiceAttempts < MAX_VOICE_ATTEMPTS && !voicePassed) {
    voiceAttempts++;
    voiceSeeing = true;
    renderStatus();

    setPromptMessage(
      voicePromptEl,
      `Say your passphrase anytime (${voiceAttempts}/${MAX_VOICE_ATTEMPTS})`,
      { timeoutKey: "voice" }
    );

    const res = await listenForPrompt(currentPrompt, 6, promptWordMatch);

    if (!webcamRunning) return;

    if (!res.ok) {
      voiceSeeing = false;
      renderStatus();
      setPromptMessage(
        voicePromptEl,
        `Not matched. Try again (${voiceAttempts}/${MAX_VOICE_ATTEMPTS})`,
        { timeoutKey: "voice" }
      );
      continue; // attempt again
    }

    // If phrase matched -> record for voiceprint comparison
    try {
      setPromptMessage(voicePromptEl, "Checking your voice…", { timeoutKey: "voice" });
      const blob = await recordAudioSeconds(3);
      const audioBuffer = await blobToAudioBuffer(blob);
      const vp = extractVoiceprint(audioBuffer);

      const sim = cosineSim(vp, savedVoiceTemplate);
      voiceGoodFrames = sim > 0.90 ? 2 : 0;
      voicePassed = voiceGoodFrames >= 2;

      if (voicePassed) {
        completeMethod("voice");
      }
    } catch (e) {
      console.error(e);
      voiceGoodFrames = 0;
      voicePassed = false;
    }

    voiceSeeing = false;
    renderStatus();

    if (!voicePassed) {
      setPromptMessage(
        voicePromptEl,
        `Voice didn’t match. Try again (${voiceAttempts}/${MAX_VOICE_ATTEMPTS})`,
        { timeoutKey: "voice" }
      );
    } else {
      setPromptMessage(voicePromptEl, "Voice verified!", {
        transient: true,
        duration: 1500,
        timeoutKey: "voice"
      });
    }
  }

  if (!voicePassed && webcamRunning) {
    setPromptMessage(voicePromptEl, "Too many attempts. Disable/Enable webcam to retry.", {
      timeoutKey: "voice"
    });
  }
}

// -------------------- Webcam button --------------------

enableBtn.onclick = async () => {
  const authLoaded = await loadLoginAuthData();
  if (!authLoaded) return;

  if (
    (enabled.gesture && !gestureRecognizer) ||
    ((enabled.faceMotion || enabled.faceId) && !faceLandmarker)
  ) {
    await initRecognizer();
  }

  if (!enabled.gesture && !enabled.faceMotion && !enabled.voice && !enabled.faceId) {
    status.textContent = "No login methods enabled.";
    return;
  }

  webcamRunning = !webcamRunning;

  if (webcamRunning) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    startLoginSession();

    attemptGestureFrames = [];
    detectedFaceEvents = [];
    faceMotionBaseline = null;

    gestureGoodFrames = 0;
    faceGoodFrames = 0;
    voiceGoodFrames = 0;

    gestureSeeing = false;
    faceSeeing = false;

    voiceSeeing = false;
    voicePassed = false;
    promptMatched = false;

    faceIdSeeing = false;
    faceIdWellPositioned = false;
    faceIdCooldownUntil = 0;
    resetFaceIdAttempt();
    clearPromptMessage(faceIdPromptEl, "faceId");

    currentPrompt = savedVoicePassphrase;

    if (enabled.voice && savedVoiceTemplate) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SR) {
        setPromptMessage(voicePromptEl, "Voice prompt not supported in this browser. Use Chrome.", {
          timeoutKey: "voice"
        });
      } else if (!currentPrompt) {
        setPromptMessage(voicePromptEl, "No voice passphrase saved. Go to Register and set one.", {
          timeoutKey: "voice"
        });
      } else {
        setPromptMessage(voicePromptEl, `Say: "${currentPrompt}"`, {
          timeoutKey: "voice"
        });
        runVoiceAttemptLoop();
      }
    } else {
      clearPromptMessage(voicePromptEl, "voice");
    }

    if (enabled.faceId && savedFaceIdTemplate) {
      setPromptMessage(
        faceIdPromptEl,
        "Center your face, then blink once to confirm it is live.",
        { timeoutKey: "faceId" }
      );
    } else {
      clearPromptMessage(faceIdPromptEl, "faceId");
    }

    renderStatus();
    video.onloadeddata = () => predict();
  } else {
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    statusOverrideMessage = "";
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }

    resetFaceIdAttempt();

    loginSession.completed = {
      gesture: false,
      faceMotion: false,
      faceId: false,
      voice: false
    };

    clearPromptMessage(voicePromptEl, "voice");
    clearPromptMessage(faceIdPromptEl, "faceId");

    status.textContent = "Authentication started. Complete your enabled methods.";

    renderStatus();
  }
};

// -------------------- Predict loop --------------------
async function predict() {
  if (!webcamRunning) return;

  if (hasLoginTimedOut()) {
    resetLoginAttempt();
    if (webcamRunning) requestAnimationFrame(predict);
    return;
  }

  const now = Date.now();

  let gesturePassed = false;
  let facePassed = false;
  let faceIdPassed = false;

  if (video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const draw = new DrawingUtils(ctx);

    gestureSeeing = false;
    faceSeeing = false;
    faceIdSeeing = false;
    faceIdWellPositioned = false;

    // ---------------- GESTURE CHECK ----------------
  if (
    enabled.gesture && 
    !loginSession.completed.gesture &&
    gestureRecognizer && 
    savedGestureTemplate?.frames?.length
  ) {
    const results = gestureRecognizer.recognizeForVideo(video, now);

    if (results.landmarks) {
      for (const lm of results.landmarks) {
        draw.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00" });
        draw.drawLandmarks(lm, { color: "#FF0000" });
      }
    }

    if (results.landmarks && results.landmarks.length > 0) {
      gestureSeeing = true;

      // Add latest frame
      recordFreehandFrame(attemptGestureFrames, results.landmarks[0]);

      // Keep buffer bounded (avoid infinite growth)
      const MAX_BUF = 120;
      if (attemptGestureFrames.length > MAX_BUF) attemptGestureFrames.shift();

      // DTW match once we have enough frames
      const { ok, dist } = matchGestureTemplate(attemptGestureFrames, savedGestureTemplate, {
        threshold: 0.35,
        band: 12,
        minFrames: 20
      });

      if (ok) {
        gestureGoodFrames++;
      } else {
        gestureGoodFrames = 0;
      }

      gesturePassed = gestureGoodFrames >= 6;

      if (gesturePassed) {
        completeMethod("gesture");
      }
    }
  }

    // ---------------- FACE CHECKS ----------------
    if ((enabled.faceMotion || enabled.faceId) && faceLandmarker) {
      const fRes = faceLandmarker.detectForVideo(video, now);
      const faceLandmarks = fRes.faceLandmarks?.[0] || null;
      if (
        enabled.faceMotion &&
        !loginSession.completed.faceMotion &&
        faceLandmarks &&
        !faceMotionBaseline
      ) {
        faceMotionBaseline = getHeadPose(faceLandmarks);
      }

      // Reuse one detected facial event per frame so multiple auth methods do not consume it twice.
      const sharedFaceEvt = fRes.faceBlendshapes?.length
        ? detectFaceEvent(fRes.faceBlendshapes[0], faceLandmarks, {
            headPoseBaseline: faceMotionBaseline
          })
        : null;

      // Facial Motion
      if (
        enabled.faceMotion && !loginSession.completed.faceMotion && savedFacePassword.length > 0
      ) {
        if (fRes.faceBlendshapes && fRes.faceBlendshapes.length > 0) {
          faceSeeing = true;

          if (sharedFaceEvt) {
            const FACE_BUFFER = 25;

            if (detectedFaceEvents[detectedFaceEvents.length - 1] !== sharedFaceEvt) {
              detectedFaceEvents.push(sharedFaceEvt);
              if (detectedFaceEvents.length > FACE_BUFFER) detectedFaceEvents.shift();
            }

            if (isSubsequence(detectedFaceEvents, savedFacePassword)) {
              faceGoodFrames++;
            } else {
              faceGoodFrames = 0;
            }

            facePassed = faceGoodFrames >= 4;

            if (facePassed) {
              completeMethod("faceMotion");
            }
          }
        }
      }

      // Face ID
      if (enabled.faceId && !loginSession.completed.faceId && savedFaceIdTemplate) {
        if (fRes.faceLandmarks && fRes.faceLandmarks.length > 0) {
          const landmarks = faceLandmarks;
          faceIdSeeing = true;
          faceIdWellPositioned = isFaceWellPositioned(landmarks);

          if (now < faceIdCooldownUntil) {
            // short pause after a failed attempt
            setPromptMessage(faceIdPromptEl, "Face ID failed. Hold steady and blink once to retry.", {
              timeoutKey: "faceId"
            });
          } else if (!faceIdWellPositioned) {
            resetFaceIdAttempt();
            faceIdSeeing = true;
            setPromptMessage(faceIdPromptEl, "Center your face in the frame.", {
              timeoutKey: "faceId"
            });
          } else {
            if (faceIdState === "idle") {
              faceIdState = "awaiting_blink";
              setPromptMessage(faceIdPromptEl, "Blink once to confirm it is really you.", {
                timeoutKey: "faceId"
              });
            }

            if (faceIdState === "awaiting_blink") {
              if (sharedFaceEvt === "BLINK") {
                // A blink acts as a lightweight liveness check before the server-side face match.
                faceIdState = "scanning";
                faceIdScanStartTime = now;
                setPromptMessage(faceIdPromptEl, "Blink detected. Hold still while we verify.", {
                  timeoutKey: "faceId"
                });
              }
            }

            if (faceIdState === "scanning") {
              const elapsed = now - faceIdScanStartTime;

              if (elapsed >= 2000 && faceIdState === "scanning") {
                faceIdState = "verifying";

                try {
                  const result = await verifyFaceIdWithBackend(loginUserId, video);

                  if (result.match) {
                    faceIdGoodFrames = 1;
                    faceIdPassed = true;
                    faceIdState = "matched";
                    setPromptMessage(faceIdPromptEl, "Face ID verified!", {
                      transient: true,
                      duration: 1500,
                      timeoutKey: "faceId"
                    });
                    completeMethod("faceId");
                  } else {
                    faceIdPassed = false;
                    failFaceIdAttempt(now);
                  }
                } catch (error) {
                  console.error("Backend Face ID verify failed:", error);
                  faceIdPassed = false;
                  failFaceIdAttempt(now);
                }
              }
            }
          }
        } else {
          faceIdSeeing = false;
          faceIdWellPositioned = false;
          resetFaceIdAttempt();
          setPromptMessage(faceIdPromptEl, "Show your face to start Face ID.", {
            timeoutKey: "faceId"
          });
        }
      }
    }

    renderStatus();

    // ---------------- ACCESS CONTROL ----------------
    const needGesture = !!enabled.gesture;
    const needFace = !!enabled.faceMotion;
    const needVoice = !!enabled.voice;
    const needFaceId = !!enabled.faceId;

    const okGesture = !needGesture || loginSession.completed.gesture;
    const okFace = !needFace || loginSession.completed.faceMotion;
    const okVoice = !needVoice || loginSession.completed.voice;
    const okFaceId = !needFaceId || loginSession.completed.faceId;

  if (okGesture && okFace && okVoice && okFaceId) {
    const type = [
      needGesture ? "Gesture" : null, 
      needFace ? "Face" : null, 
      needVoice ? "Voice" : null,
      needFaceId ? "Face ID" : null
    ]
      .filter(Boolean)
      .join(" + ");
    return grantAccess(type);
  }
  }

  if (webcamRunning) requestAnimationFrame(predict);
}
