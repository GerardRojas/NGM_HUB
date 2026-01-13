// assets/js/team_user_modal_ui.js
(function () {
  console.log("[TeamUserModal] UI v2 loaded"); // <- te sirve para validar que sí corrió el nuevo

  const qs = (id) => document.getElementById(id);

  const MODAL_ID = "teamUserModal";
  const PARTIAL_URL = "./partials/team_user_modal.html";

  let _mountPromise = null;
  let _bound = false;

  const state = {
    mode: "create", // "create" | "edit"
    userId: null,
    user: null,
    meta: null,
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

  async function fetchMeta() {
    const base = getApiBase();
    return await apiJson(`${base}/team/meta`);
  }

  async function createUser(payload) {
    const base = getApiBase();
    return await apiJson(`${base}/team/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function patchUser(userId, payload) {
    const base = getApiBase();
    return await apiJson(`${base}/team/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function deleteUser(userId) {
    const base = getApiBase();
    return await apiJson(`${base}/team/users/${userId}`, { method: "DELETE" });
  }

  async function ensureModalMounted() {
    const existing = qs(MODAL_ID);
    if (existing) return existing;

    if (_mountPromise) return _mountPromise;

    _mountPromise = (async () => {
      const res = await fetch(PARTIAL_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`[TeamUserModal] partial load failed (${res.status})`);

      const html = await res.text();

      const mount = document.getElementById("modals-root") || document.body;
      mount.insertAdjacentHTML("beforeend", html);

      const modal = qs(MODAL_ID);
      if (!modal) throw new Error(`[TeamUserModal] injected but #${MODAL_ID} not found`);

      return modal;
    })();

    try {
      return await _mountPromise;
    } finally {
      _mountPromise = null;
    }
  }

  function showModal(modal) {
    // Soporta ambos nombres (tu partial usa "hid")
    modal.classList.remove("hidden", "hid");
    modal.classList.add("open");
  }

  function hideModal(modal) {
    modal.classList.remove("open");
    modal.classList.add("hidden");
    modal.classList.add("hid");
  }

  async function open({ mode = "create", user = null, onSaved = null, onDeleted = null } = {}) {
    let modal = qs(MODAL_ID);
    if (!modal) {
      try {
        modal = await ensureModalMounted();
      } catch (e) {
        console.warn("[TeamUserModal] could not mount modal:", e);
        return;
      }
    }

    // bind SOLO cuando ya existe el modal
    bind();

    state.mode = mode;
    state.user = user;
    state.userId = user?.user_id || null;
    state.onSaved = onSaved;
    state.onDeleted = onDeleted;

    await render();

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

  function optList(list, selectedId) {
    const sel = String(selectedId || "");
    return (list || [])
      .map((x) => {
        const id = String(x.id || "");
        const name = String(x.name || "");
        const selected = id && id === sel ? "selected" : "";
        return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(name)}</option>`;
      })
      .join("");
  }

  function getStatusIdByName(meta, name) {
    const n = String(name || "").toLowerCase().trim();
    const hit = (meta?.statuses || []).find((s) => String(s.name || "").toLowerCase().trim() === n);
    return hit ? hit.id : "";
  }

  async function render() {
    const form = qs("teamUserForm");
    if (!form) return;

    if (!state.meta) {
      try {
        state.meta = await fetchMeta();
      } catch (e) {
        console.warn("[TeamUserModal] /team/meta failed:", e);
        state.meta = { roles: [], seniorities: [], statuses: [] };
      }
    }

    const title = qs("teamUserModalTitle");
    const btnDelete = qs("btnDeleteTeamUser");
    if (title) title.textContent = state.mode === "edit" ? "Edit Team Member" : "New Team Member";
    if (btnDelete) btnDelete.classList.toggle("hidden", state.mode !== "edit");

    const u = state.user || {};
    const roleId = u?.role?.id || "";
    const seniorityId = u?.seniority?.id || "";
    const statusId =
      u?.status?.id || (state.mode === "create" ? getStatusIdByName(state.meta, "Active") : "");

    form.innerHTML = `
      <section class="tm-modal-section">
        <h3 class="tm-modal-section-title">Basics</h3>
        <div class="tm-form-grid">
          <label class="tm-field tm-field--full">
            <span class="tm-field-label">Name <b>*</b></span>
            <input id="tu_name" class="tm-input" type="text" placeholder="Full name" value="${escapeHtml(u.user_name || "")}" required />
          </label>

          <label class="tm-field">
            <span class="tm-field-label">Avatar Color (0–360)</span>
            <input id="tu_color" class="tm-input" type="number" min="0" max="360" placeholder="e.g. 220" value="${escapeHtml(u.avatar_color ?? "")}" />
          </label>

          <label class="tm-field">
            <span class="tm-field-label">Photo URL</span>
            <input id="tu_photo" class="tm-input" type="url" placeholder="https://…" value="${escapeHtml(u.user_photo || "")}" />
          </label>
        </div>
      </section>

      <section class="tm-modal-section">
        <h3 class="tm-modal-section-title">Role & Status</h3>
        <div class="tm-form-grid">
          <label class="tm-field">
            <span class="tm-field-label">Role</span>
            <select id="tu_role" class="tm-input">
              <option value="">—</option>
              ${optList(state.meta.roles, roleId)}
            </select>
          </label>

          <label class="tm-field">
            <span class="tm-field-label">Seniority</span>
            <select id="tu_seniority" class="tm-input">
              <option value="">—</option>
              ${optList(state.meta.seniorities, seniorityId)}
            </select>
          </label>

          <label class="tm-field">
            <span class="tm-field-label">Status</span>
            <select id="tu_status" class="tm-input">
              <option value="">—</option>
              ${optList(state.meta.statuses, statusId)}
            </select>
          </label>
        </div>
      </section>

      <section class="tm-modal-section">
        <h3 class="tm-modal-section-title">Contact</h3>
        <div class="tm-form-grid">
          <label class="tm-field">
            <span class="tm-field-label">Phone</span>
            <input id="tu_phone" class="tm-input" type="text" placeholder="+52…" value="${escapeHtml(u.user_phone_number || "")}" />
          </label>

          <label class="tm-field">
            <span class="tm-field-label">Birthday</span>
            <input id="tu_bday" class="tm-input" type="date" value="${escapeHtml(u.user_birthday || "")}" />
          </label>

          <label class="tm-field tm-field--full">
            <span class="tm-field-label">Address</span>
            <input id="tu_addr" class="tm-input" type="text" placeholder="Address" value="${escapeHtml(u.user_address || "")}" />
          </label>
        </div>
      </section>

      <section class="tm-modal-section">
        <h3 class="tm-modal-section-title">Links</h3>
        <div class="tm-form-grid">
          <label class="tm-field tm-field--full">
            <span class="tm-field-label">Contract URL</span>
            <input id="tu_contract" class="tm-input" type="url" placeholder="https://…" value="${escapeHtml(u.user_contract_url || "")}" />
          </label>
        </div>
      </section>

      <section class="tm-modal-section">
        <h3 class="tm-modal-section-title">Security</h3>
        <div class="tm-form-grid">
          <label class="tm-field tm-field--full">
            <span class="tm-field-label">Password (optional)</span>
            <input id="tu_password" class="tm-input" type="password" placeholder="Set / reset password…" />
            <div class="tm-hint">Leave empty to keep current password.</div>
          </label>
        </div>
      </section>
    `;
  }

  function buildPayload() {
    const name = (qs("tu_name")?.value || "").trim();
    if (!name) {
      alert("Missing required field: Name");
      return null;
    }

    const colorRaw = (qs("tu_color")?.value || "").trim();
    let avatar_color = null;
    if (colorRaw !== "") {
      const n = Number(colorRaw);
      if (!Number.isFinite(n) || n < 0 || n > 360) {
        alert("Avatar Color must be a number between 0 and 360.");
        return null;
      }
      avatar_color = Math.round(n);
    }

    const payload = {
      user_name: name,
      role_id: qs("tu_role")?.value || null,
      seniority_id: qs("tu_seniority")?.value || null,
      status_id: qs("tu_status")?.value || null,
      user_photo: (qs("tu_photo")?.value || "").trim() || null,
      avatar_color,
      user_phone_number: (qs("tu_phone")?.value || "").trim() || null,
      user_birthday: qs("tu_bday")?.value || null,
      user_address: (qs("tu_addr")?.value || "").trim() || null,
      user_contract_url: (qs("tu_contract")?.value || "").trim() || null,
    };

    const pass = (qs("tu_password")?.value || "").trim();
    if (pass) payload.password = pass;

    return payload;
  }

  function bind() {
    const modal = qs(MODAL_ID);
    if (!modal) return;         // <- IMPORTANT: no “quemar” bind si aún no existe
    if (_bound) return;
    _bound = true;

    qs("btnCloseTeamUserModal")?.addEventListener("click", (e) => {
      e.preventDefault();
      close();
    });

    qs("btnCancelTeamUser")?.addEventListener("click", (e) => {
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
    qs("btnSaveTeamUser")?.addEventListener("click", async (e) => {
      e.preventDefault();

      const btn = qs("btnSaveTeamUser");
      const payload = buildPayload();
      if (!payload) return;

      btn && (btn.disabled = true);

      try {
        let out = null;
        if (state.mode === "edit" && state.userId) out = await patchUser(state.userId, payload);
        else out = await createUser(payload);

        close();
        if (typeof state.onSaved === "function") await state.onSaved(out);
      } catch (err) {
        console.error("[TeamUserModal] save failed:", err);
        alert("Save failed. Check console.");
      } finally {
        btn && (btn.disabled = false);
      }
    });

    // Delete
    qs("btnDeleteTeamUser")?.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!state.userId) return;

      if (!confirm("Delete this user?")) return;

      const btn = qs("btnDeleteTeamUser");
      btn && (btn.disabled = true);

      try {
        await deleteUser(state.userId);
        close();
        if (typeof state.onDeleted === "function") await state.onDeleted(state.userId);
      } catch (err) {
        console.error("[TeamUserModal] delete failed:", err);
        alert("Delete failed. Check console.");
      } finally {
        btn && (btn.disabled = false);
      }
    });
  }

  // Expose
  window.TeamUserModal = { open, close, bind };
})();
