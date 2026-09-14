"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const priorities = ["Customers", "Investors", "Hiring", "Partnerships", "Press", "Networking"];
const depriorities = ["Cold sales", "Generic networking", "Newsletters", "Mass recruiting", "Promotional email"];
const roles = ["Founder", "Investor", "Recruiter", "Executive", "Creator", "Other"] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [high, setHigh] = useState<string[]>([]);
  const [low, setLow] = useState<string[]>([]);
  const [role, setRole] = useState<(typeof roles)[number]>("Founder");
  const [context, setContext] = useState("");
  const complete = useMutation({ mutationFn: async () => { const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, highPriority: high, lowPriority: low, interests: high, customContext: context }) }); if (!response.ok) throw new Error("Your preferences could not be saved. Gmail sync continues safely in the background."); return response.json(); }, onSuccess: () => setStep(3) });
  const toggle = (value: string, list: string[], setList: (values: string[]) => void) => setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return <main className="onboarding">
    <aside className="onboarding-side"><Link href="/" className="brand"><span className="brand-mark" />GATED</Link><div className="onboarding-progress">{["What matters", "Less of this", "Your context", "Learning"].map((label, index) => <div className={`progress-item ${step === index ? "active" : ""}`} key={label}><span className="progress-dot" /><span>{label}</span></div>)}</div><span className="eyebrow">Your attention / your rules</span></aside>
    <section className="onboarding-main"><div className="onboarding-card">
      {step === 0 && <><p className="eyebrow">01 / What deserves your attention?</p><h1 className="display">What should make the cut?</h1><p className="muted">Choose the conversations that tend to matter. You can change this anytime.</p><div className="option-grid">{priorities.map((value) => <button className={`option ${high.includes(value) ? "selected" : ""}`} key={value} onClick={() => toggle(value, high, setHigh)}>{high.includes(value) && <Check size={12} style={{ marginRight: 6, verticalAlign: "-2px" }} />}{value}</button>)}</div><button className="btn btn-primary" onClick={() => setStep(1)} disabled={!high.length}>Continue <ArrowRight size={14} /></button></>}
      {step === 1 && <><p className="eyebrow">02 / Make room</p><h1 className="display">What do you want less of?</h1><p className="muted">Gated de-emphasizes these. It never deletes or makes messages unrecoverable.</p><div className="option-grid">{depriorities.map((value) => <button className={`option ${low.includes(value) ? "selected" : ""}`} key={value} onClick={() => toggle(value, low, setLow)}>{low.includes(value) && <Check size={12} style={{ marginRight: 6, verticalAlign: "-2px" }} />}{value}</button>)}</div><div style={{ display: "flex", gap: 8 }}><button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button><button className="btn btn-primary" onClick={() => setStep(2)}>Continue <ArrowRight size={14} /></button></div></>}
      {step === 2 && <><p className="eyebrow">03 / Give Gated context</p><h1 className="display">What do you do?</h1><p className="muted">A role is useful. A sentence of real context is better.</p><div className="option-grid">{roles.map((value) => <button className={`option ${role === value ? "selected" : ""}`} key={value} onClick={() => setRole(value)}>{value}</button>)}</div><label className="label" htmlFor="context">What are you working on or paying attention to?</label><textarea id="context" className="input" style={{ minHeight: 100 }} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Example: Building healthcare infrastructure. Talking to seed investors and design partners." /><div style={{ display: "flex", gap: 8, marginTop: 18 }}><button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button><button className="btn btn-signal" onClick={() => complete.mutate()} disabled={complete.isPending}>{complete.isPending ? <><LoaderCircle size={14} className="animate-spin" /> Saving</> : <>Start learning <ArrowRight size={14} /></>}</button></div>{complete.error && <div className="status-note" role="alert" style={{ marginTop: 15 }}>{complete.error.message}</div>}</>}
      {step === 3 && <><p className="eyebrow">Threshold set</p><h1 className="display">Gated is learning.</h1><p className="muted" style={{ maxWidth: 520, lineHeight: 1.7 }}>Your recent inbox is synchronizing in small background batches. Scores will appear as messages are processed. Gmail remains the source of truth.</p><div style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "19px 0", margin: "30px 0", display: "flex", gap: 12, alignItems: "center" }}><LoaderCircle size={17} className="animate-spin" /><div><strong style={{ fontSize: 12 }}>Initial sync queued</strong><span className="muted" style={{ display: "block", fontSize: 10, marginTop: 3 }}>You can use Gated while this continues.</span></div></div><button className="btn btn-primary" onClick={() => router.push("/app")}>Enter Gated <ArrowRight size={14} /></button></>}
    </div></section>
  </main>;
}
