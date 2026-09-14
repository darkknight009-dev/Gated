import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { gmail } from "@/lib/gmail/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ draftId: z.string().uuid(), approved: z.literal(true) });
const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "send", 20, 60);
    const input = schema.parse(await request.json());
    const { data: draft } = await context.supabase.from("outgoing_drafts").select("id, email_account_id, to_emails, cc_emails, subject, body_text, status").eq("id", input.draftId).eq("account_id", context.accountId).eq("user_id", context.user.id).single();
    if (!draft || !draft.email_account_id) return Response.json({ error: "draft_not_sendable" }, { status: 409 });
    if (draft.status === "sent") return Response.json({ error: "already_sent" }, { status: 409 });
    const recipients = z.array(z.string().email()).min(1).max(20).parse(draft.to_emails);
    const cc = z.array(z.string().email()).max(20).parse(draft.cc_emails ?? []);
    const mime = [`To: ${recipients.map(cleanHeader).join(", ")}`, cc.length ? `Cc: ${cc.map(cleanHeader).join(", ")}` : null, `Subject: ${cleanHeader(String(draft.subject ?? ""))}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", String(draft.body_text)].filter((line) => line !== null).join("\r\n");
    const raw = Buffer.from(mime, "utf8").toString("base64url");
    const result = await gmail.send(draft.email_account_id as string, raw);
    const admin = createSupabaseAdminClient();
    await admin.from("outgoing_drafts").update({ status: "sent", gmail_message_id: result.id, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", input.draftId);
    await admin.from("audit_events").insert({ account_id: context.accountId, actor_user_id: context.user.id, event_type: "email.sent", target_type: "outgoing_draft", target_id: input.draftId, metadata: { recipient_count: recipients.length + cc.length } });
    return Response.json({ sent: true, messageId: result.id });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "send_failed" }, { status: 502 });
  }
}
