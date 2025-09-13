from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user
import logging
from datetime import datetime

# simple deletion logger
deletion_logger = logging.getLogger('deletions')
handler = logging.FileHandler('deletions.log')
handler.setFormatter(logging.Formatter('%(asctime)s %(message)s'))
deletion_logger.addHandler(handler)
deletion_logger.setLevel(logging.INFO)

router = APIRouter(prefix="/items", tags=["Items"])

@router.get("/", response_model=List[schemas.ItemOut])
def list_items(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Item).order_by(models.Item.created_at.desc()).all()

@router.post("/", response_model=schemas.ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: schemas.ItemCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Ensure unique SKU
    exists = db.query(models.Item).filter(models.Item.sku == payload.sku).first()
    if exists:
        raise HTTPException(status_code=400, detail="SKU already exists")
    item = models.Item(**payload.dict())
    db.add(item)
    db.flush()
    db.refresh(item)
    return item

@router.patch("/{item_id}/stock", response_model=schemas.ItemOut)
def update_item_stock(item_id: int, payload: schemas.ItemUpdateStock, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.stock = payload.stock
    db.add(item)
    db.flush()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=schemas.ItemOut)
def update_item(item_id: int, payload: schemas.ItemUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # If SKU is changing, ensure uniqueness
    if payload.sku and payload.sku != item.sku:
        exists = db.query(models.Item).filter(models.Item.sku == payload.sku).first()
        if exists:
            raise HTTPException(status_code=400, detail="SKU already exists")

    # Apply updates
    for field in ("name", "sku", "category", "price", "stock", "reorder_point", "gst_rate"):
        val = getattr(payload, field, None)
        if val is not None:
            setattr(item, field if field != 'reorder_point' else 'reorder_point', val)

    db.add(item)
    db.flush()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.query(models.Item).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Prevent deleting if referenced by existing orders
    ref = db.query(models.OrderItem).filter(models.OrderItem.item_id == item_id).first()
    if ref:
        raise HTTPException(status_code=400, detail="Cannot delete item referenced by orders")

    db.delete(item)
    db.commit()
    # audit log
    try:
        user_repr = getattr(user, 'username', str(user))
    except Exception:
        user_repr = 'unknown'
    deletion_logger.info(f"item_delete id={item_id} sku={item.sku} name={item.name} by={user_repr}")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
