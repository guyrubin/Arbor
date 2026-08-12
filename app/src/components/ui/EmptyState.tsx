import React from "react";

/**
 * EmptyState — the ONE empty-state shape (masterplan 4.3: "EmptyStates that
 * TEACH"). Centered column: optional ghost `preview` of the filled state,
 * optional icon/illustration, headline, body, one primary `cta`, and an
 * optional freeform `action` node (kept for back-compat).
 *
 * TEACH-EMPTY CONVENTIONS (2025 pattern — copy lives in i18n, en+he):
 *  - `preview` shows a ghosted/muted miniature of what the FILLED state will
 *    look like (compose it from <GhostBlock/> rows) so the empty screen
 *    teaches instead of apologizing. It is decorative: rendered aria-hidden,
 *    non-interactive, faded out toward the bottom.
 *  - Copy is encouraging and forward-looking ("the story starts with one
 *    moment"), states what the first item will become, and offers exactly
 *    ONE clear next step (`cta` + `onCta`). Never celebrate the zero itself,
 *    never render counts of nothing, never guilt ("you haven't…").
 *  - Clinical firewall applies to empty copy too: plain activity facts only —
 *    no %, verdicts, or trend language.
 *
 * BACK-COMPAT: the original API (icon / headline / body / action / className)
 * is unchanged — existing consumers render byte-identically when the new
 * props are omitted.
 */
export function EmptyState({
  icon,
  headline,
  body,
  action,
  className = "",
  preview,
  cta,
  onCta,
  ctaTestId,
}: {
  icon?: React.ReactNode;
  headline: string;
  body?: string;
  /** Freeform node under the body (legacy slot — e.g. a code sample). */
  action?: React.ReactNode;
  className?: string;
  /** Ghosted miniature of the filled state (decorative, aria-hidden). */
  preview?: React.ReactNode;
  /** Label for the ONE primary action. Rendered only with `onCta`. */
  cta?: string;
  onCta?: () => void;
  ctaTestId?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}>
      {preview && (
        <div
          aria-hidden
          className="w-full select-none pointer-events-none mb-1"
          style={{
            opacity: 0.55,
            maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
          }}
        >
          {preview}
        </div>
      )}
      {icon && <div style={{ color: "var(--arbor-green-ink)" }}>{icon}</div>}
      <h3 className="text-xl font-extrabold tracking-tight" dir="auto" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{headline}</h3>
      {body && <p className="text-xs max-w-sm leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>{body}</p>}
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          data-testid={ctaTestId}
          className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl px-5 min-h-[44px] mt-1 transition active:scale-[0.98]"
          dir="auto"
          style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
        >
          {cta}
        </button>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/**
 * GhostBlock — a static muted placeholder block for composing teach-empty
 * `preview` miniatures. Deliberately NOT the pulsing `arbor-skeleton` class:
 * a ghost preview is not loading, so it must not animate (and stays quiet
 * under prefers-reduced-motion by construction).
 */
export function GhostBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`rounded-lg ${className}`}
      style={{ background: "var(--arbor-paper-deep)", ...style }}
    />
  );
}

export default EmptyState;
