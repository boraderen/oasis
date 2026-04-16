import { fireEvent, render, screen } from "@testing-library/react";

import { CompactAutoPMLeaderboard } from "@/components/analysis/autopm-leaderboard";
import type { AutoPMResult, DiscoveryResult } from "@/lib/types";

function buildMetrics(): DiscoveryResult {
  return {
    message: "ok",
    status: "success",
    svg_content: "<svg></svg>",
    bpmn_svg_content: "<svg></svg>",
    bpmn_content: "<definitions></definitions>",
    pnml_content: "<pnml></pnml>",
    log_metadata: {
      id: 1,
      kind: "log",
      filename: "basic_log.xes",
      created_at: "2026-04-03T10:00:00Z",
    },
    tbr_fitness: 0.8,
    align_fitness: 0.82,
    tbr_precision: 0.7,
    align_precision: 0.74,
    tbr_f1: 0.75,
    align_f1: 0.78,
    mean_fitness: 0.81,
    mean_precision: 0.72,
    mean_f1: 0.765,
    num_places: 3,
    num_transitions: 4,
    num_arcs: 5,
  };
}

describe("CompactAutoPMLeaderboard", () => {
  it("shows compact algorithm rows and expands candidate runs", () => {
    const leaderboard: AutoPMResult["leaderboard"] = [
      {
        algorithm: "heuristics",
        best_result: {
          algorithm: "heuristics",
          parameters: { dependency_threshold: 0.9 },
          score: 0.8123,
          best_fold_score: 0.8456,
          fold_scores: [0.81, 0.84],
          metrics: buildMetrics(),
        },
        results: [
          {
            algorithm: "heuristics",
            parameters: { dependency_threshold: 0.9 },
            score: 0.8123,
            best_fold_score: 0.8456,
            fold_scores: [0.81, 0.84],
            metrics: buildMetrics(),
          },
          {
            algorithm: "heuristics",
            parameters: { dependency_threshold: 0.8 },
            score: 0.7823,
            best_fold_score: 0.8012,
            fold_scores: [0.77, 0.8],
            metrics: buildMetrics(),
          },
        ],
      },
    ];

    const toggle = vi.fn();
    const { rerender } = render(
      <CompactAutoPMLeaderboard leaderboard={leaderboard} expandedAlgorithms={[]} onToggle={toggle} />,
    );

    expect(screen.getByText("heuristics")).toBeInTheDocument();
    expect(screen.getByText("dependency_threshold=0.9")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show 2/i }));
    expect(toggle).toHaveBeenCalledWith("heuristics");

    rerender(<CompactAutoPMLeaderboard leaderboard={leaderboard} expandedAlgorithms={["heuristics"]} onToggle={toggle} />);
    expect(screen.getByText("Run 1")).toBeInTheDocument();
    expect(screen.getByText("Run 2")).toBeInTheDocument();
  });
});
