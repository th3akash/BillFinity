import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import init_db
from .routes import customers, items, orders, users, settings
from .websocket import orders_ws

app = FastAPI(title="InvoiceFlow Backend")

# CORS (allow local HTML files to fetch)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (MVP)
@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def read_root():
    return {"status": "ok", "service": "InvoiceFlow Backend"}

# Routers
app.include_router(customers.router)
app.include_router(items.router)
app.include_router(orders.router)
app.include_router(users.router)
app.include_router(settings.router)

# WebSocket endpoint
app.add_api_websocket_route("/ws/orders", orders_ws)
