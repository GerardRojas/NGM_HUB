// assets/js/pipeline_links_modal.js
// Links Modal - Edit docs_link and result_link for tasks
(function () {
  'use strict';

  const qs = (id) => document.getElementById(id);

  // Current task being edited
  let currentTaskId = null;
  let currentDocsLink = null;
  let currentResultLink = null;

  // ================================
  // MODAL OPEN/CLOSE
  // ================================
  function open(taskId, docsLink, resultLink) {
    const modal = qs('linksModal');
    if (!modal) {
      console.warn('[LinksModal] linksModal not found');
      return;
    }

    currentTaskId = taskId;
    currentDocsLink = docsLink || '';
    currentResultLink = resultLink || '';

    // Populate fields
    const docsInput = qs('lm_docs_link');
    const resultInput = qs('lm_result_link');

    if (docsInput) docsInput.value = currentDocsLink;
    if (resultInput) resultInput.value = currentResultLink;

    // Update button states
    updateButtonStates();

    // Show modal
    modal.classList.remove('hidden');

    // Focus first input
    setTimeout(() => {
      if (docsInput) docsInput.focus();
    }, 50);
  }

  function close() {
    const modal = qs('linksModal');
    if (!modal) return;

    modal.classList.add('hidden');
    currentTaskId = null;
    currentDocsLink = null;
    currentResultLink = null;
  }

  // ================================
  // BUTTON STATE MANAGEMENT
  // ================================
  function updateButtonStates() {
    const docsInput = qs('lm_docs_link');
    const resultInput = qs('lm_result_link');
    const btnOpenDocs = qs('btnOpenDocsLink');
    const btnClearDocs = qs('btnClearDocsLink');
    const btnOpenResult = qs('btnOpenResultLink');
    const btnClearResult = qs('btnClearResultLink');

    const hasDocsLink = docsInput?.value?.trim();
    const hasResultLink = resultInput?.value?.trim();

    if (btnOpenDocs) btnOpenDocs.disabled = !hasDocsLink;
    if (btnClearDocs) btnClearDocs.disabled = !hasDocsLink;
    if (btnOpenResult) btnOpenResult.disabled = !hasResultLink;
    if (btnClearResult) btnClearResult.disabled = !hasResultLink;
  }

  // ================================
  // SAVE LINKS
  // ================================
  async function saveLinks() {
    if (!currentTaskId) {
      console.warn('[LinksModal] No task ID');
      return;
    }

    const docsLink = qs('lm_docs_link')?.value?.trim() || null;
    const resultLink = qs('lm_result_link')?.value?.trim() || null;

    // Validate URLs if provided
    if (docsLink && !isValidUrl(docsLink)) {
      if (window.Toast) {
        Toast.warning('Invalid URL', 'Documentation link is not a valid URL');
      }
      return;
    }

    if (resultLink && !isValidUrl(resultLink)) {
      if (window.Toast) {
        Toast.warning('Invalid URL', 'Result link is not a valid URL');
      }
      return;
    }

    const btn = qs('btnSaveLinks');
    const originalText = btn?.textContent || 'Save Links';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving...';
    }

    try {
      const apiBase = window.API_BASE || '';
      const updates = [];

      // Queue docs_link update if changed
      if (docsLink !== currentDocsLink) {
        updates.push(
          fetch(`${apiBase}/pipeline/tasks/${currentTaskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ docs_link: docsLink }),
          })
        );
      }

      // Queue result_link update if changed
      if (resultLink !== currentResultLink) {
        updates.push(
          fetch(`${apiBase}/pipeline/tasks/${currentTaskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ result_link: resultLink }),
          })
        );
      }

      // Execute all updates in parallel
      if (updates.length > 0) {
        const results = await Promise.all(updates);
        // Check if any failed
        const failed = results.filter(r => !r.ok);
        if (failed.length > 0) {
          throw new Error(`${failed.length} update(s) failed`);
        }
      }

      if (window.Toast) {
        Toast.success('Links Saved', 'Task links updated successfully!');
      }

      close();

      // Refresh pipeline to show updated links
      if (typeof window.fetchPipeline === 'function') {
        window.fetchPipeline().catch(err => console.warn('[Pipeline] Refresh failed:', err));
      }

    } catch (err) {
      console.error('[LinksModal] Error:', err);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving links.', { details: err.message });
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  }

  // ================================
  // UTILITIES
  // ================================
  function isValidUrl(string) {
    try {
      const url = new URL(string);
      // Only allow http and https protocols (prevents javascript:, data:, etc.)
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function openLink(url) {
    if (url && isValidUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ================================
  // BIND EVENTS
  // ================================
  function bind() {
    // Close button
    qs('btnCloseLinksModal')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    // Cancel button
    qs('btnCancelLinks')?.addEventListener('click', (e) => {
      e.preventDefault();
      close();
    });

    // Save button
    qs('btnSaveLinks')?.addEventListener('click', (e) => {
      e.preventDefault();
      saveLinks();
    });

    // Open docs link
    qs('btnOpenDocsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      const url = qs('lm_docs_link')?.value?.trim();
      openLink(url);
    });

    // Open result link
    qs('btnOpenResultLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      const url = qs('lm_result_link')?.value?.trim();
      openLink(url);
    });

    // Clear docs link
    qs('btnClearDocsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      const input = qs('lm_docs_link');
      if (input) {
        input.value = '';
        input.focus();
      }
      updateButtonStates();
    });

    // Clear result link
    qs('btnClearResultLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      const input = qs('lm_result_link');
      if (input) {
        input.value = '';
        input.focus();
      }
      updateButtonStates();
    });

    // Update button states on input
    qs('lm_docs_link')?.addEventListener('input', updateButtonStates);
    qs('lm_result_link')?.addEventListener('input', updateButtonStates);

    // Click backdrop to close
    const modal = qs('linksModal');
    if (modal) {
      modal.addEventListener('click', close);

      // Prevent close when clicking inside modal card
      const dialog = modal.querySelector('.modal');
      dialog?.addEventListener('click', (ev) => ev.stopPropagation());
    }

    // Escape to close
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        const modal = qs('linksModal');
        if (modal && !modal.classList.contains('hidden')) {
          close();
        }
      }
    });

    // Enter to save (when in inputs)
    qs('lm_docs_link')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveLinks();
      }
    });

    qs('lm_result_link')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveLinks();
      }
    });
  }

  // ================================
  // EXPOSE TO GLOBAL
  // ================================
  window.PM_LinksModal = { open, close, bind };

})();
