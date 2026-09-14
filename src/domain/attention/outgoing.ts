import type { OutgoingAnalysis, OutgoingInput } from "./types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function analyzeOutgoingDeterministically(input: OutgoingInput): OutgoingAnalysis {
  const text = `${input.subject}\n${input.body}`;
  const words = input.body.split(/\s+/).filter(Boolean);
  const hasAsk = /\?|could you|would you|can you|please|let me know/i.test(text);
  const generic = /hope (this email|you) finds you well|i wanted to reach out|dear sir|synerg|touch base/i.test(text);
  const hasRecipientContext = input.recipientContext.trim().length >= 20;
  const reasonInBody = input.recipientContext
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 5)
    .some((word) => input.body.toLowerCase().includes(word));
  const lengthQuality = words.length >= 25 && words.length <= 300 ? 0.8 : words.length < 10 ? 0.25 : 0.48;

  const specificity = clamp(0.28 + (hasRecipientContext ? 0.28 : 0) + (reasonInBody ? 0.28 : 0) - (generic ? 0.2 : 0));
  const context = clamp(0.2 + (hasRecipientContext ? 0.42 : 0) + (reasonInBody ? 0.25 : 0));
  const intent_clarity = clamp(0.4 + (hasAsk ? 0.35 : 0) + (input.purpose ? 0.15 : 0));
  const relevance = clamp((context + specificity) / 2);
  const genericness = clamp(0.3 + (generic ? 0.42 : 0) - (reasonInBody ? 0.28 : 0));
  const ask_quality = clamp(hasAsk ? 0.65 + (words.length < 300 ? 0.15 : 0) : 0.25);
  const score = Math.round(clamp(
    specificity * 0.22 + context * 0.21 + intent_clarity * 0.18 + relevance * 0.18 + ask_quality * 0.14 + lengthQuality * 0.12 - genericness * 0.12,
  ) * 100);

  const evidence: string[] = [];
  if (!hasRecipientContext) evidence.push("Add why this is relevant to this recipient");
  if (!reasonInBody) evidence.push("The recipient-specific context is not yet visible in the message");
  if (!hasAsk) evidence.push("There is no clear next step or concrete question");
  if (generic) evidence.push("Strong reusable-template language");
  if (words.length > 300) evidence.push("The message may be longer than the ask requires");
  if (!evidence.length) evidence.push("Clear purpose, relevant context, and a concrete ask");

  return {
    communication_score: score,
    specificity,
    context,
    intent_clarity,
    relevance,
    genericness,
    ask_quality,
    evidence,
    suggested_body: null,
  };
}
