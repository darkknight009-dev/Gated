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

## Background work

Call the worker with `POST /api/jobs/process` and header `Authorization: Bearer $CRON_SECRET`. In local development a scheduler can call it every 10–30 seconds. Do not run unbounded loops inside Next.js.

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