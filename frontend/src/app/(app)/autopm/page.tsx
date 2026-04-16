"use client";

import { useEffect, useMemo, useState } from "react";

import { metricPercent } from "@/components/analysis-ui";
import { CompactAutoPMLeaderboard, formatParameters } from "@/components/analysis/autopm-leaderboard";
import { PageShell } from "@/components/page-shell";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type { AutoPMResult } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const algorithmOptions = ["alpha", "heuristics", "inductive", "ilp"];

export default function AutoPMPage() {
  const state = useUiStore((store) => store.autopm);
  const setPageState = useUiStore((store) => store.setPageState);
  const logsQuery = useAssetList("log");
  const [expandedAlgorithms, setExpandedAlgorithms] = useState<string[]>([]);

  const logs = logsQuery.data ?? [];

  const saveState = (patch: Partial<typeof state>) => {
    const nextState = { ...state, ...patch };
    setPageState("autopm", patch);
    void persistPageState("autopm", nextState);
  };

  useEffect(() => {
    if (!state.selectedLogId && logs.length) {
      saveState({ selectedLogId: logs.at(-1)?.id ?? null });
    }
  }, [logs, state.selectedLogId]);

  const toggleAlgorithm = (algorithm: string) => {
    saveState({
      selectedAlgorithms: state.selectedAlgorithms.includes(algorithm)
        ? state.selectedAlgorithms.filter((item) => item !== algorithm)
        : [...state.selectedAlgorithms, algorithm],
    });
  };

  const toggleExpanded = (algorithm: string) => {
    setExpandedAlgorithms((current) =>
      current.includes(algorithm) ? current.filter((item) => item !== algorithm) : [...current, algorithm],
    );
  };

  const runOptimization = async () => {
    if (!state.selectedLogId) {
      saveState({ error: "Select an event log before running AutoPM." });
      return;
    }
    if (!state.selectedAlgorithms.length) {
      saveState({ error: "Select at least one discovery algorithm for the search." });
      return;
    }

    saveState({ running: true, error: null });
    try {
      const response = await apiRequest<AutoPMResult>("/api/analysis/autopm", {
        method: "POST",
        body: JSON.stringify({
          log_id: state.selectedLogId,
          selected_algorithms: state.selectedAlgorithms,
          search_space_technique: state.searchSpaceTechnique,
          optimization_rounds: state.optimizationRounds,
          cross_validation_folds: state.crossValidationFolds,
          optimization_metric: state.optimizationMetric,
        }),
      });
      setExpandedAlgorithms([]);
      saveState({ running: false, result: response });
    } catch (requestError) {
      saveState({
        running: false,
        error: requestError instanceof Error ? requestError.message : "AutoPM failed",
      });
    }
  };

  const leaderboard = useMemo(() => state.result?.leaderboard ?? [], [state.result?.leaderboard]);

  return (
    <PageShell
      title="AutoPM"
      description="Search across multiple discovery configurations, compare the strongest candidates compactly, and inspect run-level details only when you need them."
    >
      {logsQuery.error ? (
        <div className="error-banner">{logsQuery.error instanceof Error ? logsQuery.error.message : "Failed to load event logs"}</div>
      ) : null}

      <section className="panel">
        <div className="grid two-up">
          <label className="field">
            <span>Event log</span>
            <select
              className="select-input"
              value={state.selectedLogId ?? ""}
              onChange={(event) => saveState({ selectedLogId: Number(event.target.value) || null })}
            >
              <option value="">Select a log</option>
              {logs.map((log) => (
                <option key={log.id} value={log.id}>
                  {log.filename}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Algorithms</span>
            <div className="toolbar wrap">
              {algorithmOptions.map((algorithm) => (
                <button
                  key={algorithm}
                  className={state.selectedAlgorithms.includes(algorithm) ? "primary-button" : "ghost-button"}
                  onClick={() => toggleAlgorithm(algorithm)}
                >
                  {algorithm}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Search technique</span>
            <select
              className="select-input"
              value={state.searchSpaceTechnique}
              onChange={(event) => saveState({ searchSpaceTechnique: event.target.value })}
            >
              <option value="grid">Grid search</option>
              <option value="random">Random search</option>
              <option value="bayesian">Bayesian-style sampling</option>
              <option value="evolutionary">Evolutionary-style sampling</option>
            </select>
          </label>

          <label className="field">
            <span>Optimization metric</span>
            <select
              className="select-input"
              value={state.optimizationMetric}
              onChange={(event) => saveState({ optimizationMetric: event.target.value })}
            >
              <option value="f1">F1</option>
              <option value="fitness">Fitness</option>
              <option value="precision">Precision</option>
              <option value="simplicity">Simplicity</option>
              <option value="generalization">Generalization</option>
            </select>
          </label>

          <label className="field">
            <span>Optimization rounds</span>
            <input
              type="number"
              min={1}
              max={100}
              value={state.optimizationRounds}
              onChange={(event) => saveState({ optimizationRounds: Number(event.target.value) })}
            />
          </label>

          <label className="field">
            <span>Cross-validation folds</span>
            <input
              type="number"
              min={2}
              max={10}
              value={state.crossValidationFolds}
              onChange={(event) => saveState({ crossValidationFolds: Number(event.target.value) })}
            />
          </label>
        </div>

        <button className="primary-button" onClick={() => void runOptimization()} disabled={state.running}>
          {state.running ? "Running optimization…" : "Start optimization"}
        </button>
      </section>

      {state.error ? <div className="error-banner">{state.error}</div> : null}

      {state.result?.overall_best ? (
        <section className="panel">
          <div className="panel-header">
            <h3>Best configuration</h3>
          </div>
          <div className="metrics-inline">
            <Metric label="Algorithm" value={state.result.overall_best.algorithm} />
            <Metric label="Score" value={state.result.overall_best.score.toFixed(4)} />
            <Metric label="Best fold" value={state.result.overall_best.best_fold_score.toFixed(4)} />
            <Metric label="Mean F1" value={metricPercent(state.result.overall_best.metrics.mean_f1)} />
          </div>
          <div className="parameter-line">
            <strong>Parameters</strong>
            <span>{formatParameters(state.result.overall_best.parameters)}</span>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-header">
          <h3>Leaderboard</h3>
        </div>
        <CompactAutoPMLeaderboard
          leaderboard={leaderboard}
          expandedAlgorithms={expandedAlgorithms}
          onToggle={toggleExpanded}
        />
      </section>
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="metric-inline">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
