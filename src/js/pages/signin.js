import { saveAuthState } from "../utils/authState.js";

const signinForm = document.getElementById("signinForm");
const submitBtn = signinForm.querySelector("button[type='submit']");

signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("signinUsername").value.trim();
  const email = document.getElementById("signinEmail").value.trim();

  if (!username || !email) {
    alert("Please enter both your username and email address.");
    return;
  }

  try {
    submitBtn.disabled = true;

    const res = await fetch("http://localhost:4000/login-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ username, email })
    });

    const data = await res.json();

    if (res.ok) {
      saveAuthState({
        userId: data.user.id,
        username: data.user.username,
        enabledMethods: {
          gesture: !!data.methods?.gesture_enabled,
          faceMotion: !!data.methods?.face_motion_enabled,
          voice: !!data.methods?.voice_enabled,
          faceId: !!data.methods?.face_id_enabled
        }
      });

      window.location.href = "login.html";

    } else {
      alert(data.message || "We could not sign you in. Please check your details.");
    }

  } catch (err) {
    console.error(err);
    alert("We could not sign you in. Please try again.");
  } finally {
    submitBtn.disabled = false;
  }
});
