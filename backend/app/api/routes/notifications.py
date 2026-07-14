from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.domain import Notification, PushSubscription, User
from app.services.push import deliver_notification_pushes
from app.schemas.api import NotificationCreate, NotificationResponse, PushSubscriptionCreate

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Notification).where(Notification.tenant_id == user.tenant_id).order_by(desc(Notification.created_at)).limit(100)).all()


@router.post("", response_model=NotificationResponse, status_code=201)
def create_notification(payload: NotificationCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    notification = Notification(tenant_id=user.tenant_id, user_id=user.id, title=payload.title, body=payload.body)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    deliver_notification_pushes(db, notification)
    return notification


@router.get("/push-public-key")
def push_public_key():
    return {"public_key": get_settings().vapid_public_key}


@router.post("/push-subscriptions", status_code=201)
def add_push_subscription(payload: PushSubscriptionCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    endpoint = str(payload.endpoint)
    existing = db.scalar(select(PushSubscription).where(PushSubscription.tenant_id == user.tenant_id, PushSubscription.user_id == user.id, PushSubscription.endpoint == endpoint))
    if existing:
        existing.keys = payload.keys
    else:
        db.add(PushSubscription(tenant_id=user.tenant_id, user_id=user.id, endpoint=endpoint, keys=payload.keys))
    db.commit()
    return {"status": "stored"}


@router.delete("/push-subscriptions", status_code=204)
def remove_push_subscription(payload: PushSubscriptionCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    endpoint = str(payload.endpoint)
    existing = db.scalar(select(PushSubscription).where(PushSubscription.tenant_id == user.tenant_id, PushSubscription.user_id == user.id, PushSubscription.endpoint == endpoint))
    if existing:
        db.delete(existing)
        db.commit()
