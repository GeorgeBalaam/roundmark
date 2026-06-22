// Shareable final results page — public, printable, exportable.

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { IndividualStandingsTable, LeaderboardTable } from '../components/leaderboard';
import { Badge, Button, Card, Logo, ProvisionalBadge, SponsorStrip } from '../components/ui';
import { useToast } from '../components/toast-context';
import { buildResultsCSV, downloadCSV } from '../lib/csv';
import { computeTeamStandings } from '../lib/scoring';
import { effectiveAwards, resolveAwardWinner } from '../lib/awards';
import { eventThemeVars } from '../lib/theme';
import { fetchEventIfMissing, useEvent } from '../lib/store';
import { FORMAT_LABELS } from '../lib/types';
import { PrintIcon, DownloadIcon, MedalIcon, TrophyIcon, ICON_SM, ICON_LG } from '../lib/icons';

const MEDAL_COLORS = ['#d4af37', '#9ca3af', '#cd7f32']; // gold, silver, bronze

export default function ResultsPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const toast = useToast();

  useEffect(() => {
    if (!event && eventId) void fetchEventIfMissing(eventId);
  }, [event, eventId]);

  if (!event) {
    return (
      <div className="container" style={{ paddingTop: '18vh', textAlign: 'center' }}>
        <Logo variant="stacked" height={100} />
        <h2 style={{ marginTop: 'var(--space-6)' }}>Results not found</h2>
        <Button to="/">Back to Roundmark</Button>
      </div>
    );
  }

  const standings = computeTeamStandings(event);
  const winner = standings[0];
  const podium = standings.slice(0, 3);

  async function shareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Results link copied', 'success');
    } catch {
      toast('Could not copy the link', 'error');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rm-bg)', ...eventThemeVars(event) }}>
    <div className="container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)', maxWidth: 900 }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-8)' }}>
        {event.logoUrl ? <img src={event.logoUrl} alt="" style={{ height: 34 }} /> : <Logo variant="horizontal" height={30} />}
        <div className="row no-print">
          <Button variant="secondary" size="sm" onClick={shareLink}>
            Share link
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <PrintIcon size={ICON_SM} /> Print
          </Button>
          <Button variant="secondary" size="sm" onClick={() => downloadCSV(`${event.name || 'event'}-results.csv`, buildResultsCSV(event))}>
            <DownloadIcon size={ICON_SM} /> Export CSV
          </Button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
        <ProvisionalBadge locked={event.locked} />
        <h1 style={{ marginTop: 'var(--space-4)', marginBottom: 4 }}>{event.name}</h1>
        <p className="text-muted">
          {event.date && new Date(`${event.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {event.venue} · {FORMAT_LABELS[event.format]}
          {event.format !== 'scramble' && <> · {(event.scoringMode ?? 'gross') === 'net' ? 'Net' : 'Gross'}</>}
          {event.charityName && <> · In support of {event.charityName}</>}
        </p>
      </div>

      {!event.locked && (
        <Card soft style={{ marginBottom: 'var(--space-6)', textAlign: 'center' }}>
          <Badge tone="amber">These results are provisional until the organiser locks them.</Badge>
        </Card>
      )}

      {/* Podium */}
      {winner && winner.thru > 0 && (
        <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-8)' }}>
          {podium.map((row, i) => (
            <Card key={row.teamId} style={i === 0 ? { border: '2px solid var(--rm-green-fairway)' } : undefined}>
              <div style={{ lineHeight: 0, marginBottom: 'var(--space-2)', color: MEDAL_COLORS[i] }} aria-hidden="true">
                <MedalIcon size={ICON_LG} />
              </div>
              <h3 style={{ marginBottom: 2 }}>{row.name}</h3>
              <div className="text-small text-muted" style={{ marginBottom: 'var(--space-2)' }}>
                {row.playerNames.join(' · ')}
              </div>
              <div className="leaderboard-score" style={{ fontSize: '1.4rem' }}>
                {row.value} {event.format === 'stableford' ? 'pts' : ''}
              </div>
              {row.tied && <Badge tone="amber">Decided on countback</Badge>}
            </Card>
          ))}
        </div>
      )}

      <h2>Team standings</h2>
      <LeaderboardTable event={event} />

      {event.format !== 'scramble' && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h2>Individual standings</h2>
          <IndividualStandingsTable event={event} />
        </div>
      )}

      {(() => {
        const awards = effectiveAwards(event)
          .map((a) => ({ award: a, winner: resolveAwardWinner(event, a) }))
          .filter((x) => x.winner || x.award.prize);
        if (!awards.length) return null;
        return (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h2>Awards &amp; prizes</h2>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {awards.map(({ award, winner }) => (
                <Card key={award.id}>
                  <div className="stat-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <TrophyIcon size={ICON_SM} /> {award.title}{award.hole ? ` — hole ${award.hole}` : ''}
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.4rem' }}>{winner ?? '—'}</div>
                  {award.prize && <div className="text-small text-muted" style={{ marginTop: 2 }}>Prize: {award.prize}</div>}
                </Card>
              ))}
            </div>
          </div>
        );
      })()}

      {event.sponsors.length > 0 && (
        <div style={{ marginTop: 'var(--space-10)' }}>
          <SponsorStrip sponsors={event.sponsors} />
        </div>
      )}

      <p className="text-small text-muted text-center" style={{ marginTop: 'var(--space-10)' }}>
        Powered by Roundmark — the easiest way to run a company golf day.
      </p>
    </div>
    </div>
  );
}
