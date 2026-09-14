import { Users } from "lucide-react";
import { requireUserContext } from "@/lib/auth/context";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const context = await requireUserContext();
  const { data: people, error } = await context.supabase.from("senders").select("id, display_name, email, domain, message_count, reply_count, last_seen_at, sender_relationships(relationship_type, historical_importance)").eq("account_id", context.accountId).order("last_seen_at", { ascending: false }).limit(100);
  if (error) throw new Error("Sender intelligence could not be loaded");
  return <div className="page-scroll"><div className="page-wrap"><header className="page-heading"><p className="eyebrow">Sender intelligence</p><h1>People, not addresses.</h1><p>Private relationship signals from your own communication history. Never a public reputation score.</p></header>
    <div className="people-list">{people?.map((person) => { const relation = Array.isArray(person.sender_relationships) ? person.sender_relationships[0] : person.sender_relationships; return <article className="person-row" key={person.id}><span className="sender-avatar">{(person.display_name || person.email).slice(0,2).toUpperCase()}</span><div><strong>{person.display_name || person.email.split("@")[0]}</strong><span>{person.email}</span></div><div><strong style={{ textTransform: "capitalize" }}>{relation?.relationship_type ?? "Unknown relationship"}</strong><span>{person.domain}</span></div><div style={{ textAlign: "right" }}><strong>{person.message_count}</strong><span>messages</span></div></article>; })}</div>
    {!people?.length && <div className="empty-view" style={{ minHeight: 300 }}><Users size={23} /><h2>No relationships mapped yet.</h2><p>People appear as real messages are synchronized.</p></div>}
  </div></div>;
}
