// ============================================
// NGM CHARTS — Chart.js v4 wrapper with dark theme
// ============================================
// Provides: window.NGMCharts
// Requires: Chart.js v4 loaded via CDN before this file.
//
// Memory safety:
//   - All charts registered in _activeCharts Map
//   - create() auto-destroys previous chart on same canvas
//   - destroyAll() called on beforeunload

window.NGMCharts = (() => {
  'use strict';

  // --- Theme colors ---
  const NGM_COLORS = {
    primary:  '#3ecf8e',
    danger:   '#ef4444',
    warning:  '#f59e0b',
    info:     '#3b82f6',
    muted:    '#6b7280',
    purple:   '#8b5cf6',
    pink:     '#ec4899',
    teal:     '#14b8a6',
    orange:   '#f97316',
    bg:       '#1a1a2e',
    grid:     'rgba(255,255,255,0.06)',
    text:     '#e2e8f0',
    palette:  ['#3ecf8e','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
  };

  // --- Set Chart.js global defaults for dark theme ---
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = NGM_COLORS.text;
    Chart.defaults.borderColor = NGM_COLORS.grid;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.padding = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0,0,0,0.85)';
    Chart.defaults.plugins.tooltip.titleFont = { size: 12 };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 11 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;
  }

  // --- Chart registry (memory leak prevention) ---
  const _activeCharts = new Map();

  function create(canvasId, config) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const chart = new Chart(ctx, config);
    _activeCharts.set(canvasId, chart);
    return chart;
  }

  function destroy(canvasId) {
    const existing = _activeCharts.get(canvasId);
    if (existing) {
      existing.destroy();
      _activeCharts.delete(canvasId);
    }
  }

  function destroyAll() {
    _activeCharts.forEach(chart => chart.destroy());
    _activeCharts.clear();
  }

  // --- Pre-built chart helpers ---

  function barChart(canvasId, opts) {
    const datasets = (opts.datasets || []).map((ds, i) => ({
      label: ds.label || '',
      data: ds.data || [],
      backgroundColor: ds.color || NGM_COLORS.palette[i % NGM_COLORS.palette.length],
      borderRadius: 4,
      barThickness: ds.barThickness || undefined,
      ...ds
    }));

    return create(canvasId, {
      type: 'bar',
      data: { labels: opts.labels || [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1 }
        },
        scales: {
          y: {
            beginAtZero: true,
            stacked: opts.stacked || false,
            grid: { color: NGM_COLORS.grid }
          },
          x: {
            stacked: opts.stacked || false,
            grid: { display: false }
          }
        }
      }
    });
  }

  function horizontalBar(canvasId, opts) {
    const datasets = (opts.datasets || []).map((ds, i) => ({
      label: ds.label || '',
      data: ds.data || [],
      backgroundColor: ds.backgroundColor || ds.color || NGM_COLORS.palette[i % NGM_COLORS.palette.length],
      borderRadius: 4,
      barThickness: ds.barThickness || 18,
      ...ds
    }));

    return create(canvasId, {
      type: 'bar',
      data: { labels: opts.labels || [], datasets },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: NGM_COLORS.grid } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  function lineChart(canvasId, opts) {
    const datasets = (opts.datasets || []).map((ds, i) => ({
      label: ds.label || '',
      data: ds.data || [],
      borderColor: ds.color || NGM_COLORS.palette[i % NGM_COLORS.palette.length],
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: ds.color || NGM_COLORS.palette[i % NGM_COLORS.palette.length],
      fill: opts.fill || false,
      tension: 0.3,
      ...ds
    }));

    return create(canvasId, {
      type: 'line',
      data: { labels: opts.labels || [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1 }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: NGM_COLORS.grid }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function doughnutChart(canvasId, opts) {
    const colors = opts.colors || NGM_COLORS.palette.slice(0, (opts.data || []).length);

    return create(canvasId, {
      type: 'doughnut',
      data: {
        labels: opts.labels || [],
        datasets: [{
          data: opts.data || [],
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              padding: 12,
              boxWidth: 10,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }

  // --- Global cleanup ---
  window.addEventListener('beforeunload', destroyAll);

  return {
    NGM_COLORS,
    create,
    destroy,
    destroyAll,
    barChart,
    horizontalBar,
    lineChart,
    doughnutChart
  };
})();
