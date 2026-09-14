"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { useState } from "react";

interface SearchResult { id: string; from_name: string | null; from_email: string; subject: string | null; snippet: string | null; sent_at: string; attention_scores: Array<{ score: number; category: string; created_at: string }>; email_analyses: Array<{ intent: string; created_at: string }> }

export function SearchClient() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const results = useQuery({ queryKey: ["search", query], enabled: query.length >= 2, queryFn: async () => { const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`); if (!response.ok) throw new Error(response.status === 429 ? "Search is moving too quickly. Wait a moment." : "Search is temporarily unavailable."); return response.json() as Promise<{ results: SearchResult[] }>; } });
  return <div className="page-scroll"><div className="page-wrap">
    <header className="page-heading"><p className="eyebrow">Mailbox search</p><h1>Find the signal.</h1><p>Search sender, subject, and retained content. Try a person, domain, intent, or phrase.</p></header>
    <form onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); }} style={{ display: "flex", gap: 8 }}><div style={{ position: "relative", flex: 1 }}><Search size={15} style={{ position: "absolute", left: 13, top: 14, color: "var(--muted)" }} /><input className="input" style={{ paddingLeft: 38 }} autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search your inbox…" aria-label="Search inbox" /></div><button className="btn btn-primary" type="submit">Search</button></form>
    <div style={{ marginTop: 30, borderTop: "1px solid var(--line)" }}>{results.isFetching && <div className="empty-view" style={{ minHeight: 180 }}><p>Searching retained messages…</p></div>}{results.error && <div className="status-note" role="alert" style={{ marginTop: 18 }}>{results.error.message}</div>}{results.data?.results.map((result) => { const score = [...(result.attention_scores ?? [])].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at))[0]; const analysis = [...(result.email_analyses ?? [])].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at))[0]; return <a className="email-row" style={{ gridTemplateColumns: "35px minmax(0,1fr) auto" }} key={result.id} href={`/app?view=EVERYTHING&message=${result.id}`}><span className="email-score high">{score?.score ?? "—"}</span><span className="email-copy"><span className="email-sender">{result.from_name || result.from_email}</span><span className="email-subject">{result.subject || "(No subject)"}</span><span className="email-preview">{result.snippet}</span><span className="email-signals">{analysis?.intent ?? "unclassified"}<i className="signal-dot" />{score?.category?.toLowerCase().replaceAll("_", " ") ?? "awaiting score"}</span></span><ArrowRight size={14} className="muted" /></a>; })}</div>
    {query && results.data?.results.length === 0 && <div className="empty-view" style={{ minHeight: 220 }}><Search size={22} /><h2>No messages matched.</h2><p>Try a sender domain, fewer words, or a broader phrase.</p></div>}
  </div></div>;
}
