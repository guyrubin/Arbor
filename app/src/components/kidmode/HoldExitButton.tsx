/**
 * HoldExitButton — the parent gate. A hold-to-confirm button (3 s) that is the
 * ONLY way out of Kid Mode. Pure friction: no PIN, no Firestore call, no
 * child-data mutation. Extracted from KidModeOverlay so both the dashboard
 * "Back to parent" control and the surface-view back-bar reuse one gate.
 *
 * Behaviour is unchanged from the original inline implementation; only the
 * idle/holding labels are now props so the same gate can read "Back to parent".
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { holdProgress, holdComplete, HOLD_MS } from "./parentGate";

interface HoldExitButtonProps {
  onExit: () => void;
  /** Idle caption under the button. */
  idleLabel?: string;
  /** Accessible name when idle. */
  ariaIdle?: string;
}

export function HoldExitButton({
  onExit,
  idleLabel = "Hold to exit",
  ariaIdle = "Hold to exit Kid Mode",
}: HoldExitButtonProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setElapsed(0);
    setHolding(false);
  }, []);

  const tick = useCallback(() => {
    if (startRef.current === null) return;
    const now = Date.now();
    const ms = now - startRef.current;
    setElapsed(ms);
    if (holdComplete(ms)) {
      cancelHold();
      onExit();
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [cancelHold, onExit]);

  const beginHold = useCallback(() => {
    startRef.current = Date.now();
    setHolding(true);
    setElapsed(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = holdProgress(elapsed);
  const circumference = 2 * Math.PI * 18; // radius=18

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <button
        aria-label={holding ? `${ariaIdle} — ${Math.round(progress)}%` : ariaIdle}
        aria-live="polite"
        onMouseDown={beginHold}
        onTouchStart={beginHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: holding ? "var(--arbor-peach-soft)" : "var(--arbor-paper-elevated)",
          border: "2px solid var(--arbor-rule-strong)",
          cursor: "pointer",
          color: "var(--arbor-muted)",
          transition: "background 100ms",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        <svg
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-2px",
            width: "calc(100% + 4px)",
            height: "calc(100% + 4px)",
            transform: "rotate(-90deg)",
            pointerEvents: "none",
          }}
          viewBox="0 0 44 44"
        >
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="var(--arbor-peach)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${circumference * (1 - progress / 100)}`}
            style={{ transition: holding ? "none" : "stroke-dashoffset 200ms" }}
          />
        </svg>
        <X aria-hidden="true" style={{ width: "20px", height: "20px", pointerEvents: "none" }} />
      </button>
      <span
        style={{
          fontSize: "var(--t-xs)",
          fontWeight: 700,
          color: "var(--arbor-muted)",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        {holding ? `Hold… ${Math.ceil((HOLD_MS - elapsed) / 1000)}s` : idleLabel}
      </span>
    </div>
  );
}

export default HoldExitButton;
