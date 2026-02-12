// assets/js/pb_scan_engine.js
// Scan Engine - OCR workflow manager for Project Builder
// Single-prompt architecture: selects layers, one API call, point-to-geometry conversion.
(function () {
  "use strict";

  var API = (window.NGM_CONFIG && window.NGM_CONFIG.API_BASE) || "";

  function authHeaders() {
    var t = localStorage.getItem("ngmToken");
    return t ? { Authorization: "Bearer " + t } : {};
  }

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };

  // ── State ──
  var _initialized = false;
  var _wallTypesCache = null;
  var _scalePixelDist = null;

  var _state = {
    foundationType: null,
    defaultWallType: null,
    storyCount: null,
    projectType: null,

    floorImages: {},
    activeFloor: "floor1",

    pixelsPerFoot: null,
    scaleConfidence: null,
    scaleManualOverride: false,
    imageWidthPx: 0,
    imageHeightPx: 0,

    selectedLayers: ["exterior_walls", "interior_walls", "doors", "windows"],
    analysisResult: null,
    analysisResults: {},    // { floor1: { raw API data }, floor2: {...} }
    acceptedFloors: {},     // { floor1: true, floor2: false }
    analyzing: false
  };


  // ════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════

  function init() {
    if (_initialized) return;
    _initialized = true;

    renderFoundationOptions();
    renderStoryOptions();
    renderProjectTypeOptions();
    loadWallTypeOptions();
    bindPredefsCollapse();
    bindLayerSelection();
    bindAnalysisButton();
    bindToolbar();
    bindLayerToggles();
    bindOverlayToggles();
    bindAcceptButton();
    bindExportButton();
    updateStepGating();
  }


  // ════════════════════════════════════════
  // PRE-DEFINITIONS (Option Cards)
  // ════════════════════════════════════════

  function renderFoundationOptions() {
    var el = $("#scanFoundationType");
    if (!el) return;
    var options = [
      { value: "slab", label: "Slab", sub: "Concrete slab-on-grade" },
      { value: "raised", label: "Raised", sub: "Wood frame crawlspace" },
      { value: "reinforced", label: "Reinforced", sub: "Post-tension / deep" }
    ];
    el.innerHTML = "";
    options.forEach(function (opt) {
      var card = document.createElement("div");
      card.className = "pb-scan-option-card";
      card.dataset.value = opt.value;
      card.innerHTML = '<span class="pb-scan-option-label">' + opt.label + '</span><span class="pb-scan-option-sub">' + opt.sub + '</span>';
      card.addEventListener("click", function () {
        el.querySelectorAll(".pb-scan-option-card").forEach(function (c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        _state.foundationType = opt.value;
        updateStepGating();
      });
      el.appendChild(card);
    });
  }

  function renderStoryOptions() {
    var el = $("#scanStoryCount");
    if (!el) return;
    el.innerHTML = "";
    [1, 2, 3].forEach(function (n) {
      var card = document.createElement("div");
      card.className = "pb-scan-option-card";
      card.dataset.value = n;
      card.innerHTML = '<span class="pb-scan-option-label">' + n + '</span><span class="pb-scan-option-sub">stor' + (n === 1 ? "y" : "ies") + '</span>';
      card.addEventListener("click", function () {
        el.querySelectorAll(".pb-scan-option-card").forEach(function (c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        _state.storyCount = n;
        renderUploadZones();
        updateStepGating();
      });
      el.appendChild(card);
    });
  }

  function renderProjectTypeOptions() {
    var el = $("#scanProjectType");
    if (!el) return;
    var options = [
      { value: "residential", label: "Residential", sub: "Single/multi family" },
      { value: "commercial", label: "Commercial", sub: "Office/retail" },
      { value: "industrial", label: "Industrial", sub: "Warehouse/manufacturing" }
    ];
    el.innerHTML = "";
    options.forEach(function (opt) {
      var card = document.createElement("div");
      card.className = "pb-scan-option-card";
      card.dataset.value = opt.value;
      card.innerHTML = '<span class="pb-scan-option-label">' + opt.label + '</span><span class="pb-scan-option-sub">' + opt.sub + '</span>';
      card.addEventListener("click", function () {
        el.querySelectorAll(".pb-scan-option-card").forEach(function (c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        _state.projectType = opt.value;
        updateStepGating();
      });
      el.appendChild(card);
    });
  }

  function bindPredefsCollapse() {
    var step = document.getElementById("scanStepPredefs");
    if (!step) return;
    // Add chevron to header
    var header = step.querySelector(".pb-scan-step-header");
    if (header) {
      var chevron = document.createElement("span");
      chevron.className = "pb-scan-step-chevron";
      chevron.innerHTML = "&#9662;";
      header.appendChild(chevron);
      header.addEventListener("click", function () {
        if (!step.classList.contains("collapsible")) return;
        step.classList.toggle("collapsed");
      });
    }
  }

  function updatePredefsCollapse() {
    var step = document.getElementById("scanStepPredefs");
    var summary = document.getElementById("scanPredefsSummary");
    if (!step || !summary) return;

    var done = _state.foundationType && _state.defaultWallType && _state.storyCount && _state.projectType;
    if (done) {
      step.classList.add("collapsible");
      // Auto-collapse only on the first completion
      if (!step.dataset.wasCollapsed) {
        step.classList.add("collapsed");
        step.dataset.wasCollapsed = "1";
      }
      // Build summary text
      var wallLabel = _state.defaultWallType || "";
      if (wallLabel.length > 30) wallLabel = wallLabel.substring(0, 28) + "...";
      summary.innerHTML =
        "<span>" + capitalize(_state.foundationType) + "</span> / " +
        "<span>" + wallLabel + "</span> / " +
        "<span>" + _state.storyCount + " stor" + (_state.storyCount === 1 ? "y" : "ies") + "</span> / " +
        "<span>" + capitalize(_state.projectType) + "</span>";
      summary.style.display = "";
    } else {
      step.classList.remove("collapsible", "collapsed");
      summary.style.display = "none";
    }
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

  async function loadWallTypeOptions() {
    var sel = $("#scanDefaultWallType");
    if (!sel) return;
    try {
      var res = await fetch(API + "/revit/definitions/wall_types", { headers: authHeaders() });
      if (!res.ok) return;
      var data = await res.json();
      _wallTypesCache = data;
      (data.wall_types || []).forEach(function (wt) {
        var opt = document.createElement("option");
        opt.value = wt.name;
        opt.textContent = wt.name + " (" + wt.function + ")";
        sel.appendChild(opt);
      });
    } catch (e) {}
    sel.addEventListener("change", function () {
      _state.defaultWallType = sel.value || null;
      updateStepGating();
    });
  }


  // ════════════════════════════════════════
  // UPLOAD
  // ════════════════════════════════════════

  function renderUploadZones() {
    var el = $("#scanUploads");
    if (!el) return;
    var count = _state.storyCount || 1;
    el.innerHTML = "";
    for (var i = 1; i <= count; i++) {
      var key = "floor" + i;
      var existing = _state.floorImages[key];
      if (existing) {
        var preview = document.createElement("div");
        preview.className = "pb-scan-upload-preview";
        preview.innerHTML = '<img src="' + existing.blobUrl + '" alt="Floor ' + i + '">' +
          '<div class="pb-scan-upload-preview-info"><span class="pb-scan-upload-preview-name">Floor ' + i + '</span>' +
          '<button type="button" class="pb-btn-remove" data-floor="' + key + '">x</button></div>';
        preview.querySelector(".pb-btn-remove").addEventListener("click", function (e) {
          removeImage(e.target.dataset.floor);
        });
        el.appendChild(preview);
      } else {
        var zone = document.createElement("div");
        zone.className = "pb-scan-upload-zone";
        zone.dataset.floor = key;
        zone.innerHTML = '<div class="pb-scan-upload-icon">+</div>' +
          '<div class="pb-scan-upload-label">Floor ' + i + '</div>' +
          '<div class="pb-scan-upload-hint">Click or drag a screenshot here</div>' +
          '<input type="file" accept="image/jpeg,image/png,image/webp">';
        bindUploadZone(zone, key);
        el.appendChild(zone);
      }
    }
  }

  function bindUploadZone(zone, floorKey) {
    var input = zone.querySelector("input[type='file']");
    zone.addEventListener("click", function (e) {
      if (e.target !== zone && !e.target.closest(".pb-scan-upload-icon, .pb-scan-upload-label, .pb-scan-upload-hint")) return;
      input.click();
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleFile(input.files[0], floorKey);
    });
    zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("dragover"); });
    zone.addEventListener("dragleave", function () { zone.classList.remove("dragover"); });
    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], floorKey);
    });
  }

  function handleFile(file, floorKey) {
    var allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.indexOf(file.type) === -1) {
      if (window.Toast) window.Toast.error("Only JPG, PNG, or WebP images allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (window.Toast) window.Toast.error("Max file size is 10MB");
      return;
    }
    // Clean up old blob
    if (_state.floorImages[floorKey] && _state.floorImages[floorKey].blobUrl) {
      URL.revokeObjectURL(_state.floorImages[floorKey].blobUrl);
    }
    var blobUrl = URL.createObjectURL(file);
    _state.floorImages[floorKey] = { file: file, blobUrl: blobUrl };

    // Reset downstream for this floor
    _state.analysisResult = null;
    delete _state.analysisResults[floorKey];
    _state.acceptedFloors[floorKey] = false;

    // Load image into canvas
    if (window.PBCanvas) {
      window.PBCanvas.init(document.getElementById("scanCanvasViewport"));
      window.PBCanvas.loadImage(blobUrl);
    }
    _state.activeFloor = floorKey;
    renderUploadZones();
    renderScaleTools();
    renderFloorTabs();
    updateStepGating();
  }

  function removeImage(floorKey) {
    if (_state.floorImages[floorKey]) {
      if (_state.floorImages[floorKey].blobUrl) URL.revokeObjectURL(_state.floorImages[floorKey].blobUrl);
      delete _state.floorImages[floorKey];
    }
    delete _state.analysisResults[floorKey];
    delete _state.acceptedFloors[floorKey];
    _state.analysisResult = null;
    _state.pixelsPerFoot = null;
    _state.scaleConfidence = null;
    _state.scaleManualOverride = false;
    renderUploadZones();
    renderFloorTabs();
    updateStepGating();
  }


  // ════════════════════════════════════════
  // STEP GATING
  // ════════════════════════════════════════

  function updateStepGating() {
    var predefsDone = _state.foundationType && _state.defaultWallType && _state.storyCount && _state.projectType;
    toggleStep("scanStepUpload", !!predefsDone);
    setBadge("scanStepPredefs", !!predefsDone);
    updatePredefsCollapse();

    var hasImage = Object.keys(_state.floorImages).some(function (k) { return !!_state.floorImages[k]; });
    toggleStep("scanStepLayers", hasImage);
    setBadge("scanStepUpload", hasImage);

    // Analysis button enabled when image + layers selected
    var hasLayers = _state.selectedLayers.length > 0;
    var btnRun = $("#btnRunAnalysis");
    if (btnRun) btnRun.disabled = !hasLayers || !hasImage || _state.analyzing;

    var analysisDone = _state.analysisResult != null;
    toggleStep("scanStepReview", analysisDone);
    setBadge("scanStepLayers", analysisDone);

    // Export only unlocks when ALL required floors are accepted
    var requiredCount = _state.storyCount || 1;
    var allAccepted = true;
    for (var i = 1; i <= requiredCount; i++) {
      var fk = "floor" + i;
      if (!_state.acceptedFloors[fk]) { allAccepted = false; break; }
    }
    toggleStep("scanStepExport", allAccepted);
    setBadge("scanStepReview", analysisDone);
    setBadge("scanStepExport", allAccepted);

    // Accept floor button state
    var btnAccept = $("#btnAcceptFloor");
    if (btnAccept) {
      var alreadyAccepted = _state.acceptedFloors[_state.activeFloor];
      btnAccept.disabled = !analysisDone || alreadyAccepted;
      btnAccept.textContent = alreadyAccepted ? "Floor Accepted" : "Accept Floor";
    }

    // Canvas visibility
    var canvasEl = $("#scanCanvasContainer");
    var wsEl = $("#scanWorkspace");
    if (canvasEl && wsEl) {
      if (hasImage) {
        canvasEl.style.display = "";
        wsEl.classList.add("has-canvas");
      } else {
        canvasEl.style.display = "none";
        wsEl.classList.remove("has-canvas");
      }
    }

    if (analysisDone) {
      renderReviewSummary();
      renderFloorStatus();
      renderSummary();
    }
  }

  function toggleStep(id, unlocked) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle("locked", !unlocked);
  }

  function setBadge(id, completed) {
    var el = document.getElementById(id);
    if (!el) return;
    var badge = el.querySelector(".pb-scan-step-badge");
    if (badge) badge.classList.toggle("completed", completed);
  }


  // ════════════════════════════════════════
  // LAYER SELECTION
  // ════════════════════════════════════════

  function bindLayerSelection() {
    var container = $("#scanLayerSelect");
    if (!container) return;
    container.addEventListener("change", function (e) {
      var input = e.target.closest("input[type='checkbox']");
      if (!input) return;
      _state.selectedLayers = [];
      container.querySelectorAll("input[type='checkbox']:checked").forEach(function (cb) {
        _state.selectedLayers.push(cb.value);
      });
      updateStepGating();
    });
  }


  // ════════════════════════════════════════
  // SCALE TOOLS
  // ════════════════════════════════════════

  function renderScaleTools() {
    var el = $("#scanScaleTools");
    if (!el) return;
    var html = '';

    // Current scale display
    if (_state.pixelsPerFoot) {
      html += '<div class="pb-scan-scale-result">Scale: <strong>' + _state.pixelsPerFoot.toFixed(1) + ' px/ft</strong>';
      if (_state.scaleConfidence) html += ' (conf: ' + Math.round(_state.scaleConfidence * 100) + '%)';
      if (_state.scaleManualOverride) html += ' (manual)';
      html += '</div>';
    }

    // Draw scale line tool
    html += '<div class="pb-scan-scale-row">' +
      '<button type="button" class="btn-toolbar btn-toolbar-secondary pb-scan-run-btn" id="btnDrawScaleLine">Draw Reference Line</button>' +
      '<input type="number" class="pb-scan-scale-input" id="scaleRefLength" placeholder="ft" step="0.1" min="0.1">' +
      '<span class="pb-scan-scale-unit">ft</span>' +
      '<button type="button" class="btn-toolbar btn-toolbar-primary pb-scan-run-btn" id="btnApplyScaleLine" style="display:none;">Apply</button>' +
      '</div>';

    // Direct px/ft input
    html += '<div class="pb-scan-scale-row">' +
      '<input type="number" class="pb-scan-scale-input" id="scaleDirectInput" placeholder="px/ft" step="0.1" min="0.1"' +
      (_state.pixelsPerFoot ? ' value="' + _state.pixelsPerFoot.toFixed(1) + '"' : '') + '>' +
      '<span class="pb-scan-scale-unit">px/ft</span>' +
      '<button type="button" class="btn-toolbar btn-toolbar-secondary pb-scan-run-btn" id="btnSetDirectScale">Set</button>' +
      '</div>';

    html += '<div class="pb-scan-scale-row" style="font-size:11px;color:#555;">Scale is also auto-detected during analysis.</div>';

    el.innerHTML = html;

    // Bind events
    var btnDraw = document.getElementById("btnDrawScaleLine");
    if (btnDraw) btnDraw.addEventListener("click", handleDrawScaleLine);

    var btnApply = document.getElementById("btnApplyScaleLine");
    if (btnApply) btnApply.addEventListener("click", handleApplyScaleLine);

    var btnDirect = document.getElementById("btnSetDirectScale");
    if (btnDirect) btnDirect.addEventListener("click", function () {
      var val = parseFloat(document.getElementById("scaleDirectInput").value);
      if (val && val > 0) {
        _state.pixelsPerFoot = val;
        _state.scaleManualOverride = true;
        _state.scaleConfidence = 1.0;
        renderScaleTools();
        updateScaleDisplay();
        updateStepGating();
      }
    });
  }

  function handleDrawScaleLine() {
    if (!window.PBCanvas) return;
    window.PBCanvas.enableScaleLineTool(function (pixelDist) {
      _scalePixelDist = pixelDist;
      var btnApply = document.getElementById("btnApplyScaleLine");
      if (btnApply) btnApply.style.display = "";
      var refInput = document.getElementById("scaleRefLength");
      if (refInput) refInput.focus();
    });
  }

  function handleApplyScaleLine() {
    var refLen = parseFloat(document.getElementById("scaleRefLength").value);
    if (!refLen || refLen <= 0 || !_scalePixelDist) return;
    _state.pixelsPerFoot = _scalePixelDist / refLen;
    _state.scaleManualOverride = true;
    _state.scaleConfidence = 1.0;
    renderScaleTools();
    updateScaleDisplay();
    updateStepGating();
  }

  function updateScaleDisplay() {
    var el = document.getElementById("scanScaleDisplay");
    if (el && _state.pixelsPerFoot) {
      el.textContent = "Scale: " + _state.pixelsPerFoot.toFixed(1) + " px/ft";
    }
  }


  // ════════════════════════════════════════
  // ANALYSIS (Single API Call)
  // ════════════════════════════════════════

  function bindAnalysisButton() {
    var btn = $("#btnRunAnalysis");
    if (btn) btn.addEventListener("click", handleRunAnalysis);
    var btnRerun = $("#btnRerunAnalysis");
    if (btnRerun) btnRerun.addEventListener("click", handleRunAnalysis);
  }

  async function handleRunAnalysis() {
    var floor = _state.floorImages[_state.activeFloor];
    if (!floor || !_state.selectedLayers.length) return;

    _state.analyzing = true;
    _state.analysisResult = null;
    updateStepGating();

    // Show progress
    var statusEl = document.getElementById("scanAnalysisStatus");
    if (statusEl) {
      statusEl.innerHTML = '<div class="pb-scan-analysis-progress">' +
        '<div class="pb-scan-analysis-spinner"></div>' +
        '<span>Analyzing ' + _state.selectedLayers.length + ' layers...</span></div>';
    }

    var formData = new FormData();
    formData.append("file", floor.file);
    formData.append("layers", _state.selectedLayers.join(","));

    // Build context from pre-definitions
    var ctx = [];
    if (_state.projectType) ctx.push(_state.projectType);
    if (_state.foundationType) ctx.push(_state.foundationType + " foundation");
    if (_state.storyCount) ctx.push(_state.storyCount + " stor" + (_state.storyCount === 1 ? "y" : "ies"));
    formData.append("context", ctx.join(", "));

    try {
      var res = await fetch(API + "/revit/ocr/analyze", {
        method: "POST",
        headers: authHeaders(),
        body: formData
      });
      if (!res.ok) {
        var errData = await res.json().catch(function () { return {}; });
        throw new Error(errData.detail || "API error " + res.status);
      }
      var json = await res.json();
      var data = json.data;

      _state.analysisResult = data;
      _state.analysisResults[_state.activeFloor] = data;
      _state.acceptedFloors[_state.activeFloor] = false;
      _state.imageWidthPx = data.image_width_px || 0;
      _state.imageHeightPx = data.image_height_px || 0;

      // Apply auto-detected scale unless user has manual override
      if (!_state.scaleManualOverride && data.scale && data.scale.detected && data.scale.pixels_per_foot) {
        _state.pixelsPerFoot = data.scale.pixels_per_foot;
        _state.scaleConfidence = data.scale.confidence;
      }

      // Render raw OCR points overlay
      if (window.PBCanvas && data.layers) {
        window.PBCanvas.setRawPoints(data.layers);
      }

      // Convert points to geometry and render vector overlay
      processAnalysisResult(data);

      var totalPoints = 0;
      var layers = data.layers || {};
      Object.keys(layers).forEach(function (k) {
        totalPoints += (layers[k].points || []).length;
      });

      if (statusEl) {
        statusEl.innerHTML = '<div class="pb-scan-analysis-progress" style="color:#3ecf8e;">' +
          '<span>' + totalPoints + ' points detected across ' + Object.keys(layers).length + ' layers</span></div>';
      }
      if (window.Toast) window.Toast.success("Analysis complete: " + totalPoints + " points");

      renderScaleTools();
      updateScaleDisplay();

    } catch (e) {
      if (statusEl) {
        statusEl.innerHTML = '<div class="pb-scan-analysis-progress" style="color:#ef4444;">' +
          '<span>Analysis failed: ' + e.message + '</span></div>';
      }
      if (window.Toast) window.Toast.error("Analysis failed: " + e.message);
    }

    _state.analyzing = false;
    updateStepGating();
  }


  // ════════════════════════════════════════
  // POINT -> GEOMETRY CONVERSION
  // ════════════════════════════════════════

  function processAnalysisResult(data) {
    var layers = data.layers || {};
    if (!window.PBCanvas) return;

    // -- Exterior Walls: ordered corners -> connected wall segments --
    var allWallSegments = [];

    if (layers.exterior_walls && layers.exterior_walls.points && layers.exterior_walls.points.length >= 2) {
      var extPts = layers.exterior_walls.points.slice();
      extPts.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

      for (var i = 0; i < extPts.length; i++) {
        var next = (i + 1) % extPts.length;
        allWallSegments.push({
          start: [extPts[i].x, extPts[i].y],
          end: [extPts[next].x, extPts[next].y],
          wall_category: "exterior",
          structural: false,
          confidence: layers.exterior_walls.confidence || 0
        });
      }
    }

    // -- Interior Walls: paired start/end points --
    if (layers.interior_walls && layers.interior_walls.points && layers.interior_walls.points.length >= 2) {
      var intPts = layers.interior_walls.points;
      var pairs = {};
      intPts.forEach(function (pt) {
        var pairKey = pt.pair || 0;
        if (!pairs[pairKey]) pairs[pairKey] = {};
        if (pt.tag === "start") pairs[pairKey].start = pt;
        if (pt.tag === "end") pairs[pairKey].end = pt;
      });
      Object.keys(pairs).forEach(function (k) {
        var pair = pairs[k];
        if (pair.start && pair.end) {
          allWallSegments.push({
            start: [pair.start.x, pair.start.y],
            end: [pair.end.x, pair.end.y],
            wall_category: "interior",
            structural: false,
            confidence: layers.interior_walls.confidence || 0
          });
        }
      });
    }

    if (allWallSegments.length) {
      window.PBCanvas.setWalls(allWallSegments);
    }

    // -- Doors: single point -> center + type + rotation --
    if (layers.doors && layers.doors.points && layers.doors.points.length > 0) {
      var doorData = layers.doors.points.map(function (pt) {
        return {
          center: [pt.x, pt.y],
          door_type: pt.tag || "single",
          swing_direction_deg: facingToDeg(pt.facing),
          width_px: 40,
          confidence: layers.doors.confidence || 0
        };
      });
      window.PBCanvas.setDoors(doorData);
    }

    // -- Windows: single point -> center + type + rotation --
    if (layers.windows && layers.windows.points && layers.windows.points.length > 0) {
      var windowData = layers.windows.points.map(function (pt) {
        return {
          center: [pt.x, pt.y],
          window_type: pt.tag || "fixed",
          orientation_deg: wallSideToDeg(pt.wall_side),
          width_px: 50,
          confidence: layers.windows.confidence || 0
        };
      });
      window.PBCanvas.setWindows(windowData);
    }

    // -- Plumbing: point markers --
    if (layers.plumbing && layers.plumbing.points && layers.plumbing.points.length > 0) {
      window.PBCanvas.setPoints("plumbing", layers.plumbing.points);
    }

    // -- Kitchen: point markers --
    if (layers.kitchen && layers.kitchen.points && layers.kitchen.points.length > 0) {
      window.PBCanvas.setPoints("kitchen", layers.kitchen.points);
    }
  }

  function facingToDeg(facing) {
    var map = { north: 270, south: 90, east: 0, west: 180 };
    return map[(facing || "").toLowerCase()] || 0;
  }

  function wallSideToDeg(wallSide) {
    var map = { north: 0, south: 0, east: 90, west: 90 };
    return map[(wallSide || "").toLowerCase()] || 0;
  }


  // ════════════════════════════════════════
  // REVIEW SUMMARY
  // ════════════════════════════════════════

  function renderReviewSummary() {
    var el = document.getElementById("scanReviewSummary");
    if (!el || !_state.analysisResult) return;

    var layers = _state.analysisResult.layers || {};
    var colorMap = {
      exterior_walls: "#3ecf8e",
      interior_walls: "#60a5fa",
      doors: "#f97316",
      windows: "#06b6d4",
      plumbing: "#a855f7",
      kitchen: "#f59e0b"
    };
    var labelMap = {
      exterior_walls: "Exterior Walls",
      interior_walls: "Interior Walls",
      doors: "Doors",
      windows: "Windows",
      plumbing: "Plumbing",
      kitchen: "Kitchen"
    };

    var html = "";
    _state.selectedLayers.forEach(function (layerName) {
      var ld = layers[layerName];
      var count = ld ? (ld.points || []).length : 0;
      var conf = ld ? Math.round((ld.confidence || 0) * 100) : 0;
      var color = colorMap[layerName] || "#888";
      var label = labelMap[layerName] || layerName;
      html += '<div class="pb-scan-review-layer">';
      html += '<span><span class="pb-scan-review-dot" style="background:' + color + ';"></span>' + label + '</span>';
      html += '<span><span class="pb-scan-review-count">' + count + ' pts</span>';
      html += '<span class="pb-scan-review-conf">' + conf + '% conf</span></span>';
      html += '</div>';
    });

    // Scale info
    var scale = _state.analysisResult.scale || {};
    if (scale.detected) {
      html += '<div class="pb-scan-review-layer">';
      html += '<span>Scale</span>';
      html += '<span><span class="pb-scan-review-count">' + (scale.pixels_per_foot || 0).toFixed(1) + ' px/ft</span>';
      html += '<span class="pb-scan-review-conf">' + Math.round((scale.confidence || 0) * 100) + '% conf</span></span>';
      html += '</div>';
    }

    el.innerHTML = html;
  }


  // ════════════════════════════════════════
  // TOOLBAR & LAYER VISIBILITY
  // ════════════════════════════════════════

  function bindToolbar() {
    var btnSelect = $("#btnToolSelect");
    var btnPan = $("#btnToolPan");
    if (btnSelect) btnSelect.addEventListener("click", function () {
      if (window.PBCanvas) window.PBCanvas.setMode("select");
      if (btnSelect) btnSelect.classList.add("active");
      if (btnPan) btnPan.classList.remove("active");
    });
    if (btnPan) btnPan.addEventListener("click", function () {
      if (window.PBCanvas) window.PBCanvas.setMode("pan");
      if (btnPan) btnPan.classList.add("active");
      if (btnSelect) btnSelect.classList.remove("active");
    });

    var btnZoomIn = $("#btnZoomIn");
    var btnZoomOut = $("#btnZoomOut");
    var btnZoomFit = $("#btnZoomFit");
    if (btnZoomIn) btnZoomIn.addEventListener("click", function () { if (window.PBCanvas) window.PBCanvas.zoomIn(); });
    if (btnZoomOut) btnZoomOut.addEventListener("click", function () { if (window.PBCanvas) window.PBCanvas.zoomOut(); });
    if (btnZoomFit) btnZoomFit.addEventListener("click", function () { if (window.PBCanvas) window.PBCanvas.zoomFit(); });

    var btnRotate = $("#btnRotateEl");
    var btnDelete = $("#btnDeleteEl");
    if (btnRotate) btnRotate.addEventListener("click", function () { if (window.PBCanvas) window.PBCanvas.rotateSelected(); });
    if (btnDelete) btnDelete.addEventListener("click", function () { if (window.PBCanvas) window.PBCanvas.deleteSelected(); });
  }

  function bindLayerToggles() {
    var toggles = $("#scanLayerToggles");
    if (!toggles) return;
    toggles.addEventListener("change", function (e) {
      var cb = e.target.closest("input[data-layer]");
      if (!cb || !window.PBCanvas) return;
      window.PBCanvas.toggleLayerVisibility(cb.dataset.layer, cb.checked);
    });
  }

  function bindOverlayToggles() {
    var container = document.querySelector(".pb-scan-overlay-toggles");
    if (!container) return;
    container.addEventListener("change", function (e) {
      var cb = e.target.closest("input[data-overlay]");
      if (!cb || !window.PBCanvas) return;
      window.PBCanvas.toggleOverlay(cb.dataset.overlay, cb.checked);
    });
  }


  // ════════════════════════════════════════
  // FLOOR TABS + MULTI-LEVEL ACCEPTANCE
  // ════════════════════════════════════════

  function renderFloorTabs() {
    var el = document.getElementById("scanFloorTabs");
    if (!el) return;
    var count = _state.storyCount || 1;
    if (count <= 1) { el.style.display = "none"; return; }

    el.style.display = "";
    el.innerHTML = "";
    for (var i = 1; i <= count; i++) {
      var key = "floor" + i;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pb-scan-floor-tab" + (key === _state.activeFloor ? " active" : "");
      btn.dataset.floor = key;

      // Status dot
      var statusClass = "pending";
      if (_state.acceptedFloors[key]) statusClass = "accepted";
      else if (_state.analysisResults[key]) statusClass = "analyzed";

      btn.innerHTML = "Floor " + i + ' <span class="floor-status ' + statusClass + '"></span>';
      btn.addEventListener("click", (function (fk) {
        return function () { switchFloor(fk); };
      })(key));
      el.appendChild(btn);
    }
  }

  function switchFloor(floorKey) {
    if (floorKey === _state.activeFloor) return;
    if (!_state.floorImages[floorKey]) return;

    _state.activeFloor = floorKey;
    _state.analysisResult = _state.analysisResults[floorKey] || null;

    // Load floor image into canvas
    if (window.PBCanvas) {
      window.PBCanvas.init(document.getElementById("scanCanvasViewport"));
      window.PBCanvas.loadImage(_state.floorImages[floorKey].blobUrl).then(function () {
        // Re-render overlays if this floor has results
        if (_state.analysisResult) {
          if (_state.analysisResult.layers) {
            window.PBCanvas.setRawPoints(_state.analysisResult.layers);
          }
          processAnalysisResult(_state.analysisResult);
        }
      });
    }

    // Restore scale for this floor
    if (_state.analysisResult && _state.analysisResult.scale && _state.analysisResult.scale.detected && !_state.scaleManualOverride) {
      _state.pixelsPerFoot = _state.analysisResult.scale.pixels_per_foot;
      _state.scaleConfidence = _state.analysisResult.scale.confidence;
    }

    renderFloorTabs();
    renderScaleTools();
    updateScaleDisplay();
    updateStepGating();
  }

  function bindAcceptButton() {
    var btn = $("#btnAcceptFloor");
    if (!btn) return;
    btn.addEventListener("click", handleAcceptFloor);
  }

  function handleAcceptFloor() {
    if (!_state.analysisResult) return;
    _state.acceptedFloors[_state.activeFloor] = true;
    renderFloorTabs();
    renderFloorStatus();
    updateStepGating();
    if (window.Toast) window.Toast.success("Floor accepted");

    // Auto-switch to next unaccepted floor if any
    var count = _state.storyCount || 1;
    for (var i = 1; i <= count; i++) {
      var key = "floor" + i;
      if (!_state.acceptedFloors[key] && _state.floorImages[key]) {
        switchFloor(key);
        return;
      }
    }
  }

  function renderFloorStatus() {
    var el = document.getElementById("scanFloorStatus");
    if (!el) return;
    var count = _state.storyCount || 1;
    if (count <= 1 && !_state.analysisResult) { el.innerHTML = ""; return; }

    var html = "";
    for (var i = 1; i <= count; i++) {
      var key = "floor" + i;
      var accepted = _state.acceptedFloors[key];
      var analyzed = !!_state.analysisResults[key];
      var hasImg = !!_state.floorImages[key];

      var statusText = "Not uploaded";
      var badgeClass = "pending-badge";
      if (accepted) { statusText = "Accepted"; badgeClass = "accepted-badge"; }
      else if (analyzed) { statusText = "Pending review"; badgeClass = "pending-badge"; }
      else if (hasImg) { statusText = "Ready to analyze"; badgeClass = "pending-badge"; }

      html += '<div class="pb-scan-floor-status-row">';
      html += '<span>Floor ' + i + '</span>';
      html += '<span class="' + badgeClass + '">' + statusText + '</span>';
      html += '</div>';
    }
    el.innerHTML = html;
  }


  // ════════════════════════════════════════
  // EXPORT
  // ════════════════════════════════════════

  function renderSummary() {
    var el = $("#scanSummary");
    if (!el) return;
    var elements = window.PBCanvas ? window.PBCanvas.getAllElements() : { walls: [], doors: [], windows: [], plumbing: [], kitchen: [] };
    var extWalls = elements.walls.filter(function (w) { return w.category === "exterior"; }).length;
    var intWalls = elements.walls.filter(function (w) { return w.category === "interior"; }).length;
    var html = '';
    html += '<div class="pb-scan-summary-row"><span>Exterior walls</span><span>' + extWalls + '</span></div>';
    html += '<div class="pb-scan-summary-row"><span>Interior walls</span><span>' + intWalls + '</span></div>';
    html += '<div class="pb-scan-summary-row"><span>Doors</span><span>' + elements.doors.length + '</span></div>';
    html += '<div class="pb-scan-summary-row"><span>Windows</span><span>' + elements.windows.length + '</span></div>';
    if (elements.plumbing && elements.plumbing.length) {
      html += '<div class="pb-scan-summary-row"><span>Plumbing fixtures</span><span>' + elements.plumbing.length + '</span></div>';
    }
    if (elements.kitchen && elements.kitchen.length) {
      html += '<div class="pb-scan-summary-row"><span>Kitchen fixtures</span><span>' + elements.kitchen.length + '</span></div>';
    }
    if (_state.pixelsPerFoot) {
      var pxToFt = 1.0 / _state.pixelsPerFoot;
      var totalWallLen = 0;
      elements.walls.forEach(function (w) {
        var dx = (w.end[0] - w.start[0]) * pxToFt;
        var dy = (w.end[1] - w.start[1]) * pxToFt;
        totalWallLen += Math.sqrt(dx * dx + dy * dy);
      });
      html += '<div class="pb-scan-summary-row"><span>Total wall length</span><span>' + totalWallLen.toFixed(1) + ' ft</span></div>';
    }
    el.innerHTML = html;
  }

  function bindExportButton() {
    var btn = $("#btnPushToManifest");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var data = exportToManifest();
      if (!data) {
        if (window.Toast) window.Toast.error("No data to export. Complete analysis first.");
        return;
      }
      if (window.PBManifest) {
        window.PBManifest.mergeScanData(data);
        if (window.Toast) window.Toast.success("Scan data pushed to manifest.");
        var exportTab = document.querySelector('.pb-tab[data-tab="export"]');
        if (exportTab) exportTab.click();
      }
    });
  }

  function exportToManifest() {
    if (!_state.pixelsPerFoot || _state.pixelsPerFoot <= 0) return null;
    var pxToFt = 1.0 / _state.pixelsPerFoot;

    var doorFamilyMap = { single: "NGM_Door_Single", double: "NGM_Door_Double", sliding: "NGM_Door_Sliding", pocket: "NGM_Door_Pocket" };
    var windowFamilyMap = { fixed: "NGM_Window_Fixed", sliding: "NGM_Window_Sliding", casement: "NGM_Window_Casement" };
    var plumbingFamilyMap = { toilet: "NGM_Plumbing_Toilet", sink: "NGM_Plumbing_Sink", shower: "NGM_Plumbing_Shower", bathtub: "NGM_Plumbing_Bathtub", washer_hookup: "NGM_Plumbing_WasherHookup" };
    var kitchenFamilyMap = { sink: "NGM_Kitchen_Sink", stove: "NGM_Kitchen_Stove", refrigerator: "NGM_Kitchen_Refrigerator", dishwasher: "NGM_Kitchen_Dishwasher", island: "NGM_Kitchen_Island", counter: "NGM_Kitchen_Counter" };

    var allWalls = [];
    var allFixtures = [];
    var allFloors = [];

    // Iterate all accepted floors
    var count = _state.storyCount || 1;
    for (var fi = 1; fi <= count; fi++) {
      var floorKey = "floor" + fi;
      if (!_state.acceptedFloors[floorKey]) continue;
      var data = _state.analysisResults[floorKey];
      if (!data || !data.layers) continue;

      var levelName = "Level " + fi;
      var layers = data.layers;

      // Build walls from raw points for this level
      var levelWalls = [];
      if (layers.exterior_walls && layers.exterior_walls.points && layers.exterior_walls.points.length >= 2) {
        var extPts = layers.exterior_walls.points.slice();
        extPts.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        for (var i = 0; i < extPts.length; i++) {
          var next = (i + 1) % extPts.length;
          levelWalls.push({
            type: _state.defaultWallType || "Generic Wall",
            level: levelName,
            start: [round4(extPts[i].x * pxToFt), round4(extPts[i].y * pxToFt)],
            end: [round4(extPts[next].x * pxToFt), round4(extPts[next].y * pxToFt)],
            structural: false
          });
        }
      }
      if (layers.interior_walls && layers.interior_walls.points && layers.interior_walls.points.length >= 2) {
        var pairs = {};
        layers.interior_walls.points.forEach(function (pt) {
          var pk = pt.pair || 0;
          if (!pairs[pk]) pairs[pk] = {};
          if (pt.tag === "start") pairs[pk].start = pt;
          if (pt.tag === "end") pairs[pk].end = pt;
        });
        Object.keys(pairs).forEach(function (k) {
          var pair = pairs[k];
          if (pair.start && pair.end) {
            levelWalls.push({
              type: _state.defaultWallType || "Generic Wall",
              level: levelName,
              start: [round4(pair.start.x * pxToFt), round4(pair.start.y * pxToFt)],
              end: [round4(pair.end.x * pxToFt), round4(pair.end.y * pxToFt)],
              structural: false
            });
          }
        });
      }
      allWalls = allWalls.concat(levelWalls);

      // Doors
      if (layers.doors && layers.doors.points) {
        layers.doors.points.forEach(function (pt) {
          var ptFt = [round4(pt.x * pxToFt), round4(pt.y * pxToFt)];
          allFixtures.push({
            family: doorFamilyMap[pt.tag] || "NGM_Door_Single",
            type: '3\'-0" x 7\'-0"',
            point: ptFt,
            level: levelName,
            host_wall_index: findNearestWall(ptFt, levelWalls),
            rotation_deg: facingToDeg(pt.facing)
          });
        });
      }

      // Windows
      if (layers.windows && layers.windows.points) {
        layers.windows.points.forEach(function (pt) {
          var ptFt = [round4(pt.x * pxToFt), round4(pt.y * pxToFt)];
          allFixtures.push({
            family: windowFamilyMap[pt.tag] || "NGM_Window_Fixed",
            type: '3\'-0" x 4\'-0"',
            point: ptFt,
            level: levelName,
            host_wall_index: findNearestWall(ptFt, levelWalls),
            rotation_deg: wallSideToDeg(pt.wall_side)
          });
        });
      }

      // Plumbing
      if (layers.plumbing && layers.plumbing.points) {
        layers.plumbing.points.forEach(function (pt) {
          allFixtures.push({
            family: plumbingFamilyMap[pt.tag] || "NGM_Plumbing_Generic",
            type: "Standard",
            point: [round4(pt.x * pxToFt), round4(pt.y * pxToFt)],
            level: levelName,
            host_wall_index: null,
            rotation_deg: 0
          });
        });
      }

      // Kitchen
      if (layers.kitchen && layers.kitchen.points) {
        layers.kitchen.points.forEach(function (pt) {
          allFixtures.push({
            family: kitchenFamilyMap[pt.tag] || "NGM_Kitchen_Generic",
            type: "Standard",
            point: [round4(pt.x * pxToFt), round4(pt.y * pxToFt)],
            level: levelName,
            host_wall_index: null,
            rotation_deg: 0
          });
        });
      }

      // Floor boundary from exterior corners
      if (layers.exterior_walls && layers.exterior_walls.points && layers.exterior_walls.points.length > 2) {
        var floorPts = layers.exterior_walls.points.slice();
        floorPts.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        allFloors.push({
          type: 'Generic Floor - 4"',
          level: levelName,
          boundary: floorPts.map(function (pt) {
            return [round4(pt.x * pxToFt), round4(pt.y * pxToFt)];
          })
        });
      }
    }

    if (!allWalls.length && !allFixtures.length) return null;

    return {
      scan_meta: {
        project_type: _state.projectType,
        foundation_type: _state.foundationType,
        story_count: _state.storyCount,
        pixels_per_foot: _state.pixelsPerFoot,
        created_by: "ocr_scan"
      },
      walls: allWalls,
      fixtures: allFixtures,
      floors: allFloors
    };
  }


  // ════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════

  function findNearestWall(ptFt, walls) {
    if (!walls.length) return null;
    var minD = Infinity;
    var idx = null;
    walls.forEach(function (w, i) {
      var d = ptSegDist(ptFt[0], ptFt[1], w.start[0], w.start[1], w.end[0], w.end[1]);
      if (d < minD) { minD = d; idx = i; }
    });
    return idx;
  }

  function ptSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    var projX = x1 + t * dx, projY = y1 + t * dy;
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  function round4(n) {
    return Math.round(n * 10000) / 10000;
  }


  // ── Public API ──
  window.PBScanEngine = {
    init: init,
    getState: function () { return _state; },
    exportToManifest: exportToManifest
  };
})();
