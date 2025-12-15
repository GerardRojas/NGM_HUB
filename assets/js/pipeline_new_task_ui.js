// assets/js/pipeline_new_task_ui.js
(function () {
  const qs = (id) => document.getElementById(id);

  function open() {
    const modal = qs("newTaskModal");
    if (!modal) return console.warn("[NewTask] newTaskModal not found (partial not loaded?)");
    modal.classList.remove("hidden");

    // focus al primer input si existe
    const first = modal.querySelector("input, textarea, select, button");
    if (first) setTimeout(() => first.focus(), 30);
  }

  function close() {
    const modal = qs("newTaskModal");
    if (!modal) return;
    modal.classList.add("hidden");
  }

  // ================================
  // Render form (New Task fields)
  // ================================
  function renderForm() {
    const form = qs("newTaskForm");
    if (!form) return;

    form.innerHTML = `
        <!-- BASICS -->
        <section class="pm-modal-section">
        <h3 class="pm-modal-section-title">Basics</h3>

        <div class="pm-form-grid">
            <label class="pm-field pm-field--full">
            <span class="pm-field-label">Task Description <b>*</b></span>
            <input id="nt_task" class="pm-input" type="text" placeholder="Describe the task…" required />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Company <b>*</b></span>
            <input id="nt_company" class="pm-input" type="text" placeholder="e.g. NGM" required />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Project</span>
            <input id="nt_project" class="pm-input" type="text" placeholder="Project name" />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Department <b>*</b></span>
            <input id="nt_department" class="pm-input" type="text" placeholder="e.g. Construction" required />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Type <b>*</b></span>
            <input id="nt_type" class="pm-input" type="text" placeholder="e.g. Admin / Field / Design…" required />
            </label>
        </div>
        </section>

        <!-- PEOPLE -->
        <section class="pm-modal-section">
        <h3 class="pm-modal-section-title">People</h3>

        <div class="pm-form-grid">
            <label class="pm-field">
            <span class="pm-field-label">Owner <b>*</b></span>
            <input id="nt_owner" class="pm-input" type="text" placeholder="Owner name" required />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Collaborator</span>
            <input id="nt_collaborator" class="pm-input" type="text" placeholder="Collaborator (optional)" />
            </label>
        </div>
        </section>

        <!-- SCHEDULE -->
        <section class="pm-modal-section">
        <h3 class="pm-modal-section-title">Schedule</h3>

        <div class="pm-form-grid">
            <label class="pm-field">
            <span class="pm-field-label">Due Date</span>
            <input id="nt_due" class="pm-input" type="date" />
            </label>

            <label class="pm-field">
            <span class="pm-field-label">Deadline</span>
            <input id="nt_deadline" class="pm-input" type="date" />
            </label>
        </div>
        </section>

        <!-- LINKS -->
        <section class="pm-modal-section">
        <h3 class="pm-modal-section-title">Links</h3>

        <button type="button" class="pm-btn pm-btn-secondary btn-small" id="nt_attach_link">
            <span class="pm-btn-icon">🔗</span>
            <span>Add Initial Info Link (soon)</span>
        </button>

        <div class="pm-hint" style="margin-top:10px; opacity:.75;">
            This will be connected to Supabase Storage later.
        </div>
        </section>

        <div class="pm-hint">
        New tasks always start as <b>Not Started</b>.
        </div>
    `;
  }


  // ================================
  // Build + validate payload
  // ================================
  function buildPayloadFromForm() {
    const ui = {
      task: qs("nt_task")?.value?.trim() || "",
      company: qs("nt_company")?.value?.trim() || "",
      project: qs("nt_project")?.value?.trim() || null,
      owner: qs("nt_owner")?.value?.trim() || "",
      collaborator: qs("nt_collaborator")?.value?.trim() || null,
      type: qs("nt_type")?.value?.trim() || "",
      department: qs("nt_department")?.value?.trim() || "",
      due: qs("nt_due")?.value || null,
      deadline: qs("nt_deadline")?.value || null,
    };

    // Required fields (frontend guard)
    const missing = [];
    if (!ui.task) missing.push("Task Description");
    if (!ui.owner) missing.push("Owner");
    if (!ui.company) missing.push("Company");
    if (!ui.type) missing.push("Type");
    if (!ui.department) missing.push("Department");

    if (missing.length) {
      alert("Missing required fields: " + missing.join(", "));
      return null;
    }

    // UI -> backend payload (names can change later in one place)
    return {
      task_description: ui.task,
      company: ui.company,
      project: ui.project,
      owner: ui.owner,
      collaborator: ui.collaborator,
      type: ui.type,
      department: ui.department,
      due_date: ui.due,
      deadline: ui.deadline,

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

    // Create (for now just validate + log payload)
    qs("btnCreateNewTask")?.addEventListener("click", (e) => {
      e.preventDefault();
      const payload = buildPayloadFromForm();
      if (!payload) return;
      console.log("[NEW TASK PAYLOAD]", payload);
      // Next step: POST to backend + refresh pipeline
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
