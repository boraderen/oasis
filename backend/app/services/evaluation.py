"""Shared conformance and model evaluation helpers."""
from __future__ import annotations

from typing import Any

import pandas as pd
import pm4py


def ensure_petri(model: Any) -> tuple[Any, Any, Any]:
    """Normalize a PM4Py model into a Petri net triple."""
    if isinstance(model, tuple) and len(model) == 3:
        return model
    return pm4py.convert_to_petri_net(model)


def calculate_conformance_metrics(test_log: pd.DataFrame, net: Any, im: Any, fm: Any) -> dict[str, Any]:
    """Calculate token-replay and alignment metrics for a discovered model."""
    tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
    tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
    tbr_fitness = tbr_fit["log_fitness"]
    tbr_precision = tbr_prec
    tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) else 0

    try:
        align_fit = pm4py.fitness_alignments(test_log, net, im, fm)
        align_prec = pm4py.precision_alignments(test_log, net, im, fm)
        align_fitness = align_fit["log_fitness"]
        align_precision = align_prec
        align_f1 = 2 * (align_fitness * align_precision) / (align_fitness + align_precision) if (align_fitness + align_precision) else 0
        mean_fitness = (tbr_fitness + align_fitness) / 2
        mean_precision = (tbr_precision + align_precision) / 2
        mean_f1 = (tbr_f1 + align_f1) / 2
    except Exception:
        align_fitness = "PN not sound"
        align_precision = "PN not sound"
        align_f1 = "PN not sound"
        mean_fitness = tbr_fitness
        mean_precision = tbr_precision
        mean_f1 = tbr_f1

    return {
        "tbr_fitness": tbr_fitness,
        "align_fitness": align_fitness,
        "tbr_precision": tbr_precision,
        "align_precision": align_precision,
        "tbr_f1": tbr_f1,
        "align_f1": align_f1,
        "mean_fitness": mean_fitness,
        "mean_precision": mean_precision,
        "mean_f1": mean_f1,
        "num_places": len(net.places),
        "num_transitions": len(net.transitions),
        "num_arcs": len(net.arcs),
    }
