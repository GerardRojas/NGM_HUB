// assets/js/pb_canvas.js
// SVG Canvas Engine for Project Builder Scan tab
// Manages image display, SVG overlay, pan/zoom, and interactive element editing.
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  // ── DOM refs ──
  var _viewport = null;
  var _img = null;
  var _svg = null;
  var _imgW = 0, _imgH = 0;

  // ── Transform state ──
  var _zoom = 1.0;
  var _panX = 0, _panY = 0;
  var _minZoom = 0.1, _maxZoom = 12;

  // ── Interaction ──
  var _mode = "select"; // "select" | "pan" | "scale_line"
  var _mouseDown = false;
  var _dragStart = null;
  var _panOrigin = null;
  var _draggingEl = null;
  var _draggingOffset = null;
  var _selectedId = null;

  // ── Scale line tool ──
  var _scalePt1 = null;
  var _scalePt2 = null;
  var _scaleLineCallback = null;

  // ── Layers ──
  var _groups = {};
  var _nextId = 1;

  // ── Element stores ──
  var _walls = [];
  var _doors = [];
  var _windows = [];
  var _plumbing = [];
  var _kitchen = [];
  var _rawPoints = [];

  // ── Callbacks ──
  var _onSelect = null;
  var _onMove = null;
  var _onDelete = null;

  // ══════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════
  window.PBCanvas = {
    init: init,
    loadImage: loadImage,
    setMode: setMode,
    getMode: function () { return _mode; },

    // Render OCR results
    setWalls: setWalls,
    setDoors: setDoors,
    setWindows: setWindows,
    setPoints: setPoints,
    setRawPoints: setRawPoints,
    clearRawPoints: clearRawPoints,
    clearLayer: clearLayer,
    toggleLayerVisibility: toggleLayerVisibility,
    toggleOverlay: toggleOverlay,
    setImageFilter: setImageFilter,

    // Element interaction
    selectElement: selectElement,
    deselectAll: deselectAll,
    deleteSelected: deleteSelected,
    rotateSelected: rotateSelected,
    getSelectedElement: getSelectedElement,

    // Scale line
    enableScaleLineTool: enableScaleLineTool,

    // Data export
    getAllElements: getAllElements,

    // Zoom
    zoomIn: function () { applyZoom(_zoom * 1.3, _viewport.clientWidth / 2, _viewport.clientHeight / 2); },
    zoomOut: function () { applyZoom(_zoom / 1.3, _viewport.clientWidth / 2, _viewport.clientHeight / 2); },
    zoomFit: zoomFit,
    getZoom: function () { return _zoom; },

    // Hooks
    onSelect: function (fn) { _onSelect = fn; },
    onMove: function (fn) { _onMove = fn; },
    onDelete: function (fn) { _onDelete = fn; },

    destroy: destroy
  };

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  function init(viewportEl) {
    _viewport = viewportEl;
    _viewport.innerHTML = "";

    _img = document.createElement("img");
    _img.className = "pb-scan-img";
    _img.draggable = false;
    _viewport.appendChild(_img);

    _svg = document.createElementNS(NS, "svg");
    _svg.classList.add("pb-scan-svg");
    _viewport.appendChild(_svg);

    // Layer groups (render order)
    ["scaleLine", "ocrRawPoints", "walls", "doors", "windows", "plumbing", "kitchen"].forEach(function (key) {
      var g = document.createElementNS(NS, "g");
      g.setAttribute("data-layer", key);
      _svg.appendChild(g);
      _groups[key] = g;
    });

    // Event bindings
    _viewport.addEventListener("wheel", onWheel, { passive: false });
    _viewport.addEventListener("mousedown", onMouseDown);
    _viewport.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keydown", onKeyDown);
  }

  function destroy() {
    if (_viewport) {
      _viewport.removeEventListener("wheel", onWheel);
      _viewport.removeEventListener("mousedown", onMouseDown);
    }
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("keydown", onKeyDown);
    _walls = []; _doors = []; _windows = []; _plumbing = []; _kitchen = []; _rawPoints = [];
    _selectedId = null;
    _viewport = null;
    _img = null;
    _svg = null;
  }

  // ══════════════════════════════════════
  // IMAGE LOADING
  // ══════════════════════════════════════
  function loadImage(blobUrl) {
    return new Promise(function (resolve) {
      _img.onload = function () {
        _imgW = _img.naturalWidth;
        _imgH = _img.naturalHeight;
        _img.style.width = _imgW + "px";
        _img.style.height = _imgH + "px";
        _svg.setAttribute("width", _imgW);
        _svg.setAttribute("height", _imgH);
        _svg.setAttribute("viewBox", "0 0 " + _imgW + " " + _imgH);
        zoomFit();
        resolve({ width: _imgW, height: _imgH });
      };
      _img.style.filter = "grayscale(1) brightness(0.4)";
      _img.src = blobUrl;
    });
  }

  function setImageFilter(grayscale, brightness) {
    if (!_img) return;
    _img.style.filter = "grayscale(" + (grayscale ? 1 : 0) + ") brightness(" + brightness + ")";
  }

  // ══════════════════════════════════════
  // PAN & ZOOM
  // ══════════════════════════════════════
  function applyTransform() {
    var t = "translate(" + _panX + "px," + _panY + "px) scale(" + _zoom + ")";
    _img.style.transform = t;
    _svg.style.transform = t;
    updateZoomLabel();
    updateCoordDisplay(null, null);
  }

  function applyZoom(newZoom, cx, cy) {
    newZoom = Math.max(_minZoom, Math.min(_maxZoom, newZoom));
    // Zoom toward cursor
    var ratio = newZoom / _zoom;
    _panX = cx - ratio * (cx - _panX);
    _panY = cy - ratio * (cy - _panY);
    _zoom = newZoom;
    applyTransform();
  }

  function zoomFit() {
    if (!_viewport || !_imgW) return;
    var vw = _viewport.clientWidth;
    var vh = _viewport.clientHeight;
    var scaleX = vw / _imgW;
    var scaleY = vh / _imgH;
    _zoom = Math.min(scaleX, scaleY) * 0.95;
    _panX = (vw - _imgW * _zoom) / 2;
    _panY = (vh - _imgH * _zoom) / 2;
    applyTransform();
  }

  function screenToImage(sx, sy) {
    var rect = _viewport.getBoundingClientRect();
    var lx = sx - rect.left;
    var ly = sy - rect.top;
    return {
      x: (lx - _panX) / _zoom,
      y: (ly - _panY) / _zoom
    };
  }

  function updateZoomLabel() {
    var el = document.getElementById("scanZoomLabel");
    if (el) el.textContent = Math.round(_zoom * 100) + "%";
  }

  function updateCoordDisplay(imgX, imgY) {
    var el = document.getElementById("scanCoordDisplay");
    if (!el) return;
    if (imgX === null) { el.textContent = "-- , --"; return; }
    el.textContent = Math.round(imgX) + " , " + Math.round(imgY) + " px";
  }

  // ══════════════════════════════════════
  // MODE
  // ══════════════════════════════════════
  function setMode(m) {
    _mode = m;
    _viewport.classList.remove("panning", "crosshair");
    if (m === "pan") _viewport.classList.add("panning");
    if (m === "scale_line") _viewport.classList.add("crosshair");
    // Update toolbar active states
    var btnSelect = document.getElementById("btnToolSelect");
    var btnPan = document.getElementById("btnToolPan");
    if (btnSelect) btnSelect.classList.toggle("active", m === "select");
    if (btnPan) btnPan.classList.toggle("active", m === "pan");
  }

  // ══════════════════════════════════════
  // MOUSE EVENTS
  // ══════════════════════════════════════
  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    var rect = _viewport.getBoundingClientRect();
    applyZoom(_zoom * factor, e.clientX - rect.left, e.clientY - rect.top);
  }

  function onMouseDown(e) {
    if (e.button === 1) { // middle click = pan
      e.preventDefault();
      _mouseDown = true;
      _panOrigin = { x: e.clientX - _panX, y: e.clientY - _panY };
      _viewport.classList.add("panning");
      return;
    }
    if (e.button !== 0) return;

    var imgPt = screenToImage(e.clientX, e.clientY);

    // Scale line mode
    if (_mode === "scale_line") {
      handleScaleLineClick(imgPt);
      return;
    }

    // Pan mode
    if (_mode === "pan") {
      _mouseDown = true;
      _panOrigin = { x: e.clientX - _panX, y: e.clientY - _panY };
      _viewport.classList.add("panning");
      return;
    }

    // Select mode - check if clicking an element
    var svgTarget = findElementAt(e);
    if (svgTarget) {
      selectElement(svgTarget.id);
      // Start drag
      _draggingEl = svgTarget;
      _draggingOffset = { x: imgPt.x - svgTarget.cx, y: imgPt.y - svgTarget.cy };
      _mouseDown = true;
      return;
    }

    // Clicked empty space - deselect and start pan
    deselectAll();
    _mouseDown = true;
    _panOrigin = { x: e.clientX - _panX, y: e.clientY - _panY };
  }

  function onMouseMove(e) {
    if (!_viewport) return;
    var imgPt = screenToImage(e.clientX, e.clientY);
    if (imgPt.x >= 0 && imgPt.x <= _imgW && imgPt.y >= 0 && imgPt.y <= _imgH) {
      updateCoordDisplay(imgPt.x, imgPt.y);
    }

    if (!_mouseDown) return;

    // Dragging an element
    if (_draggingEl) {
      var nx = imgPt.x - _draggingOffset.x;
      var ny = imgPt.y - _draggingOffset.y;
      moveElement(_draggingEl, nx, ny);
      return;
    }

    // Panning
    if (_panOrigin) {
      _panX = e.clientX - _panOrigin.x;
      _panY = e.clientY - _panOrigin.y;
      applyTransform();
    }
  }

  function onMouseUp(e) {
    if (_draggingEl) {
      if (_onMove) _onMove(_draggingEl);
      _draggingEl = null;
      _draggingOffset = null;
    }
    _mouseDown = false;
    _panOrigin = null;
    if (_mode !== "pan") _viewport.classList.remove("panning");
  }

  function onKeyDown(e) {
    if (!_viewport) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      if (_selectedId && document.activeElement.tagName !== "INPUT") {
        e.preventDefault();
        deleteSelected();
      }
    }
    if (e.key === "r" || e.key === "R") {
      if (_selectedId && document.activeElement.tagName !== "INPUT") {
        rotateSelected();
      }
    }
    if (e.key === "Escape") {
      deselectAll();
      if (_mode === "scale_line") { setMode("select"); _scalePt1 = null; _scalePt2 = null; }
    }
  }

  // ══════════════════════════════════════
  // ELEMENT HIT TESTING
  // ══════════════════════════════════════
  function findElementAt(e) {
    var pt = screenToImage(e.clientX, e.clientY);
    var hit = null;
    var minD = 15 / _zoom; // 15px screen threshold

    // Check doors (highest priority)
    _doors.forEach(function (d) {
      var dx = pt.x - d.cx, dy = pt.y - d.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minD) { minD = dist; hit = d; }
    });
    if (hit) return hit;

    // Check windows
    _windows.forEach(function (w) {
      var dx = pt.x - w.cx, dy = pt.y - w.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minD) { minD = dist; hit = w; }
    });
    if (hit) return hit;

    // Check plumbing fixtures
    _plumbing.forEach(function (p) {
      var dx = pt.x - p.cx, dy = pt.y - p.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minD) { minD = dist; hit = p; }
    });
    if (hit) return hit;

    // Check kitchen fixtures
    _kitchen.forEach(function (k) {
      var dx = pt.x - k.cx, dy = pt.y - k.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minD) { minD = dist; hit = k; }
    });
    if (hit) return hit;

    // Check walls (point-to-segment distance)
    minD = 8 / _zoom;
    _walls.forEach(function (w) {
      var d = ptSegDist(pt.x, pt.y, w.x1, w.y1, w.x2, w.y2);
      if (d < minD) { minD = d; hit = w; }
    });
    return hit;
  }

  function ptSegDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    var lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    var qx = x1 + t * dx, qy = y1 + t * dy;
    return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
  }

  // ══════════════════════════════════════
  // SELECTION
  // ══════════════════════════════════════
  function selectElement(id) {
    deselectAll();
    _selectedId = id;
    var el = findById(id);
    if (el && el.svgEl) el.svgEl.classList.add("el-selected");
    // Enable toolbar buttons
    var btnR = document.getElementById("btnRotateEl");
    var btnD = document.getElementById("btnDeleteEl");
    if (btnR) btnR.disabled = (el && el.type === "wall");
    if (btnD) btnD.disabled = false;
    if (_onSelect) _onSelect(el);
  }

  function deselectAll() {
    _selectedId = null;
    _svg.querySelectorAll(".el-selected").forEach(function (e) { e.classList.remove("el-selected"); });
    var btnR = document.getElementById("btnRotateEl");
    var btnD = document.getElementById("btnDeleteEl");
    if (btnR) btnR.disabled = true;
    if (btnD) btnD.disabled = true;
    if (_onSelect) _onSelect(null);
  }

  function getSelectedElement() {
    return _selectedId ? findById(_selectedId) : null;
  }

  function deleteSelected() {
    if (!_selectedId) return;
    var el = findById(_selectedId);
    if (!el) return;
    if (el.svgEl && el.svgEl.parentNode) el.svgEl.parentNode.removeChild(el.svgEl);
    removeFromStore(el);
    if (_onDelete) _onDelete(el);
    _selectedId = null;
    deselectAll();
  }

  function rotateSelected() {
    if (!_selectedId) return;
    var el = findById(_selectedId);
    if (!el || el.type === "wall") return;
    el.rotation = ((el.rotation || 0) + 90) % 360;
    updateFixtureTransform(el);
  }

  // ══════════════════════════════════════
  // ELEMENT MOVEMENT
  // ══════════════════════════════════════
  function moveElement(el, nx, ny) {
    if (el.type === "wall") {
      var dx = nx - el.cx, dy = ny - el.cy;
      el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy;
      el.cx = nx; el.cy = ny;
      var line = el.svgEl.querySelector("line");
      if (line) {
        line.setAttribute("x1", el.x1); line.setAttribute("y1", el.y1);
        line.setAttribute("x2", el.x2); line.setAttribute("y2", el.y2);
      }
    } else {
      el.cx = nx; el.cy = ny;
      updateFixtureTransform(el);
    }
  }

  function updateFixtureTransform(el) {
    if (el.svgEl) {
      el.svgEl.setAttribute("transform", "translate(" + el.cx + "," + el.cy + ") rotate(" + (el.rotation || 0) + ")");
    }
  }

  // ══════════════════════════════════════
  // RENDER: WALLS
  // ══════════════════════════════════════
  function setWalls(arr) {
    clearLayer("walls");
    _walls = [];
    var g = _groups.walls;
    arr.forEach(function (w) {
      var id = "el_" + (_nextId++);
      var line = document.createElementNS(NS, "line");
      line.setAttribute("x1", w.start[0]); line.setAttribute("y1", w.start[1]);
      line.setAttribute("x2", w.end[0]); line.setAttribute("y2", w.end[1]);
      var cls = w.wall_category === "exterior" ? "wall-exterior" : "wall-interior";
      if (w.structural) cls += " wall-structural";
      line.setAttribute("class", cls);
      line.setAttribute("stroke-linecap", "round");

      var wrap = document.createElementNS(NS, "g");
      wrap.setAttribute("data-el-id", id);
      wrap.appendChild(line);
      g.appendChild(wrap);

      var cx = (w.start[0] + w.end[0]) / 2;
      var cy = (w.start[1] + w.end[1]) / 2;
      _walls.push({
        id: id, type: "wall", svgEl: wrap,
        x1: w.start[0], y1: w.start[1], x2: w.end[0], y2: w.end[1],
        cx: cx, cy: cy,
        category: w.wall_category || "exterior",
        structural: w.structural || false,
        confidence: w.confidence || 0
      });
    });
  }

  // ══════════════════════════════════════
  // RENDER: DOORS
  // ══════════════════════════════════════
  function setDoors(arr) {
    clearLayer("doors");
    _doors = [];
    var g = _groups.doors;
    arr.forEach(function (d) {
      var id = "el_" + (_nextId++);
      var sz = (d.width_px || 40) / 2;
      var group = document.createElementNS(NS, "g");
      group.setAttribute("data-el-id", id);
      group.setAttribute("transform", "translate(" + d.center[0] + "," + d.center[1] + ") rotate(" + (d.swing_direction_deg || 0) + ")");

      // Door leaf (line from hinge to tip)
      var leaf = document.createElementNS(NS, "line");
      leaf.setAttribute("x1", 0); leaf.setAttribute("y1", 0);
      leaf.setAttribute("x2", sz); leaf.setAttribute("y2", 0);
      leaf.setAttribute("class", "door-symbol");
      group.appendChild(leaf);

      // Swing arc
      var arc = document.createElementNS(NS, "path");
      arc.setAttribute("d", "M " + sz + " 0 A " + sz + " " + sz + " 0 0 1 0 " + (-sz));
      arc.setAttribute("class", "door-symbol");
      group.appendChild(arc);

      // Hinge dot
      var dot = document.createElementNS(NS, "circle");
      dot.setAttribute("cx", 0); dot.setAttribute("cy", 0); dot.setAttribute("r", 3);
      dot.setAttribute("fill", "#f97316"); dot.setAttribute("opacity", "0.7");
      group.appendChild(dot);

      g.appendChild(group);

      _doors.push({
        id: id, type: "door", svgEl: group,
        cx: d.center[0], cy: d.center[1],
        rotation: d.swing_direction_deg || 0,
        doorType: d.door_type || "single",
        widthPx: d.width_px || 40,
        confidence: d.confidence || 0
      });
    });
  }

  // ══════════════════════════════════════
  // RENDER: WINDOWS
  // ══════════════════════════════════════
  function setWindows(arr) {
    clearLayer("windows");
    _windows = [];
    var g = _groups.windows;
    arr.forEach(function (w) {
      var id = "el_" + (_nextId++);
      var hw = (w.width_px || 50) / 2;
      var group = document.createElementNS(NS, "g");
      group.setAttribute("data-el-id", id);
      group.setAttribute("transform", "translate(" + w.center[0] + "," + w.center[1] + ") rotate(" + (w.orientation_deg || 0) + ")");

      // Window frame rectangle
      var rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", -hw); rect.setAttribute("y", -4);
      rect.setAttribute("width", hw * 2); rect.setAttribute("height", 8);
      rect.setAttribute("class", "window-symbol");
      group.appendChild(rect);

      // Center glass line
      var glass = document.createElementNS(NS, "line");
      glass.setAttribute("x1", -hw); glass.setAttribute("y1", 0);
      glass.setAttribute("x2", hw); glass.setAttribute("y2", 0);
      glass.setAttribute("class", "window-symbol");
      glass.setAttribute("stroke-width", "1");
      group.appendChild(glass);

      g.appendChild(group);

      _windows.push({
        id: id, type: "window", svgEl: group,
        cx: w.center[0], cy: w.center[1],
        rotation: w.orientation_deg || 0,
        windowType: w.window_type || "fixed",
        widthPx: w.width_px || 50,
        confidence: w.confidence || 0
      });
    });
  }

  // ══════════════════════════════════════
  // RENDER: FIXTURE POINTS (plumbing / kitchen)
  // ══════════════════════════════════════
  function setPoints(layerName, pointsArr) {
    if (layerName !== "plumbing" && layerName !== "kitchen") return;
    clearLayer(layerName);
    var store = [];
    var g = _groups[layerName];
    var cssClass = layerName === "plumbing" ? "fixture-plumbing" : "fixture-kitchen";

    pointsArr.forEach(function (p) {
      var id = "el_" + (_nextId++);
      var group = document.createElementNS(NS, "g");
      group.setAttribute("data-el-id", id);
      group.setAttribute("transform", "translate(" + p.x + "," + p.y + ")");

      // Marker circle
      var circle = document.createElementNS(NS, "circle");
      circle.setAttribute("cx", 0);
      circle.setAttribute("cy", 0);
      circle.setAttribute("r", 7);
      circle.setAttribute("class", cssClass);
      group.appendChild(circle);

      // Label text
      var label = document.createElementNS(NS, "text");
      label.setAttribute("x", 10);
      label.setAttribute("y", 4);
      label.setAttribute("class", "fixture-label");
      label.textContent = p.tag || "";
      group.appendChild(label);

      g.appendChild(group);

      store.push({
        id: id, type: layerName, svgEl: group,
        cx: p.x, cy: p.y,
        tag: p.tag || "",
        rotation: 0
      });
    });

    if (layerName === "plumbing") _plumbing = store;
    else _kitchen = store;
  }

  // ══════════════════════════════════════
  // RENDER: RAW OCR POINTS (display-only overlay)
  // ══════════════════════════════════════
  var RAW_COLORS = {
    exterior_walls: "#3ecf8e",
    interior_walls: "#60a5fa",
    doors: "#f97316",
    windows: "#06b6d4",
    plumbing: "#a855f7",
    kitchen: "#f59e0b"
  };

  function setRawPoints(layersObj) {
    clearRawPoints();
    var g = _groups.ocrRawPoints;
    if (!g || !layersObj) return;

    Object.keys(layersObj).forEach(function (layerName) {
      var layer = layersObj[layerName];
      var pts = layer.points || [];
      if (!pts.length) return;

      pts.forEach(function (p) {
        var circle = document.createElementNS(NS, "circle");
        circle.setAttribute("cx", p.x);
        circle.setAttribute("cy", p.y);
        circle.setAttribute("r", 5);
        circle.setAttribute("class", "ocr-raw-point ocr-raw-" + layerName);
        g.appendChild(circle);

        // Label: order for ext walls, pair for int walls, tag for everything else
        var labelText = "";
        if (layerName === "exterior_walls") labelText = String(p.order || "");
        else if (layerName === "interior_walls") labelText = (p.tag === "start" ? "S" : "E") + (p.pair || "");
        else labelText = p.tag || "";

        if (labelText) {
          var text = document.createElementNS(NS, "text");
          text.setAttribute("x", p.x + 8);
          text.setAttribute("y", p.y - 8);
          text.setAttribute("class", "ocr-raw-label");
          text.textContent = labelText;
          g.appendChild(text);
        }

        _rawPoints.push({ x: p.x, y: p.y, layer: layerName, tag: p.tag || "" });
      });
    });
  }

  function clearRawPoints() {
    var g = _groups.ocrRawPoints;
    if (g) g.innerHTML = "";
    _rawPoints = [];
  }

  function toggleOverlay(overlayName, visible) {
    if (overlayName === "raw") {
      var g = _groups.ocrRawPoints;
      if (g) g.style.display = visible ? "" : "none";
    } else if (overlayName === "vectors") {
      ["walls", "doors", "windows", "plumbing", "kitchen"].forEach(function (key) {
        var g = _groups[key];
        if (g) g.style.display = visible ? "" : "none";
      });
    }
  }

  // ══════════════════════════════════════
  // LAYER OPERATIONS
  // ══════════════════════════════════════
  function clearLayer(layerName) {
    var g = _groups[layerName];
    if (g) g.innerHTML = "";
    if (layerName === "walls") _walls = [];
    if (layerName === "doors") _doors = [];
    if (layerName === "windows") _windows = [];
    if (layerName === "plumbing") _plumbing = [];
    if (layerName === "kitchen") _kitchen = [];
  }

  function toggleLayerVisibility(layerName, visible) {
    var g = _groups[layerName];
    if (g) g.style.display = visible ? "" : "none";
  }

  // ══════════════════════════════════════
  // SCALE LINE TOOL
  // ══════════════════════════════════════
  function enableScaleLineTool(callback) {
    _scalePt1 = null;
    _scalePt2 = null;
    _scaleLineCallback = callback;
    clearLayer("scaleLine");
    setMode("scale_line");
  }

  function handleScaleLineClick(pt) {
    if (!_scalePt1) {
      _scalePt1 = pt;
      drawScaleEndpoint(pt.x, pt.y);
    } else {
      _scalePt2 = pt;
      drawScaleEndpoint(pt.x, pt.y);
      drawScaleSegment(_scalePt1, _scalePt2);
      var dx = _scalePt2.x - _scalePt1.x;
      var dy = _scalePt2.y - _scalePt1.y;
      var pixelDist = Math.sqrt(dx * dx + dy * dy);
      setMode("select");
      if (_scaleLineCallback) _scaleLineCallback(pixelDist);
      _scaleLineCallback = null;
    }
  }

  function drawScaleEndpoint(x, y) {
    var c = document.createElementNS(NS, "circle");
    c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 5);
    c.setAttribute("class", "scale-endpoint");
    _groups.scaleLine.appendChild(c);
  }

  function drawScaleSegment(a, b) {
    var l = document.createElementNS(NS, "line");
    l.setAttribute("x1", a.x); l.setAttribute("y1", a.y);
    l.setAttribute("x2", b.x); l.setAttribute("y2", b.y);
    l.setAttribute("class", "scale-line");
    _groups.scaleLine.appendChild(l);
  }

  // ══════════════════════════════════════
  // DATA EXPORT
  // ══════════════════════════════════════
  function getAllElements() {
    return {
      walls: _walls.map(function (w) {
        return { id: w.id, start: [w.x1, w.y1], end: [w.x2, w.y2], category: w.category, structural: w.structural };
      }),
      doors: _doors.map(function (d) {
        return { id: d.id, center: [d.cx, d.cy], rotation: d.rotation, type: d.doorType, widthPx: d.widthPx };
      }),
      windows: _windows.map(function (w) {
        return { id: w.id, center: [w.cx, w.cy], rotation: w.rotation, type: w.windowType, widthPx: w.widthPx };
      }),
      plumbing: _plumbing.map(function (p) {
        return { id: p.id, x: p.cx, y: p.cy, tag: p.tag };
      }),
      kitchen: _kitchen.map(function (k) {
        return { id: k.id, x: k.cx, y: k.cy, tag: k.tag };
      })
    };
  }

  // ══════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════
  function findById(id) {
    return _walls.find(function (e) { return e.id === id; })
        || _doors.find(function (e) { return e.id === id; })
        || _windows.find(function (e) { return e.id === id; })
        || _plumbing.find(function (e) { return e.id === id; })
        || _kitchen.find(function (e) { return e.id === id; });
  }

  function removeFromStore(el) {
    if (el.type === "wall") _walls = _walls.filter(function (w) { return w.id !== el.id; });
    if (el.type === "door") _doors = _doors.filter(function (d) { return d.id !== el.id; });
    if (el.type === "window") _windows = _windows.filter(function (w) { return w.id !== el.id; });
    if (el.type === "plumbing") _plumbing = _plumbing.filter(function (p) { return p.id !== el.id; });
    if (el.type === "kitchen") _kitchen = _kitchen.filter(function (k) { return k.id !== el.id; });
  }

})();
