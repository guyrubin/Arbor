/**
 * Kid Mode Overlay (AP-048, viral-redesign P0 shell).
 *
 * Full-screen child surface. The DEFAULT view is now a personalized dashboard
 * (KidDashboard); the existing child surfaces are surfaced UNCHANGED behind it,
 * each opened from a dashboard tile — re-shell, never fork:
 *   - HeroJourneyTab  (Hero Stories)
 *   - PracticeHubTab  (Playbank / Games / Studio)
 *   - FeelingsLabTab  (Feelings)
 *
 * Parent gate: hold-to-exit button (3 s hold), now reused in both the dashboard
 * header and the surface back-bar. Pure friction — no PIN, no Firestore call, no
 * child-data mutation on enter OR exit. Escape is blocked; focus is trapped.
 *
 * Styling: TOKEN-ONLY (var(--arbor-*), zero raw hex), RTL-safe (logical CSS
 * properties), scoped under `.arbor-play` for the child type scale.
 */
import React, { lazy, Suspense, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useKidMode } from "./KidModeContext";
import { TabSkeleton } from "../ui/Skeleton";
import { useLanguage } from "../../context/LanguageContext";
import KidDashboard, { type KidSurface } from "./KidDashboard";
import { HoldExitButton } from "./HoldExitButton";

// ── EXISTING surfaces — imported unchanged, never forked ──────────────────────
const HeroJourneyTab = lazy(() => import("../tabs/HeroJourneyTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const FeelingsLabTab = lazy(() => import("../practice/FeelingsLabTab"));

const SURFACE_META: Record<KidSurface, { label: string; Comp: React.ComponentType }> = {
  journeys: { label: "Hero Stories", Comp: HeroJourneyTab },
  arcade: { label: "Playbank", Comp: PracticeHubTab },
  feelings: { label: "Feelings", Comp: FeelingsLabTab },
};

type View = "home" | KidSurface;

export default function KidModeOverlay() {
  const { isKidModeOpen, closeKidMode } = useKidMode();
  const { t } = useLanguage();
  const [view, setView] = useState<View>("home");

  // Reset to the home dashboard whenever the overlay opens.
  useEffect(() => {
    if (isKidModeOpen) setView("home");
  }, [isKidModeOpen]);

  // Block Escape inside Kid Mode — a child must not press Escape to exit. The
  // parent gate (hold button) is the only way out.
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

  const surface = view === "home" ? null : SURFACE_META[view];

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
          {/* ── Surface back-bar (only when a surface is open) ──────────────── */}
          {surface && (
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
              <button
                onClick={() => setView("home")}
                aria-label="Back to home"
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
                  background: "var(--arbor-paper-deep)",
                  color: "var(--arbor-clay)",
                  border: "1px solid var(--arbor-rule)",
                  cursor: "pointer",
                }}
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Home
              </button>
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
                {surface.label}
              </span>
              <HoldExitButton onExit={closeKidMode} idleLabel="Back to parent" ariaIdle="Hold to go back to parent" />
            </header>
          )}

          {/* ── Content area ───────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingInline: "20px",
              paddingBlock: "24px",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                {view === "home" ? (
                  <KidDashboard onOpenSurface={setView} onExit={closeKidMode} />
                ) : (
                  <Suspense fallback={<TabSkeleton />}>{surface && <surface.Comp />}</Suspense>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
