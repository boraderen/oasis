"""File storage helpers."""
from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from .config import settings


KIND_DIRS = {
    "log": settings.asset_dir / "logs",
    "model": settings.asset_dir / "models",
    "ocel": settings.asset_dir / "ocels",
}


def ensure_storage() -> None:
    """Create required storage directories."""
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.asset_dir.mkdir(parents=True, exist_ok=True)
    for directory in KIND_DIRS.values():
        directory.mkdir(parents=True, exist_ok=True)


def save_upload(kind: str, upload: UploadFile) -> tuple[str, str]:
    """Persist an uploaded file and return the storage path and stored name."""
    if kind not in KIND_DIRS:
        raise ValueError(f"Unsupported storage kind: {kind}")

    suffix = Path(upload.filename or "").suffix.lower()
    stored_name = f"{uuid4().hex}{suffix}"
    output_path = KIND_DIRS[kind] / stored_name

    with output_path.open("wb") as output_stream:
        shutil.copyfileobj(upload.file, output_stream)

    return str(output_path), stored_name


def save_file_copy(kind: str, source_path: Path) -> tuple[str, str]:
    """Copy a local file into managed storage."""
    if kind not in KIND_DIRS:
        raise ValueError(f"Unsupported storage kind: {kind}")

    suffix = source_path.suffix.lower()
    stored_name = f"{uuid4().hex}{suffix}"
    output_path = KIND_DIRS[kind] / stored_name
    shutil.copyfile(source_path, output_path)
    return str(output_path), stored_name


def delete_file(path: str) -> None:
    """Delete a stored file if it still exists."""
    Path(path).unlink(missing_ok=True)
