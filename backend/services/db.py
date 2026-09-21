import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import Column, String, DateTime, MetaData, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Setup SQLite DB in backend directory
DB_PATH = Path(__file__).resolve().parent.parent / "analyses.db"
engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String, default="queued")
    input_type = Column(String)  # 'upload' or 'fetch-area'
    bounds = Column(String, nullable=True)  # JSON-encoded array [west, south, east, north]
    thumbnail_path = Column(String, nullable=True)
    metrics = Column(String, nullable=True)  # JSON-encoded dict
    model_version = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
