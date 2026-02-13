# NGM HUB WEB - Modules Index

Quick reference index of all JS and CSS modules in NGM HUB WEB. Use this to quickly locate functionality.

---

## JavaScript Modules

### Config

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [config.js](../assets/js/config.js) | 47 | Config | Detects environment (dev/staging/prod) and sets API_BASE, SUPABASE_URL, SUPABASE_ANON_KEY on window | --- |

### Core

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [auth-guard.js](../assets/js/auth-guard.js) | 217 | Core | Shared authentication guard; validates JWT, redirects unauthenticated users, periodic token expiration check | --- |
| [sidebar.js](../assets/js/sidebar.js) | 484 | Core | Dynamically generates sidebar navigation based on role_permissions from the database | --- |
| [permissions.js](../assets/js/permissions.js) | 219 | Core | Loads user role permissions from API and applies view/edit/delete gates to DOM elements | --- |
| [page-loading.js](../assets/js/page-loading.js) | 184 | Core | Unified loading overlay system with minimum display time, logo preload, and auto-hide fallback | --- |
| [firebase-init.js](../assets/js/firebase-init.js) | 335 | Core | Initializes Firebase Cloud Messaging for push notifications; exposes window.NGMPush | --- |
| [login.js](../assets/js/login.js) | 202 | Core | Login page handler; authenticates against backend API, stores token and user data in localStorage | --- |

### Feature

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [dashboard.js](../assets/js/dashboard.js) | 1697 | Feature | Main dashboard; loads mentions, tasks, pending reviews, unread counts, and command palette | --- |
| [dashboard_realtime.js](../assets/js/dashboard_realtime.js) | 294 | Feature | Supabase Realtime subscriptions for live dashboard updates (tasks, mentions) | --- |
| [expenses.js](../assets/js/expenses.js) | 10970 | Feature | Full expenses engine: CRUD, receipt scanning, OCR, filtering, authorization, bill management | [expenses_reference.md](expenses_reference.md) |
| [process_manager.js](../assets/js/process_manager.js) | 9766 | Feature | Visual canvas showing business processes derived from code; tree and detail views with drag/zoom | [process_manager_reference.md](process_manager_reference.md) |
| [pipeline.js](../assets/js/pipeline.js) | 1961 | Feature | Pipeline manager main script; fetches tasks, renders grouped table, manages status transitions | [pipeline_reference.md](pipeline_reference.md) |
| [messages.js](../assets/js/messages.js) | 5215 | Feature | Chat system with project channels, DMs, threads, mentions, reactions, file attachments, realtime | --- |
| [arturito.js](../assets/js/arturito.js) | 1485 | Feature | AI chatbot interface using OpenAI Assistants API; module knowledge base and command handling | [arturito_reference.md](arturito_reference.md) |
| [estimator.js](../assets/js/estimator.js) | 4113 | Feature | Estimator suite for project cost estimation; Supabase storage, auto-save, concept builder | --- |
| [estimator_database.js](../assets/js/estimator_database.js) | 3079 | Feature | Materials and concepts database management; CRUD, pagination, concept builder, image uploads | --- |
| [adu_calculator.js](../assets/js/adu_calculator.js) | 3993 | Feature | Allowance ADU calculator; selection wizard, screenshot analysis, cost calculation by ADU type | --- |
| [vault.js](../assets/js/vault.js) | 1371 | Feature | File storage module; hybrid folder tree + card grid, chunked uploads, versioning, search | --- |
| [projects.js](../assets/js/projects.js) | 572 | Feature | Projects table with CRUD, company filtering, add project modal, edit mode | --- |
| [budgets.js](../assets/js/budgets.js) | 1147 | Feature | Budget management with CSV/QBO import, project filtering, mapping modal | --- |
| [accounts.js](../assets/js/accounts.js) | 478 | Feature | Accounts table CRUD with sort-by-number/category/name and inline editing | --- |
| [vendors.js](../assets/js/vendors.js) | 484 | Feature | Vendors table CRUD with search, bulk delete, and inline editing | --- |
| [companies.js](../assets/js/companies.js) | 358 | Feature | Companies board view with role-gated access, search, and card-based UI | --- |
| [team.js](../assets/js/team.js) | 602 | Feature | Team management page; user list, permission-gated access, user CRUD via modal | --- |
| [team_orgchart.js](../assets/js/team_orgchart.js) | 2124 | Feature | Org chart canvas with drag/drop user cards, SVG connections, groups, and pan/zoom | --- |
| [roles.js](../assets/js/roles.js) | 506 | Feature | Roles permission matrix; edit can_view/can_edit/can_delete per module per role | --- |
| [my-work.js](../assets/js/my-work.js) | 1350 | Feature | Personal task canvas with workload/burnout algorithm and visual indicators | --- |
| [operation-manager.js](../assets/js/operation-manager.js) | 732 | Feature | Visual task dependency canvas showing user tasks and coworker dependencies, auto-laid out | --- |
| [budget_monitor.js](../assets/js/budget_monitor.js) | 793 | Feature | Budget alerts monitor with tabs for overview, pending alerts, and history | --- |
| [budget-vs-actuals.js](../assets/js/budget-vs-actuals.js) | 651 | Feature | Budget vs Actuals report generator with PDF export and variance analysis | --- |
| [pnl-report.js](../assets/js/pnl-report.js) | 801 | Feature | P and L COGS report; same format as BVA but without budget column | --- |
| [project_builder.js](../assets/js/project_builder.js) | 548 | Feature | NGM Revit Suite ecosystem viewer; step-by-step manifest configurator for BIM projects | --- |
| [arturito_analytics.js](../assets/js/arturito_analytics.js) | 253 | Feature | Command analytics dashboard for Agent Hub; charts, failed commands table, stats cards | --- |

