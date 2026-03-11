from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from ..db import get_db
from ..models import User, UserRole
from ..schemas import TokenResponse, UserOut
from ..auth import (
    verify_password,
    create_access_token,
    hash_password,
    get_current_user_from_header,
)
from ..services.audit import write_audit_log

router = APIRouter(prefix="/auth", tags=["auth"])


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = create_access_token(subject=user.username)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="LOGIN",
        entity_type="user",
        entity_id=str(user.id),
        after={
            "username": user.username,
            "role": user.role.value,
        },
    )
    db.commit()

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user_from_header)):
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role.value,
        is_active=user.is_active,
        can_edit_order_note=user.can_edit_order_note,
        can_edit_order_amounts=user.can_edit_order_amounts,
        created_at=user.created_at,
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    if not verify_password(payload.old_password, user.password_hash):
        raise HTTPException(
            status_code=400,
            detail="Old password incorrect",
        )

    user.password_hash = hash_password(payload.new_password)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="CHANGE_PASSWORD",
        entity_type="user",
        entity_id=str(user.id),
        after={
            "username": user.username,
        },
    )

    db.commit()

    return {"status": "password updated"}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    # admin only
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    target = db.query(User).filter(User.username == payload.username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # 可选：不允许 admin 重置自己；这里先允许
    target.password_hash = hash_password(payload.new_password)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="RESET_PASSWORD",
        entity_type="user",
        entity_id=str(target.id),
        after={
            "target_username": target.username,
            "target_role": target.role.value,
        },
    )

    db.commit()

    return {
        "status": "password reset",
        "username": target.username,
    }


def bootstrap_admin(db: Session):
    """
    Create the first admin if no users exist.
    Default credentials (MVP):
      username: admin
      password: admin1234
    IMPORTANT: Change immediately after first login.
    """
    if db.query(User).count() > 0:
        return

    admin = User(
        username="admin",
        password_hash=hash_password("admin1234"),
        role=UserRole.admin,
        is_active=True,
        can_edit_order_note=True,
        can_edit_order_amounts=True,
    )
    db.add(admin)
    db.commit()