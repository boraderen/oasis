export type AssetKind = "log" | "model" | "ocel";
export type DiscoveryAlgorithm = "alpha" | "ilp" | "heuristics" | "inductive";
export type ConformanceVariant = "log-log" | "log-model" | "model-model";
export type OCPMVariant = "im" | "imd";
export type DfgVariantMode = "all" | "manual" | "top_k";
export type DfgPerformanceMetric = "mean" | "median" | "max" | "min" | "sum" | "stdev";
export type VisualizationMode = "dotted" | "duration" | "time" | "distribution" | "charts" | "temporal";
export type DistributionType = "days_month" | "months" | "years" | "hours" | "days_week" | "weeks";

export interface User {
  id: number;
  username: string;
  is_guest: boolean;
  created_at: string;
}

export interface AuthResponse {
  status: string;
  user: User;
  access_token?: string | null;
  token_type?: "bearer" | null;
}

export interface DashboardSummary {
  counts: Record<AssetKind, number>;
}

export interface AssetSummary {
  id: number;
  kind: AssetKind;
  filename: string;
  created_at: string;
  num_events?: number;
  num_cases?: number;
  num_activities?: number;
  num_objects?: number;
  object_types?: string[];
  model_type?: string;
  num_places?: number;
  num_transitions?: number;
  num_arcs?: number;
}

export interface ActivityDuration {
  avg: number;
  min: number;
  max: number;
  median: number;
}

export interface TraceVariant {
  activities: string[];
  frequency: number;
  percentage: number;
  avg_tpt: number;
  min_tpt: number;
  max_tpt: number;
  median_tpt: number;
  edge_performance: VariantEdgePerformance[];
}

export interface DfgVariantOption {
  activities: string[];
  frequency: number;
}

export interface DfgEdge {
  source: string;
  target: string;
  count: number;
}

export interface PerformanceDfgEdge {
  source: string;
  target: string;
  mean: number;
  median: number;
  max: number;
  min: number;
  sum: number;
  stdev: number;
  occurrences: number;
}

export interface VariantEdgePerformance {
  source: string;
  target: string;
  samples: number[];
}

export interface FootprintMatrix {
  activities: string[];
  matrix: string[][];
}

export interface LogInsights {
  num_events: number;
  num_cases: number;
  num_activities: number;
  num_trace_variants: number;
  activity_frequencies: Record<string, number>;
  activity_case_counts: Record<string, number>;
  activity_durations: Record<string, ActivityDuration>;
  trace_variants: TraceVariant[];
  start_activities: Record<string, number>;
  end_activities: Record<string, number>;
  regular_dfg: DfgEdge[];
  performance_dfg: PerformanceDfgEdge[];
  log_avg_tpt: number;
  log_min_tpt: number;
  log_max_tpt: number;
  log_median_tpt: number;
}

export interface VisualizationEventPoint {
  case_id: string;
  case_index: number;
  activity: string;
  timestamp: string;
}

export interface CaseDurationPoint {
  case_id: string;
  start_timestamp: string;
  end_timestamp: string;
  duration_seconds: number;
}

export interface LogVisualizationData {
  event_points: VisualizationEventPoint[];
  case_durations: CaseDurationPoint[];
}

export interface LogExplorationResult {
  message: string;
  status: string;
  log_metadata: AssetSummary & { original_columns?: string[] };
  regular_svg_content: string;
  performance_svg_content: string;
  insights: LogInsights;
  available_activities: string[];
  available_variants: DfgVariantOption[];
  filtered_case_count?: number;
  filtered_event_count?: number;
  kept_variant_count?: number;
  visualization_data: LogVisualizationData;
  preview_events?: Array<Record<string, string>>;
  first_20_events?: Array<Record<string, string>>;
  event_columns: string[];
  footprint_matrix: FootprintMatrix;
}

export interface DfgUpdateResult {
  message: string;
  status: string;
  regular_svg_content: string;
  performance_svg_content: string;
  available_variants: DfgVariantOption[];
  filtered_case_count: number;
  filtered_event_count: number;
  kept_variant_count: number;
}

