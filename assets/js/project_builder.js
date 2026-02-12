// assets/js/project_builder.js
// Project Builder - NGM Revit Suite ecosystem viewer & manifest configurator
(function () {
  "use strict";

  var API = (window.NGM_CONFIG && window.NGM_CONFIG.API_BASE) || window.API_BASE || "https://ngm-fastapi.onrender.com";

  function authHeaders() {
    var t = localStorage.getItem("ngmToken");
    return t ? { Authorization: "Bearer " + t } : {};
  }

  // ── State ──
  var registry = null;
  var defIndex = null;
  var templatesIndex = null;
  var templateData = null;
  var wallTypesData = null;
  var currentStep = 1;
  var TOTAL_STEPS = 6;

  var manifest = {
    meta: { project_name: "", project_type: "", created_by: "web_configurator", version: "1.0", ngm_project_id: "" },
    levels: [], grids: [], walls: [], fixtures: [], floors: [], columns: [], beams: [], rooms: [],
    views: "use_template_defaults", sheets: "use_template_defaults"
  };

  var selected = {
    wallTypes: new Set(),
    families: new Set(),
    views: new Set(),
    sheets: new Set(),
    scripts: new Set()
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };

  // ── Init ──
  async function init() {
    bindTabs();
    bindStepNav();
    bindExportActions();
    await Promise.all([loadRegistry(), loadDefIndex(), loadTemplatesIndex(), loadProjects()]);
    if (registry) {
      var ver = $("#pbVersion");
      if (ver) ver.textContent = "v" + (registry.version || "1.0");
    }
    renderDefNav();
    if (window.PBScanEngine) window.PBScanEngine.init();
    populateProjectTypeOptions();
    bindProjectInfo();
  }

  // ── API helpers ──
  async function apiFetch(path) {
    try {
      var res = await fetch(API + path, { headers: authHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  async function loadRegistry() { registry = await apiFetch("/revit/registry"); }
  async function loadDefIndex() { defIndex = await apiFetch("/revit/definitions"); }
  async function loadTemplatesIndex() { templatesIndex = await apiFetch("/revit/templates"); }

  // ── Tabs ──
  function bindTabs() {
    $$(".pb-tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.dataset.tab;
        $$(".pb-tab").forEach(function (b) { b.classList.toggle("pb-tab--active", b.dataset.tab === tab); });
        $$(".pb-section").forEach(function (s) { s.classList.toggle("pb-section--active", s.dataset.section === tab); });
        if (tab === "export") refreshExport();
        if (tab === "configure" && window.PBScanEngine) window.PBScanEngine.init();
      });
    });
  }

  // ═══════════════════════════════════════
  // DEFINITIONS TAB
  // ═══════════════════════════════════════
  function renderDefNav() {
    var nav = $("#pbDefNav");
    if (!defIndex) { nav.innerHTML = '<div class="pb-empty-state"><p>No definitions loaded.</p></div>'; return; }
    var html = "";
    Object.keys(defIndex).forEach(function (key) {
      var d = defIndex[key];
      html += '<button type="button" class="pb-def-nav-item" data-def="' + escAttr(key) + '"><span class="pb-def-nav-name">' + esc(formatDefName(key)) + '</span><span class="pb-def-nav-desc">' + esc(d.description || "") + '</span></button>';
    });
    nav.innerHTML = html;
    nav.addEventListener("click", function (e) {
      var btn = e.target.closest(".pb-def-nav-item");
      if (!btn) return;
      nav.querySelectorAll(".pb-def-nav-item").forEach(function (b) { b.classList.remove("pb-def-nav-item--active"); });
      btn.classList.add("pb-def-nav-item--active");
      loadDefinition(btn.dataset.def);
    });
  }

  async function loadDefinition(defType) {
    var content = $("#pbDefContent");
    content.innerHTML = '<div class="pb-loading">Loading...</div>';
    var data = await apiFetch("/revit/definitions/" + defType);
    if (!data) { content.innerHTML = '<div class="pb-empty-state"><p>Failed to load definition.</p></div>'; return; }

    var renderers = {
      wall_types: renderWallTypes,
      floor_types: renderFloorTypes,
      shared_parameters: renderSharedParams,
      naming_conventions: renderNamingConventions,
      view_templates: renderViewTemplates,
      graphic_styles: renderGraphicStyles,
      sheet_layouts: renderSheetLayouts
    };
    var fn = renderers[defType];
    if (fn) fn(data, content);
    else content.innerHTML = '<pre class="pb-json-code" style="max-height:600px;overflow:auto;">' + esc(JSON.stringify(data, null, 2)) + '</pre>';
  }

  function renderWallTypes(data, el) {
    var types = data.wall_types || [];
    var html = '<h3 class="pb-def-title">Wall Types (' + types.length + ')</h3>';
    types.forEach(function (wt) {
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">' + esc(wt.name) + '</span><span class="pb-def-item-meta">' + esc(wt.function) + ' | ' + ftToInStr(wt.total_width_ft) + '</span></div>';
      html += '<div class="pb-layers">';
      (wt.layers || []).forEach(function (layer) {
        var pct = Math.max(8, Math.round((layer.width_ft / wt.total_width_ft) * 100));
        html += '<div class="pb-layer" style="flex:' + pct + ';background:' + layerColor(layer.function) + ';" title="' + escAttr(layer.material + " (" + ftToInStr(layer.width_ft) + ")") + '"><span class="pb-layer-label">' + esc(layer.material) + '</span></div>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderFloorTypes(data, el) {
    var types = data.floor_types || [];
    var html = '<h3 class="pb-def-title">Floor Types (' + types.length + ')</h3>';
    types.forEach(function (ft) {
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">' + esc(ft.name) + '</span><span class="pb-def-item-meta">' + ftToInStr(ft.total_thickness_ft) + (ft.structural ? " | structural" : "") + '</span></div>';
      html += '<div class="pb-layers">';
      (ft.layers || []).forEach(function (layer) {
        var pct = Math.max(8, Math.round((layer.width_ft / ft.total_thickness_ft) * 100));
        html += '<div class="pb-layer" style="flex:' + pct + ';background:' + layerColor(layer.function) + ';" title="' + escAttr(layer.material + " (" + ftToInStr(layer.width_ft) + ")") + '"><span class="pb-layer-label">' + esc(layer.material) + '</span></div>';
      });
      html += '</div></div>';
    });
    el.innerHTML = html;
  }

  function renderSharedParams(data, el) {
    var params = data.parameters || [];
    var html = '<h3 class="pb-def-title">Shared Parameters (' + params.length + ')</h3><div class="pb-params-list">';
    params.forEach(function (p) {
      html += '<div class="pb-param-item"><div class="pb-param-name">' + esc(p.name) + '</div><div class="pb-param-meta">' + esc(p.type) + ' | ' + (p.instance ? "Instance" : "Type") + '</div><div class="pb-param-desc">' + esc(p.description || "") + '</div>';
      html += '<div class="pb-param-cats">' + (p.categories || []).map(function (c) { return '<span class="pb-param-cat">' + esc(c.replace("OST_", "")) + '</span>'; }).join("") + '</div></div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function renderViewTemplates(data, el) {
    var templates = data.view_templates || [];
    var html = '<h3 class="pb-def-title">View Templates (' + templates.length + ')</h3>';
    templates.forEach(function (vt) {
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">' + esc(vt.name) + '</span><span class="pb-def-item-meta">1:' + vt.scale + ' | ' + esc(vt.detail_level) + ' | ' + esc(vt.discipline) + '</span></div>';
      var vis = vt.category_visibility || {};
      if (vis.hide && vis.hide.length) html += '<div class="pb-vt-cats"><span class="pb-vt-label">Hidden:</span> ' + vis.hide.map(function (c) { return esc(c.replace("OST_", "")); }).join(", ") + '</div>';
      if (vis.halftone && vis.halftone.length) html += '<div class="pb-vt-cats"><span class="pb-vt-label">Halftone:</span> ' + vis.halftone.map(function (c) { return esc(c.replace("OST_", "")); }).join(", ") + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderNamingConventions(data, el) {
    var html = '<h3 class="pb-def-title">Naming Conventions</h3>';
    ["levels", "grids", "views", "sheets", "families", "types"].forEach(function (key) {
      if (!data[key]) return;
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">' + esc(key) + '</span></div>';
      var section = data[key];
      if (section.pattern) html += '<div class="pb-naming-pattern">Pattern: <code class="pb-code">' + esc(section.pattern) + '</code></div>';
      if (section.examples) html += '<div class="pb-naming-examples">' + section.examples.map(function (e) { return '<code class="pb-code">' + esc(e) + '</code>'; }).join(" ") + '</div>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderGraphicStyles(data, el) {
    var html = '<h3 class="pb-def-title">Graphic Styles</h3>';
    if (data.colors) {
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">Material Colors</span></div><div class="pb-color-grid">';
      Object.keys(data.colors).forEach(function (k) {
        var c = data.colors[k];
        html += '<div class="pb-color-swatch"><span class="pb-swatch" style="background:rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ');"></span><span class="pb-color-name">' + esc(k) + '</span></div>';
      });
      html += '</div></div>';
    }
    if (data.filters) {
      html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">Filters (' + data.filters.length + ')</span></div>';
      data.filters.forEach(function (f) { html += '<div class="pb-filter-row">' + esc(f.name) + '</div>'; });
      html += '</div>';
    }
    el.innerHTML = html;
  }

  function renderSheetLayouts(data, el) {
    var html = '<h3 class="pb-def-title">Sheet Layouts</h3>';
    html += '<div class="pb-def-item"><div class="pb-def-item-header"><span class="pb-def-item-name">' + esc(data.titleblock_family || "") + '</span><span class="pb-def-item-meta">' + esc(data.paper_size || "") + ' (' + (data.paper_width_in || 0) + '" x ' + (data.paper_height_in || 0) + '")</span></div>';
    var sets = data.default_sheet_sets || {};
    Object.keys(sets).forEach(function (disc) {
      html += '<div class="pb-sheet-discipline"><span class="pb-sheet-disc-label">' + esc(disc) + '</span>';
      (sets[disc] || []).forEach(function (s) { html += '<div class="pb-sheet-row">' + esc(s.number) + ' - ' + esc(s.title) + '</div>'; });
      html += '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  // ═══════════════════════════════════════
  // CONFIGURE TAB
  // ═══════════════════════════════════════
  function bindStepNav() {
    $("#btnNextStep").addEventListener("click", function () { goToStep(currentStep + 1); });
    $("#btnPrevStep").addEventListener("click", function () { goToStep(currentStep - 1); });
    $$(".pb-step").forEach(function (el) {
      el.addEventListener("click", function () { var s = parseInt(el.dataset.step); if (s) goToStep(s); });
    });
  }

  function goToStep(step) {
    if (step < 1 || step > TOTAL_STEPS) return;
    saveStepData(currentStep);
    currentStep = step;
    $$(".pb-step").forEach(function (el) {
      var s = parseInt(el.dataset.step);
      el.classList.remove("pb-step--active", "pb-step--done");
      if (s === currentStep) el.classList.add("pb-step--active");
      else if (s < currentStep) el.classList.add("pb-step--done");
    });
    $$(".pb-panel").forEach(function (p) { p.classList.toggle("pb-panel--active", parseInt(p.dataset.panel) === currentStep); });
    $("#btnPrevStep").disabled = currentStep === 1;
    $("#btnNextStep").textContent = currentStep === TOTAL_STEPS ? "Finish" : "Next";
    populateStepContent(currentStep);
  }

  function saveStepData(step) {
    if (step === 1) {
      manifest.meta.project_name = $("#pbProjectName").value.trim();
      manifest.meta.project_type = $("#pbProjectType").value;
      manifest.meta.ngm_project_id = $("#pbLinkedProject").value;
    }
    if (step === 2) { manifest.levels = readLevelsTable(); manifest.grids = readGridsTable(); }
  }

  function populateStepContent(step) {
    if (step === 2) populateLevelsAndGrids();
    if (step === 3) populateWallTypesStep();
    if (step === 4) populateFamilies();
    if (step === 5) populateViewsSheets();
    if (step === 6) populateAutomations();
  }

  // Step 1
  function populateProjectTypeOptions() {
    var sel = $("#pbProjectType");
    if (!templatesIndex) return;
    Object.keys(templatesIndex).forEach(function (k) {
      var opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      sel.appendChild(opt);
    });
  }

  function bindProjectInfo() {
    $("#pbProjectType").addEventListener("change", async function () {
      var type = this.value;
      if (!type) { templateData = null; $("#pbTemplatePreview").style.display = "none"; return; }
      templateData = await apiFetch("/revit/templates/" + type);
      if (!templateData) return;
      showTemplatePreview(templateData);
      selected.wallTypes = new Set((templateData.wall_types || []).map(function (w) { return w.name || w; }));
      var allFams = [];
      Object.keys(templateData.families_to_load || {}).forEach(function (g) { (templateData.families_to_load[g] || []).forEach(function (f) { allFams.push(f); }); });
      selected.families = new Set(allFams);
      selected.views = new Set((templateData.views_to_create || []).map(function (v) { return v.name; }));
      selected.sheets = new Set((templateData.sheets_to_create || []).map(function (s) { return s.name; }));
      var defLevels = templateData.levels && templateData.levels.default ? templateData.levels.default : [];
      manifest.levels = defLevels.map(function (name, i) { return { name: name, elevation_ft: i === 0 ? -2.0 : (i - 1) * 9.1875 }; });
      manifest.grids = [];
      ["#pbLevelsBody", "#pbGridsBody", "#pbWallTypes", "#pbFamilyGroups", "#pbViews", "#pbSheets", "#pbAutomations"].forEach(function (s) { $(s).innerHTML = ""; });
    });
  }

  function showTemplatePreview(tpl) {
    $("#pbTemplatePreview").style.display = "block";
    var defLevels = tpl.levels && tpl.levels.default ? tpl.levels.default.length : 0;
    var wallCount = (tpl.wall_types || []).length;
    var famCount = 0;
    Object.keys(tpl.families_to_load || {}).forEach(function (g) { famCount += (tpl.families_to_load[g] || []).length; });
    $("#pbPreviewGrid").innerHTML =
      '<div class="pb-preview-card"><div class="pb-preview-card-label">Levels</div><div class="pb-preview-card-value">' + defLevels + '</div></div>' +
      '<div class="pb-preview-card"><div class="pb-preview-card-label">Wall Types</div><div class="pb-preview-card-value">' + wallCount + '</div></div>' +
      '<div class="pb-preview-card"><div class="pb-preview-card-label">Families</div><div class="pb-preview-card-value">' + famCount + '</div></div>' +
      '<div class="pb-preview-card"><div class="pb-preview-card-label">Sheets</div><div class="pb-preview-card-value">' + (tpl.sheets_to_create || []).length + '</div></div>';
  }

  // Step 2
  function populateLevelsAndGrids() {
    var tbody = $("#pbLevelsBody");
    if (!tbody.children.length && manifest.levels.length) manifest.levels.forEach(function (l) { addLevelRow(l.name, l.elevation_ft); });
    var gBody = $("#pbGridsBody");
    if (!gBody.children.length && manifest.grids.length) manifest.grids.forEach(function (g) { addGridRow(g.name, g.start[0] + ", " + g.start[1], g.end[0] + ", " + g.end[1]); });
    $("#btnAddLevel").onclick = function () { addLevelRow("New Level", 0); };
    $("#btnAddGrid").onclick = function () { addGridRow("", "0, 0", "0, 0"); };
  }
  function addLevelRow(name, elev) {
    var tr = document.createElement("tr");
    tr.innerHTML = '<td><input type="text" value="' + escAttr(name) + '"></td><td><input type="number" step="0.0001" value="' + elev + '"></td><td><button type="button" class="pb-btn-remove">x</button></td>';
    tr.querySelector(".pb-btn-remove").addEventListener("click", function () { tr.remove(); });
    $("#pbLevelsBody").appendChild(tr);
  }
  function addGridRow(name, start, end) {
    var tr = document.createElement("tr");
    tr.innerHTML = '<td><input type="text" value="' + escAttr(name) + '"></td><td><input type="text" value="' + escAttr(start) + '" placeholder="x, y"></td><td><input type="text" value="' + escAttr(end) + '" placeholder="x, y"></td><td><button type="button" class="pb-btn-remove">x</button></td>';
    tr.querySelector(".pb-btn-remove").addEventListener("click", function () { tr.remove(); });
    $("#pbGridsBody").appendChild(tr);
  }
  function readLevelsTable() {
    var levels = [];
    $$("#pbLevelsBody tr").forEach(function (tr) { var i = tr.querySelectorAll("input"); var n = i[0].value.trim(); if (n) levels.push({ name: n, elevation_ft: parseFloat(i[1].value) || 0 }); });
    return levels;
  }
  function readGridsTable() {
    var grids = [];
    $$("#pbGridsBody tr").forEach(function (tr) {
      var i = tr.querySelectorAll("input"); var n = i[0].value.trim();
      var sp = i[1].value.split(",").map(function (v) { return parseFloat(v.trim()) || 0; });
      var ep = i[2].value.split(",").map(function (v) { return parseFloat(v.trim()) || 0; });
      if (n) grids.push({ name: n, start: [sp[0] || 0, sp[1] || 0], end: [ep[0] || 0, ep[1] || 0] });
    });
    return grids;
  }

  // Step 3 Wall Types
  async function populateWallTypesStep() {
    var c = $("#pbWallTypes");
    if (c.children.length) return;
    if (!wallTypesData) wallTypesData = await apiFetch("/revit/definitions/wall_types");
    if (!wallTypesData || !wallTypesData.wall_types) { c.innerHTML = '<div class="pb-empty-state"><p>Could not load wall types.</p></div>'; return; }
    c.innerHTML = "";
    wallTypesData.wall_types.forEach(function (wt) {
      var item = document.createElement("label");
      item.className = "pb-check-item";
      item.innerHTML = '<input type="checkbox" ' + (selected.wallTypes.has(wt.name) ? "checked" : "") + '><span class="pb-check-item-name">' + esc(wt.name) + '</span><span class="pb-check-item-detail">' + esc(wt.function) + ' | ' + ftToInStr(wt.total_width_ft) + '</span>';
      item.querySelector("input").addEventListener("change", function (e) { if (e.target.checked) selected.wallTypes.add(wt.name); else selected.wallTypes.delete(wt.name); });
      c.appendChild(item);
    });
  }

  // Step 4 Families
  function populateFamilies() {
    var c = $("#pbFamilyGroups");
    if (c.children.length) return;
    if (!registry || !registry.families) { c.innerHTML = '<div class="pb-empty-state"><p>No family data.</p></div>'; return; }
    c.innerHTML = "";
    Object.keys(registry.families).forEach(function (groupName) {
      var families = registry.families[groupName];
      var group = document.createElement("div");
      group.className = "pb-family-group";
      var cnt = families.filter(function (f) { return selected.families.has(f.name); }).length;
      group.innerHTML = '<div class="pb-family-group-header"><span class="pb-family-group-title">' + esc(groupName) + '</span><span class="pb-family-group-count">' + cnt + '/' + families.length + '</span></div><div class="pb-family-group-items"></div>';
      var items = group.querySelector(".pb-family-group-items");
      families.forEach(function (fam) {
        var tag = document.createElement("span");
        tag.className = "pb-family-tag" + (selected.families.has(fam.name) ? " pb-family-tag--selected" : "");
        tag.textContent = fam.name.replace("NGM_", "");
        tag.title = (fam.types || []).join(", ");
        tag.addEventListener("click", function () {
          if (selected.families.has(fam.name)) { selected.families.delete(fam.name); tag.classList.remove("pb-family-tag--selected"); }
          else { selected.families.add(fam.name); tag.classList.add("pb-family-tag--selected"); }
          group.querySelector(".pb-family-group-count").textContent = families.filter(function (f) { return selected.families.has(f.name); }).length + "/" + families.length;
        });
        items.appendChild(tag);
      });
      c.appendChild(group);
    });
  }

  // Step 5 Views & Sheets
  function populateViewsSheets() {
    var vc = $("#pbViews"), sc = $("#pbSheets");
    if (vc.children.length) return;
    if (!templateData) { vc.innerHTML = '<div class="pb-empty-state"><p>Select a project type first.</p></div>'; sc.innerHTML = ""; return; }
    vc.innerHTML = "";
    (templateData.views_to_create || []).forEach(function (v) {
      var item = document.createElement("label");
      item.className = "pb-check-item";
      item.innerHTML = '<input type="checkbox" ' + (selected.views.has(v.name) ? "checked" : "") + '><span class="pb-check-item-name">' + esc(v.name) + '</span><span class="pb-check-item-detail">' + esc(v.type || "") + (v.per_level ? " (per level)" : "") + '</span>';
      item.querySelector("input").addEventListener("change", function (e) { if (e.target.checked) selected.views.add(v.name); else selected.views.delete(v.name); });
      vc.appendChild(item);
    });
    sc.innerHTML = "";
    (templateData.sheets_to_create || []).forEach(function (s) {
      var item = document.createElement("label");
      item.className = "pb-check-item";
      item.innerHTML = '<input type="checkbox" ' + (selected.sheets.has(s.name) ? "checked" : "") + '><span class="pb-check-item-name">' + esc(s.name) + '</span><span class="pb-check-item-detail">' + esc(s.discipline || "") + '</span>';
      item.querySelector("input").addEventListener("change", function (e) { if (e.target.checked) selected.sheets.add(s.name); else selected.sheets.delete(s.name); });
      sc.appendChild(item);
    });
  }

  // Step 6 Automations
  function populateAutomations() {
    var c = $("#pbAutomations");
    if (c.children.length) return;
    if (!registry || !registry.panels) { c.innerHTML = '<div class="pb-empty-state"><p>No automation data.</p></div>'; return; }
    c.innerHTML = "";
    Object.keys(registry.panels).forEach(function (panelKey) {
      var panel = registry.panels[panelKey];
      var group = document.createElement("div");
      group.className = "pb-auto-group";
      group.innerHTML = '<div class="pb-auto-group-header">' + esc(panel.label) + '<span class="pb-auto-group-desc">' + esc(panel.description || "") + '</span></div>';
      var list = document.createElement("div");
      list.className = "pb-auto-list";
      (panel.scripts || []).forEach(function (script) {
        var dis = script.status !== "ready";
        var item = document.createElement("label");
        item.className = "pb-check-item" + (dis ? " pb-check-item--disabled" : "");
        item.innerHTML = '<input type="checkbox" ' + (selected.scripts.has(script.id) ? "checked" : "") + (dis ? " disabled" : "") + '><span class="pb-check-item-name">' + esc(script.name) + '</span><span class="pb-status ' + (script.status === "ready" ? "pb-status--ready" : "pb-status--planned") + '">' + esc(script.status) + '</span>';
        if (!dis) item.querySelector("input").addEventListener("change", function (e) { if (e.target.checked) selected.scripts.add(script.id); else selected.scripts.delete(script.id); });
        list.appendChild(item);
      });
      group.appendChild(list);
      c.appendChild(group);
    });
  }

  // ═══════════════════════════════════════
  // EXPORT TAB
  // ═══════════════════════════════════════
  function refreshExport() {
    saveStepData(currentStep);
    var json = buildManifestJSON();
    var str = JSON.stringify(json, null, 2);
    $("#pbJsonPreview").textContent = str;
    var has = !!manifest.meta.project_name;
    var safe = (manifest.meta.project_name || "project").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    $("#pbJsonFilename").textContent = has ? safe + "_manifest.json" : "No manifest configured";
    $("#btnDownloadJson").disabled = !has;
    $("#btnSaveManifest").disabled = !has;
    loadSavedManifests();
  }

  function buildManifestJSON() {
    var json = {
      meta: { project_name: manifest.meta.project_name, project_type: manifest.meta.project_type, created_by: "web_configurator", version: "1.0", ngm_project_id: manifest.meta.ngm_project_id || null },
      levels: manifest.levels, grids: manifest.grids,
      wall_types_selected: Array.from(selected.wallTypes),
      families_selected: Array.from(selected.families),
      views: Array.from(selected.views),
      sheets: Array.from(selected.sheets),
      automations: Array.from(selected.scripts)
    };
    if (manifest.walls && manifest.walls.length) json.walls = manifest.walls;
    if (manifest.fixtures && manifest.fixtures.length) json.fixtures = manifest.fixtures;
    if (manifest.floors && manifest.floors.length) json.floors = manifest.floors;
    if (manifest.scan_meta) json.scan_meta = manifest.scan_meta;
    return json;
  }

  function bindExportActions() {
    $("#btnCopyJson").addEventListener("click", function () {
      navigator.clipboard.writeText($("#pbJsonPreview").textContent).then(function () { if (window.Toast) window.Toast.success("Copied to clipboard"); });
    });
    $("#btnDownloadJson").addEventListener("click", function () {
      var text = $("#pbJsonPreview").textContent;
      var safe = (manifest.meta.project_name || "project").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = safe + "_manifest.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#btnSaveManifest").addEventListener("click", async function () {
      try {
        var res = await fetch(API + "/revit/manifests", {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
          body: JSON.stringify({ name: manifest.meta.project_name, project_type: manifest.meta.project_type, project_id: manifest.meta.ngm_project_id || null, manifest: buildManifestJSON() })
        });
        if (res.ok) { if (window.Toast) window.Toast.success("Manifest saved"); loadSavedManifests(); }
        else { if (window.Toast) window.Toast.error("Failed to save"); }
      } catch (e) { if (window.Toast) window.Toast.error("Error saving manifest"); }
    });
  }

  async function loadSavedManifests() {
    var data = await apiFetch("/revit/manifests?limit=10");
    var el = $("#pbManifestsList"), badge = $("#pbManifestsCount");
    if (!data || !data.length) { el.innerHTML = '<div class="pb-empty-state"><p>No saved manifests yet.</p></div>'; badge.textContent = "0"; return; }
    badge.textContent = data.length;
    el.innerHTML = data.map(function (m) {
      var date = m.created_at ? new Date(m.created_at).toLocaleDateString() : "";
      return '<div class="pb-manifest-row"><span class="pb-manifest-name">' + esc(m.name) + '</span><span class="pb-manifest-meta">' + esc(m.project_type) + ' | ' + date + '</span></div>';
    }).join("");
  }

  async function loadProjects() {
    try {
      var res = await fetch(API + "/projects", { credentials: "include", headers: authHeaders() });
      if (!res.ok) return;
      var data = await res.json();
      var sel = $("#pbLinkedProject");
      data.forEach(function (p) { var o = document.createElement("option"); o.value = p.id; o.textContent = p.project_name || p.name || p.id; sel.appendChild(o); });
    } catch (e) {}
  }

  // ── Helpers ──
  function esc(s) { if (!s) return ""; var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
  function escAttr(s) { return String(s || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function ftToInStr(ft) { return (Math.round(ft * 12 * 100) / 100) + '"'; }
  function formatDefName(key) { return key.replace(/_/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function layerColor(func) {
    return { finish: "rgba(62,207,142,0.25)", substrate: "rgba(100,140,200,0.3)", structure: "rgba(180,180,180,0.35)", thermal: "rgba(255,200,100,0.25)" }[func] || "rgba(150,150,150,0.2)";
  }

  // ── Public API for cross-tab integration ──
  window.PBManifest = {
    mergeScanData: function (data) {
      if (!data) return;
      if (data.walls) manifest.walls = data.walls;
      if (data.fixtures) manifest.fixtures = data.fixtures;
      if (data.floors) manifest.floors = data.floors;
      if (data.scan_meta) manifest.scan_meta = data.scan_meta;
    },
    switchTab: function (tabName) {
      var btn = document.querySelector('.pb-tab[data-tab="' + tabName + '"]');
      if (btn) btn.click();
    },
    getManifest: function () { return buildManifestJSON(); }
  };

  // ── Boot ──
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
