// assets/js/budget_monitor.js
(function () {
  'use strict';

  console.log('[BUDGET_MONITOR] ========================================');
  console.log('[BUDGET_MONITOR] budget_monitor.js loaded');
  console.log('[BUDGET_MONITOR] ========================================');

  // ================================
  // STATE
  // ================================
  let currentUser = null;
  let selectedProjectId = null;
  let allAlerts = [];
  let currentAuthAlert = null; // Alert being authorized
  let currentAckAlert = null; // Alert being acknowledged
  let pendingAlerts = [];
  let alertHistory = [];
  let budgetData = [];
  let currentTab = 'overview';

  // ================================
  // DOM ELEMENTS
  // ================================
  const els = {};

  function cacheElements() {
    // Toolbar
    els.projectFilter = document.getElementById('projectFilter');
    els.btnRefreshData = document.getElementById('btnRefreshData');
    els.pendingAlertsBadge = document.getElementById('pendingAlertsBadge');
    els.pendingAlertsCount = document.getElementById('pendingAlertsCount');

    // Summary stats
    els.totalAlerts = document.getElementById('totalAlerts');
    els.pendingAlerts = document.getElementById('pendingAlerts');
    els.authorizedAlerts = document.getElementById('authorizedAlerts');

    // Budget overview (may not exist in simpler layouts)
    els.totalBudget = document.getElementById('totalBudget');
    els.totalActuals = document.getElementById('totalActuals');
    els.totalRemaining = document.getElementById('totalRemaining');
    els.totalPercentage = document.getElementById('totalPercentage');
    els.overviewEmptyState = document.getElementById('overviewEmptyState');
    els.budgetOverviewTable = document.getElementById('budgetOverviewTable');
    els.budgetOverviewBody = document.getElementById('budgetOverviewBody');

    // Tabs (may not exist in simpler layouts)
    els.tabOverview = document.getElementById('tabOverview');
    els.tabAlerts = document.getElementById('tabAlerts');
    els.tabHistory = document.getElementById('tabHistory');
    els.tabAlertsBadge = document.getElementById('tabAlertsBadge');

    // Alerts log table
    els.alertsEmptyState = document.getElementById('alertsEmptyState');
    els.alertsLogTable = document.getElementById('alertsLogTable');
    els.alertsLogBody = document.getElementById('alertsLogBody');
    els.alertsList = document.getElementById('alertsList');

    // History table
    els.historyEmptyState = document.getElementById('historyEmptyState');
    els.historyTable = document.getElementById('historyTable');
    els.historyTableBody = document.getElementById('historyTableBody');

    // Authorize Modal (auth prefix in HTML)
    els.authorizeModal = document.getElementById('authorizeModal');
    els.acknowledgeModal = document.getElementById('authorizeModal'); // alias
    els.btnCloseAuthModal = document.getElementById('btnCloseAuthModal');
    els.btnCloseAckModal = document.getElementById('btnCloseAuthModal'); // alias
    els.btnCancelAuth = document.getElementById('btnCancelAuth');
    els.btnCancelAck = document.getElementById('btnCancelAuth'); // alias
    els.btnConfirmAuth = document.getElementById('btnConfirmAuth');
    els.btnConfirmAck = document.getElementById('btnConfirmAuth'); // alias
    els.authAlertType = document.getElementById('authAlertType');
    els.ackAlertType = document.getElementById('authAlertType'); // alias
    els.authAlertAccount = document.getElementById('authAlertAccount');
    els.ackAlertAccount = document.getElementById('authAlertAccount'); // alias
    els.authAlertDate = document.getElementById('authAlertDate');
    els.authBudgetAmount = document.getElementById('authBudgetAmount');
    els.ackBudgetAmount = document.getElementById('authBudgetAmount'); // alias
    els.authActualAmount = document.getElementById('authActualAmount');
    els.ackActualAmount = document.getElementById('authActualAmount'); // alias
    els.authVarianceAmount = document.getElementById('authVarianceAmount');
    els.ackOverAmount = document.getElementById('authVarianceAmount'); // alias
    els.authAlertNote = document.getElementById('authAlertNote');
    els.ackAlertNote = document.getElementById('authAlertNote'); // alias
    els.ackAlertMessage = document.getElementById('authAlertMessage'); // may not exist

    // View Note Modal
    els.viewNoteModal = document.getElementById('viewNoteModal');
    els.btnCloseViewNote = document.getElementById('btnCloseViewNote');
    els.btnCloseViewNoteFooter = document.getElementById('btnCloseViewNoteFooter');
    els.viewNoteAccount = document.getElementById('viewNoteAccount');
    els.viewNoteType = document.getElementById('viewNoteType');
    els.viewNoteAckBy = document.getElementById('viewNoteAckBy');
    els.viewNoteAckAt = document.getElementById('viewNoteAckAt');
    els.viewNoteText = document.getElementById('viewNoteText');
  }

  // ================================
  // AUTH
  // ================================
  function initAuth() {
    const userRaw = localStorage.getItem('ngmUser');
    if (!userRaw) {
      window.location.href = 'login.html';
      return false;
    }

    try {
      currentUser = JSON.parse(userRaw);
      console.log('[BUDGET_MONITOR] User:', currentUser.user_name);
      return true;
    } catch (err) {
      console.error('[BUDGET_MONITOR] Invalid ngmUser', err);
      localStorage.removeItem('ngmUser');
      window.location.href = 'login.html';
      return false;
    }
  }

  // ================================
  // API HELPERS
  // ================================
  function getAuthHeaders() {
    const token = localStorage.getItem('ngmToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async function apiGet(endpoint) {
    const API_BASE = window.API_BASE || 'http://localhost:8000';
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  }

  async function apiPut(endpoint, data) {
    const API_BASE = window.API_BASE || 'http://localhost:8000';
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || `API error: ${response.status}`);
    }
    return response.json();
  }

  // ================================
  // DATA LOADING
  // ================================
  async function loadProjects() {
    try {
      // Use the same metadata endpoint as expenses module
      const data = await apiGet('/expenses/meta');
      const projects = data.projects || [];

      els.projectFilter.innerHTML = '<option value="">Select project...</option>';

      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.project_id || p.id;
        opt.textContent = p.project_name || p.name || 'Unnamed Project';
        els.projectFilter.appendChild(opt);
      });

      console.log('[BUDGET_MONITOR] Loaded', projects.length, 'projects');
    } catch (err) {
      console.error('[BUDGET_MONITOR] Error loading projects:', err);
      if (window.Toast) {
        Toast.error('Error', 'Failed to load projects');
      }
    }
  }

  async function loadBudgetOverview(projectId) {
    if (!projectId) {
      budgetData = [];
      renderBudgetOverview();
      updateSummaryCards();
      return;
    }

    try {
      // Load budgets for project
      const budgetsRes = await apiGet(`/budgets?project=${projectId}`);
      const budgets = budgetsRes.data || [];

      // Check if project has no budget loaded
      if (budgets.length === 0) {
        console.log('[BUDGET_MONITOR] Project has no budget loaded yet');
        budgetData = [];
        renderBudgetOverview();
        updateSummaryCards();

        // Show informational alert (not an error)
        if (window.Toast) {
          Toast.info('No Budget', 'This project does not have a budget loaded yet. Please upload a budget to start monitoring.');
        }
        return;
      }

      // Load expenses (actuals) for project - authorized only, exclude soft-deleted
      const expensesRes = await apiGet(`/expenses/?project=${projectId}`);
      const expenses = (expensesRes.data || []).filter(e => e.auth_status === true && e.status !== 'review');

      // Group budgets by account
      const budgetByAccount = {};
      budgets.forEach(b => {
        const account = b.account_name || 'Unknown';
        budgetByAccount[account] = (budgetByAccount[account] || 0) + (parseFloat(b.amount_sum) || 0);
      });

      // Group actuals by account
      const actualsByAccount = {};
      expenses.forEach(e => {
        const account = e.account_name || 'Unknown';
        const amount = parseFloat(e.Amount || e.amount) || 0;
        actualsByAccount[account] = (actualsByAccount[account] || 0) + amount;
      });

      // Build combined data
      const allAccounts = new Set([...Object.keys(budgetByAccount), ...Object.keys(actualsByAccount)]);
      budgetData = [];

      allAccounts.forEach(account => {
        const budget = budgetByAccount[account] || 0;
        const actual = actualsByAccount[account] || 0;
        const remaining = budget - actual;
        const percentage = budget > 0 ? (actual / budget * 100) : (actual > 0 ? 100 : 0);

        let status = 'on_track';
        if (budget === 0 && actual > 0) {
          status = 'no_budget';
        } else if (percentage >= 100) {
          status = 'overspend';
        } else if (percentage >= 95) {
          status = 'critical';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        budgetData.push({
          account,
          budget,
          actual,
          remaining,
          percentage,
          status
        });
      });

      // Sort by percentage desc (worst first)
      budgetData.sort((a, b) => b.percentage - a.percentage);

      renderBudgetOverview();
      updateSummaryCards();
      console.log('[BUDGET_MONITOR] Loaded budget overview for', projectId);

    } catch (err) {
      console.error('[BUDGET_MONITOR] Error loading budget overview:', err);
      if (window.Toast) {
        Toast.error('Error', 'Failed to load budget data. Please try again.');
      }
    }
  }

  async function loadPendingAlerts(projectId) {
    try {
      let endpoint = '/budget-alerts/pending';
      if (projectId) {
        endpoint += `?project_id=${projectId}`;
      }

      const data = await apiGet(endpoint);
      pendingAlerts = data.data || [];

      // Update badge counts
      updateAlertBadges();
      renderPendingAlerts();

      console.log('[BUDGET_MONITOR] Loaded', pendingAlerts.length, 'pending alerts');

    } catch (err) {
      console.error('[BUDGET_MONITOR] Error loading pending alerts:', err);
      pendingAlerts = [];
      updateAlertBadges();
      renderPendingAlerts();
    }
  }

  async function loadAlertHistory(projectId) {
    if (!projectId) {
      alertHistory = [];
      renderAlertHistory();
      return;
    }

    try {
      const data = await apiGet(`/budget-alerts/history?project_id=${projectId}&limit=100`);
      alertHistory = data.data || [];
      renderAlertHistory();

      console.log('[BUDGET_MONITOR] Loaded', alertHistory.length, 'history records');

    } catch (err) {
      console.error('[BUDGET_MONITOR] Error loading alert history:', err);
      alertHistory = [];
      renderAlertHistory();
    }
  }

  // ================================
  // RENDERING
  // ================================
  function updateSummaryCards() {
    const totalBudget = budgetData.reduce((sum, d) => sum + d.budget, 0);
    const totalActuals = budgetData.reduce((sum, d) => sum + d.actual, 0);
    const totalRemaining = totalBudget - totalActuals;
    const totalPercentage = totalBudget > 0 ? (totalActuals / totalBudget * 100) : 0;

    // Only update if elements exist
    if (els.totalBudget) els.totalBudget.textContent = formatCurrency(totalBudget);
    if (els.totalActuals) els.totalActuals.textContent = formatCurrency(totalActuals);
    if (els.totalRemaining) els.totalRemaining.textContent = formatCurrency(totalRemaining);
    if (els.totalPercentage) {
      els.totalPercentage.textContent = totalPercentage.toFixed(1) + '%';

      // Update colors based on percentage
      if (totalPercentage >= 100) {
        els.totalPercentage.classList.add('value-danger');
        els.totalPercentage.classList.remove('value-warning', 'value-success');
      } else if (totalPercentage >= 80) {
        els.totalPercentage.classList.add('value-warning');
        els.totalPercentage.classList.remove('value-danger', 'value-success');
      } else {
        els.totalPercentage.classList.add('value-success');
        els.totalPercentage.classList.remove('value-danger', 'value-warning');
      }
    }
  }

  function updateAlertBadges() {
    const count = pendingAlerts.length;
    if (els.pendingAlertsCount) els.pendingAlertsCount.textContent = count;
    if (els.tabAlertsBadge) els.tabAlertsBadge.textContent = count;

    if (count > 0) {
      if (els.pendingAlertsBadge) els.pendingAlertsBadge.classList.add('has-alerts');
      if (els.tabAlertsBadge) els.tabAlertsBadge.classList.add('has-alerts');
    } else {
      if (els.pendingAlertsBadge) els.pendingAlertsBadge.classList.remove('has-alerts');
      if (els.tabAlertsBadge) els.tabAlertsBadge.classList.remove('has-alerts');
    }
  }

  function renderBudgetOverview() {
    // Skip if elements don't exist
    if (!els.overviewEmptyState && !els.budgetOverviewTable) return;

    if (budgetData.length === 0) {
      if (els.overviewEmptyState) els.overviewEmptyState.style.display = 'flex';
      if (els.budgetOverviewTable) els.budgetOverviewTable.style.display = 'none';
      return;
    }

    if (els.overviewEmptyState) els.overviewEmptyState.style.display = 'none';
    if (els.budgetOverviewTable) els.budgetOverviewTable.style.display = 'table';

    if (!els.budgetOverviewBody) return;
    els.budgetOverviewBody.innerHTML = budgetData.map(row => {
      const statusBadge = getStatusBadge(row.status);
      const progressBar = getProgressBar(row.percentage, row.status);

      return `
        <tr class="budget-row status-${row.status}">
          <td class="col-account">${escapeHtml(row.account)}</td>
          <td class="col-budget">${formatCurrency(row.budget)}</td>
          <td class="col-actual">${formatCurrency(row.actual)}</td>
          <td class="col-remaining ${row.remaining < 0 ? 'negative' : ''}">${formatCurrency(row.remaining)}</td>
          <td class="col-percentage">
            ${progressBar}
          </td>
          <td class="col-status">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  function renderPendingAlerts() {
    // Skip if elements don't exist
    if (!els.alertsEmptyState && !els.alertsList) return;

    if (pendingAlerts.length === 0) {
      if (els.alertsEmptyState) els.alertsEmptyState.style.display = 'flex';
      if (els.alertsList) els.alertsList.style.display = 'none';
      return;
    }

    if (els.alertsEmptyState) els.alertsEmptyState.style.display = 'none';
    if (els.alertsList) els.alertsList.style.display = 'flex';

    if (!els.alertsList) return;
    els.alertsList.innerHTML = pendingAlerts.map(alert => {
      const typeLabel = alert.alert_type === 'overspend' ? 'Over Budget' : 'No Budget';
      const typeClass = alert.alert_type === 'overspend' ? 'badge-overspend' : 'badge-no-budget';
      const overAmount = alert.alert_type === 'overspend'
        ? (alert.actual_amount - alert.budget_amount)
        : alert.actual_amount;

      return `
        <div class="alert-card alert-${alert.alert_type}" data-alert-id="${alert.id}">
          <div class="alert-card-header">
            <div class="alert-card-type">
              <span class="alert-badge ${typeClass}">${typeLabel}</span>
              <span class="alert-project">${escapeHtml(alert.projects?.project_name || 'Unknown Project')}</span>
            </div>
            <span class="alert-date">${formatDate(alert.created_at)}</span>
          </div>

          <div class="alert-card-body">
            <div class="alert-account">${escapeHtml(alert.account_name || 'Unknown Account')}</div>
            <div class="alert-message">${escapeHtml(alert.message)}</div>

            <div class="alert-amounts">
              <div class="alert-amount">
                <span class="alert-amount-label">Budget</span>
                <span class="alert-amount-value">${formatCurrency(alert.budget_amount || 0)}</span>
              </div>
              <div class="alert-amount">
                <span class="alert-amount-label">Actual</span>
                <span class="alert-amount-value amount-actual">${formatCurrency(alert.actual_amount || 0)}</span>
              </div>
              <div class="alert-amount">
                <span class="alert-amount-label">${alert.alert_type === 'overspend' ? 'Over' : 'Amount'}</span>
                <span class="alert-amount-value amount-over">${formatCurrency(overAmount)}</span>
              </div>
            </div>
          </div>

          <div class="alert-card-actions">
            <button type="button" class="btn-acknowledge" onclick="window.BudgetMonitor.openAcknowledgeModal('${alert.id}')">
              Acknowledge
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAlertHistory() {
    // Skip if elements don't exist
    if (!els.historyEmptyState && !els.historyTable) return;

    if (alertHistory.length === 0) {
      if (els.historyEmptyState) els.historyEmptyState.style.display = 'flex';
      if (els.historyTable) els.historyTable.style.display = 'none';
      return;
    }

    if (els.historyEmptyState) els.historyEmptyState.style.display = 'none';
    if (els.historyTable) els.historyTable.style.display = 'table';

    if (!els.historyTableBody) return;
    els.historyTableBody.innerHTML = alertHistory.map(alert => {
      const typeLabel = alert.alert_type === 'overspend' ? 'Over Budget'
        : alert.alert_type === 'no_budget' ? 'No Budget'
        : alert.alert_type === 'warning' ? 'Warning'
        : alert.alert_type === 'critical' ? 'Critical'
        : alert.alert_type;

      const statusBadge = alert.status === 'acknowledged'
        ? '<span class="status-badge status-acknowledged">Acknowledged</span>'
        : alert.status === 'pending'
        ? '<span class="status-badge status-pending">Pending</span>'
        : `<span class="status-badge">${alert.status}</span>`;

      const ackBy = alert.acknowledged_by_user?.user_name || '—';
      const hasNote = alert.acknowledgment_note && alert.status === 'acknowledged';

      return `
        <tr class="history-row">
          <td>${formatDate(alert.created_at)}</td>
          <td><span class="type-badge type-${alert.alert_type}">${typeLabel}</span></td>
          <td>${escapeHtml(alert.account_name || '—')}</td>
          <td>${formatCurrency(alert.budget_amount || 0)}</td>
          <td>${formatCurrency(alert.actual_amount || 0)}</td>
          <td>${statusBadge}</td>
          <td>${escapeHtml(ackBy)}</td>
          <td>
            ${hasNote ? `<button type="button" class="btn-view-note" onclick="window.BudgetMonitor.viewNote('${alert.id}')">View Note</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ================================
  // ACKNOWLEDGE FLOW
  // ================================
  function openAcknowledgeModal(alertId) {
    const alert = pendingAlerts.find(a => a.id === alertId);
    if (!alert) {
      console.error('[BUDGET_MONITOR] Alert not found:', alertId);
      return;
    }

    currentAckAlert = alert;

    // Populate modal (with null checks)
    const typeLabel = alert.alert_type === 'overspend' ? 'Over Budget' : 'No Budget';
    if (els.ackAlertType) {
      els.ackAlertType.textContent = typeLabel;
      els.ackAlertType.className = `ack-alert-type type-${alert.alert_type}`;
    }

    if (els.ackAlertAccount) els.ackAlertAccount.textContent = alert.account_name || 'Unknown Account';
    if (els.ackAlertMessage) els.ackAlertMessage.textContent = alert.message;

    if (els.ackBudgetAmount) els.ackBudgetAmount.textContent = formatCurrency(alert.budget_amount || 0);
    if (els.ackActualAmount) els.ackActualAmount.textContent = formatCurrency(alert.actual_amount || 0);

    const overAmount = alert.alert_type === 'overspend'
      ? (alert.actual_amount - alert.budget_amount)
      : alert.actual_amount;
    if (els.ackOverAmount) els.ackOverAmount.textContent = formatCurrency(overAmount);

    if (els.ackAlertNote) els.ackAlertNote.value = '';

    // Show modal
    if (els.acknowledgeModal) els.acknowledgeModal.classList.remove('hidden');
  }

  function closeAcknowledgeModal() {
    if (els.acknowledgeModal) els.acknowledgeModal.classList.add('hidden');
    currentAckAlert = null;
    if (els.ackAlertNote) els.ackAlertNote.value = '';
  }

  async function confirmAcknowledge() {
    if (!currentAckAlert) return;

    const note = els.ackAlertNote ? els.ackAlertNote.value.trim() : '';
    if (!note) {
      if (window.Toast) {
        Toast.warning('Note Required', 'Please provide a justification note');
      }
      if (els.ackAlertNote) els.ackAlertNote.focus();
      return;
    }

    try {
      if (els.btnConfirmAck) {
        els.btnConfirmAck.disabled = true;
        els.btnConfirmAck.textContent = 'Saving...';
      }

      await apiPut(`/budget-alerts/acknowledge/${currentAckAlert.id}`, {
        note: note,
        action: "acknowledged"
      });

      if (window.Toast) {
        Toast.success('Alert Acknowledged', 'The budget alert has been acknowledged successfully');
      }

      closeAcknowledgeModal();

      // Refresh data
      await loadPendingAlerts(selectedProjectId);
      await loadAlertHistory(selectedProjectId);

    } catch (err) {
      console.error('[BUDGET_MONITOR] Error acknowledging alert:', err);
      if (window.Toast) {
        Toast.error('Error', err.message || 'Failed to acknowledge alert');
      }
    } finally {
      if (els.btnConfirmAck) {
        els.btnConfirmAck.disabled = false;
        els.btnConfirmAck.textContent = 'Acknowledge Alert';
      }
    }
  }

  // ================================
  // VIEW NOTE
  // ================================
  function viewNote(alertId) {
    const alert = alertHistory.find(a => a.id === alertId);
    if (!alert) {
      console.error('[BUDGET_MONITOR] Alert not found:', alertId);
      return;
    }

    const typeLabel = alert.alert_type === 'overspend' ? 'Over Budget'
      : alert.alert_type === 'no_budget' ? 'No Budget'
      : alert.alert_type;

    if (els.viewNoteAccount) els.viewNoteAccount.textContent = alert.account_name || '—';
    if (els.viewNoteType) els.viewNoteType.textContent = typeLabel;
    if (els.viewNoteAckBy) els.viewNoteAckBy.textContent = alert.acknowledged_by_user?.user_name || '—';
    if (els.viewNoteAckAt) els.viewNoteAckAt.textContent = alert.acknowledged_at ? formatDateTime(alert.acknowledged_at) : '—';
    if (els.viewNoteText) els.viewNoteText.textContent = alert.acknowledgment_note || 'No note provided';

    if (els.viewNoteModal) els.viewNoteModal.classList.remove('hidden');
  }

  function closeViewNoteModal() {
    if (els.viewNoteModal) els.viewNoteModal.classList.add('hidden');
  }

  // ================================
  // TABS
  // ================================
  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.budget-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tabContent${capitalize(tabName)}`);
    });
  }

  // ================================
  // HELPERS
  // ================================
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getStatusBadge(status) {
    const labels = {
      on_track: 'On Track',
      warning: 'Warning',
      critical: 'Critical',
      overspend: 'Over Budget',
      no_budget: 'No Budget'
    };
    return `<span class="status-badge status-${status}">${labels[status] || status}</span>`;
  }

  function getProgressBar(percentage, status) {
    const clampedPct = Math.min(percentage, 100);
    return `
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill status-${status}" style="width: ${clampedPct}%"></div>
        </div>
        <span class="progress-label">${percentage.toFixed(1)}%</span>
      </div>
    `;
  }

  // ================================
  // EVENT SETUP
  // ================================
  function setupEventListeners() {
    // Project filter
    els.projectFilter?.addEventListener('change', async (e) => {
      selectedProjectId = e.target.value || null;
      await refreshData();
    });

    // Refresh button
    els.btnRefreshData?.addEventListener('click', async () => {
      await refreshData();
      if (window.Toast) {
        Toast.success('Refreshed', 'Data has been refreshed');
      }
    });

    // Tab clicks
    els.tabOverview?.addEventListener('click', () => switchTab('overview'));
    els.tabAlerts?.addEventListener('click', () => switchTab('alerts'));
    els.tabHistory?.addEventListener('click', () => switchTab('history'));

    // Acknowledge modal
    els.btnCloseAckModal?.addEventListener('click', closeAcknowledgeModal);
    els.btnCancelAck?.addEventListener('click', closeAcknowledgeModal);
    els.btnConfirmAck?.addEventListener('click', confirmAcknowledge);

    // View note modal
    els.btnCloseViewNote?.addEventListener('click', closeViewNoteModal);
    els.btnCloseViewNoteFooter?.addEventListener('click', closeViewNoteModal);

    // Close modals on backdrop click
    els.acknowledgeModal?.addEventListener('click', (e) => {
      if (e.target === els.acknowledgeModal) closeAcknowledgeModal();
    });
    els.viewNoteModal?.addEventListener('click', (e) => {
      if (e.target === els.viewNoteModal) closeViewNoteModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (els.acknowledgeModal && !els.acknowledgeModal.classList.contains('hidden')) {
          closeAcknowledgeModal();
        }
        if (els.viewNoteModal && !els.viewNoteModal.classList.contains('hidden')) {
          closeViewNoteModal();
        }
      }
    });
  }

  async function refreshData() {
    await Promise.all([
      loadBudgetOverview(selectedProjectId),
      loadPendingAlerts(selectedProjectId),
      loadAlertHistory(selectedProjectId)
    ]);
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    console.log('[BUDGET_MONITOR] Initializing...');

    if (!initAuth()) return;

    cacheElements();
    setupEventListeners();

    // Load initial data
    await loadProjects();
    await loadPendingAlerts(null); // Load all pending alerts initially

    console.log('[BUDGET_MONITOR] Initialization complete');
  }

  // Start on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for onclick handlers
  window.BudgetMonitor = {
    openAcknowledgeModal,
    viewNote
  };

})();
