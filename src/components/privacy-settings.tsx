"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, LogOut, ShieldCheck, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuditRow {
  id: string;
  eventTypeId: string;
  createdFormatted: string;
}
interface Props {
  emailAccount: { id: string; address: string; status: string; scopes: string[] } | null;
  preferences: { retention: number | null; retainAnalysis: boolean; analyticsOptIn: boolean };
  audits: Array<AuditRow>;
}

async function jsonRequest(url: string, method: string, body?: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error("The request could not be completed. Your existing data was not changed.");
  return response.json();
}

export function PrivacySettings({ emailAccount, preferences, audits }: Props) {
  const router = useRouter();
  const [retention, setRetention] = useState(preferences.retention === null ? "forever" : String(preferences.retention));
  const [confirmation, setConfirmation] = useState("");
  const update = useMutation({ mutationFn: (body: unknown) => jsonRequest("/api/preferences", "PATCH", body) });
  const disconnect = useMutation({ mutationFn: () => jsonRequest("/api/gmail/disconnect", "POST", { emailAccountId: emailAccount?.id }) });
  const deleteData = useMutation({ mutationFn: () => jsonRequest("/api/privacy/delete-email-data", "DELETE") });
  const deleteAccount = useMutation({ mutationFn: () => jsonRequest("/api/privacy/delete-account", "DELETE", { confirmation }), onSuccess: () => router.push("/") });
  const saveRetention = (value: string) => { setRetention(value); update.mutate({ retentionContentDays: value === "forever" ? null : Number(value) }); };
  return <div className="page-scroll"><div className="page-wrap"><header className="page-heading"><p className="eyebrow">Settings / Privacy center</p><h1>You set the boundaries.</h1><p>Control connection permissions, retention, analytics, and deletion from one place.</p></header>
    <section className="settings-section"><div><h2>Connected account</h2><p>Gated never stores your Gmail password. OAuth credentials are encrypted server-side.</p></div><div className="settings-panel"><div className="settings-row"><div><strong>{emailAccount?.address ?? "No Gmail account connected"}</strong><p>{emailAccount ? `Status: ${emailAccount.status}` : "Gated currently has no mailbox access."}</p></div>{emailAccount ? <button className="btn btn-secondary" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}><Unplug size={13} />Disconnect</button> : <a className="btn btn-primary" href="/api/auth/google">Connect Gmail</a>}</div>{emailAccount && <div className="settings-row"><div><strong>Granted permissions</strong><p>{emailAccount.scopes.join(" · ")}. Sending always requires explicit approval.</p></div><ShieldCheck size={17} className="muted" /></div>}</div></section>
    <section className="settings-section" id="privacy"><div><h2>Retention</h2><p>Separate content retention from analysis retention. Cleanup runs as a background policy job.</p></div><div className="settings-panel"><div className="settings-row"><div><strong>Email content</strong><p>After expiry, message bodies and sanitized HTML are removed.</p></div><select className="input" style={{ width: 150 }} value={retention} onChange={(event) => saveRetention(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="forever">Until deletion</option></select></div><div className="settings-row"><div><strong>Keep analysis after content expires</strong><p>Retains score, category, and signals—not the body.</p></div><button className={`option ${preferences.retainAnalysis ? "selected" : ""}`} onClick={() => update.mutate({ retainAnalysis: !preferences.retainAnalysis })}>{preferences.retainAnalysis ? "On" : "Off"}</button></div><div className="settings-row"><div><strong>Privacy-safe product analytics</strong><p>Never includes subject, sender, recipient, or message content.</p></div><button className={`option ${preferences.analyticsOptIn ? "selected" : ""}`} onClick={() => update.mutate({ analyticsOptIn: !preferences.analyticsOptIn })}>{preferences.analyticsOptIn ? "On" : "Off"}</button></div></div></section>
    <section className="settings-section"><div><h2>Audit history</h2><p>Security-relevant account activity. Email bodies and OAuth tokens are never logged.</p></div><div className="settings-panel">{audits.length ? audits.map(({ createdFormatted, eventTypeId, id }) => (
      <div className="settings-row" key={id}>
        <div><strong>{eventTypeId}</strong><p>{createdFormatted}</p></div><Check size={14} className="muted" />
      </div>
    )) : <div className="settings-row"><p>No security events recorded yet.</p></div>}</div></section>
    <section className="settings-section"><div><h2>Delete data</h2><p>Deletion is permanent. Gmail itself is never deleted unless you take an explicit Gmail action.</p></div><div className="settings-panel"><div className="settings-row"><div><strong>Delete synced email data</strong><p>Removes local messages, threads, analyses, and scores. Your account and preferences remain.</p></div><button className="btn btn-secondary" onClick={() => deleteData.mutate()} disabled={deleteData.isPending}><Trash2 size={13} />Delete data</button></div><div className="settings-row"><div style={{ flex: 1 }}><strong>Delete Gated account</strong><p>Type DELETE MY ACCOUNT to remove the auth user and all associated account data.</p><input className="input" style={{ marginTop: 10, maxWidth: 280 }} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="DELETE MY ACCOUNT" /></div><button className="btn btn-danger" onClick={() => deleteAccount.mutate()} disabled={confirmation !== "DELETE MY ACCOUNT" || deleteAccount.isPending}>Delete account</button></div></div></section>
    {(update.isSuccess || disconnect.isSuccess || deleteData.isSuccess) && <div className="status-note" role="status" style={{ marginTop: 18 }}>Change completed.</div>}{(update.error || disconnect.error || deleteData.error || deleteAccount.error) && <div className="status-note" role="alert" style={{ marginTop: 18 }}>The change could not be completed. Existing data remains unchanged.</div>}
    <form action="/api/auth/sign-out" method="post" style={{ marginTop: 30 }}><button className="btn btn-secondary"><LogOut size={13} />Sign out</button></form>
  </div></div>;
}
