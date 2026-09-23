"""
make_sample_data.py
--------------------
Generates a small SYNTHETIC dataset in the exact folder layout GAMUSDataset
expects (images/*.png + depth/*.tif), so you can run train.py immediately
without waiting on a GAMUS download. It is NOT real remote-sensing data --
it procedurally paints "buildings" (bright rectangles) and "terrain undulation"
(smooth noise) onto each tile and writes the true height used to generate
them as the depth file, so the correlation is real and the model has
something genuine to learn during a smoke run. Accuracy numbers from a model
trained only on this will not mean anything about real-world performance --
swap this folder for real GAMUS tiles (same layout) before you trust results.

Usage:
    python make_sample_data.py --root ./data --n-train 160 --n-val 20 --size 256
"""

import argparse
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import from_origin
from PIL import Image


def perlin_like_noise(size: int, octaves: int, rng: np.random.Generator) -> np.ndarray:
    """Cheap multi-octave value noise (no external noise lib needed)."""
    noise = np.zeros((size, size), dtype=np.float32)
    amplitude = 1.0
    total_amp = 0.0
    for o in range(octaves):
        grid = max(2, size // (2 ** (octaves - o)))
        coarse = rng.random((grid, grid), dtype=np.float32)
        layer = np.array(Image.fromarray(coarse).resize((size, size), Image.BICUBIC))
        noise += amplitude * layer
        total_amp += amplitude
        amplitude *= 0.5
    return noise / total_amp


def make_tile(size: int, rng: np.random.Generator, terrain_kind: str):
    """
    Returns (rgb uint8 HxWx3, height float32 HxW in metres).
    terrain_kind in {"urban", "sparse", "hilly", "forested"} biases the mix,
    loosely echoing the PS's evaluation categories.
    """
    base_relief = {"urban": 3, "sparse": 4, "hilly": 18, "forested": 8}[terrain_kind]
    n_buildings = {"urban": 14, "sparse": 3, "hilly": 2, "forested": 1}[terrain_kind]

    terrain = perlin_like_noise(size, octaves=5, rng=rng) * base_relief
    height = terrain.copy()

    rgb = np.zeros((size, size, 3), dtype=np.float32)
    # base ground colour varies a little by terrain kind
    ground_colour = {
        "urban": (0.55, 0.53, 0.5),
        "sparse": (0.62, 0.56, 0.42),
        "hilly": (0.45, 0.5, 0.38),
        "forested": (0.18, 0.32, 0.16),
    }[terrain_kind]
    for c in range(3):
        rgb[:, :, c] = ground_colour[c] + 0.05 * (terrain / max(base_relief, 1e-3))

    for _ in range(n_buildings):
        w, h = rng.integers(size // 20, size // 6, size=2)
        x0 = rng.integers(0, max(1, size - w))
        y0 = rng.integers(0, max(1, size - h))
        bh = rng.uniform(4, 30)  # building height in metres
        height[y0:y0 + h, x0:x0 + w] += bh
        roof_colour = rng.uniform(0.3, 0.75, size=3)
        rgb[y0:y0 + h, x0:x0 + w, :] = roof_colour

    if terrain_kind == "forested":
        n_trees = size // 3
        for _ in range(n_trees):
            r, cx = rng.integers(2, 6), rng.integers(0, size)
            cy = rng.integers(0, size)
            th = rng.uniform(3, 14)
            y0, y1 = max(0, cy - r), min(size, cy + r)
            x0, x1 = max(0, cx - r), min(size, cx + r)
            height[y0:y1, x0:x1] += th
            rgb[y0:y1, x0:x1, 1] += 0.15

    height = np.clip(height, 0, None).astype(np.float32)
    rgb = np.clip(rgb, 0, 1)
    rgb_uint8 = (rgb * 255).astype(np.uint8)
    return rgb_uint8, height


def write_tile(root: Path, split_stem: str, rgb: np.ndarray, height: np.ndarray, size: int):
    img_dir = root / "images"
    depth_dir = root / "depth"
    img_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)

    Image.fromarray(rgb).save(img_dir / f"{split_stem}.png")

    # arbitrary local transform (1 pixel = 1 metre) -- fine for a synthetic
    # smoke-test tile; real GAMUS/GeoTIFF tiles carry their own real CRS.
    transform = from_origin(0, size, 1, 1)
    profile = {
        "driver": "GTiff",
        "height": size,
        "width": size,
        "count": 1,
        "dtype": "float32",
        "crs": "EPSG:32633",
        "transform": transform,
    }
    with rasterio.open(depth_dir / f"{split_stem}.tif", "w", **profile) as dst:
        dst.write(height, 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="data")
    parser.add_argument("--n-train", type=int, default=160)
    parser.add_argument("--n-val", type=int, default=20)
    parser.add_argument("--size", type=int, default=256)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()

    rng = np.random.default_rng(args.seed)
    root = Path(args.root)
    kinds = ["urban", "sparse", "hilly", "forested"]

    total = args.n_train + args.n_val
    for i in range(total):
        kind = kinds[i % len(kinds)]
        rgb, height = make_tile(args.size, rng, kind)
        write_tile(root, f"tile_{i:04d}_{kind}", rgb, height, args.size)

    print(f"[make_sample_data] wrote {total} synthetic tiles to {root}/images and {root}/depth "
          f"(mix of {kinds})")


if __name__ == "__main__":
    main()
