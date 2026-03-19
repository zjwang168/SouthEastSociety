import csv
import io
from datetime import datetime, date, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from ..db import get_db
from ..routers.auth import get_current_user_from_header
from ..models import Order, Customer, CustomerPhone, User, SmsQueue, PointsRedemption
from ..schemas import (
    OrderCreate,
    OrderOut,
    OrderNoteUpdate,
    OrderAmountsUpdate,
    OutstandingCustomerRow,
    OrdersSummaryOut,
)
from ..services.points import calc_points_earned
from ..services.audit import write_audit_log

router = APIRouter(prefix="/orders", tags=["orders"])

ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")


def calc_tier(donation_amount: float) -> tuple[float | None, bool]:
    """
    Return (tier_rate, is_manual_tier) based on current order donation only.
    """
    if donation_amount < 400:
        return 0.02, False
    elif donation_amount <= 1500:
        return 0.025, False
    elif donation_amount <= 3000:
        return 0.03, False
    elif donation_amount <= 5000:
        return 0.04, False
    else:
        return None, True


def _get_primary_phone(db: Session, customer_id: int) -> str | None:
    row = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.customer_id == customer_id, CustomerPhone.is_primary == True)  # noqa: E712
        .first()
    )
    return row.phone_number if row else None


def _build_outstanding_sms_message(nickname: str | None, outstanding: float) -> str:
    name = nickname.strip() if nickname else "there"
    return f"Hi {name}, this is a friendly reminder that your balance is ${outstanding:.2f}. Thank you!"


def _build_points_sms_message(
    nickname: str | None,
    points_earned: int,
    is_manual_tier: bool,
) -> str:
    name = nickname.strip() if nickname else "there"

    if is_manual_tier:
        return (
            f"Hi {name}, thank you for your order! "
            f"You earned {points_earned} credits. "
            f"This order used a manual credit entry."
        )

    return (
        f"Hi {name}, thank you for your order! "
        f"You earned {points_earned} credits."
    )


def _mask_phone(phone: str | None) -> str:
    if not phone:
        return ""
    if len(phone) >= 7:
        return f"{phone[:3]}****{phone[-4:]}"
    return "****"


def _to_eastern_string(dt: datetime) -> str:
    dt_utc = dt.replace(tzinfo=UTC)
    return dt_utc.astimezone(ET).strftime("%Y-%m-%d %I:%M %p")


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def _find_customer_by_phone(db: Session, phone_number: str) -> Customer | None:
    phone_row = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.phone_number == phone_number)
        .first()
    )
    if not phone_row:
        return None

    return (
        db.query(Customer)
        .filter(Customer.id == phone_row.customer_id)
        .first()
    )


def _create_customer_with_phone(
    db: Session,
    phone_number: str,
    nickname: str | None,
) -> Customer:
    c = Customer(nickname=nickname.strip() if nickname and nickname.strip() else None)
    db.add(c)
    db.commit()
    db.refresh(c)

    p = CustomerPhone(
        customer_id=c.id,
        phone_number=phone_number,
        is_primary=True,
        sms_enabled=True,
    )
    db.add(p)
    db.commit()

    return c


def _serialize_order(db: Session, o: Order) -> OrderOut:
    return OrderOut(
        id=o.id,
        customer_id=o.customer_id,
        phone_number_used=o.phone_number_used,
        amount=float(o.amount),
        paid_amount=float(o.paid_amount),
        payment_method=o.payment_method,
        points_earned=o.points_earned,
        points_used=o.points_used,
        tier_rate=float(o.tier_rate) if o.tier_rate is not None else None,
        cash_value=float(o.cash_value) if o.cash_value is not None else None,
        is_manual_tier=bool(o.is_manual_tier),
        operator_user_id=o.operator_user_id,
        created_at=o.created_at,
        note=o.note,
    )


