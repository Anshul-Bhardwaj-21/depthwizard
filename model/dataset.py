"""
dataset.py
----------
Dataset loader for GAMUS (earthflow/GAMUS on HuggingFace).

Expected folder layout after running download_gamus.py:

    data/
      images/gamus_000000.png    (RGB tile, uint8)
      depth/gamus_000000.tif     (nDSM metres, float32, single-band GeoTIFF)

If your layout differs, only adjust IMG_SUBDIR / DEPTH_SUBDIR / DEPTH_EXT.
Everything else in this file + train.py + infer.py stays unchanged.
"""

import os
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset


class GAMUSDataset(Dataset):
    """
    Paired RGB + nDSM height-map tiles.

    Each __getitem__ returns:
        image_t : FloatTensor [3, H, W]  values in [0, 1]
        depth_t : FloatTensor [1, H, W]  values in metres (approx 0-40 m for urban)
    """

    IMG_SUBDIR   = "images"
    DEPTH_SUBDIR = "depth"
    DEPTH_EXT    = ".tif"

    # Accepted image extensions (in priority order)
    IMG_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff")

    def __init__(self, root: str, image_size: int = 256, augment: bool = False):
        self.root       = Path(root)
        self.image_size = image_size
        self.augment    = augment

        img_dir   = self.root / self.IMG_SUBDIR
        depth_dir = self.root / self.DEPTH_SUBDIR

        if not img_dir.exists():
            raise FileNotFoundError(
                f"Image directory not found: {img_dir}\n"
                "Run: python model/data/download_gamus.py --split validation"
            )
        if not depth_dir.exists():
            raise FileNotFoundError(
                f"Depth directory not found: {depth_dir}\n"
                "Run: python model/data/download_gamus.py --split validation"
            )

        # Match by stem (filename without extension)
        img_stems   = {p.stem for p in img_dir.iterdir() if p.suffix.lower() in self.IMG_EXTS}
        depth_stems = {p.stem for p in depth_dir.glob(f"*{self.DEPTH_EXT}")}

        # Also check .bin fallback from download script
        depth_stems |= {p.stem for p in depth_dir.glob("*.bin")}

        self.stems = sorted(img_stems & depth_stems)

        if not self.stems:
            raise RuntimeError(
                f"No matched (image, depth) pairs found in {self.root}\n"
                f"  images dir has {len(img_stems)} files\n"
                f"  depth dir has  {len(depth_stems)} files\n"
                "Check that download_gamus.py ran successfully."
            )

        skipped = len(img_stems) - len(self.stems)
        print(f"[GAMUSDataset] {len(self.stems)} paired tiles found"
              + (f" ({skipped} images had no depth, skipped)" if skipped else ""))

        self.img_dir   = img_dir
        self.depth_dir = depth_dir

    def __len__(self):
        return len(self.stems)

    def _load_image(self, stem: str) -> np.ndarray:
        for ext in self.IMG_EXTS:
            path = self.img_dir / f"{stem}{ext}"
            if path.exists():
                img = Image.open(path).convert("RGB").resize(
                    (self.image_size, self.image_size), Image.BILINEAR
                )
                return np.asarray(img, dtype=np.float32) / 255.0
        raise FileNotFoundError(f"No image found for stem: {stem}")

    def _load_depth(self, stem: str) -> np.ndarray:
        tif_path = self.depth_dir / f"{stem}{self.DEPTH_EXT}"
        bin_path = self.depth_dir / f"{stem}.bin"

        if tif_path.exists():
            try:
                import rasterio
                with rasterio.open(tif_path) as src:
                    depth = src.read(1).astype(np.float32)
            except ImportError:
                depth = np.asarray(Image.open(tif_path), dtype=np.float32)
        elif bin_path.exists():
            # Fallback from download_gamus when rasterio wasn't available
            depth = np.fromfile(bin_path, dtype=np.float32)
            side  = int(np.sqrt(depth.size))
            depth = depth[:side*side].reshape(side, side)
        else:
            raise FileNotFoundError(f"No depth file for stem: {stem}")

        # Handle NaN / Inf / negative values (common in nDSM tiles at edges)
        depth = np.nan_to_num(depth, nan=0.0, posinf=0.0, neginf=0.0)
        depth = np.clip(depth, 0.0, 150.0)           # realistic urban height range

        return np.asarray(
            Image.fromarray(depth).resize((self.image_size, self.image_size), Image.BILINEAR),
            dtype=np.float32,
        )

    def __getitem__(self, idx: int):
        stem  = self.stems[idx]
        image = self._load_image(stem)
        depth = self._load_depth(stem)

        # Random horizontal flip augmentation
        if self.augment and np.random.rand() < 0.5:
            image = np.ascontiguousarray(image[:, ::-1, :])
            depth = np.ascontiguousarray(depth[:, ::-1])

        # Random vertical flip
        if self.augment and np.random.rand() < 0.5:
            image = np.ascontiguousarray(image[::-1, :, :])
            depth = np.ascontiguousarray(depth[::-1, :])

        image_t = torch.from_numpy(image.copy()).permute(2, 0, 1).float()   # [3, H, W]
        depth_t = torch.from_numpy(depth.copy()).unsqueeze(0).float()        # [1, H, W]
        return image_t, depth_t


class SyntheticDataset(Dataset):
    """
    Tiny in-memory dataset with the same interface as GAMUSDataset.
    Used for smoke-tests when no real data is downloaded yet.
    Must be a top-level class (not a nested class) so DataLoader workers
    can pickle it for multiprocessing.
    """
    def __init__(self, n: int = 8, size: int = 64):
        self.n    = n
        self.size = size

    def __len__(self):
        return self.n

    def __getitem__(self, idx):
        # Use idx as seed for reproducibility across workers
        rng   = torch.Generator().manual_seed(idx)
        image = torch.rand(3, self.size, self.size, generator=rng)
        depth = image.mean(dim=0, keepdim=True) * 30.0   # ~0–30 m range like real nDSM
        return image, depth


def make_synthetic_dataset(n: int = 8, size: int = 64) -> SyntheticDataset:
    """
    Tiny in-memory dataset with the same interface as GAMUSDataset.
    Used for smoke-tests when GAMUS isn't downloaded yet.
    """
    return SyntheticDataset(n=n, size=size)

