# Roundmark design system

One consistent system across marketing, organiser dashboard, mobile scoring,
leaderboards and TV mode. Everything lives in
[`src/styles/theme.css`](src/styles/theme.css) (tokens + component classes) and
[`src/components/ui.tsx`](src/components/ui.tsx) (React primitives).

## Brand

The palette is derived from the official logo SVGs in `public/brand/`:

| Token | Value | Use |
| --- | --- | --- |
| `--rm-green-deep` | `#27542A` | Primary actions, headers, rank numbers |
| `--rm-green-deeper` | `#1C3E1F` | Sidebar, TV mode background, hovers |
| `--rm-green-fairway` | `#8DB259` | Accents, highlights, TV rank colour |
| `--rm-green-fresh` | `#3FA66B` | Focus rings, positive accents |
| `--rm-cream` | `#F7F3EA` | App background |
| `--rm-card` / `--rm-card-soft` | `#FFFFFF` / `#FCFAF5` | Cards and panels |
| `--rm-ink` / `--rm-ink-2` | `#17211B` / `#242C33` | Text |
| `--rm-muted` | `#667085` | Secondary text |
| `--rm-border` / `--rm-border-soft` | `#DADFD6` / `#E7EADF` | Borders |
| `--rm-live` | `#D98A35` | Live/provisional states |
| `--rm-success` / `--rm-error` | `#2E8B57` / `#C2410C` | Feedback |

No bright neon greens. No hard-coded hex values in components — always use the
CSS variables.

### Logo usage

- `Logo variant="horizontal"` — marketing header, app top bar, results.
- `Logo variant="horizontal-white"` — sidebar, leaderboard header, TV mode.
- `Logo variant="icon"` — favicon, compact scorer header.
- `Logo variant="stacked"` — login card, error pages.
Never recolour or redraw the logo.

## Typography

- Headings / nav / buttons: **Instrument Sans** (`--font-heading`).
- Body / tables / forms: **Inter** (`--font-body`).
- Loaded from Google Fonts in `index.html`; system sans fallbacks are defined
  in the variables so the fonts can be swapped or self-hosted later.
- Scale: H1 3rem desktop / 2.25rem mobile (700), H2 2rem/1.75rem (700),
  H3 1.35rem (600), body 1rem, small 0.875rem, buttons 0.95rem (600).

## Shape, spacing, elevation

- Radii: `--radius-sm` 8px (inputs), `--radius-card` 16px, `--radius-lg` 24px
  (feature panels), `--radius-pill` 999px (buttons, badges).
- Page padding 24px mobile / 48px desktop (`--page-pad`); marketing sections use
  `--space-24` (96px) vertical rhythm.
- Shadows are subtle only: `--shadow-sm`, `--shadow-card`, `--shadow-lift`.

## Components (`src/components/`)

| Component | Class / file | Notes |
| --- | --- | --- |
| `Button` | `.btn .btn-primary/-secondary/-ghost/-danger`, sizes `sm/lg`, `to=` renders a router link | min 44px tap target |
| `Card` / `.panel` | `.card`, `hover`, `soft`, `padLg` | default container for everything |
| `Badge` | `.badge .badge-*` | tones: grey, blue, green, dark-green, amber, orange, red, neutral-dark |
| `EventStatusBadge` | — | Draft grey · Ready blue · Live orange + pulse · Completed dark green · Locked neutral-dark |
| `ProvisionalBadge` | — | amber pulse until locked, dark green when final |
| `StatCard` | `.stat-card` | dashboard/console stats |
| `FormField` / `SelectField` / `TextAreaField` | `.field .input .select .textarea` | label + hint + error built in |
| `DataTable` | `.table-panel .data-table` | always wrapped in a polished panel |
| `EmptyState` | `.empty-state` | icon + title + body + action |
| `ProgressStepper` | `.stepper` | wizard navigation with done ticks |
| `Toast` via `useToast()` | `.toast` | from `toast-context.ts`, wrapped by `ToastProvider` |
| `ConfirmDialog` | `.modal` | all destructive/irreversible actions confirm first |
| `SponsorStrip` | `.sponsor-strip` | light + `dark` variants |
| `LeaderboardTable` / `IndividualStandingsTable` | `leaderboard.tsx` | shared by leaderboard, TV, results |
| `QRLinkCard` | `qr.tsx` | QR + copy link + print mode |
| Score entry | `.score-stepper`, `.score-player-row`, `.score-bottom-bar` | 52px buttons, sticky save bar |
| Shells | `shells.tsx` | `MarketingHeader`, `DashboardShell` (sidebar ≥900px, top bar below) |

### Example usage

```tsx
<Card hover>
  <EventStatusBadge status="live" />
  <h3>Spring Scramble</h3>
  <Button to={`/leaderboard/${event.id}`} variant="secondary" size="sm">
    Leaderboard
  </Button>
</Card>

const toast = useToast();
toast('Hole 7 saved ✓', 'success');
```

## Rules

1. Compose screens from these primitives; don't invent one-off variants.
2. Never rely on colour alone — statuses always pair colour with a label.
3. Players never see admin navigation or technical language.
4. One obvious primary action per screen.
5. Mobile scoring: no horizontal overflow, large tap targets, sticky save bar.
6. `no-print` class hides controls on printable pages (QR sheet, results).

## TODO (future polish)

- Self-host fonts; add `font-display: optional` tuning.
- Real logo upload (currently URL field).
- Dark mode tokens (TV mode is the only dark surface today).
- Motion polish: leaderboard position-change animations.
- Component visual regression tests.
