from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..routers.auth import get_current_user_from_header
from ..models import Customer, CustomerPhone
from ..schemas import CustomerCreate, CustomerWithPhones, PhoneCreate, PhoneOut, PhoneUpdate

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
def search_customers(
    phone: str | None = None,
    nickname: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_from_header),
):
    q = db.query(Customer)
    if phone:
        q = q.join(CustomerPhone).filter(CustomerPhone.phone_number == phone)
    if nickname:
        q = q.filter(Customer.nickname.ilike(f"%{nickname}%"))
    return q.limit(50).all()


@router.post("", response_model=CustomerWithPhones)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_from_header),
):
    c = Customer(nickname=payload.nickname)
    db.add(c)
    db.commit()
    db.refresh(c)
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
    user=Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    phones = db.query(CustomerPhone).filter(CustomerPhone.customer_id == c.id).all()
    return CustomerWithPhones(
        id=c.id,
        nickname=c.nickname,
        status=c.status.value,
        created_at=c.created_at,
        updated_at=c.updated_at,
        phones=[
            PhoneOut(
                id=p.id,
                customer_id=p.customer_id,
                phone_number=p.phone_number,
                is_primary=p.is_primary,
                sms_enabled=p.sms_enabled,
                created_at=p.created_at,
            )
            for p in phones
        ],
    )


@router.post("/{customer_id}/phones", response_model=PhoneOut)
def add_phone(
    customer_id: int,
    payload: PhoneCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user_from_header),
):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    # ensure unique phone
    existing = db.query(CustomerPhone).filter(CustomerPhone.phone_number == payload.phone_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already exists")

    # enforce single primary
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
):
    phone = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.id == phone_id, CustomerPhone.customer_id == customer_id)
        .first()
    )
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    # Update sms_enabled if provided
    if payload.sms_enabled is not None:
        phone.sms_enabled = payload.sms_enabled

    # Update is_primary if provided
    if payload.is_primary is not None:
        if payload.is_primary:
            # Unset others
            db.query(CustomerPhone).filter(
                CustomerPhone.customer_id == customer_id,
                CustomerPhone.id != phone_id,
            ).update({"is_primary": False})
            phone.is_primary = True
        else:
            phone.is_primary = False

    db.commit()
    db.refresh(phone)

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
):
    phone = (
        db.query(CustomerPhone)
        .filter(CustomerPhone.id == phone_id, CustomerPhone.customer_id == customer_id)
        .first()
    )
    if not phone:
        raise HTTPException(status_code=404, detail="Phone not found")

    db.delete(phone)
    db.commit()
    return {"status": "ok"}