// assets/js/pipeline_automations.js
// Pipeline Automations - Auto-generated tasks based on system conditions

(function() {
  'use strict';

  const qs = (id) => document.getElementById(id);

  // Storage key for automation settings
  const STORAGE_KEY = 'pm_automations_v1';

  // Available automations
  const AUTOMATIONS = [
    {
      id: 'pending_expenses_auth',
      name: 'Pending Expenses to Authorize',
      description: 'Creates tasks for projects with unauthorized expenses. Assigned to Bookkeeping department with Accounting Manager as reviewer.',
      taskTemplate: 'Gastos pendientes por autorizar en {project}',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      iconColor: '#f59e0b',
      enabled: false,
      statusKey: 'pending_expenses_auth'
    },
    {
      id: 'pending_expenses_categorize',
      name: 'Pending Expenses to Categorize',
      description: 'Creates tasks for projects with uncategorized expenses. Assigned to Bookkeeping department.',
      taskTemplate: 'Gastos pendientes por categorizar en {project}',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      iconColor: '#3b82f6',
      enabled: false,
      statusKey: 'pending_expenses_categorize'
    },
    {
      id: 'pending_health_check',
      name: 'Pending Health Check',
      description: 'Creates health check tasks for active projects with low budget or no recent reviews.',
      taskTemplate: 'Health Check requerido para {project}',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
      iconColor: '#10b981',
      enabled: false,
      statusKey: 'pending_health_check'
    },
    {
      id: 'pending_invoices',
      name: 'Pending Invoices',
      description: 'Creates a task when there are invoices pending to be sent',
      taskTemplate: 'Facturas pendientes por enviar en {project}',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      iconColor: '#6366f1',
      enabled: false,
      statusKey: 'pending_invoices',
      comingSoon: true
    },
    {
      id: 'overdue_tasks',
      name: 'Overdue Task Alerts',
      description: 'Creates alert tasks for overdue items in a project',
      taskTemplate: 'Tareas vencidas en {project}',
      icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      iconColor: '#ef4444',
      enabled: false,
      statusKey: 'overdue_tasks',
      comingSoon: true
    }
  ];

  // Current settings and status
  let settings = {};
  let automationStatus = {};

  // ================================
  // SETTINGS PERSISTENCE
  // ================================

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultSettings();
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[AUTOMATIONS] Error loading settings:', e);
      return getDefaultSettings();
    }
  }

  function saveSettings(newSettings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      settings = newSettings;
    } catch (e) {
      console.error('[AUTOMATIONS] Error saving settings:', e);
    }
  }

  function getDefaultSettings() {
    const defaults = {};
    AUTOMATIONS.forEach(a => {
      defaults[a.id] = { enabled: false };
    });
    return defaults;
  }

  // ================================
  // FETCH AUTOMATION STATUS
  // ================================

  async function fetchAutomationStatus() {
    try {
      const apiBase = window.API_BASE || '';
      const res = await fetch(`${apiBase}/pipeline/automations/status`, {
        credentials: 'include'
      });

      if (!res.ok) {
        console.warn('[AUTOMATIONS] Failed to fetch status');
        return null;
      }

      automationStatus = await res.json();
      console.log('[AUTOMATIONS] Status:', automationStatus);
      return automationStatus;
    } catch (err) {
      console.error('[AUTOMATIONS] Error fetching status:', err);
      return null;
    }
  }

  // ================================
  // MODAL UI
  // ================================

  async function open() {
    const modal = qs('automationsModal');
    if (!modal) {
      console.warn('[AUTOMATIONS] Modal not found');
      return;
    }

    // Load current settings
    settings = loadSettings();

    // Fetch automation status from backend
    await fetchAutomationStatus();

    // Render automation list
    renderAutomationsList();

    modal.classList.remove('hidden');
  }

  function close() {
    const modal = qs('automationsModal');
    if (!modal) return;
    modal.classList.add('hidden');
  }

  function renderAutomationsList() {
    const container = qs('automationsList');
    if (!container) return;

    container.innerHTML = AUTOMATIONS.map(automation => {
      const isEnabled = settings[automation.id]?.enabled || false;
      const isComingSoon = automation.comingSoon || false;

      // Get status info for this automation
      let statusBadge = '';
      const statusData = automationStatus[automation.statusKey];

      if (statusData) {
        if (automation.id === 'pending_expenses_auth') {
          const count = statusData.projects_count || 0;
          const expenses = statusData.expenses_count || 0;
          if (count > 0) {
            statusBadge = `<span class="pm-automation-badge">${count} projects (${expenses} expenses)</span>`;
          }
        } else if (statusData.count > 0) {
          statusBadge = `<span class="pm-automation-badge">${statusData.count} items</span>`;
        }
      }

      const comingSoonBadge = isComingSoon
        ? '<span class="pm-automation-badge pm-automation-badge--soon">Coming Soon</span>'
        : '';

      const iconStyle = automation.iconColor ? `style="color: ${automation.iconColor}"` : '';

      return `
        <div class="pm-automation-item ${isComingSoon ? 'pm-automation-item--disabled' : ''}" data-automation-id="${automation.id}">
          <div class="pm-automation-icon" ${iconStyle}>${automation.icon}</div>
          <div class="pm-automation-info">
            <div class="pm-automation-name">
              ${automation.name}
              ${comingSoonBadge}
            </div>
            <div class="pm-automation-desc">${automation.description}</div>
            ${statusBadge}
          </div>
          <label class="pm-automation-toggle">
            <input type="checkbox"
                   class="pm-automation-checkbox"
                   data-automation="${automation.id}"
                   ${isEnabled ? 'checked' : ''}
                   ${isComingSoon ? 'disabled' : ''} />
            <span class="pm-toggle-slider"></span>
          </label>
        </div>
      `;
    }).join('');

    // Attach change listeners
    container.querySelectorAll('.pm-automation-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', handleToggleChange);
    });
  }

  function handleToggleChange(e) {
    const automationId = e.target.dataset.automation;
    const isEnabled = e.target.checked;

    settings[automationId] = { enabled: isEnabled };
    saveSettings(settings);

    console.log(`[AUTOMATIONS] ${automationId} ${isEnabled ? 'enabled' : 'disabled'}`);

    // Refresh pipeline to show/hide automated tasks
    if (typeof window.fetchPipeline === 'function') {
      window.fetchPipeline();
    }
  }

  // ================================
  // RUN AUTOMATIONS
  // ================================

  async function runAutomations() {
    const btn = qs('btnRunAutomations');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="btn-icon">⏳</span> Running...';
    }

    try {
      const apiBase = window.API_BASE || '';

      // Get enabled automations (excluding coming soon)
      const enabledIds = Object.entries(settings)
        .filter(([id, config]) => {
          const automation = AUTOMATIONS.find(a => a.id === id);
          return config.enabled && !automation?.comingSoon;
        })
        .map(([id]) => id);

      if (enabledIds.length === 0) {
        if (window.Toast) {
          Toast.warning('No Automations', 'Enable at least one automation first.');
        }
        return;
      }

      const res = await fetch(`${apiBase}/pipeline/automations/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ automations: enabledIds })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      const result = await res.json();
      console.log('[AUTOMATIONS] Run result:', result);

      if (window.Toast) {
        const created = result.tasks_created || 0;
        const updated = result.tasks_updated || 0;

        if (created > 0 || updated > 0) {
          Toast.success('Automations Complete', `${created} created, ${updated} updated.`);
        } else {
          Toast.info('Automations Complete', 'No new tasks needed.');
        }
      }

      // Refresh status and pipeline
      await fetchAutomationStatus();
      renderAutomationsList();

      if (typeof window.fetchPipeline === 'function') {
        window.fetchPipeline();
      }

    } catch (err) {
      console.error('[AUTOMATIONS] Error running:', err);
      if (window.Toast) {
        Toast.error('Automation Failed', err.message);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="btn-icon">▶</span> Run Now';
      }
    }
  }

  // ================================
  // GET ENABLED AUTOMATIONS (for filtering)
  // ================================

  function getEnabledAutomations() {
    const currentSettings = loadSettings();
    return Object.entries(currentSettings)
      .filter(([id, config]) => config.enabled)
      .map(([id]) => id);
  }

  function isAutomationEnabled(automationId) {
    const currentSettings = loadSettings();
    return currentSettings[automationId]?.enabled || false;
  }

  // ================================
  // BIND EVENTS
  // ================================

  function bind() {
    // Open button (in toolbar)
    qs('btnAutomations')?.addEventListener('click', (e) => {
      e.preventDefault();
      open();
    });

    // Close buttons
    qs('btnCloseAutomationsModal')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    qs('btnCloseAutomations')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    // Run button
    qs('btnRunAutomations')?.addEventListener('click', (e) => {
      e.preventDefault();
      runAutomations();
    });

    // Click backdrop to close
    const modal = qs('automationsModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
      });

      // Prevent close when clicking inside modal
      const dialog = modal.querySelector('.modal');
      dialog?.addEventListener('click', (e) => e.stopPropagation());
    }

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = qs('automationsModal');
        if (modal && !modal.classList.contains('hidden')) {
          close();
        }
      }
    });

    console.log('[AUTOMATIONS] Module bound');
  }

  // ================================
  // EXPOSE API
  // ================================

  window.PM_Automations = {
    open,
    close,
    bind,
    run: runAutomations,
    getEnabled: getEnabledAutomations,
    isEnabled: isAutomationEnabled,
    fetchStatus: fetchAutomationStatus,
    AUTOMATIONS
  };

  // Initialize settings on load
  settings = loadSettings();

})();
