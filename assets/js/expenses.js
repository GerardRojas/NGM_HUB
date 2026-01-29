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

  // QBO Integration State
  let currentDataSource = 'manual';  // 'manual' or 'qbo'
  let qboExpenses = [];              // QBO expenses for current project
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
    els.expensesTableBody = document.getElementById('expensesTableBody');
    els.expensesEmptyState = document.getElementById('expensesEmptyState');
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

    // Column manager modal
    els.btnColumnManager = document.getElementById('btnColumnManager');
    els.columnManagerModal = document.getElementById('columnManagerModal');
    els.btnCloseColumnManager = document.getElementById('btnCloseColumnManager');
    els.btnCloseColumnManagerFooter = document.getElementById('btnCloseColumnManagerFooter');
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
  function formatCurrency(value) {
    if (value === null || value === undefined || value === '') return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
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
      metaData.accounts = meta.accounts || [];

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
      showEmptyState('Select a project to view expenses');
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
      detectDuplicateBillNumbers();

      if (expenses.length === 0) {
        showEmptyState(projectId === 'all' ? 'No expenses found' : 'No expenses found for this project');
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
  // DUPLICATE BILL NUMBER DETECTION
  // ================================
  // Stores bill_id -> { vendor_id, vendor_name, expense_id }[] for quick lookup
  let duplicateBillWarnings = new Map();

  /**
   * Detects expenses with same bill_id but different vendor_id
   * Stores results in duplicateBillWarnings for display
   */
  function detectDuplicateBillNumbers() {
    duplicateBillWarnings.clear();

    // Group expenses by bill_id
    const billGroups = new Map();

    expenses.forEach(exp => {
      const billId = exp.bill_id?.trim();
      if (!billId) return;

      if (!billGroups.has(billId)) {
        billGroups.set(billId, []);
      }
      billGroups.get(billId).push({
        expense_id: exp.expense_id || exp.id,
        vendor_id: exp.vendor_id,
        vendor_name: exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || 'Unknown'
      });
    });

    // Find bills with different vendors
    billGroups.forEach((exps, billId) => {
      const uniqueVendors = new Set(exps.map(e => e.vendor_id).filter(v => v));
      if (uniqueVendors.size > 1) {
        duplicateBillWarnings.set(billId, exps);
        console.warn(`[EXPENSES] Duplicate bill warning: Bill #${billId} has ${uniqueVendors.size} different vendors`);
      }
    });

    // Show toast if duplicates found
    if (duplicateBillWarnings.size > 0) {
      const billList = Array.from(duplicateBillWarnings.keys()).slice(0, 5).join(', ');
      const moreCount = duplicateBillWarnings.size > 5 ? ` and ${duplicateBillWarnings.size - 5} more` : '';
      if (window.Toast) {
        Toast.warning(
          'Duplicate Bill Numbers Detected',
          `Bills with same number but different vendors: ${billList}${moreCount}. Check highlighted rows.`
        );
      }
    }
  }

  /**
   * Checks if a bill_id exists with a different vendor
   * @param {string} billId - The bill number to check
   * @param {string} vendorId - The vendor ID for the new expense
   * @returns {object|null} - Returns conflict info or null
   */
  function checkBillVendorConflict(billId, vendorId) {
    if (!billId?.trim() || !vendorId) return null;

    const trimmedBillId = billId.trim();

    // Check in current expenses
    const existingWithBill = expenses.filter(exp =>
      exp.bill_id?.trim() === trimmedBillId && exp.vendor_id && exp.vendor_id !== vendorId
    );

    if (existingWithBill.length > 0) {
      const conflictVendor = existingWithBill[0];
      return {
        billId: trimmedBillId,
        existingVendorId: conflictVendor.vendor_id,
        existingVendorName: conflictVendor.vendor_name || findMetaName('vendors', conflictVendor.vendor_id, 'id', 'vendor_name') || 'Unknown'
      };
    }

    return null;
  }

  /**
   * Highlights rows in the table that have duplicate bill warnings
   */
  function highlightDuplicateBills() {
    // Remove existing highlights
    document.querySelectorAll('.expense-row-duplicate-warning').forEach(row => {
      row.classList.remove('expense-row-duplicate-warning');
    });

    // Add highlights to rows with duplicate bills
    duplicateBillWarnings.forEach((vendors, billId) => {
      // Find all rows with this bill_id
      document.querySelectorAll(`[data-bill-id="${billId}"]`).forEach(row => {
        row.classList.add('expense-row-duplicate-warning');
      });
      // Also try by text content in bill column
      document.querySelectorAll('.expense-row').forEach(row => {
        const billCell = row.querySelector('[data-column="bill_id"]');
        if (billCell && billCell.textContent.trim() === billId) {
          row.classList.add('expense-row-duplicate-warning');
        }
      });
    });
  }

  // ================================
  // RENDER EXPENSES TABLE
  // ================================
  function showEmptyState(message) {
    if (els.expensesEmptyState) {
      els.expensesEmptyState.querySelector('.expenses-empty-text').textContent = message;
      els.expensesEmptyState.style.display = 'flex';
    }
    if (els.expensesTable) {
      els.expensesTable.style.display = 'none';
    }
  }

  function applyFilters() {
    filteredExpenses = expenses.filter(exp => {
      // Global search filter (searches across all fields)
      if (globalSearchTerm) {
        const searchLower = globalSearchTerm.toLowerCase();
        const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '';
        const billId = exp.bill_id || '';
        const description = exp.LineDescription || '';
        const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '';
        const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '';
        const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '';
        const account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '';
        const amount = exp.Amount ? String(exp.Amount) : '';

        const matchesSearch =
          date.toLowerCase().includes(searchLower) ||
          billId.toLowerCase().includes(searchLower) ||
          description.toLowerCase().includes(searchLower) ||
          type.toLowerCase().includes(searchLower) ||
          vendor.toLowerCase().includes(searchLower) ||
          payment.toLowerCase().includes(searchLower) ||
          account.toLowerCase().includes(searchLower) ||
          amount.includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Date filter
      if (columnFilters.date.length > 0) {
        const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
        if (!columnFilters.date.includes(date)) return false;
      }

      // Bill ID filter
      if (columnFilters.bill_id.length > 0) {
        const billId = exp.bill_id || '—';
        if (!columnFilters.bill_id.includes(billId)) return false;
      }

      // Type filter
      if (columnFilters.type.length > 0) {
        const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '—';
        if (!columnFilters.type.includes(type)) return false;
      }

      // Vendor filter
      if (columnFilters.vendor.length > 0) {
        const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
        if (!columnFilters.vendor.includes(vendor)) return false;
      }

      // Payment filter
      if (columnFilters.payment.length > 0) {
        const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
        if (!columnFilters.payment.includes(payment)) return false;
      }

      // Account filter
      if (columnFilters.account.length > 0) {
        const account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '—';
        if (!columnFilters.account.includes(account)) return false;
      }

      // Description filter
      if (columnFilters.description.length > 0) {
        const desc = exp.LineDescription || '—';
        if (!columnFilters.description.includes(desc)) return false;
      }

      // Authorization filter
      if (columnFilters.auth.length > 0) {
        const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
        const authValue = isAuthorized ? 'Authorized' : 'Pending';
        if (!columnFilters.auth.includes(authValue)) return false;
      }

      return true;
    });
  }

  function renderExpensesTable() {
    if (!els.expensesTableBody) return;

    if (expenses.length === 0) {
      showEmptyState('No expenses found');
      return;
    }

    // Apply filters
    applyFilters();

    // Hide empty state, show table
    if (els.expensesEmptyState) els.expensesEmptyState.style.display = 'none';
    if (els.expensesTable) els.expensesTable.style.display = 'table';

    // Use Bill View if active and not in edit mode
    if (isBillViewMode && !isEditMode) {
      renderBillViewTable();
      return;
    }

    const displayExpenses = filteredExpenses.length > 0 || Object.values(columnFilters).some(f => f) ? filteredExpenses : expenses;

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

    // Check for duplicate bill number warning
    const hasDuplicateBillWarning = billIdRaw && duplicateBillWarnings.has(billIdRaw.trim());
    let billDisplayHtml = billId;
    let rowWarningClass = '';

    if (hasDuplicateBillWarning) {
      const conflictInfo = duplicateBillWarnings.get(billIdRaw.trim());
      const vendorNames = [...new Set(conflictInfo.map(c => c.vendor_name))].join(', ');
      billDisplayHtml = `<span class="bill-warning-badge" title="Multiple vendors for this bill: ${vendorNames}">⚠️ ${billId}</span>`;
      rowWarningClass = ' expense-row-warning';
    }

    // Receipt icon - check bills table first, then expense (legacy)
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<a href="${receiptUrl}" target="_blank" class="receipt-icon-btn receipt-icon-btn--has-receipt" title="View receipt" onclick="event.stopPropagation()">📎</a>`
      : `<span class="receipt-icon-btn" title="No receipt">📎</span>`;

    // Authorization badge
    const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
    const authBadgeClass = isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending';
    const authBadgeText = isAuthorized ? '✓ Auth' : '⏳ Pending';
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
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<a href="${receiptUrl}" target="_blank" class="receipt-icon-btn receipt-icon-btn--has-receipt" title="View receipt">📎</a>`
      : `<span class="receipt-icon-btn" title="No receipt">📎</span>`;

    // Authorization badge (not editable in bulk edit mode)
    const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
    const authBadgeClass = isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending';
    const authBadgeText = isAuthorized ? '✓ Auth' : '⏳ Pending';
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

  function findMetaName(category, value, valueKey, textKey) {
    if (!value) return null;
    const item = metaData[category]?.find(i => String(i[valueKey]) === String(value));
    return item ? item[textKey] : null;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
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

    try {
      await apiJson(`${apiBase}/expenses/${expenseId}`, {
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

    try {
      // Use Promise.allSettled to handle individual failures without stopping others
      const deletePromises = Array.from(selectedExpenseIds).map(expenseId =>
        apiJson(`${apiBase}/expenses/${expenseId}`, { method: 'DELETE' })
          .then(() => ({ expenseId, success: true }))
          .catch(err => ({ expenseId, success: false, error: err.message }))
      );

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

      // Validate required fields
      if (rowData.TxnDate && rowData.Amount) {
        expensesToSave.push(rowData);
      }
    });

    // ============================================
    // VALIDATION: Reject expenses for closed bills
    // ============================================
    const closedBillErrors = [];
    expensesToSave.forEach((expense, idx) => {
      if (expense.bill_id) {
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
    // WARNING: Duplicate bill numbers with different vendors
    // ============================================
    const billVendorConflicts = [];
    expensesToSave.forEach((expense, idx) => {
      if (expense.bill_id && expense.vendor_id) {
        const conflict = checkBillVendorConflict(expense.bill_id, expense.vendor_id);
        if (conflict) {
          // Get the new vendor name
          const newVendorName = findMetaName('vendors', expense.vendor_id, 'id', 'vendor_name') || 'Unknown';
          billVendorConflicts.push({
            row: idx + 1,
            billId: conflict.billId,
            existingVendor: conflict.existingVendorName,
            newVendor: newVendorName
          });
        }
      }
    });

    if (billVendorConflicts.length > 0) {
      const conflictDetails = billVendorConflicts.map(c =>
        `Row ${c.row}: Bill #${c.billId} - existing vendor: "${c.existingVendor}", new vendor: "${c.newVendor}"`
      ).join('\n');

      // Show warning but allow user to proceed
      if (window.Toast) {
        Toast.warning(
          'Duplicate Bill Number Alert',
          `${billVendorConflicts.length} expense(s) have the same bill number as existing expenses but with different vendors. This may indicate a duplicate bill.`,
          { details: conflictDetails, duration: 8000 }
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

    // Handle authorization checkbox (only show for authorized roles)
    console.log('[EXPENSES] Opening modal - canAuthorize:', canAuthorize);
    console.log('[EXPENSES] Auth container element exists:', !!els.singleExpenseAuthContainer);
    console.log('[EXPENSES] Current expense auth_status:', expense.auth_status);

    if (canAuthorize && els.singleExpenseAuthContainer) {
      console.log('[EXPENSES] Showing authorization checkbox');
      els.singleExpenseAuthContainer.style.display = 'block';
      els.singleExpenseAuthStatus.checked = expense.auth_status === true || expense.auth_status === 1;
      els.singleExpenseAuthStatus.disabled = false;
    } else {
      console.log('[EXPENSES] Hiding authorization checkbox - canAuthorize:', canAuthorize);
      els.singleExpenseAuthContainer.style.display = 'none';
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

    // Include authorization fields if user has permission
    if (canAuthorize && els.singleExpenseAuthStatus) {
      updatedData.auth_status = els.singleExpenseAuthStatus.checked;
      updatedData.auth_by = els.singleExpenseAuthStatus.checked ? (currentUser.user_id || currentUser.id) : null;
    }

    console.log('[EXPENSES] Saving single expense:', expenseId, updatedData);

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

    // Check for duplicate bill number with different vendor
    if (newBillId && updatedData.vendor_id) {
      // Exclude current expense from the check
      const originalExpenses = expenses;
      const tempExpenses = expenses.filter(exp =>
        (exp.expense_id || exp.id) !== expenseId
      );
      expenses = tempExpenses;

      const conflict = checkBillVendorConflict(newBillId, updatedData.vendor_id);

      expenses = originalExpenses; // Restore

      if (conflict) {
        const newVendorName = findMetaName('vendors', updatedData.vendor_id, 'id', 'vendor_name') || 'Unknown';
        if (window.Toast) {
          Toast.warning(
            'Duplicate Bill Number Alert',
            `Bill #${newBillId} already exists with vendor "${conflict.existingVendorName}". You are assigning it to "${newVendorName}". This may indicate a duplicate bill.`,
            { duration: 8000 }
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
          Toast.success('Receipt Scanned', `Successfully scanned ${result.count} expense(s) from receipt!`, { details: details || null });
        } else {
          Toast.warning('Receipt Scanned', `Scanned ${result.count} expense(s) but totals do not match.`, { details });
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

      // Populate amount
      if (expense.amount) {
        const amountInput = row.querySelector('[data-field="Amount"]');
        console.log('[POPULATE] Looking for amount input, found:', !!amountInput);
        if (amountInput) {
          amountInput.value = expense.amount;
          console.log('[POPULATE] ✓ Set amount:', expense.amount);
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

      // Load expenses for selected project
      await loadExpensesByProject(selectedProjectId);

      // Enable edit button and bill view if we have expenses
      // Edit mode disabled for "all" projects view
      els.btnEditExpenses.disabled = !selectedProjectId || expenses.length === 0 || isAllProjects;
      els.btnBillView.disabled = !selectedProjectId || expenses.length === 0;
    });

    // Global search input
    els.searchInput?.addEventListener('input', (e) => {
      globalSearchTerm = e.target.value.trim();
      console.log('[EXPENSES] Global search:', globalSearchTerm);
      renderExpensesTable();
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
    const receiptUrl = getExpenseReceiptUrl(exp);
    const hasReceipt = !!receiptUrl;
    const receiptIcon = hasReceipt
      ? `<a href="${receiptUrl}" target="_blank" class="receipt-icon-btn receipt-icon-btn--has-receipt" title="View receipt" onclick="event.stopPropagation()">📎</a>`
      : `<span class="receipt-icon-btn" title="No receipt">📎</span>`;

    const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
    const authBadgeClass = isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending';
    const authBadgeText = isAuthorized ? '✓ Auth' : '⏳ Pending';
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
  async function switchDataSource(source) {
    if (source === currentDataSource) return; // Already on this source

    currentDataSource = source;

    // Update button states
    const btnManual = document.getElementById('btnSourceManual');
    const btnQBO = document.getElementById('btnSourceQBO');
    const btnSyncQBO = document.getElementById('btnSyncQBO');
    const btnAdd = document.getElementById('btnAddExpense');
    const btnEdit = document.getElementById('btnEditExpenses');
    const btnReconcile = document.getElementById('btnReconcile');

    if (source === 'manual') {
      btnManual?.classList.add('active');
      btnQBO?.classList.remove('active');
      btnSyncQBO?.classList.add('hidden');
      btnAdd?.removeAttribute('disabled');
      btnEdit?.removeAttribute('disabled');
      btnReconcile?.removeAttribute('disabled');
    } else {
      btnManual?.classList.remove('active');
      btnQBO?.classList.add('active');
      btnSyncQBO?.classList.remove('hidden');
      btnAdd?.setAttribute('disabled', 'true');
      btnEdit?.setAttribute('disabled', 'true');
      btnReconcile?.removeAttribute('disabled'); // Can still reconcile from QBO view
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
      showEmptyState('Select a project to view QBO expenses...');
      return;
    }

    try {
      showEmptyState('Loading QBO expenses...');
      const url = `${apiBase}/expenses/qbo?project=${projectId}`;
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

    // Render rows
    const rows = displayExpenses.map(exp => renderQBORow(exp)).join('');

    // Calculate total
    const total = displayExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const totalRow = `
      <tr class="table-total-row">
        <td colspan="${getVisibleColumnCount() - 1}" style="text-align: right; font-weight: 600;">Total:</td>
        <td style="font-weight: 700; color: #22c55e;">$${formatCurrency(total)}</td>
        <td></td>
      </tr>
    `;

    els.expensesTableBody.innerHTML = rows + totalRow;
    applyColumnVisibility(); // Apply column hiding
  }

  function renderQBORow(exp) {
    const expenseId = exp.id;
    const txnDate = exp.txn_date ? new Date(exp.txn_date).toLocaleDateString() : '';
    const amount = exp.amount ? formatCurrency(exp.amount) : '0.00';

    // QBO data is read-only, show reconciliation status badge
    const isReconciled = exp.reconciliation_status === 'matched' || exp.reconciliation_status === 'reviewed';
    const statusClass = isReconciled ? 'reconcile-status-badge--linked' : 'reconcile-status-badge--pending';
    const statusText = isReconciled ? 'Linked' : 'Pending';

    return `
      <tr data-expense-id="${expenseId}" data-source="qbo">
        <td>${txnDate}</td>
        <td>${exp.description || exp.memo || ''}</td>
        <td>${exp.account_name || ''}</td>
        <td>${exp.vendor_name || ''}</td>
        <td>${exp.payment_type || ''}</td>
        <td style="text-align: right;">$${amount}</td>
        <td>
          <span class="reconcile-status-badge ${statusClass}">${statusText}</span>
        </td>
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
    if (!selectedProjectId) {
      if (window.Toast) {
        Toast.warning('No Project', 'Please select a project first.');
      }
      return;
    }

    const btnSyncQBO = document.getElementById('btnSyncQBO');
    const originalText = btnSyncQBO?.innerHTML;

    try {
      // Show loading state
      if (btnSyncQBO) {
        btnSyncQBO.disabled = true;
        btnSyncQBO.innerHTML = '<span style="font-size: 14px;">⏳</span> Syncing...';
      }

      console.log('[QBO] Syncing expenses for project:', selectedProjectId);

      const url = `${apiBase}/expenses/qbo/sync`;
      const result = await apiJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId })
      });

      console.log('[QBO] Sync result:', result);

      // Show success message
      const message = result?.message || `Successfully synced ${result?.count || 0} expenses from QuickBooks.`;
      if (window.Toast) {
        Toast.success('QBO Sync Complete', message);
      }

      // Reload QBO expenses
      await loadQBOExpenses(selectedProjectId);

    } catch (err) {
      console.error('[QBO] Sync error:', err);
      if (window.Toast) {
        Toast.error('Sync Failed', 'Error syncing QuickBooks data.', { details: err.message });
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

    try {
      showEmptyState('Loading reconciliation data...');

      const [manualRes, qboRes] = await Promise.all([
        apiJson(`${apiBase}/expenses?project=${selectedProjectId}`),
        apiJson(`${apiBase}/expenses/qbo?project=${selectedProjectId}`)
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
          <td style="text-align: right; font-weight: 600;">$${formatCurrency(exp.amount)}</td>
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
          <td style="text-align: right;">$${formatCurrency(exp.Amount || exp.amount)}</td>
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
    document.getElementById('activeQBOTotal').textContent = `$${formatCurrency(qboTotal)}`;
    document.getElementById('activeMatchedAmount').textContent = `$${formatCurrency(matchedAmount)}`;
    document.getElementById('activeRemainingAmount').textContent = `$${formatCurrency(Math.abs(remainingAmount))}`;

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
            <span class="chip-amount">$${formatCurrency(exp.amount)}</span>
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
    details += `Total: $${formatCurrency(qbo?.amount || 0)}\n\n`;
    details += `Matched Manual Expenses (${match.manual_expense_ids.length}):\n`;

    match.manual_expense_ids.forEach(id => {
      const exp = reconciliationData.manualExpenses.find(e => (e.expense_id || e.id) === id);
      if (exp) {
        details += `  - ${exp.LineDescription || exp.description || 'No description'}: $${formatCurrency(exp.Amount || exp.amount)}\n`;
      }
    });

    details += `\nMatched Amount: $${formatCurrency(match.matched_amount)}`;

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
          const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
          value = isAuthorized ? 'Authorized' : 'Pending';
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
      const response = await apiJson(`${apiBase}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_status: newStatus,
          auth_by: newStatus ? userId : null // Record who authorized, clear if un-authorizing
        })
      });

      console.log('[AUTH] Authorization updated:', response);

      // Update local expense data
      const expense = expenses.find(e => String(e.expense_id || e.id) === String(expenseId));
      if (expense) {
        expense.auth_status = newStatus;
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
    showEmptyState('Select a project to view expenses');

    // Check for pending budget alerts
    checkPendingBudgetAlerts();

    // Register Arturito copilot handlers
    registerCopilotHandlers();
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

      // Health check: Detect duplicate bill numbers with different vendors
      healthCheckDuplicateBills: () => {
        console.log('[EXPENSES COPILOT] healthCheckDuplicateBills');

        // Run the detection
        detectDuplicateBillNumbers();

        // Build detailed report
        const issues = [];
        duplicateBillWarnings.forEach((vendors, billId) => {
          const vendorNames = [...new Set(vendors.map(v => v.vendor_name))];
          issues.push({
            bill_id: billId,
            vendors: vendorNames,
            count: vendors.length
          });
        });

        // Return data for Arturito to report
        const result = {
          total_issues: issues.length,
          issues: issues.slice(0, 10), // Limit to first 10
          has_more: issues.length > 10
        };

        // Show visual feedback
        if (issues.length === 0) {
          if (typeof Toast !== 'undefined') {
            Toast.success('Health Check', 'No se encontraron bills duplicados con diferentes vendors');
          }
        } else {
          if (typeof Toast !== 'undefined') {
            Toast.warning('Health Check', `Se encontraron ${issues.length} bills con posibles conflictos`);
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

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
