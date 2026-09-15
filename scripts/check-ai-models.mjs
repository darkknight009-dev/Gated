#!/usr/bin/env node
/**
 * Model health check for the NVIDIA provider.
 *
 * Models are retired without notice (the API returns 404/410), and a slow or
 * uncooperative model silently degrades every analysis to deterministic-only.
 * Run this after changing NVIDIA_MODELS:
 *
 *   npm run check:models                  # checks the configured list
 *   npm run check:models -- a/b c/d       # checks specific candidates
 */
const key = process.env.NVIDIA_API_KEY;
if (!key) {
  console.error("NVIDIA_API_KEY is required. Run with --env-file=.env.");
  process.exit(1);
}

const candidates = process.argv.slice(2).filter(Boolean);
const configured = (process.env.NVIDIA_MODELS ?? "").split(",").map((model) => model.trim()).filter(Boolean);
const models = candidates.length ? candidates : configured;
if (!models.length) {
  console.error("No models to check. Set NVIDIA_MODELS or pass model names as arguments.");
  process.exit(1);
}

const timeoutMs = Number(process.env.NVIDIA_TIMEOUT_MS ?? 60_000);
const maxTokens = Number(process.env.NVIDIA_MAX_TOKENS ?? 1600);
const body = "Can you confirm whether the deployment blocker is resolved before Thursday? ".repeat(40);
const systemPrompt = 'Return only valid JSON for gated_email_signals with keys intent, relevance, specificity, context, intent_clarity, humanity_signals, quality, urgency, genericness, ai_assistance_probability, confidence, evidence, concern. Never repeat the email content. Do not wrap it in markdown.';

console.log(`Checking ${models.length} model(s) with a ${timeoutMs / 1000}s timeout and max_tokens=${maxTokens}\n`);

for (const model of models) {
  const started = Date.now();
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `<untrusted_email>\n<subject>Re: launch blocker</subject>\n<body>${body}</body>\n</untrusted_email>` },
        ],
        temperature: 0.1,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    if (!response.ok) {
      console.log(`✗ ${model.padEnd(42)} ${response.status} in ${elapsed}s`);
      continue;
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? "";
    const finish = payload.choices?.[0]?.finish_reason;
    let verdict = "valid JSON";
    try {
      const parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      verdict = Object.hasOwn(parsed, "relevance") ? "valid JSON, correct keys" : "valid JSON, WRONG keys";
    } catch {
      verdict = "NOT parseable JSON";
    }
    console.log(`${finish === "length" ? "!" : "✓"} ${model.padEnd(42)} ${elapsed}s  finish=${finish}  ${verdict}`);
  } catch (error) {
    console.log(`✗ ${model.padEnd(42)} FAILED in ${((Date.now() - started) / 1000).toFixed(1)}s  ${error.name}: ${error.message}`);
  }
}

console.log("\nKeep only models that report ✓ with a low latency and correct keys. Order them fastest first.");