# Viewer Role Hours Access

This document explains the changes made to allow the demo@example.com viewer role to access and view the Daily Hours and Weekly Hours pages.

## Changes Made

### 1. Updated DailyHours Page (`src/pages/admin/DailyHours.tsx`)

#### Added Imports
- Imported `User` type and role helper functions (`canEdit`, `isViewer`) from role helpers

#### Added State Management
- Added `currentUser` state to track the logged-in user and their role
- Modified the user loading effect to fetch full user data including role

#### Added Read-Only Notice
- Added a yellow banner at the top of the page for viewer users
- Banner message: "You are viewing in read-only mode. You can view hours and export reports, but cannot log or modify hours."

#### Conditional Action Buttons
- Wrapped all edit action buttons (Log Hours, Mark Off, Mark Transferred) in a `canEdit()` check
- For viewers: Shows "View only" text instead of action buttons
- For admins/foremen: Shows all action buttons as before

## What Viewers Can Do

✅ **Viewers CAN:**
- View the Daily Hours page
- See all worker statuses for any date
- View worker hours, off days, and transfers
- Change the date to view historical data
- View the Weekly Hours Summary
- Export weekly hours to CSV
- Export weekly hours to PDF
- Refresh the data

❌ **Viewers CANNOT:**
- Log hours for workers
- Mark workers as off
- Mark workers as transferred
- Modify any existing hours records
- Access edit modals or forms

## Navigation Access

The Daily Hours page is accessible via:
- Sidebar navigation: "Daily Hours" menu item (accessible to all authenticated users)
- Direct URL: `/daily-hours` (protected by authentication, not role-restricted)

## Database Security

The existing RLS (Row Level Security) policies in Supabase ensure that:
- Viewers can only SELECT (read) from `daily_hours` table
- Any attempt to INSERT, UPDATE, or DELETE will be blocked at the database level
- This provides defense-in-depth security even if UI controls are bypassed

## Database Setup Required

**IMPORTANT:** To enable viewer access to the hours pages, you must run the SQL script in Supabase:

1. Go to Supabase Dashboard → SQL Editor
2. Open the file `enable_viewer_access_to_hours.sql`
3. Run the entire script
4. This will update the RLS (Row Level Security) policies to include viewer role access

The script updates policies on these tables:
- `workers` - Allow viewers to read worker data
- `daily_hours` - Allow viewers to read hours logs
- `tasks` - Allow viewers to read task information (needed for hours display)
- `assignments` - Allow viewers to read assignments
- `assignment_requests` - Allow viewers to read requests

## Testing

To test as a viewer:
1. **First, run the SQL script** `enable_viewer_access_to_hours.sql` in Supabase (see above)
2. Log in as `demo@example.com` with the password you set up
3. Navigate to "Daily Hours" from the sidebar
4. Verify the yellow read-only banner appears
5. Verify action buttons show "View only" instead of edit controls
6. Click "View Weekly Summary" to see the weekly report
7. Test CSV and PDF export functionality
8. Confirm all data displays correctly

## Troubleshooting

### Issue: Viewer cannot see data (empty tables or "No data" messages)

**Cause:** The RLS policies haven't been updated to include viewer role access.

**Solution:** Run the `enable_viewer_access_to_hours.sql` script in Supabase SQL Editor.

### Issue: "Permission denied" errors in console

**Cause:** The viewer role is not included in the SELECT policies for the tables.

**Solution:** Run the `enable_viewer_access_to_hours.sql` script which recreates all policies with viewer access.

### Verification Queries

Run these in Supabase SQL Editor to verify the setup:

```sql
-- Check if viewer user exists and has correct role
SELECT id, email, role, org_id FROM users WHERE role = 'viewer';

-- Check policies on daily_hours table
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'daily_hours';

-- Check policies on workers table
SELECT schemaname, tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'workers';
```

## Technical Implementation

### Role Check Functions Used

```typescript
canEdit(user: User | null): boolean
// Returns true for 'admin' or 'foreman' roles
// Returns false for 'viewer' role or null user

isViewer(user: User | null): boolean
// Returns true for 'viewer' role
// Returns false for other roles or null user
```

### Component Structure

```
DailyHours Component
├── Read-only banner (conditional: isViewer)
├── Date selector (always visible)
├── Worker hours table (always visible)
│   └── Actions column
│       ├── Edit buttons (conditional: canEdit)
│       └── "View only" text (conditional: !canEdit)
├── Weekly Summary Modal (always accessible)
│   ├── Export to CSV (always accessible)
│   └── Export to PDF (always accessible)
└── Edit Modals (only accessible via edit buttons)
```

## Future Enhancements

If additional restrictions are needed:
- Add role-based visibility for specific columns
- Restrict date range access for viewers
- Add audit logging for viewer access
- Implement time-based access expiration
- Add granular permissions for export functionality

## Related Files

- `src/pages/admin/DailyHours.tsx` - Main hours page with viewer restrictions
- `src/lib/roleHelpers.ts` - Role checking utility functions
- `enable_viewer_access_to_hours.sql` - **SQL script to enable viewer access (MUST RUN)**
- `VIEWER_ROLE_SETUP.md` - Initial viewer role setup documentation
- `add_viewer_role_and_demo_user.sql` - Database setup for viewer role
