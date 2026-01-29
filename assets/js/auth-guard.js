// assets/js/auth-guard.js
// Shared authentication guard for all protected pages
// Include this script BEFORE other scripts that require authentication

(function() {
  'use strict';

  // Pages that don't require authentication
  const PUBLIC_PAGES = ['login.html', 'index.html', ''];

  function getCurrentPage() {
    const path = window.location.pathname || '';
    const page = path.split('/').pop() || '';
    return page.toLowerCase();
  }

  function isPublicPage() {
    const currentPage = getCurrentPage();
    return PUBLIC_PAGES.some(p => currentPage === p || currentPage === p.replace('.html', ''));
  }

  function isTokenValid(token) {
    if (!token) return false;

    try {
      // Decode JWT payload (middle part)
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));

      // Check expiration
      if (payload.exp) {
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        // Token is expired
        if (now >= expirationTime) {
          console.log('[Auth Guard] Token expired');
          return false;
        }
      }

      return true;
    } catch (e) {
      console.warn('[Auth Guard] Invalid token format:', e);
      return false;
    }
  }

  function clearAuthData() {
    localStorage.removeItem('ngmToken');
    localStorage.removeItem('ngmUser');
    localStorage.removeItem('sidebar_permissions');
  }

  function redirectToLogin() {
    // Save current URL so user can return after login
    const currentUrl = window.location.href;
    const currentPage = getCurrentPage();

    // Don't save login.html as redirect target
    if (currentPage !== 'login.html') {
      // Save just the page name (works better for PWA)
      sessionStorage.setItem('loginRedirect', currentPage || 'dashboard.html');
    }

    console.log('[Auth Guard] Redirecting to login...');
    window.location.href = 'login.html';
  }

  // Main guard check
  function checkAuth() {
    // Skip check for public pages
    if (isPublicPage()) {
      return true;
    }

    const token = localStorage.getItem('ngmToken');

    if (!token) {
      console.log('[Auth Guard] No token found');
      redirectToLogin();
      return false;
    }

    if (!isTokenValid(token)) {
      console.log('[Auth Guard] Token invalid or expired');
      clearAuthData();
      redirectToLogin();
      return false;
    }

    console.log('[Auth Guard] Authentication valid');
    return true;
  }

  // Run immediately (before page loads)
  const isAuthenticated = checkAuth();

  // Expose for manual checks if needed
  window.authGuard = {
    isAuthenticated: () => isTokenValid(localStorage.getItem('ngmToken')),
    checkAuth: checkAuth,
    clearAuthData: clearAuthData,
    redirectToLogin: redirectToLogin
  };

  // If not authenticated, stop further script execution by throwing
  // This prevents flashing of protected content
  if (!isAuthenticated && !isPublicPage()) {
    // The redirect is already triggered, but we want to stop execution
    throw new Error('[Auth Guard] Unauthorized - redirecting to login');
  }
})();
