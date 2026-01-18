// ================================
// PERMISSIONS MANAGER
// Maneja permisos basados en roles desde la base de datos
// ================================

(function() {
  'use strict';

  const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

  // Cache de permisos del usuario actual
  let userPermissions = null;
  let userRoleId = null;

  // ================================
  // CARGAR PERMISOS DEL USUARIO
  // ================================

  async function loadUserPermissions(userId) {
    try {
      const res = await fetch(`${API_BASE}/permissions/user/${userId}`);
      if (!res.ok) {
        console.error('[PERMISSIONS] Error loading user permissions');
        return null;
      }

      const data = await res.json();
      userPermissions = data.permissions || [];
      userRoleId = data.rol_id;

      console.log('[PERMISSIONS] User permissions loaded:', {
        userId,
        roleId: userRoleId,
        permissions: userPermissions
      });

      return data;
    } catch (err) {
      console.error('[PERMISSIONS] Network error:', err);
      return null;
    }
  }

  // ================================
  // VERIFICAR PERMISOS
  // ================================

  function hasPermission(moduleKey, action = 'view') {
    if (!userPermissions || userPermissions.length === 0) {
      console.warn('[PERMISSIONS] No permissions loaded');
      return false;
    }

    const perm = userPermissions.find(p => p.module_key === moduleKey);
    if (!perm) {
      return false;
    }

    switch (action) {
      case 'view':
        return perm.can_view === true;
      case 'edit':
        return perm.can_edit === true;
      case 'delete':
        return perm.can_delete === true;
      default:
        return false;
    }
  }

  function canView(moduleKey) {
    return hasPermission(moduleKey, 'view');
  }

  function canEdit(moduleKey) {
    return hasPermission(moduleKey, 'edit');
  }

  function canDelete(moduleKey) {
    return hasPermission(moduleKey, 'delete');
  }

  // ================================
  // FILTRAR MÓDULOS VISIBLES
  // ================================

  function getVisibleModules() {
    if (!userPermissions || userPermissions.length === 0) {
      return [];
    }

    return userPermissions
      .filter(p => p.can_view === true)
      .map(p => ({
        key: p.module_key,
        name: p.module_name,
        url: p.module_url,
        canEdit: p.can_edit,
        canDelete: p.can_delete
      }));
  }

  // ================================
  // APLICAR PERMISOS AL DOM
  // ================================

  function applyPermissionsToDOM() {
    if (!userPermissions) {
      console.warn('[PERMISSIONS] Cannot apply permissions - not loaded');
      return;
    }

    // Ocultar cards de módulos en dashboard según permisos
    const moduleCards = document.querySelectorAll('.module-card[data-module]');
    moduleCards.forEach(card => {
      const moduleKey = card.getAttribute('data-module');
      if (!canView(moduleKey)) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
      }
    });

    // Ocultar enlaces de sidebar según permisos
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .nav-item[data-module]');
    sidebarLinks.forEach(link => {
      const moduleKey = link.getAttribute('data-module');
      if (!canView(moduleKey)) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });

    // Deshabilitar botones de edición si no tiene permiso
    const editButtons = document.querySelectorAll('[data-requires-edit]');
    editButtons.forEach(btn => {
      const moduleKey = btn.getAttribute('data-requires-edit');
      if (!canEdit(moduleKey)) {
        btn.disabled = true;
        btn.title = 'No tienes permisos para editar';
      }
    });

    // Deshabilitar botones de eliminación si no tiene permiso
    const deleteButtons = document.querySelectorAll('[data-requires-delete]');
    deleteButtons.forEach(btn => {
      const moduleKey = btn.getAttribute('data-requires-delete');
      if (!canDelete(moduleKey)) {
        btn.disabled = true;
        btn.title = 'No tienes permisos para eliminar';
      }
    });

    console.log('[PERMISSIONS] Permissions applied to DOM');
  }

  // ================================
  // INICIALIZAR PERMISOS
  // ================================

  async function initPermissions() {
    // Obtener userId del localStorage (asumiendo que se guarda en login)
    const userData = localStorage.getItem('user_data');
    if (!userData) {
      console.warn('[PERMISSIONS] No user data found in localStorage');
      return;
    }

    try {
      const user = JSON.parse(userData);
      const userId = user.user_id;

      if (!userId) {
        console.warn('[PERMISSIONS] No user_id found in user data');
        return;
      }

      await loadUserPermissions(userId);
      applyPermissionsToDOM();

      // Reaplica permisos cuando el DOM cambia (para contenido dinámico)
      if (window.MutationObserver) {
        const observer = new MutationObserver(() => {
          applyPermissionsToDOM();
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
    } catch (err) {
      console.error('[PERMISSIONS] Error parsing user data:', err);
    }
  }

  // ================================
  // EXPORTAR API PÚBLICA
  // ================================

  window.PermissionsManager = {
    init: initPermissions,
    load: loadUserPermissions,
    hasPermission,
    canView,
    canEdit,
    canDelete,
    getVisibleModules,
    apply: applyPermissionsToDOM,
    get permissions() {
      return userPermissions;
    },
    get roleId() {
      return userRoleId;
    }
  };

  // Auto-inicializar en DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPermissions);
  } else {
    initPermissions();
  }

})();
