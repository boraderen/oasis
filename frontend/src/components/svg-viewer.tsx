"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function parseSvgDimensions(svg?: string | null) {
  if (!svg) {
    return null;
  }

  const viewBoxMatch = svg.match(/viewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    const width = Number(viewBoxMatch[1]);
    const height = Number(viewBoxMatch[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  const widthMatch = svg.match(/\bwidth=["']([-\d.]+)(?:px)?["']/i);
  const heightMatch = svg.match(/\bheight=["']([-\d.]+)(?:px)?["']/i);
  const width = widthMatch ? Number(widthMatch[1]) : null;
  const height = heightMatch ? Number(heightMatch[1]) : null;
  if (width && height && Number.isFinite(width) && Number.isFinite(height)) {
    return { width, height };
  }

  return null;
}

export function SvgViewer({
  title,
  svg,
  emptyMessage = "Run an analysis to render this view.",
  actions,
  children,
  stageClassName,
  sidebar,
  bodyClassName,
  sidebarClassName,
  fitKey,
  overlay,
  enableFitControl = true,
  sidebarPosition = "left",
}: {
  title: string;
  svg?: string | null;
  emptyMessage?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  stageClassName?: string;
  sidebar?: React.ReactNode;
  bodyClassName?: string;
  sidebarClassName?: string;
  fitKey?: string | number;
  overlay?: React.ReactNode;
  enableFitControl?: boolean;
  sidebarPosition?: "left" | "right";
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgSize = useMemo(() => parseSvgDimensions(svg), [svg]);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fitToStage = useCallback(() => {
    if (!svg || !stageRef.current) {
      return;
    }

    const bounds = stageRef.current.getBoundingClientRect();
    const padding = 40;
    const viewportWidth = Math.max(bounds.width - padding * 2, 1);
    const viewportHeight = Math.max(bounds.height - padding * 2, 1);
    const contentWidth = svgSize?.width ?? viewportWidth;
    const contentHeight = svgSize?.height ?? viewportHeight;
    const fittedZoom = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight, 2.5);
    const nextZoom = Number.isFinite(fittedZoom) && fittedZoom > 0 ? fittedZoom : 1;

    setZoom(nextZoom);
    setOffset({
      x: (bounds.width - contentWidth * nextZoom) / 2,
      y: (bounds.height - contentHeight * nextZoom) / 2,
    });
  }, [svg, svgSize?.height, svgSize?.width]);

  useEffect(() => {
    if (!svg) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      fitToStage();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [fitKey, fitToStage, svg]);

  useEffect(() => {
    if (!svg || !stageRef.current) {
      return;
    }

    const stage = stageRef.current;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const bounds = stage.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const contentX = (pointerX - offset.x) / zoom;
      const contentY = (pointerY - offset.y) / zoom;
      const scaleFactor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = Math.min(5, Math.max(0.12, zoom * scaleFactor));

      setZoom(nextZoom);
      setOffset({
        x: pointerX - contentX * nextZoom,
        y: pointerY - contentY * nextZoom,
      });
    };

    stage.addEventListener("wheel", handleWheel, { passive: false });
    return () => stage.removeEventListener("wheel", handleWheel);
  }, [offset.x, offset.y, svg, zoom]);

  const stage = !svg ? (
    <div className="empty-panel viewer-empty">{emptyMessage}</div>
  ) : (
    <div
      ref={stageRef}
      className={stageClassName ? `svg-stage ${stageClassName}` : "svg-stage"}
      onMouseDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        setDragging(true);
        setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
      }}
      onMouseMove={(event) => {
        if (!dragging) {
          return;
        }
        setOffset({
          x: event.clientX - dragStart.x,
          y: event.clientY - dragStart.y,
        });
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
    >
      <div
        className="svg-stage-content"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );

  const stageWithOverlay = (
    <div className="svg-stage-wrap">
      {stage}
      {overlay ? <div className="svg-overlay-layer">{overlay}</div> : null}
    </div>
  );

  return (
    <section className="panel viewer-panel">
      <div className="panel-header viewer-header">
        <h3>{title}</h3>
        <div className="panel-actions viewer-toolbar">
          {actions}
          <div className="viewer-zoom-controls">
            <button className="ghost-button" type="button" onClick={() => setZoom((value) => Math.max(0.12, value / 1.12))}>
              -
            </button>
            <span className="viewer-zoom-label">{Math.round(zoom * 100)}%</span>
            <button className="ghost-button" type="button" onClick={() => setZoom((value) => Math.min(5, value * 1.12))}>
              +
            </button>
            {enableFitControl ? (
              <button className="ghost-button" type="button" onClick={fitToStage}>
                Fit
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {children}

      {sidebar ? (
        <div
          className={
            bodyClassName
              ? `svg-viewer-body sidebar-${sidebarPosition} ${bodyClassName}`
              : `svg-viewer-body sidebar-${sidebarPosition}`
          }
        >
          {sidebarPosition === "left" ? (
            <>
              <aside className={sidebarClassName ? `svg-viewer-sidebar ${sidebarClassName}` : "svg-viewer-sidebar"}>
                {sidebar}
              </aside>
              {stageWithOverlay}
            </>
          ) : (
            <>
              {stageWithOverlay}
              <aside className={sidebarClassName ? `svg-viewer-sidebar ${sidebarClassName}` : "svg-viewer-sidebar"}>
                {sidebar}
              </aside>
            </>
          )}
        </div>
      ) : (
        stageWithOverlay
      )}
    </section>
  );
}
