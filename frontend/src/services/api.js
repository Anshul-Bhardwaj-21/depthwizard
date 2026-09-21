const BASE = 'http://localhost:8000';

export const api = {
    predict: (file, srtmFile) => {
        const fd = new FormData();
        fd.append('file', file);
        if (srtmFile) fd.append('srtm_file', srtmFile);
        return fetch(`${BASE}/predict`, { method: 'POST', body: fd }).then(r => r.json());
    },
    createJob: (file, srtmFile) => {
        const fd = new FormData();
        fd.append('file', file);
        if (srtmFile) fd.append('srtm_file', srtmFile);
        return fetch(`${BASE}/jobs`, { method: 'POST', body: fd }).then(r => r.json());
    },
    getJobStatus: (jobId) => fetch(`${BASE}/jobs/${jobId}/status`).then(r => r.json()),
    validate: (jobId) => fetch(`${BASE}/validate/${jobId}`).then(r => r.json()),
    getAnalyses: () => fetch(`${BASE}/analyses`).then(r => r.json()),
    deleteAnalysis: (id) => fetch(`${BASE}/analyses/${id}`, { method: 'DELETE' }).then(r => r.json()),
    layerUrl: (jobId, layer, az = 315, el = 45) =>
        `${BASE}/jobs/${jobId}/layers/${layer}?azimuth=${az}&elevation=${el}`,
    contoursUrl: (jobId, interval = 10) => `${BASE}/jobs/${jobId}/contours?interval=${interval}`,
    profileUrl: (jobId) => `${BASE}/jobs/${jobId}/profile`,
    profile: (jobId, points) =>
        fetch(`${BASE}/jobs/${jobId}/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points }),
        }).then(r => r.json()),
    heatmapUrl: (jobId) => `${BASE}/jobs/${jobId}/error-heatmap`,
    reportUrl: (jobId, format = 'pdf') => `${BASE}/jobs/${jobId}/report?format=${format}`,
    outputUrl: (path) => `${BASE}${path}`,
    health: () => fetch(`${BASE}/health`).then(r => r.json()),
};
