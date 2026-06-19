// Hybrid store: synchronous in-memory cache backed by localStorage, with
// async Supabase hydration + real-time subscriptions when configured.
//
// React consumers call the same synchronous hooks (useDB, useEvent, useSession)
// regardless of backend mode. Supabase is purely additive: it hydrates the cache
// on load, keeps it fresh via realtime, and persists mutations server-side.

import { useSyncExternalStore } from 'react';
import type {
  AccountSettings,
  AuditEntry,
  Registration,
  RegistrationSettings,
  RoundmarkDB,
  RoundmarkEvent,
  Scorecard,
  UserRole,
} from './types';
import { buildSeedDB } from './seed';
import { entitlementsFor, type Entitlements } from './entitlements';
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
    scoringMode: (row.scoring_mode as 'gross' | 'net' | null) ?? undefined,
    brandColor: (row.brand_color as string) ?? '#27542A',
    accentColor: (row.accent_color as string | null) ?? undefined,
    bgColor: (row.bg_color as string | null) ?? undefined,
    registration:
      row.registration_settings && (row.registration_settings as { fields?: unknown }).fields
        ? (row.registration_settings as RegistrationSettings)
        : undefined,
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
    scoring_mode: event.scoringMode ?? null,
    brand_color: event.brandColor ?? '#27542A',
    accent_color: event.accentColor ?? null,
    bg_color: event.bgColor ?? null,
    registration_settings: event.registration ?? {},
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
    if (raw) {
      const db = JSON.parse(raw) as RoundmarkDB;
      // Backfill fields added in later versions so older saved data stays valid.
      if (!db.registrations) db.registrations = [];
      if (!db.accountSettings) db.accountSettings = {};
      return db;
    }
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

/**
 * Events to list in organiser dashboards/history. Demo sample events are an
 * admin-only tool, so they're hidden from non-admins here — but remain in the
 * cache so public sample-leaderboard links keep working for everyone.
 */
