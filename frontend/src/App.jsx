import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import ResultsPage from './pages/ResultsPage';
import ValidationPage from './pages/ValidationPage';
import ComparePage from './pages/ComparePage';
import ExportPage from './pages/ExportPage';
import ProjectsPage from './pages/ProjectsPage';

// Lazy-load the 3D terrain page so a @react-three/fiber import error
// only affects that route and doesn't kill the whole app
const TerrainPage = lazy(() => import('./pages/TerrainPage'));

function TerrainFallback({ jobId }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🏔</div>
      <h3 style={{ color: 'var(--text-bright)', marginBottom: 8 }}>3D Terrain Viewer</h3>
      <p style={{ marginBottom: 16 }}>Loading 3D engine — this may take a moment…</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="animate-in">
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Settings</h2>
      <div className="panel-grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title mb-3">General</div>
          {[['Default DEM Source', 'SRTM (Auto-fetch)'], ['Elevation Units', 'Meters (m)'], ['Default CRS', 'EPSG:4326 (WGS84)']].map(([k, v]) => (
            <div key={k} className="mb-3">
              <label>{k}</label>
              <select><option>{v}</option></select>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title mb-3">System Info</div>
          {[['Version', 'DepthWizard v1.0'], ['Backend', 'FastAPI + PyTorch'], ['Model', 'HeightUNet (ResNet34)']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              <span className="text-muted">{k}</span><span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  const handleJobCreated = (id) => {
    setJobId(id);
    setJobStatus({ job_id: id, status: 'queued', progress: 0 });
  };

  return (
    <BrowserRouter>
      <div className="layout">
        <Topbar />
        <Sidebar currentJob={jobStatus} />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<HomePage onJobSelect={setJobId} />} />
            <Route path="/upload" element={<UploadPage onJobCreated={handleJobCreated} />} />
            <Route path="/processing" element={<ProcessingPage jobId={jobId} />} />
            <Route path="/results" element={<ResultsPage jobId={jobId} />} />
            <Route path="/terrain" element={<Suspense fallback={<TerrainFallback />}><TerrainPage jobId={jobId} /></Suspense>} />
            <Route path="/validation" element={<ValidationPage jobId={jobId} />} />
            <Route path="/compare" element={<ComparePage jobId={jobId} />} />
            <Route path="/export" element={<ExportPage jobId={jobId} />} />
            <Route path="/projects" element={<ProjectsPage onJobSelect={setJobId} />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
