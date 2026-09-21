import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#060e1a', color: '#ef4444', padding: 40, fontFamily: 'monospace', minHeight: '100vh' }}>
          <h2 style={{ color: '#f87171', marginBottom: 16 }}>⚠ App Error Caught</h2>
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: '#fca5a5' }}>{this.state.error?.message}</pre>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: '#94a3b8', marginTop: 12 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
