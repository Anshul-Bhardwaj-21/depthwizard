"""
app.py
------
FastAPI backend for DepthWizard.

Endpoints:
  POST /predict            multipart upload (PNG/JPG/GeoTIFF) -> height map + texture URLs
  GET  /validate/{job_id}  compares the predicted height against the SRTM
                            reference fetched during /predict (georeferenced jobs only)
  GET  /health

Run:
    uvicorn app:app --reload --port 8000

Expects a trained checkpoint at ../model/checkpoints/best.pt (see model/train.py).
Falls back to an *untrained* model with a loud warning if no checkpoint is
found, purely so the API and frontend can be wired up and demoed before
training finishes -- do NOT treat outputs from that fallback as meaningful.
"""

import sys
import uuid
import json
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

MODEL_DIR = Path(__file__).resolve().parent.parent / "model"
sys.path.insert(0, str(MODEL_DIR))

from unet import HeightUNet          # noqa: E402
from calibrate import calibrate_scale, fetch_srtm_tile  # noqa: E402
from infer import is_georeferenced, get_bounds_wgs84, predict_relative_height  # noqa: E402
from schemas import PredictResponse, ValidateResponse, CalibrationInfo, JobStatusResponse, FetchAreaRequest  # noqa: E402
from services.jobs import create_job_record, update_job_status
from services.db import SessionLocal, Analysis

CHECKPOINT_PATH = MODEL_DIR / "checkpoints" / "best.pt"
OUTPUTS_DIR = Path(__file__).resolve().parent / "job_outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)
IMAGE_SIZE = 256

app = FastAPI(title="DepthWizard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/outputs", StaticFiles(directory=OUTPUTS_DIR), name="outputs")

from routers import router as extended_router
app.include_router(extended_router)

_model = None
_model_is_trained = False


def get_model() -> HeightUNet:
    global _model, _model_is_trained
    if _model is None:
        import torch
        if CHECKPOINT_PATH.exists():
            _model = HeightUNet(pretrained=False)
            _model.load_state_dict(torch.load(CHECKPOINT_PATH, map_location="cpu"))
            _model.eval()
            _model_is_trained = True
        else:
            print("[app] WARNING: no checkpoint found at", CHECKPOINT_PATH,
                  "- serving an UNTRAINED model. Run model/train.py first.")
            _model = HeightUNet(pretrained=True)
            _model.eval()
            _model_is_trained = False
    return _model


@app.on_event("startup")
def _load_model_on_startup():
    get_model()


@app.get("/health")
def health():
    return {"status": "ok", "model_trained": _model_is_trained, "checkpoint_found": CHECKPOINT_PATH.exists()}


