-- Awards & prizes: a flexible per-event award list (presets + custom), each with
-- an optional prize and a winner (entered manually or computed from standings).
-- Replaces the rigid sideComps; public marketing/results data on the event row.
-- Run after 0014_early_access.sql.
alter table public.events add column if not exists awards jsonb not null default '[]'::jsonb;
