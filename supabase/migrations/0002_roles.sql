-- Roundmark roles.
-- Adds a role to profiles so we can tell admins, organisers and players apart.
-- Safe to re-run.
--
--   admin     — full access; the only role that can use demo events/mode.
--   organiser — paying customer who creates and runs golf days.
--   player    — attends events; magic-link account for personal history only.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists role text not null default 'organiser';

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin? (usable in RLS later)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap admins on signup.
-- Replaces the trigger function from 0001 so new admin emails are assigned the
-- admin role automatically. Add more emails to the ADMIN_EMAILS list as needed.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_emails text[] := array['george@georgebalaam.com'];
  assigned_role text := 'organiser';
begin
  if lower(new.email) = any (admin_emails) then
    assigned_role := 'admin';
  end if;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    assigned_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Promote any admin who already had a profile before this migration ran.
update public.profiles p
set role = 'admin'
from auth.users u
where u.id = p.id
  and lower(u.email) = any (array['george@georgebalaam.com']);
