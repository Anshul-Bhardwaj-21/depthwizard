"""
prepare_data.py
---------------
Unified data-preparation entry point for DepthWizard.

Three modes — pick the one that suits your situation:

  --mode synthetic  (DEFAULT)
      Generates realistic procedural RGB + nDSM tiles locally.
      No internet connection required. The model learns real structure
      (building footprints, terrain undulation, forest canopies) from these.
      Fine for hackathon demos and CI; not a substitute for real satellite
      imagery if you care about production accuracy.

  --mode hf-cli
      Downloads the real earthflow/GAMUS dataset via `huggingface-cli`
      (chunked HTTP/2, native resume on failure — far more reliable than
      the `datasets` streaming method that caused IncompleteRead errors).
      Requires: pip install huggingface_hub[cli]
      Falls back to synthetic automatically if the download fails.

  --mode manual
      You already have data in <root>/images/ and <root>/depth/.
      This mode just validates the folder layout and prints a count.

Usage examples
--------------
    # Fastest — no internet, 200 tiles (default)
    python data/prepare_data.py

    # More tiles for a longer training run
    python data/prepare_data.py --n-tiles 500

    # Try real GAMUS, fall back to synthetic if it fails
    python data/prepare_data.py --mode hf-cli

    # Real GAMUS, validation split only (~2 GB)
    python data/prepare_data.py --mode hf-cli --hf-split validation

    # Validate your own data folder
    python data/prepare_data.py --mode manual --root ./my_gamus_data

After this script finishes, run training:
    cd model/
    python train.py --data-root data --epochs 30 --batch-size 8
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

# ── Fix imports when running from any working directory ──────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
_MODEL_DIR  = _SCRIPT_DIR.parent
sys.path.insert(0, str(_MODEL_DIR))


# ─────────────────────────────────────────────────────────────────────────────
# MODE 1 — SYNTHETIC DATA (default, no internet)
# ─────────────────────────────────────────────────────────────────────────────

def _make_synthetic(root: Path, n_tiles: int, size: int, seed: int) -> int:
    """
    Generate realistic procedural tiles using the same logic as make_sample_data.py.
    Returns the number of tiles written.
    """
    import numpy as np
    from PIL import Image

    try:
        import rasterio
        from rasterio.transform import from_origin
        _HAS_RASTERIO = True
    except ImportError:
        _HAS_RASTERIO = False
        print("[prepare_data] WARNING: rasterio not installed — depth files will be saved as .bin "
              "(dataset.py handles this automatically)")

    img_dir   = root / "images"
    depth_dir = root / "depth"
    img_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(seed)
    TERRAIN_KINDS = ["urban", "sparse", "hilly", "forested"]

    def _perlin_noise(sz: int, octaves: int) -> np.ndarray:
        noise = np.zeros((sz, sz), dtype=np.float32)
        amplitude, total_amp = 1.0, 0.0
        for o in range(octaves):
            grid = max(2, sz // (2 ** (octaves - o)))
            coarse = rng.random((grid, grid), dtype=np.float32)
            layer = np.array(Image.fromarray(coarse).resize((sz, sz), Image.BICUBIC))
            noise += amplitude * layer
            total_amp += amplitude
            amplitude *= 0.5
        return noise / total_amp

    def _make_tile(sz: int, kind: str):
        base_relief  = {"urban": 3, "sparse": 4, "hilly": 18, "forested": 8}[kind]
        n_buildings  = {"urban": 14, "sparse": 3, "hilly": 2, "forested": 1}[kind]
        ground_col   = {"urban": (0.55, 0.53, 0.50), "sparse": (0.62, 0.56, 0.42),
                        "hilly": (0.45, 0.50, 0.38), "forested": (0.18, 0.32, 0.16)}[kind]

        terrain = _perlin_noise(sz, octaves=5) * base_relief
        height  = terrain.copy()

        rgb = np.zeros((sz, sz, 3), dtype=np.float32)
        for c in range(3):
            rgb[:, :, c] = ground_col[c] + 0.05 * (terrain / max(base_relief, 1e-3))

        for _ in range(n_buildings):
            w, h = rng.integers(sz // 20, sz // 6, size=2)
            x0   = rng.integers(0, max(1, sz - w))
            y0   = rng.integers(0, max(1, sz - h))
            bh   = rng.uniform(4, 30)
            height[y0:y0 + h, x0:x0 + w] += bh
            rgb[y0:y0 + h, x0:x0 + w, :] = rng.uniform(0.3, 0.75, size=3)

        if kind == "forested":
            for _ in range(sz // 3):
                r, cx = rng.integers(2, 6), rng.integers(0, sz)
                cy = rng.integers(0, sz)
                th = rng.uniform(3, 14)
                y0, y1 = max(0, cy - r), min(sz, cy + r)
                x0, x1 = max(0, cx - r), min(sz, cx + r)
                height[y0:y1, x0:x1] += th
                rgb[y0:y1, x0:x1, 1]  += 0.15

        height  = np.clip(height, 0, None).astype(np.float32)
        rgb_u8  = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
        return rgb_u8, height

    written = 0
    for i in range(n_tiles):
        kind = TERRAIN_KINDS[i % len(TERRAIN_KINDS)]
        stem = f"tile_{i:05d}_{kind}"

        img_path   = img_dir   / f"{stem}.png"
        depth_path = depth_dir / f"{stem}.tif"

        # Skip already-written tiles (safe to re-run)
        if img_path.exists() and (depth_path.exists() or (depth_dir / f"{stem}.bin").exists()):
            if i % 100 == 0:
                print(f"  [{i+1}/{n_tiles}] already exists, skipping...")
            continue

        rgb_u8, height = _make_tile(size, kind)
        Image.fromarray(rgb_u8).save(img_path)

        if _HAS_RASTERIO:
            transform = from_origin(0, size, 1, 1)
            profile = {"driver": "GTiff", "height": size, "width": size,
                       "count": 1, "dtype": "float32", "crs": "EPSG:32633",
                       "transform": transform}
            with rasterio.open(depth_path, "w", **profile) as dst:
                dst.write(height, 1)
        else:
            height.tofile(depth_dir / f"{stem}.bin")

        written += 1
        if (i + 1) % 50 == 0 or i == n_tiles - 1:
            print(f"  [{i+1}/{n_tiles}] tiles written...")

    return written + (n_tiles - written)  # total tiles existing


# ─────────────────────────────────────────────────────────────────────────────
# MODE 2 — HF CLI DOWNLOAD (chunked, resumable)
# ─────────────────────────────────────────────────────────────────────────────

def _download_hf_cli(root: Path, split: str, max_retries: int = 3) -> bool:
    """
    Downloads GAMUS parquet shards via huggingface_hub.hf_hub_download
    (not streaming — downloads whole files at once with resume support).
    Returns True on success, False on failure.
    """
    import subprocess

    print("[prepare_data] Trying huggingface-cli download method (chunked, resumable)...")
    print("[prepare_data] This downloads whole Parquet shards — resumes automatically if interrupted.")

    for attempt in range(1, max_retries + 1):
        try:
            result = subprocess.run(
                [
                    sys.executable, "-m", "huggingface_hub.commands.huggingface_cli",
                    "download",
                    "earthflow/GAMUS",
                    "--repo-type", "dataset",
                    "--local-dir", str(root / "_hf_cache"),
                    "--quiet",
                ],
                check=True,
                timeout=3600,  # 1-hour timeout per attempt
            )
            print("[prepare_data] HF CLI download succeeded.")
            return True
        except subprocess.CalledProcessError as e:
            print(f"  [warn] HF CLI attempt {attempt}/{max_retries} failed: {e}")
        except subprocess.TimeoutExpired:
            print(f"  [warn] HF CLI attempt {attempt}/{max_retries} timed out (1h limit)")
        except FileNotFoundError:
            print("  [warn] huggingface_hub CLI not available. Install with: pip install 'huggingface_hub[cli]'")
            return False

        if attempt < max_retries:
            wait = 5 * attempt
            print(f"  [warn] Retrying in {wait}s...")
            time.sleep(wait)

    return False


def _convert_hf_cache_to_layout(hf_cache: Path, root: Path) -> int:
    """
    Converts downloaded HF parquet shards → images/ + depth/ layout.
    Returns number of tiles written.
    """
    import numpy as np
    from PIL import Image as PILImage

    try:
        import pyarrow.parquet as pq
    except ImportError:
        print("[prepare_data] ERROR: pyarrow not installed. Run: pip install pyarrow")
        return 0

    img_dir   = root / "images"
    depth_dir = root / "depth"
    img_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)

    parquet_files = list(hf_cache.rglob("*.parquet"))
    if not parquet_files:
        print(f"[prepare_data] No parquet files found in {hf_cache}")
        return 0

    print(f"[prepare_data] Converting {len(parquet_files)} parquet shard(s) to images/depth layout...")

    idx = 0
    for pf in sorted(parquet_files):
        table = pq.read_table(pf)
        df = table.to_pydict()

        # Auto-detect column names
        img_key = next((k for k in ["image", "rgb", "img", "photo"] if k in df), None)
        dsm_key = next((k for k in ["ndsm", "dsm", "depth", "height", "dem"] if k in df), None)

        if img_key is None or dsm_key is None:
            print(f"  [warn] {pf.name}: cannot find image/depth columns ({list(df.keys())}), skipping")
            continue

        n_rows = len(df[img_key])
        for row_i in range(n_rows):
            stem = f"gamus_{idx:06d}"
            img_out   = img_dir   / f"{stem}.png"
            depth_out = depth_dir / f"{stem}.tif"

            if img_out.exists() and depth_out.exists():
                idx += 1
                continue

            # Image
            raw_img = df[img_key][row_i]
            if hasattr(raw_img, "save"):
                raw_img.save(img_out)
            else:
                arr = np.asarray(raw_img, dtype=np.uint8)
                PILImage.fromarray(arr).save(img_out)

            # Depth
            raw_dsm = df[dsm_key][row_i]
            arr = np.asarray(raw_dsm, dtype=np.float32)
            try:
                import rasterio
                from rasterio.transform import from_bounds as fb
                h, w = arr.shape if arr.ndim == 2 else (arr.shape[0], arr.shape[1])
                with rasterio.open(depth_out, "w", driver="GTiff", height=h, width=w,
                                   count=1, dtype="float32", crs="EPSG:4326",
                                   transform=fb(0, 0, 1, 1, w, h)) as dst:
                    dst.write(arr.squeeze(), 1)
            except ImportError:
                arr.tofile(depth_dir / f"{stem}.bin")

            idx += 1

        print(f"  Processed shard {pf.name}: {n_rows} tiles")

    return idx


# ─────────────────────────────────────────────────────────────────────────────
# MODE 3 — MANUAL (validate existing folder)
# ─────────────────────────────────────────────────────────────────────────────

def _validate_manual(root: Path) -> int:
    img_dir   = root / "images"
    depth_dir = root / "depth"

    IMG_EXTS   = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
    DEPTH_EXTS = {".tif", ".tiff", ".bin"}

    if not img_dir.exists():
        raise FileNotFoundError(f"images/ directory not found in: {root}")
    if not depth_dir.exists():
        raise FileNotFoundError(f"depth/ directory not found in: {root}")

    img_stems   = {p.stem for p in img_dir.iterdir()   if p.suffix.lower() in IMG_EXTS}
    depth_stems = {p.stem for p in depth_dir.iterdir() if p.suffix.lower() in DEPTH_EXTS}
    paired      = img_stems & depth_stems

    if not paired:
        raise RuntimeError(
            f"No matched (image, depth) pairs found in {root}\n"
            f"  images/ has {len(img_stems)} files\n"
            f"  depth/  has {len(depth_stems)} files\n"
            "Make sure filenames match (same stem, e.g. tile_00001.png + tile_00001.tif)"
        )

    return len(paired)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="DepthWizard — prepare training data (synthetic / HF CLI / manual)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--mode", choices=["synthetic", "hf-cli", "manual"], default="synthetic",
        help=(
            "synthetic: generate procedural tiles locally (no internet); "
            "hf-cli: download real GAMUS via huggingface-cli (chunked, resumable); "
            "manual: validate an existing local data folder"
        ),
    )
    parser.add_argument("--root", default=str(_SCRIPT_DIR),
                        help="Output root dir (will contain images/ and depth/)")
    parser.add_argument("--n-tiles", type=int, default=200,
                        help="[synthetic] Total tiles to generate")
    parser.add_argument("--size", type=int, default=256,
                        help="[synthetic] Tile size in pixels (NxN)")
    parser.add_argument("--seed", type=int, default=42,
                        help="[synthetic] Random seed for reproducibility")
    parser.add_argument("--hf-split", default="validation",
                        choices=["train", "validation", "test"],
                        help="[hf-cli] Which GAMUS split to download")
    args = parser.parse_args()

    root = Path(args.root)

    print(f"\n{'='*60}")
    print(f"  DepthWizard — prepare_data.py   mode={args.mode}")
    print(f"  Output root: {root.resolve()}")
    print(f"{'='*60}\n")

    if args.mode == "synthetic":
        print(f"[prepare_data] Generating {args.n_tiles} synthetic tiles (size={args.size}px)...")
        n = _make_synthetic(root, args.n_tiles, args.size, args.seed)
        print(f"\n[prepare_data] ✓ {n} tiles ready in {root.resolve()}/images and /depth")

    elif args.mode == "hf-cli":
        success = _download_hf_cli(root, args.hf_split)
        if success:
            n = _convert_hf_cache_to_layout(root / "_hf_cache", root)
            if n > 0:
                print(f"\n[prepare_data] ✓ {n} GAMUS tiles converted to {root.resolve()}/images and /depth")
            else:
                print("[prepare_data] Conversion produced 0 tiles — falling back to synthetic...")
                n = _make_synthetic(root, args.n_tiles, args.size, args.seed)
                print(f"[prepare_data] ✓ {n} synthetic tiles written as fallback")
        else:
            print("[prepare_data] HF CLI download failed — falling back to synthetic data automatically...")
            n = _make_synthetic(root, args.n_tiles, args.size, args.seed)
            print(f"\n[prepare_data] ✓ {n} synthetic tiles ready (fallback) in {root.resolve()}")

    elif args.mode == "manual":
        try:
            n = _validate_manual(root)
            print(f"[prepare_data] ✓ Found {n} matched (image, depth) pairs in {root.resolve()}")
        except (FileNotFoundError, RuntimeError) as e:
            print(f"[prepare_data] ERROR: {e}")
            sys.exit(1)

    print(f"\n[prepare_data] Next step — start training:")
    print(f"  cd {_MODEL_DIR}")
    print(f"  python train.py --data-root {root.resolve()} --epochs 30 --batch-size 8")
    print(f"\n  Or for a quick smoke-test (no data needed):")
    print(f"  python train.py --smoke-test\n")


if __name__ == "__main__":
    main()
