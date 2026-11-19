import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { selectionHaptic } from '../../../../../../lib/native';
import type { DeskAudio } from './deskAudio';
import type { MakerDeskWords } from './makerDeskCopy';
import {
  BALL, FIELD_H, FIELD_W, LANTERN_COLS, PADDLE_H, PADDLE_W, advance, chainAfter, chainHarmony, chimeStep, fieldHeight, lanternRow, litCount, newBounce, paddleTop, pickLayout, screenGlow,
  type BounceState, type LanternLayout, type PaddleInput,
} from './makerDeskRules';

/** Bounce, inside the glass. The whole display is pearl glass over Horizon
 * Valley, drawn in chunky squares: the playing field sits in the middle of it
 * (taller on a phone), stars and hills run out to the edges, and the cloud the
 * ball can always fall into fills the bottom. Fixed-timestep physics from the
 * rules; this component reads input, plays the small sounds and paints the
 * feel on top: the paddle dips and squashes under the ball and leans into a
 * slide, the ball draws a comet trail in the colour of the last lantern it
 * lit, a lit lantern pops and sheds sparks, lanterns lit in a chain ring a
 * rising harmony and brighten the whole screen, a finished row sends a wave
 * of light along itself, and when every lantern glows they lift off like sky
 * lanterns under fireworks. One frame loop, which runs only while the program
 * is open and the tab is visible, and is cancelled on unmount; at most 96
 * sparks; nothing here can end the game. */
const PALETTE = ['night', 'indigo-deep', 'indigo', 'slate', 'teal', 'teal-deep', 'sea', 'cream', 'white', 'butter', 'sun', 'amber', 'rose', 'spring', 'lilac', 'snow', 'snow-shade', 'orange', 'sky'] as const;
type Ink = typeof PALETTE[number];
const LANTERN_INK: readonly Ink[] = ['amber', 'rose', 'sea', 'spring', 'lilac'];
const SHOW_S = 3.4;
const NUDGE = 18;
const SPARKS_MAX = 96;
const TRAIL = 14;
/** The room the HUD takes at the top and the bottom of the glass, in CSS pixels. */
const HUD_TOP = 92, HUD_BOTTOM = 104, HUD_TOP_SHORT = 20, HUD_BOTTOM_SHORT = 14;
interface Spark { x: number; y: number; vx: number; vy: number; ink: Ink; life: number; big?: boolean }
export interface BounceControls { hold(dir: -1 | 1): void; release(dir: -1 | 1): void; nudge(dir: -1 | 1): void; again(): void }

/** A fixed scatter (no randomness at paint time): star `n` of a sky `w` by `h`. */
const starAt = (n: number, w: number, h: number): [number, number] => [Math.floor(((n * 7919) % 997) / 997 * w), Math.floor(((n * 104729) % 991) / 991 * h)];

