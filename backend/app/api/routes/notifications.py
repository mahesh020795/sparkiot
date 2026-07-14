from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import Notification, PushSubscription, User
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
    return notification


@router.post("/push-subscriptions", status_code=201)
def add_push_subscription(payload: PushSubscriptionCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.add(PushSubscription(tenant_id=user.tenant_id, user_id=user.id, endpoint=str(payload.endpoint), keys=payload.keys))
    db.commit()
    return {"status": "stored"}
