from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    role: str


# ── Reviews ───────────────────────────────────────────────────────────────────

class ReviewJobCreate(BaseModel):
    drive_links: List[str] = Field(..., min_length=1, max_length=50)
    job_name: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=50)   # e.g. "Grade 3", "Grade 5"
    include_suggestions: bool = True
    reference_drive_link: Optional[str] = Field(None, max_length=500)  # e.g. IXL video link


class PassResult(BaseModel):
    pass_number: int
    rigor_level: str   # standard | enhanced | maximum
    issues_found: int
    issues: List[Dict[str, Any]] = []


class VideoResult(BaseModel):
    drive_link: str
    index: int
    status: str        # pending | processing | completed | failed
    transcript: Optional[str] = None
    passes: List[PassResult] = []
    combined_issues: List[Dict[str, Any]] = []
    total_issues: int = 0
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ReviewJob(BaseModel):
    id: Optional[str] = None
    user_id: str
    drive_links: List[str]
    status: str        # pending | processing | completed | failed
    videos: List[VideoResult] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    total_videos: int = 0
    completed_videos: int = 0
    total_issues: int = 0
    grade: Optional[str] = None
    include_suggestions: bool = True
    reference_drive_link: Optional[str] = None
    reference_analysis: Optional[Dict[str, Any]] = None  # Phase 0 result
