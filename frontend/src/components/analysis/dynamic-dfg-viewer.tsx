"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
  type ElkPoint,
  type ElkPort,
} from "elkjs/lib/elk.bundled.js";

import type { DfgEdge, LogInsights, PerformanceDfgEdge, VariantEdgePerformance } from "@/lib/types";

export interface DfgTraceVariant {
  id: string;
  activities: string[];
  count: number;
  edgePerformance: VariantEdgePerformance[];
}

export interface DfgGraphData {
  sa: Record<string, number>;
  ea: Record<string, number>;
  dfg: DfgEdge[];
}

export interface DfgPerformanceGraphData {
  sa: Record<string, number>;
  ea: Record<string, number>;
  dfg: PerformanceDfgEdge[];
}

export interface DfgData extends DfgGraphData {
  performanceDfg: PerformanceDfgEdge[];
  variants: DfgTraceVariant[];
}

type DfgMode = "regular" | "performance";
type PerformanceMetric = "mean" | "median" | "max" | "min" | "sum" | "stdev";

type NodeKind = "activity" | "start" | "end";

type EdgeRecord = {
  id: string;
  source: string;
  target: string;
  count: number;
  dashed: boolean;
};

type LayoutNodeRecord = {
  id: string;
  label: string;
  kind: NodeKind;
  count: number;
  ratio: number;
  hexColor: string;
  hexSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutEdgeRecord = {
  id: string;
  source: string;
  target: string;
  count: number;
  ratio: number;
  dashed: boolean;
  path: string;
  labelX: number;
  labelY: number;
};

type DfgNodeData = {
  label: string;
  kind: NodeKind;
  count: number;
  hexColor: string;
  hexSize: number;
  active: boolean;
};

type DfgEdgeData = {
  label: string | null;
  dashed: boolean;
  path: string;
  labelX: number;
  labelY: number;
  stroke: string;
  width: number;
  active: boolean;
};

type DfgFlowNode = Node<DfgNodeData, "dfgNode">;
type DfgFlowEdge = Edge<DfgEdgeData, "dfgEdge">;

type LayoutGraph = {
  nodes: LayoutNodeRecord[];
  edges: LayoutEdgeRecord[];
};

const elk = new ELK();

const VIRTUAL_START = "__start__";
const VIRTUAL_END = "__end__";
const DIAMOND_POINTS = "50,2 98,50 50,98 2,50";
const NODE_LIGHT = [254, 244, 232] as const;
const NODE_DARK = [230, 126, 34] as const;
const EDGE_LIGHT = [253, 230, 200] as const;
const EDGE_DARK = [192, 93, 0] as const;
const EDGE_INACTIVE = "#f0e8df";
const SHELL_BG = "#ffffff";
const ACCENT = "#e67e22";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function mixColor(from: readonly [number, number, number], to: readonly [number, number, number], ratio: number) {
  const normalized = clamp(ratio, 0, 1);
  const mixed = from.map((channel, index) => Math.round(channel + (to[index] - channel) * normalized));
  return `rgb(${mixed[0]} ${mixed[1]} ${mixed[2]})`;
}

function sumCounts(counts: Record<string, number>) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function collectActivities(data: DfgGraphData) {
  const ids = new Set<string>();

  for (const name of Object.keys(data.sa)) ids.add(name);
  for (const name of Object.keys(data.ea)) ids.add(name);
  for (const edge of data.dfg) {
    ids.add(edge.source);
    ids.add(edge.target);
  }

  return [...ids];
}

function getNodeCounts(data: DfgGraphData) {
  const incoming: Record<string, number> = {};
  const outgoing: Record<string, number> = {};

  for (const edge of data.dfg) {
    incoming[edge.target] = (incoming[edge.target] ?? 0) + edge.count;
    outgoing[edge.source] = (outgoing[edge.source] ?? 0) + edge.count;
  }

  const counts: Record<string, number> = {};
  for (const name of collectActivities(data)) {
    counts[name] = Math.max(incoming[name] ?? 0, outgoing[name] ?? 0, data.sa[name] ?? 0, data.ea[name] ?? 0);
  }

  return counts;
}

function buildEdgeRecords(data: DfgGraphData) {
  return [
    ...Object.entries(data.sa).map(
      ([target, count]): EdgeRecord => ({
        id: edgeId(VIRTUAL_START, target),
        source: VIRTUAL_START,
        target,
        count,
        dashed: true,
      }),
    ),
    ...data.dfg.map(
      (edge): EdgeRecord => ({
        id: edgeId(edge.source, edge.target),
        source: edge.source,
        target: edge.target,
        count: edge.count,
        dashed: false,
      }),
    ),
    ...Object.entries(data.ea).map(
      ([source, count]): EdgeRecord => ({
        id: edgeId(source, VIRTUAL_END),
        source,
        target: VIRTUAL_END,
        count,
        dashed: true,
      }),
    ),
  ];
}

function aggregateVariants(variants: DfgTraceVariant[]): DfgGraphData {
  const sa: Record<string, number> = {};
  const ea: Record<string, number> = {};
  const dfgMap = new Map<string, number>();

  for (const variant of variants) {
    if (variant.activities.length === 0) {
      continue;
    }

    const first = variant.activities[0];
    const last = variant.activities[variant.activities.length - 1];
    sa[first] = (sa[first] ?? 0) + variant.count;
    ea[last] = (ea[last] ?? 0) + variant.count;

    for (let index = 0; index < variant.activities.length - 1; index += 1) {
      const source = variant.activities[index];
      const target = variant.activities[index + 1];
      const key = `${source}|||${target}`;
      dfgMap.set(key, (dfgMap.get(key) ?? 0) + variant.count);
    }
  }

  const dfg = [...dfgMap.entries()].map(([key, count]) => {
    const [source, target] = key.split("|||");
    return { source, target, count };
  });

  return { sa, ea, dfg };
}

function aggregatePerformanceVariants(variants: DfgTraceVariant[]): DfgPerformanceGraphData {
  const regularGraph = aggregateVariants(variants);
  const performanceMap = new Map<string, { source: string; target: string; samples: number[] }>();

  for (const variant of variants) {
    for (const edge of variant.edgePerformance) {
      const key = `${edge.source}|||${edge.target}`;
      const current = performanceMap.get(key) ?? {
        source: edge.source,
        target: edge.target,
        samples: [],
      };
      current.samples.push(...edge.samples);
      performanceMap.set(key, current);
    }
  }

  return {
    sa: regularGraph.sa,
    ea: regularGraph.ea,
    dfg: [...performanceMap.values()]
      .filter((edge) => edge.samples.length > 0)
      .map((edge) => performanceMetricsFromSamples(edge.source, edge.target, edge.samples)),
  };
}

function filterVariants(variants: DfgTraceVariant[], variantPct: number, hiddenVariants: Set<string>) {
  const visibleVariants = variants.filter((variant) => !hiddenVariants.has(variant.id));
  const keptVariantCount = Math.max(0, Math.ceil((variantPct / 100) * visibleVariants.length));

  return visibleVariants
    .slice()
    .sort((left, right) => {
      const countDiff = right.count - left.count;
      if (countDiff !== 0) {
        return countDiff;
      }

      return left.activities.join(" -> ").localeCompare(right.activities.join(" -> "));
    })
    .slice(0, keptVariantCount);
}

function filterActivities(raw: DfgGraphData, activityPct: number, hiddenActivities: Set<string>) {
  const visibleRankedNodes = Object.entries(getNodeCounts(raw))
    .filter(([name]) => !hiddenActivities.has(name))
    .sort(([leftName, leftCount], [rightName, rightCount]) => {
      const countDiff = rightCount - leftCount;
      if (countDiff !== 0) {
        return countDiff;
      }

      return leftName.localeCompare(rightName);
    })
    .map(([name]) => name);

  const keptNodeCount = Math.max(
    visibleRankedNodes.length === 0 ? 0 : 1,
    Math.ceil((activityPct / 100) * visibleRankedNodes.length),
  );
  const keptNodes = new Set(visibleRankedNodes.slice(0, keptNodeCount));

  return {
    keptNodes,
    graph: {
      sa: Object.fromEntries(Object.entries(raw.sa).filter(([name]) => keptNodes.has(name))),
      ea: Object.fromEntries(Object.entries(raw.ea).filter(([name]) => keptNodes.has(name))),
      dfg: raw.dfg
        .filter((edge) => keptNodes.has(edge.source) && keptNodes.has(edge.target))
        .sort((left, right) => right.count - left.count),
    },
  };
}

function filterPerformanceGraph(raw: DfgPerformanceGraphData, keptNodes: Set<string>): DfgPerformanceGraphData {
  return {
    sa: Object.fromEntries(Object.entries(raw.sa).filter(([name]) => keptNodes.has(name))),
    ea: Object.fromEntries(Object.entries(raw.ea).filter(([name]) => keptNodes.has(name))),
    dfg: raw.dfg
      .filter((edge) => keptNodes.has(edge.source) && keptNodes.has(edge.target))
      .sort((left, right) => right.mean - left.mean),
  };
}

function buildPointPath(points: ElkPoint[]) {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
}

function midpointOnPolyline(points: ElkPoint[]) {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const segments = points.slice(1).map((point, index) => {
    const previous = points[index];
    return {
      start: previous,
      end: point,
      length: Math.hypot(point.x - previous.x, point.y - previous.y),
    };
  });

  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (totalLength === 0) {
    return points[0];
  }

  let target = totalLength / 2;
  for (const segment of segments) {
    if (target <= segment.length) {
      const ratio = segment.length === 0 ? 0 : target / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }

    target -= segment.length;
  }

  return points.at(-1) ?? points[0];
}

function edgeId(source: string, target: string) {
  return `${source}->${target}`;
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return "0s";
  }

  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) {
    return `${rounded}s`;
  }
  if (rounded < 3600) {
    const minutes = Math.round(rounded / 60);
    return `${minutes} min`;
  }
  if (rounded < 86400) {
    const hours = Math.round((rounded / 3600) * 10) / 10;
    return `${hours} h`;
  }

  const days = Math.round((rounded / 86400) * 10) / 10;
  return `${days} d`;
}

