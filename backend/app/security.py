"""Authentication helpers."""
from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db, utc_now
from .models import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password."""
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    """Verify a password against a stored hash."""
    if not password_hash:
        return False
    return pwd_context.verify(password, password_hash)


def create_session_token(user_id: int) -> str:
    """Create a signed session token."""
    expires_at = utc_now() + timedelta(minutes=settings.session_duration_minutes)
    payload = {"sub": str(user_id), "exp": expires_at}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def apply_session_cookie(response: Response, user: User) -> None:
    """Set the authenticated session cookie on the response."""
    token = create_session_token(user.id)
    cookie_options = {
        "key": settings.session_cookie_name,
        "value": token,
        "httponly": True,
        "path": "/",
        "samesite": settings.session_cookie_samesite,
        "secure": settings.session_cookie_secure,
        "max_age": settings.session_duration_minutes * 60,
    }
    if settings.session_cookie_domain:
        cookie_options["domain"] = settings.session_cookie_domain
    response.set_cookie(**cookie_options)


def clear_session_cookie(response: Response) -> None:
    """Clear the authenticated session cookie."""
    delete_options = {
        "key": settings.session_cookie_name,
        "path": "/",
    }
    if settings.session_cookie_domain:
        delete_options["domain"] = settings.session_cookie_domain
    response.delete_cookie(**delete_options)


def _resolve_session_token(
    authorization: Optional[str] = Header(default=None),
    session_token: Optional[str] = Cookie(default=None, alias=settings.session_cookie_name),
) -> str:
    """Prefer bearer tokens but still accept the legacy session cookie."""
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header")
        return token.strip()

    if session_token:
        return session_token

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def require_trusted_origin(request: Request) -> None:
    """Reject mutating browser requests from untrusted origins."""
    origin = request.headers.get("origin")
    if not origin:
        return

    normalized = origin.rstrip("/")
    trusted_origins = {item.rstrip("/") for item in settings.csrf_trusted_origins}
    if normalized not in trusted_origins:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Untrusted request origin")


def get_current_user(
    session_token: str = Depends(_resolve_session_token),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user from the session cookie."""
    try:
        payload = jwt.decode(session_token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown user")

    return user
