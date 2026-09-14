import { aiSignalsSchema, outgoingAnalysisSchema, type OutgoingInput } from "@/domain/attention";
import { env } from "@/lib/env";
import { AIProviderError, type AIProvider, type AIResult, type EmailClassificationInput } from "./types";
import { INCOMING_PROMPT_VERSION, OUTGOING_PROMPT_VERSION, incomingJsonSchema, incomingPrompt, outgoingJsonSchema, outgoingPrompt } from "./prompt";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly model = env.OPENAI_MODEL;

  private async structured<T>(prompt: string, schema: object, schemaName: string, parse: (value: unknown) => T, promptVersion: string): Promise<AIResult<T>> {
    if (!env.OPENAI_API_KEY) throw new AIProviderError("OpenAI is not configured", this.name, "unconfigured", false);
    const started = Date.now();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, input: prompt, store: false, text: { format: { type: "json_schema", name: schemaName, strict: true, schema } } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new AIProviderError(`OpenAI request failed (${response.status})`, this.name, response.status === 429 ? "rate_limited" : "upstream_error", response.status === 429 || response.status >= 500);
    const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = payload.output_text ?? payload.output?.flatMap((item) => item.content ?? []).find((item) => item.text)?.text;
    if (!text) throw new AIProviderError("OpenAI returned no structured output", this.name, "invalid_output", false);
    try {
      return { data: parse(JSON.parse(text)), usage: { provider: this.name, model: this.model, modelVersion: this.model, promptVersion, inputTokens: payload.usage?.input_tokens, outputTokens: payload.usage?.output_tokens, latencyMs: Date.now() - started } };
    } catch {
      throw new AIProviderError("OpenAI output failed schema validation", this.name, "invalid_output", false);
    }
  }

  classifyEmail(input: EmailClassificationInput) { return this.structured(incomingPrompt(input), incomingJsonSchema, "gated_email_signals", (v) => aiSignalsSchema.parse(v), INCOMING_PROMPT_VERSION); }
  extractSignals(input: EmailClassificationInput) { return this.classifyEmail(input); }
  async summarizeEmail(): Promise<never> { throw new AIProviderError("Summarization is deliberately not enabled in the v1 pipeline", this.name, "unconfigured", false); }
  analyzeOutgoing(input: OutgoingInput) { return this.structured(outgoingPrompt(input), outgoingJsonSchema, "gated_outgoing_analysis", (v) => outgoingAnalysisSchema.parse(v), OUTGOING_PROMPT_VERSION); }
  suggestImprovement(input: OutgoingInput) { return this.analyzeOutgoing(input); }
}
