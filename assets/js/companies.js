// assets/js/companies.js
document.addEventListener("DOMContentLoaded", () => {
  // 1) Auth / role gate
  const userRaw = localStorage.getItem("ngmUser");
  if (!userRaw) {
    window.location.href = "login.html";
    return;
  }

  let user = null;
  try {
    user = JSON.parse(userRaw);
  } catch (err) {
    console.error("[COMPANIES] invalid ngmUser in localStorage", err);
    localStorage.removeItem("ngmUser");
    window.location.href = "login.html";
    return;
  }

  const role = String(user.role || user.role_id || "").trim();
  const allowedRoles = new Set(["COO", "CEO", "General Coordinator", "Project Coordinator"]);

  // Update topbar user pill
  const userPill = document.getElementById("user-pill");
  if (userPill) {
    const name = user.name || user.username || user.email || "User";
    userPill.textContent = `${name} \u00b7 ${role || "\u2014"}`;
  }

  if (!allowedRoles.has(role)) {
    if (window.Toast) {
      Toast.error('Access Denied', 'You do not have permission to access this page.');
    }
    window.location.href = "dashboard.html";
    return;
  }

  // 2) DOM refs
  const board = document.getElementById("companies-board");
  const searchInput = document.getElementById("companies-search-input");
  if (!board) return;

  // 3) API helpers
  function getApiBase() {
    const base = window.API_BASE || window.apiBase || "";
    return String(base || "").replace(/\/+$/, "");
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, { credentials: "include", ...options });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      throw new Error(`${options.method || "GET"} ${url} failed (${res.status}): ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async function fetchCompanies(q = "") {
    const base = getApiBase();
    if (!base) throw new Error("API_BASE no esta definido. Revisa assets/js/config.js");

    const url = new URL(`${base}/companies`);
    if (q) url.searchParams.set("q", q);

    return await apiJson(url.toString());
  }

  async function apiDeleteCompany(companyId) {
    const base = getApiBase();
    return await apiJson(`${base}/companies/${companyId}`, { method: "DELETE" });
  }

  // 4) Helpers (UI)
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getInitial(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    return s[0].toUpperCase();
  }

  function normalize(s) {
    return String(s || "").toLowerCase().trim();
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  // Stable hue from string (id or name)
  function stableHueFromString(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h % 360;
  }

  function colorFromCompany(c) {
    const ac = Number(c.avatar_color);
    const hue = Number.isFinite(ac) ? clamp(ac, 0, 360) : stableHueFromString(c.id || c.name);
    return `hsl(${hue} 70% 45%)`;
  }

  function adaptCompany(c) {
    return {
      ...c,
      color: colorFromCompany(c),
    };
  }

  // 5) Store
  let companiesStore = [];

  // 6) Grid math
  function computeColsWanted(n) {
    if (n >= 9) return 4;
    if (n >= 6) return 3;
    if (n >= 4) return 2;
    if (n >= 2) return 2;
    return 1;
  }

  function computeMaxCols(availablePx, cardW, gap) {
    return Math.max(1, Math.floor((availablePx + gap) / (cardW + gap)));
  }

  function getBoardWidth() {
    return (
      board.clientWidth ||
      board.parentElement?.clientWidth ||
      document.documentElement.clientWidth ||
      window.innerWidth ||
      0
    );
  }

  // 7) Filtering
  function filterCompanies(query) {
    const q = normalize(query);
    if (!q) return companiesStore.slice();

    return companiesStore.filter((c) => {
      const hay = [
        c.name,
        c.description,
        c.email,
        c.phone,
        c.address,
        c.status,
      ]
        .map(normalize)
        .join(" | ");

      return hay.includes(q);
    });
  }

  // 8) Render grid
  function render(list) {
    board.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "companies-cards";

    const n = list.length;
    const colsWanted = computeColsWanted(n);

    const cardW = 280;
    const gap = 18;

    const available = Math.max(320, getBoardWidth() - 24);
    const maxCols = computeMaxCols(available, cardW, gap);
    const cols = Math.min(colsWanted, maxCols);

    wrap.style.gridTemplateColumns = `repeat(${cols}, ${cardW}px)`;
    wrap.style.gap = `${gap}px`;
    wrap.style.justifyContent = "start";

    list.forEach((c) => {
      const stack = document.createElement("div");
      stack.className = "company-card-stack";

      const back = document.createElement("div");
      back.className = "company-card-back";

      const card = document.createElement("div");
      card.className = "company-card";

      const safeName = escapeHtml(c.name);
      const safeDesc = escapeHtml(c.description || "\u2014");
      const safePhone = escapeHtml(c.phone || "\u2014");
      const safeEmail = escapeHtml(c.email || "\u2014");
      const safeAddr = escapeHtml(c.address || "\u2014");
      const safeStatus = escapeHtml(c.status || "\u2014");

      const initials = escapeHtml(getInitial(c.name));
      const bg = c.color || "#a3a3a3";

      const statusNorm = String(c.status || "").trim().toLowerCase();
      const statusClass = statusNorm === "active" ? "is-active" : statusNorm ? "is-inactive" : "";

      card.innerHTML = `
        <div class="company-avatar" style="color:${bg}; border-color:${bg};" title="${safeName}">
          ${initials}
        </div>

        <div class="company-card-main">
          <div class="company-head">
            <p class="company-name" title="${safeName}">${safeName}</p>
            <span class="company-status-pill ${statusClass}" title="Status">${safeStatus}</span>
          </div>

          <div class="company-fields">
            <div class="company-field">
              <span class="company-field-label">Description</span>
              <span class="company-field-value">${safeDesc}</span>
            </div>

            <div class="company-field">
              <span class="company-field-label">Phone</span>
              <span class="company-field-value">${safePhone}</span>
            </div>

            <div class="company-field">
              <span class="company-field-label">Email</span>
              <span class="company-field-value">${safeEmail}</span>
            </div>

            <div class="company-field">
              <span class="company-field-label">Address</span>
              <span class="company-field-value">${safeAddr}</span>
            </div>
          </div>

          <div class="company-card-actions">
            <button class="company-action-btn" data-action="edit" data-id="${escapeHtml(c.id)}">Edit</button>
            <button class="company-action-btn" data-action="delete" data-id="${escapeHtml(c.id)}">Delete</button>
          </div>
        </div>
      `;

      stack.appendChild(back);
      stack.appendChild(card);
      wrap.appendChild(stack);
    });

    board.appendChild(wrap);
  }

  function rerender() {
    const list = filterCompanies(searchInput?.value || "");
    render(list);
  }

  // 9) Load from API
  async function loadCompaniesFromApi({ keepQuery = true, isInitialLoad = false } = {}) {
    const currentQ = keepQuery ? (searchInput?.value || "") : "";
    try {
      const data = await fetchCompanies("");
      companiesStore = Array.isArray(data) ? data.map(adaptCompany) : [];
      if (keepQuery && searchInput) searchInput.value = currentQ;
      rerender();
      if (isInitialLoad) hidePageLoading();
    } catch (err) {
      console.error("[COMPANIES] loadCompaniesFromApi failed:", err);
      if (window.Toast) {
        Toast.error('Load Failed', 'Failed to load companies.', { details: err.message });
      }
      if (isInitialLoad) hidePageLoading();
    }
  }

  // 10) Actions
  board.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");

    if (action === "edit") {
      const current = companiesStore.find((x) => x.id === id);
      if (!current) {
        if (window.Toast) {
          Toast.warning('Not Found', 'Company not found. Refresh and try again.');
        }
        return;
      }

      window.CompanyModal?.open({
        mode: "edit",
        company: current,
        onSaved: async () => {
          await loadCompaniesFromApi({ keepQuery: true });
        },
        onDeleted: async () => {
          await loadCompaniesFromApi({ keepQuery: true });
        },
      });
      return;
    }

    if (action === "delete") {
      const ok = confirm("Delete this company?");
      if (!ok) return;

      try {
        await apiDeleteCompany(id);
        if (window.Toast) {
          Toast.success('Company Deleted', 'Company deleted successfully!');
        }
        await loadCompaniesFromApi({ keepQuery: true });
      } catch (err) {
        console.error("[COMPANIES] delete failed:", err);
        if (window.Toast) {
          Toast.error('Delete Failed', 'Error deleting company.', { details: err.message });
        }
      }
    }
  });

  // 11) Search
  let searchT = null;
  function onSearchInput() {
    clearTimeout(searchT);
    searchT = setTimeout(() => rerender(), 80);
  }
  if (searchInput) searchInput.addEventListener("input", onSearchInput);

  // 12) Top buttons
  document.getElementById("btn-add-company")?.addEventListener("click", () => {
    window.CompanyModal?.open({
      mode: "create",
      onSaved: async () => {
        await loadCompaniesFromApi({ keepQuery: true });
      },
    });
  });

  // Reflow on resize
  let resizeT = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => rerender(), 120);
  });

  // Initial load
  loadCompaniesFromApi({ keepQuery: false, isInitialLoad: true });
});
