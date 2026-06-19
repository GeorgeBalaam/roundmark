// Floating indicator of unsynced writes. Visible only when the outbox has
// pending writes or a sync error — so a scorer can tell their entries haven't
// reached the server yet (e.g. on a flaky course connection).

import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useSyncStatus } from '../lib/store';
import { ICON_SM } from '../lib/icons';

export function SyncIndicator() {
  const { pending, error } = useSyncStatus();
  if (pending === 0 && !error) return null;

  const isError = !!error;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 1000,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 'var(--radius-pill, 999px)',
        fontFamily: 'var(--font-heading)',
        fontSize: '0.8rem',
        fontWeight: 600,
        color: '#fff',
        background: isError ? 'var(--rm-error, #b3261e)' : 'var(--rm-ink, #17211b)',
        boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.2))',
      }}
    >
      {isError ? (
        <AlertTriangle size={ICON_SM} aria-hidden="true" />
      ) : (
        <RefreshCw size={ICON_SM} aria-hidden="true" style={{ animation: 'rm-spin 1s linear infinite' }} />
      )}
      {isError
        ? `Can't reach the server — retrying (${pending} unsaved)`
        : `Saving ${pending} change${pending === 1 ? '' : 's'}…`}
    </div>
  );
}
