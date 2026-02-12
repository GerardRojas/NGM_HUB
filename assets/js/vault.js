// assets/js/vault.js
// ================================
// Data Vault - File Storage Module
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
  let currentProject = null;   // null = global vault
  let currentFolder = null;    // null = root
  let folderPath = [];         // breadcrumb [{id, name}, ...]
  let folderTree = [];         // flat list of all folders
  let files = [];              // current folder contents
  let viewMode = "grid";       // 'grid' | 'list'
  let sortBy = "name";         // 'name' | 'date' | 'size' | 'type'
  let selectedFileId = null;   // currently selected file for context menu
  let projects = [];           // user's projects

  // ─── DOM refs ──────────────────────────────────────────────────────────────
  const $tree = document.getElementById("vaultTree");
  const $files = document.getElementById("vaultFiles");
  const $empty = document.getElementById("vaultEmpty");
  const $breadcrumb = document.getElementById("vaultBreadcrumb");
  const $tabs = document.getElementById("vaultTabs");
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
    await loadProjects();
    renderTabs();
    await loadTree();
    await loadFiles();
    bindEvents();
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

  // ─── Projects ──────────────────────────────────────────────────────────────
  async function loadProjects() {
    try {
      const data = await apiFetch("/projects");
      projects = Array.isArray(data) ? data : (data.projects || data.data || []);
    } catch (e) {
      console.warn("[Vault] Failed to load projects:", e);
      projects = [];
    }
  }

  function renderTabs() {
    if (!$tabs) return;
    let html = `<button class="vault-tab${currentProject === null ? " active" : ""}" data-project="">Global Vault</button>`;
    for (const p of projects) {
      const pid = p.project_id || p.id;
      const name = p.project_name || p.name || pid;
      const active = currentProject === pid ? " active" : "";
      html += `<button class="vault-tab${active}" data-project="${pid}">${escapeHtml(name)}</button>`;
    }
    $tabs.innerHTML = html;
  }

  // ─── Folder Tree ───────────────────────────────────────────────────────────
  async function loadTree() {
    try {
      const params = currentProject ? `?project_id=${currentProject}` : "";
      folderTree = await apiFetch(`/vault/tree${params}`);
    } catch (e) {
      console.warn("[Vault] Failed to load tree:", e);
      folderTree = [];
    }
    renderTree();
  }

  function renderTree() {
    if (!$tree) return;
    const roots = folderTree.filter(f => !f.parent_id);
    $tree.innerHTML = renderTreeNodes(roots, 0);
  }

  function renderTreeNodes(nodes, depth) {
    let html = "";
    for (const node of nodes) {
      const children = folderTree.filter(f => f.parent_id === node.id);
      const hasChildren = children.length > 0;
      const isActive = currentFolder === node.id;
      const indent = `<span class="tree-indent" style="width:${depth * 16}px"></span>`;
      const arrowClass = hasChildren ? "tree-arrow" : "tree-arrow empty";
      const arrow = `<svg class="${arrowClass}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 6 15 12 9 18"></polyline></svg>`;
      const folderIcon = `<svg class="tree-folder-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;

      html += `<div class="vault-tree-node${isActive ? " active" : ""}" data-id="${node.id}" data-name="${escapeAttr(node.name)}">`;
      html += `${indent}${arrow}${folderIcon}<span class="tree-label">${escapeHtml(node.name)}</span>`;
      html += `</div>`;
      if (hasChildren) {
        html += `<div class="vault-tree-children">${renderTreeNodes(children, depth + 1)}</div>`;
      }
    }
    return html;
  }

  // ─── File Listing ──────────────────────────────────────────────────────────
  async function loadFiles() {
    try {
      let params = [];
      if (currentFolder) params.push(`parent_id=${currentFolder}`);
      if (currentProject) params.push(`project_id=${currentProject}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      files = await apiFetch(`/vault/files${qs}`);
    } catch (e) {
      console.warn("[Vault] Failed to load files:", e);
      files = [];
    }
    renderFiles();
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
      const header = `<div class="vault-list-header"><span></span><span>Name</span><span>Modified</span><span>Size</span><span>Uploaded by</span><span></span></div>`;
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
    return `<div class="vault-file-card" data-id="${f.id}" data-folder="${f.is_folder}">
      <div class="file-icon ${getIconClass(f)}">${icon}</div>
      <div class="file-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</div>
      <div class="file-meta">${meta}</div>
    </div>`;
  }

  function renderFileRow(f) {
    const icon = f.is_folder ? getFolderIconSm() : getFileIconSm(f);
    const date = f.updated_at ? formatDate(f.updated_at) : "";
    const size = f.is_folder ? "--" : formatSize(f.size_bytes);
    const dotsIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;

    return `<div class="vault-file-row" data-id="${f.id}" data-folder="${f.is_folder}">
      <div class="file-icon-sm ${getIconClass(f)}">${icon}</div>
      <div class="file-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</div>
      <div class="file-date">${date}</div>
      <div class="file-size">${size}</div>
      <div class="file-uploader"></div>
      <button class="file-actions-btn" data-id="${f.id}">${dotsIcon}</button>
    </div>`;
  }

  // ─── Breadcrumb ────────────────────────────────────────────────────────────
  function renderBreadcrumb() {
    if (!$breadcrumb) return;
    let html = `<span class="vault-crumb vault-crumb-root" data-id="">Vault</span>`;
    for (const crumb of folderPath) {
      html += `<span class="vault-crumb" data-id="${crumb.id}">${escapeHtml(crumb.name)}</span>`;
    }
    $breadcrumb.innerHTML = html;
  }

  // ─── Navigation ────────────────────────────────────────────────────────────
  function navigateToFolder(folderId, folderName) {
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
    renderBreadcrumb();
    loadFiles();
    // Update tree active state
    if ($tree) {
      $tree.querySelectorAll(".vault-tree-node").forEach(n => {
        n.classList.toggle("active", n.dataset.id === (currentFolder || ""));
      });
    }
  }

  function switchProject(projectId) {
    currentProject = projectId || null;
    currentFolder = null;
    folderPath = [];
    renderBreadcrumb();
    renderTabs();
    loadTree();
    loadFiles();
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
    await loadFiles();
    await loadTree();
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
          await loadFiles();
          await loadTree();
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
          await loadFiles();
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
          await loadFiles();
          await loadTree();
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
    const roots = folderTree.filter(f => !f.parent_id);
    html += renderMoveNodes(roots, 0);
    $moveTree.innerHTML = html;
  }

  function renderMoveNodes(nodes, depth) {
    let html = "";
    for (const node of nodes) {
      if (node.id === selectedFileId) continue; // Can't move into itself
      const children = folderTree.filter(f => f.parent_id === node.id);
      const indent = `<span class="move-indent" style="width:${depth * 20}px"></span>`;
      const sel = moveTargetId === node.id ? " selected" : "";
      const folderIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#3ecf8e;flex-shrink:0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
      html += `<div class="vault-move-node${sel}" data-id="${node.id}">${indent}${folderIcon} ${escapeHtml(node.name)}</div>`;
      if (children.length) html += renderMoveNodes(children, depth + 1);
    }
    return html;
  }

  async function confirmMove() {
    if (!selectedFileId) return;
    try {
      await apiPatch(`/vault/files/${selectedFileId}`, { parent_id: moveTargetId });
      if (window.Toast) window.Toast.success("Moved");
      closeMoveModal();
      await loadFiles();
      await loadTree();
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
      await loadFiles();
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
      await loadFiles();
      await loadTree();
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
    let startX, startWidth;

    $resizer.addEventListener("mousedown", (e) => {
      startX = e.clientX;
      startWidth = $treePanel.offsetWidth;
      $resizer.classList.add("active");
      document.addEventListener("mousemove", onResize);
      document.addEventListener("mouseup", stopResize);
    });

    function onResize(e) {
      const w = Math.max(180, Math.min(400, startWidth + (e.clientX - startX)));
      $treePanel.style.width = `${w}px`;
    }
    function stopResize() {
      $resizer.classList.remove("active");
      document.removeEventListener("mousemove", onResize);
      document.removeEventListener("mouseup", stopResize);
    }
  }

  // ─── Event Bindings ────────────────────────────────────────────────────────
  function bindEvents() {
    // Tab clicks
    $tabs?.addEventListener("click", (e) => {
      const tab = e.target.closest(".vault-tab");
      if (!tab) return;
      const pid = tab.dataset.project || null;
      switchProject(pid);
    });

    // Tree clicks
    $tree?.addEventListener("click", (e) => {
      const node = e.target.closest(".vault-tree-node");
      if (!node) return;
      const id = node.dataset.id;
      const name = node.dataset.name;

      // Toggle children
      const childrenEl = node.nextElementSibling;
      if (childrenEl?.classList.contains("vault-tree-children")) {
        childrenEl.classList.toggle("open");
        const arrow = node.querySelector(".tree-arrow");
        if (arrow) arrow.classList.toggle("expanded");
      }
      navigateToFolder(id, name);
    });

    // Breadcrumb clicks
    $breadcrumb?.addEventListener("click", (e) => {
      const crumb = e.target.closest(".vault-crumb");
      if (!crumb) return;
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
          await loadFiles();
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
    if (ext === "ngm") return "ngm-icon";
    return "default-icon";
  }

  function getFolderIconHtml() {
    return `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
  }

  function getFolderIconSm() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
  }

  function getFileIconHtml(f) {
    const ext = getFileType(f.name);
    const size = 28;
    // Check if image - show thumbnail
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext) && f.bucket_path) {
      const url = `${window.SUPABASE_URL}/storage/v1/object/public/vault/${f.bucket_path}`;
      return `<img src="${url}?width=96&height=96&resize=contain" alt="" />`;
    }
    if (ext === "pdf") return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
    if (["rvt", "rfa", "rte"].includes(ext)) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    if (["xls", "xlsx", "csv"].includes(ext)) return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><rect x="8" y="12" width="8" height="6"></rect></svg>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
  }

  function getFileIconSm(f) {
    const ext = getFileType(f.name);
    const s = 18;
    if (ext === "pdf") return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path></svg>`;
    if (["rvt", "rfa", "rte"].includes(ext)) return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
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