function performanceMetricsFromSamples(source: string, target: string, samples: number[]): PerformanceDfgEdge {
  const sorted = samples
    .filter((sample) => Number.isFinite(sample))
    .map((sample) => Math.max(0, sample))
    .sort((left, right) => left - right);
  const occurrences = sorted.length;

  if (occurrences === 0) {
    return {
      source,
      target,
      mean: 0,
      median: 0,
      max: 0,
      min: 0,
      sum: 0,
      stdev: 0,
      occurrences: 0,
    };
  }

  const sum = sorted.reduce((total, sample) => total + sample, 0);
  const mean = sum / occurrences;
  const middle = Math.floor(occurrences / 2);
  const median =
    occurrences % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const variance =
    occurrences > 0 ? sorted.reduce((total, sample) => total + (sample - mean) ** 2, 0) / occurrences : 0;

  return {
    source,
    target,
    mean,
    median,
    max: sorted[occurrences - 1],
    min: sorted[0],
    sum,
    stdev: Math.sqrt(Math.max(variance, 0)),
    occurrences,
  };
}

function performanceMetricValue(edge: PerformanceDfgEdge, metric: PerformanceMetric) {
  return edge[metric] ?? 0;
}

function sortEdgesForPorts(nodeId: string, edges: EdgeRecord[], nodeCounts: Record<string, number>) {
  return [...edges].sort((left, right) => {
    const leftOther = left.source === nodeId ? left.target : left.source;
    const rightOther = right.source === nodeId ? right.target : right.source;
    const leftBoundary = leftOther === VIRTUAL_START || leftOther === VIRTUAL_END;
    const rightBoundary = rightOther === VIRTUAL_START || rightOther === VIRTUAL_END;

    if (leftBoundary !== rightBoundary) {
      return leftBoundary ? -1 : 1;
    }

    const countDiff = right.count - left.count;
    if (countDiff !== 0) {
      return countDiff;
    }

    const weightDiff = (nodeCounts[rightOther] ?? 0) - (nodeCounts[leftOther] ?? 0);
    if (weightDiff !== 0) {
      return weightDiff;
    }

    return leftOther.localeCompare(rightOther);
  });
}

