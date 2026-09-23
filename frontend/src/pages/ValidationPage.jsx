import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Activity, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { api } from '../services/api';

export default function ValidationPage({ jobId }) {
    const [metrics, setMetrics] = useState(null);
    const [activeTab, setActiveTab] = useState('Overview');
    const navigate = useNavigate();

    useEffect(() => {
        if (!jobId) return;
        api.validate(jobId).then(setMetrics).catch(() => { });
    }, [jobId]);

    const demoData = [
        { x: 0, pred: 240, ref: 238 }, { x: 10, pred: 252, ref: 248 }, { x: 20, pred: 261, ref: 255 },
        { x: 30, pred: 270, ref: 269 }, { x: 40, pred: 258, ref: 260 }, { x: 50, pred: 245, ref: 244 },
        { x: 60, pred: 237, ref: 240 }, { x: 70, pred: 249, ref: 245 }, { x: 80, pred: 263, ref: 261 },
        { x: 90, pred: 272, ref: 268 }, { x: 100, pred: 255, ref: 257 },
    ];

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Validation Lab</h2>
                    <p className="text-muted text-xs mt-2">Compare with reference terrain and evaluate accuracy.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['Overview', 'Metrics', 'Spatial Analysis', 'Report'].map(t => (
                    <button key={t} className={`btn btn-sm${activeTab === t ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setActiveTab(t)}>{t}</button>
                ))}
            </div>

            {/* Metric chips */}
            {metrics ? (
                <div className="panel-grid grid-4 mb-4">
                    {[
                        { label: 'RMSE', val: metrics.rmse?.toFixed(2), unit: 'm', color: 'var(--accent-amber)', icon: AlertTriangle },
                        { label: 'MAE', val: metrics.mae?.toFixed(2), unit: 'm', color: 'var(--primary)', icon: Activity },
                        { label: 'Bias', val: metrics.bias?.toFixed(2), unit: 'm', color: 'var(--accent-purple)', icon: Info },
                        { label: 'Correlation', val: metrics.correlation?.toFixed(4), unit: '', color: 'var(--accent-green)', icon: CheckCircle },
                    ].map(({ label, val, unit, color, icon: Icon }) => (
                        <div key={label} className="metric-card" style={{ borderLeft: `3px solid ${color}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div className="metric-value" style={{ color }}>{val}<span style={{ fontSize: 11, fontWeight: 400 }}>{unit}</span></div>
                                    <div className="metric-label">{label}</div>
                                </div>
                                <Icon size={16} style={{ color, opacity: .6 }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="panel-grid grid-4 mb-4">
                    {['RMSE', 'MAE', 'Bias', 'Correlation'].map(l => (
                        <div key={l} className="metric-card">
                            <div className="metric-value" style={{ color: 'var(--text-muted)' }}>—</div>
                            <div className="metric-label">{l}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="panel-grid grid-2" style={{ alignItems: 'start' }}>
                {/* Images */}
                <div className="card">
                    <div className="card-title mb-3">Error Map</div>
                    {jobId ? (
                        <img src={api.heatmapUrl(jobId)} alt="error heatmap"
                            style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', aspectRatio: '1/1', objectFit: 'cover' }}
                            onError={e => e.target.src = ''} />
                    ) : (
                        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: 'linear-gradient(135deg,#1e3a8a,#7c3aed,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12 }}>
                            Demo Error Heatmap
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ color: '#3b82f6' }}>Under-estimate</span>
                        <span>0m</span>
                        <span style={{ color: '#ef4444' }}>Over-estimate</span>
                    </div>
                </div>

                {/* Charts */}
                <div className="card">
                    <div className="card-title mb-3">Elevation Profile Comparison</div>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={demoData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="x" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }} />
                            <Line type="monotone" dataKey="pred" stroke="var(--primary)" dot={false} name="Predicted" strokeWidth={2} />
                            <Line type="monotone" dataKey="ref" stroke="var(--accent-green)" dot={false} name="Reference" strokeWidth={2} strokeDasharray="4 2" />
                        </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
                        <span style={{ color: 'var(--primary)' }}>— Predicted</span>
                        <span style={{ color: 'var(--accent-green)' }}>-- Reference</span>
                    </div>

                    {!jobId && (
                        <div className="card card-sm mt-3" style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.3)' }}>
                            <p className="text-xs" style={{ color: 'var(--accent-amber)' }}>⚠ Results are based on demo data. Run a real analysis to get actual metrics.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
