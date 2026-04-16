"""Asset management endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Asset, User
from ..repository import get_asset_for_user, list_assets, record_activity, serialize_asset
from ..schemas import AssetListResponse, AssetUploadResponse, StatusResponse
from ..security import get_current_user, require_trusted_origin
from ..services.assets import get_model_metadata, get_ocel_metadata
from ..services.io import read_event_log, read_ocel
from ..services.logs import get_log_metadata
from ..storage import delete_file, save_upload


router = APIRouter(prefix="/api/assets", tags=["assets"])


@router.get("/logs", response_model=AssetListResponse)
def get_logs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """List uploaded event logs."""
    return {"assets": [serialize_asset(asset) for asset in list_assets(db, current_user, "log")], "status": "success"}


@router.get("/models", response_model=AssetListResponse)
def get_models(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """List uploaded process models."""
    return {"assets": [serialize_asset(asset) for asset in list_assets(db, current_user, "model")], "status": "success"}


@router.get("/ocels", response_model=AssetListResponse)
def get_ocels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """List uploaded OCELs."""
    return {"assets": [serialize_asset(asset) for asset in list_assets(db, current_user, "ocel")], "status": "success"}


def _create_asset(db: Session, current_user: User, kind: str, upload: UploadFile) -> dict:
    if not upload.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file selected")

    storage_path, stored_name = save_upload(kind, upload)
    try:
        if kind == "log":
            summary = get_log_metadata(read_event_log(storage_path), upload.filename)
        elif kind == "model":
            summary = get_model_metadata(storage_path, upload.filename)
        else:
            summary = get_ocel_metadata(read_ocel(storage_path), upload.filename)
    except Exception as exc:
        delete_file(storage_path)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    asset = Asset(
        owner_id=current_user.id,
        kind=kind,
        filename=upload.filename,
        stored_name=stored_name,
        storage_path=storage_path,
        summary=summary,
    )
    db.add(asset)
    db.flush()
    record_activity(
        db,
        current_user,
        f"{kind}.uploaded",
        {
            "filename": upload.filename,
            "asset_id": asset.id,
            "summary": {key: value for key, value in summary.items() if key != "original_columns"},
        },
    )
    db.commit()
    db.refresh(asset)
    return {"asset": serialize_asset(asset), "status": "success"}


@router.post("/logs", response_model=AssetUploadResponse, dependencies=[Depends(require_trusted_origin)])
def upload_log(
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Upload a new event log."""
    return _create_asset(db, current_user, "log", upload)


@router.post("/models", response_model=AssetUploadResponse, dependencies=[Depends(require_trusted_origin)])
def upload_model(
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Upload a new process model."""
    return _create_asset(db, current_user, "model", upload)


@router.post("/ocels", response_model=AssetUploadResponse, dependencies=[Depends(require_trusted_origin)])
def upload_ocel(
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Upload a new object-centric event log."""
    return _create_asset(db, current_user, "ocel", upload)


@router.delete("/{kind}/{asset_id}", response_model=StatusResponse, dependencies=[Depends(require_trusted_origin)])
def delete_asset_by_kind(
    kind: str,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a stored asset."""
    if kind not in {"log", "model", "ocel"}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown asset kind")

    asset = get_asset_for_user(db, current_user, asset_id, kind)
    delete_file(asset.storage_path)
    db.delete(asset)
    record_activity(db, current_user, f"{kind}.deleted", {"asset_id": asset.id, "filename": asset.filename})
    db.commit()
    return {"status": "success"}
