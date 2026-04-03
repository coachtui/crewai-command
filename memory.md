# Project Memory — CrewAI Command

## Stack
- React 19 + TypeScript (strict) + Vite + Supabase + Tailwind CSS + TanStack Query
- jsPDF + html2canvas for PDF export
- Sonner for toasts, lucide-react for icons

## Key Implementation Decisions
- **TS6133 is a hard build error** — unused imports must be removed at point of editing.
- **jsPDF page count**: use `doc.getNumberOfPages()` on the instance, not `doc.internal.getNumberOfPages()`.
- **Temp/additional-site workers**: workers assigned via `worker_site_assignments` (not their primary site) must be explicitly included in Workers tab, Daily Hours, and Crew Management. They are NOT automatically included via primary site queries alone.
- **Supabase auth flow**: `user_profiles.id` is FK to `auth.users(id)`. Auth user must exist before profile. The DB trigger auto-creates profiles when auth users are created.
- **RLS helper functions**: `get_user_org_id()`, `is_user_admin()`, `is_user_manager()` are the basis for all RLS policies. Manager ≠ admin in RLS — check both where needed.
- **Manager role**: can create job sites, add worker site assignments, upload shared files.
- **PDF export**: Daily Hours report has a preview-before-export modal.
- **Per-site crew assignment**: `worker_crew_assignments(worker_id, job_site_id, crew_id)` is the source of truth for crew display. `workers.crew_id` exists in DB but is no longer used by the UI for site-scoped views.
- **Worker org_id pattern**: When fetching workers, use `supabase.auth.getUser()` + fresh query to `users` table for `org_id`. Do NOT rely solely on `user.org_id` from the auth context — it can silently fail for certain queries. DailyHours.tsx is the reference implementation.

## Recurring Pitfalls
- Leaving unused imports after refactors → TS6133 build error.
- Forgetting to include temp-assigned workers in aggregate queries (daily hours, task assignments, workers tab, crew management).
- `worker_site_assignments` is queried for temp workers; use the same chained `.or()` date filter pattern as DailyHours.
- Do not use `user.org_id` from auth context for worker sub-queries — use fresh DB lookup instead.

## Working Test Commands
```bash
npm run build    # full type-check + bundle
npm run lint     # ESLint
```

## Repo Conventions
- SQL migration files live in root (many diagnostic/fix .sql files) and `migrations/`
- Feature branches not actively used — main branch is the working branch
- Documentation files are .md in root (many historical troubleshooting docs)
