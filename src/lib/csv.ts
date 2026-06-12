// CSV / paste import for players, and CSV export of results.

import type { Player, RoundmarkEvent } from './types';
import { makeId } from './store';
import { computePlayerStandings, computeTeamStandings, formatToPar } from './scoring';
import { FORMAT_LABELS } from './types';

/**
 * Parse pasted or uploaded player data.
 * Accepts CSV or tab-separated lines:
 *   First name, Last name, Email?, Company?, Handicap?, Host/Guest?
 * A header row is detected and skipped.
 */
export function parsePlayerImport(text: string): { players: Player[]; errors: string[] } {
  const players: Player[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  lines.forEach((line, idx) => {
    const cells = line.split(/\t|,/).map((c) => c.trim());
    if (idx === 0 && /first/i.test(cells[0] ?? '')) return; // header row
    if (cells.length < 2 || !cells[0] || !cells[1]) {
      errors.push(`Line ${idx + 1}: needs at least a first and last name.`);
      return;
    }
    const handicapRaw = cells[4] ?? '';
    const handicap = handicapRaw === '' ? null : Number(handicapRaw);
    if (handicapRaw !== '' && Number.isNaN(handicap)) {
      errors.push(`Line ${idx + 1}: handicap "${handicapRaw}" is not a number.`);
      return;
    }
    const roleRaw = (cells[5] ?? '').toLowerCase();
    players.push({
      id: makeId(),
      firstName: cells[0],
      lastName: cells[1],
      email: cells[2] || undefined,
      company: cells[3] || undefined,
      handicap,
      role: roleRaw === 'host' ? 'host' : roleRaw === 'guest' ? 'guest' : null,
    });
  });

  return { players, errors };
}

export const PLAYER_IMPORT_SAMPLE = `First name,Last name,Email,Company,Handicap,Host/Guest
James,Carter,james@northbeam.com,Northbeam Ltd,12,Host
Sarah,Whitfield,,Atlas Partners,18,Guest
Tom,Okafor,tom@brightline.co,Brightline,9,Guest`;

function csvCell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Full results export: team standings, individual standings, raw scores. */
export function buildResultsCSV(event: RoundmarkEvent): string {
  const out: string[] = [];
  out.push(`Event,${csvCell(event.name)}`);
  out.push(`Date,${csvCell(event.date)}`);
  out.push(`Venue,${csvCell(event.venue)}`);
  out.push(`Format,${csvCell(FORMAT_LABELS[event.format])}`);
  out.push(`Status,${event.locked ? 'Final (locked)' : 'Provisional'}`);
  out.push('');

  out.push('TEAM STANDINGS');
  out.push('Rank,Team,Players,Thru,Score,To par');
  for (const row of computeTeamStandings(event)) {
    out.push(
      [row.rank, row.name, row.playerNames.join('; '), row.thru, row.value, formatToPar(row.toPar)]
        .map(csvCell)
        .join(','),
    );
  }
  out.push('');

  const individuals = computePlayerStandings(event);
  if (individuals.length > 0) {
    out.push('INDIVIDUAL STANDINGS');
    out.push('Rank,Player,Team,Thru,Score,To par');
    individuals.forEach((row, i) => {
      out.push([i + 1, row.name, row.teamName, row.thru, row.value, formatToPar(row.toPar)].map(csvCell).join(','));
    });
    out.push('');
  }

  out.push('RAW SCORES');
  const holeHeaders = event.holes.map((h) => `H${h.number}`).join(',');
  out.push(`Team,Player,${holeHeaders}`);
  for (const team of event.teams) {
    const card = event.scorecards[team.id];
    if (!card) continue;
    if (event.format === 'scramble') {
      const cells = event.holes.map((h) => card.teamScores[h.number - 1] ?? '').join(',');
      out.push(`${csvCell(team.name)},Team score,${cells}`);
    } else {
      for (const pid of team.playerIds) {
        const player = event.players.find((p) => p.id === pid);
        const cells = event.holes.map((h) => card.playerScores[pid]?.[h.number - 1] ?? '').join(',');
        out.push(`${csvCell(team.name)},${csvCell(player ? `${player.firstName} ${player.lastName}` : pid)},${cells}`);
      }
    }
  }

  return out.join('\n');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
