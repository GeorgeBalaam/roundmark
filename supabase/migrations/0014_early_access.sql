-- Early-access interest list (pre-launch lead capture). Run after 0013.
--
-- Anyone can register interest (anon insert); the row is PII (email/name), so
-- only admins can read it. A SECURITY DEFINER trigger queues a branded
-- confirmation email via the existing notifications drainer.

create table if not exists public.early_access (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  company text,
  source text default 'site',
  created_at timestamptz not null default now()
);
create index if not exists early_access_created_idx on public.early_access (created_at desc);

alter table public.early_access enable row level security;

drop policy if exists "early_access insert" on public.early_access;
create policy "early_access insert" on public.early_access for insert with check (true);

drop policy if exists "early_access admin read" on public.early_access;
create policy "early_access admin read" on public.early_access for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Queue a branded "you are on the list" email on signup.
create or replace function public.enqueue_early_access_welcome()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email = '' then return new; end if;
  insert into public.notifications (event_id, recipient_email, template, data)
  values (null, new.email, 'early_access_received', jsonb_build_object('firstName', coalesce(new.name, '')));
  return new;
end;
$$;
drop trigger if exists on_early_access_welcome on public.early_access;
create trigger on_early_access_welcome after insert on public.early_access
  for each row execute function public.enqueue_early_access_welcome();
