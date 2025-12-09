// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const userInput = document.getElementById("user");
  const passwordInput = document.getElementById("password");

  // Creamos (o reutilizamos) un contenedor para mensajes de error
  let errorBox = document.querySelector(".login-error");
  if (!errorBox) {
    errorBox = document.createElement("div");
    errorBox.className = "login-error";
    errorBox.style.marginTop = "10px";
    errorBox.style.fontSize = "0.9rem";
    errorBox.style.color = "#f97373"; // rojo suave
    errorBox.style.minHeight = "1.2em";
    form.appendChild(errorBox);
  }

  const submitButton = form.querySelector('button[type="submit"]');

  function setLoading(isLoading) {
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "Signing in..." : "Sign in";
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || "";
  }

  async function handleLogin(event) {
    event.preventDefault();
    showError("");

    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      showError("Please enter user and password.");
      return;
    }

    setLoading(true);

    try {
      // Debug opcional
      console.log("[LOGIN] Sending request to:", `${API_BASE}/auth/login`);

      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      if (!resp.ok) {
        let detail = "Invalid credentials or server error.";
        try {
          const errorData = await resp.json();
          if (errorData && (errorData.detail || errorData.message)) {
            detail = errorData.detail || errorData.message;
          }
        } catch (parseErr) {
          // si no es JSON, dejamos el mensaje genérico
        }
        showError(detail);
        setLoading(false);
        return;
      }

      const data = await resp.json();
      console.log("[LOGIN] Response:", data);

      // Guardamos token y algo de info básica en localStorage
      if (data.access_token) {
        localStorage.setItem("ngm_token", data.access_token);
      }
      if (data.user) {
        localStorage.setItem("ngm_user", data.user.username || username);
        if (data.user.role) {
          localStorage.setItem("ngm_role", data.user.role);
        }
      } else {
        // fallback mínimo
        localStorage.setItem("ngm_user", username);
      }

      // TODO: aquí después podemos hacer routing según el rol (admin, coordinator, etc.)
      // Por ahora lo mandamos al dashboard principal.
      window.location.href = "projects.html";
    } catch (error) {
      console.error("[LOGIN] Network or unexpected error:", error);
      showError("Error connecting to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener("submit", handleLogin);
});
