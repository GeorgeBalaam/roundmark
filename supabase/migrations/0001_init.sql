-- Roundmark schema + RLS.
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once, then
-- run supabase/seed.sql to load the demo events.
--
-- Design notes:
--  * Event config (holes/players/teams/sponsors) is edited only by the owning
--    organiser, so it lives as JSONB on the events row (single-writer, simple).
--  * Scores are the concurrent, high-write part — one scorecards row PER TEAM
--    keeps two teams scoring at the same time from clobbering each other.
--  * Players never need an account: anon can write scorecards for live, unlocked
--    events. Organisers (owner) can always correct, even when locked/paused.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key, -- app-generated short id (preserves demo deep-links)
  owner_id uuid references auth.users on delete set null,
  name text not null default '',
  date text not null default '',
  venue text not null default '',
  type text not null default 'company',
  format text not null default 'stableford',
  brand_color text default '#27542A',
  logo_url text,
  charity_name text,
  charity_url text,
  status text not null default 'draft',
  locked boolean not null default false,
  scoring_paused boolean not null default false,
  holes jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  teams jsonb not null default '[]'::jsonb,
  sponsors jsonb not null default '[]'::jsonb,
  side_comps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locked_at timestamptz
);

create index if not exists events_owner_idx on public.events (owner_id);

create table if not exists public.scorecards (
  event_id text not null references public.events on delete cascade,
  team_id text not null,
  player_scores jsonb not null default '{}'::jsonb,
  team_scores jsonb not null default '[]'::jsonb,
  submitted_holes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (event_id, team_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events on delete cascade,
  at timestamptz not null default now(),
  by text not null,
  team_id text,
  player_id text,
  hole int,
  action text not null,
  old_value text,
  new_value text
);

create index if not exists audit_event_idx on public.audit_logs (event_id, at desc);

-- ---------------------------------------------------------------------------
-- Helper: is the current user the owner of an event?
-- ---------------------------------------------------------------------------

create or replace function public.is_event_owner(eid text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid and e.owner_id = auth.uid()
  );
$$;

-- Is an event currently open for anonymous scoring?
create or replace function public.is_event_scorable(eid text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid
      and e.status = 'live'
      and e.locked = false
      and e.scoring_paused = false
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles    enable row level security;
alter table public.events      enable row level security;
alter table public.scorecards  enable row level security;
alter table public.audit_logs  enable row level security;

-- Policies are dropped-then-created so this migration is safe to re-run.

-- Profiles: a user manages their own profile; anyone can read display names.
drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update" on public.profiles for update using (auth.uid() = id);

-- Events: public read (leaderboards/results); owner-only writes.
drop policy if exists "events read"   on public.events;
drop policy if exists "events insert" on public.events;
drop policy if exists "events update" on public.events;
drop policy if exists "events delete" on public.events;
create policy "events read"   on public.events for select using (true);
create policy "events insert" on public.events for insert
  with check (auth.uid() = owner_id);
create policy "events update" on public.events for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "events delete" on public.events for delete
  using (auth.uid() = owner_id);

-- Scorecards: public read; writeable by anon when the event is live & open,
-- or any time by the event owner (console corrections).
drop policy if exists "scorecards read"   on public.scorecards;
drop policy if exists "scorecards insert" on public.scorecards;
drop policy if exists "scorecards update" on public.scorecards;
drop policy if exists "scorecards delete" on public.scorecards;
create policy "scorecards read" on public.scorecards for select using (true);
create policy "scorecards insert" on public.scorecards for insert
  with check (public.is_event_scorable(event_id) or public.is_event_owner(event_id));
create policy "scorecards update" on public.scorecards for update
  using (public.is_event_scorable(event_id) or public.is_event_owner(event_id))
  with check (public.is_event_scorable(event_id) or public.is_event_owner(event_id));
create policy "scorecards delete" on public.scorecards for delete
  using (public.is_event_owner(event_id));

-- Audit logs: public read (shown in console); inserts allowed for scorers and
-- owners (corrections + scoring events). TODO(harden): tighten insert policy.
drop policy if exists "audit read"   on public.audit_logs;
drop policy if exists "audit insert" on public.audit_logs;
create policy "audit read"   on public.audit_logs for select using (true);
create policy "audit insert" on public.audit_logs for insert with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes so leaderboards/TV update live.
-- ---------------------------------------------------------------------------

-- Guarded so re-running doesn't error if a table is already in the publication.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scorecards') then
    alter publication supabase_realtime add table public.scorecards;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_logs') then
    alter publication supabase_realtime add table public.audit_logs;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
