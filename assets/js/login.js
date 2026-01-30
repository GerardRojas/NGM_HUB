// assets/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // Asegurarnos de que usamos el valor global de config.js
  const API =
    window.API_BASE || (typeof API_BASE !== "undefined" ? API_BASE : undefined);

  // ========================================
  // AUTO-REDIRECT IF ALREADY LOGGED IN
  // ========================================
  // NOTE: This is a backup check. The inline script in login.html should
  // handle most redirects, but this catches edge cases (e.g., direct navigation)
  const existingToken = localStorage.getItem("ngmToken");
  const existingUser = localStorage.getItem("ngmUser");

  if (existingToken && existingUser) {
    // Check if token is still valid (not expired)
    try {
      const payload = JSON.parse(atob(existingToken.split(".")[1]));
      const isExpired = payload.exp && payload.exp * 1000 < Date.now();

      // Also verify user data is valid JSON
      JSON.parse(existingUser);

      if (!isExpired) {
        // Token is valid - redirect directly to target page
        console.log("[Login] Valid session found, redirecting...");
        const saved = sessionStorage.getItem('loginRedirect');
        const target = (saved && saved !== 'login.html' && saved !== 'index.html') ? saved : 'dashboard.html';
        if (saved) sessionStorage.removeItem('loginRedirect');
        window.location.replace(target);
        return; // Stop execution
      } else {
        // Token expired - clean it up
        console.log("[Login] Session expired, please log in again");
        clearAuthData();
      }
    } catch (e) {
      // Invalid token or user data format - clean it up
      console.warn("[Login] Invalid auth data format:", e);
      clearAuthData();
    }
  }

  function clearAuthData() {
    localStorage.removeItem("ngmToken");
    localStorage.removeItem("ngmUser");
    localStorage.removeItem("sidebar_permissions");
  }

  const form = document.getElementById("loginForm");
  const userInput = document.getElementById("user");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("loginButton");
  const loginMessage = document.getElementById("loginMessage");

  if (!form || !userInput || !passwordInput || !loginButton) {
    console.error("Login form, inputs or button not found in DOM.");
    return;
  }

  // Referencias internas del botón (texto + spinner)
  const buttonLabel = loginButton.querySelector(".btn-primary__label");
  const buttonSpinner = loginButton.querySelector(".btn-primary__spinner");

  function setLoading(isLoading) {
    if (isLoading) {
      loginButton.classList.add("btn-primary--loading");
      loginButton.disabled = true;
    } else {
      loginButton.classList.remove("btn-primary--loading");
      loginButton.disabled = false;
    }
  }

  function showMessage(text, type = "info") {
    if (!loginMessage) return;
    loginMessage.textContent = text || "";

    loginMessage.classList.remove("auth-message--error");
    if (type === "error") {
      loginMessage.classList.add("auth-message--error");
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    // Limpia mensaje anterior
    showMessage("");

    if (!username || !password) {
      showMessage("Please enter user and password.", "error");
      return;
    }

    if (!API) {
      console.error("API_BASE is not defined. Check config.js");
      showMessage("Login config error. Please contact support.", "error");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for session handling
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          showMessage("Invalid username or password.", "error");
        } else if (res.status === 429) {
          showMessage("Too many login attempts. Please try again later.", "error");
        } else if (res.status >= 500) {
          showMessage("Server error. Please try again later.", "error");
        } else {
          showMessage("Login failed. Please try again later.", "error");
        }
        return;
      }

      const data = await res.json();

      // Validate response data
      if (!data.access_token || !data.user) {
        console.error("[Login] Invalid response from server:", data);
        showMessage("Login failed: Invalid server response.", "error");
        return;
      }

      // Store authentication data
      try {
        localStorage.setItem("ngmToken", data.access_token);
        localStorage.setItem("ngmUser", JSON.stringify(data.user));

        // Verify data was saved
        const savedToken = localStorage.getItem("ngmToken");
        const savedUser = localStorage.getItem("ngmUser");

        console.log("[Login] Authentication successful for user:", data.user.user_name);
        console.log("[Login] Token saved:", savedToken ? "YES" : "NO");
        console.log("[Login] User saved:", savedUser ? "YES" : "NO");

        if (!savedToken || !savedUser) {
          throw new Error("Failed to verify saved auth data");
        }
      } catch (e) {
        console.error("[Login] Failed to save auth data to localStorage:", e);
        showMessage("Login error: Unable to save session. Check browser settings.", "error");
        return;
      }

      // Show success message
      showMessage("Login successful. Redirecting...", "info");

      // Get redirect target BEFORE clearing
      const redirectTo = sessionStorage.getItem("loginRedirect") || "dashboard.html";
      sessionStorage.removeItem("loginRedirect");

      console.log("[Login] Redirecting to:", redirectTo);

      // Immediate redirect - no delay needed
      // Use href instead of replace to ensure navigation happens
      window.location.href = redirectTo;
    } catch (err) {
      console.error("Error in login:", err);
      showMessage("Network error. Check your connection or contact support.", "error");
    } finally {
      // Siempre quitamos loading al terminar (salvo que ya hayamos navegado)
      setLoading(false);
    }
  });
});
