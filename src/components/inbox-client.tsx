"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, ArrowLeft, ChevronDown, Inbox, MailOpen, MoreHorizontal, RefreshCw, Reply, ShieldAlert, Trash2 } from "lucide-react";
import type { EmailCategory, SignalSet } from "@/domain/attention";
import { SyncProgress } from "./sync-progress";

export interface InboxItem {
  id: string;
  senderId: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  body: string | null;
  sentAt: string;
  isRead: boolean;
  score: number | null;
  confidence: number | null;
  category: EmailCategory | null;
  intent: string | null;
  evidence: string[];
  concern: string | null;
  signals: Partial<SignalSet>;
  overrideReason: string | null;
}

const viewCopy: Record<string, [string, string]> = {
  WORTH_READING: ["Worth Reading", "Messages Gated thinks deserve your attention."],
  MAYBE_LATER: ["Maybe Later", "Good to know, but nothing needs you right now."],
  LOW_VALUE: ["Low Value", "Messages Gated doesn’t think need your attention right now."],
  EVERYTHING: ["Everything", "Every message remains recoverable and in your control."],
};

export function InboxClient({ items, view, connection, initialId }: { items: InboxItem[]; view: string; connection: { id: string; status: string; phase: string | null } | null; initialId?: string }) {
  const initialIndex = initialId ? Math.max(0, items.findIndex((item) => item.id === initialId)) : 0;
  const [selected, setSelected] = useState(initialIndex);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialId));
  const safeSelected = Math.min(selected, Math.max(0, items.length - 1));
  const current = items[safeSelected] ?? null;
  const copy = viewCopy[view] ?? viewCopy.WORTH_READING;
  const sync = useMutation({ mutationFn: async () => { if (!connection) return; const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailAccountId: connection.id }) }); if (!response.ok) throw new Error("Sync failed"); return response.json(); } });
  const feedback = useMutation({ mutationFn: async (action: string) => { if (!current) return; const response = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailId: current.id, action }) }); if (!response.ok) throw new Error("Feedback failed"); return response.json(); } });
  const archive = useMutation({ mutationFn: async () => { if (!current) return; const response = await fetch("/api/email/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailId: current.id, action: "archive" }) }); if (!response.ok) throw new Error("Archive failed"); } });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) return;
      if (event.key.toLowerCase() === "j") { event.preventDefault(); setSelected((value) => Math.min(items.length - 1, value + 1)); }
      if (event.key.toLowerCase() === "k") { event.preventDefault(); setSelected((value) => Math.max(0, value - 1)); }
      if (event.key.toLowerCase() === "o" && current) setMobileDetail(true);
      if (event.key.toLowerCase() === "e" && current) archive.mutate();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items.length, current, archive]);

  return <div className="inbox-layout">
    <section className={`inbox-column ${mobileDetail ? "mobile-hidden" : ""}`} aria-label={`${copy[0]} messages`}>
      <header className="inbox-header"><div className="inbox-toolbar"><span className="eyebrow">Attention / {view === "EVERYTHING" ? "all" : "filtered"}</span><div className="inbox-toolbar-actions"><button className="icon-btn" onClick={() => sync.mutate()} disabled={!connection || sync.isPending} aria-label="Sync Gmail"><RefreshCw size={14} className={sync.isPending ? "animate-spin" : ""} /></button><button className="icon-btn" aria-label="More options"><MoreHorizontal size={15} /></button></div></div><div className="inbox-title-row"><h1 className="inbox-title">{copy[0]}</h1><span className="inbox-count">{items.length}</span></div><p className="inbox-subtitle">{copy[1]}</p></header>
      {!connection && <div className="connection-banner"><span>Gmail is not connected. Your inbox has not been accessed.</span><a href="/api/auth/google" className="btn btn-secondary" style={{ minHeight: 28, paddingInline: 9 }}>Connect</a></div>}
      {connection?.status === "reauthorization_required" && <div className="connection-banner"><span>Google access expired. Stored email is safe.</span><a href="/api/auth/google">Reconnect</a></div>}
      {connection && connection.status === "connected" && <SyncProgress emailAccountId={connection.id} connectionStatus={connection.status} phase={connection.phase} />}
      <div className="email-list" role="listbox" aria-label="Messages">{items.map((item, index) => <button role="option" aria-selected={safeSelected === index} className={`email-row ${safeSelected === index ? "selected" : ""} ${!item.isRead ? "unread" : ""}`} key={item.id} onClick={() => { setSelected(index); setMobileDetail(true); }}><span className={`email-score ${(item.score ?? 0) >= 70 ? "high" : ""}`}>{item.score ?? "—"}</span><span className="email-copy"><span className="email-topline"><span className="email-sender">{item.senderName}</span></span><span className="email-subject">{item.subject || "(No subject)"}</span><span className="email-preview">{item.snippet}</span><span className="email-signals">{item.intent ?? "Processing"}<i className="signal-dot" />{categoryLabel(item.category)}</span></span><time className="email-time" dateTime={item.sentAt}>{shortDate(item.sentAt)}</time></button>)}</div>
      {!items.length && <div className="empty-view"><Inbox size={24} strokeWidth={1.4} /><h2>{connection?.phase === "initial" ? "Learning what matters." : view === "LOW_VALUE" ? "No noise found." : view === "EVERYTHING" ? "Your inbox is clear." : "Worth Reading is clear."}</h2><p>{connection?.phase === "initial" ? "Messages will appear here as the background sync and attention analysis complete." : connection ? "Nothing in this view needs your attention." : "Connect Gmail to let Gated begin prioritizing."}</p></div>}
    </section>
    <section className={`detail-column ${!mobileDetail && !current ? "mobile-hidden" : ""}`} aria-label="Message detail">{current ? <>
      <div className="detail-toolbar"><div className="detail-toolbar-group"><button className="icon-btn mobile-back" aria-label="Back to inbox" onClick={() => setMobileDetail(false)}><ArrowLeft size={16} /></button><button className="icon-btn" aria-label="Archive" onClick={() => archive.mutate()}><Archive size={15} /></button><button className="icon-btn" aria-label="Delete"><Trash2 size={15} /></button><button className="icon-btn" aria-label="Mark unread"><MailOpen size={15} /></button></div><div className="detail-toolbar-group"><button className="icon-btn" aria-label="Reply"><Reply size={15} /></button><button className="icon-btn" aria-label="More"><MoreHorizontal size={16} /></button></div></div>
      <div className="detail-content"><div className="message-heading"><h1>{current.subject || "(No subject)"}</h1><div className="sender-line"><span className="sender-avatar">{initials(current.senderName)}</span><div className="sender-meta"><strong>{current.senderName}</strong><span>{current.senderEmail}</span></div><time className="message-date">{longDate(current.sentAt)}</time></div></div>
      <div className="attention-strip"><div><div className="attention-number">{current.score ?? "—"}</div><div className="attention-confidence">{current.confidence ? `${Math.round(current.confidence * 100)}% CONF.` : "ANALYZING"}</div></div><div><div className="attention-label">{current.category ? categoryLabel(current.category) : "Attention estimate pending"}</div><ul className="why-list">{(current.overrideReason ? [current.overrideReason, ...current.evidence] : current.evidence).slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}</ul>{current.concern && <div className="concern">△ {current.concern}</div>}</div></div>
      {Object.keys(current.signals).length > 0 && <div className="signal-grid">{(["specificity", "relevance", "context", "relationship", "genericness"] as const).map((signal) => <div className="signal-cell" key={signal}><span>{signal}</span><strong>{Math.round((current.signals[signal] ?? 0) * 100).toString().padStart(2, "0")}</strong></div>)}</div>}
      <article className="message-body">{current.body ?? "This message’s content has expired under your retention policy. Its analysis and metadata remain available."}</article>
      <div className="feedback-bar"><span>Help Gated learn</span><button className="feedback-btn" onClick={() => feedback.mutate("IMPORTANT")}>Important</button><button className="feedback-btn" onClick={() => feedback.mutate("MAYBE_LATER")}>Maybe later</button><button className="feedback-btn" onClick={() => feedback.mutate("LOW_VALUE")}>Low value</button><button className="feedback-btn" onClick={() => feedback.mutate("ALWAYS_PRIORITIZE_SENDER")}>Prioritize sender</button></div>
      </div></> : <div className="empty-view"><ShieldAlert size={24} strokeWidth={1.3} /><h2>Select a message.</h2><p>Its context, Attention Score, and concise evidence will appear here.</p></div>}</section>
  </div>;
}

function categoryLabel(category: EmailCategory | null) { return category ? category.toLowerCase().replaceAll("_", " ") : "awaiting score"; }
function initials(name: string) { return name.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase(); }
function shortDate(value: string) { const date = new Date(value); return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" }); }
function longDate(value: string) { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
