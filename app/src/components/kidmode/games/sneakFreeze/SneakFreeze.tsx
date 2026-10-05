/**
 * Sneak & Freeze / "דג מלוח" — B-GAME-07b: the playable G0 proof game.
 *
 * The child's own hero sneaks from the back gate of Savta's courtyard TOWARD
 * the camera, up to the cat on its stool in the foreground. Hold anywhere on
 * the stage to sneak, let go to freeze (Space / Enter held on a desktop;
 * several fingers are one hold). The rules are rules.ts, stepped by ONE
 * requestAnimationFrame loop that pauses while the tab is hidden; a touch is
 * stepped at once (dt 0) so the hero lurches in the same frame.
 *
 * On screen: the place, the cat, the hero, three cover objects, a prize (held
 * up in the hero's hands after a tag) and — in the intro / after an idle hint
 * — one pulsing hand glyph in the thumb zone; the hint itself is the cat's
 * whispered voice line. Nothing on screen needs reading (the sentence is the
 * stage's aria-label). No instruction paragraph, no progress dots, no digits,
 * no timer, no level. Mounted inside GameShell's
 * fullBleed: the overlay's top bar is the only chrome.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../../../context/ArborContext";
import { useLanguage } from "../../../../context/LanguageContext";
import { ageYearsFromProfile } from "../../../../lib/childAge";
import { GameShell } from "../../game/GameShell";
import { PlayField, type PlayFieldContext } from "../../game/PlayField";
import { COVER_ASPECT, pointOnPath, sneakLayout, toPx, type CoverId, type FieldOrientation, type SneakLayout } from "../../game/fieldLayout";
import { HeroFigure, prefersReducedMotion, useHeroSheet } from "../../hero/HeroFigure";
import { kidIsolate } from "../../kidText";
import { SNEAK_FREEZE_WORLD, sneakFreezeFlagOn } from "../../kidWorlds";
import { useKidHome } from "../../kidChrome";
import { startFor, startSitting, step, view as viewOf, type SneakState, type SneakView } from "./rules";
import { proofVisit } from "../../proofVisit";
import { artUrls, loadProofArt, readSneakArt, type SneakArt } from "./sneakArt";
import { loadProofHeroSheet, type HeroSheet } from "../../hero/heroSheet";
import { preloadImages } from "../../proofAssets";
import { readPlayLevel, writePlayLevel } from "./sneakStore";
import { createSneakSounds, type SneakSounds } from "./sounds";
import { kidAudioContext } from "../../audio/kidAudio";
import { Watcher } from "./Watcher";
import { sittingRecord } from "./record";
import { usePracticeData } from "../../../../practice/usePracticeData";
import { noteKidActivity } from "../../../../lib/kidModeGate";
import { Ending, captionKey } from "./Ending";

/** HE lines addressed to the child: `.boy` / `.girl`, else the plural base. */
export function formKey(base: string, gender: string | undefined): string {
  return gender === "boy" || gender === "girl" ? `${base}.${gender}` : base;
}

export function sameView(a: SneakView, b: SneakView): boolean {
  return a.phase === b.phase && a.progress === b.progress && a.lurch === b.lurch && a.heroPose === b.heroPose
    && a.watcher.pose === b.watcher.pose && a.watcher.sunglasses === b.watcher.sunglasses && a.watcher.beat === b.watcher.beat
    && a.showHand === b.showHand && a.prize === b.prize && a.done === b.done;
}

const LAYOUTS: Record<FieldOrientation, SneakLayout> = { landscape: sneakLayout("landscape"), portrait: sneakLayout("portrait") };

/** How much of a cover's visible width touches the floor (the pot, the lantern's
 *  foot, the bench's legs) — its contact shadow's width. */
const COVER_FOOTPRINT: Readonly<Record<CoverId, number>> = { "lemon-tree": 0.55, lantern: 0.8, bench: 1.0 };
/** The one contact-shadow fill (soft ink, fading out). */
export const SHADOW_FILL = "radial-gradient(closest-side, color-mix(in srgb, var(--arbor-ink) 30%, transparent), transparent)";

function newSeed(childId: string, n: number): string {
  return `${childId || "kid"}:${Date.now().toString(36)}:${n}`;
}

