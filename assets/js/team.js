// assets/js/team.js
document.addEventListener("DOMContentLoaded", () => {
  // 1) Auth / role gate (same pattern as dashboard.js)
  const userRaw = localStorage.getItem("ngmUser");
  if (!userRaw) {
    window.location.href = "login.html";
    return;
  }

  let user = null;
  try {
    user = JSON.parse(userRaw);
  } catch (err) {
    console.error("[TEAM] invalid ngmUser in localStorage", err);
    localStorage.removeItem("ngmUser");
    window.location.href = "login.html";
    return;
  }

  const role = String(user.role || user.role_id || "").trim();
  const allowedRoles = new Set(["COO", "CEO", "General Coordinator", "Project Coordinator"]);

  // Update topbar user pill (best-effort)
  const userPill = document.getElementById("user-pill");
  if (userPill) {
    const name = user.name || user.username || user.email || "User";
    userPill.textContent = `${name} · ${role || "—"}`;
  }

  if (!allowedRoles.has(role)) {
    alert("Access denied.");
    window.location.href = "dashboard.html";
    return;
  }

  // 2) DOM refs
  const board = document.getElementById("team-board");
  const placeholder = document.getElementById("team-placeholder");
  const searchInput = document.getElementById("team-search-input");

  if (!board) return;
  if (placeholder) placeholder.remove();

  // 2.5) Bind modal (must exist in DOM + ui script loaded BEFORE this file)
  try {
    window.TeamUserModal?.bind?.();
  } catch (e) {
    console.warn("[TEAM] TeamUserModal.bind() failed (modal not loaded yet?)", e);
  }

  // 3) API helpers
  function getApiBase() {
    const base = window.API_BASE || window.apiBase || "";
    return String(base || "").replace(/\/+$/, "");
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`${options.method || "GET"} ${url} failed (${res.status}): ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async function fetchTeamUsers(q = "") {
    const base = getApiBase();
    if (!base) throw new Error("API_BASE no está definido. Revisa assets/js/config.js");

    const url = new URL(`${base}/team/users`);
    if (q) url.searchParams.set("q", q);

    return await apiJson(url.toString());
  }

  async function apiDeleteUser(userId) {
    const base = getApiBase();
    return await apiJson(`${base}/team/users/${userId}`, { method: "DELETE" });
  }

  // 4) Helpers (UI)
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getInitial(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    return s[0].toUpperCase();
  }

  function normalize(s) {
    return String(s || "").toLowerCase().trim();
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // Stable hue from string (user_id or name)
  function stableHueFromString(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  function colorFromUser(u) {
    // Prefer avatar_color if provided (assumed 0..360)
    const ac = Number(u.avatar_color);
    const hue = Number.isFinite(ac) ? clamp(ac, 0, 360) : stableHueFromString(u.user_id || u.user_name);
    return `hsl(${hue} 70% 45%)`;
  }

  // Adapt API payload -> fields your existing render expects
  // IMPORTANT: keep role/seniority/status objects intact for the modal.
  function adaptUser(u) {
    const roleName = u?.role?.name || "-";
    const seniorityName = u?.seniority?.name || "-";
    const statusName = u?.status?.name || "-";

    return {
      ...u,
      user_role_name: roleName,
      user_seniority_name: seniorityName,
      user_status_name: statusName,
      color: colorFromUser(u),
    };
  }

  // 5) Store (real)
  let usersStore = [];

  // 6) Grid math
  function computeColsWanted(n) {
    if (n >= 9) return 4;
    if (n >= 6) return 3;
    if (n >= 4) return 2;
    if (n >= 2) return 2;
    return 1;
  }

  function computeMaxCols(availablePx, cardW, gap) {
    return Math.max(1, Math.floor((availablePx + gap) / (cardW + gap)));
  }

  function getBoardWidth() {
    return (
      board.clientWidth ||
      board.parentElement?.clientWidth ||
      document.documentElement.clientWidth ||
      window.innerWidth ||
      0
    );
  }

  // 7) Filtering (local, fast)
  function filterUsers(query) {
    const q = normalize(query);
    if (!q) return usersStore.slice();

    return usersStore.filter((u) => {
      const hay = [
        u.user_name,
        u.user_role_name,
        u.user_seniority_name,
        u.user_status_name,
        u.user_address,
        u.user_birthday,
      ]
        .map(normalize)
        .join(" • ");

      return hay.includes(q);
    });
  }

  // 8) Render grid (no lanes)
  function render(list) {
    board.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "team-cards";

    const n = list.length;
    const colsWanted = computeColsWanted(n);

    const cardW = 280;
    const gap = 18;

    const available = Math.max(320, getBoardWidth() - 24);
    const maxCols = computeMaxCols(available, cardW, gap);
    const cols = Math.min(colsWanted, maxCols);

    wrap.style.gridTemplateColumns = `repeat(${cols}, ${cardW}px)`;
    wrap.style.gap = `${gap}px`;
    wrap.style.justifyContent = "start";

    list.forEach((u) => {
      const stack = document.createElement("div");
      stack.className = "team-card-stack";

      const back = document.createElement("div");
      back.className = "team-card-back";

      const card = document.createElement("div");
      card.className = "team-card";

      const safeName = escapeHtml(u.user_name);

      const roleVal = u.user_role_name || u.role?.name || "—";
      const seniorityVal = u.user_seniority_name || u.seniority?.name || "—";
      const statusVal = u.user_status_name || u.status?.name || "—";
      const phoneVal = u.user_phone_number || "—";
      const bdayVal = u.user_birthday || "—";
      const addrVal = u.user_address || "—";

      const safeRole = escapeHtml(roleVal);
      const safeSeniority = escapeHtml(seniorityVal);
      const safeStatus = escapeHtml(statusVal);
      const safePhone = escapeHtml(phoneVal);
      const safeBday = escapeHtml(bdayVal);
      const safeAddr = escapeHtml(addrVal);

      const initials = escapeHtml(getInitial(u.user_name));
      const bg = u.color || "#a3a3a3";

      const statusNorm = String(statusVal || "").trim().toLowerCase();
      const statusClass = statusNorm === "active" ? "is-active" : statusNorm ? "is-inactive" : "";

      const avatarHtml = u.user_photo
        ? `<img src="${escapeHtml(u.user_photo)}" alt="${safeName}" />`
        : `${initials}`;

      card.innerHTML = `
        <div class="team-avatar" style="background:${bg};" title="${safeName}">
          ${avatarHtml}
        </div>

        <div class="team-card-main">
          <div class="team-head">
            <p class="team-name" title="${safeName}">${safeName}</p>
            <span class="team-status-pill ${statusClass}" title="Status">${safeStatus}</span>
          </div>

          <div class="team-fields">
            <div class="team-field">
              <span class="team-field-label">Role</span>
              <span class="team-field-value">${safeRole}</span>
            </div>

            <div class="team-field">
              <span class="team-field-label">Seniority</span>
              <span class="team-field-value">${safeSeniority}</span>
            </div>

            <div class="team-field">
              <span class="team-field-label">Phone</span>
              <span class="team-field-value">${safePhone}</span>
            </div>

            <div class="team-field">
              <span class="team-field-label">Birthday</span>
              <span class="team-field-value">${safeBday}</span>
            </div>

            <div class="team-field">
              <span class="team-field-label">Address</span>
              <span class="team-field-value">${safeAddr}</span>
            </div>
          </div>

          <div class="team-card-actions">
            <button class="team-action-btn" data-action="edit" data-id="${escapeHtml(u.user_id)}">Edit</button>
            <button class="team-action-btn" data-action="delete" data-id="${escapeHtml(u.user_id)}">Delete</button>
          </div>
        </div>
      `;

      stack.appendChild(back);
      stack.appendChild(card);
      wrap.appendChild(stack);
    });

    board.appendChild(wrap);
  }

  function rerender() {
    const list = filterUsers(searchInput?.value || "");
    render(list);
  }

  // 9) Load from API
  async function loadUsersFromApi({ keepQuery = true } = {}) {
    const currentQ = keepQuery ? (searchInput?.value || "") : "";
    try {
      const data = await fetchTeamUsers("");
      usersStore = Array.isArray(data) ? data.map(adaptUser) : [];
      if (keepQuery && searchInput) searchInput.value = currentQ;
      rerender();
    } catch (err) {
      console.error("[TEAM] loadUsersFromApi failed:", err);
      alert("Failed to load team users. Check console.");
    }
  }

  // 10) Actions (Edit -> modal, Delete -> API)
  board.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const current = usersStore.find((x) => x.user_id === id);
      if (!current) {
        alert("User not found. Refresh and try again.");
        return;
      }

      window.TeamUserModal?.open({
        mode: "edit",
        user: current,
        onSaved: async () => {
          await loadUsersFromApi({ keepQuery: true });
        },
        onDeleted: async () => {
          await loadUsersFromApi({ keepQuery: true });
        },
      });

      return;
    }

    if (action === "delete") {
      const ok = confirm("Delete this user?");
      if (!ok) return;

      try {
        await apiDeleteUser(id);
        await loadUsersFromApi({ keepQuery: true });
      } catch (err) {
        console.error("[TEAM] delete failed:", err);
        alert("Delete failed. Check console.");
      }
    }
  });

  // 11) Search (debounced, local)
  let searchT = null;
  function onSearchInput() {
    clearTimeout(searchT);
    searchT = setTimeout(() => rerender(), 80);
  }
  if (searchInput) searchInput.addEventListener("input", onSearchInput);

  // 12) Top buttons
  document.getElementById("btn-refresh-team")?.addEventListener("click", () => loadUsersFromApi());

  document.getElementById("btn-add-user")?.addEventListener("click", () => {
    window.TeamUserModal?.open({
      mode: "create",
      onSaved: async () => {
        await loadUsersFromApi({ keepQuery: true });
      },
    });
  });

  // Reflow on resize (debounced)
  let resizeT = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => rerender(), 120);
  });

  // Initial load
  loadUsersFromApi({ keepQuery: false });
});
