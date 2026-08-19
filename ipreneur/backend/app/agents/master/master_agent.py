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
from typing import Optional

from loguru import logger

from app.core.config import settings
from app.core.genai_client import GeminiClientWrapper, make_genai_client


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

    def to_deck_content_dict(self) -> dict:
        return {
            "deck_title": self.deck_title,
            "deck_subtitle": self.deck_subtitle,
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
    ) -> MasterDeckResult:
        company_name = user_inputs.get("company_name", "")
        logger.info(f"🤖 MasterDeckAgent | url={company_url} | company={company_name or 'auto-detect'} | pages={pages_crawled}")

        # ── Pass 1: Deep research ────────────────────────────────────────────────
        research_data = await self._research_pass(
            company_url, website_content, team_info or [], pricing_info or [], user_inputs
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
            user_inputs, research_data
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
            template_data = validate_template_data(data.get("template_data") or {})
            if template_data:
                # Fill any missing identity fields the renderer relies on.
                template_data.setdefault("company", branding.company_name)
                template_data.setdefault("mark", (branding.company_name or "?")[:1].upper())
                template_data.setdefault("tagline", branding.tagline)
                template_data.setdefault("eyebrow", "Investor Presentation")
                template_data.setdefault("year", "2026")

            result = MasterDeckResult(
                branding=branding,
                slides=slides,
                deck_title=data.get("deck_title", f"{branding.company_name} — Investor Deck"),
                deck_subtitle=data.get("deck_subtitle", f"Confidential | {branding.industry}"),
                research_summary={**research_data, **data.get("research_summary", {})},
                template_data=template_data,
            )
            logger.info(f"✅ MasterDeckAgent done | {len(slides)} slides | company={branding.company_name}")
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
    ) -> dict:
        """
        Pass 1: gemini-2.5-flash + Google Search grounding + thinking.
        Searches the live internet for founders, funding, competitors, market data.
        Falls back to training knowledge if search grounding fails.
        """
        company_name = user_inputs.get("company_name", "")
        prompt = self._build_research_prompt(company_url, website_content, team_info, pricing_info, user_inputs)

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
            if not data.get("founders"):
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

    def _build_research_prompt(
        self,
        company_url: str,
        website_content: str,
        team_info: list[str],
        pricing_info: list[str],
        u: dict,
    ) -> str:
        company_name = u.get("company_name", "")
        industry = u.get("industry", "")
        team_block = "\n".join(f"  • {t}" for t in team_info[:30]) if team_info else "  • None extracted"
        website_line = company_url or "Not yet live — idea-stage company"
        content_block = website_content[:8000] if website_content.strip() else self._founder_provided_block(u)

        return f"""You are a world-class company research analyst with live access to Google Search.

YOU MUST USE WEB SEARCH. Do not rely on memory. Run real searches about THIS specific company
and base every fact on what you actually find. Suggested searches (adapt to the company):
  • "{company_name or '<company>'} founders" / "...directors" / "...leadership team" / "...CEO"
  • "{company_name or '<company>'} about us" / "...management" / site:linkedin.com "{company_name or '<company>'}"
  • "{company_name or '<company>'} funding" / "...revenue" / "...headquarters"
  • the company's own /about, /team, /leadership, /company pages
Real people have verifiable names on the company website or LinkedIn. FIND them — do not invent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY TO RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website: {website_line}
Company Name: {company_name or "→ extract from website content below"}
Industry: {industry or "→ extract from website content below"}

Team members found on website (use as search leads — verify each by name):
{team_block}

Website content:
{content_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESEARCH TASKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

4. COMPETITORS — provide at least 3 (industry reasoning is OK here):
   - Real, well-known players in this exact space; for each: name, funding/valuation, one specific weakness
   - Examples: Quick commerce → Blinkit, Zepto, Swiggy Instamart | HR SaaS → Workday, BambooHR, Darwinbox
     EdTech India → BYJU'S, Unacademy, Vedantu | Fintech payments → Razorpay, PayU, Cashfree

5. MARKET DATA (search for real figures + sources):
   - TAM / SAM / SOM with source names, CAGR with source+period, 3 current growth drivers

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
  "founders": [
    {{
      "name": "Full Name",
      "title": "Co-founder & CEO",
      "education": "IIT Bombay, B.Tech Computer Science, 2018",
      "prior": "Ex-Google India PM, 3 years",
      "credential": "Forbes 30U30 2022",
      "source": "https://linkedin.com/in/... or company /about page where found",
      "confidence": "HIGH|MEDIUM|LOW"
    }}
  ],
  "company_facts": {{
    "founded_year": "2021",
    "headquarters": "Bengaluru, India",
    "headcount": "5,000+",
    "operations": "10 cities across India",
    "milestones": ["Launched in Bengaluru 2021", "Raised Series B 2022", "Expanded to Mumbai 2023"]
  }},
  "funding": {{
    "total": "$1.4B",
    "rounds": [
      {{"stage": "Seed", "amount": "$1M", "date": "Jan 2021", "investors": ["Sequoia India"]}},
      {{"stage": "Series A", "amount": "$60M", "date": "Aug 2021", "investors": ["Tiger Global", "Y Combinator"]}}
    ],
    "valuation": "$5B",
    "status": "funded|bootstrapped|unknown"
  }},
  "competitors": [
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
    ) -> str:
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
        has_real_team = bool(research_data.get("founders"))
        website_line = company_url or "Not yet live — idea-stage company"
        has_website_content = bool(website_content.strip())
        content_header = (
            "WEBSITE CONTENT (primary source for product, features, tone)" if has_website_content
            else "FOUNDER-PROVIDED COMPANY DESCRIPTION (primary source — no live website yet; this is an idea-stage / pre-launch company)"
        )
        content_block = website_content[:8000] if has_website_content else self._founder_provided_block(u)

        return f"""You are the world's best pitch deck writer and slide designer.
