"""
Projects endpoints — CRUD + AI analysis trigger.

POST   /projects          → create project
GET    /projects          → list user's projects
GET    /projects/{id}     → get project detail
PUT    /projects/{id}     → update project
DELETE /projects/{id}     → soft delete
POST   /projects/{id}/analyze  → kick off AI workflow
GET    /projects/{id}/status   → get current job status
"""
from typing import Optional
import asyncio
import threading

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.api.deps.auth import get_current_user
from app.db.session import get_db, get_db_context
from app.models.models import Job, Project, User, Presentation
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectListResponse,
    ProjectUpdate,
    JobProgressResponse,
)
from app.workers.tasks.analysis import run_analysis_pipeline

router = APIRouter()


# ─── Inline analysis pipeline (runs without Celery) ──────────────────────────

async def _run_analysis_inline(project_id: str, job_id: str) -> None:
    """Run the pitch deck pipeline using the MasterDeckAgent — one Gemini call does everything."""
    from app.services.crawler.web_crawler import WebCrawler
    from app.agents.master.master_agent import MasterDeckAgent, BrandingResult
    from app.ppt.engine.renderer import PPTRenderer
    from app.services.storage.s3_client import StorageClient
    from app.core.config import settings
    from app.agents.content.content_agent import DeckContent, SlideContent
    from datetime import datetime, timezone

    async def update_job(**kwargs):
        async with get_db_context() as db:
            await db.execute(update(Job).where(Job.id == job_id).values(**kwargs))

    async def update_project(**kwargs):
        async with get_db_context() as db:
            await db.execute(update(Project).where(Project.id == project_id).values(**kwargs))

    logger.info(f"🚀 Pipeline starting | project={project_id} job={job_id}")
    await update_job(status="running", started_at=datetime.now(timezone.utc))

    try:
        # Load project data
        async with get_db_context() as db:
            _proj = await db.get(Project, project_id)
            _user_input: dict = (_proj.branding_data or {}) if _proj else {}
            _company_url: str = (_proj.company_url if _proj else None) or "https://example.com"
            _template_key: Optional[str] = _proj.template_key if _proj else None

        # ── Step 1: Crawl website ────────────────────────────────────────────
        try:
            logger.info(f"📍 Step 1: Starting crawler | url={_company_url}")
            await update_job(current_step="crawling", total_progress=0, message="Crawling website...")
            
            crawler = WebCrawler(timeout_ms=settings.crawl_timeout_ms, max_pages=settings.crawl_max_pages)
            logger.info(f"📍 Crawler instantiated, starting crawl...")
            
            crawl_result = await crawler.crawl(project_id=project_id)
            logger.info(f"✓ Crawl complete: {crawl_result.pages_crawled} pages")
            
            await update_job(total_progress=25, message=f"Crawled {crawl_result.pages_crawled} pages")
        except Exception as crawl_error:
            logger.exception(f"❌ Crawler failed: {crawl_error}")
            raise

        # ── Step 2: Master AI — research + generate all slides in one call ───
        try:
            logger.info(f"📍 Step 2: Starting master agent")
            await update_project(status="generating")
            await update_job(current_step="generating", total_progress=25, message="AI is researching and generating your deck...")

            master_agent = MasterDeckAgent()
            logger.info(f"📍 Master agent instantiated, calling generate()")
            
            master_result = await master_agent.generate(
                company_url=_company_url,
                website_content=crawl_result.text_summary or "",
                website_colors=crawl_result.all_colors or [],
                team_info=crawl_result.team_info or [],
                pricing_info=crawl_result.pricing_info or [],
                all_images=crawl_result.all_images or [],
                pages_crawled=crawl_result.pages_crawled,
                user_inputs=_user_input,
            )
            logger.info(f"✓ Master agent generated {len(master_result.slides)} slides")
            
            await update_job(total_progress=75, message=f"Generated {len(master_result.slides)} slides")
        except Exception as master_error:
            logger.exception(f"❌ Master agent failed: {master_error}")
            raise

        # Convert master result to DeckContent for the renderer
        from app.agents.content.content_agent import DeckContent, SlideContent
        deck_content = DeckContent(
            deck_title=master_result.deck_title,
            deck_subtitle=master_result.deck_subtitle,
        )
        for s in master_result.slides:
            deck_content.slides.append(SlideContent(
                slide_number=s.slide_number,
                slide_type=s.slide_type,
                layout=s.layout,
                title=s.title,
                subtitle=s.subtitle,
                body=s.body,
                bullet_points=s.bullet_points,
                data_points=s.data_points,
                cards=s.cards,
                columns=s.columns,
                speaker_notes=s.speaker_notes,
            ))

        # Convert master branding to BrandingData for the renderer
        from app.services.branding.extractor import BrandingData
        branding_data = BrandingData(
            company_name=master_result.branding.company_name,
            industry=master_result.branding.industry,
            tagline=master_result.branding.tagline,
            description=master_result.branding.description,
            primary_color=master_result.branding.primary_color,
            secondary_color=master_result.branding.secondary_color,
            target_audience=master_result.branding.target_audience,
            business_model=master_result.branding.business_model,
        )

        # ── Step 3: Fetch logo ───────────────────────────────────────────────
        await update_job(current_step="rendering", total_progress=75, message="Fetching logo...")
        from app.services.images.image_service import fetch_image_bytes

        logo_bytes = None
        if master_result.branding.logo_url:
            logo_bytes = await fetch_image_bytes(master_result.branding.logo_url)

        slide_backgrounds: dict = {}

        # ── Step 4: Render PPT ───────────────────────────────────────────────
        await update_job(current_step="rendering", total_progress=80, message="Rendering PPTX...")
        renderer = PPTRenderer()
        pptx_bytes = await renderer.render(
            deck_content=deck_content,
            branding=branding_data,
            logo_bytes=logo_bytes,
            slide_backgrounds=slide_backgrounds,
            template_key=_template_key,
        )
        await update_job(total_progress=95, message="Presentation rendered")

        # 7. Upload
        await update_job(current_step="uploading", total_progress=95, message="Saving files...")
        storage = StorageClient()
        file_url = await storage.upload_pptx(
            data=pptx_bytes,
            filename=f"{project_id}/presentation.pptx",
        )

        # Persist results
        async with get_db_context() as db:
            await db.execute(
                update(Project).where(Project.id == project_id).values(
                    status="ready",
                    branding_data=branding_data.model_dump(),
                    research_data=master_result.research_summary,
                    deck_content=master_result.to_deck_content_dict(),
                )
            )
            # Get user_id for presentation
            result = await db.execute(select(Project.user_id).where(Project.id == project_id))
            user_id = result.scalar_one()
            presentation = Presentation(
                project_id=project_id,
                user_id=user_id,
                file_url=file_url,
                status="ready",
                format="pptx",
                slide_count=len(deck_content.slides),
            )
            db.add(presentation)

        await update_job(status="completed", total_progress=100, message="Done!",
                        completed_at=datetime.now(timezone.utc))
        logger.info(f"✅ Pipeline complete | project={project_id}")

    except Exception as exc:
        raw_msg = str(exc)
        # Detect rate-limit errors and surface a clean message
        if (
            "429" in raw_msg
            or "rate limit" in raw_msg.lower()
            or "rate_limit" in raw_msg.lower()
        ):
            error_msg = (
                "RATE_LIMITED: The AI API is temporarily rate-limited. "
                "Please wait 1-2 minutes and try again."
            )
        else:
            error_msg = raw_msg
        logger.exception(f"❌ Pipeline failed | project={project_id} | {error_msg}")
        await update_job(status="failed", error=error_msg, completed_at=datetime.now(timezone.utc))
        await update_project(status="error", error_message=error_msg)


