/**
 * Page Lifecycle Manager
 * Central cleanup registry for beforeunload.
 * Modules register named cleanup functions; all run on page unload.
 */
(function () {
  "use strict";

  var _cleanups = {};

  function register(name, fn) {
    if (typeof fn !== "function") return;
    _cleanups[name] = fn;
  }

  function cleanup() {
    var keys = Object.keys(_cleanups);
    for (var i = 0; i < keys.length; i++) {
      try {
        _cleanups[keys[i]]();
      } catch (e) {
        console.warn("[PageLifecycle] cleanup error in", keys[i], e);
      }
    }
    _cleanups = {};
  }

  window.addEventListener("beforeunload", cleanup);

  window.PageLifecycle = {
    register: register,
    cleanup: cleanup,
  };
})();