function safeAge(profile: Parameters<typeof ageYearsFromProfile>[0]): number | null {
  try {
    const a = ageYearsFromProfile(profile);
    return Number.isFinite(a) ? a : null;
  } catch {
    return null;
  }
}

/** The pulsing hand in the thumb zone (authored glyph, token colours). */
function HandGlyph({ size }: { size: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const a = el.animate([{ transform: "scale(1)" }, { transform: "scale(0.86)" }, { transform: "scale(1)" }], { duration: 1000, iterations: Infinity, easing: "ease-in-out" });
    return () => a.cancel();
  }, []);
  return (
    <svg ref={ref} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <circle cx="30" cy="16" r="13" style={{ fill: "none", stroke: "var(--arbor-paper-elevated)", strokeWidth: 3, opacity: 0.8 }} />
      <path
        d="M26 16 C26 12 32 12 32 16 V30 C32 27 38 27 38 30 V33 C38 30 44 30 44 33 V36 C44 33 50 33 50 37 V48 C50 56 44 60 37 60 H33 C27 60 24 57 20 51 L13 40 C11 36 15 33 18 36 L26 44 Z"
        style={{ fill: "var(--arbor-paper-elevated)", stroke: "var(--arbor-ink)", strokeWidth: 2.5, strokeLinejoin: "round" }}
      />
    </svg>
  );
}

/** The sparkle at the tag: a few motes flying out (transform/opacity only). */
function TagBurst({ x, y, size }: { x: number; y: number; size: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const kids = Array.from(el.children) as HTMLElement[];
    const anims = kids.map((c, i) => {
      const ang = (i / kids.length) * Math.PI * 2;
      if (typeof c.animate !== "function") return null;
      return c.animate(
        [{ transform: "translate(0, 0) scale(0.4)", opacity: 1 }, { transform: `translate(${Math.cos(ang) * size}px, ${Math.sin(ang) * size}px) scale(1)`, opacity: 0 }],
        { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" },
      );
    });
    return () => anims.forEach((a) => a?.cancel());
  }, [size]);
  const dot = size * 0.14;
  return (
    <div ref={ref} aria-hidden="true" style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} style={{ position: "absolute", left: -dot / 2, top: -dot / 2, width: dot, height: dot, borderRadius: "50%", background: i % 2 ? "var(--arbor-yellow)" : "var(--arbor-pink)", opacity: prefersReducedMotion() ? 0 : 1 }} />
      ))}
    </div>
  );
}

function Scene({ ctx, v, art, sheet, prevProgress }: { ctx: PlayFieldContext; v: SneakView; art: SneakArt; sheet: HeroSheet; prevProgress: number }) {
  const layout = LAYOUTS[ctx.fit.orientation];
  const tagPoint = layout.heroPath[layout.heroPath.length - 1];
  const p = pointOnPath(layout.heroPath, v.progress);
  const base = tagPoint.h;
  const forward = v.progress > prevProgress;
  const reduced = prefersReducedMotion();
  const frozen = v.heroPose === "freeze-a" || v.heroPose === "freeze-b";
  // The statue's comic beat wobbles; while the cat looks, a held-breath tremble
  // (B-GAME-07d: the look is never a dead 1.7 s).
  const statue: boolean | "tremble" = frozen && v.phase === "verdict" ? true : frozen && v.phase === "looking" ? "tremble" : false;
  // B-GAME-07c: in hold-up the prize is IN the hero's hands (HeroFigure).
  const carried = v.prize && v.heroPose === "hold-up" ? v.prize : null;
  return (
    <>
      {layout.covers.map((c) => {
        const sp = art.covers[c.id];
        const k = c.h / sp.h;
        // B-GAME-07d: a soft contact shadow under the base, a little to the
        // right (the plate's key light is upper left; RTL mirrors it with the art).
        const sw = c.h * COVER_ASPECT[c.id] * COVER_FOOTPRINT[c.id];
        return (
          <React.Fragment key={c.id}>
            <span
              aria-hidden="true"
              data-cover-shadow={c.id}
              style={{ position: "absolute", left: c.feet.x - sw / 2 + sw * 0.08, top: c.feet.y - sw * 0.07, width: sw, height: sw * 0.14, borderRadius: "50%", background: SHADOW_FILL, zIndex: Math.round(c.feet.y) - 1, pointerEvents: "none" }}
            />
            <img
              src={sp.url}
              alt=""
              draggable={false}
              data-cover={c.id}
              style={{ position: "absolute", left: c.feet.x - sp.anchor.x * k, top: c.feet.y - sp.anchor.y * k, width: sp.w * k, height: sp.h * k, maxWidth: "none", zIndex: Math.round(c.feet.y) }}
            />
          </React.Fragment>
        );
      })}
      <Watcher
        art={art}
        pose={v.watcher.pose}
        sunglasses={v.watcher.sunglasses}
        beat={v.watcher.beat}
        lean={v.phase === "verdict" && v.watcher.pose === "looking"}
        feet={layout.watcher.feet}
        height={layout.watcher.h}
        zIndex={Math.round(layout.watcher.feet.y)}
      />
      {/* The hero: one transform carries both the step toward the camera and
          the growth with depth, so a lurch is one short eased hop (stepwise,
          never a glide); going back to a cover is a hard cut. */}
      <div
        data-hero-at={v.progress.toFixed(3)}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          zIndex: Math.round(p.y) + 1,
          transform: `translate(${p.x}px, ${p.y}px) scale(${p.h / base})`,
          transformOrigin: "0 0",
          transition: forward && !reduced ? "transform 190ms cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
        }}
      >
        <HeroFigure
          pose={v.heroPose}
          height={base}
          sheet={sheet}
          x={0}
          y={0}
          kick={v.lurch}
          wobble={statue}
          carry={carried ? { url: art.prizes[carried].url, size: layout.prize.size * (base / p.h) } : null}
        />
      </div>
      {v.prize && !carried && (
        <img
          key={v.prize}
          src={art.prizes[v.prize].url}
          alt=""
          draggable={false}
          data-prize={v.prize}
          style={{ position: "absolute", left: layout.prize.x - layout.prize.size / 2, top: layout.prize.y - layout.prize.size / 2, width: layout.prize.size, height: layout.prize.size, zIndex: 3000 }}
        />
      )}
    </>
  );
}

