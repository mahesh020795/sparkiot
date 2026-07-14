import json
from pathlib import Path
from types import SimpleNamespace

from app.services.push import (
    build_web_push_kwargs,
    is_web_push_configured,
    notification_payload,
    should_delete_subscription,
)

ROOT = Path(__file__).resolve().parents[1]


def test_web_push_requires_complete_vapid_configuration():
    assert is_web_push_configured(SimpleNamespace(vapid_private_key="", vapid_public_key="public", vapid_subject="mailto:admin@example.com")) is False
    assert is_web_push_configured(SimpleNamespace(vapid_private_key="private", vapid_public_key="", vapid_subject="mailto:admin@example.com")) is False
    assert is_web_push_configured(SimpleNamespace(vapid_private_key="private", vapid_public_key="public", vapid_subject="")) is False
    assert is_web_push_configured(SimpleNamespace(vapid_private_key="private", vapid_public_key="public", vapid_subject="mailto:admin@example.com")) is True


def test_web_push_payload_uses_notification_shape():
    notification = SimpleNamespace(id="n-1", title="Temperature Alert", body="V0 is 82 > 80", created_at=SimpleNamespace(isoformat=lambda: "2026-07-15T04:00:00Z"))

    payload = json.loads(notification_payload(notification))

    assert payload == {
        "id": "n-1",
        "title": "Temperature Alert",
        "body": "V0 is 82 > 80",
        "created_at": "2026-07-15T04:00:00Z",
    }


def test_web_push_kwargs_match_pywebpush_contract():
    settings = SimpleNamespace(vapid_private_key="private-key", vapid_public_key="public-key", vapid_subject="mailto:admin@example.com")
    subscription = SimpleNamespace(endpoint="https://push.example/subscription", keys={"p256dh": "client-key", "auth": "client-auth"})
    notification = SimpleNamespace(id="n-2", title="Pump Alert", body="Pump state changed", created_at=SimpleNamespace(isoformat=lambda: "2026-07-15T04:01:00Z"))

    kwargs = build_web_push_kwargs(subscription, notification, settings)

    assert kwargs["subscription_info"] == {"endpoint": "https://push.example/subscription", "keys": {"p256dh": "client-key", "auth": "client-auth"}}
    assert json.loads(kwargs["data"])["title"] == "Pump Alert"
    assert kwargs["vapid_private_key"] == "private-key"
    assert kwargs["vapid_claims"] == {"sub": "mailto:admin@example.com"}


def test_expired_push_subscriptions_are_deleted():
    response = SimpleNamespace(status_code=410)
    error = SimpleNamespace(response=response)

    assert should_delete_subscription(error) is True

    response.status_code = 404
    assert should_delete_subscription(error) is True

    response.status_code = 500
    assert should_delete_subscription(error) is False


def test_web_push_api_is_documented_for_production_setup():
    api_docs = (ROOT / "docs" / "api.md").read_text(encoding="utf-8")
    readme = (ROOT / "README.md").read_text(encoding="utf-8")

    for expected in [
        "/notifications/push-public-key",
        "/notifications/push-subscriptions",
        "VAPID_PRIVATE_KEY",
        "VAPID_PUBLIC_KEY",
    ]:
        assert expected in api_docs or expected in readme
