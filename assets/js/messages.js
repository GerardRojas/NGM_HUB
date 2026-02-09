/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  NGM HUB — Messages Module
 * ═══════════════════════════════════════════════════════════════════════════
 *  Chat system with:
 *  - Project-based channels (General, Accounting, Receipts)
 *  - Custom channels
 *  - Direct messages
 *  - Threads, @mentions, reactions
 *  - File attachments
 *  - Real-time updates via Supabase
 * ═══════════════════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIG & STATE
  // ─────────────────────────────────────────────────────────────────────────
  const API_BASE = window.API_BASE || window.NGM_CONFIG?.API_BASE || "http://localhost:3000";
  const SUPABASE_URL = window.SUPABASE_URL || window.NGM_CONFIG?.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.NGM_CONFIG?.SUPABASE_ANON_KEY || "";
  // Helper function to get auth headers with JWT token
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Helper function for authenticated fetch calls
  async function authFetch(url, options = {}) {
    const headers = {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    };
    return fetch(url, {
      ...options,
      credentials: "include",
      headers,
    });
  }

  const state = {
    currentUser: null,
    users: [],
    projects: [],
    channels: [],
    currentChannel: null,
    messages: [],
    replyingTo: null,
    attachments: [],
    typingUsers: new Set(),
    supabaseClient: null,
    messageSubscription: null,
    typingSubscription: null,
    lastTypingBroadcast: 0,
    renderDebounceTimer: null,
    activeCheckFlow: null, // { receiptId, state } when a check flow conversation is active
    activeDuplicateFlow: null, // { receiptId } when a duplicate confirmation is active
    activeReceiptFlow: null, // { receiptId, state } when a receipt split flow is active
  };

  // Debounced render to prevent rapid re-renders causing flicker
  function debouncedRenderMessages(immediate = false) {
    if (state.renderDebounceTimer) {
      clearTimeout(state.renderDebounceTimer);
    }
    if (immediate) {
      renderMessagesInternal();
    } else {
      state.renderDebounceTimer = setTimeout(() => {
        renderMessagesInternal();
      }, 50); // Small delay to batch rapid updates
    }
  }

  // Channel types
  const CHANNEL_TYPES = {
    PROJECT_GENERAL: "project_general",
    PROJECT_ACCOUNTING: "project_accounting",
    PROJECT_RECEIPTS: "project_receipts",
    CUSTOM: "custom",
    DIRECT: "direct",
    GROUP: "group",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // LOCAL CACHE SYSTEM - For instant loading like Google Chat
  // ─────────────────────────────────────────────────────────────────────────
  const CACHE_KEYS = {
    USERS: "ngm_cache_users",
    PROJECTS: "ngm_cache_projects",
    CHANNELS: "ngm_cache_channels",
    CURRENT_USER: "ngm_cache_current_user",
    LAST_CHANNEL: "ngm_last_channel",
  };
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache validity

  function saveToCache(key, data) {
    try {
      const cacheItem = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn("[Messages] Cache save failed:", e);
    }
  }

  function loadFromCache(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const cacheItem = JSON.parse(cached);
      // Check if cache is still valid (within TTL)
      if (Date.now() - cacheItem.timestamp < CACHE_TTL) {
        return cacheItem.data;
      }
      // Cache expired but still return it for instant display
      // Fresh data will replace it shortly
      return cacheItem.data;
    } catch (e) {
      return null;
    }
  }

  function clearCache() {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM REFERENCES
  // ─────────────────────────────────────────────────────────────────────────
  const DOM = {};

  function cacheDOMReferences() {
    // Channels sidebar
    DOM.projectChannels = document.getElementById("projectChannels");
    DOM.groupChannels = document.getElementById("groupChannels");
    DOM.directMessages = document.getElementById("directMessages");
    DOM.customChannels = document.getElementById("customChannels");
    DOM.channelSearchInput = document.getElementById("channelSearchInput");

    // Chat area
    DOM.chatName = document.getElementById("chatName");
    DOM.chatDescription = document.getElementById("chatDescription");
    DOM.messagesContainer = document.getElementById("messagesContainer");
    DOM.messagesList = document.getElementById("messagesList");
    DOM.emptyState = document.getElementById("emptyState");
    DOM.chatLoading = document.getElementById("chatLoading");
    DOM.messageInputArea = document.getElementById("messageInputArea");
    DOM.messageInput = document.getElementById("messageInput");
    DOM.btnSendMessage = document.getElementById("btnSendMessage");
    DOM.typingIndicator = document.getElementById("typingIndicator");
    DOM.typingText = document.getElementById("typingText");

    // Attachments
    DOM.attachmentsPreview = document.getElementById("attachmentsPreview");
    DOM.btnAttachFile = document.getElementById("btnAttachFile");

    // Reply
    DOM.replyPreview = document.getElementById("replyPreview");
    DOM.replyAuthor = document.getElementById("replyAuthor");
    DOM.replyText = document.getElementById("replyText");
    DOM.btnCancelReply = document.getElementById("btnCancelReply");

    // Mention dropdown
    DOM.mentionDropdown = document.getElementById("mentionDropdown");

    // Thread panel
    DOM.threadPanel = document.getElementById("threadPanel");
    DOM.threadOriginal = document.getElementById("threadOriginal");
    DOM.threadReplies = document.getElementById("threadReplies");
    DOM.threadInput = document.getElementById("threadInput");
    DOM.btnSendThreadReply = document.getElementById("btnSendThreadReply");
    DOM.btnCloseThread = document.getElementById("btnCloseThread");
    DOM.btnToggleThread = document.getElementById("btnToggleThread");

    // Header buttons
    DOM.btnNewChannel = document.getElementById("btnNewChannel");
    DOM.btnSearchMessages = document.getElementById("btnSearchMessages");
    DOM.btnChannelInfo = document.getElementById("btnChannelInfo");

    // Mobile navigation
    DOM.btnMobileMenu = document.getElementById("btnMobileMenu");
    DOM.sidebarOverlay = document.getElementById("sidebarOverlay");

    // Modals
    DOM.newChannelModal = document.getElementById("newChannelModal");
    DOM.channelInfoModal = document.getElementById("channelInfoModal");
    DOM.searchMessagesModal = document.getElementById("searchMessagesModal");
    DOM.manageProjectChannelsModal = document.getElementById("manageProjectChannelsModal");

    // Global search
    DOM.globalSearchInput = document.getElementById("messages-search-input");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION - Optimized for instant loading like Google Chat
  // ─────────────────────────────────────────────────────────────────────────
  async function init() {
    console.log("[Messages] Initializing with optimized loading...");
    const startTime = performance.now();
    cacheDOMReferences();

    try {
      // PHASE 1: Load cached data INSTANTLY (no network wait)
      const cachedUser = loadFromCache(CACHE_KEYS.CURRENT_USER);
      const cachedUsers = loadFromCache(CACHE_KEYS.USERS);
      const cachedProjects = loadFromCache(CACHE_KEYS.PROJECTS);
      const cachedChannels = loadFromCache(CACHE_KEYS.CHANNELS);

      // If we have cached data, render UI immediately
      if (cachedUser && cachedUsers && cachedProjects) {
        state.currentUser = cachedUser;
        state.users = cachedUsers;
        state.projects = cachedProjects;
        state.channels = cachedChannels || [];

        // Render channels INSTANTLY from cache
        renderChannels();
        setupEventListeners();
        initSectionCollapsedStates();
        hidePageLoading();
        console.log(`[Messages] Instant render from cache in ${(performance.now() - startTime).toFixed(0)}ms`);
      }

      // PHASE 2: Fetch fresh data IN PARALLEL (background refresh)
      const fetchStart = performance.now();
      const [freshUser, freshUsers, freshProjects, freshChannels] = await Promise.all([
        loadCurrentUser(),
        loadUsers(),
        loadProjects(),
        loadChannels(),
      ]);

      console.log(`[Messages] Parallel API fetch completed in ${(performance.now() - fetchStart).toFixed(0)}ms`);

      // Ensure required group channels exist (auto-create Payroll etc.)
      await ensureGroupChannels();
      // Always re-render groups after ensure (may have created new ones)
      renderGroups();
      // Update cache with any newly created groups
      saveToCache(CACHE_KEYS.CHANNELS, state.channels);

      // PHASE 3: Update UI only if data changed (avoid unnecessary re-renders)
      const dataChanged = !cachedUser || !cachedUsers || !cachedProjects ||
                          JSON.stringify(state.projects) !== JSON.stringify(cachedProjects) ||
                          JSON.stringify(state.channels) !== JSON.stringify(cachedChannels);

      if (dataChanged) {
        renderChannels();
        if (!cachedUser) {
          // First load (no cache) - setup everything
          setupEventListeners();
          initSectionCollapsedStates();
          hidePageLoading();
        }
      }

      // Load mentions badge (non-blocking)
      loadMentionsBadge();

      // Initialize Supabase Realtime
      initSupabaseRealtime();

      console.log(`[Messages] Total init time: ${(performance.now() - startTime).toFixed(0)}ms`);
    } catch (err) {
      console.error("[Messages] Init error:", err);
      showToast("Failed to initialize messages", "error");
      hidePageLoading();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING - With caching for instant subsequent loads
  // ─────────────────────────────────────────────────────────────────────────
  async function loadCurrentUser() {
    try {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      state.currentUser = data.user || data;
      // Save to cache for instant loading next time
      saveToCache(CACHE_KEYS.CURRENT_USER, state.currentUser);
      console.log("[Messages] Current user:", state.currentUser.user_name);
      return state.currentUser;
    } catch (err) {
      console.error("[Messages] Failed to load current user:", err);
      // Fallback for development
      state.currentUser = { user_id: "dev-uuid", user_name: "Dev User", email: "dev@ngm.com" };
      return state.currentUser;
    }
  }

  async function loadUsers() {
    try {
      const res = await authFetch(`${API_BASE}/team/users`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      state.users = data.users || data || [];
      // Save to cache
      saveToCache(CACHE_KEYS.USERS, state.users);
      console.log("[Messages] Loaded", state.users.length, "users");
      return state.users;
    } catch (err) {
      console.error("[Messages] Failed to load users:", err);
      state.users = [];
      return state.users;
    }
  }

  async function loadProjects() {
    try {
      const res = await authFetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      // API returns { data: [...] } or { projects: [...] } or array directly
      const projects = data.data || data.projects || data;
      state.projects = Array.isArray(projects) ? projects : [];
      // Save to cache
      saveToCache(CACHE_KEYS.PROJECTS, state.projects);
      console.log("[Messages] Loaded", state.projects.length, "projects");
      return state.projects;
    } catch (err) {
      console.error("[Messages] Failed to load projects:", err);
      state.projects = [];
      return state.projects;
    }
  }

  async function loadChannels() {
    try {
      const res = await authFetch(`${API_BASE}/messages/channels`);
      if (!res.ok) {
        console.warn("[Messages] Channels API not available, using defaults");
        state.channels = [];
        return state.channels;
      }
      const data = await res.json();
      state.channels = data.channels || data || [];
      // Save to cache
      saveToCache(CACHE_KEYS.CHANNELS, state.channels);
      console.log("[Messages] Loaded", state.channels.length, "custom channels");
      return state.channels;
    } catch (err) {
      console.warn("[Messages] Failed to load channels:", err);
      state.channels = [];
      return state.channels;
    }
  }

  async function loadMessages(channelType, channelId, projectId) {
    try {
      // Build query params based on channel type
      let url = `${API_BASE}/messages?channel_type=${channelType}`;

      if (channelType.startsWith("project_")) {
        // Project channels use project_id
        url += `&project_id=${projectId}`;
      } else {
        // Custom and direct channels use channel_id
        url += `&channel_id=${channelId}`;
      }

      const res = await authFetch(url);
      if (!res.ok) {
        console.warn("[Messages] Messages API not available");
        return [];
      }
      const data = await res.json();
      return data.messages || data || [];
    } catch (err) {
      console.warn("[Messages] Failed to load messages:", err);
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL RENDERING
  // ─────────────────────────────────────────────────────────────────────────
  function renderChannels() {
    renderProjectChannels();
    renderGroups();
    renderDirectMessages();
    renderCustomChannels();
  }

  // Project colors for sidebar
  const PROJECT_COLORS = [
    '#3ecf8e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
    '#eab308', '#84cc16', '#22c55e'
  ];

  function getProjectColor(projectId) {
    const colors = JSON.parse(localStorage.getItem('ngm_project_colors') || '{}');
    return colors[projectId] || PROJECT_COLORS[Math.abs(hashCode(projectId)) % PROJECT_COLORS.length];
  }

  function setProjectColor(projectId, color) {
    const colors = JSON.parse(localStorage.getItem('ngm_project_colors') || '{}');
    colors[projectId] = color;
    localStorage.setItem('ngm_project_colors', JSON.stringify(colors));
  }

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  // Store for project channel configurations (which channels each project has enabled)
  // Default channels: General (always), Receipts (always, cannot be deleted)
  // Optional channels: Accounting (can be added/removed)
  const DEFAULT_PROJECT_CHANNELS = ["general", "receipts"];
  const OPTIONAL_PROJECT_CHANNELS = [
    { key: "accounting", label: "Accounting", type: CHANNEL_TYPES.PROJECT_ACCOUNTING }
  ];

  function getProjectChannelConfig(projectId) {
    try {
      const configs = JSON.parse(localStorage.getItem("ngm_project_channel_configs") || "{}");
      return configs[projectId] || { channels: [...DEFAULT_PROJECT_CHANNELS] };
    } catch (e) {
      return { channels: [...DEFAULT_PROJECT_CHANNELS] };
    }
  }

  function saveProjectChannelConfig(projectId, config) {
    try {
      const configs = JSON.parse(localStorage.getItem("ngm_project_channel_configs") || "{}");
      configs[projectId] = config;
      localStorage.setItem("ngm_project_channel_configs", JSON.stringify(configs));
    } catch (e) {
      console.warn("[Messages] Failed to save channel config:", e);
    }
  }

  // Collapsed state for project groups
  function getProjectCollapsedState(projectId) {
    try {
      const states = JSON.parse(localStorage.getItem("ngm_project_collapsed_states") || "{}");
      return states[projectId] === true;
    } catch (e) {
      return false;
    }
  }

  function setProjectCollapsedState(projectId, isCollapsed) {
    try {
      const states = JSON.parse(localStorage.getItem("ngm_project_collapsed_states") || "{}");
      states[projectId] = isCollapsed;
      localStorage.setItem("ngm_project_collapsed_states", JSON.stringify(states));
    } catch (e) {
      console.warn("[Messages] Failed to save collapsed state:", e);
    }
  }

  function toggleProjectCollapse(projectId) {
    const isCollapsed = getProjectCollapsedState(projectId);
    setProjectCollapsedState(projectId, !isCollapsed);

    // Update UI
    const projectGroup = document.querySelector(`.msg-project-group[data-project-id="${projectId}"]`);
    if (projectGroup) {
      projectGroup.classList.toggle("collapsed", !isCollapsed);
      const chevron = projectGroup.querySelector(".msg-project-chevron");
      if (chevron) {
        chevron.classList.toggle("collapsed", !isCollapsed);
      }
    }
  }

  // Main section collapse state (Projects, Direct Messages, Custom Channels)
  function getSectionCollapsedState(sectionName) {
    try {
      const states = JSON.parse(localStorage.getItem("ngm_section_collapsed_states") || "{}");
      return states[sectionName] === true;
    } catch (e) {
      return false;
    }
  }

  function setSectionCollapsedState(sectionName, isCollapsed) {
    try {
      const states = JSON.parse(localStorage.getItem("ngm_section_collapsed_states") || "{}");
      states[sectionName] = isCollapsed;
      localStorage.setItem("ngm_section_collapsed_states", JSON.stringify(states));
    } catch (e) {
      console.warn("[Messages] Failed to save section collapsed state:", e);
    }
  }

  function toggleSectionCollapse(sectionName) {
    const isCollapsed = getSectionCollapsedState(sectionName);
    setSectionCollapsedState(sectionName, !isCollapsed);

    // Update UI
    const sectionHeader = document.querySelector(`.msg-channel-section-header[data-section="${sectionName}"]`);
    if (sectionHeader) {
      const section = sectionHeader.closest(".msg-channel-section");
      if (section) {
        section.classList.toggle("collapsed", !isCollapsed);
      }
      const chevron = sectionHeader.querySelector(".msg-section-chevron");
      if (chevron) {
        chevron.classList.toggle("collapsed", !isCollapsed);
      }
    }
  }

  function initSectionCollapsedStates() {
    // Apply saved collapsed states on init
    ["projects", "groups", "direct", "custom"].forEach(sectionName => {
      const isCollapsed = getSectionCollapsedState(sectionName);
      if (isCollapsed) {
        const sectionHeader = document.querySelector(`.msg-channel-section-header[data-section="${sectionName}"]`);
        if (sectionHeader) {
          const section = sectionHeader.closest(".msg-channel-section");
          if (section) {
            section.classList.add("collapsed");
          }
          const chevron = sectionHeader.querySelector(".msg-section-chevron");
          if (chevron) {
            chevron.classList.add("collapsed");
          }
        }
      }
    });
  }

  function renderProjectChannels() {
    if (!DOM.projectChannels) return;

    if (state.projects.length === 0) {
      DOM.projectChannels.innerHTML = `
        <div class="msg-channel-empty">No projects available</div>
      `;
      return;
    }

    let html = "";
    state.projects.forEach((project) => {
      const projectName = project.project_name || "Unnamed";
      const projectId = project.project_id;
      const projectColor = getProjectColor(projectId);
      const channelConfig = getProjectChannelConfig(projectId);
      const isCollapsed = getProjectCollapsedState(projectId);

      html += `
        <div class="msg-project-group${isCollapsed ? ' collapsed' : ''}" data-project-id="${projectId}">
          <div class="msg-project-header" data-project-id="${projectId}">
            <span class="msg-project-chevron${isCollapsed ? ' collapsed' : ''}" data-project-id="${projectId}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
            <span class="msg-project-color-dot"
                  data-project-id="${projectId}"
                  style="border-color: ${projectColor}; color: ${projectColor};"
                  title="Click to change color"></span>
            <span class="msg-project-name">${escapeHtml(projectName)}</span>
            <button type="button" class="msg-project-settings-btn"
                    data-project-id="${projectId}"
                    data-project-name="${escapeHtml(projectName)}"
                    title="Manage channels">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
          <div class="msg-project-channels">
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_GENERAL}"
                    data-project-id="${projectId}"
                    data-channel-name="General">
              <span class="msg-channel-dot" style="border-color: ${projectColor};"></span>
              <span class="msg-channel-name">General</span>
            </button>
            ${channelConfig.channels.includes("accounting") ? `
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_ACCOUNTING}"
                    data-project-id="${projectId}"
                    data-channel-name="Accounting">
              <span class="msg-channel-dot" style="border-color: ${projectColor};"></span>
              <span class="msg-channel-name">Accounting</span>
            </button>
            ` : ""}
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_RECEIPTS}"
                    data-project-id="${projectId}"
                    data-channel-name="Receipts">
              <span class="msg-channel-dot" style="border-color: ${projectColor};"></span>
              <span class="msg-channel-name">Receipts</span>
            </button>
          </div>
        </div>
      `;
    });

    DOM.projectChannels.innerHTML = html;
  }

  function showProjectColorPicker(dotElement, projectId) {
    // Remove any existing picker
    document.querySelector(".msg-color-picker-popup")?.remove();

    // Create color picker popup
    const popup = document.createElement("div");
    popup.className = "msg-color-picker-popup";

    let colorsHtml = PROJECT_COLORS.map(color => `
      <button type="button" class="msg-color-option"
              data-color="${color}"
              style="background-color: ${color};"
              title="${color}"></button>
    `).join('');

    popup.innerHTML = `
      <div class="msg-color-picker-grid">
        ${colorsHtml}
      </div>
    `;

    // Position popup near the dot
    const rect = dotElement.getBoundingClientRect();
    popup.style.position = "fixed";
    popup.style.left = `${rect.right + 8}px`;
    popup.style.top = `${rect.top - 4}px`;
    popup.style.zIndex = "1000";

    // Handle color selection
    popup.addEventListener("click", (e) => {
      const colorBtn = e.target.closest(".msg-color-option");
      if (colorBtn) {
        const newColor = colorBtn.dataset.color;
        setProjectColor(projectId, newColor);
        // Update the project dot ring color
        dotElement.style.borderColor = newColor;
        dotElement.style.color = newColor;
        // Update all dots with same project ID (both project dots and channel dots)
        document.querySelectorAll(`.msg-project-color-dot[data-project-id="${projectId}"]`)
          .forEach(dot => {
            dot.style.borderColor = newColor;
            dot.style.color = newColor;
          });
        // Update channel dots under this project
        const projectGroup = document.querySelector(`.msg-project-group[data-project-id="${projectId}"]`);
        if (projectGroup) {
          projectGroup.querySelectorAll('.msg-channel-dot')
            .forEach(dot => dot.style.borderColor = newColor);
        }
        popup.remove();
      }
    });

    document.body.appendChild(popup);
  }

  function renderDirectMessages() {
    if (!DOM.directMessages) return;

    const directChannels = state.channels.filter(
      (c) => c.type === CHANNEL_TYPES.DIRECT
    );

    if (directChannels.length === 0) {
      DOM.directMessages.innerHTML = `
        <div class="msg-channel-empty">No direct messages yet</div>
      `;
      return;
    }

    let html = "";
    directChannels.forEach((channel) => {
      const otherUser = getOtherUserInDM(channel);
      const userName = otherUser?.user_name || "Unknown";
      const avatarColor = getAvatarColor(otherUser);
      const initials = getInitials(userName);

      html += `
        <button type="button" class="msg-channel-item msg-dm-item"
                data-channel-id="${channel.id}"
                data-channel-type="${CHANNEL_TYPES.DIRECT}">
          <span class="msg-dm-avatar" style="color: ${avatarColor}; border-color: ${avatarColor}">
            ${initials}
          </span>
          <span class="msg-channel-name">${escapeHtml(userName)}</span>
          ${channel.unread_count ? `<span class="msg-unread-badge">${channel.unread_count}</span>` : ""}
        </button>
      `;
    });

    DOM.directMessages.innerHTML = html;
  }

  function renderCustomChannels() {
    if (!DOM.customChannels) return;

    const customChannels = state.channels.filter(
      (c) => c.type === CHANNEL_TYPES.CUSTOM
    );

    if (customChannels.length === 0) {
      DOM.customChannels.innerHTML = `
        <div class="msg-channel-empty">No custom channels yet</div>
      `;
      return;
    }

    let html = "";
    customChannels.forEach((channel) => {
      const channelColor = getCustomChannelColor(channel.id || channel.name);
      const initials = getChannelInitials(channel.name);

      html += `
        <button type="button" class="msg-channel-item msg-custom-item"
                data-channel-id="${channel.id}"
                data-channel-type="${CHANNEL_TYPES.CUSTOM}">
          <span class="msg-dm-avatar" style="color: ${channelColor}; border-color: ${channelColor}">
            ${initials}
          </span>
          <span class="msg-channel-name">${escapeHtml(channel.name)}</span>
          ${channel.unread_count ? `<span class="msg-unread-badge">${channel.unread_count}</span>` : ""}
        </button>
      `;
    });

    DOM.customChannels.innerHTML = html;
  }

  function renderGroups() {
    if (!DOM.groupChannels) return;

    const groupChannels = state.channels.filter(
      (c) => c.type === CHANNEL_TYPES.GROUP
    );

    if (groupChannels.length === 0) {
      DOM.groupChannels.innerHTML = `
        <div class="msg-channel-empty">No groups yet</div>
      `;
      return;
    }

    let html = "";
    groupChannels.forEach((channel) => {
      const channelColor = getCustomChannelColor(channel.id || channel.name);
      const initials = getChannelInitials(channel.name);

      html += `
        <button type="button" class="msg-channel-item msg-group-item"
                data-channel-id="${channel.id}"
                data-channel-type="${CHANNEL_TYPES.GROUP}">
          <span class="msg-dm-avatar" style="color: ${channelColor}; border-color: ${channelColor}">
            ${initials}
          </span>
          <span class="msg-channel-name">${escapeHtml(channel.name)}</span>
          ${channel.unread_count ? `<span class="msg-unread-badge">${channel.unread_count}</span>` : ""}
        </button>
      `;
    });

    DOM.groupChannels.innerHTML = html;
  }

  // Ensure required group channels exist (auto-create if missing)
  const REQUIRED_GROUPS = ["Payroll"];

  async function ensureGroupChannels() {
    const existingGroups = state.channels.filter(
      (c) => c.type === CHANNEL_TYPES.GROUP
    );
    const existingNames = existingGroups.map((g) => g.name);

    for (const groupName of REQUIRED_GROUPS) {
      if (existingNames.includes(groupName)) continue;

      try {
        const memberIds = state.users.map((u) => u.user_id || u.id).filter(Boolean);

        const res = await authFetch(`${API_BASE}/messages/channels`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "group",
            name: groupName,
            description: `${groupName} group channel`,
            member_ids: memberIds,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const channel = data.channel;
          if (channel && !data.existing) {
            state.channels.push(channel);
          } else if (channel && data.existing) {
            // Channel already exists in DB but wasn't in our channels list
            if (!state.channels.find((c) => c.id === channel.id)) {
              state.channels.push(channel);
            }
          }
          console.log(`[Messages] Group "${groupName}" ensured`);
        } else {
          const errBody = await res.json().catch(() => ({}));
          console.error(`[Messages] Failed to create group "${groupName}":`, res.status, errBody);
        }
      } catch (err) {
        console.warn(`[Messages] Failed to ensure group "${groupName}":`, err);
      }
    }
  }

  // Get color for custom channel based on name/id
  function getCustomChannelColor(channelIdentifier) {
    const hue = stableHueFromString(channelIdentifier);
    return `hsl(${hue} 65% 50%)`;
  }

  // Get initials from channel name (first 2 letters of first 2 words, or first 2 letters)
  function getChannelInitials(name) {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL SELECTION
  // ─────────────────────────────────────────────────────────────────────────

  // Request counter to handle race conditions when switching channels quickly
  let channelRequestId = 0;

  async function selectChannel(channelType, channelId, projectId, channelName, clickedElement) {
    // Generate unique request ID for this selection
    const thisRequestId = ++channelRequestId;

    // Update UI state
    document.querySelectorAll(".msg-channel-item").forEach((el) => {
      el.classList.remove("active");
    });
    clickedElement?.classList.add("active");

    // Find the full channel object from state.channels (includes members and all data)
    let channel = state.channels.find((c) => c.id === channelId && c.type === channelType);

    // If not found in state.channels, create a minimal channel object as fallback
    if (!channel) {
      channel = {
        type: channelType,
        id: channelId,
        projectId: projectId,
        name: channelName,
      };
    }

    state.currentChannel = channel;

    // Update header
    updateChatHeader(channel);

    // Show loading spinner, hide other states
    DOM.emptyState.style.display = "none";
    DOM.messagesList.style.display = "none";
    if (DOM.chatLoading) DOM.chatLoading.style.display = "flex";
    DOM.messageInputArea.style.display = "flex";

    // Load messages
    const messages = await loadMessages(channelType, channelId, projectId);

    // RACE CONDITION CHECK: If user switched to another channel while loading,
    // discard these results and don't render
    if (thisRequestId !== channelRequestId) {
      console.log("[Messages] Discarding stale response for channel:", channelId);
      return;
    }

    state.messages = messages;

    // Scan loaded messages for active flows (check flow / duplicate flow / receipt flow)
    state.activeCheckFlow = null;
    state.activeDuplicateFlow = null;
    state.activeReceiptFlow = null;
    for (const msg of messages) {
      if (msg.metadata?.check_flow_active && msg.metadata?.check_flow_state) {
        state.activeCheckFlow = { receiptId: msg.metadata.pending_receipt_id, state: msg.metadata.check_flow_state };
      } else if (msg.metadata?.check_flow_state === 'completed' || msg.metadata?.check_flow_state === 'cancelled') {
        state.activeCheckFlow = null;
      }
      if (msg.metadata?.duplicate_flow_active && msg.metadata?.duplicate_flow_state === 'awaiting_confirmation') {
        state.activeDuplicateFlow = { receiptId: msg.metadata.pending_receipt_id };
      } else if (msg.metadata?.duplicate_flow_state === 'confirmed' || msg.metadata?.duplicate_flow_state === 'skipped') {
        state.activeDuplicateFlow = null;
      }
      if (msg.metadata?.receipt_flow_active && msg.metadata?.receipt_flow_state) {
        state.activeReceiptFlow = { receiptId: msg.metadata.pending_receipt_id, state: msg.metadata.receipt_flow_state };
      } else if (msg.metadata?.receipt_flow_state === 'completed' || msg.metadata?.receipt_flow_state === 'cancelled') {
        state.activeReceiptFlow = null;
      }
    }

    // Hide loading, show messages
    if (DOM.chatLoading) DOM.chatLoading.style.display = "none";
    DOM.messagesList.style.display = "flex";
    renderMessages();

    // Subscribe to realtime updates
    subscribeToChannel(channel);

    // Scroll to bottom
    scrollToBottom();

    // Close mobile sidebar after selecting channel
    closeMobileSidebar();
  }

  function updateChatHeader(channel) {
    if (!channel) return;

    let name = channel.name || "Unknown Channel";
    let description = "";

    if (channel.type.startsWith("project_")) {
      const project = state.projects.find(
        (p) => p.project_id === channel.projectId
      );
      const projectName = project?.project_name || "Unknown Project";
      name = `${projectName} — ${channel.name}`;
      description = `Project channel for ${channel.name.toLowerCase()} discussions`;
    } else if (channel.type === CHANNEL_TYPES.DIRECT) {
      const otherUser = getOtherUserInDM(channel);
      name = otherUser?.user_name || "Direct Message";
      description = "Private conversation";
    } else {
      description = channel.description || "Custom channel";
    }

    DOM.chatName.textContent = name;
    DOM.chatDescription.textContent = description;

    // Show/hide receipts channel indicator
    updateReceiptsIndicator(channel);
  }

  /**
   * Show indicator when in receipts channel with pending receipts count
   */
  async function updateReceiptsIndicator(channel) {
    // Remove existing indicator
    const existing = document.querySelector(".msg-receipts-indicator");
    if (existing) existing.remove();

    // Only show for receipts channel
    if (channel?.type !== "project_receipts") return;

    // Fetch pending receipts count
    let pendingCount = 0;
    let readyCount = 0;

    try {
      const res = await authFetch(
        `${API_BASE}/pending-receipts/project/${channel.projectId}?status=pending&limit=1`
      );
      if (res.ok) {
        const data = await res.json();
        pendingCount = data.counts?.pending || 0;
        readyCount = data.counts?.ready || 0;
      }
    } catch (err) {
      console.warn("[Messages] Could not fetch receipts count:", err);
    }

    // Create indicator
    const indicator = document.createElement("div");
    indicator.className = "msg-receipts-indicator";
    indicator.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
      <span class="msg-receipts-indicator-text">
        Upload receipts here — they'll be tracked for expense processing
      </span>
      ${pendingCount + readyCount > 0
        ? `<span class="msg-receipts-indicator-count">${pendingCount + readyCount} pending</span>`
        : ""
      }
    `;

    // Insert before messages container
    const chatArea = document.querySelector(".msg-chat-main");
    const messagesContainer = document.querySelector(".msg-messages-container");
    if (chatArea && messagesContainer) {
      chatArea.insertBefore(indicator, messagesContainer);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MESSAGE RENDERING
  // ─────────────────────────────────────────────────────────────────────────

  // Public render function - uses debouncing to prevent flicker
  function renderMessages(immediate = false) {
    debouncedRenderMessages(immediate);
  }

  // Internal render function - does the actual DOM update
  function renderMessagesInternal() {
    if (!DOM.messagesList) return;

    if (state.messages.length === 0) {
      DOM.messagesList.innerHTML = `
        <div class="msg-no-messages">
          <p>No messages yet. Be the first to say something!</p>
        </div>
      `;
      return;
    }

    let html = "";
    let lastDate = null;

    state.messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();

      // Date separator
      if (msgDate !== lastDate) {
        html += renderDateSeparator(msg.created_at);
        lastDate = msgDate;
      }

      // Check if this is a temporary/sending message
      const isSending = msg.id?.toString().startsWith("temp-");
      html += renderMessage(msg, isSending);
    });

    DOM.messagesList.innerHTML = html;
    scrollToBottom();
  }

  function renderDateSeparator(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label;
    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }

    return `
      <div class="msg-date-separator">
        <span class="msg-date-label">${label}</span>
      </div>
    `;
  }

  const ARTURITO_BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

  function renderMessage(msg, isSending = false) {
    const isBot = msg.user_id === ARTURITO_BOT_USER_ID || msg.metadata?.agent_message;
    const user = state.users.find((u) => u.user_id === msg.user_id) || { user_name: msg.user_name };
    const userName = isBot ? "Arturito" : (user.user_name || msg.user_name || "Unknown");
    const avatarColor = isBot ? "hsl(145, 65%, 42%)" : getAvatarColor(user);
    const initials = isBot ? "A" : getInitials(userName);
    const time = formatTime(msg.created_at);
    const content = formatMessageContent(msg.content);
    const hasAttachments = msg.attachments && msg.attachments.length > 0;
    const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
    const threadCount = msg.thread_count || 0;
    const isOwnMessage = msg.user_id === state.currentUser?.user_id;

    // Build CSS classes
    const classes = ['msg-message'];
    if (isOwnMessage) classes.push('msg-message--own');
    if (isSending && !msg._failed) classes.push('msg-message--sending');
    if (msg._failed) classes.push('msg-message--failed');
    if (isBot) classes.push('msg-message--bot');

    // Check for receipt status tag
    const receiptStatusTag = renderReceiptStatusTag(msg);

    // Bot action buttons for duplicate receipts
    let botActions = '';
    if (isBot && msg.metadata?.duplicate_flow_active && msg.metadata?.duplicate_flow_state === 'awaiting_confirmation') {
      const receiptId = msg.metadata.pending_receipt_id;
      botActions = `
        <div class="msg-bot-actions" data-receipt-id="${receiptId}">
          <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="dup-confirm-yes" data-receipt-id="${receiptId}">
            Yes, process it
          </button>
          <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="dup-confirm-no" data-receipt-id="${receiptId}">
            No, skip
          </button>
          <span class="msg-bot-input-hint">or type yes/no</span>
        </div>
      `;
    } else if (isBot && msg.metadata?.allow_force_process && msg.metadata?.receipt_status === 'duplicate') {
      // Fallback for old-format duplicate messages without flow metadata
      const receiptId = msg.metadata.pending_receipt_id;
      botActions = `
        <div class="msg-bot-actions" data-receipt-id="${receiptId}">
          <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="force-process" data-receipt-id="${receiptId}">
            Process Anyway
          </button>
          <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="dismiss-duplicate" data-receipt-id="${receiptId}">
            Skip
          </button>
        </div>
      `;
    }

    // Check flow action buttons
    if (isBot && msg.metadata?.check_flow_active) {
      const receiptId = msg.metadata.pending_receipt_id;
      const flowState = msg.metadata.check_flow_state;

      if (flowState === 'check_detected') {
        botActions = `
          <div class="msg-bot-actions" data-receipt-id="${receiptId}">
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="check-confirm-material" data-receipt-id="${receiptId}">
              Material
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="check-confirm-labor" data-receipt-id="${receiptId}">
              Labor
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="check-confirm-no" data-receipt-id="${receiptId}">
              Not a check
            </button>
          </div>
        `;
      } else if (flowState === 'awaiting_split_decision') {
        botActions = `
          <div class="msg-bot-actions" data-receipt-id="${receiptId}">
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="check-split-yes" data-receipt-id="${receiptId}">
              Yes, split it
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="check-split-no" data-receipt-id="${receiptId}">
              No, single project
            </button>
          </div>
        `;
      } else if (flowState === 'awaiting_category_confirm') {
        botActions = `
          <div class="msg-bot-actions" data-receipt-id="${receiptId}">
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="check-category-confirm" data-receipt-id="${receiptId}">
              Confirm
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="check-cancel" data-receipt-id="${receiptId}">
              Cancel
            </button>
          </div>
        `;
      } else if (['awaiting_amount', 'awaiting_description', 'awaiting_split_details'].includes(flowState)) {
        botActions = `
          <div class="msg-bot-actions msg-bot-actions--hint" data-receipt-id="${receiptId}">
            <span class="msg-bot-input-hint">Type your response in the chat input below</span>
          </div>
        `;
      }
    }

    // Receipt flow action buttons
    if (isBot && msg.metadata?.receipt_flow_active) {
      const receiptId = msg.metadata.pending_receipt_id;
      const flowState = msg.metadata.receipt_flow_state;

      if (flowState === 'awaiting_project_decision') {
        botActions = `
          <div class="msg-bot-actions" data-receipt-id="${receiptId}">
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="receipt-single-project" data-receipt-id="${receiptId}">
              Only this project
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="receipt-split-projects" data-receipt-id="${receiptId}">
              Split across projects
            </button>
          </div>
        `;
      } else if (flowState === 'awaiting_split_details') {
        botActions = `
          <div class="msg-bot-actions" data-receipt-id="${receiptId}">
            <span class="msg-bot-input-hint">Type each item as: [amount] [description]</span>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--primary" data-action="receipt-split-done" data-receipt-id="${receiptId}">
              Done
            </button>
            <button type="button" class="msg-bot-action-btn msg-bot-action-btn--secondary" data-action="receipt-cancel" data-receipt-id="${receiptId}">
              Cancel
            </button>
          </div>
        `;
      }
    }

    return `
      <div class="${classes.join(' ')}" data-message-id="${msg.id}">
        <div class="msg-message-avatar ${isBot ? 'msg-message-avatar--bot' : ''}" style="color: ${avatarColor}; border-color: ${avatarColor}">
          ${initials}
        </div>
        <div class="msg-message-content">
          <div class="msg-message-header">
            <span class="msg-message-author">${escapeHtml(userName)}</span>
            <span class="msg-message-time">${time}</span>
            ${receiptStatusTag}
          </div>
          <div class="msg-message-body">
            ${content}
          </div>
          ${botActions}
          ${hasAttachments ? renderAttachments(msg.attachments, msg) : ""}
          ${hasReactions ? renderReactions(msg.reactions, msg.id) : ""}
          <div class="msg-message-actions">
            <button type="button" class="msg-action-btn" data-action="react" data-message-id="${msg.id}" title="Add reaction">
              😊
            </button>
            <button type="button" class="msg-action-btn" data-action="reply" data-message-id="${msg.id}" title="Reply">
              ↩
            </button>
            <button type="button" class="msg-action-btn" data-action="thread" data-message-id="${msg.id}" title="Start thread">
              💬 ${threadCount > 0 ? threadCount : ""}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render receipt status tag if the message has receipt metadata
   */
  function renderReceiptStatusTag(msg) {
    if (!msg.metadata?.pending_receipt_id) return '';

    const status = msg.metadata.receipt_status || 'pending';
    const statusConfig = {
      pending: { label: 'Pending', class: 'msg-receipt-status--pending', icon: '⏳' },
      processing: { label: 'Processing', class: 'msg-receipt-status--processing', icon: '⚙️' },
      ready: { label: 'Ready', class: 'msg-receipt-status--ready', icon: '✅' },
      linked: { label: 'Done', class: 'msg-receipt-status--linked', icon: '✓' },
      duplicate: { label: 'Duplicate', class: 'msg-receipt-status--duplicate', icon: '!' },
      error: { label: 'Error', class: 'msg-receipt-status--error', icon: '⚠️' },
      check_review: { label: 'Check', class: 'msg-receipt-status--check', icon: '?' },
      split: { label: 'Split', class: 'msg-receipt-status--split', icon: '/' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return `
      <span class="msg-receipt-status ${config.class}" data-receipt-id="${msg.metadata.pending_receipt_id}">
        <span class="msg-receipt-status-icon">${config.icon}</span>
        <span class="msg-receipt-status-label">${config.label}</span>
      </span>
    `;
  }

  function renderAttachments(attachments, msg = null) {
    if (!attachments || attachments.length === 0) return "";

    const isReceiptMessage = msg?.metadata?.pending_receipt_id;

    let html = '<div class="msg-attachments">';
    attachments.forEach((att) => {
      if (att.type?.startsWith("image/")) {
        html += `
          <div class="msg-attachment msg-attachment--image ${isReceiptMessage ? 'msg-attachment--receipt' : ''}">
            <img src="${escapeHtml(att.thumbnail_url || att.url)}" alt="${escapeHtml(att.name)}" loading="lazy" />
            ${isReceiptMessage ? `<a href="${escapeHtml(att.url)}" target="_blank" class="msg-attachment-view">View Full</a>` : ''}
          </div>
        `;
      } else {
        html += `
          <a href="${escapeHtml(att.url)}" class="msg-attachment msg-attachment--file ${isReceiptMessage ? 'msg-attachment--receipt' : ''}" target="_blank" download>
            <span class="msg-attachment-icon">📄</span>
            <span class="msg-attachment-name">${escapeHtml(att.name)}</span>
            <span class="msg-attachment-size">${formatFileSize(att.size)}</span>
          </a>
        `;
      }
    });
    html += "</div>";
    return html;
  }

  function renderReactions(reactions, messageId) {
    if (!reactions || Object.keys(reactions).length === 0) return "";

    let html = '<div class="msg-reactions">';
    for (const [emoji, users] of Object.entries(reactions)) {
      const count = users.length;
      const hasReacted = users.includes(state.currentUser?.user_id);
      html += `
        <button type="button" class="msg-reaction ${hasReacted ? "msg-reaction--active" : ""}"
                data-emoji="${emoji}" data-message-id="${messageId}">
          <span class="msg-reaction-emoji">${emoji}</span>
          <span class="msg-reaction-count">${count}</span>
        </button>
      `;
    }
    html += `
      <button type="button" class="msg-reaction msg-reaction--add" data-action="add-reaction" data-message-id="${messageId}">
        <span>+</span>
      </button>
    `;
    html += "</div>";
    return html;
  }

  function formatMessageContent(content) {
    if (!content) return "";

    // Escape HTML first
    let formatted = escapeHtml(content);

    // Parse @mentions
    formatted = formatted.replace(/@(\w+)/g, (match, username) => {
      const user = state.users.find(
        (u) => u.user_name?.toLowerCase().replace(/\s+/g, "") === username.toLowerCase()
      );
      if (user) {
        return `<span class="msg-mention" data-user-id="${user.user_id}">@${escapeHtml(user.user_name)}</span>`;
      }
      return match;
    });

    // Parse markdown links [text](url) - must come before plain URL parsing
    formatted = formatted.replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    );

    // Parse bold **text**
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Parse italic *text* (but not inside **)
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

    // Parse plain URLs (skip URLs already in href attributes)
    formatted = formatted.replace(
      /(?<!")(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    // Parse line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SENDING MESSAGES
  // ─────────────────────────────────────────────────────────────────────────
  function _getCheckFlowAction(content) {
    if (!state.activeCheckFlow || (!isReceiptsChannel() && !isPayrollChannel())) return null;

    const flowState = state.activeCheckFlow.state;
    const textInputStates = {
      'awaiting_amount': 'submit_amount',
      'awaiting_description': 'submit_description',
      'awaiting_split_details': content.toLowerCase().trim() === 'done'
        ? 'split_done'
        : 'submit_split_line',
    };

    if (textInputStates[flowState]) {
      return {
        receiptId: state.activeCheckFlow.receiptId,
        action: textInputStates[flowState],
      };
    }
    return null;
  }

  async function _forwardToCheckAction(receiptId, action, text) {
    try {
      const body = { action: action, user_id: state.currentUser?.user_id };
      if (text != null) body.payload = { text: text };

      const response = await authFetch(
        `${API_BASE}/pending-receipts/${receiptId}/check-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[Messages] Check action error:", error);
      }

      // Fetch bot response messages
      _fetchBotMessages();
    } catch (err) {
      console.error("[Messages] Check action fetch error:", err);
    }
  }

  // ── Duplicate flow helpers ──
  function _getDuplicateFlowAction(content) {
    if (!state.activeDuplicateFlow || !isReceiptsChannel()) return null;

    const text = content.toLowerCase().trim();
    const yesPatterns = ['yes', 'si', 'y', 'ok', 'sure', 'proceed', 'continue', 'go ahead', 'process'];
    const noPatterns = ['no', 'n', 'skip', 'cancel', 'nah', 'nope', 'stop'];

    if (yesPatterns.includes(text)) {
      return { receiptId: state.activeDuplicateFlow.receiptId, action: 'confirm_process' };
    }
    if (noPatterns.includes(text)) {
      return { receiptId: state.activeDuplicateFlow.receiptId, action: 'skip' };
    }
    return null;
  }

  async function _forwardToDuplicateAction(receiptId, action) {
    try {
      const body = { action: action, user_id: state.currentUser?.user_id };

      const response = await authFetch(
        `${API_BASE}/pending-receipts/${receiptId}/duplicate-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[Messages] Duplicate action error:", error);
      }

      // Fetch bot response messages
      _fetchBotMessages();
    } catch (err) {
      console.error("[Messages] Duplicate action fetch error:", err);
    }
  }

  // ── Receipt flow helpers ──
  function _getReceiptFlowAction(content) {
    if (!state.activeReceiptFlow || !isReceiptsChannel()) return null;
    if (state.activeReceiptFlow.state === 'awaiting_split_details') {
      return content.toLowerCase().trim() === 'done'
        ? { receiptId: state.activeReceiptFlow.receiptId, action: 'split_done' }
        : { receiptId: state.activeReceiptFlow.receiptId, action: 'submit_split_line' };
    }
    return null;
  }

  async function _forwardToReceiptAction(receiptId, action, text) {
    try {
      const body = { action: action, user_id: state.currentUser?.user_id };
      if (text != null) body.payload = { text: text };

      const response = await authFetch(
        `${API_BASE}/pending-receipts/${receiptId}/receipt-action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[Messages] Receipt action error:", error);
      }

      _fetchBotMessages();
    } catch (err) {
      console.error("[Messages] Receipt action fetch error:", err);
    }
  }

  /**
   * Fetch recent messages to pick up bot responses.
   * Polling fallback for when Supabase Realtime doesn't deliver.
   */
  async function _fetchBotMessages() {
    if (!state.currentChannel) return;

    // Small delay to let the backend finish inserting the bot message
    await new Promise(r => setTimeout(r, 1500));

    try {
      const ch = state.currentChannel;
      const fresh = await loadMessages(ch.type, ch.id, ch.projectId);

      // Merge new messages that we don't already have
      let added = 0;
      for (const msg of fresh) {
        const exists = state.messages.some(m => m.id === msg.id);
        if (!exists) {
          state.messages.push(msg);
          added++;
        }
      }

      if (added > 0) {
        console.log(`[Messages] Fetched ${added} new bot message(s)`);
        // Sort by created_at
        state.messages.sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        renderMessages(true);

        // Update flow state from bot messages
        for (const msg of fresh) {
          if (msg.metadata?.check_flow_active && msg.metadata?.check_flow_state) {
            state.activeCheckFlow = { receiptId: msg.metadata.pending_receipt_id, state: msg.metadata.check_flow_state };
          }
          if (msg.metadata?.duplicate_flow_active && msg.metadata?.duplicate_flow_state === 'awaiting_confirmation') {
            state.activeDuplicateFlow = { receiptId: msg.metadata.pending_receipt_id };
          }
          if (msg.metadata?.receipt_flow_active && msg.metadata?.receipt_flow_state) {
            state.activeReceiptFlow = { receiptId: msg.metadata.pending_receipt_id, state: msg.metadata.receipt_flow_state };
          } else if (msg.metadata?.receipt_flow_state === 'completed' || msg.metadata?.receipt_flow_state === 'cancelled') {
            state.activeReceiptFlow = null;
          }
        }
      }
    } catch (err) {
      console.error("[Messages] Bot message fetch error:", err);
    }
  }

  async function sendMessage() {
    const content = DOM.messageInput.value.trim();
    if (!content && state.attachments.length === 0) return;
    if (!state.currentChannel) return;

    // Check if this message is a response to an active check flow
    const checkFlowAction = _getCheckFlowAction(content);

    // Check if this message is a response to an active duplicate flow
    const duplicateFlowAction = _getDuplicateFlowAction(content);

    // Check if this message is a response to an active receipt flow
    const receiptFlowAction = _getReceiptFlowAction(content);

    const messageData = {
      content: content,
      channel_type: state.currentChannel.type,
      user_id: state.currentUser?.user_id,
      reply_to_id: state.replyingTo?.id || null,
      attachments: state.attachments,
    };

    // Set channel reference based on type
    if (state.currentChannel.type.startsWith("project_")) {
      messageData.project_id = state.currentChannel.projectId;
    } else {
      messageData.channel_id = state.currentChannel.id;
    }

    // Optimistic UI update - show immediately
    const tempMessage = {
      id: `temp-${Date.now()}`,
      ...messageData,
      created_at: new Date().toISOString(),
      user_name: state.currentUser?.user_name,
    };
    state.messages.push(tempMessage);
    renderMessages(true); // Immediate render for user feedback

    // Clear input
    DOM.messageInput.value = "";
    DOM.btnSendMessage.disabled = true;
    clearReply();
    clearAttachments();
    autoResizeTextarea(DOM.messageInput);

    try {
      const res = await authFetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageData),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const data = await res.json();
      // Replace temp message with real one
      const tempIndex = state.messages.findIndex((m) => m.id === tempMessage.id);
      if (tempIndex !== -1) {
        state.messages[tempIndex] = data.message || data;
        renderMessages();
      }

      // Forward to check-action endpoint if this was a check flow response
      if (checkFlowAction) {
        _forwardToCheckAction(checkFlowAction.receiptId, checkFlowAction.action, content);
      }

      // Forward to duplicate-action endpoint if this was a duplicate flow response
      if (duplicateFlowAction) {
        _forwardToDuplicateAction(duplicateFlowAction.receiptId, duplicateFlowAction.action);
        state.activeDuplicateFlow = null;
      }

      // Forward to receipt-action endpoint if this was a receipt flow response
      if (receiptFlowAction) {
        _forwardToReceiptAction(receiptFlowAction.receiptId, receiptFlowAction.action, content);
      }
    } catch (err) {
      console.error("[Messages] Send error:", err);
      showToast("Failed to send message", "error");
      // Keep temp message visible with failed indicator
      const failIdx = state.messages.findIndex((m) => m.id === tempMessage.id);
      if (failIdx !== -1) {
        state.messages[failIdx]._failed = true;
        renderMessages();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MENTIONS
  // ─────────────────────────────────────────────────────────────────────────
  function handleMentionInput(e) {
    const textarea = e.target;
    const value = textarea.value;
    const cursorPos = textarea.selectionStart;

    // Find @ symbol before cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      showMentionDropdown(query, cursorPos - mentionMatch[0].length);
    } else {
      hideMentionDropdown();
    }
  }

  function showMentionDropdown(query, startPos) {
    const filtered = state.users.filter((u) =>
      u.user_name?.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      hideMentionDropdown();
      return;
    }

    let html = "";
    filtered.slice(0, 8).forEach((user) => {
      const avatarColor = getAvatarColor(user);
      const initials = getInitials(user.user_name);
      html += `
        <button type="button" class="msg-mention-item" data-user-id="${user.user_id}" data-user-name="${escapeHtml(user.user_name)}">
          <span class="msg-mention-avatar" style="color: ${avatarColor}; border-color: ${avatarColor}">${initials}</span>
          <span class="msg-mention-name">${escapeHtml(user.user_name)}</span>
        </button>
      `;
    });

    DOM.mentionDropdown.innerHTML = html;
    DOM.mentionDropdown.style.display = "block";
    DOM.mentionDropdown.dataset.startPos = startPos;
  }

  function hideMentionDropdown() {
    if (DOM.mentionDropdown) {
      DOM.mentionDropdown.style.display = "none";
    }
  }

  function insertMention(_userId, userName) {
    const startPos = parseInt(DOM.mentionDropdown.dataset.startPos, 10);
    const value = DOM.messageInput.value;
    const cursorPos = DOM.messageInput.selectionStart;

    const before = value.substring(0, startPos);
    const after = value.substring(cursorPos);
    const mention = `@${userName.replace(/\s+/g, "")} `;

    DOM.messageInput.value = before + mention + after;
    DOM.messageInput.focus();
    DOM.messageInput.selectionStart = DOM.messageInput.selectionEnd =
      startPos + mention.length;

    hideMentionDropdown();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REACTIONS
  // ─────────────────────────────────────────────────────────────────────────
  const EMOJI_PICKER = ["👍", "👎", "❤️", "😂", "😮", "😢", "🎉", "🔥"];

  async function toggleReaction(messageId, emoji) {
    const message = state.messages.find((m) => m.id === messageId);
    if (!message) return;

    // Initialize reactions if needed
    if (!message.reactions) message.reactions = {};
    if (!message.reactions[emoji]) message.reactions[emoji] = [];

    const currentUserId = state.currentUser?.user_id;
    const hasReacted = message.reactions[emoji].includes(currentUserId);

    // Optimistic update
    if (hasReacted) {
      message.reactions[emoji] = message.reactions[emoji].filter(
        (id) => id !== currentUserId
      );
      if (message.reactions[emoji].length === 0) {
        delete message.reactions[emoji];
      }
    } else {
      message.reactions[emoji].push(currentUserId);
    }
    renderMessages();

    try {
      await authFetch(`${API_BASE}/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, action: hasReacted ? "remove" : "add" }),
      });
    } catch (err) {
      console.error("[Messages] Reaction error:", err);
    }
  }

  function showEmojiPicker(messageId) {
    // Simple emoji picker (could be enhanced with a full picker library)
    const picker = document.createElement("div");
    picker.className = "msg-emoji-picker";
    picker.innerHTML = EMOJI_PICKER.map(
      (emoji) =>
        `<button type="button" class="msg-emoji-btn" data-emoji="${emoji}">${emoji}</button>`
    ).join("");

    picker.addEventListener("click", (e) => {
      const emoji = e.target.dataset.emoji;
      if (emoji) {
        toggleReaction(messageId, emoji);
        picker.remove();
      }
    });

    // Position near the reaction button
    const btn = document.querySelector(
      `[data-action="add-reaction"][data-message-id="${messageId}"]`
    );
    if (btn) {
      btn.parentElement.appendChild(picker);
      // Remove on outside click
      setTimeout(() => {
        document.addEventListener(
          "click",
          (e) => {
            if (!picker.contains(e.target)) picker.remove();
          },
          { once: true }
        );
      }, 0);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // THREADS
  // ─────────────────────────────────────────────────────────────────────────

  // Request counter for thread loading race conditions
  let threadRequestId = 0;

  async function openThread(messageId) {
    // Generate unique request ID for this thread
    const thisThreadRequestId = ++threadRequestId;

    const message = state.messages.find((m) => m.id === messageId);
    if (!message) return;

    DOM.threadPanel.style.display = "flex";

    // Store current thread immediately
    DOM.threadPanel.dataset.messageId = messageId;

    // Render original message
    DOM.threadOriginal.innerHTML = renderMessage(message);

    // Show loading state for replies
    DOM.threadReplies.innerHTML = `<div class="msg-thread-loading">Loading replies...</div>`;

    // Load thread replies
    try {
      const res = await authFetch(`${API_BASE}/messages/${messageId}/thread`);

      // RACE CONDITION CHECK: If user opened another thread while loading, discard
      if (thisThreadRequestId !== threadRequestId) {
        console.log("[Messages] Discarding stale thread response for:", messageId);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        const replies = data.replies || data || [];
        renderThreadReplies(replies);
      }
    } catch (err) {
      console.error("[Messages] Failed to load thread:", err);
      // Only show error if this is still the current thread request
      if (thisThreadRequestId === threadRequestId) {
        DOM.threadReplies.innerHTML = `<div class="msg-thread-error">Failed to load replies</div>`;
      }
    }
  }

  function renderThreadReplies(replies) {
    if (replies.length === 0) {
      DOM.threadReplies.innerHTML = `
        <div class="msg-thread-empty">No replies yet. Start the conversation!</div>
      `;
      return;
    }

    DOM.threadReplies.innerHTML = replies.map((r) => renderMessage(r)).join("");
  }

  function closeThread() {
    DOM.threadPanel.style.display = "none";
    DOM.threadPanel.dataset.messageId = "";
  }

  async function sendThreadReply() {
    const content = DOM.threadInput.value.trim();
    if (!content) return;

    const parentId = DOM.threadPanel.dataset.messageId;
    if (!parentId) return;

    try {
      const res = await authFetch(`${API_BASE}/messages/${parentId}/thread`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        DOM.threadInput.value = "";
        // Reload thread
        openThread(parentId);
        // Update thread count in main message
        const message = state.messages.find((m) => m.id === parentId);
        if (message) {
          message.thread_count = (message.thread_count || 0) + 1;
          renderMessages();
        }
      }
    } catch (err) {
      console.error("[Messages] Thread reply error:", err);
      showToast("Failed to send reply", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPLY
  // ─────────────────────────────────────────────────────────────────────────
  function setReplyTo(messageId) {
    const message = state.messages.find((m) => m.id === messageId);
    if (!message) return;

    state.replyingTo = message;

    const user = state.users.find((u) => u.user_id === message.user_id);
    DOM.replyAuthor.textContent = user?.user_name || "Unknown";
    DOM.replyText.textContent =
      message.content?.substring(0, 50) + (message.content?.length > 50 ? "..." : "");
    DOM.replyPreview.style.display = "flex";

    DOM.messageInput.focus();
  }

  function clearReply() {
    state.replyingTo = null;
    DOM.replyPreview.style.display = "none";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ATTACHMENTS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if current channel is a receipts channel (for special handling)
   */
  function isReceiptsChannel() {
    return state.currentChannel?.type === "project_receipts";
  }

  function isPayrollChannel() {
    return state.currentChannel?.type === "group" &&
           state.currentChannel?.name === "Payroll";
  }

  /**
   * Upload a receipt file to the pending-receipts API
   * Only for project_receipts channels
   */
  async function uploadReceiptToPending(file) {
    if (!state.currentChannel?.projectId || !state.currentUser?.user_id) {
      throw new Error("Missing project or user context");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", state.currentChannel.projectId);
    formData.append("uploaded_by", state.currentUser.user_id);

    const response = await authFetch(`${API_BASE}/pending-receipts/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || "Failed to upload receipt");
    }

    return response.json();
  }

  function openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;

    // For receipts channel, limit to receipt-friendly formats
    if (isReceiptsChannel()) {
      input.accept = "image/jpeg,image/png,image/webp,image/gif,.pdf";
    } else {
      input.accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt";
    }

    input.addEventListener("change", handleFileSelect);
    input.click();
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Special handling for receipts channel
    if (isReceiptsChannel()) {
      await handleReceiptUpload(files);
      return;
    }

    // Regular attachment handling
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File ${file.name} is too large (max 10MB)`, "warning");
        continue;
      }

      // Add to attachments (would upload to storage in real implementation)
      state.attachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file: file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      });
    }

    renderAttachmentsPreview();
  }

  /**
   * Handle receipt uploads for the Receipts channel
   * Uploads to pending-receipts API and optionally triggers processing
   */
  async function handleReceiptUpload(files) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

    for (const file of files) {
      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        showToast(`${file.name}: Only images and PDFs allowed for receipts`, "warning");
        continue;
      }

      // Validate size (20MB max for receipts)
      if (file.size > 20 * 1024 * 1024) {
        showToast(`${file.name} is too large (max 20MB)`, "warning");
        continue;
      }

      // Use temp ID for progress until we get real receipt ID
      const tempProgressId = `temp-${Date.now()}`;
      showReceiptProgress(tempProgressId, file.name, 'uploading');

      // Show message instantly (before upload) with local preview
      const localPreviewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      const tempMsgId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tempReceiptMsg = {
        id: tempMsgId,
        content: `**Receipt:** ${file.name}`,
        channel_type: state.currentChannel.type,
        user_id: state.currentUser?.user_id,
        user_name: state.currentUser?.user_name,
        created_at: new Date().toISOString(),
        attachments: [{
          id: `receipt-temp`,
          name: file.name,
          size: file.size || 0,
          type: file.type || 'image/jpeg',
          url: localPreviewUrl || '',
          thumbnail_url: localPreviewUrl || ''
        }],
        metadata: {
          receipt_status: 'pending'
        }
      };
      if (state.currentChannel.type.startsWith("project_")) {
        tempReceiptMsg.project_id = state.currentChannel.projectId;
      } else {
        tempReceiptMsg.channel_id = state.currentChannel.id;
      }
      state.messages.push(tempReceiptMsg);
      renderMessages(true);

      try {
        const result = await uploadReceiptToPending(file);

        if (result.success) {
          const receipt = result.data;

          // Switch progress card to real receipt ID
          const container = document.querySelector('.msg-receipt-progress-container');
          if (container) {
            const tempCard = container.querySelector(`[data-progress-receipt="${tempProgressId}"]`);
            if (tempCard) {
              tempCard.setAttribute('data-progress-receipt', receipt.id);
              // Transfer cosmetic timer key
              if (receiptProgressTimers[tempProgressId]) {
                receiptProgressTimers[receipt.id] = receiptProgressTimers[tempProgressId];
                delete receiptProgressTimers[tempProgressId];
              }
            }
          }

          // Upgrade temp message with real receipt data
          const tempIdx = state.messages.findIndex(m => m.id === tempMsgId);
          if (tempIdx !== -1) {
            state.messages[tempIdx].content = `**Receipt:** [${file.name}](${receipt.file_url})`;
            state.messages[tempIdx].metadata.pending_receipt_id = receipt.id;
            state.messages[tempIdx].attachments = [{
              id: `receipt-${receipt.id}`,
              name: file.name,
              size: receipt.file_size || file.size || 0,
              type: receipt.file_type || file.type || 'image/jpeg',
              url: receipt.file_url,
              thumbnail_url: receipt.thumbnail_url || receipt.file_url
            }];
            if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
          }

          // Send the message to the server (in background, don't await)
          sendReceiptMessage(receipt, file.name, tempMsgId);

          // Auto-process the receipt (progress updates happen inside)
          await processReceiptNow(receipt.id, file.name);
        }
      } catch (err) {
        console.error("[Messages] Receipt upload error:", err);
        showReceiptProgress(tempProgressId, file.name, 'error');
        hideReceiptProgress(tempProgressId, 6000);
        showToast(`Failed to upload ${file.name}: ${err.message}`, "error");
        // Keep temp message visible but mark as failed
        const tempIdx = state.messages.findIndex(m => m.id === tempMsgId);
        if (tempIdx !== -1) {
          state.messages[tempIdx]._failed = true;
          renderMessages();
        }
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      }
    }
  }

  /**
   * Send a message with receipt metadata for status tracking
   */
  async function sendReceiptMessage(receipt, fileName, existingTempId) {
    if (!state.currentChannel) return;

    const messageData = {
      content: `**Receipt:** [${fileName}](${receipt.file_url})`,
      channel_type: state.currentChannel.type,
      user_id: state.currentUser?.user_id,
      reply_to_id: null,
      attachments: [{
        id: `receipt-${receipt.id}`,
        name: fileName,
        size: receipt.file_size || 0,
        type: receipt.file_type || 'image/jpeg',
        url: receipt.file_url,
        thumbnail_url: receipt.thumbnail_url
      }],
      metadata: {
        pending_receipt_id: receipt.id,
        receipt_status: receipt.status || 'pending'
      }
    };

    // Set channel reference based on type
    if (state.currentChannel.type.startsWith("project_")) {
      messageData.project_id = state.currentChannel.projectId;
    } else {
      messageData.channel_id = state.currentChannel.id;
    }

    // Use existing temp message if provided, otherwise create one
    const tempId = existingTempId || `temp-${Date.now()}`;
    if (!existingTempId) {
      const tempMessage = {
        id: tempId,
        ...messageData,
        created_at: new Date().toISOString(),
        user_name: state.currentUser?.user_name,
      };
      state.messages.push(tempMessage);
      renderMessages();
    }

    try {
      const res = await authFetch(`${API_BASE}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageData),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error("[Messages] Receipt message POST error:", res.status, errBody);
        return; // Keep temp message visible
      }

      const data = await res.json();
      // Replace temp message with real one
      const tempIndex = state.messages.findIndex((m) => m.id === tempId);
      if (tempIndex !== -1) {
        state.messages[tempIndex] = data.message || data;
        renderMessages();
      }
    } catch (err) {
      console.error("[Messages] Receipt message send error:", err);
      // Keep temp message visible - don't remove. Just log the error.
    }
  }

  /**
   * Process a receipt using OCR (calls the process endpoint)
   */
  async function processReceiptNow(receiptId, fileName) {
    // Update message status + progress tracker
    updateReceiptStatusInMessages(receiptId, 'processing');
    showReceiptProgress(receiptId, fileName, 'scanning');

    try {
      const response = await authFetch(`${API_BASE}/pending-receipts/${receiptId}/agent-process`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const isDuplicate = error.detail && error.detail.includes("Duplicate");
        const status = isDuplicate ? 'duplicate' : 'error';
        updateReceiptStatusInMessages(receiptId, status);
        showReceiptProgress(receiptId, fileName, status);
        hideReceiptProgress(receiptId, isDuplicate ? 5000 : 6000);
        throw new Error(error.detail || "Processing failed");
      }

      const result = await response.json();

      if (result.status === "check_review") {
        updateReceiptStatusInMessages(receiptId, 'check_review');
        showReceiptProgress(receiptId, fileName, 'check_review');
        hideReceiptProgress(receiptId, 5000);
      } else if (result.success) {
        updateReceiptStatusInMessages(receiptId, 'ready');
        showReceiptProgress(receiptId, fileName, 'ready');
        hideReceiptProgress(receiptId, 4000);
        showToast("Receipt processed and ready!", "success");
      } else if (result.status === "duplicate") {
        updateReceiptStatusInMessages(receiptId, 'duplicate');
        showReceiptProgress(receiptId, fileName, 'duplicate');
        hideReceiptProgress(receiptId, 5000);
        showToast("Duplicate receipt detected", "warning");
      }

      // Fetch bot messages that were posted during processing
      // (Realtime may not deliver them reliably)
      _fetchBotMessages();
    } catch (err) {
      console.error("[Messages] Receipt processing error:", err);
      showToast(`Failed to process receipt: ${err.message}`, "error");
    }
  }

  /**
   * Force-process a duplicate receipt (user clicked "Process Anyway")
   */
  async function handleForceProcessReceipt(receiptId, actionsEl) {
    // Replace buttons with loading state
    if (actionsEl) {
      actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Processing...</span>';
    }

    // Find filename from existing messages
    let fileName = 'receipt';
    state.messages.forEach(msg => {
      if (msg.metadata?.pending_receipt_id === receiptId && msg.attachments?.length) {
        fileName = msg.attachments[0].name || fileName;
      }
    });

    showReceiptProgress(receiptId, fileName, 'scanning');
    updateReceiptStatusInMessages(receiptId, 'processing');

    try {
      const response = await authFetch(`${API_BASE}/pending-receipts/${receiptId}/agent-process?force=true`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        updateReceiptStatusInMessages(receiptId, 'error');
        showReceiptProgress(receiptId, fileName, 'error');
        hideReceiptProgress(receiptId, 6000);
        if (actionsEl) actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Failed</span>';
        showToast(`Processing failed: ${error.detail || 'Unknown error'}`, "error");
        return;
      }

      const result = await response.json();

      if (result.success) {
        updateReceiptStatusInMessages(receiptId, 'ready');
        showReceiptProgress(receiptId, fileName, 'ready');
        hideReceiptProgress(receiptId, 4000);
        if (actionsEl) actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Processed</span>';
        showToast("Receipt processed and ready!", "success");
      }

      // Fetch bot messages posted during processing
      _fetchBotMessages();
    } catch (err) {
      console.error("[Messages] Force process error:", err);
      showReceiptProgress(receiptId, fileName, 'error');
      hideReceiptProgress(receiptId, 6000);
      if (actionsEl) actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Failed</span>';
      showToast(`Failed to process receipt: ${err.message}`, "error");
    }
  }

  /**
   * Update the receipt status in messages (for UI feedback)
   */
  function updateReceiptStatusInMessages(receiptId, newStatus) {
    // Find messages with this receipt ID and update their status
    let updated = false;
    state.messages.forEach(msg => {
      if (msg.metadata?.pending_receipt_id === receiptId) {
        msg.metadata.receipt_status = newStatus;
        updated = true;
      }
    });

    if (updated) {
      renderMessages();
    }

    // Also update the DOM directly for immediate feedback
    const statusElements = document.querySelectorAll(`[data-receipt-id="${receiptId}"]`);
    statusElements.forEach(el => {
      // Remove old status classes
      el.classList.remove(
        'msg-receipt-status--pending',
        'msg-receipt-status--processing',
        'msg-receipt-status--ready',
        'msg-receipt-status--linked',
        'msg-receipt-status--duplicate',
        'msg-receipt-status--error'
      );
      // Add new status class
      el.classList.add(`msg-receipt-status--${newStatus}`);

      // Update label and icon
      const statusConfig = {
        pending: { label: 'Pending', icon: '⏳' },
        processing: { label: 'Processing', icon: '⚙️' },
        ready: { label: 'Ready', icon: '✅' },
        linked: { label: 'Done', icon: '✓' },
        duplicate: { label: 'Duplicate', icon: '!' },
        error: { label: 'Error', icon: '⚠️' }
      };
      const config = statusConfig[newStatus] || statusConfig.pending;
      const labelEl = el.querySelector('.msg-receipt-status-label');
      const iconEl = el.querySelector('.msg-receipt-status-icon');
      if (labelEl) labelEl.textContent = config.label;
      if (iconEl) iconEl.textContent = config.icon;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RECEIPT UPLOAD PROGRESS TRACKER
  // ─────────────────────────────────────────────────────────────────────────

  const receiptProgressTimers = {};

  const RECEIPT_PROGRESS_STEPS = {
    uploading:    { label: 'Uploading...',              width: 15,  color: 'blue' },
    scanning:     { label: 'Scanning receipt...',       width: 45,  color: 'blue' },
    categorizing: { label: 'Categorizing...',           width: 75,  color: 'blue' },
    ready:        { label: 'Done - Ready for review',   width: 100, color: 'green' },
    duplicate:    { label: 'Duplicate detected',        width: 100, color: 'amber' },
    error:        { label: 'Processing failed',         width: 100, color: 'red' },
    check_review: { label: 'Check detected - confirm in chat', width: 30, color: 'amber' },
  };

  function showReceiptProgress(receiptId, fileName, step) {
    const config = RECEIPT_PROGRESS_STEPS[step] || RECEIPT_PROGRESS_STEPS.uploading;

    // Get or create container
    let container = document.querySelector('.msg-receipt-progress-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'msg-receipt-progress-container';
      const chatMain = document.querySelector('.msg-chat-main');
      if (chatMain) {
        chatMain.appendChild(container);
      } else {
        return;
      }
    }

    // Get or create card for this receipt
    let card = container.querySelector(`[data-progress-receipt="${receiptId}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'msg-receipt-progress';
      card.setAttribute('data-progress-receipt', receiptId);
      card.innerHTML = `
        <div class="msg-receipt-progress-info">
          <span class="msg-receipt-progress-name"></span>
          <span class="msg-receipt-progress-step"></span>
        </div>
        <div class="msg-receipt-progress-bar">
          <div class="msg-receipt-progress-fill"></div>
        </div>
      `;
      container.appendChild(card);
      // Trigger entrance animation
      requestAnimationFrame(() => card.classList.add('msg-receipt-progress--visible'));
    }

    // Update content
    const nameEl = card.querySelector('.msg-receipt-progress-name');
    const stepEl = card.querySelector('.msg-receipt-progress-step');
    const fillEl = card.querySelector('.msg-receipt-progress-fill');

    if (nameEl) nameEl.textContent = fileName;
    if (stepEl) stepEl.textContent = config.label;
    if (fillEl) {
      fillEl.style.width = config.width + '%';
      fillEl.className = 'msg-receipt-progress-fill';
      fillEl.classList.add(`msg-receipt-progress-fill--${config.color}`);
    }

    // Update card state classes
    card.classList.remove('msg-receipt-progress--done', 'msg-receipt-progress--error', 'msg-receipt-progress--duplicate');
    if (step === 'ready') card.classList.add('msg-receipt-progress--done');
    if (step === 'error') card.classList.add('msg-receipt-progress--error');
    if (step === 'duplicate') card.classList.add('msg-receipt-progress--duplicate');

    // Toggle progress animation
    if (['uploading', 'scanning', 'categorizing'].includes(step)) {
      fillEl.classList.add('msg-receipt-progress-fill--animated');
    } else {
      fillEl.classList.remove('msg-receipt-progress-fill--animated');
    }

    // Clear any existing cosmetic timer
    if (receiptProgressTimers[receiptId]) {
      clearTimeout(receiptProgressTimers[receiptId]);
      delete receiptProgressTimers[receiptId];
    }

    // Cosmetic timer: scanning -> categorizing after 4s
    if (step === 'scanning') {
      receiptProgressTimers[receiptId] = setTimeout(() => {
        const existing = container.querySelector(`[data-progress-receipt="${receiptId}"]`);
        if (existing && !existing.classList.contains('msg-receipt-progress--done') &&
            !existing.classList.contains('msg-receipt-progress--error')) {
          showReceiptProgress(receiptId, fileName, 'categorizing');
        }
      }, 4000);
    }
  }

  function hideReceiptProgress(receiptId, delay = 4000) {
    // Clear cosmetic timer
    if (receiptProgressTimers[receiptId]) {
      clearTimeout(receiptProgressTimers[receiptId]);
      delete receiptProgressTimers[receiptId];
    }

    setTimeout(() => {
      const container = document.querySelector('.msg-receipt-progress-container');
      if (!container) return;
      const card = container.querySelector(`[data-progress-receipt="${receiptId}"]`);
      if (!card) return;

      card.classList.add('msg-receipt-progress--hiding');
      card.addEventListener('animationend', () => {
        card.remove();
        // Remove container if empty
        if (container.children.length === 0) {
          container.remove();
        }
      }, { once: true });
    }, delay);
  }

  function renderAttachmentsPreview() {
    if (state.attachments.length === 0) {
      DOM.attachmentsPreview.style.display = "none";
      return;
    }

    DOM.attachmentsPreview.style.display = "flex";
    DOM.attachmentsPreview.innerHTML = state.attachments
      .map(
        (att) => `
        <div class="msg-attachment-preview" data-attachment-id="${att.id}">
          ${
            att.preview
              ? `<img src="${att.preview}" alt="${escapeHtml(att.name)}" />`
              : `<span class="msg-attachment-preview-icon">📄</span>`
          }
          <span class="msg-attachment-preview-name">${escapeHtml(att.name)}</span>
          <button type="button" class="msg-attachment-remove" data-attachment-id="${att.id}">×</button>
        </div>
      `
      )
      .join("");
  }

  function removeAttachment(attachmentId) {
    const att = state.attachments.find((a) => a.id === attachmentId);
    if (att?.preview) {
      URL.revokeObjectURL(att.preview);
    }
    state.attachments = state.attachments.filter((a) => a.id !== attachmentId);
    renderAttachmentsPreview();
  }

  function clearAttachments() {
    state.attachments.forEach((att) => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
    state.attachments = [];
    DOM.attachmentsPreview.style.display = "none";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH
  // ─────────────────────────────────────────────────────────────────────────
  async function searchMessages(query, currentChannelOnly = true) {
    const searchResultsEl = document.getElementById("searchResults");
    if (!searchResultsEl) return;

    if (!query || query.length < 2) {
      searchResultsEl.innerHTML =
        '<div class="msg-search-hint">Enter at least 2 characters to search</div>';
      return;
    }

    searchResultsEl.innerHTML =
      '<div class="msg-search-loading">Searching...</div>';

    try {
      let url = `${API_BASE}/messages/search?q=${encodeURIComponent(query)}`;
      if (currentChannelOnly && state.currentChannel) {
        url += `&channel_type=${state.currentChannel.type}`;
        // Use project_id for project channels, channel_id for custom/direct
        if (state.currentChannel.type.startsWith("project_")) {
          url += `&project_id=${state.currentChannel.projectId}`;
        } else {
          url += `&channel_id=${state.currentChannel.id}`;
        }
      }

      const res = await authFetch(url);
      if (!res.ok) throw new Error("Search failed");

      const data = await res.json();
      const results = data.messages || data || [];

      if (results.length === 0) {
        searchResultsEl.innerHTML =
          '<div class="msg-search-empty">No messages found</div>';
        return;
      }

      searchResultsEl.innerHTML = results
        .map((msg) => {
          const user = state.users.find((u) => u.user_id === msg.user_id);
          const time = formatDateTime(msg.created_at);
          return `
            <button type="button" class="msg-search-result" data-message-id="${msg.id}">
              <div class="msg-search-result-header">
                <span class="msg-search-result-author">${escapeHtml(user?.user_name || "Unknown")}</span>
                <span class="msg-search-result-time">${time}</span>
              </div>
              <div class="msg-search-result-content">${highlightSearchTerm(msg.content, query)}</div>
            </button>
          `;
        })
        .join("");
    } catch (err) {
      console.error("[Messages] Search error:", err);
      searchResultsEl.innerHTML =
        '<div class="msg-search-error">Search failed. Please try again.</div>';
    }
  }

  function highlightSearchTerm(text, term) {
    if (!text || !term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${escapeRegex(term)})`, "gi");
    return escaped.replace(regex, '<mark class="msg-highlight">$1</mark>');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NEW CHANNEL MODAL
  // ─────────────────────────────────────────────────────────────────────────
  let channelMembersPicker = null;

  function openNewChannelModal() {
    DOM.newChannelModal.classList.remove("hidden");

    // Initialize people picker for members
    const container = document.getElementById("channelMembersPicker");
    if (container && window.createPeoplePicker) {
      channelMembersPicker = window.createPeoplePicker(container, {
        multiple: true,
        placeholder: "Select members...",
      });
    }
  }

  function closeNewChannelModal() {
    DOM.newChannelModal.classList.add("hidden");
    document.getElementById("newChannelForm")?.reset();
    if (channelMembersPicker) {
      channelMembersPicker.clear();
    }
  }

  async function createChannel() {
    const typeEl = document.querySelector('input[name="channelType"]:checked');
    const nameEl = document.getElementById("newChannelName");
    const descEl = document.getElementById("newChannelDescription");

    const channelType = typeEl?.value || "custom";
    const name = nameEl?.value.trim();
    const description = descEl?.value.trim();
    const memberIds = channelMembersPicker?.getIds() || [];

    if (channelType === "custom" && !name) {
      showToast("Please enter a channel name", "warning");
      return;
    }

    if (channelType === "direct" && memberIds.length === 0) {
      showToast("Please select at least one member", "warning");
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/messages/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: channelType === "direct" ? CHANNEL_TYPES.DIRECT : CHANNEL_TYPES.CUSTOM,
          name: name,
          description: description,
          member_ids: memberIds,
        }),
      });

      if (!res.ok) throw new Error("Failed to create channel");

      const data = await res.json();
      const channel = data.channel || data;

      // Check if channel already existed or is new
      if (data.existing) {
        showToast("Opening existing conversation", "info");
      } else {
        state.channels.push(channel);
        showToast("Channel created successfully", "success");
      }

      renderChannels();
      closeNewChannelModal();

      // Auto-select and open the channel
      setTimeout(() => {
        const channelItem = document.querySelector(
          `.msg-channel-item[data-channel-type="${channel.type}"][data-channel-id="${channel.id}"]`
        );
        if (channelItem) {
          channelItem.click();
        } else {
          selectChannel(channel.type, channel.id, null, channel.name);
        }
      }, 100);
    } catch (err) {
      console.error("[Messages] Create channel error:", err);
      showToast("Failed to create channel", "error");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL INFO MODAL
  // ─────────────────────────────────────────────────────────────────────────
  function openChannelInfoModal() {
    if (!state.currentChannel) return;

    const content = document.getElementById("channelInfoContent");
    if (!content) return;

    let html = `
      <div class="msg-info-field">
        <label>Channel Name</label>
        <span>${escapeHtml(state.currentChannel.name || "Unknown")}</span>
      </div>
      <div class="msg-info-field">
        <label>Type</label>
        <span>${state.currentChannel.type.replace(/_/g, " ")}</span>
      </div>
    `;

    if (state.currentChannel.projectId) {
      const project = state.projects.find(
        (p) => p.project_id === state.currentChannel.projectId
      );
      html += `
        <div class="msg-info-field">
          <label>Project</label>
          <span>${escapeHtml(project?.project_name || "Unknown")}</span>
        </div>
      `;
    }

    content.innerHTML = html;
    DOM.channelInfoModal.classList.remove("hidden");
  }

  function closeChannelInfoModal() {
    DOM.channelInfoModal.classList.add("hidden");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MANAGE PROJECT CHANNELS MODAL
  // ─────────────────────────────────────────────────────────────────────────
  let currentManageProjectId = null;
  let currentManageProjectName = "";

  function openManageProjectChannelsModal(projectId, projectName) {
    if (!DOM.manageProjectChannelsModal) return;

    currentManageProjectId = projectId;
    currentManageProjectName = projectName;

    // Update modal title
    const titleEl = document.getElementById("manageChannelsProjectName");
    if (titleEl) titleEl.textContent = projectName;

    // Get current config
    const config = getProjectChannelConfig(projectId);

    // Render channel toggles
    renderChannelToggles(config);

    DOM.manageProjectChannelsModal.classList.remove("hidden");
  }

  function closeManageProjectChannelsModal() {
    if (DOM.manageProjectChannelsModal) {
      DOM.manageProjectChannelsModal.classList.add("hidden");
    }
    currentManageProjectId = null;
    currentManageProjectName = "";
  }

  function renderChannelToggles(config) {
    const container = document.getElementById("channelTogglesList");
    if (!container) return;

    let html = `
      <!-- Fixed channels (cannot be removed) -->
      <div class="channel-toggle-item channel-toggle-fixed">
        <div class="channel-toggle-info">
          <span class="channel-toggle-hash">#</span>
          <span class="channel-toggle-name">General</span>
          <span class="channel-toggle-badge">Default</span>
        </div>
        <span class="channel-toggle-status">Always enabled</span>
      </div>
      <div class="channel-toggle-item channel-toggle-fixed">
        <div class="channel-toggle-info">
          <span class="channel-toggle-hash">#</span>
          <span class="channel-toggle-name">Receipts</span>
          <span class="channel-toggle-badge channel-toggle-badge-protected">Protected</span>
        </div>
        <span class="channel-toggle-status">Cannot be removed</span>
      </div>

      <!-- Optional channels -->
      <div class="channel-toggles-divider">
        <span>Optional Channels</span>
      </div>
    `;

    // Add optional channels
    OPTIONAL_PROJECT_CHANNELS.forEach(channel => {
      const isEnabled = config.channels.includes(channel.key);
      html += `
        <div class="channel-toggle-item">
          <div class="channel-toggle-info">
            <span class="channel-toggle-hash">#</span>
            <span class="channel-toggle-name">${escapeHtml(channel.label)}</span>
          </div>
          <label class="channel-toggle-switch">
            <input type="checkbox"
                   data-channel-key="${channel.key}"
                   ${isEnabled ? "checked" : ""} />
            <span class="channel-toggle-slider"></span>
          </label>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  function saveProjectChannelChanges() {
    if (!currentManageProjectId) return;

    const container = document.getElementById("channelTogglesList");
    if (!container) return;

    // Collect enabled channels (always include default ones)
    const enabledChannels = [...DEFAULT_PROJECT_CHANNELS];

    // Add optional channels that are checked
    container.querySelectorAll("input[type='checkbox']").forEach(checkbox => {
      if (checkbox.checked && checkbox.dataset.channelKey) {
        enabledChannels.push(checkbox.dataset.channelKey);
      }
    });

    // Save config
    saveProjectChannelConfig(currentManageProjectId, { channels: enabledChannels });

    // Re-render project channels
    renderProjectChannels();

    // Close modal
    closeManageProjectChannelsModal();

    showToast("Channel settings saved", "success");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH MODAL
  // ─────────────────────────────────────────────────────────────────────────
  function openSearchModal() {
    DOM.searchMessagesModal.classList.remove("hidden");
    document.getElementById("searchMessagesInput")?.focus();
  }

  function closeSearchModal() {
    DOM.searchMessagesModal.classList.add("hidden");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUPABASE REALTIME
  // ─────────────────────────────────────────────────────────────────────────
  function initSupabaseRealtime() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn("[Messages] Supabase not configured, realtime disabled");
      return;
    }

    // Check if Supabase client is available
    if (typeof supabase === "undefined") {
      console.warn("[Messages] Supabase client not loaded");
      return;
    }

    try {
      state.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("[Messages] Supabase client initialized");
    } catch (err) {
      console.error("[Messages] Supabase init error:", err);
    }
  }

  // ── Polling fallback state ──
  let pollingTimer = null;
  const POLL_INTERVAL_MS = 4000;
  let realtimeConnected = false;

  function subscribeToChannel(channel) {
    // Stop any existing polling
    stopMessagePolling();

    if (!state.supabaseClient) {
      // No Supabase client - rely on polling only
      console.warn("[Messages] No Supabase client, using polling fallback");
      startMessagePolling();
      return;
    }

    // Unsubscribe from previous channel
    if (state.messageSubscription) {
      state.messageSubscription.unsubscribe();
    }
    if (state.typingSubscription) {
      state.typingSubscription.unsubscribe();
    }

    const channelKey = `${channel.type}:${channel.id || channel.projectId}`;
    realtimeConnected = false;

    // Subscribe to new messages (Postgres Changes)
    // NOTE: We subscribe to ALL inserts on the messages table (no filter)
    // because channel_key is a GENERATED column that does not work with
    // Supabase Realtime filters. We filter client-side instead.
    console.log("[Messages] Subscribing to realtime for channel:", channelKey);
    state.messageSubscription = state.supabaseClient
      .channel(`messages:${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new;
          if (!msg) return;

          // Client-side filter: only handle messages for the current channel
          const msgKey = msg.channel_key ||
            `${msg.channel_type}:${msg.channel_id || msg.project_id}`;
          if (msgKey !== channelKey) return;

          console.log("[Messages] Realtime message received:", msg.id);
          handleNewMessage(msg);
        }
      )
      .subscribe((status) => {
        console.log("[Messages] Realtime subscription status:", status);
        if (status === "SUBSCRIBED") {
          realtimeConnected = true;
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          realtimeConnected = false;
          console.warn("[Messages] Realtime disconnected, relying on polling");
        }
      });

    // Subscribe to typing indicators (Presence channel)
    state.typingSubscription = state.supabaseClient
      .channel(`typing:${channelKey}`)
      .on("presence", { event: "sync" }, () => {
        const presenceState = state.typingSubscription.presenceState();
        updateTypingIndicator(presenceState);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {})
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {})
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Messages] Typing presence subscribed");
        }
      });

    // Always start polling as a safety net
    startMessagePolling();
  }

  /**
   * Polling fallback: fetches recent messages every few seconds
   * to catch anything the realtime subscription might miss.
   */
  function startMessagePolling() {
    stopMessagePolling();

    pollingTimer = setInterval(async () => {
      if (!state.currentChannel) return;

      try {
        const ch = state.currentChannel;
        let url = `${API_BASE}/messages?channel_type=${ch.type}&limit=15`;

        if (ch.type.startsWith("project_")) {
          url += `&project_id=${ch.projectId}`;
        } else {
          url += `&channel_id=${ch.id}`;
        }

        const res = await authFetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const freshMessages = data.messages || data || [];

        // Check for messages we don't already have
        const existingIds = new Set(state.messages.map(m => m.id));
        const newMessages = freshMessages.filter(m => !existingIds.has(m.id));

        if (newMessages.length > 0) {
          console.log(`[Messages] Polling found ${newMessages.length} new message(s)`);
          newMessages.forEach(msg => handleNewMessage(msg));
        }
      } catch (err) {
        // Silently ignore polling errors
      }
    }, POLL_INTERVAL_MS);
  }

  function stopMessagePolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function handleNewMessage(message) {
    // Check if message already exists (by real ID)
    const existingIndex = state.messages.findIndex((m) => m.id === message.id);
    if (existingIndex !== -1) {
      // Message already exists, skip
      return;
    }

    // For own messages: replace temp message with real one (optimistic update completion)
    if (message.user_id === state.currentUser?.user_id) {
      // Try to match by receipt ID first, then by first temp message
      const receiptId = message.metadata?.pending_receipt_id;
      let tempIndex = -1;
      if (receiptId) {
        tempIndex = state.messages.findIndex((m) =>
          m.id?.toString().startsWith("temp-") &&
          m.metadata?.pending_receipt_id === receiptId
        );
      }
      if (tempIndex === -1) {
        tempIndex = state.messages.findIndex((m) =>
          m.id?.toString().startsWith("temp-")
        );
      }
      if (tempIndex !== -1) {
        state.messages[tempIndex] = message;
        renderMessages();
        return;
      }
    }

    // New message - add and render
    state.messages.push(message);

    // Auto-scroll if user is near the bottom (within 150px)
    const container = DOM.messagesContainer;
    const wasNearBottom = container &&
      (container.scrollHeight - container.scrollTop - container.clientHeight < 150);

    renderMessages();

    if (wasNearBottom) {
      setTimeout(() => scrollToBottom(true), 60);
    }

    // Track active check flow from bot messages
    if (message.metadata?.check_flow_active && message.metadata?.check_flow_state) {
      state.activeCheckFlow = {
        receiptId: message.metadata.pending_receipt_id,
        state: message.metadata.check_flow_state,
      };
    } else if (message.metadata?.check_flow_state === 'completed' ||
               message.metadata?.check_flow_state === 'cancelled') {
      state.activeCheckFlow = null;
    }

    // Track active duplicate flow from bot messages
    if (message.metadata?.duplicate_flow_active && message.metadata?.duplicate_flow_state === 'awaiting_confirmation') {
      state.activeDuplicateFlow = {
        receiptId: message.metadata.pending_receipt_id,
      };
    } else if (message.metadata?.duplicate_flow_state === 'confirmed' ||
               message.metadata?.duplicate_flow_state === 'skipped') {
      state.activeDuplicateFlow = null;
    }

    // Show toast notification only for messages from others
    if (message.user_id !== state.currentUser?.user_id) {
      showMessageNotification(message);
    }
  }

  /**
   * Show toast notification for incoming message
   */
  function showMessageNotification(message) {
    if (typeof Toast === "undefined") return;

    const sender = state.users.find((u) => u.user_id === message.user_id) || { user_name: message.user_name };
    const senderName = sender?.user_name || message.user_name || "Unknown";
    const senderPhoto = sender?.user_photo;
    const senderColor = getAvatarColor(sender);
    const initials = getInitials(senderName);

    // Check if current user is mentioned
    const isMentioned = checkIfMentioned(message.content, state.currentUser);

    // Truncate message content
    const contentPreview = message.content?.length > 60
      ? message.content.substring(0, 60) + "..."
      : message.content || "";

    // Build channel name for title
    let channelName = "";
    if (state.currentChannel) {
      channelName = state.currentChannel.name || "Message";
    }

    const toastOptions = {
      avatar: {
        photo: senderPhoto,
        color: senderColor,
        initials: initials,
      },
      onClick: () => {
        // Scroll to message if we're in the same channel
        scrollToMessage(message.id);
      },
    };

    if (isMentioned) {
      // Mention notification (highlighted)
      Toast.mention(
        `${senderName} mentioned you`,
        contentPreview,
        toastOptions
      );
      // Play mention sound
      playNotificationSound("mention");
    } else {
      // Regular chat notification
      Toast.chat(
        `${senderName} in ${channelName}`,
        contentPreview,
        toastOptions
      );
      // Play regular notification sound
      playNotificationSound("message");
    }
  }

  /**
   * Check if message mentions the current user
   */
  function checkIfMentioned(content, currentUser) {
    if (!content || !currentUser) return false;
    const mentionPattern = new RegExp(`@${escapeRegex(currentUser.user_name)}\\b`, "i");
    return mentionPattern.test(content);
  }

  /**
   * Play notification sound
   */
  function playNotificationSound(type = "message") {
    try {
      // Create audio context for notification sounds
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === "mention") {
        // Higher pitch for mentions
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.1;
      } else {
        // Normal pitch for messages
        oscillator.frequency.value = 660;
        gainNode.gain.value = 0.08;
      }

      oscillator.type = "sine";
      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (err) {
      // Silently fail if audio context not available
      console.log("[Messages] Audio notification not available");
    }
  }

  /**
   * Scroll to a specific message
   */
  function scrollToMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: "smooth", block: "center" });
      // Brief highlight
      messageEl.classList.add("msg-message--highlight");
      setTimeout(() => messageEl.classList.remove("msg-message--highlight"), 2000);
    }
  }

  function broadcastTyping() {
    if (!state.supabaseClient || !state.currentChannel) return;

    const now = Date.now();
    if (now - state.lastTypingBroadcast < 2000) return; // Throttle to every 2 seconds

    state.lastTypingBroadcast = now;

    const channelKey = `${state.currentChannel.type}:${state.currentChannel.id || state.currentChannel.projectId}`;

    state.supabaseClient.channel(`typing:${channelKey}`).track({
      user_id: state.currentUser?.user_id,
      user_name: state.currentUser?.user_name,
    });
  }

  function updateTypingIndicator(presenceState) {
    const typingUsers = Object.values(presenceState)
      .flat()
      .filter((u) => u.user_id !== state.currentUser?.user_id)
      .map((u) => u.user_name);

    if (typingUsers.length === 0) {
      DOM.typingIndicator.style.display = "none";
      return;
    }

    DOM.typingIndicator.style.display = "flex";

    if (typingUsers.length === 1) {
      DOM.typingText.textContent = `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      DOM.typingText.textContent = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else {
      DOM.typingText.textContent = `${typingUsers.length} people are typing...`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────
  function setupEventListeners() {
    // Channel selection
    document.addEventListener("click", (e) => {
      const channelItem = e.target.closest(".msg-channel-item");
      if (channelItem) {
        const type = channelItem.dataset.channelType;
        const id = channelItem.dataset.channelId;
        const projectId = channelItem.dataset.projectId;
        const name = channelItem.dataset.channelName;
        selectChannel(type, id, projectId, name, channelItem);
      }
    });

    // Channel sections collapse/expand
    document.querySelectorAll(".msg-channel-section-header").forEach((header) => {
      header.addEventListener("click", () => {
        const section = header.closest(".msg-channel-section");
        section.classList.toggle("collapsed");
        const icon = header.querySelector(".msg-section-icon");
        if (icon) {
          icon.textContent = section.classList.contains("collapsed") ? "▸" : "▾";
        }
      });
    });

    // Project color picker
    document.addEventListener("click", (e) => {
      const colorDot = e.target.closest(".msg-project-color-dot");
      if (colorDot) {
        e.stopPropagation();
        showProjectColorPicker(colorDot, colorDot.dataset.projectId);
        return;
      }
      // Close color picker if clicking outside
      const picker = document.querySelector(".msg-color-picker-popup");
      if (picker && !e.target.closest(".msg-color-picker-popup")) {
        picker.remove();
      }
    });

    // Channel search
    DOM.channelSearchInput?.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase();
      document.querySelectorAll(".msg-channel-item").forEach((item) => {
        const name = item.querySelector(".msg-channel-name")?.textContent.toLowerCase();
        item.style.display = name?.includes(query) ? "" : "none";
      });
      document.querySelectorAll(".msg-project-group").forEach((group) => {
        const name = group.querySelector(".msg-project-name")?.textContent.toLowerCase();
        const hasVisibleChannels = Array.from(
          group.querySelectorAll(".msg-channel-item")
        ).some((c) => c.style.display !== "none");
        group.style.display = name?.includes(query) || hasVisibleChannels ? "" : "none";
      });
    });

    // Message input
    DOM.messageInput?.addEventListener("input", (e) => {
      autoResizeTextarea(e.target);
      DOM.btnSendMessage.disabled = !e.target.value.trim();
      handleMentionInput(e);
      broadcastTyping();
    });

    DOM.messageInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
      if (e.key === "Escape") {
        hideMentionDropdown();
      }
    });

    DOM.btnSendMessage?.addEventListener("click", sendMessage);

    // Mention dropdown
    DOM.mentionDropdown?.addEventListener("click", (e) => {
      const item = e.target.closest(".msg-mention-item");
      if (item) {
        insertMention(item.dataset.userId, item.dataset.userName);
      }
    });

    // Message actions
    DOM.messagesList?.addEventListener("click", (e) => {
      // Intercept internal channel links (e.g. "Go to Payroll")
      const channelLink = e.target.closest("a[href*='messages.html?channel=']");
      if (channelLink) {
        e.preventDefault();
        try {
          const url = new URL(channelLink.href, window.location.origin);
          const channelId = url.searchParams.get("channel");
          if (channelId) {
            const ch = state.channels.find(c => c.id === channelId);
            selectChannel(ch?.type || "group", channelId, null, ch?.name || "Payroll");
          }
        } catch (err) {
          console.error("[Messages] Channel link navigation error:", err);
        }
        return;
      }

      const action = e.target.closest("[data-action]")?.dataset.action;
      const messageId = e.target.closest("[data-message-id]")?.dataset.messageId;

      if (!action) return;

      // Duplicate flow button actions (new conversational flow)
      if (action === "dup-confirm-yes") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Processing...</span>';
          _forwardToDuplicateAction(receiptId, "confirm_process");
          state.activeDuplicateFlow = null;
        }
        return;
      }
      if (action === "dup-confirm-no") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Skipped</span>';
          _forwardToDuplicateAction(receiptId, "skip");
          state.activeDuplicateFlow = null;
        }
        return;
      }

      // Legacy bot action buttons (Process Anyway / Skip)
      if (action === "force-process") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        if (receiptId) handleForceProcessReceipt(receiptId, e.target.closest(".msg-bot-actions"));
        return;
      }
      if (action === "dismiss-duplicate") {
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Skipped</span>';
        }
        return;
      }

      // Check flow button actions (material / labor / not a check)
      if (["check-confirm-material", "check-confirm-labor", "check-confirm-no"].includes(action)) {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          const actionMap = {
            "check-confirm-material": "confirm_material",
            "check-confirm-labor": "confirm_labor",
            "check-confirm-no": "deny_check",
          };
          const label = action === "check-confirm-labor" ? "Routing to Payroll..." : "Processing...";
          actionsEl.innerHTML = `<span class="msg-bot-actions-loading">${label}</span>`;
          _forwardToCheckAction(receiptId, actionMap[action], null);
        }
        return;
      }

      if (action === "check-split-yes" || action === "check-split-no") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Processing...</span>';
          const checkAction = action === "check-split-yes" ? "split_yes" : "split_no";
          _forwardToCheckAction(receiptId, checkAction, null);
        }
        return;
      }

      if (action === "check-category-confirm") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Creating expenses...</span>';
          _forwardToCheckAction(receiptId, "confirm_categories", null);
        }
        return;
      }

      if (action === "check-cancel") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Cancelled</span>';
          _forwardToCheckAction(receiptId, "cancel", null);
          state.activeCheckFlow = null;
        }
        return;
      }

      // Receipt flow button actions
      if (action === "receipt-single-project") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Creating expense...</span>';
          _forwardToReceiptAction(receiptId, "single_project", null);
        }
        return;
      }

      if (action === "receipt-split-projects") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Processing...</span>';
          _forwardToReceiptAction(receiptId, "split_projects", null);
        }
        return;
      }

      if (action === "receipt-split-done") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-loading">Creating expenses...</span>';
          _forwardToReceiptAction(receiptId, "split_done", null);
        }
        return;
      }

      if (action === "receipt-cancel") {
        const receiptId = e.target.closest("[data-receipt-id]")?.dataset.receiptId;
        const actionsEl = e.target.closest(".msg-bot-actions");
        if (receiptId && actionsEl) {
          actionsEl.innerHTML = '<span class="msg-bot-actions-dismissed">Cancelled</span>';
          _forwardToReceiptAction(receiptId, "cancel", null);
          state.activeReceiptFlow = null;
        }
        return;
      }

      if (!messageId) return;

      switch (action) {
        case "reply":
          setReplyTo(messageId);
          break;
        case "thread":
          openThread(messageId);
          break;
        case "react":
        case "add-reaction":
          showEmojiPicker(messageId);
          break;
      }
    });

    // Reactions
    DOM.messagesList?.addEventListener("click", (e) => {
      const reaction = e.target.closest(".msg-reaction:not(.msg-reaction--add)");
      if (reaction) {
        const emoji = reaction.dataset.emoji;
        const messageId = reaction.dataset.messageId;
        if (emoji && messageId) {
          toggleReaction(messageId, emoji);
        }
      }
    });

    // Reply cancel
    DOM.btnCancelReply?.addEventListener("click", clearReply);

    // Attachments
    DOM.btnAttachFile?.addEventListener("click", openFilePicker);
    DOM.attachmentsPreview?.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".msg-attachment-remove");
      if (removeBtn) {
        removeAttachment(removeBtn.dataset.attachmentId);
      }
    });

    // Thread panel
    DOM.btnCloseThread?.addEventListener("click", closeThread);
    DOM.btnToggleThread?.addEventListener("click", () => {
      if (DOM.threadPanel.style.display === "none") {
        // Need to select a message first
        showToast("Select a message to view its thread", "info");
      } else {
        closeThread();
      }
    });

    DOM.threadInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendThreadReply();
      }
    });
    DOM.btnSendThreadReply?.addEventListener("click", sendThreadReply);

    // Header buttons
    DOM.btnNewChannel?.addEventListener("click", openNewChannelModal);
    DOM.btnSearchMessages?.addEventListener("click", openSearchModal);
    DOM.btnChannelInfo?.addEventListener("click", openChannelInfoModal);

    // Mobile sidebar toggle
    DOM.btnMobileMenu?.addEventListener("click", toggleMobileSidebar);
    DOM.sidebarOverlay?.addEventListener("click", closeMobileSidebar);

    // New Channel Modal
    document.getElementById("btnCloseNewChannelModal")?.addEventListener("click", closeNewChannelModal);
    document.getElementById("btnCancelNewChannel")?.addEventListener("click", closeNewChannelModal);
    document.getElementById("btnCreateChannel")?.addEventListener("click", createChannel);

    // Channel type toggle in modal
    document.querySelectorAll('input[name="channelType"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        const nameField = document.getElementById("channelNameField");
        if (nameField) {
          nameField.style.display = e.target.value === "direct" ? "none" : "";
        }
      });
    });

    // Channel Info Modal
    document.getElementById("btnCloseChannelInfoModal")?.addEventListener("click", closeChannelInfoModal);
    document.getElementById("btnCloseChannelInfo")?.addEventListener("click", closeChannelInfoModal);

    // Manage Project Channels Modal
    document.getElementById("btnCloseManageChannelsModal")?.addEventListener("click", closeManageProjectChannelsModal);
    document.getElementById("btnCancelManageChannels")?.addEventListener("click", closeManageProjectChannelsModal);
    document.getElementById("btnSaveChannelSettings")?.addEventListener("click", saveProjectChannelChanges);

    // Project settings button (gear icon) - event delegation
    document.addEventListener("click", (e) => {
      const settingsBtn = e.target.closest(".msg-project-settings-btn");
      if (settingsBtn) {
        e.stopPropagation();
        const projectId = settingsBtn.dataset.projectId;
        const projectName = settingsBtn.dataset.projectName;
        openManageProjectChannelsModal(projectId, projectName);
      }
    });

    // Project header click - toggle collapse (but not if clicking on color dot or settings)
    document.addEventListener("click", (e) => {
      const projectHeader = e.target.closest(".msg-project-header");
      if (projectHeader) {
        // Don't toggle if clicking on color dot or settings button
        if (e.target.closest(".msg-project-color-dot") || e.target.closest(".msg-project-settings-btn")) {
          return;
        }
        const projectId = projectHeader.dataset.projectId;
        if (projectId) {
          toggleProjectCollapse(projectId);
        }
      }
    });

    // Main section header click - toggle collapse (Projects, Direct Messages, Custom Channels)
    document.addEventListener("click", (e) => {
      const sectionHeader = e.target.closest(".msg-channel-section-header");
      if (sectionHeader) {
        const sectionName = sectionHeader.dataset.section;
        if (sectionName) {
          toggleSectionCollapse(sectionName);
        }
      }
    });

    // Search Modal
    document.getElementById("btnCloseSearchModal")?.addEventListener("click", closeSearchModal);

    let searchTimeout;
    document.getElementById("searchMessagesInput")?.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const currentOnly = document.getElementById("searchInCurrentChannel")?.checked;
        searchMessages(e.target.value, currentOnly);
      }, 300);
    });

    // Search result click
    document.getElementById("searchResults")?.addEventListener("click", (e) => {
      const result = e.target.closest(".msg-search-result");
      if (result) {
        const messageId = result.dataset.messageId;
        closeSearchModal();
        scrollToMessage(messageId);
      }
    });

    // Global search
    DOM.globalSearchInput?.addEventListener("input", (e) => {
      const query = e.target.value;
      if (query.length >= 2) {
        openSearchModal();
        document.getElementById("searchMessagesInput").value = query;
        document.getElementById("searchInCurrentChannel").checked = false;
        searchMessages(query, false);
      }
    });

    // Click outside modals to close
    [DOM.newChannelModal, DOM.channelInfoModal, DOM.searchMessagesModal, DOM.manageProjectChannelsModal].forEach(
      (modal) => {
        modal?.addEventListener("click", (e) => {
          if (e.target === modal) {
            modal.classList.add("hidden");
          }
        });
      }
    );

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Escape to close modals
      if (e.key === "Escape") {
        closeNewChannelModal();
        closeChannelInfoModal();
        closeSearchModal();
        closeManageProjectChannelsModal();
        closeThread();
      }
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
      }
    });

    // Mobile keyboard detection using Visual Viewport API
    setupMobileKeyboardDetection();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE KEYBOARD HANDLING (unified handler for iOS + Android)
  // ─────────────────────────────────────────────────────────────────────────
  function setupMobileKeyboardDetection() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
                     (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isMobile) return;

    const chatArea = document.querySelector('.msg-chat-area');
    const messagesContainer = DOM.messagesList?.parentElement;

    let initialHeight = window.visualViewport?.height || window.innerHeight;
    let keyboardOpen = false;
    let rafId = null;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize);

      // Recalibrate on orientation change
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          initialHeight = window.visualViewport.height;
          if (keyboardOpen) handleKeyboardClose();
        }, 400);
      });
    } else {
      // Fallback: detect via focus/blur
      DOM.messageInput?.addEventListener('focus', () => {
        setTimeout(() => { if (!keyboardOpen) handleKeyboardOpen(); }, 300);
      });
      DOM.messageInput?.addEventListener('blur', () => {
        setTimeout(() => { if (keyboardOpen) handleKeyboardClose(); }, 200);
      });
    }

    function onViewportResize() {
      // Debounce via rAF - only process last resize per frame
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentHeight = window.visualViewport.height;
        const heightDiff = initialHeight - currentHeight;

        if (heightDiff > 150 && !keyboardOpen) {
          handleKeyboardOpen();
        } else if (heightDiff < 100 && keyboardOpen) {
          handleKeyboardClose();
        }

        // Adjust chat area to visual viewport while keyboard is visible
        if (keyboardOpen && chatArea && window.innerWidth <= 768) {
          chatArea.style.height = currentHeight + 'px';
        }
      });
    }

    function handleKeyboardOpen() {
      keyboardOpen = true;
      document.body.classList.add('keyboard-open');

      // Scroll messages to bottom after keyboard settles
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 150);
    }

    function handleKeyboardClose() {
      keyboardOpen = false;
      document.body.classList.remove('keyboard-open');

      if (chatArea) {
        chatArea.style.height = '';
      }
    }

    // Allow message scrolling while keyboard is open
    if (messagesContainer) {
      messagesContainer.addEventListener('touchmove', (e) => {
        e.stopPropagation();
      }, { passive: true });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE SIDEBAR
  // ─────────────────────────────────────────────────────────────────────────
  function toggleMobileSidebar() {
    const sidebar = DOM.channelsSidebar;
    const overlay = DOM.sidebarOverlay;
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains("is-open");
    if (isOpen) {
      closeMobileSidebar();
    } else {
      sidebar.classList.add("is-open");
      overlay?.classList.add("is-visible");
      document.body.style.overflow = "hidden";
    }
  }

  function closeMobileSidebar() {
    const sidebar = DOM.channelsSidebar;
    const overlay = DOM.sidebarOverlay;
    if (!sidebar) return;

    sidebar.classList.remove("is-open");
    overlay?.classList.remove("is-visible");
    document.body.style.overflow = "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY FUNCTIONS
  // ─────────────────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Avatar color helper - matches team.js format
  function getAvatarColor(user) {
    if (!user) return "hsl(200 70% 45%)";
    const ac = Number(user.avatar_color);
    const hue = Number.isFinite(ac) ? Math.max(0, Math.min(360, ac)) : stableHueFromString(user.user_id || user.user_name);
    return `hsl(${hue} 70% 45%)`;
  }

  function stableHueFromString(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  function getOtherUserInDM(channel) {
    if (!channel.members) return null;
    return channel.members.find((m) => m.user_id !== state.currentUser?.user_id);
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Google Chat style: "Today 3:23 PM", "Yesterday 3:23 PM", "Jan 15, 3:23 PM"
    if (msgDate.getTime() === today.getTime()) {
      return timeStr; // Just show time for today
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `Yesterday ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `${dateStr}, ${timeStr}`;
    }
  }

  function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatFileSize(bytes) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  function autoResizeTextarea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  }

  function scrollToBottom(smooth = false) {
    if (DOM.messagesContainer) {
      if (smooth) {
        DOM.messagesContainer.scrollTo({
          top: DOM.messagesContainer.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
      }
    }
  }

  function scrollToMessage(messageId) {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("msg-highlight-flash");
      setTimeout(() => el.classList.remove("msg-highlight-flash"), 2000);
    }
  }

  function showToast(message, type = "info") {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      console.log(`[Toast ${type}] ${message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MENTIONS FUNCTIONALITY
  // ─────────────────────────────────────────────────────────────────────────

  let mentionsCache = [];
  let mentionsLoaded = false;

  async function loadMentions() {
    try {
      console.log("[Messages] Loading mentions...");
      const response = await authFetch(`${API_BASE}/messages/mentions`);

      if (!response.ok) {
        throw new Error(`Failed to load mentions: ${response.status}`);
      }

      const data = await response.json();
      mentionsCache = data.mentions || [];
      mentionsLoaded = true;

      console.log(`[Messages] Loaded ${mentionsCache.length} mentions`);
      return mentionsCache;
    } catch (error) {
      console.error("[Messages] Error loading mentions:", error);
      return [];
    }
  }

  function renderMentions(mentions) {
    const listContainer = document.getElementById("mentionsList");
    const emptyState = document.getElementById("mentionsEmpty");
    const countEl = document.getElementById("mentionsCount");

    if (!listContainer) return;

    // Clear existing items (keep empty state)
    const existingItems = listContainer.querySelectorAll(".msg-mention-item");
    existingItems.forEach((item) => item.remove());

    // Update count
    const unreadCount = mentions.filter((m) => !m.is_read).length;
    if (countEl) {
      countEl.textContent = unreadCount > 0 ? `${unreadCount} unread` : "All read";
    }

    // Update badge
    updateMentionsBadge(unreadCount);

    // Show empty state if no mentions
    if (mentions.length === 0) {
      if (emptyState) emptyState.style.display = "";
      return;
    }

    if (emptyState) emptyState.style.display = "none";

    // Render mention items
    mentions.forEach((mention) => {
      const item = createMentionItem(mention);
      listContainer.appendChild(item);
    });
  }

  function createMentionItem(mention) {
    const item = document.createElement("div");
    item.className = `msg-mention-item${mention.is_read ? "" : " unread"}`;
    item.setAttribute("data-mention-id", mention.id);
    item.setAttribute("data-message-id", mention.message_id);
    item.setAttribute("data-channel-id", mention.channel_id);
    item.setAttribute("data-channel-type", mention.channel_type || "custom");
    if (mention.project_id) {
      item.setAttribute("data-project-id", mention.project_id);
    }

    // Get sender info
    const sender = state.users.find((u) => u.id === mention.sender_id) || {};
    const senderName = sender.full_name || sender.username || "Unknown";
    const initials = getInitials(senderName);

    // Format timestamp
    const timeAgo = formatRelativeTime(mention.created_at);

    // Channel name
    const channelName = mention.channel_name || "Unknown channel";

    // Message preview with mention highlighted
    const preview = highlightMention(mention.content || "", state.currentUser?.username);

    item.innerHTML = `
      <div class="msg-mention-avatar" style="color: ${getAvatarColor(senderName)}; border-color: ${getAvatarColor(senderName)}">${initials}</div>
      <div class="msg-mention-content">
        <div class="msg-mention-header">
          <span class="msg-mention-author">${escapeHtml(senderName)}</span>
          <span class="msg-mention-time">${timeAgo}</span>
        </div>
        <div class="msg-mention-channel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 9h16M4 15h16M10 3v18M14 3v18"/>
          </svg>
          <span>${escapeHtml(channelName)}</span>
        </div>
        <div class="msg-mention-preview">${preview}</div>
      </div>
    `;

    // Click handler - navigate to the message
    item.addEventListener("click", () => handleMentionClick(mention));

    return item;
  }

  function highlightMention(content, username) {
    if (!content || !username) return escapeHtml(content);

    // Truncate content if too long
    let text = content.length > 150 ? content.substring(0, 150) + "..." : content;

    // Escape HTML first
    text = escapeHtml(text);

    // Highlight @mentions
    const mentionRegex = new RegExp(`@(${username})`, "gi");
    text = text.replace(mentionRegex, '<span class="mention-highlight">@$1</span>');

    return text;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  async function handleMentionClick(mention) {
    console.log("[Messages] Clicking mention:", mention);

    // Mark as read
    if (!mention.is_read) {
      markMentionAsRead(mention.id);
    }

    // Navigate to the channel and message
    const channelType = mention.channel_type || "custom";
    const channelId = mention.channel_id;
    const projectId = mention.project_id;
    const channelName = mention.channel_name || "Channel";

    // Hide mentions view
    hideMentionsView();

    // Select the channel
    await selectChannel(channelType, channelId, projectId, channelName);

    // Scroll to the message after a short delay
    setTimeout(() => {
      scrollToMessage(mention.message_id);
    }, 300);
  }

  async function markMentionAsRead(mentionId) {
    try {
      await authFetch(`${API_BASE}/messages/mentions/${mentionId}/read`, {
        method: "POST",
      });

      // Update cache
      const mention = mentionsCache.find((m) => m.id === mentionId);
      if (mention) {
        mention.is_read = true;
      }

      // Update badge
      const unreadCount = mentionsCache.filter((m) => !m.is_read).length;
      updateMentionsBadge(unreadCount);

      // Update UI
      const item = document.querySelector(`[data-mention-id="${mentionId}"]`);
      if (item) {
        item.classList.remove("unread");
      }
    } catch (error) {
      console.error("[Messages] Error marking mention as read:", error);
    }
  }

  function updateMentionsBadge(count) {
    // Update mobile badge
    const mobileBadge = document.getElementById("mentionsBadge");
    // Update web badge
    const webBadge = document.getElementById("mentionsWebBadge");

    const badges = [mobileBadge, webBadge].filter(Boolean);

    badges.forEach((badge) => {
      if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = "";
      } else {
        badge.style.display = "none";
      }
    });
  }

  function showMentionsView() {
    const mentionsView = document.getElementById("mentionsView");
    const channelsList = document.getElementById("channelsList");
    const searchContainer = document.querySelector(".msg-channels-search");
    const headerBtn = document.querySelector(".msg-channels-header");

    if (mentionsView) mentionsView.style.display = "flex";
    if (channelsList) channelsList.style.display = "none";
    if (searchContainer) searchContainer.style.display = "none";
    if (headerBtn) headerBtn.style.display = "none";

    // Load mentions if not loaded yet
    if (!mentionsLoaded) {
      // Show loading state
      const listContainer = document.getElementById("mentionsList");
      if (listContainer) {
        listContainer.innerHTML = `
          <div class="msg-mentions-loading">
            <div class="msg-mentions-loading-spinner"></div>
            <span class="msg-mentions-loading-text">Loading mentions...</span>
          </div>
        `;
      }

      loadMentions().then((mentions) => {
        renderMentions(mentions);
      });
    } else {
      renderMentions(mentionsCache);
    }
  }

  function hideMentionsView() {
    const mentionsView = document.getElementById("mentionsView");
    const channelsList = document.getElementById("channelsList");
    const searchContainer = document.querySelector(".msg-channels-search");
    const headerBtn = document.querySelector(".msg-channels-header");

    if (mentionsView) mentionsView.style.display = "none";
    if (channelsList) channelsList.style.display = "";
    if (searchContainer) searchContainer.style.display = "";
    if (headerBtn) headerBtn.style.display = "";
  }

  // Load mentions badge count on init
  async function loadMentionsBadge() {
    try {
      const mentions = await loadMentions();
      const unreadCount = mentions.filter((m) => !m.is_read).length;
      updateMentionsBadge(unreadCount);
    } catch (error) {
      console.error("[Messages] Error loading mentions badge:", error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INIT ON DOM READY
  // ─────────────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export for debugging and external access
  window.MessagesModule = {
    state,
    selectChannel,
    sendMessage,
    searchMessages,
    openSearchModal,
    updateReceiptStatusInMessages,
    showMentionsView,
    hideMentionsView,
    loadMentions,
    loadMentionsBadge,
  };
})();
