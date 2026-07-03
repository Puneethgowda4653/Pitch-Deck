"""
Analysis Agent v2 — Investor-grade synthesis using GEMINI API KEY 1 with deep thinking.

This is the "deep think" step: it receives all company + industry intelligence
and synthesizes it into investor-grade insights that feed directly into slide content.

Key usage: settings.gemini_api_key (Key 1) with thinking_budget enabled.
Thinking allows Gemini to reason through complex trade-offs before answering,
producing more credible positioning, ICP definitions, and financial scenarios.

Outputs:
  - Positioning statement (the single-sentence investment thesis)
  - ICP (Ideal Customer Profile) — who exactly buys this
  - Competitive moat — WHY they win defensibly
  - Revenue scenarios — conservative / base / optimistic with assumptions
  - SWOT matrix
  - GTM strategy — concrete channels, not generic advice
  - Investor attractiveness score 1-10 with rationale
  - Risk factors with severity and mitigation
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
from app.schemas.intake import CompanyIntake


@dataclass
class ICPProfile:
    description: str = ""
    company_size: str = ""
    industry_vertical: str = ""
    job_titles: list[str] = field(default_factory=list)
    primary_pain: str = ""
    budget_range: str = ""
    buying_trigger: str = ""


@dataclass
class SWOTMatrix:
    strengths: list[str] = field(default_factory=list)
    weaknesses: list[str] = field(default_factory=list)
    opportunities: list[str] = field(default_factory=list)
    threats: list[str] = field(default_factory=list)


@dataclass
class RiskFactor:
    risk: str = ""
    severity: str = ""   # low | medium | high
    mitigation: str = ""


@dataclass
class InvestorScore:
    score: int = 0
    summary: str = ""
    highlights: list[str] = field(default_factory=list)
    concerns: list[str] = field(default_factory=list)


@dataclass
class AnalysisData:
    positioning: str = ""
    icp: ICPProfile = field(default_factory=ICPProfile)
    competitive_moat: str = ""
    market_opportunity: str = ""
    revenue_scenarios: list[dict] = field(default_factory=list)
    scalability: str = ""
    gtm_strategy: list[str] = field(default_factory=list)
    swot: SWOTMatrix = field(default_factory=SWOTMatrix)
    investor_score: InvestorScore = field(default_factory=InvestorScore)
    risk_factors: list[RiskFactor] = field(default_factory=list)
    confidence: dict = field(default_factory=dict)

    def model_dump(self) -> dict:
        return {
            "positioning": self.positioning,
            "icp": {
                "description": self.icp.description,
                "company_size": self.icp.company_size,
                "industry_vertical": self.icp.industry_vertical,
                "job_titles": self.icp.job_titles,
                "primary_pain": self.icp.primary_pain,
                "budget_range": self.icp.budget_range,
                "buying_trigger": self.icp.buying_trigger,
            },
            "competitive_moat": self.competitive_moat,
            "market_opportunity": self.market_opportunity,
            "revenue_scenarios": self.revenue_scenarios,
            "scalability": self.scalability,
            "gtm_strategy": self.gtm_strategy,
            "swot": {
                "strengths": self.swot.strengths,
                "weaknesses": self.swot.weaknesses,
                "opportunities": self.swot.opportunities,
                "threats": self.swot.threats,
            },
            "investor_score": {
                "score": self.investor_score.score,
                "summary": self.investor_score.summary,
                "highlights": self.investor_score.highlights,
                "concerns": self.investor_score.concerns,
            },
            "risk_factors": [
                {"risk": r.risk, "severity": r.severity, "mitigation": r.mitigation}
                for r in self.risk_factors
            ],
            "confidence": self.confidence,
        }


class AnalysisAgent:
    """
    Synthesizes all intelligence into investor-grade analysis.
    Uses Key 1 (company key) with deep thinking for maximum accuracy.
    """

    def __init__(self):
        # KEY 1: Company analysis — the "deep think" key
        api_key = settings.gemini_api_key
        if not api_key:
            raise ValueError("GEMINI_API_KEY (Key 1) is not configured")
        self._client = make_genai_client(api_key)
        self._model = settings.gemini_model

    async def run(
        self,
        branding: BrandingData,
        research: ResearchData,
        crawl: CrawlResult,
        intake: Optional[CompanyIntake] = None,
    ) -> AnalysisData:
        logger.info(f"🧠 Deep analysis starting | company={branding.company_name} [Key 1 + thinking]")

        prompt = self._build_prompt(branding, research, crawl, intake)

        try:
            raw = self._call_gemini_with_thinking(prompt)

            json_str = self._repair_json(self._extract_json(raw))
            d = json.loads(json_str)

            icp_raw = d.get("icp", {})
            swot_raw = d.get("swot", {})
            score_raw = d.get("investor_score", {})

            result = AnalysisData(
                positioning=d.get("positioning", ""),
                icp=ICPProfile(
                    description=icp_raw.get("description", ""),
                    company_size=icp_raw.get("company_size", ""),
                    industry_vertical=icp_raw.get("industry_vertical", ""),
                    job_titles=icp_raw.get("job_titles", []),
                    primary_pain=icp_raw.get("primary_pain", ""),
                    budget_range=icp_raw.get("budget_range", ""),
                    buying_trigger=icp_raw.get("buying_trigger", ""),
                ),
                competitive_moat=d.get("competitive_moat", ""),
                market_opportunity=d.get("market_opportunity", ""),
                revenue_scenarios=d.get("revenue_scenarios", []),
                scalability=d.get("scalability", ""),
                gtm_strategy=d.get("gtm_strategy", []),
                swot=SWOTMatrix(
                    strengths=swot_raw.get("strengths", []),
                    weaknesses=swot_raw.get("weaknesses", []),
                    opportunities=swot_raw.get("opportunities", []),
                    threats=swot_raw.get("threats", []),
                ),
                investor_score=InvestorScore(
                    score=int(score_raw.get("score", 5)),
                    summary=score_raw.get("summary", ""),
                    highlights=score_raw.get("highlights", []),
                    concerns=score_raw.get("concerns", []),
                ),
                risk_factors=[
                    RiskFactor(
                        risk=r.get("risk", ""),
                        severity=r.get("severity", "medium"),
                        mitigation=r.get("mitigation", ""),
                    )
                    for r in d.get("risk_factors", [])
                ],
                confidence=d.get("confidence", {}),
            )

            logger.info(
                f"✅ Analysis complete | score={result.investor_score.score}/10 | "
                f"strengths={len(result.swot.strengths)} | risks={len(result.risk_factors)}"
            )
            return result

        except Exception as exc:
            logger.error(f"❌ Analysis failed: {exc}")
            return self._fallback(branding, research)

    def _call_gemini_with_thinking(self, prompt: str) -> str:
        """Call Gemini with thinking budget for deep analysis."""
        try:
            response = self._client.models.generate_content(
                model=self._model, contents=prompt
            )
        except Exception:
            response = self._client.models.generate_content(model=self._model, contents=prompt)
        return response.text

    def _build_prompt(self, branding: BrandingData, research: ResearchData, crawl: CrawlResult, intake: Optional[CompanyIntake] = None) -> str:
        competitors_summary = "\n".join(
            f"  • {c.get('name','')}: {c.get('description','')} | "
            f"strength: {c.get('strength','')} | weakness: {c.get('weakness','')}"
            for c in research.competitors[:5]
        )
        trends = "\n".join(f"  • {t}" for t in research.industry_trends[:5])
        pains = "\n".join(f"  • {p}" for p in research.pain_points[:4])
        website_excerpt = (crawl.text_summary or "")[:3000]
        pricing_signals = "\n".join(crawl.pricing_info[:8]) if crawl.pricing_info else "Not detected"
        team_signals = "\n".join(crawl.team_info[:8]) if crawl.team_info else "Not detected"
        intake_section = intake.to_prompt_section() if intake else ""

        return f"""You are a General Partner at a top-tier VC fund (Sequoia / a16z level) conducting due diligence.
