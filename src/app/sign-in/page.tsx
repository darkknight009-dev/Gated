import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata = { title: "Connect Gmail" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link href="/" className="brand"><span className="brand-mark" />GATED</Link>
        <blockquote className="auth-quote">“My inbox stopped feeling like a list of other people’s priorities.”</blockquote>
        <p style={{ color: "color-mix(in srgb, var(--bg) 55%, transparent)", font: "11px var(--font-mono)" }}>PRIVATE BY DEFAULT / HUMAN IN CONTROL</p>
      </section>
      <section className="auth-main">
        <div className="auth-card">
          <Link href="/" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12 }}><ArrowLeft size={13} /> Back</Link>
          <p className="eyebrow" style={{ marginTop: 48 }}>Cross the threshold</p>
          <h1>Connect your inbox.</h1>
          <p>Google handles sign-in. Gated never sees your password and stores refresh credentials encrypted on the server.</p>
          {error && <div className="status-note" role="alert" style={{ marginTop: 18 }}>{error === "configuration" || !isSupabaseConfigured ? "Gated is not configured for Supabase yet. Add the required server environment variables before connecting Gmail." : "Google connection could not be completed. No mailbox data was stored. Try connecting again."}</div>}
          {isSupabaseConfigured ? <a className="btn btn-primary google-btn" href="/api/auth/google">Continue with Google <ArrowRight size={15} /></a> : <button className="btn btn-primary google-btn" disabled aria-disabled="true">Google connection unavailable</button>}
          <div className="auth-note"><ShieldCheck size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Gated requests Gmail read/organize and send permissions. Sending always requires your explicit action.</div>
          <p className="auth-note">By continuing, you agree to the Terms and acknowledge the Privacy Policy.</p>
        </div>
      </section>
    </main>
  );
}
