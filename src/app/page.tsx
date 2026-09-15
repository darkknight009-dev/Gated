import Link from "next/link";
import { ArrowRight, LockKeyhole, MoveDown } from "lucide-react";

const layers = [
  ["01", "Context before content", "A short note from an active customer can matter more than polished cold outreach. Gated reads the relationship and the thread—not just the words."],
  ["02", "Decisions, not detection", "Relevance, specificity, intent, urgency, and history become a controlled Attention Score. AI authorship is one signal, never the verdict."],
  ["03", "Your corrections compound", "Mark what matters, prioritize a sender, or move something down. Gated adapts to you without training a global model on private email."],
];

export default function HomePage() {
  return (
    <main className="landing">
      <a className="skip-link" href="#main">Skip to content</a>
      <nav className="landing-nav" aria-label="Primary navigation">
        <Link href="/" className="brand" aria-label="Gated home"><span className="brand-mark" aria-hidden="true" />GATED</Link>
        <div className="landing-links">
          <a href="#how">How it works</a><a href="#privacy">Privacy</a><span className="key">⌘ K</span>
          <a className="btn btn-primary" href="/api/auth/google">Connect Gmail <ArrowRight size={14} /></a>
        </div>
      </nav>

      <section className="hero" id="main">
        <div className="hero-copy">
          <div className="hero-kicker">The firewall for human attention</div>
          <h1 className="display">Not every email <em>deserves</em> entry.</h1>
          <p className="hero-sub">Gated filters communication by relevance, context, intent, and relationship—so meaningful messages rise above the noise.</p>
          <div className="hero-actions">
            <a className="btn btn-signal" href="/api/auth/google">Connect Gmail <ArrowRight size={15} /></a>
            <a className="btn btn-secondary" href="#how">See how Gated works <MoveDown size={14} /></a>
          </div>
          <div className="hero-trust"><LockKeyhole size={12} /> Read and send access only. Revoke it anytime.</div>
        </div>
        <div className="threshold-visual" aria-label="An abstract illustration of messages crossing an attention threshold">
          <span className="threshold-label">Attention threshold / 0.70</span><span className="threshold-gate" />
          <div className="signal-stack">
            <div className="signal-row"><span className="signal-score">.94</span><div><strong>Active customer thread</strong><span>Known sender · concrete ask</span></div><span className="signal-pass">Enter</span></div>
            <div className="signal-row"><span className="signal-score">.88</span><div><strong>Specific partnership context</strong><span>New contact · relevant work</span></div><span className="signal-pass">Enter</span></div>
            <div className="signal-row"><span className="signal-score">.51</span><div><strong>Newsletter update</strong><span>Informational · no action</span></div><span className="signal-hold">Hold</span></div>
            <div className="signal-row"><span className="signal-score">.18</span><div><strong>Reusable outreach</strong><span>Low context · repeated ask</span></div><span className="signal-hold">De-emphasize</span></div>
          </div>
        </div>
      </section>

      <div className="marquee-line" aria-hidden="true"><div className="marquee-inner"><span>Relevance <i>◆</i></span><span>Specificity <i>◆</i></span><span>Context <i>◆</i></span><span>Relationship <i>◆</i></span><span>Intent <i>◆</i></span><span>Urgency <i>◆</i></span><span>Human judgment stays in control</span></div></div>

      <section className="marketing-section" id="how">
        <div className="section-head"><p className="eyebrow">A different layer</p><h2 className="display">Gmail carries the message. Gated decides what earns your attention.</h2></div>
        <div className="layers">{layers.map(([number, title, copy]) => <article className="layer" key={number}><span className="layer-number">{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="dark-band" id="privacy">
        <div className="marketing-section manifesto">
          <p className="eyebrow">Private infrastructure</p>
          <h2 className="display">Your inbox is not training data. <span className="accent">It is entrusted data.</span></h2>
          <p className="muted" style={{ maxWidth: 650, lineHeight: 1.7, fontSize: 16 }}>Encrypted OAuth credentials. Tenant isolation. Configurable retention. No remote email images. No silent hiding. Delete synced data—or your whole account—when you choose.</p>
          <div style={{ marginTop: 30 }}><a className="btn btn-signal" href="/api/auth/google">Set your threshold <ArrowRight size={15} /></a></div>
        </div>
      </section>

      <footer className="landing-footer"><span className="brand"><span className="brand-mark" />GATED</span><span>Fewer messages. More that matter.</span><span>© {new Date().getFullYear()} Gated</span></footer>
    </main>
  );
}
