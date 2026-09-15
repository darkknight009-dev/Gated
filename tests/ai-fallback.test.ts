import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailClassificationInput } from "@/lib/ai/types";

const input: EmailClassificationInput = { subject: "Re: launch blocker", body: "Can you confirm the fix?", sender: "ops@customer.test", recipientProfile: "", relationshipContext: "{}", threadContext: "{}" };

const validSignals = {
  intent: "request",
  relevance: 0.8,
  specificity: 0.7,
  context: 0.7,
  intent_clarity: 0.8,
  humanity_signals: 0.6,
  quality: 0.7,
  urgency: 0.5,
  genericness: 0.2,
  ai_assistance_probability: 0.3,
  confidence: 0.8,
  evidence: ["Concrete request"],
  concern: null,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const completion = (content: string) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 11, completion_tokens: 22 } });

function mockFetch(handler: (model: string) => Response) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model as string;
    calls.push(model);
    return handler(model);
  }));
  return calls;
}

async function provider() {
  const providerModule = await import("@/lib/ai/nvidia");
  return new providerModule.NvidiaProvider();
}

describe("NVIDIA model fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NVIDIA_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls through a retired model instead of aborting the whole chain", async () => {
    vi.stubEnv("NVIDIA_MODELS", "retired-model,working-model");
    const calls = mockFetch((model) => model === "retired-model" ? json({ detail: "reached end of life" }, 410) : completion(JSON.stringify(validSignals)));

    const result = await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["retired-model", "working-model"]);
    expect(result.usage.model).toBe("working-model");
    expect(result.data.relevance).toBe(0.8);
  });

  it("falls through an unknown model (404) as well", async () => {
    vi.stubEnv("NVIDIA_MODELS", "missing-model,working-model");
    const calls = mockFetch((model) => model === "missing-model" ? json({ detail: "not found" }, 404) : completion(JSON.stringify(validSignals)));

    await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["missing-model", "working-model"]);
  });

  it("stops immediately on a credential error because every model would fail", async () => {
    vi.stubEnv("NVIDIA_MODELS", "first-model,second-model");
    const calls = mockFetch(() => json({ error: "invalid key" }, 401));

    await expect((await provider()).classifyEmail(input)).rejects.toMatchObject({ code: "upstream_error", retryable: false });
    expect(calls).toEqual(["first-model"]);
  });

  it("tries the next model after a rate limit", async () => {
    vi.stubEnv("NVIDIA_MODELS", "busy-model,working-model");
    const calls = mockFetch((model) => model === "busy-model" ? json({}, 429) : completion(JSON.stringify(validSignals)));

    await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["busy-model", "working-model"]);
  });

  it("reports invalid output only after every model has failed", async () => {
    vi.stubEnv("NVIDIA_MODELS", "a-model,b-model");
    const calls = mockFetch(() => completion("not json at all"));

    await expect((await provider()).classifyEmail(input)).rejects.toMatchObject({ code: "invalid_output", retryable: false });
    expect(calls).toEqual(["a-model", "b-model"]);
  });

  it("rejects output that fails schema validation and moves on", async () => {
    vi.stubEnv("NVIDIA_MODELS", "bad-shape,working-model");
    const calls = mockFetch((model) => model === "bad-shape" ? completion(JSON.stringify({ ...validSignals, relevance: 42 })) : completion(JSON.stringify(validSignals)));

    const result = await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["bad-shape", "working-model"]);
    expect(result.data.relevance).toBe(0.8);
  });

  it("wraps a transport timeout and keeps trying the remaining models", async () => {
    vi.stubEnv("NVIDIA_MODELS", "slow-model,working-model");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      const model = JSON.parse(String(init.body)).model as string;
      calls.push(model);
      if (model === "slow-model") {
        const timeout = new Error("The operation was aborted due to timeout");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      return completion(JSON.stringify(validSignals));
    }));

    const result = await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["slow-model", "working-model"]);
    expect(result.usage.model).toBe("working-model");
  });

  it("reports a retryable upstream error when every model times out", async () => {
    vi.stubEnv("NVIDIA_MODELS", "slow-a,slow-b");
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)).model as string);
      const timeout = new Error("timeout");
      timeout.name = "TimeoutError";
      throw timeout;
    }));

    await expect((await provider()).classifyEmail(input)).rejects.toMatchObject({ code: "upstream_error", retryable: true });
    expect(calls).toEqual(["slow-a", "slow-b"]);
  });

  it("treats an unreadable success body as invalid output and moves on", async () => {
    vi.stubEnv("NVIDIA_MODELS", "broken-model,working-model");
    const calls = mockFetch((model) => model === "broken-model" ? new Response("<html>gateway</html>", { status: 200 }) : completion(JSON.stringify(validSignals)));

    const result = await (await provider()).classifyEmail(input);

    expect(calls).toEqual(["broken-model", "working-model"]);
    expect(result.data.intent).toBe("request");
  });

  it("reports unconfigured when no API key is present", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    vi.stubEnv("NVIDIA_MODELS", "any-model");
    const calls = mockFetch(() => completion(JSON.stringify(validSignals)));

    await expect((await provider()).classifyEmail(input)).rejects.toMatchObject({ code: "unconfigured", retryable: false });
    expect(calls).toEqual([]);
  });

  it("accepts JSON wrapped in a code fence", async () => {
    vi.stubEnv("NVIDIA_MODELS", "working-model");
    mockFetch(() => completion("```json\n" + JSON.stringify(validSignals) + "\n```"));

    const result = await (await provider()).classifyEmail(input);

    expect(result.data.intent).toBe("request");
  });
});
