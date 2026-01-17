from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from ..db import get_db
from ..models import User, UserRole
from ..schemas import LoginRequest, TokenResponse, UserOut
from ..auth import verify_password, create_access_token, hash_password, get_current_user_from_header

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    token = create_access_token(subject=user.username)
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
