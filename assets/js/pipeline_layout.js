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

    // ✅ Solo controla el ANCHO DE LA TABLA (no el layout del panel)
    function applyTableWidth(px) {
      // variables opcionales para CSS/debug
      document.documentElement.style.setProperty("--pm-table-width", `${px}px`);

      const cellMin = Math.max(90, Math.floor(px / 14));
      document.documentElement.style.setProperty("--pm-cell-min", `${cellMin}px`);

      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        tbl.style.width = `${px}px`;
        tbl.style.minWidth = "0px";
        tbl.style.tableLayout = "fixed";
      });

      if (label) label.textContent = `${px}px`;
    }

    // ✅ Respeta los límites del HTML (min/max/step)
    const minAllowed = Number(slider.min) || 260;
    const maxAllowed = Number(slider.max) || 1900;

    const savedRaw = Number(localStorage.getItem(KEY) || slider.value || 1200);
    const saved = clamp(savedRaw, minAllowed, maxAllowed);

    slider.value = String(saved);
    applyTableWidth(saved);

    slider.addEventListener("input", () => {
      const pxRaw = Number(slider.value) || 1200;
      const px = clamp(pxRaw, minAllowed, maxAllowed);

      if (String(px) !== slider.value) slider.value = String(px);

      applyTableWidth(px);
      localStorage.setItem(KEY, String(px));
    });
  }

  function refreshPipelineTables() {
    document.querySelectorAll(".pm-group .table").forEach((tbl) => {
      void tbl.offsetWidth;
    });
  }

  window.initTableWidthSlider = initTableWidthSlider;
  window.refreshPipelineTables = refreshPipelineTables;
})();
