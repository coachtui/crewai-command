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

## Testing

To test as a viewer:
1. Log in as `demo@example.com` with the password you set up
2. Navigate to "Daily Hours" from the sidebar
3. Verify the yellow read-only banner appears
4. Verify action buttons show "View only" instead of edit controls
5. Click "View Weekly Summary" to see the weekly report
6. Test CSV and PDF export functionality
7. Confirm all data displays correctly

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
- `VIEWER_ROLE_SETUP.md` - Initial viewer role setup documentation
- `add_viewer_role_and_demo_user.sql` - Database setup for viewer role
