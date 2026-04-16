"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { PageShell } from "@/components/page-shell";
import { useAssetList } from "@/hooks/use-asset-list";
import { apiRequest, uploadFile } from "@/lib/api";
import type { AssetKind, AssetSummary } from "@/lib/types";

type AssetBucket = Record<AssetKind, AssetSummary[]>;

const initialAssets: AssetBucket = { log: [], model: [], ocel: [] };

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function DataPage() {
  const [loading, setLoading] = useState<Record<AssetKind, boolean>>({
    log: false,
    model: false,
    ocel: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const logInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const ocelInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const logsQuery = useAssetList("log");
  const modelsQuery = useAssetList("model");
  const ocelsQuery = useAssetList("ocel");
  const assetLoadError = logsQuery.error ?? modelsQuery.error ?? ocelsQuery.error;

  const assets = useMemo<AssetBucket>(
    () => ({
      log: logsQuery.data ?? initialAssets.log,
      model: modelsQuery.data ?? initialAssets.model,
      ocel: ocelsQuery.data ?? initialAssets.ocel,
    }),
    [logsQuery.data, modelsQuery.data, ocelsQuery.data],
  );

  const handleUpload = async (kind: AssetKind, file: File | null) => {
    if (!file) {
      return;
    }

    setLoading((current) => ({ ...current, [kind]: true }));
    setError(null);
    setSuccessMessage(null);
    try {
      await uploadFile(`/api/assets/${kind}s`, file);
      setSuccessMessage(`Uploaded ${file.name}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets", kind] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] }),
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Upload failed");
    } finally {
      setLoading((current) => ({ ...current, [kind]: false }));
    }
  };

  const handleDelete = async (kind: AssetKind, asset: AssetSummary) => {
    const confirmed = window.confirm(`Delete ${asset.filename}?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    try {
      await apiRequest(`/api/assets/${kind}/${asset.id}`, { method: "DELETE" });
      setSuccessMessage(`Deleted ${asset.filename}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assets", kind] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] }),
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Delete failed");
    }
  };

  return (
    <PageShell title="Data" description="Upload and manage logs, models, and OCEL files.">
      <div className="data-page">
        {assetLoadError ? (
          <div className="error-banner">{assetLoadError instanceof Error ? assetLoadError.message : "Failed to load assets"}</div>
        ) : null}

        {error ? <div className="error-banner">{error}</div> : null}
        {successMessage ? <div className="success-banner">{successMessage}</div> : null}

        <input
          ref={logInputRef}
          type="file"
          accept=".xes,.csv"
          hidden
          onChange={(event) => void handleUpload("log", event.target.files?.[0] ?? null)}
        />
        <input
          ref={modelInputRef}
          type="file"
          accept=".pnml,.bpmn"
          hidden
          onChange={(event) => void handleUpload("model", event.target.files?.[0] ?? null)}
        />
        <input
          ref={ocelInputRef}
          type="file"
          accept=".jsonocel,.xmlocel,.json,.xml,.csv"
          hidden
          onChange={(event) => void handleUpload("ocel", event.target.files?.[0] ?? null)}
        />

        <section className="data-upload-strip">
          <div className="data-upload-copy">
            <h3>Add Files</h3>
            <p>Keep the workspace lean: upload only the logs and models you want to work with.</p>
          </div>
          <div className="data-upload-actions">
            <button className="data-upload-button" type="button" disabled={loading.log} onClick={() => logInputRef.current?.click()}>
              {loading.log ? "Uploading log..." : "Upload event log"}
            </button>
            <button
              className="data-upload-button"
              type="button"
              disabled={loading.model}
              onClick={() => modelInputRef.current?.click()}
            >
              {loading.model ? "Uploading model..." : "Upload process model"}
            </button>
            <button
              className="data-upload-button"
              type="button"
              disabled={loading.ocel}
              onClick={() => ocelInputRef.current?.click()}
            >
              {loading.ocel ? "Uploading OCEL..." : "Upload OCEL"}
            </button>
          </div>
        </section>

        <AssetGroup
          title="Event Logs"
          helper="XES and CSV logs for exploration, discovery, conformance, and AutoPM."
          emptyMessage="No event logs yet."
          assets={assets.log}
          onDelete={(asset) => void handleDelete("log", asset)}
          renderStats={(asset) => (
            <>
              <span>{asset.num_events ?? 0} events</span>
              <span>{asset.num_cases ?? 0} cases</span>
              <span>{asset.num_activities ?? 0} activities</span>
            </>
          )}
        />

        <AssetGroup
          title="Process Models"
          helper="PNML and BPMN models for conformance and comparison."
          emptyMessage="No process models yet."
          assets={assets.model}
          onDelete={(asset) => void handleDelete("model", asset)}
          renderStats={(asset) => (
            <>
              <span>{asset.model_type ?? "Model"}</span>
              <span>{asset.num_places ?? 0} places</span>
              <span>{asset.num_transitions ?? 0} transitions</span>
            </>
          )}
        />

        <AssetGroup
          title="OCELs"
          helper="JSONOCEL, XMLOCEL, and CSV-based object-centric event logs."
          emptyMessage="No OCEL files yet."
          assets={assets.ocel}
          onDelete={(asset) => void handleDelete("ocel", asset)}
          renderStats={(asset) => (
            <>
              <span>{asset.num_events ?? 0} events</span>
              <span>{asset.num_objects ?? 0} objects</span>
              <span>{asset.object_types?.join(", ") || "No object types"}</span>
            </>
          )}
        />
      </div>
    </PageShell>
  );
}

function AssetGroup({
  title,
  helper,
  emptyMessage,
  assets,
  onDelete,
  renderStats,
}: {
  title: string;
  helper: string;
  emptyMessage: string;
  assets: AssetSummary[];
  onDelete: (asset: AssetSummary) => void;
  renderStats: (asset: AssetSummary) => ReactNode;
}) {
  return (
    <section className="data-group">
      <header className="data-group-header">
        <div>
          <h3>{title}</h3>
          <p>{helper}</p>
        </div>
        <span className="data-group-count">{assets.length}</span>
      </header>

      {assets.length === 0 ? (
        <p className="data-empty">{emptyMessage}</p>
      ) : (
        <ul className="data-group-list">
          {assets.map((asset) => (
            <li key={asset.id} className="data-row">
              <div className="data-row-copy">
                <strong>{asset.filename}</strong>
                <div className="data-row-meta">
                  <span>{formatDate(asset.created_at)}</span>
                  {renderStats(asset)}
                </div>
              </div>
              <button className="data-delete-button" type="button" onClick={() => onDelete(asset)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
