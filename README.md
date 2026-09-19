# DepthWizard

**Single-View Height Estimation and 3D Flythrough**  
Smart India Hackathon — Remote Sensing & Geospatial Analysis

---

## Overview

DepthWizard takes a single optical remote-sensing image (PNG, JPEG, or TIFF/GeoTIFF) and produces elevation/height information, followed by interactive 3D terrain visualization and analysis — without requiring stereo imagery pairs or LiDAR ground truth.

## Repository Structure

```
depthwizard/
├── frontend/     # React + TypeScript + Vite + Tailwind CSS web application
├── backend/      # Python inference API (placeholder — Phase 2)
├── model/        # ML training, calibration, shadow-height estimation (placeholder)
└── docs/         # Project documentation
```

## Frontend (Phase 1)

**Stack:** React 19 · TypeScript 6 · Vite 8 · Tailwind CSS v4 · React Router v7 · Lucide React

**Current status:** Phase 1 — Upload and input validation flow only.  
Backend, ML inference, and 3D visualization are not yet implemented.

### Getting Started

```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
npm run build     # Production build
npm run lint      # oxlint
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_MAX_UPLOAD_SIZE_BYTES` | Client-side upload size limit in bytes | Unset (no limit) |

Copy `.env.example` to `.env.local` and set values as needed.

### Pipeline (implemented phases)

| Stage | Status |
|---|---|
| 01 · Input upload & validation | ✅ Phase 1 complete |
| 02 · Elevation / DSM generation | 🔜 Phase 2 |
| 03 · 3D terrain flythrough | 🔜 Phase 3 |
| 04 · Validation / comparison | 🔜 Phase 4 |
| 05 · Export / report | 🔜 Phase 5 |

## Contributing

- Branch naming: `feature/*`, `fix/*`
- PRs against `main` with at least one reviewer
- Run `npm run build` and `npm run lint` before pushing
- Do not commit `.env.local`, `node_modules/`, or `dist/`

## License

[To be determined by team]
