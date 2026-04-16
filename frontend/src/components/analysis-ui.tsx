"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

import type { ActivityDuration, FootprintMatrix, TraceVariant } from "@/lib/types";

const ACTIVITY_BASE_PALETTE = [
  { bg: "#1f2430", fg: "#f8fafc" },
  { bg: "#d9485f", fg: "#fff7f8" },
  { bg: "#4a7bdc", fg: "#f6f9ff" },
  { bg: "#2f6b45", fg: "#f5fff7" },
  { bg: "#d7c6ff", fg: "#35264f" },
  { bg: "#f7f5ee", fg: "#1f2430" },
  { bg: "#66d1c8", fg: "#0f3535" },
  { bg: "#a0a6b2", fg: "#1f2430" },
  { bg: "#b7df8a", fg: "#253816" },
  { bg: "#f29a38", fg: "#3b2200" },
] as const;

function generatedActivityColor(index: number) {
  const generatedIndex = index - ACTIVITY_BASE_PALETTE.length;
  const hue = (generatedIndex * 137.508 + 23) % 360;
  const saturation = generatedIndex % 2 === 0 ? 68 : 58;
  const lightness = generatedIndex % 3 === 0 ? 80 : generatedIndex % 3 === 1 ? 75 : 84;
  return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
}

function activityColorForIndex(index: number) {
  if (index < ACTIVITY_BASE_PALETTE.length) {
    return ACTIVITY_BASE_PALETTE[index].bg;
  }
  return generatedActivityColor(index);
}

export function formatDuration(seconds: number) {
  if (!seconds) {
    return "0s";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
}

export function metricPercent(value: number | string | undefined) {
  if (typeof value !== "number") {
    return String(value ?? "-");
  }
  return `${(value * 100).toFixed(2)}%`;
}

export function activityColor(activity: string, _index = 0) {
  void _index;
  const hash = Array.from(activity).reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7);
  const positiveHash = Math.abs(hash);
  const hue = positiveHash % 360;
  const saturation = positiveHash % 2 === 0 ? 66 : 58;
  const lightness = positiveHash % 3 === 0 ? 79 : positiveHash % 3 === 1 ? 74 : 84;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function activityForegroundColor(backgroundColor: string) {
  const match = ACTIVITY_BASE_PALETTE.find((entry) => entry.bg.toLowerCase() === backgroundColor.toLowerCase());
  return match?.fg ?? "#1f2430";
}

export function buildActivityColorMap(activities: string[]) {
  return Object.fromEntries(Array.from(new Set(activities)).map((activity, index) => [activity, activityColorForIndex(index)]));
}

function variantPattern(index: number) {
  const patterns = [
    "diagonal",
    "dots",
    "horizontal",
    "vertical",
    "cross",
    "grid",
    "circles",
    "waves",
  ];
  return patterns[index % patterns.length];
}

function variantFillColor(index: number) {
  const hue = (index * 43 + 18) % 360;
  return `hsl(${hue}, 72%, 57%)`;
}

function SlicePattern({
  id,
  color,
  pattern,
}: {
  id: string;
  color: string;
  pattern: string;
}) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="12" height="12">
      <rect width="12" height="12" fill={color} opacity={0.3} />
      {pattern === "diagonal" ? <path d="M 0,12 L 12,0" stroke="white" strokeWidth="2" opacity="0.8" /> : null}
      {pattern === "dots" ? (
        <>
          <circle cx="3" cy="3" r="1.6" fill="white" opacity="0.9" />
          <circle cx="9" cy="9" r="1.6" fill="white" opacity="0.9" />
        </>
      ) : null}
      {pattern === "horizontal" ? <path d="M 0,6 L 12,6" stroke="white" strokeWidth="2" opacity="0.85" /> : null}
      {pattern === "vertical" ? <path d="M 6,0 L 6,12" stroke="white" strokeWidth="2" opacity="0.85" /> : null}
      {pattern === "cross" ? (
        <>
          <path d="M 0,12 L 12,0" stroke="white" strokeWidth="1.5" opacity="0.7" />
          <path d="M 0,0 L 12,12" stroke="white" strokeWidth="1.5" opacity="0.7" />
        </>
      ) : null}
      {pattern === "grid" ? (
        <>
          <path d="M 0,4 L 12,4" stroke="white" strokeWidth="1" opacity="0.7" />
          <path d="M 0,8 L 12,8" stroke="white" strokeWidth="1" opacity="0.7" />
          <path d="M 4,0 L 4,12" stroke="white" strokeWidth="1" opacity="0.7" />
          <path d="M 8,0 L 8,12" stroke="white" strokeWidth="1" opacity="0.7" />
        </>
      ) : null}
      {pattern === "circles" ? (
        <>
          <circle cx="3" cy="3" r="2" fill="white" opacity="0.7" />
          <circle cx="9" cy="9" r="2" fill="white" opacity="0.7" />
        </>
      ) : null}
      {pattern === "waves" ? (
        <path d="M 0,7 Q 3,2 6,7 T 12,7" stroke="white" strokeWidth="1.8" fill="none" opacity="0.8" />
      ) : null}
    </pattern>
  );
}

