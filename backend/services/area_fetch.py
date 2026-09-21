import os
from pystac_client import Client
import planetary_computer
import rasterio
from rasterio.windows import from_bounds
import warnings
from fastapi import HTTPException
import numpy as np

def fetch_area_rgb(bounds_wgs84: list[float], output_path: str, date_range: str = "2023-01-01/2026-12-31") -> str:
    west, south, east, north = bounds_wgs84
    
    # 1. Search planetary computer
    catalog = Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1",
        modifier=planetary_computer.sign_inplace
    )
    
    search = catalog.search(
        collections=["sentinel-2-l2a"],
        bbox=bounds_wgs84,
        datetime=date_range,
        query={"eo:cloud_cover": {"lt": 20}}  # Max 20% cloud cover for scene
    )
    
    items = list(search.items())
    if not items:
        # Fallback to broader time/clouds if nothing found
        search = catalog.search(
            collections=["sentinel-2-l2a"],
            bbox=bounds_wgs84,
            datetime="2020-01-01/2026-12-31"
        )
        items = list(search.items())
        
    if not items:
        raise HTTPException(status_code=404, detail="No imagery found for this area.")
        
    # Pick least cloudy
    best_item = min(items, key=lambda item: item.properties.get("eo:cloud_cover", 100))
    
    assets = [best_item.assets["B04"].href, best_item.assets["B03"].href, best_item.assets["B02"].href]
    
    # We must read these assets and window them to the bbox
    # Sentinel-2 data is projected, so we need to project our wgs84 bbox to its CRS or warp.
    # To keep it simple without warping during load: read the area overlapping the WGS84 bbox
    import rasterio.warp
    
    with rasterio.open(assets[0]) as src:
        # Get bounding box in source CRS
        left, bottom, right, top = rasterio.warp.transform_bounds("EPSG:4326", src.crs, west, south, east, north)
        window = from_bounds(left, bottom, right, top, transform=src.transform)
        # expand window to integers
        window = window.round_offsets().round_shape()
        
        # Read the 3 bands
        b04 = src.read(1, window=window)
        out_transform = src.window_transform(window)
        out_crs = src.crs

    with rasterio.open(assets[1]) as src: b03 = src.read(1, window=window)
    with rasterio.open(assets[2]) as src: b02 = src.read(1, window=window)
        
    # Scale to 8-bit RGB (Sentinel-2 L2A is 10000 = reflectance 1.0)
    # Brightness adjustment for visualization
    def to_uint8(band):
        b = np.clip(band / 3000.0 * 255, 0, 255).astype(np.uint8)
        return b
        
    rgb = np.stack([to_uint8(b04), to_uint8(b03), to_uint8(b02)], axis=0)
    
    # Save GeoTIFF
    profile = {
        "driver": "GTiff",
        "height": rgb.shape[1],
        "width": rgb.shape[2],
        "count": 3,
        "dtype": rasterio.uint8,
        "crs": out_crs,
        "transform": out_transform,
        "photometric": "RGB",
        "compress": "lzw"
    }
    
    with rasterio.open(output_path, "w", **profile) as dst:
        dst.write(rgb)
        
    return output_path
