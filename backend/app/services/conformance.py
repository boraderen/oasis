"""Conformance checking services."""
from __future__ import annotations

from typing import Any

import pandas as pd
import pm4py

from .assets import get_model_metadata
from .common import count_footprint_differences, footprint_to_matrix, render_bpmn_from_petri, render_svg
from .dfg import render_log_dfgs
from .evaluation import ensure_petri
from .io import read_event_log, read_process_model
from .logs import get_log_insights, get_log_metadata


def _create_variant_log(log: pd.DataFrame) -> tuple[pd.DataFrame, list[tuple[tuple[str, ...], pd.DataFrame]], dict[tuple[str, ...], int]]:
    variants = pm4py.get_variants(log)
    variant_traces: list[tuple[tuple[str, ...], pd.DataFrame]] = []
    seen: set[tuple[str, ...]] = set()
    for _, case_events in log.groupby("case:concept:name", sort=False):
        variant_tuple = tuple(case_events["concept:name"].astype(str).tolist())
        if variant_tuple not in seen:
            seen.add(variant_tuple)
            variant_traces.append((variant_tuple, case_events))

    variant_log = pd.concat([case_events for _, case_events in variant_traces], ignore_index=True) if variant_traces else log.head(0)
    variant_counts = {
        (variant if isinstance(variant, tuple) else tuple(str(variant).split(","))): int(count)
        for variant, count in variants.items()
    }
    return variant_log, variant_traces, variant_counts


def conformance_log_log(first_path: str, first_filename: str, second_path: str, second_filename: str) -> dict[str, Any]:
    """Compare two event logs using footprints and DFGs."""
    first_log = read_event_log(first_path)
    second_log = read_event_log(second_path)
    first_footprint = pm4py.discover_footprints(first_log)
    second_footprint = pm4py.discover_footprints(second_log)
    first_matrix = footprint_to_matrix(first_footprint)
    second_matrix = footprint_to_matrix(second_footprint)
    different_cells = count_footprint_differences(first_footprint, second_footprint)
    num_activities = max(len(first_matrix["activities"]), len(second_matrix["activities"]))
    total_cells = max(num_activities * num_activities, 1)
    footprint_conformance = 1 - (different_cells / total_cells)

    first_svg, _ = render_log_dfgs(first_log)
    second_svg, _ = render_log_dfgs(second_log)

    return {
        "message": "Log-log conformance checking completed",
        "status": "success",
        "log1_metadata": get_log_metadata(first_log, first_filename),
        "log2_metadata": get_log_metadata(second_log, second_filename),
        "log1_insights": get_log_insights(first_log),
        "log2_insights": get_log_insights(second_log),
        "num_events_1": len(first_log),
        "num_cases_1": int(first_log["case:concept:name"].nunique()),
        "num_events_2": len(second_log),
        "num_cases_2": int(second_log["case:concept:name"].nunique()),
        "footprint1_matrix": first_matrix,
        "footprint2_matrix": second_matrix,
        "num_different_cells": different_cells,
        "footprint_conformance": footprint_conformance,
        "log1_svg": first_svg,
        "log2_svg": second_svg,
    }


