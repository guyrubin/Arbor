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
 * On screen: the place, the cat, the hero, three cover objects, a prize and —
 * in the intro / after an idle hint — one pulsing hand glyph in the thumb
 * zone (plus the one hint line for a grown-up). No instruction paragraph, no
 * progress dots, no digits, no timer, no level. Mounted inside GameShell's
 * fullBleed: the overlay's top bar is the only chrome.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../../../context/ArborContext";
import { useLanguage } from "../../../../context/LanguageContext";
import { ageYearsFromProfile } from "../../../../lib/childAge";
import { GameShell } from "../../game/GameShell";
import { PlayField, type PlayFieldContext } from "../../game/PlayField";
import { pointOnPath, sneakLayout, toPx, type FieldOrientation, type SneakLayout } from "../../game/fieldLayout";
import { HeroFigure, prefersReducedMotion, useHeroSheet } from "../../hero/HeroFigure";
import { kidIsolate } from "../../kidText";
import { SNEAK_FREEZE_WORLD } from "../../kidWorlds";
import { useKidHome } from "../../kidChrome";
import { startSitting, step, view as viewOf, type SneakState, type SneakView } from "./rules";
import { readSneakArt, type SneakArt } from "./sneakArt";
import { readPlayLevel, writePlayLevel } from "./sneakStore";
import { sneakSound } from "./sounds";
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

function Scene({ ctx, v, art, sheet, prevProgress }: { ctx: PlayFieldContext; v: SneakView; art: SneakArt; sheet: ReturnType<typeof useHeroSheet>; prevProgress: number }) {
  const layout = LAYOUTS[ctx.fit.orientation];
  const tagPoint = layout.heroPath[layout.heroPath.length - 1];
  const p = pointOnPath(layout.heroPath, v.progress);
  const base = tagPoint.h;
  const forward = v.progress > prevProgress;
  const reduced = prefersReducedMotion();
  const statue = v.phase === "verdict" && (v.heroPose === "freeze-a" || v.heroPose === "freeze-b");
  return (
    <>
      {layout.covers.map((c) => {
        const sp = art.covers[c.id];
        const k = c.h / sp.h;
        return (
          <img
            key={c.id}
            src={sp.url}
            alt=""
            draggable={false}
            data-cover={c.id}
            style={{ position: "absolute", left: c.feet.x - sp.anchor.x * k, top: c.feet.y - sp.anchor.y * k, width: sp.w * k, height: sp.h * k, maxWidth: "none", zIndex: Math.round(c.feet.y) }}
          />
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
        <HeroFigure pose={v.heroPose} height={base} sheet={sheet} x={0} y={0} kick={v.lurch} wobble={statue} />
      </div>
      {v.prize && (
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

export default function SneakFreeze() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const rtl = lang === "he";
  const childId = childProfile?.id ?? "";
  const gender = childProfile?.gender;
  const goHome = useKidHome();
  const sheet = useHeroSheet(childId);
  const art = useMemo(() => readSneakArt(), []);
  // Read once per child: the start level by age, or the device's remembered level.
  const start = useMemo(() => readPlayLevel(childId, safeAge(childProfile)), [childId]);

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
  const stageRef = useRef<HTMLDivElement | null>(null);

  const holding = () => hold.current.pointers.size > 0 || hold.current.keys.size > 0;
  const pump = (dt: number) => {
    const cur = stateRef.current;
    if (!cur) return;
    const next = step(cur, dt, { holding: holding() });
    stateRef.current = next;
    for (const e of next.events) sneakSound(e);
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
    writePlayLevel(childId, { track: s.track, level: s.level });
    void practice.events.upsert(sittingRecord(s, Date.now() - sittingStart.current, new Date()));
    noteKidActivity();
  }, [v.done, childId]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
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
    stateRef.current = startSitting({ seed: newSeed(childId, n), track: s?.track ?? start.track, level: s?.level ?? start.level, intro: false });
    hold.current.pointers.clear();
    hold.current.keys.clear();
    prevProgress.current = 0;
    shownProgress.current = 0;
    sittingStart.current = Date.now();
    setV(viewOf(stateRef.current));
    setSitting(n);
  };

  const title = t(SNEAK_FREEZE_WORLD.nameKey);
  const firstName = (childProfile?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const hintLine = kidIsolate(t(formKey("kid.game.sneak-freeze.hint", gender)));
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
                {v.phase !== "intro" && (
                  <p
                    dir="auto"
                    data-sneak-hint=""
                    className="kid-type-label"
                    style={{
                      position: "absolute",
                      insetBlockEnd: size + 8,
                      insetInlineStart: "50%",
                      transform: rtl ? "translateX(50%)" : "translateX(-50%)",
                      inlineSize: "max-content",
                      maxInlineSize: Math.max(160, ctx.fit.width - 48),
                      margin: 0,
                      paddingInline: 14,
                      paddingBlock: 8,
                      borderRadius: "var(--kid-r-m)",
                      background: "var(--arbor-paper-elevated)",
                      color: "var(--arbor-ink)",
                      boxShadow: "var(--shadow-xs)",
                      fontWeight: 800,
                    }}
                  >
                    {hintLine}
                  </p>
                )}
                <HandGlyph size={size} />
              </div>
            );
          }}
        />
      )}
    </GameShell>
  );
}
