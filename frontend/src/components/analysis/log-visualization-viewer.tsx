"use client";

import { useMemo } from "react";

import { formatDuration } from "@/components/analysis-ui";
import type { DistributionType, LogVisualizationData, VisualizationMode } from "@/lib/types";

const CHART_WIDTH = 680;
const CHART_HEIGHT = 320;
const MARGIN = { top: 24, right: 20, bottom: 52, left: 54 };
const MAX_DOTTED_POINTS = 4000;
const VIZ_ACCENT = "#e67e22";
const VIZ_ACCENT_DARK = "#c05d00";
const VIZ_ACCENT_SOFT = "rgba(230, 126, 34, 0.18)";
const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ParsedEventPoint = {
  caseId: string;
  caseIndex: number;
  activity: string;
  timestampMs: number;
};

type TimeBin = {
  label: string;
  count: number;
  startMs: number;
  endMs: number;
  centerMs: number;
};

type DistributionBar = {
  key: string;
  label: string;
  count: number;
};

type DurationBin = {
  start: number;
  end: number;
  count: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatUtcDate(timestampMs: number, withTime = false) {
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
  return formatter.format(new Date(timestampMs));
}

function getIsoWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function buildTimeBins(points: ParsedEventPoint[], binCount = 28): TimeBin[] {
  if (!points.length) {
    return [];
  }

  const minMs = Math.min(...points.map((point) => point.timestampMs));
  const maxMs = Math.max(...points.map((point) => point.timestampMs));
  if (minMs === maxMs) {
    return [
      {
        label: formatUtcDate(minMs, true),
        count: points.length,
        startMs: minMs,
        endMs: maxMs,
        centerMs: minMs,
      },
    ];
  }

  const actualBinCount = Math.max(1, Math.min(binCount, points.length));
  const step = (maxMs - minMs) / actualBinCount;
  const counts = new Array(actualBinCount).fill(0);

  for (const point of points) {
    const index = clamp(Math.floor((point.timestampMs - minMs) / Math.max(step, 1)), 0, actualBinCount - 1);
    counts[index] += 1;
  }

  return counts.map((count, index) => {
    const startMs = minMs + step * index;
    const endMs = index === actualBinCount - 1 ? maxMs : minMs + step * (index + 1);
    const centerMs = startMs + (endMs - startMs) / 2;
    return {
      label: formatUtcDate(centerMs, true),
      count,
      startMs,
      endMs,
      centerMs,
    };
  });
}

function buildDistribution(points: ParsedEventPoint[], distributionType: DistributionType): DistributionBar[] {
  if (!points.length) {
    return [];
  }

  if (distributionType === "days_week") {
    const counts = new Array(7).fill(0);
    for (const point of points) {
      const day = new Date(point.timestampMs).getUTCDay();
      counts[(day + 6) % 7] += 1;
    }
    return DAYS_OF_WEEK.map((label, index) => ({ key: label, label, count: counts[index] }));
  }

  if (distributionType === "days_month") {
    const counts = new Array(31).fill(0);
    for (const point of points) {
      counts[new Date(point.timestampMs).getUTCDate() - 1] += 1;
    }
    return counts.map((count, index) => ({ key: `${index + 1}`, label: `${index + 1}`, count }));
  }

  if (distributionType === "months") {
    const counts = new Array(12).fill(0);
    for (const point of points) {
      counts[new Date(point.timestampMs).getUTCMonth()] += 1;
    }
    return MONTH_LABELS.map((label, index) => ({ key: label, label, count: counts[index] }));
  }

  if (distributionType === "hours") {
    const counts = new Array(24).fill(0);
    for (const point of points) {
      counts[new Date(point.timestampMs).getUTCHours()] += 1;
    }
    return counts.map((count, index) => ({ key: `${index}`, label: `${index.toString().padStart(2, "0")}`, count }));
  }

  if (distributionType === "weeks") {
    const counts = new Array(53).fill(0);
    for (const point of points) {
      const weekIndex = clamp(getIsoWeek(new Date(point.timestampMs)) - 1, 0, 52);
      counts[weekIndex] += 1;
    }
    return counts.map((count, index) => ({ key: `${index + 1}`, label: `W${index + 1}`, count }));
  }

  const counts = new Map<string, number>();
  for (const point of points) {
    const year = String(new Date(point.timestampMs).getUTCFullYear());
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => Number(left[0]) - Number(right[0]))
    .map(([label, count]) => ({ key: label, label, count }));
}

function buildDurationHistogram(caseDurations: LogVisualizationData["case_durations"], binCount = 20): DurationBin[] {
  if (!caseDurations.length) {
    return [];
  }

  const maxDuration = Math.max(...caseDurations.map((item) => item.duration_seconds), 0);
  if (maxDuration <= 0) {
    return [{ start: 0, end: 0, count: caseDurations.length }];
  }

  const actualBinCount = Math.max(1, Math.min(binCount, caseDurations.length));
  const step = maxDuration / actualBinCount;
  const counts = new Array(actualBinCount).fill(0);

  for (const item of caseDurations) {
    const index = clamp(Math.floor(item.duration_seconds / Math.max(step, 1)), 0, actualBinCount - 1);
    counts[index] += 1;
  }

  return counts.map((count, index) => ({
    start: step * index,
    end: index === actualBinCount - 1 ? maxDuration : step * (index + 1),
    count,
  }));
}

function useParsedEvents(data: LogVisualizationData | null) {
  return useMemo<ParsedEventPoint[]>(
    () =>
      (data?.event_points ?? [])
        .map((point) => ({
          caseId: point.case_id,
          caseIndex: point.case_index,
          activity: point.activity,
          timestampMs: Date.parse(point.timestamp),
        }))
        .filter((point) => Number.isFinite(point.timestampMs)),
    [data],
  );
}

export type VizGroup = "charts" | "temporal";

export function LogVisualizationViewer({
  title,
  data,
  vizGroup,
  mode,
  distributionType,
  actions,
  colorMap,
  emptyMessage,
}: {
  title: string;
  data: LogVisualizationData | null;
  vizGroup: VizGroup;
  mode: VisualizationMode;
  distributionType: DistributionType;
  actions?: React.ReactNode;
  colorMap: Record<string, string>;
  emptyMessage: string;
}) {
  const parsedEvents = useParsedEvents(data);
  const caseDurations = useMemo(() => data?.case_durations ?? [], [data]);

  const dottedPoints = useMemo(() => {
    if (!parsedEvents.length) {
      return [];
    }
    if (parsedEvents.length <= MAX_DOTTED_POINTS) {
      return parsedEvents;
    }

    const stride = Math.ceil(parsedEvents.length / MAX_DOTTED_POINTS);
    return parsedEvents.filter((_, index) => index % stride === 0);
  }, [parsedEvents]);

  const activityLegend = useMemo(() => {
    const counts = new Map<string, number>();
    for (const point of parsedEvents) {
      counts.set(point.activity, (counts.get(point.activity) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10);
  }, [parsedEvents]);

  const timeBins = useMemo(() => buildTimeBins(parsedEvents), [parsedEvents]);
  const distributionBars = useMemo(
    () => buildDistribution(parsedEvents, distributionType),
    [distributionType, parsedEvents],
  );
  const durationHistogram = useMemo(() => buildDurationHistogram(caseDurations), [caseDurations]);
  const secondaryMode = mode === "distribution" ? "distribution" : "time";

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const caseCount = Math.max(...parsedEvents.map((point) => point.caseIndex), -1) + 1;

  const content = !data || (!parsedEvents.length && !caseDurations.length) ? (
    <div className="empty-panel viewer-empty">{emptyMessage}</div>
  ) : (
    <div className="log-viz-pair">
      {vizGroup === "charts" ? (
        <>
          <section className="log-viz-card">
            <div className="log-viz-card-header">
              <div>
                <h4>Dotted chart</h4>
                <p>Event points over cases and time.</p>
              </div>
            </div>
            <div className="raw-log-viz-stage compact">
              {dottedPoints.length ? (
                <DottedChart
                  colorMap={colorMap}
                  caseCount={caseCount}
                  plotHeight={plotHeight}
                  plotWidth={plotWidth}
                  points={dottedPoints}
                  totalEvents={parsedEvents.length}
                />
              ) : (
                <div className="empty-panel viewer-empty">No event points available.</div>
              )}
            </div>
            <div className="viewer-summary-row compact">
              <span>{parsedEvents.length.toLocaleString()} events</span>
              <span>{caseCount.toLocaleString()} cases</span>
              {dottedPoints.length !== parsedEvents.length ? <span>{dottedPoints.length.toLocaleString()} rendered points</span> : null}
            </div>
            <div className="raw-log-viz-legend compact">
              {activityLegend.map(([activity, count]) => (
                <span key={activity} className="raw-log-viz-legend-item">
                  <span className="raw-log-viz-dot" style={{ backgroundColor: colorMap[activity] ?? VIZ_ACCENT }} />
                  {activity} ({count})
                </span>
              ))}
            </div>
          </section>

          <section className="log-viz-card">
            <div className="log-viz-card-header">
              <div>
                <h4>Case duration</h4>
                <p>Distribution of case throughput times.</p>
              </div>
            </div>
            <div className="raw-log-viz-stage compact">
              {caseDurations.length ? (
                <DurationHistogram caseDurations={caseDurations} histogram={durationHistogram} plotHeight={plotHeight} plotWidth={plotWidth} />
              ) : (
                <div className="empty-panel viewer-empty">No case durations available.</div>
              )}
            </div>
            <div className="viewer-summary-row compact">
              <span>{caseDurations.length.toLocaleString()} case durations</span>
              <span>Median {formatDuration(median(caseDurations.map((item) => item.duration_seconds)))}</span>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="log-viz-card">
            <div className="log-viz-card-header">
              <div>
                <h4>Events per time</h4>
                <p>Event volume over the full timeline.</p>
              </div>
            </div>
            <div className="raw-log-viz-stage compact">
              {timeBins.length ? (
                <EventsPerTimeChart plotHeight={plotHeight} plotWidth={plotWidth} timeBins={timeBins} />
              ) : (
                <div className="empty-panel viewer-empty">No temporal data available.</div>
              )}
            </div>
            <div className="viewer-summary-row compact">
              <span>{parsedEvents.length.toLocaleString()} events</span>
              <span>{timeBins.length} time bins</span>
            </div>
          </section>

          <section className="log-viz-card">
            <div className="log-viz-card-header">
              <div>
                <h4>Event distribution</h4>
                <p>Grouped event counts by temporal bucket.</p>
              </div>
            </div>
            <div className="raw-log-viz-stage compact">
              {distributionBars.length ? (
                <DistributionChart bars={distributionBars} distributionType={distributionType} plotHeight={plotHeight} plotWidth={plotWidth} />
              ) : (
                <div className="empty-panel viewer-empty">No distribution data available.</div>
              )}
            </div>
            <div className="viewer-summary-row compact">
              <span>{parsedEvents.length.toLocaleString()} events</span>
              <span>{distributionBars.length} buckets</span>
            </div>
          </section>
        </>
      )}
    </div>
  );

  return (
    <section className="panel viewer-panel viewer-panel-compact exploration-surface">
      <div className="panel-header viewer-header">
        <h3>{title}</h3>
        <div className="panel-actions viewer-toolbar">{actions}</div>
      </div>
      {content}
    </section>
  );
}

function DottedChart({
  points,
  totalEvents,
  caseCount,
  colorMap,
  plotWidth,
  plotHeight,
}: {
  points: ParsedEventPoint[];
  totalEvents: number;
  caseCount: number;
  colorMap: Record<string, string>;
  plotWidth: number;
  plotHeight: number;
}) {
  const minMs = Math.min(...points.map((point) => point.timestampMs));
  const maxMs = Math.max(...points.map((point) => point.timestampMs));
  const timeRange = Math.max(maxMs - minMs, 1);
  const caseRange = Math.max(caseCount - 1, 1);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="raw-log-viz-svg" aria-label="Dotted chart">
      <ChartFrame plotHeight={plotHeight} plotWidth={plotWidth} xEndLabel={formatUtcDate(maxMs)} xStartLabel={formatUtcDate(minMs)} yMaxLabel={`${Math.max(caseCount, 1)}`} yMinLabel="1" />
      {points.map((point, index) => {
        const x = MARGIN.left + ((point.timestampMs - minMs) / timeRange) * plotWidth;
        const y = MARGIN.top + plotHeight - (point.caseIndex / caseRange) * plotHeight;
        return (
          <circle key={`${point.caseId}-${index}`} cx={x} cy={y} r="2.2" fill={colorMap[point.activity] ?? VIZ_ACCENT} opacity="0.82">
            <title>{`${point.activity} · ${point.caseId} · ${formatUtcDate(point.timestampMs, true)}`}</title>
          </circle>
        );
      })}
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 14} textAnchor="middle" className="raw-log-viz-axis-title">
        Timeline
      </text>
      <text x={20} y={CHART_HEIGHT / 2} textAnchor="middle" className="raw-log-viz-axis-title" transform={`rotate(-90 20 ${CHART_HEIGHT / 2})`}>
        Cases
      </text>
      <text x={CHART_WIDTH - 20} y={24} textAnchor="end" className="raw-log-viz-badge">
        {totalEvents.toLocaleString()} events
      </text>
    </svg>
  );
}

function DurationHistogram({
  caseDurations,
  histogram,
  plotWidth,
  plotHeight,
}: {
  caseDurations: LogVisualizationData["case_durations"];
  histogram: DurationBin[];
  plotWidth: number;
  plotHeight: number;
}) {
  const maxCount = Math.max(...histogram.map((bin) => bin.count), 1);
  const barWidth = plotWidth / Math.max(histogram.length, 1);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="raw-log-viz-svg" aria-label="Case duration histogram">
      <ChartFrame
        plotHeight={plotHeight}
        plotWidth={plotWidth}
        xEndLabel={formatDuration(histogram.at(-1)?.end ?? 0)}
        xStartLabel="0s"
        yMaxLabel={`${maxCount}`}
        yMinLabel="0"
      />
      {histogram.map((bin, index) => {
        const barHeight = (bin.count / maxCount) * plotHeight;
        const columnWidth = Math.max(barWidth * 0.4, 2);
        const x = MARGIN.left + index * barWidth + (barWidth - columnWidth) / 2;
        const y = MARGIN.top + plotHeight - barHeight;
        return (
          <rect
            key={`${bin.start}-${bin.end}`}
            x={x}
            y={y}
            width={columnWidth}
            height={barHeight}
            rx="2"
            fill="url(#durationGradient)"
          >
            <title>{`${formatDuration(bin.start)} to ${formatDuration(bin.end)} · ${bin.count} cases`}</title>
          </rect>
        );
      })}
      <defs>
        <linearGradient id="durationGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fbd7a8" />
          <stop offset="100%" stopColor={VIZ_ACCENT_DARK} />
        </linearGradient>
      </defs>
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 14} textAnchor="middle" className="raw-log-viz-axis-title">
        Case duration
      </text>
      <text x={CHART_WIDTH - 20} y={24} textAnchor="end" className="raw-log-viz-badge">
        {caseDurations.length.toLocaleString()} cases
      </text>
    </svg>
  );
}

