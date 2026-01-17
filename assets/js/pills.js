// assets/js/pills.js
(function () {
  const envPill = document.getElementById("env-pill");
  const serverPill = document.getElementById("server-pill");
  const userPill = document.getElementById("user-pill");

  function set(el, text) {
    if (el) el.textContent = text;
  }

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

  async function loadHealth() {
    try {
      const { ok, data } = await fetchJSON("/health");
      console.log('[PILLS] Health check response:', { ok, data });

      if (!ok || !data) {
        set(envPill, "Environment · Unknown");
        set(serverPill, "Server · Offline");
        serverPill?.classList.remove('ngm-meta-status-live');
        serverPill?.classList.add('ngm-meta-status-offline');
        return;
      }

      const env = String(data.environment || data.env || "production");
      set(envPill, `Environment · ${env.toLowerCase() === "production" ? "Production" : env}`);
      set(serverPill, "Server · Live");
      serverPill?.classList.add('ngm-meta-status-live');
      serverPill?.classList.remove('ngm-meta-status-offline');
    } catch (err) {
      console.error('[PILLS] Error loading health:', err);
      set(envPill, "Environment · Unknown");
      set(serverPill, "Server · Offline");
      serverPill?.classList.remove('ngm-meta-status-live');
      serverPill?.classList.add('ngm-meta-status-offline');
    }
  }

  async function loadUser() {
    try {
      // Try to get user from localStorage first
      const storedUser = localStorage.getItem('ngmUser');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          console.log('[PILLS] User from localStorage:', user);
          const name = user.user_name || user.name || user.email || "User";
          const role = user.user_role || user.role || user.user_type || "Member";
          set(userPill, `${name} · ${role}`);
          return;
        } catch (e) {
          console.error('[PILLS] Error parsing stored user:', e);
        }
      }

      // Fallback to API
      const { ok, data } = await fetchJSON("/auth/me");
      console.log('[PILLS] Auth/me response:', { ok, data });

      if (!ok || !data) {
        set(userPill, "User · Guest");
        return;
      }

      const name = data.user_name || data.name || data.email || "User";
      const role = data.user_role || data.role || data.user_type || "Member";
      set(userPill, `${name} · ${role}`);
    } catch (err) {
      console.error('[PILLS] Error loading user:', err);
      set(userPill, "User · Guest");
    }
  }

  window.initTopbarPills = async function () {
    console.log('[PILLS] Initializing topbar pills with API_BASE:', window.API_BASE);
    await Promise.allSettled([loadHealth(), loadUser()]);
    console.log('[PILLS] Topbar pills initialization complete');
  };
})();
