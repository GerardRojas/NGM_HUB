// assets/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // Asegurarnos de que usamos el valor global de config.js
  const API =
    window.API_BASE || (typeof API_BASE !== "undefined" ? API_BASE : undefined);

  // ========================================
  // AUTO-REDIRECT IF ALREADY LOGGED IN
  // ========================================
  const existingToken = localStorage.getItem("ngmToken");
  if (existingToken) {
    // Check if token is still valid (not expired)
    try {
      const payload = JSON.parse(atob(existingToken.split(".")[1]));
      const isExpired = payload.exp && payload.exp * 1000 < Date.now();

      if (!isExpired) {
        // Token is valid - redirect through index for smooth splash
        console.log("[Login] Valid session found, redirecting...");
        window.location.replace("index.html");
        return; // Stop execution
      } else {
        // Token expired - clean it up
        console.log("[Login] Session expired, please log in again");
        localStorage.removeItem("ngmToken");
        localStorage.removeItem("ngmUser");
      }
    } catch (e) {
      // Invalid token format - clean it up
      console.warn("[Login] Invalid token format:", e);
      localStorage.removeItem("ngmToken");
      localStorage.removeItem("ngmUser");
    }
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
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          showMessage("Invalid username or password.", "error");
        } else {
          showMessage("Login failed. Please try again later.", "error");
        }
        return;
      }

      const data = await res.json();

      localStorage.setItem("ngmToken", data.access_token);

      // Guarda usuario en localStorage para que el dashboard lo lea
      try {
        localStorage.setItem("ngmUser", JSON.stringify(data.user));
      } catch (e) {
        console.warn("Unable to write user to localStorage:", e);
      }

      // Opcional: pequeño mensaje antes de redirigir
      showMessage("Login successful. Redirecting...", "info");

      // Redirigir a dashboard o a donde venía el usuario
      const redirectTo = sessionStorage.getItem("loginRedirect") || "dashboard.html";
      sessionStorage.removeItem("loginRedirect");
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
