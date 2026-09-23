# DepthWizard — Technical Report

**Problem Statement 26175, ISRO / Department of Space, SIH 2026**

*(Draft — fill in the bracketed sections with your actual numbers once you've
trained and evaluated. Everything else here reflects what the shipped code
actually does, so update this if the implementation changes.)*

## 1. Problem summary

Classical elevation-data sources (stereo pairs, LiDAR, InSAR) are accurate
but expensive and sensor-dependent. DepthWizard estimates a Digital Surface
Model from a *single* optical RGB image instead — relative height for plain
PNG/JPG, absolute metric elevation for georeferenced GeoTIFF — and renders it
as a navigable 3D terrain.

## 2. Architecture

```
RGB / GeoTIFF image
        │
        ▼
  Depth model            HeightUNet: ResNet34 encoder (ImageNet-pretrained)
  (relative height)      + U-Net decoder, fine-tuned on GAMUS
        │
        ▼
  Scale calibration      GeoTIFF only: fetch SRTM 30m tile for the image's
  (absolute height)      bounds, RANSAC-fit relative height → metres
        │
        ▼
  3D mesh + texture      deck.gl TerrainLayer: height map as elevation data,
                         original RGB as texture
        │
        ▼
  Interactive flythrough  React frontend, OrbitView navigation + live
                          validation panel (RMSE / MAE / correlation vs SRTM)
```

## 3. Elevation extraction

- **Model**: U-Net with a pretrained ResNet34 encoder rather than a
  from-scratch transformer/diffusion model. Rationale: published benchmarks
  on this task show a plain pretrained-encoder U-Net lands within a small
  margin of much heavier state-of-the-art architectures (e.g. HTC-DC Net),
  while being far cheaper to train inside a hackathon timeline.
- **Training data**: [GAMUS](https://huggingface.co/datasets/EarthFlow/GAMUS)
  — 11,507 RGB/nDSM tile pairs across five US cities. Chosen because generic
  monocular depth foundation models (MiDaS, Depth Anything, etc.) are trained
  on ground-level egocentric imagery and transfer poorly to nadir/top-down
  remote-sensing views; fine-tuning on a paired aerial RGB→height dataset is
  necessary to close that domain gap.
- **Loss**: Huber loss (robust to the occasional extreme outlier pixel at
  building edges, compared to plain MSE).
- **[RESULT]**: on the shipped synthetic smoke-test data (25 epochs, CPU,
  no pretrained weights, 128×128, 64 train / 16 val tiles): train loss
  4.20 → 1.40, val RMSE 6.6m → ~4.1m. This confirms the training loop is
  correct and the architecture can fit a learnable height signal — it says
  nothing about real-world accuracy, since the data is procedurally
  generated. Replace with real GAMUS numbers before reporting to judges.

## 4. Scale calibration

For georeferenced inputs, the GeoTIFF's embedded geotransform gives the
image's WGS84 bounds, which are used to fetch a matching SRTM 30m tile. A
RANSAC-robust linear regression fits `absolute_height = scale * relative_height
+ offset`, so pixels that don't follow ground-level elevation (buildings,
trees) are automatically down-weighted as outliers rather than skewing the
fit. Where the model's own land-cover prediction is available, restricting
the regression to predicted-ground pixels tightens this further.

A secondary, physics-based cross-check (`model/shadow_height.py`) estimates
height from cast-shadow length and sun elevation angle (derived from the
image timestamp + lat/lon) for individual structures, as an independent
sanity check on the learned model's output.

## 5. Visualization

Rendered client-side with deck.gl's `TerrainLayer`, which reconstructs a mesh
directly from the predicted height map and drapes the original RGB image
over it as a texture — avoiding a heavier engine (Unity) that the team has no
existing expertise in and that complicates deployment for a browser-based
demo. Navigation uses `OrbitView` (drag/scroll); see the limitations section
for the trade-off against a full first-person controller.

## 6. Evaluation plan

Per the stated rubric:

- **DSM accuracy (50%)**: RMSE / MAE / correlation against the SRTM
  reference (georeferenced test scenes) and, where available, LiDAR ground
  truth. Report separately for urban / sparse / hilly / forested scenes to
  show stability across terrain types, as the rubric asks — not just an
  aggregate number.
- **Visualization quality (50%)**: demonstrated via the live flythrough,
  projection accuracy (texture correctly draped on the mesh), interface
  responsiveness, and successful standalone deployment (built frontend +
  backend, run instructions in the top-level README).

**[FILL IN once evaluated]**: RMSE / MAE / correlation numbers per terrain
category, qualitative screenshots of the flythrough on 2-3 representative
scenes.

## 7. Known limitations

- GAMUS's five source cities are mostly flat urban/suburban US terrain; the
  model is expected to be weaker on hilly/forested scenes without additional
  training data (see README for mitigation options).
- The shadow-based cross-check is a heuristic (percentile-threshold shadow
  segmentation), tuned per scene rather than a trained detector — useful as
  a spot-check, not a bulk validation source.
- SRTM 30m is itself a coarse reference; fine-grained accuracy claims should
  be caveated against LiDAR where available instead.

## 8. Verification performed

Documented in full in the top-level README's "What's actually been tested"
section. In short: all unit tests pass, a real training run was executed
end to end (loss decreasing as expected), both inference modes (relative
and SRTM-calibrated) were run against a trained checkpoint, and the backend
API was integration-tested with real HTTP requests — which caught and fixed
two real bugs (a DEM reprojection misalignment, and `job_id` being silently
dropped from API responses). The live SRTM fetch and training on real GAMUS
data were not exercised, since neither is reachable from the sandbox this
was built in — both need to be run once on a machine with normal internet
access, before this is reported as validated.
