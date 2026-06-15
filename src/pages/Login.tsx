import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { signIn, signInDemo, useSession } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';
import { Button, Card, FieldWrap, Logo } from '../components/ui';

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/app" replace />;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email.trim());
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  }

  function enterDemo() {
    signInDemo();
    navigate('/app');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <Card padLg style={{ width: 'min(94vw, 440px)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-6)' }}>
          <Logo variant="stacked" height={110} />
        </div>

        {sent ? (
          <div className="stack-4">
            <div
              style={{
                background: 'var(--rm-surface-raised)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-5)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📬</div>
              <h3 style={{ marginBottom: 8 }}>Check your email</h3>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                We sent a sign-in link to <strong>{email}</strong>. Click it to
                open your organiser dashboard — no password needed.
              </p>
            </div>
            <Button variant="ghost" block onClick={() => setSent(false)}>
              Use a different email
            </Button>
            <Button variant="ghost" block to="/">
              Back to homepage
            </Button>
          </div>
        ) : isSupabaseConfigured ? (
          <div className="stack-4">
            <div>
              <h2 style={{ marginBottom: 8 }}>Organiser sign in</h2>
              <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
                Enter your email and we'll send a magic sign-in link — no
                password required.
              </p>
            </div>
            <form onSubmit={handleMagicLink} className="stack-4">
              <FieldWrap label="Email address" htmlFor="login-email">
                <input
                  id="login-email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </FieldWrap>
              {error && (
                <p style={{ color: 'var(--rm-live)', fontSize: '0.875rem', textAlign: 'left' }}>
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" block disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
            <Button variant="ghost" block to="/">
              Back to homepage
            </Button>
          </div>
        ) : (
          /* Supabase not configured — demo-only mode */
          <div className="stack-4">
            <h2 style={{ marginBottom: 8 }}>Organiser access</h2>
            <p className="text-muted" style={{ marginBottom: 'var(--space-8)' }}>
              Roundmark is in demo mode. Enter the organiser dashboard to create
              events, build teams and run a live golf day — no account needed yet.
            </p>
            <Button size="lg" block onClick={enterDemo}>
              Enter demo organiser mode
            </Button>
            <Button variant="ghost" block to="/">
              Back to homepage
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
