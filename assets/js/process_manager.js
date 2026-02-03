/**
 * PROCESS MANAGER - Code-Based Process Documentation
 * ===================================================
 * Visual canvas showing business processes derived from actual code.
 *
 * Navigation:
 * - Level 1 (Tree View): Overview showing Deliverables or Departments
 * - Level 2 (Detail View): Expanded process with steps, services, and branches
 */

(function() {
    'use strict';

    const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";
    const PAGE_LOAD_START = Date.now();
    const MIN_LOADING_TIME = 800;

    // ================================
    // Data Structures
    // ================================

    // Deliverables - What we produce
    const DELIVERABLES = {
        expenses_engine: {
            id: 'expenses_engine',
            name: 'Expenses Engine',
            description: 'Complete expense lifecycle with function-level detail',
            icon: 'receipt',
            color: '#3ecf8e',
            isDetailedModule: true,  // Special flag for function-level view
            processIds: []  // Uses EXPENSES_ENGINE data instead
        },
        expense_tracking: {
            id: 'expense_tracking',
            name: 'Expense Tracking',
            description: 'Track, categorize, and reconcile business expenses',
            icon: 'receipt',
            color: '#3ecf8e',
            processIds: ['COGS_Authorization', 'Expense_Categorization', 'Receipt_Processing', 'QBO_Reconciliation', 'DRAFT_invoice_automation']
        },
        project_management: {
            id: 'project_management',
            name: 'Project Management',
            description: 'Coordinate projects, tasks, and team workflows',
            icon: 'briefcase',
            color: '#3ecf8e',
            processIds: ['Project_Health_Check']
        },
        communications: {
            id: 'communications',
            name: 'Communications',
            description: 'Chat, notifications, and AI assistant',
            icon: 'message',
            color: '#3ecf8e',
            processIds: []  // Arturito processes would go here
        },
        reporting: {
            id: 'reporting',
            name: 'Reporting & Analytics',
            description: 'Budget monitoring and financial reports',
            icon: 'chart',
            color: '#3ecf8e',
            processIds: ['DRAFT_budget_alerts']
        }
    };

    // Departments - Who uses it
    const DEPARTMENTS = {
        bookkeeping: {
            id: 'bookkeeping',
            name: 'Bookkeeping',
            description: 'Expense tracking, receipts, and reconciliation',
            icon: 'book',
            color: '#3ecf8e'
        },
        coordination: {
            id: 'coordination',
            name: 'Coordination',
            description: 'Project management and task coordination',
            icon: 'users',
            color: '#3ecf8e'
        },
        finance: {
            id: 'finance',
            name: 'Finance',
            description: 'Budget monitoring and financial planning',
            icon: 'dollar',
            color: '#3ecf8e'
        },
        operations: {
            id: 'operations',
            name: 'Operations',
            description: 'Day-to-day operational processes',
            icon: 'settings',
            color: '#3ecf8e'
        }
    };

    // ================================
    // EXPENSES ENGINE - Function Level Detail
    // ================================
    // Complete lifecycle of the Expenses Engine module with ~18 function-level cards
    const EXPENSES_ENGINE = {
        id: 'expenses_engine',
        name: 'Expenses Engine',
        description: 'Complete expense lifecycle from receipt upload to authorization and reporting',
        phases: [
            {
                id: 'receipt_upload',
                name: 'Receipt Upload',
                description: 'Multiple entry points for expense receipts',
                functions: [
                    {
                        id: 'upload_direct',
                        name: 'Direct Upload',
                        endpoint: 'POST /pending-receipts/upload',
                        description: 'Upload receipt image/PDF directly to pending queue',
                        roles: ['Bookkeeper', 'PM'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:45'
                    },
                    {
                        id: 'scan_from_pending',
                        name: 'Scan from Messages',
                        endpoint: 'POST /pending-receipts/scan-from-pending',
                        description: 'Scan bills channel in project messages for unprocessed receipts',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:112'
                    },
                    {
                        id: 'store_bucket',
                        name: 'Store in Bucket',
                        endpoint: 'internal',
                        description: 'Save file to pending-expenses storage bucket with unique name',
                        roles: ['System'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:78'
                    }
                ]
            },
            {
                id: 'ocr_analysis',
                name: 'OCR Analysis',
                description: 'AI-powered receipt data extraction',
                functions: [
                    {
                        id: 'ocr_extract',
                        name: 'OCR Extract',
                        endpoint: 'POST /pending-receipts/{id}/ocr',
                        description: 'Extract vendor, amount, date using gpt-4o Vision API',
                        roles: ['Bookkeeper'],
                        services: ['openai', 'supabase'],
                        file: 'pending_receipts.py:156',
                        model: 'gpt-4o'
                    },
                    {
                        id: 'ocr_fast_mode',
                        name: 'Fast OCR Mode',
                        endpoint: 'POST /pending-receipts/{id}/ocr?fast=true',
                        description: 'Quick extraction using gpt-4o-mini for simple receipts',
                        roles: ['Bookkeeper'],
                        services: ['openai', 'supabase'],
                        file: 'pending_receipts.py:156',
                        model: 'gpt-4o-mini'
                    },
                    {
                        id: 'create_pending_record',
                        name: 'Create Pending Record',
                        endpoint: 'internal',
                        description: 'Store extracted data in pending_receipts table with status=pending',
                        roles: ['System'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:198'
                    }
                ]
            },
            {
                id: 'linking',
                name: 'Linking',
                description: 'Connect expense to project, vendor, and payment method',
                functions: [
                    {
                        id: 'link_project',
                        name: 'Link to Project',
                        endpoint: 'PATCH /pending-receipts/{id}',
                        description: 'Associate receipt with a project from projects table',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:225'
                    },
                    {
                        id: 'link_vendor',
                        name: 'Link to Vendor',
                        endpoint: 'PATCH /pending-receipts/{id}',
                        description: 'Match or create vendor from vendors table',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:225'
                    },
                    {
                        id: 'link_payment',
                        name: 'Link Payment Method',
                        endpoint: 'PATCH /pending-receipts/{id}',
                        description: 'Associate with payment method (credit card, cash, etc.)',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'pending_receipts.py:225'
                    }
                ]
            },
            {
                id: 'categorization',
                name: 'Categorization',
                description: 'Assign expense categories and accounts',
                functions: [
                    {
                        id: 'auto_categorize',
                        name: 'Auto-Categorize',
                        endpoint: 'POST /expenses/{id}/auto-categorize',
                        description: 'AI suggests category based on vendor history and description',
                        roles: ['System'],
                        services: ['openai', 'supabase'],
                        file: 'expenses.py:312',
                        model: 'gpt-4o'
                    },
                    {
                        id: 'manual_categorize',
                        name: 'Manual Category',
                        endpoint: 'PATCH /expenses/{id}',
                        description: 'Bookkeeper manually assigns expense_category',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'expenses.py:156'
                    },
                    {
                        id: 'create_cogs_entry',
                        name: 'Create COGS Entry',
                        endpoint: 'POST /expenses/cogs',
                        description: 'Convert approved receipt to expenses_manual_COGS record',
                        roles: ['Bookkeeper'],
                        services: ['supabase'],
                        file: 'expenses.py:89'
                    }
                ]
            },
            {
                id: 'auth_automation',
                name: 'Authorization Automation',
                description: 'Pipeline creates tasks for pending authorizations',
                functions: [
                    {
                        id: 'pipeline_cogs_auth',
                        name: 'COGS Auth Pipeline',
                        endpoint: 'POST /pipeline/cogs-authorization',
                        description: 'Scheduled job queries pending expenses and creates authorization tasks',
                        roles: ['System'],
                        services: ['supabase'],
                        file: 'pipeline.py:912',
                        trigger: 'scheduled'
                    },
                    {
                        id: 'pipeline_categorization',
                        name: 'Categorization Pipeline',
                        endpoint: 'POST /pipeline/expense-categorization',
                        description: 'Creates tasks for uncategorized expenses by project',
                        roles: ['System'],
                        services: ['supabase'],
                        file: 'pipeline.py:1164',
                        trigger: 'scheduled'
                    }
                ]
            },
            {
                id: 'manual_auth',
                name: 'Manual Authorization',
                description: 'Manager reviews and authorizes expenses',
                functions: [
                    {
                        id: 'view_pending_auth',
                        name: 'View Pending Auth',
                        endpoint: 'GET /expenses/pending-authorization',
                        description: 'List expenses with auth_status=null filtered by project access',
                        roles: ['CEO', 'COO', 'Accounting Mgr', 'PM'],
                        services: ['supabase'],
                        file: 'expenses.py:178'
                    },
                    {
                        id: 'authorize_expense',
                        name: 'Authorize Expense',
                        endpoint: 'POST /expenses/{id}/authorize',
                        description: 'Set auth_status=true, auth_by, auth_date for expense',
                        roles: ['CEO', 'COO', 'Accounting Mgr', 'PM'],
                        services: ['supabase'],
                        file: 'expenses.py:267'
                    },
                    {
                        id: 'reject_expense',
                        name: 'Reject Expense',
                        endpoint: 'POST /expenses/{id}/reject',
                        description: 'Set auth_status=false with rejection reason',
                        roles: ['CEO', 'COO', 'Accounting Mgr', 'PM'],
                        services: ['supabase'],
                        file: 'expenses.py:289'
                    }
                ]
            },
            {
                id: 'final_state',
                name: 'Final State',
                description: 'Authorized expenses ready for reporting and reconciliation',
                functions: [
                    {
                        id: 'qbo_reconcile',
                        name: 'QBO Reconciliation',
                        endpoint: 'POST /reconciliations/match',
                        description: 'Match manual COGS with QuickBooks transactions',
                        roles: ['Accountant'],
                        services: ['supabase', 'quickbooks'],
                        file: 'reconciliations.py:45'
                    },
                    {
                        id: 'export_report',
                        name: 'Export to Reports',
                        endpoint: 'GET /reports/expenses',
                        description: 'Generate expense report with authorized and reconciled expenses',
                        roles: ['CEO', 'COO', 'Accounting Mgr'],
                        services: ['supabase'],
                        file: 'reports.py:156'
                    }
                ]
            }
        ],
        // Role hierarchy for authorization
        roleHierarchy: {
            'CEO': { level: 5, canAuthorize: 'all', color: '#ef4444' },
            'COO': { level: 4, canAuthorize: 'all', color: '#f97316' },
            'Accounting Mgr': { level: 3, canAuthorize: 'all', color: '#eab308' },
            'PM': { level: 2, canAuthorize: 'own_projects', color: '#22c55e' },
            'Bookkeeper': { level: 1, canAuthorize: 'none', color: '#3b82f6' },
            'Accountant': { level: 2, canAuthorize: 'none', color: '#8b5cf6' },
            'System': { level: 0, canAuthorize: 'none', color: '#6b7280' }
        }
    };

    // External Services
    const EXTERNAL_SERVICES = {
        supabase: {
            id: 'supabase',
            name: 'Supabase',
            type: 'Database',
            icon: 'database',
            color: '#3ecf8e',
            description: 'PostgreSQL database, auth, and storage'
        },
        firebase: {
            id: 'firebase',
            name: 'Firebase',
            type: 'Push Notifications',
            icon: 'bell',
            color: '#fbbf24',
            description: 'Push notifications for mobile and web'
        },
        openai: {
            id: 'openai',
            name: 'OpenAI',
            type: 'AI/ML',
            icon: 'brain',
            color: '#10b981',
            description: 'GPT for Arturito and OCR for receipts'
        },
        quickbooks: {
            id: 'quickbooks',
            name: 'QuickBooks',
            type: 'Accounting',
            icon: 'calculator',
            color: '#2ca01c',
            description: 'Accounting software integration'
        },
        google_chat: {
            id: 'google_chat',
            name: 'Google Chat',
            type: 'Messaging',
            icon: 'chat',
            color: '#4285f4',
            description: 'Webhook for Arturito bot'
        }
    };

    // ================================
    // Process Flowcharts
    // ================================
    // Detailed flowcharts for specific processes
    const PROCESS_FLOWCHARTS = {
        expenses_track: {
            id: 'expenses_track',
            name: 'Expenses Track',
            module: 'expenses_engine',
            description: 'Complete flow from expense receipt to manager authorization',
            links: {
                before: { module: 'communications', process: 'task_notifications', label: 'Proceso Notificaciones' },
                after: { module: 'bookkeeping', process: 'qbo_reconciliation', label: 'Reconciliacion QBO' }
            },
            nodes: [
                // Entry link from Notifications
                {
                    id: 'link_notifications',
                    type: 'link',
                    size: 'medium',
                    name: 'Proceso Notificaciones',
                    description: 'Tarea automatica: Gastos pendientes de ingresar',
                    link_to: { module: 'communications', process: 'task_notifications' },
                    direction: 'incoming',
                    position: { x: 100, y: 50 },
                    connects_to: ['recepcion_gasto']
                },
                // Step 1: Reception
                {
                    id: 'recepcion_gasto',
                    type: 'decision',
                    size: 'large',
                    name: 'Recepcion del Gasto',
                    description: 'Entrada de gastos al sistema desde multiples fuentes',
                    position: { x: 100, y: 180 },
                    options: [
                        { id: 'pdf_direct', label: 'PDF Directo', connects_to: 'seleccion_proyecto' },
                        { id: 'imagen_foto', label: 'Imagen/Foto', connects_to: 'seleccion_proyecto' },
                        { id: 'canal_receipts', label: 'Canal Receipts', connects_to: 'bandeja_pendientes' }
                    ]
                },
                // Bandeja pendientes (sub-step)
                {
                    id: 'bandeja_pendientes',
                    type: 'step',
                    size: 'medium',
                    name: 'Bandeja Pendientes',
                    description: 'Receipts subidos al canal se almacenan aqui',
                    is_implemented: true,
                    position: { x: 420, y: 180 },
                    connects_to: ['seleccion_proyecto']
                },
                // Step 2: Project Selection
                {
                    id: 'seleccion_proyecto',
                    type: 'step',
                    size: 'large',
                    name: 'Seleccion de Proyecto',
                    description: 'Seleccionar proyecto desde pagina Expenses Engine',
                    is_implemented: true,
                    position: { x: 100, y: 340 },
                    connects_to: ['confirmacion_pm']
                },
                // Step 3: PM Confirmation
                {
                    id: 'confirmacion_pm',
                    type: 'step',
                    size: 'medium',
                    name: 'Confirmacion PM',
                    description: 'Project Manager confirma pertenencia y especifica Stage de Obra',
                    is_implemented: true,
                    position: { x: 100, y: 480 },
                    subservices: [
                        { id: 'confirm_project', label: 'Confirmar Proyecto', active: true },
                        { id: 'set_stage', label: 'Especificar Stage', active: true }
                    ],
                    connects_to: ['modal_new_expense']
                },
                // Step 4: Modal New Expense (Decision)
                {
                    id: 'modal_new_expense',
                    type: 'decision',
                    size: 'large',
                    name: 'Modal New Expense',
                    description: 'Cargar gasto en el sistema',
                    position: { x: 100, y: 620 },
                    options: [
                        { id: 'manual', label: 'Manual (inputs)', connects_to: 'quick_check' },
                        { id: 'scan_receipt', label: 'Scan Receipt', connects_to: 'algo_iris' },
                        { id: 'from_pending', label: 'Desde Bandeja', connects_to: 'quick_check' }
                    ]
                },
                // Algorithm: IRIS - Receipt Scanner
                {
                    id: 'algo_iris',
                    type: 'algorithm',
                    size: 'large',
                    name: 'Receipt Scanner',
                    codename: 'IRIS',
                    version: '2.1',
                    description: 'Extraccion inteligente de datos de facturas usando vision AI',
                    color: '#8b5cf6',
                    glowColor: '#a78bfa',
                    position: { x: 420, y: 580 },
                    modes: [
                        { id: 'fast', name: 'Fast', model: 'GPT-4o-mini', description: 'Rapido, facturas simples' },
                        { id: 'heavy', name: 'Heavy', model: 'GPT-4o', description: 'Precision, facturas complejas' }
                    ],
                    tech: ['OpenAI Vision', 'OCR'],
                    inputs: ['image', 'pdf'],
                    outputs: ['vendor', 'amount', 'date', 'items'],
                    connects_to: ['quick_check']
                },
                // Step 5: Quick Check (has sub-process for detailed steps)
                {
                    id: 'quick_check',
                    type: 'step',
                    size: 'medium',
                    name: 'Quick Check - Bookkeeper',
                    description: 'Revision visual de datos, Price Check alerts, completar campos',
                    // Sub-process nodes (third level navigation)
                    subProcessNodes: [
                        {
                            id: 'qc_review_data',
                            type: 'step',
                            size: 'medium',
                            name: 'Review Extracted Data',
                            description: 'Verify vendor, amount, date from IRIS extraction',
                            position: { x: 100, y: 100 },
                            connects_to: ['qc_price_check']
                        },
                        {
                            id: 'qc_price_check',
                            type: 'decision',
                            size: 'medium',
                            name: 'Price Check Alert',
                            description: 'System flags unusual amounts or vendors',
                            position: { x: 100, y: 280 },
                            options: [
                                { id: 'alert_yes', label: 'Alert Triggered', connects_to: 'qc_manual_review' },
                                { id: 'alert_no', label: 'No Alert', connects_to: 'qc_complete_fields' }
                            ]
                        },
                        {
                            id: 'qc_manual_review',
                            type: 'step',
                            size: 'small',
                            name: 'Manual Review',
                            description: 'Bookkeeper manually verifies flagged expense',
                            position: { x: 380, y: 280 },
                            connects_to: ['qc_complete_fields']
                        },
                        {
                            id: 'qc_complete_fields',
                            type: 'step',
                            size: 'medium',
                            name: 'Complete Missing Fields',
                            description: 'Fill in any missing information',
                            position: { x: 100, y: 460 },
                            connects_to: ['qc_done']
                        },
                        {
                            id: 'qc_done',
                            type: 'milestone',
                            size: 'small',
                            name: 'Quick Check Complete',
                            description: 'Ready for categorization',
                            position: { x: 100, y: 600 }
                        }
                    ],
                    is_implemented: true,
                    position: { x: 100, y: 780 },
                    subservices: [
                        { id: 'visual_review', label: 'Revision Visual', active: true },
                        { id: 'price_check', label: 'Price Check Alert', active: true },
                        { id: 'complete_fields', label: 'Completar Campos', active: true }
                    ],
                    connects_to: ['categorizacion']
                },
                // Step 6: Categorization (Decision)
                {
                    id: 'categorizacion',
                    type: 'decision',
                    size: 'medium',
                    name: 'Categorizacion',
                    description: 'Asignar categoria contable al gasto',
                    position: { x: 100, y: 920 },
                    options: [
                        { id: 'manual_cat', label: 'Manual', connects_to: 'hito_eval_bk' },
                        { id: 'auto_cat', label: 'Auto-categorize', connects_to: 'algo_atlas' }
                    ]
                },
                // Algorithm: ATLAS - Auto Categorizer
                {
                    id: 'algo_atlas',
                    type: 'algorithm',
                    size: 'large',
                    name: 'Expense Categorizer',
                    codename: 'ATLAS',
                    version: '1.3',
                    description: 'Categorizacion automatica de gastos usando contexto historico y NLP',
                    color: '#06b6d4',
                    glowColor: '#22d3ee',
                    position: { x: 380, y: 880 },
                    modes: [
                        { id: 'standard', name: 'Standard', model: 'GPT-4o-mini', description: 'Gastos comunes' },
                        { id: 'deep', name: 'Deep Analysis', model: 'GPT-4o', description: 'Gastos ambiguos' }
                    ],
                    tech: ['OpenAI', 'Context Analysis'],
                    inputs: ['expense_data', 'vendor', 'amount'],
                    outputs: ['category', 'confidence', 'suggestions'],
                    connects_to: ['review_confidence']
                },
                // Review confidence (sub-step)
                {
                    id: 'review_confidence',
                    type: 'step',
                    size: 'small',
                    name: 'Revisar Confianza',
                    description: 'Revisar categorias con < 70% confianza',
                    is_implemented: true,
                    position: { x: 380, y: 1020 },
                    connects_to: ['hito_eval_bk']
                },
                // Milestone: Bookkeeper Evaluation
                {
                    id: 'hito_eval_bk',
                    type: 'milestone',
                    size: 'small',
                    name: 'Eval Bookkeeper',
                    description: 'Punto de evaluacion - Penalizacion si falla categorizacion',
                    evaluation_scope: 'bookkeeper',
                    position: { x: 100, y: 1040 },
                    connects_to: ['guardar_lista']
                },
                // Step 7: Save to List
                {
                    id: 'guardar_lista',
                    type: 'step',
                    size: 'large',
                    name: 'Guardar - Aparece en Lista',
                    description: 'Gasto guardado desde modal, visible en lista de expenses',
                    is_implemented: true,
                    position: { x: 100, y: 1140 },
                    connects_to: ['health_check']
                },
                // Step 8: Health Check
                {
                    id: 'health_check',
                    type: 'step',
                    size: 'medium',
                    name: 'Health Check',
                    description: 'Ejecutar funcion de Health Check para scoring',
                    is_implemented: true,
                    position: { x: 100, y: 1280 },
                    subservices: [
                        { id: 'check_duplicates', label: 'Duplicados', active: true },
                        { id: 'check_bill', label: 'Sin Bill', active: true },
                        { id: 'check_vendor', label: 'Sin Vendor', active: true },
                        { id: 'dismiss_review', label: 'Revisar/Dismiss', active: true }
                    ],
                    connects_to: ['hito_health_passed']
                },
                // Milestone: Health Check Passed
                {
                    id: 'hito_health_passed',
                    type: 'milestone',
                    size: 'small',
                    name: 'Health Check Passed',
                    description: 'Todos los puntos de health check en verde',
                    position: { x: 100, y: 1400 },
                    connects_to: ['fin_tarea_bk']
                },
                // Step 9: End Bookkeeper Task
                {
                    id: 'fin_tarea_bk',
                    type: 'step',
                    size: 'medium',
                    name: 'Fin Tarea Bookkeeper',
                    description: 'Dashboard -> Send to Review',
                    is_implemented: true,
                    position: { x: 100, y: 1500 },
                    connects_to: ['autorizacion_manager']
                },
                // Step 10: Manager Authorization
                {
                    id: 'autorizacion_manager',
                    type: 'step',
                    size: 'medium',
                    name: 'Autorizacion Manager',
                    description: 'Manager aprueba gastos registrados (ya recibio notificacion)',
                    is_implemented: true,
                    position: { x: 100, y: 1620 },
                    connects_to: ['hito_autorizado']
                },
                // Final Milestone
                {
                    id: 'hito_autorizado',
                    type: 'milestone',
                    size: 'small',
                    name: 'Gastos Autorizados',
                    description: 'Proceso completado',
                    position: { x: 100, y: 1740 },
                    connects_to: ['link_qbo']
                },
                // Exit link to QBO
                {
                    id: 'link_qbo',
                    type: 'link',
                    size: 'medium',
                    name: 'Reconciliacion QBO',
                    description: 'Continua hacia proceso de reconciliacion QuickBooks',
                    link_to: { module: 'bookkeeping', process: 'qbo_reconciliation' },
                    direction: 'outgoing',
                    position: { x: 100, y: 1860 },
                    connects_to: []
                },
                // Draft example: Auto stage detection
                {
                    id: 'draft_auto_stage',
                    type: 'draft',
                    size: 'medium',
                    name: 'Auto-deteccion Stage',
                    description: 'IA detecta stage de obra basado en historial',
                    is_implemented: false,
                    planned_feature: 'Usar historial de gastos similares para sugerir stage automaticamente',
                    position: { x: 420, y: 480 },
                    connects_to: ['modal_new_expense']
                }
            ]
        }
    };

    // Storage key for flowchart positions
    const FLOW_POSITIONS_KEY = 'ngm_process_flowchart_positions';

    // ================================
    // State
    // ================================
    const state = {
        processes: [],           // All processes (implemented + drafts)
        filteredProcesses: [],   // Filtered for current view
        currentUser: null,
        selectedProcess: null,
        isPanelOpen: false,

        // Navigation
        currentLevel: 'tree',    // 'tree' or 'detail'
        groupBy: 'deliverable',  // 'deliverable' or 'department'
        selectedGroup: null,     // Selected deliverable or department
        selectedGroupId: null,

        // Mode: 'view' (default) or 'draft' (can edit drafts)
        mode: 'view',

        // Canvas state
        canvas: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            minScale: 0.25,
            maxScale: 2,
        },

        // Dragged node
        draggedNode: null,
        dragOffset: { x: 0, y: 0 },

        // Node positions for persistence
        nodePositions: {},

        // Custom modules (user-created)
        customModules: [],

        // Departments from Supabase
        departments: [],

        // Currently editing module
        editingModuleId: null,

        // Connection mode state
        connectionMode: {
            active: false,
            sourceId: null,
            sourceRect: null,
            mouseX: 0,
            mouseY: 0
        },

        // Flowchart state
        currentProcessId: null,      // Process being viewed in flowchart
        flowNodePositions: {},       // Positions of flowchart nodes
        selectedFlowNode: null,      // Currently selected node in flowchart

        // Third level navigation (sub-process)
        currentNodeId: null,         // Node being viewed in sub-process level
        navigationStack: [],         // Stack for back navigation: [{level, processId, nodeId}]

        // Module filter state: null, 'implemented', or 'draft'
        moduleFilter: null,

        // Multi-select state
        selectedModules: [],  // Array of selected module IDs
        selectionBox: {
            active: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
        },
    };

    // ================================
    // Supabase Persistence (Shared State)
    // ================================
    // Local storage keys (fallback/cache when API unavailable)
    const POSITIONS_KEY = 'ngm_process_manager_positions';
    const CUSTOM_MODULES_KEY = 'ngm_process_manager_custom_modules';

    // Debounce timers for saving
    const saveTimers = {};

    // Generic function to load state from Supabase
    async function loadStateFromSupabase(stateKey, defaultValue = {}) {
        const url = `${API_BASE}/process-manager/state/${stateKey}`;
        console.log(`[SUPABASE-LOAD] Fetching ${stateKey} from: ${url}`);

        try {
            const res = await fetch(url);
            console.log(`[SUPABASE-LOAD] Response status: ${res.status}`);

            if (res.ok) {
                const data = await res.json();
                console.log(`[SUPABASE-LOAD] Raw response for ${stateKey}:`, data);
                console.log(`[SUPABASE-LOAD] state_data type: ${typeof data.state_data}, isArray: ${Array.isArray(data.state_data)}`);
                if (Array.isArray(data.state_data)) {
                    console.log(`[SUPABASE-LOAD] ${stateKey} contains ${data.state_data.length} items`);
                }
                return {
                    success: true,
                    data: data.state_data || defaultValue,
                    error: null
                };
            }

            if (res.status === 404) {
                // No data saved yet (first time) - not an error
                console.log(`[SUPABASE-LOAD] No ${stateKey} found in Supabase (first time)`);
                return {
                    success: true,
                    data: defaultValue,
                    error: null
                };
            }

            // Server error
            const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
            console.error(`[SUPABASE-LOAD] Server error for ${stateKey}:`, error);
            return {
                success: false,
                data: defaultValue,
                error: `HTTP ${res.status}: ${error.detail || 'Server error'}`
            };

        } catch (e) {
            // Network error or other exception
            console.error(`[SUPABASE-LOAD] Network error loading ${stateKey}:`, e);
            return {
                success: false,
                data: defaultValue,
                error: e.message || 'Network error'
            };
        }
    }

    // Generic function to save state to Supabase (debounced)
    function saveStateToSupabase(stateKey, data, delay = 1000) {
        console.log(`[SUPABASE-SAVE] Queuing save for ${stateKey} (delay: ${delay}ms)`);
        console.log(`[SUPABASE-SAVE] Data to save:`, JSON.stringify(data).substring(0, 500) + '...');

        // Clear existing timer
        if (saveTimers[stateKey]) {
            clearTimeout(saveTimers[stateKey]);
        }

        // Show sync indicator
        const syncIndicator = document.getElementById('sync-indicator');
        if (syncIndicator) {
            syncIndicator.classList.remove('hidden', 'synced');
        }

        // Debounce the save
        saveTimers[stateKey] = setTimeout(async () => {
            const url = `${API_BASE}/process-manager/state/${stateKey}`;
            console.log(`[SUPABASE-SAVE] Executing save to: ${url}`);

            try {
                const userId = state.currentUser?.id || null;
                const payload = {
                    state_data: data,
                    updated_by: userId
                };
                console.log(`[SUPABASE-SAVE] Payload:`, payload);

                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                console.log(`[SUPABASE-SAVE] Response status: ${res.status}`);

                if (!res.ok) {
                    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
                    console.error(`[SUPABASE-SAVE] Error response:`, error);
                    throw new Error(error.detail || `HTTP ${res.status}`);
                }

                const result = await res.json();
                console.log(`[SUPABASE-SAVE] Success! Saved ${stateKey} to Supabase`, result);

                // Show synced state briefly
                if (syncIndicator) {
                    syncIndicator.classList.add('synced');
                    setTimeout(() => {
                        syncIndicator.classList.add('hidden');
                    }, 1500);
                }

                // Clear any previous error flag for this key
                if (state.saveErrors) {
                    delete state.saveErrors[stateKey];
                }
            } catch (e) {
                console.error(`[PROCESS-MANAGER] Error saving ${stateKey} to Supabase:`, e);

                // Hide sync indicator on error
                if (syncIndicator) {
                    syncIndicator.classList.add('hidden');
                }

                // Show toast only once per key (avoid spam)
                if (!state.saveErrors) state.saveErrors = {};
                if (!state.saveErrors[stateKey]) {
                    state.saveErrors[stateKey] = true;
                    if (window.showToast) {
                        showToast(`Failed to sync ${stateKey.replace(/_/g, ' ')} to server. Changes saved locally.`, 'warning');
                    }
                }
            }
        }, delay);
    }

    // ================================
    // Position Persistence
    // ================================
    async function loadNodePositions() {
        // Load from Supabase only (no localStorage fallback to avoid stale data)
        const result = await loadStateFromSupabase('node_positions', {});

        if (result.success) {
            state.nodePositions = result.data;
            // Update local cache only when successfully loaded from server
            localStorage.setItem(POSITIONS_KEY, JSON.stringify(result.data));
        } else {
            // Server error - use empty state and show error
            state.nodePositions = {};
            console.error('[PROCESS-MANAGER] Failed to load positions:', result.error);

            if (window.showToast) {
                showToast(`Error loading positions: ${result.error}. Using default layout.`, 'error');
            }
        }
    }

    function saveNodePositions() {
        // Save to localStorage immediately (cache)
        try {
            localStorage.setItem(POSITIONS_KEY, JSON.stringify(state.nodePositions));
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error saving positions to localStorage:', e);
        }

        // Save to Supabase (debounced)
        saveStateToSupabase('node_positions', state.nodePositions);
    }

    // ================================
    // Custom Modules Storage
    // ================================
    async function loadCustomModules() {
        // Clear legacy localStorage cache (one-time migration cleanup)
        localStorage.removeItem(CUSTOM_MODULES_KEY);

        // Load from Supabase only - single source of truth
        const result = await loadStateFromSupabase('custom_modules', []);

        if (result.success && Array.isArray(result.data)) {
            state.customModules = normalizeModules(result.data);
            console.log(`[PROCESS-MANAGER] Loaded ${state.customModules.length} modules from Supabase`);
        } else {
            // Server error - show error and disable editing
            state.customModules = [];
            state.serverError = true;
            console.error('[PROCESS-MANAGER] Failed to load custom modules:', result.error);

            if (window.showToast) {
                showToast(`Server error: Unable to load modules. Changes will NOT be saved.`, 'error');
            }

            // Show persistent error banner
            showServerErrorBanner();
        }
    }

    function showServerErrorBanner() {
        // Remove existing banner if any
        const existing = document.getElementById('server-error-banner');
        if (existing) existing.remove();

        const banner = document.createElement('div');
        banner.id = 'server-error-banner';
        banner.className = 'server-error-banner';
        banner.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>Server connection failed. Changes will not be saved. <button onclick="location.reload()">Retry</button></span>
        `;
        document.body.appendChild(banner);
    }

    // Ensure all modules have required properties (backwards compatibility)
    function normalizeModules(modules) {
        return modules.map((m, index) => {
            // Sanitize linkedModuleId - must be a valid string or null
            let linkedModuleId = null;
            if (m.linkedModuleId && typeof m.linkedModuleId === 'string' && !m.linkedModuleId.includes('[object')) {
                linkedModuleId = m.linkedModuleId;
            }

            return {
                ...m,
                // Ensure id exists - use existing id, module_id, or generate one
                id: m.id || m.module_id || `custom_legacy_${Date.now()}_${index}`,
                type: m.type || 'step',
                size: m.size || 'medium',
                connectedToHub: m.connectedToHub !== false,
                linkedModuleId: linkedModuleId,
                isCustom: true
            };
        });
    }

    function saveCustomModules() {
        // Check if server is available
        if (state.serverError) {
            console.warn('[PROCESS-MANAGER] Cannot save - server unavailable');
            if (window.showToast) {
                showToast('Cannot save: Server unavailable. Refresh to retry.', 'error');
            }
            return;
        }

        console.log('[PROCESS-MANAGER] Saving', state.customModules.length, 'modules to Supabase');

        // Save to Supabase only (single source of truth)
        saveStateToSupabase('custom_modules', state.customModules);
    }

    // ================================
    // Departments from Supabase
    // ================================
    async function loadDepartments() {
        try {
            const res = await fetch(`${API_BASE}/departments`);
            if (res.ok) {
                const data = await res.json();
                state.departments = data.departments || data || [];
                console.log('[PROCESS-MANAGER] Loaded', state.departments.length, 'departments');
                populateDepartmentDropdown();
            }
        } catch (err) {
            console.warn('[PROCESS-MANAGER] Error loading departments:', err);
            // Fallback to static departments
            state.departments = [
                { department_id: 'bookkeeping', department_name: 'Bookkeeping' },
                { department_id: 'coordination', department_name: 'Coordination' },
                { department_id: 'finance', department_name: 'Finance' },
                { department_id: 'operations', department_name: 'Operations' }
            ];
            populateDepartmentDropdown();
        }
    }

    function populateDepartmentDropdown() {
        const select = document.getElementById('moduleDepartment');
        if (!select) return;

        select.innerHTML = '<option value="">-- Select Department --</option>';
        state.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.department_id;
            option.textContent = dept.department_name;
            select.appendChild(option);
        });
    }

    function addCustomModule(moduleData) {
        console.log('[MODULE-ADD] Creating new module with data:', moduleData);

        // Validate linkedModuleId - must be a string (module ID) or null
        let validLinkedModuleId = null;
        if (moduleData.linkedModuleId && typeof moduleData.linkedModuleId === 'string') {
            validLinkedModuleId = moduleData.linkedModuleId;
        }

        const id = 'custom_' + Date.now();
        const module = {
            id: id,
            name: moduleData.name,
            description: moduleData.description || '',
            icon: moduleData.icon || 'box',
            color: moduleData.color || '#6b7280',
            departmentId: moduleData.departmentId || null,
            type: moduleData.type || 'step',
            size: moduleData.size || 'medium',
            isImplemented: moduleData.isImplemented || false,
            isCustom: true,
            connectedToHub: moduleData.connectedToHub !== false, // Default true
            linkedModuleId: validLinkedModuleId, // Parent module if this is a sub-module
            linkedProcesses: moduleData.linkedProcesses || [],
            processIds: [],
            createdAt: new Date().toISOString()
        };

        console.log('[MODULE-ADD] Created module object:', module);
        console.log('[MODULE-ADD] Current modules count:', state.customModules.length);

        state.customModules.push(module);

        console.log('[MODULE-ADD] After push, modules count:', state.customModules.length);
        console.log('[MODULE-ADD] Calling saveCustomModules...');

        saveCustomModules();
        return module;
    }

    function toggleModuleConnection(moduleId) {
        const module = getCustomModule(moduleId);
        if (!module) return;

        // Toggle connection - default to true if undefined (for backwards compatibility)
        module.connectedToHub = module.connectedToHub === undefined ? false : !module.connectedToHub;
        saveCustomModules();

        // Redraw
        renderTreeView();

        showToast(module.connectedToHub ? 'Connected to Hub' : 'Disconnected from Hub', 'success');
    }

    function updateCustomModule(id, moduleData) {
        const index = state.customModules.findIndex(m => m.id === id);
        if (index !== -1) {
            state.customModules[index] = {
                ...state.customModules[index],
                ...moduleData,
                updatedAt: new Date().toISOString()
            };
            saveCustomModules();
            return state.customModules[index];
        }
        return null;
    }

    function deleteCustomModule(id) {
        const index = state.customModules.findIndex(m => m.id === id);
        if (index !== -1) {
            state.customModules.splice(index, 1);
            // Also remove saved position
            const key = `${state.groupBy}_${id}`;
            delete state.nodePositions[key];
            saveCustomModules();
            saveNodePositions();
            return true;
        }
        return false;
    }

    function getCustomModule(id) {
        return state.customModules.find(m => m.id === id);
    }

    function getNodePosition(nodeId, defaultX, defaultY) {
        const key = `${state.groupBy}_${nodeId}`;
        if (state.nodePositions[key]) {
            return state.nodePositions[key];
        }
        return { x: defaultX, y: defaultY };
    }

    function setNodePosition(nodeId, x, y) {
        const key = `${state.groupBy}_${nodeId}`;
        state.nodePositions[key] = { x, y };
        saveNodePositions();
    }

    // ================================
    // DOM References
    // ================================
    let elements = {};

    function cacheElements() {
        elements = {
            canvasContainer: document.getElementById('canvasContainer'),
            canvasGrid: document.getElementById('canvasGrid'),
            treeViewContainer: document.getElementById('treeViewContainer'),
            detailViewContainer: document.getElementById('detailViewContainer'),
            connectionsLayer: document.getElementById('connectionsLayer'),
            snapGuides: document.getElementById('snapGuides'),
            selectionBox: document.getElementById('selectionBox'),
            canvasEmpty: document.getElementById('canvasEmpty'),
            processPanel: document.getElementById('processPanel'),
            panelTitle: document.getElementById('panelTitle'),
            panelContent: document.getElementById('panelContent'),
            panelActions: document.getElementById('panelActions'),
            processBreadcrumb: document.getElementById('processBreadcrumb'),
            viewSwitch: document.getElementById('viewSwitch'),
            btnBack: document.getElementById('btnBack'),
            btnAddProcess: document.getElementById('btnAddProcess'),
            countImplemented: document.getElementById('countImplemented'),
            countDrafts: document.getElementById('countDrafts'),
            processStats: document.getElementById('processStats'),
            statImplemented: document.querySelector('.stat-item.stat-implemented'),
            statDraft: document.querySelector('.stat-item.stat-draft'),
            // Minimap elements
            canvasMinimap: document.getElementById('canvasMinimap'),
            minimapCanvas: document.getElementById('minimapCanvas'),
            minimapBody: document.getElementById('minimapBody'),
            minimapViewport: document.getElementById('minimapViewport'),
            btnToggleMinimap: document.getElementById('btnToggleMinimap'),
            processModal: document.getElementById('processModal'),
            // Module modal elements
            moduleModal: document.getElementById('moduleModal'),
            btnAddModule: document.getElementById('btnAddModule'),
            moduleContextMenu: document.getElementById('moduleContextMenu'),
            flowNodeContextMenu: document.getElementById('flowNodeContextMenu'),
            // Process navigator elements
            processNavigator: document.getElementById('processNavigator'),
            processNavigatorList: document.getElementById('processNavigatorList'),
            processSearchInput: document.getElementById('processSearchInput'),
        };
    }

    // ================================
    // Initialization
    // ================================
    async function init() {
        cacheElements();
        loadCurrentUser();
        // Load all persisted state from Supabase (with localStorage fallback)
        await Promise.all([
            loadNodePositions(),
            loadCustomModules(),
            loadFlowPositions(),
            loadDraftStates()
        ]);
        setupEventListeners();
        initConnectionDragging();
        await loadProcesses();
        await loadDepartments();
        renderTreeView();
        updateStats();
        setupProcessNavigator();
        setupURLRouting();

        // Check for URL parameters to navigate to specific view
        handleURLNavigation();

        centerCanvas();

        // Hide loading overlay
        const elapsed = Date.now() - PAGE_LOAD_START;
        const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
        setTimeout(() => {
            document.body.classList.remove('page-loading');
            document.body.classList.add('auth-ready');
            const overlay = document.getElementById('pageLoadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        }, remaining);
    }

    function loadCurrentUser() {
        const userStr = localStorage.getItem('ngm_user');
        if (userStr) {
            try {
                state.currentUser = JSON.parse(userStr);
            } catch (e) {
                console.error('[PROCESS-MANAGER] Error parsing user:', e);
            }
        }
    }

    // ================================
    // Event Listeners
    // ================================
    function setupEventListeners() {
        // View switch (By Deliverable / By Department)
        if (elements.viewSwitch) {
            elements.viewSwitch.addEventListener('click', (e) => {
                const btn = e.target.closest('.switch-btn');
                if (!btn) return;

                const group = btn.dataset.group;
                if (group && group !== state.groupBy) {
                    state.groupBy = group;
                    elements.viewSwitch.querySelectorAll('.switch-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    renderTreeView();
                }
            });
        }

        // Back button
        if (elements.btnBack) {
            elements.btnBack.addEventListener('click', navigateBack);
        }

        // Add Process button
        if (elements.btnAddProcess) {
            elements.btnAddProcess.addEventListener('click', openAddProcessModal);
        }

        // Close panel
        const btnClosePanel = document.getElementById('btnClosePanel');
        if (btnClosePanel) {
            btnClosePanel.addEventListener('click', closePanel);
        }

        // Zoom controls
        const btnZoomIn = document.getElementById('btnZoomIn');
        const btnZoomOut = document.getElementById('btnZoomOut');
        const btnFitView = document.getElementById('btnFitView');

        if (btnZoomIn) btnZoomIn.addEventListener('click', () => zoom(0.2));
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => zoom(-0.2));
        if (btnFitView) btnFitView.addEventListener('click', centerCanvas);

        // Stats filter (Live/Draft toggle)
        if (elements.statImplemented) {
            elements.statImplemented.addEventListener('click', () => toggleModuleFilter('implemented'));
        }
        if (elements.statDraft) {
            elements.statDraft.addEventListener('click', () => toggleModuleFilter('draft'));
        }

        // Canvas panning
        if (elements.canvasContainer) {
            elements.canvasContainer.addEventListener('mousedown', handleCanvasMouseDown);
            elements.canvasContainer.addEventListener('mousemove', handleCanvasMouseMove);
            elements.canvasContainer.addEventListener('mouseup', handleCanvasMouseUp);
            elements.canvasContainer.addEventListener('mouseleave', handleCanvasMouseUp);
            elements.canvasContainer.addEventListener('wheel', handleCanvasWheel, { passive: false });
        }

        // Modal events
        setupModalListeners();
        setupModuleModalListeners();
        setupFlowNodeContextMenu();

        // Add Module button
        if (elements.btnAddModule) {
            elements.btnAddModule.addEventListener('click', () => openAddModuleModal());
        }

        // Context menu (close on click outside)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu') && !e.target.closest('.tree-node.custom-module') && !e.target.closest('.flow-node')) {
                hideContextMenu();
            }
        });

        // Minimap toggle
        if (elements.btnToggleMinimap) {
            elements.btnToggleMinimap.addEventListener('click', toggleMinimap);
        }
        // Also toggle when clicking the header
        const minimapHeader = document.querySelector('.minimap-header');
        if (minimapHeader) {
            minimapHeader.addEventListener('click', toggleMinimap);
        }

        // Load minimap collapsed state
        loadMinimapState();
    }

    function setupModalListeners() {
        const modal = elements.processModal;
        if (!modal) return;

        const btnClose = document.getElementById('btnCloseProcessModal');
        const btnCancel = document.getElementById('btnCancelProcess');
        const btnSave = document.getElementById('btnSaveProcess');

        if (btnClose) btnClose.addEventListener('click', closeModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModal);
        if (btnSave) btnSave.addEventListener('click', saveProcess);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    function setupModuleModalListeners() {
        const modal = elements.moduleModal;
        if (!modal) return;

        const btnClose = document.getElementById('btnCloseModuleModal');
        const btnCancel = document.getElementById('btnCancelModule');
        const btnSave = document.getElementById('btnSaveModule');
        const btnDelete = document.getElementById('btnDeleteModule');
        const typeSelect = document.getElementById('moduleType');
        const sizeSelect = document.getElementById('moduleSize');

        if (btnClose) btnClose.addEventListener('click', closeModuleModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModuleModal);
        if (btnSave) btnSave.addEventListener('click', saveModule);
        if (btnDelete) btnDelete.addEventListener('click', confirmDeleteModule);

        // Auto-select small size for algorithm type
        if (typeSelect && sizeSelect) {
            typeSelect.addEventListener('change', (e) => {
                if (e.target.value === 'algorithm') {
                    sizeSelect.value = 'small';
                }
            });
        }

        // Implemented switch label update
        const implementedCheckbox = document.getElementById('moduleImplemented');
        const implementedLabel = document.getElementById('moduleImplementedLabel');
        if (implementedCheckbox && implementedLabel) {
            implementedCheckbox.addEventListener('change', (e) => {
                implementedLabel.textContent = e.target.checked ? 'Live' : 'Draft';
                implementedLabel.classList.toggle('live', e.target.checked);
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModuleModal();
        });

        // Context menu actions
        if (elements.moduleContextMenu) {
            elements.moduleContextMenu.addEventListener('click', (e) => {
                const item = e.target.closest('.context-menu-item');
                if (!item) return;

                const action = item.dataset.action;
                const moduleId = elements.moduleContextMenu.dataset.moduleId;

                if (action === 'edit' && moduleId) {
                    openEditModuleModal(moduleId);
                } else if (action === 'delete' && moduleId) {
                    confirmDeleteModuleById(moduleId);
                } else if (action === 'toggle-connection' && moduleId) {
                    toggleModuleConnection(moduleId);
                } else if (action === 'start-connection' && moduleId) {
                    startConnectionMode(moduleId);
                } else if (action === 'create-linked-module' && moduleId) {
                    openAddModuleModal(moduleId);
                }
                hideContextMenu();
            });
        }
    }

    // ================================
    // Module Modal Functions
    // ================================
    function openAddModuleModal(linkedModuleId = null) {
        if (!elements.moduleModal) return;

        state.editingModuleId = null;

        // Set title based on whether we're creating a linked module
        const parentModule = linkedModuleId ? state.customModules.find(m => m.id === linkedModuleId) : null;
        if (parentModule) {
            document.getElementById('moduleModalTitle').textContent = `Add Sub-Module to "${parentModule.name}"`;
        } else {
            document.getElementById('moduleModalTitle').textContent = 'Add Module';
        }

        document.getElementById('moduleForm').reset();
        document.getElementById('moduleEditId').value = '';
        document.getElementById('moduleLinkedModuleId').value = linkedModuleId || '';
        document.getElementById('moduleType').value = 'step';
        document.getElementById('moduleSize').value = 'medium';
        document.getElementById('btnDeleteModule').classList.add('hidden');

        // Reset implemented switch to draft
        const implementedCheckbox = document.getElementById('moduleImplemented');
        const implementedLabel = document.getElementById('moduleImplementedLabel');
        if (implementedCheckbox) {
            implementedCheckbox.checked = false;
        }
        if (implementedLabel) {
            implementedLabel.textContent = 'Draft';
            implementedLabel.classList.remove('live');
        }

        elements.moduleModal.classList.remove('hidden');
    }

    function openEditModuleModal(moduleId) {
        if (!elements.moduleModal) return;

        const module = getCustomModule(moduleId);
        if (!module) return;

        state.editingModuleId = moduleId;
        document.getElementById('moduleModalTitle').textContent = 'Edit Module';
        document.getElementById('moduleEditId').value = moduleId;
        document.getElementById('moduleLinkedModuleId').value = '';  // Clear linked module field
        document.getElementById('moduleName').value = module.name;
        document.getElementById('moduleDescription').value = module.description || '';
        document.getElementById('moduleIcon').value = module.icon || 'box';
        document.getElementById('moduleDepartment').value = module.departmentId || '';
        document.getElementById('moduleType').value = module.type || 'step';
        document.getElementById('moduleSize').value = module.size || 'medium';
        document.getElementById('btnDeleteModule').classList.remove('hidden');

        // Set implemented switch
        const implementedCheckbox = document.getElementById('moduleImplemented');
        const implementedLabel = document.getElementById('moduleImplementedLabel');
        if (implementedCheckbox) {
            implementedCheckbox.checked = module.isImplemented === true;
        }
        if (implementedLabel) {
            implementedLabel.textContent = module.isImplemented ? 'Live' : 'Draft';
            implementedLabel.classList.toggle('live', module.isImplemented === true);
        }

        elements.moduleModal.classList.remove('hidden');
    }

    function closeModuleModal() {
        if (elements.moduleModal) {
            elements.moduleModal.classList.add('hidden');
            state.editingModuleId = null;
        }
    }

    function saveModule() {
        const form = document.getElementById('moduleForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const editId = document.getElementById('moduleEditId').value;
        const linkedModuleId = document.getElementById('moduleLinkedModuleId').value;
        const implementedCheckbox = document.getElementById('moduleImplemented');

        const moduleData = {
            name: document.getElementById('moduleName').value.trim(),
            description: document.getElementById('moduleDescription').value.trim(),
            icon: document.getElementById('moduleIcon').value,
            departmentId: document.getElementById('moduleDepartment').value || null,
            type: document.getElementById('moduleType').value || 'step',
            size: document.getElementById('moduleSize').value || 'medium',
            isImplemented: implementedCheckbox ? implementedCheckbox.checked : false
        };

        if (!moduleData.name) {
            showToast('Module name is required', 'error');
            return;
        }

        if (editId) {
            // Update existing module
            updateCustomModule(editId, moduleData);
            showToast('Module updated', 'success');
        } else {
            // Add new module with default color
            moduleData.color = moduleData.isImplemented ? '#3ecf8e' : '#6b7280';
            // Include linkedModuleId if creating a sub-module
            if (linkedModuleId) {
                moduleData.linkedModuleId = linkedModuleId;
                console.log('[MODULE-SAVE] Creating sub-module linked to:', linkedModuleId);
            }
            addCustomModule(moduleData);
            showToast(linkedModuleId ? 'Sub-module added' : 'Module added', 'success');
        }

        closeModuleModal();
        renderTreeView();
    }

    function confirmDeleteModule() {
        const editId = document.getElementById('moduleEditId').value;
        if (editId) {
            confirmDeleteModuleById(editId);
        }
    }

    function confirmDeleteModuleById(moduleId) {
        const module = getCustomModule(moduleId);
        if (!module) return;

        if (confirm(`Are you sure you want to delete "${module.name}"?`)) {
            deleteCustomModule(moduleId);
            closeModuleModal();
            showToast('Module deleted', 'success');
            renderTreeView();
        }
    }

    function showContextMenu(e, moduleId) {
        console.log('[CONTEXT-MENU] showContextMenu called for module:', moduleId);
        e.preventDefault();
        e.stopPropagation();

        if (!elements.moduleContextMenu) {
            console.error('[CONTEXT-MENU] moduleContextMenu element not found!');
            return;
        }

        // Update toggle label based on current connection state
        const module = getCustomModule(moduleId);
        console.log('[CONTEXT-MENU] Module found:', module);
        const toggleLabel = document.getElementById('toggleConnectionLabel');
        if (toggleLabel && module) {
            const isConnected = module.connectedToHub !== false; // Default to true
            toggleLabel.textContent = isConnected ? 'Disconnect from Hub' : 'Connect to Hub';
        }

        elements.moduleContextMenu.dataset.moduleId = moduleId;
        elements.moduleContextMenu.style.left = `${e.clientX}px`;
        elements.moduleContextMenu.style.top = `${e.clientY}px`;
        elements.moduleContextMenu.classList.remove('hidden');
        console.log('[CONTEXT-MENU] Context menu shown at:', e.clientX, e.clientY);
    }

    function hideContextMenu() {
        if (elements.moduleContextMenu) {
            elements.moduleContextMenu.classList.add('hidden');
        }
        if (elements.flowNodeContextMenu) {
            elements.flowNodeContextMenu.classList.add('hidden');
        }
    }

    function showFlowNodeContextMenu(e, nodeId, processId) {
        console.log('[CONTEXT-MENU] showFlowNodeContextMenu called for node:', nodeId, 'process:', processId);
        e.preventDefault();
        e.stopPropagation();

        if (!elements.flowNodeContextMenu) {
            console.error('[CONTEXT-MENU] flowNodeContextMenu element not found!');
            return;
        }

        // Store context for actions
        elements.flowNodeContextMenu.dataset.nodeId = nodeId;
        elements.flowNodeContextMenu.dataset.processId = processId;

        elements.flowNodeContextMenu.style.left = `${e.clientX}px`;
        elements.flowNodeContextMenu.style.top = `${e.clientY}px`;
        elements.flowNodeContextMenu.classList.remove('hidden');
        console.log('[CONTEXT-MENU] Flow node context menu shown at:', e.clientX, e.clientY);
    }

    function setupFlowNodeContextMenu() {
        if (!elements.flowNodeContextMenu) return;

        elements.flowNodeContextMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (!item) return;

            const action = item.dataset.action;
            const nodeId = elements.flowNodeContextMenu.dataset.nodeId;
            const processId = elements.flowNodeContextMenu.dataset.processId;

            console.log('[CONTEXT-MENU] Flow node action:', action, 'nodeId:', nodeId, 'processId:', processId);

            switch (action) {
                case 'edit-node':
                    // TODO: Open node editor modal
                    showToast('Edit node functionality coming soon', 'info');
                    break;
                case 'add-connection':
                    // TODO: Start connection drag mode
                    showToast('Add connection functionality coming soon', 'info');
                    break;
                case 'duplicate-node':
                    // TODO: Duplicate the node
                    showToast('Duplicate node functionality coming soon', 'info');
                    break;
                case 'delete-node':
                    // TODO: Delete the node with confirmation
                    showToast('Delete node functionality coming soon', 'info');
                    break;
            }
            hideContextMenu();
        });
    }

    // ================================
    // Data Loading
    // ================================
    async function loadProcesses() {
        try {
            const res = await fetch(`${API_BASE}/processes?include_implemented=true&include_drafts=true`);

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            state.processes = data.processes || [];

            console.log('[PROCESS-MANAGER] Loaded', state.processes.length, 'processes');
            console.log('[PROCESS-MANAGER]', data.implemented_count, 'implemented,', data.draft_count, 'drafts');

        } catch (err) {
            console.error('[PROCESS-MANAGER] Error loading processes:', err);
            // Use mock data for development
            state.processes = generateMockProcesses();
        }
    }

    function generateMockProcesses() {
        // Mock data matching actual @process annotations in API codebase
        return [
            // ==================== BOOKKEEPING ====================
            {
                id: 'COGS_Authorization',
                name: 'COGS Authorization Workflow',
                description: 'Automated workflow that creates tasks for authorizing pending COGS expenses by project',
                category: 'bookkeeping',
                trigger: 'scheduled',
                owner: 'Accounting Manager',
                steps: [
                    { number: 1, name: 'Query Pending Expenses', type: 'action', description: 'Fetch all expenses with auth_status=null or false from expenses_manual_COGS', connects_to: [2] },
                    { number: 2, name: 'Group by Project', type: 'action', description: 'Aggregate expenses count and total amount per project', connects_to: [3] },
                    { number: 3, name: 'Check Existing Tasks', type: 'condition', description: 'Verify if automation task already exists for each project', connects_to: [4, 5] },
                    { number: 4, name: 'Create New Task', type: 'action', description: 'Create task in Bookkeeping department for authorization', connects_to: [6] },
                    { number: 5, name: 'Update Existing Task', type: 'action', description: 'Update task notes with current pending count and amount', connects_to: [6] },
                    { number: 6, name: 'Notify Manager', type: 'notification', description: 'Task appears in manager\'s workflow for review', connects_to: [] },
                ],
                is_implemented: true,
                status: 'active',
                source_file: 'api/routers/pipeline.py',
                source_line: 912,
                services: ['supabase'],
            },
            {
                id: 'Expense_Categorization',
                name: 'Expense Categorization Workflow',
                description: 'Creates tasks for categorizing uncategorized expenses in projects',
                category: 'bookkeeping',
                trigger: 'scheduled',
                owner: 'Bookkeeper',
                steps: [
                    { number: 1, name: 'Query Uncategorized', type: 'action', description: 'Fetch expenses where expense_category is null or empty', connects_to: [2] },
                    { number: 2, name: 'Group by Project', type: 'action', description: 'Aggregate uncategorized expenses count per project', connects_to: [3] },
                    { number: 3, name: 'Check Task Exists', type: 'condition', description: 'Check if categorization task already exists for project', connects_to: [4, 5] },
                    { number: 4, name: 'Create Task', type: 'action', description: 'Create new task for expense categorization', connects_to: [6] },
                    { number: 5, name: 'Update Task', type: 'action', description: 'Update existing task with current count', connects_to: [6] },
                    { number: 6, name: 'Assign to Bookkeeper', type: 'assignment', description: 'Task assigned to bookkeeper for category assignment', connects_to: [] },
                ],
                is_implemented: true,
                status: 'active',
                source_file: 'api/routers/pipeline.py',
                source_line: 1164,
                services: ['supabase'],
            },
            {
                id: 'Receipt_Processing',
                name: 'Receipt Processing Workflow',
                description: 'Process uploaded receipts from project channels into expense entries',
                category: 'bookkeeping',
                trigger: 'event',
                owner: 'Bookkeeper',
                steps: [
                    { number: 1, name: 'Receipt Upload', type: 'event', description: 'User uploads receipt image/PDF to project channel', connects_to: [2] },
                    { number: 2, name: 'Store in Bucket', type: 'action', description: 'Save file to pending-expenses storage bucket', connects_to: [3] },
                    { number: 3, name: 'OCR Analysis', type: 'action', description: 'Extract vendor, amount, date using OpenAI Vision', connects_to: [4] },
                    { number: 4, name: 'Create Pending Record', type: 'action', description: 'Store extracted data in pending_receipts table', connects_to: [5] },
                    { number: 5, name: 'Await Review', type: 'wait', description: 'Receipt waits for bookkeeper review and approval', connects_to: [6, 7] },
                    { number: 6, name: 'Create Expense', type: 'action', description: 'Convert approved receipt into expenses_manual_COGS entry', connects_to: [] },
                    { number: 7, name: 'Reject Receipt', type: 'action', description: 'Mark receipt as rejected if invalid', connects_to: [] },
                ],
                is_implemented: true,
                status: 'active',
                source_file: 'api/routers/pending_receipts.py',
                source_line: 7,
                services: ['supabase', 'openai'],
            },
            {
                id: 'QBO_Reconciliation',
                name: 'QuickBooks Expense Reconciliation',
                description: 'Match manual COGS expenses with QuickBooks Online transactions for accounting reconciliation',
                category: 'bookkeeping',
                trigger: 'manual',
                owner: 'Accountant',
                steps: [
                    { number: 1, name: 'Load QBO Transactions', type: 'action', description: 'Fetch unreconciled transactions from QuickBooks for project', connects_to: [2] },
                    { number: 2, name: 'Load Manual Expenses', type: 'action', description: 'Get unreconciled manual COGS entries for matching', connects_to: [3] },
                    { number: 3, name: 'Match Expenses', type: 'condition', description: 'Compare amounts and dates to find matching pairs', connects_to: [4, 5] },
                    { number: 4, name: 'Create Link', type: 'action', description: 'Create reconciliation record linking QBO to manual expense', connects_to: [6] },
                    { number: 5, name: 'Flag Unmatched', type: 'notification', description: 'Alert accountant about expenses that couldn\'t be matched', connects_to: [6] },
                    { number: 6, name: 'Update Status', type: 'action', description: 'Mark both expenses as reconciled', connects_to: [] },
                ],
                is_implemented: true,
                status: 'active',
                source_file: 'api/routers/reconciliations.py',
                source_line: 1,
                services: ['supabase', 'quickbooks'],
            },

            // ==================== COORDINATION ====================
            {
                id: 'Project_Health_Check',
                name: 'Project Health Check Workflow',
                description: 'Automated health checks for active projects monitoring budget and expenses',
                category: 'coordination',
                trigger: 'scheduled',
                owner: 'Project Manager',
                steps: [
                    { number: 1, name: 'Get Active Projects', type: 'action', description: 'Query all projects with is_active=true', connects_to: [2] },
                    { number: 2, name: 'Calculate Expenses', type: 'action', description: 'Sum total expenses per project from COGS table', connects_to: [3] },
                    { number: 3, name: 'Check Budget Status', type: 'condition', description: 'Evaluate if budget remaining is below 20% threshold', connects_to: [4, 5] },
                    { number: 4, name: 'Create Alert Task', type: 'action', description: 'Create health check task for projects needing attention', connects_to: [6] },
                    { number: 5, name: 'Skip Healthy', type: 'action', description: 'No action needed for healthy projects', connects_to: [] },
                    { number: 6, name: 'Notify PM', type: 'notification', description: 'Project manager notified of health check task', connects_to: [] },
                ],
                is_implemented: true,
                status: 'active',
                source_file: 'api/routers/pipeline.py',
                source_line: 1355,
                services: ['supabase'],
            },

            // ==================== DRAFTS (Not yet implemented) ====================
            {
                id: 'DRAFT_invoice_automation',
                name: 'Automated Invoice Processing',
                description: 'Proposed workflow for automatically processing incoming invoices from email attachments.',
                category: 'bookkeeping',
                trigger: 'event',
                steps: [
                    { number: 1, name: 'Receive Email', type: 'event', description: 'Email with invoice attachment received', connects_to: [2] },
                    { number: 2, name: 'Extract Invoice Data', type: 'action', description: 'OCR and parse invoice details', connects_to: [3] },
                    { number: 3, name: 'Validate Data', type: 'condition', description: 'Check if all required fields are present', connects_to: [4, 5] },
                    { number: 4, name: 'Create Expense Entry', type: 'action', description: 'Create entry in expenses_manual_COGS', connects_to: [6] },
                    { number: 5, name: 'Flag for Review', type: 'notification', description: 'Notify accountant of validation issues', connects_to: [] },
                    { number: 6, name: 'Notify Accountant', type: 'notification', description: 'Send notification for authorization', connects_to: [] },
                ],
                is_implemented: false,
                status: 'draft',
                services: ['supabase', 'openai'],
            },
            {
                id: 'DRAFT_budget_alerts',
                name: 'Budget Threshold Alerts',
                description: 'Proposed workflow for automatic alerts when project budgets reach thresholds.',
                category: 'finance',
                trigger: 'scheduled',
                steps: [
                    { number: 1, name: 'Check Budget Usage', type: 'condition', description: 'Compare spent vs budget per project', connects_to: [2, 3] },
                    { number: 2, name: 'Send Warning', type: 'notification', description: 'Alert at 80% threshold', connects_to: [] },
                    { number: 3, name: 'Send Critical Alert', type: 'notification', description: 'Alert at 100% threshold', connects_to: [4] },
                    { number: 4, name: 'Lock Expenses', type: 'action', description: 'Require approval for new expenses', connects_to: [] },
                ],
                is_implemented: false,
                status: 'proposed',
                services: ['supabase', 'firebase'],
            },
        ];
    }

    // ================================
    // Navigation
    // ================================
    function navigateToDetail(groupId, groupType) {
        state.currentLevel = 'detail';
        state.selectedGroupId = groupId;
        state.selectedGroup = groupType === 'deliverable' ? DELIVERABLES[groupId] : DEPARTMENTS[groupId];

        // Check if this is a detailed module (like Expenses Engine)
        const isDetailedModule = state.selectedGroup?.isDetailedModule;

        // Filter processes for this group
        if (!isDetailedModule) {
            if (groupType === 'deliverable') {
                const deliverable = DELIVERABLES[groupId];
                state.filteredProcesses = state.processes.filter(p =>
                    deliverable.processIds.includes(p.id)
                );
            } else {
                state.filteredProcesses = state.processes.filter(p =>
                    p.category === groupId
                );
            }
        }

        // Update UI
        updateBreadcrumb();
        updateURL();
        elements.btnBack.classList.remove('hidden');
        elements.treeViewContainer.classList.add('hidden');
        elements.detailViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'none';
        elements.btnAddProcess.classList.toggle('hidden', isDetailedModule);
        document.body.classList.add('detail-active');

        // Render appropriate view
        if (isDetailedModule && groupId === 'expenses_engine') {
            renderExpensesEngineDetail();
        } else {
            renderDetailView();
        }
        centerCanvas();
    }

    function navigateBack() {
        // If in subprocess, go back to flowchart view
        if (state.currentLevel === 'subprocess') {
            state.currentLevel = 'flowchart';
            state.currentNodeId = null;

            updateBreadcrumb();
            updateURL();

            // Re-render flowchart view
            const flowchart = PROCESS_FLOWCHARTS[state.currentProcessId];
            if (flowchart) {
                renderFlowchart(flowchart);
            }
            centerCanvas();
            return;
        }

        // If in flowchart, go back to detail view
        if (state.currentLevel === 'flowchart') {
            state.currentLevel = 'detail';
            state.currentProcessId = null;
            state.selectedFlowNode = null;

            updateBreadcrumb();
            updateURL();
            elements.btnBack.classList.remove('hidden');

            // Re-render detail view
            if (state.selectedGroupId) {
                const group = PROCESS_GROUPS.find(g => g.id === state.selectedGroupId);
                if (group && group.isDetailedModule) {
                    renderExpensesEngineDetail();
                } else {
                    renderDetailView();
                }
            }
            centerCanvas();
            return;
        }

        // Otherwise go back to tree
        navigateToTree();
    }

    function navigateToTree() {
        state.currentLevel = 'tree';
        state.selectedGroupId = null;
        state.selectedGroup = null;
        state.selectedModule = null;
        state.filteredProcesses = [];
        state.currentProcessId = null;
        state.currentNodeId = null;

        // Update UI
        updateBreadcrumb();
        updateURL();
        elements.btnBack.classList.add('hidden');
        elements.detailViewContainer.classList.add('hidden');
        elements.treeViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'flex';
        elements.btnAddProcess.classList.add('hidden');
        document.body.classList.remove('detail-active');

        closePanel();
        renderTreeView();
        centerCanvas();
    }

    function navigateToModuleDetail(moduleId) {
        const module = getCustomModule(moduleId);
        if (!module) return;

        state.currentLevel = 'detail';
        state.selectedGroupId = moduleId;
        state.selectedModule = module;

        // Update UI
        updateBreadcrumb();
        updateURL();
        elements.btnBack.classList.remove('hidden');
        elements.treeViewContainer.classList.add('hidden');
        elements.detailViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'none';
        elements.btnAddProcess.classList.remove('hidden');
        document.body.classList.add('detail-active');

        // Render module detail view (flowchart editor)
        renderModuleDetailView(module);
        centerCanvas();
    }

    function renderModuleDetailView(module) {
        if (!elements.detailViewContainer) return;

        elements.detailViewContainer.innerHTML = '';

        // Get linked processes
        const linkedProcessIds = module.linkedProcesses || [];
        const linkedProcesses = linkedProcessIds
            .map(pid => state.processes.find(p => p.id === pid))
            .filter(Boolean);

        // Create module header card
        const headerCard = document.createElement('div');
        headerCard.className = 'module-detail-header';
        headerCard.innerHTML = `
            <div class="module-detail-icon" style="background: ${module.color || '#3ecf8e'}20; border-color: ${module.color || '#3ecf8e'};">
                ${getIconSvg(module.icon || 'box', module.color || '#3ecf8e')}
            </div>
            <div class="module-detail-info">
                <h2 class="module-detail-title">${escapeHtml(module.name)}</h2>
                <p class="module-detail-description">${escapeHtml(module.description || 'No description')}</p>
                <div class="module-detail-meta">
                    <span class="module-status-badge ${module.isImplemented ? 'live' : 'draft'}">
                        ${module.isImplemented ? 'LIVE' : 'DRAFT'}
                    </span>
                    <span class="module-type-badge">${module.type || 'step'}</span>
                    <span class="module-process-count">${linkedProcesses.length} processes</span>
                </div>
            </div>
            <div class="module-detail-actions">
                <button type="button" class="btn-module-edit" onclick="window.processManager?.openEditModuleModal('${module.id}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                </button>
            </div>
        `;
        headerCard.style.cssText = `
            position: absolute;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #1a1a1a 0%, #151515 100%);
            border: 1px solid #2a2a2a;
            border-radius: 16px;
            padding: 24px 32px;
            display: flex;
            align-items: center;
            gap: 20px;
            min-width: 500px;
            max-width: 700px;
            z-index: 10;
        `;

        elements.detailViewContainer.appendChild(headerCard);

        // Create processes container
        const processesContainer = document.createElement('div');
        processesContainer.className = 'module-processes-container';
        processesContainer.style.cssText = `
            position: absolute;
            top: 180px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 900px;
        `;

        if (linkedProcesses.length > 0) {
            // Show linked processes as cards
            let processesHtml = `
                <div class="linked-processes-header">
                    <h3>Linked Processes</h3>
                    <button type="button" class="btn-add-process-link" id="btnAddProcessLink">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Link Process
                    </button>
                </div>
                <div class="linked-processes-grid">
            `;

            linkedProcesses.forEach(process => {
                const statusClass = process.is_implemented ? 'implemented' : 'draft';
                processesHtml += `
                    <div class="linked-process-card ${statusClass}" data-process-id="${process.id}">
                        <div class="linked-process-status"></div>
                        <div class="linked-process-info">
                            <div class="linked-process-name">${escapeHtml(process.name)}</div>
                            <div class="linked-process-id">${escapeHtml(process.id)}</div>
                            ${process.trigger ? `<div class="linked-process-trigger">${escapeHtml(process.trigger)}</div>` : ''}
                        </div>
                        <div class="linked-process-actions">
                            <button type="button" class="btn-unlink-process" title="Unlink process"
                                onclick="event.stopPropagation(); window.processManager?.unlinkProcessFromModule('${process.id}', '${module.id}')">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            });

            processesHtml += '</div>';
            processesContainer.innerHTML = processesHtml;

            // Add click handlers to process cards
            setTimeout(() => {
                processesContainer.querySelectorAll('.linked-process-card').forEach(card => {
                    card.addEventListener('click', () => {
                        const processId = card.dataset.processId;
                        // TODO: Navigate to process flowchart view
                        showToast(`Opening process ${processId}...`, 'info');
                    });
                });

                // Add process link button handler
                const btnAddLink = processesContainer.querySelector('#btnAddProcessLink');
                if (btnAddLink) {
                    btnAddLink.addEventListener('click', () => showLinkProcessModal(module.id));
                }
            }, 0);
        } else {
            // Show empty state with option to link processes
            processesContainer.innerHTML = `
                <div class="module-processes-empty">
                    <div class="empty-processes-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                            <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"></path>
                        </svg>
                    </div>
                    <h3 class="empty-processes-title">No Processes Linked</h3>
                    <p class="empty-processes-subtitle">Link processes from the navigator to this module</p>
                    <button type="button" class="btn-link-first-process" id="btnLinkFirstProcess">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Link a Process
                    </button>
                </div>
            `;

            setTimeout(() => {
                const btn = processesContainer.querySelector('#btnLinkFirstProcess');
                if (btn) {
                    btn.addEventListener('click', () => showLinkProcessModal(module.id));
                }
            }, 0);
        }

        elements.detailViewContainer.appendChild(processesContainer);
    }

    function showLinkProcessModal(moduleId) {
        const module = getCustomModule(moduleId);
        if (!module) return;

        const linkedIds = module.linkedProcesses || [];
        const availableProcesses = state.processes.filter(p => !linkedIds.includes(p.id));

        if (availableProcesses.length === 0) {
            showToast('All processes are already linked to modules', 'info');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'link-process-modal';
        modal.innerHTML = `
            <div class="link-process-modal-content">
                <div class="link-process-modal-header">
                    <h3>Link Process to ${escapeHtml(module.name)}</h3>
                    <button type="button" class="btn-close-modal">&times;</button>
                </div>
                <div class="link-process-modal-search">
                    <input type="text" placeholder="Search processes..." class="link-process-search-input" />
                </div>
                <div class="link-process-modal-list">
                    ${availableProcesses.map(p => `
                        <div class="link-process-option" data-process-id="${p.id}">
                            <div class="link-process-option-status ${p.is_implemented ? 'implemented' : 'draft'}"></div>
                            <div class="link-process-option-info">
                                <div class="link-process-option-name">${escapeHtml(p.name)}</div>
                                <div class="link-process-option-id">${escapeHtml(p.id)}</div>
                            </div>
                            <div class="link-process-option-category">${escapeHtml(p.category || '')}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        const closeBtn = modal.querySelector('.btn-close-modal');
        const searchInput = modal.querySelector('.link-process-search-input');
        const optionsList = modal.querySelector('.link-process-modal-list');

        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            optionsList.querySelectorAll('.link-process-option').forEach(opt => {
                const name = opt.querySelector('.link-process-option-name').textContent.toLowerCase();
                const id = opt.querySelector('.link-process-option-id').textContent.toLowerCase();
                opt.style.display = (name.includes(term) || id.includes(term)) ? 'flex' : 'none';
            });
        });

        optionsList.querySelectorAll('.link-process-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const processId = opt.dataset.processId;
                linkProcessToModule(processId, moduleId);
                modal.remove();
            });
        });
    }

    function navigateToSubProcess(nodeId) {
        const flowchart = PROCESS_FLOWCHARTS[state.currentProcessId];
        if (!flowchart) return;

        const node = flowchart.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Check if node has a sub-process defined
        if (!node.subProcess && !node.subProcessNodes) {
            console.log('[PROCESS-MANAGER] Node has no sub-process defined:', nodeId);
            showToast('This node has no sub-process defined', 'info');
            return;
        }

        state.currentLevel = 'subprocess';
        state.currentNodeId = nodeId;

        updateBreadcrumb();
        updateURL();

        // Render the sub-process view
        renderSubProcessView(node);
        centerCanvas();
    }

    // ================================
    // URL Routing for Shareable Links
    // ================================
    function setupURLRouting() {
        // Listen for browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state) {
                restoreStateFromURL(e.state);
            } else {
                handleURLNavigation();
            }
        });
    }

    function updateURL() {
        const params = new URLSearchParams();

        if (state.currentLevel !== 'tree') {
            params.set('level', state.currentLevel);
        }
        if (state.selectedGroupId) {
            params.set('group', state.selectedGroupId);
        }
        if (state.currentProcessId) {
            params.set('process', state.currentProcessId);
        }
        if (state.currentNodeId) {
            params.set('node', state.currentNodeId);
        }
        if (state.groupBy !== 'deliverable') {
            params.set('groupBy', state.groupBy);
        }

        const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;

        // Use replaceState to avoid cluttering history, pushState for actual navigation
        const historyState = {
            level: state.currentLevel,
            groupId: state.selectedGroupId,
            processId: state.currentProcessId,
            nodeId: state.currentNodeId,
            groupBy: state.groupBy
        };

        window.history.pushState(historyState, '', newURL);
    }

    function handleURLNavigation() {
        const params = new URLSearchParams(window.location.search);

        const level = params.get('level');
        const groupId = params.get('group');
        const processId = params.get('process');
        const nodeId = params.get('node');
        const groupBy = params.get('groupBy');

        if (groupBy) {
            state.groupBy = groupBy;
        }

        if (!level || level === 'tree') {
            // Already at tree view, just render
            return;
        }

        if (level === 'detail' && groupId) {
            // Navigate to detail view
            setTimeout(() => {
                navigateToDetail(groupId, state.groupBy);
            }, 100);
        } else if (level === 'flowchart' && processId) {
            // Navigate to flowchart view
            setTimeout(() => {
                if (groupId) {
                    state.selectedGroupId = groupId;
                    const group = PROCESS_GROUPS.find(g => g.id === groupId);
                    state.selectedGroup = group;
                }
                navigateToFlowchart(processId);
            }, 100);
        } else if (level === 'subprocess' && processId && nodeId) {
            // Navigate to subprocess view
            setTimeout(() => {
                if (groupId) {
                    state.selectedGroupId = groupId;
                    const group = PROCESS_GROUPS.find(g => g.id === groupId);
                    state.selectedGroup = group;
                }
                state.currentProcessId = processId;
                state.currentLevel = 'flowchart';
                navigateToSubProcess(nodeId);
            }, 100);
        }
    }

    function restoreStateFromURL(historyState) {
        if (!historyState) return;

        const { level, groupId, processId, nodeId, groupBy } = historyState;

        if (groupBy) state.groupBy = groupBy;

        if (level === 'tree' || !level) {
            navigateToTree();
        } else if (level === 'detail' && groupId) {
            navigateToDetail(groupId, state.groupBy);
        } else if (level === 'flowchart' && processId) {
            if (groupId) {
                state.selectedGroupId = groupId;
                const group = PROCESS_GROUPS.find(g => g.id === groupId);
                state.selectedGroup = group;
            }
            navigateToFlowchart(processId);
        } else if (level === 'subprocess' && processId && nodeId) {
            if (groupId) {
                state.selectedGroupId = groupId;
                const group = PROCESS_GROUPS.find(g => g.id === groupId);
                state.selectedGroup = group;
            }
            state.currentProcessId = processId;
            navigateToSubProcess(nodeId);
        }
    }

    function getShareableURL() {
        return window.location.href;
    }

    function updateBreadcrumb() {
        if (!elements.processBreadcrumb) return;

        const iconOverview = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>`;

        if (state.currentLevel === 'tree') {
            elements.processBreadcrumb.innerHTML = `
                <span class="breadcrumb-item active" data-level="tree">
                    ${iconOverview}
                    Overview
                </span>
            `;
        } else if (state.currentLevel === 'flowchart') {
            const group = state.selectedGroup;
            const flowchart = PROCESS_FLOWCHARTS[state.currentProcessId];
            elements.processBreadcrumb.innerHTML = `
                <span class="breadcrumb-item clickable" data-level="tree">
                    ${iconOverview}
                    Overview
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item clickable" data-level="detail">
                    ${group?.name || 'Module'}
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item active" data-level="flowchart">
                    ${flowchart?.name || 'Process'}
                </span>
            `;

            // Click handlers
            const overviewItem = elements.processBreadcrumb.querySelector('[data-level="tree"]');
            const detailItem = elements.processBreadcrumb.querySelector('[data-level="detail"]');
            if (overviewItem) {
                overviewItem.style.cursor = 'pointer';
                overviewItem.addEventListener('click', () => {
                    state.currentLevel = 'flowchart'; // Will trigger back to detail then tree
                    navigateBack();
                    navigateBack();
                });
            }
            if (detailItem) {
                detailItem.style.cursor = 'pointer';
                detailItem.addEventListener('click', navigateBack);
            }
        } else if (state.currentLevel === 'subprocess') {
            const group = state.selectedGroup;
            const flowchart = PROCESS_FLOWCHARTS[state.currentProcessId];
            const currentNode = flowchart?.nodes?.find(n => n.id === state.currentNodeId);
            elements.processBreadcrumb.innerHTML = `
                <span class="breadcrumb-item clickable" data-level="tree">
                    ${iconOverview}
                    Overview
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item clickable" data-level="detail">
                    ${group?.name || 'Module'}
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item clickable" data-level="flowchart">
                    ${flowchart?.name || 'Process'}
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item active" data-level="subprocess">
                    ${currentNode?.name || 'Sub-process'}
                </span>
            `;

            // Click handlers
            const overviewItem = elements.processBreadcrumb.querySelector('[data-level="tree"]');
            const detailItem = elements.processBreadcrumb.querySelector('[data-level="detail"]');
            const flowchartItem = elements.processBreadcrumb.querySelector('[data-level="flowchart"]');
            if (overviewItem) {
                overviewItem.style.cursor = 'pointer';
                overviewItem.addEventListener('click', () => {
                    navigateToTree();
                });
            }
            if (detailItem) {
                detailItem.style.cursor = 'pointer';
                detailItem.addEventListener('click', () => {
                    navigateToDetail(state.selectedGroupId, state.groupBy);
                });
            }
            if (flowchartItem) {
                flowchartItem.style.cursor = 'pointer';
                flowchartItem.addEventListener('click', navigateBack);
            }
        } else {
            // Detail view - could be old group or custom module
            const group = state.selectedGroup;
            const module = state.selectedModule;
            const name = module?.name || group?.name || 'Detail';

            elements.processBreadcrumb.innerHTML = `
                <span class="breadcrumb-item clickable" data-level="tree">
                    ${iconOverview}
                    Overview
                </span>
                <span class="breadcrumb-separator">></span>
                <span class="breadcrumb-item active" data-level="detail">
                    ${escapeHtml(name)}
                </span>
            `;

            // Click handler to go back
            const overviewItem = elements.processBreadcrumb.querySelector('[data-level="tree"]');
            if (overviewItem) {
                overviewItem.style.cursor = 'pointer';
                overviewItem.addEventListener('click', navigateBack);
            }
        }
    }

    // ================================
    // Tree View Rendering
    // ================================
    function renderTreeView() {
        if (!elements.treeViewContainer) return;

        elements.treeViewContainer.innerHTML = '';
        clearConnections();

        // Hide empty state in tree view - we always have the hub
        if (elements.canvasEmpty) {
            elements.canvasEmpty.style.display = 'none';
        }

        // Default positions - radial layout around hub
        const defaultCenterX = 600;
        const defaultCenterY = 400;
        const defaultRadius = 320;

        // Hub position (can be dragged too) - offset to center the larger hub
        const hubPos = getNodePosition('hub', defaultCenterX - 160, defaultCenterY - 100);

        // Render central hub
        const hubNode = createTreeNode({
            id: 'hub',
            name: 'NGM Hub',
            description: 'Process Automation System',
            icon: 'hub',
            color: '#3ecf8e',
            isCentral: true
        }, hubPos.x, hubPos.y);

        // Add drag functionality to hub
        makeDraggable(hubNode, 'hub');
        elements.treeViewContainer.appendChild(hubNode);

        // Store node positions for connection drawing
        const nodeRects = {
            hub: { x: hubPos.x, y: hubPos.y, width: 320, height: 200 }
        };

        // Render custom modules around the hub (radial layout)
        const moduleCount = state.customModules.length;
        state.customModules.forEach((module, index) => {
            // Position in radial layout around hub
            const angle = (index / Math.max(moduleCount, 1)) * Math.PI * 2 - Math.PI / 2;
            const defaultX = defaultCenterX + Math.cos(angle) * defaultRadius - 110;
            const defaultY = defaultCenterY + Math.sin(angle) * defaultRadius - 70;

            const pos = getNodePosition(module.id, defaultX, defaultY);

            const customNode = createCustomModuleNode(module, pos.x, pos.y);

            // Store for connections - use fixed dimensions based on size
            const moduleDimensions = getModuleDimensions(module.size);
            nodeRects[module.id] = {
                x: pos.x,
                y: pos.y,
                width: moduleDimensions.width,
                height: moduleDimensions.height,
                isCustom: true,
                isImplemented: module.isImplemented
            };

            // Add drag functionality
            makeDraggable(customNode, module.id, () => {
                redrawConnections(nodeRects);
            });

            // Right-click context menu for custom modules
            customNode.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e, module.id);
            });

            // Double-click to edit
            customNode.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                openEditModuleModal(module.id);
            });

            // Single click to navigate into module detail (with drag protection)
            customNode.addEventListener('click', (e) => {
                // Don't navigate if we just finished dragging
                if (customNode.classList.contains('was-dragged')) return;
                // Don't navigate if clicking on a port
                if (e.target.closest('.connection-port')) return;
                // Don't navigate if in connection mode
                if (state.connectionMode.active) return;

                navigateToModuleDetail(module.id);
            });

            elements.treeViewContainer.appendChild(customNode);
        });

        // Draw orthogonal connections
        redrawConnections(nodeRects);

        // Update stats (live/draft counts)
        updateStats();
    }

    function createCustomModuleNode(module, x, y) {
        const node = document.createElement('div');
        const statusClass = module.isImplemented ? 'is-implemented' : 'is-draft';
        const typeClass = module.type ? `type-${module.type}` : 'type-step';
        const sizeClass = module.size ? `size-${module.size}` : 'size-medium';
        node.className = `tree-node custom-module ${statusClass} ${typeClass} ${sizeClass}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.id = module.id;

        const iconSvg = getIconSvg(module.icon, module.color);
        const statusLabel = module.isImplemented ? 'LIVE' : 'DRAFT';

        // Get department name if assigned
        let departmentName = '';
        if (module.departmentId) {
            const dept = state.departments.find(d => d.department_id === module.departmentId);
            departmentName = dept ? dept.department_name : '';
        }

        node.innerHTML = `
            <!-- Connection Ports (discreet, shown on hover) -->
            <div class="connection-port port-top" data-port="top" data-node="${module.id}"></div>
            <div class="connection-port port-right" data-port="right" data-node="${module.id}"></div>
            <div class="connection-port port-bottom" data-port="bottom" data-node="${module.id}"></div>
            <div class="connection-port port-left" data-port="left" data-node="${module.id}"></div>

            <div class="tree-node-badge">${statusLabel}</div>
            <div class="tree-node-icon" style="background: ${module.color}20; border-color: ${module.color};">
                ${iconSvg}
            </div>
            <div class="tree-node-title">${escapeHtml(module.name)}</div>
            <div class="tree-node-subtitle">${escapeHtml(module.description || 'Custom module')}</div>
            <div class="tree-node-stats">
                <span class="tree-node-stat" style="color: ${module.isImplemented ? '#3ecf8e' : '#6b7280'};">
                    <span class="stat-dot" style="background: ${module.isImplemented ? '#3ecf8e' : '#6b7280'};"></span>
                    ${module.isImplemented ? 'Implemented' : 'Draft'}
                </span>
                ${departmentName ? `
                <span class="tree-node-stat" style="color: #9ca3af;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle;">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${escapeHtml(departmentName)}
                </span>
                ` : ''}
            </div>
        `;

        return node;
    }

    function redrawConnections(nodeRects) {
        clearConnections();

        // Get actual node dimensions from DOM elements
        const actualRects = getActualNodeRects(nodeRects);

        const hubRect = actualRects.hub;
        if (!hubRect) return;

        const hubCenterX = hubRect.x + hubRect.width / 2;
        const hubCenterY = hubRect.y + hubRect.height / 2;

        // Draw connections for custom modules only
        state.customModules.forEach((module) => {
            // Skip if module is not connected to hub
            if (module.connectedToHub === false) return;

            const rect = actualRects[module.id];
            if (!rect) return;

            const nodeCenterX = rect.x + rect.width / 2;
            const nodeCenterY = rect.y + rect.height / 2;

            const points = calculateOrthogonalPath(
                hubRect, rect, hubCenterX, hubCenterY, nodeCenterX, nodeCenterY
            );

            // Use gray for drafts, green for implemented
            const connectionColor = module.isImplemented ? '#3ecf8e' : '#6b7280';
            const isDraft = !module.isImplemented;
            const connection = createOrthogonalConnection(points, connectionColor, isDraft, `hub-${module.id}`);
            elements.connectionsLayer.appendChild(connection);
        });

        // Draw connection preview line if in connection mode
        if (state.connectionMode.active && state.connectionMode.sourceRect) {
            drawConnectionPreview();
        }

        // Update minimap after redrawing connections
        updateMinimap();
    }

    // Get actual rendered dimensions of nodes from DOM
    function getActualNodeRects(fallbackRects) {
        const actualRects = {};

        Object.keys(fallbackRects).forEach(nodeId => {
            const nodeEl = elements.treeViewContainer.querySelector(`[data-id="${nodeId}"]`);
            if (nodeEl) {
                const x = parseInt(nodeEl.style.left) || fallbackRects[nodeId].x;
                const y = parseInt(nodeEl.style.top) || fallbackRects[nodeId].y;
                // Use actual rendered dimensions
                const width = nodeEl.offsetWidth || fallbackRects[nodeId].width;
                const height = nodeEl.offsetHeight || fallbackRects[nodeId].height;
                actualRects[nodeId] = {
                    x, y, width, height,
                    isCustom: fallbackRects[nodeId].isCustom,
                    isImplemented: fallbackRects[nodeId].isImplemented
                };
            } else {
                actualRects[nodeId] = fallbackRects[nodeId];
            }
        });

        return actualRects;
    }

    function calculateOrthogonalPath(hubRect, nodeRect, hubCX, hubCY, nodeCX, nodeCY) {
        // Calculate best edge points for orthogonal connection
        const dx = nodeCX - hubCX;
        const dy = nodeCY - hubCY;

        let fromX, fromY, toX, toY;

        // Determine which side of hub to exit from
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal dominant
            if (dx > 0) {
                // Node is to the right
                fromX = hubRect.x + hubRect.width;
                fromY = hubCY;
                toX = nodeRect.x;
                toY = nodeCY;
            } else {
                // Node is to the left
                fromX = hubRect.x;
                fromY = hubCY;
                toX = nodeRect.x + nodeRect.width;
                toY = nodeCY;
            }
        } else {
            // Vertical dominant
            if (dy > 0) {
                // Node is below
                fromX = hubCX;
                fromY = hubRect.y + hubRect.height;
                toX = nodeCX;
                toY = nodeRect.y;
            } else {
                // Node is above
                fromX = hubCX;
                fromY = hubRect.y;
                toX = nodeCX;
                toY = nodeRect.y + nodeRect.height;
            }
        }

        // Calculate midpoint for orthogonal routing
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;

        // Return path points for L-shaped or Z-shaped connection
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal route with vertical segment in middle
            return [
                { x: fromX, y: fromY },
                { x: midX, y: fromY },
                { x: midX, y: toY },
                { x: toX, y: toY }
            ];
        } else {
            // Vertical route with horizontal segment in middle
            return [
                { x: fromX, y: fromY },
                { x: fromX, y: midY },
                { x: toX, y: midY },
                { x: toX, y: toY }
            ];
        }
    }

    function createOrthogonalConnection(points, color = '#3ecf8e', isDraft = false, connectionId = null) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'connection-group');
        if (connectionId) {
            g.setAttribute('data-connection-id', connectionId);
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Build SVG path with rounded corners
        let d = `M ${points[0].x} ${points[0].y}`;
        const cornerRadius = 12;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const next = points[i + 1];

            if (next && i < points.length - 1) {
                // Calculate corner
                const dx1 = curr.x - prev.x;
                const dy1 = curr.y - prev.y;
                const dx2 = next.x - curr.x;
                const dy2 = next.y - curr.y;

                // Normalize and apply radius
                const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                if (len1 > 0 && len2 > 0) {
                    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

                    const startX = curr.x - (dx1 / len1) * r;
                    const startY = curr.y - (dy1 / len1) * r;
                    const endX = curr.x + (dx2 / len2) * r;
                    const endY = curr.y + (dy2 / len2) * r;

                    d += ` L ${startX} ${startY}`;
                    d += ` Q ${curr.x} ${curr.y} ${endX} ${endY}`;
                } else {
                    d += ` L ${curr.x} ${curr.y}`;
                }
            } else {
                d += ` L ${curr.x} ${curr.y}`;
            }
        }

        path.setAttribute('d', d);

        // Apply different styles for draft vs implemented modules
        const statusClass = isDraft ? 'module-draft' : 'module-implemented';
        path.setAttribute('class', `connection-path orthogonal ${statusClass}${isDraft ? '' : ' animated'}`);
        path.setAttribute('stroke', color);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-width', '2');

        if (isDraft) {
            path.setAttribute('stroke-dasharray', '8 4');
        }

        g.appendChild(path);

        // Small endpoint markers (discreet, match line color)
        const endpointRadius = 4;
        const endpointColor = isDraft ? '#6b7280' : color;

        // Start endpoint (at hub)
        const startEndpoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startEndpoint.setAttribute('cx', points[0].x);
        startEndpoint.setAttribute('cy', points[0].y);
        startEndpoint.setAttribute('r', endpointRadius);
        startEndpoint.setAttribute('fill', endpointColor);
        startEndpoint.setAttribute('class', 'connection-endpoint-inner');
        g.appendChild(startEndpoint);

        // End endpoint (at target node)
        const endEndpoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endEndpoint.setAttribute('cx', points[points.length - 1].x);
        endEndpoint.setAttribute('cy', points[points.length - 1].y);
        endEndpoint.setAttribute('r', endpointRadius);
        endEndpoint.setAttribute('fill', endpointColor);
        endEndpoint.setAttribute('class', 'connection-endpoint-inner');
        g.appendChild(endEndpoint);

        return g;
    }

    function makeDraggable(node, nodeId, onDragEnd) {
        let isDragging = false;
        let startX, startY;
        let initialX, initialY;
        let hasMoved = false;
        let initialPositions = {}; // Store initial positions for multi-select drag

        node.addEventListener('mousedown', (e) => {
            // Don't start drag if in connection mode
            if (state.connectionMode.active) return;
            if (e.button !== 0) return;
            e.preventDefault();

            // Handle Ctrl+click for adding to selection
            if (e.ctrlKey || e.shiftKey) {
                toggleModuleSelection(nodeId);
                return;
            }

            // If this node is not selected and we have selections, clear them
            if (!state.selectedModules.includes(nodeId) && state.selectedModules.length > 0) {
                clearModuleSelection();
            }

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(node.style.left) || 0;
            initialY = parseInt(node.style.top) || 0;

            // Store initial positions of all selected modules for group drag
            initialPositions = {};
            if (state.selectedModules.length > 0 && state.selectedModules.includes(nodeId)) {
                state.selectedModules.forEach(id => {
                    const el = elements.treeViewContainer.querySelector(`[data-id="${id}"]`);
                    if (el) {
                        initialPositions[id] = {
                            x: parseInt(el.style.left) || 0,
                            y: parseInt(el.style.top) || 0
                        };
                    }
                });
            }

            node.style.cursor = 'grabbing';
            node.style.zIndex = '100';
            node.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = (e.clientX - startX) / state.canvas.scale;
            const dy = (e.clientY - startY) / state.canvas.scale;

            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved = true;
            }

            let newX = initialX + dx;
            let newY = initialY + dy;

            // Get node dimensions for snap calculation
            const nodeWidth = node.offsetWidth || 220;
            const nodeHeight = node.offsetHeight || 150;

            // Calculate snap alignment (only for single node drag)
            let snapDx = 0, snapDy = 0;
            if (Object.keys(initialPositions).length === 0) {
                const snap = calculateSnap(nodeId, newX, newY, nodeWidth, nodeHeight);

                // Apply snap if detected
                if (snap.snapX !== null) {
                    snapDx = snap.snapX - newX;
                    newX = snap.snapX;
                }
                if (snap.snapY !== null) {
                    snapDy = snap.snapY - newY;
                    newY = snap.snapY;
                }

                // Show/hide snap guides and snapping class
                if (snap.guides.length > 0) {
                    renderSnapGuides(snap.guides);
                    node.classList.add('snapping');
                } else {
                    clearSnapGuides();
                    node.classList.remove('snapping');
                }
            } else {
                clearSnapGuides();
            }

            node.style.left = `${newX}px`;
            node.style.top = `${newY}px`;

            // Move all selected modules together (if this is a group drag)
            if (Object.keys(initialPositions).length > 0) {
                Object.entries(initialPositions).forEach(([id, pos]) => {
                    if (id === nodeId) return; // Already moved the main node
                    const el = elements.treeViewContainer.querySelector(`[data-id="${id}"]`);
                    if (el) {
                        el.style.left = `${pos.x + dx + snapDx}px`;
                        el.style.top = `${pos.y + dy + snapDy}px`;
                    }
                });
            }

            // Update nodeRects and redraw connections in real-time
            const nodeRects = buildCurrentNodeRects();
            redrawConnections(nodeRects);
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;

            isDragging = false;
            node.style.cursor = 'grab';
            node.style.zIndex = '';
            node.classList.remove('dragging');
            node.classList.remove('snapping');
            clearSnapGuides();

            if (hasMoved) {
                node.classList.add('was-dragged');

                // Save position of main node
                const newX = parseInt(node.style.left) || 0;
                const newY = parseInt(node.style.top) || 0;
                setNodePosition(nodeId, newX, newY);

                // Save positions of all selected nodes (if group drag)
                if (Object.keys(initialPositions).length > 0) {
                    Object.keys(initialPositions).forEach(id => {
                        if (id === nodeId) return;
                        const el = elements.treeViewContainer.querySelector(`[data-id="${id}"]`);
                        if (el) {
                            const x = parseInt(el.style.left) || 0;
                            const y = parseInt(el.style.top) || 0;
                            setNodePosition(id, x, y);
                        }
                    });
                }

                if (onDragEnd) onDragEnd();

                // Remove was-dragged after 200ms to prevent accidental navigation
                setTimeout(() => {
                    node.classList.remove('was-dragged');
                }, 200);
            }

            initialPositions = {};
        });
    }

    // Build nodeRects from current DOM state
    function buildCurrentNodeRects() {
        const nodeRects = { hub: getHubRect() };

        // Add all custom modules with fixed dimensions based on size
        state.customModules.forEach(module => {
            const el = elements.treeViewContainer.querySelector(`[data-id="${module.id}"]`);
            if (el) {
                const dims = getModuleDimensions(module.size);
                nodeRects[module.id] = {
                    x: parseInt(el.style.left) || 0,
                    y: parseInt(el.style.top) || 0,
                    width: el.offsetWidth || dims.width,
                    height: el.offsetHeight || dims.height,
                    isCustom: true,
                    isImplemented: module.isImplemented
                };
            }
        });

        return nodeRects;
    }

    // Get fixed dimensions based on module size setting
    function getModuleDimensions(size) {
        switch (size) {
            case 'large':
                return { width: 280, height: 180 };
            case 'small':
                return { width: 160, height: 120 };
            case 'medium':
            default:
                return { width: 220, height: 150 };
        }
    }

    function getHubRect() {
        const hubNode = elements.treeViewContainer.querySelector('[data-id="hub"]');
        if (hubNode) {
            return {
                x: parseInt(hubNode.style.left) || 0,
                y: parseInt(hubNode.style.top) || 0,
                width: hubNode.offsetWidth || 320,
                height: hubNode.offsetHeight || 200
            };
        }
        return { x: 440, y: 300, width: 320, height: 200 };
    }

    // ================================
    // Snap/Magnetic Alignment System
    // ================================
    const SNAP_THRESHOLD = 12; // Pixels within which snapping activates

    /**
     * Calculate snap alignments for a dragged node
     * @param {string} draggedId - ID of the node being dragged
     * @param {number} x - Current X position
     * @param {number} y - Current Y position
     * @param {number} width - Width of dragged node
     * @param {number} height - Height of dragged node
     * @returns {Object} - {snapX, snapY, guides[]}
     */
    function calculateSnap(draggedId, x, y, width, height) {
        const nodeRects = buildCurrentNodeRects();
        let snapX = null;
        let snapY = null;
        const guides = [];

        // Edges of dragged node
        const dragLeft = x;
        const dragRight = x + width;
        const dragTop = y;
        const dragBottom = y + height;
        const dragCenterX = x + width / 2;
        const dragCenterY = y + height / 2;

        // Check against all other nodes
        Object.entries(nodeRects).forEach(([id, rect]) => {
            if (id === draggedId) return;

            const targetLeft = rect.x;
            const targetRight = rect.x + rect.width;
            const targetTop = rect.y;
            const targetBottom = rect.y + rect.height;
            const targetCenterX = rect.x + rect.width / 2;
            const targetCenterY = rect.y + rect.height / 2;

            // Horizontal alignments (snap X)
            // Left edge to left edge
            if (Math.abs(dragLeft - targetLeft) < SNAP_THRESHOLD) {
                snapX = targetLeft;
                guides.push({ type: 'vertical', position: targetLeft });
            }
            // Right edge to right edge
            if (Math.abs(dragRight - targetRight) < SNAP_THRESHOLD) {
                snapX = targetRight - width;
                guides.push({ type: 'vertical', position: targetRight });
            }
            // Left edge to right edge
            if (Math.abs(dragLeft - targetRight) < SNAP_THRESHOLD) {
                snapX = targetRight;
                guides.push({ type: 'vertical', position: targetRight });
            }
            // Right edge to left edge
            if (Math.abs(dragRight - targetLeft) < SNAP_THRESHOLD) {
                snapX = targetLeft - width;
                guides.push({ type: 'vertical', position: targetLeft });
            }
            // Center to center (horizontal)
            if (Math.abs(dragCenterX - targetCenterX) < SNAP_THRESHOLD) {
                snapX = targetCenterX - width / 2;
                guides.push({ type: 'vertical', position: targetCenterX });
            }

            // Vertical alignments (snap Y)
            // Top edge to top edge
            if (Math.abs(dragTop - targetTop) < SNAP_THRESHOLD) {
                snapY = targetTop;
                guides.push({ type: 'horizontal', position: targetTop });
            }
            // Bottom edge to bottom edge
            if (Math.abs(dragBottom - targetBottom) < SNAP_THRESHOLD) {
                snapY = targetBottom - height;
                guides.push({ type: 'horizontal', position: targetBottom });
            }
            // Top edge to bottom edge
            if (Math.abs(dragTop - targetBottom) < SNAP_THRESHOLD) {
                snapY = targetBottom;
                guides.push({ type: 'horizontal', position: targetBottom });
            }
            // Bottom edge to top edge
            if (Math.abs(dragBottom - targetTop) < SNAP_THRESHOLD) {
                snapY = targetTop - height;
                guides.push({ type: 'horizontal', position: targetTop });
            }
            // Center to center (vertical)
            if (Math.abs(dragCenterY - targetCenterY) < SNAP_THRESHOLD) {
                snapY = targetCenterY - height / 2;
                guides.push({ type: 'horizontal', position: targetCenterY });
            }
        });

        return { snapX, snapY, guides };
    }

    /**
     * Render snap guides on the canvas
     * @param {Array} guides - Array of guide objects {type, position}
     */
    function renderSnapGuides(guides) {
        const container = elements.snapGuides;
        if (!container) return;

        // Clear existing guides
        container.innerHTML = '';

        // Remove duplicates based on type and position
        const uniqueGuides = [];
        const seen = new Set();
        guides.forEach(g => {
            const key = `${g.type}-${Math.round(g.position)}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueGuides.push(g);
            }
        });

        // Render unique guides
        uniqueGuides.forEach(guide => {
            const el = document.createElement('div');
            el.className = `snap-guide ${guide.type}`;
            if (guide.type === 'horizontal') {
                el.style.top = `${guide.position}px`;
            } else {
                el.style.left = `${guide.position}px`;
            }
            container.appendChild(el);
        });
    }

    /**
     * Clear all snap guides
     */
    function clearSnapGuides() {
        if (elements.snapGuides) {
            elements.snapGuides.innerHTML = '';
        }
    }

    // ================================
    // Connection Mode Functions
    // ================================
    function startConnectionMode(sourceId) {
        const sourceNode = elements.treeViewContainer.querySelector(`[data-id="${sourceId}"]`);
        if (!sourceNode) return;

        state.connectionMode.active = true;
        state.connectionMode.sourceId = sourceId;
        state.connectionMode.sourceRect = {
            x: parseInt(sourceNode.style.left) || 0,
            y: parseInt(sourceNode.style.top) || 0,
            width: sourceNode.offsetWidth,
            height: sourceNode.offsetHeight
        };

        // Add connecting class to canvas
        elements.canvasContainer.classList.add('connecting-mode');

        // Highlight valid drop targets
        document.querySelectorAll('.tree-node').forEach(node => {
            if (node.dataset.id !== sourceId) {
                node.classList.add('valid-drop-target');
            }
        });

        console.log('[CONNECTION] Started connection mode from:', sourceId);
    }

    function drawConnectionPreview() {
        // Remove existing preview
        const existingPreview = elements.connectionsLayer.querySelector('.connection-preview');
        if (existingPreview) existingPreview.remove();

        if (!state.connectionMode.active || !state.connectionMode.sourceRect) return;

        const sourceRect = state.connectionMode.sourceRect;
        const sourceCenterX = sourceRect.x + sourceRect.width / 2;
        const sourceCenterY = sourceRect.y + sourceRect.height / 2;

        // Get mouse position relative to canvas grid
        const gridRect = elements.canvasGrid.getBoundingClientRect();
        const mouseX = (state.connectionMode.mouseX - gridRect.left) / state.canvas.scale + Math.abs(state.canvas.offsetX);
        const mouseY = (state.connectionMode.mouseY - gridRect.top) / state.canvas.scale + Math.abs(state.canvas.offsetY);

        // Create preview line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-preview');
        line.setAttribute('x1', sourceCenterX);
        line.setAttribute('y1', sourceCenterY);
        line.setAttribute('x2', mouseX);
        line.setAttribute('y2', mouseY);
        line.setAttribute('stroke', '#3ecf8e');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-dasharray', '8 4');
        line.setAttribute('opacity', '0.7');

        elements.connectionsLayer.appendChild(line);
    }

    function endConnectionMode(targetId = null) {
        if (!state.connectionMode.active) return;

        const sourceId = state.connectionMode.sourceId;

        // Remove preview line
        const preview = elements.connectionsLayer.querySelector('.connection-preview');
        if (preview) preview.remove();

        // Remove classes
        elements.canvasContainer.classList.remove('connecting-mode');
        document.querySelectorAll('.tree-node').forEach(node => {
            node.classList.remove('valid-drop-target');
        });

        // If we have a valid target, create the connection
        if (targetId && targetId !== sourceId) {
            console.log('[CONNECTION] Creating connection:', sourceId, '->', targetId);

            // For now, we connect modules to hub
            // Future: store module-to-module connections
            if (targetId === 'hub') {
                // Connect module to hub
                const module = getCustomModule(sourceId);
                if (module) {
                    module.connectedToHub = true;
                    saveCustomModules();
                    showToast('Connected to Hub', 'success');
                }
            } else if (sourceId === 'hub') {
                // Connect hub to module
                const module = getCustomModule(targetId);
                if (module) {
                    module.connectedToHub = true;
                    saveCustomModules();
                    showToast('Connected to Hub', 'success');
                }
            } else {
                // Module to module connection - store in module data
                // Future enhancement: implement module-to-module connections
                showToast('Module-to-module connections coming soon', 'info');
            }

            // Redraw connections
            const nodeRects = buildCurrentNodeRects();
            redrawConnections(nodeRects);
        }

        // Reset state
        state.connectionMode.active = false;
        state.connectionMode.sourceId = null;
        state.connectionMode.sourceRect = null;

        console.log('[CONNECTION] Ended connection mode');
    }

    function createTreeNode(data, x, y) {
        const node = document.createElement('div');
        node.className = `tree-node${data.isCentral ? ' central' : ''}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.id = data.id;

        const iconSvg = getIconSvg(data.icon, data.color);

        node.innerHTML = `
            <!-- Connection Ports (discreet, shown on hover) -->
            <div class="connection-port port-top" data-port="top" data-node="${data.id}"></div>
            <div class="connection-port port-right" data-port="right" data-node="${data.id}"></div>
            <div class="connection-port port-bottom" data-port="bottom" data-node="${data.id}"></div>
            <div class="connection-port port-left" data-port="left" data-node="${data.id}"></div>

            <div class="tree-node-icon${data.icon === 'hub' ? '' : (state.groupBy === 'department' ? ' department' : '')}">
                ${iconSvg}
            </div>
            <div class="tree-node-title">${escapeHtml(data.name)}</div>
            <div class="tree-node-subtitle">${escapeHtml(data.description || '')}</div>
            ${!data.isCentral ? `
                <div class="tree-node-stats">
                    <span class="tree-node-stat">
                        <span class="stat-dot implemented"></span>
                        ${data.processCount || 0} processes
                    </span>
                    ${data.draftCount ? `
                        <span class="tree-node-stat">
                            <span class="stat-dot draft"></span>
                            ${data.draftCount} drafts
                        </span>
                    ` : ''}
                </div>
            ` : ''}
        `;

        return node;
    }

    function renderExternalServicesOverview() {
        const services = Object.values(EXTERNAL_SERVICES);
        const startX = 1050;
        const startY = 150;
        const spacing = 90;

        services.forEach((service, index) => {
            const node = createServiceNode(service, startX, startY + index * spacing);
            elements.treeViewContainer.appendChild(node);
        });
    }

    function createServiceNode(service, x, y) {
        const node = document.createElement('div');
        node.className = 'service-node';
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.serviceId = service.id;

        const iconSvg = getServiceIconSvg(service.icon, service.color);

        node.innerHTML = `
            <div class="service-node-icon">
                ${iconSvg}
            </div>
            <div class="service-node-title">${escapeHtml(service.name)}</div>
            <div class="service-node-type">${escapeHtml(service.type)}</div>
        `;

        node.addEventListener('click', () => {
            openServicePanel(service);
        });

        return node;
    }

    // ================================
    // Detail View Rendering
    // ================================
    function renderDetailView() {
        if (!elements.detailViewContainer) return;

        elements.detailViewContainer.innerHTML = '';
        clearConnections();

        if (state.filteredProcesses.length === 0) {
            elements.canvasEmpty.style.display = 'block';
            return;
        }

        elements.canvasEmpty.style.display = 'none';

        // Layout processes
        const startX = 100;
        const startY = 100;
        const cardWidth = 300;
        const cardHeight = 200;
        const horizontalGap = 80;
        const verticalGap = 60;
        const cardsPerRow = 3;

        // Separate implemented and drafts
        const implemented = state.filteredProcesses.filter(p => p.is_implemented);
        const drafts = state.filteredProcesses.filter(p => !p.is_implemented);

        let currentY = startY;

        // Render implemented processes
        if (implemented.length > 0) {
            implemented.forEach((process, index) => {
                const row = Math.floor(index / cardsPerRow);
                const col = index % cardsPerRow;
                const defaultX = startX + col * (cardWidth + horizontalGap);
                const defaultY = currentY + row * (cardHeight + verticalGap);

                // Load saved position or use default grid position
                const pos = getNodePosition(process.id, defaultX, defaultY);
                const card = createProcessCard(process, pos.x, pos.y);
                elements.detailViewContainer.appendChild(card);
            });

            currentY += Math.ceil(implemented.length / cardsPerRow) * (cardHeight + verticalGap) + 40;
        }

        // Render draft processes
        if (drafts.length > 0) {
            // Add section divider
            const divider = document.createElement('div');
            divider.className = 'section-divider';
            divider.style.position = 'absolute';
            divider.style.left = `${startX}px`;
            divider.style.top = `${currentY}px`;
            divider.innerHTML = `
                <span style="font-size: 11px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.1em;">
                    Draft Processes
                </span>
            `;
            elements.detailViewContainer.appendChild(divider);
            currentY += 40;

            drafts.forEach((process, index) => {
                const row = Math.floor(index / cardsPerRow);
                const col = index % cardsPerRow;
                const defaultX = startX + col * (cardWidth + horizontalGap);
                const defaultY = currentY + row * (cardHeight + verticalGap);

                // Load saved position or use default grid position
                const pos = getNodePosition(process.id, defaultX, defaultY);
                const card = createProcessCard(process, pos.x, pos.y);
                elements.detailViewContainer.appendChild(card);
            });
        }

        // Render external services used by these processes
        renderServicesForProcesses();
    }

    // ================================
    // Expenses Engine Detailed View
    // ================================
    function renderExpensesEngineDetail() {
        if (!elements.detailViewContainer) return;

        elements.detailViewContainer.innerHTML = '';
        clearConnections();
        elements.canvasEmpty.style.display = 'none';

        // Add flowchart entry card at the top
        const flowchartCard = document.createElement('div');
        flowchartCard.className = 'flowchart-entry-card';
        flowchartCard.style.cssText = `
            position: absolute;
            left: 80px;
            top: 20px;
            width: 320px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border: 1px solid #60a5fa;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 16px;
        `;
        flowchartCard.innerHTML = `
            <div style="width: 48px; height: 48px; background: rgba(96, 165, 250, 0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </div>
            <div style="flex: 1;">
                <div style="font-size: 14px; font-weight: 600; color: #e5e7eb; margin-bottom: 4px;">Expenses Track</div>
                <div style="font-size: 12px; color: #9ca3af;">Ver flujo completo del proceso</div>
            </div>
            <div style="color: #60a5fa;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        `;
        flowchartCard.addEventListener('mouseenter', () => {
            flowchartCard.style.borderColor = '#93c5fd';
            flowchartCard.style.transform = 'translateY(-2px)';
            flowchartCard.style.boxShadow = '0 8px 24px rgba(96, 165, 250, 0.15)';
        });
        flowchartCard.addEventListener('mouseleave', () => {
            flowchartCard.style.borderColor = '#60a5fa';
            flowchartCard.style.transform = 'translateY(0)';
            flowchartCard.style.boxShadow = 'none';
        });
        flowchartCard.addEventListener('click', () => {
            navigateToFlowchart('expenses_track');
        });
        elements.detailViewContainer.appendChild(flowchartCard);

        const phases = EXPENSES_ENGINE.phases;
        const phaseWidth = 280;
        const phaseGap = 40;
        const cardHeight = 140;
        const cardGap = 20;
        const startX = 80;
        const startY = 140; // Adjusted for flowchart entry card
        const phaseHeaderHeight = 60;

        // Track card positions for connections
        const cardPositions = {};

        // Render each phase as a column
        phases.forEach((phase, phaseIndex) => {
            const phaseX = startX + phaseIndex * (phaseWidth + phaseGap);

            // Phase header
            const phaseHeader = document.createElement('div');
            phaseHeader.className = 'phase-header';
            phaseHeader.style.cssText = `
                position: absolute;
                left: ${phaseX}px;
                top: ${startY}px;
                width: ${phaseWidth}px;
                padding: 12px 16px;
                background: rgba(62, 207, 142, 0.1);
                border: 1px solid rgba(62, 207, 142, 0.3);
                border-radius: 8px;
                text-align: center;
            `;
            phaseHeader.innerHTML = `
                <div style="font-size: 11px; color: #3ecf8e; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
                    Phase ${phaseIndex + 1}
                </div>
                <div style="font-weight: 600; color: #e2e8f0;">${escapeHtml(phase.name)}</div>
            `;
            elements.detailViewContainer.appendChild(phaseHeader);

            // Render function cards in this phase
            phase.functions.forEach((func, funcIndex) => {
                const cardY = startY + phaseHeaderHeight + funcIndex * (cardHeight + cardGap);
                const card = createFunctionCard(func, phaseX, cardY, phaseWidth);
                elements.detailViewContainer.appendChild(card);

                // Store position for connections
                cardPositions[func.id] = {
                    x: phaseX + phaseWidth / 2,
                    y: cardY + cardHeight / 2,
                    right: phaseX + phaseWidth,
                    left: phaseX,
                    top: cardY,
                    bottom: cardY + cardHeight
                };
            });

            // Draw connection to next phase if exists
            if (phaseIndex < phases.length - 1) {
                const fromX = phaseX + phaseWidth;
                const toX = phaseX + phaseWidth + phaseGap;
                const midY = startY + phaseHeaderHeight + (phase.functions.length * (cardHeight + cardGap)) / 2;

                const connection = createAnimatedConnection(
                    fromX, midY,
                    toX, midY,
                    '#3ecf8e',
                    'phase'
                );
                elements.connectionsLayer.appendChild(connection);
            }
        });

        // Render external services on the right
        renderExpensesEngineServices(phases);
    }

    function createFunctionCard(func, x, y, width = 280) {
        const card = document.createElement('div');
        card.className = 'function-card';
        card.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${width}px;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        card.dataset.functionId = func.id;

        // Role badges with colors
        const roleBadges = (func.roles || []).map(role => {
            const roleInfo = EXPENSES_ENGINE.roleHierarchy[role] || { color: '#6b7280' };
            return `<span class="role-badge" style="background: ${roleInfo.color}20; color: ${roleInfo.color}; border: 1px solid ${roleInfo.color}40;">${escapeHtml(role)}</span>`;
        }).join('');

        // Service icons
        const serviceIcons = (func.services || []).map(serviceId => {
            const service = EXTERNAL_SERVICES[serviceId];
            if (!service) return '';
            return `<span class="service-icon-mini" title="${service.name}" style="color: ${service.color};">
                ${getServiceIconSvg(service.icon, service.color)}
            </span>`;
        }).join('');

        // Model badge if AI is involved
        const modelBadge = func.model ? `
            <span class="model-badge" style="background: #10b98120; color: #10b981; border: 1px solid #10b98140;">
                ${func.model}
            </span>
        ` : '';

        card.innerHTML = `
            <div class="function-card-header">
                <div class="function-name">${escapeHtml(func.name)}</div>
                <div class="function-services">${serviceIcons}</div>
            </div>
            <div class="function-endpoint">${escapeHtml(func.endpoint)}</div>
            <div class="function-description">${escapeHtml(func.description)}</div>
            <div class="function-footer">
                <div class="function-roles">${roleBadges}${modelBadge}</div>
            </div>
        `;

        // Hover effect
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = '#3ecf8e';
            card.style.boxShadow = '0 4px 20px rgba(62, 207, 142, 0.15)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = '#334155';
            card.style.boxShadow = 'none';
        });

        // Click to show details
        card.addEventListener('click', () => {
            openFunctionPanel(func);
        });

        return card;
    }

    function renderExpensesEngineServices(phases) {
        // Collect unique services used
        const usedServices = new Set();
        phases.forEach(phase => {
            phase.functions.forEach(func => {
                (func.services || []).forEach(s => usedServices.add(s));
            });
        });

        const startX = 80 + phases.length * 320 + 40;
        const startY = 100;
        const spacing = 90;

        // Add "External Services" label
        const label = document.createElement('div');
        label.style.cssText = `
            position: absolute;
            left: ${startX}px;
            top: ${startY - 30}px;
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        `;
        label.textContent = 'External Services';
        elements.detailViewContainer.appendChild(label);

        Array.from(usedServices).forEach((serviceId, index) => {
            const service = EXTERNAL_SERVICES[serviceId];
            if (!service) return;

            const node = createServiceNode(service, startX, startY + index * spacing);
            elements.detailViewContainer.appendChild(node);
        });
    }

    function openFunctionPanel(func) {
        if (!elements.processPanel) return;

        state.isPanelOpen = true;
        elements.panelTitle.textContent = func.name;
        elements.processPanel.classList.add('open');

        // Role badges with hierarchy info
        const roleDetails = (func.roles || []).map(role => {
            const roleInfo = EXPENSES_ENGINE.roleHierarchy[role] || { level: 0, canAuthorize: 'none', color: '#6b7280' };
            const authLabel = roleInfo.canAuthorize === 'all' ? 'Can authorize all' :
                              roleInfo.canAuthorize === 'own_projects' ? 'Own projects only' : 'Cannot authorize';
            return `
                <div class="role-detail-item" style="border-left: 3px solid ${roleInfo.color};">
                    <span class="role-name">${escapeHtml(role)}</span>
                    <span class="role-auth">${authLabel}</span>
                </div>
            `;
        }).join('');

        elements.panelContent.innerHTML = `
            <div class="panel-section">
                <div class="panel-label">Endpoint</div>
                <div class="panel-value" style="font-family: monospace; font-size: 12px; color: #3ecf8e;">
                    ${escapeHtml(func.endpoint)}
                </div>
            </div>

            <div class="panel-section">
                <div class="panel-label">Description</div>
                <div class="panel-value">${escapeHtml(func.description)}</div>
            </div>

            ${func.file ? `
                <div class="panel-section">
                    <div class="panel-label">Source File</div>
                    <div class="source-file-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>api/routers/${func.file}</span>
                    </div>
                </div>
            ` : ''}

            ${func.model ? `
                <div class="panel-section">
                    <div class="panel-label">AI Model</div>
                    <div class="panel-value">
                        <span style="background: #10b98120; color: #10b981; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                            ${func.model}
                        </span>
                    </div>
                </div>
            ` : ''}

            <div class="panel-section">
                <div class="panel-label">Roles with Access</div>
                <div class="roles-detail-list">
                    ${roleDetails}
                </div>
            </div>

            ${func.services && func.services.length > 0 ? `
                <div class="panel-section">
                    <div class="panel-label">External Services</div>
                    <div class="services-list">
                        ${func.services.map(serviceId => {
                            const service = EXTERNAL_SERVICES[serviceId];
                            if (!service) return '';
                            return `
                                <div class="service-item">
                                    ${getServiceIconSvg(service.icon, service.color)}
                                    <span>${service.name}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        elements.panelActions.innerHTML = `
            <button type="button" class="btn-panel btn-panel-secondary" disabled>
                View in Code
            </button>
        `;
    }

    function createProcessCard(process, x, y) {
        const isImplemented = process.is_implemented;
        const card = document.createElement('div');
        card.className = `process-card ${isImplemented ? 'implemented' : 'draft'}`;
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
        card.dataset.processId = process.id;

        const triggerIcon = getTriggerIcon(process.trigger);
        const stepIndicators = (process.steps || []).slice(0, 10).map(step =>
            `<div class="step-indicator ${step.type}"></div>`
        ).join('');

        card.innerHTML = `
            <div class="process-card-header">
                <div class="process-card-type">
                    ${triggerIcon}
                    ${formatTrigger(process.trigger)}
                </div>
                <span class="process-card-badge ${isImplemented ? 'implemented' : 'draft'}">
                    ${isImplemented ? 'IMPLEMENTED' : 'DRAFT'}
                </span>
            </div>
            <div class="process-card-title">${escapeHtml(process.name)}</div>
            <div class="process-card-description">${escapeHtml(process.description || '')}</div>
            <div class="process-card-meta">
                ${process.owner ? `
                    <span class="process-card-tag">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        ${escapeHtml(process.owner)}
                    </span>
                ` : ''}
                <span class="process-card-tag">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                    ${(process.steps || []).length} steps
                </span>
            </div>
            ${stepIndicators ? `<div class="process-card-steps">${stepIndicators}</div>` : ''}
        `;

        // Add drag functionality to all process cards
        makeDraggable(card, process.id);

        // Click handler with drag prevention
        card.addEventListener('click', () => {
            // Only open panel if not dragging (was-dragged removed automatically after 200ms)
            if (!card.classList.contains('was-dragged')) {
                openProcessPanel(process);
            }
        });

        return card;
    }

    function renderServicesForProcesses() {
        // Collect unique services used by current processes
        const usedServices = new Set();
        state.filteredProcesses.forEach(process => {
            (process.services || []).forEach(s => usedServices.add(s));
        });

        if (usedServices.size === 0) return;

        // Render services on the right side
        const startX = 1050;
        const startY = 100;
        const spacing = 80;

        Array.from(usedServices).forEach((serviceId, index) => {
            const service = EXTERNAL_SERVICES[serviceId];
            if (!service) return;

            const node = createServiceNode(service, startX, startY + index * spacing);
            elements.detailViewContainer.appendChild(node);

            // Draw connections from processes to this service
            state.filteredProcesses.forEach(process => {
                if ((process.services || []).includes(serviceId)) {
                    const processCard = elements.detailViewContainer.querySelector(`[data-process-id="${process.id}"]`);
                    if (processCard) {
                        const processRect = {
                            x: parseInt(processCard.style.left) + 280,
                            y: parseInt(processCard.style.top) + 100
                        };
                        const serviceRect = {
                            x: startX,
                            y: startY + index * spacing + 35
                        };

                        const connection = createAnimatedConnection(
                            processRect.x, processRect.y,
                            serviceRect.x, serviceRect.y,
                            service.color,
                            'service'
                        );
                        elements.connectionsLayer.appendChild(connection);
                    }
                }
            });
        });
    }

    // ================================
    // Connection Rendering
    // ================================
    function createAnimatedConnection(x1, y1, x2, y2, color = '#3ecf8e', type = 'default') {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Create curved path
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const controlOffset = Math.abs(x2 - x1) * 0.3;

        const d = `M ${x1} ${y1} Q ${midX} ${y1}, ${midX} ${midY} Q ${midX} ${y2}, ${x2} ${y2}`;

        path.setAttribute('d', d);
        path.setAttribute('class', `connection-path animated ${type}`);
        path.setAttribute('stroke', color);
        path.setAttribute('marker-end', `url(#arrowhead-${type === 'service' ? 'service' : 'active'})`);

        return path;
    }

    function clearConnections() {
        if (!elements.connectionsLayer) return;

        // Keep only defs
        const defs = elements.connectionsLayer.querySelector('defs');
        elements.connectionsLayer.innerHTML = '';
        if (defs) elements.connectionsLayer.appendChild(defs);
    }

    // ================================
    // Panel
    // ================================
    function openProcessPanel(process) {
        if (!elements.processPanel) return;

        state.selectedProcess = process;
        state.isPanelOpen = true;

        elements.panelTitle.textContent = process.name;
        elements.processPanel.classList.add('open');

        const isImplemented = process.is_implemented;

        // Build panel content
        let content = `
            <div class="panel-section">
                <div class="panel-label">Status</div>
                <div class="panel-value">
                    <span class="status-badge ${isImplemented ? 'implemented' : 'draft'}">
                        ${isImplemented ? 'Implemented' : 'Draft'}
                    </span>
                </div>
            </div>

            <div class="panel-section">
                <div class="panel-label">Description</div>
                <div class="panel-value">${escapeHtml(process.description || 'No description')}</div>
            </div>

            <div class="panel-section">
                <div class="panel-label">Trigger</div>
                <div class="panel-value">${formatTrigger(process.trigger)}</div>
            </div>

            ${process.owner ? `
                <div class="panel-section">
                    <div class="panel-label">Owner</div>
                    <div class="panel-value">${escapeHtml(process.owner)}</div>
                </div>
            ` : ''}
        `;

        // Source file (for implemented)
        if (isImplemented && process.source_file) {
            content += `
                <div class="panel-section">
                    <div class="panel-label">Source File</div>
                    <div class="source-file-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>${process.source_file}:${process.source_line}</span>
                    </div>
                </div>
            `;
        }

        // Steps
        if (process.steps && process.steps.length > 0) {
            content += `
                <div class="panel-section">
                    <div class="panel-label">Process Steps (${process.steps.length})</div>
                    <div class="steps-list">
                        ${process.steps.map(step => `
                            <div class="step-item">
                                <span class="step-number">${step.number}</span>
                                <div class="step-info">
                                    <div class="step-name">${escapeHtml(step.name)}</div>
                                    <div class="step-type-badge ${step.type}">${step.type}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Services
        if (process.services && process.services.length > 0) {
            content += `
                <div class="panel-section">
                    <div class="panel-label">External Services</div>
                    <div class="services-list">
                        ${process.services.map(serviceId => {
                            const service = EXTERNAL_SERVICES[serviceId];
                            if (!service) return '';
                            return `
                                <div class="service-item">
                                    ${getServiceIconSvg(service.icon, service.color)}
                                    <span>${service.name}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        elements.panelContent.innerHTML = content;

        // Actions
        if (isImplemented) {
            elements.panelActions.innerHTML = `
                <button type="button" class="btn-panel btn-panel-secondary" disabled>
                    Implemented (Read-only)
                </button>
            `;
        } else {
            elements.panelActions.innerHTML = `
                <button type="button" class="btn-panel btn-panel-secondary" id="btnEditDraft">
                    Edit Draft
                </button>
                <button type="button" class="btn-panel btn-panel-primary" id="btnProposeDraft">
                    Propose
                </button>
            `;
        }
    }

    function openServicePanel(service) {
        if (!elements.processPanel) return;

        state.isPanelOpen = true;
        elements.panelTitle.textContent = service.name;
        elements.processPanel.classList.add('open');

        elements.panelContent.innerHTML = `
            <div class="panel-section">
                <div class="panel-label">Service Type</div>
                <div class="panel-value">${escapeHtml(service.type)}</div>
            </div>

            <div class="panel-section">
                <div class="panel-label">Description</div>
                <div class="panel-value">${escapeHtml(service.description)}</div>
            </div>

            <div class="panel-section">
                <div class="panel-label">Used By</div>
                <div class="panel-value">
                    ${state.processes.filter(p => (p.services || []).includes(service.id))
                        .map(p => `<div class="service-process-item">${escapeHtml(p.name)}</div>`)
                        .join('') || 'No processes currently use this service'}
                </div>
            </div>
        `;

        elements.panelActions.innerHTML = '';
    }

    function closePanel() {
        if (!elements.processPanel) return;

        state.selectedProcess = null;
        state.isPanelOpen = false;
        elements.processPanel.classList.remove('open');
    }

    // ================================
    // Modal
    // ================================
    function openAddProcessModal() {
        if (!elements.processModal) return;

        document.getElementById('processModalTitle').textContent = 'Add Draft Process';
        document.getElementById('processForm').reset();
        document.getElementById('processId').value = 'DRAFT_';

        // Pre-select current category
        if (state.selectedGroupId && state.groupBy === 'department') {
            document.getElementById('processCategory').value = state.selectedGroupId;
        }

        elements.processModal.classList.remove('hidden');
    }

    function closeModal() {
        if (elements.processModal) {
            elements.processModal.classList.add('hidden');
        }
    }

    async function saveProcess() {
        const form = document.getElementById('processForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const processData = {
            id: document.getElementById('processId').value,
            name: document.getElementById('processName').value,
            description: document.getElementById('processDescription').value,
            category: document.getElementById('processCategory').value,
            trigger: document.getElementById('processTrigger').value,
            owner: document.getElementById('processOwner').value,
            steps: []
        };

        try {
            const res = await fetch(`${API_BASE}/processes/drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(processData)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || 'Failed to create draft');
            }

            // Reload processes
            await loadProcesses();

            // Re-navigate to current view
            if (state.currentLevel === 'detail' && state.selectedGroupId) {
                navigateToDetail(state.selectedGroupId, state.groupBy);
            }

            closeModal();
            showToast('Draft process created', 'success');

        } catch (err) {
            console.error('[PROCESS-MANAGER] Error saving process:', err);
            showToast(err.message || 'Failed to save process', 'error');
        }
    }

    // ================================
    // Canvas Controls
    // ================================
    function handleCanvasMouseDown(e) {
        // Check if clicking on a connection port to start connection
        const port = e.target.closest('.connection-port');
        if (port) {
            e.preventDefault();
            e.stopPropagation();
            const nodeId = port.dataset.node;
            if (nodeId) {
                startConnectionMode(nodeId);
            }
            return;
        }

        // If in connection mode and clicking on empty space, cancel
        if (state.connectionMode.active) {
            const targetNode = e.target.closest('.tree-node');
            if (targetNode) {
                // Clicking on a node - complete connection
                endConnectionMode(targetNode.dataset.id);
            } else {
                // Clicking on empty space - cancel
                endConnectionMode(null);
            }
            return;
        }

        // Don't start selection if clicking on a node
        if (e.target.closest('.tree-node, .service-node, .process-card, .step-card')) {
            // If clicking a node without Ctrl/Shift, clear selection
            if (!e.ctrlKey && !e.shiftKey) {
                clearModuleSelection();
            }
            return;
        }

        // Middle mouse button (wheel click) = pan
        if (e.button === 1) {
            e.preventDefault();
            state.canvas.isDragging = true;
            state.canvas.dragStart = { x: e.clientX, y: e.clientY };
            elements.canvasContainer.style.cursor = 'grabbing';
            return;
        }

        // Right mouse button = context menu (do nothing here)
        if (e.button === 2) return;

        // Left click on empty space = start selection box
        if (e.button === 0) {
            // Clear previous selection if not holding Ctrl/Shift
            if (!e.ctrlKey && !e.shiftKey) {
                clearModuleSelection();
            }

            // Get canvas-relative coordinates
            const rect = elements.canvasGrid.getBoundingClientRect();
            const x = (e.clientX - rect.left) / state.canvas.scale;
            const y = (e.clientY - rect.top) / state.canvas.scale;

            state.selectionBox.active = true;
            state.selectionBox.startX = x;
            state.selectionBox.startY = y;
            state.selectionBox.endX = x;
            state.selectionBox.endY = y;

            updateSelectionBox();
            elements.canvasContainer.style.cursor = 'crosshair';
        }
    }

    function handleCanvasMouseMove(e) {
        // Update connection preview if in connection mode
        if (state.connectionMode.active) {
            state.connectionMode.mouseX = e.clientX;
            state.connectionMode.mouseY = e.clientY;
            drawConnectionPreview();
            return;
        }

        // Update selection box if active
        if (state.selectionBox.active) {
            const rect = elements.canvasGrid.getBoundingClientRect();
            const x = (e.clientX - rect.left) / state.canvas.scale;
            const y = (e.clientY - rect.top) / state.canvas.scale;

            state.selectionBox.endX = x;
            state.selectionBox.endY = y;

            updateSelectionBox();
            highlightModulesInSelection();
            return;
        }

        // Canvas panning
        if (!state.canvas.isDragging) return;

        const dx = e.clientX - state.canvas.dragStart.x;
        const dy = e.clientY - state.canvas.dragStart.y;

        state.canvas.offsetX += dx;
        state.canvas.offsetY += dy;
        state.canvas.dragStart = { x: e.clientX, y: e.clientY };

        applyCanvasTransform();
    }

    function handleCanvasMouseUp(e) {
        // If in connection mode, check if we're over a valid target
        if (state.connectionMode.active) {
            const targetNode = e.target.closest('.tree-node');
            if (targetNode && targetNode.dataset.id !== state.connectionMode.sourceId) {
                endConnectionMode(targetNode.dataset.id);
            }
            // Don't cancel here - let user click elsewhere to cancel
            return;
        }

        // End selection box
        if (state.selectionBox.active) {
            finishSelection();
            state.selectionBox.active = false;
            if (elements.selectionBox) {
                elements.selectionBox.classList.remove('active');
            }
            elements.canvasContainer.style.cursor = 'grab';
            return;
        }

        state.canvas.isDragging = false;
        elements.canvasContainer.style.cursor = 'grab';
    }

    // ================================
    // Multi-Select Functions
    // ================================
    function updateSelectionBox() {
        if (!elements.selectionBox) return;

        const { startX, startY, endX, endY } = state.selectionBox;

        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        elements.selectionBox.style.left = `${left}px`;
        elements.selectionBox.style.top = `${top}px`;
        elements.selectionBox.style.width = `${width}px`;
        elements.selectionBox.style.height = `${height}px`;
        elements.selectionBox.classList.add('active');
    }

    function highlightModulesInSelection() {
        const { startX, startY, endX, endY } = state.selectionBox;

        const boxLeft = Math.min(startX, endX);
        const boxRight = Math.max(startX, endX);
        const boxTop = Math.min(startY, endY);
        const boxBottom = Math.max(startY, endY);

        // Check each module
        const allNodes = elements.treeViewContainer.querySelectorAll('.tree-node');
        allNodes.forEach(node => {
            const nodeId = node.dataset.id;
            const nodeLeft = parseInt(node.style.left) || 0;
            const nodeTop = parseInt(node.style.top) || 0;
            const nodeRight = nodeLeft + node.offsetWidth;
            const nodeBottom = nodeTop + node.offsetHeight;

            // Check if node intersects with selection box
            const intersects = !(boxRight < nodeLeft || boxLeft > nodeRight ||
                                boxBottom < nodeTop || boxTop > nodeBottom);

            if (intersects) {
                node.classList.add('selected');
            } else if (!state.selectedModules.includes(nodeId)) {
                node.classList.remove('selected');
            }
        });
    }

    function finishSelection() {
        const { startX, startY, endX, endY } = state.selectionBox;

        const boxLeft = Math.min(startX, endX);
        const boxRight = Math.max(startX, endX);
        const boxTop = Math.min(startY, endY);
        const boxBottom = Math.max(startY, endY);

        // Select modules inside the box
        const allNodes = elements.treeViewContainer.querySelectorAll('.tree-node');
        allNodes.forEach(node => {
            const nodeId = node.dataset.id;
            const nodeLeft = parseInt(node.style.left) || 0;
            const nodeTop = parseInt(node.style.top) || 0;
            const nodeRight = nodeLeft + node.offsetWidth;
            const nodeBottom = nodeTop + node.offsetHeight;

            // Check if node intersects with selection box
            const intersects = !(boxRight < nodeLeft || boxLeft > nodeRight ||
                                boxBottom < nodeTop || boxTop > nodeBottom);

            if (intersects && !state.selectedModules.includes(nodeId)) {
                state.selectedModules.push(nodeId);
                node.classList.add('selected');
            }
        });

        console.log('[MULTI-SELECT] Selected modules:', state.selectedModules);
    }

    function clearModuleSelection() {
        state.selectedModules = [];
        const allNodes = elements.treeViewContainer.querySelectorAll('.tree-node.selected');
        allNodes.forEach(node => node.classList.remove('selected'));
    }

    function toggleModuleSelection(moduleId) {
        const index = state.selectedModules.indexOf(moduleId);
        const node = elements.treeViewContainer.querySelector(`[data-id="${moduleId}"]`);

        if (index > -1) {
            state.selectedModules.splice(index, 1);
            if (node) node.classList.remove('selected');
        } else {
            state.selectedModules.push(moduleId);
            if (node) node.classList.add('selected');
        }
    }

    function handleCanvasWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const rect = elements.canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        zoomAtPoint(delta, mouseX, mouseY);
    }

    function zoom(delta) {
        const newScale = Math.max(state.canvas.minScale, Math.min(state.canvas.maxScale, state.canvas.scale + delta));

        if (newScale !== state.canvas.scale) {
            state.canvas.scale = newScale;
            applyCanvasTransform();
        }
    }

    function zoomAtPoint(delta, x, y) {
        const oldScale = state.canvas.scale;
        const newScale = Math.max(state.canvas.minScale, Math.min(state.canvas.maxScale, oldScale + delta));

        if (newScale !== oldScale) {
            const scaleRatio = newScale / oldScale;
            state.canvas.offsetX = x - (x - state.canvas.offsetX) * scaleRatio;
            state.canvas.offsetY = y - (y - state.canvas.offsetY) * scaleRatio;
            state.canvas.scale = newScale;
            applyCanvasTransform();
        }
    }

    function applyCanvasTransform() {
        if (!elements.canvasGrid) return;

        elements.canvasGrid.style.transform = `translate(${state.canvas.offsetX}px, ${state.canvas.offsetY}px) scale(${state.canvas.scale})`;
        updateMinimap();
    }

    function centerCanvas() {
        if (!elements.canvasContainer || !elements.canvasGrid) return;

        // Get container dimensions
        const containerRect = elements.canvasContainer.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // Calculate center point based on modules or default starting area
        let centerX, centerY;

        // Check if we have modules to center on (with safety checks)
        const modules = Array.isArray(state.modules) ? state.modules : [];
        const customModules = Array.isArray(state.customModules) ? state.customModules : [];
        const allModules = [...modules, ...customModules];
        if (allModules.length > 0) {
            // Calculate bounding box of all modules
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            allModules.forEach(m => {
                const nodePositions = state.nodePositions || {};
                const pos = nodePositions[m.id] || m.position || { x: 300, y: 300 };
                const nodeWidth = 280;
                const nodeHeight = 120;
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + nodeWidth);
                maxY = Math.max(maxY, pos.y + nodeHeight);
            });

            // Center on the bounding box center
            centerX = (minX + maxX) / 2;
            centerY = (minY + maxY) / 2;
        } else {
            // Default starting area - top-left region where new modules are typically placed
            centerX = 400;
            centerY = 400;
        }

        state.canvas.scale = 0.85;

        // Calculate offset to center the target point in the viewport
        state.canvas.offsetX = (containerWidth / 2) - (centerX * state.canvas.scale);
        state.canvas.offsetY = (containerHeight / 2) - (centerY * state.canvas.scale);

        applyCanvasTransform();
    }

    // ================================
    // Minimap
    // ================================
    const MINIMAP_STATE_KEY = 'ngm_process_minimap_collapsed';

    function toggleMinimap(e) {
        if (e) e.stopPropagation();
        if (!elements.canvasMinimap) return;

        elements.canvasMinimap.classList.toggle('collapsed');
        saveMinimapState();
    }

    function loadMinimapState() {
        try {
            // Only collapse if explicitly set to 'true', otherwise keep expanded (default)
            const savedState = localStorage.getItem(MINIMAP_STATE_KEY);
            if (savedState === 'true' && elements.canvasMinimap) {
                elements.canvasMinimap.classList.add('collapsed');
            } else if (elements.canvasMinimap) {
                // Ensure it's expanded by default
                elements.canvasMinimap.classList.remove('collapsed');
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    function saveMinimapState() {
        try {
            const collapsed = elements.canvasMinimap?.classList.contains('collapsed');
            localStorage.setItem(MINIMAP_STATE_KEY, collapsed ? 'true' : 'false');
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    function updateMinimap() {
        if (!elements.minimapCanvas || !elements.canvasContainer) return;

        const canvas = elements.minimapCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Canvas dimensions
        const canvasSize = 5000;
        const minimapWidth = canvas.width;
        const minimapHeight = canvas.height;
        const scaleX = minimapWidth / canvasSize;
        const scaleY = minimapHeight / canvasSize;

        // Draw background grid pattern
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, minimapWidth, minimapHeight);

        // Draw nodes
        const groups = state.groupBy === 'deliverable' ? DELIVERABLES : DEPARTMENTS;
        const groupArray = Object.values(groups);

        // Draw hub
        const hubPos = getNodePosition('hub', 470, 320);
        ctx.beginPath();
        ctx.arc(
            (hubPos.x + 130) * scaleX,
            (hubPos.y + 80) * scaleY,
            6,
            0,
            Math.PI * 2
        );
        ctx.fillStyle = '#3ecf8e';
        ctx.fill();

        // Draw group nodes
        groupArray.forEach((group, index) => {
            const angle = (index / groupArray.length) * Math.PI * 2 - Math.PI / 2;
            const defaultX = 600 + Math.cos(angle) * 320 - 110;
            const defaultY = 400 + Math.sin(angle) * 320 - 70;
            const pos = getNodePosition(group.id, defaultX, defaultY);

            ctx.beginPath();
            ctx.arc(
                (pos.x + 110) * scaleX,
                (pos.y + 70) * scaleY,
                4,
                0,
                Math.PI * 2
            );
            ctx.fillStyle = '#3ecf8e';
            ctx.fill();
        });

        // Draw connections (simplified lines)
        ctx.strokeStyle = 'rgba(62, 207, 142, 0.3)';
        ctx.lineWidth = 1;
        groupArray.forEach((group, index) => {
            const angle = (index / groupArray.length) * Math.PI * 2 - Math.PI / 2;
            const defaultX = 600 + Math.cos(angle) * 320 - 110;
            const defaultY = 400 + Math.sin(angle) * 320 - 70;
            const pos = getNodePosition(group.id, defaultX, defaultY);

            ctx.beginPath();
            ctx.moveTo((hubPos.x + 130) * scaleX, (hubPos.y + 80) * scaleY);
            ctx.lineTo((pos.x + 110) * scaleX, (pos.y + 70) * scaleY);
            ctx.stroke();
        });

        // Update viewport indicator
        if (elements.minimapViewport) {
            const containerRect = elements.canvasContainer.getBoundingClientRect();
            const viewWidth = containerRect.width / state.canvas.scale;
            const viewHeight = containerRect.height / state.canvas.scale;
            const viewX = -state.canvas.offsetX / state.canvas.scale;
            const viewY = -state.canvas.offsetY / state.canvas.scale;

            // Padding offset for the minimap body
            const padding = 8;

            elements.minimapViewport.style.left = `${padding + viewX * scaleX}px`;
            elements.minimapViewport.style.top = `${padding + viewY * scaleY}px`;
            elements.minimapViewport.style.width = `${Math.max(10, viewWidth * scaleX)}px`;
            elements.minimapViewport.style.height = `${Math.max(10, viewHeight * scaleY)}px`;
        }
    }


    // ================================
    // Stats & Filter
    // ================================
    function updateStats() {
        // Count custom modules (the editable modules from Supabase)
        const implemented = state.customModules.filter(m => m.isImplemented).length;
        const drafts = state.customModules.filter(m => !m.isImplemented).length;

        if (elements.countImplemented) elements.countImplemented.textContent = implemented;
        if (elements.countDrafts) elements.countDrafts.textContent = drafts;

        // Update filter visual state
        updateFilterVisuals();
    }

    function toggleModuleFilter(filterType) {
        // Toggle filter: if already active, clear it; otherwise set it
        if (state.moduleFilter === filterType) {
            state.moduleFilter = null;
        } else {
            state.moduleFilter = filterType;
        }

        // Apply filter class to container
        applyModuleFilter();
        updateFilterVisuals();
    }

    function applyModuleFilter() {
        if (!elements.treeViewContainer) return;

        // Remove existing filter classes
        elements.treeViewContainer.classList.remove('filter-implemented', 'filter-draft');

        // Add new filter class if active
        if (state.moduleFilter === 'implemented') {
            elements.treeViewContainer.classList.add('filter-implemented');
        } else if (state.moduleFilter === 'draft') {
            elements.treeViewContainer.classList.add('filter-draft');
        }
    }

    function updateFilterVisuals() {
        // Update stat item visuals based on active filter
        if (elements.statImplemented) {
            elements.statImplemented.classList.toggle('active', state.moduleFilter === 'implemented');
            elements.statImplemented.classList.toggle('dimmed', state.moduleFilter === 'draft');
        }
        if (elements.statDraft) {
            elements.statDraft.classList.toggle('active', state.moduleFilter === 'draft');
            elements.statDraft.classList.toggle('dimmed', state.moduleFilter === 'implemented');
        }
    }

    // ================================
    // Process Navigator
    // ================================
    function renderProcessNavigator(searchTerm = '') {
        if (!elements.processNavigatorList) return;

        const filteredProcesses = searchTerm
            ? state.processes.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            : state.processes;

        // Group processes by category
        const grouped = {};
        filteredProcesses.forEach(process => {
            const category = process.category || 'uncategorized';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(process);
        });

        // Category display names
        const categoryNames = {
            bookkeeping: 'Bookkeeping',
            expenses: 'Expenses',
            projects: 'Projects',
            pipeline: 'Pipeline',
            team: 'Team',
            uncategorized: 'Other'
        };

        if (Object.keys(grouped).length === 0) {
            elements.processNavigatorList.innerHTML = `
                <div class="process-nav-empty">
                    ${searchTerm ? 'No processes match your search' : 'No processes documented yet'}
                </div>
            `;
            return;
        }

        let html = '';
        Object.keys(grouped).sort().forEach(category => {
            const processes = grouped[category];
            const implementedCount = processes.filter(p => p.is_implemented).length;

            html += `
                <div class="process-nav-category" data-category="${category}">
                    <div class="process-nav-category-header">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span>${categoryNames[category] || category}</span>
                        <span class="process-nav-category-count">${implementedCount}/${processes.length}</span>
                    </div>
                    <div class="process-nav-category-items">
            `;

            processes.forEach(process => {
                const statusClass = process.is_implemented ? 'implemented' : 'draft';
                const triggerLabel = process.trigger || '';

                html += `
                    <div class="process-nav-item" data-process-id="${process.id}">
                        <div class="process-nav-item-status ${statusClass}"></div>
                        <div class="process-nav-item-info">
                            <div class="process-nav-item-name">${escapeHtml(process.name)}</div>
                            <div class="process-nav-item-id">${escapeHtml(process.id)}</div>
                        </div>
                        ${triggerLabel ? `<div class="process-nav-item-trigger">${escapeHtml(triggerLabel)}</div>` : ''}
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        elements.processNavigatorList.innerHTML = html;

        // Add click handlers
        elements.processNavigatorList.querySelectorAll('.process-nav-category-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('collapsed');
            });
        });

        elements.processNavigatorList.querySelectorAll('.process-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const processId = item.dataset.processId;
                selectProcessInNavigator(processId);
            });
        });
    }

    function selectProcessInNavigator(processId) {
        const process = state.processes.find(p => p.id === processId);
        if (!process) return;

        // Remove active class from all items
        elements.processNavigatorList.querySelectorAll('.process-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected item
        const selectedItem = elements.processNavigatorList.querySelector(`[data-process-id="${processId}"]`);
        if (selectedItem) {
            selectedItem.classList.add('active');
        }

        // Find which custom module this process is linked to
        const linkedModule = state.customModules.find(m =>
            m.linkedProcesses && m.linkedProcesses.includes(processId)
        );

        if (linkedModule) {
            // Navigate to the module that contains this process
            navigateToModuleDetail(linkedModule.id);
            // After navigation, highlight/select the process
            setTimeout(() => {
                highlightProcessInModule(processId);
            }, 100);
        } else {
            // Process not linked to any module - show info panel or offer to link
            showProcessInfoPanel(process);
        }
    }

    function highlightProcessInModule(processId) {
        const processNode = elements.detailViewContainer.querySelector(`[data-process-id="${processId}"]`);
        if (processNode) {
            processNode.classList.add('highlighted');
            processNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => processNode.classList.remove('highlighted'), 2000);
        }
    }

    function showProcessInfoPanel(process) {
        // Show a panel with process info and option to link to a module
        const panelHtml = `
            <div class="process-info-panel">
                <div class="process-info-header">
                    <h3>${escapeHtml(process.name)}</h3>
                    <span class="process-status-badge ${process.is_implemented ? 'implemented' : 'draft'}">
                        ${process.is_implemented ? 'IMPLEMENTED' : 'DRAFT'}
                    </span>
                </div>
                <p class="process-info-id">${escapeHtml(process.id)}</p>
                <p class="process-info-description">${escapeHtml(process.description || 'No description')}</p>
                <div class="process-info-meta">
                    <span>Category: ${escapeHtml(process.category || 'Uncategorized')}</span>
                    ${process.trigger ? `<span>Trigger: ${escapeHtml(process.trigger)}</span>` : ''}
                </div>
                <div class="process-info-actions">
                    <label class="process-link-label">Link to module:</label>
                    <select class="process-link-select" id="processLinkSelect">
                        <option value="">-- Select a module --</option>
                        ${state.customModules.map(m => `
                            <option value="${m.id}">${escapeHtml(m.name)}</option>
                        `).join('')}
                    </select>
                    <button type="button" class="btn-link-process" onclick="window.processManager?.linkProcessToModule('${process.id}')">
                        Link
                    </button>
                </div>
            </div>
        `;

        // Show in a toast or panel
        showToast(`Process "${process.name}" is not linked to any module. Use the dropdown to link it.`, 'info', 5000);

        // If we have a process panel element, show detailed info there
        if (elements.processPanel) {
            elements.processPanel.innerHTML = panelHtml;
            elements.processPanel.classList.remove('hidden');
            state.isPanelOpen = true;
        }
    }

    function linkProcessToModule(processId, moduleId = null) {
        // If moduleId not provided, get from select
        if (!moduleId) {
            const select = document.getElementById('processLinkSelect');
            moduleId = select?.value;
        }

        if (!moduleId) {
            showToast('Please select a module', 'warning');
            return;
        }

        const module = getCustomModule(moduleId);
        if (!module) return;

        // Initialize linkedProcesses if needed
        if (!module.linkedProcesses) {
            module.linkedProcesses = [];
        }

        // Add process if not already linked
        if (!module.linkedProcesses.includes(processId)) {
            module.linkedProcesses.push(processId);
            saveCustomModules();
            showToast(`Process linked to "${module.name}"`, 'success');

            // Navigate to the module
            navigateToModuleDetail(moduleId);
        } else {
            showToast('Process already linked to this module', 'info');
        }
    }

    function unlinkProcessFromModule(processId, moduleId) {
        const module = getCustomModule(moduleId);
        if (!module || !module.linkedProcesses) return;

        const index = module.linkedProcesses.indexOf(processId);
        if (index > -1) {
            module.linkedProcesses.splice(index, 1);
            saveCustomModules();
            showToast('Process unlinked', 'success');

            // Refresh the current view
            if (state.currentLevel === 'detail' && state.selectedGroupId === moduleId) {
                renderModuleDetailView(module);
            }
        }
    }

    function setupProcessNavigator() {
        if (!elements.processSearchInput) return;

        elements.processSearchInput.addEventListener('input', (e) => {
            renderProcessNavigator(e.target.value);
        });

        // Initial render
        renderProcessNavigator();
    }

    // ================================
    // Process Flowchart Rendering
    // ================================
    async function loadFlowPositions() {
        // Load from Supabase only (no localStorage fallback to avoid stale data)
        const result = await loadStateFromSupabase('flow_positions', {});

        if (result.success) {
            state.flowNodePositions = result.data;
            // Update local cache only when successfully loaded from server
            localStorage.setItem(FLOW_POSITIONS_KEY, JSON.stringify(result.data));
        } else {
            // Server error - use empty state and show error
            state.flowNodePositions = {};
            console.error('[PROCESS-MANAGER] Failed to load flow positions:', result.error);

            if (window.showToast) {
                showToast(`Error loading flow positions: ${result.error}. Using default layout.`, 'error');
            }
        }
    }

    function saveFlowPositions() {
        try {
            // Save to localStorage as cache
            localStorage.setItem(FLOW_POSITIONS_KEY, JSON.stringify(state.flowNodePositions));
            // Save to Supabase (debounced)
            saveStateToSupabase('flow_positions', state.flowNodePositions);
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error saving flow positions:', e);
        }
    }

    function getFlowNodePosition(processId, nodeId, defaultX, defaultY) {
        const key = `${processId}_${nodeId}`;
        if (state.flowNodePositions[key]) {
            return state.flowNodePositions[key];
        }
        return { x: defaultX, y: defaultY };
    }

    function setFlowNodePosition(processId, nodeId, x, y) {
        const key = `${processId}_${nodeId}`;
        state.flowNodePositions[key] = { x, y };
        saveFlowPositions();
    }

    function navigateToFlowchart(processId) {
        const flowchart = PROCESS_FLOWCHARTS[processId];
        if (!flowchart) {
            console.warn('[PROCESS-MANAGER] Flowchart not found:', processId);
            return;
        }

        state.currentProcessId = processId;
        state.currentLevel = 'flowchart';

        // Update breadcrumb and URL
        updateBreadcrumb();
        updateURL();

        // Show back button, hide other controls
        elements.btnBack.classList.remove('hidden');
        elements.treeViewContainer.classList.add('hidden');
        elements.detailViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'none';
        elements.btnAddProcess.classList.add('hidden');

        // Render the flowchart
        renderFlowchart(flowchart);
    }

    function renderFlowchart(flowchart) {
        if (!elements.detailViewContainer) return;

        elements.detailViewContainer.innerHTML = '';
        clearConnections();
        elements.canvasEmpty.style.display = 'none';

        const nodeRects = {};

        // Render all nodes
        flowchart.nodes.forEach(node => {
            const pos = getFlowNodePosition(flowchart.id, node.id, node.position.x, node.position.y);
            const nodeEl = createFlowNode(node, pos.x, pos.y, flowchart.id);

            nodeRects[node.id] = {
                x: pos.x,
                y: pos.y,
                width: getNodeWidth(node.size),
                height: getNodeHeight(node),
                type: node.type
            };

            elements.detailViewContainer.appendChild(nodeEl);

            // Make draggable
            makeFlowNodeDraggable(nodeEl, flowchart.id, node.id, () => {
                redrawFlowConnections(flowchart, nodeRects);
            });

            // Right-click context menu for flow nodes
            nodeEl.addEventListener('contextmenu', (e) => {
                console.log('[CONTEXT-MENU] Right-click on flow node:', node.id);
                showFlowNodeContextMenu(e, node.id, flowchart.id);
            });

            // Double-click to drill into sub-process (if node has one)
            nodeEl.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (node.subProcess || node.subProcessNodes) {
                    console.log('[PROCESS-MANAGER] Navigating to sub-process:', node.id);
                    navigateToSubProcess(node.id);
                }
            });

            // Visual indicator for expandable nodes
            if (node.subProcess || node.subProcessNodes) {
                nodeEl.classList.add('has-subprocess');
            }
        });

        // Draw connections
        redrawFlowConnections(flowchart, nodeRects);

        // Center on the flowchart
        centerCanvas();
    }

    function renderSubProcessView(parentNode) {
        if (!elements.detailViewContainer) return;

        elements.detailViewContainer.innerHTML = '';
        clearConnections();
        elements.canvasEmpty.style.display = 'none';

        // Get sub-process data from node
        const subProcessNodes = parentNode.subProcessNodes || parentNode.subProcess?.nodes || [];

        if (subProcessNodes.length === 0) {
            // Show empty state with option to add nodes
            elements.detailViewContainer.innerHTML = `
                <div class="subprocess-empty">
                    <div class="subprocess-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                    </div>
                    <h3 class="subprocess-empty-title">No sub-process defined</h3>
                    <p class="subprocess-empty-text">This module doesn't have a detailed sub-process yet.</p>
                    <button class="btn-add-subprocess" onclick="window.ProcessManager?.addSubProcessNode?.()">
                        Add First Step
                    </button>
                </div>
            `;
            return;
        }

        const nodeRects = {};
        const processId = state.currentProcessId;

        // Render sub-process nodes
        subProcessNodes.forEach((node, index) => {
            // Default position if not specified
            const defaultX = 150 + (index % 3) * 300;
            const defaultY = 150 + Math.floor(index / 3) * 200;

            const pos = getSubProcessNodePosition(processId, parentNode.id, node.id, node.position?.x || defaultX, node.position?.y || defaultY);
            const nodeEl = createFlowNode(node, pos.x, pos.y, processId);

            // Mark as sub-process node
            nodeEl.classList.add('subprocess-node');

            nodeRects[node.id] = {
                x: pos.x,
                y: pos.y,
                width: getNodeWidth(node.size),
                height: getNodeHeight(node),
                type: node.type
            };

            elements.detailViewContainer.appendChild(nodeEl);

            // Make draggable with sub-process position saving
            makeSubProcessNodeDraggable(nodeEl, processId, parentNode.id, node.id, () => {
                redrawSubProcessConnections(subProcessNodes, nodeRects);
            });

            // Right-click context menu
            nodeEl.addEventListener('contextmenu', (e) => {
                showFlowNodeContextMenu(e, node.id, processId);
            });
        });

        // Draw connections between sub-process nodes
        redrawSubProcessConnections(subProcessNodes, nodeRects);

        centerCanvas();
    }

    function getSubProcessNodePosition(processId, parentNodeId, nodeId, defaultX, defaultY) {
        const key = `${processId}_${parentNodeId}_${nodeId}`;
        if (state.flowNodePositions[key]) {
            return state.flowNodePositions[key];
        }
        return { x: defaultX, y: defaultY };
    }

    function setSubProcessNodePosition(processId, parentNodeId, nodeId, x, y) {
        const key = `${processId}_${parentNodeId}_${nodeId}`;
        state.flowNodePositions[key] = { x, y };
        saveFlowNodePositions();
    }

    function makeSubProcessNodeDraggable(nodeEl, processId, parentNodeId, nodeId, onDrag) {
        let isDragging = false;
        let startX, startY;
        let nodeStartX, nodeStartY;

        nodeEl.addEventListener('mousedown', (e) => {
            if (e.target.closest('.flow-node-switch-toggle') || e.target.closest('.flow-port')) return;
            if (e.button !== 0) return;

            isDragging = true;
            nodeEl.classList.add('dragging');

            startX = e.clientX;
            startY = e.clientY;
            nodeStartX = parseInt(nodeEl.style.left) || 0;
            nodeStartY = parseInt(nodeEl.style.top) || 0;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = (e.clientX - startX) / state.canvas.scale;
            const dy = (e.clientY - startY) / state.canvas.scale;

            const newX = Math.max(0, nodeStartX + dx);
            const newY = Math.max(0, nodeStartY + dy);

            nodeEl.style.left = `${newX}px`;
            nodeEl.style.top = `${newY}px`;

            if (onDrag) onDrag();
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            nodeEl.classList.remove('dragging');

            const finalX = parseInt(nodeEl.style.left) || 0;
            const finalY = parseInt(nodeEl.style.top) || 0;
            setSubProcessNodePosition(processId, parentNodeId, nodeId, finalX, finalY);
        });
    }

    function redrawSubProcessConnections(nodes, nodeRects) {
        // Clear existing connections
        const existingConnections = elements.connectionsLayer.querySelectorAll('.flow-connection');
        existingConnections.forEach(c => c.remove());

        // Draw connections
        nodes.forEach(node => {
            if (!node.connects_to) return;

            const fromRect = nodeRects[node.id];
            if (!fromRect) return;

            const connections = Array.isArray(node.connects_to) ? node.connects_to : [node.connects_to];

            connections.forEach(targetId => {
                const toRect = nodeRects[targetId];
                if (!toRect) return;

                drawFlowConnection(fromRect, toRect, node.type);
            });
        });
    }

    function getNodeWidth(size) {
        switch (size) {
            case 'large': return 280;
            case 'medium': return 220;
            case 'small': return 160;
            default: return 220;
        }
    }

    function getNodeHeight(node) {
        let baseHeight;
        switch (node.size) {
            case 'large': baseHeight = 120; break;
            case 'medium': baseHeight = 90; break;
            case 'small': baseHeight = 60; break;
            default: baseHeight = 90;
        }

        // Add height for options
        if (node.options && node.options.length > 0) {
            baseHeight += 40 + (node.options.length * 32);
        }

        // Add height for subservices
        if (node.subservices && node.subservices.length > 0) {
            baseHeight += 40;
        }

        // Add height for draft switch
        if (node.type === 'draft') {
            baseHeight += 40;
        }

        // Add height for algorithm elements (codename, modes, tech)
        if (node.type === 'algorithm') {
            baseHeight += 20; // Codename line
            if (node.modes && node.modes.length > 0) {
                baseHeight += 50; // Modes section
            }
            if (node.tech && node.tech.length > 0) {
                baseHeight += 30; // Tech stack
            }
        }

        return baseHeight;
    }

    function createFlowNode(node, x, y, processId) {
        const el = document.createElement('div');
        el.className = `flow-node type-${node.type} size-${node.size}`;
        if (node.type === 'draft' && node.is_implemented) {
            el.classList.add('is-implemented');
        }
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        el.dataset.nodeId = node.id;
        el.dataset.processId = processId;

        // Connection ports
        const portsHtml = `
            <div class="flow-port port-top" data-port="top"></div>
            <div class="flow-port port-bottom" data-port="bottom"></div>
            <div class="flow-port port-left" data-port="left"></div>
            <div class="flow-port port-right" data-port="right"></div>
        `;

        // Icon based on type
        const iconHtml = getFlowNodeIcon(node);

        // Badge
        const badgeHtml = getFlowNodeBadge(node);

        // Options for decision nodes
        let optionsHtml = '';
        if (node.options && node.options.length > 0) {
            optionsHtml = `
                <div class="flow-node-options">
                    ${node.options.map(opt => `
                        <div class="flow-node-option" data-option-id="${opt.id}" data-connects-to="${opt.connects_to || ''}">
                            <div class="flow-node-option-marker"></div>
                            <span>${escapeHtml(opt.label)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Subservices
        let subservicesHtml = '';
        if (node.subservices && node.subservices.length > 0) {
            subservicesHtml = `
                <div class="flow-node-subservices">
                    ${node.subservices.map(ss => `
                        <div class="flow-subservice ${ss.active ? 'active' : ''}" data-subservice-id="${ss.id}">
                            <div class="flow-subservice-dot"></div>
                            <span>${escapeHtml(ss.label)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Draft switch
        let switchHtml = '';
        if (node.type === 'draft') {
            const isLive = node.is_implemented;
            switchHtml = `
                <div class="flow-node-switch">
                    <span class="flow-node-switch-label">Status:</span>
                    <div class="flow-node-switch-toggle ${isLive ? 'active' : ''}" data-node-id="${node.id}"></div>
                    <span class="flow-node-switch-status ${isLive ? 'live' : 'draft'}">${isLive ? 'Live' : 'Draft'}</span>
                </div>
            `;
        }

        // Link arrow for link nodes
        let linkArrowHtml = '';
        if (node.type === 'link') {
            linkArrowHtml = `
                <div class="flow-link-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${node.direction === 'incoming'
                            ? '<polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline>'
                            : '<polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline>'
                        }
                    </svg>
                </div>
            `;
        }

        // Algorithm modes
        let algorithmModesHtml = '';
        if (node.type === 'algorithm' && node.modes && node.modes.length > 0) {
            algorithmModesHtml = `
                <div class="algorithm-modes">
                    ${node.modes.map((mode, idx) => `
                        <div class="algorithm-mode ${idx === 0 ? 'active' : ''}" data-mode-id="${mode.id}" title="${escapeHtml(mode.description || '')}">
                            <span class="algorithm-mode-indicator"></span>
                            <span>${escapeHtml(mode.name)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Algorithm tech stack
        let algorithmTechHtml = '';
        if (node.type === 'algorithm' && node.tech && node.tech.length > 0) {
            algorithmTechHtml = `
                <div class="algorithm-tech">
                    ${node.tech.map(t => `<span class="algorithm-tech-item">${escapeHtml(t)}</span>`).join('')}
                </div>
            `;
        }

        // Build the node content based on type
        if (node.type === 'milestone') {
            el.innerHTML = `
                ${portsHtml}
                <div class="flow-node-header">
                    ${iconHtml}
                    <div class="flow-node-title">${escapeHtml(node.name)}</div>
                </div>
            `;
        } else if (node.type === 'algorithm') {
            // Set custom colors via CSS variables
            if (node.color) {
                el.style.setProperty('--algo-color', node.color);
            }
            if (node.glowColor) {
                el.style.setProperty('--algo-glow', node.glowColor);
            }

            el.innerHTML = `
                ${portsHtml}
                <div class="flow-node-header">
                    ${iconHtml}
                    <div class="flow-node-badge">${node.codename || 'ALGO'}</div>
                    <span class="algorithm-version">v${node.version || '1.0'}</span>
                </div>
                <div class="algorithm-codename">
                    <span class="algorithm-name">${escapeHtml(node.codename || node.name)}<span class="trademark">TM</span></span>
                </div>
                <div class="flow-node-title">${escapeHtml(node.name)}</div>
                <div class="flow-node-description">${escapeHtml(node.description || '')}</div>
                ${algorithmModesHtml}
                ${algorithmTechHtml}
            `;
        } else {
            el.innerHTML = `
                ${portsHtml}
                <div class="flow-node-header">
                    ${iconHtml}
                    ${badgeHtml}
                    ${linkArrowHtml}
                </div>
                <div class="flow-node-title">${escapeHtml(node.name)}</div>
                <div class="flow-node-description">${escapeHtml(node.description || '')}</div>
                ${subservicesHtml}
                ${optionsHtml}
                ${switchHtml}
            `;
        }

        // Add click handler for link nodes
        if (node.type === 'link' && node.link_to) {
            el.addEventListener('dblclick', () => {
                if (PROCESS_FLOWCHARTS[node.link_to.process]) {
                    navigateToFlowchart(node.link_to.process);
                } else {
                    showToast(`Proceso "${node.link_to.process}" no disponible aun`, 'info');
                }
            });
        }

        // Add click handler for draft switch
        if (node.type === 'draft') {
            const toggle = el.querySelector('.flow-node-switch-toggle');
            if (toggle) {
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleDraftStatus(processId, node.id, toggle);
                });
            }
        }

        // Add click to select
        el.addEventListener('click', (e) => {
            if (e.target.closest('.flow-node-switch-toggle') || e.target.closest('.flow-node-option')) {
                return;
            }
            selectFlowNode(el, node);
        });

        return el;
    }

    function getFlowNodeIcon(node) {
        let iconSvg = '';
        switch (node.type) {
            case 'step':
                iconSvg = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
                break;
            case 'draft':
                iconSvg = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>';
                break;
            case 'link':
                iconSvg = '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>';
                break;
            case 'milestone':
                iconSvg = '<path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path>';
                break;
            case 'decision':
                iconSvg = '<circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>';
                break;
            case 'algorithm':
                // CPU/chip icon for algorithms
                iconSvg = '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>';
                break;
            default:
                iconSvg = '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>';
        }
        return `<div class="flow-node-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvg}</svg></div>`;
    }

    function getFlowNodeBadge(node) {
        let label = '';
        switch (node.type) {
            case 'step': label = 'STEP'; break;
            case 'draft': label = node.is_implemented ? 'LIVE' : 'DRAFT'; break;
            case 'link': label = node.direction === 'incoming' ? 'FROM' : 'TO'; break;
            case 'decision': label = 'DECISION'; break;
            default: label = node.type.toUpperCase();
        }
        return `<div class="flow-node-badge">${label}</div>`;
    }

    function selectFlowNode(el, node) {
        // Deselect previous
        document.querySelectorAll('.flow-node.selected').forEach(n => n.classList.remove('selected'));

        // Select this one
        el.classList.add('selected');
        state.selectedFlowNode = node;

        // Could show a panel with details here
    }

    function toggleDraftStatus(processId, nodeId, toggleEl) {
        const flowchart = PROCESS_FLOWCHARTS[processId];
        if (!flowchart) return;

        const node = flowchart.nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'draft') return;

        // Toggle the status
        node.is_implemented = !node.is_implemented;

        // Update UI
        const nodeEl = toggleEl.closest('.flow-node');
        const statusEl = nodeEl.querySelector('.flow-node-switch-status');

        if (node.is_implemented) {
            toggleEl.classList.add('active');
            nodeEl.classList.add('is-implemented');
            statusEl.textContent = 'Live';
            statusEl.classList.remove('draft');
            statusEl.classList.add('live');

            // Update badge
            const badge = nodeEl.querySelector('.flow-node-badge');
            if (badge) badge.textContent = 'LIVE';
        } else {
            toggleEl.classList.remove('active');
            nodeEl.classList.remove('is-implemented');
            statusEl.textContent = 'Draft';
            statusEl.classList.remove('live');
            statusEl.classList.add('draft');

            // Update badge
            const badge = nodeEl.querySelector('.flow-node-badge');
            if (badge) badge.textContent = 'DRAFT';
        }

        // Save to localStorage (we'd need a separate storage for flowchart node states)
        saveDraftStates();

        showToast(node.is_implemented ? 'Marked as Live' : 'Marked as Draft', 'success');
    }

    function saveDraftStates() {
        // Collect draft states
        const states = {};
        Object.keys(PROCESS_FLOWCHARTS).forEach(processId => {
            const flowchart = PROCESS_FLOWCHARTS[processId];
            flowchart.nodes.forEach(node => {
                if (node.type === 'draft') {
                    states[`${processId}_${node.id}`] = node.is_implemented;
                }
            });
        });
        try {
            // Save to localStorage as cache
            localStorage.setItem('ngm_flowchart_draft_states', JSON.stringify(states));
            // Save to Supabase (debounced)
            saveStateToSupabase('draft_states', states);
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error saving draft states:', e);
        }
    }

    async function loadDraftStates() {
        // Load from Supabase only (no localStorage fallback to avoid stale data)
        const result = await loadStateFromSupabase('draft_states', {});

        if (result.success) {
            applyDraftStates(result.data);
            // Update local cache only when successfully loaded from server
            localStorage.setItem('ngm_flowchart_draft_states', JSON.stringify(result.data));
        } else {
            // Server error - show error but continue (draft states are less critical)
            console.error('[PROCESS-MANAGER] Failed to load draft states:', result.error);

            if (window.showToast) {
                showToast(`Error loading draft states: ${result.error}`, 'warning');
            }
        }
    }

    function applyDraftStates(states) {
        Object.keys(states).forEach(key => {
            const [processId, nodeId] = key.split('_');
            const flowchart = PROCESS_FLOWCHARTS[processId];
            if (flowchart) {
                const node = flowchart.nodes.find(n => n.id === nodeId);
                if (node && node.type === 'draft') {
                    node.is_implemented = states[key];
                }
            }
        });
    }

    function makeFlowNodeDraggable(nodeEl, processId, nodeId, onDrag) {
        let isDragging = false;
        let startX, startY;
        let nodeStartX, nodeStartY;

        nodeEl.addEventListener('mousedown', (e) => {
            if (e.target.closest('.flow-node-switch-toggle') ||
                e.target.closest('.flow-node-option') ||
                e.target.closest('.flow-subservice')) {
                return;
            }

            isDragging = true;
            nodeEl.classList.add('dragging');

            startX = e.clientX / state.canvas.scale;
            startY = e.clientY / state.canvas.scale;
            nodeStartX = parseInt(nodeEl.style.left);
            nodeStartY = parseInt(nodeEl.style.top);

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = (e.clientX / state.canvas.scale) - startX;
            const dy = (e.clientY / state.canvas.scale) - startY;

            const newX = nodeStartX + dx;
            const newY = nodeStartY + dy;

            nodeEl.style.left = `${newX}px`;
            nodeEl.style.top = `${newY}px`;

            if (onDrag) onDrag();
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;

            isDragging = false;
            nodeEl.classList.remove('dragging');

            // Save position
            const newX = parseInt(nodeEl.style.left);
            const newY = parseInt(nodeEl.style.top);
            setFlowNodePosition(processId, nodeId, newX, newY);
        });
    }

    function redrawFlowConnections(flowchart, nodeRects) {
        // Clear existing connections
        const existingConnections = elements.connectionsLayer.querySelectorAll('.flow-connection');
        existingConnections.forEach(c => c.remove());

        // Update nodeRects with current positions
        flowchart.nodes.forEach(node => {
            const nodeEl = elements.detailViewContainer.querySelector(`[data-node-id="${node.id}"]`);
            if (nodeEl) {
                nodeRects[node.id] = {
                    x: parseInt(nodeEl.style.left),
                    y: parseInt(nodeEl.style.top),
                    width: getNodeWidth(node.size),
                    height: getNodeHeight(node),
                    type: node.type
                };
            }
        });

        // Draw connections
        flowchart.nodes.forEach(node => {
            if (!node.connects_to) return;

            const fromRect = nodeRects[node.id];
            if (!fromRect) return;

            // Handle array of connections
            const connections = Array.isArray(node.connects_to) ? node.connects_to : [node.connects_to];

            connections.forEach(targetId => {
                const toRect = nodeRects[targetId];
                if (!toRect) return;

                drawFlowConnection(fromRect, toRect, node.type);
            });

            // Handle decision options
            if (node.options) {
                node.options.forEach(opt => {
                    if (opt.connects_to) {
                        const toRect = nodeRects[opt.connects_to];
                        if (toRect) {
                            drawFlowConnection(fromRect, toRect, 'decision');
                        }
                    }
                });
            }
        });
    }

    function drawFlowConnection(fromRect, toRect, type) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        svg.classList.add('flow-connection');

        // Calculate connection points
        const fromCenterX = fromRect.x + fromRect.width / 2;
        const fromBottom = fromRect.y + fromRect.height;
        const toCenterX = toRect.x + toRect.width / 2;
        const toTop = toRect.y;

        // Simple vertical connection with curve
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('flow-connection-line', `type-${type}`);

        // Calculate path based on relative positions
        let d;
        if (Math.abs(fromCenterX - toCenterX) < 10 && fromBottom < toTop) {
            // Straight vertical line
            d = `M ${fromCenterX} ${fromBottom} L ${toCenterX} ${toTop}`;
        } else {
            // Curved path
            const midY = (fromBottom + toTop) / 2;
            d = `M ${fromCenterX} ${fromBottom}
                 C ${fromCenterX} ${midY}, ${toCenterX} ${midY}, ${toCenterX} ${toTop}`;
        }

        path.setAttribute('d', d);

        // Add arrow marker
        const markerId = `flow-arrow-${type}-${Math.random().toString(36).substr(2, 9)}`;
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', markerId);
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.classList.add('flow-arrow-marker', `type-${type}`);

        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);

        path.setAttribute('marker-end', `url(#${markerId})`);
        svg.appendChild(path);

        elements.connectionsLayer.appendChild(svg);
    }

    // ================================
    // Helpers
    // ================================
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatTrigger(trigger) {
        const map = {
            manual: 'Manual',
            scheduled: 'Scheduled',
            event: 'Event-based',
            webhook: 'Webhook'
        };
        return map[trigger] || trigger;
    }

    function getTriggerIcon(trigger) {
        const icons = {
            manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 1-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1 1 18 8z"></path></svg>',
            scheduled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
            event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
            webhook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
        };
        return icons[trigger] || icons.manual;
    }

    function getIconSvg(icon, color = '#3ecf8e') {
        const icons = {
            hub: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"></path></svg>`,
            receipt: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"></path><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`,
            briefcase: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
            message: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
            chart: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
            book: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
            users: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
            dollar: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
            settings: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
        };
        return icons[icon] || icons.hub;
    }

    function getServiceIconSvg(icon, color = '#f59e0b') {
        const icons = {
            database: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
            bell: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`,
            brain: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08A2.5 2.5 0 0 0 12 19.5V4.5"></path><path d="M12 4.5a2.5 2.5 0 0 1 4.96-.46 2.5 2.5 0 0 1 1.98 3 2.5 2.5 0 0 1 1.32 4.24 3 3 0 0 1-.34 5.58 2.5 2.5 0 0 1-2.96 3.08A2.5 2.5 0 0 1 12 19.5"></path></svg>`,
            calculator: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="8" y2="10"></line><line x1="12" y1="10" x2="12" y2="10"></line><line x1="16" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="8" y2="14"></line><line x1="12" y1="14" x2="12" y2="14"></line><line x1="16" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="8" y2="18"></line><line x1="12" y1="18" x2="16" y2="18"></line></svg>`,
            chat: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`
        };
        return icons[icon] || icons.database;
    }

    function showToast(message, type = 'info') {
        if (window.Toast) {
            window.Toast.show(message, type);
        } else {
            console.log(`[TOAST ${type.toUpperCase()}] ${message}`);
        }
    }

    // ================================
    // Drag-to-Connect Functionality
    // ================================
    let connectionDragState = {
        isDragging: false,
        isNewConnection: false,  // true when creating new connection from port
        sourceNodeId: null,
        sourcePort: null,        // 'top', 'right', 'bottom', 'left'
        targetNodeId: null,
        startPoint: null,
        tempLine: null
    };

    function initConnectionDragging() {
        // Listen for mousedown on connection endpoints in SVG
        if (elements.connectionsLayer) {
            elements.connectionsLayer.addEventListener('mousedown', handleConnectionEndpointMouseDown);
        }

        // Listen for mousedown on connection ports (for new connections)
        if (elements.treeViewContainer) {
            elements.treeViewContainer.addEventListener('mousedown', handlePortMouseDown);
        }

        // Global mouse events for dragging
        document.addEventListener('mousemove', handleConnectionDragMove);
        document.addEventListener('mouseup', handleConnectionDragEnd);
    }

    function handlePortMouseDown(e) {
        const port = e.target.closest('.connection-port');
        if (!port) return;

        e.preventDefault();
        e.stopPropagation();

        const nodeId = port.getAttribute('data-node');
        const portSide = port.getAttribute('data-port');
        if (!nodeId || !portSide) return;

        // Get the port's center position in canvas coordinates
        const portRect = port.getBoundingClientRect();
        const gridRect = elements.canvasGrid.getBoundingClientRect();

        const portCenterX = (portRect.left + portRect.width / 2 - gridRect.left) / state.canvas.scale;
        const portCenterY = (portRect.top + portRect.height / 2 - gridRect.top) / state.canvas.scale;

        // Start drag mode for NEW connection
        connectionDragState.isDragging = true;
        connectionDragState.isNewConnection = true;
        connectionDragState.sourceNodeId = nodeId;
        connectionDragState.sourcePort = portSide;
        connectionDragState.startPoint = {
            x: portCenterX,
            y: portCenterY
        };

        // Enter connecting mode
        elements.canvasContainer.classList.add('connecting-mode');

        // Highlight the source port
        port.classList.add('connected');

        // Create temporary line
        createTempConnectionLine();
    }

    function handleConnectionEndpointMouseDown(e) {
        const endpoint = e.target.closest('.connection-endpoint-inner');
        if (!endpoint) return;

        e.preventDefault();
        e.stopPropagation();

        const connectionGroup = endpoint.closest('.connection-group');
        if (!connectionGroup) return;

        const connectionId = connectionGroup.getAttribute('data-connection-id');
        if (!connectionId) return;

        // Parse connection ID (format: "hub-nodeId")
        const parts = connectionId.split('-');
        if (parts.length < 2) return;

        const sourceNodeId = parts[0];
        const targetNodeId = parts.slice(1).join('-');

        // Start drag mode
        connectionDragState.isDragging = true;
        connectionDragState.sourceNodeId = sourceNodeId;
        connectionDragState.targetNodeId = targetNodeId;

        // Get start position (the other endpoint)
        const circles = connectionGroup.querySelectorAll('.connection-endpoint-inner');
        const otherCircle = Array.from(circles).find(c => c !== endpoint);
        if (otherCircle) {
            connectionDragState.startPoint = {
                x: parseFloat(otherCircle.getAttribute('cx')),
                y: parseFloat(otherCircle.getAttribute('cy'))
            };
        }

        // Enter connecting mode
        elements.canvasContainer.classList.add('connecting-mode');

        // Create temporary line
        createTempConnectionLine();

        // Hide the original connection
        connectionGroup.style.opacity = '0.3';
    }

    function handleConnectionDragMove(e) {
        if (!connectionDragState.isDragging) return;

        const gridRect = elements.canvasGrid.getBoundingClientRect();

        // Calculate mouse position relative to the grid
        const mouseX = (e.clientX - gridRect.left) / state.canvas.scale;
        const mouseY = (e.clientY - gridRect.top) / state.canvas.scale;

        // Update temp line
        updateTempConnectionLine(mouseX, mouseY);

        // Check for port hover
        checkPortHover(e.clientX, e.clientY);
    }

    function handleConnectionDragEnd(e) {
        if (!connectionDragState.isDragging) return;

        // Find if we dropped on a valid port
        const port = document.elementFromPoint(e.clientX, e.clientY);
        const portElement = port?.closest('.connection-port');

        let connectionHandled = false;  // Track if connection was reconnected or disconnected

        if (portElement) {
            const targetNodeId = portElement.getAttribute('data-node');

            // Valid target: different node than source
            if (targetNodeId && targetNodeId !== connectionDragState.sourceNodeId) {
                if (connectionDragState.isNewConnection) {
                    // Creating a NEW connection
                    console.log(`[CONNECTIONS] New connection: ${connectionDragState.sourceNodeId} -> ${targetNodeId}`);
                    // For now, just redraw connections to show visual feedback
                    // In a real implementation, you would save this connection
                } else {
                    // Reconnecting existing connection
                    console.log(`[CONNECTIONS] Reconnect: ${connectionDragState.sourceNodeId} -> ${targetNodeId}`);
                    connectionHandled = true;
                }
            }
            // If dropped on same node or invalid, silently ignore (no alert)
        } else if (!connectionDragState.isNewConnection && connectionDragState.targetNodeId) {
            // Dropped in empty space while dragging an EXISTING connection - DISCONNECT IT
            console.log(`[CONNECTIONS] Disconnecting: ${connectionDragState.sourceNodeId} -> ${connectionDragState.targetNodeId}`);

            // Remove the visual connection
            const connectionGroup = elements.connectionsLayer.querySelector(
                `[data-connection-id="${connectionDragState.sourceNodeId}-${connectionDragState.targetNodeId}"]`
            );
            if (connectionGroup) {
                connectionGroup.remove();
            }

            // Update data model if we have access to the flowchart
            if (state.currentProcessId && PROCESS_FLOWCHARTS[state.currentProcessId]) {
                const flowchart = PROCESS_FLOWCHARTS[state.currentProcessId];
                const sourceNode = flowchart.nodes.find(n => n.id === connectionDragState.sourceNodeId);

                if (sourceNode && sourceNode.connects_to) {
                    if (Array.isArray(sourceNode.connects_to)) {
                        // Remove target from array
                        sourceNode.connects_to = sourceNode.connects_to.filter(
                            id => id !== connectionDragState.targetNodeId
                        );
                    } else if (sourceNode.connects_to === connectionDragState.targetNodeId) {
                        // Clear single connection
                        sourceNode.connects_to = null;
                    }
                }
            }

            connectionHandled = true;
            showToast('Connection removed', 'info');
        }
        // If new connection dropped in empty space, silently cancel (no alert)

        // Clean up
        removeTempConnectionLine();
        clearPortHighlights();
        elements.canvasContainer.classList.remove('connecting-mode');

        // Clear source port highlight
        document.querySelectorAll('.connection-port.connected').forEach(p => {
            p.classList.remove('connected');
        });

        // Show original connection again only if it wasn't disconnected
        if (!connectionDragState.isNewConnection && !connectionHandled) {
            const connectionGroup = elements.connectionsLayer.querySelector(
                `[data-connection-id="${connectionDragState.sourceNodeId}-${connectionDragState.targetNodeId}"]`
            );
            if (connectionGroup) {
                connectionGroup.style.opacity = '';
            }
        }

        // Reset state
        connectionDragState = {
            isDragging: false,
            isNewConnection: false,
            sourceNodeId: null,
            sourcePort: null,
            targetNodeId: null,
            startPoint: null,
            tempLine: null
        };
    }

    function createTempConnectionLine() {
        if (!connectionDragState.startPoint) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'connection-temp');
        line.setAttribute('x1', connectionDragState.startPoint.x);
        line.setAttribute('y1', connectionDragState.startPoint.y);
        line.setAttribute('x2', connectionDragState.startPoint.x);
        line.setAttribute('y2', connectionDragState.startPoint.y);

        elements.connectionsLayer.appendChild(line);
        connectionDragState.tempLine = line;
    }

    function updateTempConnectionLine(x, y) {
        if (!connectionDragState.tempLine) return;

        connectionDragState.tempLine.setAttribute('x2', x);
        connectionDragState.tempLine.setAttribute('y2', y);
    }

    function removeTempConnectionLine() {
        if (connectionDragState.tempLine) {
            connectionDragState.tempLine.remove();
            connectionDragState.tempLine = null;
        }
    }

    function checkPortHover(clientX, clientY) {
        // Clear previous highlights
        clearPortHighlights();

        // Find element under cursor
        const element = document.elementFromPoint(clientX, clientY);
        const port = element?.closest('.connection-port');

        if (port) {
            port.classList.add('drop-target');
        }
    }

    function clearPortHighlights() {
        document.querySelectorAll('.connection-port.drop-target').forEach(p => {
            p.classList.remove('drop-target');
        });
    }

    // ================================
    // Initialize
    // ================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API for external access (e.g., onclick handlers)
    window.processManager = {
        openEditModuleModal,
        navigateToTree,
        navigateToModuleDetail,
        linkProcessToModule,
        unlinkProcessFromModule
    };

})();
