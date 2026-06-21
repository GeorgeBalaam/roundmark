# send-notifications — Resend drainer

Sends pending rows from `public.notifications` via [Resend](https://resend.com).
The DB trigger in `0008_notifications.sql` already enqueues registration emails;
this function delivers them. Invoked every minute by a `pg_cron` job.

Everything domain-specific is a **secret** (`RESEND_FROM`, `APP_URL`), so changing
the email or app domain later needs no code change — just update the secret (and
re-verify the new domain in Resend).

---

## One-time setup

### 1. Resend account + domain (you do this)
1. Create a Resend account and add your sending domain — recommend the root
   **`roundmark.app`** (works no matter where the app is hosted).
2. Add the DNS records Resend shows (SPF/DKIM, optional DMARC) at your domain
   registrar. Wait for Resend to mark the domain **Verified**.
3. Create an **API key** (Sending access).

> The sending domain is independent of where the app is hosted (Vercel /
> beta.roundmark.app). If you rebrand to a different domain later, verify it in
> Resend and update `RESEND_FROM` + `APP_URL` — no redeploy of code needed.

### 2. Run the migration
Run `supabase/migrations/0011_notifications_attempts.sql` in the SQL editor
(adds the retry counter the drainer uses).

### 3. Deploy the function
Dashboard: **Edge Functions → Deploy a new function → `send-notifications`**,
paste `index.ts` + `templates.ts`, and turn **Verify JWT = OFF**.

Or CLI:
```bash
supabase functions deploy send-notifications --no-verify-jwt
```

### 4. Set the function secrets
Generate a drain secret first, e.g. `openssl rand -hex 24`.

Dashboard: **Edge Functions → send-notifications → Secrets**, or CLI:
```bash
supabase secrets set \
  RESEND_API_KEY="re_xxx" \
  RESEND_FROM="Roundmark <noreply@roundmark.app>" \
  APP_URL="https://beta.roundmark.app" \
  DRAIN_SECRET="<the value you generated>"
```
(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

### 5. Schedule the drain (pg_cron + pg_net)
Enable the **`pg_cron`** and **`pg_net`** extensions (Database → Extensions),
then run this in the SQL editor, substituting your project ref and drain secret:

```sql
select cron.schedule(
  'drain-notifications',
  '* * * * *',  -- every minute
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-drain-secret', '<DRAIN_SECRET>'),
    body    := '{}'::jsonb
  );
  $$
);
```
To change or remove it later: `select cron.unschedule('drain-notifications');`

---

## Test it
Insert a test row and either wait a minute or invoke manually:
```bash
curl -X POST 'https://<PROJECT_REF>.supabase.co/functions/v1/send-notifications' \
  -H 'x-drain-secret: <DRAIN_SECRET>'
```
Then check the row flipped to `sent`:
```sql
select template, recipient_email, status, attempts, error, sent_at
from public.notifications order by created_at desc limit 10;
```

---

## Separately: fix the magic-link "email rate limit exceeded"
That error is Supabase's built-in auth email cap, not this function. Point Auth at
Resend's SMTP to remove it (same Resend account/domain):

**Authentication → Emails → SMTP Settings → Enable custom SMTP**
- Host: `smtp.resend.com`  ·  Port: `465`  ·  User: `resend`
- Password: your Resend API key
- Sender: `noreply@roundmark.app` (must be on the verified domain)

This is a dashboard change only — no code involved.

---

## Templates
Defined in `templates.ts`, keyed by the `template` column. Current set:
`registration_received`, `registration_approved`, `registration_declined`,
`event_reminder`, `results_published` — mirrors the catalog in
`src/lib/notifications.ts`.
