import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Mountain, BarChart2, Clock, CheckCircle, AlertCircle, Loader, ChevronRight, Upload, TrendingUp, Globe } from 'lucide-react';
import { api } from '../services/api';

const statuses = {
    done: <span className="badge badge-success"><span className="dot" />Completed</span>,
    failed: <span className="badge badge-error"><span className="dot" />Failed</span>,
    ingesting: <span className="badge badge-info animate-pulse"><span className="dot" />Processing</span>,
    calibrating: <span className="badge badge-info animate-pulse"><span className="dot" />Calibrating</span>,
    queued: <span className="badge badge-warning"><span className="dot" />Queued</span>,
};

const sampleImages = [
    { label: 'Satellite (JPG)', color: '#1e3a8a', gradient: 'linear-gradient(135deg,#1e3a8a,#3b82f6,#22d3ee)' },
    { label: 'Aerial (PNG)', color: '#14532d', gradient: 'linear-gradient(135deg,#14532d,#10b981,#6ee7b7)' },
    { label: 'Terrain (TIFF)', color: '#78350f', gradient: 'linear-gradient(135deg,#78350f,#f59e0b,#fcd34d)' },
    { label: 'GeoTIFF', color: '#1e1b4b', gradient: 'linear-gradient(135deg,#1e1b4b,#7c3aed,#a78bfa)' },
];

export default function HomePage({ onJobSelect }) {
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        api.getAnalyses()
            .then(setAnalyses)
            .catch(() => setAnalyses([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="animate-in">
            {/* Hero */}
            <div className="card mb-4" style={{ backgroundImage: 'linear-gradient(135deg, #0a1628 60%, #0f2040)', border: '1px solid var(--border-bright)', padding: '32px 28px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'url(https://images.unsplash.com/photo-1547234935-80c7145ec969?w=600) center/cover', opacity: 0.25, borderRadius: '0 12px 12px 0' }} />
                <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, letterSpacing: '.08em', marginBottom: 8 }}>WELCOME TO DEPTHWIZARD</div>
                    <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-bright)', margin: '0 0 10px' }}>Turn Satellite Images<br />into Elevation Insights</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, maxWidth: 400, marginBottom: 20 }}>
                        DepthWizard uses advanced deep learning to estimate elevation from optical imagery and generate interactive 3D terrain visualizations.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary btn-lg" onClick={() => navigate('/upload')}><Plus size={16} /> Start New Analysis</button>
                        <button className="btn btn-ghost btn-lg" onClick={() => navigate('/terrain')}>Explore Area</button>
                    </div>
                </div>
            </div>

            <div className="panel-grid grid-3 mb-4">
                {[
                    { label: 'Total Analyses', val: analyses.length, icon: BarChart2, color: 'var(--primary)' },
                    { label: 'Completed', val: analyses.filter(a => a.status === 'done').length, icon: CheckCircle, color: 'var(--accent-green)' },
                    { label: 'Processing', val: analyses.filter(a => !['done', 'failed'].includes(a.status)).length, icon: Loader, color: 'var(--accent-amber)' },
                ].map(({ label, val, icon: Icon, color }) => (
                    <div key={label} className="metric-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(${color.includes('primary') ? '59,130,246' : color.includes('green') ? '16,185,129' : '245,158,11'},.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                            <Icon size={18} />
                        </div>
                        <div>
                            <div className="metric-value" style={{ fontSize: 20 }}>{val}</div>
                            <div className="metric-label">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="panel-grid grid-2">
                {/* Recent analyses */}
                <div className="card">
                    <div className="card-header">
                        <span className="card-title"><Clock size={15} /> Recent Analyses</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}>View all <ChevronRight size={12} /></button>
                    </div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}><Loader size={20} className="animate-spin" /></div>
                    ) : analyses.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            <Mountain size={32} opacity={0.3} style={{ margin: '0 auto 8px' }} />
                            <p>No analyses yet. Start your first one!</p>
                            <button className="btn btn-primary mt-3" onClick={() => navigate('/upload')}><Plus size={14} /> New Analysis</button>
                        </div>
                    ) : (
                        <table className="table">
                            <thead><tr><th>Name</th><th>Input</th><th>Status</th><th>Date</th><th /></tr></thead>
                            <tbody>
                                {analyses.slice(0, 5).map(a => (
                                    <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => { onJobSelect?.(a.id); navigate('/results'); }}>
                                        <td className="text-sm font-semibold truncate" style={{ maxWidth: 120 }}>{a.name || a.id}</td>
                                        <td><span className="badge badge-info" style={{ fontSize: 9 }}>{a.input_type}</span></td>
                                        <td>{statuses[a.status] || <span className="badge badge-warning">{a.status}</span>}</td>
                                        <td className="text-muted text-xs">{a.created_at?.slice(0, 10)}</td>
                                        <td><ChevronRight size={12} style={{ color: 'var(--text-muted)' }} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Quick start */}
                <div className="card">
                    <div className="card-header"><span className="card-title"><TrendingUp size={15} /> Quick Start</span></div>
                    <div className="panel-grid grid-3" style={{ gap: 10, marginBottom: 16 }}>
                        {[
                            { label: 'Upload Image', desc: 'PNG, JPG, GeoTIFF', icon: Upload, to: '/upload' },
                            { label: 'View Pipeline', desc: 'Analyze & process', icon: BarChart2, to: '/processing' },
                            { label: 'Learn More', desc: 'Docs & guides', icon: Globe, to: '#' },
                        ].map(({ label, desc, icon: Icon, to }) => (
                            <div key={label} className="card card-sm" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => navigate(to)}>
                                <div style={{ color: 'var(--primary)', marginBottom: 6 }}><Icon size={20} /></div>
                                <div style={{ fontSize: 11, fontWeight: 600 }}>{label}</div>
                                <div className="text-xs text-muted mt-2">{desc}</div>
                            </div>
                        ))}
                    </div>
                    <div className="card-header mb-2"><span className="card-title">Sample Imagery</span></div>
                    <div className="panel-grid grid-4" style={{ gap: 8 }}>
                        {sampleImages.map(({ label, gradient }) => (
                            <div key={label} style={{ cursor: 'pointer' }} onClick={() => navigate('/upload')}>
                                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 6, background: gradient, border: '1px solid var(--border)', marginBottom: 4 }} />
                                <div className="text-xs text-muted">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
