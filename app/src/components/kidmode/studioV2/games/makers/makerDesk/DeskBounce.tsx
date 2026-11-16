import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { DeskAudio } from './deskAudio';
import type { MakerDeskWords } from './makerDeskCopy';
import { BALL, FIELD_H, FIELD_W, LANTERN_COLS, PADDLE_H, PADDLE_W, PADDLE_Y, advance, chimeStep, litCount, newBounce, type BounceState, type PaddleInput } from './makerDeskRules';

/** Bounce: drawn on a 160 by 120 canvas and scaled up with crisp squares.
 * Fixed-timestep physics from the rules; this component only reads input,
 * plays the small sounds and paints. The loop runs only while the program is
 * open and the tab is visible; it is cancelled on unmount. */
const PALETTE = ['night', 'indigo-deep', 'indigo', 'slate', 'teal', 'teal-deep', 'sea', 'cream', 'white', 'butter', 'sun', 'amber', 'rose', 'spring', 'lilac', 'snow', 'snow-shade', 'orange'] as const;
type Ink = typeof PALETTE[number];
const LANTERN_INK: readonly Ink[] = ['amber', 'rose', 'sea', 'spring', 'lilac'];
const SHOW_S = 2.6;
const NUDGE = 18;
/** The cloud's puffs: centre and radius, on the field's grid. */
const CLOUD: readonly [number, number][] = [[10, 5], [34, 7], [60, 5], [84, 8], [110, 6], [136, 7], [156, 5]];

