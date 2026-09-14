# Data model

The canonical migration is `supabase/migrations/202604160001_gated_core.sql`.

## Identity and tenancy

- `users`: application profile linked one-to-one to `auth.users`.
- `accounts`: tenant boundary, future organization-ready.
- `account_members`: user/account role mapping.
- `email_accounts`: user-authorized Gmail connections and status.
- `oauth_credentials`: encrypted server-only tokens; inaccessible to authenticated clients.

## Communication graph

- `email_threads`: provider thread, participants, reply/active-conversation context.
- `emails`: normalized message metadata, retained plain/sanitized content, labels, hash, search vector.
- `senders`: per-account identity and communication counts.
- `sender_relationships`: private relationship type, response rate, importance, confidence.

## Attention and personalization

- `email_analyses`: structured signals, evidence, prompt/model/cost metadata, injection markers.
- `scoring_versions`: immutable controlled weights and thresholds.
- `attention_scores`: score/category/confidence/signals/override with version references.
- `user_preferences`, `user_interests`: explicit priorities and retention choices.
- `feedback_events`, `sender_preferences`: corrections and personalized sender rules.

## Outgoing communication

- `outgoing_drafts`: persisted user draft and explicit status.
- `outgoing_analyses`: Communication Score, component signals, optional preserved-voice suggestion.

## Operations and commercial readiness

- `sync_states`: Gmail history cursor, watch expiry, phase/errors.
- `processing_jobs`: leased, retryable, deduplicated durable queue.
- `audit_events`: security-relevant content-free audit trail.
- `subscriptions`: free/pro/team abstraction with provider-neutral identifiers.
- `usage_records`: per-account/day metrics.
- `product_events`: allowlisted content-free analytics.
- `rate_limit_buckets`: database-enforced action windows.

## Deletion

Auth user deletion cascades to user/account data through foreign keys. Email deletion cascades analysis and scores. Gmail disconnect deletes credentials but intentionally does not delete local messages. Retention can null body/HTML separately from metadata and analysis.

## Search

`emails.indexed_document` is a generated weighted English `tsvector` over subject, sender identity, snippet, and retained body. GIN indexing supports `websearch_to_tsquery`; `search_emails` checks account membership and result limits.