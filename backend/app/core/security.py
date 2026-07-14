import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_secret(value: str) -> str:
    return pwd_context.hash(value)


def verify_secret(value: str, hashed: str) -> bool:
    return pwd_context.verify(value, hashed)


def issue_device_secret() -> str:
    return f"spk_{secrets.token_urlsafe(32)}"


def issue_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def refresh_token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, tenant_id: str, minutes: int | None = None) -> str:
    settings = get_settings()
    expires = datetime.now(UTC) + timedelta(minutes=minutes or settings.access_token_minutes)
    payload = {"sub": user_id, "tenant_id": tenant_id, "exp": expires, "typ": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, str]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid access token") from exc
    if payload.get("typ") != "access":
        raise ValueError("Invalid token type")
    return payload
