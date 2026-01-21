// ================================
// PROJECTS TABLE - Expenses-style layout
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Estado
  let projects = [];
  let originalProjects = [];
  let isEditMode = false;
  let metaData = {
    companies: [],
    statuses: []
  };

  // DOM Elements
  const els = {
    table: document.getElementById('projectsTable'),
    tbody: document.getElementById('projectsTableBody'),
    emptyState: document.getElementById('projectsEmptyState'),
    btnEditProjects: document.getElementById('btnEditProjects'),
    btnAddProject: document.getElementById('btnAddProject'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    editModeFooter: document.getElementById('editModeFooter'),
    pageLoadingOverlay: document.getElementById('pageLoadingOverlay')
  };

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadMeta();
    await loadProjects();
    setupEventListeners();
  }

  // ================================
  // LOAD DATA
  // ================================

  async function loadMeta() {
    try {
      const res = await fetch(`${API_BASE}/projects/meta`);
      if (!res.ok) {
        console.error('[PROJECTS] Error loading meta:', await res.text());
        return;
      }
      const json = await res.json();
      metaData.companies = json.companies || [];
      metaData.statuses = json.statuses || [];
      console.log('[PROJECTS] Meta loaded:', metaData);
    } catch (err) {
      console.error('[PROJECTS] Network error loading meta:', err);
    }
  }

  async function loadProjects() {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      if (!res.ok) {
        const text = await res.text();
        console.error('[PROJECTS] Error loading projects:', text);
        showEmptyState();
        hidePageLoading();
        return;
      }

      const json = await res.json();
      projects = json.data || [];
      originalProjects = JSON.parse(JSON.stringify(projects));

      renderProjectsTable();
      els.btnEditProjects.disabled = projects.length === 0;
      hidePageLoading();
    } catch (err) {
      console.error('[PROJECTS] Network error:', err);
      showEmptyState();
      hidePageLoading();
    }
  }

  // ================================
  // RENDER TABLE
  // ================================

  function renderProjectsTable() {
    if (!projects || projects.length === 0) {
      showEmptyState();
      return;
    }

    els.emptyState.style.display = 'none';
    els.table.style.display = 'table';
    els.tbody.innerHTML = '';

    projects.forEach((project, index) => {
      const row = isEditMode ? renderEditRow(project, index) : renderReadRow(project, index);
      els.tbody.insertAdjacentHTML('beforeend', row);
    });
  }

  function renderReadRow(proj, index) {
    const id = proj.project_id || proj.id || '';
    const name = proj.project_name || '—';
    const companyName = proj.company_name || findMetaName('companies', proj.source_company, 'company_id', 'name') || '—';
    const city = proj.city || '—';
    const client = proj.client_name || proj.client || '—';
    const statusName = proj.status_name || findMetaName('statuses', proj.status, 'status_id', 'status') || '';
    const statusClass = statusName.toLowerCase() === 'active' ? 'status-pill--active' : '';

    return `
      <tr data-index="${index}" data-id="${id}">
        <td>${name}</td>
        <td>${companyName}</td>
        <td>${city}</td>
        <td>${client}</td>
        <td><span class="status-pill ${statusClass}">${statusName || '—'}</span></td>
        <td class="col-actions"></td>
      </tr>
    `;
  }

  function renderEditRow(proj, index) {
    const id = proj.project_id || proj.id || '';
    const name = proj.project_name || '';
    const city = proj.city || '';
    const client = proj.client_name || proj.client || '';

    return `
      <tr data-index="${index}" data-id="${id}" class="edit-mode-row">
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="project_name" value="${name}" placeholder="Project name">
        </td>
        <td class="editable-cell">
          ${buildSelectHtml('source_company', proj.source_company, metaData.companies, 'company_id', 'name')}
        </td>
        <td class="editable-cell">
          <input type="text" class="edit-input" data-field="city" value="${city}" placeholder="City">
        </td>
        <td>${client}</td>
        <td class="editable-cell">
          ${buildSelectHtml('status', proj.status, metaData.statuses, 'status_id', 'status')}
        </td>
        <td class="col-actions">
          <button type="button" class="btn-row-delete" data-index="${index}" title="Delete">×</button>
        </td>
      </tr>
    `;
  }

  function buildSelectHtml(field, selectedValue, options, valueKey, labelKey) {
    // Generate unique ID for datalist
    const listId = `datalist-${field}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Find the selected option's label
    const selectedOption = options.find(opt => opt[valueKey] == selectedValue);
    const selectedLabel = selectedOption ? (selectedOption[labelKey] || '') : '';

    // Build datalist options
    const opts = options.map(opt => {
      const val = opt[valueKey];
      const label = opt[labelKey] || '—';
      return `<option value="${label}" data-id="${val}"></option>`;
    }).join('');

    return `
      <input
        type="text"
        class="edit-input edit-input-datalist"
        data-field="${field}"
        data-value-id="${selectedValue || ''}"
        value="${selectedLabel}"
        list="${listId}"
        placeholder="Select..."
        autocomplete="off"
      >
      <datalist id="${listId}">
        ${opts}
      </datalist>
    `;
  }

  function findMetaName(metaKey, id, idKey, nameKey) {
    const item = metaData[metaKey].find(x => x[idKey] == id);
    return item ? item[nameKey] : null;
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
      els.btnEditProjects.textContent = 'Cancel Edit';
      els.btnEditProjects.classList.remove('btn-toolbar-secondary');
      els.btnEditProjects.classList.add('btn-toolbar-danger');
      els.btnAddProject.disabled = true;
      els.editModeFooter.classList.remove('hidden');
    } else {
      els.btnEditProjects.textContent = 'Edit Projects';
      els.btnEditProjects.classList.remove('btn-toolbar-danger');
      els.btnEditProjects.classList.add('btn-toolbar-secondary');
      els.btnAddProject.disabled = false;
      els.editModeFooter.classList.add('hidden');

      // Restore original data
      projects = JSON.parse(JSON.stringify(originalProjects));
    }

    renderProjectsTable();
  }

  // ================================
  // SAVE CHANGES
  // ================================

  async function saveChanges() {
    const rows = els.tbody.querySelectorAll('tr');
    const updates = [];

    rows.forEach(row => {
      const index = parseInt(row.getAttribute('data-index'), 10);
      const original = originalProjects[index];
      const current = projects[index];

      // Collect current values from inputs
      const inputs = row.querySelectorAll('.edit-input');
      inputs.forEach(input => {
        const field = input.getAttribute('data-field');

        // For datalist inputs, use the stored ID value
        if (input.classList.contains('edit-input-datalist')) {
          const valueId = input.getAttribute('data-value-id');
          current[field] = valueId || null;
        } else {
          const value = input.value.trim();
          current[field] = value || null;
        }
      });

      // Check if changed
      const changed = JSON.stringify(original) !== JSON.stringify(current);

      if (changed) {
        updates.push({
          id: current.project_id || current.id,
          data: {
            project_name: current.project_name,
            source_company: current.source_company,
            city: current.city,
            status: current.status
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
        const res = await fetch(`${API_BASE}/projects/${update.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Failed to update project ${update.id}: ${errText}`);
        }
      }

      alert(`${updates.length} project(s) updated successfully!`);
      await loadProjects();
      toggleEditMode(false);
    } catch (err) {
      console.error('[PROJECTS] Error saving changes:', err);
      alert(`Error saving changes: ${err.message}`);
    }
  }

  // ================================
  // DELETE ROW
  // ================================

  function deleteRow(index) {
    if (!confirm('Delete this project?')) return;

    projects.splice(index, 1);
    renderProjectsTable();
  }

  // ================================
  // EVENT LISTENERS
  // ================================

  function setupEventListeners() {
    // Edit button
    els.btnEditProjects?.addEventListener('click', () => {
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

    // Add project
    els.btnAddProject?.addEventListener('click', () => {
      alert('Add project functionality - to be implemented');
    });

    // Datalist selection - update data-value-id when user selects an option
    els.tbody?.addEventListener('input', (e) => {
      if (e.target.classList.contains('edit-input-datalist')) {
        const input = e.target;
        const listId = input.getAttribute('list');
        const datalist = document.getElementById(listId);

        if (datalist) {
          const matchingOption = Array.from(datalist.options).find(
            opt => opt.value === input.value
          );

          if (matchingOption) {
            input.setAttribute('data-value-id', matchingOption.getAttribute('data-id') || '');
          } else {
            // User typed something not in the list - clear the ID
            input.setAttribute('data-value-id', '');
          }
        }
      }
    });

    // Delete row (delegated)
    els.tbody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-row-delete')) {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        deleteRow(index);
      }
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
