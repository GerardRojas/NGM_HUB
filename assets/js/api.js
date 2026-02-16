/**
 * NGM HUB - Centralized API Client & Error Handling
 * Load after config.js and auth-guard.js, before page scripts.
 *
 * Exposes window.NGM with:
 *   .api(url, options)       - Fetch with auth, timeout, retry, 401 redirect
 *   .guardClick(btn, fn)     - Double-click protection for save buttons
 *   .cancelGroup(key)        - AbortController manager for cancellable requests
 */
(function () {
  "use strict";

  var DEFAULT_TIMEOUT = 30000; // 30 seconds
  var RETRY_DELAY = 2000;     // 2 seconds before retry on 5xx
  var MAX_RETRIES = 1;        // 1 retry on server errors

  // ── Cancel Groups ──────────────────────────────────────────────────
  var _controllers = {};

  /**
   * Returns { signal } for a named request group.
   * Calling again with the same key aborts the previous in-flight request.
   * @param {string} key - Group identifier (e.g. "loadExpenses", "loadVaultFiles")
   * @returns {{ signal: AbortSignal }}
   */
  function cancelGroup(key) {
    if (_controllers[key]) {
      _controllers[key].abort();
    }
    _controllers[key] = new AbortController();
    return { signal: _controllers[key].signal };
  }

  // ── Centralized API ────────────────────────────────────────────────

  /**
   * Centralized fetch wrapper with auth, timeout, retry, and 401 handling.
   *
   * @param {string} url - Full URL or path (if starts with /, prepends API_BASE)
   * @param {Object} [options] - fetch options + extras
   * @param {number} [options.timeout] - Timeout in ms (default 30000)
   * @param {AbortSignal} [options.signal] - External abort signal (from cancelGroup)
   * @param {boolean} [options.skipAuth] - Skip Authorization header
   * @param {boolean} [options.raw] - Return raw Response instead of parsed JSON
   * @returns {Promise<*>} Parsed JSON or null
   */
  async function api(url, options) {
    options = options || {};

    // Resolve relative paths
    if (url.charAt(0) === "/") {
      var base = window.API_BASE ||
        (window.NGM_CONFIG && window.NGM_CONFIG.API_BASE) ||
        "http://127.0.0.1:8000";
      url = base + url;
    }

    // Auth header
    var headers = Object.assign({}, options.headers || {});
    if (!options.skipAuth) {
      var token = localStorage.getItem("ngmToken");
      if (token) {
        headers["Authorization"] = "Bearer " + token;
      }
    }

    // Timeout via AbortController
    var timeoutMs = options.timeout || DEFAULT_TIMEOUT;
    var timeoutCtrl = new AbortController();
    var timeoutId = setTimeout(function () { timeoutCtrl.abort(); }, timeoutMs);

    // Combine external signal (from cancelGroup) with timeout signal
    var signal = options.signal
      ? _combineSignals(options.signal, timeoutCtrl.signal)
      : timeoutCtrl.signal;

    // Clean options for fetch (remove our custom keys)
    var fetchOpts = Object.assign({}, options);
    delete fetchOpts.timeout;
    delete fetchOpts.skipAuth;
    delete fetchOpts.raw;
    fetchOpts.headers = headers;
    fetchOpts.signal = signal;
    fetchOpts.credentials = fetchOpts.credentials || "include";

    try {
      var res = await _fetchWithRetry(url, fetchOpts, 0);

      if (options.raw) return res;

      var text = "";
      try { text = await res.text(); } catch (_) {}

      if (!res.ok) {
        // 401 - Session expired
        if (res.status === 401) {
          console.error("[NGM API] 401 Unauthorized - redirecting to login");
          if (window.authGuard && window.authGuard.clearAuthData) {
            window.authGuard.clearAuthData();
          } else {
            localStorage.removeItem("ngmToken");
            localStorage.removeItem("ngmUser");
          }
          if (window.Toast) {
            window.Toast.error("Session Expired", "Please log in again.");
          }
          window.location.href = "login.html";
          return null;
        }
        throw new Error((fetchOpts.method || "GET") + " " + url +
          " failed (" + res.status + "): " + text.substring(0, 200));
      }

      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.error("[NGM API] Invalid JSON from", url, ":", text.substring(0, 200));
        throw new Error("Invalid JSON response: " + parseErr.message);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // Distinguish timeout from manual cancel
        if (timeoutCtrl.signal.aborted && !(options.signal && options.signal.aborted)) {
          throw new Error("Request timeout after " + (timeoutMs / 1000) + "s: " + url);
        }
        // Manual cancel (from cancelGroup) - rethrow silently
        throw err;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch with 1 retry on 5xx server errors.
   */
  async function _fetchWithRetry(url, opts, attempt) {
    var res = await fetch(url, opts);

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      console.warn("[NGM API] Server error " + res.status + ", retrying in " +
        (RETRY_DELAY / 1000) + "s... (" + url + ")");
      await new Promise(function (r) { setTimeout(r, RETRY_DELAY); });
      return _fetchWithRetry(url, opts, attempt + 1);
    }

    return res;
  }

  /**
   * Combines two AbortSignals - aborts when either fires.
   */
  function _combineSignals(sig1, sig2) {
    // If AbortSignal.any is available (modern browsers), use it
    if (typeof AbortSignal !== "undefined" && AbortSignal.any) {
      return AbortSignal.any([sig1, sig2]);
    }
    // Fallback: create a new controller that aborts when either fires
    var combined = new AbortController();
    function onAbort() { combined.abort(); }
    if (sig1.aborted || sig2.aborted) { combined.abort(); return combined.signal; }
    sig1.addEventListener("abort", onAbort, { once: true });
    sig2.addEventListener("abort", onAbort, { once: true });
    return combined.signal;
  }

  // ── Guard Click ────────────────────────────────────────────────────

  /**
   * Wraps a button click with double-click protection.
   * Disables button immediately, re-enables after async fn completes.
   *
   * @param {HTMLElement} btn - Button element
   * @param {Function} fn - Async function to execute
   * @param {string} [savingText] - Text while saving (default: "Saving...")
   */
  function guardClick(btn, fn, savingText) {
    if (!btn) return;
    savingText = savingText || "Saving...";

    btn.addEventListener("click", async function (e) {
      if (btn.disabled) return;

      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = savingText;

      try {
        await fn(e);
      } catch (err) {
        console.error("[NGM Guard]", err);
        if (window.Toast) {
          window.Toast.error("Error", err.message || "Operation failed");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  // ── Global Error Handler ───────────────────────────────────────────

  window.addEventListener("unhandledrejection", function (event) {
    // Ignore AbortError (cancelled requests are intentional)
    if (event.reason && event.reason.name === "AbortError") {
      event.preventDefault();
      return;
    }

    var msg = event.reason
      ? (event.reason.message || String(event.reason))
      : "Unknown error";

    console.error("[NGM] Unhandled promise rejection:", event.reason);

    // Show toast if available (avoid flooding - debounce)
    if (window.Toast && !window._ngmLastUnhandledToast ||
        Date.now() - (window._ngmLastUnhandledToast || 0) > 5000) {
      window._ngmLastUnhandledToast = Date.now();
      window.Toast.error("Unexpected Error", msg.substring(0, 100));
    }

    event.preventDefault();
  });

  // ── Expose ─────────────────────────────────────────────────────────

  window.NGM = Object.assign(window.NGM || {}, {
    api: api,
    guardClick: guardClick,
    cancelGroup: cancelGroup
  });

  console.log("[NGM API] Ready");
})();
