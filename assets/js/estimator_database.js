/**
 * Estimator Database - Materials & Concepts Management
 */

// ========================================
// State
// ========================================
const state = {
    activeTab: 'materials', // 'materials' | 'concepts'
    materials: [],
    concepts: [],
    categories: [],
    classes: [],
    units: [],
    vendors: [],
    pagination: {
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0
    },
    filters: {
        search: '',
        category_id: '',
        unit_id: ''
    },
    editingId: null, // ID del item que se esta editando (null = crear nuevo)

    // Concept Builder State
    builder: {
        items: [],           // Array of builder items
        wastePercent: 0,     // Waste percentage for materials (legacy)
        activeFilters: new Set(['material', 'labor', 'inline']), // Active type filters
        selectedPickerMaterial: null // Currently selected material in picker
    },

    // Percentage Items from DB (cached)
    percentageItems: [],

    // Image Upload State
    materialImageFile: null,      // File object for material image
    materialImageBlobUrl: null,   // Temporary blob URL for preview
    materialImageUrl: null,       // Existing URL from database
    conceptImageFile: null,       // File object for concept image
    conceptImageBlobUrl: null,    // Temporary blob URL for preview
    conceptImageUrl: null         // Existing URL from database
};

// Image upload configuration
const IMAGE_UPLOAD_CONFIG = {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    maxSize: 5 * 1024 * 1024, // 5MB
    bucketName: 'estimator-images'
};

// Column visibility configuration
const COLUMN_CONFIG = [
    { key: 'image', label: 'Image', defaultVisible: true },
    { key: 'code', label: 'Code', defaultVisible: true },
    { key: 'name', label: 'Name', defaultVisible: true },
    { key: 'category', label: 'Category', defaultVisible: true },
    { key: 'brand', label: 'Brand', defaultVisible: false },
    { key: 'vendor', label: 'Vendor', defaultVisible: false },
    { key: 'unit', label: 'Unit', defaultVisible: true },
    { key: 'unitcost', label: 'Unit Cost', defaultVisible: true },
    { key: 'tax', label: 'Tax %', defaultVisible: false },
    { key: 'costwithtax', label: 'Cost w/ Tax', defaultVisible: false }
];

const COLUMN_VISIBILITY_KEY = 'estimatorDatabaseColumnVisibility';
let columnVisibility = {};

// ========================================
// DOM Elements
// ========================================
const DOM = {
    // Tabs
    tabMaterials: document.getElementById('tabMaterials'),
    tabConcepts: document.getElementById('tabConcepts'),

    // States
    emptyState: document.getElementById('databaseEmptyState'),
    emptyStateMessage: document.getElementById('emptyStateMessage'),

    // Tables
    materialsContent: document.getElementById('materialsContent'),
    materialsTableBody: document.getElementById('materialsTableBody'),
    conceptsContent: document.getElementById('conceptsContent'),
    conceptsTableBody: document.getElementById('conceptsTableBody'),

    // Toolbar
    btnAddNew: document.getElementById('btnAddNew'),
    btnAddFromEmpty: document.getElementById('btnAddFromEmpty'),
    btnImport: document.getElementById('btnImport'),
    btnExport: document.getElementById('btnExport'),
    csvFileInput: document.getElementById('csvFileInput'),
    btnClearFilters: document.getElementById('btnClearFilters'),
    globalSearch: document.getElementById('globalSearch'),
    filterCategory: document.getElementById('filterCategory'),
    filterUnit: document.getElementById('filterUnit'),

    // Pagination
    paginationContainer: document.getElementById('paginationContainer'),
    paginationInfo: document.getElementById('paginationInfo'),
    paginationPages: document.getElementById('paginationPages'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),

    // Material Modal
    materialModal: document.getElementById('materialModal'),
    materialModalTitle: document.getElementById('materialModalTitle'),
    materialForm: document.getElementById('materialForm'),
    materialCode: document.getElementById('materialCode'),
    materialName: document.getElementById('materialName'),
    materialCategory: document.getElementById('materialCategory'),
    materialUnit: document.getElementById('materialUnit'),
    materialUnitCost: document.getElementById('materialUnitCost'),
    materialSupplier: document.getElementById('materialSupplier'),
    materialDescription: document.getElementById('materialDescription'),
    materialImage: document.getElementById('materialImage'),
    materialImageInput: document.getElementById('materialImageInput'),
    materialImageContainer: document.getElementById('materialImageContainer'),
    btnCloseMaterialModal: document.getElementById('btnCloseMaterialModal'),
    btnCancelMaterial: document.getElementById('btnCancelMaterial'),
    btnSaveMaterial: document.getElementById('btnSaveMaterial'),

    // Concept Builder Modal
    conceptModal: document.getElementById('conceptModal'),
    conceptModalTitle: document.getElementById('conceptModalTitle'),
    conceptCode: document.getElementById('conceptCode'),
    conceptName: document.getElementById('conceptName'),
    conceptCategory: document.getElementById('conceptCategory'),
    conceptUnit: document.getElementById('conceptUnit'),
    conceptDescription: document.getElementById('conceptDescription'),
    conceptImage: document.getElementById('conceptImage'),
    conceptImageInput: document.getElementById('conceptImageInput'),
    conceptImageContainer: document.getElementById('conceptImageContainer'),
    conceptWastePercent: document.getElementById('conceptWastePercent'),
    btnCloseConceptModal: document.getElementById('btnCloseConceptModal'),
    btnCancelConcept: document.getElementById('btnCancelConcept'),
    btnSaveConcept: document.getElementById('btnSaveConcept'),

    // Builder toolbar
    btnAddFromDB: document.getElementById('btnAddFromDB'),
    btnAddInline: document.getElementById('btnAddInline'),
    btnAddPercent: document.getElementById('btnAddPercent'),
    btnClearAllItems: document.getElementById('btnClearAllItems'),

    // Builder table
    builderTableContainer: document.getElementById('builderTableContainer'),
    builderTableBody: document.getElementById('builderTableBody'),
    builderEmpty: document.getElementById('builderEmpty'),

    // Builder summary (in header)
    summaryTotal: document.getElementById('summaryTotal'),
    summaryMaterials: document.getElementById('summaryMaterials'),
    summaryLabor: document.getElementById('summaryLabor'),
    summaryExternal: document.getElementById('summaryExternal'),
    summaryPercent: document.getElementById('summaryPercent'),

    // Material Picker Modal
    materialPickerModal: document.getElementById('materialPickerModal'),
    btnCloseMaterialPicker: document.getElementById('btnCloseMaterialPicker'),
    btnCancelMaterialPicker: document.getElementById('btnCancelMaterialPicker'),
    btnConfirmMaterialPicker: document.getElementById('btnConfirmMaterialPicker'),
    pickerSearch: document.getElementById('pickerSearch'),
    pickerTableBody: document.getElementById('pickerTableBody'),
    pickerPreviewImage: document.getElementById('pickerPreviewImage'),
    pickerPreviewInfo: document.getElementById('pickerPreviewInfo'),
    pickerQuantity: document.getElementById('pickerQuantity'),

    // Inline Item Modal
    inlineItemModal: document.getElementById('inlineItemModal'),
    inlineItemModalTitle: document.getElementById('inlineItemModalTitle'),
    btnCloseInlineItem: document.getElementById('btnCloseInlineItem'),
    btnCancelInlineItem: document.getElementById('btnCancelInlineItem'),
    btnConfirmInlineItem: document.getElementById('btnConfirmInlineItem'),
    inlineTypeSelector: document.getElementById('inlineTypeSelector'),
    inlineItemType: document.getElementById('inlineItemType'),
    inlineItemId: document.getElementById('inlineItemId'),
    inlineItemIdError: document.getElementById('inlineItemIdError'),
    inlineItemDesc: document.getElementById('inlineItemDesc'),
    inlineItemUnit: document.getElementById('inlineItemUnit'),
    inlineItemQty: document.getElementById('inlineItemQty'),
    inlineItemCost: document.getElementById('inlineItemCost'),

    // Percentage Item Modal
    percentItemModal: document.getElementById('percentItemModal'),
    btnClosePercentItem: document.getElementById('btnClosePercentItem'),
    btnCancelPercentItem: document.getElementById('btnCancelPercentItem'),
    btnConfirmPercentItem: document.getElementById('btnConfirmPercentItem'),
    percentAppliesTo: document.getElementById('percentAppliesTo'),
    percentAppliesType: document.getElementById('percentAppliesType'),
    percentItemId: document.getElementById('percentItemId'),
    percentItemIdError: document.getElementById('percentItemIdError'),
    percentItemDesc: document.getElementById('percentItemDesc'),
    percentItemValue: document.getElementById('percentItemValue'),

    // Percentage Picker Modal
    percentPickerModal: document.getElementById('percentPickerModal'),
    btnClosePercentPicker: document.getElementById('btnClosePercentPicker'),
    btnCancelPercentPicker: document.getElementById('btnCancelPercentPicker'),
    btnConfirmPercentPicker: document.getElementById('btnConfirmPercentPicker'),
    btnAddCustomPercent: document.getElementById('btnAddCustomPercent'),
    percentPickerSearch: document.getElementById('percentPickerSearch'),
    percentPickerTableBody: document.getElementById('percentPickerTableBody'),
    percentPickerOverrideValue: document.getElementById('percentPickerOverrideValue'),

    // Column Manager Modal
    columnManagerModal: document.getElementById('columnManagerModal'),
    btnColumnManager: document.getElementById('btnColumnManager'),
    btnCloseColumnManager: document.getElementById('btnCloseColumnManager'),
    btnCloseColumnManagerFooter: document.getElementById('btnCloseColumnManagerFooter'),
    btnResetColumns: document.getElementById('btnResetColumns'),
    columnCheckboxes: document.getElementById('columnCheckboxes'),
    materialsTable: document.getElementById('materialsTable')
};

