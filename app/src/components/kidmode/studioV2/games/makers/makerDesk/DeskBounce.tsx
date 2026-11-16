import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import type { DeskAudio } from './deskAudio';
import type { MakerDeskWords } from './makerDeskCopy';
import { BALL, FIELD_H, FIELD_W, LANTERN_COLS, PADDLE_H, PADDLE_W, PADDLE_Y, advance, chimeStep, lanternRow, litCount, newBounce, pickLayout, type BounceState, type LanternLayout, type PaddleInput } from './makerDeskRules';

/** Bounce: drawn on a 160 by 120 canvas and scaled up with crisp squares.
 * Fixed-timestep physics from the rules; this component reads input, plays
 * the small sounds and paints the feel on top: the paddle squashes and
 * springs back, the ball leaves a trail in the colour of the last lantern it
 * lit, a lit lantern pops and sheds sparks, a finished row rings a chord and
 * a wave of light runs along it, and when every lantern glows they lift off
 * like sky lanterns under a shooting star. One frame loop, which runs only
 * while the program is open and the tab is visible, and is cancelled on
 * unmount; at most 64 sparks; nothing here can end the game. */
const PALETTE = ['night', 'indigo-deep', 'indigo', 'slate', 'teal', 'teal-deep', 'sea', 'cream', 'white', 'butter', 'sun', 'amber', 'rose', 'spring', 'lilac', 'snow', 'snow-shade', 'orange'] as const;
type Ink = typeof PALETTE[number];
const LANTERN_INK: readonly Ink[] = ['amber', 'rose', 'sea', 'spring', 'lilac'];
const SHOW_S = 2.6;
const NUDGE = 18;
const SPARKS_MAX = 64;
const TRAIL = 9;
/** The cloud's puffs: centre and radius, on the field's grid. */
const CLOUD: readonly [number, number][] = [[10, 5], [34, 7], [60, 5], [84, 8], [110, 6], [136, 7], [156, 5]];
const SKY: readonly [number, number][] = [[12, 70], [30, 58], [140, 64], [120, 78], [70, 62], [96, 54], [150, 50], [8, 52], [52, 84], [104, 90], [134, 40], [24, 96]];
interface Spark { x: number; y: number; vx: number; vy: number; ink: Ink; life: number }

