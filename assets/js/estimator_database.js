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
        wastePercent: 0,     // Waste percentage for materials
        activeFilters: new Set(['material', 'labor', 'inline']), // Active type filters
        selectedPickerMaterial: null // Currently selected material in picker
    }
};

// ========================================
// DOM Elements
// ========================================
const DOM = {
    // Tabs
    tabMaterials: document.getElementById('tabMaterials'),
    tabConcepts: document.getElementById('tabConcepts'),

    // States
    loadingState: document.getElementById('databaseLoadingState'),
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
    materialImagePreview: document.getElementById('materialImagePreview'),
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
    conceptImagePreview: document.getElementById('conceptImagePreview'),
    btnCloseConceptModal: document.getElementById('btnCloseConceptModal'),
    btnCancelConcept: document.getElementById('btnCancelConcept'),
    btnSaveConcept: document.getElementById('btnSaveConcept'),

    // Builder toolbar
    btnAddFromDB: document.getElementById('btnAddFromDB'),
    btnAddLabor: document.getElementById('btnAddLabor'),
    btnAddInline: document.getElementById('btnAddInline'),
    btnClearAllItems: document.getElementById('btnClearAllItems'),

    // Builder filters
    filterMaterial: document.getElementById('filterMaterial'),
    filterLabor: document.getElementById('filterLabor'),
    filterInline: document.getElementById('filterInline'),

    // Builder table
    builderTableContainer: document.getElementById('builderTableContainer'),
    builderTableBody: document.getElementById('builderTableBody'),
    builderEmpty: document.getElementById('builderEmpty'),

    // Builder fields
    conceptWastePercent: document.getElementById('conceptWastePercent'),

    // Builder summary
    summaryMaterials: document.getElementById('summaryMaterials'),
    summaryLabor: document.getElementById('summaryLabor'),
    summaryInline: document.getElementById('summaryInline'),
    summaryWaste: document.getElementById('summaryWaste'),
    summaryTotal: document.getElementById('summaryTotal'),

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
    inlineItemType: document.getElementById('inlineItemType'),
    inlineItemDesc: document.getElementById('inlineItemDesc'),
    inlineItemUnit: document.getElementById('inlineItemUnit'),
    inlineItemQty: document.getElementById('inlineItemQty'),
    inlineItemCost: document.getElementById('inlineItemCost')
};

// ========================================
// API Calls
// ========================================
const API = {
    async fetchMaterials(page = 1, search = '', categoryId = '') {
        const params = new URLSearchParams({
            page: page.toString(),
            page_size: state.pagination.pageSize.toString()
        });
        if (search) params.append('search', search);
        if (categoryId) params.append('category_id', categoryId);

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
    }
};

// ========================================
// Render Functions
// ========================================
function showLoading() {
    DOM.loadingState.style.display = 'flex';
    DOM.emptyState.style.display = 'none';
    DOM.materialsContent.style.display = 'none';
    DOM.conceptsContent.style.display = 'none';
    DOM.paginationContainer.style.display = 'none';
}

function showEmpty(message) {
    DOM.loadingState.style.display = 'none';
    DOM.emptyState.style.display = 'flex';
    DOM.emptyStateMessage.textContent = message;
    DOM.materialsContent.style.display = 'none';
    DOM.conceptsContent.style.display = 'none';
    DOM.paginationContainer.style.display = 'none';
}

