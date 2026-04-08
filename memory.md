# Project Memory — CrewAI Command

## Stack
- React 19 + TypeScript (strict) + Vite + Supabase + Tailwind CSS + TanStack Query
- jsPDF + html2canvas for PDF export
- Sonner for toasts, lucide-react for icons
- React Router v7 (BrowserRouter — NOT Next.js, no API routes)

## Key Implementation Decisions

### General
- **TS6133 is a hard build error** — unused imports must be removed at point of editing.
- **jsPDF page count**: use `doc.getNumberOfPages()` on the instance, not `doc.internal.getNumberOfPages()`.
- **No Next.js** — stack is Vite + React Router. All API calls are direct Supabase SDK. Edge Functions handle special cases (user creation, notifications).
- **Feature branches not used** — main is the working branch.

### Auth & Multi-Tenancy
- `user_profiles.id` is FK to `auth.users(id)`. Auth user must exist before profile. DB trigger auto-creates profiles when auth users are created.
- **Worker org_id pattern**: use `supabase.auth.getUser()` + fresh `users` table query for org_id. Do NOT use `user.org_id` from auth context for worker sub-queries — `DailyHours.tsx` is the reference.
- **RLS helper functions**: `get_user_org_id()`, `is_user_admin()`, `is_user_manager()`, `get_user_base_role()`, `get_user_job_site_ids()`. Manager ≠ admin in RLS — check both where needed.
- **Manager role**: can create job sites, add worker site assignments, upload shared files.

### Workers & Crews
- **Temp-assigned workers** (via `worker_site_assignments`) must be explicitly included in Workers tab, Daily Hours, Crew Management, and task assignment modals. Not automatically included via primary site queries.
- **Per-site crew assignment**: `worker_crew_assignments(worker_id, job_site_id, crew_id)` is the source of truth. `workers.crew_id` exists in DB but is no longer used by the UI for site-scoped views.
- `worker_site_assignments` uses chained `.or()` date filters — mirror the DailyHours pattern exactly.

### Equipment System (added 2026-04-07)
- **Two separate equipment tables**:
  - `equipment` (migration 015) — physical site tracker, behaves like workers. Used by Equipment tab.
  - `equipment_inventory` (migration 022) — company catalog with make/model/serial/qty tracking. Used for request linking and dispatch sync.
- **equipment_requests** (migration 022) — request workflow: pending → approved → dispatched → received.
- **equipment_movement_log** (migration 023) — immutable audit trail written on every dispatch. No UPDATE/DELETE policies.
- **Dispatch side-effects** (in `transitionEquipmentRequest`):
  1. Update `equipment_inventory.current_job_site_id` + decrement `quantity_available`
  2. Persist make/model/serial back to inventory
  3. Find matching `equipment` record by name+org (ilike); create if not found, update location if found
  4. Write movement log entry
- **User FK pattern**: new tables reference `user_profiles(id)`, NOT `auth.users(id)` — required for PostgREST joins to work.
- **Admin all-sites Equipment tab**: when admin has no site selected, fetches all org equipment with job_sites join, groups by site. Selecting a site scopes back to single-site/grouped-by-type view.
- **Role guards for requests**: Admin/Manager approve/dispatch/receive. Supe/Engineer/Foreman submit. RLS enforces this server-side; UI conditionally hides action buttons.

### UI Patterns
- **Modal**: centered overlay (`Modal` component). No bottom-drawer component exists.
- **Tab pattern**: horizontal underline tabs with `useState<TabId>`. See Equipment.tsx or founder/CompanyDetail.tsx.
- **Icons**: lucide-react throughout. Sidebar uses Truck, Users, Briefcase, CalendarClock, Clock, FolderOpen.
- **Minimum tap targets**: 44px height on all interactive elements (mobile-first).
- **PDF export**: Daily Hours report has preview-before-export modal.

## Recurring Pitfalls
- Unused imports → TS6133 build error. Check after every edit.
- Forgetting temp-assigned workers in aggregate queries.
- Using `user.org_id` from auth context for worker sub-queries (use fresh DB lookup).
- `user_profiles.id` vs `auth.users(id)` for FK in new migrations — always use `user_profiles(id)` for joins to work in PostgREST.
- equipment_inventory `quantity_available` must stay ≤ `quantity_total` (DB constraint).
- Movement log is insert-only — do not add UPDATE/DELETE policies.

## Working Commands
```bash
npm run build    # full type-check + bundle (must pass 0 errors before marking done)
npm run lint     # ESLint
npm run dev      # Vite dev server
```

## Migration Sequence
| # | File | What |
|---|------|------|
| 001 | multi_tenant_schema | orgs, job_sites, RLS functions |
| 007 | crews | crew grouping |
| 010 | add_manager_role | manager base_role |
| 013 | worker_site_assignments | temp worker site assignments |
| 015 | equipment_and_daily_notes | equipment + daily_notes tables |
| 019 | worker_crew_assignments | per-site crew membership |
| 020-021 | daily_hours fixes | unique constraint fixes |
| 022 | equipment_requests | equipment_inventory + equipment_requests + RLS |
| 023 | equipment_tracking | make/model/serial on inventory + movement_log |
