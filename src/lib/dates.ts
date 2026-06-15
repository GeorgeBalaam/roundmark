// Small date helpers for event timing (countdown, future-event checks).

/** ms until the start of the given ISO date (yyyy-mm-dd), local time. */
export function msUntil(dateIso: string): number {
  if (!dateIso) return 0;
  return new Date(`${dateIso}T00:00:00`).getTime() - Date.now();
}

export function isFutureEvent(dateIso: string): boolean {
  return msUntil(dateIso) > 0;
}