// ========================================
// API Calls
// ========================================
const API = {
    async fetchMaterials(page = 1, search = '', categoryId = '', unitId = '') {
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: state.pagination.pageSize.toString()
        });
        if (search) params.append('search', search);
        if (categoryId) params.append('category_id', categoryId);
        if (unitId) params.append('unit_id', unitId);

        const response = await fetch(`${API_BASE}/materials?${params}`);
        if (!response.ok) throw new Error('Failed to fetch materials');
        return response.json();
    },

    async fetchConcepts(page = 1, search = '', categoryId = '') {
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: state.pagination.pageSize.toString()
        });
        if (search) params.append('search', search);
        if (categoryId) params.append('category_id', categoryId);

        const response = await fetch(`${API_BASE}/concepts?${params}`);
        if (!response.ok) throw new Error('Failed to fetch concepts');
        return response.json();
    },

    async fetchCategories() {
        const response = await fetch(`${API_BASE}/material-categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        return response.json();
    },

    async fetchUnits() {
        const response = await fetch(`${API_BASE}/units`);
        if (!response.ok) throw new Error('Failed to fetch units');
        return response.json();
    },

    async createMaterial(data) {
        const response = await fetch(`${API_BASE}/materials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to create material');
        }
        return response.json();
    },

    async updateMaterial(id, data) {
        const response = await fetch(`${API_BASE}/materials/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to update material');
        }
        return response.json();
    },

    async deleteMaterial(id) {
        const response = await fetch(`${API_BASE}/materials/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to delete material');
        }
        return response.json();
    },

    async createConcept(data) {
        const response = await fetch(`${API_BASE}/concepts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to create concept');
        }
        return response.json();
    },

    async updateConcept(id, data) {
        const response = await fetch(`${API_BASE}/concepts/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to update concept');
        }
        return response.json();
    },

    async deleteConcept(id) {
        const response = await fetch(`${API_BASE}/concepts/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to delete concept');
        }
        return response.json();
    },

    async getConcept(id) {
        const response = await fetch(`${API_BASE}/concepts/${id}`);
        if (!response.ok) throw new Error('Failed to fetch concept');
        return response.json();
    },

    // Percentage Items
    async fetchPercentageItems() {
        const response = await fetch(`${API_BASE}/percentage-items`);
        if (!response.ok) throw new Error('Failed to fetch percentage items');
        return response.json();
    },

    async fetchStandardPercentageItems() {
        const response = await fetch(`${API_BASE}/percentage-items/standard`);
        if (!response.ok) throw new Error('Failed to fetch standard percentage items');
        return response.json();
    }
};

// ========================================
// Helper Functions
// ========================================

/**
 * Get unit name from unit_id using state.units lookup
 */
function getUnitName(unitId) {
    if (!unitId) return null;
    const unit = state.units.find(u => String(u.id_unit) === String(unitId));
    return unit ? unit.unit_name : null;
}

// ========================================
// Render Functions
// ========================================
function showLoading() {
    DOM.materialsContent.style.display = 'none';
    DOM.conceptsContent.style.display = 'none';
    DOM.paginationContainer.style.display = 'none';
    DOM.btnAddFromEmpty.style.display = 'none';
    DOM.emptyState.style.display = 'flex';
    DOM.emptyStateMessage.textContent = 'Loading...';
}

function showEmpty(message) {
    DOM.emptyState.style.display = 'flex';
    DOM.emptyStateMessage.textContent = message;
    DOM.btnAddFromEmpty.style.display = '';
    DOM.materialsContent.style.display = 'none';
    DOM.conceptsContent.style.display = 'none';
    DOM.paginationContainer.style.display = 'none';
}

function showContent() {
    DOM.emptyState.style.display = 'none';

    if (state.activeTab === 'materials') {
        DOM.materialsContent.style.display = 'block';
        DOM.conceptsContent.style.display = 'none';
    } else {
        DOM.materialsContent.style.display = 'none';
        DOM.conceptsContent.style.display = 'block';
    }

    DOM.paginationContainer.style.display = 'flex';
}

function renderMaterialsTable() {
    const tbody = DOM.materialsTableBody;
    tbody.innerHTML = '';

    if (!state.materials.length) {
        showEmpty('No materials found');
        return;
    }

    state.materials.forEach(mat => {
        const tr = document.createElement('tr');
        const imageUrl = mat.image || mat.Image || '';
        const imageCell = imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><span style="display: none; width: 40px; height: 40px; background: #27272a; border-radius: 4px; align-items: center; justify-content: center; color: #6b7280; font-size: 10px;">Err</span>`
            : `<span style="display: flex; width: 40px; height: 40px; background: #27272a; border-radius: 4px; align-items: center; justify-content: center; color: #6b7280; font-size: 10px;">-</span>`;

        // Calculate cost with tax
        const unitCost = parseFloat(mat.price_numeric || mat.Price || 0);
        const taxPercent = parseFloat(mat.tax_percent || 0);
        const costWithTax = unitCost * (1 + taxPercent / 100);

        tr.innerHTML = `
            <td class="col-image">${imageCell}</td>
            <td class="col-code"><code style="font-size: 12px; color: #9ca3af;">${escapeHtml(mat.ID || '')}</code></td>
            <td class="col-name">${escapeHtml(mat.short_description || mat['Short Description'] || '-')}</td>
            <td class="col-category">${escapeHtml(mat.category_name || '-')}</td>
            <td class="col-brand">${escapeHtml(mat.brand || mat.Brand || '-')}</td>
            <td class="col-vendor">${escapeHtml(mat.vendor_name || '-')}</td>
            <td class="col-unit">${escapeHtml(mat.unit_name || getUnitName(mat.unit_id) || mat.Unit || '-')}</td>
            <td class="col-unitcost">${formatCurrency(unitCost)}</td>
            <td class="col-tax">${taxPercent > 0 ? taxPercent.toFixed(1) + '%' : '-'}</td>
            <td class="col-costwithtax">${taxPercent > 0 ? formatCurrency(costWithTax) : '-'}</td>
            <td class="col-actions">
                <button class="btn-action" onclick="editMaterial('${escapeHtml(mat.ID)}')">Edit</button>
                <button class="btn-action btn-action-danger" onclick="confirmDeleteMaterial('${escapeHtml(mat.ID)}')">Del</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    showContent();
    applyColumnVisibility();
}

function renderConceptsTable() {
    const tbody = DOM.conceptsTableBody;
    tbody.innerHTML = '';

    if (!state.concepts.length) {
        showEmpty('No concepts found');
        return;
    }

    state.concepts.forEach(con => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code style="font-size: 12px; color: #9ca3af;">${escapeHtml(con.code || '')}</code></td>
            <td>${escapeHtml(con.short_description || '-')}</td>
            <td>${escapeHtml(con.category_name || '-')}</td>
            <td>${escapeHtml(con.subcategory_name || '-')}</td>
            <td>${escapeHtml(con.unit_name || '-')}</td>
            <td>${formatCurrency(con.calculated_cost || con.base_cost || 0)}</td>
            <td>
                <button class="btn-action" onclick="editConcept('${con.id}')">Edit</button>
                <button class="btn-action btn-action-danger" onclick="confirmDeleteConcept('${con.id}')">Del</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    showContent();
}

function renderPagination() {
    const { page, pageSize, total, totalPages } = state.pagination;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    DOM.paginationInfo.textContent = `Showing ${start}-${end} of ${total}`;
    DOM.paginationPages.textContent = `${page} / ${totalPages || 1}`;

    DOM.btnPrevPage.disabled = page <= 1;
    DOM.btnNextPage.disabled = page >= totalPages;
}

function populateCategoryFilter() {
    const select = DOM.filterCategory;
    select.innerHTML = '<option value="">All Categories</option>';
    state.categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
    });

    // Also populate modal selects
    const materialCat = DOM.materialCategory;
    const conceptCat = DOM.conceptCategory;

    if (materialCat) {
        materialCat.innerHTML = '<option value="">Select category...</option>';
        state.categories.forEach(cat => {
            materialCat.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
        });
    }

    if (conceptCat) {
        conceptCat.innerHTML = '<option value="">Select category...</option>';
        state.categories.forEach(cat => {
            conceptCat.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
        });
    }
}

function populateUnitFilter() {
    console.log('[UNIT FILTER] Populating with', state.units.length, 'units');

    const select = DOM.filterUnit;
    if (!select) {
        console.error('[UNIT FILTER] DOM.filterUnit not found!');
        return;
    }

    select.innerHTML = '<option value="">All Units</option>';
    state.units.forEach(unit => {
        console.log('[UNIT FILTER] Adding unit:', unit);
        select.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
    });

    // Also populate modal selects
    const materialUnit = DOM.materialUnit;
    const conceptUnit = DOM.conceptUnit;

    if (materialUnit) {
        materialUnit.innerHTML = '<option value="">Select unit...</option>';
        state.units.forEach(unit => {
            materialUnit.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
        });
        console.log('[UNIT FILTER] materialUnit populated with', materialUnit.options.length - 1, 'units');
    }

    if (conceptUnit) {
        conceptUnit.innerHTML = '<option value="">Select unit...</option>';
        state.units.forEach(unit => {
            conceptUnit.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
        });
        console.log('[UNIT FILTER] conceptUnit populated with', conceptUnit.options.length - 1, 'units');
    }
}

// ========================================
// Data Loading
// ========================================
async function loadData() {
    showLoading();

    try {
        if (state.activeTab === 'materials') {
            const result = await API.fetchMaterials(
                state.pagination.page,
                state.filters.search,
                state.filters.category_id,
                state.filters.unit_id
            );
            state.materials = result.data || [];
            // Map API snake_case to JS camelCase
            const apiPagination = result.pagination || {};
            state.pagination = {
                ...state.pagination,
                page: apiPagination.page || state.pagination.page,
                pageSize: apiPagination.page_size || state.pagination.pageSize,
                total: apiPagination.total || 0,
                totalPages: apiPagination.total_pages || 0
            };
            renderMaterialsTable();
        } else {
            const result = await API.fetchConcepts(
                state.pagination.page,
                state.filters.search,
                state.filters.category_id
            );
            state.concepts = result.data || [];
            // Map API snake_case to JS camelCase
            const apiPagination = result.pagination || {};
            state.pagination = {
                ...state.pagination,
                page: apiPagination.page || state.pagination.page,
                pageSize: apiPagination.page_size || state.pagination.pageSize,
                total: apiPagination.total || 0,
                totalPages: apiPagination.total_pages || 0
            };
            renderConceptsTable();
        }

        renderPagination();
    } catch (error) {
        console.error('Error loading data:', error);
        showToast('Error loading data: ' + error.message, 'error');
        showEmpty('Error loading data');
    }
}

async function loadLookups() {
    try {
        console.log('[LOOKUPS] Fetching categories and units...');
        const [categoriesRes, unitsRes] = await Promise.all([
            API.fetchCategories(),
            API.fetchUnits()
        ]);

        console.log('[LOOKUPS] Categories response:', categoriesRes);
        console.log('[LOOKUPS] Units response:', unitsRes);

        state.categories = categoriesRes.data || [];
        state.units = unitsRes.data || [];

        console.log('[LOOKUPS] state.categories:', state.categories.length, 'items');
        console.log('[LOOKUPS] state.units:', state.units.length, 'items');
        if (state.units.length > 0) {
            console.log('[LOOKUPS] First unit:', state.units[0]);
        }

        populateCategoryFilter();
        populateUnitFilter();
    } catch (error) {
        console.error('[LOOKUPS] Error loading lookups:', error);
    }
}

// ========================================
// Tab Switching
// ========================================
function switchTab(tab) {
    console.log('[TABS] Switching to tab:', tab);
    state.activeTab = tab;
    state.pagination.page = 1;

    // Update tab buttons
    if (DOM.tabMaterials) DOM.tabMaterials.classList.toggle('tab-btn-active', tab === 'materials');
    if (DOM.tabConcepts) DOM.tabConcepts.classList.toggle('tab-btn-active', tab === 'concepts');

    // Update button text
    if (DOM.btnAddNew) DOM.btnAddNew.textContent = tab === 'materials' ? '+ Add Material' : '+ Add Concept';
    if (DOM.btnAddFromEmpty) DOM.btnAddFromEmpty.textContent = tab === 'materials' ? '+ Add First Material' : '+ Add First Concept';

    loadData();
}

// ========================================
// Material Modal
// ========================================
function openMaterialModal(material = null) {
    state.editingId = material ? material.ID : null;

    // Reset image state
    state.materialImageFile = null;
    state.materialImageBlobUrl = null;
    state.materialImageUrl = material?.image || material?.Image || null;

    DOM.materialModalTitle.textContent = material ? 'Edit Material' : 'Add Material';
    DOM.materialCode.value = material?.ID || '';
    DOM.materialCode.disabled = !!material; // Can't change ID when editing
    DOM.materialName.value = material?.short_description || material?.['Short Description'] || '';
    DOM.materialCategory.value = material?.category_id || '';
    DOM.materialUnit.value = material?.unit_id || '';
    DOM.materialUnitCost.value = material?.price_numeric || '';
    DOM.materialSupplier.value = material?.Vendor || '';
    DOM.materialDescription.value = material?.full_description || material?.['Full Description'] || '';

    // Image field - set hidden input value
    DOM.materialImage.value = state.materialImageUrl || '';

    // Render image upload UI
    renderMaterialImageUI();

    DOM.materialModal.classList.remove('hidden');
}

function renderMaterialImageUI() {
    const container = DOM.materialImageContainer;
    if (!container) return;

    // If we have an existing URL or a selected file, show preview
    const previewUrl = state.materialImageBlobUrl || state.materialImageUrl;

    if (previewUrl) {
        container.innerHTML = `
            <div class="image-preview-container">
                <div class="image-preview-thumb">
                    <img src="${escapeHtml(previewUrl)}" alt="Preview" onerror="this.parentElement.innerHTML='<span style=\\'color:#ef4444;font-size:10px;\\'>Error</span>'" />
                </div>
                <div class="image-preview-info">
                    <div class="image-preview-name">${state.materialImageFile ? escapeHtml(state.materialImageFile.name) : 'Current image'}</div>
                    <div class="image-preview-status">${state.materialImageFile ? 'Ready to upload' : 'Saved'}</div>
                    <div class="image-preview-actions">
                        <button type="button" class="image-btn image-btn--replace" id="btnReplaceMaterialImage">Replace</button>
                        <button type="button" class="image-btn image-btn--delete" id="btnDeleteMaterialImage">Delete</button>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('btnReplaceMaterialImage')?.addEventListener('click', () => {
            DOM.materialImageInput.click();
        });

        document.getElementById('btnDeleteMaterialImage')?.addEventListener('click', () => {
            state.materialImageFile = null;
            if (state.materialImageBlobUrl) {
                URL.revokeObjectURL(state.materialImageBlobUrl);
                state.materialImageBlobUrl = null;
            }
            state.materialImageUrl = null;
            DOM.materialImage.value = '';
            renderMaterialImageUI();
        });
    } else {
        // Show drop zone
        container.innerHTML = `
            <div class="image-drop-zone" id="materialImageDropZone">
                <div class="image-drop-icon">+</div>
                <div class="image-drop-text">
                    <span class="image-drop-primary">Click or drop image</span>
                    <span class="image-drop-secondary">JPG, PNG, GIF, WebP (max 5MB)</span>
                </div>
            </div>
        `;

        // Bind drop zone events
        const dropZone = document.getElementById('materialImageDropZone');
        if (dropZone) {
            dropZone.addEventListener('click', () => DOM.materialImageInput.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('image-drop-zone--active');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('image-drop-zone--active');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('image-drop-zone--active');
                const file = e.dataTransfer.files[0];
                if (file) handleMaterialImageSelect(file);
            });
        }
    }
}

