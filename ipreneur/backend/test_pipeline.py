"""
End-to-end pipeline test: intake → crawl → branding → research → analysis.
Run from the backend directory:
  $env:PYTHONUTF8=1; .\.venv\Scripts\python test_pipeline.py
"""
import asyncio
import json
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.schemas.intake import CompanyIntake, FundingStage, BusinessModelType
from app.services.crawler.web_crawler import WebCrawler
from app.services.branding.extractor import BrandingExtractor
from app.agents.research.research_agent import ResearchAgent
from app.agents.analysis.analysis_agent import AnalysisAgent
from app.core.config import settings


async def main():
    # ── Intake form (fill in what you know, leave the rest as None) ──────────
    intake = CompanyIntake(
        website_url="https://linear.app",

        # Business basics
        company_name=None,          # let crawler infer
        industry=None,              # let crawler infer
        business_model=BusinessModelType.saas,
        funding_stage=FundingStage.series_a,
        founded_year=2019,
        team_size=80,

        # Financials (leave None if unknown)
        arr_usd=None,
        mrr_usd=None,

        # Traction
        total_customers=None,
        monthly_active_users=None,
        growth_rate_mom_pct=None,

        # Unit economics
        cac_usd=None,
        ltv_usd=None,
        churn_rate_pct=None,
        nrr_pct=None,

        # The Ask
        ask_amount_usd=None,
        round_type=None,
        use_of_funds=None,
        runway_months=None,
    )

    print(f"\n{'='*60}")
    print(f"Pipeline starting for: {intake.website_url}")
    print(f"{'='*60}")

    # ── Step 1: Crawl ────────────────────────────────────────────────────────
    print("\n[1/4] Crawling website...")
    crawler = WebCrawler(timeout_ms=settings.crawl_timeout_ms, max_pages=settings.crawl_max_pages)
    crawl = await crawler.crawl_url(intake.website_url)
    print(f"      Pages: {crawl.pages_crawled} | Images: {len(crawl.all_images)} | Colors: {len(crawl.all_colors)}")

    # ── Step 2: Branding extraction ──────────────────────────────────────────
    print("\n[2/4] Extracting branding...")
    branding = await BrandingExtractor().extract(crawl)
    if intake.company_name:
        branding.company_name = intake.company_name
    if intake.industry:
        branding.industry = intake.industry
    if intake.business_model:
        branding.business_model = intake.business_model.value
    print(f"      Company: {branding.company_name} | Industry: {branding.industry}")
    print(f"      Tagline: {branding.tagline}")

    # ── Step 3: Market research ──────────────────────────────────────────────
    print("\n[3/4] Running market research...")
    research = await ResearchAgent().run(
        company_name=branding.company_name,
        company_url=intake.website_url,
        industry=branding.industry,
        description=branding.description,
    )
    print(f"      TAM: {research.market_size} | Growth: {research.market_growth}")
    print(f"      Competitors found: {len(research.competitors)}")

    # ── Step 4: Deep analysis ────────────────────────────────────────────────
    print("\n[4/4] Running investor analysis...")
    analysis = await AnalysisAgent().run(
        branding=branding,
        research=research,
        crawl=crawl,
        intake=intake,
    )
    print(f"      Investor Score: {analysis.investor_score.score}/10")
    print(f"      Positioning: {analysis.positioning}")

    # ── Results summary ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("FULL PIPELINE RESULTS")
    print(f"{'='*60}")

    print(f"\nBRANDING")
    print(f"  Company    : {branding.company_name}")
    print(f"  Industry   : {branding.industry}")
    print(f"  Tagline    : {branding.tagline}")
    print(f"  Model      : {branding.business_model}")
    print(f"  Colors     : {branding.primary_color}, {branding.secondary_color}")

    print(f"\nMARKET RESEARCH")
    print(f"  TAM        : {research.market_size}")
    print(f"  Growth     : {research.market_growth}")
    print(f"  TAM/SAM/SOM: {json.dumps(research.tam_sam_som, indent=4)}")
    print(f"  Competitors:")
    for c in research.competitors[:3]:
        print(f"    - {c.get('name')}: {c.get('description', '')[:80]}")

    print(f"\nANALYSIS")
    print(f"  Score      : {analysis.investor_score.score}/10 — {analysis.investor_score.summary}")
    print(f"  Positioning: {analysis.positioning}")
    print(f"  ICP        : {analysis.icp.description}")
    print(f"  Moat       : {analysis.competitive_moat}")
    print(f"\n  SWOT Strengths:")
    for s in analysis.swot.strengths:
        print(f"    + {s}")
    print(f"  SWOT Weaknesses:")
    for w in analysis.swot.weaknesses:
        print(f"    - {w}")
    print(f"\n  Revenue Scenarios:")
    for r in analysis.revenue_scenarios:
        print(f"    {r.get('scenario')}: {r.get('arr')} — {r.get('assumption')}")
    print(f"\n  GTM:")
    for g in analysis.gtm_strategy:
        print(f"    > {g}")
    print(f"\n  Risk Factors:")
    for rf in analysis.risk_factors:
        print(f"    [{rf.severity.upper()}] {rf.risk} -> {rf.mitigation}")
    print(f"\n  Investor Highlights:")
    for h in analysis.investor_score.highlights:
        print(f"    * {h}")
    print(f"  Investor Concerns:")
    for con in analysis.investor_score.concerns:
        print(f"    ! {con}")

    # ── Save to JSON ─────────────────────────────────────────────────────────
    output = {
        "intake": {
            "website_url": intake.website_url,
            "business_model": intake.business_model.value if intake.business_model else None,
            "funding_stage": intake.funding_stage.value if intake.funding_stage else None,
        },
        "crawl_summary": {
            "pages_crawled": crawl.pages_crawled,
            "images": len(crawl.all_images),
            "colors": crawl.all_colors,
            "pricing_signals": crawl.pricing_info,
            "team_signals": crawl.team_info,
        },
        "branding": branding.model_dump(),
        "research": research.model_dump(),
        "analysis": analysis.model_dump(),
    }

    out_path = Path("pipeline_output.json")
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nFull output saved to: {out_path.resolve()}")


asyncio.run(main())
