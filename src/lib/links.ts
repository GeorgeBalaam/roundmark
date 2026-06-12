// Team scoring link helpers.

export function teamScoringPath(eventId: string, teamId: string): string {
  return `/score/${eventId}/${teamId}`;
}

export function teamScoringUrl(eventId: string, teamId: string): string {
  return `${window.location.origin}${teamScoringPath(eventId, teamId)}`;
}
