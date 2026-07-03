"""
Pipeline endpoint — runs the full pitch deck analysis pipeline.

Flow:
  1. Accept CompanyIntake (URL + optional founder metrics)
  2. Crawl website with Playwright
  3. Run BrandingExtractor + ResearchAgent in parallel (when possible)
  4. Run AnalysisAgent with all inputs merged
  5. Return combined result
"""
import asyncio
from fastapi import APIRouter, HTTPException
from loguru import logger

from app.schemas.intake import CompanyIntake
from app.services.crawler.web_crawler import WebCrawler
from app.services.branding.extractor import BrandingExtractor
from app.agents.research.research_agent import ResearchAgent
from app.agents.analysis.analysis_agent import AnalysisAgent
from app.core.config import settings

router = APIRouter()


@router.post("/generate")
async def generate_analysis(intake: CompanyIntake):
    """
    Run the full analysis pipeline from a company URL + optional founder metrics.
    Returns branding + research + analysis ready for slide generation.
    """
    url = intake.website_url
    logger.info(f"Pipeline started | url={url}")

    # ── Step 1: Crawl website ────────────────────────────────────────────────
    try:
        crawler = WebCrawler(
            timeout_ms=settings.crawl_timeout_ms,
            max_pages=settings.crawl_max_pages,
        )
        crawl_result = await crawler.crawl_url(url)
        logger.info(f"Crawl done | pages={crawl_result.pages_crawled}")
    except Exception as exc:
        logger.error(f"Crawl failed: {exc}")
        raise HTTPException(status_code=422, detail=f"Could not crawl {url}: {exc}")

    # ── Step 2: Branding + Research in parallel ──────────────────────────────
    # If intake already has company_name + industry, we can run both in parallel.
    # Otherwise branding must finish first to supply those values to research.
    branding_extractor = BrandingExtractor()
    research_agent = ResearchAgent()

    has_context = bool(intake.company_name and intake.industry)

    if has_context:
        branding, research = await asyncio.gather(
            branding_extractor.extract(crawl_result),
            research_agent.run(
                company_name=intake.company_name,
                company_url=url,
                industry=intake.industry,
                description="",
            ),
        )
    else:
        branding = await branding_extractor.extract(crawl_result)
        research = await research_agent.run(
            company_name=branding.company_name,
            company_url=url,
            industry=branding.industry,
            description=branding.description,
        )

    # Override branding fields with verified intake data
    if intake.company_name:
        branding.company_name = intake.company_name
    if intake.industry:
        branding.industry = intake.industry
    if intake.business_model:
        branding.business_model = intake.business_model.value

    logger.info(f"Branding + Research done | company={branding.company_name} | industry={branding.industry}")

    # ── Step 3: Deep analysis ────────────────────────────────────────────────
    analysis_agent = AnalysisAgent()
    analysis = await analysis_agent.run(
        branding=branding,
        research=research,
        crawl=crawl_result,
        intake=intake,
    )

    logger.info(f"Analysis done | investor_score={analysis.investor_score.score}/10")

    return {
        "status": "success",
        "url": url,
        "branding": branding.model_dump(),
        "research": research.model_dump(),
        "analysis": analysis.model_dump(),
        "crawl_summary": {
            "pages_crawled": crawl_result.pages_crawled,
            "images_found": len(crawl_result.all_images),
            "colors_found": len(crawl_result.all_colors),
            "pricing_signals": len(crawl_result.pricing_info),
            "team_signals": len(crawl_result.team_info),
        },
    }
