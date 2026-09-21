import sys
from pathlib import Path

# Make sure `backend/` is on the path so `from app import app` works
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
