"""
shadow_height.py
-----------------
Secondary, physics-based height cue: classic photogrammetry says

    height = shadow_length_on_ground * tan(sun_elevation_angle)

This is NOT meant to replace the learned model -- it's a cheap independent
check you can run on a handful of clearly-shadowed structures to sanity-check
(or slightly correct) the model + calibration output, and it's an easy thing
to show a judge as evidence you understand the physics, not just the network.

It only works where:
  - the image has a capture timestamp + lat/lon (GeoTIFF metadata, or supply
    manually for a plain PNG/JPG),
  - shadows are visibly cast and not in deep shade themselves,
  - the ground the shadow falls on is roughly flat.

Treat its output as a cross-check, not ground truth -- log where it disagrees
with the model by a lot, that's useful for the validation view.
"""

from dataclasses import dataclass
from datetime import datetime

import cv2
import numpy as np


@dataclass
class SunPosition:
    elevation_deg: float
    azimuth_deg: float


def get_sun_position(lat: float, lon: float, when: datetime) -> SunPosition:
    """Sun elevation/azimuth at capture time and location, via pysolar."""
    from pysolar.solar import get_altitude, get_azimuth

    elevation = get_altitude(lat, lon, when)
    azimuth = get_azimuth(lat, lon, when)
    return SunPosition(elevation_deg=elevation, azimuth_deg=azimuth)


def detect_shadow_mask(rgb: np.ndarray, dark_percentile: float = 15.0) -> np.ndarray:
    """
    Rough shadow segmentation: convert to HSV, flag low-value (dark) and
    low-to-mid saturation pixels, then clean up with morphology. This is a
    heuristic, not a trained detector -- tune dark_percentile per scene, and
    expect to hand-pick a few clean shadow instances rather than trusting
    this across a whole tile.
    """
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    v = hsv[:, :, 2]
    thresh = np.percentile(v, dark_percentile)
    mask = (v <= thresh).astype(np.uint8) * 255

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    return mask > 0


def measure_shadow_length_px(shadow_mask: np.ndarray, base_point: tuple[int, int], azimuth_deg: float, max_len: int = 200) -> float:
    """
    Walks outward from base_point (row, col) -- the foot of the structure --
    along the shadow-cast direction (opposite the sun azimuth) and returns
    how many contiguous pixels stay inside shadow_mask.
    """
    # azimuth is measured clockwise from north; shadow points away from the sun
    theta = np.radians((azimuth_deg + 180) % 360)
    dy, dx = -np.cos(theta), np.sin(theta)  # image rows grow downward

    row, col = base_point
    length = 0
    for step in range(1, max_len):
        r = int(round(row + dy * step))
        c = int(round(col + dx * step))
        if not (0 <= r < shadow_mask.shape[0] and 0 <= c < shadow_mask.shape[1]):
            break
        if not shadow_mask[r, c]:
            break
        length = step
    return float(length)


def shadow_based_height(
    shadow_length_px: float,
    pixel_size_m: float,
    sun_elevation_deg: float,
) -> float:
    if sun_elevation_deg <= 0 or sun_elevation_deg >= 90:
        raise ValueError("Sun elevation must be strictly between 0 and 90 degrees for this formula to be meaningful")
    shadow_length_m = shadow_length_px * pixel_size_m
    return shadow_length_m * np.tan(np.radians(sun_elevation_deg))


if __name__ == "__main__":
    # hand-computed check: 50 degree sun, 10m shadow -> height = 10*tan(50deg)
    h = shadow_based_height(shadow_length_px=20, pixel_size_m=0.5, sun_elevation_deg=50)
    expected = 10.0 * np.tan(np.radians(50))
    assert abs(h - expected) < 1e-6
    print(f"shadow_based_height sanity check OK: {h:.2f} m")
