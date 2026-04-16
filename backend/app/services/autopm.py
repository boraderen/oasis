"""AutoPM optimization service."""
from __future__ import annotations

import itertools
import random
import statistics
from typing import Any

import pm4py

from .discovery import discover_with_algorithm
from .evaluation import calculate_conformance_metrics
from .io import read_event_log
from .logs import get_log_metadata


AUTOPM_PARAMETER_SPACE = {
    "alpha": [{}],
    "heuristics": [
        {"dependency_threshold": dependency, "and_threshold": and_threshold, "loop_two_threshold": loop_threshold}
        for dependency, and_threshold, loop_threshold in itertools.product([0.5, 0.7, 0.9], [0.1, 0.3, 0.5], [0.1, 0.3, 0.5])
    ],
    "inductive": [{"noise_threshold": noise} for noise in [0.0, 0.1, 0.2, 0.4]],
    "ilp": [{"alpha": alpha} for alpha in [0.2, 0.5, 0.8]],
}


def score_candidate(metric: str, metrics: dict[str, Any]) -> float:
    """Map an optimization metric choice onto a numeric score."""
    if metric == "fitness":
        return float(metrics["mean_fitness"])
    if metric == "precision":
        return float(metrics["mean_precision"])
    if metric == "simplicity":
        transitions = max(metrics["num_transitions"], 1)
        return 1 / (1 + ((metrics["num_places"] + metrics["num_arcs"]) / transitions))
    if metric == "generalization":
        return float(metrics["mean_fitness"])
    return float(metrics["tbr_f1"])


def run_autopm(
    path: str,
    filename: str,
    selected_algorithms: list[str],
    search_space_technique: str,
    optimization_rounds: int,
    cross_validation_folds: int,
    optimization_metric: str,
) -> dict[str, Any]:
    """Execute a lightweight hyper-parameter search across discovery algorithms."""
    if not selected_algorithms:
        raise ValueError("Select at least one algorithm.")

    log = read_event_log(path)
    rng = random.Random(42)
    folds = min(max(cross_validation_folds, 2), 5)
    rounds = min(max(optimization_rounds, 1), 50)
    leaderboard: list[dict[str, Any]] = []

    for algorithm in selected_algorithms:
        candidates = list(AUTOPM_PARAMETER_SPACE.get(algorithm, [{}]))
        if search_space_technique in {"random", "bayesian", "evolutionary"} and len(candidates) > rounds:
            candidates = rng.sample(candidates, rounds)
        else:
            candidates = candidates[:rounds]

        candidate_results: list[dict[str, Any]] = []
        for parameters in candidates:
            fold_scores: list[float] = []
            fold_metrics: list[dict[str, Any]] = []
            for _ in range(folds):
                try:
                    train_log, test_log = pm4py.split_train_test(log, train_percentage=0.8)
                    net, im, fm = discover_with_algorithm(train_log, algorithm, parameters)
                    metrics = calculate_conformance_metrics(test_log, net, im, fm)
                    score = score_candidate(optimization_metric, metrics)
                    fold_scores.append(score)
                    fold_metrics.append(metrics)
                except Exception:
                    continue

            if not fold_scores:
                continue

            best_fold = max(range(len(fold_scores)), key=fold_scores.__getitem__)
            candidate_results.append(
                {
                    "algorithm": algorithm,
                    "parameters": parameters,
                    "score": round(statistics.mean(fold_scores), 4),
                    "best_fold_score": round(fold_scores[best_fold], 4),
                    "fold_scores": [round(score, 4) for score in fold_scores],
                    "metrics": fold_metrics[best_fold],
                }
            )

        candidate_results.sort(key=lambda item: item["score"], reverse=True)
        if candidate_results:
            leaderboard.append(
                {
                    "algorithm": algorithm,
                    "best_result": candidate_results[0],
                    "results": candidate_results,
                }
            )

    leaderboard.sort(key=lambda item: item["best_result"]["score"], reverse=True)
    overall_best = leaderboard[0]["best_result"] if leaderboard else None

    return {
        "message": "AutoPM optimization completed",
        "status": "success",
        "log_metadata": get_log_metadata(log, filename),
        "search_space_technique": search_space_technique,
        "optimization_rounds": rounds,
        "cross_validation_folds": folds,
        "optimization_metric": optimization_metric,
        "leaderboard": leaderboard,
        "overall_best": overall_best,
    }
