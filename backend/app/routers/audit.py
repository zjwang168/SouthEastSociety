from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit_logs(
    limit: int = 200,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    limit = max(1, min(limit, 500))

    rows = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "actor_user_id": r.actor_user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "before_json": r.before_json,
            "after_json": r.after_json,
            "created_at": r.created_at,
        }
        for r in rows
    ]