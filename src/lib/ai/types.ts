import type { AISignals, OutgoingAnalysis, OutgoingInput } from "@/domain/attention";

export interface EmailClassificationInput {
  subject: string;
  body: string;
  sender: string;
  recipientProfile: string;
  relationshipContext: string;
  threadContext: string;
}

export interface AIUsage {
  provider: "nvidia";
  model: string;
  modelVersion: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs: number;
}

export interface AIResult<T> {
  data: T;
  usage: AIUsage;
}

export interface AIProvider {
  readonly name: AIUsage["provider"];
  readonly model: string;
  classifyEmail(input: EmailClassificationInput): Promise<AIResult<AISignals>>;
  extractSignals(input: EmailClassificationInput): Promise<AIResult<AISignals>>;
  summarizeEmail(input: EmailClassificationInput): Promise<AIResult<{ summary: string }>>;
  analyzeOutgoing(input: OutgoingInput): Promise<AIResult<OutgoingAnalysis>>;
  suggestImprovement(input: OutgoingInput): Promise<AIResult<OutgoingAnalysis>>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: "unconfigured" | "rate_limited" | "invalid_output" | "upstream_error",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
