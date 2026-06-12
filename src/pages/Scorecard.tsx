// Player/scorer mobile scorecard. The most important player-facing screen:
// no login, large tap targets, one hole at a time, obvious save state.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, ConfirmDialog, Logo, SponsorStrip } from '../components/ui';
import { useToast } from '../components/toast-context';
import { stablefordPoints } from '../lib/scoring';
import { updateEvent, useEvent } from '../lib/store';
import type { RoundmarkEvent, ScoreCell, Team } from '../lib/types';
import { FORMAT_LABELS } from '../lib/types';

const MAX_STROKES = 12;

/** Play order from the team's starting hole (shotgun starts). */
function playOrder(event: RoundmarkEvent, team: Team): number[] {
  const n = event.holes.length;
  return Array.from({ length: n }, (_, i) => ((team.startingHole - 1 + i) % n) + 1);
}

function ScoreStepper({
  label,
  sub,
  value,
  par,
  points,
  disabled,
  onChange,
}: {
  label: string;
  sub?: string;
  value: ScoreCell;
  par: number;
  points?: number | null;
  disabled?: boolean;
  onChange: (v: ScoreCell) => void;
}) {
  const display = value === null ? '·' : value === 'X' ? 'X' : value;
  return (
    <div className="score-player-row">
      <div style={{ minWidth: 0 }}>
        <div className="score-player-name">{label}</div>
        {sub && <div className="text-small text-muted">{sub}</div>}
        {points !== undefined && points !== null && value !== null && (
          <div className="text-small" style={{ color: 'var(--rm-green-fresh)', fontWeight: 600 }}>
            {points} pt{points === 1 ? '' : 's'}
          </div>
        )}
        <button
          onClick={() => onChange(value === 'X' ? null : 'X')}
          disabled={disabled}
          style={{
            border: 'none',
            background: 'none',
            padding: '4px 0',
            fontSize: '0.78rem',
            color: value === 'X' ? 'var(--rm-live)' : 'var(--rm-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {value === 'X' ? 'Clear no-score' : 'No score (X)'}
        </button>
      </div>
      <div className="score-stepper">
        <button
          className="score-stepper-btn"
          aria-label={`Decrease score for ${label}`}
          disabled={disabled || value === 'X' || value === null || value <= 1}
          onClick={() => typeof value === 'number' && onChange(Math.max(1, value - 1))}
        >
          −
        </button>
        <div
          className={`score-stepper-value ${value === 'X' ? 'is-x' : ''} ${value === null ? 'is-empty' : ''}`}
          aria-label={`Score for ${label}`}
        >
          {display}
        </div>
        <button
          className="score-stepper-btn"
          aria-label={`Increase score for ${label}`}
          disabled={disabled || value === 'X' || (typeof value === 'number' && value >= MAX_STROKES)}
          onClick={() => onChange(value === null ? par : Math.min(MAX_STROKES, (value as number) + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  const { eventId, teamId } = useParams();
  const event = useEvent(eventId);
  const team = event?.teams.find((t) => t.id === teamId);
  const toast = useToast();

  const order = useMemo(() => (event && team ? playOrder(event, team) : []), [event, team]);
  const card = event && team ? event.scorecards[team.id] : undefined;

  // Current hole = first unplayed hole in play order.
  const [holeNumber, setHoleNumber] = useState<number | null>(() => {
    if (!event || !team) return null;
    const c = event.scorecards[team.id];
    const o = playOrder(event, team);
    if (o.length === 0) return null;
    return o.find((h) => !c?.submittedHoles.includes(h)) ?? o[0];
  });

  // Draft values for the current hole.
  const [draft, setDraft] = useState<Record<string, ScoreCell>>({});
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const hole = event?.holes.find((h) => h.number === holeNumber);

  // Reload the draft from saved scores whenever the hole changes — a
  // render-time state adjustment (see react.dev "You Might Not Need an Effect")
  // so a half-entered hole is never clobbered by unrelated re-renders.
  const draftKey = `${eventId}/${teamId}/${holeNumber}`;
  const [loadedKey, setLoadedKey] = useState('');
  if (loadedKey !== draftKey) {
    setLoadedKey(draftKey);
    const next: Record<string, ScoreCell> = {};
    if (event && team && card && hole) {
      if (event.format === 'scramble') {
        next.team = card.teamScores[hole.number - 1] ?? null;
      } else {
        for (const pid of team.playerIds) {
          next[pid] = card.playerScores[pid]?.[hole.number - 1] ?? null;
        }
      }
    }
    setDraft(next);
  }

  if (!event || !team) {
    return (
      <div className="score-shell" style={{ textAlign: 'center', paddingTop: '20vh' }}>
        <Logo variant="stacked" height={100} />
        <h2 style={{ marginTop: 'var(--space-6)' }}>Scorecard not found</h2>
        <p className="text-muted">Check the link with your organiser — it may have changed.</p>
      </div>
    );
  }

  if (!hole || !card) return null;

  const players = team.playerIds
    .map((pid) => event.players.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const scoringClosed = event.locked || event.scoringPaused || event.status === 'completed';
  const notLiveYet = event.status === 'draft' || event.status === 'ready';
  const disabled = scoringClosed || notLiveYet;

  const positionInRound = order.indexOf(hole.number) + 1;
  const alreadySubmitted = card.submittedHoles.includes(hole.number);
  const anyValue = Object.values(draft).some((v) => v !== null);
  const allFilled =
    event.format === 'scramble'
      ? draft.team !== null && draft.team !== undefined
      : players.every((p) => draft[p.id] !== null && draft[p.id] !== undefined);

  function persistHole() {
    if (!event || !team || !hole) return;
    updateEvent(event.id, (e) => {
      const c = e.scorecards[team.id];
      if (!c) return;
      if (e.format === 'scramble') {
        c.teamScores[hole.number - 1] = draft.team ?? null;
      } else {
        for (const pid of team.playerIds) {
          if (!c.playerScores[pid]) c.playerScores[pid] = e.holes.map(() => null);
          c.playerScores[pid][hole.number - 1] = draft[pid] ?? null;
        }
      }
      if (!c.submittedHoles.includes(hole.number)) c.submittedHoles.push(hole.number);
      c.updatedAt = new Date().toISOString();
    });
    toast(`Hole ${hole.number} saved ✓`, 'success');
    // Advance to the next unplayed hole.
    const remaining = order.filter(
      (h) => h !== hole.number && !card!.submittedHoles.includes(h),
    );
    if (remaining.length > 0) setHoleNumber(remaining[0]);
  }

  function saveHole() {
    if (alreadySubmitted) {
      setConfirmOverwrite(true);
    } else {
      persistHole();
    }
  }

  const holesDone = card.submittedHoles.length;

  return (
    <div className="score-shell">
      {/* Event header */}
      <div className="row-between" style={{ paddingTop: 'var(--space-2)' }}>
        {event.logoUrl ? (
          <img src={event.logoUrl} alt={event.name} style={{ height: 30 }} />
        ) : (
          <Logo variant="icon" height={30} />
        )}
        <Link to={`/leaderboard/${event.id}`} className="btn btn-secondary btn-sm">
          Leaderboard
        </Link>
      </div>
      <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{event.name}</div>
        <div className="text-small text-muted">
          {team.name} · {FORMAT_LABELS[event.format]}
        </div>
      </div>

      {/* Status banners */}
      {notLiveYet && (
        <div style={{ margin: 'var(--space-4) 0', textAlign: 'center' }}>
          <Badge tone="blue">Scoring opens when the organiser takes the event live</Badge>
        </div>
      )}
      {event.scoringPaused && !event.locked && (
        <div style={{ margin: 'var(--space-4) 0', textAlign: 'center' }}>
          <Badge tone="amber">Scoring is paused — speak to the organiser</Badge>
        </div>
      )}
      {(event.locked || event.status === 'completed') && (
        <div style={{ margin: 'var(--space-4) 0', textAlign: 'center' }}>
          <Badge tone="neutral-dark">🔒 Results are locked — scores can no longer change</Badge>
        </div>
      )}

      {/* Hole navigation */}
      <div className="hole-nav-pills" role="tablist" aria-label="Holes">
        {order.map((h) => (
          <button
            key={h}
            role="tab"
            aria-selected={h === hole.number}
            className={`hole-pill ${h === hole.number ? 'current' : card.submittedHoles.includes(h) ? 'done' : ''}`}
            onClick={() => setHoleNumber(h)}
          >
            {h}
          </button>
        ))}
      </div>

      {/* Hole header */}
      <div className="score-hole-header">
        <div className="text-small text-muted" style={{ fontWeight: 600 }}>
          Hole {positionInRound} of {order.length}
        </div>
        <div className="score-hole-number">{hole.number}</div>
        <div className="score-hole-meta">
          <span>Par {hole.par}</span>
          <span>Stroke index {hole.strokeIndex}</span>
          {alreadySubmitted && <Badge tone="green">✓ Saved</Badge>}
        </div>
      </div>

      {/* Score entry */}
      <div className="stack-4">
        {event.format === 'scramble' ? (
          <ScoreStepper
            label="Team score"
            sub={`${players.map((p) => p.firstName).join(', ')}`}
            value={draft.team ?? null}
            par={hole.par}
            disabled={disabled}
            onChange={(v) => setDraft({ ...draft, team: v })}
          />
        ) : (
          players.map((p) => (
            <ScoreStepper
              key={p.id}
              label={`${p.firstName} ${p.lastName}`}
              sub={p.handicap !== null && p.handicap !== undefined ? `Handicap ${p.handicap}` : undefined}
              value={draft[p.id] ?? null}
              par={hole.par}
              points={
                event.format === 'stableford' && typeof draft[p.id] === 'number'
                  ? stablefordPoints(hole.par, draft[p.id] as number)
                  : undefined
              }
              disabled={disabled}
              onChange={(v) => setDraft({ ...draft, [p.id]: v })}
            />
          ))
        )}
      </div>

      {/* Sponsors */}
      {event.sponsors.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <SponsorStrip sponsors={event.sponsors} />
        </div>
      )}

      {/* Sticky save bar */}
      <div className="score-bottom-bar">
        <div className="score-bottom-bar-inner">
          <div className="text-small text-muted" style={{ minWidth: 80 }}>
            {holesDone}/{order.length} holes
            <br />
            saved
          </div>
          <Button block size="lg" onClick={saveHole} disabled={disabled || !anyValue}>
            {alreadySubmitted ? 'Update hole' : `Save hole ${hole.number}`}
            {!allFilled && anyValue ? ' (partial)' : ''}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOverwrite}
        title={`Update hole ${hole.number}?`}
        body="This hole was already saved. Saving again replaces the previous scores."
        confirmLabel="Replace scores"
        onConfirm={() => {
          setConfirmOverwrite(false);
          persistHole();
        }}
        onCancel={() => setConfirmOverwrite(false)}
      />
    </div>
  );
}
