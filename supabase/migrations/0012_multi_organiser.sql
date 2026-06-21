-- Multi-organiser: let an event owner invite co-organisers who get full edit
-- access to that event. Run after 0011_notifications_attempts.sql.
--
-- Until now only the event OWNER could write (RLS used is_event_owner). This adds
-- is_event_editor (owner OR an event_members row with role organiser/host) and
-- switches the write policies to it, so co-organisers can actually edit. Ownership
-- itself is protected by a trigger so a co-organiser can't take over the event.
--
-- Invites: the owner adds an email to event_organiser_invites; a branded
-- 'organiser_invite' email is queued (existing notifications drainer); when the
-- invitee signs in, claim_memberships() turns the invite into an organiser
-- membership automatically — no separate accept page needed.

-- 1. Editor predicate: owner or a co-organiser/host member.
create or replace function public.is_event_editor(eid text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from public.events e where e.id = eid and e.owner_id = auth.uid())
      or exists (
        select 1 from public.event_members m
        where m.event_id = eid and m.user_id = auth.uid() and m.role in ('organiser', 'host')
      );
$$;

-- 2. Ownership is immutable via UPDATE (stops a co-organiser reassigning owner_id).
create or replace function public.preserve_event_owner()
returns trigger language plpgsql as $$
begin
  new.owner_id := old.owner_id;
  return new;
end;
$$;
drop trigger if exists events_preserve_owner on public.events;
create trigger events_preserve_owner before update on public.events
  for each row execute function public.preserve_event_owner();

-- 3. Widen write policies from owner-only to editor (owner stays an editor).
drop policy if exists "events update" on public.events;
create policy "events update" on public.events for update
  using (public.is_event_editor(id)) with check (public.is_event_editor(id));

drop policy if exists "scorecards insert" on public.scorecards;
create policy "scorecards insert" on public.scorecards for insert
  with check (public.is_event_scorable(event_id) or public.is_event_editor(event_id));
drop policy if exists "scorecards update" on public.scorecards;
create policy "scorecards update" on public.scorecards for update
  using (public.is_event_scorable(event_id) or public.is_event_editor(event_id))
  with check (public.is_event_scorable(event_id) or public.is_event_editor(event_id));
drop policy if exists "scorecards delete" on public.scorecards;
create policy "scorecards delete" on public.scorecards for delete
  using (public.is_event_editor(event_id));

-- Also tightens the previously world-writable audit insert to editors/scorers.
drop policy if exists "audit insert" on public.audit_logs;
create policy "audit insert" on public.audit_logs for insert
  with check (public.is_event_editor(event_id) or public.is_event_scorable(event_id));

drop policy if exists "registrations insert" on public.registrations;
create policy "registrations insert" on public.registrations for insert
  with check (public.is_registration_open(event_id) or public.is_event_editor(event_id));
drop policy if exists "registrations read" on public.registrations;
create policy "registrations read" on public.registrations for select
  using (public.is_event_editor(event_id));
drop policy if exists "registrations update" on public.registrations;
create policy "registrations update" on public.registrations for update
  using (public.is_event_editor(event_id)) with check (public.is_event_editor(event_id));
drop policy if exists "registrations delete" on public.registrations;
create policy "registrations delete" on public.registrations for delete
  using (public.is_event_editor(event_id));

drop policy if exists "player_contacts owner all" on public.event_player_contacts;
drop policy if exists "player_contacts editor all" on public.event_player_contacts;
create policy "player_contacts editor all" on public.event_player_contacts for all
  using (public.is_event_editor(event_id)) with check (public.is_event_editor(event_id));

drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select
  using (public.is_event_editor(event_id));
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert
  with check (public.is_event_editor(event_id));

-- Co-organisers can see the member list; only the OWNER manages it (insert/
-- update/delete stay owner-or-self from 0007), so a co-organiser can't add or
-- remove other organisers.
drop policy if exists "event_members read" on public.event_members;
create policy "event_members read" on public.event_members for select
  using (user_id = auth.uid() or public.is_event_editor(event_id));

-- 4. Pending co-organiser invites (owner manages; editor can view).
create table if not exists public.event_organiser_invites (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events on delete cascade,
  email text not null,
  role text not null default 'organiser',
  invited_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users on delete set null
);
create index if not exists organiser_invites_event_idx on public.event_organiser_invites (event_id);
create index if not exists organiser_invites_email_idx on public.event_organiser_invites (lower(email));
alter table public.event_organiser_invites enable row level security;

drop policy if exists "organiser_invites read" on public.event_organiser_invites;
create policy "organiser_invites read" on public.event_organiser_invites for select
  using (public.is_event_editor(event_id));
drop policy if exists "organiser_invites insert" on public.event_organiser_invites;
create policy "organiser_invites insert" on public.event_organiser_invites for insert
  with check (public.is_event_owner(event_id));
drop policy if exists "organiser_invites delete" on public.event_organiser_invites;
create policy "organiser_invites delete" on public.event_organiser_invites for delete
  using (public.is_event_owner(event_id));

-- 5. Queue a branded invite email when an invite is created.
create or replace function public.enqueue_organiser_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email = '' then return new; end if;
  insert into public.notifications (event_id, recipient_email, template, data)
  values (new.event_id, new.email, 'organiser_invite', jsonb_build_object('eventId', new.event_id));
  return new;
end;
$$;
drop trigger if exists on_organiser_invite on public.event_organiser_invites;
create trigger on_organiser_invite after insert on public.event_organiser_invites
  for each row execute function public.enqueue_organiser_invite();

-- 6. Auto-accept invites on sign-in (extends the existing claim function).
create or replace function public.claim_memberships()
returns void language plpgsql security definer set search_path = public as $$
declare myemail text;
begin
  select lower(email) into myemail from auth.users where id = auth.uid();

  -- Roster player links (by matching contact email).
  insert into public.event_members (event_id, user_id, role, player_id)
  select c.event_id, auth.uid(),
    case when e.owner_id = auth.uid() then 'organiser' else 'player' end,
    c.player_id
  from public.event_player_contacts c
  join public.events e on e.id = c.event_id
  where c.email is not null and lower(c.email) = myemail
  on conflict (event_id, user_id) do nothing;

  -- Co-organiser invites.
  insert into public.event_members (event_id, user_id, role)
  select i.event_id, auth.uid(), i.role
  from public.event_organiser_invites i
  where i.accepted_at is null and lower(i.email) = myemail
  on conflict (event_id, user_id) do nothing;

  update public.event_organiser_invites
  set accepted_at = now(), accepted_by = auth.uid()
  where accepted_at is null and lower(email) = myemail;
end;
$$;
