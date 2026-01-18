# Column Manager & Auth Filter Implementation

## Overview
Added two new features to the Expenses page:
1. **Authorization Filter** - Filter expenses by authorization status (Authorized/Pending)
2. **Column Manager** - Toggle column visibility with persistent preferences

---

## 1. Authorization Filter

### Changes Made

#### HTML ([expenses.html](expenses.html))
Added filter button to Auth column header (line 164-167):
```html
<th class="col-auth" title="Authorization Status">
    Auth
    <button type="button" class="filter-toggle" data-column="auth" title="Filter">▼</button>
</th>
```

#### JavaScript ([assets/js/expenses.js](assets/js/expenses.js))

**Added to columnFilters state** (line 36):
```javascript
let columnFilters = {
  // ... other columns ...
  auth: []
};
```

**Updated getUniqueColumnValues()** (lines 1622-1625):
```javascript
case 'auth':
  const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
  value = isAuthorized ? 'Authorized' : 'Pending';
  break;
```

**Updated applyFilters()** (lines 368-373):
```javascript
// Authorization filter
if (columnFilters.auth.length > 0) {
  const isAuthorized = exp.auth_status === true || exp.auth_status === 1;
  const authValue = isAuthorized ? 'Authorized' : 'Pending';
  if (!columnFilters.auth.includes(authValue)) return false;
}
```

### How It Works
1. Click the ▼ button next to "Auth" in the table header
2. Dropdown shows two options: "Authorized" and "Pending"
3. Select one or both to filter expenses
4. Click "Apply" to filter the table
5. Click "Clear" to reset the filter

---

## 2. Column Manager

### Changes Made

#### HTML ([expenses.html](expenses.html))

**Added Column Manager button** in toolbar (lines 119-121):
```html
<button type="button" class="btn-toolbar btn-toolbar-secondary" id="btnColumnManager">
    <span style="font-size: 14px;">⚙</span> Columns
</button>
```

**Added Column Manager modal** (lines 335-356):
```html
<div id="columnManagerModal" class="modal-backdrop hidden">
    <div class="modal modal-column-manager">
        <div class="modal-header">
            <div class="modal-title">Manage Columns</div>
            <button type="button" class="modal-close-btn" id="btnCloseColumnManager">&times;</button>
        </div>

        <div class="modal-body">
            <p class="modal-hint">Toggle column visibility. Your preferences are saved automatically.</p>
            <div class="column-checkboxes" id="columnCheckboxes">
                <!-- Checkboxes populated by JS -->
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="btn-modal-secondary" id="btnResetColumns">Reset to Default</button>
            <button type="button" class="btn-modal-primary" id="btnCloseColumnManagerFooter">Done</button>
        </div>
    </div>
</div>
```

#### CSS ([assets/css/expenses_modal.css](assets/css/expenses_modal.css))

Added complete styling for Column Manager modal (lines 720-904):
- Modal backdrop and container
- Two-column checkbox grid layout
- Custom checkbox styling with green check on selection
- Hover effects and transitions
- Responsive design (stacks to single column on small screens)

#### JavaScript ([assets/js/expenses.js](assets/js/expenses.js))

**Column Configuration** (lines 46-60):
```javascript
const COLUMN_CONFIG = [
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'description', label: 'Description', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'vendor', label: 'Vendor', defaultVisible: true },
  { key: 'payment', label: 'Payment', defaultVisible: true },
  { key: 'account', label: 'Account', defaultVisible: true },
  { key: 'amount', label: 'Amount', defaultVisible: true },
  { key: 'receipt', label: 'Receipt', defaultVisible: true },
  { key: 'auth', label: 'Authorization', defaultVisible: true }
];

const COLUMN_VISIBILITY_KEY = 'expensesColumnVisibility';
let columnVisibility = {};
```

**Core Functions** (lines 1757-1877):

1. **initColumnVisibility()** - Loads saved preferences from localStorage
2. **populateColumnCheckboxes()** - Renders checkboxes in modal
3. **applyColumnVisibility()** - Shows/hides columns based on preferences
4. **saveColumnVisibility()** - Persists preferences to localStorage
5. **resetColumnVisibility()** - Resets all columns to default (all visible)
6. **openColumnManager() / closeColumnManager()** - Modal controls

**Event Listeners** (lines 1554-1571):
- Column Manager button click
- Modal close buttons (X and Done)
- Reset button
- Checkbox change events (saves automatically on toggle)

**Integration** (lines 1908-1909, 423-424):
- `initColumnVisibility()` called during app initialization
- `applyColumnVisibility()` called after each table render

### How It Works

1. **Opening Column Manager**:
   - Click the "⚙ Columns" button in the toolbar
   - Modal opens with checkboxes for all columns
   - Checkboxes reflect current visibility state

