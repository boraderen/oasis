"use client";

import { useState } from "react";

import { SvgViewer } from "@/components/svg-viewer";
import { downloadTextFile } from "@/lib/downloads";

type ProcessModelView = "petri" | "bpmn";

export function ProcessModelViewer({
  title,
  petriSvg,
  bpmnSvg,
  pnmlContent,
  pnmlFilename,
  bpmnContent,
  bpmnFilename,
  fitKey,
  stageClassName,
  emptyMessage,
  actions,
  children,
}: {
  title: string;
  petriSvg?: string | null;
  bpmnSvg?: string | null;
  pnmlContent?: string | null;
  pnmlFilename?: string | null;
  bpmnContent?: string | null;
  bpmnFilename?: string | null;
  fitKey?: string | number;
  stageClassName?: string;
  emptyMessage?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [view, setView] = useState<ProcessModelView>("petri");
  const activeView = view === "bpmn" && bpmnSvg ? "bpmn" : "petri";
  const activeSvg = activeView === "bpmn" ? bpmnSvg : petriSvg;

  return (
    <SvgViewer
      title={title}
      svg={activeSvg}
      emptyMessage={emptyMessage}
      stageClassName={stageClassName}
      fitKey={`${String(fitKey ?? title)}-${activeView}`}
      actions={
        <>
          {actions}
          <button
            className={activeView === "petri" ? "toggle-pill active" : "toggle-pill"}
            type="button"
            disabled={!petriSvg}
            onClick={() => setView("petri")}
          >
            Petri net
          </button>
          <button
            className={activeView === "bpmn" ? "toggle-pill active" : "toggle-pill"}
            type="button"
            disabled={!bpmnSvg}
            onClick={() => setView("bpmn")}
          >
            BPMN
          </button>
          {activeView === "petri" && pnmlContent && pnmlFilename ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => downloadTextFile(pnmlContent, pnmlFilename, "application/xml;charset=utf-8")}
            >
              Download PNML
            </button>
          ) : null}
          {activeView === "bpmn" && bpmnContent && bpmnFilename ? (
            <button
              className="secondary-button"
              type="button"
              onClick={() => downloadTextFile(bpmnContent, bpmnFilename, "application/xml;charset=utf-8")}
            >
              Download BPMN
            </button>
          ) : null}
        </>
      }
    >
      {children}
    </SvgViewer>
  );
}
