# Process Manager - Architecture Reference

## Files
- `process_manager.html` - Page structure, modals, containers
- `assets/js/process_manager.js` - All logic (~8000 lines)
- `assets/css/process_manager.css` - All styles (~6300 lines)

## State Object (line ~753)
```
state.canvas = {scale, offsetX, offsetY, isDragging, dragStart}
state.customModules = []           // Main modules array
state.moduleConnections = []       // Module-to-module connections
state.selectedModules = []         // Multi-select IDs
state.selectedFlowNode = null      // Single selected flow node
state.selectionBox = {active, startX, startY, endX, endY}
state.connectionMode = {active, sourceId, sourceRect, mouseX, mouseY}
state.nodePositions = {}           // "groupBy_nodeId" => {x, y}
state.navigationStack = []         // [{level, processId, nodeId}]
state.departments = []
```

## Data Models

### Module
```
{id, name, description, shortDescription, longDescription,
 icon, color, departmentId, type, size, shape,
 isImplemented, isCustom, connectedToHub,
 subProcessNodes: [], subProcessConnections: [],
 linkedProcesses: [], createdAt}
```

### SubProcessNode
```
{id, name, description, shortDescription, longDescription,
 icon, type, size, shape, is_implemented,
 position: {x, y}}
```

### Connection
```
{id, sourceId, targetId, createdAt}
```

### SubProcessConnection
```
{id, source, target, sourcePort, targetPort}
```

## DOM Hierarchy
```
#canvasContainer          (mouse events: pan, zoom, selection)
  #canvasGrid             (CSS transform: translate + scale)
    #connectionsLayer     (SVG - tree view connections)
    #snapGuides           (alignment guide lines)
    #selectionBox         (multi-select rectangle)
    #treeViewContainer    (Level 1 - .tree-node elements, data-id)
    #detailViewContainer  (Level 2 - .flow-node elements, data-node-id)
      .detail-connections-svg  (SVG - detail view connections)
```

## Shape System
Type auto-determines shape on save (line ~2018):
- decision, milestone -> diamond
- event -> circle
- step, draft, link, algorithm -> rectangle

CSS class applied: `shape-diamond`, `shape-circle`, or none (rectangle).
`effectiveShape` in createFlowNode (line ~6747) also normalizes `size-milestone` -> diamond.

## Node Element Differences

| Attribute     | Tree View            | Detail View          |
|---------------|----------------------|----------------------|
| Base class    | `.tree-node`         | `.flow-node`         |
| ID attribute  | `data-id`            | `data-node-id`       |
| Container     | `treeViewContainer`  | `detailViewContainer`|
| Connection SVG| `connectionsLayer`   | `.detail-connections-svg` |
| Ports class   | `.connection-port`   | `.flow-port`         |
| Drag function | `makeDraggable`      | `makeDetailNodeDraggable` |

## Key Functions by Category

### Initialization
- `init()` ~1320 - Main entry point
- `cacheElements()` ~1273 - Populate elements object
- `setupEventListeners()` ~1382 - Canvas and toolbar handlers
- `initConnectionDragging()` ~7365 - Port drag setup

### Persistence (Supabase)
- `loadCustomModules()` ~986 / `saveCustomModules()` ~1052
- `loadModuleConnections()` ~1071 / `saveModuleConnections()` ~1083
- `loadNodePositions()` ~952 / `saveNodePositions()` ~971

### Module CRUD
- `addCustomModule()` ~1168 / `updateCustomModule()` ~1222 / `deleteCustomModule()` ~1236
- `saveModule()` ~2004 - Modal save handler (both modules and sub-process nodes)
- `saveSubProcessNode()` ~1898 / `updateSubProcessNode()` ~1967 / `deleteSubProcessNode()` ~1992

### Tree View Rendering (Level 1)
- `renderTreeView()` ~3606 - Main render
- `createCustomModuleNode(module, x, y)` ~3748 - Create tree node DOM
- `redrawConnections(nodeRects)` ~3804 - Draw all SVG connections
- `createOrthogonalConnection(points, color, isDraft, id)` ~3964 - Create SVG path
- `calculateOrthogonalPath(...)` ~3900 - Calculate right-angle path
- `buildCurrentNodeRects()` ~4212 - Get all node bounding boxes

### Detail View Rendering (Level 2)
- `renderModuleDetailView(module)` ~2620 - Main detail render
- `renderSubProcessNodesOnCanvas(module, nodes)` ~2818 - Place sub-nodes
- `createFlowNode(node, x, y, processId)` ~6744 - Create flow node DOM
- `redrawDetailConnections(module, nodes, rects)` ~3128 - Draw detail SVG connections

