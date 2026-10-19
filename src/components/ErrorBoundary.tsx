import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; fallbackLevel?: number; pageName?: string }
interface State { hasError: boolean }
/** Never remount a failed paid action automatically or erase member caches. */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(): State { return { hasError: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    console.error("Oracle page recovery needed", this.props.pageName ?? "App");
    window.dispatchEvent(new Event("oracle:page-error"));
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-lg font-bold text-foreground">This page couldn’t continue</h1>
          <p className="text-sm text-muted-foreground">Your device’s saved drafts have not been cleared. Check any payment or generation result before repeating it.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => this.setState({ hasError: false })}><RefreshCw className="w-4 h-4 mr-2" />Reopen page</Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}><Home className="w-4 h-4 mr-2" />Home</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      </main>
    );
  }
}
export default ErrorBoundary;
