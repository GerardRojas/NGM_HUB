// assets/js/pipeline_new_task.js
(function () {
  const modal = document.getElementById("newTaskModal");
  const form = document.getElementById("newTaskForm");

  const btnClose = document.getElementById("btnCloseNewTaskModal");
  const btnCancel = document.getElementById("btnCancelNewTask");
  const btnCreate = document.getElementById("btnCreateNewTask");

  const elTask = document.getElementById("nt-task");
  const elProject = document.getElementById("nt-project");
  const elOwner = document.getElementById("nt-owner");
  const elPriority = document.getElementById("nt-priority");
  const elDue = document.getElementById("nt-due");
  const elNotes = document.getElementById("nt-notes");

  function open() {
    if (!modal) return;
    modal.classList.remove("hidden");
    hydrateSelectsFromFilters();
    setTimeout(() => elTask?.focus(), 50);
  }

  function close() {
    if (!modal) return;
    modal.classList.add("hidden");
    form?.reset();
  }

  // Cierra si clic afuera
  modal?.addEventListener("click", close);
  modal?.querySelector(".modal")?.addEventListener("click", (e) => e.stopPropagation());

  btnClose?.addEventListener("click", (e) => { e.preventDefault(); close(); });
  btnCancel?.addEventListener("click", (e) => { e.preventDefault(); close(); });

  // Toma valores existentes de tus filtros (ya poblados por populateFilters)
  function hydrateSelectsFromFilters() {
    const srcProject = document.getElementById("project-filter");
    const srcOwner = document.getElementById("owner-filter");
    const srcPriority = document.getElementById("priority-filter");

    copyOptions(srcProject, elProject, true);
    copyOptions(srcOwner, elOwner, true);
    copyOptions(srcPriority, elPriority, true);
  }

  function copyOptions(srcSelect, dstSelect, dropAll = false) {
    if (!srcSelect || !dstSelect) return;
    const opts = Array.from(srcSelect.options || []);
    dstSelect.innerHTML = `<option value="">—</option>`;
    opts.forEach((o) => {
      if (dropAll && (o.value === "all" || o.textContent === "All")) return;
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.textContent;
      dstSelect.appendChild(opt);
    });
  }

  function buildPayload() {
    const task_description = (elTask?.value || "").trim();
    if (!task_description) return null;

    // 👇 forzamos el status inicial
    const status_name = "not started";

    return {
      task_description,
      status_name,
      project: elProject?.value || null,
      owner_name: elOwner?.value || null,
      priority: elPriority?.value || null,
      due_date: elDue?.value || null,
      task_notes: (elNotes?.value || "").trim() || null,
    };
  }

  async function createTask(payload) {
    // ⚠️ Endpoint: como no lo tengo confirmado, lo dejo en un lugar único para cambiar.
    // Si tu backend usa otra ruta, solo cambia aquí.
    const url = `${window.API_BASE}/pipeline/tasks`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Create task failed (${res.status}). ${txt}`);
    }
    return await res.json();
  }

  btnCreate?.addEventListener("click", async (e) => {
    e.preventDefault();

    const payload = buildPayload();
    if (!payload) return;

    btnCreate.disabled = true;

    try {
      // intenta crear en backend
      const created = await createTask(payload);

      // refresca pipeline (tu fetchPipeline ya existe)
      if (typeof window.fetchPipeline === "function") {
        await window.fetchPipeline();
      }

      close();
      console.log("[NEW TASK] created:", created);
    } catch (err) {
      console.warn("[NEW TASK] backend not ready or error:", err);
      // fallback: no rompemos UI
      alert("Could not create task (backend endpoint missing or error). Check console.");
    } finally {
      btnCreate.disabled = false;
    }
  });

  window.PM_NewTask = { open, close };
})();
