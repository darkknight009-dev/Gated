import { z } from "zod";

export const emailCategorySchema = z.enum([
  "WORTH_READING",
  "MAYBE_LATER",
  "LOW_VALUE",
  "PROMOTIONAL",
  "TRANSACTIONAL",
  "IMPORTANT",
]);
export type EmailCategory = z.infer<typeof emailCategorySchema>;

const probability = z.number().min(0).max(1);

export const aiSignalsSchema = z.object({
  intent: z.string().min(1).max(80),
  relevance: probability,
  specificity: probability,
  context: probability,
  intent_clarity: probability,
  humanity_signals: probability,
  quality: probability,
  urgency: probability,
  genericness: probability,
  ai_assistance_probability: probability,
  confidence: probability,
  evidence: z.array(z.string().min(1).max(180)).max(5),
  concern: z.string().max(180).nullable(),
});
export type AISignals = z.infer<typeof aiSignalsSchema>;

export const signalSetSchema = z.object({
  relevance: probability,
  specificity: probability,
  context: probability,
  intent_clarity: probability,
  relationship: probability,
  humanity_signals: probability,
  quality: probability,
  urgency: probability,
  genericness: probability,
  repetition: probability,
  user_preference: probability,
  historical_behavior: probability,
});
export type SignalSet = z.infer<typeof signalSetSchema>;

export interface AttentionInput {
  subject: string;
  body: string;
  fromEmail: string;
  labelIds: string[];
  highPriorityTopics: string[];
  lowPriorityTopics: string[];
  relationshipType: string;
  historicalImportance: number;
  responseRate: number;
  threadMessageCount: number;
  userHasReplied: boolean;
  activeConversation: boolean;
  repeatedSimilarMessages: number;
}

export interface DeterministicResult {
  signals: SignalSet;
  intent: string;
  evidence: string[];
  concern: string | null;
  injectionSignals: string[];
  isAutomated: boolean;
  isTransactional: boolean;
  isPromotional: boolean;
  overrideReason: string | null;
}

export interface AttentionDecision {
  score: number;
  confidence: number;
  category: EmailCategory;
  signals: SignalSet;
  intent: string;
  evidence: string[];
  concern: string | null;
  overrideReason: string | null;
  scoringVersion: "attention-v1";
}

export const outgoingInputSchema = z.object({
  to: z.array(z.string().email()).min(1).max(20),
  subject: z.string().trim().min(1).max(998),
  body: z.string().trim().min(1).max(50000),
  purpose: z.enum(["Hiring", "Investment", "Partnership", "Sales", "Networking", "Press", "Feedback", "Other"]),
  recipientContext: z.string().trim().max(2000),
});
export type OutgoingInput = z.infer<typeof outgoingInputSchema>;

export const outgoingAnalysisSchema = z.object({
  communication_score: z.number().int().min(0).max(100),
  specificity: probability,
  context: probability,
  intent_clarity: probability,
  relevance: probability,
  genericness: probability,
  ask_quality: probability,
  evidence: z.array(z.string().min(1).max(180)).max(6),
  suggested_body: z.string().max(50000).nullable(),
});
export type OutgoingAnalysis = z.infer<typeof outgoingAnalysisSchema>;
