// Public marketing homepage.

import { useNavigate } from 'react-router-dom';
import { MarketingHeader } from '../components/shells';
import { Badge, Button, Card, Logo } from '../components/ui';
import { signInDemo, useDB } from '../lib/store';
import { isSupabaseConfigured } from '../lib/supabase';

const BENEFITS = [
  {
    icon: '📋',
    title: 'Set up the day',
    body: 'Create the event, load the course, add players and build balanced teams in minutes — no spreadsheets.',
  },
  {
    icon: '📱',
    title: 'Share QR scorecards',
    body: 'Every team gets a QR code. Players scan and score on their phones. No app downloads, no accounts.',
  },
  {
    icon: '📊',
    title: 'Track the leaderboard',
    body: 'Scores flow straight to a live leaderboard you can share with players or put on the clubhouse TV.',
  },
  {
    icon: '🔒',
    title: 'Lock and share results',
    body: 'Review scores, fix mistakes, lock the final result and share or export it — done before the first drink.',
  },
];

const USE_CASES = [
  {
    title: 'Company golf days',
    body: 'Impress clients and colleagues with a polished, professional event without hiring an event manager.',
  },
  {
    title: 'Internal teams',
    body: 'Quarterly team days and office leagues with zero admin overhead and a bit of friendly rivalry.',
  },
  {
    title: 'Societies',
    body: 'Run your regular society meets with saved courses, repeat events and a proper results history.',
  },
  {
    title: 'Charity & sponsor days',
    body: 'Give sponsors visible slots on scorecards, leaderboards and the big screen — and name the cause.',
  },
];

const PRICING = [
  {
    name: 'Event Pass',
    price: '£299',
    cadence: 'one-off',
    blurb: 'One golf day, fully featured.',
    features: ['1 event', 'Unlimited players & teams', 'QR scorecards', 'Live leaderboard & TV mode', 'Results export'],
    highlighted: false,
  },
  {
    name: 'Groups',
    price: '£349',
    cadence: 'per year',
    blurb: 'For societies and repeat organisers.',
    features: ['Unlimited events', 'Event history & duplication', 'Sponsor slots', 'Live leaderboard & TV mode', 'Results export'],
    highlighted: true,
  },
  {
    name: 'Business',
    price: '£999',
    cadence: 'per year',
    blurb: 'For companies running multiple days.',
    features: ['Everything in Groups', 'Multiple organisers', 'Company branding', 'Priority support', 'Audit trail'],
    highlighted: false,
  },
];