export function DeskBounce({ w, audio, reduced, firstLayout, controls, onAllLit, onStatus, onMoment, onGlowing }: { w: MakerDeskWords; audio: DeskAudio | null; reduced: boolean; firstLayout?: LanternLayout;
  controls?: MutableRefObject<BounceControls | null>; onAllLit: () => void; onStatus: (text: string) => void; onMoment?: (moment: 'row' | 'cloud' | 'allLit' | 'chain') => void; onGlowing?: (glowing: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const layout = useRef<LanternLayout>(firstLayout ?? pickLayout(Math.random));
  const state = useRef<BounceState | null>(null);
  const view = useRef({ w: FIELD_W, h: FIELD_H, ox: 0, oy: 0, scale: 1 });
  const input = useRef<PaddleInput>({ dir: 0, target: null });
  const show = useRef(-1);
  const touched = useRef(false);
  const [round, setRound] = useState(0);
  const [ghost, setGhost] = useState(false);
  const callbacks = useRef({ onAllLit, onStatus, onMoment, onGlowing, audio, w, reduced });
  callbacks.current = { onAllLit, onStatus, onMoment, onGlowing, audio, w, reduced };

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
    // The canvas is the whole glass; the field is scaled to fit between the HUD's top row and the dock.
    const measure = () => {
      // The layout size, not the drawn one: the glass is still easing in when this first runs.
      const cw = node.offsetWidth || 320, ch = node.offsetHeight || 240;
      // A phone on its side has no height to spare: there the HUD keeps to the corners and the field takes the middle.
      const short = ch < 420, top = short ? HUD_TOP_SHORT : HUD_TOP, bottom = short ? HUD_BOTTOM_SHORT : HUD_BOTTOM;
      const freeH = Math.max(120, ch - top - bottom);
      const fh = state.current?.h ?? fieldHeight(cw / freeH);
      const scale = Math.max(1, Math.min(cw / FIELD_W, freeH / fh));
      const vw = Math.max(FIELD_W, Math.ceil(cw / scale)), vh = Math.max(fh, Math.ceil(ch / scale));
      view.current = { w: vw, h: vh, ox: Math.round((vw - FIELD_W) / 2), oy: Math.round(top / scale + (freeH / scale - fh) / 2), scale };
      if (node.width !== vw || node.height !== vh) { node.width = vw; node.height = vh; }
      return fh;
    };
    if (!state.current) state.current = newBounce(Math.random, layout.current, measure());
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { measure(); paint(); }) : null;
    observer?.observe(node);
    let frame = 0, last = -1, carry = 0, clock = 0, squash = 9, shake = 0, cloudAt = -1, cloudT = 9, chain = 0, glow = 0, lean = 0, lastPaddle = state.current!.paddle, burstT = 0;
    let trailInk: Ink = 'sea';
    const sparks: Spark[] = [];
    const trail: { x: number; y: number }[] = [];
    const pop = state.current!.lanterns.map(() => 9), rowWave = [9, 9, 9];
    const px = (x: number, y: number, pw: number, ph: number, colour: string, alpha = 1) => { if (alpha <= 0) return; ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = colour; ctx.fillRect(Math.round(x), Math.round(y), Math.round(pw), Math.round(ph)); };
    const burst = (x: number, y: number, colour: Ink, count: number, speed: number) => {
      if (callbacks.current.reduced) return;
      for (let i = 0; i < count && sparks.length < SPARKS_MAX; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, ink: colour, life: 0.5 + Math.random() * 0.4 }); }
    };
    /** A firework: an even ring of fat sparks that hangs, then falls. */
    const firework = (x: number, y: number, colour: Ink) => {
      if (callbacks.current.reduced) return;
      for (let i = 0; i < 16 && sparks.length < SPARKS_MAX; i++) { const a = i / 16 * Math.PI * 2, v = i % 2 ? 30 : 18; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ink: i % 4 === 0 ? 'white' : colour, life: 1.1, big: true }); }
    };
    function paint() {
      const s = state.current!; const t = clock; const still = callbacks.current.reduced;
      const { w: vw, h: vh, ox, oy } = view.current;
      const fh = s.h ?? FIELD_H, padY = paddleTop(fh);
      const showing = show.current >= 0 ? show.current : s.done ? SHOW_S : -1;
      const lift = showing < 0 || still ? 0 : Math.min(1, showing / SHOW_S);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      // The same pearl glass as the desktop, dimmed gently for the lanterns.
      // The toys keep their own colours; the room never becomes a neon wash.
      px(0, 0, vw, vh, ink.snow);
      px(0, 0, vw, Math.round(vh * 0.34), ink['snow-shade'], 0.38);
      px(0, Math.round(vh * 0.34), vw, Math.round(vh * 0.3), ink['snow-shade'], 0.18);
      const stars = Math.round(vw * vh / 420);
      for (let n = 1; n <= stars; n++) { const [x, y] = starAt(n, vw, vh - 14); px(x, y, 1, 1, ink.slate, (0.28 + 0.3 * Math.sin(t * (0.8 + (n % 7) * 0.15) + n)) * (1 + lift + glow)); }
      // Far hills of the valley along the bottom of the sky, behind the cloud.
      for (let x = 0; x < vw; x += 2) { const top = vh - 20 - Math.round(5 * Math.sin(x * 0.045) + 3 * Math.sin(x * 0.11 + 2)); px(x, top, 2, vh - top, ink['teal-deep'], 0.5 + glow * 0.2); }
      // A shooting star crosses while the lanterns rise.
      if (show.current > 0.5 && show.current < 1.7 && !still) { const p = (show.current - 0.5) / 1.2; for (let i = 0; i < 9; i++) px(vw * 0.1 + p * vw * 0.75 - i * 3, vh * 0.12 + p * vh * 0.16 - i * 0.8, 2 - (i > 4 ? 1 : 0), 1, i === 0 ? ink.white : ink.butter, 1 - i * 0.11); }
      ctx!.setTransform(1, 0, 0, 1, ox + (shake > 0 && !still ? Math.round(Math.sin(t * 90)) : 0), oy + (shake > 0 && !still ? Math.round(Math.cos(t * 70) * 0.6) : 0));
      // The field's edges: two soft posts of light, so the walls can be seen on a wide glass.
      if (ox > 2) for (const x of [-2, FIELD_W + 1]) { px(x, -4, 1, fh + 8, ink.sea, 0.28 + glow * 0.3); px(x - 1, -4, 3, fh + 8, ink.sea, 0.07 + glow * 0.08); }
      px(0, -2, FIELD_W, 1, ink.sea, 0.2 + glow * 0.25);
      // The cloud the ball can always fall into: drifting pixel puffs, right across the glass.
      const drift = still ? 0 : t * 2.2;
      for (let cx = -ox - 20 + ((drift % 26) | 0); cx < FIELD_W + ox + 24; cx += 26) {
        const k = Math.round((cx - drift) / 26), r = 5 + ((k * 37) % 5 + 5) % 5;
        const bob = cloudT < 0.6 && Math.abs(cx - cloudAt) < 34 && !still ? Math.round(Math.sin(cloudT / 0.6 * Math.PI) * 3) : 0;
        for (let dy = 0; dy <= r; dy++) { const half = Math.round(Math.sqrt(r * r - dy * dy) * 1.6); px(cx - half, fh - 2 - dy - bob, half * 2, 1, ink['snow-shade'], 0.36); }
        px(cx - r, fh - 2 - r + 1 - bob, r, 1, ink.snow, 0.4);
      }
      px(-ox, fh - 2, vw, vh, ink['snow-shade'], 0.42);
      px(-ox, fh + 6, vw, vh, ink.snow, 0.1);
      // Lanterns hang from threads: dark until touched, then glowing. When all glow they lift off and sway.
      s.lanterns.forEach((l, i) => {
        const on = s.lit[i]; const col = i % LANTERN_COLS, row = lanternRow(i);
        const rise = lift ? Math.round(lift * lift * (22 + row * 5 + oy * 0.6) * (showing < SHOW_S ? 1 : 0.45) + Math.sin(t * 2 + i) * 1.2 * lift) : 0;
        const sway = lift ? Math.round(Math.sin(t * 1.4 + i * 0.9) * 2 * lift) : still ? 0 : Math.round(Math.sin(t * 0.9 + i * 1.7) * 0.6);
        const x = l.x + sway, y = l.y - rise;
        const wave = showing >= 0 && !still ? 0.6 + 0.4 * Math.sin(t * 6 - col * 0.9 - row * 0.6) : 1;
        const sweep = rowWave[row] < 0.7 && !still ? Math.max(0, 1 - Math.abs(rowWave[row] / 0.7 * (LANTERN_COLS + 1) - col - 0.5)) : 0;
        const popped = pop[i] < 0.3 && !still ? 1 - pop[i] / 0.3 : 0;
        const body = on ? ink[LANTERN_INK[l.hue]] : ink.indigo;
        const grow = popped > 0.4 ? 1 : 0;
        if (!lift) px(x + l.w / 2, -oy, 1, y + oy - 1, ink.slate, 0.35);
        if (on) { px(x - 4 - grow, y - 4 - grow, l.w + 8 + grow * 2, l.h + 8 + grow * 2, body, 0.08 * wave + popped * 0.16); px(x - 2 - grow, y - 2 - grow, l.w + 4 + grow * 2, l.h + 4 + grow * 2, body, 0.22 * wave + popped * 0.3); }
        // A paper lantern: rounded body, two ribs, a cap on top and a tassel below.
        px(x + 1, y, l.w - 2, l.h, body);
        px(x, y + 1, l.w, l.h - 2, body);
        if (on) {
          px(x + 3, y + 2, l.w - 6, l.h - 4, ink.butter, 0.55 + 0.45 * wave);
          px(x + 5, y + 3, l.w - 10, 1, ink.white, 0.85 * wave);
          if (popped || sweep) px(x, y, l.w, l.h, ink.white, Math.max(popped * 0.8, sweep * 0.7));
        } else { px(x + 3, y + 2, l.w - 6, l.h - 4, ink['indigo-deep']); px(x + 2, y + 1, l.w - 4, 1, ink.slate, 0.5); }
        px(x + Math.round(l.w / 3), y + 1, 1, l.h - 2, on ? ink.amber : ink.slate, on ? 0.5 : 0.8);
        px(x + Math.round(l.w * 2 / 3), y + 1, 1, l.h - 2, on ? ink.amber : ink.slate, on ? 0.5 : 0.8);
        px(x + l.w / 2 - 4, y - 1, 8, 1, on ? ink.amber : ink.slate);
        px(x + l.w / 2 - 3, y + l.h, 6, 1, on ? ink.amber : ink.slate);
        if (on) px(x + l.w / 2, y + l.h + 1, 1, 1 + (lift ? 1 : 0), ink.orange);
      });
      // The light show: bands of lantern colour wash down the sky while the lanterns rise.
      if (show.current >= 0 && !still) LANTERN_INK.forEach((name, band) => { const at = ((show.current * 0.55 + band * 0.2) % 1) * (fh + oy) - oy; px(-ox, at, vw, 5, ink[name], 0.16 * Math.sin(Math.min(1, show.current / SHOW_S) * Math.PI)); });
      for (const spark of sparks) { const size = spark.big ? 2 : 1; px(spark.x, spark.y, size, size, ink[spark.ink], spark.life * 1.6); }
      // The paddle has weight: it dips and squashes when the ball lands, springs back a little too far, and leans into a slide.
      const hit = squash < 0.45 && !still ? Math.exp(-6 * squash / 0.45) * Math.cos(10 * squash / 0.45) : 0;
      const sq = 0.5 * hit, dip = Math.round(2 * Math.max(0, hit));
      const ph = Math.max(2, Math.round(PADDLE_H * (1 - sq))), pw = Math.round(PADDLE_W * (1 + sq * 0.3));
      const wiggle = show.current >= 0 && !still ? Math.round(Math.sin(show.current * 12) * 2) : 0;
      const pxl = s.paddle - pw / 2 + wiggle, pyt = padY + PADDLE_H - ph + dip;
      const tilt = still ? 0 : Math.max(-1, Math.min(1, Math.round(lean)));
      // A firm graphite edge keeps the pale paddle legible on pearl glass.
      px(pxl - 1, pyt - 1, pw + 2, ph + 2, ink.slate);
      px(pxl + 2, pyt + ph + 1, pw - 4, 1, ink.night, 0.5);
      px(pxl - 2, pyt + ph + 3, pw + 4, 1, ink.sea, 0.12 + glow * 0.2);
      const halfW = Math.round(pw / 2);
      px(pxl, pyt + (tilt < 0 ? 1 : 0), halfW, ph, ink.cream); px(pxl + halfW, pyt + (tilt > 0 ? 1 : 0), pw - halfW, ph, ink.cream);
      px(pxl + 2, pyt + ph - 1, pw - 4, 1, ink.teal);
      px(pxl + 2, pyt, pw - 4, 1, ink.white, 0.7);
      px(pxl, pyt, 2, ph, ink.sea, 0.9); px(pxl + pw - 2, pyt, 2, ph, ink.sea, 0.9);
      if (!s.done) {
        const b = s.ball;
        if (s.floating === 0 && !still) trail.forEach((p, i) => { const k = (i + 1) / trail.length, size = k > 0.7 ? 3 : k > 0.35 ? 2 : 1; px(p.x - size / 2, p.y - size / 2, size, size, ink[trailInk], k * (0.3 + Math.min(0.35, chain * 0.12))); });
        if (s.floating > 0) for (let i = 0; i < 3; i++) px(b.x - 3 + i * 3, b.y + 4 + ((t * 20 + i * 5) % 8), 1, 1, ink.snow, 0.5);
        px(b.x - BALL / 2 - 1, b.y - BALL / 2 - 1, BALL + 2, BALL + 2, ink[trailInk], 0.22 + Math.min(0.3, chain * 0.1));
        // The moving ball needs a solid edge, including with trails disabled.
        px(b.x - BALL / 2 - 1, b.y - BALL / 2 - 1, BALL + 2, BALL + 2, ink.slate);
        px(b.x - BALL / 2, b.y - BALL / 2 + 1, BALL, BALL - 2, ink.white);
        px(b.x - BALL / 2 + 1, b.y - BALL / 2, BALL - 2, BALL, ink.white);
        px(b.x - BALL / 2 + 1, b.y - BALL / 2 + 1, 1, 1, ink.butter);
      }
      ctx!.globalAlpha = 1;
    }
    const tick = (now: number) => {
      frame = 0;
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000); last = now; clock += dt;
      squash += dt; cloudT += dt; shake = Math.max(0, shake - dt);
      for (let i = 0; i < pop.length; i++) pop[i] += dt;
      for (let i = 0; i < rowWave.length; i++) rowWave[i] += dt;
      const { audio: sound, w: words } = callbacks.current;
      const s0 = state.current!;
      if (show.current >= 0) {
        show.current += dt; burstT -= dt;
        // Fireworks over the rising lanterns: a burst every third of a second, each in a lantern's colour.
        if (!callbacks.current.reduced && burstT <= 0 && show.current < SHOW_S - 0.6) {
          burstT = 0.34;
          const span = FIELD_W + view.current.ox * 1.4, fh = state.current!.h ?? FIELD_H;
          firework(FIELD_W / 2 + (Math.random() - 0.5) * span, fh * (0.3 + Math.random() * 0.4), LANTERN_INK[Math.floor(Math.random() * LANTERN_INK.length)]);
          sound?.note(8 + Math.floor(Math.random() * 6), true);
        }
        if (show.current >= SHOW_S) { show.current = -1; callbacks.current.onGlowing?.(true); }
      } else if (!s0.done) {
        const out = advance(s0, input.current, carry, dt);
        state.current = out.state; carry = out.carry;
        for (const event of out.events) {
          chain = chainAfter(chain, event);
          if (event.type === 'wall') sound?.tok(true);
          else if (event.type === 'paddle') { const off = (out.state.ball.x - out.state.paddle) / (PADDLE_W / 2); sound?.tok(false, off); squash = 0; shake = 0.07; burst(out.state.ball.x, paddleTop(out.state.h), 'cream', 4, 16); }
          else if (event.type === 'lantern') {
            const l = out.state.lanterns[event.index]; pop[event.index] = 0; trailInk = LANTERN_INK[l.hue];
            burst(l.x + l.w / 2, l.y + l.h / 2, LANTERN_INK[l.hue], 7 + Math.min(8, chain * 2), 26 + chain * 3); void selectionHaptic();
            const step = chimeStep(litCount(out.state.lit)), harmony = chainHarmony(chain);
            sound?.chime(step); if (harmony) sound?.chime(step + harmony);
            if (chain >= 2) shake = 0.05 + Math.min(0.08, chain * 0.02);
            if (chain === 3) callbacks.current.onMoment?.('chain'); else callbacks.current.onStatus(words.lit);
          }
          else if (event.type === 'row') { rowWave[event.row] = 0; shake = 0.12; sound?.chord(event.row); callbacks.current.onStatus(words.rowLit); callbacks.current.onMoment?.('row'); }
          else if (event.type === 'cloud') { cloudAt = out.state.ball.x; cloudT = 0; trail.length = 0; sound?.boop(); callbacks.current.onStatus(words.cloud); callbacks.current.onMoment?.('cloud'); burst(out.state.ball.x, (out.state.h ?? FIELD_H) - 3, 'snow', 8, 18); }
          else if (event.type === 'allLit') { sound?.fanfare(); callbacks.current.onStatus(words.allLit); callbacks.current.onAllLit(); callbacks.current.onMoment?.('allLit'); show.current = 0; shake = 0.2; }
        }
        const b = state.current.ball;
        if (state.current.floating === 0) { trail.push({ x: b.x, y: b.y }); if (trail.length > TRAIL) trail.shift(); }
      }
      const s1 = state.current!;
      // The screen's glow follows the lanterns and the chain, easing so it breathes instead of flickering.
      const want = s1.done ? 1 : screenGlow(litCount(s1.lit), chain);
      glow += (want - glow) * Math.min(1, dt * 5);
      field.current?.style.setProperty('--md-glow', glow.toFixed(2));
      lean += ((dt > 0 ? (s1.paddle - lastPaddle) / dt / 60 : 0) - lean) * Math.min(1, dt * 12); lastPaddle = s1.paddle;
      for (const spark of sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vy += (spark.big ? 14 : 30) * dt; if (spark.big) { spark.vx *= 1 - dt * 1.6; spark.vy *= 1 - dt * 0.8; } spark.life -= dt * (spark.big ? 0.8 : 1.1); }
      for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
      paint();
      if (document.visibilityState !== 'hidden') frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!frame && document.visibilityState !== 'hidden') { last = -1; frame = requestAnimationFrame(tick); } };
    const pause = () => { if (frame) cancelAnimationFrame(frame); frame = 0; input.current = { dir: 0, target: input.current.target }; };
    const visibility = () => { if (document.visibilityState === 'hidden') pause(); else start(); };
    document.addEventListener('visibilitychange', visibility);
    paint(); start();
    return () => { pause(); observer?.disconnect(); document.removeEventListener('visibilitychange', visibility); };
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

  // The dock's arrows and New lanterns live in the HUD; they reach the game through this handle.
  useEffect(() => {
    if (!controls) return;
    controls.current = {
      hold: dir => { hands(); input.current = { dir, target: null }; },
      release: dir => { if (input.current.dir === dir) input.current = { dir: 0, target: null }; },
      nudge: dir => { hands(); input.current = { dir: 0, target: (state.current?.paddle ?? FIELD_W / 2) + dir * NUDGE }; },
      /** A new round is never the arrangement just played. */
      again: () => { layout.current = pickLayout(Math.random, layout.current); state.current = newBounce(Math.random, layout.current, state.current?.h); show.current = -1; input.current = { dir: 0, target: null }; callbacks.current.onGlowing?.(false); setRound(value => value + 1); },
    };
    return () => { controls.current = null; };
  }, [controls]);

  const toField = (clientX: number) => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return null;
    return (clientX - box.left) / box.width * view.current.w - view.current.ox;
  };
  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.type === 'pointerdown') { e.currentTarget.setPointerCapture?.(e.pointerId); hands(); }
    else if (!e.currentTarget.hasPointerCapture?.(e.pointerId) && e.pointerType !== 'mouse') return;
    else if (e.pointerType === 'mouse' && e.buttons === 0) return;
    input.current = { dir: 0, target: toField(e.clientX) };
  };

  return <div className="md-bounce" ref={field} onPointerDown={drag} onPointerMove={drag} role="img" aria-label={w.bounceField}>
    <canvas ref={canvas} width={FIELD_W} height={FIELD_H} className="md-bounce__canvas" />
    <span className="md-bounce__bloom" aria-hidden="true" />
    {ghost && <span className="md-bounce__ghost" aria-hidden="true"><svg viewBox="0 0 60 72" focusable="false"><path className="md-ghost__hand" d="M22 8c4 0 6 3 6 7v15l12 3c7 2 10 7 9 14l-2 12c-1 6-5 9-11 9H26c-5 0-8-2-11-6L5 48c-3-4 0-9 5-7l6 3V15c0-4 2-7 6-7z" /></svg></span>}
  </div>;
}
