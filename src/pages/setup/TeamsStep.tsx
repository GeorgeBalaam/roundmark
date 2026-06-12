// Wizard step 4: team builder — manual assignment plus auto-balance by handicap.

import { useState } from 'react';
import { Badge, Button, Card, ConfirmDialog, EmptyState } from '../../components/ui';
import { useToast } from '../../components/toast-context';
import { autoBalanceTeams, syncScorecards } from '../../lib/events';
import { makeId, updateEvent } from '../../lib/store';
import type { Player, RoundmarkEvent, Team } from '../../lib/types';

export default function TeamsStep({ event }: { event: RoundmarkEvent }) {
  const toast = useToast();
  const [teamSize, setTeamSize] = useState<3 | 4>(4);
  const [confirmRebalance, setConfirmRebalance] = useState(false);

  const assigned = new Set(event.teams.flatMap((t) => t.playerIds));
  const unassigned = event.players.filter((p) => !assigned.has(p.id));
  const hostsExist = event.players.some((p) => p.role === 'host');

  function playerById(id: string): Player | undefined {
    return event.players.find((p) => p.id === id);
  }

  function runAutoBalance() {
    updateEvent(event.id, (e) => {
      e.teams = autoBalanceTeams(e.players, teamSize);
      syncScorecards(e);
    });
    setConfirmRebalance(false);
    toast('Teams balanced by handicap', 'success');
  }

  function addTeam() {
    updateEvent(event.id, (e) => {
      e.teams.push({
        id: makeId(),
        name: `Team ${e.teams.length + 1}`,
        playerIds: [],
        startingHole: 1,
      });
      syncScorecards(e);
    });
  }

  function patchTeam(teamId: string, patch: Partial<Team>) {
    updateEvent(event.id, (e) => {
      const team = e.teams.find((t) => t.id === teamId);
      if (team) Object.assign(team, patch);
      syncScorecards(e);
    });
  }

  function removeTeam(teamId: string) {
    updateEvent(event.id, (e) => {
      e.teams = e.teams.filter((t) => t.id !== teamId);
      syncScorecards(e);
    });
  }

  function assignPlayer(teamId: string, playerId: string) {
    if (!playerId) return;
    updateEvent(event.id, (e) => {
      const team = e.teams.find((t) => t.id === teamId);
      if (team && !team.playerIds.includes(playerId)) team.playerIds.push(playerId);
      syncScorecards(e);
    });
  }

  function unassignPlayer(teamId: string, playerId: string) {
    updateEvent(event.id, (e) => {
      const team = e.teams.find((t) => t.id === teamId);
      if (team) team.playerIds = team.playerIds.filter((id) => id !== playerId);
      syncScorecards(e);
    });
  }

  if (event.players.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title="Add players first"
        body="Teams are built from your player list. Go back a step and add or import players."
      />
    );
  }

  return (
    <div className="stack-6">
      <Card padLg soft>
        <div className="row-between">
          <div>
            <h3 style={{ marginBottom: 4 }}>Team builder</h3>
            <p className="text-muted" style={{ margin: 0 }}>
              Build teams of 3–4 by hand, or let Roundmark balance them by handicap
              {hostsExist && ' and spread hosts across teams'}.
            </p>
          </div>
          <div className="row">
            <label className="field-label" htmlFor="team-size" style={{ margin: 0 }}>
              Team size
            </label>
            <select
              id="team-size"
              className="select"
              style={{ width: 80 }}
              value={teamSize}
              onChange={(e) => setTeamSize(Number(e.target.value) as 3 | 4)}
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
            <Button
              onClick={() => (event.teams.length > 0 ? setConfirmRebalance(true) : runAutoBalance())}
            >
              ⚖ Auto-balance teams
            </Button>
          </div>
        </div>
      </Card>

      {unassigned.length > 0 && event.teams.length > 0 && (
        <div>
          <Badge tone="amber">
            {unassigned.length} player{unassigned.length === 1 ? '' : 's'} not in a team yet
          </Badge>
        </div>
      )}

      {event.teams.length === 0 ? (
        <EmptyState
          icon="🏌️"
          title="No teams yet"
          body={`Auto-balance your ${event.players.length} players into teams of ${teamSize}, or start a team manually.`}
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button onClick={runAutoBalance}>Auto-balance now</Button>
              <Button variant="secondary" onClick={addTeam}>
                Add a team manually
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid-cards">
            {event.teams.map((team) => {
              const teamHasHost = team.playerIds.some((id) => playerById(id)?.role === 'host');
              const totalHandicap = team.playerIds.reduce((s, id) => s + (playerById(id)?.handicap ?? 0), 0);
              return (
                <Card key={team.id}>
                  <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
                    <input
                      className="input"
                      style={{ fontWeight: 600, fontFamily: 'var(--font-heading)', maxWidth: 200 }}
                      value={team.name}
                      aria-label="Team name"
                      onChange={(e) => patchTeam(team.id, { name: e.target.value })}
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeTeam(team.id)}>
                      ✕
                    </Button>
                  </div>

                  <div className="stack-2" style={{ marginBottom: 'var(--space-4)' }}>
                    {team.playerIds.map((pid) => {
                      const p = playerById(pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="row-between" style={{ background: 'var(--rm-card-soft)', borderRadius: 10, padding: '8px 12px' }}>
                          <span style={{ fontSize: '0.92rem' }}>
                            <strong>
                              {p.firstName} {p.lastName}
                            </strong>{' '}
                            <span className="text-muted text-small">
                              {p.handicap !== null && p.handicap !== undefined ? `HC ${p.handicap}` : 'no HC'}
                              {p.role === 'host' ? ' · Host' : ''}
                            </span>
                          </span>
                          <button
                            onClick={() => unassignPlayer(team.id, pid)}
                            aria-label={`Remove ${p.firstName} from ${team.name}`}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--rm-muted)', fontSize: '1rem', padding: 4 }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                    {team.playerIds.length === 0 && <div className="text-small text-muted">No players yet.</div>}
                  </div>

                  {unassigned.length > 0 && team.playerIds.length < 4 && (
                    <select
                      className="select"
                      style={{ marginBottom: 'var(--space-4)' }}
                      value=""
                      aria-label={`Add player to ${team.name}`}
                      onChange={(e) => assignPlayer(team.id, e.target.value)}
                    >
                      <option value="">+ Add player…</option>
                      {unassigned.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                          {p.handicap !== null && p.handicap !== undefined ? ` (HC ${p.handicap})` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="row-between">
                    <label className="text-small row" style={{ gap: 6 }}>
                      <span className="text-muted">Starting hole</span>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={event.holes.length}
                        style={{ width: 70, minHeight: 36, padding: '4px 8px' }}
                        value={team.startingHole}
                        onChange={(e) => patchTeam(team.id, { startingHole: Math.max(1, Math.min(event.holes.length, Number(e.target.value) || 1)) })}
                      />
                    </label>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="text-small text-muted">HC {totalHandicap}</span>
                      {hostsExist && !teamHasHost && team.playerIds.length > 0 && <Badge tone="amber">No host</Badge>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <div>
            <Button variant="secondary" onClick={addTeam}>
              + Add another team
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmRebalance}
        title="Rebuild all teams?"
        body="Auto-balance replaces your current teams with new ones balanced by handicap. Any scores already entered stay attached to old team links and will be lost from the leaderboard."
        confirmLabel="Rebuild teams"
        danger
        onConfirm={runAutoBalance}
        onCancel={() => setConfirmRebalance(false)}
      />
    </div>
  );
}
