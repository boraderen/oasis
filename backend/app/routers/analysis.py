"""Process mining analysis endpoints."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..repository import get_asset_for_user, record_activity
from ..schemas import (
    AutoPMRequest,
    AutoPMResponse,
    ConformanceResultResponse,
    CustomTraceRequest,
    CustomTraceDiagnosticsModel,
    DfgUpdateResponse,
    DistributionRequest,
    DfgFilterRequest,
    DiscoveryResultResponse,
    DistributionResponse,
    LogLogConformanceRequest,
    LogExplorationResponse,
    LogModelConformanceRequest,
    ModelModelConformanceRequest,
    OCPMDiscoveryResponse,
    OcelFlattenRequest,
    OcelFlattenResponse,
    OcelExplorationResponse,
    OcelDistributionRequest,
)
from ..security import get_current_user, require_trusted_origin
from ..services.autopm import run_autopm
from ..services.conformance import (
    compute_custom_alignment,
    conformance_log_log,
    conformance_log_model,
    conformance_model_model,
)
from ..services.dfg import update_log_dfg
from ..services.discovery import discover_process_model
from ..services.logs import build_log_exploration, update_log_distribution
from ..services.ocel import discover_ocpm, explore_ocel, flatten_ocel_to_event_log, update_ocel_distribution


router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _to_http_error(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/logs/{asset_id}/exploration", response_model=LogExplorationResponse, dependencies=[Depends(require_trusted_origin)])
def explore_log_endpoint(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Explore an uploaded event log."""
    asset = get_asset_for_user(db, current_user, asset_id, "log")
    try:
        result = build_log_exploration(asset.storage_path, asset.filename)
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(db, current_user, "log.explored", {"asset_id": asset.id, "filename": asset.filename})
    db.commit()
    return result


