-- Optional one-line strapline shown under the date/venue on the public event page.
-- Public marketing content, lives on the world-readable events row (no PII).
alter table public.events add column if not exists hero_tagline text;
