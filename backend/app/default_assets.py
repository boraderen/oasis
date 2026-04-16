"""Seed bundled assets for user workspaces."""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import BASE_DIR
from .models import Asset, User
from .services.assets import get_model_metadata, get_ocel_metadata
from .services.io import SUPPORTED_LOG_SUFFIXES, SUPPORTED_MODEL_SUFFIXES, SUPPORTED_OCEL_SUFFIXES, read_event_log, read_ocel
from .services.logs import get_log_metadata
from .storage import delete_file, save_file_copy


DEFAULT_ASSET_DIR = BASE_DIR / "default_assets"
DEFAULT_LOG_DIR = DEFAULT_ASSET_DIR / "logs"
DEFAULT_MODEL_DIR = DEFAULT_ASSET_DIR / "models"


def _infer_asset_kind(source: Path) -> str | None:
    suffix = source.suffix.lower()
    if suffix in SUPPORTED_MODEL_SUFFIXES:
        return "model"
    if suffix in SUPPORTED_LOG_SUFFIXES:
        return "log"
    if suffix in SUPPORTED_OCEL_SUFFIXES:
        return "ocel"
    return None


def _iter_default_assets() -> Iterator[tuple[str, Path, str]]:
    for directory in (DEFAULT_LOG_DIR, DEFAULT_MODEL_DIR):
        if not directory.exists():
            continue

        for source in sorted((path for path in directory.iterdir() if path.is_file()), key=lambda path: path.name.lower()):
            kind = _infer_asset_kind(source)
            if kind is None:
                continue
            yield kind, source, source.name


def _build_summary(kind: str, storage_path: str, filename: str) -> dict:
    if kind == "log":
        return get_log_metadata(read_event_log(storage_path), filename)
    if kind == "model":
        return get_model_metadata(storage_path, filename)
    return get_ocel_metadata(read_ocel(storage_path), filename)


def ensure_default_assets(db: Session, user: User) -> bool:
    """Copy bundled starter assets into a user's workspace if they are missing."""
    seeded_any = False

    for kind, source_path, filename in _iter_default_assets():
        existing = db.scalar(
            select(Asset).where(Asset.owner_id == user.id, Asset.kind == kind, Asset.filename == filename)
        )
        if existing:
            continue

        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"Missing bundled asset: {source}")

        storage_path, stored_name = save_file_copy(kind, source)
        try:
            summary = _build_summary(kind, storage_path, filename)
        except Exception:
            delete_file(storage_path)
            raise

        db.add(
            Asset(
                owner_id=user.id,
                kind=kind,
                filename=filename,
                stored_name=stored_name,
                storage_path=storage_path,
                summary=summary,
            )
        )
        seeded_any = True

    if seeded_any:
        db.flush()
    return seeded_any
