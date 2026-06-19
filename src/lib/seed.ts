// Demo seed data: one live event mid-round and one completed, locked event.
// Deterministic (seeded RNG) so the demo looks the same on every reset.

import type {
  Hole,
  Player,
  Registration,
  RoundmarkDB,
  RoundmarkEvent,
  Scorecard,
  Team,
} from './types';
import { DEFAULT_REGISTRATION_FIELDS } from './types';

/** Standard par-72: front 36 / back 36. */
export const PAR_72_TEMPLATE: Hole[] = [
  { number: 1, par: 4, strokeIndex: 5 },
  { number: 2, par: 4, strokeIndex: 11 },
  { number: 3, par: 3, strokeIndex: 17 },
  { number: 4, par: 5, strokeIndex: 1 },
  { number: 5, par: 4, strokeIndex: 7 },
  { number: 6, par: 4, strokeIndex: 13 },
  { number: 7, par: 3, strokeIndex: 15 },
  { number: 8, par: 4, strokeIndex: 3 },
  { number: 9, par: 5, strokeIndex: 9 },
  { number: 10, par: 4, strokeIndex: 6 },
  { number: 11, par: 3, strokeIndex: 18 },
  { number: 12, par: 4, strokeIndex: 12 },
  { number: 13, par: 5, strokeIndex: 2 },
  { number: 14, par: 4, strokeIndex: 8 },
  { number: 15, par: 4, strokeIndex: 14 },
  { number: 16, par: 3, strokeIndex: 16 },
  { number: 17, par: 5, strokeIndex: 4 },
  { number: 18, par: 4, strokeIndex: 10 },
];

// Small deterministic RNG (mulberry32) so seed data is stable.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'James', 'Sarah', 'Tom', 'Priya', 'Marcus', 'Ellie', 'Dan', 'Hannah',
  'Olly', 'Rachel', 'Ben', 'Katie', 'Will', 'Amara', 'Chris', 'Lucy',
  'Sam', 'Nadia', 'Jack', 'Fiona', 'Ryan', 'Megan', 'Dev', 'Charlotte',
];
const LAST_NAMES = [
  'Carter', 'Whitfield', 'Okafor', 'Sharma', 'Boyle', 'Hastings', 'Mercer', 'Quinn',
  'Pemberton', 'Doyle', 'Ashworth', 'Lindqvist', 'Farrell', 'Nielsen', 'Hodge', 'Brennan',
  'Kowalski', 'Trent', 'Maguire', 'Selby', 'Ito', 'Vance', 'Patel', 'Ross',
];
const COMPANIES = ['Northbeam Ltd', 'Atlas Partners', 'Hewitt & Co', 'Brightline', 'Ferncroft Group', 'Osprey Digital'];

