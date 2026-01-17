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
  let columnFilters = {
    date: '',
    type: '',
    vendor: '',
    payment: '',
    account: '',
    description: ''
  };

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
      // Date filter
      if (columnFilters.date) {
        const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString().toLowerCase() : '';
        if (!date.includes(columnFilters.date.toLowerCase())) return false;
      }

      // Type filter
      if (columnFilters.type) {
        const type = (exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'txn_type_name') || '').toLowerCase();
        if (!type.includes(columnFilters.type.toLowerCase())) return false;
      }

      // Vendor filter
      if (columnFilters.vendor) {
        const vendor = (exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '').toLowerCase();
        if (!vendor.includes(columnFilters.vendor.toLowerCase())) return false;
      }

      // Payment filter
      if (columnFilters.payment) {
        const payment = (exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '').toLowerCase();
        if (!payment.includes(columnFilters.payment.toLowerCase())) return false;
      }

      // Account filter
      if (columnFilters.account) {
        const account = (exp.account_name || findMetaName('accounts', exp.account_id, 'id', 'account_name') || '').toLowerCase();
        if (!account.includes(columnFilters.account.toLowerCase())) return false;
      }

      // Description filter
      if (columnFilters.description) {
        const desc = (exp.LineDescription || '').toLowerCase();
        if (!desc.includes(columnFilters.description.toLowerCase())) return false;
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

    // Add total row
    const totalRow = `
      <tr class="total-row">
        <td colspan="5" class="total-label">Total</td>
        <td class="col-amount total-amount">$${total.toFixed(2)}</td>
        <td colspan="2"></td>
      </tr>
    `;

    els.expensesTableBody.innerHTML = rows + totalRow;
  }

  function renderReadOnlyRow(exp, index) {
    const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
    const type = exp.txn_type_name || findMetaName('txn_types', exp.txn_type, 'TnxType_id', 'txn_type_name') || '—';
    const vendor = exp.vendor_name || findMetaName('vendors', exp.vendor_id, 'id', 'vendor_name') || '—';
    const payment = exp.payment_method_name || findMetaName('payment_methods', exp.payment_type, 'id', 'payment_method_name') || '—';
    const account = exp.account_name || findMetaName('accounts', exp.account_id, 'id', 'account_name') || '—';
    const amount = exp.Amount ? `$${Number(exp.Amount).toFixed(2)}` : '$0.00';
    const description = exp.LineDescription || '—';

    return `
      <tr data-index="${index}" data-id="${exp.id || ''}">
        <td>${date}</td>
        <td>${type}</td>
        <td>${vendor}</td>
        <td>${payment}</td>
        <td>${account}</td>
        <td class="col-amount">${amount}</td>
        <td>${description}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditableRow(exp, index) {
    const dateVal = exp.TxnDate ? exp.TxnDate.split('T')[0] : '';

    return `
      <tr data-index="${index}" data-id="${exp.id || ''}">
        <td>
          <input type="date" class="edit-input" data-field="TxnDate" value="${dateVal}">
        </td>
        <td>
          ${buildSelectHtml('txn_type', exp.txn_type, metaData.txn_types, 'TnxType_id', 'txn_type_name')}
        </td>
        <td>
          ${buildSelectHtml('vendor_id', exp.vendor_id, metaData.vendors, 'id', 'vendor_name')}
        </td>
        <td>
          ${buildSelectHtml('payment_type', exp.payment_type, metaData.payment_methods, 'id', 'payment_method_name')}
        </td>
        <td>
          ${buildSelectHtml('account_id', exp.account_id, metaData.accounts, 'id', 'account_name')}
        </td>
        <td>
          <input type="number" class="edit-input edit-input--amount" data-field="Amount" step="0.01" min="0" value="${exp.Amount || ''}">
        </td>
        <td>
          <input type="text" class="edit-input" data-field="LineDescription" value="${exp.LineDescription || ''}">
        </td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-index="${index}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function buildSelectHtml(field, selectedValue, options, valueKey, textKey) {
    const optionsHtml = options.map(opt => {
      const val = opt[valueKey];
      // Try multiple possible name fields
      const text = opt[textKey] || opt.name || opt.vendor_name || opt.account_name ||
                   opt.payment_method_name || opt.txn_type_name ||
                   `Unnamed (${val})`;
      const selected = val == selectedValue ? 'selected' : '';
      return `<option value="${val}" ${selected}>${text}</option>`;
    }).join('');

    return `<select class="edit-input" data-field="${field}"><option value="">—</option>${optionsHtml}</select>`;
  }

  function findMetaName(category, value, valueKey, textKey) {
    if (!value) return null;
    const item = metaData[category]?.find(i => i[valueKey] == value);
    return item ? item[textKey] : null;
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
    } else {
      els.btnEditExpenses.textContent = 'Edit Expenses';
      els.btnEditExpenses.disabled = expenses.length === 0;
      els.btnAddExpense.disabled = !selectedProjectId;
      els.projectFilter.disabled = false;
      if (els.editModeFooter) els.editModeFooter.classList.add('hidden');
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
    const rows = els.expensesTableBody.querySelectorAll('tr[data-index]');
    const updates = [];
    const deletes = [];

    // Collect changes from DOM
    rows.forEach(row => {
      const index = parseInt(row.dataset.index, 10);
      const expenseId = row.dataset.id;

      if (!expenseId) return; // Skip rows without ID

      const updatedData = {};
      row.querySelectorAll('.edit-input').forEach(input => {
        const field = input.dataset.field;
        let value = input.value;

        if (field === 'Amount') {
          value = value ? parseFloat(value) : null;
        }

        updatedData[field] = value || null;
      });

      // Check if data changed
      const original = originalExpenses[index];
      if (original && hasChanges(original, updatedData)) {
        updates.push({ id: expenseId, data: updatedData });
      }
    });

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
        await apiJson(`${apiBase}/expenses/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });
      }

      alert(`${updates.length} expense(s) updated successfully!`);

      // Reload expenses
      await loadExpensesByProject(selectedProjectId);
      toggleEditMode(false);

    } catch (err) {
      console.error('[EXPENSES] Error saving changes:', err);
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

    // Show modal
    els.modal.classList.remove('hidden');
  }

  function closeAddExpenseModal() {
    els.modal.classList.add('hidden');
    els.expenseRowsBody.innerHTML = '';
    modalRowCounter = 0;
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
        ${buildModalSelectHtml('txn_type', metaData.txn_types, 'TnxType_id', 'txn_type_name')}
      </td>
      <td>
        ${buildModalSelectHtml('vendor_id', metaData.vendors, 'id', 'vendor_name')}
      </td>
      <td>
        ${buildModalSelectHtml('payment_type', metaData.payment_methods, 'id', 'payment_method_name')}
      </td>
      <td>
        ${buildModalSelectHtml('account_id', metaData.accounts, 'id', 'account_name')}
      </td>
      <td>
        <input type="number" class="exp-input exp-input--amount" data-field="Amount" step="0.01" min="0" placeholder="0.00">
      </td>
      <td>
        <input type="text" class="exp-input exp-input--desc" data-field="LineDescription" placeholder="Description">
      </td>
      <td>
        <button type="button" class="exp-row-remove" data-row-index="${rowIndex}">×</button>
      </td>
    `;

    els.expenseRowsBody.appendChild(row);
  }

  function buildModalSelectHtml(field, options, valueKey, textKey) {
    const datalistId = `datalist-${field}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optionsHtml = options.map(opt => {
      const val = opt[valueKey];
      // Try multiple possible name fields
      const text = opt[textKey] || opt.name || opt.vendor_name || opt.account_name ||
                   opt.payment_method_name || opt.txn_type_name ||
                   `Unnamed (${val})`;
      return `<option value="${text}" data-value-id="${val}">${text}</option>`;
    }).join('');

    // Store mapping in data attribute for later retrieval
    const mappingJson = JSON.stringify(
      options.map(opt => ({
        text: opt[textKey] || opt.name || opt.vendor_name || opt.account_name ||
              opt.payment_method_name || opt.txn_type_name || `Unnamed (${opt[valueKey]})`,
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

    // Collect data from each row
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
      // Send POST requests for each expense
      for (const expenseData of expensesToSave) {
        await apiJson(`${apiBase}/expenses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(expenseData)
        });
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

    // Handle edit inputs
    els.expensesTableBody?.addEventListener('input', (e) => {
      if (!isEditMode) return;
      if (!e.target.classList.contains('edit-input')) return;

      const row = e.target.closest('tr');
      const index = parseInt(row.dataset.index, 10);
      const field = e.target.dataset.field;
      let value = e.target.value;

      if (field === 'Amount') {
        value = value ? parseFloat(value) : null;
      }

      if (expenses[index]) {
        expenses[index][field] = value || null;
      }
    });

    // Column filters
    document.getElementById('filterDate')?.addEventListener('input', (e) => {
      columnFilters.date = e.target.value;
      renderExpensesTable();
    });

    document.getElementById('filterType')?.addEventListener('input', (e) => {
      columnFilters.type = e.target.value;
      renderExpensesTable();
    });

    document.getElementById('filterVendor')?.addEventListener('input', (e) => {
      columnFilters.vendor = e.target.value;
      renderExpensesTable();
    });

    document.getElementById('filterPayment')?.addEventListener('input', (e) => {
      columnFilters.payment = e.target.value;
      renderExpensesTable();
    });

    document.getElementById('filterAccount')?.addEventListener('input', (e) => {
      columnFilters.account = e.target.value;
      renderExpensesTable();
    });

    document.getElementById('filterDescription')?.addEventListener('input', (e) => {
      columnFilters.description = e.target.value;
      renderExpensesTable();
    });
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