@router.post("", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    phone_number = payload.phone_number_used.strip()
    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number_used is required")

    payment_method = (payload.payment_method or "cash").strip().lower()
    if payment_method not in {"cash", "venmo", "zelle"}:
        raise HTTPException(status_code=400, detail="payment_method must be cash, venmo, or zelle")

    c = _find_customer_by_phone(db, phone_number)

    created_new_customer = False
    if not c:
        c = _create_customer_with_phone(
            db=db,
            phone_number=phone_number,
            nickname=payload.nickname,
        )
        created_new_customer = True

    paid_amount = payload.paid_amount if payload.paid_amount is not None else payload.amount

    if paid_amount > payload.amount:
        raise HTTPException(status_code=400, detail="paid_amount cannot exceed amount (MVP rule)")

    tier_rate, auto_manual_tier = calc_tier(float(payload.amount))

    if auto_manual_tier:
        if payload.manual_credits is None:
            raise HTTPException(
                status_code=400,
                detail="manual_credits is required for donation amounts above 5000"
            )
        points = payload.manual_credits
        is_manual_tier = True
    else:
        points = calc_points_earned(float(payload.amount))
        is_manual_tier = False

    cash_value = float(points)

    o = Order(
        customer_id=c.id,
        phone_number_used=phone_number,
        amount=payload.amount,
        paid_amount=paid_amount,
        payment_method=payment_method,
        points_earned=points,
        points_used=0,
        tier_rate=tier_rate,
        cash_value=cash_value,
        is_manual_tier=is_manual_tier,
        operator_user_id=user.id,
        note=payload.note,
    )
    db.add(o)
    db.commit()
    db.refresh(o)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="CREATE_ORDER",
        entity_type="order",
        entity_id=str(o.id),
        after={
            "customer_id": o.customer_id,
            "phone_number_used": o.phone_number_used,
            "amount": float(o.amount),
            "paid_amount": float(o.paid_amount),
            "payment_method": o.payment_method,
            "points_earned": o.points_earned,
            "tier_rate": float(o.tier_rate) if o.tier_rate is not None else None,
            "cash_value": float(o.cash_value) if o.cash_value is not None else None,
            "is_manual_tier": o.is_manual_tier,
            "note": o.note,
            "created_new_customer": created_new_customer,
            "customer_nickname": c.nickname,
        },
    )
    db.commit()

    outstanding = float(o.amount) - float(o.paid_amount)
    to_phone = _get_primary_phone(db, o.customer_id) or o.phone_number_used

    if outstanding > 0:
        msg = _build_outstanding_sms_message(c.nickname, outstanding)

        q = SmsQueue(
            customer_id=o.customer_id,
            order_id=o.id,
            phone_number=to_phone,
            message=msg,
            status="pending",
            scheduled_for=date.today(),
        )
        db.add(q)

    points_msg = _build_points_sms_message(
        c.nickname,
        o.points_earned,
        bool(o.is_manual_tier),
    )
    q2 = SmsQueue(
        customer_id=o.customer_id,
        order_id=o.id,
        phone_number=to_phone,
        message=points_msg,
        status="pending",
        scheduled_for=date.today() + timedelta(days=1),
    )
    db.add(q2)
    db.commit()

    return _serialize_order(db, o)


@router.patch("/{order_id}/note", response_model=OrderOut)
def update_order_note(
    order_id: int,
    payload: OrderNoteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    if not user.can_edit_order_note and user.role.value != "admin":
        raise HTTPException(status_code=403, detail="No permission to edit order note")

    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    before = {"note": o.note}

    o.note = payload.note
    db.commit()
    db.refresh(o)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="UPDATE_ORDER_NOTE",
        entity_type="order",
        entity_id=str(o.id),
        before=before,
        after={"note": o.note},
    )
    db.commit()

    return _serialize_order(db, o)


