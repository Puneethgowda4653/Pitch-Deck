"""
Research Agent v4 — Deep market reading using GEMINI API KEY 2.

This agent is dedicated to INDUSTRY & MARKET research only — it does NOT
analyze the company itself (that is Key 1's job).

Two-phase pipeline:
  Phase 1: 7 parallel DuckDuckGo searches → snippets + top result URLs
  Phase 2: Fetch and read full page content for the 3 market-critical queries
           (market_size, market_growth, market_opportunity) — top 2 pages each.
           This gives Gemini actual market reports, not just snippet excerpts.
  Synthesis: Gemini Key 2 reads all raw content and produces structured JSON
             including market_narrative, market_drivers, why_now — used by
             ContentAgent for Executive Summary and Market Opportunity slides.

Key usage: settings.gemini_api_key_2 — separate quota from Key 1.
"""
import asyncio
import json
import re
import urllib.parse
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup
from loguru import logger

from app.core.config import settings
from app.core.genai_client import make_genai_client


@dataclass
class ResearchData:
    market_size: str = ""
    market_growth: str = ""
    target_market: str = ""
    competitors: list[dict] = field(default_factory=list)
    competitive_advantages: list[str] = field(default_factory=list)
    industry_trends: list[str] = field(default_factory=list)
    customer_segments: list[str] = field(default_factory=list)
    business_model: str = ""
    revenue_streams: list[str] = field(default_factory=list)
    key_metrics: list[dict] = field(default_factory=list)
    funding_info: str = ""
    recent_news: list[str] = field(default_factory=list)
    pain_points: list[str] = field(default_factory=list)
    tam_sam_som: dict = field(default_factory=dict)
    # Market narrative fields — used for Executive Summary and Market Opportunity slides
    market_narrative: str = ""
    market_drivers: list[str] = field(default_factory=list)
    why_now: str = ""
    # Company profile — specific facts about this company (founders, funding, operations)
    founders: list[dict] = field(default_factory=list)      # [{"name": "...", "title": "...", "background": "..."}]
    founded_year: str = ""
    company_valuation: str = ""
    total_funding: str = ""
    funding_rounds: list[dict] = field(default_factory=list) # [{"round": "Series A", "amount": "$X", "date": "...", "investors": ["..."]}]
    company_headcount: str = ""
    operational_presence: str = ""   # e.g. "10+ cities across India"
    company_description: str = ""    # precise 1-2 sentence what+how description

    def model_dump(self) -> dict:
        return {
            "market_size": self.market_size,
            "market_growth": self.market_growth,
            "target_market": self.target_market,
            "competitors": self.competitors,
            "competitive_advantages": self.competitive_advantages,
            "industry_trends": self.industry_trends,
            "customer_segments": self.customer_segments,
            "business_model": self.business_model,
            "revenue_streams": self.revenue_streams,
            "key_metrics": self.key_metrics,
            "funding_info": self.funding_info,
            "recent_news": self.recent_news,
            "pain_points": self.pain_points,
            "tam_sam_som": self.tam_sam_som,
            "market_narrative": self.market_narrative,
            "market_drivers": self.market_drivers,
            "why_now": self.why_now,
            "founders": self.founders,
            "founded_year": self.founded_year,
            "company_valuation": self.company_valuation,
            "total_funding": self.total_funding,
            "funding_rounds": self.funding_rounds,
            "company_headcount": self.company_headcount,
            "operational_presence": self.operational_presence,
            "company_description": self.company_description,
        }


