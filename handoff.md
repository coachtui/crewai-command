# Handoff — CrewAI Command

_Last updated: 2026-04-07_

## What Was Just Built
**Equipment Request & Dispatch System** (migrations 022–023, commits 3b75d40–aab45e9)

### Tables Added
| Table | Purpose |
|---|---|
| `equipment_inventory` | Company catalog — make/model/serial/qty/location tracking |
| `equipment_requests` | Request workflow: pending → approved → dispatched → received |
| `equipment_movement_log` | Immutable audit trail of every dispatch |

### UI Changes
- `/equipment` page now has 3 tabs: **Equipment** (existing) | **Requests** | **Inventory**
- Admin/Manager with no site selected → Equipment tab shows ALL org equipment grouped by job site
- Requests tab is role-adaptive: Admin sees all + action buttons; Supe/Foreman see their site only + submit button
- Dispatch modal captures Make, Model, Equipment # (required), Dispatch Notes
- Inventory tab shows per-item movement history (expandable)

### Dispatch Side-Effects (important)
On dispatch, the system:
1. Updates `equipment_inventory.current_job_site_id` + decrements `quantity_available`
2. Persists make/model/serial back to inventory item
3. Searches `equipment` table by name+org; moves existing record or creates new one at destination
4. Writes to `equipment_movement_log`

## Current Status
- **Working**: All existing features + full equipment request/dispatch system
- **In Progress**: Nothing
- **Blocked**: Nothing

## Migrations to Run
If picking this up fresh, run these against Supabase in order:
- `migrations/022_equipment_requests.sql`
- `migrations/023_equipment_tracking.sql`

## Architecture Reminders
- Stack: React 19 + TypeScript + Vite + React Router v7 + Supabase + Tailwind
- **Not Next.js** — no API routes. All data via Supabase SDK + RLS.
- Build: `npm run build` (tsc -b && vite build) — must pass zero TS errors
- TS6133 (unused import) breaks the build — remove immediately on every edit
- User FKs in new tables → `user_profiles(id)`, not `auth.users(id)`
- RLS functions: `get_user_org_id()`, `is_user_admin()`, `is_user_manager()`, `get_user_base_role()`, `get_user_job_site_ids()`
- Temp-assigned workers require explicit `worker_site_assignments` queries in any aggregate feature

## Deferred / Parking Lot
- Equipment notifications (push/email) — TODO comments left in EquipmentRequestsTab
- Equipment QR scan to receive — TODO in EquipmentInventoryTab
- Equipment attached to crew/task — TODO in EquipmentInventoryTab
- Quantity refinement for partial dispatches — TODO in equipmentRequests.ts
- Cleanup of legacy diagnostic .sql files in project root

## Next Steps
1. User provides next feature/fix
2. Update `plans/current-phase.md` with new objective
3. Execute → validate (`npm run build`) → update `progress.md` and this file
