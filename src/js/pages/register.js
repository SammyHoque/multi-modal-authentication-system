import { GestureRecognizer, FilesetResolver, DrawingUtils, FaceLandmarker }
  from "../utils/mediapipe.js";

import {
  recordAudioSeconds,
  blobToAudioBuffer,
  extractVoiceprint
} from "../auth/voice.js";

import { detectFaceEvent, getHeadPose } from "../auth/face.js";

import { recordFreehandFrame, buildGestureTemplate } from "../auth/gesture_dtw.js";

import { captureFaceImageFromVideo } from "../auth/faceid.js";

import { getAuthState, saveAuthState } from "../utils/authState.js";

// DOM references
const video = document.getElementById('webcam');
const canvas = document.getElementById('output_canvas');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const enableBtn = document.getElementById('enableCam');
const recordBtn = document.getElementById('recordBtn');
const optGesture = document.getElementById('optGesture');
const saveBtn = document.getElementById('saveBtn');
const optFaceMotion = document.getElementById('optFaceMotion');
const recordFaceMotionBtn = document.getElementById('recordFaceMotionBtn');
const optVoice = document.getElementById('optVoice');
const recordVoiceBtn = document.getElementById('recordVoiceBtn');
const voicePhraseEl = document.getElementById('voicePhrase');
const voiceBox = document.getElementById('voiceBox');
const optFaceId = document.getElementById('optFaceId');
const recordFaceIdBtn = document.getElementById('recordFaceIdBtn');
const gestureInstruction = document.getElementById("gestureInstruction");
const faceMotionInstruction = document.getElementById("faceMotionInstruction");
const voiceInstruction = document.getElementById("voiceInstruction");
const faceIdInstruction = document.getElementById("faceIdInstruction");
const registerMethodsSummary = document.getElementById("registerMethodsSummary");
const registerGestureCard = document.getElementById("registerGestureCard");
const registerFaceMotionCard = document.getElementById("registerFaceMotionCard");
const registerVoiceCard = document.getElementById("registerVoiceCard");
const registerFaceIdCard = document.getElementById("registerFaceIdCard");
const registerGestureState = document.getElementById("registerGestureState");
const registerFaceMotionState = document.getElementById("registerFaceMotionState");
const registerVoiceState = document.getElementById("registerVoiceState");
const registerFaceIdState = document.getElementById("registerFaceIdState");

function setRegisterMethodState(element, value) {
  if (!element) return;

  const states = {
    unselected: "Not Selected",
    pending: "Waiting",
    active: "Recording",
    done: "Recorded"
  };

  element.textContent = states[value] || states.pending;
  element.className = `register-progress-state ${value}`;
}

function updateVoiceUi() {
  // Voice recording only makes sense once the user has both enabled the method and typed a phrase.
  const phraseOk = (voicePhraseEl?.value || "").trim().length > 0;
  recordVoiceBtn.disabled = !optVoice.checked || !phraseOk;
  if (voiceBox) voiceBox.style.display = optVoice.checked ? "block" : "none";
  renderRegisterChecklist();
}

function updateMethodInstructions() {
  if (gestureInstruction) {
    gestureInstruction.style.display = optGesture.checked ? "block" : "none";
  }

  if (faceMotionInstruction) {
    faceMotionInstruction.style.display = optFaceMotion.checked ? "block" : "none";
  }

  if (voiceInstruction) {
    voiceInstruction.style.display = optVoice.checked ? "block" : "none";
  }

  if (faceIdInstruction) {
    faceIdInstruction.style.display = optFaceId.checked ? "block" : "none";
  }
}

if (voicePhraseEl) {
  voicePhraseEl.addEventListener("input", updateVoiceUi);
}
optVoice.addEventListener("change", () => {
  updateVoiceUi();
  updateMethodInstructions();
  renderRegisterChecklist();
});

// -------------------- State --------------------
let gestureRecognizer, faceLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;
let lastTime = -1;

let recording = false;
let recordedGestureFrames = [];
let recordedGestureTemplate = null;

let faceRecording = false;
let recordedFaceEvents = [];
let faceMotionBaseline = null;