/** The art and the hero for this sitting. With the flag on, the local-only
 *  proof files are tried first (then local storage, then the placeholders)
 *  and their images decoded before the first frame (bounded wait). */
export function useSneakAssets(childId: string): { ready: boolean; art: SneakArt; sheet: HeroSheet } {
  const fallbackSheet = useHeroSheet(childId);
  const baseArt = useMemo(() => readSneakArt(), []);
  const flag = sneakFreezeFlagOn();
  const [proof, setProof] = useState<{ art: SneakArt; sheet: HeroSheet | null } | null>(null);
  useEffect(() => {
    if (!flag) return;
    let alive = true;
    const settle = (v: { art: SneakArt; sheet: HeroSheet | null }) => { if (alive) setProof((p) => p ?? v); };
    const giveUp = setTimeout(() => settle({ art: baseArt, sheet: null }), 4000);
    void (async () => {
      const [sheet, art] = await Promise.all([loadProofHeroSheet(), loadProofArt(baseArt)]);
      const heroUrls = sheet ? Object.values(sheet.poses).map((p) => p?.url ?? "").filter((u) => u && !u.startsWith("data:")) : [];
      await preloadImages([...artUrls(art), ...heroUrls]);
      settle({ art, sheet });
    })();
    return () => { alive = false; clearTimeout(giveUp); };
  }, [flag, baseArt]);
  if (!flag) return { ready: true, art: baseArt, sheet: fallbackSheet };
  return proof ? { ready: true, art: proof.art, sheet: proof.sheet ?? fallbackSheet } : { ready: false, art: baseArt, sheet: fallbackSheet };
}

export default function SneakFreeze() {
  const { childProfile } = useArbor();
  const { t } = useLanguage();
  const assets = useSneakAssets(childProfile?.id ?? "");
  if (!assets.ready) {
    // A beat while the proof art decodes: the shell and the navy stage only.
    return (
      <GameShell worldId={SNEAK_FREEZE_WORLD.worldId} title={t(SNEAK_FREEZE_WORLD.nameKey)} fullBleed>
        <div data-sneak-loading="" aria-hidden="true" style={{ blockSize: "100%" }} />
      </GameShell>
    );
  }
  return <SneakFreezeGame art={assets.art} sheet={assets.sheet} />;
}

