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

      // Populate columns checkboxes dynamically
      const visibleMap = loadVisibleCols(COLUMNS);
      buildColumnsModal(COLUMNS, visibleMap);

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

      const newMap = readColumnsModalState(COLUMNS);
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
  const COLUMNS = [
    { key: "task", label: "Task" },
    { key: "project", label: "Project" },
    { key: "owner", label: "Owner" },
    { key: "collaborator", label: "Collaborator" },
    { key: "manager", label: "Manager" },
    { key: "company", label: "Company" },
    { key: "department", label: "Department" },
    { key: "type", label: "Type" },
    { key: "time_start", label: "Time Start" },
    { key: "time_finish", label: "Time Finish" },
    { key: "start", label: "Start" },
    { key: "est", label: "Est (h)" },
    { key: "priority", label: "Priority" },
    { key: "finished", label: "Finished" },
    { key: "due", label: "Due" },
    { key: "links", label: "Links" },
  ];

  // ================================
  // Column Layout (shared by all tables)
  // ================================

  function buildColGroup() {
    return `
      <colgroup>
        ${COLUMNS.map(col => `<col data-col="${col.key}">`).join("")}
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

  function getDefaultVisibleCols(COLUMNS) {
    const map = {};
    COLUMNS.forEach(c => (map[c.key] = true));
    return map;
  }

  function loadVisibleCols(COLUMNS) {
    try {
      const raw = localStorage.getItem(PM_COLS_STORAGE_KEY);
      if (!raw) return getDefaultVisibleCols(COLUMNS);

      const parsed = JSON.parse(raw);
      const merged = getDefaultVisibleCols(COLUMNS);

      Object.keys(parsed || {}).forEach(k => {
        if (k in merged) merged[k] = !!parsed[k];
      });

      return merged;
    } catch (e) {
      console.warn("[PIPELINE] loadVisibleCols failed:", e);
      return getDefaultVisibleCols(COLUMNS);
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

  function buildColumnsModal(COLUMNS, visibleMap) {
    const list = document.getElementById("pm-columns-list");
    if (!list) return;

    list.innerHTML = COLUMNS.map(c => `
      <label class="pm-checkbox">
        <input type="checkbox" data-col="${c.key}" ${visibleMap[c.key] ? "checked" : ""} />
        <span>${c.label}</span>
      </label>
    `).join("");
  }

  function readColumnsModalState(COLUMNS) {
    const list = document.getElementById("pm-columns-list");
    const map = {};
    COLUMNS.forEach(c => (map[c.key] = true));

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

  // Expose fetchPipeline to window for modal refresh
  window.fetchPipeline = fetchPipeline;

  async function fetchPipeline() {
    try {
      // Fallback if API_BASE is not defined yet
      const apiBase = window.API_BASE || "https://ngm-fastapi.onrender.com";

      console.log("[PIPELINE] fetchPipeline called");
      console.log("[PIPELINE] API_BASE:", window.API_BASE);
      console.log("[PIPELINE] Using apiBase:", apiBase);
      console.log("[PIPELINE] Fetching from:", `${apiBase}/pipeline/grouped`);

      const res = await fetch(`${apiBase}/pipeline/grouped`, {
        credentials: "include"
      });

      console.log("[PIPELINE] Response status:", res.status, res.statusText);

      if (!res.ok) throw new Error(`Error loading pipeline: ${res.status} ${res.statusText}`);
      const data = await res.json();

      console.log("[PIPELINE] raw response:", data);

      if (Array.isArray(data)) {
        rawGroups = data;
      } else if (Array.isArray(data.groups)) {
        rawGroups = data.groups;
      } else if (data.groups && typeof data.groups === "object") {
        // FastAPI grouped by status
        rawGroups = Object.entries(data.groups).map(([status, tasks]) => ({
          status_name: status,
          tasks: Array.isArray(tasks) ? tasks : [],
        }));
      } else if (typeof data === "object") {
        // Ultra defensive fallback
        rawGroups = Object.entries(data).map(([status, tasks]) => ({
          status_name: status,
          tasks: Array.isArray(tasks) ? tasks : [],
        }));
      } else {
        rawGroups = [];
      }

      console.log("[PIPELINE] parsed groups:", rawGroups);

      populateFilters(rawGroups);
      renderGroups();
    } catch (err) {
      console.error("[PIPELINE] fetch error:", err);
      if (groupsWrapper) {
        groupsWrapper.innerHTML = "<p class='panel-text'>Error loading pipeline data.</p>";
      }
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

    return groups.map(group => {
      const tasks = Array.isArray(group.tasks) ? group.tasks : [];
      const filteredTasks = tasks.filter(t => {
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
  // Render Groups
  // ================================

  function renderGroups() {
    if (!groupsWrapper) return;

    const groups = applyFilters(rawGroups);
    console.log("[PIPELINE] rendering groups:", groups);

    groupsWrapper.innerHTML = "";

    if (!groups.length) {
      groupsWrapper.innerHTML = "<p class='panel-text'>No pipeline groups to display.</p>";
      return;
    }

    function escapeHtml(s) {
      return String(s)
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

    function hashStringToHue(str) {
      let h = 0;
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return h % 360;
    }

    function renderPerson(name) {
      const raw = String(name || "").trim();
      const safeName = escapeHtml(raw || "-");
      const initial = escapeHtml(getInitial(raw || "-"));

      const key = raw ? raw.toLowerCase() : "__unknown__";
      const hue = hashStringToHue(key);

      const bg = raw ? `hsl(${hue} 55% 35%)` : "#334155";
      const ring = raw ? `hsl(${hue} 65% 55%)` : "rgba(148, 163, 184, 0.6)";

      return `
        <span class="pm-person" title="${safeName}">
          <span class="pm-avatar" style="--av-bg:${bg}; --av-ring:${ring};">${initial}</span>
          <span class="pm-person-name">${safeName}</span>
        </span>
      `;
    }

    function formatMaybeDate(v) {
      if (!v) return "-";
      const s = String(v);
      // 2025-12-07T06:21:42.156005Z -> 2025-12-07
      if (s.includes("T")) return s.split("T")[0];
      return s;
    }

    function getCellValue(t, key) {
      switch (key) {
        case "task":
          return escapeHtml(t.task_description || t.title || "(No description)");

        case "project":
          return escapeHtml(
            t.project_name ||
            t.project ||
            t.project_title ||
            t.project_id ||
            "-"
          );

        case "owner": {
          const name =
            (t.owner && (t.owner.name || t.owner.username || t.owner.email)) ||
            t.owner_name ||
            t.assigned_to ||
            "";
          return renderPerson(name || "-");
        }

        case "collaborator": {
          const name =
            (Array.isArray(t.collaborators) &&
              t.collaborators.length > 0 &&
              (t.collaborators[0].name || t.collaborators[0].id)) ||
            "";
          return renderPerson(name || "-");
        }

        case "manager": {
          const name =
            (t.manager && (t.manager.name || t.manager.username || t.manager.email)) ||
            t.manager_name ||
            "";
          return renderPerson(name || "-");
        }

        case "company":
          return escapeHtml(t.company_name || "-");

        case "department":
          return escapeHtml(t.department || "-");

        case "type":
          return escapeHtml(t.type || "-");

        case "time_start":
          return escapeHtml(t.time_start || "-");

        case "time_finish":
          return escapeHtml(t.time_finish || "-");

        case "start":
          return escapeHtml(formatMaybeDate(t.start_date));

        case "est": {
          const v = (typeof t.estimated_hours === "number")
            ? t.estimated_hours
            : (t.estimated_hours ?? null);
          return escapeHtml(v != null ? v : "-");
        }

        case "priority":
          return escapeHtml(
            (t.priority && (t.priority.priority_name || t.priority.priority_id)) ||
            t.priority_name ||
            t.priority ||
            "-"
          );

        case "finished":
          return escapeHtml(
            (t.finished_status &&
              (t.finished_status.completed_status_name ||
              t.finished_status.completed_status_id)) ||
            t.finished_status_name ||
            "-"
          );

        case "due":
          return escapeHtml(formatMaybeDate(t.due_date || t.deadline || t.due));

        case "links": {
          const docsLink = t.docs_link || null;
          const resultLink = t.result_link || null;

          if (!docsLink && !resultLink) return "-";

          const parts = [];
          if (docsLink) {
            parts.push(`<a href="${escapeHtml(docsLink)}" target="_blank" rel="noopener noreferrer">Docs</a>`);
          }
          if (resultLink) {
            parts.push(`<a href="${escapeHtml(resultLink)}" target="_blank" rel="noopener noreferrer">Result</a>`);
          }
          return parts.join(" · ");
        }

        default:
          return "-";
      }
    }

    // Status color mapping
    const STATUS_ACCENTS = {
      "working on it": "#3b82f6",
      "done": "#22c55e",
      "correction": "#f87171",
      "awaiting approval": "#fb923c",
      "resubmittal needed": "#eab308",
      "good to go": "#10b981",
      "not started": "#facc15",
      "delayed": "#a855f7",
    };

    // Status CSS class mapping
    const STATUS_CLASS_MAP = {
      "working on it": "pm-group--working-on-it",
      "done": "pm-group--done",
      "correction": "pm-group--correction",
      "awaiting approval": "pm-group--awaiting-approval",
      "resubmittal needed": "pm-group--resubmittal-needed",
      "good to go": "pm-group--good-to-go",
      "not started": "pm-group--not-started",
      "delayed": "pm-group--delayed",
    };

    // Status order
    const STATUS_ORDER = [
      "not started",
      "working on it",
      "awaiting approval",
      "good to go",
      "correction",
      "resubmittal needed",
      "done",
      "delayed",
    ];
    const STATUS_RANK = {};
    STATUS_ORDER.forEach((name, idx) => { STATUS_RANK[name] = idx; });

    const visibleGroupsMap = loadVisibleGroups();

    const filteredGroups = groups.filter(g => {
      const name = (g.status_name || g.group_name || g.name || "").trim().toLowerCase();
      if (name in visibleGroupsMap) return !!visibleGroupsMap[name];
      return true;
    });

    const sortedGroups = [...filteredGroups].sort((a, b) => {
      const nameA = (a.status_name || a.group_name || a.name || "").trim().toLowerCase();
      const nameB = (b.status_name || b.group_name || b.name || "").trim().toLowerCase();

      const rankA = STATUS_RANK[nameA] ?? 999;
      const rankB = STATUS_RANK[nameB] ?? 999;

      if (rankA !== rankB) return rankA - rankB;
      return nameA.localeCompare(nameB);
    });

    // Render each group
    sortedGroups.forEach(group => {
      const tasks =
        Array.isArray(group.tasks) ? group.tasks :
        Array.isArray(group.items) ? group.items :
        Array.isArray(group.tasks_list) ? group.tasks_list :
        [];

      const groupName =
        group.status_name ||
        group.group_name ||
        group.name ||
        "Group";

      const groupElem = document.createElement("div");
      groupElem.className = "pm-group";

      const statusKey = groupName.trim().toLowerCase();

      const cssClass = STATUS_CLASS_MAP[statusKey];
      if (cssClass) groupElem.classList.add(cssClass);

      const accentColor = STATUS_ACCENTS[statusKey] || "#3e4042";
      groupElem.style.setProperty("--pm-group-accent", accentColor);

      const header = document.createElement("div");
      header.className = "pm-group-header";
      header.innerHTML = `
        <h3 class="section-title" style="color:${accentColor};">
          ${groupName}
        </h3>
        <span class="ngm-pill"><span class="ngm-pill-value">${tasks.length} tasks</span></span>
      `;

      const body = document.createElement("div");
      body.className = "pm-group-body";

      let isCollapsed = false;
      header.addEventListener("click", () => {
        isCollapsed = !isCollapsed;
        body.style.display = isCollapsed ? "none" : "";
        header.classList.toggle("pm-group-header--collapsed", isCollapsed);
      });

      const table = document.createElement("table");
      table.className = "table";

      table.insertAdjacentHTML("afterbegin", buildColGroup());

      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          ${COLUMNS.map(c => `<th data-col="${escapeHtml(c.key)}">${escapeHtml(c.label)}</th>`).join("")}
        </tr>
      `;
      table.appendChild(thead);

      const tbody = document.createElement("tbody");

      if (!tasks.length) {
        const emptyRow = document.createElement("tr");
        emptyRow.className = "pm-empty-row";
        emptyRow.innerHTML = `
          <td colspan="${COLUMNS.length}" class="pm-empty-cell">
            <div>No tasks in this group for the current filters.</div>
          </td>
        `;
        tbody.appendChild(emptyRow);
      } else {
        tasks.forEach(t => {
          const tr = document.createElement("tr");
          tr.className = "pm-row";
          tr.dataset.taskId = t.id || t.task_id || "";

          tr.innerHTML = COLUMNS.map(col => {
            const html = getCellValue(t, col.key);
            return `
              <td data-col="${escapeHtml(col.key)}">
                <div>${html}</div>
              </td>
            `;
          }).join("");

          // Store task data in dataset for future use
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

          tbody.appendChild(tr);
        });
      }

      table.appendChild(tbody);
      body.appendChild(table);

      groupElem.appendChild(header);
      groupElem.appendChild(body);
      groupsWrapper.appendChild(groupElem);
    });

    applyVisibleColsToTables(loadVisibleCols(COLUMNS));
  }

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
  });

})();
