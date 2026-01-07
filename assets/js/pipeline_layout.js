// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");

    if (!slider) return;

    const KEY = "pmTableWidth";

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    /**
     * Aplica el ancho a TODAS las tablas del pipeline.
     * Importante: NO tocar el layout del panel (no --pm-layout-max),
     * para evitar que el workspace se "encajone".
     */
    function applyTableWidth(px) {
      // variables útiles si quieres usarlas en CSS/debug
      document.documentElement.style.setProperty("--pm-table-width", `${px}px`);

      // min de celda (sensación del slider); no afecta layout general
      const cellMin = Math.max(90, Math.floor(px / 14));
      document.documentElement.style.setProperty("--pm-cell-min", `${cellMin}px`);

      // Aplica ancho real a las tablas existentes
      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        tbl.style.width = `${px}px`;
        tbl.style.minWidth = "0px";
        tbl.style.tableLayout = "fixed";
      });

      if (label) label.textContent = `${px}px`;
    }

    // Respeta rango del HTML
    const minAllowed = Number(slider.min) || 260;
    const maxAllowed = Number(slider.max) || 1900;

    // Carga preferencia guardada y clámpea al rango actual
    const savedRaw = Number(localStorage.getItem(KEY) || slider.value || 1200);
    const saved = clamp(savedRaw, minAllowed, maxAllowed);

    slider.value = String(saved);
    applyTableWidth(saved);

    slider.addEventListener("input", () => {
      const pxRaw = Number(slider.value) || 1200;
      const px = clamp(pxRaw, minAllowed, maxAllowed);

      // Si se salió del rango, corrige el input visualmente
      if (String(px) !== slider.value) slider.value = String(px);

      applyTableWidth(px);
      localStorage.setItem(KEY, String(px));
    });

    // Nota: ya NO alineamos max al viewport en resize.
    // Si el usuario pone una tabla muy ancha, debe poder scrollear horizontalmente.
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
