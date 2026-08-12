import React, { useCallback, useEffect, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../../context/LanguageContext";
import { retrySync } from "../../lib/syncStore";
import { statesText } from "../../lib/i18nElevation/states";

/** Content-shaped loading placeholder. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`arbor-skeleton ${className}`} />;
}

/** Generic tab loading fallback used as a Suspense boundary. */
export function TabSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-56" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

/** Masterplan 4.3: a section skeleton stops pretending after ~10s. */
export const SKELETON_TIMEOUT_MS = 10_000;

/**
 * Framework-free timer seam (node-testable): arms the slow-loading timeout
 * unless the section already loaded. Returns the cancel function. The React
 * hook below is a thin useEffect wrapper around this — test THIS with fake
 * timers instead of rendering.
 */
export function watchSkeletonTimeout(
  loaded: boolean,
  onTimeout: () => void,
  timeoutMs: number = SKELETON_TIMEOUT_MS,
): () => void {
  if (loaded) return () => {};
  const id = setTimeout(onTimeout, timeoutMs);
  return () => clearTimeout(id);
}

/**
 * useSkeletonTimeout — flips `timedOut` after ~10s of unloaded skeleton so
 * the surface can swap to a compact "taking longer than expected — retry"
 * row instead of pulsing forever. `restart()` re-arms the timer (call it
 * after a retry). Flipping `loaded` to true resets the state.
 */
export function useSkeletonTimeout(
  loaded: boolean,
  timeoutMs: number = SKELETON_TIMEOUT_MS,
): { timedOut: boolean; restart: () => void } {
  const [generation, setGeneration] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    return watchSkeletonTimeout(loaded, () => setTimedOut(true), timeoutMs);
  }, [loaded, timeoutMs, generation]);
  const restart = useCallback(() => setGeneration((g) => g + 1), []);
  return { timedOut, restart };
}

/**
 * SectionSkeleton — the ONE per-section loading shape (masterplan 4.3):
 * mimics a card section's final layout (title line + content rows, reserving
 * real dimensions so nothing jumps on load), and after ~10s flips to a calm
 * inline "still loading — try again" row.
 *
 * Retry: defaults to the W0 syncStore retrySync() (re-mounts every live
 * useChildCollection listener — the same lever as the global banner); pass
 * `onRetry` when the section loads through a different path. The timer
 * re-arms after each retry.
 */
export function SectionSkeleton({
  rows = 3,
  title = true,
  rowClassName = "h-14",
  className = "",
  loaded = false,
  timeoutMs = SKELETON_TIMEOUT_MS,
  onRetry,
  testId,
}: {
  /** Content rows to reserve (match the section's expected item count). */
  rows?: number;
  /** Reserve a section-title line above the rows. */
  title?: boolean;
  /** Height/shape class per row — size it to the section's real row. */
  rowClassName?: string;
  className?: string;
  /** Disarms the slow-timeout (parents usually unmount instead — optional). */
  loaded?: boolean;
  timeoutMs?: number;
  /** Custom retry; defaults to the W0 syncStore retrySync(). */
  onRetry?: () => void;
  testId?: string;
}) {
  const { uiLang } = useLanguage();
  const heMode = uiLang === "he";
  const { timedOut, restart } = useSkeletonTimeout(loaded, timeoutMs);

  if (timedOut) {
    return (
      <div
        role="status"
        data-testid={testId ? `${testId}-slow` : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-1.5 ${className}`}
        style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
      >
        <Icon name="hourglass_top" size={18} style={{ color: "var(--arbor-muted)" }} />
        <span className="min-w-0 flex-1 text-xs font-medium" dir="auto">
          {statesText("elev.states.slow", heMode)}
        </span>
        <button
          type="button"
          onClick={() => {
            (onRetry ?? retrySync)();
            restart();
          }}
          className="flex-shrink-0 rounded-xl px-3 py-2 min-h-[44px] text-[11px] font-bold transition"
          dir="auto"
          style={{ background: "var(--arbor-paper)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          {statesText("elev.states.retry", heMode)}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} aria-hidden data-testid={testId}>
      {title && <Skeleton className="h-5 w-40" />}
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}

export default Skeleton;
