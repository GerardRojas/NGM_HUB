// assets/js/pills.js
(function () {

  const envPill = document.getElementById("env-pill");
  const serverPill = document.getElementById("server-pill");
  const userPill = document.getElementById("user-pill");

  function set(el, text) {
    if (el) el.textContent = text;
  }

  function authHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchJSON(url) {
    const res = await fetch(url, {
      credentials: "include",
      headers: authHeaders(),
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data };
  }

  async function loadUser() {
    const { ok, data } = await fetchJSON(`${window.API_BASE}/auth/me`);
    if (!ok || !data) {
      set(userPill, "User · Guest");
      return;
    }

    const name = data.name || data.email || "User";
    const role = data.role || "Member";
    set(userPill, `${name} · ${role}`);
  }

  async function loadEnvironment() {
    const { ok, data } = await fetchJSON(`${window.API_BASE}/health`);

    if (!ok || !data) {
      set(envPill, "Environment · Unknown");
      set(serverPill, "Server · Offline");
      return;
    }

    const env = (data.environment || "production").toLowerCase();
    set(envPill, `Environment · ${env === "production" ? "Production" : env}`);
    set(serverPill, "Server · Online");
  }

  window.initTopbarPills = async function () {
    await Promise.allSettled([
      loadUser(),
      loadEnvironment(),
    ]);
  };

})();
