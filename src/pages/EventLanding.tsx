// Public event landing + registration page (/e/:eventId).
// No account needed. Registering does not guarantee a place — the organiser
// reviews and approves sign-ups. Field set is configured by the organiser.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Button, Card, FieldWrap, Logo, SponsorStrip } from '../components/ui';
import { Countdown } from '../components/Countdown';
import { EventContent } from '../components/EventContent';
import { EventPageHero } from '../components/EventPageHero';
import { effectiveAwards } from '../lib/awards';
import { SuccessIcon, TrophyIcon, ICON_SM, ICON_XL } from '../lib/icons';
import { isFutureEvent } from '../lib/dates';
import { fetchEventIfMissing, submitRegistration, useEvent } from '../lib/store';
import { eventThemeVars } from '../lib/theme';
import type { Registration } from '../lib/types';
import { REGISTRATION_FIELD_LABELS } from '../lib/types';

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
  const future = isFutureEvent(event.date);
  const blocks = event.content ?? [];

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
      <EventPageHero event={event} />

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

        {/* Prizes up for grabs (pre-event teaser; winners hidden until results) */}
        {(() => {
          const prizes = effectiveAwards(event).filter((a) => a.prize);
          if (!prizes.length) return null;
          return (
            <section style={{ marginBottom: 'var(--space-10)' }}>
              <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>Prizes up for grabs</h2>
              <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {prizes.map((a) => (
                  <Card key={a.id} style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--rm-accent, var(--rm-green-fairway))', display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                      <TrophyIcon size={ICON_SM} />
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
                      {a.title}{a.hole ? ` — hole ${a.hole}` : ''}
                    </div>
                    <div className="text-muted" style={{ marginTop: 2 }}>{a.prize}</div>
                  </Card>
                ))}
              </div>
            </section>
          );
        })()}

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
