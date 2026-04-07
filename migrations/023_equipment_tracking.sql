-- Migration: equipment tracking — make/model/serial + movement log
-- Adds make, model, serial_number to equipment_inventory so requests
-- can display full equipment identity on dispatch cards.
-- Creates equipment_movement_log as an immutable audit trail of every move.

-- ============================================================================
-- ADD MAKE / MODEL / SERIAL NUMBER TO EQUIPMENT INVENTORY
-- ============================================================================

alter table equipment_inventory
  add column if not exists make text,
  add column if not exists model text,
  add column if not exists serial_number text;

-- ============================================================================
-- EQUIPMENT MOVEMENT LOG
-- Immutable record of every dispatch. Written when a request is dispatched.
-- Also written when an equipment table record is created or moved as a side-effect.
-- ============================================================================

create table if not exists equipment_movement_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- What moved
  equipment_inventory_id uuid references equipment_inventory(id) on delete set null,
  equipment_id uuid references equipment(id) on delete set null,   -- link to equipment table entry
  equipment_name text not null,

  -- Where
  from_job_site_id uuid references job_sites(id) on delete set null,
  to_job_site_id uuid references job_sites(id) on delete set null,

  -- Who / why
  moved_by uuid references user_profiles(id) on delete set null,
  request_id uuid references equipment_requests(id) on delete set null,
  notes text,

  moved_at timestamptz not null default now()
);

create index if not exists idx_movement_log_org
  on equipment_movement_log(organization_id);

create index if not exists idx_movement_log_inventory
  on equipment_movement_log(equipment_inventory_id);

create index if not exists idx_movement_log_equipment
  on equipment_movement_log(equipment_id);

create index if not exists idx_movement_log_request
  on equipment_movement_log(request_id);

alter table equipment_movement_log enable row level security;

-- Org members can view movement history
create policy "movement_log_select"
  on equipment_movement_log for select
  using (organization_id = get_user_org_id());

-- Admin/Manager can insert log entries (written by dispatch logic)
create policy "movement_log_insert"
  on equipment_movement_log for insert
  with check (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );

-- No update or delete — movement log is immutable
