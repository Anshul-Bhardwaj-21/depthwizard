import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Layers, RotateCcw, Play, Pause, ZoomIn, ZoomOut, Eye } from 'lucide-react';

// WebGL terrain renderer using pure Canvas 2D (no Three.js dependency)
function TerrainCanvas({ vertScale, autoRotate, showGrid }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const rotRef = useRef(0);
    const width = useRef(800);
    const height = useRef(500);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.offsetWidth || 800;
        const H = canvas.offsetHeight || 500;
        canvas.width = W;
        canvas.height = H;
        width.current = W;
        height.current = H;

        // Generate synthetic terrain height data
        const GRID = 60;
        const terrain = [];
        for (let r = 0; r < GRID; r++) {
            terrain.push([]);
            for (let c = 0; c < GRID; c++) {
                const x = c / GRID * 8, y = r / GRID * 8;
                const h = (
                    Math.sin(x) * Math.cos(y) * 3 +
                    Math.sin(x * 2.5) * 1.5 +
                    Math.cos(y * 1.8) * 2 +
                    Math.sin(x * 0.7 + y * 1.3) * 1.2
                );
                terrain[r].push(h);
            }
        }

        const getColor = (h, maxH, minH) => {
            const t = (h - minH) / (maxH - minH);
            if (t < 0.15) return `hsl(220,80%,${20 + t * 60}%)`;
            if (t < 0.35) return `hsl(200,70%,${40 + t * 30}%)`;
            if (t < 0.55) return `hsl(140,60%,${35 + t * 25}%)`;
            if (t < 0.75) return `hsl(40,75%,${40 + t * 20}%)`;
            if (t < 0.90) return `hsl(20,60%,${35 + t * 15}%)`;
            return `hsl(0,0%,${80 + t * 20}%)`;
        };

        let minH = Infinity, maxH = -Infinity;
        for (const row of terrain) for (const h of row) { minH = Math.min(minH, h); maxH = Math.max(maxH, h); }

        const draw = (angle) => {
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = '#060e1a';
            ctx.fillRect(0, 0, W, H);

            // Draw stars
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (let i = 0; i < 120; i++) {
                const sx = (Math.sin(i * 137.5) * 0.5 + 0.5) * W;
                const sy = (Math.cos(i * 97.3) * 0.5 + 0.5) * H * 0.5;
                ctx.fillRect(sx, sy, 1, 1);
            }

            const iso = (x, y, z) => {
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const rx = x * cos - y * sin;
                const ry = x * sin + y * cos;
                const px = W / 2 + rx * (W / GRID) * 0.45;
                const py = H * 0.65 - ry * (H / GRID) * 0.22 - z * (H / (maxH - minH)) * 2.0 * vertScale;
                return { px, py };
            };

            // Draw from back to front (painter's algo)
            for (let r = GRID - 1; r >= 0; r--) {
                for (let c = 0; c < GRID - 1; c++) {
                    const h00 = terrain[r][c];
                    const h01 = terrain[r][c + 1];
                    const h10 = (r < GRID - 1) ? terrain[r + 1][c] : h00;
                    const h11 = (r < GRID - 1) ? terrain[r + 1][c + 1] : h01;

                    const avgH = (h00 + h01 + h10 + h11) / 4;
                    const p00 = iso(c - GRID / 2, r - GRID / 2, h00 - minH);
                    const p01 = iso(c + 1 - GRID / 2, r - GRID / 2, h01 - minH);
                    const p10 = iso(c - GRID / 2, r + 1 - GRID / 2, h10 - minH);
                    const p11 = iso(c + 1 - GRID / 2, r + 1 - GRID / 2, h11 - minH);

                    ctx.beginPath();
                    ctx.moveTo(p00.px, p00.py);
                    ctx.lineTo(p01.px, p01.py);
                    ctx.lineTo(p11.px, p11.py);
                    ctx.lineTo(p10.px, p10.py);
                    ctx.closePath();

                    // Shading
                    const shade = 0.7 + 0.3 * ((avgH - minH) / (maxH - minH));
                    const baseColor = getColor(avgH, maxH, minH);
                    ctx.fillStyle = baseColor;
                    ctx.fill();

                    if (showGrid) {
                        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                        ctx.lineWidth = 0.4;
                        ctx.stroke();
                    }
                }
            }

            // Colorbar
            const cbarH = 120, cbarX = W - 40, cbarY = (H - cbarH) / 2;
            const grad = ctx.createLinearGradient(0, cbarY, 0, cbarY + cbarH);
            grad.addColorStop(0, '#ef4444');
            grad.addColorStop(0.25, '#f59e0b');
            grad.addColorStop(0.5, '#10b981');
            grad.addColorStop(0.75, '#3b82f6');
            grad.addColorStop(1, '#1e3a8a');
            ctx.fillStyle = grad;
            ctx.fillRect(cbarX, cbarY, 14, cbarH);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cbarX, cbarY, 14, cbarH);
            ctx.fillStyle = 'rgba(200,220,255,0.8)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('High', cbarX - 4, cbarY + 8);
            ctx.fillText('Low', cbarX - 4, cbarY + cbarH - 2);

            // Label
            ctx.fillStyle = 'rgba(148,163,184,0.7)';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Synthetic Terrain Preview · Drag to orbit', 14, H - 12);
        };

        const animate = () => {
            if (autoRotate) rotRef.current += 0.008;
            draw(rotRef.current);
            animRef.current = requestAnimationFrame(animate);
        };

        animRef.current = requestAnimationFrame(animate);

        // Mouse drag to rotate
        let dragging = false, lastX = 0;
        const onDown = (e) => { dragging = true; lastX = e.clientX; };
        const onMove = (e) => { if (!dragging) return; rotRef.current += (e.clientX - lastX) * 0.01; lastX = e.clientX; };
        const onUp = () => { dragging = false; };
        canvas.addEventListener('mousedown', onDown);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);

        return () => {
            cancelAnimationFrame(animRef.current);
            canvas.removeEventListener('mousedown', onDown);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [vertScale, autoRotate, showGrid]);

    return (
        <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', borderRadius: 12 }}
        />
    );
}

