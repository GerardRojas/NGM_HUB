// assets/js/dashboard.js

// Usa API_BASE de config.js (ya definido globalmente)
const DASHBOARD_API = window.API_BASE || window.NGM_CONFIG?.API_BASE || "http://localhost:3000";

// Store current user for reference
let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
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

  currentUser = user;

  // Init UI components
  initMentionsDrawer();
  initCommandPalette();

  // Wait for sidebar to finish rendering (it loads permissions async)
  function waitForSidebar() {
    if (window._sidebarReady) return Promise.resolve();
    return new Promise(resolve => {
      window.addEventListener('sidebar-ready', resolve, { once: true });
      // Fallback: don't block forever if sidebar fails
      setTimeout(resolve, 3000);
    });
  }

  // Load data + sidebar in parallel, hide overlay only when ALL are ready
  try {
    await Promise.all([
      loadMentions(user),
      loadMyWorkTasks(user),
      loadPendingReviews(user),
      waitForSidebar()
    ]);
  } catch (err) {
    console.error("[Dashboard] Error loading data:", err);
  }

  // Hide loading overlay after data AND sidebar are ready
  hidePageLoading();

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
// MENTIONS DRAWER
// ─────────────────────────────────────────────────────────────────────────

function initMentionsDrawer() {
  const drawer = document.getElementById('mentionsDrawer');
  const tab = document.getElementById('mentionsDrawerTab');
  const closeBtn = document.getElementById('mentionsDrawerClose');
  const overlay = document.getElementById('mentionsDrawerOverlay');
  if (!drawer) return;

  function openDrawer() {
    drawer.classList.add('is-open');
    if (overlay) overlay.classList.add('is-visible');
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-visible');
  }

  if (tab) tab.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay) overlay.addEventListener('click', closeDrawer);

  // Mobile topbar mentions button
  const mobileBtn = document.getElementById('btnMobileMentions');
  if (mobileBtn) mobileBtn.addEventListener('click', openDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

  window.MentionsDrawer = { open: openDrawer, close: closeDrawer };
}

// ─────────────────────────────────────────────────────────────────────────
// MENTIONS DATA
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

    // Update notification badges
    moduleBadgeCounts.messages = mentions.length;
    updateModuleBadges();

    // Update mentions drawer tab count + mobile button badge
    const tabCountEl = document.getElementById('mentionsTabCount');
    const mobileCountEl = document.getElementById('mobileMentionsCount');
    if (tabCountEl) {
      if (mentions.length > 0) {
        tabCountEl.textContent = mentions.length;
        tabCountEl.style.display = 'flex';
      } else {
        tabCountEl.style.display = 'none';
      }
    }
    if (mobileCountEl) {
      if (mentions.length > 0) {
        mobileCountEl.textContent = mentions.length;
        mobileCountEl.style.display = 'flex';
      } else {
        mobileCountEl.style.display = 'none';
      }
    }

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

    // Load Pipeline tasks assigned to user
    const pipelineResponse = await fetch(
      `${DASHBOARD_API}/pipeline/tasks/my-tasks/${user.user_id}`,
      { credentials: "include", headers }
    );

    if (pipelineResponse.ok) {
      const pipelineData = await pipelineResponse.json();
      const pipelineTasks = pipelineData.tasks || [];

      pipelineTasks.forEach((task) => {
        const statusLower = (task.status_name || "").toLowerCase();
        const isWorking = statusLower === "working on it";
        const isNotStarted = statusLower === "not started";
        const userRole = task.role || "owner"; // owner, collaborator, or manager

        // Determine icon based on priority or status
        let icon = "T";
        let iconClass = "task-icon-pipeline";

        if (task.priority_name) {
          const priorityLower = task.priority_name.toLowerCase();
          if (priorityLower === "high" || priorityLower === "urgent") {
            icon = "!";
            iconClass = "task-icon-urgent";
          } else if (priorityLower === "medium") {
            iconClass = "task-icon-pending";
          }
        }

        if (isWorking) {
          iconClass = "task-icon-working";
        }

        // Only owners can start tasks, collaborators/managers view them
        const canStart = isNotStarted && userRole === "owner";

        tasks.push({
          type: "pipeline_task",
          taskId: task.task_id,
          title: task.task_description || "Untitled task",
          subtitle: task.project_name || null,
          module: "Pipeline Manager",
          icon: icon,
          iconClass: iconClass,
          link: `pipeline.html?task=${task.task_id}`,
          actionText: isWorking ? "Working" : (canStart ? "Start" : "View"),
          isStartable: canStart,
          isWorking: isWorking && userRole === "owner", // Only owner sees working controls
          timeStart: task.time_start,
          statusName: task.status_name,
          userRole: userRole, // owner, collaborator, or manager
          dueDate: task.due_date || task.deadline || null,
          priorityName: task.priority_name || null,
        });
      });
    }

  } catch (err) {
    console.error("[Dashboard] Failed to load My Work tasks:", err);
  }

  // Update module notification badges
  moduleBadgeCounts.pipeline = tasks.filter(t => t.type === 'pipeline_task').length;
  moduleBadgeCounts.expenses = tasks.filter(t => t.type === 'expense_authorization').length;
  updateModuleBadges();

  // Populate search data for command palette
  myWorkSearchData = tasks.map(t => ({
    title: t.title,
    subtitle: t.subtitle || t.module,
    link: t.link,
    type: 'task'
  }));

  // Sort: working first, then by priority (high > medium > low), then by due date
  const priorityWeight = { urgent: 0, high: 1, critical: 1, medium: 2, low: 3 };
  tasks.sort((a, b) => {
    if (a.isWorking && !b.isWorking) return -1;
    if (!a.isWorking && b.isWorking) return 1;
    const pa = priorityWeight[(a.priorityName || "").toLowerCase()] ?? 99;
    const pb = priorityWeight[(b.priorityName || "").toLowerCase()] ?? 99;
    if (pa !== pb) return pa - pb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });

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

