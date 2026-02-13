/**
 * NGM HUB - Shared Utilities
 * Common functions used across multiple modules.
 * Load after config.js, before page-specific scripts.
 */
(function () {
  "use strict";

  // ── Auth ──────────────────────────────────────────────────────────

  /**
   * Returns authorization headers using the stored Firebase token.
   * @returns {Object} Headers object with Authorization bearer token
   */
  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: "Bearer " + token } : {};
  }

  // ── Formatting ────────────────────────────────────────────────────

  const _currencyFmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  /**
   * Formats a number as USD currency string (no $ symbol, use for table cells).
   * @param {number} amount
   * @returns {string} e.g. "1,234.56"
   */
  function formatCurrency(amount) {
    if (!amount && amount !== 0) return "0.00";
    return _currencyFmt.format(amount);
  }

  /**
   * Formats a number as full USD currency string with $ symbol.
   * @param {number} amount
   * @returns {string} e.g. "$1,234.56"
   */
  function formatUSD(amount) {
    if (!amount && amount !== 0) return "$0.00";
    return "$" + _currencyFmt.format(amount);
  }

  // ── HTML Safety ───────────────────────────────────────────────────

  /**
   * Escapes HTML special characters to prevent XSS.
   * Uses string replace chain (faster than DOM-based approach).
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Hashing ───────────────────────────────────────────────────────

  /**
   * Deterministic string-to-hue hash for consistent avatar colors.
   * Returns 0-359 (HSL hue). Use with: hsl(hue, 70%, 45%)
   * @param {string} str
   * @returns {number}
   */
  function hashStringToHue(str) {
    if (!str) return 200;
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  // ── Supabase ──────────────────────────────────────────────────────

  let _supabaseInstance = null;

  /**
   * Returns a singleton Supabase client.
   * Avoids creating multiple clients / WebSocket connections.
   * @returns {Object|null} Supabase client instance
   */
  function getSupabaseClient() {
    if (_supabaseInstance) return _supabaseInstance;
    const url =
      window.SUPABASE_URL || (window.NGM_CONFIG && window.NGM_CONFIG.SUPABASE_URL) || "";
    const key =
      window.SUPABASE_ANON_KEY || (window.NGM_CONFIG && window.NGM_CONFIG.SUPABASE_ANON_KEY) || "";
    if (!url || !key || !window.supabase) return null;
    _supabaseInstance =
      window._ngmSupabaseClient || window.supabase.createClient(url, key);
    window._ngmSupabaseClient = _supabaseInstance;
    return _supabaseInstance;
  }

  // ── Config Getters ────────────────────────────────────────────────

  /**
   * Returns the API base URL from config with fallback chain.
   * @returns {string}
   */
  function getApiBase() {
    return (
      window.API_BASE ||
      (window.NGM_CONFIG && window.NGM_CONFIG.API_BASE) ||
      "http://127.0.0.1:8000"
    );
  }

  // ── Timing ────────────────────────────────────────────────────────

  /**
   * Standard debounce. Returns a function that delays invoking fn
   * until after ms milliseconds since the last call.
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  function debounce(fn, ms) {
    let timer;
    return function () {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, ms);
    };
  }

  // ── Expose globally ───────────────────────────────────────────────

  const utils = {
    getAuthHeaders: getAuthHeaders,
    formatCurrency: formatCurrency,
    formatUSD: formatUSD,
    escapeHtml: escapeHtml,
    hashStringToHue: hashStringToHue,
    getSupabaseClient: getSupabaseClient,
    getApiBase: getApiBase,
    debounce: debounce,
  };

  // Namespace
  window.NGMUtils = utils;

  // Individual globals (backward-compat, modules can shadow these)
  window.getAuthHeaders = window.getAuthHeaders || getAuthHeaders;
  window.formatCurrency = window.formatCurrency || formatCurrency;
  window.formatUSD = window.formatUSD || formatUSD;
  window.escapeHtml = window.escapeHtml || escapeHtml;
  window.hashStringToHue = window.hashStringToHue || hashStringToHue;
  window.getSupabaseClient = window.getSupabaseClient || getSupabaseClient;
  window.getApiBase = window.getApiBase || getApiBase;
  window.debounce = window.debounce || debounce;
})();
