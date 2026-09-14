import { env } from "@/lib/env";
import type { AIProvider } from "./types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";

export function getAIProvider(): AIProvider {
  if (env.AI_PROVIDER === "anthropic") return new AnthropicProvider();
  if (env.AI_PROVIDER === "google") return new GoogleProvider();
  return new OpenAIProvider();
}

export * from "./types";
export * from "./prompt";
