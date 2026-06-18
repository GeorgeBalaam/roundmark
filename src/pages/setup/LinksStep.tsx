// Wizard step 6: QR / magic scoring links per team.

import { Button, EmptyState } from '../../components/ui';
import { QRLinkCard } from '../../components/qr';
import { LinkIcon, PrintIcon, ICON_SM } from '../../lib/icons';
import type { RoundmarkEvent } from '../../lib/types';

export default function LinksStep({ event }: { event: RoundmarkEvent }) {
  if (event.teams.length === 0) {
    return (
      <EmptyState
        icon={LinkIcon}
        title="Create teams first"
        body="Each team gets its own QR scoring link. Go back a step and build your teams."
      />
    );
  }

  return (
    <div className="stack-6">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>QR scoring links</h3>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            One scorer per team scans their QR code — no app, no account. Print the
            sheet and hand a card to each team at registration.
          </p>
        </div>
        <Button variant="secondary" to={`/print/${event.id}/qr`}>
          <PrintIcon size={ICON_SM} /> Print QR sheet
        </Button>
      </div>
      <div className="grid-cards">
        {event.teams.map((team) => (
          <QRLinkCard key={team.id} event={event} team={team} />
        ))}
      </div>
    </div>
  );
}
