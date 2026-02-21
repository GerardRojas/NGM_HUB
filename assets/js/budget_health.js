// ============================================
// BUDGET HEALTH ANALYTICS — IIFE Module
// ============================================
// Exposes: window.BudgetHealth { load, unload, reload }
// Depends: window.NGM.api, window.NGMCharts (optional)

window.BudgetHealth = (() => {
  'use strict';

  let _loaded = false;
  let _abortController = null;
  let _currentProject = null;

  // ── Helpers ─────────────────────────────────

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fmtCurrency(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fmtPct(n) {
    return Number(n || 0).toFixed(1) + '%';
  }

  function healthColor(health) {
    if (health === 'critical') return '#ef4444';
    if (health === 'warning')  return '#f59e0b';
    return '#3ecf8e';
  }

  function healthLabel(health) {
    if (health === 'critical') return 'Over Budget';
    if (health === 'warning')  return 'At Risk';
    return 'Healthy';
  }

  // ── Public API ──────────────────────────────

  async function load(projectId) {
    if (_currentProject === projectId && _loaded) return;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _currentProject = projectId;
    _loaded = false;

    var container = document.getElementById('budgetHealthPanel');
    if (!container) return;

    container.innerHTML = buildSkeleton();

    try {
      var url = '/analytics/budget-health';
      var params = [];
      if (projectId) params.push('project_id=' + encodeURIComponent(projectId));
      if (params.length) url += '?' + params.join('&');

      var data = await window.NGM.api(url, { signal: _abortController.signal });
      if (!data) { container.innerHTML = buildError('No data returned'); return; }

      container.innerHTML = buildHTML(data);
      renderCharts(data);
      _loaded = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[BudgetHealth] Load error:', err);
      container.innerHTML = buildError(err.message || 'Failed to load budget health');
    }
  }

  function unload() {
    _loaded = false;
    _currentProject = null;
    if (_abortController) { _abortController.abort(); _abortController = null; }
    if (window.NGMCharts) {
      ['bh-account-chart'].forEach(function(id) { window.NGMCharts.destroy(id); });
    }
    var c = document.getElementById('budgetHealthPanel');
    if (c) c.innerHTML = '';
  }

  function reload() {
    _loaded = false;
    if (_currentProject !== undefined) load(_currentProject);
  }

  // ── Build HTML ──────────────────────────────

  function buildHTML(data) {
    var s = data.summary || {};
    var projects = data.projects || [];
    var byAccount = data.by_account || [];

    var html = '<div class="bh-panel">';

    // Row 1 — Summary KPI Cards (reuse pd-kpi-* classes from projects_dashboard)
    var variancePct = s.overall_variance_pct || 0;
    var varianceClass = variancePct >= 0 ? 'pd-kpi-value--neutral' : 'pd-kpi-value--danger';
    var overBudgetCount = s.projects_over_budget || 0;
    var overBudgetClass = overBudgetCount > 0 ? 'pd-kpi-value--danger' : 'pd-kpi-value--neutral';

    html += '<div class="pd-kpi-row">';
    html += buildKPICard('Total Budget',          fmtCurrency(s.total_budget),           'pd-kpi-value--neutral');
    html += buildKPICard('Total Spent',            fmtCurrency(s.total_spent),            'pd-kpi-value--neutral');
    html += buildKPICard('Variance',               fmtPct(variancePct),                   varianceClass);
    html += buildKPICard('Projects Over Budget',   String(overBudgetCount),               overBudgetClass);
    html += '</div>';

    // Row 2 — Project Health Cards Grid
    if (projects.length > 0) {
      html += '<div class="bh-section-title">Project Health</div>';
      html += '<div class="bh-projects-grid">';
      for (var i = 0; i < projects.length; i++) {
        html += buildProjectCard(projects[i]);
      }
      html += '</div>';
    }

    // Row 3 — Budget by Account chart
    if (byAccount.length > 0) {
      html += '<div class="bh-chart-section">';
      html += '  <div class="bh-chart-title">Budget vs Actual by Account</div>';
      html += '  <div class="bh-chart-wrap"><canvas id="bh-account-chart"></canvas></div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function buildKPICard(label, value, valueClass) {
    return '' +
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">' + esc(label) + '</span>' +
      '  <span class="pd-kpi-value ' + (valueClass || '') + '">' + esc(value) + '</span>' +
      '</div>';
  }

  function buildProjectCard(p) {
    var health = p.health || 'healthy';
    var spentPct = Math.min(Number(p.spent_pct || 0), 100);
    var color = healthColor(health);
    var label = healthLabel(health);

    return '' +
      '<div class="bh-project-card">' +
      '  <div class="bh-project-header">' +
      '    <span class="bh-project-name">' + esc(p.project_name) + '</span>' +
      '    <span class="bh-health-badge bh-health--' + esc(health) + '">' + esc(label) + '</span>' +
      '  </div>' +
      '  <div class="bh-budget-bar">' +
      '    <div class="bh-budget-fill" style="width:' + spentPct + '%; background:' + color + '"></div>' +
      '  </div>' +
      '  <div class="bh-budget-details">' +
      '    <span>Budget: ' + fmtCurrency(p.budget_total) + '</span>' +
      '    <span>Spent: ' + fmtCurrency(p.actual_spent) + ' (' + fmtPct(p.spent_pct) + ')</span>' +
      '  </div>' +
      '  <div class="bh-burn-rate">' +
      '    Burn rate: ' + fmtCurrency(p.burn_rate_monthly) + '/mo' +
      '  </div>' +
      '</div>';
  }

  // ── Build Skeleton ──────────────────────────

  function buildSkeleton() {
    var html = '<div class="bh-panel">';

    // Skeleton KPI row
    html += '<div class="bh-skeleton-row">';
    for (var k = 0; k < 4; k++) {
      html += '<div class="bh-skeleton-card">' +
        '<div class="bh-skeleton-line bh-skeleton-line--short"></div>' +
        '<div class="bh-skeleton-line bh-skeleton-line--tall"></div>' +
        '</div>';
    }
    html += '</div>';

    // Skeleton project grid
    html += '<div class="bh-skeleton-grid">';
    for (var j = 0; j < 3; j++) {
      html += '<div class="bh-skeleton-card">' +
        '<div class="bh-skeleton-line bh-skeleton-line--med"></div>' +
        '<div class="bh-skeleton-line bh-skeleton-line--bar"></div>' +
        '<div class="bh-skeleton-line bh-skeleton-line--short"></div>' +
        '</div>';
    }
    html += '</div>';

    // Skeleton chart
    html += '<div class="bh-skeleton-chart">' +
      '<div class="bh-skeleton-line bh-skeleton-line--med"></div>' +
      '</div>';

    html += '</div>';
    return html;
  }

  // ── Build Error ─────────────────────────────

  function buildError(msg) {
    return '' +
      '<div class="bh-error">' +
      '  <div class="bh-error-msg">Budget health unavailable: ' + esc(msg) + '</div>' +
      '  <button type="button" class="bh-retry-btn" onclick="window.BudgetHealth.reload()">Retry</button>' +
      '</div>';
  }

  // ── Render Charts ───────────────────────────

  function renderCharts(data) {
    var byAccount = data.by_account || [];
    if (!byAccount.length) return;
    if (!window.NGMCharts) { console.warn('[BudgetHealth] NGMCharts not available, skipping chart'); return; }

    var labels = [];
    var budgeted = [];
    var actual = [];

    for (var i = 0; i < byAccount.length; i++) {
      labels.push(byAccount[i].account_name || 'Unknown');
      budgeted.push(byAccount[i].budgeted || 0);
      actual.push(byAccount[i].actual || 0);
    }

    window.NGMCharts.horizontalBar('bh-account-chart', {
      labels: labels,
      datasets: [
        { label: 'Budgeted', data: budgeted, color: '#3b82f6', barThickness: 14 },
        { label: 'Actual',   data: actual,   color: '#3ecf8e', barThickness: 14 }
      ]
    });
  }

  // ── Cleanup ─────────────────────────────────
  window.addEventListener('beforeunload', unload);

  return { load: load, unload: unload, reload: reload };
})();
