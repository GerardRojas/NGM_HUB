// assets/js/arturito.js
// ═══════════════════════════════════════════════════════════════════════════
// NGM HUB — Arturito Chat Module
// ═══════════════════════════════════════════════════════════════════════════
// Chatbot interface using OpenAI Assistants API for efficient memory
// Personality controlled via commands: "sarcasmo 1-5" or "personalidad 1-5"

(function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────

  const API_BASE = window.API_BASE || "http://127.0.0.1:8000";
  const STORAGE_KEY = "arturito_conversation";
  const SESSION_ID = `web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  const state = {
    currentUser: null,
    messages: [],        // Local display history
    threadId: null,      // OpenAI Assistants thread ID
    isLoading: false,
    sessionId: SESSION_ID,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DOM REFERENCES
  // ─────────────────────────────────────────────────────────────────────────

  const DOM = {
    messagesContainer: null,
    messagesList: null,
    welcomeMessage: null,
    chatInput: null,
    btnSend: null,
    typingIndicator: null,
    messageCount: null,
    contextSize: null,
    btnClearChat: null,
    btnClearContext: null,
    suggestionChips: null,
    quickActions: null,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    console.log("[Arturito] Initializing with Assistants API...");

    // Cache DOM references
    DOM.messagesContainer = document.getElementById("arturitoMessages");
    DOM.messagesList = document.getElementById("messagesList");
    DOM.welcomeMessage = document.getElementById("welcomeMessage");
    DOM.chatInput = document.getElementById("chatInput");
    DOM.btnSend = document.getElementById("btnSend");
    DOM.typingIndicator = document.getElementById("typingIndicator");
    DOM.messageCount = document.getElementById("messageCount");
    DOM.contextSize = document.getElementById("contextSize");
    DOM.btnClearChat = document.getElementById("btnClearChat");
    DOM.btnClearContext = document.getElementById("btnClearContext");
    DOM.suggestionChips = document.querySelectorAll(".suggestion-chip");
    DOM.quickActions = document.querySelectorAll(".quick-action");

    // Load saved conversation
    loadConversation();

    // Load current user
    await loadCurrentUser();

    // Setup event listeners
    setupEventListeners();

    // Update UI
    updateContextStats();
    renderMessages();

    // Remove loading state
    document.body.classList.remove("page-loading");
    const overlay = document.getElementById("pageLoadingOverlay");
    if (overlay) overlay.style.display = "none";

    console.log("[Arturito] Ready!");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────

  async function loadCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      state.currentUser = data.user || data;
      console.log("[Arturito] Current user:", state.currentUser.user_name);
    } catch (err) {
      console.warn("[Arturito] Failed to load current user:", err);
      state.currentUser = { user_id: "dev-uuid", user_name: "Usuario", email: "dev@ngm.com" };
    }
  }

  function loadConversation() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        state.messages = data.messages || [];
        state.sessionId = data.sessionId || SESSION_ID;
        state.threadId = data.threadId || null;
        console.log(`[Arturito] Loaded ${state.messages.length} messages, thread: ${state.threadId || 'new'}`);
      }
    } catch (err) {
      console.warn("[Arturito] Failed to load conversation:", err);
      state.messages = [];
      state.threadId = null;
    }
  }

  function saveConversation() {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          messages: state.messages,
          sessionId: state.sessionId,
          threadId: state.threadId,
        })
      );
    } catch (err) {
      console.warn("[Arturito] Failed to save conversation:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────

  function setupEventListeners() {
    DOM.chatInput.addEventListener("input", handleInputChange);
    DOM.chatInput.addEventListener("keydown", handleInputKeydown);
    DOM.btnSend.addEventListener("click", sendMessage);

    if (DOM.btnClearChat) {
      DOM.btnClearChat.addEventListener("click", clearChat);
    }
    if (DOM.btnClearContext) {
      DOM.btnClearContext.addEventListener("click", clearChat);
    }

    DOM.suggestionChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const suggestion = chip.dataset.suggestion;
        if (suggestion) {
          DOM.chatInput.value = suggestion;
          handleInputChange();
          sendMessage();
        }
      });
    });

    DOM.quickActions.forEach((action) => {
      action.addEventListener("click", () => {
        const actionText = action.dataset.action;
        if (actionText) {
          DOM.chatInput.value = actionText;
          handleInputChange();
          sendMessage();
        }
      });
    });
  }

  function handleInputChange() {
    const value = DOM.chatInput.value.trim();
    DOM.btnSend.disabled = !value;

    DOM.chatInput.style.height = "auto";
    DOM.chatInput.style.height = Math.min(DOM.chatInput.scrollHeight, 150) + "px";
  }

  function handleInputKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!DOM.btnSend.disabled) {
        sendMessage();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE (Assistants API)
  // ─────────────────────────────────────────────────────────────────────────

  async function sendMessage() {
    const content = DOM.chatInput.value.trim();
    if (!content || state.isLoading) return;

    if (DOM.welcomeMessage) {
      DOM.welcomeMessage.style.display = "none";
    }

    // Add user message to local display
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: content,
      timestamp: new Date().toISOString(),
      user_name: state.currentUser?.user_name || "Usuario",
    };

    state.messages.push(userMessage);
    saveConversation();
    renderMessages();
    scrollToBottom();

    // Clear input
    DOM.chatInput.value = "";
    DOM.chatInput.style.height = "auto";
    DOM.btnSend.disabled = true;

    // Show typing indicator
    state.isLoading = true;
    DOM.typingIndicator.style.display = "flex";

    try {
      // Send to API with thread_id (Assistants API)
      const response = await fetch(`${API_BASE}/arturito/web-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: content,
          user_name: state.currentUser?.user_name,
          user_email: state.currentUser?.email,
          session_id: state.sessionId,
          thread_id: state.threadId,  // Send existing thread ID if we have one
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Save thread_id from response for future messages
      if (data.thread_id) {
        state.threadId = data.thread_id;
      }

      // Add bot response to local display
      const botMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.text || "No pude procesar tu mensaje.",
        timestamp: new Date().toISOString(),
        action: data.action,
        data: data.data,
      };

      state.messages.push(botMessage);
      saveConversation();

    } catch (err) {
      console.error("[Arturito] Error sending message:", err);

      const errorMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.",
        timestamp: new Date().toISOString(),
        isError: true,
      };

      state.messages.push(errorMessage);
      saveConversation();

    } finally {
      state.isLoading = false;
      DOM.typingIndicator.style.display = "none";
      renderMessages();
      updateContextStats();
      scrollToBottom();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER MESSAGES
  // ─────────────────────────────────────────────────────────────────────────

  function renderMessages() {
    if (state.messages.length === 0) {
      DOM.messagesList.innerHTML = "";
      if (DOM.welcomeMessage) {
        DOM.welcomeMessage.style.display = "block";
      }
      return;
    }

    if (DOM.welcomeMessage) {
      DOM.welcomeMessage.style.display = "none";
    }

    const html = state.messages.map((msg) => renderMessage(msg)).join("");
    DOM.messagesList.innerHTML = html;
  }

  function renderMessage(msg) {
    const isUser = msg.role === "user";
    const isError = msg.isError;
    const userName = isUser ? (msg.user_name || "Tu") : "Arturito";
    const time = formatTime(msg.timestamp);
    const formattedContent = formatMessageContent(msg.content);

    const errorClass = isError ? "arturito-message--error" : "";
    const roleClass = isUser ? "arturito-message--user" : "arturito-message--bot";

    // Build avatar HTML - for user messages use their photo/color, for bot use green "A"
    let avatarHtml;
    if (isUser) {
      const userPhoto = state.currentUser?.user_photo;
      const avatarColor = getAvatarColor(state.currentUser);
      const initials = getInitials(state.currentUser?.user_name || msg.user_name || "Tu");

      if (userPhoto) {
        // User has a photo - use image avatar
        avatarHtml = `<div class="arturito-message-avatar arturito-message-avatar--img" style="background-image: url('${escapeHtml(userPhoto)}')"></div>`;
      } else {
        // Use initials with user's color
        avatarHtml = `<div class="arturito-message-avatar" style="background: ${avatarColor}">${initials}</div>`;
      }
    } else {
      // Bot avatar - green "A"
      avatarHtml = `<div class="arturito-message-avatar">A</div>`;
    }

    return `
      <div class="arturito-message ${roleClass} ${errorClass}">
        ${avatarHtml}
        <div class="arturito-message-content">
          <div class="arturito-message-header">
            <span class="arturito-message-name">${escapeHtml(userName)}</span>
            <span class="arturito-message-time">${time}</span>
          </div>
          <div class="arturito-message-bubble">${formattedContent}</div>
        </div>
      </div>
    `;
  }

  function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Generate stable hue from string (for avatar color fallback)
  function stableHueFromString(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = s.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h % 360);
  }

  // Get avatar color from user data (uses avatar_color if set, otherwise generates from user_id)
  function getAvatarColor(user) {
    if (!user) return "hsl(200, 70%, 45%)";
    const ac = Number(user.avatar_color);
    const hue = Number.isFinite(ac) && ac >= 0 && ac <= 360
      ? ac
      : stableHueFromString(user.user_id || user.email || user.user_name);
    return `hsl(${hue}, 70%, 45%)`;
  }

  function formatMessageContent(content) {
    if (!content) return "";

    let formatted = escapeHtml(content);

    // Bold: *text* or **text**
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

    // Italic: _text_
    formatted = formatted.replace(/_(.+?)_/g, "<em>$1</em>");

    // Code: `code`
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    // Bullet points
    formatted = formatted.replace(/^[•\-\*]\s+(.+)/gm, "<li>$1</li>");
    if (formatted.includes("<li>")) {
      formatted = formatted.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
      formatted = formatted.replace(/<\/ul>\s*<ul>/g, "");
    }

    return formatted;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR CHAT (with Assistants API)
  // ─────────────────────────────────────────────────────────────────────────

  async function clearChat() {
    if (state.messages.length === 0) return;

    if (!confirm("¿Estás seguro de que quieres limpiar la conversación?")) {
      return;
    }

    try {
      // Call API to clear thread and get new one
      const response = await fetch(`${API_BASE}/arturito/clear-thread?session_id=${state.sessionId}`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        state.threadId = data.thread_id;  // Get new thread ID
      }
    } catch (err) {
      console.warn("[Arturito] Failed to clear server thread:", err);
    }

    // Clear local state
    state.messages = [];
    state.threadId = null;
    saveConversation();
    renderMessages();
    updateContextStats();

    if (typeof showToast === "function") {
      showToast("Conversación limpiada", "success");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE CONTEXT STATS
  // ─────────────────────────────────────────────────────────────────────────

  function updateContextStats() {
    const totalMessages = state.messages.length;

    if (DOM.messageCount) {
      DOM.messageCount.textContent = totalMessages;
    }

    if (DOM.contextSize) {
      // With Assistants API, context is unlimited (managed by OpenAI)
      DOM.contextSize.textContent = state.threadId ? "activo" : "nuevo";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    if (DOM.messagesContainer) {
      DOM.messagesContainer.scrollTop = DOM.messagesContainer.scrollHeight;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("es-MX", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPOSE API (for debugging)
  // ─────────────────────────────────────────────────────────────────────────

  window.ArturitoChat = {
    getState: () => state,
    clearChat,
    sendMessage: (text) => {
      DOM.chatInput.value = text;
      handleInputChange();
      sendMessage();
    },
    getThreadId: () => state.threadId,
  };
})();
