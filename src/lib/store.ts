// Hybrid store: synchronous in-memory cache backed by localStorage, with
// async Supabase hydration + real-time subscriptions when configured.
//
// React consumers call the same synchronous hooks (useDB, useEvent, useSession)
// regardless of backend mode. Supabase is purely additive: it hydrates the cache
// on load, keeps it fresh via realtime, and persists mutations server-side.

import { useSyncExternalStore } from 'react';
import type { AuditEntry, RoundmarkDB, RoundmarkEvent, Scorecard, UserRole } from './types';
import { buildSeedDB } from './seed';
import { supabase, isSupabaseConfigured } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const STORAGE_KEY = 'roundmark-db-v1';

let cache: RoundmarkDB | null = null;
let storeLoading = false; // true while async Supabase hydration is in progress
const listeners = new Set<() => void>();
const loadingListeners = new Set<() => void>();

let currentUserId: string | null = null;
let currentRole: UserRole = 'organiser';
let realtimeChannel: RealtimeChannel | null = null;

// ---------------------------------------------------------------------------
// Row ↔ app-type mapping
// ---------------------------------------------------------------------------

type SupabaseScorecardRow = {
  team_id: string;
  player_scores: unknown;
  team_scores: unknown;
  submitted_holes: unknown;
  updated_at: string;
};

function scorecardFromRow(row: SupabaseScorecardRow): Scorecard {
  return {
    teamId: row.team_id,
    playerScores: (row.player_scores ?? {}) as Scorecard['playerScores'],
    teamScores: (row.team_scores ?? []) as Scorecard['teamScores'],
    submittedHoles: (row.submitted_holes ?? []) as number[],
    updatedAt: row.updated_at,
  };
}

function eventFromRow(
  row: Record<string, unknown>,
  scRows: SupabaseScorecardRow[],
): RoundmarkEvent {
  return {
    id: row.id as string,
    name: (row.name as string) ?? '',
    date: (row.date as string) ?? '',
    venue: (row.venue as string) ?? '',
    type: (row.type as RoundmarkEvent['type']) ?? 'company',
    format: (row.format as RoundmarkEvent['format']) ?? 'stableford',
    brandColor: (row.brand_color as string) ?? '#27542A',
    accentColor: (row.accent_color as string | null) ?? undefined,
    bgColor: (row.bg_color as string | null) ?? undefined,
    logoUrl: (row.logo_url as string | null) ?? undefined,
    charityName: (row.charity_name as string | null) ?? undefined,
    charityUrl: (row.charity_url as string | null) ?? undefined,
    status: (row.status as RoundmarkEvent['status']) ?? 'draft',
    locked: (row.locked as boolean) ?? false,
    scoringPaused: (row.scoring_paused as boolean) ?? false,
    holes: (row.holes as RoundmarkEvent['holes']) ?? [],
    players: (row.players as RoundmarkEvent['players']) ?? [],
    teams: (row.teams as RoundmarkEvent['teams']) ?? [],
    sponsors: (row.sponsors as RoundmarkEvent['sponsors']) ?? [],
    sideComps: (row.side_comps as RoundmarkEvent['sideComps']) ?? {},
    scorecards: Object.fromEntries(
      scRows.map((sc) => [sc.team_id, scorecardFromRow(sc)]),
    ),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    lockedAt: (row.locked_at as string | null) ?? undefined,
  };
}

function rowFromEvent(
  event: RoundmarkEvent,
  ownerId: string | null,
): Record<string, unknown> {
  return {
    id: event.id,
    owner_id: ownerId,
    name: event.name,
    date: event.date,
    venue: event.venue,
    type: event.type,
    format: event.format,
    brand_color: event.brandColor ?? '#27542A',
    accent_color: event.accentColor ?? null,
    bg_color: event.bgColor ?? null,
    logo_url: event.logoUrl ?? null,
    charity_name: event.charityName ?? null,
    charity_url: event.charityUrl ?? null,
    status: event.status,
    locked: event.locked,
    scoring_paused: event.scoringPaused,
    holes: event.holes,
    players: event.players,
    teams: event.teams,
    sponsors: event.sponsors,
    side_comps: event.sideComps,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
    locked_at: event.lockedAt ?? null,
  };
}

