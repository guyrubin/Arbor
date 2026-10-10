/**
 * Ending — B-GAME-09 (first cut; ruling G12): after the third tag, the
 * statue picture.
 *
 * The picture is composed on the device (statuePicture.ts: a close shot of
 * the hero in the freeze pose held longest, large on the courtyard path, the
 * cat peering at him from the foreground corner), captioned "The cat looked…
 * and {name} didn't move!" with the name isolated for bidi (EN + HE boy /
 * girl / unspecified), the three prizes the cat handed over, then — once the
 * picture is up — the cat's "again?" line and two toys: Play again (a new
 * seed; the next sitting opens on a different prize) and Home.
 * B-GAME-09c: the picture is THE object of the screen — a toy photo with a
 * white lip, a 1.5° tilt and a drop shadow that settles in when it lands; the
 * courtyard itself (blurred, darkened) is the backdrop; the prizes sit as
 * objects on a little shelf (not buttons); every sitting gets another
 * framing / time of day than the last.
 * B-GAME-09d: a phone held upright is shown a 3:4 close shot that takes the
 * height the toys leave (>= half the screen at 375x812, no scroll at 375x667):
 * the caption and the shelf sit right under it, the two toys at the bottom in
 * the thumb zone. The 4:3 picture is still the one kept (and shared from the
 * parent's hand-back card). Landscape and tablets keep the 4:3 layout.
 * No stars, no counts, no auto-advance, no model or network call. The last
 * 12 pictures are kept on the device (statueStore.ts).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { KidToy } from "../../KidToy";
import { kidIsolate } from "../../kidText";
import type { HeroSheet } from "../../hero/heroSheet";
import { prefersReducedMotion } from "../../hero/HeroFigure";
import type { PrizeId, SneakState } from "./rules";
import { PICTURE, PICTURE_SIZE, composeStatuePicture, pickVariant, statueShot } from "./statuePicture";
import { keepStatuePicture, lastStatueVariant } from "./statueStore";
import type { SneakArt } from "./sneakArt";

export interface EndingProps {
  state: SneakState;
  art: SneakArt;
  sheet: HeroSheet;
  childId: string;
  rtl: boolean;
  /** The caption, already translated (the name isolated by t()). */
  caption: string;
  pictureAlt: string;
  playAgainLabel: string;
  homeLabel: string;
  onPlayAgain: () => void;
  onHome: (() => void) | null;
  /** The picture is up (or there is none): the cat's "again?" line plays. */
  onShown?: () => void;
}

/** The caption key for this child: the named forms, or the nameless line. */
export function captionKey(firstName: string, gender: string | undefined): string {
  if (!firstName.trim()) return "kid.game.sneak-freeze.caption.noName";
  return gender === "boy" || gender === "girl" ? `kid.game.sneak-freeze.caption.${gender}` : "kid.game.sneak-freeze.caption";
}

/** The last variant pictured in this visit (a child with no store still gets a new one). */
let visitVariant: number | null = null;

/** The picture's width: the screen's hero — the height left after the top
 *  controls, caption, shelf and toys, by 4:3; never wider than the screen. */
const PICTURE_INLINE = `min(calc(100vw - 32px), calc((100dvh - var(--sneak-end-rest, 430px)) * ${PICTURE.w / PICTURE.h}), 1240px)`;
/** The photo's rest tilt (mirrored with the art in right-to-left). */
const TILT = 1.5;
/** The photo's white lip. */
const LIP = "clamp(6px, 1.1vmin, 14px)";
const UPRIGHT = PICTURE_SIZE.portrait;
/** B-GAME-09d: upright on a phone the photo fills its flex box (a size
 *  container): as wide as the box allows, or as tall — whichever binds first
 *  (8px kept for the tilt's corners). */
const UPRIGHT_INLINE = `min(calc(100cqw - 8px), calc((100cqh - 2 * ${LIP}) * ${UPRIGHT.w / UPRIGHT.h} + 2 * ${LIP}))`;

/** Sideways: the picture's width is bound by the height left after the top
 *  controls and the caption; the shelf and the toys sit beside it. */
const SIDEWAYS_MAX_H = 520;
const SIDEWAYS_INLINE = `min(52vw, calc((100dvh - 170px) * ${PICTURE.w / PICTURE.h}))`;

/** A phone held upright: tall and narrow (a tablet upright keeps the 4:3 layout). */
export function isUprightPhone(w: number, h: number): boolean {
  return w < 600 && h >= w * 1.4;
}

