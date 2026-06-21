// Email templates for the notification drainer. Pure string rendering — no
// dependencies — so the same `template` value the DB trigger stores (see
// src/lib/notifications.ts and migration 0008) maps to a subject + HTML here.
// All links come from `appUrl`, so switching the app domain needs no code change.

export interface TemplateCtx {
  firstName?: string;
  event?: { name?: string; date?: string; venue?: string } | null;
  eventId?: string | null;
  appUrl: string;
}

export interface RenderedEmail {
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

/** Render an email for a stored template, or null if the template is unknown. */
export function renderTemplate(template: string, ctx: TemplateCtx): RenderedEmail | null {
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
