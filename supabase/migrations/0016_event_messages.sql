-- Broadcast messaging: organiser announcements shown live on every device
-- connected to the event (scorers, leaderboard, TV). One-way only (no player
-- chat). Run after 0015_awards.sql.

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists event_messages_event_idx on public.event_messages (event_id, created_at desc);

alter table public.event_messages enable row level security;

-- Public read: anon scorers / leaderboard / TV viewers must receive announcements.
-- Editors (owner + co-organisers) can post and remove them.
drop policy if exists "event_messages read" on public.event_messages;
create policy "event_messages read" on public.event_messages for select using (true);
drop policy if exists "event_messages insert" on public.event_messages;
create policy "event_messages insert" on public.event_messages for insert
  with check (public.is_event_editor(event_id));
drop policy if exists "event_messages delete" on public.event_messages;
create policy "event_messages delete" on public.event_messages for delete
  using (public.is_event_editor(event_id));

-- Realtime: add to the publication so INSERTs broadcast to connected clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_messages'
  ) then
    alter publication supabase_realtime add table public.event_messages;
  end if;
end $$;
