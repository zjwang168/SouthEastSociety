from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, UserRole
from ..routers.auth import get_current_user_from_header
from ..auth import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateStaffRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=6)


class ResetStaffPasswordRequest(BaseModel):
    username: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


def _require_admin(current_user: User):
    role_value = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role_value != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.post("/create-staff")
def create_staff(
    payload: CreateStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    _require_admin(current_user)

    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        role=UserRole.staff,
        is_active=True,
        can_edit_order_note=False,
        can_edit_order_amounts=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "is_active": user.is_active,
        "message": f"Staff user '{user.username}' created successfully.",
    }


@router.post("/reset-staff-password")
def reset_staff_password(
    payload: ResetStaffPasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_from_header),
):
    _require_admin(current_user)

    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_value != "staff":
        raise HTTPException(status_code=400, detail="Only staff passwords can be reset here")

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {
        "username": user.username,
        "message": f"Password reset successfully for {user.username}.",
    }