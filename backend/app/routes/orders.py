from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user
from ..websocket import broadcast_order_update

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/", response_model=List[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    orders = db.query(models.Order).order_by(models.Order.created_at.desc()).all()
    return orders


@router.post("/", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # validate customer
    customer = db.query(models.Customer).filter(models.Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Build items map (id -> Item)
    item_ids = [entry.item_id for entry in payload.items]
    items = db.query(models.Item).filter(models.Item.id.in_(item_ids)).all()
    items_map = {it.id: it for it in items}

    # Ensure all items exist
    for entry in payload.items:
        if entry.item_id not in items_map:
            raise HTTPException(status_code=404, detail=f"Item id {entry.item_id} not found")

    total = Decimal("0.00")
    order = models.Order(customer_id=payload.customer_id, status=models.OrderStatus.pending)
    db.add(order)
    db.flush()  # to get order.id

    # process line items
    for entry in payload.items:
        it = items_map[entry.item_id]
        if it.stock < entry.qty:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for item {it.name} (SKU: {it.sku})")
        line_price = it.price
        total += (line_price * entry.qty)

        oi = models.OrderItem(order_id=order.id, item_id=it.id, qty=entry.qty, price=line_price)
        db.add(oi)

        # reduce stock
        it.stock = it.stock - entry.qty
        db.add(it)

    order.total = total
    db.add(order)
    db.commit()
    db.refresh(order)

    # Broadcast the update (async)
    try:
        await broadcast_order_update({
            "order_id": order.id,
            "customer_id": order.customer_id,
            "total": str(order.total),
            "status": order.status.value,
            "created_at": order.created_at.isoformat()
        })
    except Exception:
        # Don't fail the request if WS broadcast fails; just continue.
        pass

    return order


@router.post("/{order_id}/complete", response_model=schemas.OrderOut)
def complete_order(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.query(models.Order).get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = models.OrderStatus.completed
    db.add(order)
    db.flush()
    db.refresh(order)
    return order
