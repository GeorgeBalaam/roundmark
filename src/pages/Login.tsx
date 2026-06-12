// Demo organiser access. Deliberately lightweight: the priority is getting
// into the dashboard to test flows. TODO(production): real auth (Supabase Auth).

import type { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { signInDemo, useSession } from '../lib/store';
import { Button, Card, Logo } from '../components/ui';

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const session = useSession();

  if (session) return <Navigate to="/app" replace />;

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
        <h2 style={{ marginBottom: 8 }}>Organiser access</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-8)' }}>
          Roundmark is in demo mode. Enter the organiser dashboard to create
          events, build teams and run a live golf day — no account needed yet.
        </p>
        <div className="stack-4">
          <Button size="lg" block onClick={enterDemo}>
            Enter demo organiser mode
          </Button>
          <Button variant="ghost" block to="/">
            Back to homepage
          </Button>
        </div>
      </Card>
    </div>
  );
}
