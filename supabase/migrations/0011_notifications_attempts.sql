-- Retry tracking for the notification drainer (the Resend edge function).
-- The drainer increments `attempts` on each send try and marks a row 'failed'
-- once it hits the cap, so a permanently-bad row (e.g. invalid address) can't
-- loop forever while transient failures still get retried.
alter table public.notifications add column if not exists attempts int not null default 0;

-- Helps the drainer's "pending, not yet exhausted" scan.
create index if not exists notifications_pending_idx
  on public.notifications (status, attempts, created_at);
