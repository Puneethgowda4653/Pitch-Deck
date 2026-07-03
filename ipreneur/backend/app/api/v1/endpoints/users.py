from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from app.api.deps.auth import get_current_user
from app.models.models import User

router = APIRouter()

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    name: str
    role: str
    is_active: bool
    is_verified: bool

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