function rowFromScorecard(
  eventId: string,
  sc: Scorecard,
): Record<string, unknown> {
  return {
    event_id: eventId,
    team_id: sc.teamId,
    player_scores: sc.playerScores,
    team_scores: sc.teamScores,
    submitted_holes: sc.submittedHoles,
    updated_at: sc.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Local storage
// ---------------------------------------------------------------------------

function loadLocal(): RoundmarkDB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as RoundmarkDB;
  } catch {
    // fall through to seed
  }
  const seed = buildSeedDB();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function persistLocal() {
  if (!cache) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function emit() {
  listeners.forEach((l) => l());
}

function emitLoading() {
  loadingListeners.forEach((l) => l());
}

// Cross-tab sync for localStorage-only mode (single browser, multiple tabs).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      emit();
    }
  });
}

// ---------------------------------------------------------------------------
// Core synchronous store API (unchanged surface area for React components)
// ---------------------------------------------------------------------------

export function getDB(): RoundmarkDB {
  if (!cache) cache = loadLocal();
  return cache;
}

export function getLoading(): boolean {
  return storeLoading;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeLoading(listener: () => void): () => void {
  loadingListeners.add(listener);
  return () => loadingListeners.delete(listener);
}

export function useDB(): RoundmarkDB {
  return useSyncExternalStore(subscribe, getDB);
}

/** True while the initial Supabase hydration is running. */
export function useStoreLoading(): boolean {
  return useSyncExternalStore(subscribeLoading, getLoading);
}

export function useEvent(eventId: string | undefined): RoundmarkEvent | undefined {
  const db = useDB();
  return db.events.find((e) => e.id === eventId);
}

export function mutate(fn: (db: RoundmarkDB) => void) {
  const db = getDB();
  fn(db);
  cache = { ...db, events: [...db.events] };
  persistLocal();
  emit();
}

export function updateEvent(eventId: string, fn: (event: RoundmarkEvent) => void) {
  let updated: RoundmarkEvent | undefined;
  mutate((db) => {
    const idx = db.events.findIndex((e) => e.id === eventId);
    if (idx === -1) return;
    const copy: RoundmarkEvent = JSON.parse(JSON.stringify(db.events[idx]));
    fn(copy);
    copy.updatedAt = new Date().toISOString();
    db.events[idx] = copy;
    updated = copy;
  });
  if (updated) void syncEventToSupabase(updated);
}

export function addAudit(entry: Omit<AuditEntry, 'id' | 'at'>) {
  const full: AuditEntry = { ...entry, id: makeId(), at: new Date().toISOString() };
  mutate((db) => { db.auditLogs.unshift(full); });
  void syncAuditToSupabase(full);
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function resetDemoData() {
  cache = buildSeedDB();
  persistLocal();
  emit();
}

// ---------------------------------------------------------------------------
// Supabase write helpers (fire-and-forget from mutation functions)
// ---------------------------------------------------------------------------

async function syncEventToSupabase(event: RoundmarkEvent) {
  if (!isSupabaseConfigured || !supabase) return;
  // Demo events (demo-* ids) live only in localStorage — never push them.
  if (event.id.startsWith('demo-')) return;

  // Only the owner can write the event config row.
  if (currentUserId) {
    const { error } = await supabase
      .from('events')
      .upsert(rowFromEvent(event, currentUserId));
    if (error) console.error('[supabase] event upsert:', error.message);
  }

  // Any scorer (anon) can write scorecards for live, unlocked events.
  for (const sc of Object.values(event.scorecards)) {
    const { error } = await supabase
      .from('scorecards')
      .upsert(rowFromScorecard(event.id, sc));
    if (error) console.error('[supabase] scorecard upsert:', error.message);
  }
}

async function syncAuditToSupabase(entry: AuditEntry) {
  if (!isSupabaseConfigured || !supabase) return;
  if (entry.eventId.startsWith('demo-')) return;
  const { error } = await supabase.from('audit_logs').insert({
    event_id: entry.eventId,
    at: entry.at,
    by: entry.by,
    team_id: entry.teamId ?? null,
    player_id: entry.playerId ?? null,
    hole: entry.hole ?? null,
    action: entry.action,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
  });
  if (error) console.error('[supabase] audit insert:', error.message);
}

/** Called from events.ts after createEvent / duplicateEvent to push to Supabase. */
export function syncEvent(eventId: string) {
  const event = getDB().events.find((e) => e.id === eventId);
  if (event) void syncEventToSupabase(event);
}

/** Called from events.ts after deleteEvent to remove from Supabase. */
export async function deleteEventFromSupabase(eventId: string) {
  if (!isSupabaseConfigured || !supabase || !currentUserId) return;
  if (eventId.startsWith('demo-')) return;
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) console.error('[supabase] event delete:', error.message);
}

// ---------------------------------------------------------------------------
// Supabase read: hydrate events owned by the signed-in user
// ---------------------------------------------------------------------------

async function loadEventsFromSupabase(userId: string) {
  if (!supabase) return;

  const { data: eventRows, error } = await supabase
    .from('events')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[supabase] load events:', error.message);
    return;
  }

  const rows = (eventRows ?? []) as Record<string, unknown>[];
  const eventIds = rows.map((r) => r.id as string);

  const [{ data: scRows }, { data: auditRows }] = eventIds.length
    ? await Promise.all([
        supabase.from('scorecards').select('*').in('event_id', eventIds),
        supabase
          .from('audit_logs')
          .select('*')
          .in('event_id', eventIds)
          .order('at', { ascending: false })
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];

  const scByEvent: Record<string, SupabaseScorecardRow[]> = {};
  for (const sc of scRows ?? []) {
    const eid = sc.event_id as string;
    if (!scByEvent[eid]) scByEvent[eid] = [];
    scByEvent[eid].push(sc as SupabaseScorecardRow);
  }

  const supabaseEvents = rows.map((row) =>
    eventFromRow(row, scByEvent[row.id as string] ?? []),
  );

  const parsedAudit: AuditEntry[] = (auditRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    eventId: r.event_id as string,
    at: r.at as string,
    by: r.by as string,
    teamId: (r.team_id as string | null) ?? undefined,
    playerId: (r.player_id as string | null) ?? undefined,
    hole: (r.hole as number | null) ?? undefined,
    action: r.action as string,
    oldValue: (r.old_value as string | null) ?? undefined,
    newValue: (r.new_value as string | null) ?? undefined,
  }));

  mutate((db) => {
    // Demo events (id prefix 'demo-') are an admin-only tool. Non-admins only
    // ever see their own real Supabase events.
    const merged = [...supabaseEvents];
    if (currentRole === 'admin') {
      const demoEvents = db.events.filter((e) => e.id.startsWith('demo-'));
      for (const de of demoEvents) {
        if (!merged.some((e) => e.id === de.id)) merged.push(de);
      }
    }
    db.events = merged;

    const demoAudit =
      currentRole === 'admin'
        ? db.auditLogs.filter(
            (a) => a.eventId.startsWith('demo-') && !parsedAudit.some((b) => b.id === a.id),
          )
        : [];
    db.auditLogs = [...parsedAudit, ...demoAudit];
  });
}

