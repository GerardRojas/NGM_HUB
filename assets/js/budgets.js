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

  // DOM Elements
  const els = {
    projectFilter: null,
    loadingState: null,
    emptyState: null,
    content: null,
    budgetsTable: null,
    budgetsTableBody: null,
    globalSearch: null,
    btnImportCSV: null,
    importModal: null,
    csvFileInput: null,
    csvPreview: null,
    csvPreviewContent: null,
    csvPreviewStats: null,
    selectedProjectName: null,
    btnCloseImportModal: null,
    btnCancelImport: null,
    btnConfirmImport: null
  };

  // ================================
  // HELPERS
  // ================================
  function getApiBase() {
    return window.API_BASE || 'https://ngm-fastapi.onrender.com';
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: 'include', ...options });
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
    els.loadingState = document.getElementById('budgetsLoadingState');
    els.emptyState = document.getElementById('budgetsEmptyState');
    els.content = document.getElementById('budgetsContent');
    els.budgetsTable = document.getElementById('budgetsTable');
    els.budgetsTableBody = document.getElementById('budgetsTableBody');
    els.globalSearch = document.getElementById('globalSearch');
    els.btnImportCSV = document.getElementById('btnImportCSV');
    els.importModal = document.getElementById('importCSVModal');
    els.csvFileInput = document.getElementById('csvFileInput');
    els.csvPreview = document.getElementById('csvPreview');
    els.csvPreviewContent = document.getElementById('csvPreviewContent');
    els.csvPreviewStats = document.getElementById('csvPreviewStats');
    els.selectedProjectName = document.getElementById('selectedProjectName');
    els.btnCloseImportModal = document.getElementById('btnCloseImportModal');
    els.btnCancelImport = document.getElementById('btnCancelImport');
    els.btnConfirmImport = document.getElementById('btnConfirmImport');
  }

  // ================================
  // UI STATE
  // ================================
  function showLoadingState(message = 'Loading budgets...') {
    els.loadingState.style.display = 'flex';
    els.loadingState.querySelector('.loading-text').textContent = message;
    els.emptyState.style.display = 'none';
    els.content.style.display = 'none';
  }

  function showEmptyState(message = 'Select a project to view budgets', showImportButton = false) {
    els.loadingState.style.display = 'none';
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
    els.loadingState.style.display = 'none';
    els.emptyState.style.display = 'none';
    els.content.style.display = 'block';
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
      alert('Error loading projects: ' + err.message);
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
      showLoadingState('Loading budgets...');

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
      alert('Please select a project first.');
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

  async function handleCSVFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      els.csvPreview.style.display = 'none';
      els.btnConfirmImport.disabled = true;
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB.');
      els.csvFileInput.value = '';
      return;
    }

    currentCSVFile = file;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      // Parse CSV
      const rows = lines.map(line => {
        // Simple CSV parser (handles quoted fields)
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return matches ? matches.map(field => field.replace(/^"|"$/g, '').trim()) : [];
      });

      if (rows.length < 2) {
        alert('CSV file must have at least a header row and one data row.');
        els.csvFileInput.value = '';
        return;
      }

      parsedCSVData = {
        headers: rows[0],
        data: rows.slice(1)
      };

      // Show preview
      const previewLines = rows.slice(0, 5); // First 5 rows
      const previewText = previewLines.map(row => row.join(', ')).join('\n');

      els.csvPreviewContent.textContent = previewText;
      els.csvPreviewStats.textContent = `📊 ${parsedCSVData.headers.length} columns × ${parsedCSVData.data.length} rows`;
      els.csvPreview.style.display = 'block';
      els.btnConfirmImport.disabled = false;

      console.log('[BUDGETS] Parsed CSV:', parsedCSVData);

    } catch (err) {
      console.error('[BUDGETS] Error parsing CSV:', err);
      alert('Error reading CSV file: ' + err.message);
      els.csvFileInput.value = '';
    }
  }

  async function importCSV() {
    if (!parsedCSVData || !selectedProjectId) {
      alert('No valid CSV data or project selected.');
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

      alert(`Successfully imported ${result.count || parsedCSVData.data.length} budget records!`);

      // Close modal and reload budgets
      closeImportModal();
      await loadBudgetsByProject(selectedProjectId);

    } catch (err) {
      console.error('[BUDGETS] Import error:', err);
      alert('Error importing CSV: ' + err.message);
    } finally {
      btnImport.disabled = false;
      btnImport.textContent = originalText;
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

      // Enable/disable import button based on project selection
      if (els.btnImportCSV) {
        if (selectedProjectId) {
          els.btnImportCSV.disabled = false;
        } else {
          els.btnImportCSV.disabled = true;
        }
      }

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

    // Disable import button initially (no project selected)
    if (els.btnImportCSV) {
      els.btnImportCSV.disabled = true;
    }

    // Load projects
    await loadProjects();

    // Show initial empty state
    showEmptyState('Select a project to view budgets');
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
