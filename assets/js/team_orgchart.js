// assets/js/team_orgchart.js
// Org Chart canvas for Team Management — reuses Process Manager visual patterns
(function () {
    'use strict';

    const GRID_SIZE = 8000;
    const SNAP_THRESHOLD = 12;

    // API persistence (same pattern as process_manager.js)
    const API_BASE = window.API_BASE || 'https://ngm-fastapi.onrender.com';
    const STATE_KEYS = {
        positions:   'orgchart_positions',
        connections: 'orgchart_connections',
        groups:      'orgchart_groups',
    };
    // localStorage keys (used as cache / fallback)
    const LS_KEYS = {
        positions:   'ngm_orgchart_positions',
        connections: 'ngm_orgchart_connections',
        groups:      'ngm_orgchart_groups',
    };
    const saveTimers = {};

    const GROUP_COLORS = [
        { id: 'green',  bg: 'rgba(62, 207, 142, 0.06)',  border: 'rgba(62, 207, 142, 0.18)' },
        { id: 'blue',   bg: 'rgba(96, 165, 250, 0.06)',  border: 'rgba(96, 165, 250, 0.18)' },
        { id: 'purple', bg: 'rgba(167, 139, 250, 0.06)', border: 'rgba(167, 139, 250, 0.18)' },
        { id: 'amber',  bg: 'rgba(245, 158, 11, 0.06)',  border: 'rgba(245, 158, 11, 0.18)' },
        { id: 'red',    bg: 'rgba(239, 68, 68, 0.06)',   border: 'rgba(239, 68, 68, 0.18)' },
        { id: 'cyan',   bg: 'rgba(34, 211, 238, 0.06)',  border: 'rgba(34, 211, 238, 0.18)' },
        { id: 'pink',   bg: 'rgba(244, 114, 182, 0.06)', border: 'rgba(244, 114, 182, 0.18)' },
        { id: 'gray',   bg: 'rgba(156, 163, 175, 0.06)', border: 'rgba(156, 163, 175, 0.18)' },
    ];

    // ================================
    // State
    // ================================
    const state = {
        users: [],
        canvas: {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            minScale: 0.2,
            maxScale: 2,
        },
        nodePositions: {},
        connections: [],       // { id, sourceId, sourcePort, targetId, targetPort }
        connectionDrag: {
            active: false,
            sourceId: null,
            sourcePort: null,
            startPoint: null,
        },
        groups: [],            // { id, x, y, w, h, colorId, label }
        groupDraw: {
            active: false,
            startX: 0,
            startY: 0,
            previewEl: null,
        },
        ctxMenu: null,         // context menu DOM element
        ctxGroupId: null,      // group id if right-clicked on a group
    };

    // ================================
    // DOM refs (populated on init)
    // ================================
    let els = {};

    // ================================
    // Persistence — API (source of truth) + localStorage (cache)
    // Same pattern as process_manager.js saveStateToSupabase / loadStateFromSupabase
    // ================================

    function getCurrentUserId() {
        try {
            const raw = localStorage.getItem('ngmUser');
            if (raw) { const u = JSON.parse(raw); return u.user_id || u.id || null; }
        } catch (_) { /* ignore */ }
        return null;
    }

    // --- Generic API load ---
    async function loadStateFromApi(stateKey, defaultValue) {
        const url = `${API_BASE}/process-manager/state/${stateKey}`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                return { success: true, data: data.state_data || defaultValue, error: null };
            }
            if (res.status === 404) {
                // First time — no data yet, not an error
                return { success: true, data: defaultValue, error: null };
            }
            const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
            return { success: false, data: defaultValue, error: `HTTP ${res.status}: ${err.detail || 'Server error'}` };
        } catch (e) {
            return { success: false, data: defaultValue, error: e.message || 'Network error' };
        }
    }

    // --- Generic API save (debounced) ---
    function saveStateToApi(stateKey, data, delay) {
        if (delay === undefined) delay = 1000;
        if (saveTimers[stateKey]) clearTimeout(saveTimers[stateKey]);

        saveTimers[stateKey] = setTimeout(async () => {
            const url = `${API_BASE}/process-manager/state/${stateKey}`;
            try {
                const payload = { state_data: data, updated_by: getCurrentUserId() };
                const res = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                    throw new Error(err.detail || `HTTP ${res.status}`);
                }
                console.log(`[ORGCHART] Saved ${stateKey} to API`);
            } catch (e) {
                console.error(`[ORGCHART] Error saving ${stateKey}:`, e);
                if (window.Toast) {
                    window.Toast.warning(`Failed to sync ${stateKey.replace(/_/g, ' ')} to server.`);
                }
            }
        }, delay);
    }

    // --- Load from localStorage (cache fallback) ---
    function loadFromCache(lsKey, defaultValue) {
        try {
            const raw = localStorage.getItem(lsKey);
            if (raw) return JSON.parse(raw);
        } catch (_) { /* ignore */ }
        return defaultValue;
    }

    function saveToCache(lsKey, data) {
        try { localStorage.setItem(lsKey, JSON.stringify(data)); } catch (_) { /* ignore */ }
    }

    // --- High-level load (API first, fallback to cache) ---
    async function loadPositions() {
        const result = await loadStateFromApi(STATE_KEYS.positions, {});
        if (result.success && Object.keys(result.data).length > 0) {
            state.nodePositions = result.data;
            saveToCache(LS_KEYS.positions, state.nodePositions);
        } else {
            // API failed or empty — use localStorage cache
            state.nodePositions = loadFromCache(LS_KEYS.positions, {});
            if (result.error) console.warn('[ORGCHART] Positions loaded from cache:', result.error);
        }
    }

    async function loadConnections() {
        const result = await loadStateFromApi(STATE_KEYS.connections, []);
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            state.connections = result.data;
            saveToCache(LS_KEYS.connections, state.connections);
        } else {
            state.connections = loadFromCache(LS_KEYS.connections, []);
            if (result.error) console.warn('[ORGCHART] Connections loaded from cache:', result.error);
        }
    }

    async function loadGroups() {
        const result = await loadStateFromApi(STATE_KEYS.groups, []);
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            state.groups = result.data;
            saveToCache(LS_KEYS.groups, state.groups);
        } else {
            state.groups = loadFromCache(LS_KEYS.groups, []);
            if (result.error) console.warn('[ORGCHART] Groups loaded from cache:', result.error);
        }
    }

    // --- High-level save (cache immediately + API debounced) ---
    function savePositions() {
        saveToCache(LS_KEYS.positions, state.nodePositions);
        saveStateToApi(STATE_KEYS.positions, state.nodePositions);
    }

    function saveConnections() {
        saveToCache(LS_KEYS.connections, state.connections);
        saveStateToApi(STATE_KEYS.connections, state.connections);
    }

    function saveGroups() {
        saveToCache(LS_KEYS.groups, state.groups);
        saveStateToApi(STATE_KEYS.groups, state.groups);
    }

    function getGroupColor(colorId) {
        return GROUP_COLORS.find(c => c.id === colorId) || GROUP_COLORS[0];
    }

    // ================================
    // Helpers
    // ================================
    function escapeHtml(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getInitial(name) {
        const s = String(name || '').trim();
        return s ? s[0].toUpperCase() : '?';
    }

    function stableHue(str) {
        const s = String(str || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h % 360;
    }

    function userColor(u) {
        const ac = Number(u.avatar_color);
        const hue = Number.isFinite(ac) ? Math.max(0, Math.min(360, ac)) : stableHue(u.user_id || u.user_name);
        return `hsl(${hue} 70% 45%)`;
    }

    function getNodePos(userId) {
        return state.nodePositions[userId] || null;
    }

    function roleWeight(role) {
        const w = {
            'ceo': 0, 'coo': 1, 'cfo': 2, 'cto': 3,
            'general coordinator': 4, 'project coordinator': 5,
            'senior': 6, 'coordinator': 7,
        };
        return w[String(role || '').toLowerCase()] ?? 10;
    }

    // ================================
    // Default layout: tiered grid by role
    // ================================
    function computeDefaultPositions(users) {
        const sorted = [...users].sort((a, b) => {
            const ra = a.user_role_name || a.role?.name || '';
            const rb = b.user_role_name || b.role?.name || '';
            return roleWeight(ra) - roleWeight(rb);
        });

        // Group by role
        const groups = [];
        let current = null;
        sorted.forEach(u => {
            const r = u.user_role_name || u.role?.name || '-';
            if (!current || current.role !== r) {
                current = { role: r, users: [] };
                groups.push(current);
            }
            current.users.push(u);
        });

        const nodeW = 220;
        const gapX = 60;
        const gapY = 100;
        const startX = 400;
        let y = 300;

        groups.forEach(g => {
            const totalW = g.users.length * nodeW + (g.users.length - 1) * gapX;
            let x = startX + (GRID_SIZE / 4 - totalW) / 2;
            if (x < startX) x = startX;

            g.users.forEach(u => {
                if (!state.nodePositions[u.user_id]) {
                    state.nodePositions[u.user_id] = { x, y };
                }
                x += nodeW + gapX;
            });

            y += gapY + 120;
        });
    }

    // ================================
    // Canvas transform
    // ================================
    function applyTransform() {
        if (!els.grid) return;
        constrainBounds();
        els.grid.style.transform = `translate(${state.canvas.offsetX}px, ${state.canvas.offsetY}px) scale(${state.canvas.scale})`;
        updateZoomLabel();
        updateMinimap();
    }

    function constrainBounds() {
        if (!els.container) return;
        const cr = els.container.getBoundingClientRect();
        const vw = cr.width, vh = cr.height;
        const sw = GRID_SIZE * state.canvas.scale;
        const sh = GRID_SIZE * state.canvas.scale;

        let minX, maxX, minY, maxY;
        if (sw >= vw) { maxX = 0; minX = -(sw - vw); } else { minX = maxX = (vw - sw) / 2; }
        if (sh >= vh) { maxY = 0; minY = -(sh - vh); } else { minY = maxY = (vh - sh) / 2; }

        state.canvas.offsetX = Math.max(minX, Math.min(maxX, state.canvas.offsetX));
        state.canvas.offsetY = Math.max(minY, Math.min(maxY, state.canvas.offsetY));
    }

    function zoomAtPoint(delta, px, py) {
        const old = state.canvas.scale;
        const next = Math.max(state.canvas.minScale, Math.min(state.canvas.maxScale, old + delta));
        if (next === old) return;
        const ratio = next / old;
        state.canvas.offsetX = px - (px - state.canvas.offsetX) * ratio;
        state.canvas.offsetY = py - (py - state.canvas.offsetY) * ratio;
        state.canvas.scale = next;
        applyTransform();
    }

    function updateZoomLabel() {
        const lbl = els.zoomLevel;
        if (lbl) lbl.textContent = Math.round(state.canvas.scale * 100) + '%';
    }

    function fitToContent() {
        if (!els.container || (state.users.length === 0 && state.groups.length === 0)) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        state.users.forEach(u => {
            const p = getNodePos(u.user_id);
            if (!p) return;
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x + 220);
            maxY = Math.max(maxY, p.y + 120);
        });
        state.groups.forEach(g => {
            minX = Math.min(minX, g.x);
            minY = Math.min(minY, g.y);
            maxX = Math.max(maxX, g.x + g.w);
            maxY = Math.max(maxY, g.y + g.h);
        });

        if (!isFinite(minX)) return;

        const cr = els.container.getBoundingClientRect();
        const pad = 80;
        const cw = maxX - minX + pad * 2;
        const ch = maxY - minY + pad * 2;
        const scale = Math.max(state.canvas.minScale, Math.min(1, Math.min(cr.width / cw, cr.height / ch)));

        state.canvas.scale = scale;
        state.canvas.offsetX = (cr.width - cw * scale) / 2 - (minX - pad) * scale;
        state.canvas.offsetY = (cr.height - ch * scale) / 2 - (minY - pad) * scale;
        applyTransform();
    }

    // ================================
    // Snap guides
    // ================================
    function calcSnap(draggedId, x, y, w, h) {
        let snapX = null, snapY = null;
        const guides = [];

        const dL = x, dR = x + w, dT = y, dB = y + h;
        const dCx = x + w / 2, dCy = y + h / 2;

        state.users.forEach(u => {
            if (u.user_id === draggedId) return;
            const p = getNodePos(u.user_id);
            if (!p) return;
            const tw = 220, th = 120; // approx node dims
            const tL = p.x, tR = p.x + tw, tT = p.y, tB = p.y + th;
            const tCx = p.x + tw / 2, tCy = p.y + th / 2;

            // Horizontal snaps
            if (Math.abs(dL - tL) < SNAP_THRESHOLD) { snapX = tL; guides.push({ type: 'vertical', position: tL }); }
            if (Math.abs(dR - tR) < SNAP_THRESHOLD) { snapX = tR - w; guides.push({ type: 'vertical', position: tR }); }
            if (Math.abs(dCx - tCx) < SNAP_THRESHOLD) { snapX = tCx - w / 2; guides.push({ type: 'vertical', position: tCx }); }
            // Vertical snaps
            if (Math.abs(dT - tT) < SNAP_THRESHOLD) { snapY = tT; guides.push({ type: 'horizontal', position: tT }); }
            if (Math.abs(dB - tB) < SNAP_THRESHOLD) { snapY = tB - h; guides.push({ type: 'horizontal', position: tB }); }
            if (Math.abs(dCy - tCy) < SNAP_THRESHOLD) { snapY = tCy - h / 2; guides.push({ type: 'horizontal', position: tCy }); }
        });

        return { snapX, snapY, guides };
    }

    function renderSnapGuides(guides) {
        if (!els.snapGuides) return;
        els.snapGuides.innerHTML = '';
        const seen = new Set();
        guides.forEach(g => {
            const key = g.type + '-' + Math.round(g.position);
            if (seen.has(key)) return;
            seen.add(key);
            const el = document.createElement('div');
            el.className = 'orgchart-snap-guide ' + g.type;
            if (g.type === 'horizontal') el.style.top = g.position + 'px';
            else el.style.left = g.position + 'px';
            els.snapGuides.appendChild(el);
        });
    }

    function clearSnapGuides() {
        if (els.snapGuides) els.snapGuides.innerHTML = '';
    }

    // ================================
    // Connection path math
    // ================================
    function getPortPoint(rect, port) {
        switch (port) {
            case 'top':    return { x: rect.x + rect.w / 2, y: rect.y };
            case 'bottom': return { x: rect.x + rect.w / 2, y: rect.y + rect.h };
            case 'left':   return { x: rect.x, y: rect.y + rect.h / 2 };
            case 'right':  return { x: rect.x + rect.w, y: rect.y + rect.h / 2 };
            default:       return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
        }
    }

    function extendFromPort(pt, port, dist) {
        switch (port) {
            case 'top':    return { x: pt.x, y: pt.y - dist };
            case 'bottom': return { x: pt.x, y: pt.y + dist };
            case 'left':   return { x: pt.x - dist, y: pt.y };
            case 'right':  return { x: pt.x + dist, y: pt.y };
            default:       return { ...pt };
        }
    }

    function calcPortPath(srcRect, tgtRect, srcPort, tgtPort) {
        const from = getPortPoint(srcRect, srcPort);
        const to = getPortPoint(tgtRect, tgtPort);
        const OFF = 30;
        const fe = extendFromPort(from, srcPort, OFF);
        const te = extendFromPort(to, tgtPort, OFF);

        const sH = srcPort === 'left' || srcPort === 'right';
        const tH = tgtPort === 'left' || tgtPort === 'right';
        let pts;

        if (sH && tH) {
            const mx = (fe.x + te.x) / 2;
            pts = [from, fe, { x: mx, y: fe.y }, { x: mx, y: te.y }, te, to];
        } else if (!sH && !tH) {
            const my = (fe.y + te.y) / 2;
            pts = [from, fe, { x: fe.x, y: my }, { x: te.x, y: my }, te, to];
        } else if (sH && !tH) {
            pts = [from, fe, { x: te.x, y: fe.y }, te, to];
        } else {
            pts = [from, fe, { x: fe.x, y: te.y }, te, to];
        }

        return simplifyPts(pts);
    }

    function calcAutoPath(srcRect, tgtRect) {
        const sCx = srcRect.x + srcRect.w / 2, sCy = srcRect.y + srcRect.h / 2;
        const tCx = tgtRect.x + tgtRect.w / 2, tCy = tgtRect.y + tgtRect.h / 2;
        const dx = tCx - sCx, dy = tCy - sCy;

        let fx, fy, tx, ty;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) { fx = srcRect.x + srcRect.w; tx = tgtRect.x; } else { fx = srcRect.x; tx = tgtRect.x + tgtRect.w; }
            fy = sCy; ty = tCy;
        } else {
            if (dy > 0) { fy = srcRect.y + srcRect.h; ty = tgtRect.y; } else { fy = srcRect.y; ty = tgtRect.y + tgtRect.h; }
            fx = sCx; tx = tCx;
        }
        const mx = (fx + tx) / 2, my = (fy + ty) / 2;
        if (Math.abs(dx) > Math.abs(dy)) {
            return [{ x: fx, y: fy }, { x: mx, y: fy }, { x: mx, y: ty }, { x: tx, y: ty }];
        }
        return [{ x: fx, y: fy }, { x: fx, y: my }, { x: tx, y: my }, { x: tx, y: ty }];
    }

    function simplifyPts(pts) {
        if (pts.length <= 2) return pts;
        const r = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const p = r[r.length - 1], c = pts[i], n = pts[i + 1];
            if (Math.abs(c.x - p.x) < 0.5 && Math.abs(c.y - p.y) < 0.5) continue;
            const sx = Math.abs(p.x - c.x) < 0.5 && Math.abs(c.x - n.x) < 0.5;
            const sy = Math.abs(p.y - c.y) < 0.5 && Math.abs(c.y - n.y) < 0.5;
            if (sx || sy) continue;
            r.push(c);
        }
        r.push(pts[pts.length - 1]);
        return r;
    }

    function buildSVGPath(points) {
        let d = `M ${points[0].x} ${points[0].y}`;
        const R = 12;
        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1], curr = points[i], next = points[i + 1];
            if (next && i < points.length - 1) {
                const dx1 = curr.x - prev.x, dy1 = curr.y - prev.y;
                const dx2 = next.x - curr.x, dy2 = next.y - curr.y;
                const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (l1 > 0 && l2 > 0) {
                    const r = Math.min(R, l1 / 2, l2 / 2);
                    const sx = curr.x - (dx1 / l1) * r, sy = curr.y - (dy1 / l1) * r;
                    const ex = curr.x + (dx2 / l2) * r, ey = curr.y + (dy2 / l2) * r;
                    d += ` L ${sx} ${sy} Q ${curr.x} ${curr.y} ${ex} ${ey}`;
                } else {
                    d += ` L ${curr.x} ${curr.y}`;
                }
            } else {
                d += ` L ${curr.x} ${curr.y}`;
            }
        }
        return d;
    }

    // ================================
    // Get node rect from DOM or stored position
    // ================================
    function getNodeRect(userId) {
        const p = getNodePos(userId);
        if (!p) return null;
        return { x: p.x, y: p.y, w: 220, h: 0 };
    }

    function getNodeRectFromDOM(userId) {
        const el = els.nodes?.querySelector(`[data-user-id="${userId}"]`);
        if (!el) return getNodeRect(userId);
        const gridBCR = els.grid.getBoundingClientRect();
        const s = state.canvas.scale;
        const bcr = el.getBoundingClientRect();
        if (bcr.width > 0 && bcr.height > 0) {
            return {
                x: (bcr.left - gridBCR.left) / s,
                y: (bcr.top - gridBCR.top) / s,
                w: bcr.width / s,
                h: bcr.height / s,
            };
        }
        const p = getNodePos(userId);
        return { x: p?.x || 0, y: p?.y || 0, w: el.offsetWidth || 220, h: el.offsetHeight || 120 };
    }

    // ================================
    // Draw connections
    // ================================
    function redrawConnections() {
        if (!els.connectionsLayer) return;
        els.connectionsLayer.innerHTML = '';

        state.connections.forEach(conn => {
            const srcRect = getNodeRectFromDOM(conn.sourceId);
            const tgtRect = getNodeRectFromDOM(conn.targetId);
            if (!srcRect || !tgtRect) return;

            let points;
            if (conn.sourcePort && conn.targetPort) {
                points = calcPortPath(srcRect, tgtRect, conn.sourcePort, conn.targetPort);
            } else {
                points = calcAutoPath(srcRect, tgtRect);
            }

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'orgchart-connection-group');
            g.setAttribute('data-conn-id', conn.id);

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', buildSVGPath(points));
            path.setAttribute('class', 'orgchart-connection-path animated');
            path.setAttribute('stroke', '#3ecf8e');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-width', '2');
            g.appendChild(path);

            // Endpoint dots
            [points[0], points[points.length - 1]].forEach(pt => {
                const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c.setAttribute('cx', pt.x);
                c.setAttribute('cy', pt.y);
                c.setAttribute('r', '4');
                c.setAttribute('class', 'orgchart-connection-endpoint');
                g.appendChild(c);
            });

            els.connectionsLayer.appendChild(g);
        });

        // Temp connection line if dragging
        if (state.connectionDrag.active && state.connectionDrag.tempLine) {
            els.connectionsLayer.appendChild(state.connectionDrag.tempLine);
        }
    }

    // ================================
    // Create nodes
    // ================================
    function createNodeEl(u) {
        const div = document.createElement('div');
        div.className = 'orgchart-node';
        div.setAttribute('data-user-id', u.user_id);

        const roleName = u.user_role_name || u.role?.name || '-';
        const seniorityName = u.user_seniority_name || u.seniority?.name || '';
        const statusName = u.user_status_name || u.status?.name || '';
        const statusActive = String(statusName).toLowerCase() === 'active';
        const color = u.color || userColor(u);
        const initial = escapeHtml(getInitial(u.user_name));
        const safeName = escapeHtml(u.user_name);

        const avatarInner = u.user_photo
            ? `<img src="${escapeHtml(u.user_photo)}" alt="${safeName}" />`
            : initial;

        div.innerHTML = `
            <div class="orgchart-node-avatar" style="color:${color}; border-color:${color};">${avatarInner}</div>
            <div class="orgchart-node-name" title="${safeName}">
                ${safeName}
                <span class="orgchart-node-status ${statusActive ? 'is-active' : ''}" title="${escapeHtml(statusName)}"></span>
            </div>
            <div class="orgchart-node-role">${escapeHtml(roleName)}</div>
            ${seniorityName && seniorityName !== '-' ? `<div class="orgchart-node-seniority">${escapeHtml(seniorityName)}</div>` : ''}
            <div class="orgchart-port port-top" data-port="top"></div>
            <div class="orgchart-port port-bottom" data-port="bottom"></div>
            <div class="orgchart-port port-left" data-port="left"></div>
            <div class="orgchart-port port-right" data-port="right"></div>
        `;

        // Position
        const pos = getNodePos(u.user_id) || { x: 400, y: 400 };
        div.style.left = pos.x + 'px';
        div.style.top = pos.y + 'px';

        return div;
    }

    // ================================
    // Node dragging
    // ================================
    function makeDraggable(nodeEl, userId) {
        let dragging = false;
        let startX, startY, initX, initY;

        nodeEl.addEventListener('mousedown', e => {
            if (e.target.closest('.orgchart-port')) return;
            if (state.connectionDrag.active) return;
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initX = parseInt(nodeEl.style.left) || 0;
            initY = parseInt(nodeEl.style.top) || 0;

            nodeEl.classList.add('dragging');
            nodeEl.style.zIndex = '100';
        });

        const onMove = e => {
            if (!dragging) return;
            const dx = (e.clientX - startX) / state.canvas.scale;
            const dy = (e.clientY - startY) / state.canvas.scale;

            let nx = initX + dx, ny = initY + dy;
            const nw = nodeEl.offsetWidth || 220, nh = nodeEl.offsetHeight || 120;

            const snap = calcSnap(userId, nx, ny, nw, nh);
            if (snap.snapX !== null) nx = snap.snapX;
            if (snap.snapY !== null) ny = snap.snapY;

            if (snap.guides.length > 0) {
                renderSnapGuides(snap.guides);
                nodeEl.classList.add('snapping');
            } else {
                clearSnapGuides();
                nodeEl.classList.remove('snapping');
            }

            nodeEl.style.left = nx + 'px';
            nodeEl.style.top = ny + 'px';

            state.nodePositions[userId] = { x: nx, y: ny };
            redrawConnections();
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            nodeEl.classList.remove('dragging');
            nodeEl.classList.remove('snapping');
            nodeEl.style.zIndex = '';
            clearSnapGuides();
            savePositions();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ================================
    // Connection port drag
    // ================================
    function initPortDrag() {
        els.nodes.addEventListener('mousedown', e => {
            const port = e.target.closest('.orgchart-port');
            if (!port) return;
            e.preventDefault();
            e.stopPropagation();

            const nodeEl = port.closest('.orgchart-node');
            if (!nodeEl) return;

            const userId = nodeEl.getAttribute('data-user-id');
            const portSide = port.getAttribute('data-port');
            if (!userId || !portSide) return;

            const portBCR = port.getBoundingClientRect();
            const gridBCR = els.grid.getBoundingClientRect();
            const s = state.canvas.scale;

            const px = (portBCR.left + portBCR.width / 2 - gridBCR.left) / s;
            const py = (portBCR.top + portBCR.height / 2 - gridBCR.top) / s;

            state.connectionDrag.active = true;
            state.connectionDrag.sourceId = userId;
            state.connectionDrag.sourcePort = portSide;
            state.connectionDrag.startPoint = { x: px, y: py };

            els.container.classList.add('connecting-mode');
            port.classList.add('connected');

            // Mark valid targets
            els.nodes.querySelectorAll('.orgchart-node').forEach(n => {
                if (n.getAttribute('data-user-id') !== userId) {
                    n.classList.add('valid-drop-target');
                }
            });

            // Create temp line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'orgchart-temp-line');
            line.setAttribute('x1', px);
            line.setAttribute('y1', py);
            line.setAttribute('x2', px);
            line.setAttribute('y2', py);
            state.connectionDrag.tempLine = line;
            els.connectionsLayer.appendChild(line);
        });

        document.addEventListener('mousemove', e => {
            if (!state.connectionDrag.active || !state.connectionDrag.tempLine) return;

            const gridBCR = els.grid.getBoundingClientRect();
            const s = state.canvas.scale;
            const mx = (e.clientX - gridBCR.left) / s;
            const my = (e.clientY - gridBCR.top) / s;

            state.connectionDrag.tempLine.setAttribute('x2', mx);
            state.connectionDrag.tempLine.setAttribute('y2', my);
        });

        document.addEventListener('mouseup', e => {
            if (!state.connectionDrag.active) return;

            const targetPort = e.target.closest('.orgchart-port');
            const targetNode = targetPort ? targetPort.closest('.orgchart-node') : null;

            if (targetNode && targetPort) {
                const targetId = targetNode.getAttribute('data-user-id');
                const targetPortSide = targetPort.getAttribute('data-port');

                if (targetId && targetId !== state.connectionDrag.sourceId) {
                    // Check if connection already exists
                    const exists = state.connections.some(c =>
                        (c.sourceId === state.connectionDrag.sourceId && c.targetId === targetId) ||
                        (c.sourceId === targetId && c.targetId === state.connectionDrag.sourceId)
                    );

                    if (!exists) {
                        state.connections.push({
                            id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                            sourceId: state.connectionDrag.sourceId,
                            sourcePort: state.connectionDrag.sourcePort,
                            targetId: targetId,
                            targetPort: targetPortSide,
                        });
                        saveConnections();
                    }
                }
            }

            // Cleanup
            if (state.connectionDrag.tempLine && state.connectionDrag.tempLine.parentNode) {
                state.connectionDrag.tempLine.parentNode.removeChild(state.connectionDrag.tempLine);
            }
            state.connectionDrag.tempLine = null;
            state.connectionDrag.active = false;
            state.connectionDrag.sourceId = null;
            state.connectionDrag.sourcePort = null;
            state.connectionDrag.startPoint = null;

            els.container.classList.remove('connecting-mode');
            els.nodes.querySelectorAll('.valid-drop-target').forEach(n => n.classList.remove('valid-drop-target'));
            els.nodes.querySelectorAll('.orgchart-port.connected').forEach(p => p.classList.remove('connected'));

            redrawConnections();
        });
    }

    // ================================
    // Delete connection on double-click
    // ================================
    function initConnectionDelete() {
        els.connectionsLayer.style.pointerEvents = 'none';

        els.connectionsLayer.addEventListener('dblclick', e => {
            const group = e.target.closest('.orgchart-connection-group');
            if (!group) return;
            const connId = group.getAttribute('data-conn-id');
            state.connections = state.connections.filter(c => c.id !== connId);
            saveConnections();
            redrawConnections();
        });

        // Allow pointer events on paths for dblclick
        const observer = new MutationObserver(() => {
            els.connectionsLayer.querySelectorAll('.orgchart-connection-path').forEach(p => {
                p.style.pointerEvents = 'stroke';
            });
            els.connectionsLayer.querySelectorAll('.orgchart-connection-group').forEach(g => {
                g.style.pointerEvents = 'auto';
            });
        });
        observer.observe(els.connectionsLayer, { childList: true });
    }

    // ================================
    // Canvas pan & zoom
    // ================================
    function initCanvasInteraction() {
        // Pan via mouse drag
        els.container.addEventListener('mousedown', e => {
            if (state.connectionDrag.active) return;
            if (state.groupDraw.active) return;
            // Only pan if clicking on canvas background (not on nodes/groups)
            if (e.target.closest('.orgchart-node')) return;
            if (e.target.closest('.orgchart-group')) return;
            if (e.button !== 0 && e.button !== 1) return;
            e.preventDefault();

            state.canvas.isDragging = true;
            state.canvas.dragStart = { x: e.clientX, y: e.clientY };
        });

        document.addEventListener('mousemove', e => {
            if (!state.canvas.isDragging) return;
            const dx = e.clientX - state.canvas.dragStart.x;
            const dy = e.clientY - state.canvas.dragStart.y;
            state.canvas.offsetX += dx;
            state.canvas.offsetY += dy;
            state.canvas.dragStart = { x: e.clientX, y: e.clientY };
            applyTransform();
        });

        document.addEventListener('mouseup', () => {
            state.canvas.isDragging = false;
        });

        // Zoom via wheel
        els.container.addEventListener('wheel', e => {
            e.preventDefault();
            const cr = els.container.getBoundingClientRect();
            const px = e.clientX - cr.left;
            const py = e.clientY - cr.top;
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            zoomAtPoint(delta, px, py);
        }, { passive: false });

        // Zoom buttons
        const btnZoomIn = document.getElementById('orgchart-zoom-in');
        const btnZoomOut = document.getElementById('orgchart-zoom-out');
        const btnFit = document.getElementById('orgchart-fit');

        if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
            const cr = els.container.getBoundingClientRect();
            zoomAtPoint(0.15, cr.width / 2, cr.height / 2);
        });
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
            const cr = els.container.getBoundingClientRect();
            zoomAtPoint(-0.15, cr.width / 2, cr.height / 2);
        });
        if (btnFit) btnFit.addEventListener('click', fitToContent);
    }

    // ================================
    // Minimap
    // ================================
    function updateMinimap() {
        if (!els.minimapCanvas || !els.container) return;
        const canvas = els.minimapCanvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const mw = canvas.width, mh = canvas.height;
        const sx = mw / GRID_SIZE, sy = mh / GRID_SIZE;

        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, mw, mh);

        // Draw groups
        state.groups.forEach(g => {
            const color = getGroupColor(g.colorId);
            ctx.fillStyle = color.border;
            ctx.fillRect(g.x * sx, g.y * sy, g.w * sx, g.h * sy);
        });

        // Draw nodes
        state.users.forEach(u => {
            const p = getNodePos(u.user_id);
            if (!p) return;
            const cx = (p.x + 110) * sx;
            const cy = (p.y + 60) * sy;
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#3ecf8e';
            ctx.fill();
        });

        // Draw connections
        ctx.strokeStyle = 'rgba(62, 207, 142, 0.4)';
        ctx.lineWidth = 1;
        state.connections.forEach(conn => {
            const sp = getNodePos(conn.sourceId);
            const tp = getNodePos(conn.targetId);
            if (!sp || !tp) return;
            ctx.beginPath();
            ctx.moveTo((sp.x + 110) * sx, (sp.y + 60) * sy);
            ctx.lineTo((tp.x + 110) * sx, (tp.y + 60) * sy);
            ctx.stroke();
        });

        // Viewport indicator
        const vp = els.minimapViewport;
        if (!vp) return;
        const cr = els.container.getBoundingClientRect();
        const vw = cr.width / state.canvas.scale;
        const vh = cr.height / state.canvas.scale;
        const vx = -state.canvas.offsetX / state.canvas.scale;
        const vy = -state.canvas.offsetY / state.canvas.scale;
        const pad = 6;

        vp.style.left = (pad + vx * sx) + 'px';
        vp.style.top = (pad + vy * sy) + 'px';
        vp.style.width = Math.max(8, vw * sx) + 'px';
        vp.style.height = Math.max(8, vh * sy) + 'px';
    }

    // ================================
    // Group snap (edges of groups + nodes)
    // ================================
    function calcGroupSnap(draggedGroupId, x, y, w, h) {
        let snapX = null, snapY = null;
        const guides = [];
        const dL = x, dR = x + w, dT = y, dB = y + h;
        const dCx = x + w / 2, dCy = y + h / 2;

        // Snap against other groups
        state.groups.forEach(g => {
            if (g.id === draggedGroupId) return;
            const tL = g.x, tR = g.x + g.w, tT = g.y, tB = g.y + g.h;
            const tCx = g.x + g.w / 2, tCy = g.y + g.h / 2;

            if (Math.abs(dL - tL) < SNAP_THRESHOLD) { snapX = tL; guides.push({ type: 'vertical', position: tL }); }
            if (Math.abs(dR - tR) < SNAP_THRESHOLD) { snapX = tR - w; guides.push({ type: 'vertical', position: tR }); }
            if (Math.abs(dL - tR) < SNAP_THRESHOLD) { snapX = tR; guides.push({ type: 'vertical', position: tR }); }
            if (Math.abs(dR - tL) < SNAP_THRESHOLD) { snapX = tL - w; guides.push({ type: 'vertical', position: tL }); }
            if (Math.abs(dCx - tCx) < SNAP_THRESHOLD) { snapX = tCx - w / 2; guides.push({ type: 'vertical', position: tCx }); }
            if (Math.abs(dT - tT) < SNAP_THRESHOLD) { snapY = tT; guides.push({ type: 'horizontal', position: tT }); }
            if (Math.abs(dB - tB) < SNAP_THRESHOLD) { snapY = tB - h; guides.push({ type: 'horizontal', position: tB }); }
            if (Math.abs(dT - tB) < SNAP_THRESHOLD) { snapY = tB; guides.push({ type: 'horizontal', position: tB }); }
            if (Math.abs(dB - tT) < SNAP_THRESHOLD) { snapY = tT - h; guides.push({ type: 'horizontal', position: tT }); }
            if (Math.abs(dCy - tCy) < SNAP_THRESHOLD) { snapY = tCy - h / 2; guides.push({ type: 'horizontal', position: tCy }); }
        });

        // Snap against nodes
        state.users.forEach(u => {
            const p = getNodePos(u.user_id);
            if (!p) return;
            const tw = 220, th = 120;
            const tL = p.x, tR = p.x + tw, tT = p.y, tB = p.y + th;

            if (Math.abs(dL - tL) < SNAP_THRESHOLD) { snapX = tL; guides.push({ type: 'vertical', position: tL }); }
            if (Math.abs(dR - tR) < SNAP_THRESHOLD) { snapX = tR - w; guides.push({ type: 'vertical', position: tR }); }
            if (Math.abs(dT - tT) < SNAP_THRESHOLD) { snapY = tT; guides.push({ type: 'horizontal', position: tT }); }
            if (Math.abs(dB - tB) < SNAP_THRESHOLD) { snapY = tB - h; guides.push({ type: 'horizontal', position: tB }); }
        });

        return { snapX, snapY, guides };
    }

    // Snap for draw/resize edges (single edge snapping)
    function calcEdgeSnap(edge, val, axis) {
        let snap = null;
        const guides = [];

        const checkEdge = (target, type, pos) => {
            if (Math.abs(val - target) < SNAP_THRESHOLD) {
                snap = target;
                guides.push({ type, position: pos });
            }
        };

        state.groups.forEach(g => {
            if (axis === 'x') {
                checkEdge(g.x, 'vertical', g.x);
                checkEdge(g.x + g.w, 'vertical', g.x + g.w);
            } else {
                checkEdge(g.y, 'horizontal', g.y);
                checkEdge(g.y + g.h, 'horizontal', g.y + g.h);
            }
        });

        state.users.forEach(u => {
            const p = getNodePos(u.user_id);
            if (!p) return;
            if (axis === 'x') {
                checkEdge(p.x, 'vertical', p.x);
                checkEdge(p.x + 220, 'vertical', p.x + 220);
            } else {
                checkEdge(p.y, 'horizontal', p.y);
                checkEdge(p.y + 120, 'horizontal', p.y + 120);
            }
        });

        return { snap, guides };
    }

    // ================================
    // Render groups
    // ================================
    function renderGroups() {
        if (!els.groupsContainer) return;
        els.groupsContainer.innerHTML = '';

        state.groups.forEach(g => {
            const el = createGroupEl(g);
            els.groupsContainer.appendChild(el);
            makeGroupDraggable(el, g.id);
            makeGroupResizable(el, g.id);
        });
    }

    function createGroupEl(g) {
        const div = document.createElement('div');
        div.className = 'orgchart-group';
        div.setAttribute('data-group-id', g.id);

        const color = getGroupColor(g.colorId);
        div.style.left = g.x + 'px';
        div.style.top = g.y + 'px';
        div.style.width = g.w + 'px';
        div.style.height = g.h + 'px';
        div.style.background = color.bg;
        div.style.borderColor = color.border;

        // Label
        const label = document.createElement('span');
        label.className = 'orgchart-group-label';
        label.textContent = g.label || 'Group';
        label.addEventListener('dblclick', e => {
            e.stopPropagation();
            startEditLabel(label, g.id);
        });
        div.appendChild(label);

        // Resize handles
        ['se', 'sw', 'ne', 'nw'].forEach(corner => {
            const handle = document.createElement('div');
            handle.className = 'orgchart-group-resize handle-' + corner;
            handle.setAttribute('data-handle', corner);
            div.appendChild(handle);
        });

        // Right-click context on group
        div.addEventListener('contextmenu', e => {
            e.preventDefault();
            e.stopPropagation();
            state.ctxGroupId = g.id;
            showContextMenu(e.clientX, e.clientY, true);
        });

        return div;
    }

    function startEditLabel(labelEl, groupId) {
        labelEl.setAttribute('contenteditable', 'true');
        labelEl.focus();

        // Select all text
        const range = document.createRange();
        range.selectNodeContents(labelEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finish = () => {
            labelEl.removeAttribute('contenteditable');
            const text = labelEl.textContent.trim() || 'Group';
            labelEl.textContent = text;
            const g = state.groups.find(gr => gr.id === groupId);
            if (g) { g.label = text; saveGroups(); }
        };

        labelEl.addEventListener('blur', finish, { once: true });
        labelEl.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); }
            if (e.key === 'Escape') { labelEl.blur(); }
        });
    }

    // ================================
    // Group dragging
    // ================================
    function makeGroupDraggable(el, groupId) {
        let dragging = false;
        let startX, startY, initX, initY;

        el.addEventListener('mousedown', e => {
            if (e.target.closest('.orgchart-group-resize')) return;
            if (e.target.closest('.orgchart-group-label[contenteditable]')) return;
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();

            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initX = parseInt(el.style.left) || 0;
            initY = parseInt(el.style.top) || 0;
            el.classList.add('dragging');
        });

        const onMove = e => {
            if (!dragging) return;
            const dx = (e.clientX - startX) / state.canvas.scale;
            const dy = (e.clientY - startY) / state.canvas.scale;
            const g = state.groups.find(gr => gr.id === groupId);
            if (!g) return;

            let nx = initX + dx, ny = initY + dy;
            const snap = calcGroupSnap(groupId, nx, ny, g.w, g.h);
            if (snap.snapX !== null) nx = snap.snapX;
            if (snap.snapY !== null) ny = snap.snapY;

            if (snap.guides.length > 0) {
                renderSnapGuides(snap.guides);
                el.classList.add('snapping');
            } else {
                clearSnapGuides();
                el.classList.remove('snapping');
            }

            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
            g.x = nx;
            g.y = ny;
        };

        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            el.classList.remove('dragging', 'snapping');
            clearSnapGuides();
            saveGroups();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ================================
    // Group resizing
    // ================================
    function makeGroupResizable(el, groupId) {
        el.addEventListener('mousedown', e => {
            const handle = e.target.closest('.orgchart-group-resize');
            if (!handle) return;
            e.preventDefault();
            e.stopPropagation();

            const corner = handle.getAttribute('data-handle');
            const g = state.groups.find(gr => gr.id === groupId);
            if (!g) return;

            const startMX = e.clientX, startMY = e.clientY;
            const origX = g.x, origY = g.y, origW = g.w, origH = g.h;
            const MIN = 60;

            const onMove = ev => {
                const dx = (ev.clientX - startMX) / state.canvas.scale;
                const dy = (ev.clientY - startMY) / state.canvas.scale;
                let nx = origX, ny = origY, nw = origW, nh = origH;

                if (corner === 'se') { nw = Math.max(MIN, origW + dx); nh = Math.max(MIN, origH + dy); }
                else if (corner === 'sw') { nw = Math.max(MIN, origW - dx); nh = Math.max(MIN, origH + dy); nx = origX + origW - nw; }
                else if (corner === 'ne') { nw = Math.max(MIN, origW + dx); nh = Math.max(MIN, origH - dy); ny = origY + origH - nh; }
                else if (corner === 'nw') { nw = Math.max(MIN, origW - dx); nh = Math.max(MIN, origH - dy); nx = origX + origW - nw; ny = origY + origH - nh; }

                // Snap edges
                const allGuides = [];

                // Snap right/bottom edges for se/ne/sw corners
                if (corner === 'se' || corner === 'ne') {
                    const rs = calcEdgeSnap('right', nx + nw, 'x');
                    if (rs.snap !== null) { nw = rs.snap - nx; allGuides.push(...rs.guides); }
                }
                if (corner === 'se' || corner === 'sw') {
                    const bs = calcEdgeSnap('bottom', ny + nh, 'y');
                    if (bs.snap !== null) { nh = bs.snap - ny; allGuides.push(...bs.guides); }
                }
                if (corner === 'sw' || corner === 'nw') {
                    const ls = calcEdgeSnap('left', nx, 'x');
                    if (ls.snap !== null) { const diff = ls.snap - nx; nx = ls.snap; nw -= diff; allGuides.push(...ls.guides); }
                }
                if (corner === 'ne' || corner === 'nw') {
                    const ts = calcEdgeSnap('top', ny, 'y');
                    if (ts.snap !== null) { const diff = ts.snap - ny; ny = ts.snap; nh -= diff; allGuides.push(...ts.guides); }
                }

                if (allGuides.length > 0) { renderSnapGuides(allGuides); el.classList.add('snapping'); }
                else { clearSnapGuides(); el.classList.remove('snapping'); }

                el.style.left = nx + 'px';
                el.style.top = ny + 'px';
                el.style.width = nw + 'px';
                el.style.height = nh + 'px';
                g.x = nx; g.y = ny; g.w = nw; g.h = nh;
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                el.classList.remove('snapping');
                clearSnapGuides();
                saveGroups();
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // ================================
    // Context menu
    // ================================
    function createContextMenu() {
        if (state.ctxMenu) return;
        const menu = document.createElement('div');
        menu.className = 'orgchart-ctx-menu';
        menu.innerHTML = `
            <div class="orgchart-ctx-item" data-action="add-group">
                <svg class="orgchart-ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>
                Add group area
            </div>
            <div class="orgchart-ctx-sep ctx-group-only"></div>
            <div class="orgchart-ctx-item ctx-group-only" data-action="edit-label">
                <svg class="orgchart-ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-9 9H2v-3z"/></svg>
                Rename group
            </div>
            <div class="orgchart-ctx-colors ctx-group-only" data-action="colors"></div>
            <div class="orgchart-ctx-sep ctx-group-only"></div>
            <div class="orgchart-ctx-item ctx-group-only danger" data-action="delete-group">
                <svg class="orgchart-ctx-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M4 4l1 10h6l1-10"/></svg>
                Delete group
            </div>
        `;
        document.body.appendChild(menu);
        state.ctxMenu = menu;

        // Build color swatches
        const colorsDiv = menu.querySelector('[data-action="colors"]');
        GROUP_COLORS.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'orgchart-ctx-swatch';
            swatch.setAttribute('data-color-id', c.id);
            swatch.style.background = c.border.replace('0.18', '0.6');
            swatch.addEventListener('click', () => {
                if (!state.ctxGroupId) return;
                const g = state.groups.find(gr => gr.id === state.ctxGroupId);
                if (!g) return;
                g.colorId = c.id;
                saveGroups();
                renderGroups();
                hideContextMenu();
            });
            colorsDiv.appendChild(swatch);
        });

        // Item clicks
        menu.addEventListener('click', e => {
            const item = e.target.closest('.orgchart-ctx-item');
            if (!item) return;
            const action = item.getAttribute('data-action');

            if (action === 'add-group') {
                hideContextMenu();
                startGroupDraw();
            }
            if (action === 'edit-label' && state.ctxGroupId) {
                hideContextMenu();
                const gEl = els.groupsContainer?.querySelector(`[data-group-id="${state.ctxGroupId}"]`);
                const labelEl = gEl?.querySelector('.orgchart-group-label');
                if (labelEl) startEditLabel(labelEl, state.ctxGroupId);
            }
            if (action === 'delete-group' && state.ctxGroupId) {
                state.groups = state.groups.filter(g => g.id !== state.ctxGroupId);
                saveGroups();
                renderGroups();
                hideContextMenu();
            }
        });

        // Close on outside click
        document.addEventListener('mousedown', e => {
            if (state.ctxMenu && !state.ctxMenu.contains(e.target)) {
                hideContextMenu();
            }
        });
    }

    function showContextMenu(clientX, clientY, isGroupCtx) {
        createContextMenu();
        const menu = state.ctxMenu;

        // Toggle group-specific items
        menu.querySelectorAll('.ctx-group-only').forEach(el => {
            el.style.display = isGroupCtx ? '' : 'none';
        });

        // Highlight current color
        if (isGroupCtx && state.ctxGroupId) {
            const g = state.groups.find(gr => gr.id === state.ctxGroupId);
            menu.querySelectorAll('.orgchart-ctx-swatch').forEach(s => {
                s.classList.toggle('active', s.getAttribute('data-color-id') === (g?.colorId || 'green'));
            });
        }

        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.classList.add('visible');

        // Keep in viewport
        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth) menu.style.left = (clientX - rect.width) + 'px';
            if (rect.bottom > window.innerHeight) menu.style.top = (clientY - rect.height) + 'px';
        });
    }

    function hideContextMenu() {
        if (state.ctxMenu) state.ctxMenu.classList.remove('visible');
        state.ctxGroupId = null;
    }

    // ================================
    // Group drawing (click+drag on canvas)
    // ================================
    function startGroupDraw() {
        state.groupDraw.active = true;
        els.container.classList.add('drawing-mode');
    }

    function initGroupDraw() {
        // mousedown on canvas starts draw
        els.container.addEventListener('mousedown', e => {
            if (!state.groupDraw.active) return;
            if (e.button !== 0) return;
            if (e.target.closest('.orgchart-node') || e.target.closest('.orgchart-group') || e.target.closest('.orgchart-minimap')) return;
            e.preventDefault();
            e.stopPropagation();

            const gridBCR = els.grid.getBoundingClientRect();
            const s = state.canvas.scale;
            const gx = (e.clientX - gridBCR.left) / s;
            const gy = (e.clientY - gridBCR.top) / s;

            state.groupDraw.startX = gx;
            state.groupDraw.startY = gy;

            // Create preview
            const preview = document.createElement('div');
            preview.className = 'orgchart-draw-preview';
            preview.style.left = gx + 'px';
            preview.style.top = gy + 'px';
            preview.style.width = '0px';
            preview.style.height = '0px';
            els.grid.appendChild(preview);
            state.groupDraw.previewEl = preview;
        });

        document.addEventListener('mousemove', e => {
            if (!state.groupDraw.active || !state.groupDraw.previewEl) return;

            const gridBCR = els.grid.getBoundingClientRect();
            const s = state.canvas.scale;
            let mx = (e.clientX - gridBCR.left) / s;
            let my = (e.clientY - gridBCR.top) / s;

            // Snap current edge
            const sxr = calcEdgeSnap('x', mx, 'x');
            const syr = calcEdgeSnap('y', my, 'y');
            if (sxr.snap !== null) mx = sxr.snap;
            if (syr.snap !== null) my = syr.snap;

            const allGuides = [...(sxr.guides || []), ...(syr.guides || [])];
            if (allGuides.length > 0) renderSnapGuides(allGuides);
            else clearSnapGuides();

            const sx = state.groupDraw.startX, sy = state.groupDraw.startY;
            const x = Math.min(sx, mx), y = Math.min(sy, my);
            const w = Math.abs(mx - sx), h = Math.abs(my - sy);

            state.groupDraw.previewEl.style.left = x + 'px';
            state.groupDraw.previewEl.style.top = y + 'px';
            state.groupDraw.previewEl.style.width = w + 'px';
            state.groupDraw.previewEl.style.height = h + 'px';
        });

        document.addEventListener('mouseup', e => {
            if (!state.groupDraw.active || !state.groupDraw.previewEl) return;

            const gridBCR = els.grid.getBoundingClientRect();
            const s = state.canvas.scale;
            let mx = (e.clientX - gridBCR.left) / s;
            let my = (e.clientY - gridBCR.top) / s;

            const sxr = calcEdgeSnap('x', mx, 'x');
            const syr = calcEdgeSnap('y', my, 'y');
            if (sxr.snap !== null) mx = sxr.snap;
            if (syr.snap !== null) my = syr.snap;

            const sx = state.groupDraw.startX, sy = state.groupDraw.startY;
            const x = Math.min(sx, mx), y = Math.min(sy, my);
            const w = Math.abs(mx - sx), h = Math.abs(my - sy);

            // Remove preview
            if (state.groupDraw.previewEl.parentNode) {
                state.groupDraw.previewEl.parentNode.removeChild(state.groupDraw.previewEl);
            }
            state.groupDraw.previewEl = null;
            state.groupDraw.active = false;
            els.container.classList.remove('drawing-mode');
            clearSnapGuides();

            // Only create if big enough
            if (w < 40 || h < 30) return;

            const newGroup = {
                id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                x: Math.round(x),
                y: Math.round(y),
                w: Math.round(w),
                h: Math.round(h),
                colorId: 'green',
                label: 'Group',
            };
            state.groups.push(newGroup);
            saveGroups();
            renderGroups();
        });
    }

    // ================================
    // Canvas context menu handler
    // ================================
    function initContextMenu() {
        els.container.addEventListener('contextmenu', e => {
            // Don't override if on a group (handled by group itself)
            if (e.target.closest('.orgchart-group')) return;
            // Don't show if on a node
            if (e.target.closest('.orgchart-node')) return;

            e.preventDefault();
            state.ctxGroupId = null;
            showContextMenu(e.clientX, e.clientY, false);
        });
    }

    // ================================
    // Render all nodes
    // ================================
    function renderNodes() {
        if (!els.nodes) return;
        els.nodes.innerHTML = '';

        state.users.forEach(u => {
            const nodeEl = createNodeEl(u);
            els.nodes.appendChild(nodeEl);
            makeDraggable(nodeEl, u.user_id);
        });

        // Give DOM time to layout, then redraw connections + fit
        requestAnimationFrame(() => {
            redrawConnections();
            updateMinimap();
        });
    }

    // ================================
    // Public API
    // ================================
    async function init(users) {
        els = {
            container: document.getElementById('orgchart-canvas-container'),
            grid: document.getElementById('orgchart-grid'),
            connectionsLayer: document.getElementById('orgchart-connections-layer'),
            snapGuides: document.getElementById('orgchart-snap-guides'),
            nodes: document.getElementById('orgchart-nodes'),
            groupsContainer: document.getElementById('orgchart-groups'),
            minimapCanvas: document.getElementById('orgchart-minimap-canvas'),
            minimapViewport: document.getElementById('orgchart-minimap-viewport'),
            zoomLevel: document.getElementById('orgchart-zoom-level'),
        };

        if (!els.container || !els.grid) return;

        // Load persisted state from API (falls back to localStorage cache)
        await Promise.all([loadPositions(), loadConnections(), loadGroups()]);

        state.users = users || [];
        computeDefaultPositions(state.users);
        savePositions();

        renderGroups();
        renderNodes();
        initCanvasInteraction();
        initPortDrag();
        initConnectionDelete();
        initGroupDraw();
        initContextMenu();

        // Initial view
        requestAnimationFrame(() => {
            if (state.users.length > 0) {
                fitToContent();
            } else {
                applyTransform();
            }
        });
    }

    function refresh(users) {
        state.users = users || [];
        computeDefaultPositions(state.users);
        savePositions();
        renderGroups();
        renderNodes();

        // Remove connections referencing deleted users
        const ids = new Set(state.users.map(u => u.user_id));
        const before = state.connections.length;
        state.connections = state.connections.filter(c => ids.has(c.sourceId) && ids.has(c.targetId));
        if (state.connections.length !== before) saveConnections();
    }

    function show() {
        const wrapper = document.getElementById('orgchart-wrapper');
        if (wrapper) wrapper.classList.add('visible');
        document.body.classList.add('orgchart-active');
        requestAnimationFrame(() => {
            applyTransform();
            redrawConnections();
            updateMinimap();
        });
    }

    function hide() {
        const wrapper = document.getElementById('orgchart-wrapper');
        if (wrapper) wrapper.classList.remove('visible');
        document.body.classList.remove('orgchart-active');
    }

    window.TeamOrgChart = { init, refresh, show, hide };
})();