export function useVisibleEvents(): RoundmarkEvent[] {
  const db = useDB();
  const isAdmin = db.session?.role === 'admin';
  return isAdmin ? db.events : db.events.filter((e) => !e.id.startsWith('demo-'));
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

// --- Registrations --------------------------------------------------------

type SupabaseRegistrationRow = {
  id: string;
  event_id: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  handicap: number | null;
  dietary: string | null;
  phone: string | null;
  notes: string | null;
  player_id: string | null;
  created_at: string;
};

function registrationFromRow(r: SupabaseRegistrationRow): Registration {
  return {
    id: r.id,
    eventId: r.event_id,
    status: r.status as Registration['status'],
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    email: r.email ?? '',
    company: r.company ?? undefined,
    handicap: r.handicap ?? null,
    dietary: r.dietary ?? undefined,
    phone: r.phone ?? undefined,
    notes: r.notes ?? undefined,
    playerId: r.player_id ?? undefined,
    createdAt: r.created_at,
  };
}

function rowFromRegistration(reg: Registration): Record<string, unknown> {
  return {
    id: reg.id,
    event_id: reg.eventId,
    status: reg.status,
    first_name: reg.firstName,
    last_name: reg.lastName,
    email: reg.email,
    company: reg.company ?? null,
    handicap: reg.handicap ?? null,
    dietary: reg.dietary ?? null,
    phone: reg.phone ?? null,
    notes: reg.notes ?? null,
    player_id: reg.playerId ?? null,
    created_at: reg.createdAt,
  };
}

/**
 * Public sign-up from the event landing page. Adds the registration locally and
 * (when configured, non-demo) inserts it for the organiser to review.
 */
export async function submitRegistration(
  input: Omit<Registration, 'id' | 'status' | 'createdAt' | 'playerId'>,
): Promise<string | null> {
  const reg: Registration = {
    ...input,
    id: makeId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  mutate((db) => { db.registrations.unshift(reg); });

  if (!isSupabaseConfigured || !supabase || reg.eventId.startsWith('demo-')) return null;
  const { error } = await supabase.from('registrations').insert(rowFromRegistration(reg));
  return error?.message ?? null;
}

/** Push a registration status change (approve/decline) to Supabase. */
export async function syncRegistration(reg: Registration) {
  if (!isSupabaseConfigured || !supabase || reg.eventId.startsWith('demo-')) return;
  const { error } = await supabase.from('registrations').upsert(rowFromRegistration(reg));
  if (error) console.error('[supabase] registration upsert:', error.message);
}

/** Owner-only: load an event's registrations into the local cache. */
export async function fetchRegistrations(eventId: string) {
  if (!isSupabaseConfigured || !supabase || eventId.startsWith('demo-')) return;
  const { data, error } = await supabase
    .from('registrations')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error || !data) return;
  const fresh = (data as SupabaseRegistrationRow[]).map(registrationFromRow);
  mutate((db) => {
    const others = db.registrations.filter((r) => r.eventId !== eventId);
    db.registrations = [...fresh, ...others];
  });
}

export function useRegistrations(eventId: string | undefined): Registration[] {
  const db = useDB();
  if (!eventId) return [];
  return db.registrations.filter((r) => r.eventId === eventId);
}

// --- Account settings -------------------------------------------------------

export function useAccountSettings(): AccountSettings {
  const db = useDB();
  return db.accountSettings ?? {};
}

async function syncAccountSettingsToSupabase(settings: AccountSettings) {
  if (!isSupabaseConfigured || !supabase || !currentUserId) return;
  const { error } = await supabase.from('profiles').upsert({
    id: currentUserId,
    display_name: settings.displayName ?? null,
    company_name: settings.companyName ?? null,
    website: settings.website ?? null,
    default_brand_color: settings.defaultBrandColor ?? null,
    default_accent_color: settings.defaultAccentColor ?? null,
    default_bg_color: settings.defaultBgColor ?? null,
    default_logo_url: settings.defaultLogoUrl ?? null,
  });
  if (error) console.error('[supabase] profile upsert:', error.message);
}

export async function updateAccountSettings(partial: Partial<AccountSettings>) {
  mutate((db) => {
    db.accountSettings = { ...(db.accountSettings ?? {}), ...partial };
  });
  await syncAccountSettingsToSupabase(getDB().accountSettings ?? {});
}

async function loadAccountSettings(userId: string) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'display_name,company_name,website,default_brand_color,default_accent_color,default_bg_color,default_logo_url',
    )
    .eq('id', userId)
    .single();
  if (error || !data) return;
  const d = data as Record<string, string | null>;
  const settings: AccountSettings = {
    displayName: d.display_name ?? undefined,
    companyName: d.company_name ?? undefined,
    website: d.website ?? undefined,
    defaultBrandColor: d.default_brand_color ?? undefined,
    defaultAccentColor: d.default_accent_color ?? undefined,
    defaultBgColor: d.default_bg_color ?? undefined,
    defaultLogoUrl: d.default_logo_url ?? undefined,
  };
  mutate((db) => { db.accountSettings = settings; });
}

// --- Player events ----------------------------------------------------------

/**
 * Fetch events where the current user appears as a player (by email).
 * Used for the /me player history dashboard. Merges into the local cache
 * without overwriting events already loaded as owner.
 */
