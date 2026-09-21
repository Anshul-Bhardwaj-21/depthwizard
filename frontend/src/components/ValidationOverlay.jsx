import { useEffect, useState } from "react";

export default function ValidationOverlay({ apiBase, result }) {
  const [metrics, setMetrics] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | error | done

  useEffect(() => {
    setMetrics(null);
    setStatus("idle");
    if (!result?.job_id || !result.georeferenced) return;

    setStatus("loading");
    fetch(`${apiBase}/validate/${result.job_id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`validate failed (${res.status})`);
        return res.json();
      })
      .then((data) => {
        setMetrics(data);
        setStatus("done");
      })
      .catch(() => setStatus("error"));
  }, [apiBase, result]);

  return (
    <div>
      <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 12px", color: "var(--text-dim)" }}>
        Validation
      </h2>

      {!result && (
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
          Metrics appear here once you run a GeoTIFF through the pipeline.
        </p>
      )}

      {result && !result.georeferenced && (
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
          This input has no coordinate metadata, so there is no SRTM
          reference to validate against — only the relative height map is
          shown in the viewer.
        </p>
      )}

      {result?.georeferenced && result.calibration && (
        <div style={{ marginBottom: 16 }}>
          <MetricRow label="Scale" value={result.calibration.scale.toFixed(2)} />
          <MetricRow label="Offset" value={`${result.calibration.offset.toFixed(1)} m`} />
          <MetricRow
            label="Inlier fraction"
            value={`${(result.calibration.inlier_fraction * 100).toFixed(0)}%`}
          />
        </div>
      )}

      {status === "loading" && (
        <p style={{ fontSize: 12, color: "var(--text-dim)" }}>Scoring against SRTM...</p>
      )}
      {status === "error" && (
        <p style={{ fontSize: 12, color: "var(--danger)" }}>Could not fetch validation metrics.</p>
      )}
      {status === "done" && metrics && (
        <div>
          <MetricRow label="RMSE" value={`${metrics.rmse.toFixed(2)} m`} accent />
          <MetricRow label="MAE" value={`${metrics.mae.toFixed(2)} m`} accent />
          <MetricRow label="Correlation" value={metrics.correlation.toFixed(3)} accent />
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>
            vs SRTM 30m over {metrics.n_points.toLocaleString()} points
          </p>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</span>
      <span
        className="mono"
        style={{ fontSize: 12, color: accent ? "var(--elev-mid)" : "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}
