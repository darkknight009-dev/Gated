"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, Send, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { outgoingInputSchema, type OutgoingAnalysis, type OutgoingInput } from "@/domain/attention";

function recipientList(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value.split(",").map((email) => email.trim()).filter(Boolean);
}

export function ComposeForm({ connected }: { connected: boolean }) {
  const form = useForm<OutgoingInput>({ resolver: zodResolver(outgoingInputSchema), defaultValues: { to: [], subject: "", body: "", purpose: "Other", recipientContext: "" } });
  const analyze = useMutation({
    mutationFn: async (values: OutgoingInput) => {
      const response = await fetch("/api/outgoing/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error(response.status === 503 ? "Analysis is temporarily unavailable. Your draft has not been sent." : "Check the recipient, subject, and message before analyzing.");
      return response.json() as Promise<{ draftId: string; analysis: OutgoingAnalysis; mode: string }>;
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!analyze.data?.draftId) throw new Error("Analyze the current draft first.");
      const response = await fetch("/api/outgoing/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: analyze.data.draftId, approved: true }) });
      if (!response.ok) throw new Error("Gmail could not send this message. The draft remains safe.");
      return response.json();
    },
  });
  const onSubmit = (values: OutgoingInput) => analyze.mutate(values);
  const recipient = form.register("to", { setValueAs: recipientList });

  return <div className="compose-wrap page-scroll">
    <header className="page-heading"><p className="eyebrow">Outgoing gate</p><h1>Send something worth reading.</h1><p>Gated will not write at people. It helps you add context, clarify the ask, and respect the recipient’s attention.</p></header>
    {!connected && <div className="status-note" role="alert" style={{ marginBottom: 16 }}>Connect Gmail before sending. You can still draft and review your message.</div>}
    <form className="compose-sheet" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="compose-field"><label htmlFor="to">To</label><input id="to" {...recipient} placeholder="name@company.com" aria-invalid={Boolean(form.formState.errors.to)} /></div>
      <div className="compose-field"><label htmlFor="subject">Subject</label><input id="subject" {...form.register("subject")} placeholder="Say what this is about" aria-invalid={Boolean(form.formState.errors.subject)} /></div>
      <textarea className="compose-body" {...form.register("body")} aria-label="Message body" placeholder="Write like yourself. Gated will help with the signal, not replace your voice." aria-invalid={Boolean(form.formState.errors.body)} />
      <div className="compose-context"><div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12 }}><div><label className="label" htmlFor="purpose">Why contact them?</label><select className="input" id="purpose" {...form.register("purpose")}>{["Hiring", "Investment", "Partnership", "Sales", "Networking", "Press", "Feedback", "Other"].map((value) => <option key={value}>{value}</option>)}</select></div><div><label className="label" htmlFor="context">What makes this relevant to them?</label><input className="input" id="context" {...form.register("recipientContext")} placeholder="A real detail, shared context, or reason this person should care" /></div></div></div>
      <div className="compose-actions"><span className="muted" style={{ fontSize: 10, alignSelf: "center" }}><ShieldCheck size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />Nothing sends without your approval.</span><button className="btn btn-primary" type="submit" disabled={analyze.isPending}>{analyze.isPending ? "Checking signal…" : "Check before sending"}</button></div>
    </form>
    {Object.keys(form.formState.errors).length > 0 && <p className="concern" role="alert">Add a valid recipient, subject, and message before analysis.</p>}
    {analyze.error && <div className="status-note" role="alert" style={{ marginTop: 16 }}>{analyze.error.message}</div>}
    {analyze.data && <section className="analysis-panel" aria-live="polite"><div className="communication-score"><span>Communication score</span><strong>{analyze.data.analysis.communication_score}</strong><small style={{ opacity: .6 }}>{analyze.data.mode === "ai_enriched" ? "AI + controlled signals" : "Controlled signals"}</small></div><div className="analysis-copy"><h3>{analyze.data.analysis.communication_score >= 75 ? "Strong signal." : "Before this crosses the threshold:"}</h3><ul>{analyze.data.analysis.evidence.map((item) => <li key={item}>{item}</li>)}</ul>{analyze.data.analysis.suggested_body && <button className="btn btn-secondary" type="button" style={{ marginTop: 13, minHeight: 32 }} onClick={() => form.setValue("body", analyze.data!.analysis.suggested_body!)}>Use suggested edit</button>}</div></section>}
    {analyze.data && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}><button className="btn btn-signal" onClick={() => send.mutate()} disabled={!connected || send.isPending || send.isSuccess}>{send.isSuccess ? <><Check size={14} /> Sent</> : <><Send size={14} /> {send.isPending ? "Sending…" : "Approve & send"}</>}</button></div>}
    {send.error && <div className="status-note" role="alert" style={{ marginTop: 14 }}>{send.error.message}</div>}
  </div>;
}
