"""Object-centric process mining services."""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from pathlib import Path
from typing import Any, Optional

import pandas as pd
import pm4py

from .assets import get_ocel_metadata
from .common import VALID_DISTRIBUTIONS, footprint_to_matrix, render_svg, render_text_file, serialize_value
from .dfg import render_log_dfgs
from .io import read_ocel
from .logs import build_log_visualization_data, first_rows, get_log_insights


def build_object_graph(ocel: Any) -> Optional[str]:
    """Render an object interaction graph when PM4Py can produce it in time."""
    def _render() -> str:
        return render_svg(
            lambda output_path: pm4py.save_vis_object_graph(
                ocel,
                pm4py.discover_objects_graph(ocel, graph_type="object_interaction"),
                output_path,
            )
        )

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_render)
        try:
            return future.result(timeout=10)
        except TimeoutError:
            future.cancel()
            return None
        except Exception:
            return None


def _ocel_event_rows(table: pd.DataFrame, limit: int = 100) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for _, row in table.head(limit).iterrows():
        record: dict[str, Any] = {}
        for column in table.columns:
            value = row.get(column, "")
            if isinstance(value, (list, set)):
                record[column] = [serialize_value(item) for item in value]
            else:
                record[column] = serialize_value(value)
        rows.append(record)
    return rows


def _safe_filename_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip())
    cleaned = cleaned.strip("-")
    return cleaned or "export"