2. **Toggling Columns**:
   - Check/uncheck any column
   - Changes apply instantly to the table
   - Preferences auto-save to localStorage

3. **Persistence**:
   - Visibility preferences stored as JSON in localStorage
   - Key: `expensesColumnVisibility`
   - Example: `{"date": true, "vendor": false, "auth": true, ...}`

4. **Reset to Default**:
   - Click "Reset to Default" button
   - All columns become visible
   - Saved preferences cleared

5. **Column Index Mapping**:
   ```javascript
   const columnIndexMap = {
     date: 0,
     description: 1,
     type: 2,
     vendor: 3,
     payment: 4,
     account: 5,
     amount: 6,
     receipt: 7,
     auth: 8
     // actions column (index 9) always visible
   };
   ```

---

## Implementation Pattern

This implementation follows the same pattern as the Pipeline Manager's layout system:

### Similarities with Pipeline Layout Manager
1. **Modal-based configuration** - Settings in a dedicated modal
2. **localStorage persistence** - User preferences saved between sessions
3. **Checkbox grid layout** - Two-column grid of toggle options
4. **Auto-save on change** - No "Apply" button needed for column toggles
5. **Reset functionality** - Button to restore defaults

### Key Differences
- **Simpler scope** - Only manages visibility, not widths or positioning
- **No slider control** - Columns are binary (visible/hidden)
- **Instant feedback** - Changes apply immediately without re-layout calculations

---

## Testing Checklist

### Authorization Filter
- [ ] Click Auth column filter button
- [ ] Dropdown appears with "Authorized" and "Pending" options
- [ ] Select "Authorized" → table shows only authorized expenses
- [ ] Select "Pending" → table shows only pending expenses
- [ ] Select both → table shows all expenses
- [ ] Click "Clear" → filter resets
- [ ] Filter works in combination with other column filters

### Column Manager
- [ ] Click "⚙ Columns" button in toolbar
- [ ] Modal opens with all columns checked by default
- [ ] Uncheck "Vendor" → Vendor column disappears from table
- [ ] Check "Vendor" again → Vendor column reappears
- [ ] Toggle multiple columns → all changes apply instantly
- [ ] Close modal → column visibility persists
- [ ] Refresh page (Ctrl+R) → column visibility still matches previous state
- [ ] Click "Reset to Default" → all columns become visible
- [ ] Close and reopen modal → checkboxes match current visibility state

### Persistence Testing
- [ ] Hide 3 columns (e.g., Type, Payment, Account)
- [ ] Close the page completely
- [ ] Reopen the expenses page
- [ ] Load a project with expenses
- [ ] Verify the 3 columns are still hidden
- [ ] Open Column Manager → verify checkboxes reflect hidden state

### Edge Cases
- [ ] Hide all columns except Date and Amount → table still renders
- [ ] Apply auth filter with hidden Auth column → filter still works
- [ ] Switch between projects → column visibility persists
- [ ] Total row respects hidden columns (colspan adjusts correctly)

---

## Technical Notes

### localStorage Structure
```json
{
  "expensesColumnVisibility": {
    "date": true,
    "description": true,
    "type": false,
    "vendor": true,
    "payment": false,
    "account": true,
    "amount": true,
    "receipt": true,
    "auth": true
  }
}
```

### Column Visibility Implementation
Uses CSS `display: none` to hide columns:
```javascript
th.style.display = isVisible ? '' : 'none';
td.style.display = isVisible ? '' : 'none';
```

### Why Actions Column is Always Visible
The Actions column (delete/edit) is intentionally excluded from the Column Manager because:
1. Critical functionality - users always need access to edit/delete
2. Small column - doesn't clutter the interface
3. No data content - purely functional

---

## Files Modified

| File | Lines Changed | Description |
|------|--------------|-------------|
| `expenses.html` | 119-121, 164-167, 335-356 | Added Column Manager button, Auth filter toggle, modal HTML |
| `assets/css/expenses_modal.css` | 720-904 | Column Manager modal styles |
| `assets/js/expenses.js` | Multiple sections | Column config, visibility functions, auth filter logic |

---

## Future Enhancements

Possible improvements for future versions:

1. **Column Reordering** - Drag-and-drop to reorder columns
2. **Column Width Control** - Slider like Pipeline Manager for individual column widths
3. **Preset Layouts** - Save/load different column configurations (e.g., "Compact View", "Full Details")
4. **Export with Filters** - Export only visible columns and filtered rows
5. **User-specific Defaults** - Different default visibility per user role
6. **Quick Toggle** - Right-click column header to toggle visibility

---

**Created**: 2026-01-17
**Status**: ✅ Complete and Ready for Testing