### Widget

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [arturito_widget.js](../assets/js/arturito_widget.js) | 2060 | Widget | Floating Arturito chat bubble available on all pages except the dedicated Arturito page | --- |
| [chat_widget.js](../assets/js/chat_widget.js) | 1103 | Widget | Floating mini chat panel (Google Chat-style popup); self-contained, no dependency on messages.js | --- |
| [companies_modal_ui.js](../assets/js/companies_modal_ui.js) | 318 | Widget | Company create/edit modal; loads partial HTML, handles form submission and delete | --- |
| [team_user_modal_ui.js](../assets/js/team_user_modal_ui.js) | 442 | Widget | Team user create/edit modal; loads partial HTML, photo upload, role assignment | --- |

### Picker

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [pipeline_people_picker.js](../assets/js/pipeline_people_picker.js) | 606 | Picker | Monday.com-style dropdown for selecting users in pipeline cells; cached API, avatar colors | --- |
| [pipeline_catalog_picker.js](../assets/js/pipeline_catalog_picker.js) | 630 | Picker | Monday.com-style dropdown for selecting catalog items (projects, companies, departments, types) | --- |
| [pipeline_badge_picker.js](../assets/js/pipeline_badge_picker.js) | 261 | Picker | Colored pill dropdown for status and priority columns in the pipeline table | --- |
| [pipeline_date_picker.js](../assets/js/pipeline_date_picker.js) | 321 | Picker | Custom date picker for pipeline inline editing; calendar popup with month navigation | --- |

### Utility

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [pipeline_utils.js](../assets/js/pipeline_utils.js) | 52 | Utility | Shared utility functions for all pipeline modules: escapeHtml, hashStringToHue, getInitial | --- |
| [pipeline_table_interactions.js](../assets/js/pipeline_table_interactions.js) | 1360 | Utility | Delegated click handler for inline editing of all pipeline table cell types | --- |
| [pipeline_layout.js](../assets/js/pipeline_layout.js) | 229 | Utility | Table width slider; calculates fixed + flex column widths for pipeline table responsiveness | --- |
| [pipeline_automations.js](../assets/js/pipeline_automations.js) | 451 | Utility | Auto-generated pipeline tasks based on system conditions (pending expenses, health checks) | --- |
| [pipeline_new_task_ui.js](../assets/js/pipeline_new_task_ui.js) | 417 | Utility | New task modal form logic; initializes pickers, validates, and submits new tasks | --- |
| [pipeline_edit_task_ui.js](../assets/js/pipeline_edit_task_ui.js) | 763 | Utility | Edit task modal; full task editing with all fields, status options, picker initialization | --- |
| [pipeline_links_modal.js](../assets/js/pipeline_links_modal.js) | 307 | Utility | Links modal for editing docs_link and result_link on pipeline tasks | --- |
| [pills.js](../assets/js/pills.js) | 105 | Utility | Topbar info pills; fetches server health and user info, renders environment/server/user status | --- |
| [toast.js](../assets/js/toast.js) | 216 | Utility | Global toast notification system; exposes window.Toast with success/error/warning/info/chat methods | --- |
| [receipt-upload.js](../assets/js/receipt-upload.js) | 306 | Utility | Receipt file upload to Supabase Storage with validation, progress callback, and signed URL retrieval | --- |
| [html_loader.js](../assets/js/html_loader.js) | 10 | Utility | ES module helper to load HTML fragments into target selectors via fetch() | --- |
| [ngm_canvas.js](../assets/js/ngm_canvas.js) | 1273 | Utility | Reusable infinite canvas library; pan/zoom, node dragging, SVG connections, snap alignment, minimap | --- |
| [pb_canvas.js](../assets/js/pb_canvas.js) | 823 | Utility | SVG canvas engine for Project Builder scan tab; image display, overlay, pan/zoom, element editing | --- |
| [pb_scan_engine.js](../assets/js/pb_scan_engine.js) | 1164 | Utility | OCR scan workflow manager for Project Builder; layer selection, API call, point-to-geometry conversion | --- |

