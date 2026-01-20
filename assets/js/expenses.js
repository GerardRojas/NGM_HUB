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
    accounts: []
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
  let currentEditingExpense = null; // Expense being edited in single modal
  let columnFilters = {
    date: [],
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

  // CSV Import State
  let csvParsedData = {
    headers: [],    // Original CSV column names
    rows: []        // Parsed data rows
  };
  let csvColumnMapping = {}; // Maps CSV column index to expense field name

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
    els.expensesTable = document.getElementById('expensesTable');
    els.expensesTableBody = document.getElementById('expensesTableBody');
    els.expensesEmptyState = document.getElementById('expensesEmptyState');
    els.editModeFooter = document.getElementById('editModeFooter');
    els.btnCancelEdit = document.getElementById('btnCancelEdit');
    els.btnSaveChanges = document.getElementById('btnSaveChanges');
    els.btnBulkDelete = document.getElementById('btnBulkDelete');
    els.selectedCount = document.getElementById('selectedCount');
    els.selectAllCheckbox = document.getElementById('selectAllCheckbox');

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

    // Scan Receipt Modal elements
    els.btnScanReceipt = document.getElementById('btnScanReceipt');
    els.scanReceiptModal = document.getElementById('scanReceiptModal');
    els.btnCloseScanReceipt = document.getElementById('btnCloseScanReceipt');
    els.btnCancelScanReceipt = document.getElementById('btnCancelScanReceipt');
    els.scanReceiptFileInput = document.getElementById('scanReceiptFileInput');
    els.scanReceiptDropArea = document.getElementById('scanReceiptDropArea');
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
    const base = window.API_BASE || window.apiBase || '';
    return String(base || '').replace(/\/+$/, '');
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: 'include', ...options });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`${options.method || 'GET'} ${url} failed (${res.status}): ${text}`);
    }
    return text ? JSON.parse(text) : null;
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

      // Populate project filter dropdown
      populateProjectFilter();

    } catch (err) {
      console.error('[EXPENSES] Error loading meta data:', err);
      alert('Error loading data. Please refresh the page.');
    }
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

    // Check if we're in QBO mode, redirect to QBO loading
    if (currentDataSource === 'qbo') {
      await loadQBOExpenses(projectId);
      return;
    }

    const apiBase = getApiBase();

    try {
      showEmptyState('Loading expenses...');

      const url = `${apiBase}/expenses?project=${projectId}`;
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

      if (expenses.length === 0) {
        showEmptyState('No expenses found for this project');
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
        const description = exp.LineDescription || '';
        const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'TnxType_name') || '';
        const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '';
        const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '';
        const account = exp.account_name || findMetaName('accounts', exp.account_id, 'account_id', 'Name') || '';
        const amount = exp.Amount ? String(exp.Amount) : '';

        const matchesSearch =
          date.toLowerCase().includes(searchLower) ||
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

    // Calculate colspan: 6 base columns (Date, Desc, Type, Vendor, Payment, Account) + 1 if edit mode (checkbox)
    const totalColspan = isEditMode ? 7 : 6;

    // Add total row with currency formatting
    // Columns: [Checkbox (edit only)], Date, Desc, Type, Vendor, Payment, Account, Amount, Receipt, Auth, Actions
    const totalRow = `
      <tr class="total-row">
        ${isEditMode ? '<td class="col-checkbox"></td>' : ''}
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
  }

  function renderReadOnlyRow(exp, index) {
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
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

    // Receipt icon - show as active if receipt exists
    const hasReceipt = exp.receipt_url;
    const receiptIcon = hasReceipt
      ? `<a href="${exp.receipt_url}" target="_blank" class="receipt-icon-btn receipt-icon-btn--has-receipt" title="View receipt" onclick="event.stopPropagation()">📎</a>`
      : `<span class="receipt-icon-btn" title="No receipt">📎</span>`;

    // Authorization badge
    const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
    const authBadgeClass = isAuthorized ? 'auth-badge-authorized' : 'auth-badge-pending';
    const authBadgeText = isAuthorized ? '✓ Auth' : '⏳ Pending';
    const authBadgeDisabled = canAuthorize ? '' : ' auth-badge-disabled';
    const authBadge = `<span class="auth-badge ${authBadgeClass}${authBadgeDisabled}"
      data-expense-id="${expenseId}"
      data-auth-status="${isAuthorized}"
      onclick="event.stopPropagation(); ${canAuthorize ? 'window.toggleAuth(this)' : ''}"
      title="${canAuthorize ? 'Click to toggle authorization' : 'You do not have permission to authorize'}">${authBadgeText}</span>`;

    return `
      <tr data-index="${index}" data-id="${expenseId}" class="expense-row-clickable" style="cursor: pointer;">
        <td>${date}</td>
        <td class="col-description">${description}</td>
        <td>${type}</td>
        <td>${vendor}</td>
        <td>${payment}</td>
        <td>${account}</td>
        <td class="col-amount">${amount}</td>
        <td class="col-receipt">${receiptIcon}</td>
        <td class="col-auth">${authBadge}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditableRow(exp, index) {
    const dateVal = exp.TxnDate ? exp.TxnDate.split('T')[0] : '';

    // Receipt icon - show as active if receipt exists (not editable in table)
    const hasReceipt = exp.receipt_url;
    const receiptIcon = hasReceipt
      ? `<a href="${exp.receipt_url}" target="_blank" class="receipt-icon-btn receipt-icon-btn--has-receipt" title="View receipt">📎</a>`
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
        <td class="editable-cell">
          <input type="date" class="edit-input" data-field="TxnDate" value="${dateVal}">
        </td>
        <td class="col-description editable-cell">
          <input type="text" class="edit-input" data-field="LineDescription" value="${exp.LineDescription || ''}" placeholder="Description...">
        </td>
        <td class="editable-cell">
          ${buildSelectHtml('txn_type', exp.txn_type, metaData.txn_types, 'TnxType_id', 'TnxType_name')}
        </td>
        <td class="editable-cell">
          ${buildSelectHtml('vendor_id', exp.vendor_id, metaData.vendors, 'id', 'vendor_name')}
        </td>
        <td class="editable-cell">
          ${buildSelectHtml('payment_type', exp.payment_type, metaData.payment_methods, 'id', 'payment_method_name')}
        </td>
        <td class="editable-cell">
          ${buildSelectHtml('account_id', exp.account_id, metaData.accounts, 'account_id', 'Name')}
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
      const selectedOption = options.find(opt => opt[valueKey] == selectedValue);
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
    const item = metaData[category]?.find(i => i[valueKey] == value);
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
      // Store original data for rollback
      originalExpenses = JSON.parse(JSON.stringify(expenses));
      els.btnEditExpenses.textContent = 'Editing...';
      els.btnEditExpenses.disabled = true;
      els.btnAddExpense.disabled = true;
      els.projectFilter.disabled = true;
      if (els.editModeFooter) els.editModeFooter.classList.remove('hidden');
      // Add edit mode class to table for wider columns
      if (els.expensesTable) els.expensesTable.classList.add('edit-mode-table');

      // Show checkbox column
      const checkboxHeader = document.querySelector('.col-checkbox');
      if (checkboxHeader) checkboxHeader.style.display = '';

      // Reset selection
      selectedExpenseIds.clear();
      updateBulkDeleteButton();
    } else {
      els.btnEditExpenses.textContent = 'Edit Expenses';
      els.btnEditExpenses.disabled = expenses.length === 0;
      els.btnAddExpense.disabled = !selectedProjectId;
      els.projectFilter.disabled = false;
      if (els.editModeFooter) els.editModeFooter.classList.add('hidden');
      // Remove edit mode class from table
      if (els.expensesTable) els.expensesTable.classList.remove('edit-mode-table');

      // Hide checkbox column
      const checkboxHeader = document.querySelector('.col-checkbox');
      if (checkboxHeader) checkboxHeader.style.display = 'none';

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

    if (updates.length === 0) {
      alert('No changes to save.');
      toggleEditMode(false);
      return;
    }

    // Disable save button
    els.btnSaveChanges.disabled = true;
    els.btnSaveChanges.textContent = 'Saving...';

    try {
      // Send PATCH requests for each update
      for (const update of updates) {
        console.log(`[EDIT] Sending PATCH for expense ${update.id}:`, update.data);
        const response = await apiJson(`${apiBase}/expenses/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });
        console.log(`[EDIT] PATCH response for ${update.id}:`, response);
      }

      alert(`${updates.length} expense(s) updated successfully!`);

      // Reload expenses
      await loadExpensesByProject(selectedProjectId);
      toggleEditMode(false);

    } catch (err) {
      console.error('[EXPENSES] Error saving changes:', err);
      console.error('[EXPENSES] Error stack:', err.stack);
      alert('Error saving changes: ' + err.message);
    } finally {
      els.btnSaveChanges.disabled = false;
      els.btnSaveChanges.textContent = 'Save Changes';
    }
  }

  function hasChanges(original, updated) {
    const fields = ['TxnDate', 'txn_type', 'vendor_id', 'payment_type', 'account_id', 'Amount', 'LineDescription'];
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
      alert('Error deleting expense: ' + err.message);
    }
  }

  async function bulkDeleteExpenses() {
    if (selectedExpenseIds.size === 0) {
      alert('No expenses selected.');
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
      const deletePromises = Array.from(selectedExpenseIds).map(expenseId =>
        apiJson(`${apiBase}/expenses/${expenseId}`, {
          method: 'DELETE'
        })
      );

      await Promise.all(deletePromises);

      console.log(`[BULK_DELETE] Deleted ${selectedExpenseIds.size} expenses`);

      // Remove from local arrays
      selectedExpenseIds.forEach(expenseId => {
        const index = expenses.findIndex(e => (e.expense_id || e.id) === expenseId);
        if (index >= 0) {
          expenses.splice(index, 1);
        }

        const origIndex = originalExpenses.findIndex(e => (e.expense_id || e.id) === expenseId);
        if (origIndex >= 0) {
          originalExpenses.splice(origIndex, 1);
        }
      });

      selectedExpenseIds.clear();
      renderExpensesTable();
      updateBulkDeleteButton();

      alert('Expenses deleted successfully!');

    } catch (err) {
      console.error('[BULK_DELETE] Error:', err);
      alert('Error deleting expenses: ' + err.message);
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
  }

  // ================================
  // ADD EXPENSE MODAL
  // ================================
  function openAddExpenseModal() {
    if (!selectedProjectId) return;

    // Find project name
    const project = metaData.projects.find(p => (p.project_id || p.id) == selectedProjectId);
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

    // Show modal
    els.modal.classList.remove('hidden');
  }

  function closeAddExpenseModal() {
    els.modal.classList.add('hidden');
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;
    currentReceiptFile = null;
    currentReceiptUrl = null;
    scannedReceiptFile = null; // Clear scanned receipt reference
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
      alert('Invalid file type. Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
      return;
    }

    if (file.size > window.ReceiptUpload.MAX_FILE_SIZE) {
      alert('File size too large. Maximum size is 5MB.');
      return;
    }

    // Store file for upload when saving expense
    currentReceiptFile = file;

    // Create temporary preview URL
    const tempUrl = URL.createObjectURL(file);
    currentReceiptUrl = tempUrl;

    // Re-render to show preview
    renderReceiptUploader();
  }

  function handleReceiptDelete() {
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
        <input type="text" class="exp-input exp-input--desc" data-field="LineDescription" placeholder="Description">
      </td>
      <td>
        ${buildModalSelectHtml('txn_type', metaData.txn_types, 'id', 'TnxType_name')}
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

  async function saveAllExpenses() {
    const apiBase = getApiBase();
    const rows = els.expenseRowsBody.querySelectorAll('tr');
    const expensesToSave = [];
    const invalidAccounts = new Set();
    const rowsWithInvalidAccounts = [];

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
            const match = mapping.find(m => m.text === value);
            if (match) {
              value = match.id;
            } else if (value && value.trim() !== '') {
              // Account name doesn't match any existing account
              if (field === 'account_id') {
                invalidAccounts.add(value);
                rowsWithInvalidAccounts.push({ row: rowIdx + 1, accountName: value });
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

    if (expensesToSave.length === 0) {
      alert('Please fill in at least one complete expense row (Date and Amount are required).');
      return;
    }

    // Check for invalid accounts
    if (invalidAccounts.size > 0) {
      const accountsList = Array.from(invalidAccounts).join('\n- ');
      const rowsList = rowsWithInvalidAccounts.map(r => `Row ${r.row}: "${r.accountName}"`).join('\n');

      const message = `The following accounts don't exist in your system:\n\n${rowsList}\n\nWould you like to:\n\n1. Create these accounts automatically\n2. Cancel and select existing accounts`;

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
        alert('Error creating accounts: ' + err.message + '\n\nPlease create accounts manually or select from existing ones.');
        return;
      }
    }

    // Show loading state with animated icon
    els.btnSaveAllExpenses.disabled = true;
    els.btnSaveAllExpenses.innerHTML = '<img src="assets/img/greenblack_icon.png" class="loading-logo loading-logo-sm" alt="Loading..." style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"> Saving expenses...';

    try {
      // Send POST requests for each expense and upload receipts
      const createdExpenses = [];
      for (let i = 0; i < expensesToSave.length; i++) {
        const expenseData = { ...expensesToSave[i] };
        const receiptFile = expenseData._receiptFile;
        const isFromScan = expenseData._fromScannedReceipt;
        delete expenseData._receiptFile; // Remove file from data before sending
        delete expenseData._fromScannedReceipt; // Remove marker from data

        // Create expense
        const created = await apiJson(`${apiBase}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData)
        });
        createdExpenses.push(created);

        // Upload receipt if this row had one
        if (receiptFile && window.ReceiptUpload) {
          try {
            const expenseId = created.id || created.expense_id;
            console.log(`[EXPENSES] Uploading receipt for expense ${expenseId}:`, receiptFile.name);

            // Upload receipt to Supabase Storage
            const receiptUrl = await window.ReceiptUpload.upload(
              receiptFile,
              expenseId,
              selectedProjectId
            );

            console.log('[EXPENSES] Receipt uploaded:', receiptUrl);

            // Update the created expense object to include receipt_url
            created.receipt_url = receiptUrl;

            // Update expense with receipt URL AND at least one other field to avoid "No fields to update" error
            await apiJson(`${apiBase}/expenses/${expenseId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                receipt_url: receiptUrl,
                LineDescription: created.LineDescription || null // Include existing field to ensure at least one field is sent
              })
            });

            console.log('[EXPENSES] Expense updated with receipt URL');
          } catch (uploadErr) {
            console.error('[EXPENSES] Error uploading receipt:', uploadErr);
            // Don't fail the whole save if receipt upload fails
            console.warn('Receipt upload failed for one expense, continuing...');
          }
        }
      }

      alert(`${expensesToSave.length} expense(s) saved successfully!`);

      // Clear scanned receipt file reference
      scannedReceiptFile = null;

      // Close modal and reload expenses
      closeAddExpenseModal();
      await loadExpensesByProject(selectedProjectId);

    } catch (err) {
      console.error('[EXPENSES] Error saving expenses:', err);
      alert('Error saving expenses: ' + err.message);
    } finally {
      els.btnSaveAllExpenses.disabled = false;
      els.btnSaveAllExpenses.textContent = 'Save All';
    }
  }

  // ================================
  // SINGLE EXPENSE EDIT MODAL
  // ================================
  function openSingleExpenseModal(expenseId) {
    // Backend uses 'expense_id' as primary key
    const expense = expenses.find(exp => {
      const id = exp.expense_id || exp.id;
      return id == expenseId;
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
    els.singleExpenseDescription.value = expense.LineDescription || '';
    els.singleExpenseAmount.value = formatCurrency(expense.Amount);

    // Populate dropdowns
    populateSingleExpenseDropdowns();

    // Set selected values - display text, store ID in data-value
    // Type
    const selectedType = metaData.txn_types.find(t => (t.TnxType_id || t.id) == expense.txn_type);
    els.singleExpenseType.value = selectedType ? (selectedType.TnxType_name || selectedType.name || '') : '';
    els.singleExpenseType.setAttribute('data-value', expense.txn_type || '');

    // Vendor
    const selectedVendor = metaData.vendors.find(v => v.id == expense.vendor_id);
    els.singleExpenseVendor.value = selectedVendor ? (selectedVendor.vendor_name || selectedVendor.name || '') : '';
    els.singleExpenseVendor.setAttribute('data-value', expense.vendor_id || '');

    // Payment
    const selectedPayment = metaData.payment_methods.find(p => p.id == expense.payment_type);
    els.singleExpensePayment.value = selectedPayment ? (selectedPayment.payment_method_name || selectedPayment.name || '') : '';
    els.singleExpensePayment.setAttribute('data-value', expense.payment_type || '');

    // Account
    const selectedAccount = metaData.accounts.find(a => a.account_id == expense.account_id);
    els.singleExpenseAccount.value = selectedAccount ? (selectedAccount.Name || selectedAccount.name || '') : '';
    els.singleExpenseAccount.setAttribute('data-value', expense.account_id || '');

    // Handle receipt
    currentReceiptFile = null;
    currentReceiptUrl = expense.receipt_url || null;
    currentReceiptDeleted = false; // Reset deletion flag
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
      const preview = window.ReceiptUpload.createPreview(currentReceiptUrl, handleSingleExpenseReceiptDelete);
      els.singleExpenseReceiptContainer.appendChild(preview);
    } else {
      const uploader = window.ReceiptUpload.createUploader(handleSingleExpenseFileSelected);
      els.singleExpenseReceiptContainer.appendChild(uploader);
    }
  }

  function handleSingleExpenseFileSelected(file) {
    console.log('[EXPENSES] File selected for single expense:', file.name, file.size);

    if (!window.ReceiptUpload.ALLOWED_TYPES.includes(file.type)) {
      alert('Invalid file type. Only images (JPG, PNG, GIF, WebP) and PDFs are allowed.');
      return;
    }

    if (file.size > window.ReceiptUpload.MAX_FILE_SIZE) {
      alert('File size too large. Maximum size is 5MB.');
      return;
    }

    currentReceiptFile = file;
    const tempUrl = URL.createObjectURL(file);
    currentReceiptUrl = tempUrl;
    renderSingleExpenseReceipt();
  }

  function handleSingleExpenseReceiptDelete() {
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

    els.btnSaveSingleExpense.disabled = true;
    els.btnSaveSingleExpense.textContent = 'Saving...';

    try {
      // Handle receipt upload first if new file selected
      if (currentReceiptFile && window.ReceiptUpload) {
        try {
          console.log('[EXPENSES] Uploading new receipt');
          const receiptUrl = await window.ReceiptUpload.upload(
            currentReceiptFile,
            expenseId,
            selectedProjectId
          );

          // Add receipt_url to updatedData so it's included in the main PATCH
          updatedData.receipt_url = receiptUrl;
          console.log('[EXPENSES] Receipt uploaded, will be saved with expense update');
        } catch (uploadErr) {
          console.error('[EXPENSES] Error uploading receipt:', uploadErr);
          alert('Receipt upload failed: ' + uploadErr.message);
          throw uploadErr; // Stop the save if receipt upload fails
        }
      } else if (currentReceiptDeleted) {
        // User explicitly deleted the receipt, set it to null
        updatedData.receipt_url = null;
        console.log('[EXPENSES] Receipt deleted, will be removed from expense');
      }

      // Update expense with all fields including receipt_url if uploaded/deleted
      await apiJson(`${apiBase}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      alert('Expense updated successfully!');
      closeSingleExpenseModal();
      await loadExpensesByProject(selectedProjectId);

    } catch (err) {
      console.error('[EXPENSES] Error updating expense:', err);
      alert('Error updating expense: ' + err.message);
    } finally {
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
  }

  function closeScanReceiptModal() {
    els.scanReceiptModal.classList.add('hidden');
    els.scanReceiptFileInput.value = '';
  }

  async function handleScanReceiptFile(file) {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid file type. Please upload JPG, PNG, WebP, GIF images or PDF files.');
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      alert('File too large. Maximum size is 20MB.');
      return;
    }

    const apiBase = getApiBase();

    try {
      // Show progress
      els.scanReceiptProgress.classList.remove('hidden');
      els.scanReceiptProgressText.textContent = 'Uploading receipt...';
      els.scanReceiptProgressFill.style.width = '30%';

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Call backend to parse receipt
      els.scanReceiptProgressText.textContent = 'Analyzing...';
      els.scanReceiptProgressFill.style.width = '60%';

      const response = await fetch(`${apiBase}/expenses/parse-receipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to parse receipt');
      }

      const result = await response.json();
      console.log('[SCAN RECEIPT] Parse result:', result);

      els.scanReceiptProgressText.textContent = 'Populating expense rows...';
      els.scanReceiptProgressFill.style.width = '90%';

      // Store the scanned receipt file to attach to all generated expenses
      scannedReceiptFile = file;
      console.log('[SCAN RECEIPT] Stored receipt file for later upload:', file.name);

      // Close scan modal
      closeScanReceiptModal();

      // Populate expense rows with parsed data
      if (result.success && result.data && result.data.expenses) {
        await populateExpensesFromScan(result.data.expenses);
      }

      els.scanReceiptProgressFill.style.width = '100%';

      alert(`Successfully scanned ${result.count} expense(s) from receipt!`);

    } catch (error) {
      console.error('[SCAN RECEIPT] Error:', error);
      alert('Error scanning receipt: ' + error.message);
      els.scanReceiptProgress.classList.add('hidden');
    }
  }

  async function populateExpensesFromScan(scannedExpenses) {
    // Clear existing rows
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;

    // Add a row for each scanned expense
    for (const expense of scannedExpenses) {
      addModalRow();

      const index = modalRowCounter - 1;
      const row = els.expenseRowsBody.querySelector(`tr[data-row-index="${index}"]`);

      if (!row) {
        console.warn('[POPULATE] Row not found for index:', index);
        continue;
      }

      console.log('[POPULATE] Filling row', index, 'with:', expense);

      // Populate date
      if (expense.date) {
        const dateInput = row.querySelector('[data-field="TxnDate"]');
        if (dateInput) {
          dateInput.value = expense.date;
          console.log('[POPULATE] Set date:', expense.date);
        }
      }

      // Populate description
      if (expense.description) {
        const descInput = row.querySelector('[data-field="LineDescription"]');
        if (descInput) {
          descInput.value = expense.description;
          console.log('[POPULATE] Set description:', expense.description);
        }
      }

      // Populate amount
      if (expense.amount) {
        const amountInput = row.querySelector('[data-field="Amount"]');
        if (amountInput) {
          amountInput.value = expense.amount;
          console.log('[POPULATE] Set amount:', expense.amount);
        }
      }

      // Try to match vendor
      if (expense.vendor && metaData.vendors) {
        const vendorInput = row.querySelector('[data-field="vendor_id"]');
        if (vendorInput) {
          // Try to find matching vendor (case-insensitive)
          const matchedVendor = metaData.vendors.find(v =>
            v.vendor_name && v.vendor_name.toLowerCase().includes(expense.vendor.toLowerCase())
          );

          if (matchedVendor) {
            vendorInput.value = matchedVendor.vendor_name;
            vendorInput.setAttribute('data-value', matchedVendor.id);
          } else {
            // Just set the text, user can select from dropdown
            vendorInput.value = expense.vendor;
          }
        }
      }

      // Try to match category to transaction type
      if (expense.category && metaData.txn_types) {
        const typeInput = row.querySelector('[data-field="txn_type"]');
        if (typeInput) {
          // Try to find matching type (case-insensitive)
          const matchedType = metaData.txn_types.find(t =>
            t.TnxType_name && (
              t.TnxType_name.toLowerCase().includes(expense.category.toLowerCase()) ||
              expense.category.toLowerCase().includes(t.TnxType_name.toLowerCase())
            )
          );

          if (matchedType) {
            typeInput.value = matchedType.TnxType_name;
            typeInput.setAttribute('data-value', matchedType.TnxType_id);
          }
        }
      }
    }
  }

  // ================================
  // CSV IMPORT
  // ================================

  /**
   * Parses a CSV line respecting quoted fields that may contain commas
   * @param {string} line - CSV line to parse
   * @returns {string[]} - Array of cell values
   */
  function parseCSVLine(line) {
    const cells = [];
    let currentCell = '';
    let insideQuotes = false;

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
      } else {
        // Regular character
        currentCell += char;
      }
    }

    // Add last cell
    cells.push(currentCell.trim());

    return cells;
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
        alert('CSV file must contain at least a header row and one data row.');
        return;
      }

      // Parse headers using proper CSV parsing
      csvParsedData.headers = parseCSVLine(lines[0]);

      // Parse data rows using proper CSV parsing
      csvParsedData.rows = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cells = parseCSVLine(line);
        csvParsedData.rows.push(cells);
      }

      if (csvParsedData.rows.length === 0) {
        alert('No data rows found in CSV file.');
        return;
      }

      console.log('[CSV_IMPORT] Parsed:', csvParsedData.headers.length, 'columns,', csvParsedData.rows.length, 'rows');
      console.log('[CSV_IMPORT] Sample row:', csvParsedData.rows[0]);

      // Open mapping modal
      openCsvMappingModal();

    } catch (err) {
      console.error('[CSV_IMPORT] Error:', err);
      alert('Error reading CSV file: ' + err.message);
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
              } else {
                console.warn('[CSV_MAPPING] Transaction type not found:', cleanedTypeName);
                console.warn('[CSV_MAPPING] Available types:', metaData.txn_types.map(t => t.TnxType_name));
                // Set the cleaned name even if not found
                typeSelect.value = cleanedTypeName;
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
              } else {
                // Fallback: set the cleaned name
                vendorInput.value = cleanedVendorName;
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
              } else {
                console.warn('[CSV_MAPPING] Payment method not found:', cleanedPaymentName);
                // Set the cleaned name even if not found
                paymentSelect.value = cleanedPaymentName;
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
              } else {
                console.warn('[CSV_MAPPING] Account not found:', cleanedAccountName);
                // Set the cleaned name even if not found
                accountSelect.value = cleanedAccountName;
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
      let message = `Successfully imported ${csvParsedData.rows.length} expense(s) from CSV.`;
      if (newVendorsCreated > 0) {
        message += `\n${newVendorsCreated} new vendor(s) were automatically created.`;
      }
      if (newPaymentMethodsCreated > 0) {
        message += `\n${newPaymentMethodsCreated} new payment method(s) were automatically created.`;
      }
      alert(message);

    } catch (err) {
      console.error('[CSV_MAPPING] Error importing:', err);
      alert('Error importing CSV data: ' + err.message);
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
      els.btnAddExpense.disabled = !selectedProjectId;

      // Load expenses for selected project
      await loadExpensesByProject(selectedProjectId);

      // Enable edit button if we have expenses
      els.btnEditExpenses.disabled = !selectedProjectId || expenses.length === 0;
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

    // Reconciliation Modal - Save links button
    document.getElementById('btnSaveReconciliations')?.addEventListener('click', async () => {
      await saveReconciliations();
    });

    // Reconciliation Modal - Table row clicks (event delegation)
    document.getElementById('reconcileManualTableBody')?.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (row && row.hasAttribute('data-expense-id')) {
        handleReconcileRowClick('manual', row);
      }
    });

    document.getElementById('reconcileQBOTableBody')?.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (row && row.hasAttribute('data-expense-id')) {
        handleReconcileRowClick('qbo', row);
      }
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
      alert('Please select a project first.');
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
      alert(message);

      // Reload QBO expenses
      await loadQBOExpenses(selectedProjectId);

    } catch (err) {
      console.error('[QBO] Sync error:', err);
      alert('Error syncing QuickBooks data: ' + err.message);
    } finally {
      // Restore button state
      if (btnSyncQBO) {
        btnSyncQBO.disabled = false;
        btnSyncQBO.innerHTML = originalText;
      }
    }
  }

  // ================================
  // RECONCILIATION MODAL
  // ================================
  async function openReconciliationModal() {
    if (!selectedProjectId) {
      alert('Please select a project first.');
      return;
    }

    try {
      // Load both manual and QBO expenses for reconciliation
      showEmptyState('Loading reconciliation data...');

      const [manualRes, qboRes] = await Promise.all([
        apiJson(`${apiBase}/expenses?project=${selectedProjectId}`),
        apiJson(`${apiBase}/expenses/qbo?project=${selectedProjectId}`)
      ]);

      // Parse responses
      reconciliationData.manualExpenses = Array.isArray(manualRes) ? manualRes : (manualRes?.data || manualRes?.expenses || []);
      reconciliationData.qboExpenses = Array.isArray(qboRes) ? qboRes : (qboRes?.data || qboRes?.expenses || []);

      // Load existing reconciliations (if any)
      await loadExistingReconciliations();

      // Reset selection state
      reconciliationData.selectedManual = null;
      reconciliationData.selectedQBO = null;

      // Render tables
      renderReconciliationTables();

      // Show modal
      document.getElementById('reconcileModal')?.classList.remove('hidden');

      hideEmptyState();

    } catch (err) {
      console.error('[RECONCILE] Error opening modal:', err);
      alert('Error loading reconciliation data: ' + err.message);
      hideEmptyState();
    }
  }

  async function loadExistingReconciliations() {
    try {
      const url = `${apiBase}/expenses/reconciliations?project=${selectedProjectId}`;
      const result = await apiJson(url);

      // Parse linked pairs
      reconciliationData.linkedPairs = Array.isArray(result) ? result : (result?.data || []);

      console.log('[RECONCILE] Loaded existing links:', reconciliationData.linkedPairs.length);
    } catch (err) {
      console.warn('[RECONCILE] Could not load existing reconciliations:', err);
      reconciliationData.linkedPairs = [];
    }
  }

  function renderReconciliationTables() {
    // Render manual expenses table
    const manualTableBody = document.getElementById('reconcileManualTableBody');
    const qboTableBody = document.getElementById('reconcileQBOTableBody');

    if (!manualTableBody || !qboTableBody) return;

    // Manual expenses (filter out already linked)
    const unlinkedManual = reconciliationData.manualExpenses.filter(exp => {
      const expId = exp.expense_id || exp.id;
      return !reconciliationData.linkedPairs.some(pair => pair.manual_expense_id === expId);
    });

    const manualRows = unlinkedManual.map(exp => {
      const expId = exp.expense_id || exp.id;
      const isSelected = reconciliationData.selectedManual === expId;
      const rowClass = isSelected ? 'reconcile-row-selected' : '';

      return `
        <tr class="${rowClass}" data-expense-id="${expId}" data-source="manual">
          <td>${exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : ''}</td>
          <td>${exp.description || ''}</td>
          <td>${findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || ''}</td>
          <td style="text-align: right;">$${formatCurrency(exp.amount)}</td>
          <td><span class="reconcile-status-badge reconcile-status-badge--pending">Pending</span></td>
        </tr>
      `;
    }).join('');

    manualTableBody.innerHTML = manualRows || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">No unlinked manual expenses</td></tr>';

    // QBO expenses (filter out already linked)
    const unlinkedQBO = reconciliationData.qboExpenses.filter(exp => {
      return !reconciliationData.linkedPairs.some(pair => pair.qbo_expense_id === exp.id);
    });

    const qboRows = unlinkedQBO.map(exp => {
      const isSelected = reconciliationData.selectedQBO === exp.id;
      const rowClass = isSelected ? 'reconcile-row-selected' : '';

      return `
        <tr class="${rowClass}" data-expense-id="${exp.id}" data-source="qbo">
          <td>${exp.txn_date ? new Date(exp.txn_date).toLocaleDateString() : ''}</td>
          <td>${exp.description || exp.memo || ''}</td>
          <td>${exp.vendor_name || ''}</td>
          <td style="text-align: right;">$${formatCurrency(exp.amount)}</td>
          <td><span class="reconcile-status-badge reconcile-status-badge--pending">Pending</span></td>
        </tr>
      `;
    }).join('');

    qboTableBody.innerHTML = qboRows || '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">No unlinked QBO expenses</td></tr>';

    // Update counts
    const manualCountEl = document.getElementById('reconcileManualCount');
    if (manualCountEl) manualCountEl.textContent = `${unlinkedManual.length} pending`;

    const qboCountEl = document.getElementById('reconcileQBOCount');
    if (qboCountEl) qboCountEl.textContent = `${unlinkedQBO.length} pending`;

    // Update summary stats
    updateReconciliationSummary();
  }

  function handleReconcileRowClick(source, row) {
    const expenseId = row.getAttribute('data-expense-id');

    if (source === 'manual') {
      // Toggle selection
      if (reconciliationData.selectedManual === expenseId) {
        reconciliationData.selectedManual = null;
      } else {
        reconciliationData.selectedManual = expenseId;

        // If both sides selected, create link
        if (reconciliationData.selectedQBO) {
          createReconciliationLink();
        }
      }
    } else if (source === 'qbo') {
      // Toggle selection
      if (reconciliationData.selectedQBO === expenseId) {
        reconciliationData.selectedQBO = null;
      } else {
        reconciliationData.selectedQBO = expenseId;

        // If both sides selected, create link
        if (reconciliationData.selectedManual) {
          createReconciliationLink();
        }
      }
    }

    // Re-render to show selection
    renderReconciliationTables();
  }

  function createReconciliationLink() {
    const manualId = reconciliationData.selectedManual;
    const qboId = reconciliationData.selectedQBO;

    if (!manualId || !qboId) return;

    // Add to linked pairs
    reconciliationData.linkedPairs.push({
      manual_expense_id: manualId,
      qbo_expense_id: qboId
    });

    console.log('[RECONCILE] Created link:', { manualId, qboId });

    // Reset selections
    reconciliationData.selectedManual = null;
    reconciliationData.selectedQBO = null;

    // Re-render
    renderReconciliationTables();
  }

  function updateReconciliationSummary() {
    const totalManual = reconciliationData.manualExpenses.length;
    const totalQBO = reconciliationData.qboExpenses.length;
    const linkedCount = reconciliationData.linkedPairs.length;
    const pendingManual = totalManual - linkedCount;
    const pendingQBO = totalQBO - linkedCount;

    const linkedEl = document.getElementById('reconcileSummaryLinked');
    if (linkedEl) linkedEl.textContent = linkedCount;

    const pendingManualEl = document.getElementById('reconcileSummaryPendingManual');
    if (pendingManualEl) pendingManualEl.textContent = pendingManual;

    const pendingQBOEl = document.getElementById('reconcileSummaryPendingQBO');
    if (pendingQBOEl) pendingQBOEl.textContent = pendingQBO;

    const totalEl = document.getElementById('reconcileSummaryTotal');
    if (totalEl) totalEl.textContent = totalManual;
  }

  async function saveReconciliations() {
    if (reconciliationData.linkedPairs.length === 0) {
      alert('No reconciliations to save. Select matching expenses from both tables.');
      return;
    }

    const btnSave = document.getElementById('btnSaveReconciliations');
    const originalText = btnSave?.textContent;

    try {
      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
      }

      console.log('[RECONCILE] Saving reconciliations:', reconciliationData.linkedPairs);

      const url = `${apiBase}/expenses/reconciliations`;
      const result = await apiJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          reconciliations: reconciliationData.linkedPairs
        })
      });

      console.log('[RECONCILE] Save result:', result);

      alert(`Successfully saved ${reconciliationData.linkedPairs.length} reconciliation(s)!`);

      // Close modal and reload data
      closeReconciliationModal();
      if (currentDataSource === 'qbo') {
        await loadQBOExpenses(selectedProjectId);
      } else {
        await loadExpensesByProject(selectedProjectId);
      }

    } catch (err) {
      console.error('[RECONCILE] Save error:', err);
      alert('Error saving reconciliations: ' + err.message);
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = originalText;
      }
    }
  }

  function closeReconciliationModal() {
    document.getElementById('reconcileModal')?.classList.add('hidden');

    // Reset state
    reconciliationData.manualExpenses = [];
    reconciliationData.qboExpenses = [];
    reconciliationData.selectedManual = null;
    reconciliationData.selectedQBO = null;
    reconciliationData.linkedPairs = [];
  }

  // ================================
  // HELPER FUNCTIONS
  // ================================
  function getVisibleColumnCount() {
    // Count visible columns based on columnVisibility state
    const baseColumns = ['date', 'description', 'type', 'vendor', 'payment', 'account', 'amount'];
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

    // Position dropdown below the button
    const rect = toggleBtn.getBoundingClientRect();
    const tableContainer = document.querySelector('.expenses-table-container');
    const containerRect = tableContainer.getBoundingClientRect();

    els.filterDropdown.style.left = `${rect.left - containerRect.left}px`;
    els.filterDropdown.style.top = `${rect.bottom - containerRect.top + 4}px`;

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
  async function toggleAuth(badgeElement) {
    if (!canAuthorize) {
      console.warn('[AUTH] User does not have permission to authorize');
      return;
    }

    const expenseId = badgeElement.getAttribute('data-expense-id');
    const currentStatus = badgeElement.getAttribute('data-auth-status') === 'true';
    const newStatus = !currentStatus;

    console.log('[AUTH] Toggling authorization for expense:', expenseId, 'from', currentStatus, 'to', newStatus);

    const apiBase = getApiBase();

    try {
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
      const expense = expenses.find(e => (e.expense_id || e.id) == expenseId);
      if (expense) {
        expense.auth_status = newStatus;
        expense.auth_by = newStatus ? userId : null;
      }

      // Re-render table to update badge
      renderExpensesTable();

    } catch (error) {
      console.error('[AUTH] Error updating authorization:', error);
      alert('Failed to update authorization status: ' + error.message);
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
        alert('No expenses with descriptions found');
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

        // Show summary
        const summary = getSummary(response.categorizations);
        alert(`Auto-categorization complete!\n\n${summary}`);
      }, 800);

    } catch (error) {
      console.error('[AUTO-CATEGORIZE] Error:', error);
      alert('Error during auto-categorization: ' + error.message);
      closeConstructionStageModal();
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

    // Map column keys to their index in the table
    const columnIndexMap = {
      date: 0,
      description: 1,
      type: 2,
      vendor: 3,
      payment: 4,
      account: 5,
      amount: 6,
      receipt: 7,
      auth: 8
      // actions column (index 9) is always visible
    };

    // Apply visibility to header cells
    Object.entries(columnIndexMap).forEach(([key, index]) => {
      const isVisible = columnVisibility[key];
      const th = table.querySelector(`thead th:nth-child(${index + 1})`);
      if (th) {
        th.style.display = isVisible ? '' : 'none';
      }
    });

    // Apply visibility to body cells
    Object.entries(columnIndexMap).forEach(([key, index]) => {
      const isVisible = columnVisibility[key];
      const tds = table.querySelectorAll(`tbody td:nth-child(${index + 1})`);
      tds.forEach(td => {
        td.style.display = isVisible ? '' : 'none';
      });
    });
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
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
