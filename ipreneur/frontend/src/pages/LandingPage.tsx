import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowRight,
  Zap,
  Play,
  CheckCircle2,
  ChevronRight,
  Layout,
  Globe,
  FileText,
  BarChart3,
  Shield,
  Layers,
  Eye,
  Download,
  Star,
  HelpCircle,
  ArrowUpRight,
  Palette,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Cpu,
  Check,
  Share2,
  Lock,
} from "lucide-react";

// ── Showcase Slides for Interactive Live Preview ──────────────────────────────
interface SlideContent {
  id: number;
  tag: string;
  title: string;
  subtitle: string;
  type: "problem" | "solution" | "market" | "traction" | "business" | "ask";
  badgeColor: string;
}

const LIVE_SLIDES: SlideContent[] = [
  {
    id: 1,
    tag: "01 · The Problem",
    title: "Legacy Slide Software Was Built for 1995, Not Founders Raising Capital",
    subtitle: "Founders spend 40+ hours per pitch deck aligning text boxes and wrestling PowerPoint templates. The result? Dense, uninspiring slides that fail to hook investors.",
    type: "problem",
    badgeColor: "text-slate-900 border-neutral-200 bg-neutral-100",
  },
  {
    id: 2,
    tag: "02 · The Solution",
    title: "AI-Native Pitch Medium: From URL to Investor Deck in 90 Seconds",
    subtitle: "iPreneur automatically parses your company website, synthesizes your value proposition, models your market size, and formats a polished narrative ready for institutional VCs.",
    type: "solution",
    badgeColor: "text-blue-700 border-blue-200 bg-blue-50",
  },
  {
    id: 3,
    tag: "03 · Market Sizing",
    title: "Tapping a $64B Global Presentation & Venture Intelligence Market",
    subtitle: "Over 2.4M new technology startups are funded globally every year, each requiring multiple bespoke decks across Seed, Series A, customer pilots, and Board updates.",
    type: "market",
    badgeColor: "text-blue-700 border-blue-200 bg-blue-50",
  },
  {
    id: 4,
    tag: "04 · Traction & Velocity",
    title: "Explosive Product-Led Growth: 4.8x YoY with $2.1M ARR",
    subtitle: "Strong founder word-of-mouth driving organic referral loops across top tier accelerators like Y Combinator, Techstars, and Sequoia scout networks.",
    type: "traction",
    badgeColor: "text-emerald-700 border-emerald-200 bg-emerald-50",
  },
  {
    id: 5,
    tag: "05 · Business Model",
    title: "High-Margin SaaS + Enterprise Venture Deal-Flow Subscriptions",
    subtitle: "Predictable recurring revenue with 88% gross margins and 142% Net Dollar Retention (NDR) across growing startup teams and accelerator cohorts.",
    type: "business",
    badgeColor: "text-slate-900 border-neutral-200 bg-neutral-100",
  },
  {
    id: 6,
    tag: "06 · The Ask",
    title: "Raising $3.5M Seed to Scale AI Generation & Investor Intelligence",
    subtitle: "Allocation: 60% Engineering & Multimodal LLMs, 25% Growth & Accelerator Partnerships, 15% Operations & Investor Deal Network.",
    type: "ask",
    badgeColor: "text-blue-700 border-blue-200 bg-blue-50",
  },
];

// ── Prompt Suggestions for the Generator Bar ─────────────────────────────────
const PROMPT_SUGGESTIONS = [
  "Series A pitch deck for an AI healthcare triage copilot",
  "Seed stage deck for autonomous drone logistics in supply chain",
  "Fintech developer API replacing legacy core banking architecture",
  "B2B SaaS customer retention engine with predictive churn ML",
  "ClimateTech carbon offset verification platform using satellite radar",
];

// ── Format Options ────────────────────────────────────────────────────────────
const FORMAT_TABS = [
  { id: "pitch-deck", label: "🎯 Pitch Deck", desc: "10-12 investor-vetted slides" },
  { id: "executive", label: "📊 Executive Deck", desc: "Dense financial & growth metrics" },
  { id: "seed", label: "⚡ 10-Slide Seed", desc: "High-signal problem-solution format" },
  { id: "one-pager", label: "📑 Web Summary", desc: "Interactive mobile link for investors" },
];

