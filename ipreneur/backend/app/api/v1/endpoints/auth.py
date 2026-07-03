from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
import bcrypt
from pydantic import BaseModel, EmailStr, ConfigDict
from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.models import User

router = APIRouter()


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None


def _create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    return jwt.encode({"sub": user_id, "exp": expire}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=payload.email, name=payload.name, hashed_password=_hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"success": True, "data": {"user": UserOut.model_validate(user), "access_token": _create_access_token(user.id)}}


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if not user or not _verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return {"success": True, "data": {"user": UserOut.model_validate(user), "access_token": _create_access_token(user.id)}}


@router.post("/logout")
async def logout():
    return {"success": True}


@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
):
    """Get current user from token — uses auth dependency."""
    from app.api.deps.auth import get_current_user
    # This is a placeholder — the actual /users/me endpoint handles this
    return {"message": "Use /api/v1/users/me instead"}
