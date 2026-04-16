"""Pydantic request and response schemas."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


AssetKind = Literal["log", "model", "ocel"]
DfgVariantMode = Literal["all", "manual", "top_k"]


class StatusResponse(BaseModel):
    """Simple success response."""

    status: str = "success"


class MessageStatusResponse(StatusResponse):
    """Success response with a message."""

    message: str


class AuthRequest(BaseModel):
    """Simple login or registration payload."""

    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=3, max_length=120)


class PageStateRequest(BaseModel):
    """Page state persistence payload."""

    state: dict[str, Any]


class DfgFilterRequest(BaseModel):
    """DFG update payload."""

    selected_activities: list[str] = Field(default_factory=list)
    variant_mode: DfgVariantMode = "all"
    selected_variants: list[list[str]] = Field(default_factory=list)
    top_variant_percentage: int | None = Field(default=None, ge=1, le=100)

    @model_validator(mode="after")
    def validate_variant_mode(self) -> "DfgFilterRequest":
        if self.variant_mode == "manual" and not self.selected_variants:
            raise ValueError("Select at least one variant for manual filtering.")
        if self.variant_mode == "top_k" and self.top_variant_percentage is None:
            raise ValueError("Provide top_variant_percentage when variant_mode is top_k.")
        return self


class DistributionRequest(BaseModel):
    """Distribution update payload."""

    distribution_type: str = "days_week"


class LogModelConformanceRequest(BaseModel):
    """Log-model conformance payload."""

    log_id: int
    model_id: int


class LogLogConformanceRequest(BaseModel):
    """Log-log conformance payload."""

    first_log_id: int
    second_log_id: int


class ModelModelConformanceRequest(BaseModel):
    """Model-model conformance payload."""

    first_model_id: int
    second_model_id: int


class CustomTraceRequest(BaseModel):
    """Custom trace diagnostics payload."""

    log_id: int
    model_id: int
    trace_activities: list[str] = Field(default_factory=list)


class OcelDistributionRequest(BaseModel):
    """OCEL distribution update payload."""

    object_type: str
    distribution_type: str = "days_week"


class OcelFlattenRequest(BaseModel):
    """Flatten-one-object-type OCEL export payload."""

    object_type: str


class AutoPMRequest(BaseModel):
    """AutoPM configuration payload."""

    log_id: int
    selected_algorithms: list[str] = Field(default_factory=list)
    search_space_technique: str = "grid"
    optimization_rounds: int = Field(default=10, ge=1, le=100)
    cross_validation_folds: int = Field(default=5, ge=2, le=10)
    optimization_metric: str = "f1"


class UserModel(BaseModel):
    """Authenticated user shape."""

    id: int
    username: str
    is_guest: bool
    created_at: str


class AuthResponse(StatusResponse):
    """Login/register/me response."""

    user: UserModel
    access_token: str | None = None
    token_type: Literal["bearer"] | None = None


class AssetSummaryModel(BaseModel):
    """Serialized asset metadata."""

    id: int
    kind: AssetKind
    filename: str
    created_at: str
    num_events: int | None = None
    num_cases: int | None = None
    num_activities: int | None = None
    num_objects: int | None = None
    object_types: list[str] | None = None
    model_type: str | None = None
    num_places: int | None = None
    num_transitions: int | None = None
    num_arcs: int | None = None
    original_columns: list[str] | None = None


class LogMetadataModel(BaseModel):
    """Metadata returned by log analysis services."""

    filename: str
    num_events: int
    num_cases: int
    num_activities: int
    original_columns: list[str] | None = None


class ModelMetadataModel(BaseModel):
    """Metadata returned by model analysis services."""

    filename: str
    model_type: str
    num_places: int
    num_transitions: int
    num_arcs: int


class OcelMetadataModel(BaseModel):
    """Metadata returned by OCEL analysis services."""

    filename: str
    num_events: int
    num_objects: int
    object_types: list[str]


class AssetListResponse(StatusResponse):
    """Asset list response."""

    assets: list[AssetSummaryModel]


class AssetUploadResponse(StatusResponse):
    """Upload response."""

    asset: AssetSummaryModel


class DashboardSummaryResponse(StatusResponse):
    """Dashboard counts."""

    counts: dict[AssetKind, int]


class PageStatesResponse(StatusResponse):
    """Remote page-state response."""

    states: dict[str, Any]


class ActivityFeedItemModel(BaseModel):
    """Recent activity entry."""

    id: int
    action: str
    details: dict[str, Any]
    created_at: str


class ActivityFeedResponse(StatusResponse):
    """Activity feed response."""

    items: list[ActivityFeedItemModel]


class ActivityDurationModel(BaseModel):
    """Duration summary for one activity."""

    avg: float
    min: float
    max: float
    median: float


class DfgEdgeModel(BaseModel):
    """One regular DFG edge."""

    source: str
    target: str
    count: int


class PerformanceDfgEdgeModel(BaseModel):
    """Performance metrics for one directly-follows edge."""

    source: str
    target: str
    mean: float
    median: float
    max: float
    min: float
    sum: float
    stdev: float
    occurrences: int


class VariantEdgePerformanceModel(BaseModel):
    """Raw duration samples for one edge inside a trace variant."""

    source: str
    target: str
    samples: list[float] = Field(default_factory=list)


class TraceVariantModel(BaseModel):
    """Trace variant statistics."""

    activities: list[str]
    frequency: int
    percentage: float
    avg_tpt: float
    min_tpt: float
    max_tpt: float
    median_tpt: float
    edge_performance: list[VariantEdgePerformanceModel] = Field(default_factory=list)


class VariantFilterOptionModel(BaseModel):
    """Variant option used in DFG filters."""

    activities: list[str]
    frequency: int


class FootprintMatrixModel(BaseModel):
    """Serialized footprint matrix."""

    activities: list[str]
    matrix: list[list[str]]


class LogInsightsModel(BaseModel):
    """Shared log analysis statistics."""

    num_events: int
    num_cases: int
    num_activities: int
    num_trace_variants: int
    activity_frequencies: dict[str, int]
    activity_case_counts: dict[str, int]
    activity_durations: dict[str, ActivityDurationModel]
    trace_variants: list[TraceVariantModel]
    start_activities: dict[str, int]
    end_activities: dict[str, int]
    regular_dfg: list[DfgEdgeModel] = Field(default_factory=list)
    performance_dfg: list[PerformanceDfgEdgeModel] = Field(default_factory=list)
    log_avg_tpt: float
    log_min_tpt: float
    log_max_tpt: float
    log_median_tpt: float


class VisualizationEventPointModel(BaseModel):
    """One event point used by the client-side visualizations."""

    case_id: str
    case_index: int
    activity: str
    timestamp: str


class CaseDurationPointModel(BaseModel):
    """One case duration record for the client-side duration chart."""

    case_id: str
    start_timestamp: str
    end_timestamp: str
    duration_seconds: float


class LogVisualizationDataModel(BaseModel):
    """Raw visualization data for exploration views."""

    event_points: list[VisualizationEventPointModel] = Field(default_factory=list)
    case_durations: list[CaseDurationPointModel] = Field(default_factory=list)


class LogExplorationResponse(MessageStatusResponse):
    """Full event-log exploration payload."""

    log_metadata: LogMetadataModel
    regular_svg_content: str
    performance_svg_content: str
    insights: LogInsightsModel
    available_activities: list[str]
    available_variants: list[VariantFilterOptionModel]
    visualization_data: LogVisualizationDataModel
    preview_events: list[dict[str, Any]] = Field(default_factory=list)
    first_20_events: list[dict[str, Any]] = Field(default_factory=list)
    event_columns: list[str]
    footprint_matrix: FootprintMatrixModel


class DfgUpdateResponse(MessageStatusResponse):
    """DFG-only update response."""

    regular_svg_content: str
    performance_svg_content: str
    available_variants: list[VariantFilterOptionModel]
    filtered_case_count: int
    filtered_event_count: int
    kept_variant_count: int


class DistributionResponse(MessageStatusResponse):
    """Single SVG distribution update."""

    event_distribution_svg: str


class DiscoveryResultResponse(MessageStatusResponse):
    """Classic discovery result."""

    svg_content: str
    pnml_content: str
    log_metadata: LogMetadataModel
    log_stats: LogInsightsModel | None = None
    tbr_fitness: float
    align_fitness: float | str
    tbr_precision: float
    align_precision: float | str
    tbr_f1: float
    align_f1: float | str
    mean_fitness: float
    mean_precision: float
    mean_f1: float | None = None
    num_places: int
    num_transitions: int
    num_arcs: int


class AlignmentDiagnosticModel(BaseModel):
    """Alignment result for one variant."""

    variant: list[str]
    frequency: int
    alignment: list[tuple[Optional[str], Optional[str]]]
    fitness: float


class TokenReplayDiagnosticModel(BaseModel):
    """Token replay result for one variant."""

    variant: list[str]
    frequency: int
    missing_tokens: int
    consumed_tokens: int
    remaining_tokens: int
    produced_tokens: int
    trace_is_fit: bool
    trace_fitness: float


class CustomTraceReplayModel(BaseModel):
    """Token replay diagnostics for a custom trace."""

    missing_tokens: int
    consumed_tokens: int
    remaining_tokens: int
    produced_tokens: int
    trace_is_fit: bool
    trace_fitness: float


class CustomTraceDiagnosticsModel(BaseModel):
    """Custom trace conformance response."""

    message: str
    status: str
    alignment: list[tuple[Optional[str], Optional[str]]]
    fitness: float
    tbr: CustomTraceReplayModel


class ConformanceResultResponse(MessageStatusResponse):
    """Combined conformance response model."""

    model_config = ConfigDict(extra="ignore")

    log1_metadata: LogMetadataModel | None = None
    log2_metadata: LogMetadataModel | None = None
    log_metadata: LogMetadataModel | None = None
    log1_insights: LogInsightsModel | None = None
    log2_insights: LogInsightsModel | None = None
    log_insights: LogInsightsModel | None = None
    model_metadata: ModelMetadataModel | None = None
    model1_metadata: ModelMetadataModel | None = None
    model2_metadata: ModelMetadataModel | None = None
    log1_svg: str | None = None
    log2_svg: str | None = None
    log_svg: str | None = None
    model_svg: str | None = None
    model1_svg: str | None = None
    model2_svg: str | None = None
    num_events_1: int | None = None
    num_cases_1: int | None = None
    num_events_2: int | None = None
    num_cases_2: int | None = None
    num_events: int | None = None
    num_cases: int | None = None
    num_places: int | None = None
    num_transitions: int | None = None
    num_arcs: int | None = None
    num_places_1: int | None = None
    num_transitions_1: int | None = None
    num_arcs_1: int | None = None
    num_places_2: int | None = None
    num_transitions_2: int | None = None
    num_arcs_2: int | None = None
    footprint1_matrix: FootprintMatrixModel | None = None
    footprint2_matrix: FootprintMatrixModel | None = None
    log_footprint_matrix: FootprintMatrixModel | None = None
    model_footprint_matrix: FootprintMatrixModel | None = None
    num_different_cells: int | None = None
    footprint_conformance: float | None = None
    alignment_data: list[AlignmentDiagnosticModel] = Field(default_factory=list)
    tbr_data: list[TokenReplayDiagnosticModel] = Field(default_factory=list)
    tbr_fitness: float | None = None
    align_fitness: float | str | None = None
    tbr_precision: float | None = None
    align_precision: float | str | None = None
    tbr_f1: float | None = None
    align_f1: float | str | None = None
    mean_fitness: float | None = None
    mean_precision: float | None = None
    mean_fitness_combined: float | None = None
    mean_precision_combined: float | None = None
    mean_f1_combined: float | None = None
    simplicity: float | None = None


class OcelObjectTypeDataModel(BaseModel):
    """Per-object-type flattened OCEL analysis."""

    regular_dfg_svg: str
    performance_dfg_svg: str
    insights: LogInsightsModel
    visualization_data: LogVisualizationDataModel
    preview_events: list[dict[str, Any]] = Field(default_factory=list)
    first_20_events: list[dict[str, Any]] = Field(default_factory=list)
    flattened_columns: list[str]
    footprint_matrix: FootprintMatrixModel


class OcelExplorationResponse(MessageStatusResponse):
    """Full OCEL exploration response."""

    ocdfg_svg_content: str
    object_graph_svg_content: str | None = None
    ocel_metadata: OcelMetadataModel
    num_events: int
    num_cases: int
    num_objects: int
    num_activities: int
    object_types: list[str]
    object_type_counts: dict[str, int]
    activities: list[str]
    activity_counts: dict[str, int]
    activity_case_counts: dict[str, int]
    activity_durations: dict[str, ActivityDurationModel]
    extended_table_rows: list[dict[str, Any]]
    table_columns: list[str]
    object_type_data: dict[str, OcelObjectTypeDataModel | None]


class OCPMDiscoveryResponse(MessageStatusResponse):
    """Object-centric discovery result."""

    svg_content: str
    ocpn_content: str
    ocpn_filename: str
    ocel_metadata: OcelMetadataModel


class OcelFlattenResponse(MessageStatusResponse):
    """Flattened traditional event-log export."""

    filename: str
    object_type: str
    num_events: int
    num_cases: int
    xes_content: str


class DiscoveryMetricsSummaryModel(BaseModel):
    """Metric subset stored in AutoPM candidates."""

    tbr_fitness: float
    align_fitness: float | str
    tbr_precision: float
    align_precision: float | str
    tbr_f1: float
    align_f1: float | str
    mean_fitness: float
    mean_precision: float
    mean_f1: float | None = None
    num_places: int
    num_transitions: int
    num_arcs: int


class AutoPMCandidateResultModel(BaseModel):
    """One AutoPM candidate configuration."""

    algorithm: str
    parameters: dict[str, float]
    score: float
    best_fold_score: float
    fold_scores: list[float]
    metrics: DiscoveryMetricsSummaryModel


class AutoPMLeaderboardEntryModel(BaseModel):
    """Grouped AutoPM leaderboard entry."""

    algorithm: str
    best_result: AutoPMCandidateResultModel
    results: list[AutoPMCandidateResultModel]


class AutoPMResponse(MessageStatusResponse):
    """AutoPM optimization response."""

    log_metadata: LogMetadataModel
    search_space_technique: str
    optimization_rounds: int
    cross_validation_folds: int
    optimization_metric: str
    leaderboard: list[AutoPMLeaderboardEntryModel]
    overall_best: AutoPMCandidateResultModel | None = None