function showContent() {
    DOM.loadingState.style.display = 'none';
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
        tr.innerHTML = `
            <td>${imageCell}</td>
            <td><code style="font-size: 12px; color: #9ca3af;">${escapeHtml(mat.ID || '')}</code></td>
            <td>${escapeHtml(mat.short_description || mat['Short Description'] || '-')}</td>
            <td>${escapeHtml(mat.category_name || '-')}</td>
            <td>${escapeHtml(mat.unit_name || mat.Unit || '-')}</td>
            <td>${formatCurrency(mat.price_numeric || mat.Price || 0)}</td>
            <td>
                <button class="btn-action" onclick="editMaterial('${escapeHtml(mat.ID)}')">Edit</button>
                <button class="btn-action btn-action-danger" onclick="confirmDeleteMaterial('${escapeHtml(mat.ID)}')">Del</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    showContent();
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
            <td><span style="color: #3ecf8e;">${con.materials_count || 0}</span></td>
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
    const select = DOM.filterUnit;
    select.innerHTML = '<option value="">All Units</option>';
    state.units.forEach(unit => {
        select.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
    });

    // Also populate modal selects
    const materialUnit = DOM.materialUnit;
    const conceptUnit = DOM.conceptUnit;

    materialUnit.innerHTML = '<option value="">Select unit...</option>';
    conceptUnit.innerHTML = '<option value="">Select unit...</option>';

    state.units.forEach(unit => {
        materialUnit.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
        conceptUnit.innerHTML += `<option value="${unit.id_unit}">${escapeHtml(unit.unit_name)}</option>`;
    });
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
                state.filters.category_id
            );
            state.materials = result.data || [];
            state.pagination = { ...state.pagination, ...result.pagination };
            renderMaterialsTable();
        } else {
            const result = await API.fetchConcepts(
                state.pagination.page,
                state.filters.search,
                state.filters.category_id
            );
            state.concepts = result.data || [];
            state.pagination = { ...state.pagination, ...result.pagination };
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
        const [categoriesRes, unitsRes] = await Promise.all([
            API.fetchCategories(),
            API.fetchUnits()
        ]);

        state.categories = categoriesRes.data || [];
        state.units = unitsRes.data || [];

        populateCategoryFilter();
        populateUnitFilter();
    } catch (error) {
        console.error('Error loading lookups:', error);
    }
}

// ========================================
// Tab Switching
// ========================================
function switchTab(tab) {
    state.activeTab = tab;
    state.pagination.page = 1;

    // Update tab buttons
    DOM.tabMaterials.classList.toggle('tab-btn-active', tab === 'materials');
    DOM.tabConcepts.classList.toggle('tab-btn-active', tab === 'concepts');

    // Update button text
    DOM.btnAddNew.textContent = tab === 'materials' ? '+ Add Material' : '+ Add Concept';
    DOM.btnAddFromEmpty.textContent = tab === 'materials' ? '+ Add First Material' : '+ Add First Concept';

    loadData();
}

// ========================================
// Material Modal
// ========================================
function openMaterialModal(material = null) {
    state.editingId = material ? material.ID : null;

    DOM.materialModalTitle.textContent = material ? 'Edit Material' : 'Add Material';
    DOM.materialCode.value = material?.ID || '';
    DOM.materialCode.disabled = !!material; // Can't change ID when editing
    DOM.materialName.value = material?.short_description || material?.['Short Description'] || '';
    DOM.materialCategory.value = material?.category_id || '';
    DOM.materialUnit.value = material?.unit_id || '';
    DOM.materialUnitCost.value = material?.price_numeric || '';
    DOM.materialSupplier.value = material?.Vendor || '';
    DOM.materialDescription.value = material?.full_description || material?.['Full Description'] || '';

    // Image field
    const imageUrl = material?.image || material?.Image || '';
    DOM.materialImage.value = imageUrl;
    updateImagePreview(imageUrl);

    DOM.materialModal.classList.remove('hidden');
}

function updateImagePreview(url) {
    if (url && url.trim()) {
        DOM.materialImagePreview.innerHTML = `<img src="${escapeHtml(url)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\\'color: #ef4444; font-size: 10px;\\'>Invalid</span>'" />`;
    } else {
        DOM.materialImagePreview.innerHTML = '<span style="color: #6b7280; font-size: 10px;">No img</span>';
    }
}

function closeMaterialModal() {
    DOM.materialModal.classList.add('hidden');
    state.editingId = null;
}

async function saveMaterial() {
    const data = {
        ID: DOM.materialCode.value.trim(),
        short_description: DOM.materialName.value.trim(),
        full_description: DOM.materialDescription.value.trim(),
        category_id: DOM.materialCategory.value || null,
        unit_id: DOM.materialUnit.value || null,
        price_numeric: parseFloat(DOM.materialUnitCost.value) || 0,
        image: DOM.materialImage.value.trim() || null
    };

    if (!data.ID || !data.short_description) {
        showToast('Code and Name are required', 'error');
        return;
    }

    try {
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
// Concept Builder Modal
// ========================================
function openConceptModal(concept = null) {
    state.editingId = concept ? concept.id : null;

    DOM.conceptModalTitle.textContent = concept ? 'Edit Concept' : 'New Concept';
    DOM.conceptCode.value = concept?.code || '';
    DOM.conceptName.value = concept?.short_description || '';
    DOM.conceptCategory.value = concept?.category_id || '';
    DOM.conceptUnit.value = concept?.unit_id || '';
    DOM.conceptDescription.value = concept?.full_description || '';

    // Concept image
    const conceptImageUrl = concept?.image || '';
    DOM.conceptImage.value = conceptImageUrl;
    updateConceptImagePreview(conceptImageUrl);

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
                type: 'material',
                materialId: m.material_id,
                description: m.material_name || m.material_id,
                unit: m.unit_name || m.material_unit || 'EA',
                qty: parseFloat(m.quantity) || 1,
                unitCost: parseFloat(m.unit_cost_override || m.material_price) || 0,
                image: m.material_image || '',
                origin: 'db'
            });
        });
    }

    // Load inline items from builder snapshot if exists
    if (concept?.builder?.items) {
        concept.builder.items.forEach(item => {
            if (item.type !== 'material') {
                state.builder.items.push({
                    id: generateItemId(),
                    type: item.type,
                    description: item.description,
                    unit: item.unit,
                    qty: parseFloat(item.qty) || 1,
                    unitCost: parseFloat(item.unit_cost) || 0,
                    image: item.image || '',
                    origin: 'custom'
                });
            }
        });
    }

    // Reset filters UI
    DOM.filterMaterial.classList.add('active');
    DOM.filterLabor.classList.add('active');
    DOM.filterInline.classList.add('active');

    renderBuilderTable();
    updateBuilderSummary();

    DOM.conceptModal.classList.remove('hidden');
}

function closeConceptModal() {
    DOM.conceptModal.classList.add('hidden');
    state.editingId = null;
    state.builder.items = [];
}

function updateConceptImagePreview(url) {
    if (url && url.trim()) {
        DOM.conceptImagePreview.innerHTML = `<img src="${escapeHtml(url)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\\'color: #ef4444; font-size: 10px;\\'>Invalid URL</span>'" />`;
    } else {
        DOM.conceptImagePreview.innerHTML = '<span style="color: #6b7280; font-size: 11px; text-align: center;">Click to<br>add image</span>';
    }
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
    const activeFilters = state.builder.activeFilters;

    const visibleItems = state.builder.items.filter(item => activeFilters.has(item.type));

    if (visibleItems.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = '';

    visibleItems.forEach(item => {
        const total = (item.qty || 0) * (item.unitCost || 0);
        const tr = document.createElement('tr');
        tr.dataset.itemId = item.id;

        const typeClass = `type-${item.type}`;
        const typeLabel = item.type === 'material' ? 'Mat' : item.type === 'labor' ? 'Lab' : 'Inline';

        // Image cell
        const imageUrl = item.image || '';
        const imageCell = imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" class="builder-item-img" onerror="this.outerHTML='<div class=\\'builder-item-img-placeholder\\'>-</div>'" />`
            : `<div class="builder-item-img-placeholder">${item.type === 'material' ? '-' : item.type === 'labor' ? 'L' : 'I'}</div>`;

        tr.innerHTML = `
            <td>${imageCell}</td>
            <td><span class="type-badge ${typeClass}">${typeLabel}</span></td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.unit)}</td>
            <td>
                <input type="number" class="builder-input item-qty" value="${item.qty}" min="0" step="0.001" data-item-id="${item.id}" />
            </td>
            <td>
                <input type="number" class="builder-input item-cost" value="${item.unitCost.toFixed(2)}" min="0" step="0.01" data-item-id="${item.id}" />
            </td>
            <td style="color: #3ecf8e; font-weight: 500;">${formatCurrency(total)}</td>
            <td>
                <button class="btn-action btn-action-danger" onclick="removeBuilderItem('${item.id}')" title="Remove">X</button>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Attach input handlers
    tbody.querySelectorAll('.item-qty').forEach(input => {
        input.addEventListener('change', onBuilderItemChange);
    });
    tbody.querySelectorAll('.item-cost').forEach(input => {
        input.addEventListener('change', onBuilderItemChange);
    });
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
    let inlineTotal = 0;

    state.builder.items.forEach(item => {
        const total = (item.qty || 0) * (item.unitCost || 0);
        if (item.type === 'material') materialTotal += total;
        else if (item.type === 'labor') laborTotal += total;
        else inlineTotal += total;
    });

    const wastePercent = parseFloat(DOM.conceptWastePercent.value) || 0;
    const wasteAmount = materialTotal * (wastePercent / 100);

    const grandTotal = materialTotal + laborTotal + inlineTotal + wasteAmount;

    // Update summary display
    DOM.summaryMaterials.textContent = formatCurrency(materialTotal);
    DOM.summaryLabor.textContent = formatCurrency(laborTotal);
    DOM.summaryInline.textContent = formatCurrency(inlineTotal);
    DOM.summaryWaste.textContent = formatCurrency(wasteAmount);
    DOM.summaryTotal.textContent = formatCurrency(grandTotal);

    // Update filter button labels
    DOM.filterMaterial.textContent = `Mat ${formatCurrency(materialTotal)}`;
    DOM.filterLabor.textContent = `Lab ${formatCurrency(laborTotal)}`;
    DOM.filterInline.textContent = `Inline ${formatCurrency(inlineTotal)}`;
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

    // Update UI
    const btnMap = {
        material: DOM.filterMaterial,
        labor: DOM.filterLabor,
        inline: DOM.filterInline
    };
    btnMap[type].classList.toggle('active', state.builder.activeFilters.has(type));

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

    state.builder.items.push({
        id: generateItemId(),
        type: 'material',
        materialId: mat.ID,
        description: mat.short_description || mat.ID,
        unit: mat.unit_name || 'EA',
        qty: qty,
        unitCost: parseFloat(mat.price_numeric) || 0,
        image: mat.image || mat.Image || '',
        origin: 'db'
    });

    closeMaterialPicker();
    renderBuilderTable();
    updateBuilderSummary();
    showToast('Material added', 'success');
}

// ========================================
// Inline/Labor Item Modal
// ========================================
function openInlineItemModal(type = 'inline') {
    DOM.inlineItemModalTitle.textContent = type === 'labor' ? 'Add Labor' : 'Add Inline Item';
    DOM.inlineItemType.value = type;
    DOM.inlineItemDesc.value = '';
    DOM.inlineItemUnit.value = type === 'labor' ? 'HR' : 'EA';
    DOM.inlineItemQty.value = 1;
    DOM.inlineItemCost.value = 0;

    DOM.inlineItemModal.classList.remove('hidden');
}

function closeInlineItemModal() {
    DOM.inlineItemModal.classList.add('hidden');
}

function confirmInlineItem() {
    const desc = DOM.inlineItemDesc.value.trim();
    if (!desc) {
        showToast('Description is required', 'error');
        return;
    }

    const type = DOM.inlineItemType.value;
    const unit = DOM.inlineItemUnit.value;
    const qty = parseFloat(DOM.inlineItemQty.value) || 1;
    const unitCost = parseFloat(DOM.inlineItemCost.value) || 0;

    state.builder.items.push({
        id: generateItemId(),
        type: type,
        description: desc,
        unit: unit,
        qty: qty,
        unitCost: unitCost,
        image: '', // Inline/labor items don't have images
        origin: 'custom'
    });

    closeInlineItemModal();
    renderBuilderTable();
    updateBuilderSummary();
    showToast(`${type === 'labor' ? 'Labor' : 'Inline item'} added`, 'success');
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
        const total = (item.qty || 0) * (item.unitCost || 0);

        if (item.type === 'material') {
            materialTotal += total;
            materials.push({
                material_id: item.materialId,
                quantity: item.qty,
                unit_cost_override: item.unitCost
            });
        } else if (item.type === 'labor') {
            laborTotal += total;
        } else {
            inlineTotal += total;
        }

        builderItems.push({
            type: item.type,
            description: item.description,
            unit: item.unit,
            qty: item.qty,
            unit_cost: item.unitCost,
            image: item.image || '',
            origin: item.origin
        });
    });

    const wastePercent = parseFloat(DOM.conceptWastePercent.value) || 0;
    const wasteAmount = materialTotal * (wastePercent / 100);
    const grandTotal = materialTotal + laborTotal + inlineTotal + wasteAmount;

    const data = {
        code: code,
        short_description: name,
        full_description: DOM.conceptDescription.value.trim(),
        category_id: DOM.conceptCategory.value || null,
        unit_id: DOM.conceptUnit.value || null,
        image: DOM.conceptImage.value.trim() || null,
        base_cost: grandTotal,
        waste_percent: wastePercent,
        calculated_cost: grandTotal,
        builder: {
            items: builderItems,
            totals: {
                materials: materialTotal,
                labor: laborTotal,
                inline: inlineTotal,
                waste: wasteAmount,
                total: grandTotal
            }
        }
    };

    try {
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
// Event Listeners
// ========================================
function setupEventListeners() {
    // Tabs
    DOM.tabMaterials.addEventListener('click', () => switchTab('materials'));
    DOM.tabConcepts.addEventListener('click', () => switchTab('concepts'));

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
    DOM.btnAddLabor.addEventListener('click', () => openInlineItemModal('labor'));
    DOM.btnAddInline.addEventListener('click', () => openInlineItemModal('inline'));
    DOM.btnClearAllItems.addEventListener('click', () => {
        if (state.builder.items.length === 0) return;
        if (!confirm('Clear all items?')) return;
        state.builder.items = [];
        renderBuilderTable();
        updateBuilderSummary();
    });

    // Builder type filters
    DOM.filterMaterial.addEventListener('click', () => toggleTypeFilter('material'));
    DOM.filterLabor.addEventListener('click', () => toggleTypeFilter('labor'));
    DOM.filterInline.addEventListener('click', () => toggleTypeFilter('inline'));

    // Waste percent change
    DOM.conceptWastePercent.addEventListener('input', updateBuilderSummary);

    // Concept image preview
    DOM.conceptImage.addEventListener('input', (e) => {
        updateConceptImagePreview(e.target.value);
    });

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

    // Image URL live preview
    DOM.materialImage.addEventListener('input', (e) => {
        updateImagePreview(e.target.value);
    });
}

// ========================================
// Initialize
// ========================================
async function init() {
    setupEventListeners();

    // Load lookups first, then data
    await loadLookups();
    await loadData();

    // Remove loading state
    document.body.classList.remove('page-loading');
    document.body.classList.add('auth-ready');
    const overlay = document.getElementById('pageLoadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