export function DeskBounce({ w, audio, reduced, onAllLit, onStatus, onMoment, onBall }: { w: MakerDeskWords; audio: DeskAudio | null; reduced: boolean; onAllLit: () => void; onStatus: (text: string) => void;
  onMoment?: (moment: 'row' | 'cloud' | 'allLit') => void; onBall?: (across: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const layout = useRef<LanternLayout>(pickLayout(Math.random));
  const state = useRef<BounceState>(newBounce(Math.random, layout.current));
  const input = useRef<PaddleInput>({ dir: 0, target: null });
  const show = useRef(-1);
  const touched = useRef(false);
  const [round, setRound] = useState(0);
  const [glowing, setGlowing] = useState(false);
  const [ghost, setGhost] = useState(false);
  const callbacks = useRef({ onAllLit, onStatus, onMoment, onBall, audio, w, reduced });
  callbacks.current = { onAllLit, onStatus, onMoment, onBall, audio, w, reduced };

  // Show, don't tell: a ghost hand slides the paddle until the child has moved it once.
  useEffect(() => {
    if (touched.current) return;
    const timer = setTimeout(() => { if (!touched.current) setGhost(true); }, 1200);
    return () => clearTimeout(timer);
  }, []);
  const hands = () => { if (!touched.current) { touched.current = true; setGhost(false); } };

  useEffect(() => {
    const node = canvas.current; const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    // Colours come from the maker palette, resolved once (canvas cannot read var()).
    const css = getComputedStyle(node);
    const ink = Object.fromEntries(PALETTE.map(name => [name, css.getPropertyValue(`--mk-${name}`).trim() || 'currentColor'])) as Record<Ink, string>;
    let frame = 0, last = -1, carry = 0, clock = 0, squash = 9, shake = 0, cloudAt = -1, cloudT = 9, told = 0, hover = 0;
    let trailInk: Ink = 'sea';
    const sparks: Spark[] = [];
    const trail: { x: number; y: number }[] = [];
    const pop = state.current.lanterns.map(() => 9), rowWave = [9, 9, 9];
    const px = (x: number, y: number, pw: number, ph: number, colour: string, alpha = 1) => { if (alpha <= 0) return; ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = colour; ctx.fillRect(Math.round(x), Math.round(y), Math.round(pw), Math.round(ph)); };
    const burst = (x: number, y: number, colour: Ink, count: number, speed: number) => {
      if (callbacks.current.reduced) return;
      for (let i = 0; i < count && sparks.length < SPARKS_MAX; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, ink: colour, life: 0.5 + Math.random() * 0.4 }); }
    };
    const paint = () => {
      const s = state.current; const t = clock; const still = callbacks.current.reduced;
      const showing = show.current >= 0 ? show.current : hover > 0 ? SHOW_S : -1;
      const lift = showing < 0 || still ? 0 : Math.min(1, showing / SHOW_S);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      px(0, 0, FIELD_W, FIELD_H, ink.night);
      if (shake > 0 && !still) ctx.setTransform(1, 0, 0, 1, Math.round(Math.sin(t * 90)), Math.round(Math.cos(t * 70) * 0.6));
      px(-2, -2, FIELD_W + 4, 36, ink['indigo-deep'], 0.6 + lift * 0.25);
      for (const [x, y] of SKY) px(x, y, 1, 1, ink.butter, (0.4 + 0.3 * Math.sin(t * 1.3 + x)) * (1 + lift));
      // A shooting star crosses while the lanterns rise.
      if (show.current > 0.5 && show.current < 1.5 && !still) { const p = (show.current - 0.5); for (let i = 0; i < 7; i++) px(20 + p * 120 - i * 3, 44 + p * 30 - i * 0.8, 2 - (i > 3 ? 1 : 0), 1, i === 0 ? ink.white : ink.butter, 1 - i * 0.14); }
      // The cloud the ball can always fall into: soft pixel puffs along the bottom.
      for (const [cx, r] of CLOUD) {
        const bob = cloudT < 0.6 && Math.abs(cx - cloudAt) < 34 && !still ? Math.round(Math.sin(cloudT / 0.6 * Math.PI) * 2) : 0;
        for (let dy = 0; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.6); px(cx - half, FIELD_H - 2 - dy - bob, half * 2, 1, ink['snow-shade'], 0.34); }
        px(cx - r, FIELD_H - 2 - r + 1 - bob, r, 1, ink.snow, 0.35);
      }
      px(0, FIELD_H - 2, FIELD_W, 2, ink['snow-shade'], 0.4);
      // Lanterns: dark until touched, then glowing. When all glow they lift off and sway.
      s.lanterns.forEach((l, i) => {
        const lit = s.lit[i]; const col = i % LANTERN_COLS, row = lanternRow(i);
        const rise = lift ? Math.round(lift * lift * (10 + row * 2) + Math.sin(t * 2 + i) * 1.2 * lift) : 0;
        const sway = lift ? Math.round(Math.sin(t * 1.4 + i * 0.9) * 1.5 * lift) : 0;
        const x = l.x + sway, y = l.y - rise;
        const wave = showing >= 0 && !still ? 0.6 + 0.4 * Math.sin(t * 6 - col * 0.9 - row * 0.6) : 1;
        const sweep = rowWave[row] < 0.7 && !still ? Math.max(0, 1 - Math.abs(rowWave[row] / 0.7 * (LANTERN_COLS + 1) - col - 0.5)) : 0;
        const popped = pop[i] < 0.28 && !still ? 1 - pop[i] / 0.28 : 0;
        const body = lit ? ink[LANTERN_INK[l.hue]] : ink.indigo;
        const grow = popped > 0.4 ? 1 : 0;
        if (lit) px(x - 2 - grow, y - 2 - grow, l.w + 4 + grow * 2, l.h + 4 + grow * 2, body, 0.2 * wave + popped * 0.3);
        // A paper lantern: rounded body, two ribs, a cap on top and a tassel below.
        px(x + 1, y, l.w - 2, l.h, body);
        px(x, y + 1, l.w, l.h - 2, body);
        if (lit) {
          px(x + 3, y + 2, l.w - 6, l.h - 4, ink.butter, 0.55 + 0.45 * wave);
          px(x + 5, y + 3, l.w - 10, 1, ink.white, 0.85 * wave);
          if (popped || sweep) px(x, y, l.w, l.h, ink.white, Math.max(popped * 0.8, sweep * 0.7));
        } else px(x + 3, y + 2, l.w - 6, l.h - 4, ink['indigo-deep']);
        px(x + Math.round(l.w / 3), y + 1, 1, l.h - 2, lit ? ink.amber : ink.slate, lit ? 0.5 : 0.8);
        px(x + Math.round(l.w * 2 / 3), y + 1, 1, l.h - 2, lit ? ink.amber : ink.slate, lit ? 0.5 : 0.8);
        px(x + l.w / 2 - 4, y - 1, 8, 1, lit ? ink.amber : ink.slate);
        px(x + l.w / 2 - 3, y + l.h, 6, 1, lit ? ink.amber : ink.slate);
        if (lit) px(x + l.w / 2, y + l.h + 1, 1, 1 + (lift ? 1 : 0), ink.orange);
      });
      for (const spark of sparks) px(spark.x, spark.y, 1, 1, ink[spark.ink], spark.life * 1.6);
      // The paddle squashes when the ball lands and springs back a little too far.
      const sq = squash < 0.4 && !still ? 0.5 * Math.exp(-6 * squash / 0.4) * Math.cos(10 * squash / 0.4) : 0;
      const ph = Math.max(2, Math.round(PADDLE_H * (1 - sq))), pw = Math.round(PADDLE_W * (1 + sq * 0.3));
      const wiggle = show.current >= 0 && !still ? Math.round(Math.sin(show.current * 12) * 2) : 0;
      const pxl = s.paddle - pw / 2 + wiggle, pyt = PADDLE_Y + PADDLE_H - ph;
      px(pxl + 1, pyt + ph, pw - 2, 1, ink.night, 0.5);
      px(pxl, pyt, pw, ph, ink.cream);
      px(pxl + 2, pyt + ph - 1, pw - 4, 1, ink.teal);
      px(pxl + 2, pyt, pw - 4, 1, ink.white, 0.7);
      px(pxl, pyt, 2, ph, ink.sea, 0.8); px(pxl + pw - 2, pyt, 2, ph, ink.sea, 0.8);
      if (!s.done) {
        const b = s.ball;
        if (s.floating === 0 && !still) trail.forEach((p, i) => { const k = (i + 1) / trail.length; px(p.x - (k > 0.6 ? 1.5 : 1), p.y - (k > 0.6 ? 1.5 : 1), k > 0.6 ? 3 : 2, k > 0.6 ? 3 : 2, ink[trailInk], k * 0.42); });
        if (s.floating > 0) for (let i = 0; i < 3; i++) px(b.x - 3 + i * 3, b.y + 4 + ((t * 20 + i * 5) % 8), 1, 1, ink.snow, 0.5);
        px(b.x - BALL / 2, b.y - BALL / 2 + 1, BALL, BALL - 2, ink.white);
        px(b.x - BALL / 2 + 1, b.y - BALL / 2, BALL - 2, BALL, ink.white);
        px(b.x - BALL / 2 + 1, b.y - BALL / 2 + 1, 1, 1, ink.butter);
      }
      ctx.globalAlpha = 1;
    };
    const tick = (now: number) => {
      frame = 0;
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
      squash += dt; cloudT += dt; shake = Math.max(0, shake - dt);
      for (let i = 0; i < pop.length; i++) pop[i] += dt;
      for (let i = 0; i < rowWave.length; i++) rowWave[i] += dt;
      const { audio: sound, w: words } = callbacks.current;
      if (show.current >= 0) {
        show.current += dt;
        if (!callbacks.current.reduced && sparks.length < SPARKS_MAX && Math.random() < 0.7) {
          const l = state.current.lanterns[Math.floor(Math.random() * state.current.lanterns.length)];
          sparks.push({ x: l.x + Math.random() * l.w, y: l.y - 4, vx: (Math.random() - 0.5) * 8, vy: -8 - Math.random() * 14, ink: LANTERN_INK[l.hue], life: 0.9 });
        }
        if (show.current >= SHOW_S) { show.current = -1; hover = 1; setGlowing(true); }
      } else if (!hover) {
        const out = advance(state.current, input.current, carry, dt);
        state.current = out.state; carry = out.carry;
        for (const event of out.events) {
          if (event.type === 'wall') sound?.tok(true);
          else if (event.type === 'paddle') { const lean = (out.state.ball.x - out.state.paddle) / (PADDLE_W / 2); sound?.tok(false, lean); squash = 0; shake = 0.07; burst(out.state.ball.x, PADDLE_Y, 'cream', 3, 16); }
          else if (event.type === 'lantern') {
            const l = out.state.lanterns[event.index]; pop[event.index] = 0; trailInk = LANTERN_INK[l.hue];
            burst(l.x + l.w / 2, l.y + l.h / 2, LANTERN_INK[l.hue], 7, 26); void selectionHaptic();
            sound?.chime(chimeStep(litCount(out.state.lit))); callbacks.current.onStatus(words.lit);
          }
          else if (event.type === 'row') { rowWave[event.row] = 0; shake = 0.1; sound?.chord(event.row); callbacks.current.onStatus(words.rowLit); callbacks.current.onMoment?.('row'); }
          else if (event.type === 'cloud') { cloudAt = out.state.ball.x; cloudT = 0; trail.length = 0; sound?.boop(); callbacks.current.onStatus(words.cloud); callbacks.current.onMoment?.('cloud'); }
          else if (event.type === 'allLit') { sound?.fanfare(); callbacks.current.onStatus(words.allLit); callbacks.current.onAllLit(); callbacks.current.onMoment?.('allLit'); show.current = 0; }
        }
        const b = state.current.ball;
        if (state.current.floating === 0) { trail.push({ x: b.x, y: b.y }); if (trail.length > TRAIL) trail.shift(); }
        if (++told % 6 === 0) callbacks.current.onBall?.(b.x / FIELD_W);
      }
      for (const spark of sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += 30 * dt; spark.life -= dt * 1.1; }
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
      e.preventDefault(); hands(); input.current = { dir: e.key === 'ArrowLeft' ? -1 : 1, target: null };
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
    if (e.type === 'pointerdown') { e.currentTarget.setPointerCapture?.(e.pointerId); hands(); }
    else if (!e.currentTarget.hasPointerCapture?.(e.pointerId) && e.pointerType !== 'mouse') return;
    else if (e.pointerType === 'mouse' && e.buttons === 0) return;
    input.current = { dir: 0, target: toField(e.clientX) };
  };
  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); hands(); void selectionHaptic(); input.current = { dir, target: null }; },
    onPointerUp: () => { input.current = { dir: 0, target: null }; },
    onPointerCancel: () => { input.current = { dir: 0, target: null }; },
    onLostPointerCapture: () => { if (input.current.dir === dir) input.current = { dir: 0, target: null }; },
    // A keyboard press (no pointer) nudges the paddle one step.
    onClick: (e: { detail: number }) => { if (e.detail === 0) { hands(); input.current = { dir: 0, target: state.current.paddle + dir * NUDGE }; } },
  });
  /** A new round is never the arrangement just played. */
  const again = () => { void selectionHaptic(); layout.current = pickLayout(Math.random, layout.current); state.current = newBounce(Math.random, layout.current); show.current = -1; input.current = { dir: 0, target: null }; setGlowing(false); setRound(value => value + 1); };

  return <div className="md-bounce" data-glowing={glowing}>
    <div className="md-bounce__field" ref={field} onPointerDown={drag} onPointerMove={drag} role="img" aria-label={w.bounceField}>
      <canvas ref={canvas} width={FIELD_W} height={FIELD_H} className="md-bounce__canvas" />
      {ghost && <span className="md-bounce__ghost" aria-hidden="true"><svg viewBox="0 0 60 72" focusable="false"><path className="md-ghost__hand" d="M22 8c4 0 6 3 6 7v15l12 3c7 2 10 7 9 14l-2 12c-1 6-5 9-11 9H26c-5 0-8-2-11-6L5 48c-3-4 0-9 5-7l6 3V15c0-4 2-7 6-7z" /></svg></span>}
    </div>
    {/* The paddle moves on the screen's left and right, in both languages. */}
    <button type="button" className="md-key md-bounce__left" data-control="left" aria-label={w.left} {...hold(-1)}><ChevronLeft size={30} strokeWidth={3} aria-hidden="true" /></button>
    <div className="md-bounce__mid">{glowing
      ? <button type="button" className="md-key md-key--go" data-control="again" onClick={again}><RotateCcw size={20} aria-hidden="true" />{w.again}</button>
      : <span className="md-bounce__hint" aria-hidden="true"><span /><span /><span /></span>}</div>
    <button type="button" className="md-key md-bounce__right" data-control="right" aria-label={w.right} {...hold(1)}><ChevronRight size={30} strokeWidth={3} aria-hidden="true" /></button>
  </div>;
}
