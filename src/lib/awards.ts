// Awards & prizes: pure logic for resolving winners (auto from standings, or the
// manually-entered winner) and a back-compat shim from the legacy sideComps shape.

import type { Award, RoundmarkEvent } from './types';
import { computeTeamStandings, computePlayerStandings } from './scoring';

/** Player with the most birdies (or better). Null for scramble / no birdies yet. */
export function mostBirdiesPlayer(event: RoundmarkEvent): { name: string; count: number } | null {
  if (event.format === 'scramble') return null;
  let best: { name: string; count: number } | null = null;
  for (const team of event.teams) {
    const card = event.scorecards[team.id];
    if (!card) continue;
    for (const pid of team.playerIds) {
      const cells = card.playerScores[pid];
      if (!cells) continue;
      let count = 0;
      for (const hole of event.holes) {
        const cell = cells[hole.number - 1];
        if (typeof cell === 'number' && cell <= hole.par - 1) count += 1;
      }
      if (count > 0 && (!best || count > best.count)) {
        const p = event.players.find((pl) => pl.id === pid);
        best = { name: p ? `${p.firstName} ${p.lastName}` : 'Unknown player', count };
      }
    }
  }
  return best;
}

/** Resolve an award's winner: the manual entry, or computed from the standings. */
export function resolveAwardWinner(event: RoundmarkEvent, award: Award): string | undefined {
  switch (award.source) {
    case 'manual':
      return award.winner?.trim() || undefined;
    case 'team_winner':
      return computeTeamStandings(event).find((r) => r.thru > 0)?.name;
    case 'individual_winner':
      return computePlayerStandings(event).find((r) => r.thru > 0)?.name;
    case 'wooden_spoon_team': {
      const played = computeTeamStandings(event).filter((r) => r.thru > 0);
      return played.length ? played[played.length - 1].name : undefined;
    }
    case 'most_birdies': {
      const mb = mostBirdiesPlayer(event);
      return mb ? `${mb.name} (${mb.count})` : undefined;
    }
    default:
      return undefined;
  }
}

/** True when the winner is decided by the organiser rather than the standings. */
export function isManualAward(award: Award): boolean {
  return award.source === 'manual';
}

/**
 * The awards to show for an event. Uses `event.awards` when present; otherwise
 * synthesises from the legacy `sideComps` so older events still render.
 */
export function effectiveAwards(event: RoundmarkEvent): Award[] {
  if (event.awards && event.awards.length) return event.awards;
  const sc = event.sideComps ?? {};
  const out: Award[] = [];
  if (sc.nearestPinWinner || sc.nearestPinHole) {
    out.push({ id: 'legacy-np', title: 'Nearest the Pin', source: 'manual', hole: sc.nearestPinHole, winner: sc.nearestPinWinner });
  }
  if (sc.longestDriveWinner || sc.longestDriveHole) {
    out.push({ id: 'legacy-ld', title: 'Longest Drive', source: 'manual', hole: sc.longestDriveHole, winner: sc.longestDriveWinner });
  }
  return out;
}
