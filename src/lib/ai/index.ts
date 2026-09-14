import type { AIProvider } from "./types";
import { NvidiaProvider } from "./nvidia";

export function getAIProvider(): AIProvider {
  return new NvidiaProvider();
}

export * from "./types";
export * from "./prompt";
