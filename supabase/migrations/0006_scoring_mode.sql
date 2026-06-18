-- Net/handicap scoring. Adds a per-event scoring mode so an event can be played
-- off handicap (net) or scratch (gross). NULL is treated as gross by the app.
-- Run after 0005_profiles.sql. Safe to re-run.

alter table public.events
  add column if not exists scoring_mode text;
