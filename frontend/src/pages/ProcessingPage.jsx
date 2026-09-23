import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Circle, Clock, AlertCircle, Loader, ChevronRight, Terminal } from 'lucide-react';
import { api } from '../services/api';

const STAGES = [
    { key: 'ingesting', label: '1. Ingest & Validate', desc: 'Reading image file and checking format.' },
    { key: 'reading_metadata', label: '2. Inspect Metadata', desc: 'Extracting geospatial information.' },
    { key: 'depth_inference', label: '3. Depth Inference', desc: 'Running depth estimation model.' },
    { key: 'calibrating', label: '4. Scale Calibration', desc: 'Calibrating scale from SRTM/local DEM.' },
    { key: 'generating_dsm', label: '5. DSM Generation', desc: 'Generating Digital Surface Model.' },
    { key: 'preparing_terrain', label: '6. Terrain Preparation', desc: 'Preparing 3D terrain data.' },
    { key: 'done', label: '7. Complete', desc: 'Analysis finished successfully.' },
];

const STAGE_ORDER = STAGES.map(s => s.key);

function stageIndex(status) {
    const idx = STAGE_ORDER.indexOf(status);
    return idx === -1 ? 0 : idx;
}

export default function ProcessingPage({ jobId }) {
    const [status, setStatus] = useState(null);
    const [logs, setLogs] = useState([]);
    const navigate = useNavigate();
    const pollRef = useRef();
    const logRef = useRef();

    const addLog = (msg, type = '') => {
        const t = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(l => [...l.slice(-49), { t, msg, type }]);
    };

    useEffect(() => {
        if (!jobId) { addLog('No active job. Upload an image first.', 'warning'); return; }
        addLog(`Job started: ${jobId}`, 'success');
        addLog('Initializing pipeline...', 'processing');

        const poll = async () => {
            try {
                const s = await api.getJobStatus(jobId);
                setStatus(s);
                if (s.status === 'done') {
                    addLog('✓ Analysis complete!', 'success');
                    clearInterval(pollRef.current);
                } else if (s.status === 'failed') {
                    addLog('✗ Analysis failed.', 'error');
                    clearInterval(pollRef.current);
                } else {
                    addLog(`Stage: ${s.status}...`, 'processing');
                }
            } catch (e) { addLog(`Error polling: ${e.message}`); }
        };

        poll();
        pollRef.current = setInterval(poll, 2000);
        return () => clearInterval(pollRef.current);
    }, [jobId]);

    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [logs]);

    const curIdx = status ? stageIndex(status.status) : 0;
    const progress = status ? (status.progress || (curIdx / STAGES.length) * 100) : 0;
    const isDone = status?.status === 'done';
    const isFailed = status?.status === 'failed';

    return (
        <div className="animate-in">
            <div className="card-header mb-4">
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Processing Center</h2>
                    <p className="text-muted text-sm">Analysis {jobId ? `#${jobId}` : 'pending...'}</p>
                </div>
                {isDone && (
                    <button className="btn btn-primary" onClick={() => navigate('/results')}>
                        View Results <ChevronRight size={14} />
                    </button>
                )}
            </div>

            <div className="panel-grid grid-2" style={{ alignItems: 'start', marginBottom: 16 }}>
                {/* Left: stages */}
                <div className="card">
                    <div className="card-title mb-4">Analysis Pipeline</div>

                    {/* Big progress circle */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                        <div style={{ position: 'relative', width: 100, height: 100 }}>
                            <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="8" />
                                <circle cx="50" cy="50" r="40" fill="none" stroke={isFailed ? 'var(--accent-red)' : isDone ? 'var(--accent-green)' : 'var(--primary)'}
                                    strokeWidth="8" strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 40}`}
                                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                                    style={{ transition: 'stroke-dashoffset .4s ease' }} />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 700, color: isFailed ? 'var(--accent-red)' : 'var(--text-bright)' }}>{Math.round(progress)}%</div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{isDone ? 'DONE' : isFailed ? 'FAILED' : 'RUNNING'}</div>
                            </div>
                        </div>
                    </div>

                    {/* Stages list */}
                    {STAGES.map((stage, i) => {
                        const done = i < curIdx || isDone;
                        const active = i === curIdx && !isDone && !isFailed;
                        return (
                            <div key={stage.key} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                                <div style={{ marginTop: 2, color: done || isDone ? 'var(--accent-green)' : active ? 'var(--primary)' : 'var(--border)' }}>
                                    {done || isDone ? <CheckCircle size={15} /> : active ? <Loader size={15} className="animate-spin" /> : <Circle size={15} />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: active ? 600 : 500, color: done || isDone ? 'var(--accent-green)' : active ? 'var(--text-bright)' : 'var(--text-muted)' }}>
                                        {stage.label}
                                    </div>
                                    {active && <div className="text-xs text-muted mt-2">{stage.desc}</div>}
                                </div>
                                {active && <div style={{ fontSize: 10, color: 'var(--primary)' }}>In progress...</div>}
                                {(done || isDone) && <div className="badge badge-success" style={{ fontSize: 9 }}>✓</div>}
                            </div>
                        );
                    })}

                    {!jobId && (
                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                            <p>Upload an image to begin processing</p>
                            <button className="btn btn-primary mt-3" onClick={() => navigate('/upload')}>Go to Upload</button>
                        </div>
                    )}
                </div>

                {/* Right: log */}
                <div className="card">
                    <div className="card-title mb-3"><Terminal size={14} /> Live Updates</div>
                    <div ref={logRef} style={{ height: 320, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {logs.map((l, i) => (
                            <div key={i} className={`log-item${l.type ? ` log-msg ${l.type}` : ''}`}>
                                <span className="log-time">{l.t}</span>
                                <span style={{ color: l.type === 'success' ? 'var(--accent-green)' : l.type === 'processing' ? 'var(--primary)' : l.type === 'error' ? 'var(--accent-red)' : 'var(--text-primary)' }}>{l.msg}</span>
                            </div>
                        ))}
                    </div>

                    {/* Job details */}
                    {status && (
                        <div className="mt-3 card card-sm">
                            <div className="text-xs font-semibold mb-2">Job Details</div>
                            {[
                                ['Job ID', jobId],
                                ['Status', status.status],
                                ['Progress', `${Math.round(progress)}%`],
                            ].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                    <span className="text-muted">{k}</span>
                                    <span className="font-semibold">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