function EventsPerTimeChart({
  timeBins,
  plotWidth,
  plotHeight,
}: {
  timeBins: TimeBin[];
  plotWidth: number;
  plotHeight: number;
}) {
  const maxCount = Math.max(...timeBins.map((bin) => bin.count), 1);
  const points = timeBins.map((bin, index) => {
    const x = MARGIN.left + (timeBins.length === 1 ? plotWidth / 2 : (index / (timeBins.length - 1)) * plotWidth);
    const y = MARGIN.top + plotHeight - (bin.count / maxCount) * plotHeight;
    return { x, y, ...bin };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${MARGIN.left + plotWidth} ${MARGIN.top + plotHeight} L ${MARGIN.left} ${MARGIN.top + plotHeight} Z`;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="raw-log-viz-svg" aria-label="Events per time">
      <ChartFrame
        plotHeight={plotHeight}
        plotWidth={plotWidth}
        xEndLabel={points.length ? formatUtcDate(points.at(-1)!.centerMs) : ""}
        xStartLabel={points.length ? formatUtcDate(points[0].centerMs) : ""}
        yMaxLabel={`${maxCount}`}
        yMinLabel="0"
      />
      <path d={areaPath} fill={VIZ_ACCENT_SOFT} />
      <path d={path} fill="none" stroke={VIZ_ACCENT} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => (
        <circle key={`${point.startMs}-${point.endMs}`} cx={point.x} cy={point.y} r="3.6" fill={VIZ_ACCENT_DARK}>
          <title>{`${point.label} · ${point.count} events`}</title>
        </circle>
      ))}
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 14} textAnchor="middle" className="raw-log-viz-axis-title">
        Time
      </text>
    </svg>
  );
}

function DistributionChart({
  bars,
  distributionType,
  plotWidth,
  plotHeight,
}: {
  bars: DistributionBar[];
  distributionType: DistributionType;
  plotWidth: number;
  plotHeight: number;
}) {
  const maxCount = Math.max(...bars.map((bar) => bar.count), 1);
  const barWidth = plotWidth / Math.max(bars.length, 1);

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="raw-log-viz-svg" aria-label="Event distribution">
      <ChartFrame
        plotHeight={plotHeight}
        plotWidth={plotWidth}
        xEndLabel={bars.at(-1)?.label ?? ""}
        xStartLabel={bars[0]?.label ?? ""}
        yMaxLabel={`${maxCount}`}
        yMinLabel="0"
      />
      {bars.map((bar, index) => {
        const barHeight = (bar.count / maxCount) * plotHeight;
        const columnWidth = Math.max(barWidth * 0.4, 2);
        const x = MARGIN.left + index * barWidth + (barWidth - columnWidth) / 2;
        const y = MARGIN.top + plotHeight - barHeight;
        const showLabel = bars.length <= 16 || index % Math.ceil(bars.length / 8) === 0;

        return (
          <g key={bar.key}>
            <rect x={x} y={y} width={columnWidth} height={barHeight} rx="2" fill={VIZ_ACCENT}>
              <title>{`${bar.label} · ${bar.count} events`}</title>
            </rect>
            {showLabel ? (
              <text x={x + columnWidth / 2} y={CHART_HEIGHT - 28} textAnchor="middle" className="raw-log-viz-tick">
                {bar.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 14} textAnchor="middle" className="raw-log-viz-axis-title">
        {distributionAxisTitle(distributionType)}
      </text>
    </svg>
  );
}

function ChartFrame({
  plotWidth,
  plotHeight,
  xStartLabel,
  xEndLabel,
  yMinLabel,
  yMaxLabel,
}: {
  plotWidth: number;
  plotHeight: number;
  xStartLabel: string;
  xEndLabel: string;
  yMinLabel: string;
  yMaxLabel: string;
}) {
  const yGuides = [0, 0.25, 0.5, 0.75, 1];

  return (
    <>
      {yGuides.map((ratio) => {
        const y = MARGIN.top + plotHeight * ratio;
        return <line key={ratio} x1={MARGIN.left} y1={y} x2={MARGIN.left + plotWidth} y2={y} className="raw-log-viz-grid" />;
      })}
      <line x1={MARGIN.left} y1={MARGIN.top + plotHeight} x2={MARGIN.left + plotWidth} y2={MARGIN.top + plotHeight} className="raw-log-viz-axis" />
      <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + plotHeight} className="raw-log-viz-axis" />
      <text x={MARGIN.left} y={CHART_HEIGHT - 28} textAnchor="start" className="raw-log-viz-tick">
        {xStartLabel}
      </text>
      <text x={MARGIN.left + plotWidth} y={CHART_HEIGHT - 28} textAnchor="end" className="raw-log-viz-tick">
        {xEndLabel}
      </text>
      <text x={MARGIN.left - 10} y={MARGIN.top + 10} textAnchor="end" className="raw-log-viz-tick">
        {yMaxLabel}
      </text>
      <text x={MARGIN.left - 10} y={MARGIN.top + plotHeight} dominantBaseline="hanging" textAnchor="end" className="raw-log-viz-tick">
        {yMinLabel}
      </text>
    </>
  );
}

function median(values: number[]) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function distributionAxisTitle(distributionType: DistributionType) {
  if (distributionType === "days_week") return "Day of week";
  if (distributionType === "days_month") return "Day of month";
  if (distributionType === "months") return "Month";
  if (distributionType === "hours") return "Hour";
  if (distributionType === "weeks") return "ISO week";
  return "Year";
}
