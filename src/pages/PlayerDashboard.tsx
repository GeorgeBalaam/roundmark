// Player history dashboard — /me.
// Shows the signed-in user's personal golf history across all events they've
// appeared in as a player. Accessible to every role, but players land here
// automatically after signing in.

import { useEffect } from 'react';
import { DashboardShell } from '../components/shells';
import {
  Button,
  Card,
  EmptyState,
  EventStatusBadge,
  PageHeader,
  StatCard,
} from '../components/ui';
import { EventIcon } from '../lib/icons';
import { computePlayerStandings, formatToPar } from '../lib/scoring';
import { loadPlayerEvents, useDB, useMemberships, useSession, useStoreLoading } from '../lib/store';
import type { RoundmarkEvent } from '../lib/types';
import { FORMAT_LABELS } from '../lib/types';

function formatDate(iso: string): string {
  if (!iso) return 'Date TBC';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function PlayerEventCard({ event, playerId }: { event: RoundmarkEvent; playerId?: string }) {
  const player = playerId ? event.players.find((p) => p.id === playerId) : undefined;
  const team = player
    ? event.teams.find((t) => t.playerIds.includes(player.id))
    : undefined;

  const standings = computePlayerStandings(event);
  const myStanding = player
    ? standings.find((s) => s.playerId === player.id)
    : undefined;

  const isStableford = event.format === 'stableford';

  return (
    <Card hover>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <EventStatusBadge status={event.status} locked={event.locked} />
        <span className="text-small text-muted">{FORMAT_LABELS[event.format]}</span>
      </div>
      <h3 style={{ marginBottom: 4 }}>{event.name}</h3>
      <p className="text-small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        {formatDate(event.date)} · {event.venue}
      </p>

      {team && (
        <p className="text-small" style={{ marginBottom: 'var(--space-3)' }}>
          Team: <strong>{team.name}</strong>
        </p>
      )}

      {myStanding && myStanding.thru > 0 ? (
        <p style={{ marginBottom: 'var(--space-4)' }}>
          <strong style={{ fontSize: '1.15rem' }}>
            {myStanding.value} {isStableford ? 'pts' : 'strokes'}
          </strong>
          {myStanding.toPar !== null && (
            <span className="text-muted"> ({formatToPar(myStanding.toPar)})</span>
          )}
          <span className="text-small text-muted">
            {' '}· {myStanding.thru}/{event.holes.length} holes
          </span>
        </p>
      ) : (
        <p className="text-small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
          No scores recorded
        </p>
      )}

      <div className="row">
        <Button size="sm" to={`/leaderboard/${event.id}`}>
          Leaderboard
        </Button>
        {(event.status === 'completed' || event.locked) && (
          <Button size="sm" variant="secondary" to={`/results/${event.id}`}>
            Results
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function PlayerDashboardPage() {
  const db = useDB();
  const session = useSession();
  const memberships = useMemberships();
  const loading = useStoreLoading();
  const signedIn = !!session;

  useEffect(() => {
    if (signedIn) void loadPlayerEvents();
  }, [signedIn]);

  // The roster player this user is, per event (from their memberships).
  const playerIdByEvent = new Map(memberships.map((m) => [m.eventId, m.playerId]));

  // All events this user is a member of.
  const myEvents = db.events
    .filter((e) => playerIdByEvent.has(e.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Summary stats.
  const played = myEvents.filter((e) => e.status !== 'draft').length;
  const completed = myEvents.filter((e) => e.status === 'completed' || e.locked).length;

  // Best stableford score across events (for a quick headline stat).
  let bestScore: { value: number; label: string } | null = null;
  for (const event of myEvents) {
    if (event.format !== 'stableford') continue;
    const playerId = playerIdByEvent.get(event.id);
    if (!playerId) continue;
    const me = computePlayerStandings(event).find((s) => s.playerId === playerId);
    if (me && me.thru > 0 && (!bestScore || me.value > bestScore.value)) {
      bestScore = { value: me.value, label: 'pts (best round)' };
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        title="My golf days"
        subtitle="Events you've played in, your scores and results."
      />

      {loading && myEvents.length === 0 && (
        <p className="text-muted">Loading your events…</p>
      )}

      {!loading && myEvents.length === 0 ? (
        <EmptyState
          icon={EventIcon}
          title="No events yet"
          body="When an organiser adds you to a golf day you'll see your scores and results here."
        />
      ) : (
        <>
          <div
            className="grid-cards"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              marginBottom: 'var(--space-8)',
            }}
          >
            <StatCard label="Events" value={played} />
            <StatCard label="Completed" value={completed} />
            {bestScore && (
              <StatCard label="Best round" value={`${bestScore.value} pts`} />
            )}
          </div>

          <div className="grid-cards">
            {myEvents.map((event) => (
              <PlayerEventCard key={event.id} event={event} playerId={playerIdByEvent.get(event.id)} />
            ))}
          </div>
        </>
      )}
    </DashboardShell>
  );
}
