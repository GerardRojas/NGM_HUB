// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");
    if (!slider) return;

    const KEY = "pmTableMinWidth";

    function applyTableMinWidth(px) {
      // 1) variable global para que la usen TODAS las tablas del pipeline
      document.documentElement.style.setProperty("--pm-table-min-width", `${px}px`);

      // 2) refuerzo: por si alguna regla está pisando, lo aplicamos inline a cada tabla
      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        tbl.style.minWidth = `${px}px`;
        tbl.style.width = "max-content";
        tbl.style.tableLayout = "auto";
      });
    }

    const apply = (px) => {
      applyTableMinWidth(px);
      if (label) label.textContent = `${px}px`;
    };

    const saved = Number(localStorage.getItem(KEY) || slider.value || 1200);
    slider.value = String(saved);
    apply(saved);

    slider.addEventListener("input", () => {
      const px = Number(slider.value) || 1200;
      apply(px);
      localStorage.setItem(KEY, String(px));
    });
  }

  // Fuerza a que las tablas se “re-midAN” cuando ocultas/muestras columnas
  function refreshPipelineTables() {
    document.querySelectorAll(".pm-group .table").forEach((tbl) => {
      tbl.style.width = "max-content";
      tbl.style.tableLayout = "auto";

      // fuerza reflow para eliminar huecos después de toggles
      void tbl.offsetWidth;
    });
  }

  // Helpers globales por si los llamas desde pipeline.js (render) o desde el modal (apply)
  window.initTableWidthSlider = initTableWidthSlider;
  window.refreshPipelineTables = refreshPipelineTables;
})();