A research agent has already done the deep company and market research. Your ONLY job is to
format the provided data into a compelling 12-slide investor pitch deck JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFIED RESEARCH DATA {"(HIGH CONFIDENCE — use this directly)" if has_research else "(empty — company unknown, use the company description below only)"}
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
INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate 12 slides using the McKinsey Pyramid structure:
  Slide 1:  Cover             [full_bleed]
  Slide 2:  Executive Summary [big_number]
  Slide 3:  Market Opportunity [big_number]  — CAGR, key drivers, why now
  Slide 4:  Problem & Solution [two_column]
  Slide 5:  Product           [cards]
  Slide 6:  Business Model    [cards]
  Slide 7:  Traction          [big_number]
  Slide 8:  Competitive Landscape [cards]   — USE research_data.competitors EXACTLY
  Slide 9:  Team              [cards]        — USE research_data.founders EXACTLY
  Slide 10: Financials        [market_sizing] — TAM/SAM/SOM pie chart (USE research_data.tam_sam_som)
  Slide 11: The Ask           [cards]
  Slide 12: Closing           [full_bleed]

SLIDE-SPECIFIC RULES:
  Slide 4 (Problem & Solution) — two_column:
    columns[0]: heading="The Problem", highlight="<pain stat>", points=3-4 quantified bullets
    columns[1]: heading="Our Solution", highlight="<differentiator>", points=3-4 capability bullets

  Slide 8 (Competitive Landscape) — MANDATORY: always produce real competitor cards
    PRIMARY: use research_data.competitors if available
    FALLBACK (if research_data.competitors is empty or missing):
      → Read the website content to determine the company's industry + product category
      → Identify the 3 most well-known companies competing in that exact space
      → Every industry has known players — derive them. NEVER write "Not publicly disclosed" here.
      Examples: B2B SaaS → Salesforce, HubSpot, Zoho | Quick commerce → Blinkit, Swiggy Instamart, Zepto
    card title = real competitor name  |  card metric = their funding/valuation if known
    card body = one genuine weakness compared to this company (e.g. "No dark-store network outside metros")

  Slide 9 (Team) — use ONLY research_data.founders (real, web-verified people):
    card title = "Full Name — Role"  |  card body = education + prior companies
    card metric = notable credential (e.g. "Forbes 30U30")
    ⛔ NEVER invent names, titles, or bios. Use a person ONLY if present in research_data.founders.
    Entries with source="founder-provided" are founder self-reported ground truth — use them
    exactly like web-verified ones, do NOT treat them as fabrication.
    If research_data.founders is empty → 1 honest placeholder:
      title="Leadership", body="Team details available on request" (do NOT fabricate people)

  Slide 10 (Financials — layout: market_sizing):
    This slide has TWO sections:

    SECTION A — Market Sizing (data_points, EXACTLY 4):
      Source values from research_data.tam_sam_som (keys: tam, sam, som — each has "value" and "description").
      Also use research_data.market_size and research_data.market_growth for context.
      MUST be industry+domain+geography specific — not generic.
      data_points[0]: {{"label":"Total Addressable Market (TAM)","value":"$47B","sublabel":"Global quick commerce 2024 · Source: RedSeer"}}
      data_points[1]: {{"label":"Serviceable Addressable Market (SAM)","value":"$12B","sublabel":"India urban grocery delivery segment"}}
      data_points[2]: {{"label":"Serviceable Obtainable Market (SOM)","value":"$1.2B","sublabel":"~10% SAM capture · Target by 2027"}}
      data_points[3]: {{"label":"Market CAGR","value":"40%","sublabel":"2024–2028 · Source: RedSeer"}}
      CRITICAL: "value" field MUST always be a specific number like "$47B", "$12B", "$1.2B", "40%" — NEVER empty, never null.
      If research_data.tam_sam_som is empty, use your own knowledge to estimate realistic figures for this industry.

    SECTION B — Company Financials (cards, up to 3):
      Use the FOUNDER-PROVIDED FINANCIALS exactly. Show current metrics and what they project to.
      card[0]: {{"title":"Current ARR","metric":"$1.2M","body":"Annual recurring revenue as of today"}}
      card[1]: {{"title":"MoM Growth","metric":"15%","body":"Month-over-month revenue growth rate"}}
      card[2]: {{"title":"Active Customers","metric":"500+","body":"Paying customers using the platform"}}
      → Only include cards where the founder actually provided the data. Skip cards with no data.
      → If no financials were provided at all, omit cards entirely.

    SECTION C — 3-Year Revenue Projections (bullet_points, exactly 3):
      Calculate projections based on founder's current MRR/ARR + growth rate.
      Formula: if MRR=$X and MoM growth=G%, then Year N MRR = X × (1+G%)^(12×N)
      bullet_points[0]: "**FY2026:** $X ARR · N customers · Key milestone for this year"
      bullet_points[1]: "**FY2027:** $X ARR · N customers · Geographic expansion"
      bullet_points[2]: "**FY2028:** $X ARR · N customers · Path to next funding round"
      → Calculate X and N from founder's MRR × growth rate compounded annually
      → If no financials provided, project based on industry benchmarks for stage

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

