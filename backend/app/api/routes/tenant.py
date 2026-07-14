from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import User
from app.schemas.api import UsageResponse
from app.services.plans import usage

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("/usage", response_model=UsageResponse)
def get_usage(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return usage(db, user.tenant_id)
