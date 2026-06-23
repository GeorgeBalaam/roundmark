// Admin support console: event health, score corrections with audit trail,
// lock/unlock and export controls.

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardShell } from '../components/shells';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EventStatusBadge,
  FormField,
  PageHeader,
  ProvisionalBadge,
  SelectField,
  StatCard,
  TextAreaField,
} from '../components/ui';
import { useToast } from '../components/toast-context';
import { ResumeIcon, PauseIcon, LockIcon, DownloadIcon, CheckIcon, AnnounceIcon, ICON_SM } from '../lib/icons';
import { buildResultsCSV, downloadCSV } from '../lib/csv';
import { lockResults, unlockResults } from '../lib/events';
import { eventProgress } from '../lib/scoring';
import { addAudit, updateEvent, updateScorecard, useDB, useEvent, sendEventMessage, useEventMessages } from '../lib/store';
import { resolveAwardWinner, isManualAward } from '../lib/awards';
import type { RoundmarkEvent, ScoreCell, Team } from '../lib/types';

const ADMIN_NAME = 'Demo Organiser';

function AnnouncementCard({ eventId }: { eventId: string }) {
  const toast = useToast();
  const messages = useEventMessages(eventId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    const err = await sendEventMessage(eventId, text);
    setBusy(false);
    if (err) { toast(`Couldn't send: ${err}`, 'error'); return; }
    setText('');
    toast('Announcement sent to all devices', 'success');
  }

  return (
    <Card padLg style={{ marginBottom: 'var(--space-8)', maxWidth: 720 }}>
      <h3 style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AnnounceIcon size={ICON_SM} /> Announcements
      </h3>
      <p className="text-muted text-small">
        Send a message to every phone, leaderboard and TV connected to the event — "lunch is served", "tee-off delayed", "results shortly".
      </p>
      <div className="stack-3" style={{ marginTop: 'var(--space-4)' }}>
        <TextAreaField label="Message" rows={2} placeholder="e.g. Lunch is served in the clubhouse" value={text} onChange={(e) => setText(e.target.value)} />
        <div>
          <Button onClick={send} disabled={busy || !text.trim()}>
            <AnnounceIcon size={ICON_SM} /> {busy ? 'Sending…' : 'Send to all devices'}
          </Button>
        </div>
      </div>
      {messages.length > 0 && (
        <div className="stack-2" style={{ marginTop: 'var(--space-5)' }}>
          <div className="text-small" style={{ fontWeight: 600, color: 'var(--rm-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recent</div>
          {messages.slice(0, 5).map((m) => (
            <div key={m.id} className="text-small" style={{ paddingBottom: 6, borderBottom: '1px solid var(--rm-border-soft)' }}>
              <span style={{ color: 'var(--rm-muted)' }}>{new Date(m.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span> — {m.body}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function cellToText(cell: ScoreCell): string {
  if (cell === null) return '';
  return String(cell);
}

function textToCell(text: string): ScoreCell | undefined {
  const t = text.trim().toUpperCase();
  if (t === '') return null;
  if (t === 'X') return 'X';
  const n = Number(t);
  if (!Number.isInteger(n) || n < 1 || n > 15) return undefined; // invalid
  return n;
}

/** Editable score cell — commits on blur so each correction is one audit entry. */
function ScoreCellInput({
  event,
  team,
  playerId,
  hole,
  value,
  label,
}: {
  event: RoundmarkEvent;
  team: Team;
  playerId?: string;
  hole: number;
  value: ScoreCell;
  label: string;
}) {
  const toast = useToast();

  function commit(text: string, revert: () => void) {
    const next = textToCell(text);
    if (next === undefined) {
      toast('Scores are 1–15, X for no score, or blank', 'error');
      revert();
      return;
    }
    if (next === value) return;
    updateScorecard(event.id, team.id, (card) => {
      if (playerId) {
        card.playerScores[playerId][hole - 1] = next;
      } else {
        card.teamScores[hole - 1] = next;
      }
      if (next !== null && !card.submittedHoles.includes(hole)) card.submittedHoles.push(hole);
      if (next === null) {
        // If the whole hole is now empty, un-mark it as submitted.
        const anyLeft = playerId
          ? team.playerIds.some((pid) => card.playerScores[pid]?.[hole - 1] !== null)
          : false;
        if (!anyLeft) card.submittedHoles = card.submittedHoles.filter((h) => h !== hole);
      }
    });
    addAudit({
      eventId: event.id,
      by: ADMIN_NAME,
      teamId: team.id,
      playerId,
      hole,
      action: 'Score corrected',
      oldValue: value === null ? '(empty)' : String(value),
      newValue: next === null ? '(empty)' : String(next),
    });
    toast(`${label}, hole ${hole}: ${value ?? '—'} → ${next ?? '—'}`, 'success');
  }

  return (
    <input
      className="input"
      style={{ width: 52, minHeight: 34, padding: '4px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
      defaultValue={cellToText(value)}
      key={`${team.id}-${playerId ?? 'team'}-${hole}-${cellToText(value)}`}
      aria-label={`${label} hole ${hole}`}
      onBlur={(e) => commit(e.target.value, () => (e.target.value = cellToText(value)))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export default function ConsolePage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);
  const db = useDB();
  const toast = useToast();
  const [teamFilter, setTeamFilter] = useState('all');
  const [holeFilter, setHoleFilter] = useState('all');
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const audit = useMemo(
    () => db.auditLogs.filter((a) => a.eventId === eventId).slice(0, 50),
    [db.auditLogs, eventId],
  );

  if (!event) {
    return (
      <DashboardShell>
        <PageHeader title="Event not found" actions={<Button to="/app">Back to dashboard</Button>} />
      </DashboardShell>
    );
  }

  const progress = eventProgress(event);
  const missing = progress.total - progress.done;
  const teams = teamFilter === 'all' ? event.teams : event.teams.filter((t) => t.id === teamFilter);
  const holes = holeFilter === 'all' ? event.holes : event.holes.filter((h) => h.number === Number(holeFilter));

  function setPaused(paused: boolean) {
    updateEvent(event!.id, (e) => {
      e.scoringPaused = paused;
    });
    addAudit({ eventId: event!.id, by: ADMIN_NAME, action: paused ? 'Scoring paused' : 'Scoring resumed' });
    toast(paused ? 'Scoring paused' : 'Scoring resumed', 'success');
  }

  function markLive() {
    updateEvent(event!.id, (e) => {
      e.status = 'live';
    });
    addAudit({ eventId: event!.id, by: ADMIN_NAME, action: 'Event marked live (console)' });
    toast('Event is live', 'success');
  }

  function playerName(pid: string): string {
    const p = event!.players.find((x) => x.id === pid);
    return p ? `${p.firstName} ${p.lastName}` : 'Unknown';
  }

  return (
    <DashboardShell>
      <PageHeader
        title={`Support console`}
        subtitle={
          <span className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <strong>{event.name}</strong>
            <EventStatusBadge status={event.status} locked={event.locked} />
            <ProvisionalBadge locked={event.locked} />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" to={`/leaderboard/${event.id}`}>
              Leaderboard
            </Button>
            <Button variant="secondary" to={`/app/event/${event.id}`}>
              Event setup
            </Button>
          </>
        }
      />

      {/* Health panel */}
      <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 'var(--space-8)' }}>
        <StatCard label="Teams" value={event.teams.length} />
        <StatCard label="Players" value={event.players.length} />
        <StatCard label="Holes saved" value={`${progress.done}/${progress.total}`} />
        <StatCard label="Missing holes" value={missing} hint={missing > 0 ? 'Across all teams' : 'All scores are in'} />
      </div>

      {/* Event controls */}
      <Card padLg style={{ marginBottom: 'var(--space-8)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Event controls</h3>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {event.status !== 'live' && !event.locked && (
            <Button onClick={markLive}>Mark event live</Button>
          )}
          {event.status === 'live' && !event.locked && (
            <Button variant="secondary" onClick={() => setPaused(!event.scoringPaused)}>
              {event.scoringPaused ? <><ResumeIcon size={ICON_SM} /> Resume scoring</> : <><PauseIcon size={ICON_SM} /> Pause scoring</>}
            </Button>
          )}
          {!event.locked ? (
            <Button variant="danger" onClick={() => setConfirmLock(true)}>
              <LockIcon size={ICON_SM} /> Lock results
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmUnlock(true)}>
              Unlock as admin
            </Button>
          )}
          <Button variant="ghost" onClick={() => downloadCSV(`${event.name || 'event'}-results.csv`, buildResultsCSV(event))}>
            <DownloadIcon size={ICON_SM} /> Export CSV
          </Button>
          {event.locked && (
            <Button variant="ghost" to={`/results/${event.id}`}>
              Final results page
            </Button>
          )}
        </div>
      </Card>

      {/* Team progress */}
      <h3>Team progress</h3>
      <div className="table-panel table-scroll" style={{ marginBottom: 'var(--space-8)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Team</th>
              <th className="num">Starting hole</th>
              <th className="num">Holes saved</th>
              <th>Missing holes</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {event.teams.map((team) => {
              const card = event.scorecards[team.id];
              const saved = card?.submittedHoles ?? [];
              const missingHoles = event.holes.map((h) => h.number).filter((n) => !saved.includes(n));
              return (
                <tr key={team.id}>
                  <td style={{ fontWeight: 600 }}>{team.name}</td>
                  <td className="num">{team.startingHole}</td>
                  <td className="num">
                    {saved.length}/{event.holes.length}{' '}
                    {saved.length === event.holes.length && <Badge tone="green"><CheckIcon size={ICON_SM} /></Badge>}
                  </td>
                  <td className="text-small text-muted" style={{ maxWidth: 280 }}>
                    {missingHoles.length === 0 ? '—' : missingHoles.join(', ')}
                  </td>
                  <td className="text-small text-muted">
                    {card?.updatedAt ? new Date(card.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Score corrections */}
      <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div>
          <h3 style={{ marginBottom: 4 }}>Score corrections</h3>
          <p className="text-muted text-small" style={{ margin: 0 }}>
            Edit any cell — changes save on blur and every correction is logged below.
            {event.locked && ' Results are locked: admin edits still work and stay audited.'}
          </p>
        </div>
        <div className="row">
          <SelectField
            label="Team"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            options={[{ value: 'all', label: 'All teams' }, ...event.teams.map((t) => ({ value: t.id, label: t.name }))]}
            wrapClassName=""
          />
          <SelectField
            label="Hole"
            value={holeFilter}
            onChange={(e) => setHoleFilter(e.target.value)}
            options={[{ value: 'all', label: 'All holes' }, ...event.holes.map((h) => ({ value: String(h.number), label: `Hole ${h.number}` }))]}
            wrapClassName=""
          />
        </div>
      </div>

      <div className="stack-6" style={{ marginBottom: 'var(--space-8)' }}>
        {teams.map((team) => {
          const card = event.scorecards[team.id];
          if (!card) return null;
          return (
            <div key={team.id} className="table-panel table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', left: 0, background: 'var(--rm-card-soft)', zIndex: 1 }}>{team.name}</th>
                    {holes.map((h) => (
                      <th key={h.number} className="num">
                        H{h.number}
                        <div style={{ fontWeight: 400 }}>Par {h.par}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {event.format === 'scramble' ? (
                    <tr>
                      <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--rm-card)' }}>Team score</td>
                      {holes.map((h) => (
                        <td key={h.number} className="num">
                          <ScoreCellInput
                            event={event}
                            team={team}
                            hole={h.number}
                            value={card.teamScores[h.number - 1] ?? null}
                            label={team.name}
                          />
                        </td>
                      ))}
                    </tr>
                  ) : (
                    team.playerIds.map((pid) => (
                      <tr key={pid}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--rm-card)' }}>
                          {playerName(pid)}
                        </td>
                        {holes.map((h) => (
                          <td key={h.number} className="num">
                            <ScoreCellInput
                              event={event}
                              team={team}
                              playerId={pid}
                              hole={h.number}
                              value={card.playerScores[pid]?.[h.number - 1] ?? null}
                              label={playerName(pid)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* Live announcements */}
      <AnnouncementCard eventId={event.id} />

      {/* Awards & prizes */}
      <Card padLg style={{ marginBottom: 'var(--space-8)', maxWidth: 720 }}>
        <h3 style={{ marginBottom: 4 }}>Awards &amp; prizes</h3>
        <p className="text-muted text-small">
          Assign winners for the judged awards — the auto ones work out from the leaderboard. All shown on the final results.
        </p>
        {(event.awards ?? []).length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            No awards set up. Add them in the event's <strong>Awards &amp; prizes</strong> step.
          </p>
        ) : (
          <div className="stack-4" style={{ marginTop: 'var(--space-4)' }}>
            {(event.awards ?? []).map((award) => {
              const resolved = resolveAwardWinner(event, award);
              return (
                <div key={award.id} className="row-between" style={{ gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <div style={{ fontWeight: 600 }}>
                      {award.title || 'Untitled award'}{award.hole ? ` — hole ${award.hole}` : ''}
                    </div>
                    {award.prize && <div className="text-small text-muted">Prize: {award.prize}</div>}
                  </div>
                  <div style={{ flex: '1 1 220px' }}>
                    {isManualAward(award) ? (
                      <FormField
                        label="Winner"
                        placeholder="Player or team name"
                        value={award.winner ?? ''}
                        onChange={(e) =>
                          updateEvent(event.id, (ev) => {
                            const a = (ev.awards ?? []).find((x) => x.id === award.id);
                            if (a) a.winner = e.target.value || undefined;
                          })
                        }
                      />
                    ) : (
                      <>
                        <div className="field-label">Winner (auto)</div>
                        <div style={{ fontWeight: 600 }}>{resolved ?? 'Pending — needs scores'}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Audit log */}
      <h3>Audit log</h3>
      <div className="table-panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>By</th>
              <th>Action</th>
              <th>Team / player</th>
              <th className="num">Hole</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted text-center">
                  Nothing logged yet. Corrections and status changes appear here.
                </td>
              </tr>
            )}
            {audit.map((a) => {
              const team = event.teams.find((t) => t.id === a.teamId);
              return (
                <tr key={a.id}>
                  <td className="text-small text-muted" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{a.by}</td>
                  <td style={{ fontWeight: 600 }}>{a.action}</td>
                  <td className="text-small">
                    {team?.name ?? '—'}
                    {a.playerId && <div className="text-muted">{playerName(a.playerId)}</div>}
                  </td>
                  <td className="num">{a.hole ?? '—'}</td>
                  <td className="text-small">
                    {a.oldValue !== undefined ? (
                      <>
                        <span className="text-muted">{a.oldValue}</span> → <strong>{a.newValue}</strong>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmLock}
        title="Lock the final results?"
        danger
        body={
          <>
            <p>
              Players can no longer change scores and the leaderboard switches from
              provisional to <strong>final</strong>.
            </p>
            {missing > 0 && (
              <p>
                <Badge tone="amber">{missing} hole{missing === 1 ? '' : 's'} still missing scores</Badge>
              </p>
            )}
            <p style={{ margin: 0 }}>You can still unlock as admin if something needs fixing.</p>
          </>
        }
        confirmLabel="Lock results"
        onConfirm={() => {
          lockResults(event.id, ADMIN_NAME);
          setConfirmLock(false);
          toast('Results locked — leaderboard is now final', 'success');
        }}
        onCancel={() => setConfirmLock(false)}
      />
      <ConfirmDialog
        open={confirmUnlock}
        title="Unlock results?"
        body="The event returns to live and the leaderboard goes back to provisional. This is logged."
        confirmLabel="Unlock"
        onConfirm={() => {
          unlockResults(event.id, ADMIN_NAME);
          setConfirmUnlock(false);
          toast('Results unlocked', 'success');
        }}
        onCancel={() => setConfirmUnlock(false)}
      />
    </DashboardShell>
  );
}
