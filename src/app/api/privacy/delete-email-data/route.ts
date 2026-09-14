import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function DELETE() {
  try {
    const context = await requireUserContext();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("emails").delete().eq("account_id", context.accountId);
    if (error) throw error;
    await admin.from("audit_events").insert({ account_id: context.accountId, actor_user_id: context.user.id, event_type: "email_data.deleted", target_type: "account", target_id: context.accountId, metadata: {} });
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ error: "deletion_failed" }, { status: 500 });
  }
}
