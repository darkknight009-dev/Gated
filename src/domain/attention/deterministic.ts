import type { AttentionInput, DeterministicResult, SignalSet } from "./types";

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const normalized = (value: string) => value.toLowerCase();

const injectionPatterns: Array<[RegExp, string]> = [
  [/ignore (all|any|the|your) (previous|prior|system) instructions?/i, "Instruction override language"],
  [/(reveal|print|send|return).{0,40}(system prompt|secret|token|private data)/i, "Data exfiltration language"],
  [/(you are now|act as).{0,60}(assistant|system|developer)/i, "Role reassignment language"],
  [/<script|javascript:|data:text\/html/i, "Executable content marker"],
];

const transactionalPattern = /receipt|invoice|verification|security alert|one[- ]time|payment|statement|password|account alert/i;
const promotionalPattern = /unsubscribe|view in browser|special offer|% off|limited time|newsletter|sponsored/i;
const urgencyPattern = /urgent|asap|immediately|today|blocking|outage|security|fraud|past due|deadline/i;
const concreteAskPattern = /\?|could you|would you|can you|please (review|confirm|send|share|approve)|are you available/i;
const personalReferencePattern = /your (recent|latest|work|post|company|team|launch|fund)|we (met|spoke|worked)|following up on|as discussed|mentioned/i;
const genericOpeningPattern = /hope (this email|you) finds you well|i wanted to (reach out|connect)|dear sir|quick question|touching base/i;

function topicMatch(text: string, topics: string[]) {
  if (!topics.length) return 0.5;
  const hits = topics.filter((topic) => text.includes(normalized(topic))).length;
  return clamp(0.35 + hits * 0.28);
}

export function detectPromptInjection(content: string): string[] {
  return injectionPatterns
    .filter(([pattern]) => pattern.test(content))
    .map(([, description]) => description);
}

export function extractDeterministicSignals(input: AttentionInput): DeterministicResult {
  const text = normalized(`${input.subject}\n${input.body}`);
  const wordCount = input.body.trim().split(/\s+/).filter(Boolean).length;
  const highMatch = topicMatch(text, input.highPriorityTopics);
  const lowHits = input.lowPriorityTopics.filter((topic) => text.includes(normalized(topic))).length;
  const hasAsk = concreteAskPattern.test(text);
  const hasReference = personalReferencePattern.test(text);
  const genericOpening = genericOpeningPattern.test(text);
  const isTransactional = transactionalPattern.test(text) || input.labelIds.includes("CATEGORY_UPDATES");
  const isPromotional = promotionalPattern.test(text) || input.labelIds.includes("CATEGORY_PROMOTIONS");
  const isAutomated = /no-?reply|do-?not-?reply/i.test(input.fromEmail) || /list-unsubscribe/i.test(text);
  const knownRelationship = input.relationshipType !== "unknown";
  const threadContext = input.activeConversation || input.userHasReplied;
  const injectionSignals = detectPromptInjection(`${input.subject}\n${input.body}`);

  const signals: SignalSet = {
    relevance: clamp(highMatch - lowHits * 0.22 + (threadContext ? 0.18 : 0)),
    specificity: clamp(0.28 + (hasReference ? 0.36 : 0) + (hasAsk ? 0.14 : 0) - (genericOpening ? 0.18 : 0)),
    context: clamp(0.24 + (hasReference ? 0.25 : 0) + (input.threadMessageCount > 1 ? 0.25 : 0) + (threadContext ? 0.2 : 0)),
    intent_clarity: clamp(0.35 + (hasAsk ? 0.35 : 0) + (input.subject.length > 4 ? 0.12 : 0)),
    relationship: clamp((knownRelationship ? 0.5 : 0.15) + input.historicalImportance * 0.25 + input.responseRate * 0.2 + (threadContext ? 0.18 : 0)),
    humanity_signals: clamp(0.55 + (hasReference ? 0.18 : 0) - (isAutomated ? 0.25 : 0) - (genericOpening ? 0.12 : 0)),
    quality: clamp(0.38 + (wordCount >= 20 && wordCount <= 450 ? 0.22 : 0) + (hasAsk ? 0.16 : 0) - (wordCount > 900 ? 0.2 : 0)),
    urgency: clamp(urgencyPattern.test(text) ? 0.82 : 0.22),
    genericness: clamp(0.3 + (genericOpening ? 0.35 : 0) + (isPromotional ? 0.2 : 0) - (hasReference ? 0.28 : 0)),
    repetition: clamp(input.repeatedSimilarMessages * 0.25),
    user_preference: clamp(0.5 + (highMatch - 0.5) * 0.8 - lowHits * 0.25),
    historical_behavior: clamp(input.historicalImportance * 0.55 + input.responseRate * 0.45),
  };

  let overrideReason: string | null = null;
  if (threadContext && knownRelationship) overrideReason = "Active conversation with a known sender";
  if (knownRelationship && ["customer", "investor", "partner"].includes(input.relationshipType) && signals.urgency > 0.7) {
    overrideReason = `Urgent message from an existing ${input.relationshipType}`;
  }
  if (isTransactional && /security|fraud|password|payment|past due/i.test(text)) {
    overrideReason = "Critical account, security, or financial notification";
  }

  const evidence: string[] = [];
  if (hasReference) evidence.push("References specific context");
  if (hasAsk) evidence.push("Contains a concrete question or request");
  if (threadContext) evidence.push("Part of an active conversation");
  if (knownRelationship) evidence.push("Known sender relationship");
  if (highMatch > 0.6) evidence.push("Matches your stated priorities");
  if (isTransactional) evidence.push("Transactional message");
  if (!evidence.length) evidence.push("Limited recipient-specific context found");

  return {
    signals,
    intent: isTransactional ? "transactional" : isPromotional ? "promotion" : hasAsk ? "request" : "informational",
    evidence: evidence.slice(0, 5),
    concern: genericOpening ? "Generic opening language" : isPromotional ? "Promotional pattern" : null,
    injectionSignals,
    isAutomated,
    isTransactional,
    isPromotional,
    overrideReason,
  };
}
