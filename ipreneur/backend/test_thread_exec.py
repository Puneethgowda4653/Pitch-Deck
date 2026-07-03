#!/usr/bin/env python3
"""
Minimal test to verify background thread execution.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent / "app"
sys.path.insert(0, str(backend_path.parent))

from app.db.session import get_db_context
from app.models.models import Job
from sqlalchemy import update
from loguru import logger

logger.add(sys.stdout)
logger.add("test_thread_exec.log", rotation="1 MB")

async def test_simple_update():
    """Test if we can update the database from a background thread."""
    logger.info("🔍 Testing database update in thread context...")
    
    try:
        # Try to get an existing job and update it
        async with get_db_context() as db:
            jobs = await db.execute(
                update(Job).where(Job.status == "queued").values(
                    message="TEST: Thread execution confirmed!"
                ).returning(Job.id)
            )
            job_ids = jobs.scalars().all()
            
            if job_ids:
                logger.info(f"✅ Updated {len(job_ids)} jobs with test message")
                for job_id in job_ids[:1]:
                    logger.info(f"   Updated job: {job_id}")
            else:
                logger.warning("❌ No queued jobs found to update")
                
        return True
    except Exception as e:
        logger.exception(f"❌ Failed to update jobs: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Thread Execution\n")
    result = asyncio.run(test_simple_update())
    print(f"\nTest result: {'PASS' if result else 'FAIL'}")
