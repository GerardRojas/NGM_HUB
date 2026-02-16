// assets/js/pipeline_layout.js
(function () {

  // Columnas con ancho FIJO (no cambian con el slider)
  const FIXED_COLS = {
    task: 280,        // Task siempre necesita espacio
    owner: 120,
    collaborator: 120,
    manager: 120,
    status: 150,      // Status badges need full width ("Not Started", "Working on it", etc.)
    project: 150,
    company: 140,
    start: 120,
  };

  // Columnas flexibles: todas las que NO están en FIXED_COLS
  // se reparten el espacio restante equitativamente

  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");
    if (!slider) return;

    const KEY = "pmTableWidth";
    const VERSION_KEY = "pmTableWidth_v";
    const CURRENT_VERSION = 2; // Bump this to reset saved widths when layout changes

    // If layout version changed, discard old saved width
    if (Number(localStorage.getItem(VERSION_KEY)) !== CURRENT_VERSION) {
      localStorage.removeItem(KEY);
      localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    }

    function clamp(n, min, max) {
      return Math.max(min, Math.min(max, n));
    }

    // Calcula anchos de columnas visibles
    function calculateColumnWidths(totalWidth) {
      // Obtener columnas visibles desde el DOM
      const firstTable = document.querySelector(".pm-group .table");
      if (!firstTable) return null;

      const visibleCols = [];
      firstTable.querySelectorAll("thead th[data-col]").forEach(th => {
        if (th.style.display !== "none") {
          visibleCols.push(th.dataset.col);
        }
      });

      if (visibleCols.length === 0) return null;

      // Calcular espacio usado por columnas fijas
      let fixedTotal = 0;
      const fixedWidths = {};

      visibleCols.forEach(col => {
        if (FIXED_COLS[col]) {
          fixedWidths[col] = FIXED_COLS[col];
          fixedTotal += FIXED_COLS[col];
        }
      });

      // Columnas flexibles visibles
      const flexVisible = visibleCols.filter(col => !FIXED_COLS[col]);

      // Espacio restante para columnas flexibles
      const remainingWidth = Math.max(0, totalWidth - fixedTotal);

      // Ancho mínimo por columna flexible
      const minFlexWidth = 90;

      // Ancho para cada columna flexible
      const flexWidth = flexVisible.length > 0
        ? Math.max(minFlexWidth, Math.floor(remainingWidth / flexVisible.length))
        : minFlexWidth;

      const flexWidths = {};
      flexVisible.forEach(col => {
        flexWidths[col] = flexWidth;
      });

      return { fixedWidths, flexWidths, visibleCols };
    }

    // Aplica el ancho a las tablas
    function applyTableWidth(px) {
      const widths = calculateColumnWidths(px);

      // Actualizar variable CSS global
      document.documentElement.style.setProperty("--pm-table-width", `${px}px`);

      document.querySelectorAll(".pm-group .table").forEach((tbl) => {
        // Aplicar ancho total a la tabla
        tbl.style.width = `${px}px`;
        tbl.style.minWidth = `${px}px`;
        tbl.style.tableLayout = "fixed";

        if (!widths) return;

        // Aplicar anchos a columnas fijas
        Object.entries(widths.fixedWidths).forEach(([col, w]) => {
          tbl.querySelectorAll(`th[data-col="${col}"], td[data-col="${col}"]`).forEach(cell => {
            cell.style.width = `${w}px`;
            cell.style.minWidth = `${w}px`;
            cell.style.maxWidth = `${w}px`;
          });
        });

        // Aplicar anchos a columnas flexibles
        Object.entries(widths.flexWidths).forEach(([col, w]) => {
          tbl.querySelectorAll(`th[data-col="${col}"], td[data-col="${col}"]`).forEach(cell => {
            cell.style.width = `${w}px`;
            cell.style.minWidth = `${w}px`;
            cell.style.maxWidth = "none"; // Flexibles pueden crecer
          });
        });

        // También actualizar colgroup si existe
        tbl.querySelectorAll("col[data-col]").forEach(col => {
          const colName = col.dataset.col;
          if (widths.fixedWidths[colName]) {
            col.style.width = `${widths.fixedWidths[colName]}px`;
          } else if (widths.flexWidths[colName]) {
            col.style.width = `${widths.flexWidths[colName]}px`;
          }
        });
      });

      if (label) label.textContent = `${px}px`;
    }

    // Límites del slider
    const minAllowed = Number(slider.min) || 1000;
    const maxAllowed = Number(slider.max) || 2500;

    // Cargar valor guardado o default
    const savedRaw = Number(localStorage.getItem(KEY) || slider.value || 1800);
    const saved = clamp(savedRaw, minAllowed, maxAllowed);

    slider.value = String(saved);

    // Aplicar después de que el DOM esté listo
    setTimeout(() => applyTableWidth(saved), 100);

    // Evento del slider
    slider.addEventListener("input", () => {
      const pxRaw = Number(slider.value) || 1800;
      const px = clamp(pxRaw, minAllowed, maxAllowed);

      if (String(px) !== slider.value) slider.value = String(px);

      applyTableWidth(px);
      localStorage.setItem(KEY, String(px));
    });

    // Exponer función para re-aplicar después de cambios de visibilidad
    window.applyCurrentTableWidth = () => {
      const currentWidth = Number(slider.value) || 1400;
      applyTableWidth(currentWidth);
    };
  }

  function refreshPipelineTables() {
    // Forzar recálculo
    document.querySelectorAll(".pm-group .table").forEach((tbl) => {
      void tbl.offsetWidth;
    });

    // Re-aplicar anchos si existe la función
    if (typeof window.applyCurrentTableWidth === "function") {
      window.applyCurrentTableWidth();
    }
  }

  // ================================
  // SCROLL INDICATORS
  // Shows visual hint when table has horizontal scroll
  // ================================
  let _resizeHandler = null;

  function updateScrollIndicators(el) {
    const scrollLeft = el.scrollLeft;
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const hasScroll = scrollWidth > clientWidth;

    if (hasScroll) {
      el.classList.toggle('has-scroll-left', scrollLeft > 5);
      el.classList.toggle('has-scroll-right', scrollLeft < scrollWidth - clientWidth - 5);
    } else {
      el.classList.remove('has-scroll-left', 'has-scroll-right');
    }
  }

  function initScrollIndicators() {
    // Remove previous resize handler to prevent accumulation
    if (_resizeHandler) {
      window.removeEventListener('resize', _resizeHandler);
    }

    const groupBodies = document.querySelectorAll('.pm-group-body');

    groupBodies.forEach(body => {
      updateScrollIndicators(body);
      body.addEventListener('scroll', () => updateScrollIndicators(body), { passive: true });
    });

    // Single resize handler that updates all current group bodies
    _resizeHandler = () => {
      document.querySelectorAll('.pm-group-body').forEach(updateScrollIndicators);
    };
    window.addEventListener('resize', _resizeHandler, { passive: true });
  }

  // Initialize scroll indicators when DOM is ready or when called
  function setupScrollIndicators() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initScrollIndicators);
    } else {
      // Small delay to ensure tables are rendered
      setTimeout(initScrollIndicators, 100);
    }
  }

  window.initTableWidthSlider = initTableWidthSlider;
  window.refreshPipelineTables = refreshPipelineTables;
  window.initScrollIndicators = initScrollIndicators;

  // Auto-init scroll indicators
  setupScrollIndicators();
})();
