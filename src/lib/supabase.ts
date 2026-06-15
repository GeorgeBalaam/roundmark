// Supabase client. The app runs in two modes:
//   - configured:   VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set → real
//                   Postgres backend with realtime + auth (cross-device sync).
//   - unconfigured: env vars missing → the store falls back to localStorage so
//                   the app still runs (e.g. before the keys are added in Vercel).
// The anon key is a public, browser-safe key; never put the service_role key here.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes magic-link redirects
      },
    })
  : null;