def run_inference_core(job_id: str, job_dir: Path, raw_path: Path, local_dem_path: str | None, model: HeightUNet) -> dict:
    try:
        img = Image.open(raw_path).convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}") from exc

    rgb = np.asarray(img, dtype=np.float32) / 255.0
    relative_height = predict_relative_height(model, rgb)

    response = {
        "mode": "relative",
        "georeferenced": False,
        "height_map_url": "",
        "texture_url": f"/outputs/{job_id}/texture.png",
        "bounds_wgs84": None,
        "calibration": None,
    }

    height_for_preview = relative_height
    geo = is_georeferenced(str(raw_path))
    response["georeferenced"] = geo

    if geo:
        update_job_status(job_id, "calibrating")
        try:
            bounds = get_bounds_wgs84(str(raw_path))
            srtm_path = fetch_srtm_tile(
                bounds,
                output_path=str(job_dir / "srtm_tile.tif"),
                local_dem_path=local_dem_path,
            )

            import rasterio
            from rasterio.warp import reproject, Resampling
            from rasterio.transform import from_bounds as transform_from_bounds

            # reproject the DEM onto the SAME grid the RGB image was resized
            # to (IMAGE_SIZE x IMAGE_SIZE over the image's own WGS84 bounds)
            # -- reusing the DEM's own transform here would silently
            # misalign the two arrays whenever the DEM tile's resolution or
            # extent doesn't exactly match the input image.
            west, south, east, north = bounds
            dst_transform = transform_from_bounds(west, south, east, north, IMAGE_SIZE, IMAGE_SIZE)

            with rasterio.open(srtm_path) as srtm_src:
                srtm_arr = np.zeros((IMAGE_SIZE, IMAGE_SIZE), dtype=np.float32)
                reproject(
                    source=rasterio.band(srtm_src, 1),
                    destination=srtm_arr,
                    src_transform=srtm_src.transform,
                    src_crs=srtm_src.crs,
                    dst_transform=dst_transform,
                    dst_crs="EPSG:4326",
                    resampling=Resampling.bilinear,
                )
            calib = calibrate_scale(relative_height, srtm_arr)
            height_for_preview = calib.apply(relative_height)

            np.save(job_dir / "srtm_reference.npy", srtm_arr)
            response.update({
                "mode": "absolute",
                "bounds_wgs84": list(bounds),
                "calibration": CalibrationInfo(
                    scale=calib.scale, offset=calib.offset, inlier_fraction=calib.inlier_fraction
                ),
            })
        except Exception as exc:  # noqa: BLE001
            print(f"[app] calibration failed for job {job_id}: {exc}")

    np.save(job_dir / "height.npy", height_for_preview)
    normalized = (height_for_preview - height_for_preview.min()) / (np.ptp(height_for_preview) + 1e-6)
    Image.fromarray((normalized * 255).astype(np.uint8)).save(job_dir / "height_preview.png")
    img.save(job_dir / "texture.png")

    response["height_map_url"] = f"/outputs/{job_id}/height_preview.png"
    response["job_id"] = job_id
    return response

@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...), srtm_file: UploadFile | None = File(None)):
    """
    srtm_file is optional: a pre-downloaded local DEM GeoTIFF covering the
    same area as `file`. Supply it to skip the live SRTM fetch entirely --
    useful for offline/venue-network demos, or anywhere the live fetch
    (which needs outbound access + gdal) isn't available. If omitted, the
    live fetch is attempted and calibration is skipped (falling back to
    relative height) if that fetch fails.
    """
    job_id = uuid.uuid4().hex[:12]
    job_dir = OUTPUTS_DIR / job_id
    job_dir.mkdir()

    raw_path = job_dir / file.filename
    raw_path.write_bytes(await file.read())

    local_dem_path = None
    if srtm_file is not None:
        local_dem_path = str(job_dir / srtm_file.filename)
        Path(local_dem_path).write_bytes(await srtm_file.read())

    return run_inference_core(job_id, job_dir, raw_path, local_dem_path, get_model())

def run_job_background(job_id: str, job_dir: Path, raw_path: Path, local_dem_path: str | None, model: HeightUNet):
    update_job_status(job_id, "ingesting")
    try:
        response = run_inference_core(job_id, job_dir, raw_path, local_dem_path, model)
        update_job_status(job_id, "done", metrics=None, bounds=response.get("bounds_wgs84"), thumbnail_path=response.get("height_map_url"))
        (job_dir / "result.json").write_text(json.dumps({k: v for k, v in response.items() if (v is None or type(v) in (str, int, float, bool, list, dict)) or (hasattr(v, 'model_dump') and type(v) != list)}))
        # Wait, calibration is a CalibrationInfo model, we should properly damp it.
        def _dump_obj(obj):
            if hasattr(obj, 'model_dump'):
                return obj.model_dump()
            return obj
        clean_resp = {k: _dump_obj(v) for k, v in response.items()}
        (job_dir / "result.json").write_text(json.dumps(clean_resp))
    except Exception as e:
        update_job_status(job_id, "failed")
        (job_dir / "error.txt").write_text(str(e))

@app.post("/jobs")
async def create_job(background_tasks: BackgroundTasks, file: UploadFile = File(...), srtm_file: UploadFile | None = File(None)):
    db = SessionLocal()
    try:
        job_id = create_job_record(db, input_type="upload")
    finally:
        db.close()
    
    job_dir = OUTPUTS_DIR / job_id
    raw_path = job_dir / file.filename
    raw_path.write_bytes(await file.read())

    local_dem_path = None
    if srtm_file is not None:
        local_dem_path = str(job_dir / srtm_file.filename)
        Path(local_dem_path).write_bytes(await srtm_file.read())
        
    model = get_model()
    background_tasks.add_task(run_job_background, job_id, job_dir, raw_path, local_dem_path, model)
    return {"job_id": job_id}

