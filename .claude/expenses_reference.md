# Expenses Module - Architecture Reference

## Files
- `expenses.html` - Page structure (~1400 lines)
- `assets/js/expenses.js` - All logic (~10500 lines, 208+ functions)
- `assets/css/expenses_styles.css` - Page styles (~3957 lines)
- `assets/css/expenses_modal.css` - Modal styles (~3001 lines)
- `assets/css/reconcile_modal.css` - Reconciliation UI (~717 lines)
- `assets/css/receipt_upload.css` - File upload (~320 lines)

## State Variables (lines ~10-160)
```
currentUser, canAuthorize, AUTHORIZED_ROLES
expenses[], filteredExpenses[], originalExpenses[]
isEditMode, selectedProjectId, modalRowCounter
metaData = {txn_types, projects, vendors, payment_methods, accounts, bills}

// Duplicate Detection
duplicateClusters[], currentClusterIndex, dismissedDuplicates (Set)

// CSV Import
csvParsedData, csvColumnMapping

// QBO Integration
currentDataSource ('manual'|'qbo'), qboExpenses[]

// Bill View & Reconciliation
isBillViewMode, reconciliationData

// Health Check
missingInfoExpenses[], healthCheckActiveTab

// Column Visibility (localStorage)
columnVisibility config

// Scanned Receipt Mode
scannedReceiptFile, scannedReceiptBillId, scannedReceiptTotal, isScannedReceiptMode
```

## Performance: Lookup Maps (line ~150)
Pre-computed O(1) lookups built by `buildLookupMaps()` (~183):
```
lookupMaps.txnTypes    // TnxType_id -> TnxType_name
lookupMaps.projects    // project_id -> project_name
lookupMaps.vendors     // id -> vendor_name
lookupMaps.paymentMethods  // id -> payment_method_name
lookupMaps.accounts    // account_id -> Name
```

## Data Models

### Expense
```
{expense_id, TxnDate, bill_id, LineDescription,
 TnxType_id, vendor_id, PaymentType/payment_type,
 Account/account_id, Amount, status, auth_status,
 receipt_file, project_id}
```

### Bill
```
{bill_id, bill_number, vendor_id, vendor_name,
 bill_status (open|closed|split),
 expected_total, actual_total, expense_count, bill_notes}
```

### 3-State Authorization
- `status: 'auth'` = Authorized
- `status: 'review'` = Pending Review
- `status: undefined` = Pending (fallback: legacy `auth_status` boolean)

## Key Functions by Category

### Init & Auth
- `initAuth()` ~393 - Auth + role check
- `getApiBase()` ~430 - API base URL
- `getAuthHeaders()` ~440 - Bearer token header
- `apiJson()` ~448 - API wrapper with error handling

### Data Loading
- `loadMetaData()` ~606 - Fetch txn_types, projects, vendors, payment_methods, accounts
- `loadBillsMetadata()` ~663 - Fetch bills from /api/bills
- `loadExpensesByProject()` ~782 - Main data load
- `buildLookupMaps()` ~183 - Build O(1) lookup maps

### Table Rendering
- `renderExpensesTable()` ~2447 - Main table (lazy rendering for 100+ items)
- `renderBillViewTable()` - Aggregated bill view
- `applyFilters()` - Global search + column filters

### Duplicate Detection (~841-2250)
- `detectDuplicateBillNumbers()` ~1043 - Core algorithm
- `levenshteinDistance()` ~881 - String similarity
- `calculateStringSimilarity()` ~915 - Normalized 0-100%
- `loadDismissedDuplicates()` ~951 - Load user dismissed pairs
- `saveDismissedDuplicatePair()` ~991 - Persist dismissed pair
- `createDuplicateReviewPanel()` ~1519 - Draggable panel UI
- `showDuplicateReviewPanel()` ~1470 - Show/manage panel
- Confidence: exact (100%), strong (>80%), likely (>60%)

### Expense CRUD (~2973-4400)
- `deleteExpense()` ~2973 - DELETE /api/expenses/{id}
- `saveAllExpenses()` ~3765 - POST /api/expenses/batch
- `addModalRow()` ~3548 - Add input row to modal
- `openAddExpenseModal()` ~3312 - Open add modal
- `editSingleExpense()` - Open edit modal

### Receipt Handling (~3500-3600)
- `handleFileSelected()` - Validate file (JPG, PNG, GIF, WebP, PDF, max 5MB)
- `handleReceiptDelete()` - Remove receipt
- `renderReceiptUploader()` - Upload UI
- Blob URL cleanup with `URL.revokeObjectURL()`

### Bill Management (~4900-5030)
- `handleBillStatusChange()` - Update bill status
- `getBillMetadata()` / `upsertBillInCache()` - Bill cache

