# Current Phase Plan

## Phase
**Per-Site Crew Assignment + Multi-Site Worker Visibility**

## Status
✅ Complete — deployed to production (commit 7db2326)

## Phase Objective
Allow workers assigned to multiple job sites to appear in the Workers tab for each site they're on, and be assignable to site-specific crews.

## Deliverables
- [x] `worker_crew_assignments` table (migration 019) — per-site crew membership
- [x] Workers tab includes temp-assigned workers (via `worker_site_assignments`)
- [x] Crew Management panel shows all site workers (primary + temp)
- [x] Crew assignment reads/writes `worker_crew_assignments` not `workers.crew_id`
- [x] DailyHours crew grouping uses `worker_crew_assignments`
- [x] Build clean, pushed, deployed

## Key Decisions
- `worker_crew_assignments(worker_id, job_site_id, crew_id)` replaces `workers.crew_id` for site-scoped crew display (`workers.crew_id` remains in DB but is no longer the source of truth for the UI)
- Workers tab `fetchWorkers` now mirrors DailyHours pattern exactly: fresh `auth.getUser()` + `users` table query for org_id, same `.or()` chained date filters for temp assignments

## Open Blockers
- None

## Next Concrete Actions
- Await next feature/fix request from user
