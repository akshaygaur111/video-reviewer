from dotenv import load_dotenv
load_dotenv()  # must be first — loads backend/.env before anything reads os.getenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime
from app.database import connect_db, disconnect_db, get_db
from app.routes import auth as auth_routes, reviews as review_routes, admin as admin_routes
from app.auth import hash_password
import os


async def _seed_admin():
    """Create or reset the admin user on boot."""
    db = get_db()
    email    = os.getenv("ADMIN_EMAIL", "admin@videoiq.app")
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "VideoIQ@2025!")

    if os.getenv("FORCE_RESET_ADMIN") == "true":
        # Update existing admin password (use when locked out)
        await db.users.update_one(
            {"role": "admin"},
            {"$set": {"password_hash": hash_password(password), "email": email}},
        )
        print(f"🔑 Admin password reset  →  {email}  /  {password}")
        return

    if await db.users.find_one({"role": "admin"}):
        return  # admin already exists

    await db.users.insert_one({
        "email":         email,
        "username":      username,
        "password_hash": hash_password(password),
        "role":          "admin",
        "created_at":    __import__("datetime").datetime.utcnow(),
    })
    print(f"✅ Admin seeded  →  {email}  /  {password}")


async def _recover_stuck_jobs():
    """
    On startup, mark any jobs/videos that were left in 'processing' or 'pending'
    from a previous server crash/sleep as 'failed', so users know to resubmit.
    """
    db = get_db()
    result = await db.jobs.update_many(
        {"status": {"$in": ["processing", "pending"]}},
        {"$set": {
            "status": "failed",
            "completed_at": datetime.utcnow(),
        }},
    )
    if result.modified_count:
        # Also mark individual videos inside those jobs
        await db.jobs.update_many(
            {"videos.status": {"$in": ["processing", "pending"]}},
            {"$set": {
                "videos.$[v].status": "failed",
                "videos.$[v].error": "Server restarted — please resubmit this job",
                "videos.$[v].completed_at": datetime.utcnow(),
            }},
            array_filters=[{"v.status": {"$in": ["processing", "pending"]}}],
        )
        print(f"⚠️  Recovered {result.modified_count} stuck job(s) → marked failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await _seed_admin()
    await _recover_stuck_jobs()
    yield
    await disconnect_db()


app = FastAPI(
    title="VideoIQ API",
    version="2.0.0",
    description="AI-Powered Video Review Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://video-reviewer-alpha.vercel.app",
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",
    ],
    allow_credentials=False,   # we use Bearer tokens, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(review_routes.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(admin_routes.router, prefix="/api/admin", tags=["admin"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0"}
