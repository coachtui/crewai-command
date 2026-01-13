# Viewer Role Setup Guide

This guide explains how to set up a read-only "viewer" role for demo purposes without building a full RBAC system.

## What's Been Done

1. **TypeScript Types Updated**: Added `'viewer'` to the User role type
2. **Role Helper Functions Created**: `src/lib/roleHelpers.ts` provides utility functions
3. **SQL File Created**: `add_viewer_role_and_demo_user.sql` contains the database setup

## Setup Steps

### 1. Run the SQL in Supabase

1. Go to your Supabase Dashboard → SQL Editor
2. Get your organization ID first:
   ```sql
   SELECT id, name FROM organizations;
   ```
3. Open `add_viewer_role_and_demo_user.sql` and replace `YOUR_ORG_ID` with your actual org ID
4. **IMPORTANT**: You need to create the auth user first, then update the SQL

### 2. Create the Demo User in Supabase Auth

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" (or "Invite User")
3. Create user with:
   - Email: `demo@example.com` (or your preferred email)
   - Password: `DemoViewer123!` (or your preferred password)
4. Copy the generated User ID (UUID)

### 3. Update and Run the SQL

1. In the SQL file, replace `'demo-viewer-user-id'` with the actual auth user ID you just copied
2. Replace `'YOUR_ORG_ID'` with your organization ID
3. Run the entire SQL script in Supabase SQL Editor

### 4. Disable Edit Buttons for Viewers (Optional but Recommended)

To hide edit buttons and forms for viewers, use the `canEdit()` helper function in your components:

```tsx
import { canEdit } from '../../lib/roleHelpers';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { User } from '../../types';

function YourComponent() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Load current user
    const loadUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();
        setCurrentUser(data);
      }
    };
    loadUser();
  }, []);

  return (
    <div>
      {/* Only show edit button if user can edit */}
      {canEdit(currentUser) && (
        <Button onClick={handleEdit}>Edit</Button>
      )}
      
      {/* Always show view button */}
      <Button onClick={handleView}>View</Button>
    </div>
  );
}
```

## Quick Implementation Examples

### Example 1: Hide Action Buttons

```tsx
import { canEdit } from '../../lib/roleHelpers';

// In your component
{canEdit(currentUser) && (
  <div className="flex gap-2">
    <Button onClick={handleEdit}>Edit</Button>
    <Button onClick={handleDelete}>Delete</Button>
    <Button onClick={handleAdd}>Add New</Button>
  </div>
)}
```

### Example 2: Show Read-Only Message

```tsx
import { isViewer } from '../../lib/roleHelpers';

// At the top of your page
{isViewer(currentUser) && (
  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
    <p className="text-sm text-yellow-600 dark:text-yellow-400">
      You are viewing in read-only mode. Contact an administrator for edit access.
    </p>
  </div>
)}
```

### Example 3: Conditional Form Rendering

```tsx
import { canEdit } from '../../lib/roleHelpers';

// In your modal or form
{canEdit(currentUser) ? (
  <Button onClick={saveChanges}>Save Changes</Button>
) : (
  <Button onClick={closeModal}>Close</Button>
)}
```

## What Viewer Can Do

✅ **Viewers CAN:**
- View all workers, tasks, and assignments
- View daily hours logs
- View weekly summaries
- Export data to CSV/PDF
- View the calendar/Gantt chart
- View all reports and activities

❌ **Viewers CANNOT:**
- Create, edit, or delete workers
- Create, edit, or delete tasks
- Assign or reassign workers
- Log daily hours
- Approve/deny assignment requests
- Modify any data

## Database Security

The RLS (Row Level Security) policies in the SQL file ensure that:
- Viewers can only SELECT (read) data, not INSERT, UPDATE, or DELETE
- Viewers can only see data from their organization
- All data modifications require 'admin' or 'foreman' role

## Testing

1. Log in as the demo viewer user (`demo@example.com`)
2. Navigate through the app
3. Try clicking edit/delete buttons (they should either:
   - Be hidden (if you've implemented the role checks)
   - Show an error from the database (RLS will block the operation)

## Future Enhancements (If Needed)

If you later want a full RBAC system, you could:
- Add more granular permissions (e.g., "can_edit_workers", "can_view_reports")
- Create a permissions table
- Add role management UI
- Implement permission-based routing

But for now, this simple viewer role should work perfectly for demo purposes!

## Login Credentials

Share these credentials with demo users:
- **Email**: `demo@example.com` (or whatever you set)
- **Password**: `DemoViewer123!` (or whatever you set)
- **Access Level**: Read-only (view all, edit nothing)
