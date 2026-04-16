"""Classic process discovery services."""
from __future__ import annotations

from typing import Any

import pandas as pd
import pm4py

from .common import render_svg, render_text_file
from .evaluation import calculate_conformance_metrics
from .io import read_event_log
from .logs import get_log_insights, get_log_metadata


def discover_with_algorithm(log: pd.DataFrame, algorithm: str, parameters: dict[str, Any]) -> tuple[Any, Any, Any]:
    """Discover a Petri net with the selected algorithm."""
    if algorithm == "alpha":
        return pm4py.discover_petri_net_alpha(log)
    if algorithm == "ilp":
        return pm4py.discover_petri_net_ilp(log, alpha=float(parameters.get("alpha", 0.5)))
    if algorithm == "heuristics":
        return pm4py.discover_petri_net_heuristics(
            log,
            dependency_threshold=float(parameters.get("dependency_threshold", 0.9)),
            and_threshold=float(parameters.get("and_threshold", 0.9)),
            loop_two_threshold=float(parameters.get("loop_two_threshold", 0.9)),
        )
    if algorithm == "inductive":
        return pm4py.discover_petri_net_inductive(log, noise_threshold=float(parameters.get("noise_threshold", 0.2)))
    raise ValueError(f"Unsupported discovery algorithm: {algorithm}")


def discover_process_model(path: str, filename: str, algorithm: str, parameters: dict[str, Any]) -> dict[str, Any]:
    """Run process discovery and evaluation for a single algorithm."""
    log = read_event_log(path)
    net, im, fm = discover_with_algorithm(log, algorithm, parameters)
    svg_content = render_svg(lambda output_path: pm4py.save_vis_petri_net(net, im, fm, output_path))
    pnml_content = render_text_file(lambda output_path: pm4py.write_pnml(net, im, fm, output_path), ".pnml")
    metrics = calculate_conformance_metrics(log, net, im, fm)

    return {
        "message": f"{algorithm.title()} discovery completed",
        "status": "success",
        "svg_content": svg_content,
        "pnml_content": pnml_content,
        "log_metadata": get_log_metadata(log, filename),
        "log_stats": get_log_insights(log),
        **metrics,
    }