let voiceTemplate = null;

let faceIdRecording = false;
let recordedFaceIdImageBlob = null;

function renderRegisterChecklist() {
  const items = [
    {
      enabled: true,
      selected: optGesture.checked,
      card: registerGestureCard,
      stateEl: registerGestureState,
      state: !optGesture.checked
        ? "unselected"
        : recording ? "active" : recordedGestureTemplate?.frames?.length ? "done" : "pending"
    },
    {
      enabled: true,
      selected: optFaceMotion.checked,
      card: registerFaceMotionCard,
      stateEl: registerFaceMotionState,
      state: !optFaceMotion.checked
        ? "unselected"
        : faceRecording ? "active" : recordedFaceEvents.length ? "done" : "pending"
    },
    {
      enabled: true,
      selected: optVoice.checked,
      card: registerVoiceCard,
      stateEl: registerVoiceState,
      state: !optVoice.checked
        ? "unselected"
        : voiceTemplate ? "done" : "pending"
    },
    {
      enabled: true,
      selected: optFaceId.checked,
      card: registerFaceIdCard,
      stateEl: registerFaceIdState,
      state: !optFaceId.checked
        ? "unselected"
        : faceIdRecording ? "active" : recordedFaceIdImageBlob ? "done" : "pending"
    }
  ];

  const selectedItems = items.filter(item => item.selected);

  for (const item of items) {
    if (!item.card) continue;
    item.card.hidden = false;
    setRegisterMethodState(item.stateEl, item.state);
  }

  if (!registerMethodsSummary) return;

  if (!selectedItems.length) {
    registerMethodsSummary.textContent = "Choose the methods you want to record.";
    return;
  }

  const doneCount = selectedItems.filter(item => item.state === "done").length;
  registerMethodsSummary.textContent =
    doneCount === selectedItems.length
      ? "All selected methods have been recorded."
      : `${doneCount} of ${selectedItems.length} selected methods recorded.`;
}

// ------------------- Checkboxes -------------------

// Enable/disable gesture record checkbox
recordBtn.disabled = !optGesture.checked;
optGesture.addEventListener('change', async () => {
  recordBtn.disabled = !optGesture.checked;
  updateMethodInstructions();
  renderRegisterChecklist();

  if (optGesture.checked && webcamRunning && !gestureRecognizer) {
    await initGestureRecognizer();
  }
});

// Enable/disable face capture checkbox
recordFaceMotionBtn.disabled = !optFaceMotion.checked;
optFaceMotion.addEventListener('change', async () => {
  updateMethodInstructions();
  recordFaceMotionBtn.disabled = !optFaceMotion.checked;
  renderRegisterChecklist();

  if (optFaceMotion.checked && webcamRunning && !faceLandmarker) {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    await initFaceLandmarker(vision);
  }
});

// Enable/disable face ID checkbox
recordFaceIdBtn.disabled = !optFaceId.checked;
optFaceId.addEventListener('change', async () => {
  updateMethodInstructions();
  recordFaceIdBtn.disabled = !optFaceId.checked;
  renderRegisterChecklist();

  if (optFaceId.checked && webcamRunning && !faceLandmarker) {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    await initFaceLandmarker(vision);
  }
});

// -------------------- Models --------------------
async function initGestureRecognizer() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );

  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "../models/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode
  });

  return vision;
}

async function initFaceLandmarker(vision) {
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "../models/face_landmarker.task",
      delegate: "GPU"
    },
    runningMode,
    numFaces: 1,
    outputFaceBlendshapes: true,
  });
}

// -------------------- Webcam --------------------
enableBtn.onclick = async () => {
  // Load gesture model if missing
  let vision = null;
  if (optGesture.checked && !gestureRecognizer) {
    vision = await initGestureRecognizer();
  }

  // Load face model only if requested
  if ((optFaceMotion.checked || optFaceId.checked) && !faceLandmarker) {
    if (!vision) {
      vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
    }
    await initFaceLandmarker(vision);
  }

  // Toggle webcam
  webcamRunning = !webcamRunning;
  if (webcamRunning) {
    const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: optVoice.checked // only request mic if Voice is selected
  });
    video.srcObject = stream;
    video.addEventListener("loadeddata", predict);
  } else {
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
  }
};

