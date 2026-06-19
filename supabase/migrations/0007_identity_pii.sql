-- Per-event identity/membership + relocation of player PII out of the public
-- events row. Run after 0006_scoring_mode.sql.
--
-- Why: events are world-readable (public leaderboards) and players JSONB carried
-- email/phone/dietary — leaking PII over REST and Realtime. This moves those
-- fields into an owner-only table, and replaces email-matching for personal
-- history with a proper per-event membership.
--
-- IMPORTANT: deploy the matching client (which stops writing PII into
-- events.players and writes event_player_contacts instead) together with this
-- migration. Run this promptly after the deploy goes live.

-- 1. Entitlements source (single 'full' plan for now; see src/lib/entitlements.ts).
alter table public.profiles add column if not exists plan text not null default 'full';

-- 2. Per-event membership (replaces email-matching for "my events").
create table if not exists public.event_members (
  event_id text not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'player',  -- organiser | host | scorer | player
  player_id text,                        -- roster player in events.players this user is
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_members_user_idx on public.event_members (user_id);

alter table public.event_members enable row level security;

drop policy if exists "event_members read" on public.event_members;
create policy "event_members read" on public.event_members for select
  using (user_id = auth.uid() or public.is_event_owner(event_id));

drop policy if exists "event_members insert" on public.event_members;
create policy "event_members insert" on public.event_members for insert
  with check (user_id = auth.uid() or public.is_event_owner(event_id));

drop policy if exists "event_members update" on public.event_members;
create policy "event_members update" on public.event_members for update
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

drop policy if exists "event_members delete" on public.event_members;
create policy "event_members delete" on public.event_members for delete
  using (user_id = auth.uid() or public.is_event_owner(event_id));

-- 3. Owner-only player contact PII (moved out of events.players).
create table if not exists public.event_player_contacts (
  event_id text not null references public.events on delete cascade,
  player_id text not null,
  email text,
  phone text,
  dietary text,
  primary key (event_id, player_id)
);
alter table public.event_player_contacts enable row level security;

drop policy if exists "player_contacts owner all" on public.event_player_contacts;
create policy "player_contacts owner all" on public.event_player_contacts for all
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

-- 4. Backfill contacts from the existing players JSONB.
insert into public.event_player_contacts (event_id, player_id, email, phone, dietary)
select e.id, p->>'id', nullif(p->>'email', ''), nullif(p->>'phone', ''), nullif(p->>'dietary', '')
from public.events e, jsonb_array_elements(e.players) p
where p->>'id' is not null
  and ((p->>'email') <> '' or (p->>'phone') <> '' or (p->>'dietary') <> '');

-- 5. Backfill memberships for roster players whose email matches an account, so
--    existing players keep their personal history.
insert into public.event_members (event_id, user_id, role, player_id)
select c.event_id, u.id,
  case when e.owner_id = u.id then 'organiser' else 'player' end,
  c.player_id
from public.event_player_contacts c
join auth.users u on lower(u.email) = lower(c.email)
join public.events e on e.id = c.event_id
where c.email is not null
on conflict (event_id, user_id) do nothing;

-- 5b. Ensure every event owner has an organiser membership for their own events.
insert into public.event_members (event_id, user_id, role)
select e.id, e.owner_id, 'organiser'
from public.events e
where e.owner_id is not null
on conflict (event_id, user_id) do update set role = 'organiser';

-- 6. Strip PII fields from the public players JSONB.
update public.events e
set players = (
  select coalesce(jsonb_agg(p - 'email' - 'phone' - 'dietary'), '[]'::jsonb)
  from jsonb_array_elements(e.players) p
)
where jsonb_typeof(e.players) = 'array';

-- 7. The old email-based read policy is superseded by membership; events stay
--    publicly readable (now PII-free) for leaderboards.
drop policy if exists "players read their events" on public.events;

-- 8. claim_memberships(): a signed-in user links themselves to any roster player
--    whose contact email matches their account email. SECURITY DEFINER so it can
--    read the owner-only contacts table; only ever inserts rows for auth.uid().
create or replace function public.claim_memberships()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_members (event_id, user_id, role, player_id)
  select c.event_id, auth.uid(),
    case when e.owner_id = auth.uid() then 'organiser' else 'player' end,
    c.player_id
  from public.event_player_contacts c
  join public.events e on e.id = c.event_id
  join auth.users u on u.id = auth.uid()
  where c.email is not null and lower(c.email) = lower(u.email)
  on conflict (event_id, user_id) do nothing;
end;
$$;
