# Infrastructure

Gated deploys as a Next.js container/serverless application plus managed Supabase and Google Cloud services.

Production resources:

- Supabase Auth/PostgreSQL in the required data residency region, PITR, connection pooling, migration deployment.
- Google OAuth client, Gmail API, Pub/Sub topic/push subscription, daily Gmail watch renewal.
- Scheduled bounded worker invocation with secret authentication.
- Secret manager entries for Supabase service role, OAuth encryption key, Google client, webhook/cron, and AI provider.
- WAF/request limits, TLS, centralized redacted logs, metrics/alerts, error sink.

Use IaC in the deployment organization’s cloud of choice. The repository does not invent cloud account IDs, domains, regions, or vendor credentials. See `docs/DEPLOYMENT.md` for release order and gates.