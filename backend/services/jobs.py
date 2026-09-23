import asyncio
import uuid
import json
from pathlib import Path
from sqlalchemy.orm import Session
from .db import Analysis, SessionLocal

OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "job_outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

def create_job_record(db: Session, input_type: str) -> str:
    job_id = uuid.uuid4().hex[:12]
    analysis = Analysis(
        id=job_id,
        name=f"Analysis {job_id}",
        status="queued",
        input_type=input_type
    )
    db.add(analysis)
    db.commit()
    
    job_dir = OUTPUTS_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    return job_id

def update_job_status(job_id: str, status: str, metrics: dict = None, bounds: list = None, thumbnail_path: str = None):
    db = SessionLocal()
    try:
        analysis = db.query(Analysis).filter(Analysis.id == job_id).first()
        if analysis:
            analysis.status = status
            if metrics is not None:
                analysis.metrics = json.dumps(metrics)
            if bounds is not None:
                analysis.bounds = json.dumps(bounds)
            if thumbnail_path is not None:
                analysis.thumbnail_path = thumbnail_path
            db.commit()
    finally:
        db.close()

# The actual background task function will be defined in app.py or a worker file,
# since it needs to call predict logic.
