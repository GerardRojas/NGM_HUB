// assets/js/budgets.js
(function () {
  'use strict';

  // ================================
  // STATE
  // ================================
  let currentUser = null;
  let projects = [];
  let budgets = [];
  let selectedProjectId = null;
  let selectedProjectName = '';
  let currentCSVFile = null;
  let parsedCSVData = null;
  let qboConnected = false;
  let qboRealmId = null;
  let qboBudgetPreview = [];
  let pendingMappingChanges = {};

  // DOM Elements
  const els = {
    projectFilter: null,
    emptyState: null,
    content: null,
    budgetsTable: null,
    budgetsTableBody: null,
    globalSearch: null,
    btnImportCSV: null,
    btnImportQBO: null,
    importModal: null,
    csvFileInput: null,
    btnSelectFile: null,
    fileNameDisplay: null,
    csvPreview: null,
    csvPreviewContent: null,
    csvPreviewStats: null,
    selectedProjectName: null,
    btnCloseImportModal: null,
    btnCancelImport: null,
    btnConfirmImport: null,
    pageLoadingOverlay: null,
    // Mapping modal elements
    btnQBOMapping: null,
    qboMappingModal: null,
    btnCloseMappingModal: null,
    btnCancelMapping: null,
    btnSaveMappings: null,
    btnAutoMatch: null,
    mappingStats: null,
    mappingTableBody: null
  };

  // ================================
  // HELPERS
  // ================================
  function getApiBase() {
    return window.API_BASE || 'https://ngm-fastapi.onrender.com';
  }

  async function apiJson(url, options = {}) {
    const token = localStorage.getItem('ngmToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      credentials: 'include',
      ...options,
      headers
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      throw new Error(`${options.method || 'GET'} ${url} failed (${res.status}): ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  function formatCurrency(value) {
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) : value;
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch (e) {
      return dateStr;
    }
  }

  // ================================
  // AUTH
  // ================================
  function initAuth() {
    const userStr = localStorage.getItem('ngmUser');
    if (!userStr) {
      console.warn('[BUDGETS] No user found, redirecting to login');
      window.location.href = 'login.html';
      return false;
    }
    try {
      currentUser = JSON.parse(userStr);
      console.log('[BUDGETS] User:', currentUser);
      return true;
    } catch (e) {
      console.error('[BUDGETS] Error parsing user:', e);
      localStorage.removeItem('ngmUser');
      window.location.href = 'login.html';
      return false;
    }
  }

  // ================================
  // CACHE DOM ELEMENTS
  // ================================
  function cacheElements() {
    els.projectFilter = document.getElementById('projectFilter');
    els.emptyState = document.getElementById('budgetsEmptyState');
    els.pageLoadingOverlay = document.getElementById('pageLoadingOverlay');
    els.content = document.getElementById('budgetsContent');
    els.budgetsTable = document.getElementById('budgetsTable');
    els.budgetsTableBody = document.getElementById('budgetsTableBody');
    els.globalSearch = document.getElementById('globalSearch');
    els.btnImportCSV = document.getElementById('btnImportCSV');
    els.btnImportQBO = document.getElementById('btnImportQBO');
    els.importModal = document.getElementById('importCSVModal');
    els.csvFileInput = document.getElementById('csvFileInput');
    els.btnSelectFile = document.getElementById('btnSelectFile');
    els.fileNameDisplay = document.getElementById('fileNameDisplay');
    els.csvPreview = document.getElementById('csvPreview');
    els.csvPreviewContent = document.getElementById('csvPreviewContent');
    els.csvPreviewStats = document.getElementById('csvPreviewStats');
    els.selectedProjectName = document.getElementById('selectedProjectName');
    els.btnCloseImportModal = document.getElementById('btnCloseImportModal');
    els.btnCancelImport = document.getElementById('btnCancelImport');
    els.btnConfirmImport = document.getElementById('btnConfirmImport');
    // Mapping modal
    els.btnQBOMapping = document.getElementById('btnQBOMapping');
    els.qboMappingModal = document.getElementById('qboMappingModal');
    els.btnCloseMappingModal = document.getElementById('btnCloseMappingModal');
    els.btnCancelMapping = document.getElementById('btnCancelMapping');
    els.btnSaveMappings = document.getElementById('btnSaveMappings');
    els.btnAutoMatch = document.getElementById('btnAutoMatch');
    els.mappingStats = document.getElementById('mappingStats');
    els.mappingTableBody = document.getElementById('mappingTableBody');
  }

  // ================================
  // UI STATE
  // ================================
  function showEmptyState(message = 'Select a project to view budgets', showImportButton = false) {
    els.emptyState.style.display = 'flex';

    const messageEl = document.getElementById('emptyStateMessage');
    if (messageEl) messageEl.textContent = message;

    const importBtn = document.getElementById('btnImportFromEmpty');
    if (importBtn) {
      importBtn.style.display = showImportButton ? 'inline-block' : 'none';
    }

    els.content.style.display = 'none';
  }

  function hideEmptyState() {
    els.emptyState.style.display = 'none';
    els.content.style.display = 'block';
  }

  function hidePageLoading() {
    document.body.classList.remove('page-loading');
    document.body.classList.add('auth-ready');
    if (els.pageLoadingOverlay) {
      els.pageLoadingOverlay.classList.add('hidden');
    }
  }

  // ================================
  // LOAD PROJECTS
  // ================================
  async function loadProjects() {
    const apiBase = getApiBase();
    try {
      const url = `${apiBase}/projects`;
      console.log('[BUDGETS] Fetching projects from:', url);

      const result = await apiJson(url);
      console.log('[BUDGETS] Projects response:', result);

      if (Array.isArray(result)) {
        projects = result;
      } else if (result && Array.isArray(result.data)) {
        projects = result.data;
      } else if (result && Array.isArray(result.projects)) {
        projects = result.projects;
      } else {
        projects = [];
      }

      console.log('[BUDGETS] Loaded projects:', projects.length);
      populateProjectDropdown();
    } catch (err) {
      console.error('[BUDGETS] Error loading projects:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading projects.', { details: err.message });
      }
    }
  }

  function populateProjectDropdown() {
    if (!els.projectFilter) return;

    // Clear existing options except the first one
    els.projectFilter.innerHTML = '<option value="">Select a project...</option>';

    projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.project_id || p.id;
      opt.textContent = p.project_name || p.name || 'Unnamed Project';
      els.projectFilter.appendChild(opt);
    });
  }

  // ================================
  // LOAD BUDGETS BY PROJECT
  // ================================
  async function loadBudgetsByProject(projectId) {
    if (!projectId) {
      budgets = [];
      showEmptyState('Select a project to view budgets');
      return;
    }

    const apiBase = getApiBase();

    try {
      const url = `${apiBase}/budgets?project=${projectId}`;
      console.log('[BUDGETS] Fetching from:', url);

      const result = await apiJson(url);
      console.log('[BUDGETS] API Response:', result);

      // Handle different response formats
      if (Array.isArray(result)) {
        budgets = result;
      } else if (result && Array.isArray(result.data)) {
        budgets = result.data;
      } else if (result && Array.isArray(result.budgets)) {
        budgets = result.budgets;
      } else {
        budgets = [];
      }

      console.log('[BUDGETS] Processed budgets count:', budgets.length);

      if (budgets.length === 0) {
        showEmptyState('No budgets have been loaded for this project yet.', true);
      } else {
        renderBudgetsTable();
      }

    } catch (err) {
      console.error('[BUDGETS] Error loading budgets:', err);
      showEmptyState('Error loading budgets: ' + err.message);
    }
  }

  // ================================
  // RENDER TABLE
  // ================================
  function renderBudgetsTable() {
    if (!budgets || budgets.length === 0) {
      showEmptyState('No budgets loaded for this project yet.');
      return;
    }

    hideEmptyState();

    const rows = budgets.map(budget => renderBudgetRow(budget)).join('');

    // Calculate total
    const total = budgets.reduce((sum, b) => sum + (parseFloat(b.amount_sum) || 0), 0);
    const totalRow = `
      <tr class="table-total-row">
        <td colspan="3" style="text-align: right; font-weight: 600;">Total Budget:</td>
        <td style="font-weight: 700; color: #22c55e;">$${formatCurrency(total)}</td>
        <td colspan="4"></td>
      </tr>
    `;

    els.budgetsTableBody.innerHTML = rows + totalRow;
  }

  function renderBudgetRow(budget) {
    const isActive = budget.active === true || budget.active === 'true' || budget.active === 1;
    const statusClass = isActive ? 'status-badge-success' : 'status-badge-inactive';
    const statusText = isActive ? 'Active' : 'Inactive';

    return `
      <tr data-budget-id="${budget.id}">
        <td>${budget.budget_name || '—'}</td>
        <td>${budget.year || '—'}</td>
        <td>${budget.account_name || '—'}</td>
        <td style="text-align: right; font-weight: 600;">$${formatCurrency(budget.amount_sum)}</td>
        <td>${formatDate(budget.start_date)}</td>
        <td>${formatDate(budget.end_date)}</td>
        <td style="text-align: center;">${budget.lines_count || 0}</td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
      </tr>
    `;
  }

  // ================================
  // IMPORT CSV MODAL
  // ================================
  function openImportModal() {
    if (!selectedProjectId) {
      if (window.Toast) {
        Toast.warning('No Project', 'Please select a project first.');
      }
      return;
    }

    // Display selected project name
    els.selectedProjectName.textContent = selectedProjectName;

    // Reset file input
    els.csvFileInput.value = '';
    els.csvPreview.style.display = 'none';
    els.btnConfirmImport.disabled = true;
    currentCSVFile = null;
    parsedCSVData = null;

    els.importModal.classList.remove('hidden');
  }

  function closeImportModal() {
    els.importModal.classList.add('hidden');
  }

  // ================================
  // CSV SANITIZATION & PARSING
  // ================================

  /**
   * Sanitize and parse CSV text
   * Handles:
   * - Different line endings (CRLF, LF, CR)
   * - Quoted fields with commas inside
   * - Empty lines
   * - BOM (Byte Order Mark)
   * - Escaped quotes
   */
  function sanitizeAndParseCSV(csvText) {
    // Remove BOM if present (common in Excel exports)
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.slice(1);
    }

    // Normalize line endings to \n
    csvText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Split into lines and remove empty lines
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse each line respecting quoted fields
    const rows = lines.map(line => parseCSVLine(line));

    // Filter out completely empty rows
    const validRows = rows.filter(row => row.some(cell => cell.trim() !== ''));

    return validRows;
  }

  /**
   * Parse a single CSV line
   * Properly handles:
   * - Quoted fields: "value, with comma"
   * - Escaped quotes: "value with ""quotes"""
   * - Mixed quoted and unquoted fields
   */
  function parseCSVLine(line) {
    const result = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote: "" becomes "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote mode
          insideQuotes = !insideQuotes;
          i++;
          continue;
        }
      }

      if (char === ',' && !insideQuotes) {
        // End of field
        result.push(currentField.trim());
        currentField = '';
        i++;
        continue;
      }

      // Regular character
      currentField += char;
      i++;
    }

    // Push the last field
    result.push(currentField.trim());

    return result;
  }

  /**
   * Validate CSV structure
   * Checks:
   * - Minimum number of rows
   * - Consistent column count
   * - Required headers present
   */
  function validateCSVStructure(rows, requiredHeaders = []) {
    if (rows.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row.');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Check for consistent column count
    const headerCount = headers.length;
    const inconsistentRows = dataRows.filter(row => row.length !== headerCount);

    if (inconsistentRows.length > 0) {
      console.warn(`[BUDGETS] Found ${inconsistentRows.length} rows with inconsistent column count`);
      // We'll allow this but warn the user
    }

    // Check for required headers (case-insensitive)
    if (requiredHeaders.length > 0) {
      const headerLower = headers.map(h => h.toLowerCase().trim());
      const missingHeaders = requiredHeaders.filter(required =>
        !headerLower.some(h => h === required.toLowerCase())
      );

      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
      }
    }

    return {
      isValid: true,
      headers: headers,
      dataRows: dataRows,
      rowCount: dataRows.length,
      columnCount: headerCount
    };
  }

  async function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      els.csvPreview.style.display = 'none';
      els.btnConfirmImport.disabled = true;
      if (els.fileNameDisplay) {
        els.fileNameDisplay.textContent = 'No file selected';
        els.fileNameDisplay.classList.remove('has-file');
      }
      return;
    }

    // Update file name display
    if (els.fileNameDisplay) {
      els.fileNameDisplay.textContent = file.name;
      els.fileNameDisplay.classList.add('has-file');
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      if (window.Toast) {
        Toast.error('Invalid File', 'Please select a CSV file.');
      }
      els.csvFileInput.value = '';
      if (els.fileNameDisplay) {
        els.fileNameDisplay.textContent = 'No file selected';
        els.fileNameDisplay.classList.remove('has-file');
      }
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      if (window.Toast) {
        Toast.error('File Too Large', 'Maximum size is 5MB.');
      }
      els.csvFileInput.value = '';
      if (els.fileNameDisplay) {
        els.fileNameDisplay.textContent = 'No file selected';
        els.fileNameDisplay.classList.remove('has-file');
      }
      return;
    }

    currentCSVFile = file;

    try {
      // Read file content
      const text = await file.text();

      // Sanitize and parse CSV
      const rows = sanitizeAndParseCSV(text);

      // Validate structure
      const requiredHeaders = ['BudgetName', 'BudgetId', 'Amount_SUM'];
      const validation = validateCSVStructure(rows, requiredHeaders);

      console.log('[BUDGETS] CSV validation:', validation);

      // Store parsed data
      parsedCSVData = {
        headers: validation.headers,
        data: validation.dataRows
      };

      // Show preview (first 5 rows)
      const previewRows = rows.slice(0, Math.min(6, rows.length)); // Headers + 5 data rows
      const previewText = previewRows.map(row => row.join(', ')).join('\n');

      els.csvPreviewContent.textContent = previewText;
      els.csvPreviewStats.textContent = `📊 ${validation.columnCount} columns × ${validation.rowCount} data rows`;
      els.csvPreview.style.display = 'block';
      els.btnConfirmImport.disabled = false;

      console.log('[BUDGETS] Successfully parsed CSV:', {
        headers: parsedCSVData.headers,
        rowCount: parsedCSVData.data.length,
        preview: parsedCSVData.data.slice(0, 3)
      });

    } catch (err) {
      console.error('[BUDGETS] Error parsing CSV:', err);
      if (window.Toast) {
        Toast.error('Parse Error', 'Error reading CSV file.', { details: err.message });
      }
      els.csvFileInput.value = '';
      els.csvPreview.style.display = 'none';
      els.btnConfirmImport.disabled = true;
    }
  }

  async function importCSV() {
    if (!parsedCSVData || !selectedProjectId) {
      if (window.Toast) {
        Toast.warning('Missing Data', 'No valid CSV data or project selected.');
      }
      return;
    }

    const btnImport = els.btnConfirmImport;
    const originalText = btnImport.textContent;

    try {
      btnImport.disabled = true;
      btnImport.textContent = 'Importing...';

      console.log('[BUDGETS] Importing CSV for project:', selectedProjectId);

      const apiBase = getApiBase();
      const url = `${apiBase}/budgets/import`;

      const result = await apiJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProjectId,
          headers: parsedCSVData.headers,
          data: parsedCSVData.data
        })
      });

      console.log('[BUDGETS] Import result:', result);

      if (window.Toast) {
        Toast.success('Import Complete', `Successfully imported ${result.count || parsedCSVData.data.length} budget records!`);
      }

      // Close modal and reload budgets
      closeImportModal();
      await loadBudgetsByProject(selectedProjectId);

    } catch (err) {
      console.error('[BUDGETS] Import error:', err);
      if (window.Toast) {
        Toast.error('Import Failed', 'Error importing CSV.', { details: err.message });
      }
    } finally {
      btnImport.disabled = false;
      btnImport.textContent = originalText;
    }
  }

  // ================================
  // QBO INTEGRATION
  // ================================

  /**
   * Check if QuickBooks is connected and get realm_id
   */
  async function checkQBOConnection() {
    const apiBase = getApiBase();
    try {
      const status = await apiJson(`${apiBase}/qbo/status`);
      console.log('[BUDGETS] QBO status:', status);

      if (status.connected && status.connections && status.connections.length > 0) {
        // Use the first active connection
        const activeConnection = status.connections.find(c => c.access_token_valid || c.refresh_token_valid);
        if (activeConnection) {
          qboConnected = true;
          qboRealmId = activeConnection.realm_id;
          console.log('[BUDGETS] QBO connected, realm_id:', qboRealmId);
          return true;
        }
      }

      qboConnected = false;
      qboRealmId = null;
      return false;
    } catch (err) {
      console.error('[BUDGETS] Error checking QBO connection:', err);
      qboConnected = false;
      qboRealmId = null;
      return false;
    }
  }

  /**
   * Update QBO button states based on connection status
   */
  function updateQBOButtonState() {
    // Import button - requires only connection (uses mappings)
    if (els.btnImportQBO) {
      els.btnImportQBO.disabled = !qboConnected;

      if (!qboConnected) {
        els.btnImportQBO.title = 'Connect to QuickBooks in Settings first';
      } else {
        els.btnImportQBO.title = 'Import mapped budgets from QuickBooks';
      }
    }

    // Mapping button - only requires connection
    if (els.btnQBOMapping) {
      els.btnQBOMapping.disabled = !qboConnected;

      if (!qboConnected) {
        els.btnQBOMapping.title = 'Connect to QuickBooks in Settings first';
      } else {
        els.btnQBOMapping.title = 'Map QBO budgets to NGM projects';
      }
    }
  }

  /**
   * Import budgets from QuickBooks using established mappings.
   * QBO divides budgets into 12 months - the backend sums them.
   */
  async function importFromQBO() {
    if (!qboConnected || !qboRealmId) {
      if (window.Toast) {
        Toast.warning('Not Connected', 'Please connect to QuickBooks in Settings first.');
      }
      return;
    }

    const btn = els.btnImportQBO;
    const originalContent = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '⏳ Syncing...';

      const apiBase = getApiBase();

      // Use sync-mapped endpoint which imports based on mappings
      const url = `${apiBase}/qbo/budgets/sync-mapped/${qboRealmId}`;

      console.log('[BUDGETS] Syncing mapped QBO budgets:', url);

      const result = await apiJson(url, { method: 'POST' });

      console.log('[BUDGETS] QBO sync result:', result);

      if (result.total_imported > 0) {
        if (window.Toast) {
          Toast.success(
            'Import Complete',
            `Imported ${result.total_imported} budget lines to ${result.projects_updated} projects.`
          );
        }

        // Reload budgets table if a project is selected
        if (selectedProjectId) {
          await loadBudgetsByProject(selectedProjectId);
        }
      } else {
        if (window.Toast) {
          Toast.warning(
            'No Mapped Budgets',
            'No mapped budgets to import. Use "QBO Mapping" to map budgets to projects first.'
          );
        }
      }

    } catch (err) {
      console.error('[BUDGETS] QBO import error:', err);
      if (window.Toast) {
        Toast.error('Import Failed', 'Error importing from QuickBooks.', { details: err.message });
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
      updateQBOButtonState();
    }
  }

  // ================================
  // QBO BUDGET MAPPING
  // ================================

  /**
   * Open the QBO budget mapping modal
   */
  async function openMappingModal() {
    if (!qboConnected || !qboRealmId) {
      if (window.Toast) {
        Toast.warning('Not Connected', 'Please connect to QuickBooks in Settings first.');
      }
      return;
    }

    // Reset state
    pendingMappingChanges = {};
    qboBudgetPreview = [];

    // Show modal
    els.qboMappingModal.classList.remove('hidden');

    // Load preview data
    await loadBudgetPreview();
  }

  /**
   * Close the mapping modal
   */
  function closeMappingModal() {
    els.qboMappingModal.classList.add('hidden');
    pendingMappingChanges = {};
  }

  /**
   * Load budget preview from QBO
   */
  async function loadBudgetPreview() {
    const apiBase = getApiBase();

    try {
      els.mappingStats.textContent = 'Loading budgets from QuickBooks...';
      els.mappingTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: #9ca3af;">Loading...</td></tr>';

      const result = await apiJson(`${apiBase}/qbo/budgets/preview/${qboRealmId}`);
      console.log('[BUDGETS] Preview result:', result);

      qboBudgetPreview = result.data || [];

      // Update stats
      els.mappingStats.innerHTML = `
        <span style="color: #22c55e;">${result.mapped_count || 0} mapped</span> ·
        <span style="color: #f59e0b;">${result.unmapped_count || 0} unmapped</span> ·
        ${result.count || 0} total
      `;

      // Render table
      renderMappingTable();

    } catch (err) {
      console.error('[BUDGETS] Error loading preview:', err);
      els.mappingStats.textContent = 'Error loading budgets';
      els.mappingTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #ef4444;">Error: ${err.message}</td></tr>`;
    }
  }

  /**
   * Render the mapping table
   */
  function renderMappingTable() {
    if (!qboBudgetPreview.length) {
      els.mappingTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 24px; color: #9ca3af;">No budgets found in QuickBooks</td></tr>';
      return;
    }

    const rows = qboBudgetPreview.map(budget => {
      const statusClass = budget.is_mapped ? 'status-badge-success' : 'status-badge-warning';
      const statusText = budget.is_mapped ? 'Mapped' : 'Unmapped';

      // Get current selection (from pending changes or original)
      const currentProjectId = pendingMappingChanges[budget.qbo_budget_id] !== undefined
        ? pendingMappingChanges[budget.qbo_budget_id]
        : (budget.ngm_project_id || '');

      // Build project options
      const projectOptions = projects.map(p => {
        const projectId = p.project_id || p.id;
        const projectName = p.project_name || p.name || 'Unnamed';
        const selected = projectId === currentProjectId ? 'selected' : '';
        return `<option value="${projectId}" ${selected}>${projectName}</option>`;
      }).join('');

      return `
        <tr data-qbo-budget-id="${budget.qbo_budget_id}">
          <td>
            <div style="font-weight: 500;">${budget.qbo_budget_name || 'Unnamed'}</div>
            ${budget.auto_matched ? '<span style="font-size: 11px; color: #a78bfa;">✨ auto-matched</span>' : ''}
          </td>
          <td>${budget.qbo_fiscal_year || '—'}</td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>
            <select class="ngm-select mapping-select" data-qbo-budget-id="${budget.qbo_budget_id}" data-budget-name="${budget.qbo_budget_name || ''}" data-fiscal-year="${budget.qbo_fiscal_year || ''}">
              <option value="">— Select Project —</option>
              ${projectOptions}
            </select>
          </td>
        </tr>
      `;
    }).join('');

    els.mappingTableBody.innerHTML = rows;

    // Add change listeners to selects
    els.mappingTableBody.querySelectorAll('.mapping-select').forEach(select => {
      select.addEventListener('change', handleMappingChange);
    });
  }

  /**
   * Handle mapping dropdown change
   */
  function handleMappingChange(e) {
    const select = e.target;
    const qboBudgetId = select.dataset.qboBudgetId;
    const newProjectId = select.value;

    // Track change
    pendingMappingChanges[qboBudgetId] = newProjectId || null;

    console.log('[BUDGETS] Mapping change:', qboBudgetId, '→', newProjectId);
  }

  /**
   * Save all pending mapping changes
   */
  async function saveMappings() {
    const changes = Object.entries(pendingMappingChanges);

    if (changes.length === 0) {
      if (window.Toast) {
        Toast.info('No Changes', 'No mapping changes to save.');
      }
      closeMappingModal();
      return;
    }

    const btn = els.btnSaveMappings;
    const originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const apiBase = getApiBase();
      let savedCount = 0;
      let errorCount = 0;

      for (const [qboBudgetId, ngmProjectId] of changes) {
        try {
          // Find budget info
          const budget = qboBudgetPreview.find(b => b.qbo_budget_id === qboBudgetId);

          if (ngmProjectId) {
            // Create or update mapping
            await apiJson(`${apiBase}/qbo/budgets/mapping`, {
              method: 'POST',
              body: JSON.stringify({
                qbo_budget_id: qboBudgetId,
                qbo_budget_name: budget?.qbo_budget_name || '',
                qbo_fiscal_year: budget?.qbo_fiscal_year || null,
                ngm_project_id: ngmProjectId
              })
            });
          } else {
            // Clear mapping (set to null via update)
            await apiJson(`${apiBase}/qbo/budgets/mapping/${qboBudgetId}`, {
              method: 'PUT',
              body: JSON.stringify({ ngm_project_id: null })
            });
          }
          savedCount++;
        } catch (err) {
          console.error(`[BUDGETS] Error saving mapping for ${qboBudgetId}:`, err);
          errorCount++;
        }
      }

      if (window.Toast) {
        if (errorCount > 0) {
          Toast.warning('Partial Save', `Saved ${savedCount} mappings, ${errorCount} failed.`);
        } else {
          Toast.success('Mappings Saved', `Successfully saved ${savedCount} mappings.`);
        }
      }

      closeMappingModal();

    } catch (err) {
      console.error('[BUDGETS] Error saving mappings:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving mappings.', { details: err.message });
      }
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  /**
   * Auto-match budgets to projects by name
   */
  async function autoMatchBudgets() {
    if (!qboConnected || !qboRealmId) return;

    const btn = els.btnAutoMatch;
    const originalText = btn.innerHTML;

    try {
      btn.disabled = true;
      btn.innerHTML = '⏳ Matching...';

      const apiBase = getApiBase();
      const result = await apiJson(`${apiBase}/qbo/budgets/mapping/auto-match?realm_id=${qboRealmId}`, {
        method: 'POST'
      });

      console.log('[BUDGETS] Auto-match result:', result);

      if (window.Toast) {
        Toast.success('Auto-Match Complete', `Matched ${result.matched || 0} budgets to projects.`);
      }

      // Reload preview
      await loadBudgetPreview();

    } catch (err) {
      console.error('[BUDGETS] Auto-match error:', err);
      if (window.Toast) {
        Toast.error('Auto-Match Failed', err.message);
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // ================================
  // EVENT LISTENERS
  // ================================
  function setupEventListeners() {
    // Project filter change
    els.projectFilter?.addEventListener('change', async (e) => {
      selectedProjectId = e.target.value;

      // Get selected project name
      const selectedOption = e.target.options[e.target.selectedIndex];
      selectedProjectName = selectedOption.textContent;

      console.log('[BUDGETS] Project selected:', selectedProjectId, selectedProjectName);

      // Enable/disable import buttons based on project selection
      if (els.btnImportCSV) {
        els.btnImportCSV.disabled = !selectedProjectId;
      }
      updateQBOButtonState();

      if (selectedProjectId) {
        await loadBudgetsByProject(selectedProjectId);
      } else {
        budgets = [];
        showEmptyState('Select a project to view budgets');
      }
    });

    // Import CSV button
    els.btnImportCSV?.addEventListener('click', () => {
      openImportModal();
    });

    // Import from QBO button
    els.btnImportQBO?.addEventListener('click', () => {
      importFromQBO();
    });

    // QBO Mapping button
    els.btnQBOMapping?.addEventListener('click', () => {
      openMappingModal();
    });

    // Mapping modal - close buttons
    els.btnCloseMappingModal?.addEventListener('click', closeMappingModal);
    els.btnCancelMapping?.addEventListener('click', closeMappingModal);

    // Mapping modal - backdrop close
    els.qboMappingModal?.addEventListener('click', (e) => {
      if (e.target === els.qboMappingModal) {
        closeMappingModal();
      }
    });

    // Mapping modal - save button
    els.btnSaveMappings?.addEventListener('click', saveMappings);

    // Mapping modal - auto-match button
    els.btnAutoMatch?.addEventListener('click', autoMatchBudgets);

    // Import CSV button from empty state
    document.getElementById('btnImportFromEmpty')?.addEventListener('click', () => {
      openImportModal();
    });

    // Import modal - close buttons
    els.btnCloseImportModal?.addEventListener('click', closeImportModal);
    els.btnCancelImport?.addEventListener('click', closeImportModal);

    // Import modal - backdrop close
    els.importModal?.addEventListener('click', (e) => {
      if (e.target === els.importModal) {
        closeImportModal();
      }
    });

    // File select button (triggers hidden file input)
    els.btnSelectFile?.addEventListener('click', () => {
      els.csvFileInput?.click();
    });

    // CSV file input
    els.csvFileInput?.addEventListener('change', handleCSVFileSelect);

    // Confirm import button
    els.btnConfirmImport?.addEventListener('click', importCSV);

    // Global search (placeholder for now)
    els.globalSearch?.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      console.log('[BUDGETS] Search term:', term);
      // TODO: Implement search filtering
    });
  }

  // ================================
  // INIT
  // ================================
  async function init() {
    // Check auth first
    if (!initAuth()) return;

    // Cache DOM elements
    cacheElements();

    // Setup event listeners
    setupEventListeners();

    // Initialize topbar pills (environment, server status, user)
    if (typeof window.initTopbarPills === 'function') {
      await window.initTopbarPills();
    }

    // Disable import buttons initially (no project selected)
    if (els.btnImportCSV) {
      els.btnImportCSV.disabled = true;
    }
    if (els.btnImportQBO) {
      els.btnImportQBO.disabled = true;
    }
    if (els.btnQBOMapping) {
      els.btnQBOMapping.disabled = true;
    }

    // Check QBO connection status
    await checkQBOConnection();
    updateQBOButtonState();

    // Load projects
    await loadProjects();

    // Show initial empty state and hide page loading
    showEmptyState('Select a project to view budgets');
    hidePageLoading();
  }

  // ================================
  // START
  // ================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
