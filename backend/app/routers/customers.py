from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..routers.auth import get_current_user_from_header
from ..models import Customer, CustomerPhone, User, Order, PointsRedemption
from ..schemas import (
    CustomerCreate,
    CustomerWithPhones,
    PhoneCreate,
    PhoneOut,
    PhoneUpdate,
    PointsSummaryOut,
    PointsRedemptionCreate,
    PointsRedemptionOut,
)
from ..services.audit import write_audit_log

router = APIRouter(prefix="/customers", tags=["customers"])


def _get_points_summary(db: Session, customer_id: int) -> PointsSummaryOut:
    earned = (
        db.query(func.coalesce(func.sum(Order.points_earned), 0))
        .filter(Order.customer_id == customer_id)
        .scalar()
    )

    redeemed = (
        db.query(func.coalesce(func.sum(PointsRedemption.points_used), 0))
        .filter(PointsRedemption.customer_id == customer_id)
        .scalar()
    )

    earned = int(earned or 0)
    redeemed = int(redeemed or 0)
    available = earned - redeemed

    return PointsSummaryOut(
        customer_id=customer_id,
        total_points_earned=earned,
        total_points_redeemed=redeemed,
        available_points=available,
    )


@router.get("")
def search_customers(
    phone: str | None = None,
    nickname: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    q = db.query(Customer)
    if phone and user.role.value == "admin":
        q = q.join(CustomerPhone).filter(CustomerPhone.phone_number == phone)
    if nickname:
        q = q.filter(Customer.nickname.ilike(f"%{nickname}%"))

    rows = q.limit(50).all()

    result = []
    for c in rows:
        phones = []
        if user.role.value == "admin":
            phone_rows = db.query(CustomerPhone).filter(CustomerPhone.customer_id == c.id).all()
            phones = [
                PhoneOut(
                    id=p.id,
                    customer_id=p.customer_id,
                    phone_number=p.phone_number,
                    is_primary=p.is_primary,
                    sms_enabled=p.sms_enabled,
                    created_at=p.created_at,
                )
                for p in phone_rows
            ]

        result.append(
            CustomerWithPhones(
                id=c.id,
                nickname=c.nickname,
                status=c.status.value,
                created_at=c.created_at,
                updated_at=c.updated_at,
                phones=phones,
            )
        )
    return result


@router.post("", response_model=CustomerWithPhones)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = Customer(nickname=payload.nickname)
    db.add(c)
    db.commit()
    db.refresh(c)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="CREATE_CUSTOMER",
        entity_type="customer",
        entity_id=str(c.id),
        after={
            "nickname": c.nickname,
            "status": c.status.value,
        },
    )
    db.commit()

    return CustomerWithPhones(
        id=c.id,
        nickname=c.nickname,
        status=c.status.value,
        created_at=c.created_at,
        updated_at=c.updated_at,
        phones=[],
    )


@router.get("/{customer_id}", response_model=CustomerWithPhones)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    phones = []
    if user.role.value == "admin":
        phone_rows = db.query(CustomerPhone).filter(CustomerPhone.customer_id == c.id).all()
        phones = [
            PhoneOut(
                id=p.id,
                customer_id=p.customer_id,
                phone_number=p.phone_number,
                is_primary=p.is_primary,
                sms_enabled=p.sms_enabled,
                created_at=p.created_at,
            )
            for p in phone_rows
        ]

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="VIEW_CUSTOMER_DETAIL",
        entity_type="customer",
        entity_id=str(c.id),
        after={"nickname": c.nickname},
    )
    db.commit()

    return CustomerWithPhones(
        id=c.id,
        nickname=c.nickname,
        status=c.status.value,
        created_at=c.created_at,
        updated_at=c.updated_at,
        phones=phones,
    )


