// QRLinkCard: QR code + copyable scoring link for one team.

import { QRCodeSVG } from 'qrcode.react';
import type { RoundmarkEvent, Team } from '../lib/types';
import { teamScoringPath, teamScoringUrl } from '../lib/links';
import { Button, Card } from './ui';
import { useToast } from './toast-context';

export function QRLinkCard({
  event,
  team,
  printMode,
}: {
  event: RoundmarkEvent;
  team: Team;
  printMode?: boolean;
}) {
  const toast = useToast();
  const url = teamScoringUrl(event.id, team.id);
  const players = team.playerIds
    .map((pid) => event.players.find((p) => p.id === pid))
    .filter(Boolean)
    .map((p) => `${p!.firstName} ${p!.lastName}`);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast('Scoring link copied', 'success');
    } catch {
      toast('Could not copy — long-press the link instead', 'error');
    }
  }

  return (
    <Card className="qr-card">
      <div>
        <h3 style={{ marginBottom: 2 }}>{team.name}</h3>
        <div className="text-small text-muted">
          Starting hole {team.startingHole} · {players.join(' · ') || 'No players yet'}
        </div>
      </div>
      <div className="qr-box">
        <QRCodeSVG value={url} size={printMode ? 200 : 148} fgColor="#17211b" />
      </div>
      <div className="text-small" style={{ wordBreak: 'break-all', color: 'var(--rm-muted)' }}>{url}</div>
      {!printMode && (
        <div className="row no-print">
          <Button variant="secondary" size="sm" onClick={copy}>
            Copy link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.open(teamScoringPath(event.id, team.id), '_blank')}>
            Open scorecard
          </Button>
        </div>
      )}
    </Card>
  );
}
