// assets/js/pipeline_table_interactions.js
(function () {
  "use strict";

  const wrapper = document.getElementById("pm-groups-wrapper");
  if (!wrapper) return;

  // ================================
  // CONFIGURACIÓN DE COLUMNAS
  // ================================

  // Columnas editables con input de texto
  const TEXT_COLS = ["task"];

  // Columnas editables con textarea (texto largo)
  const TEXTAREA_COLS = ["task"];

  // Columnas de personas (dropdown de usuarios)
  const PERSON_COLS = ["owner", "collaborator", "manager"];

  // Columnas de fecha (date picker)
  const DATE_COLS = ["due", "start", "deadline", "time_start", "time_finish"];

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

    const { element, td, taskId, colKey, originalValue, type } = activeEditor;

    if (save) {
      const newValue = getEditorValue(element, type);
      if (newValue !== originalValue) {
        saveFieldToBackend(taskId, colKey, newValue, td);
      }
    }

    // Restaurar contenido original si no se guardó
    if (!save) {
      restoreCellContent(td, colKey, originalValue);
    }

    activeEditor = null;
  }

  function getEditorValue(element, type) {
    if (type === "person-dropdown" || type === "catalog-dropdown") {
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
    const fieldMap = {
      task: "task_description",
      project: "project",
      company: "company",
      department: "department",
      type: "type",
      owner: "owner",
      collaborator: "collaborator",
      manager: "manager",
      due: "due_date",
      start: "start_date",
      deadline: "deadline",
      time_start: "time_start",
      time_finish: "time_finish",
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
      // Renderizar persona con avatar
      div.innerHTML = renderPersonHtml(value || "-");
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
  // ================================
  function renderPersonHtml(name) {
    const raw = String(name || "").trim();
    const safeName = escapeHtml(raw || "-");
    const initial = (raw || "-")[0]?.toUpperCase() || "?";

    const hue = hashStringToHue(raw.toLowerCase());
    const bg = raw && raw !== "-" ? `hsl(${hue} 55% 35%)` : "#334155";
    const ring = raw && raw !== "-" ? `hsl(${hue} 65% 55%)` : "rgba(148, 163, 184, 0.6)";

    return `
      <span class="pm-person" title="${safeName}">
        <span class="pm-avatar" style="--av-bg:${bg}; --av-ring:${ring};">${escapeHtml(initial)}</span>
        <span class="pm-person-name">${safeName}</span>
      </span>
    `;
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

  // Dropdown de personas
  async function createPersonDropdown(td, colKey, currentValue) {
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

  // Dropdown de catálogos (project, company, department, type, priority)
  function createCatalogDropdown(td, colKey, currentValue) {
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
    if (PERSON_COLS.includes(colKey)) {
      editor = await createPersonDropdown(td, colKey, currentValue);
      editorType = "person-dropdown";
    } else if (CATALOG_COLS.includes(colKey)) {
      editor = createCatalogDropdown(td, colKey, currentValue);
      editorType = "catalog-dropdown";
    } else if (NUMBER_COLS.includes(colKey)) {
      editor = createNumberEditor(td, colKey, currentValue);
      editorType = "number";
    } else if (DATE_COLS.includes(colKey)) {
      editor = createDateEditor(td, colKey, currentValue);
      editorType = "date";
    } else if (TEXT_COLS.includes(colKey)) {
      editor = createTextEditor(td, colKey, currentValue);
      editorType = "text";
    } else {
      // Columna no soportada para edición
      console.log("[PIPELINE] Column not editable:", colKey);
      return;
    }

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

    // Focus
    editor.focus();
    if (editor.select && editorType === "text") {
      editor.select();
    }

    // Marcar celda como editando
    td.classList.add("pm-cell-editing");
  }

  // ================================
  // EVENT LISTENER PRINCIPAL
  // ================================
  wrapper.addEventListener("click", (e) => {
    const td = e.target.closest("td[data-col]");
    if (!td) return;

    // No activar si el click fue en el editor mismo
    if (e.target.closest(".pm-inline-editor")) return;

    const tr = td.closest("tr[data-task-id], tr.pm-row");
    const taskId = tr?.dataset?.taskId || null;
    const colKey = td.getAttribute("data-col");

    if (!taskId || !colKey) return;

    handleCellClick(td, tr, colKey, taskId);
  });

  // Cerrar editor al hacer click fuera
  document.addEventListener("click", (e) => {
    if (!activeEditor) return;
    if (!wrapper.contains(e.target)) {
      closeActiveEditor(true);
    }
  });

  // Cerrar con Escape global
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeEditor) {
      closeActiveEditor(false);
    }
  });

})();
