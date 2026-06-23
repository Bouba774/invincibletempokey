import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Global React error boundary used by the Capacitor SPA bootstrap.
 * Guarantees no unhandled render crash ever leaves the WebView blank.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[TempoKey] ErrorBoundary caught", error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        style={{
          padding: 24,
          minHeight: "100dvh",
          background: "#0A0D14",
          color: "#e6e8ee",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
          TempoKey a rencontré une erreur
        </h1>
        <p style={{ fontSize: 13, color: "#8a90a2", margin: "0 0 16px" }}>
          L'application a été interrompue. Vous pouvez réessayer ou redémarrer.
        </p>
        <pre
          style={{
            fontSize: 11,
            background: "#11151f",
            color: "#c0c5d3",
            padding: 12,
            borderRadius: 8,
            overflow: "auto",
            maxHeight: 200,
            margin: "0 0 16px",
          }}
        >
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={this.reset}
            style={{
              background: "#7c5cff",
              color: "#fff",
              border: 0,
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            Réessayer
          </button>
          <button
            onClick={() => location.reload()}
            style={{
              background: "transparent",
              color: "#e6e8ee",
              border: "1px solid #2a3142",
              padding: "10px 16px",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            Redémarrer
          </button>
        </div>
      </div>
    );
  }
}
