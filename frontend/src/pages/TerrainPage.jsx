import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, RotateCcw, Play, Pause, ZoomIn, ZoomOut, Layers, AlertCircle } from 'lucide-react';

const BASE = 'http://localhost:8000';

// ── Real-data 3D canvas renderer ─────────────────────────────────────────────
function TerrainCanvas({ terrain, vertScale, autoRotate, showGrid, colorMode }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const rotRef = useRef(Math.PI / 6);

    const draw = useCallback((ctx, W, H, angle, tData, vScale, grid, showG, mode) => {
        if (!tData || tData.length === 0) return;
        const ROWS = tData.length, COLS = tData[0].length;
        let minH = Infinity, maxH = -Infinity;
        for (const row of tData) for (const v of row) { minH = Math.min(minH, v); maxH = Math.max(maxH, v); }
        const range = maxH - minH || 1;

        ctx.clearRect(0, 0, W, H);
        // Dark sky
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#020a14');
        sky.addColorStop(1, '#060e22');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let i = 0; i < 100; i++) {
            ctx.fillRect((Math.sin(i * 137.5) * 0.5 + 0.5) * W, (Math.cos(i * 97.3) * 0.5 + 0.5) * H * 0.45, 1, 1);
        }

        const cos = Math.cos(angle), sin = Math.sin(angle);
        const iso = (x, y, z) => {
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
            return {
                px: W / 2 + rx * (W / COLS) * 0.44,
                py: H * 0.68 - ry * (H / ROWS) * 0.20 - z * (H / range) * 1.8 * vScale,
            };
        };

        const getColor = (h, t) => {
            if (mode === 'thermal') {
                const r = Math.round(255 * Math.min(1, t * 2));
                const g = Math.round(255 * Math.min(1, (1 - Math.abs(t - 0.5)) * 2));
                const b = Math.round(255 * Math.max(0, 1 - t * 2));
                return `rgb(${r},${g},${b})`;
            }
            if (mode === 'grey') return `hsl(0,0%,${20 + t * 75}%)`;
            // Default terrain color
            if (t < 0.10) return `hsl(220,70%,${22 + t * 80}%)`;
            if (t < 0.28) return `hsl(195,60%,${38 + t * 40}%)`;
            if (t < 0.48) return `hsl(140,55%,${30 + t * 30}%)`;
            if (t < 0.68) return `hsl(35,70%,${38 + t * 15}%)`;
            if (t < 0.85) return `hsl(18,55%,${32 + t * 12}%)`;
            return `hsl(0,0%,${75 + t * 20}%)`;
        };

        // Draw back-to-front (painter's algorithm)
        for (let r = ROWS - 2; r >= 0; r--) {
            for (let c = 0; c < COLS - 1; c++) {
                const h00 = tData[r][c], h01 = tData[r][c + 1];
                const h10 = tData[r + 1][c], h11 = tData[r + 1][c + 1];
                const avgH = (h00 + h01 + h10 + h11) / 4;
                const t = (avgH - minH) / range;

                const xC = c - COLS / 2, yC = r - ROWS / 2;
                const p00 = iso(xC, yC, h00 - minH);
                const p01 = iso(xC + 1, yC, h01 - minH);
                const p11 = iso(xC + 1, yC + 1, h11 - minH);
                const p10 = iso(xC, yC + 1, h10 - minH);

                ctx.beginPath();
                ctx.moveTo(p00.px, p00.py);
                ctx.lineTo(p01.px, p01.py);
                ctx.lineTo(p11.px, p11.py);
                ctx.lineTo(p10.px, p10.py);
                ctx.closePath();
                ctx.fillStyle = getColor(avgH, t);
                ctx.fill();

                if (showG) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                    ctx.lineWidth = 0.3;
                    ctx.stroke();
                }
            }
        }

        // Colorbar
        const cH = 140, cX = W - 36, cY = (H - cH) / 2;
        const grad = ctx.createLinearGradient(0, cY, 0, cY + cH);
        grad.addColorStop(0, getColor(maxH, 1));
        grad.addColorStop(0.5, getColor((maxH + minH) / 2, 0.5));
        grad.addColorStop(1, getColor(minH, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(cX, cY, 12, cH);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cX, cY, 12, cH);
        ctx.fillStyle = 'rgba(180,200,255,0.8)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(maxH.toFixed(1) + 'm', cX - 2, cY + 9);
        ctx.fillText(minH.toFixed(1) + 'm', cX - 2, cY + cH - 1);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let raf;

        const resize = () => {
            canvas.width = canvas.offsetWidth || 800;
            canvas.height = canvas.offsetHeight || 500;
        };
        resize();

        const animate = () => {
            if (autoRotate) rotRef.current += 0.007;
            draw(ctx, canvas.width, canvas.height, rotRef.current, terrain, vertScale, 64, showGrid, colorMode);
            raf = requestAnimationFrame(animate);
        };
        animRef.current = raf;
        animate();

        let dragging = false, lastX = 0;
        const onDown = e => { dragging = true; lastX = e.clientX; canvas.style.cursor = 'grabbing'; };
        const onMove = e => { if (!dragging) return; rotRef.current += (e.clientX - lastX) * 0.012; lastX = e.clientX; };
        const onUp = () => { dragging = false; canvas.style.cursor = 'grab'; };
        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            cancelAnimationFrame(raf);
            canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [terrain, vertScale, autoRotate, showGrid, colorMode, draw]);

    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', borderRadius: 12 }} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TerrainPage({ jobId }) {
    const [autoRotate, setAutoRotate] = useState(false);
    const [vertScale, setVertScale] = useState(1);
    const [showGrid, setShowGrid] = useState(true);
    const [colorMode, setColorMode] = useState('terrain');
    const [terrain, setTerrain] = useState(null);
    const [heightMeta, setHeightMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!jobId) return;
        setLoading(true);
        setError('');
        fetch(`${BASE}/jobs/${jobId}/heightmap?grid=64`)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                setTerrain(data.grid);
                setHeightMeta({ min: data.min, max: data.max, mean: data.mean });
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [jobId]);

    // Fallback synthetic terrain when no job
    const synth = (() => {
        const GRID = 64;
        return Array.from({ length: GRID }, (_, r) =>
            Array.from({ length: GRID }, (_, c) => {
                const x = c / GRID * 8, y = r / GRID * 8;
                return Math.sin(x) * Math.cos(y) * 3 + Math.sin(x * 2.5) * 1.5 + Math.cos(y * 1.8) * 2;
            })
        );
    })();

    const terrainData = terrain ?? synth;
    const isReal = !!terrain;

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>3D Terrain Viewer</h2>
                    <p className="text-muted text-xs mt-1">
                        {isReal ? `Real elevation data · RMSE-optimized · Drag to orbit` : 'Demo terrain · Upload an image to see real data'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAutoRotate(a => !a)}>
                        {autoRotate ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Flythrough</>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/results')}><Layers size={12} /> Results</button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 190px', gap: 12, minHeight: 0 }}>
                {/* Canvas */}
                <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#020a14', border: '1px solid var(--border)' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
                            <Mountain size={40} opacity={0.2} />
                            <p className="text-muted text-sm">Loading height data…</p>
                        </div>
                    ) : error ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8 }}>
                            <AlertCircle size={28} color="var(--accent-red)" opacity={0.7} />
                            <p className="text-muted text-sm">Could not load height data</p>
                            <p className="text-xs text-muted">{error}</p>
                            <p className="text-xs text-muted">Showing demo terrain instead</p>
                        </div>
                    ) : null}
                    <TerrainCanvas terrain={terrainData} vertScale={vertScale} autoRotate={autoRotate} showGrid={showGrid} colorMode={colorMode} />

                    {/* Overlay badges */}
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, pointerEvents: 'none' }}>
                        {isReal
                            ? <span className="badge badge-success">✓ Real Data · Job #{jobId}</span>
                            : <span className="badge badge-warning">Demo Mode</span>}
                    </div>

                    {/* Height stats overlay */}
                    {heightMeta && (
                        <div style={{ position: 'absolute', top: 12, right: 50, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '4px 10px', pointerEvents: 'none' }}>
                            <div style={{ fontSize: 9, color: 'rgba(148,163,184,.7)', marginBottom: 2 }}>ELEVATION RANGE</div>
                            <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>
                                {heightMeta.min.toFixed(1)}m – {heightMeta.max.toFixed(1)}m
                            </div>
                            <div style={{ fontSize: 9, color: 'rgba(148,163,184,.6)' }}>mean {heightMeta.mean.toFixed(1)}m</div>
                        </div>
                    )}

                    {/* Bottom controls */}
                    <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.min(s + 0.5, 5))}><ZoomIn size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.max(s - 0.5, 0.5))}><ZoomOut size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setVertScale(1); setAutoRotate(false); }}><RotateCcw size={13} /> Reset</button>
                    </div>
                </div>

                {/* Side controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Color Mode</div>
                        {['terrain', 'thermal', 'grey'].map(m => (
                            <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span className="text-xs" style={{ textTransform: 'capitalize' }}>{m}</span>
                                <div className={`toggle${colorMode === m ? ' on' : ''}`} onClick={() => setColorMode(m)} />
                            </div>
                        ))}
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Vertical Scale</div>
                        <input type="range" min={0.5} max={5} step={0.5} value={vertScale}
                            onChange={e => setVertScale(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                        <div className="text-xs text-muted mt-1">{vertScale}×</div>
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Display</div>
                        <div className="layer-toggle">
                            <span className="text-xs">Grid Lines</span>
                            <div className={`toggle${showGrid ? ' on' : ''}`} onClick={() => setShowGrid(g => !g)} />
                        </div>
                        <div className="layer-toggle mt-2">
                            <span className="text-xs">Flythrough</span>
                            <div className={`toggle${autoRotate ? ' on' : ''}`} onClick={() => setAutoRotate(a => !a)} />
                        </div>
                    </div>

                    {heightMeta && (
                        <div className="card card-sm" style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)' }}>
                            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>Elevation Stats</div>
                            {[['Min', heightMeta.min.toFixed(1) + 'm'], ['Max', heightMeta.max.toFixed(1) + 'm'], ['Mean', heightMeta.mean.toFixed(1) + 'm']].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                                    <span className="text-muted">{k}</span><span className="font-semibold">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="card card-sm">
                        <div className="text-xs text-muted">🖱 Drag to orbit</div>
                        <div className="text-xs text-muted mt-1">🔼 Scale slider</div>
                        <div className="text-xs text-muted mt-1">↺ Reset view</div>
                    </div>

                    {!jobId && (
                        <button className="btn btn-primary btn-sm w-full" onClick={() => navigate('/upload')}>
                            Upload Image
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
