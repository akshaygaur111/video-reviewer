from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime
import os
from typing import Optional

from google import genai

from app.auth import get_admin_user, hash_password
from app.database import get_db
from app.models import UserRegister
from app.services.video_review import _combine_issues

router = APIRouter()


def _serialize_job(job: dict) -> dict:
    job["id"] = str(job.pop("_id"))
    if "user_id" in job:
        job["user_id"] = str(job["user_id"])
    return job


@router.get("/jobs")
async def get_all_jobs(
    user_id: Optional[str] = Query(None, description="Filter by user_id"),
    admin_user: dict = Depends(get_admin_user),
):
    db = get_db()
    query = {}
    if user_id:
        try:
            query["user_id"] = ObjectId(user_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid user_id")
    cursor = db.jobs.find(query, sort=[("created_at", -1)])
    return [_serialize_job(j) async for j in cursor]


@router.post("/jobs/{job_id}/recover")
async def recover_job(job_id: str, admin_user: dict = Depends(get_admin_user)):
    """
    Re-run _combine_issues on whatever passes already completed for a failed job
    and mark the job (and its videos) as completed so the feedback is visible.
    """
    db = get_db()
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job_id")
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    total_combined = 0
    for i, video in enumerate(job.get("videos", [])):
        passes = video.get("passes", [])
        if not passes:
            continue
        combined = _combine_issues(passes)
        total_combined += len(combined)
        await db.jobs.update_one(
            {"_id": ObjectId(job_id)},
            {
                "$set": {
                    f"videos.{i}.combined_issues": combined,
                    f"videos.{i}.total_issues": len(combined),
                    f"videos.{i}.status": "completed",
                    f"videos.{i}.error": None,
                    f"videos.{i}.completed_at": video.get("completed_at") or datetime.utcnow(),
                }
            },
        )

    await db.jobs.update_one(
        {"_id": ObjectId(job_id)},
        {
            "$set": {
                "status": "completed",
                "total_issues": total_combined,
                "completed_at": job.get("completed_at") or datetime.utcnow(),
            }
        },
    )

    job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    return _serialize_job(job)


@router.get("/users")
async def get_all_users(admin_user: dict = Depends(get_admin_user)):
    db = get_db()
    cursor = db.users.find({}, {"password_hash": 0})
    users = []
    async for u in cursor:
        u["id"] = str(u.pop("_id"))
        users.append(u)
    return users


@router.post("/users", status_code=201)
async def create_user(user_data: UserRegister, admin_user: dict = Depends(get_admin_user)):
    db = get_db()
    existing = await db.users.find_one(
        {"$or": [{"email": user_data.email}, {"username": user_data.username}]}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already taken")

    result = await db.users.insert_one({
        "email":         user_data.email,
        "username":      user_data.username,
        "password_hash": hash_password(user_data.password),
        "role":          "user",
        "created_at":    datetime.utcnow(),
    })
    return {"id": str(result.inserted_id), "username": user_data.username, "email": user_data.email, "role": "user"}


@router.get("/gemini-models")
async def list_gemini_models(admin_user: dict = Depends(get_admin_user)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    client = genai.Client(api_key=api_key)
    models = [
        {"name": m.name, "display_name": m.display_name}
        for m in client.models.list()
    ]
    return {"models": models, "count": len(models)}


@router.get("/stats")
async def get_stats(admin_user: dict = Depends(get_admin_user)):
    db = get_db()
    total_users = await db.users.count_documents({})
    total_jobs = await db.jobs.count_documents({})
    completed_jobs = await db.jobs.count_documents({"status": "completed"})
    processing_jobs = await db.jobs.count_documents({"status": "processing"})
    pending_jobs = await db.jobs.count_documents({"status": "pending"})

    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_issues"}}}]
    result = await db.jobs.aggregate(pipeline).to_list(1)
    total_issues = result[0]["total"] if result else 0

    return {
        "total_users": total_users,
        "total_jobs": total_jobs,
        "completed_jobs": completed_jobs,
        "processing_jobs": processing_jobs,
        "pending_jobs": pending_jobs,
        "total_issues_found": total_issues,
    }