// ── Templates ─────────────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 1,
    title: "Next-Gen AI SaaS Platform",
    category: "AI & SaaS",
    stage: "Series A ($14M Raised)",
    slides: "12 Slides",
    image: "/images/template_ai_saas.jpg",
    rating: "4.95",
    tags: ["LLM Architecture", "ARR Growth", "Team Moat"],
  },
  {
    id: 2,
    title: "Nexus Pay Global Infrastructure",
    category: "Fintech",
    stage: "Series Seed ($4.2M)",
    slides: "10 Slides",
    image: "/images/template_fintech.jpg",
    rating: "4.98",
    tags: ["Payments Volume", "Multi-Currency", "SOC 2 Type II"],
  },
  {
    id: 3,
    title: "Autonomous Drone Logistics Network",
    category: "DeepTech",
    stage: "Seed ($5.5M)",
    slides: "11 Slides",
    image: "/images/hero_deck_showcase.jpg",
    rating: "4.92",
    tags: ["Hardware Moat", "Pilot Contracts", "TAM $84B"],
  },
  {
    id: 4,
    title: "Venture Intelligence & Market Sizing",
    category: "Enterprise",
    stage: "Series B ($28M)",
    slides: "14 Slides",
    image: "/images/market_research_ai.jpg",
    rating: "4.99",
    tags: ["Market Share", "Competitor Matrix", "Web Crawling"],
  },
];