export interface DiscoveryResult {
  message: string;
  status: string;
  svg_content: string;
  bpmn_svg_content?: string;
  bpmn_content?: string;
  pnml_content: string;
  log_metadata: AssetSummary;
  log_stats?: LogInsights;
  tbr_fitness: number;
  align_fitness: number | string;
  tbr_precision: number;
  align_precision: number | string;
  tbr_f1: number;
  align_f1: number | string;
  mean_fitness: number;
  mean_precision: number;
  mean_f1?: number;
  num_places: number;
  num_transitions: number;
  num_arcs: number;
}

export interface ConformanceResult {
  message: string;
  status: string;
  log1_metadata?: AssetSummary;
  log2_metadata?: AssetSummary;
  log_metadata?: AssetSummary;
  log1_insights?: LogInsights;
  log2_insights?: LogInsights;
  log_insights?: LogInsights;
  model_metadata?: AssetSummary;
  model1_metadata?: AssetSummary;
  model2_metadata?: AssetSummary;
  log1_svg?: string;
  log2_svg?: string;
  log_svg?: string;
  model_svg?: string;
  model1_svg?: string;
  model2_svg?: string;
  model_bpmn_svg?: string;
  model1_bpmn_svg?: string;
  model2_bpmn_svg?: string;
  model_bpmn_content?: string;
  model1_bpmn_content?: string;
  model2_bpmn_content?: string;
  num_events_1?: number;
  num_cases_1?: number;
  num_events_2?: number;
  num_cases_2?: number;
  num_events?: number;
  num_cases?: number;
  num_places?: number;
  num_transitions?: number;
  num_arcs?: number;
  num_places_1?: number;
  num_transitions_1?: number;
  num_arcs_1?: number;
  num_places_2?: number;
  num_transitions_2?: number;
  num_arcs_2?: number;
  footprint1_matrix?: FootprintMatrix;
  footprint2_matrix?: FootprintMatrix;
  log_footprint_matrix?: FootprintMatrix;
  model_footprint_matrix?: FootprintMatrix;
  num_different_cells?: number;
  footprint_conformance?: number;
  alignment_data?: Array<{
    variant: string[];
    frequency: number;
    alignment: Array<[string | null, string | null]>;
    fitness: number;
  }>;
  tbr_data?: Array<{
    variant: string[];
    frequency: number;
    missing_tokens: number;
    consumed_tokens: number;
    remaining_tokens: number;
    produced_tokens: number;
    trace_is_fit: boolean;
    trace_fitness: number;
  }>;
  tbr_fitness?: number;
  align_fitness?: number | string;
  tbr_precision?: number;
  align_precision?: number | string;
  tbr_f1?: number;
  align_f1?: number | string;
  mean_fitness?: number;
  mean_precision?: number;
  mean_fitness_combined?: number;
  mean_precision_combined?: number;
  mean_f1_combined?: number;
  simplicity?: number;
}

export interface CustomTraceDiagnostics {
  alignment: Array<[string | null, string | null]>;
  fitness: number;
  tbr: {
    missing_tokens: number;
    consumed_tokens: number;
    remaining_tokens: number;
    produced_tokens: number;
    trace_is_fit: boolean;
    trace_fitness: number;
  };
}

export interface OcelObjectTypeData {
  regular_dfg_svg: string;
  performance_dfg_svg: string;
  insights: LogInsights;
  visualization_data: LogVisualizationData;
  preview_events?: Array<Record<string, string>>;
  first_20_events?: Array<Record<string, string>>;
  flattened_columns: string[];
  footprint_matrix: FootprintMatrix;
}

export interface OcelExplorationResult {
  message: string;
  status: string;
  ocdfg_svg_content: string;
  object_graph_svg_content: string | null;
  ocel_metadata: AssetSummary;
  num_events: number;
  num_cases: number;
  num_objects: number;
  num_activities: number;
  object_types: string[];
  object_type_counts: Record<string, number>;
  activities: string[];
  activity_counts: Record<string, number>;
  activity_case_counts: Record<string, number>;
  activity_durations: Record<string, ActivityDuration>;
  extended_table_rows: Array<Record<string, string>>;
  table_columns: string[];
  object_type_data: Record<string, OcelObjectTypeData | null>;
}

export interface OCPMDiscoveryResult {
  message: string;
  status: string;
  svg_content: string;
  ocpn_content: string;
  ocpn_filename: string;
  ocel_metadata: AssetSummary;
}

