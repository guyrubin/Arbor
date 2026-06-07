import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { track } from "../lib/analytics";

/**
 * Catches render errors in a subtree and shows a friendly retry card instead of
 * crashing the whole app. (Class component is required for error boundaries.)
 */
type ErrorBoundaryProps = { children?: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; message: string };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, message: error?.message || "Something went wrong." };
  }

  componentDidCatch(error: any) {
    console.error("Arbor tab error:", error);
    try {
      track("error", {
        message: String(error?.message || error).slice(0, 300),
        stack: String(error?.stack || "").slice(0, 600),
      });
    } catch {
      /* never let logging crash the boundary */
    }
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    const { hasError, message } = this.state;

    if (hasError) {
      return (
        <div className="bg-white rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto mt-10" style={{ border: "1px solid rgba(189,79,116,0.30)", boxShadow: "0 2px 10px rgba(41,51,63,0.05)" }}>
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "#fce2ec" }}>
            <AlertTriangle className="w-6 h-6" style={{ color: "#bd4f74" }} />
          </div>
          <h3 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>This section hit a snag</h3>
          <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{message}</p>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
