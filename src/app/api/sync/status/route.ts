import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import type { SyncStatus } from "@/lib/sync/progress";

export const dynamic = "force-dynamic";

const emailAccountIdSchema = z.string().uuid();

export async function GET(request: Request) {
  try {
    const context = await requireUserContext();
    const emailAccountId = emailAccountIdSchema.parse(new URL(request.url).searchParams.get("emailAccountId"));

    const { data: account } = await context.supabase
      .from("email_accounts")
      .select("id, connection_status, last_synced_at, sync_states(phase, last_error_code, last_successful_sync_at, watch_expires_at)")
      .eq("id", emailAccountId)
      .eq("account_id", context.accountId)
      .eq("user_id", context.user.id)
      .maybeSingle();
    if (!account) return Response.json({ error: "not_found" }, { status: 404 });

    const [synced, analyzed, pending, failed] = await Promise.all([
      context.supabase.from("emails").select("id", { count: "exact", head: true }).eq("account_id", context.accountId).eq("is_deleted", false),
      context.supabase.from("attention_scores").select("id", { count: "exact", head: true }).eq("account_id", context.accountId),
      context.supabase.from("processing_jobs").select("id", { count: "exact", head: true }).eq("account_id", context.accountId).in("status", ["queued", "processing"]),
      context.supabase.from("processing_jobs").select("id", { count: "exact", head: true }).eq("account_id", context.accountId).eq("status", "dead"),
    ]);

    const sync = Array.isArray(account.sync_states) ? account.sync_states[0] : account.sync_states;
    const payload: SyncStatus = {
      phase: (sync?.phase as string | null) ?? null,
      connectionStatus: String(account.connection_status),
      synced: synced.count ?? 0,
      analyzed: analyzed.count ?? 0,
      pending: pending.count ?? 0,
      failed: failed.count ?? 0,
      lastSyncedAt: (account.last_synced_at as string | null) ?? (sync?.last_successful_sync_at as string | null) ?? null,
      watchExpiresAt: (sync?.watch_expires_at as string | null) ?? null,
      hasError: Boolean(sync?.last_error_code),
    };

    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "status_unavailable" }, { status: 503 });
  }
}
