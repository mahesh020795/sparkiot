import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    @staticmethod
    def channel_key(tenant_id: str, project_id: str | None = None) -> str:
        return f"{tenant_id}:{project_id}" if project_id else tenant_id

    async def connect(self, tenant_id: str, websocket: WebSocket, project_id: str | None = None) -> str:
        await websocket.accept()
        key = self.channel_key(tenant_id, project_id)
        async with self._lock:
            self._connections[key].add(websocket)
        return key

    async def disconnect(self, tenant_id: str, websocket: WebSocket, project_id: str | None = None) -> None:
        key = self.channel_key(tenant_id, project_id)
        async with self._lock:
            self._connections[key].discard(websocket)

    async def publish(self, tenant_id: str, event: dict[str, Any], project_id: str | None = None) -> None:
        key = self.channel_key(tenant_id, project_id)
        async with self._lock:
            connections = list(self._connections.get(key, set()))
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except RuntimeError:
                await self.disconnect(tenant_id, websocket, project_id)


hub = RealtimeHub()
