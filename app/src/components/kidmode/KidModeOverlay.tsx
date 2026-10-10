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
import React, { lazy, Suspense, useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useKidMode } from "./KidModeContext";
import { shieldShellSiblings } from "./kidModeShield";
import { trapTabKey, type TrapRoot } from "./kidModeFocusTrap";
import { readKidModeState, writeKidModeState } from "../../lib/kidModeGate";
import { KidStageFallback } from "./KidStageFallback";
import { useKidSurfaceTitle } from "./kidSurfaceTitle";
import { useLanguage } from "../../context/LanguageContext";
import KidDashboard, { KID_GAME_TITLE_KEY, type KidSurface } from "./KidDashboard";
import { HoldExitButton } from "./HoldExitButton";
import { KidErrorBoundary } from "./KidErrorBoundary";
import { ArborMascot } from "../ui/ArborMascot";
import { useArbor } from "../../context/ArborContext";
import { KidSoundToggle } from "./kidReadAloud";
import { closeKidAudio, kidAudioVisibility, kidHush, setKidAudioChild } from "./audio/kidAudio";
import { hydrateHeroRenders } from "../../lib/heroRenderStore";
import { setKidHome, useKidStage } from "./kidChrome";
import { KidStage } from "./KidStage";
import { kidStageFor } from "./kidStageArt";
import { SNEAK_FREEZE_WORLD, flaggedWorldNameKey, sneakFreezeFlagOn } from "./kidWorlds";

// ── EXISTING surfaces — imported unchanged, never forked ──────────────────────
const HeroJourneyTab = lazy(() => import("../tabs/HeroJourneyTab"));
const PracticeHubTab = lazy(() => import("../practice/PracticeHubTab"));
const FeelingsLabTab = lazy(() => import("../practice/FeelingsLabTab"));
const KidComicsShelf = lazy(() => import("./KidComicsShelf"));
// B-GAME-07b: the G0 proof game — its chunk loads only when the flagged tile opens it.
const SneakFreeze = lazy(() => import("./games/sneakFreeze/SneakFreeze"));
// B-BOOK release: a library book (lib/library) open full screen over the shell.
const KidBookReaderView = lazy(() => import("./KidBookReaderView"));

// KID-1: labels are i18n keys (kid.* namespace) resolved with t() at render.
const SURFACE_META: Record<KidSurface, { labelKey: string; Comp?: React.ComponentType }> = {
  // B-KID-85: the story surface IS the kid library ("My books").
  journeys: { labelKey: "kidBooks.title", Comp: HeroJourneyTab },
  arcade: { labelKey: "kid.surface.arcade", Comp: PracticeHubTab },
  feelings: { labelKey: "kid.surface.feelings", Comp: FeelingsLabTab },
  comics: { labelKey: "elev.kids.comics.title" },
};

type View = "home" | KidSurface;

/** B-KID-74 (Fable render, 5 Oct): the ONE top bar names where the child is.
 *  Inside the arcade view with a world open, the title is that world's kid
 *  name, read from the overlay's own state (the world id the home tile
 *  passed) — never the surface label "Playbank", and never dependent on the
 *  world's chunk having mounted. Otherwise the surface's own title (a story
 *  sets it) or the surface label. Pure, so a test reads the home-tile path. */
export function kidBarTitle(
  view: View,
  arcadeWorldId: string | null,
  surfaceTitle: string | null,
  t: (key: string) => string,
): string | null {
  if (view === "home") return null;
  const worldKey = view === "arcade" && arcadeWorldId ? KID_GAME_TITLE_KEY[arcadeWorldId] ?? flaggedWorldNameKey(arcadeWorldId) : undefined;
  if (worldKey) return t(worldKey);
  return surfaceTitle ?? t(SURFACE_META[view].labelKey);
}

/** B-KID-74 (Fable render, 5 Oct): exactly ONE kid view is mounted at a time
 *  (home | library | reader | one world). The content area is a single keyed
 *  node with an enter-only fade — no exit animation, so no AnimatePresence
 *  keeps a left view (and its world's timers, audio and streams) alive under
 *  the new one. A changed key unmounts the old view in the same commit. */
export function kidViewKey(view: View, arcadeWorldId: string | null): string {
  return view === "arcade" ? `arcade:${arcadeWorldId ?? ""}` : view;
}

/** Where the content scroll lands on arrival: the home RESTORES the position
 *  the child left it at (the tree itself is not kept alive); every other view
 *  arrives at the top. */
export function arrivalScrollTop(view: View, savedHomeScroll: number): number {
  return view === "home" ? Math.max(0, savedHomeScroll) : 0;
}