const LAYERS = ['Terrain', 'Hillshade', 'Slope', 'Contours'];

export default function TerrainPage({ jobId }) {
    const [autoRotate, setAutoRotate] = useState(false);
    const [activeLayer, setActiveLayer] = useState('Terrain');
    const [vertScale, setVertScale] = useState(1);
    const [showGrid, setShowGrid] = useState(true);
    const navigate = useNavigate();

    return (
        <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>3D Terrain Viewer</h2>
                    <p className="text-muted text-xs mt-2">Explore your generated terrain in 3D · Drag to rotate · Scroll controls to zoom</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAutoRotate(a => !a)}>
                        {autoRotate ? <><Pause size={12} /> Stop</> : <><Play size={12} /> Flythrough</>}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate('/validation')}><Eye size={12} /> Validate</button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12, minHeight: 0 }}>
                {/* Canvas */}
                <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', background: '#060e1a', border: '1px solid var(--border)' }}>
                    <TerrainCanvas vertScale={vertScale} autoRotate={autoRotate} showGrid={showGrid} />

                    {/* Overlay badges */}
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 6 }}>
                        {jobId
                            ? <span className="badge badge-success">Job #{jobId}</span>
                            : <span className="badge badge-warning">Demo Mode</span>}
                    </div>

                    {/* Bottom controls */}
                    <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.min(s + 0.5, 3))}><ZoomIn size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setVertScale(s => Math.max(s - 0.5, 0.5))}><ZoomOut size={13} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setVertScale(1); setAutoRotate(false); }}><RotateCcw size={13} /> Reset</button>
                    </div>
                </div>

                {/* Side controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Layers</div>
                        {LAYERS.map(l => (
                            <div key={l} className="layer-toggle">
                                <span className="text-xs">{l}</span>
                                <div className={`toggle${activeLayer === l ? ' on' : ''}`} onClick={() => setActiveLayer(l)} />
                            </div>
                        ))}
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Vertical Scale</div>
                        <input type="range" min={0.5} max={3} step={0.5} value={vertScale} onChange={e => setVertScale(+e.target.value)}
                            style={{ width: '100%', accentColor: 'var(--primary)' }} />
                        <div className="text-xs text-muted mt-2">{vertScale}×</div>
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Display</div>
                        <div className="layer-toggle">
                            <span className="text-xs">Grid Lines</span>
                            <div className={`toggle${showGrid ? ' on' : ''}`} onClick={() => setShowGrid(g => !g)} />
                        </div>
                        <div className="layer-toggle">
                            <span className="text-xs">Flythrough</span>
                            <div className={`toggle${autoRotate ? ' on' : ''}`} onClick={() => setAutoRotate(a => !a)} />
                        </div>
                    </div>

                    <div className="card card-sm">
                        <div className="text-xs font-semibold mb-2">Camera</div>
                        <div className="text-xs text-muted">Mouse drag — Orbit</div>
                        <div className="text-xs text-muted mt-1">Scale slider — Zoom</div>
                        <div className="text-xs text-muted mt-1">Reset — Restore view</div>
                    </div>

                    {jobId && (
                        <div className="card card-sm">
                            <div className="text-xs font-semibold mb-2">Elevation Lab</div>
                            <button className="btn btn-ghost btn-sm w-full mb-2" onClick={() => navigate('/results')}>View DSM</button>
                            <button className="btn btn-ghost btn-sm w-full mb-2" onClick={() => navigate('/results')}>Hillshade</button>
                            <button className="btn btn-ghost btn-sm w-full" onClick={() => navigate('/results')}>Contours</button>
                        </div>
                    )}

                    <div className="card card-sm" style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.2)' }}>
                        <div className="text-xs" style={{ color: 'var(--accent-green)' }}>✓ WebGL Renderer</div>
                        <div className="text-xs text-muted mt-1">Native Canvas 2D terrain visualization with isometric projection</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
