"""Database configuration and helpers."""
from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import MYSQL_TIMEOUT_SECONDS, settings


class Base(DeclarativeBase):
    """Base declarative model."""


def _is_sqlite_url(database_url: str) -> bool:
    return database_url.startswith("sqlite")


def _is_mysql_url(database_url: str) -> bool:
    return database_url.startswith("mysql+pymysql://")


def _ensure_sqlite_path(database_url: str) -> None:
    database_path = Path(make_url(database_url).database or "")
    if database_path:
        database_path.parent.mkdir(parents=True, exist_ok=True)


def _build_connect_args(database_url: str) -> dict[str, Any]:
    if _is_sqlite_url(database_url):
        return {"check_same_thread": False}

    if _is_mysql_url(database_url):
        return {
            "charset": "utf8mb4",
            "connect_timeout": MYSQL_TIMEOUT_SECONDS,
            "read_timeout": MYSQL_TIMEOUT_SECONDS,
            "write_timeout": MYSQL_TIMEOUT_SECONDS,
        }

    return {}


def _create_engine_instance(database_url: str):
    if _is_sqlite_url(database_url):
        _ensure_sqlite_path(database_url)
    return create_engine(
        database_url,
        connect_args=_build_connect_args(database_url),
        future=True,
        pool_pre_ping=not _is_sqlite_url(database_url),
    )


def _build_engine_with_fallback(preferred_url: str, fallback_url: str):
    if _is_sqlite_url(preferred_url):
        return _create_engine_instance(preferred_url), preferred_url

    preferred_engine = None
    try:
        preferred_engine = _create_engine_instance(preferred_url)
        with preferred_engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
        return preferred_engine, preferred_url
    except Exception as exc:
        if preferred_engine is not None:
            preferred_engine.dispose()
        fallback_engine = _create_engine_instance(fallback_url)
        print(f"Failed to connect to remote database ({exc}). Falling back to local SQLite at {fallback_url}.", flush=True)
        return fallback_engine, fallback_url


engine, database_url = _build_engine_with_fallback(settings.database_url, settings.local_database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def utc_now() -> datetime:
    """Return a timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create database tables."""
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
