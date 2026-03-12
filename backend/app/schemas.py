from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, List


# ---------- Auth ----------
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------- Users ----------
class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    can_edit_order_note: bool
    can_edit_order_amounts: bool
    created_at: datetime


class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str = "staff"
    is_active: bool = True
    can_edit_order_note: bool = False
    can_edit_order_amounts: bool = False


# ---------- Customers ----------
class CustomerCreate(BaseModel):
    nickname: Optional[str] = None


class CustomerOut(BaseModel):
    id: int
    nickname: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class PhoneCreate(BaseModel):
    phone_number: str
    is_primary: bool = False
    sms_enabled: bool = True


class PhoneOut(BaseModel):
    id: int
    customer_id: int
    phone_number: str
    is_primary: bool
    sms_enabled: bool
    created_at: datetime


class CustomerWithPhones(CustomerOut):
    phones: List[PhoneOut] = []


# ---------- Orders ----------
class OrderCreate(BaseModel):
    phone_number_used: str
    nickname: Optional[str] = None
    amount: float = Field(..., ge=0)
    paid_amount: Optional[float] = Field(default=None, ge=0)
    note: Optional[str] = None


class OrderOut(BaseModel):
    id: int
    customer_id: int
    phone_number_used: str
    amount: float
    paid_amount: float
    points_earned: int
    points_used: int
    operator_user_id: int
    created_at: datetime
    note: Optional[str] = None


class OrderNoteUpdate(BaseModel):
    note: Optional[str] = None


class OrderAmountsUpdate(BaseModel):
    amount: float = Field(..., ge=0)
    paid_amount: float = Field(..., ge=0)


# ---------- Points / Rewards ----------
class PointsSummaryOut(BaseModel):
    customer_id: int
    total_points_earned: int
    total_points_redeemed: int
    available_points: int


class PointsRedemptionCreate(BaseModel):
    points_used: int = Field(..., gt=0)
    gift_name: Optional[str] = None
    note: Optional[str] = None


class PointsRedemptionOut(BaseModel):
    id: int
    customer_id: int
    points_used: int
    gift_name: Optional[str] = None
    note: Optional[str] = None
    operator_user_id: int
    created_at: datetime


# ---------- Stats / Outstanding ----------
class SummaryStats(BaseModel):
    total_orders: int
    total_sales_amount: float
    total_customers: int


class OutstandingCustomerRow(BaseModel):
    customer_id: int
    nickname: Optional[str] = None
    primary_phone: Optional[str] = None
    total_outstanding: float
    last_order_at: datetime


class PhoneUpdate(BaseModel):
    is_primary: Optional[bool] = None
    sms_enabled: Optional[bool] = None