@app.post("/fetch-area", response_model=PredictResponse)
def fetch_area_endpoint(req: FetchAreaRequest):
    from services.area_fetch import fetch_area_rgb
    
    job_id = uuid.uuid4().hex[:12]
    job_dir = OUTPUTS_DIR / job_id
    job_dir.mkdir()
    
    date_range = "2023-01-01/2026-12-31"
    if req.date_from and req.date_to:
        date_range = f"{req.date_from}/{req.date_to}"
        
    out_tif = str(job_dir / "scene.tif")
    fetch_area_rgb([req.west, req.south, req.east, req.north], out_tif, date_range)
    
    return run_inference_core(job_id, job_dir, Path(out_tif), None, get_model())

@app.post("/jobs/fetch-area")
def create_job_fetch_area(background_tasks: BackgroundTasks, req: FetchAreaRequest):
    db = SessionLocal()
    from services.jobs import create_job_record
    try:
        job_id = create_job_record(db, input_type="fetch-area")
    finally:
        db.close()
    
    job_dir = OUTPUTS_DIR / job_id
    job_dir.mkdir()
    
    def background_fetch_and_run():
        update_job_status(job_id, "ingesting")
        try:
            from services.area_fetch import fetch_area_rgb
            date_range = "2023-01-01/2026-12-31"
            if req.date_from and req.date_to:
                date_range = f"{req.date_from}/{req.date_to}"
            out_tif = str(job_dir / "scene.tif")
            fetch_area_rgb([req.west, req.south, req.east, req.north], out_tif, date_range)
            model = get_model()
            # Reuse the background task logic
            # set status ingesting is bypassed since run_job_background does it again, that's fine
            run_job_background(job_id, job_dir, Path(out_tif), None, model)
        except Exception as e:
            update_job_status(job_id, "failed")
            (job_dir / "error.txt").write_text(str(e))
    
    background_tasks.add_task(background_fetch_and_run)
    return {"job_id": job_id}

@app.get("/jobs/{job_id}/status", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    db = SessionLocal()
    try:
        analysis = db.query(Analysis).filter(Analysis.id == job_id).first()
        if not analysis:
            raise HTTPException(status_code=404, detail="Job not found")
        
        status = analysis.status
        progress = 0
        if status == "ingesting": progress = 10
        elif status == "calibrating": progress = 50
        elif status == "done": progress = 100
        elif status == "failed": progress = 0
        
        result_dict = None
        if status == "done":
            result_file = OUTPUTS_DIR / job_id / "result.json"
            if result_file.exists():
                result_dict = json.loads(result_file.read_text())
                
        return JobStatusResponse(
            job_id=job_id,
            status=status,
            progress=progress,
            result=result_dict
        )
    finally:
        db.close()


@app.get("/validate/{job_id}", response_model=ValidateResponse)
def validate(job_id: str):
    job_dir = OUTPUTS_DIR / job_id
    height_path = job_dir / "height.npy"
    srtm_path = job_dir / "srtm_reference.npy"

    if not height_path.exists() or not srtm_path.exists():
        raise HTTPException(
            status_code=404,
            detail="No reference data for this job (only georeferenced/GeoTIFF jobs can be validated against SRTM)",
        )

    predicted = np.load(height_path)
    reference = np.load(srtm_path)

    diff = predicted - reference
    rmse = float(np.sqrt(np.mean(diff ** 2)))
    mae = float(np.mean(np.abs(diff)))
    correlation = float(np.corrcoef(predicted.ravel(), reference.ravel())[0, 1])
    bias = float(np.mean(diff))

    return ValidateResponse(rmse=rmse, mae=mae, correlation=correlation, bias=bias, n_points=int(predicted.size))
