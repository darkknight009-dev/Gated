# Security

## Data classification

Email bodies, recipients, senders, OAuth credentials, and drafts are confidential. Scores/preferences are private behavioral data. Logs and product analytics are designed to exclude message content.

## Implemented controls

- Supabase Auth SSR uses cookie sessions and PKCE; route handlers call `getUser()` rather than trusting client identity.
- Gmail access/refresh tokens are encrypted with AES-256-GCM under `OAUTH_ENCRYPTION_KEY`; key version is persisted.
- OAuth credentials have no authenticated-client RLS policy and are used only through service-role server modules.
- RLS enforces account membership; APIs also filter explicitly by account/user before privileged work.
- OAuth tokens are never placed in localStorage, returned by APIs, included in URLs, or written to logs.
- Request logs are JSON structured; keys matching body/content/token/secret/auth/cookie/password are redacted.
- Mutating endpoints use Zod, account ownership checks, and database-backed rate limits.
- Pub/Sub and worker ingress use timing-safe shared-secret checks. Production should additionally validate Google Pub/Sub OIDC audience/issuer at the load balancer.
- CSP blocks third-party scripts/images, framing, objects, and unexpected connections. Remote email images are not rendered.
- HTML email is sanitized server-side; scripts, styles, images, event handlers, data URLs, and JavaScript URLs are removed.
- Email instructions are delimited as untrusted content in AI prompts; deterministic prompt-injection markers are persisted for security analysis.
- Account deletion cascades from `auth.users`; Gmail disconnect revokes provider access before removing local credentials.

## Threat model highlights

- **Tenant bypass:** account IDs come from memberships; RLS remains the final guard.
- **Stored/reflected XSS:** product renders plain body text; sanitized HTML is retained but not injected in v1.
- **Prompt injection/exfiltration:** no model tools, no secrets in prompts, strict output-only provider calls, explicit untrusted-content boundaries.
- **OAuth theft:** server-only encrypted tokens, no token logs, restricted credential table, revocation path.
- **Queue duplication:** unique active dedupe keys and content hash idempotency.
- **Webhook forgery:** secret authentication, schema validation, mailbox lookup, no content in webhook payload.
- **Header injection:** outgoing To/Cc are email-validated and all message headers strip CR/LF.

## Key management

Generate `OAUTH_ENCRYPTION_KEY` with 32 random bytes encoded base64url. Store it in a cloud secret manager. Rotation requires decrypt/re-encrypt under a new key version; do not replace the key before rewrapping credentials.

## Production hardening gates

Before external Gmail verification: configure Google OAuth consent/verification, restricted-scope assessment if required, OIDC-authenticated Pub/Sub push, managed WAF/rate limits, Supabase PITR, secret rotation, Sentry-compatible error sink, dependency scanning, and penetration testing. Known operational limitation: CSP permits inline Next.js bootstrap scripts; deploy nonce-based CSP when hosting infrastructure supports per-request nonces.