import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv, find_dotenv

# Load env (works no matter where you run uvicorn from)
load_dotenv(find_dotenv())

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not set")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db                 # <-- FastAPI will hand the real Session to your route
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Lightweight, idempotent DDL patches for existing databases (no Alembic yet)
    try:
        with engine.begin() as conn:
            # Add gst_rate to items if missing (PostgreSQL IF NOT EXISTS supported)
            conn.execute(text("ALTER TABLE items ADD COLUMN IF NOT EXISTS gst_rate INTEGER NOT NULL DEFAULT 18"))
            # Add store phone and gstin to settings if missing
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS phone VARCHAR(64)"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS email VARCHAR(255)"))
            conn.execute(text("ALTER TABLE settings ADD COLUMN IF NOT EXISTS gstin VARCHAR(64)"))
    except Exception:
        # Don't block startup if DDL fails; app can still run for fresh DBs
        pass
