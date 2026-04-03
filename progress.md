# Progress Tracker — CrewAI Command

## In Progress
- None

## Completed
| Task | Completed | Notes |
| Per-site crew assignment + temp workers in Workers tab | 2026-03-31 | git: 7db2326; migration 019 |
|------|-----------|-------|
| PDF preview before export on daily hours report | 2026-03-21 (pre-session) | git: 12d97d3 |
| Fix temp-assigned workers not appearing in daily hours | 2026-03-21 (pre-session) | git: 7740f63 |
| Include temp-assigned workers in daily hours tracking | 2026-03-21 (pre-session) | git: 29ff9f9 |
| Fix worker site assignments not showing on roster after add | 2026-03-21 (pre-session) | git: 2b70611 |
| Refresh worker roster when site assignments change | 2026-03-21 (pre-session) | git: 4a70596 |
| Manager role: add worker site assignments | pre-session | git: c8b9d75 |
| Manager role: create job sites | pre-session | git: 0d833e8 |
| Fix TS6133 unused import in WorkerManagement | pre-session | git: 9c0fd94 |
| Fix worker duplication in dashboard (multi-site) | pre-session | git: ac64f80 |
| Fix jsPDF getNumberOfPages | pre-session | git: ac64f80 |
| Daily PDF export (manhours + daily notes) | pre-session | git: 9b4876b |
| Daily notes summary inline on Daily Hours page | pre-session | git: 690f8e5 |
| Equipment management page + daily notes modal | pre-session | git: 690f8e5 |
| Lead Builder bootstrap (CLAUDE.md, memory.md, plans, sessions, reports) | 2026-03-21 | this session |

## Blocked
_(none)_

## Decisions Made
- jsPDF: use `doc.getNumberOfPages()` not `doc.internal.getNumberOfPages()`
- Temp-assigned workers must be explicitly queried from `job_site_assignments` for all aggregate features
- TS6133 is treated as a build-breaking error; unused imports removed immediately

## Parking Lot
- RLS policy cleanup (many diagnostic .sql files in root) — can be cleaned up when stable
- Consider moving all SQL migration files into `migrations/` folder for hygiene
