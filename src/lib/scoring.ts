// Scoring engine: stroke play, Stableford, Texas Scramble + countback tie-break.
// Supports gross and net (handicap) play. Net uses full-handicap stroke-index
// allocation (WHS-style): strokes are allocated hole-by-hole by stroke index,
// supporting handicaps above the hole count and plus (negative) handicaps, and
// 9- or 18-hole rounds. Scramble stays team-gross (team handicap models are a
// separate concern and out of scope here).

import type { RoundmarkEvent, ScoreCell, Scorecard, Team } from './types';

/** True when the event is played off handicap (net). */
export function isNetEvent(event: RoundmarkEvent): boolean {
  return event.scoringMode === 'net' && event.format !== 'scramble';
}

/**
 * Strokes a player receives on a given hole under full handicap allowance.
 *  - Positive handicap: strokes received on the hardest holes first (stroke
 *    index 1 upward); handicaps > holeCount wrap to a 2nd/3rd stroke.
 *  - Plus (negative) handicap: strokes given back on the easiest holes first
 *    (highest stroke index), returned as a negative number.
 *  - null/undefined handicap: 0 (treated as scratch).
 * `holeCount` is the number of holes in the round (9 or 18).
 */
export function strokesReceived(
  handicap: number | null | undefined,
  strokeIndex: number,
  holeCount: number,
): number {
  if (handicap == null || holeCount <= 0) return 0;
  const h = Math.round(handicap);
  if (h === 0) return 0;
  const mag = Math.abs(h);
  const base = Math.floor(mag / holeCount);
  const remainder = mag % holeCount;
  if (h > 0) {
    return base + (strokeIndex <= remainder ? 1 : 0);
  }
  // Plus handicap: give strokes back on the `remainder` easiest holes.
  const give = base + (strokeIndex > holeCount - remainder ? 1 : 0);
  return give === 0 ? 0 : -give;
}

/**
 * Gross Stableford points.
 * Eagle or better: 4+, birdie 3, par 2, bogey 1, double+ 0. 'X' scores 0.
 */
export function stablefordPoints(par: number, gross: ScoreCell): number {
  if (gross === null || gross === 'X') return 0;
  const diff = gross - par;
  return Math.max(0, 2 - diff);
}

/** Net Stableford points: points scored off the net (handicap-adjusted) score. */
export function netStablefordPoints(par: number, gross: ScoreCell, strokesGot: number): number {
  if (gross === null || gross === 'X') return 0;
  const net = gross - strokesGot;
  return Math.max(0, 2 - (net - par));
}

export interface PlayerStanding {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  thru: number;
  /** Gross strokes (stroke play) or points (stableford). */
  value: number;
  toPar: number | null;
}

export interface TeamStanding {
  teamId: string;
  name: string;
  playerNames: string[];
  thru: number;
  /** Strokes (stroke/scramble) or points (stableford). */
  value: number;
  /** Strokes relative to par over holes played (stroke/scramble only). */
  toPar: number | null;
  rank: number;
  tied: boolean;
  /** Per-hole series used for countback (hole index 0-17). */
  series: number[];
  holesWithScores: number[];
}

function cellStrokes(cell: ScoreCell, par: number): number | null {
  if (cell === null) return null;
  // 'X' (no score) is treated as double-par for totals so a pickup doesn't
  // produce a misleadingly low round. Marked clearly in the UI.
  if (cell === 'X') return par * 2;
  return cell;
}

function playerName(event: RoundmarkEvent, playerId: string): string {
  const p = event.players.find((pl) => pl.id === playerId);
  return p ? `${p.firstName} ${p.lastName}` : 'Unknown player';
}

function playerHandicap(event: RoundmarkEvent, playerId: string): number | null {
  return event.players.find((pl) => pl.id === playerId)?.handicap ?? null;
}

/** Holes (numbers) a team has any data saved for. */
export function holesCompleted(event: RoundmarkEvent, team: Team): number[] {
  const card = event.scorecards[team.id];
  if (!card) return [];
  return [...card.submittedHoles].sort((a, b) => a - b);
}

function emptySeries(event: RoundmarkEvent): number[] {
  return event.holes.map(() => 0);
}

/**
 * Compute team standings for an event, ranked with countback tie-break
 * (last 9, last 6, last 3, last 1 — relative to hole 18, the standard method).
 */
