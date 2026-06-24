// Organiser dashboard: the control centre.

import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../components/shells';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  EventStatusBadge,
  PageHeader,
  StatCard,
  TextAreaField,
} from '../components/ui';
import { useToast } from '../components/toast-context';
import { createEvent, duplicateEvent, deleteEvent, lockResults, eventChecklist } from '../lib/events';
import { eventProgress } from '../lib/scoring';
import { resetDemoData, updateEvent, sendEventMessage, useIsAdmin, useRole, useVisibleEvents } from '../lib/store';
import {
  MoreIcon, PauseIcon, ResumeIcon, AnnounceIcon, LeaderboardIcon, TvIcon, LockIcon, ICON_SM,
} from '../lib/icons';
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

interface MenuItem { label: string; to?: string; onClick?: () => void; danger?: boolean }

function CardMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="card-menu" ref={ref}>
      <Button size="sm" variant="ghost" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreIcon size={ICON_SM} />
      </Button>
      {open && (
        <ul className="card-menu-list" role="menu">
          {items.map((it) => (
            <li key={it.label} role="none">
              {it.to ? (
                <Link role="menuitem" className="card-menu-item" to={it.to} onClick={() => setOpen(false)}>{it.label}</Link>
              ) : (
                <button role="menuitem" type="button" className={`card-menu-item ${it.danger ? 'danger' : ''}`} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconControl({ label, icon: Icon, to, onClick }: { label: string; icon: typeof LockIcon; to?: string; onClick?: () => void }) {
  if (to) {
    return <Button size="sm" variant="ghost" to={to} aria-label={label} title={label}><Icon size={ICON_SM} /></Button>;
  }
  return <Button size="sm" variant="ghost" onClick={onClick} aria-label={label} title={label}><Icon size={ICON_SM} /></Button>;
}

function EventCard({ event }: { event: RoundmarkEvent }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [dupOpen, setDupOpen] = useState(false);
  const [withPlayers, setWithPlayers] = useState(true);
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState('');
  const progress = eventProgress(event);
  const { ready } = eventChecklist(event);
  const ended = event.status === 'completed' || event.locked;

  function duplicate() {
    const copy = duplicateEvent(event, withPlayers);
    setDupOpen(false);
    toast('Event duplicated — scores were not copied', 'success');
    navigate(`/app/event/${copy.id}`);
  }
  function togglePause() {
    updateEvent(event.id, (e) => { e.scoringPaused = !e.scoringPaused; });
    toast(event.scoringPaused ? 'Scoring resumed' : 'Scoring paused', 'success');
  }
  async function sendAnnounce() {
    const err = await sendEventMessage(event.id, announceText);
    if (err) { toast(`Couldn't send: ${err}`, 'error'); return; }
    setAnnounceText('');
    setAnnounceOpen(false);
    toast('Announcement sent to all devices', 'success');
  }

  // Status-aware primary action.
  const primary = ended
    ? { label: 'Results', to: `/results/${event.id}` }
    : event.status === 'live'
      ? { label: 'Console', to: `/app/event/${event.id}/console` }
      : event.status === 'ready'
        ? { label: 'Open event', to: `/app/event/${event.id}` }
        : { label: 'Set up', to: `/app/event/${event.id}` };

  const menuItems: MenuItem[] = [
    { label: 'Event settings', to: `/app/event/${event.id}` },
    ...(event.status !== 'draft' ? [{ label: 'Leaderboard', to: `/leaderboard/${event.id}` }] : []),
    ...(event.status === 'live' || ended ? [{ label: 'Support console', to: `/app/event/${event.id}/console` }] : []),
    { label: 'Duplicate', onClick: () => setDupOpen(true) },
    { label: 'Delete', danger: true, onClick: () => setConfirmDelete(true) },
  ];

  return (
    <Card hover className="event-card">
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <EventStatusBadge status={event.status} locked={event.locked} />
        <span className="text-small text-muted">{FORMAT_LABELS[event.format]}</span>
      </div>
      <h3 style={{ marginBottom: 4 }}>{event.name || 'Untitled event'}</h3>
      <p className="text-small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        {formatDate(event.date)}{event.startTime ? ` · ${event.startTime}` : ''} · {event.venue || 'Venue TBC'}
        <br />
        {EVENT_TYPE_LABELS[event.type]}
      </p>
      <div className="row" style={{ gap: 'var(--space-5)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <span className="text-small"><strong>{event.players.length}</strong> <span className="text-muted">players</span></span>
        <span className="text-small"><strong>{event.teams.length}</strong> <span className="text-muted">teams</span></span>
        {event.status === 'live' && (
          <span className="text-small"><strong>{progress.done}/{progress.total}</strong> <span className="text-muted">holes in</span></span>
        )}
        {event.scoringPaused && event.status === 'live' && <Badge tone="amber">Paused</Badge>}
        {!ready && event.status === 'draft' && <Badge tone="amber">Setup incomplete</Badge>}
      </div>

      <div className="row-between" style={{ gap: 'var(--space-2)' }}>
        <Button size="sm" to={primary.to}>{primary.label}</Button>
        <CardMenu items={menuItems} />
      </div>

      {/* Day-of quick controls for a live event. */}
      {event.status === 'live' && (
        <div className="card-controls" style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--rm-border-soft)' }}>
          <IconControl label={event.scoringPaused ? 'Resume scoring' : 'Pause scoring'} icon={event.scoringPaused ? ResumeIcon : PauseIcon} onClick={togglePause} />
          <IconControl label="Send announcement" icon={AnnounceIcon} onClick={() => setAnnounceOpen(true)} />
          <IconControl label="Live leaderboard" icon={LeaderboardIcon} to={`/leaderboard/${event.id}`} />
          <IconControl label="TV mode" icon={TvIcon} to={`/tv/${event.id}`} />
          <IconControl label="Lock results" icon={LockIcon} onClick={() => setConfirmLock(true)} />
        </div>
      )}

      {dupOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setDupOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Duplicate “{event.name}”?</h3>
            <p className="text-muted">The course, sponsors and branding are copied to a new draft event. Scores are never copied.</p>
            <label className="row" style={{ marginBottom: 'var(--space-6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={withPlayers} onChange={(e) => setWithPlayers(e.target.checked)} style={{ width: 18, height: 18 }} />
              Also copy the player list
            </label>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setDupOpen(false)}>Cancel</Button>
              <Button onClick={duplicate}>Duplicate event</Button>
            </div>
          </div>
        </div>
      )}

      {announceOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setAnnounceOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Send an announcement</h3>
            <p className="text-muted" style={{ marginTop: 0 }}>Goes to every device connected to <strong>{event.name}</strong>.</p>
            <TextAreaField label="Message" rows={2} placeholder="e.g. Lunch is served in the clubhouse" value={announceText} onChange={(e) => setAnnounceText(e.target.value)} />
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <Button variant="ghost" onClick={() => setAnnounceOpen(false)}>Cancel</Button>
              <Button onClick={sendAnnounce} disabled={!announceText.trim()}>Send</Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmLock}
        title="Lock results?"
        body="This ends scoring and publishes the final results. You can unlock again from the console if needed."
        confirmLabel="Lock results"
        onConfirm={() => { lockResults(event.id, 'Organiser'); setConfirmLock(false); toast('Results locked', 'success'); }}
        onCancel={() => setConfirmLock(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${event.name || 'this event'}”?`}
        body="This permanently removes the event and its scores. This can't be undone."
        confirmLabel="Delete event"
        danger
        onConfirm={() => { deleteEvent(event.id); setConfirmDelete(false); toast('Event deleted', 'success'); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  );
}

export default function DashboardPage() {
  const events = useVisibleEvents();
  const navigate = useNavigate();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const role = useRole();

  // Players have their own dashboard — redirect them on arrival.
  if (role === 'player') return <Navigate to="/me" replace />;

  const upcoming = events.filter((e) => e.status === 'draft' || e.status === 'ready').length;
  const live = events.filter((e) => e.status === 'live').length;
  const completed = events.filter((e) => e.status === 'completed').length;
  const totalPlayers = events.reduce((s, e) => s + e.players.length, 0);

  function handleCreate() {
    // Building events is free — the paywall is at go-live (see ReviewStep), so
    // there's no gate on creation.
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

      {isAdmin && (
        <div style={{ marginTop: 'var(--space-12)' }} className="row">
          <Badge tone="neutral-dark">Admin</Badge>
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
      )}
    </DashboardShell>
  );
}
