// assets/js/sidebar.js
// Sistema unificado de sidebar basado en permisos de la base de datos
(function () {
  // Buscar el contenedor del sidebar
  const sidebarEl = document.getElementById("sidebar") || document.querySelector(".sidebar");
  if (!sidebarEl) return;

  // Definición de categorías con orden y labels
  // "general" es especial: no muestra header, aparece primero
  const CATEGORIES = {
    general: { label: null, order: 0 },  // Sin header, items generales
    coordination: { label: "Coordination", order: 1 },
    bookkeeping: { label: "Bookkeeping", order: 2 },
    architecture: { label: "Architecture", order: 3 },
    costs: { label: "Costs & Estimates", order: 4 },
    admin: { label: "Admin", order: 5 },
  };

  // Mapeo de module_key (de role_permissions) a configuración de UI
  // Cada módulo incluye su categoría para agrupamiento
  const MODULE_CONFIG = {
    // General (sin categoría visible)
    "dashboard": { label: "Dashboard", href: "dashboard.html", order: 1, category: "general" },
    "my_work": { label: "My Work", href: "my-work.html", order: 2, category: "general" },
    "messages": { label: "Messages", href: "messages.html", order: 3, category: "general" },
    "arturito": { label: "Arturito", href: "arturito.html", order: 4, category: "general" },

    // Coordination
    "operation_manager": { label: "Operation Manager", href: "operation-manager.html", order: 1, category: "coordination" },
    "pipeline": { label: "Pipeline Manager", href: "pipeline.html", order: 2, category: "coordination" },
    "process_manager": { label: "Process Manager", href: "process_manager.html", order: 7, category: "admin" },

    // Bookkeeping
    "expenses": { label: "Expenses Engine", href: "expenses.html", order: 1, category: "bookkeeping" },
    "budget_monitor": { label: "Budget Monitor", href: "budget_monitor.html", order: 2, category: "bookkeeping" },
    "budgets": { label: "Budgets", href: "budgets.html", order: 3, category: "bookkeeping" },
    "accounts": { label: "Accounts", href: "accounts.html", order: 4, category: "bookkeeping" },
    "vendors": { label: "Vendors", href: "vendors.html", order: 5, category: "bookkeeping" },
    "reporting": { label: "Reporting", href: "reporting.html", order: 6, category: "bookkeeping" },

    // Architecture
    "projects": { label: "Projects", href: "projects.html", order: 1, category: "architecture" },

    // Costs & Estimates
    "estimator": { label: "Estimator Suite", href: "estimator.html", order: 1, category: "costs" },
    "estimator_database": { label: "Estimator Database", href: "estimator_database.html", order: 2, category: "costs" },

    // Admin
    "team": { label: "Team Management", href: "team.html", order: 1, category: "admin" },
    "roles": { label: "Roles Management", href: "roles.html", order: 2, category: "admin" },
    "god_view": { label: "God View", href: "god-view.html", order: 3, category: "admin" },
    "arturito_settings": { label: "Arturito Settings", href: "arturito-settings.html", order: 4, category: "admin" },
    "settings": { label: "Settings", href: "settings.html", order: 5, category: "admin" },
    "audit": { label: "Audit Logs", href: "audit.html", order: 6, category: "admin" },
  };

  // Generar el HTML completo del sidebar
  function generateSidebarHTML() {
    return `
      <!-- Mobile header with close button -->
      <div class="sidebar-mobile-header">
        <span class="sidebar-mobile-title">NGM Hub</span>
        <button type="button" class="sidebar-close-btn" id="btnCloseSidebar" title="Close menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="sidebar-logo">
        <img src="assets/img/logo.png" alt="NGM HUB Logo" class="sidebar-logo-img" />
      </div>
      <div class="sidebar-title-block">
        <p class="sidebar-title">NGM HUB</p>
      </div>

      <div class="sidebar-nav-card">
        <nav class="sidebar-nav" id="sidebar-nav">
          <span class="nav-loading" style="color:rgba(255,255,255,0.4);font-size:12px;padding:8px 12px;">Loading...</span>
        </nav>
      </div>
    `;
  }

  // Inicializar el HTML del sidebar
  sidebarEl.innerHTML = generateSidebarHTML();

  // Ahora obtener la referencia al nav
  const navEl = document.getElementById("sidebar-nav");

  // Cache para evitar llamadas repetidas
  const CACHE_KEY = "sidebar_permissions";
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJSON(path) {
    if (!window.API_BASE) {
      console.error("[SIDEBAR] API_BASE not defined!");
      return { ok: false, status: 0, data: null };
    }
    const url = `${window.API_BASE}${path}`;
    console.log("[SIDEBAR] Fetching:", url);
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

      const { timestamp, permissions, userId } = JSON.parse(cached);
      const now = Date.now();

      // Verificar si el cache expiró
      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      // Verificar si el usuario cambió (logout/login con diferente usuario)
      const currentUser = localStorage.getItem("ngmUser");
      if (currentUser) {
        try {
          const user = JSON.parse(currentUser);
          const currentUserId = user.user_id || user.id;
          if (userId && currentUserId && userId !== currentUserId) {
            console.log("[SIDEBAR] User changed, invalidating cache");
            localStorage.removeItem(CACHE_KEY);
            return null;
          }
        } catch (e) {
          // Ignorar error de parsing
        }
      }

      return permissions;
    } catch (e) {
      console.warn("[SIDEBAR] Error reading cache:", e);
      return null;
    }
  }

  function setCachedPermissions(permissions, userId) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        permissions: permissions,
        userId: userId
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
      }));

    // Agrupar módulos por categoría
    const groupedModules = {};
    allowedModules.forEach(m => {
      const cat = m.category || "other";
      if (!groupedModules[cat]) {
        groupedModules[cat] = [];
      }
      groupedModules[cat].push(m);
    });

    // Ordenar módulos dentro de cada categoría
    Object.keys(groupedModules).forEach(cat => {
      groupedModules[cat].sort((a, b) => a.order - b.order);
    });

    // Ordenar categorías según CATEGORIES.order
    const sortedCategories = Object.keys(groupedModules)
      .filter(cat => CATEGORIES[cat]) // Solo categorías definidas
      .sort((a, b) => CATEGORIES[a].order - CATEGORIES[b].order);

    // Generar HTML con grupos
    let html = "";
    sortedCategories.forEach((cat, idx) => {
      const modules = groupedModules[cat];
      const categoryConfig = CATEGORIES[cat];

      // Agregar separador antes de cada grupo (excepto el primero)
      if (idx > 0) {
        html += `<div class="nav-group-separator"></div>`;
      }

      // Header de la categoría (solo si tiene label)
      if (categoryConfig.label) {
        html += `<div class="nav-group-header">${categoryConfig.label}</div>`;
      }

      // Links de los módulos
      modules.forEach(m => {
        const active = m.href === current ? " nav-item-active" : "";
        html += `<a href="${m.href}" class="nav-item${active}" data-module="${m.module_key}">${m.label}</a>`;
      });
    });

    navEl.innerHTML = html;
  }

  async function initSidebar() {
    try {
      // 0) Verificar que tenemos token antes de hacer cualquier fetch
      const token = localStorage.getItem("ngmToken");
      if (!token) {
        console.warn("[SIDEBAR] No token found, showing minimal menu");
        render([{ module_key: "dashboard", can_view: true }]);
        return;
      }

      // 1) Intentar usar cache primero
      const cached = getCachedPermissions();
      if (cached) {
        console.log("[SIDEBAR] Using cached permissions");
        render(cached);
        return;
      }

      console.log("[SIDEBAR] Fetching /auth/me with token...");

      // 2) Obtener user_id desde /auth/me
      const { ok: authOk, status: authStatus, data: authData } = await fetchJSON("/auth/me");

      console.log("[SIDEBAR] /auth/me response:", { ok: authOk, status: authStatus, data: authData });

      if (!authOk || !authData || !authData.user_id) {
        console.warn("[SIDEBAR] No user data from /auth/me, status:", authStatus);
        // Mostrar solo dashboard como fallback
        render([{ module_key: "dashboard", can_view: true }]);
        return;
      }

      const userId = authData.user_id;
      console.log("[SIDEBAR] Fetching permissions for user:", userId);

      // 3) Consultar permisos del usuario desde el endpoint
      const { ok: permOk, status: permStatus, data: permData } = await fetchJSON(`/permissions/user/${userId}`);

      console.log("[SIDEBAR] /permissions response:", { ok: permOk, status: permStatus, data: permData });

      if (!permOk || !permData || !permData.permissions) {
        console.warn("[SIDEBAR] No permissions data, status:", permStatus);
        render([{ module_key: "dashboard", can_view: true }]);
        return;
      }

      const permissions = permData.permissions;
      console.log("[SIDEBAR] User permissions loaded:", permissions.length, "modules");

      // 4) Guardar en cache (incluir userId para invalidar si cambia el usuario)
      setCachedPermissions(permissions, userId);

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

  // Auto-init - esperar a que API_BASE esté definido
  function waitForAPIAndInit() {
    if (window.API_BASE) {
      console.log("[SIDEBAR] API_BASE ready, initializing...");
      initSidebar();
    } else {
      console.log("[SIDEBAR] Waiting for API_BASE...");
      setTimeout(waitForAPIAndInit, 50);
    }
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForAPIAndInit);
  } else {
    waitForAPIAndInit();
  }
})();

// ============================================
// Mobile Sidebar Toggle
// ============================================
(function() {
  function initMobileSidebar() {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.sidebar-overlay');
    const openBtn = document.getElementById('btnMobileMenu') || document.querySelector('.mobile-menu-btn');

    if (!sidebar) return;

    function openSidebar() {
      sidebar.classList.add('is-open');
      if (overlay) overlay.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
      sidebar.classList.remove('is-open');
      if (overlay) overlay.classList.remove('is-visible');
      document.body.style.overflow = '';
    }

    // Open button click
    if (openBtn) {
      openBtn.addEventListener('click', openSidebar);
    }

    // Close button click - use event delegation since button is dynamically generated
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-close-btn')) {
        closeSidebar();
      }
      // Close sidebar when clicking a nav link (mobile)
      if (e.target.closest('.nav-item') && window.innerWidth <= 768) {
        closeSidebar();
      }
    });

    // Overlay click closes sidebar
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeSidebar();
      }
    });

    // Expose functions globally
    window.openMobileSidebar = openSidebar;
    window.closeMobileSidebar = closeSidebar;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileSidebar);
  } else {
    initMobileSidebar();
  }
})();
