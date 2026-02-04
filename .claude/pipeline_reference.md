# Pipeline Manager - Architecture Reference

## Files (modular, ~9250 lines total)
- `pipeline.html` - Page structure (~335 lines)
- `assets/js/pipeline.js` - Core logic: auth, rendering, filtering, state (~1878 lines, 43 functions)
- `assets/js/pipeline_table_interactions.js` - Inline cell editing (~1037 lines, 131+ functions)
- `assets/js/pipeline_automations.js` - Task automation rules (~395 lines)
- `assets/js/pipeline_catalog_picker.js` - Custom catalog dropdown (~524 lines)
- `assets/js/pipeline_edit_task_ui.js` - Edit task modal (~587 lines)
- `assets/js/pipeline_new_task_ui.js` - New task modal (~309 lines)
- `assets/js/pipeline_people_picker.js` - User selection picker (~499 lines)
- `assets/js/pipeline_links_modal.js` - Task linking UI (~278 lines)
- `assets/js/pipeline_realtime.js` - Supabase WebSocket subscriptions (~208 lines)
- `assets/js/pipeline_layout.js` - Modal layout controls (~166 lines)
- `assets/css/pipeline_styles.css` - All styles (~3035 lines)

## Architecture
Modular JS files (not monolithic like expenses/process_manager). Each file handles a specific subsystem and exports functions used by the core `pipeline.js`.

## Key Features
- **Inline table editing** - Click any cell to edit (text, dates, dropdowns, people picker)
- **Real-time sync** - Supabase WebSocket for INSERT/UPDATE/DELETE events
- **Custom pickers** - Catalog picker (project, company, department, type, priority), People picker (Monday.com style)
- **Smart DOM updates** - Reconciliation/diffing to update only changed elements
- **Layout persistence** - Visible groups, columns, panel width saved to localStorage
- **Filtering** - Multi-field filters (project, owner, priority) with live rendering
- **Arturito AI integration** - Copilot filtering by natural language

## Core: pipeline.js (~1878 lines)

### State
- `currentUser`, auth headers
- `tasks[]`, `filteredTasks[]` - Main task data
- `metaData` - projects, companies, departments, types, priorities, people
- Layout prefs in localStorage (visible groups, columns, panel width)
- Filter state (project, owner, priority)

### Key Functions
- `initAuth()` - Firebase auth + API user fetch
- `loadMetaData()` - Load catalogs (projects, companies, etc.)
- `loadTasks()` - GET /api/tasks
- `renderTasksTable()` - Main table render with grouping
- `applyFilters()` - Multi-field filtering
- `saveTask()` / `updateTask()` / `deleteTask()` - CRUD
- `exportTasks()` - CSV/Excel export

## Inline Editing: pipeline_table_interactions.js (~1037 lines)

### Cell Types
- **Text** - Task name (input)
- **Textarea** - Description (expandable)
- **Date** - Due date, start date, deadline (date picker)
- **People** - Owner/assignee (custom people picker component)
- **Catalog** - Project, company, department, type, priority (custom dropdown)
- **Number** - Hours estimation (numeric input)
- **Status** - Task status toggle

### Pattern
1. Click cell -> renders inline editor
2. Change value -> `updateTaskField(taskId, field, value)`
3. API call: `PATCH /api/tasks/{id}`
4. DOM update (smart reconciliation, not full re-render)

## Real-time: pipeline_realtime.js (~208 lines)
- Supabase WebSocket channel subscription
- Handles INSERT, UPDATE, DELETE events
- Updates local `tasks[]` array + re-renders affected rows
- Prevents echo (ignores own changes via user_id check)

## Custom Pickers

### Catalog Picker (pipeline_catalog_picker.js ~524 lines)
- Generic dropdown for any catalog (project, company, dept, type, priority)
- Search/filter within options
- Renders inline in table cell
- `openCatalogPicker(cell, catalogType, currentValue, onSelect)`

### People Picker (pipeline_people_picker.js ~499 lines)
- Monday.com style multi-select with avatars
- Search by name
- Shows selected people as chips
- `openPeoplePicker(cell, currentPeople, onSelect)`

## Modals

### New Task (pipeline_new_task_ui.js ~309 lines)
- Dynamically loaded from partial HTML
- Uses catalog pickers and people picker
- `openNewTaskModal()` -> fill form -> `saveNewTask()`

### Edit Task (pipeline_edit_task_ui.js ~587 lines)
- Loads existing task data into form
- Same pickers as new task
- Includes delete confirmation
- `openEditTaskModal(taskId)` -> edit -> `saveEditedTask()`

### Links (pipeline_links_modal.js ~278 lines)
- Link tasks to each other (dependencies, related)
- Search and select target task
- `openLinksModal(taskId)`

## Automations: pipeline_automations.js (~395 lines)
- Rule-based automation (e.g., "when status changes to X, set assignee to Y")
- Automation rules stored per project
- `checkAutomations(task, changedField)` - Evaluates rules on field change

## Layout: pipeline_layout.js (~166 lines)
- Column visibility toggle
- Group visibility (by project, status, etc.)
- Panel resize (drag to resize detail panel)
- All persisted to localStorage

## API Endpoints
- `GET /api/tasks` - Load all tasks (filterable by project)
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/{id}` - Update single field
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/{id}/links` - Get task links
- `POST /api/tasks/{id}/links` - Create link
- Metadata: `/api/projects`, `/api/companies`, `/api/departments`, `/api/task-types`, `/api/priorities`, `/api/people`

## Key Differences from Other Modules
- **Modular architecture** (11 files) vs monolithic (expenses, process_manager)
- **Real-time sync** via WebSocket (unique to pipeline)
- **Inline editing** (no modal needed for most edits)
- **PATCH updates** (single field) vs batch saves
