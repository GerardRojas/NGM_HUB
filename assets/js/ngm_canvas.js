/**
 * NGM Canvas - Reusable Infinite Canvas Library
 * ==============================================
 * Pan/zoom canvas with node dragging, SVG connections, snap alignment, and minimap.
 * Based on Process Manager canvas patterns, extracted for reuse across modules.
 *
 * Usage:
 *   const canvas = new NGMCanvas(document.getElementById('myContainer'), { ... });
 *   const cardEl = document.createElement('div');
 *   canvas.addNode('node-1', cardEl, 200, 100);
 *   canvas.addConnection('conn-1', 'node-1', 'node-2', { color: '#3ecf8e', animated: true });
 */
(function () {
    'use strict';

    const DEFAULTS = {
        gridWidth: 6000,
        gridHeight: 6000,
        minScale: 0.15,
        maxScale: 2.5,
        initialScale: 0.85,
        snapThreshold: 12,
        showMinimap: true,
        minimapWidth: 180,
        minimapHeight: 120,
        dotGrid: true,
        connectionCornerRadius: 12,
    };

    class NGMCanvas {
        /**
         * @param {HTMLElement} containerEl - The container element for the canvas
         * @param {object} opts - Configuration options
         */
        constructor(containerEl, opts = {}) {
            this._container = containerEl;
            this._opts = { ...DEFAULTS, ...opts };

            // Internal state
            this._state = {
                scale: this._opts.initialScale,
                offsetX: 0,
                offsetY: 0,
                isPanning: false,
                panStart: { x: 0, y: 0 },
            };

            this._nodes = new Map();       // id -> { el, x, y, data }
            this._connections = new Map();  // id -> { sourceId, targetId, opts, groupEl }
            this._selectedNodes = new Set();

            // Drag state
            this._drag = {
                active: false,
                nodeId: null,
                startX: 0,
                startY: 0,
                nodeStartX: 0,
                nodeStartY: 0,
                groupInitial: {},
            };

            // Selection box
            this._selBox = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

            // Bound handlers for cleanup
            this._boundHandlers = {};

            this._buildDOM();
            this._attachEvents();
            this._applyTransform();
        }

        // ============================
        // DOM Construction
        // ============================
        _buildDOM() {
            this._container.classList.add('ngm-canvas-container');

            // Canvas grid (transform layer)
            this._grid = document.createElement('div');
            this._grid.className = 'ngm-canvas-grid' + (this._opts.dotGrid ? ' ngm-dot-grid' : '');
            this._grid.style.width = this._opts.gridWidth + 'px';
            this._grid.style.height = this._opts.gridHeight + 'px';

            // SVG connections layer
            this._svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._svg.setAttribute('class', 'ngm-connections-layer');
            this._svg.setAttribute('width', '100%');
            this._svg.setAttribute('height', '100%');
            this._svg.style.width = this._opts.gridWidth + 'px';
            this._svg.style.height = this._opts.gridHeight + 'px';

            // SVG defs (markers)
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.innerHTML = `
                <marker id="ngm-arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
                </marker>
                <marker id="ngm-arrow-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#3ecf8e" />
                </marker>
                <marker id="ngm-arrow-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                </marker>
                <marker id="ngm-arrow-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
                </marker>
            `;
            this._svg.appendChild(defs);

            // Snap guides container
            this._snapGuides = document.createElement('div');
            this._snapGuides.className = 'ngm-snap-guides';

            // Selection box
            this._selBoxEl = document.createElement('div');
            this._selBoxEl.className = 'ngm-selection-box';

            // Nodes container
            this._nodesContainer = document.createElement('div');
            this._nodesContainer.className = 'ngm-nodes-container';

            // Assemble grid
            this._grid.appendChild(this._svg);
            this._grid.appendChild(this._snapGuides);
            this._grid.appendChild(this._selBoxEl);
            this._grid.appendChild(this._nodesContainer);

            this._container.appendChild(this._grid);

            // Minimap
            if (this._opts.showMinimap) {
                this._buildMinimap();
            }
        }

        _buildMinimap() {
            this._minimap = document.createElement('div');
            this._minimap.className = 'ngm-canvas-minimap';

            // Header
            const header = document.createElement('div');
            header.className = 'ngm-minimap-header';
            header.innerHTML = `
                <span>Minimap</span>
                <svg class="ngm-minimap-toggle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            `;
            header.addEventListener('click', () => {
                this._minimap.classList.toggle('collapsed');
            });

            // Body
            const body = document.createElement('div');
            body.className = 'ngm-minimap-body';

            // Canvas element
            this._minimapCanvas = document.createElement('canvas');
            this._minimapCanvas.className = 'ngm-minimap-canvas';
            this._minimapCanvas.width = this._opts.minimapWidth;
            this._minimapCanvas.height = this._opts.minimapHeight;

            // Viewport indicator
            this._minimapViewport = document.createElement('div');
            this._minimapViewport.className = 'ngm-minimap-viewport';

            body.appendChild(this._minimapCanvas);
            body.appendChild(this._minimapViewport);

            this._minimap.appendChild(header);
            this._minimap.appendChild(body);

            // Click-to-navigate on minimap
            body.addEventListener('click', (e) => {
                const rect = this._minimapCanvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                const scaleX = this._minimapCanvas.width / this._opts.gridWidth;
                const scaleY = this._minimapCanvas.height / this._opts.gridHeight;

                const canvasX = mx / scaleX;
                const canvasY = my / scaleY;

                const containerRect = this._container.getBoundingClientRect();
                this._state.offsetX = containerRect.width / 2 - canvasX * this._state.scale;
                this._state.offsetY = containerRect.height / 2 - canvasY * this._state.scale;
                this._applyTransform();
            });

            this._container.appendChild(this._minimap);
        }

        // ============================
        // Event Handling
        // ============================
        _attachEvents() {
            const onMouseDown = (e) => this._onMouseDown(e);
            const onMouseMove = (e) => this._onMouseMove(e);
            const onMouseUp = (e) => this._onMouseUp(e);
            const onWheel = (e) => this._onWheel(e);
            const onContextMenu = (e) => {
                // Let right-click selection work
                if (this._selBox.active) e.preventDefault();
            };

            this._container.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            this._container.addEventListener('wheel', onWheel, { passive: false });
            this._container.addEventListener('contextmenu', onContextMenu);

            this._boundHandlers = { onMouseDown, onMouseMove, onMouseUp, onWheel, onContextMenu };
        }

        _onMouseDown(e) {
            // Check if clicking on a node
            const nodeEl = e.target.closest('.ngm-nodes-container > *');
            const port = e.target.closest('[data-port]');

            if (port) {
                // Port click -- let consumer handle via event
                return;
            }

            if (nodeEl) {
                const nodeId = this._findNodeId(nodeEl);
                if (!nodeId) return;

                if (e.button !== 0) return;

                // Ctrl/Shift click for multi-select
                if (e.ctrlKey || e.shiftKey) {
                    this._toggleSelection(nodeId);
                    e.stopPropagation();
                    return;
                }

                // Single click event
                this._emit('ngm:node-click', { nodeId, event: e });

                // Start node drag
                this._startNodeDrag(e, nodeId);
                e.stopPropagation();
                return;
            }

            // Canvas background click
            if (e.button === 0) {
                // Left click = pan
                e.preventDefault();
                this._state.isPanning = true;
                this._state.panStart = { x: e.clientX, y: e.clientY };
                this._container.classList.add('is-panning');

                // Clear selection on empty canvas click
                if (!e.ctrlKey && !e.shiftKey) {
                    this.clearSelection();
                }

                this._emit('ngm:canvas-click', {
                    x: this._screenToCanvas(e.clientX, e.clientY).x,
                    y: this._screenToCanvas(e.clientX, e.clientY).y,
                    event: e,
                });
                return;
            }

            if (e.button === 2) {
                // Right click = selection box
                e.preventDefault();
                if (!e.ctrlKey && !e.shiftKey) {
                    this.clearSelection();
                }

                const coords = this._screenToCanvas(e.clientX, e.clientY);
                this._selBox.active = true;
                this._selBox.startX = coords.x;
                this._selBox.startY = coords.y;
                this._selBox.endX = coords.x;
                this._selBox.endY = coords.y;
                this._updateSelectionBox();
                this._container.classList.add('is-selecting');
            }
        }

        _onMouseMove(e) {
            // Selection box
            if (this._selBox.active) {
                const coords = this._screenToCanvas(e.clientX, e.clientY);
                this._selBox.endX = coords.x;
                this._selBox.endY = coords.y;
                this._updateSelectionBox();
                this._highlightNodesInSelection();
                return;
            }

            // Node dragging
            if (this._drag.active) {
                const dx = (e.clientX - this._drag.startX) / this._state.scale;
                const dy = (e.clientY - this._drag.startY) / this._state.scale;

                let newX = this._drag.nodeStartX + dx;
                let newY = this._drag.nodeStartY + dy;

                const node = this._nodes.get(this._drag.nodeId);
                if (!node) return;

                // Snap alignment (only for single node drag)
                if (Object.keys(this._drag.groupInitial).length === 0) {
                    const snap = this._calculateSnap(this._drag.nodeId, newX, newY,
                        node.el.offsetWidth || 200, node.el.offsetHeight || 100);

                    if (snap.snapX !== null) newX = snap.snapX;
                    if (snap.snapY !== null) newY = snap.snapY;

                    if (snap.guides.length > 0) {
                        this._renderSnapGuides(snap.guides);
                    } else {
                        this._clearSnapGuides();
                    }
                } else {
                    this._clearSnapGuides();
                }

                // Update position
                node.x = newX;
                node.y = newY;
                node.el.style.left = newX + 'px';
                node.el.style.top = newY + 'px';

                // Group drag - move all selected nodes
                if (Object.keys(this._drag.groupInitial).length > 0) {
                    for (const [id, pos] of Object.entries(this._drag.groupInitial)) {
                        if (id === this._drag.nodeId) continue;
                        const n = this._nodes.get(id);
                        if (n) {
                            n.x = pos.x + dx;
                            n.y = pos.y + dy;
                            n.el.style.left = n.x + 'px';
                            n.el.style.top = n.y + 'px';
                        }
                    }
                }

                // Redraw connections during drag
                if (!this._connectionUpdatePending) {
                    this._connectionUpdatePending = true;
                    requestAnimationFrame(() => {
                        this.redrawConnections();
                        this._connectionUpdatePending = false;
                    });
                }

                this._emit('ngm:node-drag-move', { nodeId: this._drag.nodeId, x: newX, y: newY, dx, dy });
                return;
            }

            // Canvas panning
            if (this._state.isPanning) {
                const dx = e.clientX - this._state.panStart.x;
                const dy = e.clientY - this._state.panStart.y;
                this._state.offsetX += dx;
                this._state.offsetY += dy;
                this._state.panStart = { x: e.clientX, y: e.clientY };
                this._applyTransform();
            }
        }

        _onMouseUp(e) {
            // End selection box
            if (this._selBox.active) {
                this._finishSelection();
                this._selBox.active = false;
                this._selBoxEl.classList.remove('active');
                this._container.classList.remove('is-selecting');
                return;
            }

            // End node drag
            if (this._drag.active) {
                this._drag.active = false;
                const node = this._nodes.get(this._drag.nodeId);
                if (node) {
                    node.el.classList.remove('ngm-node-dragging');
                }
                this._clearSnapGuides();
                this._updateMinimap();

                this._emit('ngm:node-drag-end', {
                    nodeId: this._drag.nodeId,
                    x: node ? node.x : 0,
                    y: node ? node.y : 0,
                });

                this._drag.nodeId = null;
                this._drag.groupInitial = {};
                return;
            }

            // End panning
            if (this._state.isPanning) {
                this._state.isPanning = false;
                this._container.classList.remove('is-panning');
            }
        }

        _onWheel(e) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.08 : 0.08;
            const rect = this._container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.zoomAtPoint(delta, mouseX, mouseY);
        }

        // ============================
        // Node Dragging
        // ============================
        _startNodeDrag(e, nodeId) {
            if (e.button !== 0) return;

            const node = this._nodes.get(nodeId);
            if (!node) return;

            this._drag.active = true;
            this._drag.nodeId = nodeId;
            this._drag.startX = e.clientX;
            this._drag.startY = e.clientY;
            this._drag.nodeStartX = node.x;
            this._drag.nodeStartY = node.y;

            // Group drag if selected
            this._drag.groupInitial = {};
            if (this._selectedNodes.has(nodeId) && this._selectedNodes.size > 1) {
                for (const id of this._selectedNodes) {
                    const n = this._nodes.get(id);
                    if (n) {
                        this._drag.groupInitial[id] = { x: n.x, y: n.y };
                    }
                }
            }

            node.el.classList.add('ngm-node-dragging');

            this._emit('ngm:node-drag-start', { nodeId, x: node.x, y: node.y });
        }

        // ============================
        // Snap Alignment
        // ============================
        _calculateSnap(draggedId, x, y, width, height) {
            const threshold = this._opts.snapThreshold;
            let snapX = null;
            let snapY = null;
            const guides = [];

            const dragLeft = x;
            const dragRight = x + width;
            const dragTop = y;
            const dragBottom = y + height;
            const dragCenterX = x + width / 2;
            const dragCenterY = y + height / 2;

            for (const [id, node] of this._nodes) {
                if (id === draggedId) continue;

                const tLeft = node.x;
                const tTop = node.y;
                const tWidth = node.el.offsetWidth || 200;
                const tHeight = node.el.offsetHeight || 100;
                const tRight = tLeft + tWidth;
                const tBottom = tTop + tHeight;
                const tCenterX = tLeft + tWidth / 2;
                const tCenterY = tTop + tHeight / 2;

                // Horizontal snap (X axis)
                if (Math.abs(dragLeft - tLeft) < threshold) {
                    snapX = tLeft;
                    guides.push({ type: 'vertical', position: tLeft });
                } else if (Math.abs(dragRight - tRight) < threshold) {
                    snapX = tRight - width;
                    guides.push({ type: 'vertical', position: tRight });
                } else if (Math.abs(dragLeft - tRight) < threshold) {
                    snapX = tRight;
                    guides.push({ type: 'vertical', position: tRight });
                } else if (Math.abs(dragRight - tLeft) < threshold) {
                    snapX = tLeft - width;
                    guides.push({ type: 'vertical', position: tLeft });
                } else if (Math.abs(dragCenterX - tCenterX) < threshold) {
                    snapX = tCenterX - width / 2;
                    guides.push({ type: 'vertical', position: tCenterX });
                }

                // Vertical snap (Y axis)
                if (Math.abs(dragTop - tTop) < threshold) {
                    snapY = tTop;
                    guides.push({ type: 'horizontal', position: tTop });
                } else if (Math.abs(dragBottom - tBottom) < threshold) {
                    snapY = tBottom - height;
                    guides.push({ type: 'horizontal', position: tBottom });
                } else if (Math.abs(dragTop - tBottom) < threshold) {
                    snapY = tBottom;
                    guides.push({ type: 'horizontal', position: tBottom });
                } else if (Math.abs(dragBottom - tTop) < threshold) {
                    snapY = tTop - height;
                    guides.push({ type: 'horizontal', position: tTop });
                } else if (Math.abs(dragCenterY - tCenterY) < threshold) {
                    snapY = tCenterY - height / 2;
                    guides.push({ type: 'horizontal', position: tCenterY });
                }
            }

            return { snapX, snapY, guides };
        }

        _renderSnapGuides(guides) {
            this._snapGuides.innerHTML = '';
            const seen = new Set();
            guides.forEach(g => {
                const key = g.type + '-' + Math.round(g.position);
                if (seen.has(key)) return;
                seen.add(key);

                const el = document.createElement('div');
                el.className = 'ngm-snap-guide ' + g.type;
                if (g.type === 'horizontal') {
                    el.style.top = g.position + 'px';
                } else {
                    el.style.left = g.position + 'px';
                }
                this._snapGuides.appendChild(el);
            });
        }

        _clearSnapGuides() {
            this._snapGuides.innerHTML = '';
        }

        // ============================
        // Selection Box
        // ============================
        _updateSelectionBox() {
            const { startX, startY, endX, endY } = this._selBox;
            const left = Math.min(startX, endX);
            const top = Math.min(startY, endY);
            const width = Math.abs(endX - startX);
            const height = Math.abs(endY - startY);

            this._selBoxEl.style.left = left + 'px';
            this._selBoxEl.style.top = top + 'px';
            this._selBoxEl.style.width = width + 'px';
            this._selBoxEl.style.height = height + 'px';
            this._selBoxEl.classList.add('active');
        }

        _highlightNodesInSelection() {
            const boxLeft = Math.min(this._selBox.startX, this._selBox.endX);
            const boxRight = Math.max(this._selBox.startX, this._selBox.endX);
            const boxTop = Math.min(this._selBox.startY, this._selBox.endY);
            const boxBottom = Math.max(this._selBox.startY, this._selBox.endY);

            for (const [id, node] of this._nodes) {
                const nRight = node.x + (node.el.offsetWidth || 200);
                const nBottom = node.y + (node.el.offsetHeight || 100);

                const intersects = !(boxRight < node.x || boxLeft > nRight ||
                    boxBottom < node.y || boxTop > nBottom);

                if (intersects) {
                    node.el.classList.add('ngm-node-selected');
                } else if (!this._selectedNodes.has(id)) {
                    node.el.classList.remove('ngm-node-selected');
                }
            }
        }

        _finishSelection() {
            const boxLeft = Math.min(this._selBox.startX, this._selBox.endX);
            const boxRight = Math.max(this._selBox.startX, this._selBox.endX);
            const boxTop = Math.min(this._selBox.startY, this._selBox.endY);
            const boxBottom = Math.max(this._selBox.startY, this._selBox.endY);

            for (const [id, node] of this._nodes) {
                const nRight = node.x + (node.el.offsetWidth || 200);
                const nBottom = node.y + (node.el.offsetHeight || 100);

                const intersects = !(boxRight < node.x || boxLeft > nRight ||
                    boxBottom < node.y || boxTop > nBottom);

                if (intersects) {
                    this._selectedNodes.add(id);
                    node.el.classList.add('ngm-node-selected');
                }
            }

            this._emit('ngm:selection-change', { selectedIds: [...this._selectedNodes] });
        }

        _toggleSelection(nodeId) {
            if (this._selectedNodes.has(nodeId)) {
                this._selectedNodes.delete(nodeId);
                const node = this._nodes.get(nodeId);
                if (node) node.el.classList.remove('ngm-node-selected');
            } else {
                this._selectedNodes.add(nodeId);
                const node = this._nodes.get(nodeId);
                if (node) node.el.classList.add('ngm-node-selected');
            }
            this._emit('ngm:selection-change', { selectedIds: [...this._selectedNodes] });
        }

        // ============================
        // Transform & Zoom
        // ============================
        _applyTransform() {
            this._constrainBounds();
            this._grid.style.transform =
                'translate(' + this._state.offsetX + 'px, ' + this._state.offsetY + 'px) scale(' + this._state.scale + ')';
            this._updateMinimap();
        }

        _constrainBounds() {
            const containerRect = this._container.getBoundingClientRect();
            const vw = containerRect.width;
            const vh = containerRect.height;
            const sw = this._opts.gridWidth * this._state.scale;
            const sh = this._opts.gridHeight * this._state.scale;

            let minX, maxX, minY, maxY;

            if (sw >= vw) {
                maxX = 0;
                minX = -(sw - vw);
            } else {
                minX = maxX = (vw - sw) / 2;
            }

            if (sh >= vh) {
                maxY = 0;
                minY = -(sh - vh);
            } else {
                minY = maxY = (vh - sh) / 2;
            }

            this._state.offsetX = Math.max(minX, Math.min(maxX, this._state.offsetX));
            this._state.offsetY = Math.max(minY, Math.min(maxY, this._state.offsetY));
        }

        _getMinScale() {
            const rect = this._container.getBoundingClientRect();
            const sx = rect.width / this._opts.gridWidth;
            const sy = rect.height / this._opts.gridHeight;
            return Math.max(this._opts.minScale, Math.max(sx, sy));
        }

        // ============================
        // Connections (Orthogonal SVG)
        // ============================
        _calcOrthogonalPath(srcRect, tgtRect) {
            const srcCX = srcRect.x + srcRect.width / 2;
            const srcCY = srcRect.y + srcRect.height / 2;
            const tgtCX = tgtRect.x + tgtRect.width / 2;
            const tgtCY = tgtRect.y + tgtRect.height / 2;

            const dx = tgtCX - srcCX;
            const dy = tgtCY - srcCY;

            let fromX, fromY, toX, toY;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    fromX = srcRect.x + srcRect.width;
                    fromY = srcCY;
                    toX = tgtRect.x;
                    toY = tgtCY;
                } else {
                    fromX = srcRect.x;
                    fromY = srcCY;
                    toX = tgtRect.x + tgtRect.width;
                    toY = tgtCY;
                }
            } else {
                if (dy > 0) {
                    fromX = srcCX;
                    fromY = srcRect.y + srcRect.height;
                    toX = tgtCX;
                    toY = tgtRect.y;
                } else {
                    fromX = srcCX;
                    fromY = srcRect.y;
                    toX = tgtCX;
                    toY = tgtRect.y + tgtRect.height;
                }
            }

            const midX = (fromX + toX) / 2;
            const midY = (fromY + toY) / 2;

            let points;
            if (Math.abs(dx) > Math.abs(dy)) {
                points = [
                    { x: fromX, y: fromY },
                    { x: midX, y: fromY },
                    { x: midX, y: toY },
                    { x: toX, y: toY },
                ];
            } else {
                points = [
                    { x: fromX, y: fromY },
                    { x: fromX, y: midY },
                    { x: toX, y: midY },
                    { x: toX, y: toY },
                ];
            }

            return this._simplifyPoints(points);
        }

        _simplifyPoints(points) {
            if (points.length <= 2) return points;
            const result = [points[0]];
            for (let i = 1; i < points.length - 1; i++) {
                const prev = result[result.length - 1];
                const curr = points[i];
                const next = points[i + 1];
                if (Math.abs(curr.x - prev.x) < 0.5 && Math.abs(curr.y - prev.y) < 0.5) continue;
                const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
                const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
                if (sameX || sameY) continue;
                result.push(curr);
            }
            result.push(points[points.length - 1]);
            return result;
        }

        _buildSVGPath(points) {
            const r = this._opts.connectionCornerRadius;
            let d = 'M ' + points[0].x + ' ' + points[0].y;

            for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1];
                const curr = points[i];
                const next = points[i + 1];

                if (next && i < points.length - 1) {
                    const dx1 = curr.x - prev.x;
                    const dy1 = curr.y - prev.y;
                    const dx2 = next.x - curr.x;
                    const dy2 = next.y - curr.y;

                    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                    if (len1 > 0 && len2 > 0) {
                        const cr = Math.min(r, len1 / 2, len2 / 2);
                        const sx = curr.x - (dx1 / len1) * cr;
                        const sy = curr.y - (dy1 / len1) * cr;
                        const ex = curr.x + (dx2 / len2) * cr;
                        const ey = curr.y + (dy2 / len2) * cr;
                        d += ' L ' + sx + ' ' + sy;
                        d += ' Q ' + curr.x + ' ' + curr.y + ' ' + ex + ' ' + ey;
                    } else {
                        d += ' L ' + curr.x + ' ' + curr.y;
                    }
                } else {
                    d += ' L ' + curr.x + ' ' + curr.y;
                }
            }

            return d;
        }

        _createConnectionGroup(id, points, opts) {
            const color = opts.color || '#3f3f46';
            const animated = opts.animated || false;
            const dashed = opts.dashed !== false; // default true
            const arrowhead = opts.arrowhead || false;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'ngm-connection-group');
            g.setAttribute('data-connection-id', id);

            // Hit area
            const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hitArea.setAttribute('class', 'ngm-connection-hit-area');
            hitArea.setAttribute('d', this._buildSVGPath(points));
            g.appendChild(hitArea);

            // Main path
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let cls = 'ngm-connection-path';
            if (animated) cls += ' animated';
            path.setAttribute('class', cls);
            path.setAttribute('d', this._buildSVGPath(points));
            path.setAttribute('stroke', color);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-width', '2');
            if (dashed) {
                path.setAttribute('stroke-dasharray', '8 4');
            }
            if (arrowhead) {
                // Pick marker by color
                let markerUrl = 'url(#ngm-arrow)';
                if (color === '#3ecf8e') markerUrl = 'url(#ngm-arrow-green)';
                else if (color === '#ef4444') markerUrl = 'url(#ngm-arrow-red)';
                else if (color === '#60a5fa') markerUrl = 'url(#ngm-arrow-blue)';
                path.setAttribute('marker-end', markerUrl);
            }
            g.appendChild(path);

            // Endpoint dots
            const startDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            startDot.setAttribute('class', 'ngm-connection-dot');
            startDot.setAttribute('cx', points[0].x);
            startDot.setAttribute('cy', points[0].y);
            startDot.setAttribute('r', '4');
            g.appendChild(startDot);

            const endDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            endDot.setAttribute('class', 'ngm-connection-dot');
            endDot.setAttribute('cx', points[points.length - 1].x);
            endDot.setAttribute('cy', points[points.length - 1].y);
            endDot.setAttribute('r', '4');
            g.appendChild(endDot);

            // Click event
            g.addEventListener('click', (e) => {
                e.stopPropagation();
                this._emit('ngm:connection-click', { connectionId: id, event: e });
            });

            return g;
        }

        // ============================
        // Minimap
        // ============================
        _updateMinimap() {
            if (!this._minimapCanvas || !this._container) return;

            const canvas = this._minimapCanvas;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scaleX = canvas.width / this._opts.gridWidth;
            const scaleY = canvas.height / this._opts.gridHeight;

            // Background
            ctx.fillStyle = '#0a0a0a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw nodes as dots
            for (const [id, node] of this._nodes) {
                const cx = (node.x + (node.el.offsetWidth || 200) / 2) * scaleX;
                const cy = (node.y + (node.el.offsetHeight || 100) / 2) * scaleY;
                const color = (node.data && node.data.color) || '#3ecf8e';

                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }

            // Draw connections as lines
            for (const [id, conn] of this._connections) {
                const src = this._nodes.get(conn.sourceId);
                const tgt = this._nodes.get(conn.targetId);
                if (!src || !tgt) continue;

                const sx = (src.x + (src.el.offsetWidth || 200) / 2) * scaleX;
                const sy = (src.y + (src.el.offsetHeight || 100) / 2) * scaleY;
                const tx = (tgt.x + (tgt.el.offsetWidth || 200) / 2) * scaleX;
                const ty = (tgt.y + (tgt.el.offsetHeight || 100) / 2) * scaleY;

                const color = (conn.opts && conn.opts.color) || '#3f3f46';
                ctx.strokeStyle = color.replace(')', ', 0.4)').replace('rgb(', 'rgba(');
                // If hex, convert opacity
                if (color.startsWith('#')) {
                    ctx.strokeStyle = color + '66';
                }
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }

            // Viewport rectangle
            if (this._minimapViewport) {
                const containerRect = this._container.getBoundingClientRect();
                const viewW = containerRect.width / this._state.scale;
                const viewH = containerRect.height / this._state.scale;
                const viewX = -this._state.offsetX / this._state.scale;
                const viewY = -this._state.offsetY / this._state.scale;

                const pad = 8;
                let vpLeft = pad + viewX * scaleX;
                let vpTop = pad + viewY * scaleY;
                let vpWidth = Math.max(10, viewW * scaleX);
                let vpHeight = Math.max(10, viewH * scaleY);

                vpLeft = Math.max(pad, Math.min(canvas.width + pad - 10, vpLeft));
                vpTop = Math.max(pad, Math.min(canvas.height + pad - 10, vpTop));
                if (vpLeft + vpWidth > canvas.width + pad) vpWidth = canvas.width + pad - vpLeft;
                if (vpTop + vpHeight > canvas.height + pad) vpHeight = canvas.height + pad - vpTop;

                this._minimapViewport.style.left = vpLeft + 'px';
                this._minimapViewport.style.top = vpTop + 'px';
                this._minimapViewport.style.width = Math.max(10, vpWidth) + 'px';
                this._minimapViewport.style.height = Math.max(10, vpHeight) + 'px';
            }
        }

        // ============================
        // Helpers
        // ============================
        _screenToCanvas(clientX, clientY) {
            const rect = this._container.getBoundingClientRect();
            return {
                x: (clientX - rect.left - this._state.offsetX) / this._state.scale,
                y: (clientY - rect.top - this._state.offsetY) / this._state.scale,
            };
        }

        _findNodeId(el) {
            for (const [id, node] of this._nodes) {
                if (node.el === el || node.el.contains(el)) return id;
            }
            return null;
        }

        _emit(name, detail) {
            this._container.dispatchEvent(new CustomEvent(name, { detail, bubbles: false }));
        }

        // ============================
        // PUBLIC API
        // ============================

        /**
         * Register a node on the canvas
         * @param {string} id - Unique node identifier
         * @param {HTMLElement} el - DOM element for the node
         * @param {number} x - X position on canvas
         * @param {number} y - Y position on canvas
         * @param {object} data - Optional data (e.g. { color: '#f59e0b' })
         */
        addNode(id, el, x, y, data = {}) {
            el.style.position = 'absolute';
            el.style.left = x + 'px';
            el.style.top = y + 'px';

            // Double-click event
            el.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this._emit('ngm:node-dblclick', { nodeId: id, event: e });
            });

            // Context menu event
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._emit('ngm:node-contextmenu', { nodeId: id, event: e });
            });

            this._nodesContainer.appendChild(el);
            this._nodes.set(id, { el, x, y, data });
            this._updateMinimap();
        }

        /**
         * Remove a node from the canvas
         */
        removeNode(id) {
            const node = this._nodes.get(id);
            if (node) {
                node.el.remove();
                this._nodes.delete(id);
                this._selectedNodes.delete(id);

                // Remove connected connections
                for (const [connId, conn] of this._connections) {
                    if (conn.sourceId === id || conn.targetId === id) {
                        this.removeConnection(connId);
                    }
                }

                this._updateMinimap();
            }
        }

        /**
         * Move a node programmatically
         */
        moveNode(id, x, y) {
            const node = this._nodes.get(id);
            if (node) {
                node.x = x;
                node.y = y;
                node.el.style.left = x + 'px';
                node.el.style.top = y + 'px';
                this.redrawConnections();
                this._updateMinimap();
            }
        }

        /**
         * Get a node's current position
         */
        getNodePosition(id) {
            const node = this._nodes.get(id);
            return node ? { x: node.x, y: node.y } : null;
        }

        /**
         * Get a node's bounding rect on the canvas
         */
        getNodeRect(id) {
            const node = this._nodes.get(id);
            if (!node) return null;
            return {
                x: node.x,
                y: node.y,
                width: node.el.offsetWidth || 200,
                height: node.el.offsetHeight || 100,
            };
        }

        /**
         * Get all node rects
         */
        getAllNodeRects() {
            const rects = {};
            for (const [id, node] of this._nodes) {
                rects[id] = {
                    x: node.x,
                    y: node.y,
                    width: node.el.offsetWidth || 200,
                    height: node.el.offsetHeight || 100,
                };
            }
            return rects;
        }

        /**
         * Add a connection between two nodes
         * @param {string} id - Unique connection ID
         * @param {string} sourceId - Source node ID
         * @param {string} targetId - Target node ID
         * @param {object} opts - { color, animated, dashed, arrowhead }
         */
        addConnection(id, sourceId, targetId, opts = {}) {
            const srcNode = this._nodes.get(sourceId);
            const tgtNode = this._nodes.get(targetId);
            if (!srcNode || !tgtNode) return;

            const srcRect = this.getNodeRect(sourceId);
            const tgtRect = this.getNodeRect(targetId);
            const points = this._calcOrthogonalPath(srcRect, tgtRect);
            const groupEl = this._createConnectionGroup(id, points, opts);

            this._svg.appendChild(groupEl);
            this._connections.set(id, { sourceId, targetId, opts, groupEl });
            this._updateMinimap();
        }

        /**
         * Remove a connection
         */
        removeConnection(id) {
            const conn = this._connections.get(id);
            if (conn) {
                conn.groupEl.remove();
                this._connections.delete(id);
                this._updateMinimap();
            }
        }

        /**
         * Remove all connections
         */
        clearConnections() {
            for (const [id, conn] of this._connections) {
                conn.groupEl.remove();
            }
            this._connections.clear();
            this._updateMinimap();
        }

        /**
         * Recalculate and redraw all connections (e.g. after node drag)
         */
        redrawConnections() {
            for (const [id, conn] of this._connections) {
                const srcRect = this.getNodeRect(conn.sourceId);
                const tgtRect = this.getNodeRect(conn.targetId);
                if (!srcRect || !tgtRect) continue;

                const points = this._calcOrthogonalPath(srcRect, tgtRect);
                const pathD = this._buildSVGPath(points);

                // Update existing path elements
                const pathEl = conn.groupEl.querySelector('.ngm-connection-path');
                if (pathEl) pathEl.setAttribute('d', pathD);

                const hitEl = conn.groupEl.querySelector('.ngm-connection-hit-area');
                if (hitEl) hitEl.setAttribute('d', pathD);

                // Update endpoint dots
                const dots = conn.groupEl.querySelectorAll('.ngm-connection-dot');
                if (dots[0]) {
                    dots[0].setAttribute('cx', points[0].x);
                    dots[0].setAttribute('cy', points[0].y);
                }
                if (dots[1]) {
                    dots[1].setAttribute('cx', points[points.length - 1].x);
                    dots[1].setAttribute('cy', points[points.length - 1].y);
                }
            }
        }

        /**
         * Set zoom level
         */
        setScale(s) {
            const minScale = this._getMinScale();
            this._state.scale = Math.max(minScale, Math.min(this._opts.maxScale, s));
            this._applyTransform();
            this._emit('ngm:zoom-change', { scale: this._state.scale });
        }

        /**
         * Zoom towards a point (for mouse wheel zoom)
         */
        zoomAtPoint(delta, x, y) {
            const oldScale = this._state.scale;
            const minScale = this._getMinScale();
            const newScale = Math.max(minScale, Math.min(this._opts.maxScale, oldScale + delta));

            if (newScale !== oldScale) {
                const ratio = newScale / oldScale;
                this._state.offsetX = x - (x - this._state.offsetX) * ratio;
                this._state.offsetY = y - (y - this._state.offsetY) * ratio;
                this._state.scale = newScale;
                this._applyTransform();
                this._emit('ngm:zoom-change', { scale: this._state.scale });
            }
        }

        /**
         * Fit all nodes in the viewport
         */
        fitToView(padding = 80) {
            if (this._nodes.size === 0) return;

            const containerRect = this._container.getBoundingClientRect();
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const [id, node] of this._nodes) {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y);
                maxX = Math.max(maxX, node.x + (node.el.offsetWidth || 240));
                maxY = Math.max(maxY, node.y + (node.el.offsetHeight || 130));
            }

            const contentW = maxX - minX + padding * 2;
            const contentH = maxY - minY + padding * 2;

            const scaleX = containerRect.width / contentW;
            const scaleY = containerRect.height / contentH;
            this._state.scale = Math.min(scaleX, scaleY, 1.2);

            const centerX = minX + (maxX - minX) / 2;
            const centerY = minY + (maxY - minY) / 2;

            this._state.offsetX = containerRect.width / 2 - centerX * this._state.scale;
            this._state.offsetY = containerRect.height / 2 - centerY * this._state.scale;

            this._applyTransform();
            this._emit('ngm:zoom-change', { scale: this._state.scale });
        }

        /**
         * Center viewport on a specific node
         */
        centerOnNode(id) {
            const node = this._nodes.get(id);
            if (!node) return;

            const containerRect = this._container.getBoundingClientRect();
            const centerX = node.x + (node.el.offsetWidth || 200) / 2;
            const centerY = node.y + (node.el.offsetHeight || 100) / 2;

            this._state.offsetX = containerRect.width / 2 - centerX * this._state.scale;
            this._state.offsetY = containerRect.height / 2 - centerY * this._state.scale;

            this._applyTransform();
        }

        /**
         * Get the nodes container DOM element
         */
        getNodesContainer() {
            return this._nodesContainer;
        }

        /**
         * Get the SVG connections layer
         */
        getConnectionsLayer() {
            return this._svg;
        }

        /**
         * Convert screen coordinates to canvas coordinates
         */
        getCanvasCoords(clientX, clientY) {
            return this._screenToCanvas(clientX, clientY);
        }

        /**
         * Get currently selected node IDs
         */
        getSelectedNodes() {
            return [...this._selectedNodes];
        }

        /**
         * Clear all selections
         */
        clearSelection() {
            for (const id of this._selectedNodes) {
                const node = this._nodes.get(id);
                if (node) node.el.classList.remove('ngm-node-selected');
            }
            this._selectedNodes.clear();
            this._emit('ngm:selection-change', { selectedIds: [] });
        }

        /**
         * Get current scale
         */
        getScale() {
            return this._state.scale;
        }

        /**
         * Clean up all event listeners and DOM
         */
        destroy() {
            this._container.removeEventListener('mousedown', this._boundHandlers.onMouseDown);
            document.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
            document.removeEventListener('mouseup', this._boundHandlers.onMouseUp);
            this._container.removeEventListener('wheel', this._boundHandlers.onWheel);
            this._container.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);

            this._nodes.clear();
            this._connections.clear();
            this._selectedNodes.clear();

            this._container.innerHTML = '';
            this._container.classList.remove('ngm-canvas-container');
        }
    }

    window.NGMCanvas = NGMCanvas;

})();
