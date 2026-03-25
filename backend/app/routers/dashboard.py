from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from .. import models
from ..routers.auth import get_current_user_from_header

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


@router.get("/stats")
def get_dashboard_stats(
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_from_header),
):
    orders_q = db.query(models.Order)
    customers_q = db.query(models.Customer)
    redemptions_q = db.query(models.PointsRedemption)

    if start:
        start_dt = _parse_dt(start)
        orders_q = orders_q.filter(models.Order.created_at >= start_dt)
        customers_q = customers_q.filter(models.Customer.created_at >= start_dt)
        redemptions_q = redemptions_q.filter(models.PointsRedemption.created_at >= start_dt)

    if end:
        end_dt = _parse_dt(end)
        orders_q = orders_q.filter(models.Order.created_at <= end_dt)
        customers_q = customers_q.filter(models.Customer.created_at <= end_dt)
        redemptions_q = redemptions_q.filter(models.PointsRedemption.created_at <= end_dt)

    total_revenue = (
        orders_q.with_entities(func.coalesce(func.sum(models.Order.paid_amount), 0)).scalar() or 0
    )

    total_credits_issued = (
        orders_q.with_entities(func.coalesce(func.sum(models.Order.points_earned), 0)).scalar() or 0
    )

    total_credits_redeemed = (
        redemptions_q.with_entities(func.coalesce(func.sum(models.PointsRedemption.points_used), 0)).scalar() or 0
    )

    total_customers = (
        customers_q.with_entities(func.count(models.Customer.id)).scalar() or 0
    )

    total_amount = (
        orders_q.with_entities(func.coalesce(func.sum(models.Order.amount), 0)).scalar() or 0
    )

    total_outstanding = float(total_amount) - float(total_revenue)

    return {
        "total_revenue": float(total_revenue),
        "total_credits_issued": int(total_credits_issued),
        "total_credits_redeemed": int(total_credits_redeemed),
        "total_customers": int(total_customers),
        "total_outstanding": float(total_outstanding),
    }