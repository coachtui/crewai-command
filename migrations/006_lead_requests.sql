-- Migration: 006_lead_requests.sql
-- Creates the lead_requests table for capturing access requests from the landing page

create table if not exists public.lead_requests (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  email      text        not null,
  company    text        not null,
  job_sites  int,
  workers    int,
  notes      text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.lead_requests enable row level security;

-- Allow anonymous inserts (public request-access form)
-- Rate limiting is enforced at the application level (client-side 30s cooldown)
create policy "Anyone can submit a lead request"
  on public.lead_requests
  for insert
  to anon
  with check (true);

-- No read/update/delete policies for anon or authenticated users —
-- lead data is accessed only via service role (admin tooling).

-- Indexes
create index if not exists lead_requests_email_idx      on public.lead_requests (email);
create index if not exists lead_requests_created_at_idx on public.lead_requests (created_at desc);
