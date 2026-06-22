// Live organiser announcements: a dismissible banner that pops on every device
// connected to the event (scorers, leaderboard, TV) the moment the organiser
// sends one. Loads recent messages on mount and listens via the realtime store.

import { useEffect, useState } from 'react';
import { loadEventMessages, useEventMessages } from '../lib/store';
import { AnnounceIcon, CloseIcon, ICON_SM } from '../lib/icons';

export function LiveAnnouncements({ eventId }: { eventId: string }) {
  const messages = useEventMessages(eventId);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    void loadEventMessages(eventId);
  }, [eventId]);

  const latest = messages[0];
  if (!latest || latest.id === dismissed) return null;

  return (
    <div className="live-announce" role="status" aria-live="polite">
      <span className="live-announce-icon" aria-hidden="true"><AnnounceIcon size={ICON_SM} /></span>
      <span className="live-announce-body">{latest.body}</span>
      <button type="button" className="live-announce-close" aria-label="Dismiss" onClick={() => setDismissed(latest.id)}>
        <CloseIcon size={ICON_SM} />
      </button>
    </div>
  );
}
