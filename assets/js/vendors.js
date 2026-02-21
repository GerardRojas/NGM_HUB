// ================================
// VENDORS TABLE + INTELLIGENCE TABS
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Estado — Vendor List (Tab 1)
  let vendors = [];
  let originalVendors = [];
  let isEditMode = false;
  let selectedVendorIds = new Set();

  // Estado — Intelligence (Tab 2)
  let activeTab = 'list';
  let intelligenceVendors = [];
  let intelligenceLoaded = false;

  // DOM Elements
  const els = {
    // Tab 1: Vendor list
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
    pageLoadingOverlay: document.getElementById('pageLoadingOverlay'),
    // Tab 2: Intelligence
    viSkeletonTable: document.getElementById('viSkeletonTable'),
    viEmptyState: document.getElementById('viEmptyState'),
    viSummaryTable: document.getElementById('viSummaryTable'),
    viSummaryBody: document.getElementById('viSummaryTableBody'),
    viTotalSpend: document.getElementById('viTotalSpend'),
    btnRefreshIntelligence: document.getElementById('btnRefreshIntelligence')
  };

  // ================================
  // HELPERS
  // ================================

  function escapeHtml(str) {
    if (str == null) return '';
    if (window.escapeHtml) return window.escapeHtml(str);
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function fmtCurrencyFull(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function fmtCurrencyShort(n) {
    if (n == null || isNaN(n)) return '$0';
    n = Number(n);
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }

  function fmtDate(dateStr) {
    if (!dateStr || dateStr === '--') return '--';
    try {
      var parts = dateStr.split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2] || '1', 10));
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch (e) {
      return dateStr;
    }
  }

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadVendors();
    setupEventListeners();
  }

  // ================================
  // TABS
  // ================================

  function initTabs() {
    if (!window.NGMTabs) return;

    window.NGMTabs.init('vendors-tabs', {
      onSwitch: function(tabKey) {
        activeTab = tabKey;

        // Load intelligence data on first switch
        if (tabKey === 'intelligence' && !intelligenceLoaded) {
          loadIntelligenceSummary();
        }

        // Cleanup scorecard when leaving intelligence tab
        if (tabKey !== 'intelligence' && window.VendorIntelligence) {
          window.VendorIntelligence.closeScorecard();
        }

        // Update search placeholder
        if (els.searchInput) {
          els.searchInput.placeholder = tabKey === 'intelligence'
            ? 'Search vendor analytics...'
            : 'Search vendors...';
        }

        // Re-apply search to the active tab
        filterActiveTab();
      }
    });
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
  // RENDER TABLE (Tab 1)
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
    const name = vendor.vendor_name || '\u2014';

    return `
      <tr data-index="${index}" data-id="${id}" class="vendor-row-clickable">
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
          <button type="button" class="btn-row-delete" data-id="${id}" title="Delete">\u00d7</button>
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
  // VENDOR INTELLIGENCE SUMMARY (Tab 2)
  // ================================

  async function loadIntelligenceSummary() {
    if (!window.VendorIntelligence) return;

    // Show skeleton, hide table and empty state
    if (els.viSkeletonTable) els.viSkeletonTable.style.display = 'table';
    if (els.viSummaryTable) els.viSummaryTable.style.display = 'none';
    if (els.viEmptyState) els.viEmptyState.style.display = 'none';

    var data = await window.VendorIntelligence.loadSummary();

    if (!data || !data.vendors || data.vendors.length === 0) {
      showIntelligenceEmpty();
      return;
    }

    intelligenceVendors = data.vendors;
    intelligenceLoaded = true;

    // Show total spend badge
    if (els.viTotalSpend && data.total_spend_all_vendors != null) {
      els.viTotalSpend.textContent = 'Total: ' + fmtCurrencyShort(data.total_spend_all_vendors);
      els.viTotalSpend.style.display = 'inline-flex';
    }

    renderIntelligenceTable();
  }

  function renderIntelligenceTable() {
    if (!intelligenceVendors || intelligenceVendors.length === 0) {
      showIntelligenceEmpty();
      return;
    }

    if (els.viSkeletonTable) els.viSkeletonTable.style.display = 'none';
    if (els.viEmptyState) els.viEmptyState.style.display = 'none';
    if (els.viSummaryTable) els.viSummaryTable.style.display = 'table';
    if (!els.viSummaryBody) return;

    els.viSummaryBody.innerHTML = '';

    intelligenceVendors.forEach(function(vendor) {
      var vendorId = vendor.vendor_id || vendor.id || '';
      var name = escapeHtml(vendor.vendor_name || '--');
      var totalAmount = Number(vendor.total_amount || 0);
      var txnCount = Number(vendor.txn_count || 0);
      var projectCount = Number(vendor.project_count || 0);
      var concPct = Number(vendor.concentration_pct || 0);
      var lastActivity = vendor.last_txn_date || vendor.last_activity || '--';

      // Concentration risk color class
      var concClass = 'vi-conc-low';
      if (concPct >= 30) concClass = 'vi-conc-high';
      else if (concPct >= 15) concClass = 'vi-conc-medium';

      var row = '<tr class="vi-summary-row" data-vendor-id="' + escapeHtml(vendorId) + '">' +
        '<td class="vi-col-name">' + name + '</td>' +
        '<td class="vi-col-spend">' + fmtCurrencyFull(totalAmount) + '</td>' +
        '<td class="vi-col-txn">' + txnCount + '</td>' +
        '<td class="vi-col-projects">' + projectCount + '</td>' +
        '<td class="vi-col-conc"><span class="vi-conc-pill ' + concClass + '">' + concPct.toFixed(1) + '%</span></td>' +
        '<td class="vi-col-activity">' + fmtDate(lastActivity) + '</td>' +
      '</tr>';

      els.viSummaryBody.insertAdjacentHTML('beforeend', row);
    });

    // Re-apply search filter
    filterActiveTab();
  }

  function showIntelligenceEmpty() {
    if (els.viSkeletonTable) els.viSkeletonTable.style.display = 'none';
    if (els.viSummaryTable) els.viSummaryTable.style.display = 'none';
    if (els.viEmptyState) els.viEmptyState.style.display = 'flex';
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
    els.btnBulkDelete.innerHTML = '<span style="font-size: 14px;">&#x23F3;</span> Deleting...';

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
      vendors.forEach(v => selectedVendorIds.delete(v.id));
    } else {
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
  // SEARCH (unified for both tabs)
  // ================================

  function filterActiveTab() {
    var searchTerm = els.searchInput ? els.searchInput.value.toLowerCase().trim() : '';

    if (activeTab === 'list') {
      filterVendorsList(searchTerm);
    } else if (activeTab === 'intelligence') {
      filterIntelligenceTable(searchTerm);
    }
  }

  function filterVendorsList(searchTerm) {
    if (!els.tbody) return;
    var rows = els.tbody.querySelectorAll('tr');
    rows.forEach(function(row) {
      var vendorName = row.querySelector('td') ? row.querySelector('td').textContent.toLowerCase() : '';
      row.style.display = vendorName.includes(searchTerm) ? '' : 'none';
    });
  }

  function filterIntelligenceTable(searchTerm) {
    if (!els.viSummaryBody) return;
    var rows = els.viSummaryBody.querySelectorAll('tr');
    rows.forEach(function(row) {
      var vendorName = row.querySelector('.vi-col-name') ? row.querySelector('.vi-col-name').textContent.toLowerCase() : '';
      row.style.display = vendorName.includes(searchTerm) ? '' : 'none';
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

    // Search (unified)
    els.searchInput?.addEventListener('input', filterActiveTab);

    // Intelligence table: click row to open scorecard
    els.viSummaryBody?.addEventListener('click', function(e) {
      var row = e.target.closest('tr.vi-summary-row');
      if (!row) return;
      var vendorId = row.getAttribute('data-vendor-id');
      if (!vendorId || !window.VendorIntelligence) return;

      // Highlight selected row
      els.viSummaryBody.querySelectorAll('tr').forEach(function(r) {
        r.classList.remove('vi-row-selected');
      });
      row.classList.add('vi-row-selected');

      window.VendorIntelligence.loadScorecard(vendorId);
    });

    // Refresh intelligence button
    els.btnRefreshIntelligence?.addEventListener('click', function() {
      intelligenceLoaded = false;
      if (els.viTotalSpend) els.viTotalSpend.style.display = 'none';
      loadIntelligenceSummary();
    });
  }

  // ================================
  // START
  // ================================

  window.addEventListener('DOMContentLoaded', async () => {
    if (window.initTopbarPills) window.initTopbarPills();
    await init();
    initTabs();
  });

})();
