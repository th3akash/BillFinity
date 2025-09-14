import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Local imports (keep existing structure)
from .database import init_db
from .routes import customers, items, orders, users, settings
from .websocket import orders_ws

app = FastAPI(title="BillFinity Backend")


# --- CORS (robust parsing + safe wildcard handling) ---
# Read list from env, trim spaces, and support '*'.
_origins_env = os.getenv("CORS_ALLOW_ORIGINS", "*").strip()
if _origins_env == "*":
    _allow_origins = ["*"]
    # Starlette limitation: credentials with wildcard origins is not allowed.
    # If you need cookies/Authorization with specific origins, set CORS_ALLOW_ORIGINS
    # to a comma-separated list instead of '*'.
    _allow_credentials = False
else:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Lifespan hooks ---
@app.on_event("startup")
def _on_startup():
    try:
        init_db()
    except Exception:
        # Don't crash app if DB migrations fail on first boot
        pass


# --- Health / Root ---
@app.get("/health")
def health():
    return {"ok": True, "service": "BillFinity API"}


@app.get("/")
def read_root():
    return {"status": "ok", "service": "BillFinity API"}


# --- Routers ---
app.include_router(customers.router)
app.include_router(items.router)
app.include_router(orders.router)
app.include_router(users.router)
app.include_router(settings.router)


# --- WebSocket endpoint ---
app.add_api_websocket_route("/ws/orders", orders_ws)
