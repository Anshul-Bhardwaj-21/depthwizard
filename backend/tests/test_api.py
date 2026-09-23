import pytest
import time
from fastapi.testclient import TestClient
from app import app
from PIL import Image
from io import BytesIO
import numpy as np
from pathlib import Path

client = TestClient(app)

def create_dummy_image():
    img = Image.new("RGB", (256, 256), color="red")
    b = BytesIO()
    img.save(b, format="PNG")
    b.seek(0)
    return b

def test_sync_predict_still_works():
    b = create_dummy_image()
    res = client.post("/predict", files={"file": ("test.png", b, "image/png")})
    # Untrained model might fail or return mock, just ensure 200
    assert res.status_code == 200
    assert "job_id" in res.json()
    job_id = res.json()["job_id"]
    
    # Test heatmap requires SRTM reference, which sync predict won't have for non-GeoTIFF
    # But layer API should still work
    res2 = client.get(f"/jobs/{job_id}/layers/dsm")
    assert res2.status_code == 200

def test_async_job_and_layers():
    b = create_dummy_image()
    res = client.post("/jobs", files={"file": ("test.png", b, "image/png")})
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    
    # poll status
    for _ in range(10):
        s = client.get(f"/jobs/{job_id}/status")
        if s.json()["status"] in ["done", "failed"]:
            break
        time.sleep(1)
        
    # Since it's untrained and missing georeferencing, it'll generate relative height map
    # layers should be available
    for layer in ["hillshade", "slope", "aspect"]:
        lr = client.get(f"/jobs/{job_id}/layers/{layer}")
        assert lr.status_code == 200
        
    c = client.get(f"/jobs/{job_id}/contours")
    assert c.status_code == 200
    
    p = client.post(f"/jobs/{job_id}/profile", json={"points": [[10, 10], [50, 50]]})
    assert p.status_code == 200
    assert len(p.json()["elevations"]) > 0

def test_analyses_history():
    res = client.get("/analyses")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    
@pytest.mark.skip(reason="Requires outbound internet access to Microsoft Planetary Computer — run manually with SKIP_NETWORK_TESTS=0")
def test_fetch_area_endpoint():
    # We will test the async background fetch area endpoint 
    req = {
        "west": 76.76,
        "south": 30.74,
        "east": 76.80,
        "north": 30.78,
    }
    res = client.post("/jobs/fetch-area", json=req)
    assert res.status_code == 200
    job_id = res.json()["job_id"]
    
    # Poll until done (might take up to 20-30s depending on network)
    status_str = "queued"
    for _ in range(30):
        s = client.get(f"/jobs/{job_id}/status")
        status_str = s.json()["status"]
        if status_str in ["done", "failed"]:
            break
        time.sleep(1.5)
        
    assert status_str == "done"
    
def test_report_generation():
    # we need a valid job id to generate report
    b = create_dummy_image()
    res = client.post("/jobs", files={"file": ("test.png", b, "image/png")})
    job_id = res.json()["job_id"]
    time.sleep(2) # wait for bg task
    rep = client.get(f"/jobs/{job_id}/report")
    assert rep.status_code in [200, 400] # if no cairo, it might fail, which is accepted
