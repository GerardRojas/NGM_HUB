// assets/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // Asegurarnos de que usamos el valor global de config.js
  const API =
    window.API_BASE || (typeof API_BASE !== "undefined" ? API_BASE : undefined);

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

      // Guarda usuario en localStorage para que el dashboard lo lea
      try {
        localStorage.setItem("ngmUser", JSON.stringify(data.user));
      } catch (e) {
        console.warn("Unable to write user to localStorage:", e);
      }

      // Opcional: pequeño mensaje antes de redirigir
      showMessage("Login successful. Redirecting...", "info");

      // Redirigir al dashboard
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Error in login:", err);
      showMessage("Network error. Check your connection or contact support.", "error");
    } finally {
      // Siempre quitamos loading al terminar (salvo que ya hayamos navegado)
      setLoading(false);
    }
  });
});
