// assets/js/pipeline_table_interactions.js
(function () {
  const wrapper = document.getElementById("pm-groups-wrapper");
  if (!wrapper) return;

  // Delegación: sirve aunque re-renderices grupos/tabla
  wrapper.addEventListener("click", (e) => {
    const td = e.target.closest('td[data-col]');
    if (!td) return;

    const tr = td.closest('tr[data-task-id], tr.pm-row');
    const taskId = tr?.dataset?.taskId || null;
    const colKey = td.getAttribute("data-col");

    if (!taskId || !colKey) return;

    // Aquí conectaremos edición por columna (dropdowns, modales, etc.)
    console.log("[CELL CLICK]", { taskId, colKey, trDataset: { ...tr.dataset } });
  });
})();
