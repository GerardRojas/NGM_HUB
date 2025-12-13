// assets/js/pipeline_layout.js
(function () {
  function initTableWidthSlider() {
    const slider = document.getElementById("pm-width-slider");
    const label = document.getElementById("pm-width-value");
    if (!slider) return;

    const KEY = "pmTableMinWidth";

    const apply = (px) => {
      document.documentElement.style.setProperty("--pm-table-min-width", `${px}px`);
      if (label) label.textContent = `${px}px`;
    };

    const saved = Number(localStorage.getItem(KEY) || slider.value || 1200);
    slider.value = String(saved);
    apply(saved);

    slider.addEventListener("input", (e) => {
      const px = Number(e.target.value);
      apply(px);
      localStorage.setItem(KEY, String(px));
    });
  }

  // expone función (por si quieres llamarla después)
  window.initTableWidthSlider = initTableWidthSlider;
})();
