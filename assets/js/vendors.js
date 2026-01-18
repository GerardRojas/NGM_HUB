// ================================
// VENDORS TABLE
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Estado
  let vendors = [];
  let originalVendors = [];
  let isEditMode = false;

  // DOM Elements
  const els = {
    table: document.getElementById('vendorsTable'),
    tbody: document.getElementById('vendorsTableBody'),
    loadingState: document.getElementById('vendorsLoadingState'),
    emptyState: document.getElementById('vendorsEmptyState'),
    btnEditVendors: document.getElementById('btnEditVendors'),
    btnAddVendor: document.getElementById('btnAddVendor'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    editModeFooter: document.getElementById('editModeFooter'),
    searchInput: document.getElementById('vendors-search-input')
  };

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadVendors();
    setupEventListeners();
  }

  // ================================
  // LOAD DATA
  // ================================

  async function loadVendors() {
    try {
      showLoadingState();

      const res = await fetch(`${API_BASE}/vendors/`);
      if (!res.ok) {
        const text = await res.text();
        console.error('[VENDORS] Error loading vendors:', text);
        showEmptyState();
        return;
      }

      const json = await res.json();
      vendors = json.data || [];
      originalVendors = JSON.parse(JSON.stringify(vendors));

      renderVendorsTable();
      els.btnEditVendors.disabled = vendors.length === 0;
    } catch (err) {
      console.error('[VENDORS] Network error:', err);
      showEmptyState();
    }
  }

  // ================================
  // RENDER TABLE
  // ================================

  function renderVendorsTable() {
    if (!vendors || vendors.length === 0) {
      showEmptyState();
      return;
    }

    els.loadingState.style.display = 'none';
    els.emptyState.style.display = 'none';
    els.table.style.display = 'table';
    els.tbody.innerHTML = '';

    vendors.forEach((vendor, index) => {
      const row = isEditMode ? renderEditRow(vendor, index) : renderReadRow(vendor, index);
      els.tbody.insertAdjacentHTML('beforeend', row);
    });
  }

  function renderReadRow(vendor, index) {
    const id = vendor.id || '';
    const name = vendor.vendor_name || '—';

    return `
      <tr data-index="${index}" data-id="${id}">
        <td>${name}</td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditRow(vendor, index) {
    const id = vendor.id || '';
    const name = vendor.vendor_name || '';

    return `
      <tr data-index="${index}" data-id="${id}" class="edit-mode-row">
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="vendor_name" value="${name}" placeholder="Vendor name">
        </td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-index="${index}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function showLoadingState() {
    els.loadingState.style.display = 'flex';
    els.emptyState.style.display = 'none';
    els.table.style.display = 'none';
  }

  function showEmptyState() {
    els.loadingState.style.display = 'none';
    els.emptyState.style.display = 'flex';
    els.table.style.display = 'none';
  }

  // ================================
  // EDIT MODE
  // ================================

  function toggleEditMode(enable) {
    isEditMode = enable;

    if (isEditMode) {
      els.btnEditVendors.textContent = 'Cancel Edit';
      els.btnEditVendors.classList.remove('btn-toolbar-secondary');
      els.btnEditVendors.classList.add('btn-toolbar-danger');
      els.btnAddVendor.disabled = true;
      els.editModeFooter.classList.remove('hidden');
    } else {
      els.btnEditVendors.textContent = 'Edit Vendors';
      els.btnEditVendors.classList.remove('btn-toolbar-danger');
      els.btnEditVendors.classList.add('btn-toolbar-secondary');
      els.btnAddVendor.disabled = false;
      els.editModeFooter.classList.add('hidden');

      // Restore original data
      vendors = JSON.parse(JSON.stringify(originalVendors));
    }

    renderVendorsTable();
  }

  // ================================
  // SAVE CHANGES
  // ================================

  async function saveChanges() {
    const rows = els.tbody.querySelectorAll('tr');
    const updates = [];

    rows.forEach(row => {
      const index = parseInt(row.getAttribute('data-index'), 10);
      const original = originalVendors[index];
      const current = vendors[index];

      // Collect current values from inputs
      const inputs = row.querySelectorAll('.edit-input');
      inputs.forEach(input => {
        const field = input.getAttribute('data-field');
        current[field] = input.value.trim() || null;
      });

      // Check if changed
      const changed = JSON.stringify(original) !== JSON.stringify(current);

      if (changed) {
        updates.push({
          id: current.id,
          data: {
            vendor_name: current.vendor_name
          }
        });
      }
    });

    if (updates.length === 0) {
      alert('No changes to save');
      toggleEditMode(false);
      return;
    }

    try {
      for (const update of updates) {
        const res = await fetch(`${API_BASE}/vendors/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed to update vendor ${update.id}: ${errText}`);
        }
      }

      alert(`${updates.length} vendor(s) updated successfully!`);
      await loadVendors();
      toggleEditMode(false);
    } catch (err) {
      console.error('[VENDORS] Error saving changes:', err);
      alert(`Error saving changes: ${err.message}`);
    }
  }

  // ================================
  // ADD VENDOR
  // ================================

  async function addVendor() {
    const vendorName = prompt('Enter vendor name:');
    if (!vendorName || !vendorName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/vendors/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: vendorName.trim() })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      alert('Vendor created successfully!');
      await loadVendors();
    } catch (err) {
      console.error('[VENDORS] Error creating vendor:', err);
      alert(`Error creating vendor: ${err.message}`);
    }
  }

  // ================================
  // DELETE ROW
  // ================================

  async function deleteRow(index) {
    const vendor = vendors[index];
    if (!confirm(`Delete vendor "${vendor.vendor_name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/vendors/${vendor.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      alert('Vendor deleted successfully!');
      await loadVendors();
    } catch (err) {
      console.error('[VENDORS] Error deleting vendor:', err);
      alert(`Error deleting vendor: ${err.message}`);
    }
  }

  // ================================
  // SEARCH
  // ================================

  function filterTable() {
    const searchTerm = els.searchInput.value.toLowerCase().trim();
    const rows = els.tbody.querySelectorAll('tr');

    rows.forEach(row => {
      const vendorName = row.querySelector('td')?.textContent.toLowerCase() || '';
      if (vendorName.includes(searchTerm)) {
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
    els.btnEditVendors?.addEventListener('click', () => {
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

    // Add vendor
    els.btnAddVendor?.addEventListener('click', () => {
      addVendor();
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
  }

  // ================================
  // START
  // ================================

  window.addEventListener('DOMContentLoaded', () => {
    if (window.initTopbarPills) window.initTopbarPills();
    init();
  });

})();