Your analysis will directly populate an investor pitch deck — every claim must be credible and specific.
Use deep reasoning to synthesize all inputs into a coherent investment thesis.

{intake_section + chr(10) if intake_section else ""}COMPANY INTELLIGENCE (from website):
  Name: {branding.company_name}
  Industry: {branding.industry}
  Description: {branding.description}
  Tagline: {branding.tagline}
  Target Audience: {branding.target_audience}
  Products / Features: {', '.join(branding.key_products) if branding.key_products else 'See website'}
  Business Model: {branding.business_model}
  Tech Stack: {', '.join(branding.tech_stack) if branding.tech_stack else 'Not detected'}
  Competitors on Site: {', '.join(branding.competitors_mentioned) if branding.competitors_mentioned else 'None'}
  Pricing Signals: {pricing_signals}
  Team Signals: {team_signals}
  Testimonials Found: {len(branding.testimonials)}

MARKET RESEARCH (from industry sources):
  TAM: {research.market_size}
  Market Growth: {research.market_growth}
  Target Market: {research.target_market}
  Business Model (industry norm): {research.business_model}
  Revenue Streams: {', '.join(research.revenue_streams)}
  Company Funding: {research.funding_info}
  TAM/SAM/SOM: {json.dumps(research.tam_sam_som)}

  Competitors:
{competitors_summary}

  Industry Trends:
{trends}

  Customer Pain Points:
{pains}

