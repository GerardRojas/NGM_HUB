// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");
    if (!slider) return;

    const KEY = "pmTableMinWidth";

    function applyTableMinWidth(px) {
      // variable global (la puedes seguir usando si la ocupas en CSS)
      document.documentElement.style.setProperty("--pm-table-width", `${px}px`);

      // opcional: cuando la tabla sea más angosta, también baja el min-width de celdas
      // (así el slider "sí se siente" al mínimo)
      const cellMin = Math.max(90, Math.floor(px / 14)); // ajusta 14 según # cols típicas
      document.documentElement.style.setProperty("--pm-cell-min", `${cellMin}px`);

      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        tbl.style.width = `${px}px`;      // 👈 clave
        tbl.style.minWidth = "0px";       // 👈 evita que se quede grande por minWidth
        tbl.style.tableLayout = "fixed";  // 👈 clave para que estire columnas y no haya huecos
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
