/**
 * OPERATION MANAGER - Visual Pipeline Canvas with Workload Algorithm
 * ===================================================================
 * Interactive canvas for viewing and managing all tasks across the organization
 * Includes workload/burnout calculation and visual indicators
 */

(function() {
    'use strict';

    const API_BASE = window.API_BASE || "https://ngm-fastapi.onrender.com";
    const PAGE_LOAD_START = Date.now();
    const MIN_LOADING_TIME = 800;

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

        // Automation clusters
        automationClusters: [],  // Grouped automated tasks by type
        expandedClusters: {},    // Track which clusters are expanded

        // Filter settings
        filters: {
            showAutomated: true,
            showClusters: true,   // Show automation clusters
            selectedTypes: [],    // Empty = show all
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
        connectionUpdatePending: false,

        // Connection drawing (drag from port to port)
        isDrawingConnection: false,
        connectionStart: null, // { taskId, port: 'left'|'right', x, y }
        connectionEnd: { x: 0, y: 0 },
        tempConnectionPath: null,

        // Dependencies loaded from API
        dependencies: [],

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
        await loadAutomationClusters();
        await loadDependencies();
        applyFilters();
        renderWorkloadIndicator();
        renderNodes();
        renderAutomationClusters();
        renderConnections();
        updateStats();
        centerCanvas();

        // Hide loading overlay with minimum display time
        const elapsed = Date.now() - PAGE_LOAD_START;
        const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);
        setTimeout(() => {
            document.body.classList.remove('page-loading');
            document.body.classList.add('auth-ready');
            const overlay = document.getElementById('pageLoadingOverlay');
            if (overlay) overlay.classList.add('hidden');
        }, remaining);
    }

    function loadCurrentUser() {
        const userStr = localStorage.getItem('ngm_user');
        if (userStr) {
            try {
                state.currentUser = JSON.parse(userStr);
            } catch (e) {
                console.error('[OPERATION-MANAGER] Error parsing user:', e);
            }
        }
    }

    function loadSettings() {
        const settingsStr = localStorage.getItem('ngm_opmanager_settings');
        if (settingsStr) {
            try {
                const saved = JSON.parse(settingsStr);
                state.settings = { ...state.settings, ...saved };
            } catch (e) {
                console.error('[OPERATION-MANAGER] Error loading settings:', e);
            }
        }
    }

    function saveSettings() {
        localStorage.setItem('ngm_opmanager_settings', JSON.stringify(state.settings));
    }

    function loadFilters() {
        const filtersStr = localStorage.getItem('ngm_opmanager_filters');
        if (filtersStr) {
            try {
                const saved = JSON.parse(filtersStr);
                state.filters = { ...state.filters, ...saved };
            } catch (e) {
                console.error('[OPERATION-MANAGER] Error loading filters:', e);
            }
        }
    }

    function saveFilters() {
        localStorage.setItem('ngm_opmanager_filters', JSON.stringify(state.filters));
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
                console.warn('[OPERATION-MANAGER] No user ID found');
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

            console.log('[OPERATION-MANAGER] Loaded', state.tasks.length, 'tasks');
            console.log('[OPERATION-MANAGER] Task types:', state.taskTypes.length);
            console.log('[OPERATION-MANAGER] Workload:', state.workload);

        } catch (err) {
            console.error('[OPERATION-MANAGER] Error loading tasks:', err);
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
        const userName = task.assigned_to_name || state.currentUser?.user_name || 'User';
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
            // Scheduling fields
            scheduledStartDate: task.scheduled_start_date,
            scheduledEndDate: task.scheduled_end_date,
            queuePosition: task.queue_position,
            autoLinked: task.auto_linked || false,
            blockedByTaskId: task.blocked_by_task_id,
            schedulingStatus: task.scheduling_status || 'unscheduled',
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

        // Within each project, connect tasks by position (left to right flow)
        Object.values(byProject).forEach(projectTasks => {
            if (projectTasks.length < 2) return;

            // Sort by X position (left to right), then by Y position
            const sorted = [...projectTasks].sort((a, b) => {
                const xDiff = a.position.x - b.position.x;
                if (Math.abs(xDiff) > 50) return xDiff;
                return a.position.y - b.position.y;
            });

            // Connect sequential tasks in the sorted order
            for (let i = 0; i < sorted.length - 1; i++) {
                connections.push({
                    id: `conn-${sorted[i].id}-${sorted[i + 1].id}`,
                    from: sorted[i].id,
                    to: sorted[i + 1].id,
                    projectId: sorted[i].projectId,
                });
            }
        });

        return connections;
    }

    // Update connections when nodes are moved
    function updateConnectionsForNode(taskId) {
        // Re-render connections with a slight delay for smooth animation
        requestAnimationFrame(() => {
            renderConnections();
        });
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

        // Priority icon
        const priorityIcon = task.priority === 'high'
            ? '<svg class="priority-icon priority-high" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 4l7.5 14h-15L12 6z"/><path d="M11 10h2v5h-2zm0 6h2v2h-2z"/></svg>'
            : task.priority === 'medium'
            ? '<svg class="priority-icon priority-medium" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>'
            : '<svg class="priority-icon priority-low" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-7v4h4l-5 7z"/></svg>';

        // Status icon
        const statusIcon = task.status === 'working'
            ? '<div class="status-indicator working" title="Working on it"><div class="status-pulse"></div></div>'
            : '<div class="status-indicator pending" title="Not Started"></div>';

        node.innerHTML = `
            <!-- Compact View (default) -->
            <div class="node-compact">
                <div class="node-compact-header">
                    ${statusIcon}
                    <span class="node-compact-project">${escapeHtml(task.project)}</span>
                    ${task.queuePosition ? `<span class="queue-badge" title="Queue position #${task.queuePosition}">#${task.queuePosition}</span>` : ''}
                    ${task.isAutomated ? '<span class="auto-badge" title="Automated">A</span>' : ''}
                    ${task.autoLinked ? '<span class="linked-badge" title="Auto-linked to previous task"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>' : ''}
                    ${priorityIcon}
                </div>
                <div class="node-compact-title">${escapeHtml(task.title)}</div>
                ${task.scheduledStartDate ? `<div class="node-schedule-info">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>${formatShortDate(task.scheduledStartDate)} - ${formatShortDate(task.scheduledEndDate)}</span>
                </div>` : ''}
                <div class="node-compact-footer">
                    <div class="node-compact-assignee" title="${escapeHtml(task.assignee.name)}">
                        <div class="compact-avatar">${task.assignee.initials}</div>
                    </div>
                    <div class="node-compact-meta">
                        ${dueInfo.text ? `<span class="compact-due ${dueInfo.class}">${dueInfo.text}</span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Expanded View (on click) -->
            <div class="node-expanded">
                <div class="node-expanded-header">
                    ${statusIcon}
                    <span class="node-expanded-project">${escapeHtml(task.project)}</span>
                    ${task.isAutomated ? '<span class="auto-badge-lg" title="Automated Task">AUTO</span>' : ''}
                    <button type="button" class="node-collapse-btn" title="Collapse">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                    </button>
                </div>
                <div class="node-expanded-title">${escapeHtml(task.title)}</div>

                <div class="node-expanded-details">
                    <div class="detail-row">
                        <span class="detail-label">Priority</span>
                        <span class="detail-value priority-badge priority-${task.priority}">
                            ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Due Date</span>
                        <span class="detail-value ${task.isOverdue ? 'text-danger' : task.isDueSoon ? 'text-warning' : ''}">
                            ${formatDate(task.dueDate)}
                            ${dueInfo.text ? `<span class="due-badge ${dueInfo.class}">${dueInfo.text}</span>` : ''}
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Duration</span>
                        <span class="detail-value duration-editable" data-task-id="${task.id}">
                            ${task.duration}h
                            <svg class="edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type</span>
                        <span class="detail-value">${escapeHtml(task.typeName || 'General')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Assignee</span>
                        <span class="detail-value assignee-detail">
                            <div class="expanded-avatar">${task.assignee.initials}</div>
                            ${escapeHtml(task.assignee.name)}
                        </span>
                    </div>
                    ${task.queuePosition ? `
                    <div class="detail-row">
                        <span class="detail-label">Queue</span>
                        <span class="detail-value queue-position">
                            #${task.queuePosition} in queue
                            ${task.autoLinked ? '<span class="linked-indicator" title="Auto-linked to previous task">linked</span>' : ''}
                        </span>
                    </div>` : ''}
                    ${task.scheduledStartDate ? `
                    <div class="detail-row">
                        <span class="detail-label">Scheduled</span>
                        <span class="detail-value scheduled-dates">
                            ${formatDate(task.scheduledStartDate)} - ${formatDate(task.scheduledEndDate)}
                        </span>
                    </div>` : ''}
                </div>
                ${!task.scheduledStartDate ? `
                <button type="button" class="node-action-btn btn-schedule" data-task-id="${task.id}" title="Calculate schedule based on workload">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    Auto-Schedule
                </button>` : ''}

                <div class="node-expanded-actions">
                    <button type="button" class="node-action-btn btn-status" data-task-id="${task.id}">
                        ${task.status === 'working' ? 'Mark Not Started' : 'Start Working'}
                    </button>
                    <button type="button" class="node-action-btn btn-pipeline" data-task-id="${task.id}">
                        Open in Pipeline
                    </button>
                </div>
            </div>

            <div class="node-port port-left" data-port="left"></div>
            <div class="node-port port-right" data-port="right"></div>
        `;

        // Node click to expand/collapse
        node.addEventListener('click', (e) => {
            e.stopPropagation();

            // Don't expand if clicking on action buttons or ports
            if (e.target.closest('.node-action-btn') ||
                e.target.closest('.node-port') ||
                e.target.closest('.duration-editable') ||
                e.target.closest('.node-collapse-btn')) {
                return;
            }

            toggleNodeExpand(task.id);
        });

        // Collapse button
        const collapseBtn = node.querySelector('.node-collapse-btn');
        collapseBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            collapseNode(task.id);
        });

        // Node dragging
        node.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-port') ||
                e.target.closest('.node-action-btn') ||
                e.target.closest('.node-collapse-btn')) return;
            startNodeDrag(e, task);
        });

        // Duration edit
        const durationEditable = node.querySelector('.duration-editable');
        durationEditable?.addEventListener('click', (e) => {
            e.stopPropagation();
            editDuration(task);
        });

        // Action buttons
        const btnStatus = node.querySelector('.btn-status');
        btnStatus?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTaskStatusFromNode(task);
        });

        const btnPipeline = node.querySelector('.btn-pipeline');
        btnPipeline?.addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `pipeline.html?task=${task.id}`;
        });

        // Schedule button
        const btnSchedule = node.querySelector('.btn-schedule');
        btnSchedule?.addEventListener('click', (e) => {
            e.stopPropagation();
            scheduleTask(task);
        });

        // Port connection events
        const ports = node.querySelectorAll('.node-port');
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startConnectionDrag(e, task, port.dataset.port);
            });

            port.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (state.isDrawingConnection && state.connectionStart) {
                    endConnectionDrag(task, port.dataset.port);
                }
            });

            port.addEventListener('mouseenter', () => {
                if (state.isDrawingConnection) {
                    port.classList.add('port-hover');
                }
            });

            port.addEventListener('mouseleave', () => {
                port.classList.remove('port-hover');
            });
        });

        return node;
    }

    // ================================
    // Connection Drawing (Drag to Connect)
    // ================================
    function startConnectionDrag(e, task, portType) {
        e.preventDefault();

        const nodeWidth = task.id === state.selectedNode ? 280 : 200;
        const nodeHeight = 90;

        // Calculate port position
        const portX = portType === 'right'
            ? task.position.x + nodeWidth
            : task.position.x;
        const portY = task.position.y + nodeHeight / 2;

        state.isDrawingConnection = true;
        state.connectionStart = {
            taskId: task.id,
            port: portType,
            x: portX,
            y: portY
        };
        state.connectionEnd = { x: portX, y: portY };

        // Create temporary connection line
        createTempConnectionPath();

        // Add global mouse listeners
        document.addEventListener('mousemove', onConnectionDrag);
        document.addEventListener('mouseup', cancelConnectionDrag);

        // Add visual feedback
        document.body.classList.add('drawing-connection');
    }

    function onConnectionDrag(e) {
        if (!state.isDrawingConnection) return;

        const rect = elements.canvasContainer.getBoundingClientRect();
        const x = (e.clientX - rect.left - state.canvas.offsetX) / state.canvas.scale;
        const y = (e.clientY - rect.top - state.canvas.offsetY) / state.canvas.scale;

        state.connectionEnd = { x, y };
        updateTempConnectionPath();
    }

    function endConnectionDrag(targetTask, targetPort) {
        if (!state.isDrawingConnection || !state.connectionStart) return;

        const sourceTask = state.filteredTasks.find(t => t.id === state.connectionStart.taskId);
        if (!sourceTask) {
            cancelConnectionDrag();
            return;
        }

        // Validate connection
        const isValid = validateConnection(sourceTask, targetTask, state.connectionStart.port, targetPort);

        if (isValid) {
            // Determine predecessor and successor based on port types
            let predecessorId, successorId;

            if (state.connectionStart.port === 'right' && targetPort === 'left') {
                // Normal flow: source -> target
                predecessorId = sourceTask.id;
                successorId = targetTask.id;
            } else if (state.connectionStart.port === 'left' && targetPort === 'right') {
                // Reverse: target -> source
                predecessorId = targetTask.id;
                successorId = sourceTask.id;
            } else {
                // Invalid port combination
                if (window.showToast) {
                    window.showToast('Connect from right port to left port', 'warning');
                }
                cancelConnectionDrag();
                return;
            }

            // Create the dependency
            createDependency(predecessorId, successorId);
        }

        cancelConnectionDrag();
    }

    function cancelConnectionDrag() {
        state.isDrawingConnection = false;
        state.connectionStart = null;

        // Remove temp path
        if (state.tempConnectionPath) {
            state.tempConnectionPath.remove();
            state.tempConnectionPath = null;
        }

        // Remove global listeners
        document.removeEventListener('mousemove', onConnectionDrag);
        document.removeEventListener('mouseup', cancelConnectionDrag);

        // Remove visual feedback
        document.body.classList.remove('drawing-connection');

        // Remove port hover states
        document.querySelectorAll('.node-port.port-hover').forEach(p => {
            p.classList.remove('port-hover');
        });
    }

    function createTempConnectionPath() {
        if (state.tempConnectionPath) {
            state.tempConnectionPath.remove();
        }

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'temp-connection');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'temp-connection-path');

        group.appendChild(path);
        elements.connectionsLayer.appendChild(group);

        state.tempConnectionPath = group;
        updateTempConnectionPath();
    }

    function updateTempConnectionPath() {
        if (!state.tempConnectionPath || !state.connectionStart) return;

        const path = state.tempConnectionPath.querySelector('path');
        if (!path) return;

        const { x: x1, y: y1 } = state.connectionStart;
        const { x: x2, y: y2 } = state.connectionEnd;

        // Calculate bezier curve
        const dx = x2 - x1;
        const curveOffset = Math.max(50, Math.min(Math.abs(dx) * 0.4, 150));

        const cx1 = state.connectionStart.port === 'right' ? x1 + curveOffset : x1 - curveOffset;
        const cy1 = y1;
        const cx2 = x2 - (dx > 0 ? curveOffset : -curveOffset);
        const cy2 = y2;

        const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
        path.setAttribute('d', pathData);
    }

    function validateConnection(sourceTask, targetTask, sourcePort, targetPort) {
        // Can't connect to self
        if (sourceTask.id === targetTask.id) {
            if (window.showToast) {
                window.showToast('Cannot connect task to itself', 'error');
            }
            return false;
        }

        // Check if connection already exists
        const existingConnection = state.dependencies.find(d =>
            (d.predecessor_task_id === sourceTask.id && d.successor_task_id === targetTask.id) ||
            (d.predecessor_task_id === targetTask.id && d.successor_task_id === sourceTask.id)
        );

        if (existingConnection) {
            if (window.showToast) {
                window.showToast('Connection already exists', 'warning');
            }
            return false;
        }

        return true;
    }

    // ================================
    // Dependencies API
    // ================================
    async function loadDependencies() {
        try {
            // Get unique project IDs from tasks
            const projectIds = [...new Set(state.tasks.map(t => t.projectId).filter(Boolean))];

            if (projectIds.length === 0) {
                state.dependencies = [];
                return;
            }

            // Load dependencies for all projects
            const allDependencies = [];

            for (const projectId of projectIds) {
                try {
                    const res = await fetch(`${API_BASE}/pipeline/dependencies/${projectId}`, {
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            allDependencies.push(...data);
                        }
                    }
                } catch (err) {
                    console.warn('[OPERATION-MANAGER] Failed to load dependencies for project:', projectId);
                }
            }

            state.dependencies = allDependencies;

            // Convert dependencies to connections format
            state.connections = state.dependencies.map(d => ({
                id: d.dependency_id,
                from: d.predecessor_task_id,
                to: d.successor_task_id,
                type: d.dependency_type || 'finish_to_start',
                lagHours: d.lag_hours || 0,
                isAutoGenerated: d.is_auto_generated || false
            }));

            console.log('[OPERATION-MANAGER] Loaded', state.dependencies.length, 'dependencies');

        } catch (err) {
            console.error('[OPERATION-MANAGER] Error loading dependencies:', err);
            // Fall back to auto-generated connections
            state.connections = generateSmartConnections();
        }
    }

    // ================================
    // Automation Clusters
    // ================================
    async function loadAutomationClusters() {
        try {
            const res = await fetch(`${API_BASE}/pipeline/automations/tasks`, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                console.warn('[OPERATION-MANAGER] Failed to load automation clusters');
                return;
            }

            const data = await res.json();
            state.automationClusters = (data.clusters || []).map((cluster, idx) => ({
                ...cluster,
                // Position clusters on the right side of canvas
                position: {
                    x: 850,
                    y: 100 + idx * 220
                }
            }));

            console.log('[OPERATION-MANAGER] Loaded', state.automationClusters.length, 'automation clusters');

        } catch (err) {
            console.error('[OPERATION-MANAGER] Error loading automation clusters:', err);
            state.automationClusters = [];
        }
    }

    function renderAutomationClusters() {
        if (!elements.nodesContainer || !state.filters.showClusters) return;

        state.automationClusters.forEach(cluster => {
            const clusterNode = createClusterElement(cluster);
            elements.nodesContainer.appendChild(clusterNode);
        });
    }

    function createClusterElement(cluster) {
        const node = document.createElement('div');
        node.className = 'cluster-node';
        node.dataset.clusterId = cluster.automation_type;
        node.style.left = `${cluster.position.x}px`;
        node.style.top = `${cluster.position.y}px`;

        const isExpanded = state.expandedClusters[cluster.automation_type] || false;
        if (isExpanded) node.classList.add('expanded');

        // Cluster icon based on type
        const clusterIcons = {
            'pending_expenses_auth': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>`,
            'pending_expenses_categorize': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>`,
            'pending_health_check': `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>`,
        };

        const icon = clusterIcons[cluster.automation_type] || `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>`;

        // Status indicator
        const statusClass = cluster.is_enabled ? 'enabled' : 'disabled';
        const completedPercent = cluster.total_count > 0
            ? Math.round((cluster.completed_count / cluster.total_count) * 100)
            : 0;

        node.innerHTML = `
            <div class="cluster-header">
                <div class="cluster-icon">${icon}</div>
                <div class="cluster-info">
                    <div class="cluster-title">${escapeHtml(cluster.display_name)}</div>
                    <div class="cluster-meta">
                        <span class="cluster-count">${cluster.total_count} tasks</span>
                        <span class="cluster-status ${statusClass}">${cluster.is_enabled ? 'Active' : 'Disabled'}</span>
                    </div>
                </div>
                <button type="button" class="cluster-toggle-btn" title="${isExpanded ? 'Collapse' : 'Expand'}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="${isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}"></polyline>
                    </svg>
                </button>
            </div>

            <div class="cluster-progress">
                <div class="cluster-progress-bar">
                    <div class="cluster-progress-fill" style="width: ${completedPercent}%"></div>
                </div>
                <span class="cluster-progress-text">${cluster.completed_count}/${cluster.total_count}</span>
            </div>

            <div class="cluster-tasks-container ${isExpanded ? 'open' : ''}">
                ${cluster.tasks.map(task => createClusterTaskItem(task)).join('')}
            </div>

            <div class="node-port port-left" data-port="left"></div>
            <div class="node-port port-right" data-port="right"></div>
        `;

        // Toggle expand/collapse
        const toggleBtn = node.querySelector('.cluster-toggle-btn');
        toggleBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleClusterExpand(cluster.automation_type);
        });

        // Header click to expand
        const header = node.querySelector('.cluster-header');
        header?.addEventListener('click', (e) => {
            if (e.target.closest('.cluster-toggle-btn')) return;
            toggleClusterExpand(cluster.automation_type);
        });

        // Node dragging
        node.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('node-port') ||
                e.target.closest('.cluster-toggle-btn') ||
                e.target.closest('.cluster-task-item')) return;
            startClusterDrag(e, cluster);
        });

        // Task item clicks
        node.querySelectorAll('.cluster-task-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = item.dataset.taskId;
                if (taskId) {
                    window.location.href = `pipeline.html?task=${taskId}`;
                }
            });
        });

        return node;
    }

    function createClusterTaskItem(task) {
        const statusIcon = task.is_completed
            ? '<svg class="task-status-icon completed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg class="task-status-icon pending" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';

        return `
            <div class="cluster-task-item ${task.is_completed ? 'completed' : ''}" data-task-id="${task.task_id}">
                ${statusIcon}
                <div class="cluster-task-info">
                    <span class="cluster-task-project">${escapeHtml(task.project_name || 'No Project')}</span>
                    ${task.owner_name ? `
                        <span class="cluster-task-owner">
                            <span class="owner-avatar" style="background: ${task.owner_avatar_color || '#6b7280'}">${getInitials(task.owner_name)}</span>
                            ${escapeHtml(task.owner_name)}
                        </span>
                    ` : '<span class="cluster-task-unassigned">Unassigned</span>'}
                </div>
                <svg class="cluster-task-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </div>
        `;
    }

    function toggleClusterExpand(automationType) {
        state.expandedClusters[automationType] = !state.expandedClusters[automationType];

        const node = document.querySelector(`[data-cluster-id="${automationType}"]`);
        if (!node) return;

        const isExpanded = state.expandedClusters[automationType];
        node.classList.toggle('expanded', isExpanded);

        const container = node.querySelector('.cluster-tasks-container');
        if (container) {
            container.classList.toggle('open', isExpanded);
        }

        const toggleBtn = node.querySelector('.cluster-toggle-btn svg polyline');
        if (toggleBtn) {
            toggleBtn.setAttribute('points', isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9');
        }

        // Re-render connections after expand/collapse
        setTimeout(() => renderConnections(), 300);
    }

    function startClusterDrag(e, cluster) {
        e.preventDefault();

        // Similar to node drag but for clusters
        const clusterNode = document.querySelector(`[data-cluster-id="${cluster.automation_type}"]`);
        if (!clusterNode) return;

        const rect = elements.canvasContainer.getBoundingClientRect();
        const startX = (e.clientX - rect.left - state.canvas.offsetX) / state.canvas.scale;
        const startY = (e.clientY - rect.top - state.canvas.offsetY) / state.canvas.scale;

        const offsetX = startX - cluster.position.x;
        const offsetY = startY - cluster.position.y;

        clusterNode.classList.add('dragging');

        const onMove = (moveE) => {
            const x = (moveE.clientX - rect.left - state.canvas.offsetX) / state.canvas.scale - offsetX;
            const y = (moveE.clientY - rect.top - state.canvas.offsetY) / state.canvas.scale - offsetY;

            // Snap to grid
            const snappedX = Math.round(x / 20) * 20;
            const snappedY = Math.round(y / 20) * 20;

            cluster.position.x = snappedX;
            cluster.position.y = snappedY;

            clusterNode.style.left = `${snappedX}px`;
            clusterNode.style.top = `${snappedY}px`;
        };

        const onUp = () => {
            clusterNode.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    async function createDependency(predecessorId, successorId, dependencyType = 'finish_to_start') {
        try {
            const res = await fetch(`${API_BASE}/pipeline/dependencies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    predecessor_task_id: predecessorId,
                    successor_task_id: successorId,
                    dependency_type: dependencyType,
                    created_by: state.currentUser?.user_id
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.detail || error.error || 'Failed to create dependency');
            }

            const result = await res.json();

            if (result.success) {
                // Add to local state
                state.dependencies.push({
                    dependency_id: result.dependency_id,
                    predecessor_task_id: predecessorId,
                    successor_task_id: successorId,
                    dependency_type: dependencyType
                });

                state.connections.push({
                    id: result.dependency_id,
                    from: predecessorId,
                    to: successorId,
                    type: dependencyType
                });

                renderConnections();

                if (window.showToast) {
                    window.showToast('Tasks connected successfully', 'success');
                }
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (err) {
            console.error('[OPERATION-MANAGER] Error creating dependency:', err);

            // For now, create connection locally (demo mode)
            const tempId = `temp-${Date.now()}`;
            state.connections.push({
                id: tempId,
                from: predecessorId,
                to: successorId,
                type: 'finish_to_start'
            });
            renderConnections();

            if (window.showToast) {
                window.showToast('Connection created (offline mode)', 'info');
            }
        }
    }

    async function deleteDependency(dependencyId) {
        try {
            const res = await fetch(`${API_BASE}/pipeline/dependencies/${dependencyId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                throw new Error('Failed to delete dependency');
            }

            // Remove from local state
            state.dependencies = state.dependencies.filter(d => d.dependency_id !== dependencyId);
            state.connections = state.connections.filter(c => c.id !== dependencyId);

            renderConnections();

            if (window.showToast) {
                window.showToast('Connection removed', 'success');
            }

        } catch (err) {
            console.error('[OPERATION-MANAGER] Error deleting dependency:', err);

            // Remove locally anyway
            state.connections = state.connections.filter(c => c.id !== dependencyId);
            renderConnections();
        }
    }

    function toggleNodeExpand(taskId) {
        const node = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!node) return;

        const isExpanded = node.classList.contains('expanded');

        // Collapse all other nodes first
        document.querySelectorAll('.task-node.expanded').forEach(n => {
            if (n.dataset.taskId !== taskId) {
                n.classList.remove('expanded');
            }
        });

        // Toggle current node
        if (isExpanded) {
            node.classList.remove('expanded');
            state.selectedNode = null;
        } else {
            node.classList.add('expanded');
            state.selectedNode = taskId;
        }

        // Re-render connections after expand/collapse
        setTimeout(() => renderConnections(), 300);
    }

    function collapseNode(taskId) {
        const node = document.querySelector(`[data-task-id="${taskId}"]`);
        if (node) {
            node.classList.remove('expanded');
            state.selectedNode = null;
            setTimeout(() => renderConnections(), 300);
        }
    }

    async function toggleTaskStatusFromNode(task) {
        const newStatus = task.status === 'working' ? 'not_started' : 'working';

        try {
            const res = await fetch(`${API_BASE}/pipeline/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus === 'working' ? 'Working on It' : 'Not Started' }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            // Update local state
            task.status = newStatus;

            // Re-render nodes
            renderNodes();
            renderConnections();
            updateStats();

            if (window.showToast) {
                window.showToast(`Task marked as ${newStatus === 'working' ? 'Working' : 'Not Started'}`, 'success');
            }
        } catch (err) {
            console.error('[OPERATION-MANAGER] Error updating status:', err);
            if (window.showToast) {
                window.showToast('Failed to update task status', 'error');
            }
        }
    }

    function renderConnections() {
        if (!elements.connectionsLayer) return;

        // Clear existing paths (keep defs)
        const existingPaths = elements.connectionsLayer.querySelectorAll('.connection-path, .connection-group');
        existingPaths.forEach(p => p.remove());

        state.connections.forEach((conn, index) => {
            // Only connect visible tasks
            const fromTask = state.filteredTasks.find(t => t.id === conn.from);
            const toTask = state.filteredTasks.find(t => t.id === conn.to);

            if (!fromTask || !toTask) return;

            const connectionGroup = createConnectionPath(fromTask, toTask, index);
            elements.connectionsLayer.appendChild(connectionGroup);
        });
    }

    function createConnectionPath(fromTask, toTask, index) {
        // Get node dimensions
        const nodeWidth = fromTask.id === state.selectedNode ? 280 : 200;
        const toNodeWidth = toTask.id === state.selectedNode ? 280 : 200;
        const nodeHeight = 90; // Approximate compact height

        // Calculate port positions (right side of from, left side of to)
        const fromX = fromTask.position.x + nodeWidth; // Right edge
        const fromY = fromTask.position.y + nodeHeight / 2; // Vertical center
        const toX = toTask.position.x; // Left edge
        const toY = toTask.position.y + nodeHeight / 2; // Vertical center

        // Calculate the path using smart routing
        const pathData = calculateSmartPath(fromX, fromY, toX, toY, fromTask, toTask);

        // Create group for connection elements
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'connection-group');
        group.dataset.from = fromTask.id;
        group.dataset.to = toTask.id;

        // Create the main path (animated dashed line)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-path');
        path.setAttribute('d', pathData);

        // Find the connection data to check if it's auto-generated
        const conn = state.connections.find(c => c.from === fromTask.id && c.to === toTask.id);

        // Add classes based on task states
        if (fromTask.status === 'working' || toTask.status === 'working') {
            path.classList.add('active');
        }
        if (fromTask.isOverdue || toTask.isOverdue) {
            path.classList.add('critical');
        }
        if (conn?.isAutoGenerated || toTask.autoLinked) {
            path.classList.add('auto-linked');
            group.classList.add('auto-linked');
        }

        // Create invisible wider path for easier hover/click
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hitArea.setAttribute('class', 'connection-hit-area');
        hitArea.setAttribute('d', pathData);

        // Add connection end dots
        const startDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startDot.setAttribute('class', 'connection-dot start');
        startDot.setAttribute('cx', fromX);
        startDot.setAttribute('cy', fromY);
        startDot.setAttribute('r', '4');

        const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        endDot.setAttribute('class', 'connection-dot end');
        endDot.setAttribute('cx', toX);
        endDot.setAttribute('cy', toY);
        endDot.setAttribute('r', '4');

        group.appendChild(hitArea);
        group.appendChild(path);
        group.appendChild(startDot);
        group.appendChild(endDot);

        // Hover effects
        group.addEventListener('mouseenter', () => {
            group.classList.add('hovered');
        });
        group.addEventListener('mouseleave', () => {
            group.classList.remove('hovered');
        });

        // Click to show delete option
        group.addEventListener('click', (e) => {
            e.stopPropagation();
            showConnectionContextMenu(e, conn, fromTask, toTask);
        });

        return group;
    }

    function showConnectionContextMenu(e, connection, fromTask, toTask) {
        // Remove existing menu
        const existingMenu = document.querySelector('.connection-context-menu');
        if (existingMenu) existingMenu.remove();

        const isAutoLinked = connection.isAutoGenerated || toTask.autoLinked;

        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'connection-context-menu';
        menu.innerHTML = `
            <div class="context-menu-header">
                <span class="context-menu-title">Connection</span>
                ${isAutoLinked ? '<span class="context-auto-badge">Auto-Scheduled</span>' : ''}
            </div>
            <div class="context-menu-info">
                <div class="context-info-row">
                    <span class="context-label">From:</span>
                    <span class="context-value">${escapeHtml(fromTask.title.substring(0, 30))}${fromTask.title.length > 30 ? '...' : ''}</span>
                </div>
                <div class="context-info-row">
                    <span class="context-label">To:</span>
                    <span class="context-value">${escapeHtml(toTask.title.substring(0, 30))}${toTask.title.length > 30 ? '...' : ''}</span>
                </div>
                <div class="context-info-row">
                    <span class="context-label">Type:</span>
                    <span class="context-value type-badge">${connection.type === 'finish_to_start' ? 'Finish to Start' : connection.type}</span>
                </div>
                ${isAutoLinked ? `
                <div class="context-info-row">
                    <span class="context-label">Note:</span>
                    <span class="context-value context-note">Created by workload scheduler</span>
                </div>
                ` : ''}
            </div>
            <div class="context-menu-actions">
                <button type="button" class="context-btn context-btn-delete ${isAutoLinked ? 'auto-link-warning' : ''}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    ${isAutoLinked ? 'Remove Auto-Link' : 'Remove Connection'}
                </button>
            </div>
        `;

        // Position menu near cursor
        const rect = elements.canvasContainer.getBoundingClientRect();
        menu.style.left = `${e.clientX - rect.left + 10}px`;
        menu.style.top = `${e.clientY - rect.top + 10}px`;

        elements.canvasContainer.appendChild(menu);

        // Delete button handler
        menu.querySelector('.context-btn-delete').addEventListener('click', () => {
            if (connection.id) {
                deleteDependency(connection.id);
            } else {
                // Remove from local connections
                state.connections = state.connections.filter(c =>
                    !(c.from === connection.from && c.to === connection.to)
                );
                renderConnections();
            }
            menu.remove();
        });

        // Close menu on click outside
        const closeMenu = (ev) => {
            if (!menu.contains(ev.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    function calculateSmartPath(x1, y1, x2, y2, fromTask, toTask) {
        // Determine routing strategy based on relative positions
        const dx = x2 - x1;
        const dy = y2 - y1;
        const minCurveOffset = 50;

        // If target is to the right (normal flow)
        if (dx > 0) {
            // Calculate control point offset based on distance
            const curveOffset = Math.max(minCurveOffset, Math.min(dx * 0.4, 150));

            // Simple horizontal bezier curve
            const cx1 = x1 + curveOffset;
            const cy1 = y1;
            const cx2 = x2 - curveOffset;
            const cy2 = y2;

            return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
        }
        // If target is to the left (backwards connection)
        else {
            // Need to route around nodes
            const nodeHeight = 90;
            const padding = 40;

            // Determine if we should go above or below
            const goUp = y1 <= y2;
            const routeY = goUp
                ? Math.min(fromTask.position.y, toTask.position.y) - padding
                : Math.max(fromTask.position.y + nodeHeight, toTask.position.y + nodeHeight) + padding;

            // Create path that goes: right, up/down, left, up/down, right
            const offset1 = 30;
            const offset2 = 30;

            return `M ${x1} ${y1}
                    C ${x1 + offset1} ${y1}, ${x1 + offset1} ${routeY}, ${x1 + offset1} ${routeY}
                    L ${x2 - offset2} ${routeY}
                    C ${x2 - offset2} ${routeY}, ${x2 - offset2} ${y2}, ${x2} ${y2}`;
        }
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

            // Snap to grid (20px for smoother movement)
            const snappedX = Math.round(x / 20) * 20;
            const snappedY = Math.round(y / 20) * 20;

            state.draggedNode.position.x = snappedX;
            state.draggedNode.position.y = snappedY;

            const nodeEl = document.querySelector(`[data-task-id="${state.draggedNode.id}"]`);
            if (nodeEl) {
                nodeEl.style.left = `${snappedX}px`;
                nodeEl.style.top = `${snappedY}px`;
            }

            // Update connections in real-time (throttled)
            if (!state.connectionUpdatePending) {
                state.connectionUpdatePending = true;
                requestAnimationFrame(() => {
                    renderConnections();
                    state.connectionUpdatePending = false;
                });
            }
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
        // Collapse all nodes and expand the selected one
        document.querySelectorAll('.task-node.expanded').forEach(n => {
            n.classList.remove('expanded');
        });

        state.selectedNode = taskId;
        const nodeEl = document.querySelector(`[data-task-id="${taskId}"]`);
        if (nodeEl) {
            nodeEl.classList.add('expanded');
        }
    }

    function deselectNode() {
        if (state.selectedNode) {
            const nodeEl = document.querySelector(`[data-task-id="${state.selectedNode}"]`);
            if (nodeEl) nodeEl.classList.remove('expanded');
            state.selectedNode = null;
        }
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
                console.error('[OPERATION-MANAGER] Failed to save duration:', res.status);
            }
        } catch (err) {
            console.error('[OPERATION-MANAGER] Error saving duration:', err);
        }
    }

    // ================================
    // Task Scheduling
    // ================================
    async function scheduleTask(task) {
        if (window.showToast) {
            window.showToast('Calculating schedule...', 'info');
        }

        try {
            const res = await fetch(`${API_BASE}/pipeline/workload/schedule-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    force_reschedule: false
                }),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(err);
            }

            const result = await res.json();

            if (result.success) {
                // Update local task state
                task.scheduledStartDate = result.scheduled_start_date;
                task.scheduledEndDate = result.scheduled_end_date;
                task.queuePosition = result.queue_position;
                task.autoLinked = result.blocking_task_id ? true : false;
                task.blockedByTaskId = result.blocking_task_id;

                // Re-render the node
                renderNodes();
                renderConnections();

                const message = result.dependency_created
                    ? `Scheduled: ${formatShortDate(result.scheduled_start_date)} - ${formatShortDate(result.scheduled_end_date)} (linked to previous task)`
                    : `Scheduled: ${formatShortDate(result.scheduled_start_date)} - ${formatShortDate(result.scheduled_end_date)}`;

                if (window.showToast) {
                    window.showToast(message, 'success');
                }

                // If a dependency was created, refresh connections
                if (result.dependency_created) {
                    await loadDependencies();
                    renderConnections();
                }
            }
        } catch (err) {
            console.error('[OPERATION-MANAGER] Error scheduling task:', err);
            if (window.showToast) {
                window.showToast('Failed to schedule task: ' + err.message, 'error');
            }
        }
    }

    async function recalculateAllSchedules() {
        const userId = state.currentUser?.user_id;
        if (!userId) return;

        if (window.showToast) {
            window.showToast('Recalculating all schedules...', 'info');
        }

        try {
            const res = await fetch(`${API_BASE}/pipeline/workload/recalculate/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                throw new Error('Failed to recalculate');
            }

            const result = await res.json();

            if (result.success) {
                // Reload tasks to get updated schedule
                await loadTasks();
                applyFilters();
                renderNodes();
                await loadDependencies();
                renderConnections();
                renderWorkloadIndicator();

                if (window.showToast) {
                    window.showToast(`Scheduled ${result.tasks_scheduled} tasks`, 'success');
                }
            }
        } catch (err) {
            console.error('[OPERATION-MANAGER] Error recalculating schedules:', err);
            if (window.showToast) {
                window.showToast('Failed to recalculate schedules', 'error');
            }
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
    // Panel (kept for compatibility but simplified)
    // ================================
    function openPanel(task) {
        // Panel functionality moved to expanded node view
        // This function kept for compatibility
        toggleNodeExpand(task.id);
    }

    function closePanel() {
        // Panel functionality moved to expanded node view
        state.isPanelOpen = false;
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
            console.error('[OPERATION-MANAGER] Error updating status:', err);
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
            console.log('[OPERATION-MANAGER] List view not yet implemented');
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
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatDateFull(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatShortDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

    // Expose for debugging and external calls
    window.OperationManager = {
        state,
        renderNodes,
        renderConnections,
        recalculateWorkload,
        scheduleTask,
        recalculateAllSchedules,
        loadTasks,
    };

})();
