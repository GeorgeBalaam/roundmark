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

export interface SideCompetitions {
  nearestPinWinner?: string;
  nearestPinHole?: number;
  longestDriveWinner?: string;
  longestDriveHole?: number;
}

export interface RoundmarkEvent {
  id: string;
  name: string;
  date: string; // ISO date (yyyy-mm-dd)
  venue: string;
  type: EventType;
  format: ScoringFormat;
  /** Primary brand colour — headers and primary buttons on public pages. */
  brandColor?: string;
  /** Accent colour — highlights, score figures, live badges. */
  accentColor?: string;
  /** Page background colour for public pages. */
  bgColor?: string;
  logoUrl?: string;
  charityName?: string;
  charityUrl?: string;
  status: EventStatus;
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

export interface RoundmarkDB {
  version: number;
  events: RoundmarkEvent[];
  auditLogs: AuditEntry[];
  /** Signed-in user. role drives which dashboard + features they get. */
  session: { organiserName: string; role: UserRole } | null;
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
