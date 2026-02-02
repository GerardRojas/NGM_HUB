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
            color: '#60a5fa',
            processIds: ['COGS_Authorization', 'Expense_Categorization', 'Receipt_Processing', 'QBO_Reconciliation', 'DRAFT_invoice_automation']
        },
        project_management: {
            id: 'project_management',
            name: 'Project Management',
            description: 'Coordinate projects, tasks, and team workflows',
            icon: 'briefcase',
            color: '#60a5fa',
            processIds: ['Project_Health_Check']
        },
        communications: {
            id: 'communications',
            name: 'Communications',
            description: 'Chat, notifications, and AI assistant',
            icon: 'message',
            color: '#a78bfa',
            processIds: []  // Arturito processes would go here
        },
        reporting: {
            id: 'reporting',
            name: 'Reporting & Analytics',
            description: 'Budget monitoring and financial reports',
            icon: 'chart',
            color: '#f59e0b',
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
            color: '#60a5fa'
        },
        finance: {
            id: 'finance',
            name: 'Finance',
            description: 'Budget monitoring and financial planning',
            icon: 'dollar',
            color: '#f59e0b'
        },
        operations: {
            id: 'operations',
            name: 'Operations',
            description: 'Day-to-day operational processes',
            icon: 'settings',
            color: '#9ca3af'
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

        // Currently editing module
        editingModuleId: null,
    };

    // ================================
    // Position Persistence
    // ================================
    const POSITIONS_KEY = 'ngm_process_manager_positions';
    const CUSTOM_MODULES_KEY = 'ngm_process_manager_custom_modules';

    function loadNodePositions() {
        try {
            const saved = localStorage.getItem(POSITIONS_KEY);
            if (saved) {
                state.nodePositions = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error loading positions:', e);
            state.nodePositions = {};
        }
    }

    function saveNodePositions() {
        try {
            localStorage.setItem(POSITIONS_KEY, JSON.stringify(state.nodePositions));
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error saving positions:', e);
        }
    }

    // ================================
    // Custom Modules Storage
    // ================================
    function loadCustomModules() {
        try {
            const saved = localStorage.getItem(CUSTOM_MODULES_KEY);
            if (saved) {
                state.customModules = JSON.parse(saved);
            } else {
                state.customModules = [];
            }
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error loading custom modules:', e);
            state.customModules = [];
        }
    }

    function saveCustomModules() {
        try {
            localStorage.setItem(CUSTOM_MODULES_KEY, JSON.stringify(state.customModules));
        } catch (e) {
            console.warn('[PROCESS-MANAGER] Error saving custom modules:', e);
        }
    }

    function addCustomModule(moduleData) {
        const id = 'custom_' + Date.now();
        const module = {
            id: id,
            name: moduleData.name,
            description: moduleData.description || '',
            icon: moduleData.icon || 'box',
            color: moduleData.color || '#6b7280',
            isImplemented: moduleData.isImplemented || false,
            isCustom: true,
            processIds: [],
            createdAt: new Date().toISOString()
        };
        state.customModules.push(module);
        saveCustomModules();
        return module;
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
            canvasEmpty: document.getElementById('canvasEmpty'),
            processPanel: document.getElementById('processPanel'),
            panelTitle: document.getElementById('panelTitle'),
            panelContent: document.getElementById('panelContent'),
            panelActions: document.getElementById('panelActions'),
            processBreadcrumb: document.getElementById('processBreadcrumb'),
            viewSwitch: document.getElementById('viewSwitch'),
            modeToggle: document.getElementById('modeToggle'),
            btnBack: document.getElementById('btnBack'),
            btnAddProcess: document.getElementById('btnAddProcess'),
            countImplemented: document.getElementById('countImplemented'),
            countDrafts: document.getElementById('countDrafts'),
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
        };
    }

    // ================================
    // Initialization
    // ================================
    async function init() {
        cacheElements();
        loadCurrentUser();
        loadNodePositions();
        loadCustomModules();
        setupEventListeners();
        await loadProcesses();
        renderTreeView();
        updateStats();
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

        // Mode toggle (View / Draft)
        if (elements.modeToggle) {
            elements.modeToggle.addEventListener('click', (e) => {
                const btn = e.target.closest('.mode-btn');
                if (!btn) return;

                const mode = btn.dataset.mode;
                if (mode && mode !== state.mode) {
                    state.mode = mode;
                    elements.modeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    // Re-render to update drag capabilities
                    if (state.currentLevel === 'detail') {
                        renderDetailView();
                    }
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

        // Add Module button
        if (elements.btnAddModule) {
            elements.btnAddModule.addEventListener('click', openAddModuleModal);
        }

        // Context menu (close on click outside)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu') && !e.target.closest('.tree-node.custom-module')) {
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

        if (btnClose) btnClose.addEventListener('click', closeModuleModal);
        if (btnCancel) btnCancel.addEventListener('click', closeModuleModal);
        if (btnSave) btnSave.addEventListener('click', saveModule);
        if (btnDelete) btnDelete.addEventListener('click', confirmDeleteModule);

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
                }
                hideContextMenu();
            });
        }
    }

    // ================================
    // Module Modal Functions
    // ================================
    function openAddModuleModal() {
        if (!elements.moduleModal) return;

        state.editingModuleId = null;
        document.getElementById('moduleModalTitle').textContent = 'Add Module';
        document.getElementById('moduleForm').reset();
        document.getElementById('moduleEditId').value = '';
        document.getElementById('btnDeleteModule').classList.add('hidden');

        elements.moduleModal.classList.remove('hidden');
    }

    function openEditModuleModal(moduleId) {
        if (!elements.moduleModal) return;

        const module = getCustomModule(moduleId);
        if (!module) return;

        state.editingModuleId = moduleId;
        document.getElementById('moduleModalTitle').textContent = 'Edit Module';
        document.getElementById('moduleEditId').value = moduleId;
        document.getElementById('moduleName').value = module.name;
        document.getElementById('moduleDescription').value = module.description || '';
        document.getElementById('moduleIcon').value = module.icon || 'box';
        document.getElementById('moduleColor').value = module.color || '#6b7280';
        document.getElementById('moduleIsImplemented').checked = module.isImplemented || false;
        document.getElementById('btnDeleteModule').classList.remove('hidden');

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

        const moduleData = {
            name: document.getElementById('moduleName').value.trim(),
            description: document.getElementById('moduleDescription').value.trim(),
            icon: document.getElementById('moduleIcon').value,
            color: document.getElementById('moduleColor').value,
            isImplemented: document.getElementById('moduleIsImplemented').checked
        };

        if (!moduleData.name) {
            showToast('Module name is required', 'error');
            return;
        }

        const editId = document.getElementById('moduleEditId').value;

        if (editId) {
            // Update existing module
            updateCustomModule(editId, moduleData);
            showToast('Module updated', 'success');
        } else {
            // Add new module
            addCustomModule(moduleData);
            showToast('Module added', 'success');
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
        e.preventDefault();
        e.stopPropagation();

        if (!elements.moduleContextMenu) return;

        elements.moduleContextMenu.dataset.moduleId = moduleId;
        elements.moduleContextMenu.style.left = `${e.clientX}px`;
        elements.moduleContextMenu.style.top = `${e.clientY}px`;
        elements.moduleContextMenu.classList.remove('hidden');
    }

    function hideContextMenu() {
        if (elements.moduleContextMenu) {
            elements.moduleContextMenu.classList.add('hidden');
        }
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
        elements.btnBack.classList.remove('hidden');
        elements.treeViewContainer.classList.add('hidden');
        elements.detailViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'none';
        elements.modeToggle.classList.remove('hidden');
        elements.btnAddProcess.classList.remove(isDetailedModule ? '' : 'hidden');
        if (isDetailedModule) elements.btnAddProcess.classList.add('hidden');
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
        state.currentLevel = 'tree';
        state.selectedGroupId = null;
        state.selectedGroup = null;
        state.filteredProcesses = [];

        // Update UI
        updateBreadcrumb();
        elements.btnBack.classList.add('hidden');
        elements.detailViewContainer.classList.add('hidden');
        elements.treeViewContainer.classList.remove('hidden');
        elements.viewSwitch.style.display = 'flex';
        elements.modeToggle.classList.add('hidden');
        elements.btnAddProcess.classList.add('hidden');
        document.body.classList.remove('detail-active');

        closePanel();
        renderTreeView();
        centerCanvas();
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
        } else {
            const group = state.selectedGroup;
            elements.processBreadcrumb.innerHTML = `
                <span class="breadcrumb-item" data-level="tree">
                    ${iconOverview}
                    Overview
                </span>
                <span class="breadcrumb-separator">›</span>
                <span class="breadcrumb-item active" data-level="detail">
                    ${group?.name || 'Detail'}
                </span>
            `;

            // Click handler to go back
            const overviewItem = elements.processBreadcrumb.querySelector('[data-level="tree"]');
            if (overviewItem) {
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

        const groups = state.groupBy === 'deliverable' ? DELIVERABLES : DEPARTMENTS;
        const groupArray = Object.values(groups);

        // Default positions - grid layout
        const defaultCenterX = 600;
        const defaultCenterY = 400;
        const defaultRadius = 320;

        // Hub position (can be dragged too)
        const hubPos = getNodePosition('hub', defaultCenterX - 130, defaultCenterY - 80);

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
            hub: { x: hubPos.x, y: hubPos.y, width: 260, height: 160 }
        };

        // Render group nodes around the hub
        groupArray.forEach((group, index) => {
            // Default position in radial layout
            const angle = (index / groupArray.length) * Math.PI * 2 - Math.PI / 2;
            const defaultX = defaultCenterX + Math.cos(angle) * defaultRadius - 110;
            const defaultY = defaultCenterY + Math.sin(angle) * defaultRadius - 70;

            // Get saved position or use default
            const pos = getNodePosition(group.id, defaultX, defaultY);

            // Count processes in this group
            let processCount = 0;
            let draftCount = 0;

            if (state.groupBy === 'deliverable') {
                const deliverable = DELIVERABLES[group.id];
                const processes = state.processes.filter(p => deliverable.processIds.includes(p.id));
                processCount = processes.filter(p => p.is_implemented).length;
                draftCount = processes.filter(p => !p.is_implemented).length;
            } else {
                const processes = state.processes.filter(p => p.category === group.id);
                processCount = processes.filter(p => p.is_implemented).length;
                draftCount = processes.filter(p => !p.is_implemented).length;
            }

            const node = createTreeNode({
                ...group,
                processCount,
                draftCount
            }, pos.x, pos.y);

            // Store for connections
            nodeRects[group.id] = { x: pos.x, y: pos.y, width: 220, height: 140 };

            // Add drag functionality
            makeDraggable(node, group.id, () => {
                // Redraw connections after drag
                redrawConnections(nodeRects);
            });

            node.addEventListener('click', () => {
                // Only navigate if not dragging
                if (!node.classList.contains('was-dragged')) {
                    navigateToDetail(group.id, state.groupBy);
                }
                node.classList.remove('was-dragged');
            });

            elements.treeViewContainer.appendChild(node);
        });

        // Render custom modules
        state.customModules.forEach((module, index) => {
            // Position custom modules in a different area (to the right)
            const customStartX = 1050;
            const customStartY = 150;
            const customSpacing = 180;

            const defaultX = customStartX;
            const defaultY = customStartY + index * customSpacing;

            const pos = getNodePosition(module.id, defaultX, defaultY);

            const customNode = createCustomModuleNode(module, pos.x, pos.y);

            // Store for connections
            nodeRects[module.id] = {
                x: pos.x,
                y: pos.y,
                width: 220,
                height: 140,
                isCustom: true,
                isImplemented: module.isImplemented
            };

            // Add drag functionality
            makeDraggable(customNode, module.id, () => {
                redrawConnections(nodeRects);
            });

            // Right-click context menu for custom modules
            customNode.addEventListener('contextmenu', (e) => {
                showContextMenu(e, module.id);
            });

            // Double-click to edit
            customNode.addEventListener('dblclick', () => {
                openEditModuleModal(module.id);
            });

            elements.treeViewContainer.appendChild(customNode);
        });

        // Draw orthogonal connections
        redrawConnections(nodeRects);
    }

    function createCustomModuleNode(module, x, y) {
        const node = document.createElement('div');
        const statusClass = module.isImplemented ? 'is-implemented' : 'is-draft';
        node.className = `tree-node custom-module ${statusClass}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.id = module.id;

        const iconSvg = getIconSvg(module.icon, module.color);
        const statusLabel = module.isImplemented ? 'LIVE' : 'DRAFT';
        const portColor = module.isImplemented ? '#3ecf8e' : '#6b7280';

        node.innerHTML = `
            <!-- Connection Ports -->
            <div class="connection-port port-top" data-port="top" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-right" data-port="right" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-bottom" data-port="bottom" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-left" data-port="left" style="--port-color: ${portColor}"></div>

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
            </div>
        `;

        return node;
    }

    function redrawConnections(nodeRects) {
        clearConnections();

        const groups = state.groupBy === 'deliverable' ? DELIVERABLES : DEPARTMENTS;
        const groupArray = Object.values(groups);
        const hubRect = nodeRects.hub;
        const hubCenterX = hubRect.x + hubRect.width / 2;
        const hubCenterY = hubRect.y + hubRect.height / 2;

        // Draw connections for built-in groups (always green/implemented)
        groupArray.forEach((group) => {
            const rect = nodeRects[group.id];
            if (!rect) return;

            const nodeCenterX = rect.x + rect.width / 2;
            const nodeCenterY = rect.y + rect.height / 2;

            // Determine connection points (from edge of hub to edge of node)
            const points = calculateOrthogonalPath(
                hubRect, rect, hubCenterX, hubCenterY, nodeCenterX, nodeCenterY
            );

            const connection = createOrthogonalConnection(points, group.color, false);
            elements.connectionsLayer.appendChild(connection);
        });

        // Draw connections for custom modules (gray for drafts, green for implemented)
        state.customModules.forEach((module) => {
            const rect = nodeRects[module.id];
            if (!rect) return;

            const nodeCenterX = rect.x + rect.width / 2;
            const nodeCenterY = rect.y + rect.height / 2;

            const points = calculateOrthogonalPath(
                hubRect, rect, hubCenterX, hubCenterY, nodeCenterX, nodeCenterY
            );

            // Use gray for drafts, green for implemented
            const connectionColor = module.isImplemented ? '#3ecf8e' : '#6b7280';
            const isDraft = !module.isImplemented;
            const connection = createOrthogonalConnection(points, connectionColor, isDraft);
            elements.connectionsLayer.appendChild(connection);
        });

        // Update minimap after redrawing connections
        updateMinimap();
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

    function createOrthogonalConnection(points, color = '#3ecf8e', isDraft = false) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
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

        // Add endpoint dots (larger, more visible like 3ds Max style)
        // Start dot (from hub)
        const startDotOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startDotOuter.setAttribute('cx', points[0].x);
        startDotOuter.setAttribute('cy', points[0].y);
        startDotOuter.setAttribute('r', '8');
        startDotOuter.setAttribute('fill', '#1a1a1a');
        startDotOuter.setAttribute('stroke', '#3ecf8e');
        startDotOuter.setAttribute('stroke-width', '2');
        startDotOuter.setAttribute('class', `connection-port-dot start ${statusClass}`);
        g.appendChild(startDotOuter);

        const startDotInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startDotInner.setAttribute('cx', points[0].x);
        startDotInner.setAttribute('cy', points[0].y);
        startDotInner.setAttribute('r', '3');
        startDotInner.setAttribute('fill', '#3ecf8e');
        startDotInner.setAttribute('class', `connection-port-inner start ${statusClass}`);
        g.appendChild(startDotInner);

        // End dot (to module)
        const endDotOuter = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endDotOuter.setAttribute('cx', points[points.length - 1].x);
        endDotOuter.setAttribute('cy', points[points.length - 1].y);
        endDotOuter.setAttribute('r', '8');
        endDotOuter.setAttribute('fill', '#1a1a1a');
        endDotOuter.setAttribute('stroke', color);
        endDotOuter.setAttribute('stroke-width', '2');
        endDotOuter.setAttribute('class', `connection-port-dot end ${statusClass}`);
        g.appendChild(endDotOuter);

        const endDotInner = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endDotInner.setAttribute('cx', points[points.length - 1].x);
        endDotInner.setAttribute('cy', points[points.length - 1].y);
        endDotInner.setAttribute('r', '3');
        endDotInner.setAttribute('fill', color);
        endDotInner.setAttribute('class', `connection-port-inner end ${statusClass}`);
        g.appendChild(endDotInner);

        return g;
    }

    function makeDraggable(node, nodeId, onDragEnd) {
        let isDragging = false;
        let startX, startY;
        let initialX, initialY;
        let hasMoved = false;

        node.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();

            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            initialX = parseInt(node.style.left) || 0;
            initialY = parseInt(node.style.top) || 0;

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

            const newX = initialX + dx;
            const newY = initialY + dy;

            node.style.left = `${newX}px`;
            node.style.top = `${newY}px`;

            // Update nodeRects and redraw connections in real-time
            if (onDragEnd) {
                const groups = state.groupBy === 'deliverable' ? DELIVERABLES : DEPARTMENTS;
                const groupArray = Object.values(groups);

                const nodeRects = { hub: getHubRect() };
                groupArray.forEach(g => {
                    const el = elements.treeViewContainer.querySelector(`[data-id="${g.id}"]`);
                    if (el) {
                        nodeRects[g.id] = {
                            x: parseInt(el.style.left) || 0,
                            y: parseInt(el.style.top) || 0,
                            width: 220,
                            height: 140
                        };
                    }
                });
                // Update hub rect if dragging hub
                if (nodeId === 'hub') {
                    nodeRects.hub = { x: newX, y: newY, width: 260, height: 160 };
                }
                redrawConnections(nodeRects);
            }
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;

            isDragging = false;
            node.style.cursor = 'grab';
            node.style.zIndex = '';
            node.classList.remove('dragging');

            if (hasMoved) {
                node.classList.add('was-dragged');
                // Save position
                const newX = parseInt(node.style.left) || 0;
                const newY = parseInt(node.style.top) || 0;
                setNodePosition(nodeId, newX, newY);

                if (onDragEnd) onDragEnd();
            }
        });
    }

    function getHubRect() {
        const hubNode = elements.treeViewContainer.querySelector('[data-id="hub"]');
        if (hubNode) {
            return {
                x: parseInt(hubNode.style.left) || 0,
                y: parseInt(hubNode.style.top) || 0,
                width: 260,
                height: 160
            };
        }
        return { x: 470, y: 320, width: 260, height: 160 };
    }

    function createTreeNode(data, x, y) {
        const node = document.createElement('div');
        node.className = `tree-node${data.isCentral ? ' central' : ''}`;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.dataset.id = data.id;

        const iconSvg = getIconSvg(data.icon, data.color);
        const portColor = data.isCentral ? '#3ecf8e' : (data.color || '#3ecf8e');

        node.innerHTML = `
            <!-- Connection Ports -->
            <div class="connection-port port-top" data-port="top" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-right" data-port="right" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-bottom" data-port="bottom" style="--port-color: ${portColor}"></div>
            <div class="connection-port port-left" data-port="left" style="--port-color: ${portColor}"></div>

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
                const x = startX + col * (cardWidth + horizontalGap);
                const y = currentY + row * (cardHeight + verticalGap);

                const card = createProcessCard(process, x, y);
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
                const x = startX + col * (cardWidth + horizontalGap);
                const y = currentY + row * (cardHeight + verticalGap);

                const card = createProcessCard(process, x, y);
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

        const phases = EXPENSES_ENGINE.phases;
        const phaseWidth = 280;
        const phaseGap = 40;
        const cardHeight = 140;
        const cardGap = 20;
        const startX = 80;
        const startY = 100;
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

        card.addEventListener('click', () => {
            openProcessPanel(process);
        });

        // Make drafts draggable in draft mode
        if (!isImplemented && state.mode === 'draft') {
            card.style.cursor = 'grab';
            card.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return;
                startDragNode(e, card, process);
            });
        }

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
        if (e.target.closest('.tree-node, .service-node, .process-card, .step-card')) return;
        if (e.button !== 0) return;

        state.canvas.isDragging = true;
        state.canvas.dragStart = { x: e.clientX, y: e.clientY };
        elements.canvasContainer.style.cursor = 'grabbing';
    }

    function handleCanvasMouseMove(e) {
        if (state.draggedNode) {
            handleNodeDrag(e);
            return;
        }

        if (!state.canvas.isDragging) return;

        const dx = e.clientX - state.canvas.dragStart.x;
        const dy = e.clientY - state.canvas.dragStart.y;

        state.canvas.offsetX += dx;
        state.canvas.offsetY += dy;
        state.canvas.dragStart = { x: e.clientX, y: e.clientY };

        applyCanvasTransform();
    }

    function handleCanvasMouseUp() {
        if (state.draggedNode) {
            endNodeDrag();
        }

        state.canvas.isDragging = false;
        elements.canvasContainer.style.cursor = 'default';
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

        state.canvas.scale = 0.85;
        state.canvas.offsetX = 50;
        state.canvas.offsetY = 50;
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
            const collapsed = localStorage.getItem(MINIMAP_STATE_KEY) === 'true';
            if (collapsed && elements.canvasMinimap) {
                elements.canvasMinimap.classList.add('collapsed');
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
            ctx.fillStyle = group.color || '#60a5fa';
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
    // Node Dragging (Drafts only)
    // ================================
    function startDragNode(e, node, process) {
        if (process.is_implemented) return;
        if (state.mode !== 'draft') return;

        e.stopPropagation();
        state.draggedNode = { element: node, process };
        state.dragOffset = {
            x: e.clientX - parseInt(node.style.left),
            y: e.clientY - parseInt(node.style.top)
        };
        node.style.cursor = 'grabbing';
        node.style.zIndex = '100';
    }

    function handleNodeDrag(e) {
        if (!state.draggedNode) return;

        const x = (e.clientX - state.dragOffset.x - state.canvas.offsetX) / state.canvas.scale;
        const y = (e.clientY - state.dragOffset.y - state.canvas.offsetY) / state.canvas.scale;

        state.draggedNode.element.style.left = `${x}px`;
        state.draggedNode.element.style.top = `${y}px`;
    }

    function endNodeDrag() {
        if (!state.draggedNode) return;

        state.draggedNode.element.style.cursor = 'grab';
        state.draggedNode.element.style.zIndex = '';
        state.draggedNode = null;
    }

    // ================================
    // Stats
    // ================================
    function updateStats() {
        const implemented = state.processes.filter(p => p.is_implemented).length;
        const drafts = state.processes.filter(p => !p.is_implemented).length;

        if (elements.countImplemented) elements.countImplemented.textContent = implemented;
        if (elements.countDrafts) elements.countDrafts.textContent = drafts;
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
    // Initialize
    // ================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