function handleMaterialImageSelect(file) {
    // Validate file type
    if (!IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
        showToast('Invalid file type. Only JPG, PNG, GIF, WebP allowed.', 'error');
        return;
    }

    // Validate file size
    if (file.size > IMAGE_UPLOAD_CONFIG.maxSize) {
        showToast('File too large. Maximum size is 5MB.', 'error');
        return;
    }

    // Revoke previous blob URL if exists
    if (state.materialImageBlobUrl) {
        URL.revokeObjectURL(state.materialImageBlobUrl);
    }

    // Store file and create preview URL
    state.materialImageFile = file;
    state.materialImageBlobUrl = URL.createObjectURL(file);

    // Re-render UI
    renderMaterialImageUI();
}

function closeMaterialModal() {
    DOM.materialModal.classList.add('hidden');
    state.editingId = null;

    // Clean up image state
    if (state.materialImageBlobUrl) {
        URL.revokeObjectURL(state.materialImageBlobUrl);
        state.materialImageBlobUrl = null;
    }
    state.materialImageFile = null;
    state.materialImageUrl = null;
}

async function saveMaterial() {
    const data = {
        ID: DOM.materialCode.value.trim(),
        short_description: DOM.materialName.value.trim(),
        full_description: DOM.materialDescription.value.trim(),
        category_id: DOM.materialCategory.value || null,
        unit_id: DOM.materialUnit.value || null,
        price_numeric: parseFloat(DOM.materialUnitCost.value) || 0,
        image: state.materialImageUrl || null
    };

    if (!data.ID || !data.short_description) {
        showToast('Code and Name are required', 'error');
        return;
    }

    try {
        // Upload image if a new file was selected
        if (state.materialImageFile) {
            showToast('Uploading image...', 'info');
            const imageUrl = await uploadImageToSupabase(state.materialImageFile, 'materials', data.ID);
            data.image = imageUrl;
        }

        if (state.editingId) {
            await API.updateMaterial(state.editingId, data);
            showToast('Material updated successfully', 'success');
        } else {
            await API.createMaterial(data);
            showToast('Material created successfully', 'success');
        }

        closeMaterialModal();
        loadData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Upload image to Supabase Storage
async function uploadImageToSupabase(file, folder, itemId) {
    const { createClient } = window.supabase || {};
    if (!createClient) {
        throw new Error('Supabase client not loaded.');
    }

    const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${itemId}_${timestamp}.${extension}`;
    const filepath = `${folder}/${filename}`;

    console.log('[IMAGE] Uploading:', { filename, filepath, size: file.size });

    // Upload file
    const { data, error } = await supabase.storage
        .from(IMAGE_UPLOAD_CONFIG.bucketName)
        .upload(filepath, file, {
            cacheControl: '3600',
            upsert: true
        });

    if (error) {
        console.error('[IMAGE] Upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(IMAGE_UPLOAD_CONFIG.bucketName)
        .getPublicUrl(filepath);

    console.log('[IMAGE] Upload successful:', urlData.publicUrl);
    return urlData.publicUrl;
}

window.editMaterial = function(id) {
    const material = state.materials.find(m => m.ID === id);
    if (material) {
        openMaterialModal(material);
    }
};

window.confirmDeleteMaterial = async function(id) {
    if (!confirm('Are you sure you want to delete this material?')) return;

    try {
        await API.deleteMaterial(id);
        showToast('Material deleted', 'success');
        loadData();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// ========================================
// Standard Percentage Items (WASTE, etc.)
// ========================================
async function ensureStandardPercentageItems() {
    try {
        // Fetch percentage items from DB if not cached
        if (state.percentageItems.length === 0) {
            const result = await API.fetchPercentageItems();
            state.percentageItems = result.data || [];
        }

        const standardItems = state.percentageItems.filter(pi => pi.is_standard);

        standardItems.forEach(stdItem => {
            // Check if this standard item already exists in builder
            const existing = state.builder.items.find(
                bi => bi.isPercent && bi.code === stdItem.code
            );

            if (!existing) {
                const unitLabel = stdItem.applies_to === 'material' ? '(%)mat'
                    : stdItem.applies_to === 'labor' ? '(%)lab' : '(%)tot';

                state.builder.items.push({
                    id: generateItemId(),
                    code: stdItem.code,
                    type: 'material',
                    description: stdItem.description,
                    unit: unitLabel,
                    qty: 1,
                    unitCost: 0,
                    image: '',
                    origin: 'standard',
                    isPercent: true,
                    appliesTo: stdItem.applies_to,
                    percentValue: stdItem.default_value || 0,
                    isStandard: true
                });
            }
        });
    } catch (e) {
        console.error('[BUILDER] Error loading standard percentage items:', e);
    }
}

// ========================================
// Concept Builder Modal
// ========================================
async function openConceptModal(concept = null) {
    state.editingId = concept ? concept.id : null;

    // Reset image state
    state.conceptImageFile = null;
    state.conceptImageBlobUrl = null;
    state.conceptImageUrl = concept?.image || null;

    DOM.conceptModalTitle.textContent = concept ? 'Edit Concept' : 'New Concept';
    DOM.conceptCode.value = concept?.code || '';
    DOM.conceptName.value = concept?.short_description || '';
    DOM.conceptCategory.value = concept?.category_id || '';
    DOM.conceptUnit.value = concept?.unit_id || '';
    DOM.conceptDescription.value = concept?.full_description || '';

    // Concept image - set hidden input value
    DOM.conceptImage.value = state.conceptImageUrl || '';

    // Render image upload UI
    renderConceptImageUI();

    // Initialize builder state
    state.builder.items = [];
    state.builder.wastePercent = concept?.waste_percent || 0;
    state.builder.activeFilters = new Set(['material', 'labor', 'inline']);

    DOM.conceptWastePercent.value = state.builder.wastePercent;

    // Load existing materials if editing
    if (concept?.materials && concept.materials.length > 0) {
        concept.materials.forEach(m => {
            state.builder.items.push({
                id: generateItemId(),
                code: m.material_id || '',
                type: 'material',
                materialId: m.material_id,
                description: m.material_name || m.material_id,
                unit: m.unit_name || m.material_unit || 'EA',
                qty: parseFloat(m.quantity) || 1,
                unitCost: parseFloat(m.unit_cost_override || m.material_price) || 0,
                image: m.material_image || '',
                origin: 'db',
                isPercent: false
            });
        });
    }

    // Load ALL non-DB items from builder snapshot (custom materials, labor, external, percent)
    if (concept?.builder?.items) {
        concept.builder.items.forEach(item => {
            // Skip DB-origin materials (already loaded from concept.materials above)
            if (item.origin === 'db' && !item.isPercent) return;

            state.builder.items.push({
                id: generateItemId(),
                code: item.code || '',
                type: item.type,
                materialId: item.materialId || null,
                description: item.description,
                unit: item.unit,
                qty: parseFloat(item.qty) || 1,
                unitCost: parseFloat(item.unit_cost) || 0,
                image: item.image || '',
                origin: item.origin || 'custom',
                isPercent: item.isPercent || false,
                appliesTo: item.appliesTo || null,
                percentValue: item.percentValue != null ? parseFloat(item.percentValue) : null,
                isStandard: item.isStandard || false
            });
        });
    }

    // Ensure standard percentage items (WASTE) are always present
    await ensureStandardPercentageItems();

    // Reset filters UI (if filter buttons exist)
    if (DOM.filterMaterial) DOM.filterMaterial.classList.add('active');
    if (DOM.filterLabor) DOM.filterLabor.classList.add('active');
    if (DOM.filterInline) DOM.filterInline.classList.add('active');

    renderBuilderTable();
    updateBuilderSummary();

    DOM.conceptModal.classList.remove('hidden');
}

function closeConceptModal() {
    DOM.conceptModal.classList.add('hidden');
    state.editingId = null;
    state.builder.items = [];

    // Clean up image state
    if (state.conceptImageBlobUrl) {
        URL.revokeObjectURL(state.conceptImageBlobUrl);
        state.conceptImageBlobUrl = null;
    }
    state.conceptImageFile = null;
    state.conceptImageUrl = null;
}

function renderConceptImageUI() {
    const container = DOM.conceptImageContainer;
    if (!container) return;

    // If we have an existing URL or a selected file, show preview
    const previewUrl = state.conceptImageBlobUrl || state.conceptImageUrl;

    if (previewUrl) {
        container.innerHTML = `
            <div style="width: 160px; height: 160px; border-radius: 8px; overflow: hidden; background: #27272a; position: relative;">
                <img src="${escapeHtml(previewUrl)}" style="width: 100%; height: 100%; object-fit: cover;" alt="Preview" onerror="this.style.display='none'" />
                <div style="position: absolute; bottom: 6px; right: 6px; display: flex; gap: 4px;">
                    <button type="button" id="btnReplaceConceptImage" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(59,130,246,0.85); border: none; color: white; font-size: 12px; cursor: pointer;" title="Replace">R</button>
                    <button type="button" id="btnDeleteConceptImage" style="width: 28px; height: 28px; border-radius: 6px; background: rgba(248,113,113,0.85); border: none; color: white; font-size: 12px; cursor: pointer;" title="Delete">X</button>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('btnReplaceConceptImage')?.addEventListener('click', () => {
            DOM.conceptImageInput.click();
        });

        document.getElementById('btnDeleteConceptImage')?.addEventListener('click', () => {
            state.conceptImageFile = null;
            if (state.conceptImageBlobUrl) {
                URL.revokeObjectURL(state.conceptImageBlobUrl);
                state.conceptImageBlobUrl = null;
            }
            state.conceptImageUrl = null;
            DOM.conceptImage.value = '';
            renderConceptImageUI();
        });
    } else {
        // Show drop zone (larger)
        container.innerHTML = `
            <div id="conceptImageDropZone" style="width: 160px; height: 160px; border: 2px dashed rgba(148,163,184,0.3); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; background: rgba(255,255,255,0.02);">
                <div style="font-size: 32px; opacity: 0.5;">+</div>
                <div style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 4px;">Click or drop<br>image here</div>
            </div>
        `;

        // Bind drop zone events
        const dropZone = document.getElementById('conceptImageDropZone');
        if (dropZone) {
            dropZone.addEventListener('click', () => DOM.conceptImageInput.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = '#3ecf8e';
                dropZone.style.background = 'rgba(62,207,142,0.1)';
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.style.borderColor = 'rgba(148,163,184,0.3)';
                dropZone.style.background = 'rgba(255,255,255,0.02)';
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'rgba(148,163,184,0.3)';
                dropZone.style.background = 'rgba(255,255,255,0.02)';
                const file = e.dataTransfer.files[0];
                if (file) handleConceptImageSelect(file);
            });
        }
    }
}