@router.post("/logs/{asset_id}/dfg", response_model=DfgUpdateResponse, dependencies=[Depends(require_trusted_origin)])
def update_dfg_endpoint(
    asset_id: int,
    payload: DfgFilterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update the active DFG filters."""
    asset = get_asset_for_user(db, current_user, asset_id, "log")
    try:
        return update_log_dfg(
            asset.storage_path,
            payload.selected_activities,
            payload.variant_mode,
            payload.selected_variants,
            payload.top_variant_percentage,
        )
    except Exception as exc:
        raise _to_http_error(exc) from exc


@router.post("/logs/{asset_id}/distribution", response_model=DistributionResponse, dependencies=[Depends(require_trusted_origin)])
def update_distribution_endpoint(
    asset_id: int,
    payload: DistributionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update an event log distribution chart."""
    asset = get_asset_for_user(db, current_user, asset_id, "log")
    try:
        return update_log_distribution(asset.storage_path, payload.distribution_type)
    except Exception as exc:
        raise _to_http_error(exc) from exc


@router.post("/logs/{asset_id}/discover/{algorithm}", response_model=DiscoveryResultResponse, dependencies=[Depends(require_trusted_origin)])
def discover_endpoint(
    asset_id: int,
    algorithm: str,
    payload: Optional[dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Run one of the classic discovery algorithms."""
    asset = get_asset_for_user(db, current_user, asset_id, "log")
    try:
        result = discover_process_model(asset.storage_path, asset.filename, algorithm, payload or {})
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        f"discovery.{algorithm}",
        {"asset_id": asset.id, "filename": asset.filename, "parameters": payload or {}},
    )
    db.commit()
    return result


@router.post("/conformance/log-log", response_model=ConformanceResultResponse, dependencies=[Depends(require_trusted_origin)])
def conformance_logs(
    payload: LogLogConformanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Compare two uploaded event logs."""
    first_asset = get_asset_for_user(db, current_user, payload.first_log_id, "log")
    second_asset = get_asset_for_user(db, current_user, payload.second_log_id, "log")
    try:
        result = conformance_log_log(
            first_asset.storage_path,
            first_asset.filename,
            second_asset.storage_path,
            second_asset.filename,
        )
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "conformance.log-log",
        {"first_log_id": first_asset.id, "second_log_id": second_asset.id},
    )
    db.commit()
    return result


@router.post("/conformance/log-model", response_model=ConformanceResultResponse, dependencies=[Depends(require_trusted_origin)])
def conformance_log_and_model(
    payload: LogModelConformanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Compare a log and a model."""
    log_asset = get_asset_for_user(db, current_user, payload.log_id, "log")
    model_asset = get_asset_for_user(db, current_user, payload.model_id, "model")
    try:
        result = conformance_log_model(
            log_asset.storage_path,
            log_asset.filename,
            model_asset.storage_path,
            model_asset.filename,
        )
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "conformance.log-model",
        {"log_id": log_asset.id, "model_id": model_asset.id},
    )
    db.commit()
    return result


@router.post("/conformance/custom-trace", response_model=CustomTraceDiagnosticsModel, dependencies=[Depends(require_trusted_origin)])
def custom_trace_alignment(
    payload: CustomTraceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Compute diagnostics for a custom trace against a selected model."""
    log_asset = get_asset_for_user(db, current_user, payload.log_id, "log")
    model_asset = get_asset_for_user(db, current_user, payload.model_id, "model")
    try:
        result = compute_custom_alignment(log_asset.storage_path, model_asset.storage_path, payload.trace_activities)
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "conformance.custom-trace",
        {"log_id": log_asset.id, "model_id": model_asset.id, "length": len(payload.trace_activities)},
    )
    db.commit()
    return result


@router.post("/conformance/model-model", response_model=ConformanceResultResponse, dependencies=[Depends(require_trusted_origin)])
def conformance_models(
    payload: ModelModelConformanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Compare two uploaded models."""
    first_asset = get_asset_for_user(db, current_user, payload.first_model_id, "model")
    second_asset = get_asset_for_user(db, current_user, payload.second_model_id, "model")
    try:
        result = conformance_model_model(
            first_asset.storage_path,
            first_asset.filename,
            second_asset.storage_path,
            second_asset.filename,
        )
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "conformance.model-model",
        {"first_model_id": first_asset.id, "second_model_id": second_asset.id},
    )
    db.commit()
    return result


@router.post("/ocels/{asset_id}/exploration", response_model=OcelExplorationResponse, dependencies=[Depends(require_trusted_origin)])
def explore_ocel_endpoint(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Explore an uploaded OCEL."""
    asset = get_asset_for_user(db, current_user, asset_id, "ocel")
    try:
        result = explore_ocel(asset.storage_path, asset.filename)
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(db, current_user, "ocel.explored", {"asset_id": asset.id, "filename": asset.filename})
    db.commit()
    return result


@router.post("/ocels/{asset_id}/distribution", response_model=DistributionResponse, dependencies=[Depends(require_trusted_origin)])
def update_ocel_distribution_endpoint(
    asset_id: int,
    payload: OcelDistributionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Update an OCEL flattened event distribution chart."""
    asset = get_asset_for_user(db, current_user, asset_id, "ocel")
    try:
        return update_ocel_distribution(asset.storage_path, payload.object_type, payload.distribution_type)
    except Exception as exc:
        raise _to_http_error(exc) from exc


@router.post("/ocels/{asset_id}/discover/{variant}", response_model=OCPMDiscoveryResponse, dependencies=[Depends(require_trusted_origin)])
def discover_ocpm_endpoint(
    asset_id: int,
    variant: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Run object-centric process discovery."""
    asset = get_asset_for_user(db, current_user, asset_id, "ocel")
    try:
        result = discover_ocpm(asset.storage_path, asset.filename, variant)
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(db, current_user, f"ocpm.{variant}", {"asset_id": asset.id, "filename": asset.filename})
    db.commit()
    return result


@router.post("/ocels/{asset_id}/flatten", response_model=OcelFlattenResponse, dependencies=[Depends(require_trusted_origin)])
def flatten_ocel_endpoint(
    asset_id: int,
    payload: OcelFlattenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Flatten an OCEL for one object type and export the resulting traditional log."""
    asset = get_asset_for_user(db, current_user, asset_id, "ocel")
    try:
        result = flatten_ocel_to_event_log(asset.storage_path, asset.filename, payload.object_type)
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "ocel.flatten",
        {"asset_id": asset.id, "filename": asset.filename, "object_type": payload.object_type},
    )
    db.commit()
    return result


@router.post("/autopm", response_model=AutoPMResponse, dependencies=[Depends(require_trusted_origin)])
def autopm_endpoint(
    payload: AutoPMRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Run the AutoPM optimizer."""
    asset = get_asset_for_user(db, current_user, payload.log_id, "log")
    try:
        result = run_autopm(
            asset.storage_path,
            asset.filename,
            payload.selected_algorithms,
            payload.search_space_technique,
            payload.optimization_rounds,
            payload.cross_validation_folds,
            payload.optimization_metric,
        )
    except Exception as exc:
        raise _to_http_error(exc) from exc

    record_activity(
        db,
        current_user,
        "autopm.run",
        {
            "log_id": asset.id,
            "algorithms": payload.selected_algorithms,
            "metric": payload.optimization_metric,
            "rounds": payload.optimization_rounds,
            "folds": payload.cross_validation_folds,
        },
    )
    db.commit()
    return result
