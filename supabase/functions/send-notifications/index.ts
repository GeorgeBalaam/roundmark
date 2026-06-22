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
const BRAND_DEEP = '#1c3d1e';
const ACCENT = '#8DB259';
const INK = '#242c33';
const MUTED = '#6b7464';
const PAGE_BG = '#eceadf';
const PANEL_BG = '#f4f7ee';
const PANEL_BORDER = '#dde6cf';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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

/** Bulletproof, table-based CTA button (holds up in Outlook). */
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
    <tr><td align="center" bgcolor="${ACCENT}" style="border-radius:10px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#10240f;text-decoration:none;border-radius:10px;">${label}</a>
    </td></tr>
  </table>`;
}

/** Tinted date/venue panel. Returns '' when there's nothing to show. */
function detailsPanel(when: string, where: string): string {
  const row = (k: string, v: string) =>
    `<tr>
      <td style="padding:3px 12px 3px 0;font-family:${FONT};font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top;">${k}</td>
      <td style="padding:3px 0;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};">${v}</td>
    </tr>`;
  const rows = [when && row('Date', when), where && row('Venue', where)].filter(Boolean).join('');
  if (!rows) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PANEL_BG};border:1px solid ${PANEL_BORDER};border-radius:12px;margin:22px 0;">
    <tr><td style="padding:16px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
  </table>`;
}

/** Full responsive, client-safe email document. */
function emailDoc(preheader: string, eyebrow: string, inner: string): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<title>Roundmark</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e3e7da;">
    <tr><td style="background:${BRAND};background-image:linear-gradient(135deg,${BRAND},${BRAND_DEEP});padding:24px 36px;">
      <img src="${APP_URL}/brand/roundmark-logo-horizontal-white.png" alt="Roundmark" height="30" style="height:30px;width:auto;display:block;border:0;outline:none;text-decoration:none;">
      ${eyebrow ? `<div style="font-family:${FONT};color:${ACCENT};font-size:12px;font-weight:600;letter-spacing:0.03em;margin-top:12px;">${eyebrow}</div>` : `<div style="height:3px;width:42px;background:${ACCENT};margin-top:14px;border-radius:2px;"></div>`}
    </td></tr>
    <tr><td style="padding:34px 36px;font-family:${FONT};color:${INK};font-size:16px;line-height:1.65;">
      ${inner}
    </td></tr>
    <tr><td style="padding:22px 36px;background:#f7f5ee;border-top:1px solid #e3e7da;font-family:${FONT};color:#97a08c;font-size:12px;line-height:1.6;">
      You're receiving this because you registered for a golf day on Roundmark.<br>
      <span style="color:#b3bbab;">Roundmark — effortless live scoring for golf days.</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:800;color:${INK};">${text}</h1>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.65;color:${INK};">${text}</p>`;
}

function renderTemplate(template: string, ctx: TemplateCtx): RenderedEmail | null {
  const name = ctx.firstName ? ` ${escapeHtml(ctx.firstName)}` : '';
  const eventName = escapeHtml(ctx.event?.name ?? 'the event');
  const rawName = ctx.event?.name ?? 'the event';
  const when = formatDate(ctx.event?.date);
  const where = ctx.event?.venue ? escapeHtml(ctx.event.venue) : '';
  const panel = detailsPanel(when, where);
  const pageUrl = ctx.eventId ? `${ctx.appUrl}/e/${ctx.eventId}` : ctx.appUrl;

  switch (template) {
    case 'registration_received':
      return {
        subject: `We've got your registration for ${rawName}`,
        html: emailDoc(
          `Thanks${name} — your registration is in and awaiting approval.`,
          'Registration received',
          `${h1(`Thanks${name} — you're on the list`)}
           ${p(`We've received your registration for <strong>${eventName}</strong>. Here are the details:`)}
           ${panel}
           ${p(`Your place isn't confirmed just yet — the organiser reviews sign-ups and we'll email you the moment yours is approved.`)}
           ${p(`<a href="${pageUrl}" style="color:${BRAND};font-weight:600;">View the event page →</a>`)}`,
        ),
      };
    case 'registration_approved':
      return {
        subject: `You're in! Your place at ${rawName} is confirmed`,
        html: emailDoc(
          `Your place at ${rawName} is confirmed — see you on the course.`,
          'You\'re confirmed',
          `${h1(`You're in${name} 🎉`)}
           ${p(`Great news — your place at <strong>${eventName}</strong> is confirmed. We can't wait to see you on the course.`)}
           ${panel}
           ${button(pageUrl, 'View the event page')}
           ${p(`<span style="color:${MUTED};font-size:14px;">Add the date to your calendar so you don't miss your tee time.</span>`)}`,
        ),
      };
    case 'registration_declined':
      return {
        subject: `An update on your registration for ${rawName}`,
        html: emailDoc(
          `An update on your ${rawName} registration.`,
          'Registration update',
          `${h1(`Hi${name},`)}
           ${p(`Thank you for your interest in <strong>${eventName}</strong>. Unfortunately the organiser wasn't able to confirm a place for you this time — these days often fill up fast.`)}
           ${p(`If you think this was a mistake, or you'd like to be considered for a cancellation, please reach out to the organiser directly.`)}`,
        ),
      };
    case 'event_reminder':
      return {
        subject: `Not long now — ${rawName} is nearly here`,
        html: emailDoc(
          `${rawName} is coming up — here's everything you need.`,
          'See you soon',
          `${h1(`Not long now${name}!`)}
           ${p(`<strong>${eventName}</strong> is almost here. Here's everything you need for the day:`)}
           ${panel}
           ${button(pageUrl, 'Event details')}
           ${p(`<span style="color:${MUTED};font-size:14px;">Tip: bookmark the event page — your live leaderboard link will be there on the day.</span>`)}`,
        ),
      };
    case 'results_published':
      return {
        subject: `The results are in — ${rawName} 🏆`,
        html: emailDoc(
          `Final standings for ${rawName} are ready to view.`,
          'Results are in',
          `${h1(`The results are in 🏆`)}
           ${p(`Final standings for <strong>${eventName}</strong> have been locked in. Thanks for a brilliant day${name}!`)}
           ${button(pageUrl, 'See the final results')}`,
        ),
      };
    case 'early_access_received':
      return {
        subject: 'You\'re on the Roundmark early-access list',
        html: emailDoc(
          'Thanks for your interest in Roundmark - you are on the early-access list.',
          'Early access',
          `${h1(`Thanks${name} - you're on the list`)}
           ${p('Thanks for registering your interest in <strong>Roundmark</strong> - effortless live scoring for golf days. We\'re putting the finishing touches on it.')}
           ${p('We\'ll email you the moment it\'s ready for you to run your first golf day. No spam in the meantime.')}`,
        ),
      };
    case 'organiser_invite':
      return {
        subject: `You've been invited to co-organise ${rawName}`,
        html: emailDoc(
          `You've been invited to help organise ${rawName} on Roundmark.`,
          'Organiser invite',
          `${h1('You\'ve been invited to co-organise')}
           ${p(`You've been invited to help organise <strong>${eventName}</strong> on Roundmark — with full access to set it up and run the day.`)}
           ${panel}
           ${p('Sign in with this email address to accept. If you don\'t have an account yet, signing in creates one.')}
           ${button(`${ctx.appUrl}/login`, 'Sign in to accept')}`,
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
