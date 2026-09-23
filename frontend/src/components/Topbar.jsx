import { Link, useLocation } from 'react-router-dom';
import { Mountain, Sun, Moon, Bell } from 'lucide-react';

export default function Topbar() {
    return (
        <header className="topbar">
            <div className="topbar-logo">
                <Mountain size={22} />
                DepthWizard
            </div>
            <span className="topbar-tagline">From Images to Elevation</span>

            <div className="topbar-right">
                <nav className="topbar-nav">
                    {['Analyze', 'Visualize', 'Explore', 'Build a 3D World'].map(t => (
                        <a key={t} href="#">{t}</a>
                    ))}
                </nav>
                <button className="btn-icon"><Bell size={14} /></button>
                <div className="topbar-badge">DW</div>
            </div>
        </header>
    );
}
