import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg)',
          color: 'var(--text)',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 460,
            padding: 24,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg2)',
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went sideways.</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>
              Refresh this page to get back to your tryout workspace.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '9px 14px',
                borderRadius: 8,
                border: '1px solid var(--maroon)',
                background: 'var(--maroon)',
                color: '#fff',
                fontWeight: 700,
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
