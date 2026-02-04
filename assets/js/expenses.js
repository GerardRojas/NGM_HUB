// assets/js/expenses.js
(function () {
  'use strict';

  console.log('[EXPENSES] ========================================');
  console.log('[EXPENSES] expenses.js loaded and executing');
  console.log('[EXPENSES] ========================================');

  // ================================
  // STATE
  // ================================
  let currentUser = null;
  let canAuthorize = false; // Can user authorize expenses?

  // Roles allowed to authorize expenses
  const AUTHORIZED_ROLES = ['CEO', 'COO', 'Accounting Manager', 'Admin Guest'];
  let metaData = {
    txn_types: [],
    projects: [],
    vendors: [],
    payment_methods: [],
    accounts: [],
    bills: []  // Bill metadata from bills table
  };
  let expenses = [];
  let filteredExpenses = []; // For filtered view
  let originalExpenses = []; // For edit mode rollback
  let isEditMode = false;
  let selectedProjectId = null;
  let modalRowCounter = 0;
  let currentReceiptFile = null; // File selected for upload
  let currentReceiptUrl = null;  // URL of existing receipt
  let currentReceiptDeleted = false; // Flag to track if user deleted receipt
  let currentBlobUrl = null; // Track blob URL for cleanup (memory leak prevention)
  let currentEditingExpense = null; // Expense being edited in single modal
  let columnFilters = {
    date: [],
    bill_id: [],
    type: [],
    vendor: [],
    payment: [],
    account: [],
    description: [],
    auth: []
  };

  // Filter dropdown state
  let currentFilterColumn = null;
  let tempFilterSelections = {};

  // Global search state
  let globalSearchTerm = '';

  // Scanned receipt file storage
  let scannedReceiptFile = null;
  let scannedReceiptBillId = null;  // Bill ID extracted from scanned receipt
  let scannedReceiptVendorId = null; // Vendor ID from scanned receipt
  let scannedReceiptTotal = null;   // Total from scanned receipt (for expected_total)
  let isScannedReceiptMode = false; // When true, blocks adding rows and marks bill as closed on save
  let selectedBillStatus = 'open';  // Status to use when saving bill (open, closed, split)

  // CSV Import State
  let csvParsedData = {
    headers: [],    // Original CSV column names
    rows: []        // Parsed data rows
  };
  let csvColumnMapping = {}; // Maps CSV column index to expense field name

  // Bill View State
  let isBillViewMode = false;

  // Duplicate Detection State (Enhanced System)
  let duplicateClusters = [];        // Array of duplicate clusters (groups of similar expenses)
  let currentClusterIndex = 0;       // Currently viewing cluster index
  let dismissedDuplicates = new Set(); // Set of "expense_id1:expense_id2" pairs dismissed as not duplicates
  let duplicateBillWarnings = new Map(); // Map of expense_id -> duplicate info (legacy compatibility)

  // Health Check: Missing Info State
  let missingInfoExpenses = [];      // Array of expenses missing bill number or receipt
  let currentMissingInfoIndex = 0;   // Currently viewing missing info index
  let healthCheckActiveTab = 'duplicates'; // 'duplicates' or 'missing'

  // QBO Integration State
  let currentDataSource = 'manual';  // 'manual' or 'qbo'
  let qboExpenses = [];              // QBO expenses for current project

  // ================================
  // EXPENSE MODE: 'cogs' or 'company'
  // ================================
  // Configurable via window.EXPENSE_MODE before this script loads
  // 'cogs' = Project COGS expenses (default, for expenses.html)
  // 'company' = Company/Operating expenses (for company-expenses.html)
  const expenseMode = window.EXPENSE_MODE || 'cogs';

  const MODE_CONFIG = {
    cogs: {
      title: 'COGS Expenses',
      pageTitle: 'Expenses Engine',
      brandContext: 'NGM Hub - Expenses Engine',
      emptyMessage: 'Select a project to view expenses',
      noDataMessage: 'No expenses found for this project',
      searchPlaceholder: 'Search expenses...',
      loadingMessage: 'Loading expenses...',
      qboParam: 'true'  // is_cogs=true for QBO
    },
    company: {
      title: 'Company Expenses',
      pageTitle: 'Company Expenses',
      brandContext: 'NGM Hub - Company Expenses',
      emptyMessage: 'Select a project to view company expenses',
      noDataMessage: 'No company expenses found for this project',
      searchPlaceholder: 'Search company expenses...',
      loadingMessage: 'Loading company expenses...',
      qboParam: 'false'  // is_cogs=false for QBO
    }
  };

  // Get current mode config
  const currentModeConfig = MODE_CONFIG[expenseMode] || MODE_CONFIG.cogs;
  console.log('[EXPENSES] Mode:', expenseMode, '| Config:', currentModeConfig.title);
  let reconciliationData = {         // Reconciliation modal state
    manualExpenses: [],
    qboExpenses: [],
    selectedManual: null,            // Selected row ID in manual table
    selectedQBO: null,               // Selected row ID in QBO table
    linkedPairs: []                  // Array of { manual_id, qbo_id } objects
  };

  // Column visibility configuration
  const COLUMN_CONFIG = [
    { key: 'date', label: 'Date', defaultVisible: true },
    { key: 'bill_id', label: 'Bill #', defaultVisible: true },
    { key: 'description', label: 'Description', defaultVisible: true },
    { key: 'type', label: 'Type', defaultVisible: true },
    { key: 'vendor', label: 'Vendor', defaultVisible: true },
    { key: 'payment', label: 'Payment', defaultVisible: true },
    { key: 'account', label: 'Account', defaultVisible: true },
    { key: 'amount', label: 'Amount', defaultVisible: true },
    { key: 'receipt', label: 'Receipt', defaultVisible: true },
    { key: 'auth', label: 'Authorization', defaultVisible: true }
  ];

  const COLUMN_VISIBILITY_KEY = 'expensesColumnVisibility';
  let columnVisibility = {};

  // Bulk delete state
  let selectedExpenseIds = new Set(); // Set of expense IDs to delete

  // ================================
  // PERFORMANCE: Lookup Maps (O(1) access)
  // ================================
  // Pre-computed maps for instant lookups instead of O(n) .find() calls
  let lookupMaps = {
    txnTypes: new Map(),      // TnxType_id -> { TnxType_id, TnxType_name }
    projects: new Map(),      // project_id -> { project_id, project_name }
    vendors: new Map(),       // id -> { id, vendor_name }
    paymentMethods: new Map(), // id -> { id, payment_method_name }
    accounts: new Map(),      // account_id -> { account_id, Name }
  };

  // Search debounce timer
  let searchDebounceTimer = null;
  const SEARCH_DEBOUNCE_MS = 250;

  // ================================
  // UTILITY: Debounce Function
  // ================================
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ================================
  // PERFORMANCE: Build Lookup Maps
  // ================================
  function buildLookupMaps() {
    console.log('[EXPENSES] Building lookup maps for O(1) access...');

    // Clear existing maps
    lookupMaps.txnTypes.clear();
    lookupMaps.projects.clear();
    lookupMaps.vendors.clear();
    lookupMaps.paymentMethods.clear();
    lookupMaps.accounts.clear();

    // Build txn_types map
    metaData.txn_types.forEach(t => {
      lookupMaps.txnTypes.set(t.TnxType_id, t);
    });

    // Build projects map
    metaData.projects.forEach(p => {
      const id = p.project_id || p.id;
      lookupMaps.projects.set(id, p);
    });

    // Build vendors map
    metaData.vendors.forEach(v => {
      lookupMaps.vendors.set(v.id, v);
    });

    // Build payment_methods map
    metaData.payment_methods.forEach(p => {
      lookupMaps.paymentMethods.set(p.id, p);
    });

    // Build accounts map
    metaData.accounts.forEach(a => {
      lookupMaps.accounts.set(a.account_id, a);
    });

    console.log('[EXPENSES] Lookup maps built:', {
      txnTypes: lookupMaps.txnTypes.size,
      projects: lookupMaps.projects.size,
      vendors: lookupMaps.vendors.size,
      paymentMethods: lookupMaps.paymentMethods.size,
      accounts: lookupMaps.accounts.size,
    });
  }

  // ================================
  // PERFORMANCE: Fast Lookup (O(1))
  // ================================
  function lookupMeta(category, id) {
    if (!id) return null;
    const strId = String(id);

    switch (category) {
      case 'txn_types':
        return lookupMaps.txnTypes.get(strId) || lookupMaps.txnTypes.get(id);
      case 'projects':
        return lookupMaps.projects.get(strId) || lookupMaps.projects.get(id);
      case 'vendors':
        return lookupMaps.vendors.get(strId) || lookupMaps.vendors.get(id);
      case 'payment_methods':
        return lookupMaps.paymentMethods.get(strId) || lookupMaps.paymentMethods.get(id);
      case 'accounts':
        return lookupMaps.accounts.get(strId) || lookupMaps.accounts.get(id);
      default:
        return null;
    }
  }

  // ================================
  // DOM ELEMENTS
  // ================================
  const els = {};

  function cacheElements() {
    console.log('[EXPENSES] cacheElements called');
    console.log('[EXPENSES] document.readyState:', document.readyState);

    els.projectFilter = document.getElementById('projectFilter');
    console.log('[EXPENSES] projectFilter element found:', els.projectFilter);
    els.btnAddExpense = document.getElementById('btnAddExpense');
    els.btnEditExpenses = document.getElementById('btnEditExpenses');
    els.btnBillView = document.getElementById('btnBillView');
    els.expensesTable = document.getElementById('expensesTable');
    els.expensesTableHead = document.querySelector('#expensesTable thead');
    els.expensesTableBody = document.getElementById('expensesTableBody');
    els.expensesEmptyState = document.getElementById('expensesEmptyState');
    els.expensesSkeletonTable = document.getElementById('expensesSkeletonTable');
    els.editModeFooter = document.getElementById('editModeFooter');
    els.btnCancelEdit = document.getElementById('btnCancelEdit');
    els.btnSaveChanges = document.getElementById('btnSaveChanges');
    els.btnBulkDelete = document.getElementById('btnBulkDelete');
    els.selectedCount = document.getElementById('selectedCount');
    els.selectAllCheckbox = document.getElementById('selectAllCheckbox');
    els.btnBulkAuthorize = document.getElementById('btnBulkAuthorize');
    els.authorizeCount = document.getElementById('authorizeCount');

    // Modal elements
    els.modal = document.getElementById('addExpenseModal');
    els.modalProjectName = document.getElementById('modalProjectName');
    els.expenseRowsBody = document.getElementById('expenseRowsBody');
    els.btnAddExpenseRow = document.getElementById('btnAddExpenseRow');
    els.btnAutoCategorize = document.getElementById('btnAutoCategorize');
    els.btnImportCSVExpenses = document.getElementById('btnImportCSVExpenses');
    els.csvExpenseFileInput = document.getElementById('csvExpenseFileInput');

    // CSV Mapping Modal elements
    els.csvMappingModal = document.getElementById('csvMappingModal');
    els.csvMappingContainer = document.getElementById('csvMappingContainer');
    els.btnCloseCsvMapping = document.getElementById('btnCloseCsvMapping');
    els.btnCancelCsvMapping = document.getElementById('btnCancelCsvMapping');
    els.btnConfirmCsvMapping = document.getElementById('btnConfirmCsvMapping');

    els.btnCloseExpenseModal = document.getElementById('btnCloseExpenseModal');
    els.btnCancelExpenses = document.getElementById('btnCancelExpenses');
    els.btnSaveAllExpenses = document.getElementById('btnSaveAllExpenses');

    // Bill Status Section (Add Expense Modal)
    els.billStatusSection = document.getElementById('billStatusSection');
    els.billStatusBillId = document.getElementById('billStatusBillId');
    els.billStatusToggle = document.getElementById('billStatusToggle');
    els.billStatusHint = document.getElementById('billStatusHint');

    // Scan Receipt Modal elements
    els.btnScanReceipt = document.getElementById('btnScanReceipt');
    els.scanReceiptModal = document.getElementById('scanReceiptModal');
    els.btnCloseScanReceipt = document.getElementById('btnCloseScanReceipt');
    els.btnCancelScanReceipt = document.getElementById('btnCancelScanReceipt');
    els.scanReceiptFileInput = document.getElementById('scanReceiptFileInput');
    els.scanReceiptDropArea = document.getElementById('scanReceiptDropArea');
    els.scanReceiptUploadZone = document.getElementById('scanReceiptUploadZone');
    els.scanReceiptProgress = document.getElementById('scanReceiptProgress');
    els.scanReceiptProgressFill = document.getElementById('scanReceiptProgressFill');
    els.scanReceiptProgressText = document.getElementById('scanReceiptProgressText');

    // Pending Receipts Modal elements
    els.btnPendingReceipts = document.getElementById('btnPendingReceipts');
    els.pendingReceiptsModal = document.getElementById('pendingReceiptsModal');
    els.btnClosePendingReceipts = document.getElementById('btnClosePendingReceipts');
    els.btnCancelPendingReceipts = document.getElementById('btnCancelPendingReceipts');
    els.pendingReceiptsGrid = document.getElementById('pendingReceiptsGrid');
    els.pendingReceiptsEmpty = document.getElementById('pendingReceiptsEmpty');
    els.pendingCountReady = document.getElementById('pendingCountReady');
    els.pendingCountPending = document.getElementById('pendingCountPending');
    els.pendingCountProcessing = document.getElementById('pendingCountProcessing');

    // Filter dropdown elements
    els.filterDropdown = document.getElementById('filterDropdown');
    els.filterDropdownOptions = document.getElementById('filterDropdownOptions');

    // Search input
    els.searchInput = document.getElementById('expenses-search-input');

    // Receipt upload container
    els.receiptUploadContainer = document.getElementById('receiptUploadContainer');

    // Single expense edit modal
    els.singleExpenseModal = document.getElementById('editSingleExpenseModal');
    els.btnCloseSingleExpenseModal = document.getElementById('btnCloseSingleExpenseModal');
    els.btnCancelSingleExpense = document.getElementById('btnCancelSingleExpense');
    els.btnSaveSingleExpense = document.getElementById('btnSaveSingleExpense');
    els.singleExpenseDate = document.getElementById('singleExpenseDate');
    els.singleExpenseBillId = document.getElementById('singleExpenseBillId');
    els.singleExpenseDescription = document.getElementById('singleExpenseDescription');
    els.singleExpenseType = document.getElementById('singleExpenseType');
    els.singleExpenseVendor = document.getElementById('singleExpenseVendor');
    els.singleExpensePayment = document.getElementById('singleExpensePayment');
    els.singleExpenseAccount = document.getElementById('singleExpenseAccount');
    els.singleExpenseAmount = document.getElementById('singleExpenseAmount');
    els.singleExpenseReceiptContainer = document.getElementById('singleExpenseReceiptContainer');
    els.singleExpenseAuthContainer = document.getElementById('singleExpenseAuthContainer');
    els.singleExpenseAuthStatus = document.getElementById('singleExpenseAuthStatus');

    // Expense status selector (new)
    els.singleExpenseStatusContainer = document.getElementById('singleExpenseStatusContainer');
    els.expenseStatusSelector = document.getElementById('expenseStatusSelector');
    els.singleExpenseReason = document.getElementById('singleExpenseReason');
    els.singleExpenseReasonContainer = document.getElementById('singleExpenseReasonContainer');
    els.singleExpenseAuditContainer = document.getElementById('singleExpenseAuditContainer');
    els.btnToggleAudit = document.getElementById('btnToggleAudit');
    els.auditTrailList = document.getElementById('auditTrailList');

    // Column manager modal
    els.btnColumnManager = document.getElementById('btnColumnManager');
    els.columnManagerModal = document.getElementById('columnManagerModal');
    els.btnCloseColumnManager = document.getElementById('btnCloseColumnManager');
    els.btnCloseColumnManagerFooter = document.getElementById('btnCloseColumnManagerFooter');

    // Duplicate detection button
    els.btnDetectDuplicates = document.getElementById('btnDetectDuplicates');
    els.btnResetColumns = document.getElementById('btnResetColumns');
    els.columnCheckboxes = document.getElementById('columnCheckboxes');

    // Bill edit modal
    els.billEditModal = document.getElementById('billEditModal');
    els.btnCloseBillModal = document.getElementById('btnCloseBillModal');
    els.btnCancelBillEdit = document.getElementById('btnCancelBillEdit');
    els.btnSaveBillEdit = document.getElementById('btnSaveBillEdit');
    els.billEditNumber = document.getElementById('billEditNumber');
    els.billEditExpenseCount = document.getElementById('billEditExpenseCount');
    els.billEditTotal = document.getElementById('billEditTotal');
    els.billStatusOptions = document.getElementById('billStatusOptions');
    els.billEditExpectedTotal = document.getElementById('billEditExpectedTotal');
    els.billEditVendor = document.getElementById('billEditVendor');
    els.billEditNotes = document.getElementById('billEditNotes');
    els.billReceiptSection = document.getElementById('billReceiptSection');
  }

  // ================================
  // AUTH & USER
  // ================================
  function initAuth() {
    const userRaw = localStorage.getItem('ngmUser');
    if (!userRaw) {
      window.location.href = 'login.html';
      return false;
    }

    try {
      currentUser = JSON.parse(userRaw);

      // Check if user can authorize expenses
      const userRole = currentUser.user_role || currentUser.role || '';
      canAuthorize = AUTHORIZED_ROLES.includes(userRole);
      console.log('[EXPENSES] User role:', userRole, '| Can authorize:', canAuthorize);
      console.log('[EXPENSES] Authorized roles:', AUTHORIZED_ROLES);
      console.log('[EXPENSES] User object:', currentUser);
    } catch (err) {
      console.error('[EXPENSES] Invalid ngmUser in localStorage', err);
      localStorage.removeItem('ngmUser');
      window.location.href = 'login.html';
      return false;
    }

    // Update user pill in topbar
    const userPill = document.getElementById('user-pill');
    if (userPill) {
      const name = currentUser.name || currentUser.username || currentUser.email || 'User';
      const role = currentUser.role || currentUser.role_id || '—';
      userPill.textContent = `${name} · ${role}`;
    }

    return true;
  }

  // ================================
  // API HELPERS
  // ================================
  function getApiBase() {
    const base = window.API_BASE || window.apiBase || 'https://ngm-fastapi.onrender.com';
    const result = String(base || '').replace(/\/+$/, '');
    console.log('[EXPENSES] getApiBase debug:', {
      'window.API_BASE': window.API_BASE,
      'result': result
    });
    return result;
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('ngmToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async function apiJson(url, options = {}) {
    // Get auth token and add to headers
    const token = localStorage.getItem('ngmToken');
    const headers = {
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      // Check for auth errors
      if (res.status === 401) {
        console.error('[API] Authentication failed - token may be expired');
        localStorage.removeItem('ngmToken');
        if (window.Toast) {
          Toast.error('Session Expired', 'Please log in again.');
        }
        window.location.href = 'login.html';
        return null;
      }
      throw new Error(`${options.method || 'GET'} ${url} failed (${res.status}): ${text}`);
    }
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      console.error('[API] Invalid JSON response from', url, ':', text.substring(0, 200));
      throw new Error(`Invalid JSON response from server: ${parseErr.message}`);
    }
  }

  /**
   * Show a confirm modal dialog (replaces window.confirm to avoid Chrome suppression)
   * @param {string} message - The message to display
   * @param {string} title - Optional title (default: "Confirm Action")
   * @param {string} confirmText - Optional confirm button text (default: "Confirm")
   * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
   */
  function showConfirmModal(message, title = 'Confirm Action', confirmText = 'Confirm') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmModalTitle');
      const messageEl = document.getElementById('confirmModalMessage');
      const btnOk = document.getElementById('btnConfirmOk');
      const btnCancel = document.getElementById('btnConfirmCancel');
      const btnClose = document.getElementById('btnCloseConfirmModal');

      if (!modal || !titleEl || !messageEl || !btnOk || !btnCancel) {
        console.warn('[CONFIRM MODAL] Modal elements not found, falling back to window.confirm');
        resolve(confirm(message));
        return;
      }

      titleEl.textContent = title;
      messageEl.textContent = message;
      btnOk.textContent = confirmText;
      modal.classList.remove('hidden');

      const cleanup = () => {
        modal.classList.add('hidden');
        btnOk.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
        btnClose.removeEventListener('click', onCancel);
      };

      const onConfirm = () => {
        cleanup();
        resolve(true);
      };

      const onCancel = () => {
        cleanup();
        resolve(false);
      };

      btnOk.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
      btnClose.addEventListener('click', onCancel);
    });
  }

  /**
   * Get JWT token from localStorage with validation
   * Redirects to login if token is missing or expired
   * @returns {string|null} The JWT token or null if invalid
   */
  function getAuthToken() {
    const token = localStorage.getItem('ngmToken');
    if (!token) {
      console.error('[AUTH] No JWT token found in localStorage');
      if (window.Toast) {
        Toast.error('Session Expired', 'Please log in again.');
      }
      window.location.href = 'login.html';
      return null;
    }
    // Basic JWT expiration check (JWT has 3 parts separated by dots)
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          console.error('[AUTH] JWT token has expired');
          localStorage.removeItem('ngmToken');
          if (window.Toast) {
            Toast.error('Session Expired', 'Please log in again.');
          }
          window.location.href = 'login.html';
          return null;
        }
      }
    } catch (e) {
      console.warn('[AUTH] Could not parse JWT for expiration check:', e);
      // Continue with token anyway - server will validate
    }
    return token;
  }

  // ================================
  // CURRENCY FORMATTING HELPERS
  // ================================
  // Single currency formatter instance (reused for performance)
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  /**
   * Format a number as USD currency string
   * @param {number|string} value - The value to format
   * @returns {string} Formatted currency string (e.g., "$1,234.56") or empty string
   */
  function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(num)) return '';
    return currencyFormatter.format(num);
  }

  function parseCurrency(formattedValue) {
    if (!formattedValue) return null;
    const cleaned = String(formattedValue).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  // ================================
  // LOAD META DATA
  // ================================
  async function loadMetaData() {
    const apiBase = getApiBase();
    console.log('[EXPENSES] loadMetaData called, apiBase:', apiBase);

    try {
      const url = `${apiBase}/expenses/meta`;
      console.log('[EXPENSES] Fetching metadata from:', url);

      const meta = await apiJson(url);
      console.log('[EXPENSES] Raw metadata response:', meta);

      if (!meta) {
        throw new Error('No metadata received from server');
      }

      metaData.txn_types = meta.txn_types || [];
      metaData.projects = meta.projects || [];
      metaData.vendors = meta.vendors || [];
      metaData.payment_methods = meta.payment_methods || [];

      // TODO: Re-enable account filtering when frontend mode switching is implemented
      // For now, show all accounts in both modes
      metaData.accounts = meta.accounts || [];
      console.log('[EXPENSES] All accounts loaded (filtering disabled):', metaData.accounts.length);

      // Debug: Log metadata structure to help identify correct column names
      console.log('[METADATA] txn_types count:', metaData.txn_types.length);
      console.log('[METADATA] projects count:', metaData.projects.length);
      console.log('[METADATA] vendors count:', metaData.vendors.length);
      console.log('[METADATA] payment_methods count:', metaData.payment_methods.length);
      console.log('[METADATA] accounts count:', metaData.accounts.length);
      console.log('[METADATA] txn_types sample:', metaData.txn_types[0]);
      console.log('[METADATA] projects sample:', metaData.projects[0]);
      console.log('[METADATA] accounts sample:', metaData.accounts[0]);
      console.log('[METADATA] vendors sample:', metaData.vendors[0]);
      console.log('[METADATA] payment_methods sample:', metaData.payment_methods[0]);

      // Load bills metadata separately (from bills table)
      await loadBillsMetadata();

      // PERFORMANCE: Build lookup maps for O(1) access
      buildLookupMaps();

      // Populate project filter dropdown
      populateProjectFilter();

    } catch (err) {
      console.error('[EXPENSES] Error loading meta data:', err);
      if (window.Toast) {
        Toast.error('Error Loading Data', 'Please refresh the page.', { details: err.message });
      }
    }
  }

  // ================================
  // LOAD BILLS METADATA
  // ================================
  async function loadBillsMetadata() {
    const apiBase = getApiBase();
    try {
      const url = `${apiBase}/bills`;
      console.log('[BILLS] Fetching bills metadata from:', url);

      const result = await apiJson(url);

      // Handle different response formats
      if (Array.isArray(result)) {
        metaData.bills = result;
      } else if (result && Array.isArray(result.data)) {
        metaData.bills = result.data;
      } else if (result && Array.isArray(result.bills)) {
        metaData.bills = result.bills;
      } else {
        metaData.bills = [];
      }

      console.log('[BILLS] Loaded bills count:', metaData.bills.length);
      console.log('[BILLS] Bills sample:', metaData.bills[0]);
    } catch (err) {
      // Bills table might not exist yet or endpoint not available - graceful fallback
      console.warn('[BILLS] Could not load bills metadata:', err.message);
      metaData.bills = [];
    }
  }

  /**
   * Get bill metadata by bill_id
   * @param {string} billId - The bill ID to look up
   * @returns {Object|null} - Bill metadata or null if not found
   */
  function getBillMetadata(billId) {
    if (!billId || !metaData.bills.length) return null;
    return metaData.bills.find(b => b.bill_id === billId) || null;
  }

  /**
   * Upsert bill data in local cache
   * Prevents duplicates by updating existing entry or adding new one
   * @param {Object} billData - Bill data object with bill_id
   */
  function upsertBillInCache(billData) {
    if (!billData || !billData.bill_id) return;

    const existingIndex = metaData.bills.findIndex(b => b.bill_id === billData.bill_id);

    if (existingIndex >= 0) {
      // Update existing entry
      Object.assign(metaData.bills[existingIndex], billData);
      console.log('[BILLS] Updated bill in cache:', billData.bill_id);
    } else {
      // Add new entry
      metaData.bills.push(billData);
      console.log('[BILLS] Added bill to cache:', billData.bill_id);
    }
  }

  /**
   * Get receipt URL for an expense
   * Checks bills table first (new system), then expense.receipt_url (legacy)
   * @param {Object} expense - The expense object
   * @returns {string|null} - Receipt URL or null if not found
   */
  function getExpenseReceiptUrl(expense) {
    if (!expense) return null;

    const billId = expense.bill_id?.trim();

    // Priority 1: Get from bills table
    if (billId) {
      const billData = getBillMetadata(billId);
      if (billData?.receipt_url) {
        return billData.receipt_url;
      }
    }

    // Priority 2: Get from expense (legacy support)
    if (expense.receipt_url) {
      return expense.receipt_url;
    }

    return null;
  }

  function populateProjectFilter() {
    console.log('[EXPENSES] populateProjectFilter called');
    console.log('[EXPENSES] els.projectFilter:', els.projectFilter);
    console.log('[EXPENSES] metaData.projects:', metaData.projects);

    if (!els.projectFilter) {
      console.error('[EXPENSES] projectFilter element not found!');
      return;
    }

    // Clear existing options except first
    els.projectFilter.innerHTML = '<option value="">Select project...</option>';

    // Add "All Projects" option
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Projects';
    els.projectFilter.appendChild(allOpt);

    metaData.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id || p.id;
      opt.textContent = p.project_name || p.name || 'Unnamed Project';
      els.projectFilter.appendChild(opt);
      console.log('[EXPENSES] Added project option:', opt.value, opt.textContent);
    });

    console.log('[EXPENSES] Total project options added:', metaData.projects.length);
  }

  // ================================
  // LOAD EXPENSES BY PROJECT
  // ================================
  async function loadExpensesByProject(projectId) {
    if (!projectId) {
      expenses = [];
      showEmptyState(currentModeConfig.emptyMessage);
      return;
    }

    // Check if we're in QBO mode, redirect to QBO loading (not supported for "all")
    if (currentDataSource === 'qbo' && projectId !== 'all') {
      await loadQBOExpenses(projectId);
      return;
    }

    const apiBase = getApiBase();

    try {
      showEmptyState('Loading expenses...');

      // Use different endpoint for "all projects"
      const url = projectId === 'all'
        ? `${apiBase}/expenses/all`
        : `${apiBase}/expenses?project=${projectId}`;
      console.log('[EXPENSES] Fetching from:', url);

      const result = await apiJson(url);
      console.log('[EXPENSES] API Response:', result);
      console.log('[EXPENSES] Response type:', typeof result);
      console.log('[EXPENSES] Is Array?', Array.isArray(result));

      // Handle different response formats
      if (Array.isArray(result)) {
        expenses = result;
      } else if (result && Array.isArray(result.data)) {
        expenses = result.data;
      } else if (result && Array.isArray(result.expenses)) {
        expenses = result.expenses;
      } else {
        expenses = [];
      }

      console.log('[EXPENSES] Processed expenses count:', expenses.length);
      console.log('[EXPENSES] First expense:', expenses[0]);

      // Detect duplicate bill numbers with different vendors
      await detectDuplicateBillNumbers();

      if (expenses.length === 0) {
        showEmptyState(projectId === 'all' ? currentModeConfig.noDataMessage : currentModeConfig.noDataMessage);
      } else {
        renderExpensesTable();
      }

    } catch (err) {
      console.error('[EXPENSES] Error loading expenses:', err);
      console.error('[EXPENSES] Error details:', err.message);
      showEmptyState('Error loading expenses: ' + err.message);
    }
  }

  // ================================
  // DUPLICATE BILL DETECTION (Enhanced System)
  // ================================

  /**
   * Normalizes a bill ID for comparison
   * Removes special characters, converts to uppercase, trims whitespace
   * @param {string} billId - Raw bill ID
   * @returns {string|null} - Normalized bill ID or null
   */
  function normalizeBillId(billId) {
    if (!billId) return null;
    return billId
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, ''); // Remove all non-alphanumeric chars
  }

  /**
   * Calculates a dynamic threshold for duplicate detection based on amount
   * Larger amounts have tighter tolerance, smaller amounts more lenient
   * @param {number} amount - Transaction amount
   * @returns {number} - Percentage threshold (0-5)
   */
  function getDuplicateThreshold(amount) {
    // Ultra-strict thresholds - detect even cent differences
    // Returns maximum percentage difference allowed
    if (amount >= 10000) return 0.1;   // 0.1% for large amounts ($10k+ = max $10 diff)
    if (amount >= 1000) return 0.2;    // 0.2% for medium amounts ($1k-$10k = max $2 diff)
    if (amount >= 100) return 0.5;     // 0.5% for small amounts ($100-$1k = max $0.50 diff)
    if (amount >= 10) return 1;        // 1% for tiny amounts ($10-$100 = max $0.10 diff)
    return 2;                           // 2% for very small amounts (<$10 = max $0.20 diff)
  }

  /**
   * Calculates Levenshtein distance between two strings (fuzzy matching)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  function levenshteinDistance(str1, str2) {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (!s1 || !s2) return 999; // High distance if either is empty
    if (s1 === s2) return 0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }

    return matrix[len2][len1];
  }

  /**
   * Calculates similarity score between two strings (0-1)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity score (0 = no match, 1 = perfect match)
   */
  function calculateStringSimilarity(str1, str2) {
    const s1 = (str1 || '').toLowerCase().trim();
    const s2 = (str2 || '').toLowerCase().trim();

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;

    const distance = levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);

    return 1 - (distance / maxLen);
  }

  /**
   * Generates a unique pair key for dismissal tracking
   * @param {string} id1 - First expense ID
   * @param {string} id2 - Second expense ID
   * @returns {string} - Sorted pair key
   */
  function getDuplicatePairKey(id1, id2) {
    return [id1, id2].sort().join(':');
  }

  /**
   * Checks if a pair has been dismissed as "not duplicate"
   * @param {string} id1 - First expense ID
   * @param {string} id2 - Second expense ID
   * @returns {boolean} - True if dismissed
   */
  function isPairDismissed(id1, id2) {
    return dismissedDuplicates.has(getDuplicatePairKey(id1, id2));
  }

  /**
   * Loads dismissed duplicate pairs from backend API
   */
  async function loadDismissedDuplicates() {
    try {
      if (!currentUser || !currentUser.user_id) {
        console.warn('[DUPLICATES] No user logged in, cannot load dismissed duplicates');
        dismissedDuplicates = new Set();
        return;
      }

      const response = await fetch(`${API_BASE}/expenses/dismissed-duplicates?user_id=${currentUser.user_id}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const dismissals = result.data || [];

      // Build Set of pair keys from API data
      dismissedDuplicates = new Set();
      dismissals.forEach(d => {
        const pairKey = getDuplicatePairKey(d.expense_id_1, d.expense_id_2);
        dismissedDuplicates.add(pairKey);
      });

      console.log(`[DUPLICATES] Loaded ${dismissedDuplicates.size} dismissed pairs from backend`);
    } catch (e) {
      console.warn('[DUPLICATES] Error loading dismissed duplicates:', e);
      dismissedDuplicates = new Set();
    }
  }

  /**
   * Saves a dismissed duplicate pair to backend API
   * @param {string} expenseId1 - First expense ID
   * @param {string} expenseId2 - Second expense ID
   * @returns {Promise<boolean>} - Success status
   */
  async function saveDismissedDuplicatePair(expenseId1, expenseId2) {
    try {
      if (!currentUser || !currentUser.user_id) {
        console.warn('[DUPLICATES] No user logged in, cannot save dismissal');
        return false;
      }

      const response = await fetch(`${API_BASE}/expenses/dismissed-duplicates`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          expense_id_1: expenseId1,
          expense_id_2: expenseId2,
          reason: 'not_duplicate'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(`[DUPLICATES] Saved dismissal to backend:`, result);
      return true;
    } catch (e) {
      console.error('[DUPLICATES] Error saving dismissal:', e);
      if (window.Toast) {
        Toast.error('Error', 'Failed to save dismissal');
      }
      return false;
    }
  }

  /**
   * Detects expenses that are almost certainly duplicates.
   * ENHANCED VERSION with normalization, clustering, and smart thresholds
   *
   * Criteria for "almost certain" duplicate:
   * 1. EXACT: Same vendor + same bill_id + same amount + same date
   * 2. STRONG: Same vendor + same bill_id + same amount (different dates allowed - could be entry error)
   * 3. LIKELY: Same vendor + same amount + same date (no bill_id needed - very suspicious)
   *
   * We do NOT alert on:
   * - Same bill_id but different vendors (could be coincidence - different vendors can have same invoice #)
   * - Same vendor + same bill_id but different amounts (could be intentional line items)
   */
  async function detectDuplicateBillNumbers() {
    console.log('[DUPLICATES] Starting enhanced duplicate detection...');

    duplicateBillWarnings.clear();
    duplicateClusters = [];

    // Skip if no expenses
    if (!expenses || expenses.length < 2) {
      console.log('[DUPLICATES] Not enough expenses to check');
      return;
    }

    // Load dismissed pairs from backend
    await loadDismissedDuplicates();

    // OPTIMIZATION: Group expenses by vendor first (reduces comparisons from O(n²) to O(n))
    const byVendor = new Map();
    expenses.forEach(exp => {
      const vendorId = exp.vendor_id;
      if (!vendorId) return; // Skip expenses without vendor

      if (!byVendor.has(vendorId)) {
        byVendor.set(vendorId, []);
      }
      byVendor.get(vendorId).push(exp);
    });

    console.log(`[DUPLICATES] Grouped ${expenses.length} expenses into ${byVendor.size} vendor groups`);

    const duplicatePairs = [];

    // Only compare expenses from SAME vendor
    byVendor.forEach((vendorExpenses, vendorId) => {
      if (vendorExpenses.length < 2) return; // Skip if vendor has only 1 expense

      for (let i = 0; i < vendorExpenses.length; i++) {
        const exp1 = vendorExpenses[i];
        const exp1Id = exp1.expense_id || exp1.id;
        const exp1BillId = normalizeBillId(exp1.bill_id);
        const exp1Amount = parseFloat(exp1.Amount) || 0;
        const exp1Date = exp1.TxnDate?.split('T')[0];

        for (let j = i + 1; j < vendorExpenses.length; j++) {
          const exp2 = vendorExpenses[j];
          const exp2Id = exp2.expense_id || exp2.id;
          const exp2BillId = normalizeBillId(exp2.bill_id);
          const exp2Amount = parseFloat(exp2.Amount) || 0;
          const exp2Date = exp2.TxnDate?.split('T')[0];

          // Skip if this pair was already dismissed
          if (isPairDismissed(exp1Id, exp2Id)) {
            console.log(`[DUPLICATES] Skipping dismissed pair: ${exp1Id} <-> ${exp2Id}`);
            continue;
          }

          // ========================================
          // NEW SCORING MATRIX SYSTEM
          // ========================================

          // Extract all comparable fields
          const exp1PaymentType = exp1.PaymentType || '';
          const exp2PaymentType = exp2.PaymentType || '';
          const exp1Account = exp1.Account || '';
          const exp2Account = exp2.Account || '';
          const exp1Description = exp1.LineDescription || '';
          const exp2Description = exp2.LineDescription || '';

          // Field comparisons
          const sameBillId = exp1BillId && exp2BillId && exp1BillId === exp2BillId;

          // Amount comparison with dynamic threshold
          const threshold = getDuplicateThreshold(exp1Amount);
          const amountDiff = Math.abs(exp1Amount - exp2Amount);
          const avgAmount = (exp1Amount + exp2Amount) / 2;
          const diffPercent = avgAmount > 0 ? (amountDiff / avgAmount) * 100 : 0;
          const sameAmount = exp1Amount > 0 && exp2Amount > 0 && diffPercent <= threshold;

          // Date comparison
          const sameDate = exp1Date && exp2Date && exp1Date === exp2Date;

          // Date difference in days
          let dateDiffDays = 999;
          if (exp1Date && exp2Date) {
            const d1 = new Date(exp1Date);
            const d2 = new Date(exp2Date);
            dateDiffDays = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
          }

          const samePaymentType = exp1PaymentType && exp2PaymentType &&
                                   exp1PaymentType.toLowerCase() === exp2PaymentType.toLowerCase();

          const sameAccount = exp1Account && exp2Account && exp1Account === exp2Account;

          // Fuzzy match for description
          const descriptionSimilarity = calculateStringSimilarity(exp1Description, exp2Description);

          // ========================================
          // SCORING ALGORITHM (0-100 points)
          // ========================================

          let score = 0;
          const matchReasons = [];

          // Base requirement: Same vendor + Same amount (MANDATORY)
          if (!sameAmount) continue; // Skip if amounts don't match

          score += 40; // Base score for same vendor + amount
          matchReasons.push('Same vendor & amount');

          // Bonus for near-identical amounts (within cents)
          if (amountDiff <= 0.05) {
            score += 15;
            matchReasons.push('Near-identical amount');
          } else if (amountDiff <= 0.50) {
            score += 10;
            matchReasons.push(`Amount diff: $${amountDiff.toFixed(2)}`);
          } else if (amountDiff <= 2.00) {
            score += 5;
            matchReasons.push(`Amount diff: $${amountDiff.toFixed(2)}`);
          }

          // Core field bonuses
          if (sameDate) {
            score += 25;
            matchReasons.push('Same date');
          } else if (dateDiffDays <= 7) {
            score += 15;
            matchReasons.push(`Date diff: ${dateDiffDays} days`);
          } else if (dateDiffDays <= 30) {
            score += 5;
            matchReasons.push(`Date diff: ${dateDiffDays} days`);
          }

          if (sameBillId) {
            score += 15;
            matchReasons.push('Same bill ID');
          }

          if (samePaymentType) {
            score += 10;
            matchReasons.push('Same payment type');
          }

          if (sameAccount) {
            score += 5;
            matchReasons.push('Same account');
          }

          if (descriptionSimilarity >= 0.9) {
            score += 10;
            matchReasons.push(`Description match: ${Math.round(descriptionSimilarity * 100)}%`);
          } else if (descriptionSimilarity >= 0.7) {
            score += Math.round(descriptionSimilarity * 10);
            matchReasons.push(`Description match: ${Math.round(descriptionSimilarity * 100)}%`);
          }

          // Penalties
          if (dateDiffDays > 30) {
            score -= 15;
            matchReasons.push('⚠ Date diff >30 days');
          }

          if (exp1Account && exp2Account && !sameAccount) {
            score -= 10;
            matchReasons.push('⚠ Different account');
          }

          if (exp1PaymentType && exp2PaymentType && !samePaymentType) {
            score -= 10;
            matchReasons.push('⚠ Different payment type');
          }

          // TIMESTAMP PROXIMITY CHECK: If created within seconds of each other,
          // they're likely intentional line items from the same bill entry, NOT duplicates
          const exp1CreatedAt = exp1.created_at;
          const exp2CreatedAt = exp2.created_at;
          if (exp1CreatedAt && exp2CreatedAt) {
            const ts1 = new Date(exp1CreatedAt).getTime();
            const ts2 = new Date(exp2CreatedAt).getTime();
            const timestampDiffSeconds = Math.abs(ts1 - ts2) / 1000;

            if (timestampDiffSeconds < 30) {
              // Created within 30 seconds - very likely same batch entry, skip entirely
              console.log(`[DUPLICATES] Skipping pair (created ${timestampDiffSeconds.toFixed(1)}s apart): ${exp1Id} <-> ${exp2Id}`);
              continue;
            } else if (timestampDiffSeconds < 120) {
              // Created within 2 minutes - probably same session, strong penalty
              score -= 40;
              matchReasons.push(`⚠ Created ${Math.round(timestampDiffSeconds)}s apart (same batch?)`);
            } else if (timestampDiffSeconds < 300) {
              // Created within 5 minutes - possibly same session, moderate penalty
              score -= 20;
              matchReasons.push(`⚠ Created ${Math.round(timestampDiffSeconds / 60)}min apart`);
            }
          }

          // Classify based on score
          let duplicateType = null;
          let confidence = null;

          if (score >= 95) {
            duplicateType = 'exact';
            confidence = 'very_high';
          } else if (score >= 75) {
            duplicateType = 'strong';
            confidence = 'high';
          } else if (score >= 40) {
            duplicateType = 'likely';
            confidence = 'medium';
          }
          // Below 40 = not reported as duplicate

          if (duplicateType) {
            const vendorName = exp1.vendor_name || findMetaName('vendors', vendorId, 'id', 'vendor_name') || 'Unknown';

            duplicatePairs.push({
              type: duplicateType,
              confidence,
              score,
              matchReasons,
              expense1Id: exp1Id,
              expense2Id: exp2Id,
              expense1: exp1,
              expense2: exp2,
              vendorId,
              vendorName,
              billId: exp1.bill_id || exp2.bill_id || null,
              amount: exp1Amount,
              date1: exp1Date,
              date2: exp2Date
            });

            console.log(`[DUPLICATES] ${duplicateType.toUpperCase()} (${score}pts): ${vendorName} - $${exp1Amount.toFixed(2)} | ${matchReasons.join(', ')}`);
          }
        }
      }
    });

    console.log(`[DUPLICATES] Found ${duplicatePairs.length} duplicate pairs`);

    if (duplicatePairs.length === 0) {
      console.log('[DUPLICATES] No duplicates found');
      return;
    }

    // BUILD CLUSTERS: Group related duplicates together
    // If expense A duplicates B, and B duplicates C, they form a cluster [A, B, C]
    const expenseToCluster = new Map();
    let clusterIdCounter = 0;

    duplicatePairs.forEach(pair => {
      const { expense1Id, expense2Id } = pair;

      let cluster1 = expenseToCluster.get(expense1Id);
      let cluster2 = expenseToCluster.get(expense2Id);

      if (!cluster1 && !cluster2) {
        // Neither expense in a cluster yet - create new cluster
        const newClusterId = clusterIdCounter++;
        expenseToCluster.set(expense1Id, newClusterId);
        expenseToCluster.set(expense2Id, newClusterId);
      } else if (cluster1 && !cluster2) {
        // exp1 already in a cluster, add exp2 to it
        expenseToCluster.set(expense2Id, cluster1);
      } else if (!cluster1 && cluster2) {
        // exp2 already in a cluster, add exp1 to it
        expenseToCluster.set(expense1Id, cluster2);
      } else if (cluster1 !== cluster2) {
        // Both in different clusters - merge clusters
        const mergeFrom = cluster2;
        const mergeTo = cluster1;
        expenseToCluster.forEach((clusterId, expId) => {
          if (clusterId === mergeFrom) {
            expenseToCluster.set(expId, mergeTo);
          }
        });
      }
    });

    // Group expenses by cluster ID
    const clusterMap = new Map();
    expenseToCluster.forEach((clusterId, expenseId) => {
      if (!clusterMap.has(clusterId)) {
        clusterMap.set(clusterId, []);
      }
      const expense = expenses.find(e => (e.expense_id || e.id) === expenseId);
      if (expense) {
        clusterMap.set(clusterId, [...clusterMap.get(clusterId), expense]);
      }
    });

    // Convert clusters to array format
    duplicateClusters = Array.from(clusterMap.values()).map(expenseList => {
      // Get the first pair's metadata for this cluster
      const firstExpId = expenseList[0].expense_id || expenseList[0].id;
      const pairWithThis = duplicatePairs.find(p =>
        p.expense1Id === firstExpId || p.expense2Id === firstExpId
      );

      return {
        expenses: expenseList,
        type: pairWithThis?.type || 'likely',
        confidence: pairWithThis?.confidence || 'medium',
        score: pairWithThis?.score || 0,
        matchReasons: pairWithThis?.matchReasons || [],
        vendorName: pairWithThis?.vendorName || 'Unknown',
        amount: pairWithThis?.amount || 0,
        billId: pairWithThis?.billId
      };
    });

    // Sort clusters by severity (exact first, then strong, then likely)
    const typePriority = { exact: 3, strong: 2, likely: 1 };
    duplicateClusters.sort((a, b) => {
      return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    });

    console.log(`[DUPLICATES] Created ${duplicateClusters.length} clusters`);

    // Populate legacy duplicateBillWarnings map for backwards compatibility
    duplicateClusters.forEach(cluster => {
      cluster.expenses.forEach(exp => {
        const expId = exp.expense_id || exp.id;
        duplicateBillWarnings.set(expId, {
          type: cluster.type,
          confidence: cluster.confidence,
          vendorName: cluster.vendorName,
          billId: cluster.billId,
          amount: cluster.amount,
          clusterSize: cluster.expenses.length
        });
      });
    });

    // Show notification but DON'T auto-open panel
    console.log(`[DUPLICATES] Detection complete: ${duplicateClusters.length} clusters found`);
    if (duplicateClusters.length > 0) {
      console.log('[DUPLICATES] Duplicates detected - showing notification');
      currentClusterIndex = 0; // Reset to first cluster

      // Update button badge to show count
      updateDuplicatesButtonBadge();

      // Show notification with summary
      const exactCount = duplicateClusters.filter(c => c.type === 'exact').length;
      const strongCount = duplicateClusters.filter(c => c.type === 'strong').length;
      const likelyCount = duplicateClusters.filter(c => c.type === 'likely').length;

      let summaryMsg = `Found ${duplicateClusters.length} potential duplicate${duplicateClusters.length > 1 ? 's' : ''}`;
      if (exactCount > 0) summaryMsg += ` (${exactCount} exact)`;
      if (strongCount > 0) summaryMsg += ` (${strongCount} strong)`;
      if (likelyCount > 0) summaryMsg += ` (${likelyCount} likely)`;

      if (window.Toast) {
        Toast.warning('Duplicates Detected', `${summaryMsg}. Click "Health Check" to review.`);
      }

      // DO NOT auto-open panel - user must click button to open
    } else {
      console.log('[DUPLICATES] No duplicates found in current expenses');
    }
  }

  /**
   * Checks if a new expense would create a duplicate
   * Only returns conflict if it's almost certainly a duplicate:
   * - Same vendor + same bill_id + same amount
   * - Same vendor + same amount + same date
   *
   * @param {string} billId - The bill number to check
   * @param {string} vendorId - The vendor ID for the new expense
   * @param {number} amount - The amount of the new expense (optional)
   * @param {string} date - The date of the new expense (optional)
   * @returns {object|null} - Returns conflict info or null
   */
  function checkBillVendorConflict(billId, vendorId, amount = null, date = null) {
    if (!vendorId) return null;

    const trimmedBillId = billId?.trim() || null;
    const normalizedDate = date?.split('T')[0] || null;
    const numAmount = amount !== null ? parseFloat(amount) : null;

    // Look for potential duplicates with same vendor
    const sameVendorExpenses = expenses.filter(exp => exp.vendor_id === vendorId);

    for (const exp of sameVendorExpenses) {
      const expBillId = exp.bill_id?.trim();
      const expAmount = parseFloat(exp.Amount) || 0;
      const expDate = exp.TxnDate?.split('T')[0];

      const sameBillId = trimmedBillId && expBillId && trimmedBillId === expBillId;
      const sameAmount = numAmount !== null && numAmount > 0 && Math.abs(numAmount - expAmount) < 0.01;
      const sameDate = normalizedDate && expDate && normalizedDate === expDate;

      // Check for strong duplicate indicators
      let duplicateType = null;

      if (sameBillId && sameAmount) {
        duplicateType = 'strong'; // Same vendor + bill + amount
      } else if (sameAmount && sameDate && numAmount >= 50) {
        duplicateType = 'likely'; // Same vendor + amount + date (significant amount)
      }

      if (duplicateType) {
        const vendorName = exp.vendor_name || findMetaName('vendors', vendorId, 'id', 'vendor_name') || 'Unknown';
        return {
          type: duplicateType,
          billId: expBillId || trimmedBillId,
          existingVendorId: vendorId,
          existingVendorName: vendorName,
          existingAmount: expAmount,
          existingDate: expDate,
          existingExpenseId: exp.expense_id || exp.id
        };
      }
    }

    return null;
  }

  // ================================
  // DUPLICATE REVIEW UI
  // ================================

  /**
   * Shows the Health Check panel with navigation
   */
  function showDuplicateReviewPanel() {
    // Detect missing info expenses
    detectMissingInfo();

    // If no issues at all, show success toast and return
    if (duplicateClusters.length === 0 && missingInfoExpenses.length === 0) {
      console.log('[HEALTH CHECK] No issues found');
      if (window.Toast) {
        Toast.success('All Clear! ✓', 'No duplicates or missing info found. Your expenses are healthy!');
      }
      return;
    }

    // Create panel if it doesn't exist
    let panel = document.getElementById('duplicateReviewPanel');
    if (!panel) {
      panel = createDuplicateReviewPanel();
    }

    // Reset panel position when showing
    panel.style.transform = '';
    panel.style.right = '20px';
    panel.style.top = '80px';
    panel.style.left = 'auto';

    panel.style.display = 'flex'; // Use flex to show properly

    // Update tab badges
    const duplicatesBadge = document.getElementById('tabBadgeDuplicates');
    const missingBadge = document.getElementById('tabBadgeMissing');
    if (duplicatesBadge) duplicatesBadge.textContent = duplicateClusters.length;
    if (missingBadge) missingBadge.textContent = missingInfoExpenses.length;

    // Switch to appropriate tab based on what has issues
    if (duplicateClusters.length > 0) {
      switchHealthCheckTab('duplicates');
      updateDuplicateReviewPanel();
      highlightCurrentCluster();
    } else if (missingInfoExpenses.length > 0) {
      switchHealthCheckTab('missing');
      updateMissingInfoPanel();
    }

    updateHealthCheckSuccessState();
  }

  /**
   * Creates the Health Check panel DOM element with tabs
   */
  function createDuplicateReviewPanel() {
    const panel = document.createElement('div');
    panel.id = 'duplicateReviewPanel';
    panel.className = 'duplicate-review-panel health-check-panel';
    panel.innerHTML = `
      <div class="duplicate-panel-header health-check-header" id="healthCheckDragHandle">
        <h3 class="duplicate-panel-title">Health Check</h3>
        <button type="button" class="duplicate-panel-close" onclick="hideDuplicateReviewPanel()">×</button>
      </div>

      <!-- Tabs -->
      <div class="health-check-tabs">
        <button type="button" class="health-check-tab active" data-tab="duplicates" onclick="switchHealthCheckTab('duplicates')">
          Duplicates
          <span class="tab-badge" id="tabBadgeDuplicates">0</span>
        </button>
        <button type="button" class="health-check-tab" data-tab="missing" onclick="switchHealthCheckTab('missing')">
          Missing Info
          <span class="tab-badge" id="tabBadgeMissing">0</span>
        </button>
      </div>

      <!-- Success State (shown when all clear) -->
      <div class="health-check-success hidden" id="healthCheckSuccess">
        <div class="success-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <div class="success-title">All Clear</div>
        <div class="success-message">No issues found. Your expenses are healthy.</div>
      </div>

      <!-- Duplicates Tab Content -->
      <div class="health-check-tab-content" id="tabContentDuplicates">
        <div class="duplicate-panel-body">
          <div class="duplicate-panel-counter">
            <span id="duplicateCurrentCluster">1</span> of <span id="duplicateTotalClusters">0</span>
          </div>
          <div class="duplicate-panel-info" id="duplicatePanelInfo">
            <!-- Cluster info populated here -->
          </div>
          <div class="duplicate-panel-expenses" id="duplicatePanelExpenses">
            <!-- Expense cards populated here -->
          </div>
        </div>
        <div class="duplicate-panel-actions">
          <button type="button" class="btn-duplicate-nav" id="btnPrevCluster" onclick="prevDuplicateCluster()">
            Previous
          </button>
          <button type="button" class="btn-duplicate-dismiss" onclick="dismissCurrentCluster()">
            Not a Duplicate
          </button>
          <button type="button" class="btn-duplicate-nav" id="btnNextCluster" onclick="nextDuplicateCluster()">
            Next
          </button>
        </div>
      </div>

      <!-- Missing Info Tab Content -->
      <div class="health-check-tab-content hidden" id="tabContentMissing">
        <div class="duplicate-panel-body">
          <div class="duplicate-panel-counter">
            <span id="missingCurrentIndex">1</span> of <span id="missingTotalCount">0</span>
          </div>
          <div class="missing-info-card" id="missingInfoCard">
            <!-- Missing info expense populated here -->
          </div>
        </div>
        <div class="duplicate-panel-actions">
          <button type="button" class="btn-duplicate-nav" id="btnPrevMissing" onclick="prevMissingInfo()">
            Previous
          </button>
          <button type="button" class="btn-missing-goto" onclick="goToMissingExpense()">
            Edit Expense
          </button>
          <button type="button" class="btn-duplicate-nav" id="btnNextMissing" onclick="nextMissingInfo()">
            Next
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Make panel draggable
    initDraggablePanel(panel);

    return panel;
  }

  /**
   * Initialize draggable functionality for a panel
   */
  function initDraggablePanel(panel) {
    const handle = panel.querySelector('#healthCheckDragHandle');
    if (!handle) return;

    let isDragging = false;
    let startX;
    let startY;
    let panelStartX;
    let panelStartY;
    let hasBeenDragged = false;

    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
      // Don't drag if clicking close button
      if (e.target.closest('.duplicate-panel-close')) return;

      const rect = panel.getBoundingClientRect();

      // Store mouse start position
      startX = e.clientX;
      startY = e.clientY;

      // Store panel's current position
      panelStartX = rect.left;
      panelStartY = rect.top;

      isDragging = true;
      handle.style.cursor = 'grabbing';
      panel.style.transition = 'none';
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault();

      // Calculate how much the mouse has moved
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // New position = start position + delta
      let newX = panelStartX + deltaX;
      let newY = panelStartY + deltaY;

      // Keep panel within viewport
      const rect = panel.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      newX = Math.min(Math.max(0, newX), maxX);
      newY = Math.min(Math.max(0, newY), maxY);

      // On first drag, switch from right/top positioning to left/top
      if (!hasBeenDragged) {
        panel.style.right = 'auto';
        panel.style.position = 'fixed';
        hasBeenDragged = true;
      }

      panel.style.left = `${newX}px`;
      panel.style.top = `${newY}px`;
      panel.style.transform = 'none';
    }

    function dragEnd() {
      if (isDragging) {
        // Update start positions for next drag
        const rect = panel.getBoundingClientRect();
        panelStartX = rect.left;
        panelStartY = rect.top;
      }
      isDragging = false;
      handle.style.cursor = 'grab';
      panel.style.transition = '';
    }
  }

  /**
   * Switch between Health Check tabs
   */
  function switchHealthCheckTab(tabName) {
    healthCheckActiveTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.health-check-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.getElementById('tabContentDuplicates').classList.toggle('hidden', tabName !== 'duplicates');
    document.getElementById('tabContentMissing').classList.toggle('hidden', tabName !== 'missing');

    // Update highlighting based on active tab
    if (tabName === 'duplicates') {
      highlightCurrentCluster();
    } else {
      // Remove duplicate highlights (including health check selection)
      document.querySelectorAll('.expense-row-duplicate-warning, .expense-row-duplicate-current, .expense-row-health-check-selected').forEach(row => {
        row.classList.remove('expense-row-duplicate-warning', 'expense-row-duplicate-current', 'expense-row-health-check-selected');
      });
      // Navigate to current missing info expense (will add its own highlight)
      scrollToMissingExpense();
    }
  }

  window.switchHealthCheckTab = switchHealthCheckTab;

  /**
   * Detect expenses missing bill number or receipt
   */
  function detectMissingInfo() {
    missingInfoExpenses = expenses.filter(exp => {
      const hasBillNumber = exp.bill_id && exp.bill_id.trim() !== '';
      const hasReceipt = !!getExpenseReceiptUrl(exp);
      return !hasBillNumber || !hasReceipt;
    });

    currentMissingInfoIndex = 0;
    console.log(`[HEALTH CHECK] Found ${missingInfoExpenses.length} expenses with missing info`);
    return missingInfoExpenses.length;
  }

  /**
   * Update the Missing Info tab content
   */
  function updateMissingInfoPanel() {
    const countEl = document.getElementById('missingCurrentIndex');
    const totalEl = document.getElementById('missingTotalCount');
    const cardEl = document.getElementById('missingInfoCard');
    const badgeEl = document.getElementById('tabBadgeMissing');

    if (badgeEl) badgeEl.textContent = missingInfoExpenses.length;

    if (missingInfoExpenses.length === 0) {
      if (countEl) countEl.textContent = '0';
      if (totalEl) totalEl.textContent = '0';
      if (cardEl) cardEl.innerHTML = `
        <div class="missing-empty-state">
          <svg class="missing-empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span class="missing-empty-text">All expenses have bill numbers and receipts</span>
        </div>
      `;
      return;
    }

    const exp = missingInfoExpenses[currentMissingInfoIndex];
    if (!exp) return;

    if (countEl) countEl.textContent = currentMissingInfoIndex + 1;
    if (totalEl) totalEl.textContent = missingInfoExpenses.length;

    const expId = exp.expense_id || exp.id;
    const hasBillNumber = exp.bill_id && exp.bill_id.trim() !== '';
    const hasReceipt = !!getExpenseReceiptUrl(exp);
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : 'No date';
    const desc = exp.LineDescription || 'No description';
    const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
    const amount = exp.Amount ? formatCurrency(Number(exp.Amount)) : '$0.00';

    const missingItems = [];
    if (!hasBillNumber) missingItems.push('<span class="missing-item">No Bill Number</span>');
    if (!hasReceipt) missingItems.push('<span class="missing-item">No Receipt</span>');

    if (cardEl) cardEl.innerHTML = `
      <div class="missing-expense-card" data-expense-id="${expId}">
        <div class="missing-expense-header">
          <span class="missing-expense-date">${date}</span>
          <span class="missing-expense-amount">${amount}</span>
        </div>
        <div class="missing-expense-body">
          <div class="missing-expense-vendor">${vendor}</div>
          <div class="missing-expense-desc">${desc}</div>
        </div>
        <div class="missing-expense-issues">
          <span class="missing-issues-label">Missing:</span>
          ${missingItems.join('')}
        </div>
      </div>
    `;

    // Update navigation buttons
    const btnPrev = document.getElementById('btnPrevMissing');
    const btnNext = document.getElementById('btnNextMissing');
    if (btnPrev) btnPrev.disabled = (currentMissingInfoIndex === 0);
    if (btnNext) btnNext.disabled = (currentMissingInfoIndex >= missingInfoExpenses.length - 1);
  }

  /**
   * Navigate to next missing info expense
   */
  function nextMissingInfo() {
    if (currentMissingInfoIndex < missingInfoExpenses.length - 1) {
      currentMissingInfoIndex++;
      updateMissingInfoPanel();
      scrollToMissingExpense();
    }
  }
  window.nextMissingInfo = nextMissingInfo;

  /**
   * Navigate to previous missing info expense
   */
  function prevMissingInfo() {
    if (currentMissingInfoIndex > 0) {
      currentMissingInfoIndex--;
      updateMissingInfoPanel();
      scrollToMissingExpense();
    }
  }
  window.prevMissingInfo = prevMissingInfo;

  /**
   * Scroll to current missing info expense in table and highlight it
   */
  function scrollToMissingExpense() {
    // Remove highlight from all rows first
    document.querySelectorAll('.expense-row-health-check-selected').forEach(row => {
      row.classList.remove('expense-row-health-check-selected');
    });

    if (missingInfoExpenses.length === 0) return;
    const exp = missingInfoExpenses[currentMissingInfoIndex];
    if (!exp) return;

    const expId = exp.expense_id || exp.id;
    const row = document.querySelector(`tr[data-id="${expId}"]`);
    if (row) {
      row.classList.add('expense-row-health-check-selected');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Open the edit modal for current missing expense
   */
  function goToMissingExpense() {
    if (missingInfoExpenses.length === 0) return;
    const exp = missingInfoExpenses[currentMissingInfoIndex];
    if (!exp) return;

    const expId = exp.expense_id || exp.id;
    openSingleExpenseModal(expId);
  }
  window.goToMissingExpense = goToMissingExpense;

  /**
   * Check if health check is all clear and show success state
   */
  function updateHealthCheckSuccessState() {
    const successEl = document.getElementById('healthCheckSuccess');
    const duplicatesContent = document.getElementById('tabContentDuplicates');
    const missingContent = document.getElementById('tabContentMissing');
    const tabsEl = document.querySelector('.health-check-tabs');

    const totalIssues = duplicateClusters.length + missingInfoExpenses.length;

    if (totalIssues === 0 && successEl) {
      successEl.classList.remove('hidden');
      if (duplicatesContent) duplicatesContent.classList.add('hidden');
      if (missingContent) missingContent.classList.add('hidden');
      if (tabsEl) tabsEl.classList.add('hidden');
    } else if (successEl) {
      successEl.classList.add('hidden');
      if (tabsEl) tabsEl.classList.remove('hidden');
    }
  }

  /**
   * Updates the duplicate review panel with current cluster data
   */
  function updateDuplicateReviewPanel() {
    const cluster = duplicateClusters[currentClusterIndex];
    if (!cluster) return;

    // Update counter
    document.getElementById('duplicateCurrentCluster').textContent = currentClusterIndex + 1;
    document.getElementById('duplicateTotalClusters').textContent = duplicateClusters.length;

    // Update cluster info
    const typeLabel = cluster.type === 'exact' ? 'EXACT MATCH' :
                      cluster.type === 'strong' ? 'STRONG MATCH' : 'LIKELY DUPLICATE';

    // Get match score and reasons (from first pair in cluster metadata)
    const scoreDisplay = cluster.score ? `${cluster.score}%` : '';
    const reasonsDisplay = cluster.matchReasons && cluster.matchReasons.length > 0
      ? cluster.matchReasons.join(' • ')
      : '';

    const infoEl = document.getElementById('duplicatePanelInfo');
    infoEl.innerHTML = `
      <div class="duplicate-type-badge">
        ${typeLabel}
        ${scoreDisplay ? `<span style="margin-left: 8px; font-weight: 600; color: #e5e7eb;">${scoreDisplay}</span>` : ''}
      </div>
      <div class="duplicate-details">
        <strong>${cluster.vendorName}</strong> • $${cluster.amount.toFixed(2)}${cluster.billId ? ` • Bill #${cluster.billId}` : ''}
      </div>
      ${reasonsDisplay ? `
        <div class="duplicate-match-reasons" style="
          margin-top: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.5;
        ">
          <strong style="color: #d1d5db;">Match Reasons:</strong><br/>
          ${reasonsDisplay}
        </div>
      ` : ''}
      <div class="duplicate-cluster-size">${cluster.expenses.length} similar expenses found</div>
    `;

    // Update expenses list
    const expensesEl = document.getElementById('duplicatePanelExpenses');
    expensesEl.innerHTML = cluster.expenses.map((exp, idx) => {
      const expId = exp.expense_id || exp.id;
      const amount = parseFloat(exp.Amount) || 0;
      const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : 'No date';
      const desc = exp.LineDescription || 'No description';
      const billId = exp.bill_id || 'No bill #';
      const paymentType = exp.PaymentType || 'N/A';
      const account = exp.Account || 'N/A';
      const projectName = exp.project_name || 'Unknown project';

      return `
        <div class="duplicate-expense-card" data-expense-id="${expId}">
          <div class="duplicate-expense-header">
            <span class="duplicate-expense-number">#${idx + 1}</span>
            <span class="duplicate-expense-date">${date}</span>
          </div>
          <div class="duplicate-expense-body">
            <div class="duplicate-expense-amount">$${amount.toFixed(2)}</div>
            <div class="duplicate-expense-bill">Bill: ${billId}</div>
            <div class="duplicate-expense-desc">${desc}</div>
            <div class="duplicate-expense-meta" style="
              display: flex;
              gap: 12px;
              margin-top: 8px;
              font-size: 11px;
              color: #9ca3af;
            ">
              <span>💳 ${paymentType}</span>
              <span>📊 ${account}</span>
              <span>🏗️ ${projectName}</span>
            </div>
          </div>
          <div class="duplicate-expense-actions">
            <button type="button" class="btn-delete-expense-mini" onclick="deleteExpenseFromPanel('${expId}')">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Update navigation buttons
    document.getElementById('btnPrevCluster').disabled = (currentClusterIndex === 0);
    document.getElementById('btnNextCluster').disabled = (currentClusterIndex >= duplicateClusters.length - 1);
  }

  /**
   * Navigate to next duplicate cluster
   */
  function nextDuplicateCluster() {
    if (currentClusterIndex < duplicateClusters.length - 1) {
      currentClusterIndex++;
      updateDuplicateReviewPanel();
      highlightCurrentCluster();
    }
  }

  /**
   * Navigate to previous duplicate cluster
   */
  function prevDuplicateCluster() {
    if (currentClusterIndex > 0) {
      currentClusterIndex--;
      updateDuplicateReviewPanel();
      highlightCurrentCluster();
    }
  }

  /**
   * Dismiss current cluster as "not a duplicate"
   */
  async function dismissCurrentCluster() {
    const cluster = duplicateClusters[currentClusterIndex];
    if (!cluster) return;

    // Add all pairs in this cluster to dismissed set AND save to backend
    const expenseIds = cluster.expenses.map(e => e.expense_id || e.id);
    const savePromises = [];

    for (let i = 0; i < expenseIds.length; i++) {
      for (let j = i + 1; j < expenseIds.length; j++) {
        const pairKey = getDuplicatePairKey(expenseIds[i], expenseIds[j]);
        dismissedDuplicates.add(pairKey);
        console.log(`[DUPLICATES] Dismissing pair: ${pairKey}`);

        // Save to backend (async)
        savePromises.push(saveDismissedDuplicatePair(expenseIds[i], expenseIds[j]));
      }
    }

    // Wait for all saves to complete
    try {
      const results = await Promise.all(savePromises);
      const successCount = results.filter(r => r === true).length;
      console.log(`[DUPLICATES] Saved ${successCount}/${savePromises.length} dismissals to backend`);

      if (successCount < savePromises.length) {
        if (window.Toast) {
          Toast.warning('Partial Success', `${successCount}/${savePromises.length} dismissals saved`);
        }
      }
    } catch (e) {
      console.error('[DUPLICATES] Error saving dismissals:', e);
      if (window.Toast) {
        Toast.error('Error', 'Failed to save some dismissals');
      }
      return; // Don't remove cluster if save failed
    }

    // Remove this cluster from the list
    duplicateClusters.splice(currentClusterIndex, 1);

    // Update button badge
    updateDuplicatesButtonBadge();

    // Show toast
    if (window.Toast) {
      Toast.success('Dismissed', 'This cluster marked as not duplicate');
    }

    // If no more duplicate clusters
    if (duplicateClusters.length === 0) {
      // Check if there are missing info issues
      detectMissingInfo();
      if (missingInfoExpenses.length > 0) {
        // Switch to missing info tab
        switchHealthCheckTab('missing');
        updateMissingInfoPanel();
        if (window.Toast) {
          Toast.info('Duplicates Done', 'All duplicates reviewed! Now checking missing info...');
        }
      } else {
        // All clear - show success state or close panel
        updateHealthCheckSuccessState();
        if (window.Toast) {
          Toast.success('Health Check Complete', 'All issues resolved! Your expenses are healthy. ✓');
        }
      }
      return;
    }

    // If we're at the end, go back one
    if (currentClusterIndex >= duplicateClusters.length) {
      currentClusterIndex = duplicateClusters.length - 1;
    }

    updateDuplicateReviewPanel();
    highlightCurrentCluster();
  }

  /**
   * Hide the duplicate review panel
   */
  function hideDuplicateReviewPanel() {
    const panel = document.getElementById('duplicateReviewPanel');
    if (panel) {
      panel.style.display = 'none';
    }
    // Remove all highlights (including health check selection)
    document.querySelectorAll('.expense-row-duplicate-warning, .expense-row-duplicate-current, .expense-row-health-check-selected').forEach(row => {
      row.classList.remove('expense-row-duplicate-warning', 'expense-row-duplicate-current', 'expense-row-health-check-selected');
    });
  }

  /**
   * Delete an expense from the review panel
   */
  async function deleteExpenseFromPanel(expenseId) {
    if (!confirm('Delete this expense? This cannot be undone.')) return;

    try {
      await deleteExpense(expenseId);

      // Remove from current cluster
      const cluster = duplicateClusters[currentClusterIndex];
      if (cluster) {
        cluster.expenses = cluster.expenses.filter(e => (e.expense_id || e.id) !== expenseId);

        // If cluster now has less than 2 expenses, remove it
        if (cluster.expenses.length < 2) {
          duplicateClusters.splice(currentClusterIndex, 1);
          updateDuplicatesButtonBadge(); // Update button badge

          if (duplicateClusters.length === 0) {
            // Check if there are missing info issues
            detectMissingInfo();
            if (missingInfoExpenses.length > 0) {
              // Switch to missing info tab
              switchHealthCheckTab('missing');
              updateMissingInfoPanel();
              if (window.Toast) {
                Toast.info('Duplicates Done', 'Now checking missing info...');
              }
            } else {
              // All clear
              updateHealthCheckSuccessState();
              if (window.Toast) {
                Toast.success('All Done', 'No more issues to review!');
              }
            }
            return;
          }

          if (currentClusterIndex >= duplicateClusters.length) {
            currentClusterIndex = duplicateClusters.length - 1;
          }
        }

        updateDuplicateReviewPanel();
        highlightCurrentCluster();
      }
    } catch (err) {
      console.error('[DUPLICATES] Error deleting expense:', err);
    }
  }

  /**
   * Highlights only the current cluster being reviewed
   */
  function highlightCurrentCluster() {
    // Remove all highlights first (including health check selection)
    document.querySelectorAll('.expense-row-duplicate-warning, .expense-row-duplicate-current, .expense-row-duplicate-exact, .expense-row-duplicate-strong, .expense-row-duplicate-likely, .expense-row-health-check-selected').forEach(row => {
      row.classList.remove('expense-row-duplicate-warning', 'expense-row-duplicate-current', 'expense-row-duplicate-exact', 'expense-row-duplicate-strong', 'expense-row-duplicate-likely', 'expense-row-health-check-selected');
    });

    const cluster = duplicateClusters[currentClusterIndex];
    if (!cluster) return;

    // Highlight only expenses in current cluster
    cluster.expenses.forEach((exp, index) => {
      const expId = exp.expense_id || exp.id;
      const row = document.querySelector(`tr[data-id="${expId}"]`);
      if (row) {
        row.classList.add('expense-row-duplicate-warning', 'expense-row-duplicate-current');

        // Add type-specific class
        if (cluster.type === 'exact') {
          row.classList.add('expense-row-duplicate-exact');
        } else if (cluster.type === 'strong') {
          row.classList.add('expense-row-duplicate-strong');
        } else if (cluster.type === 'likely') {
          row.classList.add('expense-row-duplicate-likely');
        }

        // First expense gets the prominent health check selection highlight
        if (index === 0) {
          row.classList.add('expense-row-health-check-selected');
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });
  }

  /**
   * Updates the "Health Check" button with a badge showing the count
   */
  function updateDuplicatesButtonBadge() {
    const btn = document.getElementById('btnDetectDuplicates');
    if (!btn) return;

    // Also update missing info if we have expenses loaded
    if (expenses.length > 0) {
      detectMissingInfo();
    }

    const duplicateCount = duplicateClusters.length;
    const missingCount = missingInfoExpenses.length;
    const totalCount = duplicateCount + missingCount;

    if (totalCount > 0) {
      // Show badge with count
      btn.innerHTML = `Health Check <span style="
        display: inline-block;
        background: #ef4444;
        color: white;
        border-radius: 10px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 6px;
      ">${totalCount}</span>`;
      btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    } else {
      // Show green checkmark when all clear
      btn.innerHTML = `Health Check <span style="
        display: inline-block;
        background: #22c55e;
        color: white;
        border-radius: 10px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 6px;
      ">✓</span>`;
      btn.style.borderColor = 'rgba(34, 197, 94, 0.3)';
    }

    // Update tab badges if panel exists
    const duplicatesBadge = document.getElementById('tabBadgeDuplicates');
    const missingBadge = document.getElementById('tabBadgeMissing');
    if (duplicatesBadge) duplicatesBadge.textContent = duplicateCount;
    if (missingBadge) missingBadge.textContent = missingCount;

    // Update success state if panel is open
    updateHealthCheckSuccessState();
  }

  // Make functions globally accessible
  window.nextDuplicateCluster = nextDuplicateCluster;
  window.prevDuplicateCluster = prevDuplicateCluster;
  window.dismissCurrentCluster = dismissCurrentCluster;
  window.hideDuplicateReviewPanel = hideDuplicateReviewPanel;
  window.deleteExpenseFromPanel = deleteExpenseFromPanel;
  window.detectDuplicateBillNumbers = detectDuplicateBillNumbers;
  window.showDuplicateReviewPanel = showDuplicateReviewPanel;
  window.updateDuplicatesButtonBadge = updateDuplicatesButtonBadge;

  /**
   * Highlights rows in the table that have duplicate warnings
   * LEGACY: Now only used as fallback when panel is hidden
   */
  function highlightDuplicateBills() {
    // Remove existing highlights
    document.querySelectorAll('.expense-row-duplicate-warning, .expense-row-duplicate-exact, .expense-row-duplicate-strong, .expense-row-duplicate-likely').forEach(row => {
      row.classList.remove('expense-row-duplicate-warning', 'expense-row-duplicate-exact', 'expense-row-duplicate-strong', 'expense-row-duplicate-likely');
    });

    // Add highlights to rows with duplicate warnings (keyed by expense_id now)
    duplicateBillWarnings.forEach((warning, expenseId) => {
      const row = document.querySelector(`tr[data-id="${expenseId}"]`);
      if (row) {
        row.classList.add('expense-row-duplicate-warning');
        // Add specific class based on duplicate type for styling
        if (warning.type === 'exact') {
          row.classList.add('expense-row-duplicate-exact');
        } else if (warning.type === 'strong') {
          row.classList.add('expense-row-duplicate-strong');
        } else if (warning.type === 'likely') {
          row.classList.add('expense-row-duplicate-likely');
        }
      }
    });
  }

  // ================================
  // RENDER EXPENSES TABLE
  // ================================
  function showEmptyState(message) {
    // Hide skeleton table
    if (els.expensesSkeletonTable) {
      els.expensesSkeletonTable.style.display = 'none';
    }
    if (els.expensesEmptyState) {
      els.expensesEmptyState.querySelector('.expenses-empty-text').textContent = message;
      els.expensesEmptyState.style.display = 'flex';
    }
    if (els.expensesTable) {
      els.expensesTable.style.display = 'none';
    }
  }

  function hideEmptyState() {
    // Hide skeleton table
    if (els.expensesSkeletonTable) {
      els.expensesSkeletonTable.style.display = 'none';
    }
    if (els.expensesEmptyState) {
      els.expensesEmptyState.style.display = 'none';
    }
    if (els.expensesTable) {
      els.expensesTable.style.display = '';
    }
  }

  /**
   * PERFORMANCE OPTIMIZED: Apply filters with single-pass field resolution
   * Pre-computes all display values once per expense to avoid redundant lookups
   */
  function applyFilters() {
    // Check if any filters are active (for early exit optimization)
    const hasSearch = !!globalSearchTerm;
    const hasDateFilter = columnFilters.date.length > 0;
    const hasBillFilter = columnFilters.bill_id.length > 0;
    const hasTypeFilter = columnFilters.type.length > 0;
    const hasVendorFilter = columnFilters.vendor.length > 0;
    const hasPaymentFilter = columnFilters.payment.length > 0;
    const hasAccountFilter = columnFilters.account.length > 0;
    const hasDescFilter = columnFilters.description.length > 0;
    const hasAuthFilter = columnFilters.auth.length > 0;
    const hasDuplicateFilter = window._duplicateFilterActive && window._duplicateIds;

    const searchLower = hasSearch ? globalSearchTerm.toLowerCase() : '';

    filteredExpenses = expenses.filter(exp => {
      // Duplicate filter - check first as it's most restrictive
      if (hasDuplicateFilter && !window._duplicateIds.has(exp.expense_id)) {
        return false;
      }
      // PERFORMANCE: Compute display values ONCE per expense (lazy, only if needed)
      let date, billId, description, type, vendor, payment, account, amount, authValue;

      // Date - computed once
      const getDate = () => {
        if (date === undefined) {
          date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
        }
        return date;
      };

      // Bill ID - computed once
      const getBillId = () => {
        if (billId === undefined) {
          billId = exp.bill_id || '—';
        }
        return billId;
      };

      // Description - computed once
      const getDescription = () => {
        if (description === undefined) {
          description = exp.LineDescription || '—';
        }
        return description;
      };

      // Type - computed once with O(1) lookup
      const getType = () => {
        if (type === undefined) {
          type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '—';
        }
        return type;
      };

      // Vendor - computed once with O(1) lookup
      const getVendor = () => {
        if (vendor === undefined) {
          vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
        }
        return vendor;
      };

      // Payment - computed once with O(1) lookup
      const getPayment = () => {
        if (payment === undefined) {
          payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
        }
        return payment;
      };

      // Account - computed once with O(1) lookup
      const getAccount = () => {
        if (account === undefined) {
          account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '—';
        }
        return account;
      };

      // Amount - computed once
      const getAmount = () => {
        if (amount === undefined) {
          amount = exp.Amount ? String(exp.Amount) : '';
        }
        return amount;
      };

      // Auth - computed once (supports new 3-state system: pending/auth/review)
      const getAuth = () => {
        if (authValue === undefined) {
          // Use new status field if available, otherwise fall back to auth_status (backwards compatible)
          if (exp.status) {
            authValue = exp.status === 'auth' ? 'Authorized' :
                       exp.status === 'review' ? 'Review' :
                       'Pending';
          } else {
            // Legacy: use auth_status boolean
            const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
            authValue = isAuthorized ? 'Authorized' : 'Pending';
          }
        }
        return authValue;
      };

      // Global search filter
      if (hasSearch) {
        const matchesSearch =
          getDate().toLowerCase().includes(searchLower) ||
          getBillId().toLowerCase().includes(searchLower) ||
          getDescription().toLowerCase().includes(searchLower) ||
          getType().toLowerCase().includes(searchLower) ||
          getVendor().toLowerCase().includes(searchLower) ||
          getPayment().toLowerCase().includes(searchLower) ||
          getAccount().toLowerCase().includes(searchLower) ||
          getAmount().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Column filters - only compute values if filter is active
      if (hasDateFilter && !columnFilters.date.includes(getDate())) return false;
      if (hasBillFilter && !columnFilters.bill_id.includes(getBillId())) return false;
      if (hasTypeFilter && !columnFilters.type.includes(getType())) return false;
      if (hasVendorFilter && !columnFilters.vendor.includes(getVendor())) return false;
      if (hasPaymentFilter && !columnFilters.payment.includes(getPayment())) return false;
      if (hasAccountFilter && !columnFilters.account.includes(getAccount())) return false;
      if (hasDescFilter && !columnFilters.description.includes(getDescription())) return false;
      if (hasAuthFilter && !columnFilters.auth.includes(getAuth())) return false;

      return true;
    });
  }

  function renderExpensesTable() {
    if (!els.expensesTableBody) return;

    if (expenses.length === 0) {
      showEmptyState(currentModeConfig.noDataMessage);
      return;
    }

    // Apply filters
    applyFilters();

    // Hide skeleton and empty state, show table
    if (els.expensesSkeletonTable) els.expensesSkeletonTable.style.display = 'none';
    if (els.expensesEmptyState) els.expensesEmptyState.style.display = 'none';
    if (els.expensesTable) els.expensesTable.style.display = 'table';

    // Use Bill View if active and not in edit mode
    if (isBillViewMode && !isEditMode) {
      renderBillViewTable();
      return;
    }

    const displayExpenses = filteredExpenses.length > 0 || Object.values(columnFilters).some(f => f) ? filteredExpenses : expenses;

    // PERFORMANCE: Use requestAnimationFrame for large datasets to avoid blocking UI
    const BATCH_SIZE = 100;
    const isLargeDataset = displayExpenses.length > BATCH_SIZE;

    if (isLargeDataset) {
      // Show loading indicator for large datasets
      els.expensesTableBody.innerHTML = `
        <tr class="loading-row">
          <td colspan="12" style="text-align: center; padding: 24px; color: #6b7280;">
            Rendering ${displayExpenses.length} expenses...
          </td>
        </tr>
      `;
    }

    // Use requestAnimationFrame to defer heavy rendering
    requestAnimationFrame(() => {
      const rows = displayExpenses.map((exp, index) => {
        if (isEditMode) {
          return renderEditableRow(exp, index);
        } else {
          return renderReadOnlyRow(exp, index);
        }
      }).join('');

      // Calculate total
      const total = displayExpenses.reduce((sum, exp) => {
        const amount = parseFloat(exp.Amount) || 0;
        return sum + amount;
      }, 0);

      // Calculate colspan: checkbox (hidden) + 7 base columns (Date, Bill#, Desc, Account, Type, Vendor, Payment)
      const totalColspan = 8;

      // Add total row with currency formatting
      // Columns: Checkbox (hidden), Date, Bill#, Desc, Account, Type, Vendor, Payment, Amount, Receipt, Auth, Actions
      const totalRow = `
        <tr class="total-row">
          <td class="col-checkbox" style="display: none;"></td>
          <td colspan="${totalColspan - 1}" class="total-label">Total</td>
          <td class="col-amount total-amount">${formatCurrency(total)}</td>
          <td class="col-receipt"></td>
          <td class="col-auth"></td>
          <td class="col-actions"></td>
        </tr>
      `;

      els.expensesTableBody.innerHTML = rows + totalRow;

      // Apply column visibility after rendering
      applyColumnVisibility();

      // Apply saved column widths to new rows
      loadColumnWidths();
    });
  }

  function renderReadOnlyRow(exp, index) {
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
    const billIdRaw = exp.bill_id || '';
    const billId = billIdRaw || '—';
    const description = exp.LineDescription || '—';
    const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '—';
    const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
    const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
    const account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '—';
    const amount = exp.Amount ? formatCurrency(Number(exp.Amount)) : '$0.00';

    // Get the ID - backend uses 'expense_id' as primary key
    const expenseId = exp.expense_id || exp.id || '';
    if (index === 0) {
      console.log('[EXPENSES] First expense - using expense_id:', expenseId);
    }

    // Check for duplicate warning (now keyed by expense_id)
    const duplicateWarning = duplicateBillWarnings.get(expenseId);
    let billDisplayHtml = billId;
    let rowWarningClass = '';

    if (duplicateWarning) {
      // Build tooltip based on duplicate type
      let warningIcon = '⚠️';
      let tooltipText = '';

      if (duplicateWarning.type === 'exact') {
        warningIcon = '🔴';
        tooltipText = `EXACT DUPLICATE: Same vendor (${duplicateWarning.vendorName}), bill, amount ($${duplicateWarning.amount?.toFixed(2)}), and date`;
      } else if (duplicateWarning.type === 'strong') {
        warningIcon = '🟠';
        tooltipText = `STRONG MATCH: Same vendor (${duplicateWarning.vendorName}) and bill #${duplicateWarning.billId} with same amount ($${duplicateWarning.amount?.toFixed(2)})`;
      } else if (duplicateWarning.type === 'likely') {
        warningIcon = '🟡';
        tooltipText = `LIKELY DUPLICATE: Same vendor (${duplicateWarning.vendorName}), amount ($${duplicateWarning.amount?.toFixed(2)}), and date`;
      }

      billDisplayHtml = `<span class="bill-warning-badge bill-warning-${duplicateWarning.type}" title="${tooltipText}">${warningIcon} ${billId}</span>`;
      rowWarningClass = ` expense-row-warning expense-row-duplicate-${duplicateWarning.type}`;
    }

    // Receipt icon - check bills table first, then expense (legacy)
    // Click opens the edit modal; badge indicates if receipt is attached
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<span class="receipt-icon-btn receipt-icon-btn--has-receipt" title="Click to view/edit receipt">📎<span class="receipt-badge"></span></span>`
      : `<span class="receipt-icon-btn" title="No receipt attached">📎<span class="receipt-badge receipt-badge--missing"></span></span>`;

    // Authorization badge - use status field first, fall back to auth_status (must match filter logic)
    const isAuthorized = exp.status ? exp.status === 'auth' : (exp.auth_status === true || exp.auth_status === 1);
    const isReview = exp.status === 'review';
    const authBadgeClass = isReview ? 'auth-badge-review' : (isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending');
    const authBadgeText = isReview ? '⚠ Review' : (isAuthorized ? '✓ Auth' : '⏳ Pending');
    const authBadgeDisabled = canAuthorize ? '' : ' auth-badge-disabled';
    const cursorStyle = canAuthorize ? 'cursor: pointer;' : 'cursor: not-allowed;';
    const authBadge = `<span class="auth-badge ${authBadgeClass}${authBadgeDisabled}"
      data-expense-id="${expenseId}"
      data-auth-status="${isAuthorized}"
      data-can-authorize="${canAuthorize}"
      style="${cursorStyle}"
      title="${canAuthorize ? 'Click to toggle authorization' : 'You do not have permission to authorize'}">${authBadgeText}</span>`;

    return `
      <tr data-index="${index}" data-id="${expenseId}" class="expense-row-clickable${rowWarningClass}" style="cursor: pointer;">
        <td class="col-checkbox" style="display: none;"></td>
        <td class="col-date">${date}</td>
        <td class="col-bill-id">${billDisplayHtml}</td>
        <td class="col-description">${description}</td>
        <td class="col-account">${account}</td>
        <td class="col-type">${type}</td>
        <td class="col-vendor">${vendor}</td>
        <td class="col-payment">${payment}</td>
        <td class="col-amount">${amount}</td>
        <td class="col-receipt">${receiptIcon}</td>
        <td class="col-auth">${authBadge}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditableRow(exp, index) {
    const dateVal = exp.TxnDate ? exp.TxnDate.split('T')[0] : '';

    // Receipt icon - check bills table first, then expense (legacy)
    // Badge indicates if receipt is attached
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<span class="receipt-icon-btn receipt-icon-btn--has-receipt" title="Has receipt attached">📎<span class="receipt-badge"></span></span>`
      : `<span class="receipt-icon-btn" title="No receipt attached">📎<span class="receipt-badge receipt-badge--missing"></span></span>`;

    // Authorization badge (not editable in bulk edit mode) - use status field first, fall back to auth_status
    const isAuthorized = exp.status ? exp.status === 'auth' : (exp.auth_status === true || exp.auth_status === 1);
    const isReview = exp.status === 'review';
    const authBadgeClass = isReview ? 'auth-badge-review' : (isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending');
    const authBadgeText = isReview ? '⚠ Review' : (isAuthorized ? '✓ Auth' : '⏳ Pending');
    const authBadge = `<span class="auth-badge ${authBadgeClass}">${authBadgeText}</span>`;

    // Get the ID - backend uses 'expense_id' as primary key
    const expenseId = exp.expense_id || exp.id || '';

    // Checkbox checked state
    const isChecked = selectedExpenseIds.has(expenseId) ? 'checked' : '';

    return `
      <tr data-index="${index}" data-id="${expenseId}" class="edit-mode-row">
        <td class="col-checkbox" style="display: ${isEditMode ? '' : 'none'};">
          <input type="checkbox" class="row-checkbox" data-id="${expenseId}" ${isChecked}>
        </td>
        <td class="col-date editable-cell">
          <input type="date" class="edit-input" data-field="TxnDate" value="${dateVal}">
        </td>
        <td class="col-bill-id editable-cell">
          <input type="text" class="edit-input" data-field="bill_id" value="${exp.bill_id || ''}" placeholder="Bill #...">
        </td>
        <td class="col-description editable-cell">
          <input type="text" class="edit-input" data-field="LineDescription" value="${exp.LineDescription || ''}" placeholder="Description...">
        </td>
        <td class="col-account editable-cell">
          ${buildSelectHtml('account_id', exp.account_id, metaData.accounts, 'account_id', 'Name')}
        </td>
        <td class="col-type editable-cell">
          ${buildSelectHtml('txn_type', exp.txn_type, metaData.txn_types, 'TnxType_id', 'TnxType_name')}
        </td>
        <td class="col-vendor editable-cell">
          ${buildSelectHtml('vendor_id', exp.vendor_id, metaData.vendors, 'id', 'vendor_name')}
        </td>
        <td class="col-payment editable-cell">
          ${buildSelectHtml('payment_type', exp.payment_type, metaData.payment_methods, 'id', 'payment_method_name')}
        </td>
        <td class="col-amount editable-cell">
          <input type="number" class="edit-input edit-input--amount" data-field="Amount" step="0.01" min="0" value="${exp.Amount || ''}" placeholder="0.00">
        </td>
        <td class="col-receipt">${receiptIcon}</td>
        <td class="col-auth">${authBadge}</td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-id="${expenseId}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function buildSelectHtml(field, selectedValue, options, valueKey, textKey) {
    // Create a unique ID for this datalist
    const listId = `datalist-${field}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Find the selected option text
    let selectedText = '';
    if (selectedValue) {
      const selectedOption = options.find(opt => String(opt[valueKey]) === String(selectedValue));
      if (selectedOption) {
        selectedText = selectedOption[textKey] || selectedOption.Name || selectedOption.name ||
                       selectedOption.vendor_name || selectedOption.account_name ||
                       selectedOption.payment_method_name || selectedOption.txn_type_name ||
                       selectedOption.TnxType_name || '';
      }
    }

    // Build datalist options
    const optionsHtml = options.map(opt => {
      const val = opt[valueKey];
      const text = opt[textKey] || opt.Name || opt.name || opt.vendor_name || opt.account_name ||
                   opt.payment_method_name || opt.txn_type_name || opt.TnxType_name ||
                   `Unnamed (${val})`;
      return `<option value="${text}" data-value="${val}"></option>`;
    }).join('');

    return `
      <input
        type="text"
        class="edit-input edit-input-datalist"
        data-field="${field}"
        data-field-value="${selectedValue || ''}"
        value="${selectedText}"
        list="${listId}"
        placeholder="Type to search..."
        autocomplete="off"
      >
      <datalist id="${listId}">
        ${optionsHtml}
      </datalist>
    `;
  }

  /**
   * PERFORMANCE OPTIMIZED: Find metadata name using O(1) lookup maps
   * Falls back to O(n) search only if map lookup fails
   */
  function findMetaName(category, value, valueKey, textKey) {
    if (!value) return null;

    // Try O(1) lookup first
    const item = lookupMeta(category, value);
    if (item) {
      return item[textKey] || null;
    }

    // Fallback to O(n) search for edge cases
    const arr = metaData[category];
    if (!arr) return null;
    const found = arr.find(i => String(i[valueKey]) === String(value));
    return found ? found[textKey] : null;
  }

  // ================================
  // EDIT MODE
  // ================================
  function toggleEditMode(enable) {
    isEditMode = enable;

    if (enable) {
      // Exit bill view mode if active
      if (isBillViewMode) {
        isBillViewMode = false;
        els.btnBillView.classList.remove('btn-toolbar-active');
        els.btnBillView.textContent = 'Bill View';
      }

      // Store original data for rollback
      originalExpenses = JSON.parse(JSON.stringify(expenses));
      els.btnEditExpenses.textContent = 'Editing...';
      els.btnEditExpenses.disabled = true;
      els.btnAddExpense.disabled = true;
      els.btnBillView.disabled = true;
      els.btnDetectDuplicates.disabled = true;
      els.projectFilter.disabled = true;
      if (els.editModeFooter) els.editModeFooter.classList.remove('hidden');
      // Add edit mode class to table for wider columns
      if (els.expensesTable) els.expensesTable.classList.add('edit-mode-table');

      // Show checkbox column (header and cells)
      const checkboxHeader = document.querySelector('.col-checkbox');
      if (checkboxHeader) checkboxHeader.style.display = '';

      // Show bulk authorize button if user has permission
      if (canAuthorize && els.btnBulkAuthorize) {
        els.btnBulkAuthorize.style.display = 'inline-flex';
      }

      // Reset selection
      selectedExpenseIds.clear();
      updateBulkDeleteButton();
      updateBulkAuthorizeButton();
    } else {
      els.btnEditExpenses.textContent = 'Edit Expenses';
      els.btnEditExpenses.disabled = expenses.length === 0;
      els.btnAddExpense.disabled = !selectedProjectId;
      els.btnBillView.disabled = expenses.length === 0;
      els.btnDetectDuplicates.disabled = expenses.length < 2; // Need at least 2 expenses to compare
      els.projectFilter.disabled = false;
      if (els.editModeFooter) els.editModeFooter.classList.add('hidden');
      // Remove edit mode class from table
      if (els.expensesTable) els.expensesTable.classList.remove('edit-mode-table');

      // Hide checkbox column (header and cells)
      const checkboxHeader = document.querySelector('.col-checkbox');
      if (checkboxHeader) checkboxHeader.style.display = 'none';

      // Hide bulk authorize button
      if (els.btnBulkAuthorize) {
        els.btnBulkAuthorize.style.display = 'none';
      }

      // Reset selection
      selectedExpenseIds.clear();
    }

    renderExpensesTable();
  }

  function cancelEditMode() {
    // Restore original data
    expenses = JSON.parse(JSON.stringify(originalExpenses));
    toggleEditMode(false);
  }

  async function saveEditChanges() {
    const apiBase = getApiBase();
    const displayExpenses = filteredExpenses.length > 0 || Object.values(columnFilters).some(f => f) ? filteredExpenses : expenses;
    const rows = els.expensesTableBody.querySelectorAll('tr[data-index]:not(.total-row)');
    const updates = [];

    console.log('[EDIT] Starting save process...');
    console.log('[EDIT] Number of rows to check:', rows.length);

    // Collect changes from DOM
    rows.forEach(row => {
      const index = parseInt(row.dataset.index, 10);
      const expenseId = row.dataset.id;

      console.log(`[EDIT] Checking row ${index}, ID: ${expenseId}`);

      if (!expenseId) {
        console.warn(`[EDIT] Row ${index} has no ID, skipping`);
        return;
      }

      const updatedData = {};
      row.querySelectorAll('.edit-input').forEach(input => {
        const field = input.dataset.field;
        let value;

        // For datalist inputs, use the hidden data-field-value instead of display text
        if (input.classList.contains('edit-input-datalist')) {
          value = input.dataset.fieldValue || null;
        } else {
          value = input.value;
        }

        if (field === 'Amount') {
          value = value ? parseFloat(value) : null;
        }

        updatedData[field] = value || null;
      });

      console.log(`[EDIT] Row ${index} updated data:`, updatedData);

      // Check if data changed - Find original by expense_id (backend primary key)
      const original = originalExpenses.find(exp => {
        const origId = exp.expense_id || exp.id;
        return origId == expenseId;
      });
      console.log(`[EDIT] Row ${index} original data (found by expense_id ${expenseId}):`, original);

      if (original && hasChanges(original, updatedData)) {
        console.log(`[EDIT] Row ${index} has changes, adding to update list`);
        updates.push({ id: expenseId, data: updatedData });
      } else {
        console.log(`[EDIT] Row ${index} has no changes`);
      }
    });

    console.log('[EDIT] Total updates to send:', updates.length);
    console.log('[EDIT] Updates:', updates);

    // Validate: Check if any update tries to change to a closed bill
    const closedBillErrors = [];
    updates.forEach(update => {
      const newBillId = update.data.bill_id?.trim() || null;
      if (newBillId) {
        // Find original expense to check if bill_id changed
        const original = originalExpenses.find(exp => String(exp.expense_id || exp.id) === String(update.id));
        const originalBillId = original?.bill_id || null;

        // Only validate if bill_id changed
        if (newBillId !== originalBillId) {
          const billData = getBillMetadata(newBillId);
          if (billData && billData.status === 'closed') {
            closedBillErrors.push({
              expenseId: update.id,
              billId: newBillId
            });
          }
        }
      }
    });

    if (closedBillErrors.length > 0) {
      const billList = closedBillErrors.map(err => `Bill #${err.billId}`).join(', ');
      if (window.Toast) {
        Toast.error('Closed Bill Detected', 'Cannot change expenses to closed bills. Reopen them in Bill View first.', { details: billList });
      }
      return; // Stop saving
    }

    if (updates.length === 0) {
      if (window.Toast) {
        Toast.info('No Changes', 'No changes to save.');
      }
      toggleEditMode(false);
      return;
    }

    // Disable save button
    els.btnSaveChanges.disabled = true;
    els.btnSaveChanges.textContent = 'Saving...';

    try {
      console.log('[EDIT] Sending batch update for', updates.length, 'expenses');
      const batchStartTime = performance.now();

      // Transform updates to match backend schema
      const batchPayload = {
        updates: updates.map(u => ({
          expense_id: u.id,
          data: u.data
        }))
      };

      // Single API call for all updates
      const response = await apiJson(`${apiBase}/expenses/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchPayload)
      });

      const batchEndTime = performance.now();
      console.log(`[EDIT] Batch update completed in ${(batchEndTime - batchStartTime).toFixed(0)}ms`);
      console.log('[EDIT] Batch result:', response.summary);

      // Log any failures
      if (response.failed && response.failed.length > 0) {
        console.warn('[EDIT] Some updates failed:', response.failed);
      }

      const successCount = response.summary?.total_updated || updates.length;
      if (window.Toast) {
        Toast.success('Changes Saved', `${successCount} expense(s) updated successfully!`);
      }

      // Reload expenses
      await loadExpensesByProject(selectedProjectId);
      toggleEditMode(false);

    } catch (err) {
      console.error('[EXPENSES] Error saving changes:', err);
      console.error('[EXPENSES] Error stack:', err.stack);
      if (window.Toast) {
        Toast.error('Error Saving', 'Error saving changes.', { details: err.message });
      }
    } finally {
      els.btnSaveChanges.disabled = false;
      els.btnSaveChanges.textContent = 'Save Changes';
    }
  }

  function hasChanges(original, updated) {
    const fields = ['TxnDate', 'txn_type', 'vendor_id', 'payment_type', 'account_id', 'Amount', 'LineDescription', 'bill_id'];
    return fields.some(f => {
      const origVal = original[f];
      const updVal = updated[f];

      // Handle date comparison
      if (f === 'TxnDate') {
        const origDate = origVal ? origVal.split('T')[0] : '';
        return origDate !== (updVal || '');
      }

      return String(origVal || '') !== String(updVal || '');
    });
  }

  async function deleteExpense(expenseId) {
    if (!expenseId) return;

    const confirmed = confirm('Delete this expense? This cannot be undone.');
    if (!confirmed) return;

    const apiBase = getApiBase();

    // Build URL - include user_id if available (required for authorized expenses)
    const userId = currentUser?.user_id || currentUser?.id;
    const deleteUrl = userId
      ? `${apiBase}/expenses/${expenseId}?user_id=${userId}`
      : `${apiBase}/expenses/${expenseId}`;

    try {
      await apiJson(deleteUrl, {
        method: 'DELETE'
      });

      // Remove from local array
      const index = expenses.findIndex(e => (e.expense_id || e.id) === expenseId);
      if (index >= 0) {
        expenses.splice(index, 1);
      }

      // Remove from original array
      const origIndex = originalExpenses.findIndex(e => (e.expense_id || e.id) === expenseId);
      if (origIndex >= 0) {
        originalExpenses.splice(origIndex, 1);
      }

      // Remove from selection if selected
      selectedExpenseIds.delete(expenseId);

      renderExpensesTable();
      updateBulkDeleteButton();

    } catch (err) {
      console.error('[EXPENSES] Error deleting expense:', err);
      if (window.Toast) {
        Toast.error('Delete Failed', 'Error deleting expense.', { details: err.message });
      }
    }
  }

  async function bulkDeleteExpenses() {
    if (selectedExpenseIds.size === 0) {
      if (window.Toast) {
        Toast.warning('No Selection', 'No expenses selected.');
      }
      return;
    }

    const confirmed = confirm(`Delete ${selectedExpenseIds.size} expense(s)? This cannot be undone.`);
    if (!confirmed) return;

    const apiBase = getApiBase();

    // Disable button
    els.btnBulkDelete.disabled = true;
    const originalText = els.btnBulkDelete.innerHTML;
    els.btnBulkDelete.innerHTML = '<span style="font-size: 14px;">⏳</span> Deleting...';

    // Build base URL - include user_id if available (required for authorized expenses)
    const userId = currentUser?.user_id || currentUser?.id;

    try {
      // Use Promise.allSettled to handle individual failures without stopping others
      const deletePromises = Array.from(selectedExpenseIds).map(expenseId => {
        const deleteUrl = userId
          ? `${apiBase}/expenses/${expenseId}?user_id=${userId}`
          : `${apiBase}/expenses/${expenseId}`;
        return apiJson(deleteUrl, { method: 'DELETE' })
          .then(() => ({ expenseId, success: true }))
          .catch(err => ({ expenseId, success: false, error: err.message }));
      });

      const results = await Promise.allSettled(deletePromises);

      // Process results - separate successes and failures
      const successfulDeletes = [];
      const failedDeletes = [];

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          const { expenseId, success, error } = result.value;
          if (success) {
            successfulDeletes.push(expenseId);
          } else {
            failedDeletes.push({ expenseId, error });
          }
        } else {
          // Promise itself rejected (shouldn't happen with our .catch above)
          failedDeletes.push({ expenseId: 'unknown', error: result.reason?.message || 'Unknown error' });
        }
      });

      console.log(`[BULK_DELETE] Successful: ${successfulDeletes.length}, Failed: ${failedDeletes.length}`);

      // Remove ONLY successfully deleted expenses from local arrays
      successfulDeletes.forEach(expenseId => {
        const index = expenses.findIndex(e => (e.expense_id || e.id) === expenseId);
        if (index >= 0) {
          expenses.splice(index, 1);
        }

        const origIndex = originalExpenses.findIndex(e => (e.expense_id || e.id) === expenseId);
        if (origIndex >= 0) {
          originalExpenses.splice(origIndex, 1);
        }

        // Remove from selection
        selectedExpenseIds.delete(expenseId);
      });

      renderExpensesTable();
      updateBulkDeleteButton();

      // Show appropriate message
      if (window.Toast) {
        if (failedDeletes.length === 0) {
          Toast.success('Deleted', `${successfulDeletes.length} expense(s) deleted successfully!`);
        } else if (successfulDeletes.length === 0) {
          Toast.error('Delete Failed', 'Failed to delete all expenses.', { details: failedDeletes.map(f => f.error).join('\n') });
        } else {
          Toast.warning('Partial Success', `${successfulDeletes.length} deleted, ${failedDeletes.length} failed. Failed items remain selected.`);
        }
      }

    } catch (err) {
      console.error('[BULK_DELETE] Unexpected error:', err);
      if (window.Toast) {
        Toast.error('Unexpected Error', 'Error during bulk delete.', { details: err.message });
      }
    } finally {
      els.btnBulkDelete.disabled = false;
      els.btnBulkDelete.innerHTML = originalText;
    }
  }

  function updateBulkDeleteButton() {
    if (!els.btnBulkDelete || !els.selectedCount) return;

    const count = selectedExpenseIds.size;
    els.selectedCount.textContent = count;
    els.btnBulkDelete.disabled = count === 0;
  }

  function updateBulkAuthorizeButton() {
    if (!els.btnBulkAuthorize || !els.authorizeCount) return;

    const count = selectedExpenseIds.size;
    els.authorizeCount.textContent = count;
    els.btnBulkAuthorize.disabled = count === 0;
  }

  async function bulkAuthorizeExpenses() {
    if (selectedExpenseIds.size === 0) {
      if (window.Toast) {
        Toast.warning('No Selection', 'No expenses selected.');
      }
      return;
    }

    if (!canAuthorize) {
      if (window.Toast) {
        Toast.error('Permission Denied', 'You do not have permission to authorize expenses.');
      }
      return;
    }

    const apiBase = getApiBase();
    const userId = currentUser.user_id || currentUser.id;

    // Re-verify permissions with server before executing bulk authorization
    // This prevents stale permission issues if user's role changed mid-session
    try {
      const permCheck = await apiJson(`${apiBase}/permissions/check?user_id=${userId}&action=authorize_expenses`);
      if (!permCheck || !permCheck.allowed) {
        canAuthorize = false; // Update local state
        if (window.Toast) {
          Toast.error('Permissions Revoked', 'Your authorization permissions have been revoked. Please refresh the page.');
        }
        return;
      }
    } catch (permErr) {
      // If permission check fails, log but continue with local canAuthorize state
      // This maintains backwards compatibility if endpoint doesn't exist
      console.warn('[BULK_AUTH] Permission check failed, using cached permissions:', permErr.message);
    }

    const confirmed = confirm(`Authorize ${selectedExpenseIds.size} expense(s)? This will mark them as approved.`);
    if (!confirmed) return;

    // Disable button and show loading state
    els.btnBulkAuthorize.disabled = true;

    const totalExpenses = selectedExpenseIds.size;
    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;
    const failedIds = [];

    // Helper to update button text with progress
    function updateButtonProgress() {
      if (els.btnBulkAuthorize) {
        els.btnBulkAuthorize.innerHTML = `<span style="font-size: 14px;">⏳</span> Authorizing... (${processedCount}/${totalExpenses})`;
      }
    }

    // Helper to reset button to normal state
    function resetButton() {
      if (els.btnBulkAuthorize) {
        els.btnBulkAuthorize.disabled = false;
        // Restore the standard button format with current selection count
        const count = selectedExpenseIds.size;
        els.btnBulkAuthorize.innerHTML = `<span style="font-size: 14px;">✓</span> Authorize Selected (<span id="authorizeCount">${count}</span>)`;
        els.btnBulkAuthorize.disabled = count === 0;
        // Update the reference to the new authorizeCount element
        els.authorizeCount = document.getElementById('authorizeCount');
      }
    }

    try {
      // Convert Set to Array for processing
      const expenseIdsArray = Array.from(selectedExpenseIds);

      // Process in batches to avoid overwhelming the server
      const BATCH_SIZE = 5; // Process 5 expenses at a time
      const DELAY_MS = 300; // 300ms delay between batches

      console.log(`[BULK_AUTH] Starting authorization of ${totalExpenses} expenses in batches of ${BATCH_SIZE}`);

      // Helper function to delay execution
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Initial progress update
      updateButtonProgress();

      // Process expenses in batches
      for (let i = 0; i < expenseIdsArray.length; i += BATCH_SIZE) {
        const batch = expenseIdsArray.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(expenseIdsArray.length / BATCH_SIZE);

        console.log(`[BULK_AUTH] Processing batch ${batchNumber}/${totalBatches} (${batch.length} expenses)`);

        // Process current batch in parallel
        const batchPromises = batch.map(async (expenseId) => {
          try {
            await apiJson(`${apiBase}/expenses/${expenseId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                auth_status: true,
                auth_by: userId
              })
            });
            successCount++;
            processedCount++;

            // Update local data immediately
            const expense = expenses.find(e => String(e.expense_id || e.id) === String(expenseId));
            if (expense) {
              expense.auth_status = true;
              expense.auth_by = userId;
            }

            console.log(`[BULK_AUTH] ✓ Authorized expense ${expenseId}`);
          } catch (err) {
            failedCount++;
            processedCount++;
            failedIds.push(expenseId);
            console.error(`[BULK_AUTH] ✗ Failed to authorize expense ${expenseId}:`, err.message);
          }
        });

        // Wait for current batch to complete
        await Promise.all(batchPromises);

        // Update progress after each batch
        updateButtonProgress();

        // Delay before next batch (except for the last batch)
        if (i + BATCH_SIZE < expenseIdsArray.length) {
          await delay(DELAY_MS);
        }
      }

      console.log(`[BULK_AUTH] Completed: ${successCount} succeeded, ${failedCount} failed`);

      // Show results
      if (window.Toast) {
        if (failedCount === 0) {
          Toast.success('Authorization Complete', `Successfully authorized ${successCount} expense(s)!`);
        } else {
          Toast.warning('Partial Success', `${successCount} succeeded, ${failedCount} failed. Check console for details.`);
          console.error('[BULK_AUTH] Failed expense IDs:', failedIds);
        }
      }

      // Clear selection and refresh
      selectedExpenseIds.clear();
      renderExpensesTable();
      updateBulkDeleteButton();

    } catch (err) {
      console.error('[BULK_AUTH] Unexpected error:', err);
      if (window.Toast) {
        Toast.error('Authorization Error', `Processed: ${processedCount}/${totalExpenses}, Succeeded: ${successCount}`, { details: err.message });
      }
    } finally {
      // Always reset button state regardless of success or failure
      resetButton();
    }
  }

  function toggleSelectAll() {
    const displayExpenses = filteredExpenses.length > 0 || Object.values(columnFilters).some(f => f.length > 0) ? filteredExpenses : expenses;

    if (els.selectAllCheckbox.checked) {
      // Select all
      displayExpenses.forEach(exp => {
        const expenseId = exp.expense_id || exp.id;
        if (expenseId) selectedExpenseIds.add(expenseId);
      });
    } else {
      // Deselect all
      selectedExpenseIds.clear();
    }

    renderExpensesTable();
    updateBulkDeleteButton();
    updateBulkAuthorizeButton();
  }

  // ================================
  // ADD EXPENSE MODAL
  // ================================
  function openAddExpenseModal() {
    if (!selectedProjectId) return;

    // Find project name
    const project = metaData.projects.find(p => String(p.project_id || p.id) === String(selectedProjectId));
    const projectName = project ? (project.project_name || project.name) : '—';

    els.modalProjectName.textContent = projectName;

    // Clear existing rows and add one empty row
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;
    addModalRow();

    // Reset receipt state and render uploader
    currentReceiptFile = null;
    currentReceiptUrl = null;
    renderReceiptUploader();

    // Reset bill status section
    selectedBillStatus = 'open';
    updateBillStatusSection();

    // IMPORTANT: Reset Save button to enabled state
    if (els.btnSaveAllExpenses) {
      els.btnSaveAllExpenses.disabled = false;
      els.btnSaveAllExpenses.textContent = 'Save All';
    }

    // Show modal
    els.modal.classList.remove('hidden');
  }

  function closeAddExpenseModal() {
    // Revoke blob URL to prevent memory leak
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    els.modal.classList.add('hidden');
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;
    currentReceiptFile = null;
    currentReceiptUrl = null;
    scannedReceiptFile = null; // Clear scanned receipt reference
    scannedReceiptBillId = null;
    scannedReceiptVendorId = null;
    scannedReceiptTotal = null;
    isScannedReceiptMode = false;
    selectedBillStatus = 'open'; // Reset to default
    updateScannedReceiptModeUI(); // Reset UI
    updateBillStatusSection(); // Reset bill status UI
  }

  /**
   * Updates the Add Expense modal UI based on scanned receipt mode
   * When in scanned mode: disables Add Row, shows "bill will be closed" indicator
   */
  function updateScannedReceiptModeUI() {
    const addRowBtn = els.btnAddExpenseRow;
    const scannedIndicator = document.getElementById('scannedReceiptIndicator');

    if (isScannedReceiptMode) {
      // Disable Add Row button
      if (addRowBtn) {
        addRowBtn.disabled = true;
        addRowBtn.title = 'Adding rows is disabled for scanned receipts (bill will be closed)';
      }

      // Show indicator if it exists, or create it
      if (!scannedIndicator) {
        const indicator = document.createElement('div');
        indicator.id = 'scannedReceiptIndicator';
        indicator.className = 'scanned-receipt-indicator';
        indicator.innerHTML = `
          <div class="scanned-indicator-content">
            <span class="scanned-indicator-icon">📄</span>
            <div class="scanned-indicator-text">
              <strong>Scanned Receipt Mode</strong>
              <span>Bill #${scannedReceiptBillId || 'N/A'} will be marked as <strong>Closed</strong> when saved</span>
            </div>
            <button type="button" class="scanned-indicator-unlock" id="btnUnlockScannedMode" title="Allow adding more rows (for multi-bill receipts)">
              🔓 Unlock
            </button>
          </div>
        `;

        // Insert before the table
        const tableContainer = els.modal?.querySelector('.modal-table-container');
        if (tableContainer) {
          tableContainer.parentNode.insertBefore(indicator, tableContainer);
        }

        // Add unlock button handler
        document.getElementById('btnUnlockScannedMode')?.addEventListener('click', () => {
          isScannedReceiptMode = false;
          updateScannedReceiptModeUI();
        });
      }
    } else {
      // Enable Add Row button
      if (addRowBtn) {
        addRowBtn.disabled = false;
        addRowBtn.title = '';
      }

      // Remove indicator if exists
      if (scannedIndicator) {
        scannedIndicator.remove();
      }
    }
  }

  /**
   * Updates the Bill Status section in the Add Expense modal
   * Shows when there's a bill_id in the expenses, hidden otherwise
   */
  function updateBillStatusSection() {
    if (!els.billStatusSection) return;

    // Find bill_id from expense rows or scanned receipt
    let billId = scannedReceiptBillId;

    // Also check if any row has a bill_id filled in
    if (!billId) {
      const billInputs = els.expenseRowsBody?.querySelectorAll('.exp-input[data-field="bill_id"]');
      billInputs?.forEach(input => {
        if (input.value?.trim()) {
          billId = input.value.trim();
        }
      });
    }

    if (billId) {
      // Show the section
      els.billStatusSection.classList.remove('hidden');
      els.billStatusBillId.textContent = `#${billId}`;

      // Update selected state on buttons
      els.billStatusToggle.querySelectorAll('.bill-status-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.status === selectedBillStatus);
      });

      // Update hint based on selection
      updateBillStatusHint();
    } else {
      // Hide the section
      els.billStatusSection.classList.add('hidden');
    }
  }

  /**
   * Updates the hint text based on selected bill status
   */
  function updateBillStatusHint() {
    if (!els.billStatusHint) return;

    const hints = {
      'open': 'More expenses can be added to this bill later.',
      'closed': 'This bill will be marked complete. No more expenses can be added.',
      'split': 'This bill is split across multiple projects. Totals may not match the receipt.'
    };

    els.billStatusHint.textContent = hints[selectedBillStatus] || hints['open'];
  }

  // ================================
  // RECEIPT UPLOAD FUNCTIONS
  // ================================
  function renderReceiptUploader() {
    if (!els.receiptUploadContainer) return;
    if (!window.ReceiptUpload) {
      console.warn('[EXPENSES] ReceiptUpload module not loaded');
      return;
    }

    // Clear container
    els.receiptUploadContainer.innerHTML = '';

    if (currentReceiptUrl) {
      // Show preview with existing receipt
      const preview = window.ReceiptUpload.createPreview(currentReceiptUrl, handleReceiptDelete);
      els.receiptUploadContainer.appendChild(preview);
    } else {
      // Show uploader
      const uploader = window.ReceiptUpload.createUploader(handleFileSelected);
      els.receiptUploadContainer.appendChild(uploader);
    }
  }

  function handleFileSelected(file) {
    console.log('[EXPENSES] File selected:', file.name, file.size);

    // Validate file
    if (!window.ReceiptUpload.ALLOWED_TYPES.includes(file.type)) {
      if (window.Toast) {
        Toast.error('Invalid File', 'Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
      }
      return;
    }

    if (file.size > window.ReceiptUpload.MAX_FILE_SIZE) {
      if (window.Toast) {
        Toast.error('File Too Large', 'Maximum file size is 5MB.');
      }
      return;
    }

    // Store file for upload when saving expense
    currentReceiptFile = file;

    // Revoke previous blob URL if exists (prevent memory leak)
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
    }

    // Create temporary preview URL and track it for cleanup
    const tempUrl = URL.createObjectURL(file);
    currentBlobUrl = tempUrl;
    currentReceiptUrl = tempUrl;

    // Re-render to show preview
    renderReceiptUploader();
  }

  function handleReceiptDelete() {
    // Revoke blob URL to prevent memory leak
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    currentReceiptFile = null;
    currentReceiptUrl = null;
    renderReceiptUploader();
  }

  function addModalRow() {
    const rowIndex = modalRowCounter++;
    const today = new Date().toISOString().split('T')[0];

    const row = document.createElement('tr');
    row.dataset.rowIndex = rowIndex;

    row.innerHTML = `
      <td>
        <input type="date" class="exp-input exp-input--date" data-field="TxnDate" value="${today}">
      </td>
      <td>
        <input type="text" class="exp-input exp-input--bill-id" data-field="bill_id" placeholder="Bill #">
      </td>
      <td>
        <input type="text" class="exp-input exp-input--desc" data-field="LineDescription" placeholder="Description">
      </td>
      <td>
        ${buildModalSelectHtml('txn_type', metaData.txn_types, 'TnxType_id', 'TnxType_name')}
      </td>
      <td>
        ${buildModalSelectHtml('vendor_id', metaData.vendors, 'id', 'vendor_name')}
      </td>
      <td>
        ${buildModalSelectHtml('payment_type', metaData.payment_methods, 'id', 'payment_method_name')}
      </td>
      <td>
        ${buildModalSelectHtml('account_id', metaData.accounts, 'account_id', 'Name')}
      </td>
      <td>
        <input type="text" class="exp-input exp-input--amount" data-field="Amount" placeholder="0.00" inputmode="decimal">
      </td>
      <td>
        <button type="button" class="btn-row-receipt" data-row-index="${rowIndex}" title="Attach receipt">
          📎
        </button>
        <input type="file" class="row-receipt-input" data-row-index="${rowIndex}" accept="image/*,application/pdf" style="display: none;">
      </td>
      <td>
        <button type="button" class="exp-row-remove" data-row-index="${rowIndex}">×</button>
      </td>
    `;

    els.expenseRowsBody.appendChild(row);
    updateAutoCategorizeButton();

    // Add event listener for receipt button
    const receiptBtn = row.querySelector('.btn-row-receipt');
    const receiptInput = row.querySelector('.row-receipt-input');

    receiptBtn.addEventListener('click', () => {
      receiptInput.click();
    });

    receiptInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // Store file reference in row data
        row.dataset.receiptFile = 'pending'; // Mark that this row has a file
        receiptBtn.classList.add('receipt-icon-btn--has-receipt');
        receiptBtn.title = `Receipt: ${file.name}`;
        console.log(`[MODAL] Receipt attached to row ${rowIndex}:`, file.name);
      }
    });

    // Add simple decimal formatting for amount input
    const amountInput = row.querySelector('.exp-input--amount');
    if (amountInput) {
      amountInput.addEventListener('blur', (e) => {
        const value = e.target.value.trim();
        if (value && !isNaN(value)) {
          // Format to 2 decimal places
          const numValue = parseFloat(value);
          e.target.value = numValue.toFixed(2);
        }
      });
    }
  }

  function buildModalSelectHtml(field, options, valueKey, textKey) {
    const datalistId = `datalist-${field}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optionsHtml = options.map(opt => {
      const val = opt[valueKey];
      // Try multiple possible name fields - prioritize textKey, then common alternatives
      const text = opt[textKey] || opt.Name || opt.name || opt.vendor_name || opt.account_name ||
                   opt.payment_method_name || opt.txn_type_name || opt.TnxType_name ||
                   `Unnamed (${val})`;
      return `<option value="${text}" data-value-id="${val}">${text}</option>`;
    }).join('');

    // Store mapping in data attribute for later retrieval
    const mappingJson = JSON.stringify(
      options.map(opt => ({
        text: opt[textKey] || opt.Name || opt.name || opt.vendor_name || opt.account_name ||
              opt.payment_method_name || opt.txn_type_name || opt.TnxType_name || `Unnamed (${opt[valueKey]})`,
        id: opt[valueKey]
      }))
    );

    return `
      <input
        type="text"
        class="exp-input exp-input-searchable"
        data-field="${field}"
        data-mapping='${mappingJson.replace(/'/g, '&apos;')}'
        list="${datalistId}"
        placeholder="Type or select..."
        autocomplete="off"
      >
      <datalist id="${datalistId}">
        ${optionsHtml}
      </datalist>
    `;
  }

  function removeModalRow(rowIndex) {
    const row = els.expenseRowsBody.querySelector(`tr[data-row-index="${rowIndex}"]`);
    if (row) {
      row.remove();
    }
    updateAutoCategorizeButton();
  }

  function updateAutoCategorizeButton() {
    if (!els.btnAutoCategorize) return;

    // Check if at least one row has a description
    const rows = els.expenseRowsBody?.querySelectorAll('tr') || [];
    let hasDescription = false;

    rows.forEach(row => {
      const descInput = row.querySelector('.exp-input--desc');
      if (descInput && descInput.value.trim()) {
        hasDescription = true;
      }
    });

    els.btnAutoCategorize.disabled = !hasDescription;
  }

  // ================================
  // FUZZY MATCHING HELPER
  // ================================

  /**
   * Calculate Levenshtein distance between two strings (edit distance)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  function levenshteinDistance(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  /**
   * Calculate similarity percentage between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity percentage (0-100)
   */
  function calculateSimilarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 100;

    const distance = levenshteinDistance(str1, str2);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  /**
   * Find similar accounts using fuzzy matching
   * @param {string} searchName - Account name to search for
   * @param {Array} accounts - List of available accounts
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Array} - Array of similar accounts with similarity scores
   */
  function findSimilarAccounts(searchName, accounts, maxResults = 3) {
    const similarities = accounts.map(account => {
      const accountName = account.Name || account.name || '';
      return {
        name: accountName,
        id: account.account_id || account.id,
        similarity: calculateSimilarity(searchName, accountName)
      };
    });

    // Filter accounts with at least 50% similarity and sort by similarity
    return similarities
      .filter(item => item.similarity >= 50)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
  }

  // ================================
  // SAVE ALL EXPENSES
  // ================================

  async function saveAllExpenses() {
    const apiBase = getApiBase();
    const rows = els.expenseRowsBody.querySelectorAll('tr');
    const expensesToSave = [];
    const invalidAccounts = new Set();
    const rowsWithInvalidAccounts = [];
    const invalidVendors = new Set();
    const rowsWithInvalidVendors = [];
    const invalidTxnTypes = new Set();
    const rowsWithInvalidTxnTypes = [];
    const invalidPaymentTypes = new Set();
    const rowsWithInvalidPaymentTypes = [];

    // Collect data from each row including receipt files
    rows.forEach((row, rowIdx) => {
      const rowData = {
        project: selectedProjectId,
        created_by: currentUser.user_id || currentUser.id
      };

      row.querySelectorAll('.exp-input').forEach(input => {
        const field = input.dataset.field;
        let value = input.value;

        // For searchable inputs, convert text back to ID
        if (input.classList.contains('exp-input-searchable') && input.dataset.mapping) {
          try {
            const mapping = JSON.parse(input.dataset.mapping);
            // Use case-insensitive and trimmed comparison
            const trimmedValue = value ? value.trim() : '';
            const match = mapping.find(m => {
              const mappingText = m.text ? m.text.trim() : '';
              return mappingText.toLowerCase() === trimmedValue.toLowerCase();
            });

            if (match) {
              value = match.id;
              console.log(`[SAVE] Matched ${field}: "${trimmedValue}" -> ID: ${match.id}`);
            } else if (trimmedValue !== '') {
              // Value doesn't match any existing option
              console.warn(`[SAVE] No match found for ${field}: "${trimmedValue}"`);
              if (field === 'account_id') {
                invalidAccounts.add(trimmedValue);
                rowsWithInvalidAccounts.push({ row: rowIdx + 1, accountName: trimmedValue });
                console.log(`[SAVE] Added to invalid accounts: "${trimmedValue}" (Row ${rowIdx + 1})`);
              } else if (field === 'vendor_id') {
                invalidVendors.add(trimmedValue);
                rowsWithInvalidVendors.push({ row: rowIdx + 1, vendorName: trimmedValue });
                console.log(`[SAVE] Added to invalid vendors: "${trimmedValue}" (Row ${rowIdx + 1})`);
              } else if (field === 'txn_type') {
                invalidTxnTypes.add(trimmedValue);
                rowsWithInvalidTxnTypes.push({ row: rowIdx + 1, typeName: trimmedValue });
                console.log(`[SAVE] Added to invalid txn types: "${trimmedValue}" (Row ${rowIdx + 1})`);
              } else if (field === 'payment_type') {
                invalidPaymentTypes.add(trimmedValue);
                rowsWithInvalidPaymentTypes.push({ row: rowIdx + 1, paymentName: trimmedValue });
                console.log(`[SAVE] Added to invalid payment types: "${trimmedValue}" (Row ${rowIdx + 1})`);
              }
              // Leave value as text for now - we'll handle it below
            }
          } catch (e) {
            console.warn('Failed to parse mapping for field:', field, e);
          }
        } else if (field === 'Amount') {
          value = parseCurrency(value);
        }

        rowData[field] = value || null;
      });

      // Check if row has a receipt file
      const receiptInput = row.querySelector('.row-receipt-input');
      if (receiptInput && receiptInput.files.length > 0) {
        rowData._receiptFile = receiptInput.files[0]; // Store file temporarily
      } else if (scannedReceiptFile) {
        // If no individual receipt but we have a scanned receipt, use it
        rowData._receiptFile = scannedReceiptFile;
        rowData._fromScannedReceipt = true; // Mark as coming from scanned receipt
      }

      // Check if row has a pending receipt ID (from pending receipts modal)
      if (row.dataset.pendingReceiptId) {
        rowData._pendingReceiptId = row.dataset.pendingReceiptId;
      }

      // Check if row has a receipt URL from pending receipt
      if (row.dataset.receiptUrl) {
        rowData.receipt_url = row.dataset.receiptUrl;
      }

      // Validate required fields
      if (rowData.TxnDate && rowData.Amount) {
        expensesToSave.push(rowData);
      }
    });

    // ============================================
    // VALIDATION: Reject expenses for closed bills
    // (Skip validation in scanned receipt mode - we handle the bill status ourselves)
    // ============================================
    const closedBillErrors = [];
    expensesToSave.forEach((expense, idx) => {
      if (expense.bill_id) {
        // Skip validation if this is the scanned receipt bill - we're creating/managing it
        if (isScannedReceiptMode && expense.bill_id === scannedReceiptBillId) {
          return; // Skip this expense - we'll handle the bill status
        }
        const billData = getBillMetadata(expense.bill_id);
        if (billData && billData.status === 'closed') {
          closedBillErrors.push({
            row: idx + 1,
            billId: expense.bill_id
          });
        }
      }
    });

    if (closedBillErrors.length > 0) {
      const billList = closedBillErrors.map(err => `Bill #${err.billId} (Row ${err.row})`).join(', ');
      if (window.Toast) {
        Toast.error('Closed Bill Detected', 'Cannot add expenses to closed bills. Reopen them in Bill View first.', { details: billList });
      }
      return; // Stop saving
    }

    // ============================================
    // WARNING: Almost certain duplicate bills
    // ============================================
    const duplicateConflicts = [];
    expensesToSave.forEach((expense, idx) => {
      if (expense.vendor_id) {
        // Pass all parameters for accurate duplicate detection
        const conflict = checkBillVendorConflict(
          expense.bill_id,
          expense.vendor_id,
          expense.Amount,
          expense.TxnDate
        );
        if (conflict) {
          const vendorName = findMetaName('vendors', expense.vendor_id, 'id', 'vendor_name') || 'Unknown';
          duplicateConflicts.push({
            row: idx + 1,
            type: conflict.type,
            billId: conflict.billId,
            vendor: vendorName,
            amount: conflict.existingAmount,
            existingDate: conflict.existingDate
          });
        }
      }
    });

    if (duplicateConflicts.length > 0) {
      const conflictDetails = duplicateConflicts.map(c => {
        const typeLabel = c.type === 'strong' ? '🟠 STRONG' : '🟡 LIKELY';
        return `${typeLabel} Row ${c.row}: ${c.vendor} - $${c.amount?.toFixed(2)}${c.billId ? ` (Bill #${c.billId})` : ''}`;
      }).join('\n');

      // Show warning but allow user to proceed
      if (window.Toast) {
        Toast.warning(
          'Possible Duplicate Bills Detected',
          `${duplicateConflicts.length} expense(s) appear to be duplicates. Review before saving.`,
          { details: conflictDetails, duration: 10000 }
        );
      }
      // Note: We show a warning but don't block saving - user can proceed
    }

    // ============================================
    // VALIDATION: Reject invalid vendors
    // ============================================
    if (invalidVendors.size > 0) {
      const invalidVendorsList = Array.from(invalidVendors);
      const vendorDetails = invalidVendorsList.map(vendorName => {
        const rowsWithThis = rowsWithInvalidVendors.filter(r => r.vendorName === vendorName);
        const rowNumbers = rowsWithThis.map(r => r.row).join(', ');
        return `"${vendorName}" (Row ${rowNumbers})`;
      }).join('\n');
      if (window.Toast) {
        Toast.error('Invalid Vendors', 'Some vendors are not registered. Select from dropdown or add new vendors in Settings.', { details: vendorDetails });
      }
      return; // Stop saving
    }

    // ============================================
    // VALIDATION: Reject invalid transaction types
    // ============================================
    if (invalidTxnTypes.size > 0) {
      const invalidTypesList = Array.from(invalidTxnTypes);
      const typeDetails = invalidTypesList.map(typeName => {
        const rowsWithThis = rowsWithInvalidTxnTypes.filter(r => r.typeName === typeName);
        const rowNumbers = rowsWithThis.map(r => r.row).join(', ');
        return `"${typeName}" (Row ${rowNumbers})`;
      }).join('\n');
      if (window.Toast) {
        Toast.error('Invalid Transaction Types', 'Select a valid transaction type from the dropdown.', { details: typeDetails });
      }
      return; // Stop saving
    }

    // ============================================
    // VALIDATION: Reject invalid payment types
    // ============================================
    if (invalidPaymentTypes.size > 0) {
      const invalidPaymentsList = Array.from(invalidPaymentTypes);
      const paymentDetails = invalidPaymentsList.map(paymentName => {
        const rowsWithThis = rowsWithInvalidPaymentTypes.filter(r => r.paymentName === paymentName);
        const rowNumbers = rowsWithThis.map(r => r.row).join(', ');
        return `"${paymentName}" (Row ${rowNumbers})`;
      }).join('\n');
      if (window.Toast) {
        Toast.error('Invalid Payment Methods', 'Select a valid payment method from the dropdown.', { details: paymentDetails });
      }
      return; // Stop saving
    }

    // ============================================
    // VALIDATION: Reject invalid amounts (negative or extreme values)
    // ============================================
    const MAX_AMOUNT = 10000000; // $10 million limit
    const invalidAmounts = [];
    expensesToSave.forEach((expense, idx) => {
      const amount = expense.Amount;
      if (amount !== null && amount !== undefined) {
        if (amount < 0) {
          invalidAmounts.push({ row: idx + 1, amount, reason: 'Negative amount not allowed' });
        } else if (amount > MAX_AMOUNT) {
          invalidAmounts.push({ row: idx + 1, amount, reason: `Amount exceeds maximum ($${MAX_AMOUNT.toLocaleString()})` });
        } else if (!isFinite(amount)) {
          invalidAmounts.push({ row: idx + 1, amount, reason: 'Invalid number' });
        }
      }
    });

    if (invalidAmounts.length > 0) {
      const amountDetails = invalidAmounts.map(inv => `Row ${inv.row}: $${inv.amount} - ${inv.reason}`).join('\n');
      if (window.Toast) {
        Toast.error('Invalid Amounts', 'Please correct the amounts before saving.', { details: amountDetails });
      }
      return; // Stop saving
    }

    if (expensesToSave.length === 0) {
      if (window.Toast) {
        Toast.warning('Missing Data', 'Please fill in at least one complete expense row (Date and Amount are required).');
      }
      return;
    }

    // Check for invalid accounts
    if (invalidAccounts.size > 0) {
      // Build message with fuzzy matching suggestions
      const invalidAccountsList = Array.from(invalidAccounts);
      let message = 'The following accounts don\'t exist in your system:\n\n';

      // Calculate fuzzy matches for each invalid account
      invalidAccountsList.forEach(invalidName => {
        const suggestions = findSimilarAccounts(invalidName, metaData.accounts, 3);
        const rowsWithThis = rowsWithInvalidAccounts.filter(r => r.accountName === invalidName);
        const rowNumbers = rowsWithThis.map(r => r.row).join(', ');

        message += `\n❌ "${invalidName}" (Row ${rowNumbers})\n`;

        if (suggestions.length > 0) {
          message += `   💡 Similar accounts found:\n`;
          suggestions.forEach((sugg, idx) => {
            message += `      ${idx + 1}. "${sugg.name}" (${sugg.similarity}% match)\n`;
          });
        } else {
          message += `   (No similar accounts found)\n`;
        }
      });

      message += '\n\nWould you like to:\n\n1. Create these accounts automatically\n2. Cancel and select existing accounts manually';

      const createAccounts = confirm(message + '\n\n(OK = Create accounts, Cancel = Go back)');

      if (!createAccounts) {
        return; // User wants to go back and fix manually
      }

      // Create accounts automatically
      try {
        for (const accountName of invalidAccounts) {
          console.log('[EXPENSES] Creating account:', accountName);

          const response = await apiJson(`${apiBase}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Name: accountName,
              Type: 'Expense', // Default type
              Active: true
            })
          });

          const newAccount = response.data || response;
          const accountId = newAccount.account_id || newAccount.id;

          console.log('[EXPENSES] Created account with ID:', accountId);

          // Add to metaData for future use
          metaData.accounts.push({
            account_id: accountId,
            Name: accountName,
            Type: 'Expense',
            Active: true
          });

          // Update all rows that had this account name
          expensesToSave.forEach(expense => {
            if (expense.account_id === accountName) {
              expense.account_id = accountId;
            }
          });
        }

        console.log('[EXPENSES] Successfully created', invalidAccounts.size, 'accounts');
      } catch (err) {
        console.error('[EXPENSES] Error creating accounts:', err);
        if (window.Toast) {
          Toast.error('Account Creation Failed', 'Please create accounts manually or select from existing ones.', { details: err.message });
        }
        return;
      }
    }

    // Show loading state with animated icon
    els.btnSaveAllExpenses.disabled = true;
    const originalButtonText = els.btnSaveAllExpenses.textContent;
    els.btnSaveAllExpenses.innerHTML = '<img src="assets/img/greenblack_icon.png" class="loading-logo loading-logo-sm" alt="Loading..." style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"> Saving expenses...';

    try {
      console.log('[EXPENSES] Starting save process for', expensesToSave.length, 'expenses');

      // ============================================
      // PHASE 1: Create all expenses with BATCH endpoint
      // ============================================
      const createdExpenses = [];
      const expensesByBillId = {}; // Map bill_id -> array of { expense, receiptFile }

      // Separate receipt files from expense data (can't send files in JSON)
      const receiptFilesMap = new Map(); // index -> { file, isFromScan }
      const expensesForBatch = expensesToSave.map((exp, idx) => {
        const expenseData = { ...exp };
        const receiptFile = expenseData._receiptFile;
        const isFromScan = expenseData._fromScannedReceipt;
        delete expenseData._receiptFile;
        delete expenseData._fromScannedReceipt;

        if (receiptFile) {
          receiptFilesMap.set(idx, { file: receiptFile, isFromScan });
        }

        return expenseData;
      });

      console.log('[EXPENSES] Sending batch request for', expensesForBatch.length, 'expenses');
      const batchStartTime = performance.now();

      // Single API call for all expenses
      const batchResult = await apiJson(`${apiBase}/expenses/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: expensesForBatch })
      });

      const batchEndTime = performance.now();
      console.log(`[EXPENSES] Batch insert completed in ${(batchEndTime - batchStartTime).toFixed(0)}ms`);
      console.log('[EXPENSES] Batch result:', batchResult.summary);

      // Process created expenses
      const createdList = batchResult.created || [];
      for (let i = 0; i < createdList.length; i++) {
        const createdData = createdList[i];
        const expenseId = createdData.expense_id || createdData.id;
        const billId = createdData.bill_id?.trim() || null;
        const receiptInfo = receiptFilesMap.get(i);

        createdExpenses.push({
          created: { expense: createdData },
          expenseId,
          billId,
          receiptFile: receiptInfo?.file || null,
          isFromScan: receiptInfo?.isFromScan || false
        });

        // Group by bill_id for receipt sharing
        if (billId) {
          if (!expensesByBillId[billId]) {
            expensesByBillId[billId] = [];
          }
          expensesByBillId[billId].push({
            expenseId,
            receiptFile: receiptInfo?.file || null,
            createdData
          });
        }
      }

      // Log any failures
      if (batchResult.failed && batchResult.failed.length > 0) {
        console.warn('[EXPENSES] Some expenses failed to create:', batchResult.failed);
      }

      // ============================================
      // PHASE 1.5: Link pending receipts to created expenses
      // ============================================
      const pendingReceiptLinks = [];
      for (let i = 0; i < expensesToSave.length; i++) {
        const expenseData = expensesToSave[i];
        const createdExpense = createdList[i];

        if (expenseData._pendingReceiptId && createdExpense) {
          pendingReceiptLinks.push({
            receiptId: expenseData._pendingReceiptId,
            expenseId: createdExpense.expense_id || createdExpense.id
          });
        }
      }

      // Link pending receipts to expenses
      if (pendingReceiptLinks.length > 0) {
        console.log('[EXPENSES] Linking', pendingReceiptLinks.length, 'pending receipts to expenses...');

        for (const link of pendingReceiptLinks) {
          try {
            const linkResponse = await fetch(`${apiBase}/pending-receipts/${link.receiptId}/link`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
              },
              body: JSON.stringify({ expense_id: link.expenseId })
            });

            if (linkResponse.ok) {
              console.log(`[EXPENSES] Linked receipt ${link.receiptId} to expense ${link.expenseId}`);

              // Update message status in Messages module if available
              if (window.MessagesModule?.updateReceiptStatusInMessages) {
                window.MessagesModule.updateReceiptStatusInMessages(link.receiptId, 'linked');
              }
            } else {
              console.warn(`[EXPENSES] Failed to link receipt ${link.receiptId}:`, await linkResponse.text());
            }
          } catch (linkErr) {
            console.error(`[EXPENSES] Error linking receipt ${link.receiptId}:`, linkErr);
          }
        }
      }

      // ============================================
      // PHASE 2: Create bills and upload receipts
      // ============================================
      // Receipt URL is stored in bills table, not in individual expenses
      const uploadedReceiptsByBillId = {}; // bill_id -> receipt_url
      const failedReceiptUploads = []; // Track failed uploads for user notification

      if (window.ReceiptUpload) {
        console.log('[EXPENSES] Processing receipts by bill_id...');

        // First, handle grouped expenses (same bill_id) - create bill record and upload receipt
        for (const [billId, expensesInBill] of Object.entries(expensesByBillId)) {
          // Find the first expense with a receipt file
          const expenseWithReceipt = expensesInBill.find(e => e.receiptFile);

          if (expenseWithReceipt) {
            try {
              console.log(`[EXPENSES] Uploading receipt for bill ${billId} (${expensesInBill.length} expenses)`);

              // Upload using bill_id as identifier
              const receiptUrl = await window.ReceiptUpload.upload(
                expenseWithReceipt.receiptFile,
                expenseWithReceipt.expenseId, // Fallback ID
                selectedProjectId,
                billId // Use bill_id for the filename
              );

              uploadedReceiptsByBillId[billId] = receiptUrl;
              console.log(`[EXPENSES] Receipt uploaded for bill ${billId}:`, receiptUrl);

              // Create or update bill record in bills table
              try {
                // Check if bill already exists
                const existingBill = getBillMetadata(billId);

                if (existingBill) {
                  // Update existing bill with receipt_url if not set
                  const updateData = {};
                  if (!existingBill.receipt_url) {
                    updateData.receipt_url = receiptUrl;
                  }
                  // Update status based on user selection (selectedBillStatus)
                  // Only update if this is the bill the user selected status for
                  if (scannedReceiptBillId === billId || selectedBillStatus !== 'open') {
                    updateData.status = selectedBillStatus;
                  }
                  if (Object.keys(updateData).length > 0) {
                    await apiJson(`${apiBase}/bills/${billId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updateData)
                    });
                    console.log(`[EXPENSES] Updated existing bill ${billId}:`, updateData);
                  }
                } else {
                  // Create new bill record
                  // Use selectedBillStatus (defaults to 'open', or 'closed' if scanned receipt mode)
                  const billStatus = selectedBillStatus;
                  const billData = {
                    bill_id: billId,
                    receipt_url: receiptUrl,
                    status: billStatus
                  };

                  // Add vendor_id if this is from scan and we have it
                  if (scannedReceiptBillId === billId && scannedReceiptVendorId) {
                    billData.vendor_id = scannedReceiptVendorId;
                  }

                  // Add expected_total if available
                  if (scannedReceiptBillId === billId && scannedReceiptTotal) {
                    billData.expected_total = scannedReceiptTotal;
                  }

                  await apiJson(`${apiBase}/bills`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(billData)
                  });
                  console.log(`[EXPENSES] Created bill record for ${billId} with status '${billStatus}':`, billData);

                  // Add to local metadata cache (using upsert to prevent duplicates)
                  upsertBillInCache(billData);
                }
              } catch (billErr) {
                // Bill creation might fail if it already exists - that's OK
                console.warn(`[EXPENSES] Could not create/update bill ${billId}:`, billErr.message);
              }

              // NO longer update individual expenses with receipt_url
              // The receipt is now stored in the bills table
              console.log(`[EXPENSES] Receipt for bill ${billId} stored in bills table (not in expenses)`);

            } catch (uploadErr) {
              console.error(`[EXPENSES] Error uploading receipt for bill ${billId}:`, uploadErr);
              failedReceiptUploads.push({
                type: 'bill',
                id: billId,
                expenseCount: expensesInBill.length,
                error: uploadErr.message
              });
            }
          }
        }

        // Handle expenses without bill_id (individual receipts - legacy support)
        for (const expData of createdExpenses) {
          if (!expData.billId && expData.receiptFile) {
            try {
              console.log(`[EXPENSES] Uploading individual receipt for expense ${expData.expenseId} (no bill_id)`);

              const receiptUrl = await window.ReceiptUpload.upload(
                expData.receiptFile,
                expData.expenseId,
                selectedProjectId,
                null // No bill_id, use expense_id
              );

              // For expenses without bill_id, store receipt_url in expense (legacy behavior)
              await apiJson(`${apiBase}/expenses/${expData.expenseId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  receipt_url: receiptUrl,
                  LineDescription: expData.created.expense?.LineDescription || expData.created.LineDescription || null
                })
              });

              console.log(`[EXPENSES] Expense ${expData.expenseId} updated with individual receipt URL`);
            } catch (uploadErr) {
              console.error(`[EXPENSES] Error uploading receipt for expense ${expData.expenseId}:`, uploadErr);
              failedReceiptUploads.push({
                type: 'expense',
                id: expData.expenseId,
                error: uploadErr.message
              });
            }
          }
        }
      }

      console.log('[EXPENSES] All expenses saved successfully');

      // Clear scanned receipt state
      scannedReceiptFile = null;
      scannedReceiptBillId = null;
      scannedReceiptVendorId = null;
      scannedReceiptTotal = null;
      isScannedReceiptMode = false;
      selectedBillStatus = 'open'; // Reset to default

      // Reload expenses BEFORE closing modal so user doesn't see stale data
      console.log('[EXPENSES] Reloading expenses...');
      await loadExpensesByProject(selectedProjectId);
      console.log('[EXPENSES] Expenses reloaded, now closing modal');

      closeAddExpenseModal();

      // Build success message, including any receipt upload failures
      if (window.Toast) {
        if (failedReceiptUploads.length > 0) {
          const failDetails = failedReceiptUploads.map(fail => {
            if (fail.type === 'bill') {
              return `Bill #${fail.id} (${fail.expenseCount} expenses): ${fail.error}`;
            }
            return `Expense ${fail.id}: ${fail.error}`;
          }).join('\n');
          Toast.warning('Saved with Warnings', `${expensesToSave.length} expense(s) saved. ${failedReceiptUploads.length} receipt(s) failed to upload.`, { details: failDetails });
        } else {
          Toast.success('Expenses Saved', `${expensesToSave.length} expense(s) saved successfully!`);
        }
      }

    } catch (err) {
      console.error('[EXPENSES] Error saving expenses:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving expenses.', { details: err.message });
      }

      // Reset button state on error
      els.btnSaveAllExpenses.disabled = false;
      els.btnSaveAllExpenses.textContent = originalButtonText;
    }
  }

  // ================================
  // SINGLE EXPENSE EDIT MODAL
  // ================================

  async function loadAuditTrail(expenseId) {
    if (!expenseId) {
      console.error('[EXPENSES] No expense ID provided for audit trail');
      return;
    }

    try {
      els.auditTrailList.innerHTML = '<div class="audit-trail-loading">Loading audit history...</div>';

      const response = await apiJson(`${apiBase}/expenses/${expenseId}/audit-trail`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const auditData = await response.json();
      console.log('[EXPENSES] Audit trail loaded:', auditData);

      // Render audit trail
      if (!auditData.audit_trail || auditData.audit_trail.length === 0) {
        els.auditTrailList.innerHTML = '<div class="audit-trail-empty">No history available</div>';
        return;
      }

      const auditHTML = auditData.audit_trail.map(entry => {
        const date = new Date(entry.changed_at).toLocaleString();
        const isStatusChange = entry.change_type === 'status';

        let changeText = '';
        if (isStatusChange) {
          changeText = `Status changed from <strong>${entry.old_status || 'pending'}</strong> to <strong>${entry.new_status}</strong>`;
        } else {
          changeText = `<strong>${entry.field_name}</strong> changed from "${entry.old_value || 'empty'}" to "${entry.new_value}"`;
        }

        return `
          <div class="audit-trail-item">
            <div class="audit-trail-header">
              <span class="audit-trail-type audit-trail-type--${isStatusChange ? 'status' : 'field'}">
                ${isStatusChange ? 'STATUS' : 'FIELD'}
              </span>
              <span class="audit-trail-date">${date}</span>
            </div>
            <div class="audit-trail-change">${changeText}</div>
            ${entry.reason ? `<div class="audit-trail-reason">Reason: ${entry.reason}</div>` : ''}
            ${entry.changed_by_name ? `<div class="audit-trail-user">By: ${entry.changed_by_name}</div>` : ''}
          </div>
        `;
      }).join('');

      els.auditTrailList.innerHTML = auditHTML;

    } catch (err) {
      console.error('[EXPENSES] Error loading audit trail:', err);
      els.auditTrailList.innerHTML = '<div class="audit-trail-empty">Error loading history</div>';
    }
  }

  function openSingleExpenseModal(expenseId) {
    // Backend uses 'expense_id' as primary key
    // Convert both IDs to strings for safe comparison (IDs may come as strings or numbers)
    const expense = expenses.find(exp => {
      const id = exp.expense_id || exp.id;
      return String(id) === String(expenseId);
    });

    if (!expense) {
      console.error('[EXPENSES] Expense not found:', expenseId);
      console.error('[EXPENSES] Looking for expense_id:', expenseId);
      console.error('[EXPENSES] First expense expense_id:', expenses[0]?.expense_id);
      return;
    }

    currentEditingExpense = { ...expense };
    console.log('[EXPENSES] Opening single expense modal for:', currentEditingExpense);

    // Populate form fields
    els.singleExpenseDate.value = expense.TxnDate ? expense.TxnDate.split('T')[0] : '';
    els.singleExpenseBillId.value = expense.bill_id || '';
    els.singleExpenseDescription.value = expense.LineDescription || '';

    // Set amount value - use plain number, not formatted (formatting will happen on blur)
    const amountValue = expense.Amount || expense.amount || 0;
    console.log('[EXPENSES] Setting amount field value:', amountValue, 'from expense.Amount:', expense.Amount);
    els.singleExpenseAmount.value = amountValue;

    // Populate dropdowns
    populateSingleExpenseDropdowns();

    // Set selected values - display text, store ID in data-value
    // Type
    const selectedType = metaData.txn_types.find(t => String(t.TnxType_id || t.id) === String(expense.txn_type));
    els.singleExpenseType.value = selectedType ? (selectedType.TnxType_name || selectedType.name || '') : '';
    els.singleExpenseType.setAttribute('data-value', expense.txn_type || '');

    // Vendor
    const selectedVendor = metaData.vendors.find(v => String(v.id) === String(expense.vendor_id));
    els.singleExpenseVendor.value = selectedVendor ? (selectedVendor.vendor_name || selectedVendor.name || '') : '';
    els.singleExpenseVendor.setAttribute('data-value', expense.vendor_id || '');

    // Payment
    const selectedPayment = metaData.payment_methods.find(p => String(p.id) === String(expense.payment_type));
    els.singleExpensePayment.value = selectedPayment ? (selectedPayment.payment_method_name || selectedPayment.name || '') : '';
    els.singleExpensePayment.setAttribute('data-value', expense.payment_type || '');

    // Account
    const selectedAccount = metaData.accounts.find(a => String(a.account_id) === String(expense.account_id));
    els.singleExpenseAccount.value = selectedAccount ? (selectedAccount.Name || selectedAccount.name || '') : '';
    els.singleExpenseAccount.setAttribute('data-value', expense.account_id || '');

    // Handle receipt - check bills table first, then expense, then related expenses
    currentReceiptFile = null;
    currentReceiptDeleted = false;

    let receiptUrl = null;
    const billId = expense.bill_id?.trim();

    // Priority 1: Get receipt from bills table (new system)
    if (billId) {
      const billData = getBillMetadata(billId);
      if (billData?.receipt_url) {
        receiptUrl = billData.receipt_url;
        console.log(`[EXPENSES] Found receipt from bills table for bill ${billId}:`, receiptUrl);
      }
    }

    // Priority 2: Get receipt from expense itself (legacy support)
    if (!receiptUrl && expense.receipt_url) {
      receiptUrl = expense.receipt_url;
      console.log(`[EXPENSES] Found receipt from expense:`, receiptUrl);
    }

    // Priority 3: Look for receipt from other expenses with same bill_id (legacy support)
    if (!receiptUrl && billId) {
      const relatedExpenseWithReceipt = expenses.find(exp => {
        const expBillId = exp.bill_id?.trim();
        const expId = exp.expense_id || exp.id;
        return expBillId === billId && expId != (expense.expense_id || expense.id) && exp.receipt_url;
      });

      if (relatedExpenseWithReceipt) {
        receiptUrl = relatedExpenseWithReceipt.receipt_url;
        console.log(`[EXPENSES] Found shared receipt from related expense (bill ${billId}):`, receiptUrl);
      }
    }

    currentReceiptUrl = receiptUrl;
    renderSingleExpenseReceipt();

    // Handle expense status selector (only show for authorized roles)
    console.log('[EXPENSES] Opening modal - canAuthorize:', canAuthorize);
    console.log('[EXPENSES] Status container element exists:', !!els.singleExpenseStatusContainer);
    console.log('[EXPENSES] Current expense status:', expense.status, 'auth_status:', expense.auth_status);

    // Determine current status (backwards compatible with old auth_status)
    let currentStatus = expense.status || 'pending';
    if (!expense.status && (expense.auth_status === true || expense.auth_status === 1)) {
      currentStatus = 'auth';
    }

    if (canAuthorize && els.singleExpenseStatusContainer) {
      console.log('[EXPENSES] Showing status selector');
      els.singleExpenseStatusContainer.style.display = 'block';
      if (els.singleExpenseAuthContainer) {
        els.singleExpenseAuthContainer.style.display = 'none'; // Hide old checkbox
      }

      // Set active status button
      const statusButtons = els.expenseStatusSelector.querySelectorAll('.expense-status-btn');
      statusButtons.forEach(btn => {
        const btnStatus = btn.getAttribute('data-status');
        if (btnStatus === currentStatus) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Hide reason field initially (show only if changing to review)
      els.singleExpenseReasonContainer.classList.add('hidden');
      els.singleExpenseReason.value = '';

      // Show audit trail if expense has status (not new)
      if (expense.status || expense.auth_status) {
        els.singleExpenseAuditContainer.classList.remove('hidden');
      } else {
        els.singleExpenseAuditContainer.classList.add('hidden');
      }

      // Hide audit list initially
      els.auditTrailList.classList.add('hidden');
      els.btnToggleAudit.textContent = 'Show History';

    } else {
      console.log('[EXPENSES] Hiding status selector - canAuthorize:', canAuthorize);
      if (els.singleExpenseStatusContainer) {
        els.singleExpenseStatusContainer.style.display = 'none';
      }
      if (els.singleExpenseAuthContainer) {
        els.singleExpenseAuthContainer.style.display = 'none';
      }
      if (els.singleExpenseAuditContainer) {
        els.singleExpenseAuditContainer.classList.add('hidden');
      }
    }

    // Show modal
    els.singleExpenseModal.classList.remove('hidden');
  }

  function closeSingleExpenseModal() {
    // Revoke blob URL to prevent memory leak
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    els.singleExpenseModal.classList.add('hidden');
    currentEditingExpense = null;
    currentReceiptFile = null;
    currentReceiptUrl = null;
    currentReceiptDeleted = false;
  }

  function populateSingleExpenseDropdowns() {
    // Populate type datalist - uses TnxType_id
    const typeList = document.getElementById('singleExpenseTypeList');
    if (typeList) {
      typeList.innerHTML = '';
      metaData.txn_types.forEach(type => {
        const opt = document.createElement('option');
        const typeId = type.TnxType_id || type.id;
        const typeName = type.TnxType_name || type.name || `Type ${typeId}`;
        opt.value = typeName;
        opt.setAttribute('data-id', typeId);
        typeList.appendChild(opt);
      });
    }

    // Populate vendor datalist - uses id
    const vendorList = document.getElementById('singleExpenseVendorList');
    if (vendorList) {
      vendorList.innerHTML = '';
      metaData.vendors.forEach(vendor => {
        const opt = document.createElement('option');
        const vendorName = vendor.vendor_name || vendor.name || `Vendor ${vendor.id}`;
        opt.value = vendorName;
        opt.setAttribute('data-id', vendor.id);
        vendorList.appendChild(opt);
      });
    }

    // Populate payment datalist - uses id
    const paymentList = document.getElementById('singleExpensePaymentList');
    if (paymentList) {
      paymentList.innerHTML = '';
      metaData.payment_methods.forEach(payment => {
        const opt = document.createElement('option');
        const paymentName = payment.payment_method_name || payment.name || `Payment ${payment.id}`;
        opt.value = paymentName;
        opt.setAttribute('data-id', payment.id);
        paymentList.appendChild(opt);
      });
    }

    // Populate account datalist - uses account_id
    const accountList = document.getElementById('singleExpenseAccountList');
    if (accountList) {
      accountList.innerHTML = '';
      metaData.accounts.forEach(account => {
        const opt = document.createElement('option');
        const accountName = account.Name || account.name || `Account ${account.account_id}`;
        opt.value = accountName;
        opt.setAttribute('data-id', account.account_id);
        accountList.appendChild(opt);
      });
    }
  }

  function renderSingleExpenseReceipt() {
    if (!els.singleExpenseReceiptContainer) return;
    if (!window.ReceiptUpload) {
      console.warn('[EXPENSES] ReceiptUpload module not loaded');
      return;
    }

    els.singleExpenseReceiptContainer.innerHTML = '';

    if (currentReceiptUrl) {
      const preview = window.ReceiptUpload.createPreview(
        currentReceiptUrl,
        handleSingleExpenseReceiptDelete,
        handleSingleExpenseReceiptReplace
      );
      els.singleExpenseReceiptContainer.appendChild(preview);
    } else {
      const uploader = window.ReceiptUpload.createUploader(handleSingleExpenseFileSelected);
      els.singleExpenseReceiptContainer.appendChild(uploader);
    }
  }

  function handleSingleExpenseReceiptReplace() {
    console.log('[EXPENSES] Replace receipt clicked');

    // Create a temporary file input to trigger file selection
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = window.ReceiptUpload.ALLOWED_TYPES.join(',');
    fileInput.style.display = 'none';

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleSingleExpenseFileSelected(file);
      }
    });

    // Trigger file picker
    document.body.appendChild(fileInput);
    fileInput.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(fileInput);
    }, 1000);
  }

  function handleSingleExpenseFileSelected(file) {
    console.log('[EXPENSES] File selected for single expense:', file.name, file.size);

    if (!window.ReceiptUpload.ALLOWED_TYPES.includes(file.type)) {
      if (window.Toast) {
        Toast.error('Invalid File', 'Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
      }
      return;
    }

    if (file.size > window.ReceiptUpload.MAX_FILE_SIZE) {
      if (window.Toast) {
        Toast.error('File Too Large', 'Maximum file size is 5MB.');
      }
      return;
    }

    currentReceiptFile = file;

    // Revoke previous blob URL if exists (prevent memory leak)
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
    }

    // Create and track new blob URL
    const tempUrl = URL.createObjectURL(file);
    currentBlobUrl = tempUrl;
    currentReceiptUrl = tempUrl;
    renderSingleExpenseReceipt();
  }

  function handleSingleExpenseReceiptDelete() {
    // Revoke blob URL to prevent memory leak
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl);
      currentBlobUrl = null;
    }
    currentReceiptFile = null;
    currentReceiptUrl = null;
    currentReceiptDeleted = true; // Mark that user explicitly deleted the receipt
    renderSingleExpenseReceipt();
  }

  async function saveSingleExpense() {
    if (!currentEditingExpense) return;

    const apiBase = getApiBase();
    const expenseId = currentEditingExpense.expense_id || currentEditingExpense.id;

    // Helper function to get ID from datalist input
    function getDatalistValue(input, datalistId) {
      // First check if data-value was set by our input handler
      const storedValue = input.getAttribute('data-value');
      if (storedValue) return storedValue;

      // Fallback: try to find matching option by text value
      const datalist = document.getElementById(datalistId);
      if (datalist) {
        const matchingOption = Array.from(datalist.options).find(opt => opt.value === input.value);
        if (matchingOption) return matchingOption.getAttribute('data-id');
      }
      return null;
    }

    // Collect updated data - read from data-value attributes
    const updatedData = {
      TxnDate: els.singleExpenseDate.value || null,
      bill_id: els.singleExpenseBillId.value || null,
      LineDescription: els.singleExpenseDescription.value || null,
      txn_type: getDatalistValue(els.singleExpenseType, 'singleExpenseTypeList'),
      vendor_id: getDatalistValue(els.singleExpenseVendor, 'singleExpenseVendorList'),
      payment_type: getDatalistValue(els.singleExpensePayment, 'singleExpensePaymentList'),
      account_id: getDatalistValue(els.singleExpenseAccount, 'singleExpenseAccountList'),
      Amount: parseCurrency(els.singleExpenseAmount.value),
      created_by: currentUser.user_id || currentUser.id // Update created_by to current user
    };

    // Get selected status (new status selector)
    let selectedStatus = null;
    let statusReason = null;
    if (canAuthorize && els.expenseStatusSelector) {
      const activeBtn = els.expenseStatusSelector.querySelector('.expense-status-btn.active');
      if (activeBtn) {
        selectedStatus = activeBtn.getAttribute('data-status');
        if (selectedStatus === 'review' && els.singleExpenseReason) {
          statusReason = els.singleExpenseReason.value.trim() || null;
          // Require reason when changing to review
          if (!statusReason) {
            if (window.Toast) {
              Toast.warning('Reason Required', 'Please provide a reason for marking this expense for review.');
            }
            els.btnSaveSingleExpense.disabled = false;
            els.btnSaveSingleExpense.textContent = 'Save Changes';
            return;
          }
        }
      }
    }

    // Backwards compatibility: set auth_status based on selected status
    if (selectedStatus) {
      updatedData.auth_status = (selectedStatus === 'auth');
      updatedData.auth_by = (selectedStatus === 'auth') ? (currentUser.user_id || currentUser.id) : null;
    } else if (canAuthorize && els.singleExpenseAuthStatus) {
      // Fallback to old checkbox if status selector not available
      updatedData.auth_status = els.singleExpenseAuthStatus.checked;
      updatedData.auth_by = els.singleExpenseAuthStatus.checked ? (currentUser.user_id || currentUser.id) : null;
    }

    console.log('[EXPENSES] Saving single expense:', expenseId, updatedData);
    console.log('[EXPENSES] Selected status:', selectedStatus, 'Reason:', statusReason);

    // Validate: Check if trying to add/change to a closed bill
    const newBillId = updatedData.bill_id?.trim() || null;
    const originalBillId = currentEditingExpense.bill_id || null;

    // Only validate if bill_id changed or is being set for the first time
    if (newBillId && newBillId !== originalBillId) {
      const billData = getBillMetadata(newBillId);
      if (billData && billData.status === 'closed') {
        if (window.Toast) {
          Toast.error('Closed Bill', `Cannot assign expense to Bill #${newBillId}. Reopen it in Bill View first.`);
        }
        return;
      }
    }

    // Check for possible duplicate (same vendor + bill + amount, or same vendor + amount + date)
    if (updatedData.vendor_id) {
      // Exclude current expense from the check
      const originalExpenses = expenses;
      const tempExpenses = expenses.filter(exp =>
        (exp.expense_id || exp.id) !== expenseId
      );
      expenses = tempExpenses;

      const conflict = checkBillVendorConflict(
        newBillId,
        updatedData.vendor_id,
        updatedData.Amount,
        updatedData.TxnDate
      );

      expenses = originalExpenses; // Restore

      if (conflict) {
        const vendorName = findMetaName('vendors', updatedData.vendor_id, 'id', 'vendor_name') || 'Unknown';
        const typeLabel = conflict.type === 'strong' ? 'Strong match' : 'Likely duplicate';
        if (window.Toast) {
          Toast.warning(
            'Possible Duplicate Detected',
            `${typeLabel}: ${vendorName} already has an expense for $${conflict.existingAmount?.toFixed(2)}${conflict.billId ? ` (Bill #${conflict.billId})` : ''} on ${conflict.existingDate || 'same date'}. Review before saving.`,
            { duration: 10000 }
          );
        }
        // Warning only, allow saving
      }
    }

    els.btnSaveSingleExpense.disabled = true;
    els.btnSaveSingleExpense.textContent = 'Saving...';

    try {
      const billId = updatedData.bill_id?.trim() || null;
      let receiptUrl = null;

      // Handle receipt upload - store in bills table if bill_id exists
      if (currentReceiptFile && window.ReceiptUpload) {
        try {
          console.log('[EXPENSES] Uploading new receipt');

          // Get old receipt URL to delete after successful upload
          const oldReceiptUrl = currentReceiptUrl;

          // Upload the file
          receiptUrl = await window.ReceiptUpload.upload(
            currentReceiptFile,
            expenseId,
            selectedProjectId,
            billId // Pass bill_id for shared receipt naming
          );

          console.log('[EXPENSES] Receipt uploaded:', receiptUrl);

          // Delete old receipt file from storage if it exists (cleanup)
          if (oldReceiptUrl && window.ReceiptUpload.delete) {
            try {
              await window.ReceiptUpload.delete(oldReceiptUrl);
              console.log('[EXPENSES] Old receipt file deleted from storage');
            } catch (deleteErr) {
              console.warn('[EXPENSES] Could not delete old receipt file:', deleteErr.message);
              // Non-critical error, continue
            }
          }

          // If expense has bill_id, store receipt in bills table
          if (billId) {
            try {
              const existingBill = getBillMetadata(billId);

              if (existingBill) {
                // Update existing bill with new receipt_url
                await apiJson(`${apiBase}/bills/${billId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ receipt_url: receiptUrl })
                });
                // Update local cache
                existingBill.receipt_url = receiptUrl;
                console.log(`[EXPENSES] Updated bill ${billId} with receipt URL`);
              } else {
                // Create new bill record
                const billData = {
                  bill_id: billId,
                  receipt_url: receiptUrl,
                  status: 'open'
                };
                await apiJson(`${apiBase}/bills`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(billData)
                });
                // Add to local cache (using upsert to prevent duplicates)
                upsertBillInCache(billData);
                console.log(`[EXPENSES] Created bill ${billId} with receipt URL`);
              }
              // Don't store receipt_url in expense when using bills table
              console.log(`[EXPENSES] Receipt stored in bills table for bill ${billId}`);
            } catch (billErr) {
              console.warn(`[EXPENSES] Could not update/create bill ${billId}:`, billErr.message);
              // Fallback: store in expense if bills table fails
              updatedData.receipt_url = receiptUrl;
            }
          } else {
            // No bill_id - store receipt_url in expense (legacy behavior)
            updatedData.receipt_url = receiptUrl;
            console.log('[EXPENSES] Receipt stored in expense (no bill_id)');
          }
        } catch (uploadErr) {
          console.error('[EXPENSES] Error uploading receipt:', uploadErr);
          if (window.Toast) {
            Toast.error('Upload Failed', 'Receipt upload failed.', { details: uploadErr.message });
          }
          throw uploadErr;
        }
      } else if (currentReceiptDeleted) {
        // User explicitly deleted the receipt - also delete from storage
        const oldReceiptUrl = currentReceiptUrl;

        // Delete file from Supabase Storage
        if (oldReceiptUrl && window.ReceiptUpload?.delete) {
          try {
            await window.ReceiptUpload.delete(oldReceiptUrl);
            console.log('[EXPENSES] Receipt file deleted from storage');
          } catch (deleteErr) {
            console.warn('[EXPENSES] Could not delete receipt file from storage:', deleteErr.message);
            // Non-critical error, continue with database update
          }
        }

        if (billId) {
          // Remove from bills table
          try {
            const existingBill = getBillMetadata(billId);
            if (existingBill) {
              await apiJson(`${apiBase}/bills/${billId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receipt_url: null })
              });
              existingBill.receipt_url = null;
              console.log(`[EXPENSES] Removed receipt from bill ${billId}`);
            }
          } catch (billErr) {
            console.warn(`[EXPENSES] Could not remove receipt from bill ${billId}:`, billErr.message);
          }
        }
        // Also clear from expense (legacy cleanup)
        updatedData.receipt_url = null;
        console.log('[EXPENSES] Receipt deleted');
      }

      // Update the current expense (without receipt_url if stored in bills)
      await apiJson(`${apiBase}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      // Update status separately if it changed (uses dedicated status endpoint for logging)
      if (selectedStatus) {
        const currentStatus = currentEditingExpense.status || (currentEditingExpense.auth_status ? 'auth' : 'pending');
        if (selectedStatus !== currentStatus) {
          try {
            const userId = currentUser?.user_id || currentUser?.id;
            await apiJson(`${apiBase}/expenses/${expenseId}/status?user_id=${userId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: selectedStatus,
                reason: statusReason
              })
            });
            console.log(`[EXPENSES] Status updated from ${currentStatus} to ${selectedStatus}`);
          } catch (statusErr) {
            console.error('[EXPENSES] Error updating status:', statusErr);
            // Don't fail the whole save if status update fails
            if (window.Toast) {
              Toast.warning('Status Update Failed', 'Expense saved but status could not be updated.');
            }
          }
        }
      }

      // Reload expenses BEFORE closing modal so user doesn't see stale data
      try {
        await loadExpensesByProject(selectedProjectId);
      } catch (reloadErr) {
        console.error('[EXPENSES] Error reloading expenses after save:', reloadErr);
      }

      // Reset button state and close modal AFTER reload completes
      els.btnSaveSingleExpense.disabled = false;
      els.btnSaveSingleExpense.textContent = 'Save Changes';

      if (window.Toast) {
        Toast.success('Expense Updated', 'Expense updated successfully!');
      }
      closeSingleExpenseModal();

      // Update Health Check - expense may now have bill # or receipt
      updateDuplicatesButtonBadge();

      // If Health Check panel is open and we're on Missing Info tab, refresh it
      const panel = document.getElementById('duplicateReviewPanel');
      if (panel && panel.style.display !== 'none' && healthCheckActiveTab === 'missing') {
        detectMissingInfo();
        // If this was the current missing info expense and it's now fixed, advance
        const currentExpId = missingInfoExpenses[currentMissingInfoIndex]?.expense_id ||
                            missingInfoExpenses[currentMissingInfoIndex]?.id;
        if (currentExpId === expenseId) {
          // Check if it's still missing info after reload
          const stillMissing = missingInfoExpenses.find(e =>
            (e.expense_id || e.id) === expenseId
          );
          if (!stillMissing && missingInfoExpenses.length > 0) {
            // Move to next (or stay at adjusted index)
            if (currentMissingInfoIndex >= missingInfoExpenses.length) {
              currentMissingInfoIndex = Math.max(0, missingInfoExpenses.length - 1);
            }
          }
        }
        updateMissingInfoPanel();
        updateHealthCheckSuccessState();
      }

    } catch (err) {
      console.error('[EXPENSES] Error updating expense:', err);
      if (window.Toast) {
        Toast.error('Update Failed', 'Error updating expense.', { details: err.message });
      }
      els.btnSaveSingleExpense.disabled = false;
      els.btnSaveSingleExpense.textContent = 'Save Changes';
    }
  }

  // ================================
  // SCAN RECEIPT FUNCTIONALITY
  // ================================

  function openScanReceiptModal() {
    els.scanReceiptModal.classList.remove('hidden');
    els.scanReceiptProgress.classList.add('hidden');
    els.scanReceiptProgressFill.style.width = '0%';
    // Ensure upload zone is visible
    if (els.scanReceiptUploadZone) {
      els.scanReceiptUploadZone.style.display = '';
    }
  }

  function closeScanReceiptModal() {
    els.scanReceiptModal.classList.add('hidden');
    els.scanReceiptFileInput.value = '';
    // Reset upload zone visibility for next time
    if (els.scanReceiptUploadZone) {
      els.scanReceiptUploadZone.style.display = '';
    }
    els.scanReceiptProgress.classList.add('hidden');
  }

  // ================================
  // PENDING RECEIPTS FUNCTIONALITY
  // ================================

  let pendingReceiptsData = [];
  let currentPendingStatus = 'ready';

  function openPendingReceiptsModal() {
    if (!selectedProjectId) {
      if (window.Toast) Toast.warning('Select Project', 'Please select a project first.');
      return;
    }
    els.pendingReceiptsModal?.classList.remove('hidden');
    // Reset to "ready" tab
    currentPendingStatus = 'ready';
    document.querySelectorAll('.pending-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.status === 'ready');
    });
    loadPendingReceipts('ready');
  }

  function closePendingReceiptsModal() {
    els.pendingReceiptsModal?.classList.add('hidden');
    pendingReceiptsData = [];
  }

  async function loadPendingReceipts(status = 'ready') {
    currentPendingStatus = status;
    const grid = els.pendingReceiptsGrid;
    const empty = els.pendingReceiptsEmpty;

    if (!grid) return;

    // Show loading
    grid.innerHTML = `
      <div class="pending-receipts-loading">
        <div class="pending-loading-spinner"></div>
        <span>Loading receipts...</span>
      </div>
    `;
    empty?.classList.add('hidden');

    const apiBase = getApiBase();
    const authToken = getAuthToken();
    if (!authToken) return;

    try {
      const url = `${apiBase}/pending-receipts/project/${selectedProjectId}?status=${status}`;
      const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!resp.ok) throw new Error('Failed to load pending receipts');

      const result = await resp.json();
      pendingReceiptsData = result.data || [];

      // Update counts in tabs
      if (result.counts) {
        if (els.pendingCountReady) els.pendingCountReady.textContent = result.counts.ready || 0;
        if (els.pendingCountPending) els.pendingCountPending.textContent = result.counts.pending || 0;
        if (els.pendingCountProcessing) els.pendingCountProcessing.textContent = result.counts.processing || 0;
      }

      renderPendingReceipts();

    } catch (err) {
      console.error('[PendingReceipts] Error loading:', err);
      grid.innerHTML = `
        <div class="pending-receipts-loading">
          <span style="color: #f87171;">Error loading receipts</span>
        </div>
      `;
    }
  }

  function renderPendingReceipts() {
    const grid = els.pendingReceiptsGrid;
    const empty = els.pendingReceiptsEmpty;

    if (!grid) return;

    if (pendingReceiptsData.length === 0) {
      grid.innerHTML = '';
      empty?.classList.remove('hidden');
      return;
    }

    empty?.classList.add('hidden');

    grid.innerHTML = pendingReceiptsData.map(receipt => {
      const isPdf = receipt.file_type === 'application/pdf';
      const vendor = receipt.vendor_name || 'Unknown Vendor';
      const amount = receipt.amount ? `$${parseFloat(receipt.amount).toFixed(2)}` : '';
      const date = receipt.receipt_date || '';
      const statusClass = `pending-receipt-status--${receipt.status}`;

      return `
        <div class="pending-receipt-card" data-receipt-id="${receipt.id}">
          <div class="pending-receipt-thumb ${isPdf ? 'pending-receipt-thumb--pdf' : ''}">
            ${isPdf ? `
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            ` : `
              <img src="${receipt.thumbnail_url || receipt.file_url}" alt="${receipt.file_name}" loading="lazy">
            `}
            <span class="pending-receipt-status ${statusClass}">${receipt.status}</span>
          </div>
          <div class="pending-receipt-info">
            <div class="pending-receipt-vendor">${escapeHtml(vendor)}</div>
            ${amount ? `<div class="pending-receipt-amount">${amount}</div>` : ''}
            ${date ? `<div class="pending-receipt-date">${date}</div>` : ''}
            <div class="pending-receipt-filename">${escapeHtml(receipt.file_name || '')}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers to cards
    grid.querySelectorAll('.pending-receipt-card').forEach(card => {
      card.addEventListener('click', () => handlePendingReceiptSelect(card.dataset.receiptId));
    });
  }

  async function handlePendingReceiptSelect(receiptId) {
    const receipt = pendingReceiptsData.find(r => r.id === receiptId);
    if (!receipt) return;

    // If receipt is not processed yet, process it first
    if (receipt.status === 'pending') {
      if (window.Toast) Toast.info('Processing', 'Processing receipt with AI...');

      const apiBase = getApiBase();
      const authToken = getAuthToken();
      if (!authToken) return;

      try {
        const resp = await fetch(`${apiBase}/pending-receipts/${receiptId}/process`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!resp.ok) throw new Error('Failed to process receipt');

        const result = await resp.json();
        if (window.Toast) Toast.success('Processed', 'Receipt data extracted successfully!');

        // Reload to get updated data
        await loadPendingReceipts(currentPendingStatus);
        return;
      } catch (err) {
        console.error('[PendingReceipts] Process error:', err);
        if (window.Toast) Toast.error('Error', 'Failed to process receipt');
        return;
      }
    }

    // For ready receipts, populate the expense form
    closePendingReceiptsModal();

    // Add a new row with the receipt data
    const rowIndex = addModalRow();
    if (rowIndex !== undefined) {
      const row = els.expenseRowsBody?.querySelector(`tr[data-row-index="${rowIndex}"]`);
      if (row) {
        // Fill in the extracted data
        const dateInput = row.querySelector('.exp-input--date');
        const descInput = row.querySelector('.exp-input--desc');
        const amountInput = row.querySelector('.exp-input--amount');
        const vendorInput = row.querySelector('.exp-input--vendor');
        const accountInput = row.querySelector('.exp-input--account');

        if (dateInput && receipt.receipt_date) dateInput.value = receipt.receipt_date;
        if (descInput) descInput.value = receipt.parsed_data?.description || `Receipt: ${receipt.file_name}`;
        if (amountInput && receipt.amount) amountInput.value = receipt.amount;
        if (vendorInput && receipt.vendor_name) vendorInput.value = receipt.vendor_name;
        if (accountInput && receipt.suggested_category) accountInput.value = receipt.suggested_category;

        // Store the receipt ID for linking when saving
        row.dataset.pendingReceiptId = receiptId;

        // Store receipt URL for the row
        row.dataset.receiptUrl = receipt.file_url || '';

        // Update the receipt button to show it has a receipt
        const receiptBtn = row.querySelector('.btn-row-receipt');
        if (receiptBtn) {
          receiptBtn.classList.add('receipt-icon-btn--has-receipt');
          receiptBtn.title = 'Receipt attached from pending';
        }
      }
    }

    if (window.Toast) Toast.success('Added', 'Receipt data added to expense form');
  }

  // Helper function to escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function handleScanReceiptFile(file) {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      if (window.Toast) {
        Toast.error('Invalid File', 'Please upload JPG, PNG, WebP, GIF images or PDF files.');
      }
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      if (window.Toast) {
        Toast.error('File Too Large', 'Maximum file size is 20MB.');
      }
      return;
    }

    const apiBase = getApiBase();

    try {
      // Hide upload zone and show progress
      if (els.scanReceiptUploadZone) {
        els.scanReceiptUploadZone.style.display = 'none';
      }
      els.scanReceiptProgress.classList.remove('hidden');
      els.scanReceiptProgressText.textContent = 'Uploading receipt...';
      els.scanReceiptProgressFill.style.width = '30%';

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Get selected model (fast or heavy)
      const selectedModel = document.querySelector('input[name="scanModel"]:checked')?.value || 'fast';
      formData.append('model', selectedModel);

      // Call backend to parse receipt
      // BACKEND NOTE: The OpenAI prompt should extract and return the following fields for each expense:
      // - date: Transaction date (YYYY-MM-DD format)
      // - bill_id (or invoice_number): The invoice/bill number from the receipt
      // - description: Line item description
      // - amount: Amount in decimal format
      // - vendor: Vendor name
      // - category/transaction_type: Expense category
      els.scanReceiptProgressText.textContent = 'Analyzing...';
      els.scanReceiptProgressFill.style.width = '60%';

      const authToken = getAuthToken();
      if (!authToken) return; // getAuthToken redirects to login if missing

      const response = await fetch(`${apiBase}/expenses/parse-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      // Read response text first to handle both JSON and non-JSON errors
      const responseText = await response.text();

      if (!response.ok) {
        let errorMessage = `Failed to parse receipt (HTTP ${response.status})`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch {
          // Response wasn't JSON, use the text directly if short
          if (responseText && responseText.length < 200) {
            errorMessage = responseText;
          }
        }
        throw new Error(errorMessage);
      }

      // Parse successful response
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('[SCAN RECEIPT] Invalid JSON response:', responseText.substring(0, 500));
        throw new Error('Server returned invalid JSON response');
      }

      // Validate response structure
      if (!result || typeof result !== 'object') {
        console.error('[SCAN RECEIPT] Response is not an object:', result);
        throw new Error('Server returned unexpected response format');
      }

      if (!result.success) {
        throw new Error(result.error || result.message || 'Receipt parsing failed');
      }

      if (!result.data || !result.data.expenses || !Array.isArray(result.data.expenses)) {
        console.error('[SCAN RECEIPT] Missing expenses array in response:', result);
        throw new Error('Server response missing expenses data');
      }
      console.log('[SCAN RECEIPT] ========================================');
      console.log('[SCAN RECEIPT] FULL RESPONSE:');
      console.log('[SCAN RECEIPT] ========================================');
      console.log(JSON.stringify(result, null, 2));
      console.log('[SCAN RECEIPT] ========================================');
      console.log('[SCAN RECEIPT] result.data:', result.data);
      console.log('[SCAN RECEIPT] result.data.expenses:', result.data?.expenses);
      console.log('[SCAN RECEIPT] ========================================');

      els.scanReceiptProgressText.textContent = 'Populating expense rows...';
      els.scanReceiptProgressFill.style.width = '90%';

      // Store the scanned receipt file to attach to all generated expenses
      scannedReceiptFile = file;
      console.log('[SCAN RECEIPT] Stored receipt file for later upload:', file.name);

      // Extract common bill_id from scanned expenses (all items share the same bill_id)
      if (result.success && result.data && result.data.expenses && result.data.expenses.length > 0) {
        const firstExpense = result.data.expenses[0];
        scannedReceiptBillId = firstExpense.bill_id || firstExpense.invoice_number || firstExpense.bill_number || null;
        scannedReceiptVendorId = firstExpense.vendor_id || null;

        // Get invoice total for expected_total in bills table
        if (result.data.validation?.invoice_total) {
          scannedReceiptTotal = result.data.validation.invoice_total;
        } else if (result.data.tax_summary?.grand_total) {
          scannedReceiptTotal = result.data.tax_summary.grand_total;
        } else {
          // Calculate from expenses
          scannedReceiptTotal = result.data.expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        }

        console.log('[SCAN RECEIPT] Extracted bill_id:', scannedReceiptBillId);
        console.log('[SCAN RECEIPT] Extracted vendor_id:', scannedReceiptVendorId);
        console.log('[SCAN RECEIPT] Extracted total:', scannedReceiptTotal);
      }

      // Close scan modal
      closeScanReceiptModal();

      // Populate expense rows with parsed data
      if (result.success && result.data && result.data.expenses) {
        await populateExpensesFromScan(result.data.expenses);
      }

      // Activate scanned receipt mode - blocks adding rows and marks bill as closed on save
      isScannedReceiptMode = true;
      selectedBillStatus = 'closed'; // Default to closed for scanned receipts
      updateScannedReceiptModeUI();
      updateBillStatusSection(); // Show bill status section with 'closed' pre-selected

      els.scanReceiptProgressFill.style.width = '100%';

      // Build success message with validation and tax info
      if (window.Toast) {
        let details = '';

        // Show validation info
        if (result.data?.validation) {
          const v = result.data.validation;
          details += `Validation:\n`;
          details += `Invoice Total: $${v.invoice_total?.toFixed(2) || '0.00'}\n`;
          details += `Calculated Sum: $${v.calculated_sum?.toFixed(2) || '0.00'}\n`;
          details += v.validation_passed ? 'Totals match!' : `WARNING: ${v.validation_warning || 'Totals do not match!'}`;
        }

        // Show tax distribution info if available
        if (result.data?.tax_summary) {
          const tax = result.data.tax_summary;
          details += `\n\nTax Distribution:\n`;
          details += `${tax.tax_label || 'Tax'}: $${tax.total_tax_detected?.toFixed(2) || '0.00'}\n`;
          details += `Subtotal: $${tax.subtotal?.toFixed(2) || '0.00'}\n`;
          details += `Grand Total: $${tax.grand_total?.toFixed(2) || '0.00'}`;
        }

        const validationPassed = result.data?.validation?.validation_passed !== false;
        if (validationPassed) {
          Toast.success('Receipt Scanned', `Successfully scanned ${result.count} expense(s) from receipt!`, { details: details || null, persistent: true });
        } else {
          Toast.warning('Receipt Scanned', `Scanned ${result.count} expense(s) but totals do not match.`, { details, persistent: true });
        }
      }

    } catch (error) {
      console.error('[SCAN RECEIPT] Error:', error);
      if (window.Toast) {
        Toast.error('Scan Failed', 'Error scanning receipt.', { details: error.message });
      }
      // Hide progress and restore upload zone
      els.scanReceiptProgress.classList.add('hidden');
      if (els.scanReceiptUploadZone) {
        els.scanReceiptUploadZone.style.display = '';
      }
    }
  }

  async function populateExpensesFromScan(scannedExpenses) {
    console.log('[POPULATE] ========================================');
    console.log('[POPULATE] START populateExpensesFromScan');
    console.log('[POPULATE] Number of expenses:', scannedExpenses?.length);
    console.log('[POPULATE] Full scannedExpenses array:');
    console.log(JSON.stringify(scannedExpenses, null, 2));
    console.log('[POPULATE] ========================================');

    // Clear existing rows
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;

    // Add a row for each scanned expense
    for (const expense of scannedExpenses) {
      console.log('[POPULATE] ----------------------------------------');
      console.log('[POPULATE] Processing expense:', JSON.stringify(expense, null, 2));
      console.log('[POPULATE] expense.date:', expense.date);
      console.log('[POPULATE] expense.description:', expense.description);
      console.log('[POPULATE] expense.amount:', expense.amount);
      console.log('[POPULATE] expense.vendor:', expense.vendor);
      console.log('[POPULATE] expense.category:', expense.category);
      console.log('[POPULATE] ----------------------------------------');

      addModalRow();

      const index = modalRowCounter - 1;
      const row = els.expenseRowsBody.querySelector(`tr[data-row-index="${index}"]`);

      if (!row) {
        console.warn('[POPULATE] ❌ Row not found for index:', index);
        continue;
      }

      console.log('[POPULATE] ✓ Row found for index:', index);

      // Populate date
      if (expense.date) {
        const dateInput = row.querySelector('[data-field="TxnDate"]');
        console.log('[POPULATE] Looking for date input, found:', !!dateInput);
        if (dateInput) {
          dateInput.value = expense.date;
          console.log('[POPULATE] ✓ Set date:', expense.date);
        } else {
          console.warn('[POPULATE] ❌ Date input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No date in expense data');
      }

      // Populate bill_id (invoice number from receipt)
      const billIdValue = expense.bill_id || expense.invoice_number || expense.bill_number;
      if (billIdValue) {
        const billIdInput = row.querySelector('[data-field="bill_id"]');
        console.log('[POPULATE] Looking for bill_id input, found:', !!billIdInput);
        if (billIdInput) {
          billIdInput.value = billIdValue;
          console.log('[POPULATE] ✓ Set bill_id:', billIdValue);
        } else {
          console.warn('[POPULATE] ❌ bill_id input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No bill_id/invoice_number in expense data');
      }

      // Populate description
      if (expense.description) {
        const descInput = row.querySelector('[data-field="LineDescription"]');
        console.log('[POPULATE] Looking for description input, found:', !!descInput);
        if (descInput) {
          descInput.value = expense.description;
          console.log('[POPULATE] ✓ Set description:', expense.description);
        } else {
          console.warn('[POPULATE] ❌ Description input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No description in expense data');
      }

      // Populate amount (include tax if present)
      if (expense.amount) {
        const amountInput = row.querySelector('[data-field="Amount"]');
        console.log('[POPULATE] Looking for amount input, found:', !!amountInput);
        if (amountInput) {
          // Add tax_included to amount if present
          const taxAmount = expense.tax_included || 0;
          const totalAmount = parseFloat(expense.amount) + parseFloat(taxAmount);
          amountInput.value = totalAmount.toFixed(2);
          console.log('[POPULATE] ✓ Set amount:', expense.amount, '+ tax:', taxAmount, '= total:', totalAmount.toFixed(2));
        } else {
          console.warn('[POPULATE] ❌ Amount input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No amount in expense data');
      }

      // Try to match vendor
      if (expense.vendor && metaData.vendors) {
        console.log('[POPULATE] Trying to match vendor:', expense.vendor);
        console.log('[POPULATE] Available vendors:', metaData.vendors.length);
        const vendorInput = row.querySelector('[data-field="vendor_id"]');
        console.log('[POPULATE] Looking for vendor input, found:', !!vendorInput);
        if (vendorInput) {
          // Try to find matching vendor (case-insensitive)
          const matchedVendor = metaData.vendors.find(v =>
            v.vendor_name && v.vendor_name.toLowerCase().includes(expense.vendor.toLowerCase())
          );

          if (matchedVendor) {
            console.log('[POPULATE] ✓ Matched vendor:', matchedVendor.vendor_name);
            vendorInput.value = matchedVendor.vendor_name;
            vendorInput.setAttribute('data-value', matchedVendor.id);
            // Remove warning class if previously applied
            vendorInput.classList.remove('exp-input--no-match');
          } else {
            console.log('[POPULATE] ⚠ No vendor match, setting text only:', expense.vendor);
            // Just set the text, user can select from dropdown
            vendorInput.value = expense.vendor;
            // Add warning class to highlight this input
            vendorInput.classList.add('exp-input--no-match');
          }
        } else {
          console.warn('[POPULATE] ❌ Vendor input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No vendor in expense data or no vendors in metadata');
      }

      // Try to match category or transaction_type to transaction type
      const searchValue = expense.transaction_type || expense.category;
      if (searchValue && metaData.txn_types) {
        console.log('[POPULATE] Trying to match transaction type/category:', searchValue);
        console.log('[POPULATE] Using field:', expense.transaction_type ? 'transaction_type' : 'category');
        console.log('[POPULATE] Available txn_types:', metaData.txn_types.length);
        const typeInput = row.querySelector('[data-field="txn_type"]');
        console.log('[POPULATE] Looking for type input, found:', !!typeInput);
        if (typeInput) {
          // Try exact match first (case-insensitive)
          let matchedType = metaData.txn_types.find(t =>
            t.TnxType_name && t.TnxType_name.toLowerCase() === searchValue.toLowerCase()
          );

          // If no exact match, try fuzzy match
          if (!matchedType) {
            console.log('[POPULATE] No exact match, trying fuzzy match...');
            matchedType = metaData.txn_types.find(t =>
              t.TnxType_name && (
                t.TnxType_name.toLowerCase().includes(searchValue.toLowerCase()) ||
                searchValue.toLowerCase().includes(t.TnxType_name.toLowerCase())
              )
            );
          }

          if (matchedType) {
            console.log('[POPULATE] ✓ Matched type:', matchedType.TnxType_name);
            typeInput.value = matchedType.TnxType_name;
            typeInput.setAttribute('data-value', matchedType.TnxType_id);
            // Remove warning class if previously applied
            typeInput.classList.remove('exp-input--no-match');
          } else {
            console.log('[POPULATE] ⚠ No type match for:', searchValue);
            // No match found, add warning class
            typeInput.classList.add('exp-input--no-match');
          }
        } else {
          console.warn('[POPULATE] ❌ Type input not found!');
        }
      } else {
        console.log('[POPULATE] ⚠ No transaction_type/category in expense data or no txn_types in metadata');
      }

      // Try to match payment_method
      const paymentValue = expense.payment_method;
      const paymentInput = row.querySelector('[data-field="payment_type"]');
      console.log('[POPULATE] Looking for payment input, found:', !!paymentInput);

      if (paymentInput && metaData.payment_methods) {
        console.log('[POPULATE] Trying to match payment method:', paymentValue);
        console.log('[POPULATE] Available payment_methods:', metaData.payment_methods.length);

        let matchedPayment = null;

        if (paymentValue && paymentValue.toLowerCase() !== 'unknown') {
          // Try exact match first (case-insensitive)
          matchedPayment = metaData.payment_methods.find(p =>
            p.payment_method_name && p.payment_method_name.toLowerCase() === paymentValue.toLowerCase()
          );

          // If no exact match, try fuzzy match
          if (!matchedPayment) {
            console.log('[POPULATE] No exact payment match, trying fuzzy match...');
            matchedPayment = metaData.payment_methods.find(p =>
              p.payment_method_name && (
                p.payment_method_name.toLowerCase().includes(paymentValue.toLowerCase()) ||
                paymentValue.toLowerCase().includes(p.payment_method_name.toLowerCase())
              )
            );
          }
        }

        if (matchedPayment) {
          console.log('[POPULATE] ✓ Matched payment method:', matchedPayment.payment_method_name);
          paymentInput.value = matchedPayment.payment_method_name;
          paymentInput.setAttribute('data-value', matchedPayment.id);
          paymentInput.classList.remove('exp-input--no-match');
        } else {
          // No match found - try to find "Unknown" payment method or first available
          const unknownPayment = metaData.payment_methods.find(p =>
            p.payment_method_name && p.payment_method_name.toLowerCase() === 'unknown'
          );

          if (unknownPayment) {
            console.log('[POPULATE] ⚠ No payment match, using Unknown:', unknownPayment.payment_method_name);
            paymentInput.value = unknownPayment.payment_method_name;
            paymentInput.setAttribute('data-value', unknownPayment.id);
            paymentInput.classList.add('exp-input--no-match');
          } else if (metaData.payment_methods.length > 0) {
            // If no "Unknown" exists, use the first payment method as default
            const defaultPayment = metaData.payment_methods[0];
            console.log('[POPULATE] ⚠ No Unknown payment method, using first available:', defaultPayment.payment_method_name);
            paymentInput.value = defaultPayment.payment_method_name;
            paymentInput.setAttribute('data-value', defaultPayment.id);
            paymentInput.classList.add('exp-input--no-match');
          } else {
            console.log('[POPULATE] ⚠ No payment methods available in metadata');
            paymentInput.classList.add('exp-input--no-match');
          }
        }
      } else {
        console.log('[POPULATE] ⚠ No payment input found or no payment_methods in metadata');
      }
    }
  }

  // ================================
  // CSV IMPORT
  // ================================

  /**
   * Parses a CSV line respecting quoted fields that may contain commas
   * @param {string} line - CSV line to parse
   * @param {number} rowNum - Row number for error reporting (1-indexed)
   * @returns {{ cells: string[], error: string|null }} - Array of cell values or error
   */
  function parseCSVLine(line, rowNum = 0) {
    const cells = [];
    let currentCell = '';
    let insideQuotes = false;
    let cellIndex = 0;

    try {
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
          // Handle escaped quotes ("")
          if (insideQuotes && nextChar === '"') {
            currentCell += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          // End of cell
          cells.push(currentCell.trim());
          currentCell = '';
          cellIndex++;
        } else {
          // Regular character
          currentCell += char;
        }
      }

      // Add last cell
      cells.push(currentCell.trim());

      // Check for unclosed quotes
      if (insideQuotes) {
        return {
          cells: null,
          error: `Row ${rowNum}: Unclosed quote in column ${cellIndex + 1}`
        };
      }

      return { cells, error: null };
    } catch (err) {
      return {
        cells: null,
        error: `Row ${rowNum}: Parse error - ${err.message}`
      };
    }
  }

  async function handleCSVImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[CSV_IMPORT] Selected file:', file.name);

    try {
      const text = await file.text();

      // Parse CSV into headers and rows
      const lines = text.trim().split('\n');
      if (lines.length < 2) {
        if (window.Toast) {
          Toast.error('Invalid CSV', 'CSV file must contain at least a header row and one data row.');
        }
        return;
      }

      // Parse headers using proper CSV parsing (row 1)
      const headerResult = parseCSVLine(lines[0], 1);
      if (headerResult.error) {
        if (window.Toast) {
          Toast.error('CSV Parse Error', 'Please fix the header row and try again.', { details: headerResult.error });
        }
        return;
      }
      csvParsedData.headers = headerResult.cells;

      // Parse data rows using proper CSV parsing
      csvParsedData.rows = [];
      const parseErrors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const rowNum = i + 1; // 1-indexed for user display
        const result = parseCSVLine(line, rowNum);

        if (result.error) {
          parseErrors.push(result.error);
          // Continue parsing other rows to collect all errors
        } else {
          // Validate column count matches headers
          if (result.cells.length !== csvParsedData.headers.length) {
            parseErrors.push(`Row ${rowNum}: Expected ${csvParsedData.headers.length} columns, found ${result.cells.length}`);
          } else {
            csvParsedData.rows.push(result.cells);
          }
        }
      }

      // Report parsing errors if any
      if (parseErrors.length > 0) {
        const maxErrorsToShow = 10;
        const errorDetails = parseErrors.slice(0, maxErrorsToShow).join('\n') +
          (parseErrors.length > maxErrorsToShow ? `\n\n... and ${parseErrors.length - maxErrorsToShow} more errors` : '');
        if (window.Toast) {
          Toast.error('CSV Parse Errors', 'Please fix these issues and try again.', { details: errorDetails });
        }
        return;
      }

      if (csvParsedData.rows.length === 0) {
        if (window.Toast) {
          Toast.error('No Data', 'No valid data rows found in CSV file.');
        }
        return;
      }

      console.log('[CSV_IMPORT] Parsed:', csvParsedData.headers.length, 'columns,', csvParsedData.rows.length, 'rows');
      console.log('[CSV_IMPORT] Sample row:', csvParsedData.rows[0]);

      // Open mapping modal
      openCsvMappingModal();

    } catch (err) {
      console.error('[CSV_IMPORT] Error:', err);
      if (window.Toast) {
        Toast.error('CSV Read Error', 'Error reading CSV file.', { details: err.message });
      }
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }

  function openCsvMappingModal() {
    // Auto-detect column mappings using flexible matching
    csvColumnMapping = {};
    const expenseFields = ['date', 'description', 'type', 'vendor', 'payment', 'account', 'amount'];

    csvParsedData.headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();

      // Try to auto-match
      if (headerLower.includes('date')) {
        csvColumnMapping[index] = 'date';
      } else if (headerLower.includes('description') || headerLower.includes('desc')) {
        csvColumnMapping[index] = 'description';
      } else if (headerLower.includes('type')) {
        csvColumnMapping[index] = 'type';
      } else if (headerLower.includes('vendor')) {
        csvColumnMapping[index] = 'vendor';
      } else if (headerLower.includes('payment')) {
        csvColumnMapping[index] = 'payment';
      } else if (headerLower.includes('account')) {
        csvColumnMapping[index] = 'account';
      } else if (headerLower.includes('amount')) {
        csvColumnMapping[index] = 'amount';
      } else {
        csvColumnMapping[index] = ''; // Unmapped by default
      }
    });

    console.log('[CSV_MAPPING] Auto-detected mappings:', csvColumnMapping);

    // Render mapping UI
    renderCsvMappingRows();

    // Show modal
    els.csvMappingModal?.classList.remove('hidden');
  }

  function renderCsvMappingRows() {
    if (!els.csvMappingContainer) return;

    const expenseFields = [
      { value: '', label: '(Skip this column)' },
      { value: 'date', label: 'Date' },
      { value: 'description', label: 'Description' },
      { value: 'type', label: 'Type' },
      { value: 'vendor', label: 'Vendor' },
      { value: 'payment', label: 'Payment Method' },
      { value: 'account', label: 'Account' },
      { value: 'amount', label: 'Amount' }
    ];

    const rows = csvParsedData.headers.map((header, index) => {
      const currentMapping = csvColumnMapping[index] || '';

      const optionsHTML = expenseFields.map(field => {
        const selected = field.value === currentMapping ? 'selected' : '';
        return `<option value="${field.value}" ${selected}>${field.label}</option>`;
      }).join('');

      return `
        <div class="csv-mapping-row">
          <div class="csv-column-name" title="${header}">${header}</div>
          <div class="csv-mapping-arrow">→</div>
          <select class="ngm-select csv-field-select" data-csv-index="${index}">
            ${optionsHTML}
          </select>
        </div>
      `;
    }).join('');

    els.csvMappingContainer.innerHTML = rows;

    // Add change listeners to update mapping
    document.querySelectorAll('.csv-field-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.csvIndex);
        csvColumnMapping[index] = e.target.value;
        console.log('[CSV_MAPPING] Updated mapping:', csvColumnMapping);
      });
    });
  }

  function closeCsvMappingModal() {
    els.csvMappingModal?.classList.add('hidden');

    // Reset state
    csvParsedData = {
      headers: [],
      rows: []
    };
    csvColumnMapping = {};
  }

  async function confirmCSVMapping() {
    try {
      console.log('[CSV_MAPPING] Importing', csvParsedData.rows.length, 'rows');

      // Step 1: Extract unique vendors and payment types from CSV
      const vendorColumnIndex = Object.keys(csvColumnMapping).find(
        idx => csvColumnMapping[idx] === 'vendor'
      );
      const paymentColumnIndex = Object.keys(csvColumnMapping).find(
        idx => csvColumnMapping[idx] === 'payment'
      );

      let newVendorsCreated = 0;
      let newPaymentMethodsCreated = 0;

      if (vendorColumnIndex !== undefined) {
        // Collect unique vendor names from CSV (normalized and cleaned)
        const csvVendorNames = new Set();
        csvParsedData.rows.forEach(row => {
          let vendorName = row[vendorColumnIndex]?.trim();
          if (vendorName) {
            // Remove surrounding quotes
            vendorName = vendorName.replace(/^["']+|["']+$/g, '');
            if (vendorName) { // Check again after removing quotes
              csvVendorNames.add(vendorName);
            }
          }
        });

        console.log('[CSV_MAPPING] Found', csvVendorNames.size, 'unique vendors in CSV');

        // Check which vendors don't exist in metaData.vendors (case-insensitive + normalized)
        const existingVendorNames = new Set(
          metaData.vendors.map(v => v.vendor_name.toLowerCase().trim())
        );

        const newVendors = Array.from(csvVendorNames).filter(
          name => !existingVendorNames.has(name.toLowerCase().trim())
        );

        // Create new vendors via API
        if (newVendors.length > 0) {
          console.log('[CSV_MAPPING] Attempting to create', newVendors.length, 'new vendors:', newVendors);

          const apiBase = getApiBase();

          for (const vendorName of newVendors) {
            try {
              const response = await apiJson(`${apiBase}/vendors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vendor_name: vendorName })
              });

              console.log('[CSV_MAPPING] ✓ Created vendor:', vendorName);

              // Add to local metaData
              const newVendor = {
                id: response.id || response.vendor_id || response.data?.id,
                vendor_name: vendorName
              };
              metaData.vendors.push(newVendor);
              newVendorsCreated++;

            } catch (err) {
              // If vendor already exists (race condition or sync issue), try to fetch it
              if (err.message && err.message.includes('already exists')) {
                console.log('[CSV_MAPPING] ⚠ Vendor already exists (skipping):', vendorName);

                // Try to find it in backend and add to local metaData if not present
                try {
                  const allVendorsResponse = await apiJson(`${apiBase}/vendors`);
                  const allVendors = Array.isArray(allVendorsResponse) ? allVendorsResponse : (allVendorsResponse?.data || []);

                  const existingVendor = allVendors.find(v =>
                    v.vendor_name.toLowerCase().trim() === vendorName.toLowerCase().trim()
                  );

                  if (existingVendor && !metaData.vendors.find(v => v.id === existingVendor.id)) {
                    metaData.vendors.push({
                      id: existingVendor.id,
                      vendor_name: existingVendor.vendor_name
                    });
                    console.log('[CSV_MAPPING] ✓ Added existing vendor to local cache:', vendorName);
                  }
                } catch (fetchErr) {
                  console.warn('[CSV_MAPPING] Could not fetch existing vendor:', vendorName);
                }
              } else {
                console.error('[CSV_MAPPING] ✗ Failed to create vendor:', vendorName, err.message);
              }
            }
          }

          if (newVendorsCreated > 0) {
            console.log('[CSV_MAPPING] Successfully created', newVendorsCreated, 'new vendors');
          }
        }
      }

      // Step 1b: Extract and create payment methods
      if (paymentColumnIndex !== undefined) {
        // Collect unique payment method names from CSV (normalized and cleaned)
        const csvPaymentNames = new Set();
        csvParsedData.rows.forEach(row => {
          let paymentName = row[paymentColumnIndex]?.trim();
          if (paymentName) {
            // Remove surrounding quotes
            paymentName = paymentName.replace(/^["']+|["']+$/g, '');
            if (paymentName) { // Check again after removing quotes
              csvPaymentNames.add(paymentName);
            }
          }
        });

        console.log('[CSV_MAPPING] Found', csvPaymentNames.size, 'unique payment methods in CSV');

        // Check which payment methods don't exist in metaData.payment_methods (case-insensitive + normalized)
        const existingPaymentNames = new Set(
          metaData.payment_methods.map(p => p.payment_method_name.toLowerCase().trim())
        );

        const newPayments = Array.from(csvPaymentNames).filter(
          name => !existingPaymentNames.has(name.toLowerCase().trim())
        );

        // Create new payment methods via API (note: table is 'paymet_methods' with typo)
        if (newPayments.length > 0) {
          console.log('[CSV_MAPPING] Attempting to create', newPayments.length, 'new payment methods:', newPayments);

          const apiBase = getApiBase();

          for (const paymentName of newPayments) {
            try {
              const response = await apiJson(`${apiBase}/payment-methods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_method_name: paymentName })
              });

              console.log('[CSV_MAPPING] ✓ Created payment method:', paymentName);

              // Add to local metaData
              const newPayment = {
                id: response.id || response.payment_method_id || response.data?.id,
                payment_method_name: paymentName
              };
              metaData.payment_methods.push(newPayment);
              newPaymentMethodsCreated++;

            } catch (err) {
              // If payment method already exists (race condition or sync issue), try to fetch it
              if (err.message && err.message.includes('already exists')) {
                console.log('[CSV_MAPPING] ⚠ Payment method already exists (skipping):', paymentName);

                // Try to find it in backend and add to local metaData if not present
                try {
                  const allPaymentsResponse = await apiJson(`${apiBase}/payment-methods`);
                  const allPayments = Array.isArray(allPaymentsResponse) ? allPaymentsResponse : (allPaymentsResponse?.data || []);

                  const existingPayment = allPayments.find(p =>
                    p.payment_method_name.toLowerCase().trim() === paymentName.toLowerCase().trim()
                  );

                  if (existingPayment && !metaData.payment_methods.find(p => p.id === existingPayment.id)) {
                    metaData.payment_methods.push({
                      id: existingPayment.id,
                      payment_method_name: existingPayment.payment_method_name
                    });
                    console.log('[CSV_MAPPING] ✓ Added existing payment method to local cache:', paymentName);
                  }
                } catch (fetchErr) {
                  console.warn('[CSV_MAPPING] Could not fetch existing payment method:', paymentName);
                }
              } else {
                console.error('[CSV_MAPPING] ✗ Failed to create payment method:', paymentName, err.message);
              }
            }
          }

          if (newPaymentMethodsCreated > 0) {
            console.log('[CSV_MAPPING] Successfully created', newPaymentMethodsCreated, 'new payment methods');
          }
        }
      }

      // Step 2: Clear existing rows and populate from CSV
      els.expenseRowsBody.innerHTML = '';
      modalRowCounter = 0;

      // Add a row for each CSV data row
      for (const dataRow of csvParsedData.rows) {
        addModalRow();

        const index = modalRowCounter - 1;
        const row = els.expenseRowsBody.querySelector(`tr[data-row-index="${index}"]`);

        if (!row) {
          console.warn('[CSV_MAPPING] Row not found for index:', index);
          continue;
        }

        // Map each column based on user selection
        csvParsedData.headers.forEach((header, colIndex) => {
          const field = csvColumnMapping[colIndex];
          const value = dataRow[colIndex] || '';

          if (!field) return; // Skip unmapped columns

          if (field === 'date') {
            const dateInput = row.querySelector('[data-field="TxnDate"]');
            if (dateInput && value) {
              // Try to parse and format the date to YYYY-MM-DD
              let formattedDate = value.trim();

              try {
                const parsedDate = new Date(value);
                if (!isNaN(parsedDate.getTime())) {
                  // Valid date - format as YYYY-MM-DD
                  const year = parsedDate.getFullYear();
                  const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
                  const day = String(parsedDate.getDate()).padStart(2, '0');
                  formattedDate = `${year}-${month}-${day}`;
                }
              } catch (err) {
                console.warn('[CSV_MAPPING] Could not parse date:', value);
              }

              dateInput.value = formattedDate;
            }
          } else if (field === 'description') {
            const descInput = row.querySelector('[data-field="LineDescription"]');
            if (descInput) {
              // Trim and remove surrounding quotes
              let cleanedValue = value.toString().trim();
              cleanedValue = cleanedValue.replace(/^["']+|["']+$/g, ''); // Remove quotes from start/end
              descInput.value = cleanedValue;
            }
          } else if (field === 'type') {
            const typeSelect = row.querySelector('[data-field="txn_type"]');
            if (typeSelect && value) {
              // Clean transaction type name - remove quotes
              let cleanedTypeName = value.toString().trim();
              cleanedTypeName = cleanedTypeName.replace(/^["']+|["']+$/g, ''); // Remove quotes from start/end

              // Find transaction type by name (case-insensitive)
              const txnType = metaData.txn_types.find(
                t => t.TnxType_name && t.TnxType_name.toLowerCase() === cleanedTypeName.toLowerCase()
              );

              if (txnType) {
                // Set the display name (not ID) for visual display
                // The datalist input uses the text value, and the ID is stored in data-value-id
                typeSelect.value = txnType.TnxType_name;
                // Remove warning class if it was previously applied
                typeSelect.classList.remove('exp-input--no-match');
              } else {
                console.warn('[CSV_MAPPING] Transaction type not found:', cleanedTypeName);
                console.warn('[CSV_MAPPING] Available types:', metaData.txn_types.map(t => t.TnxType_name));
                // Set the cleaned name even if not found
                typeSelect.value = cleanedTypeName;
                // Add warning class to highlight this input
                typeSelect.classList.add('exp-input--no-match');
              }
            }
          } else if (field === 'vendor') {
            const vendorInput = row.querySelector('[data-field="vendor_id"]');
            if (vendorInput && value) {
              // Clean vendor name - remove quotes
              let cleanedVendorName = value.toString().trim();
              cleanedVendorName = cleanedVendorName.replace(/^["']+|["']+$/g, ''); // Remove quotes from start/end

              // Find vendor ID by name
              const vendor = metaData.vendors.find(
                v => v.vendor_name.toLowerCase() === cleanedVendorName.toLowerCase()
              );

              if (vendor) {
                vendorInput.value = vendor.vendor_name;
                vendorInput.setAttribute('data-field-value', vendor.id);
                // Remove warning class if it was previously applied
                vendorInput.classList.remove('exp-input--no-match');
              } else {
                // Fallback: set the cleaned name
                vendorInput.value = cleanedVendorName;
                // Add warning class to highlight this input
                vendorInput.classList.add('exp-input--no-match');
              }
            }
          } else if (field === 'payment') {
            const paymentSelect = row.querySelector('[data-field="payment_type"]');
            if (paymentSelect && value) {
              // Clean payment method name - remove quotes
              let cleanedPaymentName = value.toString().trim();
              cleanedPaymentName = cleanedPaymentName.replace(/^["']+|["']+$/g, ''); // Remove quotes from start/end

              // Find payment method ID by name (case-insensitive)
              const paymentMethod = metaData.payment_methods.find(
                p => p.payment_method_name.toLowerCase() === cleanedPaymentName.toLowerCase()
              );

              if (paymentMethod) {
                // Set the display name (not ID) for visual display
                paymentSelect.value = paymentMethod.payment_method_name;
                // Remove warning class if it was previously applied
                paymentSelect.classList.remove('exp-input--no-match');
              } else {
                console.warn('[CSV_MAPPING] Payment method not found:', cleanedPaymentName);
                // Set the cleaned name even if not found
                paymentSelect.value = cleanedPaymentName;
                // Add warning class to highlight this input
                paymentSelect.classList.add('exp-input--no-match');
              }
            }
          } else if (field === 'account') {
            const accountSelect = row.querySelector('[data-field="account_id"]');
            if (accountSelect && value) {
              // Clean account name - remove quotes
              let cleanedAccountName = value.toString().trim();
              cleanedAccountName = cleanedAccountName.replace(/^["']+|["']+$/g, ''); // Remove quotes from start/end

              // Find account ID by name (case-insensitive)
              const account = metaData.accounts.find(
                a => a.Name.toLowerCase() === cleanedAccountName.toLowerCase()
              );

              if (account) {
                // Set the display name (not ID) for visual display
                accountSelect.value = account.Name;
                // Remove warning class if it was previously applied
                accountSelect.classList.remove('exp-input--no-match');
              } else {
                console.warn('[CSV_MAPPING] Account not found:', cleanedAccountName);
                // Set the cleaned name even if not found
                accountSelect.value = cleanedAccountName;
                // Add warning class to highlight this input
                accountSelect.classList.add('exp-input--no-match');
              }
            }
          } else if (field === 'amount') {
            const amountInput = row.querySelector('[data-field="Amount"]');
            if (amountInput && value) {
              // Clean amount: remove $, commas, spaces, and keep only numbers and decimal point
              const originalValue = value.toString().trim();
              let cleanedAmount = originalValue;
              cleanedAmount = cleanedAmount.replace(/[$,\s]/g, ''); // Remove $, commas, spaces
              cleanedAmount = cleanedAmount.replace(/[^\d.-]/g, ''); // Keep only digits, dot, and minus

              // Validate it's a valid number
              const numValue = parseFloat(cleanedAmount);
              if (!isNaN(numValue)) {
                amountInput.value = numValue.toFixed(2);

                // Log if the value was modified
                if (originalValue !== numValue.toFixed(2)) {
                  console.log('[CSV_MAPPING] Cleaned amount:', originalValue, '->', numValue.toFixed(2));
                }
              } else {
                console.warn('[CSV_MAPPING] Invalid amount value:', originalValue, '-> setting to 0.00');
                amountInput.value = '0.00';
              }
            }
          }
        });
      }

      console.log('[CSV_MAPPING] Successfully populated', modalRowCounter, 'rows');

      // Close mapping modal
      closeCsvMappingModal();

      // Show success message
      if (window.Toast) {
        let details = '';
        if (newVendorsCreated > 0) {
          details += `${newVendorsCreated} new vendor(s) created.\n`;
        }
        if (newPaymentMethodsCreated > 0) {
          details += `${newPaymentMethodsCreated} new payment method(s) created.`;
        }
        Toast.success('CSV Imported', `Successfully imported ${csvParsedData.rows.length} expense(s) from CSV.`, { details: details || null });
      }

    } catch (err) {
      console.error('[CSV_MAPPING] Error importing:', err);
      if (window.Toast) {
        Toast.error('Import Failed', 'Error importing CSV data.', { details: err.message });
      }
    }
  }


  // ================================
  // EVENT HANDLERS
  // ================================
  function setupEventListeners() {
    // Project filter change
    els.projectFilter?.addEventListener('change', async (e) => {
      selectedProjectId = e.target.value || null;

      // Enable/disable toolbar buttons
      // Add Expense disabled for "all" projects view (must select specific project)
      const isAllProjects = selectedProjectId === 'all';
      els.btnAddExpense.disabled = !selectedProjectId || isAllProjects;

      // Reset health check state when changing projects
      duplicateClusters = [];
      duplicateBillWarnings.clear();
      missingInfoExpenses = [];
      currentClusterIndex = 0;
      currentMissingInfoIndex = 0;

      // Load expenses for selected project
      await loadExpensesByProject(selectedProjectId);

      // Enable edit button and bill view if we have expenses
      // Edit mode disabled for "all" projects view
      els.btnEditExpenses.disabled = !selectedProjectId || expenses.length === 0 || isAllProjects;
      els.btnBillView.disabled = !selectedProjectId || expenses.length === 0;
      els.btnDetectDuplicates.disabled = !selectedProjectId || expenses.length < 2; // Need at least 2 expenses

      // Update health check badge (resets to no issues for new project)
      updateDuplicatesButtonBadge();
    });

    // Global search input - DEBOUNCED for performance
    els.searchInput?.addEventListener('input', (e) => {
      const searchValue = e.target.value.trim();

      // Clear existing debounce timer
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }

      // Debounce the search to avoid excessive re-renders
      searchDebounceTimer = setTimeout(() => {
        globalSearchTerm = searchValue;
        console.log('[EXPENSES] Global search (debounced):', globalSearchTerm);
        renderExpensesTable();
      }, SEARCH_DEBOUNCE_MS);
    });

    // Add Expense button
    els.btnAddExpense?.addEventListener('click', () => {
      openAddExpenseModal();
    });

    // Edit Expenses button
    els.btnEditExpenses?.addEventListener('click', () => {
      if (!isEditMode && expenses.length > 0) {
        toggleEditMode(true);
      }
    });

    // Cancel edit button
    els.btnCancelEdit?.addEventListener('click', () => {
      cancelEditMode();
    });

    // Save changes button
    els.btnSaveChanges?.addEventListener('click', () => {
      saveEditChanges();
    });

    // Delete row in edit mode
    els.expensesTableBody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-row-delete')) {
        const expenseId = e.target.dataset.id;
        deleteExpense(expenseId);
      }
    });

    // Bulk delete button
    els.btnBulkDelete?.addEventListener('click', bulkDeleteExpenses);

    // Bulk authorize button
    els.btnBulkAuthorize?.addEventListener('click', bulkAuthorizeExpenses);

    // Select all checkbox
    els.selectAllCheckbox?.addEventListener('change', toggleSelectAll);

    // Individual row checkboxes (event delegation)
    els.expensesTableBody?.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-checkbox')) {
        const expenseId = e.target.dataset.id;
        if (e.target.checked) {
          selectedExpenseIds.add(expenseId);
        } else {
          selectedExpenseIds.delete(expenseId);
          els.selectAllCheckbox.checked = false;
        }
        updateBulkDeleteButton();
        updateBulkAuthorizeButton();
      }
    });

    // Authorization badge clicks (event delegation)
    els.expensesTableBody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('auth-badge')) {
        e.stopPropagation(); // Don't trigger row click
        const canAuth = e.target.getAttribute('data-can-authorize') === 'true';
        if (canAuth) {
          toggleAuth(e.target);
        }
      }
    });

    // Modal: Close button
    els.btnCloseExpenseModal?.addEventListener('click', closeAddExpenseModal);

    // Modal: Cancel button
    els.btnCancelExpenses?.addEventListener('click', closeAddExpenseModal);

    // Modal: Add row button
    els.btnAddExpenseRow?.addEventListener('click', addModalRow);

    // Modal: Scan Receipt button
    els.btnScanReceipt?.addEventListener('click', openScanReceiptModal);

    // Scan Receipt Modal: Close buttons
    els.btnCloseScanReceipt?.addEventListener('click', closeScanReceiptModal);
    els.btnCancelScanReceipt?.addEventListener('click', closeScanReceiptModal);

    // Scan Receipt Modal: File input
    els.scanReceiptFileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleScanReceiptFile(file);
    });

    // Scan Receipt Modal: Drop area click
    els.scanReceiptDropArea?.addEventListener('click', () => {
      els.scanReceiptFileInput.click();
    });

    // Scan Receipt Modal: Drag and drop
    els.scanReceiptDropArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.scanReceiptDropArea.classList.add('drag-over');
    });

    els.scanReceiptDropArea?.addEventListener('dragleave', () => {
      els.scanReceiptDropArea.classList.remove('drag-over');
    });

    els.scanReceiptDropArea?.addEventListener('drop', (e) => {
      e.preventDefault();
      els.scanReceiptDropArea.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleScanReceiptFile(file);
    });

    // Pending Receipts Modal: Open button
    els.btnPendingReceipts?.addEventListener('click', openPendingReceiptsModal);

    // Pending Receipts Modal: Close buttons
    els.btnClosePendingReceipts?.addEventListener('click', closePendingReceiptsModal);
    els.btnCancelPendingReceipts?.addEventListener('click', closePendingReceiptsModal);

    // Pending Receipts Modal: Tab clicks
    document.querySelectorAll('.pending-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const status = tab.dataset.status;
        document.querySelectorAll('.pending-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadPendingReceipts(status);
      });
    });

    // Modal: Remove row button
    els.expenseRowsBody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('exp-row-remove')) {
        const rowIndex = parseInt(e.target.dataset.rowIndex, 10);
        removeModalRow(rowIndex);
      }
    });

    // Modal: Save all button
    els.btnSaveAllExpenses?.addEventListener('click', saveAllExpenses);

    // Modal: Close on backdrop click
    els.modal?.addEventListener('click', (e) => {
      if (e.target === els.modal) {
        closeAddExpenseModal();
      }
    });

    // Single expense modal: Close button
    els.btnCloseSingleExpenseModal?.addEventListener('click', closeSingleExpenseModal);

    // Single expense modal: Cancel button
    els.btnCancelSingleExpense?.addEventListener('click', closeSingleExpenseModal);

    // Single expense modal: Save button
    els.btnSaveSingleExpense?.addEventListener('click', saveSingleExpense);

    // Single expense modal: Close on backdrop click
    els.singleExpenseModal?.addEventListener('click', (e) => {
      if (e.target === els.singleExpenseModal) {
        closeSingleExpenseModal();
      }
    });

    // Status selector: Click handlers for status buttons
    els.expenseStatusSelector?.addEventListener('click', (e) => {
      const btn = e.target.closest('.expense-status-btn');
      if (!btn) return;

      const newStatus = btn.getAttribute('data-status');
      const currentActive = els.expenseStatusSelector.querySelector('.expense-status-btn.active');
      const oldStatus = currentActive ? currentActive.getAttribute('data-status') : 'pending';

      // Update active state
      els.expenseStatusSelector.querySelectorAll('.expense-status-btn').forEach(b => {
        b.classList.remove('active');
      });
      btn.classList.add('active');

      // Show reason field if changing to review status
      if (newStatus === 'review' && oldStatus !== 'review') {
        els.singleExpenseReasonContainer.classList.remove('hidden');
        els.singleExpenseReason.focus();
      } else if (newStatus !== 'review') {
        els.singleExpenseReasonContainer.classList.add('hidden');
        els.singleExpenseReason.value = '';
      }
    });

    // Audit trail: Toggle history button
    els.btnToggleAudit?.addEventListener('click', async () => {
      const isHidden = els.auditTrailList.classList.contains('hidden');

      if (isHidden) {
        // Load and show audit trail
        els.auditTrailList.classList.remove('hidden');
        els.btnToggleAudit.textContent = 'Hide History';
        await loadAuditTrail(currentEditingExpense.expense_id || currentEditingExpense.id);
      } else {
        // Hide audit trail
        els.auditTrailList.classList.add('hidden');
        els.btnToggleAudit.textContent = 'Show History';
      }
    });

    // Table row click to open single expense modal (only in read-only mode)
    els.expensesTableBody?.addEventListener('click', (e) => {
      console.log('[EXPENSES] Table click:', { isEditMode, target: e.target, closest: e.target.closest('.expense-row-clickable') });
      if (!isEditMode && e.target.closest('.expense-row-clickable')) {
        const row = e.target.closest('tr');
        const expenseId = row.dataset.id;
        console.log('[EXPENSES] Row clicked, expenseId:', expenseId);
        if (expenseId) {
          openSingleExpenseModal(expenseId);
        } else {
          console.warn('[EXPENSES] No expenseId found in row dataset');
        }
      }
    });

    // Single expense modal: Update data-value when datalist input changes
    const singleExpenseInputs = [
      { input: els.singleExpenseType, listId: 'singleExpenseTypeList' },
      { input: els.singleExpenseVendor, listId: 'singleExpenseVendorList' },
      { input: els.singleExpensePayment, listId: 'singleExpensePaymentList' },
      { input: els.singleExpenseAccount, listId: 'singleExpenseAccountList' }
    ];

    singleExpenseInputs.forEach(({ input, listId }) => {
      input?.addEventListener('input', (e) => {
        const datalist = document.getElementById(listId);
        if (!datalist) return;

        const matchingOption = Array.from(datalist.options).find(opt => opt.value === e.target.value);
        if (matchingOption) {
          e.target.setAttribute('data-value', matchingOption.getAttribute('data-id'));
          console.log(`[SINGLE MODAL] Updated to:`, matchingOption.getAttribute('data-id'));
        } else {
          e.target.setAttribute('data-value', '');
        }
      });
    });

    // Format currency on blur for single expense modal
    els.singleExpenseAmount?.addEventListener('blur', (e) => {
      const value = parseCurrency(e.target.value);
      if (value !== null) {
        e.target.value = formatCurrency(value);
      }
    });

    // Allow typing in currency field - remove formatting on focus
    els.singleExpenseAmount?.addEventListener('focus', (e) => {
      const value = parseCurrency(e.target.value);
      if (value !== null) {
        e.target.value = value.toString();
      }
    });

    // Note: Removed the input event listener that was updating expenses array directly
    // This was causing the "No changes to save" issue because the comparison with
    // originalExpenses would find no differences. Now we collect changes from DOM
    // inputs directly in saveEditChanges() function.

    // Datalist inputs: Update data-field-value when user selects from list
    els.expensesTableBody?.addEventListener('input', (e) => {
      if (e.target.classList.contains('edit-input-datalist')) {
        const input = e.target;
        const datalist = document.getElementById(input.getAttribute('list'));
        if (!datalist) return;

        // Find matching option
        const options = Array.from(datalist.options);
        const matchingOption = options.find(opt => opt.value === input.value);

        if (matchingOption) {
          // Update the hidden value with the actual ID
          input.dataset.fieldValue = matchingOption.dataset.value;
          console.log(`[DATALIST] Updated ${input.dataset.field} to:`, matchingOption.dataset.value);
        } else {
          // Clear if no match (user typed something not in list)
          input.dataset.fieldValue = '';
        }
      }
    });

    // Filter toggle buttons
    document.querySelectorAll('.filter-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const column = btn.dataset.column;
        toggleFilterDropdown(column, btn);
      });
    });

    // Filter dropdown search
    const filterSearch = els.filterDropdown?.querySelector('.filter-search');
    filterSearch?.addEventListener('input', (e) => {
      filterDropdownOptions(e.target.value);
    });

    // Filter dropdown Select All button
    els.filterDropdown?.querySelector('.filter-select-all-btn')?.addEventListener('click', () => {
      selectAllFilterOptions();
    });

    // Filter dropdown Clear button
    els.filterDropdown?.querySelector('.filter-clear-btn')?.addEventListener('click', () => {
      clearFilterSelection();
    });

    // Filter dropdown Apply button
    els.filterDropdown?.querySelector('.filter-apply-btn')?.addEventListener('click', () => {
      applyFilterSelection();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!els.filterDropdown?.contains(e.target) && !e.target.classList.contains('filter-toggle')) {
        closeFilterDropdown();
      }
    });

    // Bill View toggle button
    els.btnBillView?.addEventListener('click', () => {
      toggleBillView();
    });

    // Column Manager button
    els.btnColumnManager?.addEventListener('click', () => {
      openColumnManager();
    });

    // Health Check button (Duplicates + Missing Info)
    els.btnDetectDuplicates?.addEventListener('click', async () => {
      const btn = els.btnDetectDuplicates;

      // Check for existing issues - reopen panel if any exist
      detectMissingInfo();
      if (duplicateClusters.length > 0 || missingInfoExpenses.length > 0) {
        showDuplicateReviewPanel();
        return;
      }

      // Otherwise, run full detection
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="font-size: 14px;">⏳</span> Scanning...';

      try {
        await detectDuplicateBillNumbers();
        detectMissingInfo();

        // Show panel if any issues found
        if (duplicateClusters.length > 0 || missingInfoExpenses.length > 0) {
          updateDuplicatesButtonBadge();
          showDuplicateReviewPanel();
        } else {
          // All clear!
          updateDuplicatesButtonBadge(); // Shows green checkmark
          if (window.Toast) {
            Toast.success('All Clear! ✓', 'No duplicates or missing info found. Your expenses are healthy!');
          }
        }
      } catch (error) {
        console.error('[HEALTH CHECK] Error during scan:', error);
        if (window.Toast) {
          Toast.error('Error', 'Failed to complete health check');
        }
      } finally {
        // Restore button
        btn.disabled = false;
        updateDuplicatesButtonBadge(); // Update button with results
      }
    });

    // Column Manager modal close buttons
    els.btnCloseColumnManager?.addEventListener('click', () => {
      closeColumnManager();
    });

    els.btnCloseColumnManagerFooter?.addEventListener('click', () => {
      closeColumnManager();
    });

    // Reset columns button
    els.btnResetColumns?.addEventListener('click', () => {
      resetColumnVisibility();
    });

    // Auto Categorize button - open stage selection modal
    els.btnAutoCategorize?.addEventListener('click', () => {
      openConstructionStageModal();
    });

    // Import CSV button
    els.btnImportCSVExpenses?.addEventListener('click', () => {
      els.csvExpenseFileInput?.click();
    });

    // CSV file input change
    els.csvExpenseFileInput?.addEventListener('change', handleCSVImport);

    // CSV Mapping Modal handlers
    els.btnCloseCsvMapping?.addEventListener('click', closeCsvMappingModal);
    els.btnCancelCsvMapping?.addEventListener('click', closeCsvMappingModal);
    els.btnConfirmCsvMapping?.addEventListener('click', confirmCSVMapping);

    // Close mapping modal on backdrop click
    els.csvMappingModal?.addEventListener('click', (e) => {
      if (e.target === els.csvMappingModal) {
        closeCsvMappingModal();
      }
    });

    // Construction Stage Modal handlers
    const stageModal = document.getElementById('constructionStageModal');
    const btnCloseStageModal = document.getElementById('btnCloseStageModal');
    const btnCancelStageModal = document.getElementById('btnCancelStageModal');
    const stageOptions = document.querySelectorAll('.stage-option');

    btnCloseStageModal?.addEventListener('click', closeConstructionStageModal);
    btnCancelStageModal?.addEventListener('click', closeConstructionStageModal);

    stageOptions.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const stage = e.currentTarget.getAttribute('data-stage');
        await handleStageSelection(stage);
      });
    });

    // Monitor description changes in modal rows to update Auto Categorize button
    els.expenseRowsBody?.addEventListener('input', (e) => {
      if (e.target.classList.contains('exp-input--desc')) {
        updateAutoCategorizeButton();
      }
    });

    // Bill Edit Modal handlers
    els.btnCloseBillModal?.addEventListener('click', closeBillEditModal);
    els.btnCancelBillEdit?.addEventListener('click', closeBillEditModal);
    els.btnSaveBillEdit?.addEventListener('click', saveBillEdit);

    // Bill status option selection
    els.billStatusOptions?.addEventListener('click', (e) => {
      const option = e.target.closest('.bill-status-option');
      if (option) {
        els.billStatusOptions.querySelectorAll('.bill-status-option').forEach(btn => {
          btn.classList.remove('selected');
        });
        option.classList.add('selected');
      }
    });

    // Bill vendor datalist - update data-value on selection
    els.billEditVendor?.addEventListener('input', (e) => {
      const datalist = document.getElementById('billEditVendorList');
      if (!datalist) return;
      const matchingOption = Array.from(datalist.options).find(opt => opt.value === e.target.value);
      if (matchingOption) {
        e.target.dataset.value = matchingOption.getAttribute('data-id');
      } else {
        e.target.dataset.value = '';
      }
    });

    // Close bill edit modal on backdrop click
    els.billEditModal?.addEventListener('click', (e) => {
      if (e.target === els.billEditModal) {
        closeBillEditModal();
      }
    });

    // Bill card header click handler (event delegation on table body)
    els.expensesTableBody?.addEventListener('click', (e) => {
      // Check if clicked on collapse button
      const collapseBtn = e.target.closest('.bill-collapse-btn');
      if (collapseBtn) {
        e.stopPropagation();
        const billGroup = collapseBtn.dataset.billGroup;
        if (billGroup) {
          toggleBillGroupCollapse(billGroup, collapseBtn);
        }
        return;
      }

      // Check if clicked on bill card header (not on a regular expense row)
      const billHeader = e.target.closest('.bill-card-clickable');
      if (billHeader) {
        const billId = billHeader.dataset.billId;
        if (billId) {
          e.stopPropagation();
          openBillEditModal(billId);
        }
      }
    });

    // Bill Status Toggle Buttons in Add Expense Modal
    els.billStatusToggle?.addEventListener('click', (e) => {
      const btn = e.target.closest('.bill-status-btn');
      if (btn) {
        const status = btn.dataset.status;
        if (status) {
          selectedBillStatus = status;
          // Update selected state on all buttons
          els.billStatusToggle.querySelectorAll('.bill-status-btn').forEach(b => {
            b.classList.toggle('selected', b.dataset.status === status);
          });
          updateBillStatusHint();
          console.log('[EXPENSES] Bill status changed to:', status);
        }
      }
    });

    // Monitor bill_id changes in modal expense rows to show/hide Bill Status section
    els.expenseRowsBody?.addEventListener('input', (e) => {
      if (e.target.dataset?.field === 'bill_id') {
        updateBillStatusSection();
      }
    });

    // Initialize column resize handles
    initColumnResize();

    // Initialize context menu for fill down
    initContextMenu();
  }

  // ================================
  // CONTEXT MENU - FILL DOWN
  // ================================

  let contextMenuTarget = null;
  let contextMenuField = null;
  let contextMenuRowIndex = null;

  function initContextMenu() {
    const contextMenu = document.getElementById('expenseContextMenu');
    if (!contextMenu) return;

    // Right-click on expense rows table
    els.expenseRowsBody?.addEventListener('contextmenu', (e) => {
      const input = e.target.closest('.exp-input, .exp-select');
      if (!input) return;

      e.preventDefault();

      // Get the field and row info
      const row = input.closest('tr');
      if (!row) return;

      contextMenuTarget = input;
      contextMenuField = input.dataset.field || input.closest('td')?.cellIndex;
      contextMenuRowIndex = parseInt(row.dataset.rowIndex, 10);

      // Highlight the cell
      input.classList.add('context-active');

      // Position and show context menu
      const x = e.clientX;
      const y = e.clientY;

      // Ensure menu doesn't go off-screen
      const menuWidth = 180;
      const menuHeight = 100;
      const posX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
      const posY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

      contextMenu.style.left = posX + 'px';
      contextMenu.style.top = posY + 'px';
      contextMenu.classList.remove('hidden');
    });

    // Handle context menu actions
    contextMenu.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent document click handler from firing first
      e.preventDefault();

      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      console.log('[CONTEXT MENU] Action clicked:', action);

      // Save references before any async operations or hideContextMenu
      const savedTarget = contextMenuTarget;
      const savedRowIndex = contextMenuRowIndex;

      console.log('[CONTEXT MENU] Saved target:', savedTarget);
      console.log('[CONTEXT MENU] Saved rowIndex:', savedRowIndex);

      if (action === 'fill-down') {
        fillDownWithParams(savedTarget, savedRowIndex);
      } else if (action === 'clear-below') {
        clearBelowWithParams(savedTarget, savedRowIndex);
      }

      hideContextMenu();
    });

    // Hide context menu on click outside
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target)) {
        hideContextMenu();
      }
    });

    // Hide context menu on scroll
    document.addEventListener('scroll', hideContextMenu, true);

    // Hide context menu on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    });
  }

  function hideContextMenu() {
    const contextMenu = document.getElementById('expenseContextMenu');
    if (contextMenu) {
      contextMenu.classList.add('hidden');
    }

    // Remove highlight from cell
    if (contextMenuTarget) {
      contextMenuTarget.classList.remove('context-active');
    }

    contextMenuTarget = null;
    contextMenuField = null;
    contextMenuRowIndex = null;
  }

  function fillDown() {
    fillDownWithParams(contextMenuTarget, contextMenuRowIndex);
  }

  function fillDownWithParams(target, sourceRowIndex) {
    console.log('[FILL DOWN] Starting fillDown...');
    console.log('[FILL DOWN] target:', target);
    console.log('[FILL DOWN] sourceRowIndex:', sourceRowIndex);

    if (!target || sourceRowIndex === null || sourceRowIndex === undefined) {
      console.log('[FILL DOWN] Aborted: no target or row index');
      if (window.Toast) {
        Toast.warning('Fill Down', 'No source cell selected');
      }
      return;
    }

    const rows = els.expenseRowsBody?.querySelectorAll('tr') || [];
    console.log('[FILL DOWN] Total rows found:', rows.length);

    if (rows.length <= 1) {
      console.log('[FILL DOWN] Aborted: not enough rows');
      if (window.Toast) {
        Toast.info('Fill Down', 'No rows below to fill');
      }
      return;
    }

    const isSelect = target.tagName === 'SELECT';
    const isInput = target.tagName === 'INPUT';
    console.log('[FILL DOWN] Target type:', target.tagName);

    // Get the value to copy
    let valueToCopy;

    if (isSelect) {
      valueToCopy = target.value;
    } else if (isInput) {
      valueToCopy = target.value;
    }

    console.log('[FILL DOWN] Value to copy:', valueToCopy);

    if (!valueToCopy && valueToCopy !== 0) {
      console.log('[FILL DOWN] Aborted: empty value');
      if (window.Toast) {
        Toast.warning('Fill Down', 'Source cell is empty');
      }
      return;
    }

    // Get the cell index to find the same column in other rows
    const cell = target.closest('td');
    const cellIndex = cell?.cellIndex;
    console.log('[FILL DOWN] Cell index:', cellIndex);

    if (cellIndex === undefined) {
      console.log('[FILL DOWN] Aborted: no cell index');
      return;
    }

    let filledCount = 0;

    // Fill all rows below the current one
    rows.forEach((row) => {
      const rowIndex = parseInt(row.dataset.rowIndex, 10);

      if (isNaN(rowIndex)) {
        console.log('[FILL DOWN] Skipping row with invalid index');
        return;
      }

      if (rowIndex <= sourceRowIndex) return; // Skip current and above rows

      const targetCell = row.cells[cellIndex];
      if (!targetCell) {
        console.log('[FILL DOWN] No target cell at index:', cellIndex);
        return;
      }

      const targetInput = targetCell.querySelector('.exp-input, .exp-select');
      if (!targetInput) {
        console.log('[FILL DOWN] No input found in cell');
        return;
      }

      console.log('[FILL DOWN] Filling row:', rowIndex);

      // Set the value
      if (targetInput.tagName === 'SELECT') {
        const option = Array.from(targetInput.options).find(opt => opt.value === valueToCopy);
        if (option) {
          targetInput.value = valueToCopy;
          filledCount++;
        }
      } else if (targetInput.tagName === 'INPUT') {
        targetInput.value = valueToCopy;
        filledCount++;
      }

      // Trigger input event to update any dependent logic
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    console.log('[FILL DOWN] Filled count:', filledCount);

    // Show toast notification
    if (filledCount > 0 && window.Toast) {
      Toast.success('Fill Down', `Copied to ${filledCount} row${filledCount > 1 ? 's' : ''} below`);
    } else if (filledCount === 0 && window.Toast) {
      Toast.info('Fill Down', 'No rows below to fill');
    }

    // Update auto-categorize button state
    updateAutoCategorizeButton();
  }

  function clearBelow() {
    clearBelowWithParams(contextMenuTarget, contextMenuRowIndex);
  }

  function clearBelowWithParams(target, sourceRowIndex) {
    if (!target || sourceRowIndex === null || sourceRowIndex === undefined) return;

    const rows = els.expenseRowsBody?.querySelectorAll('tr') || [];

    // Get the cell index
    const cell = target.closest('td');
    const cellIndex = cell?.cellIndex;
    if (cellIndex === undefined) return;

    let clearedCount = 0;

    // Clear all rows below the current one
    rows.forEach((row) => {
      const rowIndex = parseInt(row.dataset.rowIndex, 10);
      if (isNaN(rowIndex) || rowIndex <= sourceRowIndex) return; // Skip current and above rows

      const targetCell = row.cells[cellIndex];
      if (!targetCell) return;

      const targetInput = targetCell.querySelector('.exp-input, .exp-select');
      if (!targetInput) return;

      // Clear the value
      if (targetInput.tagName === 'SELECT') {
        targetInput.selectedIndex = 0; // Reset to first option (usually empty/placeholder)
        clearedCount++;
      } else if (targetInput.tagName === 'INPUT') {
        targetInput.value = '';
        clearedCount++;
      }

      // Trigger events
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Show toast notification
    if (clearedCount > 0 && window.Toast) {
      Toast.info('Clear Below', `Cleared ${clearedCount} row${clearedCount > 1 ? 's' : ''} below`);
    }
  }

  // ================================
  // BILL VIEW FUNCTIONALITY
  // ================================

  function toggleBillView() {
    isBillViewMode = !isBillViewMode;

    // Update button appearance
    if (isBillViewMode) {
      els.btnBillView.classList.add('btn-toolbar-active');
      els.btnBillView.textContent = 'Normal View';
    } else {
      els.btnBillView.classList.remove('btn-toolbar-active');
      els.btnBillView.textContent = 'Bill View';
    }

    // Re-render table
    renderExpensesTable();
  }

  function groupExpensesByBill(expensesList) {
    const groups = {
      withBill: {},    // { bill_id: [expenses] }
      withoutBill: []  // expenses without bill_id
    };

    expensesList.forEach(exp => {
      const billId = exp.bill_id?.trim();
      if (billId) {
        if (!groups.withBill[billId]) {
          groups.withBill[billId] = [];
        }
        groups.withBill[billId].push(exp);
      } else {
        groups.withoutBill.push(exp);
      }
    });

    return groups;
  }

  function renderBillViewTable() {
    if (!els.expensesTableBody) return;

    const displayExpenses = filteredExpenses.length > 0 || Object.values(columnFilters).some(f => f.length > 0) ? filteredExpenses : expenses;
    const groups = groupExpensesByBill(displayExpenses);

    let html = '';
    let grandTotal = 0;

    // Render bill groups first
    const billIds = Object.keys(groups.withBill).sort();

    billIds.forEach(billId => {
      const billExpenses = groups.withBill[billId];
      const billTotal = billExpenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount) || 0), 0);
      grandTotal += billTotal;

      // Determine bill status
      const billStatus = determineBillStatus(billId, billExpenses);

      // Determine if this is a Check or Bill based on payment_type of expenses
      // If any expense has payment_type that matches a "check" method, label as Check
      const billLabel = determineBillLabel(billExpenses);

      // Get bill metadata for receipt info
      const billData = getBillMetadata(billId);
      const hasReceipt = billData?.receipt_url ? true : false;

      // Bill group header - full width card header (clickable to edit bill)
      html += `
        <tr class="bill-group-header" data-bill-group="${billId}">
          <td colspan="12">
            <div class="bill-card-header">
              <div class="bill-card-info bill-card-clickable" data-bill-id="${billId}" title="Click to edit bill">
                <span class="bill-card-number">${billLabel} #${billId}</span>
                <span class="bill-card-count">${billExpenses.length} item${billExpenses.length > 1 ? 's' : ''}</span>
                <span class="bill-card-total-pill">${formatCurrency(billTotal)}</span>
                <span class="bill-status bill-status--${billStatus.type}" title="${billStatus.tooltip}">
                  ${billStatus.icon} ${billStatus.label}
                </span>
                ${hasReceipt ? '<span class="bill-receipt-indicator" title="Has receipt attached">📎</span>' : ''}
              </div>
              <div class="bill-card-actions">
                <button type="button" class="bill-collapse-btn" data-bill-group="${billId}" title="Collapse/Expand">
                  <span class="collapse-icon">▼</span>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;

      // Render each expense in the group
      billExpenses.forEach((exp, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === billExpenses.length - 1;
        html += renderBillGroupRow(exp, displayExpenses.indexOf(exp), isFirst, isLast, billId);
      });

      // Bill group footer with summary
      html += `
        <tr class="bill-group-footer" data-bill-group="${billId}">
          <td colspan="12">
            <div class="bill-card-footer">
              <span class="bill-footer-items">${billExpenses.length} expense${billExpenses.length > 1 ? 's' : ''} in this bill</span>
            </div>
          </td>
        </tr>
      `;

      // Add spacer after each bill group
      html += `<tr class="bill-group-spacer"><td colspan="12"></td></tr>`;
    });

    // Render expenses without bill (in a separate section)
    if (groups.withoutBill.length > 0) {
      html += `
        <tr class="bill-group-header bill-group-header--no-bill" data-bill-group="no-bill">
          <td colspan="12">
            <div class="bill-card-header bill-card-header--no-bill">
              <div class="bill-card-info">
                <span class="bill-card-number">No Bill Assigned</span>
                <span class="bill-card-count">${groups.withoutBill.length} item${groups.withoutBill.length > 1 ? 's' : ''}</span>
              </div>
              <div class="bill-card-actions">
                <button type="button" class="bill-collapse-btn" data-bill-group="no-bill" title="Collapse/Expand">
                  <span class="collapse-icon">▼</span>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;

      groups.withoutBill.forEach((exp, idx) => {
        grandTotal += parseFloat(exp.Amount) || 0;
        const isFirst = idx === 0;
        const isLast = idx === groups.withoutBill.length - 1;
        html += renderBillGroupRow(exp, displayExpenses.indexOf(exp), isFirst, isLast, 'no-bill');
      });

      html += `<tr class="bill-group-spacer"><td colspan="12"></td></tr>`;
    }

    // Grand total row
    html += `
      <tr class="total-row">
        <td colspan="12">
          <div class="grand-total-row">
            <span class="grand-total-label">Grand Total</span>
            <span class="grand-total-amount">${formatCurrency(grandTotal)}</span>
          </div>
        </td>
      </tr>
    `;

    els.expensesTableBody.innerHTML = html;
    applyColumnVisibility();
    loadColumnWidths();
    restoreCollapsedBillGroups();
  }

  // Track collapsed bill groups
  const collapsedBillGroups = new Set();

  /**
   * Toggle collapse/expand state of a bill group
   * @param {string} billGroup - The bill group ID
   * @param {HTMLElement} btn - The collapse button element
   */
  function toggleBillGroupCollapse(billGroup, btn) {
    const isCollapsed = collapsedBillGroups.has(billGroup);

    if (isCollapsed) {
      // Expand
      collapsedBillGroups.delete(billGroup);
      expandBillGroup(billGroup);
      btn.classList.remove('collapsed');
    } else {
      // Collapse
      collapsedBillGroups.add(billGroup);
      collapseBillGroup(billGroup);
      btn.classList.add('collapsed');
    }
  }

  /**
   * Collapse a bill group (hide rows and footer)
   * @param {string} billGroup - The bill group ID
   */
  function collapseBillGroup(billGroup) {
    // Hide all expense rows in this group
    const rows = document.querySelectorAll(`tr.bill-group-row[data-bill-group="${billGroup}"]`);
    rows.forEach(row => row.classList.add('bill-row-collapsed'));

    // Hide the footer
    const footer = document.querySelector(`tr.bill-group-footer[data-bill-group="${billGroup}"]`);
    if (footer) footer.classList.add('bill-row-collapsed');

    // Update header border radius when collapsed
    const header = document.querySelector(`tr.bill-group-header[data-bill-group="${billGroup}"]`);
    if (header) header.classList.add('bill-group-collapsed');
  }

  /**
   * Expand a bill group (show rows and footer)
   * @param {string} billGroup - The bill group ID
   */
  function expandBillGroup(billGroup) {
    // Show all expense rows in this group
    const rows = document.querySelectorAll(`tr.bill-group-row[data-bill-group="${billGroup}"]`);
    rows.forEach(row => row.classList.remove('bill-row-collapsed'));

    // Show the footer
    const footer = document.querySelector(`tr.bill-group-footer[data-bill-group="${billGroup}"]`);
    if (footer) footer.classList.remove('bill-row-collapsed');

    // Update header border radius when expanded
    const header = document.querySelector(`tr.bill-group-header[data-bill-group="${billGroup}"]`);
    if (header) header.classList.remove('bill-group-collapsed');
  }

  /**
   * Restore collapsed state after re-render
   */
  function restoreCollapsedBillGroups() {
    collapsedBillGroups.forEach(billGroup => {
      collapseBillGroup(billGroup);
      // Also update the button state
      const btn = document.querySelector(`.bill-collapse-btn[data-bill-group="${billGroup}"]`);
      if (btn) btn.classList.add('collapsed');
    });
  }

  /**
   * Determine bill status based on expenses and metadata
   * @param {string} billId - The bill ID
   * @param {Array} billExpenses - Expenses in this bill for current project
   * @returns {Object} - { type: 'closed'|'open'|'split', label, icon, tooltip }
   */
  function determineBillStatus(billId, billExpenses) {
    // First, try to get bill metadata from bills table
    const billData = getBillMetadata(billId);

    // If we have bill data from the bills table, use it as primary source
    if (billData) {
      const status = (billData.status || 'open').toLowerCase();

      // Explicit status from bills table
      if (status === 'closed') {
        return {
          type: 'closed',
          label: 'Closed',
          icon: '✓',
          tooltip: 'All expenses for this bill are accounted for'
        };
      } else if (status === 'split') {
        const splitInfo = billData.split_projects?.length
          ? ` (across ${billData.split_projects.length + 1} projects)`
          : '';
        return {
          type: 'split',
          label: 'Split',
          icon: '⚡',
          tooltip: `Expenses from this bill are in multiple projects${splitInfo}`
        };
      }

      // If we have expected total from bills table, compare with actual
      if (billData.expected_total) {
        const actualTotal = billExpenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount) || 0), 0);
        const expectedTotal = parseFloat(billData.expected_total);

        if (Math.abs(actualTotal - expectedTotal) < 0.01) {
          return {
            type: 'closed',
            label: 'Closed',
            icon: '✓',
            tooltip: `Bill complete: ${formatCurrency(actualTotal)} of ${formatCurrency(expectedTotal)}`
          };
        } else if (actualTotal < expectedTotal) {
          return {
            type: 'open',
            label: 'Open',
            icon: '⏳',
            tooltip: `Missing: ${formatCurrency(expectedTotal - actualTotal)} (${formatCurrency(actualTotal)} of ${formatCurrency(expectedTotal)})`
          };
        }
      }

      // Status is 'open' from bills table
      return {
        type: 'open',
        label: 'Open',
        icon: '⏳',
        tooltip: billData.notes || 'Bill is open - may have pending expenses'
      };
    }

    // Fallback: Check if any expense has embedded bill metadata (legacy support)
    const firstExpense = billExpenses[0];
    const billMetadata = firstExpense?.bill_metadata || null;

    if (billMetadata?.status) {
      const status = billMetadata.status.toLowerCase();
      if (status === 'closed') {
        return {
          type: 'closed',
          label: 'Closed',
          icon: '✓',
          tooltip: 'All expenses for this bill are accounted for'
        };
      } else if (status === 'split') {
        return {
          type: 'split',
          label: 'Split',
          icon: '⚡',
          tooltip: 'Some expenses from this bill are in other projects'
        };
      }
    }

    if (billMetadata?.expected_total) {
      const actualTotal = billExpenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount) || 0), 0);
      const expectedTotal = parseFloat(billMetadata.expected_total);

      if (Math.abs(actualTotal - expectedTotal) < 0.01) {
        return {
          type: 'closed',
          label: 'Closed',
          icon: '✓',
          tooltip: `Bill complete: ${formatCurrency(actualTotal)} of ${formatCurrency(expectedTotal)}`
        };
      } else if (actualTotal < expectedTotal) {
        return {
          type: 'open',
          label: 'Open',
          icon: '⏳',
          tooltip: `Missing: ${formatCurrency(expectedTotal - actualTotal)} (${formatCurrency(actualTotal)} of ${formatCurrency(expectedTotal)})`
        };
      }
    }

    // Default: Open status (no bill record found)
    return {
      type: 'open',
      label: 'Open',
      icon: '⏳',
      tooltip: 'Bill not registered - status unknown'
    };
  }

  /**
   * Determine if this should be labeled "Check" or "Bill" based on payment_type
   * @param {Array} billExpenses - Expenses in this bill
   * @returns {string} - "Check" or "Bill"
   */
  function determineBillLabel(billExpenses) {
    // Check if any expense has a payment_type that indicates a check
    const checkPaymentNames = ['check', 'cheque', 'chk'];

    for (const exp of billExpenses) {
      // Get payment method name
      const paymentName = exp.payment_method_name ||
        findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '';

      // Check if it's a check payment
      if (paymentName && checkPaymentNames.some(chk => paymentName.toLowerCase().includes(chk))) {
        return 'Check';
      }
    }

    return 'Bill';
  }

  function renderBillGroupRow(exp, index, isFirst, isLast, groupBillId = null) {
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
    const billId = exp.bill_id || '—';
    const billGroupAttr = groupBillId ? `data-bill-group="${groupBillId}"` : '';
    const description = exp.LineDescription || '—';
    const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '—';
    const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
    const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
    const account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '—';
    const amount = exp.Amount ? formatCurrency(Number(exp.Amount)) : '$0.00';
    const expenseId = exp.expense_id || exp.id || '';

    // Receipt icon - check bills table first, then expense (legacy)
    // Click opens the edit modal; badge indicates if receipt is attached
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<span class="receipt-icon-btn receipt-icon-btn--has-receipt" title="Click to view/edit receipt">📎<span class="receipt-badge"></span></span>`
      : `<span class="receipt-icon-btn" title="No receipt attached">📎<span class="receipt-badge receipt-badge--missing"></span></span>`;

    // Use status field first, fall back to auth_status (must match filter logic)
    const isAuthorized = exp.status ? exp.status === 'auth' : (exp.auth_status === true || exp.auth_status === 1);
    const isReview = exp.status === 'review';
    const authBadgeClass = isReview ? 'auth-badge-review' : (isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending');
    const authBadgeText = isReview ? '⚠ Review' : (isAuthorized ? '✓ Auth' : '⏳ Pending');
    const authBadgeDisabled = canAuthorize ? '' : ' auth-badge-disabled';
    const cursorStyle = canAuthorize ? 'cursor: pointer;' : 'cursor: not-allowed;';
    const authBadge = `<span class="auth-badge ${authBadgeClass}${authBadgeDisabled}"
      data-expense-id="${expenseId}"
      data-auth-status="${isAuthorized}"
      data-can-authorize="${canAuthorize}"
      style="${cursorStyle}"
      title="${canAuthorize ? 'Click to toggle authorization' : 'You do not have permission to authorize'}">${authBadgeText}</span>`;

    // Determine border classes
    let borderClass = 'bill-group-row';
    if (isFirst) borderClass += ' bill-group-first';
    if (isLast) borderClass += ' bill-group-last';

    return `
      <tr data-index="${index}" data-id="${expenseId}" ${billGroupAttr} class="expense-row-clickable ${borderClass}" style="cursor: pointer;">
        <td class="col-checkbox" style="display: none;"></td>
        <td class="col-date">${date}</td>
        <td class="col-bill-id">${billId}</td>
        <td class="col-description">${description}</td>
        <td class="col-account">${account}</td>
        <td class="col-type">${type}</td>
        <td class="col-vendor">${vendor}</td>
        <td class="col-payment">${payment}</td>
        <td class="col-amount">${amount}</td>
        <td class="col-receipt">${receiptIcon}</td>
        <td class="col-auth">${authBadge}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  // ================================
  // BILL EDIT MODAL
  // ================================

  let currentEditBillId = null;
  let billEditReceiptFile = null;
  let billEditReceiptDeleted = false;
  let billEditBlobUrl = null; // Track blob URL for cleanup (memory leak prevention)

  function openBillEditModal(billId) {
    if (!billId) return;

    currentEditBillId = billId;
    billEditReceiptFile = null;
    billEditReceiptDeleted = false;

    // Get bill metadata from cache or create default
    const billData = getBillMetadata(billId) || {
      bill_id: billId,
      status: 'open',
      expected_total: null,
      vendor_id: null,
      notes: null,
      receipt_url: null
    };

    // Get expenses for this bill to calculate stats
    const billExpenses = expenses.filter(exp => exp.bill_id === billId);
    const billTotal = billExpenses.reduce((sum, exp) => sum + (parseFloat(exp.Amount) || 0), 0);

    // Populate modal header
    els.billEditNumber.textContent = `#${billId}`;
    els.billEditExpenseCount.textContent = billExpenses.length;
    els.billEditTotal.textContent = formatCurrency(billTotal);

    // Populate status options
    const currentStatus = (billData.status || 'open').toLowerCase();
    els.billStatusOptions.querySelectorAll('.bill-status-option').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.status === currentStatus);
    });

    // Populate expected total
    els.billEditExpectedTotal.value = billData.expected_total || '';

    // Populate vendor datalist
    const vendorList = document.getElementById('billEditVendorList');
    vendorList.innerHTML = metaData.vendors.map(v =>
      `<option value="${v.vendor_name}" data-id="${v.id}"></option>`
    ).join('');

    // Set vendor value
    if (billData.vendor_id) {
      const vendor = metaData.vendors.find(v => v.id === billData.vendor_id);
      els.billEditVendor.value = vendor?.vendor_name || '';
      els.billEditVendor.dataset.value = billData.vendor_id;
    } else {
      els.billEditVendor.value = '';
      els.billEditVendor.dataset.value = '';
    }

    // Populate notes
    els.billEditNotes.value = billData.notes || '';

    // Render receipt section
    renderBillReceiptSection(billData.receipt_url);

    // Show modal
    els.billEditModal.classList.remove('hidden');
  }

  function closeBillEditModal() {
    // Revoke blob URL to prevent memory leak
    if (billEditBlobUrl) {
      URL.revokeObjectURL(billEditBlobUrl);
      billEditBlobUrl = null;
    }
    els.billEditModal.classList.add('hidden');
    currentEditBillId = null;
    billEditReceiptFile = null;
    billEditReceiptDeleted = false;
  }

  // Helper to create blob URL with tracking for bill edit modal
  function createBillEditBlobUrl(file) {
    // Revoke previous blob URL to prevent memory leak
    if (billEditBlobUrl) {
      URL.revokeObjectURL(billEditBlobUrl);
    }
    billEditBlobUrl = URL.createObjectURL(file);
    return billEditBlobUrl;
  }

  function renderBillReceiptSection(receiptUrl) {
    if (receiptUrl && !billEditReceiptDeleted) {
      // Show receipt preview - use generic label instead of filename to avoid info disclosure
      const isBlob = receiptUrl.startsWith('blob:');
      const displayName = isBlob ? 'New file selected' : 'Receipt attached';
      els.billReceiptSection.innerHTML = `
        <div class="bill-receipt-preview">
          <span class="bill-receipt-preview-icon">📎</span>
          <div class="bill-receipt-preview-info">
            <div class="bill-receipt-preview-name">${displayName}</div>
            <a href="${receiptUrl}" target="_blank" class="bill-receipt-preview-link">View receipt</a>
          </div>
          <div class="bill-receipt-preview-actions">
            <button type="button" class="bill-receipt-btn" id="btnReplaceBillReceipt">Replace</button>
            <button type="button" class="bill-receipt-btn bill-receipt-btn--delete" id="btnDeleteBillReceipt">Delete</button>
          </div>
        </div>
        <input type="file" id="billReceiptFileInput" accept="image/*,application/pdf" style="display: none;">
      `;

      // Attach event listeners
      document.getElementById('btnReplaceBillReceipt')?.addEventListener('click', () => {
        document.getElementById('billReceiptFileInput')?.click();
      });
      document.getElementById('btnDeleteBillReceipt')?.addEventListener('click', () => {
        // Revoke blob URL to prevent memory leak
        if (billEditBlobUrl) {
          URL.revokeObjectURL(billEditBlobUrl);
          billEditBlobUrl = null;
        }
        billEditReceiptDeleted = true;
        billEditReceiptFile = null;
        renderBillReceiptSection(null);
      });
      document.getElementById('billReceiptFileInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          billEditReceiptFile = file;
          billEditReceiptDeleted = false;
          renderBillReceiptSection(createBillEditBlobUrl(file));
        }
      });
    } else if (billEditReceiptFile) {
      // Show selected file preview
      els.billReceiptSection.innerHTML = `
        <div class="bill-receipt-preview">
          <span class="bill-receipt-preview-icon">📎</span>
          <div class="bill-receipt-preview-info">
            <div class="bill-receipt-preview-name">${billEditReceiptFile.name}</div>
            <span class="bill-receipt-preview-link">New file (not saved yet)</span>
          </div>
          <div class="bill-receipt-preview-actions">
            <button type="button" class="bill-receipt-btn bill-receipt-btn--delete" id="btnClearBillReceipt">Clear</button>
          </div>
        </div>
      `;
      document.getElementById('btnClearBillReceipt')?.addEventListener('click', () => {
        // Revoke blob URL to prevent memory leak
        if (billEditBlobUrl) {
          URL.revokeObjectURL(billEditBlobUrl);
          billEditBlobUrl = null;
        }
        billEditReceiptFile = null;
        renderBillReceiptSection(null);
      });
    } else {
      // Show upload zone
      els.billReceiptSection.innerHTML = `
        <div class="bill-receipt-upload" id="billReceiptUploadZone">
          <span class="bill-receipt-upload-icon">📎</span>
          <div class="bill-receipt-upload-text">Click to upload or drag and drop</div>
          <div class="bill-receipt-upload-hint">JPG, PNG, GIF, WebP or PDF (max 5MB)</div>
        </div>
        <input type="file" id="billReceiptFileInput" accept="image/*,application/pdf" style="display: none;">
      `;

      const uploadZone = document.getElementById('billReceiptUploadZone');
      const fileInput = document.getElementById('billReceiptFileInput');

      uploadZone?.addEventListener('click', () => fileInput?.click());
      uploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'rgba(74, 222, 128, 0.5)';
      });
      uploadZone?.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = '';
      });
      uploadZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        const file = e.dataTransfer.files[0];
        if (file) {
          billEditReceiptFile = file;
          renderBillReceiptSection(createBillEditBlobUrl(file));
        }
      });
      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          billEditReceiptFile = file;
          renderBillReceiptSection(createBillEditBlobUrl(file));
        }
      });
    }
  }

  async function saveBillEdit() {
    if (!currentEditBillId) return;

    const apiBase = getApiBase();

    // Get selected status
    const selectedStatusBtn = els.billStatusOptions.querySelector('.bill-status-option.selected');
    const status = selectedStatusBtn?.dataset.status || 'open';

    // Check if reopening a closed bill - require confirmation
    const existingBillData = getBillMetadata(currentEditBillId);
    if (existingBillData?.status === 'closed' && status === 'open') {
      const confirmReopen = confirm(
        '⚠️ REOPEN CLOSED BILL?\n\n' +
        `Bill #${currentEditBillId} is currently marked as closed.\n\n` +
        'Reopening will allow new expenses to be added to this bill.\n\n' +
        'Are you sure you want to reopen this bill?'
      );
      if (!confirmReopen) {
        return; // User cancelled - don't save
      }
      console.log('[BILL] User confirmed reopening closed bill:', currentEditBillId);
    }

    // Get vendor ID from datalist
    let vendorId = els.billEditVendor.dataset.value || null;
    if (!vendorId && els.billEditVendor.value) {
      // Try to find vendor by name
      const vendor = metaData.vendors.find(v =>
        v.vendor_name.toLowerCase() === els.billEditVendor.value.toLowerCase()
      );
      vendorId = vendor?.id || null;
    }

    // Build update data
    const updateData = {
      status: status,
      expected_total: els.billEditExpectedTotal.value ? parseFloat(els.billEditExpectedTotal.value) : null,
      vendor_id: vendorId,
      notes: els.billEditNotes.value || null
    };

    // Disable save button
    els.btnSaveBillEdit.disabled = true;
    els.btnSaveBillEdit.textContent = 'Saving...';

    try {
      // Handle receipt upload/delete
      if (billEditReceiptFile) {
        // Upload new receipt
        const receiptUrl = await window.ReceiptUpload.upload(
          billEditReceiptFile,
          currentEditBillId, // Use bill_id as identifier
          selectedProjectId,
          currentEditBillId
        );
        updateData.receipt_url = receiptUrl;
        console.log('[BILL] Receipt uploaded:', receiptUrl);
      } else if (billEditReceiptDeleted) {
        // Delete existing receipt
        const billData = getBillMetadata(currentEditBillId);
        if (billData?.receipt_url && window.ReceiptUpload?.delete) {
          try {
            await window.ReceiptUpload.delete(billData.receipt_url);
            console.log('[BILL] Receipt deleted from storage');
          } catch (deleteErr) {
            console.warn('[BILL] Could not delete receipt file:', deleteErr.message);
          }
        }
        updateData.receipt_url = null;
      }

      // Check if bill exists in database
      const existingBill = getBillMetadata(currentEditBillId);

      if (existingBill) {
        // Update existing bill
        await apiJson(`${apiBase}/bills/${currentEditBillId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        });
        console.log('[BILL] Bill updated:', currentEditBillId);

        // Update local cache
        Object.assign(existingBill, updateData);
      } else {
        // Create new bill record
        const createData = {
          bill_id: currentEditBillId,
          ...updateData
        };
        const response = await apiJson(`${apiBase}/bills`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createData)
        });
        console.log('[BILL] Bill created:', response);

        // Add to local cache (using upsert to prevent duplicates)
        upsertBillInCache(createData);
      }

      closeBillEditModal();

      // Re-render table to show updated status
      if (isBillViewMode) {
        renderBillViewTable();
      } else {
        renderExpensesTable();
      }

    } catch (err) {
      console.error('[BILL] Error saving bill:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving bill.', { details: err.message });
      }
    } finally {
      els.btnSaveBillEdit.disabled = false;
      els.btnSaveBillEdit.textContent = 'Save Changes';
    }
  }

  // ================================
  // COLUMN RESIZE FUNCTIONALITY
  // ================================
  function initColumnResize() {
    const table = document.querySelector('.expenses-table');
    if (!table) return;

    const headerCells = table.querySelectorAll('thead th');

    headerCells.forEach((th, index) => {
      // Skip checkbox and actions columns (first and last)
      if (th.classList.contains('col-checkbox') || th.classList.contains('col-actions')) return;

      // Create resize handle
      const handle = document.createElement('div');
      handle.className = 'col-resize-handle';
      th.appendChild(handle);

      let startX, startWidth, columnClass;

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        startX = e.pageX;
        startWidth = th.offsetWidth;
        columnClass = Array.from(th.classList).find(c => c.startsWith('col-'));

        handle.classList.add('resizing');
        table.classList.add('resizing');

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      function onMouseMove(e) {
        const diff = e.pageX - startX;
        const newWidth = Math.max(50, startWidth + diff); // Minimum 50px

        // Update all cells in this column
        if (columnClass) {
          table.querySelectorAll(`.${columnClass}`).forEach(cell => {
            cell.style.width = `${newWidth}px`;
            cell.style.minWidth = `${newWidth}px`;
          });
        }
      }

      function onMouseUp() {
        handle.classList.remove('resizing');
        table.classList.remove('resizing');

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Save column widths to localStorage
        saveColumnWidths();
      }
    });

    // Load saved column widths
    loadColumnWidths();
  }

  function saveColumnWidths() {
    const table = document.querySelector('.expenses-table');
    if (!table) return;

    const widths = {};
    const headerCells = table.querySelectorAll('thead th');

    headerCells.forEach(th => {
      const columnClass = Array.from(th.classList).find(c => c.startsWith('col-'));
      if (columnClass && th.style.width) {
        widths[columnClass] = th.style.width;
      }
    });

    localStorage.setItem('expensesColumnWidths', JSON.stringify(widths));
  }

  function loadColumnWidths() {
    const saved = localStorage.getItem('expensesColumnWidths');
    if (!saved) return;

    try {
      const widths = JSON.parse(saved);
      const table = document.querySelector('.expenses-table');
      if (!table) return;

      Object.entries(widths).forEach(([columnClass, width]) => {
        table.querySelectorAll(`.${columnClass}`).forEach(cell => {
          cell.style.width = width;
          cell.style.minWidth = width;
        });
      });
    } catch (e) {
      console.warn('Failed to load column widths:', e);
    }
  }

  // ================================
  // QBO INTEGRATION EVENT LISTENERS
  // ================================
  function setupQBOEventListeners() {
    // Source Toggle Buttons
    document.getElementById('btnSourceManual')?.addEventListener('click', async () => {
      await switchDataSource('manual');
    });

    document.getElementById('btnSourceQBO')?.addEventListener('click', async () => {
      await switchDataSource('qbo');
    });

    // Sync QBO Button
    document.getElementById('btnSyncQBO')?.addEventListener('click', async () => {
      await syncQBOExpenses();
    });

    // QBO Mapping Button
    document.getElementById('btnQBOMapping')?.addEventListener('click', () => {
      openQBOMappingModal();
    });

    // Reconcile Button
    document.getElementById('btnReconcile')?.addEventListener('click', () => {
      openReconciliationModal();
    });

    // Reconciliation Modal - Close buttons
    document.getElementById('btnCloseReconcileModal')?.addEventListener('click', () => {
      closeReconciliationModal();
    });

    document.getElementById('btnCancelReconcile')?.addEventListener('click', () => {
      closeReconciliationModal();
    });

    // Reconciliation Modal - Backdrop close
    document.getElementById('reconcileModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('reconcileModal')) {
        closeReconciliationModal();
      }
    });
  }

  // ================================
  // QBO DATA SOURCE SWITCHING
  // ================================
  let originalTableHeaders = null; // Store original headers for restoration

  async function switchDataSource(source) {
    if (source === currentDataSource) return; // Already on this source

    currentDataSource = source;

    // Update button states
    const btnManual = document.getElementById('btnSourceManual');
    const btnQBO = document.getElementById('btnSourceQBO');
    const btnSyncQBO = document.getElementById('btnSyncQBO');
    const btnQBOMapping = document.getElementById('btnQBOMapping');
    const btnAdd = document.getElementById('btnAddExpense');
    const btnEdit = document.getElementById('btnEditExpenses');
    const btnReconcile = document.getElementById('btnReconcile');

    if (source === 'manual') {
      btnManual?.classList.add('active');
      btnQBO?.classList.remove('active');
      btnSyncQBO?.classList.add('hidden');
      btnSyncQBO?.setAttribute('disabled', 'true');
      btnQBOMapping?.classList.add('hidden');
      btnAdd?.removeAttribute('disabled');
      btnEdit?.removeAttribute('disabled');
      btnReconcile?.removeAttribute('disabled');

      // Restore original table headers
      if (originalTableHeaders && els.expensesTableHead) {
        els.expensesTableHead.innerHTML = originalTableHeaders;
      }
    } else {
      btnManual?.classList.remove('active');
      btnQBO?.classList.add('active');
      btnSyncQBO?.classList.remove('hidden');
      btnSyncQBO?.removeAttribute('disabled');
      btnQBOMapping?.classList.remove('hidden');
      btnAdd?.setAttribute('disabled', 'true');
      btnEdit?.setAttribute('disabled', 'true');
      btnReconcile?.removeAttribute('disabled'); // Can still reconcile from QBO view

      // Store original table headers before changing to QBO
      if (!originalTableHeaders && els.expensesTableHead) {
        originalTableHeaders = els.expensesTableHead.innerHTML;
      }
    }

    // Reload data for selected project
    if (selectedProjectId) {
      if (source === 'manual') {
        await loadExpensesByProject(selectedProjectId);
      } else {
        await loadQBOExpenses(selectedProjectId);
      }
    }
  }

  // ================================
  // QBO DATA LOADING & RENDERING
  // ================================
  async function loadQBOExpenses(projectId) {
    if (!projectId) {
      qboExpenses = [];
      showEmptyState(currentModeConfig.emptyMessage);
      return;
    }

    const apiBase = getApiBase();

    try {
      showEmptyState(currentModeConfig.loadingMessage);
      // Use dynamic is_cogs parameter based on expense mode
      const isCogs = currentModeConfig.qboParam;
      const url = `${apiBase}/qbo/expenses?project=${projectId}&is_cogs=${isCogs}`;
      console.log('[QBO] Loading with is_cogs=' + isCogs + ' for mode:', expenseMode);
      const result = await apiJson(url);

      // Handle response format (similar to manual expenses)
      if (Array.isArray(result)) qboExpenses = result;
      else if (result?.data) qboExpenses = result.data;
      else if (result?.expenses) qboExpenses = result.expenses;
      else qboExpenses = [];

      console.log('[QBO] Loaded expenses:', qboExpenses.length);
      renderQBOExpensesTable();
    } catch (err) {
      console.error('[QBO] Error loading expenses:', err);
      showEmptyState('Error loading QBO expenses: ' + err.message);
    }
  }

  function renderQBOExpensesTable() {
    if (!qboExpenses || qboExpenses.length === 0) {
      showEmptyState('No QBO expenses found for this project.');
      return;
    }

    hideEmptyState();

    // Apply filters (reuse existing filter logic)
    const displayExpenses = applyFiltersToQBO(qboExpenses);

    // Set QBO-specific headers
    const qboHeaders = `
      <tr>
        <th>DATE</th>
        <th>TXN ID</th>
        <th>LINE #</th>
        <th>DESCRIPTION</th>
        <th>ACCOUNT</th>
        <th>TYPE</th>
        <th>VENDOR</th>
        <th>PAYMENT</th>
        <th style="text-align: right;">AMOUNT</th>
      </tr>
    `;
    if (els.expensesTableHead) {
      els.expensesTableHead.innerHTML = qboHeaders;
    }

    // Render rows
    const rows = displayExpenses.map(exp => renderQBORow(exp)).join('');

    // Calculate total (use signed_amount for correct sign handling)
    const total = displayExpenses.reduce((sum, exp) => {
      const amt = exp.signed_amount !== undefined ? exp.signed_amount : (exp.amount || 0);
      return sum + parseFloat(amt);
    }, 0);
    const totalRow = `
      <tr class="table-total-row">
        <td colspan="8" style="text-align: right; font-weight: 600;">Total:</td>
        <td style="font-weight: 700; color: #22c55e;">${formatCurrency(total)}</td>
      </tr>
    `;

    els.expensesTableBody.innerHTML = rows + totalRow;
  }

  function renderQBORow(exp) {
    const globalUid = exp.global_line_uid || '';
    const txnDate = exp.txn_date ? new Date(exp.txn_date).toLocaleDateString() : '';
    const amount = exp.signed_amount !== undefined ? exp.signed_amount : (exp.amount || 0);
    const formattedAmount = formatCurrency(Math.abs(amount));
    const amountClass = amount < 0 ? 'color: #ef4444;' : '';

    // Unique line identifier: TxnId-LineId (e.g., "12345-1")
    const lineRef = `${exp.txn_id || ''}-${exp.line_id || '1'}`;

    // QBO columns: DATE | TXN ID | LINE # | DESCRIPTION | ACCOUNT | TYPE | VENDOR | PAYMENT | AMOUNT
    return `
      <tr data-expense-id="${globalUid}" data-source="qbo">
        <td>${txnDate}</td>
        <td><span class="qbo-txn-id">${exp.txn_id || ''}</span></td>
        <td><span class="qbo-line-ref">${lineRef}</span></td>
        <td>${exp.line_description || ''}</td>
        <td>${exp.account_name || ''}</td>
        <td><span class="qbo-txn-type">${exp.txn_type || ''}</span></td>
        <td>${exp.vendor_name || ''}</td>
        <td>${exp.payment_type || ''}</td>
        <td style="text-align: right; ${amountClass}">${formattedAmount}</td>
      </tr>
    `;
  }

  function applyFiltersToQBO(qboExpensesList) {
    // Reuse filter logic from applyFilters() but adapt for QBO field names
    let filtered = [...qboExpensesList];

    // Global search filter
    if (globalSearchTerm) {
      const term = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(exp => {
        const searchFields = [
          exp.txn_date,
          exp.description,
          exp.memo,
          exp.vendor_name,
          exp.account_name,
          exp.payment_type,
          String(exp.amount)
        ];
        return searchFields.some(field =>
          field && String(field).toLowerCase().includes(term)
        );
      });
    }

    // Column filters (adapt field names)
    // Date filter
    if (columnFilters.date?.length > 0) {
      filtered = filtered.filter(exp => {
        const dateStr = exp.txn_date ? new Date(exp.txn_date).toLocaleDateString() : '';
        return columnFilters.date.includes(dateStr);
      });
    }

    // Vendor filter
    if (columnFilters.vendor?.length > 0) {
      filtered = filtered.filter(exp =>
        columnFilters.vendor.includes(exp.vendor_name)
      );
    }

    // Account filter
    if (columnFilters.account?.length > 0) {
      filtered = filtered.filter(exp =>
        columnFilters.account.includes(exp.account_name)
      );
    }

    // Payment filter
    if (columnFilters.payment?.length > 0) {
      filtered = filtered.filter(exp =>
        columnFilters.payment.includes(exp.payment_type)
      );
    }

    return filtered;
  }

  // ================================
  // QBO SYNC
  // ================================
  async function syncQBOExpenses() {
    const apiBase = getApiBase();
    const btnSyncQBO = document.getElementById('btnSyncQBO');
    const originalText = btnSyncQBO?.innerHTML;

    try {
      // Show loading state
      if (btnSyncQBO) {
        btnSyncQBO.disabled = true;
        btnSyncQBO.innerHTML = '<span style="font-size: 14px;">⏳</span> Syncing...';
      }

      // First get the QBO connection status to get realm_id
      const statusResult = await apiJson(`${apiBase}/qbo/status`);
      const connections = statusResult?.connections || [];

      if (connections.length === 0) {
        throw new Error('No QuickBooks connection found. Please connect to QBO first.');
      }

      // Use the first active connection
      const activeConnection = connections.find(c => c.refresh_token_valid) || connections[0];
      const realmId = activeConnection?.realm_id;

      if (!realmId) {
        throw new Error('No valid QuickBooks realm ID found.');
      }

      console.log('[QBO] Syncing expenses from realm:', realmId);

      // Call sync endpoint with realm_id
      const result = await apiJson(`${apiBase}/qbo/sync/${realmId}`, {
        method: 'POST'
      });

      console.log('[QBO] Sync result:', result);

      // Show success message
      const message = result?.message || `Successfully synced ${result?.imported_count || 0} expenses from QuickBooks.`;
      if (window.Toast) {
        Toast.success('QBO Sync Complete', message);
      }

      // Reload QBO expenses for current project
      if (selectedProjectId) {
        await loadQBOExpenses(selectedProjectId);
      }

    } catch (err) {
      console.error('[QBO] Sync error:', err);
      if (window.Toast) {
        Toast.error('Sync Failed', err.message || 'Error syncing QuickBooks data.');
      }
    } finally {
      // Restore button state
      if (btnSyncQBO) {
        btnSyncQBO.disabled = false;
        btnSyncQBO.innerHTML = originalText;
      }
    }
  }

  // ================================
  // QBO PROJECT MAPPING MODAL
  // ================================
  let qboMappings = [];
  let ngmProjectsList = [];

  async function openQBOMappingModal() {
    const apiBase = getApiBase();

    try {
      // Show loading
      const modal = document.getElementById('qboMappingModal');
      if (!modal) {
        createQBOMappingModal();
      }

      document.getElementById('qboMappingModal').classList.remove('hidden');
      document.getElementById('qboMappingContent').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #9ca3af;">
          <div class="spinner" style="margin: 0 auto 16px;"></div>
          Loading QBO customers...
        </div>
      `;

      // Fetch QBO mappings and NGM projects in parallel
      const [mappingsRes, projectsRes] = await Promise.all([
        apiJson(`${apiBase}/qbo/mapping`),
        apiJson(`${apiBase}/projects`)
      ]);

      qboMappings = mappingsRes?.data || [];
      ngmProjectsList = projectsRes?.data || projectsRes || [];

      console.log('[QBO Mapping] Loaded mappings:', qboMappings.length);
      console.log('[QBO Mapping] Loaded NGM projects:', ngmProjectsList.length);

      renderQBOMappingList();

    } catch (err) {
      console.error('[QBO Mapping] Error:', err);
      document.getElementById('qboMappingContent').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          Error loading data: ${err.message}
        </div>
      `;
    }
  }

  function createQBOMappingModal() {
    const modalHtml = `
      <div id="qboMappingModal" class="modal-overlay hidden">
        <div class="qbo-mapping-modal">
          <div class="qbo-mapping-header">
            <h3>QBO Project Mapping</h3>
            <p class="qbo-mapping-subtitle">Match QuickBooks customers to NGM projects</p>
            <button class="qbo-mapping-close" id="btnCloseMappingModal">&times;</button>
          </div>
          <div id="qboMappingContent" class="qbo-mapping-content">
            <!-- Content loaded dynamically -->
          </div>
          <div class="qbo-mapping-footer">
            <button class="btn-secondary" id="btnCancelMapping">Close</button>
            <button class="btn-primary" id="btnSaveQBOMappings">Save Mappings</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Add event listeners
    document.getElementById('btnCloseMappingModal').addEventListener('click', () => {
      document.getElementById('qboMappingModal').classList.add('hidden');
    });
    document.getElementById('btnCancelMapping').addEventListener('click', () => {
      document.getElementById('qboMappingModal').classList.add('hidden');
    });
    document.getElementById('btnSaveQBOMappings').addEventListener('click', () => {
      saveQBOMappings();
    });
  }

  // Fuzzy match helper - find best matching project by name similarity
  function fuzzyMatchProject(qboName, projects) {
    if (!qboName || !projects || projects.length === 0) return null;

    const normalize = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const qboNorm = normalize(qboName);

    let bestMatch = null;
    let bestScore = 0;

    for (const proj of projects) {
      const projNorm = normalize(proj.project_name);

      // Exact match
      if (qboNorm === projNorm) {
        return proj.project_id;
      }

      // Contains match
      if (qboNorm.includes(projNorm) || projNorm.includes(qboNorm)) {
        const score = Math.min(qboNorm.length, projNorm.length) / Math.max(qboNorm.length, projNorm.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = proj.project_id;
        }
      }

      // Word overlap score
      const qboWords = qboNorm.split(/\s+/).filter(w => w.length > 2);
      const projWords = projNorm.split(/\s+/).filter(w => w.length > 2);
      let matchedWords = 0;
      for (const qw of qboWords) {
        for (const pw of projWords) {
          if (qw.includes(pw) || pw.includes(qw)) {
            matchedWords++;
            break;
          }
        }
      }
      if (qboWords.length > 0 && projWords.length > 0) {
        const wordScore = matchedWords / Math.max(qboWords.length, projWords.length);
        if (wordScore > bestScore && wordScore >= 0.5) {
          bestScore = wordScore;
          bestMatch = proj.project_id;
        }
      }
    }

    return bestScore >= 0.4 ? bestMatch : null;
  }

  function renderQBOMappingList() {
    if (qboMappings.length === 0) {
      document.getElementById('qboMappingContent').innerHTML = `
        <div style="text-align: center; padding: 40px; color: #9ca3af;">
          <p>No QBO customers found.</p>
          <p style="font-size: 13px; margin-top: 8px;">Run "Sync QBO" first to import customers from QuickBooks.</p>
        </div>
      `;
      return;
    }

    // Sort: unmapped first, then by name
    const sorted = [...qboMappings].sort((a, b) => {
      if (!a.ngm_project_id && b.ngm_project_id) return -1;
      if (a.ngm_project_id && !b.ngm_project_id) return 1;
      return (a.qbo_customer_name || '').localeCompare(b.qbo_customer_name || '');
    });

    const rows = sorted.map(mapping => {
      const isMapped = !!mapping.ngm_project_id;

      // If not mapped, try fuzzy match
      let selectedProjectId = mapping.ngm_project_id;
      let isSuggested = false;
      if (!selectedProjectId && mapping.qbo_customer_name) {
        const suggestedId = fuzzyMatchProject(mapping.qbo_customer_name, ngmProjectsList);
        if (suggestedId) {
          selectedProjectId = suggestedId;
          isSuggested = true;
        }
      }

      const statusClass = isMapped ? 'mapping-status--mapped' : (isSuggested ? 'mapping-status--suggested' : 'mapping-status--unmapped');
      const statusText = isMapped ? 'Mapped' : (isSuggested ? 'Suggested' : 'Unmapped');

      // Build project dropdown options
      const options = ngmProjectsList.map(proj => {
        const selected = selectedProjectId === proj.project_id ? 'selected' : '';
        return `<option value="${proj.project_id}" ${selected}>${proj.project_name}</option>`;
      }).join('');

      return `
        <div class="qbo-mapping-row" data-qbo-id="${mapping.qbo_customer_id}">
          <div class="qbo-mapping-info">
            <span class="qbo-mapping-name">${mapping.qbo_customer_name || 'Unknown'}</span>
            <span class="qbo-mapping-id">${mapping.qbo_customer_id}</span>
          </div>
          <div class="qbo-mapping-arrow">→</div>
          <div class="qbo-mapping-select">
            <select class="qbo-project-select" data-qbo-id="${mapping.qbo_customer_id}">
              <option value="">-- Select NGM Project --</option>
              ${options}
            </select>
          </div>
          <div class="qbo-mapping-status ${statusClass}">${statusText}</div>
        </div>
      `;
    }).join('');

    const unmappedCount = sorted.filter(m => !m.ngm_project_id).length;
    const header = `
      <div class="qbo-mapping-summary">
        <span>${qboMappings.length} QBO customers</span>
        <span class="qbo-mapping-unmapped-count">${unmappedCount} unmapped</span>
      </div>
    `;

    document.getElementById('qboMappingContent').innerHTML = header + `<div class="qbo-mapping-list">${rows}</div>`;
  }

  async function saveQBOMappings() {
    const apiBase = getApiBase();
    const btn = document.getElementById('btnSaveQBOMappings');
    const originalText = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = 'Saving...';

      // Get all selects and their values
      const selects = document.querySelectorAll('.qbo-project-select');
      const updates = [];

      selects.forEach(select => {
        const qboId = select.dataset.qboId;
        const ngmProjectId = select.value || null;

        // Find original mapping
        const original = qboMappings.find(m => m.qbo_customer_id === qboId);

        // Only update if changed
        if (original && original.ngm_project_id !== ngmProjectId) {
          updates.push({ qbo_customer_id: qboId, ngm_project_id: ngmProjectId });
        }
      });

      if (updates.length === 0) {
        Toast.info('No Changes', 'No mappings were changed.');
        return;
      }

      console.log('[QBO Mapping] Saving updates:', updates);

      // Save each mapping
      let saved = 0;
      for (const update of updates) {
        await apiJson(`${apiBase}/qbo/mapping/${update.qbo_customer_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ngm_project_id: update.ngm_project_id })
        });
        saved++;
      }

      Toast.success('Mappings Saved', `Updated ${saved} mapping(s).`);

      // Refresh the list
      await openQBOMappingModal();

      // Reload QBO expenses if a project is selected
      if (selectedProjectId && currentDataSource === 'qbo') {
        await loadQBOExpenses(selectedProjectId);
      }

    } catch (err) {
      console.error('[QBO Mapping] Save error:', err);
      Toast.error('Save Failed', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // ================================
  // RECONCILIATION MODAL - NEW LOGIC
  // Supports 1 QBO invoice -> multiple manual expenses
  // ================================

  // Extended reconciliation state
  let activeReconciliation = {
    isActive: false,
    qboExpense: null,           // The QBO invoice being reconciled
    selectedManualIds: new Set(), // Set of manual expense IDs selected for this QBO
    confirmedMatches: []        // Array of { qbo_expense_id, manual_expense_ids: [], matched_amount }
  };

  async function openReconciliationModal() {
    if (!selectedProjectId) {
      if (window.Toast) {
        Toast.warning('No Project', 'Please select a project first.');
      }
      return;
    }

    const apiBase = getApiBase();

    try {
      showEmptyState('Loading reconciliation data...');

      const isCogs = currentModeConfig.qboParam;
      const [manualRes, qboRes] = await Promise.all([
        apiJson(`${apiBase}/expenses?project=${selectedProjectId}`),
        apiJson(`${apiBase}/qbo/expenses?project=${selectedProjectId}&is_cogs=${isCogs}`)
      ]);

      // Parse responses
      reconciliationData.manualExpenses = Array.isArray(manualRes) ? manualRes : (manualRes?.data || manualRes?.expenses || []);
      reconciliationData.qboExpenses = Array.isArray(qboRes) ? qboRes : (qboRes?.data || qboRes?.expenses || []);

      // Load existing reconciliations
      await loadExistingReconciliations();

      // Reset active reconciliation state
      resetActiveReconciliation();

      // Render tables
      renderReconciliationTables();

      // Setup event listeners for new UI
      setupReconciliationEventListeners();

      // Show modal
      document.getElementById('reconcileModal')?.classList.remove('hidden');

      hideEmptyState();

    } catch (err) {
      console.error('[RECONCILE] Error opening modal:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading reconciliation data.', { details: err.message });
      }
      hideEmptyState();
    }
  }

  async function loadExistingReconciliations() {
    const apiBase = getApiBase();
    try {
      const url = `${apiBase}/expenses/reconciliations?project=${selectedProjectId}`;
      const result = await apiJson(url);

      // Parse existing reconciliations - now supports 1:many format
      const rawData = Array.isArray(result) ? result : (result?.data || []);

      // Convert to our confirmed matches format
      // Expected format from API: { qbo_expense_id, manual_expense_ids: [...] } or legacy { manual_expense_id, qbo_expense_id }
      activeReconciliation.confirmedMatches = [];

      rawData.forEach(item => {
        if (item.manual_expense_ids && Array.isArray(item.manual_expense_ids)) {
          // New format: 1 QBO -> many manual
          activeReconciliation.confirmedMatches.push({
            qbo_expense_id: item.qbo_expense_id,
            manual_expense_ids: item.manual_expense_ids,
            matched_amount: item.matched_amount || 0
          });
        } else if (item.manual_expense_id && item.qbo_expense_id) {
          // Legacy format: 1:1 - convert to new format
          const existingMatch = activeReconciliation.confirmedMatches.find(m => m.qbo_expense_id === item.qbo_expense_id);
          if (existingMatch) {
            existingMatch.manual_expense_ids.push(item.manual_expense_id);
          } else {
            activeReconciliation.confirmedMatches.push({
              qbo_expense_id: item.qbo_expense_id,
              manual_expense_ids: [item.manual_expense_id],
              matched_amount: 0
            });
          }
        }
      });

      console.log('[RECONCILE] Loaded existing matches:', activeReconciliation.confirmedMatches.length);
    } catch (err) {
      console.warn('[RECONCILE] Could not load existing reconciliations:', err);
      activeReconciliation.confirmedMatches = [];
    }
  }

  function resetActiveReconciliation() {
    activeReconciliation.isActive = false;
    activeReconciliation.qboExpense = null;
    activeReconciliation.selectedManualIds = new Set();

    // Hide active panel
    const panel = document.getElementById('activeReconcilePanel');
    if (panel) panel.classList.add('hidden');

    // Enable all checkboxes in manual table
    const selectAllCheckbox = document.getElementById('selectAllManualExpenses');
    if (selectAllCheckbox) selectAllCheckbox.disabled = true;
  }

  function setupReconciliationEventListeners() {
    // Cancel reconcile mode button
    document.getElementById('btnCancelReconcileMode')?.addEventListener('click', () => {
      resetActiveReconciliation();
      renderReconciliationTables();
    });

    // Confirm match button
    document.getElementById('btnConfirmMatch')?.addEventListener('click', () => {
      confirmCurrentMatch();
    });

    // Select all checkbox
    document.getElementById('selectAllManualExpenses')?.addEventListener('change', (e) => {
      handleSelectAllManual(e.target.checked);
    });

    // Save all reconciliations
    document.getElementById('btnSaveReconciliation')?.addEventListener('click', async () => {
      await saveReconciliations();
    });
  }

  function renderReconciliationTables() {
    renderQBOReconciliationTable();
    renderManualReconciliationTable();
    updateReconciliationSummary();
  }

  function renderQBOReconciliationTable() {
    const tbody = document.getElementById('reconcileQBOBody');
    if (!tbody) return;

    // Get IDs of QBO expenses that are already fully matched
    const matchedQBOIds = new Set(activeReconciliation.confirmedMatches.map(m => m.qbo_expense_id));

    const rows = reconciliationData.qboExpenses.map(exp => {
      const isMatched = matchedQBOIds.has(exp.id);
      const isCurrentlyReconciling = activeReconciliation.isActive && activeReconciliation.qboExpense?.id === exp.id;

      let statusBadge, actionButton;

      if (isMatched) {
        const match = activeReconciliation.confirmedMatches.find(m => m.qbo_expense_id === exp.id);
        const matchCount = match?.manual_expense_ids?.length || 0;
        statusBadge = `<span class="reconcile-status-badge reconcile-status-badge--linked">Matched (${matchCount})</span>`;
        actionButton = `<button class="btn-view-match" data-qbo-id="${exp.id}">View</button>`;
      } else if (isCurrentlyReconciling) {
        statusBadge = `<span class="reconcile-status-badge reconcile-status-badge--linked">Matching...</span>`;
        actionButton = `<button class="btn-start-reconcile" disabled>Active</button>`;
      } else {
        statusBadge = `<span class="reconcile-status-badge reconcile-status-badge--pending">Pending</span>`;
        const disabledAttr = activeReconciliation.isActive ? 'disabled' : '';
        actionButton = `<button class="btn-start-reconcile" data-qbo-id="${exp.id}" ${disabledAttr}>Reconcile</button>`;
      }

      const rowClass = isCurrentlyReconciling ? 'qbo-reconciling' : (isMatched ? 'reconcile-row-linked' : '');

      return `
        <tr class="${rowClass}" data-qbo-id="${exp.id}">
          <td>${exp.txn_date ? new Date(exp.txn_date).toLocaleDateString() : ''}</td>
          <td>${exp.description || exp.memo || ''}</td>
          <td>${exp.vendor_name || ''}</td>
          <td style="text-align: right; font-weight: 600;">${formatCurrency(exp.amount)}</td>
          <td>${statusBadge}</td>
          <td>${actionButton}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #6b7280;">No QBO invoices found</td></tr>';

    // Update count
    const countEl = document.getElementById('qboCount');
    if (countEl) countEl.textContent = `${reconciliationData.qboExpenses.length} invoices`;

    // Add click handlers for reconcile buttons
    tbody.querySelectorAll('.btn-start-reconcile:not([disabled])').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qboId = btn.getAttribute('data-qbo-id');
        startReconciliationMode(qboId);
      });
    });

    // Add click handlers for view buttons
    tbody.querySelectorAll('.btn-view-match').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const qboId = btn.getAttribute('data-qbo-id');
        viewMatchDetails(qboId);
      });
    });
  }

  function renderManualReconciliationTable() {
    const tbody = document.getElementById('reconcileManualBody');
    if (!tbody) return;

    // Get all manual expense IDs that are already matched
    const matchedManualIds = new Set();
    activeReconciliation.confirmedMatches.forEach(match => {
      match.manual_expense_ids.forEach(id => matchedManualIds.add(id));
    });

    const rows = reconciliationData.manualExpenses.map(exp => {
      const expId = exp.expense_id || exp.id;
      const isAlreadyMatched = matchedManualIds.has(expId);
      const isSelected = activeReconciliation.selectedManualIds.has(expId);

      let rowClass = '';
      let checkboxDisabled = true;
      let checkboxChecked = false;

      if (isAlreadyMatched) {
        rowClass = 'manual-already-matched';
      } else if (activeReconciliation.isActive) {
        rowClass = isSelected ? 'manual-selected manual-selectable' : 'manual-selectable';
        checkboxDisabled = false;
        checkboxChecked = isSelected;
      }

      const statusBadge = isAlreadyMatched
        ? `<span class="reconcile-status-badge reconcile-status-badge--linked">Matched</span>`
        : `<span class="reconcile-status-badge reconcile-status-badge--pending">Pending</span>`;

      return `
        <tr class="${rowClass}" data-expense-id="${expId}" data-amount="${exp.Amount || exp.amount || 0}">
          <td>
            <input type="checkbox" class="manual-expense-checkbox"
              data-expense-id="${expId}"
              ${checkboxDisabled ? 'disabled' : ''}
              ${checkboxChecked ? 'checked' : ''}>
          </td>
          <td>${exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : ''}</td>
          <td>${exp.LineDescription || exp.description || ''}</td>
          <td>${exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || ''}</td>
          <td style="text-align: right;">${formatCurrency(exp.Amount || exp.amount)}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #6b7280;">No manual expenses found</td></tr>';

    // Update count
    const pendingCount = reconciliationData.manualExpenses.length - matchedManualIds.size;
    const countEl = document.getElementById('manualCount');
    if (countEl) countEl.textContent = `${pendingCount} pending`;

    // Add click handlers for checkboxes
    tbody.querySelectorAll('.manual-expense-checkbox:not([disabled])').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const expId = e.target.getAttribute('data-expense-id');
        toggleManualExpenseSelection(expId, e.target.checked);
      });
    });

    // Add click handlers for rows (only when in reconciliation mode)
    tbody.querySelectorAll('tr.manual-selectable').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger if clicking directly on checkbox
        if (e.target.type === 'checkbox') return;

        const checkbox = row.querySelector('.manual-expense-checkbox');
        if (checkbox && !checkbox.disabled) {
          checkbox.checked = !checkbox.checked;
          const expId = checkbox.getAttribute('data-expense-id');
          toggleManualExpenseSelection(expId, checkbox.checked);
        }
      });
    });

    // Update select all checkbox state
    updateSelectAllCheckboxState();
  }

  function startReconciliationMode(qboId) {
    const qboExpense = reconciliationData.qboExpenses.find(e => e.id === qboId);
    if (!qboExpense) return;

    console.log('[RECONCILE] Starting reconciliation mode for QBO:', qboExpense);

    activeReconciliation.isActive = true;
    activeReconciliation.qboExpense = qboExpense;
    activeReconciliation.selectedManualIds = new Set();

    // Show active panel
    const panel = document.getElementById('activeReconcilePanel');
    if (panel) panel.classList.remove('hidden');

    // Update panel info
    updateActiveReconciliationPanel();

    // Re-render tables to enable manual selection
    renderReconciliationTables();

    // Enable select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllManualExpenses');
    if (selectAllCheckbox) selectAllCheckbox.disabled = false;
  }

  function toggleManualExpenseSelection(expId, isSelected) {
    if (isSelected) {
      activeReconciliation.selectedManualIds.add(expId);
    } else {
      activeReconciliation.selectedManualIds.delete(expId);
    }

    // Update the panel
    updateActiveReconciliationPanel();

    // Update row visual state
    const row = document.querySelector(`tr[data-expense-id="${expId}"]`);
    if (row) {
      if (isSelected) {
        row.classList.add('manual-selected');
      } else {
        row.classList.remove('manual-selected');
      }
    }

    // Update select all checkbox
    updateSelectAllCheckboxState();
  }

  function handleSelectAllManual(selectAll) {
    if (!activeReconciliation.isActive) return;

    // Get all matched manual IDs to exclude
    const matchedManualIds = new Set();
    activeReconciliation.confirmedMatches.forEach(match => {
      match.manual_expense_ids.forEach(id => matchedManualIds.add(id));
    });

    reconciliationData.manualExpenses.forEach(exp => {
      const expId = exp.expense_id || exp.id;
      if (!matchedManualIds.has(expId)) {
        if (selectAll) {
          activeReconciliation.selectedManualIds.add(expId);
        } else {
          activeReconciliation.selectedManualIds.delete(expId);
        }
      }
    });

    // Update panel and re-render
    updateActiveReconciliationPanel();
    renderManualReconciliationTable();
  }

  function updateSelectAllCheckboxState() {
    const selectAllCheckbox = document.getElementById('selectAllManualExpenses');
    if (!selectAllCheckbox || !activeReconciliation.isActive) return;

    // Get all matched manual IDs
    const matchedManualIds = new Set();
    activeReconciliation.confirmedMatches.forEach(match => {
      match.manual_expense_ids.forEach(id => matchedManualIds.add(id));
    });

    // Count available (unmatched) manual expenses
    const availableExpenses = reconciliationData.manualExpenses.filter(exp => {
      const expId = exp.expense_id || exp.id;
      return !matchedManualIds.has(expId);
    });

    const selectedCount = activeReconciliation.selectedManualIds.size;
    const availableCount = availableExpenses.length;

    selectAllCheckbox.checked = selectedCount === availableCount && availableCount > 0;
    selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < availableCount;
  }

  function updateActiveReconciliationPanel() {
    if (!activeReconciliation.isActive || !activeReconciliation.qboExpense) return;

    const qbo = activeReconciliation.qboExpense;
    const qboTotal = parseFloat(qbo.amount) || 0;

    // Calculate matched amount
    let matchedAmount = 0;
    const selectedExpenses = [];

    activeReconciliation.selectedManualIds.forEach(id => {
      const exp = reconciliationData.manualExpenses.find(e => (e.expense_id || e.id) === id);
      if (exp) {
        const amount = parseFloat(exp.Amount || exp.amount) || 0;
        matchedAmount += amount;
        selectedExpenses.push({
          id: id,
          description: exp.LineDescription || exp.description || 'No description',
          amount: amount
        });
      }
    });

    const remainingAmount = qboTotal - matchedAmount;

    // Update panel elements
    document.getElementById('activeQBODescription').textContent = qbo.description || qbo.memo || 'QBO Invoice';
    document.getElementById('activeQBOTotal').textContent = formatCurrency(qboTotal);
    document.getElementById('activeMatchedAmount').textContent = formatCurrency(matchedAmount);
    document.getElementById('activeRemainingAmount').textContent = formatCurrency(Math.abs(remainingAmount));

    // Update remaining amount box styling
    const remainingBox = document.querySelector('.reconcile-amount-remaining');
    if (remainingBox) {
      remainingBox.classList.remove('fully-matched', 'over-matched');
      if (Math.abs(remainingAmount) < 0.01) {
        remainingBox.classList.add('fully-matched');
      } else if (remainingAmount < 0) {
        remainingBox.classList.add('over-matched');
      }
    }

    // Update selected expenses list
    const listEl = document.getElementById('selectedExpensesList');
    if (listEl) {
      if (selectedExpenses.length === 0) {
        listEl.innerHTML = '<span class="no-selection">No expenses selected yet</span>';
      } else {
        listEl.innerHTML = selectedExpenses.map(exp => `
          <div class="selected-expense-chip" data-expense-id="${exp.id}">
            <span class="chip-description">${exp.description.substring(0, 30)}${exp.description.length > 30 ? '...' : ''}</span>
            <span class="chip-amount">${formatCurrency(exp.amount)}</span>
            <button class="chip-remove" data-expense-id="${exp.id}" title="Remove">&times;</button>
          </div>
        `).join('');

        // Add remove handlers
        listEl.querySelectorAll('.chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expId = btn.getAttribute('data-expense-id');
            toggleManualExpenseSelection(expId, false);
            // Update checkbox
            const checkbox = document.querySelector(`.manual-expense-checkbox[data-expense-id="${expId}"]`);
            if (checkbox) checkbox.checked = false;
            renderManualReconciliationTable();
          });
        });
      }
    }

    // Enable/disable confirm button
    const btnConfirm = document.getElementById('btnConfirmMatch');
    if (btnConfirm) {
      btnConfirm.disabled = selectedExpenses.length === 0;
    }
  }

  function confirmCurrentMatch() {
    if (!activeReconciliation.isActive || !activeReconciliation.qboExpense) return;
    if (activeReconciliation.selectedManualIds.size === 0) {
      if (window.Toast) {
        Toast.warning('No Selection', 'Please select at least one manual expense to match.');
      }
      return;
    }

    const qbo = activeReconciliation.qboExpense;

    // Calculate matched amount
    let matchedAmount = 0;
    activeReconciliation.selectedManualIds.forEach(id => {
      const exp = reconciliationData.manualExpenses.find(e => (e.expense_id || e.id) === id);
      if (exp) {
        matchedAmount += parseFloat(exp.Amount || exp.amount) || 0;
      }
    });

    // Add to confirmed matches
    activeReconciliation.confirmedMatches.push({
      qbo_expense_id: qbo.id,
      manual_expense_ids: Array.from(activeReconciliation.selectedManualIds),
      matched_amount: matchedAmount
    });

    console.log('[RECONCILE] Confirmed match:', {
      qbo_id: qbo.id,
      manual_ids: Array.from(activeReconciliation.selectedManualIds),
      amount: matchedAmount
    });

    // Reset active reconciliation
    resetActiveReconciliation();

    // Re-render tables
    renderReconciliationTables();
  }

  function viewMatchDetails(qboId) {
    const match = activeReconciliation.confirmedMatches.find(m => m.qbo_expense_id === qboId);
    if (!match) return;

    const qbo = reconciliationData.qboExpenses.find(e => e.id === qboId);

    let details = `QBO Invoice: ${qbo?.description || qbo?.memo || 'Invoice'}\n`;
    details += `Total: ${formatCurrency(qbo?.amount || 0)}\n\n`;
    details += `Matched Manual Expenses (${match.manual_expense_ids.length}):\n`;

    match.manual_expense_ids.forEach(id => {
      const exp = reconciliationData.manualExpenses.find(e => (e.expense_id || e.id) === id);
      if (exp) {
        details += `  - ${exp.LineDescription || exp.description || 'No description'}: ${formatCurrency(exp.Amount || exp.amount)}\n`;
      }
    });

    details += `\nMatched Amount: ${formatCurrency(match.matched_amount)}`;

    if (window.Toast) {
      Toast.info('Match Details', `QBO Invoice matched with ${match.manual_expense_ids.length} expense(s)`, { details });
    }
  }

  function updateReconciliationSummary() {
    const totalQBO = reconciliationData.qboExpenses.length;
    const totalManual = reconciliationData.manualExpenses.length;
    const matchedQBO = activeReconciliation.confirmedMatches.length;

    // Count matched manual expenses
    const matchedManualIds = new Set();
    activeReconciliation.confirmedMatches.forEach(match => {
      match.manual_expense_ids.forEach(id => matchedManualIds.add(id));
    });

    const pendingQBO = totalQBO - matchedQBO;

    // Update summary elements
    const summaryQBO = document.getElementById('summaryQBOTotal');
    const summaryManual = document.getElementById('summaryManualTotal');
    const summaryReconciled = document.getElementById('summaryReconciled');
    const summaryPending = document.getElementById('summaryPending');

    if (summaryQBO) summaryQBO.textContent = totalQBO;
    if (summaryManual) summaryManual.textContent = totalManual;
    if (summaryReconciled) summaryReconciled.textContent = matchedQBO;
    if (summaryPending) summaryPending.textContent = pendingQBO;
  }

  async function saveReconciliations() {
    if (activeReconciliation.confirmedMatches.length === 0) {
      if (window.Toast) {
        Toast.warning('No Matches', 'No reconciliations to save. Match QBO invoices with manual expenses first.');
      }
      return;
    }

    const apiBase = getApiBase();
    const btnSave = document.getElementById('btnSaveReconciliation');
    const originalText = btnSave?.textContent;

    try {
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
      }

      console.log('[RECONCILE] Saving reconciliations:', activeReconciliation.confirmedMatches);

      const url = `${apiBase}/expenses/reconciliations`;
      const result = await apiJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          reconciliations: activeReconciliation.confirmedMatches
        })
      });

      console.log('[RECONCILE] Save result:', result);

      const totalMatches = activeReconciliation.confirmedMatches.length;
      const totalExpenses = activeReconciliation.confirmedMatches.reduce((sum, m) => sum + m.manual_expense_ids.length, 0);

      if (window.Toast) {
        Toast.success('Reconciliations Saved', `Successfully saved ${totalMatches} reconciliation(s) covering ${totalExpenses} manual expense(s)!`);
      }

      // Close modal and reload data
      closeReconciliationModal();
      if (currentDataSource === 'qbo') {
        await loadQBOExpenses(selectedProjectId);
      } else {
        await loadExpensesByProject(selectedProjectId);
      }

    } catch (err) {
      console.error('[RECONCILE] Save error:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving reconciliations.', { details: err.message });
      }
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = originalText;
      }
    }
  }

  function closeReconciliationModal() {
    document.getElementById('reconcileModal')?.classList.add('hidden');

    // Reset all state
    reconciliationData.manualExpenses = [];
    reconciliationData.qboExpenses = [];
    resetActiveReconciliation();
    activeReconciliation.confirmedMatches = [];
  }

  // ================================
  // HELPER FUNCTIONS
  // ================================
  function getVisibleColumnCount() {
    // Count visible columns based on columnVisibility state
    const baseColumns = ['date', 'bill_id', 'description', 'type', 'vendor', 'payment', 'account', 'amount'];
    const visibleCount = baseColumns.filter(col => {
      return columnVisibility[col] !== false; // Default to visible
    }).length;

    return visibleCount + 1; // +1 for actions/status column
  }

  // ================================
  // FILTER DROPDOWN FUNCTIONS
  // ================================
  function toggleFilterDropdown(column, toggleBtn) {
    if (currentFilterColumn === column && !els.filterDropdown.classList.contains('hidden')) {
      closeFilterDropdown();
      return;
    }

    currentFilterColumn = column;
    tempFilterSelections = {};

    // Get unique values for this column
    const uniqueValues = getUniqueColumnValues(column);

    // Position dropdown below the button (using fixed positioning relative to viewport)
    const rect = toggleBtn.getBoundingClientRect();

    // Calculate position - check if dropdown would go off-screen to the right
    let leftPos = rect.left;
    const dropdownWidth = 260; // matches CSS width
    if (leftPos + dropdownWidth > window.innerWidth) {
      leftPos = window.innerWidth - dropdownWidth - 10; // 10px margin from edge
    }

    els.filterDropdown.style.left = `${leftPos}px`;
    els.filterDropdown.style.top = `${rect.bottom + 4}px`;

    // Populate options
    populateFilterOptions(uniqueValues, column);

    // Show dropdown
    els.filterDropdown.classList.remove('hidden');

    // Update toggle button state
    document.querySelectorAll('.filter-toggle').forEach(btn => btn.classList.remove('active'));
    toggleBtn.classList.add('active');
  }

  function closeFilterDropdown() {
    els.filterDropdown?.classList.add('hidden');
    currentFilterColumn = null;
    tempFilterSelections = {};

    // Update active states
    document.querySelectorAll('.filter-toggle').forEach(btn => {
      const col = btn.dataset.column;
      if (columnFilters[col] && columnFilters[col].length > 0) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function getUniqueColumnValues(column) {
    const values = new Set();

    expenses.forEach(exp => {
      let value;
      switch (column) {
        case 'date':
          value = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
          break;
        case 'bill_id':
          value = exp.bill_id || '—';
          break;
        case 'description':
          value = exp.LineDescription || '—';
          break;
        case 'type':
          value = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '—';
          break;
        case 'vendor':
          value = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
          break;
        case 'payment':
          value = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
          break;
        case 'account':
          value = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '—';
          break;
        case 'auth':
          // Support new 3-state system (pending/auth/review)
          if (exp.status) {
            value = exp.status === 'auth' ? 'Authorized' :
                   exp.status === 'review' ? 'Review' :
                   'Pending';
          } else {
            // Legacy: use auth_status boolean
            const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
            value = isAuthorized ? 'Authorized' : 'Pending';
          }
          break;
      }
      values.add(value);
    });

    return Array.from(values).sort();
  }

  function populateFilterOptions(values, column) {
    const currentFilters = columnFilters[column] || [];

    const optionsHtml = values.map(value => {
      const isChecked = currentFilters.includes(value);
      const checkboxId = `filter-${column}-${value.replace(/[^a-zA-Z0-9]/g, '-')}`;

      return `
        <div class="filter-option">
          <input
            type="checkbox"
            id="${checkboxId}"
            data-value="${value}"
            ${isChecked ? 'checked' : ''}
          />
          <label for="${checkboxId}">${value}</label>
        </div>
      `;
    }).join('');

    els.filterDropdownOptions.innerHTML = optionsHtml;

    // Add change event listeners
    els.filterDropdownOptions.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const value = e.target.dataset.value;
        tempFilterSelections[value] = e.target.checked;
      });
    });
  }

  function filterDropdownOptions(searchText) {
    const options = els.filterDropdownOptions.querySelectorAll('.filter-option');
    const search = searchText.toLowerCase();

    options.forEach(option => {
      const label = option.querySelector('label').textContent.toLowerCase();
      option.style.display = label.includes(search) ? 'flex' : 'none';
    });
  }

  function selectAllFilterOptions() {
    els.filterDropdownOptions.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = true;
      tempFilterSelections[cb.dataset.value] = true;
    });
  }

  function clearFilterSelection() {
    els.filterDropdownOptions.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    tempFilterSelections = {};
  }

  function applyFilterSelection() {
    if (!currentFilterColumn) return;

    // Get all checked values
    const checkedValues = [];
    els.filterDropdownOptions.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      checkedValues.push(cb.dataset.value);
    });

    // Update column filters
    columnFilters[currentFilterColumn] = checkedValues;

    // Re-render table with new filters
    renderExpensesTable();

    // Close dropdown
    closeFilterDropdown();
  }

  // ================================
  // AUTHORIZATION TOGGLE
  // ================================
  let isAuthToggling = false; // Prevent double-clicks

  async function toggleAuth(badgeElement) {
    if (!canAuthorize) {
      console.warn('[AUTH] User does not have permission to authorize');
      return;
    }

    // Prevent double-click issues
    if (isAuthToggling) {
      console.log('[AUTH] Already processing, ignoring click');
      return;
    }

    const expenseId = badgeElement.getAttribute('data-expense-id');
    const currentStatus = badgeElement.getAttribute('data-auth-status') === 'true';
    const newStatus = !currentStatus;

    console.log('[AUTH] Toggling authorization for expense:', expenseId, 'from', currentStatus, 'to', newStatus);

    const apiBase = getApiBase();

    // Store original state for reverting on error
    const originalText = badgeElement.textContent;
    const originalClasses = badgeElement.className;

    try {
      isAuthToggling = true;

      // Show loading state on badge
      badgeElement.textContent = '...';
      badgeElement.style.opacity = '0.6';
      badgeElement.style.pointerEvents = 'none';

      // Update authorization status
      const userId = currentUser.user_id || currentUser.id;
      const newStatusStr = newStatus ? 'auth' : 'pending';
      const response = await apiJson(`${apiBase}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_status: newStatus,
          status: newStatusStr,
          auth_by: newStatus ? userId : null // Record who authorized, clear if un-authorizing
        })
      });

      console.log('[AUTH] Authorization updated:', response);

      // Update local expense data (both status and auth_status to keep in sync)
      const expense = expenses.find(e => String(e.expense_id || e.id) === String(expenseId));
      if (expense) {
        expense.auth_status = newStatus;
        expense.status = newStatusStr;
        expense.auth_by = newStatus ? userId : null;
      }

      // Re-render table to update badge
      renderExpensesTable();

    } catch (error) {
      console.error('[AUTH] Error updating authorization:', error);

      // Revert badge to original state
      badgeElement.textContent = originalText;
      badgeElement.className = originalClasses;
      badgeElement.style.opacity = '';
      badgeElement.style.pointerEvents = '';

      if (window.Toast) {
        Toast.error('Authorization Failed', 'Failed to update authorization status.', { details: error.message });
      }
    } finally {
      isAuthToggling = false;
    }
  }

  // Expose toggleAuth to window for onclick handler
  window.toggleAuth = toggleAuth;

  // ================================
  // AUTO CATEGORIZE & CONSTRUCTION STAGE
  // ================================

  function openConstructionStageModal() {
    const modal = document.getElementById('constructionStageModal');
    const progressDiv = document.getElementById('autoCategorizeProgress');

    if (modal) {
      modal.classList.remove('hidden');
      if (progressDiv) progressDiv.classList.add('hidden');
    }
  }

  function closeConstructionStageModal() {
    const modal = document.getElementById('constructionStageModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  async function handleStageSelection(stage) {
    console.log('[AUTO-CATEGORIZE] Stage selected:', stage);

    const progressDiv = document.getElementById('autoCategorizeProgress');
    const progressText = document.getElementById('autoCategorizeProgressText');

    // Show progress
    if (progressDiv) progressDiv.classList.remove('hidden');
    if (progressText) progressText.textContent = 'Collecting expense data...';

    try {
      // Collect expenses with descriptions
      const rows = els.expenseRowsBody.querySelectorAll('tr');
      const expenses = [];

      rows.forEach((row, index) => {
        const descInput = row.querySelector('.exp-input--desc');
        const description = descInput?.value.trim();

        if (description) {
          expenses.push({
            rowIndex: parseInt(row.dataset.rowIndex),
            description: description
          });
        }
      });

      if (expenses.length === 0) {
        if (window.Toast) {
          Toast.warning('No Data', 'No expenses with descriptions found.');
        }
        closeConstructionStageModal();
        return;
      }

      console.log('[AUTO-CATEGORIZE] Sending to backend:', { stage, expenses });

      // Update progress
      if (progressText) progressText.textContent = `Analyzing ${expenses.length} expense(s)...`;

      const apiBase = getApiBase();

      // Call backend endpoint for categorization
      const response = await apiJson(`${apiBase}/expenses/auto-categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: stage,
          expenses: expenses
        })
      });

      console.log('[AUTO-CATEGORIZE] Response:', response);

      // Update progress
      if (progressText) progressText.textContent = 'Applying categorizations...';

      // Apply categorizations to rows
      if (response.success && response.categorizations) {
        applyCategorizations(response.categorizations);
      }

      // Complete
      if (progressText) progressText.textContent = 'Done!';

      // Close modal after a short delay
      setTimeout(() => {
        closeConstructionStageModal();

        // IMPORTANT: Ensure Save button is enabled and in correct state
        if (els.btnSaveAllExpenses) {
          els.btnSaveAllExpenses.disabled = false;
          els.btnSaveAllExpenses.textContent = 'Save All';
          console.log('[AUTO-CATEGORIZE] Save button reset to enabled state');
        }

        // Show summary
        const summary = getSummary(response.categorizations);
        if (window.Toast) {
          Toast.success('Auto-Categorization Complete', 'Expenses have been categorized.', { details: summary });
        }
      }, 800);

    } catch (error) {
      console.error('[AUTO-CATEGORIZE] Error:', error);
      if (window.Toast) {
        Toast.error('Categorization Failed', 'Error during auto-categorization.', { details: error.message });
      }
      closeConstructionStageModal();

      // IMPORTANT: Ensure Save button is enabled even on error
      if (els.btnSaveAllExpenses) {
        els.btnSaveAllExpenses.disabled = false;
        els.btnSaveAllExpenses.textContent = 'Save All';
      }
    }
  }

  function applyCategorizations(categorizations) {
    categorizations.forEach(cat => {
      const row = els.expenseRowsBody.querySelector(`tr[data-row-index="${cat.rowIndex}"]`);
      if (!row) return;

      console.log('[AUTO-CATEGORIZE] Applying to row', cat.rowIndex, ':', cat);

      // Find account input
      const accountInput = row.querySelector('[data-field="account_id"]');
      if (accountInput && cat.account_id && cat.account_name) {
        // Set the display text and the hidden value
        accountInput.value = cat.account_name;
        accountInput.setAttribute('data-value', cat.account_id);

        // Add visual feedback with confidence badge and warning if present
        addConfidenceBadge(accountInput, cat.confidence, cat.account_name, cat.warning);
      }
    });
  }

  function addConfidenceBadge(inputElement, confidence, accountName, warning) {
    // Remove any existing badge
    const existingBadge = inputElement.parentElement.querySelector('.account-suggestion');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Determine confidence level and icon
    let confidenceLevel, confidenceIcon;
    if (confidence >= 80) {
      confidenceLevel = 'high';
      confidenceIcon = '✓';
    } else if (confidence >= 60) {
      confidenceLevel = 'medium';
      confidenceIcon = '⚠';
    } else {
      confidenceLevel = 'low';
      confidenceIcon = '?';
    }

    // If there's a warning (power tool detection), override to warning style
    if (warning) {
      confidenceLevel = 'warning';
      confidenceIcon = '⚠';
    }

    // Create confidence badge
    const badge = document.createElement('div');
    badge.className = 'account-suggestion';

    if (warning) {
      // Show warning instead of suggested
      badge.innerHTML = `
        <span class="account-suggestion-label account-suggestion-warning">Warning</span>
        <span class="confidence-badge confidence-badge-warning">
          <span class="confidence-badge-icon">${confidenceIcon}</span>
          Power Tool
        </span>
      `;
    } else {
      // Normal suggestion
      badge.innerHTML = `
        <span class="account-suggestion-label">Suggested</span>
        <span class="confidence-badge confidence-badge-${confidenceLevel}">
          <span class="confidence-badge-icon">${confidenceIcon}</span>
          ${confidence}%
        </span>
      `;
    }

    // Insert after input
    inputElement.parentElement.appendChild(badge);
  }

  function getSummary(categorizations) {
    if (!categorizations || categorizations.length === 0) {
      return 'No categorizations applied.';
    }

    const high = categorizations.filter(c => c.confidence >= 80).length;
    const medium = categorizations.filter(c => c.confidence >= 60 && c.confidence < 80).length;
    const low = categorizations.filter(c => c.confidence < 60).length;

    let summary = `Categorized ${categorizations.length} expense(s):\n`;
    if (high > 0) summary += `✓ ${high} high confidence (≥80%)\n`;
    if (medium > 0) summary += `⚠ ${medium} medium confidence (60-79%)\n`;
    if (low > 0) summary += `? ${low} low confidence (<60%) - review needed`;

    return summary;
  }

  // ================================
  // COLUMN VISIBILITY MANAGER
  // ================================
  function initColumnVisibility() {
    // Load saved visibility from localStorage
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (saved) {
      try {
        columnVisibility = JSON.parse(saved);
      } catch (e) {
        console.error('[COLUMN MANAGER] Error parsing saved visibility:', e);
        columnVisibility = {};
      }
    }

    // Set default visibility for columns not in saved state
    COLUMN_CONFIG.forEach(col => {
      if (columnVisibility[col.key] === undefined) {
        columnVisibility[col.key] = col.defaultVisible;
      }
    });

    // Apply initial column visibility
    applyColumnVisibility();

    // Populate column manager modal checkboxes
    populateColumnCheckboxes();
  }

  function populateColumnCheckboxes() {
    if (!els.columnCheckboxes) return;

    const checkboxesHtml = COLUMN_CONFIG.map(col => {
      const isVisible = columnVisibility[col.key];
      return `
        <label class="column-checkbox-item">
          <input type="checkbox" data-column-key="${col.key}" ${isVisible ? 'checked' : ''} />
          <span class="column-checkbox-label">${col.label}</span>
        </label>
      `;
    }).join('');

    els.columnCheckboxes.innerHTML = checkboxesHtml;

    // Add change event listeners
    els.columnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const columnKey = e.target.dataset.columnKey;
        columnVisibility[columnKey] = e.target.checked;
        saveColumnVisibility();
        applyColumnVisibility();
      });
    });
  }

  function applyColumnVisibility() {
    const table = els.expensesTable;
    if (!table) return;

    // Column keys that can be toggled (match CSS classes: col-date, col-description, etc.)
    const toggleableColumns = ['date', 'description', 'type', 'vendor', 'payment', 'account', 'amount', 'receipt', 'auth'];

    // Apply visibility using class selectors
    toggleableColumns.forEach(key => {
      const isVisible = columnVisibility[key] !== false; // Default to visible
      const className = `col-${key}`;

      // Apply to header
      const th = table.querySelector(`thead .${className}`);
      if (th) {
        th.style.display = isVisible ? '' : 'none';
      }

      // Apply to body cells
      const tds = table.querySelectorAll(`tbody .${className}`);
      tds.forEach(td => {
        td.style.display = isVisible ? '' : 'none';
      });
    });

    console.log('[COLUMN MANAGER] Visibility applied:', columnVisibility);
  }

  function saveColumnVisibility() {
    try {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
      console.log('[COLUMN MANAGER] Visibility saved:', columnVisibility);
    } catch (e) {
      console.error('[COLUMN MANAGER] Error saving visibility:', e);
    }
  }

  function resetColumnVisibility() {
    // Reset to defaults
    COLUMN_CONFIG.forEach(col => {
      columnVisibility[col.key] = col.defaultVisible;
    });

    saveColumnVisibility();
    applyColumnVisibility();
    populateColumnCheckboxes();

    console.log('[COLUMN MANAGER] Reset to defaults');
  }

  function openColumnManager() {
    els.columnManagerModal?.classList.remove('hidden');
  }

  function closeColumnManager() {
    els.columnManagerModal?.classList.add('hidden');
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    // Check auth first
    if (!initAuth()) return;

    // Cache DOM elements
    cacheElements();

    // Initialize column visibility
    initColumnVisibility();

    // Setup event listeners
    setupEventListeners();
    setupQBOEventListeners();

    // Load metadata (dropdowns)
    await loadMetaData();

    // Show initial empty state
    showEmptyState(currentModeConfig.emptyMessage);

    // Check for pending budget alerts
    checkPendingBudgetAlerts();

    // Register Arturito copilot handlers
    registerCopilotHandlers();

    // Hide loading overlay
    if (typeof hidePageLoading === 'function') {
      hidePageLoading();
    }
  }

  // ================================
  // BUDGET ALERTS BANNER
  // ================================
  async function checkPendingBudgetAlerts() {
    const banner = document.getElementById('budgetAlertsBanner');
    const countEl = document.getElementById('budgetAlertsCount');
    if (!banner) return;

    try {
      const token = localStorage.getItem('ngmToken');
      const API_BASE = window.API_BASE || 'http://localhost:8000';

      const response = await fetch(`${API_BASE}/budget-alerts/pending/count`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) return;

      const data = await response.json();
      const count = data.count || 0;

      if (count > 0) {
        banner.classList.remove('hidden');
        if (countEl) {
          countEl.textContent = `${count} alert${count !== 1 ? 's' : ''} require acknowledgment`;
        }
      } else {
        banner.classList.add('hidden');
      }
    } catch (err) {
      console.log('[EXPENSES] Error checking pending alerts:', err.message);
      // Silently fail - banner stays hidden
    }
  }

  // ================================
  // ARTURITO COPILOT HANDLERS
  // ================================
  function registerCopilotHandlers() {
    // Check if ArturitoWidget is available
    if (typeof ArturitoWidget === 'undefined' || !ArturitoWidget.registerCopilotHandlers) {
      console.log('[EXPENSES] ArturitoWidget not available, skipping copilot registration');
      return;
    }

    ArturitoWidget.registerCopilotHandlers('expenses.html', {
      // Filter by authorization status
      filterByAuthStatus: (params) => {
        const status = params.status;
        console.log('[EXPENSES COPILOT] filterByAuthStatus:', status);

        // Clear existing auth filter
        columnFilters.auth = [];

        if (status === 'pending') {
          columnFilters.auth = ['Pending'];
        } else if (status === 'authorized') {
          columnFilters.auth = ['Authorized'];
        }
        // status === 'all' leaves the filter empty (shows all)

        renderExpensesTable();
        updateFilterIndicators();

        if (typeof Toast !== 'undefined') {
          const msg = status === 'all' ? 'Mostrando todos los gastos' :
                      status === 'pending' ? 'Mostrando gastos pendientes' :
                      'Mostrando gastos autorizados';
          Toast.success('Filtro aplicado', msg);
        }
      },

      // Filter by project
      filterByProject: (params) => {
        const projectName = params.project_name;
        console.log('[EXPENSES COPILOT] filterByProject:', projectName);

        // Find the project in metadata
        const project = metaData.projects.find(p =>
          p.project_name?.toLowerCase().includes(projectName.toLowerCase())
        );

        if (project && els.projectFilter) {
          els.projectFilter.value = project.project_id;
          loadExpenses(project.project_id);

          if (typeof Toast !== 'undefined') {
            Toast.success('Proyecto seleccionado', project.project_name);
          }
        } else {
          if (typeof Toast !== 'undefined') {
            Toast.error('Proyecto no encontrado', projectName);
          }
        }
      },

      // Filter by vendor
      filterByVendor: (params) => {
        const vendorName = params.vendor_name;
        console.log('[EXPENSES COPILOT] filterByVendor:', vendorName);

        // Find matching vendor values in current expenses
        const matchingVendors = [...new Set(expenses.map(exp => {
          const name = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '';
          return name;
        }).filter(name =>
          name.toLowerCase().includes(vendorName.toLowerCase())
        ))];

        if (matchingVendors.length > 0) {
          columnFilters.vendor = matchingVendors;
          renderExpensesTable();
          updateFilterIndicators();

          if (typeof Toast !== 'undefined') {
            Toast.success('Filtro aplicado', `Vendor: ${matchingVendors[0]}`);
          }
        } else {
          if (typeof Toast !== 'undefined') {
            Toast.error('Vendor no encontrado', vendorName);
          }
        }
      },

      // Filter by date range
      filterByDateRange: (params) => {
        console.log('[EXPENSES COPILOT] filterByDateRange:', params);

        const startDate = params.start_date ? new Date(params.start_date) : null;
        const endDate = params.end_date ? new Date(params.end_date) : null;

        if (startDate && endDate) {
          // Get all unique dates that fall within range
          const matchingDates = [...new Set(expenses.map(exp => {
            if (!exp.TxnDate) return null;
            const expDate = new Date(exp.TxnDate);
            if (expDate >= startDate && expDate <= endDate) {
              return expDate.toLocaleDateString();
            }
            return null;
          }).filter(d => d !== null))];

          columnFilters.date = matchingDates;
          renderExpensesTable();
          updateFilterIndicators();

          if (typeof Toast !== 'undefined') {
            Toast.success('Filtro de fechas aplicado', `${matchingDates.length} fechas`);
          }
        }
      },

      // Clear all filters
      clearFilters: () => {
        console.log('[EXPENSES COPILOT] clearFilters');

        // Reset all column filters
        columnFilters.date = [];
        columnFilters.bill_id = [];
        columnFilters.type = [];
        columnFilters.vendor = [];
        columnFilters.payment = [];
        columnFilters.account = [];
        columnFilters.description = [];
        columnFilters.auth = [];

        // Clear global search
        globalSearchTerm = '';
        if (els.globalSearch) {
          els.globalSearch.value = '';
        }

        renderExpensesTable();
        updateFilterIndicators();

        if (typeof Toast !== 'undefined') {
          Toast.success('Filtros limpiados', '');
        }
      },

      // Sort by column
      sortByColumn: (params) => {
        const column = params.column;
        const direction = params.direction || 'asc';
        console.log('[EXPENSES COPILOT] sortByColumn:', column, direction);

        // Map common column names to expense fields
        const columnMap = {
          'date': 'TxnDate',
          'fecha': 'TxnDate',
          'amount': 'Amount',
          'monto': 'Amount',
          'vendor': 'vendor_name',
          'proveedor': 'vendor_name',
          'bill': 'bill_id',
          'factura': 'bill_id',
        };

        const field = columnMap[column?.toLowerCase()] || 'TxnDate';

        expenses.sort((a, b) => {
          let valA = a[field];
          let valB = b[field];

          // Handle dates
          if (field === 'TxnDate') {
            valA = new Date(valA || 0);
            valB = new Date(valB || 0);
          }

          // Handle numbers
          if (field === 'Amount') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
          }

          // Handle strings
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();

          if (direction === 'desc') {
            return valA > valB ? -1 : valA < valB ? 1 : 0;
          }
          return valA < valB ? -1 : valA > valB ? 1 : 0;
        });

        renderExpensesTable();

        if (typeof Toast !== 'undefined') {
          Toast.success('Ordenado', `Por ${field} ${direction === 'desc' ? 'descendente' : 'ascendente'}`);
        }
      },

      // Expand all bills (in bill view mode)
      expandAllBills: () => {
        console.log('[EXPENSES COPILOT] expandAllBills');

        const expandBtns = document.querySelectorAll('.bill-expand-btn[data-expanded="false"]');
        expandBtns.forEach(btn => btn.click());

        if (typeof Toast !== 'undefined') {
          Toast.success('Expandido', `${expandBtns.length} facturas`);
        }
      },

      // Collapse all bills
      collapseAllBills: () => {
        console.log('[EXPENSES COPILOT] collapseAllBills');

        const collapseBtns = document.querySelectorAll('.bill-expand-btn[data-expanded="true"]');
        collapseBtns.forEach(btn => btn.click());

        if (typeof Toast !== 'undefined') {
          Toast.success('Colapsado', `${collapseBtns.length} facturas`);
        }
      },

      // Search text
      searchText: (params) => {
        const query = params.query;
        console.log('[EXPENSES COPILOT] searchText:', query);

        globalSearchTerm = query || '';

        if (els.globalSearch) {
          els.globalSearch.value = globalSearchTerm;
        }

        renderExpensesTable();

        if (typeof Toast !== 'undefined') {
          Toast.success('Buscando', `"${query}"`);
        }
      },

      // Health check: Detect almost-certain duplicate bills
      healthCheckDuplicateBills: async () => {
        console.log('[EXPENSES COPILOT] healthCheckDuplicateBills');

        // Run the detection
        await detectDuplicateBillNumbers();

        // Build detailed report from the new map structure (keyed by expense_id)
        const issues = [];
        const processedPairs = new Set();

        duplicateBillWarnings.forEach((warning, expenseId) => {
          // Create a unique key for this duplicate pair to avoid double-counting
          const pairKey = [expenseId, warning.relatedTo].sort().join('-');
          if (processedPairs.has(pairKey)) return;
          processedPairs.add(pairKey);

          issues.push({
            type: warning.type,
            confidence: warning.confidence,
            vendor: warning.vendorName,
            bill_id: warning.billId || null,
            amount: warning.amount,
            expense_ids: [expenseId, warning.relatedTo]
          });
        });

        // Return data for Arturito to report
        const exactCount = issues.filter(i => i.type === 'exact').length;
        const strongCount = issues.filter(i => i.type === 'strong').length;
        const likelyCount = issues.filter(i => i.type === 'likely').length;

        const result = {
          total_issues: issues.length,
          exact_duplicates: exactCount,
          strong_matches: strongCount,
          likely_duplicates: likelyCount,
          issues: issues.slice(0, 10), // Limit to first 10
          has_more: issues.length > 10
        };

        // Show visual feedback
        if (issues.length === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.success('Health Check', 'No se encontraron duplicados casi seguros');
          }
        } else {
          let summary = '';
          if (exactCount > 0) summary += `${exactCount} exacto${exactCount > 1 ? 's' : ''}`;
          if (strongCount > 0) summary += `${summary ? ', ' : ''}${strongCount} fuerte${strongCount > 1 ? 's' : ''}`;
          if (likelyCount > 0) summary += `${summary ? ', ' : ''}${likelyCount} probable${likelyCount > 1 ? 's' : ''}`;

          if (typeof Toast !== 'undefined') {
            Toast.warning('Health Check', `Se encontraron ${issues.length} posibles duplicados: ${summary}`);
          }
          // Highlight the problematic rows
          highlightDuplicateBills();
        }

        // Store result for Arturito to read
        window._lastHealthCheckResult = result;
        return result;
      },

      // Get health check summary (for Arturito to read results)
      getHealthCheckSummary: () => {
        return window._lastHealthCheckResult || { total_issues: 0, issues: [] };
      },

      // Filter to show only duplicate expenses
      filterByDuplicates: async () => {
        console.log('[EXPENSES COPILOT] filterByDuplicates');

        // First, run duplicate detection to populate duplicateBillWarnings
        await detectDuplicateBillNumbers();

        // Get all expense IDs that are marked as duplicates
        const duplicateIds = new Set();
        duplicateBillWarnings.forEach((warning, expenseId) => {
          duplicateIds.add(expenseId);
          if (warning.relatedTo) {
            duplicateIds.add(warning.relatedTo);
          }
        });

        if (duplicateIds.size === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.info('Sin duplicados', 'No se encontraron gastos duplicados para filtrar');
          }
          return { filtered: 0, total: allExpenses.length };
        }

        // Apply filter by setting a special duplicate filter
        window._duplicateFilterActive = true;
        window._duplicateIds = duplicateIds;

        // Re-render table with filter
        renderExpensesTable();

        // Highlight the duplicates
        highlightDuplicateBills();

        if (typeof Toast !== 'undefined') {
          Toast.success('Filtrado', `Mostrando ${duplicateIds.size} gastos duplicados`);
        }

        return { filtered: duplicateIds.size, total: allExpenses.length };
      },

      // Clear duplicate filter
      clearDuplicateFilter: () => {
        console.log('[EXPENSES COPILOT] clearDuplicateFilter');
        window._duplicateFilterActive = false;
        window._duplicateIds = null;
        renderExpensesTable();

        if (typeof Toast !== 'undefined') {
          Toast.info('Filtro limpiado', 'Mostrando todos los gastos');
        }
      },
    });

    console.log('[EXPENSES] Arturito copilot handlers registered');
  }

  function updateFilterIndicators() {
    // Update any visual indicators for active filters
    // This is a helper to show the user which filters are active
    const hasFilters = Object.values(columnFilters).some(f => f.length > 0) || globalSearchTerm;
    const filterIndicator = document.getElementById('filterIndicator');
    if (filterIndicator) {
      filterIndicator.style.display = hasFilters ? 'inline-flex' : 'none';
    }
  }

  // ================================
  // ARTURITO COMMAND INTERFACE
  // Exposed functions for Arturito to control filters
  // ================================

  /**
   * Filter expenses by a specific column and value
   * @param {string} column - Column name: 'bill_id', 'vendor', 'date', 'type', 'payment', 'account', 'description', 'auth'
   * @param {string|string[]} values - Value(s) to filter by
   */
  function arturitoFilterBy(column, values) {
    const validColumns = ['date', 'bill_id', 'type', 'vendor', 'payment', 'account', 'description', 'auth'];

    if (!validColumns.includes(column)) {
      console.warn(`[ARTURITO] Invalid filter column: ${column}. Valid columns: ${validColumns.join(', ')}`);
      return { success: false, message: `Columna inválida: ${column}` };
    }

    // Ensure values is an array
    const filterValues = Array.isArray(values) ? values : [values];

    // Apply filter
    columnFilters[column] = filterValues.map(v => String(v));

    // Re-render table
    renderExpensesTable();

    console.log(`[ARTURITO] Filter applied: ${column} = ${filterValues.join(', ')}`);
    return {
      success: true,
      message: `Filtro aplicado: ${column} = ${filterValues.join(', ')}`,
      activeFilters: getActiveFilters()
    };
  }

  /**
   * Clear all filters
   */
  function arturitoClearAllFilters() {
    // Reset all column filters
    columnFilters = {
      date: [],
      bill_id: [],
      type: [],
      vendor: [],
      payment: [],
      account: [],
      description: [],
      auth: []
    };

    // Clear global search
    globalSearchTerm = '';
    const searchInput = document.querySelector('.global-search-input');
    if (searchInput) searchInput.value = '';

    // Re-render table
    renderExpensesTable();

    console.log('[ARTURITO] All filters cleared');
    return { success: true, message: 'Todos los filtros han sido eliminados' };
  }

  /**
   * Clear a specific column filter
   */
  function arturitoClearFilter(column) {
    if (columnFilters.hasOwnProperty(column)) {
      columnFilters[column] = [];
      renderExpensesTable();
      console.log(`[ARTURITO] Filter cleared: ${column}`);
      return { success: true, message: `Filtro eliminado: ${column}` };
    }
    return { success: false, message: `Columna no encontrada: ${column}` };
  }

  /**
   * Get current active filters
   */
  function getActiveFilters() {
    const active = {};
    Object.entries(columnFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        active[key] = values;
      }
    });
    if (globalSearchTerm) {
      active.search = globalSearchTerm;
    }
    return active;
  }

  /**
   * Search expenses globally
   */
  function arturitoSearch(term) {
    globalSearchTerm = term || '';
    const searchInput = document.querySelector('.global-search-input');
    if (searchInput) searchInput.value = term;
    renderExpensesTable();
    console.log(`[ARTURITO] Search applied: "${term}"`);
    return { success: true, message: `Búsqueda: "${term}"` };
  }

  /**
   * Get expenses summary for Arturito
   */
  function arturitoGetSummary() {
    const total = expenses.length;
    const filtered = filteredExpenses.length;
    const hasFilters = Object.values(columnFilters).some(f => f.length > 0) || globalSearchTerm;
    const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.Amount) || 0), 0);
    const filteredAmount = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.Amount) || 0), 0);

    return {
      totalExpenses: total,
      filteredExpenses: hasFilters ? filtered : total,
      totalAmount: totalAmount,
      filteredAmount: hasFilters ? filteredAmount : totalAmount,
      activeFilters: getActiveFilters(),
      selectedProject: selectedProjectId
    };
  }

  // Expose Arturito interface to window
  window.ExpensesArturito = {
    filterBy: arturitoFilterBy,
    clearAllFilters: arturitoClearAllFilters,
    clearFilter: arturitoClearFilter,
    search: arturitoSearch,
    getSummary: arturitoGetSummary,
    getActiveFilters: getActiveFilters
  };

  console.log('[EXPENSES] Arturito interface exposed as window.ExpensesArturito');

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
