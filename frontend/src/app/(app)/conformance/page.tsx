"use client";

import { useMemo, useState } from "react";

import { activityForegroundColor, buildActivityColorMap, FootprintTableCard, metricPercent } from "@/components/analysis-ui";
import { DynamicDfgViewer, buildDfgDataFromInsights } from "@/components/analysis/dynamic-dfg-viewer";
import { PageShell } from "@/components/page-shell";
import { ProcessModelViewer } from "@/components/process-model-viewer";
import { SvgViewer } from "@/components/svg-viewer";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type {
  ConformanceResult,
  ConformanceVariant,
  CustomTraceDiagnostics,
  DfgPerformanceMetric,
} from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const performanceMetricOptions: DfgPerformanceMetric[] = ["mean", "median", "max", "min", "sum", "stdev"];

function buildBpmnFilename(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, "") || "process-model";
  return `${baseName}.bpmn`;
}

export default function ConformancePage() {
  const state = useUiStore((store) => store.conformance);
  const setPageState = useUiStore((store) => store.setPageState);
  const logsQuery = useAssetList("log");
  const modelsQuery = useAssetList("model");
  const logs = logsQuery.data ?? [];
  const models = modelsQuery.data ?? [];

  const saveState = (patch: Partial<typeof state>) => {
    const nextState = { ...state, ...patch };
    setPageState("conformance", patch);
    void persistPageState("conformance", nextState);
  };

  const runConformance = async () => {
    saveState({ loading: true, error: null, successMessage: null, result: null });

    let endpoint = "";
    let body: Record<string, number> = {};
    if (state.variant === "log-log") {
      if (!state.selectedLog1 || !state.selectedLog2) {
        saveState({ loading: false, error: "Select both logs first." });
        return;
      }
      endpoint = "/api/analysis/conformance/log-log";
      body = { first_log_id: state.selectedLog1, second_log_id: state.selectedLog2 };
    } else if (state.variant === "log-model") {
      if (!state.selectedLog || !state.selectedModel) {
        saveState({ loading: false, error: "Select both a log and a model first." });
        return;
      }
      endpoint = "/api/analysis/conformance/log-model";
      body = { log_id: state.selectedLog, model_id: state.selectedModel };
    } else {
      if (!state.selectedModel1 || !state.selectedModel2) {
        saveState({ loading: false, error: "Select both models first." });
        return;
      }
      endpoint = "/api/analysis/conformance/model-model";
      body = { first_model_id: state.selectedModel1, second_model_id: state.selectedModel2 };
    }

    try {
      const response = await apiRequest<ConformanceResult>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveState({ loading: false, result: response, successMessage: response.message });
    } catch (requestError) {
      saveState({
        loading: false,
        error: requestError instanceof Error ? requestError.message : "Conformance check failed",
      });
    }
  };

  const runCustomTrace = async () => {
    if (!state.selectedLog || !state.selectedModel) {
      saveState({ error: "Select both a log and a model first." });
      return;
    }

    const activities = state.customTrace
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!activities.length) {
      saveState({ error: "Enter a comma-separated trace first." });
      return;
    }

    saveState({ computingCustom: true, error: null, customAlignment: null });
    try {
      const response = await apiRequest<CustomTraceDiagnostics & { status: string; message: string }>(
        "/api/analysis/conformance/custom-trace",
        {
          method: "POST",
          body: JSON.stringify({
            log_id: state.selectedLog,
            model_id: state.selectedModel,
            trace_activities: activities,
          }),
        },
      );
      saveState({
        computingCustom: false,
        customAlignment: {
          alignment: response.alignment,
          fitness: response.fitness,
          tbr: response.tbr,
        },
      });
    } catch (requestError) {
      saveState({
        computingCustom: false,
        error: requestError instanceof Error ? requestError.message : "Failed to compute trace diagnostics",
      });
    }
  };

  const currentAlignmentRows = useMemo(
    () =>
      state.result?.alignment_data?.map((item, index) => (
        <AlignmentCard
          key={`${item.variant.join("-")}-${index}`}
          title={`Variant #${index + 1}`}
          frequency={`${item.frequency} cases`}
          suffix={`fitness ${metricPercent(item.fitness)}`}
          alignment={item.alignment}
        />
      )) ?? [],
    [state.result?.alignment_data],
  );

  const currentTbrRows = useMemo(
    () =>
      state.result?.tbr_data?.map((item, index) => (
        <article key={`${item.variant.join("-")}-${index}`} className="alignment-card">
          <div className="alignment-head">
            <strong>Variant #{index + 1}</strong>
            <span>{item.frequency} cases</span>
            <span>{item.trace_is_fit ? "fit" : "unfit"}</span>
            <span>fitness {metricPercent(item.trace_fitness)}</span>
          </div>
          <ColoredVariantChips activities={item.variant} />
          <div className="metrics-inline">
            <MetricInline label="Missing" value={String(item.missing_tokens)} />
            <MetricInline label="Consumed" value={String(item.consumed_tokens)} />
            <MetricInline label="Remaining" value={String(item.remaining_tokens)} />
            <MetricInline label="Produced" value={String(item.produced_tokens)} />
          </div>
        </article>
      )) ?? [],
    [state.result?.tbr_data],
  );

  return (
    <PageShell
      title="Conformance"
      description="Compare logs and models with full-width DFG, Petri net, and BPMN views, colored footprint matrices, and scroll-contained diagnostics."
    >
      {logsQuery.error || modelsQuery.error ? (
        <div className="error-banner">
          {logsQuery.error instanceof Error
            ? logsQuery.error.message
            : modelsQuery.error instanceof Error
              ? modelsQuery.error.message
              : "Failed to load logs or models"}
        </div>
      ) : null}

      <section className="panel">
        <div className="toolbar wrap">
          {(["log-log", "log-model", "model-model"] as ConformanceVariant[]).map((variant) => (
            <button
              key={variant}
              className={state.variant === variant ? "primary-button" : "ghost-button"}
              onClick={() => saveState({ variant })}
            >
              {variant}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="grid two-up">
          {state.variant === "log-log" ? (
            <>
              <SelectField
                label="First log"
                value={state.selectedLog1}
                onChange={(value) => saveState({ selectedLog1: value })}
                items={logs}
              />
              <SelectField
                label="Second log"
                value={state.selectedLog2}
                onChange={(value) => saveState({ selectedLog2: value })}
                items={logs}
              />
            </>
          ) : null}

          {state.variant === "log-model" ? (
            <>
              <SelectField
                label="Event log"
                value={state.selectedLog}
                onChange={(value) => saveState({ selectedLog: value })}
                items={logs}
              />
              <SelectField
                label="Process model"
                value={state.selectedModel}
                onChange={(value) => saveState({ selectedModel: value })}
                items={models}
              />
            </>
          ) : null}

          {state.variant === "model-model" ? (
            <>
              <SelectField
                label="First model"
                value={state.selectedModel1}
                onChange={(value) => saveState({ selectedModel1: value })}
                items={models}
              />
              <SelectField
                label="Second model"
                value={state.selectedModel2}
                onChange={(value) => saveState({ selectedModel2: value })}
                items={models}
              />
            </>
          ) : null}
        </div>
        <button className="primary-button" onClick={() => void runConformance()} disabled={state.loading}>
          {state.loading ? "Running…" : "Check conformance"}
        </button>
      </section>

      {state.error ? <div className="error-banner">{state.error}</div> : null}
      {state.successMessage ? <div className="success-banner">{state.successMessage}</div> : null}

      {state.result ? (
        <ConformanceResultView
          customTrace={state.customTrace}
          customAlignment={state.customAlignment}
          customDiagnosticsView={state.customDiagnosticsView}
          result={state.result}
          runCustomTrace={runCustomTrace}
          saveState={saveState}
          computingCustom={state.computingCustom}
          variant={state.variant}
          variantDiagnosticsView={state.variantDiagnosticsView}
          currentAlignmentRows={currentAlignmentRows}
          currentTbrRows={currentTbrRows}
        />
      ) : null}
    </PageShell>
  );
}

function ConformanceResultView({
  result,
  variant,
  variantDiagnosticsView,
  customDiagnosticsView,
  customTrace,
  customAlignment,
  computingCustom,
  currentAlignmentRows,
  currentTbrRows,
  saveState,
  runCustomTrace,
}: {
  result: ConformanceResult;
  variant: ConformanceVariant;
  variantDiagnosticsView: "alignments" | "tbr";
  customDiagnosticsView: "alignments" | "tbr";
  customTrace: string;
  customAlignment: CustomTraceDiagnostics | null;
  computingCustom: boolean;
  currentAlignmentRows: React.ReactNode[];
  currentTbrRows: React.ReactNode[];
  saveState: (patch: Partial<ReturnType<typeof useUiStore.getState>["conformance"]>) => void;
  runCustomTrace: () => Promise<void>;
}) {
  const [dfgType, setDfgType] = useState<"regular" | "performance">("regular");
  const [dfgPerformanceMetric, setDfgPerformanceMetric] = useState<DfgPerformanceMetric>("mean");
  const log1DfgData = useMemo(
    () => (result.log1_insights ? buildDfgDataFromInsights(result.log1_insights) : null),
    [result.log1_insights],
  );
  const log2DfgData = useMemo(
    () => (result.log2_insights ? buildDfgDataFromInsights(result.log2_insights) : null),
    [result.log2_insights],
  );
  const logDfgData = useMemo(
    () => (result.log_insights ? buildDfgDataFromInsights(result.log_insights) : null),
    [result.log_insights],
  );

  const renderDfgActions = () => (
    <>
      <button className={dfgType === "regular" ? "toggle-pill active" : "toggle-pill"} onClick={() => setDfgType("regular")}>
        Regular
      </button>
      <button
        className={dfgType === "performance" ? "toggle-pill active" : "toggle-pill"}
        onClick={() => setDfgType("performance")}
      >
        Performance
      </button>
      {dfgType === "performance"
        ? performanceMetricOptions.map((metric) => (
            <button
              key={metric}
              className={dfgPerformanceMetric === metric ? "toggle-pill active" : "toggle-pill"}
              onClick={() => setDfgPerformanceMetric(metric)}
            >
              {metric}
            </button>
          ))
        : null}
    </>
  );

  return (
    <div className="analysis-stack">
      {variant === "log-log" ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h3>Log-Log Summary</h3>
            </div>
            <div className="metrics-inline">
              <MetricInline label="Events (log 1)" value={String(result.num_events_1 ?? "-")} />
              <MetricInline label="Cases (log 1)" value={String(result.num_cases_1 ?? "-")} />
              <MetricInline label="Events (log 2)" value={String(result.num_events_2 ?? "-")} />
              <MetricInline label="Cases (log 2)" value={String(result.num_cases_2 ?? "-")} />
              <MetricInline label="Footprint conf." value={metricPercent(result.footprint_conformance)} />
              <MetricInline label="Diff. cells" value={String(result.num_different_cells ?? "-")} />
            </div>
          </section>

          {result.footprint1_matrix || result.footprint2_matrix ? (
            <div className="footprint-pair">
              {result.footprint1_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.log1_metadata?.filename ?? "First log"}`}
                  matrix={result.footprint1_matrix}
                />
              ) : null}
              {result.footprint2_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.log2_metadata?.filename ?? "Second log"}`}
                  matrix={result.footprint2_matrix}
                />
              ) : null}
            </div>
          ) : null}

          {log1DfgData ? (
            <DynamicDfgViewer
              title={dfgType === "regular" ? `${result.log1_metadata?.filename ?? "First log"} Regular DFG` : `${result.log1_metadata?.filename ?? "First log"} Performance DFG`}
              data={log1DfgData}
              mode={dfgType}
              performanceMetric={dfgPerformanceMetric}
              actions={renderDfgActions()}
              emptyMessage="No DFG data available for the first log."
            />
          ) : result.log1_svg ? (
            <SvgViewer
              title={result.log1_metadata?.filename ?? "First log DFG"}
              svg={result.log1_svg}
              stageClassName="white-stage dfg-stage"
              fitKey={`log1-${result.log1_metadata?.filename ?? "empty"}`}
            />
          ) : null}
          {log2DfgData ? (
            <DynamicDfgViewer
              title={dfgType === "regular" ? `${result.log2_metadata?.filename ?? "Second log"} Regular DFG` : `${result.log2_metadata?.filename ?? "Second log"} Performance DFG`}
              data={log2DfgData}
              mode={dfgType}
              performanceMetric={dfgPerformanceMetric}
              actions={renderDfgActions()}
              emptyMessage="No DFG data available for the second log."
            />
          ) : result.log2_svg ? (
            <SvgViewer
              title={result.log2_metadata?.filename ?? "Second log DFG"}
              svg={result.log2_svg}
              stageClassName="white-stage dfg-stage"
              fitKey={`log2-${result.log2_metadata?.filename ?? "empty"}`}
            />
          ) : null}
        </>
      ) : null}

      {variant === "log-model" ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h3>Log-Model Summary</h3>
            </div>
            <div className="metrics-inline">
              <MetricInline label="Events" value={String(result.num_events ?? "-")} />
              <MetricInline label="Cases" value={String(result.num_cases ?? "-")} />
              <MetricInline label="Places" value={String(result.num_places ?? "-")} />
              <MetricInline label="Trans." value={String(result.num_transitions ?? "-")} />
              <MetricInline label="Arcs" value={String(result.num_arcs ?? "-")} />
              <MetricInline label="Simplicity" value={metricPercent(result.simplicity)} />
              <MetricInline label="Footprint conf." value={metricPercent(result.footprint_conformance)} />
              <MetricInline label="Diff. cells" value={String(result.num_different_cells ?? "-")} />
              <MetricInline label="Align fit." value={metricPercent(result.align_fitness)} />
              <MetricInline label="Align prec." value={metricPercent(result.align_precision)} />
              <MetricInline label="Align F1" value={metricPercent(result.align_f1)} />
              <MetricInline label="TBR fit." value={metricPercent(result.tbr_fitness)} />
              <MetricInline label="TBR prec." value={metricPercent(result.tbr_precision)} />
              <MetricInline label="TBR F1" value={metricPercent(result.tbr_f1)} />
              <MetricInline label="Mean fit." value={metricPercent(result.mean_fitness_combined ?? result.mean_fitness)} />
              <MetricInline label="Mean prec." value={metricPercent(result.mean_precision_combined ?? result.mean_precision)} />
              <MetricInline label="Mean F1" value={metricPercent(result.mean_f1_combined)} />
            </div>
          </section>

          {result.log_footprint_matrix || result.model_footprint_matrix ? (
            <div className="footprint-pair">
              {result.log_footprint_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.log_metadata?.filename ?? "Selected log"}`}
                  matrix={result.log_footprint_matrix}
                />
              ) : null}
              {result.model_footprint_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.model_metadata?.filename ?? "Selected model"}`}
                  matrix={result.model_footprint_matrix}
                />
              ) : null}
            </div>
          ) : null}

          <section className="panel">
            <div className="panel-header">
              <h3>Trace Variant Diagnostics</h3>
              <div className="panel-actions">
                <button
                  className={variantDiagnosticsView === "alignments" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ variantDiagnosticsView: "alignments" })}
                >
                  Alignments
                </button>
                <button
                  className={variantDiagnosticsView === "tbr" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ variantDiagnosticsView: "tbr" })}
                >
                  TBR
                </button>
              </div>
            </div>
            <div className="diagnostics-scroll">
              {variantDiagnosticsView === "alignments"
                ? currentAlignmentRows.length
                  ? currentAlignmentRows
                  : <div className="empty-panel">No alignment diagnostics were returned.</div>
                : currentTbrRows.length
                  ? currentTbrRows
                  : <div className="empty-panel">No token replay diagnostics were returned.</div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h3>Custom Trace Diagnostics</h3>
              <div className="panel-actions">
                <button
                  className={customDiagnosticsView === "alignments" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ customDiagnosticsView: "alignments" })}
                >
                  Alignments
                </button>
                <button
                  className={customDiagnosticsView === "tbr" ? "toggle-pill active" : "toggle-pill"}
                  onClick={() => saveState({ customDiagnosticsView: "tbr" })}
                >
                  TBR
                </button>
              </div>
            </div>
            <label className="field">
              <span>Comma-separated activities</span>
              <input
                value={customTrace}
                onChange={(event) => saveState({ customTrace: event.target.value })}
                placeholder="submitted, approved, finalized"
              />
            </label>
            <button className="primary-button" onClick={() => void runCustomTrace()} disabled={computingCustom}>
              {computingCustom ? "Computing…" : "Compute diagnostics"}
            </button>

            {customAlignment ? (
              customDiagnosticsView === "alignments" ? (
                <AlignmentCard
                  title="Custom trace"
                  frequency="Manual trace"
                  suffix={`fitness ${metricPercent(customAlignment.fitness)}`}
                  alignment={customAlignment.alignment}
                />
              ) : (
                <div className="metrics-inline">
                  <MetricInline label="Trace fitness" value={metricPercent(customAlignment.tbr.trace_fitness)} />
                  <MetricInline label="Missing" value={String(customAlignment.tbr.missing_tokens)} />
                  <MetricInline label="Consumed" value={String(customAlignment.tbr.consumed_tokens)} />
                  <MetricInline label="Remaining" value={String(customAlignment.tbr.remaining_tokens)} />
                  <MetricInline label="Produced" value={String(customAlignment.tbr.produced_tokens)} />
                </div>
              )
            ) : null}
          </section>

          {logDfgData ? (
            <DynamicDfgViewer
              title={dfgType === "regular" ? `${result.log_metadata?.filename ?? "Log"} Regular DFG` : `${result.log_metadata?.filename ?? "Log"} Performance DFG`}
              data={logDfgData}
              mode={dfgType}
              performanceMetric={dfgPerformanceMetric}
              actions={renderDfgActions()}
              emptyMessage="No DFG data available for this log."
            />
          ) : result.log_svg ? (
            <SvgViewer
              title={result.log_metadata?.filename ?? "Log DFG"}
              svg={result.log_svg}
              stageClassName="white-stage dfg-stage"
              fitKey={`log-${result.log_metadata?.filename ?? "empty"}`}
            />
          ) : null}
          {result.model_svg || result.model_bpmn_svg ? (
            <ProcessModelViewer
              title={result.model_metadata?.filename ?? "Model"}
              petriSvg={result.model_svg}
              bpmnSvg={result.model_bpmn_svg}
              bpmnContent={result.model_bpmn_content}
              bpmnFilename={result.model_metadata?.filename ? buildBpmnFilename(result.model_metadata.filename) : null}
              stageClassName="white-stage algorithm-stage"
              fitKey={`model-${result.model_metadata?.filename ?? "empty"}`}
            />
          ) : null}
        </>
      ) : null}

      {variant === "model-model" ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h3>Model-Model Summary</h3>
            </div>
            <div className="metrics-inline">
              <MetricInline label="Places (m1)" value={String(result.num_places_1 ?? "-")} />
              <MetricInline label="Trans. (m1)" value={String(result.num_transitions_1 ?? "-")} />
              <MetricInline label="Arcs (m1)" value={String(result.num_arcs_1 ?? "-")} />
              <MetricInline label="Places (m2)" value={String(result.num_places_2 ?? "-")} />
              <MetricInline label="Trans. (m2)" value={String(result.num_transitions_2 ?? "-")} />
              <MetricInline label="Arcs (m2)" value={String(result.num_arcs_2 ?? "-")} />
              <MetricInline label="Footprint conf." value={metricPercent(result.footprint_conformance)} />
              <MetricInline label="Diff. cells" value={String(result.num_different_cells ?? "-")} />
            </div>
          </section>

          {result.footprint1_matrix || result.footprint2_matrix ? (
            <div className="footprint-pair">
              {result.footprint1_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.model1_metadata?.filename ?? "First model"}`}
                  matrix={result.footprint1_matrix}
                />
              ) : null}
              {result.footprint2_matrix ? (
                <FootprintTableCard
                  title={`Footprint · ${result.model2_metadata?.filename ?? "Second model"}`}
                  matrix={result.footprint2_matrix}
                />
              ) : null}
            </div>
          ) : null}

          {result.model1_svg || result.model1_bpmn_svg ? (
            <ProcessModelViewer
              title={result.model1_metadata?.filename ?? "First model"}
              petriSvg={result.model1_svg}
              bpmnSvg={result.model1_bpmn_svg}
              bpmnContent={result.model1_bpmn_content}
              bpmnFilename={result.model1_metadata?.filename ? buildBpmnFilename(result.model1_metadata.filename) : null}
              stageClassName="white-stage algorithm-stage"
              fitKey={`model1-${result.model1_metadata?.filename ?? "empty"}`}
            />
          ) : null}
          {result.model2_svg || result.model2_bpmn_svg ? (
            <ProcessModelViewer
              title={result.model2_metadata?.filename ?? "Second model"}
              petriSvg={result.model2_svg}
              bpmnSvg={result.model2_bpmn_svg}
              bpmnContent={result.model2_bpmn_content}
              bpmnFilename={result.model2_metadata?.filename ? buildBpmnFilename(result.model2_metadata.filename) : null}
              stageClassName="white-stage algorithm-stage"
              fitKey={`model2-${result.model2_metadata?.filename ?? "empty"}`}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  items: Array<{ id: number; filename: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="select-input" value={value ?? ""} onChange={(event) => onChange(Number(event.target.value) || null)}>
        <option value="">Select</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.filename}
          </option>
        ))}
      </select>
    </label>
  );
}

function AlignmentCard({
  title,
  frequency,
  suffix,
  alignment,
}: {
  title: string;
  frequency: string;
  suffix: string;
  alignment: Array<[string | null, string | null]>;
}) {
  return (
    <article className="alignment-card">
      <div className="alignment-head">
        <strong>{title}</strong>
        <span>{frequency}</span>
        <span>{suffix}</span>
      </div>
      <AlignmentTrack label="Log" moves={alignment.map((pair) => pair[0])} />
      <AlignmentTrack label="Model" moves={alignment.map((pair) => pair[1])} />
    </article>
  );
}

function AlignmentTrack({ label, moves }: { label: string; moves: Array<string | null> }) {
  const colorMap = useMemo(
    () =>
      buildActivityColorMap(
        moves.filter((move): move is string => Boolean(move) && move !== ">>"),
      ),
    [moves],
  );

  return (
    <div className="alignment-track">
      <span>{label}</span>
      <div className="chip-flow">
        {moves.map((move, index) => {
          const display = move === null ? "τ" : move;
          const color =
            move && move !== ">>"
              ? (() => {
                  const backgroundColor = colorMap[move];
                  return { backgroundColor, color: activityForegroundColor(backgroundColor) };
                })()
              : undefined;
          return (
            <span key={`${move ?? "tau"}-${index}`} className={move === ">>" ? "chip warning" : "chip"} style={color}>
              {display}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ColoredVariantChips({ activities }: { activities: string[] }) {
  const colorMap = useMemo(
    () => buildActivityColorMap(activities),
    [activities],
  );

  return (
    <div className="chip-flow">
      {activities.map((activity, index) => {
        const backgroundColor = colorMap[activity];
        return (
          <span
            key={`${activity}-${index}`}
            className="chip"
            style={{ backgroundColor, color: activityForegroundColor(backgroundColor) }}
          >
            {activity}
          </span>
        );
      })}
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: string }) {
  return (
    <span className="metric-inline">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}
