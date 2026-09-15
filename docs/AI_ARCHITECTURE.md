# AI architecture

## Pipeline

```text
normalized email
 -> deterministic extraction and injection detection
 -> recipient / sender / thread context retrieval
 -> cost gate (ambiguous only)
 -> provider structured classification
 -> Zod validation
 -> deterministic weighted scoring and overrides
 -> persisted analysis + score versions
```

The LLM never directly assigns the final Attention Score. It extracts bounded 0–1 signals. `calculateAttentionDecision` merges AI signals with deterministic signals, applies versioned weights, then applies explicit contextual override logic.

## Provider boundary

`AIProvider` defines classification, extraction, summary, outgoing analysis, and improvement methods. `NvidiaProvider` uses one `NVIDIA_API_KEY` with the comma-separated `NVIDIA_MODELS` fallback list. No domain, route, or worker file calls provider endpoints directly.

Incoming and outgoing outputs use provider-native JSON schemas and are always parsed again with Zod. Persisted metadata includes provider, model name/version, prompt version, tokens, latency, and estimated cost where available.

Summarization is deliberately disabled in v1 to avoid another full-body provider call. The interface exists for a reviewed future implementation.

## Prompt security

Prompts label email, sender, draft, and thread fields as untrusted delimited data. System text explicitly forbids following embedded instructions, revealing prompts, accessing secrets, or calling tools. Providers are called without tools or network actions. Prompt-injection phrases are recorded as security signals, not executed.

Only required context is sent and fields are capped. OAuth tokens, credentials, other tenant data, and hidden chain-of-thought are never included. UI evidence is limited to short observable reasons.

## Cost control

- Content hashes cache unchanged analyses.
- Deterministic overrides skip AI.
- Clearly low/high results skip AI; ambiguous 32–82 estimates use the configured small model.
- Sync enqueues individual analyses instead of creating a connection-time burst.
- Usage and latency fields support provider cost reporting.
- Retry behavior distinguishes unconfigured, invalid output, 429, and upstream errors.

## AI authorship principle

`ai_assistance_probability` is persisted but has no scoring weight. A high-quality AI-assisted investor email and equivalent low-probability email produce the same score. User language uses “likely AI-assisted” or “template signals,” never objective authorship claims.

## Evaluation

`tests/attention-engine.test.ts` contains labeled cases for active customers, excellent AI-assisted communication, generic outreach, security alerts, injection, and outgoing messages. Expand this into a versioned offline dataset containing investor, recruiter, newsletter, transactional, personal, phishing, follow-up, and false-negative severity labels. Track per-category precision/recall, false-negative cost, and calibration—not only aggregate accuracy.
