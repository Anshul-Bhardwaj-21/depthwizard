from typing import Optional

from pydantic import BaseModel


class CalibrationInfo(BaseModel):
    scale: float
    offset: float
    inlier_fraction: float


class PredictResponse(BaseModel):
    job_id: str
    mode: str  # "relative" | "absolute"
    georeferenced: bool
    height_map_url: str
    texture_url: str
    bounds_wgs84: Optional[list[float]] = None
    calibration: Optional[CalibrationInfo] = None


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    result: Optional[PredictResponse] = None

class AnalysisResponse(BaseModel):
    id: str
    name: Optional[str] = None
    created_at: str
    status: str
    input_type: str
    bounds: Optional[list[float]] = None
    thumbnail_path: Optional[str] = None
    metrics: Optional[dict] = None
    model_version: Optional[str] = None

class FetchAreaRequest(BaseModel):
    west: float
    south: float
    east: float
    north: float
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class ValidateRequest(BaseModel):
    job_id: str

class ValidateResponse(BaseModel):
    rmse: float
    mae: float
    correlation: float
    bias: float
    n_points: int
