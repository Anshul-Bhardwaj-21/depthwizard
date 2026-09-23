"""
download_gamus.py
-----------------
Downloads GAMUS dataset from Hugging Face (earthflow/GAMUS).

Layout produced (compatible with dataset.py / GAMUSDataset):

    <out>/
      images/<id>.png     (RGB satellite tile)
      depth/<id>.tif      (nDSM height map, float32 metres)

Usage:
    pip install datasets huggingface_hub Pillow rasterio numpy

    # Quick start — validation split (~2 GB, ~2000 tiles)
    python download_gamus.py --split validation

    # Full training set (~30-50 GB)
    python download_gamus.py --split train

    # Custom output directory
    python download_gamus.py --split validation --out ./data/gamus

    # Resume an interrupted download (re-run same command — already-saved tiles are skipped)
    python download_gamus.py --split validation
"""

import argparse
import os
import sys
import time
import numpy as np
from pathlib import Path

# ── Increase HuggingFace timeouts to survive slow/flaky connections ─────────
os.environ.setdefault("HF_HUB_HTTP_TIMEOUT", "120")   # seconds per request
os.environ.setdefault("HF_DATASETS_TIMEOUT", "120")


def load_dataset_with_retry(name: str, split: str, max_retries: int = 5):
    """Call load_dataset with exponential back-off to survive transient HF errors."""
    from datasets import load_dataset

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[download_gamus] Attempting to load dataset (attempt {attempt}/{max_retries})...")
            return load_dataset(name, split=split, trust_remote_code=True)
        except Exception as exc:
            if attempt == max_retries:
                raise
            wait = 2 ** attempt          # 2, 4, 8, 16 … seconds
            print(f"  [warn] Download error (attempt {attempt}): {exc}")
            print(f"  [warn] Retrying in {wait}s...")
            time.sleep(wait)


def save_depth_as_tif(arr: "np.ndarray", path: Path):
    """Save a float32 numpy array as a single-band GeoTIFF."""
    try:
        import rasterio
        from rasterio.transform import from_bounds
        h, w = arr.shape
        transform = from_bounds(0, 0, 1, 1, w, h)
        with rasterio.open(
            path, "w", driver="GTiff",
            height=h, width=w, count=1,
            dtype="float32", crs="EPSG:4326",
            transform=transform,
        ) as dst:
            dst.write(arr.astype("float32"), 1)
    except ImportError:
        # Fallback: save as raw binary if rasterio not available
        arr.astype("float32").tofile(path.with_suffix(".bin"))
        print(f"  [warn] rasterio not found — saved as .bin instead of .tif: {path}")


def main():
    parser = argparse.ArgumentParser(description="Download GAMUS dataset from HuggingFace")
    parser.add_argument("--split", default="validation",
                        choices=["train", "validation", "test"],
                        help="Which split to download (default: validation ~2GB)")
    parser.add_argument("--out", default="data",
                        help="Output root directory (default: ./data)")
    parser.add_argument("--max-tiles", type=int, default=None,
                        help="Download only N tiles (useful for quick tests)")
    args = parser.parse_args()

    # Check dependency
    try:
        from datasets import load_dataset
    except ImportError:
        print("[ERROR] Missing dependency. Run:\n  pip install datasets huggingface_hub")
        sys.exit(1)

    out_root = Path(args.out)
    img_dir = out_root / "images"
    depth_dir = out_root / "depth"
    img_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)

    print(f"[download_gamus] Loading earthflow/GAMUS split='{args.split}'")
    print(f"[download_gamus] Output → {out_root.resolve()}")
    print("[download_gamus] This may take a while on first download (HuggingFace cache will speed up reruns)...")

    ds = load_dataset_with_retry("earthflow/GAMUS", split=args.split)

    # Auto-detect column names (schema can change between HF releases)
    sample = ds[0]
    print(f"[download_gamus] Dataset columns: {list(sample.keys())}")

    # Common column name variants
    IMG_KEY = next((k for k in ["image", "rgb", "img", "photo"] if k in sample), None)
    DSM_KEY = next((k for k in ["ndsm", "dsm", "depth", "height", "dem"] if k in sample), None)

    if IMG_KEY is None or DSM_KEY is None:
        print(f"[ERROR] Cannot find image/depth columns. Available: {list(sample.keys())}")
        print("  Update IMG_KEY and DSM_KEY manually in this script.")
        sys.exit(1)

    print(f"[download_gamus] Using image='{IMG_KEY}', depth='{DSM_KEY}'")

    total = len(ds) if args.max_tiles is None else min(args.max_tiles, len(ds))
    print(f"[download_gamus] Writing {total} tiles...")

    for i in range(total):
        stem = f"gamus_{i:06d}"

        # ── Resume: skip tiles that were already saved ───────────────────────
        if (img_dir / f"{stem}.png").exists() and (depth_dir / f"{stem}.tif").exists():
            if i % 100 == 0:
                print(f"  [{i+1}/{total}] already saved, skipping...")
            continue

        example = ds[i]
        # Save RGB image
        img = example[IMG_KEY]
        if hasattr(img, "save"):                  # PIL Image
            img.save(img_dir / f"{stem}.png")
        else:                                      # numpy array
            from PIL import Image as PILImage
            PILImage.fromarray(img).save(img_dir / f"{stem}.png")

        # Save nDSM height map
        dsm = example[DSM_KEY]
        if hasattr(dsm, "save"):                  # PIL Image
            import numpy as np
            arr = np.asarray(dsm, dtype=np.float32)
        else:
            arr = np.asarray(dsm, dtype=np.float32)
        save_depth_as_tif(arr, depth_dir / f"{stem}.tif")

        if i % 100 == 0 or i == total - 1:
            print(f"  [{i+1}/{total}] written...")

    print(f"\n[download_gamus] ✓ Done! {total} tile pairs in {out_root.resolve()}")
    print(f"[download_gamus] Now run training:")
    print(f"  cd model")
    print(f"  python train.py --data-root {out_root.resolve()} --epochs 30 --batch-size 8")


if __name__ == "__main__":
    main()
