"""
Content Generation Agent v3 — Intelligent per-slide data routing using GEMINI API KEY 1.

Intelligence model:
  Each of the 11 slides has a precisely defined:
    • PURPOSE  — what this slide must communicate to an investor
    • DATA SRC — exactly which fields from company/industry/analysis to use
    • LAYOUT   — the visual layout that best fits the content type
    • RULES    — what must NOT appear on this slide (keeps slides clean)

The prompt gives Gemini a "blueprint" per slide so it knows not just what to
write but WHY and WHERE the data comes from. This prevents content bleed
(e.g., market size numbers appearing on the team slide).

Key usage: settings.gemini_api_key (Key 1) — same key as BrandingExtractor
and AnalysisAgent. The deck content is the final synthesis step.
"""
import json
import re
from dataclasses import dataclass, field
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.core.genai_client import make_genai_client
from app.services.branding.extractor import BrandingData
from app.agents.research.research_agent import ResearchData
from app.services.crawler.web_crawler import CrawlResult


@dataclass
class SlideContent:
    slide_number: int
    slide_type: str
    layout: str
    title: str
    subtitle: str = ""
    body: str = ""
    bullet_points: list[str] = field(default_factory=list)
    data_points: list[dict] = field(default_factory=list)
    cards: list[dict] = field(default_factory=list)
    columns: list[dict] = field(default_factory=list)
    speaker_notes: str = ""


@dataclass
class DeckContent:
    slides: list[SlideContent] = field(default_factory=list)
    deck_title: str = ""
    deck_subtitle: str = ""

    def model_dump(self) -> dict:
        return {
            "deck_title": self.deck_title,
            "deck_subtitle": self.deck_subtitle,
            "slides": [
                {
                    "id": str(s.slide_number),
                    "slide_number": s.slide_number,
                    "slide_type": s.slide_type,
                    "type": s.slide_type,
                    "layout": s.layout,
                    "title": s.title,
                    "subtitle": s.subtitle,
                    "body": s.body,
                    "content": s.body,
                    "bullet_points": s.bullet_points,
                    "data_points": s.data_points,
                    "cards": s.cards,
                    "columns": s.columns,
                    "speaker_notes": s.speaker_notes,
                }
                for s in self.slides
            ],
        }


def _str(v) -> str:
    if isinstance(v, dict):
        return v.get("text") or v.get("content") or v.get("value") or str(v)
    return str(v) if v is not None else ""


def _extract_json_payload(raw: str) -> str:
    s = raw
    if "```json" in s:
        s = s.split("```json", 1)[1]
    elif "```" in s:
        s = s.split("```", 1)[1]
    start, end = s.find("{"), s.rfind("}")
    if start != -1 and end != -1 and end > start:
        s = s[start:end + 1]
    return s.strip()