// -------------------- Main loop --------------------
async function predict() {
  if (!webcamRunning) return;
  const now = Date.now();

  if (video.currentTime !== lastTime) {
    lastTime = video.currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const draw = new DrawingUtils(ctx);

    // GESTURE DETECTION
    if (optGesture.checked && gestureRecognizer) {
      const results = gestureRecognizer.recognizeForVideo(video, now);

      if (results.landmarks) {
        for (const lm of results.landmarks) {
          draw.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00" });
          draw.drawLandmarks(lm, { color: "#FF0000" });
        }
      }

      if (recording && results.landmarks && results.landmarks.length > 0) {
        // Persist only the lead hand; the template builder normalises timing/position later.
        const hand = results.landmarks[0];
        recordFreehandFrame(recordedGestureFrames, hand);
      }
    }

    // FACE DETECTION
    if (faceLandmarker) {
      const fRes = faceLandmarker.detectForVideo(video, now);

      if (faceRecording && fRes.faceBlendshapes && fRes.faceBlendshapes.length > 0) {
        const landmarks = fRes.faceLandmarks?.[0] || null;
        if (landmarks && !faceMotionBaseline) {
          faceMotionBaseline = getHeadPose(landmarks);
        }

        const evt = detectFaceEvent(fRes.faceBlendshapes[0], landmarks, {
          headPoseBaseline: faceMotionBaseline
        });
        if (evt && recordedFaceEvents[recordedFaceEvents.length - 1] !== evt) {
          recordedFaceEvents.push(evt);
          status.textContent = `Recording face... ${recordedFaceEvents.join(" → ")}`;
        }
      }

      if (faceIdRecording && fRes.faceLandmarks && fRes.faceLandmarks.length > 0) {
        status.textContent = "Recording Face ID... keep looking straight at the camera";
      }
    }
  }

  requestAnimationFrame(predict);
}

// -------------------- Record buttons --------------------
recordBtn.onclick = () => {
  if (!optGesture.checked) {
    status.textContent = "Gesture is not enabled.";
    return;
  }

  recordedGestureFrames = [];
  recordedGestureTemplate = null;

  recording = true;
  status.textContent = "Recording freehand gesture (3 seconds)...";
  renderRegisterChecklist();

  setTimeout(() => {
    recording = false;
    recordedGestureTemplate = buildGestureTemplate(recordedGestureFrames, 60);
    status.textContent = "Gesture recorded successfully.";
    renderRegisterChecklist();
  }, 3000);
};

recordFaceMotionBtn.onclick = () => {
  if (!optFaceMotion.checked) {
    status.textContent = "Facial motion is not enabled.";
    return;
  }
  if (!faceLandmarker) {
    status.textContent = "Face model not loaded yet. Click Enable Webcam first.";
    return;
  }

  recordedFaceEvents = [];
  faceMotionBaseline = null;
  faceRecording = true;
  status.textContent = "Recording facial password (3 seconds)... Hold a neutral face for a moment, then begin.";
  renderRegisterChecklist();

  setTimeout(() => {
    faceRecording = false;
    faceMotionBaseline = null;
    status.textContent = "Facial motion recorded successfully.";
    renderRegisterChecklist();
  }, 3000);
};

recordFaceIdBtn.onclick = () => {
  if (!optFaceId.checked) {
    status.textContent = "Face ID is not enabled.";
    return;
  }

  if (!faceLandmarker) {
    status.textContent = "Face model not loaded yet. Click Enable Webcam first.";
    return;
  }

recordedFaceIdImageBlob = null;
faceIdRecording = true;
status.textContent = "Recording Face ID (look straight at the camera for 3 seconds)...";
renderRegisterChecklist();

setTimeout(async () => {
  faceIdRecording = false;

  try {
    recordedFaceIdImageBlob = await captureFaceImageFromVideo(video);

    if (!recordedFaceIdImageBlob) {
      status.textContent = "Face ID capture failed. Try again.";
      renderRegisterChecklist();
      return;
    }

    status.textContent = "Face ID recorded successfully.";
    renderRegisterChecklist();
  } catch (error) {
    console.error("Failed to capture Face ID image:", error);
    status.textContent = "Face ID image capture failed. Try again.";
    renderRegisterChecklist();
  }
}, 3000);
};

