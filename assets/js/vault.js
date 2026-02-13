// assets/js/vault.js
// ================================
// Vault - File Storage Module
// ================================
// Hybrid file explorer with folder tree + card grid,
// chunked uploads, versioning, search, and context menu.

(function () {
  "use strict";

  // ─── Config ────────────────────────────────────────────────────────────────
  const API_BASE = window.API_BASE || window.NGM_CONFIG?.API_BASE || "http://localhost:3000";

  function getAuthHeaders() {
    const token = localStorage.getItem("ngmToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function getUserId() {
    try {
      const raw = localStorage.getItem("ngmUser");
      if (raw) { const u = JSON.parse(raw); return u.user_id || u.id || null; }
    } catch (_) {}
    return null;
  }

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentProject = null;   // null = global vault, string = project id
  let currentFolder = null;    // null = root
  let folderPath = [];         // breadcrumb [{id, name}, ...]
  let folderTree = [];         // flat list of all folders
  let _childrenMap = new Map(); // Map<parentId|"__root__", children[]> - pre-computed for O(1) lookups
  let files = [];              // current folder contents
  let viewMode = "grid";       // 'grid' | 'list'
  let sortBy = "name";         // 'name' | 'date' | 'size' | 'type'
  let selectedFileId = null;   // currently selected file for context menu
  let receiptStatusMap = {};   // {file_hash: status} for receipt folders
  let projects = [];           // user's projects
  let companies = [];          // all companies
  let currentCompany = null;   // null = all projects, string = filter by company
  let expandedNodes = new Set(); // Track which tree nodes are expanded
  let treeCache = {};          // Cache tree data per project to avoid re-fetching
  let filesCache = {};         // Cache files data per folder/project to avoid re-fetching

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const $tree = document.getElementById("vaultTree");
  const $files = document.getElementById("vaultFiles");
  const $empty = document.getElementById("vaultEmpty");
  const $breadcrumb = document.getElementById("vaultBreadcrumb");
  const $contextMenu = document.getElementById("vaultContextMenu");
  const $dropzone = document.getElementById("vaultDropzone");
  const $uploadProgress = document.getElementById("vaultUploadProgress");
  const $uploadFill = document.getElementById("vaultUploadProgressFill");
  const $uploadText = document.getElementById("vaultUploadProgressText");
  const $versionPanel = document.getElementById("vaultVersionPanel");
  const $versionList = document.getElementById("vaultVersionList");
  const $versionFileName = document.getElementById("vaultVersionFileName");
  const $moveModal = document.getElementById("vaultMoveModal");
  const $moveTree = document.getElementById("vaultMoveTree");
  const $searchInput = document.getElementById("vaultSearchInput");
  const $fileInput = document.getElementById("vaultFileInput");
  const $versionFileInput = document.getElementById("vaultVersionFileInput");
  const $treePanel = document.getElementById("vaultTreePanel");
  const $contentPanel = document.getElementById("vaultContentPanel");
  const $resizer = document.getElementById("vaultResizer");

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  const CHUNK_CONCURRENCY = 3;

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    await Promise.all([loadCompanies(), loadProjects()]);
    renderCompanyDropdown();
    await loadTree();
    await loadFiles();
    bindEvents();

    // Initialize topbar pills
    if (typeof window.initTopbarPills === 'function') {
      await window.initTopbarPills();
    }
  }

  // ─── API Helpers ───────────────────────────────────────────────────────────
  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = { ...getAuthHeaders(), ...(options.headers || {}) };
    const resp = await fetch(url, { ...options, headers });
    if (!resp.ok) {
      const text = await resp.text().catch(() => resp.statusText);
      throw new Error(text);
    }
    return resp.json();
  }

  async function apiPost(path, body) {
    return apiFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function apiPatch(path, body) {
    return apiFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function apiDelete(path) {
    return apiFetch(path, { method: "DELETE" });
  }

  // ─── Companies & Projects ──────────────────────────────────────────────────
  async function loadCompanies() {
    try {
      const data = await apiFetch("/companies");
      companies = Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("[Vault] Failed to load companies:", e);
      companies = [];
    }
  }

  async function loadProjects() {
    try {
      const data = await apiFetch("/projects");
      projects = Array.isArray(data) ? data : (data.projects || data.data || []);
    } catch (e) {
      console.warn("[Vault] Failed to load projects:", e);
      projects = [];
    }
  }

  function renderCompanyDropdown() {
    const label = document.getElementById("vaultCompanyLabel");
    const dot = document.getElementById("vaultCompanyDot");
    const dd = document.getElementById("vaultCompanyDropdown");
    if (!dd) return;

    // Build dropdown options
    let html = `<button class="vault-company-option${currentCompany === null ? " active" : ""}" data-company="">`;
    html += `<span class="vault-company-opt-dot" style="background:#3ecf8e"></span>All Projects</button>`;

    for (const c of companies) {
      if (c.status === "Inactive") continue;
      const hue = c.avatar_color || 0;
      const color = `hsl(${hue},70%,50%)`;
      const active = currentCompany === c.id ? " active" : "";
      html += `<button class="vault-company-option${active}" data-company="${c.id}" data-hue="${hue}">`;
      html += `<span class="vault-company-opt-dot" style="background:${color}"></span>${escapeHtml(c.name)}</button>`;
    }

    // Orphan projects
    const orphans = projects.filter(p => !p.source_company);
    if (orphans.length > 0) {
      const active = currentCompany === "__other__" ? " active" : "";
      html += `<button class="vault-company-option${active}" data-company="__other__" data-hue="0">`;
      html += `<span class="vault-company-opt-dot" style="background:#888"></span>Other</button>`;
    }

    dd.innerHTML = html;

    // Update button label + dot
    if (currentCompany === null) {
      if (label) label.textContent = "All Projects";
      if (dot) dot.style.background = "#3ecf8e";
    } else if (currentCompany === "__other__") {
      if (label) label.textContent = "Other";
      if (dot) dot.style.background = "#888";
    } else {
      const co = companies.find(c => c.id === currentCompany);
      if (label) label.textContent = co ? co.name : "Company";
      const hue = co ? (co.avatar_color || 0) : 0;
      if (dot) dot.style.background = `hsl(${hue},70%,50%)`;
    }

    applyCompanyTheme();
  }

  function applyCompanyTheme() {
    const ws = document.querySelector(".vault-workspace");
    if (!ws) return;
    if (currentCompany === null) {
      ws.style.setProperty("--vault-accent", "#3ecf8e");
      ws.style.setProperty("--vault-accent-soft", "rgba(62,207,142,0.1)");
      ws.style.setProperty("--vault-accent-hover", "#34b87a");
    } else if (currentCompany === "__other__") {
      ws.style.setProperty("--vault-accent", "#888");
      ws.style.setProperty("--vault-accent-soft", "rgba(136,136,136,0.1)");
      ws.style.setProperty("--vault-accent-hover", "#999");
    } else {
      const co = companies.find(c => c.id === currentCompany);
      const hue = co ? (co.avatar_color || 0) : 0;
      ws.style.setProperty("--vault-accent", `hsl(${hue},70%,50%)`);
      ws.style.setProperty("--vault-accent-soft", `hsla(${hue},70%,50%,0.1)`);
      ws.style.setProperty("--vault-accent-hover", `hsl(${hue},70%,42%)`);
    }
  }

  function toggleCompanyDropdown(show) {
    const dd = document.getElementById("vaultCompanyDropdown");
    const picker = document.getElementById("vaultCompanyPicker");
    if (!dd || !picker) return;
    const isOpen = dd.style.display !== "none";
    if (show === undefined) show = !isOpen;
    dd.style.display = show ? "flex" : "none";
    picker.classList.toggle("open", show);
  }

  function switchCompany(companyId) {
    currentCompany = companyId || null;
    renderCompanyDropdown();
    renderTree(); // Re-render tree to filter projects
  }

  // ─── Folder Tree ───────────────────────────────────────────────────────────

  // Build O(1) lookup: parentId -> children[], "__root__" for top-level, "__project_<pid>__" for project roots
  function _buildChildrenMap() {
    _childrenMap = new Map();
    for (const f of folderTree) {
      const key = f.parent_id || "__root__";
      const arr = _childrenMap.get(key);
      if (arr) arr.push(f);
      else _childrenMap.set(key, [f]);
    }
  }

  async function loadTree(forceRefresh = false) {
    const cacheKey = currentProject || "__global__";

    // Use cached data if available and not forcing refresh
    if (!forceRefresh && treeCache[cacheKey]) {
      folderTree = treeCache[cacheKey];
      _buildChildrenMap();
      renderTree();
      return;
    }

    // Fetch fresh data
    try {
      const params = currentProject ? `?project_id=${currentProject}` : "";
      folderTree = await apiFetch(`/vault/tree${params}`);
      treeCache[cacheKey] = folderTree; // Cache the result
    } catch (e) {
      console.warn("[Vault] Failed to load tree:", e);
      folderTree = [];
    }
    _buildChildrenMap();
    renderTree();
  }

  function renderTree() {
    if (!$tree) return;
    const prevScroll = $tree.scrollTop;

    // Capture expansion state from live DOM before destroying it
    if ($tree.children.length > 0) {
      $tree.querySelectorAll(".vault-tree-children.open").forEach(el => {
        const node = el.previousElementSibling;
        if (node?.dataset?.id) expandedNodes.add(node.dataset.id);
      });
    }

    // Auto-expand Projects node if viewing a project
    if (currentProject) {
      expandedNodes.add("__projects__");
      expandedNodes.add(`__project_${currentProject}__`);
    }

    // Minimalist folder icon (outline only)
    const folderIcon = `<svg class="tree-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H5a2 2 0 0 0-2 2Z"/></svg>`;

    // ALWAYS show the full tree structure (Global folders + Projects)
    const globalRoots = (_childrenMap.get("__root__") || []).filter(f => !f.project_id);
    let html = "";

    // Render global folders
    html += renderTreeNodes(globalRoots, 0, folderIcon);

    // Add virtual "Projects" folder with filtered projects
    let filteredProjects = projects;
    if (currentCompany === "__other__") {
      filteredProjects = projects.filter(p => !p.source_company);
    } else if (currentCompany) {
      filteredProjects = projects.filter(p => p.source_company === currentCompany);
    }

    const hasProjects = filteredProjects.length > 0;
    const projExpanded = expandedNodes.has("__projects__");
    const arrowClass = hasProjects ? `tree-arrow${projExpanded ? " expanded" : ""}` : "tree-arrow empty";
    const arrow = `<svg class="${arrowClass}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"></polyline></svg>`;

    html += `<div class="vault-tree-node" data-id="__projects__" data-name="Projects" data-virtual="true">`;
    html += `${arrow}${folderIcon}<span class="tree-label">Projects</span>`;
    html += `</div>`;

    // Add children (project folders)
    if (hasProjects) {
      html += `<div class="vault-tree-children${projExpanded ? " open" : ""}"><div class="vault-tree-children-inner">`;
      for (const p of filteredProjects) {
        const pid = p.project_id || p.id;
        const name = p.project_name || p.name || pid;
        const projNodeId = `__project_${pid}__`;
        const projNodeExpanded = expandedNodes.has(projNodeId);

        // Get project folders
        const projectFolders = (_childrenMap.get("__root__") || []).filter(f => f.project_id === pid);
        const hasSubfolders = projectFolders.length > 0;
        const arrow2Class = hasSubfolders ? `tree-arrow${projNodeExpanded ? " expanded" : ""}` : "tree-arrow empty";
        const arrow2 = `<svg class="${arrow2Class}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"></polyline></svg>`;

        const isActive = currentProject === pid && !currentFolder;
        html += `<div class="vault-tree-node${isActive ? " active" : ""}" data-id="${projNodeId}" data-project-id="${pid}" data-name="${escapeAttr(name)}" data-virtual="true">`;
        html += `<span class="tree-indent" style="width:16px"></span>${arrow2}${folderIcon}<span class="tree-label">${escapeHtml(name)}</span>`;
        html += `</div>`;

        // Add project folders as children
        if (hasSubfolders) {
          html += `<div class="vault-tree-children${projNodeExpanded ? " open" : ""}"><div class="vault-tree-children-inner">`;
          html += renderTreeNodes(projectFolders, 2, folderIcon);
          html += `</div></div>`;
        }
      }
      html += `</div></div>`;
    }

    $tree.innerHTML = html;
    $tree.scrollTop = prevScroll;
  }

  function renderTreeNodes(nodes, depth, folderIcon) {
    let html = "";
    for (const node of nodes) {
      const children = _childrenMap.get(node.id) || [];
      const hasChildren = children.length > 0;
      const isActive = currentFolder === node.id;
      const isExpanded = expandedNodes.has(node.id);
      const indent = `<span class="tree-indent" style="width:${depth * 16}px"></span>`;
      const arrowClass = hasChildren ? `tree-arrow${isExpanded ? " expanded" : ""}` : "tree-arrow empty";
      const arrow = `<svg class="${arrowClass}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"></polyline></svg>`;

      html += `<div class="vault-tree-node${isActive ? " active" : ""}" data-id="${node.id}" data-name="${escapeAttr(node.name)}">`;
      html += `${indent}${arrow}${folderIcon}<span class="tree-label">${escapeHtml(node.name)}</span>`;
      html += `</div>`;
      if (hasChildren) {
        html += `<div class="vault-tree-children${isExpanded ? " open" : ""}"><div class="vault-tree-children-inner">${renderTreeNodes(children, depth + 1, folderIcon)}</div></div>`;
      }
    }
    return html;
  }


  // ─── File Listing ──────────────────────────────────────────────────────────
  async function loadFiles(forceRefresh = false) {
    // Build cache key
    const cacheKey = `${currentProject || "__global__"}:${currentFolder || "__root__"}`;

    // Use cached data if available and not forcing refresh
    if (!forceRefresh && filesCache[cacheKey]) {
      files = filesCache[cacheKey];
      renderFiles();
      // Still check receipt status for cached files
      await checkReceiptStatus();
      return;
    }

    // Fetch fresh data
    try {
      let params = [];
      if (currentFolder) params.push(`parent_id=${currentFolder}`);
      if (currentProject) params.push(`project_id=${currentProject}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      files = await apiFetch(`/vault/files${qs}`);
      filesCache[cacheKey] = files; // Cache the result
    } catch (e) {
      console.warn("[Vault] Failed to load files:", e);
      files = [];
    }

    // Check receipt processing status if inside a Receipts folder
    await checkReceiptStatus();
    renderFiles();
  }

  async function checkReceiptStatus() {
    receiptStatusMap = {};
    const isReceiptsFolder = folderPath.length > 0 && folderPath[folderPath.length - 1].name === "Receipts";
    if (isReceiptsFolder && files.length > 0) {
      const hashes = files.filter(f => !f.is_folder && f.file_hash).map(f => f.file_hash);
      if (hashes.length > 0) {
        try {
          receiptStatusMap = await apiFetch(`/vault/receipt-status?hashes=${hashes.join(",")}`);
        } catch (_) {}
      }
    }
  }

  // Helper to invalidate file cache for current location
  function invalidateCurrentFilesCache() {
    const cacheKey = `${currentProject || "__global__"}:${currentFolder || "__root__"}`;
    delete filesCache[cacheKey];
  }

  // Helper to invalidate all caches (e.g., after major changes)
  function invalidateAllCaches() {
    treeCache = {};
    filesCache = {};
  }

  function renderFiles() {
    if (!$files || !$empty) return;

    const sorted = sortFiles(files);
    if (sorted.length === 0) {
      $files.style.display = "none";
      $empty.style.display = "flex";
      return;
    }
    $empty.style.display = "none";
    $files.style.display = "";

    if (viewMode === "grid") {
      $files.className = "vault-files vault-files-grid";
      $files.innerHTML = sorted.map(f => renderFileCard(f)).join("");
    } else {
      $files.className = "vault-files vault-files-list";
      const isReceipts = folderPath.length > 0 && folderPath[folderPath.length - 1].name === "Receipts";
      const col5Label = isReceipts ? "Status" : "Uploaded by";
      const header = `<div class="vault-list-header"><span></span><span>Name</span><span>Modified</span><span>Size</span><span>${col5Label}</span><span></span></div>`;
      $files.innerHTML = header + sorted.map(f => renderFileRow(f)).join("");
    }
  }

  function sortFiles(list) {
    const copy = [...list];
    // Folders first, then sort within each group
    copy.sort((a, b) => {
      if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
      switch (sortBy) {
        case "date": return (b.updated_at || "").localeCompare(a.updated_at || "");
        case "size": return (b.size_bytes || 0) - (a.size_bytes || 0);
        case "type": return (getFileType(a.name) || "").localeCompare(getFileType(b.name) || "");
        default: return a.name.localeCompare(b.name);
      }
    });
    return copy;
  }

  function renderFileCard(f) {
    const icon = f.is_folder ? getFolderIconHtml() : getFileIconHtml(f);
    const meta = f.is_folder ? "" : formatSize(f.size_bytes);
    const rStatus = !f.is_folder && f.file_hash && receiptStatusMap[f.file_hash];
    const badge = rStatus === "linked"
      ? `<span class="vault-receipt-badge linked" title="Processed"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span>`
      : rStatus
        ? `<span class="vault-receipt-badge pending" title="Pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></span>`
        : "";
    return `<div class="vault-file-card" data-id="${f.id}" data-folder="${f.is_folder}">
      <div class="file-icon ${getIconClass(f)}">${icon}${badge}</div>
      <div class="file-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</div>
      <div class="file-meta">${meta}</div>
    </div>`;
  }

  function renderFileRow(f) {
    const icon = f.is_folder ? getFolderIconSm() : getFileIconSm(f);
    const date = f.updated_at ? formatDate(f.updated_at) : "";
    const size = f.is_folder ? "--" : formatSize(f.size_bytes);
    const dotsIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
    const rStatus = !f.is_folder && f.file_hash && receiptStatusMap[f.file_hash];
    const statusBadge = rStatus === "linked"
      ? `<span class="vault-receipt-badge-row linked" title="Processed"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Processed</span>`
      : rStatus
        ? `<span class="vault-receipt-badge-row pending" title="Pending">Pending</span>`
        : "";

    return `<div class="vault-file-row" data-id="${f.id}" data-folder="${f.is_folder}">
      <div class="file-icon-sm ${getIconClass(f)}">${icon}</div>
      <div class="file-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</div>
      <div class="file-date">${date}</div>
      <div class="file-size">${size}</div>
      <div class="file-uploader">${statusBadge}</div>
      <button class="file-actions-btn" data-id="${f.id}">${dotsIcon}</button>
    </div>`;
  }

  // ─── Breadcrumb ────────────────────────────────────────────────────────────
  function renderBreadcrumb() {
    if (!$breadcrumb) return;

    let html = "";

    // Start with Vault (root)
    if (currentProject) {
      // When inside a project, "Vault" crumb returns to global vault
      html = `<span class="vault-crumb" data-id="" data-action="exit-project">Vault</span>`;
      // Add "Projects" as navigation step
      html += `<span class="vault-crumb" data-action="exit-project">Projects</span>`;
      // Add project name
      const project = projects.find(p => (p.project_id || p.id) === currentProject);
      const projectName = project ? (project.project_name || project.name) : currentProject;
      html += `<span class="vault-crumb" data-id="" data-in-project="true">${escapeHtml(projectName)}</span>`;
    } else {
      // Global vault root
      html = `<span class="vault-crumb vault-crumb-root" data-id="">Vault</span>`;
    }

    // Add folder path
    for (const crumb of folderPath) {
      html += `<span class="vault-crumb" data-id="${crumb.id}">${escapeHtml(crumb.name)}</span>`;
    }

    $breadcrumb.innerHTML = html;
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  async function navigateToFolder(folderId, folderName) {
    // Update state immediately
    if (folderId) {
      // Find if already in path
      const idx = folderPath.findIndex(c => c.id === folderId);
      if (idx >= 0) {
        folderPath = folderPath.slice(0, idx + 1);
      } else {
        folderPath.push({ id: folderId, name: folderName });
      }
      currentFolder = folderId;
    } else {
      folderPath = [];
      currentFolder = null;
    }

    // Update UI immediately (sync operations)
    renderBreadcrumb();
    updateBackButton();

    // Update tree active state immediately
    if ($tree) {
      $tree.querySelectorAll(".vault-tree-node").forEach(n => {
        n.classList.toggle("active", n.dataset.id === (currentFolder || ""));
      });
    }

    // Load files (async)
    await loadFiles();
  }

  function updateBackButton() {
    const btn = document.getElementById("btnTreeBack");
    if (!btn) return;

    // Enable back button if we're inside a folder or inside a project
    const canGoBack = folderPath.length > 0 || currentProject;
    btn.disabled = !canGoBack;
  }

  function goBack() {
    if (folderPath.length > 0) {
      // Go to parent folder
      folderPath.pop();
      if (folderPath.length > 0) {
        const parent = folderPath[folderPath.length - 1];
        navigateToFolder(parent.id, parent.name);
      } else {
        navigateToFolder(null, "");
      }
    } else if (currentProject) {
      // Exit project
      switchProject(null);
    }
  }

  async function switchProject(projectId) {
    // Update state immediately for instant visual feedback
    currentProject = projectId || null;
    currentFolder = null;
    folderPath = [];

    // Update UI immediately (sync operations)
    renderBreadcrumb();
    updateBackButton();

    // Update active state in tree immediately
    if ($tree) {
      $tree.querySelectorAll(".vault-tree-node").forEach(n => {
        const isThisProject = n.dataset.projectId === projectId;
        const isProjectRoot = n.dataset.id === `__project_${projectId}__`;
        n.classList.toggle("active", isThisProject || isProjectRoot);
      });
    }

    // Load data in parallel (async operations)
    await Promise.all([loadTree(), loadFiles()]);
  }

  // ─── Upload ────────────────────────────────────────────────────────────────
  async function uploadFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    const totalFiles = fileList.length;
    let uploaded = 0;

    showProgress(`Uploading 0/${totalFiles}...`, 0);

    for (const file of fileList) {
      try {
        if (file.size > 50 * 1024 * 1024) {
          await chunkedUpload(file);
        } else {
          await singleUpload(file);
        }
        uploaded++;
        const pct = Math.round((uploaded / totalFiles) * 100);
        showProgress(`Uploading ${uploaded}/${totalFiles}...`, pct);
      } catch (e) {
        console.error("[Vault] Upload failed:", file.name, e);
        if (window.Toast) window.Toast.error(`Failed to upload ${file.name}`);
      }
    }

    hideProgress();
    if (window.Toast && uploaded > 0) window.Toast.success(`Uploaded ${uploaded} file(s)`);
    await loadFiles(true);
  }

  async function singleUpload(file) {
    const formData = new FormData();
    formData.append("file", file);
    if (currentFolder) formData.append("parent_id", currentFolder);
    if (currentProject) formData.append("project_id", currentProject);

    await fetch(`${API_BASE}/vault/upload`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  }

  async function chunkedUpload(file) {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let uploadedChunks = 0;

    // Upload chunks with concurrency limit
    const queue = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);
      queue.push({ index: i, blob });
    }

    // Process in batches
    for (let b = 0; b < queue.length; b += CHUNK_CONCURRENCY) {
      const batch = queue.slice(b, b + CHUNK_CONCURRENCY);
      await Promise.all(batch.map(async (chunk) => {
        const formData = new FormData();
        formData.append("file", chunk.blob, `chunk_${chunk.index}`);
        formData.append("upload_id", uploadId);
        formData.append("chunk_index", String(chunk.index));
        formData.append("total_chunks", String(totalChunks));

        await fetch(`${API_BASE}/vault/upload-chunk`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        }).then(r => { if (!r.ok) throw new Error(r.statusText); });

        uploadedChunks++;
        const pct = Math.round((uploadedChunks / totalChunks) * 100);
        showProgress(`Uploading ${file.name} (${pct}%)...`, pct);
      }));
    }

    // Assemble
    showProgress(`Assembling ${file.name}...`, 95);
    const formData = new FormData();
    formData.append("upload_id", uploadId);
    formData.append("filename", file.name);
    formData.append("total_chunks", String(totalChunks));
    formData.append("content_type", file.type || "application/octet-stream");
    if (currentFolder) formData.append("parent_id", currentFolder);
    if (currentProject) formData.append("project_id", currentProject);

    await fetch(`${API_BASE}/vault/upload-complete`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
    }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  }

  function showProgress(text, pct) {
    if ($uploadProgress) $uploadProgress.style.display = "flex";
    if ($uploadFill) $uploadFill.style.width = `${pct}%`;
    if ($uploadText) $uploadText.textContent = text;
  }

  function hideProgress() {
    if ($uploadProgress) $uploadProgress.style.display = "none";
    if ($uploadFill) $uploadFill.style.width = "0%";
  }

  // ─── Context Menu ──────────────────────────────────────────────────────────
  function showContextMenu(e, fileId) {
    e.preventDefault();
    selectedFileId = fileId;
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    // Show/hide actions based on file type
    const isFolder = file.is_folder;
    $contextMenu.querySelectorAll("[data-action]").forEach(btn => {
      const action = btn.dataset.action;
      if (action === "download" || action === "duplicate" || action === "versions") {
        btn.style.display = isFolder ? "none" : "";
      }
    });

    $contextMenu.style.display = "block";
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    $contextMenu.style.left = `${x}px`;
    $contextMenu.style.top = `${y}px`;
  }

  function hideContextMenu() {
    if ($contextMenu) $contextMenu.style.display = "none";
  }

  async function handleContextAction(action) {
    hideContextMenu();
    if (!selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (!file) return;

    switch (action) {
      case "open":
        if (file.is_folder) {
          navigateToFolder(file.id, file.name);
        } else {
          // Open download URL
          const dlData = await apiFetch(`/vault/files/${file.id}/download`);
          if (dlData.url) window.open(dlData.url, "_blank");
        }
        break;

      case "download": {
        const dlData = await apiFetch(`/vault/files/${file.id}/download`);
        if (dlData.url) {
          const a = document.createElement("a");
          a.href = dlData.url;
          a.download = file.name;
          a.click();
        }
        break;
      }

      case "rename": {
        const newName = prompt("Enter new name:", file.name);
        if (newName && newName !== file.name) {
          await apiPatch(`/vault/files/${file.id}`, { name: newName });
          if (window.Toast) window.Toast.success("Renamed");
          await loadFiles(true);
          if (file.is_folder) await loadTree(true);
        }
        break;
      }

      case "move":
        openMoveModal(file.id);
        break;

      case "duplicate":
        try {
          await apiFetch(`/vault/duplicate/${file.id}`, { method: "POST" });
          if (window.Toast) window.Toast.success("Duplicated");
          await loadFiles(true); // Force refresh after duplicate
        } catch (e) {
          if (window.Toast) window.Toast.error("Duplicate failed");
        }
        break;

      case "versions":
        openVersionPanel(file);
        break;

      case "delete":
        if (confirm(`Delete "${file.name}"?`)) {
          await apiDelete(`/vault/files/${file.id}`);
          if (window.Toast) window.Toast.success("Deleted");
          await loadFiles(true);
          if (file.is_folder) await loadTree(true);
        }
        break;
    }
  }

  // ─── Move Modal ────────────────────────────────────────────────────────────
  let moveTargetId = null;

  function openMoveModal(fileId) {
    selectedFileId = fileId;
    moveTargetId = null;
    renderMoveTree();
    if ($moveModal) $moveModal.style.display = "flex";
  }

  function closeMoveModal() {
    if ($moveModal) $moveModal.style.display = "none";
  }

  function renderMoveTree() {
    if (!$moveTree) return;
    // Root option
    let html = `<div class="vault-move-node${moveTargetId === null ? " selected" : ""}" data-id="">(Root)</div>`;
    const roots = _childrenMap.get("__root__") || [];
    html += renderMoveNodes(roots, 0);
    $moveTree.innerHTML = html;
  }

  function renderMoveNodes(nodes, depth) {
    let html = "";
    for (const node of nodes) {
      if (node.id === selectedFileId) continue; // Can't move into itself
      const children = _childrenMap.get(node.id) || [];
      const indent = `<span class="move-indent" style="width:${depth * 20}px"></span>`;
      const sel = moveTargetId === node.id ? " selected" : "";
      const folderIcon = `<svg class="vault-folder-svg" width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0"><path class="vault-folder-back" d="M2 6a2 2 0 0 1 2-2h4.6a1 1 0 0 1 .7.3L11 6h9a2 2 0 0 1 2 2v1H2z"/><path class="vault-folder-front" d="M2 9h20v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>`;
      html += `<div class="vault-move-node${sel}" data-id="${node.id}">${indent}${folderIcon} ${escapeHtml(node.name)}</div>`;
      if (children.length) html += renderMoveNodes(children, depth + 1);
    }
    return html;
  }

  async function confirmMove() {
    if (!selectedFileId) return;
    try {
      const movedFile = files.find(f => f.id === selectedFileId);
      await apiPatch(`/vault/files/${selectedFileId}`, { parent_id: moveTargetId });
      if (window.Toast) window.Toast.success("Moved");
      closeMoveModal();
      await loadFiles(true);
      if (movedFile?.is_folder) await loadTree(true);
    } catch (e) {
      if (window.Toast) window.Toast.error("Move failed");
    }
  }

  // ─── Version History ───────────────────────────────────────────────────────
  let versionFileId = null;

  async function openVersionPanel(file) {
    versionFileId = file.id;
    if ($versionFileName) $versionFileName.textContent = file.name;
    if ($versionPanel) $versionPanel.style.display = "flex";
    await loadVersions();
  }

  function closeVersionPanel() {
    if ($versionPanel) $versionPanel.style.display = "none";
    versionFileId = null;
  }

  async function loadVersions() {
    if (!versionFileId || !$versionList) return;
    try {
      const versions = await apiFetch(`/vault/files/${versionFileId}/versions`);
      $versionList.innerHTML = versions.map(v => {
        const date = formatDate(v.created_at);
        const size = formatSize(v.size_bytes);
        const comment = v.comment ? `<div class="version-comment">${escapeHtml(v.comment)}</div>` : "";
        return `<div class="vault-version-item" data-id="${v.id}">
          <div class="version-info">
            <span class="version-number">Version ${v.version_number}</span>
            <span class="version-meta">${date} - ${size}</span>
            ${comment}
          </div>
          <div class="version-actions">
            <button data-action="download-version" data-version-id="${v.id}">Download</button>
            <button data-action="restore-version" data-version-id="${v.id}">Restore</button>
          </div>
        </div>`;
      }).join("") || "<p style='padding:16px;color:rgba(255,255,255,0.3);font-size:13px;'>No versions found</p>";
    } catch (e) {
      console.warn("[Vault] Failed to load versions:", e);
    }
  }

  async function uploadNewVersion(file) {
    if (!versionFileId) return;
    const comment = prompt("Version comment (optional):");
    const formData = new FormData();
    formData.append("file", file);
    if (comment) formData.append("comment", comment);

    try {
      await fetch(`${API_BASE}/vault/files/${versionFileId}/versions`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
      if (window.Toast) window.Toast.success("New version uploaded");
      await loadVersions();
      await loadFiles(true); // Force refresh after version upload
    } catch (e) {
      if (window.Toast) window.Toast.error("Version upload failed");
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  let searchTimeout = null;

  function handleSearch(query) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (!query.trim()) {
        await loadFiles();
        return;
      }
      try {
        const body = { query: query.trim(), limit: 50 };
        if (currentProject) body.project_id = currentProject;
        files = await apiPost("/vault/search", body);
        renderFiles();
      } catch (e) {
        console.warn("[Vault] Search failed:", e);
      }
    }, 300);
  }

  // ─── New Folder ────────────────────────────────────────────────────────────
  async function createNewFolder() {
    const name = prompt("Folder name:");
    if (!name) return;
    try {
      await apiPost("/vault/folders", {
        name,
        parent_id: currentFolder,
        project_id: currentProject,
      });
      if (window.Toast) window.Toast.success("Folder created");
      await Promise.all([loadFiles(true), loadTree(true)]);
    } catch (e) {
      if (window.Toast) window.Toast.error("Failed to create folder");
    }
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  function setupDragDrop() {
    if (!$contentPanel) return;
    let dragCounter = 0;

    $contentPanel.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if ($dropzone) $dropzone.classList.add("active");
    });
    $contentPanel.addEventListener("dragleave", () => {
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if ($dropzone) $dropzone.classList.remove("active");
      }
    });
    $contentPanel.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    $contentPanel.addEventListener("drop", (e) => {
      e.preventDefault();
      dragCounter = 0;
      if ($dropzone) $dropzone.classList.remove("active");
      if (e.dataTransfer?.files?.length) {
        uploadFiles(e.dataTransfer.files);
      }
    });
  }

  // ─── Resizer ───────────────────────────────────────────────────────────────
  function setupResizer() {
    if (!$resizer || !$treePanel) return;
    let startX, startWidth, rafId = 0, lastW = 0;

    $resizer.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startWidth = $treePanel.offsetWidth;
      lastW = startWidth;
      $resizer.classList.add("active");
      $treePanel.classList.add("resizing");
      document.addEventListener("mousemove", onResize);
      document.addEventListener("mouseup", stopResize);
    });

    function onResize(e) {
      lastW = Math.max(180, Math.min(400, startWidth + (e.clientX - startX)));
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          $treePanel.style.width = `${lastW}px`;
          rafId = 0;
        });
      }
    }
    function stopResize() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      $treePanel.style.width = `${lastW}px`;
      $resizer.classList.remove("active");
      $treePanel.classList.remove("resizing");
      document.removeEventListener("mousemove", onResize);
      document.removeEventListener("mouseup", stopResize);
    }
  }

  // ─── Event Bindings ────────────────────────────────────────────────────────
  function bindEvents() {
    // Company dropdown toggle
    document.getElementById("vaultCompanyBtn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCompanyDropdown();
    });

    // Company dropdown option click
    document.getElementById("vaultCompanyDropdown")?.addEventListener("click", (e) => {
      const opt = e.target.closest(".vault-company-option");
      if (!opt) return;
      const companyId = opt.dataset.company || null;
      toggleCompanyDropdown(false);
      switchCompany(companyId);
    });

    // Close dropdown on click outside
    document.addEventListener("click", (e) => {
      const picker = document.getElementById("vaultCompanyPicker");
      if (picker && !picker.contains(e.target)) {
        toggleCompanyDropdown(false);
      }
    });

    // Tree clicks
    $tree?.addEventListener("click", (e) => {
      const node = e.target.closest(".vault-tree-node");
      if (!node) return;
      const id = node.dataset.id;
      const name = node.dataset.name;
      const isVirtual = node.dataset.virtual === "true";

      // Toggle children
      const childrenEl = node.nextElementSibling;
      if (childrenEl?.classList.contains("vault-tree-children")) {
        const isNowOpen = !childrenEl.classList.contains("open");
        childrenEl.classList.toggle("open");
        const arrow = node.querySelector(".tree-arrow");
        if (arrow) arrow.classList.toggle("expanded");

        // Update expandedNodes Set to preserve state
        if (isNowOpen) {
          expandedNodes.add(id);
        } else {
          expandedNodes.delete(id);
        }
      }

      // Handle virtual nodes
      if (isVirtual) {
        if (id === "__projects__") {
          // Just expand/collapse the Projects folder, don't navigate
          return;
        } else if (id && id.startsWith("__project_")) {
          // Extract project ID and switch to it
          const projectId = node.dataset.projectId;
          if (projectId) switchProject(projectId);
          return;
        }
      }

      // Regular folder navigation
      navigateToFolder(id, name);
    });

    // Breadcrumb clicks
    $breadcrumb?.addEventListener("click", (e) => {
      const crumb = e.target.closest(".vault-crumb");
      if (!crumb) return;

      // Handle exit project action
      if (crumb.dataset.action === "exit-project") {
        switchProject(null); // Return to global vault
        return;
      }

      // Handle in-project root click (reset to project root)
      if (crumb.dataset.inProject === "true") {
        navigateToFolder(null, "");
        return;
      }

      // Handle regular folder navigation
      const id = crumb.dataset.id || null;
      if (id === currentFolder) return;
      if (!id) {
        navigateToFolder(null, "");
      } else {
        const folder = folderPath.find(c => c.id === id);
        if (folder) navigateToFolder(id, folder.name);
      }
    });

    // File clicks (open folder or select)
    $files?.addEventListener("click", (e) => {
      const card = e.target.closest(".vault-file-card, .vault-file-row");
      if (!card) return;
      const id = card.dataset.id;
      const isFolder = card.dataset.folder === "true";
      if (isFolder) {
        const file = files.find(f => f.id === id);
        if (file) navigateToFolder(id, file.name);
      } else {
        // Select file
        $files.querySelectorAll(".vault-file-card, .vault-file-row").forEach(el => el.classList.remove("selected"));
        card.classList.add("selected");
        selectedFileId = id;
      }
    });

    // File double-click (open)
    $files?.addEventListener("dblclick", async (e) => {
      const card = e.target.closest(".vault-file-card, .vault-file-row");
      if (!card) return;
      const id = card.dataset.id;
      const isFolder = card.dataset.folder === "true";
      if (!isFolder) {
        const dlData = await apiFetch(`/vault/files/${id}/download`);
        if (dlData.url) window.open(dlData.url, "_blank");
      }
    });

    // Context menu (right-click)
    $files?.addEventListener("contextmenu", (e) => {
      const card = e.target.closest(".vault-file-card, .vault-file-row");
      if (card) {
        showContextMenu(e, card.dataset.id);
      }
    });

    // List mode 3-dots button
    $files?.addEventListener("click", (e) => {
      const btn = e.target.closest(".file-actions-btn");
      if (btn) {
        e.stopPropagation();
        showContextMenu(e, btn.dataset.id);
      }
    });

    // Context menu actions
    $contextMenu?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (btn) handleContextAction(btn.dataset.action);
    });

    // Close context menu on click outside
    document.addEventListener("click", (e) => {
      if (!$contextMenu?.contains(e.target)) hideContextMenu();
    });

    // Upload button
    document.getElementById("btnUpload")?.addEventListener("click", () => {
      $fileInput?.click();
    });

    // File input change
    $fileInput?.addEventListener("change", (e) => {
      if (e.target.files?.length) {
        uploadFiles(e.target.files);
        e.target.value = "";
      }
    });

    // New folder button
    document.getElementById("btnNewFolder")?.addEventListener("click", createNewFolder);

    // Back button
    document.getElementById("btnTreeBack")?.addEventListener("click", goBack);

    // Toggle view
    document.getElementById("btnToggleView")?.addEventListener("click", () => {
      viewMode = viewMode === "grid" ? "list" : "grid";
      renderFiles();
    });

    // Search
    $searchInput?.addEventListener("input", (e) => handleSearch(e.target.value));

    // Tree collapse
    document.getElementById("btnCollapseTree")?.addEventListener("click", () => {
      $treePanel?.classList.toggle("collapsed");
    });

    // Version panel
    document.getElementById("btnCloseVersions")?.addEventListener("click", closeVersionPanel);

    // Upload new version
    document.getElementById("btnUploadVersion")?.addEventListener("click", () => {
      $versionFileInput?.click();
    });
    $versionFileInput?.addEventListener("change", (e) => {
      if (e.target.files?.[0]) {
        uploadNewVersion(e.target.files[0]);
        e.target.value = "";
      }
    });

    // Version actions
    $versionList?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const versionId = btn.dataset.versionId;
      if (btn.dataset.action === "download-version") {
        const dlData = await apiFetch(`/vault/files/${versionFileId}/download?version_id=${versionId}`);
        if (dlData.url) window.open(dlData.url, "_blank");
      } else if (btn.dataset.action === "restore-version") {
        if (confirm("Restore this version as the current version?")) {
          await apiFetch(`/vault/files/${versionFileId}/restore/${versionId}`, { method: "POST" });
          if (window.Toast) window.Toast.success("Version restored");
          await loadVersions();
          await loadFiles(true); // Force refresh after version restore
        }
      }
    });

    // Move modal
    document.getElementById("btnCloseMoveModal")?.addEventListener("click", closeMoveModal);
    document.getElementById("btnCancelMove")?.addEventListener("click", closeMoveModal);
    document.getElementById("btnConfirmMove")?.addEventListener("click", confirmMove);
    $moveTree?.addEventListener("click", (e) => {
      const node = e.target.closest(".vault-move-node");
      if (!node) return;
      moveTargetId = node.dataset.id || null;
      $moveTree.querySelectorAll(".vault-move-node").forEach(n => n.classList.remove("selected"));
      node.classList.add("selected");
    });

    // Drag & drop + resizer
    setupDragDrop();
    setupResizer();
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return (str || "").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function getFileType(name) {
    const ext = (name || "").split(".").pop().toLowerCase();
    return ext;
  }

  function getIconClass(f) {
    if (f.is_folder) return "folder-icon";
    const ext = getFileType(f.name);
    if (ext === "pdf") return "pdf-icon";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image-icon";
    if (["rvt", "rfa", "rte"].includes(ext)) return "revit-icon";
    if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet-icon";
    if (["doc", "docx", "txt", "rtf", "odt"].includes(ext)) return "doc-icon";
    if (["ppt", "pptx", "key"].includes(ext)) return "presentation-icon";
    if (["dwg", "dxf", "skp"].includes(ext)) return "cad-icon";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive-icon";
    if (["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm"].includes(ext)) return "video-icon";
    if (["mp3", "wav", "aac", "flac", "ogg", "m4a", "wma"].includes(ext)) return "audio-icon";
    if (ext === "ngm") return "ngm-icon";
    return "default-icon";
  }

  function getFolderIconHtml() {
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H5a2 2 0 0 0-2 2Z"/></svg>`;
  }

  function getFolderIconSm() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8l-2-2H5a2 2 0 0 0-2 2Z"/></svg>`;
  }

  // ─── SVG Icon Library ─────────────────────────────────────────────────────
  const _SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

  const _ICONS = {
    // PDF - document with corner fold + "PDF" label lines
    pdf: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 12h1.5a1.5 1.5 0 0 0 0-3H8v7"/><path d="M14 16h1a2 2 0 0 0 0-4h-1v7"/>`,
    // Image - frame with mountain + sun
    image: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>`,
    // Spreadsheet - grid table
    spreadsheet: `<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>`,
    // Document - page with paragraph lines
    doc: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>`,
    // Presentation - screen with play triangle
    presentation: `<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><polygon points="10 7 10 13 15 10"/>`,
    // Revit/BIM - 3D stacked layers
    revit: `<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>`,
    // CAD - drafting pen/ruler
    cad: `<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/><path d="m15 5 4 4"/>`,
    // Archive - zipped package
    archive: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="10" y="12" width="4" height="5" rx="1"/><line x1="12" y1="11" x2="12" y2="12"/>`,
    // Video - play rectangle
    video: `<rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10 9 10 15 15 12"/>`,
    // Audio - music note
    audio: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
    // NGM - hexagon star
    ngm: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/>`,
    // Default - blank document
    default: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>`,
  };

  function _iconKey(ext) {
    if (ext === "pdf") return "pdf";
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["rvt", "rfa", "rte"].includes(ext)) return "revit";
    if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
    if (["doc", "docx", "txt", "rtf", "odt"].includes(ext)) return "doc";
    if (["ppt", "pptx", "key"].includes(ext)) return "presentation";
    if (["dwg", "dxf", "skp"].includes(ext)) return "cad";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
    if (["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm"].includes(ext)) return "video";
    if (["mp3", "wav", "aac", "flac", "ogg", "m4a", "wma"].includes(ext)) return "audio";
    if (ext === "ngm") return "ngm";
    return "default";
  }

  function getFileIconHtml(f) {
    const ext = getFileType(f.name);
    // Image thumbnails in grid mode
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext) && f.bucket_path) {
      const url = `${window.SUPABASE_URL}/storage/v1/object/public/vault/${f.bucket_path}`;
      return `<img src="${url}?width=96&height=96&resize=contain" alt="" />`;
    }
    const key = _iconKey(ext);
    return `<svg width="28" height="28" viewBox="0 0 24 24" ${_SVG_ATTRS}>${_ICONS[key]}</svg>`;
  }

  function getFileIconSm(f) {
    const ext = getFileType(f.name);
    const key = _iconKey(ext);
    return `<svg width="18" height="18" viewBox="0 0 24 24" ${_SVG_ATTRS}>${_ICONS[key]}</svg>`;
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const mon = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const year = d.getFullYear().toString().slice(-2);
    return `${mon}/${day}/${year}`;
  }

  // ─── Boot ──────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
