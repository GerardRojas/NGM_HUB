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
  let selectedVendorIds = new Set();

  // DOM Elements
  const els = {
    table: document.getElementById('vendorsTable'),
    tbody: document.getElementById('vendorsTableBody'),
    emptyState: document.getElementById('vendorsEmptyState'),
    skeletonTable: document.getElementById('vendorsSkeletonTable'),
    btnEditVendors: document.getElementById('btnEditVendors'),
    btnAddVendor: document.getElementById('btnAddVendor'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    editModeFooter: document.getElementById('editModeFooter'),
    searchInput: document.getElementById('vendors-search-input'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    btnBulkDelete: document.getElementById('btnBulkDelete'),
    selectedCount: document.getElementById('selectedCount'),
    pageLoadingOverlay: document.getElementById('pageLoadingOverlay')
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
      const res = await fetch(`${API_BASE}/vendors`);
      if (!res.ok) {
        const text = await res.text();
        console.error('[VENDORS] Error loading vendors:', text);
        showEmptyState();
        hidePageLoading();
        return;
      }

      const json = await res.json();
      vendors = json.data || [];
      originalVendors = JSON.parse(JSON.stringify(vendors));

      renderVendorsTable();
      els.btnEditVendors.disabled = vendors.length === 0;
      hidePageLoading();
    } catch (err) {
      console.error('[VENDORS] Network error:', err);
      showEmptyState();
      hidePageLoading();
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

    if (els.skeletonTable) els.skeletonTable.style.display = 'none';
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
    const isChecked = selectedVendorIds.has(id);

    return `
      <tr data-index="${index}" data-id="${id}" class="edit-mode-row">
        <td class="col-checkbox">
          <input type="checkbox" class="row-checkbox" data-id="${id}" ${isChecked ? 'checked' : ''}>
        </td>
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="vendor_name" value="${name}" placeholder="Vendor name">
        </td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-id="${id}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function showEmptyState() {
    if (els.skeletonTable) els.skeletonTable.style.display = 'none';
    els.emptyState.style.display = 'flex';
    els.table.style.display = 'none';
  }

  // ================================
  // EDIT MODE
  // ================================

  function toggleEditMode(enable) {
    isEditMode = enable;

    // Show/hide checkbox column
    const checkboxTh = document.querySelector('.col-checkbox');
    if (checkboxTh) {
      checkboxTh.style.display = isEditMode ? 'table-cell' : 'none';
    }

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

      // Clear selections
      selectedVendorIds.clear();
      updateBulkDeleteButton();
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
      if (window.Toast) {
        Toast.info('No Changes', 'No changes to save.');
      }
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

      if (window.Toast) {
        Toast.success('Changes Saved', `${updates.length} vendor(s) updated successfully!`);
      }
      await loadVendors();
      toggleEditMode(false);
    } catch (err) {
      console.error('[VENDORS] Error saving changes:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving changes.', { details: err.message });
      }
    }
  }

  // ================================
  // ADD VENDOR
  // ================================

  async function addVendor() {
    const vendorName = prompt('Enter vendor name:');
    if (!vendorName || !vendorName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_name: vendorName.trim() })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      if (window.Toast) {
        Toast.success('Vendor Created', 'Vendor created successfully!');
      }
      await loadVendors();
    } catch (err) {
      console.error('[VENDORS] Error creating vendor:', err);
      if (window.Toast) {
        Toast.error('Create Failed', 'Error creating vendor.', { details: err.message });
      }
    }
  }

  // ================================
  // DELETE ROW
  // ================================

  async function deleteRow(vendorId) {
    if (!vendorId) return;

    const vendor = vendors.find(v => v.id === vendorId);
    if (!vendor) return;

    if (!confirm(`Delete vendor "${vendor.vendor_name}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/vendors/${vendorId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      if (window.Toast) {
        Toast.success('Vendor Deleted', 'Vendor deleted successfully!');
      }
      selectedVendorIds.delete(vendorId);
      await loadVendors();
      updateBulkDeleteButton();
    } catch (err) {
      console.error('[VENDORS] Error deleting vendor:', err);
      if (window.Toast) {
        Toast.error('Delete Failed', 'Error deleting vendor.', { details: err.message });
      }
    }
  }

  // ================================
  // BULK DELETE
  // ================================

  async function bulkDeleteVendors() {
    if (selectedVendorIds.size === 0) {
      if (window.Toast) {
        Toast.warning('No Selection', 'No vendors selected.');
      }
      return;
    }

    const confirmed = confirm(`Delete ${selectedVendorIds.size} vendor(s)? This cannot be undone.`);
    if (!confirmed) return;

    els.btnBulkDelete.disabled = true;
    const originalText = els.btnBulkDelete.innerHTML;
    els.btnBulkDelete.innerHTML = '<span style="font-size: 14px;">⏳</span> Deleting...';

    try {
      const deletePromises = Array.from(selectedVendorIds).map(vendorId =>
        fetch(`${API_BASE}/vendors/${vendorId}`, {
          method: 'DELETE'
        }).then(res => {
          if (!res.ok) {
            return res.text().then(text => {
              throw new Error(`Failed to delete vendor ${vendorId}: ${text}`);
            });
          }
          return res;
        })
      );

      await Promise.all(deletePromises);

      if (window.Toast) {
        Toast.success('Vendors Deleted', `${selectedVendorIds.size} vendor(s) deleted successfully!`);
      }
      selectedVendorIds.clear();
      await loadVendors();
      updateBulkDeleteButton();
    } catch (err) {
      console.error('[BULK_DELETE] Error:', err);
      if (window.Toast) {
        Toast.error('Delete Failed', 'Error deleting vendors.', { details: err.message });
      }
    } finally {
      els.btnBulkDelete.disabled = false;
      els.btnBulkDelete.innerHTML = originalText;
    }
  }

  function updateBulkDeleteButton() {
    if (!els.btnBulkDelete || !els.selectedCount) return;

    const count = selectedVendorIds.size;
    els.selectedCount.textContent = count;
    els.btnBulkDelete.disabled = count === 0;

    // Update select all checkbox state
    if (els.selectAllCheckbox && vendors.length > 0) {
      const allSelected = vendors.every(v => selectedVendorIds.has(v.id));
      els.selectAllCheckbox.checked = allSelected;
    }
  }

  function toggleSelectAll() {
    if (!vendors || vendors.length === 0) return;

    const allSelected = vendors.every(v => selectedVendorIds.has(v.id));

    if (allSelected) {
      // Unselect all
      vendors.forEach(v => selectedVendorIds.delete(v.id));
    } else {
      // Select all
      vendors.forEach(v => selectedVendorIds.add(v.id));
    }

    renderVendorsTable();
    updateBulkDeleteButton();
  }

  function toggleRowSelection(vendorId) {
    if (selectedVendorIds.has(vendorId)) {
      selectedVendorIds.delete(vendorId);
    } else {
      selectedVendorIds.add(vendorId);
    }

    updateBulkDeleteButton();

    // Update checkbox visual state
    const checkbox = document.querySelector(`.row-checkbox[data-id="${vendorId}"]`);
    if (checkbox) {
      checkbox.checked = selectedVendorIds.has(vendorId);
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

    // Bulk delete
    els.btnBulkDelete?.addEventListener('click', () => {
      bulkDeleteVendors();
    });

    // Select all checkbox
    els.selectAllCheckbox?.addEventListener('change', () => {
      toggleSelectAll();
    });

    // Delete row and checkbox (delegated)
    els.tbody?.addEventListener('click', (e) => {
      // Delete button
      if (e.target.classList.contains('btn-row-delete')) {
        const vendorId = e.target.getAttribute('data-id');
        deleteRow(vendorId);
      }

      // Checkbox
      if (e.target.classList.contains('row-checkbox')) {
        const vendorId = e.target.getAttribute('data-id');
        toggleRowSelection(vendorId);
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
