"""Shared PM4Py service helpers."""
from __future__ import annotations

import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import pandas as pd


VALID_DISTRIBUTIONS = ["days_month", "months", "years", "hours", "days_week", "weeks"]


def _tmp_svg() -> str:
    handle, path = tempfile.mkstemp(suffix=".svg")
    os.close(handle)
    return path


def _read_svg(path: str) -> str:
    with open(path, "r", encoding="utf-8") as svg_file:
        return svg_file.read()


def render_svg(callback: Callable[[str], None]) -> str:
    """Render a PM4Py visualization to SVG text."""
    path = _tmp_svg()
    try:
        callback(path)
        return _read_svg(path)
    finally:
        Path(path).unlink(missing_ok=True)


def render_text_file(callback: Callable[[str], None], suffix: str) -> str:
    """Render a file-based PM4Py export and return its text contents."""
    handle, path = tempfile.mkstemp(suffix=suffix)
    os.close(handle)
    try:
        callback(path)
        return Path(path).read_text(encoding="utf-8")
    finally:
        Path(path).unlink(missing_ok=True)


def serialize_value(value: Any) -> Any:
    """Convert values into JSON-safe primitives."""
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except TypeError:
        pass
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, (list, tuple, set)):
        return [serialize_value(item) for item in value]
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except TypeError:
            pass
    return str(value)


def footprint_to_matrix(footprint: dict[str, Any]) -> dict[str, Any]:
    """Convert a PM4Py footprint dictionary into a table."""
    activities = sorted(list(footprint.get("activities", set())))
    index_by_activity = {activity: index for index, activity in enumerate(activities)}
    matrix = [["" for _ in activities] for _ in activities]

    for source, target in footprint.get("sequence", set()):
        if source in index_by_activity and target in index_by_activity:
            matrix[index_by_activity[source]][index_by_activity[target]] = "->"

    for source, target in footprint.get("parallel", set()):
        if source in index_by_activity and target in index_by_activity:
            matrix[index_by_activity[source]][index_by_activity[target]] = "||"

    return {"activities": activities, "matrix": matrix}


def count_footprint_differences(first: dict[str, Any], second: dict[str, Any]) -> int:
    """Count differing relations between two footprints."""
    difference = len(first.get("sequence", set()).symmetric_difference(second.get("sequence", set())))
    difference += len(first.get("parallel", set()).symmetric_difference(second.get("parallel", set())))
    return difference
