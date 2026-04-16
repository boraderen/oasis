"""Authentication endpoints."""
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db, utc_now
from ..default_assets import ensure_default_assets
from ..models import User
from ..repository import serialize_user
from ..schemas import AuthRequest, AuthResponse, StatusResponse
from ..security import (
    create_session_token,
    apply_session_cookie,
    clear_session_cookie,
    get_current_user,
    hash_password,
    require_trusted_origin,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_response(user: User) -> dict:
    """Serialize the authenticated user and issue a bearer token."""
    return {
        "user": serialize_user(user),
        "status": "success",
        "access_token": create_session_token(user.id),
        "token_type": "bearer",
    }


@router.post("/register", response_model=AuthResponse, dependencies=[Depends(require_trusted_origin)])
def register(payload: AuthRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    """Create a new named user account."""
    existing = db.scalar(select(User).where(User.username == payload.username))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    user = User(username=payload.username, password_hash=hash_password(payload.password), is_guest=False, last_login_at=utc_now())
    db.add(user)
    db.flush()
    ensure_default_assets(db, user)
    db.commit()
    db.refresh(user)
    apply_session_cookie(response, user)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse, dependencies=[Depends(require_trusted_origin)])
def login(payload: AuthRequest, response: Response, db: Session = Depends(get_db)) -> dict:
    """Authenticate a named user account."""
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    user.last_login_at = utc_now()
    ensure_default_assets(db, user)
    db.commit()
    db.refresh(user)
    apply_session_cookie(response, user)
    return _auth_response(user)


@router.post("/guest", response_model=AuthResponse, dependencies=[Depends(require_trusted_origin)])
def login_as_guest(response: Response, db: Session = Depends(get_db)) -> dict:
    """Create a fresh guest account and sign in."""
    username = f"guest-{uuid4().hex[:8]}"
    user = User(username=username, password_hash=None, is_guest=True, last_login_at=utc_now())
    db.add(user)
    db.flush()
    ensure_default_assets(db, user)
    db.commit()
    db.refresh(user)
    apply_session_cookie(response, user)
    return _auth_response(user)


@router.post("/logout", response_model=StatusResponse, dependencies=[Depends(require_trusted_origin)])
def logout(response: Response) -> dict:
    """Remove the active session."""
    clear_session_cookie(response)
    return {"status": "success"}


@router.get("/me", response_model=AuthResponse)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Return the active user."""
    if ensure_default_assets(db, current_user):
        db.commit()
        db.refresh(current_user)
    return {"user": serialize_user(current_user), "status": "success"}
