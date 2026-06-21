// Roundmark data model.
// Currently persisted to localStorage via src/lib/store.ts.
// Shapes are kept flat and id-keyed so they can map 1:1 onto Supabase tables later:
// events, holes, players, teams, team_players, scores, sponsors, audit_logs.
// TODO(production): replace localStorage store with Supabase + RLS policies.

/** Roundmark account roles. Only admins can use demo events/mode. */
export type UserRole = 'admin' | 'organiser' | 'player';

export type ScoringFormat = 'stroke' | 'stableford' | 'scramble';

export type EventStatus = 'draft' | 'ready' | 'live' | 'completed';

export type EventType =
  | 'company'
  | 'internal-league'
  | 'charity'
  | 'society';

export interface Hole {
  number: number; // 1-18
  par: number;
  strokeIndex: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  company?: string;
  /** Playing handicap. null/undefined = not provided. */
  handicap?: number | null;
  dietary?: string;
  phone?: string;
  role?: 'host' | 'guest' | null;
}

export interface Team {
  id: string;
  name: string;
  playerIds: string[];
  startingHole: number; // for shotgun starts
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  slot: number; // 1-6 display order
}

/**
 * A score cell: gross strokes, 'X' for picked-up/no score, or null for not entered.
 * Arrays are indexed by hole number - 1.
 */
export type ScoreCell = number | 'X' | null;

export interface Scorecard {
  teamId: string;
  /** Per-player gross strokes (stroke play / stableford). */
  playerScores: Record<string, ScoreCell[]>;
  /** One team score per hole (Texas Scramble). */
  teamScores: ScoreCell[];
  /** Hole numbers that have been saved by the scorer. */
  submittedHoles: number[];
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  eventId: string;
  at: string; // ISO timestamp
  by: string; // display name, e.g. "Admin" or "Team scorer"
  teamId?: string;
  playerId?: string;
  hole?: number;
  action: string; // e.g. "Score corrected", "Results locked"
  oldValue?: string;
  newValue?: string;
}

export type RegistrationStatus = 'pending' | 'approved' | 'declined' | 'waitlist';

/** Optional registration fields the organiser can choose to capture. */
export type RegistrationFieldKey = 'company' | 'handicap' | 'dietary' | 'phone';

export interface RegistrationFieldConfig {
  key: RegistrationFieldKey;
  show: boolean;
  required: boolean;
}

export interface RegistrationSettings {
  /** When true, the public landing page accepts new sign-ups. */
  open: boolean;
  /** Auto-approve sign-ups (still creates players) vs. manual approval. */
  autoApprove: boolean;
  /** Optional welcome/instructions shown on the landing page. */
  note?: string;
  /** Which optional fields to show and which are required. */
  fields: RegistrationFieldConfig[];
}

export const DEFAULT_REGISTRATION_FIELDS: RegistrationFieldConfig[] = [
  { key: 'company', show: true, required: false },
  { key: 'handicap', show: true, required: false },
  { key: 'dietary', show: true, required: false },
  { key: 'phone', show: false, required: false },
];

export const REGISTRATION_FIELD_LABELS: Record<RegistrationFieldKey, string> = {
  company: 'Company',
  handicap: 'Handicap',
  dietary: 'Dietary requirements',
  phone: 'Phone number',
};

export interface Registration {
  id: string;
  eventId: string;
  status: RegistrationStatus;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
  handicap?: number | null;
  dietary?: string;
  phone?: string;
  notes?: string;
  /** Set when approved — the roster Player created from this sign-up. */
  playerId?: string;
  createdAt: string;
}

export interface SideCompetitions {
  nearestPinWinner?: string;
  nearestPinHole?: number;
  longestDriveWinner?: string;
  longestDriveHole?: number;
}

// --- Public event page (branded microsite at /e/:id) -----------------------
// Ordered content blocks the organiser composes. Public marketing content only
// (no PII), so it lives on the world-readable event row.

export interface ScheduleItem { id: string; time: string; label: string }
export interface FaqItem { id: string; q: string; a: string }

export type VideoProvider = 'youtube' | 'vimeo';

export type EventBlock =
  | { id: string; type: 'text'; title?: string; body: string }
  | { id: string; type: 'image'; url: string; caption?: string }
  | { id: string; type: 'feature'; title?: string; body: string; url?: string; imageSide: 'left' | 'right' }
  | { id: string; type: 'cta'; title?: string; body?: string; label: string; href: string }
  | { id: string; type: 'video'; provider: VideoProvider; videoId: string; title?: string }
  | { id: string; type: 'venue'; title?: string; address: string; mapUrl?: string }
  | { id: string; type: 'schedule'; title?: string; items: ScheduleItem[] }
  | { id: string; type: 'faq'; title?: string; items: FaqItem[] };