def conformance_log_model(log_path: str, log_filename: str, model_path: str, model_filename: str) -> dict[str, Any]:
    """Compare an event log with a process model."""
    log = read_event_log(log_path)
    model, model_type = read_process_model(model_path)
    net, im, fm = ensure_petri(model)

    tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
    tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
    tbr_fitness = tbr_fit["log_fitness"]
    tbr_precision = tbr_prec
    tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) else 0

    try:
        align_fit = pm4py.fitness_alignments(log, net, im, fm)
        align_prec = pm4py.precision_alignments(log, net, im, fm)
        align_fitness = align_fit["log_fitness"]
        align_precision = align_prec
        align_f1 = 2 * (align_fitness * align_precision) / (align_fitness + align_precision) if (align_fitness + align_precision) else 0
        mean_fitness = (tbr_fitness + align_fitness) / 2
        mean_precision = (tbr_precision + align_precision) / 2
    except Exception:
        align_fitness = "PN not sound"
        align_precision = "PN not sound"
        align_f1 = "PN not sound"
        mean_fitness = tbr_fitness
        mean_precision = tbr_precision

    log_footprints = pm4py.discover_footprints(log)
    model_footprints = pm4py.discover_footprints(net, im, fm)
    log_footprint_matrix = footprint_to_matrix(log_footprints)
    model_footprint_matrix = footprint_to_matrix(model_footprints)
    different_cells = count_footprint_differences(log_footprints, model_footprints)
    activity_count = max(len(model_footprint_matrix["activities"]), 1)
    footprint_conformance = 1 - (different_cells / (activity_count * activity_count))

    num_events = len(log)
    num_cases = int(log["case:concept:name"].nunique())
    num_places = len(net.places)
    num_transitions = len(net.transitions)
    num_arcs = len(net.arcs)

    simplicity = 0.0
    if num_transitions > 0:
        activity_transition_ratio = int(log["concept:name"].nunique()) / num_transitions
        complexity_factor = (num_places + num_arcs) / max(num_events + num_cases, 1)
        simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))

    variant_log, variant_traces, variant_counts = _create_variant_log(log)

    alignment_data: list[dict[str, Any]] = []
    try:
        alignments = pm4py.conformance.conformance_diagnostics_alignments(variant_log, net, im, fm)
        variant_to_alignment = {}
        for index, (variant_key, _) in enumerate(variant_traces):
            if index < len(alignments):
                variant_to_alignment[variant_key] = alignments[index]
        top_variants = sorted(variant_counts.items(), key=lambda item: item[1], reverse=True)[:20]
        alignment_data = [
            {
                "variant": list(variant_key),
                "frequency": frequency,
                "alignment": variant_to_alignment.get(variant_key, {}).get("alignment", []),
                "fitness": variant_to_alignment.get(variant_key, {}).get("fitness", 0.0),
            }
            for variant_key, frequency in top_variants
        ]
    except Exception:
        alignment_data = []

    tbr_data: list[dict[str, Any]] = []
    try:
        replay_results = pm4py.conformance_diagnostics_token_based_replay(variant_log, net, im, fm)
        variant_to_replay = {}
        for index, (variant_key, _) in enumerate(variant_traces):
            if index < len(replay_results):
                variant_to_replay[variant_key] = replay_results[index]
        top_variants = sorted(variant_counts.items(), key=lambda item: item[1], reverse=True)[:20]
        tbr_data = [
            {
                "variant": list(variant_key),
                "frequency": frequency,
                "missing_tokens": variant_to_replay.get(variant_key, {}).get("missing_tokens", 0),
                "consumed_tokens": variant_to_replay.get(variant_key, {}).get("consumed_tokens", 0),
                "remaining_tokens": variant_to_replay.get(variant_key, {}).get("remaining_tokens", 0),
                "produced_tokens": variant_to_replay.get(variant_key, {}).get("produced_tokens", 0),
                "trace_is_fit": variant_to_replay.get(variant_key, {}).get("trace_is_fit", False),
                "trace_fitness": variant_to_replay.get(variant_key, {}).get("trace_fitness", 0.0),
            }
            for variant_key, frequency in top_variants
        ]
    except Exception:
        tbr_data = []

    model_svg = render_svg(lambda path: pm4py.save_vis_petri_net(net, im, fm, path))
    model_bpmn_svg, model_bpmn_content = render_bpmn_from_petri(net, im, fm)
    log_svg, _ = render_log_dfgs(log)

    mean_fitness_combined = (tbr_fitness + align_fitness) / 2 if isinstance(align_fitness, (int, float)) else tbr_fitness
    mean_precision_combined = (tbr_precision + align_precision) / 2 if isinstance(align_precision, (int, float)) else tbr_precision
    mean_f1_combined = (tbr_f1 + align_f1) / 2 if isinstance(align_f1, (int, float)) else tbr_f1

    return {
        "message": "Log-model conformance checking completed",
        "status": "success",
        "log_metadata": get_log_metadata(log, log_filename),
        "log_insights": get_log_insights(log),
        "model_metadata": {**get_model_metadata(model_path, model_filename), "model_type": model_type},
        "num_events": num_events,
        "num_cases": num_cases,
        "num_places": num_places,
        "num_transitions": num_transitions,
        "num_arcs": num_arcs,
        "log_footprint_matrix": log_footprint_matrix,
        "model_footprint_matrix": model_footprint_matrix,
        "num_different_cells": different_cells,
        "footprint_conformance": footprint_conformance,
        "alignment_data": alignment_data,
        "tbr_data": tbr_data,
        "model_svg": model_svg,
        "model_bpmn_svg": model_bpmn_svg,
        "model_bpmn_content": model_bpmn_content,
        "log_svg": log_svg,
        "tbr_fitness": tbr_fitness,
        "align_fitness": align_fitness,
        "tbr_precision": tbr_precision,
        "align_precision": align_precision,
        "tbr_f1": tbr_f1,
        "align_f1": align_f1,
        "mean_fitness": mean_fitness,
        "mean_precision": mean_precision,
        "mean_fitness_combined": mean_fitness_combined,
        "mean_precision_combined": mean_precision_combined,
        "mean_f1_combined": mean_f1_combined,
        "simplicity": simplicity,
    }


