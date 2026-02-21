/**
 * TIMELINE MANAGER — Gantt Chart & Milestones
 * ============================================
 * Full CRUD for project phases (Gantt bars) and milestones.
 * Uses frappe-gantt for interactive Gantt chart rendering.
 *
 * Dependencies:
 *   - window.NGM.api(url, options)
 *   - window.Toast.success / .error
 *   - Frappe Gantt (global Gantt constructor)
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  var _currentProjectId = null;
  var _phases = [];
  var _milestones = [];
  var _gantt = null;
  var _currentViewMode = 'Week';
  var _abortController = null;
  var _importFile = null;

  // ── Helpers ────────────────────────────────────────────────────────

  /** Escape HTML to prevent XSS */
  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Format a Date object to YYYY-MM-DD string */
  function formatDate(d) {
    if (!d) return '';
    if (typeof d === 'string') return d.slice(0, 10);
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  /** Get today as YYYY-MM-DD */
  function todayStr() {
    return formatDate(new Date());
  }

  /** Get a date N days from today as YYYY-MM-DD */
  function futureDateStr(days) {
    var d = new Date();
    d.setDate(d.getDate() + (days || 7));
    return formatDate(d);
  }

  /** Format date for display: "Feb 20, 2026" */
  function displayDate(dateStr) {
    if (!dateStr) return '--';
    try {
      var parts = dateStr.slice(0, 10).split('-');
      var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    } catch (_) {
      return dateStr;
    }
  }

  /** Cancel any in-flight request */
  function cancelPending() {
    if (_abortController) {
      _abortController.abort();
    }
    _abortController = new AbortController();
    return _abortController.signal;
  }

  /** Find a phase by ID from the local cache */
  function findPhase(phaseId) {
    for (var i = 0; i < _phases.length; i++) {
      if (String(_phases[i].phase_id) === String(phaseId)) return _phases[i];
    }
    return null;
  }

  /** Find a milestone by ID from the local cache */
  function findMilestone(milestoneId) {
    for (var i = 0; i < _milestones.length; i++) {
      if (String(_milestones[i].milestone_id) === String(milestoneId)) return _milestones[i];
    }
    return null;
  }

  // ── DOM References ─────────────────────────────────────────────────
  var elProjectSelect, elTimelineContent, elEmptyState, elViewControls;
  var elBtnAddPhase, elMilestonesSection, elMilestonesList, elBtnAddMilestone;

  // Phase modal
  var elPhaseModal, elPhaseModalTitle, elPhaseForm, elPhaseId, elPhaseName;
  var elPhaseStart, elPhaseEnd, elPhaseStatus, elPhaseProgress, elPhaseColor, elPhaseNotes;
  var elBtnSavePhase, elBtnCancelPhase, elBtnClosePhaseModal;

  // Milestone modal
  var elMilestoneModal, elMilestoneModalTitle, elMilestoneForm, elMilestoneId, elMilestoneName;
  var elMilestoneDueDate, elMilestonePhase, elMilestoneStatus, elMilestoneNotes;
  var elBtnSaveMilestone, elBtnCancelMilestone, elBtnCloseMilestoneModal;

  // Import modal
  var elImportModal, elImportDropzone, elImportFileInput, elImportFileInfo;
  var elImportFileName, elBtnRemoveFile, elBtnImportTimeline;
  var elBtnCloseImportModal, elBtnCancelImport, elBtnConfirmImport;

  function cacheDom() {
    elProjectSelect = document.getElementById('timelineProjectSelect');
    elTimelineContent = document.getElementById('timelineContent');
    elEmptyState = document.getElementById('timelineEmptyState');
    elViewControls = document.getElementById('viewControls');
    elBtnAddPhase = document.getElementById('btnAddPhase');
    elMilestonesSection = document.getElementById('milestonesSection');
    elMilestonesList = document.getElementById('milestonesList');
    elBtnAddMilestone = document.getElementById('btnAddMilestone');

    // Phase modal
    elPhaseModal = document.getElementById('phaseModal');
    elPhaseModalTitle = document.getElementById('phaseModalTitle');
    elPhaseForm = document.getElementById('phaseForm');
    elPhaseId = document.getElementById('phaseId');
    elPhaseName = document.getElementById('phaseName');
    elPhaseStart = document.getElementById('phaseStart');
    elPhaseEnd = document.getElementById('phaseEnd');
    elPhaseStatus = document.getElementById('phaseStatus');
    elPhaseProgress = document.getElementById('phaseProgress');
    elPhaseColor = document.getElementById('phaseColor');
    elPhaseNotes = document.getElementById('phaseNotes');
    elBtnSavePhase = document.getElementById('btnSavePhase');
    elBtnCancelPhase = document.getElementById('btnCancelPhase');
    elBtnClosePhaseModal = document.getElementById('btnClosePhaseModal');

    // Milestone modal
    elMilestoneModal = document.getElementById('milestoneModal');
    elMilestoneModalTitle = document.getElementById('milestoneModalTitle');
    elMilestoneForm = document.getElementById('milestoneForm');
    elMilestoneId = document.getElementById('milestoneId');
    elMilestoneName = document.getElementById('milestoneName');
    elMilestoneDueDate = document.getElementById('milestoneDueDate');
    elMilestonePhase = document.getElementById('milestonePhase');
    elMilestoneStatus = document.getElementById('milestoneStatus');
    elMilestoneNotes = document.getElementById('milestoneNotes');
    elBtnSaveMilestone = document.getElementById('btnSaveMilestone');
    elBtnCancelMilestone = document.getElementById('btnCancelMilestone');
    elBtnCloseMilestoneModal = document.getElementById('btnCloseMilestoneModal');

    // Import modal
    elImportModal = document.getElementById('importModal');
    elImportDropzone = document.getElementById('importDropzone');
    elImportFileInput = document.getElementById('importFileInput');
    elImportFileInfo = document.getElementById('importFileInfo');
    elImportFileName = document.getElementById('importFileName');
    elBtnRemoveFile = document.getElementById('btnRemoveFile');
    elBtnImportTimeline = document.getElementById('btnImportTimeline');
    elBtnCloseImportModal = document.getElementById('btnCloseImportModal');
    elBtnCancelImport = document.getElementById('btnCancelImport');
    elBtnConfirmImport = document.getElementById('btnConfirmImport');
  }

  // ── API Calls ──────────────────────────────────────────────────────

  /** Fetch all projects for the dropdown */
  async function fetchProjects() {
    try {
      var data = await window.NGM.api('/projects', { signal: cancelPending() });
      if (!data || !Array.isArray(data)) return [];
      return data;
    } catch (err) {
      if (err && err.name === 'AbortError') return [];
      console.error('[TimelineManager] fetchProjects error:', err);
      return [];
    }
  }

  /** Fetch phases for a project */
  async function fetchPhases(projectId) {
    try {
      var data = await window.NGM.api(
        '/timeline/projects/' + projectId + '/phases',
        { signal: cancelPending() }
      );
      // Backend returns array directly (or object with .data for compat)
      var arr = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      return arr;
    } catch (err) {
      if (err && err.name === 'AbortError') return [];
      console.error('[TimelineManager] fetchPhases error:', err);
      return [];
    }
  }

  /** Fetch milestones for a project */
  async function fetchMilestones(projectId) {
    try {
      var data = await window.NGM.api(
        '/timeline/projects/' + projectId + '/milestones',
        { signal: cancelPending() }
      );
      // Backend returns array directly (or object with .data for compat)
      var arr = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      return arr;
    } catch (err) {
      if (err && err.name === 'AbortError') return [];
      console.error('[TimelineManager] fetchMilestones error:', err);
      return [];
    }
  }

  /** Create a new phase */
  async function createPhase(payload) {
    try {
      var data = await window.NGM.api(
        '/timeline/projects/' + _currentProjectId + '/phases',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return data;
    } catch (err) {
      console.error('[TimelineManager] createPhase error:', err);
      throw err;
    }
  }

  /** Update (PATCH) a phase */
  async function patchPhase(phaseId, payload) {
    try {
      var data = await window.NGM.api(
        '/timeline/phases/' + phaseId,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return data;
    } catch (err) {
      console.error('[TimelineManager] patchPhase error:', err);
      if (window.Toast) window.Toast.error('Error', 'Failed to update phase');
      throw err;
    }
  }

  /** Delete a phase */
  async function deletePhase(phaseId) {
    try {
      await window.NGM.api(
        '/timeline/phases/' + phaseId,
        { method: 'DELETE' }
      );
      return true;
    } catch (err) {
      console.error('[TimelineManager] deletePhase error:', err);
      throw err;
    }
  }

  /** Create a new milestone */
  async function createMilestone(payload) {
    try {
      var data = await window.NGM.api(
        '/timeline/projects/' + _currentProjectId + '/milestones',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return data;
    } catch (err) {
      console.error('[TimelineManager] createMilestone error:', err);
      throw err;
    }
  }

  /** Update (PATCH) a milestone */
  async function patchMilestone(milestoneId, payload) {
    try {
      var data = await window.NGM.api(
        '/timeline/milestones/' + milestoneId,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );
      return data;
    } catch (err) {
      console.error('[TimelineManager] patchMilestone error:', err);
      if (window.Toast) window.Toast.error('Error', 'Failed to update milestone');
      throw err;
    }
  }

  /** Delete a milestone */
  async function deleteMilestone(milestoneId) {
    try {
      await window.NGM.api(
        '/timeline/milestones/' + milestoneId,
        { method: 'DELETE' }
      );
      return true;
    } catch (err) {
      console.error('[TimelineManager] deleteMilestone error:', err);
      throw err;
    }
  }

  // ── Populate Projects Dropdown ─────────────────────────────────────

  async function populateProjects() {
    var projects = await fetchProjects();
    if (!elProjectSelect) return;

    // Clear existing options except the placeholder
    elProjectSelect.innerHTML = '<option value="">Select a project...</option>';

    projects.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.project_id || p.id || '';
      opt.textContent = p.project_name || p.name || 'Unnamed Project';
      elProjectSelect.appendChild(opt);
    });
  }

  // ── Gantt Chart ────────────────────────────────────────────────────

  /** Destroy existing Gantt instance to prevent memory leaks */
  function destroyGantt() {
    if (_gantt) {
      // frappe-gantt v0.6.1 has no formal destroy method.
      // Clean up the popup it lazily appends to <body>.
      var popups = document.querySelectorAll('.popup-wrapper');
      for (var i = 0; i < popups.length; i++) {
        popups[i].remove();
      }
      _gantt = null;
    }
  }

  /** Show skeleton loading state */
  function showSkeleton() {
    if (!elTimelineContent) return;
    elTimelineContent.innerHTML =
      '<div class="tm-skeleton">' +
        '<div class="tm-skeleton-bar" style="width:70%;"></div>' +
        '<div class="tm-skeleton-bar" style="width:55%;"></div>' +
        '<div class="tm-skeleton-bar" style="width:85%;"></div>' +
        '<div class="tm-skeleton-bar" style="width:40%;"></div>' +
      '</div>';
  }

  /** Show empty Gantt state */
  function showEmptyGantt() {
    if (!elTimelineContent) return;
    elTimelineContent.innerHTML =
      '<div class="tm-empty-state">' +
        '<span class="tm-empty-icon">📊</span>' +
        '<span class="tm-empty-text">No phases yet. Click "+ Add Phase" to create the first one.</span>' +
      '</div>';
  }

  /** Show the initial empty state (no project selected) */
  function showInitialEmptyState() {
    if (!elTimelineContent) return;
    elTimelineContent.innerHTML =
      '<div class="tm-empty-state" id="timelineEmptyState">' +
        '<span class="tm-empty-icon">📅</span>' +
        '<span class="tm-empty-text">Select a project to view its timeline</span>' +
      '</div>';
  }

  /** Render the Gantt chart from phases data */
  function renderGantt() {
    destroyGantt();

    if (!_phases || _phases.length === 0) {
      showEmptyGantt();
      return;
    }

    var today = todayStr();
    var nextWeek = futureDateStr(7);

    var tasks = _phases.map(function (p) {
      return {
        id: String(p.phase_id),
        name: p.phase_name || 'Untitled Phase',
        start: p.start_date || today,
        end: p.end_date || nextWeek,
        progress: p.progress_pct || 0,
        custom_class: 'tm-bar-' + (p.status || 'pending')
      };
    });

    // Create/clear the SVG target div inside timelineContent
    if (!elTimelineContent) return;
    elTimelineContent.innerHTML = '<div id="ganttTarget"></div>';

    try {
      _gantt = new Gantt('#ganttTarget', tasks, {
        view_mode: _currentViewMode,
        language: 'en',
        on_date_change: function (task, start, end) {
          patchPhase(task.id, {
            start_date: formatDate(start),
            end_date: formatDate(end)
          }).then(function () {
            // Update local cache
            var phase = findPhase(task.id);
            if (phase) {
              phase.start_date = formatDate(start);
              phase.end_date = formatDate(end);
            }
          }).catch(function () {
            // Revert on error — reload data
            loadProjectData(_currentProjectId);
          });
        },
        on_progress_change: function (task, progress) {
          var roundedProgress = Math.round(progress);
          patchPhase(task.id, { progress_pct: roundedProgress }).then(function () {
            var phase = findPhase(task.id);
            if (phase) phase.progress_pct = roundedProgress;
          }).catch(function () {
            loadProjectData(_currentProjectId);
          });
        },
        on_click: function (task) {
          openPhaseModal(task.id);
        }
      });
    } catch (err) {
      console.error('[TimelineManager] Gantt render error:', err);
      elTimelineContent.innerHTML =
        '<div class="tm-empty-state">' +
          '<span class="tm-empty-icon">⚠️</span>' +
          '<span class="tm-empty-text">Failed to render Gantt chart. Check console for details.</span>' +
        '</div>';
    }
  }

  // ── Milestones Rendering ───────────────────────────────────────────

  /** Render the milestones list below the Gantt chart */
  function renderMilestones() {
    if (!elMilestonesList || !elMilestonesSection) return;

    if (!_milestones || _milestones.length === 0) {
      elMilestonesList.innerHTML =
        '<div class="tm-empty-state" style="padding:32px 20px;">' +
          '<span class="tm-empty-text">No milestones yet. Click "+ Add Milestone" to create one.</span>' +
        '</div>';
      return;
    }

    var html = '';
    _milestones.forEach(function (m) {
      var statusClass = 'tm-status-badge--' + (m.status || 'pending');
      var statusLabel = (m.status || 'pending').replace(/_/g, ' ');
      statusLabel = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

      // Find associated phase name
      var phaseName = '';
      if (m.phase_id) {
        var phase = findPhase(m.phase_id);
        if (phase) phaseName = phase.phase_name || '';
      }

      html +=
        '<div class="tm-milestone-card" data-milestone-id="' + esc(m.milestone_id) + '">' +
          '<div class="tm-milestone-left">' +
            '<span class="tm-status-badge ' + esc(statusClass) + '">' + esc(statusLabel) + '</span>' +
            '<div>' +
              '<div class="tm-milestone-name">' + esc(m.milestone_name || m.name || 'Untitled') + '</div>' +
              (phaseName ? '<div class="tm-milestone-phase">' + esc(phaseName) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="tm-milestone-right">' +
            '<span class="tm-milestone-date">' + esc(displayDate(m.due_date)) + '</span>' +
            '<button type="button" class="tm-delete-btn" data-delete-milestone="' + esc(m.milestone_id) + '" title="Delete milestone">' +
              '&#x2715;' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    elMilestonesList.innerHTML = html;

    // Attach click handlers to milestone cards (edit)
    var cards = elMilestonesList.querySelectorAll('.tm-milestone-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        // Don't open edit if clicking the delete button
        if (e.target.closest('.tm-delete-btn')) return;
        var msId = card.getAttribute('data-milestone-id');
        if (msId) openMilestoneModal(msId);
      });
    });

    // Attach click handlers to delete buttons
    var delBtns = elMilestonesList.querySelectorAll('[data-delete-milestone]');
    delBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var msId = btn.getAttribute('data-delete-milestone');
        if (msId) confirmDeleteMilestone(msId);
      });
    });
  }

  // ── Load Project Data ──────────────────────────────────────────────

  async function loadProjectData(projectId) {
    if (!projectId) {
      _currentProjectId = null;
      _phases = [];
      _milestones = [];
      destroyGantt();
      showInitialEmptyState();
      if (elViewControls) elViewControls.style.display = 'none';
      if (elBtnAddPhase) elBtnAddPhase.style.display = 'none';
      if (elBtnImportTimeline) elBtnImportTimeline.style.display = 'none';
      if (elMilestonesSection) elMilestonesSection.style.display = 'none';
      return;
    }

    _currentProjectId = projectId;
    showSkeleton();

    // Show toolbar controls
    if (elViewControls) elViewControls.style.display = 'flex';
    if (elBtnAddPhase) elBtnAddPhase.style.display = 'inline-flex';
    if (elBtnImportTimeline) elBtnImportTimeline.style.display = 'inline-flex';
    if (elMilestonesSection) elMilestonesSection.style.display = 'block';

    try {
      // Fetch phases and milestones in parallel
      var results = await Promise.all([
        fetchPhases(projectId),
        fetchMilestones(projectId)
      ]);

      _phases = results[0] || [];
      _milestones = results[1] || [];

      renderGantt();
      renderMilestones();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.error('[TimelineManager] loadProjectData error:', err);
      if (window.Toast) window.Toast.error('Error', 'Failed to load timeline data');
    }
  }

  // ── Phase Modal ────────────────────────────────────────────────────

  /** Open phase modal for create or edit */
  function openPhaseModal(phaseId) {
    if (!elPhaseModal || !elPhaseForm) return;

    elPhaseForm.reset();
    elPhaseId.value = '';
    elPhaseColor.value = '#3ecf8e';
    elPhaseProgress.value = '0';

    if (phaseId) {
      // Edit mode
      var phase = findPhase(phaseId);
      if (!phase) {
        if (window.Toast) window.Toast.error('Error', 'Phase not found');
        return;
      }
      elPhaseModalTitle.textContent = 'Edit Phase';
      elPhaseId.value = phase.phase_id;
      elPhaseName.value = phase.phase_name || '';
      elPhaseStart.value = phase.start_date ? phase.start_date.slice(0, 10) : '';
      elPhaseEnd.value = phase.end_date ? phase.end_date.slice(0, 10) : '';
      elPhaseStatus.value = phase.status || 'pending';
      elPhaseProgress.value = phase.progress_pct != null ? phase.progress_pct : 0;
      elPhaseColor.value = phase.color || '#3ecf8e';
      elPhaseNotes.value = phase.notes || '';
    } else {
      // Create mode
      elPhaseModalTitle.textContent = 'Add Phase';
      elPhaseStart.value = todayStr();
      elPhaseEnd.value = futureDateStr(14);
    }

    elPhaseModal.classList.remove('hidden');
  }

  /** Close phase modal */
  function closePhaseModal() {
    if (elPhaseModal) elPhaseModal.classList.add('hidden');
  }

  /** Save phase (create or update) */
  async function savePhase() {
    var name = (elPhaseName.value || '').trim();
    if (!name) {
      if (window.Toast) window.Toast.error('Validation', 'Phase name is required');
      return;
    }

    var payload = {
      phase_name: name,
      start_date: elPhaseStart.value || null,
      end_date: elPhaseEnd.value || null,
      status: elPhaseStatus.value || 'pending',
      progress_pct: parseInt(elPhaseProgress.value, 10) || 0,
      color: elPhaseColor.value || '#3ecf8e',
      notes: (elPhaseNotes.value || '').trim() || null
    };

    // Clamp progress
    if (payload.progress_pct < 0) payload.progress_pct = 0;
    if (payload.progress_pct > 100) payload.progress_pct = 100;

    // Validate dates
    if (payload.start_date && payload.end_date && payload.start_date > payload.end_date) {
      if (window.Toast) window.Toast.error('Validation', 'Start date must be before end date');
      return;
    }

    var phaseId = elPhaseId.value;

    try {
      elBtnSavePhase.disabled = true;
      elBtnSavePhase.textContent = 'Saving...';

      if (phaseId) {
        // Update
        await patchPhase(phaseId, payload);
        if (window.Toast) window.Toast.success('Updated', 'Phase updated successfully');
      } else {
        // Create
        await createPhase(payload);
        if (window.Toast) window.Toast.success('Created', 'Phase created successfully');
      }

      closePhaseModal();
      // Reload data to reflect changes
      await loadProjectData(_currentProjectId);
    } catch (err) {
      if (window.Toast) window.Toast.error('Error', 'Failed to save phase');
    } finally {
      elBtnSavePhase.disabled = false;
      elBtnSavePhase.textContent = 'Save Phase';
    }
  }

  /** Confirm and delete a phase */
  function confirmDeletePhase(phaseId) {
    var phase = findPhase(phaseId);
    var label = phase ? phase.phase_name : 'this phase';
    if (!confirm('Delete "' + label + '"? This action cannot be undone.')) return;

    deletePhase(phaseId)
      .then(function () {
        if (window.Toast) window.Toast.success('Deleted', 'Phase deleted');
        closePhaseModal();
        loadProjectData(_currentProjectId);
      })
      .catch(function () {
        if (window.Toast) window.Toast.error('Error', 'Failed to delete phase');
      });
  }

  // ── Milestone Modal ────────────────────────────────────────────────

  /** Populate the phase dropdown in the milestone modal */
  function populateMilestonePhaseDropdown() {
    if (!elMilestonePhase) return;
    elMilestonePhase.innerHTML = '<option value="">No phase</option>';
    _phases.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.phase_id;
      opt.textContent = p.phase_name || 'Untitled Phase';
      elMilestonePhase.appendChild(opt);
    });
  }

  /** Open milestone modal for create or edit */
  function openMilestoneModal(milestoneId) {
    if (!elMilestoneModal || !elMilestoneForm) return;

    elMilestoneForm.reset();
    elMilestoneId.value = '';
    populateMilestonePhaseDropdown();

    if (milestoneId) {
      // Edit mode
      var ms = findMilestone(milestoneId);
      if (!ms) {
        if (window.Toast) window.Toast.error('Error', 'Milestone not found');
        return;
      }
      elMilestoneModalTitle.textContent = 'Edit Milestone';
      elMilestoneId.value = ms.milestone_id;
      elMilestoneName.value = ms.milestone_name || ms.name || '';
      elMilestoneDueDate.value = ms.due_date ? ms.due_date.slice(0, 10) : '';
      elMilestonePhase.value = ms.phase_id || '';
      elMilestoneStatus.value = ms.status || 'pending';
      elMilestoneNotes.value = ms.notes || '';
    } else {
      // Create mode
      elMilestoneModalTitle.textContent = 'Add Milestone';
      elMilestoneDueDate.value = futureDateStr(30);
    }

    elMilestoneModal.classList.remove('hidden');
  }

  /** Close milestone modal */
  function closeMilestoneModal() {
    if (elMilestoneModal) elMilestoneModal.classList.add('hidden');
  }

  /** Save milestone (create or update) */
  async function saveMilestone() {
    var name = (elMilestoneName.value || '').trim();
    if (!name) {
      if (window.Toast) window.Toast.error('Validation', 'Milestone name is required');
      return;
    }

    var payload = {
      milestone_name: name,
      due_date: elMilestoneDueDate.value || null,
      phase_id: elMilestonePhase.value || null,
      status: elMilestoneStatus.value || 'pending',
      notes: (elMilestoneNotes.value || '').trim() || null
    };

    var milestoneId = elMilestoneId.value;

    try {
      elBtnSaveMilestone.disabled = true;
      elBtnSaveMilestone.textContent = 'Saving...';

      if (milestoneId) {
        await patchMilestone(milestoneId, payload);
        if (window.Toast) window.Toast.success('Updated', 'Milestone updated successfully');
      } else {
        await createMilestone(payload);
        if (window.Toast) window.Toast.success('Created', 'Milestone created successfully');
      }

      closeMilestoneModal();
      await loadProjectData(_currentProjectId);
    } catch (err) {
      if (window.Toast) window.Toast.error('Error', 'Failed to save milestone');
    } finally {
      elBtnSaveMilestone.disabled = false;
      elBtnSaveMilestone.textContent = 'Save Milestone';
    }
  }

  /** Confirm and delete a milestone */
  function confirmDeleteMilestone(milestoneId) {
    var ms = findMilestone(milestoneId);
    var label = ms ? (ms.milestone_name || ms.name) : 'this milestone';
    if (!confirm('Delete "' + label + '"? This action cannot be undone.')) return;

    deleteMilestone(milestoneId)
      .then(function () {
        if (window.Toast) window.Toast.success('Deleted', 'Milestone deleted');
        loadProjectData(_currentProjectId);
      })
      .catch(function () {
        if (window.Toast) window.Toast.error('Error', 'Failed to delete milestone');
      });
  }

  // ── Import MS Project ──────────────────────────────────────────────

  function openImportModal() {
    if (!elImportModal) return;
    _importFile = null;
    if (elImportFileInput) elImportFileInput.value = '';
    if (elImportFileInfo) elImportFileInfo.classList.add('hidden');
    if (elImportDropzone) elImportDropzone.classList.remove('hidden');
    if (elBtnConfirmImport) elBtnConfirmImport.disabled = true;
    elImportModal.classList.remove('hidden');
  }

  function closeImportModal() {
    if (elImportModal) elImportModal.classList.add('hidden');
    _importFile = null;
  }

  function handleFileSelected(file) {
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'xml' && ext !== 'csv') {
      if (window.Toast) window.Toast.error('Invalid file', 'Only .xml and .csv files are supported');
      return;
    }
    _importFile = file;
    if (elImportFileName) elImportFileName.textContent = file.name;
    if (elImportFileInfo) elImportFileInfo.classList.remove('hidden');
    if (elImportDropzone) elImportDropzone.classList.add('hidden');
    if (elBtnConfirmImport) elBtnConfirmImport.disabled = false;
  }

  function removeSelectedFile() {
    _importFile = null;
    if (elImportFileInput) elImportFileInput.value = '';
    if (elImportFileInfo) elImportFileInfo.classList.add('hidden');
    if (elImportDropzone) elImportDropzone.classList.remove('hidden');
    if (elBtnConfirmImport) elBtnConfirmImport.disabled = true;
  }

  async function executeImport() {
    if (!_importFile || !_currentProjectId) return;

    var modeRadio = document.querySelector('input[name="importMode"]:checked');
    var mode = modeRadio ? modeRadio.value : 'replace';

    var formData = new FormData();
    formData.append('file', _importFile);

    try {
      elBtnConfirmImport.disabled = true;
      elBtnConfirmImport.textContent = 'Importing...';

      var res = await window.NGM.api(
        '/timeline/projects/' + _currentProjectId + '/import?mode=' + mode,
        {
          method: 'POST',
          body: formData,
          raw: true
        }
      );

      if (!res || !res.ok) {
        var errText = '';
        try { var errData = await res.json(); errText = errData.detail || ''; } catch (_) {}
        throw new Error(errText || 'Import failed');
      }

      var result = await res.json();
      closeImportModal();

      if (window.Toast) {
        window.Toast.success(
          'Import Complete',
          (result.phases_imported || 0) + ' phases and ' + (result.milestones_imported || 0) + ' milestones imported'
        );
      }

      // Reload project data to reflect imported data
      await loadProjectData(_currentProjectId);

    } catch (err) {
      console.error('[TimelineManager] Import error:', err);
      if (window.Toast) window.Toast.error('Import Failed', err.message || 'Failed to import file');
    } finally {
      if (elBtnConfirmImport) {
        elBtnConfirmImport.disabled = false;
        elBtnConfirmImport.textContent = 'Import';
      }
    }
  }

  // ── View Mode Controls ─────────────────────────────────────────────

  function initViewControls() {
    var buttons = document.querySelectorAll('.tm-view-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        // Remove active class from all
        buttons.forEach(function (b) { b.classList.remove('tm-view-active'); });
        // Add to clicked
        btn.classList.add('tm-view-active');
        // Change view mode
        var mode = btn.getAttribute('data-view');
        _currentViewMode = mode;
        if (_gantt) {
          try {
            _gantt.change_view_mode(mode);
          } catch (err) {
            console.warn('[TimelineManager] change_view_mode error:', err);
          }
        }
      });
    });
  }

  // ── Event Binding ──────────────────────────────────────────────────

  function bindEvents() {
    // Project selection
    if (elProjectSelect) {
      elProjectSelect.addEventListener('change', function () {
        var projectId = elProjectSelect.value;
        loadProjectData(projectId);
      });
    }

    // Add Phase button
    if (elBtnAddPhase) {
      elBtnAddPhase.addEventListener('click', function () {
        openPhaseModal(null); // create mode
      });
    }

    // Phase modal close/cancel
    if (elBtnClosePhaseModal) {
      elBtnClosePhaseModal.addEventListener('click', closePhaseModal);
    }
    if (elBtnCancelPhase) {
      elBtnCancelPhase.addEventListener('click', closePhaseModal);
    }

    // Phase modal overlay click to close
    if (elPhaseModal) {
      elPhaseModal.addEventListener('click', function (e) {
        if (e.target === elPhaseModal) closePhaseModal();
      });
    }

    // Save Phase
    if (elBtnSavePhase) {
      elBtnSavePhase.addEventListener('click', function () {
        savePhase();
      });
    }

    // Add Milestone button
    if (elBtnAddMilestone) {
      elBtnAddMilestone.addEventListener('click', function () {
        openMilestoneModal(null); // create mode
      });
    }

    // Milestone modal close/cancel
    if (elBtnCloseMilestoneModal) {
      elBtnCloseMilestoneModal.addEventListener('click', closeMilestoneModal);
    }
    if (elBtnCancelMilestone) {
      elBtnCancelMilestone.addEventListener('click', closeMilestoneModal);
    }

    // Milestone modal overlay click to close
    if (elMilestoneModal) {
      elMilestoneModal.addEventListener('click', function (e) {
        if (e.target === elMilestoneModal) closeMilestoneModal();
      });
    }

    // Save Milestone
    if (elBtnSaveMilestone) {
      elBtnSaveMilestone.addEventListener('click', function () {
        saveMilestone();
      });
    }

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (elPhaseModal && !elPhaseModal.classList.contains('hidden')) {
          closePhaseModal();
        }
        if (elMilestoneModal && !elMilestoneModal.classList.contains('hidden')) {
          closeMilestoneModal();
        }
        if (elImportModal && !elImportModal.classList.contains('hidden')) {
          closeImportModal();
        }
      }
    });

    // View mode controls
    initViewControls();

    // Import button
    if (elBtnImportTimeline) {
      elBtnImportTimeline.addEventListener('click', function () {
        openImportModal();
      });
    }

    // Import modal close/cancel
    if (elBtnCloseImportModal) {
      elBtnCloseImportModal.addEventListener('click', closeImportModal);
    }
    if (elBtnCancelImport) {
      elBtnCancelImport.addEventListener('click', closeImportModal);
    }

    // Import modal overlay click
    if (elImportModal) {
      elImportModal.addEventListener('click', function (e) {
        if (e.target === elImportModal) closeImportModal();
      });
    }

    // Confirm import
    if (elBtnConfirmImport) {
      elBtnConfirmImport.addEventListener('click', function () {
        executeImport();
      });
    }

    // File input change
    if (elImportFileInput) {
      elImportFileInput.addEventListener('change', function () {
        if (elImportFileInput.files && elImportFileInput.files[0]) {
          handleFileSelected(elImportFileInput.files[0]);
        }
      });
    }

    // Remove file button
    if (elBtnRemoveFile) {
      elBtnRemoveFile.addEventListener('click', function () {
        removeSelectedFile();
      });
    }

    // Dropzone click to browse
    if (elImportDropzone) {
      elImportDropzone.addEventListener('click', function () {
        if (elImportFileInput) elImportFileInput.click();
      });

      // Drag and drop
      elImportDropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        elImportDropzone.classList.add('import-dropzone-active');
      });
      elImportDropzone.addEventListener('dragleave', function () {
        elImportDropzone.classList.remove('import-dropzone-active');
      });
      elImportDropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        elImportDropzone.classList.remove('import-dropzone-active');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }
  }

  // ── Init ───────────────────────────────────────────────────────────

  async function init() {
    cacheDom();
    bindEvents();
    await populateProjects();
  }

  // ── Cleanup on page unload ──────────────────────────────────────────
  window.addEventListener('beforeunload', function () {
    destroyGantt();
    if (_abortController) _abortController.abort();
  });

  // ── Bootstrap ──────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
