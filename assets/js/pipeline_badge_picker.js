// assets/js/pipeline_badge_picker.js
// Badge Picker component - colored pill dropdown for status and similar columns
(function() {
  'use strict';

  let activeDropdown = null;
  const escapeHtml = window.PipelineUtils?.escapeHtml || (s => String(s ?? ''));

  // ================================
  // BADGE PICKER CLASS
  // ================================
  class BadgePicker {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!this.container) {
        console.error('[BadgePicker] Container not found');
        return;
      }

      this.items = options.items || []; // [{id, name, color}]
      this.onChange = options.onChange || null;
      this.placeholder = options.placeholder || 'Select...';
      this.selectedItem = null;
      this.isOpen = false;

      this.render();
      this.bindEvents();
    }

    render() {
      this.container.innerHTML = `
        <div class="pm-badge-picker">
          <div class="pm-badge-trigger" tabindex="0">
            <span class="pm-badge-placeholder">${escapeHtml(this.placeholder)}</span>
          </div>
          <div class="pm-badge-dropdown">
            <div class="pm-badge-list"></div>
          </div>
        </div>
      `;

      this.trigger = this.container.querySelector('.pm-badge-trigger');
      this.dropdown = this.container.querySelector('.pm-badge-dropdown');
      this.list = this.container.querySelector('.pm-badge-list');

      this.renderList();
    }

    bindEvents() {
      this.trigger.addEventListener('click', () => this.toggle());

      this.trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggle();
        } else if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      });

      this.dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const option = e.target.closest('.pm-badge-option');
        if (option) {
          this.selectItem(option.dataset.value);
        }
      });

      this._openingLock = false;
      this._onDocumentClick = (e) => {
        if (this._openingLock) return;
        if (this.isOpen && !this.container.contains(e.target) && !this.dropdown.contains(e.target)) {
          this.close();
        }
      };
      document.addEventListener('click', this._onDocumentClick);

      this._onDocumentKeydown = (e) => {
        if (e.key === 'Escape' && this.isOpen) this.close();
      };
      document.addEventListener('keydown', this._onDocumentKeydown);
    }

    renderList() {
      const selectedId = this.selectedItem ? String(this.selectedItem.id).toLowerCase() : null;

      this.list.innerHTML = this.items.map(item => {
        const itemId = String(item.id).toLowerCase();
        const isSelected = itemId === selectedId;
        return `
          <div class="pm-badge-option ${isSelected ? 'is-selected' : ''}" data-value="${escapeHtml(item.id)}">
            <span class="pm-badge-pill" style="background: ${item.color};">${escapeHtml(item.name)}</span>
            <span class="pm-badge-check"></span>
          </div>
        `;
      }).join('');
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }

    open() {
      if (activeDropdown && activeDropdown !== this) activeDropdown.close();

      this._openingLock = true;
      setTimeout(() => { this._openingLock = false; }, 100);

      this.isOpen = true;
      activeDropdown = this;
      this.trigger.classList.add('is-open');
      this.dropdown.classList.add('is-open');

      this.positionDropdown();

      // Move to body to escape stacking contexts
      if (this.dropdown.parentElement !== document.body) {
        document.body.appendChild(this.dropdown);
      }

      this._scrollContainer = this.container.closest('.pm-group-body') || null;
      if (this._scrollContainer) {
        this._onScroll = () => this.positionDropdown();
        this._scrollContainer.addEventListener('scroll', this._onScroll, { passive: true });
      }
      this._onWindowScroll = () => this.positionDropdown();
      window.addEventListener('scroll', this._onWindowScroll, { passive: true });
    }

    positionDropdown() {
      const triggerRect = this.trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 320;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;

      this.dropdown.style.position = 'fixed';
      this.dropdown.style.left = `${triggerRect.left}px`;
      this.dropdown.style.right = 'auto';
      this.dropdown.style.width = `${Math.max(triggerRect.width, 200)}px`;
      this.dropdown.style.zIndex = '99999';

      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        this.dropdown.style.top = `${triggerRect.bottom + 4}px`;
        this.dropdown.style.bottom = 'auto';
      } else {
        this.dropdown.style.bottom = `${viewportHeight - triggerRect.top + 4}px`;
        this.dropdown.style.top = 'auto';
      }
    }

    close() {
      this.isOpen = false;
      if (activeDropdown === this) activeDropdown = null;
      this.trigger.classList.remove('is-open');
      this.dropdown.classList.remove('is-open');

      const pickerEl = this.container.querySelector('.pm-badge-picker');
      if (pickerEl && this.dropdown.parentElement === document.body) {
        pickerEl.appendChild(this.dropdown);
      }

      if (this._scrollContainer && this._onScroll) {
        this._scrollContainer.removeEventListener('scroll', this._onScroll);
        this._scrollContainer = null;
        this._onScroll = null;
      }
      if (this._onWindowScroll) {
        window.removeEventListener('scroll', this._onWindowScroll);
        this._onWindowScroll = null;
      }

      this.dropdown.style.position = '';
      this.dropdown.style.top = '';
      this.dropdown.style.bottom = '';
      this.dropdown.style.left = '';
      this.dropdown.style.right = '';
      this.dropdown.style.width = '';
      this.dropdown.style.zIndex = '';
    }

    selectItem(itemId) {
      const item = this.items.find(i => String(i.id).toLowerCase() === String(itemId).toLowerCase());
      if (item) {
        this.selectedItem = item;
        this.renderSelected();
        this.renderList();
        this.emitChange();
        this.close();
      }
    }

    renderSelected() {
      if (!this.selectedItem) {
        this.trigger.innerHTML = `<span class="pm-badge-placeholder">${escapeHtml(this.placeholder)}</span>`;
        return;
      }
      this.trigger.innerHTML = `
        <span class="pm-badge-pill" style="background: ${this.selectedItem.color};">${escapeHtml(this.selectedItem.name)}</span>
      `;
    }

    emitChange() {
      if (this.onChange) this.onChange(this.selectedItem, this);
    }

    // Public API
    getValue() { return this.selectedItem; }
    getValueId() { return this.selectedItem?.id || null; }
    getValueName() { return this.selectedItem?.name || null; }

    setValue(item) {
      this.selectedItem = item || null;
      this.renderSelected();
    }

    setValueByName(name) {
      if (!name || name === '-') {
        this.selectedItem = null;
        this.renderSelected();
        return;
      }
      const lower = String(name).toLowerCase();
      const item = this.items.find(i =>
        String(i.name).toLowerCase() === lower ||
        String(i.id).toLowerCase() === lower
      );
      this.selectedItem = item || null;
      this.renderSelected();
    }

    clear() {
      this.selectedItem = null;
      this.renderSelected();
      this.renderList();
      this.emitChange();
    }

    destroy() {
      if (this.isOpen) this.close();
      if (this.dropdown?.parentElement === document.body) this.dropdown.remove();
      if (this._onDocumentClick) document.removeEventListener('click', this._onDocumentClick);
      if (this._onDocumentKeydown) document.removeEventListener('keydown', this._onDocumentKeydown);
      if (activeDropdown === this) activeDropdown = null;
      this.container.innerHTML = '';
    }
  }

  // ================================
  // EXPOSE TO GLOBAL
  // ================================
  window.BadgePicker = BadgePicker;
  window.PM_BadgePicker = {
    create: (container, options) => new BadgePicker(container, options)
  };

})();