# ─── Endpoints ────────────────────────────────────────────────────────────────

# ─── Wrapper for background task ──────────────────────────────────────────

async def _run_analysis_safe(project_id: str, job_id: str) -> None:
    """Safe wrapper for background analysis."""
    logger.info(f"🚀 Starting background analysis | project={project_id} job={job_id}")
    
    # Immediate database update to confirm thread is running
    try:
        async with get_db_context() as db:
            await db.execute(
                update(Job).where(Job.id == job_id).values(
                    message="THREAD STARTED: Analysis pipeline initializing..."
                )
            )
        logger.info(f"✓ Confirmed thread execution | Updated job {job_id}")
    except Exception as e:
        logger.error(f"❌ Failed to update job immediately: {e}")
    
    try:
        await _run_analysis_inline(project_id, job_id)
        logger.info(f"✅ Background analysis completed | project={project_id}")
    except Exception as e:
        logger.exception(f"❌ Background analysis failed | project={project_id} | error={e}")


def _schedule_background_task(project_id: str, job_id: str):
    """Schedule analysis task in a background thread with a dedicated event loop."""
    logger.info(f"📋 Scheduling background task | project={project_id} job={job_id}")
    
    def run_in_thread():
        """Run analysis in a separate thread with its own event loop."""
        try:
            logger.info(f"🚀 Background thread started | project={project_id} job={job_id}")
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(_run_analysis_safe(project_id, job_id))
            finally:
                loop.close()
            logger.info(f"✅ Background thread completed | project={project_id}")
        except Exception as e:
            logger.exception(f"❌ Background thread failed | project={project_id} | error={e}")
    
    # Start thread as daemon so it doesn't prevent server shutdown
    thread = threading.Thread(target=run_in_thread, daemon=True)
    thread.start()
    logger.info(f"✓ Task thread started with ID: {thread.ident}")


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Create a new project and optionally kick off analysis immediately."""
    try:
        project = Project(
            user_id=current_user.id,
            name=payload.name,
            company_url=str(payload.company_url),
            status="draft",
            branding_data=payload.branding_data,
        )
        db.add(project)
        await db.flush()

        if payload.start_analysis:
            project.status = "analyzing"
            job = Job(project_id=project.id, status="queued", message="Queued for processing")
            db.add(job)
            await db.commit()
            await db.refresh(job)

            # Schedule background task
            _schedule_background_task(project.id, job.id)
        else:
            await db.commit()

        await db.refresh(project)
        return ProjectResponse.model_validate(project)
    except Exception as e:
        logger.exception(f"❌ Failed to create project | error={e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectListResponse:
    """List all projects for the current user with pagination."""
    query = (
        select(Project)
        .where(Project.user_id == current_user.id)
        .where(Project.is_deleted.is_(False))
        .order_by(Project.updated_at.desc())
    )

    if status:
        query = query.where(Project.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size)
    projects = (await db.execute(query)).scalars().all()

    return ProjectListResponse(
        data=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=page,
        page_size=page_size,
        has_next_page=(page * page_size) < total,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Get a single project by ID."""
    project = await _get_project_or_404(project_id, current_user.id, db)
    return ProjectResponse.model_validate(project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Update project name or other editable fields."""
    project = await _get_project_or_404(project_id, current_user.id, db)

    if payload.name is not None:
        project.name = payload.name
    if payload.template_key is not None:
        project.template_key = payload.template_key

    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.post("/{project_id}/assets", response_model=ProjectResponse)
async def upload_assets(
    project_id: str,
    logo: Optional[UploadFile] = File(None),
    gallery: list[UploadFile] = File(default=[]),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    """Upload a company logo and/or up to 5 gallery photos for a project.

    Assets are overlaid on the deck at render time — they do not affect AI
    generation, so this can be called any time (e.g. right after project create).
    """
    from app.services.storage import save_upload, StorageError

    project = await _get_project_or_404(project_id, current_user.id, db)
    assets: dict = dict(project.assets or {})

    try:
        if logo is not None and logo.filename:
            assets["logo_url"] = await save_upload(project_id, logo, "logo")

        gallery_files = [g for g in (gallery or []) if g and g.filename][:5]
        if gallery_files:
            images = []
            for idx, gf in enumerate(gallery_files):
                url = await save_upload(project_id, gf, f"g{idx+1}")
                images.append({"slot": f"g{idx+1}", "url": url})
            assets["gallery_images"] = images
    except StorageError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    project.assets = assets
    await db.commit()
    await db.refresh(project)
    logger.info(f"📎 Assets saved | project={project_id} | logo={'logo_url' in assets} | photos={len(assets.get('gallery_images', []))}")
    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a project."""
    from datetime import datetime, timezone

    project = await _get_project_or_404(project_id, current_user.id, db)
    project.is_deleted = True
    project.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{project_id}/analyze", response_model=JobProgressResponse)
async def trigger_analysis(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobProgressResponse:
    """Trigger the full AI analysis + deck generation pipeline."""
    project = await _get_project_or_404(project_id, current_user.id, db)

    if project.status in ("analyzing", "researching", "generating"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis already in progress for this project",
        )

    project.status = "analyzing"
    job = Job(project_id=project.id, status="queued", message="Queued for processing")
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Schedule background task
    _schedule_background_task(project.id, job.id)
    
    await db.commit()
    await db.refresh(job)

    return JobProgressResponse(
        job_id=job.id,
        project_id=project.id,
        status="queued",
        current_step="crawling",
        step_progress=0,
        total_progress=0,
        message="Analysis queued",
    )


@router.get("/{project_id}/status", response_model=JobProgressResponse)
async def get_project_status(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobProgressResponse:
    """Get the latest job progress for this project."""
    project = await _get_project_or_404(project_id, current_user.id, db)

    result = await db.execute(
        select(Job)
        .where(Job.project_id == project.id)
        .order_by(Job.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()

    if not job:
        return JobProgressResponse(
            job_id="",
            project_id=project.id,
            status="queued",
            current_step="crawling",
            step_progress=0,
            total_progress=0,
            message="No job found",
        )

    return JobProgressResponse(
        job_id=job.id,
        project_id=project.id,
        status=job.status,
        current_step=job.current_step or "crawling",
        step_progress=job.step_progress,
        total_progress=job.total_progress,
        message=job.message or "",
        error=job.error,
    )


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_project_or_404(
    project_id: str, user_id: str, db: AsyncSession
) -> Project:
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.user_id == user_id,
            Project.is_deleted.is_(False),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
