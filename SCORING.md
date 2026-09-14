# Attention scoring

## Semantics

Attention Score is a 0–100 model estimate of whether a message deserves this user’s attention. It is not objective truth, sender worth, morality, or authorship detection.

## Version 1

`attention-v1` weights:

| Signal | Weight |
|---|---:|
| Relevance | .22 |
| Context | .16 |
| Relationship | .16 |
| Specificity | .13 |
| User preference | .10 |
| Historical behavior | .10 |
| Intent clarity | .09 |
| Quality | .08 |
| Urgency | .07 |
| Humanity signals | .04 |
| Genericness | -.10 |
| Repetition | -.05 |

The raw weighted result is normalized by positive weight and clamped. AI/deterministic values blend 58/42 for AI-enriched fields. Relationship, user preference, and historical behavior remain deterministic/context-derived. AI assistance probability is not weighted.

## Categories

- `IMPORTANT`: override or score ≥ 88
- `WORTH_READING`: ≥ 70
- `MAYBE_LATER`: ≥ 42
- `LOW_VALUE`: below 42
- `TRANSACTIONAL` and `PROMOTIONAL`: semantic categories for sub-70 automation/promotion

## Overrides

A score floors at 88 for:

- Active conversation with a known relationship
- Urgent customer, investor, or partner communication
- Critical security, fraud, password, payment, or financial notifications

These overrides embody “context wins.” User feedback can also set the visible category and records “Adjusted by you.” Sender always/never-prioritize preferences are persisted for personalization.

## Confidence

Confidence combines classifier confidence and agreement between deterministic/AI relevance. Deterministic-only results intentionally have lower confidence. Confidence is displayed as an estimate and does not hide mail.

## Versioning and calibration

`scoring_versions` stores weights/thresholds. Every `attention_scores` row references a scoring version and model version. New calibration should create a new immutable version, replay a consented/labeled evaluation set, compare catastrophic false negatives, then activate it. Historical scores remain reproducible.