# File Attachments Setup Guide

This guide will help you set up file and image uploads for tasks.

## Step 1: Run Database Migration

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the sidebar
3. Click "New query"
4. Copy and paste the contents of `supabase_attachments_migration.sql`
5. Click **RUN** (or press Cmd/Ctrl + Enter)

This will add the `attachments` column to your tasks table.

## Step 2: Create Storage Bucket

1. In Supabase dashboard, click **Storage** in the sidebar
2. Click **New bucket**
3. Fill in the details:
   - **Name:** `task-files`
   - **Public bucket:** ✅ Check this box (so files are publicly accessible)
   - **File size limit:** Leave default or set to your preference (e.g., 50MB)
   - **Allowed MIME types:** Leave empty to allow all types
4. Click **Create bucket**

## Step 3: Set Storage Policies

1. Click on the `task-files` bucket you just created
2. Click **Policies** tab
3. Click **New policy**

### Policy 1: Allow Uploads (for authenticated users)
- Click **Get started quickly** → **For full customization**
- Fill in:
  - **Policy name:** `Allow authenticated uploads`
  - **Policy definition:** Select **INSERT**
  - **Target roles:** `authenticated`
  - **USING expression:** `true`
  - **WITH CHECK expression:** `true`
- Click **Review** → **Save policy**

### Policy 2: Allow Public Read Access
- Click **New policy** again
- Fill in:
  - **Policy name:** `Allow public downloads`
  - **Policy definition:** Select **SELECT**
  - **Target roles:** `public`
  - **USING expression:** `true`
- Click **Review** → **Save policy**

## Step 4: Test the Feature

1. Make sure your dev server is running (`npm run dev`)
2. Navigate to the Tasks page
3. Click **New Task** or edit an existing task
4. You should see a new **Files & Images** section at the bottom of the form
5. Click **Upload Files** and select images or documents
6. Files will upload to Supabase Storage
7. After saving the task, you'll see a paperclip icon with file count on the task card
8. Click the file count to view all attachments in a modal

## Supported File Types

- **Images:** JPG, JPEG, PNG, GIF, WEBP (shown as previews)
- **Documents:** PDF, DOC, DOCX, XLS, XLSX (shown as file links)

## Troubleshooting

### "Failed to upload" error
- ✅ Make sure the `task-files` bucket exists
- ✅ Check that storage policies are created correctly
- ✅ Verify the bucket is set to **Public**

### Files not displaying
- ✅ Check browser console for errors
- ✅ Verify files were uploaded to Storage (check Storage tab in Supabase)
- ✅ Make sure task has `attachments` column (run migration SQL)

### Storage quota issues
- Free tier: 1GB storage
- Upgrade to Pro for more storage if needed

## How It Works

1. **Upload:** Files are uploaded to Supabase Storage bucket `task-files`
2. **Storage:** Each file gets a unique filename (timestamp + random string)
3. **Database:** Public URLs are stored in the `attachments` JSONB column
4. **Display:** Images show previews, other files show download links
5. **Access:** Files are publicly accessible via the public URL

You're all set! 🎉
