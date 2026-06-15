// Team scoring link helpers.

export function teamScoringPath(eventId: string, teamId: string): string {
  return `/score/${eventId}/${teamId}`;
}

export function teamScoringUrl(eventId: string, teamId: string): string {
  return `${window.location.origin}${teamScoringPath(eventId, teamId)}`;
}

/** Public event landing / registration page. */
export function eventLandingPath(eventId: string): string {
  return `/e/${eventId}`;
}

export function eventLandingUrl(eventId: string): string {
  return `${window.location.origin}${eventLandingPath(eventId)}`;
}
