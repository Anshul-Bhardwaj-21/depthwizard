import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, RotateCcw, Play, Pause, ZoomIn, ZoomOut, AlertCircle, ArrowLeft } from 'lucide-react';

const BASE = 'http://localhost:8000';

// ── Canvas 3D terrain renderer ────────────────────────────────────────────────
function TerrainCanvas({ terrain, vertScale, autoRotate, showGrid, colorMode }) {
    const canvasRef = useRef(null);
    const rotRef = useRef(-0.6);   // pleasant starting angle

    const getColor = (t, mode) => {
        if (mode === 'thermal') {
            const r = Math.round(255 * Math.min(1, t * 2));
            const g = Math.round(255 * (1 - Math.abs(t * 2 - 1)));
            const b = Math.round(255 * Math.max(0, 1 - t * 2));
            return `rgb(${r},${g},${b})`;
        }
        if (mode === 'grey') return `hsl(0,0%,${18 + t * 72}%)`;
        // Terrain palette: deep blue → teal → green → sand → brown → white
        if (t < 0.12) return `hsl(225,65%,${20 + t * 100}%)`;
        if (t < 0.30) return `hsl(190,55%,${38 + t * 35}%)`;
        if (t < 0.52) return `hsl(132,50%,${28 + t * 28}%)`;
        if (t < 0.72) return `hsl(38,68%,${36 + t * 14}%)`;
        if (t < 0.88) return `hsl(22,52%,${30 + t * 10}%)`;
        return `hsl(0,0%,${72 + t * 22}%)`;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !terrain || terrain.length === 0) return;
        const ctx = canvas.getContext('2d');

        const ROWS = terrain.length;
        const COLS = terrain[0].length;
        let minH = Infinity, maxH = -Infinity;
        for (const row of terrain) for (const v of row) {
            if (v < minH) minH = v;
            if (v > maxH) maxH = v;
        }
        const range = maxH - minH || 1;

        let rafId, dragging = false, lastX = 0;

        const resize = () => {
            canvas.width = canvas.offsetWidth || 800;
            canvas.height = canvas.offsetHeight || 500;
        };
        resize();

        const draw = () => {
            const W = canvas.width, H = canvas.height;
            const angle = rotRef.current;
            const cos = Math.cos(angle), sin = Math.sin(angle);

            // Background
            const bg = ctx.createLinearGradient(0, 0, 0, H);
            bg.addColorStop(0, '#030d1e');
            bg.addColorStop(1, '#06132b');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // Stars
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 80; i++) {
                const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
                const sy = (Math.cos(i * 97.3) * 0.5 + 0.5) * H * 0.42;
                ctx.fillRect(sx, sy, 1, 1);
            }

            // Isometric projection — camera looking DOWN at terrain
            const cellW = (W / COLS) * 0.50;
            const cellH = (H / ROWS) * 0.22;
            const hScale = (H * 0.28 / range) * vertScale;

            const iso = (col, row, h) => {
                const dx = col - COLS / 2;
                const dy = row - ROWS / 2;
                const rx = dx * cos - dy * sin;
                const ry = dx * sin + dy * cos;
                return {
                    x: W / 2 + rx * cellW,
                    y: H * 0.62 + ry * cellH - (h - minH) * hScale,
                };
            };

            // Draw back → front so near tiles paint over far tiles
            for (let r = 0; r < ROWS - 1; r++) {
                for (let c = 0; c < COLS - 1; c++) {
                    const h00 = terrain[r][c];
                    const h01 = terrain[r][c + 1];
                    const h10 = terrain[r + 1][c];
                    const h11 = terrain[r + 1][c + 1];
                    const avgH = (h00 + h01 + h10 + h11) / 4;
                    const t = (avgH - minH) / range;

                    // Light shading — tiles facing up-left are brighter
                    const nx = (h01 - h00) + (h11 - h10);
                    const ny = (h10 - h00) + (h11 - h01);
                    const shade = 0.72 + 0.28 * Math.max(0, (-nx * 0.5 - ny * 0.5) / (Math.hypot(nx, ny) + 0.001));

                    const p00 = iso(c, r, h00);
                    const p01 = iso(c + 1, r, h01);
                    const p11 = iso(c + 1, r + 1, h11);
                    const p10 = iso(c, r + 1, h10);

                    // Top face
                    ctx.beginPath();
                    ctx.moveTo(p00.x, p00.y);
                    ctx.lineTo(p01.x, p01.y);
                    ctx.lineTo(p11.x, p11.y);
                    ctx.lineTo(p10.x, p10.y);
                    ctx.closePath();

                    const base = getColor(t, colorMode);
                    // Apply shading by parsing hsl and adjusting lightness
                    ctx.fillStyle = base;
                    ctx.globalAlpha = 0.6 + shade * 0.4;
                    ctx.fill();
                    ctx.globalAlpha = 1;

                    if (showGrid) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
                        ctx.lineWidth = 0.4;
                        ctx.stroke();
                    }

                    // Side wall — front-left face for depth illusion
                    const groundY00 = H * 0.62 + (iso(c, r, minH).y - iso(c, r, h00).y + p00.y - H * 0.62);
                    const groundY10 = H * 0.62 + (iso(c, r + 1, minH).y - iso(c, r + 1, h10).y + p10.y - H * 0.62);
                    const g00 = { x: p00.x, y: iso(c, r, minH).y };
                    const g10 = { x: p10.x, y: iso(c, r + 1, minH).y };

                    if (p00.y > p10.y || p01.y > p11.y) {
                        ctx.beginPath();
                        ctx.moveTo(p10.x, p10.y);
                        ctx.lineTo(g10.x, g10.y);
                        ctx.lineTo(g00.x, g00.y);
                        ctx.lineTo(p00.x, p00.y);
                        ctx.closePath();
                        ctx.fillStyle = base;
                        ctx.globalAlpha = 0.3;
                        ctx.fill();
                        ctx.globalAlpha = 1;
                    }
                }
            }

            // Colorbar
            const cH = 130, cX = W - 32, cY = (H - cH) / 2;
            const grad = ctx.createLinearGradient(0, cY, 0, cY + cH);
            grad.addColorStop(0, getColor(1, colorMode));
            grad.addColorStop(0.5, getColor(0.5, colorMode));
            grad.addColorStop(1, getColor(0, colorMode));
            ctx.fillStyle = grad;
            ctx.fillRect(cX, cY, 10, cH);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cX, cY, 10, cH);
            ctx.fillStyle = 'rgba(180,200,255,0.75)';
            ctx.font = '9px Inter, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(maxH.toFixed(1) + 'm', cX - 3, cY + 10);
            ctx.fillText(minH.toFixed(1) + 'm', cX - 3, cY + cH);
        };

        const animate = () => {
            if (autoRotate) rotRef.current -= 0.006;
            draw();
            rafId = requestAnimationFrame(animate);
        };
        animate();

        const onDown = e => { dragging = true; lastX = e.clientX; canvas.style.cursor = 'grabbing'; };
        const onMove = e => { if (!dragging) return; rotRef.current += (e.clientX - lastX) * 0.013; lastX = e.clientX; };
        const onUp = () => { dragging = false; canvas.style.cursor = 'grab'; };
        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            cancelAnimationFrame(rafId);
            canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [terrain, vertScale, autoRotate, showGrid, colorMode, getColor]);

    return (
        <canvas ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', borderRadius: 12 }} />
    );
}

