import { NavLink, useNavigate } from 'react-router-dom';
import {
    Home, Plus, GitBranch, FolderOpen, Settings,
    Mountain, BarChart2, Eye, Download, Layers,
    Activity, RefreshCw, ChevronRight
} from 'lucide-react';

const nav = [
    { label: 'Home', to: '/', icon: Home },
    { label: 'New Analysis', to: '/upload', icon: Plus },
    { label: 'Analysis Pipeline', to: '/processing', icon: GitBranch },
    { label: 'Results', to: '/results', icon: BarChart2 },
];
const analysis = [
    { label: '3D Terrain Viewer', to: '/terrain', icon: Mountain },
    { label: 'Validation Lab', to: '/validation', icon: Activity },
    { label: 'Compare & Inspect', to: '/compare', icon: Eye },
    { label: 'Export & Report', to: '/export', icon: Download },
];
const mgmt = [
    { label: 'Projects', to: '/projects', icon: FolderOpen },
    { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar({ currentJob }) {
    const navigate = useNavigate();
    return (
        <nav className="sidebar">
            <div className="sidebar-section">Navigation</div>
            {nav.map(({ label, to, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                    <Icon size={15} /> {label}
                </NavLink>
            ))}

            <div className="divider" style={{ margin: '8px 0' }} />
            <div className="sidebar-section">Analysis Tools</div>
            {analysis.map(({ label, to, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                    <Icon size={15} /> {label}
                </NavLink>
            ))}

            <div className="divider" style={{ margin: '8px 0' }} />
            <div className="sidebar-section">Manage</div>
            {mgmt.map(({ label, to, icon: Icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
                    <Icon size={15} /> {label}
                </NavLink>
            ))}

            {/* Current job status */}
            {currentJob && (
                <div style={{ margin: '16px 12px 0', borderRadius: 8, padding: 10, background: 'var(--primary-glow)', border: '1px solid var(--primary)', cursor: 'pointer' }} onClick={() => navigate('/results')}>
                    <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>ACTIVE JOB</div>
                    <div style={{ fontSize: 11, color: 'var(--text-primary)', marginBottom: 6 }} className="truncate">{currentJob.job_id}</div>
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${currentJob.progress || 0}%` }} /></div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{currentJob.status}</div>
                </div>
            )}

            <div style={{ marginTop: 'auto', padding: '16px 16px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>DepthWizard v1.0</div>
                <div style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="dot" style={{ background: 'var(--accent-green)' }} /> Backend Online
                </div>
            </div>
        </nav>
    );
}
