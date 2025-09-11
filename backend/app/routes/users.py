from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already in use")
    password_hash = hash_password(payload.password) if payload.password else None
    u = models.User(
        name=payload.name,
        email=payload.email,
        role=payload.role,
        is_active=True,
        password_hash=password_hash,
    )
    db.add(u)
    db.flush()
    db.refresh(u)
    return u

# Minimal local login (for development)
@router.post("/login", response_model=schemas.Token, tags=["Auth"])
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user.email, extra={"role": user.role})
    return {"access_token": token, "token_type": "bearer", "expires_in": 60*60}
