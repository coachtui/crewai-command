-- Migration: equipment_inventory and equipment_requests
-- Adds a company-level equipment catalog with quantity tracking,
-- and a request/dispatch workflow for Supe/Foreman → Admin/Manager.
--
-- NOTE: The existing `equipment` table (migration 015) is untouched.
-- equipment_inventory is a separate catalog used for request linking
-- and quantity/location tracking across sites.

-- ============================================================================
-- EQUIPMENT INVENTORY
-- Catalog of company-owned equipment with quantity and location tracking
-- ============================================================================

create table if not exists equipment_inventory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,                           -- e.g. "Heavy Equipment", "Hand Tools", "Power Tools"
  quantity_total integer not null default 1,
  quantity_available integer not null default 1,
  constraint qty_available_nonneg check (quantity_available >= 0),
  constraint qty_available_lte_total check (quantity_available <= quantity_total),
  current_job_site_id uuid references job_sites(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_inventory_org
  on equipment_inventory(organization_id);

create index if not exists idx_equipment_inventory_site
  on equipment_inventory(current_job_site_id);

create trigger update_equipment_inventory_updated_at
  before update on equipment_inventory
  for each row execute function update_updated_at_column();

alter table equipment_inventory enable row level security;

-- All org members can view inventory
create policy "equipment_inventory_select"
  on equipment_inventory for select
  using (organization_id = get_user_org_id());

-- Admin/Manager only: insert
create policy "equipment_inventory_insert"
  on equipment_inventory for insert
  with check (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );

-- Admin/Manager only: update
create policy "equipment_inventory_update"
  on equipment_inventory for update
  using (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );

-- Admin/Manager only: delete
create policy "equipment_inventory_delete"
  on equipment_inventory for delete
  using (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );

-- ============================================================================
-- EQUIPMENT REQUESTS
-- Tracks every request from Supe/Foreman through to receipt
-- ============================================================================

create table if not exists equipment_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,

  -- Link to inventory catalog (nullable — free-text name also stored)
  equipment_inventory_id uuid references equipment_inventory(id) on delete set null,
  -- Denormalized name in case inventory item is later deleted
  equipment_name text not null,

  quantity_requested integer not null default 1,
  constraint qty_requested_positive check (quantity_requested >= 1),

  -- Which site is requesting and where to deliver
  requesting_job_site_id uuid not null references job_sites(id) on delete cascade,
  destination_job_site_id uuid not null references job_sites(id) on delete cascade,

  date_needed date not null,
  notes text,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'dispatched', 'received')),

  -- Workflow actors — reference user_profiles so PostgREST joins work
  requested_by uuid not null references user_profiles(id),
  approved_by uuid references user_profiles(id),
  dispatched_by uuid references user_profiles(id),
  dispatch_notes text,
  dispatched_at timestamptz,
  received_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_equipment_requests_org
  on equipment_requests(organization_id);

create index if not exists idx_equipment_requests_status
  on equipment_requests(status, organization_id);

create index if not exists idx_equipment_requests_requesting_site
  on equipment_requests(requesting_job_site_id);

create index if not exists idx_equipment_requests_destination_site
  on equipment_requests(destination_job_site_id);

create trigger update_equipment_requests_updated_at
  before update on equipment_requests
  for each row execute function update_updated_at_column();

alter table equipment_requests enable row level security;

-- SELECT: Admin/Manager see all for org; others see requests for their assigned sites
create policy "equipment_requests_select"
  on equipment_requests for select
  using (
    organization_id = get_user_org_id()
    and (
      is_user_admin()
      or is_user_manager()
      or requesting_job_site_id = any(get_user_job_site_ids())
      or destination_job_site_id = any(get_user_job_site_ids())
    )
  );

-- INSERT: Supe/Engineer/Foreman can request for their assigned sites; Admin/Manager can also insert
create policy "equipment_requests_insert"
  on equipment_requests for insert
  with check (
    organization_id = get_user_org_id()
    and (
      is_user_admin()
      or is_user_manager()
      or (
        get_user_base_role() in ('superintendent', 'engineer', 'foreman')
        and requesting_job_site_id = any(get_user_job_site_ids())
      )
    )
  );

-- UPDATE: Admin/Manager only (approvals, dispatch, received)
create policy "equipment_requests_update"
  on equipment_requests for update
  using (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );

-- DELETE: Admin/Manager only
create policy "equipment_requests_delete"
  on equipment_requests for delete
  using (
    organization_id = get_user_org_id()
    and (is_user_admin() or is_user_manager())
  );
