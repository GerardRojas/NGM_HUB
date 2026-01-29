// assets/js/dashboard.js

// Usa API_BASE de config.js (ya definido globalmente)
const DASHBOARD_API = window.API_BASE || window.NGM_CONFIG?.API_BASE || "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  // 1) Leer usuario desde localStorage
  const rawUser = localStorage.getItem("ngmUser");

  if (!rawUser) {
    // Si no hay sesión, mandamos a login
    window.location.href = "login.html";
    return;
  }

  let user;
  try {
    user = JSON.parse(rawUser);
  } catch (err) {
    console.error("Invalid ngmUser in localStorage:", err);
    localStorage.removeItem("ngmUser");
    window.location.href = "login.html";
    return;
  }

  // Load mentions for the user
  loadMentions(user);

  // Load My Work tasks (pending authorizations, etc.)
  loadMyWorkTasks(user);

  // 2) Rellenar pill de usuario
  const userPill = document.getElementById("user-pill");
  if (userPill) {
    const roleText = user.role || "No role";
    const seniority = user.seniority || "";
    const seniorityText = seniority ? ` · ${seniority}` : "";
    userPill.textContent = `${user.username || "User"} · ${roleText}${seniorityText}`;
  }

  // 3) Filtrar módulos por rol y marcar coming soon
  const userRole = String(user.role || user.role_id || "").trim();

  document.querySelectorAll(".module-card").forEach((card) => {
    const rolesAttr = card.getAttribute("data-roles") || "";
    const allowedRoles = rolesAttr
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    const status = card.getAttribute("data-status") || "active";

    // Si hay lista de roles y el rol del usuario no está, ocultamos
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      card.style.display = "none";
      return;
    }

    // Módulo coming soon -> gris + alerta al click
    if (status === "coming-soon") {
      card.classList.add("module-coming-soon");
      card.addEventListener("click", (event) => {
        event.preventDefault();
        if (window.Toast) {
          Toast.info('Coming Soon', 'This module is coming soon.');
        }
      });
    }
  });

  // 4) (Opcional) Logout rápido si luego quieres un botón
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("ngmUser");
      window.location.href = "login.html";
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// MENTIONS SECTION
// ─────────────────────────────────────────────────────────────────────────

