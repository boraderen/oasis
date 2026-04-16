"use client";

import { Fragment } from "react";

import { metricPercent } from "@/components/analysis-ui";
import type { AutoPMResult } from "@/lib/types";

export function CompactAutoPMLeaderboard({
  leaderboard,
  expandedAlgorithms,
  onToggle,
}: {
  leaderboard: AutoPMResult["leaderboard"];
  expandedAlgorithms: string[];
  onToggle: (algorithm: string) => void;
}) {
  if (!leaderboard.length) {
    return <div className="empty-panel">No optimization run yet.</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table leaderboard-table">
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Score</th>
            <th>Best fold</th>
            <th>Mean fitness</th>
            <th>Mean precision</th>
            <th>Mean F1</th>
            <th>Parameters</th>
            <th>Runs</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((entry) => {
            const expanded = expandedAlgorithms.includes(entry.algorithm);
            return (
              <Fragment key={entry.algorithm}>
                <tr>
                  <td>{entry.algorithm}</td>
                  <td>{entry.best_result.score.toFixed(4)}</td>
                  <td>{entry.best_result.best_fold_score.toFixed(4)}</td>
                  <td>{metricPercent(entry.best_result.metrics.mean_fitness)}</td>
                  <td>{metricPercent(entry.best_result.metrics.mean_precision)}</td>
                  <td>{metricPercent(entry.best_result.metrics.mean_f1)}</td>
                  <td className="mono-cell">{formatParameters(entry.best_result.parameters)}</td>
                  <td>
                    <button className="ghost-button" type="button" onClick={() => onToggle(entry.algorithm)}>
                      {expanded ? "Hide" : "Show"} {entry.results.length}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="table-detail-row">
                    <td colSpan={8}>
                      <table className="data-table nested-table">
                        <thead>
                          <tr>
                            <th>Candidate</th>
                            <th>Score</th>
                            <th>Best fold</th>
                            <th>Mean fitness</th>
                            <th>Mean precision</th>
                            <th>Mean F1</th>
                            <th>Parameters</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.results.map((result, index) => (
                            <tr key={`${entry.algorithm}-${index}`}>
                              <td>Run {index + 1}</td>
                              <td>{result.score.toFixed(4)}</td>
                              <td>{result.best_fold_score.toFixed(4)}</td>
                              <td>{metricPercent(result.metrics.mean_fitness)}</td>
                              <td>{metricPercent(result.metrics.mean_precision)}</td>
                              <td>{metricPercent(result.metrics.mean_f1)}</td>
                              <td className="mono-cell">{formatParameters(result.parameters)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function formatParameters(parameters: Record<string, number>) {
  const entries = Object.entries(parameters);
  if (!entries.length) {
    return "Default";
  }
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}
