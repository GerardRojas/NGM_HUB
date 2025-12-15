// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label  = document.getElementById("pm-width-value");
    if (!slider) return;

    const KEY = "pmTableWidth";

    function applyTableWidth(px) {
      // ancho global (por si lo quieres usar en CSS o debug)
      document.documentElement.style.setProperty("--pm-table-width", `${px}px`);

      // ajusta mínimo de celdas para que el slider “se sienta”
      const cellMin = Math.max(90, Math.floor(px / 14));
      document.documentElement.style.setProperty("--pm-cell-min", `${cellMin}px`);

      // aplica ancho real a todas las tablas existentes
      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        tbl.style.width = `${px}px`;          // <- el slider manda aquí
        tbl.style.minWidth = "0px";
        tbl.style.tableLayout = "fixed";
      });

      if (label) label.textContent = `${px}px`;
    }

    const saved = Number(localStorage.getItem(KEY) || slider.value || 1200);
    slider.value = String(saved);
    applyTableWidth(saved);

    slider.addEventListener("input", () => {
      const px = Number(slider.value) || 1200;
      applyTableWidth(px);
      localStorage.setItem(KEY, String(px));
    });
  }

  function refreshPipelineTables() {
    document.querySelectorAll(".pm-group .table").forEach((tbl) => {
      // reflow para que el layout se recalcule después de toggles
      void tbl.offsetWidth;
    });
  }

  window.initTableWidthSlider = initTableWidthSlider;
  window.refreshPipelineTables = refreshPipelineTables;
})();
