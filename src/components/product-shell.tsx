"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Archive, BarChart3, Check, ChevronDown, CircleGauge, Clock3, Command, Inbox, LogOut, Mail, Menu, Moon, PanelLeft, PenLine, Search, Settings, Shield, Sun, Users, X } from "lucide-react";

interface ProductShellProps {
  children: ReactNode;
  user: { name: string; email: string };
  emailAccount: { id: string; address: string; status: string; phase: string | null } | null;
}

const inboxLinks = [
  ["Worth Reading", "WORTH_READING", Check],
  ["Maybe Later", "MAYBE_LATER", Clock3],
  ["Low Value", "LOW_VALUE", Archive],
  ["Everything", "EVERYTHING", Inbox],
] as const;

export function ProductShell({ children, user, emailAccount }: ProductShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentView = searchParams.get("view") ?? "WORTH_READING";

  const commands = useMemo(() => [
    { label: "Compose", icon: PenLine, key: "C", run: () => router.push("/app/compose") },
    { label: "Search messages", icon: Search, key: "/", run: () => router.push("/app/search") },
    { label: "Worth Reading", icon: Check, key: "G W", run: () => router.push("/app?view=WORTH_READING") },
    { label: "Maybe Later", icon: Clock3, key: "G M", run: () => router.push("/app?view=MAYBE_LATER") },
    { label: "Low Value", icon: Archive, key: "G L", run: () => router.push("/app?view=LOW_VALUE") },
    { label: "People", icon: Users, key: "G P", run: () => router.push("/app/people") },
    { label: "Analytics", icon: BarChart3, key: "G A", run: () => router.push("/app/analytics") },
    { label: "Privacy center", icon: Shield, key: "", run: () => router.push("/app/settings#privacy") },
    { label: "Toggle theme", icon: Moon, key: "", run: toggleTheme },
  ], [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen((value) => !value); }
      if (event.key === "Escape") { setCommandOpen(false); setHelpOpen(false); }
      if (!typing && event.key === "?") { event.preventDefault(); setHelpOpen(true); }
      if (!typing && event.key.toLowerCase() === "c") { event.preventDefault(); router.push("/app/compose"); }
      if (!typing && event.key === "/") { event.preventDefault(); router.push("/app/search"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));
  const run = (action: () => void) => { setCommandOpen(false); setQuery(""); action(); };

  return (
    <div className="product-shell">
      <aside className="sidebar" aria-label="Application navigation">
        <div className="sidebar-head"><a href="/app" className="brand"><span className="brand-mark" />GATED</a><button className="icon-btn" aria-label="Open command menu" onClick={() => setCommandOpen(true)}><PanelLeft size={14} /></button></div>
        <a className="btn sidebar-compose" href="/app/compose"><PenLine size={14} /> Compose <span className="key" style={{ marginLeft: "auto" }}>C</span></a>
        <div className="nav-section"><div className="nav-label">Attention</div>{inboxLinks.map(([label, view, Icon]) => <a key={view} className={`nav-link ${pathname === "/app" && currentView === view ? "active" : ""}`} href={`/app?view=${view}`}><Icon />{label}</a>)}</div>
        <div className="nav-section"><div className="nav-label">Communication</div><a className={`nav-link ${pathname === "/app/sent" ? "active" : ""}`} href="/app/sent"><Mail />Sent</a><a className={`nav-link ${pathname === "/app/people" ? "active" : ""}`} href="/app/people"><Users />People</a><a className={`nav-link ${pathname === "/app/analytics" ? "active" : ""}`} href="/app/analytics"><BarChart3 />Analytics</a></div>
        <div className="sidebar-bottom"><button className="nav-link" onClick={() => setCommandOpen(true)}><Command />Commands <span className="key" style={{ marginLeft: "auto" }}>⌘K</span></button><button className="nav-link" onClick={() => setHelpOpen(true)}><CircleGauge />Shortcuts <span className="key" style={{ marginLeft: "auto" }}>?</span></button><a className={`nav-link ${pathname === "/app/settings" ? "active" : ""}`} href="/app/settings"><Settings />Settings</a><div className="account-chip"><span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span><div className="account-chip-text"><strong>{user.name}</strong><span>{emailAccount?.address ?? user.email}</span></div><ChevronDown size={12} className="muted" /></div></div>
      </aside>

      <div className="mobile-top"><a href="/app" className="brand"><span className="brand-mark" />GATED</a><div><button className="icon-btn" aria-label="Search" onClick={() => router.push("/app/search")}><Search size={17} /></button><button className="icon-btn" aria-label="Commands" onClick={() => setCommandOpen(true)}><Menu size={17} /></button></div></div>
      <main className="product-main" id="product-main">{children}</main>
      <nav className="mobile-tabs" aria-label="Mobile navigation"><a className="mobile-tab" href="/app"><Inbox />Inbox</a><a className="mobile-tab" href="/app/search"><Search />Search</a><a className="mobile-tab" href="/app/compose"><PenLine />Compose</a><a className="mobile-tab" href="/app/people"><Users />People</a><a className="mobile-tab" href="/app/settings"><Settings />Settings</a></nav>

      {commandOpen && <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCommandOpen(false)}><section className="command" role="dialog" aria-modal="true" aria-label="Command menu"><div className="command-search"><Search size={16} className="muted" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands…" aria-label="Search commands" /><span className="key">Esc</span></div><div className="command-results"><div className="command-section-label">Actions</div>{filtered.map((command) => <button className="command-item" key={command.label} onClick={() => run(command.run)}><command.icon />{command.label}{command.key && <span className="key">{command.key}</span>}</button>)}{!filtered.length && <div className="empty-view" style={{ minHeight: 100 }}>No commands matched.</div>}</div><div style={{ borderTop: "1px solid var(--line)", padding: "8px 14px", color: "var(--faint)", font: "8px var(--font-mono)" }}>↑↓ NAVIGATE &nbsp; ↵ OPEN &nbsp; ESC CLOSE</div></section></div>}
      {helpOpen && <div className="command-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setHelpOpen(false)}><section className="command" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"><div className="command-search"><Activity size={16} /><strong style={{ flex: 1 }}>Keyboard shortcuts</strong><button className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Close"><X size={15} /></button></div><div className="shortcut-grid">{[["Next message", "J"], ["Previous message", "K"], ["Open message", "O"], ["Reply", "R"], ["Archive", "E"], ["Compose", "C"], ["Search", "/"], ["Commands", "⌘K"]].map(([label, key]) => <div key={label}><span>{label}</span><span className="key">{key}</span></div>)}</div></section></div>}
    </div>
  );
}

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme === "dark";
  if (dark) delete root.dataset.theme; else root.dataset.theme = "dark";
  localStorage.setItem("gated-theme", dark ? "light" : "dark");
}
