from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum

# ---------- Users ----------
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "user"
    is_active: bool = True

class UserCreate(UserBase):
    password: Optional[str] = None  # Optional if external auth

class UserOut(UserBase):
    # Relax email validation in responses to allow dev/test domains
    email: str
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Customers ----------
class CustomerBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    gstin: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None

class CustomerOut(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Items ----------
class ItemBase(BaseModel):
    name: str
    sku: str
    category: Optional[str] = None
    price: Decimal = Decimal("0.00")
    stock: int = 0
    reorder_point: int = 0

class ItemCreate(ItemBase):
    pass

class ItemUpdateStock(BaseModel):
    stock: int

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    price: Optional[Decimal] = None
    stock: Optional[int] = None
    reorder_point: Optional[int] = None

class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Orders ----------
class OrderStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    canceled = "canceled"

class OrderItemIn(BaseModel):
    item_id: int
    qty: int = Field(gt=0)

class OrderCreate(BaseModel):
    customer_id: int
    items: List[OrderItemIn]

class OrderItemOut(BaseModel):
    item_id: int
    qty: int
    price: Decimal

    class Config:
        from_attributes = True

class OrderOut(BaseModel):
    id: int
    customer_id: int
    total: Decimal
    status: OrderStatus
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True

# ---------- Settings ----------
class SettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    address: Optional[str] = None
    currency: Optional[str] = None
    email_updates: Optional[bool] = None
    sms_alerts: Optional[bool] = None
    low_stock_reminders: Optional[bool] = None

class SettingsOut(SettingsUpdate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None
