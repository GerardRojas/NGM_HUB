// assets/js/pipeline_edit_task_ui.js
// Edit Task Modal - Full task editing with all fields
(function () {
  'use strict';

  const qs = (id) => document.getElementById(id);

  // Current task being edited
  let currentTask = null;
  let currentTaskId = null;

  // People picker instances
  let ownerPicker = null;
  let collaboratorPicker = null;
  let managerPicker = null;

  // Catalog picker instances
  let companyPicker = null;
  let projectPicker = null;
  let departmentPicker = null;
  let typePicker = null;
  let priorityPicker = null;

  // Status options (same as pipeline groups)
  const STATUS_OPTIONS = [
    { value: 'not started', label: 'Not Started', color: '#facc15' },
    { value: 'working on it', label: 'Working on It', color: '#3b82f6' },
    { value: 'awaiting approval', label: 'Awaiting Approval', color: '#fb923c' },
    { value: 'good to go', label: 'Good to Go', color: '#10b981' },
    { value: 'correction', label: 'Correction', color: '#f87171' },
    { value: 'resubmittal needed', label: 'Resubmittal Needed', color: '#eab308' },
    { value: 'done', label: 'Done', color: '#22c55e' },
    { value: 'delayed', label: 'Delayed', color: '#a855f7' },
  ];

  // ================================
  // MODAL OPEN/CLOSE
  // ================================
  function open(task) {
    const modal = qs('editTaskModal');
    if (!modal) {
      console.warn('[EditTask] editTaskModal not found');
      return;
    }

    currentTask = task;
    currentTaskId = task?.task_id || task?.id || null;

    if (!currentTaskId) {
      console.error('[EditTask] No task ID provided');
      return;
    }

    // Render form with task data
    renderForm(task);

    // Show modal
    modal.classList.remove('hidden');

    // Focus first input
    setTimeout(() => {
      const first = modal.querySelector('input, textarea, select');
      if (first) first.focus();
    }, 50);
  }

  function close() {
    const modal = qs('editTaskModal');
    if (!modal) return;

    modal.classList.add('hidden');
    currentTask = null;
    currentTaskId = null;

    // Destroy people pickers (removes document event listeners)
    ownerPicker?.destroy?.();
    collaboratorPicker?.destroy?.();
    managerPicker?.destroy?.();
    ownerPicker = null;
    collaboratorPicker = null;
    managerPicker = null;

    // Destroy catalog pickers (removes document event listeners)
    companyPicker?.destroy?.();
    projectPicker?.destroy?.();
    departmentPicker?.destroy?.();
    typePicker?.destroy?.();
    priorityPicker?.destroy?.();
    companyPicker = null;
    projectPicker = null;
    departmentPicker = null;
    typePicker = null;
    priorityPicker = null;
  }

  // ================================
  // RENDER FORM
  // ================================
  function renderForm(task) {
    const form = qs('editTaskForm');
    if (!form) return;

    const t = task || {};

    // Extract values from task
    const taskDescription = t.task_description || t.title || '';
    const taskNotes = t.task_notes || '';
    const company = t.company_name || t.company || '';
    const project = t.project_name || t.project || '';
    const department = t.department || '';
    const type = t.type || '';
    const status = (t.status?.name || t.status_name || t.status || 'not started').toLowerCase();
    const dueDate = formatDateForInput(t.due_date || t.due);
    const deadline = formatDateForInput(t.deadline);
    const startDate = formatDateForInput(t.start_date);
    const timeStart = t.time_start || '';
    const timeFinish = t.time_finish || '';
    const estimatedHours = t.estimated_hours ?? '';
    const docsLink = t.docs_link || '';
    const resultLink = t.result_link || '';

    // Build status options HTML
    const statusOptionsHtml = STATUS_OPTIONS.map(opt => `
      <option value="${opt.value}" ${status === opt.value ? 'selected' : ''}>
        ${opt.label}
      </option>
    `).join('');

    form.innerHTML = `
      <!-- TASK INFO -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Task Information</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field pm-form-field--full">
            <label class="pm-form-label">Task Description <span class="required">*</span></label>
            <input id="et_task" class="pm-form-input" type="text" value="${escapeHtml(taskDescription)}" required />
          </div>

          <div class="pm-form-field pm-form-field--full">
            <label class="pm-form-label">Notes</label>
            <textarea id="et_notes" class="pm-form-textarea" placeholder="Additional details...">${escapeHtml(taskNotes)}</textarea>
          </div>
        </div>
      </section>

      <!-- STATUS & CLASSIFICATION -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Status & Classification</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Status <span class="required">*</span></label>
            <select id="et_status" class="pm-form-select">
              ${statusOptionsHtml}
            </select>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Company</label>
            <div id="et_company_picker" data-current="${escapeHtml(company)}"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Project</label>
            <div id="et_project_picker" data-current="${escapeHtml(project)}"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Department</label>
            <div id="et_department_picker" data-current="${escapeHtml(department)}"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Type</label>
            <div id="et_type_picker" data-current="${escapeHtml(type)}"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Priority</label>
            <div id="et_priority_picker" data-current="${escapeHtml(t.priority_name || t.priority || '')}"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Estimated Hours</label>
            <input id="et_estimated_hours" class="pm-form-input" type="number" step="0.5" min="0" value="${estimatedHours}" placeholder="0.0" />
          </div>
        </div>
      </section>

      <!-- PEOPLE -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">People</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Owner <span class="required">*</span></label>
            <div id="et_owner_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Collaborator</label>
            <div id="et_collaborator_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Manager</label>
            <div id="et_manager_picker"></div>
          </div>
        </div>
      </section>

      <!-- SCHEDULE -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Schedule</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Start Date</label>
            <input id="et_start_date" class="pm-form-input" type="date" value="${startDate}" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Due Date</label>
            <input id="et_due" class="pm-form-input" type="date" value="${dueDate}" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Deadline</label>
            <input id="et_deadline" class="pm-form-input" type="date" value="${deadline}" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Time Start</label>
            <input id="et_time_start" class="pm-form-input" type="time" value="${timeStart}" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Time Finish</label>
            <input id="et_time_finish" class="pm-form-input" type="time" value="${timeFinish}" />
          </div>
        </div>
      </section>

      <!-- LINKS -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Links</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Documentation Link</label>
            <input id="et_docs_link" class="pm-form-input" type="url" value="${escapeHtml(docsLink)}" placeholder="https://..." />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Result Link</label>
            <input id="et_result_link" class="pm-form-input" type="url" value="${escapeHtml(resultLink)}" placeholder="https://..." />
          </div>
        </div>
      </section>
    `;

    // Initialize people pickers
    initPeoplePickers(task);

    // Initialize catalog pickers
    initCatalogPickers(task);
  }

  // ================================
  // INITIALIZE PEOPLE PICKERS
  // ================================
  function initPeoplePickers(task, _retries = 0) {
    if (typeof window.createPeoplePicker !== 'function') {
      if (_retries >= 30) {
        console.error('[EditTask] PeoplePicker failed to load after 3s, giving up');
        return;
      }
      setTimeout(() => initPeoplePickers(task, _retries + 1), 100);
      return;
    }

    const t = task || {};

    // Owner picker (single select)
    const ownerContainer = qs('et_owner_picker');
    if (ownerContainer) {
      ownerPicker = window.createPeoplePicker(ownerContainer, {
        multiple: false,
        placeholder: 'Select owner...',
        onChange: (users) => {
          console.log('[EditTask] Owner changed:', users);
        }
      });

      // Pre-select owner if exists
      const ownerName = t.owner?.name || t.owner_name || t.assigned_to || '';
      if (ownerName) {
        preSelectUser(ownerPicker, ownerName, t.owner?.id || t.owner_id);
      }
    }

    // Collaborator picker (multi-select)
    const collabContainer = qs('et_collaborator_picker');
    if (collabContainer) {
      collaboratorPicker = window.createPeoplePicker(collabContainer, {
        multiple: true,
        placeholder: 'Add collaborators...',
        maxDisplay: 2,
        onChange: (users) => {
          console.log('[EditTask] Collaborators changed:', users);
        }
      });

      // Pre-select collaborators if exist
      if (Array.isArray(t.collaborators) && t.collaborators.length > 0) {
        // Will need to wait for users to load then select
        preSelectUsers(collaboratorPicker, t.collaborators);
      }
    }

    // Manager picker (single select)
    const managerContainer = qs('et_manager_picker');
    if (managerContainer) {
      managerPicker = window.createPeoplePicker(managerContainer, {
        multiple: false,
        placeholder: 'Select manager...',
        onChange: (users) => {
          console.log('[EditTask] Manager changed:', users);
        }
      });

      // Pre-select manager if exists
      const managerName = t.manager?.name || t.manager_name || '';
      if (managerName) {
        preSelectUser(managerPicker, managerName, t.manager?.id || t.manager_id);
      }
    }
  }

  // ================================
  // INITIALIZE CATALOG PICKERS
  // ================================
  function initCatalogPickers(task, _retries = 0) {
    if (typeof window.createCatalogPicker !== 'function') {
      if (_retries >= 30) {
        console.error('[EditTask] CatalogPicker failed to load after 3s, giving up');
        return;
      }
      setTimeout(() => initCatalogPickers(task, _retries + 1), 100);
      return;
    }

    const t = task || {};

    // Company picker
    const companyContainer = qs('et_company_picker');
    if (companyContainer) {
      const currentCompany = companyContainer.dataset.current || '';
      companyPicker = window.createCatalogPicker(companyContainer, {
        catalogType: 'company',
        placeholder: 'Select company...',
        onChange: (item) => {
          console.log('[EditTask] Company changed:', item);
        }
      });
      if (currentCompany) {
        preSelectCatalogItem(companyPicker, 'company', currentCompany, t.company_id);
      }
    }

    // Project picker
    const projectContainer = qs('et_project_picker');
    if (projectContainer) {
      const currentProject = projectContainer.dataset.current || '';
      projectPicker = window.createCatalogPicker(projectContainer, {
        catalogType: 'project',
        placeholder: 'Select project...',
        onChange: (item) => {
          console.log('[EditTask] Project changed:', item);
        }
      });
      if (currentProject) {
        preSelectCatalogItem(projectPicker, 'project', currentProject, t.project_id);
      }
    }

    // Department picker
    const deptContainer = qs('et_department_picker');
    if (deptContainer) {
      const currentDept = deptContainer.dataset.current || '';
      departmentPicker = window.createCatalogPicker(deptContainer, {
        catalogType: 'department',
        placeholder: 'Select department...',
        onChange: (item) => {
          console.log('[EditTask] Department changed:', item);
        }
      });
      if (currentDept) {
        preSelectCatalogItem(departmentPicker, 'department', currentDept, t.department_id);
      }
    }

    // Type picker
    const typeContainer = qs('et_type_picker');
    if (typeContainer) {
      const currentType = typeContainer.dataset.current || '';
      typePicker = window.createCatalogPicker(typeContainer, {
        catalogType: 'type',
        placeholder: 'Select type...',
        onChange: (item) => {
          console.log('[EditTask] Type changed:', item);
        }
      });
      if (currentType) {
        preSelectCatalogItem(typePicker, 'type', currentType, t.type_id);
      }
    }

    // Priority picker
    const priorityContainer = qs('et_priority_picker');
    if (priorityContainer) {
      const currentPriority = priorityContainer.dataset.current || '';
      priorityPicker = window.createCatalogPicker(priorityContainer, {
        catalogType: 'priority',
        placeholder: 'Select priority...',
        onChange: (item) => {
          console.log('[EditTask] Priority changed:', item);
        }
      });
      if (currentPriority) {
        preSelectCatalogItem(priorityPicker, 'priority', currentPriority, t.priority_id);
      }
    }
  }

  // Pre-select a catalog item in picker by name/id
  async function preSelectCatalogItem(picker, catalogType, name, id) {
    if (!picker) return;

    // Poll until items are loaded (max 3 seconds, check every 100ms)
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (picker.items && picker.items.length > 0) {
        const item = picker.items.find(i =>
          i.id === id ||
          (i.name && i.name.toLowerCase() === name.toLowerCase())
        );
        if (item && picker.setValue) {
          picker.setValue(item);
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn(`[EditTask] Timeout waiting for ${catalogType} items to load`);
  }

  // Pre-select a user in picker by name/id
  async function preSelectUser(picker, name, id) {
    if (!picker) return;

    // Poll until users are loaded (max 3 seconds, check every 100ms)
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (picker.users && picker.users.length > 0) {
        const user = picker.users.find(u =>
          u.id === id ||
          u.name.toLowerCase() === name.toLowerCase()
        );
        if (user) {
          picker.selectedUsers = [user];
          picker.renderSelected();
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn('[EditTask] Timeout waiting for users to load for pre-selection');
  }

  async function preSelectUsers(picker, collaborators) {
    if (!picker || !collaborators.length) return;

    // Poll until users are loaded (max 3 seconds, check every 100ms)
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (picker.users && picker.users.length > 0) {
        const selected = [];
        collaborators.forEach(c => {
          const name = c.name || c;
          const id = c.id;
          const user = picker.users.find(u =>
            u.id === id ||
            u.name.toLowerCase() === name.toLowerCase()
          );
          if (user) selected.push(user);
        });

        if (selected.length) {
          picker.selectedUsers = selected;
          picker.renderSelected();
        }
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    console.warn('[EditTask] Timeout waiting for users to load for collaborators pre-selection');
  }

  // ================================
  // BUILD PAYLOAD
  // ================================
  function buildPayloadFromForm() {
    const ownerUser = ownerPicker?.getValue();
    const collaborators = collaboratorPicker?.getValue() || [];
    const managerUser = managerPicker?.getValue();

    // Get catalog picker values (returns {id, name} or null)
    const companyItem = companyPicker?.getValue?.() || null;
    const projectItem = projectPicker?.getValue?.() || null;
    const departmentItem = departmentPicker?.getValue?.() || null;
    const typeItem = typePicker?.getValue?.() || null;
    const priorityItem = priorityPicker?.getValue?.() || null;

    const payload = {
      task_description: qs('et_task')?.value?.trim() || '',
      task_notes: qs('et_notes')?.value?.trim() || null,
      status: qs('et_status')?.value || 'not started',
      company: companyItem?.id || null,
      project: projectItem?.id || null,
      department: departmentItem?.id || null,
      type: typeItem?.id || null,
      priority: priorityItem?.id || null,
      estimated_hours: parseFloat(qs('et_estimated_hours')?.value) || null,
      owner: ownerUser?.id || null,
      collaborators: collaborators.length > 0 ? collaborators.map(u => u.id) : null,
      manager: managerUser?.id || null,
      start_date: qs('et_start_date')?.value || null,
      due_date: qs('et_due')?.value || null,
      deadline: qs('et_deadline')?.value || null,
      time_start: qs('et_time_start')?.value || null,
      time_finish: qs('et_time_finish')?.value || null,
      docs_link: qs('et_docs_link')?.value?.trim() || null,
      result_link: qs('et_result_link')?.value?.trim() || null,
    };

    // Validate required
    if (!payload.task_description) {
      if (window.Toast) {
        Toast.warning('Missing Fields', 'Task description is required.');
      } else {
        console.warn('[EditTask] Missing: Task description is required');
      }
      return null;
    }

    if (!ownerUser) {
      if (window.Toast) {
        Toast.warning('Missing Fields', 'Owner is required.');
      } else {
        console.warn('[EditTask] Missing: Owner is required');
      }
      return null;
    }

    return payload;
  }

  // ================================
  // SAVE TASK
  // ================================
  async function saveTask() {
    const payload = buildPayloadFromForm();
    if (!payload) return;

    const btn = qs('btnSaveTask');
    const originalText = btn?.textContent || 'Save Changes';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      const apiBase = window.API_BASE || '';
      const res = await fetch(`${apiBase}/pipeline/tasks/${currentTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      const updated = await res.json();
      console.log('[EditTask] Updated:', updated);

      if (window.Toast) {
        Toast.success('Task Updated', 'Changes saved successfully!');
      } else {
        console.log('[EditTask] Task updated successfully');
      }

      close();

      // Refresh pipeline
      if (typeof window.fetchPipeline === 'function') {
        window.fetchPipeline().catch(err => console.warn('[Pipeline] Refresh failed:', err));
      }

    } catch (err) {
      console.error('[EditTask] Error:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving changes.', { details: err.message });
      } else {
        console.warn('[EditTask] Save failed:', err.message);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  // ================================
  // DELETE TASK
  // ================================
  async function deleteTask() {
    if (!currentTaskId) return;

    // Confirm deletion
    const confirmed = confirm('Are you sure you want to delete this task? This action cannot be undone.');
    if (!confirmed) return;

    const btn = qs('btnDeleteTask');
    const originalText = btn?.textContent || 'Delete';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
    }

    try {
      const apiBase = window.API_BASE || '';
      const res = await fetch(`${apiBase}/pipeline/tasks/${currentTaskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      console.log('[EditTask] Deleted task:', currentTaskId);

      if (window.Toast) {
        Toast.success('Task Deleted', 'Task has been removed.');
      } else {
        console.log('[EditTask] Task deleted successfully');
      }

      close();

      // Refresh pipeline
      if (typeof window.fetchPipeline === 'function') {
        window.fetchPipeline().catch(err => console.warn('[Pipeline] Refresh failed:', err));
      }

    } catch (err) {
      console.error('[EditTask] Delete error:', err);
      if (window.Toast) {
        Toast.error('Delete Failed', 'Error deleting task.', { details: err.message });
      } else {
        console.warn('[EditTask] Delete failed:', err.message);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  // ================================
  // UTILITIES (use shared PipelineUtils)
  // ================================
  const escapeHtml = window.PipelineUtils?.escapeHtml || (s => String(s ?? ''));

  function formatDateForInput(dateValue) {
    if (!dateValue) return '';
    const str = String(dateValue);
    // Handle ISO dates (2025-12-07T06:21:42.156005Z)
    if (str.includes('T')) {
      return str.split('T')[0];
    }
    return str;
  }

  // ================================
  // BIND EVENTS
  // ================================
  function bind() {
    // Close button
    qs('btnCloseEditTaskModal')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    // Cancel button
    qs('btnCancelEditTask')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    // Save button
    qs('btnSaveTask')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveTask();
    });

    // Delete button
    qs('btnDeleteTask')?.addEventListener('click', (e) => {
      e.preventDefault();
      deleteTask();
    });

    // Click backdrop to close
    const modal = qs('editTaskModal');
    if (modal) {
      modal.addEventListener('click', close);

      // Prevent close when clicking inside modal card
      const dialog = modal.querySelector('.modal');
      dialog?.addEventListener('click', (ev) => ev.stopPropagation());
    }

    // Escape to close
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const modal = qs('editTaskModal');
        if (modal && !modal.classList.contains('hidden')) {
          close();
        }
      }
    });
  }

  // ================================
  // EXPOSE TO GLOBAL
  // ================================
  window.PM_EditTask = { open, close, bind };

})();
