import { fireEvent, render, screen } from "@testing-library/react";

import { DfgFilterDrawer } from "@/components/analysis/dfg-filter-drawer";

describe("DfgFilterDrawer", () => {
  it("renders top-k controls and summary stats", () => {
    render(
      <DfgFilterDrawer
        open
        panelView="variant"
        activityRows={[
          { activity: "A", frequency: 10 },
          { activity: "B", frequency: 8 },
        ]}
        selectedActivities={["A", "B"]}
        availableVariants={[
          { activities: ["A", "B"], frequency: 5 },
          { activities: ["A", "C"], frequency: 3 },
        ]}
        selectedVariants={[]}
        variantMode="top_k"
        topVariantPercentage={80}
        filteredCaseCount={12}
        filteredEventCount={41}
        keptVariantCount={2}
        onToggle={() => {}}
        onPanelViewChange={() => {}}
        onSelectedActivitiesChange={() => {}}
        onSelectedVariantsChange={() => {}}
        onVariantModeChange={() => {}}
        onTopVariantPercentageChange={() => {}}
      />,
    );

    expect(screen.getByText("Filter directly-follows graphs")).toBeInTheDocument();
    expect(screen.getByText("12 cases")).toBeInTheDocument();
    expect(screen.getByText("41 events")).toBeInTheDocument();
    expect(screen.getByLabelText(/Most frequent case coverage/i)).toHaveValue("80");
  });

  it("switches manual reset back to all variants", () => {
    const onVariantModeChange = vi.fn();
    const onSelectedVariantsChange = vi.fn();

    render(
      <DfgFilterDrawer
        open
        panelView="variant"
        activityRows={[{ activity: "A", frequency: 10 }]}
        selectedActivities={["A"]}
        availableVariants={[{ activities: ["A", "B"], frequency: 5 }]}
        selectedVariants={[["A", "B"]]}
        variantMode="manual"
        topVariantPercentage={80}
        onToggle={() => {}}
        onPanelViewChange={() => {}}
        onSelectedActivitiesChange={() => {}}
        onSelectedVariantsChange={onSelectedVariantsChange}
        onVariantModeChange={onVariantModeChange}
        onTopVariantPercentageChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(onSelectedVariantsChange).toHaveBeenCalledWith([]);
    expect(onVariantModeChange).toHaveBeenCalledWith("all");
  });

  it("commits top-percent changes only after release", () => {
    const onTopVariantPercentageChange = vi.fn();

    render(
      <DfgFilterDrawer
        open
        panelView="variant"
        activityRows={[{ activity: "A", frequency: 10 }]}
        selectedActivities={["A"]}
        availableVariants={[{ activities: ["A", "B"], frequency: 5 }]}
        selectedVariants={[]}
        variantMode="top_k"
        topVariantPercentage={80}
        onToggle={() => {}}
        onPanelViewChange={() => {}}
        onSelectedActivitiesChange={() => {}}
        onSelectedVariantsChange={() => {}}
        onVariantModeChange={() => {}}
        onTopVariantPercentageChange={onTopVariantPercentageChange}
      />,
    );

    const slider = screen.getByLabelText(/Most frequent case coverage/i);
    fireEvent.change(slider, { target: { value: "60" } });
    expect(onTopVariantPercentageChange).not.toHaveBeenCalled();

    fireEvent.mouseUp(slider);
    expect(onTopVariantPercentageChange).toHaveBeenCalledWith(60);
  });
});
