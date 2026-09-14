import { z } from "zod";
import { requireUserContext, AuthenticationError } from "@/lib/auth/context";
import { gmail } from "@/lib/gmail/client";
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ emailId: z.string().uuid(), action: z.enum(["archive", "trash", "mark_read", "mark_unread"]) });

export async function POST(request: Request) {
  try {
    const context = await requireUserContext();
    await enforceRateLimit(context.user.id, "email_action", 60, 60);
    const input = schema.parse(await request.json());
    const { data: email } = await context.supabase.from("emails").select("id, email_account_id, provider_message_id").eq("id", input.emailId).eq("account_id", context.accountId).single();
    if (!email) return Response.json({ error: "not_found" }, { status: 404 });
    if (input.action === "trash") await gmail.trash(email.email_account_id as string, email.provider_message_id as string);
    else if (input.action === "archive") await gmail.modify(email.email_account_id as string, email.provider_message_id as string, [], ["INBOX"]);
    else if (input.action === "mark_read") await gmail.modify(email.email_account_id as string, email.provider_message_id as string, [], ["UNREAD"]);
    else await gmail.modify(email.email_account_id as string, email.provider_message_id as string, ["UNREAD"], []);
    const admin = createSupabaseAdminClient();
    await admin.from("emails").update({ is_deleted: input.action === "trash", is_read: input.action === "mark_read" ? true : input.action === "mark_unread" ? false : undefined, label_ids: input.action === "archive" ? [] : undefined, updated_at: new Date().toISOString() }).eq("id", input.emailId);
    return Response.json({ completed: true });
  } catch (error) {
    if (error instanceof AuthenticationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (error instanceof RateLimitError) return Response.json({ error: "rate_limited" }, { status: 429 });
    if (error instanceof z.ZodError) return Response.json({ error: "invalid_request" }, { status: 400 });
    return Response.json({ error: "gmail_action_failed" }, { status: 502 });
  }
}
