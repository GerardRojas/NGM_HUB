/**
 * NGM HUB -- Project Scorecard Tab
 * Cross-project comparison table with health scores.
 *
 * Dependencies:
 *   - window.NGM.api(url, options)
 */
window.ProjectScorecard = (() => {
  'use strict';

  let _loaded = false;
  let _abortController = null;

  // ── Helpers ──────────────────────────────────────────────────────

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtCurrency(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  function fmtPct(n) {
    return Number(n || 0).toFixed(1) + '%';
  }

  function healthScoreColor(score) {
    if (score >= 7) return '#3ecf8e';
    if (score >= 5) return '#f59e0b';
    return '#ef4444';
  }

  function healthScoreLabel(score) {
    if (score >= 7) return 'Good';
    if (score >= 5) return 'Fair';
    return 'At Risk';
  }

  function budgetHealthColor(pct) {
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    return '#3ecf8e';
  }

  // ── Core ─────────────────────────────────────────────────────────

  async function load() {
    if (_loaded) return;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _loaded = false;

    const container = document.getElementById('scorecard-panel-content');
    if (!container) return;

    container.innerHTML = buildSkeleton();

    try {
      const data = await window.NGM.api('/analytics/project-scorecard', {
        signal: _abortController.signal
      });
      if (!data) {
        container.innerHTML = buildError('No data returned from server');
        return;
      }

      container.innerHTML = buildHTML(data);
      _loaded = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
      container.innerHTML = buildError(err.message);
    }
  }

  function unload() {
    _loaded = false;
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    var c = document.getElementById('scorecard-panel-content');
    if (c) c.innerHTML = '';
  }

  function reload() {
    _loaded = false;
    load();
  }

  // ── Build HTML ───────────────────────────────────────────────────

  function buildHTML(data) {
    var summary = data.summary || {};
    var projects = data.projects || [];

    // Sort by health_score ascending (worst first)
    projects.sort(function(a, b) {
      return (a.health_score || 0) - (b.health_score || 0);
    });

    var atRiskColor = (summary.projects_at_risk || 0) > 0 ? '#ef4444' : '#3ecf8e';

    var html = '';

    // Row 1: Summary KPIs
    html += '<div class="pd-kpi-row">';
    html += kpiCard('Total Projects', summary.total_projects || 0, '');
    html += kpiCard('Total Budget', fmtCurrency(summary.total_budget), '');
    html += kpiCard('Total Spent', fmtCurrency(summary.total_spent), '');
    html += kpiCard('At Risk', summary.projects_at_risk || 0, '', atRiskColor);
    html += '</div>';

    // Row 2: Scorecard table
    html += '<div class="sc-table-wrapper">';
    html += '<table class="sc-table">';
    html += '<thead><tr>';
    html += '<th>Project</th>';
    html += '<th>Status</th>';
    html += '<th>Budget</th>';
    html += '<th>Spent</th>';
    html += '<th>Budget Used</th>';
    html += '<th>Timeline</th>';
    html += '<th>Milestones</th>';
    html += '<th>Health Score</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    if (projects.length === 0) {
      html += '<tr><td colspan="8" style="text-align:center;color:#6b7280;padding:32px;">No projects found</td></tr>';
    } else {
      for (var i = 0; i < projects.length; i++) {
        html += buildRow(projects[i]);
      }
    }

    html += '</tbody></table></div>';

    return html;
  }

  function kpiCard(label, value, subtitle, color) {
    var style = color ? ' style="color:' + color + '"' : '';
    return '<div class="pd-kpi-card">'
      + '<div class="pd-kpi-label">' + esc(label) + '</div>'
      + '<div class="pd-kpi-value"' + style + '>' + esc(String(value)) + '</div>'
      + (subtitle ? '<div class="pd-kpi-sub">' + esc(subtitle) + '</div>' : '')
      + '</div>';
  }

  function buildRow(p) {
    var name = p.project_name || 'Unnamed';
    var status = p.status || 'Unknown';
    var budgetTotal = p.budget_total || 0;
    var spent = p.spent || 0;
    var spentPct = Math.min(Number(p.spent_pct || 0), 100);
    var timelinePct = Math.min(Number(p.timeline_pct || 0), 100);
    var milestonesOverdue = p.milestones_overdue || 0;
    var milestonesTotal = p.milestones_total || 0;
    var healthScore = Number(p.health_score || 0).toFixed(1);
    var scoreColor = healthScoreColor(p.health_score || 0);
    var scoreLabel = healthScoreLabel(p.health_score || 0);
    var budgetColor = budgetHealthColor(spentPct);

    var overdueBadgeClass = milestonesOverdue > 0
      ? 'sc-overdue-badge sc-overdue-badge--danger'
      : 'sc-overdue-badge sc-overdue-badge--ok';
    var overdueBadgeText = milestonesOverdue > 0 ? milestonesOverdue + ' overdue' : 'On track';

    var html = '<tr>';
    html += '<td class="sc-project-name">' + esc(name) + '</td>';
    html += '<td><span class="sc-status-badge">' + esc(status) + '</span></td>';
    html += '<td>' + fmtCurrency(budgetTotal) + '</td>';
    html += '<td>' + fmtCurrency(spent) + '</td>';

    // Budget used bar
    html += '<td>';
    html += '<div class="sc-mini-bar">';
    html += '<div class="sc-mini-fill" style="width:' + spentPct + '%;background:' + budgetColor + '"></div>';
    html += '</div>';
    html += '<span class="sc-pct">' + fmtPct(spentPct) + '</span>';
    html += '</td>';

    // Timeline bar
    html += '<td>';
    html += '<div class="sc-mini-bar">';
    html += '<div class="sc-mini-fill" style="width:' + timelinePct + '%;background:#6366f1"></div>';
    html += '</div>';
    html += '<span class="sc-pct">' + fmtPct(timelinePct) + '</span>';
    html += '</td>';

    // Milestones
    html += '<td>';
    html += '<span class="' + overdueBadgeClass + '">' + esc(overdueBadgeText) + '</span> ';
    html += milestonesOverdue + '/' + milestonesTotal;
    html += '</td>';

    // Health score
    html += '<td>';
    html += '<span class="sc-score" style="color:' + scoreColor + '">' + healthScore + '</span>';
    html += '<span class="sc-score-label">' + esc(scoreLabel) + '</span>';
    html += '</td>';

    html += '</tr>';
    return html;
  }

  // ── Skeleton ─────────────────────────────────────────────────────

  function buildSkeleton() {
    var html = '';

    // KPI skeleton
    html += '<div class="pd-kpi-row">';
    for (var k = 0; k < 4; k++) {
      html += '<div class="pd-kpi-card">'
        + '<div class="sc-shimmer" style="width:60px;height:12px;margin-bottom:8px"></div>'
        + '<div class="sc-shimmer" style="width:90px;height:22px"></div>'
        + '</div>';
    }
    html += '</div>';

    // Table skeleton
    html += '<div class="sc-table-wrapper"><table class="sc-table">';
    html += '<thead><tr>';
    html += '<th>Project</th><th>Status</th><th>Budget</th><th>Spent</th>';
    html += '<th>Budget Used</th><th>Timeline</th><th>Milestones</th><th>Health Score</th>';
    html += '</tr></thead><tbody>';
    for (var i = 0; i < 5; i++) {
      html += '<tr class="sc-skeleton-row">';
      for (var j = 0; j < 8; j++) {
        var w = [140, 70, 80, 80, 100, 100, 90, 60][j];
        html += '<td><div class="sc-shimmer" style="width:' + w + 'px"></div></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    return html;
  }

  // ── Error ────────────────────────────────────────────────────────

  function buildError(msg) {
    return '<div class="sc-error-card">'
      + '<p>Failed to load scorecard: ' + esc(msg) + '</p>'
      + '<button onclick="window.ProjectScorecard.reload()">Retry</button>'
      + '</div>';
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  window.addEventListener('beforeunload', unload);

  return { load: load, unload: unload, reload: reload };
})();
