"use client";

import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";
import { SvgViewer } from "@/components/svg-viewer";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, persistPageState } from "@/lib/api";
import type { OCPMDiscoveryResult, OCPMVariant } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";

const variants: Array<{ key: OCPMVariant; label: string }> = [
  { key: "im", label: "Inductive Miner (IM)" },
  { key: "imd", label: "Inductive Miner Directly-Follows (IMD)" },
];

export default function OCPMDiscoveryPage() {
  const state = useUiStore((store) => store.ocpmDiscovery);
  const setPageState = useUiStore((store) => store.setPageState);
  const ocelsQuery = useAssetList("ocel");
  const ocels = ocelsQuery.data ?? [];

  const saveState = (patch: Partial<typeof state>) => {
    const nextState = { ...state, ...patch };
    setPageState("ocpmDiscovery", patch);
    void persistPageState("ocpmDiscovery", nextState);
  };

  useEffect(() => {
    if (!state.selectedOcelId && ocels.length) {
      saveState({ selectedOcelId: ocels.at(-1)?.id ?? null });
    }
  }, [ocels, state.selectedOcelId]);

  const runVariant = async (variant: OCPMVariant) => {
    if (!state.selectedOcelId) {
      saveState({ error: "Select an OCEL before discovery." });
      return;
    }

    saveState({
      comparisonStarted: true,
      error: null,
      successMessage: null,
      loading: { ...state.loading, [variant]: true },
    });

    try {
      const response = await apiRequest<OCPMDiscoveryResult>(`/api/analysis/ocels/${state.selectedOcelId}/discover/${variant}`, {
        method: "POST",
      });
      saveState({
        loading: { ...state.loading, [variant]: false },
        results: { ...state.results, [variant]: response },
        successMessage: `Completed ${variant.toUpperCase()} discovery`,
      });
    } catch (requestError) {
      saveState({
        loading: { ...state.loading, [variant]: false },
        error: requestError instanceof Error ? requestError.message : "Object-centric discovery failed",
      });
    }
  };

  return (
    <PageShell
      title="OCPM Discovery"
      description="Discover object-centric Petri nets with IM and IMD in the same full-width comparison style as the classic discovery page."
    >
      {ocelsQuery.error ? (
        <div className="error-banner">{ocelsQuery.error instanceof Error ? ocelsQuery.error.message : "Failed to load OCELs"}</div>
      ) : null}

      <section className="panel">
        <div className="toolbar wrap">
          <select
            className="select-input"
            value={state.selectedOcelId ?? ""}
            onChange={(event) => saveState({ selectedOcelId: Number(event.target.value) || null })}
          >
            <option value="">Select an OCEL</option>
            {ocels.map((ocel) => (
              <option key={ocel.id} value={ocel.id}>
                {ocel.filename}
              </option>
            ))}
          </select>
        </div>
      </section>

      {state.error ? <div className="error-banner">{state.error}</div> : null}
      {state.successMessage ? <div className="success-banner">{state.successMessage}</div> : null}

      {state.selectedOcelId ? (
        <div className="analysis-stack">
          {variants.map((variant) => (
            <SvgViewer
              key={variant.key}
              title={variant.label}
              svg={state.results[variant.key]?.svg_content}
              stageClassName="white-stage algorithm-stage"
              fitKey={`${variant.key}-${state.selectedOcelId ?? "none"}`}
              actions={
                <button className="primary-button" onClick={() => void runVariant(variant.key)} disabled={state.loading[variant.key]}>
                  {state.loading[variant.key] ? "Running…" : "Discover"}
                </button>
              }
            >
            </SvgViewer>
          ))}
        </div>
      ) : (
        <section className="panel">
          <div className="empty-panel">Select an OCEL to unlock the discovery algorithms.</div>
        </section>
      )}
    </PageShell>
  );
}
