/**
 * AP-048: Kid Mode Overlay
 *
 * Full-screen child-calm overlay that surfaces the EXISTING child-facing
 * surfaces unchanged. All three surfaces are imported — never forked:
 *   - HeroJourneyTab  (Hero Journeys, 10 stories)
 *   - PracticeHubTab  (Hero Arcade — 14+ worlds via AdventuresTab, plus
 *                      FeelingsLabTab, SpeechCoachTab, MimicStudioTab)
 *   - FeelingsLabTab  (Feelings check-in surface, standalone tab)
 *
 * Parent gate: hold-to-exit button (3 s hold). Pure friction — no PIN stored,
 * no Firestore call, no child-data mutation on enter OR exit.
 *
 * Styling:
 *   - TOKEN-ONLY: every color via var(--arbor-*). Zero raw hex literals.
 *   - RTL: all directional layout uses logical CSS properties (insetInlineEnd,
 *     marginInlineStart, etc.). No physical left/right in inline styles.
 *   - Scoped under `.arbor-play` for child-register type scale.
 */
import React, { lazy, Suspense, useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, HeartPulse, Map, X } from "lucide-react";
import { useKidMode } from "./KidModeContext";
import { holdProgress, holdComplete, HOLD_MS } from "./parentGate";
import { TabSkeleton } from "../ui/Skeleton";
import { ArborMascot } from "../ui/ArborMascot";
import { useLanguage } from "../../context/LanguageContext";

// ── EXISTING surfaces — imported unchanged, never forked ──────────────────────
const HeroJourneyTab = lazy(() => import("../tabs/HeroJourneyTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const FeelingsLabTab = lazy(() => import("../practice/FeelingsLabTab"));

// ── Surface registry ──────────────────────────────────────────────────────────
type KidSurface = "journeys" | "arcade" | "feelings";
interface SurfaceEntry {
  id: KidSurface;
  label: string;
  labelHe: string;
  Icon: React.ComponentType<{ className?: string }>;
  Comp: React.ComponentType;
}

const SURFACES: SurfaceEntry[] = [
  {
    id: "journeys",
    label: "Story Quests",
    labelHe: "מסעות סיפור",
    Icon: BookOpen,
    Comp: HeroJourneyTab,
  },
  {
    id: "arcade",
    label: "Hero Arcade",
    labelHe: "זירת הגיבורים",
    Icon: Map,
    Comp: PracticeHubTab,
  },
  {
    id: "feelings",
    label: "Feelings",
    labelHe: "רגשות",
    Icon: HeartPulse,
    Comp: FeelingsLabTab,
  },
];

// ── Hold-to-exit button ───────────────────────────────────────────────────────
interface HoldExitButtonProps {
  onExit: () => void;
}

function HoldExitButton({ onExit }: HoldExitButtonProps) {
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

  // Clean up RAF on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = holdProgress(elapsed);
  const circumference = 2 * Math.PI * 18; // radius=18

  return (
    <div
      style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px" }}
    >
      <button
        aria-label={holding ? `Hold to exit Kid Mode — ${Math.round(progress)}%` : "Hold to exit Kid Mode"}
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
          /* Prevent context menu on long-press on mobile */
          WebkitTouchCallout: "none",
        }}
      >
        {/* Circular progress ring — SVG on top of the icon */}
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
        {holding ? `Hold… ${Math.ceil((HOLD_MS - elapsed) / 1000)}s` : "Hold to exit"}
      </span>
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────
export default function KidModeOverlay() {
  const { isKidModeOpen, closeKidMode } = useKidMode();
  const { t } = useLanguage();
  const [activeSurface, setActiveSurface] = useState<KidSurface>("journeys");

  // Reset surface to default when overlay opens.
  useEffect(() => {
    if (isKidModeOpen) setActiveSurface("journeys");
  }, [isKidModeOpen]);

  // Trap focus and block Escape key inside Kid Mode — a child must not press
  // Escape to exit. The parent gate (hold button) is the only exit.
  useEffect(() => {
    if (!isKidModeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isKidModeOpen]);

  const ActiveComp = SURFACES.find((s) => s.id === activeSurface)?.Comp ?? HeroJourneyTab;

  return (
    <AnimatePresence>
      {isKidModeOpen && (
        <motion.div
          key="kid-mode-overlay"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={t("aria.kidMode")}
          className="arbor-play"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            flexDirection: "column",
            background: "var(--arbor-paper)",
            overflow: "hidden",
          }}
        >
          {/* ── Topbar ──────────────────────────────────────────────────────── */}
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              paddingInline: "20px",
              paddingBlock: "10px",
              flexShrink: 0,
              background: "var(--arbor-paper-elevated)",
              borderBottom: "1px solid var(--arbor-rule)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            {/* Brand + mascot */}
            <ArborMascot size={36} mood="wave" animate className="flex-shrink-0" />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: "var(--t-xl)",
                color: "var(--arbor-clay)",
                flex: 1,
                minWidth: 0,
              }}
            >
              Kid Mode
            </span>

            {/* Surface tabs */}
            <nav
              aria-label={t("aria.kidModeSections")}
              role="tablist"
              style={{ display: "flex", gap: "6px", alignItems: "center" }}
            >
              {SURFACES.map((s) => {
                const on = s.id === activeSurface;
                const Icon = s.Icon;
                return (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveSurface(s.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      paddingInline: "14px",
                      paddingBlock: "10px",
                      minHeight: "44px",
                      borderRadius: "var(--r)",
                      fontWeight: 800,
                      fontSize: "var(--t-sm)",
                      whiteSpace: "nowrap",
                      transition: "background 120ms, color 120ms",
                      background: on ? "var(--arbor-green-soft)" : "var(--arbor-paper-deep)",
                      color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)",
                      border: on ? "1px solid var(--arbor-clay-dim)" : "1px solid var(--arbor-rule)",
                      boxShadow: on ? "var(--shadow-xs)" : "none",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Parent exit gate */}
            <HoldExitButton onExit={closeKidMode} />
          </header>

          {/* ── Content area ─────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingInline: "20px",
              paddingBlock: "24px",
            }}
          >
            <Suspense fallback={<TabSkeleton />}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeSurface}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  <ActiveComp />
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
