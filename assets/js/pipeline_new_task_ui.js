// assets/js/pipeline_new_task_ui.js
(function () {
  const qs = (id) => document.getElementById(id);

  // People picker instances
  let ownerPicker = null;
  let collaboratorPicker = null;

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

    // Clear pickers
    ownerPicker?.clear();
    collaboratorPicker?.clear();
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
            <input id="nt_task" class="pm-form-input" type="text" placeholder="Describe the task…" required />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Company <span class="required">*</span></label>
            <input id="nt_company" class="pm-form-input" type="text" placeholder="e.g. NGM" required />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Project</label>
            <input id="nt_project" class="pm-form-input" type="text" placeholder="Project name" />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Department <span class="required">*</span></label>
            <input id="nt_department" class="pm-form-input" type="text" placeholder="e.g. Construction" required />
          </div>

          <div class="pm-form-field">
            <label class="pm-form-label">Type <span class="required">*</span></label>
            <input id="nt_type" class="pm-form-input" type="text" placeholder="e.g. Admin / Field / Design…" required />
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
  }

  // ================================
  // Initialize People Pickers
  // ================================
  function initPeoplePickers() {
    // Wait for PeoplePicker to be available
    if (typeof window.createPeoplePicker !== 'function') {
      console.warn('[NewTask] PeoplePicker not loaded yet, retrying...');
      setTimeout(initPeoplePickers, 100);
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
  // Build + validate payload
  // ================================
  function buildPayloadFromForm() {
    // Get owner from picker
    const ownerUser = ownerPicker?.getValue();
    const ownerName = ownerUser?.name || '';
    const ownerId = ownerUser?.id || null;

    // Get collaborators from picker
    const collaborators = collaboratorPicker?.getValue() || [];
    const collaboratorNames = collaboratorPicker?.getNames() || [];
    const collaboratorIds = collaboratorPicker?.getIds() || [];

    const ui = {
      task: qs("nt_task")?.value?.trim() || "",
      company: qs("nt_company")?.value?.trim() || "",
      project: qs("nt_project")?.value?.trim() || null,
      owner: ownerName,
      owner_id: ownerId,
      collaborators: collaboratorNames,
      collaborator_ids: collaboratorIds,
      type: qs("nt_type")?.value?.trim() || "",
      department: qs("nt_department")?.value?.trim() || "",
      due: qs("nt_due")?.value || null,
      deadline: qs("nt_deadline")?.value || null,
      notes: qs("nt_notes")?.value?.trim() || null,
    };

    // Required fields (frontend guard)
    const missing = [];
    if (!ui.task) missing.push("Task Description");
    if (!ui.owner) missing.push("Owner");
    if (!ui.company) missing.push("Company");
    if (!ui.type) missing.push("Type");
    if (!ui.department) missing.push("Department");

    if (missing.length) {
      if (window.Toast) {
        Toast.warning('Missing Fields', 'Please fill in: ' + missing.join(', '));
      }
      return null;
    }

    // UI -> backend payload
    return {
      task_description: ui.task,
      company: ui.company,
      project: ui.project,
      owner: ui.owner,
      owner_id: ui.owner_id,
      collaborators: ui.collaborators.length > 0 ? ui.collaborators : null,
      collaborator_ids: ui.collaborator_ids.length > 0 ? ui.collaborator_ids : null,
      type: ui.type,
      department: ui.department,
      due_date: ui.due,
      deadline: ui.deadline,
      task_notes: ui.notes,

      // forced by business rule
      status: "not started",
    };
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
        }
        close();

        // Refresh pipeline data if fetchPipeline exists
        if (typeof window.fetchPipeline === "function") {
          window.fetchPipeline();
        }

      } catch (err) {
        console.error("[NEW TASK] Error:", err);
        if (window.Toast) {
          Toast.error('Create Failed', 'Error creating task.', { details: err.message });
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
