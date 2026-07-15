from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.domain import Project, User
from app.services.realtime import hub

router = APIRouter(prefix="/realtime", tags=["realtime"])


def realtime_subscription_scope(token: str, project_id: str, db: Session) -> tuple[str, str]:
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise ValueError("Invalid realtime token") from exc
    user = db.get(User, payload["sub"])
    if not user or user.tenant_id != payload["tenant_id"]:
        raise ValueError("Invalid realtime user")
    project = db.scalar(select(Project).where(Project.id == project_id, Project.tenant_id == user.tenant_id, Project.is_active))
    if not project:
        raise ValueError("Project not found for realtime subscription")
    return user.tenant_id, project.id


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str, project_id: str, db: Session = Depends(get_db)):
    try:
        tenant_id, scoped_project_id = realtime_subscription_scope(token, project_id, db)
    except ValueError:
        await websocket.close(code=4401)
        return
    await hub.connect(tenant_id, websocket, scoped_project_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(tenant_id, websocket, scoped_project_id)
