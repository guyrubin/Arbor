import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { trackErrorBannerShown } from "../../lib/loopEvents";
import { useLanguage } from "../../context/LanguageContext";
import { statesText } from "../../lib/i18nElevation/states";

/** Inline error + retry. Sibling of EmptyState/Skeleton. Use whenever an async
 *  read fails so the surface never silently degrades to an empty state. */
export function ErrorState({
  headline,
  body,
  onRetry,
  retryLabel,
  retrying = false,
  className = "",
  surface,
}: {
  headline?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
  /** N8 KPI 6: short analytics id for the degraded surface ("today-focus",
   *  "care-team", …). Id only — the headline/body copy never reaches analytics. */
  surface?: string;
}) {
  const { uiLang } = useLanguage();
  const heMode = uiLang === "he";
  // N8 KPI 6: every rendered error banner counts once per mount.
  useEffect(() => {
    trackErrorBannerShown(surface);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      role="alert"
      lang={uiLang}
      dir={heMode ? "rtl" : "ltr"}
      className={`flex min-w-0 max-w-full flex-col items-center justify-center text-center gap-3 py-10 px-6 ${className}`}
    >
      <span
        aria-hidden="true"
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}
      >
        <AlertTriangle className="w-6 h-6" />
      </span>
      <h3
        dir="auto"
        className="max-w-full text-base font-extrabold tracking-tight [overflow-wrap:anywhere]"
        style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
      >
        {headline ?? statesText("elev.states.error.head", heMode)}
      </h3>
      <p dir="auto" className="w-full text-sm max-w-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--arbor-muted)" }}>
        {body ?? statesText("elev.states.error.body", heMode)}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          aria-busy={retrying}
          className="inline-flex items-center justify-center gap-2 max-w-full font-bold text-sm rounded-2xl px-5 min-h-[44px] min-w-[44px] mt-1 transition disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <RefreshCw aria-hidden="true" className={`w-4 h-4 shrink-0 ${retrying ? "motion-safe:animate-spin" : ""}`} />
          <span dir="auto" className="min-w-0 [overflow-wrap:anywhere]">
            {retryLabel ?? statesText(retrying ? "elev.states.retrying" : "elev.states.retry", heMode)}
          </span>
        </button>
      )}
    </div>
  );
}

export default ErrorState;