async function loadMentions(user) {
  const loadingEl = document.getElementById("mentions-loading");
  const emptyEl = document.getElementById("mentions-empty");
  const listEl = document.getElementById("mentions-list");

  if (!loadingEl || !emptyEl || !listEl) return;

  try {
    const token = localStorage.getItem("ngmToken");
    const response = await fetch(`${DASHBOARD_API}/messages/mentions`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const mentions = data.mentions || [];

    // Hide loading
    loadingEl.style.display = "none";

    if (mentions.length === 0) {
      // Show empty state
      emptyEl.style.display = "flex";
      listEl.style.display = "none";
    } else {
      // Render mentions
      emptyEl.style.display = "none";
      listEl.style.display = "block";
      renderMentions(mentions, user);
    }
  } catch (err) {
    console.error("[Dashboard] Failed to load mentions:", err);
    // Show empty state on error
    loadingEl.style.display = "none";
    emptyEl.style.display = "flex";
    listEl.style.display = "none";
  }
}

function renderMentions(mentions, currentUser) {
  const listEl = document.getElementById("mentions-list");
  if (!listEl) return;

  const html = mentions.slice(0, 5).map((mention) => {
    const avatarColor = mention.sender_avatar_color
      ? `hsl(${mention.sender_avatar_color}, 70%, 45%)`
      : getDefaultAvatarColor(mention.sender_name);
    const initials = getInitials(mention.sender_name);
    const timeAgo = formatTimeAgo(mention.created_at);
    const highlightedContent = highlightMention(mention.content, currentUser.username);

    // Avatar HTML
    let avatarHtml;
    if (mention.sender_photo) {
      avatarHtml = `<div class="mention-avatar mention-avatar--img" style="background-image: url('${escapeHtml(mention.sender_photo)}')"></div>`;
    } else {
      avatarHtml = `<div class="mention-avatar" style="background: ${avatarColor}">${initials}</div>`;
    }

    return `
      <div class="mention-item" data-channel-id="${mention.channel_id}" data-message-id="${mention.message_id}">
        ${avatarHtml}
        <div class="mention-content">
          <div class="mention-header">
            <span class="mention-author">${escapeHtml(mention.sender_name)}</span>
            <span class="mention-channel">${escapeHtml(mention.channel_name || "")}</span>
            <span class="mention-time">${timeAgo}</span>
          </div>
          <div class="mention-text">${highlightedContent}</div>
        </div>
      </div>
    `;
  }).join("");

  listEl.innerHTML = html;

  // Add click handlers to navigate to message
  listEl.querySelectorAll(".mention-item").forEach((item) => {
    item.addEventListener("click", () => {
      const channelId = item.dataset.channelId;
      const messageId = item.dataset.messageId;
      // Navigate to messages page with context
      window.location.href = `messages.html?channel=${channelId}&message=${messageId}`;
    });
  });
}

function highlightMention(content, username) {
  if (!content || !username) return escapeHtml(content || "");

  // Escape HTML first
  let safe = escapeHtml(content);

  // Then highlight mentions
  const mentionPattern = new RegExp(`(@${escapeRegex(username)})`, "gi");
  return safe.replace(mentionPattern, '<span class="mention-highlight">$1</span>');
}

function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getDefaultAvatarColor(name) {
  if (!name) return "hsl(200, 60%, 50%)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 50%)`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─────────────────────────────────────────────────────────────────────────
// MY WORK SECTION - Pending Tasks
// ─────────────────────────────────────────────────────────────────────────

async function loadMyWorkTasks(user) {
  const loadingEl = document.getElementById("my-work-loading");
  const emptyEl = document.getElementById("my-work-empty");
  const listEl = document.getElementById("my-work-list");

  if (!loadingEl || !emptyEl || !listEl) return;

  const tasks = [];

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Load pending expense authorizations
    const authResponse = await fetch(
      `${DASHBOARD_API}/expenses/pending-authorization/summary?user_id=${user.user_id}`,
      { credentials: "include", headers }
    );

    if (authResponse.ok) {
      const authData = await authResponse.json();

      if (authData.can_authorize && authData.total_count > 0) {
        tasks.push({
          type: "expense_authorization",
          title: `${authData.total_count} expense${authData.total_count > 1 ? 's' : ''} pending authorization`,
          subtitle: `$${formatCurrency(authData.total_amount)} total`,
          module: "Expenses Engine",
          icon: "!",
          iconClass: "task-icon-pending",
          link: "expenses.html?filter=pending_auth",
          actionText: "Review"
        });
      }
    }

    // Future: Add more task sources here
    // - Pending receipts
    // - Pipeline tasks
    // - Pending approvals
    // - etc.

  } catch (err) {
    console.error("[Dashboard] Failed to load My Work tasks:", err);
  }

  // Hide loading
  loadingEl.style.display = "none";

  if (tasks.length === 0) {
    // Show empty state
    emptyEl.style.display = "flex";
    listEl.style.display = "none";
  } else {
    // Render tasks
    emptyEl.style.display = "none";
    listEl.style.display = "block";
    renderMyWorkTasks(tasks);
  }
}

function renderMyWorkTasks(tasks) {
  const listEl = document.getElementById("my-work-list");
  if (!listEl) return;

  const html = tasks.map((task) => {
    return `
      <div class="my-work-task" data-type="${task.type}">
        <div class="my-work-task-icon">
          <span class="task-icon-badge ${task.iconClass}">${task.icon}</span>
        </div>
        <div class="my-work-task-content">
          <div class="my-work-task-title">${escapeHtml(task.title)}</div>
          <div class="my-work-task-meta">
            <span class="task-meta-module">${escapeHtml(task.module)}</span>
            ${task.subtitle ? `<span class="task-meta-separator">·</span><span class="task-meta-amount">${escapeHtml(task.subtitle)}</span>` : ''}
          </div>
        </div>
        <div class="my-work-task-action">
          <a href="${task.link}" class="task-action-btn">${task.actionText}</a>
        </div>
      </div>
    `;
  }).join("");

  listEl.innerHTML = html;
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