function createPorts(
  nodeId: string,
  width: number,
  height: number,
  incomingEdges: EdgeRecord[],
  outgoingEdges: EdgeRecord[],
  nodeCounts: Record<string, number>,
) {
  const ports: ElkPort[] = [];
  const sortedIncoming = sortEdgesForPorts(nodeId, incomingEdges, nodeCounts);
  const sortedOutgoing = sortEdgesForPorts(nodeId, outgoingEdges, nodeCounts);

  sortedIncoming.forEach((edge, index) => {
    ports.push({
      id: `${nodeId}::in::${edge.id}`,
      width: 1,
      height: 1,
      x: ((index + 1) / (sortedIncoming.length + 1)) * width,
      y: 0,
      layoutOptions: { "elk.port.side": "NORTH" },
    });
  });

  sortedOutgoing.forEach((edge, index) => {
    ports.push({
      id: `${nodeId}::out::${edge.id}`,
      width: 1,
      height: 1,
      x: ((index + 1) / (sortedOutgoing.length + 1)) * width,
      y: height,
      layoutOptions: { "elk.port.side": "SOUTH" },
    });
  });

  return ports;
}

async function computeLayout(data: DfgGraphData): Promise<LayoutGraph> {
  const activities = collectActivities(data);
  const edgeRecords = buildEdgeRecords(data);
  if (activities.length === 0 && edgeRecords.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeCounts = getNodeCounts(data);
  const boundaryCounts = {
    [VIRTUAL_START]: sumCounts(data.sa),
    [VIRTUAL_END]: sumCounts(data.ea),
  };
  const maxNodeCount = Math.max(...Object.values(nodeCounts), boundaryCounts[VIRTUAL_START], boundaryCounts[VIRTUAL_END], 1);

  const allNodeIds = [VIRTUAL_START, ...activities, VIRTUAL_END];
  const edgesByNode = new Map(allNodeIds.map((id) => [id, { incoming: [] as EdgeRecord[], outgoing: [] as EdgeRecord[] }]));

  for (const edge of edgeRecords) {
    edgesByNode.get(edge.source)?.outgoing.push(edge);
    edgesByNode.get(edge.target)?.incoming.push(edge);
  }

  const children: ElkNode[] = allNodeIds.map((nodeId) => {
    const isBoundary = nodeId === VIRTUAL_START || nodeId === VIRTUAL_END;
    const label = isBoundary ? (nodeId === VIRTUAL_START ? "Process Start" : "Process End") : nodeId;
    const width = isBoundary ? 196 : clamp(label.length * 6.6 + 84, 170, 294);
    const height = 54;
    const portInfo = edgesByNode.get(nodeId) ?? { incoming: [], outgoing: [] };

    return {
      id: nodeId,
      width,
      height,
      ports: createPorts(nodeId, width, height, portInfo.incoming, portInfo.outgoing, nodeCounts),
      layoutOptions: { "elk.portConstraints": "FIXED_POS" },
    };
  });

  const elkEdges: ElkExtendedEdge[] = edgeRecords.map((edge) => ({
    id: edge.id,
    sources: [`${edge.source}::out::${edge.id}`],
    targets: [`${edge.target}::in::${edge.id}`],
  }));

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "POLYLINE",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.cycleBreaking.strategy": "GREEDY",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.layered.spacing.nodeNodeBetweenLayers": "160",
      "elk.layered.spacing.edgeNodeBetweenLayers": "40",
      "elk.spacing.nodeNode": "170",
      "elk.spacing.edgeNode": "32",
      "elk.padding": "[top=36,left=96,bottom=36,right=96]",
    },
    children,
    edges: elkEdges,
  };

  const laidOutGraph = await elk.layout(graph);
  const laidOutNodes = new Map((laidOutGraph.children ?? []).map((node) => [node.id, node]));
  const laidOutEdges = new Map((laidOutGraph.edges ?? []).map((edge) => [edge.id ?? "", edge]));

  const nodes = allNodeIds
    .map((nodeId) => {
      const elkNode = laidOutNodes.get(nodeId);
      if (!elkNode) {
        return null;
      }

      const isStart = nodeId === VIRTUAL_START;
      const isEnd = nodeId === VIRTUAL_END;
      const count = isStart ? boundaryCounts[VIRTUAL_START] : isEnd ? boundaryCounts[VIRTUAL_END] : (nodeCounts[nodeId] ?? 0);
      const ratio = count / maxNodeCount;
      const label = isStart ? "Process Start" : isEnd ? "Process End" : nodeId;

      return {
        id: nodeId,
        label,
        kind: isStart ? "start" : isEnd ? "end" : "activity",
        count,
        ratio,
        hexColor: mixColor(NODE_LIGHT, NODE_DARK, isStart || isEnd ? 0.96 : ratio),
        hexSize: isStart || isEnd ? 30 : 17 + ratio * 14,
        x: elkNode.x ?? 0,
        y: elkNode.y ?? 0,
        width: elkNode.width ?? 180,
        height: elkNode.height ?? 54,
      } satisfies LayoutNodeRecord;
    })
    .filter((node): node is LayoutNodeRecord => node !== null);

  const maxEdgeCount = Math.max(...edgeRecords.map((edge) => edge.count), 1);
  const edges = edgeRecords
    .map((edge) => {
      const elkEdge = laidOutEdges.get(edge.id);
      const section = elkEdge?.sections?.[0];
      if (!section) {
        return null;
      }

      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      const labelPoint = midpointOnPolyline(points);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        count: edge.count,
        ratio: edge.count / maxEdgeCount,
        dashed: edge.dashed,
        path: buildPointPath(points),
        labelX: labelPoint.x,
        labelY: labelPoint.y - 10,
      } satisfies LayoutEdgeRecord;
    })
    .filter((edge): edge is LayoutEdgeRecord => edge !== null);

  return { nodes, edges };
}

