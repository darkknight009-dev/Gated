import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { logger, requestId } from "@/lib/observability/logger";

const envelopeSchema = z.object({ message: z.object({ data: z.string(), messageId: z.string().optional() }), subscription: z.string().optional() });
const notificationSchema = z.object({ emailAddress: z.string().email(), historyId: z.string() });

export async function POST(request: Request) {
  const id = requestId(request);
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  if (!safeEqual(token, env.GOOGLE_PUBSUB_VERIFICATION_TOKEN)) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const envelope = envelopeSchema.parse(await request.json());
    const notification = notificationSchema.parse(JSON.parse(Buffer.from(envelope.message.data, "base64").toString("utf8")));
    const admin = createSupabaseAdminClient();
    const { data: emailAccount } = await admin.from("email_accounts").select("id, account_id").eq("email_address", notification.emailAddress.toLowerCase()).eq("connection_status", "connected").maybeSingle();
    if (emailAccount) await enqueueJob({ accountId: emailAccount.account_id as string, emailAccountId: emailAccount.id as string, type: "incremental_sync", payload: { notifiedHistoryId: notification.historyId }, deduplicationKey: `incremental:${emailAccount.id}`, requestId: id });
    return Response.json({ accepted: true }, { status: 202 });
  } catch (error) {
    logger.warn("pubsub_notification_rejected", { requestId: id, errorCode: error instanceof z.ZodError ? "invalid_payload" : "processing_error" });
    return Response.json({ error: "invalid_notification" }, { status: 400 });
  }
}