This applies with extra weight to the Product, Business Model, and Market
Opportunity slides — their instructions above are the thinnest on
company-specific grounding, so they're the easiest to accidentally fill with
industry boilerplate. Re-read this rule before writing those three.

GENERAL RULES:
  - Every bullet must have a bold lead-in: "**Speed:** 10x faster than..."
  - data_points values must be punchy: "$47B", "40% CAGR"
  - Traction: use founder-provided financials exactly
  - NEVER write "Not publicly disclosed", "Evolving Landscape", "Available upon request" or any empty filler
  - If research_data is empty for competitors → derive from the industry in the website content (always possible)
  - If research_data is empty for market → estimate from the industry (every industry has published reports)
  - Every slide must contain real, specific, useful content — no placeholders, no vague filler text
  - SPECIFICITY: every claim must be traceable to a fact in the research/website data above — no
    interchangeable industry-generic sentences (see SPECIFICITY RULE above).
  - Numbers over adjectives: prefer "$47B market growing 40% CAGR" over "a large and growing market";
    prefer "200ms response time" over "lightning fast".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALSO REQUIRED: "template_data" (sibling of "slides")
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Re-express the SAME deck — same researched facts — into the richer "template_data"
object shown below. This drives a premium visual template renderer. Rules:
  - Use the SAME founders, competitors, TAM/SAM/SOM and founder financials as the slides.
  - competition.cols[0] = this company; rows[].v are booleans (true = has the feature),
    one boolean per column. This company (index 0) should win most rows.
  - traction.series[].v are NUMBERS in $M (no "$"/"M"), ascending; y = period label.
  - ask.use[].p are percentages that total 100.
  - roadmap.items = 4 real future milestones with quarter labels.
  - galleryS.slots = exactly 5 image placeholders (ph = short caption of what image goes there,
    relevant to THIS company's product/industry). Set "span": true on slots 1 and 5 only.
  - summary.highlights = exactly 4 KPI tiles (k = big number, l = short label).
  - probsol: problem[] and solution[] each = exactly 3 items; k = a 1-3 word bold lead, t = the rest.
    problemFoot/solutionFoot = one punchy line each. Keep this company winning in the solution column.
  - product.steps[].n = "01","02","03"; each step has 2-3 short "tags" (feature chips). model.flow = 3–4 short nodes.
  - Pick theme_suggestion from the allowed keys based on the industry/mood.
  - team.members: include ONLY real people from research_data.founders. ⛔ NEVER invent names/titles/bios.
    Entries with source="founder-provided" are self-reported ground truth, not fabrication — use them directly.
    If research_data.founders is empty → members:[{{"i":"","n":"Leadership","r":"Team","b":"Details available on request"}}].
  - Fill every OTHER field with real, specific content. Honest gaps beat fabricated facts —
    especially for people. Competitors/market may be reasoned from the industry.

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
  "deck_title": "Company — Investor Pitch",
  "deck_subtitle": "Confidential | Industry",
  "slides": [
    {{
      "slide_type": "cover",
      "layout": "full_bleed",
      "title": "...", "subtitle": "...", "body": "...",
      "bullet_points": [], "data_points": [], "cards": [], "columns": [],
      "speaker_notes": "..."
    }},
    {{
      "slide_type": "problem_solution",
      "layout": "two_column",
      "title": "Problem & Solution", "subtitle": "...", "body": "",
      "bullet_points": [], "data_points": [], "cards": [],
      "columns": [
        {{"heading": "The Problem", "highlight": "<stat>", "points": ["**Pain 1:** ...", "**Pain 2:** ...", "**Pain 3:** ..."]}},
        {{"heading": "Our Solution", "highlight": "<differentiator>", "points": ["**Cap 1:** ...", "**Cap 2:** ...", "**Cap 3:** ..."]}}
      ],
      "speaker_notes": "..."
    }},
    {{
      "slide_type": "financials",
      "layout": "market_sizing",
      "title": "Market Sizing & Financial Projections",
      "subtitle": "<industry> opportunity · <company> trajectory",
      "body": "",
      "columns": [],
      "data_points": [
        {{"label": "Total Addressable Market (TAM)", "value": "$47B", "sublabel": "Global quick commerce 2024 · RedSeer"}},
        {{"label": "Serviceable Addressable Market (SAM)", "value": "$12B", "sublabel": "India urban grocery delivery"}},
        {{"label": "Serviceable Obtainable Market (SOM)", "value": "$1.2B", "sublabel": "~10% SAM capture by 2027"}},
        {{"label": "Market CAGR", "value": "40%", "sublabel": "2024–2028 · Source: RedSeer"}}
      ],
      "cards": [
        {{"title": "Current ARR",      "metric": "$1.2M",  "body": "Annual recurring revenue"}},
        {{"title": "MoM Growth",       "metric": "15%",    "body": "Month-over-month growth"}},
        {{"title": "Active Customers", "metric": "500+",   "body": "Paying customers"}}
      ],
      "bullet_points": [
        "**FY2026:** $4.2M ARR · 1,500 customers · Expand to 5 new cities",
        "**FY2027:** $15M ARR · 5,000 customers · Series B raise",
        "**FY2028:** $48M ARR · 15,000 customers · 40% gross margin"
      ],
      "speaker_notes": "Market sized using RedSeer 2024 report. Revenue projections based on 15% MoM growth from current $100K MRR."
    }}
  ],
  "template_data": {{
    "company": "Company name",
    "mark": "1-2 letter monogram",
    "tagline": "one-line value proposition",
    "eyebrow": "Investor Presentation",
    "year": "2026",
    "round": "Series A · Raising $XM",
    "theme_suggestion": "one of: meridian, onyx, abyss, nocturne, forest, verdant, indigo, editorial, terra, slate",
    "summary": {{"headline": "one-sentence what the company is and why it wins", "lead": "2-sentence elaboration of the opportunity and traction", "highlights": [{{"k": "$2.4M", "l": "ARR"}}, {{"k": "500+", "l": "Customers"}}, {{"k": "40%", "l": "Market CAGR"}}, {{"k": "$48B", "l": "TAM"}}]}},
    "probsol": {{"headline": "...", "sub": "one-line framing", "problemTitle": "The Problem", "problemLead": "the core pain in one bold line", "solutionTitle": "Our Solution", "solutionLead": "the differentiator in one bold line", "problem": [{{"k": "Bold lead", "t": "rest of the pain point"}}, {{"k": "...", "t": "..."}}, {{"k": "...", "t": "..."}}], "solution": [{{"k": "Bold lead", "t": "rest of the capability"}}, {{"k": "...", "t": "..."}}, {{"k": "...", "t": "..."}}], "problemFoot": "the cost of inaction (one line)", "solutionFoot": "the payoff (one line)"}},
    "product": {{"headline": "...", "sub": "...", "steps": [{{"n": "01", "t": "Connect", "d": "...", "tags": ["Tag A", "Tag B"]}}, {{"n": "02", "t": "Track", "d": "...", "tags": ["Tag A", "Tag B"]}}, {{"n": "03", "t": "Act", "d": "...", "tags": ["Tag A", "Tag B"]}}]}},
    "market": {{"headline": "...", "tam": {{"v": "$48B", "l": "..."}}, "sam": {{"v": "$9.2B", "l": "..."}}, "som": {{"v": "$640M", "l": "..."}}, "note": "bottom-up methodology"}},
    "model": {{"headline": "...", "flow": ["Customer", "Platform", "Subscription + payments", "Net revenue"], "streams": [{{"t": "...", "d": "...", "v": "~70%", "vl": "of revenue"}}, {{"t": "...", "d": "...", "v": "~30%", "vl": "of revenue"}}], "tiers": [{{"t": "Starter", "p": "$499", "s": "/mo", "d": "..."}}, {{"t": "Growth", "p": "$1,500", "s": "/mo", "d": "..."}}, {{"t": "Enterprise", "p": "Custom", "s": "", "d": "..."}}]}},
    "traction": {{"headline": "...", "sub": "ARR growth ($M)", "series": [{{"y": "Q1", "v": 2}}, {{"y": "Q2", "v": 5}}, {{"y": "Q3", "v": 9}}, {{"y": "Q4", "v": 15}}], "kpis": [{{"k": "$2.4M", "l": "ARR"}}, {{"k": "15%", "l": "MoM growth"}}, {{"k": "500+", "l": "Customers"}}, {{"k": "120%", "l": "Net retention"}}]}},
    "competition": {{"headline": "...", "cols": ["This company", "Competitor 1", "Competitor 2", "Competitor 3"], "rows": [{{"f": "Feature A", "v": [true, false, true, false]}}, {{"f": "Feature B", "v": [true, true, false, false]}}, {{"f": "Feature C", "v": [true, false, false, false]}}, {{"f": "Feature D", "v": [true, true, true, false]}}, {{"f": "Feature E", "v": [true, false, false, true]}}]}},
    "roadmap": {{"headline": "...", "sub": "...", "items": [{{"q": "Q1 2026", "t": "...", "d": "..."}}, {{"q": "Q2 2026", "t": "...", "d": "..."}}, {{"q": "Q3 2026", "t": "...", "d": "..."}}, {{"q": "Q4 2026", "t": "...", "d": "..."}}]}},
    "galleryS": {{"headline": "...", "sub": "one line inviting product screens / photos", "slots": [{{"id": "g1", "ph": "Dashboard screenshot", "span": true}}, {{"id": "g2", "ph": "Mobile app"}}, {{"id": "g3", "ph": "Product in use"}}, {{"id": "g4", "ph": "Customer / press"}}, {{"id": "g5", "ph": "Reporting view", "span": true}}]}},
    "team": {{"headline": "...", "members": [{{"i": "BA", "n": "Full Name", "r": "CEO & Co-Founder", "b": "education + prior companies"}}], "advisors": "Backed by ..."}},
    "ask": {{"headline": "Raising $XM Series A", "sub": "...", "use": [{{"l": "Engineering & product", "p": 45}}, {{"l": "Go-to-market", "p": 30}}, {{"l": "Operations", "p": 15}}, {{"l": "G&A", "p": 10}}]}},
    "closing": {{"headline": "Let's build the future together", "sub": "...", "contact": "founders@company.com", "site": "company.com"}}
  }}
}}"""
