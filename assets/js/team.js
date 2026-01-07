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

  // 2) Render (mock for now)
  const board = document.getElementById("team-board");
  const placeholder = document.getElementById("team-placeholder");
  if (!board) return;

  if (placeholder) placeholder.remove();

  const mockUsers = [
    {
      user_id: "3f3c9b70-1b1a-4b5b-9d8a-111111111111",
      user_name: "Gerard Rojas",
      user_role_id: "role-ceo-uuid",
      user_role_name: "CEO",
      user_seniority_id: "senior-uuid",
      user_seniority_name: "Senior",
      user_birthday: "1993-05-12",
      user_address: "San Diego, CA",
      user_photo: "", // url opcional
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

  // Lanes (sections)
  const TEAM_LANES = [
    { key: "CEO", title: "CEO" },
    { key: "COO", title: "COO" },
    { key: "General Coordinator", title: "General Coordinator" },
    { key: "Project Coordinator", title: "Project Coordinator" },
  ];

  function getInitial(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    return s[0].toUpperCase();
  }

  function render() {
    board.innerHTML = "";

    TEAM_LANES.forEach((lane) => {
      const users = mockUsers.filter((u) => u.user_role_name === lane.key);

      const col = document.createElement("div");
      col.className = "team-column";

      col.innerHTML = `
        <div class="team-column-header">
          <h3 class="team-column-title">${lane.title}</h3>
          <span class="team-column-count">${users.length}</span>
        </div>
        <div class="team-cards"></div>
      `;

      const cardsWrap = col.querySelector(".team-cards");

      // Ajusta # de columnas según cantidad de usuarios en este rol
      const count = users.length;

      // Regla que pediste: ~4 => 2 cols, ~6 => 3 cols
      let colsWanted = 1;
      if (count >= 6) colsWanted = 3;
      else if (count >= 4) colsWanted = 2;
      else if (count >= 2) colsWanted = 2;

      // Cap por espacio disponible (evita overflow feo en pantallas pequeñas)
      const cardW = 240;  // debe coincidir con --team-card-w
      const gap = 12;
      const available = col.clientWidth - 24; // padding aproximado del contenedor
      const maxCols = Math.max(1, Math.floor((available + gap) / (cardW + gap)));

      const cols = Math.min(colsWanted, maxCols);
      cardsWrap.style.setProperty("--team-cols", String(cols));


      users.forEach((u) => {
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
              <button class="team-action-btn" data-action="edit" data-id="${escapeHtml(u.user_id)}">Edit</button>
              <button class="team-action-btn" data-action="delete" data-id="${escapeHtml(u.user_id)}">Delete</button>
            </div>
          </div>
        `;

        cardsWrap.appendChild(card);
      });

      board.appendChild(col);
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // simple action handler (placeholder)
  board.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    console.log("[TEAM] action:", action, "id:", id);

    alert(`Action: ${action} · ${id} (mock)`);
  });

  render();

  // Refresh button (mock)
  document.getElementById("btn-refresh-team")?.addEventListener("click", () => {
    render();
  });

  document.getElementById("btn-add-user")?.addEventListener("click", () => {
    alert("Add User (mock) — next step: open modal + POST to API");
  });
});