export function Ending({ state, art, sheet, childId, rtl, caption, pictureAlt, playAgainLabel, homeLabel, onPlayAgain, onHome, onShown }: EndingProps) {
  const [picture, setPicture] = useState<string | null>(null);
  // B-GAME-09b: the picture first, then the cat's "again?" line, then the two
  // toys appear (no auto-advance: nothing happens until the child taps).
  const [ready, setReady] = useState(false);
  const [portrait] = useState(() => typeof window !== "undefined" && window.innerHeight > window.innerWidth);
  // A phone keeps both toys on one row (the picture keeps the height).
  const [narrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 480);
  const [upright] = useState(() => typeof window !== "undefined" && isUprightPhone(window.innerWidth, window.innerHeight));
  // 10 Oct 2026: a phone held sideways (390 px tall) stacked the picture over
  // the toys and put Play again / Home under the screen's edge. There the
  // picture and the caption sit beside the shelf and the toys.
  const [sideways] = useState(() => typeof window !== "undefined" && !isUprightPhone(window.innerWidth, window.innerHeight) && window.innerHeight < SIDEWAYS_MAX_H && window.innerWidth > window.innerHeight);
  const toyPad = narrow ? { paddingInline: 20 } : undefined;
  const photoRef = useRef<HTMLDivElement | null>(null);
  const tilt = rtl ? TILT : -TILT;

  // Compose once per sitting (the seed names it); keep it on the device.
  useEffect(() => {
    let alive = true;
    const shown = () => {
      if (!alive) return;
      setReady(true);
      onShown?.();
    };
    const shot = statueShot(state);
    if (!shot) { shown(); return; }
    const variant = pickVariant(state.seed, lastStatueVariant(childId) ?? visitVariant);
    visitVariant = variant;
    // The 4:3 picture is the one kept; upright, the 3:4 close shot is the one shown.
    Promise.all([
      composeStatuePicture({ shot, art, sheet, rtl, variant }),
      upright ? composeStatuePicture({ shot, art, sheet, rtl, variant, shape: "portrait" }) : Promise.resolve(null),
    ])
      .then(([url, tall]) => {
        if (!alive) return;
        if (url) keepStatuePicture(childId, { id: state.seed, at: new Date().toISOString(), url, pose: shot.pose, variant });
        const show = upright ? tall ?? url : url;
        if (show) setPicture(show);
        shown();
      })
      .catch(() => { shown(); /* the ending still stands without its picture */ });
    return () => { alive = false; };
  }, [state.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // The photo lands: a small drop and settle into its tilt (reduced motion: a fade).
  useLayoutEffect(() => {
    const el = photoRef.current;
    if (!picture || !el || typeof el.animate !== "function") return;
    const rest = `rotate(${tilt}deg)`;
    const a = prefersReducedMotion()
      ? el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" })
      : el.animate(
        [
          { opacity: 0, transform: `translateY(-28px) rotate(${tilt * 4}deg) scale(0.92)` },
          { opacity: 1, transform: `translateY(4px) rotate(${-tilt * 0.6}deg) scale(1.01)`, offset: 0.62 },
          { opacity: 1, transform: `translateY(-1px) rotate(${tilt * 1.2}deg) scale(1)`, offset: 0.84 },
          { opacity: 1, transform: rest },
        ],
        { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    return () => a.cancel();
  }, [picture, tilt]);

  const prizes: readonly PrizeId[] = state.prizes;
  return (
    <div data-sneak-ending="" style={{ position: "relative", blockSize: "100%", overflow: "hidden", isolation: "isolate" }}>
      {/* The courtyard itself, softly out of focus and a little darker. */}
      <img
        data-sneak-ending-backdrop=""
        src={art.plate[portrait ? "portrait" : "landscape"]}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ position: "absolute", inset: -32, inlineSize: "calc(100% + 64px)", blockSize: "calc(100% + 64px)", maxInlineSize: "none", objectFit: "cover", filter: "blur(10px) brightness(0.74) saturate(0.95)", transform: rtl ? "scaleX(-1)" : undefined, zIndex: -1, pointerEvents: "none" }}
      />
      <div
        data-sneak-ending-stack=""
        data-sneak-ending-shape={upright ? "upright" : sideways ? "sideways" : "wide"}
        style={{ position: "relative", blockSize: "100%", overflowY: "auto", display: "flex", flexDirection: sideways ? "row" : "column", alignItems: "center", justifyContent: upright ? "flex-start" : "center", gap: sideways ? 24 : "clamp(8px, 1.6dvh, 18px)", paddingInline: 16, paddingBlockEnd: upright ? "max(clamp(10px, 2dvh, 20px), env(safe-area-inset-bottom))" : "clamp(10px, 2dvh, 20px)", paddingBlockStart: sideways ? "calc(max(10px, env(safe-area-inset-top)) + 70px)" : "calc(max(10px, env(safe-area-inset-top)) + 80px)" }}
      >
        <figure
          data-sneak-picture-frame=""
          style={upright
            // Upright: the figure takes every pixel the caption, shelf and toys leave.
            ? { margin: 0, inlineSize: "100%", flex: "1 1 0", minBlockSize: 0, display: "flex", flexDirection: "column" }
            : sideways
              ? { margin: 0, inlineSize: SIDEWAYS_INLINE, flexShrink: 0 }
              : { margin: 0, inlineSize: PICTURE_INLINE, minInlineSize: "min(calc(100vw - 32px), 280px)", flexShrink: 0 }}
        >
          <PhotoBox upright={upright}>
          <div
            ref={photoRef}
            data-sneak-photo=""
            style={{
              inlineSize: upright ? UPRIGHT_INLINE : undefined,
              boxSizing: upright ? "border-box" : undefined,
              padding: LIP,
              background: "var(--arbor-paper-elevated)",
              borderRadius: "clamp(14px, 2vmin, 26px)",
              boxShadow: "0 22px 44px -16px color-mix(in srgb, var(--arbor-ink) 72%, transparent), 0 4px 10px color-mix(in srgb, var(--arbor-ink) 30%, transparent)",
              transform: `rotate(${tilt}deg)`,
              opacity: picture ? 1 : 0,
            }}
          >
            <div style={{ position: "relative", aspectRatio: upright ? `${UPRIGHT.w} / ${UPRIGHT.h}` : `${PICTURE.w} / ${PICTURE.h}`, borderRadius: "clamp(9px, 1.4vmin, 18px)", overflow: "hidden", background: "var(--arbor-paper-deep)" }}>
              {picture && <img data-statue-picture="" src={picture} alt={pictureAlt} style={{ display: "block", inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />}
            </div>
          </div>
          </PhotoBox>
          <figcaption dir="auto" className="kid-type-title" style={{ marginBlockStart: "clamp(10px, 1.8dvh, 18px)", marginInline: "auto", inlineSize: "fit-content", maxInlineSize: "100%", textAlign: "center", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", borderRadius: "var(--kid-r-m)", paddingInline: 18, paddingBlock: 8, fontWeight: 800, boxShadow: "0 6px 16px -8px color-mix(in srgb, var(--arbor-ink) 60%, transparent)" }}>
            {kidIsolate(caption)}
          </figcaption>
        </figure>
        <div data-sneak-ending-side="" style={sideways ? { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, flexShrink: 0 } : { display: "contents" }}>
        {prizes.length > 0 && (
          // The prizes are objects on a shelf, not buttons (aria-hidden, no tap).
          <div aria-hidden="true" data-sneak-prizes="" style={{ position: "relative", isolation: "isolate", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "clamp(14px, 3vmin, 30px)", paddingInline: "clamp(18px, 3vmin, 30px)", paddingBlockEnd: 9, flexShrink: 0 }}>
            {prizes.map((p) => (
              <span key={p} data-sneak-prize={p} style={{ position: "relative", display: "block", inlineSize: "clamp(44px, 7dvh, 76px)", blockSize: "clamp(44px, 7dvh, 76px)" }}>
                <span style={{ position: "absolute", insetInline: "8%", insetBlockEnd: -4, blockSize: 8, borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--arbor-ink) 55%, transparent), transparent)" }} />
                <img src={art.prizes[p].url} alt="" draggable={false} style={{ position: "relative", display: "block", inlineSize: "100%", blockSize: "100%", objectFit: "contain" }} />
              </span>
            ))}
            <span
              data-sneak-shelf=""
              style={{
                position: "absolute",
                insetInline: 0,
                insetBlockEnd: 0,
                blockSize: 12,
                zIndex: -1,
                borderRadius: 6,
                background: "linear-gradient(180deg, color-mix(in srgb, var(--arbor-peach) 62%, var(--arbor-paper-elevated)) 0 35%, color-mix(in srgb, var(--arbor-peach) 55%, var(--arbor-ink)) 100%)",
                boxShadow: "0 8px 14px -6px color-mix(in srgb, var(--arbor-ink) 70%, transparent)",
              }}
            />
          </div>
        )}
        <div
          data-sneak-ending-toys={ready ? "ready" : "waiting"}
          style={{ display: "flex", flexWrap: "wrap", gap: narrow ? 10 : 14, justifyContent: "center", flexShrink: 0, opacity: ready ? 1 : 0, visibility: ready ? "visible" : "hidden", transition: "opacity 240ms ease-out" }}
        >
          <KidToy tone="go" size={narrow ? "m" : "l"} glyph="replay" onClick={onPlayAgain} style={toyPad} data-kid-finish-again="">{kidIsolate(playAgainLabel)}</KidToy>
          {onHome && <KidToy tone="paper" glyph="home" onClick={onHome} style={toyPad} data-kid-finish-home="">{kidIsolate(homeLabel)}</KidToy>}
        </div>
        </div>
      </div>
    </div>
  );
}

/** Upright: a size container that grows into the free height; the photo sits
 *  at its foot so the caption is directly under it. Otherwise: no wrapper. */
function PhotoBox({ upright, children }: { upright: boolean; children: React.ReactNode }) {
  if (!upright) return <>{children}</>;
  return (
    <div data-sneak-photo-box="" style={{ flex: "1 1 0", minBlockSize: 0, containerType: "size", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      {children}
    </div>
  );
}

export default Ending;
