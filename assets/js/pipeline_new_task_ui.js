// assets/js/pipeline_new_task_ui.js
(function () {
  const qs = (id) => document.getElementById(id);

  // People picker instances
  let ownerPicker = null;
  let collaboratorPicker = null;

  // Catalog picker instances
  let companyPicker = null;
  let projectPicker = null;
  let departmentPicker = null;
  let typePicker = null;
  let priorityPicker = null;

  function open() {
    const modal = qs("newTaskModal");
    if (!modal) return console.warn("[NewTask] newTaskModal not found (partial not loaded?)");
    modal.classList.remove("hidden");

    // Focus al primer input si existe
    const first = modal.querySelector("input, textarea, select, button");
    if (first) setTimeout(() => first.focus(), 30);
  }

  function close() {
    const modal = qs("newTaskModal");
    if (!modal) return;
    modal.classList.add("hidden");

    // Destroy people pickers (removes document event listeners)
    ownerPicker?.destroy?.();
    collaboratorPicker?.destroy?.();
    ownerPicker = null;
    collaboratorPicker = null;

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
  // Render form (New Task fields)
  // ================================
  function renderForm() {
    const form = qs("newTaskForm");
    if (!form) return;

    form.innerHTML = `
      <!-- BASICS -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Basics</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field pm-form-field--full">
            <label class="pm-form-label">Task Description <span class="required">*</span></label>
            <input id="nt_task" class="pm-form-input" type="text" placeholder="Describe the task..." required />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Company <span class="required">*</span></label>
            <div id="nt_company_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Project</label>
            <div id="nt_project_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Department <span class="required">*</span></label>
            <div id="nt_department_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label pm-form-label--with-action">
              Preset Task <span class="required">*</span>
              <button type="button" id="nt_manage_presets_btn" class="pm-form-label-action" title="Manage Preset Tasks">Manage</button>
            </label>
            <div id="nt_type_picker"></div>
            <div id="nt_custom_time_wrap" class="pm-form-subfield" style="display:none;">
              <label class="pm-form-label pm-form-sublabel">Estimated Time (hours) <span class="required">*</span></label>
              <input id="nt_custom_time" class="pm-form-input" type="number" min="0.5" step="0.5" placeholder="e.g. 4" />
            </div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Priority</label>
            <div id="nt_priority_picker"></div>
          </div>
        </div>
      </section>

      <!-- PEOPLE -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">People</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Owner <span class="required">*</span></label>
            <div id="nt_owner_picker"></div>
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Collaborator</label>
            <div id="nt_collaborator_picker"></div>
          </div>
        </div>
      </section>

      <!-- SCHEDULE -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Schedule</h3>

        <div class="pm-form-grid">
          <div class="pm-form-field">
            <label class="pm-form-label">Due Date</label>
            <input id="nt_due" class="pm-form-input" type="date" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Deadline</label>
            <input id="nt_deadline" class="pm-form-input" type="date" />
          </div>
        </div>
      </section>

      <!-- NOTES -->
      <section class="pm-form-section">
        <h3 class="pm-form-section-title">Notes</h3>

        <div class="pm-form-grid pm-form-grid--single">
          <div class="pm-form-field">
            <label class="pm-form-label">Task Notes</label>
            <textarea id="nt_notes" class="pm-form-textarea" placeholder="Additional details or instructions..."></textarea>
          </div>
        </div>
      </section>
    `;

    // Initialize people pickers
    initPeoplePickers();

    // Initialize catalog pickers
    initCatalogPickers();

    // Initialize priority badge picker
    initPriorityBadgePicker();
  }

  // ================================
  // Initialize People Pickers
  // ================================
  function initPeoplePickers(_retries = 0) {
    // Wait for PeoplePicker to be available
    if (typeof window.createPeoplePicker !== 'function') {
      if (_retries >= 30) {
        console.error('[NewTask] PeoplePicker failed to load after 3s, giving up');
        return;
      }
      setTimeout(() => initPeoplePickers(_retries + 1), 100);
      return;
    }

    // Owner picker (single select, required)
    const ownerContainer = qs('nt_owner_picker');
    if (ownerContainer) {
      ownerPicker = window.createPeoplePicker(ownerContainer, {
        multiple: false,
        placeholder: 'Select owner...',
        onChange: (users) => {
          console.log('[NewTask] Owner selected:', users);
        }
      });
    }

    // Collaborator picker (multi-select, optional)
    const collabContainer = qs('nt_collaborator_picker');
    if (collabContainer) {
      collaboratorPicker = window.createPeoplePicker(collabContainer, {
        multiple: true,
        placeholder: 'Add collaborators...',
        maxDisplay: 2,
        onChange: (users) => {
          console.log('[NewTask] Collaborators selected:', users);
        }
      });
    }
  }

  // ================================
  // Initialize Catalog Pickers
  // ================================
  function initCatalogPickers(_retries = 0) {
    // Wait for CatalogPicker to be available
    if (typeof window.createCatalogPicker !== 'function') {
      if (_retries >= 30) {
        console.error('[NewTask] CatalogPicker failed to load after 3s, giving up');
        return;
      }
      setTimeout(() => initCatalogPickers(_retries + 1), 100);
      return;
    }

    // Company picker
    const companyContainer = qs('nt_company_picker');
    if (companyContainer) {
      companyPicker = window.createCatalogPicker(companyContainer, {
        catalogType: 'company',
        placeholder: 'Select company...',
        onChange: (item) => {
          console.log('[NewTask] Company selected:', item);
        }
      });
    }

    // Project picker
    const projectContainer = qs('nt_project_picker');
    if (projectContainer) {
      projectPicker = window.createCatalogPicker(projectContainer, {
        catalogType: 'project',
        placeholder: 'Select project...',
        onChange: (item) => {
          console.log('[NewTask] Project selected:', item);
        }
      });
    }

    // Department picker
    const deptContainer = qs('nt_department_picker');
    if (deptContainer) {
      departmentPicker = window.createCatalogPicker(deptContainer, {
        catalogType: 'department',
        placeholder: 'Select department...',
        onChange: (item) => {
          console.log('[NewTask] Department selected:', item);
        }
      });
    }

    // Preset Task picker (formerly "Type")
    const typeContainer = qs('nt_type_picker');
    if (typeContainer) {
      typePicker = window.createCatalogPicker(typeContainer, {
        catalogType: 'type',
        placeholder: 'Select preset task...',
        staticItems: [{ id: '_custom', name: 'Custom', color: '#6c757d' }],
        onChange: (item) => {
          console.log('[NewTask] Preset task selected:', item);
          const wrap = qs('nt_custom_time_wrap');
          if (wrap) {
            const isCustom = item && item.id === '_custom';
            wrap.style.display = isCustom ? '' : 'none';
            if (!isCustom) {
              const inp = qs('nt_custom_time');
              if (inp) inp.value = '';
            }
          }
        }
      });
    }

  }

  // ================================
  // Initialize Priority Badge Picker
  // ================================
  function initPriorityBadgePicker(_retries = 0) {
    if (typeof window.BadgePicker !== 'function') {
      if (_retries >= 30) {
        console.error('[NewTask] BadgePicker failed to load after 3s, giving up');
        return;
      }
      setTimeout(() => initPriorityBadgePicker(_retries + 1), 100);
      return;
    }

    const container = qs('nt_priority_picker');
    if (!container) return;

    const items = [
      { id: 'critical', name: 'Critical', color: '#ef4444' },
      { id: 'high',     name: 'High',     color: '#f97316' },
      { id: 'medium',   name: 'Medium',   color: '#eab308' },
      { id: 'low',      name: 'Low',      color: '#3b82f6' },
    ];

    priorityPicker = new window.BadgePicker(container, {
      items: items,
      placeholder: 'Select priority...',
    });
  }

  // ================================
  // Build + validate payload
  // ================================
  function buildPayloadFromForm() {
    // Get owner from picker
    const ownerUser = ownerPicker?.getValue();

    // Get collaborators from picker
    const collaborators = collaboratorPicker?.getValue() || [];

    // Get catalog picker values (returns {id, name} or null)
    const companyItem = companyPicker?.getValue?.() || null;
    const projectItem = projectPicker?.getValue?.() || null;
    const departmentItem = departmentPicker?.getValue?.() || null;
    const typeItem = typePicker?.getValue?.() || null;
    const priorityItem = priorityPicker?.getValue?.() || null;

    const ui = {
      task: qs("nt_task")?.value?.trim() || "",
      company: companyItem,
      project: projectItem,
      owner: ownerUser,
      collaborators: collaborators,
      type: typeItem,
      department: departmentItem,
      priority: priorityItem,
      due: qs("nt_due")?.value || null,
      deadline: qs("nt_deadline")?.value || null,
      notes: qs("nt_notes")?.value?.trim() || null,
    };

    // Check if Custom preset was selected
    const isCustomType = ui.type && ui.type.id === '_custom';
    const customTime = parseFloat(qs("nt_custom_time")?.value) || 0;

    // Required fields (frontend guard)
    const missing = [];
    if (!ui.task) missing.push("Task Description");
    if (!ui.owner) missing.push("Owner");
    if (!ui.company) missing.push("Company");
    if (!ui.type) missing.push("Preset Task");
    if (!ui.department) missing.push("Department");
    if (isCustomType && customTime <= 0) missing.push("Estimated Time");

    if (missing.length) {
      if (window.Toast) {
        Toast.warning('Missing Fields', 'Please fill in: ' + missing.join(', '));
      } else {
        console.warn('[NewTask] Missing fields:', missing.join(', '));
      }
      return null;
    }

    // UI -> backend payload (send IDs, not names)
    const payload = {
      task_description: ui.task,
      company: ui.company?.id || null,
      project: ui.project?.id || null,
      owner: ui.owner?.id || null,
      collaborators: ui.collaborators.length > 0 ? ui.collaborators.map(u => u.id) : null,
      type: isCustomType ? null : (ui.type?.id || null),
      department: ui.department?.id || null,
      priority: ui.priority?.id || null,
      due_date: ui.due,
      deadline: ui.deadline,
      task_notes: ui.notes,

      // forced by business rule
      status: "not started",
    };

    // Custom type: include estimated_time (hours)
    if (isCustomType) {
      payload.estimated_time = customTime;
    }

    return payload;
  }

  function bind() {
    // Botón toolbar
    qs("btnNewTask")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderForm(); // paint fields each time (fresh)
      open();
    });

    // Create task and POST to backend
    qs("btnCreateNewTask")?.addEventListener("click", async (e) => {
      e.preventDefault();
      const payload = buildPayloadFromForm();
      if (!payload) return;

      const btn = qs("btnCreateNewTask");
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Creating...";

      try {
        const apiBase = window.API_BASE || "";
        const res = await fetch(`${apiBase}/pipeline/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server error (${res.status}): ${errText}`);
        }

        const created = await res.json();
        console.log("[NEW TASK] Created:", created);

        if (window.Toast) {
          Toast.success('Task Created', 'Task created successfully!');
        } else {
          console.log('[NewTask] Task created successfully');
        }
        close();

        // Refresh pipeline data if fetchPipeline exists
        if (typeof window.fetchPipeline === "function") {
          window.fetchPipeline().catch(err => console.warn('[Pipeline] Refresh failed:', err));
        }

      } catch (err) {
        console.error("[NEW TASK] Error:", err);
        if (window.Toast) {
          Toast.error('Create Failed', 'Error creating task.', { details: err.message });
        } else {
          console.warn('[NewTask] Create failed:', err.message);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });

    // Botones modal
    qs("btnCloseNewTaskModal")?.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    qs("btnCancelNewTask")?.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    // Click en backdrop
    const modal = qs("newTaskModal");
    if (modal) {
      modal.addEventListener("click", close);

      // Evita cerrar cuando clic dentro de la card
      const dialog = modal.querySelector(".modal");
      dialog?.addEventListener("click", (ev) => ev.stopPropagation());
    }

    // Escape para cerrar
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        const modal = qs("newTaskModal");
        if (modal && !modal.classList.contains("hidden")) close();
      }
    });
  }

  window.PM_NewTask = { open, close, bind };
})();