function SneakFreezeGame({ art, sheet }: { art: SneakArt; sheet: HeroSheet }) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const rtl = lang === "he";
  const childId = childProfile?.id ?? "";
  const gender = childProfile?.gender;
  const goHome = useKidHome();
  // Read once per child: the start level by age, or the device's remembered
  // level; a local proof visit's `age` sets the start for that visit only.
  const start = useMemo(() => {
    const pv = proofVisit();
    return pv?.age != null ? startFor(pv.age) : readPlayLevel(childId, safeAge(childProfile));
  }, [childId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sitting, setSitting] = useState(0);
  const stateRef = useRef<SneakState | null>(null);
  if (!stateRef.current) stateRef.current = startSitting({ seed: newSeed(childId, 0), track: start.track, level: start.level, intro: true });
  const [v, setV] = useState<SneakView>(() => viewOf(stateRef.current as SneakState));
  const prevProgress = useRef(0);
  const shownProgress = useRef(v.progress);
  if (shownProgress.current !== v.progress) {
    prevProgress.current = shownProgress.current;
    shownProgress.current = v.progress;
  }
  const hold = useRef({ pointers: new Set<number>(), keys: new Set<string>() });

  // B-GAME-08a: recorded voice + foley (files), in the kid UI language.
  // One controller per mount (StrictMode-safe: created and disposed by the effect).
  const soundsRef = useRef<SneakSounds | null>(null);
  useEffect(() => {
    const sounds = createSneakSounds(lang);
    soundsRef.current = sounds;
    let alive = true;
    // B-GAME-12a: proof-run counters (flag on only; numbers, never child data).
    if (sneakFreezeFlagOn() && typeof window !== "undefined") {
      (window as unknown as { __sneakDebug?: unknown }).__sneakDebug = {
        audio: () => ({ context: kidAudioContext()?.state ?? "none", ...sounds.stats() }),
        rules: () => {
          const s = stateRef.current;
          return s ? { phase: s.phase, round: s.round, tags: s.tags, track: s.track, level: s.level, pos: s.pos, pathSteps: s.pathSteps } : null;
        },
      };
    }
    void sounds.load().then(() => {
      // The cat's first line, once, while the first sitting's demo still runs.
      if (alive && stateRef.current?.phase === "intro") sounds.intro();
    });
    return () => {
      alive = false;
      sounds.dispose();
      if (soundsRef.current === sounds) soundsRef.current = null;
    };
  }, [lang]);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const holding = () => hold.current.pointers.size > 0 || hold.current.keys.size > 0;
  const pump = (dt: number) => {
    const cur = stateRef.current;
    if (!cur) return;
    const next = step(cur, dt, { holding: holding() });
    stateRef.current = next;
    if (next.events.length) soundsRef.current?.events(next.events, next);
    const nv = viewOf(next);
    setV((prev) => (sameView(prev, nv) ? prev : nv));
  };
  const pumpRef = useRef(pump);
  pumpRef.current = pump;

  // ONE rAF loop; paused while the tab is hidden; stops at the end.
  useEffect(() => {
    let raf = 0;
    let running = false;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(100, now - last) : 0;
      last = now;
      pumpRef.current(dt);
      if (stateRef.current?.phase === "done") { running = false; return; }
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => { if (running) return; running = true; last = 0; raf = requestAnimationFrame(tick); };
    const stopLoop = () => { running = false; cancelAnimationFrame(raf); };
    const onVis = () => (document.hidden ? stopLoop() : startLoop());
    if (!document.hidden) startLoop();
    document.addEventListener("visibilitychange", onVis);
    return () => { stopLoop(); document.removeEventListener("visibilitychange", onVis); };
  }, [sitting]);

  // Space / Enter held = hold (desktop). Never from a button elsewhere.
  useEffect(() => {
    const isHoldKey = (k: string) => k === " " || k === "Enter";
    const fromStage = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !el || el === document.body || !!el.closest?.("[data-sneak-stage]");
    };
    const down = (e: KeyboardEvent) => {
      if (!isHoldKey(e.key) || !fromStage(e)) return;
      e.preventDefault();
      if (e.repeat || hold.current.keys.has(e.key)) return;
      soundsRef.current?.unlock();
      hold.current.keys.add(e.key);
      pumpRef.current(0);
    };
    const up = (e: KeyboardEvent) => {
      if (hold.current.keys.delete(e.key)) pumpRef.current(0);
    };
    const blur = () => {
      hold.current.keys.clear();
      hold.current.pointers.clear();
      pumpRef.current(0);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    try { stageRef.current?.focus({ preventScroll: true }); } catch { /* focus is a convenience */ }
  }, [sitting]);

  // A sitting ends: the level is the device's memory (never shown); ONE
  // practice record (counts + experiences, no right/wrong) and ONE kid
  // activity, once per sitting (keyed by its seed).
  const practice = usePracticeData(childId);
  const recorded = useRef<string | null>(null);
  const sittingStart = useRef(Date.now());
  useEffect(() => {
    const s = stateRef.current;
    if (!v.done || !s || recorded.current === s.seed) return;
    recorded.current = s.seed;
    // A proof visit's `age` is for that visit only: the device level stays as it was.
    if (proofVisit()?.age == null) writePlayLevel(childId, { track: s.track, level: s.level });
    void practice.events.upsert(sittingRecord(s, Date.now() - sittingStart.current, new Date()));
    noteKidActivity();
  }, [v.done, childId]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    soundsRef.current?.unlock();
    hold.current.pointers.add(e.pointerId);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    pump(0);
  };
  const release = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hold.current.pointers.delete(e.pointerId)) pump(0);
  };

  const playAgain = () => {
    const s = stateRef.current;
    const n = sitting + 1;
    stateRef.current = startSitting({ seed: newSeed(childId, n), track: s?.track ?? start.track, level: s?.level ?? start.level, intro: false, after: s?.prizeOrder[0] });
    hold.current.pointers.clear();
    hold.current.keys.clear();
    prevProgress.current = 0;
    shownProgress.current = 0;
    sittingStart.current = Date.now();
    soundsRef.current?.newSitting();
    setV(viewOf(stateRef.current));
    setSitting(n);
  };

  const title = t(SNEAK_FREEZE_WORLD.nameKey);
  const firstName = (childProfile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const stageAria = kidIsolate(t(formKey("kid.game.sneak-freeze.stageAria", gender)));

  return (
    <GameShell worldId={SNEAK_FREEZE_WORLD.worldId} title={title} fullBleed>
      {v.done && stateRef.current ? (
        <Ending
          key={stateRef.current.seed}
          state={stateRef.current}
          art={art}
          sheet={sheet}
          childId={childId}
          rtl={rtl}
          caption={t(captionKey(firstName, gender), { name: firstName })}
          pictureAlt={t("kid.game.sneak-freeze.pictureAlt", { name: firstName || title })}
          playAgainLabel={t("kidGame.playAgain")}
          homeLabel={t("kidGame.home")}
          onPlayAgain={playAgain}
          onHome={goHome}
          onShown={() => soundsRef.current?.again()}
        />
      ) : (
        <PlayField
          rootRef={(el) => { stageRef.current = el; }}
          rtl={rtl}
          needFor={(o) => LAYOUTS[o].need}
          data-sneak-stage=""
          data-sneak-phase={v.phase}
          role="button"
          tabIndex={0}
          aria-label={stageAria}
          aria-pressed={holding()}
          onPointerDown={press}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
          onLostPointerCapture={release}
          onContextMenu={(e) => e.preventDefault()}
          plate={({ fit }) => (
            <img src={art.plate[fit.orientation]} alt="" draggable={false} data-sneak-plate={art.source} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", maxWidth: "none", objectFit: "cover" }} />
          )}
          actors={(ctx) => <Scene ctx={ctx} v={v} art={art} sheet={sheet} prevProgress={prevProgress.current} />}
          effects={(ctx) => {
            if (v.phase !== "tagged") return null;
            const lay = LAYOUTS[ctx.fit.orientation];
            return <TagBurst key={`tag-${stateRef.current?.tags ?? 0}`} x={lay.prize.x} y={lay.prize.y} size={lay.prize.size * 1.6} />;
          }}
          controls={(ctx) => {
            if (!v.showHand) return null;
            const lay = LAYOUTS[ctx.fit.orientation];
            const at = toPx(ctx.fit, lay.hand, rtl);
            const size = 76;
            return (
              <div data-sneak-hand="" style={{ position: "absolute", left: at.x - size / 2, top: at.y - size / 2, width: size, height: size }}>
                <HandGlyph size={size} />
              </div>
            );
          }}
        />
      )}
    </GameShell>
  );
}
