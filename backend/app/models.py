from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Enum, Numeric, Boolean, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy import UniqueConstraint
from .database import Base
import enum

class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class OrderStatus(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    canceled = "canceled"

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    role = Column(String(50), default="user", nullable=False)
    password_hash = Column(String(255), nullable=True)  # Optional if using external auth
    is_active = Column(Boolean, default=True, nullable=False)

class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), index=True, nullable=True)
    phone = Column(String(50), nullable=True)
    gstin = Column(String(32), nullable=True)
    company_name = Column(String(255), nullable=True)
    address = Column(String(500), nullable=True)

    orders = relationship("Order", back_populates="customer")

class Item(Base, TimestampMixin):
    __tablename__ = "items"
    __table_args__ = (UniqueConstraint("sku", name="uq_item_sku"),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(100), nullable=False)
    category = Column(String(100), nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    stock = Column(Integer, nullable=False, default=0)
    reorder_point = Column(Integer, nullable=False, default=0)
    # GST percentage (0,5,12,18,28). Stored as integer percent.
    gst_rate = Column(Integer, nullable=False, default=18)

    order_items = relationship("OrderItem", back_populates="item")

    # Components if this item is a combo (presence of components implies combo)
    components = relationship(
        "ItemComboComponent",
        primaryjoin="Item.id==ItemComboComponent.combo_item_id",
        cascade="all, delete-orphan",
        back_populates="combo_item",
    )
    used_in_combos = relationship(
        "ItemComboComponent",
        primaryjoin="Item.id==ItemComboComponent.component_item_id",
        back_populates="component_item",
    )

class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    total = Column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending)

    customer = relationship("Customer", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

class OrderItem(Base):
    __tablename__ = "order_items"
    # Composite PK
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="RESTRICT"), primary_key=True)
    qty = Column(Integer, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)  # unit price at time of order

    order = relationship("Order", back_populates="items")
    item = relationship("Item", back_populates="order_items")

class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=True)
    address = Column(String(1000), nullable=True)
    currency = Column(String(10), nullable=False, default="INR")
    email_updates = Column(Boolean, default=True, nullable=False)
    sms_alerts = Column(Boolean, default=False, nullable=False)
    low_stock_reminders = Column(Boolean, default=True, nullable=False)


class ItemComboComponent(Base):
    __tablename__ = "item_combo_components"

    combo_item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True)
    component_item_id = Column(Integer, ForeignKey("items.id", ondelete="RESTRICT"), primary_key=True)
    qty = Column(Integer, nullable=False)

    combo_item = relationship("Item", foreign_keys=[combo_item_id], back_populates="components")
    component_item = relationship("Item", foreign_keys=[component_item_id], back_populates="used_in_combos")
