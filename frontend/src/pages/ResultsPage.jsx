import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Mountain, Shield, Download, Layers, Info, RefreshCw, ExternalLink, Activity } from 'lucide-react';
import { api } from '../services/api';

const BASE = 'http://localhost:8000';
const LAYERS = ['dsm', 'hillshade', 'slope', 'aspect'];

export default function ResultsPage({ jobId }) {
    const [result, setResult] = useState(null);
    const [validate, setValidate] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const [selectedLayer, setSelectedLayer] = useState('dsm');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!jobId) { setLoading(false); return; }
        setLoading(true);
        api.getJobStatus(jobId)
            .then(s => { if (s.result) setResult(s.result); })
            .catch(() => { })
            .finally(() => setLoading(false));
        api.validate(jobId).then(setValidate).catch(() => { });
    }, [jobId]);

    // ── No job ────────────────────────────────────────────────────────────────
    if (!jobId) return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
            <Mountain size={56} opacity={0.15} />
            <h3 style={{ color: 'var(--text-bright)' }}>No Analysis Loaded</h3>
            <p className="text-muted text-sm">Upload a satellite image to generate an elevation map.</p>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>+ Start New Analysis</button>
        </div>
    );

    // ── Metric chip ───────────────────────────────────────────────────────────
    const Chip = ({ label, value, unit = '', color = 'var(--primary)' }) => (
        <div className="metric-card" style={{ textAlign: 'center' }}>
            <div className="metric-value" style={{ color }}>{value ?? '—'}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>{unit}</span></div>
            <div className="metric-label">{label}</div>
        </div>
    );

    const layerImgUrl = jobId ? `${BASE}/jobs/${jobId}/layers/${selectedLayer}` : null;
    const textureUrl = result?.texture_url ? `${BASE}${result.texture_url}` : null;
    const heightPngUrl = result?.height_map_url ? `${BASE}${result.height_map_url}` : null;

    return (
        <div className="animate-in">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Analysis Results</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span className="badge badge-success">✓ Completed</span>
                        <span className="text-xs text-muted">Job #{jobId}</span>
                        {result?.mode && <span className="badge" style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8' }}>{result.mode} mode</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); api.getJobStatus(jobId).then(s => { if (s.result) setResult(s.result); }).finally(() => setLoading(false)); api.validate(jobId).then(setValidate).catch(() => { }); }}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/terrain')}><Mountain size={13} /> 3D View</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/validation')}><Shield size={13} /> Validate</button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/export')}><Download size={13} /> Export</button>
                </div>
            </div>

            {/* ── Top: side-by-side image panels ─────────────────────────────── */}
            <div className="panel-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Original Image */}
                <div className="card" style={{ padding: 14 }}>
                    <div className="card-title mb-2" style={{ fontSize: 11 }}>📷 Original Image</div>
                    {textureUrl ? (
                        <img src={textureUrl} alt="Original"
                            style={{ width: '100%', borderRadius: 8, aspectRatio: '1/1', objectFit: 'cover', border: '1px solid var(--border)' }} />
                    ) : (
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="text-muted" style={{ fontSize: 11 }}>{loading ? 'Loading…' : 'Not available'}</span>
                        </div>
                    )}
                </div>

                {/* Height Preview */}
                <div className="card" style={{ padding: 14 }}>
                    <div className="card-title mb-2" style={{ fontSize: 11 }}>🗺 Height Map (Preview)</div>
                    {heightPngUrl ? (
                        <img src={heightPngUrl} alt="Height Map"
                            style={{ width: '100%', borderRadius: 8, aspectRatio: '1/1', objectFit: 'cover', border: '1px solid var(--border)' }} />
                    ) : (
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="text-muted" style={{ fontSize: 11 }}>{loading ? 'Loading…' : 'Not available'}</span>
                        </div>
                    )}
                    <div className="text-xs text-muted mt-2" style={{ textAlign: 'center' }}>Brighter = Higher elevation</div>
                </div>

                {/* Layer Viewer */}
                <div className="card" style={{ padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div className="card-title" style={{ fontSize: 11 }}>🔬 Layer View</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                            {LAYERS.map(l => (
                                <button key={l} onClick={() => setSelectedLayer(l)}
                                    style={{
                                        fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', cursor: 'pointer',
                                        background: selectedLayer === l ? 'var(--primary)' : 'transparent',
                                        color: selectedLayer === l ? '#fff' : 'var(--text-muted)'
                                    }}>
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    {layerImgUrl && result ? (
                        <img src={layerImgUrl} alt={selectedLayer}
                            style={{ width: '100%', borderRadius: 8, aspectRatio: '1/1', objectFit: 'cover', border: '1px solid var(--border)' }}
                            onError={e => { e.target.style.display = 'none'; }} />
                    ) : (
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="text-muted" style={{ fontSize: 11 }}>{loading ? 'Generating…' : 'Not available'}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Metrics Row ─────────────────────────────────────────────────── */}
            <div className="panel-grid grid-4 mb-4">
                <Chip label="RMSE" value={validate?.rmse?.toFixed(2)} unit="m" color="var(--accent-amber)" />
                <Chip label="MAE" value={validate?.mae?.toFixed(2)} unit="m" color="var(--primary)" />
                <Chip label="Bias" value={validate?.bias?.toFixed(2)} unit="m" color="var(--accent-red)" />
                <Chip label="Correlation" value={validate?.correlation?.toFixed(3)} color="var(--accent-green)" />
            </div>

            {/* ── Info Cards Row ──────────────────────────────────────────────── */}
            <div className="panel-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Key Information */}
                <div className="card card-sm">
                    <div className="card-title mb-3"><Layers size={13} /> Elevation Info</div>
                    {[
                        ['Mode', result?.mode ?? '—'],
                        ['Georeferenced', result?.georeferenced ? '✓ Yes' : '✗ No'],
                        ['Model', 'HeightUNet v1 (ResNet34)'],
                        ['Scale Factor', result?.calibration?.scale?.toFixed(3) ?? 'N/A'],
                        ['Offset', result?.calibration?.offset ? `${result.calibration.offset.toFixed(1)} m` : 'N/A'],
                        ['Inlier %', result?.calibration?.inlier_fraction != null ? `${(result.calibration.inlier_fraction * 100).toFixed(1)}%` : 'N/A'],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                            <span className="text-muted">{k}</span>
                            <span className="font-semibold">{v}</span>
                        </div>
                    ))}
                </div>

                {/* Validate / 3D CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* 3D Terrain teaser */}
                    <div className="card card-sm" style={{ background: 'linear-gradient(135deg,rgba(99,102,241,.1),rgba(16,185,129,.05))', border: '1px solid rgba(99,102,241,.3)', cursor: 'pointer' }}
                        onClick={() => navigate('/terrain')}>
                        <div className="card-title mb-1"><Mountain size={14} /> 3D Terrain Viewer</div>
                        <p className="text-xs text-muted mb-3">Explore the generated elevation as an interactive 3D terrain. Drag to orbit, scroll to zoom.</p>
                        <button className="btn btn-primary btn-sm"><Mountain size={12} /> Open 3D View <ExternalLink size={11} /></button>
                    </div>

                    {/* Validation teaser */}
                    <div className="card card-sm" style={{ background: 'rgba(16,185,129,.04)', border: '1px solid rgba(16,185,129,.2)' }}>
                        <div className="card-title mb-1"><Activity size={14} /> Validation</div>
                        {validate ? (
                            <p className="text-xs" style={{ color: 'var(--accent-green)' }}>✓ Validated against SRTM reference — RMSE {validate.rmse?.toFixed(2)}m</p>
                        ) : (
                            <p className="text-xs text-muted">Validation runs automatically for georeferenced GeoTIFF inputs. Plain PNG/JPG uses relative height only.</p>
                        )}
                        <button className="btn btn-ghost btn-sm mt-2" onClick={() => navigate('/validation')}><Shield size={11} /> Validation Lab</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