function renderSingleTask(task) {
  // Determine action button based on task type
  let actionHtml;

  if (task.type === "pipeline_task") {
    if (task.isStartable) {
      actionHtml = `
        <button type="button" class="task-action-btn task-start-btn" data-task-id="${task.taskId}">
          <span class="task-btn-icon">&#9654;</span> Start
        </button>
      `;
    } else if (task.isWorking) {
      const elapsedTime = task.timeStart ? formatElapsedTime(task.timeStart) : "";
      actionHtml = `
        <div class="task-working-actions">
          <span class="task-working-timer" data-time-start="${task.timeStart || ''}">
            <span class="task-working-dot"></span>
            ${elapsedTime ? `<span class="task-elapsed-time">${elapsedTime}</span>` : '<span class="task-elapsed-time">0m</span>'}
          </span>
          <button type="button" class="task-action-btn task-review-btn" data-task-id="${task.taskId}" data-task-title="${escapeHtml(task.title)}">
            Send to Review
          </button>
        </div>
      `;
    } else {
      actionHtml = `<a href="${task.link}" class="task-action-btn task-view-btn">${task.actionText}</a>`;
    }
  } else {
    actionHtml = `<a href="${task.link}" class="task-action-btn">${task.actionText}</a>`;
  }

  // Status badge
  let statusBadge = "";
  if (task.type === "pipeline_task" && task.statusName) {
    const sLower = task.statusName.toLowerCase();
    let statusMod = "";
    if (sLower === "not started") statusMod = " task-status-badge--not-started";
    else if (sLower === "working on it") statusMod = " task-status-badge--working";
    else if (sLower.includes("review")) statusMod = " task-status-badge--review";
    else if (sLower === "stuck") statusMod = " task-status-badge--stuck";
    statusBadge = `<span class="task-status-badge${statusMod}">${escapeHtml(task.statusName)}</span>`;
  }

  // Role badge
  let roleBadge = "";
  if (task.type === "pipeline_task" && task.userRole && task.userRole !== "owner") {
    const roleLabel = task.userRole === "collaborator" ? "Collaborator" : "Manager";
    roleBadge = `<span class="task-role-badge task-role-${task.userRole}">${roleLabel}</span>`;
  }

  // Priority pill
  let priorityPill = "";
  if (task.type === "pipeline_task" && task.priorityName) {
    const pLower = task.priorityName.toLowerCase();
    let prioClass = "task-priority-default";
    if (pLower === "high" || pLower === "urgent" || pLower === "critical") {
      prioClass = "task-priority-high";
    } else if (pLower === "medium") {
      prioClass = "task-priority-medium";
    } else if (pLower === "low") {
      prioClass = "task-priority-low";
    }
    priorityPill = `<span class="task-priority-pill ${prioClass}">${escapeHtml(task.priorityName)}</span>`;
  }

  // Due date
  let dueDateHtml = "";
  if (task.type === "pipeline_task" && task.dueDate) {
    const dueDate = new Date(task.dueDate + "T00:00:00");
    const now = new Date();
    const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isOverdue = dueDateOnly < todayOnly;
    const isToday = dueDateOnly.getTime() === todayOnly.getTime();
    const dateLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    let dueCssClass = "task-due-date";
    if (isOverdue) dueCssClass += " task-due-overdue";
    else if (isToday) dueCssClass += " task-due-today";
    const prefix = isOverdue ? "Overdue: " : (isToday ? "Today: " : "Due: ");
    dueDateHtml = `<span class="${dueCssClass}">${prefix}${dateLabel}</span>`;
  }

  const statusSlug = (task.statusName || '').toLowerCase().replace(/\s+/g, '-');
  const prioritySlug = (task.priorityName || '').toLowerCase();

  return `
    <div class="my-work-task" data-type="${task.type}" data-task-id="${task.taskId || ''}" data-role="${task.userRole || 'owner'}" data-status="${statusSlug}" data-priority="${prioritySlug}">
      <div class="my-work-task-icon">
        <span class="task-icon-badge ${task.iconClass}">${task.icon}</span>
      </div>
      <div class="my-work-task-content">
        <div class="my-work-task-title">${escapeHtml(task.title)} ${statusBadge} ${roleBadge}</div>
        <div class="my-work-task-meta">
          <span class="task-meta-module">${escapeHtml(task.module)}</span>
          ${task.subtitle ? `<span class="task-meta-separator">&middot;</span><span class="task-meta-project">${escapeHtml(task.subtitle)}</span>` : ''}
          ${priorityPill ? `<span class="task-meta-separator">&middot;</span>${priorityPill}` : ''}
          ${dueDateHtml ? `<span class="task-meta-separator">&middot;</span>${dueDateHtml}` : ''}
        </div>
      </div>
      <div class="my-work-task-action">
        ${actionHtml}
      </div>
    </div>
  `;
}

