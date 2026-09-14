import type { AISignals, AttentionDecision, DeterministicResult, SignalSet } from "./types";

export const SCORING_VERSION = "attention-v1" as const;

export const SCORING_WEIGHTS: Record<keyof SignalSet, number> = {
  relevance: 0.22,
  specificity: 0.13,
  context: 0.16,
  intent_clarity: 0.09,
  relationship: 0.16,
  humanity_signals: 0.04,
  quality: 0.08,
  urgency: 0.07,
  genericness: -0.1,
  repetition: -0.05,
  user_preference: 0.1,
  historical_behavior: 0.1,
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const blend = (deterministic: number, ai: number | undefined) =>
  ai === undefined ? deterministic : deterministic * 0.42 + ai * 0.58;

export function mergeSignals(deterministic: SignalSet, ai?: AISignals | null): SignalSet {
  if (!ai) return deterministic;
  return {
    ...deterministic,
    relevance: blend(deterministic.relevance, ai.relevance),
    specificity: blend(deterministic.specificity, ai.specificity),
    context: blend(deterministic.context, ai.context),
    intent_clarity: blend(deterministic.intent_clarity, ai.intent_clarity),
    humanity_signals: blend(deterministic.humanity_signals, ai.humanity_signals),
    quality: blend(deterministic.quality, ai.quality),
    urgency: blend(deterministic.urgency, ai.urgency),
    genericness: blend(deterministic.genericness, ai.genericness),
  };
}

export function calculateAttentionDecision(
  deterministic: DeterministicResult,
  ai?: AISignals | null,
): AttentionDecision {
  const signals = mergeSignals(deterministic.signals, ai);
  const positiveWeight = Object.values(SCORING_WEIGHTS).filter((weight) => weight > 0).reduce((a, b) => a + b, 0);
  const raw = Object.entries(SCORING_WEIGHTS).reduce(
    (total, [key, weight]) => total + signals[key as keyof SignalSet] * weight,
    0,
  );
  let score = Math.round(clamp(raw / positiveWeight) * 100);

  if (deterministic.overrideReason) score = Math.max(score, 88);

  let category: AttentionDecision["category"];
  if (deterministic.overrideReason || score >= 88) category = "IMPORTANT";
  else if (deterministic.isTransactional && score < 70) category = "TRANSACTIONAL";
  else if (deterministic.isPromotional && score < 70) category = "PROMOTIONAL";
  else if (score >= 70) category = "WORTH_READING";
  else if (score >= 42) category = "MAYBE_LATER";
  else category = "LOW_VALUE";

  const evidence = [...(ai?.evidence ?? []), ...deterministic.evidence]
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 5);
  const sourceAgreement = ai
    ? 1 - Math.abs(deterministic.signals.relevance - ai.relevance) * 0.35
    : 0.58;
  const confidence = clamp((ai?.confidence ?? 0.55) * 0.65 + sourceAgreement * 0.35);

  return {
    score,
    confidence,
    category,
    signals,
    intent: ai?.intent ?? deterministic.intent,
    evidence,
    concern: ai?.concern ?? deterministic.concern,
    overrideReason: deterministic.overrideReason,
    scoringVersion: SCORING_VERSION,
  };
}

export function shouldUseAI(deterministic: DeterministicResult): boolean {
  if (deterministic.overrideReason) return false;
  const approximate = calculateAttentionDecision(deterministic).score;
  return approximate >= 32 && approximate <= 82;
}