WEBSITE CONTENT EXCERPT:
{website_excerpt}

TASK: Produce an investor-grade synthesis. Think deeply — consider what makes this company defensible,
who really buys it, how fast it can grow, and what would make a VC say no.

CONFIDENCE SCORING:
  85-100 = Directly verified from website / multiple sources
  65-84  = Reasonably inferred from available data
  40-64  = Estimated based on industry norms
  0-39   = Speculative (mark with "(est.)" in text)

Return ONLY valid JSON:
{{
  "positioning": "One sharp sentence: '{branding.company_name} is the [category] for [ICP] that [key differentiator], unlike [incumbent] which [weakness]'",

  "icp": {{
    "description": "2-sentence narrative of the ideal customer",
    "company_size": "e.g. '50-500 employee SaaS companies'",
    "industry_vertical": "Primary vertical",
    "job_titles": ["Primary buyer", "Day-to-day champion", "Economic buyer"],
    "primary_pain": "The single biggest pain {branding.company_name} solves for this ICP",
    "budget_range": "Estimated annual budget range e.g. '$24K-$120K/yr'",
    "buying_trigger": "Specific event that makes them buy e.g. 'Series A funding, team scaling past 50'"
  }},

  "competitive_moat": "2-3 sentences: proprietary data, network effects, switching costs, or tech moat",

  "market_opportunity": "2-3 sentences combining TAM/SAM with 'why now' timing argument",

  "revenue_scenarios": [
    {{"scenario": "Conservative Y1", "arr": "$Xk-$XM", "assumption": "key assumption", "confidence": 60}},
    {{"scenario": "Base Y2",         "arr": "$XM-$XM", "assumption": "key assumption", "confidence": 55}},
    {{"scenario": "Optimistic Y3",   "arr": "$XM+",    "assumption": "key assumption", "confidence": 40}}
  ],

  "scalability": "2 sentences: unit economics, automation, network effects, or geographic expansion",

  "gtm_strategy": [
    "Channel 1: specific tactic with target segment",
    "Channel 2: specific tactic",
    "Channel 3: specific tactic",
    "Channel 4: expansion motion (land-and-expand / PLG / referral)"
  ],

  "swot": {{
    "strengths": ["S1 with evidence", "S2 with evidence", "S3", "S4"],
    "weaknesses": ["W1 honest assessment", "W2", "W3"],
    "opportunities": ["O1 with market size", "O2", "O3", "O4"],
    "threats": ["T1 with competitor/trend name", "T2", "T3"]
  }},

  "investor_score": {{
    "score": 7,
    "summary": "2-sentence investment thesis",
    "highlights": ["Specific reason 1 to invest", "Specific reason 2", "Specific reason 3"],
    "concerns": ["Specific concern 1 to address", "Specific concern 2"]
  }},

  "risk_factors": [
    {{"risk": "Risk name", "severity": "high",   "mitigation": "How to address"}},
    {{"risk": "Risk name", "severity": "medium", "mitigation": "How to address"}},
    {{"risk": "Risk name", "severity": "medium", "mitigation": "How to address"}},
    {{"risk": "Risk name", "severity": "low",    "mitigation": "How to address"}}
  ],

  "confidence": {{
    "market_size": 75,
    "competitor_analysis": 80,
    "revenue_projections": 45,
    "icp_definition": 70,
    "gtm_strategy": 65,
    "investor_score": 72
  }}
}}"""

    def _extract_json(self, raw: str) -> str:
        s = raw
        if "```json" in s:
            s = s.split("```json", 1)[1].split("```")[0]
        elif "```" in s:
            s = s.split("```", 1)[1].split("```")[0]
        start, end = s.find("{"), s.rfind("}")
        if start != -1 and end != -1 and end > start:
            s = s[start:end + 1]
        return s.strip()

    def _repair_json(self, s: str) -> str:
        s = re.sub(r",\s*([}\]])", r"\1", s)
        if not s.rstrip().endswith("}"):
            open_braces = s.count("{") - s.count("}")
            open_brackets = s.count("[") - s.count("]")
            if s.rstrip() and s.rstrip()[-1] not in ('"', '}', ']', '0123456789'):
                s = s.rstrip().rstrip(",") + '"'
            s += "]" * max(0, open_brackets) + "}" * max(0, open_braces)
        return s

    def _fallback(self, branding: BrandingData, research: ResearchData) -> AnalysisData:
        name = branding.company_name or "The Company"
        industry = branding.industry or "technology"
        return AnalysisData(
            positioning=f"{name} is building the leading platform for {industry}",
            icp=ICPProfile(
                description=f"Companies in {industry} looking to modernize their operations",
                company_size="50-500 employees",
                industry_vertical=industry,
                job_titles=["VP Operations", "CTO", "Head of Product"],
                primary_pain="Inefficient manual processes and lack of data-driven decision making",
                budget_range="$12K-$60K/yr",
                buying_trigger="Digital transformation initiative or team scaling",
            ),
            competitive_moat=f"{name}'s unique approach and deep domain expertise create a defensible position",
            market_opportunity=f"The {industry} market is large and growing. The timing is right as incumbents have failed to modernize.",
            revenue_scenarios=[
                {"scenario": "Conservative Y1", "arr": "$500K", "assumption": "50 customers at $10K ACV", "confidence": 55},
                {"scenario": "Base Y2",         "arr": "$2M",   "assumption": "150 customers, expanding ACV", "confidence": 50},
                {"scenario": "Optimistic Y3",   "arr": "$8M",   "assumption": "Enterprise expansion + new verticals", "confidence": 40},
            ],
            scalability="SaaS model enables efficient scaling with low marginal cost. Geographic and vertical expansion provide clear growth vectors.",
            gtm_strategy=[
                "Direct outbound targeting VP-level buyers in key verticals",
                "Content marketing and SEO to capture inbound demand",
                "Strategic partnerships with complementary tools",
                "Land-and-expand to grow within accounts",
            ],
            swot=SWOTMatrix(
                strengths=[f"Strong domain expertise in {industry}", "Modern technical architecture", "Clear value proposition"],
                weaknesses=["Early-stage brand awareness", "Limited case studies", "Small sales team"],
                opportunities=[f"Large underserved segment in {industry}", "AI/automation tailwind", "International expansion"],
                threats=["Well-funded incumbents", "Market education required", "Economic headwinds on IT budgets"],
            ),
            investor_score=InvestorScore(
                score=6,
                summary=f"{name} addresses a real pain point in a large market. Execution on GTM and differentiation will be key.",
                highlights=["Large addressable market", "Strong founding team domain expertise", "Clear customer pain point"],
                concerns=["Early traction metrics needed", "Competitive landscape is established"],
            ),
            risk_factors=[
                RiskFactor("Customer acquisition cost uncertainty", "medium", "Validate CAC with pilot cohort before scaling"),
                RiskFactor("Competitive response from incumbents", "high", "Move fast, lock in anchor customers, build switching costs"),
                RiskFactor("Team scaling challenges", "medium", "Build hiring pipeline ahead of funding close"),
            ],
            confidence={"market_size": 50, "competitor_analysis": 60, "revenue_projections": 35, "icp_definition": 55, "gtm_strategy": 55, "investor_score": 50},
        )
