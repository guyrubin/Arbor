/**
 * HoldExitButton — the parent gate. A hold-to-confirm button (3 s) that is the
 * ONLY way out of Kid Mode. E10 hardening: completing the hold now SUMMONS the
 * parent challenge (2-digit math question / optional device-local PIN) instead
 * of exiting directly — hold → challenge → exit. Still no Firestore call and
 * no child-data mutation. Extracted from KidModeOverlay so both the dashboard
 * "Back to parent" control and the surface-view back-bar reuse one gate.
 *
 * F-07 hardening:
 *  - Pointer Events with pointer capture (same pattern as
 *    practice/EarlyReadingTrack) replace the fragile mouse+touch handler pairs
 *    — one input model, no duplicate begin on hybrid devices, no cancel from
 *    a stray pointerleave while captured.
 *  - Frame-independent completion: a wall-clock setTimeout(HOLD_MS) armed at
 *    press start opens the gate even if rAF never ticks (hidden tab / frozen
 *    frame loop); rAF only drives the ring visual. Release re-checks
 *    resolveHoldOutcome on Date.now() before cancelling.
 *  - Tap affordance: a press released quickly flashes the hold hint and the
 *    ring renders a faint idle track so the hold gesture is discoverable.
 *
 * KID-1: all visible/accessible copy comes from the i18n `kid.*` namespace
 * (defaults included) — zero hardcoded English.
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { holdProgress, resolveHoldOutcome, HOLD_MS } from "./parentGate";
import { ParentChallenge } from "./ParentChallenge";

interface HoldExitButtonProps {
  onExit: () => void;
  /** Idle caption under the button. Defaults to t("kid.exit.holdIdle"). */
  idleLabel?: string;
  /** Accessible name when idle. Defaults to t("kid.exit.holdAria"). */
  ariaIdle?: string;
}

/** How long the tap-released hold hint stays emphasized (ms). */
const HINT_SHOW_MS = 1600;

export function HoldExitButton({ onExit, idleLabel, ariaIdle }: HoldExitButtonProps) {
  const { t } = useLanguage();
  const idle = idleLabel ?? t("kid.exit.holdIdle");
  const aria = ariaIdle ?? t("kid.exit.holdAria");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  // F-07 tap affordance: a quick tap flashes the hold hint under the button.
  const [hinting, setHinting] = useState(false);
  // E10: a completed hold summons the parent challenge; only a correct
  // answer (or PIN) fires onExit. Dismissing stays inside Kid Mode.
  const [challengeOpen, setChallengeOpen] = useState(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    startRef.current = null;
    setElapsed(0);
    setHolding(false);
  }, []);

  // The one completion path — reached by the wall-clock timer OR by a release
  // whose elapsed time already crossed HOLD_MS.
  const completeHold = useCallback(() => {
    cancelHold();
    setChallengeOpen(true);
  }, [cancelHold]);

  // rAF drives ONLY the ring visual; completion never depends on it (F-07).
  const tick = useCallback(() => {
    if (startRef.current === null) return;
    setElapsed(Date.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const beginHold = useCallback(
    (e: React.PointerEvent) => {
      // Capture so a finger drifting off the button keeps the hold alive
      // until release/cancel (EarlyReadingTrack pattern).
      (e.target as Element).setPointerCapture?.(e.pointerId);
      if (hintTimerRef.current !== null) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
      setHinting(false);
      startRef.current = Date.now();
      setHolding(true);
      setElapsed(0);
      // Frame-independent completion: fires even if rAF never ticks.
      holdTimerRef.current = setTimeout(completeHold, HOLD_MS);
      rafRef.current = requestAnimationFrame(tick);
    },
    [completeHold, tick]
  );

  const releaseHold = useCallback(() => {
    const start = startRef.current;
    if (start === null) return;
    const outcome = resolveHoldOutcome(start, Date.now());
    if (outcome === "complete") {
      completeHold();
      return;
    }
    cancelHold();
    if (outcome === "tap") {
      setHinting(true);
      hintTimerRef.current = setTimeout(() => setHinting(false), HINT_SHOW_MS);
    }
  }, [completeHold, cancelHold]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (holdTimerRef.current !== null) clearTimeout(holdTimerRef.current);
      if (hintTimerRef.current !== null) clearTimeout(hintTimerRef.current);
    };
  }, []);

  const progress = holdProgress(elapsed);
  const circumference = 2 * Math.PI * 18; // radius=18

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <button
        aria-label={holding ? `${aria} — ${Math.round(progress)}%` : aria}
        aria-live="polite"
        onPointerDown={beginHold}
        onPointerUp={releaseHold}
        onPointerCancel={releaseHold}
        onContextMenu={(e) => e.preventDefault()}
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
          touchAction: "none",
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
          {/* Faint idle track — hints that the ring fills on a HOLD. */}
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="var(--arbor-peach-soft)"
            strokeWidth="3"
            opacity={0.9}
          />
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
        role={hinting ? "status" : undefined}
        style={{
          fontSize: "var(--t-xs)",
          fontWeight: hinting ? 800 : 700,
          color: hinting ? "var(--arbor-clay)" : "var(--arbor-muted)",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
          transition: "color 150ms",
        }}
      >
        {holding ? t("kid.exit.holding", { n: Math.ceil((HOLD_MS - elapsed) / 1000) }) : idle}
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