export interface OcelFlattenResult {
  message: string;
  status: string;
  filename: string;
  object_type: string;
  num_events: number;
  num_cases: number;
  xes_content: string;
}

export interface AutoPMResult {
  message: string;
  status: string;
  log_metadata: AssetSummary;
  search_space_technique: string;
  optimization_rounds: number;
  cross_validation_folds: number;
  optimization_metric: string;
  leaderboard: Array<{
    algorithm: string;
    best_result: {
      algorithm: string;
      parameters: Record<string, number>;
      score: number;
      best_fold_score: number;
      fold_scores: number[];
      metrics: DiscoveryResult;
    };
    results: Array<{
      algorithm: string;
      parameters: Record<string, number>;
      score: number;
      best_fold_score: number;
      fold_scores: number[];
      metrics: DiscoveryResult;
    }>;
  }>;
  overall_best: {
    algorithm: string;
    parameters: Record<string, number>;
    score: number;
    best_fold_score: number;
    fold_scores: number[];
    metrics: DiscoveryResult;
  } | null;
}

export interface ExplorationPageState {
  selectedLogId: number | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  result: LogExplorationResult | null;
  selectedActivities: string[];
  selectedVariants: string[][];
  variantMode: DfgVariantMode;
  topVariantPercentage: number;
  dfgFilterView: "activity" | "variant";
  dfgType: "regular" | "performance";
  dfgPerformanceMetric: DfgPerformanceMetric;
  distributionType: DistributionType;
  activeVisualization: VisualizationMode;
  dataView: "events" | "footprint";
  eventPreviewLimit: number;
  dfgFilterOpen: boolean;
}

export interface DiscoveryPageState {
  selectedLogId: number | null;
  comparisonStarted: boolean;
  error: string | null;
  successMessage: string | null;
  results: Record<DiscoveryAlgorithm, DiscoveryResult | null>;
  loading: Record<DiscoveryAlgorithm, boolean>;
  parameters: {
    alpha: Record<string, never>;
    ilp: { alpha: number };
    heuristics: {
      dependency_threshold: number;
      and_threshold: number;
      loop_two_threshold: number;
    };
    inductive: { noise_threshold: number };
  };
}

export interface ConformancePageState {
  variant: ConformanceVariant;
  selectedLog1: number | null;
  selectedLog2: number | null;
  selectedLog: number | null;
  selectedModel: number | null;
  selectedModel1: number | null;
  selectedModel2: number | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  result: ConformanceResult | null;
  customTrace: string;
  customAlignment: CustomTraceDiagnostics | null;
  computingCustom: boolean;
  variantDiagnosticsView: "alignments" | "tbr";
  customDiagnosticsView: "alignments" | "tbr";
}

export interface AutoPMPageState {
  selectedLogId: number | null;
  selectedAlgorithms: string[];
  searchSpaceTechnique: string;
  optimizationRounds: number;
  crossValidationFolds: number;
  optimizationMetric: string;
  running: boolean;
  error: string | null;
  result: AutoPMResult | null;
}

export interface OCPMExplorationPageState {
  selectedOcelId: number | null;
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  result: OcelExplorationResult | null;
  selectedGraph: string;
  dfgType: "regular" | "performance";
  dfgPerformanceMetric: DfgPerformanceMetric;
  activeVisualization: VisualizationMode;
  selectedVizObjectType: string | null;
  distributionType: DistributionType;
  dataView: "ocel" | "events" | "footprint";
  eventPreviewLimit: number;
  selectedDataObjectType: string | null;
  selectedAnalysisObjectType: string | null;
  selectedActivityView: string;
  selectedVariantObjectType: string | null;
}

export interface OCPMDiscoveryPageState {
  selectedOcelId: number | null;
  comparisonStarted: boolean;
  error: string | null;
  successMessage: string | null;
  results: Record<OCPMVariant, OCPMDiscoveryResult | null>;
  loading: Record<OCPMVariant, boolean>;
}

export interface PersistedPageStates {
  exploration: ExplorationPageState;
  discovery: DiscoveryPageState;
  conformance: ConformancePageState;
  autopm: AutoPMPageState;
  ocpmExploration: OCPMExplorationPageState;
  ocpmDiscovery: OCPMDiscoveryPageState;
}
