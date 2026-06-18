import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/** Inline error + retry. Sibling of EmptyState/Skeleton. Use whenever an async
 *  read fails so the surface never silently degrades to an empty state. */
export function ErrorState({
  headline,
  body,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  className = "",
}: {
  headline?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  className?: string;
}) {
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
