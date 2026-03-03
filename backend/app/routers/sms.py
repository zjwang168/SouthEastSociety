from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..models import SmsQueue, SmsLog, SmsStatus
from ..services.sms import send_sms

router = APIRouter()


@router.get("/queue")
def list_today_queue(db: Session = Depends(get_db), admin=Depends(require_admin)):
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
def send_due_today(db: Session = Depends(get_db), admin=Depends(require_admin)):
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

    db.commit()
    return {"count": len(results), "results": results}