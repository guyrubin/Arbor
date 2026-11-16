import { memo, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { selectionHaptic } from '../../../../../../lib/native';
import { ClayScene } from './ClayScene';
import { FPS, REEL_SECONDS, type Hands, type ReelId, type ShowLook } from './clayTheatreRules';
import { coastDone, coastStep, flingVelocity, type Coast } from './clayHands';
import type { ClayId } from './clayInk';
import type { ClayTicker } from './clayTicker';

/** Blank film before the first frame and after the last, so the reel can be pulled right up to the gate. */
const LEADER = 6;
export interface StripLook { body: ClayId; trim: ClayId; hands: Hands; show: ShowLook }

/** The film strip is the scrubber, and it behaves like film: the gate stays
 * put in the middle and the film is pulled through it. Drag it and it
 * follows the finger; let go while moving and it coasts on, slowing, each
 * frame ticking through the gate; tap a frame and the film glides there.
 * Arrow keys step it. Time runs in reading direction (right to left in
 * Hebrew); the pictures on the film stay as they are. Whatever moved it, the
 * stage shows the frame under the gate and nothing else. */
export function FilmStrip({ reel, frame, end, rtl, playing, reduced, label, valueText, look, ticker, hint, onSeek, onGrab, onBeat }: {
  reel: ReelId; frame: number; end: number; rtl: boolean; playing: boolean; reduced: boolean; label: string; valueText: string; look: StripLook; ticker: ClayTicker;
  hint: boolean; onSeek: (frame: number) => void; onGrab: () => void; onBeat: (frame: number) => void;
}) {
  const film = useRef<HTMLSpanElement>(null);
  /** The film's place under the gate, in frames (fractional while a hand or its momentum moves it). */
  const pos = useRef(frame), shown = useRef(frame), busy = useRef(false);
  const drag = useRef<{ id: number; x0: number; pos0: number; moved: number; samples: { at: number; pos: number }[] } | null>(null);
  const leave = useRef<(() => void) | null>(null);
  const sign = rtl ? 1 : -1;
  const place = (at: number, glide: 'none' | 'play' | 'step') => {
    const el = film.current; if (!el) return;
    el.dataset.glide = reduced ? 'none' : glide;
    el.style.transform = `translate3d(calc(var(--ct-cell) * ${(sign * (LEADER + at / FPS)).toFixed(4)}), 0, 0)`;
  };
  const cell = () => (film.current?.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width || 72;
  const stopCoast = () => { leave.current?.(); leave.current = null; };
  /** Moves the film to `at`; tells the stage when a new frame reaches the gate. */
  const pull = (at: number) => {
    pos.current = Math.max(0, Math.min(end, at));
    place(pos.current, 'none');
    const now = Math.round(pos.current);
    if (now !== shown.current) { shown.current = now; onSeek(now); if (now % FPS === 0) { onBeat(now); void selectionHaptic(); } }
  };
  const settle = () => { busy.current = false; pos.current = Math.round(pos.current); shown.current = pos.current; place(pos.current, 'step'); onSeek(pos.current); };
  /** Lets the film run on by itself: `toward` set glides there, otherwise it coasts on the fling's speed. */
  const run = (start: Coast, toward: number | null) => {
    stopCoast(); busy.current = true;
    let c = start;
    leave.current = ticker.add(dt => {
      if (toward !== null) {
        const next = c.pos + (toward - c.pos) * Math.min(1, dt * 14);
        c = { pos: Math.abs(toward - next) < 0.35 ? toward : next, vel: 0 };
        pull(c.pos);
        if (c.pos === toward) { leave.current = null; settle(); return false; }
        return true;
      }
      c = coastStep(c, dt, end); pull(c.pos);
      if (coastDone(c)) { leave.current = null; settle(); return false; }
      return true;
    });
  };
  // The film follows the frame on stage whenever no hand (or momentum) is moving it.
  useLayoutEffect(() => {
    if (busy.current) return;
    pos.current = frame; shown.current = frame;
    place(frame, playing ? 'play' : 'step');
  });
  useEffect(() => () => { stopCoast(); busy.current = false; }, []);
  useEffect(() => { stopCoast(); busy.current = false; drag.current = null; }, [reel]);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.currentTarget.focus();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    stopCoast(); busy.current = true; onGrab();
    pos.current = shown.current = Math.round(pos.current);
    drag.current = { id: e.pointerId, x0: e.clientX, pos0: pos.current, moved: 0, samples: [{ at: e.timeStamp / 1000, pos: pos.current }] };
    void selectionHaptic();
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0; d.moved = Math.max(d.moved, Math.abs(dx));
    if (d.moved < 4) return;
    // Pulling the film one frame's width brings the next frame to the gate.
    pull(d.pos0 + (sign * dx * FPS) / cell());
    d.samples.push({ at: e.timeStamp / 1000, pos: pos.current }); if (d.samples.length > 8) d.samples.shift();
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved < 4) {
      // A tap: the tapped place on the film comes to the gate.
      const box = e.currentTarget.getBoundingClientRect(), off = e.clientX - (box.left + box.width / 2);
      const target = Math.max(0, Math.min(end, Math.round(pos.current - (sign * off * FPS) / cell())));
      if (reduced || target === pos.current) { pos.current = target; settle(); return; }
      run({ pos: pos.current, vel: 0 }, target); return;
    }
    const vel = reduced ? 0 : flingVelocity(d.samples, e.timeStamp / 1000);
    if (coastDone({ pos: pos.current, vel })) { settle(); return; }
    run({ pos: pos.current, vel }, null);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const ahead = rtl ? 'ArrowLeft' : 'ArrowRight', behind = rtl ? 'ArrowRight' : 'ArrowLeft';
    const by: Record<string, number> = { [ahead]: 1, [behind]: -1, ArrowUp: 1, ArrowDown: -1, PageUp: FPS, PageDown: -FPS };
    const go = (to: number) => { e.preventDefault(); stopCoast(); busy.current = false; onGrab(); onSeek(Math.max(0, Math.min(end, to))); };
    if (e.key === 'Home') { go(0); return; }
    if (e.key === 'End') { go(end); return; }
    if (e.key in by) go(frame + by[e.key]);
  };
  return <div className="ct-strip" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={end} aria-valuenow={frame} aria-valuetext={valueText} aria-orientation="horizontal"
    data-strip="" data-hint={hint} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
    <span className="ct-strip__window" aria-hidden="true">
      <span className="ct-strip__nudge">
        <span className="ct-strip__film" ref={film} data-glide="none">
          {Array.from({ length: LEADER }, (_, i) => <span key={`a${i}`} className="ct-strip__cell ct-strip__cell--blank" data-lead={LEADER - i} />)}
          <StripFrames reel={reel} look={look} />
          {Array.from({ length: LEADER }, (_, i) => <span key={`z${i}`} className="ct-strip__cell ct-strip__cell--blank" />)}
        </span>
      </span>
    </span>
    {/* The gate: fixed, a lamp behind it that flickers as each frame goes through. */}
    <span className="ct-strip__gate" data-flick={frame % 2} aria-hidden="true"><i /></span>
    {hint && <span className="ct-ghost ct-ghost--drag" aria-hidden="true"><GhostHand /></span>}
  </div>;
}
/** One tiny frame a second, rendered by the same function as the stage. */
const StripFrames = memo(function StripFrames({ reel, look }: { reel: ReelId; look: StripLook }) {
  const cells = Math.round(REEL_SECONDS[reel]);
  return <>{Array.from({ length: cells }, (_, i) => <span key={i} className="ct-strip__cell"><ClayScene reel={reel} frame={Math.round((i + 0.5) * FPS)} body={look.body} trim={look.trim} hands={look.hands} show={look.show} lite /></span>)}</>;
});

/** The hint hand: a soft white mitten with a graphite line, never in the way of a finger. */
export function GhostHand() {
  return <svg viewBox="0 0 48 56" className="ct-ghost__hand" aria-hidden="true" focusable="false">
    <path d="M19 4c3.3 0 5.5 2.4 5.5 5.6V24l11.800 2.400c4.300 .9 7.200 4.500 6.700 8.900l-1.400 10.300C40.800 50.400 37 53 32.500 53h-9.800c-3.600 0-6.700-1.500-8.900-4.300L5.500 37.800c-1.700-2.300-1.300-5.300 .9-7 2.100-1.600 5-1.400 6.900 .5l.2 .2V9.600C13.500 6.400 15.700 4 19 4z" style={{ fill: 'var(--studio-surface)', stroke: 'var(--studio-graphite)', strokeWidth: 2.2, strokeLinejoin: 'round' }} />
    <path d="M24.500 24v8M30.500 26v7M36.500 28v6" fill="none" strokeLinecap="round" style={{ stroke: 'var(--studio-line)', strokeWidth: 2 }} />
  </svg>;
}
