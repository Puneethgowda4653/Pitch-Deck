"""
MasterDeckAgent — Two-pass pitch deck generator.

Pass 1 — Research (gemini-2.5-flash + thinking, Key 2):
  Dedicated research call with step-by-step reasoning.
  Produces verified founders, competitors, market data, funding history.

Pass 2 — Generation (gemini-2.0-flash, Key 1):
  Formats the verified research into 12 slides.
  No hallucination risk — research is already grounded before this call.
"""
import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import Optional, Sequence

from loguru import logger

from app.core.config import settings
from app.core.genai_client import GeminiClientWrapper, make_genai_client
from app.decks.prompt import build_generation_sections
from app.decks.registry import (
    DEFAULT_DECK_FORMAT,
    DEFAULT_DECK_TYPE,
    get_deck_type,
    resolve_sections,
)


@dataclass
class BrandingResult:
    company_name: str = ""
    industry: str = ""
    tagline: str = ""
    description: str = ""
    primary_color: str = "#2540B5"
    secondary_color: str = "#7B2CBF"
    logo_url: str = ""
    target_audience: str = ""
    business_model: str = ""

    def model_dump(self) -> dict:
        return {
            "company_name": self.company_name,
            "industry": self.industry,
            "tagline": self.tagline,
            "description": self.description,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            "logo_url": self.logo_url,
            "target_audience": self.target_audience,
            "business_model": self.business_model,
        }


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
class MasterDeckResult:
    branding: BrandingResult = field(default_factory=BrandingResult)
    slides: list[SlideContent] = field(default_factory=list)
    deck_title: str = ""
    deck_subtitle: str = ""
    research_summary: dict = field(default_factory=dict)
    template_data: dict = field(default_factory=dict)  # rich schema for the 10-theme renderer
    deck_type: str = DEFAULT_DECK_TYPE
    # The resolved section list this deck was generated against. Persisted with
    # the deck so it keeps rendering in its original order even if the registry
    # changes later — the deck describes itself rather than being re-derived.
    slide_order: list[str] = field(default_factory=list)

    def to_deck_content_dict(self) -> dict:
        return {
            "deck_title": self.deck_title,
            "deck_subtitle": self.deck_subtitle,
            "deck_type": self.deck_type,
            "slide_order": self.slide_order,
            "template_data": self.template_data,
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


def _extract_json(raw: str) -> str:
    s = raw
    if "```json" in s:
        s = s.split("```json", 1)[1]
    elif "```" in s:
        s = s.split("```", 1)[1]
    start, end = s.find("{"), s.rfind("}")
    if start != -1 and end != -1 and end > start:
        s = s[start:end + 1]
    return re.sub(r",\s*([}\]])", r"\1", s.strip())


def _parse_json_lenient(raw: str) -> dict:
    """Extract JSON from an LLM response and parse it tolerantly.

    Grounded/search responses often wrap JSON in prose or citations, and LLMs
    occasionally emit minor defects (missing comma, unescaped quote). Try strict
    json first, then fall back to json_repair.
    """
    s = _extract_json(raw)
    try:
        return json.loads(s)
    except json.JSONDecodeError as je:
        from json_repair import repair_json
        logger.warning(f"⚠️  JSON parse failed ({je}) — repairing with json_repair")
        data = repair_json(s, return_objects=True)
        if not isinstance(data, dict):
            raise RuntimeError(f"JSON repair produced unusable result: {type(data)}") from je
        logger.info("✅ JSON repaired successfully")
        return data


class MasterDeckAgent:
    """
    Two-pass pitch deck generator.

    Pass 1 — Research (gemini-2.5-flash + thinking, Key 2):
      Deep research with step-by-step reasoning about founders, competitors, market.
    Pass 2 — Generation (gemini-2.0-flash, Key 1):
      Formats pre-researched data into 12 slides — fast, no hallucination risk.
    """

    def __init__(self):
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not configured")
        self.key_gen = settings.gemini_api_key
        self.key_research = settings.gemini_api_key_2 or settings.gemini_api_key

    def _gen_client(self) -> GeminiClientWrapper:
        return make_genai_client(self.key_gen)

    def _research_client(self) -> GeminiClientWrapper:
        return make_genai_client(self.key_research)

    async def generate(
        self,
        company_url: str,
        website_content: str,
        website_colors: list[str],
        user_inputs: dict,
        team_info: list[str] = None,
        pricing_info: list[str] = None,
        all_images: list[str] = None,
        pages_crawled: int = 0,
        deck_type: str = DEFAULT_DECK_TYPE,
        stage: Optional[str] = None,
        deck_format: str = DEFAULT_DECK_FORMAT,
    ) -> MasterDeckResult:
        company_name = user_inputs.get("company_name", "")
        dt = get_deck_type(deck_type)
        sections = resolve_sections(dt.key, stage=stage)
        logger.info(
            f"🤖 MasterDeckAgent | url={company_url} | company={company_name or 'auto-detect'} | "
            f"type={dt.key} | slides={len(sections)} | research={dt.research} | pages={pages_crawled}"
        )

        # ── Pass 1: Deep research (skipped entirely for 'none' deck types) ───────
        research_data = await self._research_pass(
            company_url, website_content, team_info or [], pricing_info or [], user_inputs,
            profile=dt.research,
        )

        # A founder who filled in the no-website manual intake form has, by definition,
        # no verifiable web presence yet — any "founders" a generic name search turns up
        # are almost always a different company entirely (e.g. searching a common name
        # like "Nimbus" surfaces an unrelated DAO/token project's founders). Self-reported
        # data is ground truth here and takes priority over speculative search hits.
        manual_founders = user_inputs.get("founders") or []
        normalized_founders = [
            {
                "name": f.get("name", "").strip(),
                "title": f.get("role", "").strip(),
                "prior": f.get("one_liner", "").strip(),
                "source": "founder-provided",
                "confidence": "HIGH",
            }
            for f in manual_founders
            if f.get("name", "").strip()
        ]
        if normalized_founders:
            research_data["founders"] = normalized_founders
            logger.info(f"👤 Using {len(normalized_founders)} founder-provided team member(s) — self-reported, overrides web search")

        logger.info(f"🔬 Research complete | founders={len(research_data.get('founders', []))} | competitors={len(research_data.get('competitors', []))}")

        # ── Pass 2: Slide generation ────────────────────────────────────────────
        prompt = self._build_generation_prompt(
            company_url, website_content,
            team_info or [], pricing_info or [],
            user_inputs, research_data,
            deck_type=dt.key, sections=sections, stage=stage, deck_format=deck_format,
        )

        def _is_transient(e: Exception) -> bool:
            # Retry on rate limits AND transient server errors (503/500/overloaded).
            msg = str(e).lower()
            return any(k in msg for k in (
                "429", "rate limit", "rate_limit",
                "503", "500", "overloaded", "high demand", "unavailable", "try again",
            ))

        raw = ""
        try:
            client = self._gen_client()
            # Retry up to 4 times on transient errors (rate limit / 503 overload).
            max_attempts = 4
            for attempt in range(max_attempts):
                try:
                    response = client.models.generate_content(
                        model=settings.gemini_model,
                        contents=prompt,
                    )
                    raw = response.text
                    break
                except Exception as re:
                    if _is_transient(re) and attempt < max_attempts - 1:
                        wait = (attempt + 1) * 5  # 5s, 10s, 15s
                        logger.warning(f"⚠️  Generation transient error (attempt {attempt+1}/{max_attempts}) — retrying in {wait}s | {re}")
                        await asyncio.sleep(wait)
                    else:
                        raise
            data = _parse_json_lenient(raw)
            if not data.get("slides"):
                raise RuntimeError("Parsed deck JSON has no slides")

            b = data.get("branding", {})
            logo_url = next(
                (img for img in (all_images or []) if any(kw in img.lower() for kw in ("logo", "brand", "icon"))),
                ""
            )
            branding = BrandingResult(
                company_name=user_inputs.get("company_name") or b.get("company_name", ""),
                industry=user_inputs.get("industry") or b.get("industry", ""),
                tagline=b.get("tagline", ""),
                description=b.get("description", ""),
                primary_color=self._pick_color(website_colors, b.get("primary_color", "#2540B5")),
                secondary_color=self._pick_color(website_colors[1:], b.get("secondary_color", "#7B2CBF")),
                logo_url=logo_url,
                target_audience=user_inputs.get("target_customer") or b.get("target_audience", ""),
                business_model=user_inputs.get("business_model") or b.get("business_model", ""),
            )

            slides = [
                SlideContent(
                    slide_number=i + 1,
                    slide_type=_str(s.get("slide_type", "content")),
                    layout=_str(s.get("layout", "title_bullets")),
                    title=_str(s.get("title", "")),
                    subtitle=_str(s.get("subtitle", "")),
                    body=_str(s.get("body", "")),
                    bullet_points=[_str(bp) for bp in s.get("bullet_points", [])],
                    data_points=s.get("data_points", []),
                    cards=s.get("cards", []),
                    columns=s.get("columns", []),
                    speaker_notes=_str(s.get("speaker_notes", "")),
                )
                for i, s in enumerate(data.get("slides", []))
            ]

            from app.ppt.engine.template_schema import validate_template_data
            template_data = validate_template_data(data.get("template_data") or {}, sections=sections)
            if template_data:
                # Fill any missing identity fields the renderer relies on.
                template_data.setdefault("company", branding.company_name)
                template_data.setdefault("mark", (branding.company_name or "?")[:1].upper())
                template_data.setdefault("tagline", branding.tagline)
                template_data.setdefault("eyebrow", dt.eyebrow)
                template_data.setdefault("year", "2026")

            result = MasterDeckResult(
                branding=branding,
                slides=slides,
                deck_title=data.get("deck_title", f"{branding.company_name} — {dt.label}"),
                deck_subtitle=data.get("deck_subtitle", f"Confidential | {branding.industry}"),
                research_summary={**research_data, **data.get("research_summary", {})},
                template_data=template_data,
                deck_type=dt.key,
                slide_order=list(sections),
            )
            logger.info(
                f"✅ MasterDeckAgent done | {len(slides)} slides | type={dt.key} | company={branding.company_name}"
            )
            return result

        except Exception as exc:
            logger.error(f"❌ Generation pass failed: {exc}")
            if raw:
                logger.debug(f"Raw (first 2000): {raw[:2000]}")
            raise

    async def _research_pass(
        self,
        company_url: str,
        website_content: str,
        team_info: list[str],
        pricing_info: list[str],
        user_inputs: dict,
        profile: str = "full",
    ) -> dict:
        """
        Pass 1: gemini-2.5-flash + Google Search grounding + thinking.
        Searches the live internet for founders, funding, competitors, market data.
        Falls back to training knowledge if search grounding fails.

        `profile` comes from the deck type:
          full  — founders, funding, competitors, market (investor, partnership, vision)
          light — competitors and market only (sales, product)
          none  — no web research at all; the deck runs on founder-supplied input
                  alone (internal, investor update), where web facts about the
                  company are irrelevant and only add hallucination surface.
        """
        if profile == "none":
            logger.info("🔬 Research profile 'none' — no web research for this deck type")
            return {}

        company_name = user_inputs.get("company_name", "")
        prompt = self._build_research_prompt(
            company_url, website_content, team_info, pricing_info, user_inputs, profile=profile
        )

        def _is_quota_error(e: Exception) -> bool:
            msg = str(e).lower()
            return "429" in msg or "quota" in msg or "exceeded" in msg or "rate limit" in msg

        # ── Attempt 1: research model + Google Search grounding ──────────────
        try:
            client = self._research_client()

            raw = ""
            grounding: list = []
            # Live web search grounding — real founders/funding/competitors/market
            try:
                logger.info(f"🔍 Research pass (web-grounded): {settings.gemini_model_research}")
                response = client.models.generate_content(
                    model=settings.gemini_model_research,
                    contents=prompt,
                    use_search=True,
                )
                raw = response.text
                grounding = response.grounding
                logger.info(f"✅ Research complete (web-grounded) | sources={len(grounding)}")
            except Exception as se:
                if _is_quota_error(se):
                    raise
                logger.warning(f"Grounded research failed ({se}) — retrying without search")

            if not raw:
                response = client.models.generate_content(
                    model=settings.gemini_model_research,
                    contents=prompt,
                )
                raw = response.text

            data = _parse_json_lenient(raw)
            self._attach_sources(data, grounding)

            # ── E: targeted team search if no real founders were found ──────────
            # Only for 'full' — a light profile never renders a team slide.
            if profile == "full" and not data.get("founders"):
                logger.info("🔎 No founders found — running targeted leadership search")
                team = await self._team_search(client, company_url, company_name, website_content)
                if team.get("founders"):
                    data["founders"] = team["founders"]
                    self._attach_sources(data, team.get("_grounding", []))
                    logger.info(f"✅ Team search found {len(team['founders'])} leader(s)")
                else:
                    logger.info("ℹ️  Team search also empty — deck will show honest placeholder")

            return data

        except Exception as exc:
            if _is_quota_error(exc):
                # ── Attempt 2: retry with gen client (rate limits are transient) ──
                logger.warning(f"⚠️  Research rate-limited — retrying with gen client")
                await asyncio.sleep(2)
                try:
                    fallback_client = self._gen_client()
                    fb_response = fallback_client.models.generate_content(
                        model=settings.gemini_model,
                        contents=prompt,
                        use_search=True,
                    )
                    logger.info("✅ Research retry complete")
                    data = _parse_json_lenient(fb_response.text)
                    self._attach_sources(data, fb_response.grounding)
                    return data
                except Exception as fe:
                    logger.warning(f"⚠️  Research retry also failed ({fe}) — proceeding with website data only")
            else:
                logger.warning(f"⚠️  Research pass failed ({exc}) — proceeding with website data only")
            return {}

    @staticmethod
    def _attach_sources(data: dict, grounding: list) -> None:
        """Merge real grounding URLs into research_data['sources'] (deduped, str-only)."""
        if not isinstance(data, dict):
            return

        def _norm(x) -> str:
            if isinstance(x, str):
                return x.strip()
            if isinstance(x, dict):
                return str(x.get("uri") or x.get("url") or x.get("title") or "").strip()
            return str(x).strip()

        existing = data.get("sources") or []
        if isinstance(existing, (str, dict)):
            existing = [existing]
        out: list[str] = []
        for item in [*existing, *(grounding or [])]:
            s = _norm(item)
            if s and s not in out:
                out.append(s)
        data["sources"] = out

    async def _team_search(self, client, company_url: str, company_name: str, website_content: str) -> dict:
        """Focused, web-grounded second pass that ONLY looks for the leadership team."""
        name = company_name or "the company"
        prompt = f"""Use Google Search to find the REAL leadership of this company. Search now:
  "{name} founders", "{name} directors", "{name} leadership team", "{name} CEO",
  site:linkedin.com "{name}", and the company's own /about or /team page.
Company website: {company_url}

Website context (names may appear here):
{website_content[:4000]}

Return ONLY JSON. Include a person ONLY if you actually found them by name via search or the site.
If you genuinely cannot find anyone, return {{"founders": []}} — DO NOT invent names.
{{
  "founders": [
    {{"name": "Full Name", "title": "CEO / Founder / Director", "prior": "background if found",
      "source": "url where found", "confidence": "HIGH|MEDIUM|LOW"}}
  ]
}}"""
        try:
            resp = client.models.generate_content(
                model=settings.gemini_model_research, contents=prompt, use_search=True,
            )
            out = _parse_json_lenient(resp.text)
            out["_grounding"] = resp.grounding
            return out
        except Exception as e:
            logger.warning(f"Team search failed ({e})")
            return {}

    def _pick_color(self, colors: list[str], fallback: str) -> str:
        for c in colors:
            try:
                h = c.lstrip("#")
                if len(h) == 3:
                    h = h[0]*2 + h[1]*2 + h[2]*2
                r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
                brightness = (r * 299 + g * 587 + b * 114) / 1000
                if 30 < brightness < 210:
                    return c
            except Exception:
                continue
        return fallback

    @staticmethod
    def _founder_provided_block(u: dict) -> str:
        """Stand-in for crawled website content when the company has no live site yet."""
        return f"""Problem being solved:
{u.get('problem_statement') or 'Not provided'}

Solution / what we're building:
{u.get('solution_description') or 'Not provided'}

Target customer:
{u.get('target_customer') or 'Not specified — infer from the problem/solution and industry'}

Early validation / traction (founder-reported — use exactly, do not inflate or invent additional traction):
{u.get('traction_notes') or 'None yet — pre-launch/idea-stage company. Do NOT fabricate customers, revenue, or usage numbers.'}

Founder-named competitors (supplement with your own industry knowledge as well):
{u.get('competitor_notes') or 'None provided — derive competitors from the industry.'}"""

    @staticmethod
    def _brief_block(deck_type: str, u: dict) -> str:
        """The deck type's own intake fields, as prompt ground truth.

        These are the answers to the type-specific questions on the new-project
        form (buyer, partner, initiative, reporting period, …). For deck types
        with no web research they are the ONLY authoritative input, which is why
        they are labelled as ground truth as emphatically as the financials.
        """
        dt = get_deck_type(deck_type)
        lines = []
        for f in dt.brief_fields:
            val = u.get(f.name)
            if val is None or (isinstance(val, str) and not val.strip()):
                continue
            lines.append(f"  {f.label}: {val}")
        if not lines:
            return ""
        return (
            "\nDECK BRIEF — answers the author gave for this specific deck\n"
            "(ground truth; use exactly, and do not contradict or embellish):\n"
            + "\n".join(lines) + "\n"
        )

    def _build_research_prompt(
        self,
        company_url: str,
        website_content: str,
        team_info: list[str],
        pricing_info: list[str],
        u: dict,
        profile: str = "full",
    ) -> str:
        company_name = u.get("company_name", "")
        industry = u.get("industry", "")
        team_block = "\n".join(f"  • {t}" for t in team_info[:30]) if team_info else "  • None extracted"
        website_line = company_url or "Not yet live — idea-stage company"
        content_block = website_content[:8000] if website_content.strip() else self._founder_provided_block(u)

        # A "light" profile is for decks that show competitors and market context
        # but never founders, funding history, or company milestones (sales,
        # product). Searching for those is spend with nowhere to land, and any
        # facts it turns up become hallucination surface for slides that should
        # be talking about the customer instead.
        light = profile == "light"

        people_search_lines = "" if light else f"""  • "{company_name or '<company>'} founders" / "...directors" / "...leadership team" / "...CEO"
  • "{company_name or '<company>'} about us" / "...management" / site:linkedin.com "{company_name or '<company>'}"
  • "{company_name or '<company>'} funding" / "...revenue" / "...headquarters"
  • the company's own /about, /team, /leadership, /company pages
Real people have verifiable names on the company website or LinkedIn. FIND them — do not invent.
"""

        team_lead_block = "" if light else f"""
Team members found on website (use as search leads — verify each by name):
{team_block}
"""

        people_tasks = "" if light else """
1. FOUNDERS / DIRECTORS / LEADERSHIP — search the web for the REAL people:
   - Full names + exact titles (founder, co-founder, CEO, MD, director, etc.)
   - Education and prior companies/roles IF you can find them
   - Notable credentials (awards, board seats) IF verifiable
   - Add "source" = the URL/site where you found each person (e.g. linkedin.com, the company /about page)
   - CRITICAL: include a person ONLY if you actually found them via search or the website.
     If you cannot find ANY real names, return "founders": [] — DO NOT fabricate names.

2. COMPANY FACTS (search for these):
   - Founded year, headquarters city and country, headcount range
   - Operational markets/cities, 3 real milestones — only what you can verify

3. FUNDING (search):
   - Known rounds (stage, amount, date, investors), total raised, last valuation
   - If bootstrapped/private/unknown → say so honestly (do not invent figures)
"""

        market_tasks = f"""
{'1' if light else '4'}. COMPETITORS — provide at least 3 (industry reasoning is OK here):
   - Real, well-known players in this exact space; for each: name, funding/valuation, one specific weakness
   - Examples: Quick commerce → Blinkit, Zepto, Swiggy Instamart | HR SaaS → Workday, BambooHR, Darwinbox
     EdTech India → BYJU'S, Unacademy, Vedantu | Fintech payments → Razorpay, PayU, Cashfree

{'2' if light else '5'}. MARKET DATA (search for real figures + sources):
   - TAM / SAM / SOM with source names, CAGR with source+period, 3 current growth drivers
"""

        people_schema = "" if light else """  "founders": [
    {
      "name": "Full Name",
      "title": "Co-founder & CEO",
      "education": "IIT Bombay, B.Tech Computer Science, 2018",
      "prior": "Ex-Google India PM, 3 years",
      "credential": "Forbes 30U30 2022",
      "source": "https://linkedin.com/in/... or company /about page where found",
      "confidence": "HIGH|MEDIUM|LOW"
    }
  ],
  "company_facts": {
    "founded_year": "2021",
    "headquarters": "Bengaluru, India",
    "headcount": "5,000+",
    "operations": "10 cities across India",
    "milestones": ["Launched in Bengaluru 2021", "Raised Series B 2022", "Expanded to Mumbai 2023"]
  },
  "funding": {
    "total": "$1.4B",
    "rounds": [
      {"stage": "Seed", "amount": "$1M", "date": "Jan 2021", "investors": ["Sequoia India"]},
      {"stage": "Series A", "amount": "$60M", "date": "Aug 2021", "investors": ["Tiger Global", "Y Combinator"]}
    ],
    "valuation": "$5B",
    "status": "funded|bootstrapped|unknown"
  },
"""

        scope_line = (
            "Research the COMPETITIVE and MARKET context only — this deck never shows founders,\n"
            "funding history, or company milestones, so do not spend searches on them."
            if light else
            "Run real searches about THIS specific company and base every fact on what you actually find."
        )

        return f"""You are a world-class company research analyst with live access to Google Search.

YOU MUST USE WEB SEARCH. Do not rely on memory.
{scope_line}
Suggested searches (adapt to the company):
{people_search_lines}  • "{company_name or '<company>'} competitors" / "{industry or '<industry>'} market size report"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY TO RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website: {website_line}
Company Name: {company_name or "→ extract from website content below"}
Industry: {industry or "→ extract from website content below"}
{team_lead_block}
Website content:
{content_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{people_tasks}{market_tasks}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- SEARCH the web first; only use the website content / reasoning to fill gaps.
- NEVER invent people's names, titles, or credentials. An empty/honest result beats a fabricated one.
- "Not disclosed" is fine for private financials. Competitors & market may be reasoned from the industry.
- "sources": list the actual URLs/domains you relied on.
- Confidence: HIGH = found via search/website, MEDIUM = reasoned from industry, LOW = weak guess

Return ONLY valid JSON:
{{
  "confidence": "HIGH|MEDIUM|LOW",
  "sources": ["https://...the urls/domains you actually used..."],
{people_schema}  "competitors": [
    {{
      "name": "Blinkit",
      "funding": "$1B+",
      "weakness": "Limited dark store density outside top 4 cities",
      "confidence": "HIGH"
    }}
  ],
  "market": {{
    "tam": "$70B",
    "tam_source": "RedSeer 2024",
    "tam_description": "Global quick commerce market",
    "sam": "$18B",
    "sam_description": "India urban grocery delivery",
    "som": "$1.8B",
    "som_description": "~10% SAM capture by 2027",
    "cagr": "40%",
    "cagr_source": "RedSeer",
    "cagr_period": "2024-2028",
    "growth_drivers": ["urbanisation", "smartphone penetration", "gig economy expansion"]
  }}
}}"""

    def _build_generation_prompt(
        self,
        company_url: str,
        website_content: str,
        team_info: list[str],
        pricing_info: list[str],
        u: dict,
        research_data: dict,
        deck_type: str = DEFAULT_DECK_TYPE,
        sections: Optional[Sequence[str]] = None,
        stage: Optional[str] = None,
        deck_format: str = DEFAULT_DECK_FORMAT,
    ) -> str:
        # The slide plan, per-section rules and both JSON skeletons are built
        # from the deck-type registry rather than written out here, so a deck's
        # shape is declared in exactly one place (app/decks/registry.py).
        sections = tuple(sections or resolve_sections(deck_type, stage=stage))
        B = build_generation_sections(deck_type, sections, stage=stage, deck_format=deck_format)

        # Format user-provided financials
        financials = []
        if u.get("arr_usd"):
            financials.append(f"ARR: ${u['arr_usd']:,.0f}")
        if u.get("mrr_usd"):
            financials.append(f"MRR: ${u['mrr_usd']:,.0f}")
        if u.get("total_customers"):
            financials.append(f"Total Customers: {u['total_customers']:,}")
        if u.get("monthly_active_users"):
            financials.append(f"Monthly Active Users: {u['monthly_active_users']:,}")
        if u.get("ask_amount_usd"):
            financials.append(f"Raising: ${u['ask_amount_usd']:,.0f}")
        if u.get("funding_stage"):
            financials.append(f"Funding Stage: {u['funding_stage']}")
        if u.get("growth_rate_mom_pct"):
            financials.append(f"MoM Growth: {u['growth_rate_mom_pct']}%")

        financials_block = "\n".join(f"  - {f}" for f in financials) if financials else "  - Not provided"
        company_name = u.get("company_name", "")
        industry = u.get("industry", "")
        pricing_block = "\n".join(f"  • {p}" for p in pricing_info[:5]) if pricing_info else "  • No pricing info found on website"
        brief_block = self._brief_block(deck_type, u)

        # Serialize verified research for injection (cap size to stay within TPM).
        # "sources" is a list of long grounding-redirect URLs kept for audit purposes —
        # it isn't used by any slide instruction below, but sitting before founders/
        # competitors/market in the dict it can eat the entire truncation budget on
        # well-sourced companies, silently dropping the fields the prompt actually needs
        # (e.g. founders truncated away entirely). Excluded from what the model sees.
        research_for_prompt = {k: v for k, v in research_data.items() if k != "sources"} if research_data else {}
        research_json_full = json.dumps(research_for_prompt, indent=2) if research_for_prompt else "{}"
        research_json = research_json_full[:6000]
        has_research = bool(research_data.get("founders") or research_data.get("competitors") or research_data.get("market"))
        website_line = company_url or "Not yet live — idea-stage company"
        has_website_content = bool(website_content.strip())
        content_header = (
            "WEBSITE CONTENT (primary source for product, features, tone)" if has_website_content
            else "FOUNDER-PROVIDED COMPANY DESCRIPTION (primary source — no live website yet; this is an idea-stage / pre-launch company)"
        )
        content_block = website_content[:8000] if has_website_content else self._founder_provided_block(u)
        research_header = (
            "(HIGH CONFIDENCE — use this directly)" if has_research
            else "(empty — no web research for this deck type; use the company description below only)"
        )

        return f"""You are the world's best pitch deck writer and slide designer.
A research agent has already done the deep company and market research. Your ONLY job is to
format the provided data into a compelling {B['slide_count']}-slide deck of the type described below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT THIS DECK IS FOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{B['type_header']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFIED RESEARCH DATA {research_header}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{research_json}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY URL & USER INPUTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: {website_line}
Company Name: {company_name or "→ extract from website content"}
Industry: {industry or "→ extract from website content"}

Founder-provided financials (ground truth — use exactly):
{financials_block}
{brief_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{content_header}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{content_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRICING SIGNALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{pricing_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRAND COLORS (CRITICAL — choose carefully)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick TWO hex colors that are:
  • DISTINCT — clearly different hues, not two shades of the same color
  • VIBRANT — not too dark (#111) or too light (#EEE), readable on dark backgrounds
  • COMPLEMENTARY — look professional together
  • BRAND-ALIGNED — match the company's industry and visual identity

Industry color guide (use as inspiration, not strict rules):
  AI / LLM / Research:   primary="#6366F1" (indigo)   + secondary="#06B6D4" (cyan)
  Fintech / Payments:    primary="#1B4FDB" (deep blue) + secondary="#10B981" (emerald)
  SaaS / B2B:            primary="#7C3AED" (violet)    + secondary="#F59E0B" (amber)
  Healthcare / BioTech:  primary="#0D9488" (teal)      + secondary="#8B5CF6" (purple)
  E-commerce / D2C:      primary="#DC2626" (red)        + secondary="#F97316" (orange)
  EdTech / Learning:     primary="#2563EB" (blue)       + secondary="#EC4899" (pink)
  CleanTech / Climate:   primary="#16A34A" (green)      + secondary="#0EA5E9" (sky)
  General B2B:           primary="#1E40AF" (blue)       + secondary="#7C3AED" (violet)

AVOID: Colors with brightness <40 or >220 (too dark/light). AVOID near-identical hues.
If the company has obvious brand colors visible in their name/logo, use those instead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE PLAN — produce EXACTLY these {B['slide_count']} slides, in this order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{B['slide_plan']}

SLIDE-SPECIFIC RULES:
{B['section_rules']}

SPECIFICITY RULE — applies to every bullet, card, headline, and lead-in in
BOTH "slides" and "template_data":
Before writing any claim, silently ask: "Could I paste this sentence into a
rival company's deck in this same industry without changing a word?" If yes,
REWRITE IT so it only works for THIS company — anchor it to a specific number,
mechanism, named data source, customer segment, or fact drawn from the
research/website content above. Generic industry-truism sentences ("we
leverage AI to drive efficiency", "the market is growing rapidly", "our
platform is easy to use") are FORBIDDEN even as filler.

BEFORE (generic — could be any company in this space):
  "**AI-Powered:** We use artificial intelligence to help businesses make
  better decisions faster."
AFTER (specific — anchored to an actual mechanism/number):
  "**Sub-200ms Scoring:** Every transaction is re-scored in <200ms using our
  real-time risk model, vs. the 2-3 second batch checks legacy processors run."

BEFORE (generic market claim):
  "The industry is experiencing rapid digital transformation and growing
  demand."
AFTER (specific, sourced):
  "India's quick-commerce GMV grew 3.2x from 2022-2024 (RedSeer) as 10-minute
  delivery shifted from novelty to default expectation in metro grocery."

Apply this with extra weight to any slide whose instructions above are thin on
company-specific grounding — those are the easiest to fill with industry
boilerplate by accident. Re-read this rule before writing them.

GENERAL RULES:
  - Every bullet must have a bold lead-in: "**Speed:** 10x faster than..."
  - data_points values must be punchy: "$47B", "40% CAGR"
  - Use founder-provided figures exactly — never round, inflate, or extrapolate them
  - NEVER write "Not publicly disclosed", "Evolving Landscape", "Available upon request" or any empty filler
  - Every slide must contain real, specific, useful content — no placeholders, no vague filler text
  - ⛔ NEVER invent people's names, titles, bios, customers, logos, or quotes. An honest
    gap beats a fabricated fact. Competitors and market size MAY be reasoned from the industry.
  - Numbers over adjectives: prefer "$47B market growing 40% CAGR" over "a large and growing market";
    prefer "200ms response time" over "lightning fast".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALSO REQUIRED: "template_data" (sibling of "slides")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Re-express the SAME deck — same researched facts — into the richer "template_data"
object shown below. This drives a premium visual template renderer. Rules:
  - It must contain one key per slide in the plan above (except the cover, which uses
    the top-level company/mark/tagline/eyebrow/year/round fields).
  - Use the SAME facts, figures and people as the "slides" array — they are two
    renderings of one deck, not two different decks.
  - "eyebrow" must be "{B['eyebrow']}".
  - Pick theme_suggestion from the allowed keys based on the industry/mood.
  - Fill every field with real, specific content. Honest gaps beat fabricated facts —
    especially for people and customers.

Return ONLY valid JSON:
{{
  "branding": {{
    "company_name": "...",
    "industry": "specific niche (e.g. Quick Commerce)",
    "tagline": "...",
    "description": "2-sentence what+how",
    "primary_color": "#hex",
    "secondary_color": "#hex",
    "target_audience": "...",
    "business_model": "..."
  }},
  "deck_title": "Company — {B['label']}",
  "deck_subtitle": "Confidential | Industry",
  "slides": {B['slides_skeleton']},
  "template_data": {B['template_skeleton']}
}}"""
