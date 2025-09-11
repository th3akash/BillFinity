from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("/", response_model=List[schemas.CustomerOut])
def list_customers(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Customer).order_by(models.Customer.created_at.desc()).all()

@router.post("/", response_model=schemas.CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = models.Customer(**payload.dict())
    db.add(c)
    db.flush()  # get ID
    db.refresh(c)
    return c

@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(customer_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = db.query(models.Customer).get(customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c

@router.patch("/{customer_id}", response_model=schemas.CustomerOut)
def update_customer(customer_id: int, payload: schemas.CustomerUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = db.query(models.Customer).get(customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(c, k, v)
    db.add(c)
    db.flush()
    db.refresh(c)
    return c

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = db.query(models.Customer).get(customer_id)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    # Prevent deleting customer if referenced by orders
    ref = db.query(models.Order).filter(models.Order.customer_id == customer_id).first()
    if ref:
        raise HTTPException(status_code=400, detail="Cannot delete customer with existing orders")
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
