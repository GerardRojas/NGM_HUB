// ============================================
// PROJECTS — Cost vs Projection Tab
// ============================================
// Contrasts budget projection (linear) against actual cumulative spend.
// Relies on: window.NGM.api, window.NGMCharts

window.ProjectCost = (() => {
  'use strict';

  let _loaded = false;
  let _currentProjectId = null;
  let _abortController = null;

  // ---- Helpers ----

  function fmtMoney(n) {
    if (n == null) return '—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return sign + '$' + (abs / 1_000).toFixed(1) + 'K';
    return sign + '$' + abs.toFixed(0);
  }

  function pct(n) {
    if (n == null) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  }

  // ---- Public API ----

  async function load(projectId) {
    if (!projectId) return;
    if (_currentProjectId === projectId && _loaded) return;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    _currentProjectId = projectId;

    const container = document.getElementById('cost-panel-content');
    if (!container) return;

    container.innerHTML = buildSkeleton();

    try {
      const data = await window.NGM.api(
        `/analytics/projects/${projectId}/budget-vs-actual`,
        { signal: _abortController.signal }
      );
      container.innerHTML = buildHTML(data);
      renderCharts(data);
      _loaded = true;
    } catch (err) {
      if (err.name === 'AbortError') return;
      container.innerHTML = `
        <div class="pd-empty-state">
          <span class="pd-empty-icon">⚠️</span>
          <span class="pd-empty-text">Error loading cost data: ${err.message}</span>
        </div>`;
    }
  }

  function unload() {
    ['chart-cost-projection', 'chart-variance-bar'].forEach(id => {
      window.NGMCharts?.destroy(id);
    });
    _loaded = false;
    _currentProjectId = null;
    if (_abortController) { _abortController.abort(); _abortController = null; }
  }

  // ---- Build HTML ----

  function buildHTML(d) {
    const statusLabel = {
      on_track: 'On Track',
      at_risk: 'At Risk',
      over_budget: 'Over Budget'
    };

    // BVA table rows
    const bvaRows = (d.by_account || []).map(a => {
      const vClass = a.variance > 0 ? 'pc-variance-positive' : 'pc-variance-negative';
      return `
        <tr>
          <td>${a.account_name}</td>
          <td>${fmtMoney(a.budget)}</td>
          <td>${fmtMoney(a.actual)}</td>
          <td class="${vClass}">${fmtMoney(a.variance)} (${pct(a.variance_pct)})</td>
        </tr>`;
    }).join('');

    const totalVClass = d.total_variance > 0 ? 'pc-variance-positive' : 'pc-variance-negative';

    return `
      <div class="pc-grid">

        <!-- Main projection chart -->
        <div class="pc-main-chart">
          <div class="pc-chart-title">Budget vs Actual — Cumulative</div>
          <canvas id="chart-cost-projection"></canvas>
        </div>

        <!-- Split: variance bar + EAC card -->
        <div class="pc-split-row">
          <div class="pc-variance-card">
            <div class="pc-chart-title">Variance by Account</div>
            <canvas id="chart-variance-bar"></canvas>
          </div>

          <div class="pc-eac-card">
            <div class="pc-chart-title">Projection Summary</div>

            <div class="pc-eac-row">
              <span class="pc-eac-label">Total Budget</span>
              <span class="pc-eac-value">${fmtMoney(d.total_budget)}</span>
            </div>
            <div class="pc-eac-divider"></div>

            <div class="pc-eac-row">
              <span class="pc-eac-label">Spent to Date</span>
              <span class="pc-eac-value">${fmtMoney(d.total_actual)}</span>
            </div>
            <div class="pc-eac-divider"></div>

            <div class="pc-eac-row">
              <span class="pc-eac-label">Estimated at Completion</span>
              <span class="pc-eac-value">${fmtMoney(d.estimated_at_completion)}</span>
            </div>
            <div class="pc-eac-divider"></div>

            <div class="pc-eac-row">
              <span class="pc-eac-label">Variance</span>
              <span class="pc-eac-value ${totalVClass}">${fmtMoney(d.estimated_variance)}</span>
            </div>
            <div class="pc-eac-divider"></div>

            <div style="text-align:center; padding-top: 4px;">
              <span class="pc-status-badge pc-status-badge--${d.status || 'on_track'}">
                ${statusLabel[d.status] || d.status || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        <!-- BVA Table -->
        <div class="pc-bva-table-wrap">
          <table class="pc-bva-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Budget</th>
                <th>Actual</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              ${bvaRows}
            </tbody>
            <tfoot>
              <tr class="pc-bva-footer">
                <td>Total</td>
                <td>${fmtMoney(d.total_budget)}</td>
                <td>${fmtMoney(d.total_actual)}</td>
                <td class="${totalVClass}">${fmtMoney(d.total_variance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>`;
  }

  // ---- Render Charts ----

  function renderCharts(d) {
    if (!window.NGMCharts) return;
    const C = window.NGMCharts.NGM_COLORS;

    // 1) Projection line chart — 3 datasets
    const cumLabels = (d.cumulative_actual || []).map(m => m.month);
    const cumData = (d.cumulative_actual || []).map(m => m.cumulative);
    const projData = (d.projection || []).map(m => m.projected_cumulative);

    // Budget ceiling (horizontal line at total_budget)
    const budgetLine = cumLabels.map(() => d.total_budget);

    window.NGMCharts.create('chart-cost-projection', {
      type: 'line',
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: 'Budget',
            data: budgetLine,
            borderColor: C.muted,
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Projection (linear)',
            data: projData,
            borderColor: C.info,
            borderDash: [4, 3],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Actual (cumulative)',
            data: cumData,
            borderColor: C.primary,
            borderWidth: 2.5,
            pointRadius: 3,
            pointBackgroundColor: C.primary,
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
              label: ctx => `${ctx.dataset.label}: ${fmtMoney(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: C.grid },
            ticks: { callback: v => fmtMoney(v) }
          },
          x: { grid: { display: false } }
        }
      }
    });

    // 2) Variance horizontal bar
    const accounts = (d.by_account || []).filter(a => a.variance !== 0);
    const varLabels = accounts.map(a => a.account_name);
    const varData = accounts.map(a => a.variance);
    const varColors = accounts.map(a => a.variance > 0 ? C.danger : C.primary);

    window.NGMCharts.create('chart-variance-bar', {
      type: 'bar',
      data: {
        labels: varLabels,
        datasets: [{
          label: 'Variance',
          data: varData,
          backgroundColor: varColors,
          borderRadius: 4,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => fmtMoney(ctx.parsed.x)
            }
          }
        },
        scales: {
          x: {
            grid: { color: C.grid },
            ticks: { callback: v => fmtMoney(v) }
          },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // ---- Skeleton ----

  function buildSkeleton() {
    return `
      <div class="pc-grid">
        <div class="pc-skeleton pc-skeleton-chart"></div>
        <div class="pc-split-row">
          <div class="pc-skeleton pc-skeleton-card"></div>
          <div class="pc-skeleton pc-skeleton-card"></div>
        </div>
      </div>`;
  }

  // ---- Cleanup ----
  window.addEventListener('beforeunload', unload);

  return { load, unload };
})();
