# Gated

**Fewer messages. More that matter.**

Gated is the attention layer above Gmail. It synchronizes your mailbox, scores every message by relevance, context, intent, and relationship, and shows you what deserves your attention — not what's loudest.

## What it does

- Prioritizes inbox by Attention Score (0–100) — not by time
- Categorizes: IMPORTANT, WORTH_READING, MAYBE_LATER, LOW_VALUE, TRANSACTIONAL, PROMOTIONAL
- Analyzes outgoing drafts before you send — Communication Score
- Deterministic + AI signals. AI never decides alone.
- Synced email is never training data
- Full privacy controls: disconnect, delete data, delete account

## Tech

Next.js 16 · TypeScript · Supabase (Auth + PostgreSQL + RLS) · Gmail API · NVIDIA AI · Tailwind CSS v4 · Vitest

## Quick start

```bash
npm install
cp .env.example .env
# fill in your credentials
npm run dev
```

## Validation

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npx vitest run
npm run lint
npm run build
```

## Docs

All documentation lives in `docs/`:

| File | What's in it |
|---|---|
| `docs/ARCHITECTURE.md` | Architecture, boundaries, ingestion flow |
| `docs/API.md` | All REST endpoints |
| `docs/DATA_MODEL.md` | Schema overview (25 tables) |
| `docs/AI_ARCHITECTURE.md` | AI pipeline, prompts, cost control |
| `docs/SCORING.md` | Attention Score v1 weights & categories |
| `docs/DEVELOPMENT.md` | Setup, OAuth config, quality gates |
| `docs/DEPLOYMENT.md` | Topology, release order, containers |
| `docs/RUNBOOK.md` | Operational runbook |
| `docs/DESIGN_SYSTEM.md` | Design tokens & components |
| `docs/DESIGN_RESEARCH.md` | Research & visual language |
| `docs/PRIVACY.md` | Privacy commitments |
| `docs/SECURITY.md` | Controls & threat model |

## License

Private project. Not open source.
