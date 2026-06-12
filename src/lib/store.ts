// localStorage-backed store with a subscribe API so React screens update live.
// Cross-tab updates propagate via the browser 'storage' event, which is what
// keeps the leaderboard/TV mode in sync with score entry in another tab.
// TODO(production): swap this module for a Supabase client; the function
// signatures are deliberately async-compatible (callers don't rely on sync returns).

import { useSyncExternalStore } from 'react';
import type { AuditEntry, RoundmarkDB, RoundmarkEvent } from './types';
import { buildSeedDB } from './seed';

const STORAGE_KEY = 'roundmark-db-v1';

let cache: RoundmarkDB | null = null;
const listeners = new Set<() => void>();

function load(): RoundmarkDB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw) as RoundmarkDB;
      return cache;
    }
  } catch {
    // corrupted storage — fall through to reseed
  }
  cache = buildSeedDB();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

function emit() {
  listeners.forEach((l) => l());
}

// Keep other tabs in sync (score entry tab -> leaderboard tab).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      emit();
    }
  });
}

export function getDB(): RoundmarkDB {
  return load();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: re-renders when any store data changes (this tab or another). */
export function useDB(): RoundmarkDB {
  return useSyncExternalStore(subscribe, getDB);
}

export function useEvent(eventId: string | undefined): RoundmarkEvent | undefined {
  const db = useDB();
  return db.events.find((e) => e.id === eventId);
}

export function mutate(fn: (db: RoundmarkDB) => void) {
  const db = load();
  fn(db);
  cache = { ...db, events: [...db.events] }; // new reference for useSyncExternalStore
  persist();
  emit();
}

export function updateEvent(eventId: string, fn: (event: RoundmarkEvent) => void) {
  mutate((db) => {
    const idx = db.events.findIndex((e) => e.id === eventId);
    if (idx === -1) return;
    const copy: RoundmarkEvent = JSON.parse(JSON.stringify(db.events[idx]));
    fn(copy);
    copy.updatedAt = new Date().toISOString();
    db.events[idx] = copy;
  });
}

export function addAudit(entry: Omit<AuditEntry, 'id' | 'at'>) {
  mutate((db) => {
    db.auditLogs.unshift({
      ...entry,
      id: makeId(),
      at: new Date().toISOString(),
    });
  });
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function resetDemoData() {
  cache = buildSeedDB();
  persist();
  emit();
}

// --- demo session helpers -------------------------------------------------

export function signInDemo() {
  mutate((db) => {
    db.session = { organiserName: 'Demo Organiser' };
  });
}

export function signOut() {
  mutate((db) => {
    db.session = null;
  });
}

export function useSession() {
  const db = useDB();
  return db.session;
}
