/**
 * NGM HUB — Project Health Dashboard
 * Renders KPI cards, charts, Daneel stats and task progress
 * for a selected project inside the dashboard tab panel.
 *
 * Dependencies:
 *   - window.NGM.api(url, options)
 *   - window.NGMCharts.doughnutChart / .horizontalBar / .lineChart / .destroy
 *   - window.NGMCharts.NGM_COLORS
 */
window.ProjectDashboard = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let _loaded = false;
  let _currentProjectId = null;
  let _abortController = null;

  // Chart canvas IDs managed by this module
  const CHART_IDS = [
    'chart-by-category',
    'chart-top-vendors',
    'chart-monthly-spend',
    'chart-cost-projection',
    'chart-expense-timeline'
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
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return '$' + (n / 1_000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
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

  /**
   * Determine the status color class suffix for a percentage.
   * 0-74% = accent (green), 75-89% = warning, 90%+ = danger.
   */
  function budgetTier(pct) {
    if (pct >= 90) return 'danger';
    if (pct >= 75) return 'warning';
    return '';
  }

  // ── SVG Icons (inline, no external deps) ───────────────────────────

  const ICONS = {
    daneel: '<svg class="pd-card-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    tasks: '<svg class="pd-card-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    error: '<svg class="pd-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  // ── Build HTML ─────────────────────────────────────────────────────

  function buildDashboardHTML(data) {
    // Backend returns flat keys — map to local vars
    var daneel       = data.daneel || {};
    var tasks        = data.tasks  || {};

    var budgetTotal  = Number(data.budget_total || 0);
    var spent        = Number(data.spent_total || 0);
    var spentPct     = Number(data.spent_percent || (budgetTotal > 0 ? (spent / budgetTotal) * 100 : 0));
    var tier         = budgetTier(spentPct);

    var pendingCount = Number(data.pending_auth_count || 0);
    var pendingAmt   = Number(data.pending_auth_amount || 0);
    var receiptCount = Number(data.pending_receipts_count || 0);

    // Daneel
    var authRate       = Number(daneel.authorization_rate || 0);
    var pendingInfo    = Number(daneel.pending_info || 0);
    var totalProcessed = Number(daneel.total_processed || 0);

    // Tasks
    var tasksDone       = Number(tasks.completed || 0);
    var tasksTotal      = Number(tasks.total || 0);
    var tasksBacklog    = Number(tasks.backlog || 0);
    var tasksInProgress = Number(tasks.in_progress || 0);
    var completionPct   = Number(tasks.completion_percent || (tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0));

    // SVG ring for Daneel auth rate
    var ringRadius    = 26;
    var ringCircumf   = 2 * Math.PI * ringRadius;
    var ringOffset    = ringCircumf - (ringCircumf * clamp(authRate, 0, 100) / 100);

    return '' +
      '<div class="pd-grid">' +

      // ── KPI Row ──
      '  <div class="pd-kpi-row">' +

      // Card 1: Budget Total
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Total Budget</span>' +
      '      <span class="pd-kpi-value pd-kpi-value--neutral">' + esc(fmtMoney(budgetTotal)) + '</span>' +
      '      <span class="pd-kpi-sub">Allocated budget</span>' +
      '    </div>' +

      // Card 2: Spent
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Spent</span>' +
      '      <span class="pd-kpi-value' + (tier ? ' pd-kpi-value--' + tier : '') + '">' + esc(fmtMoney(spent)) + '</span>' +
      '      <span class="pd-kpi-sub">' + esc(fmtPct(spentPct)) + ' of budget</span>' +
      '      <div class="pd-kpi-progress">' +
      '        <div class="pd-kpi-progress-fill' + (tier ? ' pd-kpi-progress-fill--' + tier : '') + '" style="width:' + clamp(spentPct, 0, 100) + '%"></div>' +
      '      </div>' +
      '    </div>' +

      // Card 3: Pending Auth
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Pending Authorization</span>' +
      '      <span class="pd-kpi-value pd-kpi-value--warning">' + pendingCount + '</span>' +
      '      <span class="pd-kpi-sub">' + esc(fmtMoney(pendingAmt)) + ' to authorize</span>' +
      '    </div>' +

      // Card 4: Pending Receipts
      '    <div class="pd-kpi-card">' +
      '      <span class="pd-kpi-label">Pending Receipts</span>' +
      '      <span class="pd-kpi-value' + (receiptCount > 0 ? ' pd-kpi-value--warning' : ' pd-kpi-value--neutral') + '">' + receiptCount + '</span>' +
      '      <span class="pd-kpi-sub">without receipt</span>' +
      '    </div>' +

      '  </div>' +

      // ── Expense Timeline (rendered by ProjectExpenseChart module) ──
      '  <div id="expense-timeline-container"></div>' +

      // ── Full-width Line Chart: Budget vs Actual ──
      '  <div class="pd-chart-card pd-chart-card--full">' +
      '    <h3 class="pd-chart-title">Budget vs Actual</h3>' +
      '    <div class="pd-chart-wrap pd-chart-wrap--tall">' +
      '      <canvas id="chart-cost-projection"></canvas>' +
      '    </div>' +
      '  </div>' +

      // ── Full-width Line Chart: Monthly Spend ──
      '  <div class="pd-chart-card pd-chart-card--full">' +
      '    <h3 class="pd-chart-title">Monthly Spend</h3>' +
      '    <div class="pd-chart-wrap">' +
      '      <canvas id="chart-monthly-spend"></canvas>' +
      '    </div>' +
      '  </div>' +

      // ── Charts Row (2 columns) ──
      '  <div class="pd-charts-row">' +

      // Doughnut: Spend by Category
      '    <div class="pd-chart-card">' +
      '      <h3 class="pd-chart-title">Spend by Category</h3>' +
      '      <div class="pd-chart-wrap">' +
      '        <canvas id="chart-by-category"></canvas>' +
      '      </div>' +
      '    </div>' +

      // Horizontal Bar: Top Vendors
      '    <div class="pd-chart-card">' +
      '      <h3 class="pd-chart-title">Top Vendors</h3>' +
      '      <div class="pd-chart-wrap">' +
      '        <canvas id="chart-top-vendors"></canvas>' +
      '      </div>' +
      '    </div>' +

      '  </div>' +

      // ── Bottom Row: Daneel + Tasks ──
      '  <div class="pd-bottom-row">' +

      // Daneel Card
      '    <div class="pd-daneel-card">' +
      '      <h3 class="pd-card-title">' + ICONS.daneel + ' Daneel Stats</h3>' +
      '      <div class="pd-daneel-stats">' +

      // Auth Rate with ring
      '        <div class="pd-daneel-stat">' +
      '          <div class="pd-auth-ring">' +
      '            <svg viewBox="0 0 64 64">' +
      '              <circle class="pd-auth-ring-bg" cx="32" cy="32" r="' + ringRadius + '"/>' +
      '              <circle class="pd-auth-ring-fill" cx="32" cy="32" r="' + ringRadius + '"' +
      '                stroke-dasharray="' + ringCircumf.toFixed(2) + '"' +
      '                stroke-dashoffset="' + ringOffset.toFixed(2) + '"/>' +
      '            </svg>' +
      '            <span class="pd-auth-ring-text">' + esc(fmtPct(authRate)) + '</span>' +
      '          </div>' +
      '          <div class="pd-daneel-stat-label">Auth Rate</div>' +
      '        </div>' +

      // Pending Info
      '        <div class="pd-daneel-stat">' +
      '          <div class="pd-daneel-stat-value' + (pendingInfo > 0 ? ' pd-daneel-stat-value--warning' : '') + '">' + pendingInfo + '</div>' +
      '          <div class="pd-daneel-stat-label">Pending Info</div>' +
      '        </div>' +

      // Total Processed
      '        <div class="pd-daneel-stat">' +
      '          <div class="pd-daneel-stat-value pd-daneel-stat-value--accent">' + totalProcessed + '</div>' +
      '          <div class="pd-daneel-stat-label">Processed</div>' +
      '        </div>' +

      '      </div>' +
      '    </div>' +

      // Tasks Card
      '    <div class="pd-tasks-card">' +
      '      <div class="pd-tasks-header">' +
      '        <h3 class="pd-card-title">' + ICONS.tasks + ' Tasks</h3>' +
      '        <span class="pd-tasks-count">' + tasksDone + '/' + tasksTotal + ' completed</span>' +
      '      </div>' +
      '      <div class="pd-progress-bar">' +
      '        <div class="pd-progress-fill" style="width:' + clamp(completionPct, 0, 100) + '%"></div>' +
      '      </div>' +
      '      <div class="pd-tasks-breakdown">' +
      '        <span class="pd-tasks-pill"><span class="pd-tasks-pill-dot pd-tasks-pill-dot--backlog"></span>Backlog: ' + tasksBacklog + '</span>' +
      '        <span class="pd-tasks-pill"><span class="pd-tasks-pill-dot pd-tasks-pill-dot--progress"></span>In Progress: ' + tasksInProgress + '</span>' +
      '        <span class="pd-tasks-pill"><span class="pd-tasks-pill-dot pd-tasks-pill-dot--done"></span>Done: ' + tasksDone + '</span>' +
      '      </div>' +
      '    </div>' +

      '  </div>' +

      '</div>';
  }

  // ── Skeleton HTML ──────────────────────────────────────────────────

  function buildSkeletonHTML() {
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

    return '' +
      '<div class="pd-grid">' +
      '  <div class="pd-kpi-row">' +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
      '  </div>' +
      '  <div class="pd-charts-row">' +
           skeletonChart() +
           skeletonChart() +
      '  </div>' +
      '  <div style="margin-bottom:24px">' + skeletonChart() + '</div>' +
      '  <div class="pd-bottom-row">' +
           skeletonChart() +
           skeletonChart() +
      '  </div>' +
      '</div>';
  }

  // ── Error HTML ─────────────────────────────────────────────────────

  function buildErrorHTML(message) {
    return '' +
      '<div class="pd-error">' +
        ICONS.error +
      '  <h4 class="pd-error-title">Failed to load dashboard</h4>' +
      '  <p class="pd-error-msg">' + esc(message || 'Unknown error') + '</p>' +
      '  <button class="pd-error-retry" onclick="window.ProjectDashboard.reload()">Retry</button>' +
      '</div>';
  }

  // ── Render Charts ──────────────────────────────────────────────────

  function renderCharts(data) {
    var Charts = window.NGMCharts;
    if (!Charts) {
      console.warn('[ProjectDashboard] NGMCharts not available — skipping charts');
      return;
    }

    var colors = (Charts.NGM_COLORS && Charts.NGM_COLORS.palette) || [
      '#3ecf8e', '#3b82f6', '#f59e0b', '#ef4444',
      '#8b5cf6', '#fb923c', '#22c55e', '#ec4899',
      '#14b8a6', '#6366f1', '#eab308', '#06b6d4'
    ];

    // ── Doughnut: Spend by Category ──
    var byCategory = data.by_category || [];
    if (byCategory.length > 0) {
      var catLabels = byCategory.map(function(c) { return c.category || c.name || 'Uncategorized'; });
      var catData   = byCategory.map(function(c) { return Number(c.amount || c.total || 0); });
      var catColors = byCategory.map(function(_, i) { return colors[i % colors.length]; });

      Charts.doughnutChart('chart-by-category', {
        labels: catLabels,
        data:   catData,
        colors: catColors
      });
    } else {
      showChartEmpty('chart-by-category', 'No category data');
    }

    // ── Horizontal Bar: Top Vendors ──
    var topVendors = data.top_vendors || [];
    if (topVendors.length > 0) {
      var vendorLabels = topVendors.map(function(v) { return v.vendor_name || v.vendor || v.name || 'Unknown'; });
      var vendorData   = topVendors.map(function(v) { return Number(v.amount || v.total || 0); });

      Charts.horizontalBar('chart-top-vendors', {
        labels: vendorLabels,
        datasets: [{
          label: 'Spend',
          data: vendorData,
          backgroundColor: colors[0],
          borderRadius: 4
        }]
      });
    } else {
      showChartEmpty('chart-top-vendors', 'No vendor data');
    }

    // ── Line: Monthly Spend ──
    var monthlySpend = data.monthly_spend || [];
    if (monthlySpend.length > 0) {
      var monthLabels = monthlySpend.map(function(m) { return m.month || m.label || ''; });
      var monthData   = monthlySpend.map(function(m) { return Number(m.amount || m.total || 0); });

      Charts.lineChart('chart-monthly-spend', {
        labels: monthLabels,
        datasets: [{
          label: 'Spend',
          data: monthData,
          borderColor: colors[0],
          backgroundColor: 'rgba(62, 207, 142, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      });
    } else {
      showChartEmpty('chart-monthly-spend', 'No monthly data');
    }
  }

  /**
   * Replace a chart canvas with an empty-state message when no data exists.
   */
  function showChartEmpty(canvasId, message) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var wrap = canvas.parentElement;
    if (!wrap) return;
    wrap.innerHTML = '<div class="pd-chart-empty">' + esc(message) + '</div>';
  }

  // ── Cost Projection Chart ──────────────────────────────────────────

  /**
   * Render the Budget vs Actual cumulative line chart from BVA data.
   * Shows budget ceiling, linear projection, and actual cumulative spend.
   */
  function renderCostProjectionChart(d) {
    var Charts = window.NGMCharts;
    if (!Charts) return;

    var C = Charts.NGM_COLORS || {};
    var cumActual = d.cumulative_actual || [];
    var projection = d.projection || [];

    if (cumActual.length === 0 && projection.length === 0) {
      showChartEmpty('chart-cost-projection', 'No budget data');
      return;
    }

    var cumLabels = cumActual.map(function(m) { return m.month; });
    var cumData = cumActual.map(function(m) { return m.cumulative; });
    var projData = projection.map(function(m) { return m.projected_cumulative; });
    var budgetLine = cumLabels.map(function() { return d.total_budget; });

    Charts.create('chart-cost-projection', {
      type: 'line',
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: 'Budget',
            data: budgetLine,
            borderColor: C.muted || '#6b7280',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Projection',
            data: projData,
            borderColor: C.info || '#3b82f6',
            borderDash: [4, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Actual',
            data: cumData,
            borderColor: C.primary || '#3ecf8e',
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: C.primary || '#3ecf8e',
            fill: {
              target: 'origin',
              above: 'rgba(62, 207, 142, 0.08)'
            }
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + fmtMoney(ctx.parsed.y); }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: C.grid || 'rgba(255,255,255,0.06)' },
            ticks: { callback: function(v) { return fmtMoney(v); } }
          },
          x: { grid: { display: false } }
        }
      }
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
        // Chart may not exist yet — ignore
      }
    });
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Load the dashboard for a given project.
   * Skips re-fetching if the same project is already loaded.
   *
   * @param {string|number} projectId
   */
  async function load(projectId) {
    if (!projectId) return;

    // Skip reload if same project already rendered
    if (_currentProjectId === projectId && _loaded) return;

    // Cancel any in-flight request
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    _currentProjectId = projectId;
    _loaded = false;

    var container = document.getElementById('dashboard-panel-content');
    if (!container) {
      console.warn('[ProjectDashboard] #dashboard-panel-content not found');
      return;
    }

    // Show skeleton immediately
    container.innerHTML = buildSkeletonHTML();

    try {
      // Fetch health and budget-vs-actual in parallel
      var pid = encodeURIComponent(projectId);
      var results = await Promise.all([
        window.NGM.api('/analytics/projects/' + pid + '/health', { signal: _abortController.signal }),
        window.NGM.api('/analytics/projects/' + pid + '/budget-vs-actual', { signal: _abortController.signal })
          .catch(function() { return null; })  // Non-critical — dashboard still works without it
      ]);

      var data = results[0];
      var bvaData = results[1];

      // API returned null/empty
      if (!data) {
        container.innerHTML = buildErrorHTML('The server returned no data.');
        return;
      }

      // Destroy previous chart instances before building new DOM
      destroyCharts();

      container.innerHTML = buildDashboardHTML(data);
      renderCharts(data);
      if (bvaData) renderCostProjectionChart(bvaData);

      // Load Expense Timeline chart (async, non-blocking)
      if (window.ProjectExpenseChart) {
        window.ProjectExpenseChart.load(pid);
      }

      _loaded = true;

    } catch (err) {
      if (err.name === 'AbortError') return; // Request was intentionally cancelled
      console.error('[ProjectDashboard] Failed to load:', err);
      container.innerHTML = buildErrorHTML(err.message || String(err));
    }
  }

  /**
   * Tear down the dashboard — destroy charts and reset state.
   * Call this when the user navigates away from the dashboard tab.
   */
  function unload() {
    destroyCharts();
    if (window.ProjectExpenseChart) window.ProjectExpenseChart.unload();
    _loaded = false;
    _currentProjectId = null;
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
  }

  /**
   * Force reload the current project dashboard.
   * Used by the retry button and can be called externally.
   */
  function reload() {
    var pid = _currentProjectId;
    _loaded = false; // force refetch
    if (pid) {
      load(pid);
    }
  }

  /**
   * Check whether the dashboard is currently loaded.
   * @returns {boolean}
   */
  function isLoaded() {
    return _loaded;
  }

  /**
   * Get the current project ID being displayed.
   * @returns {string|number|null}
   */
  function currentProject() {
    return _currentProjectId;
  }

  // ── Expose ─────────────────────────────────────────────────────────

  return {
    load:           load,
    unload:         unload,
    reload:         reload,
    isLoaded:       isLoaded,
    currentProject: currentProject
  };
})();
