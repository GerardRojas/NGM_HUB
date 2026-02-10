// ================================
// PIPELINE MANAGER - Main Script
// ================================

(function() {
  'use strict';

  // ================================
  // AUTH
  // ================================
  let currentUser = null;

  function initAuth() {
    const userStr = localStorage.getItem('ngmUser');
    if (!userStr) {
      console.warn('[PIPELINE] No user found, redirecting to login');
      window.location.href = 'login.html';
      return false;
    }
    try {
      currentUser = JSON.parse(userStr);
      console.log('[PIPELINE] User authenticated:', currentUser);
      return true;
    } catch (e) {
      console.error('[PIPELINE] Error parsing user:', e);
      localStorage.removeItem('ngmUser');
      window.location.href = 'login.html';
      return false;
    }
  }

  // ================================
  // UTILITIES (Pure Helper Functions)
  // ================================

  const Utils = {
    /**
     * Escapes HTML special characters to prevent XSS
     */
    escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    /**
     * Gets the first letter of a name (for avatar initials)
     */
    getInitial(name) {
      const s = String(name || "").trim();
      if (!s) return "?";
      return s[0].toUpperCase();
    },

    /**
     * Generates a consistent color hue from a string (for avatars)
     */
    hashStringToHue(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) >>> 0;
      }
      return h % 360;
    },

    /**
     * Formats a date value for display in tables
     */
    formatMaybeDate(v) {
      if (!v) return "-";
      const s = String(v);
      // Normalize ISO to YYYY-MM-DD first
      const ymd = s.includes("T") ? s.split("T")[0] : s;
      // Use date picker's formatter if available for human-friendly display
      if (window.PM_DatePicker) return window.PM_DatePicker.formatDate(ymd);
      return ymd;
    }
  };

  // ================================
  // RENDERERS (UI Components)
  // ================================

  const Renderers = {
    /**
     * Renders a person badge with avatar and name
     * @param {string|object} personOrName - Can be a name string or user object with {name, avatar_color, photo}
     */
    renderPerson(personOrName) {
      // Handle both string (legacy) and object (new) format
      let name, avatarColor, photo, oderId;

      if (personOrName && typeof personOrName === "object") {
        name = personOrName.name || personOrName.username || "";
        avatarColor = personOrName.avatar_color;
        photo = personOrName.photo || personOrName.user_photo;
        oderId = personOrName.user_id || personOrName.id || null;
      } else {
        name = String(personOrName || "");
      }

      const raw = name.trim();

      // Empty / placeholder
      if (!raw || raw === "-") {
        return `
          <span class="pm-person pm-person--empty" title="Click to assign">
            <span class="pm-avatar pm-avatar--placeholder"></span>
          </span>
        `;
      }

      const safeName = Utils.escapeHtml(raw);
      const initial = Utils.escapeHtml(Utils.getInitial(raw));

      // Use avatar_color if available (official user color), otherwise generate from user_id or name
      let hue;
      if (avatarColor !== undefined && avatarColor !== null && !isNaN(Number(avatarColor))) {
        hue = Math.max(0, Math.min(360, Number(avatarColor)));
      } else {
        const key = oderId || raw.toLowerCase();
        hue = Utils.hashStringToHue(String(key));
      }

      const color = `hsl(${hue} 70% 45%)`;

      if (photo) {
        return `
          <span class="pm-person" title="${safeName}">
            <span class="pm-avatar pm-avatar-img" style="border-color:${color};">
              <img src="${Utils.escapeHtml(photo)}" alt="${safeName}" />
            </span>
            <span class="pm-person-name">${safeName}</span>
          </span>
        `;
      }

      return `
        <span class="pm-person" title="${safeName}">
          <span class="pm-avatar" style="color:${color}; border-color:${color};">${initial}</span>
          <span class="pm-person-name">${safeName}</span>
        </span>
      `;
    },

    /**
     * Renders multiple people as stacked avatars with overflow count
     * @param {Array} people - Array of user objects [{name, avatar_color, photo}]
     * @param {number} maxDisplay - Maximum avatars to display before showing +N
     */
    renderMultiplePeople(people, maxDisplay = 3) {
      if (!Array.isArray(people) || people.length === 0) {
        return this.renderPerson("-");
      }

      // Single person: render at full size (same as owner column)
      if (people.length === 1) {
        return this.renderPerson(people[0]);
      }

      const displayPeople = people.slice(0, maxDisplay);
      const overflow = people.length - maxDisplay;

      // Build all names for tooltip
      const allNames = people.map(p => p.name || p.username || "Unknown").join(", ");

      let html = `<span class="pm-people-stack" title="${Utils.escapeHtml(allNames)}">`;

      displayPeople.forEach((person, index) => {
        const name = person.name || person.username || "";
        const avatarColor = person.avatar_color;
        const photo = person.photo || person.user_photo;
        const oderId = person.user_id || person.id || null;
        const initial = Utils.getInitial(name || "-");

        // Use avatar_color if available, otherwise generate from user_id or name
        // This matches the logic in Team Management for consistency
        let hue;
        if (avatarColor !== undefined && avatarColor !== null && !isNaN(Number(avatarColor))) {
          hue = Math.max(0, Math.min(360, Number(avatarColor)));
        } else {
          const key = oderId || (name ? name.toLowerCase() : "__unknown__");
          hue = Utils.hashStringToHue(String(key));
        }

        // Ring style colors matching Team Management
        const color = name ? `hsl(${hue} 70% 45%)` : "rgba(148, 163, 184, 0.6)";
        const zIndex = displayPeople.length - index;

        if (photo && name) {
          html += `
            <span class="pm-avatar pm-avatar-img pm-avatar-stacked" style="border-color:${color}; z-index:${zIndex};" title="${Utils.escapeHtml(name)}">
              <img src="${Utils.escapeHtml(photo)}" alt="${Utils.escapeHtml(name)}" />
            </span>
          `;
        } else {
          html += `
            <span class="pm-avatar pm-avatar-stacked" style="color:${color}; border-color:${color}; z-index:${zIndex};" title="${Utils.escapeHtml(name)}">
              ${Utils.escapeHtml(initial)}
            </span>
          `;
        }
      });

      if (overflow > 0) {
        html += `<span class="pm-avatar pm-avatar-overflow" title="${overflow} more">+${overflow}</span>`;
      }

      html += `</span>`;
      return html;
    },

    /**
     * Gets the cell value for a specific column key
     */
    getCellValue(task, key) {
      // Guard clause for null/undefined task
      if (!task) return "-";
      const t = task;

      switch (key) {
        case "task":
          return Utils.escapeHtml(t.task_description || t.title || "(No description)");

        case "project":
          return Utils.escapeHtml(
            t.project_name ||
            t.project ||
            t.project_title ||
            t.project_id ||
            "-"
          );

        case "owner": {
          // Pass full user object to use avatar_color and photo
          if (t.owner && (t.owner.name || t.owner.id)) {
            return this.renderPerson(t.owner);
          }
          // Fallback to name string
          const name = t.owner_name || t.assigned_to || "";
          return this.renderPerson(name || "-");
        }

        case "collaborator": {
          // Render multiple collaborators as stacked avatars
          if (Array.isArray(t.collaborators) && t.collaborators.length > 0) {
            const validCollabs = t.collaborators.filter(c => c && (c.name || c.id));
            if (validCollabs.length > 0) {
              return this.renderMultiplePeople(validCollabs, 3);
            }
          }
          return this.renderPerson("-");
        }

        case "manager": {
          // Render multiple managers as stacked avatars
          if (Array.isArray(t.managers) && t.managers.length > 0) {
            const validManagers = t.managers.filter(m => m && (m.name || m.id));
            if (validManagers.length > 0) {
              return this.renderMultiplePeople(validManagers, 3);
            }
          }
          // Fallback to single manager object
          if (t.manager && (t.manager.name || t.manager.id)) {
            return this.renderPerson(t.manager);
          }
          return this.renderPerson("-");
        }

        case "company":
          return Utils.escapeHtml(t.company_name || "-");

        case "department":
          return Utils.escapeHtml(t.department || "-");

        case "type":
          return Utils.escapeHtml(t.type || "-");

        case "status": {
          const statusName = (t.status?.name || t.status_name || t.status || '').trim();
          if (!statusName) return '-';
          const lowerStatus = statusName.toLowerCase();
          const color = STATUS_CONFIG.getAccentColor(lowerStatus);
          return `<span class="pm-badge-pill" style="background: ${color};">${Utils.escapeHtml(statusName)}</span>`;
        }

        case "time_start":
          return Utils.escapeHtml(t.time_start || "-");

        case "time_finish":
          return Utils.escapeHtml(t.time_finish || "-");

        case "start":
          return Utils.escapeHtml(Utils.formatMaybeDate(t.start_date));

        case "est": {
          const v = (typeof t.estimated_hours === "number")
            ? t.estimated_hours
            : (t.estimated_hours ?? null);
          return Utils.escapeHtml(v != null ? v : "-");
        }

        case "priority": {
          const prioName = (
            (t.priority && (t.priority.priority_name || t.priority.priority_id)) ||
            t.priority_name ||
            t.priority ||
            ''
          ).trim();
          if (!prioName) return '-';
          const PRIO_COLORS = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#3b82f6" };
          const prioColor = PRIO_COLORS[prioName.toLowerCase()] || '#6b7280';
          return `<span class="pm-badge-pill" style="background: ${prioColor};">${Utils.escapeHtml(prioName)}</span>`;
        }

        case "finished":
          return Utils.escapeHtml(
            (t.finished_status &&
              (t.finished_status.completed_status_name ||
              t.finished_status.completed_status_id)) ||
            t.finished_status_name ||
            "-"
          );

        case "due":
          return Utils.escapeHtml(Utils.formatMaybeDate(t.due_date || t.due));

        case "deadline":
          return Utils.escapeHtml(Utils.formatMaybeDate(t.deadline));

        case "links": {
          const docsLink = t.docs_link || null;
          const resultLink = t.result_link || null;

          // Show add button when no links
          if (!docsLink && !resultLink) {
            return `<span class="pm-links-add-btn" title="Add links">+</span>`;
          }

          // Show links with icons
          const parts = [];
          if (docsLink) {
            parts.push(`<a href="${Utils.escapeHtml(docsLink)}" target="_blank" rel="noopener noreferrer" title="Open documentation" onclick="event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              Docs
            </a>`);
          }
          if (resultLink) {
            parts.push(`<a href="${Utils.escapeHtml(resultLink)}" target="_blank" rel="noopener noreferrer" title="Open result" onclick="event.stopPropagation()">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              Result
            </a>`);
          }
          return `<span class="pm-links-display">${parts.join("")}</span>`;
        }

        default:
          return "-";
      }
    }
  };

  // ================================
  // CACHE SYSTEM (For instant page loads)
  // ================================

  const CACHE_KEYS = {
    PIPELINE_DATA: "ngm_cache_pipeline_data",
  };
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Saves data to localStorage cache with timestamp
   */
  function saveToCache(key, data) {
    try {
      const cacheItem = { data: data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn("[PIPELINE] Cache save failed:", e);
    }
  }

  /**
   * Loads data from localStorage cache
   * Returns data even if expired (for instant display while fetching fresh data)
   */
  function loadFromCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const cacheItem = JSON.parse(cached);
      return cacheItem.data;
    } catch (e) {
      console.warn("[PIPELINE] Cache load failed:", e);
      return null;
    }
  }

  /**
   * Checks if cache is still fresh (within TTL)
   */
  function isCacheFresh(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return false;
      const cacheItem = JSON.parse(cached);
      return Date.now() - cacheItem.timestamp < CACHE_TTL;
    } catch (e) {
      return false;
    }
  }

  // ================================
  // STATUS CONFIGURATION
  // ================================

  const STATUS_CONFIG = {
    accents: {
      "working on it": "#3b82f6",
      "done": "#22c55e",
      "correction": "#f87171",
      "awaiting approval": "#fb923c",
      "resubmittal needed": "#eab308",
      "good to go": "#10b981",
      "not started": "#facc15",
      "delayed": "#a855f7",
    },

    classes: {
      "working on it": "pm-group--working-on-it",
      "done": "pm-group--done",
      "correction": "pm-group--correction",
      "awaiting approval": "pm-group--awaiting-approval",
      "resubmittal needed": "pm-group--resubmittal-needed",
      "good to go": "pm-group--good-to-go",
      "not started": "pm-group--not-started",
      "delayed": "pm-group--delayed",
    },

    order: [
      "not started",
      "working on it",
      "awaiting approval",
      "good to go",
      "correction",
      "resubmittal needed",
      "done",
      "delayed",
    ],

    getRank(statusName) {
      const index = this.order.indexOf(statusName);
      return index !== -1 ? index : 999;
    },

    getAccentColor(statusName) {
      return this.accents[statusName] || "#3e4042";
    },

    getCssClass(statusName) {
      return this.classes[statusName] || "";
    }
  };

  // ================================
  // Layout Controls (Manage Layout Modal)
  // ================================
  function initLayoutControls() {
    const overlay = document.getElementById("layoutModal");
    const btnOpen = document.getElementById("btnManageLayout");
    if (!overlay || !btnOpen) return;

    const modalCard = overlay.querySelector(".modal");
    const btnClose = document.getElementById("btnCloseLayoutModal");
    const btnCancel = document.getElementById("btnCancelLayout");
    const btnApply = document.getElementById("btnApplyLayout");

    const openModal = () => overlay.classList.remove("hidden");
    const closeModal = () => overlay.classList.add("hidden");

    // Prevent closing when clicking inside modal card
    modalCard?.addEventListener("click", (e) => e.stopPropagation());

    // Close when clicking overlay backdrop
    overlay.addEventListener("click", closeModal);

    // Open modal
    btnOpen.addEventListener("click", (e) => {
      e.preventDefault();
      openModal();

      // Populate columns checkboxes dynamically (only visible columns)
      const visibleMap = loadVisibleCols(VISIBLE_COLUMNS);
      buildColumnsModal(VISIBLE_COLUMNS, visibleMap);

      // Sync groups checkboxes from persistence
      syncGroupsCheckboxesInModal(loadVisibleGroups());
    });

    // Close button
    btnClose?.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });

    // Cancel button
    btnCancel?.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });

    // Apply button
    btnApply?.addEventListener("click", (e) => {
      e.preventDefault();

      const newMap = readColumnsModalState(VISIBLE_COLUMNS);
      saveVisibleCols(newMap);
      applyVisibleColsToTables(newMap);

      // Save visible groups
      const newGroupsMap = readGroupsFromModal();
      saveVisibleGroups(newGroupsMap);

      // Re-render to apply group filters
      renderGroups();

      window.initTableWidthSlider?.();

      closeModal();
    });
  }

  // ================================
  // Pipeline: Data and UI Logic
  // ================================

  // DOM Elements
  const groupsWrapper = document.getElementById("pm-groups-wrapper");
  const projectFilter = document.getElementById("project-filter");
  const ownerFilter = document.getElementById("owner-filter");
  const priorityFilter = document.getElementById("priority-filter");
  const manageBtn = document.getElementById("btnNewTask");
  const searchInput = document.getElementById("pipeline-search-input");
  // New Task button handler
  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      window.PM_NewTask?.open?.();
    });
  }

  // Storage keys
  const PM_COLS_STORAGE_KEY = "pm_visible_columns_v1";
  const PM_GROUPS_STORAGE_KEY = "pm_visible_groups_v1";

  // Column definitions
  // Columns with hidden: true are used for backend calculations only
  const COLUMNS = [
    { key: "task", label: "Task" },
    { key: "project", label: "Project" },
    { key: "owner", label: "Owner" },
    { key: "collaborator", label: "Collaborator" },
    { key: "manager", label: "Manager" },
    { key: "company", label: "Company" },
    { key: "department", label: "Department" },
    { key: "type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "time_start", label: "Time Start", hidden: true },  // Backend only
    { key: "time_finish", label: "Time Finish", hidden: true }, // Backend only
    { key: "start", label: "Start" },
    { key: "est", label: "Est (h)" },
    { key: "priority", label: "Priority" },
    { key: "finished", label: "Finished" },
    { key: "due", label: "Due" },
    { key: "deadline", label: "Deadline" },
    { key: "links", label: "Links" },
  ];

  // Visible columns for UI rendering (excludes hidden columns)
  const VISIBLE_COLUMNS = COLUMNS.filter(c => !c.hidden);

  // ================================
  // Column Layout (shared by all tables)
  // ================================

  function buildColGroup() {
    return `
      <colgroup>
        ${VISIBLE_COLUMNS.map(col => `<col data-col="${col.key}">`).join("")}
      </colgroup>
    `;
  }

  function getDefaultVisibleGroups() {
    return {
      "not started": true,
      "working on it": true,
      "awaiting approval": true,
      "good to go": true,
      "correction": true,
      "resubmittal needed": true,
      "done": true,
      "delayed": true,
    };
  }

  function loadVisibleGroups() {
    try {
      const raw = localStorage.getItem(PM_GROUPS_STORAGE_KEY);
      if (!raw) return getDefaultVisibleGroups();

      const parsed = JSON.parse(raw);
      const merged = getDefaultVisibleGroups();

      Object.keys(parsed || {}).forEach(k => {
        if (k in merged) merged[k] = !!parsed[k];
      });

      return merged;
    } catch (e) {
      console.warn("[PIPELINE] loadVisibleGroups failed:", e);
      return getDefaultVisibleGroups();
    }
  }

  function saveVisibleGroups(map) {
    localStorage.setItem(PM_GROUPS_STORAGE_KEY, JSON.stringify(map));
  }

  function syncGroupsCheckboxesInModal(visibleGroupsMap) {
    document.querySelectorAll('#layoutModal input[type="checkbox"][data-group-key]').forEach(cb => {
      const key = (cb.getAttribute("data-group-key") || "").trim().toLowerCase();
      if (!key) return;
      cb.checked = !!visibleGroupsMap[key];
    });
  }

  function readGroupsFromModal() {
    const map = getDefaultVisibleGroups();

    document.querySelectorAll('#layoutModal input[type="checkbox"][data-group-key]').forEach(cb => {
      const key = (cb.getAttribute("data-group-key") || "").trim().toLowerCase();
      if (!key) return;
      map[key] = cb.checked;
    });

    return map;
  }

  function getDefaultVisibleCols(cols) {
    const map = {};
    cols.forEach(c => (map[c.key] = true));
    return map;
  }

  function loadVisibleCols(cols) {
    try {
      const raw = localStorage.getItem(PM_COLS_STORAGE_KEY);
      if (!raw) return getDefaultVisibleCols(cols);

      const parsed = JSON.parse(raw);
      const merged = getDefaultVisibleCols(cols);

      Object.keys(parsed || {}).forEach(k => {
        if (k in merged) merged[k] = !!parsed[k];
      });

      return merged;
    } catch (e) {
      console.warn("[PIPELINE] loadVisibleCols failed:", e);
      return getDefaultVisibleCols(cols);
    }
  }

  function saveVisibleCols(map) {
    localStorage.setItem(PM_COLS_STORAGE_KEY, JSON.stringify(map));
  }

  function applyVisibleColsToTables(visibleMap) {
    document.querySelectorAll(".pm-group .table").forEach(table => {
      // th + td
      table.querySelectorAll("th[data-col], td[data-col]").forEach(el => {
        const key = el.dataset.col;
        el.style.display = visibleMap[key] ? "" : "none";
      });

      // colgroup (prevents empty space)
      table.querySelectorAll("col[data-col]").forEach(col => {
        const key = col.dataset.col;
        col.style.display = visibleMap[key] ? "" : "none";
      });
    });

    // Force width recalculation
    window.refreshPipelineTables?.();
  }

  function buildColumnsModal(cols, visibleMap) {
    const list = document.getElementById("pm-columns-list");
    if (!list) return;

    list.innerHTML = cols.map(c => `
      <label class="pm-checkbox">
        <input type="checkbox" data-col="${c.key}" ${visibleMap[c.key] ? "checked" : ""} />
        <span>${c.label}</span>
      </label>
    `).join("");
  }

  function readColumnsModalState(cols) {
    const list = document.getElementById("pm-columns-list");
    const map = {};
    cols.forEach(c => (map[c.key] = true));

    if (!list) return map;

    list.querySelectorAll("input[data-col]").forEach(cb => {
      map[cb.dataset.col] = cb.checked;
    });

    return map;
  }

  // ================================
  // Data Fetching
  // ================================

  let rawGroups = [];
  let searchQuery = "";

  // Smart Re-rendering: Track existing DOM elements
  const groupElementsMap = new Map(); // Maps groupKey -> DOM element

  // Invalidate pipeline cache (called by realtime when updates are detected)
  function invalidatePipelineCache() {
    try {
      localStorage.removeItem(CACHE_KEYS.PIPELINE_DATA);
      console.log("[PIPELINE] Cache invalidated");
    } catch (e) {
      console.warn("[PIPELINE] Cache invalidation failed:", e);
    }
  }

  // Expose fetchPipeline and renderGroups to window for modal refresh
  window.fetchPipeline = fetchPipeline;
  window.renderGroups = renderGroups;
  window.invalidatePipelineCache = invalidatePipelineCache;

  async function fetchPipeline(options = {}) {
    const { forceRefresh = false } = options;
    const startTime = performance.now();

    try {
      // Fallback if API_BASE is not defined yet
      const apiBase = window.API_BASE || "https://ngm-fastapi.onrender.com";

      console.log("[PIPELINE] fetchPipeline called", forceRefresh ? "(forced)" : "");

      // =============================================
      // PHASE 1: Load from cache INSTANTLY (unless forced)
      // =============================================
      const cachedData = forceRefresh ? null : loadFromCache(CACHE_KEYS.PIPELINE_DATA);
      let renderedFromCache = false;

      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        console.log("[PIPELINE] Loading from cache instantly");
        rawGroups = cachedData;
        populateFilters(rawGroups);
        renderGroups();
        hidePageLoading();
        renderedFromCache = true;

        const cacheTime = performance.now() - startTime;
        console.log(`[PIPELINE] Rendered from cache in ${cacheTime.toFixed(0)}ms`);

        // If cache is still fresh and not forced, skip API call
        if (!forceRefresh && isCacheFresh(CACHE_KEYS.PIPELINE_DATA)) {
          console.log("[PIPELINE] Cache is fresh, skipping API call");
          return;
        }
      }

      // =============================================
      // PHASE 2: Fetch fresh data from API
      // =============================================
      console.log("[PIPELINE] Fetching fresh data from API...");

      const url = `${apiBase}/pipeline/grouped`;
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          "Accept": "application/json"
        }
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "Could not read error body");
        console.error("[PIPELINE] Error response body:", errorText);
        throw new Error(`Error loading pipeline: ${res.status} ${res.statusText} - ${errorText}`);
      }

      const data = await res.json();
      let parsedGroups;

      if (Array.isArray(data)) {
        parsedGroups = data;
      } else if (Array.isArray(data.groups)) {
        parsedGroups = data.groups;
      } else if (data.groups && typeof data.groups === "object") {
        // FastAPI grouped by status
        parsedGroups = Object.entries(data.groups).map(([status, tasks]) => ({
          status_name: status,
          tasks: Array.isArray(tasks) ? tasks : [],
        }));
      } else if (typeof data === "object") {
        // Ultra defensive fallback
        parsedGroups = Object.entries(data).map(([status, tasks]) => ({
          status_name: status,
          tasks: Array.isArray(tasks) ? tasks : [],
        }));
      } else {
        parsedGroups = [];
      }

      // =============================================
      // PHASE 3: Save to cache and update UI if needed
      // =============================================
      saveToCache(CACHE_KEYS.PIPELINE_DATA, parsedGroups);

      // Only re-render if data has changed or we didn't render from cache
      const dataChanged = JSON.stringify(parsedGroups) !== JSON.stringify(rawGroups);

      if (!renderedFromCache || dataChanged) {
        rawGroups = parsedGroups;
        populateFilters(rawGroups);
        renderGroups();
        hidePageLoading();

        if (dataChanged && renderedFromCache) {
          console.log("[PIPELINE] Fresh data differs from cache, UI updated");
        }
      } else {
        console.log("[PIPELINE] Fresh data matches cache, no re-render needed");
      }

      const totalTime = performance.now() - startTime;
      console.log(`[PIPELINE] Total load time: ${totalTime.toFixed(0)}ms`);

    } catch (err) {
      console.error("[PIPELINE] fetch error:", err);

      // Check if it's a network error (CORS, connection refused, etc.)
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        console.error("[PIPELINE] Network error - possible causes: CORS, server down, or connection refused");
      }

      // If we didn't render from cache, show error
      if (!rawGroups || rawGroups.length === 0) {
        if (groupsWrapper) {
          groupsWrapper.innerHTML = `<p class='panel-text'>Error loading pipeline data: ${err.message}</p>`;
        }
      }
      hidePageLoading();
    }
  }

  // ================================
  // Filter Population
  // ================================

  function populateFilters(groups) {
    const projects = new Set();
    const owners = new Set();
    const priorities = new Set();

    groups.forEach(group => {
      const tasks = Array.isArray(group.tasks) ? group.tasks : [];
      tasks.forEach(t => {
        // Project
        const projectValue =
          t.project_name ||
          t.project ||
          t.project_title ||
          t.project_id ||
          "";

        if (projectValue) {
          projects.add(projectValue);
        }

        // Owner
        const ownerValue =
          (t.owner && (t.owner.name || t.owner.username || t.owner.email)) ||
          t.owner_name ||
          t.assigned_to ||
          "";

        if (ownerValue) {
          owners.add(ownerValue);
        }

        // Priority
        const priorityValue =
          (t.priority && (t.priority.priority_name || t.priority.priority_id)) ||
          t.priority_name ||
          t.priority ||
          "";

        if (priorityValue) {
          priorities.add(priorityValue);
        }
      });
    });

    function fillSelect(select, values) {
      if (!select) return;
      const current = select.value;
      select.innerHTML = "<option value='all'>All</option>";
      Array.from(values).sort().forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.toString();
        opt.textContent = v.toString();
        select.appendChild(opt);
      });
      if (Array.from(values).includes(current)) {
        select.value = current;
      }
    }

    fillSelect(projectFilter, projects);
    fillSelect(ownerFilter, owners);

    const mappedPriorities = new Map();
    Array.from(priorities).forEach(p => {
      mappedPriorities.set(p.toString().toLowerCase(), p);
    });
    const normalized = Array.from(mappedPriorities.entries())
      .sort((a, b) => a[1].toString().localeCompare(b[1].toString()));

    if (priorityFilter) {
      priorityFilter.innerHTML = "<option value='all'>All</option>";
      normalized.forEach(([key, label]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = label.toString();
        priorityFilter.appendChild(opt);
      });
    }
  }

  // ================================
  // Apply Filters
  // ================================

  function applyFilters(groups) {
    const selectedProject = projectFilter ? projectFilter.value : "all";
    const selectedOwner = ownerFilter ? ownerFilter.value : "all";
    const selectedPriority = priorityFilter ? priorityFilter.value : "all";
    const showAutomated = window.PM_Automations?.areTasksVisible?.() ?? true;

    return groups.map(group => {
      const tasks = Array.isArray(group.tasks) ? group.tasks : [];
      const filteredTasks = tasks.filter(t => {
        // Automated tasks visibility filter
        if (!showAutomated) {
          const isAutomated = t.is_automated ||
            (t.task_notes && t.task_notes.includes('[AUTOMATED]')) ||
            (t.automation_type && t.automation_type !== '');
          if (isAutomated) return false;
        }
        // Project filter
        const pid =
          t.project_name ||
          t.project ||
          t.project_title ||
          t.project_id ||
          "";
        const projectPass =
          selectedProject === "all" || pid === selectedProject;

        // Owner filter
        const ownerName =
          (t.owner && (t.owner.name || t.owner.username || t.owner.email)) ||
          t.owner_name ||
          t.assigned_to ||
          "";
        const ownerPass =
          selectedOwner === "all" || ownerName === selectedOwner;

        // Priority filter
        const priorityLabel =
          (t.priority && (t.priority.priority_name || t.priority.priority_id)) ||
          t.priority_name ||
          t.priority ||
          "";
        const pKey = priorityLabel.toString().toLowerCase();
        const priorityPass =
          selectedPriority === "all" || pKey === selectedPriority;

        // Search filter
        const q = (searchQuery || "").trim().toLowerCase();
        let searchPass = true;
        if (q) {
          const haystack = [
            t.task_description,
            t.task_notes,
            pid,
            ownerName,
            priorityLabel,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          searchPass = haystack.includes(q);
        }

        return projectPass && ownerPass && priorityPass && searchPass;
      });

      return {
        ...group,
        tasks: filteredTasks,
      };
    });
  }

  // ================================
  // Render Groups (Smart Re-rendering)
  // ================================

  /**
   * Main render function - Smart Re-rendering version
   * Updates existing elements instead of destroying/recreating all DOM
   */
  function renderGroups() {
    if (!groupsWrapper) return;

    const groups = applyFilters(rawGroups);
    console.log("[PIPELINE] rendering groups:", groups);

    // Empty state
    if (!groups.length) {
      groupsWrapper.innerHTML = "<p class='panel-text'>No pipeline groups to display.</p>";
      groupElementsMap.clear();
      return;
    }

    // Filter and sort groups
    const visibleGroupsMap = loadVisibleGroups();
    const filteredGroups = filterVisibleGroups(groups, visibleGroupsMap);
    const sortedGroups = sortGroupsByStatus(filteredGroups);

    // Smart Re-rendering: reconcile groups
    reconcileGroups(sortedGroups);

    // Apply column visibility
    applyVisibleColsToTables(loadVisibleCols(VISIBLE_COLUMNS));
  }

  /**
   * Reconciles groups: updates existing, creates new, removes old
   */
  function reconcileGroups(groups) {
    const newGroupKeys = new Set();

    // Track existing elements to detect removals
    const existingKeys = new Set(groupElementsMap.keys());

    console.log("[SMART-RENDER] Reconciling groups:", {
      existing: existingKeys.size,
      new: groups.length
    });

    // Process each group
    groups.forEach((group, index) => {
      const groupKey = getGroupKey(group);
      newGroupKeys.add(groupKey);

      if (groupElementsMap.has(groupKey)) {
        // Update existing group
        console.log(`[SMART-RENDER] Updating group: ${groupKey}`);
        const existingElem = groupElementsMap.get(groupKey);
        updateGroupElement(existingElem, group);

        // Ensure correct position
        const currentIndex = Array.from(groupsWrapper.children).indexOf(existingElem);
        if (currentIndex !== index) {
          // Move element to correct position
          if (index >= groupsWrapper.children.length) {
            groupsWrapper.appendChild(existingElem);
          } else {
            groupsWrapper.insertBefore(existingElem, groupsWrapper.children[index]);
          }
        }
      } else {
        // Create new group
        console.log(`[SMART-RENDER] Creating new group: ${groupKey}`);
        const newElem = createGroupElement(group);
        groupElementsMap.set(groupKey, newElem);

        // Insert at correct position
        if (index >= groupsWrapper.children.length) {
          groupsWrapper.appendChild(newElem);
        } else {
          groupsWrapper.insertBefore(newElem, groupsWrapper.children[index]);
        }
      }
    });

    // Remove groups that no longer exist
    existingKeys.forEach(key => {
      if (!newGroupKeys.has(key)) {
        console.log(`[SMART-RENDER] Removing group: ${key}`);
        const elem = groupElementsMap.get(key);
        if (elem && elem.parentNode === groupsWrapper) {
          groupsWrapper.removeChild(elem);
        }
        groupElementsMap.delete(key);
      }
    });
  }

  /**
   * Generates a unique key for a group
   */
  function getGroupKey(group) {
    const name = getGroupName(group);
    return name.trim().toLowerCase();
  }

  /**
   * Updates an existing group element with new data
   */
  function updateGroupElement(groupElem, group) {
    const tasks = getGroupTasks(group);
    const groupName = getGroupName(group);
    const statusKey = groupName.trim().toLowerCase();

    // Update styling
    const accentColor = STATUS_CONFIG.getAccentColor(statusKey);
    groupElem.style.setProperty("--pm-group-accent", accentColor);

    // Update header (task count)
    const header = groupElem.querySelector(".pm-group-header");
    if (header) {
      const pill = header.querySelector(".ngm-pill-value");
      if (pill) {
        pill.textContent = `${tasks.length} tasks`;
      }
    }

    // Update body (reconcile tasks)
    const body = groupElem.querySelector(".pm-group-body");
    if (body) {
      const tbody = body.querySelector("tbody");
      if (tbody) {
        reconcileTasks(tbody, tasks);
      }
    }
  }

  /**
   * Reconciles tasks in a tbody: updates existing, creates new, removes old
   */
  function reconcileTasks(tbody, tasks) {
    // Handle empty state
    if (!tasks.length) {
      // Check if empty row already exists
      const existingEmpty = tbody.querySelector(".pm-empty-row");
      if (!existingEmpty) {
        tbody.innerHTML = "";
        tbody.appendChild(createEmptyRow());
      }
      return;
    }

    // Remove empty row if it exists
    const emptyRow = tbody.querySelector(".pm-empty-row");
    if (emptyRow) {
      tbody.removeChild(emptyRow);
    }

    // Build map of existing rows by taskId
    const existingRowsMap = new Map();
    Array.from(tbody.children).forEach(row => {
      const taskId = row.dataset.taskId;
      if (taskId) {
        existingRowsMap.set(taskId, row);
      }
    });

    // Track which task IDs we're keeping
    const newTaskIds = new Set();

    let updatedCount = 0;
    let createdCount = 0;
    let removedCount = 0;

    // Process each task
    tasks.forEach((task, index) => {
      const taskId = String(task.id || task.task_id || "");
      if (!taskId) return; // Skip tasks without IDs

      newTaskIds.add(taskId);

      if (existingRowsMap.has(taskId)) {
        // Update existing row
        const existingRow = existingRowsMap.get(taskId);
        updateTaskRow(existingRow, task);
        updatedCount++;

        // Ensure correct position
        const currentIndex = Array.from(tbody.children).indexOf(existingRow);
        if (currentIndex !== index) {
          // Move row to correct position
          if (index >= tbody.children.length) {
            tbody.appendChild(existingRow);
          } else {
            tbody.insertBefore(existingRow, tbody.children[index]);
          }
        }
      } else {
        // Create new row
        const newRow = createTaskRow(task);
        createdCount++;

        // Insert at correct position
        if (index >= tbody.children.length) {
          tbody.appendChild(newRow);
        } else {
          tbody.insertBefore(newRow, tbody.children[index]);
        }
      }
    });

    // Remove rows for tasks that no longer exist
    existingRowsMap.forEach((row, taskId) => {
      if (!newTaskIds.has(taskId)) {
        // Close active editor if it's on this row (prevents orphaned state)
        if (row.querySelector('.pm-cell-editing')) {
          window.PM_TableInteractions?.closeActiveEditor?.();
        }
        if (row.parentNode === tbody) {
          tbody.removeChild(row);
          removedCount++;
        }
      }
    });

    if (createdCount > 0 || removedCount > 0) {
      console.log(`[SMART-RENDER] Tasks: updated=${updatedCount}, created=${createdCount}, removed=${removedCount}`);
    }
  }

  /**
   * Updates an existing task row with new data
   */
  function updateTaskRow(tr, task) {
    // Update each visible cell
    VISIBLE_COLUMNS.forEach((col, colIndex) => {
      const td = tr.children[colIndex];
      if (!td) return;

      // Skip cells with active inline editors to avoid destroying them mid-edit.
      // The editor's close handler will update the cell when done.
      if (td.classList.contains("pm-cell-editing")) return;

      const html = Renderers.getCellValue(task, col.key);
      const div = td.querySelector("div");
      if (div) {
        div.innerHTML = html;
      }
    });

    // Update dataset (includes hidden column data)
    storeTaskDataInRow(tr, task);
  }

  /**
   * Filters groups by visibility settings
   */
  function filterVisibleGroups(groups, visibleGroupsMap) {
    return groups.filter(g => {
      const name = (g.status_name || g.group_name || g.name || "").trim().toLowerCase();
      // If status is in visibility map, respect setting; otherwise show by default
      if (name in visibleGroupsMap) return !!visibleGroupsMap[name];
      return true;
    });
  }

  /**
   * Sorts groups by status order
   */
  function sortGroupsByStatus(groups) {
    return [...groups].sort((a, b) => {
      const nameA = (a.status_name || a.group_name || a.name || "").trim().toLowerCase();
      const nameB = (b.status_name || b.group_name || b.name || "").trim().toLowerCase();

      const rankA = STATUS_CONFIG.getRank(nameA);
      const rankB = STATUS_CONFIG.getRank(nameB);

      if (rankA !== rankB) return rankA - rankB;
      return nameA.localeCompare(nameB);
    });
  }

  /**
   * Creates a complete group DOM element
   */
  function createGroupElement(group) {
    const tasks = getGroupTasks(group);
    const groupName = getGroupName(group);
    const statusKey = groupName.trim().toLowerCase();

    // Create main container
    const groupElem = document.createElement("div");
    groupElem.className = "pm-group";

    // Add data-group-key for Smart Re-rendering tracking
    groupElem.dataset.groupKey = statusKey;

    // Apply status-specific styling
    const cssClass = STATUS_CONFIG.getCssClass(statusKey);
    if (cssClass) groupElem.classList.add(cssClass);

    const accentColor = STATUS_CONFIG.getAccentColor(statusKey);
    groupElem.style.setProperty("--pm-group-accent", accentColor);

    // Create and attach header
    const header = createGroupHeader(groupName, tasks.length, accentColor);

    // Create and attach body
    const body = createGroupBody(tasks);

    // Setup collapse functionality
    setupGroupCollapse(header, body);

    groupElem.appendChild(header);
    groupElem.appendChild(body);

    return groupElem;
  }

  /**
   * Extracts tasks array from group object
   */
  function getGroupTasks(group) {
    return Array.isArray(group.tasks) ? group.tasks :
           Array.isArray(group.items) ? group.items :
           Array.isArray(group.tasks_list) ? group.tasks_list :
           [];
  }

  /**
   * Extracts group name from group object
   */
  function getGroupName(group) {
    return group.status_name || group.group_name || group.name || "Group";
  }

  /**
   * Creates group header element
   */
  function createGroupHeader(groupName, taskCount, accentColor) {
    const header = document.createElement("div");
    header.className = "pm-group-header";
    header.innerHTML = `
      <h3 class="section-title" style="color:${accentColor};">
        ${groupName}
      </h3>
      <span class="ngm-pill"><span class="ngm-pill-value">${taskCount} tasks</span></span>
    `;
    return header;
  }

  /**
   * Creates group body (table with tasks)
   */
  function createGroupBody(tasks) {
    const body = document.createElement("div");
    body.className = "pm-group-body";

    const table = createTasksTable(tasks);
    body.appendChild(table);

    return body;
  }

  /**
   * Creates the table element with tasks
   */
  function createTasksTable(tasks) {
    const table = document.createElement("table");
    table.className = "table";

    // Add column groups for proper sizing
    table.insertAdjacentHTML("afterbegin", buildColGroup());

    // Add header
    const thead = createTableHeader();
    table.appendChild(thead);

    // Add body with task rows
    const tbody = createTableBody(tasks);
    table.appendChild(tbody);

    return table;
  }

  /**
   * Creates table header (only visible columns)
   */
  function createTableHeader() {
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        ${VISIBLE_COLUMNS.map(c => `<th data-col="${Utils.escapeHtml(c.key)}">${Utils.escapeHtml(c.label)}</th>`).join("")}
      </tr>
    `;
    return thead;
  }

  /**
   * Creates table body with task rows
   */
  function createTableBody(tasks) {
    const tbody = document.createElement("tbody");

    if (!tasks.length) {
      tbody.appendChild(createEmptyRow());
    } else {
      tasks.forEach(task => {
        tbody.appendChild(createTaskRow(task));
      });
    }

    return tbody;
  }

  /**
   * Creates an input row for empty groups so users can quickly add a task
   */
  function createEmptyRow() {
    const emptyRow = document.createElement("tr");
    emptyRow.className = "pm-empty-row pm-input-row";

    // First cell has the input, rest are empty placeholders
    emptyRow.innerHTML = VISIBLE_COLUMNS.map((col, i) => {
      if (i === 0) {
        return `
          <td data-col="${col.key}" class="pm-input-cell">
            <div>
              <input type="text" class="pm-inline-new-task"
                     placeholder="+ New task..."
                     autocomplete="off" />
            </div>
          </td>`;
      }
      return `<td data-col="${col.key}"><div class="pm-input-cell-empty"></div></td>`;
    }).join("");

    // Bind input behavior
    const input = emptyRow.querySelector(".pm-inline-new-task");
    if (input) {
      input.addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();

        const description = input.value.trim();
        if (!description) return;

        // Get group status from parent .pm-group element
        const groupElem = input.closest(".pm-group");
        const groupKey = groupElem?.dataset?.groupKey || "not started";

        // Disable input while saving
        input.disabled = true;
        input.value = "Creating...";

        try {
          const apiBase = window.API_BASE || "";
          const token = localStorage.getItem("ngmToken");
          const headers = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = "Bearer " + token;

          const res = await fetch(`${apiBase}/pipeline/tasks`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              task_description: description,
              status: groupKey,
            }),
          });

          if (!res.ok) {
            throw new Error(`Server error (${res.status})`);
          }

          if (window.Toast) {
            Toast.success("Task Created", "Task added successfully!");
          }

          // Refresh pipeline
          if (typeof window.fetchPipeline === "function") {
            window.fetchPipeline().catch(() => {});
          }
        } catch (err) {
          console.error("[Pipeline] Quick-add failed:", err);
          if (window.Toast) {
            Toast.error("Create Failed", err.message);
          }
          // Restore input on failure
          input.disabled = false;
          input.value = description;
        }
      });

      // Focus styling
      input.addEventListener("focus", () => {
        emptyRow.classList.add("pm-input-row--active");
      });
      input.addEventListener("blur", () => {
        emptyRow.classList.remove("pm-input-row--active");
      });
    }

    return emptyRow;
  }

  /**
   * Creates a single task row (only visible columns)
   */
  function createTaskRow(task) {
    const tr = document.createElement("tr");
    tr.className = "pm-row";
    tr.dataset.taskId = task.id || task.task_id || "";

    // Check if task is automated
    const isAutomated = task.is_automated ||
      (task.task_notes && task.task_notes.includes('[AUTOMATED]')) ||
      (task.automation_type && task.automation_type !== '');

    if (isAutomated) {
      tr.classList.add('pm-row--automated');
      tr.dataset.automationType = task.automation_type || 'automated';
    }

    // Check if task is a cluster parent (has subtasks)
    const isClusterParent = task.is_cluster_parent || false;
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;

    if (isClusterParent || hasSubtasks) {
      tr.classList.add('pm-row--cluster-parent');
      tr.dataset.clusterExpanded = 'false';
    }

    // Check if task is a subtask
    const isSubtask = task.parent_task_id || task.is_subtask || false;
    if (isSubtask) {
      tr.classList.add('pm-row--subtask');
      tr.dataset.parentTaskId = task.parent_task_id || '';
    }

    // Render only visible columns
    tr.innerHTML = VISIBLE_COLUMNS.map((col, colIndex) => {
      const html = Renderers.getCellValue(task, col.key);

      // Add automation indicator to first column
      let automationIndicator = '';
      if (colIndex === 0 && isAutomated) {
        automationIndicator = `<span class="pm-auto-indicator" title="Tarea Automatizada">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </span>`;
      }

      // Add cluster expand toggle to first column
      let clusterToggle = '';
      if (colIndex === 0 && (isClusterParent || hasSubtasks)) {
        const subtaskCount = task.subtasks ? task.subtasks.length : 0;
        clusterToggle = `<button type="button" class="pm-cluster-toggle" data-task-id="${task.task_id || task.id}">
          <svg class="pm-cluster-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          ${subtaskCount > 0 ? `<span class="pm-cluster-count">${subtaskCount}</span>` : ''}
        </button>`;
      }

      // Add subtask indentation to first column
      let subtaskIndent = '';
      if (colIndex === 0 && isSubtask) {
        subtaskIndent = '<span class="pm-subtask-indent"></span>';
      }

      return `
        <td data-col="${Utils.escapeHtml(col.key)}">
          <div>${colIndex === 0 ? clusterToggle + subtaskIndent + automationIndicator : ''}${html}</div>
        </td>
      `;
    }).join("");

    // Store task data in dataset for future use (includes hidden column data)
    storeTaskDataInRow(tr, task);

    return tr;
  }

  /**
   * Stores task metadata in row dataset
   */
  function storeTaskDataInRow(tr, task) {
    const t = task;

    const taskId = t.task_id || null;
    const taskNotes = t.task_notes || null;
    const companyManagement = t.company_management || null;
    const startDate = t.start_date || null;

    const estimatedHours = (typeof t.estimated_hours === "number")
      ? t.estimated_hours
      : (t.estimated_hours ?? null);

    const docsLink = t.docs_link || null;
    const resultLink = t.result_link || null;

    const priorityId =
      (t.priority && t.priority.priority_id) ||
      t.task_priority ||
      null;

    const finishedStatusId =
      (t.finished_status && t.finished_status.completed_status_id) ||
      t.task_finished_status ||
      null;

    if (taskId) tr.dataset.taskId = String(taskId);
    if (startDate) tr.dataset.startDate = String(startDate);
    if (estimatedHours != null) tr.dataset.estimatedHours = String(estimatedHours);
    if (taskNotes) tr.dataset.taskNotes = String(taskNotes);
    if (docsLink) tr.dataset.docsLink = String(docsLink);
    if (resultLink) tr.dataset.resultLink = String(resultLink);
    if (companyManagement) tr.dataset.companyManagement = String(companyManagement);
    if (priorityId) tr.dataset.priorityId = String(priorityId);
    if (finishedStatusId) tr.dataset.finishedStatusId = String(finishedStatusId);

    // Store additional fields
    if (t.department) tr.dataset.department = String(t.department);
    if (t.type) tr.dataset.type = String(t.type);
    if (t.time_start) tr.dataset.timeStart = String(t.time_start);
    if (t.time_finish) tr.dataset.timeFinish = String(t.time_finish);

    // Store status
    const status = t.status?.name || t.status_name || t.status || '';
    if (status) tr.dataset.status = String(status).toLowerCase();

    // Store due_date and deadline
    const dueDate = t.due_date || t.due || null;
    if (dueDate) tr.dataset.dueDate = String(dueDate);
    if (t.deadline) tr.dataset.deadline = String(t.deadline);

    // Store automation data
    if (t.is_automated) tr.dataset.isAutomated = 'true';
    if (t.automation_type) tr.dataset.automationType = String(t.automation_type);
    if (t.automation_metadata) {
      try {
        tr.dataset.automationMetadata = JSON.stringify(t.automation_metadata);
      } catch (e) {
        // Ignore JSON errors
      }
    }
  }

  /**
   * Sets up group collapse/expand functionality
   */
  function setupGroupCollapse(header, body) {
    let isCollapsed = false;
    header.addEventListener("click", () => {
      isCollapsed = !isCollapsed;
      body.style.display = isCollapsed ? "none" : "";
      header.classList.toggle("pm-group-header--collapsed", isCollapsed);
    });
  }

  /**
   * Sets up cluster (subtask) toggle functionality
   * Delegated event listener for cluster toggle buttons
   */
  function setupClusterToggles() {
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.pm-cluster-toggle');
      if (!toggleBtn) return;

      e.stopPropagation();

      const parentRow = toggleBtn.closest('.pm-row--cluster-parent');
      if (!parentRow) return;

      const taskId = toggleBtn.dataset.taskId || parentRow.dataset.taskId;
      const isExpanded = parentRow.dataset.clusterExpanded === 'true';

      // Toggle expansion state
      parentRow.dataset.clusterExpanded = isExpanded ? 'false' : 'true';

      // Find all subtasks that belong to this parent
      const subtaskRows = document.querySelectorAll(`.pm-row--subtask[data-parent-task-id="${taskId}"]`);
      subtaskRows.forEach(row => {
        if (isExpanded) {
          row.classList.add('pm-subtask-hidden');
        } else {
          row.classList.remove('pm-subtask-hidden');
        }
      });

      console.log(`[PIPELINE] Cluster ${taskId} ${isExpanded ? 'collapsed' : 'expanded'}`);
    });
  }

  // Initialize cluster toggles
  setupClusterToggles();

  // ================================
  // UI Event Listeners
  // ================================

  if (projectFilter) projectFilter.addEventListener("change", renderGroups);
  if (ownerFilter) ownerFilter.addEventListener("change", renderGroups);
  if (priorityFilter) priorityFilter.addEventListener("change", renderGroups);

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderGroups();
    });
  }

  // ================================
  // Global Init
  // ================================

  // ================================
  // ARTURITO COPILOT HANDLERS
  // ================================

  function registerCopilotHandlers() {
    if (typeof ArturitoWidget === 'undefined' || !ArturitoWidget.registerCopilotHandlers) {
      console.log('[PIPELINE] ArturitoWidget not available, skipping copilot registration');
      return;
    }

    ArturitoWidget.registerCopilotHandlers('pipeline.html', {
      // Filter by task status
      filterByStatus: (params) => {
        const status = params.status;
        console.log('[PIPELINE COPILOT] filterByStatus:', status);

        // Status mapping to visible groups
        const statusMap = {
          'todo': 'not started',
          'not_started': 'not started',
          'in_progress': 'working on it',
          'working': 'working on it',
          'review': 'awaiting approval',
          'awaiting_approval': 'awaiting approval',
          'done': 'done',
          'completed': 'done',
        };

        const targetStatus = statusMap[status] || status;

        // Toggle visibility - show only the requested status
        const visibleGroups = getDefaultVisibleGroups();
        Object.keys(visibleGroups).forEach(key => {
          visibleGroups[key] = (key === targetStatus);
        });
        saveVisibleGroups(visibleGroups);
        renderGroups();

        if (typeof Toast !== 'undefined') {
          Toast.success('Filtro aplicado', `Estado: ${targetStatus}`);
        }
      },

      // Filter by assignee/owner
      filterByAssignee: (params) => {
        const userName = params.user_name;
        console.log('[PIPELINE COPILOT] filterByAssignee:', userName);

        if (ownerFilter) {
          // Find matching owner in select options
          const options = Array.from(ownerFilter.options);
          const match = options.find(opt =>
            opt.value.toLowerCase().includes(userName.toLowerCase()) ||
            opt.textContent.toLowerCase().includes(userName.toLowerCase())
          );

          if (match) {
            ownerFilter.value = match.value;
            renderGroups();

            if (typeof Toast !== 'undefined') {
              Toast.success('Filtro aplicado', `Asignado: ${match.textContent}`);
            }
          } else {
            if (typeof Toast !== 'undefined') {
              Toast.error('Usuario no encontrado', userName);
            }
          }
        }
      },

      // Filter by priority
      filterByPriority: (params) => {
        const priority = params.priority;
        console.log('[PIPELINE COPILOT] filterByPriority:', priority);

        if (priorityFilter) {
          // Find matching priority in select options
          const options = Array.from(priorityFilter.options);
          const match = options.find(opt =>
            opt.value.toLowerCase().includes(priority.toLowerCase()) ||
            opt.textContent.toLowerCase().includes(priority.toLowerCase())
          );

          if (match) {
            priorityFilter.value = match.value;
            renderGroups();

            if (typeof Toast !== 'undefined') {
              Toast.success('Filtro aplicado', `Prioridad: ${match.textContent}`);
            }
          } else {
            if (typeof Toast !== 'undefined') {
              Toast.error('Prioridad no encontrada', priority);
            }
          }
        }
      },

      // Filter by project
      filterByProject: (params) => {
        const projectName = params.project_name;
        console.log('[PIPELINE COPILOT] filterByProject:', projectName);

        if (projectFilter) {
          // Find matching project in select options
          const options = Array.from(projectFilter.options);
          const match = options.find(opt =>
            opt.value.toLowerCase().includes(projectName.toLowerCase()) ||
            opt.textContent.toLowerCase().includes(projectName.toLowerCase())
          );

          if (match) {
            projectFilter.value = match.value;
            renderGroups();

            if (typeof Toast !== 'undefined') {
              Toast.success('Filtro aplicado', `Proyecto: ${match.textContent}`);
            }
          } else {
            if (typeof Toast !== 'undefined') {
              Toast.error('Proyecto no encontrado', projectName);
            }
          }
        }
      },

      // Clear all filters
      clearFilters: () => {
        console.log('[PIPELINE COPILOT] clearFilters');

        // Reset all select filters
        if (projectFilter) projectFilter.value = 'all';
        if (ownerFilter) ownerFilter.value = 'all';
        if (priorityFilter) priorityFilter.value = 'all';

        // Clear search
        if (searchInput) {
          searchInput.value = '';
          searchQuery = '';
        }

        // Reset visible groups to show all
        saveVisibleGroups(getDefaultVisibleGroups());

        renderGroups();

        if (typeof Toast !== 'undefined') {
          Toast.success('Filtros limpiados', '');
        }
      },

      // Search text
      searchText: (params) => {
        const query = params.query;
        console.log('[PIPELINE COPILOT] searchText:', query);

        if (searchInput) {
          searchInput.value = query;
          searchQuery = query.toLowerCase();
          renderGroups();

          if (typeof Toast !== 'undefined') {
            Toast.success('Busqueda aplicada', query);
          }
        }
      },
    });

    console.log('[PIPELINE] Copilot handlers registered');
  }

  // ================================
  // Global Init
  // ================================

  window.addEventListener("DOMContentLoaded", () => {
    // Check authentication first
    if (!initAuth()) return;

    console.log("[PIPELINE] DOMContentLoaded - initializing...");

    // Initialize topbar pills (environment, server status)
    if (typeof window.initTopbarPills === "function") {
      window.initTopbarPills();
    }

    // Initialize topbar user pill
    try {
      if (typeof initTopbarUserPill === "function") {
        initTopbarUserPill();
      }
    } catch (err) {
      console.warn("[TOPBAR] initTopbarUserPill failed:", err);
    }

    // NOTE: Sidebar is automatically initialized by sidebar.js

    // Fetch pipeline data and render
    if (typeof fetchPipeline === "function") {
      fetchPipeline();
    }

    // Initialize layout controls modal
    initLayoutControls();

    if (typeof initTableWidthSlider === "function") {
      initTableWidthSlider();
    }

    // Register Arturito copilot handlers
    registerCopilotHandlers();
  });

})();
