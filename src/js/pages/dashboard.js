const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const updateAuthBtn = document.getElementById("updateAuthBtn");
const activeMethodsText = document.getElementById("activeMethodsText");
const securityLevelText = document.getElementById("securityLevelText");

const gestureStatus = document.getElementById("gestureStatus");
const faceMotionStatus = document.getElementById("faceMotionStatus");
const voiceStatus = document.getElementById("voiceStatus");
const faceIdStatus = document.getElementById("faceIdStatus");

import { getAuthState, clearAuthState } from "../utils/authState.js";

const { userId, username, enabledMethods } = getAuthState();

if (!userId) {
  window.location.href = "signin.html";
}

const methods = enabledMethods || {
  gesture: false,
  faceMotion: false,
  voice: false,
  faceId: false
};

if (username) {
  welcomeText.textContent = `Welcome, ${username}. You have successfully logged in.`;
}

function updateMethodBadge(element, isEnabled) {
  if (!element) return;

  element.textContent = isEnabled ? "Enabled" : "Disabled";
  element.classList.remove("enabled", "disabled");
  element.classList.add(isEnabled ? "enabled" : "disabled");
}

function getSecurityLevel(enabledCount) {
  if (enabledCount >= 4) return "Very High";
  if (enabledCount === 3) return "High";
  if (enabledCount === 2) return "Medium";
  if (enabledCount === 1) return "Low";
  return "Minimal";
}

updateMethodBadge(gestureStatus, methods.gesture);
updateMethodBadge(faceMotionStatus, methods.faceMotion);
updateMethodBadge(voiceStatus, methods.voice);
updateMethodBadge(faceIdStatus, methods.faceId);

const enabledCount =
  (methods.gesture ? 1 : 0) +
  (methods.faceMotion ? 1 : 0) +
  (methods.voice ? 1 : 0) +
  (methods.faceId ? 1 : 0);

if (activeMethodsText) {
  activeMethodsText.textContent = `${enabledCount} Enabled`;
}

if (securityLevelText) {
  securityLevelText.textContent = getSecurityLevel(enabledCount);
}

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("http://localhost:4000/logout", {
      method: "POST",
      credentials: "include"
    });
  } catch (error) {
    console.error("Logout request failed:", error);
  }

  clearAuthState();
  window.location.href = "index.html";
});

if (updateAuthBtn) {
  updateAuthBtn.addEventListener("click", () => {
    const { userId } = getAuthState();

    if (!userId) {
      alert("No logged-in user found. Please sign in again.");
      window.location.href = "signin.html";
      return;
    }

    localStorage.setItem("authUpdateMode", "true");
    window.location.href = "register.html";
  });
}
