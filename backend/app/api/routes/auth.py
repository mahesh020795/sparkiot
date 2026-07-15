from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_secret, issue_refresh_token, refresh_token_digest, verify_secret
from app.models.domain import Notification, PasswordResetToken, RefreshToken, Tenant, User
from app.schemas.api import LoginRequest, PasswordResetConfirmRequest, PasswordResetRequest, RegisterRequest, StatusResponse, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_pair(db: Session, user: User, family_id: str | None = None) -> TokenResponse:
    settings = get_settings()
    refresh = issue_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=refresh_token_digest(refresh), family_id=family_id or str(uuid4()), expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days)))
    db.commit()
    return TokenResponse(access_token=create_access_token(user.id, user.tenant_id), refresh_token=refresh)


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail={"code": "duplicate_email", "message": "Email already exists"})
    tenant = Tenant(name=payload.tenant_name)
    db.add(tenant)
    db.flush()
    if db.scalar(select(User).where(User.tenant_id == tenant.id, User.is_active)):
        raise HTTPException(status_code=409, detail={"code": "plan_user_limit", "message": "Starter plan allows 1 active user"})
    user = User(tenant_id=tenant.id, email=payload.email.lower(), full_name=payload.full_name, password_hash=hash_secret(payload.password))
    db.add(user)
    db.flush()
    db.add(Notification(
        tenant_id=tenant.id,
        user_id=user.id,
        title="Welcome to Spark IoT",
        body="Starter workspace is ready. Create a project, choose a template, add your first board, then generate Arduino code.",
    ))
    db.commit()
    db.refresh(user)
    return _token_pair(db, user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_secret(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _token_pair(db, user)


@router.post("/password-reset/request", response_model=StatusResponse)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    message = "If the account exists, reset instructions are ready."
    if not user or not user.is_active:
        return StatusResponse(message=message)

    raw_token = issue_refresh_token()
    reset = PasswordResetToken(
        user_id=user.id,
        token_hash=refresh_token_digest(raw_token),
        expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )
    db.add(reset)
    db.add(Notification(
        tenant_id=user.tenant_id,
        user_id=user.id,
        title="Password reset requested",
        body="A password reset link was requested. Use the latest reset token within 30 minutes. If this was not you, rotate your account password.",
    ))
    db.commit()
    return StatusResponse(message=message, reset_token=raw_token)


@router.post("/password-reset/confirm", response_model=StatusResponse)
def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    record = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == refresh_token_digest(payload.token)))
    now = datetime.now(UTC)
    if not record or record.used_at is not None or record.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=400, detail={"code": "invalid_reset_token", "message": "Reset token is invalid or expired"})

    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail={"code": "invalid_reset_token", "message": "Reset token is invalid or expired"})

    user.password_hash = hash_secret(payload.password)
    record.used_at = now
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).update({"revoked": True})
    db.add(Notification(
        tenant_id=user.tenant_id,
        user_id=user.id,
        title="Password updated",
        body="Your Spark IoT password was changed. Existing sessions were signed out for safety.",
    ))
    db.commit()
    return StatusResponse(message="Password updated. Sign in with your new password.")


@router.post("/refresh", response_model=TokenResponse)
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == refresh_token_digest(refresh_token)))
    now = datetime.now(UTC)
    if not record or record.revoked or record.expires_at.replace(tzinfo=UTC) < now:
        if record:
            db.query(RefreshToken).filter(RefreshToken.family_id == record.family_id).update({"revoked": True})
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    record.revoked = True
    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid user")
    return _token_pair(db, user, record.family_id)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return UserResponse(id=user.id, tenant_id=user.tenant_id, email=user.email, full_name=user.full_name, plan_code=user.tenant.plan_code)
