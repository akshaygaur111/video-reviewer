from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime
import asyncio
import re
import os
from bson import ObjectId

from app.models import ReviewJobCreate
from app.auth import get_current_user
from app.database import get_db
from app.services.video_review import process_review_job
from app.services.drive import get_drive_filename

router = APIRouter()


def _serialize(job: dict) -> dict:
    job["id"] = str(job.pop("_id"))
    if "user_id" in job:
        job["user_id"] = str(job["user_id"])
    return job


@router.post("/", status_code=201)
async def create_review_job(
    job_data: ReviewJobCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    # Fetch Drive filenames in parallel (best-effort, 5 s timeout each)
    loop = asyncio.get_event_loop()
    filenames = await asyncio.gather(*[
        loop.run_in_executor(None, get_drive_filename, link)
        for link in job_data.drive_links
    ])

    videos = [
        {
            "drive_link": link,
            "filename": filenames[i],
            "index": i,
            "status": "pending",
            "transcript": None,
            "passes": [],
            "combined_issues": [],
            "total_issues": 0,
            "error": None,
            "started_at": None,
            "completed_at": None,
        }
        for i, link in enumerate(job_data.drive_links)
    ]

    # Auto-derive job name from filenames when not supplied manually
    if job_data.job_name:
        resolved_name = job_data.job_name
    else:
        valid = [n for n in filenames if n]
        if valid:
            resolved_name = valid[0] if len(valid) == 1 else f"{valid[0]} +{len(job_data.drive_links)-1} more"
        else:
            resolved_name = None

    job_doc = {
        "user_id": ObjectId(current_user["sub"]),
        "job_name": resolved_name,
        "drive_links": job_data.drive_links,
        "status": "pending",
        "videos": videos,
        "created_at": datetime.utcnow(),
        "completed_at": None,
        "total_videos": len(job_data.drive_links),
        "completed_videos": 0,
        "total_issues": 0,
        "grade": job_data.grade,
        "include_suggestions": job_data.include_suggestions,
        "reference_drive_link": job_data.reference_drive_link,
        "reference_analysis": None,
    }

    result = await db.jobs.insert_one(job_doc)
    job_id = str(result.inserted_id)

    background_tasks.add_task(
        process_review_job,
        job_id,
        job_data.drive_links,
        api_key,
        grade=job_data.grade,
        include_suggestions=job_data.include_suggestions,
        reference_drive_link=job_data.reference_drive_link,
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "total_videos": len(job_data.drive_links),
        "message": f"Review job queued for {len(job_data.drive_links)} video(s)",
    }


@router.get("/")
async def list_user_jobs(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.jobs.find(
        {"user_id": ObjectId(current_user["sub"])},
        sort=[("created_at", -1)],
    )
    return [_serialize(j) async for j in cursor]


@router.get("/{job_id}")
async def get_job(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        query = {"_id": ObjectId(job_id)}
        if current_user["role"] != "admin":
            query["user_id"] = ObjectId(current_user["sub"])
        job = await db.jobs.find_one(query)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return _serialize(job)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
