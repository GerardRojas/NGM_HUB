// assets/js/pipeline_catalog_picker.js
// Catalog Picker component - Monday.com style dropdown for selecting catalog items
(function() {
  'use strict';

  console.log('[CatalogPicker] Script loaded');

  // ================================
  // CONFIGURATION
  // ================================
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ================================
  // STATE - Caches for each catalog type
  // ================================
  const catalogCache = {
    projects: { data: null, timestamp: 0 },
    companies: { data: null, timestamp: 0 },
    departments: { data: null, timestamp: 0 },
    types: { data: null, timestamp: 0 },
    priorities: { data: null, timestamp: 0 }
  };

  let activeDropdown = null;

  // ================================
  // UTILITIES (use shared PipelineUtils)
  // ================================
  const escapeHtml = window.PipelineUtils?.escapeHtml || (s => String(s ?? ''));
  const getInitial = window.PipelineUtils?.getInitial || (n => (n || '?')[0]?.toUpperCase() || '?');

  // Generate stable hue from string
  function stableHueFromString(str) {
    const s = String(str || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  // ================================
  // API
  // ================================
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Catalog type configurations
  const CATALOG_CONFIG = {
    project: {
      endpoint: '/projects',
      idKey: 'project_id',
      nameKey: 'project_name',
      searchFields: ['project_name', 'project_code'],
      icon: '📁',
      placeholder: 'Search projects...'
    },
    company: {
      endpoint: '/pipeline/companies',
      idKey: 'id',
      nameKey: 'name',
      searchFields: ['name'],
      icon: '🏢',
      placeholder: 'Search companies...'
    },
    department: {
      endpoint: '/pipeline/task-departments',
      idKey: 'department_id',
      nameKey: 'department_name',
      searchFields: ['department_name'],
      icon: '🏷️',
      placeholder: 'Search departments...'
    },
    type: {
      endpoint: '/pipeline/task-types',
      idKey: 'type_id',
      nameKey: 'type_name',
      searchFields: ['type_name'],
      icon: '📋',
      placeholder: 'Search types...'
    },
    priority: {
      endpoint: '/pipeline/task-priorities',
      idKey: 'priority_id',
      nameKey: 'priority',
      searchFields: ['priority'],
      icon: '🎯',
      placeholder: 'Search priorities...'
    }
  };

  async function fetchCatalog(catalogType) {
    console.log('[CatalogPicker] fetchCatalog called:', catalogType);
    const config = CATALOG_CONFIG[catalogType];
    if (!config) {
      console.error('[CatalogPicker] Unknown catalog type:', catalogType);
      return [];
    }

    // Proper pluralization for cache keys
    const pluralMap = {
      company: 'companies',
      priority: 'priorities',
      project: 'projects',
      department: 'departments',
      type: 'types'
    };
    const cacheKey = pluralMap[catalogType] || (catalogType + 's');
    const cache = catalogCache[cacheKey];
    const now = Date.now();

    // Return cached data if still valid
    if (cache && cache.data && (now - cache.timestamp) < CACHE_TTL) {
      return cache.data;
    }

    try {
      const apiBase = window.API_BASE || '';
      const res = await fetch(`${apiBase}${config.endpoint}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (!res.ok) throw new Error(`Failed to load ${catalogType}: ${res.status}`);

      const data = await res.json();
      let items = Array.isArray(data) ? data : (data.data || data[cacheKey] || []);

      // Normalize items
      items = items.map(item => ({
        id: item[config.idKey] || item.id,
        name: item[config.nameKey] || item.name || 'Unknown',
        code: item.code || item.project_code || null,
        color: item.color || `hsl(${stableHueFromString(item[config.nameKey] || item.name)} 60% 50%)`,
        raw: item // Keep original data
      }));

      // Update cache
      catalogCache[cacheKey] = { data: items, timestamp: now };

      return items;
    } catch (err) {
      console.error(`[CatalogPicker] Error fetching ${catalogType}:`, err);
      // Only show toast if no cached data to fall back on
      if (!cache?.data && window.Toast) {
        Toast.error('Load Failed', `Could not load ${catalogType} options.`);
      }
      return cache?.data || [];
    }
  }

  // ================================
  // RENDER HELPERS
  // ================================
  function renderIcon(item, catalogType) {
    const config = CATALOG_CONFIG[catalogType];
    const initial = escapeHtml(getInitial(item.name));
    const color = item.color || '#888';

    return `
      <div class="pm-catalog-icon" style="color: ${color}; border-color: ${color};">
        ${initial}
      </div>
    `;
  }

  function renderChip(item, catalogType, removable = true) {
    const removeBtn = removable
      ? `<button type="button" class="pm-catalog-chip-remove" data-item-id="${item.id}" title="Remove">×</button>`
      : '';

    return `
      <span class="pm-catalog-chip" data-item-id="${item.id}">
        ${renderIcon(item, catalogType)}
        <span class="pm-catalog-chip-name">${escapeHtml(item.name)}</span>
        ${removeBtn}
      </span>
    `;
  }

  function renderItem(item, catalogType, isSelected = false) {
    const color = item.color || '#888';
    const initial = escapeHtml(getInitial(item.name));

    return `
      <div class="pm-catalog-item ${isSelected ? 'is-selected' : ''}" data-item-id="${item.id}">
        <div class="pm-catalog-item-icon" style="color: ${color}; border-color: ${color};">
          ${initial}
        </div>
        <div class="pm-catalog-item-info">
          <div class="pm-catalog-item-name">${escapeHtml(item.name)}</div>
          ${item.code ? `<div class="pm-catalog-item-code">${escapeHtml(item.code)}</div>` : ''}
        </div>
        <div class="pm-catalog-item-check">✓</div>
      </div>
    `;
  }

  // ================================
  // CATALOG PICKER CLASS
  // ================================
  class CatalogPicker {
    constructor(container, options = {}) {
      console.log('[CatalogPicker] Constructor called with options:', options);
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!this.container) {
        console.error('[CatalogPicker] Container not found');
        return;
      }

      // Options
      this.catalogType = options.catalogType || 'project';
      this.placeholder = options.placeholder || CATALOG_CONFIG[this.catalogType]?.placeholder || 'Select...';
      this.onChange = options.onChange || null;
      this.allowClear = options.allowClear !== false;

      // State
      this.selectedItem = null;
      this.isOpen = false;
      this.searchQuery = '';
      this.items = [];

      console.log('[CatalogPicker] Building UI for type:', this.catalogType);
      // Build UI
      this.render();
      this.bindEvents();
      console.log('[CatalogPicker] Instance created successfully');
    }

    render() {
      const config = CATALOG_CONFIG[this.catalogType] || {};

      this.container.innerHTML = `
        <div class="pm-catalog-picker">
          <div class="pm-catalog-trigger" tabindex="0">
            <div class="pm-catalog-selected">
              <span class="pm-catalog-trigger-placeholder">${escapeHtml(this.placeholder)}</span>
            </div>
            <span class="pm-catalog-trigger-arrow">▾</span>
          </div>
          <div class="pm-catalog-dropdown">
            <div class="pm-catalog-search-wrap">
              <div class="pm-catalog-search">
                <span class="pm-catalog-search-icon">⌕</span>
                <input type="text" placeholder="${escapeHtml(config.placeholder || 'Search...')}" />
              </div>
            </div>
            <div class="pm-catalog-list">
              <div class="pm-catalog-loading">Loading...</div>
            </div>
          </div>
        </div>
      `;

      // Cache elements
      this.trigger = this.container.querySelector('.pm-catalog-trigger');
      this.selectedContainer = this.container.querySelector('.pm-catalog-selected');
      this.dropdown = this.container.querySelector('.pm-catalog-dropdown');
      this.searchInput = this.container.querySelector('.pm-catalog-search input');
      this.list = this.container.querySelector('.pm-catalog-list');
    }

    bindEvents() {
      // Toggle dropdown
      this.trigger.addEventListener('click', (e) => {
        if (e.target.closest('.pm-catalog-chip-remove')) return;
        this.toggle();
      });

      // Keyboard nav on trigger
      this.trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        } else if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      // Search input
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderList();
      });

      // Prevent dropdown close when clicking inside
      this.dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // Select item from list
      this.list.addEventListener('click', (e) => {
        console.log('[CatalogPicker] ========== LIST CLICK ==========');
        console.log('[CatalogPicker] List click detected!');
        console.log('[CatalogPicker] Click target:', e.target);
        console.log('[CatalogPicker] Click target tagName:', e.target.tagName);
        console.log('[CatalogPicker] Click target className:', e.target.className);
        console.log('[CatalogPicker] Click target outerHTML:', e.target.outerHTML?.substring(0, 200));
        const itemEl = e.target.closest('.pm-catalog-item');
        console.log('[CatalogPicker] Found .pm-catalog-item:', itemEl);
        if (itemEl) {
          const itemId = itemEl.dataset.itemId;
          console.log('[CatalogPicker] itemId from dataset:', itemId);
          console.log('[CatalogPicker] Calling selectItem...');
          this.selectItem(itemId);
        } else {
          console.log('[CatalogPicker] No .pm-catalog-item found from target');
          console.log('[CatalogPicker] All items in list:', this.list.querySelectorAll('.pm-catalog-item').length);
        }
        console.log('[CatalogPicker] ========== LIST CLICK END ==========');
      });

      // Remove chip (clear selection)
      this.selectedContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.pm-catalog-chip-remove');
        if (removeBtn) {
          e.stopPropagation();
          this.clear();
        }
      });

      // Close on outside click - store reference for cleanup
      // Use _openingLock to prevent the original click from closing the picker
      this._openingLock = false;
      this._onDocumentClick = (e) => {
        console.log('[CatalogPicker] Document click handler:', {
          isOpen: this.isOpen,
          openingLock: this._openingLock,
          target: e.target,
          targetClass: e.target.className,
          containerContains: this.container.contains(e.target),
          dropdownContains: this.dropdown.contains(e.target)
        });
        // Ignore clicks while opening (the original click that triggered open)
        if (this._openingLock) {
          console.log('[CatalogPicker] Ignoring click - opening lock active');
          return;
        }
        // Also check if click is inside dropdown (which may be positioned outside container due to fixed)
        if (this.isOpen && !this.container.contains(e.target) && !this.dropdown.contains(e.target)) {
          console.log('[CatalogPicker] Closing - click outside container and dropdown');
          this.close();
        }
      };
      document.addEventListener('click', this._onDocumentClick);

      // Close on Escape - store reference for cleanup
      this._onDocumentKeydown = (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
      document.addEventListener('keydown', this._onDocumentKeydown);
    }

    async toggle() {
      console.log('[CatalogPicker] toggle() called, isOpen:', this.isOpen);
      if (this.isOpen) {
        this.close();
      } else {
        await this.open();
      }
    }

    async open() {
      console.log('[CatalogPicker] open() called for type:', this.catalogType);
      // Close any other open dropdown
      if (activeDropdown && activeDropdown !== this) {
        activeDropdown.close();
      }

      // Lock to prevent the opening click from immediately closing
      this._openingLock = true;
      setTimeout(() => { this._openingLock = false; }, 100);

      this.isOpen = true;
      activeDropdown = this;
      this.trigger.classList.add('is-open');
      this.dropdown.classList.add('is-open');
      console.log('[CatalogPicker] Dropdown classes added, positioning...');

      // Position dropdown using fixed positioning for table cell overflow
      this.positionDropdown();

      // Add scroll listener to reposition dropdown when table scrolls
      this._scrollContainer = this.container.closest('.pm-group-body') || this.container.closest('[style*="overflow"]');
      if (this._scrollContainer) {
        this._onScroll = () => this.positionDropdown();
        this._scrollContainer.addEventListener('scroll', this._onScroll, { passive: true });
      }
      // Also listen to window scroll
      this._onWindowScroll = () => this.positionDropdown();
      window.addEventListener('scroll', this._onWindowScroll, { passive: true });

      // Load items if not cached
      console.log('[CatalogPicker] Loading items...');
      await this.loadItems();
      console.log('[CatalogPicker] Items loaded, count:', this.items?.length);

      // Focus search
      setTimeout(() => this.searchInput.focus(), 50);
    }

    positionDropdown() {
      // Get trigger position in viewport
      const triggerRect = this.trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 280; // max-height from CSS

      // Position dropdown below trigger, or above if not enough space
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      // Use fixed positioning to escape overflow containers
      this.dropdown.style.position = 'fixed';
      this.dropdown.style.left = `${triggerRect.left}px`;
      this.dropdown.style.width = `${Math.max(triggerRect.width, 220)}px`;

      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        // Position below
        this.dropdown.style.top = `${triggerRect.bottom + 4}px`;
        this.dropdown.style.bottom = 'auto';
      } else {
        // Position above
        this.dropdown.style.bottom = `${viewportHeight - triggerRect.top + 4}px`;
        this.dropdown.style.top = 'auto';
      }
    }

    close() {
      this.isOpen = false;
      if (activeDropdown === this) activeDropdown = null;
      this.trigger.classList.remove('is-open');
      this.dropdown.classList.remove('is-open');
      this.searchQuery = '';
      this.searchInput.value = '';
      // Remove scroll listeners
      if (this._scrollContainer && this._onScroll) {
        this._scrollContainer.removeEventListener('scroll', this._onScroll);
        this._scrollContainer = null;
        this._onScroll = null;
      }
      if (this._onWindowScroll) {
        window.removeEventListener('scroll', this._onWindowScroll);
        this._onWindowScroll = null;
      }
      // Reset positioning styles
      this.dropdown.style.position = '';
      this.dropdown.style.top = '';
      this.dropdown.style.bottom = '';
      this.dropdown.style.left = '';
      this.dropdown.style.width = '';
    }

    async loadItems() {
      console.log('[CatalogPicker] loadItems() called');
      this.list.innerHTML = '<div class="pm-catalog-loading">Loading...</div>';

      const items = await fetchCatalog(this.catalogType);
      console.log('[CatalogPicker] fetchCatalog returned:', items?.length, 'items');

      if (!items.length) {
        console.log('[CatalogPicker] No items found');
        this.list.innerHTML = '<div class="pm-catalog-empty">No items found</div>';
        return;
      }

      this.items = items;
      console.log('[CatalogPicker] Rendering list with', items.length, 'items');
      this.renderList();
    }

    renderList() {
      if (!this.items) return;

      const config = CATALOG_CONFIG[this.catalogType] || {};
      const searchFields = config.searchFields || ['name'];
      const query = this.searchQuery.toLowerCase();

      const filtered = query
        ? this.items.filter(item =>
            searchFields.some(field => {
              const value = item.raw?.[field] || item[field] || '';
              return String(value).toLowerCase().includes(query);
            })
          )
        : this.items;

      if (!filtered.length) {
        this.list.innerHTML = '<div class="pm-catalog-empty">No matching items</div>';
        return;
      }

      const selectedId = this.selectedItem?.id;

      this.list.innerHTML = filtered.map(item =>
        renderItem(item, this.catalogType, item.id === selectedId)
      ).join('');
    }

    selectItem(itemId) {
      console.log('[CatalogPicker] ========== selectItem() START ==========');
      console.log('[CatalogPicker] selectItem() called with id:', itemId);
      console.log('[CatalogPicker] this.items:', this.items);
      const item = this.items.find(i => String(i.id) === String(itemId));
      console.log('[CatalogPicker] Found item:', item);

      if (item) {
        // If clicking the same item, deselect (toggle behavior)
        if (this.selectedItem?.id === item.id) {
          console.log('[CatalogPicker] Deselecting item (toggle)');
          this.selectedItem = null;
        } else {
          console.log('[CatalogPicker] Selecting item:', item.name);
          this.selectedItem = item;
        }
      } else {
        console.error('[CatalogPicker] ERROR: Item not found in this.items for id:', itemId);
      }

      this.renderSelected();
      this.renderList();
      console.log('[CatalogPicker] About to emit change, selectedItem:', this.selectedItem);
      this.emitChange();
      console.log('[CatalogPicker] Closing picker...');
      this.close();
      console.log('[CatalogPicker] ========== selectItem() END ==========');
    }

    renderSelected() {
      if (!this.selectedItem) {
        this.selectedContainer.innerHTML = `
          <span class="pm-catalog-trigger-placeholder">${escapeHtml(this.placeholder)}</span>
        `;
        return;
      }

      this.selectedContainer.innerHTML = renderChip(this.selectedItem, this.catalogType, this.allowClear);
    }

    emitChange() {
      if (this.onChange) {
        this.onChange(this.selectedItem, this);
      }
    }

    // Public API
    getValue() {
      return this.selectedItem;
    }

    getValueId() {
      return this.selectedItem?.id || null;
    }

    getValueName() {
      return this.selectedItem?.name || null;
    }

    setValue(item) {
      this.selectedItem = item || null;
      this.renderSelected();
    }

    setValueById(id) {
      if (!id) {
        this.selectedItem = null;
        this.renderSelected();
        return;
      }

      // If items are loaded, find and set
      if (this.items.length) {
        const item = this.items.find(i => String(i.id) === String(id));
        this.selectedItem = item || null;
        this.renderSelected();
      } else {
        // Store ID and set when items load
        this._pendingId = id;
      }
    }

    setValueByName(name) {
      if (!name || name === '-') {
        this.selectedItem = null;
        this.renderSelected();
        return;
      }

      // If items are loaded, find and set
      if (this.items.length) {
        const item = this.items.find(i =>
          String(i.name).toLowerCase() === String(name).toLowerCase()
        );
        this.selectedItem = item || null;
        this.renderSelected();
      } else {
        // Store name and set when items load
        this._pendingName = name;
      }
    }

    clear() {
      this.selectedItem = null;
      this.renderSelected();
      this.renderList();
      this.emitChange();
    }

    destroy() {
      console.log('[CatalogPicker] destroy() called');
      // Close dropdown first to clean up positioning styles
      if (this.isOpen) {
        this.close();
      }
      // Remove document event listeners to prevent memory leaks and interference
      if (this._onDocumentClick) {
        document.removeEventListener('click', this._onDocumentClick);
      }
      if (this._onDocumentKeydown) {
        document.removeEventListener('keydown', this._onDocumentKeydown);
      }
      // Clear active dropdown reference if this was it
      if (activeDropdown === this) {
        activeDropdown = null;
      }
      this.container.innerHTML = '';
    }
  }

  // ================================
  // FACTORY FUNCTION
  // ================================
  function createCatalogPicker(container, options) {
    return new CatalogPicker(container, options);
  }

  // ================================
  // EXPOSE TO GLOBAL
  // ================================
  window.CatalogPicker = CatalogPicker;
  window.createCatalogPicker = createCatalogPicker;
  window.PM_CatalogPicker = {
    create: createCatalogPicker,
    fetchCatalog,
    CATALOG_CONFIG
  };

})();
