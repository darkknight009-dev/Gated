import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { enqueueJob } from "@/lib/jobs/queue";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { requestId } from "@/lib/observability/logger";

const bodySchema = z.object({ emailAccountId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "sync", 5, 60);
    const input = bodySchema.parse(await request.json());
    const { data: account } = await context.supabase.from("email_accounts").select("id").eq("id", input.emailAccountId).eq("account_id", context.accountId).eq("user_id", context.user.id).single();
    if (!account) return Response.json({ error: "not_found" }, { status: 404 });
    const id = await enqueueJob({ accountId: context.accountId, emailAccountId: input.emailAccountId, type: "incremental_sync", deduplicationKey: `incremental:${input.emailAccountId}`, requestId: requestId(request) });
    return Response.json({ queued: true, jobId: id }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited", retryAfter: error.retryAfter }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "sync_unavailable" }, { status: 503 });
  }
}
