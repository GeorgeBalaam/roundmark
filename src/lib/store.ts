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
  EventMembership,
  Player,
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
    heroImageUrl: (row.hero_image_url as string | null) ?? undefined,
    heroTagline: (row.hero_tagline as string | null) ?? undefined,
    content: (row.content as RoundmarkEvent['content']) ?? [],
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
    hero_image_url: event.heroImageUrl ?? null,
    hero_tagline: event.heroTagline ?? null,
    content: event.content ?? [],
    charity_name: event.charityName ?? null,
    charity_url: event.charityUrl ?? null,
    status: event.status,
    locked: event.locked,
    scoring_paused: event.scoringPaused,
    holes: event.holes,
    // Public row is PII-free: contact fields live in event_player_contacts.
    players: event.players.map(({ email, phone, dietary, ...rest }) => rest),
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
      if (!db.memberships) db.memberships = [];
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
  // Make sure debounced writes are flushed if the user leaves mid-edit.
  window.addEventListener('beforeunload', () => flushPending());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
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

/** Apply an in-memory change and notify React subscribers — no persistence. */
function applyMutation(fn: (db: RoundmarkDB) => void) {
  const db = getDB();
  fn(db);
  cache = { ...db, events: [...db.events] };
  emit();
}

export function mutate(fn: (db: RoundmarkDB) => void) {
  applyMutation(fn);
  persistLocal();
}

// Rapid edits (e.g. typing in a setup field) call updateEvent on every keystroke.
// The in-memory update + re-render stays immediate so inputs and the live preview
// feel instant, but the expensive work — stringifying the whole DB to localStorage
// and the Supabase upsert of the entire event aggregate — is debounced so it runs
// once typing pauses rather than per character. flushPending() drains both on
// tab-close/hide so nothing is lost.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PERSIST_DEBOUNCE_MS = 350;
const SYNC_DEBOUNCE_MS = 800;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { persistTimer = null; persistLocal(); }, PERSIST_DEBOUNCE_MS);
}

function scheduleSync(eventId: string) {
  const existing = syncTimers.get(eventId);
  if (existing) clearTimeout(existing);
  syncTimers.set(eventId, setTimeout(() => {
    syncTimers.delete(eventId);
    enqueue({ kind: 'event', eventId });
  }, SYNC_DEBOUNCE_MS));
}

/** Force any debounced persist + sync to run now (page hide / unload). */
function flushPending() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; persistLocal(); }
  for (const [eventId, t] of syncTimers) { clearTimeout(t); enqueue({ kind: 'event', eventId }); }
  syncTimers.clear();
}

export function updateEvent(eventId: string, fn: (event: RoundmarkEvent) => void) {
  let updated: RoundmarkEvent | undefined;
  applyMutation((db) => {
    const idx = db.events.findIndex((e) => e.id === eventId);
    if (idx === -1) return;
    const copy: RoundmarkEvent = JSON.parse(JSON.stringify(db.events[idx]));
    fn(copy);
    copy.updatedAt = new Date().toISOString();
    db.events[idx] = copy;
    updated = copy;
  });
  if (updated) {
    schedulePersist();
    scheduleSync(eventId);
  }
}