@router.patch("/{order_id}/amounts", response_model=OrderOut)
def update_order_amounts_admin(
    order_id: int,
    payload: OrderAmountsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    if user.role.value != "admin" and not user.can_edit_order_amounts:
        raise HTTPException(status_code=403, detail="Admin permission required")

    if payload.paid_amount > payload.amount:
        raise HTTPException(status_code=400, detail="paid_amount cannot exceed amount (MVP rule)")

    o = db.query(Order).filter(Order.id == order_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Order not found")

    before = {
        "amount": float(o.amount),
        "paid_amount": float(o.paid_amount),
        "points_earned": o.points_earned,
        "tier_rate": float(o.tier_rate) if o.tier_rate is not None else None,
        "cash_value": float(o.cash_value) if o.cash_value is not None else None,
        "is_manual_tier": o.is_manual_tier,
    }

    o.amount = payload.amount
    o.paid_amount = payload.paid_amount

    tier_rate, is_manual_tier = calc_tier(float(payload.amount))
    o.tier_rate = tier_rate
    o.is_manual_tier = is_manual_tier

    if is_manual_tier:
        o.points_earned = 0
        o.cash_value = 0
    else:
        o.points_earned = calc_points_earned(float(payload.amount))
        o.cash_value = float(o.points_earned)

    db.commit()
    db.refresh(o)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="UPDATE_ORDER_AMOUNTS",
        entity_type="order",
        entity_id=str(o.id),
        before=before,
        after={
            "amount": float(o.amount),
            "paid_amount": float(o.paid_amount),
            "points_earned": o.points_earned,
            "tier_rate": float(o.tier_rate) if o.tier_rate is not None else None,
            "cash_value": float(o.cash_value) if o.cash_value is not None else None,
            "is_manual_tier": o.is_manual_tier,
        },
    )
    db.commit()

    return _serialize_order(db, o)


@router.get("/summary", response_model=OrdersSummaryOut)
def get_orders_summary(
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    orders_q = db.query(Order)
    redemptions_q = db.query(PointsRedemption)

    if start:
        dt = _parse_dt(start)
        orders_q = orders_q.filter(Order.created_at >= dt)
        redemptions_q = redemptions_q.filter(PointsRedemption.created_at >= dt)
    if end:
        dt = _parse_dt(end)
        orders_q = orders_q.filter(Order.created_at <= dt)
        redemptions_q = redemptions_q.filter(PointsRedemption.created_at <= dt)

    total_receivable = float(
        orders_q.with_entities(func.coalesce(func.sum(Order.amount), 0)).scalar() or 0
    )
    total_received = float(
        orders_q.with_entities(func.coalesce(func.sum(Order.paid_amount), 0)).scalar() or 0
    )
    total_outstanding = round(total_receivable - total_received, 2)

    total_credits_redeemed = int(
        redemptions_q.with_entities(func.coalesce(func.sum(PointsRedemption.points_used), 0)).scalar() or 0
    )

    payment_rows = (
        orders_q.with_entities(
            Order.payment_method,
            func.coalesce(func.sum(Order.paid_amount), 0).label("total_paid"),
        )
        .group_by(Order.payment_method)
        .all()
    )

    payment_method_totals: dict[str, float] = {}
    for method, total_paid in payment_rows:
        key = method or "unknown"
        payment_method_totals[key] = float(total_paid or 0)

    return OrdersSummaryOut(
        total_receivable=total_receivable,
        total_received=total_received,
        total_outstanding=total_outstanding,
        total_credits_redeemed=total_credits_redeemed,
        payment_method_totals=payment_method_totals,
    )


@router.get("/outstanding/customers", response_model=list[OutstandingCustomerRow])
def list_outstanding_customers(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    outstanding_expr = case((Order.amount > Order.paid_amount, Order.amount - Order.paid_amount), else_=0)

    primary_phone_sq = (
        db.query(CustomerPhone.customer_id, func.max(CustomerPhone.phone_number).label("primary_phone"))
        .filter(CustomerPhone.is_primary == True)  # noqa: E712
        .group_by(CustomerPhone.customer_id)
        .subquery()
    )

    rows = (
        db.query(
            Customer.id.label("customer_id"),
            Customer.nickname.label("nickname"),
            primary_phone_sq.c.primary_phone.label("primary_phone"),
            func.sum(outstanding_expr).label("total_outstanding"),
            func.max(Order.created_at).label("last_order_at"),
        )
        .join(Order, Order.customer_id == Customer.id)
        .outerjoin(primary_phone_sq, primary_phone_sq.c.customer_id == Customer.id)
        .group_by(Customer.id, Customer.nickname, primary_phone_sq.c.primary_phone)
        .having(func.sum(outstanding_expr) > 0)
        .order_by(func.max(Order.created_at).desc())
        .limit(200)
        .all()
    )

    return [
        OutstandingCustomerRow(
            customer_id=r.customer_id,
            nickname=r.nickname,
            primary_phone=r.primary_phone if user.role.value == "admin" else None,
            total_outstanding=float(r.total_outstanding),
            last_order_at=r.last_order_at,
        )
        for r in rows
    ]


@router.get("/preview")
def preview_orders(
    start: str | None = None,
    end: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    q = db.query(Order)

    if start:
        q = q.filter(Order.created_at >= _parse_dt(start))
    if end:
        q = q.filter(Order.created_at <= _parse_dt(end))

    limit = max(1, min(limit, 100))
    orders = q.order_by(Order.created_at.desc()).limit(limit).all()

    return [
        {
            "created_at": _to_eastern_string(o.created_at),
            "order_id": o.id,
            "customer_id": o.customer_id,
            "phone_number_used": o.phone_number_used if user.role.value == "admin" else _mask_phone(o.phone_number_used),
            "amount": float(o.amount),
            "paid_amount": float(o.paid_amount),
            "payment_method": o.payment_method,
            "points_earned": o.points_earned,
            "tier_rate": float(o.tier_rate) if o.tier_rate is not None else None,
            "cash_value": float(o.cash_value) if o.cash_value is not None else None,
            "is_manual_tier": bool(o.is_manual_tier),
            "operator_user_id": o.operator_user_id,
            "note": o.note,
        }
        for o in orders
    ]


@router.get("/export")
def export_orders_csv(
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    q = db.query(Order)

    if start:
        q = q.filter(Order.created_at >= _parse_dt(start))
    if end:
        q = q.filter(Order.created_at <= _parse_dt(end))

    orders = q.order_by(Order.created_at.desc()).limit(10000).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "created_at",
        "order_id",
        "customer_id",
        "phone_number_used",
        "amount",
        "paid_amount",
        "payment_method",
        "points_earned",
        "tier_rate",
        "cash_value",
        "is_manual_tier",
        "operator_user_id",
        "note",
    ])

    for o in orders:
        phone_value = o.phone_number_used if user.role.value == "admin" else _mask_phone(o.phone_number_used)
        w.writerow([
            _to_eastern_string(o.created_at),
            o.id,
            o.customer_id,
            phone_value,
            float(o.amount),
            float(o.paid_amount),
            o.payment_method or "",
            o.points_earned,
            float(o.tier_rate) if o.tier_rate is not None else "",
            float(o.cash_value) if o.cash_value is not None else "",
            bool(o.is_manual_tier),
            o.operator_user_id,
            o.note or "",
        ])

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="EXPORT_CSV",
        entity_type="orders",
        entity_id=f"{start or 'none'}__{end or 'none'}",
        after={
            "start": start,
            "end": end,
            "rows": len(orders),
            "role": user.role.value,
        },
    )
    db.commit()

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders_export.csv"},
    )


@router.get("", response_model=list[OrderOut])
def list_orders(
    customer_id: Optional[int] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    q = db.query(Order)

    if customer_id is not None:
        q = q.filter(Order.customer_id == customer_id)

    limit = max(1, min(limit, 500))
    rows = q.order_by(Order.created_at.desc()).limit(limit).all()

    return [_serialize_order(db, o) for o in rows]