# Deployment

## Topology

- Next.js web/API deployed to a Node-compatible serverless or container platform.
- Supabase project in the chosen data residency region with PITR enabled.
- Scheduled authenticated call to `/api/jobs/process`; horizontally scalable bounded workers.
- Google Cloud Pub/Sub HTTPS push to `/api/gmail/pubsub`.
- Secret manager for service role, encryption key, Google client secret, cron/webhook secrets, AI keys.

## Environment separation

Use isolated Supabase projects, Google OAuth clients, Pub/Sub topics, AI keys, encryption keys, and domains for development/staging/production. Never share production email with staging.

## Release order

1. Apply reviewed Supabase migrations.
2. Deploy application with secrets and health check.
3. Validate auth redirect allowlists and CSP.
4. Start worker schedule and inspect queue.
5. Configure Pub/Sub push and daily watch renewal.
6. Run a canary mailbox sync/search/feedback/send/deletion path.
7. Promote traffic.

## Required launch configuration

- Google OAuth consent and sensitive/restricted-scope verification as applicable.
- `APP_URL` must match the public HTTPS origin.
- 32-byte `OAUTH_ENCRYPTION_KEY`; strong distinct cron and Pub/Sub secrets.
- Supabase service role available only to the server runtime.
- AI vendor privacy/no-training configuration and region reviewed.
- Alerting on 5xx, dead jobs, Gmail reauthorization, AI failures/cost, queue age/depth, DB latency.
- Daily backups/PITR and restore drill.

## Containers

The provided Dockerfile creates a production Next.js image. `docker-compose.yml` runs the web application for local/container testing while Supabase remains an external/local-CLI dependency. Do not bake `.env` into images.

## Rollback

Application releases should be backward-compatible with the current schema. Roll back application first. Database migrations are forward-only by default; destructive changes require expand/migrate/contract releases and a tested restoration plan.