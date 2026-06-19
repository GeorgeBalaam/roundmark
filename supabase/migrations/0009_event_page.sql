-- Branded event microsite. Adds public marketing content to the event page
-- (/e/:id): an optional hero image and an ordered list of content blocks.
-- Run after 0008_notifications.sql. Public marketing content only (no PII), so
-- it lives on the world-readable events row. Safe to re-run.

alter table public.events add column if not exists hero_image_url text;
alter table public.events add column if not exists content jsonb not null default '[]'::jsonb;
