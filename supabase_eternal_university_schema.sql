create extension if not exists "pgcrypto";

create table if not exists public.eternal_university_registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  primary_email text not null,
  adaption_email text not null,
  adaption_completed boolean not null default false,
  h2s_completed boolean not null default false,
  orbix_completed boolean not null default false,
  telegram_completed boolean not null default false,
  whatsapp_completed boolean not null default false,
  declaration_accepted boolean not null default false,
  submitted_at_ist text not null,
  submission_date_ist text,
  submission_time_ist text,
  submitted_at timestamptz not null default timezone('Asia/Kolkata', now()),
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);

create index if not exists idx_eternal_university_primary_email
  on public.eternal_university_registrations (primary_email);

create index if not exists idx_eternal_university_adaption_email
  on public.eternal_university_registrations (adaption_email);

create index if not exists idx_eternal_university_created_at
  on public.eternal_university_registrations (created_at desc);

alter table public.eternal_university_registrations enable row level security;

drop policy if exists "allow_anon_insert_eternal_university_registrations"
  on public.eternal_university_registrations;

create policy "allow_anon_insert_eternal_university_registrations"
  on public.eternal_university_registrations
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "allow_authenticated_read_eternal_university_registrations"
  on public.eternal_university_registrations;

create policy "allow_authenticated_read_eternal_university_registrations"
  on public.eternal_university_registrations
  for select
  to authenticated, service_role
  using (true);

grant usage on schema public to anon, authenticated;
grant insert on table public.eternal_university_registrations to anon, authenticated;
grant select on table public.eternal_university_registrations to authenticated, service_role;
