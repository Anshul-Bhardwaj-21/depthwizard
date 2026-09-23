import { useState, useCallback } from "react";

export default function UploadPanel({ apiBase, onResult, onError }) {
  const [file, setFile] = useState(null);
  const [srtmFile, setSrtmFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    onError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (srtmFile) form.append("srtm_file", srtmFile);

      const res = await fetch(`${apiBase}/predict`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }
      const data = await res.json();
      onResult(data);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label
        htmlFor="file-input"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          display: "block",
          border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
          background: dragOver ? "var(--panel-raised)" : "transparent",
          borderRadius: "var(--radius)",
          padding: "20px 12px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-dim)",
          cursor: "pointer",
          marginBottom: 10,
          transition: "border-color 120ms ease, background 120ms ease",
        }}
      >
        {file ? file.name : "Drop or choose a PNG, JPG or GeoTIFF"}
      </label>
      <input
        id="file-input"
        type="file"
        accept=".png,.jpg,.jpeg,.tif,.tiff"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />

      <label
        htmlFor="srtm-input"
        style={{
          display: "block",
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 6,
          cursor: "pointer",
        }}
      >
        Optional local DEM (skips the live SRTM fetch):{" "}
        <span style={{ color: srtmFile ? "var(--accent)" : "var(--text-dim)" }}>
          {srtmFile ? srtmFile.name : "none"}
        </span>
      </label>
      <input
        id="srtm-input"
        type="file"
        accept=".tif,.tiff"
        onChange={(e) => setSrtmFile(e.target.files?.[0] ?? null)}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={() => document.getElementById("srtm-input").click()}
        style={{ width: "100%", background: "var(--panel-raised)", color: "var(--text)", marginBottom: 12 }}
      >
        {srtmFile ? "Change local DEM" : "Attach local DEM (optional)"}
      </button>

      <button type="submit" disabled={!file || loading} style={{ width: "100%" }}>
        {loading ? "Estimating height..." : "Run DepthWizard"}
      </button>

      <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 16 }}>
        GeoTIFF inputs are calibrated to metric elevation against SRTM (or
        your attached local DEM). Plain PNG/JPG produce a relative height
        map only.
      </p>
    </form>
  );
}
