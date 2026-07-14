import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, tenant_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[tenant_id].add(websocket)

    async def disconnect(self, tenant_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections[tenant_id].discard(websocket)

    async def publish(self, tenant_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections.get(tenant_id, set()))
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except RuntimeError:
                await self.disconnect(tenant_id, websocket)


hub = RealtimeHub()