/** B-GAME-07c: Sneak & Freeze's bar title on one line (step-down token, capped by the viewport). */
const SNEAK_BAR_TITLE: React.CSSProperties = { fontSize: "min(var(--kid-t-say), 4.6vw)", WebkitLineClamp: 1, whiteSpace: "nowrap" };
/** B-GAME-06b: in Sneak & Freeze (fullBleed) the bar is TRANSPARENT over the
 *  scene: no white slab — the Home toy at the start edge, Sound + the
 *  grown-ups exit at the end edge float as toy buttons with their own soft
 *  shadows (index.css `[data-kid-bar-float]`); the scene runs to the top edge
 *  under them; the bar's empty middle lets presses through to the stage.
 *  Every other view's bar is unchanged. */
const SNEAK_BAR_FLOAT: React.CSSProperties = { position: "absolute", insetBlockStart: 0, insetInline: 0, zIndex: 2, background: "transparent", borderBottom: "none", boxShadow: "none", paddingBlockStart: "max(10px, env(safe-area-inset-top))", pointerEvents: "none" };
/** The title stays for screen readers; nothing of it paints over the scene. */
const SNEAK_BAR_TITLE_UNSEEN: React.CSSProperties = { clipPath: "inset(50%)", pointerEvents: "none" };
/** The Home toy: a round paper button with its own shadow. */
const SNEAK_BAR_HOME: React.CSSProperties = { background: "var(--arbor-paper-elevated)", border: "2px solid var(--arbor-rule-strong)", borderRadius: 999, minHeight: "52px", minWidth: "52px" };

