from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import OnboardingState, User
from app.schemas.api import OnboardingResponse, OnboardingUpdate

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _ensure_state(db: Session, user: User) -> OnboardingState:
    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    if state:
        return state
    state = OnboardingState(
        tenant_id=user.tenant_id,
        user_id=user.id,
        current_step="starter_workspace" if user.email_verified_at else "verify_email",
        completed_steps=["verify_email"] if user.email_verified_at else [],
        demo_viewed=False,
    )
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


@router.get("", response_model=OnboardingResponse)
def get_onboarding(user: User = Depends(current_user), db: Session = Depends(get_db)):
    state = _ensure_state(db, user)
    return OnboardingResponse(
        current_step=state.current_step,
        completed_steps=state.completed_steps,
        demo_viewed=state.demo_viewed,
        first_project_id=state.first_project_id,
    )


@router.patch("", response_model=OnboardingResponse)
def update_onboarding(payload: OnboardingUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    state = _ensure_state(db, user)
    state.current_step = payload.current_step
    state.completed_steps = payload.completed_steps
    state.demo_viewed = payload.demo_viewed
    state.first_project_id = payload.first_project_id
    state.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(state)
    return OnboardingResponse(
        current_step=state.current_step,
        completed_steps=state.completed_steps,
        demo_viewed=state.demo_viewed,
        first_project_id=state.first_project_id,
    )
