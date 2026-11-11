import React from "react";
import { Icon } from "./ui/Icon";
import { track } from "../lib/analytics";
import { statesText } from "../lib/i18nElevation/states";
import { isStaleBuildError, reloadIntoCurrentBuild } from "../lib/staleBuild";

/**
 * Catches render errors in the tab subtree below the app providers instead of
 * crashing the whole app. This is not a global boundary for provider failures.
 * A lazy chunk removed by a newer release (lib/staleBuild) cannot be retried:
 * React.lazy keeps the rejection, so that case reloads once and otherwise
 * offers Reload in place of Try again.
 */
type ErrorBoundaryProps = {
  children?: React.ReactNode;
  /** Shows the fallback above the page, for a sheet mounted outside `main`. */
  floating?: boolean;
  /** Runs after Try again clears the error (a sheet closes; its opener mounts it fresh). */
  onReset?: () => void;
};
type ErrorBoundaryState = { hasError: boolean; staleBuild?: boolean };

const PRIMARY_CLASS = "inline-flex items-center justify-center gap-2 max-w-full min-h-[44px] min-w-[44px] font-extrabold text-sm px-4 py-2.5 rounded-xl transition motion-safe:active:scale-[0.98]";
const PRIMARY_STYLE: React.CSSProperties = { background: "var(--arbor-clay-deep)", color: "var(--arbor-on-accent)" };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  private languageObserver?: MutationObserver;

  componentDidMount() {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;

    // The language context writes html.lang in a passive effect, after this
    // boundary has rendered. Subscribe without depending on that context.
    const observer = new MutationObserver(() => {
      if (this.languageObserver === observer && this.state.hasError) {
        this.forceUpdate();
      }
    });
    this.languageObserver = observer;
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  componentWillUnmount() {
    this.languageObserver?.disconnect();
    this.languageObserver = undefined;
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return isStaleBuildError(error) ? { hasError: true, staleBuild: true } : { hasError: true };
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
    // Usually vite:preloadError already started this reload; the guard makes
    // the second call a no-op and stops a loop on a real outage.
    if (isStaleBuildError(error)) reloadIntoCurrentBuild();
  }

  reset = () => {
    this.setState({ hasError: false, staleBuild: false });
    this.props.onReset?.();
  };

  reload = () => window.location.reload();

  goToToday = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // A full reload starts again at Today. The URL hash wins
    // over the stored tab on startup, so this escapes a crashing section.
    window.location.hash = "#/overview";
    window.location.reload();
  };

  render() {
    const { hasError, staleBuild } = this.state;

    if (hasError) {
      // Read the document language set by the language context and bootstrap.
      // The observer refreshes this fallback after language effects run.
      const lang = typeof document === "undefined" ? "en" : document.documentElement.lang;
      const baseLang = lang.toLowerCase().split("-")[0];
      const heMode = baseLang === "he" || baseLang === "iw";
      const card = (
        <div
          role="alert"
          lang={heMode ? "he" : "en"}
          dir={heMode ? "rtl" : "ltr"}
          data-stale-build={staleBuild || undefined}
          className={`rounded-3xl p-6 sm:p-8 text-center space-y-4 w-full min-w-0 max-w-md mx-auto${this.props.floating ? "" : " mt-10"}`}
          style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}
        >
          <div aria-hidden="true" className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--arbor-peach-soft)" }}>
            <Icon name={staleBuild ? "restart_alt" : "warning"} size={24} style={{ color: "var(--arbor-peach-ink)" }} />
          </div>
          <h3 dir="auto" className="text-lg font-extrabold [overflow-wrap:anywhere]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {statesText(staleBuild ? "elev.states.update.head" : "elev.states.error.head", heMode)}
          </h3>
          <p dir="auto" className="text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--arbor-muted)" }}>
            {statesText(staleBuild ? "elev.states.update.body" : "elev.states.error.body", heMode)}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {staleBuild ? (
              <button type="button" onClick={this.reload} className={PRIMARY_CLASS} style={PRIMARY_STYLE}>
                <Icon name="restart_alt" size={16} className="shrink-0" />
                <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">{statesText("elev.states.update.reload", heMode)}</span>
              </button>
            ) : (
              <button type="button" onClick={this.reset} className={PRIMARY_CLASS} style={PRIMARY_STYLE}>
                <Icon name="restart_alt" size={16} className="shrink-0" />
                <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">{statesText("elev.states.retry", heMode)}</span>
              </button>
            )}
            {!staleBuild && <a
              href="#/overview"
              onClick={this.goToToday}
              className="inline-flex items-center justify-center max-w-full min-h-[44px] min-w-[44px] font-bold text-sm px-4 py-2.5 rounded-xl underline underline-offset-4 [overflow-wrap:anywhere]"
              style={{ color: "var(--arbor-ink)" }}
            >
              {statesText("elev.states.error.today", heMode)}
            </a>}
          </div>
          <p dir="auto" className="text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--arbor-muted)" }}>
            {statesText(staleBuild ? "elev.states.update.note" : "elev.states.error.escapeNote", heMode)}
          </p>
        </div>
      );
      if (!this.props.floating) return card;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, var(--arbor-ink) 28%, transparent)" }}>
          {card}
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
