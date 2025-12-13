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
    const { ok, data } = await fetchJSON("/health");
    if (!ok || !data) {
      set(envPill, "Environment · Unknown");
      set(serverPill, "Server · Offline");
      return;
    }
    const env = String(data.environment || data.env || "production");
    set(envPill, `Environment · ${env.toLowerCase() === "production" ? "Production" : env}`);
    set(serverPill, "Server · Online");
  }

  async function loadUser() {
    const { ok, data } = await fetchJSON("/auth/me");
    if (!ok || !data) {
      set(userPill, "User · Guest");
      return;
    }
    const name = data.name || data.user_name || data.email || "User";
    const role = data.role || data.user_role || data.user_type || "Member";
    set(userPill, `${name} · ${role}`);
  }

  window.initTopbarPills = async function () {
    await Promise.allSettled([loadHealth(), loadUser()]);
  };
})();