function HiddenHandles() {
  return (
    <>
      <Handle id="target" type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle
        id="source"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, pointerEvents: "none" }}
      />
    </>
  );
}

function DiamondIcon({ kind, size, color }: { kind: NodeKind; size: number; color: string }) {
  const height = size * 0.9;
  const strokeWidth = kind === "activity" ? 0 : 6;

  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="dynamic-dfg-shrink"
      style={{ filter: "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.08))" }}
    >
      <polygon
        points={DIAMOND_POINTS}
        fill={kind === "activity" ? color : "#ffffff"}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      {kind === "start" ? <polygon points="42,35 42,65 66,50" fill={color} /> : null}
      {kind === "end" ? <rect x="38" y="38" width="24" height="24" rx="2" fill={color} /> : null}
    </svg>
  );
}

function DfgNodeCard({ data }: NodeProps<DfgFlowNode>) {
  return (
    <div
      title={`${data.label}: ${data.count.toLocaleString()}`}
      className="dynamic-dfg-node"
      style={{
        borderColor: "#e0e0e0",
        boxShadow: "0 1px 8px rgba(28, 33, 37, 0.08)",
        opacity: data.active ? 1 : 0.24,
        transition: "opacity 140ms ease",
      }}
    >
      <HiddenHandles />
      <DiamondIcon kind={data.kind} size={data.hexSize} color={data.hexColor} />
      <div className="dynamic-dfg-node-text">
        <div className="dynamic-dfg-node-label">{data.label}</div>
        <div className="dynamic-dfg-node-count">{data.count.toLocaleString()}</div>
      </div>
    </div>
  );
}