recordVoiceBtn.onclick = async () => {
  if (!optVoice.checked) {
    status.textContent = "Voice is not enabled.";
    return;
  }

    const phrase = (voicePhraseEl?.value || "").trim();
  if (!phrase) {
    status.textContent = "Type your voice passphrase first.";
    return;
  }

  try {
    status.textContent = "Recording voice (3 seconds)... Say: \"" + phrase + "\"";
    const blob = await recordAudioSeconds(3);
    const audioBuffer = await blobToAudioBuffer(blob);
    voiceTemplate = extractVoiceprint(audioBuffer);

    status.textContent = "Voice passphrase and template recorded successfully.";
    renderRegisterChecklist();
  } catch (e) {
    console.error(e);
    status.textContent = "Voice recording failed. Check mic permissions.";
    renderRegisterChecklist();
  }
};

// -------------------- Save --------------------
saveBtn.onclick = async () => {
  const { userId, username } = getAuthState();

  if (!userId) {
    status.textContent = "No user found. Please sign up or sign in first.";
    return;
  }

  const enabled = {
    gesture: optGesture.checked,
    faceMotion: optFaceMotion.checked,
    voice: optVoice.checked,
    faceId: optFaceId.checked
  };

  if (!enabled.gesture && !enabled.faceMotion && !enabled.voice && !enabled.faceId) {
    status.textContent = "Choose at least one authentication method.";
    return;
  }

  const phrase = (voicePhraseEl?.value || "").trim();

  if (enabled.voice && (!voiceTemplate || !phrase)) {
    // Treat an incomplete voice setup as "not enabled" rather than saving a broken method.
    enabled.voice = false;
  }

  if (enabled.faceId && !recordedFaceIdImageBlob) {
    enabled.faceId = false;
  }

  try {
    saveBtn.disabled = true;
    
    const formData = new FormData();
    formData.append("userId", Number(userId));
    formData.append("enabled", JSON.stringify(enabled));
    formData.append(
      "gestureTemplate",
      JSON.stringify(enabled.gesture ? recordedGestureTemplate : null)
    );
    formData.append(
      "faceSequence",
      JSON.stringify(enabled.faceMotion ? recordedFaceEvents : null)
    );
    formData.append(
      "voiceTemplate",
      JSON.stringify(enabled.voice ? voiceTemplate : null)
    );
    formData.append(
      "voicePassphrase",
      enabled.voice ? phrase : ""
    );
    
    formData.append("faceIdTemplate", JSON.stringify(null));

    if (enabled.faceId && recordedFaceIdImageBlob) {
      formData.append("faceIdImage", recordedFaceIdImageBlob, "faceid-register.jpg");
    }

    const res = await fetch("http://localhost:4000/save-auth-methods", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

  if (res.ok) {
    saveAuthState({
      userId: Number(userId),
      username,
      enabledMethods: {
        gesture: enabled.gesture,
        faceMotion: enabled.faceMotion,
        voice: enabled.voice,
        faceId: enabled.faceId
      }
    });

    status.textContent = "Authentication methods saved successfully.";

    const isUpdateMode = localStorage.getItem("authUpdateMode") === "true";

    if (isUpdateMode) {
      localStorage.removeItem("authUpdateMode");
      window.location.href = "dashboard.html";
    } else {
      window.location.href = "dashboard.html";
    }
    } else {
      status.textContent = data.message || "Failed to save methods.";
    }
  } catch (err) {
    console.error(err);
    status.textContent = "Error saving authentication methods.";
  }
  finally {
  saveBtn.disabled = false;
}
};

renderRegisterChecklist();

renderRegisterChecklist();
