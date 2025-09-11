from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..auth import get_current_user

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("/", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    s = db.query(models.Setting).order_by(models.Setting.id.asc()).first()
    if not s:
        s = models.Setting(currency="INR")
        db.add(s)
        db.flush()
        db.refresh(s)
    return s

@router.put("/", response_model=schemas.SettingsOut)
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    s = db.query(models.Setting).order_by(models.Setting.id.asc()).first()
    if not s:
        s = models.Setting(currency="INR")
        db.add(s)
        db.flush()
        db.refresh(s)

    for k, v in payload.dict(exclude_unset=True).items():
        setattr(s, k, v)
    db.add(s)
    db.flush()
    db.refresh(s)
    return s