function buildPlayers(prefix: string, count: number, rand: () => number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-p${i + 1}`,
    firstName: FIRST_NAMES[i % FIRST_NAMES.length],
    lastName: LAST_NAMES[i % LAST_NAMES.length],
    email: i % 3 === 0 ? `${FIRST_NAMES[i % 24].toLowerCase()}.${LAST_NAMES[i % 24].toLowerCase()}@example.com` : undefined,
    company: COMPANIES[i % COMPANIES.length],
    handicap: Math.round(rand() * 26 + 2),
    role: i % 4 === 0 ? 'host' : 'guest',
  }));
}

const TEAM_NAMES = ['The Fairway Four', 'Birdie Brigade', 'Rough Riders', 'Sand Savers', 'The Mulligans', 'Green Machine'];

function buildTeams(prefix: string, players: Player[]): Team[] {
  const teams: Team[] = [];
  for (let t = 0; t < 6; t++) {
    teams.push({
      id: `${prefix}-t${t + 1}`,
      name: TEAM_NAMES[t],
      playerIds: players.slice(t * 4, t * 4 + 4).map((p) => p.id),
      startingHole: t * 3 + 1, // shotgun start: 1, 4, 7, 10, 13, 16
    });
  }
  return teams;
}

/** Realistic-ish gross score for a hole given handicap. */
function grossScore(par: number, handicap: number, rand: () => number): number {
  const skill = handicap / 18; // ~0.1 (good) to ~1.5 (social golfer)
  const r = rand();
  let diff: number;
  if (r < 0.08) diff = -1;
  else if (r < 0.35 - skill * 0.1) diff = 0;
  else if (r < 0.75) diff = 1;
  else if (r < 0.93) diff = 2;
  else diff = 3;
  return Math.max(1, par + diff);
}

function buildScorecard(
  team: Team,
  players: Player[],
  holes: Hole[],
  thru: number,
  format: 'stableford' | 'scramble',
  rand: () => number,
): Scorecard {
  const playerScores: Scorecard['playerScores'] = {};
  const teamScores: Scorecard['teamScores'] = holes.map(() => null);
  const submitted: number[] = [];

  // Holes are played in order from the team's starting hole (shotgun).
  const order = holes.map((_, i) => ((team.startingHole - 1 + i) % holes.length));
  for (let k = 0; k < thru; k++) {
    const i = order[k];
    submitted.push(i + 1);
    if (format === 'scramble') {
      teamScores[i] = grossScore(holes[i].par, 8, rand);
    }
  }

  if (format !== 'scramble') {
    for (const pid of team.playerIds) {
      const player = players.find((p) => p.id === pid)!;
      const cells: Scorecard['teamScores'] = holes.map(() => null);
      for (let k = 0; k < thru; k++) {
        const i = order[k];
        cells[i] = grossScore(holes[i].par, player.handicap ?? 18, rand);
      }
      playerScores[pid] = cells;
    }
  } else {
    for (const pid of team.playerIds) {
      playerScores[pid] = holes.map(() => null);
    }
  }

  return {
    teamId: team.id,
    playerScores,
    teamScores,
    submittedHoles: submitted,
    updatedAt: new Date().toISOString(),
  };
}

export function buildSeedDB(): RoundmarkDB {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const lastMonth = new Date(now.getTime() - 32 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  // --- Live demo event ---
  const randLive = rng(42);
  const livePlayers = buildPlayers('live', 24, randLive);
  const liveTeams = buildTeams('live', livePlayers);
  const liveThru = [12, 11, 11, 10, 12, 9]; // mid-round
  const liveScorecards: Record<string, Scorecard> = {};
  liveTeams.forEach((team, i) => {
    liveScorecards[team.id] = buildScorecard(team, livePlayers, PAR_72_TEMPLATE, liveThru[i], 'stableford', randLive);
  });

  const liveEvent: RoundmarkEvent = {
    id: 'demo-live',
    name: 'Roundmark Demo Golf Day',
    date: today,
    venue: 'Demo Fairway Golf Club',
    type: 'company',
    format: 'stableford',
    brandColor: '#27542A',
    accentColor: '#8DB259',
    bgColor: '#F7F3EA',
    registration: {
      open: true,
      autoApprove: false,
      note: 'Join us for our annual company golf day at Demo Fairway. Register below and we’ll confirm your place.',
      fields: DEFAULT_REGISTRATION_FIELDS.map((f) => ({ ...f })),
    },
    status: 'live',
    locked: false,
    scoringPaused: false,
    holes: PAR_72_TEMPLATE.map((h) => ({ ...h })),
    players: livePlayers,
    teams: liveTeams,
    sponsors: [
      { id: 'live-s1', name: 'Northbeam Ltd', websiteUrl: 'https://example.com', slot: 1 },
      { id: 'live-s2', name: 'Atlas Partners', websiteUrl: 'https://example.com', slot: 2 },
      { id: 'live-s3', name: 'Brightline', websiteUrl: 'https://example.com', slot: 3 },
    ],
    scorecards: liveScorecards,
    sideComps: { nearestPinHole: 7, longestDriveHole: 13 },
    content: [
      {
        id: 'demo-b1',
        type: 'text',
        title: 'Welcome to the day',
        body: 'A relaxed 18 holes at Demo Fairway followed by lunch and prizes. Teams of four, Stableford scoring — every hole counts and a bad one never ruins your round. New to golf days? You\'ll be paired with experienced players.',
      },
      {
        id: 'demo-bv',
        type: 'venue',
        title: 'Getting there',
        address: 'Demo Fairway Golf Club\nFairway Lane, Demoshire DM1 2GC',
      },
      {
        id: 'demo-bc',
        type: 'cta',
        title: 'Save the date',
        body: 'Pop the day in your calendar so you don\'t miss your tee time.',
        label: 'Add to calendar',
        href: 'https://example.com',
      },
      {
        id: 'demo-b2',
        type: 'schedule',
        title: 'Running order',
        items: [
          { id: 'demo-s1', time: '08:30', label: 'Registration, coffee & bacon rolls' },
          { id: 'demo-s2', time: '09:30', label: 'Shotgun start' },
          { id: 'demo-s3', time: '14:00', label: 'Lunch in the clubhouse' },
          { id: 'demo-s4', time: '15:00', label: 'Prizes & nearest-the-pin winners' },
        ],
      },
      {
        id: 'demo-b3',
        type: 'faq',
        title: 'Good to know',
        items: [
          { id: 'demo-f1', q: 'What should I bring?', a: 'Clubs, soft spikes and weather-appropriate layers. Buggies can be reserved at the pro shop.' },
          { id: 'demo-f2', q: 'I don\'t have a handicap — can I still play?', a: 'Absolutely. Pop in your best guess when you register and we\'ll sort teams to keep it fair and fun.' },
          { id: 'demo-f3', q: 'Is there a dress code?', a: 'Standard golf club attire — collared shirt and tailored shorts or trousers.' },
        ],
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // --- Completed, locked event ---
  const randDone = rng(7);
  const donePlayers = buildPlayers('done', 24, randDone);
  const doneTeams = buildTeams('done', donePlayers);
  const doneScorecards: Record<string, Scorecard> = {};
  doneTeams.forEach((team) => {
    doneScorecards[team.id] = buildScorecard(team, donePlayers, PAR_72_TEMPLATE, 18, 'scramble', randDone);
  });

  const doneEvent: RoundmarkEvent = {
    id: 'demo-completed',
    name: 'Ferncroft Spring Scramble',
    date: lastMonth,
    venue: 'Demo Fairway Golf Club',
    type: 'charity',
    format: 'scramble',
    brandColor: '#27542A',
    charityName: 'Greenside Trust',
    charityUrl: 'https://example.com',
    status: 'completed',
    locked: true,
    scoringPaused: false,
    holes: PAR_72_TEMPLATE.map((h) => ({ ...h })),
    players: donePlayers,
    teams: doneTeams,
    sponsors: [
      { id: 'done-s1', name: 'Ferncroft Group', websiteUrl: 'https://example.com', slot: 1 },
      { id: 'done-s2', name: 'Osprey Digital', websiteUrl: 'https://example.com', slot: 2 },
      { id: 'done-s3', name: 'Hewitt & Co', websiteUrl: 'https://example.com', slot: 3 },
    ],
    scorecards: doneScorecards,
    sideComps: {
      nearestPinWinner: 'Priya Sharma',
      nearestPinHole: 7,
      longestDriveWinner: 'Marcus Boyle',
      longestDriveHole: 13,
    },
    createdAt: lastMonth,
    updatedAt: lastMonth,
    lockedAt: lastMonth,
  };

  const demoRegistrations: Registration[] = [
    {
      id: 'reg-1', eventId: 'demo-live', status: 'pending',
      firstName: 'Olivia', lastName: 'Hartley', email: 'olivia.hartley@example.com',
      company: 'Brightline', handicap: 14, dietary: 'Vegetarian',
      createdAt: new Date(now.getTime() - 3600_000).toISOString(),
    },
    {
      id: 'reg-2', eventId: 'demo-live', status: 'pending',
      firstName: 'Daniel', lastName: 'Okafor', email: 'daniel.okafor@example.com',
      company: 'Atlas Partners', handicap: 8,
      createdAt: new Date(now.getTime() - 7200_000).toISOString(),
    },
    {
      id: 'reg-3', eventId: 'demo-live', status: 'pending',
      firstName: 'Sophie', lastName: 'Renwick', email: 'sophie.renwick@example.com',
      company: 'Northbeam Ltd', handicap: 22, dietary: 'Gluten-free',
      createdAt: new Date(now.getTime() - 10800_000).toISOString(),
    },
  ];

  return {
    version: 1,
    events: [liveEvent, doneEvent],
    auditLogs: [
      {
        id: 'seed-audit-1',
        eventId: 'demo-completed',
        at: new Date(lastMonth).toISOString(),
        by: 'Demo Organiser',
        action: 'Results locked',
      },
    ],
    registrations: demoRegistrations,
    session: null,
  };
}
