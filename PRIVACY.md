# Privacy

## Product commitments encoded in the implementation

- Gated synchronizes only after explicit Google consent.
- It requests Gmail modify/read capability and send capability; it does not request Drive, Calendar, or Contacts.
- Sending requires an explicit user action.
- Mail is prioritized and de-emphasized, never secretly destroyed. Everything remains recoverable unless the user explicitly trashes/deletes it.
- AI-assisted authorship is not treated as bad. The probability is stored as one private signal.
- Private customer mail is not silently used for global training. Feedback adjusts user/sender preferences only.
- Product events exclude subject, body, sender, recipient, and message IDs.

## Retention

`user_preferences` separately controls:

- Email content retention: 30 days, 90 days, 1 year, or until deletion.
- Whether analysis remains after content expires.
- Privacy-safe product analytics opt-in.

The retention worker nulls body and sanitized HTML while allowing the score/metadata to remain if configured. Attachments are not downloaded or stored in v1.

## User controls

The Privacy Center exposes connected accounts, granted scopes, retention, analysis retention, analytics consent, audit history, disconnect, synced-data deletion, and full account deletion.

- Disconnect revokes the Google access token and deletes encrypted credentials. Existing synchronized data remains until deleted or expired.
- Delete synced data removes local email rows; cascading relationships remove message analyses/scores.
- Delete account removes the Supabase Auth user and cascades associated personal/account data.

## Vendors and transfers

A production privacy notice must name the configured Supabase region/project, Google APIs, selected AI provider, infrastructure host, and observability vendors. Configure enterprise/no-training or zero-data-retention terms with AI providers before processing customer email. This repository cannot establish those contractual terms; deployment owners must do so.

## Data subject and legal operations

Audit events make deletion and connection actions traceable without storing bodies. Operational runbooks must verify backups/PITR retention when fulfilling erasure requests, publish subprocessor changes, define lawful basis, and document incident notification timelines for launch regions.