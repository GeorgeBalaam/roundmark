-- Roundmark event registration.
-- A public landing page (/e/:eventId) lets people register for an event. They
-- need no account — registration is an anonymous insert, allowed only while the
-- organiser has registration open. Registering does NOT guarantee a spot:
-- the organiser approves each sign-up, which then becomes a player on the roster.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Registration settings live on the event (owner-edited config).
-- Shape: { open: bool, autoApprove: bool, note: text, fields: [...] }
-- ---------------------------------------------------------------------------

alter table public.events
  add column if not exists registration_settings jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Registrations table
-- ---------------------------------------------------------------------------

create table if not exists public.registrations (
  id text primary key,
  event_id text not null references public.events on delete cascade,
  status text not null default 'pending', -- pending | approved | declined | waitlist
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  company text,
  handicap numeric,
  dietary text,
  phone text,
  notes text,
  player_id text,                          -- set when approved → linked roster player
  created_at timestamptz not null default now()
);

create index if not exists registrations_event_idx on public.registrations (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper: is an event currently open for registration?
-- ---------------------------------------------------------------------------

create or replace function public.is_registration_open(eid text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid
      and coalesce((e.registration_settings->>'open')::boolean, false) = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
--  * insert: anyone (anon) while registration is open; owner any time.
--  * select/update/delete: owner only — registrations hold personal data
--    (email, dietary needs) so they are never world-readable.
-- ---------------------------------------------------------------------------

alter table public.registrations enable row level security;

drop policy if exists "registrations insert" on public.registrations;
create policy "registrations insert" on public.registrations for insert
  with check (public.is_registration_open(event_id) or public.is_event_owner(event_id));

drop policy if exists "registrations read" on public.registrations;
create policy "registrations read" on public.registrations for select
  using (public.is_event_owner(event_id));

drop policy if exists "registrations update" on public.registrations;
create policy "registrations update" on public.registrations for update
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

drop policy if exists "registrations delete" on public.registrations;
create policy "registrations delete" on public.registrations for delete
  using (public.is_event_owner(event_id));

-- ---------------------------------------------------------------------------
-- Realtime so the organiser's approval queue updates live.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'registrations') then
    alter publication supabase_realtime add table public.registrations;
  end if;
end $$;
