/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  NGM HUB â€” Arturito Floating Widget
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  Discrete chat assistant bubble that can be included on any page.
 *  Uses the same API as the full Arturito page.
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */

(function () {
  "use strict";

  // Skip on the dedicated Arturito page
  if (document.body.classList.contains("page-arturito")) {
    return;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // CONFIGURATION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const API_BASE = window.NGM_CONFIG?.API_BASE || window.API_BASE || "http://127.0.0.1:8000";
  const STORAGE_KEY = "arturito_widget_conversation";
  const SESSION_ID = `widget_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Auth helper
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // STATE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // COPILOT HANDLERS REGISTRY
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Pages can register their copilot handlers here

  const copilotHandlers = {};

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ARTURITO CAPABILITIES (Dynamic Knowledge Base)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const ARTURITO_CAPABILITIES = {
    navigation: [
      "Navigate to any page in the system (Expenses, Projects, Pipeline, etc.)",
      "Open specific sections within modules",
    ],
    expenses: [
      "Register new expenses with details (date, amount, vendor, category)",
      "Scan receipts using AI (OCR) to auto-extract data",
      "Auto-categorize expenses based on vendor and description",
      "**Filter by bill number:** 'factura 123', 'bill #456'",
      "**Filter by vendor:** 'proveedor Home Depot', 'vendor Amazon'",
      "**Filter by account:** 'cuenta materiales', 'account lumber'",
      "**Filter by type:** 'tipo labor', 'type materials'",
      "**Filter by payment:** 'pagados con cheque', 'payment card'",
      "**Filter by status:** 'pendientes', 'autorizados', 'en revision'",
      "**Search:** 'busca hotel', 'find restaurant'",
      "**Clear filters:** 'quita filtros', 'show all'",
      "**View summary:** 'resumen de gastos', 'cuantos gastos hay'",
      "**View active filters:** 'que filtros hay', 'filtros activos'",
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
      /quÃ© puedes hacer/i,
      /que puedes hacer/i,
      /quÃ© sabes hacer/i,
      /que sabes hacer/i,
      /en quÃ© me puedes ayudar/i,
      /cÃ³mo me puedes ayudar/i,
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
        response += `â€¢ ${item}\n`;
      });
      response += "\n";
    });

    response += "ðŸ’¡ **Tip:** Just ask me in natural language! For example:\n";
    response += "â€¢ \"Take me to expenses\"\n";
    response += "â€¢ \"How do I scan a receipt?\"\n";
    response += "â€¢ \"Show me my tasks\"\n";
    response += "â€¢ \"Help me register an expense\"";

    return response;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // OBVIOS â€” Instant local matches (no GPT needed)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const OBVIOS = [
    // Clear filters
    { rx: /^(?:clear|quita|limpia|borra|elimina)\s*(?:los?\s*)?(?:filtros?|filters?)$/i,
      make: () => ({ type: "copilot", action: "clear_filters" }) },
    { rx: /^(?:show\s*all|mostrar?\s*todo|ver\s*todo)$/i,
      make: () => ({ type: "copilot", action: "clear_filters" }) },
    // Summary
    { rx: /^(?:resumen|summary|total)$/i,
      make: () => ({ type: "copilot", action: "summary" }) },
    // Active filters
    { rx: /^(?:filtros?\s*activos?|active\s*filters?)$/i,
      make: () => ({ type: "copilot", action: "show_filters" }) },
    // Bill number (3+ digits alone)
    { rx: /^#?(\d{3,})$/,
      make: (m) => ({ type: "copilot", action: "filter", params: { field: "bill_id", value: m[1] } }) },
    // Auth status standalone
    { rx: /^(pendientes?|pending)$/i,
      make: () => ({ type: "copilot", action: "filter", params: { field: "auth", value: "Pending" } }) },
    { rx: /^(autorizad[oa]s?|authorized)$/i,
      make: () => ({ type: "copilot", action: "filter", params: { field: "auth", value: "Authorized" } }) },
    { rx: /^(?:en\s*)?(?:revision|review)$/i,
      make: () => ({ type: "copilot", action: "filter", params: { field: "auth", value: "Review" } }) },
    // Health check
    { rx: /^health\s*check$/i,
      make: () => ({ type: "copilot", action: "health_check" }) },
    // Expand / Collapse
    { rx: /^(?:expand(?:ir)?|abrir)\s*(?:all|todo|todos)?$/i,
      make: () => ({ type: "copilot", action: "expand_all" }) },
    { rx: /^(?:collapse|colapsar|cerrar|contraer)\s*(?:all|todo|todos)?$/i,
      make: () => ({ type: "copilot", action: "collapse_all" }) },
    // BVA shortcut
    { rx: /^bva\s+(.+)$/i,
      make: (m) => ({ type: "report", action: "bva", params: { project: m[1].trim() } }) },
    { rx: /^bva$/i,
      make: () => ({ type: "report", action: "bva" }) },
    // Sarcasmo / Personalidad
    { rx: /^(?:sarcasmo|personalidad|personality)\s*(\d)$/i,
      make: (m) => ({ type: "chat" }) },
  ];

  /**
   * Try to match the text against the OBVIOS list.
   * Returns intent object or null.
   */
  function matchObvios(text) {
    const trimmed = text.trim();
    for (const { rx, make } of OBVIOS) {
      const m = trimmed.match(rx);
      if (m) {
        console.log("[Arturito Widget] OBVIO match:", rx.source);
        return make(m);
      }
    }
    return null;
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // INTENT INTERPRETER â€” GPT-first classification
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Send text to /arturito/interpret-intent for GPT classification.
   * Returns structured intent { type, action, params } or { type: "chat" } on error.
   */
  async function interpretIntent(text) {
    try {
      const response = await fetch(`${API_BASE}/arturito/interpret-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          text: text,
          current_page: state.currentPage,
        }),
      });

      if (!response.ok) {
        console.warn("[Arturito Widget] interpret-intent error:", response.status);
        return { type: "chat" };
      }

      const intent = await response.json();
      console.log("[Arturito Widget] Intent:", intent);
      return intent;
    } catch (err) {
      console.error("[Arturito Widget] interpret-intent failed:", err);
      return { type: "chat" };
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ACTION ROUTER â€” Execute parsed intents locally
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const PAGE_MAP = {
    expenses: "expenses.html",
    pipeline: "pipeline.html",
    projects: "projects.html",
    team: "team.html",
    vendors: "vendors.html",
    budgets: "budgets.html",
    dashboard: "dashboard.html",
    messages: "messages.html",
    accounts: "accounts.html",
    estimator: "estimator.html",
    reporting: "reporting.html",
    budget_monitor: "budget_monitor.html",
    company_expenses: "company-expenses.html",
    arturito: "arturito.html",
    settings: "settings.html",
  };

  const MODAL_PAGE_MAP = {
    add_expense: "expenses.html",
    scan_receipt: "expenses.html",
    new_task: "pipeline.html",
    add_project: "projects.html",
    add_user: "team.html",
  };

  /**
   * Route a parsed intent to the correct local handler.
   * @returns {{ handled: boolean, message: string|null, needsChat: boolean, overrideText: string|null }}
   */
  async function routeAction(intent) {
    const { type, action, params } = intent;
    const page = state.currentPage;

    // -- COPILOT --
    if (type === "copilot") {
      return await routeCopilotAction(action, params || {}, page);
    }

    // -- NAVIGATE --
    if (type === "navigate" && action === "goto" && params && params.page) {
      const target = PAGE_MAP[params.page];
      if (target) {
        setTimeout(() => { window.location.href = target; }, 800);
        return { handled: true, message: `Navegando a ${params.page}...` };
      }
      return { handled: false, message: null, needsChat: true };
    }

    // -- MODAL --
    if (type === "modal" && action === "open" && params && params.id) {
      const modalId = params.id;
      const requiredPage = MODAL_PAGE_MAP[modalId];

      if (requiredPage && page !== requiredPage) {
        sessionStorage.setItem("arturito_pending_action", JSON.stringify({
          action: "open_modal",
          data: { modal_id: modalId },
        }));
        setTimeout(() => { window.location.href = requiredPage; }, 800);
        return { handled: true, message: `Navegando a ${requiredPage} para abrir ${modalId}...` };
      }

      openModalByAction(modalId);
      return { handled: true, message: `Abriendo ${modalId}...` };
    }

    // -- REPORT --
    if (type === "report") {
      if (action === "bva") {
        const bvaText = params && params.project ? `bva ${params.project}` : "bva";
        return { handled: false, message: null, needsChat: true, overrideText: bvaText };
      }
      if (action === "query") {
        const cat = (params && params.category) || "";
        const proj = (params && params.project) || "";
        const queryText = proj
          ? `cuanto tengo disponible para ${cat} en ${proj}`
          : `cuanto tengo disponible para ${cat}`;
        return { handled: false, message: null, needsChat: true, overrideText: queryText };
      }
      if (action === "bug") {
        const bugText = params && params.description
          ? `reportar bug: ${params.description}`
          : "reportar bug";
        return { handled: false, message: null, needsChat: true, overrideText: bugText };
      }
    }

    // -- CHAT (fallback) --
    return { handled: false, message: null, needsChat: true };
  }

  /**
   * Route copilot actions to page-specific handlers.
   */
  async function routeCopilotAction(action, params, page) {

    // â”€â”€ EXPENSES PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (page === "expenses.html" && window.ExpensesArturito) {
      const EA = window.ExpensesArturito;

      switch (action) {
        case "filter": {
          const { field, value } = params;

          // Special: account filter needs fuzzy matching via backend
          if (field === "account") {
            return await handleAccountFilter(value);
          }

          EA.filterBy(field, value);
          const s = EA.getSummary();
          return {
            handled: true,
            message: `Filtro aplicado: ${field} = "${value}"\n\nMostrando ${s.filteredExpenses} gasto(s).\n\nPara quitar: "quita filtros"`,
          };
        }

        case "search": {
          EA.search(params.query);
          const s = EA.getSummary();
          return {
            handled: true,
            message: `Busqueda: "${params.query}"\n\nEncontrados ${s.filteredExpenses} gasto(s).\n\nPara quitar: "quita filtros"`,
          };
        }

        case "clear_filters":
          EA.clearAllFilters();
          return { handled: true, message: "Filtros eliminados. Se muestran todos los gastos." };

        case "summary": {
          const s = EA.getSummary();
          const activeFilters = Object.keys(s.activeFilters);
          const filterText = activeFilters.length > 0
            ? `\n\nFiltros activos: ${activeFilters.join(", ")}`
            : "";
          const amt = typeof s.filteredAmount === "number"
            ? `$${s.filteredAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
            : s.totalAmount;
          return {
            handled: true,
            message: `**Resumen de Gastos**\n\nGastos visibles: ${s.filteredExpenses}\nTotal en proyecto: ${s.totalExpenses}\nMonto visible: ${amt}${filterText}`,
          };
        }

        case "show_filters": {
          const s = EA.getSummary();
          const filters = s.activeFilters;
          const keys = Object.keys(filters);
          if (keys.length === 0) {
            return { handled: true, message: "**No hay filtros activos.** Se muestran todos los gastos del proyecto." };
          }
          const list = keys.map(k => {
            const v = Array.isArray(filters[k]) ? filters[k].join(", ") : filters[k];
            return `- **${k}:** ${v}`;
          }).join("\n");
          return { handled: true, message: `**Filtros activos:**\n\n${list}\n\nPara quitar: "quita filtros"` };
        }

        case "expand_all": {
          const handlers = copilotHandlers["expenses.html"];
          if (handlers && handlers.expandAllBills) {
            handlers.expandAllBills();
            return { handled: true, message: "Todas las facturas expandidas." };
          }
          return { handled: false, needsChat: true };
        }

        case "collapse_all": {
          const handlers = copilotHandlers["expenses.html"];
          if (handlers && handlers.collapseAllBills) {
            handlers.collapseAllBills();
            return { handled: true, message: "Todas las facturas colapsadas." };
          }
          return { handled: false, needsChat: true };
        }

        case "health_check": {
          const handlers = copilotHandlers["expenses.html"];
          if (handlers && handlers.healthCheckDuplicateBills) {
            const result = handlers.healthCheckDuplicateBills();
            const msg = formatCopilotResult("healthCheckDuplicateBills", result);
            return { handled: true, message: msg || "Health check completado. No se encontraron conflictos." };
          }
          return { handled: false, needsChat: true };
        }

        case "sort": {
          const handlers = copilotHandlers["expenses.html"];
          if (handlers && handlers.sortByColumn) {
            handlers.sortByColumn(params);
            return { handled: true, message: `Ordenado por ${params.column} ${params.direction}.` };
          }
          return { handled: false, needsChat: true };
        }
      }
    }

    // â”€â”€ PIPELINE PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (page === "pipeline.html") {
      const handlers = copilotHandlers["pipeline.html"];
      if (!handlers) return { handled: false, needsChat: true };

      switch (action) {
        case "filter": {
          const { field, value } = params;
          const fnMap = {
            status: "filterByStatus",
            assignee: "filterByAssignee",
            priority: "filterByPriority",
            project: "filterByProject",
          };
          const fnName = fnMap[field];
          if (fnName && handlers[fnName]) {
            // Map param names to what the handler expects
            const handlerParams = {};
            if (field === "assignee") {
              handlerParams.user_name = value === "__CURRENT_USER__" && state.currentUser
                ? state.currentUser.user_name
                : value;
            } else if (field === "project") {
              handlerParams.project_name = value;
            } else {
              handlerParams[field] = value;
            }
            handlers[fnName](handlerParams);
            return { handled: true, message: `Pipeline filtrado por ${field}: "${value}".` };
          }
          break;
        }
        case "search":
          if (handlers.searchText) {
            handlers.searchText({ query: params.query });
            return { handled: true, message: `Buscando: "${params.query}".` };
          }
          break;
        case "clear_filters":
          if (handlers.clearFilters) {
            handlers.clearFilters();
            return { handled: true, message: "Filtros de pipeline eliminados." };
          }
          break;
      }
      return { handled: false, needsChat: true };
    }

    // â”€â”€ GENERIC PAGES (projects, team, vendors, etc.) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handlers = copilotHandlers[page];
    if (handlers) {
      if (action === "filter" && params && params.field) {
        const fnName = "filterBy" + params.field.charAt(0).toUpperCase() + params.field.slice(1);
        if (handlers[fnName]) {
          handlers[fnName](params);
          return { handled: true, message: `Filtrado por ${params.field}: "${params.value}".` };
        }
      }
      if (action === "search") {
        const searchFn = handlers.searchText || handlers.searchProject || handlers.searchUser || handlers.searchVendor;
        if (searchFn) {
          searchFn({ query: params.query });
          return { handled: true, message: `Buscando: "${params.query}".` };
        }
      }
      if (action === "clear_filters" && handlers.clearFilters) {
        handlers.clearFilters();
        return { handled: true, message: "Filtros eliminados." };
      }
    }

    return { handled: false, message: null, needsChat: true };
  }

  /**
   * Handle account filter with fuzzy/semantic search via backend.
   */
  async function handleAccountFilter(value) {
    try {
      const resp = await fetch(
        `${API_BASE}/arturito/search-accounts?query=${encodeURIComponent(value)}&limit=5`,
        { headers: { ...getAuthHeaders() }, credentials: "include" }
      );
      const data = await resp.json();

      if (data.matches && data.matches.length > 0) {
        const best = data.matches[0];

        if (best.score >= 85) {
          window.ExpensesArturito.filterBy("account", best.account_id);
          const s = window.ExpensesArturito.getSummary();
          let msg = `Filtro aplicado: ${best.name}\n\nMostrando ${s.filteredExpenses} gasto(s) de esta cuenta.`;
          if (best.semantic && best.reasoning) {
            msg += `\n\n${best.reasoning}`;
          }
          if (data.matches.length > 1) {
            const alts = data.matches.slice(1, 3).map(m => m.name).join(", ");
            msg += `\n\nOtras opciones: ${alts}`;
          }
          return { handled: true, message: msg };
        } else {
          let msg = `Encontre estas cuentas para "${value}":\n\n`;
          data.matches.slice(0, 3).forEach((match, idx) => {
            msg += `${idx + 1}. **${match.name}**\n`;
          });
          msg += `\nEscribe el nombre completo para aplicar el filtro.`;
          return { handled: true, message: msg };
        }
      }
      return { handled: true, message: `No encontre cuentas para "${value}".` };
    } catch (err) {
      console.error("[Arturito Widget] Account search error:", err);
      return { handled: true, message: "Error buscando la cuenta. Intenta de nuevo." };
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // DOM REFERENCES
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  let DOM = {};

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // INITIALIZATION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // INJECT HTML
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            <div class="arturito-widget-msg-avatar arturito-widget-msg-avatar--bot">A</div>
            <div class="arturito-widget-typing-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="arturito-widget-input-area">
          <div class="arturito-widget-input-row">
            <div
              id="arturito-widget-input"
              class="arturito-widget-input"
              contenteditable="true"
              role="textbox"
              data-placeholder="Ask Arturito..."
              inputmode="text"
              enterkeyhint="send"
            ></div>
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // DATA LOADING
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // EVENT LISTENERS
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // MOBILE KEYBOARD DETECTION
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const value = DOM.input.textContent.trim();
    DOM.sendBtn.disabled = !value;
  }

  function handleInputKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!DOM.sendBtn.disabled) {
        sendMessage();
      }
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // SEND MESSAGE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Old handleExpensesFilterCommand and interpretFilterCommandWithGPT removed.
  // Replaced by OBVIOS + interpretIntent() + routeAction() above.


  async function sendMessage() {
    const content = DOM.input.textContent.trim();
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
    DOM.input.textContent = "";
    DOM.sendBtn.disabled = true;

    // â”€â”€ STEP 1: Capabilities query â€” handle locally â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isCapabilitiesQuery(content)) {
      addBotMessage(generateCapabilitiesResponse());
      return;
    }

    // â”€â”€ STEP 2: OBVIOS list â€” instant local match (no network) â”€â”€â”€
    const obviosResult = matchObvios(content);
    if (obviosResult) {
      const result = await routeAction(obviosResult);
      if (result.handled) {
        addBotMessage(result.message);
        return;
      }
      // If obvios matched but wasn't handled (e.g. no handler registered),
      // fall through to GPT interpretation
    }

    // â”€â”€ STEP 3: GPT intent classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    state.isLoading = true;
    DOM.typing.style.display = "flex";
    scrollToBottom();

    try {
      const intent = await interpretIntent(content);

      // â”€â”€ STEP 4: Route the interpreted intent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const result = await routeAction(intent);

      if (result.handled) {
        state.isLoading = false;
        DOM.typing.style.display = "none";
        addBotMessage(result.message);
        return;
      }

      // â”€â”€ STEP 5: Forward to /web-chat for conversation â”€â”€â”€â”€â”€â”€â”€â”€
      let chatText = result.overrideText || content;

      // If a BVA project was selected by button (with ID), send the ID
      // for direct resolution instead of relying on name-based fuzzy matching
      if (state._bvaProjectId) {
        chatText = "bva " + state._bvaProjectId;
        state._bvaProjectId = null;
      }

      const response = await fetch(`${API_BASE}/arturito/web-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          text: chatText,
          user_name: state.currentUser?.user_name,
          user_email: state.currentUser?.email,
          user_role: state.currentUser?.user_role,
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

      // Handle action responses from web-chat
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RENDER MESSAGES
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Build avatar - ring style matching Team page
    let avatarHtml;
    if (isUser) {
      const userPhoto = state.currentUser?.user_photo;
      const avatarColor = getAvatarColor(state.currentUser);
      const initials = getInitials(state.currentUser?.user_name || "?");

      if (userPhoto) {
        avatarHtml = `<div class="arturito-widget-msg-avatar arturito-widget-msg-avatar--img" style="border-color: ${avatarColor}; background-image: url('${escapeHtml(userPhoto)}')"></div>`;
      } else {
        avatarHtml = `<div class="arturito-widget-msg-avatar" style="color: ${avatarColor}; border-color: ${avatarColor}">${initials}</div>`;
      }
    } else {
      avatarHtml = `<div class="arturito-widget-msg-avatar arturito-widget-msg-avatar--bot">A</div>`;
    }

    // Build action buttons if applicable
    let actionButtonsHtml = "";
    if (!isUser && msg.action) {
      actionButtonsHtml = renderActionButtons(msg);
    }

    // For category_query_response with card data, skip the text bubble to avoid duplication
    const skipTextBubble = msg.action === "category_query_response"
      && msg.actionData && msg.actionData.accounts && msg.actionData.accounts.length > 0
      && actionButtonsHtml;

    return `
      <div class="arturito-widget-msg ${roleClass} ${errorClass}">
        ${avatarHtml}
        <div class="arturito-widget-msg-content">
          ${skipTextBubble ? "" : `<div class="arturito-widget-msg-bubble">${formattedContent}</div>`}
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

      case "category_query_response":
        // Render group card with per-account BVA data
        if (actionData.accounts && actionData.accounts.length > 0) {
          var groupName = actionData.group_name || "";
          var projectName = actionData.project_name || "";
          var totals = actionData.group_totals || {};
          var accts = actionData.accounts;
          // Header with group/account name and project
          var headerLabel = groupName || (accts.length === 1 ? accts[0].matched_name : "");
          var headerHtml = headerLabel
            ? '<div class="arturito-bva-header">'
              + '<strong>' + escapeHtml(headerLabel) + '</strong>'
              + (projectName ? ' in <strong>' + escapeHtml(projectName) + '</strong>' : '')
              + '</div>'
            : "";
          var rows = accts.map(function(acc) {
            var bal = acc.balance || 0;
            var balClass = bal < 0 ? "arturito-bva-negative" : "";
            var matchMark = acc.is_matched ? " arturito-bva-matched" : "";
            return '<div class="arturito-bva-row' + matchMark + '">'
              + '<div class="arturito-bva-account">' + escapeHtml(acc.matched_name) + '</div>'
              + '<div class="arturito-bva-nums">'
              + '<span>Budget: $' + (acc.budget || 0).toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '<span>Actual: $' + (acc.actual || 0).toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '<span class="' + balClass + '">Avail: $' + bal.toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '</div></div>';
          }).join("");
          var totalBal = totals.balance || 0;
          var totalClass = totalBal < 0 ? "arturito-bva-negative" : "";
          var totalRow = accts.length > 1
            ? '<div class="arturito-bva-total">'
              + '<div class="arturito-bva-account">TOTAL' + (groupName ? " " + escapeHtml(groupName) : "") + '</div>'
              + '<div class="arturito-bva-nums">'
              + '<span>$' + (totals.budget || 0).toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '<span>$' + (totals.actual || 0).toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '<span class="' + totalClass + '">$' + totalBal.toLocaleString("en-US", {minimumFractionDigits: 2}) + '</span>'
              + '</div></div>'
            : "";
          return '<div class="arturito-bva-card">' + headerHtml + rows + totalRow + '</div>';
        }
        break;

      case "ask_project":
        // Show clickable project buttons when user asks for BVA without specifying project
        if (actionData.projects && actionData.projects.length > 0) {
          const projectButtons = actionData.projects.slice(0, 6).map(p =>
            `<button type="button"
                    class="arturito-widget-action-btn-inline arturito-widget-project-btn"
                    onclick="ArturitoWidget.selectProjectForBVA('${escapeHtml(p.name)}', '${escapeHtml(String(p.id || ''))}')">
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // CLEAR CHAT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      Toast.success("ConversaciÃ³n limpiada", "");
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // ACTION HANDLING
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        return "âœ… **Health Check completado**: No encontrÃ© ningÃºn conflicto. Todos los bills tienen vendors consistentes.";
      }

      let msg = `âš ï¸ **EncontrÃ© ${result.total_issues} bill(s) con conflictos**:\n\n`;

      result.issues.slice(0, 5).forEach((issue, i) => {
        msg += `${i + 1}. **Bill #${issue.bill_id}** tiene ${issue.vendors.length} vendors diferentes:\n`;
        msg += `   - ${issue.vendors.join(", ")}\n`;
      });

      if (result.has_more || result.total_issues > 5) {
        msg += `\n...y ${result.total_issues - 5} mÃ¡s.\n`;
      }

      msg += "\nLas filas con conflictos estÃ¡n resaltadas en **naranja** en la tabla.";

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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // UTILITIES
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function scrollToBottom() {
    if (DOM.messages) {
      DOM.messages.scrollTop = DOM.messages.scrollHeight;
    }
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "&#39;");
  }

  function formatMessageContent(content) {
    if (!content) return "";

    let formatted = escapeHtml(content);

    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    formatted = formatted.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

    // Markdown links [text](url) - convert to clickable links (only http/https)
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      function(_match, linkText, url) {
        if (!/^https?:\/\//i.test(url)) return linkText;
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="arturito-widget-link">' + linkText + '</a>';
      }
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // PUBLIC API
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        Toast.warning("Descarga alternativa", "El PDF se abriÃ³ en una nueva pestaÃ±a");
      }
    }
  }

  /**
   * Select a project and request its BVA report
   * Called when user clicks on a project button after asking for BVA without project
   * @param {string} projectName - Name of the project to generate BVA for
   */
  function selectProjectForBVA(projectName, projectId) {
    // Set input and let sendMessage handle the full flow
    DOM.input.textContent = `bva ${projectName}`;
    // When we have the project ID, send it to the API for direct resolution
    if (projectId) {
      state._bvaProjectId = projectId;
    }
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // AUTO INIT
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
