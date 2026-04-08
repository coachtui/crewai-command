# Current Phase Plan

## Phase
**Equipment Request & Dispatch System** — Complete

## Status
✅ Complete — deployed to production (commits 3b75d40 → aab45e9)

## Phase Objective
Build a two-table equipment system with request workflow, location tracking, and movement history. Supe/Foreman submit requests; Admin/Manager approve, dispatch, and receive. Dispatch automatically syncs both the inventory catalog and the existing equipment site tracker.

## Deliverables
- [x] `equipment_inventory` table (migration 022) — company catalog with qty/location tracking
- [x] `equipment_requests` table (migration 022) — request workflow with status flow
- [x] RLS policies — Admin/Manager manage; Supe/Foreman submit; site-scoped SELECT
- [x] `make`, `model`, `serial_number` on equipment_inventory (migration 023)
- [x] `equipment_movement_log` table (migration 023) — immutable dispatch audit trail
- [x] API layer: `src/lib/api/equipmentRequests.ts` — full CRUD + transitions + movement log
- [x] Types: `EquipmentInventory`, `EquipmentRequest`, `EquipmentRequestStatus`, `EquipmentMovementLog`
- [x] Components: EquipmentRequestForm, EquipmentRequestCard, DispatchModal, EquipmentInventoryForm, EquipmentInventoryCard, EquipmentRequestsTab, EquipmentInventoryTab, MovementHistory
- [x] Equipment page expanded to 3 tabs: Equipment | Requests | Inventory
- [x] Admin all-sites Equipment tab (no site selected → all org equipment grouped by site)
- [x] Dispatch modal captures make/model/serial (required eq #) and syncs to both tables
- [x] Per-item movement history expandable in Inventory tab
- [x] Build clean, pushed to main

## Key Decisions
- User FKs in new migrations reference `user_profiles(id)` not `auth.users(id)` — required for PostgREST joins
- `equipment_inventory` (catalog, qty) and `equipment` (site tracker) serve different purposes; dispatch syncs both
- Dispatch finds existing `equipment` record by name+org (ilike match); creates if missing, moves if found
- movement_log is insert-only; no UPDATE/DELETE RLS policies
- All roles see the Requests tab; action buttons (approve/dispatch/receive) gated on isAdmin client-side + RLS server-side
- Dispatch modal blocks confirm until Equipment # is filled (required field)

## Open TODOs (deferred, comments left in code)
- Push notification / in-app alert when request status changes
- Email notification to Admin when new request submitted
- Attach equipment to specific crew or task
- QR code / tag scan to mark received
- Quantity refinement for partial dispatches

## Next Concrete Actions
- Await next feature/fix request
- Candidate next features: notifications, task-equipment linking, Gantt enhancements, foreman mobile view improvements
