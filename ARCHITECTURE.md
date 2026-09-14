# Architecture

## Decision

Gated is a TypeScript modular monolith on Next.js and Supabase. This intentionally replaces the initially suggested Python/FastAPI service: one language reduces auth/type drift while domain boundaries keep future extraction possible. Long-running work is chunked into durable jobs rather than executed in page requests.

## Boundaries

```text
React UI / Server Components
  -> authenticated Next.js route handlers
    -> application modules (Gmail, jobs, AI)
      -> domain modules (attention/scoring)
        -> Supabase PostgreSQL / Gmail / AI providers
```

- `src/domain/attention`: pure scoring, deterministic extraction, outgoing analysis. No database/provider imports.
- `src/lib/ai`: the only location allowed to call LLM APIs.
- `src/lib/gmail`: token lifecycle, Gmail REST client, untrusted MIME normalization.
- `src/lib/jobs`: durable queue submission and idempotent job processing.
- `src/lib/supabase`: cookie SSR and server-only service-role clients.
- `src/app/api`: authentication/authorization, validation, rate limits, HTTP errors.
- `supabase/migrations`: source of truth for schema, functions, indexes, and RLS.

## Ingestion

Gmail Pub/Sub returns only a mailbox watermark. The webhook authenticates a verification secret, acknowledges quickly, and enqueues `incremental_sync`. The worker loads the previously committed cursor, pages `history.list`, queues changed IDs, records deletions, and advances only after queue persistence. A stale cursor triggers bounded recovery sync.

Initial sync pages 100 Gmail IDs at a time and queues one idempotent ingestion job per message. It does not synchronously call AI 10,000 times. Ingestion normalizes and hashes content; unchanged analyzed hashes are skipped. AI is used only for ambiguous deterministic scores.

## Async durability

`processing_jobs` supports availability time, retries, leases, stale-lease recovery, deduplication, exponential backoff, and dead status. `claim_processing_jobs` uses `FOR UPDATE SKIP LOCKED`. Scheduled production calls to `/api/jobs/process` are bearer-authenticated. The HTTP worker processes a bounded batch to stay within serverless limits.

Supabase Queues/pgmq is a future drop-in if throughput requires it; the current table queue has equivalent core delivery semantics and is inspectable without another service.

## Multi-tenancy

Each product row has `account_id`; ownership is resolved from the authenticated session, never from a browser-provided tenant. RLS uses `user_account_ids()`. Service-role operations first authorize the target through a session-bound client. Organization membership and account roles are already modeled.

## Realtime and scaling

The current inbox uses server rendering and explicit refresh. Supabase Realtime can later subscribe to score/job changes under the same RLS policies. Queue workers can scale horizontally because claiming uses row locks. Search uses a GIN `tsvector` index. Inbox queries are bounded to 100 recent rows; cursor pagination/virtualization is the next scale step.