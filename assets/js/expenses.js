// assets/js/expenses.js
(function () {
  'use strict';

  // ================================
  // AUTH & USER
  // ================================
  let currentUser = null;

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
  // LOAD DROPDOWN DATA
  // ================================
  async function loadDropdownData() {
    const apiBase = getApiBase();

    try {
      // Use the /expenses/meta endpoint to get all catalogs at once
      const meta = await apiJson(`${apiBase}/expenses/meta`);

      if (!meta) {
        throw new Error('No metadata received from server');
      }

      // Extract catalogs from meta response
      const { txn_types = [], projects = [], vendors = [], payment_methods = [], accounts = [] } = meta;

      // Populate Transaction Type dropdown
      const txnTypeSelect = document.getElementById('exp-txn-type');
      if (txnTypeSelect && Array.isArray(txn_types)) {
        txn_types.forEach(txn => {
          const opt = document.createElement('option');
          opt.value = txn.TnxType_id || txn.id;
          opt.textContent = txn.txn_type_name || txn.name || 'Unnamed Type';
          txnTypeSelect.appendChild(opt);
        });
      }

      // Populate Project dropdown
      const projectSelect = document.getElementById('exp-project');
      if (projectSelect && Array.isArray(projects)) {
        projects.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.project_id || p.id;
          opt.textContent = p.project_name || p.name || 'Unnamed Project';
          projectSelect.appendChild(opt);
        });
      }

      // Populate Vendor dropdown
      const vendorSelect = document.getElementById('exp-vendor');
      if (vendorSelect && Array.isArray(vendors)) {
        vendors.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.id;
          opt.textContent = v.vendor_name || v.name || 'Unnamed Vendor';
          vendorSelect.appendChild(opt);
        });
      }

      // Populate Payment Method dropdown
      const paymentSelect = document.getElementById('exp-payment');
      if (paymentSelect && Array.isArray(payment_methods)) {
        payment_methods.forEach(pm => {
          const opt = document.createElement('option');
          opt.value = pm.id;
          opt.textContent = pm.payment_method_name || pm.name || 'Unnamed Method';
          paymentSelect.appendChild(opt);
        });
      }

      // Populate Account dropdown
      const accountSelect = document.getElementById('exp-account');
      if (accountSelect && Array.isArray(accounts)) {
        accounts.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc.account_id || acc.id;
          opt.textContent = acc.account_name || acc.name || 'Unnamed Account';
          accountSelect.appendChild(opt);
        });
      }

    } catch (err) {
      console.error('[EXPENSES] Error loading dropdown data:', err);
      alert('Error loading form data. Please refresh the page.');
    }
  }

  // ================================
  // SAVE EXPENSE
  // ================================
  async function saveExpense(expenseData) {
    const apiBase = getApiBase();

    try {
      const response = await apiJson(`${apiBase}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseData),
      });

      return response;
    } catch (err) {
      console.error('[EXPENSES] Error saving expense:', err);
      throw err;
    }
  }

  // ================================
  // LOAD RECENT EXPENSES
  // ================================
  async function loadRecentExpenses(projectFilter = null) {
    const apiBase = getApiBase();

    try {
      // Build URL with optional project filter
      let url = `${apiBase}/expenses`;
      if (projectFilter) {
        url += `?project=${projectFilter}`;
      }

      const expenses = await apiJson(url);
      return Array.isArray(expenses) ? expenses : [];
    } catch (err) {
      console.error('[EXPENSES] Error loading expenses:', err);
      return [];
    }
  }

  // ================================
  // RENDER EXPENSES TABLE
  // ================================
  function renderExpensesTable(expenses) {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    if (!expenses || expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #999;">No expenses found</td></tr>';
      return;
    }

    tbody.innerHTML = expenses.map(exp => {
      const date = exp.TxnDate ? new Date(exp.TxnDate).toLocaleDateString() : '—';
      const vendor = exp.vendor_name || '—';
      const project = exp.project_name || '—';
      const amount = exp.Amount ? `$${Number(exp.Amount).toFixed(2)}` : '$0.00';
      const payment = exp.payment_method_name || '—';
      const description = exp.LineDescription || '—';
      const type = exp.txn_type_name || '—';

      return `
        <tr>
          <td>${date}</td>
          <td>${vendor}</td>
          <td>${project}</td>
          <td>${amount}</td>
          <td>${payment}</td>
          <td>${description}</td>
          <td>${type}</td>
        </tr>
      `;
    }).join('');
  }

  // ================================
  // FORM HANDLER
  // ================================
  function setupFormHandler() {
    const form = document.getElementById('expenseForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Get form values
      const date = document.getElementById('exp-date').value;
      const txnType = document.getElementById('exp-txn-type').value;
      const vendor = document.getElementById('exp-vendor').value;
      const payment = document.getElementById('exp-payment').value;
      const amount = document.getElementById('exp-amount').value;
      const account = document.getElementById('exp-account').value;
      const project = document.getElementById('exp-project').value;
      const qboId = document.getElementById('exp-qbo-id').value;
      const description = document.getElementById('exp-desc').value.trim();
      const showOnReports = document.getElementById('exp-show-reports').checked;

      // Validate required fields
      if (!date || !txnType || !vendor || !payment || !amount || !description) {
        alert('Please fill in all required fields');
        return;
      }

      // Build expense object
      const expenseData = {
        TxnDate: date,
        txn_type: txnType,
        vendor_id: vendor,
        payment_type: payment,
        Amount: parseFloat(amount),
        LineDescription: description,
        show_on_reports: showOnReports,
        created_by: currentUser.user_id || currentUser.id,
      };

      // Add optional fields if present
      if (account) expenseData.account_id = account;
      if (project) expenseData.project = project;
      if (qboId) expenseData.TxnId_QBO = qboId;

      // Disable submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        await saveExpense(expenseData);

        // Success - reset form and reload expenses
        form.reset();
        alert('Expense saved successfully!');

        // Reload recent expenses
        const expenses = await loadRecentExpenses();
        renderExpensesTable(expenses);

      } catch (err) {
        alert('Error saving expense: ' + err.message);
      } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    // Check auth first
    if (!initAuth()) return;

    // Load dropdown data
    await loadDropdownData();

    // Setup form handler
    setupFormHandler();

    // Load recent expenses
    const expenses = await loadRecentExpenses();
    renderExpensesTable(expenses);
  }

  // Run on DOM load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
