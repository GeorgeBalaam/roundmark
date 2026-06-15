// TV / clubhouse display mode: fullscreen, high contrast, readable at distance.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Logo, ProvisionalBadge, SponsorStrip } from '../components/ui';
import { computeTeamStandings, formatToPar } from '../lib/scoring';
import { fetchEventIfMissing, useEvent } from '../lib/store';
import { FORMAT_LABELS } from '../lib/types';

const PAGE_SIZE = 10;

export default function TVPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!event && eventId) void fetchEventIfMissing(eventId);
  }, [event, eventId]);

  // Refresh tick: re-renders the clock and rotates pages of standings.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 12000);
    return () => clearInterval(id);
  }, []);

  if (!event) {
    return (
      <div className="tv-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <h1>Event not found</h1>
        <Link to="/" style={{ color: '#8db259' }}>
          Back to Roundmark
        </Link>
      </div>
    );
  }

  const standings = computeTeamStandings(event);
  const pages = Math.max(1, Math.ceil(standings.length / PAGE_SIZE));
  const page = tick % pages;
  const rows = standings.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const showToPar = event.format !== 'stableford';

  return (
    <div className="tv-root">
      <header className="row-between" style={{ marginBottom: '2.5vh' }}>
        <div className="row" style={{ gap: '1.5vw' }}>
          {event.logoUrl ? (
            <img src={event.logoUrl} alt="" style={{ height: '6vh' }} />
          ) : (
            <Logo variant="horizontal-white" height={44} />
          )}
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vh, 2.6rem)', margin: 0 }}>{event.name}</h1>
            <div style={{ color: '#9fb894', fontSize: 'clamp(0.8rem, 1.8vh, 1.1rem)' }}>
              {event.venue} · {FORMAT_LABELS[event.format]}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <ProvisionalBadge locked={event.locked} />
          <div style={{ color: '#9fb894', fontSize: 'clamp(0.8rem, 1.8vh, 1.1rem)', marginTop: 6 }}>
            Updated {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>

      <div style={{ flex: 1 }}>
        <table className="tv-table">
          <thead>
            <tr>
              <th style={{ width: '6%' }}>Pos</th>
              <th>Team</th>
              <th style={{ textAlign: 'right', width: '10%' }}>Thru</th>
              <th style={{ textAlign: 'right', width: '12%' }}>
                {event.format === 'stableford' ? 'Points' : 'Strokes'}
              </th>
              {showToPar && <th style={{ textAlign: 'right', width: '10%' }}>To par</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.teamId}>
                <td>
                  <span className="tv-rank">{row.thru === 0 ? '—' : row.rank}</span>
                </td>
                <td>
                  <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{row.name}</div>
                  <div style={{ color: '#9fb894', fontSize: 'clamp(0.7rem, 1.6vh, 1rem)' }}>
                    {row.playerNames.join(' · ')}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>{row.thru === 0 ? '—' : row.thru}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="tv-score">{row.thru === 0 ? '—' : row.value}</span>
                </td>
                {showToPar && (
                  <td style={{ textAlign: 'right', color: row.toPar !== null && row.toPar < 0 ? '#8db259' : undefined }}>
                    {formatToPar(row.toPar)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div style={{ textAlign: 'center', color: '#9fb894', marginTop: '1.5vh' }}>
            Page {page + 1} of {pages}
          </div>
        )}
      </div>

      <footer style={{ marginTop: '2.5vh' }}>
        {event.sponsors.length > 0 && <SponsorStrip sponsors={event.sponsors} dark />}
        <div className="row-between" style={{ marginTop: '1.5vh' }}>
          <span style={{ fontSize: 'clamp(0.7rem, 1.6vh, 1rem)', opacity: 0.7, color: '#9fb894' }}>
            Powered by Roundmark
          </span>
          <Link to={`/leaderboard/${event.id}`} style={{ color: '#9fb894', fontSize: 'clamp(0.7rem, 1.6vh, 1rem)' }}>
            Exit TV mode
          </Link>
        </div>
      </footer>
    </div>
  );
}