export function ColoredTrace({
  activities,
  colorMap,
  compact = false,
}: {
  activities: string[];
  colorMap: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "sequence-scroll compact" : "sequence-scroll"}>
      {activities.map((activity, index) => {
        const backgroundColor = colorMap[activity] ?? activityColor(activity, index);
        return (
          <span
            key={`${activity}-${index}`}
            className={compact ? "trace-chip compact" : "trace-chip"}
            style={{ backgroundColor, color: activityForegroundColor(backgroundColor) }}
          >
            {activity}
          </span>
        );
      })}
    </div>
  );
}

function FilterablePieChart({
  title,
  centerLabel,
  resetLabel,
  legendTitle,
  segments,
  legendMode = "static",
  legendButtonLabel = "Controls",
}: {
  title: string;
  centerLabel: string;
  resetLabel: string;
  legendTitle: string;
  segments: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
    pattern?: string;
    meta: string;
  }>;
  legendMode?: "static" | "drawer";
  legendButtonLabel?: string;
}) {
  const chartId = useId().replaceAll(":", "");
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const chartSize = legendMode === "drawer" ? 280 : 248;
  const center = chartSize / 2;
  const radius = legendMode === "drawer" ? 96 : 84;
  const innerRadius = legendMode === "drawer" ? 48 : 42;
  const centerValueY = center - 4;
  const centerLabelY = center + 16;

  const visibleSegments = useMemo(() => {
    const activeSegments = segments.filter((segment) => !hiddenKeys.includes(segment.key) && segment.value > 0);
    const total = activeSegments.reduce((sum, segment) => sum + segment.value, 0);

    return activeSegments
      .reduce<{
        angle: number;
        items: Array<{
          key: string;
          label: string;
          value: number;
          color: string;
          pattern?: string;
          meta: string;
          path: string;
          fill: string;
          fillId: string;
          percentage: number;
        }>;
      }>(
        (accumulator, segment, index) => {
          const startAngle = accumulator.angle;
          const portion = total ? segment.value / total : 0;
          const nextAngle = startAngle + portion * 360;
          const startRadians = (Math.PI / 180) * startAngle;
          const endRadians = (Math.PI / 180) * nextAngle;
          const x1 = center + radius * Math.cos(startRadians);
          const y1 = center + radius * Math.sin(startRadians);
          const x2 = center + radius * Math.cos(endRadians);
          const y2 = center + radius * Math.sin(endRadians);
          const largeArc = nextAngle - startAngle > 180 ? 1 : 0;
          const path = [
            `M ${center} ${center}`,
            `L ${x1} ${y1}`,
            `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
            "Z",
          ].join(" ");
          const fillId = `${chartId}-${index}`;

          return {
            angle: nextAngle,
            items: [
              ...accumulator.items,
              {
                ...segment,
                path,
                fill: segment.pattern ? `url(#${fillId})` : segment.color,
                fillId,
                percentage: total ? (segment.value / total) * 100 : 0,
              },
            ],
          };
        },
        { angle: -90, items: [] },
      )
      .items;
  }, [center, chartId, hiddenKeys, radius, segments]);

  const legendList = (
    <div className="pie-legend-list compact">
      {segments.map((segment, index) => {
        const hidden = hiddenKeys.includes(segment.key);
        return (
          <label key={segment.key} className={hidden ? "legend-toggle compact hidden" : "legend-toggle compact"}>
            <input
              type="checkbox"
              checked={!hidden}
              onChange={() =>
                setHiddenKeys((current) =>
                  hidden ? current.filter((item) => item !== segment.key) : [...current, segment.key],
                )
              }
            />
            <span className="legend-swatch">
              <svg viewBox="0 0 24 24">
                {segment.pattern ? (
                  <>
                    <defs>
                      <SlicePattern id={`${chartId}-legend-${index}`} color={segment.color} pattern={segment.pattern} />
                    </defs>
                    <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#${chartId}-legend-${index})`} />
                  </>
                ) : (
                  <rect x="1" y="1" width="22" height="22" rx="6" fill={segment.color} />
                )}
              </svg>
            </span>
            <span className="legend-copy">
              <strong>{segment.label}</strong>
              <small>{segment.meta}</small>
            </span>
          </label>
        );
      })}
    </div>
  );

  const legendContent = (
    <div className="pie-legend">
      <div className="analysis-subsection-header compact">
        <h4>{legendTitle}</h4>
      </div>
      {legendList}
    </div>
  );

  return (
    <section className="analysis-subsection">
      <div className="analysis-subsection-header">
        <h4>{title}</h4>
        <button className="ghost-button" onClick={() => setHiddenKeys([])} disabled={!hiddenKeys.length}>
          {resetLabel}
        </button>
      </div>
      <div className={legendMode === "drawer" ? "pie-layout compact drawer-mode" : "pie-layout compact"}>
        <div className={legendMode === "drawer" ? "pie-canvas-wrap compact wide" : "pie-canvas-wrap compact"}>
          {legendMode === "drawer" ? (
            <button className="ghost-button pie-drawer-toggle" type="button" onClick={() => setDrawerOpen((open) => !open)}>
              {drawerOpen ? "Close controls" : legendButtonLabel}
            </button>
          ) : null}
          <svg
            viewBox={`0 0 ${chartSize} ${chartSize}`}
            className={legendMode === "drawer" ? "pie-chart-svg compact wide" : "pie-chart-svg compact"}
            aria-label={title}
          >
            <defs>
              {visibleSegments
                .filter((segment) => segment.pattern)
                .map((segment) => (
                  <SlicePattern key={segment.fillId} id={segment.fillId} color={segment.color} pattern={segment.pattern ?? ""} />
                ))}
            </defs>

            {visibleSegments.length ? (
              visibleSegments.map((segment) => (
                <path key={segment.key} d={segment.path} fill={segment.fill} stroke="white" strokeWidth="2.2" />
              ))
            ) : (
              <circle cx={center} cy={center} r={radius} fill="#f5f5f5" />
            )}

            <circle cx={center} cy={center} r={innerRadius} fill="white" stroke="#e0e0e0" strokeWidth="1.8" />
            <text x={center} y={centerValueY} textAnchor="middle" className="pie-center-value">
              {visibleSegments.length}
            </text>
            <text x={center} y={centerLabelY} textAnchor="middle" className="pie-center-label">
              {centerLabel}
            </text>
          </svg>

          {legendMode === "drawer" ? (
            <aside className={drawerOpen ? "pie-drawer open" : "pie-drawer"}>
              <div className="pie-drawer-panel">
                <div className="pie-drawer-header">
                  <h4>{legendTitle}</h4>
                  <button className="ghost-button" type="button" onClick={() => setDrawerOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="pie-drawer-body">{legendList}</div>
              </div>
            </aside>
          ) : null}
        </div>

        {legendMode === "drawer" ? null : legendContent}
      </div>
    </section>
  );
}

