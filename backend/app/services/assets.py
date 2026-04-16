"""Asset metadata helpers."""
from __future__ import annotations

from typing import Any

import pm4py

from .io import read_ocel, read_process_model


def get_model_metadata(path: str, filename: str) -> dict[str, Any]:
    """Summarize a process model."""
    model, model_type = read_process_model(path)
    if isinstance(model, tuple) and len(model) == 3:
        net, _, _ = model
    else:
        net, _, _ = pm4py.convert_to_petri_net(model)
    return {
        "filename": filename,
        "model_type": model_type,
        "num_places": len(net.places),
        "num_transitions": len(net.transitions),
        "num_arcs": len(net.arcs),
    }


def get_ocel_metadata(ocel: Any, filename: str) -> dict[str, Any]:
    """Summarize an OCEL."""
    object_types = list(ocel.objects["ocel:type"].unique()) if "ocel:type" in ocel.objects.columns else []
    return {
        "filename": filename,
        "num_events": len(ocel.events),
        "num_objects": len(ocel.objects),
        "object_types": object_types,
    }


def read_and_summarize_ocel(path: str, filename: str) -> tuple[Any, dict[str, Any]]:
    """Load an OCEL and its metadata together."""
    ocel = read_ocel(path)
    return ocel, get_ocel_metadata(ocel, filename)
