// App-level error boundary. A thrown render error would otherwise white-screen
// the whole app mid-round; this catches it and offers a reload. Local data
// (localStorage cache + outbox) is preserved, so nothing entered is lost.

import { Component, type ReactNode } from 'react';
import { Logo } from './ui';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[roundmark] uncaught error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-6)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-5)' }}>
            <Logo variant="stacked" height={88} />
          </div>
          <h2 style={{ marginBottom: 8 }}>Something went wrong</h2>
          <p className="text-muted" style={{ marginBottom: 'var(--space-6)' }}>
            The page hit an unexpected error. Anything you entered is saved on this
            device — reloading should pick up where you left off.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
