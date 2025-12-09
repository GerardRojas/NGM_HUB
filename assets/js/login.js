// assets/js/login.js

// IMPORTANTE:
// Aquí asumimos que config.js define una constante global API_BASE,
// por ejemplo:
//   const API_BASE = "http://127.0.0.1:8000";
// ó en producción:
//   const API_BASE = "https://tu-backend.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const userInput = document.getElementById("user");
  const passwordInput = document.getElementById("password");

  if (!form || !userInput || !passwordInput) {
    console.error("Login form or inputs not found in DOM.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = userInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert("Please enter user and password.");
      return;
    }

    try {
      if (typeof API_BASE === "undefined") {
        console.error("API_BASE is not defined. Check config.js");
        alert("Login config error. Please contact support.");
        return;
      }

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          alert("Invalid username or password.");
        } else {
          alert("Login failed. Please try again later.");
        }
        return;
      }

      const data = await res.json();

      // Guardamos el usuario en localStorage para usarlo en el dashboard
      localStorage.setItem("ngmUser", JSON.stringify(data.user));

      // Redirigimos al dashboard (ajusta el nombre si usas otro archivo)
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Error in login:", err);
      alert("Network error. Check your connection or contact support.");
    }
  });
});