### Realtime

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [pipeline_realtime.js](../assets/js/pipeline_realtime.js) | 240 | Realtime | Supabase Realtime subscription for pipeline tasks; live updates when tasks are modified externally | --- |

### Diagnostic

| Module | Lines | Type | Description | Reference |
|--------|------:|------|-------------|-----------|
| [auth-diagnostic.js](../assets/js/auth-diagnostic.js) | 112 | Diagnostic | Console diagnostic tool (window.diagAuth()) to inspect authorization setup and user roles | --- |
| [jwt-debugger.js](../assets/js/jwt-debugger.js) | 103 | Diagnostic | Console JWT decoder (window.debugJWT()) to inspect token header, payload, and expiration | --- |
| [supabase-bucket-diagnostic.js](../assets/js/supabase-bucket-diagnostic.js) | 177 | Diagnostic | Console diagnostic tool (window.diagBucket()) to verify Supabase Storage bucket configuration | --- |
| [mock-projects.js](../assets/js/mock-projects.js) | 10 | Diagnostic | Hardcoded mock project data array (legacy, replaced by API) | --- |
| [main.js](../assets/js/main.js) | 17 | Diagnostic | Legacy stub; minimal login form handler (superseded by login.js) | --- |

---

## CSS Modules

| Stylesheet | Lines | Paired With | Description |
|------------|------:|-------------|-------------|
| [styles.css](../assets/css/styles.css) | 1149 | All pages | Base shared styles: sidebar, topbar, layout grid, typography, scrollbars, responsive breakpoints |
| [dashboard.css](../assets/css/dashboard.css) | 2209 | dashboard.js | Dashboard cards, mentions drawer, command palette, stats grid, My Work section |
| [expenses_styles.css](../assets/css/expenses_styles.css) | 3943 | expenses.js | Expenses table, toolbar, filter dropdowns, authorization badges, global search |
| [expenses_modal.css](../assets/css/expenses_modal.css) | 3247 | expenses.js | Add/edit expense modal, multi-row table, receipt preview, scan overlay |
| [reconcile_modal.css](../assets/css/reconcile_modal.css) | 717 | expenses.js | QBO reconciliation modal layout and diff view |
| [receipt_upload.css](../assets/css/receipt_upload.css) | 320 | receipt-upload.js | Receipt upload dropzone, progress bar, file preview |
| [pipeline_styles.css](../assets/css/pipeline_styles.css) | 3823 | pipeline.js | Pipeline table, group headers, inline editors, pickers, date picker, badge pills |
| [messages_styles.css](../assets/css/messages_styles.css) | 3974 | messages.js | Chat UI, message bubbles, thread panel, mention highlights, reactions, category cards |
| [arturito_styles.css](../assets/css/arturito_styles.css) | 935 | arturito.js | Arturito full-page chat interface, message formatting, typing indicator |
| [arturito_widget.css](../assets/css/arturito_widget.css) | 724 | arturito_widget.js | Floating Arturito bubble, chat panel slide-in, message list, input area |
| [chat_widget.css](../assets/css/chat_widget.css) | 714 | chat_widget.js | Floating mini chat panel, channel list, message area, compose bar |
| [process_manager.css](../assets/css/process_manager.css) | 7131 | process_manager.js | Process canvas, tree view cards, detail view, SVG connections, drag overlays |
| [estimator_styles.css](../assets/css/estimator_styles.css) | 2038 | estimator.js | Estimator suite layout, concept builder, material picker, save status indicator |
| [adu_calculator_styles.css](../assets/css/adu_calculator_styles.css) | 2850 | adu_calculator.js | ADU wizard steps, type selection cards, cost breakdown table, screenshot analysis |
| [project_builder_styles.css](../assets/css/project_builder_styles.css) | 2156 | project_builder.js | Project Builder steps, definition browser, scan canvas, manifest export |
| [vault_styles.css](../assets/css/vault_styles.css) | 1065 | vault.js | Vault file explorer, folder tree, card grid/list view, context menu, breadcrumb |
| [projects.css](../assets/css/projects.css) | 347 | projects.js | Projects table and add-project modal |
| [companies_styles.css](../assets/css/companies_styles.css) | 383 | companies.js | Companies board cards and search bar |
| [companies_modal.css](../assets/css/companies_modal.css) | 268 | companies_modal_ui.js | Company create/edit modal form layout |
| [team_styles.css](../assets/css/team_styles.css) | 489 | team.js | Team management table and user cards |
| [team_orgchart.css](../assets/css/team_orgchart.css) | 979 | team_orgchart.js | Org chart canvas, user cards, group areas, SVG connections |
| [team_user_modal.css](../assets/css/team_user_modal.css) | 335 | team_user_modal_ui.js | Team user create/edit modal form layout |
| [budget_monitor.css](../assets/css/budget_monitor.css) | 1099 | budget_monitor.js | Budget monitor tabs, alert cards, overview stats, authorization modal |
| [my-work.css](../assets/css/my-work.css) | 1124 | my-work.js | My Work canvas, task nodes, workload indicator, filter panel |
| [ngm_canvas.css](../assets/css/ngm_canvas.css) | 246 | ngm_canvas.js | Reusable canvas library styles: dot grid, minimap, snap guides |
| [operation-manager.css](../assets/css/operation-manager.css) | 693 | operation-manager.js | Operation manager canvas, category legend, task cards, dependency lines |
| [login.css](../assets/css/login.css) | 537 | login.js | Login page layout, form styling, branding |
| [toast.css](../assets/css/toast.css) | 339 | toast.js | Toast notification containers, animations, progress bars, chat toast variant |

