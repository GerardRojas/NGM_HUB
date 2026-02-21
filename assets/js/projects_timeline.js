/**
 * NGM HUB — Project Timeline Summary Tab
 * Lightweight summary view showing phase progress, milestones,
 * and a link to the full Timeline Manager.
 *
 * Dependencies:
 *   - window.NGM.api(url, options)
 *
 * Container: #timeline-panel-content
 * CSS prefix: pt- (project timeline)
 */
window.ProjectTimeline = (() => {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let _loaded = false;
  let _abortController = null;
  let _currentProject = null;

  var GENERAL_CHART_ID = 'chart-general-timeline';

  // ── Helpers ────────────────────────────────────────────────────────

  const MONTH_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  /**
   * Format an ISO date string "2025-01-15" → "Jan 15".
   * Returns empty string for falsy / invalid input.
   */
  function fmtDate(d) {
    if (!d) return '';
    var parts = String(d).split('-');
    if (parts.length < 3) return String(d);
    var m = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (isNaN(m) || isNaN(day)) return String(d);
    return (MONTH_SHORT[m - 1] || '') + ' ' + day;
  }

  /**
   * Format an ISO date string "2025-01-15" → "Jan 15, 2025".
   * Returns empty string for falsy / invalid input.
   */
  function fmtDateFull(d) {
    if (!d) return '';
    var parts = String(d).split('-');
    if (parts.length < 3) return String(d);
    var yr = parts[0];
    var m = parseInt(parts[1], 10);
    var day = parseInt(parts[2], 10);
    if (isNaN(m) || isNaN(day)) return String(d);
    return (MONTH_SHORT[m - 1] || '') + ' ' + day + ', ' + yr;
  }

  /** Escape HTML to prevent XSS. */
  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  /** Clamp a number between min and max. */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /** Format monetary amounts for display. */
  function fmtMoney(n) {
    if (n == null || isNaN(n)) return '$0';
    n = Number(n);
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
    return '$' + n.toFixed(0);
  }

  /** Format a month key "2025-03" as "Mar 25". */
  function formatMonthLabel(key) {
    var p = key.split('-');
    var mi = parseInt(p[1], 10) - 1;
    return (MONTH_SHORT[mi] || '') + ' ' + p[0].substring(2);
  }

  /** Return the human-readable label for a status key. */
  function statusLabel(status) {
    var map = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      delayed: 'Delayed',
      overdue: 'Overdue'
    };
    return map[status] || String(status || 'unknown');
  }

  /** Return an HTML badge for a given status string. */
  function statusBadge(status) {
    var s = String(status || 'pending').toLowerCase().replace(/\s+/g, '_');
    return '<span class="pt-status pt-status--' + esc(s) + '">' + esc(statusLabel(s)) + '</span>';
  }

  // ── SVG Icons ──────────────────────────────────────────────────────

  var ICONS = {
    phases: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
    milestone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    openManager: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    error: '<svg class="pt-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
  };

  // ── Build HTML ─────────────────────────────────────────────────────

  function buildHTML(data) {
    var totalPhases     = Number(data.total_phases || 0);
    var completedPhases = Number(data.completed_phases || 0);
    var overallPct      = Number(data.overall_progress_pct || 0);
    var totalMilestones = Number(data.total_milestones || 0);
    var completedMile   = Number(data.completed_milestones || 0);
    var overdueMile     = Number(data.overdue_milestones || 0);

    var phases    = data.phases || [];
    var upcoming  = data.upcoming_milestones || [];

    var html = '<div class="pd-grid">';

    // ── KPI Row (reuse pd-kpi-row / pd-kpi-card classes) ──
    html += '<div class="pd-kpi-row">';

    // Card 1: Phases
    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Phases</span>' +
      '  <span class="pd-kpi-value pd-kpi-value--neutral">' + completedPhases + '/' + totalPhases + '</span>' +
      '  <span class="pd-kpi-sub">completed</span>' +
      '</div>';

    // Card 2: Overall Progress
    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Progress</span>' +
      '  <span class="pd-kpi-value">' + esc(overallPct.toFixed(1) + '%') + '</span>' +
      '  <div class="pd-kpi-progress">' +
      '    <div class="pd-kpi-progress-fill" style="width:' + clamp(overallPct, 0, 100) + '%"></div>' +
      '  </div>' +
      '</div>';

    // Card 3: Milestones
    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Milestones</span>' +
      '  <span class="pd-kpi-value pd-kpi-value--neutral">' + completedMile + '/' + totalMilestones + '</span>' +
      '  <span class="pd-kpi-sub">completed</span>' +
      '</div>';

    // Card 4: Overdue
    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Overdue</span>' +
      '  <span class="pd-kpi-value' + (overdueMile > 0 ? ' pd-kpi-value--danger' : ' pd-kpi-value--neutral') + '">' + overdueMile + '</span>' +
      '  <span class="pd-kpi-sub">milestones</span>' +
      '</div>';

    html += '</div>'; // end pd-kpi-row

    // ── Phases Grid ──
    if (phases.length > 0) {
      html += '<div class="pt-phases-grid">';
      for (var i = 0; i < phases.length; i++) {
        var p = phases[i];
        var pStatus = String(p.status || 'pending').toLowerCase().replace(/\s+/g, '_');
        var pPct = clamp(Number(p.progress_pct || 0), 0, 100);
        var dateRange = '';
        if (p.start_date || p.end_date) {
          dateRange = fmtDate(p.start_date) + ' \u2013 ' + fmtDate(p.end_date);
        }

        html +=
          '<div class="pt-phase-card">' +
          '  <div class="pt-phase-header">' +
          '    <span class="pt-phase-name">' + esc(p.phase_name || 'Phase ' + (i + 1)) + '</span>' +
               statusBadge(pStatus) +
          '  </div>' +
          '  <div class="pt-progress-bar">' +
          '    <div class="pt-progress-fill pt-progress-fill--' + esc(pStatus) + '" style="width:' + pPct + '%"></div>' +
          '  </div>' +
          '  <div style="display:flex;align-items:center;justify-content:space-between">' +
          '    <span style="color:rgba(255,255,255,0.5);font-size:12px;font-variant-numeric:tabular-nums">' + pPct.toFixed(0) + '%</span>' +
          (dateRange
            ? '    <span class="pt-phase-dates">' + ICONS.calendar + ' ' + esc(dateRange) + '</span>'
            : '') +
          '  </div>' +
          '</div>';
      }
      html += '</div>';
    } else {
      html += '<div class="pt-phases-empty">No phases defined for this project yet.</div>';
    }

    // ── Section Divider ──
    html += '<div class="pt-section-divider"></div>';

    // ── Upcoming Milestones ──
    html += '<div class="pt-milestones-section">';
    html += '<h3 class="pt-milestones-title">' + ICONS.milestone + ' Upcoming Milestones</h3>';

    if (upcoming.length > 0) {
      var max = Math.min(upcoming.length, 5);
      for (var j = 0; j < max; j++) {
        var m = upcoming[j];
        html +=
          '<div class="pt-milestone-row">' +
          '  <span class="pt-milestone-name">' + esc(m.milestone_name || 'Milestone') + '</span>' +
          '  <div class="pt-milestone-meta">' +
          (m.phase_name
            ? '    <span class="pt-milestone-phase-tag">' + esc(m.phase_name) + '</span>'
            : '') +
               statusBadge(m.status) +
          '    <span class="pt-milestone-date">' + esc(fmtDateFull(m.due_date)) + '</span>' +
          '  </div>' +
          '</div>';
      }
    } else {
      html += '<div class="pt-phases-empty">No upcoming milestones.</div>';
    }

    html += '</div>'; // end pt-milestones-section

    // ── Footer: Open Timeline Manager ──
    html +=
      '<div class="pt-footer">' +
      '  <a class="pt-open-manager-btn" href="timeline-manager.html?project=' + encodeURIComponent(data.project_id || _currentProject || '') + '">' +
           ICONS.openManager +
      '    Open Timeline Manager' +
      '  </a>' +
      '</div>';

    html += '</div>'; // end pd-grid

    return html;
  }

  // ── General Timeline (expense-based fallback) ─────────────────────

  /**
   * Load and render a general timeline based on expense data.
   * Called when the project has no formal phases or milestones.
   */
  async function loadGeneralTimeline(container, projectId) {
    var data = await window.NGM.api(
      '/analytics/projects/' + encodeURIComponent(projectId) + '/expense-timeline',
      { signal: _abortController.signal }
    );

    var expenses = (data && data.expenses) || [];
    if (expenses.length === 0) {
      container.innerHTML = buildEmptyTimeline(projectId);
      _loaded = true;
      return;
    }

    // Sort dates and find range
    var dates = [];
    var totalSpent = 0;
    expenses.forEach(function(e) {
      if (e.date) dates.push(e.date);
      totalSpent += Number(e.amount || 0);
    });
    dates.sort();
    var firstDate = dates[0];
    var lastDate = dates[dates.length - 1];

    // Duration in months
    var fp = firstDate.split('-');
    var lp = lastDate.split('-');
    var durationMonths = (parseInt(lp[0], 10) - parseInt(fp[0], 10)) * 12 +
                         (parseInt(lp[1], 10) - parseInt(fp[1], 10)) + 1;

    // Aggregate by month
    var monthMap = {};
    expenses.forEach(function(e) {
      if (!e.date) return;
      var key = e.date.substring(0, 7);
      monthMap[key] = (monthMap[key] || 0) + Number(e.amount || 0);
    });

    // Fill all months in range (including gaps)
    var allMonths = [];
    var y = parseInt(fp[0], 10);
    var m = parseInt(fp[1], 10);
    var ey = parseInt(lp[0], 10);
    var em = parseInt(lp[1], 10);
    while (y < ey || (y === ey && m <= em)) {
      allMonths.push(y + '-' + String(m).padStart(2, '0'));
      m++;
      if (m > 12) { m = 1; y++; }
    }

    var totalBudget = Number((data && data.total_budget) || 0);

    container.innerHTML = buildGeneralHTML({
      firstDate: firstDate,
      lastDate: lastDate,
      totalSpent: totalSpent,
      totalBudget: totalBudget,
      expenseCount: expenses.length,
      durationMonths: durationMonths,
      activeMonths: Object.keys(monthMap).length,
      allMonths: allMonths,
      projectId: projectId
    });

    renderGeneralChart(allMonths, monthMap, totalBudget);
    _loaded = true;
  }

  function buildGeneralHTML(info) {
    var html = '<div class="pd-grid">';

    // Header
    html +=
      '<div class="pt-general-header">' +
      '  <div class="pt-general-title-row">' +
      '    <h3 class="pt-milestones-title" style="margin:0">' + ICONS.progress + ' Project Activity Timeline</h3>' +
      '    <span class="pt-general-badge">Auto-generated</span>' +
      '  </div>' +
      '  <p class="pt-general-subtitle">Based on recorded expenses. No formal timeline has been defined for this project.</p>' +
      '</div>';

    // KPI Row
    html += '<div class="pd-kpi-row">';

    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">First Expense</span>' +
      '  <span class="pd-kpi-value pd-kpi-value--neutral" style="font-size:18px">' + esc(fmtDateFull(info.firstDate)) + '</span>' +
      '  <span class="pd-kpi-sub">project start</span>' +
      '</div>';

    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Last Expense</span>' +
      '  <span class="pd-kpi-value pd-kpi-value--neutral" style="font-size:18px">' + esc(fmtDateFull(info.lastDate)) + '</span>' +
      '  <span class="pd-kpi-sub">latest activity</span>' +
      '</div>';

    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Duration</span>' +
      '  <span class="pd-kpi-value">' + info.durationMonths + '<span style="font-size:14px;opacity:0.6;margin-left:4px">months</span></span>' +
      '  <span class="pd-kpi-sub">' + info.activeMonths + ' with activity</span>' +
      '</div>';

    html +=
      '<div class="pd-kpi-card">' +
      '  <span class="pd-kpi-label">Total Spent</span>' +
      '  <span class="pd-kpi-value">' + esc(fmtMoney(info.totalSpent)) + '</span>' +
      '  <span class="pd-kpi-sub">' + info.expenseCount + ' transactions</span>' +
      '</div>';

    html += '</div>'; // end KPI row

    // Timeline Bar
    html += buildTimelineBar(info);

    // Monthly Activity Chart
    html +=
      '<div class="pt-general-chart-card">' +
      '  <h3 class="pd-chart-title">Monthly Activity</h3>' +
      '  <div class="pd-chart-wrap pd-chart-wrap--tall">' +
      '    <canvas id="' + GENERAL_CHART_ID + '"></canvas>' +
      '  </div>' +
      '</div>';

    // Footer: Open Timeline Manager
    html +=
      '<div class="pt-footer">' +
      '  <a class="pt-open-manager-btn" href="timeline-manager.html?project=' + encodeURIComponent(info.projectId || _currentProject || '') + '">' +
           ICONS.openManager + ' Open Timeline Manager' +
      '  </a>' +
      '</div>';

    html += '</div>';
    return html;
  }

  function buildTimelineBar(info) {
    var firstDate = info.firstDate;
    var lastDate = info.lastDate;
    var allMonths = info.allMonths;

    var startTs = new Date(firstDate + 'T00:00:00').getTime();
    var endTs = new Date(lastDate + 'T00:00:00').getTime();
    var range = endTs - startTs;

    // Today marker position
    var now = new Date();
    var todayTs = now.getTime();
    var todayPct = -1;
    if (range > 0 && todayTs >= startTs && todayTs <= endTs) {
      todayPct = ((todayTs - startTs) / range) * 100;
    }

    // Month tick marks (show up to 36 months)
    var ticksHtml = '';
    if (allMonths.length <= 36 && range > 0) {
      allMonths.forEach(function(key, i) {
        var ts = new Date(key + '-01T00:00:00').getTime();
        var pct = ((ts - startTs) / range) * 100;
        if (pct >= 0 && pct <= 100) {
          // Show label for every nth month based on count
          var showLabel = allMonths.length <= 12 || (i % Math.ceil(allMonths.length / 12) === 0);
          ticksHtml +=
            '<div class="pt-bar-tick" style="left:' + pct.toFixed(1) + '%">' +
            '  <span class="pt-bar-tick-line"></span>' +
            (showLabel ? '<span class="pt-bar-tick-label">' + esc(formatMonthLabel(key)) + '</span>' : '') +
            '</div>';
        }
      });
    }

    // Today indicator
    var todayHtml = '';
    if (todayPct >= 0 && todayPct <= 100) {
      todayHtml =
        '<div class="pt-bar-today" style="left:' + todayPct.toFixed(1) + '%">' +
        '  <span class="pt-bar-today-line"></span>' +
        '  <span class="pt-bar-today-label">Today</span>' +
        '</div>';
    }

    // Fill up to today or full bar
    var fillPct = todayPct >= 0 ? Math.min(todayPct, 100) : 100;

    return '' +
      '<div class="pt-timeline-bar">' +
      '  <div class="pt-bar-labels">' +
      '    <span class="pt-bar-label-start">' + esc(fmtDateFull(firstDate)) + '</span>' +
      '    <span class="pt-bar-label-end">' + esc(fmtDateFull(lastDate)) + '</span>' +
      '  </div>' +
      '  <div class="pt-bar-track">' +
      '    <div class="pt-bar-fill" style="width:' + fillPct.toFixed(1) + '%"></div>' +
           ticksHtml +
           todayHtml +
      '  </div>' +
      '</div>';
  }

  function renderGeneralChart(allMonths, monthMap, totalBudget) {
    var Charts = window.NGMCharts;
    if (!Charts) return;

    var C = Charts.NGM_COLORS;
    var labels = allMonths.map(function(key) { return formatMonthLabel(key); });
    var amounts = allMonths.map(function(key) { return Math.round((monthMap[key] || 0) * 100) / 100; });

    // Cumulative line
    var cum = 0;
    var cumulative = amounts.map(function(a) { cum += a; return Math.round(cum * 100) / 100; });

    var datasets = [
      {
        label: 'Monthly Spend',
        data: amounts,
        backgroundColor: 'rgba(62, 207, 142, 0.5)',
        borderRadius: 4,
        order: 2,
        yAxisID: 'y'
      },
      {
        label: 'Cumulative',
        type: 'line',
        data: cumulative,
        borderColor: C.info,
        borderWidth: 2,
        pointRadius: labels.length > 24 ? 0 : 3,
        pointBackgroundColor: C.info,
        fill: false,
        tension: 0,
        order: 1,
        yAxisID: 'y1'
      }
    ];

    // Budget pace line
    if (totalBudget > 0) {
      var perMonth = totalBudget / allMonths.length;
      var cumBudget = 0;
      var budgetPace = allMonths.map(function() {
        cumBudget += perMonth;
        return Math.round(cumBudget * 100) / 100;
      });

      datasets.push({
        label: 'Budget Pace',
        type: 'line',
        data: budgetPace,
        borderColor: C.muted,
        borderDash: [6, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0,
        order: 0,
        yAxisID: 'y1'
      });
    }

    Charts.create(GENERAL_CHART_ID, {
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
            position: 'left',
            grid: { color: C.grid },
            ticks: { callback: function(v) { return fmtMoney(v); } },
            title: { display: true, text: 'Monthly', color: 'rgba(255,255,255,0.4)', font: { size: 11 } }
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { callback: function(v) { return fmtMoney(v); } },
            title: { display: true, text: 'Cumulative', color: 'rgba(255,255,255,0.4)', font: { size: 11 } }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function buildEmptyTimeline(projectId) {
    return '' +
      '<div class="pd-grid">' +
      '  <div class="pt-general-header">' +
      '    <h3 class="pt-milestones-title" style="margin:0">' + ICONS.progress + ' Timeline</h3>' +
      '  </div>' +
      '  <div class="pt-phases-empty">No timeline or expense data available for this project.</div>' +
      '  <div class="pt-footer">' +
      '    <a class="pt-open-manager-btn" href="timeline-manager.html?project=' + encodeURIComponent(projectId || _currentProject || '') + '">' +
              ICONS.openManager + ' Create Timeline in Manager' +
      '    </a>' +
      '  </div>' +
      '</div>';
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

    function skeletonPhase() {
      return '' +
        '<div class="pd-skeleton--card">' +
        '  <div class="pd-skeleton-line" style="width:60%;margin-bottom:10px"></div>' +
        '  <div class="pd-skeleton-line" style="height:6px;margin-bottom:8px"></div>' +
        '  <div class="pd-skeleton-line pd-skeleton-line--sm" style="width:35%"></div>' +
        '</div>';
    }

    function skeletonRow() {
      return '' +
        '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:12px 14px;margin-bottom:6px">' +
        '  <div class="pd-skeleton-line" style="width:45%"></div>' +
        '</div>';
    }

    return '' +
      '<div class="pd-grid">' +
      '  <div class="pd-kpi-row">' +
           skeletonCard() + skeletonCard() + skeletonCard() + skeletonCard() +
      '  </div>' +
      '  <div class="pt-phases-grid">' +
           skeletonPhase() + skeletonPhase() + skeletonPhase() +
      '  </div>' +
      '  <div class="pt-section-divider"></div>' +
      '  <div style="margin-top:12px">' +
      '    <div class="pd-skeleton-line" style="width:30%;margin-bottom:14px"></div>' +
           skeletonRow() + skeletonRow() + skeletonRow() +
      '  </div>' +
      '</div>';
  }

  // ── Error HTML ─────────────────────────────────────────────────────

  function buildError(message) {
    return '' +
      '<div class="pd-error">' +
        ICONS.error +
      '  <h4 class="pd-error-title">Failed to load timeline</h4>' +
      '  <p class="pd-error-msg">' + esc(message || 'Unknown error') + '</p>' +
      '  <button class="pd-error-retry" onclick="window.ProjectTimeline.reload()">Retry</button>' +
      '</div>';
  }

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Load the timeline summary for a given project.
   * Skips re-fetching if the same project is already loaded.
   *
   * @param {string|number} projectId
   */
  async function load(projectId) {
    if (!projectId) return;

    // Skip reload if same project already rendered
    if (_currentProject === projectId && _loaded) return;

    // Cancel any in-flight request
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    _currentProject = projectId;
    _loaded = false;

    var container = document.getElementById('timeline-panel-content');
    if (!container) {
      console.warn('[ProjectTimeline] #timeline-panel-content not found');
      return;
    }

    // Show skeleton immediately
    container.innerHTML = buildSkeleton();

    try {
      // Try loading formal timeline first
      var payload = null;
      try {
        var data = await window.NGM.api(
          '/timeline/projects/' + encodeURIComponent(projectId) + '/summary',
          { signal: _abortController.signal }
        );
        if (data) {
          payload = data.data ? data.data : data;
        }
      } catch (timelineErr) {
        if (timelineErr.name === 'AbortError') throw timelineErr;
        // Timeline endpoint may not exist or return error — fall through to general
        console.warn('[ProjectTimeline] Timeline summary unavailable:', timelineErr.message);
      }

      // Check if formal timeline has real content
      var hasTimeline = payload &&
        ((payload.phases && payload.phases.length > 0) ||
         (Number(payload.total_milestones || 0) > 0));

      if (hasTimeline) {
        container.innerHTML = buildHTML(payload);
        _loaded = true;
      } else {
        // No formal timeline — show general timeline from expenses
        await loadGeneralTimeline(container, projectId);
      }

    } catch (err) {
      if (err.name === 'AbortError') return; // Intentionally cancelled
      console.error('[ProjectTimeline] Failed to load:', err);
      container.innerHTML = buildError(err.message || String(err));
    }
  }

  /**
   * Tear down the timeline — reset state and cancel pending requests.
   * Call this when the user navigates away from the timeline tab.
   */
  function unload() {
    _loaded = false;
    _currentProject = null;
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    // Destroy general timeline chart if present
    if (window.NGMCharts) {
      try { window.NGMCharts.destroy(GENERAL_CHART_ID); } catch (e) { /* noop */ }
    }
    var container = document.getElementById('timeline-panel-content');
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Force reload the current project timeline.
   * Used by the retry button and can be called externally.
   */
  function reload() {
    var pid = _currentProject;
    _loaded = false; // force refetch
    if (pid) {
      load(pid);
    }
  }

  // ── Cleanup on page unload ─────────────────────────────────────────
  window.addEventListener('beforeunload', unload);

  // ── Expose ─────────────────────────────────────────────────────────
  return { load: load, unload: unload, reload: reload };
})();
