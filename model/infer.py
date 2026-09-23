"""
infer.py
--------
End-to-end single-image inference:
  1. load RGB, run HeightUNet -> relative height map
  2. if the input is a GeoTIFF (has CRS/transform), fetch SRTM + calibrate
     to metric elevation; otherwise return the relative map as-is
  3. save outputs the backend / frontend can consume

Usage:
    python infer.py --checkpoint checkpoints/best.pt --input scene.tif --out-dir outputs/
    python infer.py --checkpoint checkpoints/best.pt --input scene.png --out-dir outputs/
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from unet import HeightUNet
from calibrate import calibrate_scale, fetch_srtm_tile


def load_model(checkpoint_path: str, device: str = "cpu") -> HeightUNet:
    model = HeightUNet(pretrained=False)
    state = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(state)
    model.eval()
    return model.to(device)


def predict_relative_height(model: HeightUNet, rgb: np.ndarray, device: str = "cpu") -> np.ndarray:
    """rgb: HxWx3 float32 in [0, 1]. Returns HxW relative height."""
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float().to(device)
    with torch.no_grad():
        out = model(tensor)
    return out.squeeze().cpu().numpy()


def is_georeferenced(path: str) -> bool:
    import warnings
    try:
        import rasterio
        from rasterio.errors import NotGeoreferencedWarning
        with warnings.catch_warnings():
            # plain PNG/JPG legitimately have no CRS -- that's the expected
            # "not georeferenced" case, not something worth surfacing
            warnings.simplefilter("ignore", NotGeoreferencedWarning)
            with rasterio.open(path) as src:
                return src.crs is not None
    except Exception:
        return False


def get_bounds_wgs84(path: str):
    import rasterio
    from rasterio.warp import transform_bounds

    with rasterio.open(path) as src:
        return transform_bounds(src.crs, "EPSG:4326", *src.bounds)


def run(args):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = load_model(args.checkpoint, device)

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(args.input).convert("RGB").resize((args.image_size, args.image_size), Image.BILINEAR)
    rgb = np.asarray(img, dtype=np.float32) / 255.0

    relative_height = predict_relative_height(model, rgb, device)

    result = {"input": args.input, "mode": "relative", "georeferenced": False}

    if is_georeferenced(args.input):
        try:
            bounds = get_bounds_wgs84(args.input)
            srtm_path = fetch_srtm_tile(
                bounds,
                output_path=str(out_dir / "srtm_tile.tif"),
                local_dem_path=args.srtm_path,
            )

            import rasterio
            from rasterio.warp import reproject, Resampling
            from rasterio.transform import from_bounds as transform_from_bounds

            west, south, east, north = bounds
            dst_transform = transform_from_bounds(west, south, east, north, args.image_size, args.image_size)

            with rasterio.open(srtm_path) as srtm_src:
                srtm_arr = np.zeros((args.image_size, args.image_size), dtype=np.float32)
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
            absolute_height = calib.apply(relative_height)

            np.save(out_dir / "height_absolute_m.npy", absolute_height)
            result.update({
                "mode": "absolute",
                "georeferenced": True,
                "bounds_wgs84": bounds,
                "calibration": {
                    "scale": calib.scale,
                    "offset": calib.offset,
                    "inlier_fraction": calib.inlier_fraction,
                },
            })
        except Exception as exc:  # noqa: BLE001
            print(f"[infer] calibration failed ({exc}), falling back to relative height")

    np.save(out_dir / "height_relative.npy", relative_height)

    # normalized preview PNG for quick viewing / for the frontend heightmap
    preview = (relative_height - relative_height.min()) / (np.ptp(relative_height) + 1e-6)
    Image.fromarray((preview * 255).astype(np.uint8)).save(out_dir / "height_preview.png")
    img.save(out_dir / "texture.png")

    with open(out_dir / "result.json", "w") as f:
        json.dump(result, f, indent=2)

    print(f"[infer] wrote outputs to {out_dir}/ (mode={result['mode']})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--out-dir", default="outputs")
    parser.add_argument("--image-size", type=int, default=256)
    parser.add_argument("--srtm-path", default=None,
                         help="Use a local DEM GeoTIFF instead of fetching SRTM over the network (offline/pre-downloaded DEM)")
    run(parser.parse_args())
