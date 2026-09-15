# Development

## Prerequisites

Node 22+, npm, a Supabase project/CLI, Google Cloud project with Gmail API, and optionally an AI provider key.

## Setup

1. `npm install`
2. Create a Supabase project and apply `supabase/migrations/202604160001_gated_core.sql` with Supabase CLI or migration deployment.
3. Enable Google provider in Supabase Auth. Google’s authorized callback is the Supabase project callback; add `http://localhost:3000/auth/callback` to Supabase redirect allowlist.
4. Enable Gmail API, configure OAuth consent scopes, and create a Pub/Sub topic. Grant Gmail’s push publisher identity permission as required by Google.
5. Copy `.env.example` to `.env.local` and use real values.
6. `npm run dev`.

## OAuth encryption key

Generate 32 random bytes as base64url, for example with Node crypto. Never commit it. Changing it invalidates stored ciphertext unless credentials are rewrapped.

## OAuth redirect URLs (most common production failure)

`APP_URL` is the only source of the OAuth `redirectTo` when it is usable. If a browser is
sent back to `http://localhost:3000/auth/callback`, one of these is misconfigured:

1. **Vercel environment variable** — set `APP_URL=https://<your-domain>` for Production
   (and for Preview if previews must work). Without it the code falls back to
   `http://localhost:3000`. Redeploy after changing it: `NEXT_PUBLIC_*` values are inlined at
   build time, and server values are read at runtime.
2. **Supabase → Authentication → URL Configuration** — set **Site URL** to
   `https://<your-domain>` and add both `https://<your-domain>/auth/callback` and
   `http://localhost:3000/auth/callback` to **Redirect URLs**. Supabase silently falls back to
   the Site URL when `redirectTo` is not allowlisted, which sends users to localhost.
3. **Google Cloud → Credentials → OAuth client** — the authorized redirect URI must be the
   **Supabase** callback, not the app callback:
   `https://<project-ref>.supabase.co/auth/v1/callback`.

In production a loopback `APP_URL` is ignored and the deployment host is derived from the
request, so a forgotten variable degrades to a working origin instead of a dead localhost
link. The origin must still be allowlisted in Supabase for the exchange to succeed.

## Background work

Call the worker with `POST /api/jobs/process` and header `Authorization: Bearer $CRON_SECRET`. In local development a scheduler can call it every 10–30 seconds. Do not run unbounded loops inside Next.js.

Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set, so `vercel.json` needs no secret of its own. Pub/Sub and OAuth only **enqueue** jobs; nothing is processed until the worker runs, so invocation has to be frequent:

- Vercel **Hobby** allows one cron per project and at most one run per day, which is only a safety net. Use an external scheduler (cron-job.org, QStash, or a scheduled GitHub Actions workflow) hitting `/api/jobs/process` every minute or two with the bearer secret.
- Vercel **Pro** allows frequent schedules: change `vercel.json` to `*/5 * * * *` or `* * * * *`.

Retention cleanup has a handler but no enqueuer; schedule it explicitly if the retention policy must run automatically.

Configure Pub/Sub push to `/api/gmail/pubsub?token=$GOOGLE_PUBSUB_VERIFICATION_TOKEN`. Renew watches daily by enqueuing `renew_watch` jobs or a Supabase Cron integration.

## Quality gates

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npx vitest run
npm run lint
npm run build
npm audit --omit=dev
```

## Test data

Production code has no seed messages. Integration/evaluation fixtures must live under `tests/`, use synthetic mail, and never copy customer content. Use a dedicated Google Workspace test mailbox for OAuth/sync tests.

## Supabase types

For stricter query inference, generate database types in CI after linking a project and pass them into Supabase clients. The current source uses explicit boundary interfaces and Zod for external model/API input.