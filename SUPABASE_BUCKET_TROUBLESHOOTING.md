# Supabase Bucket Troubleshooting Guide

## Error: "Bucket not found"

This error occurs when the Supabase storage bucket doesn't exist or isn't configured correctly.

---

## Quick Diagnostic

### Run the diagnostic tool in your browser:

1. Open the expenses page
2. Open browser console (F12)
3. Run:
   ```javascript
   window.diagBucket()
   ```

The diagnostic will check:
- ✅ Supabase client library is loaded
- ✅ Configuration is set (URL, Anon Key)
- ✅ Bucket exists
- ✅ Bucket is PUBLIC
- ✅ Upload permissions work
- ✅ Public URLs can be generated

---

## Common Issues & Fixes

### Issue 1: Bucket Doesn't Exist

**Symptoms:**
```
❌ Bucket "expenses-receipts" does not exist
```

**Fix:**
1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project
2. Click **Storage** in sidebar
3. Click **New bucket**
4. Enter name: `expenses-receipts`
5. Toggle **Public bucket** to **ON** ✅
6. Click **Create bucket**

---

### Issue 2: Bucket is Private

**Symptoms:**
```
⚠️  WARNING: Bucket is PRIVATE
Receipts won't be accessible via public URLs
```

**Fix:**
1. Go to Supabase Dashboard → Storage
2. Click on `expenses-receipts` bucket
3. Click **Configuration** or **Settings** tab
4. Toggle **Public bucket** to **ON**
5. Click **Save**

---

### Issue 3: Row Level Security (RLS) Blocking Uploads

**Symptoms:**
```
❌ Upload test failed: row-level security policy violation
```

**Fix - Option A (Recommended): Add Upload Policy**

1. Go to Supabase Dashboard → Storage → `expenses-receipts`
2. Click **Policies** tab
3. Click **New policy**
4. Select **Custom policy**
5. Name: `Allow authenticated users to upload`
6. Policy definition:
   ```sql
   (bucket_id = 'expenses-receipts')
   ```
7. Check: `INSERT` and `UPDATE`
8. Click **Create policy**

**Fix - Option B: Full Access Policy (for testing)**

Run this SQL in Supabase SQL Editor:

```sql
-- Allow all operations for authenticated users
CREATE POLICY "Public Access"
ON storage.objects FOR ALL
USING (bucket_id = 'expenses-receipts');
```

---

### Issue 4: Wrong Bucket Name in Code

**Symptoms:**
```
Available buckets: receipts, documents
❌ Bucket "expenses-receipts" does not exist
```

**Fix:**

If your actual bucket has a different name, update the code:

**File:** `assets/js/receipt-upload.js` (line 30)

```javascript
const SUPABASE_CONFIG = {
  url: window.SUPABASE_URL || 'https://your-project.supabase.co',
  anonKey: window.SUPABASE_ANON_KEY || 'your-anon-key-here',
  bucketName: 'your-actual-bucket-name' // ← Change this
};
```

---

### Issue 5: Missing Supabase Credentials

**Symptoms:**
```
❌ Missing Supabase credentials
```

**Fix:**

Check `assets/js/config.js`:

```javascript
window.SUPABASE_URL = 'https://xxxxxxxxxxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

Find your credentials:
1. Go to Supabase Dashboard → Project Settings
2. Click **API**
3. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

---

## Manual Verification Steps

### 1. Check Bucket Exists

Run in browser console:
```javascript
const { createClient } = window.supabase;
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
const { data, error } = await supabase.storage.listBuckets();
console.log('Buckets:', data);
```

Expected output:
```javascript
[
  { name: 'expenses-receipts', id: '...', public: true }
]
```

---

### 2. Test Upload

Run in browser console:
```javascript
const { createClient } = window.supabase;
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const testFile = new Blob(['test'], { type: 'text/plain' });
const { data, error } = await supabase.storage
  .from('expenses-receipts')
  .upload('test.txt', testFile);

if (error) {
  console.error('Upload failed:', error);
} else {
  console.log('Upload successful:', data);
}
```

---

### 3. Test Public URL

```javascript
const { data } = supabase.storage
  .from('expenses-receipts')
  .getPublicUrl('test.txt');

console.log('Public URL:', data.publicUrl);
// Visit this URL in browser - should work if bucket is public
```

---

### 4. Clean Up Test File

```javascript
const { error } = await supabase.storage
  .from('expenses-receipts')
  .remove(['test.txt']);

console.log(error ? 'Delete failed' : 'Deleted successfully');
```

---

## Bucket Configuration Checklist

Before receipts will work, ensure:

- [ ] Bucket `expenses-receipts` exists in Supabase Storage
- [ ] Bucket is set to **PUBLIC**
- [ ] Upload policy allows authenticated users to insert
- [ ] `SUPABASE_URL` is set in `config.js`
- [ ] `SUPABASE_ANON_KEY` is set in `config.js`
- [ ] Supabase JS library is loaded in HTML (`<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`)
- [ ] User is authenticated (JWT token exists in localStorage)

---

## SQL Policies Reference

### Allow All Operations (Development)
```sql
CREATE POLICY "Allow all for development"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'expenses-receipts')
WITH CHECK (bucket_id = 'expenses-receipts');
```

### Production Policies (Recommended)

**Allow Upload:**
```sql
CREATE POLICY "Allow authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expenses-receipts');
```

**Allow Read:**
```sql
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'expenses-receipts');
```

**Allow Delete (only owner):**
```sql
CREATE POLICY "Allow owner delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expenses-receipts' AND auth.uid() = owner);
```

---

## Expected Flow

### Successful Receipt Upload:

1. User selects file
2. File validates (size, type)
3. Upload to Supabase Storage:
   - Path: `receipts/{expense_id}/{filename}`
   - Returns public URL
4. Save expense with `receipt_url` field
5. Success message shown

### Console Logs (Success):
```
[RECEIPT] Uploading file: invoice.pdf
[RECEIPT] Upload successful: https://xxx.supabase.co/storage/v1/object/public/expenses-receipts/receipts/abc-123/invoice.pdf
[EXPENSES] Expense saved with receipt
```

### Console Logs (Failure):
```
[RECEIPT] Upload failed: Bucket not found
[EXPENSES] Expense saved, but receipt upload failed
```

---

## Diagnostic Tool Output Example

### ✅ All Good:
```
================================
SUPABASE BUCKET DIAGNOSTIC
================================

1. Checking Supabase client library...
✅ Supabase library loaded
✅ createClient available

2. Checking configuration...
   URL: ✅ Set
   Anon Key: ✅ Set
   Bucket Name: expenses-receipts
✅ Configuration complete

4. Listing all storage buckets...
✅ Found 1 bucket(s):
   - expenses-receipts (PUBLIC) [ID: xxx]

5. Checking target bucket: expenses-receipts
✅ Bucket exists
   Name: expenses-receipts
   Public: Yes ✅

6. Testing upload permissions...
✅ Upload successful: test-1234567890.txt

7. Testing public URL generation...
✅ Public URL: https://xxx.supabase.co/storage/v1/object/public/expenses-receipts/test-1234567890.txt

8. Cleaning up test file...
✅ Test file deleted

================================
DIAGNOSTIC COMPLETE
================================
```

---

## Need More Help?

1. Run `window.diagBucket()` and share the output
2. Check Supabase Dashboard → Storage → Policies
3. Check browser console for errors
4. Verify you're logged in (JWT token exists)

---

**Created**: 2026-01-17
**Tool**: [supabase-bucket-diagnostic.js](assets/js/supabase-bucket-diagnostic.js)
