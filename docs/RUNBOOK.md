# Operations runbook

## Gmail disconnected / 401

1. Confirm `email_accounts.connection_status`.
2. Do not inspect or log token ciphertext.
3. Mark `reauthorization_required` if refresh failed.
4. UI directs user to Google re-consent. Stored mail remains safe.

## Gmail callback lands on localhost / ERR_CONNECTION_REFUSED

The OAuth `redirectTo` is built from `APP_URL`. A `localhost:3000` callback means the
deployment has no production `APP_URL` or Supabase rejected the redirect and fell back to its
**Site URL**.

1. Confirm `APP_URL` is set to the public HTTPS origin in the hosting environment and redeploy.
2. Confirm Supabase Auth **Site URL** is the production origin and **Redirect URLs** contains
   `<origin>/auth/callback`.
3. Confirm Google's authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Retry `GET /api/auth/google` from the production origin; the `redirect_to` parameter should
   show the production host.

No mailbox data is stored when the callback is unreachable; the user simply re-consents.

## Sync stalled

1. Check oldest queued/processing `processing_jobs`, attempts, lease age, and worker HTTP status.
2. Verify cron bearer secret and Supabase service role.
3. Reclaim occurs automatically after a 10-minute stale lease.
4. For dead jobs, classify provider/quota/auth/data errors before manually requeueing.
5. Never advance `history_id` manually to silence an error.

## Gmail history 404

This means the cursor is stale. The worker records `STALE_HISTORY` and queues bounded recovery sync. Verify recovery pages complete and then establish a new watch/cursor.

## Pub/Sub silence

Check watch expiry, daily renewal, topic name, Gmail publisher IAM, HTTPS endpoint, push response status, and verification token. Pub/Sub is a hint; run periodic incremental safety reconciliation.

## AI provider degradation

The product continues deterministic-only analysis with lower confidence when the provider is unconfigured. For transient configured-provider failures, inspect redacted `ai_classification_failed` rate/latency, provider status, 429s, and cost limits. Do not log or replay private bodies during debugging.

## Queue growth

Scale worker invocations horizontally, keep batch size bounded, and inspect job type distribution. Gmail and AI quotas are separate bottlenecks. Prioritize incremental sync and critical/ambiguous analysis over historical backlog.

## Privacy deletion failure

Freeze affected account processing, preserve the content-free audit record, identify failed cascading/backup scope, retry service-role deletion, and verify emails/credentials/user data. Follow published legal timelines and account for PITR backup expiry.

## Suspected credential leak

1. Rotate affected Google credentials and revoke user tokens.
2. Rotate service role/cron/webhook secrets as relevant.
3. If encryption key leaked, block workers, rotate key via credential re-consent or controlled rewrap.
4. Preserve content-free forensic logs.
5. Follow incident response and customer/regulator notification policy.

## Alerts

Page on: health failure, queue oldest age >10m, dead job increase, credential decrypt errors, account deletion failure, RLS/security test failure. Ticket on: AI failure >5%, Gmail 429 increase, watch expiry <24h, database p95 regression, cost anomaly.