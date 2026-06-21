-- Billing seam: build for free, pay to go live. Run after 0012_multi_organiser.sql.
--
-- New accounts default to the free plan (can build/preview drafts but not go
-- live). Going live needs either an annual plan or a per-event pass. This adds
-- the per-event pass table; the plan lives on profiles.plan (added in 0007).
-- No payment provider yet: the app grants passes / upgrades directly, and Stripe
-- slots in later by inserting the same rows after a successful checkout.
--
-- Existing accounts keep their current plan ('full'), so nothing breaks; only
-- new signups inherit the free default.

alter table public.profiles alter column plan set default 'free';

create table if not exists public.event_passes (
  event_id text not null references public.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  source text not null default 'manual',  -- manual | stripe (later)
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_passes_user_idx on public.event_passes (user_id);

alter table public.event_passes enable row level security;

-- An event editor can see passes on their event; only the owner buys one (for self).
drop policy if exists "event_passes read" on public.event_passes;
create policy "event_passes read" on public.event_passes for select
  using (public.is_event_editor(event_id));
drop policy if exists "event_passes insert" on public.event_passes;
create policy "event_passes insert" on public.event_passes for insert
  with check (public.is_event_owner(event_id) and user_id = auth.uid());
