import { InboxClient, type InboxItem } from "@/components/inbox-client";
import { requireUserContext } from "@/lib/auth/context";
import type { EmailCategory, SignalSet } from "@/domain/attention";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

const allowedViews = new Set(["WORTH_READING", "MAYBE_LATER", "LOW_VALUE", "EVERYTHING"]);

type Relation<T> = T | T[] | null;
interface AnalysisRow { category: EmailCategory; intent: string; evidence: string[]; concern: string | null; created_at: string }
interface ScoreRow { score: number; confidence: number; category: EmailCategory; reasoning_signals: SignalSet; override_reason: string | null; created_at: string }
interface EmailRow {
  id: string; sender_id: string | null; from_name: string | null; from_email: string; subject: string | null; snippet: string | null; body_text: string | null; sent_at: string; is_read: boolean;
  email_analyses: Relation<AnalysisRow>; attention_scores: Relation<ScoreRow>;
}

function latest<T extends { created_at: string }>(value: Relation<T>): T | null {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ view?: string; message?: string }> }) {
  const context = await requireUserContext();
  const params = await searchParams;
  const view = allowedViews.has(params.view ?? "") ? params.view! : "WORTH_READING";
  const [{ data: rows, error }, { data: connection }] = await Promise.all([
    context.supabase.from("emails").select("id, sender_id, from_name, from_email, subject, snippet, body_text, sent_at, is_read, email_analyses(category,intent,evidence,concern,created_at), attention_scores(score,confidence,category,reasoning_signals,override_reason,created_at)").eq("account_id", context.accountId).eq("direction", "inbound").eq("is_deleted", false).order("sent_at", { ascending: false }).limit(100),
    context.supabase.from("email_accounts").select("id, connection_status, sync_states(phase)").eq("account_id", context.accountId).eq("user_id", context.user.id).limit(1).maybeSingle(),
  ]);
  if (error) throw new Error("Inbox could not be loaded");

  const items = ((rows ?? []) as unknown as EmailRow[]).map((row): InboxItem => {
    const analysis = latest(row.email_analyses);
    const score = latest(row.attention_scores);
    return { id: row.id, senderId: row.sender_id, senderName: row.from_name || row.from_email.split("@")[0], senderEmail: row.from_email, subject: row.subject ?? "", snippet: row.snippet ?? "", body: row.body_text, sentAt: row.sent_at, isRead: row.is_read, score: score?.score ?? null, confidence: score?.confidence ?? null, category: score?.category ?? analysis?.category ?? null, intent: analysis?.intent ?? null, evidence: analysis?.evidence ?? [], concern: analysis?.concern ?? null, signals: score?.reasoning_signals ?? {}, overrideReason: score?.override_reason ?? null };
  }).filter((item) => view === "EVERYTHING" || (view === "LOW_VALUE" ? item.category === "LOW_VALUE" || item.category === "PROMOTIONAL" || item.category === "TRANSACTIONAL" : item.category === view));
  const sync = Array.isArray(connection?.sync_states) ? connection.sync_states[0] : connection?.sync_states;
  return <InboxClient items={items} view={view} initialId={params.message} connection={connection ? { id: connection.id as string, status: connection.connection_status as string, phase: (sync?.phase as string | null) ?? null } : null} />;
}
