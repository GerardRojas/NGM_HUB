// assets/js/estimator.js
// NGM Estimator Suite - Main Module
(function() {
  'use strict';

  // ================================
  // CONFIG & STATE
  // ================================
  const API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';
  const SUPABASE_URL = window.SUPABASE_URL || 'https://xvyohmlqcxykfsdgjfjc.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

  // Bucket names
  const BUCKETS = {
    ESTIMATES: 'estimates',
    TEMPLATES: 'templates',
    MATERIALS_IMAGES: 'materials_images'
  };

  // Auto-save configuration
  const AUTOSAVE = {
    DEBOUNCE_MS: 1500,           // Wait 1.5s after last change before saving locally
    BACKEND_SYNC_MS: 60000,     // Sync to backend every 60 seconds
    LOCAL_STORAGE_KEY: 'ngm_estimator_draft',
    ENABLED: true
  };

  // ================================
  // AUTH HELPERS
  // ================================
  function getAuthHeaders() {
    const token = localStorage.getItem('ngmToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // State
  let supabaseClient = null;
  let currentEstimateData = null;
  let currentEstimateId = null;
  let currentProjectId = null;
  let isDirty = false; // Track unsaved changes

  // Auto-save state
  let autoSaveTimer = null;
  let backendSyncTimer = null;
  let lastSavedHash = null;
  let saveStatus = 'saved'; // 'saved', 'saving', 'pending', 'error'

  // UI State
  const groupState = {};  // Category collapse state
  const subState = {};    // Subcategory collapse state
  let currentFilter = '';

  // Template Cache - stores snapshots for concept picker
  let templateCache = {
    concepts: [],           // Snapshot of concepts from template/DB
    materials: [],          // Snapshot of materials from template/DB
    conceptMaterials: [],   // Snapshot of concept_materials junction
    lastRefreshed: null     // ISO timestamp of last refresh
  };

  // Add Concept Modal State
  let addConceptState = {
    selectedConcept: null,
    builderItems: [],
    mode: 'from-template'   // 'from-template' | 'create-new'
  };

  // Table row selection state: { catIndex, subIndex, itemIndex } or null
  let selectedRow = null;

  // DOM Elements cache
  const els = {};

  // ================================
  // INITIALIZATION
  // ================================
  function init() {
    console.log('[ESTIMATOR] Initializing...');

    // Initialize Supabase client
    initSupabase();

    // Cache DOM elements
    cacheElements();

    // Hide loading overlay and show main app directly (no template selection screen)
    hidePageLoading();
    document.getElementById('template-selection-screen')?.classList.add('hidden');
    document.getElementById('main-app-layout')?.style.setProperty('display', '');

    // Continue with full initialization
    continueInitialization();

    // Initialize topbar pills (environment, server status, user)
    if (typeof window.initTopbarPills === 'function') {
      window.initTopbarPills();
    }

    // Load last estimate or show empty state
    loadLastEstimateOrEmpty();

    console.log('[ESTIMATOR] Initialized');
  }

  /**
   * Load last saved estimate, or show empty state if none exist
   */
  async function loadLastEstimateOrEmpty() {
    if (els.statusEl) {
      els.statusEl.textContent = 'Loading estimates...';
    }

    try {
      const estimates = await loadEstimatesList();

      if (estimates && estimates.length > 0) {
        // Load the most recent estimate
        const latest = estimates[0];
        console.log('[ESTIMATOR] Loading last estimate:', latest.name || latest.id);
        await loadEstimate(latest.id || latest.name);
      } else {
        // No saved estimates - show empty state
        console.log('[ESTIMATOR] No estimates found, showing empty state');
        createBlankEstimate();
      }
    } catch (err) {
      console.error('[ESTIMATOR] Error loading estimates:', err);
      createBlankEstimate();
    }
  }

  /**
   * Continue initialization after template is selected
   */
  function continueInitialization() {
    console.log('[ESTIMATOR] Continuing initialization...');

    // Setup event listeners
    setupEventListeners();

    // Setup modals
    setupProjectInfoModal();
    setupColumnsModal();
    setupOverheadModal();
    setupSaveAsTemplateModal();
    setupTemplatePickerModal();
    setupAddConceptModal();

    // Setup view controls
    setupViewSliders();
    setupSearchFilter();

    // Setup auto-save
    setupAutoSave();

    // Load sidebar lists
    loadEstimatesList();
    loadTemplatesListFromStorage();

    console.log('[ESTIMATOR] Initialized');
  }

  function initSupabase() {
    if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('[ESTIMATOR] Supabase client initialized');
    } else {
      console.warn('[ESTIMATOR] Supabase not available - storage features disabled');
    }
  }

  // ================================
  // AUTO-SAVE SYSTEM
  // ================================

  function setupAutoSave() {
    if (!AUTOSAVE.ENABLED) return;

    // Save to localStorage before page unload
    window.addEventListener('beforeunload', () => {
      if (isDirty && currentEstimateData) {
        saveToLocalStorage();
      }
    });

    // Sync to backend periodically
    backendSyncTimer = setInterval(() => {
      if (isDirty && currentEstimateData) {
        syncToBackend();
      }
    }, AUTOSAVE.BACKEND_SYNC_MS);

    // Listen for visibility change - sync when user leaves tab
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && isDirty && currentEstimateData) {
        saveToLocalStorage();
        syncToBackend();
      }
    });

    console.log('[ESTIMATOR] Auto-save enabled');
  }

  /**
   * Mark data as changed and trigger auto-save
   */
  function markDirty() {
    isDirty = true;
    updateSaveStatus('pending');

    // Debounced save to localStorage
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    autoSaveTimer = setTimeout(() => {
      saveToLocalStorage();
    }, AUTOSAVE.DEBOUNCE_MS);
  }

  /**
   * Save current estimate to localStorage
   */
  function saveToLocalStorage() {
    if (!currentEstimateData || !AUTOSAVE.ENABLED) return;

    try {
      const draft = {
        data: currentEstimateData,
        estimateId: currentEstimateId,
        projectId: currentProjectId,
        savedAt: new Date().toISOString(),
        hash: generateDataHash(currentEstimateData)
      };

      localStorage.setItem(AUTOSAVE.LOCAL_STORAGE_KEY, JSON.stringify(draft));
      lastSavedHash = draft.hash;
      updateSaveStatus('saved');

      console.log('[ESTIMATOR] Auto-saved to localStorage');
    } catch (err) {
      console.error('[ESTIMATOR] localStorage save error:', err);
      updateSaveStatus('error');
    }
  }

  /**
   * Restore estimate from localStorage if available
   */
  function restoreFromLocalStorage() {
    if (!AUTOSAVE.ENABLED) return false;

    try {
      const saved = localStorage.getItem(AUTOSAVE.LOCAL_STORAGE_KEY);
      if (!saved) return false;

      const draft = JSON.parse(saved);

      // Check if draft is recent (less than 24 hours old)
      const savedAt = new Date(draft.savedAt);
      const now = new Date();
      const hoursSinceSave = (now - savedAt) / (1000 * 60 * 60);

      if (hoursSinceSave > 24) {
        console.log('[ESTIMATOR] Draft too old, discarding');
        localStorage.removeItem(AUTOSAVE.LOCAL_STORAGE_KEY);
        return false;
      }

      // Restore the data
      currentEstimateData = draft.data;
      currentEstimateId = draft.estimateId;
      currentProjectId = draft.projectId;
      lastSavedHash = draft.hash;
      isDirty = false;

      renderEstimate();
      updateSaveStatus('saved');

      const timeAgo = formatTimeAgo(savedAt);
      showFeedback(`Restored draft from ${timeAgo}`, 'info');
      console.log('[ESTIMATOR] Restored from localStorage');

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] localStorage restore error:', err);
      return false;
    }
  }

  /**
   * Sync current estimate to backend (less frequent)
   */
  async function syncToBackend() {
    if (!currentEstimateData || !isDirty) return;

    // Don't sync if no project name set
    if (!currentEstimateData.project_name || currentEstimateData.project_name === 'New Project') {
      return;
    }

    updateSaveStatus('saving');

    try {
      // Use lighter payload for auto-sync (no snapshots)
      const requestPayload = {
        estimate_id: currentEstimateId || null,
        project_name: currentEstimateData.project_name,
        project: currentEstimateData.project || {},
        categories: currentEstimateData.categories || [],
        overhead: currentEstimateData.overhead || { percentage: 0, amount: 0 },
        created_from_template: currentEstimateData.created_from_template || null
        // Note: No snapshots for auto-sync to keep it fast
      };

      const response = await fetch(`${API_BASE}/estimator/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(requestPayload)
      });

      if (response.ok) {
        const result = await response.json();
        currentEstimateId = result.estimate_id || currentEstimateId;
        currentEstimateData.estimate_id = currentEstimateId;
        isDirty = false;
        updateSaveStatus('saved');
        console.log('[ESTIMATOR] Synced to backend');
      } else {
        updateSaveStatus('error');
      }
    } catch (err) {
      console.error('[ESTIMATOR] Backend sync error:', err);
      updateSaveStatus('error');
    }
  }

  /**
   * Update save status indicator
   */
  function updateSaveStatus(status) {
    saveStatus = status;

    const statusEl = els.statusEl;
    if (!statusEl) return;

    const statusMap = {
      'saved': { text: 'All changes saved', class: 'status-saved' },
      'saving': { text: 'Saving...', class: 'status-saving' },
      'pending': { text: 'Unsaved changes', class: 'status-pending' },
      'error': { text: 'Save error', class: 'status-error' }
    };

    const info = statusMap[status] || statusMap.saved;
    statusEl.textContent = info.text;
    statusEl.className = `table-lock-label ${info.class}`;
  }

  /**
   * Generate a simple hash for data comparison
   */
  function generateDataHash(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Format time ago string
   */
  function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  /**
   * Clear the local storage draft
   */
  function clearLocalDraft() {
    localStorage.removeItem(AUTOSAVE.LOCAL_STORAGE_KEY);
    console.log('[ESTIMATOR] Local draft cleared');
  }

  function cacheElements() {
    // Main containers
    els.tbody = document.getElementById('estimator-body');
    els.statusEl = document.getElementById('estimator-status');
    els.feedbackEl = document.getElementById('estimator-feedback');

    // Project info elements
    els.projectTitleText = document.getElementById('project-title-text');
    els.projectSubtitle = document.getElementById('project-subtitle');

    // Summary elements (sidebar)
    els.summaryProject = document.getElementById('summary-project');
    els.summarySubtotal = document.getElementById('summary-subtotal');
    els.summaryTotal = document.getElementById('summary-total');
    els.summaryOverhead = document.getElementById('summary-overhead');
    els.summaryDate = document.getElementById('summary-date');

    // Toolbar buttons
    els.btnNewEstimate = document.getElementById('btn-new-estimate');
    els.btnAddConcept = document.getElementById('btn-add-concept');
    els.btnOverhead = document.getElementById('btn-overhead');
    els.btnImportRevit = document.getElementById('btn-import-revit');
    els.btnExport = document.getElementById('btn-export');
    els.btnColumns = document.getElementById('btn-columns');
    els.btnRefreshCatalog = document.getElementById('btn-refresh-catalog');
    els.btnSave = document.getElementById('btn-save');
    els.btnSaveAsTemplate = document.getElementById('btn-save-as-template');

    // View controls
    els.widthSlider = document.getElementById('table-width-slider');
    els.zoomSlider = document.getElementById('table-zoom-slider');
    els.searchInput = document.getElementById('estimator-search-input');

    // Files list (sidebar)
    els.filesList = document.getElementById('estimator-files-list');
    els.templatesList = document.getElementById('estimator-templates-list');

    // Modals
    els.projectModal = document.getElementById('project-modal');
    els.columnsModal = document.getElementById('columns-modal');
    els.overheadModal = document.getElementById('overhead-modal');
    els.saveAsTemplateModal = document.getElementById('save-as-template-modal');
    els.templatePickerModal = document.getElementById('template-picker-modal');
    els.addConceptModal = document.getElementById('add-concept-modal');
  }

  function setupEventListeners() {
    // Toolbar buttons
    els.btnNewEstimate?.addEventListener('click', handleNewEstimate);
    els.btnAddConcept?.addEventListener('click', handleAddConcept);
    els.btnOverhead?.addEventListener('click', handleOverhead);
    els.btnImportRevit?.addEventListener('click', handleImportRevit);
    els.btnExport?.addEventListener('click', handleExport);
    els.btnSave?.addEventListener('click', handleSave);
    els.btnSaveAsTemplate?.addEventListener('click', openSaveAsTemplateModal);

    // Project info button
    document.getElementById('project-info-btn')?.addEventListener('click', openProjectModal);

    // Sidebar file lists - delegated click handlers (survive re-renders)
    els.filesList?.addEventListener('click', (e) => {
      const li = e.target.closest('.estimator-file[data-estimate-id]');
      if (!li) return;
      const estimateId = li.dataset.estimateId;
      if (isDirty) {
        const ok = window.confirm('You have unsaved changes. Load estimate anyway?');
        if (!ok) return;
      }
      loadEstimate(estimateId);
    });

    els.templatesList?.addEventListener('click', (e) => {
      const li = e.target.closest('.estimator-file[data-template-id]');
      if (!li) return;
      const templateId = li.dataset.templateId;
      if (isDirty) {
        const ok = window.confirm('You have unsaved changes. Load template anyway?');
        if (!ok) return;
      }
      loadTemplate(templateId);
    });

    // Note: beforeunload is handled by auto-save system to persist changes

    // Inline qty editing via delegation on tbody
    els.tbody?.addEventListener('change', (e) => {
      if (!e.target.classList.contains('inline-qty-input')) return;
      const catIdx = parseInt(e.target.dataset.cat, 10);
      const subIdx = parseInt(e.target.dataset.sub, 10);
      const itemIdx = parseInt(e.target.dataset.item, 10);
      const newQty = parseFloat(e.target.value) || 0;

      const item = currentEstimateData?.categories?.[catIdx]
        ?.subcategories?.[subIdx]?.items?.[itemIdx];
      if (!item) return;

      item.qty = newQty;
      item.quantity = newQty;
      recalculateEstimateTotals();
      markDirty();

      // Update subtotal/total cells in same row without full re-render
      const tr = e.target.closest('tr');
      if (tr) {
        const cells = tr.querySelectorAll('td');
        const unitCost = item.unit_cost ?? item.base_cost ?? 0;
        const total = newQty * unitCost;
        // col-subtotal is index 6, col-total is index 7
        if (cells[6]) cells[6].textContent = formatCurrency(total);
        if (cells[7]) cells[7].textContent = formatCurrency(total);
      }

      // Update sidebar summary
      renderEstimateSummary();
    });

    // Row selection via click delegation
    els.tbody?.addEventListener('click', (e) => {
      // Don't select when clicking inputs
      if (e.target.tagName === 'INPUT') return;

      const tr = e.target.closest('tr');
      if (!tr) return;

      // Clear previous selection
      els.tbody.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));

      if (tr.classList.contains('item-row')) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.catIndex, 10),
          subIndex: parseInt(tr.dataset.subIndex, 10),
          itemIndex: parseInt(tr.dataset.itemIndex, 10)
        };
        tr.classList.add('row-selected');
      } else if (tr.classList.contains('category-row') && tr.dataset.subRow !== undefined) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.parentIndex, 10),
          subIndex: parseInt(tr.dataset.subRow, 10),
          itemIndex: null
        };
        tr.classList.add('row-selected');
      } else if (tr.classList.contains('group-row')) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.groupIndex, 10),
          subIndex: 0,
          itemIndex: null
        };
        tr.classList.add('row-selected');
      }
    });

    // Context menu
    const ctxMenu = document.getElementById('estimator-context-menu');
    const ctxDeleteBtn = ctxMenu?.querySelector('[data-action="delete-concept"]');
    const ctxMoveBtn = ctxMenu?.querySelector('[data-action="move-concept"]');
    const ctxEditBtn = ctxMenu?.querySelector('[data-action="edit-item"]');

    els.tbody?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!ctxMenu) return;

      // Determine which row was right-clicked
      const tr = e.target.closest('tr');
      if (!tr) return;

      // Select the row
      els.tbody.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));

      const isItemRow = tr.classList.contains('item-row');
      const isSubRow = tr.classList.contains('category-row') && tr.dataset.subRow !== undefined;
      const isGroupRow = tr.classList.contains('group-row');

      if (isItemRow) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.catIndex, 10),
          subIndex: parseInt(tr.dataset.subIndex, 10),
          itemIndex: parseInt(tr.dataset.itemIndex, 10)
        };
      } else if (isSubRow) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.parentIndex, 10),
          subIndex: parseInt(tr.dataset.subRow, 10),
          itemIndex: null
        };
      } else if (isGroupRow) {
        selectedRow = {
          catIndex: parseInt(tr.dataset.groupIndex, 10),
          subIndex: 0,
          itemIndex: null
        };
      }
      tr.classList.add('row-selected');

      // Show/hide item-only options
      if (ctxDeleteBtn) ctxDeleteBtn.style.display = isItemRow ? '' : 'none';
      if (ctxMoveBtn) ctxMoveBtn.style.display = isItemRow ? '' : 'none';
      if (ctxEditBtn) ctxEditBtn.style.display = isItemRow ? '' : 'none';

      // Position menu
      ctxMenu.classList.remove('hidden');
      ctxMenu.style.left = e.clientX + 'px';
      ctxMenu.style.top = e.clientY + 'px';

      // Keep within viewport
      requestAnimationFrame(() => {
        const rect = ctxMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          ctxMenu.style.left = (e.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
          ctxMenu.style.top = (e.clientY - rect.height) + 'px';
        }
      });
    });

    // Context menu actions
    ctxMenu?.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      ctxMenu.classList.add('hidden');
      if (action === 'add-concept') {
        const catIdx = selectedRow ? selectedRow.catIndex : null;
        const subIdx = selectedRow ? selectedRow.subIndex : null;
        handleAddConcept(catIdx, subIdx);
      }
      if (action === 'add-custom-item') openCustomItemModal();
      if (action === 'edit-item') openEditItemModal();
      if (action === 'move-concept') openMoveConceptPicker();
      if (action === 'delete-concept') deleteSelectedConcept();
    });

    // Hide context menu on click elsewhere or Escape
    document.addEventListener('click', (e) => {
      if (ctxMenu && !ctxMenu.contains(e.target)) {
        ctxMenu.classList.add('hidden');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ctxMenu) {
        ctxMenu.classList.add('hidden');
      }
    });
  }

  // ================================
  // SUPABASE STORAGE HELPERS
  // ================================

  /**
   * Upload a file to a Supabase bucket
   * @param {string} bucket - Bucket name
   * @param {string} path - File path within bucket
   * @param {File|Blob|string} content - File content
   * @param {object} options - Upload options
   * @returns {Promise<{data, error}>}
   */
  async function uploadToStorage(bucket, path, content, options = {}) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const defaultOptions = {
      cacheControl: '3600',
      upsert: true,
      contentType: options.contentType || 'application/json'
    };

    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .upload(path, content, { ...defaultOptions, ...options });

      if (error) {
        console.error(`[STORAGE] Upload error to ${bucket}/${path}:`, error);
        return { data: null, error };
      }

      console.log(`[STORAGE] Uploaded to ${bucket}/${path}`);
      return { data, error: null };
    } catch (err) {
      console.error(`[STORAGE] Upload exception:`, err);
      return { data: null, error: err };
    }
  }

  /**
   * Download a file from a Supabase bucket
   * @param {string} bucket - Bucket name
   * @param {string} path - File path within bucket
   * @returns {Promise<{data, error}>}
   */
  async function downloadFromStorage(bucket, path) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .download(path);

      if (error) {
        console.error(`[STORAGE] Download error from ${bucket}/${path}:`, error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error(`[STORAGE] Download exception:`, err);
      return { data: null, error: err };
    }
  }

  /**
   * List files in a bucket path
   * @param {string} bucket - Bucket name
   * @param {string} path - Folder path
   * @returns {Promise<{data, error}>}
   */
  async function listStorageFiles(bucket, path = '') {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .list(path, { sortBy: { column: 'created_at', order: 'desc' } });

      if (error) {
        console.error(`[STORAGE] List error for ${bucket}/${path}:`, error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error(`[STORAGE] List exception:`, err);
      return { data: null, error: err };
    }
  }

  /**
   * Delete a file from storage
   * @param {string} bucket - Bucket name
   * @param {string[]} paths - Array of file paths to delete
   * @returns {Promise<{data, error}>}
   */
  async function deleteFromStorage(bucket, paths) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      const { data, error } = await supabaseClient.storage
        .from(bucket)
        .remove(paths);

      if (error) {
        console.error(`[STORAGE] Delete error:`, error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error(`[STORAGE] Delete exception:`, err);
      return { data: null, error: err };
    }
  }

  /**
   * Get public URL for a file
   * @param {string} bucket - Bucket name
   * @param {string} path - File path
   * @returns {string}
   */
  function getPublicUrl(bucket, path) {
    if (!supabaseClient) return '';

    const { data } = supabaseClient.storage
      .from(bucket)
      .getPublicUrl(path);

    return data?.publicUrl || '';
  }

  // ================================
  // CSV PARSING & TEMPLATE LOADING
  // ================================

  /**
   * Parse CSV text into array of objects
   * @param {string} csvText - CSV content
   * @returns {Array<object>} Parsed rows as objects
   */
  function parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header row - handle quoted values
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);

    return lines.slice(1).map(line => {
      if (!line.trim()) return null;
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((header, i) => {
        // Remove surrounding quotes and clean header
        const cleanHeader = header.replace(/^"|"$/g, '');
        let value = values[i] || '';
        value = value.replace(/^"|"$/g, '');

        // Try to parse JSON objects/arrays
        if ((value.startsWith('{') && value.endsWith('}')) ||
            (value.startsWith('[') && value.endsWith(']'))) {
          try {
            obj[cleanHeader] = JSON.parse(value);
          } catch {
            obj[cleanHeader] = value;
          }
        } else if (value === 'true') {
          obj[cleanHeader] = true;
        } else if (value === 'false') {
          obj[cleanHeader] = false;
        } else if (value !== '' && !isNaN(value) && !value.includes('-')) {
          // Parse numbers but not UUIDs with dashes
          obj[cleanHeader] = parseFloat(value);
        } else {
          obj[cleanHeader] = value;
        }
      });
      return obj;
    }).filter(Boolean);
  }

  /**
   * Load template with all snapshots from storage bucket
   * @param {string} templateId - Template folder ID
   * @returns {Promise<{template, conceptsSnapshot, materialsSnapshot, conceptMaterialsSnapshot}>}
   */
  async function loadTemplateFromBucket(templateId) {
    const basePath = templateId;

    console.log(`[ESTIMATOR] Loading template from bucket: ${basePath}`);

    // Load template.ngm + try JSON snapshots first
    const [templateRes, conceptsRes, materialsRes, cmRes] = await Promise.all([
      downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/template.ngm`),
      downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/concepts_snapshot.json`),
      downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/materials_snapshot.json`),
      downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/concept_materials_snapshot.json`)
    ]);

    // Parse template JSON
    let template = null;
    if (templateRes.data) {
      try {
        const templateText = await templateRes.data.text();
        template = JSON.parse(templateText);
      } catch (err) {
        console.warn('[ESTIMATOR] Could not parse template.ngm:', err);
      }
    }

    // Parse JSON snapshots
    let conceptsSnapshot = [];
    let materialsSnapshot = [];
    let conceptMaterialsSnapshot = [];

    if (conceptsRes.data) {
      try {
        const text = await conceptsRes.data.text();
        conceptsSnapshot = JSON.parse(text);
      } catch (err) {
        console.warn('[ESTIMATOR] Could not parse concepts_snapshot.json:', err);
      }
    }

    if (materialsRes.data) {
      try {
        const text = await materialsRes.data.text();
        materialsSnapshot = JSON.parse(text);
      } catch (err) {
        console.warn('[ESTIMATOR] Could not parse materials_snapshot.json:', err);
      }
    }

    if (cmRes.data) {
      try {
        const text = await cmRes.data.text();
        conceptMaterialsSnapshot = JSON.parse(text);
      } catch (err) {
        console.warn('[ESTIMATOR] Could not parse concept_materials_snapshot.json:', err);
      }
    }

    // Fallback: try legacy CSV files if JSON snapshots were empty
    if (conceptsSnapshot.length === 0 && materialsSnapshot.length === 0) {
      console.log('[ESTIMATOR] No JSON snapshots found, trying legacy CSV...');
      const [csvConcepts, csvMaterials, csvCm] = await Promise.all([
        downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/concepts_snapshot.csv`),
        downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/materials_snapshot.csv`),
        downloadFromStorage(BUCKETS.TEMPLATES, `${basePath}/concept_materials.csv`)
      ]);

      if (csvConcepts.data) {
        try { conceptsSnapshot = parseCSV(await csvConcepts.data.text()); } catch (e) { /* ignore */ }
      }
      if (csvMaterials.data) {
        try { materialsSnapshot = parseCSV(await csvMaterials.data.text()); } catch (e) { /* ignore */ }
      }
      if (csvCm.data) {
        try { conceptMaterialsSnapshot = parseCSV(await csvCm.data.text()); } catch (e) { /* ignore */ }
      }
    }

    console.log(`[ESTIMATOR] Loaded: ${conceptsSnapshot.length} concepts, ${materialsSnapshot.length} materials`);

    return { template, conceptsSnapshot, materialsSnapshot, conceptMaterialsSnapshot };
  }

  /**
   * Populate templateCache from loaded snapshots or fresh DB fetch
   * @param {object} snapshots - Object with concepts, materials, conceptMaterials arrays
   */
  function populateTemplateCache(snapshots) {
    templateCache = {
      concepts: snapshots.concepts || snapshots.conceptsSnapshot || [],
      materials: snapshots.materials || snapshots.materialsSnapshot || [],
      conceptMaterials: snapshots.conceptMaterials || snapshots.conceptMaterialsSnapshot || [],
      lastRefreshed: new Date().toISOString()
    };

    console.log(`[ESTIMATOR] Template cache populated: ${templateCache.concepts.length} concepts, ${templateCache.materials.length} materials`);
  }

  // ================================
  // ESTIMATE FILE OPERATIONS
  // ================================

  /**
   * Save current estimate to storage with folder structure:
   * - {estimateId}/estimate.ngm (JSON file)
   * - {estimateId}/materials_snapshot.json
   * - {estimateId}/concepts_snapshot.json
   * - {estimateId}/concept_materials_snapshot.json
   */
  async function saveEstimate() {
    if (!currentEstimateData) {
      showFeedback('No estimate data to save', 'error');
      return false;
    }

    // If no estimate ID and no project name, prompt to create new
    if (!currentEstimateId && (!currentEstimateData.project_name || currentEstimateData.project_name === 'New Project')) {
      return await createNewEstimate();
    }

    els.statusEl.textContent = 'Saving estimate...';

    try {
      // 1. Extract IDs used in this estimate for snapshots
      const { conceptIds, materialIds } = extractUsedIds();

      // 2. Fetch and create snapshots
      els.statusEl.textContent = 'Creating snapshots...';

      const [materialsResult, conceptsResult, conceptMaterialsResult] = await Promise.all([
        materialIds.length > 0 ? fetchMaterials(materialIds) : { data: [], error: null },
        conceptIds.length > 0 ? fetchConcepts(conceptIds) : { data: [], error: null },
        conceptIds.length > 0 ? fetchConceptMaterials(conceptIds) : { data: [], error: null }
      ]);

      // 3. Prepare request payload for backend API
      const requestPayload = {
        estimate_id: currentEstimateId,
        project_name: currentEstimateData.project_name || 'Untitled',
        project: currentEstimateData.project || {},
        categories: currentEstimateData.categories || [],
        overhead: currentEstimateData.overhead || { percentage: 0, amount: 0 },
        materials_snapshot: materialsResult.data || [],
        concepts_snapshot: conceptsResult.data || [],
        concept_materials_snapshot: conceptMaterialsResult.data || [],
        created_from_template: currentEstimateData.created_from_template || null
      };

      els.statusEl.textContent = 'Uploading...';

      // 4. Call backend API to save estimate
      const response = await fetch(`${API_BASE}/estimator/estimates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();

      // Update local state with returned ID
      currentEstimateId = result.estimate_id || currentEstimateId;
      currentEstimateData.estimate_id = currentEstimateId;

      isDirty = false;
      showFeedback('Estimate saved with snapshots', 'success');
      els.statusEl.textContent = 'Saved';

      // Refresh estimates list
      await loadEstimatesList();

      return true;

    } catch (err) {
      console.error('[ESTIMATOR] Save error:', err);
      showFeedback('Error saving estimate: ' + err.message, 'error');
      els.statusEl.textContent = 'Save failed';
      return false;
    }
  }

  /**
   * Create a new estimate - opens project info modal to collect data
   */
  async function createNewEstimate() {
    // ID will be generated by the backend based on project name
    // For now, set a tentative ID that will be updated after first save
    const projectName = currentEstimateData?.project_name || 'New Project';

    // Update estimate data
    if (!currentEstimateData) {
      currentEstimateData = {
        project_name: projectName,
        project: {},
        categories: [],
        created_at: new Date().toISOString()
      };
    }

    currentEstimateData.created_at = new Date().toISOString();
    currentEstimateId = null; // Will be set by backend

    // Open project info modal in edit mode
    showFeedback('Fill project info and save to create new estimate', 'info');

    // Set edit mode and open modal
    if (window.openProjectModal) {
      window.openProjectModal(true); // Pass true to enable edit mode
    }

    return false; // Don't save yet - user needs to fill modal
  }

  /**
   * Load list of estimates for sidebar
   */
  async function loadEstimatesList() {
    try {
      // Use backend API to list estimates
      console.log('[ESTIMATOR] Fetching estimates list from API...');
      const response = await fetch(`${API_BASE}/estimator/estimates`, {
        method: 'GET',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });

      console.log('[ESTIMATOR] Estimates API response:', response.status);
      if (!response.ok) {
        console.warn('[ESTIMATOR] Could not load estimates list');
        updateEstimatesListUI([]);
        return [];
      }

      const result = await response.json();
      const estimates = result.estimates || [];
      console.log('[ESTIMATOR] Estimates found:', estimates.length, estimates);

      // Update sidebar
      updateEstimatesListUI(estimates);

      return estimates;
    } catch (err) {
      console.warn('[ESTIMATOR] Error loading estimates list:', err);
      updateEstimatesListUI([]);
      return [];
    }
  }

  /**
   * Update estimates list in sidebar UI
   */
  function updateEstimatesListUI(estimates) {
    if (!els.filesList) return;

    if (!estimates || estimates.length === 0) {
      els.filesList.innerHTML = `
        <li class="estimator-file" style="color: #6b7280; font-style: italic;">
          No saved estimates
        </li>
      `;
      return;
    }

    els.filesList.innerHTML = estimates.map(est => {
      const displayName = (est.name || est.id)
        .replace(/-\d{13}$/, '') // Remove timestamp
        .replace(/-/g, ' ')     // Replace dashes with spaces
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case

      return `
        <li class="estimator-file${est.id === currentEstimateId ? ' estimator-file--active' : ''}"
            data-estimate-id="${est.id || est.name}"
            title="Click to load: ${displayName}">
          ${displayName}
        </li>
      `;
    }).join('');

  }

  /**
   * Load estimate from storage via backend API
   * @param {string} estimateId
   */
  async function loadEstimate(estimateId) {
    els.statusEl.textContent = 'Loading estimate...';

    try {
      // Use backend API to load estimate
      const response = await fetch(`${API_BASE}/estimator/estimates/${encodeURIComponent(estimateId)}`, {
        method: 'GET',
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      currentEstimateData = await response.json();
      currentEstimateId = estimateId;
      currentProjectId = currentEstimateData.project_id || null;
      isDirty = false;

      // Migrate old overhead format if needed
      if (!currentEstimateData.overhead || !Array.isArray(currentEstimateData.overhead.items)) {
        currentEstimateData.overhead = getDefaultOverhead();
      }

      renderEstimate();
      showFeedback('Estimate loaded', 'success');

      // Update sidebar to show active estimate
      updateEstimatesListUI(await loadEstimatesList());

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] Load error:', err);
      showFeedback('Error loading estimate: ' + err.message, 'error');
      els.statusEl.textContent = 'Load failed';
      return false;
    }
  }

  // ================================
  // TEMPLATE OPERATIONS
  // ================================

  /**
   * Clear quantities from all items in categories (for template saving)
   * Templates keep structure but reset quantities to 0
   */
  function clearQuantitiesFromData(data) {
    if (!data || !Array.isArray(data.categories)) return data;

    const cleanedData = JSON.parse(JSON.stringify(data)); // Deep clone

    cleanedData.categories.forEach(category => {
      if (Array.isArray(category.subcategories)) {
        category.subcategories.forEach(subcategory => {
          if (Array.isArray(subcategory.items)) {
            subcategory.items.forEach(item => {
              // Clear quantity fields
              item.qty = 0;
              item.quantity = 0;
              // Clear calculated totals
              item.total = 0;
              item.total_cost = 0;
              item.subtotal = 0;
            });
            // Reset subcategory totals
            subcategory.total = 0;
            subcategory.total_cost = 0;
          }
        });
        // Reset category totals
        category.total = 0;
        category.total_cost = 0;
      }
    });

    // Reset overall totals
    cleanedData.subtotal = 0;
    cleanedData.total = 0;
    cleanedData.grand_total = 0;

    return cleanedData;
  }

  /**
   * Fetch ALL materials from database (for full snapshot)
   */
  async function fetchAllMaterials() {
    if (!supabaseClient) return { data: [], error: 'No Supabase client' };

    try {
      const { data, error } = await supabaseClient
        .from('materials')
        .select('*')
        .order('material_name');

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err.message };
    }
  }

  /**
   * Fetch ALL concepts from database (for full snapshot)
   */
  async function fetchAllConcepts() {
    if (!supabaseClient) return { data: [], error: 'No Supabase client' };

    try {
      const { data, error } = await supabaseClient
        .from('concepts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err.message };
    }
  }

  /**
   * Fetch ALL concept_materials from database (for full snapshot)
   */
  async function fetchAllConceptMaterials() {
    if (!supabaseClient) return { data: [], error: 'No Supabase client' };

    try {
      const { data, error } = await supabaseClient
        .from('concept_materials')
        .select('*')
        .order('concept_id, sort_order');

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: err.message };
    }
  }

  /**
   * Save current estimate as a template with snapshots:
   * - {templateId}/template.ngm (JSON file with quantities cleared)
   * - {templateId}/materials_snapshot.json (FULL materials DB)
   * - {templateId}/concepts_snapshot.json (FULL concepts DB)
   * - {templateId}/concept_materials_snapshot.json (FULL concept_materials)
   *
   * @param {string} templateName - Name for the template
   * @param {string} description - Template description
   */
  async function saveAsTemplate(templateName, description = '') {
    if (!currentEstimateData) {
      showFeedback('No estimate data to save as template', 'error');
      return false;
    }

    if (!supabaseClient) {
      showFeedback('Storage not available', 'error');
      return false;
    }

    els.statusEl.textContent = 'Saving template...';

    try {
      // Generate template ID
      const templateId = templateName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now();

      const basePath = templateId;

      // Clear quantities from data (templates don't have quantities)
      const cleanedData = clearQuantitiesFromData(currentEstimateData);

      // Clear project info but keep structure
      const projectData = { ...(cleanedData.project || {}) };
      projectData['Project Name'] = templateName;
      projectData['Address'] = '';
      projectData['Date'] = '';

      // Prepare template.ngm JSON
      const templateJson = {
        template_id: templateId,
        template_name: templateName,
        description: description || '',
        project_name: templateName,
        project: projectData,
        categories: cleanedData.categories || [],
        overhead: cleanedData.overhead || { percentage: 0, amount: 0 },
        created_at: new Date().toISOString(),
        version: '1.0'
      };

      // Fetch FULL database snapshots
      els.statusEl.textContent = 'Creating full DB snapshots...';

      const [materialsResult, conceptsResult, conceptMaterialsResult] = await Promise.all([
        fetchAllMaterials(),
        fetchAllConcepts(),
        fetchAllConceptMaterials()
      ]);

      const materials = materialsResult.data || [];
      const concepts = conceptsResult.data || [];
      const conceptMaterials = conceptMaterialsResult.data || [];

      els.statusEl.textContent = 'Uploading to storage...';

      // Upload all files to Supabase Storage in parallel
      const uploadResults = await Promise.all([
        // template.ngm (JSON)
        uploadToStorage(
          BUCKETS.TEMPLATES,
          `${basePath}/template.ngm`,
          new Blob([JSON.stringify(templateJson, null, 2)], { type: 'application/json' }),
          { contentType: 'application/json' }
        ),
        // concepts_snapshot.json
        uploadToStorage(
          BUCKETS.TEMPLATES,
          `${basePath}/concepts_snapshot.json`,
          new Blob([JSON.stringify(concepts)], { type: 'application/json' }),
          { contentType: 'application/json' }
        ),
        // materials_snapshot.json
        uploadToStorage(
          BUCKETS.TEMPLATES,
          `${basePath}/materials_snapshot.json`,
          new Blob([JSON.stringify(materials)], { type: 'application/json' }),
          { contentType: 'application/json' }
        ),
        // concept_materials_snapshot.json
        uploadToStorage(
          BUCKETS.TEMPLATES,
          `${basePath}/concept_materials_snapshot.json`,
          new Blob([JSON.stringify(conceptMaterials)], { type: 'application/json' }),
          { contentType: 'application/json' }
        ),
        // template_meta.json (for listing)
        uploadToStorage(
          BUCKETS.TEMPLATES,
          `${basePath}/template_meta.json`,
          new Blob([JSON.stringify({
            id: templateId,
            name: templateName,
            description: description || '',
            created_at: new Date().toISOString(),
            concepts_count: concepts.length,
            materials_count: materials.length
          }, null, 2)], { type: 'application/json' }),
          { contentType: 'application/json' }
        )
      ]);

      // Check for errors
      const errors = uploadResults.filter(r => r.error);
      if (errors.length > 0) {
        console.error('[ESTIMATOR] Upload errors:', errors);
        throw new Error('Failed to upload some template files');
      }

      showFeedback(`Template "${templateName}" saved with ${concepts.length} concepts, ${materials.length} materials`, 'success');
      els.statusEl.textContent = 'Template saved';

      // Refresh templates list
      await loadTemplatesListFromStorage();

      return true;

    } catch (err) {
      console.error('[ESTIMATOR] Template save error:', err);
      showFeedback('Error saving template: ' + err.message, 'error');
      els.statusEl.textContent = 'Template save failed';
      return false;
    }
  }

  /**
   * Load templates list directly from Supabase Storage bucket
   */
  async function loadTemplatesListFromStorage() {
    console.log('[ESTIMATOR] loadTemplatesListFromStorage called');
    try {
      if (!supabaseClient) {
        console.error('[ESTIMATOR] supabaseClient is NULL - Supabase not initialized');
        return [];
      }
      console.log('[ESTIMATOR] Supabase client OK, listing bucket:', BUCKETS.TEMPLATES);

      // List all items in templates bucket root
      const { data: items, error } = await supabaseClient.storage
        .from(BUCKETS.TEMPLATES)
        .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) {
        console.error('[ESTIMATOR] Bucket list error:', error);
        return [];
      }

      console.log('[ESTIMATOR] Raw bucket items:', JSON.stringify(items, null, 2));

      // Filter to only folders: name has no extension (no dot)
      const templateFolders = (items || []).filter(f => {
        const name = f.name || '';
        if (!name) return false;
        if (name.includes('.')) return false;
        return true;
      });

      console.log('[ESTIMATOR] Folders after filter:', templateFolders.map(f => f.name));

      // Load meta for each template
      const templates = [];
      for (const folder of templateFolders) {
        console.log('[ESTIMATOR] Processing folder:', folder.name);
        try {
          const metaPath = `${folder.name}/template_meta.json`;
          console.log('[ESTIMATOR] Downloading:', metaPath);
          const { data, error: dlErr } = await downloadFromStorage(
            BUCKETS.TEMPLATES,
            metaPath
          );
          console.log('[ESTIMATOR] Meta download result - data:', !!data, 'error:', dlErr);
          if (data) {
            const text = await data.text();
            console.log('[ESTIMATOR] Meta content:', text.substring(0, 200));
            const meta = JSON.parse(text);
            templates.push({
              id: folder.name,
              name: meta.name || folder.name,
              description: meta.description || '',
              created_at: meta.created_at,
              concepts_count: meta.concepts_count || 0,
              materials_count: meta.materials_count || 0
            });
          } else {
            console.log('[ESTIMATOR] No meta file, using folder name');
            templates.push({
              id: folder.name,
              name: folder.name.replace(/-\d+$/, '').replace(/-/g, ' ')
            });
          }
        } catch (err) {
          console.warn('[ESTIMATOR] Error loading meta for', folder.name, err);
          templates.push({
            id: folder.name,
            name: folder.name.replace(/-\d+$/, '').replace(/-/g, ' ')
          });
        }
      }

      console.log('[ESTIMATOR] Final templates list:', templates);
      return templates;
    } catch (err) {
      console.error('[ESTIMATOR] Error loading templates from storage:', err);
      return [];
    }
  }

  /**
   * Load a template
   * @param {string} templateId
   */
  async function loadTemplate(templateId) {
    console.log('[ESTIMATOR] loadTemplate called with id:', templateId);
    els.statusEl.textContent = 'Loading template...';

    try {
      // Try to load from bucket first (with snapshots)
      let templateData = null;
      let snapshots = null;

      try {
        els.statusEl.textContent = 'Loading template from storage...';
        const bucketResult = await loadTemplateFromBucket(templateId);
        console.log('[ESTIMATOR] loadTemplateFromBucket result:', {
          hasTemplate: !!bucketResult.template,
          templateKeys: bucketResult.template ? Object.keys(bucketResult.template) : [],
          conceptsCount: bucketResult.conceptsSnapshot?.length,
          materialsCount: bucketResult.materialsSnapshot?.length
        });

        if (bucketResult.template) {
          templateData = bucketResult.template;
          snapshots = {
            concepts: bucketResult.conceptsSnapshot,
            materials: bucketResult.materialsSnapshot,
            conceptMaterials: bucketResult.conceptMaterialsSnapshot
          };
          console.log('[ESTIMATOR] Template loaded from bucket with snapshots');
        }
      } catch (bucketErr) {
        console.warn('[ESTIMATOR] Bucket load failed, trying API:', bucketErr);
      }

      // Fallback to backend API if bucket load failed
      if (!templateData) {
        els.statusEl.textContent = 'Loading template from API...';
        const response = await fetch(`${API_BASE}/estimator/templates/${encodeURIComponent(templateId)}`, {
          method: 'GET',
          headers: { ...getAuthHeaders() },
          credentials: 'include'
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        templateData = await response.json();

        // If API returns snapshots, use them
        if (templateData.materials_snapshot || templateData.concepts_snapshot) {
          snapshots = {
            concepts: templateData.concepts_snapshot || [],
            materials: templateData.materials_snapshot || [],
            conceptMaterials: templateData.concept_materials_snapshot || []
          };
        }
      }

      // Create new estimate from template
      currentEstimateData = {
        ...templateData,
        template_meta: undefined, // Remove template metadata
        materials_snapshot: undefined, // Don't keep in estimate data
        concepts_snapshot: undefined,
        concept_materials_snapshot: undefined,
        created_from_template: templateId,
        created_at: new Date().toISOString()
      };

      currentEstimateId = null; // Will be assigned on first save
      currentProjectId = null;

      // Ensure overhead has new items format
      if (!currentEstimateData.overhead || !Array.isArray(currentEstimateData.overhead.items)) {
        currentEstimateData.overhead = getDefaultOverhead();
      }

      // Populate template cache if we have snapshots
      if (snapshots && (snapshots.concepts.length > 0 || snapshots.materials.length > 0)) {
        populateTemplateCache(snapshots);
      } else {
        // Fetch from DB if no snapshots available
        els.statusEl.textContent = 'Loading catalog from database...';
        await refreshCatalogFromDB();
      }

      renderEstimate();
      markDirty(); // Trigger auto-save
      showFeedback(`Template loaded with ${templateCache.concepts.length} concepts`, 'success');

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] Template load error:', err);
      showFeedback('Error loading template: ' + err.message, 'error');
      els.statusEl.textContent = 'Template load failed';
      return false;
    }
  }

  /**
   * Refresh catalog (concepts, materials) from database
   */
  async function refreshCatalogFromDB() {
    try {
      const [materialsRes, conceptsRes, cmRes] = await Promise.all([
        fetchAllMaterials(),
        fetchAllConcepts(),
        fetchAllConceptMaterials()
      ]);

      populateTemplateCache({
        concepts: conceptsRes.data || [],
        materials: materialsRes.data || [],
        conceptMaterials: cmRes.data || []
      });

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] Error refreshing catalog from DB:', err);
      return false;
    }
  }

  /**
   * Update templates list in sidebar UI
   */
  function updateTemplatesListUI(templates) {
    const templatesList = document.getElementById('estimator-templates-list');
    if (!templatesList) return;

    if (!templates || templates.length === 0) {
      templatesList.innerHTML = `
        <li class="estimator-file" style="color: #6b7280; font-style: italic;">
          No templates saved
        </li>
      `;
      return;
    }

    templatesList.innerHTML = templates.map(tpl => {
      // Extract readable name from template name or ID (remove timestamp)
      const displayName = (tpl.name || tpl.id || 'Untitled')
        .replace(/-\d{13}$/, '') // Remove timestamp
        .replace(/-/g, ' ')     // Replace dashes with spaces
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case

      return `
        <li class="estimator-file estimator-file--template"
            data-template-id="${tpl.id}"
            title="Click to load template: ${displayName}">
          ${displayName}
        </li>
      `;
    }).join('');

  }

  // ================================
  // SUPABASE TABLE OPERATIONS
  // ================================

  /**
   * Fetch materials from the materials table
   * @param {string[]} ids - Optional array of material IDs to filter
   * @returns {Promise<{data: Array, error: any}>}
   */
  async function fetchMaterials(ids = null) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      let query = supabaseClient.from('materials').select('*');

      if (ids && ids.length > 0) {
        query = query.in('id', ids);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ESTIMATOR] Fetch materials error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('[ESTIMATOR] Fetch materials exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Fetch concepts from the concepts table
   * @param {string[]} ids - Optional array of concept IDs to filter
   * @returns {Promise<{data: Array, error: any}>}
   */
  async function fetchConcepts(ids = null) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      let query = supabaseClient.from('concepts').select('*');

      if (ids && ids.length > 0) {
        query = query.in('id', ids);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ESTIMATOR] Fetch concepts error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('[ESTIMATOR] Fetch concepts exception:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Fetch concept_materials junction table (links concepts to materials)
   * @param {string[]} conceptIds - Optional array of concept IDs to filter
   * @returns {Promise<{data: Array, error: any}>}
   */
  async function fetchConceptMaterials(conceptIds = null) {
    if (!supabaseClient) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    try {
      let query = supabaseClient.from('concept_materials').select('*');

      if (conceptIds && conceptIds.length > 0) {
        query = query.in('concept_id', conceptIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ESTIMATOR] Fetch concept_materials error:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (err) {
      console.error('[ESTIMATOR] Fetch concept_materials exception:', err);
      return { data: null, error: err };
    }
  }


  /**
   * Extract all concept and material IDs used in current estimate
   * @returns {{conceptIds: string[], materialIds: string[]}}
   */
  function extractUsedIds() {
    const conceptIds = new Set();
    const materialIds = new Set();

    if (!currentEstimateData?.categories) {
      return { conceptIds: [], materialIds: [] };
    }

    currentEstimateData.categories.forEach(cat => {
      cat.subcategories?.forEach(sub => {
        sub.items?.forEach(item => {
          if (item.concept_id) conceptIds.add(item.concept_id);
          if (item.material_id) materialIds.add(item.material_id);
          // Also check for nested materials in composite concepts
          item.materials?.forEach(mat => {
            if (mat.material_id) materialIds.add(mat.material_id);
          });
        });
      });
    });

    return {
      conceptIds: Array.from(conceptIds),
      materialIds: Array.from(materialIds)
    };
  }

  // ================================
  // MATERIALS IMAGES
  // ================================

  /**
   * Get image URL for a concept/material
   * @param {string} type - 'concept' or 'material'
   * @param {string} id - Item ID
   * @param {string} customImagePath - Optional custom image path in estimate
   */
  function getItemImageUrl(type, id, customImagePath = null) {
    // If there's a custom image in the estimate, use it
    if (customImagePath && currentProjectId && currentEstimateId) {
      return getPublicUrl(
        BUCKETS.ESTIMATES,
        `${currentProjectId}/${currentEstimateId}/images/${customImagePath}`
      );
    }

    // Otherwise use catalog image
    const folder = type === 'concept' ? 'concepts' : 'materials';
    return getPublicUrl(BUCKETS.MATERIALS_IMAGES, `${folder}/${id}.jpg`);
  }

  /**
   * Upload custom image for an item in current estimate
   * @param {string} itemId - Line item ID
   * @param {File} file - Image file
   */
  async function uploadItemImage(itemId, file) {
    if (!currentProjectId || !currentEstimateId) {
      showFeedback('Save estimate first before adding images', 'warning');
      return null;
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${currentProjectId}/${currentEstimateId}/images/${itemId}.${ext}`;

    const { data, error } = await uploadToStorage(BUCKETS.ESTIMATES, path, file, {
      contentType: file.type
    });

    if (error) {
      showFeedback('Error uploading image', 'error');
      return null;
    }

    return `${itemId}.${ext}`;
  }

  // ================================
  // UI HELPERS
  // ================================

  function showFeedback(message, type = 'info') {
    if (!els.feedbackEl) return;

    els.feedbackEl.textContent = message;
    els.feedbackEl.className = 'estimator-feedback';

    if (type === 'error') {
      els.feedbackEl.style.color = '#ef4444';
    } else if (type === 'success') {
      els.feedbackEl.style.color = '#3ecf8e';
    } else if (type === 'warning') {
      els.feedbackEl.style.color = '#f59e0b';
    } else {
      els.feedbackEl.style.color = '#6b7280';
    }

    // Clear after 5 seconds
    setTimeout(() => {
      if (els.feedbackEl.textContent === message) {
        els.feedbackEl.textContent = '';
      }
    }, 5000);
  }

  function formatCurrency(value) {
    const n = typeof value === 'number' ? value : 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(n);
  }

  // ================================
  // TABLE RENDERING
  // ================================

  function renderEstimate() {
    if (!currentEstimateData || !els.tbody) return;

    const data = currentEstimateData;
    const projectObj = data.project || {};
    const projectName = data.project_name || projectObj['Project Name'] || 'Untitled Project';
    const projectDate = data.date || projectObj['Date'] || '';

    // Update topbar
    if (els.projectTitleText) {
      els.projectTitleText.textContent = projectName;
    }
    if (els.projectSubtitle) {
      els.projectSubtitle.textContent = projectDate
        ? `Date: ${projectDate} · Loaded from estimate.ngm`
        : 'Loaded from estimate.ngm';
    }

    // Update sidebar summary
    const categories = Array.isArray(data.categories) ? data.categories : [];
    let subtotal = 0;

    categories.forEach(cat => {
      if (typeof cat.total_cost === 'number') {
        subtotal += cat.total_cost;
      }
    });

    const overheadAmount = data.overhead?.amount || 0;
    const totalWithOH = subtotal + overheadAmount;

    if (els.summaryProject) els.summaryProject.textContent = projectName || '(Untitled)';
    if (els.summarySubtotal) els.summarySubtotal.textContent = formatCurrency(subtotal);
    if (els.summaryTotal) els.summaryTotal.textContent = formatCurrency(totalWithOH);
    if (els.summaryOverhead) els.summaryOverhead.textContent = overheadAmount ? formatCurrency(overheadAmount) : '—';
    if (els.summaryDate) els.summaryDate.textContent = projectDate || '—';

    // Render table
    renderTable(categories);

    if (els.statusEl) {
      els.statusEl.textContent = `Loaded ${categories.length} categories`;
    }
  }

  function renderEstimateSummary() {
    if (!currentEstimateData) return;
    const categories = Array.isArray(currentEstimateData.categories) ? currentEstimateData.categories : [];
    let subtotal = 0;
    categories.forEach(cat => {
      if (typeof cat.total_cost === 'number') subtotal += cat.total_cost;
    });
    const overheadAmount = currentEstimateData.overhead?.amount || 0;
    const totalWithOH = subtotal + overheadAmount;
    if (els.summarySubtotal) els.summarySubtotal.textContent = formatCurrency(subtotal);
    if (els.summaryTotal) els.summaryTotal.textContent = formatCurrency(totalWithOH);
    if (els.summaryOverhead) els.summaryOverhead.textContent = overheadAmount ? formatCurrency(overheadAmount) : '--';
  }

  function renderTable(categories) {
    if (!els.tbody) return;

    if (!categories.length) {
      els.tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-cell-muted">
            No categories found. Add concepts to get started.
          </td>
        </tr>
      `;
      return;
    }

    els.tbody.innerHTML = '';
    let totalSubs = 0;

    categories.forEach((cat, indexCat) => {
      const catName = cat.name || `Category ${indexCat + 1}`;
      const catCode = cat.id || `C${indexCat + 1}`;
      const subcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];

      // Initialize collapse state
      if (groupState[indexCat] === undefined) groupState[indexCat] = true;

      // Category row
      const trGroup = document.createElement('tr');
      trGroup.classList.add('group-row');
      trGroup.dataset.groupIndex = String(indexCat);
      trGroup.innerHTML = `
        <td class="category-accnum col-code">${catCode}</td>
        <td class="image-cell col-image"></td>
        <td class="col-name">
          <div class="group-cell">
            <span class="group-toggle-icon">${groupState[indexCat] ? '▾' : '▸'}</span>
            <span class="group-name">${catName}</span>
          </div>
        </td>
        <td class="group-spacer col-qty"></td>
        <td class="group-spacer col-unit"></td>
        <td class="group-spacer col-unit-cost"></td>
        <td class="group-spacer col-subtotal"></td>
        <td class="group-spacer col-total"></td>
      `;
      trGroup.addEventListener('click', () => toggleGroup(indexCat));
      els.tbody.appendChild(trGroup);

      if (!subcats.length) {
        const trEmpty = document.createElement('tr');
        trEmpty.classList.add('category-row');
        trEmpty.dataset.parentIndex = String(indexCat);
        trEmpty.style.display = groupState[indexCat] ? '' : 'none';
        trEmpty.innerHTML = `
          <td class="col-code"></td>
          <td class="image-cell col-image"></td>
          <td class="table-cell-muted col-name" colspan="6">No subcategories.</td>
        `;
        els.tbody.appendChild(trEmpty);
        return;
      }

      subcats.forEach((sub, indexSub) => {
        totalSubs++;
        const subName = sub.name || `Subcategory ${indexSub + 1}`;
        const items = Array.isArray(sub.items) ? sub.items : [];
        const subKey = `${indexCat}-${indexSub}`;

        if (subState[subKey] === undefined) subState[subKey] = true;

        // Subcategory row
        const trSub = document.createElement('tr');
        trSub.classList.add('category-row');
        trSub.dataset.parentIndex = String(indexCat);
        trSub.dataset.subRow = String(indexSub);
        trSub.style.display = groupState[indexCat] ? '' : 'none';
        trSub.innerHTML = `
          <td class="category-accnum col-code"></td>
          <td class="image-cell col-image"></td>
          <td class="category-name col-name">
            ${items.length ? `<span class="group-toggle-icon sub-toggle-icon">${subState[subKey] ? '▾' : '▸'}</span>` : ''}
            <span>${subName}</span>
          </td>
          <td class="table-cell-muted col-qty"></td>
          <td class="table-cell-muted col-unit"></td>
          <td class="table-cell-muted col-unit-cost"></td>
          <td class="table-cell-muted col-subtotal"></td>
          <td class="table-cell-muted col-total"></td>
        `;
        if (items.length) {
          trSub.addEventListener('click', () => toggleSub(indexCat, indexSub));
        }
        els.tbody.appendChild(trSub);

        // Item rows
        items.forEach((item, itemIdx) => {
          const code = item.id || item.code || '';
          const name = item.name || item.description || `Item ${itemIdx + 1}`;
          const qty = item.qty ?? item.quantity ?? '';
          const unit = item.unit || '';
          const unitCost = item.unit_cost ?? item.base_cost ?? '';
          const subtotalItem = item.total ?? item.total_cost ?? '';
          const totalItem = subtotalItem;

          // Get image URL
          const imageUrl = getItemImageUrl('concept', item.concept_id, item.custom_image);

          // Composite / Simple badge
          const isComposite = item.line_items && item.line_items.length > 0;
          const compBadge = isComposite
            ? '<span class="item-comp-badge" title="Composite">C</span>'
            : '<span class="item-comp-badge simple" title="Simple">S</span>';

          // Generate type badges if line_items exist
          let typeBadgesHtml = '';
          if (isComposite) {
            const types = new Set(item.line_items.map(li => li.type));
            typeBadgesHtml = '<span class="item-type-indicators">';
            if (types.has('material')) typeBadgesHtml += '<span class="item-type-indicator mat" title="Contains materials"></span>';
            if (types.has('labor')) typeBadgesHtml += '<span class="item-type-indicator lab" title="Contains labor"></span>';
            if (types.has('external')) typeBadgesHtml += '<span class="item-type-indicator ext" title="Contains external services"></span>';
            if (types.has('percent')) typeBadgesHtml += '<span class="item-type-indicator pct" title="Contains percentage items"></span>';
            typeBadgesHtml += '</span>';
          }

          const trItem = document.createElement('tr');
          trItem.classList.add('item-row');
          trItem.dataset.catIndex = String(indexCat);
          trItem.dataset.subIndex = String(indexSub);
          trItem.style.display = (groupState[indexCat] && subState[subKey]) ? '' : 'none';
          trItem.dataset.itemIndex = String(itemIdx);
          trItem.innerHTML = `
            <td class="category-accnum col-code">${code}</td>
            <td class="image-cell col-image">
              ${imageUrl ? `<img src="${imageUrl}" alt="" class="item-thumbnail" onerror="this.style.display='none'">` : '—'}
            </td>
            <td class="col-name">
              <div class="item-name">
                <span class="item-name-text">${name}</span>
                ${compBadge}
                ${typeBadgesHtml}
              </div>
            </td>
            <td class="col-qty">
              <input type="number" class="inline-qty-input" value="${qty || 0}" min="0" step="any"
                data-cat="${indexCat}" data-sub="${indexSub}" data-item="${itemIdx}">
            </td>
            <td class="col-unit">${unit || '—'}</td>
            <td class="col-unit-cost">${unitCost !== '' ? formatCurrency(unitCost) : '—'}</td>
            <td class="col-subtotal">${subtotalItem !== '' ? formatCurrency(subtotalItem) : '—'}</td>
            <td class="col-total">${totalItem !== '' ? formatCurrency(totalItem) : '—'}</td>
          `;
          els.tbody.appendChild(trItem);
        });
      });
    });

    applyTableFilter(currentFilter);
  }

  function toggleGroup(indexCat) {
    groupState[indexCat] = !groupState[indexCat];
    // Clear selection if it was inside this collapsed category
    if (!groupState[indexCat] && selectedRow && String(selectedRow.catIndex) === String(indexCat)) {
      selectedRow = null;
      els.tbody?.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));
    }
    applyTableFilter(currentFilter);
  }

  function toggleSub(catIndex, subIndex) {
    const key = `${catIndex}-${subIndex}`;
    subState[key] = !subState[key];
    // Clear selection if it was inside this collapsed subcategory
    if (!subState[key] && selectedRow &&
        String(selectedRow.catIndex) === String(catIndex) &&
        String(selectedRow.subIndex) === String(subIndex)) {
      selectedRow = null;
      els.tbody?.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));
    }
    applyTableFilter(currentFilter);
  }

  // ================================
  // FILTER
  // ================================

  function applyTableFilter(rawTerm) {
    currentFilter = (rawTerm || '').trim().toLowerCase();
    if (!els.tbody) return;

    const rows = els.tbody.querySelectorAll('tr');

    if (!currentFilter) {
      // No filter - respect collapse state
      rows.forEach(row => {
        const isGroup = row.classList.contains('group-row');
        const isCategoryRow = row.classList.contains('category-row');
        const isItemRow = row.classList.contains('item-row');

        let visible = true;

        if (isCategoryRow) {
          const parentIndex = row.dataset.parentIndex;
          visible = groupState[parentIndex] !== false;
        }

        if (isItemRow) {
          const catIndex = row.dataset.catIndex;
          const subIndex = row.dataset.subIndex;
          visible = groupState[catIndex] !== false;
          if (visible) {
            const key = `${catIndex}-${subIndex}`;
            visible = subState[key] !== false;
          }
        }

        row.style.display = visible ? '' : 'none';
      });
      return;
    }

    // With filter - show matching items and their parents
    rows.forEach(row => row.style.display = 'none');

    const shownGroups = new Set();
    const shownSubRows = new Set();

    // Check items
    const itemRows = els.tbody.querySelectorAll('tr.item-row');
    itemRows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (text.includes(currentFilter)) {
        row.style.display = '';
        shownGroups.add(row.dataset.catIndex);
        shownSubRows.add(`${row.dataset.catIndex}-${row.dataset.subIndex}`);
      }
    });

    // Show matching subcategories
    const subRows = els.tbody.querySelectorAll('tr.category-row[data-sub-row]');
    subRows.forEach(row => {
      const key = `${row.dataset.parentIndex}-${row.dataset.subRow}`;
      const text = row.innerText.toLowerCase();
      if (text.includes(currentFilter) || shownSubRows.has(key)) {
        row.style.display = '';
        shownGroups.add(row.dataset.parentIndex);
      }
    });

    // Show parent categories
    const groupRows = els.tbody.querySelectorAll('tr.group-row');
    groupRows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (text.includes(currentFilter) || shownGroups.has(row.dataset.groupIndex)) {
        row.style.display = '';
      }
    });
  }

  function setupSearchFilter() {
    if (!els.searchInput) return;

    els.searchInput.addEventListener('input', (e) => {
      applyTableFilter(e.target.value);
    });
  }

  // ================================
  // VIEW SLIDERS
  // ================================

  function setupViewSliders() {
    if (els.widthSlider) {
      els.widthSlider.addEventListener('input', (e) => {
        const v = Number(e.target.value) || 100;
        document.documentElement.style.setProperty('--estimator-table-width', v);
      });
    }

    if (els.zoomSlider) {
      els.zoomSlider.addEventListener('input', (e) => {
        const v = Number(e.target.value) || 100;
        document.documentElement.style.setProperty('--estimator-table-zoom', v);
      });
    }
  }

  // ================================
  // TOOLBAR HANDLERS
  // ================================

  function handleNewEstimate() {
    console.log('[ESTIMATOR] handleNewEstimate called, isDirty:', isDirty);
    if (isDirty) {
      const shouldProceed = window.confirm('You have unsaved changes. Create new estimate anyway?');
      if (!shouldProceed) return;
    }
    console.log('[ESTIMATOR] Opening template picker modal...');
    openTemplatePickerModal();
  }

  // ================================
  // ADD CONCEPT MODAL
  // ================================

  function handleAddConcept(preselectCatIndex, preselectSubIndex) {
    // Reset state
    addConceptState = {
      selectedConcept: null,
      builderItems: [],
      mode: 'from-template',
      targetCatIndex: preselectCatIndex ?? null,
      targetSubIndex: preselectSubIndex ?? null
    };

    // Ensure we have catalog data
    if (templateCache.concepts.length === 0) {
      showFeedback('Loading catalog...', 'info');
      refreshCatalogFromDB().then(() => {
        openAddConceptModal(preselectCatIndex);
      });
    } else {
      openAddConceptModal(preselectCatIndex);
    }
  }

  function openAddConceptModal(preselectCatIndex) {
    if (!els.addConceptModal) return;

    // Populate the concept picker table
    populateConceptPicker();

    // Update insert-target label
    const targetLabel = document.getElementById('add-concept-insert-target');
    if (targetLabel && preselectCatIndex != null && currentEstimateData) {
      const cat = currentEstimateData.categories[preselectCatIndex];
      if (cat) {
        const subIdx = addConceptState.targetSubIndex;
        const sub = (subIdx != null && cat.subcategories?.[subIdx])
          ? cat.subcategories[subIdx] : null;
        const label = sub ? `${cat.name} > ${sub.name}` : cat.name;
        targetLabel.textContent = label;
        targetLabel.classList.add('has-target');
      } else {
        targetLabel.textContent = 'Select a row in the table first';
        targetLabel.classList.remove('has-target');
      }
    } else if (targetLabel) {
      targetLabel.textContent = 'Select a row in the table first';
      targetLabel.classList.remove('has-target');
    }

    // Reset form
    document.getElementById('add-concept-qty').value = '1';
    document.getElementById('add-concept-save-to-db').checked = false;
    document.getElementById('add-concept-confirm').disabled = true;

    // Reset category filter so it repopulates from current cache
    const catSelect = document.getElementById('concept-picker-category');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">All Categories</option>';
    }

    // Clear preview
    document.getElementById('concept-preview-content').innerHTML =
      '<p class="preview-empty">Select a concept from the table to see its details and line items.</p>';

    // Show modal
    els.addConceptModal.classList.remove('hidden');
  }

  function closeAddConceptModal() {
    els.addConceptModal?.classList.add('hidden');
    addConceptState.selectedConcept = null;
  }

  function populateConceptPicker(filterText = '') {
    const tbody = document.getElementById('concept-picker-body');
    if (!tbody) return;

    const searchTerm = filterText.toLowerCase().trim();
    const concepts = templateCache.concepts;

    // Populate category filter dropdown with unique categories
    const categorySelect = document.getElementById('concept-picker-category');
    if (categorySelect && categorySelect.options.length <= 1) {
      const cats = [...new Set(concepts.map(c => c.category_name).filter(Boolean))].sort();
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
      });
    }

    const selectedCategory = categorySelect?.value || '';

    if (concepts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-cell-muted" style="text-align: center; padding: 40px;">
            No concepts available. Try refreshing the catalog.
          </td>
        </tr>
      `;
      return;
    }

    // Filter concepts by search + category
    let filtered = concepts;
    if (selectedCategory) {
      filtered = filtered.filter(c => c.category_name === selectedCategory);
    }
    if (searchTerm) {
      filtered = filtered.filter(c =>
        (c.code || '').toLowerCase().includes(searchTerm) ||
        (c.short_description || '').toLowerCase().includes(searchTerm) ||
        (c.category_name || '').toLowerCase().includes(searchTerm)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="table-cell-muted" style="text-align: center; padding: 40px;">
            No concepts match your search.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map(concept => {
      // Determine types from line items
      const lineItems = templateCache.conceptMaterials.filter(
        cm => cm.concept_id === concept.id
      );

      const types = new Set();
      lineItems.forEach(li => {
        const type = li.item_type || li.type || 'material';
        types.add(type);
      });

      // Also check builder.items if present
      if (concept.builder && concept.builder.items) {
        concept.builder.items.forEach(item => {
          if (item.isPercent) {
            types.add('percent');
          } else {
            types.add(item.type || 'material');
          }
        });
      }

      let typeBadges = '';
      if (types.has('material')) typeBadges += '<span class="type-badge type-material">MAT</span>';
      if (types.has('labor')) typeBadges += '<span class="type-badge type-labor">LAB</span>';
      if (types.has('external')) typeBadges += '<span class="type-badge type-external">EXT</span>';
      if (types.has('percent')) typeBadges += '<span class="type-badge type-percent">%</span>';

      return `
        <tr data-concept-id="${concept.id}">
          <td><code style="color: #3ecf8e;">${escapeHtml(concept.code || '')}</code></td>
          <td>${escapeHtml(concept.short_description || concept.name || '')}</td>
          <td>${escapeHtml(concept.unit_name || concept.unit || 'Ea')}</td>
          <td>${formatCurrency(concept.calculated_cost || concept.base_cost || 0)}</td>
          <td><div class="concept-types">${typeBadges || '-'}</div></td>
        </tr>
      `;
    }).join('');

  }

  function selectConceptForAdd(row) {
    // Remove previous selection
    document.querySelectorAll('#concept-picker-body tr.selected').forEach(r =>
      r.classList.remove('selected')
    );

    // Mark as selected
    row.classList.add('selected');

    // Look up concept from cache by ID (avoids storing full object in DOM)
    const conceptId = row.dataset.conceptId;
    const concept = templateCache.concepts.find(c => c.id === conceptId);
    if (!concept) {
      console.error('[ESTIMATOR] Concept not found in cache:', conceptId);
      showFeedback('Concept not found in catalog. Try refreshing.', 'error');
      return;
    }

    addConceptState.selectedConcept = concept;

    // Enable confirm button
    document.getElementById('add-concept-confirm').disabled = false;

    // Show preview
    showConceptPreview(concept);
  }

  function showConceptPreview(concept) {
    const previewEl = document.getElementById('concept-preview-content');
    if (!previewEl) return;

    // Get line items
    const lineItems = templateCache.conceptMaterials.filter(
      cm => cm.concept_id === concept.id
    );

    // Also include builder items if present
    let allItems = lineItems.map(li => {
      const material = templateCache.materials.find(m => m.id === li.material_id);
      return {
        type: li.item_type || li.type || 'material',
        description: li.description || material?.short_description || li.material_id,
        unit: li.unit_name || material?.unit_name || 'Ea',
        qty: li.quantity || 1,
        unitCost: li.unit_cost || li.unit_cost_override || material?.price_numeric || 0
      };
    });

    // Add builder items if they exist
    if (concept.builder && concept.builder.items) {
      concept.builder.items.forEach(item => {
        if (item.type !== 'material' || !item.materialId) {
          // Only add non-material items or inline items
          allItems.push({
            type: item.type || 'material',
            description: item.description,
            unit: item.unit || 'Ea',
            qty: item.qty || 1,
            unitCost: item.unitCost || item.unit_cost || 0
          });
        }
      });
    }

    // Build preview HTML
    const itemsHtml = allItems.length > 0
      ? allItems.map(item => {
          const badge = getTypeBadgeHtml(item.type);
          return `
            <div class="preview-line-item">
              ${badge}
              <span class="item-desc">${escapeHtml(item.description)}</span>
              <span class="item-qty">${item.qty} ${escapeHtml(item.unit)}</span>
              <span class="item-cost">${formatCurrency(item.unitCost)}</span>
            </div>
          `;
        }).join('')
      : '<p class="preview-empty">No line items defined for this concept.</p>';

    previewEl.innerHTML = `
      <div class="preview-concept-info">
        <div class="preview-concept-header">
          <span class="preview-concept-code">${escapeHtml(concept.code)}</span>
          <span class="preview-concept-name">${escapeHtml(concept.short_description || '')}</span>
          <span class="preview-concept-cost">${formatCurrency(concept.calculated_cost || concept.base_cost || 0)}</span>
        </div>
        <div class="preview-line-items">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  function getTypeBadgeHtml(type) {
    const badges = {
      material: '<span class="type-badge type-material">MAT</span>',
      labor: '<span class="type-badge type-labor">LAB</span>',
      external: '<span class="type-badge type-external">EXT</span>'
    };
    return badges[type] || badges.material;
  }

  async function confirmAddConcept() {
    if (!addConceptState.selectedConcept) {
      showFeedback('Please select a concept', 'error');
      return;
    }

    const qty = parseFloat(document.getElementById('add-concept-qty').value) || 1;
    if (qty <= 0) {
      showFeedback('Quantity must be greater than 0', 'error');
      return;
    }
    const saveToDb = document.getElementById('add-concept-save-to-db').checked;
    const concept = addConceptState.selectedConcept;

    // Add to estimate
    addConceptToEstimate(concept, qty);

    // Optionally save to database
    if (saveToDb) {
      await saveConceptToDatabase(concept);
    }

    closeAddConceptModal();
  }

  function addConceptToEstimate(concept, qty) {
    if (!currentEstimateData) {
      currentEstimateData = {
        project_name: 'New Estimate',
        project: {},
        categories: [],
        overhead: { percentage: 0, amount: 0 }
      };
    }

    // Determine target category from right-click context
    const catIdx = addConceptState.targetCatIndex;
    let targetCategory = (catIdx != null && currentEstimateData.categories[catIdx])
      ? currentEstimateData.categories[catIdx]
      : null;

    if (!targetCategory) {
      // Fallback: find or create category based on concept's category
      const categoryName = concept.category_name || 'General';
      targetCategory = currentEstimateData.categories.find(
        c => c.name === categoryName || c.id === concept.category_id
      );

      if (!targetCategory) {
        targetCategory = {
          id: concept.category_id || 'CAT-' + Date.now(),
          name: categoryName,
          total_cost: 0,
          subcategories: [{
            name: 'Items',
            total_cost: 0,
            items: []
          }]
        };
        currentEstimateData.categories.push(targetCategory);
      }
    }

    // Ensure subcategories exist
    if (!targetCategory.subcategories || targetCategory.subcategories.length === 0) {
      targetCategory.subcategories = [{
        name: 'Items',
        total_cost: 0,
        items: []
      }];
    }

    // Get line items with their types for badge display
    const lineItems = templateCache.conceptMaterials
      .filter(cm => cm.concept_id === concept.id)
      .map(cm => {
        const material = templateCache.materials.find(m => m.id === cm.material_id);
        return {
          type: cm.item_type || cm.type || 'material',
          description: cm.description || material?.short_description || cm.material_id,
          unit: cm.unit_name || material?.unit_name || 'Ea',
          qty: cm.quantity || 1,
          unitCost: cm.unit_cost || cm.unit_cost_override || material?.price_numeric || 0
        };
      });

    // Also add builder items (custom materials, labor, external, percent)
    if (concept.builder && concept.builder.items) {
      concept.builder.items.forEach(item => {
        // Skip DB-origin materials (already loaded from concept_materials above)
        if (item.origin === 'db' && !item.isPercent) return;

        if (item.isPercent) {
          lineItems.push({
            type: 'percent',
            description: item.description,
            unit: item.unit || '(%)',
            qty: 1,
            unitCost: 0,
            isPercent: true,
            appliesTo: item.appliesTo,
            percentValue: item.percentValue
          });
        } else {
          lineItems.push({
            type: item.type || 'material',
            description: item.description,
            unit: item.unit || 'Ea',
            qty: item.qty || 1,
            unitCost: item.unitCost || item.unit_cost || 0
          });
        }
      });
    }

    const unitCost = concept.calculated_cost || concept.base_cost || 0;

    // Warn if concept has no line items and no cost
    if (lineItems.length === 0 && unitCost === 0) {
      console.warn('[ESTIMATOR] Concept has no line items and $0 cost:', concept.code);
      showFeedback(`Warning: "${concept.code}" has no line items and $0 cost`, 'warning');
    }

    // Create new item
    const newItem = {
      id: concept.code + '-' + Date.now(),
      code: concept.code,
      name: concept.short_description || concept.name,
      description: concept.full_description || '',
      concept_id: concept.id,
      qty: qty,
      quantity: qty,
      unit: concept.unit_name || concept.unit || 'Ea',
      unit_cost: unitCost,
      base_cost: unitCost,
      total: qty * unitCost,
      total_cost: qty * unitCost,
      line_items: lineItems
    };

    // Add to the right-clicked subcategory, or fall back to first
    const subIdx = addConceptState.targetSubIndex;
    const targetSub = (subIdx != null && targetCategory.subcategories[subIdx])
      ? targetCategory.subcategories[subIdx]
      : targetCategory.subcategories[0];
    targetSub.items.push(newItem);

    // Recalculate totals
    recalculateEstimateTotals();

    // Mark dirty and re-render
    markDirty();
    renderEstimate();

    showFeedback(`Added "${concept.short_description || concept.code}" (x${qty}) to estimate`, 'success');
  }

  // ================================
  // ADD CUSTOM ITEM
  // ================================

  let customItemMode = 'simple';
  let customLineItems = [];

  function openCustomItemModal() {
    const modal = document.getElementById('custom-item-modal');
    if (!modal) return;

    customItemMode = 'simple';
    customLineItems = [];

    // Reset fields
    document.getElementById('custom-item-name').value = '';
    document.getElementById('custom-item-desc').value = '';
    document.getElementById('custom-item-unit').value = 'Ea';
    document.getElementById('custom-item-qty').value = '1';
    document.getElementById('custom-item-cost').value = '0';

    // Reset toggle
    modal.querySelectorAll('.custom-mode-btn').forEach(b => b.classList.remove('active'));
    modal.querySelector('[data-mode="simple"]').classList.add('active');
    document.getElementById('custom-item-cost-group').classList.remove('hidden');
    document.getElementById('custom-item-lines-section').classList.add('hidden');
    document.getElementById('custom-lines-body').innerHTML = '';
    document.getElementById('custom-item-calc-cost').textContent = '$0.00';

    modal.classList.remove('hidden');
    document.getElementById('custom-item-name').focus();
  }

  function closeCustomItemModal() {
    document.getElementById('custom-item-modal')?.classList.add('hidden');
  }

  function toggleCustomMode(mode) {
    customItemMode = mode;
    const modal = document.getElementById('custom-item-modal');
    modal.querySelectorAll('.custom-mode-btn').forEach(b => b.classList.remove('active'));
    modal.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    if (mode === 'simple') {
      document.getElementById('custom-item-cost-group').classList.remove('hidden');
      document.getElementById('custom-item-lines-section').classList.add('hidden');
    } else {
      document.getElementById('custom-item-cost-group').classList.add('hidden');
      document.getElementById('custom-item-lines-section').classList.remove('hidden');
    }
  }

  function renderCustomLineItems() {
    const tbody = document.getElementById('custom-lines-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    customLineItems.forEach((li, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <select class="edit-item-input cli-type" data-idx="${idx}" style="padding: 4px 6px; font-size: 12px;">
            <option value="material" ${li.type === 'material' ? 'selected' : ''}>Material</option>
            <option value="labor" ${li.type === 'labor' ? 'selected' : ''}>Labor</option>
            <option value="external" ${li.type === 'external' ? 'selected' : ''}>External</option>
          </select>
        </td>
        <td><input type="text" class="edit-item-input cli-desc" data-idx="${idx}" value="${escapeHtml(li.description)}" style="padding: 4px 6px; font-size: 12px;"></td>
        <td><input type="text" class="edit-item-input cli-unit" data-idx="${idx}" value="${escapeHtml(li.unit)}" style="padding: 4px 6px; font-size: 12px;"></td>
        <td><input type="number" class="edit-item-input cli-qty" data-idx="${idx}" value="${li.qty}" min="0" step="any" style="padding: 4px 6px; font-size: 12px; width: 100%;"></td>
        <td><input type="number" class="edit-item-input cli-cost" data-idx="${idx}" value="${li.unitCost}" min="0" step="any" style="padding: 4px 6px; font-size: 12px; width: 100%;"></td>
        <td><button type="button" class="cli-remove" data-idx="${idx}" title="Remove">&times;</button></td>
      `;
      tbody.appendChild(tr);
    });

    recalcCustomCost();
  }

  function recalcCustomCost() {
    // Sync values from inputs
    const tbody = document.getElementById('custom-lines-body');
    if (tbody) {
      tbody.querySelectorAll('.cli-type').forEach(el => {
        customLineItems[+el.dataset.idx].type = el.value;
      });
      tbody.querySelectorAll('.cli-desc').forEach(el => {
        customLineItems[+el.dataset.idx].description = el.value;
      });
      tbody.querySelectorAll('.cli-unit').forEach(el => {
        customLineItems[+el.dataset.idx].unit = el.value;
      });
      tbody.querySelectorAll('.cli-qty').forEach(el => {
        customLineItems[+el.dataset.idx].qty = parseFloat(el.value) || 0;
      });
      tbody.querySelectorAll('.cli-cost').forEach(el => {
        customLineItems[+el.dataset.idx].unitCost = parseFloat(el.value) || 0;
      });
    }

    const total = customLineItems.reduce((sum, li) => sum + (li.qty * li.unitCost), 0);
    const el = document.getElementById('custom-item-calc-cost');
    if (el) el.textContent = formatCurrency(total);
  }

  function confirmCustomItem() {
    const name = document.getElementById('custom-item-name').value.trim();
    if (!name) {
      showFeedback('Please enter an item name', 'error');
      return;
    }

    const desc = document.getElementById('custom-item-desc').value.trim();
    const unit = document.getElementById('custom-item-unit').value.trim() || 'Ea';
    const qty = parseFloat(document.getElementById('custom-item-qty').value) || 1;

    let unitCost = 0;
    let lineItems = [];

    if (customItemMode === 'simple') {
      unitCost = parseFloat(document.getElementById('custom-item-cost').value) || 0;
    } else {
      recalcCustomCost();
      lineItems = customLineItems.map(li => ({
        type: li.type,
        description: li.description,
        unit: li.unit,
        qty: li.qty,
        unitCost: li.unitCost
      }));
      unitCost = lineItems.reduce((sum, li) => sum + (li.qty * li.unitCost), 0);
    }

    // Determine target from selectedRow
    if (!currentEstimateData) {
      currentEstimateData = {
        project_name: 'New Estimate',
        project: {},
        categories: [],
        overhead: { percentage: 0, amount: 0 }
      };
    }

    const catIdx = selectedRow ? selectedRow.catIndex : null;
    const subIdx = selectedRow ? selectedRow.subIndex : null;

    let targetCategory = (catIdx != null && currentEstimateData.categories[catIdx])
      ? currentEstimateData.categories[catIdx] : null;

    if (!targetCategory) {
      targetCategory = currentEstimateData.categories[0];
      if (!targetCategory) {
        targetCategory = { id: 'CAT-' + Date.now(), name: 'General', total_cost: 0, subcategories: [{ name: 'Items', total_cost: 0, items: [] }] };
        currentEstimateData.categories.push(targetCategory);
      }
    }

    if (!targetCategory.subcategories || targetCategory.subcategories.length === 0) {
      targetCategory.subcategories = [{ name: 'Items', total_cost: 0, items: [] }];
    }

    const targetSub = (subIdx != null && targetCategory.subcategories[subIdx])
      ? targetCategory.subcategories[subIdx]
      : targetCategory.subcategories[0];

    const newItem = {
      id: 'CUSTOM-' + Date.now(),
      code: '',
      name: name,
      description: desc,
      origin: 'custom',
      qty: qty,
      quantity: qty,
      unit: unit,
      unit_cost: unitCost,
      base_cost: unitCost,
      total: qty * unitCost,
      total_cost: qty * unitCost,
      line_items: lineItems
    };

    targetSub.items.push(newItem);

    recalculateEstimateTotals();
    markDirty();
    renderEstimate();
    closeCustomItemModal();

    showFeedback(`Added custom item "${name}" (x${qty})`, 'success');
  }

  // Wire custom item modal events
  (function initCustomItemModal() {
    const modal = document.getElementById('custom-item-modal');
    if (!modal) return;

    modal.querySelector('#custom-item-close')?.addEventListener('click', closeCustomItemModal);
    modal.querySelector('#custom-item-cancel')?.addEventListener('click', closeCustomItemModal);
    modal.querySelector('#custom-item-confirm')?.addEventListener('click', confirmCustomItem);

    // Mode toggle
    modal.querySelectorAll('.custom-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleCustomMode(btn.dataset.mode));
    });

    // Add line
    modal.querySelector('#custom-add-line')?.addEventListener('click', () => {
      customLineItems.push({ type: 'material', description: '', unit: 'Ea', qty: 1, unitCost: 0 });
      renderCustomLineItems();
    });

    // Delegate: remove line + recalc on input
    const linesBody = document.getElementById('custom-lines-body');
    linesBody?.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.cli-remove');
      if (removeBtn) {
        customLineItems.splice(+removeBtn.dataset.idx, 1);
        renderCustomLineItems();
      }
    });
    linesBody?.addEventListener('input', () => recalcCustomCost());
  })();

  function openEditItemModal() {
    if (!selectedRow || selectedRow.itemIndex == null || !currentEstimateData) return;

    const { catIndex, subIndex, itemIndex } = selectedRow;
    const cat = currentEstimateData.categories[catIndex];
    if (!cat) return;
    const sub = cat.subcategories?.[subIndex];
    if (!sub || !sub.items?.[itemIndex]) return;

    const item = sub.items[itemIndex];

    const overlay = document.createElement('div');
    overlay.className = 'move-concept-overlay';
    overlay.innerHTML = `
      <div class="move-concept-panel" style="min-width: 380px;">
        <h4>Edit Item</h4>
        <p class="move-concept-desc">${escapeHtml(item.code || item.id || '')}</p>
        <div class="edit-item-fields">
          <label class="edit-item-label">Name
            <input type="text" class="edit-item-input" id="edit-item-name" value="${escapeHtml(item.name || '')}">
          </label>
          <label class="edit-item-label">Description
            <input type="text" class="edit-item-input" id="edit-item-desc" value="${escapeHtml(item.description || '')}">
          </label>
          <div style="display: flex; gap: 10px;">
            <label class="edit-item-label" style="flex:1;">Unit
              <input type="text" class="edit-item-input" id="edit-item-unit" value="${escapeHtml(item.unit || '')}">
            </label>
            <label class="edit-item-label" style="flex:1;">Unit Cost
              <input type="number" class="edit-item-input" id="edit-item-cost" value="${item.unit_cost ?? item.base_cost ?? 0}" min="0" step="any">
            </label>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="move-concept-cancel" id="edit-item-cancel" style="flex:1;">Cancel</button>
          <button class="move-concept-cancel" id="edit-item-save" style="flex:1; border-color: #3ecf8e; color: #3ecf8e;">Save</button>
        </div>
      </div>
    `;

    overlay.querySelector('#edit-item-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#edit-item-save').addEventListener('click', () => {
      item.name = document.getElementById('edit-item-name').value.trim() || item.name;
      item.description = document.getElementById('edit-item-desc').value.trim();
      item.unit = document.getElementById('edit-item-unit').value.trim() || item.unit;
      const newCost = parseFloat(document.getElementById('edit-item-cost').value);
      if (!isNaN(newCost) && newCost >= 0) {
        const oldCost = item.unit_cost || item.base_cost || 0;
        item.unit_cost = newCost;
        item.base_cost = newCost;

        // Scale line_items proportionally so breakdown stays consistent
        if (Array.isArray(item.line_items) && item.line_items.length > 0 && oldCost > 0) {
          const ratio = newCost / oldCost;
          item.line_items.forEach(li => {
            if (!li.isPercent && typeof li.unitCost === 'number') {
              li.unitCost = Math.round(li.unitCost * ratio * 100) / 100;
            }
          });
        }
      }

      recalculateEstimateTotals();
      markDirty();
      renderEstimate();
      overlay.remove();
      showFeedback(`Updated "${item.name}"`, 'success');
    });

    document.body.appendChild(overlay);
    overlay.querySelector('#edit-item-name').focus();
  }

  function deleteSelectedConcept() {
    if (!selectedRow || selectedRow.itemIndex == null || !currentEstimateData) return;

    const { catIndex, subIndex, itemIndex } = selectedRow;
    const cat = currentEstimateData.categories[catIndex];
    if (!cat) return;
    const sub = cat.subcategories?.[subIndex];
    if (!sub || !sub.items?.[itemIndex]) return;

    const item = sub.items[itemIndex];
    const itemName = item.name || item.code || 'Concept';

    sub.items.splice(itemIndex, 1);

    selectedRow = null;
    recalculateEstimateTotals();
    markDirty();
    renderEstimate();

    showFeedback(`Removed "${itemName}" from estimate`, 'success');
  }

  function openMoveConceptPicker() {
    if (!selectedRow || selectedRow.itemIndex == null || !currentEstimateData) return;

    const { catIndex, subIndex, itemIndex } = selectedRow;
    const cat = currentEstimateData.categories[catIndex];
    if (!cat) return;
    const sub = cat.subcategories?.[subIndex];
    if (!sub || !sub.items?.[itemIndex]) return;

    const item = sub.items[itemIndex];
    const itemName = item.name || item.code || 'Concept';

    // Build subcategory list across all categories
    let listHtml = '';
    currentEstimateData.categories.forEach((c, ci) => {
      if (!c.subcategories || c.subcategories.length === 0) return;
      listHtml += `<li class="move-cat-header">${escapeHtml(c.name)}</li>`;
      c.subcategories.forEach((s, si) => {
        const isCurrent = ci === catIndex && si === subIndex;
        listHtml += `<li data-cat="${ci}" data-sub="${si}" class="${isCurrent ? 'current' : ''}">${escapeHtml(s.name)}${isCurrent ? ' (current)' : ''}</li>`;
      });
    });

    const overlay = document.createElement('div');
    overlay.className = 'move-concept-overlay';
    overlay.innerHTML = `
      <div class="move-concept-panel">
        <h4>Move "${escapeHtml(itemName)}"</h4>
        <p class="move-concept-desc">Select the target subcategory</p>
        <ul class="move-concept-list">${listHtml}</ul>
        <button class="move-concept-cancel">Cancel</button>
      </div>
    `;

    overlay.querySelector('.move-concept-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('.move-concept-list').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-cat]');
      if (!li || li.classList.contains('current')) return;

      const targetCat = parseInt(li.dataset.cat, 10);
      const targetSub = parseInt(li.dataset.sub, 10);

      // Remove from source
      const movedItem = sub.items.splice(itemIndex, 1)[0];

      // Add to target
      const dest = currentEstimateData.categories[targetCat]?.subcategories?.[targetSub];
      if (dest) {
        dest.items.push(movedItem);
      } else {
        sub.items.splice(itemIndex, 0, movedItem);
        showFeedback('Target subcategory not found', 'error');
        overlay.remove();
        return;
      }

      selectedRow = null;
      recalculateEstimateTotals();
      markDirty();
      renderEstimate();
      overlay.remove();

      const destCatName = currentEstimateData.categories[targetCat]?.name || '';
      const destSubName = dest.name || '';
      showFeedback(`Moved "${itemName}" to ${destCatName} > ${destSubName}`, 'success');
    });

    document.body.appendChild(overlay);
  }

  function recalculateEstimateTotals() {
    if (!currentEstimateData || !currentEstimateData.categories) return;

    let grandTotal = 0;

    currentEstimateData.categories.forEach(cat => {
      let categoryTotal = 0;

      cat.subcategories?.forEach(sub => {
        let subTotal = 0;

        sub.items?.forEach(item => {
          const itemTotal = (item.qty || item.quantity || 0) * (item.unit_cost || item.base_cost || 0);
          item.total = itemTotal;
          item.total_cost = itemTotal;
          subTotal += itemTotal;
        });

        sub.total_cost = subTotal;
        sub.total = subTotal;
        categoryTotal += subTotal;
      });

      cat.total_cost = categoryTotal;
      cat.total = categoryTotal;
      grandTotal += categoryTotal;
    });

    // Apply overhead (additive: each line % applied to same base subtotal)
    let overheadPct = 0;
    if (Array.isArray(currentEstimateData.overhead?.items)) {
      overheadPct = currentEstimateData.overhead.items
        .filter(i => i.enabled)
        .reduce((sum, i) => sum + (i.percentage || 0), 0);
      currentEstimateData.overhead.totalPercentage = overheadPct;
    } else {
      // Backward compat: old single-percentage format
      overheadPct = currentEstimateData.overhead?.percentage || 0;
    }
    const overheadAmount = grandTotal * (overheadPct / 100);
    if (!currentEstimateData.overhead) currentEstimateData.overhead = {};
    currentEstimateData.overhead.amount = overheadAmount;
    currentEstimateData.subtotal = grandTotal;
    currentEstimateData.total = grandTotal + overheadAmount;
  }

  function setupAddConceptModal() {
    if (!els.addConceptModal) return;

    // Close button
    document.getElementById('add-concept-close')?.addEventListener('click', closeAddConceptModal);

    // Cancel button
    document.getElementById('add-concept-cancel')?.addEventListener('click', closeAddConceptModal);

    // Confirm button
    document.getElementById('add-concept-confirm')?.addEventListener('click', confirmAddConcept);

    // Search input
    const searchInput = document.getElementById('concept-picker-search');
    searchInput?.addEventListener('input', (e) => {
      populateConceptPicker(e.target.value);
    });

    // Category filter dropdown
    const categoryFilter = document.getElementById('concept-picker-category');
    categoryFilter?.addEventListener('change', () => {
      const searchVal = document.getElementById('concept-picker-search')?.value || '';
      populateConceptPicker(searchVal);
    });

    // Concept picker rows - delegated click (survive re-renders from search)
    const cpBody = document.getElementById('concept-picker-body');
    cpBody?.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-concept-id]');
      if (row) selectConceptForAdd(row);
    });

    // Click backdrop to close
    els.addConceptModal.addEventListener('click', (e) => {
      if (e.target === els.addConceptModal) closeAddConceptModal();
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.addConceptModal.classList.contains('hidden')) {
        closeAddConceptModal();
      }
    });
  }

  // Helper to escape HTML
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Save a concept to the database
   * Used when user checks "Also save to database" in add concept modal
   * @param {object} concept - Concept data to save
   */
  async function saveConceptToDatabase(concept) {
    if (!concept) return;

    try {
      showFeedback('Saving concept to database...', 'info');

      // Prepare concept data for API
      const conceptData = {
        code: concept.code,
        short_description: concept.short_description || concept.name,
        full_description: concept.full_description || '',
        category_id: concept.category_id || null,
        unit_id: concept.unit_id || null,
        base_cost: concept.calculated_cost || concept.base_cost || 0,
        calculated_cost: concept.calculated_cost || concept.base_cost || 0,
        waste_percent: concept.waste_percent || 0,
        is_active: true
      };

      // If concept has builder data, include it
      if (concept.builder) {
        conceptData.builder = concept.builder;
      }

      // Check if concept already exists by code
      let existingConcept = null;
      try {
        const checkRes = await fetch(`${API_BASE}/concepts?code=${encodeURIComponent(concept.code)}`, {
          method: 'GET',
          headers: { ...getAuthHeaders() },
          credentials: 'include'
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.data && checkData.data.length > 0) {
            existingConcept = checkData.data[0];
          }
        }
      } catch (err) {
        console.warn('[ESTIMATOR] Could not check existing concept:', err);
      }

      let savedConceptId = null;

      if (existingConcept) {
        // Update existing concept
        const updateRes = await fetch(`${API_BASE}/concepts/${existingConcept.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify(conceptData)
        });

        if (!updateRes.ok) {
          throw new Error('Failed to update concept');
        }

        savedConceptId = existingConcept.id;
        showFeedback(`Concept "${concept.code}" updated in database`, 'success');
      } else {
        // Create new concept
        const createRes = await fetch(`${API_BASE}/concepts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify(conceptData)
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.detail || 'Failed to create concept');
        }

        const createData = await createRes.json();
        savedConceptId = createData.id || createData.data?.id;
        showFeedback(`Concept "${concept.code}" saved to database`, 'success');
      }

      // Save concept materials if we have a valid ID and materials
      if (savedConceptId) {
        const materials = templateCache.conceptMaterials.filter(
          cm => cm.concept_id === concept.id
        );

        for (const mat of materials) {
          try {
            await fetch(`${API_BASE}/concepts/${savedConceptId}/materials`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
              credentials: 'include',
              body: JSON.stringify({
                material_id: mat.material_id,
                quantity: mat.quantity || 1,
                unit_cost_override: mat.unit_cost || mat.unit_cost_override || null,
                item_type: mat.item_type || mat.type || 'material',
                description: mat.description || ''
              })
            });
          } catch (err) {
            console.warn('[ESTIMATOR] Could not save concept material:', err);
          }
        }
      }

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] Error saving concept to DB:', err);
      showFeedback('Error saving concept: ' + err.message, 'error');
      return false;
    }
  }

  // ================================
  // OVERHEAD MODAL
  // ================================

  const DEFAULT_OVERHEAD_ITEMS = [
    { name: 'Profit', percentage: 25, enabled: true },
    { name: 'Referral Fee', percentage: 7, enabled: true },
    { name: 'Base Materials', percentage: 3, enabled: true },
    { name: 'Finish Details', percentage: 1.5, enabled: true },
    { name: 'Pad', percentage: 5, enabled: true }
  ];

  // Temporary working copy while modal is open
  let overheadWorkingItems = [];

  function getDefaultOverhead() {
    return {
      items: DEFAULT_OVERHEAD_ITEMS.map(i => ({ ...i })),
      totalPercentage: 0,
      amount: 0
    };
  }

  function handleOverhead() {
    openOverheadModal();
  }

  function setupOverheadModal() {
    const modal = els.overheadModal;
    if (!modal) return;

    document.getElementById('overhead-close-btn')?.addEventListener('click', closeOverheadModal);
    document.getElementById('overhead-cancel-btn')?.addEventListener('click', closeOverheadModal);
    document.getElementById('overhead-save-btn')?.addEventListener('click', saveOverheadFromModal);
    document.getElementById('overhead-add-line')?.addEventListener('click', addOverheadLine);

    // Delegated events for overhead table rows (survive re-renders)
    const ohTbody = document.getElementById('overhead-table-body');
    if (ohTbody) {
      ohTbody.addEventListener('change', (e) => {
        const toggle = e.target.closest('.oh-toggle');
        if (toggle) {
          const i = parseInt(toggle.dataset.idx, 10);
          overheadWorkingItems[i].enabled = toggle.checked;
          renderOverheadTable();
          return;
        }
        const pctInput = e.target.closest('.oh-pct-input');
        if (pctInput) {
          const i = parseInt(pctInput.dataset.idx, 10);
          overheadWorkingItems[i].percentage = parseFloat(pctInput.value) || 0;
          renderOverheadTable();
        }
      });
      ohTbody.addEventListener('input', (e) => {
        const nameInput = e.target.closest('.oh-name-input');
        if (nameInput) {
          const i = parseInt(nameInput.dataset.idx, 10);
          overheadWorkingItems[i].name = nameInput.value;
        }
      });
      ohTbody.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.oh-delete-btn');
        if (delBtn) {
          const i = parseInt(delBtn.dataset.idx, 10);
          overheadWorkingItems.splice(i, 1);
          renderOverheadTable();
        }
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeOverheadModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        closeOverheadModal();
      }
    });
  }

  function openOverheadModal() {
    if (!els.overheadModal) return;

    // Ensure overhead structure exists
    if (!currentEstimateData.overhead || !Array.isArray(currentEstimateData.overhead.items)) {
      currentEstimateData.overhead = getDefaultOverhead();
    }

    // Create working copy
    overheadWorkingItems = currentEstimateData.overhead.items.map(i => ({ ...i }));

    renderOverheadTable();
    els.overheadModal.classList.remove('hidden');
  }

  function closeOverheadModal() {
    els.overheadModal?.classList.add('hidden');
    overheadWorkingItems = [];
  }

  function renderOverheadTable() {
    const tbody = document.getElementById('overhead-table-body');
    if (!tbody) return;

    // Compute base subtotal
    const categories = Array.isArray(currentEstimateData?.categories) ? currentEstimateData.categories : [];
    let baseSubtotal = 0;
    categories.forEach(cat => {
      if (typeof cat.total_cost === 'number') baseSubtotal += cat.total_cost;
    });

    const baseEl = document.getElementById('overhead-base-subtotal');
    if (baseEl) baseEl.textContent = formatCurrency(baseSubtotal);

    tbody.innerHTML = '';

    let totalPct = 0;
    let totalAmount = 0;

    overheadWorkingItems.forEach((item, idx) => {
      const amount = item.enabled ? baseSubtotal * (item.percentage || 0) / 100 : 0;
      if (item.enabled) totalPct += (item.percentage || 0);
      totalAmount += amount;

      const tr = document.createElement('tr');
      if (!item.enabled) tr.classList.add('oh-row-disabled');
      tr.innerHTML = `
        <td class="oh-col-toggle">
          <input type="checkbox" class="oh-toggle" data-idx="${idx}" ${item.enabled ? 'checked' : ''}>
        </td>
        <td class="oh-col-name">
          <input type="text" class="oh-name-input" data-idx="${idx}" value="${item.name || ''}" placeholder="Item name">
        </td>
        <td class="oh-col-pct">
          <input type="number" class="oh-pct-input" data-idx="${idx}" value="${item.percentage || 0}" min="0" max="100" step="0.1">
        </td>
        <td class="oh-amount-cell">${item.enabled ? formatCurrency(amount) : '--'}</td>
        <td class="oh-col-actions">
          <button type="button" class="oh-delete-btn" data-idx="${idx}" title="Remove">&times;</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Update totals
    const totalPctEl = document.getElementById('overhead-total-pct');
    const totalAmountEl = document.getElementById('overhead-total-amount');
    if (totalPctEl) totalPctEl.textContent = totalPct.toFixed(1) + '%';
    if (totalAmountEl) totalAmountEl.textContent = formatCurrency(totalAmount);

    // Events handled via delegation in setupOverheadModal()
  }

  function addOverheadLine() {
    overheadWorkingItems.push({ name: '', percentage: 0, enabled: true });
    renderOverheadTable();
    // Focus the new name input
    const lastInput = document.querySelector('#overhead-table-body tr:last-child .oh-name-input');
    lastInput?.focus();
  }

  function saveOverheadFromModal() {
    // Compute totals
    let totalPct = 0;
    overheadWorkingItems.forEach(item => {
      if (item.enabled) totalPct += (item.percentage || 0);
    });

    currentEstimateData.overhead = {
      items: overheadWorkingItems.map(i => ({ ...i })),
      totalPercentage: totalPct,
      amount: 0 // will be computed by recalculate
    };

    recalculateEstimateTotals();
    renderEstimateSummary();
    markDirty();
    closeOverheadModal();
    showFeedback('Overhead updated', 'success');
  }

  function handleImportRevit() {
    // TODO: Open Revit import modal
    if (window.Toast) {
      Toast.info('Coming Soon', 'Import from Revit: Import quantities from Revit export');
    }
  }

  function handleExport() {
    // TODO: Open export options modal (PDF, CSV, .ngm)
    if (window.Toast) {
      Toast.info('Coming Soon', 'Export: Choose format (PDF, CSV, .ngm)');
    }
  }

  /**
   * Refresh the concepts and materials catalog from the database
   */
  async function handleRefreshCatalog() {
    const confirmRefresh = window.confirm(
      'This will refresh the concepts and materials catalog from the current database.\n\n' +
      'This may update prices and availability. Continue?'
    );

    if (!confirmRefresh) return;

    els.statusEl.textContent = 'Refreshing catalog...';

    try {
      const success = await refreshCatalogFromDB();

      if (success) {
        showFeedback(
          `Catalog refreshed: ${templateCache.concepts.length} concepts, ${templateCache.materials.length} materials`,
          'success'
        );
        els.statusEl.textContent = 'Catalog refreshed';

        // Optionally update template snapshots in storage if this estimate is from a template
        if (currentEstimateData?.created_from_template) {
          try {
            await updateTemplateSnapshots(currentEstimateData.created_from_template);
            console.log('[ESTIMATOR] Template snapshots updated');
          } catch (err) {
            console.warn('[ESTIMATOR] Could not update template snapshots:', err);
          }
        }
      } else {
        showFeedback('Failed to refresh catalog', 'error');
        els.statusEl.textContent = 'Refresh failed';
      }
    } catch (err) {
      console.error('[ESTIMATOR] Refresh catalog error:', err);
      showFeedback('Error refreshing catalog: ' + err.message, 'error');
      els.statusEl.textContent = 'Refresh failed';
    }
  }

  /**
   * Update template snapshot files in storage
   * @param {string} templateId
   */
  async function updateTemplateSnapshots(templateId) {
    if (!supabaseClient || !templateId) return;

    const basePath = templateId;

    await Promise.all([
      uploadToStorage(
        BUCKETS.TEMPLATES,
        `${basePath}/materials_snapshot.json`,
        new Blob([JSON.stringify(templateCache.materials)], { type: 'application/json' }),
        { contentType: 'application/json' }
      ),
      uploadToStorage(
        BUCKETS.TEMPLATES,
        `${basePath}/concepts_snapshot.json`,
        new Blob([JSON.stringify(templateCache.concepts)], { type: 'application/json' }),
        { contentType: 'application/json' }
      ),
      uploadToStorage(
        BUCKETS.TEMPLATES,
        `${basePath}/concept_materials_snapshot.json`,
        new Blob([JSON.stringify(templateCache.conceptMaterials)], { type: 'application/json' }),
        { contentType: 'application/json' }
      )
    ]);
  }

  async function handleSave() {
    await saveEstimate();
  }

  // ================================
  // PROJECT INFO MODAL
  // ================================

  // Tag selector options
  const PROJECT_TYPE_OPTIONS = [
    'ADU Attached', 'ADU Detached', 'Above The Garage', 'Garage Conversion',
    'Commercial', 'Home Renovation', 'Addition', 'Landscape', 'Other'
  ];
  const FOOTINGS_TYPE_OPTIONS = [
    'Slab on Grade', 'Raised Foundation', 'Mixed Foundation', 'Reinforce Foundation'
  ];

  function setupProjectInfoModal() {
    const modal = els.projectModal;
    if (!modal) return;

    const form = document.getElementById('project-form');
    const cancelBtn = document.getElementById('project-cancel-btn');
    const manageBtn = document.getElementById('manage-info-btn');
    const saveBtn = document.getElementById('project-save-btn');

    const inputs = {
      name: document.getElementById('project-name-input'),
      address: document.getElementById('project-address-input'),
      type: document.getElementById('project-type-input'),
      totalArea: document.getElementById('project-total-area-input'),
      habitableArea: document.getElementById('project-habitable-area-input'),
      nonHabitableArea: document.getElementById('project-nonhabitable-area-input'),
      footings: document.getElementById('project-footings-input'),
      rooms: document.getElementById('project-rooms-input'),
      baths: document.getElementById('project-baths-input'),
      units: document.getElementById('project-units-input'),
      foundation: document.getElementById('project-foundation-input'),
      date: document.getElementById('project-date-input')
    };

    // Tag selector state
    let selectedTypes = [];
    let selectedFootings = [];
    const typeOtherInput = document.getElementById('project-type-other-input');

    function renderTagSelector(containerId, options, selected, onToggle) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      options.forEach(opt => {
        const tag = document.createElement('button');
        tag.type = 'button';
        tag.className = 'tag-option' + (selected.includes(opt) ? ' selected' : '');
        tag.textContent = opt;
        tag.addEventListener('click', () => {
          if (!editMode) return;
          onToggle(opt);
        });
        container.appendChild(tag);
      });
    }

    function renderProjectTypeTags() {
      renderTagSelector('project-type-options', PROJECT_TYPE_OPTIONS, selectedTypes, (opt) => {
        if (opt === 'Other') {
          if (selectedTypes.includes('Other')) {
            selectedTypes = selectedTypes.filter(t => t !== 'Other');
            typeOtherInput?.classList.add('hidden');
            if (typeOtherInput) typeOtherInput.value = '';
          } else {
            selectedTypes.push('Other');
            typeOtherInput?.classList.remove('hidden');
            typeOtherInput?.focus();
          }
        } else {
          if (selectedTypes.includes(opt)) {
            selectedTypes = selectedTypes.filter(t => t !== opt);
          } else {
            selectedTypes.push(opt);
          }
        }
        renderProjectTypeTags();
        syncTypeHidden();
      });
    }

    function renderFootingsTags() {
      renderTagSelector('project-footings-options', FOOTINGS_TYPE_OPTIONS, selectedFootings, (opt) => {
        if (selectedFootings.includes(opt)) {
          selectedFootings = selectedFootings.filter(t => t !== opt);
        } else {
          selectedFootings.push(opt);
        }
        renderFootingsTags();
        syncFootingsHidden();
      });
    }

    function syncTypeHidden() {
      const vals = selectedTypes.filter(t => t !== 'Other');
      if (selectedTypes.includes('Other') && typeOtherInput?.value) {
        vals.push(typeOtherInput.value.trim());
      }
      if (inputs.type) inputs.type.value = vals.join(', ');
    }

    function syncFootingsHidden() {
      if (inputs.footings) inputs.footings.value = selectedFootings.join(', ');
    }

    typeOtherInput?.addEventListener('input', syncTypeHidden);

    let editMode = false;

    function setEditMode(enabled) {
      editMode = enabled;
      Object.values(inputs).forEach(inp => {
        if (inp) {
          inp.readOnly = !enabled;
          inp.classList.toggle('input-readonly', !enabled);
        }
      });
      // Toggle tag options readonly
      modal.querySelectorAll('.tag-option').forEach(tag => {
        tag.classList.toggle('input-readonly', !enabled);
      });
      if (typeOtherInput) typeOtherInput.readOnly = !enabled;
      if (saveBtn) saveBtn.disabled = !enabled;
      if (manageBtn) manageBtn.textContent = enabled ? 'Done editing' : 'Manage info';
    }

    function populateForm() {
      const proj = currentEstimateData?.project || {};
      if (inputs.name) inputs.name.value = proj['Project Name'] || currentEstimateData?.project_name || '';
      if (inputs.address) inputs.address.value = proj['Address'] || '';
      if (inputs.totalArea) inputs.totalArea.value = proj['Total Area (SqFt)'] || '';
      if (inputs.habitableArea) inputs.habitableArea.value = proj['Habitable Area (SqFt)'] || '';
      if (inputs.nonHabitableArea) inputs.nonHabitableArea.value = proj['Non Habitable Area (SqFt)'] || '';
      if (inputs.rooms) inputs.rooms.value = proj['Number of Rooms'] || '';
      if (inputs.baths) inputs.baths.value = proj['Number of Bathrooms'] || '';
      if (inputs.units) inputs.units.value = proj['Number of Units'] || '';
      if (inputs.foundation) inputs.foundation.value = proj['Foundation Type'] || '';
      if (inputs.date) inputs.date.value = proj['Date'] || currentEstimateData?.date || '';

      // Populate tag selectors from saved values
      const savedType = proj['Project Type'] || '';
      const savedFootings = proj['Footings Type'] || '';

      // Parse saved values back to arrays
      selectedTypes = [];
      if (savedType) {
        const parts = savedType.split(',').map(s => s.trim()).filter(Boolean);
        parts.forEach(p => {
          if (PROJECT_TYPE_OPTIONS.includes(p)) {
            selectedTypes.push(p);
          } else {
            // Custom value = "Other" was selected
            selectedTypes.push('Other');
            if (typeOtherInput) {
              typeOtherInput.value = p;
              typeOtherInput.classList.remove('hidden');
            }
          }
        });
      }
      if (!selectedTypes.includes('Other') && typeOtherInput) {
        typeOtherInput.classList.add('hidden');
        typeOtherInput.value = '';
      }

      selectedFootings = [];
      if (savedFootings) {
        selectedFootings = savedFootings.split(',').map(s => s.trim()).filter(Boolean);
      }

      renderProjectTypeTags();
      renderFootingsTags();
      syncTypeHidden();
      syncFootingsHidden();
    }

    manageBtn?.addEventListener('click', () => setEditMode(!editMode));

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeProjectModal();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!editMode) {
        closeProjectModal();
        return;
      }

      // Sync tag values before saving
      syncTypeHidden();
      syncFootingsHidden();

      // Save to state
      if (!currentEstimateData) currentEstimateData = {};
      if (!currentEstimateData.project) currentEstimateData.project = {};

      const proj = currentEstimateData.project;
      proj['Project Name'] = inputs.name?.value || '';
      proj['Address'] = inputs.address?.value || '';
      proj['Project Type'] = inputs.type?.value || '';
      proj['Total Area (SqFt)'] = inputs.totalArea?.value || '';
      proj['Habitable Area (SqFt)'] = inputs.habitableArea?.value || '';
      proj['Non Habitable Area (SqFt)'] = inputs.nonHabitableArea?.value || '';
      proj['Footings Type'] = inputs.footings?.value || '';
      proj['Number of Rooms'] = inputs.rooms?.value || '';
      proj['Number of Bathrooms'] = inputs.baths?.value || '';
      proj['Number of Units'] = inputs.units?.value || '';
      proj['Foundation Type'] = inputs.foundation?.value || '';
      proj['Date'] = inputs.date?.value || '';

      currentEstimateData.project_name = inputs.name?.value || '';
      currentEstimateData.date = inputs.date?.value || '';

      markDirty();
      renderEstimate();
      renderEstimateSummary();
      closeProjectModal();

      // For new estimates, sync to backend immediately
      if (!currentEstimateId) {
        syncToBackend();
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeProjectModal();
    });

    // Expose open function
    // @param {boolean} startInEditMode - If true, opens in edit mode (for new projects)
    window.openProjectModal = function(startInEditMode = false) {
      populateForm();
      setEditMode(startInEditMode);
      modal.classList.remove('hidden');
    };
  }

  function openProjectModal(editMode = false) {
    window.openProjectModal?.(editMode);
  }

  function closeProjectModal() {
    els.projectModal?.classList.add('hidden');
  }

  /**
   * Create a new blank estimate with default structure
   */
  function createBlankEstimate() {
    currentEstimateData = {
      project_name: 'New Project',
      project: {
        'Project Name': 'New Project',
        'Address': '',
        'Project Type': '',
        'Total Area (SqFt)': '',
        'Habitable Area (SqFt)': '',
        'Non Habitable Area (SqFt)': '',
        'Footings Type': '',
        'Number of Rooms': '',
        'Number of Bathrooms': '',
        'Number of Units': '',
        'Foundation Type': '',
        'Date': new Date().toISOString().split('T')[0]
      },
      categories: [],
      overhead: getDefaultOverhead(),
      created_at: new Date().toISOString(),
      version: '1.0'
    };

    currentProjectId = null;
    currentEstimateId = null;
    isDirty = false;

    renderEstimate();
    renderEstimateSummary();
    showFeedback('New estimate created', 'info');
  }

  // ================================
  // COLUMNS MODAL
  // ================================

  function setupColumnsModal() {
    const modal = els.columnsModal;
    if (!modal) return;

    const form = document.getElementById('columns-form');
    const cancelBtn = document.getElementById('columns-cancel-btn');
    const btn = els.btnColumns;

    btn?.addEventListener('click', () => modal.classList.remove('hidden'));

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('hidden');
    });

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      const checkboxes = form.querySelectorAll('input[type=checkbox][data-col]');

      checkboxes.forEach(cb => {
        const col = cb.getAttribute('data-col');
        const visible = cb.checked;
        document.querySelectorAll(`.col-${col}`).forEach(el => {
          el.style.display = visible ? '' : 'none';
        });
      });

      modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  // ================================
  // SAVE AS TEMPLATE MODAL
  // ================================

  function setupSaveAsTemplateModal() {
    const modal = els.saveAsTemplateModal;
    if (!modal) return;

    const form = document.getElementById('save-as-template-form');
    const cancelBtn = document.getElementById('template-cancel-btn');
    const nameInput = document.getElementById('template-name-input');
    const descInput = document.getElementById('template-description-input');

    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeSaveAsTemplateModal();
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = nameInput?.value?.trim();
      if (!name) {
        if (window.Toast) {
          Toast.warning('Missing Name', 'Please enter a template name.');
        }
        return;
      }

      const description = descInput?.value?.trim() || '';

      const success = await saveAsTemplate(name, description);
      if (success) {
        closeSaveAsTemplateModal();
        nameInput.value = '';
        descInput.value = '';
      }
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSaveAsTemplateModal();
    });
  }

  function openSaveAsTemplateModal() {
    if (!els.saveAsTemplateModal) return;

    // Pre-fill with current project name
    const nameInput = document.getElementById('template-name-input');
    if (nameInput && currentEstimateData?.project_name) {
      nameInput.value = currentEstimateData.project_name + ' Template';
    }

    els.saveAsTemplateModal.classList.remove('hidden');
  }

  function closeSaveAsTemplateModal() {
    els.saveAsTemplateModal?.classList.add('hidden');
  }

  // ================================
  // TEMPLATE PICKER MODAL
  // ================================

  function setupTemplatePickerModal() {
    const modal = els.templatePickerModal;
    if (!modal) return;

    const closeBtn = document.getElementById('template-picker-close');
    const cancelBtn = document.getElementById('template-picker-cancel');
    const blankOption = document.getElementById('template-option-blank');

    // Close button
    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeTemplatePickerModal();
    });

    // Cancel button
    cancelBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      closeTemplatePickerModal();
    });

    // Blank estimate option
    blankOption?.addEventListener('click', () => {
      closeTemplatePickerModal();
      createBlankEstimate();
      openProjectModal(true);
    });

    // Click backdrop to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeTemplatePickerModal();
    });

    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeTemplatePickerModal();
      }
    });

    // Template picker items - delegated click (survive re-renders)
    const tpList = document.getElementById('template-picker-list');
    tpList?.addEventListener('click', (e) => {
      const item = e.target.closest('.template-picker-item[data-template-id]');
      if (item) {
        const templateId = item.dataset.templateId;
        closeTemplatePickerModal();
        loadTemplate(templateId).then(() => openProjectModal(true));
      }
    });
  }

  async function openTemplatePickerModal() {
    console.log('[ESTIMATOR] openTemplatePickerModal, modal element:', els.templatePickerModal);
    if (!els.templatePickerModal) {
      console.warn('[ESTIMATOR] Template picker modal NOT FOUND in DOM, falling back to blank');
      createBlankEstimate();
      return;
    }

    // Show modal
    els.templatePickerModal.classList.remove('hidden');
    console.log('[ESTIMATOR] Modal shown, loading templates...');

    // Load templates list into the picker
    await loadTemplatesForPicker();
  }

  function closeTemplatePickerModal() {
    els.templatePickerModal?.classList.add('hidden');
  }

  /**
   * Load templates specifically for the picker modal
   */
  async function loadTemplatesForPicker() {
    console.log('[ESTIMATOR] loadTemplatesForPicker called');
    const listEl = document.getElementById('template-picker-list');
    if (!listEl) {
      console.warn('[ESTIMATOR] template-picker-list element not found');
      return;
    }

    // Show loading state
    listEl.innerHTML = `
      <div class="template-picker-loading">
        <span class="spinner"></span>
        Loading templates...
      </div>
    `;

    try {
      // Load via backend API (has service role key to list bucket)
      console.log('[ESTIMATOR] Fetching templates from API...');
      let templates = [];
      try {
        const response = await fetch(`${API_BASE}/estimator/templates`, {
          method: 'GET',
          headers: { ...getAuthHeaders() },
          credentials: 'include'
        });
        console.log('[ESTIMATOR] API response status:', response.status);
        if (response.ok) {
          const result = await response.json();
          templates = result.templates || [];
          console.log('[ESTIMATOR] API returned templates:', templates);
        }
      } catch (apiErr) {
        console.warn('[ESTIMATOR] API fetch failed:', apiErr);
      }

      // Fallback: try Supabase bucket directly
      if (templates.length === 0) {
        console.log('[ESTIMATOR] API returned 0, trying bucket directly...');
        templates = await loadTemplatesListFromStorage();
        console.log('[ESTIMATOR] Bucket returned:', templates);
      }

      if (!templates || templates.length === 0) {
        listEl.innerHTML = `
          <div class="template-picker-empty">
            No templates available yet. Create one by saving an estimate as a template.
          </div>
        `;
        return;
      }

      // Render templates
      listEl.innerHTML = templates.map(tpl => {
        const displayName = (tpl.name || tpl.id)
          .replace(/-\d{13}$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        return `
          <div class="template-picker-item" data-template-id="${tpl.id || tpl.name}">
            <div class="template-picker-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
            </div>
            <div class="template-picker-item-content">
              <div class="template-picker-item-name">${displayName}</div>
              <div class="template-picker-item-meta">${tpl.description || 'Template'}</div>
            </div>
          </div>
        `;
      }).join('');

      // Click handlers via delegation in setupTemplatePickerModal()
    } catch (err) {
      console.warn('[ESTIMATOR] Error loading templates for picker:', err);
      listEl.innerHTML = `
        <div class="template-picker-empty">
          Could not load templates. You can still create a blank estimate.
        </div>
      `;
    }
  }

  // ================================
  // LEGACY: LOAD FROM API (temporary)
  // ================================

  async function loadEstimatorFromNgm() {
    if (!els.tbody || !els.statusEl) return;

    els.tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-cell-muted">
          Loading structure from server...
        </td>
      </tr>
    `;
    els.statusEl.textContent = 'Fetching /estimator/base-structure...';

    try {
      const res = await fetch(`${API_BASE}/estimator/base-structure`, {
        headers: { ...getAuthHeaders() },
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      console.log('[ESTIMATOR] Data loaded:', data);

      currentEstimateData = data;
      isDirty = false;

      renderEstimate();
      showFeedback('Template loaded from server', 'success');

    } catch (err) {
      console.error('[ESTIMATOR] Load error:', err);
      els.statusEl.textContent = 'Error loading data';
      els.tbody.innerHTML = `
        <tr>
          <td colspan="8" class="table-cell-muted" style="color:#fca5a5;">
            Error loading estimate.ngm — check backend console.
          </td>
        </tr>
      `;
    }
  }

  // ================================
  // EXPOSE API
  // ================================

  window.NGMEstimator = {
    init,
    saveEstimate,
    loadEstimate,
    loadEstimatesList,
    saveAsTemplate,
    loadTemplate,
    loadTemplatesList: loadTemplatesListFromStorage,
    createBlankEstimate,
    getItemImageUrl,
    uploadItemImage,
    markDirty,
    getCurrentData: () => currentEstimateData,
    isDirty: () => isDirty,
    // Expose storage utilities for external use
    fetchMaterials,
    fetchConcepts,
    uploadToStorage,
    downloadFromStorage,
    getPublicUrl
  };

  // ================================
  // AUTO-INIT
  // ================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
