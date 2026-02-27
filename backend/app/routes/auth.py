from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
import os

from app.models import UserRegister, UserLogin, TokenResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.database import get_db

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister):
    db = get_db()

    existing = await db.users.find_one(
        {"$or": [{"email": user_data.email}, {"username": user_data.username}]}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already registered")

    admin_email = os.getenv("ADMIN_EMAIL", "")
    role = "admin" if user_data.email == admin_email else "user"

    user_doc = {
        "email": user_data.email,
        "username": user_data.username,
        "password_hash": hash_password(user_data.password),
        "role": role,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(
        {"sub": user_id, "email": user_data.email, "username": user_data.username, "role": role}
    )
    return TokenResponse(access_token=token, user_id=user_id, username=user_data.username, role=role)


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    token = create_access_token(
        {"sub": user_id, "email": user["email"], "username": user["username"], "role": user["role"]}
    )
    return TokenResponse(
        access_token=token, user_id=user_id, username=user["username"], role=user["role"]
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["sub"],
        "email": current_user["email"],
        "username": current_user["username"],
        "role": current_user["role"],
    }