export async function loadPlayerEvents(email: string) {
  if (!isSupabaseConfigured || !supabase || !email) return;

  // JSONB containment: events.players @> '[{"email":"..."}]'
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .filter('players', 'cs', JSON.stringify([{ email }]));
  if (error || !data) return;

  const rows = data as Record<string, unknown>[];
  const eventIds = rows.map((r) => r.id as string);
  if (!eventIds.length) return;

  const { data: scRows } = await supabase
    .from('scorecards')
    .select('*')
    .in('event_id', eventIds);

  const scByEvent: Record<string, SupabaseScorecardRow[]> = {};
  for (const sc of scRows ?? []) {
    const eid = (sc as Record<string, string>).event_id;
    if (!scByEvent[eid]) scByEvent[eid] = [];
    scByEvent[eid].push(sc as SupabaseScorecardRow);
  }

  const playerEvents = rows.map((row) =>
    eventFromRow(row, scByEvent[row.id as string] ?? []),
  );

  mutate((db) => {
    for (const event of playerEvents) {
      if (!db.events.some((e) => e.id === event.id)) {
        db.events.push(event);
      }
    }
  });
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
// Demo events are static sample data (public "sample leaderboard" links). They
// live only in the seed — never in Supabase — so they must never be shadowed by
// a server row and must survive auth changes. Sourced fresh from the seed and
// memoised for the session.
// ---------------------------------------------------------------------------

let demoEventsCache: RoundmarkEvent[] | null = null;
let demoAuditCache: AuditEntry[] | null = null;

function demoSeedEvents(): RoundmarkEvent[] {
  if (!demoEventsCache) {
    const seed = buildSeedDB();
    demoEventsCache = seed.events.filter((e) => e.id.startsWith('demo-'));
    demoAuditCache = seed.auditLogs.filter((a) => a.eventId.startsWith('demo-'));
  }
  return demoEventsCache;
}

function demoSeedAudit(): AuditEntry[] {
  if (!demoAuditCache) demoSeedEvents();
  return demoAuditCache ?? [];
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
    // Demo events are static sample data: always sourced fresh from the seed and
    // never shadowed by a (possibly stale) Supabase row of the same id. They stay
    // in the cache for everyone so public sample links work regardless of auth;
    // the dashboard/history views hide them from non-admins (see useVisibleEvents).
    const demoEvents = demoSeedEvents();
    const demoIds = new Set(demoEvents.map((e) => e.id));
    const realEvents = supabaseEvents.filter((e) => !demoIds.has(e.id));
    db.events = [...realEvents, ...demoEvents];

    const demoAudit = demoSeedAudit().filter((a) => !parsedAudit.some((b) => b.id === a.id));
    db.auditLogs = [...parsedAudit, ...demoAudit];
  });

  // Sign-ups for the owner's events (RLS: owner-only).
  if (eventIds.length) {
    const { data: regRows } = await supabase
      .from('registrations')
      .select('*')
      .in('event_id', eventIds)
      .order('created_at', { ascending: false });
    if (regRows) {
      const fresh = (regRows as SupabaseRegistrationRow[]).map(registrationFromRow);
      mutate((db) => {
        const others = db.registrations.filter(
          (r) => !eventIds.includes(r.eventId) && (currentRole === 'admin' || !r.eventId.startsWith('demo-')),
        );
        db.registrations = [...fresh, ...others];
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Fetch a single event from Supabase (for public pages: leaderboard, scorecard)
// ---------------------------------------------------------------------------

export async function fetchEventIfMissing(eventId: string): Promise<void> {
  const db = getDB();
  if (db.events.some((e) => e.id === eventId)) return;

  // Demo events are local seed data — inject from the seed, never hit Supabase.
  // Guards public sample links even if a prior signed-in session pruned the cache.
  if (eventId.startsWith('demo-')) {
    const demo = demoSeedEvents().find((e) => e.id === eventId);
    if (demo) mutate((d) => { if (!d.events.some((e) => e.id === eventId)) d.events.push(demo); });
    return;
  }

  if (!isSupabaseConfigured || !supabase) return;

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
    .on(
      'postgres_changes',
      // RLS limits these to the owner, so anon visitors never receive sign-up PII.
      { event: '*', schema: 'public', table: 'registrations' },
      (payload) => {
        const row = payload.new as SupabaseRegistrationRow | null;
        if (!row?.id) return;
        mutate((db) => {
          const reg = registrationFromRow(row);
          const idx = db.registrations.findIndex((r) => r.id === reg.id);
          if (idx === -1) db.registrations.unshift(reg);
          else db.registrations[idx] = reg;
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

/**
 * Entitlements for the signed-in account (capabilities + limits). Gate features
 * with `can('…')` / `within('…', used)` rather than checking plan names. Pre-billing
 * the session has no plan, so this resolves to the default 'full' plan.
 */
export function useEntitlements(): Entitlements {
  const db = useDB();
  return entitlementsFor(db.session?.plan);
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
  await Promise.all([
    loadEventsFromSupabase(userId),
    loadAccountSettings(userId),
  ]);
}
