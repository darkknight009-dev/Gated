# API

All JSON product routes require a valid Supabase SSR session unless documented otherwise. Tenant identity is resolved server-side. Validation errors use 400, missing auth 401, missing owned resource 404, conflict 409, rate limit 429, upstream failure 502/503.

## Authentication and Gmail

- `GET /api/auth/google` — starts Google OAuth with offline Gmail modify/send scopes.
- `GET /auth/callback` — exchanges PKCE code, verifies Gmail profile, encrypts credentials, queues sync.
- `POST /api/auth/sign-out` — clears Supabase session.
- `POST /api/gmail/disconnect` — revokes Google token and removes credentials.
- `POST /api/sync` — queues incremental sync for an owned email account.
- `GET /api/sync/status?emailAccountId=…` — live progress for one owned connection: phase, messages found, messages scored, queued jobs, dead jobs, last sync time. Read-only and uncached; the inbox polls it while work is outstanding.
- `POST /api/gmail/pubsub?token=…` — authenticated Google Pub/Sub push ingestion; queues reconciliation.
- `POST /api/jobs/process` — cron/worker-only bounded queue processing with bearer `CRON_SECRET`.

## Inbox

- `GET /api/search?q=…` — weighted full-text mailbox search; max 50.
- `POST /api/feedback` — records category/sender correction and applies personalized override.
- `POST /api/email/action` — archive, trash, mark read/unread through Gmail then local state.

## Outgoing

- `POST /api/outgoing/analyze` — validates and persists a draft, deterministic/AI analysis, returns Communication Score.
- `POST /api/outgoing/send` — requires `{ draftId, approved: true }`, verifies ownership/status, sends with Gmail.

## Preferences/privacy

- `POST /api/onboarding` — role, priorities, depriorities, interests, custom context.
- `PATCH /api/preferences` — retention, analysis retention, analytics consent, attention profile.
- `DELETE /api/privacy/delete-email-data` — deletes locally synchronized email graph.
- `DELETE /api/privacy/delete-account` — requires exact confirmation phrase and deletes Supabase Auth user.

## Operations

- `GET /api/health` — public non-sensitive liveness/configuration status.

Responses never contain OAuth tokens. Error bodies never contain email content or provider response bodies.