---

## HTML Pages

| Page | Page-Specific JS | Page-Specific CSS | Description |
|------|-----------------|-------------------|-------------|
| [login.html](../login.html) | login.js | login.css | User authentication page |
| [dashboard.html](../dashboard.html) | dashboard.js, dashboard_realtime.js | dashboard.css | Main hub with mentions, tasks, pending reviews, command palette |
| [expenses.html](../expenses.html) | expenses.js, receipt-upload.js, jwt-debugger.js, auth-diagnostic.js, supabase-bucket-diagnostic.js | expenses_styles.css, expenses_modal.css, reconcile_modal.css, receipt_upload.css | Full expense management engine |
| [pipeline.html](../pipeline.html) | pipeline_utils, people_picker, catalog_picker, badge_picker, date_picker, new_task_ui, edit_task_ui, links_modal, table_interactions, automations, pipeline, layout, realtime (.js) | pipeline_styles.css | Task pipeline manager with inline editing |
| [messages.html](../messages.html) | pipeline_people_picker.js, messages.js | pipeline_styles.css, messages_styles.css | Project chat with channels, DMs, threads, mentions |
| [arturito.html](../arturito.html) | arturito.js | arturito_styles.css | Dedicated AI assistant chat page |
| [process_manager.html](../process_manager.html) | process_manager.js | process_manager.css | Visual business process documentation canvas |
| [projects.html](../projects.html) | projects.js | expenses_styles.css | Project list with company filter and CRUD |
| [budgets.html](../budgets.html) | budgets.js | expenses_styles.css, expenses_modal.css | Budget management with CSV/QBO import |
| [accounts.html](../accounts.html) | accounts.js | expenses_styles.css | Chart of accounts CRUD |
| [vendors.html](../vendors.html) | vendors.js | expenses_styles.css | Vendor directory CRUD |
| [companies.html](../companies.html) | companies_modal_ui.js, companies.js | companies_styles.css, companies_modal.css | Company management board |
| [team.html](../team.html) | team_user_modal_ui.js, team_orgchart.js, team.js | team_styles.css, team_orgchart.css, team_user_modal.css | Team management with org chart |
| [estimator.html](../estimator.html) | estimator.js | estimator_styles.css | Cost estimator suite |
| [estimator_database.html](../estimator_database.html) | estimator_database.js | expenses_styles.css | Materials and concepts database |
| [vault.html](../vault.html) | vault.js | vault_styles.css | File storage with versioning |
| [my-work.html](../my-work.html) | my-work.js | my-work.css | Personal task canvas with workload algorithm |
| [operation-manager.html](../operation-manager.html) | ngm_canvas.js, operation-manager.js | ngm_canvas.css, operation-manager.css | Task dependency visualization |
| [budget_monitor.html](../budget_monitor.html) | budget_monitor.js | budget_monitor.css | Budget alerts and monitoring |
| [budget-vs-actuals.html](../budget-vs-actuals.html) | budget-vs-actuals.js | expenses_styles.css | Budget vs Actuals variance report |
| [pnl-report.html](../pnl-report.html) | pnl-report.js | expenses_styles.css | P and L COGS report |
| [roles.html](../roles.html) | roles.js | expenses_styles.css | Role permission matrix editor |
| [project-builder.html](../project-builder.html) | pb_canvas.js, pb_scan_engine.js, project_builder.js | project_builder_styles.css | Revit manifest configurator |
| [allowance-adu-calculator.html](../allowance-adu-calculator.html) | adu_calculator.js | adu_calculator_styles.css | ADU cost calculator wizard |
| [agents-settings.html](../agents-settings.html) | arturito_analytics.js | expenses_styles.css | Agent Hub settings and analytics |

