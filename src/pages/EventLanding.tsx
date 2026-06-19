// Public event landing + registration page (/e/:eventId).
// No account needed. Registering does not guarantee a place — the organiser
// reviews and approves sign-ups. Field set is configured by the organiser.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, FieldWrap, Logo, SponsorStrip } from '../components/ui';
import { Countdown } from '../components/Countdown';
import { EventContent } from '../components/EventContent';
import { SuccessIcon, ICON_XL } from '../lib/icons';
import { isFutureEvent } from '../lib/dates';
import { fetchEventIfMissing, submitRegistration, useEvent } from '../lib/store';
import { eventThemeVars, readableTextOn } from '../lib/theme';
import type { Registration } from '../lib/types';
import { FORMAT_LABELS, REGISTRATION_FIELD_LABELS } from '../lib/types';

function formatDate(iso: string): string {
  if (!iso) return 'Date to be confirmed';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function EventLandingPage() {
  const { eventId } = useParams();
  const event = useEvent(eventId);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    company: '', handicap: '', dietary: '', phone: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event && eventId) void fetchEventIfMissing(eventId);
  }, [event, eventId]);

  if (!event) {
    return (
      <div className="container" style={{ paddingTop: '18vh', textAlign: 'center' }}>
        <Logo variant="stacked" height={100} />
        <h2 style={{ marginTop: 'var(--space-6)' }}>Event not found</h2>
        <p className="text-muted">Double-check the link with your organiser.</p>
      </div>
    );
  }

  const reg = event.registration;
  const shownFields = (reg?.fields ?? []).filter((f) => f.show);
  const brandBg = event.brandColor ?? '#27542A';
  const future = isFutureEvent(event.date);
  const blocks = event.content ?? [];

  // Hero: a background image (with a darkening overlay for legibility) when set,
  // otherwise the solid brand colour.
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
  const showRegisterCta = !done && !!reg?.open;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError(null);

    // Validate required optional fields.
    for (const f of shownFields) {
      if (f.required && !String(form[f.key]).trim()) {
        setError(`${REGISTRATION_FIELD_LABELS[f.key]} is required.`);
        return;
      }
    }

    setSubmitting(true);
    const payload: Omit<Registration, 'id' | 'status' | 'createdAt' | 'playerId'> = {
      eventId: event.id,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      company: form.company.trim() || undefined,
      handicap: form.handicap.trim() ? Number(form.handicap) : null,
      dietary: form.dietary.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    const err = await submitRegistration(payload);
    setSubmitting(false);
    if (err) setError(err);
    else setDone(true);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--rm-bg)', ...eventThemeVars(event) }}>
      {/* Branded hero */}
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
          <h1 style={{ color: headerText, marginTop: 'var(--space-4)', marginBottom: 8 }}>{event.name}</h1>
          <p style={{ color: headerText, opacity: 0.85, margin: 0, fontSize: '1.1rem' }}>
            {formatDate(event.date)} · {event.venue}
          </p>
          <p style={{ color: headerText, opacity: 0.75, margin: '4px 0 0' }}>
            {FORMAT_LABELS[event.format]}
            {event.charityName && <> · In support of {event.charityName}</>}
          </p>
          {showRegisterCta && (
            <a
              href="#register"
              className="btn btn-lg"
              style={{ marginTop: 'var(--space-6)', background: ctaBg, color: readableTextOn(ctaBg), border: 'none' }}
            >
              Register to play
            </a>
          )}
        </div>
      </header>

      <main className="container" style={{ maxWidth: 720, paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-16)' }}>
        {future && (
          <Card soft style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
            <div className="text-small text-muted" style={{ marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tee-off countdown
            </div>
            <Countdown dateIso={event.date} />
          </Card>
        )}

        {reg?.note && (
          <p style={{ fontSize: '1.05rem', textAlign: 'center', marginBottom: 'var(--space-8)' }}>{reg.note}</p>
        )}

        {/* Organiser-composed content blocks (the microsite) */}
        <EventContent blocks={blocks} />

        {/* Registration */}
        <div id="register" style={{ scrollMarginTop: 'var(--space-6)' }}>
        {done ? (
          <Card padLg style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--rm-success)', display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}><SuccessIcon size={ICON_XL} /></div>
            <h2>You're registered!</h2>
            <p className="text-muted">
              Thanks {form.firstName || 'there'} — your registration is in. Your place
              isn't confirmed until the organiser approves it; they'll be in touch by email.
            </p>
          </Card>
        ) : reg?.open ? (
          <Card padLg>
            <h2 style={{ marginTop: 0 }}>Register to play</h2>
            <p className="text-muted" style={{ marginTop: 0 }}>
              Fill in your details below. Registering doesn't guarantee a spot —
              the organiser will confirm your place.
            </p>
            <form onSubmit={handleSubmit} className="stack-4" style={{ marginTop: 'var(--space-6)' }}>
              <div className="form-grid">
                <FieldWrap label="First name" required htmlFor="r-first">
                  <input id="r-first" className="input" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
                </FieldWrap>
                <FieldWrap label="Last name" required htmlFor="r-last">
                  <input id="r-last" className="input" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
                </FieldWrap>
                <FieldWrap label="Email" required htmlFor="r-email" className="span-2">
                  <input id="r-email" type="email" className="input" required value={form.email} onChange={(e) => set('email', e.target.value)} />
                </FieldWrap>

                {shownFields.map((f) => (
                  <FieldWrap
                    key={f.key}
                    label={REGISTRATION_FIELD_LABELS[f.key]}
                    required={f.required}
                    htmlFor={`r-${f.key}`}
                    className={f.key === 'dietary' ? 'span-2' : ''}
                  >
                    <input
                      id={`r-${f.key}`}
                      className="input"
                      type={f.key === 'handicap' ? 'number' : f.key === 'phone' ? 'tel' : 'text'}
                      required={f.required}
                      value={form[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  </FieldWrap>
                ))}
              </div>

              {error && <p style={{ color: 'var(--rm-error)', margin: 0 }}>{error}</p>}

              <Button type="submit" size="lg" block disabled={submitting}>
                {submitting ? 'Submitting…' : 'Register'}
              </Button>
            </form>
          </Card>
        ) : (
          <Card padLg style={{ textAlign: 'center' }}>
            <Badge tone="amber">Registration closed</Badge>
            <p className="text-muted" style={{ marginTop: 'var(--space-4)' }}>
              Sign-ups for this event aren't open. Please contact the organiser.
            </p>
          </Card>
        )}
        </div>

        {event.sponsors.length > 0 && (
          <div style={{ marginTop: 'var(--space-10)' }}>
            <SponsorStrip sponsors={event.sponsors} />
          </div>
        )}

        <p className="text-small text-muted text-center" style={{ marginTop: 'var(--space-10)' }}>
          Powered by Roundmark.
        </p>
      </main>
    </div>
  );
}
