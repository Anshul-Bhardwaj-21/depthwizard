"""
download_gamus.py
------------------
Downloads the real GAMUS dataset from Hugging Face (earthflow/GAMUS) and
lays it out in the images/ + depth/ folder structure GAMUSDataset expects.

This needs actual internet access to huggingface.co -- it will NOT run
inside network-restricted sandboxes. Run it on your own laptop / Colab.

Usage:
    pip install huggingface_hub datasets
    python download_gamus.py --out ./data
"""

import argparse
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="data", help="Output root (will contain images/ and depth/)")
    parser.add_argument("--split", default="train", choices=["train", "validation", "test"])
    args = parser.parse_args()

    try:
        from datasets import load_dataset
    except ImportError as exc:
        raise SystemExit(
            "Missing dependency. Run: pip install datasets huggingface_hub"
        ) from exc

    out_root = Path(args.out)
    img_dir = out_root / "images"
    depth_dir = out_root / "depth"
    img_dir.mkdir(parents=True, exist_ok=True)
    depth_dir.mkdir(parents=True, exist_ok=True)

    print(f"[download_gamus] loading earthflow/GAMUS split={args.split} (this pulls real data, can take a while)")
    ds = load_dataset("earthflow/GAMUS", split=args.split)

    # NOTE: the exact column names below are the dataset's documented
    # rgb/height fields as of when this script was written -- HF dataset
    # schemas occasionally change, so if this errors on a KeyError, run
    # `print(ds[0].keys())` first and update IMG_KEY / DEPTH_KEY.
    IMG_KEY = "image"
    DEPTH_KEY = "ndsm"

    for i, example in enumerate(ds):
        stem = f"gamus_{i:06d}"
        example[IMG_KEY].save(img_dir / f"{stem}.png")
        example[DEPTH_KEY].save(depth_dir / f"{stem}.tif")
        if i % 500 == 0:
            print(f"[download_gamus] wrote {i} tiles...")

    print(f"[download_gamus] done. {len(ds)} tiles written to {img_dir} and {depth_dir}")
    print("[download_gamus] point train.py at this folder with --data-root", str(out_root))


if __name__ == "__main__":
    main()
