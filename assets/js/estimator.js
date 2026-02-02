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

  // State
  let supabaseClient = null;
  let currentEstimateData = null;
  let currentEstimateId = null;
  let currentProjectId = null;
  let isDirty = false; // Track unsaved changes

  // UI State
  const groupState = {};  // Category collapse state
  const subState = {};    // Subcategory collapse state
  let currentFilter = '';

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

    // Setup event listeners
    setupEventListeners();

    // Setup modals
    setupProjectInfoModal();
    setupColumnsModal();
    setupSaveAsTemplateModal();
    setupTemplatePickerModal();

    // Setup view controls
    setupViewSliders();
    setupSearchFilter();

    // Load initial data
    loadEstimatorFromNgm();

    // Load sidebar lists
    loadEstimatesList();
    loadTemplatesList();

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
    els.saveAsTemplateModal = document.getElementById('save-as-template-modal');
    els.templatePickerModal = document.getElementById('template-picker-modal');
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

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
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
  // ESTIMATE FILE OPERATIONS
  // ================================

  /**
   * Save current estimate to storage with folder structure:
   * - {projectId}/{estimateId}/estimate.ngm (JSON file)
   * - {projectId}/{estimateId}/materials_snapshot.csv
   * - {projectId}/{estimateId}/concepts_snapshot.csv
   * - {projectId}/{estimateId}/concept_materials_snapshot.csv
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
        headers: { 'Content-Type': 'application/json' },
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
      const response = await fetch(`${API_BASE}/estimator/estimates`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[ESTIMATOR] Could not load estimates list');
        updateEstimatesListUI([]);
        return [];
      }

      const result = await response.json();
      const estimates = result.estimates || [];

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

    // Add click handlers
    els.filesList.querySelectorAll('.estimator-file[data-estimate-id]').forEach(li => {
      li.addEventListener('click', async () => {
        const estimateId = li.dataset.estimateId;
        if (isDirty) {
          const confirm = window.confirm('You have unsaved changes. Load estimate anyway?');
          if (!confirm) return;
        }
        await loadEstimate(estimateId);
      });
    });
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
   * - {templateId}/materials_snapshot.csv (FULL materials DB)
   * - {templateId}/concepts_snapshot.csv (FULL concepts DB)
   * - {templateId}/concept_materials_snapshot.csv (FULL concept_materials)
   *
   * @param {string} templateName - Name for the template
   * @param {string} description - Template description
   */
  async function saveAsTemplate(templateName, description = '') {
    if (!currentEstimateData) {
      showFeedback('No estimate data to save as template', 'error');
      return false;
    }

    els.statusEl.textContent = 'Saving template...';

    try {
      // Clear quantities from data (templates don't have quantities)
      const cleanedData = clearQuantitiesFromData(currentEstimateData);

      // Clear project info but keep structure
      const projectData = { ...(cleanedData.project || {}) };
      projectData['Project Name'] = templateName;
      projectData['Address'] = '';
      projectData['Date'] = '';

      // Fetch FULL database snapshots (not just used IDs)
      els.statusEl.textContent = 'Creating full DB snapshots...';

      const [materialsResult, conceptsResult, conceptMaterialsResult] = await Promise.all([
        fetchAllMaterials(),
        fetchAllConcepts(),
        fetchAllConceptMaterials()
      ]);

      // Prepare request payload for backend API
      const requestPayload = {
        template_name: templateName,
        description: description || '',
        project: projectData,
        categories: cleanedData.categories || [],
        overhead: cleanedData.overhead || { percentage: 0, amount: 0 },
        materials_snapshot: materialsResult.data || [],
        concepts_snapshot: conceptsResult.data || [],
        concept_materials_snapshot: conceptMaterialsResult.data || []
      };

      els.statusEl.textContent = 'Uploading template...';

      // Call backend API to save template
      const response = await fetch(`${API_BASE}/estimator/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();

      showFeedback(`Template "${templateName}" saved with full DB snapshots`, 'success');
      els.statusEl.textContent = 'Template saved';

      // Refresh templates list
      await loadTemplatesList();

      return true;

    } catch (err) {
      console.error('[ESTIMATOR] Template save error:', err);
      showFeedback('Error saving template: ' + err.message, 'error');
      els.statusEl.textContent = 'Template save failed';
      return false;
    }
  }

  /**
   * Load a template
   * @param {string} templateId
   */
  async function loadTemplate(templateId) {
    els.statusEl.textContent = 'Loading template...';

    try {
      // Use backend API to load template
      const response = await fetch(`${API_BASE}/estimator/templates/${encodeURIComponent(templateId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const templateData = await response.json();

      // Create new estimate from template
      currentEstimateData = {
        ...templateData,
        template_meta: undefined, // Remove template metadata
        created_from_template: templateId,
        created_at: new Date().toISOString()
      };

      currentEstimateId = null; // Will be assigned on first save
      currentProjectId = null;
      isDirty = true;

      renderEstimate();
      showFeedback('Template loaded - save to create new estimate', 'info');

      return true;
    } catch (err) {
      console.error('[ESTIMATOR] Template load error:', err);
      showFeedback('Error loading template: ' + err.message, 'error');
      els.statusEl.textContent = 'Template load failed';
      return false;
    }
  }

  /**
   * Load list of available templates and update sidebar UI
   */
  async function loadTemplatesList() {
    try {
      // Use backend API to list templates
      const response = await fetch(`${API_BASE}/estimator/templates`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        console.warn('[ESTIMATOR] Could not load templates list');
        updateTemplatesListUI([]);
        return [];
      }

      const result = await response.json();
      const templates = result.templates || [];

      console.log('[ESTIMATOR] Templates:', templates);

      // Update sidebar
      updateTemplatesListUI(templates);

      return templates;
    } catch (err) {
      console.warn('[ESTIMATOR] Error loading templates list:', err);
      updateTemplatesListUI([]);
      return [];
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
      // Extract readable name from template ID (remove timestamp)
      const displayName = tpl.name
        .replace(/-\d{13}$/, '') // Remove timestamp
        .replace(/-/g, ' ')     // Replace dashes with spaces
        .replace(/\b\w/g, l => l.toUpperCase()); // Title case

      return `
        <li class="estimator-file estimator-file--template"
            data-template-id="${tpl.name}"
            title="Click to load template: ${displayName}">
          ${displayName}
        </li>
      `;
    }).join('');

    // Add click handlers
    templatesList.querySelectorAll('.estimator-file[data-template-id]').forEach(li => {
      li.addEventListener('click', async () => {
        const templateId = li.dataset.templateId;
        if (isDirty) {
          const confirm = window.confirm('You have unsaved changes. Load template anyway?');
          if (!confirm) return;
        }
        await loadTemplate(templateId);
      });
    });
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

  // ================================
  // CSV UTILITIES
  // ================================

  /**
   * Convert an array of objects to CSV string
   * @param {Array<object>} data - Array of objects to convert
   * @returns {string} CSV formatted string
   */
  function arrayToCSV(data) {
    if (!data || data.length === 0) return '';

    // Get all unique keys from all objects
    const allKeys = new Set();
    data.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Create header row
    const csvRows = [headers.map(h => escapeCSV(h)).join(',')];

    // Create data rows
    data.forEach(row => {
      const values = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return escapeCSV(JSON.stringify(val));
        return escapeCSV(String(val));
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Escape a value for CSV format
   * @param {string} value - Value to escape
   * @returns {string} Escaped value
   */
  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If contains comma, newline, or quote, wrap in quotes and escape inner quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
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

  function markDirty() {
    isDirty = true;
    if (els.statusEl) {
      els.statusEl.textContent = 'Unsaved changes';
    }
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
        <td class="group-cell col-name">
          <span class="group-toggle-icon">${groupState[indexCat] ? '▾' : '▸'}</span>
          <span class="group-name">${catName}</span>
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

          const trItem = document.createElement('tr');
          trItem.classList.add('item-row');
          trItem.dataset.catIndex = String(indexCat);
          trItem.dataset.subIndex = String(indexSub);
          trItem.style.display = (groupState[indexCat] && subState[subKey]) ? '' : 'none';
          trItem.innerHTML = `
            <td class="category-accnum col-code">${code}</td>
            <td class="image-cell col-image">
              ${imageUrl ? `<img src="${imageUrl}" alt="" class="item-thumbnail" onerror="this.style.display='none'">` : '—'}
            </td>
            <td class="item-name col-name">${name}</td>
            <td class="col-qty">${qty || '—'}</td>
            <td class="col-unit">${unit || '—'}</td>
            <td class="col-unit-cost">${unitCost !== '' ? unitCost : '—'}</td>
            <td class="col-subtotal">${subtotalItem !== '' ? subtotalItem : '—'}</td>
            <td class="col-total">${totalItem !== '' ? totalItem : '—'}</td>
          `;
          els.tbody.appendChild(trItem);
        });
      });
    });

    applyTableFilter(currentFilter);
  }

  function toggleGroup(indexCat) {
    groupState[indexCat] = !groupState[indexCat];
    applyTableFilter(currentFilter);
  }

  function toggleSub(catIndex, subIndex) {
    const key = `${catIndex}-${subIndex}`;
    subState[key] = !subState[key];
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
    if (isDirty) {
      const confirm = window.confirm('You have unsaved changes. Create new estimate anyway?');
      if (!confirm) return;
    }
    // Open template picker modal instead of creating blank immediately
    openTemplatePickerModal();
  }

  function handleAddConcept() {
    // TODO: Open concept picker modal
    if (window.Toast) {
      Toast.info('Coming Soon', 'Add Concept: Opens concept picker from catalog');
    }
  }

  function handleOverhead() {
    // TODO: Open overhead configuration modal
    if (window.Toast) {
      Toast.info('Coming Soon', 'Overhead: Configure overhead percentage/amount');
    }
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

  async function handleSave() {
    await saveEstimate();
  }

  // ================================
  // PROJECT INFO MODAL
  // ================================

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

    let editMode = false;

    function setEditMode(enabled) {
      editMode = enabled;
      Object.values(inputs).forEach(inp => {
        if (inp) {
          inp.readOnly = !enabled;
          inp.classList.toggle('input-readonly', !enabled);
        }
      });
      if (saveBtn) saveBtn.disabled = !enabled;
      if (manageBtn) manageBtn.textContent = enabled ? '✔ Done editing' : '✏️ Manage info';
    }

    function populateForm() {
      const proj = currentEstimateData?.project || {};
      if (inputs.name) inputs.name.value = proj['Project Name'] || currentEstimateData?.project_name || '';
      if (inputs.address) inputs.address.value = proj['Address'] || '';
      if (inputs.type) inputs.type.value = proj['Project Type'] || '';
      if (inputs.totalArea) inputs.totalArea.value = proj['Total Area (SqFt)'] || '';
      if (inputs.habitableArea) inputs.habitableArea.value = proj['Habitable Area (SqFt)'] || '';
      if (inputs.nonHabitableArea) inputs.nonHabitableArea.value = proj['Non Habitable Area (SqFt)'] || '';
      if (inputs.footings) inputs.footings.value = proj['Footings Type'] || '';
      if (inputs.rooms) inputs.rooms.value = proj['Number of Rooms'] || '';
      if (inputs.baths) inputs.baths.value = proj['Number of Bathrooms'] || '';
      if (inputs.units) inputs.units.value = proj['Number of Units'] || '';
      if (inputs.foundation) inputs.foundation.value = proj['Foundation Type'] || '';
      if (inputs.date) inputs.date.value = proj['Date'] || currentEstimateData?.date || '';
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
      closeProjectModal();
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
      overhead: { percentage: 0, amount: 0 },
      created_at: new Date().toISOString(),
      version: '1.0'
    };

    currentProjectId = null;
    currentEstimateId = null;
    isDirty = true;

    renderEstimate();
    showFeedback('New estimate created - fill project info and save', 'info');

    // Open project modal in edit mode
    openProjectModal(true);
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
  }

  async function openTemplatePickerModal() {
    if (!els.templatePickerModal) {
      // Fallback to blank estimate if modal not found
      createBlankEstimate();
      return;
    }

    // Show modal
    els.templatePickerModal.classList.remove('hidden');

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
    const listEl = document.getElementById('template-picker-list');
    if (!listEl) return;

    // Show loading state
    listEl.innerHTML = `
      <div class="template-picker-loading">
        <span class="spinner"></span>
        Loading templates...
      </div>
    `;

    try {
      // Fetch templates from backend API
      const response = await fetch(`${API_BASE}/estimator/templates`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        listEl.innerHTML = `
          <div class="template-picker-empty">
            Could not load templates. You can still create a blank estimate.
          </div>
        `;
        return;
      }

      const result = await response.json();
      const templates = result.templates || [];

      if (templates.length === 0) {
        listEl.innerHTML = `
          <div class="template-picker-empty">
            No templates available yet. Create one by saving an estimate as a template.
          </div>
        `;
        return;
      }

      // Render templates
      listEl.innerHTML = templates.map(tpl => {
        // Extract readable name from template ID (remove timestamp)
        const displayName = (tpl.name || tpl.id)
          .replace(/-\d{13}$/, '') // Remove timestamp
          .replace(/-/g, ' ')     // Replace dashes with spaces
          .replace(/\b\w/g, l => l.toUpperCase()); // Title case

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
              <div class="template-picker-item-meta">Template</div>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers to template items
      listEl.querySelectorAll('.template-picker-item[data-template-id]').forEach(item => {
        item.addEventListener('click', async () => {
          const templateId = item.dataset.templateId;
          closeTemplatePickerModal();
          await loadTemplate(templateId);
        });
      });
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
      const res = await fetch(`${API_BASE}/estimator/base-structure`);
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
    loadTemplatesList,
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
