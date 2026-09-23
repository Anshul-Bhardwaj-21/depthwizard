import { useState } from 'react';
import { SplitSquareHorizontal, Layers, LineChart, Map } from 'lucide-react';
import { LineChart as LC, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';

const profileDemo = Array.from({ length: 20 }, (_, i) => ({
    d: i * 60, h: 240 + Math.sin(i * 0.5) * 20 + Math.random() * 5
}));

export default function ComparePage({ jobId }) {
    const [opacity, setOpacity] = useState(50);
    const [mode, setMode] = useState('side-by-side');
    const [activeLayer, setActiveLayer] = useState('dsm');

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Compare & Inspect</h2>
                    <p className="text-muted text-xs mt-2">Multi-layer comparison — analyze different scans and inspect values at specific locations.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {['side-by-side', 'overlay'].map(m => (
                        <button key={m} className={`btn btn-sm${mode === m ? ' btn-primary' : ' btn-ghost'}`} onClick={() => setMode(m)}>
                            {m === 'side-by-side' ? 'Side by Side' : 'Overlay'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="panel-grid grid-2" style={{ gap: 12, marginBottom: 16 }}>
                {/* Layer tabs */}
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        {['Source', 'DSM', 'Hillshade', 'Residual'].map(l => (
                            <button key={l} className={`btn btn-sm${activeLayer === l.toLowerCase() || activeLayer === l ? ' btn-primary' : ' btn-ghost'}`}
                                onClick={() => setActiveLayer(l.toLowerCase())}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <div className="panel-grid grid-2" style={{ gap: 8 }}>
                        {[
                            { label: 'Source', bg: 'linear-gradient(135deg,#1e3a8a,#3b82f6,#22d3ee)', sublabel: 'Input RGB' },
                            { label: 'Predicted DSM', bg: 'linear-gradient(135deg,#1e3a8a,#10b981,#f59e0b,#ef4444)', sublabel: 'Depth Output' },
                            { label: 'Reference DEM', bg: 'linear-gradient(135deg,#14532d,#10b981,#6ee7b7)', sublabel: 'SRTM Baseline' },
                            { label: 'Residual', bg: 'linear-gradient(135deg,#3b82f6,#f8fafc,#ef4444)', sublabel: 'Error Map' },
                        ].map(({ label, bg, sublabel }) => (
                            <div key={label}>
                                <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 8, background: bg, border: '1px solid var(--border)', marginBottom: 4 }} />
                                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{label}</div>
                                <div className="text-xs text-muted text-center">{sublabel}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Inspector panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-3"><Map size={12} style={{ display: 'inline', marginRight: 4 }} />Inspector</div>
                        {[
                            ['Coordinates', '30.747°N, 76.771°E'],
                            ['Pixel', '(128, 128)'],
                            ['Predicted Elev.', '252.4 m'],
                            ['Reference Elev.', '248.7 m'],
                            ['Residual', '+3.7 m'],
                            ['Slope', '12.4°'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                                <span className="text-muted">{k}</span>
                                <span className="font-semibold">{v}</span>
                            </div>
                        ))}
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Layer Opacity</div>
                        <input type="range" min={0} max={100} value={opacity} onChange={e => setOpacity(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                        <div className="text-xs text-muted mt-1">{opacity}%</div>
                    </div>
                </div>
            </div>

            {/* Cross Section Profile */}
            <div className="card">
                <div className="card-title mb-3"><LineChart size={14} /> Cross Section / Profile</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button className="btn btn-ghost btn-sm">Line Tool</button>
                    <button className="btn btn-ghost btn-sm">Clear</button>
                    <span className="text-xs text-muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Click map to draw profile line</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                    <LC data={profileDemo}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="d" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} unit="m" />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} unit="m" domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }} />
                        <Line type="monotone" dataKey="h" stroke="var(--primary)" dot={false} strokeWidth={2} name="Elevation" />
                    </LC>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 24, marginTop: 8, fontSize: 11 }}>
                    <div><span className="text-muted">Total Distance: </span><span className="font-semibold">1.2 km</span></div>
                    <div><span className="text-muted">Min Elev: </span><span className="font-semibold">237 m</span></div>
                    <div><span className="text-muted">Max Elev: </span><span className="font-semibold">272 m</span></div>
                    <div><span className="text-muted">Relief: </span><span className="font-semibold">35 m</span></div>
                </div>
            </div>
        </div>
    );
}
