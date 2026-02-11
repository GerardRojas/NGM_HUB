// arturito_analytics.js
// Command Analytics for Arturito Settings

(function() {
  'use strict';

  const API = window.API_BASE || (typeof API_BASE !== 'undefined' ? API_BASE : undefined);

  let currentStats = null;

  // ========================================
  // LOAD ANALYTICS DATA
  // ========================================

  async function loadAnalyticsStats(daysBack = 30) {
    try {
      const token = localStorage.getItem('ngmToken');
      if (!token) {
        console.error('[Analytics] No auth token found');
        return;
      }

      const response = await fetch(`${API}/arturito/failed-commands/stats?days_back=${daysBack}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      currentStats = await response.json();

      renderAllAnalytics();
      _updateHubCards();
    } catch (error) {
      console.error('[Analytics] Error loading stats:', error);
      showError('Failed to load analytics data. Check console for details.');
    }
  }

  // ========================================
  // RENDER FUNCTIONS
  // ========================================

  function renderAllAnalytics() {
    if (!currentStats) return;

    // Render stats cards
    document.getElementById('analyticsTotal').textContent = currentStats.total_failures || '0';
    document.getElementById('analyticsUnique').textContent = currentStats.unique_commands || '0';
    document.getElementById('analyticsGptRate').textContent = `${currentStats.gpt_attempt_rate || 0}%`;

    // Render charts
    renderTopPagesChart(currentStats.top_pages || []);
    renderTopErrorsChart(currentStats.top_errors || []);

    // Render failed commands table
    renderFailedCommandsTable(currentStats.most_common_commands || []);
  }

  function renderTopPagesChart(topPages) {
    const container = document.getElementById('topPagesChart');
    if (!container) return;

    container.innerHTML = '';

    if (!topPages || topPages.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; font-size: 13px; text-align: center; padding: 20px;">No data available</p>';
      return;
    }

    // Find max for scaling
    const maxCount = Math.max(...topPages.map(p => p.count));

    topPages.forEach(item => {
      const barElement = document.createElement('div');
      barElement.className = 'chart-bar';

      const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

      barElement.innerHTML = `
        <span class="chart-bar-label" title="${item.page}">${item.page}</span>
        <div class="chart-bar-fill" style="width: ${widthPercent}%; min-width: 40px;">
          <span class="chart-bar-value">${item.count}</span>
        </div>
      `;

      container.appendChild(barElement);
    });
  }

  function renderTopErrorsChart(topErrors) {
    const container = document.getElementById('topErrorsChart');
    if (!container) return;

    container.innerHTML = '';

    if (!topErrors || topErrors.length === 0) {
      container.innerHTML = '<p style="color: #6b7280; font-size: 13px; text-align: center; padding: 20px;">No data available</p>';
      return;
    }

    // Find max for scaling
    const maxCount = Math.max(...topErrors.map(e => e.count));

    // Error reason labels mapping
    const errorLabels = {
      'no_exact_match': 'No Exact Match',
      'gpt_failed': 'GPT Failed',
      'low_confidence': 'Low Confidence',
      'no_copilot_support': 'No Copilot Support',
      'unknown': 'Unknown'
    };

    topErrors.forEach(item => {
      const barElement = document.createElement('div');
      barElement.className = 'chart-bar';

      const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
      const label = errorLabels[item.error] || item.error;

      barElement.innerHTML = `
        <span class="chart-bar-label" title="${label}">${label}</span>
        <div class="chart-bar-fill" style="width: ${widthPercent}%; min-width: 40px; background: linear-gradient(90deg, #ef4444 0%, #b91c1c 100%);">
          <span class="chart-bar-value">${item.count}</span>
        </div>
      `;

      container.appendChild(barElement);
    });
  }

  function renderFailedCommandsTable(commands) {
    const tbody = document.getElementById('failedCommandsBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!commands || commands.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #6b7280; padding: 32px;">
            No failed commands found in the last 30 days
          </td>
        </tr>
      `;
      return;
    }

    commands.forEach(cmd => {
      const row = document.createElement('tr');

      // Truncate long commands
      const commandText = cmd.command.length > 60
        ? cmd.command.substring(0, 60) + '...'
        : cmd.command;

      row.innerHTML = `
        <td title="${escapeHtml(cmd.command)}">${escapeHtml(commandText)}</td>
        <td>${escapeHtml(cmd.page)}</td>
        <td><span style="background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${cmd.count}</span></td>
        <td>${formatTimeAgo(new Date())}</td>
      `;

      tbody.appendChild(row);
    });
  }

  // ========================================
  // HUB CARD UPDATE (called after stats load)
  // ========================================

  function _updateHubCards() {
    if (!currentStats) return;
    var gptEl = document.getElementById('hubArturitoGptRate');
    if (gptEl) {
      gptEl.textContent = (currentStats.gpt_attempt_rate || 0) + '%';
      gptEl.classList.remove('skeleton', 'skeleton-stat');
    }
    var failEl = document.getElementById('hubArturitoFailures');
    if (failEl) {
      failEl.textContent = currentStats.total_failures || '0';
      failEl.classList.remove('skeleton', 'skeleton-stat');
    }
  }

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function showError(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'error');
    } else {
      console.error('[Analytics]', message);
    }
  }

  // ========================================
  // EVENT LISTENERS
  // ========================================

  document.addEventListener('DOMContentLoaded', () => {
    // Refresh button (bind once, analytics loads lazily via loadIfNeeded)
    const btnRefresh = document.getElementById('btnRefreshAnalytics');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        btnRefresh.disabled = true;
        btnRefresh.textContent = 'Refreshing...';

        loadAnalyticsStats().finally(() => {
          btnRefresh.disabled = false;
          btnRefresh.textContent = 'Refresh Analytics';
        });
      });
    }
  });

  // Expose for Agent Hub integration
  window.arturityAnalytics = {
    reload: loadAnalyticsStats,
    getCurrentStats: () => currentStats,
    loadIfNeeded: () => {
      if (!currentStats) loadAnalyticsStats();
    }
  };

})();
