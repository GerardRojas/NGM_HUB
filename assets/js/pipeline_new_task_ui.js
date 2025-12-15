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

  function bind() {
    // Botón toolbar
    qs("btnNewTask")?.addEventListener("click", (e) => {
      e.preventDefault();
      open();
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
