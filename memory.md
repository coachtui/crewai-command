# Project Memory — CrewAI Command

## Stack
- React 19 + TypeScript (strict) + Vite + Supabase + Tailwind CSS + TanStack Query
- jsPDF + html2canvas for PDF export
- Sonner for toasts, lucide-react for icons

## Key Implementation Decisions
- **TS6133 is a hard build error** — unused imports must be removed at point of editing.
- **jsPDF page count**: use `doc.getNumberOfPages()` on the instance, not `doc.internal.getNumberOfPages()`.
- **Temp/additional-site workers**: workers with additional `job_site_assignments` (not their primary site) must be explicitly included in daily hours tracking and task assignment modals. They are NOT automatically included via primary site queries alone.
- **Supabase auth flow**: `user_profiles.id` is FK to `auth.users(id)`. Auth user must exist before profile. The DB trigger auto-creates profiles when auth users are created.
- **RLS helper functions**: `get_user_org_id()` and `is_user_admin()` are the basis for all RLS policies.
- **Manager role**: can create job sites, add worker site assignments, upload shared files.
- **PDF export**: Daily Hours report has a preview-before-export modal added recently.

## Recurring Pitfalls
- Leaving unused imports after refactors → TS6133 build error.
- Forgetting to include temp-assigned workers in aggregate queries (daily hours, task assignments).
- `job_site_assignments` must be queried for both primary and additional site workers.

## Working Test Commands
```bash
npm run build    # full type-check + bundle
npm run lint     # ESLint
```

## Repo Conventions
- SQL migration files live in root (many diagnostic/fix .sql files) and `migrations/`
- Feature branches not actively used — main branch is the working branch
- Documentation files are .md in root (many historical troubleshooting docs)
