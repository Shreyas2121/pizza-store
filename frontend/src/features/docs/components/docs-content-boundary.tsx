import { Component, type ReactNode } from "react";
import { Link } from "react-router";

export class DocsContentBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <div role="alert" className="surface-card my-10">
        <h1 className="mb-3 font-display text-3xl">This page could not load</h1>
        <p className="mb-6 text-ink-muted">The navigation is still available. Reload this page or return to the overview.</p>
        <div className="flex flex-wrap gap-4">
          <button type="button" onClick={() => window.location.reload()} className="docs-button">Reload page</button>
          <Link to="/docs" className="docs-button-secondary">Project overview</Link>
        </div>
      </div>;
    }
    return this.props.children;
  }
}
