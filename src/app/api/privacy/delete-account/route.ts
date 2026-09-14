import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ confirmation: z.literal("DELETE MY ACCOUNT") });

export async function DELETE(request: Request) {
  try {
    const context = await requireUserContext();
    schema.parse(await request.json());
    const admin = createSupabaseAdminClient();
    await admin.from("audit_events").insert({ account_id: context.accountId, actor_user_id: context.user.id, event_type: "account.deletion_requested", target_type: "user", target_id: context.user.id, metadata: {} });
    const { error } = await admin.auth.admin.deleteUser(context.user.id, false);
    if (error) throw error;
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "confirmation_required" }, { status: 400 });
    return Response.json({ error: "deletion_failed" }, { status: 500 });
  }
}
