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
  };

  // Channel types
  const CHANNEL_TYPES = {
    PROJECT_GENERAL: "project_general",
    PROJECT_ACCOUNTING: "project_accounting",
    PROJECT_RECEIPTS: "project_receipts",
    CUSTOM: "custom",
    DIRECT: "direct",
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DOM REFERENCES
  // ─────────────────────────────────────────────────────────────────────────
  const DOM = {};

  function cacheDOMReferences() {
    // Channels sidebar
    DOM.projectChannels = document.getElementById("projectChannels");
    DOM.directMessages = document.getElementById("directMessages");
    DOM.customChannels = document.getElementById("customChannels");
    DOM.channelSearchInput = document.getElementById("channelSearchInput");

    // Chat area
    DOM.chatName = document.getElementById("chatName");
    DOM.chatDescription = document.getElementById("chatDescription");
    DOM.messagesContainer = document.getElementById("messagesContainer");
    DOM.messagesList = document.getElementById("messagesList");
    DOM.emptyState = document.getElementById("emptyState");
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

    // Modals
    DOM.newChannelModal = document.getElementById("newChannelModal");
    DOM.channelInfoModal = document.getElementById("channelInfoModal");
    DOM.searchMessagesModal = document.getElementById("searchMessagesModal");

    // Global search
    DOM.globalSearchInput = document.getElementById("messages-search-input");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  async function init() {
    console.log("[Messages] Initializing...");
    cacheDOMReferences();

    try {
      // Load current user
      await loadCurrentUser();

      // Load users for mentions
      await loadUsers();

      // Load projects and build channels
      await loadProjects();

      // Load custom and direct channels
      await loadChannels();

      // Render channel lists
      renderChannels();

      // Setup event listeners
      setupEventListeners();

      // Initialize Supabase Realtime
      initSupabaseRealtime();

      // Remove page loading state
      document.body.classList.remove("page-loading");
      console.log("[Messages] Initialized successfully");
    } catch (err) {
      console.error("[Messages] Init error:", err);
      showToast("Failed to initialize messages", "error");
      document.body.classList.remove("page-loading");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────
  async function loadCurrentUser() {
    try {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      state.currentUser = data.user || data;
      console.log("[Messages] Current user:", state.currentUser.user_name);
    } catch (err) {
      console.error("[Messages] Failed to load current user:", err);
      // Fallback for development
      state.currentUser = { user_id: "dev-uuid", user_name: "Dev User", email: "dev@ngm.com" };
    }
  }

  async function loadUsers() {
    try {
      const res = await authFetch(`${API_BASE}/team/users`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      state.users = data.users || data || [];
      console.log("[Messages] Loaded", state.users.length, "users");
    } catch (err) {
      console.error("[Messages] Failed to load users:", err);
      state.users = [];
    }
  }

  async function loadProjects() {
    try {
      const res = await authFetch(`${API_BASE}/projects`);
      if (!res.ok) throw new Error("Failed to load projects");
      const data = await res.json();
      // API returns { data: [...] } or { projects: [...] } or array directly
      // Ensure we always get an array
      const projects = data.data || data.projects || data;
      state.projects = Array.isArray(projects) ? projects : [];
      console.log("[Messages] Loaded", state.projects.length, "projects");
    } catch (err) {
      console.error("[Messages] Failed to load projects:", err);
      state.projects = [];
    }
  }

  async function loadChannels() {
    try {
      const res = await authFetch(`${API_BASE}/messages/channels`);
      if (!res.ok) {
        // API might not exist yet, use empty array
        console.warn("[Messages] Channels API not available, using defaults");
        state.channels = [];
        return;
      }
      const data = await res.json();
      state.channels = data.channels || data || [];
      console.log("[Messages] Loaded", state.channels.length, "custom channels");
    } catch (err) {
      console.warn("[Messages] Failed to load channels:", err);
      state.channels = [];
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
    renderDirectMessages();
    renderCustomChannels();
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

      html += `
        <div class="msg-project-group" data-project-id="${projectId}">
          <div class="msg-project-header">
            <span class="msg-project-icon">📁</span>
            <span class="msg-project-name">${escapeHtml(projectName)}</span>
          </div>
          <div class="msg-project-channels">
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_GENERAL}"
                    data-project-id="${projectId}"
                    data-channel-name="General">
              <span class="msg-channel-hash">#</span>
              <span class="msg-channel-name">General</span>
            </button>
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_ACCOUNTING}"
                    data-project-id="${projectId}"
                    data-channel-name="Accounting">
              <span class="msg-channel-hash">#</span>
              <span class="msg-channel-name">Accounting</span>
            </button>
            <button type="button" class="msg-channel-item"
                    data-channel-type="${CHANNEL_TYPES.PROJECT_RECEIPTS}"
                    data-project-id="${projectId}"
                    data-channel-name="Receipts">
              <span class="msg-channel-hash">#</span>
              <span class="msg-channel-name">Receipts</span>
            </button>
          </div>
        </div>
      `;
    });

    DOM.projectChannels.innerHTML = html;
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
      const avatarColor = otherUser?.avatar_color || getDefaultAvatarColor(userName);
      const initials = getInitials(userName);

      html += `
        <button type="button" class="msg-channel-item msg-dm-item"
                data-channel-id="${channel.id}"
                data-channel-type="${CHANNEL_TYPES.DIRECT}">
          <span class="msg-dm-avatar" style="--avatar-color: ${avatarColor}">
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
      html += `
        <button type="button" class="msg-channel-item"
                data-channel-id="${channel.id}"
                data-channel-type="${CHANNEL_TYPES.CUSTOM}">
          <span class="msg-channel-hash">#</span>
          <span class="msg-channel-name">${escapeHtml(channel.name)}</span>
          ${channel.unread_count ? `<span class="msg-unread-badge">${channel.unread_count}</span>` : ""}
        </button>
      `;
    });

    DOM.customChannels.innerHTML = html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CHANNEL SELECTION
  // ─────────────────────────────────────────────────────────────────────────
  async function selectChannel(channelType, channelId, projectId, channelName, clickedElement) {
    // Update UI state
    document.querySelectorAll(".msg-channel-item").forEach((el) => {
      el.classList.remove("active");
    });
    clickedElement?.classList.add("active");

    // Build channel identifier
    const channel = {
      type: channelType,
      id: channelId,
      projectId: projectId,
      name: channelName,
    };

    state.currentChannel = channel;

    // Update header
    updateChatHeader(channel);

    // Show input area
    DOM.emptyState.style.display = "none";
    DOM.messagesList.style.display = "flex";
    DOM.messageInputArea.style.display = "flex";

    // Load messages
    const messages = await loadMessages(channelType, channelId, projectId);
    state.messages = messages;
    renderMessages();

    // Subscribe to realtime updates
    subscribeToChannel(channel);

    // Scroll to bottom
    scrollToBottom();
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
  function renderMessages() {
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

      html += renderMessage(msg);
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

  function renderMessage(msg) {
    const user = state.users.find((u) => u.user_id === msg.user_id) || {};
    const userName = user.user_name || msg.user_name || "Unknown";
    const avatarColor = user.avatar_color || getDefaultAvatarColor(userName);
    const initials = getInitials(userName);
    const time = formatTime(msg.created_at);
    const content = formatMessageContent(msg.content);
    const hasAttachments = msg.attachments && msg.attachments.length > 0;
    const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;
    const threadCount = msg.thread_count || 0;

    return `
      <div class="msg-message" data-message-id="${msg.id}">
        <div class="msg-message-avatar" style="--avatar-color: ${avatarColor}">
          ${initials}
        </div>
        <div class="msg-message-content">
          <div class="msg-message-header">
            <span class="msg-message-author">${escapeHtml(userName)}</span>
            <span class="msg-message-time">${time}</span>
          </div>
          <div class="msg-message-body">
            ${content}
          </div>
          ${hasAttachments ? renderAttachments(msg.attachments) : ""}
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

  function renderAttachments(attachments) {
    if (!attachments || attachments.length === 0) return "";

    let html = '<div class="msg-attachments">';
    attachments.forEach((att) => {
      if (att.type?.startsWith("image/")) {
        html += `
          <div class="msg-attachment msg-attachment--image">
            <img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name)}" loading="lazy" />
          </div>
        `;
      } else {
        html += `
          <a href="${escapeHtml(att.url)}" class="msg-attachment msg-attachment--file" target="_blank" download>
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

    // Parse URLs
    formatted = formatted.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );

    // Parse line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SENDING MESSAGES
  // ─────────────────────────────────────────────────────────────────────────
  async function sendMessage() {
    const content = DOM.messageInput.value.trim();
    if (!content && state.attachments.length === 0) return;
    if (!state.currentChannel) return;

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

    // Optimistic UI update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      ...messageData,
      created_at: new Date().toISOString(),
      user_name: state.currentUser?.user_name,
    };
    state.messages.push(tempMessage);
    renderMessages();

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
      }
    } catch (err) {
      console.error("[Messages] Send error:", err);
      showToast("Failed to send message", "error");
      // Remove temp message on error
      state.messages = state.messages.filter((m) => m.id !== tempMessage.id);
      renderMessages();
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
      const avatarColor = user.avatar_color || getDefaultAvatarColor(user.user_name);
      const initials = getInitials(user.user_name);
      html += `
        <button type="button" class="msg-mention-item" data-user-id="${user.user_id}" data-user-name="${escapeHtml(user.user_name)}">
          <span class="msg-mention-avatar" style="--avatar-color: ${avatarColor}">${initials}</span>
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
  async function openThread(messageId) {
    const message = state.messages.find((m) => m.id === messageId);
    if (!message) return;

    DOM.threadPanel.style.display = "flex";

    // Render original message
    DOM.threadOriginal.innerHTML = renderMessage(message);

    // Load thread replies
    try {
      const res = await authFetch(`${API_BASE}/messages/${messageId}/thread`);
      if (res.ok) {
        const data = await res.json();
        const replies = data.replies || data || [];
        renderThreadReplies(replies);
      }
    } catch (err) {
      console.error("[Messages] Failed to load thread:", err);
    }

    // Store current thread
    DOM.threadPanel.dataset.messageId = messageId;
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

      // Show uploading indicator
      showToast(`Uploading receipt: ${file.name}...`, "info");

      try {
        const result = await uploadReceiptToPending(file);

        if (result.success) {
          const receipt = result.data;

          // Auto-send a message with the receipt link
          const receiptMessage = `📄 **Receipt uploaded:** ${file.name}\n🔗 [View Receipt](${receipt.file_url})`;
          DOM.messageInput.value = receiptMessage;
          await sendMessage();

          showToast(`Receipt uploaded successfully!`, "success");

          // Ask if user wants to process it now
          if (confirm(`Receipt "${file.name}" uploaded.\n\nDo you want to scan it now to extract expense data?`)) {
            await processReceiptNow(receipt.id, file.name);
          }
        }
      } catch (err) {
        console.error("[Messages] Receipt upload error:", err);
        showToast(`Failed to upload ${file.name}: ${err.message}`, "error");
      }
    }
  }

  /**
   * Process a receipt using OCR (calls the process endpoint)
   */
  async function processReceiptNow(receiptId, fileName) {
    showToast(`Processing receipt: ${fileName}...`, "info");

    try {
      const response = await authFetch(`${API_BASE}/pending-receipts/${receiptId}/process`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Processing failed");
      }

      const result = await response.json();

      if (result.success && result.parsed) {
        const parsed = result.parsed;
        let summaryMsg = `✅ **Receipt scanned:**\n`;
        if (parsed.vendor_name) summaryMsg += `• Vendor: ${parsed.vendor_name}\n`;
        if (parsed.amount) summaryMsg += `• Amount: $${parsed.amount.toFixed(2)}\n`;
        if (parsed.receipt_date) summaryMsg += `• Date: ${parsed.receipt_date}\n`;
        if (parsed.suggested_category) summaryMsg += `• Category: ${parsed.suggested_category}\n`;
        summaryMsg += `\n💡 Ready to create expense from this receipt.`;

        // Send summary to channel
        DOM.messageInput.value = summaryMsg;
        await sendMessage();

        showToast("Receipt processed! Check the channel for details.", "success");
      }
    } catch (err) {
      console.error("[Messages] Receipt processing error:", err);
      showToast(`Failed to process receipt: ${err.message}`, "error");
    }
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
      state.channels.push(data.channel || data);
      renderChannels();
      closeNewChannelModal();
      showToast("Channel created successfully", "success");
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

  function subscribeToChannel(channel) {
    if (!state.supabaseClient) return;

    // Unsubscribe from previous channel
    if (state.messageSubscription) {
      state.messageSubscription.unsubscribe();
    }
    if (state.typingSubscription) {
      state.typingSubscription.unsubscribe();
    }

    const channelKey = `${channel.type}:${channel.id || channel.projectId}`;

    // Subscribe to new messages
    state.messageSubscription = state.supabaseClient
      .channel(`messages:${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_key=eq.${channelKey}`,
        },
        (payload) => {
          handleNewMessage(payload.new);
        }
      )
      .subscribe();

    // Subscribe to typing indicators
    state.typingSubscription = state.supabaseClient
      .channel(`typing:${channelKey}`)
      .on("presence", { event: "sync" }, () => {
        const presenceState = state.typingSubscription.presenceState();
        updateTypingIndicator(presenceState);
      })
      .subscribe();
  }

  function handleNewMessage(message) {
    // Don't add if it's our own message (already added optimistically)
    if (message.user_id === state.currentUser?.user_id) {
      // But update the temp message with real data
      const tempIndex = state.messages.findIndex((m) =>
        m.id?.toString().startsWith("temp-")
      );
      if (tempIndex !== -1) {
        state.messages[tempIndex] = message;
      }
      return;
    }

    // Add new message
    state.messages.push(message);
    renderMessages();

    // Show toast notification for new message
    showMessageNotification(message);
  }

  /**
   * Show toast notification for incoming message
   */
  function showMessageNotification(message) {
    if (typeof Toast === "undefined") return;

    const sender = state.users.find((u) => u.user_id === message.user_id);
    const senderName = sender?.user_name || message.user_name || "Unknown";
    const senderPhoto = sender?.user_photo;
    const senderColor = sender?.avatar_color
      ? `hsl(${sender.avatar_color}, 70%, 45%)`
      : getDefaultAvatarColor(senderName);
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
      const action = e.target.closest("[data-action]")?.dataset.action;
      const messageId = e.target.closest("[data-message-id]")?.dataset.messageId;

      if (!action || !messageId) return;

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
    [DOM.newChannelModal, DOM.channelInfoModal, DOM.searchMessagesModal].forEach(
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
        closeThread();
      }
      // Cmd/Ctrl + K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openSearchModal();
      }
    });
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

  function getDefaultAvatarColor(name) {
    if (!name) return "hsl(200, 60%, 50%)";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 50%)`;
  }

  function getOtherUserInDM(channel) {
    if (!channel.members) return null;
    return channel.members.find((m) => m.user_id !== state.currentUser?.user_id);
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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

  function scrollToBottom() {
    if (DOM.messagesContainer) {
      DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
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
  // INIT ON DOM READY
  // ─────────────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export for debugging
  window.MessagesModule = {
    state,
    selectChannel,
    sendMessage,
    searchMessages,
  };
})();
