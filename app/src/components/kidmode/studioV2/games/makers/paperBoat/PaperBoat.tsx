import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidHush } from '../../../../audio/kidAudio';
import { usePrefersReducedMotion } from '../../../../../ui/playkit';
import { selectionHaptic } from '../../../../../../lib/native';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { PAPER_BOAT_COPY } from './paperBoatCopy';
import {
  ARRIVE, BOAT_BANK, BOAT_STREAM, BOOK_PERSPECTIVE, BOOK_TILT, CLOSE_MS, HARBOUR_LAMPS, HINT_PLAY, HINT_REST, HOME_MS, PAGE_D, PAGE_W, RIVER_END, SPREADS, SPREAD_W, STORM_BAND,
  angleForLane, bookScene, canFinish, canTurn, clamp01, clampWheel, createBook, fitBook, grabRadius, harbourStep, hintPose, keyIntent, lampsLit, laneForAngle, launchFromDrag,
  leafFraction, pageOrder, projectBookPoint, riverDone, riverGates, riverStep, setWheel, settleSeconds, spreadDone, stageBox, stormCalm, stormStep, swipeIntent, turnRelease, unprojectBookPoint, wheelDetents,
  QUAY_LANE, type BookState, type Dir, type SpreadIndex, type StageBox, type TurnIntent,
} from './paperBoatRules';
import { SpreadHalf, toyTargets, type Live, type Toy } from './PaperBoatScenes';
import { PaperWheel, WHEEL_BOX } from './PaperBoatWheel';
import { createBoatAudio, type BoatAudio } from './paperBoatAudio';
import { Boat, HintHand, PAPER_GRAIN } from './PaperBoatArt';
import { KIT_ROOM, KIT_TABLE, spreadArt, type CrewId } from './paperBoatKit';
import '../makerPalette.css';
import './paperBoat.css';

const TURN_MS = 900;
/** Room kept under the book for the page corners (screen px). */
const CORNER_ROOM = 30;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const line = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** In memory only: which reading this is (so a second one is another river),
 * and which first moves have been made (their hint hand never comes back). */
let readings = 0;
const learned = { steer: false, steady: false, turn: false };
type Hint = 'setSail' | 'steer' | 'steady' | 'turn';
/** The crew on the CrewLink's five presence dots, in the order the boat meets them. */
const LINK: readonly CrewId[] = ['aya', 'bebe', 'pep', 'chock', 'gobgob'];

interface TurnAnim { from: number; to: number; start: number; dur: number; settle: SpreadIndex; glide: boolean }
interface PageDrag { id: number; intent: TurnIntent | null; x: number; y: number; moved: boolean; fraction: number; velocity: number; at: number; fromCorner: boolean; onToy: boolean; radius: number; base: number; off0: number }
interface BoatAnim { fx: number; fy: number; tx: number; ty: number; start: number; dur: number; launch: boolean }
interface Fit { h: number; side: boolean; wheel: number; scale: number; tilt: number; box: StageBox; stageW: number; stageH: number }

