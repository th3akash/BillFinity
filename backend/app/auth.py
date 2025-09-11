import os
import time
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from . import models

# Modes:
# - Local JWT signing (HS256) with SECRET_KEY
# - Or verify incoming JWTs from an external provider (e.g., Neon Auth) via shared secret or public key
AUTH_MODE = os.getenv("AUTH_MODE", "local")  # "local" or "jwt"
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "false").lower() in ("1", "true", "yes")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Set auto_error=False so we can optionally bypass auth in dev without 403 from the security dependency
security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(sub: str, extra: Optional[dict] = None, expires_minutes: Optional[int] = None) -> str:
    to_encode = {"sub": sub, "iat": int(time.time())}
    if extra:
        to_encode.update(extra)
    exp_mins = expires_minutes or ACCESS_TOKEN_EXPIRE_MINUTES
    to_encode["exp"] = int(time.time()) + (exp_mins * 60)
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    # Development bypass: allow requests without Authorization when AUTH_DISABLED=true
    if AUTH_DISABLED:
        user = db.query(models.User).filter(models.User.is_active == True).first()
        if user:
            return user
        # Create a default active user if none exist
        user = models.User(name="Dev User", email="dev@example.com", role="admin", is_active=True)
        db.add(user)
        db.flush()
        db.refresh(user)
        return user

    if cred is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authenticated")

    token = cred.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")
    return user
