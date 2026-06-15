-- Roundmark branding + asset uploads.
-- Adds accent/background colour fields to events and a public Storage bucket
-- for event & sponsor logos. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Extra branding columns
-- ---------------------------------------------------------------------------

alter table public.events add column if not exists accent_color text;
alter table public.events add column if not exists bg_color text;

-- ---------------------------------------------------------------------------
-- Storage bucket for event/sponsor logos (public read, authed write)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('event-assets', 'event-assets', true)
on conflict (id) do nothing;

-- Anyone can read (logos are shown on public leaderboards/scorecards).
drop policy if exists "event-assets read" on storage.objects;
create policy "event-assets read" on storage.objects
  for select using (bucket_id = 'event-assets');

-- Signed-in users (organisers/admins) can upload and manage assets.
drop policy if exists "event-assets insert" on storage.objects;
create policy "event-assets insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-assets');

drop policy if exists "event-assets update" on storage.objects;
create policy "event-assets update" on storage.objects
  for update to authenticated using (bucket_id = 'event-assets');

drop policy if exists "event-assets delete" on storage.objects;
create policy "event-assets delete" on storage.objects
  for delete to authenticated using (bucket_id = 'event-assets');