def _normalize_ocpn_key(value: Any) -> Any:
    if isinstance(value, tuple):
        return [_normalize_ocpn_key(item) for item in value]
    if isinstance(value, set):
        return sorted((_normalize_ocpn_key(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _normalize_ocpn_value(value: Any) -> Any:
    if isinstance(value, dict):
        if all(isinstance(key, (str, int, float, bool)) or key is None for key in value):
            return {str(key): _normalize_ocpn_value(item) for key, item in value.items()}
        return [
            {
                "key": _normalize_ocpn_key(key),
                "value": _normalize_ocpn_value(item),
            }
            for key, item in value.items()
        ]
    if isinstance(value, tuple):
        return [_normalize_ocpn_value(item) for item in value]
    if isinstance(value, set):
        return sorted((_normalize_ocpn_value(item) for item in value), key=lambda item: json.dumps(item, sort_keys=True))
    if isinstance(value, list):
        return [_normalize_ocpn_value(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _build_ocpn_export(model: dict[str, Any], filename: str, variant: str) -> tuple[str, str]:
    """Serialize an OCPN into a single downloadable JSON export."""
    petri_nets: dict[str, Any] = {}
    for object_type, petri_net_parts in model.get("petri_nets", {}).items():
        net, initial_marking, final_marking = petri_net_parts
        petri_nets[str(object_type)] = {
            "pnml": render_text_file(
                lambda output_path, net=net, initial_marking=initial_marking, final_marking=final_marking: pm4py.write_pnml(
                    net,
                    initial_marking,
                    final_marking,
                    output_path,
                ),
                ".pnml",
            ),
            "num_places": len(net.places),
            "num_transitions": len(net.transitions),
            "num_arcs": len(net.arcs),
        }

    export_payload = {
        "format": "oasis-ocpn-json",
        "variant": variant,
        "source_filename": filename,
        "activities": sorted(str(activity) for activity in model.get("activities", set())),
        "object_types": sorted(str(object_type) for object_type in model.get("object_types", set())),
        "edges": _normalize_ocpn_value(model.get("edges", {})),
        "activities_indep": _normalize_ocpn_value(model.get("activities_indep", {})),
        "activities_ot": _normalize_ocpn_value(model.get("activities_ot", {})),
        "start_activities": _normalize_ocpn_value(model.get("start_activities", {})),
        "end_activities": _normalize_ocpn_value(model.get("end_activities", {})),
        "edges_performance": _normalize_ocpn_value(model.get("edges_performance", {})),
        "double_arcs_on_activity": _normalize_ocpn_value(model.get("double_arcs_on_activity", {})),
        "petri_nets": petri_nets,
    }

    base_name = Path(filename).stem or "ocpn"
    export_filename = f"{_safe_filename_part(base_name)}-{variant}.ocpn.json"
    return json.dumps(export_payload, ensure_ascii=True, indent=2), export_filename


def update_ocel_distribution(path: str, object_type: str, distribution_type: str) -> dict[str, Any]:
    """Regenerate an OCEL flattened distribution chart."""
    if distribution_type not in VALID_DISTRIBUTIONS:
        raise ValueError(f"Distribution type must be one of {', '.join(VALID_DISTRIBUTIONS)}.")
    ocel = read_ocel(path)
    flattened = pm4py.ocel_flattening(ocel, object_type)
    svg = render_svg(
        lambda output_path: pm4py.save_vis_events_distribution_graph(flattened, output_path, distr_type=distribution_type)
    )
    return {"message": "Distribution updated", "event_distribution_svg": svg, "status": "success"}


def explore_ocel(path: str, filename: str) -> dict[str, Any]:
    """Generate OCEL exploration output."""
    from pm4py.algo.transformation.ocel.split_ocel import algorithm as split_ocel_algorithm

    ocel = read_ocel(path)
    metadata = get_ocel_metadata(ocel, filename)
    ocdfg_svg = render_svg(lambda output_path: pm4py.save_vis_ocdfg(pm4py.discover_ocdfg(ocel), output_path))
    object_graph_svg = build_object_graph(ocel)

    object_types = metadata["object_types"]
    activities = list(ocel.events["ocel:activity"].unique()) if "ocel:activity" in ocel.events.columns else []
    object_type_counts = ocel.objects["ocel:type"].value_counts().to_dict() if "ocel:type" in ocel.objects.columns else {}
    activity_counts = ocel.events["ocel:activity"].value_counts().to_dict() if "ocel:activity" in ocel.events.columns else {}
    activity_durations = {}
    if "ocel:activity" in ocel.events.columns:
        from .logs import _durations_for_activity  # local import to avoid exporting a low-level helper

        activity_durations = _durations_for_activity(ocel.events, "ocel:activity", "ocel:timestamp")

    activity_case_counts: dict[str, int] = {}
    num_cases = 0
    if "ocel:activity" in ocel.events.columns and not ocel.relations.empty:
        try:
            connected_components = split_ocel_algorithm.apply(
                ocel,
                variant=split_ocel_algorithm.Variants.CONNECTED_COMPONENTS,
            )
            num_cases = len(connected_components)
            for component in connected_components:
                component_activities = set(component.events["ocel:activity"].dropna().astype(str).unique().tolist())
                for activity in component_activities:
                    activity_case_counts[activity] = activity_case_counts.get(activity, 0) + 1
        except Exception:
            num_cases = 0

    try:
        extended_table = ocel.get_extended_table()
        extended_rows = _ocel_event_rows(extended_table)
        extended_columns = list(extended_table.columns)
    except Exception:
        extended_rows = _ocel_event_rows(ocel.events)
        extended_columns = list(ocel.events.columns)

    object_type_data: dict[str, Any] = {}
    for object_type in object_types:
        try:
            flattened_log = pm4py.ocel_flattening(ocel, object_type)
            original_columns = list(flattened_log.columns)
            regular_svg, performance_svg = render_log_dfgs(flattened_log)

            object_type_data[object_type] = {
                "regular_dfg_svg": regular_svg,
                "performance_dfg_svg": performance_svg,
                "insights": get_log_insights(flattened_log),
                "preview_events": first_rows(flattened_log, original_columns),
                "first_20_events": first_rows(flattened_log, original_columns),
                "flattened_columns": original_columns,
                "footprint_matrix": footprint_to_matrix(pm4py.discover_footprints(flattened_log)),
                "visualization_data": build_log_visualization_data(flattened_log),
            }
        except Exception:
            object_type_data[object_type] = None

    return {
        "message": "OCEL exploration completed successfully",
        "status": "success",
        "ocdfg_svg_content": ocdfg_svg,
        "object_graph_svg_content": object_graph_svg,
        "ocel_metadata": metadata,
        "num_events": metadata["num_events"],
        "num_cases": num_cases,
        "num_objects": metadata["num_objects"],
        "num_activities": len(activities),
        "object_types": object_types,
        "object_type_counts": object_type_counts,
        "activities": activities,
        "activity_counts": activity_counts,
        "activity_case_counts": activity_case_counts,
        "activity_durations": activity_durations,
        "extended_table_rows": extended_rows,
        "table_columns": extended_columns,
        "object_type_data": object_type_data,
    }


def flatten_ocel_to_event_log(path: str, filename: str, object_type: str) -> dict[str, Any]:
    """Flatten an OCEL for one object type and export the result as XES."""
    ocel = read_ocel(path)
    available_object_types = sorted(ocel.objects["ocel:type"].astype(str).unique().tolist()) if "ocel:type" in ocel.objects.columns else []
    if object_type not in available_object_types:
        raise ValueError(f"Object type must be one of {', '.join(available_object_types)}.")

    flattened_log = pm4py.ocel_flattening(ocel, object_type)
    xes_content = render_text_file(lambda output_path: pm4py.write_xes(flattened_log, output_path), ".xes")
    base_name = Path(filename).stem or "flattened-log"
    export_filename = f"{_safe_filename_part(base_name)}-{_safe_filename_part(object_type)}.xes"

    return {
        "message": f"Flattened {object_type} into a traditional event log",
        "status": "success",
        "filename": export_filename,
        "object_type": object_type,
        "num_events": int(len(flattened_log)),
        "num_cases": int(flattened_log["case:concept:name"].nunique()) if "case:concept:name" in flattened_log.columns else 0,
        "xes_content": xes_content,
    }


def discover_ocpm(path: str, filename: str, variant: str) -> dict[str, Any]:
    """Discover an object-centric Petri net."""
    if variant not in {"im", "imd"}:
        raise ValueError("OCPM discovery variant must be 'im' or 'imd'.")
    ocel = read_ocel(path)
    model = pm4py.discover_oc_petri_net(ocel, diagnostics_with_tbr=True, inductive_miner_variant=variant)
    svg_content = render_svg(lambda output_path: pm4py.save_vis_ocpn(model, output_path))
    ocpn_content, ocpn_filename = _build_ocpn_export(model, filename, variant)

    return {
        "message": f"OCPM {variant.upper()} discovery completed",
        "status": "success",
        "svg_content": svg_content,
        "ocpn_content": ocpn_content,
        "ocpn_filename": ocpn_filename,
        "ocel_metadata": get_ocel_metadata(ocel, filename),
    }
