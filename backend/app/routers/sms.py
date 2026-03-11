from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import SmsQueue, SmsLog, SmsStatus, User
from ..routers.auth import get_current_user_from_header
from ..services.sms import send_sms
from ..services.audit import write_audit_log

router = APIRouter()


class SmsQueueCreate(BaseModel):
    customer_id: int
    phone_number: str
    message: str
    scheduled_for: Optional[date] = None
    order_id: Optional[int] = None


@router.post("/queue")
def create_queue_item(
    payload: SmsQueueCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    user: User = Depends(get_current_user_from_header),
):
    """
    Create a pending SMS queue item (Admin-only).
    Used by Outstanding page button.
    """
    scheduled_for = payload.scheduled_for or date.today()

    row = SmsQueue(
        customer_id=payload.customer_id,
        order_id=payload.order_id,
        phone_number=payload.phone_number,
        message=payload.message,
        scheduled_for=scheduled_for,
        status="pending",
        sent_at=None,
        error=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="QUEUE_SMS",
        entity_type="sms_queue",
        entity_id=str(row.id),
        after={
            "customer_id": row.customer_id,
            "order_id": row.order_id,
            "phone_number": row.phone_number,
            "message": row.message,
            "scheduled_for": str(row.scheduled_for),
            "status": row.status,
        },
    )
    db.commit()

    return {
        "id": row.id,
        "customer_id": row.customer_id,
        "order_id": row.order_id,
        "phone_number": row.phone_number,
        "message": row.message,
        "scheduled_for": str(row.scheduled_for),
        "status": row.status,
    }


@router.get("/queue")
def list_today_queue(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    """
    List all pending SMS scheduled for today.
    Admin-only.
    """
    today = date.today()
    rows = (
        db.query(SmsQueue)
        .filter(SmsQueue.scheduled_for == today, SmsQueue.status == "pending")
        .order_by(SmsQueue.id.asc())
        .all()
    )
    return [
        {
            "id": r.id,
            "customer_id": r.customer_id,
            "order_id": r.order_id,
            "phone_number": r.phone_number,
            "message": r.message,
            "scheduled_for": str(r.scheduled_for),
            "status": r.status,
        }
        for r in rows
    ]


@router.post("/send-due")
def send_due_today(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
    user: User = Depends(get_current_user_from_header),
):
    """
    Send all pending SMS scheduled for today.
    Admin-only.
    """
    today = date.today()
    rows = (
        db.query(SmsQueue)
        .filter(SmsQueue.scheduled_for == today, SmsQueue.status == "pending")
        .order_by(SmsQueue.id.asc())
        .all()
    )

    results = []
    for r in rows:
        try:
            ok = send_sms(r.phone_number, r.message)

            log = SmsLog(
                customer_id=r.customer_id,
                order_id=r.order_id,
                phone_number=r.phone_number,
                content=r.message,
                status=SmsStatus.success if ok else SmsStatus.failed,
                sent_at=datetime.utcnow(),
            )
            db.add(log)

            r.status = "sent" if ok else "failed"
            r.sent_at = datetime.utcnow()
            r.error = None if ok else "send_sms returned false"
            results.append({"queue_id": r.id, "status": r.status})
        except Exception as e:
            r.status = "failed"
            r.error = str(e)
            results.append({"queue_id": r.id, "status": "failed", "error": str(e)})

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="SEND_SMS_DUE",
        entity_type="sms_queue_batch",
        entity_id="today",
        after={
            "count": len(results),
            "results": results,
        },
    )

    db.commit()
    return {"count": len(results), "results": results}