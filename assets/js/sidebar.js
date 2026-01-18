// assets/js/sidebar.js
// Sistema unificado de sidebar basado en permisos de la base de datos
(function () {
  const navEl = document.getElementById("sidebar-nav");
  if (!navEl) return;

  // Mapeo de module_key (de role_permissions) a configuración de UI
  const MODULE_CONFIG = {
    "dashboard": { label: "Dashboard", href: "dashboard.html", order: 1 },
    "expenses": { label: "Expenses Engine", href: "expenses.html", order: 2 },
    "pipeline": { label: "Pipeline Manager", href: "pipeline.html", order: 3 },
    "projects": { label: "Projects", href: "projects.html", order: 4 },
    "vendors": { label: "Vendors", href: "vendors.html", order: 5 },
    "accounts": { label: "Accounts", href: "accounts.html", order: 6 },
    "estimator": { label: "Estimator Suite", href: "estimator.html", order: 7 },
    "team": { label: "Team Management", href: "team.html", order: 8 },
    "god_view": { label: "God View", href: "god-view.html", order: 9 },
    "reporting": { label: "Reporting", href: "reporting.html", order: 10 },
    "budgets": { label: "Budgets", href: "budgets.html", order: 11 },
    "roles": { label: "Roles Management", href: "roles.html", order: 12 },
    "settings": { label: "Settings", href: "settings.html", order: 13 },
    "audit": { label: "Audit Logs", href: "audit.html", order: 14 },
  };

  // Cache para evitar llamadas repetidas
  const CACHE_KEY = "sidebar_permissions";
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

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

  function getCachedPermissions() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { timestamp, permissions } = JSON.parse(cached);
      const now = Date.now();

      // Verificar si el cache expiró
      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return permissions;
    } catch (e) {
      console.warn("[SIDEBAR] Error reading cache:", e);
      return null;
    }
  }

  function setCachedPermissions(permissions) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        permissions: permissions
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[SIDEBAR] Error saving cache:", e);
    }
  }

  function render(permissions) {
    const current = getCurrentFile();

    // Filtrar solo módulos con permiso can_view = true
    const allowedModules = permissions
      .filter(p => p.can_view === true && MODULE_CONFIG[p.module_key])
      .map(p => ({
        ...MODULE_CONFIG[p.module_key],
        module_key: p.module_key
      }))
      .sort((a, b) => a.order - b.order);

    // Generar HTML
    navEl.innerHTML = allowedModules
      .map(m => {
        const active = m.href === current ? " nav-item-active" : "";
        return `<a href="${m.href}" class="nav-item${active}" data-module="${m.module_key}">${m.label}</a>`;
      })
      .join("");
  }

  async function initSidebar() {
    try {
      // 1) Intentar usar cache primero
      const cached = getCachedPermissions();
      if (cached) {
        console.log("[SIDEBAR] Using cached permissions");
        render(cached);
        return;
      }

      // 2) Obtener user_id desde /auth/me
      const { ok: authOk, data: authData } = await fetchJSON("/auth/me");

      if (!authOk || !authData || !authData.user_id) {
        console.warn("[SIDEBAR] No user data, showing minimal menu");
        // Mostrar solo dashboard como fallback
        render([{ module_key: "dashboard", can_view: true }]);
        return;
      }

      const userId = authData.user_id;
      console.log("[SIDEBAR] Fetching permissions for user:", userId);

      // 3) Consultar permisos del usuario desde el endpoint
      const { ok: permOk, data: permData } = await fetchJSON(`/permissions/user/${userId}`);

      if (!permOk || !permData || !permData.permissions) {
        console.warn("[SIDEBAR] No permissions data, showing minimal menu");
        render([{ module_key: "dashboard", can_view: true }]);
        return;
      }

      const permissions = permData.permissions;
      console.log("[SIDEBAR] User permissions loaded:", permissions.length, "modules");

      // 4) Guardar en cache
      setCachedPermissions(permissions);

      // 5) Renderizar sidebar
      render(permissions);

    } catch (error) {
      console.error("[SIDEBAR] Error loading permissions:", error);
      // Fallback: mostrar solo dashboard
      render([{ module_key: "dashboard", can_view: true }]);
    }
  }

  // Función para forzar recarga de permisos (útil después de cambios de rol)
  window.reloadSidebarPermissions = function() {
    localStorage.removeItem(CACHE_KEY);
    return initSidebar();
  };

  window.initSidebar = initSidebar;

  // Auto-init
  initSidebar();
})();