export function addAudit(entry: Omit<AuditEntry, 'id' | 'at'>) {
  const full: AuditEntry = { ...entry, id: makeId(), at: new Date().toISOString() };
  mutate((db) => { db.auditLogs.unshift(full); });
  enqueue({ kind: 'audit', entry: full });
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

/** Push an event's config + contacts + scorecards. Throws on the first error so
 *  the outbox can retry. Demo events are local-only and resolve to a no-op. */
async function pushEventToSupabase(event: RoundmarkEvent) {
  if (!supabase || event.id.startsWith('demo-')) return;

  // Only the owner can write the event config row + player contacts.
  if (currentUserId) {
    const { error } = await supabase.from('events').upsert(rowFromEvent(event, currentUserId));
    if (error) throw new Error(`event upsert: ${error.message}`);

    const contacts = event.players
      .filter((p) => p.email || p.phone || p.dietary)
      .map((p) => ({
        event_id: event.id,
        player_id: p.id,
        email: p.email ?? null,
        phone: p.phone ?? null,
        dietary: p.dietary ?? null,
      }));
    if (contacts.length) {
      const { error: cErr } = await supabase.from('event_player_contacts').upsert(contacts);
      if (cErr) throw new Error(`contacts upsert: ${cErr.message}`);
    }
  }

  // Any scorer (anon) can write scorecards for live, unlocked events.
  for (const sc of Object.values(event.scorecards)) {
    const { error } = await supabase.from('scorecards').upsert(rowFromScorecard(event.id, sc));
    if (error) throw new Error(`scorecard upsert: ${error.message}`);
  }
}

async function pushAuditToSupabase(entry: AuditEntry) {
  if (!supabase || entry.eventId.startsWith('demo-')) return;
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
  if (error) throw new Error(`audit insert: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Outbox: durable, retrying write queue. Mutations enqueue an op; the drainer
// re-derives the latest state from the cache and pushes it (idempotent upserts),
// retrying on failure and surviving reloads. This stops a scorer on a flaky
// connection from silently losing scores.
// ---------------------------------------------------------------------------

type OutboxOp =
  | { id: string; kind: 'event'; eventId: string }
  | { id: string; kind: 'audit'; entry: AuditEntry }
  | { id: string; kind: 'registration'; regId: string };

// Distributive omit so each union member keeps its own fields (plain Omit over a
// union collapses to the shared keys only).
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
type NewOutboxOp = DistributiveOmit<OutboxOp, 'id'>;

const OUTBOX_KEY = 'roundmark-outbox-v1';
let outbox: OutboxOp[] = [];
let draining = false;
let syncErrorMsg: string | null = null;
let retryScheduled = false;
const syncListeners = new Set<() => void>();

// Stable snapshot so useSyncExternalStore doesn't loop (identity changes only
// when pending/error actually change).
let statusSnapshot: { pending: number; error: string | null } = { pending: 0, error: null };

function refreshSnapshot() {
  if (statusSnapshot.pending !== outbox.length || statusSnapshot.error !== syncErrorMsg) {
    statusSnapshot = { pending: outbox.length, error: syncErrorMsg };
  }
}
function emitSync() {
  refreshSnapshot();
  syncListeners.forEach((l) => l());
}

function loadOutbox() {
  try {
    outbox = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxOp[];
  } catch {
    outbox = [];
  }
  refreshSnapshot();
}
function persistOutbox() {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch { /* quota — keep in memory */ }
}

function opKey(op: OutboxOp): string {
  return op.kind === 'event'
    ? `event:${op.eventId}`
    : op.kind === 'registration'
      ? `reg:${op.regId}`
      : `audit:${op.entry.id}`;
}

function enqueue(op: NewOutboxOp) {
  if (!isSupabaseConfigured || !supabase) return;
  const full = { ...op, id: makeId() } as OutboxOp;
  // Collapse repeated writes to the same entity — the drainer always pushes the
  // latest cached state, so only the most recent intent matters.
  outbox = outbox.filter((o) => opKey(o) !== opKey(full));
  outbox.push(full);
  persistOutbox();
  emitSync();
  void drainOutbox();
}

async function runOp(op: OutboxOp): Promise<void> {
  if (op.kind === 'event') {
    const event = getDB().events.find((e) => e.id === op.eventId);
    if (event) await pushEventToSupabase(event);
  } else if (op.kind === 'audit') {
    await pushAuditToSupabase(op.entry);
  } else if (op.kind === 'registration') {
    const reg = getDB().registrations.find((r) => r.id === op.regId);
    if (reg && supabase && !reg.eventId.startsWith('demo-')) {
      const { error } = await supabase.from('registrations').upsert(rowFromRegistration(reg));
      if (error) throw new Error(`registration upsert: ${error.message}`);
    }
  }
}

async function drainOutbox(): Promise<void> {
  if (draining || !isSupabaseConfigured || !supabase) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  draining = true;
  emitSync();
  try {
    while (outbox.length) {
      try {
        await runOp(outbox[0]);
      } catch (e) {
        syncErrorMsg = e instanceof Error ? e.message : 'sync failed';
        scheduleRetry();
        emitSync();
        return;
      }
      outbox.shift();
      persistOutbox();
      syncErrorMsg = null;
      emitSync();
    }
  } finally {
    draining = false;
    emitSync();
  }
}

function scheduleRetry() {
  if (retryScheduled) return;
  retryScheduled = true;
  setTimeout(() => { retryScheduled = false; void drainOutbox(); }, 5000);
}

export function getSyncStatus(): { pending: number; error: string | null } {
  return statusSnapshot;
}
export function subscribeSync(cb: () => void): () => void {
  syncListeners.add(cb);
  return () => { syncListeners.delete(cb); };
}
/** Unsynced-writes status for a UI indicator. */
export function useSyncStatus(): { pending: number; error: string | null } {
  return useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
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

/** Push a registration status change (approve/decline) — durable via the outbox. */
export async function syncRegistration(reg: Registration) {
  if (reg.eventId.startsWith('demo-')) return;
  enqueue({ kind: 'registration', regId: reg.id });
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

// --- Player events / memberships --------------------------------------------

export function useMemberships(): EventMembership[] {
  const db = useDB();
  return db.memberships ?? [];
}

/**
 * Load the signed-in user's per-event memberships and the events they belong to
 * (for the /me dashboard). First claims any unclaimed memberships by matching the
 * user's account email to roster contacts, then loads memberships + their events.
 * Replaces the old email-in-JSONB matching. Merges into the cache without
 * overwriting events already loaded as owner.
 */
export async function loadPlayerEvents() {
  if (!isSupabaseConfigured || !supabase || !currentUserId) return;

  // Link this user to any roster players that share their account email.
  await supabase.rpc('claim_memberships').then(({ error }) => {
    if (error) console.error('[supabase] claim_memberships:', error.message);
  });

  const { data: memberRows, error } = await supabase
    .from('event_members')
    .select('event_id, role, player_id')
    .eq('user_id', currentUserId);
  if (error || !memberRows) return;

  const memberships: EventMembership[] = memberRows.map((r: Record<string, unknown>) => ({
    eventId: r.event_id as string,
    role: (r.role as EventMembership['role']) ?? 'player',
    playerId: (r.player_id as string | null) ?? undefined,
  }));
  mutate((db) => { db.memberships = memberships; });

  // Load events the user is a member of but doesn't already have (e.g. as owner).
  const have = new Set(getDB().events.map((e) => e.id));
  const missingIds = [...new Set(memberships.map((m) => m.eventId))].filter((id) => !have.has(id));
  if (!missingIds.length) return;

  const [{ data: rows }, { data: scRows }] = await Promise.all([
    supabase.from('events').select('*').in('id', missingIds),
    supabase.from('scorecards').select('*').in('event_id', missingIds),
  ]);
  if (!rows) return;

  const scByEvent: Record<string, SupabaseScorecardRow[]> = {};
  for (const sc of scRows ?? []) {
    const eid = (sc as Record<string, string>).event_id;
    (scByEvent[eid] ??= []).push(sc as SupabaseScorecardRow);
  }
  const playerEvents = (rows as Record<string, unknown>[]).map((row) =>
    eventFromRow(row, scByEvent[row.id as string] ?? []),
  );

  mutate((db) => {
    for (const event of playerEvents) {
      if (!db.events.some((e) => e.id === event.id)) db.events.push(event);
    }
  });
}

/** Called from events.ts after createEvent / duplicateEvent to push to Supabase. */
export function syncEvent(eventId: string) {
  enqueue({ kind: 'event', eventId });
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

  // Merge owner-only PII (email/phone/dietary) back into the roster for the
  // owner's own events, so the organiser UI still shows contact details.
  if (eventIds.length) {
    const { data: contactRows } = await supabase
      .from('event_player_contacts')
      .select('event_id, player_id, email, phone, dietary')
      .in('event_id', eventIds);
    const byEvent: Record<string, Record<string, Partial<Pick<Player, 'email' | 'phone' | 'dietary'>>>> = {};
    for (const c of (contactRows ?? []) as Array<Record<string, string | null>>) {
      const eid = c.event_id as string;
      (byEvent[eid] ??= {})[c.player_id as string] = {
        email: c.email ?? undefined,
        phone: c.phone ?? undefined,
        dietary: c.dietary ?? undefined,
      };
    }
    for (const ev of supabaseEvents) {
      const m = byEvent[ev.id];
      if (m) ev.players = ev.players.map((p) => (m[p.id] ? { ...p, ...m[p.id] } : p));
    }
  }

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
          const incoming = eventFromRow(row, []);
          // The broadcast row is PII-free; preserve any contact fields we already
          // hold in memory (owner view) by matching player id.
          const piiById = new Map(existing.players.map((p) => [p.id, p]));
          incoming.players = incoming.players.map((p) => {
            const prev = piiById.get(p.id);
            return prev ? { ...p, email: prev.email, phone: prev.phone, dietary: prev.dietary } : p;
          });
          // Merge scalar fields; keep in-memory scorecards (separate table).
          db.events[idx] = { ...incoming, scorecards: existing.scorecards };
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
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Reconnected — flush anything queued while offline.
        void drainOutbox();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Drop the dead channel and resubscribe after a short backoff.
        if (realtimeChannel && supabase) {
          void supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }
        setTimeout(() => startRealtime(), 3000);
      }
    });
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

/** Fetch the signed-in user's role + entitlements plan from their profile row. */
async function fetchProfile(userId: string): Promise<{ role: UserRole; plan: string }> {
  if (!supabase) return { role: 'organiser', plan: 'full' };
  // Resilient to the `plan` column not existing yet (deploy before migration):
  // fall back to selecting role only so the admin role is never lost.
  let row = await supabase.from('profiles').select('role, plan').eq('id', userId).single();
  if (row.error) {
    row = await supabase.from('profiles').select('role').eq('id', userId).single();
  }
  const data = row.data as { role?: string; plan?: string } | null;
  if (!data) return { role: 'organiser', plan: 'full' };
  return {
    role: (data.role as UserRole) ?? 'organiser',
    plan: data.plan ?? 'full',
  };
}

// ---------------------------------------------------------------------------
// Init — call once from main.tsx
// ---------------------------------------------------------------------------

export async function initStore() {
  // Load localStorage immediately so the UI renders on first frame.
  cache = loadLocal();
  loadOutbox();

  if (!isSupabaseConfigured || !supabase) return;

  // Flush any writes queued in a previous session, and retry whenever the
  // browser regains connectivity.
  void drainOutbox();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void drainOutbox());
  }

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

/** Set up the signed-in user: resolve role + plan, set session, load events,
 *  account settings, and per-event memberships (for the /me dashboard). */
async function hydrateUser(userId: string, email: string | undefined) {
  currentUserId = userId;
  const { role, plan } = await fetchProfile(userId);
  currentRole = role;
  mutate((db) => {
    db.session = { organiserName: email ?? 'Organiser', role, plan };
  });
  await Promise.all([
    loadEventsFromSupabase(userId),
    loadAccountSettings(userId),
    loadPlayerEvents(),
  ]);
}
