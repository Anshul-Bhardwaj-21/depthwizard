# DepthWizard

Single-view height estimation and 3D flythrough for ISRO SAC — SIH 2026, Problem Statement 26175.

Turns a single RGB satellite/aerial image into a height map (relative for
plain PNG/JPG, absolute metric elevation for georeferenced GeoTIFF) and
renders it as a navigable 3D terrain in the browser.

**Status**: the full pipeline — data loading, training, inference (both
relative and SRTM-calibrated modes), backend API, and frontend — has been
built and run end to end on a small synthetic sample dataset (see "What's
actually been tested" below). It is ready for you to point at real GAMUS
data and train properly.

## How it works

1. **`model/`** — a U-Net (pretrained ResNet34 encoder) fine-tuned on
   [GAMUS](https://huggingface.co/datasets/earthflow/GAMUS) predicts a
   scale-agnostic relative height map from a single RGB image.
2. For **GeoTIFF** inputs, `model/calibrate.py` fetches an SRTM 30m tile (or
   uses a local DEM you provide) for the image's bounds and robustly
   (RANSAC) fits relative height → absolute metric elevation, so
   building/tree pixels don't corrupt the fit.
3. `model/shadow_height.py` is a secondary, physics-based height cross-check
   (shadow length + sun angle) for individual structures — a sanity check on
   the learned model, not a replacement for it.
4. **`backend/`** — FastAPI service wrapping the model + calibration.
5. **`frontend/`** — React + [deck.gl](https://deck.gl): upload an image,
   see the predicted terrain as a navigable 3D mesh (`TerrainLayer`), and —
   for GeoTIFF inputs — a live RMSE/MAE/correlation panel against the
   reference DEM.

## Quickstart (sample data already included)

A small **synthetic** sample dataset ships in `model/data/` so you can run
the whole pipeline immediately, with no download required:

```bash
cd model
pip install -r requirements.txt
python train.py --data-root ./data --epochs 25 --no-pretrained   # ~5 min on CPU
```

(`--no-pretrained` skips downloading ImageNet weights for ResNet34 — drop it
once you have normal internet access; real training runs should use
pretrained weights.)

```bash
cd ../backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

```bash
cd ../frontend
npm install
npm run dev
```

Open the printed localhost URL, upload one of `model/data/images/*.png`, and
you should see a terrain render. To see the calibrated/absolute mode, upload
`model/data/sample_geotiff/scene.tif` and attach
`model/data/sample_geotiff/local_dem.tif` as the optional local DEM in the
UI (or via the `srtm_file` form field directly).

**Or with Docker** (builds both services, untested in this sandbox — no
Docker daemon available here, so verify it yourself):

```bash
docker compose up --build
```

## Getting real data

The sample data above is procedurally generated (rectangles standing in for
buildings) purely so the pipeline has something to learn from before you
have real data — do not report results trained on it. Two ways to get real
data:

- **GAMUS** (recommended by the PS's own reference repo): run
  `model/data/download_gamus.py` on a machine with real internet access
  (needs `pip install datasets huggingface_hub`).
- **Your own GeoTIFF + SRTM**: `model/calibrate.py`'s `fetch_srtm_tile()`
  pulls SRTM 30m automatically for any GeoTIFF's bounds when you don't pass
  `local_dem_path` — this also needs real network access (this sandbox's
  network doesn't reach the tile provider, see below).

## What's actually been tested (and what isn't)

Rather than claim this all just works, here's exactly what was run:

- **Unit tests** (`model/tests/test_pipeline.py`, `pytest`): U-Net forward
  pass and output shape, calibration math recovering a known scale/offset
  through 25-30% injected outliers, shadow-height trigonometry. All 7 pass.
- **Real training run**: 25 epochs on the shipped synthetic data (CPU,
  no GPU) — train loss went 4.20 → 1.40, val RMSE 6.6 → ~4.1m, confirming
  the model genuinely learns the (synthetic) building/height correlation,
  not just memorizing noise.
- **Real inference**: both the relative-height path (plain PNG) and the
  SRTM-calibration path (GeoTIFF + local DEM) were run against the trained
  checkpoint and produced sane, non-degenerate output.
- **Real backend integration test**: `uvicorn` started, then `/health`,
  `/predict` (both modes), and `/validate` were hit with real `curl`
  requests against real files — including a 404 check for validating a
  non-georeferenced job. Two real bugs were caught and fixed this way: the
  DEM reprojection used the wrong destination transform (silently zeroing
  out calibration when the DEM and image resolutions didn't match), and
  `job_id` was being silently stripped from API responses because it wasn't
  declared in the Pydantic response model — the second one would have
  quietly broken the frontend's validation panel.
- **Real frontend build**: `npm install` + `npm run build` with the actual
  `deck.gl` packages, 1975 modules, no errors.
- **NOT tested here**: the live SRTM fetch (this sandbox's network can't
  reach the tile provider or run `gdalbuildvrt` — use `--srtm-path` /
  `srtm_file` to bypass it, as done above, or just test the live fetch
  yourself once you're off this sandbox), training on real GAMUS data (not
  downloadable from here), and the deck.gl viewer's actual WebGL rendering
  in a real browser (this is a headless sandbox).

## Known limitations, worth saying out loud to judges

- GAMUS covers five US cities — mostly flat urban/suburban terrain. The
  evaluation criteria test hilly/forested scenes too, where a GAMUS-only
  model will be weaker. Augmenting with ISPRS Vaihingen/Potsdam (rural,
  hilly) helps.
- The 3D viewer uses deck.gl's `OrbitView` (drag/scroll navigation), not a
  true first-person WASD flythrough — satisfies "navigable from arbitrary
  aerial perspectives" with far less code. See the note in
  `frontend/src/components/TerrainViewer.jsx` for how to upgrade it.
- Published methods on this exact task report several metres of RMSE even
  at state of the art — don't chase pixel-perfect accuracy; a robust,
  transparently-validated system scores better against the rubric than a
  fragile one that overfits its demo scene.
- The Docker setup is provided but unbuilt/untested (no Docker daemon in
  this sandbox) — build it yourself before relying on it for a demo.
