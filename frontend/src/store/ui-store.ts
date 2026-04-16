"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  AutoPMPageState,
  ConformancePageState,
  DiscoveryPageState,
  ExplorationPageState,
  OCPMDiscoveryPageState,
  OCPMExplorationPageState,
  PersistedPageStates,
} from "@/lib/types";

const explorationInitial: ExplorationPageState = {
  selectedLogId: null,
  loading: false,
  error: null,
  successMessage: null,
  result: null,
  selectedActivities: [],
  selectedVariants: [],
  variantMode: "all",
  topVariantPercentage: 80,
  dfgFilterView: "activity",
  dfgType: "regular",
  dfgPerformanceMetric: "mean",
  distributionType: "days_week",
  activeVisualization: "dotted",
  dataView: "events",
  eventPreviewLimit: 5,
  dfgFilterOpen: false,
};

const discoveryInitial: DiscoveryPageState = {
  selectedLogId: null,
  comparisonStarted: false,
  error: null,
  successMessage: null,
  results: {
    alpha: null,
    ilp: null,
    heuristics: null,
    inductive: null,
  },
  loading: {
    alpha: false,
    ilp: false,
    heuristics: false,
    inductive: false,
  },
  parameters: {
    alpha: {},
    ilp: { alpha: 0.5 },
    heuristics: {
      dependency_threshold: 0.9,
      and_threshold: 0.9,
      loop_two_threshold: 0.9,
    },
    inductive: { noise_threshold: 0.2 },
  },
};

const conformanceInitial: ConformancePageState = {
  variant: "log-log",
  selectedLog1: null,
  selectedLog2: null,
  selectedLog: null,
  selectedModel: null,
  selectedModel1: null,
  selectedModel2: null,
  loading: false,
  error: null,
  successMessage: null,
  result: null,
  customTrace: "",
  customAlignment: null,
  computingCustom: false,
  variantDiagnosticsView: "alignments",
  customDiagnosticsView: "alignments",
};

const autopmInitial: AutoPMPageState = {
  selectedLogId: null,
  selectedAlgorithms: ["alpha", "heuristics"],
  searchSpaceTechnique: "grid",
  optimizationRounds: 10,
  crossValidationFolds: 5,
  optimizationMetric: "f1",
  running: false,
  error: null,
  result: null,
};

const ocpmExplorationInitial: OCPMExplorationPageState = {
  selectedOcelId: null,
  loading: false,
  error: null,
  successMessage: null,
  result: null,
  selectedGraph: "ocdfg",
  dfgType: "regular",
  dfgPerformanceMetric: "mean",
  activeVisualization: "dotted",
  selectedVizObjectType: null,
  distributionType: "days_week",
  dataView: "ocel",
  eventPreviewLimit: 5,
  selectedDataObjectType: null,
  selectedAnalysisObjectType: null,
  selectedActivityView: "ocel",
  selectedVariantObjectType: null,
};

const ocpmDiscoveryInitial: OCPMDiscoveryPageState = {
  selectedOcelId: null,
  comparisonStarted: false,
  error: null,
  successMessage: null,
  results: { im: null, imd: null },
  loading: { im: false, imd: false },
};

const defaultPages: PersistedPageStates = {
  exploration: explorationInitial,
  discovery: discoveryInitial,
  conformance: conformanceInitial,
  autopm: autopmInitial,
  ocpmExploration: ocpmExplorationInitial,
  ocpmDiscovery: ocpmDiscoveryInitial,
};

function compactLocalState(state: PersistedPageStates): PersistedPageStates {
  return {
    exploration: { ...state.exploration, result: null },
    discovery: {
      ...state.discovery,
      results: {
        alpha: null,
        ilp: null,
        heuristics: null,
        inductive: null,
      },
    },
    conformance: { ...state.conformance, result: null, customAlignment: null },
    autopm: { ...state.autopm, result: null },
    ocpmExploration: { ...state.ocpmExploration, result: null },
    ocpmDiscovery: {
      ...state.ocpmDiscovery,
      results: { im: null, imd: null },
    },
  };
}

type PageKey = keyof PersistedPageStates;

interface UIStore extends PersistedPageStates {
  setPageState: <K extends PageKey>(key: K, patch: Partial<PersistedPageStates[K]>) => void;
  replacePageState: <K extends PageKey>(key: K, value: PersistedPageStates[K]) => void;
  hydrateRemoteStates: (states: Partial<Record<string, unknown>>) => void;
  resetPage: (key: PageKey) => void;
  resetAll: () => void;
}

export const useUiStore = create<UIStore>()(
  persist(
    (set) => ({
      ...defaultPages,
      setPageState: (key, patch) =>
        set((state) => ({
          ...state,
          [key]: {
            ...(state[key] as object),
            ...(patch as object),
          },
        })),
      replacePageState: (key, value) =>
        set((state) => ({
          ...state,
          [key]: value,
        })),
      hydrateRemoteStates: (states) =>
        set((state) => {
          const next: Partial<Record<PageKey, unknown>> = {};
          for (const [rawKey, rawValue] of Object.entries(states)) {
            const key = rawKey as PageKey;
            if (!(key in defaultPages) || !rawValue || typeof rawValue !== "object") {
              continue;
            }
            next[key] = {
              ...(defaultPages[key] as object),
              ...(rawValue as object),
            };
          }
          return { ...state, ...(next as Partial<UIStore>) };
        }),
      resetPage: (key) =>
        set((state) => ({
          ...state,
          [key]: defaultPages[key],
        })),
      resetAll: () => set({ ...defaultPages }),
    }),
    {
      name: "oasis-ui-state",
      partialize: (state) =>
        compactLocalState({
          exploration: state.exploration,
          discovery: state.discovery,
          conformance: state.conformance,
          autopm: state.autopm,
          ocpmExploration: state.ocpmExploration,
          ocpmDiscovery: state.ocpmDiscovery,
        }),
    },
  ),
);
