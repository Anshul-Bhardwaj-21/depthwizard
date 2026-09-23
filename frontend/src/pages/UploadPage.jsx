import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileImage, CheckCircle, AlertCircle, ChevronRight, Info, Zap, Shield, Globe, File } from 'lucide-react';
import { api } from '../services/api';

const STEPS = ['Upload Image', 'Validate', 'Ready for Processing', 'Results'];
const FORMATS = [
    { ext: 'PNG', desc: 'Image', icon: FileImage, color: '#3b82f6' },
    { ext: 'JPG / JPEG', desc: 'Image', icon: FileImage, color: '#10b981' },
    { ext: 'TIFF', desc: 'Raster Image', icon: File, color: '#f59e0b' },
    { ext: 'GeoTIFF', desc: 'Geospatial Raster', icon: Globe, color: '#8b5cf6' },
];
const NEXT_STEPS = [
    { n: 1, icon: Shield, color: '#3b82f6', title: 'Validate File', desc: 'Check format, size, and basic structure.' },
    { n: 2, icon: Info, color: '#8b5cf6', title: 'Inspect Metadata', desc: 'Read geospatial information if available.' },
    { n: 3, icon: Zap, color: '#f59e0b', title: 'Prepare for Processing', desc: 'Your image is ready for depth estimation.' },
    { n: 4, icon: CheckCircle, color: '#10b981', title: 'Generate Results', desc: 'Create DSM, 3D terrain and analysis outputs.' },
];

export default function UploadPage({ onJobCreated }) {
    const [file, setFile] = useState(null);
    const [srtm, setSrtm] = useState(null);
    const [drag, setDrag] = useState(false);
    const [step, setStep] = useState(0); // 0=upload,1=validate,2=ready,3=done
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef();
    const navigate = useNavigate();

    const handleFile = (f) => {
        setFile(f);
        setError('');
        setStep(1);
        setTimeout(() => setStep(2), 1200);
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    };

    const startAnalysis = async () => {
        if (!file) return;
        setLoading(true); setError('');
        try {
            const res = await api.createJob(file, srtm);
            if (res.job_id) {
                onJobCreated?.(res.job_id);
                navigate('/processing');
            } else setError(res.detail || 'Failed to create job');
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="animate-in">
            {/* Steps */}
            <div className="card mb-4">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Create New Analysis</h2>
                        <p className="text-muted text-sm mt-2">Upload a satellite or aerial image to start your analysis.</p>
                    </div>
                </div>

                {/* Pipeline steps */}
                <div className="pipeline-steps mb-4">
                    {STEPS.map((s, i) => (
                        <div key={s} className="pipeline-step">
                            <div className={`step-circle${i === step ? ' active' : i < step ? ' done' : ''}`}>
                                {i < step ? <CheckCircle size={13} /> : i + 1}
                            </div>
                            <span className={`step-label${i === step ? ' active' : ''}`}>{s}</span>
                            {i < STEPS.length - 1 && <div className={`step-line${i < step ? ' done' : ''}`} />}
                        </div>
                    ))}
                </div>

                <div className="panel-grid grid-2" style={{ gap: 24, alignItems: 'start' }}>
                    {/* Upload zone */}
                    <div>
                        <div
                            className={`upload-zone${drag ? ' drag-over' : ''}`}
                            onDragOver={e => { e.preventDefault(); setDrag(true); }}
                            onDragLeave={() => setDrag(false)}
                            onDrop={handleDrop}
                            onClick={() => inputRef.current?.click()}
                        >
                            <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.tif,.tiff" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                            <div className="upload-icon">
                                <Upload size={22} />
                            </div>
                            {file ? (
                                <>
                                    <h3 style={{ color: 'var(--accent-green)' }}><CheckCircle size={16} style={{ display: 'inline', marginRight: 6 }} />{file.name}</h3>
                                    <p>{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'Unknown type'}</p>
                                </>
                            ) : (
                                <>
                                    <h3>Drag & drop your image here</h3>
                                    <p>or click to browse files</p>
                                    <p style={{ marginTop: 8 }}>Supported: PNG, JPG, JPEG, TIFF, GeoTIFF</p>
                                </>
                            )}
                        </div>

                        {file && (
                            <div className="card card-sm mt-3" style={{ border: '1px solid var(--accent-green)', background: 'rgba(16,185,129,.05)' }}>
                                <div style={{ fontSize: 11, color: 'var(--accent-green)', fontWeight: 600, marginBottom: 8 }}>✓ File Information</div>
                                <div className="panel-grid grid-2" style={{ fontSize: 11, gap: 6 }}>
                                    {[['Type', file.type || 'Unknown'], ['Size', `${(file.size / 1024).toFixed(1)} KB`], ['Name', file.name]].map(([k, v]) => (
                                        <div key={k}><span className="text-muted">{k}: </span><span className="font-semibold">{v}</span></div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Optional SRTM */}
                        <div className="card card-sm mt-3">
                            <div className="text-xs text-muted mb-2">Optional: Local DEM (GeoTIFF) for offline calibration</div>
                            <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                <input type="file" accept=".tif,.tiff" style={{ display: 'none' }} onChange={e => setSrtm(e.target.files[0])} />
                                <Upload size={12} /> {srtm ? srtm.name : 'Choose DEM File'}
                            </label>
                        </div>

                        {error && <div className="card card-sm mt-3" style={{ border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}><AlertCircle size={12} style={{ display: 'inline', marginRight: 6 }} />{error}</div>}

                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button className="btn btn-ghost" onClick={() => { setFile(null); setSrtm(null); setStep(0); }}>Back</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} disabled={!file || loading} onClick={startAnalysis}>
                                {loading ? '⏳ Starting...' : <><Zap size={14} /> Start Analysis</>}
                            </button>
                        </div>
                    </div>

                    {/* Right info panel */}
                    <div className="flex-col gap-3">
                        <div className="card card-sm">
                            <div className="card-title mb-3">What Happens Next?</div>
                            {NEXT_STEPS.map(({ n, icon: Icon, color, title, desc }) => (
                                <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: `rgba(0,0,0,.2)`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                                        <Icon size={13} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{title}</div>
                                        <div className="text-xs text-muted">{desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card card-sm" style={{ border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.05)' }}>
                            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-amber)' }}>💡 Pro Tips</div>
                            {['Use GeoTIFF for best results', 'Higher resolution = more detailed terrain', 'Ensure image covers area of interest'].map(t => (
                                <div key={t} className="text-xs text-muted" style={{ marginBottom: 4 }}>✓ {t}</div>
                            ))}
                        </div>

                        <div className="card card-sm">
                            <div className="text-xs font-semibold mb-3">Supported File Formats</div>
                            <div className="panel-grid grid-2" style={{ gap: 8 }}>
                                {FORMATS.map(({ ext, desc, icon: Icon, color }) => (
                                    <div key={ext} className="card card-sm" style={{ padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Icon size={16} color={color} />
                                        <div><div style={{ fontSize: 11, fontWeight: 600 }}>{ext}</div><div className="text-xs text-muted">{desc}</div></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
