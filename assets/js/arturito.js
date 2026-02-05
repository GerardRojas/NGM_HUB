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
  const PAGE_LOAD_START = Date.now();
  const MIN_LOADING_TIME = 800;

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE KNOWLEDGE BASE
  // ─────────────────────────────────────────────────────────────────────────
  // Help content for each NGM Hub module. Respond in the same language the user asks.

  const MODULE_KNOWLEDGE = {
    expenses: {
      name: "Expenses Engine",
      description: "Module for managing company expenses, receipts, and reimbursements",
      help: `
## EXPENSES ENGINE - User Guide

### How to Register an Expense / Cómo registrar un gasto:
1. Go to the Expenses page (sidebar → "Expenses Engine") / Ir a la página de Expenses (sidebar → "Expenses Engine")
2. Click the "+ Add Expense" button in the top right / Clic en el botón "+ Add Expense" arriba a la derecha
3. A modal will open where you can enter expense details / Se abrirá un modal donde puedes ingresar los detalles del gasto
4. Fill in the required fields: Date, Amount, Vendor, Category, Project / Llena los campos requeridos: Fecha, Monto, Vendor, Categoría, Proyecto
5. Click "Save" to register the expense / Clic en "Save" para registrar el gasto

### How to Scan a Receipt / Cómo escanear un recibo:
1. In the Add Expense modal, click the "Scan Receipt" or camera icon button / En el modal de Add Expense, clic en el botón "Scan Receipt" o el ícono de cámara
2. You can either take a photo or upload an existing image / Puedes tomar una foto o subir una imagen existente
3. The system uses AI (OCR) to automatically extract: vendor name, date, amount, and line items / El sistema usa IA (OCR) para extraer automáticamente: nombre del vendor, fecha, monto, y líneas de detalle
4. Review and confirm the extracted data before saving / Revisa y confirma los datos extraídos antes de guardar

### How to Auto-Categorize / Cómo auto-categorizar:
1. When scanning a receipt or adding expenses manually, click "Auto-Categorize" / Al escanear un recibo o agregar gastos manualmente, clic en "Auto-Categorize"
2. The AI analyzes the vendor and expense description to suggest the best category / La IA analiza el vendor y la descripción del gasto para sugerir la mejor categoría
3. It can also suggest the appropriate project based on context / También puede sugerir el proyecto apropiado basándose en el contexto
4. You can accept the suggestions or change them manually / Puedes aceptar las sugerencias o cambiarlas manualmente

### Fill Down Feature (Right-Click) / Función "Fill Down" (Clic derecho):
1. When entering multiple expenses in the modal table, right-click on any cell / Al ingresar múltiples gastos en la tabla del modal, clic derecho en cualquier celda
2. Select "Fill Down" to copy that cell's value to all rows below / Selecciona "Fill Down" para copiar el valor de esa celda a todas las filas de abajo
3. This is useful when many expenses share the same category, project, or vendor / Es útil cuando muchos gastos comparten la misma categoría, proyecto, o vendor

### Expense Statuses / Estados de gastos:
- **Draft**: Expense saved but not submitted / Gasto guardado pero no enviado
- **Pending**: Submitted and waiting for approval / Enviado y esperando aprobación
- **Approved**: Approved by manager / Aprobado por el manager
- **Rejected**: Rejected, needs revision / Rechazado, necesita revisión
- **Paid**: Reimbursement processed / Reembolso procesado

### Filters and Search / Filtros y búsqueda:
- Use the status pills at the top to filter by expense status / Usa las pills de estado arriba para filtrar por estado del gasto
- Use the search bar to find expenses by vendor, description, or amount / Usa la barra de búsqueda para encontrar gastos por vendor, descripción, o monto
- Filter by date range, project, or category using the filter options / Filtra por rango de fechas, proyecto, o categoría usando las opciones de filtro

### Syncing with QuickBooks Online (QBO) / Sincronización con QuickBooks Online:
- Approved expenses can be synced to QuickBooks / Los gastos aprobados pueden sincronizarse con QuickBooks
- Click the sync icon or "Sync to QBO" button / Clic en el ícono de sync o botón "Sync to QBO"
- The expense will be created as a bill or expense in QuickBooks / El gasto se creará como bill o expense en QuickBooks

### Tips / Consejos:
- Always attach a receipt image for expense compliance / Siempre adjunta una imagen del recibo para cumplimiento
- Use descriptive notes to help approvers understand the expense / Usa notas descriptivas para ayudar a los aprobadores a entender el gasto
- Check the "Billable" checkbox if the expense should be billed to a client / Marca "Billable" si el gasto debe facturarse a un cliente
`
    },

    dashboard: {
      name: "Dashboard",
      description: "Main overview page with mentions and tasks",
      help: `
## DASHBOARD - User Guide

### Overview / Descripción general:
- The Dashboard is your home page after login / El Dashboard es tu página de inicio después de hacer login
- Shows a summary of your pending work and notifications / Muestra un resumen de tu trabajo pendiente y notificaciones

### My Work Section / Sección Mi Trabajo:
- Displays tasks assigned to you / Muestra las tareas asignadas a ti
- **Not Started**: Tasks you haven't begun yet / Tareas que aún no has comenzado
- **Working**: Tasks currently in progress / Tareas actualmente en progreso
- **In Review**: Tasks pending approval / Tareas pendientes de aprobación
- Click "Start" to begin working on a task / Clic en "Start" para comenzar a trabajar en una tarea
- Click "Send to Review" when done working / Clic en "Send to Review" cuando termines de trabajar

### Mentions Section / Sección de Menciones:
- Shows messages where you were @mentioned / Muestra mensajes donde te mencionaron con @
- Click on a mention to go directly to that conversation / Clic en una mención para ir directamente a esa conversación
- Unread mentions are highlighted / Las menciones no leídas están resaltadas

### Quick Navigation / Navegación rápida:
- Use the sidebar to navigate to other modules / Usa el sidebar para navegar a otros módulos
- The topbar shows your current user and environment / La topbar muestra tu usuario actual y ambiente
`
    },

    pipeline: {
      name: "Pipeline Manager",
      description: "Task and workflow management system",
      help: `
## PIPELINE MANAGER - User Guide

### What is Pipeline? / ¿Qué es Pipeline?:
- Pipeline is NGM Hub's task management system / Pipeline es el sistema de gestión de tareas de NGM Hub
- Organize work into projects, tasks, and subtasks / Organiza el trabajo en proyectos, tareas y subtareas
- Track progress through customizable stages / Sigue el progreso a través de etapas personalizables

### Viewing Tasks / Ver tareas:
- Go to Pipeline Manager from the sidebar / Ve a Pipeline Manager desde el sidebar
- Use status filters to see tasks by stage / Usa los filtros de estado para ver tareas por etapa
- Search bar to find specific tasks / Barra de búsqueda para encontrar tareas específicas
- Click on any task to see details / Clic en cualquier tarea para ver detalles

### Creating a Task / Crear una tarea:
1. Click "+ Add Task" button / Clic en el botón "+ Add Task"
2. Fill in task title and description / Completa el título y descripción de la tarea
3. Assign to a project (optional) / Asigna a un proyecto (opcional)
4. Set assignee, due date, and priority / Establece asignado, fecha límite y prioridad
5. Click "Save" to create the task / Clic en "Save" para crear la tarea

### Task Workflow / Flujo de trabajo de tareas:
- **Not Started**: Task created but not begun / Tarea creada pero no iniciada
- **Working**: Task in progress (timer running) / Tarea en progreso (cronómetro corriendo)
- **In Review**: Submitted for approval / Enviada para aprobación
- **Approved**: Completed and approved / Completada y aprobada
- **Needs Changes**: Reviewer requested modifications / El revisor solicitó modificaciones

### Starting Work / Iniciar trabajo:
1. Find your assigned task / Encuentra tu tarea asignada
2. Click "Start" to begin tracking time / Clic en "Start" para comenzar a trackear tiempo
3. The task moves to "Working" status / La tarea pasa a estado "Working"
4. When done, click "Send to Review" / Cuando termines, clic en "Send to Review"

### Reviewing Tasks / Revisar tareas:
- Reviewers see tasks in "In Review" status / Los revisores ven tareas en estado "In Review"
- Click "Approve" to accept the work / Clic en "Approve" para aceptar el trabajo
- Click "Request Changes" if modifications needed / Clic en "Request Changes" si necesita modificaciones
- Add notes to explain your decision / Agrega notas para explicar tu decisión

### Assigning Tasks / Asignar tareas:
- Open task details / Abre los detalles de la tarea
- Click on the assignee field / Clic en el campo de asignado
- Select team member from the dropdown / Selecciona miembro del equipo del dropdown
- The assignee will be notified / El asignado será notificado
`
    },

    projects: {
      name: "Projects",
      description: "Project management and organization",
      help: `
## PROJECTS - User Guide

### What are Projects? / ¿Qué son los Proyectos?:
- Projects group related work together / Los proyectos agrupan trabajo relacionado
- Each project can have multiple tasks, expenses, and communications / Cada proyecto puede tener múltiples tareas, gastos y comunicaciones
- Projects have budgets, timelines, and team assignments / Los proyectos tienen presupuestos, timelines y asignaciones de equipo

### Viewing Projects / Ver proyectos:
- Go to Projects from the sidebar / Ve a Projects desde el sidebar
- See all active projects in a list or card view / Ve todos los proyectos activos en lista o tarjetas
- Use filters to find projects by status, client, or team / Usa filtros para encontrar proyectos por estado, cliente o equipo

### Project Details / Detalles del proyecto:
- Click on any project to see its details / Clic en cualquier proyecto para ver sus detalles
- **Overview**: General info, status, budget / Información general, estado, presupuesto
- **Tasks**: All pipeline tasks for this project / Todas las tareas de pipeline para este proyecto
- **Expenses**: Expenses charged to this project / Gastos cargados a este proyecto
- **Team**: People assigned to work on this project / Personas asignadas a trabajar en este proyecto

### Creating a Project / Crear un proyecto:
1. Click "+ New Project" button / Clic en el botón "+ New Project"
2. Enter project name and code / Ingresa nombre y código del proyecto
3. Select client (if applicable) / Selecciona cliente (si aplica)
4. Set start date and budget / Establece fecha de inicio y presupuesto
5. Assign team members / Asigna miembros del equipo
6. Click "Create" to save / Clic en "Create" para guardar

### Project Statuses / Estados de proyectos:
- **Active**: Currently in progress / Actualmente en progreso
- **On Hold**: Temporarily paused / Temporalmente pausado
- **Completed**: Finished successfully / Terminado exitosamente
- **Cancelled**: Discontinued / Descontinuado
`
    },

    vendors: {
      name: "Vendors",
      description: "Vendor and supplier management",
      help: `
## VENDORS - User Guide

### What are Vendors? / ¿Qué son los Vendors?:
- Vendors are suppliers, contractors, or companies you do business with / Los vendors son proveedores, contratistas o empresas con las que haces negocios
- Track vendor information, contacts, and payment details / Rastrea información de vendors, contactos y detalles de pago
- Link vendors to expenses for better tracking / Vincula vendors a gastos para mejor seguimiento

### Viewing Vendors / Ver vendors:
- Go to Vendors from the sidebar / Ve a Vendors desde el sidebar
- See all vendors in a searchable list / Ve todos los vendors en una lista con búsqueda
- Click on any vendor to see details / Clic en cualquier vendor para ver detalles

### Adding a Vendor / Agregar un vendor:
1. Click "+ Add Vendor" button / Clic en el botón "+ Add Vendor"
2. Enter vendor name and type / Ingresa nombre y tipo del vendor
3. Add contact information (email, phone, address) / Agrega información de contacto (email, teléfono, dirección)
4. Set payment terms and tax ID if applicable / Establece términos de pago y tax ID si aplica
5. Click "Save" to create the vendor / Clic en "Save" para crear el vendor

### Vendor Categories / Categorías de vendors:
- **Supplier**: Product providers / Proveedores de productos
- **Contractor**: Service providers / Proveedores de servicios
- **Utility**: Utilities (electric, water, internet) / Servicios (luz, agua, internet)
- **Government**: Government entities / Entidades gubernamentales
- **Other**: Miscellaneous vendors / Vendors varios

### Syncing with QuickBooks / Sincronización con QuickBooks:
- Vendors can be synced to QuickBooks Online / Los vendors pueden sincronizarse con QuickBooks Online
- Click the sync icon to push vendor to QBO / Clic en el ícono de sync para enviar vendor a QBO
- Synced vendors will have a QBO badge / Los vendors sincronizados tendrán una insignia de QBO
`
    },

    accounts: {
      name: "Accounts",
      description: "Chart of accounts and financial categories",
      help: `
## ACCOUNTS - User Guide

### What are Accounts? / ¿Qué son las Cuentas?:
- Accounts are the categories used for financial tracking / Las cuentas son las categorías usadas para seguimiento financiero
- Based on your Chart of Accounts from QuickBooks / Basadas en tu Catálogo de Cuentas de QuickBooks
- Used to categorize expenses, income, and transactions / Usadas para categorizar gastos, ingresos y transacciones

### Viewing Accounts / Ver cuentas:
- Go to Accounts from the sidebar / Ve a Accounts desde el sidebar
- Accounts are organized by type (Expense, Income, Asset, etc.) / Las cuentas están organizadas por tipo (Gasto, Ingreso, Activo, etc.)
- Search to find specific accounts / Busca para encontrar cuentas específicas

### Account Types / Tipos de cuentas:
- **Expense**: Operating costs and purchases / Costos operativos y compras
- **Income**: Revenue and sales / Ingresos y ventas
- **Asset**: Things you own / Cosas que posees
- **Liability**: Things you owe / Cosas que debes
- **Equity**: Owner's investment and retained earnings / Inversión del dueño y ganancias retenidas

### Using Accounts / Usar cuentas:
- When adding an expense, select the appropriate account / Al agregar un gasto, selecciona la cuenta apropiada
- The account determines how the expense is categorized in reports / La cuenta determina cómo se categoriza el gasto en reportes
- Auto-categorize feature suggests accounts based on vendor / La función auto-categorizar sugiere cuentas basadas en el vendor
`
    },

    estimator: {
      name: "Estimator Suite",
      description: "Project estimation and quoting tools",
      help: `
## ESTIMATOR SUITE - User Guide

### What is Estimator? / ¿Qué es Estimator?:
- Create professional estimates and quotes for clients / Crea estimaciones y cotizaciones profesionales para clientes
- Calculate project costs, labor, and materials / Calcula costos de proyecto, mano de obra y materiales
- Generate PDF proposals to send to clients / Genera propuestas PDF para enviar a clientes

### Creating an Estimate / Crear una estimación:
1. Click "+ New Estimate" button / Clic en el botón "+ New Estimate"
2. Select the client or create new one / Selecciona el cliente o crea uno nuevo
3. Add line items (services, products, labor) / Agrega líneas (servicios, productos, mano de obra)
4. Set quantities, rates, and descriptions / Establece cantidades, tarifas y descripciones
5. Apply discounts or taxes if needed / Aplica descuentos o impuestos si es necesario
6. Click "Save" or "Generate PDF" / Clic en "Save" o "Generate PDF"

### Estimate Templates / Plantillas de estimación:
- Use templates for common project types / Usa plantillas para tipos de proyecto comunes
- Templates pre-fill items and pricing / Las plantillas pre-llenan artículos y precios
- Customize templates to fit your business / Personaliza plantillas para tu negocio

### Converting to Project / Convertir a proyecto:
- Approved estimates can become projects / Las estimaciones aprobadas pueden convertirse en proyectos
- Click "Convert to Project" to create a linked project / Clic en "Convert to Project" para crear un proyecto vinculado
- Budget and details transfer automatically / El presupuesto y detalles se transfieren automáticamente
`
    },

    team: {
      name: "Team Management",
      description: "User and team administration",
      help: `
## TEAM MANAGEMENT - User Guide

### What is Team Management? / ¿Qué es Team Management?:
- Manage users, roles, and permissions / Administra usuarios, roles y permisos
- See all team members and their status / Ve todos los miembros del equipo y su estado
- Admin-only module for user administration / Módulo solo para admins para administración de usuarios

### Viewing Team Members / Ver miembros del equipo:
- Go to Team Management from the sidebar / Ve a Team Management desde el sidebar
- See all users with their roles and status / Ve todos los usuarios con sus roles y estado
- Search by name or email / Busca por nombre o email

### User Roles / Roles de usuario:
- **CEO/COO**: Full administrative access / Acceso administrativo completo
- **Manager**: Can approve tasks and expenses / Puede aprobar tareas y gastos
- **Team Lead**: Can assign tasks and view reports / Puede asignar tareas y ver reportes
- **Employee**: Standard user access / Acceso de usuario estándar

### Adding a User / Agregar un usuario:
1. Click "+ Add User" (Admin only) / Clic en "+ Add User" (Solo admin)
2. Enter name, email, and role / Ingresa nombre, email y rol
3. Set temporary password / Establece contraseña temporal
4. Assign to projects if needed / Asigna a proyectos si es necesario
5. Click "Create User" / Clic en "Create User"

### User Status / Estado de usuario:
- **Active**: Can log in and use the system / Puede iniciar sesión y usar el sistema
- **Inactive**: Account disabled, cannot log in / Cuenta deshabilitada, no puede iniciar sesión
- **Pending**: Awaiting email verification / Esperando verificación de email
`
    },

    messages: {
      name: "Messages / Connect",
      description: "Team communication and chat system",
      help: `
## MESSAGES (CONNECT) - User Guide

### What is Connect? / ¿Qué es Connect?:
- Connect is NGM Hub's internal messaging system / Connect es el sistema de mensajería interna de NGM Hub
- Chat with team members individually or in channels / Chatea con miembros del equipo individualmente o en canales
- Each project automatically gets its own channel / Cada proyecto automáticamente tiene su propio canal

### Channel Types / Tipos de canales:
- **Project Channels**: Auto-created for each project, named after the project / Auto-creados para cada proyecto, nombrados como el proyecto
- **Direct Messages (DMs)**: Private 1-on-1 conversations / Conversaciones privadas 1 a 1
- **Custom Channels**: Created for specific topics or teams / Creados para temas o equipos específicos

### Sending Messages / Enviar mensajes:
1. Select a channel from the sidebar / Selecciona un canal del sidebar
2. Type your message in the input at the bottom / Escribe tu mensaje en el input de abajo
3. Press Enter or click the send button / Presiona Enter o clic en el botón enviar
4. Your message appears in the conversation / Tu mensaje aparece en la conversación

### Mentioning Users / Mencionar usuarios:
- Type @ followed by the person's name to mention them / Escribe @ seguido del nombre de la persona para mencionarla
- Example: @Juan please review this / Ejemplo: @Juan por favor revisa esto
- Mentioned users receive a notification / Los usuarios mencionados reciben una notificación
- Mentions appear in the "Mentions" tab / Las menciones aparecen en la pestaña "Mentions"

### Creating Channels / Crear canales:
1. Click "New chat" button / Clic en el botón "New chat"
2. Choose channel type (Custom or Direct Message) / Elige tipo de canal (Custom o Mensaje Directo)
3. For custom: enter channel name / Para custom: ingresa nombre del canal
4. Add members to the channel / Agrega miembros al canal
5. Click "Create" / Clic en "Create"

### Mobile Navigation (Bottom tabs) / Navegación móvil (tabs de abajo):
- **Home**: See all channels / Ver todos los canales
- **Chats**: Direct messages only / Solo mensajes directos
- **Spaces**: Project and custom channels / Canales de proyecto y custom
- **Mentions**: Messages where you were @mentioned / Mensajes donde te mencionaron con @

### Tips / Consejos:
- Use project channels for project-related discussions / Usa canales de proyecto para discusiones relacionadas al proyecto
- Use DMs for private conversations / Usa DMs para conversaciones privadas
- Check Mentions regularly to not miss important messages / Revisa Mentions regularmente para no perder mensajes importantes
`
    },

    arturito: {
      name: "Arturito",
      description: "AI Assistant for NGM Hub",
      help: `
## ARTURITO - User Guide

### What is Arturito? / ¿Qué es Arturito?:
- Arturito is NGM Hub's AI assistant / Arturito es el asistente de IA de NGM Hub
- Ask questions about how to use any module / Pregunta cómo usar cualquier módulo
- Get help with tasks and navigation / Obtén ayuda con tareas y navegación

### How to Use / Cómo usar:
1. Go to Arturito from the sidebar / Ve a Arturito desde el sidebar
2. Type your question in the input box / Escribe tu pregunta en el cuadro de texto
3. Press Enter or click send / Presiona Enter o clic en enviar
4. Arturito will respond with helpful information / Arturito responderá con información útil

### Example Questions / Preguntas de ejemplo:
- "How do I add an expense?" / "¿Cómo agrego un gasto?"
- "What is auto-categorize?" / "¿Qué es auto-categorizar?"
- "How do I scan a receipt?" / "¿Cómo escaneo un recibo?"
- "How do I create a project?" / "¿Cómo creo un proyecto?"
- "How do I mention someone in Connect?" / "¿Cómo menciono a alguien en Connect?"

### Language / Idioma:
- Arturito responds in the language you ask / Arturito responde en el idioma que preguntas
- Ask in Spanish, get Spanish answers / Pregunta en español, obtén respuestas en español
- Ask in English, get English answers / Pregunta en inglés, obtén respuestas en inglés

### New Conversation / Nueva conversación:
- Click the "+" button in the header to start fresh / Clic en el botón "+" en el header para empezar de nuevo
- Previous conversations are cleared / Las conversaciones anteriores se borran
`
    }
  };

  // Compile all module knowledge into a single context string
  function getModuleKnowledgeContext() {
    let context = "=== NGM HUB MODULE HELP KNOWLEDGE ===\n";
    context += "IMPORTANT: Always respond in the SAME LANGUAGE the user asks their question.\n";
    context += "If they ask in Spanish, respond in Spanish. If they ask in English, respond in English.\n\n";

    for (const [key, module] of Object.entries(MODULE_KNOWLEDGE)) {
      context += `--- ${module.name.toUpperCase()} ---\n`;
      context += module.help + "\n\n";
    }

    return context;
  }

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

  /**
   * Handle expenses filter commands
   * Returns object with message if handled, null if not a filter command
   */
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
        const result = window.ExpensesArturito.clearAllFilters();
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
        const result = window.ExpensesArturito.filterBy('bill_id', billNumber);
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
        const result = window.ExpensesArturito.filterBy('vendor', vendorName);
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
        const result = window.ExpensesArturito.search(searchTerm);
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
      /(?:total|dame el total)/i,
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
          message: `📊 **Resumen de Gastos**\n\n` +
            `• **Total de gastos:** ${summary.totalExpenses}\n` +
            `• **Gastos mostrados:** ${summary.filteredExpenses}\n` +
            `• **Monto total:** $${summary.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}\n` +
            `• **Monto filtrado:** $${summary.filteredAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}` +
            filterText
        };
      }
    }

    // Not a filter command
    return null;
  }

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

    // Remove loading state (with minimum display time)
    const elapsed = Date.now() - PAGE_LOAD_START;
    const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
    setTimeout(() => {
      document.body.classList.remove("page-loading");
      document.body.classList.add("auth-ready");
      const overlay = document.getElementById("pageLoadingOverlay");
      if (overlay) overlay.style.display = "none";
      console.log("[Arturito] Ready!");
    }, remaining);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────

  function normalizeUser(user) {
    return {
      user_id: user.user_id || user.id,
      user_name: user.username || user.user_name || user.name,
      email: user.email,
      user_role: user.user_role || user.role,
      avatar_color: user.avatar_color,
      user_photo: user.user_photo || user.photo || user.avatar,
    };
  }

  async function loadCurrentUser() {
    try {
      // First try to get user from localStorage (set by login.js)
      const userStr = localStorage.getItem('ngmUser');
      if (userStr) {
        state.currentUser = normalizeUser(JSON.parse(userStr));
        console.log("[Arturito] Current user from localStorage:", state.currentUser.user_name);
        return;
      }

      // Fallback to API call if not in localStorage
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load user");
      const data = await res.json();
      state.currentUser = normalizeUser(data.user || data);
      console.log("[Arturito] Current user from API:", state.currentUser.user_name);
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

    // Setup mobile keyboard detection
    setupMobileKeyboardDetection();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE KEYBOARD DETECTION
  // ─────────────────────────────────────────────────────────────────────────
  function setupMobileKeyboardDetection() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) return;

    const pageElement = document.querySelector('.page-arturito');
    const mainArea = document.querySelector('.main-area');
    const messagesContainer = DOM.messagesContainer;

    let initialViewportHeight = window.visualViewport?.height || window.innerHeight;
    let keyboardOpen = false;

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    } else {
      // Fallback for older browsers
      DOM.chatInput?.addEventListener('focus', () => {
        setTimeout(() => {
          if (!keyboardOpen) handleKeyboardOpen();
        }, 300);
      });

      DOM.chatInput?.addEventListener('blur', () => {
        setTimeout(() => {
          if (keyboardOpen) handleKeyboardClose();
        }, 100);
      });
    }

    function handleViewportResize() {
      const currentHeight = window.visualViewport.height;
      const heightDiff = initialViewportHeight - currentHeight;

      if (heightDiff > 150 && !keyboardOpen) {
        handleKeyboardOpen();
        // Adjust main area height
        if (mainArea) {
          mainArea.style.height = `${currentHeight}px`;
        }
      } else if (heightDiff < 100 && keyboardOpen) {
        handleKeyboardClose();
        if (mainArea) {
          mainArea.style.height = '';
        }
      }
    }

    function handleKeyboardOpen() {
      keyboardOpen = true;
      pageElement?.classList.add('keyboard-open');
      document.body.classList.add('keyboard-open');

      // Scroll to bottom
      setTimeout(() => {
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);

      console.log('[Arturito] Keyboard opened');
    }

    function handleKeyboardClose() {
      keyboardOpen = false;
      pageElement?.classList.remove('keyboard-open');
      document.body.classList.remove('keyboard-open');

      if (mainArea) {
        mainArea.style.height = '';
      }

      console.log('[Arturito] Keyboard closed');
    }
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
      updateContextStats();
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
      updateContextStats();
      return;
    }

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
          module_knowledge: getModuleKnowledgeContext(),  // Include module help knowledge
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
        content: data.text || "I couldn't process your message.",
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
        content: "Sorry, there was an error processing your message. Please try again.",
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

    // Build avatar HTML - ring style matching Team page
    let avatarHtml;
    if (isUser) {
      const userPhoto = state.currentUser?.user_photo;
      const avatarColor = getAvatarColor(state.currentUser);
      const initials = getInitials(state.currentUser?.user_name || msg.user_name || "?");

      if (userPhoto) {
        avatarHtml = `<div class="arturito-message-avatar arturito-message-avatar--img" style="border-color: ${avatarColor}; background-image: url('${escapeHtml(userPhoto)}')"></div>`;
      } else {
        avatarHtml = `<div class="arturito-message-avatar" style="color: ${avatarColor}; border-color: ${avatarColor}">${initials}</div>`;
      }
    } else {
      // Bot avatar - green ring "A"
      avatarHtml = `<div class="arturito-message-avatar arturito-message-avatar--bot">A</div>`;
    }

    return `
      <div class="arturito-message ${roleClass} ${errorClass}">
        ${avatarHtml}
        <div class="arturito-message-content">
          <div class="arturito-message-bubble">${formattedContent}</div>
          <span class="arturito-message-time">${time}</span>
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
