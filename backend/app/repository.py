"""Persistence helpers shared by routers."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException, status
from sqlalchemy import Select, desc, select
from sqlalchemy.orm import Session

from .models import ActivityLog, Asset, PageState, User


def serialize_user(user: User) -> dict[str, Any]:
    """Convert a user model into a response-safe shape."""
    return {
        "id": user.id,
        "username": user.username,
        "is_guest": user.is_guest,
        "created_at": user.created_at.isoformat(),
    }


def serialize_asset(asset: Asset) -> dict[str, Any]:
    """Convert an asset row into a frontend-friendly shape."""
    return {
        "id": asset.id,
        "kind": asset.kind,
        "filename": asset.filename,
        "created_at": asset.created_at.isoformat(),
        **asset.summary,
    }


def record_activity(db: Session, user: User, action: str, details: dict[str, Any]) -> ActivityLog:
    """Insert a new activity log entry."""
    activity = ActivityLog(owner_id=user.id, action=action, details=details)
    db.add(activity)
    db.flush()
    return activity


def get_asset_for_user(db: Session, user: User, asset_id: int, kind: Optional[str] = None) -> Asset:
    """Fetch an asset owned by the current user."""
    statement: Select[tuple[Asset]] = select(Asset).where(Asset.id == asset_id, Asset.owner_id == user.id)
    if kind:
        statement = statement.where(Asset.kind == kind)

    asset = db.scalar(statement)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return asset


def list_assets(db: Session, user: User, kind: str) -> list[Asset]:
    """List all assets of a given kind for the current user."""
    statement = select(Asset).where(Asset.owner_id == user.id, Asset.kind == kind).order_by(Asset.created_at.asc())
    return list(db.scalars(statement).all())


def upsert_page_state(db: Session, user: User, page_key: str, state: dict[str, Any]) -> PageState:
    """Create or update a page state document."""
    page_state = db.scalar(
        select(PageState).where(PageState.owner_id == user.id, PageState.page_key == page_key)
    )
    if page_state:
        page_state.state = state
    else:
        page_state = PageState(owner_id=user.id, page_key=page_key, state=state)
        db.add(page_state)
    db.flush()
    return page_state


def load_page_states(db: Session, user: User) -> dict[str, Any]:
    """Return all persisted page states for the current user."""
    statement = select(PageState).where(PageState.owner_id == user.id)
    return {item.page_key: item.state for item in db.scalars(statement).all()}


def recent_activity(db: Session, user: User, limit: int = 12) -> list[dict[str, Any]]:
    """Return recent activity entries for the current user."""
    statement = (
        select(ActivityLog)
        .where(ActivityLog.owner_id == user.id)
        .order_by(desc(ActivityLog.created_at))
        .limit(limit)
    )
    return [
        {
            "id": item.id,
            "action": item.action,
            "details": item.details,
            "created_at": item.created_at.isoformat(),
        }
        for item in db.scalars(statement).all()
    ]