class ContentGenerationAgent:
    """
    Generates 11-slide investor deck using Key 1.
    Each slide follows a strict data blueprint to ensure correct content placement.
    """

    def __init__(self):
        # KEY 1: Company analysis key — also handles content generation
        api_key = settings.gemini_api_key
        if not api_key:
            raise ValueError("GEMINI_API_KEY (Key 1) is not configured")
        self._client = make_genai_client(api_key)
        self._model = settings.gemini_model

    async def generate(
        self,
        branding: BrandingData,
        research: ResearchData,
        crawl_data: CrawlResult,
        analysis: Optional[object] = None,  # AnalysisData — optional import avoids circular ref
    ) -> DeckContent:
        logger.info(f"📝 Generating 13-slide deck (McKinsey structure) | company={branding.company_name} [Key 1]")

        prompt = self._build_prompt(branding, research, crawl_data, analysis)

        raw = ""
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=prompt,
            )
            raw = response.text

            json_str = _extract_json_payload(raw)
            json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
            data = json.loads(json_str)

            slides_raw = data.get("slides", [])
            slides = []
            for i, s in enumerate(slides_raw):
                slides.append(SlideContent(
                    slide_number=i + 1,
                    slide_type=_str(s.get("slide_type", "content")),
                    layout=_str(s.get("layout", "title_bullets")),
                    title=_str(s.get("title", "")),
                    subtitle=_str(s.get("subtitle", "")),
                    body=_str(s.get("body", "")),
                    bullet_points=[_str(b) for b in s.get("bullet_points", [])],
                    data_points=s.get("data_points", []),
                    cards=s.get("cards", []),
                    columns=s.get("columns", []),
                    speaker_notes=_str(s.get("speaker_notes", "")),
                ))

            deck = DeckContent(
                slides=slides,
                deck_title=data.get("deck_title", f"{branding.company_name} — Investor Deck"),
                deck_subtitle=data.get("deck_subtitle", ""),
            )
            logger.info(f"✅ Generated {len(deck.slides)} slides")
            return deck

        except Exception as exc:
            logger.error(f"❌ Content generation failed: {exc}")
            if raw:
                logger.debug(f"Raw output (first 3000 chars): {raw[:3000]}")
            return self._fallback_deck(branding, research, analysis)

    def _build_prompt(
        self,
        b: BrandingData,
        r: ResearchData,
        crawl: CrawlResult,
        a: Optional[object],
    ) -> str:
        # Prepare all data sections cleanly
        competitors_block = "\n".join(
            f"  {i+1}. {c.get('name','')}: {c.get('description','')} | "
            f"Strength: {c.get('strength','')} | Weakness: {c.get('weakness','')}"
            for i, c in enumerate(r.competitors[:5])
        )
        products_block = ", ".join(b.key_products[:6]) if b.key_products else "See website content"
        trends_block = "\n".join(f"  • {t}" for t in r.industry_trends[:5])
        pains_block = "\n".join(f"  • {p}" for p in r.pain_points[:5])
        revenue_streams_block = ", ".join(r.revenue_streams[:4])
        tam = r.tam_sam_som.get("tam", {})
        sam = r.tam_sam_som.get("sam", {})
        som = r.tam_sam_som.get("som", {})
        website_content = (crawl.text_summary or "")[:3500]
        pricing_signals = "\n".join(crawl.pricing_info[:8]) if crawl.pricing_info else "Not detected"
        market_drivers_block = "\n".join(f"  • {d}" for d in r.market_drivers[:4]) if r.market_drivers else "  • Strong market tailwinds in sector"

        # Founders block — from research (external sources) + website crawl signals
        founders_block = "\n".join(
            f"  • {f.get('name', 'Unknown')} — {f.get('title', '')} | {f.get('background', '')}"
            for f in r.founders[:5]
        ) if r.founders else ""
        team_info_block = "\n".join(f"  • {t}" for t in crawl.team_info[:15]) if crawl.team_info else ""
        combined_team_block = (founders_block + ("\n" if founders_block and team_info_block else "") + team_info_block) or "  • No specific team members identified"

        # Funding block
        funding_rounds_block = "\n".join(
            f"  • {rd.get('round', '')} — {rd.get('amount', '')} ({rd.get('date', '')}) | Investors: {', '.join(rd.get('investors', []))}"
            for rd in r.funding_rounds[:5]
        ) if r.funding_rounds else "  • No funding data found"

        # Analysis section (if available)
        analysis_block = ""
        if a:
            try:
                icp = a.icp
                score = a.investor_score
                analysis_block = f"""
INVESTOR SYNTHESIS (pre-computed — use these insights to strengthen slides):
  Positioning: {a.positioning}
  Investor Score: {score.score}/10 — {score.summary}
  Why Invest (highlights): {' | '.join(score.highlights)}
  Key Concerns: {' | '.join(score.concerns)}

  ICP (Ideal Customer):
    Who: {icp.description}
    Company Size: {icp.company_size}
    Industry: {icp.industry_vertical}
    Buyers: {', '.join(icp.job_titles)}
    Primary Pain: {icp.primary_pain}
    Budget: {icp.budget_range}
    Buying Trigger: {icp.buying_trigger}

  Competitive Moat: {a.competitive_moat}
  Market Timing: {a.market_opportunity}
  Scalability: {a.scalability}

  Revenue Scenarios:
{chr(10).join(f"    {s['scenario']}: {s['arr']} (assumption: {s['assumption']})" for s in a.revenue_scenarios)}

  GTM Strategy:
{chr(10).join(f"    • {g}" for g in a.gtm_strategy)}

  SWOT Strengths: {' | '.join(a.swot.strengths[:3])}
  SWOT Weaknesses: {' | '.join(a.swot.weaknesses[:2])}
"""
            except Exception:
                pass

        return f"""You are the world's best pitch deck writer. You've helped companies raise $2B+ from Sequoia, a16z, and Bessemer.
Your decks are known for Sequoia-style storytelling with McKinsey-quality data.

You will generate a 13-slide investor pitch deck using the McKinsey Pyramid Principle structure.
Lead with the conclusion — the Executive Summary gives the full investment thesis upfront.
Each slide has a strict blueprint — follow it exactly. Never put content from one slide onto a different slide.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY DATA (from website crawl)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Name:          {b.company_name}
  Industry:      {b.industry}
  What & How:    {r.company_description or b.description}
  Tagline:       {b.tagline}
  Target Users:  {b.target_audience}
  Products:      {products_block}
  Business Model:{b.business_model or r.business_model}
  Tech Stack:    {', '.join(b.tech_stack) if b.tech_stack else 'Modern cloud stack'}
  Pricing:       {pricing_signals}
  Testimonials:  {len(b.testimonials)} found on site

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY PROFILE (from external research — use as verified facts)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Founded:       {r.founded_year or 'Unknown'}
  Valuation:     {r.company_valuation or 'Not publicly disclosed'}
  Total Funding: {r.total_funding or 'Not publicly disclosed'}
  Headcount:     {r.company_headcount or 'Not publicly disclosed'}
  Operations:    {r.operational_presence or 'Not publicly disclosed'}

  Funding Rounds:
{funding_rounds_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INDUSTRY DATA (from market research)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TAM:           {r.market_size}
  Growth:        {r.market_growth}
  Target Market: {r.target_market}
  TAM value:     {tam.get('value', '?')} — {tam.get('description', '')}
  SAM value:     {sam.get('value', '?')} — {sam.get('description', '')}
  SOM value:     {som.get('value', '?')} — {som.get('description', '')}
  Revenue Model: {r.business_model}
  Revenue Streams: {revenue_streams_block}
  Funding:       {r.funding_info}

  Competitors (real, named):
{competitors_block}

  Industry Trends:
{trends_block}

  Customer Pain Points:
{pains_block}

  Customer Segments: {', '.join(r.customer_segments[:4])}
  Recent News: {' | '.join(r.recent_news[:3])}

  Market Narrative (use verbatim in Executive Summary body): {r.market_narrative}
  Why Now (timing thesis — use in Executive Summary + Market Opportunity): {r.why_now}
  Market Drivers (use as bullet_points in Market Opportunity slide):
{market_drivers_block}
{analysis_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAM (use for Slide 8 — use REAL names and backgrounds from research)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{combined_team_block}

WEBSITE CONTENT:
{website_content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE BLUEPRINTS — McKinsey Pyramid Structure. Follow exactly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SLIDE 1 — COVER  [layout: full_bleed]
  PURPOSE: First impression. Company name, tagline, one-sentence what+how description.
  RULE: Title = exact company name. Subtitle = value proposition max 12 words. Body = 1 sentence.
  DO NOT USE: numbers, market data, bullet points, competitor names.

SLIDE 2 — EXECUTIVE SUMMARY  [layout: big_number]
  PURPOSE: Pyramid Principle — lead with the conclusion. A busy investor reads this slide and knows the full investment thesis before slide 3. Must compress problem, solution, market, traction, and ask into one powerful slide.
  USE: company_description, market_size, market_growth, company_valuation, total_funding, founded_year, operational_presence.
  FORMAT:
    - title: "Executive Summary"
    - subtitle: One sentence investment thesis: "{b.company_name} is [what they do] for [who], solving [the problem] in a $X market growing at X% CAGR."
    - body: exactly 3 sentences — Sentence 1: WHAT & HOW ({b.company_name} does X by Y mechanism). Sentence 2: WHY the market is at an inflection point right now. Sentence 3: WHERE they are today — traction, funding stage, or key milestone.
    - data_points: exactly 4 — TAM, CAGR, one traction/company signal (valuation, ARR, or customers), funding stage or ask.
  RULES: Investor must understand the full picture from this slide alone. Be specific — no generic filler.
  DO NOT USE: competitor names, feature lists.

SLIDE 3 — MARKET OPPORTUNITY  [layout: growth_curve REQUIRED for TAM trend visualization]
  PURPOSE: Show the prize. Start with how big and how fast — before the problem, before the product. Investors need to know the opportunity is worth their time.
  USE: Market Narrative, Why Now, Market Drivers, TAM/SAM/SOM.
  FORMAT: layout = "growth_curve" (REQUIRED). title = "Market Opportunity". subtitle = specific inflection point. body = 2-3 sentences on WHY this market is moving NOW (name specific forces — AI, regulation, demographic shift). data_points = exactly 4 objects with {label, value}: TAM, SAM, SOM (Y3), CAGR. bullet_points = 3-4 Market Drivers each with bold lead-in + stat.
  RULES: Every driver must have a statistic. Use real TAM/SAM/SOM values. Body must be specific to {b.industry}.
  EXAMPLE: {"layout": "growth_curve", "data_points": [{"label": "TAM 2024", "value": "$50B"}, {"label": "TAM 2025", "value": "$65B"}, {"label": "TAM 2026", "value": "$85B"}, {"label": "CAGR", "value": "30%"}]}
  DO NOT USE: product features, competitor names, team info.

SLIDE 4 — PROBLEM  [layout: title_bullets]
  PURPOSE: After showing the prize, reveal the gap — what specific problem in this large market is unsolved. The investor now cares about the pain because they've already seen how big the opportunity is.
  USE: pain_points, customer_segments, industry context.
  FORMAT: title = punchy problem statement (not "The Problem" — make it specific e.g. "Grocery Delivery Still Takes 45 Minutes"). subtitle = 1 sentence naming the core pain for {b.target_audience}. body = 1-2 sentences quantifying the cost of this problem ($ lost, % affected, time wasted). bullet_points = 3-4 specific pains each with a real stat: "**Pain:** [quantified impact]".
  RULES: Every bullet quantified. Do not mention {b.company_name}'s solution here — only the problem.
  DO NOT USE: TAM numbers (covered), competitor names, product features.

SLIDE 5 — SOLUTION  [layout: cards]
  PURPOSE: The answer to the problem. Show WHAT {b.company_name} built, HOW it works mechanically, and WHY it works better than anything else.
  USE: company_description, key_products, tech_stack, website content.
  FORMAT: title = "The Solution". subtitle = 1-sentence what+how: "{b.company_name} is a [category] that [solves what] by [specific mechanism]." 3 cards — each = one core capability: title = 2-4 words, body = customer outcome in 1-2 sentences, metric = key differentiator or stat.
  RULES: Subtitle MUST name the mechanism — how it works, not just what category it's in.
  DO NOT USE: market data, team info, financial projections.

SLIDE 6 — PRODUCT  [layout: process_flow REQUIRED for showing how product works step-by-step]
  PURPOSE: Go deeper on HOW the product works — the 3 capabilities that make customers love it. Feature-benefit framing.
  USE: key_products, tech_stack, pricing signals, website content.
  FORMAT: layout = "process_flow" (REQUIRED). title = "How [Product Name] Works". bullet_points = exactly 5 sequential steps/capabilities, each with **bold lead-in**: "**Step 1:** [description]", "**Step 2:** [description]", etc. Each step shows one key feature and its customer benefit.
  RULES: Each step must be a sequential part of the user/customer journey. If tech_stack has a differentiator (AI, real-time, API-first), name it in the appropriate step. Steps flow logically from input → processing → output.
  EXAMPLE: {"layout": "process_flow", "bullet_points": ["**Input:** Customer uploads data or connects API", "**Processing:** AI engine analyzes patterns in real-time", "**Output:** Generates actionable insights dashboard", "**Integration:** Syncs with existing tools automatically", "**Impact:** 10x faster insights vs manual analysis"]}
  DO NOT USE: market data, team info, financial projections.

SLIDE 7 — BUSINESS MODEL  [layout: cards]
  PURPOSE: How the company makes money and why unit economics work.
  USE: business model, revenue_streams, pricing signals from website, ICP budget range.
  FORMAT: 3 cards. Card 1 = primary revenue, Card 2 = secondary stream, Card 3 = expansion/upsell. Each: title = revenue type, body = how it works + pricing signal, metric = $ ACV or % margin if known.
  DO NOT USE: market size, team details, competitor comparisons.

SLIDE 8 — TRACTION  [layout: timeline REQUIRED for milestone visualization]
  PURPOSE: Proof it's working. The most credibility-building slide — real numbers, real customers, real milestones.
  USE: FOUNDER-PROVIDED METRICS first (ARR, MRR, customers, MAU, growth rate), then company_traction research, recent_news, funding_info, company_valuation, total_funding.
  FORMAT: layout = "timeline" (REQUIRED). title = "Traction". subtitle = one punchy headline metric (e.g. "$2.5M ARR, 500+ Customers"). body = 1-2 sentences on the growth story. bullet_points = exactly 5 milestone bullets as a chronological timeline, each with **bold lead-in**: "**Q1 2023:** Founded and launched MVP", "**Q3 2023:** First 50 customers", etc.
  RULES: FOUNDER-PROVIDED METRICS are ground truth — use them exactly. Never fabricate a specific number. Milestones must be chronological. Include founding date, key product launches, customer milestones, funding rounds, or traction inflection points.
  EXAMPLE: {"layout": "timeline", "bullet_points": ["**Q4 2022:** Founded by ex-Google team", "**Q2 2023:** MVP launch with 10 beta customers", "**Q1 2024:** Series Seed $1.2M, 100+ customers", "**Q3 2024:** Hit $500k ARR milestone", "**Q1 2025:** 500+ customers, 3x MoM growth"]}
  DO NOT USE: market size, financial projections, competitor names.

SLIDE 9 — COMPETITIVE LANDSCAPE  [layout: cards]
  PURPOSE: Show investors you know exactly who you compete with, why they fall short, and what makes {b.company_name} defensibly better.
  USE: competitors list (real named companies from research), competitive_moat, competitive_advantages, positioning.
  FORMAT:
    - title: "Competitive Landscape"
    - subtitle: one sentence on {b.company_name}'s core moat — what makes it defensibly different.
    - cards: exactly 3 cards, each representing ONE real named competitor:
        title = competitor's real company name (e.g. "Blinkit", "Jira", "Salesforce") — NOT "Competitor 1"
        body = 2 sentences: Sentence 1 = what this competitor does and their market position. Sentence 2 = their specific weakness or limitation that {b.company_name} exploits.
        metric = {b.company_name}'s specific edge over this competitor (e.g. "3x faster delivery", "50% lower cost", "AI-native vs bolt-on")
  RULES:
    - Every card title MUST be a real company name from the competitors list in the research data above.
    - The metric must be a specific, concrete differentiator — not generic like "better UX".
    - If research has fewer than 3 named competitors, use the available ones and fill the last card with the category of legacy alternatives (e.g. "Legacy ERPs", "Manual Processes").
  DO NOT USE: made-up competitor names, market size data, team info, financial data.

SLIDE 10 — TEAM  [layout: cards]
  PURPOSE: Investors bet on people. Show why THIS specific team wins this specific market.
  USE: TEAM section above — REAL names and backgrounds from founders list and website signals.
  FORMAT: 3 cards. Each: title = "Full Name — Role", body = specific background (prior company, domain expertise, key achievement), metric = strongest credential ("Ex-Google", "2x founder", "Stanford CS", "15 yrs in {b.industry}").
  RULES: Use real names if available. If fewer than 3: 2 real + 1 "Key Hire" card. If none found: title = "Experienced Founding Team", body = domain expertise summary.
  DO NOT USE: market data, product features, financial projections.

SLIDE 11 — FINANCIALS  [layout: big_number]
  PURPOSE: The numbers — credible 3-year projections with clear assumptions. Investors need this to model their return.
  USE: revenue_scenarios from analysis (Y1/Y2/Y3), business model, market growth rate, FOUNDER-PROVIDED METRICS as Y0 anchor.
  FORMAT: title = "Financial Projections". subtitle = path to scale in one line. data_points = exactly 4: Year 1 ARR, Year 2 ARR, Year 3 ARR, Gross Margin target. body = 1-2 sentences on path to profitability and key assumptions (CAC payback, LTV:CAC).
  RULES: If founder provided ARR/MRR in FOUNDER-PROVIDED METRICS, use as Y0 anchor. Base projections on revenue_scenarios from analysis.
  DO NOT USE: market size (covered), competitor names, product details.

SLIDE 12 — THE ASK  [layout: cards]
  PURPOSE: Close the investor. Be specific — exactly how much, exactly what it funds, exactly what milestone it unlocks.
  USE: ask_amount from FOUNDER-PROVIDED METRICS if present, revenue_scenarios, gtm_strategy, total_funding (to show track record), funding_rounds.
  FORMAT: title = "The Ask". subtitle = "Raising $X — path to [specific milestone]". 3 cards: Card 1 = Product (40%), Card 2 = GTM/Sales (40%), Card 3 = Ops/Team (20%). Each: title = use category, body = specific actions funded, metric = % or $ amount.
  RULES: Use exact ask_amount if in FOUNDER-PROVIDED METRICS. state the milestone the funding reaches.
  DO NOT USE: market size, traction covered, competitor data.

SLIDE 13 — CLOSING  [layout: full_bleed]
  PURPOSE: Leave a bold, memorable vision. The last thing investors see — make them want to take the meeting.
  USE: company name, positioning from analysis, operational_presence, founded_year.
  FORMAT: title = bold future-vision statement (5-8 words, forward-looking — not the tagline). subtitle = "Join us in building [vision]." body = one-line contact CTA.
  DO NOT USE: numbers, bullet points, competitor names.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Return EXACTLY 13 slides — no more, no less.
2. Every bullet_point must have a bold lead-in: "**Speed:** 10x faster..." or "**Pain:** 67% of companies..."
3. Cards: title = 2-5 words. body = 1-2 sentences with at least one specific fact or number.
4. data_points: value must be short and punchy ("$47B", "14.2% CAGR", "3.2x", "500+").
5. Use REAL data from the research above — never invent a specific number not found in the data.
6. MANDATORY INFOGRAPHIC LAYOUTS:
   - Slide 3 (Market Opportunity): MUST use layout: "growth_curve" with 4 data_points showing market progression
   - Slide 6 (Product): MUST use layout: "process_flow" with 5 bullet_points as sequential steps
   - Slide 8 (Traction): MUST use layout: "timeline" with 5 bullet_points as chronological milestones
   These layouts make data visual and memorable. Do NOT use big_number or cards for these slides.
6. If a number is unavailable, use a directional signal ("Seed-funded", "Growing rapidly") — never fabricate.
7. Make it sound like a Goldman Sachs equity research deck crossed with a Sequoia pitch.

Return ONLY valid JSON:
{{
  "deck_title": "{b.company_name} — Investor Pitch",
  "deck_subtitle": "Confidential | {b.industry}",
  "slides": [
    {{
      "slide_type": "cover",
      "layout": "full_bleed",
      "title": "...",
      "subtitle": "...",
      "body": "...",
      "bullet_points": [],
      "data_points": [],
      "cards": [],
      "columns": [],
      "speaker_notes": "Presenter note for this slide"
    }}
  ]
}}"""

    def _fallback_deck(
        self,
        b: BrandingData,
        r: ResearchData,
        a: Optional[object],
    ) -> DeckContent:
        """Structured 13-slide fallback deck used when AI generation fails."""
        tam = r.tam_sam_som.get("tam", {})
        sam = r.tam_sam_som.get("sam", {})
        som = r.tam_sam_som.get("som", {})

        positioning = ""
        rev_scenarios: list = []
        if a:
            try:
                positioning = a.positioning
                rev_scenarios = a.revenue_scenarios
            except Exception:
                pass

        # Team cards — use real founders from research if available
        team_cards = []
        for f in r.founders[:3]:
            team_cards.append({
                "title": f"{f.get('name', 'Founder')} — {f.get('title', 'Co-founder')}",
                "body": f.get("background", "Experienced founder with deep domain expertise."),
                "metric": "",
            })
        while len(team_cards) < 3:
            team_cards.append({"title": "Key Hire", "body": f"Actively hiring for this role as we scale.", "metric": "Open"})

        # Traction data_points — use intake/analysis numbers where available
        traction_points = []
        if rev_scenarios:
            traction_points.append({"label": "Y1 Target", "value": rev_scenarios[0].get("arr", "—"), "sublabel": "ARR projection"})
        for item in r.key_metrics[:3]:
            traction_points.append({"label": item.get("metric", ""), "value": item.get("value", "—"), "sublabel": ""})
        while len(traction_points) < 4:
            traction_points.append({"label": "Traction", "value": "Growing", "sublabel": r.funding_info or "Early stage"})
        traction_points = traction_points[:4]

        slides = [
            # 1 — Cover
            SlideContent(1, "cover", "full_bleed", b.company_name, b.tagline,
                         r.company_description or b.description),

            # 2 — Executive Summary (McKinsey: conclusion first)
            SlideContent(2, "executive_summary", "big_number", "Executive Summary",
                         f"{b.company_name} is {r.company_description or b.description or f'a {b.industry} platform'} — in a {r.market_size or 'large'} market growing at {r.market_growth or 'strong CAGR'}.",
                         body=f"{r.company_description or b.description or f'{b.company_name} builds purpose-built solutions for {b.target_audience or b.industry}.'} {r.why_now or ''} {r.funding_info or 'Seed stage.'}".strip(),
                         data_points=[
                             {"label": "TAM", "value": tam.get("value", r.market_size or "—"), "sublabel": tam.get("description", f"Total {b.industry} market")},
                             {"label": "CAGR", "value": r.market_growth or "—", "sublabel": "2024–2030"},
                             {"label": "Valuation", "value": r.company_valuation or r.funding_info or "Seed stage", "sublabel": r.founded_year or "Early stage"},
                             {"label": "Operations", "value": r.operational_presence or "Launching", "sublabel": r.company_headcount or "Growing team"},
                         ]),

            # 3 — Market Opportunity
            SlideContent(3, "market_opportunity", "big_number", "Market Opportunity",
                         f"The {b.industry} market is at an inflection point — {r.market_size or 'massive'} and accelerating",
                         body=f"{r.market_narrative or ''} {r.why_now or ''}".strip() or f"The {b.industry} sector is undergoing rapid transformation driven by AI and digital adoption.",
                         bullet_points=[
                             f"**{d.split(':')[0].strip()}:** {d.split(':', 1)[-1].strip()}" if ":" in d else d
                             for d in (r.market_drivers or [
                                 f"**Digital Shift:** 70%+ of {b.industry} enterprises accelerating tech investment",
                                 "**AI Demand:** Automation spend surging — productivity gains now quantifiable",
                                 "**Platform Consolidation:** Buyers moving from fragmented point tools to platforms",
                                 "**Cost Pressure:** Demand for efficient, scalable alternatives to legacy systems",
                             ])[:4]
                         ],
                         data_points=[
                             {"label": "TAM", "value": tam.get("value", r.market_size or "—"), "sublabel": tam.get("description", f"Total {b.industry} market")},
                             {"label": "SAM", "value": sam.get("value", "—"), "sublabel": sam.get("description", "Serviceable market")},
                             {"label": "SOM (Y3)", "value": som.get("value", "—"), "sublabel": som.get("description", "3-year target")},
                             {"label": "CAGR", "value": r.market_growth or "—", "sublabel": "2024–2030"},
                         ]),

            # 4 — Problem
            SlideContent(4, "problem", "title_bullets",
                         f"{b.industry} Has a Critical Unsolved Problem",
                         f"{b.target_audience or 'Buyers'} are losing time and money to an outdated status quo.",
                         body=f"{r.pain_points[0] if r.pain_points else f'The {b.industry} market is plagued by inefficiency and high costs that legacy solutions cannot fix.'}",
                         bullet_points=[
                             f"**{p.split('—')[0].strip()}:** {p.split('—', 1)[-1].strip()}" if "—" in p else f"**Pain:** {p}"
                             for p in r.pain_points[:4]
                         ] or [
                             f"**Fragmentation:** {b.industry} teams juggle 5+ disconnected tools, losing 30% of productive time",
                             "**High Cost:** Legacy solutions cost 3-5x more than modern alternatives",
                             "**Slow Delivery:** Existing platforms take months to implement — market moves faster",
                             "**No Insight:** Decision-makers lack real-time data, leading to costly mistakes",
                         ]),

            # 5 — Solution
            SlideContent(5, "solution", "cards", "The Solution",
                         r.company_description or b.description or f"{b.company_name} solves this with a purpose-built {b.industry} platform.",
                         cards=[
                             {"title": b.key_products[0] if b.key_products else "Core Platform", "body": f"Helps {b.target_audience or 'customers'} achieve outcomes faster and more reliably.", "metric": ""},
                             {"title": b.key_products[1] if len(b.key_products) > 1 else "Speed & Scale", "body": "Fast onboarding — live in minutes, not months.", "metric": ""},
                             {"title": b.key_products[2] if len(b.key_products) > 2 else "Intelligence", "body": f"AI-powered insights on {', '.join(b.tech_stack[:2]) if b.tech_stack else 'modern infrastructure'}.", "metric": ""},
                         ]),

            # 6 — Product
            SlideContent(6, "product", "cards", "Product",
                         f"Three capabilities that make {b.company_name} the obvious choice",
                         cards=[
                             {"title": b.key_products[0] if b.key_products else "Core Feature", "body": "Purpose-built for the use case — not a horizontal tool adapted for it.", "metric": ""},
                             {"title": b.key_products[1] if len(b.key_products) > 1 else "Automation", "body": "Eliminates manual steps — customers save hours every week.", "metric": ""},
                             {"title": b.key_products[2] if len(b.key_products) > 2 else "Insights", "body": "Real-time visibility that drives faster, smarter decisions.", "metric": ""},
                         ]),

            # 7 — Business Model
            SlideContent(7, "business_model", "cards", "Business Model",
                         "Recurring revenue with strong expansion economics",
                         cards=[
                             {"title": "Core Revenue", "body": r.business_model or f"Primary {b.business_model or 'subscription'} revenue with predictable recurring income.", "metric": "Primary"},
                             {"title": r.revenue_streams[1] if len(r.revenue_streams) > 1 else "Services", "body": "Professional services and implementation for enterprise customers.", "metric": "Secondary"},
                             {"title": "Land & Expand", "body": "Low entry point drives adoption; expansion within accounts grows ACV over time.", "metric": "Growth"},
                         ]),

            # 8 — Traction
            SlideContent(8, "traction", "big_number", "Traction",
                         r.recent_news[0] if r.recent_news else f"{b.company_name} is gaining momentum",
                         body=f"{r.funding_info or 'Seed-funded and growing.'} {r.recent_news[1] if len(r.recent_news) > 1 else ''}".strip(),
                         data_points=traction_points,
                         bullet_points=[f"**Milestone:** {n}" for n in r.recent_news[:3]] or [
                             "**Customers:** Design partners signed and providing active product feedback",
                             "**Product:** Core platform live — onboarding first paying customers",
                             f"**Team:** {r.company_headcount or 'Core team'} in place across engineering, product, and GTM",
                         ]),

            # 9 — Competitive Landscape (real named competitor cards)
            SlideContent(9, "competitive_landscape", "cards", "Competitive Landscape",
                         positioning or f"{b.company_name} is purpose-built where alternatives are generic or legacy.",
                         cards=[
                             {
                                 "title": c.get("name", f"Competitor {i+1}"),
                                 "body": f"{c.get('description', 'Established player in the space.')} {c.get('weakness', 'Lacks modern architecture and speed.')}",
                                 "metric": r.competitive_advantages[i] if i < len(r.competitive_advantages) else f"{b.company_name}'s edge",
                             }
                             for i, c in enumerate(r.competitors[:3])
                         ] or [
                             {"title": "Legacy Platforms", "body": "Existing enterprise tools built for yesterday's workflows. Slow to implement, expensive to maintain.", "metric": "We're 10x faster to deploy"},
                             {"title": "Manual Processes", "body": "Many teams still rely on spreadsheets and manual work. Error-prone and doesn't scale.", "metric": "Full automation from Day 1"},
                             {"title": "Generic SaaS Tools", "body": "Horizontal platforms adapted for the use case — not purpose-built. Missing critical domain features.", "metric": "Purpose-built for the use case"},
                         ]),

            # 10 — Team
            SlideContent(10, "team", "cards", "The Team",
                         "The right people to win this market",
                         cards=team_cards),

            # 11 — Financials
            SlideContent(11, "financials", "big_number", "Financial Projections",
                         "Clear path to scale with defensible unit economics",
                         body="Assumptions: land-and-expand motion, CAC payback < 12 months, positive unit economics from Day 1.",
                         data_points=[
                             {"label": rev_scenarios[0]["scenario"] if rev_scenarios else "Year 1", "value": rev_scenarios[0]["arr"] if rev_scenarios else "$500K ARR", "sublabel": rev_scenarios[0].get("assumption", "") if rev_scenarios else "Conservative"},
                             {"label": rev_scenarios[1]["scenario"] if len(rev_scenarios) > 1 else "Year 2", "value": rev_scenarios[1]["arr"] if len(rev_scenarios) > 1 else "$2M ARR", "sublabel": rev_scenarios[1].get("assumption", "") if len(rev_scenarios) > 1 else "Base case"},
                             {"label": rev_scenarios[2]["scenario"] if len(rev_scenarios) > 2 else "Year 3", "value": rev_scenarios[2]["arr"] if len(rev_scenarios) > 2 else "$8M ARR", "sublabel": rev_scenarios[2].get("assumption", "") if len(rev_scenarios) > 2 else "Optimistic"},
                             {"label": "Gross Margin", "value": "70–80%", "sublabel": "Target at scale"},
                         ]),

            # 12 — The Ask
            SlideContent(12, "ask", "cards", "The Ask",
                         f"Raising to reach {rev_scenarios[1]['arr'] if len(rev_scenarios) > 1 else 'the next milestone'}",
                         body=f"This funding takes {b.company_name} from early traction to category leadership.",
                         cards=[
                             {"title": "Product", "body": "Scale engineering, ship enterprise features, reach product-market fit.", "metric": "40%"},
                             {"title": "Go-to-Market", "body": "Hire first AEs, launch demand gen, close 10 anchor customers.", "metric": "40%"},
                             {"title": "Operations", "body": "Customer success, infrastructure, legal and compliance.", "metric": "20%"},
                         ]),

            # 13 — Closing
            SlideContent(13, "closing", "full_bleed",
                         positioning or f"The Future of {b.industry} Starts Here",
                         f"Join us in building the category leader in {b.industry}.",
                         f"Contact us · {b.company_name}"),
        ]
        return DeckContent(slides=slides, deck_title=f"{b.company_name} — Investor Deck")
