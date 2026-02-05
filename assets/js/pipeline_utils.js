// assets/js/pipeline_utils.js
// Shared utility functions for Pipeline module
// Load this script BEFORE other pipeline scripts
(function() {
  'use strict';

  /**
   * Escapes HTML special characters to prevent XSS
   * @param {*} s - String to escape
   * @returns {string} Escaped string
   */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Generates a consistent color hue from a string (for avatars)
   * @param {string} str - String to hash
   * @returns {number} Hue value 0-359
   */
  function hashStringToHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  /**
   * Gets the first letter of a name (for avatar initials)
   * @param {string} name - Name to get initial from
   * @returns {string} First letter uppercase or "?"
   */
  function getInitial(name) {
    const s = String(name || '').trim();
    if (!s) return '?';
    return s[0].toUpperCase();
  }

  // Expose globally for all pipeline modules
  window.PipelineUtils = {
    escapeHtml,
    hashStringToHue,
    getInitial
  };

})();
