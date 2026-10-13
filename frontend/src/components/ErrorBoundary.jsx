import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-sand px-4">
        <div className="max-w-md rounded-2xl border border-line bg-white p-6 text-center shadow-card">
          <h1 className="font-display text-2xl text-ink">This page could not be shown</h1>
          <p className="mt-2 text-sm text-ink/70">Reload the page. If it keeps happening, sign in again.</p>
          <button type="button" className="btn-primary mt-5" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
