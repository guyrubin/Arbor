/**
 * KidErrorBoundary — KID-22 (lane K): Kid Mode's own error boundary.
 *
 * The Shell's ErrorBoundary wraps the PARENT content area only; KidModeOverlay
 * mounts beside it, so a render throw inside a kid surface (KID-01 was a live
 * trigger) unmounted the whole app in front of a child. This boundary sits
 * INSIDE the overlay, around the surface area only:
 *   - the hold-to-exit control stays mounted in the header ABOVE it, so a
 *     crash can never open, weaken or bypass the parent gate;
 *   - the fallback is kid-register: one big control, "Home", which routes back
 *     to the dashboard (`onHome` → setView("home")) — never an exit, never a
 *     parent surface, never a raw error message;
 *   - the throw is logged through the existing analytics seam
 *     (track("error"), the same call components/ErrorBoundary.tsx makes —
 *     kid-mode events are already stripped of attribution by lib/analytics).
 *
 * The lock invariant is pinned by components/kidmode/kidLock.test.ts: catching
 * an error never touches the kidModeGate, and the fallback renders exactly one
 * button. Styling: TOKEN-ONLY, logical properties, ≥ 48 px target.
 */
import React from "react";
import { track } from "../../lib/analytics";

/** The kid-register fallback. Exported so the node harness can render it
 *  directly (react-dom/server does not run class boundaries). */
export function KidCrashFallback({ title, homeLabel, onHome }: { title: string; homeLabel: string; onHome: () => void }) {
  return (
    <div
      role="alert"
      className="play-pop-in"
      style={{
        maxInlineSize: "420px",
        marginInline: "auto",
        marginBlockStart: "32px",
        padding: "28px 24px",
        borderRadius: "var(--play-radius-lg, 28px)",
        background: "var(--arbor-paper-elevated)",
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "18px",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "3rem", lineHeight: 1 }}>🗺️</span>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "var(--t-xl)", color: "var(--arbor-ink)", margin: 0 }}>
        {title}
      </p>
      <button
        type="button"
        onClick={onHome}
        autoFocus
        className="play-pressable"
        style={{
          appearance: "none",
          cursor: "pointer",
          minHeight: "54px",
          minInlineSize: "160px",
          paddingInline: "28px",
          borderRadius: "999px",
          border: "none",
          fontWeight: 900,
          fontSize: "var(--t-lg)",
          background: "var(--arbor-clay)",
          color: "var(--arbor-on-accent)",
        }}
      >
        {homeLabel}
      </button>
    </div>
  );
}

interface Props {
  /** Routes the child back to the dashboard. The ONLY action the fallback offers. */
  onHome: () => void;
  title: string;
  homeLabel: string;
  /** Changing this (e.g. the surface in view) clears a caught error. */
  resetKey?: string;
  children?: React.ReactNode;
}
interface State {
  hasError: boolean;
}

export class KidErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    try {
      const err = error as { message?: unknown; stack?: unknown } | null;
      track("error", {
        surface: "kidmode",
        message: String(err?.message ?? error).slice(0, 300),
        stack: String(err?.stack ?? "").slice(0, 600),
      });
    } catch {
      /* logging must never re-throw inside the boundary */
    }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private goHome = () => {
    this.setState({ hasError: false });
    this.props.onHome();
  };

  render() {
    if (this.state.hasError) {
      return <KidCrashFallback title={this.props.title} homeLabel={this.props.homeLabel} onHome={this.goHome} />;
    }
    return this.props.children;
  }
}

export default KidErrorBoundary;
