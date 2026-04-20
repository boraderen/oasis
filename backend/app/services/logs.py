"""Event log metadata and exploration services."""
from __future__ import annotations

import statistics
from typing import Any

import pandas as pd
import pm4py

from .common import VALID_DISTRIBUTIONS, footprint_to_matrix, render_svg, serialize_value
from .dfg import build_variant_summary, render_log_dfgs
from .io import read_event_log


def get_original_columns(log: pd.DataFrame) -> list[str]:
    """Return the columns users should see in preview tables."""
    original_columns: list[str] = []
    for column in log.columns:
        if column == "start_timestamp" and "time:timestamp" in log.columns:
            try:
                if log["start_timestamp"].equals(log["time:timestamp"]):
                    continue
            except Exception:
                pass
        original_columns.append(column)
    return original_columns


def get_log_metadata(log: pd.DataFrame, filename: str) -> dict[str, Any]:
    """Summarize an event log."""
    return {
        "filename": filename,
        "num_events": len(log),
        "num_cases": int(log["case:concept:name"].nunique()),
        "num_activities": int(log["concept:name"].nunique()),
        "original_columns": get_original_columns(log),
    }


def _durations_for_activity(events: pd.DataFrame, activity_key: str, timestamp_key: str = "time:timestamp") -> dict[str, dict[str, float]]:
    normalized_events = events
    has_start_timestamp = "start_timestamp" in events.columns
    if has_start_timestamp:
        normalized_events = events.copy()
        normalized_events[timestamp_key] = pd.to_datetime(normalized_events[timestamp_key], errors="coerce", utc=True)
        normalized_events["start_timestamp"] = pd.to_datetime(
            normalized_events["start_timestamp"],
            errors="coerce",
            utc=True,
        )

    durations: dict[str, dict[str, float]] = {}
    activities = normalized_events[activity_key].dropna().astype(str).unique()

    for activity in activities:
        activity_events = normalized_events[normalized_events[activity_key].astype(str) == activity]
        values: list[float] = []
        if has_start_timestamp:
            for _, event in activity_events.iterrows():
                try:
                    duration = (event[timestamp_key] - event["start_timestamp"]).total_seconds()
                except Exception:
                    continue
                if duration >= 0:
                    values.append(duration)

        if values:
            durations[activity] = {
                "avg": round(statistics.mean(values), 2),
                "min": round(min(values), 2),
                "max": round(max(values), 2),
                "median": round(statistics.median(values), 2),
            }
        else:
            durations[activity] = {"avg": 0, "min": 0, "max": 0, "median": 0}
    return durations


