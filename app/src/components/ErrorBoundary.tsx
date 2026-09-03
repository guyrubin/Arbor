import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { track } from "../lib/analytics";
import { statesText } from "../lib/i18nElevation/states";

/**
 * Catches render errors in a subtree and shows a friendly retry card instead of
 * crashing the whole app. (Class component is required for error boundaries.)
 */
type ErrorBoundaryProps = { children?: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Arbor tab error:", error);
    try {
      const err = error as { message?: unknown; stack?: unknown } | null;
      track("error", {
        message: String(err?.message || error).slice(0, 300),
        stack: String(err?.stack || "").slice(0, 600),
      });
    } catch {
      /* never let logging crash the boundary */
    }
  }

  reset = () => this.setState({ hasError: false });

  goToToday = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // A full reload also recovers when a provider failed. The URL hash wins
    // over the stored tab on startup, so this escapes a crashing section.
    window.location.hash = "#/overview";
    window.location.reload();
  };

  render() {
    const { hasError } = this.state;

    if (hasError) {
      // The provider may itself be the failed subtree. Read the document
      // language it (and the first-visit bootstrap) sets, without a context.
      const lang = typeof document === "undefined" ? "en" : document.documentElement.lang;
      const baseLang = lang.toLowerCase().split("-")[0];
      const heMode = baseLang === "he" || baseLang === "iw";
      return (
        <div
          role="alert"
          lang={heMode ? "he" : "en"}
          dir={heMode ? "rtl" : "ltr"}
          className="rounded-3xl p-6 sm:p-8 text-center space-y-4 w-full min-w-0 max-w-md mx-auto mt-10"
          style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}
        >
          <div aria-hidden="true" className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--arbor-peach-soft)" }}>
            <AlertTriangle className="w-6 h-6" style={{ color: "var(--arbor-peach-ink)" }} />
          </div>
          <h3 dir="auto" className="text-lg font-extrabold [overflow-wrap:anywhere]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {statesText("elev.states.error.head", heMode)}
          </h3>
          <p dir="auto" className="text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--arbor-muted)" }}>
            {statesText("elev.states.error.body", heMode)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center justify-center gap-2 max-w-full min-h-[44px] min-w-[44px] font-extrabold text-sm px-4 py-2.5 rounded-xl transition motion-safe:active:scale-[0.98]"
              style={{ background: "var(--arbor-clay-deep)", color: "var(--arbor-on-accent)" }}
            >
              <RotateCcw aria-hidden="true" className="w-4 h-4 shrink-0" />
              <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">{statesText("elev.states.retry", heMode)}</span>
            </button>
            <a
              href="#/overview"
              onClick={this.goToToday}
              className="inline-flex items-center justify-center max-w-full min-h-[44px] min-w-[44px] font-bold text-sm px-4 py-2.5 rounded-xl underline underline-offset-4 [overflow-wrap:anywhere]"
              style={{ color: "var(--arbor-ink)" }}
            >
              {statesText("elev.states.error.today", heMode)}
            </a>
          </div>
          <p dir="auto" className="text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--arbor-muted)" }}>
            {statesText("elev.states.error.escapeNote", heMode)}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
