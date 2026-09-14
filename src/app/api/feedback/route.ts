import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requestId } from "@/lib/observability/logger";

const schema = z.object({
  emailId: z.string().uuid(),
  action: z.enum(["IMPORTANT", "NOT_IMPORTANT", "WORTH_READING", "MAYBE_LATER", "LOW_VALUE", "ALWAYS_PRIORITIZE_SENDER", "NEVER_PRIORITIZE_SENDER"]),
});

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "feedback", 60, 60);
    const input = schema.parse(await request.json());
    const { data: email } = await context.supabase.from("emails").select("id, sender_id, attention_scores(id, category, created_at)").eq("id", input.emailId).eq("account_id", context.accountId).single();
    if (!email) return Response.json({ error: "not_found" }, { status: 404 });
    const scores = Array.isArray(email.attention_scores) ? email.attention_scores : [];
    const latest = scores.sort((a, b) => Date.parse(String(b.created_at)) - Date.parse(String(a.created_at)))[0];
    const admin = createSupabaseAdminClient();
    await admin.from("feedback_events").insert({ account_id: context.accountId, user_id: context.user.id, email_id: input.emailId, sender_id: email.sender_id, action: input.action, previous_category: latest?.category ?? null, metadata: {} });
    if (input.action === "ALWAYS_PRIORITIZE_SENDER" || input.action === "NEVER_PRIORITIZE_SENDER") {
      if (!email.sender_id) return Response.json({ error: "sender_unavailable" }, { status: 409 });
      await admin.from("sender_preferences").upsert({ account_id: context.accountId, user_id: context.user.id, sender_id: email.sender_id, priority_adjustment: input.action === "ALWAYS_PRIORITIZE_SENDER" ? 100 : -100, always_prioritize: input.action === "ALWAYS_PRIORITIZE_SENDER", never_prioritize: input.action === "NEVER_PRIORITIZE_SENDER", updated_at: new Date().toISOString() }, { onConflict: "account_id,user_id,sender_id" });
    } else if (latest?.id) {
      const category = input.action === "IMPORTANT" ? "IMPORTANT" : input.action === "NOT_IMPORTANT" ? "LOW_VALUE" : input.action;
      await admin.from("attention_scores").update({ category, override_reason: "Adjusted by you" }).eq("id", latest.id);
    }
    await admin.from("product_events").insert({ account_id: context.accountId, user_id: context.user.id, name: input.action.includes("SENDER") ? "sender_prioritized" : "email_feedback", properties: { action: input.action } });
    await admin.from("audit_events").insert({ account_id: context.accountId, actor_user_id: context.user.id, event_type: "attention.feedback", target_type: "email", target_id: input.emailId, request_id: requestId(request), metadata: { action: input.action } });
    return Response.json({ accepted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(error.retryAfter) } });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "feedback_unavailable" }, { status: 503 });
  }
}