// ── Synthetic fallback terrain ────────────────────────────────────────────────
const SYNTH = (() => {
    const G = 64;
    return Array.from({ length: G }, (_, r) =>
        Array.from({ length: G }, (_, c) => {
            const x = c / G * 9, y = r / G * 9;
            return (
                Math.sin(x) * Math.cos(y) * 4 +
                Math.sin(x * 2.3 + 0.5) * 1.8 +
                Math.cos(y * 1.7 + 1.0) * 2.2 +
                Math.sin((x + y) * 0.8) * 1.2
            );
        })
    );
})();

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TerrainPage({ jobId }) {
    const [autoRotate, setAutoRotate] = useState(false);
    const [vertScale, setVertScale] = useState(1.2);
    const [showGrid, setShowGrid] = useState(false);
    const [colorMode, setColorMode] = useState('terrain');
    const [terrain, setTerrain] = useState(null);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!jobId) return;
        setLoading(true); setError('');
        fetch(`${BASE}/jobs/${jobId}/heightmap?grid=64`)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(d => { setTerrain(d.grid); setMeta({ min: d.min, max: d.max, mean: d.mean }); })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [jobId]);

    const terrainData = terrain ?? SYNTH;
    const isReal = !!terrain;

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>3D Terrain Viewer</h2>
                    <p className="text-muted text-xs mt-1">
                        {loading ? 'Loading height data…' : isReal
                            ? 'Real elevation data · Drag to orbit · Scroll controls to scale'
                            : 'Demo terrain · Upload an image to visualize real elevation'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAutoRotate(a => !a)}>
                        {autoRotate ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Flythrough</>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/results')}>
                        <ArrowLeft size={12} /> Results
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12, minHeight: 0 }}>

                {/* Canvas panel */}
                <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#030d1e', border: '1px solid var(--border)' }}>

                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, zIndex: 2 }}>
                            <Mountain size={36} opacity={0.2} />
                            <span className="text-muted text-sm">Loading elevation data…</span>
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{
                            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2,
                            background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '6px 14px',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <AlertCircle size={12} color="var(--accent-red)" />
                            <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>Could not load height data · Showing demo terrain</span>
                        </div>
                    )}

                    <TerrainCanvas
                        terrain={terrainData}
                        vertScale={vertScale}
                        autoRotate={autoRotate}
                        showGrid={showGrid}
                        colorMode={colorMode}
                    />

                    {/* Top-left badge */}
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6, pointerEvents: 'none' }}>
                        {isReal
                            ? <span className="badge badge-success">✓ Real Data · Job #{jobId?.slice(0, 8)}</span>
                            : <span className="badge badge-warning">Demo Mode</span>}
                    </div>

                    {/* Elevation range overlay */}
                    {meta && (
                        <div style={{
                            position: 'absolute', top: 12, right: 44, pointerEvents: 'none',
                            background: 'rgba(3,13,30,0.72)', borderRadius: 7, padding: '5px 12px',
                            border: '1px solid rgba(99,102,241,.25)'
                        }}>
                            <div style={{ fontSize: 9, color: 'rgba(148,163,184,.65)', letterSpacing: 1, marginBottom: 2 }}>ELEVATION RANGE</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
                                {meta.min.toFixed(1)}m – {meta.max.toFixed(1)}m
                            </div>
                            <div style={{ fontSize: 9, color: 'rgba(148,163,184,.55)' }}>mean {meta.mean.toFixed(1)} m</div>
                        </div>
                    )}

                    {/* Bottom controls */}
                    <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.min(s + 0.5, 6))}><ZoomIn size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.max(s - 0.5, 0.5))}><ZoomOut size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setVertScale(1.2); setAutoRotate(false); }}><RotateCcw size={13} /> Reset</button>
                    </div>
                </div>

                {/* Side panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-3">Color Mode</div>
                        {[['terrain', '🌍 Terrain'], ['thermal', '🌡 Thermal'], ['grey', '⬜ Greyscale']].map(([id, label]) => (
                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span className="text-xs">{label}</span>
                                <div className={`toggle${colorMode === id ? ' on' : ''}`} onClick={() => setColorMode(id)} />
                            </div>
                        ))}
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Vertical Scale</div>
                        <input type="range" min={0.5} max={6} step={0.5} value={vertScale}
                            onChange={e => setVertScale(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                        <div className="text-xs text-muted mt-1" style={{ textAlign: 'right' }}>{vertScale}×</div>
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

                    {meta && (
                        <div className="card card-sm" style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)' }}>
                            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--accent-green)' }}>Elevation Stats</div>
                            {[['Min', meta.min.toFixed(2) + ' m'], ['Max', meta.max.toFixed(2) + ' m'], ['Mean', meta.mean.toFixed(2) + ' m'],
                            ['Range', (meta.max - meta.min).toFixed(2) + ' m']].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                                    <span className="text-muted">{k}</span>
                                    <span className="font-semibold">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="card card-sm">
                        <div className="text-xs text-muted">🖱 Drag — orbit</div>
                        <div className="text-xs text-muted mt-1">⬆ Slider — scale</div>
                        <div className="text-xs text-muted mt-1">↺ Reset — default view</div>
                    </div>

                    {!jobId && (
                        <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}>
                            + Upload Image
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