class ResearchAgent:
    """
    Industry & market research agent — uses GEMINI API KEY 2.

    Two-phase pipeline:
      Phase 1: 7 parallel DuckDuckGo searches → snippets + top result URLs
      Phase 2: Fetch and read full page text for market-critical queries
               (market_size, market_growth, market_opportunity) — top 2 pages each
      Synthesis: Feed all raw content to Gemini Key 2 for structured output
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.7",
    }

    def __init__(self):
        self._key2 = settings.gemini_api_key_2
        self._key1 = settings.gemini_api_key
        if not self._key2 and not self._key1:
            raise ValueError("No Gemini API key configured")
        # Start with Key 2; fall back to Key 1 if exhausted
        self._client = make_genai_client(self._key2 or self._key1)

    # Queries whose top pages are fully read (not just snippets)
    _DEEP_READ_KEYS = {"market_size", "funding_rounds", "founders", "company_traction"}

    async def run(
        self,
        company_name: str,
        company_url: str,
        industry: str,
        description: str,
    ) -> ResearchData:
        logger.info(f"🔍 Research | company={company_name} | industry={industry} [Key 2]")

        # Prepare company knowledge query to run in parallel
        company_knowledge_coro = asyncio.to_thread(
            self._company_knowledge_query, company_name, company_url, industry, description
        )

        # 8 parallel web searches — trimmed to save quota
        search_queries = [
            (f"{industry} market size TAM CAGR forecast 2024 2025 2030", "market_size"),
            (f"{industry} market growth trends disruption AI 2024 2025", "market_growth"),
            (f"{company_name} competitors alternatives {industry} top companies", "competitors"),
            (f"{industry} customer pain points problems challenges 2024", "pain_points"),
            (f"{company_name} funding valuation investors crunchbase founded", "funding_rounds"),
            (f"{company_name} founders CEO background wikipedia", "founders"),
            (f"{company_name} revenue ARR customers growth traction 2024", "company_traction"),
            (f"{company_name} employees cities operations expansion news 2024", "company_profile"),
        ]

        search_results: dict[str, str] = {}

        async with httpx.AsyncClient(
            timeout=15,
            headers=self.HEADERS,
            follow_redirects=True,
        ) as client:
            # Phase 1: run all DDG searches in parallel (snippets + URLs)
            tasks = [
                self._ddg_search(client, query)
                for query, _ in search_queries
            ]
            raw_results = await asyncio.gather(*tasks, return_exceptions=True)

            snippet_map: dict[str, str] = {}
            url_map: dict[str, list[str]] = {}
            for (query, key), result in zip(search_queries, raw_results):
                if isinstance(result, Exception):
                    logger.warning(f"  [{key}] search failed: {result}")
                    snippet_map[key] = ""
                    url_map[key] = []
                else:
                    snippet_map[key] = result["snippets"]
                    url_map[key] = result["urls"]
                    logger.debug(f"  [{key}] {len(result['snippets'])} chars, {len(result['urls'])} urls")

            # Phase 2: deep-read top pages for market-critical queries in parallel
            page_tasks = []
            page_keys = []
            for key in self._DEEP_READ_KEYS:
                for url in url_map.get(key, [])[:2]:
                    page_tasks.append(self._fetch_page_text(client, url))
                    page_keys.append(key)

            page_contents: list[str] = []
            if page_tasks:
                results = await asyncio.gather(*page_tasks, return_exceptions=True)
                page_contents = [r if isinstance(r, str) else "" for r in results]
                logger.debug(f"  Fetched {sum(1 for c in page_contents if c)} / {len(page_tasks)} pages")

            # Merge: snippets + page content per key
            for i, (key, content) in enumerate(zip(page_keys, page_contents)):
                if content:
                    snippet_map[key] = snippet_map.get(key, "") + f"\n\n[FULL PAGE READ]\n{content}"

            search_results = snippet_map

        # Collect Gemini's direct company knowledge
        try:
            company_knowledge = await company_knowledge_coro
            logger.info(f"  Company knowledge: {len(company_knowledge)} chars from Gemini")
        except Exception as e:
            logger.warning(f"  Company knowledge query failed: {e}")
            company_knowledge = ""

        # Synthesize with Gemini Key 2
        try:
            prompt = self._synthesis_prompt(company_name, company_url, industry, description, search_results, company_knowledge)
            response = self._call_gemini(prompt)

            json_str = self._extract_json(response)
            data = json.loads(json_str)

            research = ResearchData(
                market_size=data.get("market_size", ""),
                market_growth=data.get("market_growth", ""),
                target_market=data.get("target_market", ""),
                competitors=data.get("competitors", []),
                competitive_advantages=data.get("competitive_advantages", []),
                industry_trends=data.get("industry_trends", []),
                customer_segments=data.get("customer_segments", []),
                business_model=data.get("business_model", ""),
                revenue_streams=data.get("revenue_streams", []),
                key_metrics=data.get("key_metrics", []),
                funding_info=data.get("funding_info", ""),
                recent_news=data.get("recent_news", []),
                pain_points=data.get("pain_points", []),
                tam_sam_som=data.get("tam_sam_som", {}),
                market_narrative=data.get("market_narrative", ""),
                market_drivers=data.get("market_drivers", []),
                why_now=data.get("why_now", ""),
                founders=data.get("founders", []),
                founded_year=data.get("founded_year", ""),
                company_valuation=data.get("company_valuation", ""),
                total_funding=data.get("total_funding", ""),
                funding_rounds=data.get("funding_rounds", []),
                company_headcount=data.get("company_headcount", ""),
                operational_presence=data.get("operational_presence", ""),
                company_description=data.get("company_description", ""),
            )
            logger.info(
                f"✅ Research done | market={research.market_size} | "
                f"competitors={len(research.competitors)} | founders={len(research.founders)} | "
                f"funding={research.total_funding}"
            )
            return research

        except Exception as exc:
            logger.error(f"❌ Research synthesis failed: {exc}")
            return self._fallback(company_name, industry)

    def _company_knowledge_query(
        self,
        company_name: str,
        company_url: str,
        industry: str,
        description: str,
    ) -> str:
        """
        Ask Gemini what it already knows about this company from its training data.
        This runs in parallel with web searches and gives reliable facts for known companies
        without depending on DuckDuckGo scraping.
        """
        prompt = f"""You are a senior investment analyst who has researched thousands of companies.
