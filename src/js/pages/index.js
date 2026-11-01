import { saveAuthState } from "../utils/authState.js";

const signupEntryForm = document.getElementById("signupEntryForm");
const submitBtn = signupEntryForm.querySelector("button[type='submit']");

signupEntryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();

  if (!username || !email) {
    alert("Please enter both a username and email address.");
    return;
  }

  try {
    submitBtn.disabled = true;

    const res = await fetch("http://localhost:4000/register", {
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
          gesture: false,
          faceMotion: false,
          voice: false,
          faceId: false
        }
      });

      window.location.href = "register.html";
    } else {
      alert(data.message || "We could not create your account. Please try again.");
    }
  } catch (err) {
    console.error(err);
    alert("We could not create your account. Please try again.");
  } finally {
    submitBtn.disabled = false;
  }
});
