"""Cached PM4Py asset loading helpers."""
from __future__ import annotations

import json
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd
import pm4py


SUPPORTED_LOG_SUFFIXES = {".xes", ".csv"}
SUPPORTED_MODEL_SUFFIXES = {".pnml", ".bpmn"}
SUPPORTED_OCEL_SUFFIXES = {".jsonocel", ".xmlocel", ".json", ".xml", ".csv"}


def _file_mtime_ns(path: str) -> int:
    return Path(path).stat().st_mtime_ns


def _as_dataframe(log: Any) -> pd.DataFrame:
    if isinstance(log, pd.DataFrame):
        return log.copy()
    converter = getattr(pm4py, "convert_to_dataframe", None)
    if converter:
        converted = converter(log)
        if isinstance(converted, pd.DataFrame):
            return converted.copy()
    return pd.DataFrame(log)


def _guess_column(columns: Iterable[str], candidates: Iterable[str], required: bool = True) -> Optional[str]:
    available = {column.lower(): column for column in columns}
    for candidate in candidates:
        if candidate.lower() in available:
            return available[candidate.lower()]
    if required:
        raise ValueError(f"Could not infer column from candidates: {', '.join(candidates)}")
    return None


@lru_cache(maxsize=32)
def _read_event_log_cached(path: str, mtime_ns: int) -> pd.DataFrame:
    suffix = Path(path).suffix.lower()
    if suffix not in SUPPORTED_LOG_SUFFIXES:
        raise ValueError("Unsupported log format. Upload .xes or .csv files.")

    if suffix == ".xes":
        log = _as_dataframe(pm4py.read_xes(path))
    else:
        frame = pd.read_csv(path)
        case_column = _guess_column(frame.columns, ["case:concept:name", "case_id", "case", "caseid"])
        activity_column = _guess_column(frame.columns, ["concept:name", "activity", "event", "task"])
        timestamp_column = _guess_column(frame.columns, ["time:timestamp", "timestamp", "time"], required=False)

        if timestamp_column is None:
            frame["time:timestamp"] = pd.date_range(start=pd.Timestamp.utcnow(), periods=len(frame), freq="s")
        else:
            frame["time:timestamp"] = pd.to_datetime(frame[timestamp_column], errors="coerce", utc=True)
            fallback_timestamps = pd.date_range(start=pd.Timestamp.utcnow(), periods=len(frame), freq="s")
            frame["time:timestamp"] = frame["time:timestamp"].where(frame["time:timestamp"].notna(), fallback_timestamps)

        frame["case:concept:name"] = frame[case_column].astype(str)
        frame["concept:name"] = frame[activity_column].astype(str)
        log = frame

    if "case:concept:name" not in log.columns or "concept:name" not in log.columns or "time:timestamp" not in log.columns:
        raise ValueError("The log must contain case, activity, and timestamp columns.")

    log["case:concept:name"] = log["case:concept:name"].astype(str)
    log["concept:name"] = log["concept:name"].astype(str)
    log["time:timestamp"] = pd.to_datetime(log["time:timestamp"], errors="coerce", utc=True)
    fallback_timestamps = pd.date_range(start=pd.Timestamp.utcnow(), periods=len(log), freq="s")
    log["time:timestamp"] = log["time:timestamp"].where(log["time:timestamp"].notna(), fallback_timestamps)
    return log.sort_values(["case:concept:name", "time:timestamp"], kind="stable").reset_index(drop=True)


def read_event_log(path: str) -> pd.DataFrame:
    """Load an event log from disk as a dataframe."""
    return _read_event_log_cached(path, _file_mtime_ns(path)).copy()


@lru_cache(maxsize=32)
def _read_process_model_cached(path: str, mtime_ns: int) -> tuple[Any, str]:
    suffix = Path(path).suffix.lower()
    if suffix == ".pnml":
        return pm4py.read_pnml(path), "Petri Net"
    if suffix == ".bpmn":
        return pm4py.read_bpmn(path), "BPMN"
    raise ValueError("Unsupported model format. Upload .pnml or .bpmn files.")


def read_process_model(path: str) -> tuple[Any, str]:
    """Load a PM4Py model and identify its kind."""
    return _read_process_model_cached(path, _file_mtime_ns(path))


@lru_cache(maxsize=16)
def _read_ocel_cached(path: str, mtime_ns: int) -> Any:
    suffix = Path(path).suffix.lower()
    if suffix not in SUPPORTED_OCEL_SUFFIXES:
        raise ValueError("Unsupported OCEL format.")
    if suffix == ".csv":
        return pm4py.read_ocel_csv(path)
    try:
        return pm4py.read_ocel(path)
    except KeyError as exc:
        if suffix not in {".jsonocel", ".json"} or str(exc).strip("'") not in {"ocel:global-event", "ocel:global-object"}:
            raise

        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        payload.setdefault("ocel:global-event", {})
        payload.setdefault("ocel:global-object", {})
        handle, normalized_path = tempfile.mkstemp(suffix=suffix)
        os.close(handle)
        Path(normalized_path).write_text(json.dumps(payload), encoding="utf-8")
        try:
            return pm4py.read_ocel(normalized_path)
        finally:
            Path(normalized_path).unlink(missing_ok=True)


def read_ocel(path: str) -> Any:
    """Load an object-centric event log."""
    return _read_ocel_cached(path, _file_mtime_ns(path))