### QBO Integration (~8370-8760)
- `loadQBOStatus()` - Check QBO connection
- `syncQBOExpenses()` - Sync via /api/qbo/sync/{realmId}
- `showQBOMappingModal()` - Customer mapping UI
- `reconcileManualVsQBO()` - Match manual to QBO entries
- `saveReconciliations()` - Save matched pairs

### CSV Import (~6900-7300)
- `importCSV()` - Parse CSV, show column mapping modal, validate, import

### Health Check (~1727-1870)
- `detectMissingInfo()` - Find expenses missing bill# or receipt
- `switchHealthCheckTab()` - Duplicates vs Missing Info
- `updateMissingInfoPanel()` - Render missing items

### Authorization (~3140-3230)
- `toggleAuth()` - Change expense auth status
- `checkPermissions()` - Validate user can authorize
- Roles: CEO, COO, Accounting Manager, Admin Guest

### Column Visibility (~9805-9918)
- `initColumnVisibility()` - Load from localStorage
- `applyColumnVisibility()` - Toggle columns
- `saveColumnVisibility()` - Persist
- 10 columns: date, bill_id, description, type, vendor, payment, account, amount, receipt, auth

### Filtering & Search (~9337-10467)
- `toggleFilterDropdown()` ~9337 - Column filter UI
- `populateFilterOptions()` ~9435 - Unique values per column
- `applyFilterSelection()` ~9490 - Multi-select filters
- Global search with 250ms debounce
- Arturito exposed: `arturitoFilterBy()`, `arturitoClearAllFilters()`, `arturitoClearFilter()`, `arturitoSearch()`

### Reconciliation (~9180-9320)
- `openReconciliationModal()` - Two-table view
- `linkExpenses()` / `viewMatchDetails()` / `saveReconciliations()`

## API Endpoints

### Expenses
- `GET /expenses?project={id}`
- `POST /expenses/batch`
- `PUT /expenses/{id}`
- `DELETE /expenses/{id}`
- `PUT /expenses/{id}/status?user_id={id}`
- `GET /expenses/{id}/audit-trail`

### Bills
- `GET /bills` / `POST /bills` / `PUT /bills/{id}`

### Metadata
- `GET /vendors` / `GET /payment-methods` / `GET /accounts`
- `GET /permissions/check?user_id={id}&action=authorize_expenses`

### Duplicates
- `GET /expenses/dismissed-duplicates?user_id={id}`
- `POST /expenses/dismissed-duplicates`

### QBO
- `GET /qbo/status`
- `POST /qbo/sync/{realmId}`
- `GET /qbo/expenses?project={id}&is_cogs={bool}`
- `GET /qbo/mapping` / `PUT /qbo/mapping/{customer_id}`

## Key Container IDs

### Page
- `#projectFilter` - Project selector
- `#expensesTable` / `#expensesTableBody` - Main table
- `#expensesEmptyState` / `#expensesSkeletonTable`

### Toolbar
- `#btnAddExpense`, `#btnEditExpenses`, `#btnBillView`
- `#btnDetectDuplicates`, `#btnReconcile`, `#btnColumnManager`
- `#btnSourceManual`, `#btnSourceQBO`, `#btnSyncQBO`, `#btnQBOMapping`

### Edit Mode
- `#editModeFooter`, `#selectAllCheckbox`, `#selectedCount`, `#authorizeCount`

### Modals
- `#addExpenseModal` - Add expenses (dynamic rows)
- `#editSingleExpenseModal` - Edit single expense
- `#csvMappingModal` - CSV column mapping
- `#billEditModal` - Bill details
- `#reconciliationModal` - Manual vs QBO
- `#healthCheckModal` - Duplicates + missing info
- `#columnManagerModal` - Column visibility

### Dynamic
- `#duplicateReviewPanel` - Draggable duplicate review (created at runtime)
- `#filterDropdown` / `#filterDropdownOptions` - Column filter menu

## Duplicate Detection Algorithm (~1043)
1. **Exact**: Same bill# + vendor + date
2. **Strong**: Normalized bill ID + Levenshtein >80% on vendor + similar amount
3. **Likely**: Similar date window + amount within threshold + vendor >60%
- Amount threshold: +/-5% for >$1000, +/-10% for <$1000
- User can dismiss pairs (persisted via API)
- Results grouped into clusters

## Scanned Receipt Mode (~3370)
- Receipt scanned -> bill ID extracted -> prevents adding multiple rows
- Shows unlock button for multi-bill receipts
- `isScannedReceiptMode` flag blocks `addModalRow()`

## Bill View Aggregation (~4750)
- Groups expenses by bill
- Calculates expected vs actual totals
- Shows expense count per bill

## Arturito Copilot Integration (~9988)
Exposed functions for AI assistant:
- `arturitoFilterBy(column, value)`
- `arturitoClearAllFilters()`
- `arturitoClearFilter(column)`
- `arturitoSearch(term)`