function handleConceptImageSelect(file) {
    // Validate file type
    if (!IMAGE_UPLOAD_CONFIG.allowedTypes.includes(file.type)) {
        showToast('Invalid file type. Only JPG, PNG, GIF, WebP allowed.', 'error');
        return;
    }

    // Validate file size
    if (file.size > IMAGE_UPLOAD_CONFIG.maxSize) {
        showToast('File too large. Maximum size is 5MB.', 'error');
        return;
    }

    // Revoke previous blob URL if exists
    if (state.conceptImageBlobUrl) {
        URL.revokeObjectURL(state.conceptImageBlobUrl);
    }

    // Store file and create preview URL
    state.conceptImageFile = file;
    state.conceptImageBlobUrl = URL.createObjectURL(file);

    // Re-render UI
    renderConceptImageUI();
}

function generateItemId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ========================================
// Builder Table Rendering
// ========================================
function renderBuilderTable() {
    const tbody = DOM.builderTableBody;
    const empty = DOM.builderEmpty;

    if (state.builder.items.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = '';

    state.builder.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.dataset.itemId = item.id;

        // Determine type class and label
        let typeClass, typeLabel;
        if (item.isPercent) {
            typeClass = 'type-percent';
            typeLabel = item.unit; // (%)mat, (%)lab, (%)tot
        } else {
            typeClass = `type-${item.type}`;
            typeLabel = item.type === 'material' ? 'MAT' : item.type === 'labor' ? 'LAB' : 'EXT';
        }

        // Calculate total - for percent items, calculate based on base
        let total;
        if (item.isPercent) {
            const baseAmount = calculatePercentBase(item.appliesTo);
            total = baseAmount * (item.percentValue / 100);
        } else {
            total = (item.qty || 0) * (item.unitCost || 0);
        }

        // Delete button or STD label
        const deleteCell = item.isStandard
            ? '<span style="color: #6b7280; font-size: 10px; font-weight: 600; letter-spacing: 0.05em;">STD</span>'
            : `<button class="btn-action btn-action-danger" onclick="removeBuilderItem('${item.id}')" title="Remove">X</button>`;

        // Row number cell
        const rowNum = `<td style="text-align: center; color: rgba(255,255,255,0.25); font-size: 11px; user-select: none;">${index + 1}</td>`;

        // Build row HTML
        if (item.isPercent) {
            tr.innerHTML = `
                ${rowNum}
                <td><span class="item-id">${escapeHtml(item.code || item.id)}</span></td>
                <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>
                    <input type="number" class="builder-input item-percent-value" value="${item.percentValue}" min="0" max="100" step="0.1" data-item-id="${item.id}" style="width: 70px;" />%
                </td>
                <td style="color: #6b7280;">-</td>
                <td style="text-align: right; color: #22c55e; font-weight: 500;">${formatCurrency(total)}</td>
                <td>${deleteCell}</td>
            `;
        } else {
            tr.innerHTML = `
                ${rowNum}
                <td><span class="item-id">${escapeHtml(item.code || item.id)}</span></td>
                <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.unit)}</td>
                <td>
                    <input type="number" class="builder-input item-qty" value="${item.qty}" min="0" step="0.001" data-item-id="${item.id}" />
                </td>
                <td>
                    <input type="number" class="builder-input item-cost" value="${item.unitCost.toFixed(2)}" min="0" step="0.01" data-item-id="${item.id}" />
                </td>
                <td style="text-align: right; color: #3ecf8e; font-weight: 500;">${formatCurrency(total)}</td>
                <td>${deleteCell}</td>
            `;
        }

        tbody.appendChild(tr);
    });

    // Attach input handlers
    tbody.querySelectorAll('.item-qty').forEach(input => {
        input.addEventListener('change', onBuilderItemChange);
    });
    tbody.querySelectorAll('.item-cost').forEach(input => {
        input.addEventListener('change', onBuilderItemChange);
    });
    tbody.querySelectorAll('.item-percent-value').forEach(input => {
        input.addEventListener('change', onBuilderPercentChange);
    });
}

function calculatePercentBase(appliesTo) {
    let base = 0;
    state.builder.items.forEach(item => {
        if (item.isPercent) return; // Don't include other percent items
        const itemTotal = (item.qty || 0) * (item.unitCost || 0);
        if (appliesTo === 'material' && item.type === 'material') base += itemTotal;
        else if (appliesTo === 'labor' && item.type === 'labor') base += itemTotal;
        else if (appliesTo === 'total') base += itemTotal;
    });
    return base;
}

function onBuilderPercentChange(e) {
    const itemId = e.target.dataset.itemId;
    const item = state.builder.items.find(i => i.id === itemId);
    if (!item) return;
    item.percentValue = parseFloat(e.target.value) || 0;
    renderBuilderTable();
    updateBuilderSummary();
}

function onBuilderItemChange(e) {
    const itemId = e.target.dataset.itemId;
    const item = state.builder.items.find(i => i.id === itemId);
    if (!item) return;

    if (e.target.classList.contains('item-qty')) {
        item.qty = parseFloat(e.target.value) || 0;
    } else if (e.target.classList.contains('item-cost')) {
        item.unitCost = parseFloat(e.target.value) || 0;
    }

    renderBuilderTable();
    updateBuilderSummary();
}

window.removeBuilderItem = function(itemId) {
    const item = state.builder.items.find(i => i.id === itemId);
    if (item && item.isStandard) {
        showToast('Standard items cannot be removed', 'error');
        return;
    }
    state.builder.items = state.builder.items.filter(i => i.id !== itemId);
    renderBuilderTable();
    updateBuilderSummary();
};

// ========================================
// Builder Summary Calculation
// ========================================
function updateBuilderSummary() {
    let materialTotal = 0;
    let laborTotal = 0;
    let externalTotal = 0;
    let percentTotal = 0;

    // First pass: calculate base totals (non-percent items)
    state.builder.items.forEach(item => {
        if (item.isPercent) return;
        const total = (item.qty || 0) * (item.unitCost || 0);
        if (item.type === 'material') materialTotal += total;
        else if (item.type === 'labor') laborTotal += total;
        else if (item.type === 'external') externalTotal += total;
    });

    // Second pass: calculate percent items separately
    state.builder.items.forEach(item => {
        if (!item.isPercent) return;
        const baseAmount = calculatePercentBase(item.appliesTo);
        percentTotal += baseAmount * (item.percentValue / 100);
    });

    const grandTotal = materialTotal + laborTotal + externalTotal + percentTotal;

    // Update summary header display
    if (DOM.summaryMaterials) DOM.summaryMaterials.textContent = formatCurrency(materialTotal).replace('$', '');
    if (DOM.summaryLabor) DOM.summaryLabor.textContent = formatCurrency(laborTotal).replace('$', '');
    if (DOM.summaryExternal) DOM.summaryExternal.textContent = formatCurrency(externalTotal).replace('$', '');
    if (DOM.summaryPercent) DOM.summaryPercent.textContent = formatCurrency(percentTotal).replace('$', '');
    if (DOM.summaryTotal) DOM.summaryTotal.textContent = formatCurrency(grandTotal).replace('$', '');
}

