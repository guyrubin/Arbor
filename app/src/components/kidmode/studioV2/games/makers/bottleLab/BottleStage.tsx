/** The still life the child plays in: Glass Grove's bottle bench. Everything
 * in it answers a touch. One frame loop moves all of it (bubbles, the lean of
 * the bottle and the slosh of its water, the water level, Aya, her pour, the
 * lamp gliding, the bottle turning, the keeping turn); it stops while the tab
 * is hidden and is not started at all with motion reduced, where every change
 * is a cut to its end state. Play never waits on an animation: the keeping
 * turn ends on a timer. */
import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { selectionHaptic } from '../../../../../../lib/native';
import type { BottleAudio } from './bottleAudio';
import { AyaArt, Backdrop, BottleDefs, Cap, GlassFront, GlassInside, GlassLight, Lamp, LampLight, SlotRings, StickerLayer, TableShadow, capHinge, ids, slotPlace } from './BottleArt';
import { AXIS_X, BASE_Y, ELLIPSE, PROFILES, SCENE_H, SCENE_W, baseRadius, bottomY, maxRadius, radiusAt, topY, type ShapeId } from './bottleGeometry';
import { BENCH_Y, KIT_CAN } from './bottleKit';
import type { BOTTLE_LAB_COPY } from './bottleLabCopy';
import {
  LAMP_MAX, LAMP_MIN, LAMP_STEP, MAX_BUBBLES, TURN_STEP, bestViewRotation, burstCount, clampLamp, dragTurn, lampAngleAt, lampPosition, reachableSlots, riseBubble,
  slotTaken, snapRotation, spawnBubble, type Bubble, type BottleCreation, type BottleSticker, type BottleStickerPlacement,
} from './bottleLabRules';
import { refractionMap } from './bottleRefraction';
import {
  AYA, KEEP_GLINTS, KEEP_MS, KEEP_REDUCED_MS, POUR_MS, WATER_HOME, WATER_LEVELS, ayaAfterLamp, ayaSide, ayaX, hootNote, keepPose, knock, nextHint, nextLevel, pourPose,
  ringNote, scaleNote, stepAya, stepSway, stillSway, swayStill, tiltFor, waterLine, waterRadius, waterY, windowNote, type HintId,
} from './bottleToys';

type Copy = typeof BOTTLE_LAB_COPY[keyof typeof BOTTLE_LAB_COPY];
export interface StageHandle {
  turnBy(delta: number): void;
  /** The free ring under a point of the screen, for a sticker being carried. */
  hotSlot(clientX: number, clientY: number): number | null;
  /** A reward beat: Aya hops, the bottle pops. */
  cheer(strong?: boolean): void;
  /** ViewCheck: the view from Aya's eye level, close on the water (and back). Returns the new state. */
  viewCheck(): boolean;
  /** The keeping turn; `done` is called when it is over. */
  keep(done: () => void): void;
}
export interface StageProps {
  uid: string; w: Copy; bottle: BottleCreation; live: boolean; audio: RefObject<BottleAudio | null>;
  picked: BottleSticker | null; hot: number | null; aiming: boolean; fresh: number | null; ghost: BottleStickerPlacement | null;
  start: { lamp: number; rotation: number };
  onPlace(slot: number): void; onPeel(slot: number): void;
  /** The child did something in the scene (`ring`, `turn`, or anything else). */
  onPlay(what: 'ring' | 'turn' | 'behind' | 'home' | 'lampOn' | 'lampOff' | 'touch'): void;
}

const pct = (n: number, of: number) => `${(n / of * 100).toFixed(3)}%`;
const fillIn = (template: string, ...values: string[]) => template.replace(/\{(\d)\}/g, (_m, i: string) => values[Number(i)] ?? '');
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** What the child has already done this visit: a hint goes for good, replay included. */
const LEARNED: Record<HintId, boolean> = { ring: false, turn: false };
/** Where the neck ends and the body (the part that turns under a finger) begins. */
const neckEnd = (shape: ShapeId) => PROFILES[shape].rows[0] - PROFILES[shape].sticker / 2 - 8;
const CAN = { width: 58, height: 58 * KIT_CAN.height / KIT_CAN.width };

interface Gesture { kind: 'bottle' | 'lamp' | 'neck' | 'theRoom'; id: number; x: number; y: number; start: number; moved: boolean; grip: number; at: number; onSlot: boolean }

