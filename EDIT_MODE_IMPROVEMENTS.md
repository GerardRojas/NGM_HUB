# Edit Mode UI Improvements

## Overview
Redesigned the edit mode to maintain the table's visual consistency while clearly indicating editable fields.

---

## Problem (Before)

The edit mode drastically changed the table appearance:
- ❌ Column widths changed dramatically
- ❌ Inputs had visible borders and backgrounds
- ❌ Table looked completely different (jarring user experience)
- ❌ Receipt and Auth columns were missing

---

## Solution (After)

Subtle, in-place editing that maintains the table structure:
- ✅ Column widths remain the same
- ✅ Table layout unchanged
- ✅ Visual indicators show editability (dotted borders, subtle background)
- ✅ Receipt and Auth columns visible but not editable
- ✅ Smooth transition between read-only and edit mode

---

## Visual Design

### Edit Mode Indicators

**1. Row Background**
- Subtle green tint: `rgba(34, 197, 94, 0.03)`
- Hover: Slightly stronger `rgba(34, 197, 94, 0.05)`

**2. Editable Cell Border**
- Dotted green border appears around each editable cell
- Border: `1px dashed rgba(34, 197, 94, 0.3)`
- Opacity increases on hover
- Positioned with `::after` pseudo-element

**3. Input Fields**
- **Transparent background** - blends with cell
- **No visible border** - uses cell's dotted border
- **Focus state**: Light green background `rgba(34, 197, 94, 0.08)`
- **Maintains font styling** from read-only mode

---

## Implementation Details

### CSS Changes ([assets/css/expenses_styles.css](assets/css/expenses_styles.css))

**Removed:**
```css
/* OLD: Heavy styling that changed table appearance */
.expenses-table.edit-mode-table {
  min-width: 1400px;
}
.expenses-table.edit-mode-table th,
.expenses-table.edit-mode-table td {
  min-width: 150px; /* Forced wider columns */
}
```

**Added:**
```css
/* NEW: Subtle indicators that preserve layout */

/* Edit mode rows - subtle background */
.expenses-table tbody tr.edit-mode-row {
  background: rgba(34, 197, 94, 0.03);
  transition: background 0.2s ease;
}

.expenses-table tbody tr.edit-mode-row:hover {
  background: rgba(34, 197, 94, 0.05);
}

/* Editable cells - dotted border indicator */
.expenses-table tbody tr.edit-mode-row td.editable-cell::after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px dashed rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  pointer-events: none;
  opacity: 0.6;
}

.expenses-table tbody tr.edit-mode-row td.editable-cell:hover::after {
  opacity: 1;
  border-color: rgba(34, 197, 94, 0.5);
}

/* Inputs - transparent, blend with cell */
.edit-input {
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--text-primary, #e5e7eb);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  position: relative;
  z-index: 1;
}

.edit-input:focus {
  background: rgba(34, 197, 94, 0.08);
  border-radius: 6px;
}
```

### JavaScript Changes ([assets/js/expenses.js](assets/js/expenses.js))

**Updated `renderEditableRow()` function** (lines 475-523):

**Before:**
```javascript
return `
  <tr data-index="${index}" data-id="${expenseId}">
    <td><input type="date" ...></td>
    <td><input type="text" ...></td>
    <!-- Missing Receipt and Auth columns -->
    <td class="col-actions">
      <button type="button" class="btn-row-delete">×</button>
    </td>
  </tr>
`;
```

**After:**
```javascript
return `
  <tr data-index="${index}" data-id="${expenseId}" class="edit-mode-row">
    <td class="editable-cell">
      <input type="date" class="edit-input" data-field="TxnDate" value="${dateVal}">
    </td>
    <td class="col-description editable-cell">
      <input type="text" class="edit-input" data-field="LineDescription" ...>
    </td>
    <td class="editable-cell">
      ${buildSelectHtml('txn_type', ...)}
    </td>
    <!-- ... all columns same as read-only ... -->
    <td class="col-amount editable-cell">
      <input type="number" class="edit-input edit-input--amount" ...>
    </td>
    <td class="col-receipt">${receiptIcon}</td>
    <td class="col-auth">${authBadge}</td>
    <td class="col-actions">
      <button type="button" class="btn-row-delete">×</button>
    </td>
  </tr>
`;
```

**Key Changes:**
1. ✅ Added `edit-mode-row` class to `<tr>`
2. ✅ Added `editable-cell` class to each editable `<td>`
3. ✅ Maintained all columns (Date → Actions, 10 total)
4. ✅ Added Receipt column (read-only, shows 📎 icon)
5. ✅ Added Auth column (read-only, shows badge)
6. ✅ Inputs use `edit-input` class (transparent styling)

---

## User Experience

### Before Edit Mode:
```
[Normal Table]
Date | Description | Type | Vendor | Payment | Account | Amount | 📎 | Auth | ×
```

