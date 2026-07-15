from fastapi import APIRouter

from app.api.routes import auth, dashboards, demo, devices, notifications, projects, realtime, schedules, telemetry, tenant

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(tenant.router)
api_router.include_router(projects.router)
api_router.include_router(devices.router)
api_router.include_router(dashboards.router)
api_router.include_router(telemetry.router)
api_router.include_router(demo.router)
api_router.include_router(notifications.router)
api_router.include_router(realtime.router)
api_router.include_router(schedules.router)
