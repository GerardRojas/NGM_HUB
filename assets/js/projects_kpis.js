/**
 * NGM HUB -- Executive KPIs Tab
 * Renders cross-project KPI cards, burn-rate chart, monthly spend,
 * top vendors doughnut, and a sortable projects table.
 *
 * Dependencies:
 *   - window.NGM.api(url, options)
 *   - window.NGMCharts.create / .destroy / .horizontalBar / .lineChart / .doughnutChart
 *   - window.NGMCharts.NGM_COLORS
 */
window.ProjectKPIs = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let _loaded = false;
  let _abortController = null;

  // Chart canvas IDs managed by this module
  const CHART_IDS = [
    'chart-kpi-burn',
    'chart-kpi-monthly',
    'chart-kpi-vendors'
  ];

  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Format monetary amounts for display.
   * >= 1M  -> "$1.2M"
   * >= 1K  -> "$45.3K"
   * < 1K   -> "$830"
   */
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    n = Number(n);
    var sign = n < 0 ? '-' : '';
    var abs = Math.abs(n);
    if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000)     return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
    return sign + '$' + abs.toFixed(0);
  }

  /** Format a percentage 0-100 with one decimal. */
  function fmtPct(n) {
    if (n == null || isNaN(n)) return '0%';
    return Number(n).toFixed(1) + '%';
  }

  /** Clamp a number between min and max. */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /** Escape HTML to prevent XSS. */
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  // ── Status helpers ─────────────────────────────────────────────────

  var STATUS_LABELS = {
    on_track:    'On Track',
    at_risk:     'At Risk',
    over_budget: 'Over Budget'
  };

  function statusClass(status) {
    if (status === 'on_track')    return 'pk-status--on_track';
    if (status === 'at_risk')     return 'pk-status--at_risk';
    if (status === 'over_budget') return 'pk-status--over_budget';
    return 'pk-status--on_track';
  }

  // ── SVG Icons ──────────────────────────────────────────────────────

  var ICONS = {
    error: '<svg class="pk-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  // ── Build HTML ─────────────────────────────────────────────────────

  function buildHTML(data) {
    var activeProjects = Number(data.active_projects || 0);
    var totalSpend     = Number(data.total_spend || 0);
    var totalBudget    = Number(data.total_budget || 0);
    var avgMargin      = Number(data.avg_margin_pct || 0);
    var authRate       = Number(data.daneel_auth_rate || 0);

    // Margin color
    var marginClass = '';
    if (avgMargin >= 20) marginClass = ' pk-kpi-value--success';
    else if (avgMargin < 10) marginClass = ' pk-kpi-value--warning';

    // Auth rate color (accent by default)
    var authClass = '';

    var projects = data.projects || [];
    var monthlySpend = data.monthly_spend_total || [];
    var topVendors = data.top_vendors || [];

    // Sort projects by burn_pct descending for burn chart
    var sortedProjects = projects.slice().sort(function(a, b) {
      return (Number(b.burn_pct) || 0) - (Number(a.burn_pct) || 0);
    });

    return '' +
      '<div class="pk-grid">' +

      // ── KPI Cards Row ──
      '  <div class="pd-kpi-row">' +

      // Card 1: Active Projects
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Active Projects</span>' +
      '      <span class="pd-kpi-value pd-kpi-value--neutral">' + activeProjects + '</span>' +
      '      <span class="pd-kpi-sub">active projects</span>' +
      '    </div>' +

      // Card 2: Total Spend
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Total Spend</span>' +
      '      <span class="pd-kpi-value">' + esc(fmtMoney(totalSpend)) + '</span>' +
      '      <span class="pd-kpi-sub">' + esc(fmtPct(totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0)) + ' of total budget</span>' +
      '      <div class="pd-kpi-progress">' +
      '        <div class="pd-kpi-progress-fill" style="width:' + clamp(totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0, 0, 100) + '%"></div>' +
      '      </div>' +
      '    </div>' +

      // Card 3: Avg Margin
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Avg Margin</span>' +
      '      <span class="pd-kpi-value' + marginClass + '">' + esc(fmtPct(avgMargin)) + '</span>' +
      '      <span class="pd-kpi-sub">average margin</span>' +
      '    </div>' +

      // Card 4: Daneel Auth Rate
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Daneel Auth Rate</span>' +
      '      <span class="pd-kpi-value' + authClass + '">' + esc(fmtPct(authRate)) + '</span>' +
      '      <span class="pd-kpi-sub">authorization rate</span>' +
      '      <div class="pd-kpi-progress">' +
      '        <div class="pd-kpi-progress-fill" style="width:' + clamp(authRate, 0, 100) + '%"></div>' +
      '      </div>' +
      '    </div>' +

      '  </div>' +

      // ── Charts Row (burn + monthly) ──
      '  <div class="pk-charts-row">' +

      // Burn Rate chart (stacked horizontal bar)
      '    <div class="pk-chart-card pk-chart-card--burn">' +
      '      <h3 class="pd-chart-title">Burn Rate by Project</h3>' +
      '      <div class="pd-chart-wrap">' +
             (sortedProjects.length > 0
               ? '<canvas id="chart-kpi-burn"></canvas>'
               : '<div class="pd-chart-empty">No project data</div>') +
      '      </div>' +
      '    </div>' +

      // Monthly Spend line chart
      '    <div class="pk-chart-card">' +
      '      <h3 class="pd-chart-title">Monthly Spend (All Projects)</h3>' +
      '      <div class="pd-chart-wrap">' +
             (monthlySpend.length > 0
               ? '<canvas id="chart-kpi-monthly"></canvas>'
               : '<div class="pd-chart-empty">No monthly data</div>') +
      '      </div>' +
      '    </div>' +

      '  </div>' +

      // ── Top Vendors Doughnut (full-width card with constrained chart) ──
      '  <div class="pk-charts-row">' +
      '    <div class="pk-chart-card">' +
      '      <h3 class="pd-chart-title">Top Vendors</h3>' +
      '      <div class="pd-chart-wrap">' +
             (topVendors.length > 0
               ? '<canvas id="chart-kpi-vendors"></canvas>'
               : '<div class="pd-chart-empty">No vendor data</div>') +
      '      </div>' +
      '    </div>' +

      // Placeholder for balance (empty card or future chart)
      '    <div class="pk-chart-card pk-chart-card--vendor-info">' +
      '      <h3 class="pd-chart-title">Vendor Breakdown</h3>' +
      '      <div class="pk-vendor-list">' +
             buildVendorList(topVendors) +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      // ── Projects KPI Table ──
      '  <div class="pk-table-wrap">' +
      '    <table class="pk-table">' +
      '      <thead>' +
      '        <tr>' +
      '          <th>Project</th>' +
      '          <th>Budget</th>' +
      '          <th>Actual</th>' +
      '          <th>Burn %</th>' +
      '          <th>Margin</th>' +
      '          <th>Tasks %</th>' +
      '          <th>Status</th>' +
      '        </tr>' +
      '      </thead>' +
      '      <tbody>' +
             buildTableRows(projects) +
      '      </tbody>' +
      '    </table>' +
      '  </div>' +

      '</div>';
  }

  /** Build vendor list rows for the vendor info card. */
  function buildVendorList(vendors) {
    if (!vendors || vendors.length === 0) {
      return '<div class="pd-chart-empty">No vendor data</div>';
    }
    var html = '';
    vendors.forEach(function(v) {
      var name = esc(v.vendor_name || v.name || 'Unknown');
      var amount = fmtMoney(v.amount || 0);
      var count = Number(v.project_count || 0);
      html += '' +
        '<div class="pk-vendor-row">' +
        '  <div class="pk-vendor-name">' + name + '</div>' +
        '  <div class="pk-vendor-meta">' +
        '    <span class="pk-vendor-amount">' + amount + '</span>' +
        '    <span class="pk-vendor-count">' + count + ' project' + (count !== 1 ? 's' : '') + '</span>' +
        '  </div>' +
        '</div>';
    });
    return html;
  }

  /** Build table body rows for the projects KPI table. */
  function buildTableRows(projects) {
    if (!projects || projects.length === 0) {
      return '<tr><td colspan="7" class="pk-table-empty">No active projects</td></tr>';
    }

    var html = '';
    projects.forEach(function(p) {
      var budget   = Number(p.budget || 0);
      var actual   = Number(p.actual || 0);
      var burnPct  = Number(p.burn_pct || 0);
      var margin   = budget > 0 ? ((budget - actual) / budget * 100) : 0;
      var tasksPct = Number(p.tasks_completion_pct || 0);
      var status   = p.status || 'on_track';

      // Burn color
      var burnClass = '';
      if (burnPct >= 90) burnClass = ' pk-cell--danger';
      else if (burnPct >= 75) burnClass = ' pk-cell--warning';

      // Margin color
      var marginClass = '';
      if (margin >= 20) marginClass = ' pk-cell--success';
      else if (margin < 10) marginClass = ' pk-cell--danger';

      html += '' +
        '<tr>' +
        '  <td class="pk-cell-name">' +
        '    <span class="pk-status-dot ' + statusClass(status) + '"></span>' +
        '    ' + esc(p.project_name || 'Unnamed') +
        '  </td>' +
        '  <td>' + fmtMoney(budget) + '</td>' +
        '  <td>' + fmtMoney(actual) + '</td>' +
        '  <td class="' + burnClass + '">' + fmtPct(burnPct) + '</td>' +
        '  <td class="' + marginClass + '">' + fmtPct(margin) + '</td>' +
        '  <td>' + fmtPct(tasksPct) + '</td>' +
        '  <td><span class="pk-status ' + statusClass(status) + '">' + (STATUS_LABELS[status] || status) + '</span></td>' +
        '</tr>';
    });
    return html;
  }

  // ── Skeleton HTML ──────────────────────────────────────────────────

  function buildSkeleton() {
    function skeletonCard() {
      return '' +
        '<div class="pd-skeleton--card">' +
        '  <div class="pd-skeleton-line pd-skeleton-line--sm" style="width:50%"></div>' +
        '  <div class="pd-skeleton-line pd-skeleton-line--lg" style="margin-top:12px"></div>' +
        '  <div class="pd-skeleton-line pd-skeleton-line--sm" style="margin-top:8px;width:60%"></div>' +
        '</div>';
    }

    function skeletonChart() {
      return '' +
        '<div class="pd-skeleton--card">' +
        '  <div class="pd-skeleton-line" style="width:40%;margin-bottom:4px"></div>' +
        '  <div class="pd-skeleton-chart"></div>' +
        '</div>';
    }

    function skeletonTable() {
      return '' +
        '<div class="pk-skeleton-table">' +
        '  <div class="pd-skeleton-line" style="width:100%;height:36px;margin-bottom:8px"></div>' +
        '  <div class="pd-skeleton-line" style="width:100%;height:28px;margin-bottom:6px"></div>' +
        '  <div class="pd-skeleton-line" style="width:100%;height:28px;margin-bottom:6px"></div>' +
        '  <div class="pd-skeleton-line" style="width:100%;height:28px;margin-bottom:6px"></div>' +
        '  <div class="pd-skeleton-line" style="width:95%;height:28px;margin-bottom:6px"></div>' +
        '  <div class="pd-skeleton-line" style="width:90%;height:28px"></div>' +
        '</div>';
    }

    return '' +
      '<div class="pk-grid">' +
      '  <div class="pd-kpi-row">' +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
      '  </div>' +
      '  <div class="pk-charts-row">' +
           skeletonChart() +
           skeletonChart() +
      '  </div>' +
      '  <div class="pk-charts-row">' +
           skeletonChart() +
           skeletonChart() +
      '  </div>' +
           skeletonTable() +
      '</div>';
  }

  // ── Error HTML ─────────────────────────────────────────────────────

  function buildError(message) {
    return '' +
      '<div class="pd-error">' +
        ICONS.error +
      '  <h4 class="pd-error-title">Failed to load executive KPIs</h4>' +
      '  <p class="pd-error-msg">' + esc(message || 'Unknown error') + '</p>' +
      '  <button class="pd-error-retry" onclick="window.ProjectKPIs.reload()">Retry</button>' +
      '</div>';
  }

  // ── Render Charts ──────────────────────────────────────────────────

  function renderCharts(data) {
    var Charts = window.NGMCharts;
    if (!Charts) {
      console.warn('[ProjectKPIs] NGMCharts not available -- skipping charts');
      return;
    }

    var C = Charts.NGM_COLORS;
    var colors = (C && C.palette) || [
      '#3ecf8e', '#3b82f6', '#f59e0b', '#ef4444',
      '#8b5cf6', '#fb923c', '#22c55e', '#ec4899',
      '#14b8a6', '#6366f1', '#eab308', '#06b6d4'
    ];

    renderBurnChart(data, Charts, C);
    renderMonthlyChart(data, Charts, C);
    renderVendorsChart(data, Charts, C, colors);
  }

  /** Burn Rate -- stacked horizontal bar: Spent (green) + Remaining (gray). */
  function renderBurnChart(data, Charts, C) {
    var projects = (data.projects || []).slice().sort(function(a, b) {
      return (Number(b.burn_pct) || 0) - (Number(a.burn_pct) || 0);
    });

    if (projects.length === 0) return;

    var labels = projects.map(function(p) { return p.project_name || 'Unnamed'; });
    var spentData = projects.map(function(p) { return Number(p.actual || 0); });
    var remainingData = projects.map(function(p) {
      var budget = Number(p.budget || 0);
      var actual = Number(p.actual || 0);
      return Math.max(0, budget - actual);
    });

    // Determine bar colors based on burn status
    var spentColors = projects.map(function(p) {
      var burn = Number(p.burn_pct || 0);
      if (burn >= 90) return C.danger;
      if (burn >= 75) return C.warning;
      return C.primary;
    });

    Charts.create('chart-kpi-burn', {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Spent',
            data: spentData,
            backgroundColor: spentColors,
            borderRadius: 4,
            barThickness: 18
          },
          {
            label: 'Remaining',
            data: remainingData,
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 4,
            barThickness: 18
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { boxWidth: 10, padding: 12, font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.x);
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: C.grid },
            ticks: { callback: function(v) { return fmtMoney(v); } }
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: {
              font: { size: 11 },
              callback: function(value, index) {
                var label = this.getLabelForValue(value);
                return label.length > 20 ? label.substring(0, 18) + '...' : label;
              }
            }
          }
        }
      }
    });
  }

  /** Monthly Spend -- line chart. */
  function renderMonthlyChart(data, Charts, C) {
    var monthlySpend = data.monthly_spend_total || [];
    if (monthlySpend.length === 0) return;

    var labels = monthlySpend.map(function(m) { return m.month || ''; });
    var amounts = monthlySpend.map(function(m) { return Number(m.amount || 0); });

    Charts.create('chart-kpi-monthly', {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Spend',
          data: amounts,
          borderColor: C.primary,
          backgroundColor: 'rgba(62, 207, 142, 0.1)',
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: C.primary,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) { return 'Spend: ' + fmtMoney(ctx.parsed.y); }
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

  /** Top Vendors -- doughnut chart. */
  function renderVendorsChart(data, Charts, C, palette) {
    var topVendors = data.top_vendors || [];
    if (topVendors.length === 0) return;

    var labels = topVendors.map(function(v) { return v.vendor_name || v.name || 'Unknown'; });
    var amounts = topVendors.map(function(v) { return Number(v.amount || 0); });
    var vendorColors = topVendors.map(function(_, i) { return palette[i % palette.length]; });

    Charts.doughnutChart('chart-kpi-vendors', {
      labels: labels,
      data: amounts,
      colors: vendorColors
    });
  }

  // ── Destroy Charts ─────────────────────────────────────────────────

  function destroyCharts() {
    CHART_IDS.forEach(function(id) {
      try {
        if (window.NGMCharts && typeof window.NGMCharts.destroy === 'function') {
          window.NGMCharts.destroy(id);
        }
      } catch (e) {
        // Chart may not exist yet -- ignore
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Load executive KPIs for all active projects.
   * No project selector needed -- shows everything.
   */
  async function load() {
    if (_loaded) return;

    // Cancel any in-flight request
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    var container = document.getElementById('kpis-panel-content');
    if (!container) {
      console.warn('[ProjectKPIs] #kpis-panel-content not found');
      return;
    }

    // Show skeleton immediately
    container.innerHTML = buildSkeleton();

    try {
      var data = await window.NGM.api(
        '/analytics/executive/kpis',
        { signal: _abortController.signal }
      );

      // API returned null/empty
      if (!data) {
        container.innerHTML = buildError('The server returned no data.');
        return;
      }

      // Destroy previous chart instances before building new DOM
      destroyCharts();

      container.innerHTML = buildHTML(data);
      renderCharts(data);
      _loaded = true;

    } catch (err) {
      if (err.name === 'AbortError') return; // Request was intentionally cancelled
      console.error('[ProjectKPIs] Failed to load:', err);
      container.innerHTML = buildError(err.message || String(err));
    }
  }

  /**
   * Tear down -- destroy charts and reset state.
   * Call this when the user navigates away from the KPIs tab.
   */
  function unload() {
    destroyCharts();
    _loaded = false;
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
  }

  /**
   * Force reload the KPIs panel.
   * Used by the retry button and can be called externally.
   */
  function reload() {
    _loaded = false;
    load();
  }

  /**
   * Check whether the KPIs panel is currently loaded.
   * @returns {boolean}
   */
  function isLoaded() {
    return _loaded;
  }

  // ── Global cleanup ─────────────────────────────────────────────────
  window.addEventListener('beforeunload', unload);

  // ── Expose ─────────────────────────────────────────────────────────
  return {
    load:     load,
    unload:   unload,
    reload:   reload,
    isLoaded: isLoaded
  };
})();
