// Event history: completed events and past winners.

import { DashboardShell } from '../components/shells';
import { Button, Card, EmptyState, EventStatusBadge, PageHeader } from '../components/ui';
import { TrophyIcon, ICON_SM } from '../lib/icons';
import { computeTeamStandings } from '../lib/scoring';
import { useVisibleEvents } from '../lib/store';
import { FORMAT_LABELS } from '../lib/types';

export default function HistoryPage() {
  const events = useVisibleEvents();
  const completed = events.filter((e) => e.status === 'completed');

  return (
    <DashboardShell>
      <PageHeader
        title="Event history"
        subtitle="Completed golf days, winners and final results."
      />
      {completed.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="No completed events yet"
          body="When you lock the results of a golf day it will appear here with its winner and final standings."
        />
      ) : (
        <div className="grid-cards">
          {completed.map((event) => {
            const winner = computeTeamStandings(event)[0];
            return (
              <Card key={event.id} hover>
                <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                  <EventStatusBadge status={event.status} locked={event.locked} />
                  <span className="text-small text-muted">{FORMAT_LABELS[event.format]}</span>
                </div>
                <h3 style={{ marginBottom: 4 }}>{event.name}</h3>
                <p className="text-small text-muted">
                  {event.date && new Date(`${event.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {event.venue}
                </p>
                {winner && winner.thru > 0 && (
                  <p style={{ margin: 'var(--space-4) 0' }}>
                    <TrophyIcon size={ICON_SM} aria-hidden="true" style={{ verticalAlign: '-0.15em' }} /> <strong>{winner.name}</strong>
                    <span className="text-muted"> — {winner.value} {event.format === 'stableford' ? 'pts' : 'strokes'}</span>
                  </p>
                )}
                <div className="row">
                  <Button size="sm" to={`/results/${event.id}`}>
                    Final results
                  </Button>
                  <Button size="sm" variant="ghost" to={`/app/event/${event.id}/console`}>
                    Console
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}
