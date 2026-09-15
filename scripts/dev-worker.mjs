#!/usr/bin/env node
/**
 * Local stand-in for the production scheduler. The deployed app relies on a scheduled
 * call to /api/jobs/process; nothing is processed without it. Run with:
 *   npm run worker
 */
const baseUrl = (process.env.WORKER_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const secret = process.env.CRON_SECRET;
const IDLE_DELAY_MS = 5_000;
const BUSY_DELAY_MS = 250;

if (!secret) {
  console.error("CRON_SECRET is required. Copy .env.example to .env and set it before running the worker.");
  process.exit(1);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;

process.on("SIGINT", () => { stopping = true; console.log("\nStopping after the current batch…"); });
process.on("SIGTERM", () => { stopping = true; });

console.log(`Gated worker → ${baseUrl}/api/jobs/process (Ctrl+C to stop)`);

while (!stopping) {
  let wait = IDLE_DELAY_MS;
  try {
    const response = await fetch(`${baseUrl}/api/jobs/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (response.ok) {
      const result = await response.json();
      if (result.claimed > 0) {
        console.log(`claimed ${result.claimed} · succeeded ${result.succeeded} · failed ${result.failed}`);
        wait = BUSY_DELAY_MS;
      }
    } else {
      console.error(`worker request rejected (${response.status}). Retrying…`);
    }
  } catch (error) {
    console.error(`worker could not reach ${baseUrl} (${error instanceof Error ? error.message : "unknown"}). Retrying…`);
  }
  if (!stopping) await delay(wait);
}

console.log("Worker stopped.");
