"""
Analysis Pipeline — Core Celery Task (v2)

7-step intelligent pipeline:

  Step 1 (0–12%):   WebCrawler v2     — full-site scrape (sitemap + link discovery, 15 pages)
  Step 2 (12–25%):  BrandingExtractor — company identity [Key 1]
  Step 3 (25–45%):  ResearchAgent     — industry/market research [Key 2, parallel web searches]
  Step 4 (45–65%):  AnalysisAgent     — investor synthesis [Key 1 + deep thinking]
  Step 5 (65–82%):  ContentAgent      — 14 slides with intelligent per-slide routing [Key 1]
  Step 6 (82–94%):  PPTRenderer       — render branded PPTX
  Step 7 (94–100%): StorageClient     — upload to S3/MinIO

Key 1 (GEMINI_API_KEY):  company analysis, synthesis, content generation
Key 2 (GEMINI_API_KEY_2): industry & market research (separate quota)
"""
import asyncio
from datetime import datetime, timezone
from typing import Any

from celery import Task
from loguru import logger

from app.core.config import settings
from app.workers.celery_app import celery_app
from app.db.session import get_db_context
from app.models.models import Job, Project
from app.schemas.intake import CompanyIntake


class AnalysisTask(Task):
    """Base task with DB update helpers."""

    abstract = True

    async def _update_job(
        self,
        job_id: str,
        *,
        status: str = None,
        current_step: str = None,
        step_progress: int = None,
        total_progress: int = None,
        message: str = None,
        error: str = None,
    ) -> None:
        from sqlalchemy import update

        async with get_db_context() as db:
            updates: dict[str, Any] = {}
            if status is not None:
                updates["status"] = status
            if current_step is not None:
                updates["current_step"] = current_step
            if step_progress is not None:
                updates["step_progress"] = step_progress
            if total_progress is not None:
                updates["total_progress"] = total_progress
            if message is not None:
                updates["message"] = message
            if error is not None:
                updates["error"] = error
            if status == "running":
                updates.setdefault("started_at", datetime.now(timezone.utc))
            if status in ("completed", "failed"):
                updates["completed_at"] = datetime.now(timezone.utc)

            if updates:
                await db.execute(
                    update(Job).where(Job.id == job_id).values(**updates)
                )

    async def _update_project(
        self, project_id: str, *, status: str, **kwargs: Any
    ) -> None:
        from sqlalchemy import update

        async with get_db_context() as db:
            await db.execute(
                update(Project)
                .where(Project.id == project_id)
                .values(status=status, **kwargs)
            )


@celery_app.task(
    bind=True,
    base=AnalysisTask,
    name="tasks.analysis.run_pipeline",
    max_retries=2,
    default_retry_delay=30,
    acks_late=True,
)
def run_analysis_pipeline(self, *, project_id: str, job_id: str) -> dict:
    """Sync Celery entry point — wraps the async pipeline."""
    return asyncio.run(_run_pipeline_async(self, project_id=project_id, job_id=job_id))


