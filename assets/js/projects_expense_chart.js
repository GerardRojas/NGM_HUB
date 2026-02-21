// ============================================
// PROJECTS — Expense Timeline Chart
// ============================================
// Interactive chart with 3 views, D/W/M granularity,
// and AccountCategory drill-down.
//
// Dependencies:
//   - window.NGM.api(url, options)
//   - window.NGMCharts (Chart.js v4 wrapper)

window.ProjectExpenseChart = (() => {
  'use strict';

  var CHART_ID = 'chart-expense-timeline';

  // ── State ──────────────────────────────────────────────────
  var _loaded = false;
  var _currentProjectId = null;
  var _abortController = null;
  var _rawData = null;
  var _currentView = 'cumulative';     // cumulative | period_bars | stacked_area
  var _currentGranularity = 'month';   // day | week | month
  var _drillCategory = null;           // null = all, string = drilled into one
  var _container = null;

  // ── SVG Icons ──────────────────────────────────────────────
  var ICONS = {
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20L8 14L13 17L21 9"/><path d="M3 20L8 14L13 17L21 9V20H3Z" fill="currentColor" opacity="0.15"/></svg>',
    bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="8" rx="1" fill="currentColor" opacity="0.3"/><rect x="10" y="6" width="4" height="14" rx="1" fill="currentColor" opacity="0.3"/><rect x="17" y="9" width="4" height="11" rx="1" fill="currentColor" opacity="0.3"/></svg>',
    stacked: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20L8 16L13 18L21 12"/><path d="M3 20L8 14L13 16L21 10"/><path d="M3 20L8 12L13 14L21 8"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>'
  };

  // ── Helpers ────────────────────────────────────────────────

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    n = Number(n);
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }

  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function getGroupKey(dateStr, granularity) {
    if (!dateStr) return '';
    if (granularity === 'day') return dateStr;
    if (granularity === 'month') return dateStr.substring(0, 7);
    if (granularity === 'week') {
      var d = new Date(dateStr + 'T00:00:00');
      var day = d.getDay() || 7;
      d.setDate(d.getDate() + 4 - day);
      var yearStart = new Date(d.getFullYear(), 0, 1);
      var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
      return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
    }
    return dateStr;
  }

  function formatLabel(key, granularity) {
    if (granularity === 'day') {
      var parts = key.split('-');
      return parts[1] + '/' + parts[2];
    }
    if (granularity === 'week') {
      return key.replace('-W', ' W');
    }
    if (granularity === 'month') {
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var p = key.split('-');
      var mi = parseInt(p[1], 10) - 1;
      return months[mi] + ' ' + p[0].substring(2);
    }
    return key;
  }

  // ── Aggregation ────────────────────────────────────────────

  function aggregateExpenses(expenses, granularity) {
    var groupMap = {};
    var allCategories = {};

    expenses.forEach(function(e) {
      var key = getGroupKey(e.date, granularity);
      if (!key) return;
      if (!groupMap[key]) {
        groupMap[key] = { label: key, amount: 0, byCategory: {}, byAccount: {} };
      }
      groupMap[key].amount += e.amount;

      var cat = e.account_category || 'Uncategorized';
      groupMap[key].byCategory[cat] = (groupMap[key].byCategory[cat] || 0) + e.amount;
      allCategories[cat] = true;

      var accKey = e.account_id + '||' + e.account_name;
      groupMap[key].byAccount[accKey] = (groupMap[key].byAccount[accKey] || 0) + e.amount;
    });

    var sorted = Object.values(groupMap).sort(function(a, b) {
      return a.label.localeCompare(b.label);
    });

    var cum = 0;
    sorted.forEach(function(d) {
      cum += d.amount;
      d.cumulative = Math.round(cum * 100) / 100;
    });

    return { series: sorted, categories: Object.keys(allCategories).sort() };
  }

  function computeBudgetPaceLine(totalBudget, labels) {
    if (!totalBudget || labels.length === 0) return [];
    var perPeriod = totalBudget / labels.length;
    var cum = 0;
    return labels.map(function() {
      cum += perPeriod;
      return Math.round(cum * 100) / 100;
    });
  }

  function computeBudgetPerPeriod(totalBudget, count) {
    if (!totalBudget || !count) return 0;
    return Math.round((totalBudget / count) * 100) / 100;
  }

  // ── Get working data (respects drill-down) ─────────────────

  function getWorkingExpenses() {
    if (!_rawData || !_rawData.expenses) return [];
    if (!_drillCategory) return _rawData.expenses;
    return _rawData.expenses.filter(function(e) {
      return e.account_category === _drillCategory;
    });
  }

  function getWorkingBudget() {
    if (!_rawData) return 0;
    if (!_drillCategory) return _rawData.total_budget || 0;
    var cats = _rawData.budget_by_category || [];
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].account_category === _drillCategory) return cats[i].total_budget || 0;
    }
    return 0;
  }

  function getCategoryTotals() {
    if (!_rawData || !_rawData.expenses) return {};
    var totals = {};
    _rawData.expenses.forEach(function(e) {
      var cat = e.account_category || 'Uncategorized';
      totals[cat] = (totals[cat] || 0) + e.amount;
    });
    return totals;
  }

  // ── Build HTML ─────────────────────────────────────────────

  function buildHTML() {
    return '' +
      '<div class="pd-chart-card pd-chart-card--full">' +
      '  <div class="pd-timeline-header">' +
      '    <h3 class="pd-chart-title">Expense Timeline</h3>' +
      '    <div class="pd-timeline-controls">' +
      '      <div class="pd-view-toggle">' +
      '        <button class="pd-view-btn' + (_currentView === 'cumulative' ? ' pd-view-btn--active' : '') + '" data-view="cumulative" title="Cumulative Area">' + ICONS.area + '</button>' +
      '        <button class="pd-view-btn' + (_currentView === 'period_bars' ? ' pd-view-btn--active' : '') + '" data-view="period_bars" title="Per Period Bars">' + ICONS.bars + '</button>' +
      '        <button class="pd-view-btn' + (_currentView === 'stacked_area' ? ' pd-view-btn--active' : '') + '" data-view="stacked_area" title="Stacked by Category">' + ICONS.stacked + '</button>' +
      '      </div>' +
      '      <div class="pd-granularity-toggle">' +
      '        <button class="pd-grain-btn' + (_currentGranularity === 'day' ? ' pd-grain-btn--active' : '') + '" data-grain="day">D</button>' +
      '        <button class="pd-grain-btn' + (_currentGranularity === 'week' ? ' pd-grain-btn--active' : '') + '" data-grain="week">W</button>' +
      '        <button class="pd-grain-btn' + (_currentGranularity === 'month' ? ' pd-grain-btn--active' : '') + '" data-grain="month">M</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="pd-drilldown-bar" id="timeline-drilldown-bar" style="display:none;">' +
      '    <button class="pd-drilldown-back" id="timeline-drilldown-back">' + ICONS.back + ' All Categories</button>' +
      '    <span class="pd-drilldown-label" id="timeline-drilldown-label"></span>' +
      '  </div>' +
      '  <div class="pd-chart-wrap pd-chart-wrap--tall">' +
      '    <canvas id="' + CHART_ID + '"></canvas>' +
      '  </div>' +
      '  <div class="pd-category-legend" id="timeline-category-legend"></div>' +
      '</div>';
  }

  // ── Category Legend ────────────────────────────────────────

  function buildCategoryLegend() {
    var legendEl = document.getElementById('timeline-category-legend');
    if (!legendEl) return;

    var palette = window.NGMCharts ? window.NGMCharts.NGM_COLORS.palette : [];
    var totals = getCategoryTotals();
    var cats = Object.keys(totals).sort();

    if (cats.length <= 1) {
      legendEl.innerHTML = '';
      return;
    }

    var html = '';
    cats.forEach(function(cat, i) {
      var color = palette[i % palette.length] || '#888';
      var active = _drillCategory === cat ? ' pd-category-chip--active' : '';
      html += '<button class="pd-category-chip' + active + '" data-category="' + esc(cat) + '">' +
        '<span class="pd-category-chip-dot" style="background:' + color + '"></span>' +
        esc(cat) +
        '<span class="pd-category-chip-amount">' + fmtMoney(totals[cat]) + '</span>' +
        '</button>';
    });
    legendEl.innerHTML = html;
  }

  // ── Chart Rendering ────────────────────────────────────────

  function renderChart() {
    var Charts = window.NGMCharts;
    if (!Charts) return;

    var expenses = getWorkingExpenses();
    if (expenses.length === 0) {
      Charts.destroy(CHART_ID);
      var canvas = document.getElementById(CHART_ID);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.innerHTML = '<div class="pd-timeline-empty">No expense data available</div>';
      }
      return;
    }

    var agg = aggregateExpenses(expenses, _currentGranularity);

    if (_currentView === 'cumulative') {
      renderCumulativeView(agg, Charts);
    } else if (_currentView === 'period_bars') {
      renderPeriodBarsView(agg, Charts);
    } else if (_currentView === 'stacked_area') {
      renderStackedAreaView(agg, Charts);
    }
  }

  function renderCumulativeView(agg, Charts) {
    var C = Charts.NGM_COLORS;
    var labels = agg.series.map(function(d) { return formatLabel(d.label, _currentGranularity); });
    var cumData = agg.series.map(function(d) { return d.cumulative; });
    var budget = getWorkingBudget();
    var budgetPace = computeBudgetPaceLine(budget, labels);

    var datasets = [];

    // Budget pace line (dashed)
    if (budgetPace.length > 0) {
      datasets.push({
        label: 'Budget (cumulative)',
        data: budgetPace,
        borderColor: C.muted,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0
      });
    }

    // Projection placeholder (dashed)
    datasets.push({
      label: 'Projection',
      data: [],
      borderColor: C.info,
      borderDash: [4, 3],
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0,
      hidden: true
    });

    // Actual cumulative (filled area)
    datasets.push({
      label: 'Actual (cumulative)',
      data: cumData,
      borderColor: C.primary,
      borderWidth: 2.5,
      pointRadius: labels.length > 60 ? 0 : 3,
      pointBackgroundColor: C.primary,
      tension: 0,
      fill: { target: 'origin', above: 'rgba(62, 207, 142, 0.08)' }
    });

    Charts.create(CHART_ID, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: buildLineOptions(C)
    });
  }

  function renderPeriodBarsView(agg, Charts) {
    var C = Charts.NGM_COLORS;
    var labels = agg.series.map(function(d) { return formatLabel(d.label, _currentGranularity); });
    var amounts = agg.series.map(function(d) { return Math.round(d.amount * 100) / 100; });
    var budget = getWorkingBudget();
    var budgetPerPeriod = computeBudgetPerPeriod(budget, labels.length);
    var paceLine = labels.map(function() { return budgetPerPeriod; });

    var datasets = [
      {
        label: 'Spend',
        data: amounts,
        backgroundColor: 'rgba(62, 207, 142, 0.6)',
        borderRadius: 4,
        order: 2
      }
    ];

    if (budget > 0) {
      datasets.push({
        label: 'Budget Pace',
        type: 'line',
        data: paceLine,
        borderColor: C.muted,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        order: 1
      });
    }

    Charts.create(CHART_ID, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y); }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: C.grid },
            ticks: { callback: function(v) { return fmtMoney(v); } }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderStackedAreaView(agg, Charts) {
    var C = Charts.NGM_COLORS;
    var palette = C.palette;
    var labels = agg.series.map(function(d) { return formatLabel(d.label, _currentGranularity); });

    // If drilled into a category, show individual accounts; otherwise show categories
    var groups;
    if (_drillCategory) {
      // Get unique accounts within the drilled category
      var accountSet = {};
      getWorkingExpenses().forEach(function(e) {
        accountSet[e.account_id + '||' + e.account_name] = e.account_name;
      });
      groups = Object.keys(accountSet).sort();
    } else {
      groups = agg.categories;
    }

    var datasets = groups.map(function(g, i) {
      var color = palette[i % palette.length];
      var displayName = _drillCategory ? g.split('||')[1] || g : g;

      return {
        label: displayName,
        data: agg.series.map(function(d) {
          if (_drillCategory) {
            return d.byAccount[g] || 0;
          }
          return d.byCategory[g] || 0;
        }),
        borderColor: color,
        backgroundColor: color + '20',
        fill: true,
        tension: 0,
        pointRadius: 0
      };
    });

    Charts.create(CHART_ID, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y); }
            }
          }
        },
        scales: {
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: C.grid },
            ticks: { callback: function(v) { return fmtMoney(v); } }
          },
          x: { stacked: true, grid: { display: false } }
        }
      }
    });
  }

  function buildLineOptions(C) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: function(ctx) { return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y); }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: C.grid },
          ticks: { callback: function(v) { return fmtMoney(v); } }
        },
        x: { grid: { display: false } }
      }
    };
  }

  // ── Event Handlers ─────────────────────────────────────────

  function attachEvents() {
    if (!_container) return;

    _container.addEventListener('click', function(e) {
      // View toggle
      var viewBtn = e.target.closest('.pd-view-btn');
      if (viewBtn) {
        var view = viewBtn.dataset.view;
        if (view && view !== _currentView) {
          _currentView = view;
          updateActiveButtons();
          renderChart();
        }
        return;
      }

      // Granularity toggle
      var grainBtn = e.target.closest('.pd-grain-btn');
      if (grainBtn) {
        var grain = grainBtn.dataset.grain;
        if (grain && grain !== _currentGranularity) {
          _currentGranularity = grain;
          updateActiveButtons();
          renderChart();
        }
        return;
      }

      // Category chip click (drill down)
      var chip = e.target.closest('.pd-category-chip');
      if (chip) {
        var cat = chip.dataset.category;
        if (cat) {
          drillDown(cat);
        }
        return;
      }

      // Drill-up back button
      var backBtn = e.target.closest('.pd-drilldown-back');
      if (backBtn) {
        drillUp();
        return;
      }
    });
  }

  function updateActiveButtons() {
    if (!_container) return;

    // View buttons
    _container.querySelectorAll('.pd-view-btn').forEach(function(btn) {
      btn.classList.toggle('pd-view-btn--active', btn.dataset.view === _currentView);
    });

    // Granularity buttons
    _container.querySelectorAll('.pd-grain-btn').forEach(function(btn) {
      btn.classList.toggle('pd-grain-btn--active', btn.dataset.grain === _currentGranularity);
    });
  }

  function drillDown(category) {
    _drillCategory = category;

    var bar = document.getElementById('timeline-drilldown-bar');
    var label = document.getElementById('timeline-drilldown-label');
    if (bar) bar.style.display = 'flex';
    if (label) label.textContent = category;

    buildCategoryLegend();
    renderChart();
  }

  function drillUp() {
    _drillCategory = null;

    var bar = document.getElementById('timeline-drilldown-bar');
    if (bar) bar.style.display = 'none';

    buildCategoryLegend();
    renderChart();
  }

  // ── Public API ─────────────────────────────────────────────

  async function load(projectId) {
    if (!projectId) return;
    if (_currentProjectId === projectId && _loaded) return;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _currentProjectId = projectId;

    _container = document.getElementById('expense-timeline-container');
    if (!_container) return;

    // Show loading skeleton
    _container.innerHTML =
      '<div class="pd-chart-card pd-chart-card--full">' +
      '  <div class="pd-timeline-header">' +
      '    <h3 class="pd-chart-title">Expense Timeline</h3>' +
      '  </div>' +
      '  <div class="pd-chart-wrap pd-chart-wrap--tall">' +
      '    <div class="pd-timeline-empty">Loading expense data...</div>' +
      '  </div>' +
      '</div>';

    try {
      var API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';
      var url = API_BASE + '/analytics/projects/' + encodeURIComponent(projectId) + '/expense-timeline';
      var token = localStorage.getItem('ngmToken');
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      var res = await fetch(url, {
        headers: headers,
        signal: _abortController.signal
      });

      if (!res.ok) throw new Error('Failed to load expense timeline (' + res.status + ')');
      _rawData = await res.json();

      // Reset drill-down state on fresh load
      _drillCategory = null;

      _container.innerHTML = buildHTML();
      attachEvents();
      buildCategoryLegend();
      renderChart();
      _loaded = true;

    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[ExpenseChart] Load failed:', err);
      _container.innerHTML =
        '<div class="pd-chart-card pd-chart-card--full">' +
        '  <div class="pd-timeline-header">' +
        '    <h3 class="pd-chart-title">Expense Timeline</h3>' +
        '  </div>' +
        '  <div class="pd-chart-wrap pd-chart-wrap--tall">' +
        '    <div class="pd-timeline-empty">Failed to load expense data</div>' +
        '  </div>' +
        '</div>';
    }
  }

  function unload() {
    if (window.NGMCharts) window.NGMCharts.destroy(CHART_ID);
    _loaded = false;
    _currentProjectId = null;
    _rawData = null;
    _drillCategory = null;
    _container = null;
    if (_abortController) { _abortController.abort(); _abortController = null; }
  }

  function reload() {
    var pid = _currentProjectId;
    _loaded = false;
    if (pid) load(pid);
  }

  return { load: load, unload: unload, reload: reload };
})();
