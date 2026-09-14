# GATED

**Fewer messages. More that matter.**

Gated is the attention layer above Gmail. It synchronizes a user-authorized mailbox, normalizes untrusted email, extracts deterministic and AI-assisted signals, applies a versioned Attention Engine, and presents a prioritized—not destructive—inbox.

## Implemented product paths

- Supabase Auth Google OAuth using the PKCE-compatible SSR client
- Offline Gmail OAuth credential capture, AES-256-GCM storage, refresh, revocation, and reauthorization state
- Bounded initial Gmail sync and incremental `historyId` reconciliation through durable Postgres jobs
- MIME-part normalization, tracking pixel removal, HTML sanitization, prompt-injection detection, thread/sender context
- OpenAI, Anthropic, and Google provider adapters with strict structured outputs plus Zod validation
- Deterministic, versioned Attention Score with contextual overrides and concise evidence
- Prioritized inbox, all mail recovery, keyboard navigation, search, feedback, sender preferences
- Outgoing Communication Score, voice-preserving improvement, and explicit Gmail send approval
- Sender intelligence, weekly analytics, configurable retention, audit history, disconnect, and deletion
- RLS tenant isolation, database rate limits, structured redacted logs, health checks, security headers, tests, CI, and operational docs

## Runtime

The application is a TypeScript modular monolith:

- Next.js App Router for UI, route handlers, auth callback, and bounded worker invocations
- Supabase Auth + PostgreSQL for identity and persisted state
- Supabase/Postgres `processing_jobs` for durable asynchronous work
- Google Gmail API + Pub/Sub for provider synchronization
- Pluggable AI providers via server-side REST

There is no Python service and no Drizzle runtime path.

## Start locally

1. Create a Supabase project or run Supabase locally.
2. Apply `supabase/migrations/202604160001_gated_core.sql`.
3. Copy `.env.example` to `.env.local` and set real credentials.
4. Enable Google Auth in Supabase and Gmail API in Google Cloud.
5. Run `npm install` and `npm run dev`.
6. Invoke `/api/jobs/process` on a schedule using the configured bearer secret.

The marketing site and health endpoint render without secrets. Protected product behavior fails closed until Supabase is configured. No demo inbox data is injected in production.

## Validation

- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npx vitest run`
- `npm run build`

See `DEVELOPMENT.md`, `DEPLOYMENT.md`, and `RUNBOOK.md` for environment setup and operations.