export function computeTeamStandings(event: RoundmarkEvent): TeamStanding[] {
  const net = isNetEvent(event);
  const holeCount = event.holes.length;

  const rows: TeamStanding[] = event.teams.map((team) => {
    const card: Scorecard | undefined = event.scorecards[team.id];
    const series = emptySeries(event);
    let total = 0;
    let parPlayed = 0;
    const holesWith: number[] = [];

    if (card) {
      for (const hole of event.holes) {
        const i = hole.number - 1;
        if (event.format === 'scramble') {
          const strokes = cellStrokes(card.teamScores[i] ?? null, hole.par);
          if (strokes !== null) {
            series[i] = strokes;
            total += strokes;
            parPlayed += hole.par;
            holesWith.push(hole.number);
          }
        } else if (event.format === 'stableford') {
          let holePts = 0;
          let any = false;
          for (const pid of team.playerIds) {
            const cell = card.playerScores[pid]?.[i] ?? null;
            if (cell !== null) {
              any = true;
              holePts += net
                ? netStablefordPoints(hole.par, cell, strokesReceived(playerHandicap(event, pid), hole.strokeIndex, holeCount))
                : stablefordPoints(hole.par, cell);
            }
          }
          if (any) {
            series[i] = holePts;
            total += holePts;
            holesWith.push(hole.number);
          }
        } else {
          // stroke play: team total = sum of player strokes (net subtracts each
          // player's allocated strokes for the hole).
          let holeStrokes = 0;
          let any = false;
          for (const pid of team.playerIds) {
            const strokes = cellStrokes(card.playerScores[pid]?.[i] ?? null, hole.par);
            if (strokes !== null) {
              any = true;
              holeStrokes += net
                ? strokes - strokesReceived(playerHandicap(event, pid), hole.strokeIndex, holeCount)
                : strokes;
            }
          }
          if (any) {
            series[i] = holeStrokes;
            total += holeStrokes;
            parPlayed += hole.par * team.playerIds.length;
            holesWith.push(hole.number);
          }
        }
      }
    }

    return {
      teamId: team.id,
      name: team.name,
      playerNames: team.playerIds.map((pid) => playerName(event, pid)),
      thru: holesWith.length,
      value: total,
      toPar:
        event.format === 'stableford' || holesWith.length === 0
          ? null
          : total - parPlayed,
      rank: 0,
      tied: false,
      series,
      holesWithScores: holesWith,
    };
  });

  const lowerIsBetter = event.format !== 'stableford';

  rows.sort((a, b) => {
    // Teams with no scores yet sink to the bottom.
    if (a.thru === 0 && b.thru === 0) return a.name.localeCompare(b.name);
    if (a.thru === 0) return 1;
    if (b.thru === 0) return -1;
    const primary = lowerIsBetter ? a.value - b.value : b.value - a.value;
    if (primary !== 0) return primary;
    return countbackCompare(a, b, lowerIsBetter);
  });

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  // Flag ties on the primary score (countback decided order but we surface the tie).
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    const next = rows[i + 1];
    row.tied =
      (!!prev && prev.value === row.value && prev.thru > 0 && row.thru > 0) ||
      (!!next && next.value === row.value && next.thru > 0 && row.thru > 0);
  });

  return rows;
}

/**
 * Standard countback: compare totals over the last 9, 6, 3, then 1 hole(s).
 * Returns negative if a wins.
 */
function countbackCompare(a: TeamStanding, b: TeamStanding, lowerIsBetter: boolean): number {
  const segments = [9, 6, 3, 1];
  const n = a.series.length;
  for (const seg of segments) {
    const from = Math.max(0, n - seg);
    const sumA = a.series.slice(from).reduce((s, v) => s + v, 0);
    const sumB = b.series.slice(from).reduce((s, v) => s + v, 0);
    const diff = lowerIsBetter ? sumA - sumB : sumB - sumA;
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Individual standings (stroke play and stableford only). */
export function computePlayerStandings(event: RoundmarkEvent): PlayerStanding[] {
  if (event.format === 'scramble') return [];
  const net = isNetEvent(event);
  const holeCount = event.holes.length;
  const rows: PlayerStanding[] = [];

  for (const team of event.teams) {
    const card = event.scorecards[team.id];
    for (const pid of team.playerIds) {
      const hc = playerHandicap(event, pid);
      let total = 0;
      let parPlayed = 0;
      let thru = 0;
      if (card) {
        for (const hole of event.holes) {
          const cell = card.playerScores[pid]?.[hole.number - 1] ?? null;
          if (cell === null) continue;
          thru += 1;
          const got = net ? strokesReceived(hc, hole.strokeIndex, holeCount) : 0;
          if (event.format === 'stableford') {
            total += net
              ? netStablefordPoints(hole.par, cell, got)
              : stablefordPoints(hole.par, cell);
          } else {
            total += (cellStrokes(cell, hole.par) ?? 0) - got;
            parPlayed += hole.par;
          }
        }
      }
      rows.push({
        playerId: pid,
        name: playerName(event, pid),
        teamId: team.id,
        teamName: team.name,
        thru,
        value: total,
        toPar: event.format === 'stroke' && thru > 0 ? total - parPlayed : null,
      });
    }
  }

  const lowerIsBetter = event.format === 'stroke';
  rows.sort((a, b) => {
    if (a.thru === 0 && b.thru === 0) return a.name.localeCompare(b.name);
    if (a.thru === 0) return 1;
    if (b.thru === 0) return -1;
    return lowerIsBetter ? a.value - b.value : b.value - a.value;
  });
  return rows;
}

export function formatToPar(toPar: number | null): string {
  if (toPar === null) return '—';
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

/** Overall completion: holes saved across all teams vs total expected. */
export function eventProgress(event: RoundmarkEvent): { done: number; total: number } {
  const total = event.teams.length * event.holes.length;
  const done = event.teams.reduce(
    (sum, t) => sum + (event.scorecards[t.id]?.submittedHoles.length ?? 0),
    0,
  );
  return { done, total };
}
