"""
calibrate.py
------------
Converts the model's scale-agnostic relative height map into absolute metric
elevation for georeferenced (GeoTIFF) inputs, using a low-resolution SRTM DEM
as the reference.

Two pieces:
  1. fetch_srtm_tile(bounds)      -- pulls an SRTM 30m tile for a bounding box
  2. calibrate_scale(rel, srtm)   -- robustly fits height_m = a * rel + b

The regression is fit with RANSAC rather than plain least squares because
SRTM only captures *ground* elevation, while our relative height map also
responds to buildings/trees -- those pixels are outliers with respect to a
simple ground-elevation fit, and RANSAC down-weights them automatically. If
you also have a land-cover / building mask from the model, pass it in as
ground_mask for a cleaner fit.
"""

from dataclasses import dataclass

import numpy as np
from sklearn.linear_model import RANSACRegressor, LinearRegression


@dataclass
class CalibrationResult:
    scale: float
    offset: float
    inlier_fraction: float

    def apply(self, relative_height: np.ndarray) -> np.ndarray:
        return self.scale * relative_height + self.offset


def calibrate_scale(
    relative_height: np.ndarray,
    srtm_elevation: np.ndarray,
    ground_mask: np.ndarray | None = None,
    residual_threshold: float | None = None,
) -> CalibrationResult:
    """
    relative_height, srtm_elevation: same-shape 2D arrays (already resampled
        / aligned to the same grid -- do that alignment before calling this).
    ground_mask: optional boolean array, True where a pixel is known ground
        (not building/tree). Strongly recommended if you have it.
    residual_threshold: RANSAC inlier threshold in meters. Defaults to a
        robust estimate (1.4826 * MAD of srtm_elevation) if not given.
    """
    if relative_height.shape != srtm_elevation.shape:
        raise ValueError("relative_height and srtm_elevation must be the same shape (resample first)")

    rel = relative_height.ravel()
    abs_elev = srtm_elevation.ravel()

    if ground_mask is not None:
        mask = ground_mask.ravel().astype(bool)
        rel, abs_elev = rel[mask], abs_elev[mask]

    valid = np.isfinite(rel) & np.isfinite(abs_elev)
    rel, abs_elev = rel[valid], abs_elev[valid]

    if rel.size < 20:
        raise ValueError(f"Only {rel.size} usable ground points -- need more overlap between the image and SRTM tile")

    if residual_threshold is None:
        mad = np.median(np.abs(abs_elev - np.median(abs_elev)))
        residual_threshold = max(1.0, 1.4826 * mad)

    ransac = RANSACRegressor(
        estimator=LinearRegression(),
        residual_threshold=residual_threshold,
        random_state=0,
    )
    ransac.fit(rel.reshape(-1, 1), abs_elev)

    scale = float(ransac.estimator_.coef_[0])
    offset = float(ransac.estimator_.intercept_)
    inlier_fraction = float(np.mean(ransac.inlier_mask_))

    return CalibrationResult(scale=scale, offset=offset, inlier_fraction=inlier_fraction)


def fetch_srtm_tile(bounds, output_path="srtm_tile.tif", local_dem_path: str | None = None):
    """
    bounds: (west, south, east, north) in EPSG:4326 degrees, taken from the
    GeoTIFF's own metadata.

    If local_dem_path is given, that file is used as-is instead of hitting
    the network -- useful if you've pre-downloaded a DEM for your area (e.g.
    for offline demos, or if a venue's network blocks the live fetch). This
    does NOT crop/verify the local file against bounds; that's on you.

    Otherwise requires network access to a DEM provider. Uses the
    `elevation` package, which wraps SRTM3/SRTM1 tiles from OpenTopography's
    mirror. If that ever changes upstream, swap in a direct OpenTopography
    Global DEM API call instead -- the rest of this file only cares that you
    end up with a GeoTIFF at output_path.
    """
    if local_dem_path is not None:
        return local_dem_path

    import elevation

    west, south, east, north = bounds
    elevation.clip(bounds=(west, south, east, north), output=output_path)
    return output_path


if __name__ == "__main__":
    # sanity check with synthetic data: recover a known scale/offset even
    # with 30% of pixels corrupted by "building" outliers
    rng = np.random.default_rng(0)
    true_scale, true_offset = 12.5, 240.0
    rel = rng.uniform(0, 10, size=(200, 200))
    srtm = true_scale * rel + true_offset + rng.normal(0, 0.5, size=rel.shape)

    # inject outliers (simulated buildings sitting well above ground truth)
    outlier_mask = rng.random(rel.shape) < 0.3
    srtm[outlier_mask] += rng.uniform(20, 60, size=outlier_mask.sum())

    result = calibrate_scale(rel, srtm)
    print(f"recovered scale={result.scale:.2f} (true {true_scale}), "
          f"offset={result.offset:.2f} (true {true_offset}), "
          f"inliers={result.inlier_fraction:.2f}")
    assert abs(result.scale - true_scale) < 1.0
    assert abs(result.offset - true_offset) < 15.0
    print("calibrate_scale sanity check OK")
