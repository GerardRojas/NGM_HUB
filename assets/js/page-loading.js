// assets/js/page-loading.js
// Unified page loading overlay system
// Include this script in all pages that use the loading overlay

(function() {
  'use strict';

  // Configuration
  const MIN_LOADING_TIME = 800; // Minimum time to show loading overlay (ms)
  const PAGE_LOAD_START = Date.now();
  const AUTO_HIDE_DELAY = 300; // Extra delay after window.onload for auto-hide

  // Track state
  let hideRequested = false;
  let dataReady = false;
  let manualHideCalled = false;

  /**
   * Hide the page loading overlay
   * Ensures minimum display time for smooth UX
   * @param {boolean} isManual - Whether this was called manually by page JS
   */
  function hidePageLoading(isManual = true) {
    if (hideRequested) return; // Prevent multiple calls
    hideRequested = true;
    dataReady = true;
    if (isManual) manualHideCalled = true;

    const elapsed = Date.now() - PAGE_LOAD_START;
    const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

    setTimeout(() => {
      const overlay = document.getElementById('pageLoadingOverlay');
      if (overlay) {
        overlay.classList.add('hidden');
      }
      document.body.classList.remove('page-loading');
      document.body.classList.add('auth-ready');
    }, remaining);
  }

  /**
   * Show the loading overlay (for SPA-like navigation or refresh)
   */
  function showPageLoading() {
    hideRequested = false;
    dataReady = false;
    manualHideCalled = false;

    const overlay = document.getElementById('pageLoadingOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    document.body.classList.add('page-loading');
    document.body.classList.remove('auth-ready');
  }

  /**
   * Auto-hide: For pages without custom JS, hide after window.onload
   * This ensures all resources (CSS, images) are loaded before showing content
   */
  function setupAutoHide() {
    // Wait for window.onload (all resources loaded)
    window.addEventListener('load', () => {
      // Give page JS a chance to call hidePageLoading manually
      setTimeout(() => {
        if (!manualHideCalled && !dataReady) {
          console.log('[PageLoading] Auto-hiding overlay after page load');
          hidePageLoading(false);
        }
      }, AUTO_HIDE_DELAY);
    });

    // Fallback: Max 8 seconds in case something blocks window.onload
    setTimeout(() => {
      if (!dataReady) {
        console.warn('[PageLoading] Fallback triggered - hiding overlay after timeout');
        hidePageLoading(false);
      }
    }, 8000);
  }

  // Setup auto-hide
  setupAutoHide();

  // Expose globally
  window.pageLoading = {
    hide: hidePageLoading,
    show: showPageLoading,
    MIN_TIME: MIN_LOADING_TIME,
    getElapsed: () => Date.now() - PAGE_LOAD_START
  };

  // Also expose as standalone function for backwards compatibility
  window.hidePageLoading = hidePageLoading;
  window.showPageLoading = showPageLoading;

})();