export type EventBlockType = EventBlock['type'];

/** Builder metadata for each block type: short name + one-line description. */
export const EVENT_BLOCK_META: Record<EventBlockType, { label: string; description: string }> = {
  text: { label: 'Text', description: 'A heading and a paragraph.' },
  feature: { label: 'Text + image', description: 'A paragraph beside an image.' },
  image: { label: 'Image', description: 'A full-width image with a caption.' },
  cta: { label: 'Button', description: 'A heading and a button — e.g. donate.' },
  video: { label: 'Video', description: 'Embed a YouTube or Vimeo clip.' },
  venue: { label: 'Venue & map', description: 'An address with a directions link.' },
  schedule: { label: 'Schedule', description: 'A timeline of the day.' },
  faq: { label: 'FAQs', description: 'Expandable questions and answers.' },
};

export interface RoundmarkEvent {
  id: string;
  /** Supabase auth user id of the owner (the creator / paying account). */
  ownerId?: string;
  name: string;
  date: string; // ISO date (yyyy-mm-dd)
  venue: string;
  type: EventType;
  format: ScoringFormat;
  /**
   * Whether the competition is played off handicap. 'net' applies WHS-style
   * stroke allowances; 'gross'/undefined scores raw. Ignored for scramble.
   */
  scoringMode?: 'gross' | 'net';
  /** Primary brand colour — headers and primary buttons on public pages. */
  brandColor?: string;
  /** Accent colour — highlights, score figures, live badges. */
  accentColor?: string;
  /** Page background colour for public pages. */
  bgColor?: string;
  logoUrl?: string;
  /** Optional hero background image for the public event page. */
  heroImageUrl?: string;
  /** Optional one-line strapline shown under the date/venue on the public page. */
  heroTagline?: string;
  /** Ordered content blocks for the public event microsite (/e/:id). */
  content?: EventBlock[];
  charityName?: string;
  charityUrl?: string;
  status: EventStatus;
  /** Public registration config (landing page sign-ups). */
  registration?: RegistrationSettings;
  /** When locked, scorers can no longer edit. Admin can still override. */
  locked: boolean;
  /** Admin can pause scoring without locking results. */
  scoringPaused: boolean;
  holes: Hole[];
  players: Player[];
  teams: Team[];
  sponsors: Sponsor[];
  /** Keyed by teamId. */
  scorecards: Record<string, Scorecard>;
  sideComps: SideCompetitions;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
}

/** Saved organiser profile: company details + event colour defaults. */
export interface AccountSettings {
  displayName?: string;
  companyName?: string;
  website?: string;
  defaultBrandColor?: string;
  defaultAccentColor?: string;
  defaultBgColor?: string;
  defaultLogoUrl?: string;
}

/** A signed-in user's role on a specific event (per-event, not global). */
export type EventRole = 'organiser' | 'host' | 'scorer' | 'player';

export interface EventMembership {
  eventId: string;
  role: EventRole;
  /** The roster player this user is, if linked. */
  playerId?: string;
}

export interface RoundmarkDB {
  version: number;
  events: RoundmarkEvent[];
  auditLogs: AuditEntry[];
  /** Event sign-ups (separate from players — see RegistrationStatus). */
  registrations: Registration[];
  /** The signed-in user's per-event memberships (drives the /me dashboard). */
  memberships?: EventMembership[];
  /** Event ids the signed-in user holds a go-live pass for (entitlements). */
  eventPasses?: string[];
  /**
   * Signed-in user. role drives which dashboard + features they get; plan is the
   * entitlements bundle id (undefined = the default 'full' plan for now).
   */
  session: { organiserName: string; role: UserRole; plan?: string } | null;
  /** Organiser account/company preferences — pre-fills new events. */
  accountSettings?: AccountSettings;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  company: 'Company golf day',
  'internal-league': 'Internal league',
  charity: 'Charity day',
  society: 'Society day',
};

export const FORMAT_LABELS: Record<ScoringFormat, string> = {
  stroke: 'Stroke Play',
  stableford: 'Stableford',
  scramble: 'Texas Scramble',
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  live: 'Live',
  completed: 'Completed',
};