// ========================================
// Type Filters
// ========================================
function toggleTypeFilter(type) {
    if (state.builder.activeFilters.has(type)) {
        if (state.builder.activeFilters.size === 1) return; // Keep at least one active
        state.builder.activeFilters.delete(type);
    } else {
        state.builder.activeFilters.add(type);
    }

    // Update UI (if filter buttons exist)
    const btnMap = {
        material: DOM.filterMaterial,
        labor: DOM.filterLabor,
        inline: DOM.filterInline
    };
    if (btnMap[type]) {
        btnMap[type].classList.toggle('active', state.builder.activeFilters.has(type));
    }

    renderBuilderTable();
}

// ========================================
// Material Picker Modal
// ========================================
let pickerMaterials = [];

async function openMaterialPicker() {
    state.builder.selectedPickerMaterial = null;
    DOM.pickerQuantity.value = 1;
    DOM.pickerSearch.value = '';

    // Reset preview
    DOM.pickerPreviewImage.innerHTML = '<span style="color: #6b7280;">No selection</span>';
    DOM.pickerPreviewInfo.innerHTML = '<h4>Select a material</h4><p>Click on a material in the table to see details</p>';

    // Load materials for picker
    try {
        const result = await API.fetchMaterials(1, '', '');
        pickerMaterials = result.data || [];
        renderPickerTable(pickerMaterials);
    } catch (error) {
        showToast('Error loading materials', 'error');
    }

    DOM.materialPickerModal.classList.remove('hidden');
}

function closeMaterialPicker() {
    DOM.materialPickerModal.classList.add('hidden');
    state.builder.selectedPickerMaterial = null;
}

function renderPickerTable(materials) {
    const tbody = DOM.pickerTableBody;
    tbody.innerHTML = '';

    materials.forEach(mat => {
        const tr = document.createElement('tr');
        tr.dataset.materialId = mat.ID;
        tr.onclick = () => selectPickerMaterial(mat);

        tr.innerHTML = `
            <td><code style="font-size: 11px; color: #9ca3af;">${escapeHtml(mat.ID || '')}</code></td>
            <td>${escapeHtml(mat.short_description || '-')}</td>
            <td>${escapeHtml(mat.unit_name || '-')}</td>
            <td>${formatCurrency(mat.price_numeric || 0)}</td>
        `;

        tbody.appendChild(tr);
    });
}

function selectPickerMaterial(mat) {
    state.builder.selectedPickerMaterial = mat;

    // Update selection in table
    DOM.pickerTableBody.querySelectorAll('tr').forEach(tr => {
        tr.classList.toggle('selected', tr.dataset.materialId === mat.ID);
    });

    // Update preview
    const imageUrl = mat.image || mat.Image || '';
    if (imageUrl) {
        DOM.pickerPreviewImage.innerHTML = `<img src="${escapeHtml(imageUrl)}" onerror="this.parentElement.innerHTML='<span style=\\'color: #6b7280;\\'>No image</span>'" />`;
    } else {
        DOM.pickerPreviewImage.innerHTML = '<span style="color: #6b7280;">No image</span>';
    }

    DOM.pickerPreviewInfo.innerHTML = `
        <h4>${escapeHtml(mat.short_description || mat.ID)}</h4>
        <p>${escapeHtml(mat.full_description || '')}</p>
        <p>Unit: ${escapeHtml(mat.unit_name || '-')}</p>
        <p class="price">${formatCurrency(mat.price_numeric || 0)}</p>
    `;
}

function filterPickerMaterials() {
    const search = (DOM.pickerSearch.value || '').toLowerCase();
    const filtered = pickerMaterials.filter(mat => {
        const desc = (mat.short_description || '').toLowerCase();
        const id = (mat.ID || '').toLowerCase();
        return desc.includes(search) || id.includes(search);
    });
    renderPickerTable(filtered);
}

function confirmMaterialPicker() {
    const mat = state.builder.selectedPickerMaterial;
    if (!mat) {
        showToast('Select a material first', 'error');
        return;
    }

    const qty = parseFloat(DOM.pickerQuantity.value) || 1;

    const materialCode = mat.code || mat.ID || generateItemId();

    // Check if this code already exists
    if (isItemIdDuplicate(materialCode)) {
        showToast('Material with this code already exists in the concept', 'error');
        return;
    }

    state.builder.items.push({
        id: generateItemId(),
        code: materialCode,
        type: 'material',
        materialId: mat.ID,
        description: mat.short_description || mat.ID,
        unit: mat.unit_name || 'EA',
        qty: qty,
        unitCost: parseFloat(mat.price_numeric) || 0,
        image: mat.image || mat.Image || '',
        origin: 'db',
        isPercent: false
    });

    closeMaterialPicker();
    renderBuilderTable();
    updateBuilderSummary();
    showToast('Material added', 'success');
}

// ========================================
// New Item Modal (with type selector)
// ========================================
function openInlineItemModal() {
    DOM.inlineItemModalTitle.textContent = 'Add New Item';
    DOM.inlineItemType.value = 'material';
    if (DOM.inlineItemId) DOM.inlineItemId.value = '';
    DOM.inlineItemDesc.value = '';
    DOM.inlineItemUnit.value = 'EA';
    DOM.inlineItemQty.value = 1;
    DOM.inlineItemCost.value = 0;
    if (DOM.inlineItemIdError) DOM.inlineItemIdError.style.display = 'none';

    // Reset type selector
    if (DOM.inlineTypeSelector) {
        DOM.inlineTypeSelector.querySelectorAll('.type-selector-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.type === 'material') btn.classList.add('active');
        });
    }

    DOM.inlineItemModal.classList.remove('hidden');
}

function closeInlineItemModal() {
    DOM.inlineItemModal.classList.add('hidden');
}

function isItemIdDuplicate(id, excludeItemId = null) {
    return state.builder.items.some(item =>
        item.code === id && item.id !== excludeItemId
    );
}

function confirmInlineItem() {
    const itemId = DOM.inlineItemId ? DOM.inlineItemId.value.trim() : '';
    const desc = DOM.inlineItemDesc.value.trim();

    if (!itemId) {
        showToast('ID is required', 'error');
        return;
    }

    if (!desc) {
        showToast('Description is required', 'error');
        return;
    }

    // Check for duplicate ID
    if (isItemIdDuplicate(itemId)) {
        if (DOM.inlineItemIdError) DOM.inlineItemIdError.style.display = 'block';
        showToast('ID already exists', 'error');
        return;
    }

    const type = DOM.inlineItemType.value;
    const unit = DOM.inlineItemUnit.value;
    const qty = parseFloat(DOM.inlineItemQty.value) || 1;
    const unitCost = parseFloat(DOM.inlineItemCost.value) || 0;

    state.builder.items.push({
        id: generateItemId(),
        code: itemId,
        type: type,
        description: desc,
        unit: unit,
        qty: qty,
        unitCost: unitCost,
        image: '',
        origin: 'custom',
        isPercent: false
    });

    closeInlineItemModal();
    renderBuilderTable();
    updateBuilderSummary();

    const typeLabel = type === 'material' ? 'Material' : type === 'labor' ? 'Labor' : 'External';
    showToast(`${typeLabel} item added`, 'success');
}

// ========================================
// Percentage Item Modal
// ========================================
function openPercentItemModal() {
    if (DOM.percentItemId) DOM.percentItemId.value = '';
    if (DOM.percentItemDesc) DOM.percentItemDesc.value = '';
    if (DOM.percentItemValue) DOM.percentItemValue.value = 5;
    if (DOM.percentAppliesType) DOM.percentAppliesType.value = 'material';
    if (DOM.percentItemIdError) DOM.percentItemIdError.style.display = 'none';

    // Reset applies-to selector
    if (DOM.percentAppliesTo) {
        DOM.percentAppliesTo.querySelectorAll('.percent-applies-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.applies === 'material') btn.classList.add('active');
        });
    }

    if (DOM.percentItemModal) DOM.percentItemModal.classList.remove('hidden');
}

function closePercentItemModal() {
    if (DOM.percentItemModal) DOM.percentItemModal.classList.add('hidden');
}

function confirmPercentItem() {
    const itemId = DOM.percentItemId ? DOM.percentItemId.value.trim() : '';
    const desc = DOM.percentItemDesc ? DOM.percentItemDesc.value.trim() : '';

    if (!itemId) {
        showToast('ID is required', 'error');
        return;
    }

    if (!desc) {
        showToast('Description is required', 'error');
        return;
    }

    // Check for duplicate ID
    if (isItemIdDuplicate(itemId)) {
        if (DOM.percentItemIdError) DOM.percentItemIdError.style.display = 'block';
        showToast('ID already exists', 'error');
        return;
    }

    const appliesTo = DOM.percentAppliesType ? DOM.percentAppliesType.value : 'material';
    const percentValue = DOM.percentItemValue ? parseFloat(DOM.percentItemValue.value) || 0 : 0;

    // Determine unit label based on appliesTo
    const unitLabel = appliesTo === 'material' ? '(%)mat' : appliesTo === 'labor' ? '(%)lab' : '(%)tot';

    state.builder.items.push({
        id: generateItemId(),
        code: itemId,
        type: 'material', // Percent items typically affect material cost
        description: desc,
        unit: unitLabel,
        qty: 1,
        unitCost: 0,
        image: '',
        origin: 'custom',
        isPercent: true,
        appliesTo: appliesTo,
        percentValue: percentValue,
        isStandard: false
    });

    closePercentItemModal();
    renderBuilderTable();
    updateBuilderSummary();
    showToast('Percentage item added', 'success');
}

// ========================================
// Percentage Picker Modal (from Database)
// ========================================
let pickerPercentageItems = [];
let selectedPickerPercentItem = null;

async function openPercentPickerModal() {
    selectedPickerPercentItem = null;
    if (DOM.percentPickerSearch) DOM.percentPickerSearch.value = '';
    if (DOM.percentPickerOverrideValue) DOM.percentPickerOverrideValue.value = '';

    try {
        // Fetch if not cached
        if (state.percentageItems.length === 0) {
            const result = await API.fetchPercentageItems();
            state.percentageItems = result.data || [];
        }
        // Filter out items already in the builder
        const existingCodes = new Set(
            state.builder.items.filter(i => i.isPercent).map(i => i.code)
        );
        pickerPercentageItems = state.percentageItems.filter(
            pi => pi.is_active && !existingCodes.has(pi.code)
        );
        renderPercentPickerTable(pickerPercentageItems);
    } catch (e) {
        showToast('Error loading percentage items', 'error');
        console.error('[PERCENT PICKER]', e);
    }

    if (DOM.percentPickerModal) DOM.percentPickerModal.classList.remove('hidden');
}

function closePercentPickerModal() {
    if (DOM.percentPickerModal) DOM.percentPickerModal.classList.add('hidden');
    selectedPickerPercentItem = null;
}

