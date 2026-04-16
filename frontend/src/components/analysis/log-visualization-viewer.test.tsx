import { fireEvent, render, screen } from "@testing-library/react";

import { LogVisualizationViewer } from "@/components/analysis/log-visualization-viewer";
import type { LogVisualizationData } from "@/lib/types";

const sampleVisualizationData: LogVisualizationData = {
  event_points: [
    {
      case_id: "case-1",
      case_index: 0,
      activity: "Start",
      timestamp: "2026-04-10T08:00:00Z",
    },
    {
      case_id: "case-2",
      case_index: 1,
      activity: "Approve",
      timestamp: "2026-04-10T09:00:00Z",
    },
  ],
  case_durations: [
    {
      case_id: "case-1",
      start_timestamp: "2026-04-10T08:00:00Z",
      end_timestamp: "2026-04-10T08:30:00Z",
      duration_seconds: 1800,
    },
  ],
};

function mockSvgBounds(element: Element) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 680,
      bottom: 320,
      width: 680,
      height: 320,
      toJSON: () => undefined,
    }),
  });
}

describe("LogVisualizationViewer", () => {
  it("opens and closes zoomed chart overlays for the charts group", () => {
    render(
      <LogVisualizationViewer
        title="Log Visualizations"
        data={sampleVisualizationData}
        vizGroup="charts"
        distributionType="days_week"
        colorMap={{ Start: "#e67e22", Approve: "#144a5c" }}
        emptyMessage="No data available."
        enableChartZoom
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed dotted chart" }));

    expect(screen.getByRole("dialog", { name: "Dotted chart" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Dotted chart" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed case duration chart" }));

    expect(screen.getByRole("dialog", { name: "Case duration" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close zoomed case duration chart" }));

    expect(screen.queryByRole("dialog", { name: "Case duration" })).not.toBeInTheDocument();
  });

  it("shows exact hover values for dotted and case duration x-axes", () => {
    render(
      <LogVisualizationViewer
        title="Log Visualizations"
        data={sampleVisualizationData}
        vizGroup="charts"
        distributionType="days_week"
        colorMap={{ Start: "#e67e22", Approve: "#144a5c" }}
        emptyMessage="No data available."
        enableChartZoom
      />,
    );

    const dottedChart = screen.getByLabelText("Dotted chart");
    mockSvgBounds(dottedChart);
    fireEvent.mouseMove(dottedChart, { clientX: 357, clientY: 120 });

    expect(screen.getByText((content) => content.includes("Apr 10, 2026") && content.includes("08:30"))).toBeInTheDocument();

    const durationChart = screen.getByLabelText("Case duration histogram");
    mockSvgBounds(durationChart);
    fireEvent.mouseMove(durationChart, { clientX: 357, clientY: 120 });

    expect(screen.getByText("15m")).toBeInTheDocument();
  });

  it("opens and closes zoomed chart overlays for the temporal group", () => {
    render(
      <LogVisualizationViewer
        title="Log Visualizations"
        data={sampleVisualizationData}
        vizGroup="temporal"
        distributionType="days_week"
        colorMap={{ Start: "#e67e22", Approve: "#144a5c" }}
        emptyMessage="No data available."
        enableChartZoom
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed events per time chart" }));

    expect(screen.getByRole("dialog", { name: "Events per time" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close zoomed events per time chart" }));

    expect(screen.queryByRole("dialog", { name: "Events per time" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open zoomed temporal event distribution chart" }));

    expect(screen.getByRole("dialog", { name: "Temporal event distribution" })).toBeInTheDocument();
  });

  it("shows exact hover values for events per time axes", () => {
    render(
      <LogVisualizationViewer
        title="Log Visualizations"
        data={sampleVisualizationData}
        vizGroup="temporal"
        distributionType="days_week"
        colorMap={{ Start: "#e67e22", Approve: "#144a5c" }}
        emptyMessage="No data available."
        enableChartZoom
      />,
    );

    const timeChart = screen.getByLabelText("Events per time");
    mockSvgBounds(timeChart);
    fireEvent.mouseMove(timeChart, { clientX: 357, clientY: 120 });

    expect(screen.getByText((content) => content.includes("Apr 10, 2026") && content.includes("08:30"))).toBeInTheDocument();
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });
});
