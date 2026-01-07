// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");

    if (!slider) return;

    const KEY = "pmTableWidth";

    function computeMaxUsefulWidth() {
      const main = document.querySelector("main.main-content");
      if (!main) return 1900;
      const rect = main.getBoundingClientRect();
      return Math.max(800, Math.floor(rect.width - 24));
    }

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    function applyTableWidth(px) {
      document.documentElement.style.setProperty("--pm-layout-max", `${px}px`);
      if (label) label.textContent = `${px}px`;
    }

    // Ajusta límites del slider al inicializar
    const maxUseful = computeMaxUsefulWidth();
    slider.max = String(maxUseful);

    // Puedes ajustar este mínimo a 1100/1200 si quieres “mínimo legible”
    const minAllowed = Number(slider.min) || 260;

    // Carga preferencia guardada y clámpea al rango actual
    const savedRaw = Number(localStorage.getItem(KEY) || slider.value || maxUseful);
    const saved = Math.max(minAllowed, Math.min(savedRaw, maxUseful));

    slider.value = String(saved);
    applyTableWidth(saved);

    slider.addEventListener("input", () => {
      const currentMax = computeMaxUsefulWidth();
      slider.max = String(currentMax);

      const pxRaw = Number(slider.value) || 1200;
      const px = clamp(pxRaw, minAllowed, currentMax);

      // Si se salió del rango (por resize), lo corregimos
      if (String(px) !== slider.value) slider.value = String(px);

      applyTableWidth(px);
      localStorage.setItem(KEY, String(px));
    });

    // Mantén el MAX alineado al área útil cuando cambie el viewport
    window.addEventListener("resize", () => {
      const newMax = computeMaxUsefulWidth();
      slider.max = String(newMax);

      const pxRaw = Number(slider.value) || 1200;
      const px = clamp(pxRaw, minAllowed, newMax);

      if (String(px) !== slider.value) slider.value = String(px);

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
