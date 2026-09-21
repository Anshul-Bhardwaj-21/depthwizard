import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from unet import HeightUNet
from calibrate import calibrate_scale
from shadow_height import shadow_based_height
from dataset import make_synthetic_dataset


def test_unet_forward_shape():
    import torch
    model = HeightUNet(pretrained=False)
    x = torch.rand(2, 3, 128, 128)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (2, 1, 128, 128)
    assert torch.all(out >= 0)  # softplus output must be non-negative


def test_unet_odd_input_size_does_not_crash():
    import torch
    model = HeightUNet(pretrained=False)
    x = torch.rand(1, 3, 130, 130)
    with torch.no_grad():
        out = model(x)
    assert out.shape == (1, 1, 130, 130)


def test_calibrate_scale_recovers_known_transform_with_outliers():
    rng = np.random.default_rng(1)
    true_scale, true_offset = 8.0, -15.0
    rel = rng.uniform(0, 5, size=(100, 100))
    srtm = true_scale * rel + true_offset + rng.normal(0, 0.3, size=rel.shape)

    outliers = rng.random(rel.shape) < 0.25
    srtm[outliers] += rng.uniform(15, 40, size=outliers.sum())

    result = calibrate_scale(rel, srtm)
    assert abs(result.scale - true_scale) < 1.0
    assert abs(result.offset - true_offset) < 10.0
    assert result.inlier_fraction > 0.6


def test_calibrate_scale_rejects_too_few_points():
    rel = np.random.rand(3, 3)
    srtm = np.random.rand(3, 3)
    with pytest.raises(ValueError):
        calibrate_scale(rel, srtm)


def test_shadow_based_height_matches_trigonometry():
    h = shadow_based_height(shadow_length_px=20, pixel_size_m=0.5, sun_elevation_deg=45)
    expected = 10.0 * np.tan(np.radians(45))
    assert h == pytest.approx(expected, rel=1e-6)


def test_shadow_based_height_rejects_bad_sun_angle():
    with pytest.raises(ValueError):
        shadow_based_height(shadow_length_px=10, pixel_size_m=1.0, sun_elevation_deg=0)


def test_synthetic_dataset_smoke():
    ds = make_synthetic_dataset(n=4, size=32)
    assert len(ds) == 4
    image, depth = ds[0]
    assert image.shape == (3, 32, 32)
    assert depth.shape == (1, 32, 32)