def _safe_metric_value(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    if pd.isna(numeric):
        return 0.0
    return round(numeric, 2)


def _serialize_regular_dfg(edges: dict[tuple[str, str], int]) -> list[dict[str, Any]]:
    serialized = [
        {
            "source": source,
            "target": target,
            "count": int(count),
        }
        for (source, target), count in edges.items()
    ]
    serialized.sort(key=lambda item: (-item["count"], item["source"], item["target"]))
    return serialized


def _serialize_performance_edges(metrics: dict[tuple[str, str], dict[str, Any]], occurrences: dict[tuple[str, str], int]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    for (source, target), values in metrics.items():
        count = int(occurrences.get((source, target), 0))
        if count <= 0:
            continue
        edges.append(
            {
                "source": source,
                "target": target,
                "mean": _safe_metric_value(values.get("mean", 0.0)),
                "median": _safe_metric_value(values.get("median", 0.0)),
                "max": _safe_metric_value(values.get("max", 0.0)),
                "min": _safe_metric_value(values.get("min", 0.0)),
                "sum": _safe_metric_value(values.get("sum", 0.0)),
                "stdev": _safe_metric_value(values.get("stdev", 0.0)),
                "occurrences": count,
            }
        )
    edges.sort(key=lambda item: (-item["mean"], -item["occurrences"], item["source"], item["target"]))
    return edges


def _edge_duration_samples(log: pd.DataFrame) -> dict[tuple[str, ...], dict[tuple[str, str], list[float]]]:
    variant_edge_samples: dict[tuple[str, ...], dict[tuple[str, str], list[float]]] = {}

    for _, case_events in log.groupby("case:concept:name", sort=False):
        activities = case_events["concept:name"].astype(str).tolist()
        if not activities:
            continue

        variant_key = tuple(activities)
        timestamps = pd.to_datetime(case_events["time:timestamp"], errors="coerce", utc=True).tolist()
        edge_metrics = variant_edge_samples.setdefault(variant_key, {})

        for index in range(len(activities) - 1):
            source = activities[index]
            target = activities[index + 1]
            start = timestamps[index]
            end = timestamps[index + 1]
            if pd.isna(start) or pd.isna(end):
                continue

            delta = (end - start).total_seconds()
            if delta < 0:
                continue

            edge_key = (source, target)
            current = edge_metrics.setdefault(edge_key, [])
            current.append(round(float(delta), 2))

    return variant_edge_samples


def get_log_insights(log: pd.DataFrame) -> dict[str, Any]:
    """Extract the shared statistics used across exploration and OCEL pages."""
    num_events = len(log)
    num_cases = int(log["case:concept:name"].nunique())
    activity_frequencies = pm4py.get_event_attribute_values(log, "concept:name")
    activity_case_counts: dict[str, int] = {}
    for activity in activity_frequencies.keys():
        count = log[log["concept:name"] == activity]["case:concept:name"].nunique()
        activity_case_counts[activity] = int(count)

    activity_durations = _durations_for_activity(log, "concept:name")
    case_durations = list(pm4py.stats.get_all_case_durations(log))
    if case_durations:
        log_avg_tpt = round(statistics.mean(case_durations), 2)
        log_min_tpt = round(min(case_durations), 2)
        log_max_tpt = round(max(case_durations), 2)
        log_median_tpt = round(statistics.median(case_durations), 2)
    else:
        log_avg_tpt = log_min_tpt = log_max_tpt = log_median_tpt = 0

    case_groups = list(log.groupby("case:concept:name", sort=False))
    case_to_variant: dict[str, tuple[str, ...]] = {}
    for case_id, case_events in case_groups:
        case_to_variant[str(case_id)] = tuple(case_events["concept:name"].astype(str).tolist())

    variant_edge_samples = _edge_duration_samples(log)
    raw_regular_dfg, _, _ = pm4py.discover_dfg(log)
    raw_performance_dfg, _, _ = pm4py.discover_performance_dfg(log)
    regular_dfg = _serialize_regular_dfg(raw_regular_dfg)
    performance_dfg = _serialize_performance_edges(raw_performance_dfg, raw_regular_dfg)

    variants = pm4py.get_variants(log)
    trace_variants: list[dict[str, Any]] = []
    case_ids = list(log["case:concept:name"].astype(str).unique())
    total_cases = max(num_cases, 1)
    for variant, count in variants.items():
        activities = list(variant) if isinstance(variant, tuple) else str(variant).split(",")
        variant_key = tuple(activities)
        variant_durations = [
            case_durations[index]
            for index, case_id in enumerate(case_ids)
            if index < len(case_durations) and case_to_variant.get(case_id) == variant_key
        ]
        if variant_durations:
            avg_tpt = round(statistics.mean(variant_durations), 2)
            min_tpt = round(min(variant_durations), 2)
            max_tpt = round(max(variant_durations), 2)
            median_tpt = round(statistics.median(variant_durations), 2)
        else:
            avg_tpt = min_tpt = max_tpt = median_tpt = 0

        trace_variants.append(
            {
                "activities": activities,
                "frequency": int(count),
                "percentage": round((int(count) / total_cases) * 100, 2),
                "avg_tpt": avg_tpt,
                "min_tpt": min_tpt,
                "max_tpt": max_tpt,
                "median_tpt": median_tpt,
                "edge_performance": [
                    {
                        "source": source,
                        "target": target,
                        "samples": samples,
                    }
                    for (source, target), samples in sorted(
                        variant_edge_samples.get(variant_key, {}).items(),
                        key=lambda item: (item[0][0], item[0][1]),
                    )
                ],
            }
        )

    trace_variants.sort(key=lambda item: item["frequency"], reverse=True)

    return {
        "num_events": num_events,
        "num_cases": num_cases,
        "num_activities": len(activity_frequencies),
        "num_trace_variants": len(trace_variants),
        "activity_frequencies": activity_frequencies,
        "activity_case_counts": activity_case_counts,
        "activity_durations": activity_durations,
        "trace_variants": trace_variants,
        "start_activities": pm4py.get_start_activities(log),
        "end_activities": pm4py.get_end_activities(log),
        "regular_dfg": regular_dfg,
        "performance_dfg": performance_dfg,
        "log_avg_tpt": log_avg_tpt,
        "log_min_tpt": log_min_tpt,
        "log_max_tpt": log_max_tpt,
        "log_median_tpt": log_median_tpt,
    }


def first_rows(log: pd.DataFrame, columns: list[str], limit: int = 50) -> list[dict[str, Any]]:
    """Serialize the first preview rows from a dataframe."""
    rows: list[dict[str, Any]] = []
    for _, row in log.head(limit).iterrows():
        rows.append({column: serialize_value(row.get(column, "")) for column in columns})
    return rows


def build_log_visualization_data(log: pd.DataFrame) -> dict[str, Any]:
    """Return the raw data required to render all log visualizations client-side."""
    if log.empty:
        return {"event_points": [], "case_durations": []}

    case_starts = (
        log.groupby("case:concept:name", sort=False)["time:timestamp"]
        .min()
        .sort_values(kind="stable")
    )
    case_order = {str(case_id): index for index, case_id in enumerate(case_starts.index.tolist())}

    event_points: list[dict[str, Any]] = []
    for _, event in log.iterrows():
        timestamp = pd.to_datetime(event.get("time:timestamp"), errors="coerce", utc=True)
        if pd.isna(timestamp):
            continue

        case_id = str(event.get("case:concept:name", ""))
        event_points.append(
            {
                "case_id": case_id,
                "case_index": int(case_order.get(case_id, 0)),
                "activity": str(event.get("concept:name", "")),
                "timestamp": timestamp.isoformat(),
            }
        )

    case_durations: list[dict[str, Any]] = []
    for case_id, case_events in log.groupby("case:concept:name", sort=False):
        timestamps = pd.to_datetime(case_events["time:timestamp"], errors="coerce", utc=True).dropna()
        if timestamps.empty:
            continue

        start_timestamp = timestamps.min()
        end_timestamp = timestamps.max()
        case_durations.append(
            {
                "case_id": str(case_id),
                "start_timestamp": start_timestamp.isoformat(),
                "end_timestamp": end_timestamp.isoformat(),
                "duration_seconds": round(max((end_timestamp - start_timestamp).total_seconds(), 0.0), 2),
            }
        )

    case_durations.sort(key=lambda item: item["start_timestamp"])
    return {"event_points": event_points, "case_durations": case_durations}


def build_log_exploration(path: str, filename: str) -> dict[str, Any]:
    """Generate the full exploration payload for an event log."""
    log = read_event_log(path)
    metadata = get_log_metadata(log, filename)
    regular_svg, performance_svg = render_log_dfgs(log)
    footprints = pm4py.discover_footprints(log)
    available_variants = build_variant_summary(log)

    return {
        "message": "Exploration completed successfully",
        "log_metadata": metadata,
        "regular_svg_content": regular_svg,
        "performance_svg_content": performance_svg,
        "insights": get_log_insights(log),
        "available_activities": sorted(list(log["concept:name"].astype(str).unique())),
        "available_variants": available_variants,
        "preview_events": first_rows(log, metadata["original_columns"]),
        "first_20_events": first_rows(log, metadata["original_columns"]),
        "event_columns": metadata["original_columns"],
        "footprint_matrix": footprint_to_matrix(footprints),
        "visualization_data": build_log_visualization_data(log),
        "status": "success",
    }


def update_log_distribution(path: str, distribution_type: str) -> dict[str, Any]:
    """Regenerate the event distribution chart for a log."""
    if distribution_type not in VALID_DISTRIBUTIONS:
        raise ValueError(f"Distribution type must be one of {', '.join(VALID_DISTRIBUTIONS)}.")
    log = read_event_log(path)
    svg = render_svg(
        lambda output_path: pm4py.save_vis_events_distribution_graph(log, output_path, distr_type=distribution_type)
    )
    return {"message": "Distribution updated", "event_distribution_svg": svg, "status": "success"}
