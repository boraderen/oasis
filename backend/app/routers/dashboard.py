"""Dashboard, activity, and page-state endpoints."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends

from ..database import get_db
from ..models import Asset, User
from ..repository import load_page_states, recent_activity, upsert_page_state
from ..schemas import ActivityFeedResponse, DashboardSummaryResponse, PageStateRequest, PageStatesResponse, StatusResponse
from ..security import get_current_user, require_trusted_origin


router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Return summary counts for the current user's workspace."""
    counts = {}
    for kind in ("log", "model", "ocel"):
        counts[kind] = db.scalar(
            select(func.count()).select_from(Asset).where(Asset.owner_id == current_user.id, Asset.kind == kind)
        ) or 0

    return {"status": "success", "counts": counts}


@router.get("/activity", response_model=ActivityFeedResponse)
def activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Return the user's recent activity feed."""
    return {"status": "success", "items": recent_activity(db, current_user, limit=20)}


@router.get("/page-states", response_model=PageStatesResponse)
def get_page_states(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Load all persisted page states for the current user."""
    return {"status": "success", "states": load_page_states(db, current_user)}


@router.put("/page-states/{page_key}", response_model=StatusResponse, dependencies=[Depends(require_trusted_origin)])
def put_page_state(
    page_key: str,
    payload: PageStateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Persist page UI state."""
    upsert_page_state(db, current_user, page_key, payload.state)
    db.commit()
    return {"status": "success"}
