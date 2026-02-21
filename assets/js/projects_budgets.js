// ============================================
// PROJECTS -- Project Budgets Tab
// ============================================
// Budget management embedded as a tab in the Projects page.
// Ported from standalone budgets.js with load/unload lifecycle.
//
// Dependencies:
//   - window.NGM.api(url, options)
//   - window.ProjectsPage.getProjects()
//   - window.Toast

window.ProjectBudgets = (() => {
  'use strict';

  let _loaded = false;
  let _abortController = null;
  let _eventsAttached = false;

  // State
  let budgets = [];
  let selectedProjectId = null;
  let selectedProjectName = '';
  let currentCSVFile = null;
  let parsedCSVData = null;
  let qboConnected = false;
  let qboRealmId = null;
  let qboBudgetPreview = [];
  let pendingMappingChanges = {};

  // Cached DOM refs (set in cacheElements)
  const els = {};

  // ── Helpers ──────────────────────────────────────────────────────

  function getApiBase() {
    return window.API_BASE || 'https://ngm-fastapi.onrender.com';
  }

  async function apiJson(url, options = {}) {
    if (_abortController) {
      options.signal = _abortController.signal;
    }
    const token = localStorage.getItem('ngmToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { credentials: 'include', ...options, headers });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`${options.method || 'GET'} ${url} failed (${res.status}): ${text}`);
    return text ? JSON.parse(text) : null;
  }

  function formatCurrency(value) {
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
  }

  // ── DOM Cache ────────────────────────────────────────────────────

  function cacheElements() {
    els.projectFilter   = document.getElementById('pb-projectFilter');
    els.emptyState      = document.getElementById('pb-emptyState');
    els.emptyMsg        = document.getElementById('pb-emptyMsg');
    els.content         = document.getElementById('pb-content');
    els.tableBody       = document.getElementById('pb-tableBody');
    els.searchInput     = document.getElementById('pb-search');
    els.btnImportCSV    = document.getElementById('pb-btnImportCSV');
    els.btnImportQBO    = document.getElementById('pb-btnImportQBO');
    els.btnQBOMapping   = document.getElementById('pb-btnQBOMapping');
    // CSV Import Modal
    els.importModal     = document.getElementById('pb-importModal');
    els.csvFileInput    = document.getElementById('pb-csvFileInput');
    els.btnSelectFile   = document.getElementById('pb-btnSelectFile');
    els.fileNameDisplay = document.getElementById('pb-fileNameDisplay');
    els.csvPreview      = document.getElementById('pb-csvPreview');
    els.csvPreviewContent = document.getElementById('pb-csvPreviewContent');
    els.csvPreviewStats = document.getElementById('pb-csvPreviewStats');
    els.selectedProject = document.getElementById('pb-selectedProject');
    els.btnCloseImport  = document.getElementById('pb-btnCloseImport');
    els.btnCancelImport = document.getElementById('pb-btnCancelImport');
    els.btnConfirmImport = document.getElementById('pb-btnConfirmImport');
    // QBO Mapping Modal
    els.mappingModal    = document.getElementById('pb-mappingModal');
    els.btnCloseMapping = document.getElementById('pb-btnCloseMapping');
    els.btnCancelMapping = document.getElementById('pb-btnCancelMapping');
    els.btnSaveMappings = document.getElementById('pb-btnSaveMappings');
    els.btnAutoMatch    = document.getElementById('pb-btnAutoMatch');
    els.mappingStats    = document.getElementById('pb-mappingStats');
    els.mappingTableBody = document.getElementById('pb-mappingTableBody');
  }

  // ── UI State ─────────────────────────────────────────────────────

  function showEmptyState(message, showImportBtn) {
    if (!els.emptyState) return;
    els.emptyState.style.display = 'flex';
    if (els.emptyMsg) els.emptyMsg.textContent = message;
    const importBtn = document.getElementById('pb-btnImportFromEmpty');
    if (importBtn) importBtn.style.display = showImportBtn ? 'inline-block' : 'none';
    if (els.content) els.content.style.display = 'none';
  }

  function hideEmptyState() {
    if (els.emptyState) els.emptyState.style.display = 'none';
    if (els.content) els.content.style.display = 'block';
  }

  // ── Populate Project Dropdown ────────────────────────────────────

  function populateProjectDropdown() {
    if (!els.projectFilter) return;

    let filtered = [];
    if (window.ProjectsPage && window.ProjectsPage.getFilteredProjects) {
      filtered = window.ProjectsPage.getFilteredProjects() || [];
    } else if (window.ProjectsPage && window.ProjectsPage.getProjects) {
      filtered = window.ProjectsPage.getProjects() || [];
    }

    els.projectFilter.innerHTML = '<option value="">Select a project...</option>';
    filtered.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id || p.id;
      opt.textContent = p.project_name || p.name || 'Unnamed Project';
      els.projectFilter.appendChild(opt);
    });

    // Restore shared selection
    const sharedId = window.ProjectsPage?.getSharedProjectId?.();
    if (sharedId) {
      const optExists = Array.from(els.projectFilter.options).some(o => o.value === String(sharedId));
      if (optExists) els.projectFilter.value = sharedId;
    }
  }

  // ── Load Budgets ─────────────────────────────────────────────────

  async function loadBudgetsByProject(projectId) {
    if (!projectId) {
      budgets = [];
      showEmptyState('Select a project to view budgets');
      return;
    }

    const apiBase = getApiBase();
    try {
      const result = await apiJson(`${apiBase}/budgets?project=${projectId}`);

      if (Array.isArray(result)) budgets = result;
      else if (result && Array.isArray(result.data)) budgets = result.data;
      else if (result && Array.isArray(result.budgets)) budgets = result.budgets;
      else budgets = [];

      if (budgets.length === 0) {
        showEmptyState('No budgets have been loaded for this project yet.', true);
      } else {
        renderBudgetsTable();
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PB] Error loading budgets:', err);
      showEmptyState('Error loading budgets: ' + err.message);
    }
  }

  // ── Render Table ─────────────────────────────────────────────────

  function renderBudgetsTable() {
    if (!budgets || budgets.length === 0) {
      showEmptyState('No budgets loaded for this project yet.');
      return;
    }
    hideEmptyState();

    const rows = budgets.map(b => {
      const isActive = b.active === true || b.active === 'true' || b.active === 1;
      const statusClass = isActive ? 'status-badge-success' : 'status-badge-inactive';
      const statusText = isActive ? 'Active' : 'Inactive';
      return `
        <tr data-budget-id="${b.id}">
          <td>${b.budget_name || '\u2014'}</td>
          <td>${b.year || '\u2014'}</td>
          <td>${b.account_name || '\u2014'}</td>
          <td style="text-align:right;font-weight:600;">$${formatCurrency(b.amount_sum)}</td>
          <td>${formatDate(b.start_date)}</td>
          <td>${formatDate(b.end_date)}</td>
          <td style="text-align:center;">${b.lines_count || 0}</td>
          <td class="col-status"><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>`;
    }).join('');

    const total = budgets.reduce((s, b) => s + (parseFloat(b.amount_sum) || 0), 0);
    const totalRow = `
      <tr class="table-total-row">
        <td colspan="3" style="text-align:right;font-weight:600;">Total Budget:</td>
        <td style="text-align:right;font-weight:700;color:#22c55e;">$${formatCurrency(total)}</td>
        <td colspan="4"></td>
      </tr>`;

    els.tableBody.innerHTML = rows + totalRow;
  }

  // ── Search / Filter ──────────────────────────────────────────────

  function filterTable(term) {
    if (!els.tableBody) return;
    els.tableBody.querySelectorAll('tr[data-budget-id]').forEach(row => {
      if (!term) { row.style.display = ''; return; }
      row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  }

  // ── CSV Import ───────────────────────────────────────────────────

  function openImportModal() {
    if (!selectedProjectId) {
      if (window.Toast) Toast.warning('No Project', 'Please select a project first.');
      return;
    }
    if (els.selectedProject) els.selectedProject.textContent = selectedProjectName;
    if (els.csvFileInput) els.csvFileInput.value = '';
    if (els.csvPreview) els.csvPreview.style.display = 'none';
    if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
    if (els.fileNameDisplay) {
      els.fileNameDisplay.textContent = 'No file selected';
      els.fileNameDisplay.classList.remove('has-file');
    }
    currentCSVFile = null;
    parsedCSVData = null;
    if (els.importModal) els.importModal.classList.remove('hidden');
  }

  function closeImportModal() {
    if (els.importModal) els.importModal.classList.add('hidden');
  }

  // CSV Parsing (same robust logic from budgets.js)

  function sanitizeAndParseCSV(csvText) {
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
    csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length === 0) throw new Error('CSV file is empty');
    const rows = lines.map(parseCSVLine);
    return rows.filter(row => row.some(cell => cell.trim() !== ''));
  }

  function parseCSVLine(line) {
    const result = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = !inQuotes; i++; continue;
      }
      if (ch === ',' && !inQuotes) { result.push(field.trim()); field = ''; i++; continue; }
      field += ch; i++;
    }
    result.push(field.trim());
    return result;
  }

  function validateCSVStructure(rows, requiredHeaders) {
    if (rows.length < 2) throw new Error('CSV must have at least a header row and one data row.');
    const headers = rows[0];
    const dataRows = rows.slice(1);
    if (requiredHeaders.length > 0) {
      const lower = headers.map(h => h.toLowerCase().trim());
      const missing = requiredHeaders.filter(r => !lower.some(h => h === r.toLowerCase()));
      if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`);
    }
    return { isValid: true, headers, dataRows, rowCount: dataRows.length, columnCount: headers.length };
  }

  async function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      if (els.csvPreview) els.csvPreview.style.display = 'none';
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
      if (els.fileNameDisplay) { els.fileNameDisplay.textContent = 'No file selected'; els.fileNameDisplay.classList.remove('has-file'); }
      return;
    }
    if (els.fileNameDisplay) { els.fileNameDisplay.textContent = file.name; els.fileNameDisplay.classList.add('has-file'); }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      if (window.Toast) Toast.error('Invalid File', 'Please select a CSV file.');
      els.csvFileInput.value = '';
      if (els.fileNameDisplay) { els.fileNameDisplay.textContent = 'No file selected'; els.fileNameDisplay.classList.remove('has-file'); }
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      if (window.Toast) Toast.error('File Too Large', 'Maximum size is 5MB.');
      els.csvFileInput.value = '';
      if (els.fileNameDisplay) { els.fileNameDisplay.textContent = 'No file selected'; els.fileNameDisplay.classList.remove('has-file'); }
      return;
    }
    currentCSVFile = file;
    try {
      const text = await file.text();
      const rows = sanitizeAndParseCSV(text);
      const validation = validateCSVStructure(rows, ['BudgetName', 'BudgetId', 'Amount_SUM']);
      parsedCSVData = { headers: validation.headers, data: validation.dataRows };
      const preview = rows.slice(0, Math.min(6, rows.length));
      if (els.csvPreviewContent) els.csvPreviewContent.textContent = preview.map(r => r.join(', ')).join('\n');
      if (els.csvPreviewStats) els.csvPreviewStats.textContent = `${validation.columnCount} columns x ${validation.rowCount} data rows`;
      if (els.csvPreview) els.csvPreview.style.display = 'block';
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = false;
    } catch (err) {
      console.error('[PB] CSV parse error:', err);
      if (window.Toast) Toast.error('Parse Error', 'Error reading CSV file.', { details: err.message });
      if (els.csvFileInput) els.csvFileInput.value = '';
      if (els.csvPreview) els.csvPreview.style.display = 'none';
      if (els.btnConfirmImport) els.btnConfirmImport.disabled = true;
    }
  }

  async function importCSV() {
    if (!parsedCSVData || !selectedProjectId) {
      if (window.Toast) Toast.warning('Missing Data', 'No valid CSV data or project selected.');
      return;
    }
    const btn = els.btnConfirmImport;
    const orig = btn.textContent;
    try {
      btn.disabled = true;
      btn.textContent = 'Importing...';
      const result = await apiJson(`${getApiBase()}/budgets/import`, {
        method: 'POST',
        body: JSON.stringify({ project_id: selectedProjectId, headers: parsedCSVData.headers, data: parsedCSVData.data })
      });
      if (window.Toast) Toast.success('Import Complete', `Successfully imported ${result.count || parsedCSVData.data.length} budget records!`);
      closeImportModal();
      await loadBudgetsByProject(selectedProjectId);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PB] Import error:', err);
      if (window.Toast) Toast.error('Import Failed', 'Error importing CSV.', { details: err.message });
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  // ── QBO Integration ──────────────────────────────────────────────

  async function checkQBOConnection() {
    try {
      const status = await apiJson(`${getApiBase()}/qbo/status`);
      if (status.connected && status.connections && status.connections.length > 0) {
        const active = status.connections.find(c => c.access_token_valid || c.refresh_token_valid);
        if (active) { qboConnected = true; qboRealmId = active.realm_id; return true; }
      }
      qboConnected = false; qboRealmId = null;
      return false;
    } catch {
      qboConnected = false; qboRealmId = null;
      return false;
    }
  }

  function updateQBOButtonState() {
    if (els.btnImportQBO) {
      els.btnImportQBO.disabled = !qboConnected || !selectedProjectId;
      els.btnImportQBO.title = qboConnected ? 'Import mapped budgets from QuickBooks' : 'Connect to QuickBooks in Settings first';
    }
    if (els.btnQBOMapping) {
      els.btnQBOMapping.disabled = !qboConnected;
      els.btnQBOMapping.title = qboConnected ? 'Map QBO budgets to NGM projects' : 'Connect to QuickBooks in Settings first';
    }
  }

  async function importFromQBO() {
    if (!qboConnected || !qboRealmId) {
      if (window.Toast) Toast.warning('Not Connected', 'Please connect to QuickBooks in Settings first.');
      return;
    }
    const btn = els.btnImportQBO;
    const orig = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = 'Syncing...';
      const result = await apiJson(`${getApiBase()}/qbo/budgets/sync-mapped/${qboRealmId}`, { method: 'POST' });
      if (result.total_imported > 0) {
        if (window.Toast) Toast.success('Import Complete', `Imported ${result.total_imported} budget lines to ${result.projects_updated} projects.`);
        if (selectedProjectId) await loadBudgetsByProject(selectedProjectId);
      } else {
        if (window.Toast) Toast.warning('No Mapped Budgets', 'No mapped budgets to import. Use "QBO Mapping" to map budgets first.');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PB] QBO import error:', err);
      if (window.Toast) Toast.error('Import Failed', 'Error importing from QuickBooks.', { details: err.message });
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
      updateQBOButtonState();
    }
  }

  // ── QBO Mapping Modal ────────────────────────────────────────────

  async function openMappingModal() {
    if (!qboConnected || !qboRealmId) {
      if (window.Toast) Toast.warning('Not Connected', 'Please connect to QuickBooks in Settings first.');
      return;
    }
    pendingMappingChanges = {};
    qboBudgetPreview = [];
    if (els.mappingModal) els.mappingModal.classList.remove('hidden');
    await loadBudgetPreview();
  }

  function closeMappingModal() {
    if (els.mappingModal) els.mappingModal.classList.add('hidden');
    pendingMappingChanges = {};
  }

  async function loadBudgetPreview() {
    try {
      if (els.mappingStats) els.mappingStats.textContent = 'Loading budgets from QuickBooks...';
      if (els.mappingTableBody) els.mappingTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;">Loading...</td></tr>';

      const result = await apiJson(`${getApiBase()}/qbo/budgets/preview/${qboRealmId}`);
      qboBudgetPreview = result.data || [];

      if (els.mappingStats) {
        els.mappingStats.innerHTML = `
          <span style="color:#22c55e;">${result.mapped_count || 0} mapped</span> ·
          <span style="color:#f59e0b;">${result.unmapped_count || 0} unmapped</span> ·
          ${result.count || 0} total`;
      }
      renderMappingTable();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PB] Preview error:', err);
      if (els.mappingStats) els.mappingStats.textContent = 'Error loading budgets';
      if (els.mappingTableBody) els.mappingTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  }

  function renderMappingTable() {
    if (!qboBudgetPreview.length) {
      if (els.mappingTableBody) els.mappingTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:#9ca3af;">No budgets found in QuickBooks</td></tr>';
      return;
    }

    let projects = [];
    if (window.ProjectsPage && window.ProjectsPage.getProjects) projects = window.ProjectsPage.getProjects() || [];

    const rows = qboBudgetPreview.map(b => {
      const statusClass = b.is_mapped ? 'status-badge-success' : 'status-badge-warning';
      const statusText = b.is_mapped ? 'Mapped' : 'Unmapped';
      const currentPid = pendingMappingChanges[b.qbo_budget_id] !== undefined
        ? pendingMappingChanges[b.qbo_budget_id]
        : (b.ngm_project_id || '');

      const opts = projects.map(p => {
        const pid = p.project_id || p.id;
        const pname = p.project_name || p.name || 'Unnamed';
        return `<option value="${pid}" ${pid === currentPid ? 'selected' : ''}>${pname}</option>`;
      }).join('');

      return `
        <tr data-qbo-budget-id="${b.qbo_budget_id}">
          <td>
            <div style="font-weight:500;">${b.qbo_budget_name || 'Unnamed'}</div>
            ${b.auto_matched ? '<span style="font-size:11px;color:#a78bfa;">auto-matched</span>' : ''}
          </td>
          <td>${b.qbo_fiscal_year || '\u2014'}</td>
          <td class="col-status"><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>
            <select class="ngm-select pb-mapping-select" data-qbo-budget-id="${b.qbo_budget_id}">
              <option value="">\u2014 Select Project \u2014</option>
              ${opts}
            </select>
          </td>
        </tr>`;
    }).join('');

    if (els.mappingTableBody) {
      els.mappingTableBody.innerHTML = rows;
      els.mappingTableBody.querySelectorAll('.pb-mapping-select').forEach(sel => {
        sel.addEventListener('change', e => {
          pendingMappingChanges[e.target.dataset.qboBudgetId] = e.target.value || null;
        });
      });
    }
  }

  async function saveMappings() {
    const changes = Object.entries(pendingMappingChanges);
    if (changes.length === 0) {
      if (window.Toast) Toast.info('No Changes', 'No mapping changes to save.');
      closeMappingModal();
      return;
    }
    const btn = els.btnSaveMappings;
    const orig = btn.textContent;
    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';
      const apiBase = getApiBase();
      let saved = 0, errors = 0;
      for (const [qboBudgetId, ngmProjectId] of changes) {
        try {
          const b = qboBudgetPreview.find(x => x.qbo_budget_id === qboBudgetId);
          if (ngmProjectId) {
            await apiJson(`${apiBase}/qbo/budgets/mapping`, {
              method: 'POST',
              body: JSON.stringify({ qbo_budget_id: qboBudgetId, qbo_budget_name: b?.qbo_budget_name || '', qbo_fiscal_year: b?.qbo_fiscal_year || null, ngm_project_id: ngmProjectId })
            });
          } else {
            await apiJson(`${apiBase}/qbo/budgets/mapping/${qboBudgetId}`, {
              method: 'PUT',
              body: JSON.stringify({ ngm_project_id: null })
            });
          }
          saved++;
        } catch { errors++; }
      }
      if (window.Toast) {
        if (errors > 0) Toast.warning('Partial Save', `Saved ${saved} mappings, ${errors} failed.`);
        else Toast.success('Mappings Saved', `Successfully saved ${saved} mappings.`);
      }
      closeMappingModal();
    } catch (err) {
      console.error('[PB] Save mappings error:', err);
      if (window.Toast) Toast.error('Save Failed', 'Error saving mappings.', { details: err.message });
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  async function autoMatchBudgets() {
    if (!qboConnected || !qboRealmId) return;
    const btn = els.btnAutoMatch;
    const orig = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = 'Matching...';
      const result = await apiJson(`${getApiBase()}/qbo/budgets/mapping/auto-match?realm_id=${qboRealmId}`, { method: 'POST' });
      if (window.Toast) Toast.success('Auto-Match Complete', `Matched ${result.matched || 0} budgets to projects.`);
      await loadBudgetPreview();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('[PB] Auto-match error:', err);
      if (window.Toast) Toast.error('Auto-Match Failed', err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }

  // ── Event Listeners ──────────────────────────────────────────────

  function attachEvents() {
    if (_eventsAttached) return;
    _eventsAttached = true;

    els.projectFilter?.addEventListener('change', async e => {
      selectedProjectId = e.target.value;
      const opt = e.target.options[e.target.selectedIndex];
      selectedProjectName = opt ? opt.textContent : '';

      // Sync shared state
      if (window.ProjectsPage?.setSharedProject) {
        window.ProjectsPage.setSharedProject(selectedProjectId);
      }

      if (els.btnImportCSV) els.btnImportCSV.disabled = !selectedProjectId;
      updateQBOButtonState();

      if (selectedProjectId) await loadBudgetsByProject(selectedProjectId);
      else { budgets = []; showEmptyState('Select a project to view budgets'); }
    });

    els.btnImportCSV?.addEventListener('click', openImportModal);
    els.btnImportQBO?.addEventListener('click', importFromQBO);
    els.btnQBOMapping?.addEventListener('click', openMappingModal);

    // CSV modal
    els.btnCloseImport?.addEventListener('click', closeImportModal);
    els.btnCancelImport?.addEventListener('click', closeImportModal);
    els.importModal?.addEventListener('click', e => { if (e.target === els.importModal) closeImportModal(); });
    els.btnSelectFile?.addEventListener('click', () => els.csvFileInput?.click());
    els.csvFileInput?.addEventListener('change', handleCSVFileSelect);
    els.btnConfirmImport?.addEventListener('click', importCSV);
    document.getElementById('pb-btnImportFromEmpty')?.addEventListener('click', openImportModal);

    // QBO mapping modal
    els.btnCloseMapping?.addEventListener('click', closeMappingModal);
    els.btnCancelMapping?.addEventListener('click', closeMappingModal);
    els.mappingModal?.addEventListener('click', e => { if (e.target === els.mappingModal) closeMappingModal(); });
    els.btnSaveMappings?.addEventListener('click', saveMappings);
    els.btnAutoMatch?.addEventListener('click', autoMatchBudgets);

    // Search
    els.searchInput?.addEventListener('input', e => filterTable(e.target.value.toLowerCase().trim()));
  }

  // ── Public API ───────────────────────────────────────────────────

  async function load() {
    if (_loaded) return;
    _loaded = true;

    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    cacheElements();
    attachEvents();
    populateProjectDropdown();

    // Disable import buttons until project is selected
    if (els.btnImportCSV) els.btnImportCSV.disabled = true;

    // Check QBO connection
    await checkQBOConnection();
    updateQBOButtonState();

    showEmptyState('Select a project to view budgets');
  }

  function unload() {
    _loaded = false;
    if (_abortController) { _abortController.abort(); _abortController = null; }
    // Reset state
    budgets = [];
    selectedProjectId = null;
    selectedProjectName = '';
    currentCSVFile = null;
    parsedCSVData = null;
    qboBudgetPreview = [];
    pendingMappingChanges = {};
  }

  function selectProject(projectId) {
    if (!els.projectFilter) return;
    const optExists = Array.from(els.projectFilter.options).some(o => o.value === String(projectId));
    if (optExists) {
      els.projectFilter.value = projectId;
      els.projectFilter.dispatchEvent(new Event('change'));
    }
  }

  return { load, unload, selectProject };
})();