function renderMyWorkTasks(tasks) {
  const listEl = document.getElementById("my-work-list");
  if (!listEl) return;

  // Group tasks by status category
  const groups = [
    { key: 'working', label: 'Working', tasks: [] },
    { key: 'action', label: 'Action Required', tasks: [] },
    { key: 'other', label: 'Other', tasks: [] }
  ];

  tasks.forEach(task => {
    if (task.isWorking) {
      groups[0].tasks.push(task);
    } else if (task.type === 'expense_authorization' || task.isStartable ||
               (task.statusName || '').toLowerCase() === 'not started') {
      groups[1].tasks.push(task);
    } else {
      groups[2].tasks.push(task);
    }
  });

  let html = '';
  const activeGroups = groups.filter(g => g.tasks.length > 0);

  activeGroups.forEach(group => {
    if (activeGroups.length > 1) {
      html += `<div class="my-work-group-header">${group.label} (${group.tasks.length})</div>`;
    }
    group.tasks.forEach(task => {
      html += renderSingleTask(task);
    });
  });

  listEl.innerHTML = html;

  // Attach click handlers for Start buttons
  listEl.querySelectorAll(".task-start-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      if (taskId) {
        handleStartTask(taskId, btn);
      }
    });
  });

  // Attach click handlers for Send to Review buttons
  listEl.querySelectorAll(".task-review-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const taskTitle = btn.dataset.taskTitle;
      if (taskId) {
        showReviewModal(taskId, taskTitle, btn);
      }
    });
  });

  // Start elapsed time updater for working tasks
  startElapsedTimeUpdater();
}

// ─────────────────────────────────────────────────────────────────────────
// START TASK FUNCTIONALITY
// ─────────────────────────────────────────────────────────────────────────

