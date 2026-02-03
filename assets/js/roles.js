// ================================
// ROLES MANAGEMENT
// Sistema de gestión de permisos por rol
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Estado
  let roles = [];
  let modules = [];
  let permissions = {}; // { rol_id: { module_key: {can_view, can_edit, can_delete} } }
  let originalPermissions = {}; // Para detectar cambios
  let isEditMode = false;

  // Filtros
  let moduleFilter = '';
  let roleFilter = '';

  // Roles protegidos que no se pueden modificar
  const PROTECTED_ROLES = ['CEO', 'COO'];

  // DOM Elements
  const els = {
    loadingState: document.getElementById('rolesLoadingState'),
    content: document.getElementById('rolesContent'),
    permissionsTable: document.getElementById('permissionsTable'),
    permissionsTableBody: document.getElementById('permissionsTableBody'),
    btnEditPermissions: document.getElementById('btnEditPermissions'),
    btnCancelEdit: document.getElementById('btnCancelEdit'),
    btnSaveChanges: document.getElementById('btnSaveChanges'),
    editModeFooter: document.getElementById('editModeFooter'),
    moduleSearchInput: document.getElementById('moduleSearchInput'),
    roleSearchInput: document.getElementById('roleSearchInput'),
    btnClearFilters: document.getElementById('btnClearFilters'),
    filterStats: document.getElementById('filterStats')
  };

  // ================================
  // INITIALIZATION
  // ================================

  async function init() {
    await loadData();
    setupEventListeners();
    // Iniciar en modo de edición por defecto
    toggleEditMode(true);
  }

  // ================================
  // LOAD DATA
  // ================================

  async function loadData() {
    try {
      showLoadingState();

      // Cargar roles y módulos en paralelo
      const [rolesRes, modulesRes] = await Promise.all([
        fetch(`${API_BASE}/permissions/roles`),
        fetch(`${API_BASE}/permissions/modules`)
      ]);

      if (!rolesRes.ok || !modulesRes.ok) {
        console.error('[ROLES] Error loading data');
        if (window.Toast) {
          Toast.error('Load Failed', 'Error loading roles and modules.');
        }
        return;
      }

      const rolesData = await rolesRes.json();
      const modulesData = await modulesRes.json();

      roles = rolesData.data || [];
      modules = modulesData.data || [];

      // Cargar permisos para cada rol
      await loadAllPermissions();

      renderPermissionsMatrix();
      showContent();

    } catch (err) {
      console.error('[ROLES] Error loading data:', err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Error loading data.', { details: err.message });
      }
    }
  }

  async function loadAllPermissions() {
    permissions = {};

    for (const role of roles) {
      try {
        const res = await fetch(`${API_BASE}/permissions/role/${role.rol_id}`);
        if (!res.ok) continue;

        const data = await res.json();
        const rolePerms = {};

        // Organizar permisos por module_key
        (data.permissions || []).forEach(perm => {
          rolePerms[perm.module_key] = {
            can_view: perm.can_view,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          };
        });

        permissions[role.rol_id] = rolePerms;
      } catch (err) {
        console.error(`[ROLES] Error loading permissions for role ${role.rol_id}:`, err);
      }
    }

    // Guardar copia para detectar cambios
    originalPermissions = JSON.parse(JSON.stringify(permissions));
  }

  // ================================
  // RENDER
  // ================================

  function renderPermissionsMatrix() {
    if (!roles || roles.length === 0 || !modules || modules.length === 0) {
      els.permissionsTableBody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px; color: #6b7280;">No data available</td></tr>';
      updateFilterStats(0, 0, 0, 0);
      return;
    }

    // Filtrar modulos y roles
    const filteredModules = modules.filter(mod =>
      mod.module_name.toLowerCase().includes(moduleFilter.toLowerCase()) ||
      mod.module_key.toLowerCase().includes(moduleFilter.toLowerCase())
    );

    const filteredRoles = roles.filter(role =>
      role.rol_name.toLowerCase().includes(roleFilter.toLowerCase())
    );

    // Actualizar estadisticas de filtrado
    updateFilterStats(filteredModules.length, modules.length, filteredRoles.length, roles.length);

    // Verificar si hay resultados
    if (filteredModules.length === 0 || filteredRoles.length === 0) {
      const thead = els.permissionsTable.querySelector('thead');
      thead.innerHTML = '<tr><th>Role</th><th>No matching modules</th></tr>';
      els.permissionsTableBody.innerHTML = '<tr><td colspan="100" style="text-align: center; padding: 40px; color: #6b7280;">No results match your filters. Try adjusting your search.</td></tr>';
      return;
    }

    // Crear header dinámico con los módulos filtrados
    const thead = els.permissionsTable.querySelector('thead');
    thead.innerHTML = `
      <tr>
        <th style="position: sticky; left: 0; background: #18181b; z-index: 2; min-width: 180px;">Role</th>
        ${filteredModules.map(mod => `
          <th style="min-width: 140px; text-align: center;">
            <div style="font-size: 13px; font-weight: 600;">${mod.module_name}</div>
            <div style="font-size: 11px; font-weight: 400; color: #6b7280; margin-top: 2px;">V · E · D</div>
          </th>
        `).join('')}
        <th style="min-width: 100px; text-align: center;">Actions</th>
      </tr>
    `;

    // Renderizar filas de roles filtrados
    els.permissionsTableBody.innerHTML = filteredRoles.map(role => {
      const isProtected = PROTECTED_ROLES.includes(role.rol_name);
      const rolePerms = permissions[role.rol_id] || {};

      return `
        <tr data-role-id="${role.rol_id}" data-role-name="${role.rol_name}">
          <td style="position: sticky; left: 0; background: #18181b; z-index: 1;">
            <strong style="color: #e5e7eb;">${role.rol_name}</strong>
          </td>
          ${filteredModules.map(mod => {
            const perm = rolePerms[mod.module_key] || { can_view: false, can_edit: false, can_delete: false };
            return renderPermissionCell(role.rol_id, mod.module_key, perm, isProtected);
          }).join('')}
          <td style="text-align: center;">
            ${!isProtected && isEditMode ? `
              <button class="btn-reset-role" data-role-id="${role.rol_id}" style="padding: 4px 12px; background: transparent; border: 1px solid #27272f; color: #9ca3af; border-radius: 4px; font-size: 12px; cursor: pointer;">
                Reset
              </button>
            ` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function updateFilterStats(modsShown, modsTotal, rolesShown, rolesTotal) {
    if (els.filterStats) {
      const hasFilter = moduleFilter || roleFilter;
      if (hasFilter) {
        els.filterStats.textContent = `Showing ${modsShown} of ${modsTotal} modules, ${rolesShown} of ${rolesTotal} roles`;
      } else {
        els.filterStats.textContent = `${modsTotal} modules, ${rolesTotal} roles`;
      }
    }
  }

  function renderPermissionCell(rolId, moduleKey, perm, isProtected) {
    const disabled = isProtected || !isEditMode;
    const disabledAttr = disabled ? 'disabled' : '';
    const opacity = disabled ? 'opacity: 0.5;' : '';

    return `
      <td style="text-align: center;">
        <div style="display: flex; justify-content: center; gap: 8px; ${opacity}">
          <label style="cursor: ${disabled ? 'not-allowed' : 'pointer'}; display: flex; flex-direction: column; align-items: center;">
            <input
              type="checkbox"
              class="perm-checkbox"
              data-role-id="${rolId}"
              data-module-key="${moduleKey}"
              data-permission="view"
              ${perm.can_view ? 'checked' : ''}
              ${disabledAttr}
              style="cursor: ${disabled ? 'not-allowed' : 'pointer'};"
            />
          </label>
          <label style="cursor: ${disabled ? 'not-allowed' : 'pointer'}; display: flex; flex-direction: column; align-items: center;">
            <input
              type="checkbox"
              class="perm-checkbox"
              data-role-id="${rolId}"
              data-module-key="${moduleKey}"
              data-permission="edit"
              ${perm.can_edit ? 'checked' : ''}
              ${disabledAttr}
              style="cursor: ${disabled ? 'not-allowed' : 'pointer'};"
            />
          </label>
          <label style="cursor: ${disabled ? 'not-allowed' : 'pointer'}; display: flex; flex-direction: column; align-items: center;">
            <input
              type="checkbox"
              class="perm-checkbox"
              data-role-id="${rolId}"
              data-module-key="${moduleKey}"
              data-permission="delete"
              ${perm.can_delete ? 'checked' : ''}
              ${disabledAttr}
              style="cursor: ${disabled ? 'not-allowed' : 'pointer'};"
            />
          </label>
        </div>
      </td>
    `;
  }

  // ================================
  // EDIT MODE
  // ================================

  function toggleEditMode(enable) {
    isEditMode = enable;

    if (enable) {
      els.btnEditPermissions.style.display = 'none';
      els.editModeFooter.classList.remove('hidden');
    } else {
      els.btnEditPermissions.style.display = '';
      els.editModeFooter.classList.add('hidden');
      // Restaurar permisos originales
      permissions = JSON.parse(JSON.stringify(originalPermissions));
    }

    renderPermissionsMatrix();
  }

  // ================================
  // SAVE CHANGES
  // ================================

  async function saveChanges() {
    try {
      // Detectar cambios
      const updates = [];

      for (const rolId in permissions) {
        const original = originalPermissions[rolId] || {};
        const current = permissions[rolId] || {};

        for (const moduleKey in current) {
          const origPerm = original[moduleKey] || {};
          const currPerm = current[moduleKey] || {};

          // Verificar si cambió
          if (JSON.stringify(origPerm) !== JSON.stringify(currPerm)) {
            updates.push({
              rol_id: rolId,
              module_key: moduleKey,
              can_view: currPerm.can_view,
              can_edit: currPerm.can_edit,
              can_delete: currPerm.can_delete
            });
          }
        }
      }

      if (updates.length === 0) {
        if (window.Toast) {
          Toast.info('No Changes', 'No changes to save.');
        }
        toggleEditMode(false);
        return;
      }

      // Confirmar cambios
      const confirmMsg = `You are about to update ${updates.length} permission(s). Continue?`;
      if (!confirm(confirmMsg)) return;

      // Enviar actualizaciones al backend
      console.log('[ROLES] Saving changes:', updates);

      const res = await fetch(`${API_BASE}/permissions/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update permissions');
      }

      const result = await res.json();

      // Mostrar resultado
      if (window.Toast) {
        let message = `${result.successful_updates} permission(s) updated!`;
        if (result.protected_blocked > 0) {
          message += ` ${result.protected_blocked} protected role(s) skipped.`;
        }
        if (result.failed_updates > 0) {
          Toast.warning('Partial Success', message + ` ${result.failed_updates} update(s) failed.`);
        } else {
          Toast.success('Changes Saved', message);
        }
      }

      // Recargar datos
      await loadData();
      toggleEditMode(false);

    } catch (err) {
      console.error('[ROLES] Error saving changes:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving changes.', { details: err.message });
      }
    }
  }

  // ================================
  // HANDLE CHECKBOX CHANGES
  // ================================

  function handleCheckboxChange(e) {
    if (!isEditMode) return;

    const checkbox = e.target;
    const rolId = checkbox.getAttribute('data-role-id');
    const moduleKey = checkbox.getAttribute('data-module-key');
    const permission = checkbox.getAttribute('data-permission');

    if (!permissions[rolId]) permissions[rolId] = {};
    if (!permissions[rolId][moduleKey]) {
      permissions[rolId][moduleKey] = { can_view: false, can_edit: false, can_delete: false };
    }

    // Actualizar el permiso
    if (permission === 'view') {
      permissions[rolId][moduleKey].can_view = checkbox.checked;

      // Si se desmarca view, desmarcar edit y delete también
      if (!checkbox.checked) {
        permissions[rolId][moduleKey].can_edit = false;
        permissions[rolId][moduleKey].can_delete = false;
      }
    } else if (permission === 'edit') {
      permissions[rolId][moduleKey].can_edit = checkbox.checked;

      // Si se marca edit, marcar view automáticamente
      if (checkbox.checked) {
        permissions[rolId][moduleKey].can_view = true;
      }
    } else if (permission === 'delete') {
      permissions[rolId][moduleKey].can_delete = checkbox.checked;

      // Si se marca delete, marcar view y edit automáticamente
      if (checkbox.checked) {
        permissions[rolId][moduleKey].can_view = true;
        permissions[rolId][moduleKey].can_edit = true;
      }
    }

    // Re-renderizar solo esa celda para actualizar checkboxes dependientes
    renderPermissionsMatrix();
  }

  // ================================
  // RESET ROLE
  // ================================

  function resetRole(rolId) {
    if (!confirm('Reset all permissions for this role to original values?')) return;

    permissions[rolId] = JSON.parse(JSON.stringify(originalPermissions[rolId] || {}));
    renderPermissionsMatrix();
  }

  // ================================
  // UI HELPERS
  // ================================

  function showLoadingState() {
    els.loadingState.style.display = 'flex';
    els.content.style.display = 'none';
  }

  function showContent() {
    els.loadingState.style.display = 'none';
    els.content.style.display = 'block';
  }

  // ================================
  // EVENT LISTENERS
  // ================================

  function setupEventListeners() {
    // Edit mode
    els.btnEditPermissions?.addEventListener('click', () => {
      toggleEditMode(true);
    });

    els.btnCancelEdit?.addEventListener('click', () => {
      if (confirm('Discard all changes?')) {
        toggleEditMode(false);
      }
    });

    els.btnSaveChanges?.addEventListener('click', () => {
      saveChanges();
    });

    // Checkbox changes (delegación de eventos)
    els.permissionsTableBody?.addEventListener('change', (e) => {
      if (e.target.classList.contains('perm-checkbox')) {
        handleCheckboxChange(e);
      }
    });

    // Reset role button (delegación)
    els.permissionsTableBody?.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-reset-role')) {
        const rolId = e.target.getAttribute('data-role-id');
        resetRole(rolId);
      }
    });

    // Filtros de busqueda
    let filterDebounce = null;

    els.moduleSearchInput?.addEventListener('input', (e) => {
      clearTimeout(filterDebounce);
      filterDebounce = setTimeout(() => {
        moduleFilter = e.target.value.trim();
        renderPermissionsMatrix();
      }, 200);
    });

    els.roleSearchInput?.addEventListener('input', (e) => {
      clearTimeout(filterDebounce);
      filterDebounce = setTimeout(() => {
        roleFilter = e.target.value.trim();
        renderPermissionsMatrix();
      }, 200);
    });

    els.btnClearFilters?.addEventListener('click', () => {
      moduleFilter = '';
      roleFilter = '';
      if (els.moduleSearchInput) els.moduleSearchInput.value = '';
      if (els.roleSearchInput) els.roleSearchInput.value = '';
      renderPermissionsMatrix();
    });
  }

  // ================================
  // START
  // ================================

  window.addEventListener('DOMContentLoaded', () => {
    if (window.initTopbarPills) window.initTopbarPills();
    init();
  });

})();
