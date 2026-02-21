// ============================================
// VENDOR INTELLIGENCE — Scorecard & Analytics
// ============================================
// Provides: window.VendorIntelligence
// Dependencies:
//   - window.NGM.api(url, options)
//   - window.NGMCharts.lineChart / .doughnutChart / .destroy
//   - window.NGMCharts.NGM_COLORS

window.VendorIntelligence = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let _currentVendorId = null;
  let _abortController = null;

  // Chart canvas IDs managed by this module
  const CHART_IDS = [
    'chart-vendor-monthly',
    'chart-vendor-projects',
    'chart-vendor-categories'
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

  /**
   * Format a date string (YYYY-MM-DD) to a short human-readable format.
   * "2024-01-15" -> "Jan '24"
   */
  function fmtDateShort(dateStr) {
    if (!dateStr) return '--';
    try {
      var parts = dateStr.split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2] || '1', 10));
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return months[d.getMonth()] + " '" + String(d.getFullYear()).slice(-2);
    } catch (_) {
      return dateStr;
    }
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

  /** Escape HTML to prevent XSS. */
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  // ── Summary (enriched vendor table) ────────────────────────────────

  /**
   * Called by vendors.js when the enriched vendor table needs to load.
   * Fetches /analytics/vendors/summary and returns the vendor list + total.
   * @returns {Promise<{vendors: Array, total_spend_all_vendors: number}|null>}
   */
  async function loadSummary() {
    try {
      var data = await window.NGM.api('/analytics/vendors/summary');
      return data;
    } catch (err) {
      console.error('[VendorIntelligence] Error loading summary:', err);
      if (window.Toast) {
        window.Toast.error('Vendor Summary', 'Failed to load vendor analytics.');
      }
      return null;
    }
  }

  // ── Scorecard (detail panel) ───────────────────────────────────────

  /**
   * Called when a vendor row is clicked. Opens the scorecard panel
   * with skeleton loading, fetches data, and renders the full scorecard.
   * @param {string} vendorId - UUID of the vendor
   */
  async function loadScorecard(vendorId) {
    if (!vendorId) return;

    // Cancel any in-flight request
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _currentVendorId = vendorId;

    var panel = document.getElementById('vendor-scorecard-panel');
    if (!panel) return;

    // Show panel with skeleton
    panel.hidden = false;
    panel.innerHTML = buildSkeleton();

    try {
      var data = await window.NGM.api(
        '/analytics/vendors/' + vendorId + '/scorecard',
        { signal: _abortController.signal }
      );
      panel.innerHTML = buildScorecardHTML(data);
      renderCharts(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[VendorIntelligence] Scorecard error:', err);
      panel.innerHTML = '<div class="vi-error">' +
        '<div class="vi-error-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="32" height="32">' +
            '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' +
          '</svg>' +
        '</div>' +
        '<p class="vi-error-title">Failed to load scorecard</p>' +
        '<p class="vi-error-msg">' + esc(err.message) + '</p>' +
        '<button class="vi-error-retry" onclick="VendorIntelligence.loadScorecard(\'' + esc(vendorId) + '\')">Retry</button>' +
      '</div>';
    }
  }

  /**
   * Close the scorecard panel and destroy associated charts.
   */
  function closeScorecard() {
    CHART_IDS.forEach(function (id) {
      if (window.NGMCharts) window.NGMCharts.destroy(id);
    });
    var panel = document.getElementById('vendor-scorecard-panel');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
    _currentVendorId = null;
  }

  /**
   * Full cleanup for page navigation / beforeunload.
   */
  function unload() {
    closeScorecard();
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
  }

  // ── Build Skeleton ─────────────────────────────────────────────────

  function buildSkeleton() {
    return '' +
      '<div class="vi-scorecard">' +
        '<div class="vi-header">' +
          '<div class="vi-skeleton vi-skeleton-line" style="width:180px;height:24px;"></div>' +
          '<div class="vi-skeleton" style="width:32px;height:32px;border-radius:6px;"></div>' +
        '</div>' +
        '<div class="vi-kpi-row">' +
          '<div class="vi-kpi-card"><div class="vi-skeleton vi-skeleton-line" style="width:50%;height:12px;"></div><div class="vi-skeleton vi-skeleton-line--lg" style="width:70%;margin-top:8px;"></div></div>' +
          '<div class="vi-kpi-card"><div class="vi-skeleton vi-skeleton-line" style="width:50%;height:12px;"></div><div class="vi-skeleton vi-skeleton-line--lg" style="width:70%;margin-top:8px;"></div></div>' +
          '<div class="vi-kpi-card"><div class="vi-skeleton vi-skeleton-line" style="width:50%;height:12px;"></div><div class="vi-skeleton vi-skeleton-line--lg" style="width:70%;margin-top:8px;"></div></div>' +
          '<div class="vi-kpi-card"><div class="vi-skeleton vi-skeleton-line" style="width:50%;height:12px;"></div><div class="vi-skeleton vi-skeleton-line--lg" style="width:70%;margin-top:8px;"></div></div>' +
        '</div>' +
        '<div class="vi-charts-row">' +
          '<div class="vi-chart-card"><div class="vi-skeleton vi-skeleton-chart"></div></div>' +
          '<div class="vi-chart-card"><div class="vi-skeleton vi-skeleton-chart"></div></div>' +
        '</div>' +
        '<div class="vi-skeleton" style="height:200px;border-radius:8px;margin-bottom:16px;"></div>' +
        '<div class="vi-skeleton" style="height:80px;border-radius:8px;"></div>' +
      '</div>';
  }

  // ── Build Scorecard HTML ───────────────────────────────────────────

  function buildScorecardHTML(data) {
    var vendorName   = esc(data.vendor_name || 'Unknown Vendor');
    var totalAmount  = Number(data.total_amount || 0);
    var avgTxn       = Number(data.avg_txn_amount || 0);
    var activeProj   = Number(data.active_projects || 0);
    var firstTxn     = data.first_txn || '';
    var concentration = data.concentration || {};
    var concPct      = Number(concentration.pct_of_total_spend || 0);
    var riskLevel    = concentration.risk_level || 'low';
    var byCategory   = data.by_category || [];

    // Header
    var html = '<div class="vi-scorecard">';
    html += '<div class="vi-header">';
    html +=   '<h3 class="vi-vendor-name">' + vendorName + '</h3>';
    html +=   '<button class="vi-close-btn" onclick="VendorIntelligence.closeScorecard()" title="Close scorecard">&times;</button>';
    html += '</div>';

    // KPI Row
    html += '<div class="vi-kpi-row">';
    html += buildKpiCard('Total Spend', fmtMoney(totalAmount), fmtCurrency(totalAmount));
    html += buildKpiCard('Avg Transaction', fmtMoney(avgTxn), fmtCurrency(avgTxn));
    html += buildKpiCard('Active Projects', String(activeProj), null);
    html += buildKpiCard('Since', fmtDateShort(firstTxn), firstTxn || null);
    html += '</div>';

    // Charts Row
    html += '<div class="vi-charts-row">';

    // Monthly Spend line chart
    html += '<div class="vi-chart-card">';
    html +=   '<div class="vi-chart-title">Monthly Spend</div>';
    html +=   '<div class="vi-chart-wrap"><canvas id="chart-vendor-monthly"></canvas></div>';
    html += '</div>';

    // By Project doughnut
    html += '<div class="vi-chart-card">';
    html +=   '<div class="vi-chart-title">By Project</div>';
    html +=   '<div class="vi-chart-wrap"><canvas id="chart-vendor-projects"></canvas></div>';
    html += '</div>';

    html += '</div>'; // close vi-charts-row

    // Price Trends Table
    if (byCategory.length > 0) {
      html += '<div class="vi-section-title">Price Trends by Category</div>';
      html += '<div class="vi-price-table-wrap">';
      html += '<table class="vi-price-table">';
      html += '<thead><tr>';
      html += '<th>Category</th>';
      html += '<th>Total</th>';
      html += '<th>Avg 3mo ago</th>';
      html += '<th>Avg Current</th>';
      html += '<th>Change</th>';
      html += '</tr></thead>';
      html += '<tbody>';

      for (var i = 0; i < byCategory.length; i++) {
        var cat = byCategory[i];
        var changePct = Number(cat.price_change_pct || 0);
        var trendClass = changePct > 0 ? 'vi-trend-up' : (changePct < 0 ? 'vi-trend-down' : '');
        var arrow = changePct > 0 ? '&#9650; ' : (changePct < 0 ? '&#9660; ' : '');
        var changeDisplay = changePct === 0 ? '--' : arrow + Math.abs(changePct).toFixed(1) + '%';

        html += '<tr>';
        html += '<td>' + esc(cat.txn_type || 'Other') + '</td>';
        html += '<td>' + fmtCurrency(cat.total) + '</td>';
        html += '<td>' + fmtCurrency(cat.avg_unit_price_3mo_ago) + '</td>';
        html += '<td>' + fmtCurrency(cat.avg_unit_price_current) + '</td>';
        html += '<td class="' + trendClass + '">' + changeDisplay + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table></div>';
    }

    // Concentration Risk Card
    html += buildConcentrationCard(concPct, riskLevel);

    html += '</div>'; // close vi-scorecard

    return html;
  }

  /**
   * Build a single KPI card HTML.
   */
  function buildKpiCard(label, value, subtitle) {
    var html = '<div class="vi-kpi-card">';
    html += '<span class="vi-kpi-label">' + esc(label) + '</span>';
    html += '<span class="vi-kpi-value">' + value + '</span>';
    if (subtitle) {
      html += '<span class="vi-kpi-sub">' + esc(subtitle) + '</span>';
    }
    html += '</div>';
    return html;
  }

  /**
   * Build the concentration risk card.
   */
  function buildConcentrationCard(pct, riskLevel) {
    var riskConfig = {
      low:    { label: 'Low Risk',    colorClass: 'vi-risk-low' },
      medium: { label: 'Medium Risk', colorClass: 'vi-risk-medium' },
      high:   { label: 'High Risk',   colorClass: 'vi-risk-high' }
    };

    var config = riskConfig[riskLevel] || riskConfig.low;

    var html = '<div class="vi-risk-card ' + config.colorClass + '">';
    html += '<div class="vi-risk-header">';
    html +=   '<span class="vi-risk-title">Concentration Risk</span>';
    html +=   '<span class="vi-risk-badge ' + config.colorClass + '">' + config.label + '</span>';
    html += '</div>';
    html += '<div class="vi-risk-body">';
    html +=   '<span class="vi-risk-pct">' + pct.toFixed(1) + '%</span>';
    html +=   '<span class="vi-risk-desc">This vendor represents ' + pct.toFixed(1) + '% of total spend</span>';
    html += '</div>';
    // Visual progress bar for concentration
    html += '<div class="vi-risk-bar">';
    html +=   '<div class="vi-risk-bar-fill ' + config.colorClass + '" style="width:' + Math.min(pct, 100) + '%"></div>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  // ── Render Charts ──────────────────────────────────────────────────

  function renderCharts(data) {
    if (!window.NGMCharts) return;
    var C = window.NGMCharts.NGM_COLORS;

    // 1) Monthly Spend — Line chart
    var monthly = data.monthly_spend || [];
    var monthLabels = monthly.map(function (m) { return fmtMonth(m.month); });
    var monthData = monthly.map(function (m) { return m.amount; });

    if (monthly.length > 0) {
      window.NGMCharts.lineChart('chart-vendor-monthly', {
        labels: monthLabels,
        datasets: [{
          label: 'Spend',
          data: monthData,
          color: C.primary,
          fill: {
            target: 'origin',
            above: 'rgba(62, 207, 142, 0.08)'
          }
        }]
      });
    } else {
      renderChartEmpty('chart-vendor-monthly', 'No monthly data available');
    }

    // 2) By Project — Doughnut chart
    var byProject = data.by_project || [];
    var projLabels = byProject.map(function (p) { return p.project_name; });
    var projData = byProject.map(function (p) { return p.amount; });

    if (byProject.length > 0) {
      window.NGMCharts.doughnutChart('chart-vendor-projects', {
        labels: projLabels,
        data: projData,
        colors: C.palette.slice(0, projData.length)
      });
    } else {
      renderChartEmpty('chart-vendor-projects', 'No project data available');
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
    emptyDiv.className = 'vi-chart-empty';
    emptyDiv.textContent = message;
    canvas.parentElement.appendChild(emptyDiv);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  // Global cleanup on page unload
  window.addEventListener('beforeunload', unload);

  // Also register with PageLifecycle if available
  if (window.PageLifecycle) {
    window.PageLifecycle.register('VendorIntelligence', unload);
  }

  // ── Public API ─────────────────────────────────────────────────────

  return {
    loadSummary: loadSummary,
    loadScorecard: loadScorecard,
    closeScorecard: closeScorecard,
    unload: unload
  };
})();
