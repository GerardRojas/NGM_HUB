/**
 * MY WORK - Visual Pipeline Canvas with Workload Algorithm
 * =========================================================
 * Interactive canvas for viewing and managing personal tasks
 * Includes workload/burnout calculation and visual indicators
 */

(function() {
    'use strict';

    const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";

    // ================================
    // State
    // ================================
    const state = {
        tasks: [],           // All tasks from API
        filteredTasks: [],   // Tasks after applying filters (for display)
        taskTypes: [],       // Available task types for filter
        connections: [],
        workload: null,
        currentUser: null,
        selectedNode: null,
        isPanelOpen: false,

        // Filter settings
        filters: {
            showAutomated: true,
            selectedTypes: [],  // Empty = show all
        },

        // Workload settings
        settings: {
            hoursPerDay: 8,
            daysPerWeek: 6,
        },

        // Canvas state
        canvas: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            minScale: 0.25,
            maxScale: 2,
        },

        // Node dragging
        draggedNode: null,
        dragOffset: { x: 0, y: 0 },

        // View mode
        viewMode: 'pipeline', // 'pipeline' or 'list'
    };

    // ================================
    // DOM References
    // ================================
    let elements = {};

    function cacheElements() {
        elements = {
            canvasContainer: document.getElementById('canvasContainer'),
            canvasGrid: document.getElementById('canvasGrid'),
            nodesContainer: document.getElementById('nodesContainer'),
            connectionsLayer: document.getElementById('connectionsLayer'),
            canvasEmpty: document.getElementById('canvasEmpty'),
            taskPanel: document.getElementById('taskPanel'),
            panelTitle: document.getElementById('panelTitle'),
            panelContent: document.getElementById('panelContent'),
            countWorking: document.getElementById('countWorking'),
            countPending: document.getElementById('countPending'),
            minimapViewport: document.getElementById('minimapViewport'),
        };
    }

    // ================================
    // Initialization
    // ================================
    async function init() {
        cacheElements();
        loadCurrentUser();
        loadSettings();
        loadFilters();
        setupEventListeners();
        await loadTasks();
        applyFilters();
        renderWorkloadIndicator();
        renderNodes();
        renderConnections();
        updateStats();
        centerCanvas();

        // Hide loading overlay and show content
        document.body.classList.remove('page-loading');
        document.body.classList.add('auth-ready');
        const overlay = document.getElementById('pageLoadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }

    function loadCurrentUser() {
        const userStr = localStorage.getItem('ngm_user');
        if (userStr) {
            try {
                state.currentUser = JSON.parse(userStr);
            } catch (e) {
                console.error('[MY-WORK] Error parsing user:', e);
            }
        }
    }

    function loadSettings() {
        const settingsStr = localStorage.getItem('ngm_mywork_settings');
        if (settingsStr) {
            try {
                const saved = JSON.parse(settingsStr);
                state.settings = { ...state.settings, ...saved };
            } catch (e) {
                console.error('[MY-WORK] Error loading settings:', e);
            }
        }
    }

    function saveSettings() {
        localStorage.setItem('ngm_mywork_settings', JSON.stringify(state.settings));
    }

    function loadFilters() {
        const filtersStr = localStorage.getItem('ngm_mywork_filters');
        if (filtersStr) {
            try {
                const saved = JSON.parse(filtersStr);
                state.filters = { ...state.filters, ...saved };
            } catch (e) {
                console.error('[MY-WORK] Error loading filters:', e);
            }
        }
    }

    function saveFilters() {
        localStorage.setItem('ngm_mywork_filters', JSON.stringify(state.filters));
    }

    // ================================
    // Event Listeners
    // ================================
    function setupEventListeners() {
        // Canvas panning
        elements.canvasContainer.addEventListener('mousedown', onCanvasMouseDown);
        document.addEventListener('mousemove', onCanvasMouseMove);
        document.addEventListener('mouseup', onCanvasMouseUp);

        // Zoom
        elements.canvasContainer.addEventListener('wheel', onCanvasWheel, { passive: false });
        document.getElementById('btnZoomIn')?.addEventListener('click', () => zoom(1.2));
        document.getElementById('btnZoomOut')?.addEventListener('click', () => zoom(0.8));
        document.getElementById('btnFitView')?.addEventListener('click', fitToView);

        // Panel close
        document.getElementById('btnClosePanel')?.addEventListener('click', closePanel);

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                setViewMode(view);
            });
        });

        // Panel actions
        document.getElementById('btnOpenInPipeline')?.addEventListener('click', openInPipeline);
        document.getElementById('btnUpdateStatus')?.addEventListener('click', toggleTaskStatus);

        // Keyboard shortcuts
        document.addEventListener('keydown', onKeyDown);

        // Click outside to deselect
        elements.canvasContainer.addEventListener('click', onCanvasClick);

        // Filter controls
        setupFilterListeners();
    }

    // ================================
    // Filter Controls
    // ================================
    function setupFilterListeners() {
        const btnFilter = document.getElementById('btnFilter');
        const filterMenu = document.getElementById('filterMenu');
        const btnResetFilters = document.getElementById('btnResetFilters');
        const filterShowAutomated = document.getElementById('filterShowAutomated');

        // Toggle filter menu
        btnFilter?.addEventListener('click', (e) => {
            e.stopPropagation();
            filterMenu?.classList.toggle('open');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-dropdown')) {
                filterMenu?.classList.remove('open');
            }
        });

        // Automated checkbox
        filterShowAutomated?.addEventListener('change', () => {
            state.filters.showAutomated = filterShowAutomated.checked;
            saveFilters();
            applyFilters();
            renderNodes();
            renderConnections();
            updateStats();
            renderWorkloadIndicator();
        });

        // Reset filters
        btnResetFilters?.addEventListener('click', () => {
            state.filters.showAutomated = true;
            state.filters.selectedTypes = [];
            if (filterShowAutomated) filterShowAutomated.checked = true;
            saveFilters();
            renderFilterTypesList();
            applyFilters();
            renderNodes();
            renderConnections();
            updateStats();
            renderWorkloadIndicator();
        });
    }

    function renderFilterTypesList() {
        const container = document.getElementById('filterTypesList');
        if (!container) return;

        if (state.taskTypes.length === 0) {
            container.innerHTML = '<div class="filter-empty">No task types found</div>';
            return;
        }

        container.innerHTML = state.taskTypes.map(type => `
            <label class="filter-checkbox">
                <input type="checkbox"
                       data-type-id="${type.id}"
                       ${state.filters.selectedTypes.length === 0 || state.filters.selectedTypes.includes(type.id) ? 'checked' : ''}>
                <span class="checkbox-label">${escapeHtml(type.name)}</span>
            </label>
        `).join('');

        // Add listeners for type checkboxes
        container.querySelectorAll('input[data-type-id]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const typeId = checkbox.dataset.typeId;
                const allChecked = Array.from(container.querySelectorAll('input[data-type-id]')).every(cb => cb.checked);

                if (allChecked) {
                    // All checked = no filter (show all)
                    state.filters.selectedTypes = [];
                } else {
                    // Build list of checked types
                    state.filters.selectedTypes = Array.from(container.querySelectorAll('input[data-type-id]:checked'))
                        .map(cb => cb.dataset.typeId);
                }

                saveFilters();
                applyFilters();
                renderNodes();
                renderConnections();
                updateStats();
                renderWorkloadIndicator();
            });
        });
    }

    function applyFilters() {
        // Start with all tasks
        let filtered = [...state.tasks];

        // Filter by automated
        if (!state.filters.showAutomated) {
            filtered = filtered.filter(t => !t.isAutomated);
        }

        // Filter by task type (only if specific types selected)
        if (state.filters.selectedTypes.length > 0) {
            filtered = filtered.filter(t => state.filters.selectedTypes.includes(t.typeId));
        }

        state.filteredTasks = filtered;

        // Update filter badge
        updateFilterBadge();
        updateFilterSummary();
    }

    function updateFilterBadge() {
        const badge = document.getElementById('filterBadge');
        if (!badge) return;

        let activeFilters = 0;
        if (!state.filters.showAutomated) activeFilters++;
        if (state.filters.selectedTypes.length > 0) activeFilters++;

        if (activeFilters > 0) {
            badge.textContent = activeFilters;
            badge.style.display = '';
        } else {
            badge.style.display = 'none';
        }
    }

    function updateFilterSummary() {
        const summary = document.getElementById('filterSummary');
        if (!summary) return;

        const total = state.tasks.length;
        const visible = state.filteredTasks.length;
        const hidden = total - visible;

        if (hidden === 0) {
            summary.textContent = `Showing all ${total} tasks`;
        } else {
            summary.textContent = `Showing ${visible} of ${total} tasks (${hidden} hidden)`;
        }
    }

    // ================================
    // Data Loading
    // ================================
    async function loadTasks() {
        try {
            const userId = state.currentUser?.user_id;
            if (!userId) {
                console.warn('[MY-WORK] No user ID found');
                state.tasks = [];
                state.workload = null;
                return;
            }

            const url = `${API_BASE}/pipeline/my-work/${userId}?hours_per_day=${state.settings.hoursPerDay}&days_per_week=${state.settings.daysPerWeek}`;
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            // Transform API data to canvas format
            state.tasks = (data.tasks || []).map((task, idx) => transformTaskForCanvas(task, idx));
            state.taskTypes = data.task_types || [];
            state.workload = data.workload || null;

            // Render filter types list
            renderFilterTypesList();

            // Restore filter UI state
            const filterShowAutomated = document.getElementById('filterShowAutomated');
            if (filterShowAutomated) filterShowAutomated.checked = state.filters.showAutomated;

            console.log('[MY-WORK] Loaded', state.tasks.length, 'tasks');
            console.log('[MY-WORK] Task types:', state.taskTypes.length);
            console.log('[MY-WORK] Workload:', state.workload);

        } catch (err) {
            console.error('[MY-WORK] Error loading tasks:', err);
            // Fallback to mock data for development
            state.tasks = generateMockTasks();
            state.taskTypes = [
                { id: 'type-1', name: 'Development' },
                { id: 'type-2', name: 'Review' },
                { id: 'type-3', name: 'Automated' },
            ];
            state.workload = {
                total_hours: 24,
                capacity_hours_week: 48,
                utilization_percent: 50,
                status: 'normal',
                overdue_count: 1,
                due_soon_count: 2,
                automated_count: 1,
            };
            renderFilterTypesList();
        }
    }

    function transformTaskForCanvas(task, index) {
        const userName = state.currentUser?.user_name || 'User';
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Calculate grid position (auto-layout if no saved position)
        const cols = 3;
        const baseX = 150;
        const baseY = 100;
        const spacingX = 300;
        const spacingY = 200;

        const col = index % cols;
        const row = Math.floor(index / cols);

        return {
            id: task.task_id,
            title: task.task_description || 'Untitled Task',
            project: task.project_name || 'No Project',
            projectId: task.project_id,
            status: task.status_name?.toLowerCase().includes('working') ? 'working' : 'not_started',
            statusId: task.status_id,
            priority: mapPriorityName(task.priority_name),
            priorityId: task.priority_id,
            typeId: task.type_id,
            typeName: task.type_name || 'Unknown',
            isAutomated: task.is_automated || false,
            assignee: { name: userName, initials },
            dueDate: task.deadline || task.due_date,
            duration: task.estimated_hours || 2,
            isOverdue: task.is_overdue,
            isDueSoon: task.is_due_soon,
            position: {
                x: task.canvas_x || (baseX + col * spacingX),
                y: task.canvas_y || (baseY + row * spacingY),
            },
            dependencies: [],
            createdAt: task.created_at,
        };
    }

    function mapPriorityName(name) {
        if (!name) return 'medium';
        const lower = name.toLowerCase();
        if (lower.includes('high') || lower.includes('urgent')) return 'high';
        if (lower.includes('low')) return 'low';
        return 'medium';
    }

    function generateSmartConnections() {
        // Group filtered tasks by project (only visible tasks get connections)
        const byProject = {};
        state.filteredTasks.forEach(task => {
            const key = task.projectId || 'none';
            if (!byProject[key]) byProject[key] = [];
            byProject[key].push(task);
        });

        const connections = [];

        // Within each project, connect tasks by due date (earlier -> later)
        Object.values(byProject).forEach(projectTasks => {
            if (projectTasks.length < 2) return;

            // Sort by due date
            const sorted = [...projectTasks].sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate) : new Date('2099-12-31');
                const dateB = b.dueDate ? new Date(b.dueDate) : new Date('2099-12-31');
                return dateA - dateB;
            });

            // Connect sequential tasks
            for (let i = 0; i < sorted.length - 1; i++) {
                connections.push({
                    from: sorted[i].id,
                    to: sorted[i + 1].id,
                });
            }
        });

        return connections;
    }

    function generateMockTasks() {
        const userName = state.currentUser?.user_name || state.currentUser?.username || 'User';
        const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return [
            {
                id: 'task-1',
                title: 'Review electrical rough-in inspection',
                project: 'Del Rio Residence',
                projectId: 'proj-1',
                status: 'working',
                priority: 'high',
                typeId: 'type-1',
                typeName: 'Development',
                isAutomated: false,
                assignee: { name: userName, initials },
                dueDate: '2026-02-01',
                duration: 4,
                isOverdue: false,
                isDueSoon: true,
                position: { x: 200, y: 150 },
                dependencies: [],
            },
            {
                id: 'task-2',
                title: 'Coordinate HVAC installation schedule',
                project: 'Del Rio Residence',
                projectId: 'proj-1',
                status: 'working',
                priority: 'medium',
                typeId: 'type-2',
                typeName: 'Review',
                isAutomated: false,
                assignee: { name: userName, initials },
                dueDate: '2026-02-03',
                duration: 6,
                isOverdue: false,
                isDueSoon: false,
                position: { x: 500, y: 100 },
                dependencies: ['task-1'],
            },
            {
                id: 'task-3',
                title: 'Submit permit application for Phase 2',
                project: 'Arthur Neal Court',
                projectId: 'proj-2',
                status: 'not_started',
                priority: 'high',
                typeId: 'type-1',
                typeName: 'Development',
                isAutomated: false,
                assignee: { name: userName, initials },
                dueDate: '2026-01-30',
                duration: 3,
                isOverdue: true,
                isDueSoon: false,
                position: { x: 200, y: 350 },
                dependencies: [],
            },
            {
                id: 'task-4',
                title: 'Daily budget check [AUTOMATED]',
                project: 'Arthur Neal Court',
                projectId: 'proj-2',
                status: 'not_started',
                priority: 'medium',
                typeId: 'type-3',
                typeName: 'Automated',
                isAutomated: true,
                assignee: { name: userName, initials },
                dueDate: '2026-02-05',
                duration: 2,
                isOverdue: false,
                isDueSoon: false,
                position: { x: 500, y: 300 },
                dependencies: ['task-3'],
            },
            {
                id: 'task-5',
                title: 'Order windows and doors',
                project: 'Arthur Neal Court',
                projectId: 'proj-2',
                status: 'not_started',
                priority: 'low',
                typeId: 'type-1',
                typeName: 'Development',
                isAutomated: false,
                assignee: { name: userName, initials },
                dueDate: '2026-02-10',
                duration: 1,
                isOverdue: false,
                isDueSoon: false,
                position: { x: 800, y: 250 },
                dependencies: ['task-4'],
            },
        ];
    }

    function generateMockConnections() {
        return [
            { from: 'task-1', to: 'task-2' },
            { from: 'task-3', to: 'task-4' },
            { from: 'task-4', to: 'task-5' },
        ];
    }

    // ================================
    // Workload Indicator
    // ================================
    function renderWorkloadIndicator() {
        // Find or create workload indicator in toolbar
        let indicator = document.getElementById('workloadIndicator');

        if (!indicator) {
            const toolbarRight = document.querySelector('.toolbar-right');
            if (!toolbarRight) return;

            indicator = document.createElement('div');
            indicator.id = 'workloadIndicator';
            indicator.className = 'workload-indicator';
            toolbarRight.insertBefore(indicator, toolbarRight.firstChild);
        }

        if (!state.workload) {
            indicator.style.display = 'none';
            return;
        }

        indicator.style.display = 'flex';

        const { total_hours, capacity_hours_week, utilization_percent, status, overdue_count, due_soon_count } = state.workload;

        // Status colors
        const statusColors = {
            critical: '#ef4444',
            overloaded: '#f97316',
            optimal: '#22c55e',
            normal: '#8b5cf6',
            underloaded: '#6b7280',
        };

        const statusLabels = {
            critical: 'Critically Overloaded',
            overloaded: 'Overloaded',
            optimal: 'Optimal Load',
            normal: 'Normal',
            underloaded: 'Underloaded',
        };

        const color = statusColors[status] || '#6b7280';
        const label = statusLabels[status] || status;

        // Calculate hidden vs visible
        const totalTasks = state.tasks.length;
        const visibleTasks = state.filteredTasks.length;
        const hiddenTasks = totalTasks - visibleTasks;

        indicator.innerHTML = `
            <div class="workload-bar-container" title="${label}: ${utilization_percent}% capacity used">
                <div class="workload-bar" style="width: ${Math.min(utilization_percent, 100)}%; background: ${color};"></div>
                ${utilization_percent > 100 ? `<div class="workload-overflow" style="width: ${Math.min(utilization_percent - 100, 50)}%; background: ${statusColors.critical};"></div>` : ''}
            </div>
            <div class="workload-info">
                <span class="workload-hours">${total_hours}h / ${capacity_hours_week}h</span>
                <span class="workload-status" style="color: ${color};">${label}</span>
            </div>
            ${hiddenTasks > 0 ? `<span class="workload-alert hidden-tasks" title="${hiddenTasks} tasks hidden by filters">${visibleTasks}/${totalTasks} visible</span>` : ''}
            ${overdue_count > 0 ? `<span class="workload-alert overdue" title="${overdue_count} overdue tasks">${overdue_count} overdue</span>` : ''}
            ${due_soon_count > 0 ? `<span class="workload-alert soon" title="${due_soon_count} tasks due soon">${due_soon_count} due soon</span>` : ''}
        `;
    }

    // ================================
    // Rendering
    // ================================
    function renderNodes() {
        if (!elements.nodesContainer) return;

        elements.nodesContainer.innerHTML = '';

        // Use filtered tasks for display
        if (state.filteredTasks.length === 0) {
            // Check if we have tasks but they're all filtered out
            if (state.tasks.length > 0) {
                elements.canvasEmpty.style.display = 'block';
                const emptyTitle = elements.canvasEmpty.querySelector('.empty-title');
                const emptySubtitle = elements.canvasEmpty.querySelector('.empty-subtitle');
                if (emptyTitle) emptyTitle.textContent = 'All tasks are hidden';
                if (emptySubtitle) emptySubtitle.textContent = 'Adjust your filters to show tasks';
            } else {
                elements.canvasEmpty.style.display = 'block';
            }
            return;
        }

        elements.canvasEmpty.style.display = 'none';

        // Regenerate connections based on visible tasks
        state.connections = generateSmartConnections();

        state.filteredTasks.forEach(task => {
            const node = createNodeElement(task);
            elements.nodesContainer.appendChild(node);
        });
    }

    function createNodeElement(task) {
        const node = document.createElement('div');
        node.className = `task-node status-${task.status.replace('_', '-')}`;
        node.dataset.taskId = task.id;
        node.style.left = `${task.position.x}px`;
        node.style.top = `${task.position.y}px`;

        // Add overdue/due-soon classes
        if (task.isOverdue) node.classList.add('task-overdue');
        if (task.isDueSoon) node.classList.add('task-due-soon');

        const dueInfo = getDueInfo(task.dueDate, task.isOverdue, task.isDueSoon);

        // Add automated class if applicable
        if (task.isAutomated) node.classList.add('task-automated');

        node.innerHTML = `
            <div class="node-header">
                <div class="node-project">
                    ${escapeHtml(task.project)}
                    ${task.isAutomated ? '<span class="node-automated-badge" title="Automated Task">AUTO</span>' : ''}
                </div>
                <div class="node-title">${escapeHtml(task.title)}</div>
            </div>
            <div class="node-body">
                <div class="node-meta">
                    <span class="node-tag priority-${task.priority}">
                        ${task.priority === 'high' ? '!' : task.priority === 'medium' ? '~' : ''}
                        ${task.priority}
                    </span>
                    <span class="node-tag node-duration" data-task-id="${task.id}" title="Estimated duration (click to edit)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${task.duration}h
                    </span>
                    <span class="node-tag">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${formatDate(task.dueDate)}
                    </span>
                </div>
            </div>
            <div class="node-footer">
                <div class="node-assignee">
                    <div class="assignee-avatar">${task.assignee.initials}</div>
                    <span class="assignee-name">${escapeHtml(task.assignee.name)}</span>
                </div>
                <span class="node-due ${dueInfo.class}">${dueInfo.text}</span>
            </div>
            <div class="node-port port-top" data-port="top"></div>
            <div class="node-port port-bottom" data-port="bottom"></div>
            <div class="node-port port-left" data-port="left"></div>
            <div class="node-port port-right" data-port="right"></div>
        `;

        // Node events
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNode(task.id);
        });

        node.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-port')) return;
            startNodeDrag(e, task);
        });

        node.addEventListener('dblclick', () => {
            openPanel(task);
        });

        // Duration edit on click
        const durationTag = node.querySelector('.node-duration');
        durationTag?.addEventListener('click', (e) => {
            e.stopPropagation();
            editDuration(task);
        });

        return node;
    }

    function renderConnections() {
        if (!elements.connectionsLayer) return;

        // Clear existing paths (keep defs)
        const paths = elements.connectionsLayer.querySelectorAll('.connection-path');
        paths.forEach(p => p.remove());

        state.connections.forEach(conn => {
            // Only connect visible tasks
            const fromTask = state.filteredTasks.find(t => t.id === conn.from);
            const toTask = state.filteredTasks.find(t => t.id === conn.to);

            if (!fromTask || !toTask) return;

            const path = createConnectionPath(fromTask, toTask);
            elements.connectionsLayer.appendChild(path);
        });
    }

    function createConnectionPath(fromTask, toTask) {
        const fromX = fromTask.position.x + 120; // Center of node
        const fromY = fromTask.position.y + 100; // Bottom of node (approx)
        const toX = toTask.position.x + 120;
        const toY = toTask.position.y;

        // Create bezier curve
        const midY = (fromY + toY) / 2;
        const d = `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path');
        path.setAttribute('d', d);
        path.setAttribute('marker-end', 'url(#arrowhead)');

        // Add animation if "from" task is working
        if (fromTask.status === 'working') {
            path.classList.add('animated');
        }

        // Critical path indicator (overdue tasks)
        if (fromTask.isOverdue || toTask.isOverdue) {
            path.classList.add('critical');
        }

        return path;
    }

    function updateStats() {
        // Stats only count visible (filtered) tasks
        const working = state.filteredTasks.filter(t => t.status === 'working').length;
        const pending = state.filteredTasks.filter(t => t.status === 'not_started').length;

        if (elements.countWorking) elements.countWorking.textContent = working;
        if (elements.countPending) elements.countPending.textContent = pending;
    }

    // ================================
    // Canvas Interactions
    // ================================
    function onCanvasMouseDown(e) {
        if (e.target !== elements.canvasContainer && e.target !== elements.canvasGrid) return;
        if (state.draggedNode) return;

        state.canvas.isDragging = true;
        state.canvas.dragStart = {
            x: e.clientX - state.canvas.offsetX,
            y: e.clientY - state.canvas.offsetY
        };
        elements.canvasContainer.style.cursor = 'grabbing';
    }

    function onCanvasMouseMove(e) {
        // Canvas panning
        if (state.canvas.isDragging) {
            state.canvas.offsetX = e.clientX - state.canvas.dragStart.x;
            state.canvas.offsetY = e.clientY - state.canvas.dragStart.y;
            updateCanvasTransform();
        }

        // Node dragging
        if (state.draggedNode) {
            const rect = elements.canvasContainer.getBoundingClientRect();
            const x = (e.clientX - rect.left - state.canvas.offsetX) / state.canvas.scale - state.dragOffset.x;
            const y = (e.clientY - rect.top - state.canvas.offsetY) / state.canvas.scale - state.dragOffset.y;

            // Snap to grid (24px)
            const snappedX = Math.round(x / 24) * 24;
            const snappedY = Math.round(y / 24) * 24;

            state.draggedNode.position.x = snappedX;
            state.draggedNode.position.y = snappedY;

            const nodeEl = document.querySelector(`[data-task-id="${state.draggedNode.id}"]`);
            if (nodeEl) {
                nodeEl.style.left = `${snappedX}px`;
                nodeEl.style.top = `${snappedY}px`;
            }

            renderConnections();
        }
    }

    function onCanvasMouseUp() {
        state.canvas.isDragging = false;
        elements.canvasContainer.style.cursor = 'grab';

        if (state.draggedNode) {
            const nodeEl = document.querySelector(`[data-task-id="${state.draggedNode.id}"]`);
            if (nodeEl) nodeEl.classList.remove('dragging');
            state.draggedNode = null;
        }
    }

    function onCanvasWheel(e) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = elements.canvasContainer.getBoundingClientRect();

        // Zoom toward mouse position
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newScale = Math.max(state.canvas.minScale, Math.min(state.canvas.maxScale, state.canvas.scale * delta));

        if (newScale !== state.canvas.scale) {
            const scaleChange = newScale / state.canvas.scale;

            state.canvas.offsetX = mouseX - (mouseX - state.canvas.offsetX) * scaleChange;
            state.canvas.offsetY = mouseY - (mouseY - state.canvas.offsetY) * scaleChange;
            state.canvas.scale = newScale;

            updateCanvasTransform();
        }
    }

    function onCanvasClick(e) {
        if (e.target === elements.canvasContainer || e.target === elements.canvasGrid) {
            deselectNode();
        }
    }

    function updateCanvasTransform() {
        if (!elements.canvasGrid) return;

        elements.canvasGrid.style.transform = `translate(${state.canvas.offsetX}px, ${state.canvas.offsetY}px) scale(${state.canvas.scale})`;
        updateMinimap();
    }

    function zoom(factor) {
        const newScale = Math.max(state.canvas.minScale, Math.min(state.canvas.maxScale, state.canvas.scale * factor));

        if (newScale !== state.canvas.scale) {
            const rect = elements.canvasContainer.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const scaleChange = newScale / state.canvas.scale;
            state.canvas.offsetX = centerX - (centerX - state.canvas.offsetX) * scaleChange;
            state.canvas.offsetY = centerY - (centerY - state.canvas.offsetY) * scaleChange;
            state.canvas.scale = newScale;

            updateCanvasTransform();
        }
    }

    function centerCanvas() {
        if (state.filteredTasks.length === 0) return;

        const rect = elements.canvasContainer.getBoundingClientRect();

        // Find bounds of all visible nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.filteredTasks.forEach(task => {
            minX = Math.min(minX, task.position.x);
            minY = Math.min(minY, task.position.y);
            maxX = Math.max(maxX, task.position.x + 240);
            maxY = Math.max(maxY, task.position.y + 120);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const centerX = minX + contentWidth / 2;
        const centerY = minY + contentHeight / 2;

        state.canvas.offsetX = rect.width / 2 - centerX * state.canvas.scale;
        state.canvas.offsetY = rect.height / 2 - centerY * state.canvas.scale;

        updateCanvasTransform();
    }

    function fitToView() {
        if (state.filteredTasks.length === 0) return;

        const rect = elements.canvasContainer.getBoundingClientRect();
        const padding = 100;

        // Find bounds of visible tasks
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.filteredTasks.forEach(task => {
            minX = Math.min(minX, task.position.x);
            minY = Math.min(minY, task.position.y);
            maxX = Math.max(maxX, task.position.x + 240);
            maxY = Math.max(maxY, task.position.y + 120);
        });

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        const scaleX = rect.width / contentWidth;
        const scaleY = rect.height / contentHeight;
        state.canvas.scale = Math.min(scaleX, scaleY, 1);

        const centerX = minX + (maxX - minX) / 2;
        const centerY = minY + (maxY - minY) / 2;

        state.canvas.offsetX = rect.width / 2 - centerX * state.canvas.scale;
        state.canvas.offsetY = rect.height / 2 - centerY * state.canvas.scale;

        updateCanvasTransform();
    }

    // ================================
    // Node Interactions
    // ================================
    function startNodeDrag(e, task) {
        e.preventDefault();

        state.draggedNode = task;

        const rect = elements.canvasContainer.getBoundingClientRect();
        state.dragOffset = {
            x: (e.clientX - rect.left - state.canvas.offsetX) / state.canvas.scale - task.position.x,
            y: (e.clientY - rect.top - state.canvas.offsetY) / state.canvas.scale - task.position.y
        };

        const nodeEl = document.querySelector(`[data-task-id="${task.id}"]`);
        if (nodeEl) nodeEl.classList.add('dragging');
    }

    function selectNode(taskId) {
        deselectNode();

        state.selectedNode = taskId;
        const nodeEl = document.querySelector(`[data-task-id="${taskId}"]`);
        if (nodeEl) nodeEl.classList.add('selected');

        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            openPanel(task);
        }
    }

    function deselectNode() {
        if (state.selectedNode) {
            const nodeEl = document.querySelector(`[data-task-id="${state.selectedNode}"]`);
            if (nodeEl) nodeEl.classList.remove('selected');
            state.selectedNode = null;
        }
        closePanel();
    }

    // ================================
    // Duration Editing
    // ================================
    function editDuration(task) {
        const newDuration = prompt(`Estimated duration for "${task.title}" (hours):`, task.duration);

        if (newDuration === null) return; // Cancelled

        const parsed = parseFloat(newDuration);
        if (isNaN(parsed) || parsed <= 0) {
            if (window.showToast) {
                window.showToast('Please enter a valid number of hours', 'error');
            }
            return;
        }

        // Update local state
        task.duration = parsed;

        // Update UI
        const durationTag = document.querySelector(`.node-duration[data-task-id="${task.id}"]`);
        if (durationTag) {
            durationTag.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${parsed}h
            `;
        }

        // Save to API
        saveDuration(task.id, parsed);

        // Recalculate workload (locally for now)
        recalculateWorkload();

        if (window.showToast) {
            window.showToast(`Duration updated to ${parsed} hours`, 'success');
        }
    }

    async function saveDuration(taskId, duration) {
        try {
            const res = await fetch(`${API_BASE}/pipeline/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estimated_hours: duration }),
            });

            if (!res.ok) {
                console.error('[MY-WORK] Failed to save duration:', res.status);
            }
        } catch (err) {
            console.error('[MY-WORK] Error saving duration:', err);
        }
    }

    function recalculateWorkload() {
        if (!state.workload) return;

        const totalHours = state.tasks.reduce((sum, t) => sum + (t.duration || 2), 0);
        const capacity = state.settings.hoursPerDay * state.settings.daysPerWeek;
        const utilization = (totalHours / capacity) * 100;

        let status;
        if (utilization > 120) status = 'critical';
        else if (utilization > 100) status = 'overloaded';
        else if (utilization > 80) status = 'optimal';
        else if (utilization > 50) status = 'normal';
        else status = 'underloaded';

        state.workload.total_hours = totalHours;
        state.workload.utilization_percent = Math.round(utilization * 10) / 10;
        state.workload.status = status;

        renderWorkloadIndicator();
    }

    // ================================
    // Panel
    // ================================
    function openPanel(task) {
        if (!elements.taskPanel) return;

        state.isPanelOpen = true;
        state.selectedNode = task.id;

        elements.panelTitle.textContent = task.title;
        elements.panelContent.innerHTML = `
            <div class="panel-section">
                <h4 class="panel-section-title">Project</h4>
                <div class="panel-value">${escapeHtml(task.project)}</div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Status</h4>
                <div class="panel-value" style="display: flex; align-items: center; gap: 8px;">
                    <span class="stat-dot ${task.status === 'working' ? 'working' : 'pending'}"></span>
                    ${task.status === 'working' ? 'Working on it' : 'Not Started'}
                </div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Priority</h4>
                <div class="panel-value">
                    <span class="node-tag priority-${task.priority}" style="font-size: 13px;">
                        ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                    </span>
                </div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Task Type</h4>
                <div class="panel-value" style="display: flex; align-items: center; gap: 8px;">
                    ${escapeHtml(task.typeName || 'Unknown')}
                    ${task.isAutomated ? '<span class="node-automated-badge">AUTO</span>' : ''}
                </div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Estimated Duration</h4>
                <div class="panel-value panel-duration-edit" data-task-id="${task.id}" style="cursor: pointer;">
                    ${task.duration} hours
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-left: 8px; opacity: 0.5;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Due Date</h4>
                <div class="panel-value ${task.isOverdue ? 'text-red' : task.isDueSoon ? 'text-yellow' : ''}">
                    ${formatDateFull(task.dueDate)}
                    ${task.isOverdue ? '<span style="color: #ef4444; margin-left: 8px;">(Overdue)</span>' : ''}
                    ${task.isDueSoon && !task.isOverdue ? '<span style="color: #f59e0b; margin-left: 8px;">(Due Soon)</span>' : ''}
                </div>
            </div>
            <div class="panel-section">
                <h4 class="panel-section-title">Assignee</h4>
                <div class="panel-value" style="display: flex; align-items: center; gap: 8px;">
                    <div class="assignee-avatar">${task.assignee.initials}</div>
                    ${escapeHtml(task.assignee.name)}
                </div>
            </div>
        `;

        // Duration edit click handler
        const durationEdit = elements.panelContent.querySelector('.panel-duration-edit');
        durationEdit?.addEventListener('click', () => editDuration(task));

        // Update button text
        const btnUpdate = document.getElementById('btnUpdateStatus');
        if (btnUpdate) {
            btnUpdate.textContent = task.status === 'working' ? 'Mark as Not Started' : 'Mark as Working';
        }

        elements.taskPanel.classList.add('open');
    }

    function closePanel() {
        if (!elements.taskPanel) return;

        state.isPanelOpen = false;
        elements.taskPanel.classList.remove('open');
    }

    // ================================
    // Actions
    // ================================
    async function toggleTaskStatus() {
        if (!state.selectedNode) return;

        const task = state.tasks.find(t => t.id === state.selectedNode);
        if (!task) return;

        const newStatus = task.status === 'working' ? 'not_started' : 'working';

        // Update via API
        try {
            const res = await fetch(`${API_BASE}/pipeline/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus === 'working' ? 'Working on It' : 'Not Started' }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            // Update local state
            task.status = newStatus;

            // Update node class
            const nodeEl = document.querySelector(`[data-task-id="${task.id}"]`);
            if (nodeEl) {
                nodeEl.classList.remove('status-working', 'status-not-started');
                nodeEl.classList.add(`status-${newStatus.replace('_', '-')}`);
            }

            // Update panel
            openPanel(task);
            renderConnections();
            updateStats();

            if (window.showToast) {
                window.showToast(`Task marked as ${newStatus === 'working' ? 'Working' : 'Not Started'}`, 'success');
            }
        } catch (err) {
            console.error('[MY-WORK] Error updating status:', err);
            if (window.showToast) {
                window.showToast('Failed to update task status', 'error');
            }
        }
    }

    function openInPipeline() {
        if (!state.selectedNode) return;
        window.location.href = `pipeline.html?task=${state.selectedNode}`;
    }

    // ================================
    // View Mode
    // ================================
    function setViewMode(mode) {
        state.viewMode = mode;

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === mode);
        });

        // TODO: Implement list view
        if (mode === 'list') {
            console.log('[MY-WORK] List view not yet implemented');
        }
    }

    // ================================
    // Minimap
    // ================================
    function updateMinimap() {
        if (!elements.minimapViewport || !elements.canvasContainer) return;

        const containerRect = elements.canvasContainer.getBoundingClientRect();
        const minimapWidth = 180;
        const minimapHeight = 120;
        const canvasSize = 5000;

        // Calculate viewport position and size
        const viewWidth = containerRect.width / state.canvas.scale;
        const viewHeight = containerRect.height / state.canvas.scale;
        const viewX = -state.canvas.offsetX / state.canvas.scale;
        const viewY = -state.canvas.offsetY / state.canvas.scale;

        // Scale to minimap
        const scaleX = minimapWidth / canvasSize;
        const scaleY = minimapHeight / canvasSize;

        elements.minimapViewport.style.left = `${viewX * scaleX}px`;
        elements.minimapViewport.style.top = `${viewY * scaleY}px`;
        elements.minimapViewport.style.width = `${viewWidth * scaleX}px`;
        elements.minimapViewport.style.height = `${viewHeight * scaleY}px`;
    }

    // ================================
    // Keyboard Shortcuts
    // ================================
    function onKeyDown(e) {
        // Escape to deselect/close panel
        if (e.key === 'Escape') {
            deselectNode();
        }

        // Delete selected node (for future use)
        // if (e.key === 'Delete' && state.selectedNode) { ... }
    }

    // ================================
    // Utilities
    // ================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatDateFull(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    function getDueInfo(dateStr, isOverdue, isDueSoon) {
        if (!dateStr) return { text: '', class: '' };

        if (isOverdue) {
            const now = new Date();
            const due = new Date(dateStr);
            const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
            return { text: `${diffDays}d overdue`, class: 'overdue' };
        }

        if (isDueSoon) {
            const now = new Date();
            const due = new Date(dateStr);
            const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return { text: 'Due today', class: 'soon' };
            return { text: `${diffDays}d left`, class: 'soon' };
        }

        const now = new Date();
        const due = new Date(dateStr);
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        return { text: `${diffDays}d left`, class: '' };
    }

    // ================================
    // Initialize on DOM Ready
    // ================================
    document.addEventListener('DOMContentLoaded', init);

    // Expose for debugging
    window.MyWork = { state, renderNodes, renderConnections, recalculateWorkload };

})();