function renderPercentPickerTable(items) {
    const tbody = DOM.percentPickerTableBody;
    if (!tbody) return;
    tbody.innerHTML = '';

    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 20px;">No percentage items available</td></tr>';
        return;
    }

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.dataset.percentId = item.id;
        tr.style.cursor = 'pointer';
        tr.onclick = () => selectPickerPercentItem(item);

        const appliesLabel = item.applies_to === 'material' ? '(%)mat'
            : item.applies_to === 'labor' ? '(%)lab' : '(%)tot';

        tr.innerHTML = `
            <td><code style="font-size: 12px; color: #9ca3af;">${escapeHtml(item.code)}</code></td>
            <td>${escapeHtml(item.description)}</td>
            <td><span class="type-badge type-percent">${appliesLabel}</span></td>
            <td>${item.default_value}%</td>
        `;
        tbody.appendChild(tr);
    });
}

function selectPickerPercentItem(item) {
    selectedPickerPercentItem = item;
    if (DOM.percentPickerTableBody) {
        DOM.percentPickerTableBody.querySelectorAll('tr').forEach(tr => {
            tr.classList.toggle('selected', tr.dataset.percentId === item.id);
        });
    }
    // Pre-fill override placeholder
    if (DOM.percentPickerOverrideValue) {
        DOM.percentPickerOverrideValue.placeholder = item.default_value + '%';
    }
}

function confirmPercentPicker() {
    if (!selectedPickerPercentItem) {
        showToast('Select a percentage item first', 'error');
        return;
    }

    const pi = selectedPickerPercentItem;
    const overrideVal = DOM.percentPickerOverrideValue ? DOM.percentPickerOverrideValue.value : '';
    const percentValue = overrideVal !== '' ? parseFloat(overrideVal) : pi.default_value;

    const unitLabel = pi.applies_to === 'material' ? '(%)mat'
        : pi.applies_to === 'labor' ? '(%)lab' : '(%)tot';

    // Check for duplicate code
    if (isItemIdDuplicate(pi.code)) {
        showToast('This percentage item is already in the concept', 'error');
        return;
    }

    state.builder.items.push({
        id: generateItemId(),
        code: pi.code,
        type: 'material',
        description: pi.description,
        unit: unitLabel,
        qty: 1,
        unitCost: 0,
        image: '',
        origin: 'percentage_db',
        isPercent: true,
        appliesTo: pi.applies_to,
        percentValue: percentValue,
        isStandard: pi.is_standard || false
    });

    closePercentPickerModal();
    renderBuilderTable();
    updateBuilderSummary();
    showToast('Percentage item added', 'success');
}

function filterPercentPickerTable() {
    const search = (DOM.percentPickerSearch ? DOM.percentPickerSearch.value : '').toLowerCase();
    const filtered = pickerPercentageItems.filter(pi => {
        return pi.code.toLowerCase().includes(search)
            || pi.description.toLowerCase().includes(search);
    });
    renderPercentPickerTable(filtered);
}

// ========================================
// Save Concept with Builder Data
// ========================================
async function saveConcept() {
    const code = DOM.conceptCode.value.trim();
    const name = DOM.conceptName.value.trim();

    if (!code || !name) {
        showToast('Code and Name are required', 'error');
        return;
    }

    // Calculate totals
    let materialTotal = 0;
    let laborTotal = 0;
    let inlineTotal = 0;
    const materials = [];
    const builderItems = [];

    state.builder.items.forEach(item => {
        if (item.isPercent) {
            // Percent items: skip from base totals, handled in second pass
        } else {
            const total = (item.qty || 0) * (item.unitCost || 0);
            if (item.type === 'material') {
                materialTotal += total;
                // Only add to concept_materials if it's from the database (has materialId)
                if (item.origin === 'db' && item.materialId) {
                    materials.push({
                        material_id: item.materialId,
                        quantity: item.qty,
                        unit_cost_override: item.unitCost
                    });
                }
            } else if (item.type === 'labor') {
                laborTotal += total;
            } else {
                inlineTotal += total;
            }
        }

        // Save ALL fields for proper persistence
        builderItems.push({
            code: item.code || '',
            type: item.type,
            description: item.description,
            unit: item.unit,
            qty: item.qty,
            unit_cost: item.unitCost,
            image: item.image || '',
            origin: item.origin,
            materialId: item.materialId || null,
            isPercent: item.isPercent || false,
            appliesTo: item.appliesTo || null,
            percentValue: item.percentValue ?? null,
            isStandard: item.isStandard || false
        });
    });

    // Calculate percent items contribution
    let percentTotal = 0;
    state.builder.items.forEach(item => {
        if (!item.isPercent) return;
        const baseAmount = calculatePercentBase(item.appliesTo);
        percentTotal += baseAmount * (item.percentValue / 100);
    });
    const grandTotal = materialTotal + laborTotal + inlineTotal + percentTotal;

    const data = {
        code: code,
        short_description: name,
        full_description: DOM.conceptDescription.value.trim(),
        category_id: DOM.conceptCategory.value || null,
        unit_id: DOM.conceptUnit.value || null,
        image: state.conceptImageUrl || null,
        base_cost: grandTotal,
        waste_percent: 0,
        calculated_cost: grandTotal,
        builder: {
            items: builderItems,
            totals: {
                materials: materialTotal,
                labor: laborTotal,
                inline: inlineTotal,
                percent: percentTotal,
                total: grandTotal
            }
        }
    };

    try {
        // Upload image if a new file was selected
        if (state.conceptImageFile) {
            showToast('Uploading image...', 'info');
            const imageUrl = await uploadImageToSupabase(state.conceptImageFile, 'concepts', code);
            data.image = imageUrl;
        }

        if (state.editingId) {
            await API.updateConcept(state.editingId, data);

            // Update materials separately if needed
            // This would require API endpoint for bulk material update

            showToast('Concept updated successfully', 'success');
        } else {
            const result = await API.createConcept(data);

            // Add materials to newly created concept
            if (materials.length > 0 && result.data?.id) {
                for (const mat of materials) {
                    try {
                        await fetch(`${API_BASE}/concepts/${result.data.id}/materials`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(mat)
                        });
                    } catch (e) {
                        console.error('Error adding material to concept:', e);
                    }
                }
            }

            showToast('Concept created successfully', 'success');
        }

        closeConceptModal();
        loadData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

window.editConcept = async function(id) {
    try {
        showLoading();
        const concept = await API.getConcept(id);
        openConceptModal(concept);
    } catch (error) {
        showToast('Error loading concept', 'error');
        showContent();
    }
};

window.confirmDeleteConcept = async function(id) {
    if (!confirm('Are you sure you want to delete this concept?')) return;

    try {
        await API.deleteConcept(id);
        showToast('Concept deleted', 'success');
        loadData();
    } catch (error) {
        showToast(error.message, 'error');
    }
};

// ========================================
// Utility Functions
// ========================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showToast(message, type = 'info') {
    if (typeof Toast !== 'undefined' && Toast.show) {
        Toast.show(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// ========================================
// Column Visibility Management
// ========================================
function initColumnVisibility() {
    // Load saved preferences
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (saved) {
        try {
            columnVisibility = JSON.parse(saved);
        } catch (e) {
            console.error('[COLUMN MANAGER] Error parsing saved visibility:', e);
            columnVisibility = {};
        }
    }

    // Set default visibility for columns not in saved state
    COLUMN_CONFIG.forEach(col => {
        if (columnVisibility[col.key] === undefined) {
            columnVisibility[col.key] = col.defaultVisible;
        }
    });

    // Apply initial column visibility
    applyColumnVisibility();
}

function openColumnManager() {
    populateColumnCheckboxes();
    DOM.columnManagerModal.classList.remove('hidden');
}

function closeColumnManager() {
    DOM.columnManagerModal.classList.add('hidden');
}

function populateColumnCheckboxes() {
    if (!DOM.columnCheckboxes) return;

    const checkboxesHtml = COLUMN_CONFIG.map(col => {
        const isVisible = columnVisibility[col.key];
        return `
            <label class="column-checkbox-item">
                <input type="checkbox" data-column-key="${col.key}" ${isVisible ? 'checked' : ''} />
                <span class="column-checkbox-label">${col.label}</span>
            </label>
        `;
    }).join('');

    DOM.columnCheckboxes.innerHTML = checkboxesHtml;

    // Add change event listeners
    DOM.columnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const columnKey = e.target.dataset.columnKey;
            columnVisibility[columnKey] = e.target.checked;
            saveColumnVisibility();
            applyColumnVisibility();
        });
    });
}

function applyColumnVisibility() {
    const table = DOM.materialsTable;
    if (!table) return;

    // Column keys that can be toggled
    const toggleableColumns = ['image', 'code', 'name', 'category', 'brand', 'vendor', 'unit', 'unitcost', 'tax', 'costwithtax'];

    // Apply visibility using class selectors
    toggleableColumns.forEach(key => {
        const isVisible = columnVisibility[key] !== false; // Default to visible
        const className = `col-${key}`;

        // Apply to header
        const headerCells = table.querySelectorAll(`thead .${className}`);
        headerCells.forEach(cell => {
            cell.classList.toggle('col-hidden', !isVisible);
        });

        // Apply to body cells
        const bodyCells = table.querySelectorAll(`tbody .${className}`);
        bodyCells.forEach(cell => {
            cell.classList.toggle('col-hidden', !isVisible);
        });
    });

    console.log('[COLUMN MANAGER] Visibility applied:', columnVisibility);
}

function saveColumnVisibility() {
    try {
        localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
        console.log('[COLUMN MANAGER] Visibility saved:', columnVisibility);
    } catch (e) {
        console.error('[COLUMN MANAGER] Error saving visibility:', e);
    }
}

function resetColumnVisibility() {
    // Reset to defaults
    COLUMN_CONFIG.forEach(col => {
        columnVisibility[col.key] = col.defaultVisible;
    });

    saveColumnVisibility();
    applyColumnVisibility();
    populateColumnCheckboxes();

    console.log('[COLUMN MANAGER] Reset to defaults');
}

