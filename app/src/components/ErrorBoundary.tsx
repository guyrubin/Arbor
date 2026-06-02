import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { track } from "../lib/analytics";

/**
 * Catches render errors in a subtree and shows a friendly retry card instead of
 * crashing the whole app. (Class component is required for error boundaries.)
 */
export class ErrorBoundary extends React.Component {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: any) {
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

  reset = () => (this as any).setState({ hasError: false, message: "" });

  render() {
    const state = this.state as { hasError: boolean; message: string };
    const props = (this as any).props as { children: React.ReactNode };

    if (state.hasError) {
      return (
        <div className="bg-[#141821] border border-[#e2562d]/30 rounded-3xl p-8 text-center space-y-4 max-w-md mx-auto mt-10">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#e2562d]/15 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-[#e2562d]" />
          </div>
          <h3 className="text-lg font-extrabold text-white">This section hit a snag</h3>
          <p className="text-xs text-[#a8a093] leading-relaxed">{state.message}</p>
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 bg-[#d7aa55] hover:bg-[#c39947] text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition active:scale-[0.97]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      );
    }
    return props.children;
  }
}

export default ErrorBoundary;
