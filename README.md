# Roundmark

**The easiest way to run a company golf day.**

Self-serve golf day web app for companies, teams and societies: create the
event, add players, build teams, share QR scorecards, follow the live
leaderboard, lock the final results and keep the history.

This is the first working MVP — a fully client-side React app with a clean,
typed data layer designed to swap to Supabase later.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

## Demo flow (2 minutes)

The app seeds itself with demo data on first load:

1. Open `/` — marketing page → **Create demo event** (enters demo organiser mode).
2. Dashboard shows a **live** event mid-round and a **completed, locked** one.
3. Open **Roundmark Demo Golf Day** → walk the setup wizard (info → course →
   players → teams → sponsors → QR links → review).
4. On the **QR links** step, open a team scorecard (or scan the QR with your
   phone if you expose the dev server on your network).
5. Enter scores on the mobile scorecard → **Save hole** → watch
   `/leaderboard/demo-live` move.
6. Open the **Support console** → correct a score (audit-logged) → **Lock results**.
7. View `/results/demo-live`, export the CSV or print.
8. **Duplicate** the completed event from the dashboard.
9. Put `/tv/demo-live` on a big screen.

“Reset demo data” at the bottom of the dashboard restores the seed.

## Routes

| Route | Screen | Audience |
| --- | --- | --- |
| `/` | Marketing homepage | Public |
| `/login` | Demo organiser access | Organiser |
| `/app` | Dashboard (events, stats) | Organiser |
| `/app/history` | Completed events & winners | Organiser |
| `/app/event/:eventId` | Setup wizard (`?step=info…review`) | Organiser |
| `/app/event/:eventId/console` | Support console: corrections, audit log, lock/unlock, export | Organiser/Admin |
| `/score/:eventId/:teamId` | Mobile scorecard (no login) | Player/scorer |
| `/leaderboard/:eventId` | Live public leaderboard | Everyone |
| `/tv/:eventId` | Fullscreen TV mode | Clubhouse screen |
| `/results/:eventId` | Shareable/printable final results | Everyone |
| `/print/:eventId/qr` | Printable QR sheet | Organiser |

## Scoring formats

- **Stroke Play** — gross strokes per player; team = sum of player totals.
- **Stableford** — gross strokes per player → points (par 2, birdie 3, eagle 4,
  bogey 1, double+ 0). *TODO: handicap-adjusted points using stroke index.*
- **Texas Scramble** — one team score per hole vs par.
- Ties resolved by standard countback (last 9 / 6 / 3 / 1) and flagged “Tied”.
- “X” records a no-score/pickup (counts as double-par in stroke totals).
- Nearest the pin & longest drive recorded manually in the console.

## Architecture

```
src/
  lib/        types, store (localStorage + subscriptions), scoring engine,
              seed data, CSV import/export, event operations
  components/ ui.tsx primitives, shells, leaderboard tables, QR cards
  pages/      one file per screen; pages/setup/ holds the wizard steps
  styles/     theme.css — all design tokens and component classes
```

- **Persistence:** everything lives in `localStorage` (`roundmark-db-v1`)
  behind `src/lib/store.ts`. Cross-tab updates propagate via `storage` events,
  which is what makes the leaderboard “live” against the scorer tab.
- **Design system:** see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## What is mocked / MVP shortcuts

- **Auth** — single demo organiser session flag; no real accounts.
- **Database** — localStorage instead of Supabase; data is per-browser, so a
  phone scanning the QR code gets its own copy of the data. The store API is
  shaped for a straight swap to Supabase tables + realtime.
- **Payments** — pricing cards only; no Stripe.
- **Logo/sponsor images** — URL fields, no upload pipeline.
- **Stableford handicaps** — gross points model, TODO noted in code.

## Production hardening next

1. Supabase: schema (events, holes, players, teams, scores, sponsors,
   audit_logs), RLS, realtime leaderboard, magic-link auth for organisers.
2. Signed/unguessable team scoring tokens instead of plain ids.
3. Handicap-adjusted Stableford and configurable team scoring models.
4. Stripe checkout for Event Pass / Groups / Business.
5. Image upload for event and sponsor logos.
6. Offline-tolerant score submission queue (event-day signal is bad).
7. E2E tests for the score → leaderboard → lock flow.
