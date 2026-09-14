import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { stableHash } from "./crypto";

export class RateLimitError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Rate limit exceeded");
  }
}

export async function enforceRateLimit(identifier: string, action: string, limit: number, windowSeconds: number) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("consume_rate_limit", {
    p_key_hash: stableHash(`${action}:${identifier}`),
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error("Rate limiter unavailable");
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) throw new RateLimitError(result?.retry_after_seconds ?? windowSeconds);
  return result as { allowed: boolean; remaining: number; retry_after_seconds: number };
}
