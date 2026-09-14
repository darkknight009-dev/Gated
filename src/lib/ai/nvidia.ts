import { aiSignalsSchema, outgoingAnalysisSchema, type OutgoingInput } from "@/domain/attention";
import { env } from "@/lib/env";
import { AIProviderError, type AIProvider, type AIResult, type EmailClassificationInput } from "./types";
import { INCOMING_PROMPT_VERSION, OUTGOING_PROMPT_VERSION, incomingPrompt, outgoingPrompt } from "./prompt";

const NVIDIA_CHAT_COMPLETIONS_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function configuredModels() {
  return env.NVIDIA_MODELS.split(",").map((model) => model.trim()).filter(Boolean);
}

function jsonInstruction(schemaName: string) {
  return `Return only valid JSON for ${schemaName}. Do not wrap it in markdown, prose, or code fences.`;
}

function parseJsonText(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return JSON.parse(trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  }
  return JSON.parse(trimmed);
}

export class NvidiaProvider implements AIProvider {
  readonly name = "nvidia" as const;
  readonly model = configuredModels()[0] ?? "nvidia/llama-3.3-nemotron-super-49b-v1.5";

  private async structured<T>(
    prompt: string,
    schemaName: string,
    parse: (value: unknown) => T,
    promptVersion: string,
  ): Promise<AIResult<T>> {
    if (!env.NVIDIA_API_KEY) throw new AIProviderError("NVIDIA AI is not configured", this.name, "unconfigured", false);

    const models = configuredModels();
    if (models.length === 0) throw new AIProviderError("No NVIDIA models are configured", this.name, "unconfigured", false);

    let lastError: AIProviderError | null = null;

    for (const model of models) {
      const started = Date.now();
      const response = await fetch(NVIDIA_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: jsonInstruction(schemaName) },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 1600,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        lastError = new AIProviderError(
          `NVIDIA request failed for ${model} (${response.status})`,
          this.name,
          response.status === 429 ? "rate_limited" : "upstream_error",
          response.status === 429 || response.status >= 500,
        );
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }

      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = payload.choices?.[0]?.message?.content;
      if (!text) {
        lastError = new AIProviderError(`NVIDIA returned no structured output for ${model}`, this.name, "invalid_output", false);
        continue;
      }

      try {
        return {
          data: parse(parseJsonText(text)),
          usage: {
            provider: this.name,
            model,
            modelVersion: model,
            promptVersion,
            inputTokens: payload.usage?.prompt_tokens,
            outputTokens: payload.usage?.completion_tokens,
            latencyMs: Date.now() - started,
          },
        };
      } catch {
        lastError = new AIProviderError(`NVIDIA output failed schema validation for ${model}`, this.name, "invalid_output", false);
      }
    }

    throw lastError ?? new AIProviderError("NVIDIA request failed", this.name, "upstream_error", true);
  }

  classifyEmail(input: EmailClassificationInput) {
    return this.structured(incomingPrompt(input), "gated_email_signals", (value) => aiSignalsSchema.parse(value), INCOMING_PROMPT_VERSION);
  }

  extractSignals(input: EmailClassificationInput) {
    return this.classifyEmail(input);
  }

  async summarizeEmail(): Promise<never> {
    throw new AIProviderError("Summarization is deliberately not enabled in the v1 pipeline", this.name, "unconfigured", false);
  }

  analyzeOutgoing(input: OutgoingInput) {
    return this.structured(outgoingPrompt(input), "gated_outgoing_analysis", (value) => outgoingAnalysisSchema.parse(value), OUTGOING_PROMPT_VERSION);
  }

  suggestImprovement(input: OutgoingInput) {
    return this.analyzeOutgoing(input);
  }
}
