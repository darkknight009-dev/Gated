import { BarChart3 } from "lucide-react";
import { requireUserContext } from "@/lib/auth/context";
import { daysAgoIso } from "@/lib/time";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const context = await requireUserContext();
  const since = daysAgoIso(7);
  const { data: emails, error } = await context.supabase.from("emails").select("id, attention_scores(score,category,created_at)").eq("account_id", context.accountId).eq("direction", "inbound").eq("is_deleted", false).gte("sent_at", since).limit(5000);
  if (error) throw new Error("Analytics could not be loaded");
  const categories: Record<string, number> = {};
  let analyzed = 0;
  for (const email of emails ?? []) {
    const rows = Array.isArray(email.attention_scores) ? email.attention_scores : [];
    const latest = rows.sort((a,b) => Date.parse(String(b.created_at))-Date.parse(String(a.created_at)))[0];
    if (latest) { analyzed += 1; categories[String(latest.category)] = (categories[String(latest.category)] ?? 0) + 1; }
  }
  const filtered = (categories.LOW_VALUE ?? 0) + (categories.PROMOTIONAL ?? 0) + (categories.TRANSACTIONAL ?? 0);
  const estimatedMinutes = Math.round(filtered * 0.45);
  const metrics = [["Received", emails?.length ?? 0, "last 7 days"], ["Worth attention", (categories.WORTH_READING ?? 0) + (categories.IMPORTANT ?? 0), "model estimate"], ["De-emphasized", filtered, "still in Everything"], ["Attention filtered", estimatedMinutes ? `~${estimatedMinutes}m` : "—", "estimate · 27 sec/message"]];
  return <div className="page-scroll"><div className="page-wrap"><header className="page-heading"><p className="eyebrow">This week</p><h1>Your attention, accounted for.</h1><p>Trends from synchronized messages. Time figures are estimates—not scientific measurements.</p></header>
    <div className="analytics-grid">{metrics.map(([label,value,note]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
    <section style={{ marginTop: 42 }}><p className="eyebrow">Signal distribution</p><div className="layers" style={{ marginTop: 15 }}>{[["Worth Reading", categories.WORTH_READING ?? 0], ["Important", categories.IMPORTANT ?? 0], ["Maybe Later", categories.MAYBE_LATER ?? 0], ["Low Value", categories.LOW_VALUE ?? 0], ["Promotional / Transactional", (categories.PROMOTIONAL ?? 0)+(categories.TRANSACTIONAL ?? 0)]].map(([label,value]) => <div className="layer" style={{ gridTemplateColumns: "1fr 90px", padding: "16px 0" }} key={label}><h3 style={{ fontSize: 12 }}>{label}</h3><span style={{ textAlign: "right", font: "12px var(--font-mono)" }}>{value}</span></div>)}</div></section>
    {!analyzed && <div className="empty-view" style={{ minHeight: 220 }}><BarChart3 size={23} /><h2>No scored messages this week.</h2><p>Analytics will become useful after synchronization and analysis complete.</p></div>}
  </div></div>;
}
