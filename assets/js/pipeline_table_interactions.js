// assets/js/pipeline_table_interactions.js
(function () {
  "use strict";

  console.log("[PIPELINE-INTERACTIONS] Script loaded at:", new Date().toISOString());

  const wrapper = document.getElementById("pm-groups-wrapper");
  console.log("[PIPELINE-INTERACTIONS] Wrapper element:", wrapper);
  console.log("[PIPELINE-INTERACTIONS] Wrapper innerHTML length:", wrapper?.innerHTML?.length || 0);

  if (!wrapper) {
    console.error("[PIPELINE-INTERACTIONS] ERROR: wrapper not found! Aborting.");
    return;
  }

  // Prevent double initialization (fixes memory leak from duplicate listeners)
  if (wrapper._pipelineInteractionsInitialized) {
    console.log("[PIPELINE-INTERACTIONS] Already initialized, skipping.");
    return;
  }
  wrapper._pipelineInteractionsInitialized = true;

  // Debug: verify wrapper is correct element
  console.log("[PIPELINE-INTERACTIONS] Wrapper id:", wrapper.id);
  console.log("[PIPELINE-INTERACTIONS] Wrapper className:", wrapper.className);

  // ================================
  // CONFIGURACIÓN DE COLUMNAS
  // ================================

  // Columnas editables con input de texto
  const TEXT_COLS = ["task"];

  // Columnas editables con textarea (texto largo)
  const TEXTAREA_COLS = ["task"];

  // Columnas de personas (dropdown de usuarios)
  const PERSON_COLS = ["owner", "collaborator", "manager"];

  // Columns that support multiple people selection (subset of PERSON_COLS)
  const MULTI_PERSON_COLS = ["collaborator", "manager"];

  // Columnas de fecha (date picker)
  // Note: time_start and time_finish are hidden (backend only calculations)
  const DATE_COLS = ["due", "start", "deadline"];

  // Columnas con dropdown de catálogos
  const CATALOG_COLS = ["project", "company", "department", "type", "priority"];

  // Columnas numéricas (horas)
  const NUMBER_COLS = ["est"];

  // Columnas de solo lectura
  const READONLY_COLS = ["links", "finished"];

  // ================================
  // CACHE DE USUARIOS Y CATÁLOGOS
  // ================================
  let usersCache = null;
  let catalogsCache = {
    projects: null,
    companies: null,
    departments: null,
    types: null,
    priorities: null
  };

  async function loadUsers() {
    if (usersCache) return usersCache;

    try {
      const apiBase = window.API_BASE || "";
      const res = await fetch(`${apiBase}/users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");

      const data = await res.json();
      usersCache = Array.isArray(data) ? data : (data.users || []);
      return usersCache;
    } catch (err) {
      console.error("[PIPELINE] Error loading users:", err);
      return [];
    }
  }

  async function loadCatalogs() {
    const apiBase = window.API_BASE || "";

    try {
      // Load all catalogs in parallel
      // Note: projects uses /projects endpoint, but others use /pipeline/* prefix
      const [projectsRes, companiesRes, departmentsRes, typesRes, prioritiesRes] = await Promise.all([
        fetch(`${apiBase}/projects`, { credentials: "include" }).catch(() => null),
        fetch(`${apiBase}/pipeline/companies`, { credentials: "include" }).catch(() => null),
        fetch(`${apiBase}/pipeline/task-departments`, { credentials: "include" }).catch(() => null),
        fetch(`${apiBase}/pipeline/task-types`, { credentials: "include" }).catch(() => null),
        fetch(`${apiBase}/pipeline/task-priorities`, { credentials: "include" }).catch(() => null)
      ]);

      // Parse responses
      if (projectsRes?.ok) {
        const data = await projectsRes.json();
        catalogsCache.projects = Array.isArray(data) ? data : (data.data || []);
      }

      if (companiesRes?.ok) {
        const data = await companiesRes.json();
        catalogsCache.companies = Array.isArray(data) ? data : (data.data || []);
      }

      if (departmentsRes?.ok) {
        const data = await departmentsRes.json();
        catalogsCache.departments = Array.isArray(data) ? data : (data.data || []);
      }

      if (typesRes?.ok) {
        const data = await typesRes.json();
        catalogsCache.types = Array.isArray(data) ? data : (data.data || []);
      }

      if (prioritiesRes?.ok) {
        const data = await prioritiesRes.json();
        catalogsCache.priorities = Array.isArray(data) ? data : (data.data || []);
      }

    } catch (err) {
      console.error("[PIPELINE] Error loading catalogs:", err);
    }
  }

  // Load catalogs on page load
  loadCatalogs();

  // ================================
  // ESTADO DE EDICIÓN
  // ================================
  let activeEditor = null;

  function closeActiveEditor(save = false) {
    if (!activeEditor) return;
    console.log("[PIPELINE-INTERACTIONS] closeActiveEditor called, save:", save);

    const { element, td, taskId, colKey, originalValue, type, alreadySaved } = activeEditor;

    // Don't save again if picker already saved via onChange
    if (save && !alreadySaved) {
      const newValue = getEditorValue(element, type);
      if (newValue !== originalValue) {
        saveFieldToBackend(taskId, colKey, newValue, td);
      }
    }

    // Restaurar contenido original si no se guardó (and wasn't already saved by picker)
    if (!save && !alreadySaved) {
      restoreCellContent(td, colKey, originalValue);
    }

    // Destroy picker instances to clean up event listeners
    if (element._picker && typeof element._picker.destroy === 'function') {
      console.log("[PIPELINE-INTERACTIONS] Destroying picker instance");
      element._picker.destroy();
    }

    // Remove editing classes from cell and parents (for dropdown overflow)
    td.classList.remove("pm-cell-editing", "pm-cell-editing--text", "pm-cell-editing--picker");
    const tr = td.closest("tr");
    const tbody = td.closest("tbody");
    const table = td.closest("table");
    const groupBody = td.closest(".pm-group-body");
    const group = td.closest(".pm-group");
    if (tr) tr.classList.remove("pm-has-editing");
    if (tbody) tbody.classList.remove("pm-has-editing");
    if (table) table.classList.remove("pm-has-editing");
    if (groupBody) groupBody.classList.remove("pm-has-editing");
    if (group) group.classList.remove("pm-has-editing");

    activeEditor = null;
  }

  function getEditorValue(element, type) {
    if (type === "person-dropdown") {
      // People picker uses _getValue function
      if (typeof element._getValue === "function") {
        return element._getValue();
      }
      return element.value || null;
    }
    if (type === "catalog-dropdown") {
      // Catalog picker uses _getValue function
      if (typeof element._getValue === "function") {
        return element._getValue();
      }
      return element.value || null;
    }
    if (type === "number") {
      const numValue = parseFloat(element.value);
      if (!isNaN(numValue) && numValue >= 0) {
        return numValue; // Return as number, backend will handle formatting
      }
      return null;
    }
    return element.value?.trim() || null;
  }

  // ================================
  // GUARDAR EN BACKEND
  // ================================
  async function saveFieldToBackend(taskId, colKey, newValue, td) {
    const apiBase = window.API_BASE || "";

    // Mapear columna UI -> campo backend
    // Note: collaborators/managers (plural) are for array values from multi-select pickers
    const fieldMap = {
      task: "task_description",
      project: "project",
      company: "company",
      department: "department",
      type: "type",
      owner: "owner",
      collaborator: "collaborator",
      collaborators: "collaborators",  // plural for multi-select
      manager: "manager",
      managers: "managers",            // plural for multi-select
      due: "due_date",
      start: "start_date",
      deadline: "deadline",
      time_start: "time_start",
      time_finish: "time_finish",
      est: "estimated_hours",          // was missing
      priority: "priority",            // was missing
    };

    const backendField = fieldMap[colKey] || colKey;
    const payload = { [backendField]: newValue };

    // Mostrar estado de guardado
    td.classList.add("pm-cell-saving");

    try {
      const res = await fetch(`${apiBase}/pipeline/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error (${res.status}): ${errText}`);
      }

      // Actualizar celda con nuevo valor
      updateCellDisplay(td, colKey, newValue);
      td.classList.remove("pm-cell-saving");
      td.classList.add("pm-cell-saved");
      setTimeout(() => td.classList.remove("pm-cell-saved"), 1500);

      // Actualizar dataset del row
      const tr = td.closest("tr");
      if (tr && backendField) {
        tr.dataset[backendField.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = newValue || "";
      }

    } catch (err) {
      console.error("[PIPELINE] Save error:", err);
      td.classList.remove("pm-cell-saving");
      td.classList.add("pm-cell-error");
      setTimeout(() => td.classList.remove("pm-cell-error"), 2000);
      if (window.Toast) {
        Toast.error('Save Failed', 'Error saving field.', { details: err.message });
      }
    }
  }

  // ================================
  // ACTUALIZAR DISPLAY DE CELDA
  // ================================
  function updateCellDisplay(td, colKey, value) {
    const div = td.querySelector("div") || td;

    if (PERSON_COLS.includes(colKey)) {
      // Check if multi-person column (collaborator, manager)
      if (MULTI_PERSON_COLS.includes(colKey) && value && value.includes(",")) {
        // Render multiple people
        div.innerHTML = renderMultiplePeopleHtml(value);
      } else {
        // Render single person
        div.innerHTML = renderPersonHtml(value || "-");
      }
    } else if (NUMBER_COLS.includes(colKey)) {
      // Formatear como horas
      if (value !== null && value !== undefined && value !== "" && value !== "-") {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          div.textContent = `${numValue}h`;
        } else {
          div.textContent = "-";
        }
      } else {
        div.textContent = "-";
      }
    } else if (DATE_COLS.includes(colKey)) {
      div.textContent = value || "-";
    } else {
      div.textContent = value || "-";
    }
  }

  function restoreCellContent(td, colKey, originalValue) {
    updateCellDisplay(td, colKey, originalValue);
  }

  // ================================
  // RENDERIZAR PERSONA (AVATAR + NOMBRE)
  // Ring style: transparent background, colored border (like Team Management)
  // Color formula matches Team Management: hsl(hue 70% 45%)
  // ================================
  function renderPersonHtml(name) {
    const raw = String(name || "").trim();

    // Empty/placeholder state - show gray avatar
    if (!raw || raw === "-") {
      return `
        <span class="pm-person pm-person--empty" title="Click to assign">
          <span class="pm-avatar pm-avatar--placeholder"></span>
        </span>
      `;
    }

    const safeName = escapeHtml(raw);
    const initial = raw[0]?.toUpperCase() || "?";
    const hue = hashStringToHue(raw.toLowerCase());
    const color = `hsl(${hue} 70% 45%)`;

    return `
      <span class="pm-person" title="${safeName}">
        <span class="pm-avatar" style="color: ${color}; border-color: ${color};">${escapeHtml(initial)}</span>
        <span class="pm-person-name">${safeName}</span>
      </span>
    `;
  }

  // Render multiple people as stacked avatars (inline version)
  // Color formula matches Team Management: hsl(hue 70% 45%)
  function renderMultiplePeopleHtml(namesStr) {
    if (!namesStr || namesStr === "-") {
      return `
        <span class="pm-person pm-person--empty" title="Click to assign">
          <span class="pm-avatar pm-avatar--placeholder"></span>
        </span>
      `;
    }

    // Parse comma-separated names
    const names = namesStr.split(",").map(n => n.trim()).filter(n => n);

    if (names.length === 0) {
      return `<span class="pm-person-empty">-</span>`;
    }

    const maxDisplay = 3;
    const displayNames = names.slice(0, maxDisplay);
    const overflow = names.length - maxDisplay;

    let html = `<span class="pm-people-stack" title="${escapeHtml(namesStr)}">`;

    displayNames.forEach((name, index) => {
      const initial = (name || "?")[0]?.toUpperCase() || "?";
      const hue = hashStringToHue(name.toLowerCase());
      const color = `hsl(${hue} 70% 45%)`;
      const zIndex = displayNames.length - index;

      html += `
        <span class="pm-avatar pm-avatar-stacked" style="color: ${color}; border-color: ${color}; z-index: ${zIndex};" title="${escapeHtml(name)}">
          ${escapeHtml(initial)}
        </span>
      `;
    });

    if (overflow > 0) {
      html += `<span class="pm-avatar pm-avatar-overflow" title="${overflow} more">+${overflow}</span>`;
    }

    html += `</span>`;
    return html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function hashStringToHue(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  // ================================
  // CREAR EDITORES
  // ================================

  // Editor de texto (input o textarea)
  function createTextEditor(td, colKey, currentValue) {
    const isTextarea = TEXTAREA_COLS.includes(colKey);
    const element = document.createElement(isTextarea ? "textarea" : "input");

    element.className = "pm-inline-editor";
    element.value = currentValue || "";

    if (!isTextarea) {
      element.type = "text";
    } else {
      element.rows = 2;
    }

    // Eventos
    element.addEventListener("blur", () => {
      setTimeout(() => closeActiveEditor(true), 100);
    });

    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !isTextarea) {
        e.preventDefault();
        closeActiveEditor(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeActiveEditor(false);
      }
    });

    return element;
  }

  // Editor de fecha
  function createDateEditor(td, colKey, currentValue) {
    const element = document.createElement("input");
    element.className = "pm-inline-editor pm-inline-editor--date";
    element.type = "date";

    // Convertir valor actual a formato YYYY-MM-DD
    if (currentValue && currentValue !== "-") {
      const dateStr = currentValue.split("T")[0];
      element.value = dateStr;
    }

    element.addEventListener("blur", () => {
      setTimeout(() => closeActiveEditor(true), 100);
    });

    element.addEventListener("change", () => {
      closeActiveEditor(true);
    });

    element.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeActiveEditor(false);
      }
    });

    return element;
  }

  // Editor de número (horas)
  function createNumberEditor(td, colKey, currentValue) {
    const element = document.createElement("input");
    element.className = "pm-inline-editor pm-inline-editor--number";
    element.type = "number";
    element.step = "0.5";
    element.min = "0";
    element.placeholder = "0.0";

    // Extraer solo el número del valor actual (ej: "2.5h" -> "2.5")
    if (currentValue && currentValue !== "-") {
      const numValue = parseFloat(currentValue.toString().replace(/[^\d.]/g, ""));
      if (!isNaN(numValue)) {
        element.value = numValue;
      }
    }

    element.addEventListener("blur", () => {
      setTimeout(() => closeActiveEditor(true), 100);
    });

    element.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        closeActiveEditor(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeActiveEditor(false);
      }
    });

    return element;
  }

  // Dropdown de personas - Monday.com style using PeoplePicker
  async function createPersonDropdown(td, colKey, currentValue, taskId) {
    console.log("[PIPELINE-INTERACTIONS] createPersonDropdown called:", { colKey, currentValue, taskId });

    // Crear contenedor para el PeoplePicker
    const container = document.createElement("div");
    container.className = "pm-inline-people-picker";

    // Check if this column supports multiple people
    const isMultiple = MULTI_PERSON_COLS.includes(colKey);

    // Variable para almacenar el valor seleccionado
    let selectedValue = null;
    let selectedUsers = [];

    // Verificar que PeoplePicker esté disponible
    console.log("[PIPELINE-INTERACTIONS] window.PeoplePicker:", typeof window.PeoplePicker);
    if (typeof window.PeoplePicker !== "function") {
      console.warn("[PIPELINE] PeoplePicker not loaded, using fallback");
      return createPersonDropdownFallback(td, colKey, currentValue);
    }

    // Crear instancia del PeoplePicker
    console.log("[PIPELINE-INTERACTIONS] Creating PeoplePicker instance...");
    const picker = new window.PeoplePicker(container, {
      multiple: isMultiple,
      placeholder: isMultiple ? "Add people..." : "Select person...",
      onChange: (users) => {
        console.log("[PIPELINE-INTERACTIONS] PeoplePicker onChange:", users);
        selectedUsers = users || [];

        if (isMultiple) {
          // For multi-select: send array of IDs using plural field name
          const userIds = selectedUsers.map(u => u.id);
          const userNames = selectedUsers.map(u => u.name).join(", ");
          selectedValue = userNames || null;

          // Use plural field name for backend (collaborators, managers)
          const pluralField = colKey + "s"; // collaborator -> collaborators, manager -> managers

          if (activeEditor && activeEditor.td === td) {
            saveFieldToBackend(taskId, pluralField, userIds, td);
            activeEditor.originalValue = userNames;
            activeEditor.alreadySaved = true; // Mark as saved to prevent double-save in closeActiveEditor
            updateCellDisplay(td, colKey, userNames);
            // Don't close immediately for multi-select - user clicks away to close
          }
        } else {
          // For single select: existing behavior
          const user = users[0] || null;
          const userId = user ? user.id : null;
          const userName = user ? user.name : null;
          selectedValue = userName;

          if (activeEditor && activeEditor.td === td) {
            saveFieldToBackend(taskId, colKey, userId, td);
            activeEditor.originalValue = userName;
            activeEditor.alreadySaved = true; // Mark as saved to prevent double-save in closeActiveEditor
            updateCellDisplay(td, colKey, userName);
            closeActiveEditor(false); // false = don't save again
          }
        }
      }
    });

    // Pre-seleccionar usuarios actuales
    if (currentValue && currentValue !== "-") {
      setTimeout(async () => {
        const users = await window.PM_PeoplePicker?.fetchUsers?.() || [];

        if (isMultiple && currentValue.includes(",")) {
          // Parse comma-separated names for multi-select
          const names = currentValue.split(",").map(n => n.trim());
          const matchedUsers = users.filter(u => names.includes(u.name));
          if (matchedUsers.length > 0 && picker.setValue) {
            picker.setValue(matchedUsers);
          }
        } else {
          // Single user
          const currentUser = users.find(u => u.name === currentValue);
          if (currentUser && picker.setValue) {
            picker.setValue([currentUser]);
          }
        }

        if (picker.open) {
          picker.open();
        }
      }, 50);
    } else {
      setTimeout(() => {
        console.log("[PIPELINE-INTERACTIONS] Opening PeoplePicker...");
        if (picker.open) {
          picker.open();
          console.log("[PIPELINE-INTERACTIONS] PeoplePicker opened");
        } else {
          console.warn("[PIPELINE-INTERACTIONS] picker.open is not a function");
        }
      }, 50);
    }

    // Guardar referencia al picker para poder cerrarlo
    container._picker = picker;
    container._getValue = () => selectedValue;

    console.log("[PIPELINE-INTERACTIONS] PeoplePicker container created:", container);
    return container;
  }

  // Fallback si PeoplePicker no está disponible
  async function createPersonDropdownFallback(td, colKey, currentValue) {
    const users = await loadUsers();

    const element = document.createElement("select");
    element.className = "pm-inline-editor pm-inline-editor--select";

    // Opción vacía
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— Select —";
    element.appendChild(emptyOpt);

    // Opciones de usuarios
    users.forEach((user) => {
      const opt = document.createElement("option");
      const userName = user.name || user.username || user.email || `User ${user.id}`;
      opt.value = userName;
      opt.textContent = userName;

      if (userName === currentValue) {
        opt.selected = true;
      }

      element.appendChild(opt);
    });

    element.addEventListener("blur", () => {
      setTimeout(() => closeActiveEditor(true), 100);
    });

    element.addEventListener("change", () => {
      closeActiveEditor(true);
    });

    element.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeActiveEditor(false);
      }
    });

    return element;
  }

  // Dropdown de catálogos - Monday.com style using CatalogPicker
  async function createCatalogDropdown(td, colKey, currentValue, taskId) {
    console.log("[PIPELINE-INTERACTIONS] createCatalogDropdown called:", { colKey, currentValue, taskId });

    // Crear contenedor para el CatalogPicker
    const container = document.createElement("div");
    container.className = "pm-inline-catalog-picker";

    // Variable para almacenar el valor seleccionado
    let selectedValue = null;

    // Verificar que CatalogPicker esté disponible
    console.log("[PIPELINE-INTERACTIONS] window.CatalogPicker:", typeof window.CatalogPicker);
    if (typeof window.CatalogPicker !== "function") {
      console.warn("[PIPELINE] CatalogPicker not loaded, using fallback");
      return createCatalogDropdownFallback(td, colKey, currentValue);
    }

    // Crear instancia del CatalogPicker
    console.log("[PIPELINE-INTERACTIONS] Creating CatalogPicker instance...");
    const picker = new window.CatalogPicker(container, {
      catalogType: colKey,
      placeholder: `Select ${colKey}...`,
      onChange: (item) => {
        console.log("[PIPELINE-INTERACTIONS] CatalogPicker onChange:", item);
        // Store both ID (for backend) and name (for display)
        const valueId = item ? item.id : null;
        const valueName = item ? item.name : null;
        selectedValue = valueName; // For display

        // Guardar inmediatamente al seleccionar (send ID to backend)
        if (activeEditor && activeEditor.td === td) {
          saveFieldToBackend(taskId, colKey, valueId, td);
          // Update originalValue with the name for display restoration
          activeEditor.originalValue = valueName;
          activeEditor.alreadySaved = true; // Mark as saved to prevent double-save
          // Update cell display with the name
          updateCellDisplay(td, colKey, valueName);
          closeActiveEditor(false); // false porque ya guardamos
        }
      }
    });

    // Pre-seleccionar el valor actual si existe
    if (currentValue && currentValue !== "-") {
      setTimeout(async () => {
        // Esperar a que el picker cargue los items
        const items = await window.PM_CatalogPicker?.fetchCatalog?.(colKey) || [];
        const currentItem = items.find(i => i.name === currentValue);
        if (currentItem && picker.setValue) {
          picker.setValue(currentItem);
        }
        // Abrir el dropdown automáticamente
        if (picker.open) {
          picker.open();
        }
      }, 50);
    } else {
      // Abrir el dropdown automáticamente
      setTimeout(() => {
        console.log("[PIPELINE-INTERACTIONS] Opening CatalogPicker...");
        if (picker.open) {
          picker.open();
          console.log("[PIPELINE-INTERACTIONS] CatalogPicker opened");
        } else {
          console.warn("[PIPELINE-INTERACTIONS] picker.open is not a function");
        }
      }, 50);
    }

    // Guardar referencia al picker para poder cerrarlo
    container._picker = picker;
    container._getValue = () => selectedValue;

    console.log("[PIPELINE-INTERACTIONS] CatalogPicker container created:", container);
    return container;
  }

  // Fallback si CatalogPicker no está disponible
  function createCatalogDropdownFallback(td, colKey, currentValue) {
    const element = document.createElement("select");
    element.className = "pm-inline-editor pm-inline-editor--select";

    // Opción vacía
    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "— Select —";
    element.appendChild(emptyOpt);

    // Obtener datos del catálogo según la columna
    let catalogData = [];
    let valueKey = "id";
    let textKey = "name";

    switch (colKey) {
      case "project":
        catalogData = catalogsCache.projects || [];
        valueKey = "project_id";
        textKey = "project_name";
        break;
      case "company":
        catalogData = catalogsCache.companies || [];
        valueKey = "id";
        textKey = "name";
        break;
      case "department":
        catalogData = catalogsCache.departments || [];
        valueKey = "department_id";
        textKey = "department_name";
        break;
      case "type":
        catalogData = catalogsCache.types || [];
        valueKey = "type_id";
        textKey = "type_name";
        break;
      case "priority":
        catalogData = catalogsCache.priorities || [];
        valueKey = "priority_id";
        textKey = "priority";
        break;
    }

    // Agregar opciones
    catalogData.forEach((item) => {
      const opt = document.createElement("option");
      const value = item[valueKey];
      const text = item[textKey] || "Unnamed";
      opt.value = value;
      opt.textContent = text;

      if (value === currentValue) {
        opt.selected = true;
      }

      element.appendChild(opt);
    });

    element.addEventListener("blur", () => {
      setTimeout(() => closeActiveEditor(true), 100);
    });

    element.addEventListener("change", () => {
      closeActiveEditor(true);
    });

    element.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeActiveEditor(false);
      }
    });

    return element;
  }

  // ================================
  // OBTENER VALOR ACTUAL DE CELDA
  // ================================
  function getCurrentCellValue(td, colKey) {
    // Intentar obtener del texto visible
    const div = td.querySelector("div");
    let textContent = "";

    if (PERSON_COLS.includes(colKey)) {
      // Para personas, buscar el nombre en .pm-person-name
      const nameEl = td.querySelector(".pm-person-name");
      textContent = nameEl?.textContent?.trim() || "";
    } else {
      textContent = div?.textContent?.trim() || td.textContent?.trim() || "";
    }

    return textContent === "-" ? "" : textContent;
  }

  // ================================
  // CLICK EN CELDA
  // ================================
  async function handleCellClick(td, tr, colKey, taskId) {
    console.log("[PIPELINE-INTERACTIONS] handleCellClick called:", { colKey, taskId });

    // Si ya hay un editor activo, cerrarlo primero
    if (activeEditor) {
      if (activeEditor.td === td) return; // Click en el mismo editor
      closeActiveEditor(true);
    }

    // Verificar si es columna de solo lectura
    if (READONLY_COLS.includes(colKey)) {
      console.log("[PIPELINE] Read-only column:", colKey);
      return;
    }

    const currentValue = getCurrentCellValue(td, colKey);
    let editor;
    let editorType;

    // Crear editor según tipo de columna
    console.log("[PIPELINE-INTERACTIONS] Checking column type for:", colKey);
    console.log("[PIPELINE-INTERACTIONS] PERSON_COLS:", PERSON_COLS, "includes:", PERSON_COLS.includes(colKey));
    console.log("[PIPELINE-INTERACTIONS] CATALOG_COLS:", CATALOG_COLS, "includes:", CATALOG_COLS.includes(colKey));
    console.log("[PIPELINE-INTERACTIONS] DATE_COLS:", DATE_COLS, "includes:", DATE_COLS.includes(colKey));

    if (PERSON_COLS.includes(colKey)) {
      console.log("[PIPELINE-INTERACTIONS] Creating person dropdown");
      editor = await createPersonDropdown(td, colKey, currentValue, taskId);
      editorType = "person-dropdown";
    } else if (CATALOG_COLS.includes(colKey)) {
      console.log("[PIPELINE-INTERACTIONS] Creating catalog dropdown");
      editor = await createCatalogDropdown(td, colKey, currentValue, taskId);
      editorType = "catalog-dropdown";
    } else if (NUMBER_COLS.includes(colKey)) {
      console.log("[PIPELINE-INTERACTIONS] Creating number editor");
      editor = createNumberEditor(td, colKey, currentValue);
      editorType = "number";
    } else if (DATE_COLS.includes(colKey)) {
      console.log("[PIPELINE-INTERACTIONS] Creating date editor");
      editor = createDateEditor(td, colKey, currentValue);
      editorType = "date";
    } else if (TEXT_COLS.includes(colKey)) {
      console.log("[PIPELINE-INTERACTIONS] Creating text editor");
      editor = createTextEditor(td, colKey, currentValue);
      editorType = "text";
    } else {
      // Columna no soportada para edición
      console.log("[PIPELINE] Column not editable:", colKey);
      return;
    }

    console.log("[PIPELINE-INTERACTIONS] Editor created:", editorType, editor);

    // Guardar estado
    activeEditor = {
      element: editor,
      td,
      taskId,
      colKey,
      originalValue: currentValue,
      type: editorType,
    };

    // Reemplazar contenido de celda con editor
    const div = td.querySelector("div");
    if (div) {
      div.innerHTML = "";
      div.appendChild(editor);
    } else {
      td.innerHTML = "";
      td.appendChild(editor);
    }

    // Focus (only for input/select/textarea, not for picker containers)
    if (editorType !== "person-dropdown" && editorType !== "catalog-dropdown" && editor.focus) {
      editor.focus();
      if (editor.select && editorType === "text") {
        editor.select();
      }
    }

    // Marcar celda como editando (different styles for text vs picker)
    // Text fields get blue edit background, pickers behave like buttons
    const isPickerType = editorType === "person-dropdown" || editorType === "catalog-dropdown";
    td.classList.add("pm-cell-editing");
    td.classList.add(isPickerType ? "pm-cell-editing--picker" : "pm-cell-editing--text");

    // Add parent classes for dropdown overflow (fallback for :has())
    // Note: tr is already passed as parameter to handleCellClick
    const tbody = td.closest("tbody");
    const table = td.closest("table");
    const groupBody = td.closest(".pm-group-body");
    const group = td.closest(".pm-group");
    if (tr) tr.classList.add("pm-has-editing");
    if (tbody) tbody.classList.add("pm-has-editing");
    if (table) table.classList.add("pm-has-editing");
    if (groupBody) groupBody.classList.add("pm-has-editing");
    if (group) group.classList.add("pm-has-editing");
  }

  // ================================
  // EVENT LISTENER PRINCIPAL
  // ================================
  console.log("[PIPELINE-INTERACTIONS] Event listener registered on wrapper");

  wrapper.addEventListener("click", (e) => {
    console.log("[PIPELINE-INTERACTIONS] Click detected on wrapper");
    console.log("[PIPELINE-INTERACTIONS] e.target:", e.target);
    console.log("[PIPELINE-INTERACTIONS] e.target.tagName:", e.target.tagName);
    console.log("[PIPELINE-INTERACTIONS] e.target.className:", e.target.className);

    const td = e.target.closest("td[data-col]");
    if (!td) {
      console.log("[PIPELINE-INTERACTIONS] No td[data-col] found - checking if inside table");
      const anyTd = e.target.closest("td");
      if (anyTd) {
        console.log("[PIPELINE-INTERACTIONS] Found td without data-col:", anyTd);
        console.log("[PIPELINE-INTERACTIONS] td attributes:", anyTd.getAttributeNames());
      }
      return;
    }

    console.log("[PIPELINE-INTERACTIONS] td found with data-col:", td.dataset.col);

    // No activar si el click fue en el editor mismo o en los pickers
    if (e.target.closest(".pm-inline-editor") ||
        e.target.closest(".pm-inline-people-picker") ||
        e.target.closest(".pm-people-dropdown") ||
        e.target.closest(".pm-people-picker") ||
        e.target.closest(".pm-inline-catalog-picker") ||
        e.target.closest(".pm-catalog-dropdown") ||
        e.target.closest(".pm-catalog-picker")) {
      console.log("[PIPELINE-INTERACTIONS] Click was on editor/picker, ignoring");
      return;
    }

    const tr = td.closest("tr[data-task-id], tr.pm-row");
    const taskId = tr?.dataset?.taskId || null;
    const colKey = td.getAttribute("data-col");

    console.log("[PIPELINE-INTERACTIONS] tr found:", tr);
    console.log("[PIPELINE-INTERACTIONS] tr.className:", tr?.className);
    console.log("[PIPELINE-INTERACTIONS] tr.dataset:", tr?.dataset);
    console.log("[PIPELINE-INTERACTIONS] taskId:", taskId, "colKey:", colKey);

    if (!taskId || !colKey) {
      console.log("[PIPELINE-INTERACTIONS] Missing taskId or colKey, returning");
      console.log("[PIPELINE-INTERACTIONS] All tr attributes:", tr?.getAttributeNames?.());
      return;
    }

    // Special handling for links column - open modal
    if (colKey === "links") {
      // Don't open modal if clicking on a link
      if (e.target.closest("a")) return;

      // Close any active editor before opening modal (prevents orphan state)
      if (activeEditor) {
        closeActiveEditor(true);
      }

      // Get current link values from row dataset
      const docsLink = tr?.dataset?.docsLink || '';
      const resultLink = tr?.dataset?.resultLink || '';

      // Open links modal
      if (window.PM_LinksModal?.open) {
        window.PM_LinksModal.open(taskId, docsLink, resultLink);
      }
      return;
    }

    // Stop propagation to prevent the click from triggering picker's close handler
    // The picker opens after a short delay, and the original click event could close it
    e.stopPropagation();

    handleCellClick(td, tr, colKey, taskId);
  });

  // Named handlers for document listeners (allows cleanup)
  function handleDocumentClick(e) {
    if (!activeEditor) return;
    // Don't close if clicking on picker dropdowns (they live outside wrapper)
    if (e.target.closest(".pm-people-dropdown") ||
        e.target.closest(".pm-people-picker") ||
        e.target.closest(".pm-catalog-dropdown") ||
        e.target.closest(".pm-catalog-picker")) return;
    if (!wrapper.contains(e.target)) {
      closeActiveEditor(true);
    }
  }

  function handleDocumentKeydown(e) {
    if (e.key === "Escape" && activeEditor) {
      closeActiveEditor(false);
    }
  }

  // Register document listeners
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  // ================================
  // DOUBLE CLICK TO OPEN EDIT MODAL
  // ================================
  wrapper.addEventListener("dblclick", (e) => {
    // Close any active inline editor
    if (activeEditor) {
      closeActiveEditor(false);
    }

    const tr = e.target.closest("tr[data-task-id], tr.pm-row");
    if (!tr) return;

    const taskId = tr.dataset?.taskId;
    if (!taskId) return;

    // Build task object from row data
    const task = buildTaskFromRow(tr);

    // Open edit modal
    if (typeof window.PM_EditTask?.open === "function") {
      window.PM_EditTask.open(task);
    } else {
      console.warn("[PIPELINE] PM_EditTask not loaded");
    }
  });

  /**
   * Build task object from row dataset attributes
   */
  function buildTaskFromRow(tr) {
    const ds = tr.dataset;

    // Get cell values
    const getTextFromCell = (colKey) => {
      const td = tr.querySelector(`td[data-col="${colKey}"]`);
      if (!td) return '';

      // For person columns, get the name from .pm-person-name
      const personName = td.querySelector('.pm-person-name');
      if (personName) return personName.textContent?.trim() || '';

      // For other columns, get text content
      const div = td.querySelector('div');
      const text = (div?.textContent || td.textContent || '').trim();
      return text === '-' ? '' : text;
    };

    return {
      task_id: ds.taskId || null,
      id: ds.taskId || null,
      task_description: getTextFromCell('task'),
      task_notes: ds.taskNotes || '',
      company_name: getTextFromCell('company'),
      project_name: getTextFromCell('project'),
      department: getTextFromCell('department') || ds.department || '',
      type: getTextFromCell('type') || ds.type || '',
      status_name: ds.status || '',
      owner_name: getTextFromCell('owner'),
      collaborators: [],
      manager_name: getTextFromCell('manager'),
      start_date: ds.startDate || '',
      due_date: getTextFromCell('due'),
      deadline: ds.deadline || '',
      time_start: ds.timeStart || '',
      time_finish: ds.timeFinish || '',
      estimated_hours: ds.estimatedHours ? parseFloat(ds.estimatedHours) : null,
      docs_link: ds.docsLink || '',
      result_link: ds.resultLink || '',
      priority: ds.priorityId || '',
      finished_status: ds.finishedStatusId || '',
    };
  }

  // Cleanup function to remove document listeners (call when navigating away)
  function destroy() {
    document.removeEventListener("click", handleDocumentClick);
    document.removeEventListener("keydown", handleDocumentKeydown);
    if (wrapper) {
      wrapper._pipelineInteractionsInitialized = false;
    }
    console.log("[PIPELINE-INTERACTIONS] Destroyed - document listeners removed");
  }

  // Expose destroy function for SPA navigation cleanup
  window.PM_TableInteractions = { destroy };

  // Final debug log
  console.log("[PIPELINE-INTERACTIONS] Script fully loaded and initialized!");
  console.log("[PIPELINE-INTERACTIONS] Wrapper exists:", !!wrapper);
  console.log("[PIPELINE-INTERACTIONS] Event listener should be active on wrapper");

})();
