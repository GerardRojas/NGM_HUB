// assets/js/expenses.js
(function () {
  'use strict';

  // ================================
  // STATE
  // ================================
  let currentUser = null;
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
  let currentEditingExpense = null; // Expense being edited in single modal
  let columnFilters = {
    date: [],
    type: [],
    vendor: [],
    payment: [],
    account: [],
    description: []
  };

  // Filter dropdown state
  let currentFilterColumn = null;
  let tempFilterSelections = {};

  // Global search state
  let globalSearchTerm = '';

  // ================================
  // DOM ELEMENTS
  // ================================
  const els = {};

  function cacheElements() {
    els.projectFilter = document.getElementById('projectFilter');
    els.btnAddExpense = document.getElementById('btnAddExpense');
    els.btnEditExpenses = document.getElementById('btnEditExpenses');
    els.expensesTable = document.getElementById('expensesTable');
    els.expensesTableBody = document.getElementById('expensesTableBody');
    els.expensesEmptyState = document.getElementById('expensesEmptyState');
    els.editModeFooter = document.getElementById('editModeFooter');
    els.btnCancelEdit = document.getElementById('btnCancelEdit');
    els.btnSaveChanges = document.getElementById('btnSaveChanges');

    // Modal elements
    els.modal = document.getElementById('addExpenseModal');
    els.modalProjectName = document.getElementById('modalProjectName');
    els.expenseRowsBody = document.getElementById('expenseRowsBody');
    els.btnAddExpenseRow = document.getElementById('btnAddExpenseRow');
    els.btnCloseExpenseModal = document.getElementById('btnCloseExpenseModal');
    els.btnCancelExpenses = document.getElementById('btnCancelExpenses');
    els.btnSaveAllExpenses = document.getElementById('btnSaveAllExpenses');

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
  // LOAD META DATA
  // ================================
  async function loadMetaData() {
    const apiBase = getApiBase();

    try {
      const meta = await apiJson(`${apiBase}/expenses/meta`);

      if (!meta) {
        throw new Error('No metadata received from server');
      }

      metaData.txn_types = meta.txn_types || [];
      metaData.projects = meta.projects || [];
      metaData.vendors = meta.vendors || [];
      metaData.payment_methods = meta.payment_methods || [];
      metaData.accounts = meta.accounts || [];

      // Debug: Log metadata structure to help identify correct column names
      console.log('[METADATA] txn_types sample:', metaData.txn_types[0]);
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
    if (!els.projectFilter) return;

    // Clear existing options except first
    els.projectFilter.innerHTML = '<option value="">Select project...</option>';

    metaData.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id || p.id;
      opt.textContent = p.project_name || p.name || 'Unnamed Project';
      els.projectFilter.appendChild(opt);
    });
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
        const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'id', 'TnxType_name') || '';
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
        const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'id', 'TnxType_name') || '—';
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

    // Add total row with currency formatting (includes receipt column)
    const totalRow = `
      <tr class="total-row">
        <td colspan="6" class="total-label">Total</td>
        <td class="col-amount total-amount">${formatCurrency(total)}</td>
        <td class="col-actions"></td>
        <td class="col-actions"></td>
      </tr>
    `;

    els.expensesTableBody.innerHTML = rows + totalRow;
  }

  function renderReadOnlyRow(exp, index) {
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
    const description = exp.LineDescription || '—';
    const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'id', 'TnxType_name') || '—';
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

    return `
      <tr data-index="${index}" data-id="${expenseId}" class="expense-row-clickable" style="cursor: pointer;">
        <td>${date}</td>
        <td class="col-description">${description}</td>
        <td>${type}</td>
        <td>${vendor}</td>
        <td>${payment}</td>
        <td>${account}</td>
        <td class="col-amount">${amount}</td>
        <td class="col-actions">${receiptIcon}</td>
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

    // Get the ID - backend uses 'expense_id' as primary key
    const expenseId = exp.expense_id || exp.id || '';

    return `
      <tr data-index="${index}" data-id="${expenseId}">
        <td>
          <input type="date" class="edit-input" data-field="TxnDate" value="${dateVal}">
        </td>
        <td>
          <input type="text" class="edit-input edit-input--description" data-field="LineDescription" value="${exp.LineDescription || ''}">
        </td>
        <td>
          ${buildSelectHtml('txn_type', exp.txn_type, metaData.txn_types, 'id', 'TnxType_name')}
        </td>
        <td>
          ${buildSelectHtml('vendor_id', exp.vendor_id, metaData.vendors, 'id', 'vendor_name')}
        </td>
        <td>
          ${buildSelectHtml('payment_type', exp.payment_type, metaData.payment_methods, 'id', 'payment_method_name')}
        </td>
        <td>
          ${buildSelectHtml('account_id', exp.account_id, metaData.accounts, 'account_id', 'Name')}
        </td>
        <td>
          <input type="number" class="edit-input edit-input--amount" data-field="Amount" step="0.01" min="0" value="${exp.Amount || ''}">
        </td>
        <td class="col-actions">${receiptIcon}</td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-index="${index}" title="Delete">×</button>
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
    } else {
      els.btnEditExpenses.textContent = 'Edit Expenses';
      els.btnEditExpenses.disabled = expenses.length === 0;
      els.btnAddExpense.disabled = !selectedProjectId;
      els.projectFilter.disabled = false;
      if (els.editModeFooter) els.editModeFooter.classList.add('hidden');
      // Remove edit mode class from table
      if (els.expensesTable) els.expensesTable.classList.remove('edit-mode-table');
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

  async function deleteExpense(index) {
    const expense = expenses[index];
    if (!expense || !expense.id) return;

    const confirmed = confirm('Delete this expense? This cannot be undone.');
    if (!confirmed) return;

    const apiBase = getApiBase();

    try {
      await apiJson(`${apiBase}/expenses/${expense.id}`, {
        method: 'DELETE'
      });

      // Remove from local array and re-render
      expenses.splice(index, 1);
      originalExpenses.splice(index, 1);
      renderExpensesTable();

    } catch (err) {
      console.error('[EXPENSES] Error deleting expense:', err);
      alert('Error deleting expense: ' + err.message);
    }
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
        <input type="number" class="exp-input exp-input--amount" data-field="Amount" step="0.01" min="0" placeholder="0.00">
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
  }

  async function saveAllExpenses() {
    const apiBase = getApiBase();
    const rows = els.expenseRowsBody.querySelectorAll('tr');
    const expensesToSave = [];

    // Collect data from each row including receipt files
    rows.forEach(row => {
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
            }
          } catch (e) {
            console.warn('Failed to parse mapping for field:', field, e);
          }
        } else if (field === 'Amount') {
          value = value ? parseFloat(value) : null;
        }

        rowData[field] = value || null;
      });

      // Check if row has a receipt file
      const receiptInput = row.querySelector('.row-receipt-input');
      if (receiptInput && receiptInput.files.length > 0) {
        rowData._receiptFile = receiptInput.files[0]; // Store file temporarily
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

    // Disable save button
    els.btnSaveAllExpenses.disabled = true;
    els.btnSaveAllExpenses.textContent = 'Saving...';

    try {
      // Send POST requests for each expense and upload receipts
      const createdExpenses = [];
      for (let i = 0; i < expensesToSave.length; i++) {
        const expenseData = { ...expensesToSave[i] };
        const receiptFile = expenseData._receiptFile;
        delete expenseData._receiptFile; // Remove file from data before sending

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

            // Update expense with receipt URL
            await apiJson(`${apiBase}/expenses/${expenseId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receipt_url: receiptUrl })
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
    els.singleExpenseAmount.value = expense.Amount || '';

    // Populate dropdowns
    populateSingleExpenseDropdowns();

    // Set selected values
    els.singleExpenseType.value = expense.txn_type || '';
    els.singleExpenseVendor.value = expense.vendor_id || '';
    els.singleExpensePayment.value = expense.payment_type || '';
    els.singleExpenseAccount.value = expense.account_id || '';

    // Handle receipt
    currentReceiptFile = null;
    currentReceiptUrl = expense.receipt_url || null;
    renderSingleExpenseReceipt();

    // Show modal
    els.singleExpenseModal.classList.remove('hidden');
  }

  function closeSingleExpenseModal() {
    els.singleExpenseModal.classList.add('hidden');
    currentEditingExpense = null;
    currentReceiptFile = null;
    currentReceiptUrl = null;
  }

  function populateSingleExpenseDropdowns() {
    // Populate type dropdown
    els.singleExpenseType.innerHTML = '<option value="">Select type...</option>';
    metaData.txn_types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type.id;
      opt.textContent = type.TnxType_name || type.name || `Type ${type.id}`;
      els.singleExpenseType.appendChild(opt);
    });

    // Populate vendor dropdown
    els.singleExpenseVendor.innerHTML = '<option value="">Select vendor...</option>';
    metaData.vendors.forEach(vendor => {
      const opt = document.createElement('option');
      opt.value = vendor.id;
      opt.textContent = vendor.vendor_name || vendor.name || `Vendor ${vendor.id}`;
      els.singleExpenseVendor.appendChild(opt);
    });

    // Populate payment dropdown
    els.singleExpensePayment.innerHTML = '<option value="">Select payment...</option>';
    metaData.payment_methods.forEach(payment => {
      const opt = document.createElement('option');
      opt.value = payment.id;
      opt.textContent = payment.payment_method_name || payment.name || `Payment ${payment.id}`;
      els.singleExpensePayment.appendChild(opt);
    });

    // Populate account dropdown
    els.singleExpenseAccount.innerHTML = '<option value="">Select account...</option>';
    metaData.accounts.forEach(account => {
      const opt = document.createElement('option');
      opt.value = account.account_id;
      opt.textContent = account.Name || account.name || `Account ${account.account_id}`;
      els.singleExpenseAccount.appendChild(opt);
    });
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
    renderSingleExpenseReceipt();
  }

  async function saveSingleExpense() {
    if (!currentEditingExpense) return;

    const apiBase = getApiBase();
    const expenseId = currentEditingExpense.expense_id || currentEditingExpense.id;

    // Collect updated data
    const updatedData = {
      TxnDate: els.singleExpenseDate.value || null,
      LineDescription: els.singleExpenseDescription.value || null,
      txn_type: els.singleExpenseType.value ? parseInt(els.singleExpenseType.value) : null,
      vendor_id: els.singleExpenseVendor.value ? parseInt(els.singleExpenseVendor.value) : null,
      payment_type: els.singleExpensePayment.value ? parseInt(els.singleExpensePayment.value) : null,
      account_id: els.singleExpenseAccount.value ? parseInt(els.singleExpenseAccount.value) : null,
      Amount: els.singleExpenseAmount.value ? parseFloat(els.singleExpenseAmount.value) : null,
      created_by: currentUser.user_id || currentUser.id // Update created_by to current user
    };

    console.log('[EXPENSES] Saving single expense:', expenseId, updatedData);

    els.btnSaveSingleExpense.disabled = true;
    els.btnSaveSingleExpense.textContent = 'Saving...';

    try {
      // Update expense
      await apiJson(`${apiBase}/expenses/${expenseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      // Handle receipt upload if new file selected
      if (currentReceiptFile && window.ReceiptUpload) {
        try {
          console.log('[EXPENSES] Uploading new receipt');
          const receiptUrl = await window.ReceiptUpload.upload(
            currentReceiptFile,
            expenseId,
            selectedProjectId
          );

          // Update expense with receipt URL
          await apiJson(`${apiBase}/expenses/${expenseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receipt_url: receiptUrl })
          });

          console.log('[EXPENSES] Receipt uploaded and linked');
        } catch (uploadErr) {
          console.error('[EXPENSES] Error uploading receipt:', uploadErr);
          alert('Expense saved, but receipt upload failed: ' + uploadErr.message);
        }
      }

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
        const index = parseInt(e.target.dataset.index, 10);
        deleteExpense(index);
      }
    });

    // Modal: Close button
    els.btnCloseExpenseModal?.addEventListener('click', closeAddExpenseModal);

    // Modal: Cancel button
    els.btnCancelExpenses?.addEventListener('click', closeAddExpenseModal);

    // Modal: Add row button
    els.btnAddExpenseRow?.addEventListener('click', addModalRow);

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
          value = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'id', 'TnxType_name') || '—';
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
  // INIT
  // ================================
  async function init() {
    // Check auth first
    if (!initAuth()) return;

    // Cache DOM elements
    cacheElements();

    // Setup event listeners
    setupEventListeners();

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
