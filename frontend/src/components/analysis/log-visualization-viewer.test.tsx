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
      timestamp: "2026-04-10T09:15:00Z",
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
});