export function FootprintTable({ matrix }: { matrix: FootprintMatrix }) {
  return (
    <div className="table-wrap">
      <table className="data-table footprint-table">
        <thead>
          <tr>
            <th />
            {matrix.activities.map((activity) => (
              <th key={activity}>{activity}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.activities.map((rowActivity, rowIndex) => (
            <tr key={rowActivity}>
              <th>{rowActivity}</th>
              {matrix.matrix[rowIndex].map((value, columnIndex) => (
                <td
                  key={`${rowActivity}-${columnIndex}`}
                  className={
                    value === "->" ? "relation-cell relation-sequence" : value === "||" ? "relation-cell relation-parallel" : ""
                  }
                >
                  {value || "#"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FootprintTableCard({
  title,
  matrix,
}: {
  title: string;
  matrix: FootprintMatrix;
}) {
  return (
    <section className="panel exploration-surface">
      <div className="panel-header">
        <h3>{title}</h3>
      </div>
      <FootprintTable matrix={matrix} />
    </section>
  );
}

export function ActivityAnalysisPanel({
  title,
  rows,
  totalEvents,
  shareBase,
  shareLabel,
  colorMap,
  emptyMessage,
  actions,
}: {
  title: string;
  rows: Array<{
    activity: string;
    frequency: number;
    shareCount?: number | null;
    durations: ActivityDuration;
  }>;
  totalEvents: number;
  shareBase: number;
  shareLabel: string;
  colorMap: Record<string, string>;
  emptyMessage: string;
  actions?: ReactNode;
}) {
  if (!rows.length) {
    return (
      <section className="panel exploration-surface">
        <div className="panel-header">
          <h3>{title}</h3>
          {actions ? <div className="panel-actions wrap">{actions}</div> : null}
        </div>
        <div className="empty-panel">{emptyMessage}</div>
      </section>
    );
  }

  const maxFrequency = Math.max(...rows.map((row) => row.frequency), 1);

  return (
    <section className="panel analysis-panel analysis-panel-compact exploration-surface">
      <div className="panel-header">
        <h3>{title}</h3>
        {actions ? <div className="panel-actions wrap">{actions}</div> : null}
      </div>

      <div className="analysis-overview-grid">
        <section className="analysis-subsection">
          <div className="analysis-subsection-header">
            <h4>Activity Frequency Plot</h4>
          </div>
          <div className="activity-bar-list compact">
            {rows.map((row) => {
              const eventShare = totalEvents ? (row.frequency / totalEvents) * 100 : 0;

              return (
                <article key={row.activity} className="activity-bar-row compact">
                  <span className="activity-cell activity-cell-compact">
                    <span className="activity-color-dot" style={{ backgroundColor: colorMap[row.activity] }} />
                    <span className="activity-label-text">{row.activity}</span>
                  </span>
                  <div className="bar-track compact" aria-hidden="true">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(4, (row.frequency / maxFrequency) * 100)}%`,
                        background: `linear-gradient(90deg, ${colorMap[row.activity]}, color-mix(in srgb, ${colorMap[row.activity]} 58%, white))`,
                      }}
                    />
                  </div>
                  <div className="activity-bar-metric">
                    <strong>{row.frequency}</strong>
                    <small>{eventShare.toFixed(1)}%</small>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <FilterablePieChart
          key={rows.map((row) => row.activity).join("|")}
          title="Activity Distribution"
          centerLabel="activities"
          resetLabel="Show all activities"
          legendTitle="Activity controls"
          legendMode="drawer"
          legendButtonLabel="Activity controls"
          segments={rows.map((row) => ({
            key: row.activity,
            label: row.activity,
            value: row.frequency,
            color: colorMap[row.activity],
            meta: `${((row.frequency / Math.max(totalEvents, 1)) * 100).toFixed(2)}% · ${row.frequency} events`,
          }))}
        />
      </div>

      <section className="analysis-subsection">
        <div className="analysis-subsection-header">
          <h4>Activity Table</h4>
        </div>
        <div className="table-wrap analysis-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Abs. freq</th>
                <th>{shareLabel}</th>
                <th>Avg duration</th>
                <th>Median duration</th>
                <th>Min duration</th>
                <th>Max duration</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const shareCount = row.shareCount ?? row.frequency;
                const share = shareBase ? (shareCount / shareBase) * 100 : 0;
                return (
                  <tr key={row.activity}>
                    <td>
                      <span className="activity-cell">
                        <span className="activity-color-dot" style={{ backgroundColor: colorMap[row.activity] }} />
                        {row.activity}
                      </span>
                    </td>
                    <td>{row.frequency}</td>
                    <td>{share.toFixed(2)}%</td>
                    <td>{formatDuration(row.durations.avg)}</td>
                    <td>{formatDuration(row.durations.median)}</td>
                    <td>{formatDuration(row.durations.min)}</td>
                    <td>{formatDuration(row.durations.max)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function VariantLengthHistogram({
  variants,
  totalCases,
}: {
  variants: TraceVariant[];
  totalCases: number;
}) {
  const lengthBuckets = Array.from(
    variants.reduce((map, variant) => {
      const length = variant.activities.length;
      const current = map.get(length) ?? { length, caseCount: 0, variantCount: 0 };
      current.caseCount += variant.frequency;
      current.variantCount += 1;
      map.set(length, current);
      return map;
    }, new Map<number, { length: number; caseCount: number; variantCount: number }>()),
  )
    .map(([, bucket]) => bucket)
    .sort((left, right) => left.length - right.length);

  const maxCaseCount = Math.max(...lengthBuckets.map((bucket) => bucket.caseCount), 1);

  return (
    <section className="analysis-subsection">
      <div className="analysis-subsection-header">
        <h4>Variant Length Histogram</h4>
      </div>
      <div className="activity-bar-list compact">
        {lengthBuckets.map((bucket) => {
          const caseShare = totalCases ? (bucket.caseCount / totalCases) * 100 : 0;
          const label = `${bucket.length} ${bucket.length === 1 ? "activity" : "activities"}`;
          const barColor = "#e67e22";

          return (
            <article key={bucket.length} className="activity-bar-row compact">
              <span className="activity-cell activity-cell-compact">
                <span className="activity-color-dot" style={{ backgroundColor: barColor }} />
                <span className="activity-label-text">{label}</span>
              </span>
              <div className="bar-track compact" aria-hidden="true">
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.max(4, (bucket.caseCount / maxCaseCount) * 100)}%`,
                    background: `linear-gradient(90deg, ${barColor}, color-mix(in srgb, ${barColor} 55%, white))`,
                  }}
                />
              </div>
              <div className="activity-bar-metric">
                <strong>{bucket.caseCount}</strong>
                <small>
                  {bucket.variantCount} {bucket.variantCount === 1 ? "variant" : "variants"} · {caseShare.toFixed(1)}%
                </small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function TraceVariantAnalysisPanel({
  title,
  variants,
  totalCases,
  colorMap,
  emptyMessage,
  actions,
}: {
  title: string;
  variants: TraceVariant[];
  totalCases: number;
  colorMap: Record<string, string>;
  emptyMessage: string;
  actions?: ReactNode;
}) {
  if (!variants.length) {
    return (
      <section className="panel exploration-surface">
        <div className="panel-header">
          <h3>{title}</h3>
          {actions ? <div className="panel-actions wrap">{actions}</div> : null}
        </div>
        <div className="empty-panel">{emptyMessage}</div>
      </section>
    );
  }

  return (
    <section className="panel analysis-panel analysis-panel-compact exploration-surface">
      <div className="panel-header">
        <h3>{title}</h3>
        {actions ? <div className="panel-actions wrap">{actions}</div> : null}
      </div>

      <div className="analysis-overview-grid">
        <VariantLengthHistogram variants={variants} totalCases={totalCases} />

        <FilterablePieChart
          key={variants.map((variant, index) => `${index + 1}:${variant.activities.join("::")}`).join("|")}
          title="Trace Variant Distribution"
          centerLabel="variants"
          resetLabel="Show all variants"
          legendTitle="Variant controls"
          legendMode="drawer"
          legendButtonLabel="Variant controls"
          segments={variants.map((variant, index) => ({
            key: `${index + 1}-${variant.activities.join("::")}`,
            label: `Variant ${index + 1}`,
            value: variant.frequency,
            color: variantFillColor(index),
            pattern: variantPattern(index),
            meta: `${variant.percentage.toFixed(2)}% · ${variant.frequency} cases`,
          }))}
        />
      </div>

      <section className="analysis-subsection">
        <div className="analysis-subsection-header">
          <h4>Trace Variant Table</h4>
        </div>
        <div className="table-wrap variant-table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Trace</th>
                <th>Abs. freq</th>
                <th>Rel. freq</th>
                <th>Avg TPT</th>
                <th>Median TPT</th>
                <th>Min TPT</th>
                <th>Max TPT</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => (
                <tr key={`${variant.activities.join("::")}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <ColoredTrace activities={variant.activities} colorMap={colorMap} compact />
                  </td>
                  <td>{variant.frequency}</td>
                  <td>{(variant.percentage ?? ((variant.frequency / Math.max(totalCases, 1)) * 100)).toFixed(2)}%</td>
                  <td>{formatDuration(variant.avg_tpt)}</td>
                  <td>{formatDuration(variant.median_tpt)}</td>
                  <td>{formatDuration(variant.min_tpt)}</td>
                  <td>{formatDuration(variant.max_tpt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
