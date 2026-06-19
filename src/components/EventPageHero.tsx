// Branded hero for the public event page (/e/:id). Shared by EventLanding and
// the live preview in the setup wizard so the two can never drift apart.
// Read-only and brand-aware (inherits --rm-* theme via the page wrapper).

import { Logo } from './ui';
import { readableTextOn } from '../lib/theme';
import type { RoundmarkEvent } from '../lib/types';
import { FORMAT_LABELS } from '../lib/types';

function formatDate(iso: string): string {
  if (!iso) return 'Date to be confirmed';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function EventPageHero({ event, preview }: { event: RoundmarkEvent; preview?: boolean }) {
  const brandBg = event.brandColor ?? '#27542A';
  const hasHeroImage = !!event.heroImageUrl;
  const headerText = hasHeroImage ? '#ffffff' : readableTextOn(brandBg);
  const heroStyle: React.CSSProperties = hasHeroImage
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(10,18,12,0.55), rgba(10,18,12,0.78)), url(${event.heroImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        color: headerText,
      }
    : { background: brandBg, color: headerText };
  const ctaBg = event.accentColor ?? '#8DB259';
  const showRegisterCta = !!event.registration?.open;

  return (
    <header
      style={{
        ...heroStyle,
        padding: hasHeroImage ? 'var(--space-16) 0 var(--space-14)' : 'var(--space-10) 0 var(--space-8)',
      }}
    >
      <div className="container" style={{ textAlign: 'center' }}>
        {event.logoUrl ? (
          <img src={event.logoUrl} alt="" style={{ height: 48, marginBottom: 'var(--space-4)' }} />
        ) : (
          <Logo variant={headerText === '#ffffff' ? 'horizontal-white' : 'horizontal'} height={32} />
        )}
        <h1 style={{ color: headerText, marginTop: 'var(--space-4)', marginBottom: 8 }}>{event.name || 'Your event name'}</h1>
        {event.heroTagline && (
          <p style={{ color: headerText, opacity: 0.9, margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 600 }}>
            {event.heroTagline}
          </p>
        )}
        <p style={{ color: headerText, opacity: 0.85, margin: 0, fontSize: '1.1rem' }}>
          {formatDate(event.date)} · {event.venue || 'Venue to be confirmed'}
        </p>
        <p style={{ color: headerText, opacity: 0.75, margin: '4px 0 0' }}>
          {FORMAT_LABELS[event.format]}
          {event.charityName && <> · In support of {event.charityName}</>}
        </p>
        {showRegisterCta &&
          (preview ? (
            <span
              className="btn btn-lg"
              aria-hidden="true"
              style={{ marginTop: 'var(--space-6)', background: ctaBg, color: readableTextOn(ctaBg), border: 'none', pointerEvents: 'none' }}
            >
              Register to play
            </span>
          ) : (
            <a
              href="#register"
              className="btn btn-lg"
              style={{ marginTop: 'var(--space-6)', background: ctaBg, color: readableTextOn(ctaBg), border: 'none' }}
            >
              Register to play
            </a>
          ))}
      </div>
    </header>
  );
}
