// assets/js/dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  // 1) Leer usuario desde localStorage
  const rawUser = localStorage.getItem("ngmUser");

  if (!rawUser) {
    // Si no hay sesión, mandamos a login
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch (err) {
    console.error("Invalid ngmUser in localStorage:", err);
    localStorage.removeItem("ngmUser");
    window.location.href = "login.html";
    return;
  }

  // 2) Rellenar pill de usuario
  const userPill = document.getElementById("user-pill");
  if (userPill) {
    const roleText = user.role || "No role";
    const seniority = user.seniority || "";
    const seniorityText = seniority ? ` · ${seniority}` : "";
    userPill.textContent = `${user.username || "User"} · ${roleText}${seniorityText}`;
  }

  // 3) Filtrar módulos por rol y marcar coming soon
  const userRole = String(user.role || user.role_id || "").trim();

  document.querySelectorAll(".module-card").forEach((card) => {
    const rolesAttr = card.getAttribute("data-roles") || "";
    const allowedRoles = rolesAttr
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const status = card.getAttribute("data-status") || "active";

    // Si hay lista de roles y el rol del usuario no está, ocultamos
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      card.style.display = "none";
      return;
    }

    // Módulo coming soon -> gris + alerta al click
    if (status === "coming-soon") {
      card.classList.add("module-coming-soon");
      card.addEventListener("click", (event) => {
        event.preventDefault();
        alert("This module is coming soon.");
      });
    }
  });

  // 4) Placeholder para Pipeline
  // Más adelante aquí podemos llamar a /pipeline/my-tasks y pintar tarjetas
  const pipelineBox = document.getElementById("pipeline-tasks");
  const placeholder = document.getElementById("pipeline-placeholder");

  if (pipelineBox && placeholder) {
    // Por ahora solo mensaje dinámico con el nombre del usuario
    placeholder.textContent = `No tasks loaded yet for ${user.username || "you"}. ` +
      "This area will connect to the Pipeline Manager soon.";
  }

  // 5) (Opcional) Logout rápido si luego quieres un botón
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("ngmUser");
      window.location.href = "login.html";
    });
  }
});
