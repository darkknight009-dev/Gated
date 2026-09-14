import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/security/crypto";
import { requestId } from "@/lib/observability/logger";

const schema = z.object({ emailAccountId: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    const input = schema.parse(await request.json());
    const { data: owned } = await context.supabase.from("email_accounts").select("id").eq("id", input.emailAccountId).eq("account_id", context.accountId).eq("user_id", context.user.id).single();
    if (!owned) return Response.json({ error: "not_found" }, { status: 404 });
    const admin = createSupabaseAdminClient();
    const { data: credential } = await admin.from("oauth_credentials").select("access_token_ciphertext").eq("email_account_id", input.emailAccountId).maybeSingle();
    if (credential?.access_token_ciphertext) {
      const token = decryptSecret(credential.access_token_ciphertext as string);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    }
    await admin.from("oauth_credentials").delete().eq("email_account_id", input.emailAccountId);
    await admin.from("email_accounts").update({ connection_status: "disconnected", updated_at: new Date().toISOString() }).eq("id", input.emailAccountId);
    await admin.from("audit_events").insert({ account_id: context.accountId, actor_user_id: context.user.id, event_type: "gmail.disconnected", target_type: "email_account", target_id: input.emailAccountId, request_id: requestId(request), metadata: {} });
    return Response.json({ disconnected: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "disconnect_failed" }, { status: 500 });
  }
}
