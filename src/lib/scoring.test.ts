import { describe, it, expect } from 'vitest';
import {
  strokesReceived,
  stablefordPoints,
  netStablefordPoints,
  computeTeamStandings,
  computePlayerStandings,
  isNetEvent,
} from './scoring';
import { mostBirdiesPlayer } from './awards';
import type { Hole, Player, RoundmarkEvent, Scorecard, ScoreCell, Team } from './types';

// --- Test helpers ----------------------------------------------------------

function holes(specs: [par: number, si: number][]): Hole[] {
  return specs.map(([par, strokeIndex], i) => ({ number: i + 1, par, strokeIndex }));
}

function makeEvent(partial: Partial<RoundmarkEvent>): RoundmarkEvent {
  return {
    id: 'e1',
    name: 'Test',
    date: '2026-06-18',
    venue: 'Test GC',
    type: 'company',
    format: 'stableford',
    status: 'live',
    locked: false,
    scoringPaused: false,
    holes: holes([[4, 1], [4, 2]]),
    players: [],
    teams: [],
    sponsors: [],
    scorecards: {},
    sideComps: {},
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function card(teamId: string, playerScores: Record<string, ScoreCell[]>, teamScores: ScoreCell[] = []): Scorecard {
  const submitted = new Set<number>();
  for (const cells of Object.values(playerScores)) cells.forEach((c, i) => c !== null && submitted.add(i + 1));
  teamScores.forEach((c, i) => c !== null && submitted.add(i + 1));
  return { teamId, playerScores, teamScores, submittedHoles: [...submitted], updatedAt: '' };
}

const p = (id: string, handicap: number | null): Player => ({ id, firstName: id, lastName: 'X', handicap });
const team = (id: string, playerIds: string[]): Team => ({ id, name: id, playerIds, startingHole: 1 });

// --- strokesReceived (handicap allocation) --------------------------------

describe('strokesReceived', () => {
  it('allocates one stroke per hole at handicap = holeCount', () => {
    expect(strokesReceived(18, 1, 18)).toBe(1);
    expect(strokesReceived(18, 18, 18)).toBe(1);
  });

  it('is zero for scratch / unknown handicap', () => {
    expect(strokesReceived(0, 5, 18)).toBe(0);
    expect(strokesReceived(null, 5, 18)).toBe(0);
    expect(strokesReceived(undefined, 5, 18)).toBe(0);
  });

  it('allocates by stroke index for a mid handicap', () => {
    expect(strokesReceived(9, 9, 18)).toBe(1); // SI <= 9 gets a stroke
    expect(strokesReceived(9, 10, 18)).toBe(0); // SI > 9 does not
  });

  it('wraps to a second stroke above the hole count', () => {
    expect(strokesReceived(27, 9, 18)).toBe(2); // base 1 + extra on SI<=9
    expect(strokesReceived(27, 10, 18)).toBe(1); // base 1 only
  });

  it('gives strokes back for a plus (negative) handicap, easiest holes first', () => {
    expect(strokesReceived(-1, 18, 18)).toBe(-1); // hardest-to-give = highest SI
    expect(strokesReceived(-1, 17, 18)).toBe(0);
  });

  it('respects a 9-hole round', () => {
    expect(strokesReceived(9, 9, 9)).toBe(1);
    expect(strokesReceived(9, 1, 9)).toBe(1);
    expect(strokesReceived(18, 5, 9)).toBe(2);
  });
});

// --- Stableford points -----------------------------------------------------

describe('stablefordPoints (gross)', () => {
  it('scores par/birdie/bogey/eagle/double and pickups', () => {
    expect(stablefordPoints(4, 4)).toBe(2); // par
    expect(stablefordPoints(4, 3)).toBe(3); // birdie
    expect(stablefordPoints(4, 5)).toBe(1); // bogey
    expect(stablefordPoints(4, 2)).toBe(4); // eagle
    expect(stablefordPoints(4, 6)).toBe(0); // double+
    expect(stablefordPoints(4, 'X')).toBe(0); // pickup
    expect(stablefordPoints(4, null)).toBe(0); // not entered
  });
});

describe('netStablefordPoints', () => {
  it('applies received strokes before scoring', () => {
    expect(netStablefordPoints(4, 5, 1)).toBe(2); // net 4 = par
    expect(netStablefordPoints(4, 4, 1)).toBe(3); // net 3 = birdie
    expect(netStablefordPoints(4, 6, 0)).toBe(0); // gross double, no stroke
    expect(netStablefordPoints(4, 'X', 2)).toBe(0); // pickup always 0
  });
});

// --- Team standings: gross vs net -----------------------------------------

describe('computeTeamStandings — net vs gross', () => {
  const base = {
    players: [p('a', 1)],
    teams: [team('t1', ['a'])],
    holes: holes([[4, 1], [4, 2]]),
    scorecards: { t1: card('t1', { a: [5, 5] }) },
  };

  it('scores gross when scoringMode is gross/undefined', () => {
    const event = makeEvent({ ...base, scoringMode: 'gross' });
    expect(isNetEvent(event)).toBe(false);
    expect(computeTeamStandings(event)[0].value).toBe(2); // two bogeys = 1+1
  });

  it('applies handicap strokes when net', () => {
    const event = makeEvent({ ...base, scoringMode: 'net' });
    expect(isNetEvent(event)).toBe(true);
    // hole 1 (SI 1) gets the stroke: net 4 = par = 2pts; hole 2: bogey = 1pt
    expect(computeTeamStandings(event)[0].value).toBe(3);
  });

  it('never applies handicap to scramble', () => {
    const event = makeEvent({ format: 'scramble', scoringMode: 'net' });
    expect(isNetEvent(event)).toBe(false);
  });
});

// --- Ranking, countback, partial rounds -----------------------------------

describe('computeTeamStandings — ranking & countback', () => {
  it('ranks higher stableford points first and breaks ties on the last hole', () => {
    const event = makeEvent({
      players: [p('a', 0), p('b', 0)],
      teams: [team('t1', ['a']), team('t2', ['b'])],
      holes: holes([[4, 1], [4, 2]]),
      scoringMode: 'gross',
      // both total 4 pts; t1 finishes stronger (birdie on the last hole)
      scorecards: {
        t1: card('t1', { a: [5, 3] }), // 1 + 3 = 4
        t2: card('t2', { b: [3, 5] }), // 3 + 1 = 4
      },
    });
    const rows = computeTeamStandings(event);
    expect(rows.map((r) => r.teamId)).toEqual(['t1', 't2']);
    expect(rows[0].tied).toBe(true);
  });

  it('sinks teams with no scores to the bottom', () => {
    const event = makeEvent({
      players: [p('a', 0), p('b', 0)],
      teams: [team('t1', ['a']), team('t2', ['b'])],
      scoringMode: 'gross',
      scorecards: { t1: card('t1', { a: [4, 4] }) }, // t2 has none
    });
    const rows = computeTeamStandings(event);
    expect(rows[0].teamId).toBe('t1');
    expect(rows[1].thru).toBe(0);
  });
});

describe('computeTeamStandings — scramble', () => {
  it('totals the team score per hole', () => {
    const event = makeEvent({
      format: 'scramble',
      teams: [team('t1', ['a'])],
      players: [p('a', 0)],
      holes: holes([[4, 1], [4, 2]]),
      scorecards: { t1: card('t1', {}, [4, 5]) },
    });
    const row = computeTeamStandings(event)[0];
    expect(row.value).toBe(9);
    expect(row.toPar).toBe(1); // 9 strokes over par 8
  });
});

// --- Individual standings (net stroke play) -------------------------------

describe('computePlayerStandings — net stroke play', () => {
  it('subtracts received strokes from the net total and to-par', () => {
    const event = makeEvent({
      format: 'stroke',
      scoringMode: 'net',
      players: [p('a', 1)],
      teams: [team('t1', ['a'])],
      holes: holes([[4, 1], [4, 2]]),
      scorecards: { t1: card('t1', { a: [5, 5] }) }, // gross 10
    });
    const row = computePlayerStandings(event)[0];
    expect(row.value).toBe(9); // 10 gross - 1 received stroke
    expect(row.toPar).toBe(1); // net 9 vs par 8
  });

  it('returns no individuals for scramble', () => {
    const event = makeEvent({ format: 'scramble', teams: [team('t1', ['a'])], players: [p('a', 0)] });
    expect(computePlayerStandings(event)).toEqual([]);
  });
});

// --- mostBirdiesPlayer (awards) -------------------------------------------

describe('mostBirdiesPlayer', () => {
  it('counts holes under par and picks the leader', () => {
    const event = makeEvent({
      players: [p('a', 0), p('b', 0)],
      teams: [team('t1', ['a', 'b'])],
      holes: holes([[4, 1], [4, 2]]),
      scorecards: { t1: card('t1', { a: [3, 4], b: [4, 4] }) }, // a: 1 birdie, b: 0
    });
    expect(mostBirdiesPlayer(event)).toEqual({ name: 'a X', count: 1 });
  });

  it('ignores pickups (X) and returns null with no birdies', () => {
    const event = makeEvent({
      players: [p('a', 0)],
      teams: [team('t1', ['a'])],
      holes: holes([[4, 1], [4, 2]]),
      scorecards: { t1: card('t1', { a: ['X', 5] }) },
    });
    expect(mostBirdiesPlayer(event)).toBeNull();
  });

  it('is null for scramble', () => {
    const event = makeEvent({ format: 'scramble', players: [p('a', 0)], teams: [team('t1', ['a'])] });
    expect(mostBirdiesPlayer(event)).toBeNull();
  });
});