### Node Dragging
- `makeDraggable(node, nodeId, onDragEnd)` ~4051 - Tree view drag (group drag support)
- `makeDetailNodeDraggable(nodeEl, moduleId, nodeId, onDrag)` ~2881 - Detail view drag (group drag support)
- Both call `onDrag` on every mousemove -> redraw connections in real-time

### Snap Alignment
- `calculateSnap(draggedId, x, y, w, h)` ~4274 - Tree view snap
- `calculateDetailSnap(draggedId, x, y, w, h, nodes)` ~3028 - Detail view snap
- `renderSnapGuides(guides)` ~4361 / `clearSnapGuides()` ~4395
- SNAP_THRESHOLD = 12px

### Connection Dragging (Port-to-Port)
- `handleFlowPortMouseDown(e)` ~7386 - Start from flow port
- `handlePortMouseDown(e)` ~7435 - Start from tree port
- `handleConnectionDragMove(e)` ~7525 - Update preview line
- `handleConnectionDragEnd(e)` ~7541 - Complete or cancel
- `connectionDragState` object tracks: isDragging, sourceNodeId, sourcePort, isDetailView
- `createTempConnectionLine()` ~7759 - SVG preview line
- Works for both tree and detail views (detects via isDetailView flag)

### Multi-Select (Right-click drag)
- `handleCanvasMouseDown(e)` ~5448 - button===2 starts selection box
- `handleCanvasMouseMove(e)` ~5519 - Updates box + highlights
- `handleCanvasMouseUp(e)` ~5555 - Finishes selection
- `highlightModulesInSelection()` ~5601 - Real-time highlight (both views)
- `finishSelection()` ~5633 - Commit selection (both views)
- `clearModuleSelection()` ~5666 - Clear all (both views)
- `toggleModuleSelection(moduleId)` ~5674 - Ctrl+click (both views)
- Queries `.tree-node` or `.flow-node` depending on which view has nodes

### Canvas Controls
- `handleCanvasWheel(e)` ~5689 - Zoom
- `applyCanvasTransform()` ~5743 - Apply scale + translate
- `centerOnContent()` ~5836 / `centerOnHub()` ~5805

### Navigation
- `navigateToDetail(groupId)` ~2459 - Enter Level 2
- `navigateBack()` ~2500 - Go back one level
- `navigateToTree()` ~2545 - Return to Level 1
- `updateBreadcrumb()` ~3486
- `updateURL()` ~3357 / `handleURLNavigation()` ~3390

### Detail Panel (right-side info)
- `openModuleDetailPanel(moduleId)` ~1679
- `closeModuleDetailPanel()` ~1723

### Context Menus
- `showContextMenu(e, moduleId)` ~2130 - Tree node right-click
- `showFlowNodeContextMenu(e, nodeId, processId)` ~2165 - Flow node right-click

### Icons & Badges
- `getIconSvg(icon, color)` ~7293 - Get SVG by icon name (tree view)
- `getFlowNodeIcon(node)` ~6950 - Get icon by node type (flow view)
- `getFlowNodeBadge(node)` ~6989 - Get type badge label

### Utilities
- `escapeHtml(text)` ~7266
- `showToast(message, type)` ~7342
- `getNodeWidth(size)` ~6695 / `getNodeHeight(node)` ~6705
- `getModuleDimensions(size)` ~4235

## CSS Color Scheme
- Primary (live): `#3ecf8e` (green)
- Draft: `#6b7280` (gray)
- Milestone: `#a78bfa` (purple)
- Decision: `#fbbf24` (gold)
- Event: `#10b981` (emerald)
- Algorithm: `#60a5fa` (blue)
- Link: `#f472b6` (pink)
- Background: `#0d0d0d`, Surfaces: `#111111`, Borders: `#1f1f1f`

## Connection Styles
- Tree view implemented: green dashed animated (`flowDash 0.8s`)
- Tree view draft: gray dashed static
- Detail view: green dashed animated (`.detail-connection`)
- Temp preview: green dashed static (`.connection-temp`)
- All use `stroke-dasharray: 8 4` pattern

## CSS Specificity Notes
- `type-milestone` sets round+orange, but `shape-diamond.type-milestone` overrides to diamond+purple
- `type-decision` sets styles, but `shape-diamond.type-decision` overrides border-radius
- Shape classes should always win over type classes for geometric properties
- Diamond labels positioned ABOVE the shape (`bottom: 100%`)

## Exposed API (window.processManager)
```
navigateToModuleDetail, linkProcessToModule,
unlinkProcessFromModule, addSubProcessNode, editSubProcessNode
```
