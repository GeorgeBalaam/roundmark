// Countdown to an event date. Renders nothing once the date has passed, so
// callers can drop it in unconditionally and it only shows for future events.

import { useEffect, useState } from 'react';
import { msUntil } from '../lib/dates';

export function Countdown({ dateIso, compact }: { dateIso: string; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  void now;
  const ms = msUntil(dateIso);
  if (ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const cells: [number, string][] = [
    [days, 'days'],
    [hours, 'hrs'],
    [mins, 'min'],
    [secs, 'sec'],
  ];

  return (
    <div
      className="row"
      style={{ gap: compact ? 'var(--space-3)' : 'var(--space-5)', justifyContent: 'center' }}
      aria-label={`Starts in ${days} days, ${hours} hours, ${mins} minutes`}
    >
      {cells.map(([value, label]) => (
        <div key={label} style={{ textAlign: 'center', minWidth: compact ? 40 : 56 }}>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: compact ? '1.4rem' : '2rem',
              lineHeight: 1,
              color: 'var(--rm-primary)',
            }}
          >
            {String(value).padStart(2, '0')}
          </div>
          <div className="text-small text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
