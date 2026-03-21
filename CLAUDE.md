# CLAUDE.md — CrewAI Command

## Project Overview
**CrewAI Command** is a real-time crew scheduling PWA for construction superintendents.
Stack: React 19 + TypeScript + Vite + Supabase + Tailwind CSS + TanStack Query.

## Architecture
- `src/pages/` — route-level page components (admin, foreman, founder subdirs)
- `src/components/` — shared UI and feature components
- `src/lib/` — Supabase client, API layer, utilities
- `src/contexts/` — React context providers
- `src/types/` — TypeScript type definitions
- `api/` — edge/server functions (if present)
- `migrations/` — SQL migration files
- `supabase/` — Supabase config

## Build & Dev Commands
```bash
npm run dev        # Start Vite dev server
npm run build      # TypeScript check + Vite build (tsc -b && vite build)
npm run lint       # ESLint
npm run preview    # Preview production build
```

## Critical Standards
- **TS6133 is a build-breaker**: every imported/destructured variable MUST be used.
  Remove unused imports immediately; never leave them behind.
- TypeScript strict mode is active (`tsconfig.app.json`).
- Tailwind for all styling; no inline style objects unless absolutely necessary.
- TanStack Query for all server-state fetching.
- Supabase RLS policies control data access — never bypass them in app code.

## Roles & Access Levels
- `admin` — full access
- `manager` — site-scoped management (can add workers, create job sites, upload files)
- `foreman` — mobile/read-mostly view
- `viewer` — read-only
- `founder` — super-admin (cross-org)

## Supabase Conventions
- `user_profiles` table linked to `auth.users(id)`
- `job_site_assignments` tracks which users are assigned to which sites and in what role
- RLS functions: `get_user_org_id()`, `is_user_admin()`
- Profiles auto-created via DB trigger when auth users are created

## Testing / Verification Checklist
Before marking any task complete:
1. `npm run build` passes with zero TypeScript errors
2. `npm run lint` passes with zero warnings/errors
3. Manual smoke test in browser for the affected feature
4. Check adjacent features are not broken

## Session Workflow
- Session logs → `sessions/YYYY-MM-DD-HHMM.md`
- Active plan → `plans/current-phase.md`
- Progress → `progress.md`
- Latest build report → `reports/latest-build.md`
- Handoff → `handoff.md`
- Project memory → `memory.md`

## Known Pitfalls
- Unused imports break the build (TS6133). Always check after edits.
- `jsPDF` — use `doc.getNumberOfPages()` (instance method), not `doc.internal.getNumberOfPages()`.
- Temp-assigned workers (additional site assignments) must be included alongside primary site workers in daily hours and task assignment modals.
- `job_site_assignments` is the source of truth for site-scoped access — always query it when building roster/assignment features.
