"use client";

import { useEffect, useMemo } from "react";

import {
  ActivityAnalysisPanel,
  FootprintTable,
  TraceVariantAnalysisPanel,
  buildActivityColorMap,
  formatDuration,
} from "@/components/analysis-ui";
import { DynamicDfgViewer, buildDfgDataFromInsights } from "@/components/analysis/dynamic-dfg-viewer";
import { LogVisualizationViewer, type VizGroup } from "@/components/analysis/log-visualization-viewer";
import { PageShell } from "@/components/page-shell";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type { DfgPerformanceMetric, DistributionType, LogExplorationResult } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const previewLimitOptions = [5, 25, 50];
const performanceMetricOptions: DfgPerformanceMetric[] = ["mean", "median", "max", "min", "sum", "stdev"];

export default function ExplorationPage() {
  const state = useUiStore((store) => store.exploration);
  const setPageState = useUiStore((store) => store.setPageState);
  const logsQuery = useAssetList("log");

  const logs = useMemo(() => logsQuery.data ?? [], [logsQuery.data]);

  const saveState = (patch: Partial<typeof state>, options?: { persist?: boolean }) => {
    const nextState = { ...state, ...patch };
    setPageState("exploration", patch);
    if (options?.persist !== false) {
      void persistPageState("exploration", nextState);
    }
  };

  useEffect(() => {
    if (state.selectedLogId || !logs.length) {
      return;
    }

    const selectedLogId = logs.at(-1)?.id ?? null;
    setPageState("exploration", { selectedLogId });
    void persistPageState("exploration", { ...useUiStore.getState().exploration, selectedLogId });
  }, [logs, setPageState, state.selectedLogId]);

  const explore = async () => {
    if (!state.selectedLogId) {
      saveState({ error: "Select an event log first." });
      return;
    }

    saveState({ loading: true, error: null, successMessage: null });
    try {
      const response = await apiRequest<LogExplorationResult>(`/api/analysis/logs/${state.selectedLogId}/exploration`, {
        method: "POST",
      });
      saveState({
        loading: false,
        result: {
          ...response,
          filtered_case_count: response.insights.num_cases,
          filtered_event_count: response.insights.num_events,
          kept_variant_count: response.available_variants.length,
        },
        successMessage: `Exploring ${response.log_metadata.filename}`,
        selectedActivities: response.available_activities,
        selectedVariants: response.available_variants.map((variant) => variant.activities),
        variantMode: "all",
        topVariantPercentage: 80,
        dfgFilterOpen: false,
      });
    } catch (requestError) {
      saveState({
        loading: false,
        error: requestError instanceof Error ? requestError.message : "Exploration failed",
      });
    }
  };

  const dfgData = useMemo(() => (state.result ? buildDfgDataFromInsights(state.result.insights) : null), [state.result]);
  const previewLimit = previewLimitOptions.includes(state.eventPreviewLimit) ? state.eventPreviewLimit : 5;
  const vizGroup: VizGroup = state.activeVisualization === "temporal" ? "temporal" : "charts";

  const previewRows = useMemo(
    () => (state.result?.preview_events ?? state.result?.first_20_events ?? []).slice(0, previewLimit),
    [previewLimit, state.result],
  );

  const activityRows = useMemo(
    () =>
      state.result
        ? Object.entries(state.result.insights.activity_frequencies)
            .map(([activity, frequency]) => ({
              activity,
              frequency,
              shareCount: state.result?.insights.activity_case_counts[activity] ?? 0,
              durations: state.result?.insights.activity_durations[activity] ?? { avg: 0, min: 0, max: 0, median: 0 },
            }))
            .sort((left, right) => right.frequency - left.frequency)
        : [],
    [state.result],
  );

  const activityColors = useMemo(
    () => buildActivityColorMap(activityRows.map((row) => row.activity)),
    [activityRows],
  );

  return (
    <PageShell
      title="Exploration"
      description="Inspect a log through a compact DFG, grouped visualizations, lean data previews, and focused activity and trace analysis."
    >
      <div className="exploration-page">
        {logsQuery.error ? (
          <div className="error-banner">{logsQuery.error instanceof Error ? logsQuery.error.message : "Failed to load event logs"}</div>
        ) : null}

        <section className="exploration-control-strip">
          <select
            className="select-input"
            value={state.selectedLogId ?? ""}
            onChange={(event) => saveState({ selectedLogId: Number(event.target.value) || null })}
          >
            <option value="">Select a log</option>
            {logs.map((log) => (
              <option key={log.id} value={log.id}>
                {log.filename} ({log.num_events ?? 0} events, {log.num_cases ?? 0} cases)
              </option>
            ))}
          </select>
          <button className="primary-button" onClick={() => void explore()} disabled={state.loading || !logs.length}>
            {state.loading ? "Working…" : "Explore log"}
          </button>
        </section>

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        {state.successMessage ? <div className="success-banner">{state.successMessage}</div> : null}

        <DynamicDfgViewer
          key={`${state.selectedLogId ?? "none"}-${state.result?.log_metadata.filename ?? "blank"}`}
          title={state.dfgType === "regular" ? "Directly-follows graph" : "Performance DFG"}
          data={dfgData}
          mode={state.dfgType}
          performanceMetric={state.dfgPerformanceMetric}
          actions={
            <>
              <button
                className={state.dfgType === "regular" ? "toggle-pill active" : "toggle-pill"}
                onClick={() => saveState({ dfgType: "regular" }, { persist: false })}
              >
                Regular
              </button>
              <button
                className={state.dfgType === "performance" ? "toggle-pill active" : "toggle-pill"}
                onClick={() => saveState({ dfgType: "performance" }, { persist: false })}
              >
                Performance
              </button>
              {state.dfgType === "performance"
                ? performanceMetricOptions.map((metric) => (
                    <button
                      key={metric}
                      className={state.dfgPerformanceMetric === metric ? "toggle-pill active" : "toggle-pill"}
                      onClick={() => saveState({ dfgPerformanceMetric: metric }, { persist: false })}
                    >
                      {metric}
                    </button>
                  ))
                : null}
            </>
          }
          emptyMessage="Explore a log to render the dynamic DFG."
        />

        <LogVisualizationViewer
          title="Log Visualizations"
          data={state.result?.visualization_data ?? null}
          vizGroup={vizGroup}
          distributionType={state.distributionType as DistributionType}
          colorMap={activityColors}
          emptyMessage="Explore a log to unlock dotted charts and temporal visualizations."
          enableChartZoom
          actions={
            <>
              <button
                className={vizGroup === "charts" ? "toggle-pill active" : "toggle-pill"}
                onClick={() => saveState({ activeVisualization: "charts" })}
              >
                Charts
              </button>
              <button
                className={vizGroup === "temporal" ? "toggle-pill active" : "toggle-pill"}
                onClick={() => saveState({ activeVisualization: "temporal" })}
              >
                Temporal
              </button>
              {vizGroup === "temporal" ? (
                <select
                  className="select-input compact-select"
                  value={state.distributionType}
                  onChange={(event) => saveState({ distributionType: event.target.value as DistributionType })}
                >
                  <option value="days_week">Days of week</option>
                  <option value="days_month">Days of month</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                  <option value="hours">Hours</option>
                  <option value="weeks">Weeks</option>
                </select>
              ) : null}
            </>
          }
        />

        <section className="panel exploration-surface exploration-section">
        <div className="panel-header">
          <h3>Event Log Data</h3>
          <div className="panel-actions">
            <button
              className={state.dataView === "events" ? "toggle-pill active" : "toggle-pill"}
              onClick={() => saveState({ dataView: "events" })}
            >
              Events table
            </button>
            <button
              className={state.dataView === "footprint" ? "toggle-pill active" : "toggle-pill"}
              onClick={() => saveState({ dataView: "footprint" })}
            >
              Footprint matrix
            </button>
            {state.dataView === "events"
              ? previewLimitOptions.map((limit) => (
                  <button
                    key={limit}
                    className={previewLimit === limit ? "toggle-pill active" : "toggle-pill"}
                    onClick={() => saveState({ eventPreviewLimit: limit })}
                  >
                    {limit}
                  </button>
                ))
              : null}
          </div>
        </div>

        {!state.result ? (
          <div className="empty-panel">No log data to display yet.</div>
        ) : state.dataView === "events" ? (
          <div className="table-wrap data-preview-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {state.result.event_columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((event, index) => (
                  <tr key={index}>
                    {state.result?.event_columns.map((column) => (
                      <td key={column}>{event[column]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FootprintTable matrix={state.result.footprint_matrix} />
        )}
        </section>

        {state.result ? (
          <>
            <section className="panel exploration-surface exploration-section exploration-section-slim">
            <div className="panel-header">
              <h3>Log Analysis</h3>
            </div>
            <div className="metrics-grid metrics-grid-dense">
              <MetricCard compact label="Events" value={String(state.result.insights.num_events)} />
              <MetricCard compact label="Cases" value={String(state.result.insights.num_cases)} />
              <MetricCard compact label="Activities" value={String(state.result.insights.num_activities)} />
              <MetricCard compact label="Trace variants" value={String(state.result.insights.num_trace_variants)} />
              <MetricCard compact label="Avg TPT" value={formatDuration(state.result.insights.log_avg_tpt)} />
              <MetricCard compact label="Median TPT" value={formatDuration(state.result.insights.log_median_tpt)} />
              <MetricCard compact label="Min TPT" value={formatDuration(state.result.insights.log_min_tpt)} />
              <MetricCard compact label="Max TPT" value={formatDuration(state.result.insights.log_max_tpt)} />
            </div>
            </section>

            <ActivityAnalysisPanel
              title="Activity Analysis"
              rows={activityRows}
              totalEvents={state.result.insights.num_events}
              shareBase={state.result.insights.num_cases}
              shareLabel="% in cases"
              colorMap={activityColors}
              emptyMessage="No activities are available for the selected log."
            />

            <TraceVariantAnalysisPanel
              title="Trace Variants Analysis"
              variants={state.result.insights.trace_variants}
              totalCases={state.result.insights.num_cases}
              colorMap={activityColors}
              emptyMessage="No trace variants are available for the selected log."
            />
          </>
        ) : null}
      </div>
    </PageShell>
  );
}

function MetricCard({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <article className={compact ? "metric-tile metric-tile-dense" : "metric-tile"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
