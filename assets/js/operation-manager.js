/**
 * OPERATION MANAGER - Gantt Card Timeline
 * ========================================
 * Horizontal timeline with task cards positioned by date.
 * Rows grouped by person or project, with workload capacity bars.
 * Zoom levels: Day / Week / Month.
 * Dependencies rendered as SVG arrows.
 */
(function () {
    'use strict';

    const API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';

    // ================================
    // CONSTANTS
    // ================================

    const ZOOM_CONFIG = {
        day:   { pxPerDay: 240, headerUnit: 'hour',  label: 'Day'   },
        week:  { pxPerDay: 120, headerUnit: 'day',   label: 'Week'  },
        month: { pxPerDay: 40,  headerUnit: 'week',  label: 'Month' },
    };

    const STATUS_CLASSES = {
        'not started':         'status-not-started',
        'working on it':       'status-working',
        'awaiting approval':   'status-awaiting-approval',
        'good to go':          'status-good-to-go',
        'correction':          'status-correction',
        'resubmittal needed':  'status-resubmittal',
        'done':                'status-done',
        'delayed':             'status-delayed',
    };

    const PRIORITY_COLORS = {
        critical: '#ef4444',
        high:     '#ef4444',
        medium:   '#f59e0b',
        low:      '#22c55e',
    };

    const STATUS_COLORS_MAP = {
        'not started':         '#6b7280',
        'working on it':       '#f59e0b',
        'awaiting approval':   '#8b5cf6',
        'good to go':          '#3ecf8e',
        'correction':          '#ef4444',
        'resubmittal needed':  '#fb923c',
        'done':                '#22c55e',
        'delayed':             '#ef4444',
    };

    const CARD_HEIGHT = 36;
    const CARD_GAP = 4;
    const ROW_PADDING = 10;
    const MIN_CARD_WIDTH = 80;
    const MIN_ROW_HEIGHT = 56;
    const LABEL_COL_WIDTH = 220;

    const DEFAULT_STATUSES = [
        'not started', 'working on it', 'awaiting approval',
        'correction', 'resubmittal needed', 'delayed'
    ];

    const ALL_STATUSES = [
        'not started', 'working on it', 'awaiting approval', 'good to go',
        'correction', 'resubmittal needed', 'done', 'delayed'
    ];

    // ================================
    // STATE
    // ================================

    const state = {
        allTasks: [],
        filteredTasks: [],
        dependencies: [],
        users: [],
        projects: [],
        teamWorkload: [],

        zoomLevel: 'week',
        groupBy: 'person',
        timeRange: { start: null, end: null },
        rows: [],

        filters: {
            statuses: [...DEFAULT_STATUSES],
            projectId: '',
            personId: '',
        },

        currentUser: null,
        selectedTaskId: null,
        unscheduledCollapsed: false,
    };

    // ================================
    // DOM CACHE
    // ================================

    let els = {};

    function cacheElements() {
        els = {
            cornerCell:       document.getElementById('omCornerCell'),
            headerScroll:     document.getElementById('omHeaderScroll'),
            headerDates:      document.getElementById('omHeaderDates'),
            rowLabels:        document.getElementById('omRowLabels'),
            grid:             document.getElementById('omGrid'),
            gridInner:        document.getElementById('omGridInner'),
            gridBg:           document.getElementById('omGridBg'),
            todayLine:        document.getElementById('omTodayLine'),
            depLayer:         document.getElementById('omDepLayer'),
            cardsContainer:   document.getElementById('omCardsContainer'),
            unscheduled:      document.getElementById('omUnscheduled'),
            unscheduledGrid:  document.getElementById('omUnscheduledGrid'),
            unscheduledCount: document.getElementById('omUnscheduledCount'),
            unscheduledToggle:document.getElementById('omUnscheduledToggle'),
            emptyState:       document.getElementById('omEmptyState'),
            filterMenu:       document.getElementById('omFilterMenu'),
            filterBadge:      document.getElementById('omFilterBadge'),
            filterStatusList: document.getElementById('omFilterStatusList'),
            filterProject:    document.getElementById('omFilterProject'),
            filterPerson:     document.getElementById('omFilterPerson'),
            capacityModal:    document.getElementById('omCapacityModal'),
            capacityBody:     document.getElementById('omCapacityBody'),
            taskPanel:        document.getElementById('omTaskPanel'),
            panelTitle:       document.getElementById('omPanelTitle'),
            panelBody:        document.getElementById('omPanelBody'),
        };
    }

    // ================================
    // AUTH
    // ================================

    function getAuthHeaders() {
        const token = localStorage.getItem('ngmToken');
        return token ? { Authorization: 'Bearer ' + token } : {};
    }

    // ================================
    // INIT
    // ================================

    async function init() {
        cacheElements();
        loadCurrentUser();
        loadSavedPrefs();

        setupToolbarEvents();
        setupScrollSync();
        setupGridEvents();

        try {
            await Promise.all([
                loadAllTasks(),
                loadDependencies(),
                loadUsers(),
                loadProjects(),
                loadTeamWorkload(),
            ]);
        } catch (err) {
            console.error('[OM] Data load error:', err);
        }

        populateFilterDropdowns();
        applyFilters();
        computeTimeRange();
        computeRows();
        renderAll();
        scrollToToday();

        hidePageLoading();
    }

    function loadCurrentUser() {
        try {
            const str = localStorage.getItem('ngm_user');
            if (str) state.currentUser = JSON.parse(str);
        } catch (e) { /* ignore */ }
    }

    function hidePageLoading() {
        if (window.hidePageLoading) window.hidePageLoading();
    }

    // ================================
    // DATA LOADING
    // ================================

    async function loadAllTasks() {
        try {
            const resp = await fetch(API_BASE + '/pipeline/grouped', {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();

            state.allTasks = [];
            (data.groups || []).forEach(function (group) {
                var statusName = (group.status_name || '').toLowerCase();
                (group.tasks || []).forEach(function (t) {
                    state.allTasks.push(transformTask(t, statusName));
                });
            });
        } catch (err) {
            console.warn('[OM] Failed to load tasks:', err.message);
            state.allTasks = [];
        }
    }

    async function loadDependencies() {
        try {
            const resp = await fetch(API_BASE + '/pipeline/dependencies', {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            state.dependencies = data.dependencies || [];
        } catch (err) {
            console.warn('[OM] Failed to load dependencies:', err.message);
            state.dependencies = [];
        }
    }

    async function loadUsers() {
        try {
            const resp = await fetch(API_BASE + '/pipeline/users', {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            state.users = data.users || data || [];
        } catch (err) {
            console.warn('[OM] Failed to load users:', err.message);
            state.users = [];
        }
    }

    async function loadProjects() {
        try {
            const resp = await fetch(API_BASE + '/pipeline/projects', {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            state.projects = data.projects || data || [];
        } catch (err) {
            console.warn('[OM] Failed to load projects:', err.message);
            state.projects = [];
        }
    }

    async function loadTeamWorkload() {
        try {
            const resp = await fetch(API_BASE + '/pipeline/workload/team', {
                headers: getAuthHeaders(),
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();
            state.teamWorkload = data.team || [];
        } catch (err) {
            console.warn('[OM] Failed to load team workload:', err.message);
            state.teamWorkload = [];
        }
    }

    // ================================
    // DATA TRANSFORMATION
    // ================================

    function transformTask(raw, statusName) {
        var sDate = parseDate(raw.scheduled_start_date) || parseDate(raw.start_date);
        var eDate = parseDate(raw.scheduled_end_date) || parseDate(raw.deadline) || parseDate(raw.due_date);

        // If we have start but no end, estimate end from hours
        if (sDate && !eDate && raw.estimated_hours) {
            var days = Math.max(1, Math.ceil(raw.estimated_hours / 8));
            eDate = new Date(sDate);
            eDate.setDate(eDate.getDate() + days);
        }

        // If we have end but no start, use end as single-day
        if (!sDate && eDate) {
            sDate = new Date(eDate);
        }

        var isScheduled = !!(sDate || eDate);

        // Overdue detection
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var isOverdue = false;
        if (eDate && statusName !== 'done') {
            var deadlineCheck = new Date(eDate);
            deadlineCheck.setHours(0, 0, 0, 0);
            isOverdue = deadlineCheck < now;
        }

        return {
            id: raw.task_id,
            description: raw.task_description || 'Untitled',
            startDate: sDate,
            endDate: eDate,
            deadline: parseDate(raw.deadline),
            dueDate: parseDate(raw.due_date),
            createdAt: parseDate(raw.created_at),
            estimatedHours: raw.estimated_hours || 0,
            ownerId: raw.Owner_id || null,
            owner: raw.owner || null,
            collaborators: raw.collaborators || [],
            managers: raw.managers || [],
            statusName: statusName,
            projectId: raw.project_id || null,
            projectName: raw.project_name || 'No Project',
            companyName: raw.company_name || '',
            priority: raw.priority || null,
            isScheduled: isScheduled,
            isOverdue: isOverdue,
        };
    }

    // ================================
    // TIME AXIS
    // ================================

    function computeTimeRange() {
        var now = new Date();
        now.setHours(0, 0, 0, 0);

        var minDate = new Date(now);
        var maxDate = new Date(now);
        minDate.setDate(minDate.getDate() - 14);
        maxDate.setDate(maxDate.getDate() + 28);

        state.filteredTasks.forEach(function (task) {
            if (task.startDate && task.startDate < minDate) minDate = new Date(task.startDate);
            if (task.endDate && task.endDate > maxDate) maxDate = new Date(task.endDate);
        });

        // Add padding
        minDate.setDate(minDate.getDate() - 7);
        maxDate.setDate(maxDate.getDate() + 7);

        // Snap to Monday
        var dayOfWeek = minDate.getDay();
        var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        minDate.setDate(minDate.getDate() + mondayOffset);
        minDate.setHours(0, 0, 0, 0);

        // Snap end to Sunday
        var endDay = maxDate.getDay();
        if (endDay !== 0) maxDate.setDate(maxDate.getDate() + (7 - endDay));
        maxDate.setHours(23, 59, 59, 999);

        state.timeRange = { start: minDate, end: maxDate };
    }

    function dateToX(date) {
        if (!date) return 0;
        var msFromStart = date.getTime() - state.timeRange.start.getTime();
        var days = msFromStart / 86400000;
        return days * ZOOM_CONFIG[state.zoomLevel].pxPerDay;
    }

    function getTotalGridWidth() {
        if (!state.timeRange.start || !state.timeRange.end) return 2000;
        var ms = state.timeRange.end.getTime() - state.timeRange.start.getTime();
        var days = ms / 86400000;
        return Math.ceil(days * ZOOM_CONFIG[state.zoomLevel].pxPerDay);
    }

    function getTotalGridHeight() {
        if (state.rows.length === 0) return 400;
        var last = state.rows[state.rows.length - 1];
        return last.yOffset + last.height;
    }

    // ================================
    // ROW COMPUTATION
    // ================================

    function computeRows() {
        state.rows = [];
        var scheduled = state.filteredTasks.filter(function (t) { return t.isScheduled; });

        if (state.groupBy === 'person') {
            var byPerson = {};

            scheduled.forEach(function (task) {
                var id = task.ownerId || 'unassigned';
                if (!byPerson[id]) {
                    byPerson[id] = {
                        id: id,
                        label: task.owner ? task.owner.name : 'Unassigned',
                        avatarColor: task.owner ? task.owner.avatar_color : null,
                        photo: task.owner ? task.owner.photo : null,
                        tasks: [],
                    };
                }
                byPerson[id].tasks.push(task);
            });

            // Enrich with workload
            Object.keys(byPerson).forEach(function (key) {
                var row = byPerson[key];
                var wl = state.teamWorkload.find(function (w) {
                    return w.user_id === row.id;
                });

                if (wl && wl.workload_metrics) {
                    row.capacityHours = (wl.capacity && wl.capacity.weekly_capacity) || 40;
                    row.assignedHours = wl.workload_metrics.total_hours || 0;
                    row.utilization = wl.workload_metrics.utilization || wl.workload_metrics.utilization_percent || 0;
                    row.workloadStatus = wl.workload_metrics.status || 'normal';
                } else {
                    row.capacityHours = 40;
                    row.assignedHours = row.tasks.reduce(function (s, t) { return s + t.estimatedHours; }, 0);
                    row.utilization = row.capacityHours > 0 ? (row.assignedHours / row.capacityHours) * 100 : 0;
                    row.workloadStatus = 'normal';
                }

                row.tasks.sort(function (a, b) {
                    return (a.startDate || a.createdAt || 0) - (b.startDate || b.createdAt || 0);
                });

                row.height = Math.max(MIN_ROW_HEIGHT, row.tasks.length * (CARD_HEIGHT + CARD_GAP) + ROW_PADDING * 2);
            });

            state.rows = Object.values(byPerson).sort(function (a, b) {
                return b.utilization - a.utilization;
            });

        } else {
            // Group by project
            var byProject = {};

            scheduled.forEach(function (task) {
                var id = task.projectId || 'no-project';
                if (!byProject[id]) {
                    byProject[id] = {
                        id: id,
                        label: task.projectName || 'No Project',
                        avatarColor: null,
                        photo: null,
                        tasks: [],
                    };
                }
                byProject[id].tasks.push(task);
            });

            Object.keys(byProject).forEach(function (key) {
                var row = byProject[key];
                row.assignedHours = row.tasks.reduce(function (s, t) { return s + t.estimatedHours; }, 0);
                row.capacityHours = row.assignedHours || 1;
                row.utilization = 0;
                row.workloadStatus = 'normal';

                row.tasks.sort(function (a, b) {
                    return (a.startDate || a.createdAt || 0) - (b.startDate || b.createdAt || 0);
                });

                row.height = Math.max(MIN_ROW_HEIGHT, row.tasks.length * (CARD_HEIGHT + CARD_GAP) + ROW_PADDING * 2);
            });

            state.rows = Object.values(byProject).sort(function (a, b) {
                return a.label.localeCompare(b.label);
            });
        }

        // Compute cumulative Y offsets
        var y = 0;
        state.rows.forEach(function (row) {
            row.yOffset = y;
            y += row.height;
        });
    }

    // ================================
    // FILTERS
    // ================================

    function applyFilters() {
        state.filteredTasks = state.allTasks.filter(function (task) {
            if (!state.filters.statuses.includes(task.statusName)) return false;
            if (state.filters.projectId && task.projectId !== state.filters.projectId) return false;
            if (state.filters.personId && task.ownerId !== state.filters.personId) return false;
            return true;
        });
    }

    function populateFilterDropdowns() {
        // Status checkboxes
        if (els.filterStatusList) {
            els.filterStatusList.innerHTML = ALL_STATUSES.map(function (s) {
                var checked = state.filters.statuses.includes(s) ? 'checked' : '';
                var color = STATUS_COLORS_MAP[s] || '#6b7280';
                return '<label class="om-filter-checkbox">' +
                    '<input type="checkbox" data-status="' + s + '" ' + checked + '>' +
                    '<span class="om-filter-checkbox-dot" style="background:' + color + ';"></span>' +
                    '<span class="om-filter-checkbox-label">' + capitalize(s) + '</span>' +
                    '</label>';
            }).join('');
        }

        // Project select
        if (els.filterProject) {
            var projectOpts = '<option value="">All Projects</option>';
            state.projects.forEach(function (p) {
                var id = p.project_id || p.id;
                var name = p.project_name || p.name || 'Unknown';
                projectOpts += '<option value="' + id + '">' + escapeHtml(name) + '</option>';
            });
            els.filterProject.innerHTML = projectOpts;
        }

        // Person select
        if (els.filterPerson) {
            var personOpts = '<option value="">All People</option>';
            state.users.forEach(function (u) {
                var id = u.user_id || u.id;
                var name = u.user_name || u.name || 'Unknown';
                personOpts += '<option value="' + id + '">' + escapeHtml(name) + '</option>';
            });
            els.filterPerson.innerHTML = personOpts;
        }
    }

    function updateFilterBadge() {
        var count = ALL_STATUSES.length - state.filters.statuses.length;
        if (state.filters.projectId) count++;
        if (state.filters.personId) count++;

        if (els.filterBadge) {
            els.filterBadge.style.display = count > 0 ? 'inline-flex' : 'none';
            els.filterBadge.textContent = count;
        }
    }

    // ================================
    // RENDER ALL
    // ================================

    function renderAll() {
        var totalW = getTotalGridWidth();
        var totalH = getTotalGridHeight();

        // Show/hide empty state
        if (state.filteredTasks.length === 0) {
            els.emptyState.style.display = 'block';
            document.querySelector('.om-timeline-wrapper').style.display = 'none';
            els.unscheduled.style.display = 'none';
            return;
        }

        els.emptyState.style.display = 'none';
        document.querySelector('.om-timeline-wrapper').style.display = 'flex';

        renderHeader(totalW);
        renderRowLabels(totalH);
        renderGridBackground(totalW, totalH);
        renderTaskCards(totalW, totalH);
        renderTodayLine(totalH);
        renderDependencies(totalW, totalH);
        renderUnscheduled();
        updateFilterBadge();
    }

    // ================================
    // RENDER: HEADER
    // ================================

    function renderHeader(totalW) {
        var zoom = ZOOM_CONFIG[state.zoomLevel];
        var start = state.timeRange.start;
        var end = state.timeRange.end;

        var topHtml = '';
        var bottomHtml = '';

        if (state.zoomLevel === 'day') {
            // Top tier: dates, bottom tier: hours
            var d = new Date(start);
            while (d < end) {
                var dayWidth = zoom.pxPerDay;
                var dayLabel = MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
                topHtml += '<div class="om-header-month" style="width:' + dayWidth + 'px;">' + dayLabel + '</div>';

                for (var h = 0; h < 24; h++) {
                    var hourW = dayWidth / 24;
                    var hourLabel = h % 6 === 0 ? (h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : (h - 12) + 'p') : '';
                    bottomHtml += '<div class="om-header-cell" style="width:' + hourW + 'px;">' + hourLabel + '</div>';
                }
                d.setDate(d.getDate() + 1);
            }

        } else if (state.zoomLevel === 'week') {
            // Top tier: months, bottom tier: days
            var currentMonth = -1;
            var monthStartX = 0;
            var monthParts = [];
            var d2 = new Date(start);

            while (d2 < end) {
                var m = d2.getMonth();
                if (m !== currentMonth) {
                    if (currentMonth >= 0) {
                        var w = dateToX(d2) - monthStartX;
                        monthParts.push({ label: MONTHS_SHORT[currentMonth] + ' ' + d2.getFullYear(), width: w });
                    }
                    currentMonth = m;
                    monthStartX = dateToX(d2);
                }

                var isWeekend = d2.getDay() === 0 || d2.getDay() === 6;
                var isToday = isSameDay(d2, new Date());
                var cls = 'om-header-cell' + (isWeekend ? ' om-weekend' : '') + (isToday ? ' om-today' : '');
                var dayLabel2 = DAYS_SHORT[d2.getDay()] + ' ' + d2.getDate();
                bottomHtml += '<div class="' + cls + '" style="width:' + zoom.pxPerDay + 'px;">' + dayLabel2 + '</div>';

                d2.setDate(d2.getDate() + 1);
            }
            // Last month
            if (currentMonth >= 0) {
                var lastW = totalW - monthStartX;
                monthParts.push({ label: MONTHS_SHORT[currentMonth] + ' ' + d2.getFullYear(), width: lastW });
            }

            topHtml = monthParts.map(function (p) {
                return '<div class="om-header-month" style="width:' + p.width + 'px;">' + p.label + '</div>';
            }).join('');

        } else {
            // Month zoom: top tier = months, bottom tier = weeks
            var currentMonth2 = -1;
            var monthStartX2 = 0;
            var monthParts2 = [];
            var d3 = new Date(start);

            while (d3 < end) {
                var m2 = d3.getMonth();
                if (m2 !== currentMonth2) {
                    if (currentMonth2 >= 0) {
                        var w2 = dateToX(d3) - monthStartX2;
                        monthParts2.push({ label: MONTHS_SHORT[currentMonth2] + ' ' + d3.getFullYear(), width: w2 });
                    }
                    currentMonth2 = m2;
                    monthStartX2 = dateToX(d3);
                }

                // One cell per week
                if (d3.getDay() === 1 || isSameDay(d3, start)) {
                    var weekEnd = new Date(d3);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    var weekW = 7 * zoom.pxPerDay;
                    var weekLabel = MONTHS_SHORT[d3.getMonth()] + ' ' + d3.getDate();
                    bottomHtml += '<div class="om-header-cell" style="width:' + weekW + 'px;">' + weekLabel + '</div>';
                }

                d3.setDate(d3.getDate() + 1);
            }

            if (currentMonth2 >= 0) {
                var lastW2 = totalW - monthStartX2;
                monthParts2.push({ label: MONTHS_SHORT[currentMonth2] + ' ' + d3.getFullYear(), width: lastW2 });
            }

            topHtml = monthParts2.map(function (p) {
                return '<div class="om-header-month" style="width:' + p.width + 'px;">' + p.label + '</div>';
            }).join('');
        }

        els.headerDates.style.width = totalW + 'px';
        els.headerDates.innerHTML =
            '<div class="om-header-top">' + topHtml + '</div>' +
            '<div class="om-header-bottom">' + bottomHtml + '</div>';

        // Update corner cell label
        els.cornerCell.textContent = state.groupBy === 'person' ? 'Person' : 'Project';
    }

    // ================================
    // RENDER: ROW LABELS
    // ================================

    function renderRowLabels() {
        var html = '';

        state.rows.forEach(function (row) {
            var utilPct = Math.round(row.utilization);
            var barWidth = Math.min(100, utilPct);
            var barColor = utilPct > 100 ? 'var(--color-danger)'
                         : utilPct > 80 ? 'var(--color-warning)'
                         : 'var(--accent)';

            var avatarHtml = '';
            if (state.groupBy === 'person') {
                avatarHtml = renderRowAvatar(row);
            } else {
                var hue = hashStringToHue(row.label);
                var initial = (row.label || '?')[0].toUpperCase();
                avatarHtml = '<span class="om-row-avatar" style="background:hsl(' + hue + ',70%,45%);">' + initial + '</span>';
            }

            var metaText = row.tasks.length + ' task' + (row.tasks.length !== 1 ? 's' : '');
            if (row.assignedHours > 0) metaText += ' · ' + Math.round(row.assignedHours) + 'h';

            var capacityHtml = '';
            if (state.groupBy === 'person' && row.id !== 'unassigned') {
                capacityHtml =
                    '<div class="om-row-capacity-bar">' +
                        '<span class="om-row-capacity-text">' + utilPct + '%</span>' +
                        '<div class="om-row-capacity-fill" style="width:' + barWidth + '%;background:' + barColor + ';"></div>' +
                    '</div>';
            }

            html += '<div class="om-row-label" data-row-id="' + row.id + '" style="height:' + row.height + 'px;">' +
                '<div class="om-row-label-info">' +
                    avatarHtml +
                    '<div class="om-row-label-text">' +
                        '<span class="om-row-label-name">' + escapeHtml(row.label) + '</span>' +
                        '<span class="om-row-label-meta">' + metaText + '</span>' +
                    '</div>' +
                '</div>' +
                capacityHtml +
            '</div>';
        });

        els.rowLabels.innerHTML = '<div class="om-row-labels-inner">' + html + '</div>';
    }

    function renderRowAvatar(row) {
        if (row.photo) {
            return '<span class="om-row-avatar"><img src="' + escapeHtml(row.photo) + '" alt="' + escapeHtml(row.label) + '" /></span>';
        }
        var hue = row.avatarColor != null ? row.avatarColor : hashStringToHue(row.id || row.label);
        var initial = (row.label || '?')[0].toUpperCase();
        return '<span class="om-row-avatar" style="background:hsl(' + hue + ',70%,45%);">' + initial + '</span>';
    }

    // ================================
    // RENDER: GRID BACKGROUND
    // ================================

    function renderGridBackground(totalW, totalH) {
        var html = '';
        var zoom = ZOOM_CONFIG[state.zoomLevel];
        var d = new Date(state.timeRange.start);
        var end = state.timeRange.end;

        // Vertical column lines + weekend shading
        while (d < end) {
            var x = dateToX(d);
            var isWeekend = d.getDay() === 0 || d.getDay() === 6;

            if (state.zoomLevel !== 'month') {
                html += '<div class="om-grid-col-line" style="left:' + x + 'px;height:' + totalH + 'px;"></div>';
            }

            if (isWeekend && state.zoomLevel === 'week') {
                html += '<div class="om-grid-col-weekend" style="left:' + x + 'px;width:' + zoom.pxPerDay + 'px;height:' + totalH + 'px;"></div>';
            }

            d.setDate(d.getDate() + 1);
        }

        // Horizontal row lines
        state.rows.forEach(function (row) {
            var y = row.yOffset + row.height;
            html += '<div class="om-grid-row-line" style="top:' + y + 'px;width:' + totalW + 'px;"></div>';
        });

        els.gridBg.innerHTML = html;
        els.gridInner.style.width = totalW + 'px';
        els.gridInner.style.height = totalH + 'px';
    }

    // ================================
    // RENDER: TASK CARDS
    // ================================

    function renderTaskCards(totalW, totalH) {
        var fragment = document.createDocumentFragment();

        state.rows.forEach(function (row) {
            row.tasks.forEach(function (task, idx) {
                if (!task.isScheduled) return;

                var x = dateToX(task.startDate);
                var endX = dateToX(task.endDate);
                var width = Math.max(MIN_CARD_WIDTH, endX - x);
                var y = row.yOffset + ROW_PADDING + idx * (CARD_HEIGHT + CARD_GAP);

                var card = document.createElement('div');
                card.className = 'om-task-card ' + (STATUS_CLASSES[task.statusName] || '');
                if (task.isOverdue) card.className += ' om-overdue';
                card.dataset.taskId = task.id;

                card.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + width + 'px;height:' + CARD_HEIGHT + 'px;';

                var priorityName = task.priority ? (task.priority.priority_name || '').toLowerCase() : 'medium';
                var priorityColor = PRIORITY_COLORS[priorityName] || PRIORITY_COLORS.medium;

                var avatarHtml = '';
                if (state.groupBy === 'project' && task.owner) {
                    avatarHtml = renderMiniAvatar(task.owner);
                }

                // Due date tag for overdue/soon
                var dueTagHtml = '';
                if (task.isOverdue) {
                    var daysOverdue = Math.ceil((new Date() - task.endDate) / 86400000);
                    dueTagHtml = '<span class="om-card-due-tag overdue">' + daysOverdue + 'd late</span>';
                }

                card.innerHTML =
                    '<div class="om-card-inner">' +
                        '<span class="om-card-priority-dot" style="background:' + priorityColor + ';"></span>' +
                        '<span class="om-card-title">' + escapeHtml(task.description) + '</span>' +
                        dueTagHtml +
                        avatarHtml +
                    '</div>';

                fragment.appendChild(card);
            });
        });

        els.cardsContainer.innerHTML = '';
        els.cardsContainer.appendChild(fragment);
    }

    function renderMiniAvatar(person) {
        if (!person) return '';
        if (person.photo) {
            return '<span class="om-mini-avatar"><img src="' + escapeHtml(person.photo) + '" alt="" /></span>';
        }
        var hue = person.avatar_color != null ? person.avatar_color : hashStringToHue(person.id || person.name);
        var initial = (person.name || '?')[0].toUpperCase();
        return '<span class="om-mini-avatar" style="background:hsl(' + hue + ',70%,45%);">' + initial + '</span>';
    }

    // ================================
    // RENDER: TODAY LINE
    // ================================

    function renderTodayLine(totalH) {
        var now = new Date();
        if (now < state.timeRange.start || now > state.timeRange.end) {
            els.todayLine.style.display = 'none';
            return;
        }

        var x = dateToX(now);
        els.todayLine.style.display = 'block';
        els.todayLine.style.left = x + 'px';
        els.todayLine.style.height = totalH + 'px';
    }

    // ================================
    // RENDER: DEPENDENCIES (SVG)
    // ================================

    function renderDependencies(totalW, totalH) {
        var svg = els.depLayer;
        svg.setAttribute('width', totalW);
        svg.setAttribute('height', totalH);
        svg.setAttribute('viewBox', '0 0 ' + totalW + ' ' + totalH);
        svg.innerHTML = '';

        if (state.dependencies.length === 0) return;

        // Build position map from rendered cards
        var posMap = {};
        els.cardsContainer.querySelectorAll('.om-task-card').forEach(function (card) {
            posMap[card.dataset.taskId] = {
                x: parseFloat(card.style.left),
                y: parseFloat(card.style.top),
                w: parseFloat(card.style.width),
                h: CARD_HEIGHT,
            };
        });

        // Arrow marker definition
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.innerHTML =
            '<marker id="om-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">' +
                '<polygon points="0 0, 8 3, 0 6" fill="#3ecf8e" />' +
            '</marker>' +
            '<marker id="om-arrow-red" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">' +
                '<polygon points="0 0, 8 3, 0 6" fill="#ef4444" />' +
            '</marker>';
        svg.appendChild(defs);

        state.dependencies.forEach(function (dep) {
            var fromId = dep.predecessor_task_id;
            var toId = dep.successor_task_id;
            var from = posMap[fromId];
            var to = posMap[toId];
            if (!from || !to) return;

            var x1 = from.x + from.w;
            var y1 = from.y + from.h / 2;
            var x2 = to.x;
            var y2 = to.y + to.h / 2;

            var dx = Math.abs(x2 - x1);
            var cpOffset = Math.max(30, dx * 0.3);

            var pathD = 'M ' + x1 + ' ' + y1 +
                       ' C ' + (x1 + cpOffset) + ' ' + y1 +
                       ', ' + (x2 - cpOffset) + ' ' + y2 +
                       ', ' + x2 + ' ' + y2;

            var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathD);

            // Check if the successor task is overdue
            var toTask = state.filteredTasks.find(function (t) { return t.id === toId; });
            var isOverdue = toTask && toTask.isOverdue;

            path.setAttribute('class', 'om-dep-line' + (isOverdue ? ' om-dep-overdue' : ''));
            path.setAttribute('marker-end', isOverdue ? 'url(#om-arrow-red)' : 'url(#om-arrow)');

            svg.appendChild(path);
        });
    }

    // ================================
    // RENDER: UNSCHEDULED
    // ================================

    function renderUnscheduled() {
        var unscheduled = state.filteredTasks.filter(function (t) { return !t.isScheduled; });

        if (unscheduled.length === 0) {
            els.unscheduled.style.display = 'none';
            return;
        }

        els.unscheduled.style.display = 'block';
        els.unscheduledCount.textContent = unscheduled.length;

        if (state.unscheduledCollapsed) {
            els.unscheduled.classList.add('om-collapsed');
        } else {
            els.unscheduled.classList.remove('om-collapsed');
        }

        var html = '';
        unscheduled.forEach(function (task) {
            var statusCls = STATUS_CLASSES[task.statusName] || '';
            var borderColor = STATUS_COLORS_MAP[task.statusName] || '#6b7280';
            html += '<div class="om-unsched-card" data-task-id="' + task.id + '" style="border-left-color:' + borderColor + ';">' +
                '<div>' +
                    '<div class="om-unsched-card-title">' + escapeHtml(task.description) + '</div>' +
                    '<div class="om-unsched-card-project">' + escapeHtml(task.projectName) + '</div>' +
                '</div>' +
            '</div>';
        });

        els.unscheduledGrid.innerHTML = html;
    }

    // ================================
    // SCROLL SYNC
    // ================================

    function setupScrollSync() {
        if (!els.grid) return;

        els.grid.addEventListener('scroll', function () {
            // Sync header horizontal position
            els.headerDates.style.transform = 'translateX(-' + els.grid.scrollLeft + 'px)';

            // Sync row labels vertical position
            var labelsInner = els.rowLabels.querySelector('.om-row-labels-inner');
            if (labelsInner) {
                labelsInner.style.transform = 'translateY(-' + els.grid.scrollTop + 'px)';
            }
        });
    }

    // ================================
    // TOOLBAR EVENTS
    // ================================

    function setupToolbarEvents() {
        // Zoom buttons
        document.querySelectorAll('[data-zoom]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setZoom(btn.dataset.zoom);
            });
        });

        // Group buttons
        document.querySelectorAll('[data-group]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setGroupBy(btn.dataset.group);
            });
        });

        // Today button
        var btnToday = document.getElementById('btnScrollToday');
        if (btnToday) btnToday.addEventListener('click', scrollToToday);

        // Filter toggle
        var btnFilter = document.getElementById('btnFilter');
        if (btnFilter) {
            btnFilter.addEventListener('click', function (e) {
                e.stopPropagation();
                els.filterMenu.classList.toggle('open');
            });
        }

        // Close filter on outside click
        document.addEventListener('click', function (e) {
            if (!e.target.closest('#omFilterDropdown')) {
                if (els.filterMenu) els.filterMenu.classList.remove('open');
            }
        });

        // Filter reset
        var btnReset = document.getElementById('btnResetFilters');
        if (btnReset) {
            btnReset.addEventListener('click', function () {
                state.filters.statuses = [...DEFAULT_STATUSES];
                state.filters.projectId = '';
                state.filters.personId = '';
                populateFilterDropdowns();
                if (els.filterProject) els.filterProject.value = '';
                if (els.filterPerson) els.filterPerson.value = '';
                onFilterChange();
            });
        }

        // Status checkboxes (delegated)
        if (els.filterStatusList) {
            els.filterStatusList.addEventListener('change', function (e) {
                var cb = e.target;
                if (!cb.dataset.status) return;
                var s = cb.dataset.status;
                if (cb.checked) {
                    if (!state.filters.statuses.includes(s)) state.filters.statuses.push(s);
                } else {
                    state.filters.statuses = state.filters.statuses.filter(function (x) { return x !== s; });
                }
                onFilterChange();
            });
        }

        // Project filter
        if (els.filterProject) {
            els.filterProject.addEventListener('change', function () {
                state.filters.projectId = els.filterProject.value;
                onFilterChange();
            });
        }

        // Person filter
        if (els.filterPerson) {
            els.filterPerson.addEventListener('change', function () {
                state.filters.personId = els.filterPerson.value;
                onFilterChange();
            });
        }

        // Capacity button
        var btnCapacity = document.getElementById('btnCapacity');
        if (btnCapacity) btnCapacity.addEventListener('click', openCapacityModal);

        // Capacity modal close
        var btnCapClose = document.getElementById('btnCapacityClose');
        var btnCapCancel = document.getElementById('btnCapacityCancel');
        if (btnCapClose) btnCapClose.addEventListener('click', closeCapacityModal);
        if (btnCapCancel) btnCapCancel.addEventListener('click', closeCapacityModal);

        var btnCapSave = document.getElementById('btnCapacitySave');
        if (btnCapSave) btnCapSave.addEventListener('click', saveCapacitySettings);

        // Close modal on overlay click
        if (els.capacityModal) {
            els.capacityModal.addEventListener('click', function (e) {
                if (e.target === els.capacityModal) closeCapacityModal();
            });
        }

        // Task panel close
        var btnPanelClose = document.getElementById('btnPanelClose');
        if (btnPanelClose) btnPanelClose.addEventListener('click', closeTaskPanel);

        // Unscheduled toggle
        if (els.unscheduledToggle) {
            els.unscheduledToggle.addEventListener('click', function () {
                state.unscheduledCollapsed = !state.unscheduledCollapsed;
                savePref('om_unsched_collapsed', state.unscheduledCollapsed);
                if (state.unscheduledCollapsed) {
                    els.unscheduled.classList.add('om-collapsed');
                } else {
                    els.unscheduled.classList.remove('om-collapsed');
                }
            });
        }
    }

    // ================================
    // GRID EVENTS (card clicks)
    // ================================

    function setupGridEvents() {
        // Delegated click on cards container
        if (els.cardsContainer) {
            els.cardsContainer.addEventListener('click', function (e) {
                var card = e.target.closest('.om-task-card');
                if (card) openTaskPanel(card.dataset.taskId);
            });
        }

        // Delegated click on unscheduled cards
        if (els.unscheduledGrid) {
            els.unscheduledGrid.addEventListener('click', function (e) {
                var card = e.target.closest('.om-unsched-card');
                if (card) openTaskPanel(card.dataset.taskId);
            });
        }
    }

    // ================================
    // ZOOM
    // ================================

    function setZoom(level) {
        if (state.zoomLevel === level) return;

        // Remember center date
        var centerX = els.grid.scrollLeft + els.grid.clientWidth / 2;
        var msFromStart = (centerX / ZOOM_CONFIG[state.zoomLevel].pxPerDay) * 86400000;
        var centerDate = new Date(state.timeRange.start.getTime() + msFromStart);

        state.zoomLevel = level;
        savePref('om_zoom', level);

        updateToggleButtons('[data-zoom]', level);
        computeTimeRange();
        renderAll();

        // Scroll to keep same date centered
        var newX = dateToX(centerDate);
        els.grid.scrollLeft = Math.max(0, newX - els.grid.clientWidth / 2);
    }

    // ================================
    // GROUP BY
    // ================================

    function setGroupBy(mode) {
        if (state.groupBy === mode) return;
        state.groupBy = mode;
        savePref('om_groupBy', mode);

        updateToggleButtons('[data-group]', mode);
        computeRows();
        renderAll();
    }

    // ================================
    // FILTER CHANGE
    // ================================

    function onFilterChange() {
        savePref('om_filters', state.filters);
        applyFilters();
        computeTimeRange();
        computeRows();
        renderAll();
    }

    // ================================
    // SCROLL TO TODAY
    // ================================

    function scrollToToday() {
        if (!els.grid) return;
        var now = new Date();
        var x = dateToX(now);
        els.grid.scrollLeft = Math.max(0, x - els.grid.clientWidth / 3);
    }

    // ================================
    // CAPACITY MODAL
    // ================================

    function openCapacityModal() {
        var html = '<div class="om-cap-row" style="font-weight:600;color:var(--text-secondary);font-size:11px;">' +
            '<div>Team Member</div><div style="text-align:center;">Hours/Day</div><div style="text-align:center;">Days/Week</div>' +
            '</div>';

        state.users.forEach(function (u) {
            var userId = u.user_id || u.id;
            var userName = u.user_name || u.name || 'Unknown';

            var wl = state.teamWorkload.find(function (w) { return w.user_id === userId; });
            var hpd = (wl && wl.capacity && wl.capacity.hours_per_day) || 8;
            var dpw = (wl && wl.capacity && wl.capacity.days_per_week) || 5;

            var avatarHue = hashStringToHue(userId || userName);
            var initial = (userName || '?')[0].toUpperCase();

            html += '<div class="om-cap-row" data-user-id="' + userId + '">' +
                '<div class="om-cap-user">' +
                    '<span class="om-row-avatar" style="width:24px;height:24px;font-size:10px;background:hsl(' + avatarHue + ',70%,45%);">' + initial + '</span>' +
                    '<span class="om-cap-user-name">' + escapeHtml(userName) + '</span>' +
                '</div>' +
                '<div><input type="number" class="om-cap-input om-cap-hours" value="' + hpd + '" min="1" max="24" step="0.5"></div>' +
                '<div><input type="number" class="om-cap-input om-cap-days" value="' + dpw + '" min="1" max="7" step="1"></div>' +
            '</div>';
        });

        els.capacityBody.innerHTML = html;
        els.capacityModal.style.display = 'flex';
    }

    function closeCapacityModal() {
        els.capacityModal.style.display = 'none';
    }

    async function saveCapacitySettings() {
        var rows = els.capacityBody.querySelectorAll('.om-cap-row[data-user-id]');
        var promises = [];

        rows.forEach(function (row) {
            var userId = row.dataset.userId;
            var hours = parseFloat(row.querySelector('.om-cap-hours').value) || 8;
            var days = parseInt(row.querySelector('.om-cap-days').value, 10) || 5;

            promises.push(
                fetch(API_BASE + '/pipeline/workload/capacity/' + userId, {
                    method: 'PUT',
                    headers: Object.assign({}, getAuthHeaders(), { 'Content-Type': 'application/json' }),
                    body: JSON.stringify({ hours_per_day: hours, days_per_week: days }),
                }).catch(function (err) {
                    console.warn('[OM] Failed to save capacity for', userId, err);
                })
            );
        });

        try {
            await Promise.all(promises);
            await loadTeamWorkload();
            computeRows();
            renderRowLabels();
            closeCapacityModal();
            if (window.Toast) window.Toast.success('Capacity settings saved');
        } catch (err) {
            console.error('[OM] Capacity save error:', err);
            if (window.Toast) window.Toast.error('Failed to save capacity settings');
        }
    }

    // ================================
    // TASK DETAIL PANEL
    // ================================

    function openTaskPanel(taskId) {
        var task = state.allTasks.find(function (t) { return t.id === taskId; });
        if (!task) return;

        state.selectedTaskId = taskId;

        var statusColor = STATUS_COLORS_MAP[task.statusName] || '#6b7280';
        var priorityName = task.priority ? (task.priority.priority_name || 'Medium') : 'Medium';
        var priorityColor = PRIORITY_COLORS[(priorityName || '').toLowerCase()] || PRIORITY_COLORS.medium;

        var html = '<div class="om-panel-desc">' + escapeHtml(task.description) + '</div>';

        html += '<div class="om-panel-section">' +
            '<div class="om-panel-section-title">Details</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Status</span>' +
                '<span class="om-panel-status-badge" style="background:' + statusColor + '20;color:' + statusColor + ';">' +
                    capitalize(task.statusName) +
                '</span>' +
            '</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Priority</span>' +
                '<span class="om-panel-field-value" style="color:' + priorityColor + ';">' + capitalize(priorityName) + '</span>' +
            '</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Project</span>' +
                '<span class="om-panel-field-value">' + escapeHtml(task.projectName) + '</span>' +
            '</div>' +
            (task.estimatedHours ? '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Estimated</span>' +
                '<span class="om-panel-field-value">' + task.estimatedHours + 'h</span>' +
            '</div>' : '') +
        '</div>';

        // Dates
        html += '<div class="om-panel-section">' +
            '<div class="om-panel-section-title">Dates</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Start</span>' +
                '<span class="om-panel-field-value">' + formatDateFull(task.startDate) + '</span>' +
            '</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Due</span>' +
                '<span class="om-panel-field-value">' + formatDateFull(task.dueDate || task.endDate) + '</span>' +
            '</div>' +
            (task.deadline ? '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Deadline</span>' +
                '<span class="om-panel-field-value" style="color:var(--color-danger);">' + formatDateFull(task.deadline) + '</span>' +
            '</div>' : '') +
        '</div>';

        // People
        html += '<div class="om-panel-section">' +
            '<div class="om-panel-section-title">People</div>' +
            '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Owner</span>' +
                '<span class="om-panel-field-value">' + (task.owner ? escapeHtml(task.owner.name) : 'Unassigned') + '</span>' +
            '</div>';

        if (task.collaborators.length > 0) {
            var collabNames = task.collaborators.map(function (c) { return escapeHtml(c.name || 'Unknown'); }).join(', ');
            html += '<div class="om-panel-field">' +
                '<span class="om-panel-field-label">Collaborators</span>' +
                '<span class="om-panel-field-value">' + collabNames + '</span>' +
            '</div>';
        }

        html += '</div>';

        // Pipeline link
        html += '<div class="om-panel-section">' +
            '<a href="pipeline.html" class="om-panel-link">' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
                'Open in Pipeline Manager' +
            '</a>' +
        '</div>';

        els.panelBody.innerHTML = html;
        els.taskPanel.classList.add('om-panel-open');
    }

    function closeTaskPanel() {
        els.taskPanel.classList.remove('om-panel-open');
        state.selectedTaskId = null;
    }

    // ================================
    // UI HELPERS
    // ================================

    function updateToggleButtons(selector, activeValue) {
        document.querySelectorAll(selector).forEach(function (btn) {
            var val = btn.dataset.zoom || btn.dataset.group;
            btn.classList.toggle('om-btn-active', val === activeValue);
        });
    }

    // ================================
    // PREFERENCES
    // ================================

    function loadSavedPrefs() {
        state.zoomLevel = loadPref('om_zoom', 'week');
        state.groupBy = loadPref('om_groupBy', 'person');
        state.unscheduledCollapsed = loadPref('om_unsched_collapsed', false);

        var savedFilters = loadPref('om_filters', null);
        if (savedFilters && savedFilters.statuses) {
            state.filters = savedFilters;
        }

        // Set active buttons
        requestAnimationFrame(function () {
            updateToggleButtons('[data-zoom]', state.zoomLevel);
            updateToggleButtons('[data-group]', state.groupBy);
        });
    }

    function savePref(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) { /* ignore */ }
    }

    function loadPref(key, defaultValue) {
        try {
            var v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : defaultValue;
        } catch (e) { return defaultValue; }
    }

    // ================================
    // HELPERS
    // ================================

    var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function hashStringToHue(str) {
        if (!str) return 200;
        var h = 0;
        for (var i = 0; i < str.length; i++) {
            h = str.charCodeAt(i) + ((h << 5) - h);
        }
        return Math.abs(h) % 360;
    }

    function parseDate(str) {
        if (!str) return null;
        var d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }

    function isSameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    }

    function capitalize(str) {
        if (!str) return '';
        return str.split(' ').map(function (w) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
    }

    function formatDateFull(date) {
        if (!date) return '-';
        return MONTHS_SHORT[date.getMonth()] + ' ' + date.getDate() + ', ' + date.getFullYear();
    }

    // ================================
    // BOOTSTRAP
    // ================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
