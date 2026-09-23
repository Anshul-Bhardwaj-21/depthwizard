"""
dataset.py
----------
Loader for the GAMUS dataset (RGB satellite/aerial tiles paired with nDSM
height maps). GAMUS ships as paired image files -- adjust IMG_DIR / DEPTH_DIR
and the filename-matching logic below to whatever folder layout you get after
downloading it from Hugging Face (earthflow/GAMUS), since exact release
layouts can shift between versions. The rest of the pipeline only depends on
this module returning (image_tensor, height_tensor) pairs, so this is the one
file you should sanity-check by hand against your actual download before
trusting anything downstream.
"""

import os
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torch.utils.data import Dataset


class GAMUSDataset(Dataset):
    """
    Expects a directory structure like:

        root/
          images/<tile_id>.png   (RGB)
          depth/<tile_id>.tif    (single-channel nDSM, float meters)

    If your download uses different subfolder names or extensions, change
    IMG_SUBDIR / DEPTH_SUBDIR / DEPTH_EXT below -- everything else works off
    the matched tile_id stems.
    """

    IMG_SUBDIR = "images"
    DEPTH_SUBDIR = "depth"
    DEPTH_EXT = ".tif"

    def __init__(self, root: str, image_size: int = 256, augment: bool = False):
        self.root = Path(root)
        self.image_size = image_size
        self.augment = augment

        img_dir = self.root / self.IMG_SUBDIR
        depth_dir = self.root / self.DEPTH_SUBDIR
        if not img_dir.exists() or not depth_dir.exists():
            raise FileNotFoundError(
                f"Expected {img_dir} and {depth_dir} to exist. "
                "Check GAMUS folder layout / update IMG_SUBDIR & DEPTH_SUBDIR."
            )

        img_stems = {p.stem for p in img_dir.glob("*") if p.is_file()}
        depth_stems = {p.stem for p in depth_dir.glob(f"*{self.DEPTH_EXT}")}
        self.stems = sorted(img_stems & depth_stems)

        missing = len(img_stems) - len(self.stems)
        if missing:
            print(f"[GAMUSDataset] warning: {missing} images had no matching depth file, skipped")
        if not self.stems:
            raise RuntimeError("No matched (image, depth) pairs found -- check dataset paths.")

        self.img_dir = img_dir
        self.depth_dir = depth_dir

    def __len__(self):
        return len(self.stems)

    def _load_image(self, stem: str) -> np.ndarray:
        for ext in (".png", ".jpg", ".jpeg", ".tif", ".tiff"):
            path = self.img_dir / f"{stem}{ext}"
            if path.exists():
                img = Image.open(path).convert("RGB").resize(
                    (self.image_size, self.image_size), Image.BILINEAR
                )
                return np.asarray(img, dtype=np.float32) / 255.0
        raise FileNotFoundError(f"No image file found for stem {stem}")

    def _load_depth(self, stem: str) -> np.ndarray:
        path = self.depth_dir / f"{stem}{self.DEPTH_EXT}"
        try:
            import rasterio
            with rasterio.open(path) as src:
                depth = src.read(1).astype(np.float32)
        except ImportError:
            depth = np.asarray(Image.open(path), dtype=np.float32)

        depth_img = Image.fromarray(depth).resize(
            (self.image_size, self.image_size), Image.BILINEAR
        )
        return np.asarray(depth_img, dtype=np.float32)

    def __getitem__(self, idx: int):
        stem = self.stems[idx]
        image = self._load_image(stem)
        depth = self._load_depth(stem)

        if self.augment and np.random.rand() < 0.5:
            image = np.ascontiguousarray(image[:, ::-1, :])
            depth = np.ascontiguousarray(depth[:, ::-1])

        image_t = torch.from_numpy(image.copy()).permute(2, 0, 1).float()  # CxHxW
        depth_t = torch.from_numpy(depth.copy()).unsqueeze(0).float()  # 1xHxW
        return image_t, depth_t


def make_synthetic_dataset(n=8, size=64):
    """
    Returns a tiny in-memory dataset with the same interface, used by the
    unit tests / for a smoke test when you don't have GAMUS downloaded yet.
    """

    class _Synthetic(Dataset):
        def __len__(self):
            return n

        def __getitem__(self, idx):
            image = torch.rand(3, size, size)
            # fabricate a height map correlated with image brightness so the
            # model has *something* learnable during a smoke test
            depth = image.mean(dim=0, keepdim=True) * 20.0
            return image, depth

    return _Synthetic()
