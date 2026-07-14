from __future__ import annotations

import json
import logging
from typing import Any

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.domain import Notification, PushSubscription

logger = logging.getLogger(__name__)


def is_web_push_configured(settings: Settings) -> bool:
    return bool(settings.vapid_private_key and settings.vapid_public_key and settings.vapid_subject)


def notification_payload(notification: Notification) -> str:
    return json.dumps(
        {
            "id": notification.id,
            "title": notification.title,
            "body": notification.body,
            "created_at": notification.created_at.isoformat(),
        },
        separators=(",", ":"),
    )


def build_web_push_kwargs(subscription: PushSubscription, notification: Notification, settings: Settings) -> dict[str, Any]:
    return {
        "subscription_info": {
            "endpoint": subscription.endpoint,
            "keys": subscription.keys,
        },
        "data": notification_payload(notification),
        "vapid_private_key": settings.vapid_private_key,
        "vapid_claims": {"sub": settings.vapid_subject},
    }


def should_delete_subscription(error: Exception) -> bool:
    response = getattr(error, "response", None)
    return getattr(response, "status_code", None) in {404, 410}


def deliver_notification_pushes(db: Session, notification: Notification, settings: Settings | None = None) -> int:
    settings = settings or get_settings()
    if not is_web_push_configured(settings):
        logger.info("Web Push skipped because VAPID keys are not configured")
        return 0

    subscriptions = db.scalars(
        select(PushSubscription).where(
            PushSubscription.tenant_id == notification.tenant_id,
            PushSubscription.user_id == notification.user_id,
        )
    ).all()

    delivered = 0
    for subscription in subscriptions:
        try:
            webpush(**build_web_push_kwargs(subscription, notification, settings))
            delivered += 1
        except WebPushException as exc:
            if should_delete_subscription(exc):
                db.delete(subscription)
                db.commit()
                logger.info("Removed expired Web Push subscription %s", subscription.id)
            else:
                logger.warning("Web Push delivery failed for subscription %s: %s", subscription.id, exc)
        except Exception as exc:  # noqa: BLE001 - push failures must not break notification creation
            logger.warning("Web Push delivery failed for subscription %s: %s", subscription.id, exc)
    return delivered