export default function KidModeOverlay() {
  const { isKidModeOpen, closeKidMode } = useKidMode();
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const surfaceTitle = useKidSurfaceTitle();
  // KID-LOCK LEAK 1: rehydrate the surface in view from the persisted state so
  // a reload lands the child on the SAME kid surface (validated against
  // SURFACE_META — a stale/garbage view degrades to the home dashboard).
  const [view, setView] = useState<View>(() => {
    const p = readKidModeState();
    return p.open && p.view && (p.view === "home" || p.view in SURFACE_META) ? (p.view as View) : "home";
  });
  // KID-4: when a dashboard game tile opens the arcade, it names the HeroArcade
  // world to pre-select so the tile's title appears verbatim on arrival.
  // OBJ-KID-05: the same channel carries the quest banner's story id into the
  // journeys surface, so "Today's adventure" opens ONE story, not the catalogue.
  // It is persisted under the existing `worldId` field (device-local UI state).
  const [arcadeWorldId, setArcadeWorldId] = useState<string | null>(() => {
    const p = readKidModeState();
    return p.open ? p.worldId ?? null : null;
  });
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  // B-KID-74: the home's scroll position, recorded while the home is the
  // mounted view and restored when the child comes back to it.
  const homeScrollRef = useRef(0);

  // B-KID-124: every tap of a book is a fresh pin (the same book tapped again
  // after Home opens again even if the reader tab stayed mounted).
  const [pinNonce, setPinNonce] = useState(0);
  // B-BOOK release: the library book open over the shell (device-local UI state;
  // its close toy is the one way back, to the kid home).
  const [openBookId, setOpenBookId] = useState<string | null>(null);
  useEffect(() => {
    if (!isKidModeOpen) setOpenBookId(null);
  }, [isKidModeOpen]);
  const openSurface = (s: KidSurface, worldId?: string) => {
    setArcadeWorldId(worldId ?? null);
    setPinNonce((n) => n + 1);
    setView(s);
  };

  // On a real closed→open transition, arrive where the door asked
  // (B-KID-11: openKidMode({view, worldId}) persisted it a tick ago), validated
  // against SURFACE_META — anything else is the home dashboard. A rehydrated
  // mount (already open) keeps the persisted view instead of snapping back home.
  const wasOpenRef = useRef(isKidModeOpen);
  useEffect(() => {
    if (isKidModeOpen && !wasOpenRef.current) {
      homeScrollRef.current = 0;
      const p = readKidModeState();
      const asked = p.view && p.view in SURFACE_META ? (p.view as View) : "home";
      setView(asked);
      setArcadeWorldId(asked === "home" ? null : p.worldId ?? null);
    }
    wasOpenRef.current = isKidModeOpen;
  }, [isKidModeOpen]);

  // B-KID-74: a game's finish screen offers Home through the ONE overlay home.
  useEffect(() => {
    if (!isKidModeOpen) return;
    setKidHome(() => setView("home"));
    return () => setKidHome(null);
  }, [isKidModeOpen]);

  // B-KID-73: the ONE kid audio bus lives while Kid Mode is open — the active
  // child's Sound setting gates every effect; a hidden tab pauses it; closing
  // Kid Mode closes the shared AudioContext and stops the voice.
  useEffect(() => {
    if (!isKidModeOpen) return;
    setKidAudioChild(childProfile.id);
    // B-KID-127: warm the child's kept stories so a tapped book opens on them.
    void hydrateHeroRenders(childProfile.id);
    const onVisibility = () => kidAudioVisibility(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      closeKidAudio();
    };
  }, [isKidModeOpen, childProfile.id]);
  // Navigation cancels whatever was being said (the next view speaks its own).
  useEffect(() => { kidHush(); }, [view, arcadeWorldId]);

  // KID-LOCK LEAK 1: persist the current kid surface while open, so the next
  // reload restores it. Device-local UI state only — no child data.
  useEffect(() => {
    if (!isKidModeOpen) return;
    writeKidModeState({ open: true, view, worldId: arcadeWorldId });
  }, [isKidModeOpen, view, arcadeWorldId]);

  // Each destination owns a fresh top-of-page arrival; the home restores where
  // the child left it (B-KID-74). The content div is the actual scroll
  // container, so set it after the next view mounts rather than relying on
  // window.scrollTo.
  useEffect(() => {
    if (!isKidModeOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (!contentRef.current) return;
      contentRef.current.scrollTop = arrivalScrollTop(view, homeScrollRef.current);
      contentRef.current.scrollLeft = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isKidModeOpen, view, arcadeWorldId]);

  // Block Escape inside Kid Mode — a child must not press Escape to exit. The
  // parent gate (hold button) is the only way out. Install all three lock
  // boundaries in the layout phase: a persisted-open reload already paints
  // the Kid surface on its first frame, before passive effects can run.
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
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
  useLayoutEffect(() => {
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
  const barTitle = kidBarTitle(view, arcadeWorldId, surfaceTitle, t);
  // B-KID-133 (D-01): the lit stage behind the view — the view's own picture
  // (a mounted game/book page may name a more exact one via setKidStage).
  const stageOverride = useKidStage();
  const stageScene = stageOverride ?? kidStageFor(view, arcadeWorldId);
  // B-GAME-07b (ruling G7): the flagged proof game fills the content area —
  // no padding, no scroll; its scene is the screen under the one top bar.
  const sneakOpen = view === "arcade" && arcadeWorldId === SNEAK_FREEZE_WORLD.worldId && sneakFreezeFlagOn();

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
          // B-KID-133 (D-01): navy, so a slow stage image never flashes white.
          style={{ position: "fixed", inset: 0, zIndex: 69, background: "var(--arbor-ink)", pointerEvents: "auto" }}
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
          data-kid-staged=""
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            display: "flex",
            flexDirection: "column",
            background: "var(--arbor-ink)",
            overflow: "hidden",
          }}
        >
          {/* B-KID-133 (D-01): the Stage — first child, under everything. */}
          <KidStage scene={stageScene} />
          {/* ── Surface back-bar (only when a surface is open) ──────────────── */}
          {surface && (
            <header
              data-kid-bar-float={sneakOpen ? "" : undefined}
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                // B-KID-74: the title takes the remaining width at 375 px.
                gap: "8px",
                paddingInline: "12px",
                paddingBlock: "10px",
                flexShrink: 0,
                background: "var(--arbor-paper-elevated)",
                borderBottom: "1px solid var(--arbor-rule)",
                boxShadow: "var(--shadow-xs)",
                ...(sneakOpen ? SNEAK_BAR_FLOAT : null),
              }}
            >
              <button
                onClick={() => setView("home")}
                aria-label={t("kid.back.homeAria")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  paddingInline: "12px",
                  paddingBlock: "10px",
                  minHeight: "44px",
                  minWidth: "44px",
                  flexShrink: 0,
                  borderRadius: "var(--r)",
                  fontWeight: 800,
                  fontSize: "var(--kid-t-tag)",
                  background: "var(--arbor-paper-deep)",
                  color: "var(--arbor-clay)",
                  border: "1px solid var(--arbor-rule)",
                  cursor: "pointer",
                  ...(sneakOpen ? SNEAK_BAR_HOME : null),
                }}
              >
                <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" aria-hidden="true" />
                {/* B-KID-74: icon-only below sm (the aria-label names it) so the
                    world's name keeps the bar's width. */}
                <span className="hidden sm:inline">{t("kid.back.home")}</span>
              </button>
              <span
                data-kid-bar-title=""
                style={{
                  // B-KID-133 (D-03): toy voice (Nunito / Heebo 800 — 900 is not loaded).
                  fontFamily: "var(--font-sans)",
                  fontWeight: 800,
                  // B-KID-53 polish: a story's own title can be long — one step
                  // smaller than the surface label, max 2 lines, then an ellipsis.
                  fontSize: surfaceTitle ? "var(--kid-t-say)" : "var(--kid-t-title)",
                  lineHeight: 1.15,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  color: "var(--arbor-clay)",
                  flex: "1 1 0%",
                  minWidth: 0,
                  // B-GAME-07c: the proof game's name ("Sneak & Freeze" /
                  // "דג מלוח") stays on ONE line at 375 px — the step-down
                  // token, capped by the viewport; other bars unchanged.
                  ...(sneakOpen ? SNEAK_BAR_TITLE : null),
                  ...(sneakOpen ? SNEAK_BAR_TITLE_UNSEEN : null),
                }}
              >
                {/* B-KID-53: inside a world or a story the title is ITS name. */}
                {barTitle}
              </span>
              {/* B-KID-73 (Fable render): the game's hear-it lives in its
                  instruction bubble (GameShell), not here — two speaker buttons
                  side by side were ambiguous and squeezed the title. The bar
                  keeps ONE per-child Sound control (voice + effects), at the
                  far side beside the grown-ups exit. */}
              <KidSoundToggle childId={childProfile.id} lang={uiLang === "he" ? "he" : "en"} />
              <HoldExitButton onExit={closeKidMode} idleLabel={t("kid.exit.backToParent")} ariaIdle={t("kid.exit.backToParentAria")} />
            </header>
          )}

          {/* ── Content area ───────────────────────────────────────────────── */}
          <div
            ref={contentRef}
            onScroll={view === "home" ? (e) => { homeScrollRef.current = e.currentTarget.scrollTop; } : undefined}
            style={{
              position: "relative",
              zIndex: 1,
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              paddingInline: "20px",
              paddingBlock: "24px",
              ...(sneakOpen ? { overflowY: "hidden" as const, paddingInline: 0, paddingBlock: 0, display: "flex", flexDirection: "column" as const } : null),
            }}
          >
            {/* KID-22: Kid Mode's own boundary. It wraps the SURFACE AREA only —
                the hold-to-exit control in the header above stays mounted, so a
                throwing world can never blank the app or weaken the lock. The
                fallback's only action is Home (setView("home")). */}
            <KidErrorBoundary
              onHome={() => setView("home")}
              resetKey={kidViewKey(view, arcadeWorldId)}
              title={t("elev.kid.crash.title")}
              homeLabel={t("elev.kid.crash.home")}
              guide={<ArborMascot size={96} mood="think" />}
            >
              {/* B-KID-74: ONE mounted view. A keyed node with an enter-only fade:
                  the next view mounts at once (B-KID-47: no empty-stage hold) and
                  the left one unmounts in the same commit — no exit animation, so
                  nothing (a world's banner, timers, audio, mic) stays alive
                  underneath. */}
                <motion.div
                  key={kidViewKey(view, arcadeWorldId)}
                  data-kid-view={kidViewKey(view, arcadeWorldId)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.14 }}
                  style={sneakOpen ? { flex: 1, minBlockSize: 0, position: "relative" } : undefined}
                >
                  {view === "home" ? (
                    <KidDashboard onOpenSurface={openSurface} onExit={closeKidMode} onOpenBook={setOpenBookId} />
                  ) : view === "arcade" ? (
                    <Suspense fallback={<KidStageFallback worldId={arcadeWorldId ?? undefined} />}>
                      {/* B-GAME-07b: the flagged proof game, in the arcade's own Suspense. */}
                      {sneakOpen ? <SneakFreeze /> : <PracticeHubTab initialWorldId={arcadeWorldId ?? undefined} />}
                    </Suspense>
                  ) : view === "journeys" ? (
                    <Suspense fallback={<KidStageFallback storyId={arcadeWorldId ?? undefined} />}>
                      <HeroJourneyTab initialStoryId={arcadeWorldId ?? undefined} pinNonce={pinNonce} />
                    </Suspense>
                  ) : view === "comics" ? (
                    <Suspense fallback={<KidStageFallback />}>
                      <KidComicsShelf key={childProfile.id} childProfile={childProfile} onBack={() => setView("home")} onOpenStories={() => setView("journeys")} />
                    </Suspense>
                  ) : (
                    <Suspense fallback={<KidStageFallback />}>{surface?.Comp ? <surface.Comp /> : null}</Suspense>
                  )}
                </motion.div>
            </KidErrorBoundary>
          </div>
          {openBookId && (
            <Suspense fallback={null}>
              <KidBookReaderView bookId={openBookId} onClose={() => setOpenBookId(null)} />
            </Suspense>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
