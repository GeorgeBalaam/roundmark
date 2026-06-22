-- Start time of the day (HH:MM), shown alongside the date so players know when
-- the day begins. Run after 0016_event_messages.sql.
alter table public.events add column if not exists start_time text;
