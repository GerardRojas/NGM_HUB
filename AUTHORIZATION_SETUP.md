# Authorization Feature - Setup Instructions

## ✅ Completed Changes

### Frontend
- ✅ Added authorization badges to expenses table
- ✅ Added authorization checkbox to edit modal (only visible to authorized roles)
- ✅ Optimized modal layout (reduced padding and gaps)
- ✅ Added JWT debugger tool for testing
- ✅ Implemented role-based UI controls

### Backend
- ✅ Updated `ExpenseUpdate` model to accept `auth_status` and `auth_by` fields
- ✅ Updated PATCH endpoint documentation

### Database
- ✅ SQL policies configured for RLS (you already ran these)

---

## 🚀 Next Steps to Complete Setup

### 1. Restart Backend API

You need to restart your backend to apply the Pydantic model changes.

#### Option A: Local Backend
```bash
# Stop the current server (Ctrl+C)
# Then restart:
cd "c:\Users\germa\Desktop\NGM_API"
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

#### Option B: Render (Production)
```bash
# Commit and push changes
cd "c:\Users\germa\Desktop\NGM_API"
git add api/routers/expenses.py
git commit -m "Add auth_status and auth_by to ExpenseUpdate model"
git push
```

Wait 2-3 minutes for Render to auto-deploy.

---

### 2. Verify JWT Configuration

Open your expenses page and run this in the browser console:

```javascript
window.debugJWT()
```

You should see output like:
```
====================================
JWT TOKEN DEBUGGER
====================================

📋 HEADER: {...}
👤 PAYLOAD: {...}
🔑 Role from JWT: COO
🆔 User ID: <your-user-id>
⏰ Expires: <date>
✅ Token Status: VALID

🔐 Authorization Status:
   Can authorize expenses: ✅ YES
   Authorized roles: CEO, COO, Accounting Manager, Admin Guest
```

**Important**: If `role` is `null` or incorrect, you need to log out and log in again.

---

### 3. Verify Role Names in Database

Run this in Supabase SQL Editor to ensure role names match:

```sql
SELECT
    rol_id,
    rol_name,
    CASE
        WHEN rol_name IN ('CEO', 'COO', 'Accounting Manager', 'Admin Guest')
        THEN '✅ CAN AUTHORIZE'
        ELSE '❌ CANNOT AUTHORIZE'
    END as authorization_status
FROM rols
ORDER BY rol_name;
```

**If role names don't match exactly** (e.g., "Accounting manager" vs "Accounting Manager"), you have two options:

#### Option A: Update Role Names in Database
```sql
UPDATE rols SET rol_name = 'Accounting Manager' WHERE rol_name = 'Accounting manager';
UPDATE rols SET rol_name = 'Admin Guest' WHERE rol_name = 'admin guest';
-- etc.
```

#### Option B: Update SQL Policies
Update the policy to match your actual role names:
```sql
DROP POLICY IF EXISTS "Allow authorized roles to update auth fields" ON expenses_manual_COGS;

CREATE POLICY "Allow authorized roles to update auth fields"
ON expenses_manual_COGS
FOR UPDATE
TO authenticated
USING (
    (auth.jwt() ->> 'role') IN ('CEO', 'COO', 'your-actual-role-name', 'Admin Guest')
)
WITH CHECK (
    (auth.jwt() ->> 'role') IN ('CEO', 'COO', 'your-actual-role-name', 'Admin Guest')
);
```

---

### 4. Test Authorization Feature

#### Test 1: As Authorized User (CEO, COO, etc.)

1. Login with a COO or CEO account
2. Go to expenses page
3. Select a project
4. Click on an expense row to edit
5. You should see the **Authorization checkbox** at the bottom of the form
6. Check/uncheck it and save
7. The expense should update successfully
8. The badge in the table should change color (yellow → green or green → yellow)

#### Test 2: Click Badge to Toggle (faster method)

1. Click directly on the authorization badge in the table
2. It should toggle between "⏳ Pending" (yellow) and "✓ Auth" (green)
3. Check console for success message: `[AUTH] Authorization updated`

#### Test 3: As Bookkeeper (cannot authorize)

1. Login with a Bookkeeper account
2. The authorization badges should be **disabled** (grayed out)
3. When editing an expense, the authorization checkbox should **not appear**
4. You can still edit other fields (Amount, Description, etc.)

---

## 🐛 Troubleshooting

### Error: "No fields to update"
- **Cause**: Backend not restarted after model changes
- **Solution**: Restart the backend API (see Step 1)

### Checkbox doesn't appear in modal
- **Cause**: User role not in authorized list
- **Solution**:
  1. Run `window.debugJWT()` to check your role
  2. Verify role name matches exactly in database (see Step 3)

### Badge click doesn't work
- **Cause**: Role mismatch or RLS policy blocking update
- **Solution**:
  1. Check console for error messages
  2. Verify role names match (Step 3)
  3. Test RLS policies manually in Supabase SQL Editor

### Authorization updates but badge doesn't change color
- **Cause**: Frontend state not refreshing
- **Solution**: Hard refresh the page (Ctrl+Shift+R)

---

## 📝 Feature Summary

### For Authorized Roles (CEO, COO, Accounting Manager, Admin Guest):
- ✅ Can view all expenses
- ✅ Can add/edit/delete expenses
- ✅ Can authorize expenses via:
  - **Badge click** (quick toggle in table)
  - **Checkbox in edit modal** (when editing expense details)
- ✅ Badge is clickable and shows hover effect

### For Bookkeepers and Other Roles:
- ✅ Can view all expenses
- ✅ Can add/edit/delete expenses
- ❌ **Cannot** authorize expenses
- ❌ Authorization badge is disabled (grayed out, not clickable)
- ❌ Authorization checkbox does not appear in edit modal

---

## 🎨 UI Changes

### Modal Optimization
- Reduced padding: 20px → 16px
- Reduced gap between fields: 16px → 12px
- Reduced input padding: 10px → 9px
- Modal is now more compact and fits more content on screen

### Authorization Checkbox
- Clean, modern checkbox design
- Green gradient when checked
- Disabled state for unauthorized users
- Helpful hint text: "Mark this expense as authorized"

---

## 📞 Next Steps After Testing

Once you've confirmed everything works:

1. Remove the JWT debugger script from production:
   ```html
   <!-- Remove this line from expenses.html -->
   <script src="assets/js/jwt-debugger.js" defer></script>
   ```

2. Consider adding authorization filters to the table:
   - Filter by "Authorized Only"
   - Filter by "Pending Authorization"

3. Optional: Add visual indicator in table for who authorized
   - Show authorizer name on hover
   - Display authorization date/time

---

## 🔒 Security Notes

- Authorization is enforced at **3 levels**:
  1. **UI**: Checkbox/badges hidden from unauthorized users
  2. **Backend**: Pydantic model validates fields
  3. **Database**: RLS policies block unauthorized updates

- JWT roles are read directly from the token payload
- No client-side role manipulation possible
- Database policies are the final security layer

---

**Created**: 2026-01-17
**Author**: Claude Code Assistant
