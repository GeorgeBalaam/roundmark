// Notification drainer — sends pending rows from public.notifications via Resend.
//
// The DB trigger (migration 0008) captures every registration email as a
// `pending` row; this function reads them, sends via the Resend API, and marks
// each sent/failed. It's invoked on a schedule (pg_cron → pg_net, see README)
// and is idempotent: it only touches pending rows that haven't exhausted retries.
//
// Auth: deployed with verify_jwt = false and gated by a shared secret header
// (x-drain-secret) so only the cron job (which knows the secret) can trigger it.
//
// Config (Supabase function secrets — switching domain only touches these):
//   RESEND_API_KEY  — Resend API key
//   RESEND_FROM     — e.g. "Roundmark <noreply@roundmark.app>"
//   APP_URL         — base URL for links in emails, e.g. "https://beta.roundmark.app"
//   DRAIN_SECRET    — shared secret the cron job sends in x-drain-secret
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderTemplate } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Roundmark <noreply@roundmark.app>';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://beta.roundmark.app').replace(/\/+$/, '');
const DRAIN_SECRET = Deno.env.get('DRAIN_SECRET') ?? '';

const MAX_ATTEMPTS = 5;
const BATCH = 50;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  // Gate on the shared secret (function is deployed with verify_jwt = false).
  if (DRAIN_SECRET) {
    if (req.headers.get('x-drain-secret') !== DRAIN_SECRET) {
      return json({ error: 'forbidden' }, 403);
    }
  }
  if (!RESEND_API_KEY) {
    return json({ error: 'RESEND_API_KEY not configured' }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, event_id, recipient_email, template, data, attempts')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) return json({ error: error.message }, 500);
  if (!pending || pending.length === 0) return json({ sent: 0, failed: 0, message: 'nothing pending' });

  const eventCache = new Map<string, { name?: string; date?: string; venue?: string } | null>();
  let sent = 0;
  let failed = 0;

  for (const n of pending) {
    let event: { name?: string; date?: string; venue?: string } | null = null;
    if (n.event_id) {
      if (!eventCache.has(n.event_id)) {
        const { data } = await supabase.from('events').select('name, date, venue').eq('id', n.event_id).maybeSingle();
        eventCache.set(n.event_id, data ?? null);
      }
      event = eventCache.get(n.event_id) ?? null;
    }

    const data = (n.data ?? {}) as { firstName?: string };
    const rendered = renderTemplate(n.template, {
      firstName: data.firstName,
      event,
      eventId: n.event_id,
      appUrl: APP_URL,
    });

    if (!rendered) {
      await supabase.from('notifications')
        .update({ status: 'failed', error: `unknown template: ${n.template}`, attempts: n.attempts + 1 })
        .eq('id', n.id);
      failed++;
      continue;
    }

    const attempts = n.attempts + 1;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: n.recipient_email,
          subject: rendered.subject,
          html: rendered.html,
        }),
      });

      if (res.ok) {
        await supabase.from('notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString(), error: null, attempts })
          .eq('id', n.id);
        sent++;
      } else {
        const body = await res.text();
        // 4xx (bad address etc.) won't fix itself — fail it. 5xx/transient retries.
        const permanent = res.status >= 400 && res.status < 500;
        await supabase.from('notifications')
          .update({
            status: permanent || attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            error: `resend ${res.status}: ${body.slice(0, 300)}`,
            attempts,
          })
          .eq('id', n.id);
        failed++;
      }
    } catch (e) {
      await supabase.from('notifications')
        .update({
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: String(e).slice(0, 300),
          attempts,
        })
        .eq('id', n.id);
      failed++;
    }
  }

  return json({ processed: pending.length, sent, failed });
});
