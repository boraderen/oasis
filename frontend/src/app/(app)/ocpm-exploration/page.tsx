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
import { SvgViewer } from "@/components/svg-viewer";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type { DfgPerformanceMetric, DistributionType, OcelExplorationResult } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const previewLimitOptions = [5, 25, 50];
const performanceMetricOptions: DfgPerformanceMetric[] = ["mean", "median", "max", "min", "sum", "stdev"];

export default function OCPMExplorationPage() {
  const state = useUiStore((store) => store.ocpmExploration);
  const setPageState = useUiStore((store) => store.setPageState);
  const ocelsQuery = useAssetList("ocel");
  const ocels = useMemo(() => ocelsQuery.data ?? [], [ocelsQuery.data]);

  const saveState = (patch: Partial<typeof state>, options?: { persist?: boolean }) => {
    const nextState = { ...state, ...patch };
    setPageState("ocpmExploration", patch);
    if (options?.persist !== false) {
      void persistPageState("ocpmExploration", nextState);
    }
  };

  useEffect(() => {
    if (state.selectedOcelId || !ocels.length) {
      return;
    }

    const selectedOcelId = ocels.at(-1)?.id ?? null;
    setPageState("ocpmExploration", { selectedOcelId });
    void persistPageState("ocpmExploration", { ...useUiStore.getState().ocpmExploration, selectedOcelId });
  }, [ocels, setPageState, state.selectedOcelId]);

  const explore = async () => {
    if (!state.selectedOcelId) {
      saveState({ error: "Select an OCEL first." });
      return;
    }
    saveState({ loading: true, error: null, successMessage: null });
    try {
      const response = await apiRequest<OcelExplorationResult>(`/api/analysis/ocels/${state.selectedOcelId}/exploration`, {
        method: "POST",
      });
      const firstObjectType = response.object_types[0] ?? null;
      saveState({
        loading: false,
        result: response,
        successMessage: `Exploring ${response.ocel_metadata.filename}`,
        selectedGraph: "ocdfg",
        selectedVizObjectType: firstObjectType,
        selectedDataObjectType: firstObjectType,
        selectedAnalysisObjectType: firstObjectType,
        selectedActivityView: "ocel",
        selectedVariantObjectType: firstObjectType,
      });
    } catch (requestError) {
      saveState({
        loading: false,
        error: requestError instanceof Error ? requestError.message : "OCEL exploration failed",
      });
    }
  };

  const selectedObjectGraphData = useMemo(() => {
    if (!state.result) {
      return null;
    }

    const objectData = state.result.object_type_data[state.selectedGraph];
    return objectData ? buildDfgDataFromInsights(objectData.insights) : null;
  }, [state.result, state.selectedGraph]);

  const currentSvgGraph = useMemo(() => {
    if (!state.result) {
      return null;
    }
    if (state.selectedGraph === "ocdfg") {
      return state.result.ocdfg_svg_content;
    }
    if (state.selectedGraph === "object_graph") {
      return state.result.object_graph_svg_content ?? state.result.ocdfg_svg_content;
    }
    return null;
  }, [state.result, state.selectedGraph]);

  const currentVizData = useMemo(() => {
    if (!state.result || !state.selectedVizObjectType) {
      return null;
    }
    const objectData = state.result.object_type_data[state.selectedVizObjectType];
    if (!objectData) {
      return null;
    }
    return objectData.visualization_data;
  }, [state.result, state.selectedVizObjectType]);

  const selectedAnalysis =
    state.result && state.selectedAnalysisObjectType ? state.result.object_type_data[state.selectedAnalysisObjectType] : null;
  const selectedData =
    state.result && state.selectedDataObjectType ? state.result.object_type_data[state.selectedDataObjectType] : null;
  const selectedActivityData =
    state.result && state.selectedActivityView !== "ocel" ? state.result.object_type_data[state.selectedActivityView] : null;
  const selectedVariant =
    state.result && state.selectedVariantObjectType ? state.result.object_type_data[state.selectedVariantObjectType] : null;

  const ocelActivityRows = useMemo(
    () =>
      state.result
        ? Object.entries(state.result.activity_counts)
            .map(([activity, frequency]) => ({
              activity,
              frequency,
              shareCount: state.result?.activity_case_counts[activity] ?? 0,
              durations: state.result?.activity_durations[activity] ?? { avg: 0, min: 0, max: 0, median: 0 },
            }))
            .sort((left, right) => right.frequency - left.frequency)
        : [],
    [state.result],
  );

  const objectActivityRows = useMemo(
    () =>
      selectedActivityData
        ? Object.entries(selectedActivityData.insights.activity_frequencies)
            .map(([activity, frequency]) => ({
              activity,
              frequency,
              shareCount: selectedActivityData.insights.activity_case_counts[activity] ?? 0,
              durations: selectedActivityData.insights.activity_durations[activity] ?? { avg: 0, min: 0, max: 0, median: 0 },
            }))
            .sort((left, right) => right.frequency - left.frequency)
        : [],
    [selectedActivityData],
  );

  const allActivities = useMemo(() => {
    const labels = new Set<string>();
    ocelActivityRows.forEach((row) => labels.add(row.activity));
    objectActivityRows.forEach((row) => labels.add(row.activity));
    selectedVariant?.insights.trace_variants.forEach((variant) => variant.activities.forEach((activity) => labels.add(activity)));
    return Array.from(labels);
  }, [objectActivityRows, ocelActivityRows, selectedVariant?.insights.trace_variants]);

  const activityColors = useMemo(() => buildActivityColorMap(allActivities), [allActivities]);
  const previewLimit = previewLimitOptions.includes(state.eventPreviewLimit) ? state.eventPreviewLimit : 5;
  const vizGroup: VizGroup = state.activeVisualization === "temporal" ? "temporal" : "charts";

  const ocelPreviewRows = useMemo(
    () => (state.result?.extended_table_rows ?? []).slice(0, previewLimit),
    [previewLimit, state.result?.extended_table_rows],
  );
  const flattenedPreviewRows = useMemo(
    () => (selectedData?.preview_events ?? selectedData?.first_20_events ?? []).slice(0, previewLimit),
    [previewLimit, selectedData],
  );

  return (
    <PageShell
      title="OCPM Exploration"
      description="Explore OCELs through a compact graph view, grouped flattened visualizations, lean data previews, and tighter object-type summaries."
    >
      <div className="exploration-page">
        {ocelsQuery.error ? (
          <div className="error-banner">{ocelsQuery.error instanceof Error ? ocelsQuery.error.message : "Failed to load OCELs"}</div>
        ) : null}

        <section className="exploration-control-strip">
          <select
            className="select-input"
            value={state.selectedOcelId ?? ""}
            onChange={(event) => saveState({ selectedOcelId: Number(event.target.value) || null })}
          >
            <option value="">Select an OCEL</option>
            {ocels.map((ocel) => (
              <option key={ocel.id} value={ocel.id}>
                {ocel.filename} ({ocel.num_events ?? 0} events)
              </option>
            ))}
          </select>
          <button className="primary-button" onClick={() => void explore()} disabled={state.loading || !ocels.length}>
            {state.loading ? "Working…" : "Explore OCEL"}
          </button>
        </section>

        {state.error ? <div className="error-banner">{state.error}</div> : null}
        {state.successMessage ? <div className="success-banner">{state.successMessage}</div> : null}

        {selectedObjectGraphData ? (
          <DynamicDfgViewer
            key={`${state.selectedOcelId ?? "none"}-${state.selectedGraph}`}
            title={state.dfgType === "regular" ? "Object-centric graph view" : "Object-centric performance DFG"}
            data={selectedObjectGraphData}
            mode={state.dfgType}
            performanceMetric={state.dfgPerformanceMetric}
            actions={
              <>
                <button
                  className={state.selectedGraph === "ocdfg" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ selectedGraph: "ocdfg" })}
                >
                  OCDFG
                </button>
                {state.result?.object_graph_svg_content ? (
                  <button
                    className={state.selectedGraph === "object_graph" ? "toggle-pill active" : "toggle-pill"}
                    onClick={() => saveState({ selectedGraph: "object_graph" })}
                  >
                    Object graph
                  </button>
                ) : null}
                {state.result?.object_types.map((objectType) =>
                  state.result?.object_type_data[objectType] ? (
                    <button
                      key={objectType}
                      className={state.selectedGraph === objectType ? "toggle-pill active" : "toggle-pill"}
                      onClick={() => saveState({ selectedGraph: objectType })}
                    >
                      {objectType}
                    </button>
                  ) : null,
                )}
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
            emptyMessage="Explore an OCEL to render the dynamic object-type DFG."
          />
        ) : (
          <SvgViewer
            title="Object-centric graph view"
            svg={currentSvgGraph}
            stageClassName="white-stage dfg-stage compact"
            fitKey={`${state.selectedOcelId ?? "none"}-${state.selectedGraph}`}
            actions={
              <>
                <button
                  className={state.selectedGraph === "ocdfg" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ selectedGraph: "ocdfg" })}
                >
                  OCDFG
                </button>
                {state.result?.object_graph_svg_content ? (
                  <button
                    className={state.selectedGraph === "object_graph" ? "toggle-pill active" : "toggle-pill"}
                    onClick={() => saveState({ selectedGraph: "object_graph" })}
                  >
                    Object graph
                  </button>
                ) : null}
                {state.result?.object_types.map((objectType) =>
                  state.result?.object_type_data[objectType] ? (
                    <button
                      key={objectType}
                      className={state.selectedGraph === objectType ? "toggle-pill active" : "toggle-pill"}
                      onClick={() => saveState({ selectedGraph: objectType })}
                    >
                      {objectType}
                    </button>
                  ) : null,
                )}
              </>
            }
          />
        )}

        <LogVisualizationViewer
          title="Flattened Visualizations"
          data={currentVizData}
          vizGroup={vizGroup}
          distributionType={state.distributionType as DistributionType}
          colorMap={activityColors}
          emptyMessage="Explore an OCEL to unlock flattened dotted charts and temporal visualizations."
          actions={
            <>
              {state.result?.object_types.map((objectType) =>
                state.result?.object_type_data[objectType] ? (
                  <button
                    key={objectType}
                    className={state.selectedVizObjectType === objectType ? "toggle-pill active" : "toggle-pill"}
                    onClick={() => saveState({ selectedVizObjectType: objectType })}
                  >
                    {objectType}
                  </button>
                ) : null,
              )}
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
          <h3>OCEL Data</h3>
          <div className="panel-actions">
            <button
              className={state.dataView === "ocel" ? "toggle-pill active" : "toggle-pill"}
              onClick={() => saveState({ dataView: "ocel" })}
            >
              OCEL table
            </button>
            <button
              className={state.dataView === "events" ? "toggle-pill active" : "toggle-pill"}
              onClick={() => saveState({ dataView: "events" })}
            >
              Flattened events
            </button>
            <button
              className={state.dataView === "footprint" ? "toggle-pill active" : "toggle-pill"}
              onClick={() => saveState({ dataView: "footprint" })}
            >
              Footprint matrix
            </button>
            {previewLimitOptions.map((limit) => (
              <button
                key={limit}
                className={previewLimit === limit ? "toggle-pill active" : "toggle-pill"}
                onClick={() => saveState({ eventPreviewLimit: limit })}
              >
                {limit}
              </button>
            ))}
          </div>
        </div>

        {state.dataView !== "ocel" ? (
          <div className="toolbar wrap">
            {state.result?.object_types.map((objectType) =>
              state.result?.object_type_data[objectType] ? (
                <button
                  key={objectType}
                  className={state.selectedDataObjectType === objectType ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ selectedDataObjectType: objectType })}
                >
                  {objectType}
                </button>
              ) : null,
            )}
          </div>
        ) : null}

        {!state.result ? (
          <div className="empty-panel">Explore an OCEL to inspect its tables.</div>
        ) : state.dataView === "ocel" ? (
          <Table rows={ocelPreviewRows} columns={state.result.table_columns} />
        ) : state.dataView === "events" && selectedData ? (
          <Table rows={flattenedPreviewRows} columns={selectedData.flattened_columns} />
        ) : selectedData ? (
          <FootprintTable matrix={selectedData.footprint_matrix} />
        ) : (
          <div className="empty-panel">Choose an object type.</div>
        )}
        </section>

        {state.result ? (
          <>
            <section className="panel exploration-surface exploration-section exploration-section-slim">
              <div className="ocel-overview-grid">
                <section className="ocel-overview-block">
                  <div className="panel-header">
                    <h3>OCEL Summary</h3>
                  </div>
                  <div className="metrics-grid metrics-grid-dense">
                    <Metric compact label="Events" value={String(state.result.num_events)} />
                    <Metric compact label="Objects" value={String(state.result.num_objects)} />
                    <Metric compact label="Activities" value={String(state.result.num_activities)} />
                    <Metric compact label="Object types" value={String(state.result.object_types.length)} />
                  </div>
                </section>

                <section className="ocel-overview-block">
                  <div className="panel-header">
                    <h3>Object Type Distribution</h3>
                  </div>
                  <div className="ocel-object-list">
                    {Object.entries(state.result.object_type_counts)
                      .sort((left, right) => right[1] - left[1])
                      .map(([objectType, count]) => (
                        <article key={objectType} className="ocel-object-row">
                          <div className="ocel-object-row-copy">
                            <strong>{objectType}</strong>
                            <small>{count} objects</small>
                          </div>
                          <div className="ocel-object-row-bar">
                            <div className="ocel-object-row-fill" style={{ width: `${Math.max(4, (count / Math.max(state.result!.num_objects, 1)) * 100)}%` }} />
                          </div>
                        </article>
                      ))}
                  </div>
                </section>
              </div>
            </section>

            <section className="panel exploration-surface exploration-section exploration-section-slim">
              <div className="panel-header">
                <h3>Log Analysis</h3>
                <div className="panel-actions wrap">
                  {state.result.object_types.map((objectType) =>
                    state.result?.object_type_data[objectType] ? (
                      <button
                        key={objectType}
                        className={state.selectedAnalysisObjectType === objectType ? "toggle-pill active" : "toggle-pill"}
                        onClick={() => saveState({ selectedAnalysisObjectType: objectType })}
                      >
                        {objectType}
                      </button>
                    ) : null,
                  )}
                </div>
              </div>
              {selectedAnalysis ? (
                <div className="metrics-grid metrics-grid-dense">
                  <Metric compact label="Events" value={String(selectedAnalysis.insights.num_events)} />
                  <Metric compact label="Cases" value={String(selectedAnalysis.insights.num_cases)} />
                  <Metric compact label="Activities" value={String(selectedAnalysis.insights.num_activities)} />
                  <Metric compact label="Trace variants" value={String(selectedAnalysis.insights.num_trace_variants)} />
                  <Metric compact label="Avg TPT" value={formatDuration(selectedAnalysis.insights.log_avg_tpt)} />
                  <Metric compact label="Median TPT" value={formatDuration(selectedAnalysis.insights.log_median_tpt)} />
                  <Metric compact label="Min TPT" value={formatDuration(selectedAnalysis.insights.log_min_tpt)} />
                  <Metric compact label="Max TPT" value={formatDuration(selectedAnalysis.insights.log_max_tpt)} />
                </div>
              ) : (
                <div className="empty-panel">Choose an object type to inspect flattened log statistics.</div>
              )}
            </section>

            {state.selectedActivityView === "ocel" ? (
              <ActivityAnalysisPanel
                title="Activity Analysis"
                rows={ocelActivityRows}
                totalEvents={state.result.num_events}
                shareBase={state.result.num_cases}
                shareLabel="% in cases"
                colorMap={activityColors}
                emptyMessage="No OCEL activities are available."
                actions={
                  <>
                    <button
                      className={state.selectedActivityView === "ocel" ? "toggle-pill active" : "toggle-pill"}
                      onClick={() => saveState({ selectedActivityView: "ocel" })}
                    >
                      OCEL
                    </button>
                    {state.result.object_types.map((objectType) =>
                      state.result?.object_type_data[objectType] ? (
                        <button
                          key={objectType}
                          className={state.selectedActivityView === objectType ? "toggle-pill active" : "toggle-pill"}
                          onClick={() => saveState({ selectedActivityView: objectType })}
                        >
                          {objectType}
                        </button>
                      ) : null,
                    )}
                  </>
                }
              />
            ) : (
              <ActivityAnalysisPanel
                title={`Activity Analysis · ${state.selectedActivityView}`}
                rows={objectActivityRows}
                totalEvents={selectedActivityData?.insights.num_events ?? 0}
                shareBase={selectedActivityData?.insights.num_cases ?? 0}
                shareLabel="% in cases"
                colorMap={activityColors}
                emptyMessage="No flattened activities are available for the selected object type."
                actions={
                  <>
                    <button
                      className={state.selectedActivityView === "ocel" ? "toggle-pill active" : "toggle-pill"}
                      onClick={() => saveState({ selectedActivityView: "ocel" })}
                    >
                      OCEL
                    </button>
                    {state.result.object_types.map((objectType) =>
                      state.result?.object_type_data[objectType] ? (
                        <button
                          key={objectType}
                          className={state.selectedActivityView === objectType ? "toggle-pill active" : "toggle-pill"}
                          onClick={() => saveState({ selectedActivityView: objectType })}
                        >
                          {objectType}
                        </button>
                      ) : null,
                    )}
                  </>
                }
              />
            )}

            <TraceVariantAnalysisPanel
              title={`Trace Variants Analysis${state.selectedVariantObjectType ? ` · ${state.selectedVariantObjectType}` : ""}`}
              variants={selectedVariant?.insights.trace_variants ?? []}
              totalCases={selectedVariant?.insights.num_cases ?? 0}
              colorMap={activityColors}
              emptyMessage="No trace variants are available for the selected object type."
              actions={
                <>
                  {state.result.object_types.map((objectType) =>
                    state.result?.object_type_data[objectType] ? (
                      <button
                        key={objectType}
                        className={state.selectedVariantObjectType === objectType ? "toggle-pill active" : "toggle-pill"}
                        onClick={() => saveState({ selectedVariantObjectType: objectType })}
                      >
                        {objectType}
                      </button>
                    ) : null,
                  )}
                </>
              }
            />
          </>
        ) : null}
      </div>
    </PageShell>
  );
}

function Table({ rows, columns }: { rows: Array<Record<string, string>>; columns: string[] }) {
  return (
    <div className="table-wrap data-preview-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column}>{String(row[column] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <article className={compact ? "metric-tile metric-tile-dense" : "metric-tile"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
