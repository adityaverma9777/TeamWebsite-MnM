create extension if not exists "pgcrypto";
create table if not exists public.catalyst_confirmations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_email text not null,
  phone_whatsapp text not null,
  adaption_email text not null,
  adaption_completed boolean not null default true,
  h2s_completed boolean not null default true,
  declaration_accepted boolean not null default true,
  submitted_at_ist text not null,
  submission_date_ist text,
  submission_time_ist text,
  submitted_at timestamptz default timezone('Asia/Kolkata', now()),
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);
create index if not exists idx_catalyst_primary_email on public.catalyst_confirmations (primary_email);
create index if not exists idx_catalyst_adaption_email on public.catalyst_confirmations (adaption_email);
create index if not exists idx_catalyst_phone on public.catalyst_confirmations (phone_whatsapp);
create index if not exists idx_catalyst_created_at on public.catalyst_confirmations (created_at desc);
alter table public.catalyst_confirmations enable row level security;
drop policy if exists "allow_anon_insert_catalyst_confirmations" on public.catalyst_confirmations;
create policy "allow_anon_insert_catalyst_confirmations" on public.catalyst_confirmations
  for insert
  to anon, authenticated
  with check (true);
drop policy if exists "allow_authenticated_read_catalyst_confirmations" on public.catalyst_confirmations;
create policy "allow_authenticated_read_catalyst_confirmations" on public.catalyst_confirmations
  for select
  to authenticated, service_role
  using (true);
drop policy if exists "allow_authenticated_update_catalyst_confirmations" on public.catalyst_confirmations;
create policy "allow_authenticated_update_catalyst_confirmations" on public.catalyst_confirmations
  for update
  to authenticated, service_role
  using (true);
drop policy if exists "allow_authenticated_delete_catalyst_confirmations" on public.catalyst_confirmations;
create policy "allow_authenticated_delete_catalyst_confirmations" on public.catalyst_confirmations
  for delete
  to authenticated, service_role
  using (true);
grant usage on schema public to anon, authenticated;
grant insert on table public.catalyst_confirmations to anon, authenticated;
grant select, update, delete on table public.catalyst_confirmations to authenticated, service_role;