def compute_custom_alignment(log_path: str, model_path: str, trace_activities: list[str]) -> dict[str, Any]:
    """Run alignment diagnostics for an arbitrary trace."""
    if not trace_activities:
        raise ValueError("Please provide at least one activity.")

    log = read_event_log(log_path)
    model, _ = read_process_model(model_path)
    net, im, fm = ensure_petri(model)

    events = []
    start_time = pd.Timestamp.utcnow()
    for index, activity in enumerate(trace_activities):
        event = {
            "case:concept:name": "custom_trace",
            "concept:name": activity,
            "time:timestamp": start_time + pd.Timedelta(seconds=index),
        }
        if "org:resource" in log.columns:
            event["org:resource"] = "custom_user"
        events.append(event)

    custom_log = pd.DataFrame(events)
    alignments = pm4py.conformance.conformance_diagnostics_alignments(custom_log, net, im, fm)
    replay_results = pm4py.conformance_diagnostics_token_based_replay(custom_log, net, im, fm)
    if not alignments or not replay_results:
        raise ValueError("Failed to compute custom diagnostics.")

    replay = replay_results[0]
    return {
        "message": "Custom alignment computed successfully",
        "status": "success",
        "alignment": alignments[0]["alignment"],
        "fitness": alignments[0]["fitness"],
        "tbr": {
            "missing_tokens": replay.get("missing_tokens", 0),
            "consumed_tokens": replay.get("consumed_tokens", 0),
            "remaining_tokens": replay.get("remaining_tokens", 0),
            "produced_tokens": replay.get("produced_tokens", 0),
            "trace_is_fit": replay.get("trace_is_fit", False),
            "trace_fitness": replay.get("trace_fitness", 0.0),
        },
    }


def conformance_model_model(first_path: str, first_filename: str, second_path: str, second_filename: str) -> dict[str, Any]:
    """Compare two process models."""
    first_model, _ = read_process_model(first_path)
    second_model, _ = read_process_model(second_path)
    net1, im1, fm1 = ensure_petri(first_model)
    net2, im2, fm2 = ensure_petri(second_model)
    model1_bpmn_svg, model1_bpmn_content = render_bpmn_from_petri(net1, im1, fm1)
    model2_bpmn_svg, model2_bpmn_content = render_bpmn_from_petri(net2, im2, fm2)

    footprints1 = pm4py.discover_footprints(net1, im1, fm1)
    footprints2 = pm4py.discover_footprints(net2, im2, fm2)
    matrix1 = footprint_to_matrix(footprints1)
    matrix2 = footprint_to_matrix(footprints2)
    different_cells = count_footprint_differences(footprints1, footprints2)
    activity_count = max(len(matrix1["activities"]), len(matrix2["activities"]), 1)
    footprint_conformance = 1 - (different_cells / (activity_count * activity_count))

    return {
        "message": "Model-model conformance checking completed",
        "status": "success",
        "model1_metadata": get_model_metadata(first_path, first_filename),
        "model2_metadata": get_model_metadata(second_path, second_filename),
        "model1_svg": render_svg(lambda path: pm4py.save_vis_petri_net(net1, im1, fm1, path)),
        "model2_svg": render_svg(lambda path: pm4py.save_vis_petri_net(net2, im2, fm2, path)),
        "model1_bpmn_svg": model1_bpmn_svg,
        "model1_bpmn_content": model1_bpmn_content,
        "model2_bpmn_svg": model2_bpmn_svg,
        "model2_bpmn_content": model2_bpmn_content,
        "num_places_1": len(net1.places),
        "num_transitions_1": len(net1.transitions),
        "num_arcs_1": len(net1.arcs),
        "num_places_2": len(net2.places),
        "num_transitions_2": len(net2.transitions),
        "num_arcs_2": len(net2.arcs),
        "footprint1_matrix": matrix1,
        "footprint2_matrix": matrix2,
        "num_different_cells": different_cells,
        "footprint_conformance": footprint_conformance,
    }
