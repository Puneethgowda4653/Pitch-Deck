import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Zap, Target, BarChart2, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FEATURES = [
  { icon: Target, title: "Market research, automated", desc: "iPreneur researches your industry, competitors, and market size — no spreadsheets, no guesswork." },
  { icon: Sparkles, title: "AI-crafted narrative", desc: "Claude writes a compelling story for every slide: problem, solution, traction, and the ask." },
  { icon: BarChart2, title: "Export & share", desc: "Download a polished, fully-editable PPTX or PDF — ready to send to investors in one click." },
];

const STEPS = [
  { n: "01", t: "Drop a URL", d: "Paste your company website. That's the only input we need to start." },
  { n: "02", t: "AI analyzes", d: "We crawl your site, extract your brand, and research your market in ~2 minutes." },
  { n: "03", t: "Get your deck", d: "A 10-slide, investor-ready pitch deck — on-brand and editable." },
];

const LOGOS = ["Linear", "Ramp", "Notion", "Figma", "Vercel", "Retool"];

const lp = {
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 44px", borderBottom: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", position: "sticky" as const, top: 0, zIndex: 20 },
  navLinks: { display: "flex", gap: 28, position: "absolute" as const, left: "50%", transform: "translateX(-50%)" },
  navLink: { font: "500 14px var(--font-body)", color: "var(--text-muted)", textDecoration: "none" },
  signin: { font: "600 14px var(--font-body)", color: "var(--text-body)", textDecoration: "none", padding: "0 12px" },
  hero: { position: "relative" as const, overflow: "hidden", padding: "84px 24px 72px", textAlign: "center" as const },
  halo: { position: "absolute" as const, inset: 0, background: "var(--grad-hero)", pointerEvents: "none" as const },
  heroInner: { position: "relative" as const, maxWidth: 820, margin: "0 auto" },
  eyebrowPill: { display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 15px", borderRadius: 99, background: "var(--surface-card)", border: "1px solid var(--violet-200)", boxShadow: "var(--shadow-xs)", font: "500 13px var(--font-body)", color: "var(--text-body)", marginBottom: 26 },
  h1: { font: "800 60px var(--font-display)", lineHeight: 1.04, letterSpacing: "-0.035em", color: "var(--text-strong)" } as React.CSSProperties,
  lead: { maxWidth: 600, margin: "22px auto 0", font: "400 18px var(--font-body)", lineHeight: 1.55, color: "var(--text-muted)" } as React.CSSProperties,
  heroCtas: { display: "flex", gap: 12, justifyContent: "center", marginTop: 32 } as React.CSSProperties,
  heroTrust: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 30, font: "400 13px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  trustDiv: { width: 4, height: 4, borderRadius: 99, background: "var(--border-default)" },
  logosWrap: { textAlign: "center" as const, padding: "8px 24px 56px" },
  logosLabel: { font: "500 12px var(--font-body)", letterSpacing: "0.04em", textTransform: "uppercase" as const, color: "var(--text-faint)" },
  logos: { display: "flex", flexWrap: "wrap" as const, justifyContent: "center", gap: 38, marginTop: 22 },
  logo: { font: "700 22px var(--font-display)", letterSpacing: "-0.02em", color: "var(--neutral-400)" },
  section: { maxWidth: 1080, margin: "0 auto", padding: "64px 24px" } as React.CSSProperties,
  sectionHead: { textAlign: "center" as const, marginBottom: 40 },
  h2: { font: "800 38px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)", marginTop: 10 } as React.CSSProperties,
  featGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 } as React.CSSProperties,
  feat: { padding: 28 } as React.CSSProperties,
  featIcon: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 46, height: 46, borderRadius: "var(--radius-md)", background: "var(--violet-100)", color: "var(--violet-600)", marginBottom: 18 } as React.CSSProperties,
  featTitle: { font: "700 19px var(--font-display)", color: "var(--text-strong)", marginBottom: 9 } as React.CSSProperties,
  featDesc: { font: "400 14px var(--font-body)", lineHeight: 1.6, color: "var(--text-muted)" } as React.CSSProperties,
  howCard: { position: "relative" as const, overflow: "hidden", borderRadius: "var(--radius-2xl, 24px)", background: "var(--grad-brand-vivid)", padding: "52px 48px", boxShadow: "var(--glow-brand)" } as React.CSSProperties,
  howHead: { textAlign: "center" as const, marginBottom: 40 },
  stepsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 } as React.CSSProperties,
  step: { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: "var(--radius-lg)", padding: 24, backdropFilter: "blur(4px)" } as React.CSSProperties,
  stepNum: { font: "700 13px var(--font-mono)", color: "rgba(255,255,255,0.7)" },
  stepTitle: { font: "700 19px var(--font-display)", color: "#fff", margin: "12px 0 8px" } as React.CSSProperties,
  stepDesc: { font: "400 14px var(--font-body)", lineHeight: 1.6, color: "rgba(255,255,255,0.88)" } as React.CSSProperties,
  ctaBand: { textAlign: "center" as const, padding: "72px 24px 80px", maxWidth: 680, margin: "0 auto" },
  ctaH: { font: "800 40px var(--font-display)", letterSpacing: "-0.03em", color: "var(--text-strong)" } as React.CSSProperties,
  ctaSub: { margin: "16px auto 30px", font: "400 17px var(--font-body)", color: "var(--text-muted)" } as React.CSSProperties,
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 44px", borderTop: "1px solid var(--border-subtle)" } as React.CSSProperties,
  footNote: { font: "400 13px var(--font-body)", color: "var(--text-faint)" },
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--surface-page)", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={lp.nav}>
        <img src="/ipreneur-logo.webp" alt="iPreneur" style={{ width: 122 }} />
        <div style={lp.navLinks}>
          <a href="#features" style={lp.navLink}>Features</a>
          <a href="#how" style={lp.navLink}>How it works</a>
          <a href="#pricing" style={lp.navLink}>Pricing</a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link to="/login" style={lp.signin}>Sign in</Link>
          <Link to="/register">
            <Button variant="primary" icon={<Sparkles size={15} />}>Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header style={lp.hero}>
        <div style={lp.halo} />
        <div style={lp.heroInner}>
          <div style={lp.eyebrowPill}>
            <Zap size={13} style={{ color: "var(--violet-600)" }} />
            <span>AI-powered pitch decks · Backed by a startup accelerator</span>
          </div>
          <h1 style={lp.h1}>
            Turn your idea into an<br />
            <span className="ipr-gradient-text">investor-ready</span> pitch deck
          </h1>
          <p style={lp.lead}>
            iPreneur crawls your company website, researches your market, and generates a professional pitch deck tailored for investors — in under five minutes.
          </p>
          <div style={lp.heroCtas}>
            <Link to="/register">
              <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>Generate your deck</Button>
            </Link>
            <Button variant="secondary" size="lg" icon={<Play size={14} />}>Watch demo</Button>
          </div>
          <div style={lp.heroTrust}>
            <span><b style={{ color: "var(--text-strong)" }}>12,000+</b> decks generated</span>
            <span style={lp.trustDiv} />
            <span><b style={{ color: "var(--text-strong)" }}>~2 min</b> average build</span>
            <span style={lp.trustDiv} />
            <span>PPTX &amp; PDF export</span>
          </div>
        </div>
      </header>

      {/* Logo strip */}
      <section style={lp.logosWrap}>
        <span style={lp.logosLabel}>Pitch decks built for founders raising at</span>
        <div style={lp.logos}>
          {LOGOS.map((l) => <span key={l} style={lp.logo}>{l}</span>)}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={lp.section}>
        <div style={lp.sectionHead}>
          <span className="ipr-eyebrow">Everything in one flow</span>
          <h2 style={lp.h2}>From URL to investor deck, automatically</h2>
        </div>
        <div style={lp.featGrid}>
          {FEATURES.map((f) => (
            <Card key={f.title} padding="none">
              <div style={lp.feat}>
                <span style={lp.featIcon}><f.icon size={20} /></span>
                <h3 style={lp.featTitle}>{f.title}</h3>
                <p style={lp.featDesc}>{f.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" style={{ ...lp.section, paddingTop: 0 }}>
        <div style={lp.howCard}>
          <div style={lp.howHead}>
            <span className="ipr-eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>How it works</span>
            <h2 style={{ ...lp.h2, color: "#fff", marginTop: 8 }}>Three steps. Zero slide design.</h2>
          </div>
          <div style={lp.stepsGrid}>
            {STEPS.map((s) => (
              <div key={s.n} style={lp.step}>
                <span style={lp.stepNum}>{s.n}</span>
                <h3 style={lp.stepTitle}>{s.t}</h3>
                <p style={lp.stepDesc}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section id="pricing" style={lp.ctaBand}>
        <h2 style={lp.ctaH}>Your next raise starts with a great deck</h2>
        <p style={lp.ctaSub}>Join thousands of founders who pitch with confidence. Free to start.</p>
        <Link to="/register">
          <Button variant="primary" size="lg" iconRight={<ArrowRight size={16} />}>Generate your pitch deck</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer style={lp.footer}>
        <img src="/ipreneur-logo.webp" alt="iPreneur" style={{ width: 110 }} />
        <span style={lp.footNote}>© 2026 iPreneur · Startup Accelerator</span>
      </footer>
    </div>
  );
}