// ========================================
// Event Listeners
// ========================================
function setupEventListeners() {
    // Tabs
    if (DOM.tabMaterials) {
        DOM.tabMaterials.addEventListener('click', () => switchTab('materials'));
    }
    if (DOM.tabConcepts) {
        DOM.tabConcepts.addEventListener('click', () => switchTab('concepts'));
    }

    // Add buttons
    DOM.btnAddNew.addEventListener('click', () => {
        if (state.activeTab === 'materials') {
            openMaterialModal();
        } else {
            openConceptModal();
        }
    });

    DOM.btnAddFromEmpty.addEventListener('click', () => {
        if (state.activeTab === 'materials') {
            openMaterialModal();
        } else {
            openConceptModal();
        }
    });

    // Search
    let searchTimeout;
    DOM.globalSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            state.filters.search = e.target.value;
            state.pagination.page = 1;
            loadData();
        }, 300);
    });

    // Filters
    DOM.filterCategory.addEventListener('change', (e) => {
        state.filters.category_id = e.target.value;
        state.pagination.page = 1;
        loadData();
    });

    DOM.filterUnit.addEventListener('change', (e) => {
        state.filters.unit_id = e.target.value;
        state.pagination.page = 1;
        loadData();
    });

    // Export & Import
    if (DOM.btnExport) DOM.btnExport.addEventListener('click', exportToCSV);
    if (DOM.btnImport) DOM.btnImport.addEventListener('click', triggerImportCSV);
    if (DOM.csvFileInput) {
        DOM.csvFileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) handleCSVImport(e.target.files[0]);
        });
    }

    DOM.btnClearFilters.addEventListener('click', () => {
        state.filters = { search: '', category_id: '', unit_id: '' };
        DOM.globalSearch.value = '';
        DOM.filterCategory.value = '';
        DOM.filterUnit.value = '';
        state.pagination.page = 1;
        loadData();
    });

    // Pagination
    DOM.btnPrevPage.addEventListener('click', () => {
        if (state.pagination.page > 1) {
            state.pagination.page--;
            loadData();
        }
    });

    DOM.btnNextPage.addEventListener('click', () => {
        if (state.pagination.page < state.pagination.totalPages) {
            state.pagination.page++;
            loadData();
        }
    });

    // Material Modal
    DOM.btnCloseMaterialModal.addEventListener('click', closeMaterialModal);
    DOM.btnCancelMaterial.addEventListener('click', closeMaterialModal);
    DOM.btnSaveMaterial.addEventListener('click', saveMaterial);
    DOM.materialModal.addEventListener('click', (e) => {
        if (e.target === DOM.materialModal) closeMaterialModal();
    });

    // Concept Builder Modal
    DOM.btnCloseConceptModal.addEventListener('click', closeConceptModal);
    DOM.btnCancelConcept.addEventListener('click', closeConceptModal);
    DOM.btnSaveConcept.addEventListener('click', saveConcept);
    DOM.conceptModal.addEventListener('click', (e) => {
        if (e.target === DOM.conceptModal) closeConceptModal();
    });

    // Builder toolbar buttons
    DOM.btnAddFromDB.addEventListener('click', openMaterialPicker);
    DOM.btnAddInline.addEventListener('click', openInlineItemModal);
    if (DOM.btnAddPercent) DOM.btnAddPercent.addEventListener('click', openPercentPickerModal);
    DOM.btnClearAllItems.addEventListener('click', () => {
        const removable = state.builder.items.filter(i => !i.isStandard);
        if (removable.length === 0) return;
        if (!confirm('Clear all items? (Standard items will be kept)')) return;
        state.builder.items = state.builder.items.filter(i => i.isStandard);
        renderBuilderTable();
        updateBuilderSummary();
    });

    // Inline Item Modal - Type selector
    if (DOM.inlineTypeSelector) {
        DOM.inlineTypeSelector.querySelectorAll('.type-selector-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.inlineTypeSelector.querySelectorAll('.type-selector-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                DOM.inlineItemType.value = btn.dataset.type;
            });
        });
    }

    // Percentage Item Modal - Applies-to selector
    if (DOM.percentAppliesTo) {
        DOM.percentAppliesTo.querySelectorAll('.percent-applies-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.percentAppliesTo.querySelectorAll('.percent-applies-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                DOM.percentAppliesType.value = btn.dataset.applies;
            });
        });
    }

    // Percentage Item Modal
    if (DOM.btnClosePercentItem) DOM.btnClosePercentItem.addEventListener('click', closePercentItemModal);
    if (DOM.btnCancelPercentItem) DOM.btnCancelPercentItem.addEventListener('click', closePercentItemModal);
    if (DOM.btnConfirmPercentItem) DOM.btnConfirmPercentItem.addEventListener('click', confirmPercentItem);
    if (DOM.percentItemModal) {
        DOM.percentItemModal.addEventListener('click', (e) => {
            if (e.target === DOM.percentItemModal) closePercentItemModal();
        });
    }

    // Percentage Picker Modal (from Database)
    if (DOM.btnClosePercentPicker) DOM.btnClosePercentPicker.addEventListener('click', closePercentPickerModal);
    if (DOM.btnCancelPercentPicker) DOM.btnCancelPercentPicker.addEventListener('click', closePercentPickerModal);
    if (DOM.btnConfirmPercentPicker) DOM.btnConfirmPercentPicker.addEventListener('click', confirmPercentPicker);
    if (DOM.btnAddCustomPercent) {
        DOM.btnAddCustomPercent.addEventListener('click', () => {
            closePercentPickerModal();
            openPercentItemModal();
        });
    }
    if (DOM.percentPickerModal) {
        DOM.percentPickerModal.addEventListener('click', (e) => {
            if (e.target === DOM.percentPickerModal) closePercentPickerModal();
        });
    }

    // Percent picker search
    let percentPickerSearchTimeout;
    if (DOM.percentPickerSearch) {
        DOM.percentPickerSearch.addEventListener('input', () => {
            clearTimeout(percentPickerSearchTimeout);
            percentPickerSearchTimeout = setTimeout(filterPercentPickerTable, 200);
        });
    }

    // Material Picker Modal
    DOM.btnCloseMaterialPicker.addEventListener('click', closeMaterialPicker);
    DOM.btnCancelMaterialPicker.addEventListener('click', closeMaterialPicker);
    DOM.btnConfirmMaterialPicker.addEventListener('click', confirmMaterialPicker);
    DOM.materialPickerModal.addEventListener('click', (e) => {
        if (e.target === DOM.materialPickerModal) closeMaterialPicker();
    });

    // Picker search
    let pickerSearchTimeout;
    DOM.pickerSearch.addEventListener('input', () => {
        clearTimeout(pickerSearchTimeout);
        pickerSearchTimeout = setTimeout(filterPickerMaterials, 200);
    });

    // Inline Item Modal
    DOM.btnCloseInlineItem.addEventListener('click', closeInlineItemModal);
    DOM.btnCancelInlineItem.addEventListener('click', closeInlineItemModal);
    DOM.btnConfirmInlineItem.addEventListener('click', confirmInlineItem);
    DOM.inlineItemModal.addEventListener('click', (e) => {
        if (e.target === DOM.inlineItemModal) closeInlineItemModal();
    });

    // Material image file input
    DOM.materialImageInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleMaterialImageSelect(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    });

    // Concept image file input
    DOM.conceptImageInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleConceptImageSelect(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    });

    // Column Manager Modal
    if (DOM.btnColumnManager) {
        DOM.btnColumnManager.addEventListener('click', openColumnManager);
    }
    if (DOM.btnCloseColumnManager) {
        DOM.btnCloseColumnManager.addEventListener('click', closeColumnManager);
    }
    if (DOM.btnCloseColumnManagerFooter) {
        DOM.btnCloseColumnManagerFooter.addEventListener('click', closeColumnManager);
    }
    if (DOM.btnResetColumns) {
        DOM.btnResetColumns.addEventListener('click', resetColumnVisibility);
    }
    if (DOM.columnManagerModal) {
        DOM.columnManagerModal.addEventListener('click', (e) => {
            if (e.target === DOM.columnManagerModal) closeColumnManager();
        });
    }
}

// ========================================
// Export CSV
// ========================================
async function exportToCSV() {
    const tab = state.activeTab;
    const btnExport = DOM.btnExport;
    const originalText = btnExport.textContent;
    btnExport.disabled = true;
    btnExport.textContent = 'Exporting...';

    try {
        if (tab === 'materials') {
            // Fetch ALL materials (paginate through all pages)
            let allMaterials = [];
            let page = 1;
            const pageSize = 200;
            let totalPages = 1;

            while (page <= totalPages) {
                const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() });
                if (state.filters.search) params.append('search', state.filters.search);
                if (state.filters.category_id) params.append('category_id', state.filters.category_id);
                if (state.filters.unit_id) params.append('unit_id', state.filters.unit_id);

                const response = await fetch(`${API_BASE}/materials?${params}`);
                if (!response.ok) throw new Error('Failed to fetch materials for export');
                const result = await response.json();
                allMaterials = allMaterials.concat(result.data || []);
                totalPages = result.pagination?.total_pages || 1;
                page++;
            }

            if (!allMaterials.length) {
                showToast('No materials to export', 'warning');
                return;
            }

            const headers = ['Code', 'Name', 'Description', 'Brand', 'Category', 'Vendor', 'Unit', 'Unit Cost', 'Tax %', 'SKU', 'Image URL', 'Link'];
            const rows = allMaterials.map(m => [
                m.ID || '',
                m.short_description || '',
                m.full_description || '',
                m.brand || '',
                m.category_name || '',
                m.vendor_name || '',
                m.unit_name || '',
                m.price_numeric || '',
                m.tax_percent || '',
                m.sku || '',
                m.image || '',
                m.link || ''
            ]);

            downloadCSV(headers, rows, 'materials_export.csv');
            showToast(`Exported ${allMaterials.length} materials`, 'success');

        } else {
            // Fetch ALL concepts
            let allConcepts = [];
            let page = 1;
            const pageSize = 200;
            let totalPages = 1;

            while (page <= totalPages) {
                const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() });
                if (state.filters.search) params.append('search', state.filters.search);
                if (state.filters.category_id) params.append('category_id', state.filters.category_id);

                const response = await fetch(`${API_BASE}/concepts?${params}`);
                if (!response.ok) throw new Error('Failed to fetch concepts for export');
                const result = await response.json();
                allConcepts = allConcepts.concat(result.data || []);
                totalPages = result.pagination?.total_pages || 1;
                page++;
            }

            if (!allConcepts.length) {
                showToast('No concepts to export', 'warning');
                return;
            }

            const headers = ['Code', 'Name', 'Description', 'Category', 'Subcategory', 'Unit', 'Base Cost', 'Labor Cost', 'Total Cost'];
            const rows = allConcepts.map(c => [
                c.code || '',
                c.short_description || '',
                c.full_description || '',
                c.category_name || '',
                c.subcategory_name || '',
                c.unit_name || '',
                c.base_cost || '',
                c.labor_cost || '',
                c.total_cost || ''
            ]);

            downloadCSV(headers, rows, 'concepts_export.csv');
            showToast(`Exported ${allConcepts.length} concepts`, 'success');
        }
    } catch (error) {
        console.error('Export error:', error);
        showToast('Error exporting: ' + error.message, 'error');
    } finally {
        btnExport.disabled = false;
        btnExport.textContent = originalText;
    }
}