### After Clicking "Edit Expenses":
```
[Same Table with Subtle Green Tint]
┌───────────────────┐  ← Dotted border appears on hover
│ Date              │  ← Input field (transparent)
└───────────────────┘
Description | Type | Vendor | Payment | Account | Amount | 📎 | Auth | ×
   ↑           ↑       ↑        ↑         ↑         ↑      |   |    |
Editable   Editable  Edit    Edit      Edit      Edit   View Auth Delete
                                                          Only Only
```

### Visual Feedback Flow:

1. **Idle State**
   - Row has subtle green background
   - Dotted borders visible at 60% opacity

2. **Hover Cell**
   - Dotted border becomes fully opaque
   - Border color intensifies
   - Cursor changes to text cursor

3. **Focus Input**
   - Green background appears behind input
   - Text cursor active
   - User can type immediately

4. **Edit Complete**
   - Values update in place
   - No layout shift
   - Click "Save Changes" to commit

---

## Column Behavior in Edit Mode

| Column | Editable | Visual |
|--------|----------|--------|
| Date | ✅ Yes | Date picker input |
| Description | ✅ Yes | Text input with placeholder |
| Type | ✅ Yes | Datalist dropdown |
| Vendor | ✅ Yes | Datalist dropdown |
| Payment | ✅ Yes | Datalist dropdown |
| Account | ✅ Yes | Datalist dropdown |
| Amount | ✅ Yes | Number input (right-aligned) |
| Receipt | ❌ No | Shows 📎 icon if exists |
| Auth | ❌ No | Shows badge (Authorized/Pending) |
| Actions | ⚠️ Partial | Delete button (changes to ×) |

**Note**: Receipt and Auth are only editable in the single-expense modal (double-click a row).

---

## Design Principles

1. **Preserve Layout**
   - Column widths stay the same
   - Table doesn't jump or resize
   - Total row remains at bottom

2. **Subtle Visual Cues**
   - Green is the "edit" color (matches save button)
   - Dotted borders indicate "this is temporary/draft"
   - Minimal opacity changes (3%, 5%, 8%)

3. **Progressive Disclosure**
   - Borders appear on hover (not always visible)
   - Focus state is most prominent
   - Idle state is barely noticeable

4. **Familiar Interactions**
   - Click cell → cursor appears → type
   - Tab → moves to next field
   - Same behavior as spreadsheet applications

---

## Benefits

### For Users:
- ✅ Less disorienting - table doesn't "transform"
- ✅ Clear what's editable without being overwhelming
- ✅ Can see receipt and auth status while editing
- ✅ Familiar spreadsheet-like editing experience

### For Developers:
- ✅ Simpler CSS (fewer overrides)
- ✅ Same column structure in both modes
- ✅ Easier to maintain consistency
- ✅ Column visibility feature works in edit mode

---

## Testing Checklist

### Visual Consistency
- [ ] Column widths match between read-only and edit modes
- [ ] Table doesn't resize when entering edit mode
- [ ] Receipt column visible with correct icons
- [ ] Auth column visible with correct badges
- [ ] Total row remains at bottom with correct styling

### Edit Indicators
- [ ] Rows have subtle green background
- [ ] Dotted borders visible around editable cells
- [ ] Borders become more visible on hover
- [ ] Focus state shows green background in input

### Functionality
- [ ] All fields are editable (Date, Description, Type, Vendor, Payment, Account, Amount)
- [ ] Datalist dropdowns work correctly
- [ ] Delete button works
- [ ] Save/Cancel buttons function properly
- [ ] Receipt icons are clickable (view receipt)
- [ ] Auth badges visible but not clickable

### Edge Cases
- [ ] Empty cells show placeholder text
- [ ] Long descriptions don't overflow
- [ ] Amount formatting preserved (right-aligned, tabular nums)
- [ ] Column visibility works in edit mode
- [ ] Filters remain active in edit mode

---

## Files Modified

| File | Lines | Description |
|------|-------|-------------|
| `assets/css/expenses_styles.css` | 343-440 | Removed heavy edit-mode styling, added subtle indicators |
| `assets/js/expenses.js` | 475-523 | Updated renderEditableRow to match read-only layout |

---

## Before/After Comparison

### Before (Old Edit Mode):
```
Normal Mode:     Edit Mode:
┌─────────────┐  ┌──────────────────┐  ← Much wider!
│ Type        │  │ Type             │
│ Vendor      │  │ Vendor           │
│ Amount      │  │ Amount           │
└─────────────┘  └──────────────────┘
   Receipt ✓        (missing)        ← Lost columns!
   Auth ✓           (missing)
```

### After (New Edit Mode):
```
Normal Mode:     Edit Mode:
┌─────────────┐  ┌·················┐  ← Same width!
│ Type        │  │ Type            │  ← Dotted border
│ Vendor      │  │ Vendor          │
│ Amount      │  │ Amount          │
│ Receipt ✓   │  │ Receipt ✓       │  ← Still visible!
│ Auth ✓      │  │ Auth ✓          │  ← Still visible!
└─────────────┘  └·················┘
```

---

**Created**: 2026-01-17
**Status**: ✅ Complete and Ready for Testing