export default function PaperBoat() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = PAPER_BOAT_COPY[lang], shared = ADVENTURE_COPY[lang];
  const dir: Dir = lang === 'he' ? 'rtl' : 'ltr', order = pageOrder(dir);
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [, setFrame] = useState(0);
  const redraw = () => setFrame(n => (n + 1) % 1_000_000);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('');
  const [fit, setFit] = useState<Fit>(() => ({ h: 560, side: false, wheel: 220, scale: 0.66, tilt: BOOK_TILT, box: stageBox(BOOK_TILT), stageW: 370, stageH: 260 }));

  const book = useRef<BookState>(createBook(readings));
  const position = useRef(0);
  const turn = useRef<TurnAnim | null>(null);
  const pageDrag = useRef<PageDrag | null>(null);
  const boat = useRef({ x: BOAT_BANK.x, y: BOAT_BANK.y, anim: null as BoatAnim | null, dragging: false });
  /** Where the boat is drawn now (the hint hand may be carrying it). */
  const boatShown = useRef({ x: BOAT_BANK.x, y: BOAT_BANK.y });
  const held = useRef(false);
  const gust = useRef<number | null>(null);
  const arches = useRef<Record<string, number>>({});
  const waiting = useRef<string | null>(null);
  const waitingQuay = useRef(false);
  const stamps = useRef({ launched: null as number | null, calm: null as number | null, dock: null as number | null, home: null as number | null, told: false });
  const calmShown = useRef(0);
  const clock = useRef(0);
  const rumbleAt = useRef(0);
  const rainLevel = useRef(-1);
  const routeUntil = useRef(0);
  const pokes = useRef<Record<string, number>>({});
  const taps = useRef<Record<string, number>>({});
  const ripples = useRef<{ x: number; y: number; at: number }[]>([]);
  const landed = useRef({ spread: 0 as SpreadIndex, at: -99, pieces: 12 });
  const lively = useRef(0);
  const hint = useRef({ kind: null as Hint | null, start: -1, next: 0.9, shows: 0 });
  const lastInput = useRef(-99);
  const closing = useRef<number | null>(null);
  const quietClick = useRef(0);
  const audio = useRef<BoatAudio | null>(null);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const bookEl = useRef<HTMLDivElement>(null);
  const wheelBox = useRef({ cx: 0, cy: 0, k: 1 });
  const live = useRef({ dir, reduced, w, fit });
  live.current = { dir, reduced, w, fit };

  const say = (text: string) => setStatus(text);
  const hintText = (spread: SpreadIndex) => w.hints[spread][spreadDone(book.current, spread) ? 1 : 0];
  const touch = () => { lastInput.current = clock.current; if (hint.current.start >= 0) { hint.current.start = -1; hint.current.next = clock.current + HINT_REST; } };
  const buzz = () => { void selectionHaptic(); };

  /* ── sound for each spread ─────────────────────────────────────────────── */
  const enter = (spread: SpreadIndex) => {
    rainLevel.current = -1;
    if (spread === 1) audio.current?.lap();
    if (spread === 2) rumbleAt.current = clock.current + 2.2;
    say(hintText(spread));
    if (typeof Image !== 'undefined') for (const src of spreadArt(spread + 1)) { const img = new Image(); img.src = src; }
  };
  /** A page change stops the hear-it voice and the old spread's sounds. */
  const leave = () => { kidHush(); audio.current?.stopAll(); rainLevel.current = -1; };

  /* ── turning ───────────────────────────────────────────────────────────── */
  const settle = (spread: SpreadIndex) => {
    position.current = spread;
    const changed = book.current.spread !== spread;
    book.current = { ...book.current, spread };
    if (changed) {
      if (live.current.reduced) bookEl.current?.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      else { landed.current = { spread, at: clock.current, pieces: 12 }; audio.current?.thup(); audio.current?.pops(3); buzz(); }
      learned.turn = true;
      hint.current = { kind: null, start: -1, next: clock.current + 0.9, shows: 0 };
    }
    enter(spread);
  };
  const animateTo = (target: SpreadIndex) => {
    const from = position.current;
    if (live.current.reduced) { turn.current = null; settle(target); redraw(); return; }
    turn.current = { from, to: target, start: now(), dur: Math.max(220, TURN_MS * Math.abs(target - from)), settle: target, glide: false };
  };
  const startTurn = (intent: TurnIntent) => {
    if (turn.current || pageDrag.current?.moved || closing.current !== null || !canTurn(book.current, intent)) return;
    touch(); leave(); audio.current?.swish(); buzz();
    animateTo((book.current.spread + (intent === 'next' ? 1 : -1)) as SpreadIndex);
  };
  /** The end: the book closes itself, then the Studio takes over. */
  const finish = () => {
    if (!canFinish(book.current) || turn.current || closing.current !== null) return;
    touch(); leave(); buzz();
    if (live.current.reduced) { setDone(true); return; }
    audio.current?.swish(); audio.current?.close();
    closing.current = clock.current;
  };

  /** A finger on a page corner (or anywhere on the book) lifts the page: the
   * point that was grabbed stays under the finger. A tap on the bare page
   * leaves a ring where it fell. */
  const pageDown = (event: ReactPointerEvent<HTMLElement>, intent: TurnIntent | null) => {
    touch();
    if (turn.current || pageDrag.current || done || closing.current !== null) return;
    if (intent && !canTurn(book.current, intent)) return;
    const box = stage.current?.getBoundingClientRect();
    const spine = box ? box.left + box.width / 2 : event.clientX, side = live.current.dir === 'rtl' ? -1 : 1;
    const pageW = PAGE_W * live.current.fit.scale;
    const drag: PageDrag = { id: event.pointerId, intent, x: event.clientX, y: event.clientY, moved: false, fraction: intent === 'back' ? 1 : 0, velocity: 0, at: now(), fromCorner: intent !== null, onToy: !!(event.target as Element).closest?.('[data-pb-toy]'), radius: pageW, base: pageW, off0: (event.clientX - spine) * side };
    pageDrag.current = drag;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dx) < 9) return;
        if (!drag.intent) {
          if (Math.abs(dy) > Math.abs(dx)) { stop(); return; }
          const wanted = swipeIntent(dx, live.current.dir, 9);
          if (!wanted || !canTurn(book.current, wanted)) { stop(); return; }
          drag.intent = wanted; drag.fraction = wanted === 'back' ? 1 : 0;
        }
        drag.radius = grabRadius(drag.off0, pageW, drag.intent);
        // Grabbed on the turning page, the page starts where the finger is; elsewhere, at its edge.
        const onLeaf = drag.intent === 'next' ? drag.off0 : -drag.off0;
        drag.base = (drag.intent === 'next' ? 1 : -1) * (onLeaf > 0 ? Math.min(drag.radius, onLeaf) : drag.radius);
        drag.moved = true; quietClick.current = now(); leave(); audio.current?.swish(); buzz();
      }
      const fraction = leafFraction(drag.base + (e.clientX - spine) * side - drag.off0, drag.radius), t = now();
      const span = Math.max(0.008, (t - drag.at) / 1000);
      drag.velocity = drag.velocity * 0.6 + ((fraction - drag.fraction) / span) * 0.4;
      drag.fraction = fraction; drag.at = t; quietClick.current = t;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const { moved, intent: going, fraction, fromCorner, onToy } = drag;
      stop();
      if (!moved) {
        if (fromCorner && going) startTurn(going);
        else if (!onToy && !fromCorner) pagePoke(e.clientX, e.clientY);
        return;
      }
      const lower = book.current.spread + (going === 'next' ? 0 : -1);
      // Stale speed is no flick: a page held still falls to its nearer side.
      const speed = now() - drag.at > 120 ? 0 : drag.velocity;
      const target = (lower + turnRelease(fraction, speed)) as SpreadIndex;
      if (live.current.reduced) { settle(target); redraw(); return; }
      const far = Math.abs(target - position.current);
      turn.current = { from: position.current, to: target, start: now(), dur: Math.min(640, 170 + 520 * far), settle: target, glide: true };
    };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (pageDrag.current === drag) pageDrag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  /* ── where things are on the screen ────────────────────────────────────── */
  /** A point of the book, in the stage's own px. */
  const project = (x: number, y: number, z = 0) => {
    const { scale, tilt, box, stageW, stageH } = live.current.fit;
    const p = projectBookPoint(x, y, live.current.dir === 'rtl', z, tilt);
    return { left: stageW / 2 + p.x * scale, top: stageH - CORNER_ROOM - (box.h - box.cy) * scale + p.y * scale };
  };
  const pagePoke = (clientX: number, clientY: number) => {
    const box = stage.current?.getBoundingClientRect(); if (!box || book.current.spread !== Math.round(position.current)) return;
    const { scale, tilt, box: room, stageW, stageH } = live.current.fit;
    const sx = (clientX - box.left - stageW / 2) / scale, sy = (clientY - box.top - (stageH - CORNER_ROOM - (room.h - room.cy) * scale)) / scale;
    const at = unprojectBookPoint(sx, sy, live.current.dir === 'rtl', tilt);
    if (at.x < 4 || at.x > SPREAD_W - 4 || at.y < 4 || at.y > PAGE_D - 4) return;
    ripples.current = [...ripples.current.slice(-3), { x: at.x, y: at.y, at: clock.current }];
    lively.current = clock.current + 1;
    audio.current?.poke(4 - Math.min(4, Math.floor(at.y / 58))); buzz(); redraw();
  };
  const poke = (toy: Toy) => {
    if (now() - quietClick.current < 260 || turn.current || closing.current !== null) return;
    touch();
    const t = clock.current, count = (taps.current[toy.id] ?? 0) + 1;
    pokes.current = { ...pokes.current, [toy.id]: t, ...(toy.wobble ? { [toy.wobble]: t } : {}) };
    taps.current = { ...taps.current, [toy.id]: count };
    lively.current = t + 3;
    if (toy.kind === 'bebe') routeUntil.current = t + 5;
    audio.current?.toy(toy.kind, toy.note ?? count - 1); buzz();
    say(w.toys[toy.kind][1]);
    redraw();
  };

  /* ── spread one: the boat on the bank ──────────────────────────────────── */
  const launched = () => {
    book.current = { ...book.current, launched: true };
    stamps.current.launched = clock.current; lively.current = clock.current + 3;
    audio.current?.lap(); audio.current?.chime(0); buzz(); say(hintText(0));
  };
  const launch = (fromX: number, fromY: number) => {
    const b = boat.current;
    if (book.current.launched || b.anim?.launch) return;
    touch();
    if (live.current.reduced) { b.x = BOAT_STREAM.x; b.y = BOAT_STREAM.y; launched(); redraw(); return; }
    b.anim = { fx: fromX, fy: fromY, tx: BOAT_STREAM.x, ty: BOAT_STREAM.y, start: now(), dur: 760, launch: true };
  };
  const boatDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    // A boat picked up while the hand was carrying it stays under the finger.
    const from = { x: boatShown.current.x - BOAT_BANK.x, y: boatShown.current.y - BOAT_BANK.y };
    touch(); buzz();
    if (book.current.launched || boat.current.anim || turn.current || book.current.spread !== 0) return;
    const b = boat.current, sx = event.clientX, sy = event.clientY, id = event.pointerId;
    b.x = BOAT_BANK.x + from.x; b.y = BOAT_BANK.y + from.y;
    const mirror = live.current.dir === 'rtl', s = live.current.fit.scale, lean = Math.cos((live.current.fit.tilt * Math.PI) / 180);
    let moved = false, ox = from.x, oy = from.y;
    b.dragging = true;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = (e.clientX - sx) / s, dy = (e.clientY - sy) / s;
      if (Math.hypot(dx, dy) > 4) moved = true;
      ox = Math.max(-40, Math.min(BOAT_STREAM.x - BOAT_BANK.x + 30, from.x + (mirror ? -dx : dx))); oy = Math.max(-60, Math.min(16, from.y + dy / lean));
      b.x = BOAT_BANK.x + ox; b.y = BOAT_BANK.y + oy; redraw();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      b.dragging = false;
      // A tap, or a pull towards the water, launches the boat; a little nudge lets it drift back.
      if (!moved || launchFromDrag(ox, -oy)) { launch(b.x, b.y); return; }
      if (live.current.reduced) { b.x = BOAT_BANK.x; b.y = BOAT_BANK.y; redraw(); return; }
      b.anim = { fx: b.x, fy: b.y, tx: BOAT_BANK.x, ty: BOAT_BANK.y, start: now(), dur: 380, launch: false };
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  /* ── the wheel ─────────────────────────────────────────────────────────── */
  const turnWheel = (angle: number) => {
    const spread = book.current.spread;
    touch();
    if (turn.current) return;
    const before = book.current.wheel[spread], next = clampWheel(angle);
    if (wheelDetents(before, next) > 0) { audio.current?.tick(); buzz(); }
    gust.current = null;
    if (spread > 0 && Math.abs(next - before) > 1) learned.steer = true;
    book.current = setWheel(book.current, spread, next);
    redraw();
  };

  /* ── which first move the hand would show now ──────────────────────────── */
  const hintNow = (): Hint | null => {
    const b = book.current;
    if (done || closing.current !== null || turn.current || pageDrag.current || boat.current.dragging || boat.current.anim || position.current !== b.spread) return null;
    if (canTurn(b, 'next')) return learned.turn ? null : 'turn';
    if (b.spread === 0) return b.launched ? null : 'setSail';
    if (b.spread === 1) return riverDone(b.river) || learned.steer ? null : 'steer';
    if (b.spread === 2) return b.storm.calmed || learned.steady ? null : 'steady';
    return b.harbour.docked || learned.steer ? null : 'steer';
  };

  /* ── one frame of the book ─────────────────────────────────────────────── */
  const step = (t: number, dt: number) => {
    const { dir: d, reduced: still, w: words } = live.current;
    clock.current += dt;
    let dirty = clock.current < lively.current || clock.current - landed.current.at < settleSeconds(landed.current.pieces);
    // the hint hand: once on arrival, then again after a quiet while
    const wanted = hintNow(), h = hint.current;
    if (wanted !== h.kind) hint.current = { kind: wanted, start: -1, next: clock.current + 0.9, shows: 0 };
    else if (wanted && h.start < 0 && clock.current >= h.next && clock.current - lastInput.current >= (h.shows ? HINT_REST : 0.9)) { h.start = clock.current; h.shows += 1; }
    else if (h.start >= 0 && clock.current - h.start > HINT_PLAY) { h.start = -1; h.next = clock.current + HINT_REST; dirty = true; }
    if (hint.current.start >= 0) dirty = true;
    if (closing.current !== null) {
      if ((clock.current - closing.current) * 1000 >= CLOSE_MS + 380) { closing.current = null; setDone(true); }
      return true;
    }
    const drag = pageDrag.current;
    if (drag?.moved) {
      const lower = book.current.spread + (drag.intent === 'next' ? 0 : -1), goal = lower + drag.fraction;
      position.current = still ? goal : position.current + (goal - position.current) * Math.min(1, dt * 28);
      return true;
    }
    const tr = turn.current;
    if (tr) {
      const k = clamp01((t - tr.start) / tr.dur);
      position.current = tr.from + (tr.to - tr.from) * (tr.glide ? easeOut(k) : ease(k)); dirty = true;
      if (k >= 1) { turn.current = null; settle(tr.settle); }
    }
    if (turn.current || !bookScene(position.current).settled) return dirty;
    const b = book.current;
    if (b.spread === 0) {
      const anim = boat.current.anim;
      if (anim) {
        const k = clamp01((t - anim.start) / anim.dur), e = ease(k);
        boat.current.x = anim.fx + (anim.tx - anim.fx) * e; boat.current.y = anim.fy + (anim.ty - anim.fy) * e - (anim.launch ? Math.sin(Math.PI * k) * 14 : 0);
        if (k >= 1) { boat.current.anim = null; if (anim.launch) launched(); }
        return true;
      }
      return dirty || (!still && b.launched);
    }
    if (b.spread === 1) {
      if (riverDone(b.river) && b.river.d >= RIVER_END) { waiting.current = null; return dirty || !still; }
      const result = riverStep(b.river, dt, laneForAngle(b.wheel[1], d));
      book.current = { ...b, river: result.river };
      const gates = riverGates(result.river.course);
      waiting.current = result.events.includes('held') ? gates[result.river.gates]?.id ?? null : null;
      if (result.events.includes('bump')) { audio.current?.bump(); buzz(); say(words.nudge); }
      if (result.events.includes('reedGate')) {
        const passed = gates[result.river.gates - 1];
        if (passed) arches.current = { ...arches.current, [passed.id]: clock.current };
        audio.current?.chime(result.river.gates - 1); buzz();
        say(riverDone(result.river) ? words.hints[1][1] : words.arch);
      }
      return true;
    }
    if (b.spread === 2) {
      let wheel = b.wheel[2];
      if (gust.current !== null) {
        const target = gust.current;
        wheel = still ? target : wheel + (target - wheel) * Math.min(1, dt * 5);
        if (Math.abs(target - wheel) < 0.5) { wheel = target; gust.current = null; }
      }
      const wasCalm = b.storm.calmed;
      const result = stormStep(b.storm, dt, wheel, held.current);
      book.current = { ...setWheel(b, 2, wheel), storm: result.storm };
      if (result.gust) audio.current?.gust();
      if (result.push) gust.current = clampWheel(wheel + result.push);
      const calm = stormCalm(result.storm);
      calmShown.current = still ? calm : calmShown.current + (calm - calmShown.current) * Math.min(1, dt * 1.6);
      if (!wasCalm && result.storm.calmed) { learned.steady = true; stamps.current.calm = clock.current; audio.current?.rain(0); audio.current?.chime(1); buzz(); say(words.calm); }
      const rain = result.storm.calmed ? 0 : 1 - calmShown.current * 0.8;
      if (Math.abs(rain - rainLevel.current) > 0.05) { rainLevel.current = rain; audio.current?.rain(rain); }
      if (!result.storm.calmed && calm < 0.6 && clock.current >= rumbleAt.current) { audio.current?.rumble(); rumbleAt.current = clock.current + 7.5; }
      return true;
    }
    // home
    if (!b.harbour.docked) {
      const result = harbourStep(b.harbour, dt, laneForAngle(b.wheel[3], d));
      book.current = { ...b, harbour: result.harbour };
      waitingQuay.current = result.held;
      if (result.docked) { stamps.current.dock = clock.current; waitingQuay.current = false; audio.current?.bell(); buzz(); say(words.docked); }
      return true;
    }
    if (b.harbour.lamps < HARBOUR_LAMPS) {
      const lit = stamps.current.dock === null ? HARBOUR_LAMPS : lampsLit((clock.current - stamps.current.dock) * 1000);
      if (lit > b.harbour.lamps) {
        for (let i = b.harbour.lamps; i < lit; i++) audio.current?.lamp(i);
        book.current = { ...b, harbour: { ...b.harbour, lamps: lit } };
        if (lit >= HARBOUR_LAMPS) { stamps.current.home = clock.current; audio.current?.home(); buzz(); say(words.homecoming); }
      }
      return true;
    }
    if (stamps.current.home !== null && !stamps.current.told) {
      if ((clock.current - stamps.current.home) * 1000 >= HOME_MS) { stamps.current.told = true; say(words.hints[3][1]); }
      return true;
    }
    return dirty || !still;
  };
  const stepRef = useRef(step); stepRef.current = step;

  useEffect(() => {
    const instance = createBoatAudio(); audio.current = instance;
    let raf = 0, last = now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (stepRef.current(t, dt)) redraw();
    };
    raf = requestAnimationFrame(loop);
    const visibility = () => { if (document.hidden) { instance.stopAll(); rainLevel.current = -1; } };
    document.addEventListener('visibilitychange', visibility);
    say(w.hints[0][0]);
    if (typeof Image !== 'undefined') for (const src of [...spreadArt(0), ...spreadArt(1)]) { const img = new Image(); img.src = src; }
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); instance.dispose(); audio.current = null; readings += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the book takes all the room the screen has ────────────────────────── */
  useLayoutEffect(() => {
    const node = section.current; if (!node) return;
    const measure = () => {
      const shell = node.closest('.studio-game-view');
      const below = shell ? parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 16;
      const top = node.getBoundingClientRect().top + (window.scrollY || 0);
      const width = node.clientWidth, h = Math.max(430, Math.round(window.innerHeight - top - below));
      const side = width >= 720 && width / h >= 1.15;
      node.style.blockSize = `${h}px`; node.dataset.layout = side ? 'book-beside' : 'book-above';
      // The wheel gives way before the book does: try it large, then smaller.
      let best: Fit | null = null;
      for (const wheel of (side ? [248, 220, 196, 172] : [288, 264, 240, 216, 196]).map(size => Math.min(size, side ? size : width - 160))) {
        node.style.setProperty('--pb-wheel', `${wheel}px`);
        const stageW = stage.current?.clientWidth ?? width, stageH = stage.current?.clientHeight ?? 260;
        const fitted = fitBook(stageW - 4, stageH - CORNER_ROOM - 4);
        const next: Fit = { h, side, wheel, stageW, stageH, ...fitted };
        if (!best || next.scale > best.scale * 1.01) best = next;
        if (fitted.scale >= (stageW - 4) / fitted.box.w - 0.002) break;
      }
      if (!best) return;
      node.style.setProperty('--pb-wheel', `${best.wheel}px`);
      const disc = node.querySelector('[data-pb-wheel-disc]')?.getBoundingClientRect(), frame = node.getBoundingClientRect();
      if (disc) { const k = disc.width / WHEEL_BOX.w; wheelBox.current = { cx: disc.left - frame.left + WHEEL_BOX.cx * k, cy: disc.top - frame.top + WHEEL_BOX.cy * k, k }; }
      const b = best;
      setFit(old => (old.h === b.h && old.side === b.side && old.wheel === b.wheel && Math.abs(old.scale - b.scale) < 0.002 && old.tilt === b.tilt && old.stageW === b.stageW && old.stageH === b.stageH ? old : b));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node.parentElement ?? node); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    touch();
    if ((event.target as HTMLElement).closest?.('[data-pb-wheel]')) return;
    const intent = keyIntent(event.key, dir);
    if (!intent) return;
    event.preventDefault();
    startTurn(intent);
  };
  const reset = () => {
    leave(); turn.current = null; pageDrag.current = null; closing.current = null; readings += 1;
    book.current = createBook(readings); position.current = 0; boat.current = { x: BOAT_BANK.x, y: BOAT_BANK.y, anim: null, dragging: false };
    arches.current = {}; waiting.current = null; waitingQuay.current = false; calmShown.current = 0; gust.current = null; held.current = false;
    stamps.current = { launched: null, calm: null, dock: null, home: null, told: false }; pokes.current = {}; taps.current = {}; ripples.current = [];
    setDone(false); say(w.hints[0][0]);
  };

  /* ── render ────────────────────────────────────────────────────────────── */
  const b = book.current, t = clock.current, { scale, tilt, box } = fit;
  const closeK = closing.current === null ? 0 : ease(clamp01(((t - closing.current) * 1000) / CLOSE_MS));
  const settled = bookScene(position.current).settled && !turn.current && !pageDrag.current?.moved && closing.current === null;
  const spread = b.spread, shownSpread = (settled ? spread : Math.round(position.current)) as SpreadIndex;
  const text = w.spreads[spread];
  const harbour = b.harbour;
  // the hand's showing, and what it carries with it
  const showing = hint.current.start >= 0 && settled ? hint.current.kind : null;
  const pose = showing ? hintPose((t - hint.current.start) / HINT_PLAY) : null;
  const travel = pose ? (reduced ? (pose.travel > 0.5 ? 1 : 0) : pose.travel) : 0;
  const carry = pose ? travel * pose.press : 0;
  const peel = showing === 'turn' ? carry * 0.2 : 0;
  const scene = bookScene(position.current + peel);
  const gates = riverGates(b.river.course), nextGate = gates[b.river.gates];
  const aim = settled && spread === 1 && nextGate ? angleForLane(nextGate.lane, dir) : settled && spread === 3 && !harbour.docked ? angleForLane(QUAY_LANE, dir) : null;
  const wheelSpread = shownSpread, wheelAngle = b.wheel[wheelSpread];
  const hintTurn = showing === 'steer' && aim !== null ? (Math.abs(aim - wheelAngle) < 8 ? 50 : aim - wheelAngle) : showing === 'steady' ? -wheelAngle : 0;
  const nudge = (showing === 'steer' || showing === 'steady') ? hintTurn * carry : 0;
  const home = stamps.current.home === null ? (harbour.lamps >= HARBOUR_LAMPS ? 9 : -1) : t - stamps.current.home;
  const homeDone = home * 1000 >= HOME_MS || (reduced && harbour.lamps >= HARBOUR_LAMPS);
  const boatAt = b.launched ? BOAT_STREAM : showing === 'setSail' && !reduced ? { x: boat.current.x + (BOAT_STREAM.x - BOAT_BANK.x) * carry * 0.45, y: boat.current.y + (BOAT_STREAM.y - BOAT_BANK.y) * carry * 0.45 } : boat.current;
  boatShown.current = boatAt;
  const liveScene: Live = {
    time: t, reduced, mirror: order.mirror, uid, pokes: pokes.current, taps: taps.current, ripples: ripples.current,
    boat0: { x: boatAt.x, y: boatAt.y, afloat: b.launched || !!boat.current.anim?.launch, hint: !b.launched && !boat.current.anim && settled && spread === 0 },
    launchedAt: stamps.current.launched,
    river: b.river, steer1: laneForAngle(b.wheel[1], dir), arches: arches.current, waiting: settled ? waiting.current : null, route: settled && (waiting.current !== null || t < routeUntil.current),
    calm: calmShown.current, calmAt: stamps.current.calm, wheel2: b.wheel[2],
    harbour, steer3: laneForAngle(b.wheel[3], dir), rope: harbour.docked ? 1 : 0, waitingQuay: settled && waitingQuay.current, dockAt: stamps.current.dock, home,
  };
  const steady = wheelSpread === 2 && Math.abs(wheelAngle) <= STORM_BAND;
  const valueText = wheelSpread === 2 ? (b.storm.calmed || steady ? w.steady : w.windy) : w.lanes[laneForAngle(wheelAngle, dir)];
  const nextAt = project(SPREAD_W, PAGE_D), backAt = project(0, PAGE_D);
  const showNext = settled && canTurn(b, 'next');
  const showBack = settled && canTurn(b, 'back');
  const showEnd = settled && canFinish(b) && homeDone;
  const Forward = dir === 'rtl' ? ArrowLeft : ArrowRight, Backward = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const corner = (at: { left: number; top: number }, side: 'next' | 'back') => {
    // The corner tab sits on the page's outer front corner, tucked inside the book.
    const inward = (side === 'next') === (order.nextCorner === 'right') ? -1 : 1;
    return { left: at.left + inward * 34 - 30, top: at.top - 26 };
  };
  const toys = settled ? toyTargets(spread, liveScene).map(toy => ({ toy, at: project(toy.x, toy.y, toy.z) })).sort((p, q) => p.toy.y - q.toy.y) : [];
  // An arriving spread's pieces stand only part of the way until its page has landed.
  const fold = (index: SpreadIndex) => (closing.current !== null ? 1 - closeK : scene.progress[index] * (index === spread ? 1 : ARRIVE));
  const rise = (index: SpreadIndex) => (index === landed.current.spread && scene.settled ? t - landed.current.at : -1);
  const leafShade = scene.settled ? 0 : Math.sin(Math.PI * scene.fraction);
  const closingNow = closing.current !== null;
  const leafAngle = closingNow ? -180 * closeK : scene.leafAngle, leafFront = closingNow ? 3 : scene.leafFront, leafBack = closingNow ? null : scene.leafBack;
  const leafK = closingNow ? closeK : scene.fraction;
  // the crew on the CrewLink: a dot comes on when the boat has met them
  const present: Record<CrewId, boolean> = { aya: b.launched, bebe: b.river.gates >= 2, pep: riverDone(b.river), chock: b.storm.calmed, gobgob: harbour.docked };
  const metNames = LINK.filter(id => present[id]).map(id => w.crew[id]).join(', ') || w.nobody;
  // the hand
  let hand: { left: number; top: number } | null = null;
  if (showing && pose) {
    const stageBoxAt = stage.current && section.current ? (() => { const s = stage.current!.getBoundingClientRect(), f = section.current!.getBoundingClientRect(); return { x: s.left - f.left, y: s.top - f.top }; })() : { x: 0, y: 0 };
    if (showing === 'setSail') { const from = project(BOAT_BANK.x, BOAT_BANK.y, 16), to = project(BOAT_STREAM.x, BOAT_STREAM.y, 16); hand = { left: stageBoxAt.x + from.left + (to.left - from.left) * travel, top: stageBoxAt.y + from.top + (to.top - from.top) * travel }; }
    else if (showing === 'turn') { const from = corner(nextAt, 'next'), inward = order.nextCorner === 'right' ? -1 : 1; hand = { left: stageBoxAt.x + from.left + 30 + inward * PAGE_W * scale * 0.5 * travel, top: stageBoxAt.y + from.top + 22 - 18 * travel }; }
    else { const a = ((wheelAngle + hintTurn * travel) * Math.PI) / 180, r = WHEEL_BOX.rim * 0.86 * wheelBox.current.k; hand = { left: wheelBox.current.cx + r * Math.sin(a), top: wheelBox.current.cy - r * Math.cos(a) }; }
  }
  const tableSize = 700;

  return <GameShell fullBleed autoNarrate={false} worldId="paper-boat" title={w.title} instruction={w.instruction} hearIt={`${text[0]} ${text[1]}`}>
    {done
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section ref={section} className="pb" data-adventure="paper-boat" data-layout={fit.side ? 'book-beside' : 'book-above'} data-spread={spread} data-settled={settled} data-pb-arches={b.river.gates} data-pb-calm={b.storm.calmed} data-pb-docked={b.harbour.docked} data-pb-launched={b.launched} data-pb-home={homeDone} data-pb-hint={showing ?? ''} dir={dir} onKeyDown={keyDown} aria-label={w.book} style={{ blockSize: fit.h, ['--pb-wheel' as string]: `${fit.wheel}px`, ['--pb-grain' as string]: PAPER_GRAIN } as CSSProperties}>
        <div className="pb-room" aria-hidden="true"><img src={KIT_ROOM.src} alt="" draggable={false} decoding="async" /></div>
        <div className="pb-label" data-pb-label="">
          <p lang={lang} key={spread}><span>{text[0]}</span><span>{text[1]}</span></p>
          <span className="pb-link" role="img" aria-label={`${line(w.page, spread + 1, SPREADS)}. ${line(w.met, metNames)}`}>
            {LINK.map(id => <i key={id} data-on={present[id]} data-crew={id} />)}
          </span>
        </div>
        <div ref={stage} className="pb-stage" data-pb-stage="" onPointerDown={event => pageDown(event, null)}>
          <div className="pb-scaler" dir="ltr" style={{ inlineSize: box.w, blockSize: box.h, bottom: CORNER_ROOM, transform: `translateX(-50%) scale(${scale})` }}>
            <div className="pb-persp" style={{ left: box.cx - SPREAD_W / 2, top: box.cy - PAGE_D / 2, width: SPREAD_W, height: PAGE_D, perspective: BOOK_PERSPECTIVE }}>
              <div ref={bookEl} className="pb-book" data-mirror={order.mirror} data-pb-position={position.current.toFixed(3)} style={{ width: SPREAD_W, height: PAGE_D, transform: `rotateX(${tilt}deg)${order.mirror ? ' scaleX(-1)' : ''}` }}>
                <span className="pb-tabletop" aria-hidden="true" style={{ width: tableSize, height: tableSize, left: (SPREAD_W - tableSize) / 2, top: (PAGE_D - tableSize) / 2 + 26, backgroundImage: `url(${KIT_TABLE.src})` }} />
                <span className="pb-under" aria-hidden="true" />
                <span className="pb-board pb-board--left" aria-hidden="true" />
                {!closingNow && <span className="pb-board pb-board--right" aria-hidden="true" />}
                <span className="pb-block" aria-hidden="true" style={closingNow ? { width: PAGE_W } : undefined} />
                <div className="pb-page pb-page--left">
                  <SpreadHalf spread={closingNow ? 3 : scene.staticLeft} side="left" progress={fold(closingNow ? 3 : scene.staticLeft)} settle={rise(scene.staticLeft)} live={liveScene} />
                  <span className="pb-page__shade" style={{ opacity: closingNow ? 0.4 * closeK : scene.settled ? 0 : 0.32 * clamp01(scene.fraction * 2 - 1) }} />
                </div>
                {!closingNow && <div className="pb-page pb-page--right">
                  <SpreadHalf spread={scene.staticRight} side="right" progress={fold(scene.staticRight)} settle={rise(scene.staticRight)} live={liveScene} />
                  <span className="pb-page__shade" style={{ opacity: 0.36 * leafShade * (1 - scene.fraction) }} />
                </div>}
                {(closingNow || (!scene.settled && leafFront !== null)) && leafFront !== null && <div className="pb-leaf" style={{ width: PAGE_W, height: PAGE_D, transform: `translateZ(1.6px) rotateY(${leafAngle}deg)` }}>
                  <div className="pb-face pb-face--front" style={{ visibility: leafK < 0.5 ? 'visible' : 'hidden' }}>
                    <SpreadHalf spread={leafFront as SpreadIndex} side="right" progress={fold(leafFront as SpreadIndex)} settle={-1} live={liveScene} />
                    <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * leafK * 2 }} />
                    <span className="pb-sheen" style={{ opacity: 0.5 * Math.sin(Math.PI * clamp01(leafK * 2)), backgroundPosition: `${(120 - leafK * 260).toFixed(1)}% 0` }} />
                  </div>
                  <div className="pb-face pb-face--back" style={{ visibility: leafK >= 0.5 ? 'visible' : 'hidden' }}>
                    {leafBack !== null
                      ? <SpreadHalf spread={leafBack} side="left" progress={fold(leafBack)} settle={-1} live={liveScene} />
                      : <span className="pb-cover"><Boat uid={`${uid}-cover`} className="pb-cover__boat" /></span>}
                    <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * (1 - leafK) * 2 }} />
                    <span className="pb-sheen" style={{ opacity: 0.5 * Math.sin(Math.PI * clamp01((1 - leafK) * 2)), backgroundPosition: `${(leafK * 260 - 140).toFixed(1)}% 0` }} />
                  </div>
                </div>}
              </div>
            </div>
          </div>
          <div className="pb-overlay">
            {toys.map(({ toy, at }) => <button key={toy.id} type="button" className="pb-toy" data-pb-toy={toy.id} data-kind={toy.kind} style={{ left: at.left, top: at.top }} aria-label={w.toys[toy.kind][0]} onClick={() => poke(toy)} />)}
            {!b.launched && spread === 0 && settled && <button type="button" className="pb-toy pb-toy--boat" data-pb-boat-button="" style={project(boatAt.x, boatAt.y, 22)} aria-label={w.boatLaunch} onPointerDown={boatDown} onClick={event => { if (event.detail === 0) launch(boat.current.x, boat.current.y); }} />}
            {showBack && <button type="button" className="pb-corner pb-corner--back" data-pb-turn="back" style={corner(backAt, 'back')} aria-label={w.back} onPointerDown={event => { event.stopPropagation(); pageDown(event, 'back'); }} onClick={event => { if (event.detail === 0) startTurn('back'); }}><Backward size={24} aria-hidden="true" /></button>}
            {showNext && <button type="button" className="pb-corner pb-corner--next" data-pb-turn="next" style={corner(nextAt, 'next')} aria-label={w.next} onPointerDown={event => { event.stopPropagation(); pageDown(event, 'next'); }} onClick={event => { if (event.detail === 0) startTurn('next'); }}><Forward size={26} aria-hidden="true" /></button>}
            {showEnd && <button type="button" className="pb-corner pb-corner--end" data-pb-turn="end" style={{ ...corner(nextAt, 'next'), ...(order.nextCorner === 'right' ? { translate: '-84px 0' } : {}) }} onPointerDown={event => event.stopPropagation()} onClick={finish}><BookOpen size={22} aria-hidden="true" /><span>{w.end}</span></button>}
          </div>
        </div>
        <div className="pb-controls" data-spread={wheelSpread}>
          <PaperWheel angle={wheelAngle} nudge={nudge} enabled={settled} tucked={false} marks={wheelSpread === 2 ? 'steadyBand' : wheelSpread === 0 || (wheelSpread === 3 && harbour.docked) ? 'noMarks' : 'lanes'} steady={steady || (wheelSpread === 2 && b.storm.calmed)} calm={calmShown.current} aim={aim} label={w.wheel} valueText={valueText} leftLabel={w.steerLeft} rightLabel={w.steerRight} onTurn={turnWheel} onHold={value => { held.current = value; touch(); if (value) { gust.current = null; buzz(); } }} />
        </div>
        {hand && pose && <span className="pb-hand" aria-hidden="true" style={{ left: hand.left, top: hand.top, opacity: pose.show }}><HintHand press={pose.press} /></span>}
        <p className="pb-sr" role="status" aria-live="polite">{status}</p>
      </section>}
  </GameShell>;
}
