// Layout shells: marketing header and the organiser dashboard shell.

import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { signOut, useDB } from '../lib/store';
import { Button, Logo } from './ui';

export function MarketingHeader() {
  const db = useDB();
  return (
    <header className="marketing-header">
      <div className="container marketing-header-inner">
        <Link to="/" aria-label="Roundmark home">
          <Logo variant="horizontal" height={32} />
        </Link>
        <nav className="row">
          <Button variant="ghost" size="sm" to="/leaderboard/demo-live">
            Sample leaderboard
          </Button>
          {db.session ? (
            <Button size="sm" to="/app">
              Open dashboard
            </Button>
          ) : (
            <Button size="sm" to="/login">
              Organiser sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

const NAV_ITEMS = [
  { to: '/app', label: 'Events', icon: '⛳', end: true },
  { to: '/app/history', label: 'History', icon: '🏆', end: false },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const db = useDB();

  function handleSignOut() {
    signOut();
    navigate('/');
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link to="/app" aria-label="Roundmark dashboard">
          <Logo variant="horizontal-white" height={30} />
        </Link>
        <nav aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span aria-hidden="true">{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }} className="stack-2">
          <div className="text-small" style={{ color: '#9fb894' }}>
            {db.session?.organiserName ?? 'Demo Organiser'}
          </div>
          <button className="sidebar-link" onClick={handleSignOut} style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer' }}>
            <span aria-hidden="true">↩</span> Sign out
          </button>
        </div>
      </aside>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="app-topbar">
          <Link to="/app" className="topbar-logo" aria-label="Roundmark dashboard">
            <Logo variant="horizontal" height={26} />
          </Link>
          <div className="row">
            <Button variant="ghost" size="sm" to="/app/history">
              History
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
