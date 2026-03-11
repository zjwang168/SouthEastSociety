import csv
import io
from datetime import datetime, date
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from ..db import get_db
from ..routers.auth import get_current_user_from_header
from ..models import Order, Customer, CustomerPhone, User, SmsQueue
from ..schemas import (
    OrderCreate, OrderOut, OrderNoteUpdate, OrderAmountsUpdate, OutstandingCustomerRow
)
from ..services.points import calc_points_earned
from ..services.audit import write_audit_log

router = APIRouter(prefix="/orders", tags=["orders"])

ET = ZoneInfo("America/New_York")
UTC = ZoneInfo("UTC")


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


def _mask_phone(phone: str | None) -> str:
    if not phone:
        return ""
    if len(phone) >= 7:
        return f"{phone[:3]}****{phone[-4:]}"
    return "****"


def _to_eastern_string(dt: datetime) -> str:
    dt_utc = dt.replace(tzinfo=UTC)
    return dt_utc.astimezone(ET).strftime("%Y-%m-%d %I:%M:%S %p")


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


@router.post("", response_model=OrderOut)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    phone_number = payload.phone_number_used.strip()
    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number_used is required")

    # 1) 先按手机号找老客
    c = _find_customer_by_phone(db, phone_number)

    # 2) 没找到就自动建新客 + phone
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

    points = calc_points_earned(payload.amount)

    o = Order(
        customer_id=c.id,
        phone_number_used=phone_number,
        amount=payload.amount,
        paid_amount=paid_amount,
        points_earned=points,
        points_used=0,
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
            "points_earned": o.points_earned,
            "note": o.note,
            "created_new_customer": created_new_customer,
            "customer_nickname": c.nickname,
        },
    )
    db.commit()

    outstanding = float(o.amount) - float(o.paid_amount)
    if outstanding > 0:
        to_phone = _get_primary_phone(db, o.customer_id) or o.phone_number_used
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
        db.commit()

    return OrderOut(
        id=o.id,
        customer_id=o.customer_id,
        phone_number_used=o.phone_number_used,
        amount=float(o.amount),
        paid_amount=float(o.paid_amount),
        points_earned=o.points_earned,
        points_used=o.points_used,
        operator_user_id=o.operator_user_id,
        created_at=o.created_at,
        note=o.note,
    )


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

    return OrderOut(
        id=o.id,
        customer_id=o.customer_id,
        phone_number_used=o.phone_number_used,
        amount=float(o.amount),
        paid_amount=float(o.paid_amount),
        points_earned=o.points_earned,
        points_used=o.points_used,
        operator_user_id=o.operator_user_id,
        created_at=o.created_at,
        note=o.note,
    )


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
    }

    o.amount = payload.amount
    o.paid_amount = payload.paid_amount
    o.points_earned = calc_points_earned(payload.amount)
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
        },
    )
    db.commit()

    return OrderOut(
        id=o.id,
        customer_id=o.customer_id,
        phone_number_used=o.phone_number_used,
        amount=float(o.amount),
        paid_amount=float(o.paid_amount),
        points_earned=o.points_earned,
        points_used=o.points_used,
        operator_user_id=o.operator_user_id,
        created_at=o.created_at,
        note=o.note,
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


@router.get("/export")
def export_orders_csv(
    start: str | None = None,
    end: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    q = db.query(Order)

    def parse_dt(s: str) -> datetime:
        return datetime.fromisoformat(s)

    if start:
        q = q.filter(Order.created_at >= parse_dt(start))
    if end:
        q = q.filter(Order.created_at <= parse_dt(end))

    orders = q.order_by(Order.created_at.desc()).limit(10000).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "created_at", "order_id", "customer_id", "phone_number_used",
        "amount", "paid_amount", "points_earned", "operator_user_id", "note"
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
            o.points_earned,
            o.operator_user_id,
            o.note or ""
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

    return [
        OrderOut(
            id=o.id,
            customer_id=o.customer_id,
            phone_number_used=o.phone_number_used,
            amount=float(o.amount),
            paid_amount=float(o.paid_amount),
            points_earned=o.points_earned,
            points_used=o.points_used,
            operator_user_id=o.operator_user_id,
            created_at=o.created_at,
            note=o.note,
        )
        for o in rows
    ]