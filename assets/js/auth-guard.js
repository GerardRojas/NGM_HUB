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
    if (!token || typeof token !== 'string') return false;

    try {
      // Decode JWT payload (middle part)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[Auth Guard] Invalid token structure');
        return false;
      }

      const payload = JSON.parse(atob(parts[1]));

      // Check expiration
      if (payload.exp) {
        const expirationTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        // Token is expired
        if (now >= expirationTime) {
          console.log('[Auth Guard] Token expired at', new Date(expirationTime).toISOString());
          return false;
        }

        // Optional: Warn if token expires soon (within 5 minutes)
        const fiveMinutes = 5 * 60 * 1000;
        if (now + fiveMinutes >= expirationTime) {
          console.warn('[Auth Guard] Token expires soon:', new Date(expirationTime).toISOString());
        }
      } else {
        console.warn('[Auth Guard] Token has no expiration (exp) field');
        // Decide if tokens without exp are valid - for security, we'll consider them invalid
        return false;
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

  // Show the page content (remove visibility:hidden)
  function showPage() {
    // Use requestAnimationFrame to ensure DOM is ready
    if (document.body) {
      document.body.classList.add('auth-ready');
    } else {
      // If body not ready yet, wait for DOMContentLoaded
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('auth-ready');
      });
    }
  }

  // Main guard check
  function checkAuth() {
    // Skip check for public pages
    if (isPublicPage()) {
      showPage(); // Show public pages immediately
      return true;
    }

    const token = localStorage.getItem('ngmToken');
    const user = localStorage.getItem('ngmUser');

    // Check if token exists
    if (!token) {
      console.log('[Auth Guard] No token found');
      redirectToLogin();
      return false;
    }

    // Check if user data exists
    if (!user) {
      console.log('[Auth Guard] No user data found');
      clearAuthData();
      redirectToLogin();
      return false;
    }

    // Validate user data format
    try {
      const userData = JSON.parse(user);
      if (!userData.user_id || !userData.user_name) {
        console.warn('[Auth Guard] Invalid user data structure');
        clearAuthData();
        redirectToLogin();
        return false;
      }
    } catch (e) {
      console.warn('[Auth Guard] Failed to parse user data:', e);
      clearAuthData();
      redirectToLogin();
      return false;
    }

    // Validate token
    if (!isTokenValid(token)) {
      console.log('[Auth Guard] Token invalid or expired');
      clearAuthData();
      redirectToLogin();
      return false;
    }

    console.log('[Auth Guard] Authentication valid');
    showPage(); // Show protected pages only after auth check passes
    return true;
  }

  // Run immediately (before page loads)
  const isAuthenticated = checkAuth();

  // Periodic token validation (check every 60 seconds)
  // This catches token expiration during active use
  if (isAuthenticated && !isPublicPage()) {
    setInterval(function() {
      const token = localStorage.getItem('ngmToken');
      const user = localStorage.getItem('ngmUser');

      if (!token || !user || !isTokenValid(token)) {
        console.log('[Auth Guard] Session expired during use, redirecting to login...');
        clearAuthData();

        // Show a brief message before redirecting (optional)
        if (typeof showToast === 'function') {
          showToast('Your session has expired. Please log in again.', 'warning');
        }

        // Redirect after a brief delay to show the message
        setTimeout(function() {
          redirectToLogin();
        }, 1000);
      }
    }, 60000); // Check every 60 seconds
  }

  // Expose for manual checks if needed
  window.authGuard = {
    isAuthenticated: () => {
      const token = localStorage.getItem('ngmToken');
      const user = localStorage.getItem('ngmUser');
      return token && user && isTokenValid(token);
    },
    checkAuth: checkAuth,
    clearAuthData: clearAuthData,
    redirectToLogin: redirectToLogin,
    getToken: () => localStorage.getItem('ngmToken'),
    getUser: () => {
      try {
        const user = localStorage.getItem('ngmUser');
        return user ? JSON.parse(user) : null;
      } catch (e) {
        console.warn('[Auth Guard] Failed to parse user data:', e);
        return null;
      }
    }
  };

  // If not authenticated, stop further script execution by throwing
  // This prevents flashing of protected content
  if (!isAuthenticated && !isPublicPage()) {
    // The redirect is already triggered, but we want to stop execution
    throw new Error('[Auth Guard] Unauthorized - redirecting to login');
  }
})();
