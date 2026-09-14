import { aiSignalsSchema, outgoingAnalysisSchema, type OutgoingInput } from "@/domain/attention";
import { env } from "@/lib/env";
import { AIProviderError, type AIProvider, type AIResult, type EmailClassificationInput } from "./types";
import { INCOMING_PROMPT_VERSION, OUTGOING_PROMPT_VERSION, incomingJsonSchema, incomingPrompt, outgoingJsonSchema, outgoingPrompt } from "./prompt";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic" as const;
  readonly model = env.ANTHROPIC_MODEL;

  private async structured<T>(prompt: string, schema: object, parse: (value: unknown) => T, promptVersion: string): Promise<AIResult<T>> {
    if (!env.ANTHROPIC_API_KEY) throw new AIProviderError("Anthropic is not configured", this.name, "unconfigured", false);
    const started = Date.now();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, max_tokens: 1400, messages: [{ role: "user", content: prompt }], output_config: { format: { type: "json_schema", schema } } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new AIProviderError(`Anthropic request failed (${response.status})`, this.name, response.status === 429 ? "rate_limited" : "upstream_error", response.status === 429 || response.status >= 500);
    const payload = await response.json() as { content?: Array<{ type: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = payload.content?.find((item) => item.type === "text")?.text;
    if (!text) throw new AIProviderError("Anthropic returned no structured output", this.name, "invalid_output", false);
    try {
      return { data: parse(JSON.parse(text)), usage: { provider: this.name, model: this.model, modelVersion: this.model, promptVersion, inputTokens: payload.usage?.input_tokens, outputTokens: payload.usage?.output_tokens, latencyMs: Date.now() - started } };
    } catch {
      throw new AIProviderError("Anthropic output failed schema validation", this.name, "invalid_output", false);
    }
  }

  classifyEmail(input: EmailClassificationInput) { return this.structured(incomingPrompt(input), incomingJsonSchema, (v) => aiSignalsSchema.parse(v), INCOMING_PROMPT_VERSION); }
  extractSignals(input: EmailClassificationInput) { return this.classifyEmail(input); }
  async summarizeEmail(): Promise<never> { throw new AIProviderError("Summarization is deliberately not enabled in the v1 pipeline", this.name, "unconfigured", false); }
  analyzeOutgoing(input: OutgoingInput) { return this.structured(outgoingPrompt(input), outgoingJsonSchema, (v) => outgoingAnalysisSchema.parse(v), OUTGOING_PROMPT_VERSION); }
  suggestImprovement(input: OutgoingInput) { return this.analyzeOutgoing(input); }
}