async function handleStartTask(taskId, buttonEl) {
  console.log("[Dashboard] Starting task:", taskId);

  // Disable button and show loading state
  buttonEl.disabled = true;
  buttonEl.innerHTML = '<span class="task-btn-icon">⏳</span> Starting...';

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(`${DASHBOARD_API}/pipeline/tasks/${taskId}/start`, {
      method: "POST",
      credentials: "include",
      headers
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("[Dashboard] Task started:", result);

    // Show success toast
    if (window.Toast) {
      Toast.success("Task Started", "Timer is now running. Good luck!");
    }

    // Reload tasks to reflect the change
    if (currentUser) {
      loadMyWorkTasks(currentUser);
    }

  } catch (err) {
    console.error("[Dashboard] Failed to start task:", err);

    // Re-enable button
    buttonEl.disabled = false;
    buttonEl.innerHTML = '<span class="task-btn-icon">▶</span> Start';

    if (window.Toast) {
      Toast.error("Start Failed", err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SEND TO REVIEW FUNCTIONALITY
// ─────────────────────────────────────────────────────────────────────────

function showReviewModal(taskId, taskTitle, buttonEl) {
  // Remove any existing modal
  const existingModal = document.getElementById("reviewModal");
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal HTML
  const modalHtml = `
    <div id="reviewModal" class="dashboard-modal-backdrop">
      <div class="dashboard-modal">
        <div class="dashboard-modal-header">
          <h3 class="dashboard-modal-title">Send to Review</h3>
          <button type="button" class="dashboard-modal-close" id="closeReviewModal">&times;</button>
        </div>
        <div class="dashboard-modal-body">
          <p class="review-task-name">${escapeHtml(taskTitle)}</p>

          <label class="review-notes-label">Result Link</label>
          <input
            type="url"
            id="reviewResultLink"
            class="review-link-input"
            placeholder="https://drive.google.com/... or deliverable URL"
          />

          <label class="review-notes-label">Notes (optional)</label>
          <textarea
            id="reviewNotes"
            class="review-notes-input"
            placeholder="Add any notes for the reviewer..."
            rows="3"
          ></textarea>
        </div>
        <div class="dashboard-modal-footer">
          <button type="button" class="btn-secondary" id="cancelReview">Cancel</button>
          <button type="button" class="btn-primary" id="confirmReview">
            <span class="btn-icon">-&gt;</span> Send to Review
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("reviewModal");
  const resultLinkInput = document.getElementById("reviewResultLink");
  const notesInput = document.getElementById("reviewNotes");
  const confirmBtn = document.getElementById("confirmReview");
  const cancelBtn = document.getElementById("cancelReview");
  const closeBtn = document.getElementById("closeReviewModal");

  // Focus result link input
  setTimeout(() => resultLinkInput.focus(), 100);

  // Close modal function
  const closeModal = () => {
    modal.remove();
  };

  // Handle confirm
  confirmBtn.addEventListener("click", async () => {
    const resultLink = resultLinkInput.value.trim();
    const notes = notesInput.value.trim();
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="btn-icon">...</span> Sending...';

    await handleSendToReview(taskId, notes, resultLink, closeModal);
  });

  // Handle cancel/close
  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

async function handleSendToReview(taskId, notes, resultLink, closeModalFn) {
  console.log("[Dashboard] Sending task to review:", taskId);

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const payload = {
      notes: notes || null,
      result_link: resultLink || null,
      performed_by: currentUser?.user_id || null
    };

    const response = await fetch(`${DASHBOARD_API}/pipeline/tasks/${taskId}/send-to-review`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("[Dashboard] Task sent to review:", result);

    // Close modal
    closeModalFn();

    // Show success toast
    if (window.Toast) {
      let message = "Task sent for approval.";
      if (result.elapsed_time) {
        message += ` Time worked: ${result.elapsed_time}`;
      }
      if (result.reviewer_task_created) {
        message += " Reviewer has been notified.";
      }
      Toast.success("Sent to Review", message);
    }

    // Reload tasks to reflect the change
    if (currentUser) {
      loadMyWorkTasks(currentUser);
    }

  } catch (err) {
    console.error("[Dashboard] Failed to send task to review:", err);

    if (window.Toast) {
      Toast.error("Send Failed", err.message);
    }

    // Re-enable button in modal if still open
    const confirmBtn = document.getElementById("confirmReview");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span class="btn-icon">→</span> Send to Review';
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ELAPSED TIME TRACKING
// ─────────────────────────────────────────────────────────────────────────

let elapsedTimeInterval = null;

function startElapsedTimeUpdater() {
  // Clear existing interval
  if (elapsedTimeInterval) {
    clearInterval(elapsedTimeInterval);
  }

  // Update elapsed times every minute
  elapsedTimeInterval = setInterval(() => {
    // Update working indicators (old style)
    document.querySelectorAll(".task-working-indicator").forEach((indicator) => {
      const timeStart = indicator.dataset.timeStart;
      if (timeStart) {
        const elapsedEl = indicator.querySelector(".task-elapsed-time");
        if (elapsedEl) {
          elapsedEl.textContent = formatElapsedTime(timeStart);
        }
      }
    });

    // Update working timers (new style)
    document.querySelectorAll(".task-working-timer").forEach((timer) => {
      const timeStart = timer.dataset.timeStart;
      if (timeStart) {
        const elapsedEl = timer.querySelector(".task-elapsed-time");
        if (elapsedEl) {
          elapsedEl.textContent = formatElapsedTime(timeStart);
        }
      }
    });
  }, 60000); // Update every minute
}

function formatElapsedTime(timeStartStr) {
  if (!timeStartStr) return "";

  const startTime = new Date(timeStartStr);
  const now = new Date();
  const diffMs = now - startTime;

  if (diffMs < 0) return "";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;

  if (diffHours > 0) {
    return `${diffHours}h ${remainingMins}m`;
  }
  return `${diffMins}m`;
}

function formatCurrency(amount) {
  if (!amount && amount !== 0) return "0.00";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// ---------------------------------------------------------------------------
// PENDING REVIEWS SECTION (for managers)
// ---------------------------------------------------------------------------

async function loadPendingReviews(user) {
  const sectionEl = document.getElementById("pending-reviews-section");
  const dividerEl = document.getElementById("pending-reviews-divider");
  const loadingEl = document.getElementById("pending-reviews-loading");
  const emptyEl = document.getElementById("pending-reviews-empty");
  const listEl = document.getElementById("pending-reviews-list");

  if (!sectionEl || !loadingEl || !emptyEl || !listEl) {
    console.log("[Dashboard] Pending reviews elements not found");
    return;
  }

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    // Fetch pending reviews for this user
    const response = await fetch(
      `${DASHBOARD_API}/pipeline/tasks/pending-reviews/${user.user_id}`,
      {
        credentials: "include",
        headers
      }
    );

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const reviews = data.tasks || [];

    // Hide loading
    loadingEl.style.display = "none";

    if (reviews.length === 0) {
      // Hide section entirely if no pending reviews
      sectionEl.style.display = "none";
      if (dividerEl) dividerEl.style.display = "none";
    } else {
      // Show section
      sectionEl.style.display = "block";
      if (dividerEl) dividerEl.style.display = "block";
      emptyEl.style.display = "none";
      listEl.style.display = "block";
      renderPendingReviews(reviews);
    }

  } catch (err) {
    console.error("[Dashboard] Failed to load pending reviews:", err);
    // Hide section on error
    sectionEl.style.display = "none";
    if (dividerEl) dividerEl.style.display = "none";
  }
}

function renderPendingReviews(reviews) {
  const listEl = document.getElementById("pending-reviews-list");
  if (!listEl) return;

  const html = reviews.map((review) => {
    // Get the original task if this is a review task
    const originalTask = review.original_task || review;
    const taskId = originalTask.task_id || review.task_id;
    const description = originalTask.task_description || review.task_description || "Untitled task";
    const projectName = review.project_name || originalTask.project_name || null;
    const ownerName = review.owner_name || "Unknown";
    const resultLink = originalTask.result_link || review.result_link;
    const rejectionCount = originalTask.rejection_count || 0;

    // Actions - Result link (if available), Approve, Reject
    let actionsHtml = "";

    if (resultLink) {
      actionsHtml += `
        <a href="${escapeHtml(resultLink)}" target="_blank" rel="noopener" class="task-result-link">
          View Result
        </a>
      `;
    }

    actionsHtml += `
      <button type="button" class="task-approve-btn" data-task-id="${taskId}" data-review-id="${review.task_id}">
        Approve
      </button>
      <button type="button" class="task-reject-btn" data-task-id="${taskId}" data-review-id="${review.task_id}" data-task-title="${escapeHtml(description)}">
        Reject
      </button>
    `;

    // Rejection count badge
    let rejectionBadge = "";
    if (rejectionCount > 0) {
      rejectionBadge = `<span class="task-rejection-count">Rejected ${rejectionCount}x</span>`;
    }

    return `
      <div class="pending-review-task" data-task-id="${taskId}" data-review-id="${review.task_id}">
        <div class="pending-review-task-icon">
          <span class="task-icon-badge task-icon-review">R</span>
        </div>
        <div class="pending-review-task-content">
          <div class="pending-review-task-title">${escapeHtml(description)} ${rejectionBadge}</div>
          <div class="pending-review-task-meta">
            <span class="task-submitted-by">Submitted by ${escapeHtml(ownerName)}</span>
            ${projectName ? `<span class="task-meta-separator">-</span><span class="task-meta-project">${escapeHtml(projectName)}</span>` : ''}
          </div>
        </div>
        <div class="pending-review-task-actions">
          ${actionsHtml}
        </div>
      </div>
    `;
  }).join("");

  listEl.innerHTML = html;

  // Attach event handlers
  listEl.querySelectorAll(".task-approve-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const reviewId = btn.dataset.reviewId;
      if (taskId) {
        handleApproveTask(taskId, reviewId, btn);
      }
    });
  });

  listEl.querySelectorAll(".task-reject-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      const reviewId = btn.dataset.reviewId;
      const taskTitle = btn.dataset.taskTitle;
      if (taskId) {
        showRejectModal(taskId, reviewId, taskTitle, btn);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// APPROVE TASK
// ---------------------------------------------------------------------------

async function handleApproveTask(taskId, reviewId, buttonEl) {
  console.log("[Dashboard] Approving task:", taskId);

  // Disable button
  buttonEl.disabled = true;
  buttonEl.textContent = "Approving...";

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const payload = {
      reviewer_notes: null,
      performed_by: currentUser?.user_id || null
    };

    const response = await fetch(`${DASHBOARD_API}/pipeline/tasks/${taskId}/approve`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("[Dashboard] Task approved:", result);

    // Show success toast
    if (window.Toast) {
      Toast.success("Task Approved", "Task moved to Good to Go. Ready for coordination.");
    }

    // Reload reviews
    if (currentUser) {
      loadPendingReviews(currentUser);
    }

  } catch (err) {
    console.error("[Dashboard] Failed to approve task:", err);

    // Re-enable button
    buttonEl.disabled = false;
    buttonEl.textContent = "Approve";

    if (window.Toast) {
      Toast.error("Approval Failed", err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// REJECT TASK MODAL
// ---------------------------------------------------------------------------

function showRejectModal(taskId, reviewId, taskTitle, buttonEl) {
  // Remove existing modal
  const existingModal = document.getElementById("rejectModal");
  if (existingModal) {
    existingModal.remove();
  }

  const modalHtml = `
    <div id="rejectModal" class="dashboard-modal-backdrop reject-modal">
      <div class="dashboard-modal">
        <div class="dashboard-modal-header">
          <h3 class="dashboard-modal-title">Return for Revision</h3>
          <button type="button" class="dashboard-modal-close" id="closeRejectModal">&times;</button>
        </div>
        <div class="dashboard-modal-body">
          <p class="review-task-name">${escapeHtml(taskTitle)}</p>

          <label class="review-notes-label">Feedback / Rejection Notes (required)</label>
          <textarea
            id="rejectNotes"
            class="review-notes-input"
            placeholder="Explain what needs to be revised or corrected..."
            rows="4"
            required
          ></textarea>

          <label class="review-notes-label">Reference Link (optional)</label>
          <input
            type="url"
            id="rejectRefLink"
            class="review-link-input"
            placeholder="https://... reference document or example"
          />
        </div>
        <div class="dashboard-modal-footer">
          <button type="button" class="btn-secondary" id="cancelReject">Cancel</button>
          <button type="button" class="btn-primary" id="confirmReject">
            Return for Revision
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("rejectModal");
  const notesInput = document.getElementById("rejectNotes");
  const refLinkInput = document.getElementById("rejectRefLink");
  const confirmBtn = document.getElementById("confirmReject");
  const cancelBtn = document.getElementById("cancelReject");
  const closeBtn = document.getElementById("closeRejectModal");

  // Focus notes input
  setTimeout(() => notesInput.focus(), 100);

  const closeModal = () => {
    modal.remove();
  };

  // Handle confirm
  confirmBtn.addEventListener("click", async () => {
    const notes = notesInput.value.trim();
    if (!notes) {
      notesInput.focus();
      if (window.Toast) {
        Toast.warning("Notes Required", "Please provide feedback for the task owner.");
      }
      return;
    }

    const refLink = refLinkInput.value.trim();
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Returning...";

    await handleRejectTask(taskId, reviewId, notes, refLink, closeModal);
  });

  // Handle cancel/close
  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Close on Escape
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

async function handleRejectTask(taskId, reviewId, notes, refLink, closeModalFn) {
  console.log("[Dashboard] Rejecting task:", taskId);

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const attachments = refLink ? [refLink] : null;

    const payload = {
      rejection_notes: notes,
      attachments: attachments,
      performed_by: currentUser?.user_id || null
    };

    const response = await fetch(`${DASHBOARD_API}/pipeline/tasks/${taskId}/reject`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    console.log("[Dashboard] Task rejected:", result);

    // Close modal
    closeModalFn();

    // Show toast
    if (window.Toast) {
      Toast.info("Returned for Revision", `Task returned to owner. Rejection count: ${result.rejection_count}`);
    }

    // Reload reviews
    if (currentUser) {
      loadPendingReviews(currentUser);
    }

  } catch (err) {
    console.error("[Dashboard] Failed to reject task:", err);

    if (window.Toast) {
      Toast.error("Rejection Failed", err.message);
    }

    // Re-enable button in modal
    const confirmBtn = document.getElementById("confirmReject");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Return for Revision";
    }
  }
}

// ---------------------------------------------------------------------------
// COMMAND PALETTE
// ---------------------------------------------------------------------------

let moduleSearchData = [];
let myWorkSearchData = [];

function buildModuleSearchData() {
  moduleSearchData = [];
  document.querySelectorAll('.module-card[data-module]').forEach(card => {
    if (card.style.display === 'none') return;
    const title = card.querySelector('.module-title')?.textContent || '';
    const desc = card.querySelector('.module-desc')?.textContent || '';
    const href = card.getAttribute('href');
    const mod = card.dataset.module;
    if (href && title) {
      moduleSearchData.push({ title, desc, href, module: mod, type: 'module' });
    }
  });
}

function initCommandPalette() {
  const searchForm = document.getElementById('searchForm');

  buildModuleSearchData();

  if (searchForm) {
    searchForm.addEventListener('click', (e) => {
      e.preventDefault();
      openCommandPalette();
    });
  }

  // Mobile topbar search button
  const mobileSearchBtn = document.getElementById('btnMobileSearch');
  if (mobileSearchBtn) mobileSearchBtn.addEventListener('click', openCommandPalette);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });
}

function openCommandPalette() {
  const existing = document.getElementById('cmdPalette');
  if (existing) { existing.remove(); return; }

  const html = `
    <div id="cmdPalette" class="cmd-palette-backdrop">
      <div class="cmd-palette">
        <div class="cmd-palette-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" class="cmd-palette-input" id="cmdPaletteInput" placeholder="Search modules, tasks, pages..." autofocus />
        </div>
        <div class="cmd-palette-results" id="cmdPaletteResults"></div>
        <div class="cmd-palette-footer">
          <span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  const backdrop = document.getElementById('cmdPalette');
  const input = document.getElementById('cmdPaletteInput');
  const resultsContainer = document.getElementById('cmdPaletteResults');

  let selectedIndex = 0;
  let currentResults = [];

  renderPaletteResults('');
  setTimeout(() => input.focus(), 50);

  input.addEventListener('input', () => {
    selectedIndex = 0;
    renderPaletteResults(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
      highlightPaletteSelected();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightPaletteSelected();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentResults[selectedIndex]) {
        navigatePaletteTo(currentResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette();
  });

  function closePalette() {
    backdrop.remove();
  }

  function renderPaletteResults(query) {
    const q = query.trim().toLowerCase();
    currentResults = [];
    let resultHtml = '';

    // Search modules
    const matchedModules = moduleSearchData.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.desc.toLowerCase().includes(q) ||
      m.module.toLowerCase().includes(q)
    );

    // Search tasks
    const matchedTasks = myWorkSearchData.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.subtitle || '').toLowerCase().includes(q)
    );

    if (matchedModules.length > 0) {
      resultHtml += '<div class="cmd-palette-category">Modules</div>';
      matchedModules.forEach(m => {
        currentResults.push(m);
        const idx = currentResults.length - 1;
        resultHtml += `<div class="cmd-palette-item" data-index="${idx}">
          <div class="cmd-palette-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            </svg>
          </div>
          <div class="cmd-palette-item-text">
            <div class="cmd-palette-item-title">${escapeHtml(m.title)}</div>
            <div class="cmd-palette-item-subtitle">${escapeHtml(m.desc)}</div>
          </div>
          <span class="cmd-palette-item-badge">Module</span>
        </div>`;
      });
    }

    if (matchedTasks.length > 0) {
      resultHtml += '<div class="cmd-palette-category">My Tasks</div>';
      matchedTasks.forEach(t => {
        currentResults.push(t);
        const idx = currentResults.length - 1;
        resultHtml += `<div class="cmd-palette-item" data-index="${idx}">
          <div class="cmd-palette-item-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <div class="cmd-palette-item-text">
            <div class="cmd-palette-item-title">${escapeHtml(t.title)}</div>
            <div class="cmd-palette-item-subtitle">${escapeHtml(t.subtitle || '')}</div>
          </div>
          <span class="cmd-palette-item-badge">Task</span>
        </div>`;
      });
    }

    if (currentResults.length === 0) {
      resultHtml = '<div class="cmd-palette-empty">No results found</div>';
    }

    resultsContainer.innerHTML = resultHtml;
    highlightPaletteSelected();

    resultsContainer.querySelectorAll('.cmd-palette-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index);
        if (currentResults[idx]) navigatePaletteTo(currentResults[idx]);
      });
    });
  }

  function highlightPaletteSelected() {
    resultsContainer.querySelectorAll('.cmd-palette-item').forEach(el => {
      el.classList.toggle('is-selected', parseInt(el.dataset.index) === selectedIndex);
    });
    const selected = resultsContainer.querySelector('.is-selected');
    if (selected) selected.scrollIntoView({ block: 'nearest' });
  }

  function navigatePaletteTo(result) {
    closePalette();
    if (result.href) {
      window.location.href = result.href;
    } else if (result.link) {
      window.location.href = result.link;
    }
  }
}

// ---------------------------------------------------------------------------
// MODULE NOTIFICATION BADGES
// ---------------------------------------------------------------------------

const moduleBadgeCounts = {};

function updateModuleBadges() {
  Object.entries(moduleBadgeCounts).forEach(([moduleKey, count]) => {
    const card = document.querySelector(`.module-card[data-module="${moduleKey}"]`);
    if (!card) return;
    const iconContainer = card.querySelector('.module-icon');
    if (!iconContainer) return;

    const existing = iconContainer.querySelector('.module-notification-badge');
    if (existing) existing.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'module-notification-badge';
      badge.textContent = count > 99 ? '99+' : String(count);
      iconContainer.appendChild(badge);
    }
  });
}

// ---------------------------------------------------------------------------
// EXPOSE GLOBAL API FOR REALTIME
// ---------------------------------------------------------------------------

window.loadMyWorkTasks = loadMyWorkTasks;
window.loadPendingReviews = loadPendingReviews;
window.loadMentions = loadMentions;

// Also expose currentUser for realtime module
Object.defineProperty(window, 'currentUser', {
  get: function() { return currentUser; },
  configurable: true
});
