from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.services.realtime import hub

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = decode_access_token(token)
    except ValueError:
        await websocket.close(code=4401)
        return
    tenant_id = payload["tenant_id"]
    await hub.connect(tenant_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(tenant_id, websocket)
