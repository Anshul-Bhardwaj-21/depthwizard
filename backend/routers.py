from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import json
import numpy as np
from PIL import Image
from pathlib import Path
from services.db import SessionLocal, Analysis
from schemas import AnalysisResponse
from services.terrain_layers import compute_slope_aspect, compute_hillshade, get_geojson_contours
from services.measure import compute_profile
import matplotlib.pyplot as plt

router = APIRouter()
OUTPUTS_DIR = Path(__file__).resolve().parent / "job_outputs"

class ProfileRequest(BaseModel):
    points: list[list[float]]

@router.get("/jobs/{job_id}/layers/{layer}")
def get_layer(job_id: str, layer: str, azimuth: float = 315.0, elevation: float = 45.0):
    job_dir = OUTPUTS_DIR / job_id
    if not job_dir.exists(): raise HTTPException(404)
        
    height_path = job_dir / "height.npy"
    if not height_path.exists(): raise HTTPException(404, "No height data found")
        
    out_img = job_dir / f"{layer}.png"
    if out_img.exists(): return FileResponse(out_img)
        
    height_array = np.load(height_path)
    
    if layer == "dsm":
        normalized = (height_array - height_array.min()) / (np.ptp(height_array) + 1e-6)
        Image.fromarray((normalized * 255).astype(np.uint8)).save(out_img)
    elif layer == "slope":
        slope, _ = compute_slope_aspect(height_array)
        normalized = slope / 90.0 # max 90 degrees
        Image.fromarray((normalized * 255).astype(np.uint8)).save(out_img)
    elif layer == "aspect":
        _, aspect = compute_slope_aspect(height_array)
        cmap = plt.get_cmap("hsv")
        colorized = cmap(aspect / 360.0)
        Image.fromarray((colorized[:, :, :3] * 255).astype(np.uint8)).save(out_img)
    elif layer == "hillshade":
        slope, aspect = compute_slope_aspect(height_array)
        shaded = compute_hillshade(slope, aspect, azimuth, elevation)
        Image.fromarray((shaded * 255).astype(np.uint8)).save(out_img)
    else:
        raise HTTPException(400, "Unknown layer")
        
    return FileResponse(out_img)

@router.get("/jobs/{job_id}/heightmap")
def get_heightmap(job_id: str, grid: int = 64):
    """Return height data as a downsampled JSON grid for the 3D terrain viewer."""
    job_dir = OUTPUTS_DIR / job_id
    height_path = job_dir / "height.npy"
    if not height_path.exists():
        raise HTTPException(404, "No height data found for this job")

    h = np.load(height_path).astype(np.float32)
    # Downsample to grid×grid using PIL for speed
    from PIL import Image as _Image
    img = _Image.fromarray(h).resize((grid, grid), _Image.BILINEAR)
    grid_data = np.array(img, dtype=np.float32)

    return JSONResponse({
        "grid": grid_data.tolist(),
        "rows": grid,
        "cols": grid,
        "min": float(grid_data.min()),
        "max": float(grid_data.max()),
        "mean": float(grid_data.mean()),
    })

@router.get("/jobs/{job_id}/contours")
def get_contours(job_id: str, interval: float = 10.0):
    job_dir = OUTPUTS_DIR / job_id
    height_path = job_dir / "height.npy"
    if not height_path.exists(): raise HTTPException(404)
        
    height_array = np.load(height_path)
    result_path = job_dir / "result.json"
    bounds = None
    if result_path.exists():
        res = json.loads(result_path.read_text())
        bounds = res.get("bounds_wgs84")
        
    gj = get_geojson_contours(height_array, bounds=bounds, interval=interval)
    return JSONResponse(gj)

@router.post("/jobs/{job_id}/profile")
def get_profile(job_id: str, req: ProfileRequest):
    job_dir = OUTPUTS_DIR / job_id
    height_path = job_dir / "height.npy"
    if not height_path.exists(): raise HTTPException(404)
        
    height_array = np.load(height_path)
    result_path = job_dir / "result.json"
    bounds = None
    if result_path.exists():
        res = json.loads(result_path.read_text())
        bounds = res.get("bounds_wgs84")
        
    prof = compute_profile(height_array, req.points, bounds=bounds)
    return JSONResponse(prof)

@router.get("/jobs/{job_id}/error-heatmap")
def get_error_heatmap(job_id: str):
    job_dir = OUTPUTS_DIR / job_id
    out_img = job_dir / "error_heatmap.png"
    if out_img.exists(): return FileResponse(out_img)
        
    height_path = job_dir / "height.npy"
    srtm_path = job_dir / "srtm_reference.npy"
    if not height_path.exists() or not srtm_path.exists():
        raise HTTPException(404, "No reference data")
        
    predicted = np.load(height_path)
    reference = np.load(srtm_path)
    diff = predicted - reference
    
    vmax = max(1e-3, np.percentile(np.abs(diff), 95))
    cmap = plt.get_cmap("bwr")
    norm = plt.Normalize(vmin=-vmax, vmax=vmax)
    rgba = cmap(norm(diff))
    
    Image.fromarray((rgba[:, :, :3] * 255).astype(np.uint8)).save(out_img)
    return FileResponse(out_img)

@router.get("/analyses", response_model=list[AnalysisResponse])
def list_analyses():
    db = SessionLocal()
    try:
        ans = db.query(Analysis).order_by(Analysis.created_at.desc()).all()
        return [AnalysisResponse(
            id=a.id, name=a.name, created_at=a.created_at.isoformat(),
            status=a.status, input_type=a.input_type,
            bounds=json.loads(a.bounds) if a.bounds else None,
            thumbnail_path=a.thumbnail_path,
            metrics=json.loads(a.metrics) if a.metrics else None,
            model_version=a.model_version
        ) for a in ans]
    finally:
        db.close()

@router.get("/analyses/{id}", response_model=AnalysisResponse)
def get_analysis_route(id: str):
    db = SessionLocal()
    try:
        a = db.query(Analysis).filter(Analysis.id == id).first()
        if not a: raise HTTPException(404)
        return AnalysisResponse(
            id=a.id, name=a.name, created_at=a.created_at.isoformat(),
            status=a.status, input_type=a.input_type,
            bounds=json.loads(a.bounds) if a.bounds else None,
            thumbnail_path=a.thumbnail_path,
            metrics=json.loads(a.metrics) if a.metrics else None,
            model_version=a.model_version
        )
    finally:
        db.close()

@router.delete("/analyses/{id}")
def delete_analysis(id: str):
    db = SessionLocal()
    try:
        a = db.query(Analysis).filter(Analysis.id == id).first()
        if not a: raise HTTPException(404)
        db.delete(a)
        db.commit()
        return {"status": "ok"}
    finally:
        db.close()

from services.report import generate_report

@router.get("/jobs/{job_id}/report")
def get_report(job_id: str, format: str = "pdf"):
    try:
        out_file = generate_report(job_id, format)
        return FileResponse(out_file, media_type="application/pdf")
    except Exception as e:
        raise HTTPException(400, str(e))
