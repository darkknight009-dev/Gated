import { aiSignalsSchema, outgoingAnalysisSchema, type OutgoingInput } from "@/domain/attention";
import { env } from "@/lib/env";
import { AIProviderError, type AIProvider, type AIResult, type EmailClassificationInput } from "./types";
import { INCOMING_PROMPT_VERSION, OUTGOING_PROMPT_VERSION, incomingJsonSchema, incomingPrompt, outgoingJsonSchema, outgoingPrompt } from "./prompt";

export class GoogleProvider implements AIProvider {
  readonly name = "google" as const;
  readonly model = env.GOOGLE_AI_MODEL;

  private async structured<T>(prompt: string, schema: object, parse: (value: unknown) => T, promptVersion: string): Promise<AIResult<T>> {
    if (!env.GOOGLE_AI_API_KEY) throw new AIProviderError("Google AI is not configured", this.name, "unconfigured", false);
    const started = Date.now();
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": env.GOOGLE_AI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new AIProviderError(`Google AI request failed (${response.status})`, this.name, response.status === 429 ? "rate_limited" : "upstream_error", response.status === 429 || response.status >= 500);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    const text = payload.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
    if (!text) throw new AIProviderError("Google AI returned no structured output", this.name, "invalid_output", false);
    try {
      return { data: parse(JSON.parse(text)), usage: { provider: this.name, model: this.model, modelVersion: this.model, promptVersion, inputTokens: payload.usageMetadata?.promptTokenCount, outputTokens: payload.usageMetadata?.candidatesTokenCount, latencyMs: Date.now() - started } };
    } catch {
      throw new AIProviderError("Google AI output failed schema validation", this.name, "invalid_output", false);
    }
  }

  classifyEmail(input: EmailClassificationInput) { return this.structured(incomingPrompt(input), incomingJsonSchema, (v) => aiSignalsSchema.parse(v), INCOMING_PROMPT_VERSION); }
  extractSignals(input: EmailClassificationInput) { return this.classifyEmail(input); }
  async summarizeEmail(): Promise<never> { throw new AIProviderError("Summarization is deliberately not enabled in the v1 pipeline", this.name, "unconfigured", false); }
  analyzeOutgoing(input: OutgoingInput) { return this.structured(outgoingPrompt(input), outgoingJsonSchema, (v) => outgoingAnalysisSchema.parse(v), OUTGOING_PROMPT_VERSION); }
  suggestImprovement(input: OutgoingInput) { return this.analyzeOutgoing(input); }
}
