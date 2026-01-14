// assets/js/sidebar.js
(function () {
  const navEl = document.getElementById("sidebar-nav");
  if (!navEl) return;

  // Define aquí el "catálogo" total de módulos (id -> label/href)
  const MODULE_CATALOG = [
    { id: "dashboard", label: "Overview", href: "dashboard.html" },
    { id: "expenses", label: "Expenses", href: "expenses.html" },
    { id: "projects", label: "Projects", href: "projects.html" },
    { id: "pipeline", label: "Pipeline", href: "pipeline.html" },
    { id: "team", label: "Team", href: "team.html" },
    { id: "users", label: "Users", href: "users.html" },
    { id: "finance", label: "Finance", href: "finance.html" },
    { id: "estimator", label: "Estimator", href: "estimator.html" },
  ];

  // Fallback si /auth/me NO trae modules[]
  // Ajusta esto a tus roles reales
  const ROLE_MODULES = {
    Admin: ["dashboard", "projects", "pipeline", "team", "users", "expenses", "finance", "estimator"],
    Chief: ["dashboard", "projects", "pipeline", "team", "users", "expenses", "finance", "estimator"],
    Manager: ["dashboard", "projects", "pipeline", "team", "expenses"],
    Member: ["dashboard", "projects", "pipeline", "team"],
    Guest: ["dashboard"],
  };

  function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJSON(path) {
    const url = `${window.API_BASE}${path}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: { ...getAuthHeaders() },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function getCurrentFile() {
    const p = window.location.pathname || "";
    const last = p.split("/").pop() || "";
    return last || "dashboard.html";
  }

  function render(modIds) {
    const current = getCurrentFile();

    const allowed = new Set(modIds || []);
    const links = MODULE_CATALOG.filter(m => allowed.has(m.id));

    navEl.innerHTML = links
      .map(m => {
        const active = m.href === current ? " nav-item-active" : "";
        return `<a href="${m.href}" class="nav-item${active}">${m.label}</a>`;
      })
      .join("");
  }

  async function initSidebar() {
    // 1) Si ya guardaste módulos en localStorage (opcional), úsalo:
    // const cached = localStorage.getItem("allowed_modules");
    // if (cached) { render(JSON.parse(cached)); return; }

    // 2) Si no, consulta /auth/me
    const { ok, data } = await fetchJSON("/auth/me");

    if (!ok || !data) {
      render(ROLE_MODULES.Guest);
      return;
    }

    const role =
      data.role || data.user_role || data.user_type || "Member";

    // Si backend ya manda modules[] úsalo; si no, usa el mapa por role
    const modules = Array.isArray(data.modules)
      ? data.modules
      : (ROLE_MODULES[role] || ROLE_MODULES.Member);

    // Opcional: cache
    // localStorage.setItem("allowed_modules", JSON.stringify(modules));

    render(modules);
  }

  window.initSidebar = initSidebar;

  // Auto-init
  initSidebar();
})();
