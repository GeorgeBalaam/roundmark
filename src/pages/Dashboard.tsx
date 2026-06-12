// Organiser dashboard: the control centre.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/shells';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  EventStatusBadge,
  PageHeader,
  StatCard,
} from '../components/ui';
import { useToast } from '../components/toast-context';
import { createEvent, duplicateEvent, eventChecklist } from '../lib/events';
import { eventProgress } from '../lib/scoring';
import { resetDemoData, useDB } from '../lib/store';
import type { RoundmarkEvent } from '../lib/types';
import { EVENT_TYPE_LABELS, FORMAT_LABELS } from '../lib/types';

function formatDate(iso: string): string {
  if (!iso) return 'Date TBC';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EventCard({ event }: { event: RoundmarkEvent }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [dupOpen, setDupOpen] = useState(false);
  const [withPlayers, setWithPlayers] = useState(true);
  const progress = eventProgress(event);
  const { ready } = eventChecklist(event);

  function duplicate() {
    const copy = duplicateEvent(event, withPlayers);
    setDupOpen(false);
    toast('Event duplicated — scores were not copied', 'success');
    navigate(`/app/event/${copy.id}`);
  }

  return (
    <Card hover>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <EventStatusBadge status={event.status} locked={event.locked} />
        <span className="text-small text-muted">{FORMAT_LABELS[event.format]}</span>
      </div>
      <h3 style={{ marginBottom: 4 }}>{event.name || 'Untitled event'}</h3>
      <p className="text-small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        {formatDate(event.date)} · {event.venue || 'Venue TBC'}
        <br />
        {EVENT_TYPE_LABELS[event.type]}
      </p>
      <div className="row" style={{ gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <span className="text-small">
          <strong>{event.players.length}</strong> <span className="text-muted">players</span>
        </span>
        <span className="text-small">
          <strong>{event.teams.length}</strong> <span className="text-muted">teams</span>
        </span>
        {event.status === 'live' && (
          <span className="text-small">
            <strong>
              {progress.done}/{progress.total}
            </strong>{' '}
            <span className="text-muted">holes in</span>
          </span>
        )}
        {!ready && event.status === 'draft' && <Badge tone="amber">Setup incomplete</Badge>}
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {event.status === 'completed' || event.locked ? (
          <>
            <Button size="sm" to={`/results/${event.id}`}>
              View results
            </Button>
            <Button size="sm" variant="secondary" to={`/app/event/${event.id}/console`}>
              Console
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" to={`/app/event/${event.id}`}>
              Open event
            </Button>
            {(event.status === 'live' || event.status === 'ready') && (
              <Button size="sm" variant="secondary" to={`/leaderboard/${event.id}`}>
                Leaderboard
              </Button>
            )}
            {event.status === 'live' && (
              <Button size="sm" variant="secondary" to={`/app/event/${event.id}/console`}>
                Console
              </Button>
            )}
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => setDupOpen(true)}>
          Duplicate
        </Button>
      </div>

      {dupOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDupOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Duplicate “{event.name}”?</h3>
            <p className="text-muted">
              The course, sponsors and branding are copied to a new draft event.
              Scores are never copied.
            </p>
            <label className="row" style={{ marginBottom: 'var(--space-6)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={withPlayers}
                onChange={(e) => setWithPlayers(e.target.checked)}
                style={{ width: 18, height: 18 }}
              />
              Also copy the player list
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDupOpen(false)}>
                Cancel
              </Button>
              <Button onClick={duplicate}>Duplicate event</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const db = useDB();
  const navigate = useNavigate();
  const toast = useToast();

  const events = db.events;
  const upcoming = events.filter((e) => e.status === 'draft' || e.status === 'ready').length;
  const live = events.filter((e) => e.status === 'live').length;
  const completed = events.filter((e) => e.status === 'completed').length;
  const totalPlayers = events.reduce((s, e) => s + e.players.length, 0);

  function handleCreate() {
    const event = createEvent();
    navigate(`/app/event/${event.id}`);
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Your golf days"
        subtitle="Create an event, build the teams and run the day from here."
        actions={
          <Button size="lg" onClick={handleCreate}>
            + Create event
          </Button>
        }
      />

      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Upcoming" value={upcoming} />
        <StatCard label="Live now" value={live} />
        <StatCard label="Completed" value={completed} />
        <StatCard label="Total players" value={totalPlayers} />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="No events yet"
          body="Your first golf day is a few minutes away. Create the event, add the course and players, and share QR scorecards with each team."
          action={<Button onClick={handleCreate}>Create your first event</Button>}
        />
      ) : (
        <div className="grid-cards">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-12)' }} className="row">
        <span className="text-small text-muted">Demo data acting up?</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            resetDemoData();
            toast('Demo data reset', 'success');
          }}
        >
          Reset demo data
        </Button>
      </div>
    </DashboardShell>
  );
}
