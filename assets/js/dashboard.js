// assets/js/dashboard.js

// Usa API_BASE de config.js (ya definido globalmente)
const DASHBOARD_API = window.API_BASE || window.NGM_CONFIG?.API_BASE || "http://localhost:3000";

// Store current user for reference
let currentUser = null;

// ─────────────────────────────────────────────────────────────────────────
// PAGE LOADING
// ─────────────────────────────────────────────────────────────────────────

const MIN_LOADING_TIME = 800; // Minimum loading screen time in ms
let logoReadyTime = null;

// Wait for logo to be ready before counting min time
(function initLogoReady() {
  const overlay = document.getElementById("pageLoadingOverlay");
  if (!overlay) {
    logoReadyTime = Date.now();
    return;
  }

  const logoImg = overlay.querySelector(".loading-logo");
  if (!logoImg) {
    logoReadyTime = Date.now();
    return;
  }

  // Check if already loaded (cached)
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    logoReadyTime = Date.now();
    return;
  }

  // Wait for load
  logoImg.addEventListener("load", () => {
    logoReadyTime = Date.now();
  });

  logoImg.addEventListener("error", () => {
    logoReadyTime = Date.now();
  });

  // Fallback timeout
  setTimeout(() => {
    if (!logoReadyTime) logoReadyTime = Date.now();
  }, 2000);
})();

function hidePageLoading() {
  const doHide = () => {
    const now = Date.now();
    const effectiveStart = logoReadyTime || now;
    const elapsed = now - effectiveStart;
    const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

    setTimeout(() => {
      const overlay = document.getElementById("pageLoadingOverlay");
      if (overlay) {
        overlay.classList.add("hidden");
      }
      document.body.classList.remove("page-loading");
      document.body.classList.add("auth-ready");
    }, remaining);
  };

  // Wait for logo if not ready yet
  if (!logoReadyTime) {
    const check = setInterval(() => {
      if (logoReadyTime) {
        clearInterval(check);
        doHide();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(check);
      doHide();
    }, 2500);
  } else {
    doHide();
  }
}

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

  // Load data in parallel for faster loading
  try {
    await Promise.all([
      loadMentions(user),
      loadMyWorkTasks(user)
    ]);
  } catch (err) {
    console.error("[Dashboard] Error loading data:", err);
  }

  // Hide loading overlay after data is loaded
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

        tasks.push({
          type: "pipeline_task",
          taskId: task.task_id,
          title: task.task_description || "Untitled task",
          subtitle: task.project_name || null,
          module: "Pipeline Manager",
          icon: icon,
          iconClass: iconClass,
          link: `pipeline.html?task=${task.task_id}`,
          actionText: isWorking ? "Working" : (isNotStarted ? "Start" : "View"),
          isStartable: isNotStarted,
          isWorking: isWorking,
          timeStart: task.time_start,
          statusName: task.status_name,
        });
      });
    }

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
    // Determine action button based on task type
    let actionHtml;

    if (task.type === "pipeline_task") {
      if (task.isStartable) {
        // Start button for "Not Started" tasks
        actionHtml = `
          <button type="button" class="task-action-btn task-start-btn" data-task-id="${task.taskId}">
            <span class="task-btn-icon">▶</span> Start
          </button>
        `;
      } else if (task.isWorking) {
        // Working task: show elapsed time + Send to Review button
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
        // View button for other statuses
        actionHtml = `<a href="${task.link}" class="task-action-btn task-view-btn">${task.actionText}</a>`;
      }
    } else {
      // Default action for other task types
      actionHtml = `<a href="${task.link}" class="task-action-btn">${task.actionText}</a>`;
    }

    // Status badge for pipeline tasks
    let statusBadge = "";
    if (task.type === "pipeline_task" && task.statusName && !task.isNotStarted && !task.isWorking) {
      statusBadge = `<span class="task-status-badge">${escapeHtml(task.statusName)}</span>`;
    }

    return `
      <div class="my-work-task" data-type="${task.type}" data-task-id="${task.taskId || ''}">
        <div class="my-work-task-icon">
          <span class="task-icon-badge ${task.iconClass}">${task.icon}</span>
        </div>
        <div class="my-work-task-content">
          <div class="my-work-task-title">${escapeHtml(task.title)} ${statusBadge}</div>
          <div class="my-work-task-meta">
            <span class="task-meta-module">${escapeHtml(task.module)}</span>
            ${task.subtitle ? `<span class="task-meta-separator">·</span><span class="task-meta-project">${escapeHtml(task.subtitle)}</span>` : ''}
          </div>
        </div>
        <div class="my-work-task-action">
          ${actionHtml}
        </div>
      </div>
    `;
  }).join("");

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
            <span class="btn-icon">→</span> Send to Review
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  const modal = document.getElementById("reviewModal");
  const notesInput = document.getElementById("reviewNotes");
  const confirmBtn = document.getElementById("confirmReview");
  const cancelBtn = document.getElementById("cancelReview");
  const closeBtn = document.getElementById("closeReviewModal");

  // Focus notes input
  setTimeout(() => notesInput.focus(), 100);

  // Close modal function
  const closeModal = () => {
    modal.remove();
  };

  // Handle confirm
  confirmBtn.addEventListener("click", async () => {
    const notes = notesInput.value.trim();
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="btn-icon">⏳</span> Sending...';

    await handleSendToReview(taskId, notes, closeModal);
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

async function handleSendToReview(taskId, notes, closeModalFn) {
  console.log("[Dashboard] Sending task to review:", taskId);

  try {
    const token = localStorage.getItem("ngmToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(`${DASHBOARD_API}/pipeline/tasks/${taskId}/send-to-review`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ notes: notes || null })
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
