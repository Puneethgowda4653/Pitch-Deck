import asyncio
from sqlalchemy import select
from app.db.session import get_db_context
from app.models.models import Job
from app.api.v1.endpoints import projects as proj_module

project_id = 'b32a787e-e7ba-467f-a225-1a0031d3517b'

async def create_job_and_run():
    async with get_db_context() as db:
        job = Job(project_id=project_id, status='queued', message='Queued for inline run')
        db.add(job)
        await db.flush()
        await db.commit()
        await db.refresh(job)
        print('Created job', job.id)
    await proj_module._run_analysis_inline(project_id=project_id, job_id=job.id)

if __name__ == '__main__':
    asyncio.run(create_job_and_run())
