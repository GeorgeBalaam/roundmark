// Wizard step 7: review summary and live controls.

import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EventStatusBadge } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { eventChecklist } from '../../lib/events';
import { addAudit, updateEvent } from '../../lib/store';
import type { EventStatus, RoundmarkEvent } from '../../lib/types';
import { EVENT_TYPE_LABELS, FORMAT_LABELS } from '../../lib/types';

export default function ReviewStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();
  const [confirmLive, setConfirmLive] = useState(false);
  const { items, ready } = eventChecklist(event);

  function setStatus(status: EventStatus, message: string) {
    updateEvent(event.id, (e) => {
      e.status = status;
    });
    addAudit({ eventId: event.id, by: 'Demo Organiser', action: message });
    toast(message, 'success');
  }

  return (
    <div className="stack-6" style={{ maxWidth: 860 }}>
      <Card padLg>
        <div className="row-between" style={{ marginBottom: 'var(--space-5)' }}>
          <h3 style={{ margin: 0 }}>Event summary</h3>
          <EventStatusBadge status={event.status} locked={event.locked} />
        </div>
        <div className="form-grid" style={{ gap: 'var(--space-4) var(--space-6)' }}>
          {[
            ['Event', event.name || '—'],
            ['Date', event.date || '—'],
            ['Venue', event.venue || '—'],
            ['Type', EVENT_TYPE_LABELS[event.type]],
            ['Format', FORMAT_LABELS[event.format]],
            ['Holes', `${event.holes.length} (par ${event.holes.reduce((s, h) => s + h.par, 0)})`],
            ['Players', String(event.players.length)],
            ['Teams', String(event.teams.length)],
            ['Sponsors', String(event.sponsors.length)],
            ['Charity', event.charityName ?? '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="stat-label" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--rm-muted)', fontWeight: 600 }}>
                {label}
              </div>
              <div style={{ fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card padLg soft>
        <h4 style={{ marginBottom: 'var(--space-4)' }}>Ready checklist</h4>
        <div className="stack-2">
          {items.map((item) => (
            <div key={item.key} className="row">
              <span aria-hidden="true" style={{ width: 22, color: item.done ? 'var(--rm-success)' : 'var(--rm-live)' }}>
                {item.done ? '✓' : '○'}
              </span>
              <span style={{ color: item.done ? 'var(--rm-ink)' : 'var(--rm-muted)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card padLg>
        <h4 style={{ marginBottom: 'var(--space-3)' }}>Live controls</h4>
        {event.status === 'draft' && (
          <>
            <p className="text-muted">
              {ready
                ? 'Everything is in place. Mark the event ready, then take it live on the day.'
                : 'Finish the checklist above before marking the event ready.'}
            </p>
            <Button disabled={!ready} onClick={() => setStatus('ready', 'Event marked ready')}>
              Mark event ready
            </Button>
          </>
        )}
        {event.status === 'ready' && (
          <>
            <p className="text-muted">
              Going live opens scoring for every team link and starts the public leaderboard.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button onClick={() => setConfirmLive(true)}>🟢 Go live</Button>
              <Button variant="ghost" onClick={() => setStatus('draft', 'Event moved back to draft')}>
                Back to draft
              </Button>
            </div>
          </>
        )}
        {event.status === 'live' && (
          <>
            <p className="text-muted">
              The event is live — scores are flowing to the leaderboard. Manage the day
              from the support console.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button to={`/leaderboard/${event.id}`}>Open live leaderboard</Button>
              <Button variant="secondary" to={`/app/event/${event.id}/console`}>
                Support console
              </Button>
              <Button variant="secondary" to={`/tv/${event.id}`}>
                TV mode
              </Button>
            </div>
          </>
        )}
        {event.status === 'completed' && (
          <>
            <p className="text-muted">
              This event is completed{event.locked ? ' and the results are locked' : ''}.
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button to={`/results/${event.id}`}>Final results</Button>
              <Button variant="secondary" to={`/app/event/${event.id}/console`}>
                Support console
              </Button>
            </div>
          </>
        )}
        {event.scoringPaused && (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <Badge tone="amber">Scoring is currently paused — resume it from the console</Badge>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmLive}
        title="Take the event live?"
        body="Team scoring links become active and the public leaderboard starts updating. You can pause scoring or correct scores from the support console at any time."
        confirmLabel="Go live"
        onConfirm={() => {
          setStatus('live', 'Event is live');
          setConfirmLive(false);
        }}
        onCancel={() => setConfirmLive(false)}
      />
    </div>
  );
}
