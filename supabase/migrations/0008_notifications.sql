-- Transactional notification seam (provider-agnostic outbox).
-- Run after 0007_identity_pii.sql.
--
-- We are NOT wiring an email provider yet. This captures notification *intent*
-- into a durable outbox the moment it happens (registration received / approved
-- / declined), so adding Resend later is just an edge function that drains
-- pending rows → sends → marks them sent. No app code changes required then.
--
-- Registration emails are enqueued by a SECURITY DEFINER trigger (server-side),
-- so there is no anon insert surface on `notifications` (anon can only insert a
-- registration; the trigger creates the notification). Owner-initiated sends
-- (e.g. "results are in") go through the owner insert policy.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id text references public.events on delete cascade,
  recipient_email text not null,
  template text not null,          -- see src/lib/notifications.ts catalog
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',  -- pending | sent | failed
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index if not exists notifications_status_idx on public.notifications (status, created_at);
create index if not exists notifications_event_idx on public.notifications (event_id);

alter table public.notifications enable row level security;

-- Owner can read their events' notifications (recipient_email is PII) and queue
-- owner-initiated ones. Triggers run as definer and bypass RLS.
drop policy if exists "notifications read" on public.notifications;
create policy "notifications read" on public.notifications for select
  using (public.is_event_owner(event_id));

drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert
  with check (public.is_event_owner(event_id));

-- Enqueue registration notifications server-side.
create or replace function public.enqueue_registration_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email = '' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (event_id, recipient_email, template, data)
    values (new.event_id, new.email, 'registration_received',
      jsonb_build_object('firstName', new.first_name, 'eventId', new.event_id));
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.notifications (event_id, recipient_email, template, data)
      values (new.event_id, new.email, 'registration_approved',
        jsonb_build_object('firstName', new.first_name, 'eventId', new.event_id));
    elsif new.status = 'declined' then
      insert into public.notifications (event_id, recipient_email, template, data)
      values (new.event_id, new.email, 'registration_declined',
        jsonb_build_object('firstName', new.first_name, 'eventId', new.event_id));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_registration_notify on public.registrations;
create trigger on_registration_notify
  after insert or update on public.registrations
  for each row execute function public.enqueue_registration_notification();
