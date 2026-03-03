import enum
from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    DateTime,
    Date,
    Boolean,
    ForeignKey,
    Enum,
    Numeric,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    staff = "staff"


class CustomerStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"
    merged = "merged"


class SmsStatus(str, enum.Enum):
    success = "success"
    failed = "failed"


class SmsQueueStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.staff)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Granular permissions (MVP)
    can_edit_order_note: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit_order_amounts: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[CustomerStatus] = mapped_column(Enum(CustomerStatus), default=CustomerStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    phones = relationship("CustomerPhone", back_populates="customer", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="customer")


class CustomerPhone(Base):
    __tablename__ = "customer_phones"
    __table_args__ = (UniqueConstraint("phone_number", name="uq_phone_number"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    phone_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sms_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="phones")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)

    phone_number_used: Mapped[str] = mapped_column(String(30))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    paid_amount: Mapped[float] = mapped_column(Numeric(10, 2))

    points_earned: Mapped[int] = mapped_column(Integer)
    points_used: Mapped[int] = mapped_column(Integer, default=0)

    operator_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer = relationship("Customer", back_populates="orders")


class SmsLog(Base):
    __tablename__ = "sms_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)

    phone_number: Mapped[str] = mapped_column(String(30))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[SmsStatus] = mapped_column(Enum(SmsStatus))
    provider_message_id: Mapped[str | None] = mapped_column(String(120), nullable=True)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SmsQueue(Base):
    """
    Queue for scheduled SMS (Phase 1 requirement: send next day in batch).
    """
    __tablename__ = "sms_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True, index=True)

    phone_number: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(Text)

    scheduled_for: Mapped[datetime] = mapped_column(Date, index=True)  # Date-only
    status: Mapped[SmsQueueStatus] = mapped_column(Enum(SmsQueueStatus), default=SmsQueueStatus.pending)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(20))  # create/update/delete
    entity_type: Mapped[str] = mapped_column(String(30))  # order/customer/phone/user
    entity_id: Mapped[str] = mapped_column(String(64))
    before_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    after_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)