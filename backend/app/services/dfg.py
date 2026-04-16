"""Directly-follows graph filtering services."""
from __future__ import annotations

from typing import Any, Literal

import pandas as pd
import pm4py

from .common import render_svg


DfgVariantMode = Literal["all", "manual", "top_k"]


def render_log_dfgs(log: pd.DataFrame) -> tuple[str, str]:
    """Render regular and performance DFG SVGs for a dataframe log."""
    regular_svg = render_svg(lambda path: pm4py.save_vis_dfg(*pm4py.discover_dfg(log), path))
    performance_svg = render_svg(
        lambda path: pm4py.save_vis_performance_dfg(*pm4py.discover_performance_dfg(log), path)
    )
    return regular_svg, performance_svg


def build_variant_summary(log: pd.DataFrame) -> list[dict[str, Any]]:
    """Build a frequency-sorted variant summary for filter UIs."""
    variants = pm4py.get_variants(log)
    summary = [
        {
            "activities": list(variant) if isinstance(variant, tuple) else str(variant).split(","),
            "frequency": int(count),
        }
        for variant, count in variants.items()
    ]
    summary.sort(key=lambda item: item["frequency"], reverse=True)
    return summary


def _apply_activity_filter(log: pd.DataFrame, selected_activities: list[str]) -> pd.DataFrame:
    if not selected_activities:
        return log
    filtered_log = pm4py.filter_event_attribute_values(
        log,
        "concept:name",
        selected_activities,
        level="event",
    )
    if len(filtered_log) == 0:
        raise ValueError("Please keep at least one activity in the filter result.")
    return filtered_log


def _apply_manual_variant_filter(log: pd.DataFrame, selected_variants: list[list[str]]) -> pd.DataFrame:
    if not selected_variants:
        raise ValueError("Select at least one trace variant or switch to All variants.")
    filtered_log = pm4py.filter_variants(log, [tuple(variant) for variant in selected_variants])
    if len(filtered_log) == 0:
        raise ValueError("Please keep at least one trace variant in the filter result.")
    return filtered_log


def _apply_top_percentage_variant_filter(log: pd.DataFrame, top_variant_percentage: int | None) -> pd.DataFrame:
    if top_variant_percentage is None or top_variant_percentage < 1 or top_variant_percentage > 100:
        raise ValueError("Choose a percentage between 1 and 100.")

    case_count = int(log["case:concept:name"].nunique())
    target_ratio = top_variant_percentage / 100.0
    cumulative = 0
    allowed_variants: list[tuple[str, ...]] = []

    for variant in build_variant_summary(log):
        variant_tuple = tuple(variant["activities"])
        allowed_variants.append(variant_tuple)
        cumulative += int(variant["frequency"])
        if case_count and cumulative / case_count >= target_ratio:
            break

    filtered_log = pm4py.filter_variants(log, allowed_variants)
    if len(filtered_log) == 0:
        raise ValueError("Please keep at least one trace variant in the filter result.")
    return filtered_log


def update_log_dfg(
    path: str,
    selected_activities: list[str],
    variant_mode: DfgVariantMode,
    selected_variants: list[list[str]],
    top_variant_percentage: int | None,
) -> dict[str, Any]:
    """Recompute only the DFG artifacts for the current exploration filters."""
    from .io import read_event_log

    log = read_event_log(path)
    activity_filtered_log = _apply_activity_filter(log, selected_activities)
    available_variants = build_variant_summary(activity_filtered_log)

    if variant_mode == "manual":
        filtered_log = _apply_manual_variant_filter(activity_filtered_log, selected_variants)
    elif variant_mode == "top_k":
        filtered_log = _apply_top_percentage_variant_filter(activity_filtered_log, top_variant_percentage)
    else:
        filtered_log = activity_filtered_log

    regular_svg, performance_svg = render_log_dfgs(filtered_log)
    kept_variants = build_variant_summary(filtered_log)

    return {
        "message": "DFG updated with filters",
        "regular_svg_content": regular_svg,
        "performance_svg_content": performance_svg,
        "available_variants": available_variants,
        "filtered_case_count": int(filtered_log["case:concept:name"].nunique()),
        "filtered_event_count": int(len(filtered_log)),
        "kept_variant_count": len(kept_variants),
        "status": "success",
    }
