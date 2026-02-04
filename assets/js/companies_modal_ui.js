// assets/js/companies_modal_ui.js
(function () {
  console.log("[CompanyModal] UI loaded");

  const qs = (id) => document.getElementById(id);

  const MODAL_ID = "companyModal";
  const PARTIAL_URL = "./partials/companies_modal.html";

  let _mountPromise = null;
  let _bound = false;

  const state = {
    mode: "create", // "create" | "edit"
    companyId: null,
    company: null,
    onSaved: null,
    onDeleted: null,
  };

  function getApiBase() {
    const base = window.API_BASE || window.apiBase || "";
    return String(base || "").replace(/\/+$/, "");
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`${options.method || "GET"} ${url} failed (${res.status}): ${text}`);
    return text ? JSON.parse(text) : null;
  }

  async function createCompany(payload) {
    const base = getApiBase();
    return await apiJson(`${base}/companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function patchCompany(companyId, payload) {
    const base = getApiBase();
    return await apiJson(`${base}/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function deleteCompany(companyId) {
    const base = getApiBase();
    return await apiJson(`${base}/companies/${companyId}`, { method: "DELETE" });
  }

  async function ensureModalMounted() {
    const existing = qs(MODAL_ID);
    if (existing) return existing;

    if (_mountPromise) return _mountPromise;

    _mountPromise = (async () => {
      const res = await fetch(PARTIAL_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`[CompanyModal] partial load failed (${res.status})`);

      const html = await res.text();

      const mount = document.getElementById("modals-root") || document.body;
      mount.insertAdjacentHTML("beforeend", html);

      const modal = qs(MODAL_ID);
      if (!modal) throw new Error(`[CompanyModal] injected but #${MODAL_ID} not found`);

      return modal;
    })();

    try {
      return await _mountPromise;
    } finally {
      _mountPromise = null;
    }
  }

  function showModal(modal) {
    modal.classList.remove("hidden", "hid");
    modal.classList.add("open");
  }

  function hideModal(modal) {
    modal.classList.remove("open");
    modal.classList.add("hidden");
    modal.classList.add("hid");
  }

  async function open({ mode = "create", company = null, onSaved = null, onDeleted = null } = {}) {
    let modal = qs(MODAL_ID);
    if (!modal) {
      try {
        modal = await ensureModalMounted();
      } catch (e) {
        console.warn("[CompanyModal] could not mount modal:", e);
        return;
      }
    }

    // bind SOLO cuando ya existe el modal
    bind();

    state.mode = mode;
    state.company = company;
    state.companyId = company?.id || null;
    state.onSaved = onSaved;
    state.onDeleted = onDeleted;

    render();

    showModal(modal);

    const first = modal.querySelector("input, textarea, select, button");
    if (first) setTimeout(() => first.focus(), 30);
  }

  function close() {
    const modal = qs(MODAL_ID);
    if (!modal) return;
    hideModal(modal);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    const form = qs("companyForm");
    if (!form) return;

    const title = qs("companyModalTitle");
    const btnDelete = qs("btnDeleteCompany");
    if (title) title.textContent = state.mode === "edit" ? "Edit Company" : "New Company";
    if (btnDelete) btnDelete.classList.toggle("hidden", state.mode !== "edit");

    const c = state.company || {};
    const statusIsActive = (c.status || "Active") === "Active";
    const statusIsInactive = c.status === "Inactive";

    form.innerHTML = `
      <section class="cm-modal-section">
        <h3 class="cm-modal-section-title">Basics</h3>
        <div class="cm-form-grid">
          <label class="cm-field cm-field--full">
            <span class="cm-field-label">Company Name <b>*</b></span>
            <input id="co_name" class="cm-input" type="text" placeholder="Company name" value="${escapeHtml(c.name || "")}" required />
          </label>

          <label class="cm-field cm-field--full">
            <span class="cm-field-label">Description</span>
            <textarea id="co_description" class="cm-input" placeholder="Brief description..." rows="3">${escapeHtml(c.description || "")}</textarea>
          </label>

          <label class="cm-field">
            <span class="cm-field-label">Avatar Color (0-360)</span>
            <input id="co_color" class="cm-input" type="number" min="0" max="360" placeholder="e.g. 160" value="${escapeHtml(c.avatar_color ?? "")}" />
          </label>

          <label class="cm-field">
            <span class="cm-field-label">Status</span>
            <select id="co_status" class="cm-input">
              <option value="Active" ${statusIsActive ? "selected" : ""}>Active</option>
              <option value="Inactive" ${statusIsInactive ? "selected" : ""}>Inactive</option>
            </select>
          </label>
        </div>
      </section>

      <section class="cm-modal-section">
        <h3 class="cm-modal-section-title">Contact</h3>
        <div class="cm-form-grid">
          <label class="cm-field">
            <span class="cm-field-label">Phone</span>
            <input id="co_phone" class="cm-input" type="text" placeholder="+1..." value="${escapeHtml(c.phone || "")}" />
          </label>

          <label class="cm-field">
            <span class="cm-field-label">Email</span>
            <input id="co_email" class="cm-input" type="email" placeholder="contact@company.com" value="${escapeHtml(c.email || "")}" />
          </label>

          <label class="cm-field cm-field--full">
            <span class="cm-field-label">Address</span>
            <input id="co_addr" class="cm-input" type="text" placeholder="Full address" value="${escapeHtml(c.address || "")}" />
          </label>
        </div>
      </section>
    `;
  }

  function buildPayload() {
    const name = (qs("co_name")?.value || "").trim();
    if (!name) {
      if (window.Toast) {
        Toast.warning('Missing Field', 'Please enter a company name.');
      }
      return null;
    }

    const colorRaw = (qs("co_color")?.value || "").trim();
    let avatar_color = null;
    if (colorRaw !== "") {
      const n = Number(colorRaw);
      if (!Number.isFinite(n) || n < 0 || n > 360) {
        if (window.Toast) {
          Toast.warning('Invalid Color', 'Avatar Color must be a number between 0 and 360.');
        }
        return null;
      }
      avatar_color = Math.round(n);
    }

    return {
      name,
      description: (qs("co_description")?.value || "").trim() || null,
      avatar_color,
      phone: (qs("co_phone")?.value || "").trim() || null,
      email: (qs("co_email")?.value || "").trim() || null,
      address: (qs("co_addr")?.value || "").trim() || null,
      status: qs("co_status")?.value || "Active",
    };
  }

  function bind() {
    const modal = qs(MODAL_ID);
    if (!modal) return;
    if (_bound) return;
    _bound = true;

    qs("btnCloseCompanyModal")?.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    qs("btnCancelCompany")?.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    // Backdrop click: solo si el target ES el backdrop
    modal.addEventListener("click", (ev) => {
      if (ev.target === modal) close();
    });

    // Escape closes
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        const m = qs(MODAL_ID);
        if (m && !(m.classList.contains("hidden") || m.classList.contains("hid"))) close();
      }
    });

    // Save
    qs("btnSaveCompany")?.addEventListener("click", async (e) => {
      e.preventDefault();

      const btn = qs("btnSaveCompany");
      const payload = buildPayload();
      if (!payload) return;

      btn && (btn.disabled = true);

      try {
        let out = null;
        if (state.mode === "edit" && state.companyId) out = await patchCompany(state.companyId, payload);
        else out = await createCompany(payload);

        close();
        if (typeof state.onSaved === "function") await state.onSaved(out);
      } catch (err) {
        console.error("[CompanyModal] save failed:", err);
        if (window.Toast) {
          Toast.error('Save Failed', 'Error saving company.', { details: err.message });
        }
      } finally {
        btn && (btn.disabled = false);
      }
    });

    // Delete
    qs("btnDeleteCompany")?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!state.companyId) return;

      if (!confirm("Delete this company?")) return;

      const btn = qs("btnDeleteCompany");
      btn && (btn.disabled = true);

      try {
        await deleteCompany(state.companyId);
        close();
        if (typeof state.onDeleted === "function") await state.onDeleted(state.companyId);
      } catch (err) {
        console.error("[CompanyModal] delete failed:", err);
        if (window.Toast) {
          Toast.error('Delete Failed', 'Error deleting company.', { details: err.message });
        }
      } finally {
        btn && (btn.disabled = false);
      }
    });
  }

  // Expose
  window.CompanyModal = { open, close, bind };
})();
