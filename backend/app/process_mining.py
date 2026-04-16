"""Compatibility facade for PM4Py-backed services."""
from __future__ import annotations

from .services.assets import get_model_metadata, get_ocel_metadata
from .services.autopm import run_autopm
from .services.conformance import (
    compute_custom_alignment,
    conformance_log_log,
    conformance_log_model,
    conformance_model_model,
)
from .services.dfg import build_variant_summary, render_log_dfgs, update_log_dfg
from .services.discovery import discover_process_model, discover_with_algorithm
from .services.evaluation import calculate_conformance_metrics, ensure_petri
from .services.io import read_event_log, read_ocel, read_process_model
from .services.logs import (
    build_log_exploration,
    first_rows,
    get_log_insights,
    get_log_metadata,
    get_original_columns,
    render_log_visualizations,
    update_log_distribution,
)
from .services.ocel import discover_ocpm, explore_ocel, update_ocel_distribution

__all__ = [
    "build_log_exploration",
    "build_variant_summary",
    "calculate_conformance_metrics",
    "compute_custom_alignment",
    "conformance_log_log",
    "conformance_log_model",
    "conformance_model_model",
    "discover_ocpm",
    "discover_process_model",
    "discover_with_algorithm",
    "ensure_petri",
    "explore_ocel",
    "first_rows",
    "get_log_insights",
    "get_log_metadata",
    "get_model_metadata",
    "get_ocel_metadata",
    "get_original_columns",
    "read_event_log",
    "read_ocel",
    "read_process_model",
    "render_log_dfgs",
    "render_log_visualizations",
    "run_autopm",
    "update_log_dfg",
    "update_log_distribution",
    "update_ocel_distribution",
]
