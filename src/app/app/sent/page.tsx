import { Send } from "lucide-react";
import { requireUserContext } from "@/lib/auth/context";

export const metadata = { title: "Sent" };
export const dynamic = "force-dynamic";

export default async function SentPage() {
  const context = await requireUserContext();
  const { data: emails } = await context.supabase.from("emails").select("id, to_emails, subject, snippet, sent_at").eq("account_id", context.accountId).eq("direction", "outbound").eq("is_deleted", false).order("sent_at", { ascending: false }).limit(100);
  return <div className="page-scroll"><div className="page-wrap"><header className="page-heading"><p className="eyebrow">Communication sent</p><h1>What crossed the threshold.</h1><p>Messages synchronized from Gmail and explicitly sent through Gated.</p></header><div style={{ borderTop: "1px solid var(--line)" }}>{emails?.map((email) => <article className="email-row" style={{ gridTemplateColumns: "35px 1fr auto" }} key={email.id}><Send size={13} className="muted" /><span className="email-copy"><span className="email-sender">To: {(email.to_emails as string[]).join(", ")}</span><span className="email-subject">{email.subject || "(No subject)"}</span><span className="email-preview">{email.snippet}</span></span><time className="email-time">{new Date(email.sent_at as string).toLocaleDateString([], { month: "short", day: "numeric" })}</time></article>)}</div>{!emails?.length && <div className="empty-view" style={{ minHeight: 300 }}><Send size={23} /><h2>Nothing sent through this layer yet.</h2><p>Write fewer messages. Make the next one matter.</p></div>}</div></div>;
}
