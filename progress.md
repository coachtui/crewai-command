# Progress Tracker — CrewAI Command

## In Progress
- None

## Completed

| Task | Completed | Git | Notes |
|------|-----------|-----|-------|
| Mobile adaptability fixes (5 issues) | 2026-04-07 | e0395e0 | Nav bar offset, ListItem overflow, DailyHours buttons, Tasks header, Equipment hover |
| Migration 024: backfill daily_hours job_site_id | 2026-04-07 | 4dbc473 | Restores historical hours hidden by NULL job_site_id — **run in Supabase SQL editor** |
| Equipment # required on dispatch | 2026-04-07 | aab45e9 | DispatchModal blocks confirm until eq # entered |
| Capture make/model/serial during dispatch | 2026-04-07 | 6f549c3 | Dispatch modal pre-fills from inventory; writes to equipment + inventory |
| Admin all-sites Equipment tab | 2026-04-07 | b04ac83 | No site selected → all org equipment grouped by site |
| Equipment make/model/serial + movement log | 2026-04-07 | aa54b6f | Migration 023; InventoryItemHistory component; dispatch syncs equipment table |
| Equipment Request & Dispatch system | 2026-04-07 | 3b75d40 | Migration 022; full request workflow; Requests + Inventory tabs on Equipment page |
| Scope daily hours to job site | 2026-03-31 | ff233be | Prevent cross-site hour bleed |
| Restore Edit Task button in task details modal | 2026-03-31 | d5ef34b | Site Schedule and Gantt |
| Standardize week start to Sunday | 2026-03-31 | aaf6468 | All task grouping and Gantt logic |
| Gantt PDF export tabloid landscape | 2026-03-31 | 7db2326 | Row-snapping page breaks |
| Per-site crew assignment + temp workers in Workers tab | 2026-03-31 | 7db2326 | Migration 019 |
| PDF preview before export on daily hours report | pre-session | 12d97d3 | |
| Fix temp-assigned workers not appearing in daily hours | pre-session | 7740f63 | |
| Include temp-assigned workers in daily hours tracking | pre-session | 29ff9f9 | |
| Fix worker site assignments not showing on roster | pre-session | 2b70611 | |
| Refresh worker roster when site assignments change | pre-session | 4a70596 | |
| Manager role: add worker site assignments | pre-session | c8b9d75 | |
| Manager role: create job sites | pre-session | 0d833e8 | |
| Fix TS6133 unused import in WorkerManagement | pre-session | 9c0fd94 | |
| Fix worker duplication in dashboard (multi-site) | pre-session | ac64f80 | |
| Fix jsPDF getNumberOfPages | pre-session | ac64f80 | |
| Daily PDF export (manhours + daily notes) | pre-session | 9b4876b | |
| Daily notes summary inline on Daily Hours page | pre-session | 690f8e5 | |
| Equipment management page + daily notes modal | pre-session | 690f8e5 | Migration 015 |

## Blocked
_(none)_

## Decisions Made
- jsPDF: use `doc.getNumberOfPages()` not `doc.internal.getNumberOfPages()`
- Temp-assigned workers must be explicitly queried from `worker_site_assignments` for all aggregate features
- TS6133 is treated as a build-breaking error; unused imports removed immediately
- `daily_hours.job_site_id` was nullable from migration 001 — future migrations touching this table must account for NULL records
- New table FKs referencing users must point to `user_profiles(id)`, not `auth.users(id)`, for PostgREST joins
- `equipment_inventory` is the request/catalog layer; `equipment` is the site tracker. Dispatch syncs both.
- equipment_movement_log is insert-only (immutable audit trail)

## Parking Lot
- RLS policy cleanup — many diagnostic .sql files in root from early troubleshooting
- Consider moving all SQL files into `migrations/` for hygiene
- Push notification / email alert when equipment request status changes (TODO comments in code)
- Equipment QR code scan to mark received (TODO comment in code)
- Equipment quantity refinement for partial dispatches (TODO comment in code)
- Equipment attached to specific crew or task (TODO comment in code)
