// Pre-launch holding page (public homepage for now). Captures early-access
// interest into the `early_access` table; a DB trigger sends a branded
// confirmation email. The app, login, demo and event links all still work
// underneath — there's a discreet hidden link (bottom-right) into sign-in for
// testing access while the public site is in coming-soon mode.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, FormField, Logo } from '../components/ui';
import { SuccessIcon, ICON_XL } from '../lib/icons';
import { submitEarlyAccess } from '../lib/notifications';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EarlyAccessPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Please add your name.'); return; }
    if (!EMAIL_RE.test(form.email.trim())) { setError('Please enter a valid email address.'); return; }
    setSubmitting(true);
    const err = await submitEarlyAccess({ email: form.email, name: form.name, company: form.company });
    setSubmitting(false);
    if (err) { setError("Something went wrong — please try again."); return; }
    setDone(true);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--rm-green-deeper)',
        backgroundImage: 'linear-gradient(160deg, var(--rm-green-deep), var(--rm-green-deeper))',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-5)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <Logo variant="horizontal-white" height={38} />

        <div style={{ marginTop: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
          <Badge tone="green">Coming soon</Badge>
        </div>

        <h1 style={{ color: '#fff', fontSize: '2.2rem', lineHeight: 1.15, margin: '0 0 var(--space-4)' }}>
          Live scoring for golf days, done before the first drink.
        </h1>
        <p style={{ color: '#dfe7d8', fontSize: '1.1rem', lineHeight: 1.6, margin: '0 0 var(--space-8)' }}>
          Roundmark turns any golf day into a live leaderboard your players follow from their phones —
          no spreadsheets, no apps to download. Register your interest and we'll let you know the moment
          we open up.
        </p>

        {done ? (
          <Card padLg style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--rm-success)', display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
              <SuccessIcon size={ICON_XL} />
            </div>
            <h2 style={{ marginBottom: 'var(--space-2)' }}>You're on the list</h2>
            <p className="text-muted" style={{ margin: 0 }}>
              Thanks {form.name.split(' ')[0] || 'there'} — we've sent a confirmation to your inbox and
              we'll be in touch as soon as Roundmark is ready.
            </p>
          </Card>
        ) : (
          <Card padLg style={{ textAlign: 'left' }}>
            <h2 style={{ marginTop: 0, marginBottom: 'var(--space-4)', textAlign: 'center' }}>Get early access</h2>
            <form onSubmit={handleSubmit} className="stack-4">
              <FormField label="Name" placeholder="Your name" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              <FormField label="Email" type="email" placeholder="you@company.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
              <FormField label="Company or society" placeholder="Optional" value={form.company} onChange={(e) => set('company', e.target.value)} />
              {error && <p style={{ color: 'var(--rm-error)', margin: 0 }}>{error}</p>}
              <Button type="submit" size="lg" block disabled={submitting}>
                {submitting ? 'Submitting…' : 'Notify me at launch'}
              </Button>
              <p className="text-small text-muted" style={{ margin: 0, textAlign: 'center' }}>
                No spam — just one email when we're live.
              </p>
            </form>
          </Card>
        )}

        <p style={{ color: '#9fb894', fontSize: '0.8rem', marginTop: 'var(--space-8)' }}>
          Roundmark — effortless live scoring for golf days.
        </p>
      </div>

      {/* Discreet access into the app for testing while the site is in coming-soon mode. */}
      <Link
        to="/login"
        aria-label="Sign in"
        title="Sign in"
        style={{
          position: 'fixed',
          bottom: 10,
          right: 12,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)',
          opacity: 0.4,
        }}
      />
    </div>
  );
}
