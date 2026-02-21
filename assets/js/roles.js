// ================================
// ROLES MANAGEMENT
// Hub/Detail two-view permission manager
// ================================

(function () {
  'use strict';

  var API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';
  var PROTECTED_ROLES = ['CEO', 'COO'];

  // ================================
  // MODULE CATEGORIES (mirrors sidebar.js)
  // ================================

  var CATEGORIES = {
    general:      { label: 'General',          order: 0, colorClass: 'cat-general',      icon: 'G' },
    coordination: { label: 'Coordination',     order: 1, colorClass: 'cat-coordination', icon: 'C' },
    bookkeeping:  { label: 'Bookkeeping',      order: 2, colorClass: 'cat-bookkeeping',  icon: 'B' },
    architecture: { label: 'Architecture',     order: 3, colorClass: 'cat-architecture', icon: 'A' },
    costs:        { label: 'Costs & Estimates', order: 4, colorClass: 'cat-costs',       icon: 'C' },
    admin:        { label: 'Admin',            order: 5, colorClass: 'cat-admin',        icon: 'A' }
  };

  var MODULE_CATEGORY = {
    dashboard: 'general',
    my_work: 'general',
    messages: 'general',
    arturito: 'general',
    vault: 'general',
    operation_manager: 'coordination',
    pipeline: 'coordination',
    expenses: 'bookkeeping',
    company_expenses: 'bookkeeping',
    budget_monitor: 'bookkeeping',
    accounts: 'bookkeeping',
    vendors: 'bookkeeping',
    reporting: 'bookkeeping',
    projects: 'architecture',
    project_builder: 'architecture',
    timeline_manager: 'architecture',
    estimator: 'costs',
    estimator_database: 'costs',
    allowance_adu_calculator: 'costs',
    team: 'admin',
    companies: 'admin',
    roles: 'admin',
    arturito_settings: 'admin',
    settings: 'admin',
    audit: 'admin',
    process_manager: 'admin'
  };

  // ================================
  // STATE
  // ================================

  var roles = [];
  var modules = [];
  var allPermissions = {};   // { rol_id: { module_key: { can_view, can_edit, can_delete } } }
  var editState = {};        // Working copy for the current role
  var originalState = {};    // Snapshot when entering detail view
  var currentRoleId = null;
  var moduleFilter = '';
  var viewTransitioning = false;

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    try {
      await loadData();
      renderHubView();
      setupEventListeners();
      hidePageLoading();
    } catch (err) {
      console.error('[ROLES] Init error:', err);
      hidePageLoading();
    }
  }

  // ================================
  // DATA LOADING
  // ================================

  async function loadData() {
    showLoadingState();

    var rolesRes, modulesRes;
    try {
      var results = await Promise.all([
        fetch(API_BASE + '/permissions/roles'),
        fetch(API_BASE + '/permissions/modules')
      ]);
      rolesRes = results[0];
      modulesRes = results[1];
    } catch (err) {
      if (window.Toast) Toast.error('Load Failed', 'Could not connect to server.');
      throw err;
    }

    if (!rolesRes.ok || !modulesRes.ok) {
      if (window.Toast) Toast.error('Load Failed', 'Error loading roles data.');
      throw new Error('Failed to fetch roles/modules');
    }

    var rolesData = await rolesRes.json();
    var modulesData = await modulesRes.json();
    roles = rolesData.data || [];
    modules = modulesData.data || [];

    // Load permissions for ALL roles in parallel
    var permPromises = roles.map(function (role) {
      return fetch(API_BASE + '/permissions/role/' + role.rol_id)
        .then(function (r) { return r.json(); })
        .then(function (data) { return { rolId: role.rol_id, perms: data.permissions || [] }; })
        .catch(function () { return { rolId: role.rol_id, perms: [] }; });
    });

    var permResults = await Promise.all(permPromises);

    allPermissions = {};
    permResults.forEach(function (item) {
      var map = {};
      item.perms.forEach(function (p) {
        map[p.module_key] = {
          can_view: p.can_view,
          can_edit: p.can_edit,
          can_delete: p.can_delete
        };
      });
      allPermissions[item.rolId] = map;
    });

    showContent();
  }

  // ================================
  // VIEW SWITCHING
  // ================================

  function animateViewSwitch(outId, inId, onAfter) {
    if (viewTransitioning) return;
    viewTransitioning = true;

    var outEl = document.getElementById(outId);
    var inEl = document.getElementById(inId);
    var container = document.getElementById('rolesContent');
    if (container) container.scrollTop = 0;

    outEl.classList.add('view-leaving');
    outEl.addEventListener('animationend', function handler() {
      outEl.removeEventListener('animationend', handler);
      outEl.classList.remove('view-leaving');
      outEl.style.display = 'none';

      inEl.style.display = '';
      inEl.classList.add('view-entering');
      inEl.addEventListener('animationend', function h2() {
        inEl.removeEventListener('animationend', h2);
        inEl.classList.remove('view-entering');
        viewTransitioning = false;
      });

      if (onAfter) onAfter();
    });
  }

  function showHub() {
    if (currentRoleId && countChanges() > 0) {
      if (!confirm('You have unsaved changes. Discard and go back?')) return;
    }
    animateViewSwitch('detailView', 'hubView', function () {
      currentRoleId = null;
      editState = {};
      originalState = {};
      moduleFilter = '';
      var filterInput = document.getElementById('moduleFilterInput');
      if (filterInput) filterInput.value = '';
      renderHubView();
    });
  }

  function showDetail(rolId) {
    currentRoleId = rolId;
    editState = JSON.parse(JSON.stringify(allPermissions[rolId] || {}));
    originalState = JSON.parse(JSON.stringify(editState));
    moduleFilter = '';

    animateViewSwitch('hubView', 'detailView', function () {
      renderDetailHeader(rolId);
      renderPermissionCategories(rolId);
      updateSaveFooter();
      var filterInput = document.getElementById('moduleFilterInput');
      if (filterInput) filterInput.value = '';
    });
  }

  // ================================
  // HUB VIEW
  // ================================

  function renderHubView() {
    var hubView = document.getElementById('hubView');
    if (!hubView) return;

    var totalRoles = roles.length;
    var protectedCount = roles.filter(function (r) { return PROTECTED_ROLES.indexOf(r.rol_name) !== -1; }).length;
    var totalModules = modules.length;

    var html = '<div class="roles-hub-header">' +
      '<h2>Roles & Permissions</h2>' +
      '<p>Select a role to configure its module access</p>' +
    '</div>';

    // Stats row
    html += '<div class="roles-stats-row">' +
      statCard('Total Roles', totalRoles, '') +
      statCard('Protected', protectedCount, 'stat-disabled') +
      statCard('Editable', totalRoles - protectedCount, 'stat-enabled') +
      statCard('Modules', totalModules, '') +
    '</div>';

    // Role cards grid
    html += '<div class="roles-hub-grid">';
    roles.forEach(function (role) {
      html += renderRoleCard(role);
    });
    html += '</div>';

    hubView.innerHTML = html;
  }

  function statCard(label, value, cls) {
    return '<div class="roles-stat-card">' +
      '<span class="roles-stat-label">' + label + '</span>' +
      '<span class="roles-stat-value ' + cls + '">' + value + '</span>' +
    '</div>';
  }

  function renderRoleCard(role) {
    var isProtected = PROTECTED_ROLES.indexOf(role.rol_name) !== -1;
    var perms = allPermissions[role.rol_id] || {};
    var viewCount = 0, editCount = 0, deleteCount = 0;

    var keys = Object.keys(perms);
    keys.forEach(function (key) {
      if (perms[key].can_view) viewCount++;
      if (perms[key].can_edit) editCount++;
      if (perms[key].can_delete) deleteCount++;
    });

    var hue = hashStringToHue(role.rol_name);
    var initials = role.rol_name.substring(0, 2).toUpperCase();
    var badge = isProtected
      ? '<span class="role-protected-badge">Protected</span>'
      : '<span class="roles-status-dot"></span>';
    var cta = isProtected ? 'View permissions' : 'Configure';

    return '<div class="roles-hub-card" data-role-id="' + role.rol_id + '" tabindex="0">' +
      '<div class="roles-hub-card-top">' +
        '<div class="role-avatar" style="background:hsl(' + hue + ',55%,40%)">' + initials + '</div>' +
        '<div class="roles-hub-card-identity">' +
          '<h3 class="roles-hub-card-name">' + escapeHtml(role.rol_name) + '</h3>' +
          '<p class="roles-hub-card-role">' + keys.length + ' modules configured</p>' +
        '</div>' +
        badge +
      '</div>' +
      '<div class="roles-hub-card-metrics">' +
        '<div class="roles-hub-metric"><span class="roles-hub-metric-value metric-success">' + viewCount + '</span><span class="roles-hub-metric-label">Can View</span></div>' +
        '<div class="roles-hub-metric"><span class="roles-hub-metric-value">' + editCount + '</span><span class="roles-hub-metric-label">Can Edit</span></div>' +
        '<div class="roles-hub-metric"><span class="roles-hub-metric-value">' + deleteCount + '</span><span class="roles-hub-metric-label">Can Delete</span></div>' +
      '</div>' +
      '<div class="roles-hub-card-footer"><span class="roles-hub-card-cta">' + cta + ' &rarr;</span></div>' +
    '</div>';
  }

  // ================================
  // DETAIL VIEW
  // ================================

  function renderDetailHeader(rolId) {
    var role = roles.find(function (r) { return r.rol_id === rolId; });
    if (!role) return;

    var isProtected = PROTECTED_ROLES.indexOf(role.rol_name) !== -1;
    var hue = hashStringToHue(role.rol_name);
    var initials = role.rol_name.substring(0, 2).toUpperCase();

    var header = document.getElementById('roleDetailHeader');
    header.innerHTML =
      '<div class="role-avatar role-avatar-lg" style="background:hsl(' + hue + ',55%,40%)">' + initials + '</div>' +
      '<div class="roles-detail-header-info">' +
        '<h3 class="roles-detail-name">' + escapeHtml(role.rol_name) + '</h3>' +
        '<p class="roles-detail-subtitle">' + (isProtected ? 'Protected role - Read only' : 'Configure module permissions') + '</p>' +
      '</div>' +
      (isProtected ? '<span class="role-protected-badge">Protected</span>' : '');

    var detailView = document.getElementById('detailView');
    if (isProtected) {
      detailView.classList.add('role-readonly');
    } else {
      detailView.classList.remove('role-readonly');
    }
  }

  function renderPermissionCategories(rolId) {
    var container = document.getElementById('permissionCategories');
    if (!container) return;

    var role = roles.find(function (r) { return r.rol_id === rolId; });
    var isProtected = role ? PROTECTED_ROLES.indexOf(role.rol_name) !== -1 : false;

    // Group modules by category
    var grouped = {};
    modules.forEach(function (mod) {
      var cat = MODULE_CATEGORY[mod.module_key] || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(mod);
    });

    // Sort categories by order
    var sortedCats = Object.keys(grouped).sort(function (a, b) {
      return (CATEGORIES[a] || { order: 99 }).order - (CATEGORIES[b] || { order: 99 }).order;
    });

    var html = '';
    var filterLower = moduleFilter.toLowerCase();

    sortedCats.forEach(function (cat) {
      var catConfig = CATEGORIES[cat] || { label: cat, colorClass: 'cat-general', icon: '?' };
      var catModules = grouped[cat];

      // Apply module filter
      if (filterLower) {
        catModules = catModules.filter(function (m) {
          return m.module_name.toLowerCase().indexOf(filterLower) !== -1 ||
                 m.module_key.toLowerCase().indexOf(filterLower) !== -1;
        });
      }
      if (catModules.length === 0) return;

      html += '<div class="roles-perm-card">' +
        '<div class="roles-perm-card-header">' +
          '<h4 class="roles-perm-card-title">' +
            '<span class="roles-category-icon ' + catConfig.colorClass + '">' + catConfig.icon + '</span>' +
            catConfig.label +
            '<span class="roles-perm-card-count">' + catModules.length + ' modules</span>' +
          '</h4>' +
          (!isProtected ?
            '<div class="category-bulk-actions">' +
              '<button class="bulk-toggle-btn" data-category="' + cat + '" data-action="all">Enable All</button>' +
              '<button class="bulk-toggle-btn" data-category="' + cat + '" data-action="none">Disable All</button>' +
            '</div>' : '') +
        '</div>' +
        '<div class="roles-perm-list">';

      catModules.forEach(function (mod) {
        var perm = editState[mod.module_key] || { can_view: false, can_edit: false, can_delete: false };
        html += renderModuleRow(mod, perm, isProtected, rolId);
      });

      html += '</div></div>';
    });

    container.innerHTML = html || '<div class="roles-empty-state">No modules match your filter.</div>';
  }

  function renderModuleRow(mod, perm, isProtected, rolId) {
    var disabled = isProtected ? ' disabled' : '';
    return '<div class="roles-perm-item" data-module="' + mod.module_key + '">' +
      '<div class="roles-perm-info">' +
        '<span class="roles-perm-name">' + escapeHtml(mod.module_name) + '</span>' +
        '<span class="roles-perm-desc">' + mod.module_key + '</span>' +
      '</div>' +
      '<div class="roles-perm-toggles">' +
        toggleGroup('View', rolId, mod.module_key, 'view', perm.can_view, disabled) +
        toggleGroup('Edit', rolId, mod.module_key, 'edit', perm.can_edit, disabled) +
        toggleGroup('Delete', rolId, mod.module_key, 'delete', perm.can_delete, disabled) +
      '</div>' +
    '</div>';
  }

  function toggleGroup(label, rolId, moduleKey, permType, checked, disabled) {
    return '<div class="roles-toggle-group">' +
      '<span class="roles-toggle-label">' + label + '</span>' +
      '<label class="roles-toggle-switch">' +
        '<input type="checkbox" data-role="' + rolId + '" data-module="' + moduleKey + '" data-perm="' + permType + '"' +
        (checked ? ' checked' : '') + disabled + '>' +
        '<span class="roles-toggle-slider"></span>' +
      '</label>' +
    '</div>';
  }

  // ================================
  // TOGGLE LOGIC
  // ================================

  function handleToggleChange(e) {
    var input = e.target;
    if (!input.matches || !input.matches('.roles-toggle-switch input[type="checkbox"]')) return;

    var moduleKey = input.getAttribute('data-module');
    var permType = input.getAttribute('data-perm');
    var checked = input.checked;

    if (!editState[moduleKey]) {
      editState[moduleKey] = { can_view: false, can_edit: false, can_delete: false };
    }

    var perm = editState[moduleKey];

    // Cascading logic
    if (permType === 'view') {
      perm.can_view = checked;
      if (!checked) {
        perm.can_edit = false;
        perm.can_delete = false;
      }
    } else if (permType === 'edit') {
      perm.can_edit = checked;
      if (checked) perm.can_view = true;
    } else if (permType === 'delete') {
      perm.can_delete = checked;
      if (checked) {
        perm.can_view = true;
        perm.can_edit = true;
      }
    }

    // Update only the sibling toggles in this row (O(1), not full re-render)
    var row = input.closest('.roles-perm-item');
    if (row) {
      var toggles = row.querySelectorAll('.roles-toggle-switch input');
      toggles.forEach(function (t) {
        var p = t.getAttribute('data-perm');
        if (p === 'view') t.checked = perm.can_view;
        if (p === 'edit') t.checked = perm.can_edit;
        if (p === 'delete') t.checked = perm.can_delete;
      });
    }

    updateSaveFooter();
  }

  // ================================
  // BULK TOGGLE
  // ================================

  function handleBulkToggle(category, action) {
    var enable = action === 'all';

    modules.forEach(function (mod) {
      if (MODULE_CATEGORY[mod.module_key] !== category) return;

      if (!editState[mod.module_key]) {
        editState[mod.module_key] = { can_view: false, can_edit: false, can_delete: false };
      }

      editState[mod.module_key].can_view = enable;
      editState[mod.module_key].can_edit = enable;
      editState[mod.module_key].can_delete = enable;
    });

    renderPermissionCategories(currentRoleId);
    updateSaveFooter();
  }

  // ================================
  // CHANGES TRACKING
  // ================================

  function countChanges() {
    var count = 0;
    var allKeys = {};

    var key;
    for (key in editState) allKeys[key] = true;
    for (key in originalState) allKeys[key] = true;

    for (key in allKeys) {
      var orig = originalState[key] || { can_view: false, can_edit: false, can_delete: false };
      var curr = editState[key] || { can_view: false, can_edit: false, can_delete: false };
      if (orig.can_view !== curr.can_view ||
          orig.can_edit !== curr.can_edit ||
          orig.can_delete !== curr.can_delete) {
        count++;
      }
    }
    return count;
  }

  function updateSaveFooter() {
    var changes = countChanges();
    var footer = document.getElementById('roleSaveFooter');
    var counter = document.getElementById('changesCounter');
    if (!footer || !counter) return;

    if (changes > 0) {
      footer.style.display = '';
      counter.textContent = changes + (changes === 1 ? ' change' : ' changes');
    } else {
      footer.style.display = 'none';
    }
  }

  // ================================
  // SAVE
  // ================================

  async function saveChanges() {
    var updates = [];

    for (var moduleKey in editState) {
      var orig = originalState[moduleKey] || { can_view: false, can_edit: false, can_delete: false };
      var curr = editState[moduleKey];

      if (orig.can_view !== curr.can_view ||
          orig.can_edit !== curr.can_edit ||
          orig.can_delete !== curr.can_delete) {
        updates.push({
          rol_id: currentRoleId,
          module_key: moduleKey,
          can_view: curr.can_view,
          can_edit: curr.can_edit,
          can_delete: curr.can_delete
        });
      }
    }

    if (updates.length === 0) {
      if (window.Toast) Toast.info('No Changes', 'Nothing to save.');
      return;
    }

    var saveBtn = document.getElementById('btnSavePermissions');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      var res = await fetch(API_BASE + '/permissions/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: updates })
      });

      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.detail || 'Server error');
      }

      var result = await res.json();

      // Success feedback
      var message = result.successful_updates + ' permission(s) updated.';
      if (result.protected_blocked > 0) {
        message += ' ' + result.protected_blocked + ' protected role(s) skipped.';
      }
      if (result.failed_updates > 0) {
        if (window.Toast) Toast.warning('Partial Success', message);
      } else {
        if (window.Toast) Toast.success('Saved', message);
      }

      // Update master state
      allPermissions[currentRoleId] = JSON.parse(JSON.stringify(editState));
      originalState = JSON.parse(JSON.stringify(editState));
      updateSaveFooter();

      // Invalidate sidebar cache so navigation reflects changes
      if (window.reloadSidebarPermissions) {
        window.reloadSidebarPermissions();
      }

    } catch (err) {
      console.error('[ROLES] Save error:', err);
      if (window.Toast) Toast.error('Save Failed', err.message || 'Could not save changes.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  }

  // ================================
  // EVENT LISTENERS
  // ================================

  function setupEventListeners() {
    var hubView = document.getElementById('hubView');
    var detailView = document.getElementById('detailView');
    var permCats = document.getElementById('permissionCategories');
    var filterInput = document.getElementById('moduleFilterInput');
    var btnBack = document.getElementById('btnBackToHub');
    var btnSave = document.getElementById('btnSavePermissions');
    var btnDiscard = document.getElementById('btnDiscardChanges');

    // Hub card clicks
    if (hubView) {
      hubView.addEventListener('click', function (e) {
        var card = e.target.closest('.roles-hub-card');
        if (card) showDetail(card.getAttribute('data-role-id'));
      });

      // Keyboard accessibility
      hubView.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          var card = e.target.closest('.roles-hub-card');
          if (card) {
            e.preventDefault();
            showDetail(card.getAttribute('data-role-id'));
          }
        }
      });
    }

    // Back button
    if (btnBack) btnBack.addEventListener('click', showHub);

    // Toggle changes
    if (permCats) {
      permCats.addEventListener('change', handleToggleChange);

      // Bulk actions
      permCats.addEventListener('click', function (e) {
        var btn = e.target.closest('.bulk-toggle-btn');
        if (!btn) return;
        handleBulkToggle(btn.getAttribute('data-category'), btn.getAttribute('data-action'));
      });
    }

    // Module search filter
    if (filterInput) {
      var filterTimer = null;
      filterInput.addEventListener('input', function (e) {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(function () {
          moduleFilter = e.target.value.trim();
          renderPermissionCategories(currentRoleId);
        }, 200);
      });
    }

    // Save button
    if (btnSave) btnSave.addEventListener('click', saveChanges);

    // Discard button
    if (btnDiscard) {
      btnDiscard.addEventListener('click', function () {
        editState = JSON.parse(JSON.stringify(originalState));
        renderPermissionCategories(currentRoleId);
        updateSaveFooter();
        if (window.Toast) Toast.info('Discarded', 'Changes have been reverted.');
      });
    }
  }

  // ================================
  // UTILITIES
  // ================================

  function hashStringToHue(str) {
    if (!str) return 0;
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 360);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showLoadingState() {
    var el = document.getElementById('rolesLoadingState');
    var content = document.getElementById('rolesContent');
    if (el) el.style.display = 'flex';
    if (content) content.style.display = 'none';
  }

  function showContent() {
    var el = document.getElementById('rolesLoadingState');
    var content = document.getElementById('rolesContent');
    if (el) el.style.display = 'none';
    if (content) content.style.display = '';
  }

  function hidePageLoading() {
    var overlay = document.getElementById('pageLoadingOverlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.classList.remove('page-loading');
  }

  // ================================
  // BOOT
  // ================================

  window.addEventListener('DOMContentLoaded', function () {
    if (window.initTopbarPills) window.initTopbarPills();
    init();
  });

})();
