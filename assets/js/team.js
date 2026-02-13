// assets/js/team.js
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Auth gate - basic check
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

  // Update topbar user pill (best-effort)
  const userPill = document.getElementById("user-pill");
  if (userPill) {
    const name = user.name || user.username || user.email || "User";
    userPill.textContent = `${name} · ${role || "—"}`;
  }

  // 2) Permission gate - use DB-based permissions
  async function checkModulePermission() {
    // Wait for PermissionsManager to be available and loaded
    const maxWait = 5000;
    const start = Date.now();

    while (!window.PermissionsManager || !window.PermissionsManager.permissions) {
      if (Date.now() - start > maxWait) {
        console.warn("[TEAM] Timeout waiting for PermissionsManager");
        return false;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return window.PermissionsManager.canView("team");
  }

  const hasAccess = await checkModulePermission();
  if (!hasAccess) {
    console.log("[TEAM] Access denied - no permission for team module");
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
  const externalSection = document.getElementById("external-section");
  const externalBoard = document.getElementById("external-board");
  const searchInput = document.getElementById("team-search-input");
  // View toggle: cards vs orgchart
  let currentView = "cards";
  const btnViewCards = document.getElementById("btn-view-cards");
  const btnViewOrgchart = document.getElementById("btn-view-orgchart");
  let orgchartInitialized = false;

  async function setView(view) {
    currentView = view;
    if (btnViewCards) btnViewCards.classList.toggle("active", view === "cards");
    if (btnViewOrgchart) btnViewOrgchart.classList.toggle("active", view === "orgchart");

    // Show external section in cards view, hide in orgchart
    if (externalSection) {
      externalSection.style.display = (view === "cards") ? "" : "none";
    }

    if (view === "orgchart") {
      const internalUsers = usersStore.filter(u => !u.is_external);
      if (window.TeamOrgChart) {
        if (!orgchartInitialized) {
          await window.TeamOrgChart.init(internalUsers);
          orgchartInitialized = true;
        } else {
          window.TeamOrgChart.refresh(internalUsers);
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

  // 3) API helpers
  function getApiBase() {
    const base = window.API_BASE || window.apiBase || "";
    return String(base || "").replace(/\/+$/, "");
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('ngmToken');
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  async function apiJson(url, options = {}) {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    const res = await fetch(url, { ...options, headers });
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
    const departmentName = u?.department?.name || "-";

    return {
      ...u,
      is_external: !!u.is_external,
      user_role_name: roleName,
      user_seniority_name: seniorityName,
      user_status_name: statusName,
      user_department_name: departmentName,
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

  function getBoardWidth(targetBoard) {
    const b = targetBoard || board;
    return (
      b.clientWidth ||
      b.parentElement?.clientWidth ||
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
        u.user_department_name,
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

  // -- AI Agents (injected into usersStore alongside real users)
  const AI_AGENT_IDS = new Set([
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
  ]);

  const AI_AGENTS = [
    {
      user_id: "00000000-0000-0000-0000-000000000001",
      user_name: "Arturito",
      avatar_color: 145,
      _isAgent: true,
      role: { name: "AI Assistant" },
      seniority: { name: "-" },
      status: { name: "Active" },
    },
    {
      user_id: "00000000-0000-0000-0000-000000000002",
      user_name: "Daneel",
      avatar_color: 210,
      _isAgent: true,
      role: { name: "Budget Monitor" },
      seniority: { name: "-" },
      status: { name: "Active" },
    },
    {
      user_id: "00000000-0000-0000-0000-000000000003",
      user_name: "Andrew",
      avatar_color: 35,
      _isAgent: true,
      role: { name: "Receipt Agent" },
      seniority: { name: "-" },
      status: { name: "Active" },
    },
  ];

  function mergeAgents(apiUsers) {
    // Filter out agent IDs from API results (in case bot user leaks from DB)
    const filtered = apiUsers.filter(u => !AI_AGENT_IDS.has(u.user_id));
    // Append agents at the end
    return [...filtered, ...AI_AGENTS.map(adaptUser)];
  }

  // 8) Render grid
  function render(list, targetBoard) {
    const target = targetBoard || board;
    target.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "team-cards";

    const n = list.length;
    const colsWanted = computeColsWanted(n);

    const cardW = 280;
    const gap = 24;

    const available = Math.max(320, getBoardWidth(target) - 24);
    const maxCols = computeMaxCols(available, cardW, gap);
    const cols = Math.min(colsWanted, maxCols);

    wrap.style.gridTemplateColumns = `repeat(${cols}, ${cardW}px)`;
    wrap.style.gap = `${gap}px`;
    wrap.style.justifyContent = "start";

    list.forEach((u) => {
      const isAgent = !!u._isAgent;

      const stack = document.createElement("div");
      stack.className = "team-card-stack";

      const back = document.createElement("div");
      back.className = "team-card-back";

      const card = document.createElement("div");
      card.className = "team-card";

      const safeName = escapeHtml(u.user_name);

      const deptVal = u.user_department_name || u.department?.name || "---";
      const roleVal = u.user_role_name || u.role?.name || "---";
      const seniorityVal = u.user_seniority_name || u.seniority?.name || "---";
      const statusVal = u.user_status_name || u.status?.name || "---";

      const phoneVal = u.user_phone_number || "---";
      const bdayVal = u.user_birthday || "---";
      const addrVal = u.user_address || "---";

      const safeDept = escapeHtml(deptVal);
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

      const isExternal = !!u.is_external;

      // AI badge for agents, EXT badge for external, status pill for internal
      const badgeHtml = isAgent
        ? `<span class="team-agent-badge">AI</span>`
        : isExternal
        ? `<span class="team-external-badge">EXT</span>`
        : `<span class="team-status-pill ${statusClass}" title="Status">${safeStatus}</span>`;

      // Agents don't get edit/delete buttons
      const actionsHtml = isAgent ? "" : `
          <div class="team-card-actions">
            <button class="team-action-btn" data-action="edit" data-id="${escapeHtml(u.user_id)}">Edit</button>
            <button class="team-action-btn" data-action="delete" data-id="${escapeHtml(u.user_id)}">Delete</button>
          </div>`;

      card.innerHTML = `
        <div class="team-avatar" style="color:${bg}; border-color:${bg};" title="${safeName}">
          ${avatarHtml}
        </div>

        <div class="team-card-main">
          <div class="team-head">
            <p class="team-name" title="${safeName}">${safeName}</p>
            ${badgeHtml}
          </div>

          <div class="team-fields">
            <div class="team-field">
              <span class="team-field-label">Department</span>
              <span class="team-field-value">${safeDept}</span>
            </div>

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
          ${actionsHtml}
        </div>
      `;

      stack.appendChild(back);
      stack.appendChild(card);
      wrap.appendChild(stack);
    });

    target.appendChild(wrap);
  }

  function rerender() {
    const allFiltered = filterUsers(searchInput?.value || "");

    const internal = allFiltered.filter(u => !u.is_external);
    const external = allFiltered.filter(u => u.is_external);

    render(internal, board);

    if (externalBoard) {
      render(external, externalBoard);
    }

    // Show external section in cards view, hide in orgchart
    if (externalSection) {
      externalSection.style.display = (currentView === "cards") ? "" : "none";
    }
  }

  // 9) Load from API
  async function loadUsersFromApi({ keepQuery = true, isInitialLoad = false } = {}) {
    const currentQ = keepQuery ? (searchInput?.value || "") : "";
    try {
      const data = await fetchTeamUsers("");
      const apiUsers = Array.isArray(data) ? data.map(adaptUser) : [];
      usersStore = mergeAgents(apiUsers);
      if (keepQuery && searchInput) searchInput.value = currentQ;
      rerender();
      if (orgchartInitialized && window.TeamOrgChart) {
        window.TeamOrgChart.refresh(usersStore.filter(u => !u.is_external));
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

  // 10) Actions (shared handler for both internal and external boards)
  async function handleCardAction(e) {
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
  }

  board.addEventListener("click", handleCardAction);
  if (externalBoard) externalBoard.addEventListener("click", handleCardAction);

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

  document.getElementById("btn-add-external-user")?.addEventListener("click", () => {
    window.TeamUserModal?.open({
      mode: "create",
      user: { is_external: true },
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
