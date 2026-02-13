/**
 * ============================================================================
 *  NGM HUB - Floating Chat Widget
 * ============================================================================
 *  Mini chat panel accessible from any page. Google Chat-style popup.
 *  Self-contained IIFE -- no dependency on messages.js.
 * ============================================================================
 */

(function () {
  "use strict";

  // Skip on the dedicated Messages page (full UI already exists)
  if (document.body.classList.contains("page-messages")) return;

  // -------------------------------------------------------------------------
  // CONFIGURATION
  // -------------------------------------------------------------------------
  const API_BASE = window.NGM_CONFIG?.API_BASE || window.API_BASE || "http://127.0.0.1:8000";
  const SUPABASE_URL = window.NGM_CONFIG?.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = window.NGM_CONFIG?.SUPABASE_ANON_KEY || "";
  const MESSAGES_LIMIT = 30;
  const LAST_CH_KEY = "chat_widget_last_channel";

  const CHANNEL_TYPES = {
    PROJECT_GENERAL: "project_general",
    PROJECT_ACCOUNTING: "project_accounting",
    PROJECT_RECEIPTS: "project_receipts",
    CUSTOM: "custom",
    DIRECT: "direct",
    GROUP: "group",
  };

  const PROJECT_COLORS = [
    "#3ecf8e","#10b981","#14b8a6","#06b6d4","#0ea5e9",
    "#3b82f6","#6366f1","#8b5cf6","#a855f7","#d946ef",
    "#ec4899","#f43f5e","#ef4444","#f97316","#f59e0b",
    "#eab308","#84cc16","#22c55e",
  ];

  // -------------------------------------------------------------------------
  // AUTH HELPERS
  // -------------------------------------------------------------------------
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function authFetch(url, options = {}) {
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    return fetch(url, { ...options, credentials: "include", headers });
  }

  // -------------------------------------------------------------------------
  // STATE
  // -------------------------------------------------------------------------
  const state = {
    isOpen: false,
    dataLoaded: false,
    currentUser: null,
    users: [],
    projects: [],
    channels: [],
    currentChannel: null,
    messages: [],
    unreadCounts: {},
    totalUnread: 0,
    supabaseClient: null,
    messageSubscription: null,
    unreadSubscription: null,
    realtimeConnected: false,
    isLoadingMessages: false,
    channelRequestId: 0,
  };

  // DOM reference cache
  const DOM = {};

  // -------------------------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------------------------
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function getProjectColor(projectId) {
    return PROJECT_COLORS[Math.abs(hashCode(projectId)) % PROJECT_COLORS.length];
  }

  function getChannelKey(type, channelId, projectId) {
    return type.startsWith("project_") ? `${type}:${projectId}` : `${type}:${channelId}`;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateSep(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }

  function getUserName(userId) {
    if (!userId) return "Unknown";
    const u = state.users.find(function (x) { return x.user_id === userId; });
    return u ? u.user_name : "Unknown";
  }

  function getUserColor(userId) {
    const u = state.users.find(function (x) { return x.user_id === userId; });
    if (u && u.avatar_color) {
      return "hsl(" + u.avatar_color + ", 65%, 45%)";
    }
    return PROJECT_COLORS[Math.abs(hashCode(userId || "x")) % PROJECT_COLORS.length];
  }

  function getInitials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  // -------------------------------------------------------------------------
  // HTML INJECTION
  // -------------------------------------------------------------------------
  function injectWidgetHTML() {
    if (document.getElementById("chat-widget-btn")) return;

    var html = [
      // Floating button
      '<button type="button" class="chat-widget-btn" id="chat-widget-btn" title="Messages">',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        '</svg>',
        '<span class="chat-widget-badge" id="chat-widget-badge" style="display:none;">0</span>',
      '</button>',

      // Panel
      '<div class="chat-widget-panel" id="chat-widget-panel">',

        // Header
        '<div class="chat-widget-header">',
          '<span class="chat-widget-header-title">Messages</span>',
          '<div class="chat-widget-header-actions">',
            '<button type="button" class="chat-widget-action-btn" id="chat-widget-expand" title="Open full page">',
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
              '</svg>',
            '</button>',
            '<button type="button" class="chat-widget-action-btn" id="chat-widget-close" title="Close">',
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
                '<path d="M6 18L18 6M6 6l12 12"/>',
              '</svg>',
            '</button>',
          '</div>',
        '</div>',

        // Body
        '<div class="chat-widget-body" id="chat-widget-body">',

          // Channel sidebar
          '<div class="chat-widget-channels" id="chat-widget-channels">',
            '<div class="chat-widget-channels-search">',
              '<input type="text" id="chat-widget-search" placeholder="Search..." class="chat-widget-search-input" />',
            '</div>',
            '<div class="chat-widget-channels-list" id="chat-widget-channels-list">',
              '<div class="chat-widget-loading"><div class="chat-widget-loading-dot"></div><div class="chat-widget-loading-dot"></div><div class="chat-widget-loading-dot"></div></div>',
            '</div>',
          '</div>',

          // Sidebar toggle (visible when sidebar is collapsed)
          '<button type="button" class="chat-widget-sidebar-toggle" id="chat-widget-sidebar-toggle" title="Toggle channels">',
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
              '<path d="M9 18l6-12"/><path d="M3 6h18M3 12h18M3 18h18"/>',
            '</svg>',
          '</button>',

          // Chat area
          '<div class="chat-widget-chat" id="chat-widget-chat">',
            '<div class="chat-widget-chat-header" id="chat-widget-chat-header">',
              '<button type="button" class="chat-widget-back-btn" id="chat-widget-back" title="Back">',
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
              '</button>',
              '<span class="chat-widget-chat-name" id="chat-widget-chat-name"></span>',
            '</div>',
            '<div class="chat-widget-messages" id="chat-widget-messages">',
              '<div class="chat-widget-empty" id="chat-widget-empty">Select a channel</div>',
            '</div>',
            '<div class="chat-widget-input-area" id="chat-widget-input-area" style="display:none;">',
              '<textarea id="chat-widget-input" class="chat-widget-input" placeholder="Type a message..." rows="1"></textarea>',
              '<button type="button" class="chat-widget-send-btn" id="chat-widget-send" disabled>',
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
              '</button>',
            '</div>',
          '</div>',

        '</div>',
      '</div>',
    ].join("");

    document.body.insertAdjacentHTML("beforeend", html);
  }

  function cacheDOMReferences() {
    DOM.btn = document.getElementById("chat-widget-btn");
    DOM.badge = document.getElementById("chat-widget-badge");
    DOM.panel = document.getElementById("chat-widget-panel");
    DOM.body = document.getElementById("chat-widget-body");
    DOM.expand = document.getElementById("chat-widget-expand");
    DOM.close = document.getElementById("chat-widget-close");
    DOM.channels = document.getElementById("chat-widget-channels");
    DOM.channelsList = document.getElementById("chat-widget-channels-list");
    DOM.search = document.getElementById("chat-widget-search");
    DOM.chat = document.getElementById("chat-widget-chat");
    DOM.chatHeader = document.getElementById("chat-widget-chat-header");
    DOM.chatName = document.getElementById("chat-widget-chat-name");
    DOM.back = document.getElementById("chat-widget-back");
    DOM.messagesContainer = document.getElementById("chat-widget-messages");
    DOM.empty = document.getElementById("chat-widget-empty");
    DOM.inputArea = document.getElementById("chat-widget-input-area");
    DOM.input = document.getElementById("chat-widget-input");
    DOM.send = document.getElementById("chat-widget-send");
    DOM.sidebarToggle = document.getElementById("chat-widget-sidebar-toggle");
  }

  // -------------------------------------------------------------------------
  // DATA LOADING
  // -------------------------------------------------------------------------
  async function loadCurrentUser() {
    try {
      var res = await authFetch(API_BASE + "/auth/me");
      if (!res.ok) return;
      var data = await res.json();
      state.currentUser = data.user || data;
    } catch (e) { /* silent */ }
  }

  async function loadUnreadCounts() {
    try {
      var res = await authFetch(API_BASE + "/messages/unread-counts");
      if (!res.ok) return;
      var data = await res.json();
      state.unreadCounts = data.unread_counts || {};
      updateBadge();
    } catch (e) { /* silent */ }
  }

  async function loadChannels() {
    try {
      var res = await authFetch(API_BASE + "/messages/channels");
      if (!res.ok) return;
      var data = await res.json();
      state.channels = data.channels || data || [];
    } catch (e) {
      state.channels = [];
    }
  }

  async function loadUsers() {
    try {
      var res = await authFetch(API_BASE + "/team/users");
      if (!res.ok) return;
      var data = await res.json();
      state.users = data.users || data.data || data || [];
    } catch (e) {
      state.users = [];
    }
  }

  async function loadProjects() {
    try {
      var res = await authFetch(API_BASE + "/projects");
      if (!res.ok) return;
      var data = await res.json();
      state.projects = data.projects || data.data || data || [];
    } catch (e) {
      state.projects = [];
    }
  }

  async function loadMessages(channelType, channelId, projectId) {
    try {
      var url = API_BASE + "/messages?channel_type=" + channelType + "&limit=" + MESSAGES_LIMIT + "&offset=0";
      if (channelType.startsWith("project_")) {
        url += "&project_id=" + projectId;
      } else {
        url += "&channel_id=" + channelId;
      }
      var res = await authFetch(url);
      if (!res.ok) return [];
      var data = await res.json();
      return data.messages || data || [];
    } catch (e) {
      return [];
    }
  }

  async function markChannelRead(channelType, channelId, projectId) {
    var key = getChannelKey(channelType, channelId, projectId);
    delete state.unreadCounts[key];
    updateBadge();
    updateChannelBadge(key, 0);

    try {
      var body = { channel_type: channelType };
      if (channelType.startsWith("project_")) {
        body.project_id = projectId;
      } else {
        body.channel_id = channelId;
      }
      await authFetch(API_BASE + "/messages/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) { /* fire and forget */ }
  }

  // -------------------------------------------------------------------------
  // BADGE
  // -------------------------------------------------------------------------
  function updateBadge() {
    var total = 0;
    var counts = state.unreadCounts;
    for (var k in counts) {
      if (counts.hasOwnProperty(k)) total += counts[k];
    }
    state.totalUnread = total;
    if (!DOM.badge) return;
    if (total > 0) {
      DOM.badge.textContent = total > 99 ? "99+" : total;
      DOM.badge.style.display = "flex";
    } else {
      DOM.badge.style.display = "none";
    }
  }

  function updateChannelBadge(channelKey, count) {
    var btn = DOM.channelsList?.querySelector('[data-channel-key="' + channelKey + '"]');
    if (!btn) return;
    var badge = btn.querySelector(".chat-widget-ch-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "chat-widget-ch-badge";
        btn.appendChild(badge);
      }
      badge.textContent = count > 99 ? "99+" : count;
    } else {
      if (badge) badge.remove();
    }
  }

  // -------------------------------------------------------------------------
  // CHANNEL RENDERING
  // -------------------------------------------------------------------------
  // Collapsed project groups stored in memory (persisted to sessionStorage)
  var _collapsedProjects = {};
  try {
    var _saved = sessionStorage.getItem("cw_collapsed_projects");
    if (_saved) _collapsedProjects = JSON.parse(_saved);
  } catch (e) { /* */ }

  function _saveCollapsedProjects() {
    try { sessionStorage.setItem("cw_collapsed_projects", JSON.stringify(_collapsedProjects)); } catch (e) { /* */ }
  }

  function toggleProjectGroup(projectId) {
    _collapsedProjects[projectId] = !_collapsedProjects[projectId];
    _saveCollapsedProjects();
    renderChannels(DOM.search ? DOM.search.value : "");
  }

  function getProjectUnreadTotal(pid) {
    var total = 0;
    var subTypes = [CHANNEL_TYPES.PROJECT_GENERAL, CHANNEL_TYPES.PROJECT_RECEIPTS, CHANNEL_TYPES.PROJECT_ACCOUNTING];
    subTypes.forEach(function (t) {
      total += state.unreadCounts[t + ":" + pid] || 0;
    });
    return total;
  }

  function renderChannels(filter) {
    if (!DOM.channelsList) return;
    filter = (filter || "").toLowerCase();

    // Group channels
    var groupChannels = [];
    var directChannels = [];

    state.channels.forEach(function (ch) {
      if (ch.type === CHANNEL_TYPES.DIRECT) {
        directChannels.push(ch);
      } else if (ch.type === CHANNEL_TYPES.GROUP || ch.type === CHANNEL_TYPES.CUSTOM) {
        groupChannels.push(ch);
      }
    });

    // Build HTML
    var html = [];

    // -- Projects section (collapsible groups) --
    var hasProjectContent = false;
    var projectItems = [];

    state.projects.forEach(function (proj) {
      var pid = proj.project_id || proj.id;
      var pName = proj.name || proj.project_name || "Project";
      var pColor = getProjectColor(pid);
      var collapsed = !!_collapsedProjects[pid];
      var subTypes = [
        { type: CHANNEL_TYPES.PROJECT_GENERAL, label: "General" },
        { type: CHANNEL_TYPES.PROJECT_RECEIPTS, label: "Receipts" },
        { type: CHANNEL_TYPES.PROJECT_ACCOUNTING, label: "Accounting" },
      ];

      // Check if any sub-channel matches filter
      var anyMatch = false;
      if (!filter) {
        anyMatch = true;
      } else {
        if (pName.toLowerCase().indexOf(filter) !== -1) anyMatch = true;
        subTypes.forEach(function (sub) {
          if (sub.label.toLowerCase().indexOf(filter) !== -1) anyMatch = true;
        });
      }
      if (!anyMatch) return;

      var projUnread = getProjectUnreadTotal(pid);
      var chevron = collapsed
        ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
        : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';

      // Project header (collapsible)
      projectItems.push(
        '<button type="button" class="chat-widget-project-header" data-project-toggle="' + pid + '">' +
          '<span class="chat-widget-project-chevron">' + chevron + '</span>' +
          '<span class="chat-widget-ch-dot" style="border-color:' + pColor + ';"></span>' +
          '<span class="chat-widget-ch-name">' + escapeHtml(pName) + '</span>' +
          (collapsed && projUnread > 0 ? '<span class="chat-widget-ch-badge">' + (projUnread > 99 ? "99+" : projUnread) + '</span>' : '') +
        '</button>'
      );

      // Sub-channels (indented, hidden when collapsed)
      if (!collapsed) {
        subTypes.forEach(function (sub) {
          if (filter && sub.label.toLowerCase().indexOf(filter) === -1 && pName.toLowerCase().indexOf(filter) === -1) return;
          var key = sub.type + ":" + pid;
          var count = state.unreadCounts[key] || 0;
          var active = state.currentChannel &&
            getChannelKey(state.currentChannel.type, state.currentChannel.id, state.currentChannel.projectId) === key;
          projectItems.push(
            '<button type="button" class="chat-widget-ch chat-widget-ch--sub' + (active ? " active" : "") + '"' +
            ' data-channel-key="' + key + '"' +
            ' data-type="' + sub.type + '"' +
            ' data-project-id="' + pid + '"' +
            ' data-name="' + escapeHtml(pName + " > " + sub.label) + '">' +
              '<span class="chat-widget-ch-sub-icon" style="color:' + pColor + ';">#</span>' +
              '<span class="chat-widget-ch-name">' + escapeHtml(sub.label) + '</span>' +
              (count > 0 ? '<span class="chat-widget-ch-badge">' + (count > 99 ? "99+" : count) + '</span>' : '') +
            '</button>'
          );
        });
      }

      hasProjectContent = true;
    });

    if (hasProjectContent) {
      html.push('<div class="chat-widget-section-label">Projects</div>');
      html.push(projectItems.join(""));
    }

    // -- Groups / Custom section --
    var groupHtml = [];
    groupChannels.forEach(function (ch) {
      var chName = ch.name || "Group";
      if (filter && chName.toLowerCase().indexOf(filter) === -1) return;
      var key = ch.type + ":" + ch.id;
      var count = state.unreadCounts[key] || 0;
      var active = state.currentChannel &&
        getChannelKey(state.currentChannel.type, state.currentChannel.id, state.currentChannel.projectId) === key;
      groupHtml.push(
        '<button type="button" class="chat-widget-ch' + (active ? " active" : "") + '"' +
        ' data-channel-key="' + key + '"' +
        ' data-type="' + ch.type + '"' +
        ' data-channel-id="' + ch.id + '"' +
        ' data-name="' + escapeHtml(chName) + '">' +
          '<span class="chat-widget-ch-dot" style="border-color:#6366f1;"></span>' +
          '<span class="chat-widget-ch-name">' + escapeHtml(chName) + '</span>' +
          (count > 0 ? '<span class="chat-widget-ch-badge">' + (count > 99 ? "99+" : count) + '</span>' : '') +
        '</button>'
      );
    });

    if (groupHtml.length) {
      html.push('<div class="chat-widget-section-label">Groups</div>');
      html.push(groupHtml.join(""));
    }

    // -- Direct messages section --
    var directHtml = [];
    directChannels.forEach(function (ch) {
      var chName = ch.name || "Direct";
      if (ch.members && state.currentUser) {
        var other = ch.members.find(function (m) {
          return (m.user_id || m) !== state.currentUser.user_id;
        });
        if (other) {
          var otherName = typeof other === "string" ? getUserName(other) : (other.user_name || getUserName(other.user_id));
          if (otherName && otherName !== "Unknown") chName = otherName;
        }
      }
      if (filter && chName.toLowerCase().indexOf(filter) === -1) return;
      var key = ch.type + ":" + ch.id;
      var count = state.unreadCounts[key] || 0;
      var active = state.currentChannel &&
        getChannelKey(state.currentChannel.type, state.currentChannel.id, state.currentChannel.projectId) === key;
      directHtml.push(
        '<button type="button" class="chat-widget-ch' + (active ? " active" : "") + '"' +
        ' data-channel-key="' + key + '"' +
        ' data-type="' + ch.type + '"' +
        ' data-channel-id="' + ch.id + '"' +
        ' data-name="' + escapeHtml(chName) + '">' +
          '<span class="chat-widget-ch-dot" style="border-color:#ec4899;"></span>' +
          '<span class="chat-widget-ch-name">' + escapeHtml(chName) + '</span>' +
          (count > 0 ? '<span class="chat-widget-ch-badge">' + (count > 99 ? "99+" : count) + '</span>' : '') +
        '</button>'
      );
    });

    if (directHtml.length) {
      html.push('<div class="chat-widget-section-label">Direct</div>');
      html.push(directHtml.join(""));
    }

    if (!html.length) {
      html.push('<div class="chat-widget-empty" style="height:auto;padding:20px;">No channels</div>');
    }

    DOM.channelsList.innerHTML = html.join("");
  }

  // -------------------------------------------------------------------------
  // MESSAGE RENDERING
  // -------------------------------------------------------------------------
  function renderMessages() {
    if (!DOM.messagesContainer) return;
    if (!state.messages.length) {
      DOM.messagesContainer.innerHTML = '<div class="chat-widget-empty">No messages yet</div>';
      return;
    }

    var html = [];
    var lastDate = null;
    var isOwn = false;
    var myId = state.currentUser?.user_id;

    state.messages.forEach(function (msg) {
      if (msg.is_deleted) return;
      // Date separator
      var msgDate = msg.created_at ? new Date(msg.created_at).toDateString() : null;
      if (msgDate && msgDate !== lastDate) {
        html.push('<div class="chat-widget-date-sep">' + formatDateSep(msg.created_at) + '</div>');
        lastDate = msgDate;
      }

      isOwn = msg.user_id === myId;
      var name = msg.user_name || getUserName(msg.user_id);
      var color = getUserColor(msg.user_id);
      var initials = getInitials(name);
      var content = formatContent(msg.content || "");

      if (isOwn) {
        html.push(
          '<div class="chat-widget-msg chat-widget-msg--own">' +
            '<div class="chat-widget-msg-content">' +
              '<div class="chat-widget-msg-text">' + content + '</div>' +
              '<div class="chat-widget-msg-time" style="text-align:right;margin-top:2px;">' + formatTime(msg.created_at) + '</div>' +
            '</div>' +
          '</div>'
        );
      } else {
        html.push(
          '<div class="chat-widget-msg">' +
            '<div class="chat-widget-msg-avatar" style="background:' + color + ';">' + initials + '</div>' +
            '<div class="chat-widget-msg-content">' +
              '<div class="chat-widget-msg-header">' +
                '<span class="chat-widget-msg-name">' + escapeHtml(name) + '</span>' +
                '<span class="chat-widget-msg-time">' + formatTime(msg.created_at) + '</span>' +
              '</div>' +
              '<div class="chat-widget-msg-text">' + content + '</div>' +
            '</div>' +
          '</div>'
        );
      }
    });

    DOM.messagesContainer.innerHTML = html.join("");
    // Scroll to bottom
    DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
  }

  function formatContent(text) {
    var s = escapeHtml(text);
    // Bold **text**
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Links
    s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    // Newlines
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  // -------------------------------------------------------------------------
  // CHANNEL SELECTION
  // -------------------------------------------------------------------------
  async function selectChannel(type, channelId, projectId, name) {
    var thisRequest = ++state.channelRequestId;

    state.currentChannel = { type: type, id: channelId, projectId: projectId, name: name };

    // Save to sessionStorage
    try {
      sessionStorage.setItem(LAST_CH_KEY, JSON.stringify(state.currentChannel));
    } catch (e) { /* */ }

    // Update channel list active state
    if (DOM.channelsList) {
      DOM.channelsList.querySelectorAll(".chat-widget-ch").forEach(function (el) {
        el.classList.remove("active");
      });
      var key = getChannelKey(type, channelId, projectId);
      var activeBtn = DOM.channelsList.querySelector('[data-channel-key="' + key + '"]');
      if (activeBtn) activeBtn.classList.add("active");
    }

    // Update chat header
    DOM.chatName.textContent = name || "Chat";
    DOM.empty.style.display = "none";
    DOM.inputArea.style.display = "flex";
    DOM.messagesContainer.innerHTML = '<div class="chat-widget-loading"><div class="chat-widget-loading-dot"></div><div class="chat-widget-loading-dot"></div><div class="chat-widget-loading-dot"></div></div>';

    // Mobile: switch to chat view
    DOM.body.classList.add("cw-chat-active");

    // Mark as read
    markChannelRead(type, channelId, projectId);

    // Load messages
    state.isLoadingMessages = true;
    var messages = await loadMessages(type, channelId, projectId);
    state.isLoadingMessages = false;

    // Race check
    if (thisRequest !== state.channelRequestId) return;

    state.messages = messages;
    renderMessages();

    // Subscribe to realtime for this channel
    subscribeToChannel();
  }

  // -------------------------------------------------------------------------
  // SEND MESSAGE
  // -------------------------------------------------------------------------
  async function sendMessage() {
    var content = DOM.input.value.trim();
    if (!content || !state.currentChannel) return;

    var ch = state.currentChannel;
    var messageData = {
      content: content,
      channel_type: ch.type,
      user_id: state.currentUser?.user_id,
      reply_to_id: null,
      attachments: [],
    };

    if (ch.type.startsWith("project_")) {
      messageData.project_id = ch.projectId;
    } else {
      messageData.channel_id = ch.id;
    }

    // Optimistic UI
    var tempMsg = {
      id: "temp-" + Date.now(),
      content: content,
      user_id: state.currentUser?.user_id,
      user_name: state.currentUser?.user_name,
      created_at: new Date().toISOString(),
    };
    state.messages.push(tempMsg);
    renderMessages();

    // Clear input
    DOM.input.value = "";
    DOM.send.disabled = true;
    DOM.input.style.height = "auto";

    try {
      var res = await authFetch(API_BASE + "/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(messageData),
      });
      if (!res.ok) throw new Error("send failed");
      var data = await res.json();
      // Replace temp with real
      var idx = state.messages.findIndex(function (m) { return m.id === tempMsg.id; });
      if (idx !== -1) {
        state.messages[idx] = data.message || data;
        renderMessages();
      }
    } catch (e) {
      // Mark as failed
      var fIdx = state.messages.findIndex(function (m) { return m.id === tempMsg.id; });
      if (fIdx !== -1) {
        state.messages[fIdx]._failed = true;
        renderMessages();
      }
    }
  }

  // -------------------------------------------------------------------------
  // SUPABASE REALTIME
  // -------------------------------------------------------------------------
  function loadSupabaseSDK() {
    return new Promise(function (resolve, reject) {
      if (typeof supabase !== "undefined") { resolve(); return; }
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initSupabaseRealtime() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    try {
      if (typeof supabase === "undefined") {
        await loadSupabaseSDK();
      }
      // Reuse shared singleton to avoid Multiple GoTrueClient warning
      if (window._ngmSupabaseClient) {
        state.supabaseClient = window._ngmSupabaseClient;
      } else {
        state.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window._ngmSupabaseClient = state.supabaseClient;
      }

      // Global subscription: listen to ALL new messages for unread badge updates.
      // This runs even when the chat panel is closed, replacing the polling approach.
      state.unreadSubscription = state.supabaseClient
        .channel("cw_global_unread")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          function (payload) {
            var msg = payload.new;
            if (!msg || !state.currentUser) return;
            if (msg.user_id === state.currentUser.user_id) return;

            var msgKey = msg.channel_key ||
              (msg.channel_type + ":" + (msg.channel_id || msg.project_id));

            // Skip if this channel is currently open in the widget
            if (state.currentChannel) {
              var openKey = getChannelKey(
                state.currentChannel.type,
                state.currentChannel.id,
                state.currentChannel.projectId
              );
              if (msgKey === openKey) return;
            }

            state.unreadCounts[msgKey] = (state.unreadCounts[msgKey] || 0) + 1;
            updateBadge();
            updateChannelBadge(msgKey, state.unreadCounts[msgKey]);
          }
        )
        .subscribe(function (status) {
          if (status === "SUBSCRIBED") {
            state.realtimeConnected = true;
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
            state.realtimeConnected = false;
          }
        });
    } catch (e) {
      // Supabase not available -- visibilitychange refresh is the only fallback
    }
  }

  function subscribeToChannel() {
    if (!state.supabaseClient || !state.currentChannel) return;

    // Unsubscribe previous
    if (state.messageSubscription) {
      state.messageSubscription.unsubscribe();
      state.messageSubscription = null;
    }

    var ch = state.currentChannel;
    var currentKey = getChannelKey(ch.type, ch.id, ch.projectId);

    state.messageSubscription = state.supabaseClient
      .channel("cw_messages:" + currentKey)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        function (payload) {
          var msg = payload.new;
          if (!msg) return;

          var msgKey = msg.channel_key ||
            (msg.channel_type + ":" + (msg.channel_id || msg.project_id));

          if (msgKey === currentKey) {
            // Current channel: append if not already present
            var exists = state.messages.some(function (m) { return m.id === msg.id; });
            if (!exists) {
              // Skip if this is a temp message we already added (own message)
              var isTemp = state.messages.some(function (m) {
                return m.id && m.id.toString().startsWith("temp-") &&
                  m.user_id === msg.user_id &&
                  m.content === msg.content;
              });
              if (isTemp) {
                // Replace temp with real
                var tIdx = state.messages.findIndex(function (m) {
                  return m.id && m.id.toString().startsWith("temp-") &&
                    m.user_id === msg.user_id &&
                    m.content === msg.content;
                });
                if (tIdx !== -1) state.messages[tIdx] = msg;
              } else {
                state.messages.push(msg);
              }
              renderMessages();
            }
          }
          // Other-channel unreads handled by global unread subscription
        }
      )
      .subscribe(function (status) {
        if (status === "SUBSCRIBED") {
          state.realtimeConnected = true;
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          state.realtimeConnected = false;
        }
      });
  }

  // -------------------------------------------------------------------------
  // UNREAD REFRESH (on tab focus, corrects any Realtime drift)
  // -------------------------------------------------------------------------
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      loadUnreadCounts();
    }
  });

  // -------------------------------------------------------------------------
  // OPEN / CLOSE
  // -------------------------------------------------------------------------
  function openPanel() {
    if (state.isOpen) return;
    state.isOpen = true;
    DOM.panel.classList.add("is-open");
    DOM.btn.classList.add("is-hidden");

    // Hide Arturito button
    var arturitoBtn = document.getElementById("arturito-widget-btn");
    if (arturitoBtn) arturitoBtn.classList.add("is-hidden");

    // Close Arturito panel if open
    var arturitoPanel = document.getElementById("arturito-widget-panel");
    if (arturitoPanel && arturitoPanel.classList.contains("is-open")) {
      // Trigger Arturito close
      var arturitoClose = document.getElementById("arturito-close-btn");
      if (arturitoClose) arturitoClose.click();
    }

    // Load data on first open
    if (!state.dataLoaded) {
      loadFullData();
    }

    // Try to restore last channel
    if (!state.currentChannel) {
      restoreLastChannel();
    }
  }

  function closePanel() {
    if (!state.isOpen) return;
    state.isOpen = false;
    DOM.panel.classList.remove("is-open");
    DOM.btn.classList.remove("is-hidden");

    // Show Arturito button again
    var arturitoBtn = document.getElementById("arturito-widget-btn");
    if (arturitoBtn) arturitoBtn.classList.remove("is-hidden");

    // Mobile: reset to channel view
    DOM.body.classList.remove("cw-chat-active");
  }

  function togglePanel() {
    if (state.isOpen) closePanel();
    else openPanel();
  }

  async function loadFullData() {
    state.dataLoaded = true;
    await Promise.all([loadChannels(), loadUsers(), loadProjects()]);
    renderChannels();
  }

  function restoreLastChannel() {
    try {
      var saved = sessionStorage.getItem(LAST_CH_KEY);
      if (saved) {
        var ch = JSON.parse(saved);
        if (ch && ch.type) {
          selectChannel(ch.type, ch.id, ch.projectId, ch.name);
        }
      }
    } catch (e) { /* */ }
  }

  // -------------------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------------------
  function setupEventListeners() {
    // Toggle panel
    DOM.btn.addEventListener("click", togglePanel);
    DOM.close.addEventListener("click", closePanel);
    DOM.expand.addEventListener("click", function () {
      window.location.href = "messages.html";
    });

    // Back button (mobile)
    DOM.back.addEventListener("click", function () {
      DOM.body.classList.remove("cw-chat-active");
    });

    // Sidebar collapse toggle
    DOM.sidebarToggle.addEventListener("click", function () {
      var body = DOM.body;
      var isCollapsed = body.classList.toggle("cw-sidebar-collapsed");
      try { sessionStorage.setItem("cw_sidebar_collapsed", isCollapsed ? "1" : ""); } catch (e) { /* */ }
    });

    // Restore sidebar collapsed state
    try {
      if (sessionStorage.getItem("cw_sidebar_collapsed") === "1") {
        DOM.body.classList.add("cw-sidebar-collapsed");
      }
    } catch (e) { /* */ }

    // Channel selection + project toggle (delegated)
    DOM.channelsList.addEventListener("click", function (e) {
      // Project collapse toggle
      var toggler = e.target.closest("[data-project-toggle]");
      if (toggler) {
        toggleProjectGroup(toggler.dataset.projectToggle);
        return;
      }
      var btn = e.target.closest(".chat-widget-ch");
      if (!btn) return;
      var type = btn.dataset.type;
      var channelId = btn.dataset.channelId || null;
      var projectId = btn.dataset.projectId || null;
      var name = btn.dataset.name || "";
      selectChannel(type, channelId, projectId, name);
    });

    // Search filter
    DOM.search.addEventListener("input", function () {
      renderChannels(DOM.search.value);
    });

    // Send message
    DOM.send.addEventListener("click", sendMessage);
    DOM.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Enable/disable send button
    DOM.input.addEventListener("input", function () {
      DOM.send.disabled = !DOM.input.value.trim();
      // Auto-resize
      DOM.input.style.height = "auto";
      DOM.input.style.height = Math.min(DOM.input.scrollHeight, 80) + "px";
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.isOpen) closePanel();
    });

    // Click outside to close
    document.addEventListener("mousedown", function (e) {
      if (!state.isOpen) return;
      if (DOM.panel.contains(e.target) || DOM.btn.contains(e.target)) return;
      closePanel();
    });
  }

  // -------------------------------------------------------------------------
  // PUSH NOTIFICATION HOOK
  // -------------------------------------------------------------------------
  function handlePushNotification(payload) {
    var channelKey = payload.data?.channel_key;
    var senderId = payload.data?.sender_id || payload.data?.user_id;
    if (channelKey && senderId !== state.currentUser?.user_id) {
      // If this is the currently open channel in the widget, don't increment
      if (state.isOpen && state.currentChannel) {
        var currentKey = getChannelKey(
          state.currentChannel.type,
          state.currentChannel.id,
          state.currentChannel.projectId
        );
        if (channelKey === currentKey) return;
      }
      state.unreadCounts[channelKey] = (state.unreadCounts[channelKey] || 0) + 1;
      updateBadge();
      updateChannelBadge(channelKey, state.unreadCounts[channelKey]);
    }
  }

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------
  async function init() {
    // Don't init if no auth token
    if (!localStorage.getItem("ngmToken")) return;
    // Don't double-init
    if (document.getElementById("chat-widget-btn")) return;

    injectWidgetHTML();
    cacheDOMReferences();
    setupEventListeners();

    // Parallel: load user + unread counts (minimal on page load)
    await Promise.all([loadCurrentUser(), loadUnreadCounts()]);

    // Init Supabase Realtime (global unread subscription, no polling needed)
    initSupabaseRealtime();
  }

  // Auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose API
  window.ChatWidget = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    handlePushNotification: handlePushNotification,
    getTotalUnread: function () { return state.totalUnread; },
  };
})();
