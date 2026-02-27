from fastapi import APIRouter, Depends
from bson import ObjectId

from app.auth import get_admin_user
from app.database import get_db

router = APIRouter()


def _serialize_job(job: dict) -> dict:
    job["id"] = str(job.pop("_id"))
    if "user_id" in job:
        job["user_id"] = str(job["user_id"])
    return job


@router.get("/jobs")
async def get_all_jobs(admin_user: dict = Depends(get_admin_user)):
    db = get_db()
    cursor = db.jobs.find({}, sort=[("created_at", -1)])
    return [_serialize_job(j) async for j in cursor]


@router.get("/users")
async def get_all_users(admin_user: dict = Depends(get_admin_user)):
    db = get_db()
    cursor = db.users.find({}, {"password_hash": 0})
    users = []
    async for u in cursor:
        u["id"] = str(u.pop("_id"))
        users.append(u)
    return users


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