function MiniLeaderboard() {
  const rows = [
    { rank: 1, team: 'Birdie Brigade', thru: 12, pts: 58 },
    { rank: 2, team: 'The Fairway Four', thru: 12, pts: 55 },
    { rank: 3, team: 'Sand Savers', thru: 11, pts: 51 },
    { rank: 4, team: 'Green Machine', thru: 11, pts: 48 },
  ];
  return (
    <Card style={{ flex: '1 1 300px', maxWidth: 420 }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-4)' }}>
        <strong style={{ fontFamily: 'var(--font-heading)' }}>Live leaderboard</strong>
        <Badge tone="orange" pulse>
          Live
        </Badge>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Pos</th>
            <th>Team</th>
            <th className="num">Thru</th>
            <th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank}>
              <td>
                <span className="leaderboard-row-rank" style={{ fontSize: '1.1rem' }}>
                  {r.rank}
                </span>
              </td>
              <td style={{ fontWeight: 600 }}>{r.team}</td>
              <td className="num">{r.thru}</td>
              <td className="num">
                <span className="leaderboard-score" style={{ fontSize: '1rem' }}>{r.pts}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MiniScorecard() {
  return (
    <Card style={{ flex: '0 1 260px', textAlign: 'center' }}>
      <div className="text-small text-muted" style={{ marginBottom: 4 }}>
        The Fairway Four
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '2.2rem', color: 'var(--rm-green-deep)' }}>
        Hole 7
      </div>
      <div className="text-small text-muted" style={{ marginBottom: 'var(--space-4)' }}>
        Par 3 · Stroke index 15
      </div>
      <div className="stack-2" style={{ textAlign: 'left' }}>
        {[
          ['James C.', 3],
          ['Sarah W.', 4],
          ['Tom O.', 3],
        ].map(([name, score]) => (
          <div key={name as string} className="row-between" style={{ padding: '8px 12px', background: 'var(--rm-card-soft)', borderRadius: 10 }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{name}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{score}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'var(--space-4)' }}>
        <Badge tone="green">✓ Scores saved</Badge>
      </div>
    </Card>
  );
}

export default function MarketingPage() {
  const navigate = useNavigate();
  const db = useDB();

  // With a real backend, demo events are an admin-only tool — send visitors to
  // sign in (admins get the demo in their dashboard). In local/unconfigured
  // mode there's no auth, so the one-click demo bypass stays for convenience.
  const ctaLabel = isSupabaseConfigured ? 'Get started' : 'Create demo event';

  function handleCta() {
    if (db.session) {
      navigate('/app');
    } else if (isSupabaseConfigured) {
      navigate('/login');
    } else {
      signInDemo();
      navigate('/app');
    }
  }

  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero */}
        <section className="container" style={{ paddingTop: 'var(--space-16)', paddingBottom: 'var(--space-16)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
            <Badge tone="green">⛳ Self-serve golf day software</Badge>
            <h1 style={{ marginTop: 'var(--space-5)' }}>
              Run a better golf day without spreadsheets or app downloads.
            </h1>
            <p style={{ fontSize: '1.15rem', color: 'var(--rm-muted)', maxWidth: 600, margin: '0 auto var(--space-8)' }}>
              Create the event, add players, share QR scorecards, follow the live
              leaderboard and save the final results.
            </p>
            <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button size="lg" onClick={handleCta}>
                {ctaLabel}
              </Button>
              <Button size="lg" variant="secondary" to="/leaderboard/demo-live">
                View sample leaderboard
              </Button>
            </div>
          </div>
          {/* Product visual */}
          <div
            className="row"
            style={{
              justifyContent: 'center',
              alignItems: 'stretch',
              flexWrap: 'wrap',
              gap: 'var(--space-6)',
              marginTop: 'var(--space-16)',
            }}
          >
            <MiniLeaderboard />
            <MiniScorecard />
          </div>
        </section>

        {/* Benefits */}
        <section style={{ background: 'var(--rm-card)', borderTop: '1px solid var(--rm-border-soft)', borderBottom: '1px solid var(--rm-border-soft)' }}>
          <div className="container" style={{ paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)' }}>
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--space-12)' }}>
              <h2>Everything the organiser needs. Nothing the players have to install.</h2>
            </div>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {BENEFITS.map((b) => (
                <Card key={b.title} soft hover>
                  <div style={{ fontSize: '1.8rem', marginBottom: 'var(--space-3)' }} aria-hidden="true">
                    {b.icon}
                  </div>
                  <h3>{b.title}</h3>
                  <p className="text-muted" style={{ margin: 0 }}>
                    {b.body}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="container" style={{ paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)' }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--space-12)' }}>
            <h2>Built for the days that matter</h2>
            <p className="text-muted">
              From client-facing company days to the monthly society meet.
            </p>
          </div>
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {USE_CASES.map((u) => (
              <Card key={u.title} hover>
                <h3>{u.title}</h3>
                <p className="text-muted" style={{ margin: 0 }}>
                  {u.body}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section style={{ background: 'var(--rm-green-deeper)' }}>
          <div className="container" style={{ paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)' }}>
            <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto var(--space-12)' }}>
              <h2 style={{ color: '#fff' }}>Simple pricing. No monthly billing.</h2>
              <p style={{ color: '#b9cbae' }}>Pay for the day, or the year. That's it.</p>
            </div>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', maxWidth: 980, margin: '0 auto' }}>
              {PRICING.map((p) => (
                <Card
                  key={p.name}
                  padLg
                  style={
                    p.highlighted
                      ? { border: '2px solid var(--rm-green-fairway)', position: 'relative' }
                      : undefined
                  }
                >
                  {p.highlighted && (
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)' }}>
                      <Badge tone="green">Most popular</Badge>
                    </div>
                  )}
                  <h3>{p.name}</h3>
                  <div style={{ margin: 'var(--space-3) 0' }}>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: '2.4rem', fontWeight: 700 }}>{p.price}</span>{' '}
                    <span className="text-muted">{p.cadence}</span>
                  </div>
                  <p className="text-muted">{p.blurb}</p>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-6)' }} className="stack-2">
                    {p.features.map((f) => (
                      <li key={f} style={{ display: 'flex', gap: 8, fontSize: '0.92rem' }}>
                        <span style={{ color: 'var(--rm-green-fresh)' }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Button block variant={p.highlighted ? 'primary' : 'secondary'} onClick={handleCta}>
                    {isSupabaseConfigured ? 'Get started' : 'Start with a demo'}
                  </Button>
                  {/* TODO(production): wire to Stripe checkout */}
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="container" style={{ paddingTop: 'var(--space-24)', paddingBottom: 'var(--space-24)', textAlign: 'center' }}>
          <h2>See it working in two minutes</h2>
          <p className="text-muted" style={{ maxWidth: 480, margin: '0 auto var(--space-8)' }}>
            The demo includes a live golf day mid-round — open the leaderboard,
            scan a scorecard, enter a score and watch it move.
          </p>
          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button size="lg" onClick={handleCta}>
              {ctaLabel}
            </Button>
            <Button size="lg" variant="ghost" to="/tv/demo-live">
              See TV mode
            </Button>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--rm-border-soft)', padding: 'var(--space-8) 0' }}>
        <div className="container row-between">
          <Logo variant="horizontal" height={24} />
          <span className="text-small text-muted">© {new Date().getFullYear()} Roundmark. The easiest way to run a company golf day.</span>
        </div>
      </footer>
    </>
  );
}
