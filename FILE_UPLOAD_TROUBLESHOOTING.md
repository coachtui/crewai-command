# File Upload Troubleshooting Guide

## Issue: Can't Upload Files to Tasks

If you're unable to upload files to tasks, follow these steps to diagnose and fix the issue.

---

## Quick Checklist

- [ ] Storage bucket `task-files` exists in Supabase
- [ ] Storage bucket is set to **Public**
- [ ] Storage policies are configured
- [ ] Database has `attachments` column on tasks table
- [ ] No browser console errors

---

## Step-by-Step Fix

### 1. Check if Storage Bucket Exists

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **Storage** in left sidebar
4. Look for a bucket named `task-files`

**If bucket doesn't exist:**
- Click **New bucket**
- Name: `task-files`
- **Check** "Public bucket"
- Click **Create**

### 2. Verify Bucket is Public

1. In Storage tab, click on `task-files` bucket
2. Click **Settings** (gear icon)
3. Ensure **Public bucket** is enabled
4. If not, toggle it ON and save

### 3. Set Up Storage Policies

Click on `task-files` bucket → **Policies** tab

**You should see 2 policies:**

#### Policy 1: Allow Authenticated Uploads
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-files');
```

#### Policy 2: Allow Public Downloads
```sql
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-files');
```

**To add policies:**
1. Click **New policy**
2. Choose "Get started quickly" → "For full customization"
3. Copy the SQL above into the policy definition
4. Save each policy

### 4. Verify Database Column Exists

Run this SQL in **SQL Editor**:

```sql
-- Check if attachments column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'attachments';
```

**If it returns nothing, add the column:**

```sql
-- Add attachments column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
```

### 5. Test File Upload

1. Go to your app
2. Open DevTools Console (F12)
3. Try uploading a file
4. Check console for error messages

**Common errors and fixes:**

| Error Message | Solution |
|--------------|----------|
| `"new row violates row-level security policy"` | Storage policies missing - see Step 3 |
| `"Bucket not found"` | Create `task-files` bucket - see Step 1 |
| `"The resource already exists"` | File already uploaded, try different file |
| `"Permission denied"` | Make bucket public - see Step 2 |

---

## Manual Bucket Creation (If Needed)

If automated setup doesn't work, create manually:

1. **Supabase Dashboard** → **Storage** → **New bucket**
2. Settings:
   - Name: `task-files`
   - Public: ✅ YES
   - File size limit: 50 MB
   - Allowed MIME types: (leave empty)
3. Click **Create bucket**
4. Go to **Policies** tab
5. Add both policies from Step 3 above

---

## Storage Policies Explained

### Why Public Bucket?
- Files need to be accessible via public URLs
- Task attachments are viewed by multiple users
- RLS policies still control who can upload

### Upload Policy (authenticated)
- Only logged-in users can upload files
- Prevents anonymous uploads
- Tied to user authentication

### Download Policy (public)
- Anyone with the URL can view files
- Allows sharing task files
- Standard for attachments

---

## Testing Checklist

✅ **Bucket exists** - Check Storage tab
✅ **Bucket is public** - Check bucket settings
✅ **Upload policy** - Check Policies tab
✅ **Download policy** - Check Policies tab  
✅ **DB column** - Run SQL query above
✅ **Browser console** - No errors when uploading

---

## Storage Limits

**Supabase Free Tier:**
- 1 GB storage
- 2 GB bandwidth/month

**If you hit limits:**
- Upgrade to Pro plan
- Or use external storage (AWS S3, Cloudflare R2)

---

## Alternative: External Storage Setup

If you prefer not to use Supabase Storage, you can configure external storage:

### Option 1: AWS S3
1. Create S3 bucket
2. Get access keys
3. Update TaskForm.tsx to use AWS SDK

### Option 2: Cloudflare R2
1. Create R2 bucket
2. Get API tokens
3. Update TaskForm.tsx to use R2 API

Contact me if you need help with external storage setup.

---

## Still Having Issues?

1. **Check Supabase Status** - [status.supabase.com](https://status.supabase.com)
2. **Review Console Logs** - Open browser DevTools (F12)
3. **Check Network Tab** - See if upload request is being made
4. **Verify Environment** - Ensure .env has correct Supabase URL/Key

---

## Quick Test Script

Run this in browser console to test upload:

```javascript
// Test if storage is accessible
const { data, error } = await supabase
  .storage
  .from('task-files')
  .list();

if (error) {
  console.error('Storage error:', error);
} else {
  console.log('Storage accessible!', data);
}
```

**Expected result:** Should see file list (even if empty)

---

## Summary

File uploads require:
1. ✅ Storage bucket created (`task-files`)
2. ✅ Bucket set to public
3. ✅ Two storage policies configured
4. ✅ Database column exists (`attachments`)

Follow steps above to verify each requirement is met!
