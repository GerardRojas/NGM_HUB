// assets/js/team.js
document.addEventListener("DOMContentLoaded", () => {
  // 1) Auth / role gate
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
    if (window.Toast) {
      Toast.error('Access Denied', 'You do not have permission to access this page.');
    }
    window.location.href = "dashboard.html";
    return;
  }

  // Sidebar map (fallback). If another script already injects modules, this won't override.
  function injectSidebarMapIfEmpty() {
    const nav = document.getElementById("sidebar-nav");
    if (!nav) return;
    if (nav.children && nav.children.length) return;

    const current = (location.pathname.split("/").pop() || "").toLowerCase();
    const items = [
      { label: "Dashboard", href: "dashboard.html" },
      { label: "Pipeline", href: "pipeline.html" },
      { label: "Team", href: "team.html" },
      { label: "Estimator", href: "estimator.html" },
    ];

    nav.innerHTML = items
      .map((it) => {
        const isActive = current === it.href.toLowerCase();
        // Add multiple class names so it fits whatever global CSS you already have
        return `<a href="${it.href}" class="sidebar-link sidebar-nav-item ${isActive ? "active is-active" : ""}">${it.label}</a>`;
      })
      .join("");
  }
  injectSidebarMapIfEmpty();

  // 2) DOM refs
  const board = document.getElementById("team-board");
  const searchInput = document.getElementById("team-search-input");
  const pageLoadingOverlay = document.getElementById("pageLoadingOverlay");

  // View toggle: cards vs orgchart
  let currentView = "cards";
  const btnViewCards = document.getElementById("btn-view-cards");
  const btnViewOrgchart = document.getElementById("btn-view-orgchart");
  let orgchartInitialized = false;

  async function setView(view) {
    currentView = view;
    if (btnViewCards) btnViewCards.classList.toggle("active", view === "cards");
    if (btnViewOrgchart) btnViewOrgchart.classList.toggle("active", view === "orgchart");

    if (view === "orgchart") {
      if (window.TeamOrgChart) {
        if (!orgchartInitialized) {
          await window.TeamOrgChart.init(usersStore);
          orgchartInitialized = true;
        } else {
          window.TeamOrgChart.refresh(usersStore);
        }
        window.TeamOrgChart.show();
      }
    } else {
      if (window.TeamOrgChart) window.TeamOrgChart.hide();
    }
  }

  if (btnViewCards) btnViewCards.addEventListener("click", () => setView("cards"));
  if (btnViewOrgchart) btnViewOrgchart.addEventListener("click", () => setView("orgchart"));

  if (!board) return;

  // Page loading with logo wait
  const MIN_LOADING_TIME = 800;
  let logoReadyTime = null;

  (function initLogoReady() {
    if (!pageLoadingOverlay) { logoReadyTime = Date.now(); return; }
    const logoImg = pageLoadingOverlay.querySelector(".loading-logo");
    if (!logoImg) { logoReadyTime = Date.now(); return; }
    if (logoImg.complete && logoImg.naturalWidth > 0) { logoReadyTime = Date.now(); return; }
    logoImg.addEventListener("load", () => { logoReadyTime = Date.now(); });
    logoImg.addEventListener("error", () => { logoReadyTime = Date.now(); });
    setTimeout(() => { if (!logoReadyTime) logoReadyTime = Date.now(); }, 2000);
  })();

  function hidePageLoading() {
    const doHide = () => {
      const now = Date.now();
      const effectiveStart = logoReadyTime || now;
      const elapsed = now - effectiveStart;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
      setTimeout(() => {
        document.body.classList.remove("page-loading");
        document.body.classList.add("auth-ready");
        if (pageLoadingOverlay) pageLoadingOverlay.classList.add("hidden");
      }, remaining);
    };
    if (!logoReadyTime) {
      const check = setInterval(() => { if (logoReadyTime) { clearInterval(check); doHide(); } }, 50);
      setTimeout(() => { clearInterval(check); doHide(); }, 2500);
    } else {
      doHide();
    }
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

  // Manage Roles: prompt + POST to backend
  async function apiCreateRole(roleName) {
    const base = getApiBase();
    const name = String(roleName || "").trim();
    if (!name) throw new Error("Role name is empty");

    return await apiJson(`${base}/team/rols`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol_name: name }),
    });
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
    const ac = Number(u.avatar_color);
    const hue = Number.isFinite(ac) ? clamp(ac, 0, 360) : stableHueFromString(u.user_id || u.user_name);
    return `hsl(${hue} 70% 45%)`;
  }

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

  // 5) Store
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

  // 7) Filtering
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

  // 8) Render grid
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
        <div class="team-avatar" style="color:${bg}; border-color:${bg};" title="${safeName}">
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
  async function loadUsersFromApi({ keepQuery = true, isInitialLoad = false } = {}) {
    const currentQ = keepQuery ? (searchInput?.value || "") : "";
    try {
      const data = await fetchTeamUsers("");
      usersStore = Array.isArray(data) ? data.map(adaptUser) : [];
      if (keepQuery && searchInput) searchInput.value = currentQ;
      rerender();
      if (orgchartInitialized && window.TeamOrgChart) {
        window.TeamOrgChart.refresh(usersStore);
      }
      if (isInitialLoad) hidePageLoading();
    } catch (err) {
      console.error("[TEAM] loadUsersFromApi failed:", err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Failed to load team users.', { details: err.message });
      }
      if (isInitialLoad) hidePageLoading();
    }
  }

  // 10) Actions
  board.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const current = usersStore.find((x) => x.user_id === id);
      if (!current) {
        if (window.Toast) {
          Toast.warning('Not Found', 'User not found. Refresh and try again.');
        }
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
        if (window.Toast) {
          Toast.success('User Deleted', 'User deleted successfully!');
        }
        await loadUsersFromApi({ keepQuery: true });
      } catch (err) {
        console.error("[TEAM] delete failed:", err);
        if (window.Toast) {
          Toast.error('Delete Failed', 'Error deleting user.', { details: err.message });
        }
      }
    }
  });

  // 11) Search
  let searchT = null;
  function onSearchInput() {
    clearTimeout(searchT);
    searchT = setTimeout(() => rerender(), 80);
  }
  if (searchInput) searchInput.addEventListener("input", onSearchInput);

  // 12) Top buttons
  document.getElementById("btn-add-user")?.addEventListener("click", () => {
    window.TeamUserModal?.open({
      mode: "create",
      onSaved: async () => {
        await loadUsersFromApi({ keepQuery: true });
      },
    });
  });

  document.getElementById("btn-manage-roles")?.addEventListener("click", async () => {
    const roleName = prompt("Enter new role name:");
    if (!roleName) return;

    const name = roleName.trim();
    if (!name) return;

    try {
      await apiCreateRole(name);
      if (window.Toast) {
        Toast.success('Role Created', `Role "${name}" created! Reopen the user modal to see it in dropdowns.`);
      }
    } catch (err) {
      console.error("[TEAM] create role failed:", err);
      if (window.Toast) {
        Toast.error('Create Failed', 'Error creating role.', { details: err.message });
      }
    }
  });

  // Reflow on resize
  let resizeT = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => rerender(), 120);
  });

  // Listen for orgchart-triggered reloads (edit/delete from orgchart context menu)
  window.addEventListener("ngm-team-reload", () => {
    loadUsersFromApi({ keepQuery: true });
  });

  // Initial load
  loadUsersFromApi({ keepQuery: false, isInitialLoad: true });
});
