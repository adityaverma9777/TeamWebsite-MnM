create extension if not exists "pgcrypto";

create table if not exists public.orbix_adaption_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  submitted_at_ist text not null,
  submitted_at timestamptz not null default timezone('Asia/Kolkata', now()),
  created_at timestamptz not null default now()
);

create index if not exists idx_orbix_adaption_claims_email
  on public.orbix_adaption_claims (email);

create index if not exists idx_orbix_adaption_claims_created_at
  on public.orbix_adaption_claims (created_at desc);

alter table public.orbix_adaption_claims enable row level security;

drop policy if exists "allow_anon_insert_orbix_adaption_claims"
  on public.orbix_adaption_claims;

create policy "allow_anon_insert_orbix_adaption_claims"
  on public.orbix_adaption_claims
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "allow_authenticated_read_orbix_adaption_claims"
  on public.orbix_adaption_claims;

create policy "allow_authenticated_read_orbix_adaption_claims"
  on public.orbix_adaption_claims
  for select
  to authenticated, service_role
  using (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.orbix_adaption_claims to anon, authenticated;
grant select on table public.orbix_adaption_claims to authenticated, service_role;