async def _run_pipeline_async(
    task: AnalysisTask, *, project_id: str, job_id: str
) -> dict:
    """7-step async analysis pipeline."""
    logger.info(f"🚀 Pipeline v2 starting | project={project_id} job={job_id}")

    from app.services.crawler.web_crawler import WebCrawler
    from app.services.branding.extractor import BrandingExtractor
    from app.agents.research.research_agent import ResearchAgent
    from app.agents.analysis.analysis_agent import AnalysisAgent
    from app.agents.content.content_agent import ContentGenerationAgent
    from app.ppt.engine.renderer import PPTRenderer
    from app.services.storage.s3_client import StorageClient

    async def progress(step: str, step_pct: int, total_pct: int, msg: str) -> None:
        await task._update_job(
            job_id,
            current_step=step,
            step_progress=step_pct,
            total_progress=total_pct,
            message=msg,
        )
        logger.info(f"  [{total_pct:3d}%] {msg}")

    await task._update_job(job_id, status="running")
    await task._update_project(project_id, status="analyzing")

    async with get_db_context() as db:
        project_obj = await db.get(Project, project_id)
        project_branding = project_obj.branding_data or {}

    try:
        # ── Step 1: Crawl entire website (0–12%) ──────────────────────────────
        await progress("crawling", 0, 0, "Discovering and crawling website…")
        crawler = WebCrawler(timeout_ms=settings.crawl_timeout_ms, max_pages=settings.crawl_max_pages)
        crawl_result = await crawler.crawl(project_id=project_id)
        await progress(
            "crawling", 100, 12,
            f"Crawled {crawl_result.pages_crawled} pages, "
            f"found {len(crawl_result.pricing_info)} pricing signals"
        )

        # ── Step 2: Extract company identity (12–25%) — Key 1 ─────────────────
        await progress("extracting_branding", 0, 12, "Analyzing company identity with AI (Key 1)…")
        extractor = BrandingExtractor()
        branding_data = await extractor.extract(crawl_result)
        await progress(
            "extracting_branding", 100, 25,
            f"Brand identified: {branding_data.company_name} | {branding_data.industry}"
        )

        if project_branding:
            for field in (
                "company_name",
                "industry",
                "tagline",
                "description",
                "primary_color",
                "secondary_color",
                "tone",
                "target_audience",
                "key_products",
                "competitors_mentioned",
                "pricing_model",
                "business_model",
            ):
                if project_branding.get(field):
                    setattr(branding_data, field, project_branding[field])

            intake = None
            try:
                intake_payload = {**project_branding, "website_url": crawl_result.base_url}
                intake = CompanyIntake.model_validate(intake_payload)
            except Exception:
                intake = None
        else:
            intake = None

        # ── Step 3: Industry & market research (25–45%) — Key 2 ───────────────
        await task._update_project(project_id, status="researching")
        await progress("researching", 0, 25, "Researching industry, market size & competitors (Key 2)…")
        research_agent = ResearchAgent()
        research_data = await research_agent.run(
            company_name=branding_data.company_name,
            company_url=crawl_result.base_url,
            industry=branding_data.industry,
            description=branding_data.description,
        )
        await progress(
            "researching", 100, 45,
            f"Market research complete: TAM={research_data.market_size} | "
            f"{len(research_data.competitors)} competitors identified"
        )

        # ── Step 4: Investor synthesis (45–65%) — Key 1 + deep thinking ───────
        await task._update_project(project_id, status="analyzing")
        await progress("analyzing", 0, 45, "Running deep investor analysis (Key 1 + thinking)…")
        analysis_agent = AnalysisAgent()
        analysis_data = await analysis_agent.run(
            branding=branding_data,
            research=research_data,
            crawl=crawl_result,
            intake=intake,
        )
        await progress(
            "analyzing", 100, 65,
            f"Analysis complete: score={analysis_data.investor_score.score}/10 | "
            f"positioning defined | revenue scenarios built"
        )

        # ── Step 5: Generate 14 slides (65–82%) — Key 1 ──────────────────────
        await task._update_project(project_id, status="generating")
        await progress("generating_content", 0, 65, "Writing 14 investor slides with intelligent routing…")
        content_agent = ContentGenerationAgent()
        deck_content = await content_agent.generate(
            branding=branding_data,
            research=research_data,
            crawl_data=crawl_result,
            analysis=analysis_data,
        )
        await progress(
            "generating_content", 100, 82,
            f"Generated {len(deck_content.slides)} slides"
        )

        # ── Step 6: Render PPTX (82–94%) ─────────────────────────────────────
        await progress("rendering_ppt", 0, 82, "Rendering branded PPTX presentation…")
        renderer = PPTRenderer()
        pptx_bytes = await renderer.render(deck_content=deck_content, branding=branding_data)
        await progress("rendering_ppt", 100, 94, f"PPTX rendered ({len(pptx_bytes):,} bytes)")

        # ── Step 7: Upload to S3/MinIO (94–100%) ──────────────────────────────
        await progress("uploading", 0, 94, "Uploading presentation to storage…")
        storage = StorageClient()
        file_url = await storage.upload_pptx(
            data=pptx_bytes,
            filename=f"{project_id}/presentation.pptx",
        )
        thumbnail_url = await storage.upload_thumbnail(project_id=project_id)
        await progress("uploading", 100, 100, "Done!")

        # ── Persist results ────────────────────────────────────────────────────
        from sqlalchemy import update
        from app.models.models import Presentation

        async with get_db_context() as db:
            await db.execute(
                update(Project)
                .where(Project.id == project_id)
                .values(
                    status="ready",
                    branding_data=branding_data.model_dump(),
                    research_data=research_data.model_dump(),
                    deck_content=deck_content.model_dump(),
                )
            )
            project_obj = await db.get(Project, project_id)
            presentation = Presentation(
                project_id=project_id,
                user_id=project_obj.user_id,
                file_url=file_url,
                thumbnail_url=thumbnail_url,
                status="ready",
                format="pptx",
                slide_count=len(deck_content.slides),
            )
            db.add(presentation)

        await task._update_job(job_id, status="completed", total_progress=100)

        logger.info(f"✅ Pipeline complete | project={project_id} | {len(deck_content.slides)} slides")
        return {"success": True, "project_id": project_id, "file_url": file_url}

    except Exception as exc:
        error_msg = str(exc)
        logger.exception(f"❌ Pipeline failed | project={project_id} | {error_msg}")

        await task._update_job(job_id, status="failed", error=error_msg)
        await task._update_project(project_id, status="error")

        if "timeout" in error_msg.lower() or "connection" in error_msg.lower():
            raise task.retry(exc=exc)

        raise
