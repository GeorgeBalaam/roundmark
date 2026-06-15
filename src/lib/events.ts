// Event-level operations: create, duplicate, team auto-balance, lock/unlock.

import type { Player, RoundmarkEvent, Scorecard, Team } from './types';
import { addAudit, deleteEventFromSupabase, makeId, mutate, syncEvent } from './store';
import { PAR_72_TEMPLATE } from './seed';

export function emptyScorecard(team: Team, holeCount: number): Scorecard {
  const playerScores: Scorecard['playerScores'] = {};
  for (const pid of team.playerIds) {
    playerScores[pid] = Array.from({ length: holeCount }, () => null);
  }
  return {
    teamId: team.id,
    playerScores,
    teamScores: Array.from({ length: holeCount }, () => null),
    submittedHoles: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Make sure every team has a scorecard with cells for every player/hole. */
export function syncScorecards(event: RoundmarkEvent) {
  const holeCount = event.holes.length;
  for (const team of event.teams) {
    let card = event.scorecards[team.id];
    if (!card) {
      card = emptyScorecard(team, holeCount);
      event.scorecards[team.id] = card;
    }
    for (const pid of team.playerIds) {
      if (!card.playerScores[pid]) {
        card.playerScores[pid] = Array.from({ length: holeCount }, () => null);
      }
    }
  }
  // Drop scorecards for deleted teams.
  for (const teamId of Object.keys(event.scorecards)) {
    if (!event.teams.some((t) => t.id === teamId)) {
      delete event.scorecards[teamId];
    }
  }
}

export function createEvent(partial?: Partial<RoundmarkEvent>): RoundmarkEvent {
  const now = new Date().toISOString();
  const event: RoundmarkEvent = {
    id: makeId(),
    name: '',
    date: '',
    venue: '',
    type: 'company',
    format: 'stableford',
    brandColor: '#27542A',
    accentColor: '#8DB259',
    bgColor: '#F7F3EA',
    status: 'draft',
    locked: false,
    scoringPaused: false,
    holes: PAR_72_TEMPLATE.map((h) => ({ ...h })),
    players: [],
    teams: [],
    sponsors: [],
    scorecards: {},
    sideComps: {},
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
  mutate((db) => {
    db.events.unshift(event);
  });
  syncEvent(event.id);
  return event;
}

/** Duplicate course, sponsors, branding (+ optionally players). Never scores. */
export function duplicateEvent(source: RoundmarkEvent, includePlayers: boolean): RoundmarkEvent {
  const now = new Date().toISOString();
  const copy: RoundmarkEvent = {
    id: makeId(),
    name: `${source.name} (copy)`,
    date: '',
    venue: source.venue,
    type: source.type,
    format: source.format,
    brandColor: source.brandColor,
    accentColor: source.accentColor,
    bgColor: source.bgColor,
    logoUrl: source.logoUrl,
    charityName: source.charityName,
    charityUrl: source.charityUrl,
    status: 'draft',
    locked: false,
    scoringPaused: false,
    holes: source.holes.map((h) => ({ ...h })),
    players: includePlayers ? source.players.map((p) => ({ ...p, id: makeId() })) : [],
    teams: [],
    sponsors: source.sponsors.map((s) => ({ ...s, id: makeId() })),
    scorecards: {},
    sideComps: {},
    createdAt: now,
    updatedAt: now,
  };
  mutate((db) => {
    db.events.unshift(copy);
  });
  syncEvent(copy.id);
  return copy;
}

export function deleteEvent(eventId: string) {
  mutate((db) => {
    db.events = db.events.filter((e) => e.id !== eventId);
    db.auditLogs = db.auditLogs.filter((a) => a.eventId !== eventId);
  });
  void deleteEventFromSupabase(eventId);
}

const DEFAULT_TEAM_NAMES = [
  'Team Albatross', 'Team Birdie', 'Team Condor', 'Team Driver',
  'Team Eagle', 'Team Fairway', 'Team Green', 'Team Hazard',
  'Team Iron', 'Team Jigger', 'Team Kilter', 'Team Links',
];

/**
 * Auto-balance players into teams of `teamSize`.
 * Sorts by handicap (unknowns in the middle) and deals snake-draft style so
 * strong and weak players spread evenly. Then, if hosts exist, swaps players
 * to avoid host-less teams where possible.
 */
export function autoBalanceTeams(players: Player[], teamSize: 3 | 4): Team[] {
  const teamCount = Math.max(1, Math.ceil(players.length / teamSize));
  const sorted = [...players].sort((a, b) => {
    const ha = a.handicap ?? 18;
    const hb = b.handicap ?? 18;
    return ha - hb;
  });

  const buckets: Player[][] = Array.from({ length: teamCount }, () => []);
  // Snake draft: 0..n-1, then n-1..0, so each team gets a mix of abilities.
  sorted.forEach((player, i) => {
    const round = Math.floor(i / teamCount);
    const pos = i % teamCount;
    const idx = round % 2 === 0 ? pos : teamCount - 1 - pos;
    buckets[idx].push(player);
  });

  // Host/guest pairing: try to give every team at least one host.
  const hasHosts = players.some((p) => p.role === 'host');
  if (hasHosts) {
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].some((p) => p.role === 'host')) continue;
      // Find a donor team with 2+ hosts and swap a guest for a host.
      const donor = buckets.find((b) => b.filter((p) => p.role === 'host').length >= 2);
      if (!donor) break;
      const hostIdx = donor.findIndex((p) => p.role === 'host');
      const guestIdx = buckets[i].findIndex((p) => p.role !== 'host');
      if (hostIdx === -1 || guestIdx === -1) continue;
      const host = donor[hostIdx];
      donor[hostIdx] = buckets[i][guestIdx];
      buckets[i][guestIdx] = host;
    }
  }

  return buckets.map((bucket, i) => ({
    id: makeId(),
    name: DEFAULT_TEAM_NAMES[i % DEFAULT_TEAM_NAMES.length],
    playerIds: bucket.map((p) => p.id),
    startingHole: (i * 3) % 18 + 1, // simple shotgun spread
  }));
}

export function lockResults(eventId: string, by: string) {
  mutate((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return;
    event.locked = true;
    event.status = 'completed';
    event.lockedAt = new Date().toISOString();
    event.updatedAt = new Date().toISOString();
  });
  addAudit({ eventId, by, action: 'Results locked' });
}

export function unlockResults(eventId: string, by: string) {
  mutate((db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event) return;
    event.locked = false;
    event.status = 'live';
    event.lockedAt = undefined;
    event.updatedAt = new Date().toISOString();
  });
  addAudit({ eventId, by, action: 'Results unlocked (admin override)' });
}

/** Readiness checklist used by the wizard review step and dashboard. */
export function eventChecklist(event: RoundmarkEvent) {
  const holesOk =
    event.holes.length > 0 &&
    event.holes.every((h) => h.par >= 3 && h.par <= 6 && h.strokeIndex >= 1 && h.strokeIndex <= event.holes.length);
  const items = [
    { key: 'info', label: 'Basic info complete', done: !!(event.name && event.date && event.venue) },
    { key: 'course', label: `All ${event.holes.length || 18} holes have par and stroke index`, done: holesOk },
    { key: 'players', label: 'At least 3 players added', done: event.players.length >= 3 },
    { key: 'teams', label: 'Every player is in a team', done: event.teams.length > 0 && event.players.every((p) => event.teams.some((t) => t.playerIds.includes(p.id))) },
    { key: 'links', label: 'Teams have scoring links', done: event.teams.length > 0 },
  ];
  return { items, ready: items.every((i) => i.done) };
}
