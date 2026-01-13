# Fix for Activities Acknowledge Status Not Persisting

## Problem
When acknowledging activities on the Activities page, the status would change but wouldn't persist after switching pages and coming back.

## Root Cause
The acknowledged status was only stored in React component state and never saved to the database. When the page reloaded, it would fetch fresh data from the database which didn't have the acknowledged status.

## Solution
1. Added an `acknowledged` column to the `assignments` table in the database
2. Updated the Activities page to read acknowledged status from the database
3. Updated acknowledge handlers to persist changes to the database

## How to Apply the Fix

### Step 1: Run the Database Migration

1. Open your Supabase project dashboard
2. Go to **SQL Editor** in the sidebar
3. Click "New query"
4. Copy and paste the contents of `add_acknowledged_to_assignments.sql`:

```sql
-- Add acknowledged field to assignments table
-- This allows tracking which assignment changes have been reviewed by admins

ALTER TABLE assignments 
ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE;

-- Create index for filtering acknowledged/pending activities
CREATE INDEX idx_assignments_acknowledged ON assignments(acknowledged);

-- Update any existing assignments to be unacknowledged
UPDATE assignments SET acknowledged = FALSE WHERE acknowledged IS NULL;
```

5. Click **RUN** (or press Cmd/Ctrl + Enter)
6. You should see "Success" message

### Step 2: Restart Your Development Server

The code changes have already been applied to `src/pages/admin/Activities.tsx`. Just restart your dev server to ensure everything is loaded fresh:

```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run dev
```

### Step 3: Test the Fix

1. Navigate to the Activities page
2. Click "Acknowledge" on any activity
3. Switch to another page (e.g., Workers or Tasks)
4. Come back to the Activities page
5. ✅ The acknowledged status should persist!
6. Test "Acknowledge All" button as well

## What Changed

### Database Schema
- Added `acknowledged` boolean column to `assignments` table (defaults to `false`)
- Added index on `acknowledged` for efficient filtering

### Code Changes (`src/pages/admin/Activities.tsx`)

1. **fetchActivities()** - Now reads `acknowledged` status from database:
   ```typescript
   acknowledged: assignment.acknowledged || false
   ```

2. **handleAcknowledge()** - Now persists to database:
   ```typescript
   const { error } = await supabase
     .from('assignments')
     .update({ acknowledged: true })
     .eq('id', activityId);
   ```

3. **handleAcknowledgeAll()** - Now persists all changes to database:
   ```typescript
   const { error } = await supabase
     .from('assignments')
     .update({ acknowledged: true })
     .in('id', pendingIds);
   ```

## Verification

After applying the fix:
- ✅ Acknowledging activities saves to database
- ✅ Status persists across page navigation
- ✅ Real-time updates still work correctly
- ✅ Filter tabs (Pending/Acknowledged/All) work as expected
- ✅ "Acknowledge All" button updates all pending activities

## Notes
- Existing assignments will default to `acknowledged = false` (unacknowledged)
- The index on `acknowledged` improves query performance when filtering
- Real-time subscriptions will continue to work and update the UI automatically
