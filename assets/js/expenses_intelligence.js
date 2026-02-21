// ============================================
// EXPENSE INTELLIGENCE — Analytics Panel
// ============================================
// Provides: window.ExpenseIntelligence
// Dependencies:
//   - window.NGM.api(url, options)
//   - window.NGMCharts.lineChart / .doughnutChart / .horizontalBar / .destroy
//   - window.NGMCharts.NGM_COLORS
//   - Chart.js v4 loaded via CDN

window.ExpenseIntelligence = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let _loaded = false;
  let _abortController = null;
  let _currentProject = null;

  // Chart canvas IDs managed by this module
  const CHART_IDS = [
    'ei-monthly-chart',
    'ei-category-chart',
    'ei-vendor-chart',
    'ei-payment-chart'
  ];

  // ── Helpers ────────────────────────────────────────────────────────

  /** Escape HTML to prevent XSS. */
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  /** Format number with commas. */
  function fmtNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US');
  }

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
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }

  /**
   * Format a full monetary amount with commas and 2 decimal places.
   */
  function fmtCurrency(n) {
    if (n == null || isNaN(n)) return '$0.00';
    return '$' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /** Format percentage. */
  function fmtPct(n) {
    if (n == null || isNaN(n)) return '0%';
    return Number(n).toFixed(1) + '%';
  }

  /**
   * Format a month label from "2025-01" to "Jan '25".
   */
  function fmtMonth(m) {
    if (!m) return '';
    var parts = m.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var monthIdx = parseInt(parts[1], 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return m;
    return months[monthIdx] + " '" + parts[0].slice(-2);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  /**
   * Load analytics data for a given project (or all projects if null).
   * Renders skeleton, fetches API, builds HTML and charts.
   */
  async function load(projectId) {
    // Skip reload if same project already rendered
    if (_currentProject === projectId && _loaded) return;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _currentProject = projectId;
    _loaded = false;

    var container = document.getElementById('expenseIntelligencePanel');
    if (!container) return;

    container.innerHTML = buildSkeleton();

    try {
      var url = '/analytics/expense-intelligence';
      if (projectId) url += '?project_id=' + encodeURIComponent(projectId);

      var data = await window.NGM.api(url, { signal: _abortController.signal });
      if (!data) {
        container.innerHTML = buildError('No data returned from the server.');
        return;
      }

      container.innerHTML = buildHTML(data);
      renderCharts(data);
      _loaded = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[ExpenseIntelligence] Error loading analytics:', err);
      container.innerHTML = buildError(err.message);
    }
  }

  /**
   * Unload the panel: destroy charts, clear HTML, reset state.
   */
  function unload() {
    _loaded = false;
    _currentProject = null;

    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }

    // Destroy charts
    if (window.NGMCharts) {
      CHART_IDS.forEach(function (id) {
        window.NGMCharts.destroy(id);
      });
    }

    var container = document.getElementById('expenseIntelligencePanel');
    if (container) container.innerHTML = '';
  }

  /**
   * Force reload with the current project.
   */
  function reload() {
    _loaded = false;
    if (_currentProject !== undefined) load(_currentProject);
  }

  // ── Build Skeleton HTML ────────────────────────────────────────────

  function buildSkeleton() {
    function skeletonCard() {
      return '' +
        '<div class="ei-skeleton--card">' +
        '  <div class="ei-skeleton-line ei-skeleton-line--sm" style="width:50%"></div>' +
        '  <div class="ei-skeleton-line ei-skeleton-line--lg" style="margin-top:12px"></div>' +
        '  <div class="ei-skeleton-line ei-skeleton-line--sm" style="margin-top:8px;width:60%"></div>' +
        '</div>';
    }

    function skeletonChart() {
      return '' +
        '<div class="ei-chart-card">' +
        '  <div class="ei-skeleton-line" style="width:40%;margin-bottom:4px"></div>' +
        '  <div class="ei-skeleton-chart"></div>' +
        '</div>';
    }

    return '' +
      '<div class="ei-panel">' +
      '  <div class="ei-kpi-row">' +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
           skeletonCard() +
      '  </div>' +
      '  <div class="ei-charts-grid">' +
           skeletonChart() +
           skeletonChart() +
           skeletonChart() +
           skeletonChart() +
      '  </div>' +
      '</div>';
  }

  // ── Build Error HTML ───────────────────────────────────────────────

  function buildError(message) {
    return '' +
      '<div class="ei-error">' +
        '<div class="ei-error-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="12" y1="8" x2="12" y2="12"/>' +
            '<line x1="12" y1="16" x2="12.01" y2="16"/>' +
          '</svg>' +
        '</div>' +
        '<p class="ei-error-title">Failed to load analytics</p>' +
        '<p class="ei-error-msg">' + esc(message) + '</p>' +
        '<button class="ei-error-retry" onclick="window.ExpenseIntelligence.reload()">Retry</button>' +
      '</div>';
  }

  // ── Build Main HTML ────────────────────────────────────────────────

  function buildHTML(data) {
    var totals = data.totals || {};
    var totalAmount = Number(totals.total_amount || 0);
    var totalCount = Number(totals.total_count || 0);
    var avgPerExpense = Number(totals.avg_per_expense || 0);
    var anomalyCount = (data.top_anomalies || []).length;

    var html = '<div class="ei-panel">';

    // ── Row 1: KPI Cards ──
    html += '<div class="ei-kpi-row">';

    // Total Spend
    html += '<div class="ei-kpi-card">';
    html +=   '<span class="ei-kpi-label">Total Spend</span>';
    html +=   '<span class="ei-kpi-value">' + fmtMoney(totalAmount) + '</span>';
    html +=   '<span class="ei-kpi-sub">' + fmtCurrency(totalAmount) + '</span>';
    html += '</div>';

    // Expenses Count
    html += '<div class="ei-kpi-card">';
    html +=   '<span class="ei-kpi-label">Expenses Count</span>';
    html +=   '<span class="ei-kpi-value ei-kpi-value--neutral">' + fmtNumber(totalCount) + '</span>';
    html +=   '<span class="ei-kpi-sub">total entries</span>';
    html += '</div>';

    // Avg per Expense
    html += '<div class="ei-kpi-card">';
    html +=   '<span class="ei-kpi-label">Avg per Expense</span>';
    html +=   '<span class="ei-kpi-value">' + fmtMoney(avgPerExpense) + '</span>';
    html +=   '<span class="ei-kpi-sub">' + fmtCurrency(avgPerExpense) + '</span>';
    html += '</div>';

    // Anomalies Detected
    html += '<div class="ei-kpi-card">';
    html +=   '<span class="ei-kpi-label">Anomalies</span>';
    html +=   '<span class="ei-kpi-value ei-kpi-value' + (anomalyCount > 0 ? '--warning' : '') + '">' + anomalyCount + '</span>';
    html +=   '<span class="ei-kpi-sub">outlier expenses</span>';
    html += '</div>';

    html += '</div>'; // close kpi-row

    // ── Row 2: Charts Grid (2x2) ──
    html += '<div class="ei-charts-grid">';

    // Monthly Spend Trend
    html += '<div class="ei-chart-card">';
    html +=   '<div class="ei-chart-title">Monthly Spend Trend</div>';
    html +=   '<div class="ei-chart-wrap"><canvas id="ei-monthly-chart"></canvas></div>';
    html += '</div>';

    // By Category
    html += '<div class="ei-chart-card">';
    html +=   '<div class="ei-chart-title">By Category</div>';
    html +=   '<div class="ei-chart-wrap"><canvas id="ei-category-chart"></canvas></div>';
    html += '</div>';

    // Top Vendors
    html += '<div class="ei-chart-card">';
    html +=   '<div class="ei-chart-title">Top Vendors</div>';
    html +=   '<div class="ei-chart-wrap"><canvas id="ei-vendor-chart"></canvas></div>';
    html += '</div>';

    // By Payment Method
    html += '<div class="ei-chart-card">';
    html +=   '<div class="ei-chart-title">By Payment Method</div>';
    html +=   '<div class="ei-chart-wrap"><canvas id="ei-payment-chart"></canvas></div>';
    html += '</div>';

    html += '</div>'; // close charts-grid

    // ── Row 3: Anomalies Table ──
    var anomalies = data.top_anomalies || [];
    if (anomalies.length > 0) {
      html += '<div class="ei-anomalies">';
      html += '<div class="ei-anomalies-header">';
      html +=   '<div class="ei-anomalies-title">';
      html +=     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">';
      html +=       '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>';
      html +=       '<line x1="12" y1="9" x2="12" y2="13"/>';
      html +=       '<line x1="12" y1="17" x2="12.01" y2="17"/>';
      html +=     '</svg>';
      html +=     'Anomaly Detection';
      html +=   '</div>';
      html +=   '<div class="ei-anomalies-subtitle">Expenses significantly above average</div>';
      html += '</div>';

      html += '<div class="ei-anomaly-table-wrap">';
      html += '<table class="ei-anomaly-table">';
      html += '<thead><tr>';
      html += '<th>Date</th>';
      html += '<th>Vendor</th>';
      html += '<th>Amount</th>';
      html += '<th>Description</th>';
      html += '<th>Z-Score</th>';
      html += '</tr></thead>';
      html += '<tbody>';

      var maxRows = Math.min(anomalies.length, 10);
      for (var i = 0; i < maxRows; i++) {
        var a = anomalies[i];
        html += '<tr class="ei-anomaly-row">';
        html += '<td>' + esc(a.date || '') + '</td>';
        html += '<td>' + esc(a.vendor || '--') + '</td>';
        html += '<td class="ei-anomaly-amount">' + fmtCurrency(a.amount) + '</td>';
        html += '<td>' + esc(a.description || '') + '</td>';
        html += '<td class="ei-anomaly-zscore">' + Number(a.z_score || 0).toFixed(2) + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table>';
      html += '</div>'; // close table-wrap
      html += '</div>'; // close anomalies
    }

    html += '</div>'; // close ei-panel
    return html;
  }

  // ── Render Charts ──────────────────────────────────────────────────

  function renderCharts(data) {
    if (!window.NGMCharts) return;

    // 1) Monthly Spend Trend — line chart
    var monthly = data.monthly_spend || [];
    if (monthly.length > 0) {
      window.NGMCharts.lineChart('ei-monthly-chart', {
        labels: monthly.map(function (m) { return fmtMonth(m.month); }),
        datasets: [{
          label: 'Monthly Spend',
          data: monthly.map(function (m) { return m.amount; }),
          color: '#3ecf8e',
          fill: {
            target: 'origin',
            above: 'rgba(62, 207, 142, 0.08)'
          }
        }]
      });
    } else {
      renderChartEmpty('ei-monthly-chart', 'No monthly data available');
    }

    // 2) By Category — doughnut
    var byCategory = data.by_category || [];
    if (byCategory.length > 0) {
      var top8 = byCategory.slice(0, 8);
      window.NGMCharts.doughnutChart('ei-category-chart', {
        labels: top8.map(function (c) { return c.category; }),
        data: top8.map(function (c) { return c.amount; })
      });
    } else {
      renderChartEmpty('ei-category-chart', 'No category data available');
    }

    // 3) Top Vendors — horizontal bar
    var byVendor = data.by_vendor || [];
    if (byVendor.length > 0) {
      var top10 = byVendor.slice(0, 10);
      window.NGMCharts.horizontalBar('ei-vendor-chart', {
        labels: top10.map(function (v) { return v.vendor; }),
        datasets: [{
          label: 'Amount',
          data: top10.map(function (v) { return v.amount; }),
          color: '#6366f1'
        }]
      });
    } else {
      renderChartEmpty('ei-vendor-chart', 'No vendor data available');
    }

    // 4) Payment Methods — doughnut
    var byPayment = data.by_payment_method || [];
    if (byPayment.length > 0) {
      window.NGMCharts.doughnutChart('ei-payment-chart', {
        labels: byPayment.map(function (p) { return p.method; }),
        data: byPayment.map(function (p) { return p.amount; })
      });
    } else {
      renderChartEmpty('ei-payment-chart', 'No payment method data available');
    }
  }

  /**
   * Render an empty state message where a chart would go.
   */
  function renderChartEmpty(canvasId, message) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.parentElement) return;
    canvas.style.display = 'none';
    var emptyDiv = document.createElement('div');
    emptyDiv.className = 'ei-chart-empty';
    emptyDiv.textContent = message;
    canvas.parentElement.appendChild(emptyDiv);
  }

  // ── Global cleanup ─────────────────────────────────────────────────

  window.addEventListener('beforeunload', unload);

  // ── Public API ─────────────────────────────────────────────────────

  return {
    load: load,
    unload: unload,
    reload: reload
  };
})();
