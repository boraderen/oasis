"use client";

import { useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest } from "@/lib/api";
import { downloadTextFile } from "@/lib/downloads";
import type { OcelFlattenResult } from "@/lib/types";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function OcelFlattenPage() {
  const ocelsQuery = useAssetList("ocel");
  const ocels = useMemo(() => ocelsQuery.data ?? [], [ocelsQuery.data]);
  const [selectedOcelId, setSelectedOcelId] = useState<number | null>(null);
  const [selectedObjectType, setSelectedObjectType] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<OcelFlattenResult | null>(null);

  useEffect(() => {
    if (!selectedOcelId && ocels.length) {
      setSelectedOcelId(ocels.at(-1)?.id ?? null);
    }
  }, [ocels, selectedOcelId]);

  const selectedOcel = useMemo(
    () => ocels.find((asset) => asset.id === selectedOcelId) ?? null,
    [ocels, selectedOcelId],
  );
  const objectTypes = useMemo(() => selectedOcel?.object_types ?? [], [selectedOcel?.object_types]);

  useEffect(() => {
    if (!objectTypes.length) {
      setSelectedObjectType("");
      return;
    }

    if (!objectTypes.includes(selectedObjectType)) {
      setSelectedObjectType(objectTypes[0]);
    }
  }, [objectTypes, selectedObjectType]);

  const downloadFlattenedLog = async () => {
    if (!selectedOcelId || !selectedObjectType) {
      setError("Select both an OCEL and an object type first.");
      return;
    }

    setRunning(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiRequest<OcelFlattenResult>(`/api/analysis/ocels/${selectedOcelId}/flatten`, {
        method: "POST",
        body: JSON.stringify({ object_type: selectedObjectType }),
      });
      downloadTextFile(response.xes_content, response.filename, "application/xml;charset=utf-8");
      setLastResult(response);
      setSuccessMessage(`Downloaded ${response.filename}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Flattening failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <PageShell title="Flatten OCEL" description="Choose one object type and export it as a case-centric XES log.">
      <div className="flatten-page">
        {ocelsQuery.error ? (
          <div className="error-banner">{ocelsQuery.error instanceof Error ? ocelsQuery.error.message : "Failed to load OCELs"}</div>
        ) : null}
        {error ? <div className="error-banner">{error}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}

        <section className="flatten-strip">
          <div className="flatten-strip-copy">
            <h3>Export flattened log</h3>
            <p>Turn one OCEL object type into a traditional XES log you can use in the case-centric views.</p>
          </div>

          <div className="flatten-strip-controls">
            <select
              className="select-input flatten-select"
              value={selectedOcelId ?? ""}
              onChange={(event) => setSelectedOcelId(Number(event.target.value) || null)}
            >
              <option value="">Select an OCEL</option>
              {ocels.map((ocel) => (
                <option key={ocel.id} value={ocel.id}>
                  {ocel.filename}
                </option>
              ))}
            </select>

            <select
              className="select-input flatten-select"
              value={selectedObjectType}
              onChange={(event) => setSelectedObjectType(event.target.value)}
              disabled={!objectTypes.length}
            >
              <option value="">{objectTypes.length ? "Select an object type" : "No object types available"}</option>
              {objectTypes.map((objectType) => (
                <option key={objectType} value={objectType}>
                  {objectType}
                </option>
              ))}
            </select>

            <button
              className="data-upload-button flatten-download-button"
              type="button"
              onClick={() => void downloadFlattenedLog()}
              disabled={running || !selectedOcelId || !selectedObjectType}
            >
              {running ? "Preparing..." : "Download XES"}
            </button>
          </div>
        </section>

        {lastResult ? (
          <section className="flatten-section">
            <header className="flatten-section-header">
              <div>
                <h3>Last export</h3>
                <p>Quick summary of the most recent flattened download.</p>
              </div>
            </header>

            <div className="flatten-result-grid">
              <div className="flatten-meta-item">
                <span>Filename</span>
                <strong>{lastResult.filename}</strong>
              </div>
              <div className="flatten-meta-item">
                <span>Object type</span>
                <strong>{lastResult.object_type}</strong>
              </div>
              <div className="flatten-meta-item">
                <span>Events</span>
                <strong>{lastResult.num_events}</strong>
              </div>
              <div className="flatten-meta-item">
                <span>Cases</span>
                <strong>{lastResult.num_cases}</strong>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
