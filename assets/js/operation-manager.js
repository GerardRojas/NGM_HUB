/**
 * OPERATION MANAGER - Visual Task Dependency Canvas
 * ==================================================
 * Shows the current user's tasks + coworker dependency tasks,
 * color-coded by category, auto-laid out as a dependency tree.
 * Built on NGMCanvas reusable library.
 */
(function () {
    'use strict';

    const API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';

    // ================================
    // Category config
    // ================================
    const CATEGORIES = {
        working:      { label: 'WORKING',     color: '#f59e0b' },
        'good-to-go': { label: 'GOOD TO GO',  color: '#3ecf8e' },
        blocked:      { label: 'BLOCKED',      color: '#ef4444' },
        'not-started': { label: 'NOT STARTED', color: '#6b7280' },
        dependency:   { label: 'DEPENDENCY',   color: '#60a5fa' },
    };

    // ================================
    // State
    // ================================
    const state = {
        canvas: null,
        tasks: [],
        dependencyTasks: [],    // coworker tasks that affect ours
        allDisplayTasks: [],    // tasks + dependency tasks combined
        dependencies: [],       // { from, to } pairs
        workload: null,
        currentUser: null,
        categorized: {},        // category -> task[]
        positions: {},          // taskId -> { x, y }
        filters: {
            hiddenCategories: [],
        },
    };

    // ================================
    // DOM References
    // ================================
    let els = {};

    function cacheElements() {
        els = {
            canvasContainer: document.getElementById('canvasContainer'),
            emptyState: document.getElementById('emptyState'),
            countWorking: document.getElementById('countWorking'),
            countGoodToGo: document.getElementById('countGoodToGo'),
            countBlocked: document.getElementById('countBlocked'),
            countNotStarted: document.getElementById('countNotStarted'),
            filterMenu: document.getElementById('filterMenu'),
            filterBadge: document.getElementById('filterBadge'),
            filterCategoriesList: document.getElementById('filterCategoriesList'),
        };
    }

    // ================================
    // Auth
    // ================================
    function getAuthHeaders() {
        const token = localStorage.getItem('ngmToken');
        return token ? { Authorization: 'Bearer ' + token } : {};
    }

    // ================================
    // Init
    // ================================
    async function init() {
        cacheElements();
        loadCurrentUser();
        loadFilters();

        // Initialize canvas
        state.canvas = new window.NGMCanvas(els.canvasContainer, {
            gridWidth: 6000,
            gridHeight: 6000,
            initialScale: 0.85,
            showMinimap: true,
            dotGrid: true,
        });

        setupToolbarEvents();
        setupCanvasEvents();

        await loadTasks();
        await loadDependencies();

        categorizeAndLayout();
        renderCards();
        renderConnections();
        updateStats();

        if (state.allDisplayTasks.length > 0) {
            state.canvas.fitToView(80);
        }

        hidePageLoading();
    }

    function loadCurrentUser() {
        const str = localStorage.getItem('ngm_user');
        if (str) {
            try { state.currentUser = JSON.parse(str); } catch (e) { /* ignore */ }
        }
    }

    // hidePageLoading is provided by page-loading.js (global)

    // ================================
    // Filters
    // ================================
    function loadFilters() {
        const str = localStorage.getItem('ngm_om_filters');
        if (str) {
            try {
                const saved = JSON.parse(str);
                state.filters = { ...state.filters, ...saved };
            } catch (e) { /* ignore */ }
        }
    }

    function saveFilters() {
        localStorage.setItem('ngm_om_filters', JSON.stringify(state.filters));
    }

    function renderFilterCheckboxes() {
        if (!els.filterCategoriesList) return;
        const cats = ['working', 'good-to-go', 'blocked', 'not-started', 'dependency'];
        els.filterCategoriesList.innerHTML = cats.map(cat => {
            const checked = !state.filters.hiddenCategories.includes(cat) ? 'checked' : '';
            const info = CATEGORIES[cat];
            return `
                <label class="om-filter-checkbox">
                    <input type="checkbox" data-category="${cat}" ${checked}>
                    <span class="om-filter-checkbox-label" style="color:${info.color};">${info.label}</span>
                </label>
            `;
        }).join('');

        els.filterCategoriesList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const cat = cb.dataset.category;
                if (cb.checked) {
                    state.filters.hiddenCategories = state.filters.hiddenCategories.filter(c => c !== cat);
                } else {
                    if (!state.filters.hiddenCategories.includes(cat)) {
                        state.filters.hiddenCategories.push(cat);
                    }
                }
                saveFilters();
                refreshView();
            });
        });
    }

    function updateFilterBadge() {
        const count = state.filters.hiddenCategories.length;
        if (els.filterBadge) {
            els.filterBadge.style.display = count > 0 ? 'inline-flex' : 'none';
            els.filterBadge.textContent = count;
        }
    }

    // ================================
    // Event Setup
    // ================================
    function setupToolbarEvents() {
        // Zoom buttons
        const btnZoomIn = document.getElementById('btnZoomIn');
        const btnZoomOut = document.getElementById('btnZoomOut');
        const btnFitView = document.getElementById('btnFitView');

        btnZoomIn?.addEventListener('click', () => state.canvas.setScale(state.canvas.getScale() + 0.1));
        btnZoomOut?.addEventListener('click', () => state.canvas.setScale(state.canvas.getScale() - 0.1));
        btnFitView?.addEventListener('click', () => state.canvas.fitToView(80));

        // Filter toggle
        const btnFilter = document.getElementById('btnFilter');
        btnFilter?.addEventListener('click', (e) => {
            e.stopPropagation();
            els.filterMenu?.classList.toggle('open');
        });

        // Close filter on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#filterDropdown')) {
                els.filterMenu?.classList.remove('open');
            }
        });

        // Reset filters
        const btnReset = document.getElementById('btnResetFilters');
        btnReset?.addEventListener('click', () => {
            state.filters.hiddenCategories = [];
            saveFilters();
            renderFilterCheckboxes();
            refreshView();
        });

        renderFilterCheckboxes();
    }

    function setupCanvasEvents() {
        els.canvasContainer.addEventListener('ngm:node-drag-end', (e) => {
            const { nodeId, x, y } = e.detail;
            state.positions[nodeId] = { x, y };
            savePositions();
        });

        els.canvasContainer.addEventListener('ngm:node-click', (e) => {
            // Future: open task detail panel
        });
    }

    // ================================
    // Data Loading
    // ================================
    async function loadTasks() {
        if (!state.currentUser?.user_id) {
            state.tasks = generateMockTasks();
            return;
        }

        try {
            const resp = await fetch(
                API_BASE + '/pipeline/my-work/' + state.currentUser.user_id,
                { headers: getAuthHeaders() }
            );
            if (!resp.ok) throw new Error('API error ' + resp.status);

            const data = await resp.json();
            state.workload = data.workload || null;
            state.tasks = (data.tasks || []).map(transformTask);
        } catch (err) {
            console.warn('[OM] Failed to load tasks, using mock data:', err.message);
            state.tasks = generateMockTasks();
        }
    }

    async function loadDependencies() {
        if (!state.currentUser?.user_id) {
            state.dependencies = generateMockDependencies();
            return;
        }

        // Load dependencies for each project the user has tasks in
        const projectIds = [...new Set(state.tasks.map(t => t.projectId).filter(Boolean))];
        const allDeps = [];

        for (const pid of projectIds) {
            try {
                const resp = await fetch(
                    API_BASE + '/pipeline/dependencies/' + pid,
                    { headers: getAuthHeaders() }
                );
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data)) {
                        allDeps.push(...data);
                    }
                }
            } catch (err) {
                console.warn('[OM] Failed to load dependencies for project', pid);
            }
        }

        state.dependencies = allDeps.map(d => ({
            from: d.source_task_id || d.from_task_id,
            to: d.target_task_id || d.to_task_id,
        }));
    }

    function transformTask(t) {
        const userName = t.assigned_to_name || state.currentUser?.user_name || 'User';
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return {
            id: t.task_id,
            title: t.task_description || 'Untitled',
            project: t.project_name || 'No Project',
            projectId: t.project_id,
            assigneeId: t.assigned_to,
            assigneeName: userName,
            assigneeInitials: initials,
            assigneeColor: t.avatar_color || null,
            status: t.status_name?.toLowerCase().includes('working') ? 'working' : 'not_started',
            priority: mapPriority(t.priority_name),
            dueDate: t.deadline || t.due_date,
            duration: t.estimated_hours || 2,
            isOverdue: t.is_overdue || false,
            isDueSoon: t.is_due_soon || false,
            isOwn: true,
        };
    }

    function mapPriority(name) {
        if (!name) return 'medium';
        const l = name.toLowerCase();
        if (l.includes('high') || l.includes('urgent')) return 'high';
        if (l.includes('low')) return 'low';
        return 'medium';
    }

    // ================================
    // Category Computation
    // ================================
    function computeCategory(task) {
        if (!task.isOwn) return 'dependency';
        if (task.status === 'working') return 'working';

        // Check workload
        const util = state.workload?.utilization_percent || 0;
        if (util >= 100) return 'blocked';
        if (task.priority === 'high' && util < 80) return 'good-to-go';
        return 'not-started';
    }

    // ================================
    // Tree Layout
    // ================================
    function categorizeAndLayout() {
        // Build combined task list (own + dependency tasks from connections)
        state.allDisplayTasks = [...state.tasks];
        state.dependencyTasks = []; // TODO: fetch coworker tasks when API supports it

        // Categorize
        state.categorized = {};
        for (const cat of Object.keys(CATEGORIES)) {
            state.categorized[cat] = [];
        }

        state.allDisplayTasks.forEach(task => {
            const cat = computeCategory(task);
            task._category = cat;
            if (state.categorized[cat]) {
                state.categorized[cat].push(task);
            }
        });

        // Load saved positions
        loadPositions();

        // Calculate tree layout
        const layout = calculateTreeLayout(state.allDisplayTasks, state.dependencies);
        state.positions = { ...layout, ...state.positions };
    }

    function calculateTreeLayout(tasks, deps) {
        const positions = {};
        if (tasks.length === 0) return positions;

        // Build adjacency: which tasks depend on which
        const dependsOn = {}; // taskId -> [taskIds it depends on]
        const depBy = {};     // taskId -> [taskIds that depend on it]

        deps.forEach(d => {
            if (!dependsOn[d.to]) dependsOn[d.to] = [];
            dependsOn[d.to].push(d.from);
            if (!depBy[d.from]) depBy[d.from] = [];
            depBy[d.from].push(d.to);
        });

        const taskIds = new Set(tasks.map(t => t.id));

        // Find root nodes (no dependencies within our task set)
        const roots = tasks.filter(t => {
            const deps = dependsOn[t.id] || [];
            return deps.filter(id => taskIds.has(id)).length === 0;
        });

        // BFS to assign levels
        const levels = {};
        const visited = new Set();
        const queue = roots.map(t => ({ id: t.id, level: 0 }));
        roots.forEach(t => { levels[t.id] = 0; visited.add(t.id); });

        while (queue.length > 0) {
            const { id, level } = queue.shift();
            const children = (depBy[id] || []).filter(cid => taskIds.has(cid));
            children.forEach(cid => {
                if (!visited.has(cid)) {
                    visited.add(cid);
                    levels[cid] = level + 1;
                    queue.push({ id: cid, level: level + 1 });
                }
            });
        }

        // Assign level 0 to any unvisited tasks
        tasks.forEach(t => {
            if (levels[t.id] === undefined) {
                levels[t.id] = 0;
            }
        });

        // Group by level
        const byLevel = {};
        tasks.forEach(t => {
            const lv = levels[t.id];
            if (!byLevel[lv]) byLevel[lv] = [];
            byLevel[lv].push(t);
        });

        // Sort within each level by priority (high first), then due date
        const prioOrder = { high: 0, medium: 1, low: 2 };
        Object.values(byLevel).forEach(arr => {
            arr.sort((a, b) => {
                const pa = prioOrder[a.priority] ?? 1;
                const pb = prioOrder[b.priority] ?? 1;
                if (pa !== pb) return pa - pb;
                return (a.dueDate || '').localeCompare(b.dueDate || '');
            });
        });

        // Assign positions
        const SPACING_X = 320;
        const SPACING_Y = 180;
        const BASE_X = 200;
        const BASE_Y = 150;

        Object.entries(byLevel).forEach(([level, arr]) => {
            arr.forEach((task, idx) => {
                positions[task.id] = {
                    x: BASE_X + parseInt(level) * SPACING_X,
                    y: BASE_Y + idx * SPACING_Y,
                };
            });
        });

        return positions;
    }

    // ================================
    // Rendering
    // ================================
    function renderCards() {
        // Clear existing
        const container = state.canvas.getNodesContainer();
        container.innerHTML = '';

        const visibleTasks = state.allDisplayTasks.filter(t =>
            !state.filters.hiddenCategories.includes(t._category)
        );

        if (visibleTasks.length === 0) {
            els.emptyState.style.display = 'block';
            return;
        }
        els.emptyState.style.display = 'none';

        visibleTasks.forEach(task => {
            const pos = state.positions[task.id] || { x: 200, y: 200 };
            const cardEl = createTaskCard(task);
            state.canvas.addNode(task.id, cardEl, pos.x, pos.y, {
                color: CATEGORIES[task._category]?.color || '#6b7280',
            });
        });

        updateFilterBadge();
    }

    function createTaskCard(task) {
        const cat = task._category;
        const info = CATEGORIES[cat] || CATEGORIES['not-started'];

        const card = document.createElement('div');
        card.className = 'om-task-card category-' + cat;
        card.dataset.taskId = task.id;
        card.style.position = 'relative'; // for badge absolute positioning

        // Project icon color (hash-based)
        const projHue = hashStringToHue(task.project);
        const projColor = 'hsl(' + projHue + ', 70%, 45%)';
        const projInitial = (task.project || '?')[0].toUpperCase();

        // Assignee avatar color
        const avatarHue = task.assigneeColor || hashStringToHue(task.assigneeId || task.assigneeName);
        const avatarBg = typeof avatarHue === 'number'
            ? 'hsl(' + avatarHue + ', 70%, 45%)'
            : 'hsl(' + avatarHue + ', 70%, 45%)';

        // Due date info
        const dueInfo = getDueInfo(task.dueDate, task.isOverdue, task.isDueSoon);

        card.innerHTML = `
            <div class="om-card-badge">${escapeHtml(info.label)}</div>
            <div class="om-card-header">
                <div class="om-card-icon" style="background:${projColor}20;border-color:${projColor};color:${projColor};">
                    ${projInitial}
                </div>
                <span class="om-card-project">${escapeHtml(task.project)}</span>
            </div>
            <div class="om-card-title">${escapeHtml(task.title)}</div>
            <div class="om-card-stats">
                <div class="om-card-avatar" style="background:${avatarBg};">
                    ${task.assigneeInitials}
                </div>
                <span class="om-card-priority priority-${task.priority}">
                    <span class="om-priority-dot"></span>
                    ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </span>
                <span class="om-card-hours">${task.duration}h</span>
            </div>
            <div class="om-card-footer">
                <span class="om-card-due ${dueInfo.cls}">${dueInfo.text}</span>
                ${!task.isOwn ? '<span class="om-card-owner">' + escapeHtml(task.assigneeName) + '</span>' : ''}
            </div>
            <div class="om-port port-left" data-port="left"></div>
            <div class="om-port port-right" data-port="right"></div>
        `;

        return card;
    }

    function renderConnections() {
        state.canvas.clearConnections();

        const visibleIds = new Set(
            state.allDisplayTasks
                .filter(t => !state.filters.hiddenCategories.includes(t._category))
                .map(t => t.id)
        );

        state.dependencies.forEach((dep, i) => {
            if (!visibleIds.has(dep.from) || !visibleIds.has(dep.to)) return;

            const fromTask = state.allDisplayTasks.find(t => t.id === dep.from);
            const toTask = state.allDisplayTasks.find(t => t.id === dep.to);
            if (!fromTask || !toTask) return;

            // Color based on status
            let color = '#3f3f46';
            let animated = false;
            if (fromTask.isOverdue || toTask.isOverdue) {
                color = '#ef4444';
                animated = true;
            } else if (fromTask.status === 'working' || toTask.status === 'working') {
                color = '#3ecf8e';
                animated = true;
            }

            state.canvas.addConnection('dep-' + i, dep.from, dep.to, {
                color,
                animated,
                dashed: true,
                arrowhead: true,
            });
        });

        // Auto-connect tasks within same project (if no explicit dependencies)
        if (state.dependencies.length === 0) {
            autoConnectByProject();
        }
    }

    function autoConnectByProject() {
        const byProject = {};
        state.allDisplayTasks
            .filter(t => !state.filters.hiddenCategories.includes(t._category))
            .forEach(t => {
                const key = t.projectId || 'none';
                if (!byProject[key]) byProject[key] = [];
                byProject[key].push(t);
            });

        let connIdx = 0;
        Object.values(byProject).forEach(arr => {
            if (arr.length < 2) return;
            // Sort by X position
            const sorted = [...arr].sort((a, b) => {
                const posA = state.positions[a.id] || { x: 0 };
                const posB = state.positions[b.id] || { x: 0 };
                return posA.x - posB.x;
            });

            for (let i = 0; i < sorted.length - 1; i++) {
                state.canvas.addConnection('auto-' + connIdx++, sorted[i].id, sorted[i + 1].id, {
                    color: '#3ecf8e',
                    animated: true,
                    dashed: true,
                    arrowhead: true,
                });
            }
        });
    }

    function refreshView() {
        // Remove all nodes
        state.allDisplayTasks.forEach(t => {
            state.canvas.removeNode(t.id);
        });
        renderCards();
        renderConnections();
        updateStats();
    }

    // ================================
    // Stats
    // ================================
    function updateStats() {
        const counts = {};
        for (const cat of Object.keys(CATEGORIES)) counts[cat] = 0;

        state.allDisplayTasks.forEach(t => {
            if (counts[t._category] !== undefined) counts[t._category]++;
        });

        if (els.countWorking) els.countWorking.textContent = counts.working || 0;
        if (els.countGoodToGo) els.countGoodToGo.textContent = counts['good-to-go'] || 0;
        if (els.countBlocked) els.countBlocked.textContent = counts.blocked || 0;
        if (els.countNotStarted) els.countNotStarted.textContent = counts['not-started'] || 0;
    }

    // ================================
    // Position Persistence
    // ================================
    function loadPositions() {
        const str = localStorage.getItem('ngm_om_positions');
        if (str) {
            try { state.positions = JSON.parse(str); } catch (e) { /* ignore */ }
        }
    }

    function savePositions() {
        localStorage.setItem('ngm_om_positions', JSON.stringify(state.positions));
    }

    // ================================
    // Helpers
    // ================================
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function hashStringToHue(str) {
        if (!str) return 200;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash) % 360;
    }

    function getDueInfo(dueDate, isOverdue, isDueSoon) {
        if (!dueDate) return { text: 'No due date', cls: '' };

        const d = new Date(dueDate);
        const now = new Date();
        const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));

        if (isOverdue || diff < 0) {
            return { text: Math.abs(diff) + 'd overdue', cls: 'overdue' };
        }
        if (isDueSoon || (diff >= 0 && diff <= 3)) {
            return { text: diff === 0 ? 'Due today' : diff + 'd left', cls: 'soon' };
        }

        const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return { text: month[d.getMonth()] + ' ' + d.getDate(), cls: '' };
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // ================================
    // Mock Data (for development)
    // ================================
    function generateMockTasks() {
        const user = state.currentUser?.user_name || 'User';
        const initials = user.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return [
            {
                id: 'task-1', title: 'Review electrical rough-in inspection',
                project: 'Del Rio Residence', projectId: 'proj-1',
                assigneeId: 'u1', assigneeName: user, assigneeInitials: initials, assigneeColor: null,
                status: 'working', priority: 'high',
                dueDate: '2026-02-12', duration: 4, isOverdue: false, isDueSoon: true, isOwn: true,
            },
            {
                id: 'task-2', title: 'Coordinate HVAC installation schedule',
                project: 'Del Rio Residence', projectId: 'proj-1',
                assigneeId: 'u1', assigneeName: user, assigneeInitials: initials, assigneeColor: null,
                status: 'working', priority: 'medium',
                dueDate: '2026-02-15', duration: 6, isOverdue: false, isDueSoon: false, isOwn: true,
            },
            {
                id: 'task-3', title: 'Submit permit application for Phase 2',
                project: 'Arthur Neal Court', projectId: 'proj-2',
                assigneeId: 'u1', assigneeName: user, assigneeInitials: initials, assigneeColor: null,
                status: 'not_started', priority: 'high',
                dueDate: '2026-02-08', duration: 3, isOverdue: true, isDueSoon: false, isOwn: true,
            },
            {
                id: 'task-4', title: 'Order windows and doors for Phase 2',
                project: 'Arthur Neal Court', projectId: 'proj-2',
                assigneeId: 'u1', assigneeName: user, assigneeInitials: initials, assigneeColor: null,
                status: 'not_started', priority: 'medium',
                dueDate: '2026-02-20', duration: 2, isOverdue: false, isDueSoon: false, isOwn: true,
            },
            {
                id: 'task-5', title: 'Finalize landscaping design review',
                project: 'Del Rio Residence', projectId: 'proj-1',
                assigneeId: 'u1', assigneeName: user, assigneeInitials: initials, assigneeColor: null,
                status: 'not_started', priority: 'low',
                dueDate: '2026-02-25', duration: 1, isOverdue: false, isDueSoon: false, isOwn: true,
            },
        ];
    }

    function generateMockDependencies() {
        return [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-3', to: 'task-4' },
        ];
    }

    // ================================
    // Bootstrap
    // ================================
    document.addEventListener('DOMContentLoaded', init);

})();
