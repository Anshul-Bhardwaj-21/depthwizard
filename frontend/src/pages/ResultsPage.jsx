import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Mountain, Shield, Download, ChevronRight, Layers, Info } from 'lucide-react';
import { api } from '../services/api';

const TABS = ['Overview', 'Statistics', 'Logs'];

export default function ResultsPage({ jobId }) {
    const [result, setResult] = useState(null);
    const [validate, setValidate] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const [selectedLayer, setSelectedLayer] = useState('dsm');
    const navigate = useNavigate();

    useEffect(() => {
        if (!jobId) return;
        api.getJobStatus(jobId).then(s => { if (s.result) setResult(s.result); });
        api.validate(jobId).then(setValidate).catch(() => { });
    }, [jobId]);

    if (!jobId) return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12 }}>
            <Mountain size={48} opacity={0.2} />
            <p className="text-muted">No analysis loaded — upload an image first.</p>
            <button className="btn btn-primary" onClick={() => navigate('/upload')}>Start New Analysis</button>
        </div>
    );

    const layers = ['dsm', 'hillshade', 'slope', 'aspect'];

    return (
        <div className="animate-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Analysis Results</h2>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                        <span className="badge badge-success">✓ Completed</span>
                        <span className="text-xs text-muted">Job #{jobId}</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/validation')}><Shield size={13} /> Validate</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/terrain')}><Mountain size={13} /> 3D View</button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/export')}><Download size={13} /> Export</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {TABS.map(t => <div key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>{t}</div>)}
            </div>

            {activeTab === 'Overview' && (
                <div>
                    <div className="panel-grid grid-2 mb-4" style={{ alignItems: 'start' }}>
                        {/* Left: images */}
                        <div className="card">
                            <div className="card-title mb-3"><Layers size={14} /> Elevation Layers</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                {layers.map(l => (
                                    <button key={l} className={`btn btn-sm${selectedLayer === l ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setSelectedLayer(l)}>
                                        {l.charAt(0).toUpperCase() + l.slice(1)}
                                    </button>
                                ))}
                            </div>
                            {result ? (
                                <img src={api.layerUrl(jobId, selectedLayer)} alt={selectedLayer}
                                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', aspectRatio: '1/1', objectFit: 'cover', background: 'var(--bg-base)' }}
                                    onError={e => e.target.style.display = 'none'} />
                            ) : (
                                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <div style={{ fontSize: 11 }}>Processing…</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right: info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Source Image */}
                            <div className="card card-sm">
                                <div className="card-title mb-2">Source Image</div>
                                {result?.texture_url && (
                                    <img src={api.outputUrl(result.texture_url)} alt="texture"
                                        style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', aspectRatio: '1/1', objectFit: 'cover' }} />
                                )}
                            </div>

                            {/* Key info */}
                            <div className="card card-sm">
                                <div className="card-title mb-2">Key Information</div>
                                {[
                                    ['Mode', result?.mode || '—'],
                                    ['Georeferenced', result?.georeferenced ? 'Yes' : 'No'],
                                    ['Model Version', 'HeightUNet v1'],
                                    ['Inlier Fraction', result?.calibration?.inlier_fraction != null ? `${(result.calibration.inlier_fraction * 100).toFixed(1)}%` : 'N/A'],
                                    ['Scale', result?.calibration?.scale?.toFixed(3) ?? 'N/A'],
                                    ['Offset', result?.calibration?.offset?.toFixed(1) ?? 'N/A'],
                                ].map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                                        <span className="text-muted">{k}</span>
                                        <span className="font-semibold">{v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'Statistics' && validate && (
                <div className="panel-grid grid-4">
                    {[
                        { label: 'RMSE', val: validate.rmse?.toFixed(2), unit: 'm' },
                        { label: 'MAE', val: validate.mae?.toFixed(2), unit: 'm' },
                        { label: 'Bias', val: validate.bias?.toFixed(2), unit: 'm' },
                        { label: 'Correlation', val: validate.correlation?.toFixed(4), unit: '' },
                    ].map(({ label, val, unit }) => (
                        <div key={label} className="metric-card">
                            <div className="metric-value">{val ?? '—'}<span style={{ fontSize: 12, fontWeight: 400 }}>{unit}</span></div>
                            <div className="metric-label">{label}</div>
                        </div>
                    ))}
                </div>
            )}
            {activeTab === 'Statistics' && !validate && (
                <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    <Info size={24} opacity={0.4} style={{ margin: '0 auto 8px' }} />
                    <p>Validation metrics available for georeferenced GeoTIFF jobs only.</p>
                </div>
            )}
        </div>
    );
}
