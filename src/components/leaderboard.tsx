// LeaderboardTable: shared by the public leaderboard, TV mode and results pages.

import type { RoundmarkEvent } from '../lib/types';
import {
  computePlayerStandings,
  computeTeamStandings,
  formatToPar,
} from '../lib/scoring';
import { Badge } from './ui';

function scoreColumnLabel(format: RoundmarkEvent['format']): string {
  return format === 'stableford' ? 'Points' : 'Strokes';
}

export function LeaderboardTable({ event, limit }: { event: RoundmarkEvent; limit?: number }) {
  const standings = computeTeamStandings(event);
  const rows = limit ? standings.slice(0, limit) : standings;
  const showToPar = event.format !== 'stableford';

  return (
    <div className="table-panel table-scroll">
      <table className="data-table" aria-label="Team standings">
        <thead>
          <tr>
            <th style={{ width: 56 }}>Pos</th>
            <th>Team</th>
            <th className="num">Thru</th>
            <th className="num">{scoreColumnLabel(event.format)}</th>
            {showToPar && <th className="num">To par</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>
                <span className="leaderboard-row-rank">
                  {row.thru === 0 ? '—' : row.rank}
                </span>
              </td>
              <td>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
                  {row.name}
                  {row.tied && (
                    <span style={{ marginLeft: 8 }}>
                      <Badge tone="amber">Tied</Badge>
                    </span>
                  )}
                </div>
                <div className="text-small text-muted">{row.playerNames.join(' · ')}</div>
              </td>
              <td className="num">{row.thru === 0 ? '—' : row.thru}</td>
              <td className="num">
                <span className="leaderboard-score">{row.thru === 0 ? '—' : row.value}</span>
              </td>
              {showToPar && <td className="num">{formatToPar(row.toPar)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function IndividualStandingsTable({ event, limit }: { event: RoundmarkEvent; limit?: number }) {
  const standings = computePlayerStandings(event);
  if (standings.length === 0) return null;
  const rows = limit ? standings.slice(0, limit) : standings;
  const showToPar = event.format === 'stroke';

  return (
    <div className="table-panel table-scroll">
      <table className="data-table" aria-label="Individual standings">
        <thead>
          <tr>
            <th style={{ width: 56 }}>Pos</th>
            <th>Player</th>
            <th>Team</th>
            <th className="num">Thru</th>
            <th className="num">{scoreColumnLabel(event.format)}</th>
            {showToPar && <th className="num">To par</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.playerId}>
              <td>
                <span className="leaderboard-row-rank">{row.thru === 0 ? '—' : i + 1}</span>
              </td>
              <td style={{ fontWeight: 600 }}>{row.name}</td>
              <td className="text-muted">{row.teamName}</td>
              <td className="num">{row.thru === 0 ? '—' : row.thru}</td>
              <td className="num">
                <span className="leaderboard-score">{row.thru === 0 ? '—' : row.value}</span>
              </td>
              {showToPar && <td className="num">{formatToPar(row.toPar)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
