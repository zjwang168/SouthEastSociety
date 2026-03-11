import json
from typing import Any, Optional
from sqlalchemy.orm import Session

from ..models import AuditLog


def write_audit_log(
    db: Session,
    actor_user_id: int,
    action: str,
    entity_type: str,
    entity_id: str,
    before: Optional[Any] = None,
    after: Optional[Any] = None,
) -> None:
    row = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_json=json.dumps(before, ensure_ascii=False) if before is not None else None,
        after_json=json.dumps(after, ensure_ascii=False) if after is not None else None,
    )
    db.add(row)