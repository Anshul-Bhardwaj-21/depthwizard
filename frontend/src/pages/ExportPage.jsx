import { useState } from 'react';
import { Download, FileText, Image, Table, FileJson, CheckSquare } from 'lucide-react';
import { api } from '../services/api';

const FORMATS = [
    { label: 'GeoTIFF', icon: Image, desc: 'Full-resolution height map', badge: 'Primary', color: 'var(--primary)' },
    { label: 'PNG', icon: Image, desc: 'Preview image', badge: 'Image', color: 'var(--accent-cyan)' },
    { label: 'CSV', icon: Table, desc: 'Height data as tabular', badge: 'Data', color: 'var(--accent-green)' },
    { label: 'JSON', icon: FileJson, desc: 'Full analysis dump', badge: 'Data', color: 'var(--accent-amber)' },
    { label: 'Analysis Report', icon: FileText, desc: 'Metrics & provenance PDF', badge: 'Report', color: 'var(--accent-purple)' },
];

const CHECKLIST = [
    ['DSM / Height Map (GeoTIFF)', true],
    ['Hillshade (PNG)', true],
    ['Contours (GeoJSON)', true],
    ['Validation Metrics', true],
    ['Hillshade Report (PDF)', false],
    ['Analysis Report (PDF)', false],
];

export default function ExportPage({ jobId }) {
    const [selected, setSelected] = useState(new Set(['GeoTIFF', 'PNG', 'Analysis Report']));
    const [crs, setCrs] = useState('EPSG:4326 (WGS84)');

    const toggle = (l) => setSelected(s => {
        const n = new Set(s);
        n.has(l) ? n.delete(l) : n.add(l);
        return n;
    });

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Export & Report</h2>
                    <p className="text-muted text-xs mt-2">Download your analysis results in multiple formats.</p>
                </div>
            </div>

            <div className="panel-grid grid-2" style={{ alignItems: 'start', gap: 16 }}>
                {/* Left: available outputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card">
                        <div className="card-title mb-3">Available Outputs</div>
                        {FORMATS.map(({ label, icon: Icon, desc, badge, color }) => (
                            <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: selected.has(label) ? 'var(--primary-glow)' : 'transparent', cursor: 'pointer', border: `1px solid ${selected.has(label) ? 'var(--primary)' : 'transparent'}`, transition: 'all .15s' }}
                                onClick={() => toggle(label)}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `rgba(0,0,0,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}><Icon size={15} /></div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                                    <div className="text-xs text-muted">{desc}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 20, background: `rgba(0,0,0,.3)`, color, fontWeight: 600 }}>{badge}</div>
                                    {jobId && label === 'Analysis Report' && (
                                        <a href={api.reportUrl(jobId)} target="_blank" rel="noreferrer"
                                            className="btn btn-sm btn-ghost mt-2" style={{ fontSize: 9, padding: '2px 8px' }}>
                                            <Download size={10} /> PDF
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Artifact Checklist</div>
                        {CHECKLIST.map(([label, done]) => (
                            <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 11 }}>
                                <CheckSquare size={13} style={{ color: done ? 'var(--accent-green)' : 'var(--border)' }} />
                                <span style={{ color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: export settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card">
                        <div className="card-title mb-3">Export Settings</div>
                        <div className="mb-3">
                            <label>Coordinate Reference System</label>
                            <select value={crs} onChange={e => setCrs(e.target.value)}>
                                <option>EPSG:4326 (WGS84)</option>
                                <option>EPSG:3857 (WebMercator)</option>
                                <option>EPSG:32644 (UTM44N)</option>
                            </select>
                        </div>
                        <div className="mb-3">
                            <label>Elevation Units</label>
                            <select><option>Meters (m)</option><option>Feet (ft)</option></select>
                        </div>
                        <div className="mb-3">
                            <label>Resolution</label>
                            <select><option>256 × 256 (default)</option><option>512 × 512</option><option>Original</option></select>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-title mb-3">Analysis Information</div>
                        {[
                            ['Model Version', 'HeightUNet v1'],
                            ['Accuracy', 'Awaiting processing'],
                            ['Type File', jobId ? 'GeoTIFF' : 'N/A'],
                            ['Processed', jobId ? 'Yes' : 'Pending'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                                <span className="text-muted">{k}</span><span className="font-semibold">{v}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!jobId} onClick={() => { if (jobId) window.open(api.reportUrl(jobId), '_blank'); }}>
                            <Download size={14} /> Download All
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
