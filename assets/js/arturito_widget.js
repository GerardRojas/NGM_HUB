/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  NGM HUB — Arturito Floating Widget
 * ═══════════════════════════════════════════════════════════════════════════════
 *  Discrete chat assistant bubble that can be included on any page.
 *  Uses the same API as the full Arturito page.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

(function () {
  "use strict";

  // Skip on the dedicated Arturito page
  if (document.body.classList.contains("page-arturito")) {
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────────────

  const API_BASE = window.NGM_CONFIG?.API_BASE || window.API_BASE || "http://127.0.0.1:8000";
  const STORAGE_KEY = "arturito_widget_conversation";
  const SESSION_ID = `widget_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Auth helper
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────

  const state = {
    isOpen: false,
    isLoading: false,
    currentUser: null,
    messages: [],
    threadId: null,
    sessionId: SESSION_ID,
    currentPage: window.location.pathname.split("/").pop() || "index.html",
    pendingAction: null, // Store pending action data for confirmation
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COPILOT HANDLERS REGISTRY
  // ─────────────────────────────────────────────────────────────────────────
  // Pages can register their copilot handlers here

  const copilotHandlers = {};

  // ─────────────────────────────────────────────────────────────────────────
  // ARTURITO CAPABILITIES (Dynamic Knowledge Base)
  // ─────────────────────────────────────────────────────────────────────────

  const ARTURITO_CAPABILITIES = {
    navigation: [
      "Navigate to any page in the system (Expenses, Projects, Pipeline, etc.)",
      "Open specific sections within modules",
    ],
    expenses: [
      "Register new expenses with details (date, amount, vendor, category)",
      "Scan receipts using AI (OCR) to auto-extract data",
      "Auto-categorize expenses based on vendor and description",
      "Filter and search expenses by status, date, project, or vendor",
      "Check expense authorization status",
      "View and manage receipts/attachments",
    ],
    projects: [
      "List and search projects",
      "View project details and status",
      "Navigate to specific project pages",
    ],
    pipeline: [
      "View pipeline opportunities",
      "Check deal status and progress",
      "Navigate to pipeline details",
    ],
    tasks: [
      "View your assigned tasks",
      "Check task status (Not Started, Working, In Review)",
      "Navigate to task details",
    ],
    team: [
      "Look up team members",
      "Find contact information",
      "View team structure",
    ],
    messages: [
      "Navigate to Messages/Connect",
      "Help compose messages",
    ],
    help: [
      "Answer questions about how to use any NGM Hub module",
      "Provide step-by-step guides for common tasks",
      "Explain features and workflows",
    ],
    general: [
      "Respond in English or Spanish based on your question",
      "Remember context within a conversation",
      "Provide quick actions with confirmation buttons",
    ],
  };

  /**
   * Check if the user is asking what Arturito can do
   */
  function isCapabilitiesQuery(text) {
    const lower = text.toLowerCase().trim();
    const patterns = [
      /what can you do/i,
      /what do you do/i,
      /what are your (capabilities|features|functions)/i,
      /how can you help/i,
      /what can i ask/i,
      /help me understand what you/i,
      /qué puedes hacer/i,
      /que puedes hacer/i,
      /qué sabes hacer/i,
      /que sabes hacer/i,
      /en qué me puedes ayudar/i,
      /cómo me puedes ayudar/i,
      /como me puedes ayudar/i,
    ];
    return patterns.some(p => p.test(lower));
  }

  /**
   * Generate dynamic capabilities response
   */
  function generateCapabilitiesResponse() {
    const sections = [
      { title: "Navigation", items: ARTURITO_CAPABILITIES.navigation },
      { title: "Expenses Management", items: ARTURITO_CAPABILITIES.expenses },
      { title: "Projects", items: ARTURITO_CAPABILITIES.projects },
      { title: "Pipeline", items: ARTURITO_CAPABILITIES.pipeline },
      { title: "Tasks", items: ARTURITO_CAPABILITIES.tasks },
      { title: "Team", items: ARTURITO_CAPABILITIES.team },
      { title: "Messages", items: ARTURITO_CAPABILITIES.messages },
      { title: "Help & Guidance", items: ARTURITO_CAPABILITIES.help },
      { title: "General", items: ARTURITO_CAPABILITIES.general },
    ];

    let response = "I'm **Arturito**, your NGM Hub assistant! Here's what I can help you with:\n\n";

    sections.forEach(section => {
      response += `**${section.title}:**\n`;
      section.items.forEach(item => {
        response += `• ${item}\n`;
      });
      response += "\n";
    });

    response += "💡 **Tip:** Just ask me in natural language! For example:\n";
    response += "• \"Take me to expenses\"\n";
    response += "• \"How do I scan a receipt?\"\n";
    response += "• \"Show me my tasks\"\n";
    response += "• \"Help me register an expense\"";

    return response;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOM REFERENCES
  // ─────────────────────────────────────────────────────────────────────────

  let DOM = {};

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  function init() {
    // Don't initialize if already exists
    if (document.getElementById("arturito-widget-btn")) return;

    // Inject HTML
    injectWidgetHTML();

    // Cache DOM references
    cacheDOMReferences();

    // Load saved conversation
    loadConversation();

    // Load current user
    loadCurrentUser();

    // Setup event listeners
    setupEventListeners();

    // Setup mobile keyboard detection
    setupMobileKeyboardDetection();

    // Render messages
    renderMessages();

    // Check for pending actions from previous page
    checkPendingActions();

    console.log("[Arturito Widget] Initialized");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INJECT HTML
  // ─────────────────────────────────────────────────────────────────────────

  function injectWidgetHTML() {
    const html = `
      <!-- Floating Button -->
      <button type="button" class="arturito-widget-btn" id="arturito-widget-btn" title="Chat with Arturito">
        A
      </button>

      <!-- Chat Panel -->
      <div class="arturito-widget-panel" id="arturito-widget-panel">
        <!-- Header -->
        <div class="arturito-widget-header">
          <div class="arturito-widget-title">
            <div class="arturito-widget-avatar">A</div>
            <div>
              <div class="arturito-widget-name">Arturito</div>
              <div class="arturito-widget-status">
                <span class="arturito-widget-status-dot"></span>
                <span>AI Assistant</span>
              </div>
            </div>
          </div>
          <div class="arturito-widget-actions">
            <button type="button" class="arturito-widget-action-btn" id="arturito-widget-clear" title="New conversation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button type="button" class="arturito-widget-action-btn" id="arturito-widget-expand" title="Open full page">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
            <button type="button" class="arturito-widget-action-btn" id="arturito-widget-close" title="Close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div class="arturito-widget-messages" id="arturito-widget-messages">
          <!-- Welcome (empty - waits for user input) -->
          <div class="arturito-widget-welcome" id="arturito-widget-welcome" style="display: none;"></div>

          <!-- Messages list -->
          <div id="arturito-widget-messages-list"></div>

          <!-- Typing indicator -->
          <div class="arturito-widget-typing" id="arturito-widget-typing" style="display: none;">
            <div class="arturito-widget-msg-avatar" style="background: linear-gradient(135deg, #3ecf8e, #10b981);">A</div>
            <div class="arturito-widget-typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="arturito-widget-input-area">
          <div class="arturito-widget-input-row">
            <textarea
              id="arturito-widget-input"
              class="arturito-widget-input"
              placeholder="Ask Arturito..."
              rows="1"
            ></textarea>
            <button type="button" class="arturito-widget-send-btn" id="arturito-widget-send" disabled>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
  }

  function cacheDOMReferences() {
    DOM.btn = document.getElementById("arturito-widget-btn");
    DOM.panel = document.getElementById("arturito-widget-panel");
    DOM.messages = document.getElementById("arturito-widget-messages");
    DOM.messagesList = document.getElementById("arturito-widget-messages-list");
    DOM.welcome = document.getElementById("arturito-widget-welcome");
    DOM.typing = document.getElementById("arturito-widget-typing");
    DOM.input = document.getElementById("arturito-widget-input");
    DOM.sendBtn = document.getElementById("arturito-widget-send");
    DOM.closeBtn = document.getElementById("arturito-widget-close");
    DOM.clearBtn = document.getElementById("arturito-widget-clear");
    DOM.expandBtn = document.getElementById("arturito-widget-expand");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────

  async function loadCurrentUser() {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        credentials: "include",
        headers: { ...getAuthHeaders() }
      });
      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      const user = data.user || data;
      state.currentUser = {
        user_id: user.user_id || user.id,
        user_name: user.username || user.user_name || user.name,
        email: user.email,
        user_role: user.user_role || user.role,  // Rol del usuario
        avatar_color: user.avatar_color,
        user_photo: user.user_photo || user.photo || user.avatar,
      };
    } catch (err) {
      // Try localStorage fallback
      try {
        const rawUser = localStorage.getItem("ngmUser");
        if (rawUser) {
          const user = JSON.parse(rawUser);
          state.currentUser = {
            user_id: user.user_id || user.id,
            user_name: user.username || user.user_name || user.name,
            email: user.email,
            user_role: user.user_role || user.role,  // Rol del usuario
            avatar_color: user.avatar_color,
            user_photo: user.user_photo || user.photo || user.avatar,
          };
        }
      } catch (e) {
        state.currentUser = { user_id: "guest", user_name: "Usuario", email: "", user_role: null };
      }
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
      }
    } catch (err) {
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
      console.warn("[Arturito Widget] Failed to save conversation:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────────────────────────────────

  function setupEventListeners() {
    // Toggle panel
    DOM.btn.addEventListener("click", openPanel);
    DOM.closeBtn.addEventListener("click", closePanel);

    // Clear chat
    DOM.clearBtn.addEventListener("click", clearChat);

    // Expand to full page
    DOM.expandBtn.addEventListener("click", () => {
      window.location.href = "arturito.html";
    });

    // Input handling
    DOM.input.addEventListener("input", handleInputChange);
    DOM.input.addEventListener("keydown", handleInputKeydown);
    DOM.sendBtn.addEventListener("click", sendMessage);

    // Close on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.isOpen) {
        closePanel();
      }
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (state.isOpen && !DOM.panel.contains(e.target) && !DOM.btn.contains(e.target)) {
        closePanel();
      }
    });
  }

  function openPanel() {
    state.isOpen = true;
    DOM.panel.classList.add("is-open");
    DOM.btn.classList.add("is-hidden");
    DOM.input.focus();
    scrollToBottom();

    // Prevent body scroll on mobile
    if (window.innerWidth <= 480) {
      document.body.classList.add("arturito-widget-active");
    }
  }

  function closePanel() {
    state.isOpen = false;
    DOM.panel.classList.remove("is-open");
    DOM.btn.classList.remove("is-hidden");

    // Restore body scroll
    document.body.classList.remove("arturito-widget-active");
    DOM.panel.classList.remove("keyboard-open");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE KEYBOARD DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  function setupMobileKeyboardDetection() {
    // Use visualViewport API if available (more reliable)
    if (window.visualViewport) {
      let initialHeight = window.visualViewport.height;

      window.visualViewport.addEventListener("resize", () => {
        if (!state.isOpen || window.innerWidth > 480) return;

        const currentHeight = window.visualViewport.height;
        const heightDiff = initialHeight - currentHeight;

        // If viewport shrunk by more than 150px, keyboard is likely open
        if (heightDiff > 150) {
          DOM.panel.classList.add("keyboard-open");
          // Adjust panel height to visible area
          DOM.panel.style.height = `${currentHeight - 60}px`;
        } else {
          DOM.panel.classList.remove("keyboard-open");
          DOM.panel.style.height = "";
        }

        scrollToBottom();
      });

      // Update initial height on orientation change
      window.addEventListener("orientationchange", () => {
        setTimeout(() => {
          initialHeight = window.visualViewport.height;
        }, 100);
      });
    } else {
      // Fallback for older browsers: detect via focus/blur
      DOM.input.addEventListener("focus", () => {
        if (window.innerWidth <= 480) {
          setTimeout(() => {
            DOM.panel.classList.add("keyboard-open");
            scrollToBottom();
          }, 300);
        }
      });

      DOM.input.addEventListener("blur", () => {
        DOM.panel.classList.remove("keyboard-open");
      });
    }
  }

  function handleInputChange() {
    const value = DOM.input.value.trim();
    DOM.sendBtn.disabled = !value;

    // Auto-resize
    DOM.input.style.height = "auto";
    DOM.input.style.height = Math.min(DOM.input.scrollHeight, 100) + "px";
  }

  function handleInputKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!DOM.sendBtn.disabled) {
        sendMessage();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EXPENSES FILTER COMMAND HANDLER
  // ─────────────────────────────────────────────────────────────────────────

  function handleExpensesFilterCommand(text) {
    // Check if ExpensesArturito interface is available (only on expenses page)
    if (!window.ExpensesArturito) {
      return null; // Not on expenses page
    }

    const lower = text.toLowerCase().trim();

    // Clear all filters commands
    const clearAllPatterns = [
      /^(quita|elimina|limpia|borra|clear|remove)\s*(todos?\s*los?\s*)?(filtros?|filters?)/i,
      /^(sin|no)\s*filtros?/i,
      /^reset(ear?)?\s*filtros?/i,
      /^mostrar\s*todo/i,
      /^show\s*all/i,
    ];

    for (const pattern of clearAllPatterns) {
      if (pattern.test(lower)) {
        window.ExpensesArturito.clearAllFilters();
        return {
          handled: true,
          message: "✅ **Filtros eliminados**\n\nAhora se muestran todos los gastos sin filtrar."
        };
      }
    }

    // Filter by bill number
    const billPatterns = [
      /(?:filtra|filter|muestra|show|busca|search).*(?:bill|factura|recibo)\s*#?\s*(\d+)/i,
      /(?:bill|factura|recibo)\s*#?\s*(\d+)/i,
      /^#?\s*(\d{3,})\s*$/i, // Just a number (3+ digits) might be a bill number
    ];

    for (const pattern of billPatterns) {
      const match = lower.match(pattern);
      if (match && match[1]) {
        const billNumber = match[1];
        window.ExpensesArturito.filterBy('bill_id', billNumber);
        const summary = window.ExpensesArturito.getSummary();
        return {
          handled: true,
          message: `✅ **Filtro aplicado: Bill #${billNumber}**\n\nMostrando ${summary.filteredExpenses} gasto(s) con este número de factura.\n\n💡 Para quitar el filtro, escribe: "quita filtros"`
        };
      }
    }

    // Filter by vendor
    const vendorPatterns = [
      /(?:filtra|filter|muestra|show).*(?:vendor|proveedor|vendedor)\s+["']?(.+?)["']?$/i,
      /(?:gastos?\s*(?:de|del|from))\s+["']?(.+?)["']?$/i,
    ];

    for (const pattern of vendorPatterns) {
      const match = lower.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        const vendorName = match[1].trim();
        window.ExpensesArturito.filterBy('vendor', vendorName);
        const summary = window.ExpensesArturito.getSummary();
        return {
          handled: true,
          message: `✅ **Filtro aplicado: Vendor "${vendorName}"**\n\nMostrando ${summary.filteredExpenses} gasto(s) de este proveedor.\n\n💡 Para quitar el filtro, escribe: "quita filtros"`
        };
      }
    }

    // Search command
    const searchPatterns = [
      /(?:busca|search|encuentra|find)\s+["']?(.+?)["']?$/i,
    ];

    for (const pattern of searchPatterns) {
      const match = lower.match(pattern);
      if (match && match[1] && match[1].length > 1) {
        const searchTerm = match[1].trim();
        window.ExpensesArturito.search(searchTerm);
        const summary = window.ExpensesArturito.getSummary();
        return {
          handled: true,
          message: `🔍 **Búsqueda: "${searchTerm}"**\n\nEncontrados ${summary.filteredExpenses} gasto(s).\n\n💡 Para quitar el filtro, escribe: "quita filtros"`
        };
      }
    }

    // Get summary command
    const summaryPatterns = [
      /(?:resumen|summary|cuantos?|how\s*many).*(?:gastos?|expenses?)/i,
      /^(?:total|dame el total)$/i,
    ];

    for (const pattern of summaryPatterns) {
      if (pattern.test(lower)) {
        const summary = window.ExpensesArturito.getSummary();
        const activeFilters = Object.keys(summary.activeFilters);
        const filterText = activeFilters.length > 0
          ? `\n\n📋 **Filtros activos:** ${activeFilters.join(', ')}`
          : '';

        return {
          handled: true,
          message: `📊 **Resumen de gastos**\n\n• Total visible: ${summary.filteredExpenses} gastos\n• Total en tabla: ${summary.totalExpenses} gastos\n• Monto visible: ${summary.totalAmount}${filterText}`
        };
      }
    }

    // No match found
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────────────────────────────────

  async function sendMessage() {
    const content = DOM.input.value.trim();
    if (!content || state.isLoading) return;

    // Hide welcome
    if (DOM.welcome) {
      DOM.welcome.style.display = "none";
    }

    // Add user message
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: content,
      timestamp: new Date().toISOString(),
    };

    state.messages.push(userMessage);
    saveConversation();
    renderMessages();
    scrollToBottom();

    // Clear input early
    DOM.input.value = "";
    DOM.input.style.height = "auto";
    DOM.sendBtn.disabled = true;

    // Check if this is a "what can you do" type query - handle locally
    if (isCapabilitiesQuery(content)) {
      const botMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: generateCapabilitiesResponse(),
        timestamp: new Date().toISOString(),
      };
      state.messages.push(botMessage);
      saveConversation();
      renderMessages();
      scrollToBottom();
      return;
    }

    // Check for expenses filter commands (only works when on expenses page)
    const filterResult = handleExpensesFilterCommand(content);
    if (filterResult) {
      const botMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: filterResult.message,
        timestamp: new Date().toISOString(),
      };
      state.messages.push(botMessage);
      saveConversation();
      renderMessages();
      scrollToBottom();
      return;
    }

    // Show typing
    state.isLoading = true;
    DOM.typing.style.display = "flex";
    scrollToBottom();

    try {
      const response = await fetch(`${API_BASE}/arturito/web-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          text: content,
          user_name: state.currentUser?.user_name,
          user_email: state.currentUser?.email,
          user_role: state.currentUser?.user_role,  // Rol para control de permisos
          user_id: state.currentUser?.user_id,
          session_id: state.sessionId,
          thread_id: state.threadId,
          current_page: state.currentPage,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Save thread_id
      if (data.thread_id) {
        state.threadId = data.thread_id;
      }

      // Handle action responses
      if (data.action && data.action !== "small_talk" && data.action !== "greeting") {
        handleBotAction(data);
      }

      // Add bot response
      const botMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.text || "I couldn't process your message.",
        timestamp: new Date().toISOString(),
        action: data.action,
        actionData: data.data,
      };

      state.messages.push(botMessage);
      saveConversation();

    } catch (err) {
      console.error("[Arturito Widget] Error:", err);

      const errorMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Sorry, there was an error. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true,
      };

      state.messages.push(errorMessage);
      saveConversation();

    } finally {
      state.isLoading = false;
      DOM.typing.style.display = "none";
      renderMessages();
      scrollToBottom();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER MESSAGES
  // ─────────────────────────────────────────────────────────────────────────

  function renderMessages() {
    if (state.messages.length === 0) {
      DOM.messagesList.innerHTML = "";
      if (DOM.welcome) {
        DOM.welcome.style.display = "block";
      }
      return;
    }

    if (DOM.welcome) {
      DOM.welcome.style.display = "none";
    }

    const html = state.messages.map((msg) => renderMessage(msg)).join("");
    DOM.messagesList.innerHTML = html;
  }

  function renderMessage(msg) {
    const isUser = msg.role === "user";
    const isError = msg.isError;
    const formattedContent = formatMessageContent(msg.content);

    const errorClass = isError ? "arturito-widget-msg--error" : "";
    const roleClass = isUser ? "arturito-widget-msg--user" : "arturito-widget-msg--bot";

    // Build avatar
    let avatarHtml;
    if (isUser) {
      const userPhoto = state.currentUser?.user_photo;
      const avatarColor = getAvatarColor(state.currentUser);
      const initials = getInitials(state.currentUser?.user_name || "U");

      if (userPhoto) {
        avatarHtml = `<div class="arturito-widget-msg-avatar arturito-widget-msg-avatar--img" style="background-image: url('${escapeHtml(userPhoto)}')"></div>`;
      } else {
        avatarHtml = `<div class="arturito-widget-msg-avatar" style="background: ${avatarColor}">${initials}</div>`;
      }
    } else {
      avatarHtml = `<div class="arturito-widget-msg-avatar" style="background: linear-gradient(135deg, #3ecf8e, #10b981);">A</div>`;
    }

    // Build action buttons if applicable
    let actionButtonsHtml = "";
    if (!isUser && msg.action) {
      actionButtonsHtml = renderActionButtons(msg);
    }

    return `
      <div class="arturito-widget-msg ${roleClass} ${errorClass}">
        ${avatarHtml}
        <div class="arturito-widget-msg-content">
          <div class="arturito-widget-msg-bubble">${formattedContent}</div>
          ${actionButtonsHtml}
        </div>
      </div>
    `;
  }

  function renderActionButtons(msg) {
    const action = msg.action;
    const actionData = msg.actionData || {};

    switch (action) {
      case "permission_denied":
        // Offer to send message to helpers
        const helpers = actionData.helpers || [];
        if (helpers.length > 0) {
          const firstHelper = helpers[0];
          const helperName = firstHelper.user_name || firstHelper.role || "Helper";
          return `
            <div class="arturito-widget-action-btns">
              <button type="button" class="arturito-widget-action-btn-inline" onclick="ArturitoWidget.sendHelpRequest('${escapeHtml(helperName)}')">
                Send message to ${escapeHtml(helperName)}
              </button>
            </div>
          `;
        }
        break;

      case "confirm_bug_report":
        return `
          <div class="arturito-widget-action-btns">
            <button type="button" class="arturito-widget-action-btn-inline arturito-widget-action-btn-primary" onclick="ArturitoWidget.confirmBugReport()">
              Create ticket
            </button>
            <button type="button" class="arturito-widget-action-btn-inline" onclick="ArturitoWidget.cancelBugReport()">
              Cancel
            </button>
          </div>
        `;

      case "suggest_delegation":
        // Show delegation confirmation buttons
        const delegation = actionData.delegation || {};
        const teamName = delegation.team_name || "the responsible team";
        return `
          <div class="arturito-widget-action-btns">
            <button type="button" class="arturito-widget-action-btn-inline arturito-widget-action-btn-primary" onclick="ArturitoWidget.confirmDelegation()">
              Yes, send message
            </button>
            <button type="button" class="arturito-widget-action-btn-inline" onclick="ArturitoWidget.cancelDelegation()">
              No, thanks
            </button>
          </div>
        `;

      case "navigate":
      case "navigate_then_action":
        // Show navigation indicator
        return `
          <div class="arturito-widget-action-btns">
            <span class="arturito-widget-action-indicator">Navegando...</span>
          </div>
        `;

      case "help_response":
        // If there's a URL, offer to navigate
        if (actionData.url && !state.currentPage.includes(actionData.url)) {
          return `
            <div class="arturito-widget-action-btns">
              <button type="button" class="arturito-widget-action-btn-inline" onclick="window.location.href='${escapeHtml(actionData.url)}'">
                Ir a ${escapeHtml(actionData.module || "pagina")}
              </button>
            </div>
          `;
        }
        break;

      case "bva_report_pdf":
        // Show PDF download button
        if (actionData.pdf_url) {
          const projectName = actionData.project_name || "BVA Report";
          return `
            <div class="arturito-widget-action-btns">
              <a href="${escapeHtml(actionData.pdf_url)}"
                 target="_blank"
                 rel="noopener noreferrer"
                 class="arturito-widget-action-btn-inline arturito-widget-action-btn-primary arturito-widget-pdf-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right: 6px;">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                Abrir PDF
              </a>
              <button type="button"
                      class="arturito-widget-action-btn-inline"
                      onclick="ArturitoWidget.downloadPDF('${escapeHtml(actionData.pdf_url)}', '${escapeHtml(projectName)}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="margin-right: 6px;">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descargar
              </button>
            </div>
          `;
        }
        break;

      case "ask_project":
        // Show clickable project buttons when user asks for BVA without specifying project
        if (actionData.projects && actionData.projects.length > 0) {
          const projectButtons = actionData.projects.slice(0, 6).map(p =>
            `<button type="button"
                    class="arturito-widget-action-btn-inline arturito-widget-project-btn"
                    onclick="ArturitoWidget.selectProjectForBVA('${escapeHtml(p.name)}')">
              ${escapeHtml(p.name)}
            </button>`
          ).join("");
          return `
            <div class="arturito-widget-action-btns arturito-widget-project-grid">
              ${projectButtons}
            </div>
          `;
        }
        break;
    }

    return "";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLEAR CHAT
  // ─────────────────────────────────────────────────────────────────────────

  async function clearChat() {
    if (state.messages.length === 0) return;

    try {
      await fetch(`${API_BASE}/arturito/clear-thread?session_id=${state.sessionId}`, {
        method: "POST",
        credentials: "include",
        headers: { ...getAuthHeaders() }
      });
    } catch (err) {
      console.warn("[Arturito Widget] Failed to clear server thread:", err);
    }

    state.messages = [];
    state.threadId = null;
    saveConversation();
    renderMessages();

    if (typeof Toast !== "undefined") {
      Toast.success("Conversación limpiada", "");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACTION HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  function handleBotAction(data) {
    const action = data.action;
    const actionData = data.data || {};

    switch (action) {
      case "navigate":
        // Navigate to a page
        if (actionData.url) {
          setTimeout(() => {
            window.location.href = actionData.url;
          }, 1000);
        }
        break;

      case "navigate_then_action":
        // Store the action to execute after navigation
        sessionStorage.setItem("arturito_pending_action", JSON.stringify({
          action: actionData.then_action,
          data: actionData,
        }));
        if (actionData.url) {
          setTimeout(() => {
            window.location.href = actionData.url;
          }, 1000);
        }
        break;

      case "open_modal":
        // Try to open a modal on the current page
        openModalByAction(actionData.modal_id);
        break;

      case "permission_denied":
        // Store helper data for potential message sending
        state.pendingAction = {
          type: "send_help_request",
          helpers: actionData.helpers,
          requestedAction: actionData.requested_action,
        };
        break;

      case "suggest_delegation":
        // Store delegation data for user confirmation
        state.pendingAction = {
          type: "delegation_request",
          delegation: actionData.delegation,
          originalIntent: actionData.intent,
          originalText: actionData.raw_text,
        };
        break;

      case "confirm_bug_report":
        // Store bug report data for confirmation
        state.pendingAction = {
          type: "create_bug_report",
          taskData: actionData,
        };
        break;

      case "help_response":
        // If the response includes a navigation suggestion
        if (actionData.url && !state.currentPage.includes(actionData.url)) {
          // Don't auto-navigate for help responses, just show the info
        }
        break;

      case "copilot_execute":
        // Execute a copilot command on the current page
        executeCopilotCommand(actionData);
        break;

      default:
        // No special handling needed
        break;
    }
  }

  function executeCopilotCommand(actionData) {
    const command = actionData.command;
    const params = actionData.params || {};
    const page = actionData.page;
    const expectsResult = actionData.expects_result || false;

    console.log("[Arturito Widget] Executing copilot command:", command, params);

    // Check if page has registered handlers
    const pageHandlers = copilotHandlers[page];
    if (!pageHandlers) {
      console.warn("[Arturito Widget] No copilot handlers registered for page:", page);
      return;
    }

    // Find and execute the handler
    const handler = pageHandlers[command];
    if (!handler) {
      console.warn("[Arturito Widget] No handler for command:", command);
      return;
    }

    try {
      // Replace __CURRENT_USER__ with actual user name if present
      if (params.user_name === "__CURRENT_USER__" && state.currentUser) {
        params.user_name = state.currentUser.user_name;
      }

      // Execute handler and capture result
      const result = handler(params);

      // If command expects results, add a follow-up message with the findings
      if (expectsResult && result) {
        setTimeout(() => {
          const followUpMsg = formatCopilotResult(command, result);
          if (followUpMsg) {
            addBotMessage(followUpMsg);
          }
        }, 500); // Small delay to let UI update first
      }

    } catch (err) {
      console.error("[Arturito Widget] Error executing copilot command:", err);
      if (typeof Toast !== "undefined") {
        Toast.error("Error executing command", err.message);
      }
    }
  }

  /**
   * Format copilot command results into a readable message
   */
  function formatCopilotResult(command, result) {
    if (command === "healthCheckDuplicateBills") {
      if (!result || result.total_issues === 0) {
        return "✅ **Health Check completado**: No encontré ningún conflicto. Todos los bills tienen vendors consistentes.";
      }

      let msg = `⚠️ **Encontré ${result.total_issues} bill(s) con conflictos**:\n\n`;

      result.issues.slice(0, 5).forEach((issue, i) => {
        msg += `${i + 1}. **Bill #${issue.bill_id}** tiene ${issue.vendors.length} vendors diferentes:\n`;
        msg += `   - ${issue.vendors.join(", ")}\n`;
      });

      if (result.has_more || result.total_issues > 5) {
        msg += `\n...y ${result.total_issues - 5} más.\n`;
      }

      msg += "\nLas filas con conflictos están resaltadas en **naranja** en la tabla.";

      return msg;
    }

    return null;
  }

  /**
   * Add a bot message to the chat
   */
  function addBotMessage(text) {
    const msg = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: text,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(msg);
    renderMessages();
    saveConversation();
    scrollToBottom();
  }

  function openModalByAction(modalId) {
    // Map modal IDs to actual DOM elements or functions
    const modalMap = {
      "add_expense": () => {
        const btn = document.getElementById("btnAddExpense");
        if (btn) btn.click();
      },
      "scan_receipt": () => {
        const btn = document.getElementById("btnScanReceipt");
        if (btn) btn.click();
      },
      "new_task": () => {
        const btn = document.getElementById("btnNewTask");
        if (btn) btn.click();
      },
      "add_project": () => {
        const btn = document.getElementById("btnAddProject");
        if (btn) btn.click();
      },
      "add_user": () => {
        const btn = document.getElementById("btnAddUser");
        if (btn) btn.click();
      },
    };

    const openFn = modalMap[modalId];
    if (openFn) {
      setTimeout(() => {
        openFn();
        closePanel(); // Close widget after opening modal
      }, 500);
    } else {
      console.warn("[Arturito Widget] Unknown modal:", modalId);
    }
  }

  // Check for pending actions on page load
  function checkPendingActions() {
    try {
      const pending = sessionStorage.getItem("arturito_pending_action");
      if (pending) {
        const actionData = JSON.parse(pending);
        sessionStorage.removeItem("arturito_pending_action");

        // Wait for page to load then execute
        setTimeout(() => {
          if (actionData.action === "open_modal") {
            openModalByAction(actionData.data.modal_id);
          }
        }, 1000);
      }
    } catch (err) {
      console.warn("[Arturito Widget] Failed to check pending actions:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────

  function scrollToBottom() {
    if (DOM.messages) {
      DOM.messages.scrollTop = DOM.messages.scrollHeight;
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function formatMessageContent(content) {
    if (!content) return "";

    let formatted = escapeHtml(content);

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

    // Markdown links [text](url) - convert to clickable links
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="arturito-widget-link">$1</a>'
    );

    // Line breaks
    formatted = formatted.replace(/\n/g, "<br>");

    return formatted;
  }

  function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  function stableHueFromString(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = s.charCodeAt(i) + ((h << 5) - h);
    }
    return Math.abs(h % 360);
  }

  function getAvatarColor(user) {
    if (!user) return "hsl(200, 70%, 45%)";
    const ac = Number(user.avatar_color);
    const hue = Number.isFinite(ac) && ac >= 0 && ac <= 360
      ? ac
      : stableHueFromString(user.user_id || user.email || user.user_name);
    return `hsl(${hue}, 70%, 45%)`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────────

  // Action response handlers
  async function sendHelpRequest(helperName) {
    if (!state.pendingAction || state.pendingAction.type !== "send_help_request") {
      return;
    }

    // Add user confirmation message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: `Yes, send a message to ${helperName}`,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);

    // Send the request
    DOM.typing.style.display = "flex";
    state.isLoading = true;

    try {
      const response = await fetch(`${API_BASE}/arturito/web-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          text: `Send help message to ${helperName} for ${state.pendingAction.requestedAction}`,
          user_name: state.currentUser?.user_name,
          user_id: state.currentUser?.user_id,
          session_id: state.sessionId,
          thread_id: state.threadId,
          current_page: state.currentPage,
          action_context: state.pendingAction,
        }),
      });

      const data = await response.json();

      const botMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.text || "Message sent.",
        timestamp: new Date().toISOString(),
      };
      state.messages.push(botMsg);

    } catch (err) {
      const errorMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "I couldn't send the message. You can contact them directly via Messages.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      state.messages.push(errorMsg);
    } finally {
      state.pendingAction = null;
      state.isLoading = false;
      DOM.typing.style.display = "none";
      saveConversation();
      renderMessages();
      scrollToBottom();
    }
  }

  async function confirmBugReport() {
    if (!state.pendingAction || state.pendingAction.type !== "create_bug_report") {
      return;
    }

    // Add user confirmation message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: "Yes, create the ticket",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);
    renderMessages();

    // Send confirmation
    DOM.typing.style.display = "flex";
    state.isLoading = true;

    try {
      const response = await fetch(`${API_BASE}/arturito/create-bug-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          task_data: state.pendingAction.taskData,
          user_id: state.currentUser?.user_id,
        }),
      });

      const data = await response.json();

      const botMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.text || "Ticket created successfully.",
        timestamp: new Date().toISOString(),
      };
      state.messages.push(botMsg);

      if (typeof Toast !== "undefined") {
        Toast.success("Ticket created", "The tech team will review it soon");
      }

    } catch (err) {
      const errorMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "I couldn't create the ticket. Please create it manually in Pipeline.",
        timestamp: new Date().toISOString(),
        isError: true,
      };
      state.messages.push(errorMsg);
    } finally {
      state.pendingAction = null;
      state.isLoading = false;
      DOM.typing.style.display = "none";
      saveConversation();
      renderMessages();
      scrollToBottom();
    }
  }

  function cancelBugReport() {
    state.pendingAction = null;

    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: "Cancel",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);

    const botMsg = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: "Got it, I won't create the ticket. If you need to report something later, I'm here to help.",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(botMsg);

    saveConversation();
    renderMessages();
    scrollToBottom();
  }

  /**
   * Register copilot handlers for a specific page.
   * Called by page-specific JS to enable copilot commands.
   *
   * @param {string} page - Page name (e.g., 'expenses.html')
   * @param {Object} handlers - Map of command names to handler functions
   *
   * Example:
   * ArturitoWidget.registerCopilotHandlers('expenses.html', {
   *   filterByAuthStatus: (params) => { ... },
   *   filterByProject: (params) => { ... },
   *   clearFilters: () => { ... },
   * });
   */
  function registerCopilotHandlers(page, handlers) {
    copilotHandlers[page] = { ...copilotHandlers[page], ...handlers };
    console.log(`[Arturito Widget] Registered copilot handlers for ${page}:`, Object.keys(handlers));
  }

  /**
   * Download a PDF file with a proper filename
   * @param {string} pdfUrl - URL of the PDF to download
   * @param {string} projectName - Name of the project for the filename
   */
  async function downloadPDF(pdfUrl, projectName) {
    try {
      // Fetch the PDF as a blob
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Failed to fetch PDF");

      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename with date
      const date = new Date().toISOString().split("T")[0];
      const safeName = projectName.replace(/[^a-zA-Z0-9\s-]/g, "").trim();
      a.download = `${safeName}_BVA_${date}.pdf`;

      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (typeof Toast !== "undefined") {
        Toast.success("Descarga iniciada", `${safeName}_BVA_${date}.pdf`);
      }
    } catch (err) {
      console.error("[Arturito Widget] Error downloading PDF:", err);
      // Fallback: open in new tab
      window.open(pdfUrl, "_blank");
      if (typeof Toast !== "undefined") {
        Toast.warning("Descarga alternativa", "El PDF se abrió en una nueva pestaña");
      }
    }
  }

  /**
   * Select a project and request its BVA report
   * Called when user clicks on a project button after asking for BVA without project
   * @param {string} projectName - Name of the project to generate BVA for
   */
  function selectProjectForBVA(projectName) {
    // Simulate user typing "bva [project]"
    const message = `bva ${projectName}`;

    // Add as user message
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);
    saveConversation();
    renderMessages();
    scrollToBottom();

    // Set the input and send
    DOM.input.value = message;
    sendMessage();
  }

  /**
   * Confirm delegation - send message to the responsible team
   */
  async function confirmDelegation() {
    if (!state.pendingAction || state.pendingAction.type !== "delegation_request") {
      return;
    }

    const delegation = state.pendingAction.delegation;
    const originalText = state.pendingAction.originalText;
    const teamName = delegation.team_name || "the responsible team";

    // Clear pending action
    state.pendingAction = null;

    // Add user confirmation
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: "Yes, send message",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);

    // Show typing
    state.isLoading = true;
    DOM.typing.style.display = "flex";
    renderMessages();
    scrollToBottom();

    try {
      // Send delegation request to backend
      const response = await fetch(`${API_BASE}/arturito/delegate-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        credentials: "include",
        body: JSON.stringify({
          team_key: delegation.team_key,
          action_description: delegation.action_description,
          original_request: originalText,
          user_name: state.currentUser?.user_name,
          user_email: state.currentUser?.email,
          session_id: state.sessionId,
        }),
      });

      const data = await response.json();

      const botMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: data.text || `I've sent your request to ${teamName}. They will notify you when it's ready.`,
        timestamp: new Date().toISOString(),
      };
      state.messages.push(botMsg);

    } catch (err) {
      console.error("[Arturito Widget] Error sending delegation:", err);
      const botMsg = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: `I couldn't send the message to ${teamName}. Please contact them directly.`,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      state.messages.push(botMsg);
    } finally {
      state.isLoading = false;
      DOM.typing.style.display = "none";
      saveConversation();
      renderMessages();
      scrollToBottom();
    }
  }

  /**
   * Cancel delegation - user doesn't want to send message
   */
  function cancelDelegation() {
    if (!state.pendingAction || state.pendingAction.type !== "delegation_request") {
      return;
    }

    // Clear pending action
    state.pendingAction = null;

    // Add user cancellation
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: "No, thanks",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(userMsg);

    const botMsg = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: "Got it. If you need anything else, I'm here to help.",
      timestamp: new Date().toISOString(),
    };
    state.messages.push(botMsg);

    saveConversation();
    renderMessages();
    scrollToBottom();
  }

  window.ArturitoWidget = {
    open: openPanel,
    close: closePanel,
    toggle: () => state.isOpen ? closePanel() : openPanel(),
    isOpen: () => state.isOpen,
    clearChat,
    sendHelpRequest,
    confirmBugReport,
    cancelBugReport,
    confirmDelegation,
    cancelDelegation,
    registerCopilotHandlers,
    downloadPDF,
    selectProjectForBVA,
  };

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO INIT
  // ─────────────────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