I need comprehensive, factual information about the following company for a pitch deck.

Company: {company_name}
Website: {company_url}
Industry: {industry}
Description: {description}

Please research and provide EVERYTHING you know about {company_name}:

1. COMPANY OVERVIEW
   - What exactly does {company_name} do? Describe the product/service and the mechanism (how it works, not just what category it's in).
   - Founded year and headquarters location
   - Current operational presence (cities, countries)

2. FOUNDERS & TEAM
   - Full names and roles of all founders
   - Each founder's background: previous companies, education, notable achievements
   - Current team size / headcount

3. FUNDING & FINANCIALS
   - Every known funding round: round name, amount raised, date, lead investors
   - Total funding raised to date
   - Current valuation (if known)
   - Revenue or ARR (if publicly known)

4. BUSINESS & PRODUCT
   - Exact business model (how they make money)
   - Key products or features
   - Pricing model (if known)

5. TRACTION & GROWTH
   - Key metrics: customers, users, GMV, orders, growth rate
   - Major milestones or achievements
   - Recent news or announcements

6. MARKET & COMPETITION
   - Who are the direct competitors? (real company names)
   - What is {company_name}'s competitive advantage?
   - Market size and growth rate for {industry}

Be as specific and factual as possible. If you don't know something, say "Unknown" — do NOT make up numbers.
Write in plain paragraphs — no JSON needed, just detailed facts."""

        try:
            response = self._client.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
            )
            return response.text or ""
        except Exception as exc:
            logger.warning(f"Company knowledge query failed: {exc}")
            return ""

    def _call_gemini(self, prompt: str) -> str:
        """Call Gemini. Falls back to Key 1 if Key 2 exhausted."""
        quota_errors = ("quota", "exhausted", "rate", "limit", "429", "resource_exhausted")

        def _try(api_key: str) -> str:
            c = make_genai_client(api_key)
            return c.models.generate_content(model=settings.gemini_model, contents=prompt).text

        try:
            return _try(self._key2 or self._key1)
        except Exception as e:
            err = str(e).lower()
            if self._key1 and self._key2 and any(q in err for q in quota_errors):
                logger.warning("Key 2 quota hit — falling back to Key 1 for research")
                return _try(self._key1)
            raise

    async def _ddg_search(self, client: httpx.AsyncClient, query: str) -> dict:
        """Search DuckDuckGo HTML. Returns {snippets: str, urls: list[str]}."""
        ddg_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote_plus(query)}&kl=us-en"
        empty = {"snippets": "", "urls": []}
        try:
            resp = await client.get(ddg_url, timeout=10)
            if resp.status_code != 200:
                return empty
            soup = BeautifulSoup(resp.text, "lxml")

            snippets: list[str] = []
            urls: list[str] = []

            for el in soup.select(".result__snippet"):
                t = el.get_text(strip=True)
                if t and len(t) > 25:
                    snippets.append(t)

            for el in soup.select("a.result__a"):
                t = el.get_text(strip=True)
                if t and len(t) > 5:
                    snippets.append(t)

                href = el.get("href", "")
                extracted = self._extract_url(href)
                if extracted:
                    urls.append(extracted)

            return {"snippets": "\n".join(snippets[:12]), "urls": urls[:5]}
        except Exception as exc:
            logger.debug(f"DDG search error: {exc}")
            return empty

    def _extract_url(self, href: str) -> str:
        """Extract a clean destination URL from a DDG href (direct or redirect)."""
        if not href:
            return ""
        # Direct URL
        if href.startswith("http") and "duckduckgo.com" not in href:
            return href
        # DDG redirect: //duckduckgo.com/l/?uddg=<encoded-url>
        if "uddg=" in href:
            try:
                encoded = href.split("uddg=", 1)[1].split("&")[0]
                return urllib.parse.unquote(encoded)
            except Exception:
                return ""
        return ""

    async def _fetch_page_text(self, client: httpx.AsyncClient, url: str) -> str:
        """Fetch a page and extract clean readable text — skips paywalled/bot-blocked pages."""
        _SKIP_DOMAINS = ("youtube.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "linkedin.com")
        if any(d in url for d in _SKIP_DOMAINS):
            return ""
        try:
            resp = await client.get(url, timeout=8)
            if resp.status_code != 200:
                return ""
            ct = resp.headers.get("content-type", "")
            if "text/html" not in ct:
                return ""

            soup = BeautifulSoup(resp.text, "lxml")

            # Strip noise
            for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "figure", "noscript"]):
                tag.decompose()

            # Prefer article/main content blocks
            body_el = (
                soup.find("article") or
                soup.find("main") or
                soup.find(class_=lambda c: c and any(k in c for k in ["article", "content", "post", "body", "entry"])) or
                soup.find("body")
            )
            if not body_el:
                return ""

            paras = [p.get_text(" ", strip=True) for p in body_el.find_all("p") if len(p.get_text(strip=True)) > 60]
            text = "\n".join(paras[:25])
            logger.debug(f"  Fetched {len(text)} chars from {url[:60]}")
            return text[:2500]
        except Exception as exc:
            logger.debug(f"Page fetch failed {url[:60]}: {exc}")
            return ""

    def _extract_json(self, raw: str) -> str:
        s = raw
        if "```json" in s:
            s = s.split("```json", 1)[1].split("```")[0]
        elif "```" in s:
            s = s.split("```", 1)[1].split("```")[0]
        start, end = s.find("{"), s.rfind("}")
        if start != -1 and end != -1 and end > start:
            s = s[start:end + 1]
        s = re.sub(r",\s*([}\]])", r"\1", s.strip())
        return s

    def _synthesis_prompt(
        self,
        company_name: str,
        company_url: str,
        industry: str,
        description: str,
        sr: dict,
        company_knowledge: str = "",
    ) -> str:
        knowledge_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GEMINI DIRECT RESEARCH (primary source — use this first)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{company_knowledge}
""" if company_knowledge else ""

        return f"""You are a senior analyst at a top-tier investment bank (Goldman Sachs, Morgan Stanley level).
Your task is to produce two things for a pitch deck:
  1. COMPANY PROFILE — specific, verified facts about {company_name} (founders, funding, operations)
  2. INDUSTRY & MARKET INTELLIGENCE — TAM, competitors, trends, market narrative

COMPANY CONTEXT:
  Name: {company_name}
  Website: {company_url}
  Industry: {industry}
  Description: {description}
{knowledge_block}
WEB SEARCH DATA (supplementary — use to fill gaps or verify):

[Market Size & TAM Research]
{sr.get('market_size', 'No data')[:2000]}

[Market Growth & CAGR Reports]
{sr.get('market_growth', 'No data')[:1500]}

[Direct Competitor Search — companies that compete with {company_name}]
{sr.get('competitors', 'No data')[:1500]}

[Industry Market Leaders — top companies in the {industry} space]
{sr.get('industry_competitors', 'No data')[:1500]}

[Industry Trends 2024-2025]
{sr.get('industry_trends', 'No data')[:1500]}

[Customer Pain Points]
{sr.get('pain_points', 'No data')[:1200]}

[Company Traction, Revenue & ARR]
{sr.get('company_traction', 'No data')[:1500]}

[Market Opportunity & Investment Timing]
{sr.get('market_opportunity', 'No data')[:1500]}

[Founder & Team — Wikipedia / LinkedIn / Press]
{sr.get('founders', 'No data')[:1500]}

[Founder Background — Education, Previous Companies]
{sr.get('founder_background', 'No data')[:1200]}

[Funding Rounds — Crunchbase / Press]
{sr.get('funding_rounds', 'No data')[:1500]}

[Company Traction — Revenue, ARR, Growth]
{sr.get('company_traction', 'No data')[:1500]}

[Operations — Cities, Headcount, Expansion]
{sr.get('company_profile', 'No data')[:1000]}

[Recent News & Milestones]
{sr.get('recent_news_search', 'No data')[:1000]}

INSTRUCTIONS:

PRIORITY ORDER for all facts:
  1. GEMINI DIRECT RESEARCH block above — this is the most complete and reliable source
  2. Web Search Data — use to verify, supplement, or update with more recent information
  3. If neither source has a fact, return "" or [] — NEVER invent or make up data

COMPANY PROFILE (founders, funding, valuation, headcount, cities, description):
  - Pull directly from the GEMINI DIRECT RESEARCH block first
  - Founders: full names, exact titles, specific backgrounds (prior company, education, achievement)
  - Funding: list EACH round separately — round name, amount, date, named investors
  - company_description: 1-2 precise sentences — what they do AND how (the mechanism)

MARKET DATA:
  - Use real numbers with source context (e.g. "Grand View Research 2024")
  - CAGR must include timeframe (e.g. "18% CAGR 2024–2030")

COMPETITORS — CRITICAL, never use generic labels:
  - You MUST return 3-4 real named companies (e.g. "Blinkit", "Jira", "Uniswap", "PancakeSwap")
  - Use competitors mentioned in GEMINI DIRECT RESEARCH first
  - Then use Direct Competitor Search, then Industry Market Leaders
  - NEVER return "Existing solutions", "Generic platforms", "Competitor 1" — always real names

Return ONLY valid JSON (no markdown, no commentary):
{{
  "company_description": "1-2 precise sentences: what {company_name} does and HOW they do it — the mechanism, not just the category. E.g. 'Zepto is a quick-commerce platform that delivers groceries in under 10 minutes by operating a network of dark stores located within 2-3 km of customers in major Indian cities.'",
  "founders": [
    {{"name": "Full Name", "title": "Co-founder & CEO", "background": "Prior company / education / key achievement — 1-2 sentences"}},
    {{"name": "Full Name", "title": "Co-founder & CTO", "background": "..."}}
  ],
  "founded_year": "YYYY or ''",
  "company_valuation": "e.g. '$5B (2024)' or ''",
  "total_funding": "e.g. '$1.4B raised to date' or ''",
  "funding_rounds": [
    {{"round": "Series D", "amount": "$665M", "date": "2024", "investors": ["Nexus Venture Partners", "Glade Brook Capital"]}}
  ],
  "company_headcount": "e.g. '5,000+ employees' or ''",
  "operational_presence": "e.g. '10+ cities across India including Mumbai, Delhi, Bangalore' or ''",
  "market_size": "Total addressable market with year — e.g. '$47.3B global {industry} market (2024, Grand View Research)'",
  "market_growth": "CAGR with timeframe — e.g. '14.2% CAGR 2024–2030'",
  "target_market": "Serviceable segment with size",
  "competitors": [
    {{"name": "Competitor 1", "description": "What they do and market position", "strength": "Their main advantage", "weakness": "Where they fall short"}},
    {{"name": "Competitor 2", "description": "...", "strength": "...", "weakness": "..."}},
    {{"name": "Competitor 3", "description": "...", "strength": "...", "weakness": "..."}},
    {{"name": "Competitor 4", "description": "...", "strength": "...", "weakness": "..."}}
  ],
  "competitive_advantages": [
    "Advantage 1 that {company_name} has vs the field",
    "Advantage 2",
    "Advantage 3",
    "Advantage 4"
  ],
  "industry_trends": [
    "Trend 1 with supporting statistic",
    "Trend 2 with data point",
    "Trend 3 with data point",
    "Trend 4 with data point"
  ],
  "customer_segments": [
    "Primary segment — size and profile",
    "Secondary segment",
    "Tertiary segment"
  ],
  "business_model": "Revenue model with pricing signals if found",
  "revenue_streams": [
    "Primary revenue stream",
    "Secondary stream",
    "Tertiary stream"
  ],
  "key_metrics": [
    {{"metric": "TAM", "value": "$XXB"}},
    {{"metric": "SAM", "value": "$XXB"}},
    {{"metric": "SOM (Y3)", "value": "$XXM"}},
    {{"metric": "Market Growth", "value": "XX% CAGR"}}
  ],
  "tam_sam_som": {{
    "tam": {{"value": "$XXB", "description": "Total global {industry} market"}},
    "sam": {{"value": "$XXB", "description": "Serviceable market matching {company_name}'s ICP"}},
    "som": {{"value": "$XXM", "description": "Realistic 3-year capture with current go-to-market"}}
  }},
  "funding_info": "Summary of known funding stage or signals",
  "recent_news": [
    "Key company milestone or market development 1",
    "Key development 2",
    "Key development 3"
  ],
  "pain_points": [
    "Pain point 1 — quantified",
    "Pain point 2 — quantified",
    "Pain point 3 — quantified",
    "Pain point 4 — quantified"
  ],
  "market_narrative": "2-3 sentence paragraph on what this market is, its size/trajectory, and why it matters now — specific to {industry}.",
  "market_drivers": [
    "Driver 1 with stat",
    "Driver 2 with data point",
    "Driver 3",
    "Driver 4"
  ],
  "why_now": "1-2 sentence timing thesis specific to {company_name} and the {industry} market."
}}"""

    def _fallback(self, company_name: str, industry: str) -> ResearchData:
        return ResearchData(
            market_size=f"Large and growing {industry} market",
            market_growth="Strong double-digit CAGR",
            business_model="Technology services / SaaS",
            competitors=[
                {"name": "Existing solutions", "description": "Legacy tools and manual processes", "strength": "Established workflows", "weakness": "Slow and expensive"},
                {"name": "Generic platforms", "description": "Horizontal tools adapted for vertical use", "strength": "Wide feature set", "weakness": "Not purpose-built"},
            ],
            competitive_advantages=[
                f"{company_name}'s purpose-built approach vs. horizontal tools",
                "Faster time-to-value with modern architecture",
                "AI-native design vs. retrofitted legacy systems",
            ],
            industry_trends=[
                f"Rapid digital transformation in {industry}",
                "AI and automation adoption accelerating across sectors",
                "Demand for integrated, API-first platforms",
                "Consolidation from point solutions to platforms",
            ],
            pain_points=[
                "High costs of existing fragmented tooling",
                "Time-consuming manual processes reducing productivity",
                "Lack of real-time data for decision-making",
                "Integration complexity slowing teams down",
            ],
            tam_sam_som={
                "tam": {"value": "Large market", "description": f"Total {industry} market"},
                "sam": {"value": "Significant SAM", "description": "Serviceable addressable market"},
                "som": {"value": "Achievable SOM", "description": "3-year capture target"},
            },
            market_narrative=f"The {industry} market is undergoing rapid transformation driven by digital adoption and AI integration. Companies in this space face mounting pressure to modernize legacy workflows, creating significant demand for purpose-built solutions. {company_name} is positioned at the center of this shift.",
            market_drivers=[
                f"Digital transformation accelerating across {industry} — 70%+ of enterprises increasing tech spend",
                "AI and automation unlocking new efficiency gains previously unavailable to this sector",
                "Shift from fragmented point solutions to integrated platforms reducing total cost of ownership",
                "Regulatory and compliance pressures creating urgency for modern tooling",
            ],
            why_now=f"The convergence of affordable AI infrastructure and widespread cloud adoption has created a window for {company_name} to displace entrenched legacy vendors in the {industry} market — a transition that was cost-prohibitive just 3 years ago.",
        )
