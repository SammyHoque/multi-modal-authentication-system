export function saveAuthState({ userId, username, enabledMethods }) {
  if (userId !== undefined) {
    localStorage.setItem("authUserId", String(userId));
  }

  if (username !== undefined) {
    localStorage.setItem("authUsername", username);
  }

  if (enabledMethods !== undefined) {
    localStorage.setItem("authEnabledMethods", JSON.stringify(enabledMethods));
  }
}

export function getAuthState() {
  const userId = localStorage.getItem("authUserId");
  const username = localStorage.getItem("authUsername");
  const enabledMethods = localStorage.getItem("authEnabledMethods");

  return {
    userId: userId ? Number(userId) : null,
    username: username || null,
    enabledMethods: enabledMethods ? JSON.parse(enabledMethods) : null
  };
}

export function clearAuthState() {
  localStorage.removeItem("authUserId");
  localStorage.removeItem("authUsername");
  localStorage.removeItem("authEnabledMethods");
}