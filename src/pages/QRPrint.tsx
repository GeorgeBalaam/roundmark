// Printable QR sheet: one card per team with players and scoring link.

import { useParams } from 'react-router-dom';
import { QRLinkCard } from '../components/qr';
import { Button, Logo, PageHeader } from '../components/ui';
import { useEvent } from '../lib/store';

export default function QRPrintPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);

  if (!event) {
    return (
      <div className="container" style={{ paddingTop: '18vh', textAlign: 'center' }}>
        <h2>Event not found</h2>
        <Button to="/app">Back to dashboard</Button>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)' }}>
      <div className="no-print">
        <PageHeader
          title="QR scoring sheet"
          subtitle={`${event.name} — print this page and hand each team their card at registration.`}
          actions={
            <>
              <Button variant="secondary" to={`/app/event/${event.id}?step=links`}>
                Back to setup
              </Button>
              <Button onClick={() => window.print()}>🖨 Print</Button>
            </>
          }
        />
      </div>

      <div className="row-between" style={{ marginBottom: 'var(--space-6)' }}>
        <Logo variant="horizontal" height={28} />
        <div className="text-small text-muted">
          {event.name} · {event.venue}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {event.teams.map((team) => (
          <QRLinkCard key={team.id} event={event} team={team} printMode />
        ))}
      </div>
    </div>
  );
}
