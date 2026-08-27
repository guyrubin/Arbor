import React, { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { trackErrorBannerShown } from "../../lib/loopEvents";

/** Inline error + retry. Sibling of EmptyState/Skeleton. Use whenever an async
 *  read fails so the surface never silently degrades to an empty state. */
export function ErrorState({
  headline,
  body,
  onRetry,
  retryLabel = "Try again",
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
  // N8 KPI 6: every rendered error banner counts once per mount.
  useEffect(() => {
    trackErrorBannerShown(surface);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center gap-3 py-10 px-6 ${className}`}
    >
      <span
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)" }}
      >
        <AlertTriangle className="w-6 h-6" />
      </span>
      <h3
        className="text-base font-extrabold tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
      >
        {headline ?? "We couldn't load this"}
      </h3>
      <p className="text-xs max-w-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
        {body ?? "Something interrupted the connection. Your data is safe — give it another try."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 min-h-[44px] mt-1 transition disabled:opacity-60"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          <RefreshCw className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`} /> {retryLabel}
        </button>
      )}
    </div>
  );
}

export default ErrorState;
