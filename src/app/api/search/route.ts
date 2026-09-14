import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";

const querySchema = z.string().trim().min(2).max(200);

export async function GET(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "search", 30, 60);
    const query = querySchema.parse(new URL(request.url).searchParams.get("q"));
    const { data: ranked, error: searchError } = await context.supabase.rpc("search_emails", { p_query: query, p_account_id: context.accountId, p_limit: 50 });
    if (searchError) throw searchError;
    const ids = (ranked ?? []).map((result: { email_id: string }) => result.email_id);
    if (!ids.length) return Response.json({ results: [] });
    const { data, error } = await context.supabase.from("emails").select("id, from_name, from_email, subject, snippet, sent_at, attention_scores(score,category,created_at), email_analyses(intent,created_at)").eq("account_id", context.accountId).in("id", ids);
    if (error) throw error;
    const byId = new Map((data ?? []).map((email) => [email.id, email]));
    return Response.json({ results: ids.map((id: string) => byId.get(id)).filter(Boolean) });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_query" }, { status: 400 });
    return Response.json({ error: "search_unavailable" }, { status: 503 });
  }
}