// ---------------------------------------------------------------------------
// Fetch a single event from Supabase (for public pages: leaderboard, scorecard)
// ---------------------------------------------------------------------------

export async function fetchEventIfMissing(eventId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const db = getDB();
  if (db.events.some((e) => e.id === eventId)) return;

  const [{ data: eventRow }, { data: scRows }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('scorecards').select('*').eq('event_id', eventId),
  ]);

  if (!eventRow) return;

  const event = eventFromRow(
    eventRow as Record<string, unknown>,
    (scRows ?? []) as SupabaseScorecardRow[],
  );

  mutate((db) => {
    if (!db.events.some((e) => e.id === event.id)) {
      db.events.push(event);
    }
  });
}

// ---------------------------------------------------------------------------
// Realtime: keep scorecards and event status live across devices
// ---------------------------------------------------------------------------

function startRealtime() {
  if (!supabase || realtimeChannel) return;

  realtimeChannel = supabase
    .channel('roundmark-global')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'scorecards' },
      (payload) => {
        const row = payload.new as SupabaseScorecardRow & { event_id: string } | null;
        if (!row?.event_id) return;
        mutate((db) => {
          const event = db.events.find((e) => e.id === (row as { event_id: string }).event_id);
          if (!event) return;
          const sc = scorecardFromRow(row);
          event.scorecards[sc.teamId] = sc;
        });
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events' },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row?.id) return;
        mutate((db) => {
          const idx = db.events.findIndex((e) => e.id === (row.id as string));
          if (idx === -1) return;
          const existing = db.events[idx];
          // Merge scalar fields; keep in-memory scorecards (separate table).
          db.events[idx] = { ...eventFromRow(row, []), scorecards: existing.scorecards };
        });
      },
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/** Send a magic-link to `email`. Returns null on success, error message on fail. */
export async function signIn(email: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo fallback (unconfigured/dev): treat any email as an admin sign-in.
    currentRole = 'admin';
    mutate((db) => { db.session = { organiserName: email, role: 'admin' }; });
    return null;
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/app` },
  });
  return error?.message ?? null;
}

/** One-click demo sign-in (no email, localStorage only — dev/unconfigured mode). */
export function signInDemo() {
  // Demo mode is an admin tool, so the local demo session is treated as admin.
  currentRole = 'admin';
  mutate((db) => { db.session = { organiserName: 'Demo Organiser', role: 'admin' }; });
}

export async function signOut() {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
  }
  mutate((db) => { db.session = null; });
}

export function useSession() {
  const db = useDB();
  return db.session;
}

/** Current user's role (from the live session). */
export function useRole(): UserRole | null {
  const db = useDB();
  return db.session?.role ?? null;
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}

/** Fetch the signed-in user's role from their profile row. */
async function fetchRole(userId: string): Promise<UserRole> {
  if (!supabase) return 'organiser';
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data) return 'organiser';
  return (data.role as UserRole) ?? 'organiser';
}

// ---------------------------------------------------------------------------
// Init — call once from main.tsx
// ---------------------------------------------------------------------------

export async function initStore() {
  // Load localStorage immediately so the UI renders on first frame.
  cache = loadLocal();

  if (!isSupabaseConfigured || !supabase) return;

  storeLoading = true;
  emitLoading();

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) await hydrateUser(session.user.id, session.user.email);

    // Realtime works for anonymous visitors too (live leaderboard).
    startRealtime();

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await hydrateUser(session.user.id, session.user.email);
        startRealtime();
      } else if (event === 'SIGNED_OUT') {
        currentUserId = null;
        currentRole = 'organiser';
        mutate((db) => { db.session = null; });
      }
    });
  } finally {
    storeLoading = false;
    emitLoading();
  }
}

/** Set up the signed-in user: resolve role, set session, load their events. */
async function hydrateUser(userId: string, email: string | undefined) {
  currentUserId = userId;
  currentRole = await fetchRole(userId);
  mutate((db) => {
    db.session = { organiserName: email ?? 'Organiser', role: currentRole };
  });
  await loadEventsFromSupabase(userId);
}
