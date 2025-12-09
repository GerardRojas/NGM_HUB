// assets/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // Asegurarnos de que usamos el valor global de config.js
  const API = window.API_BASE || (typeof API_BASE !== "undefined" ? API_BASE : undefined);

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
      if (!API) {
        console.error("API_BASE is not defined. Check config.js");
        alert("Login config error. Please contact support.");
        return;
      }

      const res = await fetch(`${API}/auth/login`, {
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

      localStorage.setItem("ngmUser", JSON.stringify(data.user));

      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Error in login:", err);
      alert("Network error. Check your connection or contact support.");
    }
  });
});
