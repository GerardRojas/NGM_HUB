// assets/js/pipeline_people_picker.js
// People Picker component - Monday.com style dropdown for selecting users
(function() {
  'use strict';

  console.log('[PeoplePicker] Script loaded');

  // ================================
  // CONFIGURATION
  // ================================
  const CACHE_KEY = 'pm_users_cache';
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ================================
  // STATE
  // ================================
  let usersCache = null;
  let cacheTimestamp = 0;
  let activeDropdown = null;

  // ================================
  // UTILITIES (use shared PipelineUtils)
  // ================================
  const escapeHtml = window.PipelineUtils?.escapeHtml || (s => String(s ?? ''));
  const getInitial = window.PipelineUtils?.getInitial || (n => (n || '?')[0]?.toUpperCase() || '?');

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  // Generate stable hue from string (for avatar color)
  function stableHueFromString(str) {
    const s = String(str || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  // Get color from user (uses avatar_color if available, otherwise generates from user_id)
  function colorFromUser(user) {
    const ac = Number(user.avatar_color);
    const hue = Number.isFinite(ac) ? clamp(ac, 0, 360) : stableHueFromString(user.user_id || user.id || user.user_name || user.name);
    return `hsl(${hue} 70% 45%)`;
  }

  // ================================
  // API
  // ================================
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function fetchUsers() {
    const now = Date.now();

    // Return cached data if still valid
    if (usersCache && (now - cacheTimestamp) < CACHE_TTL) {
      return usersCache;
    }

    try {
      const apiBase = window.API_BASE || '';
      const res = await fetch(`${apiBase}/team/users`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);

      const data = await res.json();
      usersCache = Array.isArray(data) ? data : (data.users || data.data || []);
      cacheTimestamp = now;

      // Normalize users
      usersCache = usersCache.map(u => ({
        id: u.user_id || u.id,
        name: u.user_name || u.name || u.username || 'Unknown',
        email: u.user_email || u.email || '',
        photo: u.user_photo || u.photo || u.avatar || null,
        color: colorFromUser(u),
        role: u.role?.name || u.user_role_name || '',
        status: u.status?.name || u.user_status_name || ''
      }));

      return usersCache;
    } catch (err) {
      console.error('[PeoplePicker] Error fetching users:', err);
      return usersCache || [];
    }
  }

  // ================================
  // RENDER HELPERS
  // ================================
  function renderAvatar(user, size = 'small') {
    const sizeClass = size === 'large' ? 'pm-people-item-avatar' : 'pm-people-avatar';
    const initial = escapeHtml(getInitial(user.name));
    const color = user.color || '#888';

    if (user.photo) {
      return `
        <div class="${sizeClass}" style="color: ${color}; border-color: ${color};">
          <img src="${escapeHtml(user.photo)}" alt="${escapeHtml(user.name)}" />
        </div>
      `;
    }

    return `
      <div class="${sizeClass}" style="color: ${color}; border-color: ${color};">
        ${initial}
      </div>
    `;
  }

  function renderChip(user, removable = true) {
    const removeBtn = removable
      ? `<button type="button" class="pm-people-chip-remove" data-user-id="${user.id}" title="Remove">×</button>`
      : '';

    return `
      <span class="pm-people-chip" data-user-id="${user.id}">
        ${renderAvatar(user, 'small')}
        <span class="pm-people-chip-name">${escapeHtml(user.name)}</span>
        ${removeBtn}
      </span>
    `;
  }

  function renderUserItem(user, isSelected = false) {
    return `
      <div class="pm-people-item ${isSelected ? 'is-selected' : ''}" data-user-id="${user.id}">
        ${renderAvatar(user, 'large')}
        <div class="pm-people-item-info">
          <div class="pm-people-item-name">${escapeHtml(user.name)}</div>
          ${user.email ? `<div class="pm-people-item-email">${escapeHtml(user.email)}</div>` : ''}
        </div>
        <div class="pm-people-item-check">✓</div>
      </div>
    `;
  }

  // ================================
  // PEOPLE PICKER CLASS
  // ================================
  class PeoplePicker {
    constructor(container, options = {}) {
      this.container = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!this.container) {
        console.error('[PeoplePicker] Container not found');
        return;
      }

      this.multiple = options.multiple !== false;
      this.placeholder = options.placeholder || 'Select people...';
      this.onChange = options.onChange || null;
      this.maxDisplay = options.maxDisplay || 3;

      this.selectedUsers = [];
      this.isOpen = false;
      this.searchQuery = '';

      this.render();
      this.bindEvents();
    }

    render() {
      this.container.innerHTML = `
        <div class="pm-people-picker">
          <div class="pm-people-trigger" tabindex="0">
            <div class="pm-people-selected">
              <span class="pm-people-trigger-placeholder">${escapeHtml(this.placeholder)}</span>
            </div>
          </div>
          <div class="pm-people-dropdown">
            <div class="pm-people-search-wrap">
              <div class="pm-people-search">
                <span class="pm-people-search-icon">⌕</span>
                <input type="text" placeholder="Search names, roles or teams" />
              </div>
            </div>
            <div class="pm-people-section-header">Suggested people</div>
            <div class="pm-people-list">
              <div class="pm-people-loading">Loading...</div>
            </div>
            <div class="pm-people-footer">
              <div class="pm-people-footer-hint">
                <span>🔔</span>
                <span>Assignees will be notified</span>
              </div>
              <button type="button" class="pm-people-footer-btn pm-people-mute-btn">Mute</button>
            </div>
          </div>
        </div>
      `;

      // Cache elements
      this.trigger = this.container.querySelector('.pm-people-trigger');
      this.selectedContainer = this.container.querySelector('.pm-people-selected');
      this.dropdown = this.container.querySelector('.pm-people-dropdown');
      this.searchInput = this.container.querySelector('.pm-people-search input');
      this.list = this.container.querySelector('.pm-people-list');
    }

    bindEvents() {
      // Toggle dropdown
      this.trigger.addEventListener('click', (e) => {
        if (e.target.closest('.pm-people-chip-remove')) return;
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

      // Select user from list
      this.list.addEventListener('click', (e) => {
        const item = e.target.closest('.pm-people-item');
        if (item) {
          this.toggleUser(item.dataset.userId);
        }
      });

      // Remove chip
      this.selectedContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.pm-people-chip-remove');
        if (removeBtn) {
          e.stopPropagation();
          this.removeUser(removeBtn.dataset.userId);
        }
      });

      // Close on outside click - store reference for cleanup
      this._openingLock = false;
      this._onDocumentClick = (e) => {
        if (this._openingLock) return;
        if (this.isOpen && !this.container.contains(e.target) && !this.dropdown.contains(e.target)) {
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
      if (this.isOpen) {
        this.close();
      } else {
        await this.open();
      }
    }

    async open() {
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

      // Position dropdown using fixed positioning for table cell overflow
      this.positionDropdown();

      // Move dropdown to document.body to escape table stacking contexts
      if (this.dropdown.parentElement !== document.body) {
        document.body.appendChild(this.dropdown);
      }

      // Add scroll listener to reposition dropdown when table scrolls
      this._scrollContainer = this.container.closest('.pm-group-body') || this.container.closest('[style*="overflow"]');
      if (this._scrollContainer) {
        this._onScroll = () => this.positionDropdown();
        this._scrollContainer.addEventListener('scroll', this._onScroll, { passive: true });
      }
      this._onWindowScroll = () => this.positionDropdown();
      window.addEventListener('scroll', this._onWindowScroll, { passive: true });

      // Load users if not cached
      await this.loadUsers();

      // Focus search
      setTimeout(() => this.searchInput.focus(), 50);
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
      this.dropdown.style.width = `${Math.max(triggerRect.width, 260)}px`;
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
      this.searchQuery = '';
      this.searchInput.value = '';

      // Move dropdown back from body to picker container
      const pickerEl = this.container.querySelector('.pm-people-picker');
      if (pickerEl && this.dropdown.parentElement === document.body) {
        pickerEl.appendChild(this.dropdown);
      }

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
      this.dropdown.style.right = '';
      this.dropdown.style.width = '';
      this.dropdown.style.zIndex = '';
    }

    async loadUsers() {
      this.list.innerHTML = '<div class="pm-people-loading">Loading...</div>';

      const users = await fetchUsers();

      if (!users.length) {
        this.list.innerHTML = '<div class="pm-people-empty">No users found</div>';
        return;
      }

      this.users = users;
      this.renderList();
    }

    renderList() {
      if (!this.users) return;

      const query = this.searchQuery.toLowerCase();
      const filtered = query
        ? this.users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query) ||
            (u.role && u.role.toLowerCase().includes(query))
          )
        : this.users;

      if (!filtered.length) {
        this.list.innerHTML = '<div class="pm-people-empty">No matching users</div>';
        return;
      }

      const selectedIds = new Set(this.selectedUsers.map(u => String(u.id)));

      this.list.innerHTML = filtered.map(user =>
        renderUserItem(user, selectedIds.has(String(user.id)))
      ).join('');
    }

    toggleUser(userId) {
      // Use String() for comparison - dataset values are always strings but
      // user IDs from API may be numbers, causing strict === to fail
      const uid = String(userId);
      const existingIndex = this.selectedUsers.findIndex(u => String(u.id) === uid);

      if (existingIndex >= 0) {
        this.selectedUsers.splice(existingIndex, 1);
      } else {
        const user = this.users.find(u => String(u.id) === uid);
        if (user) {
          if (!this.multiple) {
            this.selectedUsers = [user];
          } else {
            this.selectedUsers.push(user);
          }
        } else {
          console.error('[PeoplePicker] User not found for id:', userId);
        }
      }

      this.renderSelected();
      this.renderList();
      this.emitChange();

      // Close if single select
      if (!this.multiple) {
        this.close();
      }
    }

    removeUser(userId) {
      const uid = String(userId);
      this.selectedUsers = this.selectedUsers.filter(u => String(u.id) !== uid);
      this.renderSelected();
      this.renderList();
      this.emitChange();
    }

    renderSelected() {
      if (!this.selectedUsers.length) {
        this.selectedContainer.innerHTML = `
          <span class="pm-people-trigger-placeholder">${escapeHtml(this.placeholder)}</span>
        `;
        return;
      }

      // For multi-select with few users, show chips
      if (this.multiple && this.selectedUsers.length <= this.maxDisplay) {
        this.selectedContainer.innerHTML = this.selectedUsers
          .map(u => renderChip(u, true))
          .join('');
        return;
      }

      // For single select or many users, show stacked avatars
      const displayed = this.selectedUsers.slice(0, this.maxDisplay);
      const remaining = this.selectedUsers.length - this.maxDisplay;

      let html = '<div class="pm-people-stack">';
      html += displayed.map(u => renderAvatar(u, 'small')).join('');
      html += '</div>';

      if (remaining > 0) {
        html += `<span class="pm-people-stack-more">+${remaining}</span>`;
      }

      // Show first name for single select
      if (!this.multiple) {
        html = renderChip(this.selectedUsers[0], true);
      }

      this.selectedContainer.innerHTML = html;
    }

    emitChange() {
      if (this.onChange) {
        this.onChange(this.selectedUsers, this);
      }
    }

    // Public API
    getValue() {
      return this.multiple ? this.selectedUsers : (this.selectedUsers[0] || null);
    }

    getIds() {
      return this.selectedUsers.map(u => u.id);
    }

    getNames() {
      return this.selectedUsers.map(u => u.name);
    }

    setValue(users) {
      if (!users) {
        this.selectedUsers = [];
      } else if (Array.isArray(users)) {
        this.selectedUsers = users;
      } else {
        this.selectedUsers = [users];
      }
      this.renderSelected();
    }

    setValueByIds(ids) {
      if (!this.users) return;
      const idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(String));
      this.selectedUsers = this.users.filter(u => idSet.has(String(u.id)));
      this.renderSelected();
    }

    clear() {
      this.selectedUsers = [];
      this.renderSelected();
      this.emitChange();
    }

    destroy() {
      // Close dropdown first to clean up positioning styles
      if (this.isOpen) {
        this.close();
      }
      // Remove dropdown from body if it's still there (edge case)
      if (this.dropdown && this.dropdown.parentElement === document.body) {
        this.dropdown.remove();
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
  function createPeoplePicker(container, options) {
    return new PeoplePicker(container, options);
  }

  // ================================
  // Clear users cache (useful when users are added/updated externally)
  function clearCache() {
    usersCache = null;
    cacheTimestamp = 0;
    console.log('[PeoplePicker] Cache cleared');
  }

  // EXPOSE TO GLOBAL
  // ================================
  window.PeoplePicker = PeoplePicker;
  window.createPeoplePicker = createPeoplePicker;
  window.PM_PeoplePicker = {
    create: createPeoplePicker,
    fetchUsers,
    colorFromUser,
    clearCache
  };

})();