function downloadCSV(headers, rows, filename) {
    const escapeCsvField = (field) => {
        const str = String(field ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const csvContent = [
        headers.map(escapeCsvField).join(','),
        ...rows.map(row => row.map(escapeCsvField).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ========================================
// Import CSV
// ========================================
function triggerImportCSV() {
    if (state.activeTab !== 'materials') {
        showToast('CSV import is only available for Materials', 'warning');
        return;
    }
    DOM.csvFileInput.click();
}

async function handleCSVImport(file) {
    if (!file || !file.name.endsWith('.csv')) {
        showToast('Please select a valid CSV file', 'error');
        return;
    }

    const btnImport = DOM.btnImport;
    const originalText = btnImport.textContent;
    btnImport.disabled = true;
    btnImport.textContent = 'Reading...';

    try {
        const text = await file.text();
        const rows = parseCSV(text);

        if (rows.length < 2) {
            showToast('CSV file is empty or has no data rows', 'warning');
            return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim()));

        if (!dataRows.length) {
            showToast('No data rows found in CSV', 'warning');
            return;
        }

        // Map CSV columns to API fields
        const colMap = {
            'code': 'ID', 'id': 'ID',
            'name': 'short_description', 'short description': 'short_description', 'short_description': 'short_description',
            'description': 'full_description', 'full description': 'full_description', 'full_description': 'full_description',
            'brand': 'brand',
            'sku': 'sku',
            'unit cost': 'price_numeric', 'unitcost': 'price_numeric', 'price': 'price_numeric', 'price_numeric': 'price_numeric',
            'image': 'image', 'image url': 'image',
            'link': 'link'
        };

        // Build category and unit lookup maps (name -> id)
        const categoryMap = {};
        state.categories.forEach(c => {
            categoryMap[c.name.toLowerCase()] = c.id;
        });

        const unitMap = {};
        state.units.forEach(u => {
            unitMap[u.unit_name.toLowerCase()] = u.id_unit;
        });

        const materials = [];
        const errors = [];

        dataRows.forEach((row, idx) => {
            const material = {};
            headers.forEach((header, colIdx) => {
                const apiField = colMap[header];
                if (apiField && row[colIdx] !== undefined) {
                    let value = row[colIdx].trim();
                    if (apiField === 'price_numeric') {
                        value = parseFloat(value.replace(/[,$]/g, '')) || null;
                    }
                    if (value !== '' && value !== null) {
                        material[apiField] = value;
                    }
                }

                // Handle category by name
                if ((header === 'category' || header === 'category_name') && row[colIdx]) {
                    const catName = row[colIdx].trim().toLowerCase();
                    if (categoryMap[catName]) {
                        material.category_id = categoryMap[catName];
                    }
                }

                // Handle unit by name
                if ((header === 'unit' || header === 'unit_name') && row[colIdx]) {
                    const unitName = row[colIdx].trim().toLowerCase();
                    if (unitMap[unitName]) {
                        material.unit_id = unitMap[unitName];
                    }
                }
            });

            if (!material.ID) {
                errors.push(`Row ${idx + 2}: Missing required Code/ID`);
                return;
            }

            materials.push(material);
        });

        if (!materials.length) {
            showToast('No valid materials found. ' + (errors.length ? errors[0] : ''), 'error');
            return;
        }

        // Confirm with user
        const msg = `Import ${materials.length} materials?` +
            (errors.length ? `\n${errors.length} rows skipped (missing Code).` : '');
        if (!confirm(msg)) return;

        btnImport.textContent = 'Importing...';

        // Send to bulk endpoint
        const response = await fetch(`${API_BASE}/materials/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(materials)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Bulk import failed');
        }

        const result = await response.json();
        showToast(`Imported ${result.count || materials.length} materials`, 'success');

        // Reload data
        state.pagination.page = 1;
        await loadData();

    } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing CSV: ' + error.message, 'error');
    } finally {
        btnImport.disabled = false;
        btnImport.textContent = originalText;
        DOM.csvFileInput.value = '';
    }
}

function parseCSV(text) {
    const rows = [];
    let current = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                current.push(field);
                field = '';
            } else if (char === '\n' || (char === '\r' && next === '\n')) {
                current.push(field);
                field = '';
                if (current.length > 1 || current[0] !== '') {
                    rows.push(current);
                }
                current = [];
                if (char === '\r') i++;
            } else {
                field += char;
            }
        }
    }

    // Last field/row
    current.push(field);
    if (current.length > 1 || current[0] !== '') {
        rows.push(current);
    }

    return rows;
}

// ========================================
// Initialize
// ========================================
async function init() {
    setupEventListeners();

    // Initialize column visibility
    initColumnVisibility();

    // Load lookups first, then data
    await loadLookups();
    await loadData();

    // Remove loading state
    hidePageLoading();
}

// ========================================
// Advanced Filters (Column Filters)
// ========================================
const filterState = {
    activeColumn: null,
    columnFilters: {
        code: new Set(),
        name: new Set(),
        category: new Set(),
        brand: new Set(),
        vendor: new Set(),
        unit: new Set()
    }
};

// ========================================
// Resizable Columns
// ========================================
const resizeState = {
    isResizing: false,
    currentColumn: null,
    startX: 0,
    startWidth: 0
};

function initResizableColumns() {
    const table = document.getElementById('materialsTable');
    if (!table) return;

    const headers = table.querySelectorAll('th:not(.col-actions):not(.col-image)');
    headers.forEach(header => {
        // Agregar resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'col-resize-handle';
        header.appendChild(resizeHandle);

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(header, e);
        });
    });

    // Mouse move y mouseup globales
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
}

function startResize(column, e) {
    resizeState.isResizing = true;
    resizeState.currentColumn = column;
    resizeState.startX = e.pageX;
    resizeState.startWidth = column.offsetWidth;

    const handle = column.querySelector('.col-resize-handle');
    if (handle) handle.classList.add('resizing');

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

function onResize(e) {
    if (!resizeState.isResizing) return;

    const diff = e.pageX - resizeState.startX;
    const newWidth = Math.max(50, resizeState.startWidth + diff);

    resizeState.currentColumn.style.width = newWidth + 'px';
    resizeState.currentColumn.style.minWidth = newWidth + 'px';
}

function stopResize() {
    if (!resizeState.isResizing) return;

    resizeState.isResizing = false;

    if (resizeState.currentColumn) {
        const handle = resizeState.currentColumn.querySelector('.col-resize-handle');
        if (handle) handle.classList.remove('resizing');
        resizeState.currentColumn = null;
    }

    document.body.style.cursor = '';
    document.body.style.userSelect = '';
}

function initFilters() {
    const filterToggles = document.querySelectorAll('.filter-toggle');
    filterToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const column = toggle.dataset.column;
            toggleFilterDropdown(column, toggle);
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.filter-dropdown') && !e.target.closest('.filter-toggle')) {
            closeFilterDropdown();
        }
    });

    // Filter dropdown buttons
    const selectAllBtn = document.querySelector('.filter-select-all-btn');
    const clearBtn = document.querySelector('.filter-clear-btn');
    const applyBtn = document.querySelector('.filter-apply-btn');

    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllFilters);
    if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);

    // Filter search
    const filterSearch = document.querySelector('.filter-search');
    if (filterSearch) {
        filterSearch.addEventListener('input', (e) => {
            filterDropdownOptions(e.target.value);
        });
    }
}

function toggleFilterDropdown(column, toggleBtn) {
    const dropdown = document.getElementById('filterDropdown');
    if (!dropdown) return;

    // Si ya está abierto en esta columna, cerrarlo
    if (filterState.activeColumn === column && !dropdown.classList.contains('hidden')) {
        closeFilterDropdown();
        return;
    }

    filterState.activeColumn = column;

    // Posicionar dropdown
    const rect = toggleBtn.getBoundingClientRect();
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + 4) + 'px';

    // Poblar opciones
    populateFilterOptions(column);

    // Mostrar dropdown
    dropdown.classList.remove('hidden');

    // Marcar botón como activo
    document.querySelectorAll('.filter-toggle').forEach(btn => btn.classList.remove('active'));
    toggleBtn.classList.add('active');
}

function closeFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }
    document.querySelectorAll('.filter-toggle').forEach(btn => btn.classList.remove('active'));
    filterState.activeColumn = null;
}

function populateFilterOptions(column) {
    const optionsContainer = document.getElementById('filterDropdownOptions');
    if (!optionsContainer) return;

    // Extraer valores únicos de la columna
    const values = new Set();
    state.materials.forEach(mat => {
        let value;
        switch(column) {
            case 'code':
                value = mat.ID;
                break;
            case 'name':
                value = mat.short_description || mat['Short Description'];
                break;
            case 'category':
                value = mat.category_name;
                break;
            case 'brand':
                value = mat.brand || mat.Brand;
                break;
            case 'vendor':
                value = mat.vendor_name;
                break;
            case 'unit':
                value = mat.unit_name || mat.Unit;
                break;
        }
        if (value && value.trim()) values.add(value);
    });

    // Crear opciones
    optionsContainer.innerHTML = '';
    const sortedValues = Array.from(values).sort();

    sortedValues.forEach(value => {
        const isChecked = filterState.columnFilters[column].has(value);
        const label = document.createElement('label');
        label.className = 'filter-option';
        label.innerHTML = `
            <input type="checkbox" value="${escapeHtml(value)}" ${isChecked ? 'checked' : ''}>
            <span>${escapeHtml(value)}</span>
        `;
        optionsContainer.appendChild(label);
    });
}

function filterDropdownOptions(searchText) {
    const optionsContainer = document.getElementById('filterDropdownOptions');
    if (!optionsContainer) return;

    const options = optionsContainer.querySelectorAll('.filter-option');
    const search = searchText.toLowerCase();

    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(search) ? 'flex' : 'none';
    });
}

function selectAllFilters() {
    const optionsContainer = document.getElementById('filterDropdownOptions');
    if (!optionsContainer) return;

    optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
    });
}

function clearFilters() {
    const optionsContainer = document.getElementById('filterDropdownOptions');
    if (!optionsContainer) return;

    optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
}

function applyFilters() {
    const column = filterState.activeColumn;
    if (!column) return;

    const optionsContainer = document.getElementById('filterDropdownOptions');
    if (!optionsContainer) return;

    // Recopilar valores seleccionados
    const selected = new Set();
    optionsContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
        selected.add(checkbox.value);
    });

    filterState.columnFilters[column] = selected;

    // Aplicar filtros a la tabla
    filterTable();

    // Cerrar dropdown
    closeFilterDropdown();
}

function filterTable() {
    const tbody = document.getElementById('materialsTableBody');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        let visible = true;

        // Aplicar cada filtro de columna
        for (const [column, selectedValues] of Object.entries(filterState.columnFilters)) {
            if (selectedValues.size === 0) continue; // Sin filtro en esta columna

            let cellValue;
            const cells = row.querySelectorAll('td');

            switch(column) {
                case 'code':
                    cellValue = cells[1]?.textContent?.trim();
                    break;
                case 'name':
                    cellValue = cells[2]?.textContent?.trim();
                    break;
                case 'category':
                    cellValue = cells[3]?.textContent?.trim();
                    break;
                case 'brand':
                    cellValue = cells[4]?.textContent?.trim();
                    break;
                case 'vendor':
                    cellValue = cells[5]?.textContent?.trim();
                    break;
                case 'unit':
                    cellValue = cells[6]?.textContent?.trim();
                    break;
            }

            if (cellValue && !selectedValues.has(cellValue)) {
                visible = false;
                break;
            }
        }

        row.style.display = visible ? '' : 'none';
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        initFilters();
        initResizableColumns();
    });
} else {
    init();
    initFilters();
    initResizableColumns();
}
