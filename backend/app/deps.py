from fastapi import Depends, HTTPException, status

from .auth import get_current_user_from_header
from .models import User


def require_user(user: User = Depends(get_current_user_from_header)) -> User:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")
    return user


def require_admin(user: User = Depends(require_user)) -> User:
    if user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return user