"""
make_sample_geotiff.py
-----------------------
Generates one small synthetic GEOREFERENCED RGB tile plus a matching local
"DEM" tile with real CRS/transform metadata, so you can exercise the full
GeoTIFF -> scale-calibration path (infer.py --srtm-path ...) without needing
network access to a real DEM provider. Like make_sample_data.py, this is
synthetic, not a real place -- swap in a real GeoTIFF + a real SRTM fetch
(drop --srtm-path) once you're past the "does the wiring work" stage.

Usage:
    python make_sample_geotiff.py --out-dir sample_geotiff --size 128
"""

import argparse
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin

from make_sample_data import make_tile  # reuse the same procedural generator


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default="sample_geotiff")
    parser.add_argument("--size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(args.seed)
    rgb, height = make_tile(args.size, rng, terrain_kind="urban")

    # arbitrary but real-looking WGS84 bounds (~1.2km x 1.2km tile, roughly
    # Chandigarh's longitude/latitude, purely for a plausible demo)
    west, south, east, north = 76.760, 30.740, 76.772, 30.752
    transform = rasterio.transform.from_bounds(west, south, east, north, args.size, args.size)

    rgb_profile = {
        "driver": "GTiff", "height": args.size, "width": args.size, "count": 3,
        "dtype": "uint8", "crs": "EPSG:4326", "transform": transform,
    }
    with rasterio.open(out_dir / "scene.tif", "w", **rgb_profile) as dst:
        for b in range(3):
            dst.write(rgb[:, :, b], b + 1)

    # "local DEM": ground-only elevation (buildings stripped out) plus a
    # constant base offset, mimicking a coarse real-world SRTM tile where
    # building rooftops don't show up, only terrain
    ground_only = height.copy()
    base_offset = 240.0  # metres above sea level, arbitrary
    dem_profile = {
        "driver": "GTiff", "height": args.size, "width": args.size, "count": 1,
        "dtype": "float32", "crs": "EPSG:4326", "transform": transform,
    }
    with rasterio.open(out_dir / "local_dem.tif", "w", **dem_profile) as dst:
        dst.write((ground_only * 0.3 + base_offset).astype(np.float32), 1)  # coarser relief than the "true" heights

    print(f"[make_sample_geotiff] wrote {out_dir}/scene.tif (georeferenced RGB) "
          f"and {out_dir}/local_dem.tif (matching local DEM)")


if __name__ == "__main__":
    main()
