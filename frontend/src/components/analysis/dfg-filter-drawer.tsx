"use client";

import { useEffect, useState } from "react";

import type { DfgVariantMode, DfgVariantOption } from "@/lib/types";

function sameVariant(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

interface ActivityRow {
  activity: string;
  frequency: number;
}

export function DfgFilterDrawer({
  open,
  panelView,
  activityRows,
  selectedActivities,
  availableVariants,
  selectedVariants,
  variantMode,
  topVariantPercentage,
  filteredCaseCount,
  filteredEventCount,
  keptVariantCount,
  updating,
  onToggle,
  onPanelViewChange,
  onSelectedActivitiesChange,
  onSelectedVariantsChange,
  onVariantModeChange,
  onTopVariantPercentageChange,
}: {
  open: boolean;
  panelView: "activity" | "variant";
  activityRows: ActivityRow[];
  selectedActivities: string[];
  availableVariants: DfgVariantOption[];
  selectedVariants: string[][];
  variantMode: DfgVariantMode;
  topVariantPercentage: number;
  filteredCaseCount?: number;
  filteredEventCount?: number;
  keptVariantCount?: number;
  updating?: boolean;
  onToggle: () => void;
  onPanelViewChange: (view: "activity" | "variant") => void;
  onSelectedActivitiesChange: (activities: string[]) => void;
  onSelectedVariantsChange: (variants: string[][]) => void;
  onVariantModeChange: (mode: DfgVariantMode) => void;
  onTopVariantPercentageChange: (value: number) => void;
}) {
  const [draftTopVariantPercentage, setDraftTopVariantPercentage] = useState(topVariantPercentage);

  useEffect(() => {
    setDraftTopVariantPercentage(topVariantPercentage);
  }, [topVariantPercentage]);

  if (!open) {
    return null;
  }

  const allActivities = activityRows.map((row) => row.activity);
  const allVariants = availableVariants.map((variant) => variant.activities);

  const commitTopVariantPercentage = () => {
    if (draftTopVariantPercentage !== topVariantPercentage) {
      onTopVariantPercentageChange(draftTopVariantPercentage);
    }
  };

  return (
    <div className="dfg-filter-drawer">
      <div className="dfg-filter-header">
        <div>
          <p className="page-kicker">DFG filters</p>
          <h4>Filter directly-follows graphs</h4>
        </div>
        <button className="ghost-button" type="button" onClick={onToggle}>
          Close
        </button>
      </div>

      <div className="dfg-filter-summary">
        <span>{filteredCaseCount ?? 0} cases</span>
        <span>{filteredEventCount ?? 0} events</span>
        <span>{keptVariantCount ?? availableVariants.length} variants</span>
        {updating ? <span>Updating…</span> : null}
      </div>

      <div className="dfg-filter-pane-switch">
        <button
          className={panelView === "activity" ? "toggle-pill active" : "toggle-pill"}
          type="button"
          onClick={() => onPanelViewChange("activity")}
        >
          Activities
        </button>
        <button
          className={panelView === "variant" ? "toggle-pill active" : "toggle-pill"}
          type="button"
          onClick={() => onPanelViewChange("variant")}
        >
          Variants
        </button>
      </div>

      {panelView === "activity" ? (
        <section className="drawer-section">
          <div className="drawer-section-header">
            <h5>Activities</h5>
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={() => onSelectedActivitiesChange(allActivities)}>
                All
              </button>
              <button className="ghost-button" type="button" onClick={() => onSelectedActivitiesChange([])}>
                Clear
              </button>
            </div>
          </div>
          <p className="inline-note">
            {selectedActivities.length} of {allActivities.length} activities selected.
          </p>
          <div className="checkbox-list compact">
            {activityRows.map((row) => (
              <label key={row.activity} className="checkbox-row compact">
                <input
                  type="checkbox"
                  checked={selectedActivities.includes(row.activity)}
                  onChange={(event) =>
                    onSelectedActivitiesChange(
                      event.target.checked
                        ? [...selectedActivities, row.activity]
                        : selectedActivities.filter((value) => value !== row.activity),
                    )
                  }
                />
                <span>{row.activity}</span>
                <small>{row.frequency}</small>
              </label>
            ))}
          </div>
        </section>
      ) : (
        <section className="drawer-section">
          <div className="drawer-section-header">
            <h5>Variants</h5>
          </div>
          <div className="toolbar wrap">
            <button
              className={variantMode === "top_k" ? "toggle-pill active" : "toggle-pill"}
              type="button"
              onClick={() => onVariantModeChange("top_k")}
            >
              Top %
            </button>
            <button
              className={variantMode === "manual" ? "toggle-pill active" : "toggle-pill"}
              type="button"
              onClick={() => onVariantModeChange("manual")}
            >
              Manual
            </button>
            <button
              className={variantMode === "all" ? "toggle-pill active" : "toggle-pill"}
              type="button"
              onClick={() => onVariantModeChange("all")}
            >
              All
            </button>
          </div>

          {variantMode === "top_k" ? (
            <div className="top-k-card">
              <label className="field range-field">
                <span>Most frequent case coverage</span>
                <div className="range-shell">
                  <input
                    aria-label="Most frequent case coverage"
                    className="range-input"
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={draftTopVariantPercentage}
                    onChange={(event) => setDraftTopVariantPercentage(Number(event.target.value) || 5)}
                    onMouseUp={commitTopVariantPercentage}
                    onTouchEnd={commitTopVariantPercentage}
                    onKeyUp={commitTopVariantPercentage}
                    onBlur={commitTopVariantPercentage}
                  />
                  <strong>{draftTopVariantPercentage}%</strong>
                </div>
              </label>
              <p className="inline-note">
                Keeps the most frequent variants until they cover about {draftTopVariantPercentage}% of the currently filtered cases.
              </p>
            </div>
          ) : null}

          {variantMode === "manual" ? (
            <>
              <div className="panel-actions">
                <button className="ghost-button" type="button" onClick={() => onSelectedVariantsChange(allVariants)}>
                  All variants
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    onSelectedVariantsChange([]);
                    onVariantModeChange("all");
                  }}
                >
                  Reset
                </button>
              </div>
              <div className="checkbox-list compact tall">
                {availableVariants.map((variant, index) => {
                  const selected = selectedVariants.some((value) => sameVariant(value, variant.activities));
                  return (
                    <label key={`${variant.activities.join("->")}-${index}`} className="checkbox-row variant-row compact">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) =>
                          onSelectedVariantsChange(
                            event.target.checked
                              ? [...selectedVariants, variant.activities]
                              : selectedVariants.filter((value) => !sameVariant(value, variant.activities)),
                          )
                        }
                      />
                      <span>#{index + 1}</span>
                      <code>{variant.activities.join(" → ")}</code>
                      <small>{variant.frequency}</small>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}

          {variantMode === "all" ? (
            <p className="inline-note">
              The DFG uses every trace variant that remains after activity filtering.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}
