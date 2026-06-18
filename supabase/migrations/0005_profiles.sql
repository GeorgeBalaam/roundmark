-- Phase 4: account/company settings on profiles + player event RLS.
-- Run after 0004_registrations.sql.

-- Add account/company settings columns to the profiles table.
-- The trigger in 0001_init.sql already creates a row on sign-up;
-- these columns start NULL and are written from /app/settings.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name         text,
  ADD COLUMN IF NOT EXISTS company_name         text,
  ADD COLUMN IF NOT EXISTS website              text,
  ADD COLUMN IF NOT EXISTS default_brand_color  text,
  ADD COLUMN IF NOT EXISTS default_accent_color text,
  ADD COLUMN IF NOT EXISTS default_bg_color     text,
  ADD COLUMN IF NOT EXISTS default_logo_url     text;

-- Allow each user to update their own profile row (needed for /app/settings save).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles update own'
  ) THEN
    CREATE POLICY "profiles update own" ON profiles
      FOR UPDATE USING (id = auth.uid());
  END IF;
END
$$;

-- Allow each user to insert their own profile row (belt-and-suspenders — the
-- trigger covers it, but this prevents a 403 if the trigger somehow races).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles insert own'
  ) THEN
    CREATE POLICY "profiles insert own" ON profiles
      FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END
$$;

-- Players: allow signed-in users to read events where they appear as a player.
-- Checked via JSONB containment on the events.players column.
-- This policy is OR-ed with the existing owner SELECT policy, so organisers
-- still see all their own events regardless.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'players read their events'
  ) THEN
    CREATE POLICY "players read their events" ON events
      FOR SELECT USING (
        auth.email() IS NOT NULL AND
        players @> jsonb_build_array(jsonb_build_object('email', auth.email()))
      );
  END IF;
END
$$;
