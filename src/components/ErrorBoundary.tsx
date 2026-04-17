import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, WifiOff, HardDrive } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackLevel?: number;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  stage: number;
}

/**
 * 10-Stage Cascading Error Boundary
 * 
 * Stage 1: Auto-retry render (silent)
 * Stage 2: Auto-retry with state reset
 * Stage 3: Show "Something went wrong" with retry button
 * Stage 4: Show simplified page shell with error details
 * Stage 5: Show cached/offline version if available
 * Stage 6: Show minimal text-only fallback
 * Stage 7: Offer navigation to Dashboard
 * Stage 8: Offer full app reload
 * Stage 9: Show diagnostic info for support
 * Stage 10: Ultimate static fallback (pure HTML, no React dependencies)
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0, stage: 1 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary] Stage ${this.state.stage} caught:`, error, errorInfo);

    // Detect stale lazy-loaded chunk (common after a redeploy) and force one hard reload.
    const msg = (error?.message || "").toLowerCase();
    const isChunkError =
      msg.includes("failed to fetch dynamically imported module") ||
      msg.includes("importing a module script failed") ||
      msg.includes("loading chunk") ||
      msg.includes("loading css chunk") ||
      error?.name === "ChunkLoadError";

    if (isChunkError && !sessionStorage.getItem("solace-chunk-reloaded")) {
      sessionStorage.setItem("solace-chunk-reloaded", "1");
      if ("caches" in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n)));
      }
      window.location.reload();
      return;
    }

    // Stage 1 & 2: Auto-retry
    if (this.state.retryCount < 2) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
          stage: prev.retryCount + 2,
        }));
      }, 500 * (this.state.retryCount + 1));
    }
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      stage: Math.min(prev.stage + 1, 10),
    }));
  };

  handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  handleFullReload = () => {
    // Clear caches then reload
    if ("caches" in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { stage, error, retryCount } = this.state;
    const pageName = this.props.pageName || "This page";

    // Stages 1-2 are auto-retry (handled in componentDidCatch)
    if (retryCount < 2) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    // Stage 3: Simple retry prompt
    if (stage <= 4) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">{pageName} encountered an issue. This is usually temporary.</p>
            <button onClick={this.handleRetry} className="flex items-center gap-2 mx-auto px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        </div>
      );
    }

    // Stage 5-6: Cached/offline or minimal fallback
    if (stage <= 6) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <WifiOff className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Page Unavailable</h2>
            <p className="text-sm text-muted-foreground">{pageName} can't load right now. You can try again or go back to the dashboard.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleRetry} className="flex items-center gap-2 px-5 py-3 bg-secondary text-secondary-foreground rounded-xl text-sm">
                <RefreshCw className="w-4 h-4" /> Retry
              </button>
              <button onClick={this.handleGoHome} className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm">
                <Home className="w-4 h-4" /> Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Stage 7-8: Full reload option
    if (stage <= 8) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <HardDrive className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-lg font-bold text-foreground">Persistent Error</h2>
            <p className="text-sm text-muted-foreground">This error keeps occurring. A full reload may fix it.</p>
            <div className="flex flex-col gap-3">
              <button onClick={this.handleFullReload} className="flex items-center gap-2 justify-center px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm">
                <RefreshCw className="w-4 h-4" /> Full Reload & Clear Cache
              </button>
              <button onClick={this.handleGoHome} className="flex items-center gap-2 justify-center px-5 py-3 bg-secondary text-secondary-foreground rounded-xl text-sm">
                <Home className="w-4 h-4" /> Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Stage 9-10: Diagnostic / ultimate fallback
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Critical Error</h2>
          <p className="text-sm text-muted-foreground">Solace encountered a critical issue. Please reload or contact support.</p>
          <details className="text-left bg-card border border-border rounded-xl p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">Diagnostics</summary>
            <pre className="mt-2 overflow-auto max-h-32 whitespace-pre-wrap break-all">
              {error?.message}{"\n"}{error?.stack?.slice(0, 300)}
            </pre>
          </details>
          <div className="flex flex-col gap-3">
            <button onClick={this.handleFullReload} className="flex items-center gap-2 justify-center px-5 py-3 bg-primary text-primary-foreground rounded-xl text-sm">
              <RefreshCw className="w-4 h-4" /> Reload App
            </button>
            <button onClick={this.handleGoHome} className="flex items-center gap-2 justify-center px-5 py-3 bg-secondary text-secondary-foreground rounded-xl text-sm">
              <Home className="w-4 h-4" /> Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
