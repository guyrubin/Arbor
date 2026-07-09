/**
 * HoldExitButton — the parent gate. A hold-to-confirm button (3 s) that is the
 * ONLY way out of Kid Mode. E10 hardening: completing the hold now SUMMONS the
 * parent challenge (2-digit math question / optional device-local PIN) instead
 * of exiting directly — hold → challenge → exit. Still no Firestore call and
 * no child-data mutation. Extracted from KidModeOverlay so both the dashboard
 * "Back to parent" control and the surface-view back-bar reuse one gate.
 *
 * The hold interaction, ring visual, and idle/holding label props are
 * unchanged; the kid-facing side stays graphic (ring + X glyph).
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { holdProgress, holdComplete, HOLD_MS } from "./parentGate";
import { ParentChallenge } from "./ParentChallenge";

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
  // E10: a completed hold summons the parent challenge; only a correct
  // answer (or PIN) fires onExit. Dismissing stays inside Kid Mode.
  const [challengeOpen, setChallengeOpen] = useState(false);

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
      setChallengeOpen(true);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [cancelHold]);

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
      {challengeOpen && (
        <ParentChallenge
          onSuccess={() => { setChallengeOpen(false); onExit(); }}
          onDismiss={() => setChallengeOpen(false)}
        />
      )}
    </div>
  );
}

export default HoldExitButton;
