// Public live leaderboard. Updates live from the store (storage events across
// tabs) plus a polling tick for the "last updated" indicator.
// TODO(production): swap polling for Supabase realtime subscriptions.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { IndividualStandingsTable, LeaderboardTable } from '../components/leaderboard';
import { Badge, Button, Logo, ProvisionalBadge, SponsorStrip } from '../components/ui';
import { LiveAnnouncements } from '../components/LiveAnnouncements';
import { eventProgress } from '../lib/scoring';
import { eventThemeVars, readableTextOn } from '../lib/theme';
import { fetchEventIfMissing, useEvent } from '../lib/store';
import { FORMAT_LABELS } from '../lib/types';

export default function LeaderboardPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!event && eventId) void fetchEventIfMissing(eventId);
  }, [event, eventId]);

  // Poll every 15s so "last updated" stays honest even with no interaction.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const [view, setView] = useState<'teams' | 'individuals'>('teams');

  if (!event) {
    return (
      <div className="container" style={{ paddingTop: '18vh', textAlign: 'center' }}>
        <Logo variant="stacked" height={100} />
        <h2 style={{ marginTop: 'var(--space-6)' }}>Leaderboard not found</h2>
        <p className="text-muted">Check the link with your organiser.</p>
        <Button to="/">Back to Roundmark</Button>
      </div>
    );
  }

  const progress = eventProgress(event);
  const showIndividuals = event.format !== 'scramble';
  void tick;

  const headerBg = event.brandColor ?? 'var(--rm-green-deep)';
  const headerText = readableTextOn(event.brandColor ?? '#27542A');
  const headerSubText = headerText === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(23,33,27,0.7)';
  const useWhiteLogo = headerText === '#ffffff';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rm-bg)', ...eventThemeVars(event) }}>
      <LiveAnnouncements eventId={event.id} />
      {/* Branded header */}
      <header style={{ background: headerBg, color: headerText, padding: 'var(--space-8) 0 var(--space-6)' }}>
        <div className="container">
          <div className="row-between">
            {event.logoUrl ? (
              <img src={event.logoUrl} alt="" style={{ height: 36 }} />
            ) : (
              <Logo variant={useWhiteLogo ? 'horizontal-white' : 'horizontal'} height={30} />
            )}
            <div className="row no-print">
              <Button variant="secondary" size="sm" to={`/tv/${event.id}`}>
                TV mode
              </Button>
            </div>
          </div>
          <h1 style={{ color: headerText, marginTop: 'var(--space-5)', marginBottom: 4 }}>{event.name}</h1>
          <p style={{ color: headerSubText, margin: 0 }}>
            {event.venue} · {FORMAT_LABELS[event.format]}
            {event.format !== 'scramble' && ` · ${(event.scoringMode ?? 'gross') === 'net' ? 'Net' : 'Gross'}`}
            {event.charityName && (
              <>
                {' '}
                · In support of{' '}
                {event.charityUrl ? (
                  <a href={event.charityUrl} target="_blank" rel="noreferrer" style={{ color: headerText }}>
                    {event.charityName}
                  </a>
                ) : (
                  event.charityName
                )}
              </>
            )}
          </p>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
        <div className="row-between" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <ProvisionalBadge locked={event.locked} />
            {event.status === 'live' && (
              <Badge tone="orange" pulse>
                Live — auto-refreshing
              </Badge>
            )}
            <span className="text-small text-muted">
              {progress.done} of {progress.total} holes in · Updated{' '}
              {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {showIndividuals && (
            <div className="row no-print">
              <Button size="sm" variant={view === 'teams' ? 'primary' : 'ghost'} onClick={() => setView('teams')}>
                Teams
              </Button>
              <Button size="sm" variant={view === 'individuals' ? 'primary' : 'ghost'} onClick={() => setView('individuals')}>
                Individuals
              </Button>
            </div>
          )}
        </div>

        {view === 'teams' || !showIndividuals ? (
          <LeaderboardTable event={event} />
        ) : (
          <IndividualStandingsTable event={event} />
        )}

        {event.locked && (
          <div style={{ marginTop: 'var(--space-6)' }} className="no-print">
            <Link to={`/results/${event.id}`} className="btn btn-primary">
              View final results
            </Link>
          </div>
        )}

        {event.sponsors.length > 0 && (
          <div style={{ marginTop: 'var(--space-10)' }}>
            <SponsorStrip sponsors={event.sponsors} />
          </div>
        )}

        <p className="text-small text-muted text-center" style={{ marginTop: 'var(--space-10)' }}>
          Powered by Roundmark — the easiest way to run a company golf day.
        </p>
      </main>
    </div>
  );
}
