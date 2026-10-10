-- =====================================================================
-- PatriotHacks — volunteer & judge application tables
-- ---------------------------------------------------------------------
-- Run this once in the Supabase dashboard: SQL Editor → New query →
-- paste → Run. Safe to re-run (everything is IF NOT EXISTS / drop-first).
--
-- Security model: the browser holds the *anon* key, which is public by
-- design. These tables are therefore locked down so anon can INSERT and
-- nothing else — no SELECT, so nobody can read the applicant list from
-- the browser. You read submissions in the dashboard (Table Editor),
-- which uses your own credentials.
--
-- Duplicate guardrail: a unique index on lower(email) per table. A
-- second submission fails with Postgres error 23505, which the form
-- turns into "this email has already applied". Because there is no
-- SELECT policy, the app never has to read the table to enforce this.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Volunteers
-- ---------------------------------------------------------------------
create table if not exists public.volunteers (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  name                  text not null check (char_length(name) between 1 and 120),
  email                 text not null check (char_length(email) between 3 and 254),
  is_gmu_alum           boolean not null,
  reason                text not null check (char_length(reason) between 1 and 2000),
  ack_transportation    boolean not null check (ack_transportation),
  ack_commitment        boolean not null check (ack_commitment),
  ack_code_of_conduct   boolean not null check (ack_code_of_conduct),
  ack_contact           boolean not null check (ack_contact)
);

-- Case-insensitive uniqueness: Alex@gmu.edu and alex@gmu.edu are one person.
create unique index if not exists volunteers_email_unique
  on public.volunteers (lower(email));

-- ---------------------------------------------------------------------
-- Judges — same core fields plus the panel-balancing extras.
-- ---------------------------------------------------------------------
create table if not exists public.judges (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  name                  text not null check (char_length(name) between 1 and 120),
  email                 text not null check (char_length(email) between 3 and 254),
  is_gmu_alum           boolean not null,
  company               text not null check (char_length(company) between 1 and 160),
  job_title             text not null check (char_length(job_title) between 1 and 160),
  expertise             text not null check (char_length(expertise) between 1 and 300),
  reason                text not null check (char_length(reason) between 1 and 2000),
  ack_transportation    boolean not null check (ack_transportation),
  ack_commitment        boolean not null check (ack_commitment),
  ack_code_of_conduct   boolean not null check (ack_code_of_conduct),
  ack_contact           boolean not null check (ack_contact)
);

create unique index if not exists judges_email_unique
  on public.judges (lower(email));

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
-- Enabling RLS is not enough on its own: tables in the public schema
-- carry default grants for the anon/authenticated roles, and adding a
-- policy does not remove them. Revoke everything first, then grant back
-- only INSERT.
-- ---------------------------------------------------------------------
alter table public.volunteers enable row level security;
alter table public.judges     enable row level security;

revoke all on public.volunteers from anon, authenticated;
revoke all on public.judges     from anon, authenticated;

grant insert on public.volunteers to anon;
grant insert on public.judges     to anon;

drop policy if exists "Anyone can submit a volunteer application" on public.volunteers;
create policy "Anyone can submit a volunteer application"
  on public.volunteers for insert to anon with check (true);

drop policy if exists "Anyone can submit a judge application" on public.judges;
create policy "Anyone can submit a judge application"
  on public.judges for insert to anon with check (true);
