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
 * child-data mutation on enter OR exit. Escape is blocked; focus is trapped
 * for real (KID-2): while open, every sibling of the Kid Mode layers in the
 * Shell mount node is made inert + aria-hidden via shieldShellSiblings, so
 * Tab can never walk focus into the invisible parent shell.
 *
 * Styling: TOKEN-ONLY (var(--arbor-*), zero raw hex), RTL-safe (logical CSS
 * properties), scoped under `.arbor-play` for the child type scale.
 */
import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useKidMode } from "./KidModeContext";
import { shieldShellSiblings } from "./kidModeShield";
import { trapTabKey, type TrapRoot } from "./kidModeFocusTrap";
import { readKidModeState, writeKidModeState } from "../../lib/kidModeGate";
import { TabSkeleton } from "../ui/Skeleton";
import { useLanguage } from "../../context/LanguageContext";
import KidDashboard, { type KidSurface } from "./KidDashboard";
import { HoldExitButton } from "./HoldExitButton";
import { KidErrorBoundary } from "./KidErrorBoundary";

// ── EXISTING surfaces — imported unchanged, never forked ──────────────────────
const HeroJourneyTab = lazy(() => import("../tabs/HeroJourneyTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const FeelingsLabTab = lazy(() => import("../practice/FeelingsLabTab"));

// KID-1: labels are i18n keys (kid.* namespace) resolved with t() at render.
const SURFACE_META: Record<KidSurface, { labelKey: string; Comp: React.ComponentType }> = {
  journeys: { labelKey: "kid.surface.journeys", Comp: HeroJourneyTab },
  arcade: { labelKey: "kid.surface.arcade", Comp: PracticeHubTab },
  feelings: { labelKey: "kid.surface.feelings", Comp: FeelingsLabTab },
};

type View = "home" | KidSurface;

export default function KidModeOverlay() {
  const { isKidModeOpen, closeKidMode } = useKidMode();
  const { t } = useLanguage();
  // KID-LOCK LEAK 1: rehydrate the surface in view from the persisted state so
  // a reload lands the child on the SAME kid surface (validated against
  // SURFACE_META — a stale/garbage view degrades to the home dashboard).
  const [view, setView] = useState<View>(() => {
    const p = readKidModeState();
    return p.open && p.view && (p.view === "home" || p.view in SURFACE_META) ? (p.view as View) : "home";
  });
  // KID-4: when a dashboard game tile opens the arcade, it names the HeroArcade
  // world to pre-select so the tile's title appears verbatim on arrival.
  const [arcadeWorldId, setArcadeWorldId] = useState<string | null>(() => {
    const p = readKidModeState();
    return p.open ? p.worldId ?? null : null;
  });
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const openSurface = (s: KidSurface, worldId?: string) => {
    setArcadeWorldId(worldId ?? null);
    setView(s);
  };

  // Reset to the home dashboard whenever the overlay opens — but only on a
  // real closed→open transition. A rehydrated mount (already open) keeps the
  // persisted view instead of snapping back home.
  const wasOpenRef = useRef(isKidModeOpen);
  useEffect(() => {
    if (isKidModeOpen && !wasOpenRef.current) {
      setView("home");
      setArcadeWorldId(null);
    }
    wasOpenRef.current = isKidModeOpen;
  }, [isKidModeOpen]);

  // KID-LOCK LEAK 1: persist the current kid surface while open, so the next
  // reload restores it. Device-local UI state only — no child data.
  useEffect(() => {
    if (!isKidModeOpen) return;
    writeKidModeState({ open: true, view, worldId: arcadeWorldId });
  }, [isKidModeOpen, view, arcadeWorldId]);

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

  // KID-2 + KID-LOCK LEAK 6: the keyboard half of the lock. Pointer events are
  // swallowed by the backdrop, but Tab could still walk focus into invisible
  // parent-shell controls (nav, capture, settings, sign-out) behind the
  // overlay. While Kid Mode is open, every sibling of the Kid Mode layers
  // inside the Shell mount node is made inert + aria-hidden
  // (shieldShellSiblings) — and a MutationObserver re-runs the shield whenever
  // the mount node's children change, so LATE-mounting siblings (e.g.
  // PostCaptureCoachStrip) get inerted too instead of staying tabbable behind
  // a one-shot snapshot. The cleanup restores the shell exactly on close.
  useEffect(() => {
    if (!isKidModeOpen) return;
    const parent = overlayRef.current?.parentElement;
    if (!parent) return;
    let undo = shieldShellSiblings(Array.from(parent.children));
    const observer = new MutationObserver(() => {
      // Re-snapshot: restore, then shield the CURRENT sibling set. Attribute
      // mutations are not observed (childList only), so this never loops.
      undo();
      undo = shieldShellSiblings(Array.from(parent.children));
    });
    observer.observe(parent, { childList: true });
    return () => {
      observer.disconnect();
      undo();
    };
  }, [isKidModeOpen]);

  // KID-LOCK LEAK 6: real focus trap. The shield covers .arbor-app siblings,
  // but body portals (Modal, toast container) live OUTSIDE the shield. Owning
  // Tab at document capture makes focus wrap within the overlay subtree and
  // recaptures any focus that escaped into a portal — no enumeration of
  // portal classes needed. Escape stays blocked by the capture above.
  useEffect(() => {
    if (!isKidModeOpen) return;
    const onTab = (e: KeyboardEvent) => {
      const root = overlayRef.current;
      if (!root) return;
      trapTabKey(e, root as unknown as TrapRoot, document.activeElement);
    };
    document.addEventListener("keydown", onTab, true);
    return () => document.removeEventListener("keydown", onTab, true);
  }, [isKidModeOpen]);

  const surface = view === "home" ? null : SURFACE_META[view];

  return (
    // KID-LOCK LEAK 1: initial={false} — on a rehydrated mount (reload while
    // Kid Mode was open) the overlay renders at full opacity on the FIRST
    // paint, with no enter animation frame exposing the parent app beneath.
    // Later closed→open transitions still animate normally (children absent
    // on first render, so their eventual mount animates as before).
    <AnimatePresence initial={false}>
      {isKidModeOpen && (
        <motion.div
          key="kid-mode-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          aria-hidden="true"
          data-kid-mode-layer="true"
          onPointerDown={(e) => e.stopPropagation()}
          // F4: the overlay itself animates with scale, so its margins briefly expose the
          // parent shell during enter/exit. This non-transformed full-viewport backdrop
          // swallows any pointer that lands in those strips — the lock never depends on a
          // completed animation frame.
          style={{ position: "fixed", inset: 0, zIndex: 69, background: "var(--arbor-paper)", pointerEvents: "auto" }}
        />
      )}
      {isKidModeOpen && (
        <motion.div
          key="kid-mode-overlay"
          ref={overlayRef}
          data-kid-mode-layer="true"
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
                aria-label={t("kid.back.homeAria")}
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
                {t("kid.back.home")}
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
                {t(surface.labelKey)}
              </span>
              <HoldExitButton onExit={closeKidMode} idleLabel={t("kid.exit.backToParent")} ariaIdle={t("kid.exit.backToParentAria")} />
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
            {/* KID-22: Kid Mode's own boundary. It wraps the SURFACE AREA only —
                the hold-to-exit control in the header above stays mounted, so a
                throwing world can never blank the app or weaken the lock. The
                fallback's only action is Home (setView("home")). */}
            <KidErrorBoundary
              onHome={() => setView("home")}
              resetKey={view === "arcade" ? `arcade:${arcadeWorldId ?? ""}` : view}
              title={t("elev.kid.crash.title")}
              homeLabel={t("elev.kid.crash.home")}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={view === "arcade" ? `arcade:${arcadeWorldId ?? ""}` : view}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  {view === "home" ? (
                    <KidDashboard onOpenSurface={openSurface} onExit={closeKidMode} />
                  ) : view === "arcade" ? (
                    <Suspense fallback={<TabSkeleton />}>
                      <PracticeHubTab initialWorldId={arcadeWorldId ?? undefined} />
                    </Suspense>
                  ) : (
                    <Suspense fallback={<TabSkeleton />}>{surface && <surface.Comp />}</Suspense>
                  )}
                </motion.div>
              </AnimatePresence>
            </KidErrorBoundary>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