// ── FAQs ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How does iPreneur generate a deck from just a URL or prompt?",
    a: "iPreneur uses intelligent web-crawling to scan your landing page, product docs, and public materials. It then extracts your core value propositions, target customer profiles, and competitive moats. Claude 3.5 and venture financial models craft a tight 10-to-12 slide narrative formatted with pixel-perfect precision.",
  },
  {
    q: "Can I export my finished deck to Microsoft PowerPoint (.pptx) or PDF?",
    a: "Yes! Every deck can be exported with a single click to native Microsoft PowerPoint (.pptx) vector files or high-res vector PDFs. All shapes, texts, tables, and metric cards remain 100% editable in PowerPoint, Keynote, or Google Slides.",
  },
  {
    q: "Can I share a live link with investors and track their views?",
    a: "Absolutely. Much like Gamma, every iPreneur deck has a published responsive web link. You can send it directly to investors, and our built-in viewer telemetry dashboard will notify you when they open it, showing how many minutes they spent on each slide.",
  },
  {
    q: "How does the AI market research & TAM calculation work?",
    a: "Instead of guessing market size on spreadsheets, iPreneur's AI queries live industry data, SEC filings, and recent comparable funding rounds to calculate defensible TAM, SAM, and SOM figures, complete with source citations that investors respect.",
  },
  {
    q: "Is my proprietary startup data and pitch material private?",
    a: "Yes. Your drafts, numbers, and inputs are encrypted with AES-256 at rest and TLS 1.3 in transit. We never use your proprietary pitch deck data or financial metrics to train public AI models.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedFormat, setSelectedFormat] = useState("pitch-deck");
  const [promptText, setPromptText] = useState("");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const currentSlide = LIVE_SLIDES[activeSlideIndex];

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = promptText.trim() || PROMPT_SUGGESTIONS[0];
    navigate(`/register?prompt=${encodeURIComponent(query)}&format=${selectedFormat}`);
  };

  const handleChipClick = (suggestion: string) => {
    setPromptText(suggestion);
  };

  const nextSlide = () => {
    setActiveSlideIndex((prev) => (prev + 1) % LIVE_SLIDES.length);
  };

  const prevSlide = () => {
    setActiveSlideIndex((prev) => (prev - 1 + LIVE_SLIDES.length) % LIVE_SLIDES.length);
  };

  const filteredTemplates =
    selectedCategory === "All"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category.toLowerCase().includes(selectedCategory.toLowerCase()));

  return (
    <div className="bg-white min-h-screen text-[#0F172A] font-sans selection:bg-blue-100 selection:text-blue-900 relative">
      {/* ── Sticky Floating Header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-50 px-4 sm:px-6 py-4 bg-white/80 backdrop-blur-md border-b border-neutral-100 transition-all">
        <header className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/ipreneur-logo.webp"
              alt="iPreneur"
              className="h-7 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 text-neutral-800 border border-neutral-200">
              <Sparkles className="w-3 h-3 text-blue-600" />
              AI 2.0
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-neutral-600">
            <a href="#features" className="hover:text-neutral-900 transition-colors">Features</a>
            <a href="#showcase" className="hover:text-neutral-900 transition-colors">Live Demo</a>
            <a href="#templates" className="hover:text-neutral-900 transition-colors">Templates</a>
            <a href="#comparison" className="hover:text-neutral-900 transition-colors">Why iPreneur</a>
            <a href="#faq" className="hover:text-neutral-900 transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-bold text-neutral-700 hover:text-neutral-900 px-3 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-xs sm:text-sm px-4 sm:px-5 py-2 font-bold rounded-full shadow-sm bg-[#0F172A] text-white hover:bg-black flex items-center gap-2 transition-all active:scale-95"
            >
              <span>Start Free</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
            </Link>
          </div>
        </header>
      </div>

      <div>
        {/* ── HERO SECTION ────────────────────────────────────────────── */}
        <section className="pt-12 sm:pt-20 pb-16 px-4 sm:px-6 max-w-6xl mx-auto text-center bg-white">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 mb-7 shadow-xs">
            <Zap className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs sm:text-sm font-semibold">
              Minimalist Monochrome · AI Pitch Deck Generator
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          </div>

          {/* Monumental Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-neutral-900 max-w-5xl mx-auto leading-[1.08] mb-6">
            Turn your idea into an{" "}
            <span className="ipr-gradient-text block sm:inline">investor-ready</span> pitch deck
          </h1>

          <p className="text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto font-normal leading-relaxed mb-10">
            Say goodbye to hours tweaking slide layouts and formatting. iPreneur crawls your site, models your market size, and crafts a compelling 10-slide deck in 90 seconds.
          </p>

          {/* ── Interactive Gamma-Style Prompt Generator Bar ─────────── */}
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-neutral-200 shadow-xl shadow-neutral-900/5">
              {/* Format pills */}
              <div className="flex items-center gap-1.5 sm:gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
                {FORMAT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedFormat(tab.id)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                      selectedFormat === tab.id
                        ? "bg-[#0F172A] text-white shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Prompt Input & Action */}
              <form onSubmit={handlePromptSubmit} className="relative flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full">
                  <input
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Enter your startup idea or drop your website URL (e.g. acme.ai)..."
                    className="w-full bg-neutral-50/70 hover:bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 sm:py-4 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all shadow-inner"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-3.5 sm:py-4 whitespace-nowrap text-sm font-bold flex items-center justify-center gap-2 rounded-xl bg-[#0F172A] text-white hover:bg-black transition-all shadow-md active:scale-98"
                >
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Generate Deck</span>
                  <ArrowRight className="w-4 h-4 text-blue-400" />
                </button>
              </form>

              {/* Prompt chips */}
              <div className="mt-3.5 flex items-center flex-wrap gap-2 text-left px-1">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Try:</span>
                {PROMPT_SUGGESTIONS.slice(0, 3).map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChipClick(chip)}
                    className="text-[11px] font-medium text-neutral-600 hover:text-blue-600 bg-neutral-50 hover:bg-blue-50/50 px-2.5 py-1 rounded-md border border-neutral-200 hover:border-blue-200 transition-all text-left truncate max-w-[240px] sm:max-w-none"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Micro badges below prompt bar */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-4 text-xs text-neutral-500 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                No design skills required
              </span>
              <span className="hidden sm:inline text-neutral-300">•</span>
              <span className="flex items-center gap-1.5 text-neutral-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Instant PowerPoint &amp; PDF export
              </span>
              <span className="hidden sm:inline text-neutral-300">•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                Investor engagement tracking
              </span>
            </div>
          </div>

          {/* ── 3D HERO PRESENTATION MOCKUP SHOWCASE ───────────────────── */}
          <div className="relative mt-12 sm:mt-16 mx-auto max-w-5xl group">
            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-2xl bg-white">
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-neutral-300" />
                  <div className="w-3 h-3 rounded-full bg-neutral-300" />
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="ml-3 text-xs text-neutral-500 font-mono hidden sm:inline">
                    iPreneur AI Deck Builder — Nexus AI Systems (Series A Deck)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                    Investor View Active
                  </span>
                  <Link
                    to="/register"
                    className="text-xs px-3 py-1 rounded-md font-bold bg-[#0F172A] text-white hover:bg-black transition-colors"
                  >
                    Open Live Deck
                  </Link>
                </div>
              </div>

              {/* Showcase Image */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-950">
                <img
                  src="/images/hero_deck_showcase.jpg"
                  alt="iPreneur AI Pitch Deck Generator Interface"
                  className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-[1.015]"
                />
                
                {/* Floating highlight badges */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 bg-white/95 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-neutral-200 max-w-xs text-left shadow-xl hidden sm:block">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-600 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generated Narrative</span>
                  </div>
                  <p className="text-xs text-neutral-700 leading-snug">
                    TAM breakdown, competitor graph, and unit economics synthesized in 90 seconds.
                  </p>
                </div>

                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-white/95 backdrop-blur-md rounded-xl p-3 border border-neutral-200 text-left shadow-xl hidden sm:flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900">PowerPoint Ready</div>
                    <div className="text-[11px] text-neutral-500">100% Vector PPTX + PDF</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LOGOS & SOCIAL PROOF BAR ─────────────────────────────────── */}
        <section className="py-14 border-y border-neutral-100 bg-[#FAFAFC]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-8">
              PITCH DECKS BUILT BY FOUNDERS FUNDED BY LEADING VENTURE FIRMS
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6 sm:gap-8 items-center justify-center opacity-65 hover:opacity-100 transition-opacity">
              <div className="text-base sm:text-lg font-bold tracking-tighter text-neutral-700">
                Y COMBINATOR
              </div>
              <div className="text-base sm:text-lg font-bold tracking-tight text-neutral-700 font-serif">
                SEQUOIA ◈
              </div>
              <div className="text-base sm:text-lg font-extrabold tracking-normal text-neutral-700">
                TECHSTARS_
              </div>
              <div className="text-base sm:text-lg font-semibold tracking-wide text-neutral-700">
                a16z crypto
              </div>
              <div className="text-base sm:text-lg font-bold tracking-tight text-neutral-700 font-sans">
                ACCEL
              </div>
              <div className="text-base sm:text-lg font-bold tracking-tight text-neutral-700">
                FOUNDERS FUND
              </div>
            </div>

            {/* Trust Metrics */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
                <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900">500K+</div>
                <div className="text-xs font-medium text-neutral-500 mt-1">Decks Generated</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">$680M+</div>
                <div className="text-xs font-medium text-neutral-500 mt-1">Raised by Founders</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
                <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900">94%</div>
                <div className="text-xs font-medium text-neutral-500 mt-1">Investor Response Rate</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-xs">
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-600">90s</div>
                <div className="text-xs font-medium text-neutral-500 mt-1">Average Build Time</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LIVE INTERACTIVE DECK SHOWCASE (GAMMA SLIDE VIEWER) ───────── */}
        <section id="showcase" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto bg-white">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="ipr-eyebrow mb-2 block">
              Interactive Deck Experience
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
              Test drive an investor deck in real time
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg mt-3">
              Click through the slides below to see how iPreneur renders crisp, on-brand slides dynamically without breaking alignment.
            </p>
          </div>

          {/* Slide Deck Container */}
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-xl overflow-hidden">
            {/* Top Toolbar: Slide Tabs */}
            <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
                {LIVE_SLIDES.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                      activeSlideIndex === idx
                        ? "bg-[#0F172A] text-white shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                    }`}
                  >
                    {slide.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Slide Canvas */}
            <div className="p-6 sm:p-12 min-h-[420px] sm:min-h-[480px] bg-white border-b border-neutral-200 flex flex-col justify-between transition-colors duration-500 relative">
              {/* Slide Meta Badge */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${currentSlide.badgeColor}`}>
                  {currentSlide.tag}
                </span>
                <div className="flex items-center gap-3 text-xs opacity-70 font-mono">
                  <span>Nexus AI · Series A</span>
                  <span>•</span>
                  <span>Confidential</span>
                </div>
              </div>

              {/* Slide Content Core */}
              <div className="my-8 max-w-3xl">
                <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-4 text-neutral-900">
                  {currentSlide.title}
                </h3>
                <p className="text-sm sm:text-base leading-relaxed mb-8 text-neutral-600">
                  {currentSlide.subtitle}
                </p>

                {/* Conditional Dynamic Data Blocks per Slide */}
                {currentSlide.type === "problem" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-red-600 text-xl font-bold">40+ Hours</div>
                      <div className="text-xs text-neutral-600 mt-1">Wasted per pitch deck on slide layout</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-amber-600 text-xl font-bold">82% Drop-off</div>
                      <div className="text-xs text-neutral-600 mt-1">VCs discard dense bullet-point slides</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-neutral-900 text-xl font-bold">Stale Data</div>
                      <div className="text-xs text-neutral-600 mt-1">Manual spreadsheets miss market shifts</div>
                    </div>
                  </div>
                )}

                {currentSlide.type === "solution" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-blue-600 font-bold text-sm mb-1">Web Crawl Engine</div>
                      <div className="text-xs text-neutral-600">Extracts positioning, tech stack, and ICP in seconds</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-blue-600 font-bold text-sm mb-1">Claude 3.5 Storycraft</div>
                      <div className="text-xs text-neutral-600">Narrative framing tailored for tier-1 partner meetings</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-neutral-900 font-bold text-sm mb-1">Responsive Decks</div>
                      <div className="text-xs text-neutral-600">Flawless on phone screens and conference projectors</div>
                    </div>
                  </div>
                )}

                {currentSlide.type === "market" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-xs uppercase font-bold text-neutral-500">Total Addressable (TAM)</div>
                      <div className="text-2xl font-black text-neutral-900 mt-1">$64 Billion</div>
                      <div className="text-[11px] text-neutral-500 mt-1">Global enterprise presentation spend</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-xs uppercase font-bold text-blue-600">Serviceable (SAM)</div>
                      <div className="text-2xl font-black text-blue-600 mt-1">$18.2 Billion</div>
                      <div className="text-[11px] text-neutral-500 mt-1">Tech founders &amp; venture ecosystems</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-xs uppercase font-bold text-neutral-900">Obtainable (SOM)</div>
                      <div className="text-2xl font-black text-neutral-900 mt-1">$3.4 Billion</div>
                      <div className="text-[11px] text-neutral-500 mt-1">AI-assisted deck creation &amp; analytics</div>
                    </div>
                  </div>
                )}

                {currentSlide.type === "traction" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-emerald-600 text-xl font-bold">+380% YoY</div>
                      <div className="text-xs text-neutral-600 mt-1">Organic user growth via founder shares</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-blue-600 text-xl font-bold">$180K MRR</div>
                      <div className="text-xs text-neutral-600 mt-1">Scaling towards $4.5M ARR run-rate</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-neutral-900 text-xl font-bold">142% NDR</div>
                      <div className="text-xs text-neutral-600 mt-1">Team seat expansions across startups</div>
                    </div>
                  </div>
                )}

                {currentSlide.type === "business" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-blue-600 font-bold text-sm">Self-Serve Pro ($29/mo)</div>
                      <div className="text-xs text-neutral-600 mt-1">Unlimited AI deck generations, PowerPoint export, viewer analytics</div>
                    </div>
                    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                      <div className="text-neutral-900 font-bold text-sm">Venture &amp; Accelerator Tier ($499/mo)</div>
                      <div className="text-xs text-neutral-600 mt-1">Batch deck auditing, branded accelerator themes, deal-flow portals</div>
                    </div>
                  </div>
                )}

                {currentSlide.type === "ask" && (
                  <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                      <span className="text-sm font-bold text-neutral-900">Use of Funds ($3.5M Seed Round)</span>
                      <span className="text-xs font-mono font-bold text-blue-600">$1.8M already committed by lead VC</span>
                    </div>
                    <div className="w-full h-3 bg-neutral-200 rounded-full overflow-hidden flex">
                      <div className="bg-[#0F172A] h-full w-[60%]" title="60% Multimodal AI & Engineering" />
                      <div className="bg-blue-600 h-full w-[25%]" title="25% Go-To-Market & Accelerator Growth" />
                      <div className="bg-neutral-400 h-full w-[15%]" title="15% Operations & Legal" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-2 font-medium">
                      <span>■ 60% AI Core &amp; Infra</span>
                      <span>■ 25% Growth</span>
                      <span>■ 15% Ops</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Nav Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevSlide}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition-colors shadow-xs"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={nextSlide}
                    className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-bold text-neutral-800 transition-colors shadow-xs"
                  >
                    Next →
                  </button>
                  <span className="text-xs text-neutral-500 ml-2 font-mono">
                    Slide {activeSlideIndex + 1} of {LIVE_SLIDES.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/register"
                    className="text-xs px-4 py-1.5 rounded-full font-bold bg-[#0F172A] text-white hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Export This Deck</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FORMAT CARDS: "GENERATE ANYTHING IN SECONDS" ─────────────── */}
        <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-100 bg-white">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="ipr-eyebrow mb-2 block">
              Flexible AI Formats
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
              One prompt. Every format your raise demands.
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg mt-3">
              Break free from rigid 16:9 boxes. Create pitch decks, dense memos, or live shareable web summaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Pitch Decks */}
            <div className="bg-white rounded-2xl p-7 border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-6 shadow-xs">
                  <Layout className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Investor Pitch Decks</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                  10 to 12 sequenced slides curated for VC partner meetings. Problem, market size, traction, and unit economics organized with razor-sharp clarity.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-blue-600 font-bold">
                <span>PPTX + PDF Ready</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 2: Interactive Web Summaries */}
            <div className="bg-white rounded-2xl p-7 border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 shadow-xs">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Interactive Web Decks</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                  Send investors a lightning-fast responsive link. No bulky 45MB email attachments. Includes built-in slide analytics to see who is reading.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-blue-600 font-bold">
                <span>Live View Analytics</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 3: Executive One-Pagers */}
            <div className="bg-white rounded-2xl p-7 border border-neutral-200 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-6 shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">Executive One-Pagers</h3>
                <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                  High-density investor memos perfect for initial cold outreach and angel syndicates. Packs team credentials, growth KPIs, and the round ask.
                </p>
              </div>
              <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-blue-600 font-bold">
                <span>High Signal Teaser</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </section>

        {/* ── VISUAL DEEP DIVES (FEATURING GENERATED IMAGES) ───────────── */}
        <section id="features" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-100 bg-white">
          {/* Feature 1: Market Research */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-800 mb-4">
                <Cpu className="w-3.5 h-3.5 text-blue-600" />
                <span>Automated Market Intelligence</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight mb-4">
                Never guess your TAM or competitor landscape again.
              </h3>
              <p className="text-neutral-600 text-base leading-relaxed mb-6">
                Most pitch decks get shredded during partner meetings for generic market stats. iPreneur crawls current industry metrics, queries venture databases, and generates defensible market sizing charts backed by real data.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Calculates defensible TAM, SAM, and SOM with cited methodologies
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Auto-maps 2x2 competitor positioning matrix highlighting your unique moat
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Extracts recent valuation multiples and exit comparables in your sector
                  </span>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-xl bg-white">
              <img
                src="/images/market_research_ai.jpg"
                alt="AI Market Intelligence and Competitor Matrix"
                className="w-full h-auto object-cover transform transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>
          </div>

          {/* Feature 2: Investor Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1 relative rounded-2xl overflow-hidden border border-neutral-200 shadow-xl bg-white">
              <img
                src="/images/investor_analytics.jpg"
                alt="Investor Deck Engagement Analytics Dashboard"
                className="w-full h-auto object-cover transform transition-transform duration-500 hover:scale-[1.02]"
              />
            </div>

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 mb-4">
                <Eye className="w-3.5 h-3.5" />
                <span>Deal-Flow Telemetry</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight mb-4">
                See exactly which slides investors spend time on.
              </h3>
              <p className="text-neutral-600 text-base leading-relaxed mb-6">
                Stop wondering if the partner actually opened your deck. iPreneur delivers slide-by-slide engagement telemetry so you enter every pitch meeting armed with unfair information.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Real-time notifications when an investor opens your link
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Heatmap of seconds spent on financials vs team vs unit economics
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm text-neutral-700 font-medium">
                    Password protection, expiration dates, and one-click access revocation
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TEMPLATE GALLERY ────────────────────────────────────────── */}
        <section id="templates" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-100 bg-white">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="ipr-eyebrow mb-2 block">
              Venture-Vetted Templates
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
              Start with decks that actually raised capital
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg mt-3">
              Browse proven pitch deck architectures modeled after successful Series Seed and Series A raises.
            </p>

            {/* Category Filters */}
            <div className="flex items-center justify-center flex-wrap gap-2 mt-8">
              {["All", "AI & SaaS", "Fintech", "DeepTech", "Enterprise"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-bold px-4 py-2 rounded-full transition-all ${
                    selectedCategory === cat
                      ? "bg-[#0F172A] text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-2xl overflow-hidden border border-neutral-200 hover:border-neutral-400 transition-all duration-300 group flex flex-col justify-between shadow-sm hover:shadow-md"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-slate-950">
                  <img
                    src={template.image}
                    alt={template.title}
                    className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold text-neutral-900 border border-neutral-200 shadow-xs">
                    {template.stage}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-bold text-neutral-900 flex items-center gap-1 border border-neutral-200 shadow-xs">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>{template.rating}</span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-lg font-bold text-neutral-900 group-hover:text-blue-600 transition-colors">
                      {template.title}
                    </h4>
                    <span className="text-xs text-neutral-500 font-mono">{template.slides}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded bg-neutral-50 border border-neutral-200 text-neutral-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <span className="text-xs font-bold text-neutral-500">{template.category}</span>
                    <Link
                      to={`/register?template=${encodeURIComponent(template.title)}`}
                      className="text-xs px-4 py-2 rounded-full font-bold bg-[#0F172A] text-white hover:bg-black transition-colors flex items-center gap-1.5"
                    >
                      <span>Use Template</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BEFORE & AFTER COMPARISON ────────────────────────────────── */}
        <section id="comparison" className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-100 bg-white">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="ipr-eyebrow mb-2 block">
              The Fundamental Upgrade
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
              Why top founders are ditching legacy slides
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg mt-3">
              Comparing 1990s slide software with iPreneur's AI-native presentation engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="p-8 rounded-3xl bg-[#FFF9F9] border border-red-200/70 shadow-xs">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  ✕
                </div>
                <h3 className="text-xl font-bold text-red-900">The Traditional Slide Way</h3>
              </div>

              <div className="space-y-4 text-sm text-neutral-600">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>40+ hours spent:</strong> Wrestling text box margins, font sizes, and layout bugs.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Wall of text bullets:</strong> VCs get bored after slide 2 and miss your key traction.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Stale market stats:</strong> Copy-pasting outdated analyst charts from Google image search.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Clunky attachments:</strong> 50MB PDFs that bounce in VC inboxes or look broken on mobile.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-red-500 font-bold">•</span>
                  <span><strong>Zero viewer telemetry:</strong> Complete blind spot on whether an investor actually read your deck.</span>
                </div>
              </div>
            </div>

            {/* The iPreneur Way */}
            <div className="p-8 rounded-3xl bg-white border-2 border-neutral-900 shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-neutral-900">The iPreneur Way</h3>
              </div>

              <div className="space-y-4 text-sm text-neutral-700">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Ready in 90 seconds:</strong> Full 10-slide narrative crafted from your URL or prompt.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Adaptive card layouts:</strong> Crisp visuals, charts, and metrics formatted automatically.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Live market research:</strong> Defensible TAM/SAM/SOM modeled with recent comparable rounds.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Responsive web link + PPTX:</strong> Opens instantly on phones, laptops, and Keynote/PowerPoint.</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 font-bold">✓</span>
                  <span><strong>Slide heatmaps:</strong> Know the second an investor opens your deck and what they spent time on.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TESTIMONIALS / WALL OF LOVE ─────────────────────────────── */}
        <section className="py-20 px-4 sm:px-6 max-w-6xl mx-auto border-t border-neutral-100 bg-white">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="ipr-eyebrow mb-2 block">
              Founder Experiences
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-neutral-900 tracking-tight">
              Trusted by founders who closed rounds
            </h2>
            <p className="text-neutral-600 text-base sm:text-lg mt-3">
              Real stories from founders who raised millions using iPreneur.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-neutral-900 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-neutral-900" />
                  ))}
                </div>
                <p className="text-neutral-700 text-sm leading-relaxed mb-6 italic">
                  "We closed our $3.2M Seed in under three weeks. The lead partner specifically mentioned that our deck stood out from the 50 other pitch decks he saw that week because of the clarity of our market TAM and unit economics."
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <div>
                  <div className="text-sm font-bold text-neutral-900">Elena Rostova</div>
                  <div className="text-xs text-neutral-500">CEO, SynthAI (YC W25)</div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded font-bold bg-neutral-100 text-neutral-800">
                  $3.2M Seed
                </span>
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-neutral-900 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-neutral-900" />
                  ))}
                </div>
                <p className="text-neutral-700 text-sm leading-relaxed mb-6 italic">
                  "I was spending entire weekends fighting PowerPoint formatting. With iPreneur, dropping our staging URL produced an 11-slide deck with our exact brand typography and colors in 90 seconds. Mind-blowing."
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <div>
                  <div className="text-sm font-bold text-neutral-900">Marcus Vance</div>
                  <div className="text-xs text-neutral-500">Co-founder, NovaPay</div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-bold">
                  $12M Series A
                </span>
              </div>
            </div>

            <div className="p-7 rounded-2xl bg-white border border-neutral-200 shadow-sm hover:shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1 text-neutral-900 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-neutral-900" />
                  ))}
                </div>
                <p className="text-neutral-700 text-sm leading-relaxed mb-6 italic">
                  "The investor analytics are an unfair advantage. Knowing that a partner spent 3 minutes re-reading our gross margin slide allowed me to open our partner meeting directly addressing their unit economics questions."
                </p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                <div>
                  <div className="text-sm font-bold text-neutral-900">Priya Sharma</div>
                  <div className="text-xs text-neutral-500">Founder, BioPulse</div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-neutral-100 text-neutral-800 font-bold">
                  $5.8M Seed
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── INTERACTIVE FAQ ACCORDION ────────────────────────────────── */}
        <section id="faq" className="py-20 px-4 sm:px-6 max-w-4xl mx-auto border-t border-neutral-100 bg-white">
          <div className="text-center mb-12">
            <span className="ipr-eyebrow mb-2 block">
              Common Questions
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Everything you need to know
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 text-neutral-900 font-bold text-base sm:text-lg hover:text-blue-600"
                >
                  <span>{faq.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 text-neutral-600 text-sm leading-relaxed border-t border-neutral-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA BANNER ─────────────────────────────────────────── */}
        <section className="py-24 px-4 sm:px-6 max-w-6xl mx-auto text-center bg-white">
          <div className="rounded-3xl p-8 sm:p-16 shadow-2xl text-white relative overflow-hidden bg-[#0F172A]">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-xs font-bold text-white mb-6 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Join 50,000+ Founders Pitching with iPreneur</span>
            </span>

            <h2 className="text-3xl sm:text-6xl font-extrabold text-white tracking-tight max-w-3xl mx-auto leading-tight mb-6">
              Your next raise starts with a great deck.
            </h2>

            <p className="text-neutral-300 text-base sm:text-lg max-w-xl mx-auto mb-10">
              Generate your full 10-slide investor deck in under two minutes. Free to start, no credit card required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-500 transition-all transform hover:-translate-y-0.5"
              >
                <span>Generate Your Pitch Deck</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-400 font-semibold">
              <span>✓ Free 300 AI Credits</span>
              <span>•</span>
              <span>✓ Export to PPTX &amp; PDF</span>
              <span>•</span>
              <span>✓ 100% Private Data</span>
            </div>
          </div>
        </section>

        {/* ── MODERN FOOTER ───────────────────────────────────────────── */}
        <footer className="border-t border-neutral-200 bg-white py-12 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src="/ipreneur-logo.webp"
                alt="iPreneur"
                className="h-6 w-auto object-contain"
              />
              <span className="text-xs text-neutral-500 font-mono">
                © 2026 iPreneur Inc. · Minimalist Edition
              </span>
            </div>

            <div className="flex items-center gap-6 text-xs font-semibold text-neutral-600">
              <a href="#features" className="hover:text-neutral-900 transition-colors">Features</a>
              <a href="#templates" className="hover:text-neutral-900 transition-colors">Templates</a>
              <a href="#comparison" className="hover:text-neutral-900 transition-colors">Comparison</a>
              <Link to="/login" className="hover:text-neutral-900 transition-colors">Sign in</Link>
              <Link to="/register" className="hover:text-neutral-900 transition-colors">Get Started</Link>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All AI Generators Operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