function DfgEdgeLine({ id, markerEnd, data }: EdgeProps<DfgFlowEdge>) {
  const edgeData = data;
  if (!edgeData) {
    return null;
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgeData.path}
        markerEnd={markerEnd}
        style={{
          stroke: edgeData.stroke,
          strokeWidth: edgeData.width,
          opacity: edgeData.active ? 1 : 0.18,
          strokeDasharray: edgeData.dashed ? "6 5" : undefined,
        }}
      />
      {!edgeData.dashed ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${edgeData.labelX}px, ${edgeData.labelY}px)`,
              pointerEvents: "none",
              color: edgeData.active ? "#c05d00" : "#c5b8a8",
              fontSize: 11,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {edgeData.label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const nodeTypes = {
  dfgNode: DfgNodeCard,
};

const edgeTypes = {
  dfgEdge: DfgEdgeLine,
};

function PctRing({ value }: { value: number }) {
  const size = 68;
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="dynamic-dfg-ring">
      <svg width={size} height={size} className="dynamic-dfg-ring-svg">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e0e0e0" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ACCENT}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="dynamic-dfg-ring-value">{Math.round(value)}%</div>
    </div>
  );
}

function SectionIcon({ type }: { type: "activities" | "variants" }) {
  if (type === "activities") {
    return (
      <svg width="18" height="18" viewBox="0 0 100 100" aria-hidden="true">
        <polygon points={DIAMOND_POINTS} fill={ACCENT} />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2v16m0 0-5-5m5 5 5-5"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListPopover({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="dynamic-dfg-list-popover" style={{ borderColor: "#e0e0e0" }}>
      <div className="dynamic-dfg-list-header">
        <div className="dynamic-dfg-list-title">{title}</div>
        <button type="button" onClick={onClose} className="dynamic-dfg-list-close">
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

function FilterSection({
  type,
  title,
  pct,
  totalCount,
  shownCount,
  listOpen,
  onToggleList,
  onChange,
  onReset,
  onLess,
  onMore,
  onExtraAction,
  extraActionLabel,
  children,
}: {
  type: "activities" | "variants";
  title: string;
  pct: number;
  totalCount: number;
  shownCount: number;
  listOpen: boolean;
  onToggleList: () => void;
  onChange: (value: number) => void;
  onReset: () => void;
  onLess: () => void;
  onMore: () => void;
  onExtraAction?: () => void;
  extraActionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className="dynamic-dfg-filter-section">
      <div className="dynamic-dfg-filter-head">
        <div className="dynamic-dfg-filter-title">
          <SectionIcon type={type} />
          <span>{title}</span>
        </div>
        <button type="button" onClick={onToggleList} className="dynamic-dfg-list-button">
          List view
        </button>
      </div>

      {listOpen ? children : null}

      <div className="dynamic-dfg-filter-body">
        <div className="dynamic-dfg-slider-column">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(event) => onChange(Number(event.target.value))}
            className="dynamic-dfg-slider"
          />
        </div>

        <div className="dynamic-dfg-filter-summary">
          <PctRing value={pct} />
          <div className="dynamic-dfg-filter-label">of {type}</div>
          <div className="dynamic-dfg-filter-count">
            {shownCount}/{totalCount}
          </div>

          <button type="button" onClick={onReset} className="dynamic-dfg-filter-button">
            Reset
          </button>

          <div className="dynamic-dfg-filter-actions">
            <button type="button" onClick={onLess} className="dynamic-dfg-filter-button">
              Less -
            </button>
            <button type="button" onClick={onMore} className="dynamic-dfg-filter-button">
              More +
            </button>
          </div>

          {onExtraAction && extraActionLabel ? (
            <button type="button" onClick={onExtraAction} className="dynamic-dfg-filter-button dynamic-dfg-filter-button-wide">
              {extraActionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function GraphToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <Panel position="top-right">
      <div className="dynamic-dfg-graph-toolbar">
        <div className="dynamic-dfg-zoom-pill" style={{ borderColor: "#e0e0e0", boxShadow: "0 1px 4px rgba(28, 33, 37, 0.08)" }}>
          <button type="button" onClick={() => void zoomOut({ duration: 140 })} className="dynamic-dfg-toolbar-button">
            -
          </button>
          <div className="dynamic-dfg-zoom-label" title={`${Math.round(zoom * 100)}%`}>
            Zoom
          </div>
          <button type="button" onClick={() => void zoomIn({ duration: 140 })} className="dynamic-dfg-toolbar-button">
            +
          </button>
        </div>

        <button
          type="button"
          onClick={() => void fitView({ padding: 0.08, duration: 180 })}
          className="dynamic-dfg-fit-pill"
          style={{ borderColor: "#e0e0e0", boxShadow: "0 1px 4px rgba(28, 33, 37, 0.08)" }}
        >
          Fit
        </button>
      </div>
    </Panel>
  );
}

function DfgVisualizationInner({
  data,
  mode,
  performanceMetric,
}: {
  data: DfgData;
  mode: DfgMode;
  performanceMetric: PerformanceMetric;
}) {
  const { fitView } = useReactFlow();
  const [isPending, startTransition] = useTransition();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [activityPct, setActivityPct] = useState(100);
  const [variantPct, setVariantPct] = useState(100);
  const [hiddenActivities, setHiddenActivities] = useState<Set<string>>(new Set());
  const [hiddenVariants, setHiddenVariants] = useState<Set<string>>(new Set());
  const [activityListOpen, setActivityListOpen] = useState(false);
  const [variantListOpen, setVariantListOpen] = useState(false);
  const [layoutGraph, setLayoutGraph] = useState<LayoutGraph>({ nodes: [], edges: [] });
  const variants = useMemo(() => data.variants ?? [], [data.variants]);
  const performanceDfg = useMemo(() => data.performanceDfg ?? [], [data.performanceDfg]);
  const regularData = useMemo(
    () => ({
      sa: data.sa ?? {},
      ea: data.ea ?? {},
      dfg: data.dfg ?? [],
    }),
    [data.dfg, data.ea, data.sa],
  );

  const deferredActivityPct = useDeferredValue(activityPct);
  const deferredVariantPct = useDeferredValue(variantPct);

  const nodeCounts = useMemo(() => getNodeCounts(regularData), [regularData]);
  const sortedActivities = useMemo(
    () =>
      Object.entries(nodeCounts).sort(([leftName, leftCount], [rightName, rightCount]) => {
        const countDiff = rightCount - leftCount;
        if (countDiff !== 0) {
          return countDiff;
        }

        return leftName.localeCompare(rightName);
      }),
    [nodeCounts],
  );

  const visibleVariants = useMemo(
    () => filterVariants(variants, deferredVariantPct, hiddenVariants),
    [deferredVariantPct, hiddenVariants, variants],
  );

  const variantFilteredRegularGraph = useMemo(() => aggregateVariants(visibleVariants), [visibleVariants]);
  const variantFilteredPerformanceGraph = useMemo(() => {
    const usesAllVariants = deferredVariantPct === 100 && hiddenVariants.size === 0 && visibleVariants.length === variants.length;
    if (usesAllVariants && performanceDfg.length) {
      return {
        sa: regularData.sa,
        ea: regularData.ea,
        dfg: performanceDfg,
      };
    }

    return aggregatePerformanceVariants(visibleVariants);
  }, [deferredVariantPct, hiddenVariants.size, performanceDfg, regularData.ea, regularData.sa, variants.length, visibleVariants]);

  const filteredRegularResult = useMemo(
    () =>
      filterActivities(
        deferredVariantPct === 100 && hiddenVariants.size === 0 && visibleVariants.length === variants.length
          ? regularData
          : variantFilteredRegularGraph,
        deferredActivityPct,
        hiddenActivities,
      ),
    [deferredActivityPct, deferredVariantPct, hiddenActivities, hiddenVariants.size, regularData, variantFilteredRegularGraph, variants.length, visibleVariants.length],
  );
  const filteredRegularData = filteredRegularResult.graph;
  const filteredPerformanceData = useMemo(
    () => filterPerformanceGraph(variantFilteredPerformanceGraph, filteredRegularResult.keptNodes),
    [filteredRegularResult.keptNodes, variantFilteredPerformanceGraph],
  );

  const filteredEdgeRecords = useMemo(() => buildEdgeRecords(filteredRegularData), [filteredRegularData]);
  const visibleNodeIds = useMemo(() => new Set(layoutGraph.nodes.map((node) => node.id)), [layoutGraph.nodes]);
  const performanceMetricsById = useMemo(
    () => new Map(filteredPerformanceData.dfg.map((edge) => [edgeId(edge.source, edge.target), edge])),
    [filteredPerformanceData.dfg],
  );
  const maxPerformanceMean = useMemo(
    () => Math.max(...filteredPerformanceData.dfg.map((edge) => performanceMetricValue(edge, performanceMetric)), 1),
    [filteredPerformanceData.dfg, performanceMetric],
  );

  const effectiveFocusedNodeId = focusedNodeId && visibleNodeIds.has(focusedNodeId) ? focusedNodeId : null;

  const connectedNodeIds = useMemo(() => {
    if (!effectiveFocusedNodeId) {
      return null;
    }

    const connected = new Set<string>([effectiveFocusedNodeId]);
    for (const edge of filteredEdgeRecords) {
      if (edge.source === effectiveFocusedNodeId || edge.target === effectiveFocusedNodeId) {
        connected.add(edge.source);
        connected.add(edge.target);
      }
    }

    return connected;
  }, [effectiveFocusedNodeId, filteredEdgeRecords]);

  const connectedEdgeIds = useMemo(() => {
    if (!effectiveFocusedNodeId) {
      return null;
    }

    return new Set(
      filteredEdgeRecords
        .filter((edge) => edge.source === effectiveFocusedNodeId || edge.target === effectiveFocusedNodeId)
        .map((edge) => edge.id),
    );
  }, [effectiveFocusedNodeId, filteredEdgeRecords]);

  const totalActivities = sortedActivities.length;
  const shownActivities = useMemo(() => collectActivities(filteredRegularData).length, [filteredRegularData]);
  const totalVariants = variants.length;
  const shownVariants = visibleVariants.length;

  const sortedVariants = useMemo(
    () =>
      [...variants].sort((left, right) => {
        const countDiff = right.count - left.count;
        if (countDiff !== 0) {
          return countDiff;
        }

        return left.activities.join(" -> ").localeCompare(right.activities.join(" -> "));
      }),
    [variants],
  );

  useEffect(() => {
    let cancelled = false;

    void computeLayout(filteredRegularData).then((nextLayout) => {
      if (cancelled) {
        return;
      }

      setLayoutGraph(nextLayout);
      requestAnimationFrame(() => {
        void fitView({ padding: 0.08, duration: 180 });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [filteredRegularData, fitView]);

  const nodes = useMemo(
    () =>
      layoutGraph.nodes.map((node) => ({
        id: node.id,
        type: "dfgNode",
        position: { x: node.x, y: node.y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        draggable: false,
        selectable: false,
        style: { width: node.width, height: node.height },
        data: {
          label: node.label,
          kind: node.kind,
          count: node.count,
          hexColor: node.hexColor,
          hexSize: node.hexSize,
          active: connectedNodeIds ? connectedNodeIds.has(node.id) : true,
        },
      }) satisfies DfgFlowNode),
    [connectedNodeIds, layoutGraph.nodes],
  );

  const edges = useMemo(
    () =>
      layoutGraph.edges.map((edge) => {
        const active = connectedEdgeIds ? connectedEdgeIds.has(edge.id) : true;
        const performanceEdge = !edge.dashed ? performanceMetricsById.get(edge.id) : null;
        const visualRatio =
          mode === "performance" && performanceEdge ? performanceMetricValue(performanceEdge, performanceMetric) / maxPerformanceMean : edge.ratio;
        const stroke = active ? mixColor(EDGE_LIGHT, EDGE_DARK, visualRatio) : EDGE_INACTIVE;
        const label =
          edge.dashed
            ? null
            : mode === "performance"
              ? formatSeconds(performanceEdge ? performanceMetricValue(performanceEdge, performanceMetric) : 0)
              : edge.count.toLocaleString();

        return {
          id: edge.id,
          type: "dfgEdge",
          source: edge.source,
          target: edge.target,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          selectable: false,
          focusable: false,
          data: {
            label,
            dashed: edge.dashed,
            path: edge.path,
            labelX: edge.labelX,
            labelY: edge.labelY,
            stroke,
            width: 1.5 + visualRatio * 4.5,
            active,
          },
        } satisfies DfgFlowEdge;
      }),
    [connectedEdgeIds, layoutGraph.edges, maxPerformanceMean, mode, performanceMetric, performanceMetricsById],
  );

  function updateActivityPct(nextValue: number) {
    startTransition(() => {
      setActivityPct(nextValue);
    });
  }

  function updateVariantPct(nextValue: number) {
    startTransition(() => {
      setVariantPct(nextValue);
    });
  }

  function toggleActivity(name: string) {
    startTransition(() => {
      setHiddenActivities((current) => {
        const next = new Set(current);
        if (next.has(name)) {
          next.delete(name);
        } else {
          next.add(name);
        }
        return next;
      });
    });
  }

  function toggleVariant(id: string) {
    startTransition(() => {
      setHiddenVariants((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    });
  }

  function handleFitLayout() {
    void fitView({ padding: 0.08, duration: 180 });
  }

  return (
    <div
      className="dynamic-dfg-shell"
      style={{
        borderColor: "#e0e0e0",
        backgroundColor: "#ffffff",
      }}
    >
      <div className="dynamic-dfg-canvas">
        <ReactFlow
          className="dynamic-dfg-flow"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, maxZoom: 1.15 }}
          minZoom={0.2}
          maxZoom={2.2}
          zoomOnScroll
          zoomOnPinch
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          onPaneClick={() => setFocusedNodeId(null)}
          onNodeMouseEnter={(_, node) => setFocusedNodeId(node.id)}
          onNodeMouseLeave={() => setFocusedNodeId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <GraphToolbar />
        </ReactFlow>
      </div>

      <aside className="dynamic-dfg-sidebar" style={{ backgroundColor: SHELL_BG, borderLeft: "1px solid #e0e0e0" }}>
        <FilterSection
          type="activities"
          title="Activities"
          pct={activityPct}
          totalCount={totalActivities}
          shownCount={shownActivities}
          listOpen={activityListOpen}
          onToggleList={() => {
            setActivityListOpen((open) => !open);
            setVariantListOpen(false);
          }}
          onChange={updateActivityPct}
          onReset={() => {
            updateActivityPct(100);
            startTransition(() => {
              setHiddenActivities(new Set());
            });
          }}
          onLess={() => updateActivityPct(Math.max(0, activityPct - 10))}
          onMore={() => updateActivityPct(Math.min(100, activityPct + 10))}
        >
          <ListPopover title="Filter activities" onClose={() => setActivityListOpen(false)}>
            <div className="dynamic-dfg-list-actions">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setHiddenActivities(new Set());
                  });
                }}
                className="dynamic-dfg-list-action-button"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setHiddenActivities(new Set(sortedActivities.map(([name]) => name)));
                  });
                }}
                className="dynamic-dfg-list-action-button"
              >
                Hide all
              </button>
            </div>
            <div className="dynamic-dfg-list-scroll">
              {sortedActivities.map(([name, count]) => {
                const visible = !hiddenActivities.has(name);
                return (
                  <label key={name} className="dynamic-dfg-list-row">
                    <div className="dynamic-dfg-list-row-main">
                      <input type="checkbox" checked={visible} onChange={() => toggleActivity(name)} />
                      <span className="dynamic-dfg-list-row-label">{name}</span>
                    </div>
                    <span className="dynamic-dfg-list-row-meta">{count.toLocaleString()}</span>
                  </label>
                );
              })}
            </div>
          </ListPopover>
        </FilterSection>

        <FilterSection
          type="variants"
          title="Trace Variants"
          pct={variantPct}
          totalCount={totalVariants}
          shownCount={shownVariants}
          listOpen={variantListOpen}
          onToggleList={() => {
            setVariantListOpen((open) => !open);
            setActivityListOpen(false);
          }}
          onChange={updateVariantPct}
          onReset={() => {
            updateVariantPct(100);
            startTransition(() => {
              setHiddenVariants(new Set());
            });
          }}
          onLess={() => updateVariantPct(Math.max(0, variantPct - 10))}
          onMore={() => updateVariantPct(Math.min(100, variantPct + 10))}
          onExtraAction={handleFitLayout}
          extraActionLabel="Fixed layout"
        >
          <ListPopover title="Filter trace variants" onClose={() => setVariantListOpen(false)}>
            <div className="dynamic-dfg-list-actions">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setHiddenVariants(new Set());
                  });
                }}
                className="dynamic-dfg-list-action-button"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setHiddenVariants(new Set(sortedVariants.map((variant) => variant.id)));
                  });
                }}
                className="dynamic-dfg-list-action-button"
              >
                Hide all
              </button>
            </div>
            <div className="dynamic-dfg-list-scroll">
              {sortedVariants.map((variant) => {
                const visible = !hiddenVariants.has(variant.id);
                return (
                  <label key={variant.id} className="dynamic-dfg-list-row dynamic-dfg-list-row-top">
                    <div className="dynamic-dfg-list-row-main dynamic-dfg-list-row-main-top">
                      <input type="checkbox" checked={visible} onChange={() => toggleVariant(variant.id)} className="dynamic-dfg-list-checkbox-top" />
                      <div className="dynamic-dfg-list-row-label">{variant.activities.join(" -> ")}</div>
                    </div>
                    <div className="dynamic-dfg-list-row-meta">{variant.count.toLocaleString()}</div>
                  </label>
                );
              })}
            </div>
          </ListPopover>
        </FilterSection>

        <div className="dynamic-dfg-pending">{isPending ? "Updating..." : ""}</div>
      </aside>
    </div>
  );
}

export function buildDfgDataFromInsights(insights: LogInsights): DfgData {
  const traceVariants = Array.isArray(insights?.trace_variants) ? insights.trace_variants : [];
  const regularDfg = Array.isArray(insights?.regular_dfg) ? insights.regular_dfg : [];
  const performanceDfg = Array.isArray(insights?.performance_dfg)
    ? insights.performance_dfg.map((edge) => ({
        source: edge?.source ?? "",
        target: edge?.target ?? "",
        mean: typeof edge?.mean === "number" ? edge.mean : typeof (edge as { mean_seconds?: number })?.mean_seconds === "number" ? (edge as { mean_seconds?: number }).mean_seconds ?? 0 : 0,
        median: typeof edge?.median === "number" ? edge.median : 0,
        max: typeof edge?.max === "number" ? edge.max : 0,
        min: typeof edge?.min === "number" ? edge.min : 0,
        sum: typeof edge?.sum === "number" ? edge.sum : typeof (edge as { total_seconds?: number })?.total_seconds === "number" ? (edge as { total_seconds?: number }).total_seconds ?? 0 : 0,
        stdev: typeof edge?.stdev === "number" ? edge.stdev : 0,
        occurrences: typeof edge?.occurrences === "number" ? edge.occurrences : 0,
      }))
    : [];

  const variants = traceVariants.map((variant, index) => {
    const activities = Array.isArray(variant?.activities) ? variant.activities : [];
    return {
      id: `variant-${index}-${activities.join("|||")}`,
      activities,
      count: typeof variant?.frequency === "number" ? variant.frequency : 0,
      edgePerformance: Array.isArray(variant?.edge_performance)
        ? variant.edge_performance.map((edge) => ({
            source: edge?.source ?? "",
            target: edge?.target ?? "",
            samples: Array.isArray(edge?.samples) ? edge.samples : [],
          }))
        : [],
    };
  });
  const fallbackRegular = aggregateVariants(variants);
  return {
    sa: insights?.start_activities ?? fallbackRegular.sa,
    ea: insights?.end_activities ?? fallbackRegular.ea,
    dfg: regularDfg.length ? regularDfg : fallbackRegular.dfg,
    performanceDfg,
    variants,
  };
}

export function DynamicDfgViewer({
  title,
  data,
  mode = "regular",
  performanceMetric = "mean",
  actions,
  emptyMessage = "Run an analysis to render this view.",
}: {
  title: string;
  data?: DfgData | null;
  mode?: DfgMode;
  performanceMetric?: PerformanceMetric;
  actions?: ReactNode;
  emptyMessage?: string;
}) {
  return (
    <section className="panel viewer-panel viewer-panel-compact exploration-surface">
      <div className="panel-header viewer-header">
        <h3>{title}</h3>
        <div className="panel-actions viewer-toolbar">{actions}</div>
      </div>

      {data ? (
        <ReactFlowProvider>
          <DfgVisualizationInner data={data} mode={mode} performanceMetric={performanceMetric} />
        </ReactFlowProvider>
      ) : (
        <div className="empty-panel viewer-empty">{emptyMessage}</div>
      )}
    </section>
  );
}