---

## Shared Dependencies

Every protected page (all except login.html) loads these scripts and styles:

### Scripts (load order matters)
1. **config.js** -- Environment detection + API/Supabase URLs
2. **auth-guard.js** -- JWT validation, redirect to login if unauthorized
3. **toast.js** -- Global notification system
4. **permissions.js** -- Role-based permission enforcement
5. **pills.js** -- Topbar environment/server/user status pills
6. **sidebar.js** -- Dynamic navigation generation
7. **page-loading.js** -- Loading overlay management

### Scripts (loaded on most pages, not all)
- **arturito_widget.js** -- Floating AI chat bubble (skipped on arturito.html, my-work.html, operation-manager.html, process_manager.html)
- **chat_widget.js** -- Floating mini chat panel (skipped on messages.html, my-work.html, operation-manager.html, process_manager.html)
- **firebase-init.js** -- Push notifications (loaded on most pages via Firebase SDK CDN)

### Styles
1. **styles.css** -- Base shared CSS (all pages)
2. **toast.css** -- Toast notifications (all protected pages)
3. **arturito_widget.css** -- Floating chat bubble (most pages)
4. **chat_widget.css** -- Floating mini chat (most pages)

### External CDNs
- **Supabase JS v2** -- @supabase/supabase-js@2 (pages with realtime or storage)
- **Firebase Compat v10.7.0** -- firebase-app-compat.js + firebase-messaging-compat.js (push notifications)

---

## Monolithic Files Warning

Files over 3000 lines that are candidates for splitting:

| File | Lines | Suggested Split Strategy |
|------|------:|--------------------------|
| **expenses.js** | 10,970 | Split into: expenses_state.js (state + metadata), expenses_table.js (table rendering + filters), expenses_modal.js (add/edit modal logic), expenses_receipt.js (receipt scanning + OCR), expenses_auth.js (authorization workflow), expenses_api.js (API calls + data loading) |
| **process_manager.js** | 9,766 | Split into: pm_data.js (DELIVERABLES/PROCESSES data structures), pm_tree_view.js (Level 1 tree rendering), pm_detail_view.js (Level 2 detail canvas), pm_canvas.js (pan/zoom/drag shared logic), pm_svg.js (SVG connection drawing) |
| **messages.js** | 5,215 | Split into: messages_state.js (config + state), messages_render.js (DOM rendering + caches), messages_realtime.js (Supabase subscriptions + polling), messages_receipts.js (receipt/check flow handling), messages_ui.js (mentions, reactions, attachments) |
| **estimator.js** | 4,113 | Split into: estimator_core.js (state + auto-save), estimator_ui.js (table rendering + group collapse), estimator_concept.js (concept builder modal), estimator_storage.js (Supabase upload/download) |
| **adu_calculator.js** | 3,993 | Split into: adu_wizard.js (step navigation + validation), adu_pricing.js (cost calculation engine), adu_analysis.js (screenshot analysis + AI), adu_config.js (rules + labels + pricing tables) |
| **estimator_database.js** | 3,079 | Split into: estdb_materials.js (materials tab CRUD), estdb_concepts.js (concepts tab + builder), estdb_images.js (image upload/preview), estdb_pagination.js (pagination + filters) |

**Note**: process_manager.css (7,131 lines) is also a candidate for splitting along the same boundaries as its JS counterpart.

---

## Quick Stats

- **Total JS**: 70,907 lines across 61 files
- **Total CSS**: 43,834 lines across 29 files (excluding bk/ backup)
- **HTML Pages**: 25 active pages + 7 partials
- **Pipeline module**: 13 JS files (most modular)
- **Expenses module**: 1 monolithic JS file (least modular)
