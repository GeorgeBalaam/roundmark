// Notification seam (provider-agnostic).
// Notification *intent* is captured in the `notifications` outbox table (see
// migration 0008): registration emails are enqueued automatically by a DB
// trigger; owner-initiated ones go through queueNotification() below. Rows are
// delivered by the Resend drainer edge function (supabase/functions/
// send-notifications), which reads pending rows, sends, and marks them
// sent/failed. This file stays the single source of truth for which templates
// exist and what data they carry — the drainer's templates.ts mirrors it.

import { supabase, isSupabaseConfigured } from './supabase';

export type NotificationTemplate =
  | 'registration_received'
  | 'registration_approved'
  | 'registration_declined'
  | 'event_reminder'
  | 'results_published';

/** The catalog the future Resend drainer renders from. */
export const NOTIFICATION_TEMPLATES: Record<NotificationTemplate, { description: string }> = {
  registration_received: { description: 'Player signed up — confirms we received their registration.' },
  registration_approved: { description: "Organiser approved a sign-up — you're in, with the details." },
  registration_declined: { description: 'A sign-up was declined or waitlisted.' },
  event_reminder: { description: 'Day-of reminder with tee time / starting hole and scoring link.' },
  results_published: { description: 'Results locked — final standings and a link.' },
};

export interface NotifyInput {
  template: NotificationTemplate;
  /** Recipient email address. */
  to: string;
  eventId?: string;
  data?: Record<string, unknown>;
}

/**
 * Queue an owner-initiated transactional notification (e.g. "results are in").
 * Registration emails are enqueued server-side by a trigger, so this is for the
 * rest. Rows sit `pending` until the Resend drainer is wired; in dev/unconfigured
 * mode this is a no-op that logs.
 */
export async function queueNotification(input: NotifyInput): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !input.to) {
    console.info('[notify:dev]', input.template, '→', input.to, input.data ?? {});
    return;
  }
  const { error } = await supabase.from('notifications').insert({
    event_id: input.eventId ?? null,
    recipient_email: input.to,
    template: input.template,
    data: input.data ?? {},
  });
  if (error) console.error('[supabase] notification insert:', error.message);
}
