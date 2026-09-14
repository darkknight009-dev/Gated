import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";

const schema = z.object({
  retentionContentDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).optional(),
  retainAnalysis: z.boolean().optional(),
  analyticsOptIn: z.boolean().optional(),
  highPriority: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  lowPriority: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  customContext: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request) {
  try {
    const context = await requireUserContext();
    const input = schema.parse(await request.json());
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.retentionContentDays !== undefined) update.retention_content_days = input.retentionContentDays;
    if (input.retainAnalysis !== undefined) update.retain_analysis_after_content_deletion = input.retainAnalysis;
    if (input.analyticsOptIn !== undefined) update.analytics_opt_in = input.analyticsOptIn;
    if (input.highPriority !== undefined) update.high_priority_topics = input.highPriority;
    if (input.lowPriority !== undefined) update.low_priority_topics = input.lowPriority;
    if (input.customContext !== undefined) update.custom_context = input.customContext;
    const { error } = await context.supabase.from("user_preferences").update(update).eq("account_id", context.accountId).eq("user_id", context.user.id);
    if (error) throw error;
    return Response.json({ updated: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_preferences" }, { status: 400 });
    return Response.json({ error: "update_failed" }, { status: 503 });
  }
}
