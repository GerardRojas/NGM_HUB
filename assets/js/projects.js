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
  let selectedCompanyId = '';
  let metaData = {
    companies: [],
    statuses: [],
    clients: []
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
    pageLoadingOverlay: document.getElementById('pageLoadingOverlay'),
    // Add Project Modal
    addProjectModal: document.getElementById('addProjectModal'),
    addProjectForm: document.getElementById('addProjectForm'),
    btnCloseAddModal: document.getElementById('btnCloseAddModal'),
    btnCancelAddProject: document.getElementById('btnCancelAddProject'),
    btnConfirmAddProject: document.getElementById('btnConfirmAddProject'),
    companyFilter: document.getElementById('companyFilter'),
    // Add Project Form Fields
    newProjectName: document.getElementById('newProjectName'),
    newProjectCompany: document.getElementById('newProjectCompany'),
    newProjectClient: document.getElementById('newProjectClient'),
    newProjectAddress: document.getElementById('newProjectAddress'),
    newProjectCity: document.getElementById('newProjectCity'),
    newProjectStatus: document.getElementById('newProjectStatus')
  };

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadMeta();
    populateCompanyFilter();
    await loadProjects();
    setupEventListeners();
  }

  function populateCompanyFilter() {
    if (!els.companyFilter) return;
    els.companyFilter.innerHTML = '<option value="">All Companies</option>';
    metaData.companies.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.company_id;
      opt.textContent = c.name;
      els.companyFilter.appendChild(opt);
    });
  }

  function getFilteredProjects() {
    if (!selectedCompanyId) return projects;
    return projects.filter(p => p.source_company === selectedCompanyId);
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
      metaData.clients = json.clients || [];
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
    const filtered = isEditMode ? projects : getFilteredProjects();

    if (!filtered || filtered.length === 0) {
      showEmptyState();
      return;
    }

    els.emptyState.style.display = 'none';
    els.table.style.display = 'table';
    els.tbody.innerHTML = '';

    filtered.forEach((project, index) => {
      const realIndex = isEditMode ? index : projects.indexOf(project);
      const row = isEditMode ? renderEditRow(project, realIndex) : renderReadRow(project, realIndex);
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
    const textEl = els.emptyState.querySelector('.expenses-empty-text');
    if (textEl) {
      textEl.textContent = selectedCompanyId ? 'No projects for this company' : 'No projects found';
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
      if (window.Toast) {
        Toast.info('No Changes', 'No changes to save.');
      }
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

      if (window.Toast) {
        Toast.success('Changes Saved', `${updates.length} project(s) updated successfully!`);
      }
      await loadProjects();
      toggleEditMode(false);
    } catch (err) {
      console.error('[PROJECTS] Error saving changes:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving changes.', { details: err.message });
      }
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
  // ADD PROJECT MODAL
  // ================================

  function openAddProjectModal() {
    // Reset form
    els.addProjectForm?.reset();

    // Populate company dropdown
    if (els.newProjectCompany) {
      els.newProjectCompany.innerHTML = '<option value="">Select a company...</option>';
      metaData.companies.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.company_id;
        opt.textContent = c.name;
        els.newProjectCompany.appendChild(opt);
      });
    }

    // Populate client dropdown
    if (els.newProjectClient) {
      els.newProjectClient.innerHTML = '<option value="">Select a client (optional)...</option>';
      metaData.clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.client_id;
        opt.textContent = c.client_name;
        els.newProjectClient.appendChild(opt);
      });
    }

    // Populate status dropdown
    if (els.newProjectStatus) {
      els.newProjectStatus.innerHTML = '<option value="">Select a status (optional)...</option>';
      metaData.statuses.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.status_id;
        opt.textContent = s.status;
        els.newProjectStatus.appendChild(opt);
      });
    }

    // Show modal
    els.addProjectModal?.classList.remove('hidden');
  }

  function closeAddProjectModal() {
    els.addProjectModal?.classList.add('hidden');
  }

  async function createProject() {
    // Validate required fields
    const projectName = els.newProjectName?.value.trim();
    const sourceCompany = els.newProjectCompany?.value;

    if (!projectName) {
      if (window.Toast) {
        Toast.warning('Missing Field', 'Please enter a project name.');
      }
      els.newProjectName?.focus();
      return;
    }

    if (!sourceCompany) {
      if (window.Toast) {
        Toast.warning('Missing Field', 'Please select a company.');
      }
      els.newProjectCompany?.focus();
      return;
    }

    // Build payload
    const payload = {
      project_name: projectName,
      source_company: sourceCompany,
      client: els.newProjectClient?.value || null,
      address: els.newProjectAddress?.value.trim() || null,
      city: els.newProjectCity?.value.trim() || null,
      status: els.newProjectStatus?.value || null
    };

    // Disable button and show loading
    const btn = els.btnConfirmAddProject;
    const originalText = btn?.textContent;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creating...';
    }

    try {
      const res = await fetch(`${API_BASE}/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to create project');
      }

      const json = await res.json();
      console.log('[PROJECTS] Project created:', json);

      // Close modal and reload projects
      closeAddProjectModal();
      await loadProjects();

      if (window.Toast) {
        Toast.success('Project Created', 'Project created successfully!');
      }
    } catch (err) {
      console.error('[PROJECTS] Error creating project:', err);
      if (window.Toast) {
        Toast.error('Create Failed', 'Error creating project.', { details: err.message });
      }
    } finally {
      // Restore button
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
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

    // Add project - open modal
    els.btnAddProject?.addEventListener('click', () => {
      openAddProjectModal();
    });

    // Close add project modal
    els.btnCloseAddModal?.addEventListener('click', () => {
      closeAddProjectModal();
    });

    els.btnCancelAddProject?.addEventListener('click', () => {
      closeAddProjectModal();
    });

    // Confirm add project
    els.btnConfirmAddProject?.addEventListener('click', () => {
      createProject();
    });

    // Company filter
    els.companyFilter?.addEventListener('change', () => {
      selectedCompanyId = els.companyFilter.value;
      renderProjectsTable();
    });

    // Close modal on overlay click
    els.addProjectModal?.addEventListener('click', (e) => {
      if (e.target === els.addProjectModal) {
        closeAddProjectModal();
      }
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
  // TABS INTEGRATION (hooks into ngm_tabs.js)
  // ================================

  function initTabs() {
    if (!window.NGMTabs) return;

    // Populate project dropdowns in dashboard/timeline tabs
    function populateProjectDropdowns() {
      const selects = [
        document.getElementById('dashboardProjectSelect'),
        document.getElementById('timelineProjectSelect')
      ];
      selects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '<option value="">Choose a project...</option>';
        projects.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.project_id || p.id;
          opt.textContent = p.project_name || p.project_id;
          sel.appendChild(opt);
        });
      });
    }

    // Dashboard project selector
    const dashSel = document.getElementById('dashboardProjectSelect');
    if (dashSel) {
      dashSel.addEventListener('change', () => {
        if (dashSel.value && window.ProjectDashboard) {
          window.ProjectDashboard.load(dashSel.value);
        }
      });
    }

    // Timeline project selector
    const tlSel = document.getElementById('timelineProjectSelect');
    if (tlSel) {
      tlSel.addEventListener('change', () => {
        if (tlSel.value && window.ProjectTimeline) {
          window.ProjectTimeline.load(tlSel.value);
        }
      });
    }

    // Permission check for KPIs tab
    function canViewKPIs() {
      try {
        const perms = JSON.parse(localStorage.getItem('sidebar_permissions') || '[]');
        const mod = perms.find(p => p.module_key === 'project_kpis');
        return mod ? mod.can_view : false;
      } catch { return false; }
    }

    window.NGMTabs.init('projects-tabs', {
      permissionCheck: (tabKey) => {
        if (tabKey === 'kpis') return canViewKPIs();
        return true;
      },
      onSwitch: (tabKey) => {
        // Populate dropdowns when switching to dashboard/timeline tabs
        if (tabKey === 'dashboard' || tabKey === 'timeline') {
          populateProjectDropdowns();
        }
        // Load KPIs when switching to kpis tab
        if (tabKey === 'kpis' && window.ProjectKPIs) {
          window.ProjectKPIs.load();
        }
        // Load Scorecard when switching to scorecard tab
        if (tabKey === 'scorecard' && window.ProjectScorecard) {
          window.ProjectScorecard.load();
        }
        // Unload modules when leaving tabs
        if (tabKey !== 'dashboard' && window.ProjectDashboard) {
          window.ProjectDashboard.unload();
        }
        if (tabKey !== 'kpis' && window.ProjectKPIs) {
          window.ProjectKPIs.unload();
        }
        if (tabKey !== 'timeline' && window.ProjectTimeline) {
          window.ProjectTimeline.unload();
        }
        if (tabKey !== 'scorecard' && window.ProjectScorecard) {
          window.ProjectScorecard.unload();
        }
      }
    });
  }

  // Make projects accessible to tabs (for dropdown population)
  function getProjects() { return projects; }

  // Expose for external access
  window.ProjectsPage = { getProjects };

  // ================================
  // START
  // ================================

  window.addEventListener('DOMContentLoaded', async () => {
    if (window.initTopbarPills) window.initTopbarPills();
    await init();
    initTabs();
  });

})();
