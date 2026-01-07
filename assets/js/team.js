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
  const allowedRoles = new Set([
    "COO",
    "CEO",
    "General Coordinator",
    "Project Coordinator",
  ]);

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

  // 3) Mock users (replace later with API)
  let usersStore = [
    {
      user_id: "3f3c9b70-1b1a-4b5b-9d8a-111111111111",
      user_name: "Gerard Rojas",
      user_role_id: "role-ceo-uuid",
      user_role_name: "CEO",
      user_seniority_id: "senior-uuid",
      user_seniority_name: "Senior",
      user_birthday: "1993-05-12",
      user_address: "San Diego, CA",
      user_photo: "",
      user_status_id: "status-active-uuid",
      user_status_name: "Active",
      color: "#22c55e",
    },
    {
      user_id: "3f3c9b70-1b1a-4b5b-9d8a-111111111112",
      user_name: "Gerard Rojas 2",
      user_role_id: "role-ceo-uuid",
      user_role_name: "CEO",
      user_seniority_id: "senior-uuid",
      user_seniority_name: "Senior",
      user_birthday: "1993-05-12",
      user_address: "San Diego, CA",
      user_photo: "",
      user_status_id: "status-active-uuid",
      user_status_name: "Active",
      color: "#22c55e",
    },
    {
      user_id: "8c4b2f10-2a3b-4c5d-8e9f-222222222222",
      user_name: "Project Coordinator",
      user_role_id: "role-pc-uuid",
      user_role_name: "Project Coordinator",
      user_seniority_id: "mid-uuid",
      user_seniority_name: "Mid",
      user_birthday: "1998-02-01",
      user_address: "Mazatlán, MX",
      user_photo: "",
      user_status_id: "status-active-uuid",
      user_status_name: "Active",
      color: "#60a5fa",
    },
    {
      user_id: "b6c7d8e9-1111-2222-3333-444444444444",
      user_name: "General Coordinator",
      user_role_id: "role-gc-uuid",
      user_role_name: "General Coordinator",
      user_seniority_id: "senior-uuid",
      user_seniority_name: "Senior",
      user_birthday: "1996-10-21",
      user_address: "Austin, TX",
      user_photo: "",
      user_status_id: "status-active-uuid",
      user_status_name: "Active",
      color: "#f59e0b",
    },
    {
      user_id: "c1c2c3c4-aaaa-bbbb-cccc-555555555555",
      user_name: "COO User",
      user_role_id: "role-coo-uuid",
      user_role_name: "COO",
      user_seniority_id: "exec-uuid",
      user_seniority_name: "Executive",
      user_birthday: "1991-07-07",
      user_address: "Los Angeles, CA",
      user_photo: "",
      user_status_id: "status-active-uuid",
      user_status_name: "Active",
      color: "#a78bfa",
    },
  ];

  // 4) Helpers
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

  function computeColsWanted(n) {
    // rule of thumb: 4 => 2 cols, 6 => 3 cols (and scale a bit)
    if (n >= 9) return 4;
    if (n >= 6) return 3;
    if (n >= 4) return 2;
    if (n >= 2) return 2;
    return 1;
  }

  function computeMaxCols(availablePx, cardW, gap) {
    return Math.max(1, Math.floor((availablePx + gap) / (cardW + gap)));
  }

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

  // 5) Render grid (no lanes)
  function render(list) {
    board.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "team-cards";

    const n = list.length;
    const colsWanted = computeColsWanted(n);

    // Cap columns by available width so it stays clean on smaller screens
    const cardW = 260;
    const gap = 12;
    const available = Math.max(320, board.clientWidth - 24);
    const maxCols = computeMaxCols(available, cardW, gap);
    const cols = Math.min(colsWanted, maxCols);

    wrap.style.gridTemplateColumns = `repeat(${cols}, minmax(${cardW}px, 1fr))`;

    list.forEach((u) => {
      // STACK (adds the “back card” depth effect)
      const stack = document.createElement("div");
      stack.className = "team-card-stack";

      const back = document.createElement("div");
      back.className = "team-card-back";

      const card = document.createElement("div");
      card.className = "team-card";

      const safeName = escapeHtml(u.user_name);
      const safeRole = escapeHtml(u.user_role_name);
      const safeStatus = escapeHtml(u.user_status_name || "—");
      const safeSeniority = escapeHtml(u.user_seniority_name || "—");
      const safeBday = escapeHtml(u.user_birthday || "—");
      const safeAddr = escapeHtml(u.user_address || "—");
      const initials = escapeHtml(getInitial(u.user_name));
      const bg = u.color || "#a3a3a3";

      const avatarHtml = u.user_photo
        ? `<img src="${escapeHtml(u.user_photo)}" alt="${safeName}" />`
        : `${initials}`;

      card.innerHTML = `
        <div class="team-avatar" style="background:${bg};" title="${safeName}">
          ${avatarHtml}
        </div>

        <div class="team-card-main">
          <div class="team-name-row">
            <p class="team-name" title="${safeName}">${safeName}</p>
          </div>

          <div class="team-badges">
            <span class="team-badge">${safeRole}</span>
            <span class="team-badge">${safeSeniority}</span>
            <span class="team-badge">${safeStatus}</span>
          </div>

          <p class="team-meta" title="Birthday">${safeBday}</p>
          <p class="team-meta" title="${safeAddr}">${safeAddr}</p>

          <div class="team-card-actions">
            <button class="team-action-btn" data-action="edit" data-id="${escapeHtml(
              u.user_id
            )}">Edit</button>
            <button class="team-action-btn" data-action="delete" data-id="${escapeHtml(
              u.user_id
            )}">Delete</button>
          </div>
        </div>
      `;

      stack.appendChild(back);
      stack.appendChild(card);
      wrap.appendChild(stack);
    });

    board.appendChild(wrap);
  }

  // 6) Actions (mock)
  board.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      console.log("[TEAM] edit:", id);
      alert(`Edit user: ${id} (mock)`);
      return;
    }

    if (action === "delete") {
      const ok = confirm("Delete this user? (mock)");
      if (!ok) return;

      usersStore = usersStore.filter((u) => u.user_id !== id);
      const list = filterUsers(searchInput?.value || "");
      render(list);
      return;
    }
  });

  // 7) Search
  let searchT = null;
  function onSearchInput() {
    clearTimeout(searchT);
    searchT = setTimeout(() => {
      const list = filterUsers(searchInput?.value || "");
      render(list);
    }, 80);
  }

  if (searchInput) {
    searchInput.addEventListener("input", onSearchInput);
  }

  // 8) Top buttons
  document.getElementById("btn-refresh-team")?.addEventListener("click", () => {
    const list = filterUsers(searchInput?.value || "");
    render(list);
  });

  document.getElementById("btn-add-user")?.addEventListener("click", () => {
    alert("Add User (mock) — next step: open modal + POST to API");
  });

  // Initial render
  render(usersStore);
});
