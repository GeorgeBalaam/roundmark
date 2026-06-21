// Notification drainer — sends pending rows from public.notifications via Resend.
//
// The DB trigger (migration 0008) captures every registration email as a
// `pending` row; this function reads them, sends via the Resend API, and marks
// each sent/failed. It's invoked on a schedule (pg_cron → pg_net, see README)
// and is idempotent: it only touches pending rows that haven't exhausted retries.
//
// Single file on purpose: the Supabase dashboard editor deploys this as-is with
// no extra files to create or relative imports to resolve.
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

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'Roundmark <noreply@roundmark.app>';
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://beta.roundmark.app').replace(/\/+$/, '');
const DRAIN_SECRET = Deno.env.get('DRAIN_SECRET') ?? '';

const MAX_ATTEMPTS = 5;
const BATCH = 50;

// ---------------------------------------------------------------------------
// Email templates. Pure string rendering — the `template` value the DB trigger
// stores (see src/lib/notifications.ts and migration 0008) maps to subject+HTML.
// All links come from APP_URL, so switching the app domain needs no code change.
// ---------------------------------------------------------------------------

interface TemplateCtx {
  firstName?: string;
  event?: { name?: string; date?: string; venue?: string } | null;
  eventId?: string | null;
  appUrl: string;
}
interface RenderedEmail {
  subject: string;
  html: string;
}

const BRAND = '#27542A';
const ACCENT = '#8DB259';

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#10240f;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;margin-top:8px;">${label}</a>`;
}

function layout(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f7f3ea;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7eadf;">
    <div style="background:${BRAND};padding:20px 28px;">
      <span style="color:#ffffff;font-weight:700;font-size:18px;letter-spacing:0.02em;">Roundmark</span>
    </div>
    <div style="padding:28px;color:#242c33;font-size:16px;line-height:1.65;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #e7eadf;color:#7a8472;font-size:12px;">
      Powered by Roundmark — live scoring for golf days.
    </div>
  </div>
</div>`;
}

function renderTemplate(template: string, ctx: TemplateCtx): RenderedEmail | null {
  const name = ctx.firstName ? ` ${escapeHtml(ctx.firstName)}` : '';
  const eventName = escapeHtml(ctx.event?.name ?? 'the event');
  const when = formatDate(ctx.event?.date);
  const where = ctx.event?.venue ? escapeHtml(ctx.event.venue) : '';
  const detail = [when, where].filter(Boolean).join(' · ');
  const detailLine = detail ? ` — ${detail}` : '';
  const pageUrl = ctx.eventId ? `${ctx.appUrl}/e/${ctx.eventId}` : ctx.appUrl;

  switch (template) {
    case 'registration_received':
      return {
        subject: `We've got your registration for ${ctx.event?.name ?? 'the event'}`,
        html: layout(
          `<h1 style="margin:0 0 12px;font-size:22px;">Thanks${name}!</h1>
           <p style="margin:0 0 12px;">We've received your registration for <strong>${eventName}</strong>${detailLine}.</p>
           <p style="margin:0;">Your place isn't confirmed until the organiser approves it — we'll email you the moment they do.</p>`,
        ),
      };
    case 'registration_approved':
      return {
        subject: `You're in — ${ctx.event?.name ?? 'the event'}`,
        html: layout(
          `<h1 style="margin:0 0 12px;font-size:22px;">You're in${name}!</h1>
           <p style="margin:0 0 16px;">Your place at <strong>${eventName}</strong>${detail ? ` (${detail})` : ''} is confirmed. We can't wait to see you on the course.</p>
           ${button(pageUrl, 'View the event page')}`,
        ),
      };
    case 'registration_declined':
      return {
        subject: `About your registration for ${ctx.event?.name ?? 'the event'}`,
        html: layout(
          `<h1 style="margin:0 0 12px;font-size:22px;">Hi${name},</h1>
           <p style="margin:0 0 12px;">Thanks for your interest in <strong>${eventName}</strong>. Unfortunately the organiser wasn't able to confirm your place this time.</p>
           <p style="margin:0;">If you think this was a mistake, please reach out to the organiser directly.</p>`,
        ),
      };
    case 'event_reminder':
      return {
        subject: `${ctx.event?.name ?? 'Your golf day'} is nearly here`,
        html: layout(
          `<h1 style="margin:0 0 12px;font-size:22px;">See you soon${name}!</h1>
           <p style="margin:0 0 16px;"><strong>${eventName}</strong>${detailLine} is coming up. Here's everything you need.</p>
           ${button(pageUrl, 'Event details')}`,
        ),
      };
    case 'results_published':
      return {
        subject: `Results are in — ${ctx.event?.name ?? 'the event'}`,
        html: layout(
          `<h1 style="margin:0 0 12px;font-size:22px;">The results are in${name}!</h1>
           <p style="margin:0 0 16px;">Final standings for <strong>${eventName}</strong> are ready to view.</p>
           ${button(pageUrl, 'See the results')}`,
        ),
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

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
