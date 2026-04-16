"use client";

import { useCallback, useEffect, useMemo } from "react";

import { metricPercent } from "@/components/analysis-ui";
import { PageShell } from "@/components/page-shell";
import { ProcessModelViewer } from "@/components/process-model-viewer";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type { DiscoveryAlgorithm, DiscoveryResult } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const algorithmLabels: Record<DiscoveryAlgorithm, string> = {
  alpha: "Alpha",
  ilp: "ILP",
  heuristics: "Heuristics",
  inductive: "Inductive",
};

function buildPnmlFilename(filename: string, algorithm: DiscoveryAlgorithm) {
  const baseName = filename.replace(/\.[^.]+$/, "") || "discovered-model";
  return `${baseName}-${algorithm}.pnml`;
}

function buildBpmnFilename(filename: string, algorithm: DiscoveryAlgorithm) {
  const baseName = filename.replace(/\.[^.]+$/, "") || "discovered-model";
  return `${baseName}-${algorithm}.bpmn`;
}

export default function DiscoveryPage() {
  const state = useUiStore((store) => store.discovery);
  const setPageState = useUiStore((store) => store.setPageState);
  const logsQuery = useAssetList("log");
  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);

  const saveState = useCallback(
    (patch: Partial<typeof state>) => {
      const nextState = { ...state, ...patch };
      setPageState("discovery", patch);
      void persistPageState("discovery", nextState);
    },
    [setPageState, state],
  );

  useEffect(() => {
    if (!state.selectedLogId && logs.length) {
      saveState({ selectedLogId: logs.at(-1)?.id ?? null });
    }
  }, [logs, saveState, state.selectedLogId]);

  const runDiscovery = async (algorithm: DiscoveryAlgorithm) => {
    if (!state.selectedLogId) {
      saveState({ error: "Select a log before running discovery." });
      return;
    }

    saveState({
      error: null,
      successMessage: null,
      comparisonStarted: true,
      loading: {
        ...state.loading,
        [algorithm]: true,
      },
    });

    try {
      const response = await apiRequest<DiscoveryResult>(`/api/analysis/logs/${state.selectedLogId}/discover/${algorithm}`, {
        method: "POST",
        body: JSON.stringify(state.parameters[algorithm]),
      });

      saveState({
        successMessage: `Completed ${algorithmLabels[algorithm]} discovery for ${response.log_metadata.filename}`,
        results: {
          ...state.results,
          [algorithm]: response,
        },
        loading: {
          ...state.loading,
          [algorithm]: false,
        },
      });
    } catch (requestError) {
      saveState({
        error: requestError instanceof Error ? requestError.message : "Discovery failed",
        loading: {
          ...state.loading,
          [algorithm]: false,
        },
      });
    }
  };

  const algorithmCards = useMemo(
    () =>
      (Object.keys(algorithmLabels) as DiscoveryAlgorithm[]).map((algorithm) => ({
        algorithm,
        label: algorithmLabels[algorithm],
        result: state.results[algorithm],
        loading: state.loading[algorithm],
      })),
    [state.loading, state.results],
  );

  return (
    <PageShell
      title="Discovery"
      description="Discover process models from the full selected log with Alpha, ILP, Heuristics, and Inductive mining."
    >
      {logsQuery.error ? (
        <div className="error-banner">{logsQuery.error instanceof Error ? logsQuery.error.message : "Failed to load event logs"}</div>
      ) : null}

      <section className="panel">
        <div className="toolbar wrap">
          <select
            className="select-input"
            value={state.selectedLogId ?? ""}
            onChange={(event) => saveState({ selectedLogId: Number(event.target.value) || null })}
          >
            <option value="">Select a log</option>
            {logs.map((log) => (
              <option key={log.id} value={log.id}>
                {log.filename} ({log.num_events ?? 0} events)
              </option>
            ))}
          </select>
        </div>
      </section>

      {state.error ? <div className="error-banner">{state.error}</div> : null}
      {state.successMessage ? <div className="success-banner">{state.successMessage}</div> : null}

      {state.selectedLogId ? (
        <div className="analysis-stack">
          {algorithmCards.map(({ algorithm, label, result, loading }) => (
            <ProcessModelViewer
              key={algorithm}
              title={`${label} Miner`}
              petriSvg={result?.svg_content}
              bpmnSvg={result?.bpmn_svg_content}
              pnmlContent={result?.pnml_content}
              pnmlFilename={result ? buildPnmlFilename(result.log_metadata.filename, algorithm) : null}
              bpmnContent={result?.bpmn_content}
              bpmnFilename={result ? buildBpmnFilename(result.log_metadata.filename, algorithm) : null}
              stageClassName="white-stage algorithm-stage"
              fitKey={`${algorithm}-${result?.log_metadata.filename ?? "empty"}`}
              actions={
                <button className="primary-button" onClick={() => void runDiscovery(algorithm)} disabled={loading}>
                  {loading ? "Running…" : "Discover"}
                </button>
              }
            >
              <DiscoveryControls
                algorithm={algorithm}
                onChange={(patch) =>
                  saveState({
                    parameters: {
                      ...state.parameters,
                      [algorithm]: {
                        ...state.parameters[algorithm],
                        ...patch,
                      },
                    },
                  })
                }
                parameters={state.parameters[algorithm]}
              />

              <div className="metrics-inline">
                <Metric label="Align fit." value={metricPercent(result?.align_fitness)} />
                <Metric label="Align prec." value={metricPercent(result?.align_precision)} />
                <Metric label="Align F1" value={metricPercent(result?.align_f1)} />
                <Metric label="TBR fit." value={metricPercent(result?.tbr_fitness)} />
                <Metric label="TBR prec." value={metricPercent(result?.tbr_precision)} />
                <Metric label="TBR F1" value={metricPercent(result?.tbr_f1)} />
                <Metric label="Mean fit." value={metricPercent(result?.mean_fitness)} />
                <Metric label="Mean prec." value={metricPercent(result?.mean_precision)} />
                <Metric label="Mean F1" value={metricPercent(result?.mean_f1)} />
                <Metric label="Places" value={String(result?.num_places ?? "-")} />
                <Metric label="Trans." value={String(result?.num_transitions ?? "-")} />
                <Metric label="Arcs" value={String(result?.num_arcs ?? "-")} />
              </div>
            </ProcessModelViewer>
          ))}
        </div>
      ) : (
        <section className="panel">
          <div className="empty-panel">Select a log to unlock the discovery algorithms.</div>
        </section>
      )}
    </PageShell>
  );
}

function DiscoveryControls({
  algorithm,
  parameters,
  onChange,
}: {
  algorithm: DiscoveryAlgorithm;
  parameters: Record<string, number>;
  onChange: (patch: Record<string, number>) => void;
}) {
  if (algorithm === "alpha") {
    return null;
  }

  return (
    <div className="control-grid">
      {Object.entries(parameters).map(([key, value]) => (
        <label key={key} className="field">
          <span>{key.replaceAll("_", " ")}</span>
          <input
            type="number"
            step="0.1"
            value={value}
            onChange={(event) => onChange({ [key]: Number(event.target.value) })}
          />
        </label>
      ))}
    </div>
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