@router.get("/{customer_id}/points-summary", response_model=PointsSummaryOut)
def get_points_summary(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    return _get_points_summary(db, customer_id)


@router.get("/{customer_id}/redemptions", response_model=list[PointsRedemptionOut])
def list_redemptions(
    customer_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    rows = (
        db.query(PointsRedemption)
        .filter(PointsRedemption.customer_id == customer_id)
        .order_by(PointsRedemption.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        PointsRedemptionOut(
            id=r.id,
            customer_id=r.customer_id,
            points_used=r.points_used,
            gift_name=r.gift_name,
            note=r.note,
            operator_user_id=r.operator_user_id,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/{customer_id}/redeem-points", response_model=PointsRedemptionOut)
def redeem_points(
    customer_id: int,
    payload: PointsRedemptionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    summary = _get_points_summary(db, customer_id)
    if payload.points_used > summary.available_points:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough points. Available: {summary.available_points}",
        )

    row = PointsRedemption(
        customer_id=customer_id,
        points_used=payload.points_used,
        gift_name=payload.gift_name,
        note=payload.note,
        operator_user_id=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="REDEEM_POINTS",
        entity_type="points_redemption",
        entity_id=str(row.id),
        after={
            "customer_id": customer_id,
            "points_used": row.points_used,
            "gift_name": row.gift_name,
            "note": row.note,
        },
    )
    db.commit()

    return PointsRedemptionOut(
        id=row.id,
        customer_id=row.customer_id,
        points_used=row.points_used,
        gift_name=row.gift_name,
        note=row.note,
        operator_user_id=row.operator_user_id,
        created_at=row.created_at,
    )


@router.post("/{customer_id}/phones", response_model=PhoneOut)
def add_phone(
    customer_id: int,
    payload: PhoneCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    existing = db.query(CustomerPhone).filter(CustomerPhone.phone_number == payload.phone_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already exists")

    if payload.is_primary:
        db.query(CustomerPhone).filter(CustomerPhone.customer_id == customer_id).update({"is_primary": False})

    p = CustomerPhone(
        customer_id=customer_id,
        phone_number=payload.phone_number,
        is_primary=payload.is_primary,
        sms_enabled=payload.sms_enabled,
    )
    db.add(p)
    db.commit()
    db.refresh(p)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="ADD_PHONE",
        entity_type="phone",
        entity_id=str(p.id),
        after={
            "customer_id": p.customer_id,
            "phone_number": p.phone_number,
            "is_primary": p.is_primary,
            "sms_enabled": p.sms_enabled,
        },
    )
    db.commit()

    return PhoneOut(
        id=p.id,
        customer_id=p.customer_id,
        phone_number=p.phone_number,
        is_primary=p.is_primary,
        sms_enabled=p.sms_enabled,
        created_at=p.created_at,
    )


@router.patch("/{customer_id}/phones/{phone_id}", response_model=PhoneOut)
def update_phone(
    customer_id: int,
    phone_id: int,
    payload: PhoneUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    phone = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.id == phone_id, CustomerPhone.customer_id == customer_id)
        .first()
    )
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    before = {
        "phone_number": phone.phone_number,
        "is_primary": phone.is_primary,
        "sms_enabled": phone.sms_enabled,
    }

    if payload.sms_enabled is not None:
        phone.sms_enabled = payload.sms_enabled

    if payload.is_primary is not None:
        if payload.is_primary:
            db.query(CustomerPhone).filter(
                CustomerPhone.customer_id == customer_id,
                CustomerPhone.id != phone_id,
            ).update({"is_primary": False})
            phone.is_primary = True
        else:
            phone.is_primary = False

    db.commit()
    db.refresh(phone)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="UPDATE_PHONE",
        entity_type="phone",
        entity_id=str(phone.id),
        before=before,
        after={
            "phone_number": phone.phone_number,
            "is_primary": phone.is_primary,
            "sms_enabled": phone.sms_enabled,
        },
    )
    db.commit()

    return PhoneOut(
        id=phone.id,
        customer_id=phone.customer_id,
        phone_number=phone.phone_number,
        is_primary=phone.is_primary,
        sms_enabled=phone.sms_enabled,
        created_at=phone.created_at,
    )


@router.delete("/{customer_id}/phones/{phone_id}")
def delete_phone(
    customer_id: int,
    phone_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_from_header),
):
    phone = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.id == phone_id, CustomerPhone.customer_id == customer_id)
        .first()
    )
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    before = {
        "id": phone.id,
        "customer_id": phone.customer_id,
        "phone_number": phone.phone_number,
        "is_primary": phone.is_primary,
        "sms_enabled": phone.sms_enabled,
    }

    db.delete(phone)

    write_audit_log(
        db=db,
        actor_user_id=user.id,
        action="DELETE_PHONE",
        entity_type="phone",
        entity_id=str(phone_id),
        before=before,
    )

    db.commit()
    return {"status": "ok"}