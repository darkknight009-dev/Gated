import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  role: z.enum(["Founder", "Investor", "Recruiter", "Executive", "Creator", "Other"]),
  highPriority: z.array(z.string().trim().min(1).max(60)).max(12),
  lowPriority: z.array(z.string().trim().min(1).max(60)).max(12),
  interests: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  customContext: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    const input = schema.parse(await request.json());
    const admin = createSupabaseAdminClient();
    await Promise.all([
      admin.from("users").update({ role_title: input.role, onboarding_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", context.user.id),
      admin.from("user_preferences").upsert({ account_id: context.accountId, user_id: context.user.id, high_priority_topics: input.highPriority, low_priority_topics: input.lowPriority, custom_context: input.customContext, updated_at: new Date().toISOString() }, { onConflict: "account_id,user_id" }),
      admin.from("product_events").insert({ account_id: context.accountId, user_id: context.user.id, name: "onboarding_started", properties: { completed: true } }),
    ]);
    await admin.from("user_interests").delete().eq("account_id", context.accountId).eq("user_id", context.user.id).eq("source", "onboarding");
    if (input.interests.length) await admin.from("user_interests").insert(input.interests.map((label) => ({ account_id: context.accountId, user_id: context.user.id, label, weight: 0.7, source: "onboarding" })));
    return Response.json({ completed: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_preferences" }, { status: 400 });
    return Response.json({ error: "onboarding_failed" }, { status: 503 });
  }
}