export function DeskBounce({ w, audio, reduced, onAllLit, onStatus }: { w: MakerDeskWords; audio: DeskAudio | null; reduced: boolean; onAllLit: () => void; onStatus: (text: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const state = useRef<BounceState>(newBounce(Math.random));
  const input = useRef<PaddleInput>({ dir: 0, target: null });
  const show = useRef(-1);
  const [round, setRound] = useState(0);
  const [glowing, setGlowing] = useState(false);
  const callbacks = useRef({ onAllLit, onStatus, audio, w, reduced });
  callbacks.current = { onAllLit, onStatus, audio, w, reduced };

  useEffect(() => {
    const node = canvas.current; const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    // Colours come from the maker palette, resolved once (canvas cannot read var()).
    const css = getComputedStyle(node);
    const ink = Object.fromEntries(PALETTE.map(name => [name, css.getPropertyValue(`--mk-${name}`).trim() || 'currentColor'])) as Record<Ink, string>;
    let frame = 0, last = -1, carry = 0, clock = 0;
    const sparks: { x: number; y: number; vy: number; ink: Ink; life: number }[] = [];
    const px = (x: number, y: number, w: number, h: number, colour: string, alpha = 1) => { ctx.globalAlpha = alpha; ctx.fillStyle = colour; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const paint = () => {
      const s = state.current; const t = clock;
      px(0, 0, FIELD_W, FIELD_H, ink.night);
      px(0, 0, FIELD_W, 34, ink['indigo-deep'], 0.6);
      for (const [x, y] of [[12, 70], [30, 58], [140, 64], [120, 78], [70, 62], [96, 54], [150, 50], [8, 52]]) px(x, y, 1, 1, ink.butter, 0.45 + 0.3 * Math.sin(t * 1.3 + x));
      // The cloud the ball can always fall into: soft pixel puffs along the bottom.
      for (const [cx, r] of CLOUD) {
        for (let dy = 0; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.6); px(cx - half, FIELD_H - 2 - dy, half * 2, 1, ink['snow-shade'], 0.34); }
        px(cx - r, FIELD_H - 2 - r + 1, r, 1, ink.snow, 0.35);
      }
      px(0, FIELD_H - 2, FIELD_W, 2, ink['snow-shade'], 0.4);
      // Lanterns: dark until touched, then glowing (and wave-lit in the light show).
      s.lanterns.forEach((l, i) => {
        const lit = s.lit[i];
        const wave = show.current >= 0 && !callbacks.current.reduced ? 0.55 + 0.45 * Math.sin(show.current * 7 - (i % LANTERN_COLS) * 0.9 - Math.floor(i / LANTERN_COLS) * 0.6) : 1;
        const body = lit ? ink[LANTERN_INK[l.hue]] : ink.indigo;
        if (lit) px(l.x - 2, l.y - 2, l.w + 4, l.h + 4, body, 0.2 * wave);
        // A paper lantern: rounded body, two ribs, a cap on top and a tassel below.
        px(l.x + 1, l.y, l.w - 2, l.h, body);
        px(l.x, l.y + 1, l.w, l.h - 2, body);
        if (lit) {
          px(l.x + 3, l.y + 2, l.w - 6, l.h - 4, ink.butter, 0.55 + 0.45 * wave);
          px(l.x + 5, l.y + 3, l.w - 10, 1, ink.white, 0.85 * wave);
        } else px(l.x + 3, l.y + 2, l.w - 6, l.h - 4, ink['indigo-deep']);
        px(l.x + Math.round(l.w / 3), l.y + 1, 1, l.h - 2, lit ? ink.amber : ink.slate, lit ? 0.5 : 0.8);
        px(l.x + Math.round(l.w * 2 / 3), l.y + 1, 1, l.h - 2, lit ? ink.amber : ink.slate, lit ? 0.5 : 0.8);
        px(l.x + l.w / 2 - 4, l.y - 1, 8, 1, lit ? ink.amber : ink.slate);
        px(l.x + l.w / 2 - 3, l.y + l.h, 6, 1, lit ? ink.amber : ink.slate);
        if (lit) px(l.x + l.w / 2, l.y + l.h + 1, 1, 1, ink.orange);
      });
      for (const spark of sparks) px(spark.x, spark.y, 1, 1, ink[spark.ink], Math.max(0, spark.life));
      // Paddle and ball.
      px(s.paddle - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, ink.cream);
      px(s.paddle - PADDLE_W / 2 + 2, PADDLE_Y + PADDLE_H - 1, PADDLE_W - 4, 1, ink.teal);
      px(s.paddle - PADDLE_W / 2 + 2, PADDLE_Y, PADDLE_W - 4, 1, ink.white, 0.7);
      if (!s.done) {
        const b = s.ball;
        if (s.floating === 0) px(b.x - b.vx * 0.05 - 1, b.y - b.vy * 0.05 - 1, 2, 2, ink.sea, 0.4);
        px(b.x - BALL / 2, b.y - BALL / 2 + 1, BALL, BALL - 2, ink.white);
        px(b.x - BALL / 2 + 1, b.y - BALL / 2, BALL - 2, BALL, ink.white);
      }
      ctx.globalAlpha = 1;
    };
    const tick = (now: number) => {
      frame = 0;
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
      const { audio: sound, w: words } = callbacks.current;
      if (show.current >= 0) {
        show.current += dt;
        if (!callbacks.current.reduced && sparks.length < 24 && Math.random() < 0.6) {
          const l = state.current.lanterns[Math.floor(Math.random() * state.current.lanterns.length)];
          sparks.push({ x: l.x + Math.random() * l.w, y: l.y, vy: -10 - Math.random() * 14, ink: LANTERN_INK[l.hue], life: 1 });
        }
        if (show.current >= SHOW_S) { show.current = -1; sparks.length = 0; setGlowing(true); paint(); return; }
      } else {
        const out = advance(state.current, input.current, carry, dt);
        state.current = out.state; carry = out.carry;
        for (const event of out.events) {
          if (event.type === 'wall') sound?.tok(true);
          else if (event.type === 'paddle') sound?.tok(false);
          else if (event.type === 'lantern') { sound?.chime(chimeStep(litCount(out.state.lit))); callbacks.current.onStatus(words.lit); }
          else if (event.type === 'cloud') { sound?.boop(); callbacks.current.onStatus(words.cloud); }
          else if (event.type === 'allLit') { sound?.fanfare(); callbacks.current.onStatus(words.allLit); callbacks.current.onAllLit(); show.current = 0; }
        }
      }
      for (const spark of sparks) { spark.y += spark.vy * dt; spark.life -= dt * 0.8; }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      paint();
      if (document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!frame && document.visibilityState !== 'hidden') { last = -1; frame = requestAnimationFrame(tick); } };
    const pause = () => { if (frame) cancelAnimationFrame(frame); frame = 0; input.current = { dir: 0, target: input.current.target }; };
    const visibility = () => { if (document.visibilityState === 'hidden') pause(); else start(); };
    document.addEventListener('visibilitychange', visibility);
    paint(); start();
    return () => { pause(); document.removeEventListener('visibilitychange', visibility); };
  }, [round]);

  // Arrow keys move the paddle while Bounce is open (not while typing elsewhere).
  useEffect(() => {
    const typing = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'); };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault(); input.current = { dir: e.key === 'ArrowLeft' ? -1 : 1, target: null };
    };
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') input.current = { dir: 0, target: null }; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const toField = (clientX: number) => {
    const box = field.current?.getBoundingClientRect();
    return box && box.width > 0 ? (clientX - box.left) / box.width * FIELD_W : null;
  };
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') { e.currentTarget.setPointerCapture?.(e.pointerId); }
    else if (!e.currentTarget.hasPointerCapture?.(e.pointerId) && e.pointerType !== 'mouse') return;
    else if (e.pointerType === 'mouse' && e.buttons === 0) return;
    input.current = { dir: 0, target: toField(e.clientX) };
  };
  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); input.current = { dir, target: null }; },
    onPointerUp: () => { input.current = { dir: 0, target: null }; },
    onPointerCancel: () => { input.current = { dir: 0, target: null }; },
    onLostPointerCapture: () => { if (input.current.dir === dir) input.current = { dir: 0, target: null }; },
    // A keyboard press (no pointer) nudges the paddle one step.
    onClick: (e: { detail: number }) => { if (e.detail === 0) input.current = { dir: 0, target: state.current.paddle + dir * NUDGE }; },
  });
  const again = () => { state.current = newBounce(Math.random); show.current = -1; input.current = { dir: 0, target: null }; setGlowing(false); setRound(value => value + 1); };

  return <div className="md-bounce" data-glowing={glowing}>
    <div className="md-bounce__field" ref={field} onPointerDown={drag} onPointerMove={drag} role="img" aria-label={w.bounceField}>
      <canvas ref={canvas} width={FIELD_W} height={FIELD_H} className="md-bounce__canvas" />
    </div>
    {/* The paddle moves on the screen's left and right, in both languages. */}
    <div className="md-bounce__controls" dir="ltr">
      <button type="button" className="md-key" data-control="left" aria-label={w.left} {...hold(-1)}><ChevronLeft size={30} strokeWidth={3} aria-hidden="true" /></button>
      {glowing
        ? <button type="button" className="md-key md-key--go" data-control="again" onClick={again}><RotateCcw size={20} aria-hidden="true" />{w.again}</button>
        : <span className="md-bounce__hint" aria-hidden="true"><span /><span /><span /></span>}
      <button type="button" className="md-key" data-control="right" aria-label={w.right} {...hold(1)}><ChevronRight size={30} strokeWidth={3} aria-hidden="true" /></button>
    </div>
  </div>;
}
