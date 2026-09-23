import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Trash2, ChevronRight, Clock } from 'lucide-react';
import { api } from '../services/api';

const statusMap = {
    done: <span className="badge badge-success">✓ Completed</span>,
    failed: <span className="badge badge-error">✗ Failed</span>,
    ingesting: <span className="badge badge-info">⏳ Processing</span>,
    calibrating: <span className="badge badge-info">⏳ Calibrating</span>,
    queued: <span className="badge badge-warning">Queued</span>,
};

export default function ProjectsPage({ onJobSelect }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const load = () => {
        setLoading(true);
        api.getAnalyses().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
    };
    useEffect(load, []);

    const del = async (id) => {
        await api.deleteAnalysis(id);
        load();
    };

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-bright)' }}>Analysis History</h2>
                    <p className="text-muted text-xs mt-2">View and manage all your past analyses.</p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/upload')}><Plus size={13} /> New Analysis</button>
            </div>

            <div className="card">
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : items.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center' }}>
                        <FolderOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
                        <p className="text-muted">No analyses yet. Upload your first image to get started.</p>
                        <button className="btn btn-primary mt-3" onClick={() => navigate('/upload')}><Plus size={14} /> Start Analysis</button>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Input Type</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        <div style={{ fontWeight: 600, fontSize: 12 }}>{a.name || 'Untitled'}</div>
                                        <div className="text-xs text-muted">{a.id}</div>
                                    </td>
                                    <td><span className="badge badge-info" style={{ fontSize: 9 }}>{a.input_type}</span></td>
                                    <td>{statusMap[a.status] || <span className="badge badge-warning">{a.status}</span>}</td>
                                    <td className="text-xs text-muted"><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{a.created_at?.slice(0, 16).replace('T', ' ')}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => { onJobSelect?.(a.id); navigate('/results'); }}>
                                                <ChevronRight size={13} /> View
                                            </button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => del(a.id)}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
