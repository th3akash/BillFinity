import json
from typing import Set
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        data = json.dumps(message, default=str)
        to_remove = []
        for ws in list(self.active_connections):
            try:
                await ws.send_text(data)
            except Exception:
                to_remove.append(ws)
        for ws in to_remove:
            self.disconnect(ws)

manager = ConnectionManager()

async def orders_ws(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Optional: receive messages from client if needed
            _ = await websocket.receive_text()
            # Echo or ignore; we primarily push server-side updates.
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Helper used by routes to push updates
async def broadcast_order_update(payload: dict):
    await manager.broadcast({"type": "order_update", "data": payload})
