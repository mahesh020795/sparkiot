import asyncio
from collections.abc import Callable
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import init_db
from app.services.mqtt_bridge import MqttIngestionBridge


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Spark IoT API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Callable):
        request_id = request.headers.get("x-request-id", f"req_{int(time() * 1000)}")
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(status_code=400, content={"code": "validation_error", "message": str(exc), "request_id": request.headers.get("x-request-id")})

    @app.on_event("startup")
    def startup() -> None:
        init_db()
        if settings.mqtt_consumer_enabled:
            try:
                loop = asyncio.get_running_loop()
                bridge = MqttIngestionBridge(loop, settings)
                bridge.start()
                app.state.mqtt_bridge = bridge
            except RuntimeError:
                app.state.mqtt_bridge = None

    @app.on_event("shutdown")
    def shutdown() -> None:
        bridge = getattr(app.state, "mqtt_bridge", None)
        if bridge:
            bridge.stop()

    @app.get("/health/live")
    def live():
        return {"status": "live"}

    @app.get("/health/ready")
    def ready():
        return {"status": "ready", "database": "ok"}

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
