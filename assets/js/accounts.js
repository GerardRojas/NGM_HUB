// ================================
// ACCOUNTS TABLE
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Estado
  let accounts = [];
  let originalAccounts = [];
  let isEditMode = false;
  let currentSort = 'name'; // 'name', 'number', 'category'

  // DOM Elements
  const els = {
    table: document.getElementById('accountsTable'),
    tbody: document.getElementById('accountsTableBody'),
    emptyState: document.getElementById('accountsEmptyState'),
    btnEditAccounts: document.getElementById('btnEditAccounts'),
    btnAddAccount: document.getElementById('btnAddAccount'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    editModeFooter: document.getElementById('editModeFooter'),
    searchInput: document.getElementById('accounts-search-input'),
    btnSortByNumber: document.getElementById('btnSortByNumber'),
    btnSortByCategory: document.getElementById('btnSortByCategory'),
    btnSortByName: document.getElementById('btnSortByName'),
    pageLoadingOverlay: document.getElementById('pageLoadingOverlay')
  };

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadAccounts();
    setupEventListeners();
  }

  // ================================
  // LOAD DATA
  // ================================

  async function loadAccounts() {
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      if (!res.ok) {
        const text = await res.text();
        console.error('[ACCOUNTS] Error loading accounts:', text);
        showEmptyState();
        hidePageLoading();
        return;
      }

      const json = await res.json();
      accounts = json.data || [];
      originalAccounts = JSON.parse(JSON.stringify(accounts));

      renderAccountsTable();
      els.btnEditAccounts.disabled = accounts.length === 0;
      hidePageLoading();
    } catch (err) {
      console.error('[ACCOUNTS] Network error:', err);
      showEmptyState();
      hidePageLoading();
    }
  }

  // ================================
  // RENDER TABLE
  // ================================

  function renderAccountsTable() {
    if (!accounts || accounts.length === 0) {
      showEmptyState();
      return;
    }

    els.emptyState.style.display = 'none';
    els.table.style.display = 'table';
    els.tbody.innerHTML = '';

    accounts.forEach((account, index) => {
      const row = isEditMode ? renderEditRow(account, index) : renderReadRow(account, index);
      els.tbody.insertAdjacentHTML('beforeend', row);
    });
  }

  function renderReadRow(account, index) {
    const id = account.account_id || '';
    const acctNum = account.AcctNum != null ? account.AcctNum : '—';
    const name = account.Name || '—';
    const category = account.AccountCategory || '—';

    return `
      <tr data-index="${index}" data-id="${id}">
        <td>${acctNum}</td>
        <td>${name}</td>
        <td>${category}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditRow(account, index) {
    const id = account.account_id || '';
    const acctNum = account.AcctNum != null ? account.AcctNum : '';
    const name = account.Name || '';
    const category = account.AccountCategory || '';

    return `
      <tr data-index="${index}" data-id="${id}" class="edit-mode-row">
        <td class="editable-cell">
          <input type="number" class="edit-input" data-field="AcctNum" value="${acctNum}" placeholder="Account #">
        </td>
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="Name" value="${name}" placeholder="Account name">
        </td>
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="AccountCategory" value="${category}" placeholder="Category">
        </td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-index="${index}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function showEmptyState() {
    els.emptyState.style.display = 'flex';
    els.table.style.display = 'none';
  }

  function hidePageLoading() {
    document.body.classList.remove('page-loading');
    if (els.pageLoadingOverlay) {
      els.pageLoadingOverlay.classList.add('hidden');
    }
  }

  // ================================
  // EDIT MODE
  // ================================

  function toggleEditMode(enable) {
    isEditMode = enable;

    if (isEditMode) {
      els.btnEditAccounts.textContent = 'Cancel Edit';
      els.btnEditAccounts.classList.remove('btn-toolbar-secondary');
      els.btnEditAccounts.classList.add('btn-toolbar-danger');
      els.btnAddAccount.disabled = true;
      els.editModeFooter.classList.remove('hidden');
    } else {
      els.btnEditAccounts.textContent = 'Edit Accounts';
      els.btnEditAccounts.classList.remove('btn-toolbar-danger');
      els.btnEditAccounts.classList.add('btn-toolbar-secondary');
      els.btnAddAccount.disabled = false;
      els.editModeFooter.classList.add('hidden');

      // Restore original data
      accounts = JSON.parse(JSON.stringify(originalAccounts));
    }

    renderAccountsTable();
  }

  // ================================
  // SAVE CHANGES
  // ================================

  async function saveChanges() {
    const rows = els.tbody.querySelectorAll('tr');
    const updates = [];

    rows.forEach(row => {
      const index = parseInt(row.getAttribute('data-index'), 10);
      const original = originalAccounts[index];
      const current = accounts[index];

      // Collect current values from inputs
      const inputs = row.querySelectorAll('.edit-input');
      inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        const value = input.value.trim();

        if (field === 'AcctNum') {
          current[field] = value ? parseInt(value, 10) : null;
        } else {
          current[field] = value || null;
        }
      });

      // Check if changed
      const changed = JSON.stringify(original) !== JSON.stringify(current);

      if (changed) {
        updates.push({
          id: current.account_id,
          data: {
            Name: current.Name,
            AcctNum: current.AcctNum,
            AccountCategory: current.AccountCategory
          }
        });
      }
    });

    if (updates.length === 0) {
      if (window.Toast) {
        Toast.info('No Changes', 'No changes to save.');
      }
      toggleEditMode(false);
      return;
    }

    try {
      for (const update of updates) {
        const res = await fetch(`${API_BASE}/accounts/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed to update account ${update.id}: ${errText}`);
        }
      }

      if (window.Toast) {
        Toast.success('Changes Saved', `${updates.length} account(s) updated successfully!`);
      }
      await loadAccounts();
      toggleEditMode(false);
    } catch (err) {
      console.error('[ACCOUNTS] Error saving changes:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving changes.', { details: err.message });
      }
    }
  }

  // ================================
  // ADD ACCOUNT
  // ================================

  async function addAccount() {
    const accountName = prompt('Enter account name:');
    if (!accountName || !accountName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Name: accountName.trim() })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      if (window.Toast) {
        Toast.success('Account Created', 'Account created successfully!');
      }
      await loadAccounts();
    } catch (err) {
      console.error('[ACCOUNTS] Error creating account:', err);
      if (window.Toast) {
        Toast.error('Create Failed', 'Error creating account.', { details: err.message });
      }
    }
  }

  // ================================
  // DELETE ROW
  // ================================

  async function deleteRow(index) {
    const account = accounts[index];
    if (!confirm(`Delete account "${account.Name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/accounts/${account.account_id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      if (window.Toast) {
        Toast.success('Account Deleted', 'Account deleted successfully!');
      }
      await loadAccounts();
    } catch (err) {
      console.error('[ACCOUNTS] Error deleting account:', err);
      if (window.Toast) {
        Toast.error('Delete Failed', 'Error deleting account.', { details: err.message });
      }
    }
  }

  // ================================
  // SORTING
  // ================================

  function sortAccounts(sortBy) {
    currentSort = sortBy;

    // Update active button
    document.querySelectorAll('.btn-sort').forEach(btn => btn.classList.remove('active'));
    if (sortBy === 'number') {
      els.btnSortByNumber?.classList.add('active');
    } else if (sortBy === 'category') {
      els.btnSortByCategory?.classList.add('active');
    } else {
      els.btnSortByName?.classList.add('active');
    }

    // Sort accounts array
    accounts.sort((a, b) => {
      if (sortBy === 'number') {
        const numA = a.AcctNum != null ? a.AcctNum : Infinity;
        const numB = b.AcctNum != null ? b.AcctNum : Infinity;
        return numA - numB;
      } else if (sortBy === 'category') {
        const catA = (a.AccountCategory || '').toLowerCase();
        const catB = (b.AccountCategory || '').toLowerCase();
        return catA.localeCompare(catB);
      } else {
        const nameA = (a.Name || '').toLowerCase();
        const nameB = (b.Name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
    });

    renderAccountsTable();
  }

  // ================================
  // SEARCH
  // ================================

  function filterTable() {
    const searchTerm = els.searchInput.value.toLowerCase().trim();
    const rows = els.tbody.querySelectorAll('tr');

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      const acctNum = cells[0]?.textContent.toLowerCase() || '';
      const accountName = cells[1]?.textContent.toLowerCase() || '';
      const category = cells[2]?.textContent.toLowerCase() || '';

      if (acctNum.includes(searchTerm) || accountName.includes(searchTerm) || category.includes(searchTerm)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // ================================
  // EVENT LISTENERS
  // ================================

  function setupEventListeners() {
    // Edit button
    els.btnEditAccounts?.addEventListener('click', () => {
      toggleEditMode(!isEditMode);
    });

    // Cancel edit
    els.btnCancelEdit?.addEventListener('click', () => {
      toggleEditMode(false);
    });

    // Save changes
    els.btnSaveChanges?.addEventListener('click', () => {
      saveChanges();
    });

    // Add account
    els.btnAddAccount?.addEventListener('click', () => {
      addAccount();
    });

    // Delete row (delegated)
    els.tbody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-row-delete')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        deleteRow(index);
      }
    });

    // Search
    els.searchInput?.addEventListener('input', filterTable);

    // Sort buttons
    els.btnSortByNumber?.addEventListener('click', () => {
      sortAccounts('number');
    });

    els.btnSortByCategory?.addEventListener('click', () => {
      sortAccounts('category');
    });

    els.btnSortByName?.addEventListener('click', () => {
      sortAccounts('name');
    });
  }

  // ================================
  // START
  // ================================

  window.addEventListener('DOMContentLoaded', () => {
    if (window.initTopbarPills) window.initTopbarPills();
    init();
  });

})();