export const BottleStage = memo(forwardRef<StageHandle, StageProps>(function BottleStage({ uid, w, bottle, live, audio, picked, hot, aiming, fresh, ghost, start, onPlace, onPeel, onPlay }, ref) {
  const shape = bottle.shape, frost = bottle.finish === 'frost';
  const [rotation, setRotationState] = useState(start.rotation);
  const [lamp, setLampState] = useState(start.lamp);
  const [lampOn, setLampOn] = useState(true);
  const [level, setLevelState] = useState(WATER_HOME);
  const [capOpen, setCapOpen] = useState(false);
  const [home, setHome] = useState<'left' | 'right'>(ayaSide(start.lamp));
  const [mood, setMood] = useState<'idle' | 'happy'>('idle');
  const [away, setAway] = useState(false);
  const [walk, setWalk] = useState(0);
  const [low, setLow] = useState(false);
  const [hint, setHint] = useState<HintId | null>(null);
  const [pokes, setPokes] = useState<{ id: number; x: number; y: number; glass: boolean }[]>([]);
  const [glints, setGlints] = useState(0);
  const [sweep, setSweep] = useState(0);
  const [reduced, setReduced] = useState(reducedMotion);
  const [stillSeed, setStillSeed] = useState(0);

  const stage = useRef<HTMLDivElement>(null), glassEl = useRef<HTMLDivElement>(null), capSeat = useRef<HTMLDivElement>(null);
  const seaEl = useRef<HTMLDivElement>(null), seaIn = useRef<HTMLDivElement>(null), topEl = useRef<SVGGElement>(null);
  const ayaRoom = useRef<SVGGElement>(null), ayaWet = useRef<SVGGElement>(null), canEl = useRef<SVGGElement>(null), streamEl = useRef<SVGPathElement>(null);
  const bubbleEls = useRef<(SVGCircleElement | null)[]>([]), popEls = useRef<(SVGCircleElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gesture = useRef<Gesture | null>(null), dragged = useRef(false), lastInput = useRef(0), pokeId = useRef(0), holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live$ = useRef(live); live$.current = live;
  const reduced$ = useRef(reduced); reduced$.current = reduced;
  const bottle$ = useRef(bottle); bottle$.current = bottle;
  const play$ = useRef(onPlay); play$.current = onPlay;
  const sim = useRef({
    t: 0, sway: stillSway(), hold: null as number | null, levelY: waterY(shape, WATER_HOME), level: WATER_HOME, dip: 0, pop: 9,
    bubbles: [] as Bubble[], pops: [] as { x: number; y: number; age: number }[], trickle: 0.4, burst: 0, id: 0, stream: false, blip: 0,
    rot: start.rotation, rotTo: start.rotation, lamp: start.lamp, lampTo: start.lamp, lampOn: true, capOpen: false,
    aya: { x: ayaX(ayaSide(start.lamp)), y: AYA.feet as number, lift: 0, home: ayaSide(start.lamp) as 'left' | 'right', to: ayaX(ayaSide(start.lamp)), stay: 0, wander: 9, hop: 0 },
    pour: null as null | { t0: number; to: number; poured: boolean; side: number },
    keep: null as null | { t0: number; from: number; to: number; lamp: number; glint: number },
    shown: {} as Record<string, string>,
  });
  const later = (ms: number, run: () => void) => { const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms); timers.current.push(id); return id; };
  /** Sends Aya somewhere: she turns side-on and hops there. */
  const sendAya = (to: number) => { const a = sim.current.aya; if (a.to === to) return; a.to = to; setWalk(to > a.x ? 1 : to < a.x ? -1 : 0); };
  const sound = (name: Parameters<BottleAudio['play']>[0], freq?: number, strength?: number) => audio.current?.play(name, freq, strength);

  // ── Writing the moving parts straight into the picture ─────────────────
  const put = (el: Element | null, key: string, name: 'transform' | 'd', value: string) => { const s = sim.current; if (!el || s.shown[key] === value) return; s.shown[key] = value; el.setAttribute(name, value); };
  const css = (el: HTMLElement | SVGElement | null, key: string, value: string) => { const s = sim.current; if (!el || s.shown[key] === value) return; s.shown[key] = value; el.style.transform = value; };
  const paint = () => {
    const s = sim.current, form = bottle$.current.shape;
    const tilt = s.sway.tilt, line = waterLine(s.sway), lift = Math.abs(Math.sin(tilt * Math.PI / 180)) * baseRadius(form);
    // A change of shape, glass or sticker pops the bottle: a squash that springs back.
    const pop = s.pop < 0.5 ? Math.sin(s.pop * 26) * Math.exp(-s.pop * 9) * 0.05 : 0;
    const lean = `translateY(${((s.dip * 5 - lift) / SCENE_H * 100).toFixed(3)}%) rotate(${tilt.toFixed(2)}deg) scale(${(1 + pop).toFixed(4)}, ${(1 - pop).toFixed(4)})`;
    css(glassEl.current, 'glass', lean); css(capSeat.current, 'cap', lean);
    const y = s.levelY;
    css(seaEl.current, 'sea', `translateY(${(y / SCENE_H * 50).toFixed(3)}%) rotate(${line.toFixed(2)}deg)`);
    css(seaIn.current, 'seaIn', `rotate(${(-line).toFixed(2)}deg) translateY(${(-y / SCENE_H * 100).toFixed(3)}%)`);
    put(topEl.current, 'top', 'transform', `translate(${AXIS_X} ${y.toFixed(2)}) rotate(${line.toFixed(2)}) scale(${(waterRadius(form, y) / 50 / Math.cos(line * Math.PI / 180) * 1.04).toFixed(3)} ${(waterRadius(form, y) / 50).toFixed(3)})`);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      const el = bubbleEls.current[i], b = s.bubbles[i];
      if (!el) continue;
      if (!b) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      if (el.style.display) el.style.display = '';
      el.setAttribute('cx', b.x.toFixed(2)); el.setAttribute('cy', b.y.toFixed(2)); el.setAttribute('r', b.r.toFixed(2));
    }
    for (let i = 0; i < popEls.current.length; i++) {
      const el = popEls.current[i], p = s.pops[i];
      if (!el) continue;
      if (!p) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
      if (el.style.display) el.style.display = '';
      el.setAttribute('cx', p.x.toFixed(1)); el.setAttribute('cy', p.y.toFixed(1)); el.setAttribute('r', (2 + p.age * 16).toFixed(2)); el.style.opacity = Math.max(0, 0.9 - p.age * 2.6).toFixed(2);
    }
    // Aya: in the room, and again behind the water, where the lens shows her.
    const a = s.aya, breath = 1 + Math.sin(s.t * 2.1) * 0.012, squash = a.hop > 0 ? 1 + Math.sin(a.hop * Math.PI) * 0.1 : breath;
    const stand = `translate(${a.x.toFixed(1)} ${(a.y - a.lift - (a.hop > 0 ? Math.sin(a.hop * Math.PI) * 12 : 0)).toFixed(1)}) scale(${(2 - squash).toFixed(3)} ${squash.toFixed(3)})`;
    put(ayaRoom.current, 'aya', 'transform', stand);
    const near = Math.abs(a.x - AXIS_X) < maxRadius(form) * 1.3 + 34;
    put(ayaWet.current, 'ayaWet', 'transform', near ? stand : 'translate(-900 0)');
    // Her watering can, only while she pours.
    const pour = s.pour, can = canEl.current, stream = streamEl.current;
    if (can && stream) {
      const pose = pour ? pourPose((s.t - pour.t0) * 1000 / POUR_MS) : null;
      if (!pose || !pose.shown || !pour) { if (can.style.display !== 'none') { can.style.display = 'none'; stream.style.display = 'none'; } }
      else {
        const side = pour.side, top = topY(form);
        const from = { x: a.x - side * 26, y: a.y - 44 }, to = { x: AXIS_X + side * 30, y: top - 16 };
        const cx = from.x + (to.x - from.x) * pose.reach, cy = from.y + (to.y - from.y) * pose.reach - Math.sin(pose.reach * Math.PI) * 26;
        can.style.display = '';
        can.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${-side} 1) rotate(${(pose.tip * 38).toFixed(1)})`);
        stream.style.display = pose.flow && pour.to > 0 ? '' : 'none';
        if (pose.flow) stream.setAttribute('d', `M${(cx - side * 29).toFixed(1)} ${(cy + 4).toFixed(1)}Q${AXIS_X + side * 2} ${(cy + 10).toFixed(1)} ${AXIS_X} ${(top + 6).toFixed(1)}L${AXIS_X} ${y.toFixed(1)}`);
      }
    }
  };

  const setRotation = (value: number) => {
    const s = sim.current;
    if (Math.round(s.rot / TURN_STEP) !== Math.round(value / TURN_STEP) && live$.current && !s.keep) sound('tick', scaleNote(6 + ((Math.round(value / TURN_STEP) % 4) + 4) % 4), 0.7);
    s.rot = value; setRotationState(value);
  };
  /** Aya makes room: when the lamp comes over to her side she crosses behind the bottle. */
  const setLamp = (value: number) => {
    const s = sim.current, next = clampLamp(value);
    if (Math.round(s.lamp / 15) !== Math.round(next / 15) && !s.keep) sound('tick', scaleNote(5 + Math.round(next / 15) + 4), 0.6);
    s.lamp = next; setLampState(next);
    const side = ayaAfterLamp(s.aya.home, next);
    if (side !== s.aya.home) { s.aya.home = side; sendAya(ayaX(side)); s.aya.stay = 0; setHome(side); setAway(false); sound('hop', scaleNote(4)); if (reduced$.current) settle(); }
  };
  /** Motion reduced: every moving part cuts to where it was going. */
  const settle = () => {
    const s = sim.current;
    s.sway = stillSway(); s.hold = null; s.levelY = waterY(bottle$.current.shape, s.level); s.dip = 0; s.pop = 9;
    s.aya.x = s.aya.to; s.aya.y = stepAya(s.aya.to, s.aya.to, 0).y; s.aya.lift = 0; s.aya.hop = 0; s.pour = null; setWalk(0);
    if (s.rot !== s.rotTo) setRotation(s.rotTo);
    if (s.lamp !== s.lampTo) setLamp(s.lampTo);
    paint();
  };

  // ── The one frame loop ─────────────────────────────────────────────────
  useEffect(() => {
    const s = sim.current; s.bubbles = []; s.pops = []; s.burst = 0; s.shown = {};
    s.levelY = waterY(shape, s.level);
    if (reduced) { settle(); return; }
    paint();
    let frame = 0, last = 0, running = true;
    const tick = (now: number) => {
      if (!running) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; s.t += dt; s.pop += dt;
      // the bottle's lean and the water
      if (!swayStill(s.sway) || s.hold !== null) s.sway = stepSway(s.sway, s.hold, dt);
      const goal = waterY(shape, s.level);
      s.levelY = Math.abs(goal - s.levelY) < 0.05 ? goal : s.levelY + (goal - s.levelY) * Math.min(1, dt * 5);
      const slope = Math.tan(waterLine(s.sway) * Math.PI / 180);
      // bubbles: a quiet trickle, a burst on a tap, a stream while a finger holds the glass
      if (s.bubbles.length < 7 && s.t > s.trickle) { s.bubbles.push(spawnBubble(shape, s.id++, Math.random, AXIS_X, false, s.levelY)); s.trickle = s.t + 0.55 + Math.random() * 0.9; }
      while (s.burst > 0 && s.bubbles.length < MAX_BUBBLES) { s.bubbles.push(spawnBubble(shape, s.id++, Math.random, AXIS_X, true, s.levelY)); s.burst--; }
      s.burst = 0;
      if (s.stream && s.bubbles.length < MAX_BUBBLES && s.t > s.blip) { s.bubbles.push(spawnBubble(shape, s.id++, Math.random, AXIS_X, false, s.levelY)); s.blip = s.t + 0.075; if (s.id % 2 === 0) sound('blip', scaleNote(8 + s.id % 5), 0.8); }
      if (Math.abs(s.sway.sloshV) > 46 && s.bubbles.length < 14 && Math.random() < 0.3) s.bubbles.push(spawnBubble(shape, s.id++, Math.random, AXIS_X, true, s.levelY));
      const next: Bubble[] = [];
      for (const b of s.bubbles) { const moved = riseBubble(shape, b, s.t, dt, AXIS_X, s.levelY + slope * (b.x - AXIS_X)); if (moved) next.push(moved); else if (s.pops.length < 6) s.pops.push({ x: b.x, y: b.y - b.r, age: 0 }); }
      s.bubbles = next;
      s.pops = s.pops.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < 0.35);
      // the bottle turning and the lamp gliding to where they were sent
      if (s.keep) {
        const k = s.keep, p = Math.min(1, (s.t - k.t0) * 1000 / KEEP_MS), pose = keepPose(p, k.from, k.to, k.lamp);
        s.dip = pose.dip; setRotation(pose.rotation); setLamp(Math.round(pose.lamp * 2) / 2);
        while (k.glint < KEEP_GLINTS.length && p >= KEEP_GLINTS[k.glint]) {
          const i = k.glint++; setGlints(i + 1); void selectionHaptic();
          sound('ring', scaleNote([5, 7, 8, 10, 12][i]), 0.75);
          if (i === KEEP_GLINTS.length - 1) { sound('chime', scaleNote(5), 0.9); sound('chime', scaleNote(8), 0.8); s.aya.hop = 0.001; setMood('happy'); }
        }
      } else {
        if (s.rot !== s.rotTo && gesture.current?.kind !== 'bottle') { const gap = s.rotTo - s.rot; setRotation(Math.abs(gap) < 0.3 ? s.rotTo : s.rot + gap * Math.min(1, dt * 9)); }
        if (s.lamp !== s.lampTo && gesture.current?.kind !== 'lamp') { const gap = s.lampTo - s.lamp; setLamp(Math.abs(gap) < 0.4 ? s.lampTo : s.lamp + gap * Math.min(1, dt * 6)); }
      }
      // Aya: home, behind the bottle for a look, or crossing out of the lamp's way
      const a = s.aya;
      if (a.hop > 0) { a.hop += dt * 2.6; if (a.hop >= 1) a.hop = 0; }
      if (a.x !== a.to) { const step = stepAya(a.x, a.to, dt); a.x = step.x; a.y = step.y; a.lift = step.lift; if (!step.moving) { a.lift = 0; setWalk(0); if (a.to === AXIS_X) { a.stay = s.t + 2.4; play$.current('behind'); } else { setMood('idle'); setAway(false); play$.current('home'); } } }
      else if (a.to === AXIS_X && s.t > a.stay) { sendAya(ayaX(a.home)); sound('hop', scaleNote(4), 0.7); }
      else if (a.to !== AXIS_X && !s.pour && !s.keep && live$.current && s.t > a.wander) { a.wander = s.t + 13 + Math.random() * 8; sendAya(AXIS_X); setAway(true); setMood('happy'); }
      // her pour
      if (s.pour) {
        const p = (s.t - s.pour.t0) * 1000 / POUR_MS;
        if (!s.pour.poured && p > 0.36) { s.pour.poured = true; const to = s.pour.to; s.level = to; setLevelState(to); if (to === 0) sound('drain', scaleNote(6)); else sound('pour', scaleNote(3 + to)); s.sway = knock(s.sway, s.pour.side * 0.3, 0.5); s.burst = 5; }
        if (p >= 1) { s.pour = null; setMood('idle'); }
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    const begin = () => { if (!running) return; cancelAnimationFrame(frame); last = 0; frame = requestAnimationFrame(tick); };
    const onVisible = () => { if (document.visibilityState === 'hidden') { cancelAnimationFrame(frame); sim.current.stream = false; sim.current.hold = null; audio.current?.stop(); } else begin(); };
    document.addEventListener('visibilitychange', onVisible);
    begin();
    return () => { running = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, reduced]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMedia = () => setReduced(!!media?.matches);
    media?.addEventListener?.('change', onMedia);
    lastInput.current = performance.now();
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; if (holdTimer.current) clearTimeout(holdTimer.current); media?.removeEventListener?.('change', onMedia); };
  }, []);
  // A new shape, glass or finish: the bottle pops and a shine crosses it.
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } sim.current.pop = 0; setSweep(n => n + 1); }, [bottle.shape, bottle.tint, bottle.finish]);
  useEffect(() => { if (fresh !== null) sim.current.pop = 0.12; }, [fresh]);
  // A sticker in hand: the bottle settles square on, so its rings face the child.
  useEffect(() => { if (aiming) turnTo(snapRotation(sim.current.rotTo)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [aiming]);

  // ── The ghost hand: shows the first gesture, again after six idle seconds ─
  const stickers = bottle.stickers.length;
  useEffect(() => {
    if (!live) { setHint(null); return; }
    let shownAt = 0;
    const demo = (which: HintId) => {
      setHint(which); shownAt = performance.now();
      if (which === 'ring') later(reduced$.current ? 300 : 900, () => { if (performance.now() - lastInput.current > 800 && live$.current) ring(0, null, true); });
      else { const from = snapRotation(sim.current.rotTo); later(700, () => { if (performance.now() - lastInput.current > 600 && live$.current) turnTo(from + 90); }); later(1700, () => { if (performance.now() - lastInput.current > 1600 && live$.current) turnTo(from); }); }
      later(2300, () => setHint(null));
    };
    const first$ = setTimeout(() => { const which = nextHint(LEARNED, bottle$.current.stickers.length); if (which && performance.now() - lastInput.current > 900) demo(which); }, 1100);
    const watch = setInterval(() => {
      const which = nextHint(LEARNED, bottle$.current.stickers.length), now = performance.now();
      if (which && live$.current && document.visibilityState !== 'hidden' && now - lastInput.current > 6000 && now - shownAt > 6000 && !gesture.current) demo(which);
    }, 1000);
    return () => { clearTimeout(first$); clearInterval(watch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, stickers > 0]);

  // ── What the toys do ───────────────────────────────────────────────────
  const touched = (what: Parameters<StageProps['onPlay']>[0] = 'touch') => { lastInput.current = performance.now(); if (hint) setHint(null); onPlay(what); };
  const turnTo = (target: number) => { sim.current.rotTo = target; if (reduced$.current) settle(); };
  const turnBy = (delta: number) => { void selectionHaptic(); LEARNED.turn = true; touched('turn'); turnTo(snapRotation(sim.current.rotTo) + delta); };
  const poke = (x: number, y: number, glass: boolean) => {
    const id = ++pokeId.current;
    setPokes(list => [...list.slice(-2), { id, x, y, glass }]);
    later(520, () => setPokes(list => list.filter(p => p.id !== id)));
  };
  /** A tap on the glass: it rings (lower the fuller it is), rocks away from the finger, and lets bubbles go. */
  const ring = (side: number, at: { x: number; y: number } | null, quiet = false) => {
    const s = sim.current;
    if (!quiet) { void selectionHaptic(); sound('ring', ringNote(bottle$.current.shape, s.level)); LEARNED.ring = true; touched('ring'); }
    poke(at?.x ?? AXIS_X, at?.y ?? PROFILES[bottle$.current.shape].rows[1], true);
    if (s.aya.to === AXIS_X) { sendAya(ayaX(s.aya.home)); s.aya.hop = 0.001; if (!quiet) sound('hop', scaleNote(6)); }
    if (reduced$.current) { setStillSeed(n => n + 1); settle(); return; }
    s.sway = knock(s.sway, side || (Math.random() < 0.5 ? -1 : 1), quiet ? 0.6 : 1);
    const count = burstCount(s.bubbles.length); s.burst = count;
    if (count && !quiet) later(90, () => sound('fizz', scaleNote(9), 0.4 + count / 24));
  };
  const switchLamp = () => { const on = !sim.current.lampOn; sim.current.lampOn = on; setLampOn(on); void selectionHaptic(); sound('flip', scaleNote(on ? 8 : 5)); touched(on ? 'lampOn' : 'lampOff'); };
  const flipCap = (open: boolean) => { if (sim.current.capOpen === open) return; sim.current.capOpen = open; setCapOpen(open); sound('flip', scaleNote(open ? 7 : 4)); };
  const hoot = () => { void selectionHaptic(); sound('hoot', hootNote(bottle$.current.shape, sim.current.level)); poke(AXIS_X, topY(bottle$.current.shape) - 8, false); touched(); };
  const cheer = (strong = false) => { const s = sim.current; s.aya.hop = 0.001; setMood('happy'); later(strong ? 1400 : 800, () => { if (!sim.current.pour && sim.current.aya.to !== AXIS_X) setMood('idle'); }); if (strong) sound('hop', scaleNote(7), 0.8); };
  /** Aya: away from home she comes back; at home she pours a step of water (a full bottle she tips back out). */
  const askAya = () => {
    const s = sim.current; void selectionHaptic(); touched();
    if (s.pour) return;
    if (s.aya.to === AXIS_X || s.aya.x !== s.aya.to) { sendAya(ayaX(s.aya.home)); s.aya.hop = 0.001; sound('hop', scaleNote(6)); if (reduced$.current) settle(); return; }
    const to = nextLevel(s.level); flipCap(true); setMood('happy'); s.aya.hop = 0.001;
    if (reduced$.current) { s.level = to; setLevelState(to); sound(to === 0 ? 'drain' : 'pour', scaleNote(to === 0 ? 6 : 3 + to)); later(700, () => setMood('idle')); settle(); return; }
    s.pour = { t0: s.t, to, poured: false, side: s.aya.home === 'right' ? 1 : -1 };
  };

  useImperativeHandle(ref, () => ({
    turnBy,
    hotSlot,
    cheer,
    viewCheck() { const next = !low; setLow(next); lastInput.current = performance.now(); setHint(null); sound('flip', scaleNote(next ? 9 : 6)); return next; },
    keep(done) {
      const s = sim.current, b = bottle$.current;
      setHint(null); flipCap(false); s.level = WATER_HOME; setLevelState(WATER_HOME); s.pour = null; s.hold = null; s.stream = false;
      if (!s.lampOn) { s.lampOn = true; setLampOn(true); }
      sendAya(ayaX(s.aya.home)); s.aya.wander = 9e9; setLow(false);
      const to = bestViewRotation(b.stickers);
      if (reduced$.current) { s.rotTo = to; s.lampTo = start.lamp <= 0 ? start.lamp : -start.lamp; s.aya.home = ayaSide(s.lampTo); s.aya.to = ayaX(s.aya.home); setHome(s.aya.home); setMood('happy'); setGlints(KEEP_GLINTS.length); sound('ring', scaleNote(8)); sound('chime', scaleNote(5)); settle(); later(KEEP_REDUCED_MS, done); return; }
      s.keep = { t0: s.t, from: s.rot, to, lamp: s.lamp, glint: 0 };
      // The finish is a timer, not the animation's end: it comes even if frames stop.
      later(KEEP_MS + 60, done);
    },
  }));

  // ── Pointer: turn or ring the bottle, lean it by the neck, slide the lamp ─
  const toScene = (clientX: number, clientY: number) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    return { x: (clientX - rect.left) / rect.width * SCENE_W, y: (clientY - rect.top) / rect.height * SCENE_H, inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom };
  };
  const reach = useMemo(() => reachableSlots(snapRotation(rotation)).filter(() => Math.abs(rotation - snapRotation(rotation)) < 8), [rotation]);
  const freeReach = reach.filter(slot => !slotTaken(bottle.stickers, slot));
  function hotSlot(clientX: number, clientY: number) {
    const p = toScene(clientX, clientY);
    if (!p?.inside) return null;
    let best: number | null = null, dist = 42;
    for (const slot of freeReach) { const q = slotPlace(shape, slot, sim.current.rot), d = Math.hypot(q.cx - p.x, q.cy - p.y); if (d < dist) { best = slot; dist = d; } }
    return best;
  }
  const endHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live || e.button > 0 || gesture.current) return;
    const target = e.target as Element, p = toScene(e.clientX, e.clientY);
    if (!p) return;
    const kind: Gesture['kind'] | null = target.closest('[data-bl-lamp]') ? 'lamp' : target.closest('[data-bl-cap],[data-bl-mouth]') ? 'neck'
      : target.closest('[data-bl-bottle],[data-bl-slot]') ? 'bottle' : target.closest('button') ? null : 'theRoom';
    lastInput.current = performance.now(); if (hint) setHint(null);
    if (!kind) return;
    dragged.current = false;
    gesture.current = { kind, id: e.pointerId, x: e.clientX, y: e.clientY, start: kind === 'lamp' ? lampPosition(sim.current.lamp).x - p.x : sim.current.rot, moved: false, grip: BASE_Y - p.y, at: performance.now(), onSlot: !!target.closest('[data-bl-slot]') };
    if (kind === 'bottle' && !gesture.current.onSlot && !reduced$.current) {
      // A finger resting on the glass: bubbles stream for as long as it stays.
      endHold(); holdTimer.current = setTimeout(() => { const g = gesture.current; if (g?.kind === 'bottle' && !g.moved) { sim.current.stream = true; void selectionHaptic(); sound('fizz', scaleNote(9), 0.5); } }, 330);
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.kind === 'theRoom') return;
    const dx = e.clientX - g.x, rect = stage.current?.getBoundingClientRect(), scale = rect ? rect.width / SCENE_W : 1;
    if (!g.moved && Math.abs(dx) > 7 && (g.kind !== 'bottle' || Math.abs(dx) > Math.abs(e.clientY - g.y))) {
      g.moved = true; dragged.current = true; endHold(); sim.current.stream = false;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      if (g.kind === 'bottle') { LEARNED.turn = true; touched('turn'); }
    }
    if (!g.moved) return;
    const s = sim.current;
    if (g.kind === 'lamp') { const p = toScene(e.clientX, e.clientY); if (p) { const angle = Math.round(lampAngleAt(p.x + g.start)); s.lampTo = angle; setLamp(angle); if (reduced$.current) paint(); } }
    else if (g.kind === 'neck') { s.hold = tiltFor(dx / scale, g.grip); if (reduced$.current) { s.sway = { ...stillSway(), tilt: s.hold }; paint(); } }
    else { const value = g.start + dragTurn(dx, maxRadius(shape) * 2 * scale); s.rotTo = value; setRotation(value); }
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null; endHold();
    const s = sim.current, streamed = s.stream; s.stream = false;
    const p = toScene(e.clientX, e.clientY);
    if (g.kind === 'lamp') { if (!g.moved) switchLamp(); else { touched(); sound('tick', scaleNote(7), 0.6); } return; }
    if (g.kind === 'neck') { if (g.moved) { s.hold = null; touched(); if (reduced$.current) settle(); } return; }
    if (g.kind === 'bottle') {
      if (g.moved) { turnTo(snapRotation(s.rot)); return; }
      if (!g.onSlot && !streamed && p) ring(p.x < AXIS_X ? 1 : -1, p);
      else if (streamed) touched();
      return;
    }
    if (!p || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) return;
    void selectionHaptic(); touched(); poke(p.x, p.y, false);
    // The floor: the lamp glides to the spot. The wall: each window pings its own note.
    if (p.y > BENCH_Y) { s.lampTo = Math.round(lampAngleAt(p.x)); sound('tick', scaleNote(6)); if (reduced$.current) settle(); }
    else sound('chime', windowNote(p.x));
  };
  const onCancel = () => { const g = gesture.current; gesture.current = null; endHold(); const s = sim.current; s.stream = false; s.hold = null; if (g?.kind === 'bottle') turnTo(snapRotation(s.rot)); };

  // ── Keyboard ───────────────────────────────────────────────────────────
  const onBottleKey = (e: ReactKeyboardEvent) => {
    if (!live) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); turnBy(-TURN_STEP); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); turnBy(TURN_STEP); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); touched(); if (!reduced$.current) sim.current.sway = knock(sim.current.sway, e.key === 'ArrowUp' ? 1 : -1, 1.6); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ring(0, null); }
  };
  const moveLamp = (to: number) => { void selectionHaptic(); touched(); sim.current.lampTo = clampLamp(to); if (reduced$.current) settle(); };
  const onLampKey = (e: ReactKeyboardEvent) => {
    if (!live) return;
    const at = sim.current.lampTo;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); moveLamp(at - LAMP_STEP); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); moveLamp(at + LAMP_STEP); }
    else if (e.key === 'Home') { e.preventDefault(); moveLamp(LAMP_MIN); }
    else if (e.key === 'End') { e.preventDefault(); moveLamp(LAMP_MAX); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); switchLamp(); }
  };
  const tap = (run: () => void) => () => { if (dragged.current) { dragged.current = false; return; } if (live) run(); };

  // ── The picture ────────────────────────────────────────────────────────
  const maps = useMemo(() => ({ still: refractionMap(shape, frost), air: refractionMap(shape, frost, 'air'), wet: refractionMap(shape, frost, 'wet') }), [shape, frost]);
  const top = topY(shape), half = maxRadius(shape), neck = neckEnd(shape), lampAt = lampPosition(lamp), hinge = capHinge(shape), u = ids(uid);
  const lampBehind = Math.abs(lampAt.x - AXIS_X) < half * 1.3 + 60;
  const lampText = !lampOn ? w.lampOff : lamp < -12 ? w.lampAt.left : lamp > 12 ? w.lampAt.right : w.lampAt.above;
  const rowName = (slot: number) => w.rows[Math.floor(slot / 4)];
  const glintAt = [[-0.5, PROFILES[shape].rows[0] - 6], [0.56, PROFILES[shape].rows[1] - 10], [-0.3, PROFILES[shape].rows[2]], [0.3, PROFILES[shape].rows[0] - 30], [0, PROFILES[shape].rows[1]]] as const;
  const view = `0 0 ${SCENE_W} ${SCENE_H}`;
  return <div ref={stage} className="bl-stage" dir="ltr" data-bl-stage="" data-shape={shape} data-tint={bottle.tint} data-finish={bottle.finish} data-lamp={lampOn ? 'on' : 'off'} data-cap={capOpen ? 'open' : 'shut'} data-water={level} data-aya={away ? 'behind' : home} data-mood={mood} data-view={low ? 'low' : 'whole'}
    onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onCancel}>
    <RoomLayer uid={uid} shape={shape} finish={bottle.finish} maps={maps} />
    <svg className="bl-layer" viewBox={view} aria-hidden="true" focusable="false">
      <LampLight uid={uid} angle={lamp} on={lampOn} />
      <TableShadow uid={uid} shape={shape} angle={lamp} on={lampOn} stickers={bottle.stickers} rotation={rotation} />
      <Lamp uid={uid} angle={lamp} on={lampOn} />
      <g ref={ayaRoom}><AyaArt uid={uid} pose={walk ? 'side' : 'front'} flip={walk < 0} x={0} y={0} /></g>
    </svg>
    <div ref={glassEl} className="bl-glass">
      <AirLayer uid={uid} shape={shape} finish={bottle.finish} />
      {/* The water: everything below a line that leans and rises. Two boxes turn against each other, so only the edge moves. */}
      <div ref={seaEl} className="bl-sea"><div ref={seaIn} className="bl-sea__in">
        <WetLayer uid={uid} shape={shape} finish={bottle.finish} lamp={lampBehind ? lamp : null} lampOn={lampOn} walk={walk} aya={ayaWet} />
      </div></div>
      <svg className="bl-layer" viewBox={view} aria-hidden="true" focusable="false">
        <g clipPath={u.url('inner')}>
          <g ref={topEl}>
            <ellipse rx="50" ry={50 * ELLIPSE} style={{ fill: 'color-mix(in srgb, var(--bl-light) 50%, var(--mk-white))', opacity: 0.3 }} />
            <path d={`M-50 0A50 ${50 * ELLIPSE} 0 0 1 50 0`} style={{ fill: 'none', stroke: 'var(--bl-deep)', strokeOpacity: 0.35, strokeWidth: 1.4 }} />
            <path d={`M-50 0A50 ${50 * ELLIPSE} 0 0 0 50 0`} style={{ fill: 'none', stroke: 'var(--mk-white)', strokeOpacity: 0.95, strokeWidth: 2 }} />
            <path d={`M-49 2.2A49 ${50 * ELLIPSE} 0 0 0 49 2.2`} style={{ fill: 'none', stroke: 'var(--bl-deep)', strokeOpacity: 0.22, strokeWidth: 2.4 }} />
          </g>
          {Array.from({ length: MAX_BUBBLES }, (_, i) => <circle key={i} ref={el => { bubbleEls.current[i] = el; }} r="0" style={{ fill: u.url('bubble'), display: 'none' }} />)}
          {Array.from({ length: 6 }, (_, i) => <circle key={`p${i}`} ref={el => { popEls.current[i] = el; }} r="0" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 1.1, display: 'none' }} />)}
          {reduced && <StillBubbleSet shape={shape} seed={stillSeed} uid={uid} level={waterY(shape, level)} />}
        </g>
      </svg>
      <svg className="bl-layer" viewBox={view} aria-hidden="true" focusable="false" data-rotation={Math.round(rotation)}>
        <StickerLayer uid={uid} shape={shape} stickers={bottle.stickers} rotation={rotation} side="back" />
        <GlassFront uid={uid} shape={shape} finish={bottle.finish} />
        <StickerLayer uid={uid} shape={shape} stickers={bottle.stickers} rotation={rotation} side="front" fresh={fresh} ghost={ghost} />
        <GlassLight uid={uid} shape={shape} finish={bottle.finish} angle={lamp} on={lampOn} />
        {sweep > 0 && <g clipPath={u.url('outer')}><rect key={sweep} className="bl-sweep" x={AXIS_X - half - 60} y={top} width="34" height={bottomY(shape) - top} style={{ fill: 'var(--mk-white)' }} /></g>}
        {aiming && <SlotRings uid={uid} shape={shape} slots={freeReach} rotation={rotation} hot={hot} />}
      </svg>
    </div>
    <div ref={capSeat} className="bl-glass"><svg className="bl-layer bl-cap" viewBox={view} aria-hidden="true" focusable="false" style={{ transformOrigin: `${pct(hinge.x, SCENE_W)} ${pct(hinge.y, SCENE_H)}` }}>
      <Cap uid={uid} shape={shape} rotation={rotation} angle={lamp} on={lampOn} />
    </svg></div>
    <svg className="bl-layer" viewBox={view} aria-hidden="true" focusable="false">
      <path ref={streamEl} style={{ fill: 'none', stroke: 'color-mix(in srgb, var(--mk-sky) 60%, var(--mk-white))', strokeOpacity: 0.85, strokeWidth: 3, strokeLinecap: 'round', display: 'none' }} />
      <g ref={canEl} style={{ display: 'none' }}><image href={KIT_CAN.src} x={-CAN.width / 2} y={-CAN.height / 2} width={CAN.width} height={CAN.height} preserveAspectRatio="none" /></g>
      {glintAt.slice(0, glints).map(([gu, gy], i) => <g key={i} transform={`translate(${(AXIS_X + gu * radiusAt(shape, gy)).toFixed(1)} ${gy})`}><path className="bl-glint" data-last={i === KEEP_GLINTS.length - 1} d="M0 -16C1.6 -5 5 -1.6 16 0C5 1.6 1.6 5 0 16C-1.6 5 -5 1.6 -16 0C-5 -1.6 -1.6 -5 0 -16Z" style={{ fill: 'var(--mk-white)' }} /></g>)}
    </svg>

    {/* Touch and keyboard targets over the picture. */}
    <div className="bl-lamp" data-bl-lamp="" role="slider" tabIndex={live ? 0 : -1} aria-label={w.lamp} aria-valuemin={LAMP_MIN} aria-valuemax={LAMP_MAX} aria-valuenow={Math.round(lamp)} aria-valuetext={lampText}
      onKeyDown={onLampKey} style={{ left: pct(lampAt.x + lampAt.face * 8, SCENE_W), top: pct(lampAt.y - 48, SCENE_H) }} />
    <div className="bl-hit" data-bl-bottle="" role="slider" tabIndex={live ? 0 : -1} aria-label={w.bottle} aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(((rotation % 360) + 540) % 360 - 180)} aria-valuetext={`${w.bottle} ${w.water[level]}`}
      onKeyDown={onBottleKey} style={{ left: pct(AXIS_X - half - 6, SCENE_W), width: pct(half * 2 + 12, SCENE_W), top: pct(neck, SCENE_H), height: pct(bottomY(shape) - neck + 8, SCENE_H) }} />
    <button type="button" className="bl-neck" data-bl-cap="" aria-label={capOpen ? w.capClose : w.capOpen} aria-pressed={capOpen} disabled={!live} onClick={tap(() => { void selectionHaptic(); touched(); flipCap(!capOpen); })}
      style={{ left: pct(AXIS_X - 30, SCENE_W), width: pct(60, SCENE_W), top: pct(capOpen ? top + 6 : top - 40, SCENE_H), height: pct(neck - (capOpen ? top + 6 : top - 40), SCENE_H) }} />
    {capOpen && <button type="button" className="bl-neck" data-bl-mouth="" aria-label={w.mouth} disabled={!live} onClick={tap(hoot)}
      style={{ left: pct(AXIS_X - 30, SCENE_W), width: pct(60, SCENE_W), top: pct(top - 46, SCENE_H), height: pct(52, SCENE_H) }} />}
    {live && reach.map(slot => {
      const taken = bottle.stickers.find(s => s.slot === slot);
      if (!taken && !picked) return null;
      const p = slotPlace(shape, slot, rotation);
      return <button key={slot} type="button" className="bl-slot" data-bl-slot={slot} data-free={!taken} style={{ left: pct(p.cx, SCENE_W), top: pct(p.cy, SCENE_H) }}
        aria-label={taken ? fillIn(w.slotPeel, w.stickers[taken.art], rowName(slot)) : fillIn(w.slotFree, w.stickers[picked ?? 'star'], rowName(slot))}
        onClick={tap(() => { touched(); if (taken) onPeel(slot); else onPlace(slot); })} />;
    })}
    <button type="button" className="bl-aya" data-bl-aya="" aria-label={away ? w.ayaBack : w.aya} disabled={!live} onClick={tap(askAya)} style={{ left: pct(ayaX(home), SCENE_W), top: pct(AYA.feet - AYA.height / 2, SCENE_H) }} />
    {pokes.map(p => <span key={p.id} className="bl-poke" data-glass={p.glass} aria-hidden="true" style={{ left: pct(p.x, SCENE_W), top: pct(p.y, SCENE_H) }} />)}
    {hint && live && <span className="bl-ghost" data-hint={hint} aria-hidden="true" style={{ left: pct(AXIS_X, SCENE_W), top: pct(PROFILES[shape].rows[1], SCENE_H), '--bl-swing': `${((stage.current?.getBoundingClientRect().width ?? 360) * half * 1.05 / SCENE_W).toFixed(0)}px` } as CSSProperties}>
      <i className="bl-ghost__ring" /><GhostHand />
    </span>}
  </div>;
}));

/** The room, and every definition the other layers share. Drawn once per shape and finish. */
const RoomLayer = memo(function RoomLayer({ uid, shape, finish, maps }: { uid: string; shape: ShapeId; finish: BottleCreation['finish']; maps: { still: ReturnType<typeof refractionMap>; air: ReturnType<typeof refractionMap>; wet: ReturnType<typeof refractionMap> } }) {
  return <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
    <BottleDefs uid={uid} shape={shape} finish={finish} map={maps.still} air={maps.air} wet={maps.wet} />
    <Backdrop />
  </svg>;
});
/** The whole inside of the bottle as it looks with no water in it. Never changes while a bottle keeps its shape. */
const AirLayer = memo(function AirLayer({ uid, shape, finish }: { uid: string; shape: ShapeId; finish: BottleCreation['finish'] }) {
  return <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false"><GlassInside uid={uid} shape={shape} finish={finish} part="air" /></svg>;
});
/** The whole inside as it looks full of water: the room flipped and magnified
 * by the lens, and with it whoever stands behind the bottle (Aya, the lamp).
 * It is bent again only while one of them moves behind the glass. */
const WetLayer = memo(function WetLayer({ uid, shape, finish, lamp, lampOn, walk, aya }: { uid: string; shape: ShapeId; finish: BottleCreation['finish']; lamp: number | null; lampOn: boolean; walk: number; aya: RefObject<SVGGElement | null> }) {
  return <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
    <GlassInside uid={uid} shape={shape} finish={finish} part="wet">
      {lamp !== null && <Lamp uid={uid} angle={lamp} on={lampOn} shadow={false} />}
      <g ref={aya} transform="translate(-900 0)"><AyaArt uid={uid} pose={walk ? 'side' : 'front'} flip={walk < 0} x={0} y={0} shadow={false} /></g>
    </GlassInside>
  </svg>;
});

/** With motion reduced, bubbles are a still handful; a tap cuts to a new handful. */
function StillBubbleSet({ uid, shape, seed, level }: { uid: string; shape: ShapeId; seed: number; level: number }) {
  let s = 97 + seed * 131;
  const roll = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const list = Array.from({ length: seed ? 14 : 7 }, (_, i) => spawnBubble(shape, i, roll, AXIS_X, true, level));
  return <>{list.map(b => <circle key={b.id} cx={b.x} cy={b.y} r={b.r} style={{ fill: ids(uid).url('bubble') }} />)}</>;
}

/** The demonstrating hand: interface, not scene, so it wears the Studio's white and graphite. */
function GhostHand() {
  return <svg className="bl-ghost__hand" viewBox="0 0 48 60" aria-hidden="true" focusable="false">
    <path d="M17 4.5C17 2 19 0.5 21.2 0.5C23.4 0.5 25.4 2 25.4 4.5L25.4 24C26.4 22.6 28 22 29.6 22.4C31.6 22.9 32.6 24.6 32.6 26.4C33.6 25.4 35.2 25 36.8 25.6C38.6 26.3 39.4 28 39.4 29.6C40.6 29 42.2 29 43.6 29.9C45 30.8 45.6 32.2 45.6 34L45.6 42C45.6 51.6 39.2 59 29.6 59L25.6 59C19.6 59 15.6 56.4 12.6 51.6L4 37.6C2.8 35.6 3.4 33.2 5.4 32C7.4 30.8 9.8 31.4 11.2 33.2L17 40.6Z"
      style={{ fill: 'var(--studio-surface)', stroke: 'var(--studio-graphite)', strokeOpacity: 0.6, strokeWidth: 2, strokeLinejoin: 'round' }} />
  </svg>;
}
