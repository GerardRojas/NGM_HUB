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
    // You can redirect or show a message; redirect keeps it consistent.
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
    { id: "u1", name: "Gerard Rojas", email: "gerard@ngm.com", role: "CEO", color: "#22c55e", status: "Active" },
    { id: "u2", name: "Project Coord", email: "pc@ngm.com", role: "Project Coordinator", color: "#60a5fa", status: "Active" },
    { id: "u3", name: "General Coord", email: "gc@ngm.com", role: "General Coordinator", color: "#f59e0b", status: "Active" },
    { id: "u4", name: "COO User", email: "coo@ngm.com", role: "COO", color: "#a78bfa", status: "Active" },
  ];

  const lanes = [
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

    lanes.forEach((lane) => {
      const users = mockUsers.filter((u) => u.role === lane.key);

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

      users.forEach((u) => {
        const card = document.createElement("div");
        card.className = "team-card";

        const safeName = escapeHtml(u.name);
        const safeEmail = escapeHtml(u.email);
        const safeRole = escapeHtml(u.role);
        const initials = escapeHtml(getInitial(u.name));
        const bg = u.color || "#a3a3a3";

        card.innerHTML = `
          <div class="team-avatar" style="background:${bg};" title="${safeName}">
            ${initials}
          </div>
          <div class="team-card-main">
            <div class="team-name-row">
              <p class="team-name" title="${safeName}">${safeName}</p>
            </div>
            <p class="team-meta" title="${safeEmail}">${safeEmail}</p>

            <div class="team-badges">
              <span class="team-badge">${safeRole}</span>
              <span class="team-badge">${escapeHtml(u.status || "—")}</span>
            </div>

            <div class="team-card-actions">
              <button class="team-action-btn" data-action="edit" data-id="${escapeHtml(u.id)}">Edit</button>
              <button class="team-action-btn" data-action="deactivate" data-id="${escapeHtml(u.id)}">Deactivate</button>
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
