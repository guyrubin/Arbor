import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Anchor, ArrowLeft, ArrowRight, BookOpen, CloudRain, Flower2, Lamp, RotateCcw, RotateCw } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidHush } from '../../../../audio/kidAudio';
import { selectionHaptic } from '../../../../../../lib/native';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  HudButton, HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, useReducedMotion, useShake,
  type CoachMood, type CoachWho, type FxKind, type FxOptions, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { PAPER_BOAT_COPY } from './paperBoatCopy';
import {
  ARRIVE, BOAT_BANK, BOAT_STREAM, BOOK_PERSPECTIVE, BOOK_TILT, CLOSE_MS, HARBOUR_LAMPS, HINT_PLAY, HINT_REST, HOME_MS, LANE_Y, PAGE_D, PAGE_W, RIVER_END, SPREAD_W, STORM_BAND,
  angleForLane, bookScene, canFinish, canTurn, clamp01, clampWheel, courseX, createBook, grabRadius, harbourStep, hintPose, keyIntent, lampsLit, laneForAngle, launchFromDrag,
  leafFraction, pageOrder, projectBookPoint, riverBoat, riverDone, riverItems, riverLanterns, riverStep, setWheel, settleSeconds, spreadDone, stageBox, stormCalm, stormStep, swipeIntent, turnRelease, unprojectBookPoint, viewCentre, viewFit, wheelDetents,
  QUAY_LANE, QUAY_X, type BookState, type Dir, type RiverEvent, type RiverState, type SpreadIndex, type TurnIntent, type ViewFit,
} from './paperBoatRules';
import { SpreadHalf, floatSpots, toyTargets, type Live, type Toy } from './PaperBoatScenes';
import { PaperWheel, WHEEL_BOX } from './PaperBoatWheel';
import { createBoatAudio, type BoatAudio } from './paperBoatAudio';
import { Boat, HintHand, PAPER_GRAIN, WATER_DEEP, WATER_LIGHT } from './PaperBoatArt';
import { KIT_ROOM, KIT_TABLE, spreadArt } from './paperBoatKit';
import '../makerPalette.css';
import './paperBoat.css';

/** The Paper Boat: a pop-up book of Horizon Valley, open on the reading-room
 * table and filling the screen. Three chapters and a homecoming: launch the
 * boat and thread the stones of a Sky Gardens stream; ring the paper lanterns
 * under the Glass Grove skybridge; ride out the rain on Reflection Basin by
 * holding the wheel steady; find the quay at Wonderworks, where the lanterns
 * come on one by one across the water and the whole crew is waiting. The book
 * is real CSS 3D, the boat is folded in 3D and steered with the wheel, and one
 * clock moves everything. Nothing can be failed: a stone nudges, a lantern
 * waits, the rain passes when the wheel is held. */

const TURN_MS = 1150, OPEN_MS = 1700;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const line = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
/** In memory only: which reading this is (so a second one is another river),
 * and which first moves have been made (their hint hand never comes back). */
let readings = 0;
const learned = { steer: false, steady: false };
type Hint = 'setSail' | 'steer' | 'steady';
const HOSTS: readonly CoachWho[] = ['aya', 'pep', 'chock', 'gobgob'];
const GRADES = ['day', 'day', 'cool', 'warm'] as const;

interface TurnAnim { from: number; to: number; start: number; dur: number; settle: SpreadIndex; glide: boolean }
interface PageDrag { id: number; intent: TurnIntent | null; x: number; y: number; moved: boolean; fraction: number; velocity: number; at: number; onToy: boolean; radius: number; base: number; off0: number }
interface BoatAnim { fx: number; fy: number; tx: number; ty: number; start: number; dur: number; launch: boolean }
interface Fit { w: number; h: number; portrait: boolean; short: boolean; wheel: number; base: number; /** On a short, wide screen the wheel sits beside the book: the room it takes at the screen's end. */ side: number; view: ViewFit }
interface Coach { who: CoachWho; mood: CoachMood; line: string }
const firstFit = (): Fit => ({ w: 390, h: 700, portrait: true, short: false, wheel: 170, base: 540, side: 0, view: { tilt: BOOK_TILT, box: stageBox(BOOK_TILT), wide: 0.66, near: 1.2 } });

export default function PaperBoat() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = PAPER_BOAT_COPY[lang], shared = ADVENTURE_COPY[lang];
  const dir: Dir = lang === 'he' ? 'rtl' : 'ltr', order = pageOrder(dir);
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [, setFrame] = useState(0);
  const redraw = () => setFrame(n => (n + 1) % 1_000_000);
  const [done, setDone] = useState(false);
  const [opened, setOpened] = useState(false);
  const [finale, setFinale] = useState(false);
  const [status, setStatus] = useState('');
  const [coach, setCoach] = useState<Coach>({ who: 'aya', mood: 'idle', line: w.coach.open });
  const [toast, setToast] = useState<string | null>(null);
  const [shot, setShot] = useState<PlayCamera>({ x: 0.5, y: 0.55, zoom: 1.14 });
  const [shake, bump] = useShake();
  const [fit, setFit] = useState<Fit>(firstFit);

  const book = useRef<BookState>(createBook(readings));
  const variant = useRef(readings);
  const position = useRef(0);
  const turn = useRef<TurnAnim | null>(null);
  const pageDrag = useRef<PageDrag | null>(null);
  /** The cover: 1 closed, 0 open; `at` is when it began to open. */
  const cover = useRef({ k: 1, at: null as number | null });
  const cam = useRef({ cx: PAGE_W * 1.5, scale: 0, rise: 0, ready: false });
  const tilt = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const boat = useRef({ x: BOAT_BANK.x, y: BOAT_BANK.y, lift: 0, anim: null as BoatAnim | null, dragging: false });
  /** Where the bank's boat is drawn now (the hint hand may be carrying it). */
  const boatShown = useRef({ x: BOAT_BANK.x, y: BOAT_BANK.y });
  const held = useRef(false);
  const gust = useRef<number | null>(null);
  const marks = useRef<Record<string, number>>({});
  const waiting = useRef<string | null>(null);
  const waitingQuay = useRef(false);
  const stamps = useRef({ launched: null as number | null, calm: null as number | null, dock: null as number | null, home: null as number | null, told: false, rainbow: null as number | null });
  const flourished = useRef([false, false, false, false]);
  const calmShown = useRef(0);
  const clock = useRef(0);
  const freeze = useRef(0);
  const rumbleAt = useRef(0);
  const rainLevel = useRef(-1);
  const routeUntil = useRef(0);
  const sprayAt = useRef(0);
  const pokes = useRef<Record<string, number>>({});
  const taps = useRef<Record<string, number>>({});
  const ripples = useRef<{ x: number; y: number; at: number }[]>([]);
  const landed = useRef({ spread: 0 as SpreadIndex, at: -99, pieces: 12 });
  const lively = useRef(0);
  const hint = useRef({ kind: null as Hint | null, start: -1, next: 0.9, shows: 0 });
  const lastInput = useRef(-99);
  const closing = useRef<number | null>(null);
  const quietClick = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<BoatAudio | null>(null);
  const sound = useRef<PlaySound | null>(null);
  const fx = useRef<PlayFxHandle>(null);
  const world = useRef<HTMLDivElement>(null);
  const bookEl = useRef<HTMLDivElement>(null);
  const live = useRef({ dir, reduced, w, fit });
  live.current = { dir, reduced, w, fit };

  const say = (text: string) => setStatus(text);
  /** The stage's own camera: a touch closer in play on a wide screen, all the way out for a page turn. */
  const frame = (close: boolean) => setShot({ x: 0.5, y: 0.52, zoom: close && !live.current.fit.portrait && !live.current.reduced ? 1.05 : 1 });
  const tell = (who: CoachWho, mood: CoachMood, text: string) => { setCoach(old => (old.who === who && old.mood === mood && old.line === text ? old : { who, mood, line: text })); say(text); };
  const host = (spread: SpreadIndex) => HOSTS[spread];
  const touch = () => { lastInput.current = clock.current; if (hint.current.start >= 0) { hint.current.start = -1; hint.current.next = clock.current + HINT_REST; } };
  const buzz = () => { void selectionHaptic(); };
  const flash = (text: string) => {
    setToast(text); say(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { toastTimer.current = null; setToast(null); }, 1700);
  };

  /* ── where things are on the screen ────────────────────────────────────── */
  /** A point of the book, in the world's own px. */
  const project = (x: number, y: number, z = 0) => {
    const { w: width, base, view, side } = live.current.fit, mirror = live.current.dir === 'rtl';
    const p = projectBookPoint(x, y, mirror, z, view.tilt), c = cam.current, s = c.scale || view.wide;
    const pan = (c.cx - SPREAD_W / 2) * (mirror ? -1 : 1);
    return { left: (width + (mirror ? side : -side)) / 2 + (p.x - pan) * s, top: base - c.rise - (view.box.h - view.box.cy) * s + p.y * s };
  };
  /** A burst of particles at a point of the book. */
  const burst = (x: number, y: number, z: number, kind: FxKind, options?: FxOptions) => {
    const at = project(x, y, z), { w: width, h } = live.current.fit;
    fx.current?.burst(at.left / width, at.top / h, kind, options);
  };

  /* ── sound and words for each spread ───────────────────────────────────── */
  const enter = (spread: SpreadIndex) => {
    rainLevel.current = -1;
    const b = book.current, c = live.current.w.coach;
    sound.current?.ambience(spread === 2 && !b.storm.calmed ? PLAY_AMBIENCE.wind : spread === 3 ? PLAY_AMBIENCE.night : PLAY_AMBIENCE.water);
    if (spread === 1) audio.current?.lap();
    if (spread === 2) rumbleAt.current = clock.current + 2.2;
    if (spreadDone(b, spread)) tell(host(spread), 'happy', spread === 3 ? c.end : [c.streamDone, c.riverDone, c.calm][spread]);
    else tell(host(spread), 'curious', spread === 0 ? (b.launched ? c.afloat : c.launch) : [c.lanterns, c.rain, c.harbour][spread - 1]);
    if (typeof Image !== 'undefined') for (const src of spreadArt(spread + 1)) { const img = new Image(); img.src = src; }
  };
  /** A page change stops the hear-it voice and the old spread's sounds. */
  const leave = () => { kidHush(); audio.current?.stopAll(); rainLevel.current = -1; };

  /* ── turning ───────────────────────────────────────────────────────────── */
  const land = (spread: SpreadIndex) => {
    landed.current = { spread, at: clock.current, pieces: 16 };
    audio.current?.thup(); audio.current?.pops(4); buzz(); bump();
    burst(SPREAD_W / 2, PAGE_D * 0.5, 4, 'dust', { count: 12, spread: 1.6 });
    burst(SPREAD_W / 2, 40, 90, 'chip', { count: 6, tones: ['paper', 'white'] });
  };
  const settle = (spread: SpreadIndex) => {
    position.current = spread;
    const changed = book.current.spread !== spread;
    book.current = { ...book.current, spread };
    if (changed) {
      if (live.current.reduced) bookEl.current?.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      else land(spread);
      hint.current = { kind: null, start: -1, next: clock.current + 0.9, shows: 0 };
    }
    frame(true);
    enter(spread);
  };
  const animateTo = (target: SpreadIndex) => {
    const from = position.current;
    if (live.current.reduced) { turn.current = null; settle(target); redraw(); return; }
    turn.current = { from, to: target, start: now(), dur: Math.max(220, TURN_MS * Math.abs(target - from)), settle: target, glide: false };
  };
  const startTurn = (intent: TurnIntent) => {
    if (cover.current.k > 0 || turn.current || pageDrag.current?.moved || closing.current !== null || stamps.current.dock !== null && !stamps.current.told || !canTurn(book.current, intent)) return;
    touch(); leave(); audio.current?.swish(); sound.current?.pick(); buzz(); frame(false);
    animateTo((book.current.spread + (intent === 'next' ? 1 : -1)) as SpreadIndex);
  };
  /** The opening is over: the cover lifts and the first spread stands up. */
  const openBook = () => {
    if (cover.current.at !== null || cover.current.k <= 0) return;
    setOpened(true); setShot({ x: 0.5, y: 0.5, zoom: 1 });
    audio.current?.swish(); audio.current?.creak(); sound.current?.ambience(PLAY_AMBIENCE.water); buzz();
    if (live.current.reduced) { cover.current = { k: 0, at: clock.current }; enter(0); redraw(); return; }
    cover.current.at = clock.current;
  };
  /** The end: the book closes itself, then the Studio takes over. */
  const finish = () => {
    if (!canFinish(book.current) || turn.current || closing.current !== null) return;
    touch(); leave(); sound.current?.stop(); buzz();
    if (live.current.reduced) { setDone(true); return; }
    audio.current?.swish(); audio.current?.close();
    closing.current = clock.current;
  };

  /** A finger anywhere on the book lifts the page: the point that was grabbed
   * stays under the finger. A tap on the bare page leaves a ring where it fell. */
  const pageDown = (event: ReactPointerEvent<HTMLElement>) => {
    touch();
    if (cover.current.k > 0 || turn.current || pageDrag.current || done || closing.current !== null) return;
    const box = world.current?.getBoundingClientRect(); if (!box) return;
    const zoom = box.width / Math.max(1, world.current?.offsetWidth ?? box.width), side = live.current.dir === 'rtl' ? -1 : 1;
    // Everything is kept in book px, from the spine: the camera may pull back while the page is in the hand.
    const fromSpine = (clientX: number) => ((clientX - box.left - project(SPREAD_W / 2, PAGE_D / 2).left * zoom) * side) / (cam.current.scale * zoom);
    const drag: PageDrag = { id: event.pointerId, intent: null, x: event.clientX, y: event.clientY, moved: false, fraction: 0, velocity: 0, at: now(), onToy: !!(event.target as Element).closest?.('[data-pb-toy]'), radius: PAGE_W, base: PAGE_W, off0: fromSpine(event.clientX) };
    pageDrag.current = drag;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dx) < 12) return;
        if (Math.abs(dy) > Math.abs(dx)) { stop(); return; }
        const wanted = swipeIntent(dx, live.current.dir, 12);
        if (!wanted || !canTurn(book.current, wanted) || (stamps.current.dock !== null && !stamps.current.told)) { stop(); return; }
        drag.intent = wanted; drag.fraction = wanted === 'back' ? 1 : 0;
        drag.radius = grabRadius(drag.off0, PAGE_W, wanted);
        // Grabbed on the turning page, the page starts where the finger is; elsewhere, at its edge.
        const onLeaf = wanted === 'next' ? drag.off0 : -drag.off0;
        drag.base = (wanted === 'next' ? 1 : -1) * (onLeaf > 0 ? Math.min(drag.radius, onLeaf) : drag.radius);
        drag.moved = true; quietClick.current = now(); leave(); audio.current?.swish(); buzz(); frame(false);
      }
      const fraction = leafFraction(drag.base + fromSpine(e.clientX) - drag.off0, drag.radius), t = now();
      const span = Math.max(0.008, (t - drag.at) / 1000);
      drag.velocity = drag.velocity * 0.6 + ((fraction - drag.fraction) / span) * 0.4;
      drag.fraction = fraction; drag.at = t; quietClick.current = t;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const { moved, intent: going, fraction, onToy } = drag;
      stop();
      if (!moved) { if (!onToy) pagePoke(e.clientX, e.clientY); return; }
      const lower = book.current.spread + (going === 'next' ? 0 : -1);
      // Stale speed is no flick: a page held still falls to its nearer side.
      const speed = now() - drag.at > 120 ? 0 : drag.velocity;
      const target = (lower + turnRelease(fraction, speed)) as SpreadIndex;
      if (live.current.reduced) { settle(target); redraw(); return; }
      const far = Math.abs(target - position.current);
      turn.current = { from: position.current, to: target, start: now(), dur: Math.min(700, 190 + 560 * far), settle: target, glide: true };
    };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (pageDrag.current === drag) pageDrag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const pagePoke = (clientX: number, clientY: number) => {
    const box = world.current?.getBoundingClientRect(); if (!box || book.current.spread !== Math.round(position.current)) return;
    const { w: width, base, view, side } = live.current.fit, zoom = box.width / Math.max(1, world.current?.offsetWidth ?? box.width), c = cam.current, mirror = live.current.dir === 'rtl';
    const sx = ((clientX - box.left) / zoom - (width + (mirror ? side : -side)) / 2) / c.scale + (c.cx - SPREAD_W / 2) * (mirror ? -1 : 1), sy = ((clientY - box.top) / zoom - (base - (view.box.h - view.box.cy) * c.scale)) / c.scale;
    const at = unprojectBookPoint(sx, sy, mirror, view.tilt);
    if (at.x < 4 || at.x > SPREAD_W - 4 || at.y < 4 || at.y > PAGE_D - 4) return;
    ripples.current = [...ripples.current.slice(-3), { x: at.x, y: at.y, at: clock.current }];
    lively.current = clock.current + 1;
    fx.current?.burst((clientX - box.left) / box.width, (clientY - box.top) / box.height, at.y > 126 && at.y < 262 ? 'drop' : 'dust', { count: 5, spread: 0.6, angle: -90, arc: 120 });
    audio.current?.poke(4 - Math.min(4, Math.floor(at.y / 64))); buzz(); redraw();
  };
  const poke = (toy: Toy) => {
    if (now() - quietClick.current < 260 || turn.current || closing.current !== null) return;
    touch();
    const t = clock.current, count = (taps.current[toy.id] ?? 0) + 1;
    pokes.current = { ...pokes.current, [toy.id]: t, ...(toy.wobble ? { [toy.wobble]: t } : {}) };
    taps.current = { ...taps.current, [toy.id]: count };
    lively.current = t + 3;
    if (toy.kind === 'bebe') routeUntil.current = t + 5;
    audio.current?.toy(toy.kind, toy.note ?? count - 1); sound.current?.tap(); buzz();
    burst(toy.x, toy.y, toy.z, toy.kind === 'cloud' || toy.kind === 'fountain' || toy.kind === 'lily' ? 'drop' : toy.kind === 'meadow' ? 'petal' : toy.kind === 'stone' ? 'dust' : 'glint', { count: toy.kind === 'meadow' ? 6 : 4, spread: 0.7 });
    // The secret: tap every cloud and, once the rain is over, a paper rainbow stands up.
    if (toy.kind === 'cloud') raiseRainbow();
    flash(w.toys[toy.kind][1]);
    redraw();
  };
  const raiseRainbow = () => {
    if (stamps.current.rainbow !== null || !book.current.storm.calmed) return;
    if (!['cloud-1', 'cloud-2', 'cloud-3'].every(id => (taps.current[id] ?? 0) > 0)) return;
    stamps.current.rainbow = clock.current; lively.current = clock.current + 3;
    audio.current?.home(); burst(SPREAD_W / 2, 62, 90, 'sparkle', { count: 18, tones: ['sun', 'sky', 'rose', 'white'] });
    tell('chock', 'wow', live.current.w.coach.rainbow);
  };

  /* ── spread one: the boat on the bank ──────────────────────────────────── */
  const launched = () => {
    book.current = { ...book.current, launched: true };
    stamps.current.launched = clock.current; lively.current = clock.current + 3;
    audio.current?.spray(); audio.current?.chime(0); sound.current?.place(0); buzz(); bump();
    burst(BOAT_STREAM.x, BOAT_STREAM.y, 4, 'drop', { count: 14, angle: -90, arc: 150 });
    burst(BOAT_STREAM.x, BOAT_STREAM.y, 2, 'ring', { size: 1.2 });
    tell('aya', 'happy', live.current.w.coach.afloat);
  };
  const launch = (fromX: number, fromY: number) => {
    const b = boat.current;
    if (book.current.launched || b.anim?.launch) return;
    touch(); sound.current?.pick();
    if (live.current.reduced) { b.x = BOAT_STREAM.x; b.y = BOAT_STREAM.y; launched(); redraw(); return; }
    b.anim = { fx: fromX, fy: fromY, tx: BOAT_STREAM.x, ty: BOAT_STREAM.y, start: now(), dur: 820, launch: true };
  };
  const boatDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    // A boat picked up while the hand was carrying it stays under the finger.
    const from = { x: boatShown.current.x - BOAT_BANK.x, y: boatShown.current.y - BOAT_BANK.y };
    touch(); buzz();
    if (book.current.launched || boat.current.anim || turn.current || book.current.spread !== 0 || cover.current.k > 0) return;
    const b = boat.current, sx = event.clientX, sy = event.clientY, id = event.pointerId;
    b.x = BOAT_BANK.x + from.x; b.y = BOAT_BANK.y + from.y;
    const mirror = live.current.dir === 'rtl', s = cam.current.scale, lean = Math.cos((live.current.fit.view.tilt * Math.PI) / 180);
    let moved = false, ox = from.x, oy = from.y;
    b.dragging = true; sound.current?.pick();
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = (e.clientX - sx) / s, dy = (e.clientY - sy) / s;
      if (Math.hypot(dx, dy) > 4) moved = true;
      ox = Math.max(-30, Math.min(BOAT_STREAM.x - BOAT_BANK.x + 40, from.x + (mirror ? -dx : dx))); oy = Math.max(BOAT_STREAM.y - BOAT_BANK.y - 20, Math.min(12, from.y + dy / lean));
      b.x = BOAT_BANK.x + ox; b.y = BOAT_BANK.y + oy; redraw();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      b.dragging = false;
      // A tap, or a pull towards the water, launches the boat; a little nudge lets it drift back.
      if (!moved || launchFromDrag(ox, -oy)) { launch(b.x, b.y); return; }
      sound.current?.back();
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
    if (Math.abs(next - before) > 1) learned.steer = true;
    book.current = setWheel(book.current, spread, next);
    redraw();
  };

  /* ── which first move the hand would show now ──────────────────────────── */
  const hintNow = (): Hint | null => {
    const b = book.current;
    if (done || cover.current.k > 0 || closing.current !== null || turn.current || pageDrag.current || boat.current.dragging || boat.current.anim || position.current !== b.spread) return null;
    if (spreadDone(b, b.spread)) return null;
    if (b.spread === 0) return !b.launched ? 'setSail' : learned.steer ? null : 'steer';
    if (b.spread === 2) return learned.steady ? null : 'steady';
    return learned.steer ? null : 'steer';
  };

  /* ── a course: the stones, the lanterns, the end of the page ───────────── */
  const sail = (spread: 0 | 1, river: RiverState, events: readonly RiverEvent[], before: RiverState) => {
    const words = live.current.w.coach, prefix = spread === 0 ? 's0-' : 's1-', who = host(spread), at = riverBoat(river);
    const lanterns = riverLanterns(river);
    const wasWaiting = waiting.current;
    waiting.current = events.includes('held') ? `${prefix}${lanterns[river.gates]?.id ?? ''}` : null;
    if (waiting.current !== null && wasWaiting === null) tell(who, 'curious', words.held);
    if (events.includes('bump')) {
      const lane = Math.round(before.pos);
      const stone = riverItems(river).find(item => item.kind === 'rock' && item.lane === lane && item.at > before.d && item.at <= river.d);
      if (stone) marks.current = { ...marks.current, [`${prefix}${stone.id}`]: clock.current };
      audio.current?.bump(); audio.current?.spray(); sound.current?.back(); buzz(); bump(); freeze.current = now() + 60;
      burst(at.x + 20, LANE_Y[lane] + 4, 6, 'drop', { count: 12, angle: -100, arc: 110, spread: 1.1 });
      tell(who, 'curious', words.bump);
    }
    if (events.includes('clear')) {
      sound.current?.place(river.clears - 1);
      burst(at.x, at.y, 20, 'glint', { count: 3 });
      if (river.clears >= 2) tell(who, 'happy', words.clear);
    }
    if (events.includes('reedGate')) {
      const rung = lanterns[river.gates - 1];
      if (rung) {
        marks.current = { ...marks.current, [`${prefix}${rung.id}`]: clock.current };
        burst(courseX(rung.at), LANE_Y[rung.lane] - 12, 40, 'sparkle', { count: 14, tones: ['sun', 'gold-light', 'white'] });
        burst(courseX(rung.at), LANE_Y[rung.lane] - 12, 40, 'ring', { tones: ['sun'] });
      }
      audio.current?.ring(river.gates - 1); sound.current?.place(river.gates + 1); buzz(); freeze.current = now() + 70;
      tell(who, 'happy', words.rung);
    }
    // a little spray off the bow now and then, while the boat is under way
    if (!live.current.reduced && river.d < RIVER_END && river.d > before.d && clock.current >= sprayAt.current) {
      sprayAt.current = clock.current + 0.5;
      const p = project(at.x + 34, at.y, 3), { w: width, h } = live.current.fit;
      fx.current?.trail(p.left / width, p.top / h, 'drop', { angle: -120, arc: 60 });
    }
  };
  /** A chapter is done: a flourish, a pip, and the page may turn. */
  const flourish = (spread: SpreadIndex) => {
    if (flourished.current[spread]) return;
    flourished.current[spread] = true;
    const words = live.current.w.coach;
    sound.current?.chapter(); buzz(); lively.current = clock.current + 3;
    for (let i = 0; i < 5; i++) burst(50 + i * 100, 262, 16, 'petal', { count: 5, angle: -90, arc: 120, tones: ['blossom', 'lilac', 'sun', 'white'] });
    if (spread < 3) tell(host(spread), 'wow', [words.streamDone, words.riverDone, words.calm][spread]);
  };

  /* ── one frame of the book ─────────────────────────────────────────────── */
  const step = (t: number, dt: number) => {
    const { dir: d, reduced: still } = live.current, words = live.current.w.coach;
    clock.current += dt;
    let dirty = clock.current < lively.current || clock.current - landed.current.at < settleSeconds(landed.current.pieces);
    // the hint hand: once on arrival, then again after a quiet while
    const wanted = hintNow(), h = hint.current;
    if (wanted !== h.kind) hint.current = { kind: wanted, start: -1, next: clock.current + 1.4, shows: 0 };
    else if (wanted && h.start < 0 && clock.current >= h.next && clock.current - lastInput.current >= (h.shows ? HINT_REST : 1.4)) { h.start = clock.current; h.shows += 1; }
    else if (h.start >= 0 && clock.current - h.start > HINT_PLAY) { h.start = -1; h.next = clock.current + HINT_REST; dirty = true; }
    if (hint.current.start >= 0) dirty = true;
    // the cover
    const cv = cover.current;
    if (cv.k > 0) {
      if (cv.at === null) return dirty || !still;
      const k = clamp01(((clock.current - cv.at) * 1000) / OPEN_MS);
      cv.k = 1 - k;
      if (k >= 1) { cv.k = 0; land(0); frame(true); enter(0); }
      return true;
    }
    if (closing.current !== null) {
      if ((clock.current - closing.current) * 1000 >= CLOSE_MS + 420) { closing.current = null; setDone(true); }
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
        boat.current.x = anim.fx + (anim.tx - anim.fx) * e; boat.current.y = anim.fy + (anim.ty - anim.fy) * e; boat.current.lift = anim.launch ? Math.sin(Math.PI * k) * 16 : 0;
        if (k >= 1) { boat.current.anim = null; boat.current.lift = 0; if (anim.launch) launched(); }
        return true;
      }
      if (!b.launched) return dirty || !still;
      if (riverDone(b.stream)) { waiting.current = null; flourish(0); return dirty || !still; }
      const result = riverStep(b.stream, dt, laneForAngle(b.wheel[0], d));
      book.current = { ...b, stream: result.river };
      sail(0, result.river, result.events, b.stream);
      return true;
    }
    if (b.spread === 1) {
      if (riverDone(b.river)) { waiting.current = null; flourish(1); return dirty || !still; }
      const result = riverStep(b.river, dt, laneForAngle(b.wheel[1], d));
      book.current = { ...b, river: result.river };
      sail(1, result.river, result.events, b.river);
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
      const calm = stormCalm(result.storm);
      if (result.gust) {
        audio.current?.gust();
        for (let i = 0; i < 4; i++) burst(60 + i * 120, 150, 120, 'drop', { count: 6, angle: 110, arc: 30, spread: 1.4, tones: ['white', 'sky-pale'] });
        if (result.push) { tell('chock', 'curious', words.gust); bump(); }
      }
      if (result.push) gust.current = clampWheel(wheel + result.push);
      if (!wasCalm && !result.storm.calmed && calm > 0.3 && calm < 0.9 && result.storm.steady > b.storm.steady) tell('chock', 'idle', words.steadying);
      calmShown.current = still ? calm : calmShown.current + (calm - calmShown.current) * Math.min(1, dt * 1.6);
      if (!wasCalm && result.storm.calmed) {
        learned.steady = true; stamps.current.calm = clock.current; audio.current?.rain(0); audio.current?.chime(1); buzz();
        sound.current?.ambience(PLAY_AMBIENCE.water);
        burst(SPREAD_W / 2, 190, 6, 'glint', { count: 8, spread: 3 });
        flourish(2); raiseRainbow();
      }
      const rain = result.storm.calmed ? 0 : 1 - calmShown.current * 0.8;
      if (Math.abs(rain - rainLevel.current) > 0.05) { rainLevel.current = rain; audio.current?.rain(rain); }
      if (!result.storm.calmed && calm < 0.6 && clock.current >= rumbleAt.current) { audio.current?.rumble(); rumbleAt.current = clock.current + 7.5; }
      return true;
    }
    // home
    if (!b.harbour.docked) {
      const result = harbourStep(b.harbour, dt, laneForAngle(b.wheel[3], d));
      book.current = { ...b, harbour: result.harbour };
      if (result.held && !waitingQuay.current && clock.current - lastInput.current > 1.2) tell('gobgob', 'curious', words.quay);
      waitingQuay.current = result.held;
      if (result.docked) {
        stamps.current.dock = clock.current; waitingQuay.current = false; lively.current = clock.current + 12;
        audio.current?.bell(); sound.current?.setPiece(); buzz(); bump(); freeze.current = now() + 90;
        burst(QUAY_X, LANE_Y[0], 8, 'ring', { size: 1.4 }); burst(QUAY_X, LANE_Y[0], 8, 'drop', { count: 10, angle: -90, arc: 160 });
        tell('gobgob', 'wow', words.docked);
        const quay = project(QUAY_X - 40, 130, 40), { w: width, h: height } = live.current.fit;
        setFinale(true); setShot({ x: quay.left / width, y: quay.top / height, zoom: still ? 1 : 1.16 });
      }
      return true;
    }
    if (b.harbour.lamps < HARBOUR_LAMPS) {
      const lit = stamps.current.dock === null ? HARBOUR_LAMPS : lampsLit((clock.current - stamps.current.dock) * 1000);
      if (lit > b.harbour.lamps) {
        const spots = floatSpots(variant.current);
        for (let i = b.harbour.lamps; i < lit; i++) {
          audio.current?.lamp(i); sound.current?.place(i);
          burst(spots[i][0], spots[i][1], 16, 'glint', { count: 3, tones: ['sun', 'white'] });
          burst(spots[i][0], spots[i][1], 2, 'ring', { size: 0.7, tones: ['sun'] });
        }
        if (lit >= 3 && b.harbour.lamps < 3) setShot({ x: 0.5, y: 0.5, zoom: 1 });
        book.current = { ...b, harbour: { ...b.harbour, lamps: lit } };
        if (lit >= HARBOUR_LAMPS) {
          stamps.current.home = clock.current; audio.current?.home(); buzz(); say(live.current.w.homecoming);
          for (let i = 0; i < 5; i++) burst(60 + i * 95, 110, 110, 'sparkle', { count: 9, spread: 1.5, tones: ['sun', 'gold-light', 'white'] });
          burst(95, 62, 120, 'petal', { count: 14, spread: 1.6, tones: ['sun', 'spring', 'white'] });
        }
      }
      return true;
    }
    if (stamps.current.home !== null && !stamps.current.told) {
      if ((clock.current - stamps.current.home) * 1000 >= HOME_MS) { stamps.current.told = true; flourish(3); setFinale(false); tell('gobgob', 'happy', words.end); }
      return true;
    }
    return dirty || !still;
  };
  /** The camera: the whole book for a page turn and the homecoming, close on the boat in between. */
  const film = (dt: number) => {
    const { fit: f, reduced: still } = live.current, c = cam.current, b = book.current;
    const settled = !turn.current && !pageDrag.current?.moved && closing.current === null && bookScene(position.current).settled;
    let scale = f.view.near, focus = SPREAD_W / 2, free = false;
    if (cover.current.k > 0 && cover.current.at === null) { focus = PAGE_W * 1.5; free = true; scale = Math.max(f.view.wide, Math.min(f.view.near, f.w / (PAGE_W + 120))); }
    else if (closing.current !== null) { focus = PAGE_W * 0.5 + PAGE_W * (1 - clamp01(((clock.current - closing.current) * 1000) / CLOSE_MS)) * 0.5; scale = f.view.wide; free = true; }
    else if (cover.current.k > 0.2) scale = f.view.wide;
    else if (cover.current.k > 0) focus = BOAT_BANK.x + 60;
    else if (!settled || stamps.current.dock !== null) scale = f.view.wide;
    else if (b.spread === 0) focus = (b.launched ? riverBoat(b.stream).x : boatShown.current.x) + 46;
    else if (b.spread === 1) focus = riverBoat(b.river).x + 46;
    else if (b.spread === 2) focus = 112 + 280 * calmShown.current + 30;
    else focus = b.harbour.x + 50;
    const cx = free ? focus : viewCentre(focus, (f.w - f.side) / scale);
    // The closed book lies a little up the table, clear of the title under it.
    const rise = cover.current.k > 0 && cover.current.at === null ? Math.round(f.h * (f.portrait ? 0.1 : 0.17)) : 0;
    const before = c.cx + c.scale * 1000 + c.rise;
    if (!c.ready || still) { c.cx = cx; c.scale = scale; c.rise = rise; c.ready = true; }
    else { const k = Math.min(1, dt * 2.6); c.cx += (cx - c.cx) * k; c.scale += (scale - c.scale) * Math.min(1, dt * 3.2); c.rise += (rise - c.rise) * k; if (Math.abs(cx - c.cx) < 0.05) c.cx = cx; if (Math.abs(scale - c.scale) < 0.0005) c.scale = scale; if (Math.abs(rise - c.rise) < 0.3) c.rise = rise; }
    const tl = tilt.current;
    if (still) { tl.x = 0; tl.y = 0; } else { tl.x += (tl.tx - tl.x) * Math.min(1, dt * 5); tl.y += (tl.ty - tl.y) * Math.min(1, dt * 5); }
    return Math.abs(c.cx + c.scale * 1000 + c.rise - before) > 0.01 || Math.abs(tl.tx - tl.x) > 0.004 || Math.abs(tl.ty - tl.y) > 0.004;
  };
  const stepRef = useRef(step); stepRef.current = step;
  const filmRef = useRef(film); filmRef.current = film;

  useEffect(() => {
    const instance = createBoatAudio(); audio.current = instance;
    const play = createPlaySound({ key: 'C' }); sound.current = play;
    let raf = 0, last = now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      if (typeof document !== 'undefined' && document.hidden) return;
      // a hit-pause: the world holds still for a few frames on a big moment
      const moved = t < freeze.current ? false : stepRef.current(t, dt);
      if (filmRef.current(dt) || moved) redraw();
    };
    raf = requestAnimationFrame(loop);
    const visibility = () => { if (document.hidden) { instance.stopAll(); rainLevel.current = -1; } };
    document.addEventListener('visibilitychange', visibility);
    // parallax: the book answers the pointer, and a tilt where the device offers one freely
    const aim = (x: number, y: number) => { tilt.current.tx = Math.max(-1, Math.min(1, x)); tilt.current.ty = Math.max(-1, Math.min(1, y)); };
    const pointer = (event: PointerEvent) => { const box = world.current?.getBoundingClientRect(); if (box?.width) aim(((event.clientX - box.left) / box.width) * 2 - 1, ((event.clientY - box.top) / box.height) * 2 - 1); };
    const lean = (event: DeviceOrientationEvent) => { if (event.gamma != null && event.beta != null) aim(event.gamma / 24, (event.beta - 45) / 28); };
    const Orientation = (globalThis as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
    const tiltFree = !!Orientation && typeof Orientation.requestPermission !== 'function';
    window.addEventListener('pointermove', pointer, { passive: true });
    if (tiltFree) window.addEventListener('deviceorientation', lean, { passive: true });
    say(w.coach.open);
    const settleShot = setTimeout(() => setShot({ x: 0.5, y: 0.5, zoom: 1.04 }), 80);
    if (typeof Image !== 'undefined') for (const src of [...spreadArt(0), ...spreadArt(1)]) { const img = new Image(); img.src = src; }
    return () => {
      cancelAnimationFrame(raf); clearTimeout(settleShot); if (toastTimer.current) clearTimeout(toastTimer.current);
      document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pointermove', pointer); if (tiltFree) window.removeEventListener('deviceorientation', lean);
      instance.dispose(); play.dispose(); audio.current = null; sound.current = null; readings += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the book takes all the room the screen has ────────────────────────── */
  useLayoutEffect(() => {
    const node = world.current; if (!node) return;
    const measure = () => {
      const width = node.offsetWidth, h = node.offsetHeight; if (!width || !h) return;
      const portrait = h > width * 1.05, short = h < 440;
      const wheel = Math.round(short ? 126 : portrait ? Math.max(150, Math.min(196, width * 0.44)) : 188), wheelH = (wheel * WHEEL_BOX.h) / WHEEL_BOX.w;
      const top = portrait ? 72 : short ? 4 : 10, bottom = Math.round(short ? 14 : portrait ? wheelH + 30 : wheelH * 0.5 + 16);
      const side = short ? wheel + 2 * 56 + 40 : 0;
      const view = viewFit(width - side - 8, h - top - bottom);
      setFit(old => (old.w === width && old.h === h && old.wheel === wheel && Math.abs(old.view.near - view.near) < 0.002 && old.view.tilt === view.tilt ? old : { w: width, h, portrait, short, wheel, base: h - bottom, side, view }));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [done]);

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    touch();
    if ((event.target as HTMLElement).closest?.('[data-pb-wheel]')) return;
    const intent = keyIntent(event.key, dir);
    if (!intent) return;
    event.preventDefault();
    startTurn(intent);
  };
  const reset = () => {
    leave(); turn.current = null; pageDrag.current = null; closing.current = null; readings += 1; variant.current = readings;
    book.current = createBook(readings); position.current = 0; boat.current = { x: BOAT_BANK.x, y: BOAT_BANK.y, lift: 0, anim: null, dragging: false };
    cover.current = { k: 1, at: null }; cam.current.ready = false; marks.current = {}; waiting.current = null; waitingQuay.current = false; calmShown.current = 0; gust.current = null; held.current = false;
    stamps.current = { launched: null, calm: null, dock: null, home: null, told: false, rainbow: null }; flourished.current = [false, false, false, false]; pokes.current = {}; taps.current = {}; ripples.current = [];
    setDone(false); setOpened(false); setFinale(false); setShot({ x: 0.5, y: 0.5, zoom: 1.04 }); setCoach({ who: 'aya', mood: 'idle', line: w.coach.open }); say(w.coach.open);
  };

  /* ── render ────────────────────────────────────────────────────────────── */
  const b = book.current, t = clock.current, { view } = fit, { box } = view;
  if (!cam.current.ready) { cam.current.scale = Math.max(view.wide, Math.min(view.near, fit.w / (PAGE_W + 120))); cam.current.cx = PAGE_W * 1.5; cam.current.rise = Math.round(fit.h * (fit.portrait ? 0.1 : 0.17)); }
  const scale = cam.current.scale;
  const openK = 1 - cover.current.k, openE = ease(openK), covered = cover.current.k > 0;
  const closeK = closing.current === null ? 0 : ease(clamp01(((t - closing.current) * 1000) / CLOSE_MS));
  const closingNow = closing.current !== null;
  const settled = !covered && bookScene(position.current).settled && !turn.current && !pageDrag.current?.moved && !closingNow;
  const spread = b.spread, shownSpread = (settled ? spread : Math.round(position.current)) as SpreadIndex;
  const text = w.spreads[spread];
  const harbour = b.harbour;
  // the hand's showing, and what it carries with it
  const showing = hint.current.start >= 0 && settled ? hint.current.kind : null;
  const pose = showing ? hintPose((t - hint.current.start) / HINT_PLAY) : null;
  const travel = pose ? (reduced ? (pose.travel > 0.5 ? 1 : 0) : pose.travel) : 0;
  const carry = pose ? travel * pose.press : 0;
  const scene = bookScene(position.current);
  const course = spread === 0 ? b.stream : b.river, nextLantern = riverLanterns(course)[course.gates];
  const aim = settled && spread === 1 && nextLantern ? angleForLane(nextLantern.lane, dir) : settled && spread === 3 && !harbour.docked ? angleForLane(QUAY_LANE, dir) : null;
  const wheelSpread = shownSpread, wheelAngle = b.wheel[wheelSpread];
  const hintTurn = showing === 'steer' ? (aim !== null && Math.abs(aim - wheelAngle) >= 8 ? aim - wheelAngle : wheelAngle > 20 ? -60 : 60) : showing === 'steady' ? -wheelAngle : 0;
  const nudge = (showing === 'steer' || showing === 'steady') ? hintTurn * carry : 0;
  const home = stamps.current.home === null ? (harbour.lamps >= HARBOUR_LAMPS ? 9 : -1) : t - stamps.current.home;
  const homeDone = stamps.current.told || (harbour.lamps >= HARBOUR_LAMPS && stamps.current.home === null);
  const boatAt = showing === 'setSail' && !reduced && !b.launched ? { x: boat.current.x + (BOAT_STREAM.x - BOAT_BANK.x) * carry * 0.5, y: boat.current.y + (BOAT_STREAM.y - BOAT_BANK.y) * carry * 0.5 } : boat.current;
  boatShown.current = boatAt;
  const liveScene: Live = {
    time: t, reduced, mirror: order.mirror, uid, lang, words: w.spreads, pokes: pokes.current, taps: taps.current, ripples: ripples.current, variant: variant.current,
    boat0: { x: boatAt.x, y: boatAt.y, lift: boat.current.dragging ? 8 : boat.current.lift, afloat: !!boat.current.anim?.launch, hint: !b.launched && !boat.current.anim && settled && spread === 0 },
    launchedAt: b.launched ? stamps.current.launched ?? -9 : null,
    stream: b.stream, river: b.river, steer0: laneForAngle(b.wheel[0], dir), steer1: laneForAngle(b.wheel[1], dir), marks: marks.current, waiting: settled ? waiting.current : null, route: settled && (waiting.current !== null || t < routeUntil.current),
    calm: calmShown.current, calmAt: stamps.current.calm, wheel2: b.wheel[2], rainbowAt: stamps.current.rainbow,
    harbour, steer3: laneForAngle(b.wheel[3], dir), waitingQuay: settled && waitingQuay.current, dockAt: stamps.current.dock, home,
  };
  const steady = wheelSpread === 2 && Math.abs(wheelAngle) <= STORM_BAND;
  const valueText = wheelSpread === 2 ? (b.storm.calmed || steady ? w.steady : w.windy) : w.lanes[laneForAngle(wheelAngle, dir)];
  const playable = settled && !finale && !spreadDone(b, spread) && (spread !== 0 || b.launched) && (spread !== 3 || !harbour.docked);
  // The wheel is on the table from the first page; it wakes when the boat is afloat.
  const wheelOut = settled && !finale && !spreadDone(b, spread) && (spread !== 3 || !harbour.docked);
  const showNext = settled && canTurn(b, 'next');
  const showBack = settled && canTurn(b, 'back') && !finale && !wheelOut;
  const showEnd = settled && canFinish(b) && homeDone && !finale;
  const Forward = dir === 'rtl' ? ArrowLeft : ArrowRight, Backward = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const toys = settled && !finale ? toyTargets(spread, liveScene).map(toy => ({ toy, at: project(toy.x, toy.y, toy.z) })).sort((p, q) => p.toy.y - q.toy.y) : [];
  // An arriving spread's pieces stand only part of the way until its page has landed.
  const fold = (index: SpreadIndex) => (covered ? openE * ARRIVE : closingNow ? 1 - closeK : scene.progress[index] * (index === spread ? 1 : ARRIVE));
  const rise = (index: SpreadIndex) => (!covered && index === landed.current.spread && scene.settled ? t - landed.current.at : -1);
  const leafShade = scene.settled ? 0 : Math.sin(Math.PI * scene.fraction);
  const leafAngle = covered ? -180 * openE : closingNow ? -180 * closeK : scene.leafAngle;
  const leafK = covered ? openE : closingNow ? closeK : scene.fraction;
  const lifted = covered || closingNow || !scene.settled;
  // how much of the book is read: the page blocks under each side
  const readK = covered ? 0 : closingNow ? 1 : (position.current + 0.6) / 4.2;
  const pan = (cam.current.cx - SPREAD_W / 2) * (order.mirror ? -1 : 1);
  const bookTilt = view.tilt - tilt.current.y * 1.6, bookYaw = tilt.current.x * 2.4;
  // the hand
  let hand: { left: number; top: number } | null = null;
  if (showing && pose) {
    if (showing === 'setSail') { const from = project(BOAT_BANK.x, BOAT_BANK.y, 14), to = project(BOAT_STREAM.x, BOAT_STREAM.y, 14); hand = { left: from.left + (to.left - from.left) * travel, top: from.top + (to.top - from.top) * travel }; }
    else {
      const disc = world.current?.closest('[data-play-stage]')?.querySelector('[data-pb-wheel-disc]')?.getBoundingClientRect(), frame = world.current?.getBoundingClientRect();
      if (disc && frame) { const k = disc.width / WHEEL_BOX.w, a = ((wheelAngle + hintTurn * travel) * Math.PI) / 180, r = WHEEL_BOX.rim * 0.86 * k; hand = { left: disc.left - frame.left + WHEEL_BOX.cx * k + r * Math.sin(a), top: disc.top - frame.top + WHEEL_BOX.cy * k - r * Math.cos(a) }; }
    }
  }
  const half = (index: SpreadIndex, side: 'left' | 'right', settle = -1) => <SpreadHalf spread={index} side={side} progress={fold(index)} settle={settle} live={liveScene} />;
  const leafFront = covered ? null : closingNow ? 3 : scene.leafFront, leafBack = covered ? 0 : closingNow ? null : scene.leafBack;
  const coverFace = (front: boolean) => <span className="pb-cover" data-front={front}>
    <span className="pb-cover__plate" style={{ transform: order.mirror ? 'scaleX(-1)' : undefined }}>
      {front && <span className="pb-cover__kicker" lang={lang}>{w.coverLine}</span>}
      <Boat uid={`${uid}-cover-${front ? 'f' : 'b'}`} className="pb-cover__boat" />
      {front && <span className="pb-cover__title" lang={lang}>{w.title}</span>}
    </span>
  </span>;
  const questIcons = [<Flower2 key="a" aria-hidden="true" />, <Lamp key="b" aria-hidden="true" />, <CloudRain key="c" aria-hidden="true" />, <Anchor key="d" aria-hidden="true" />];
  const vars = { ['--pb-wheel' as string]: `${fit.wheel}px`, ['--pb-grain' as string]: PAPER_GRAIN, ['--pb-ripple-light' as string]: WATER_LIGHT, ['--pb-ripple-deep' as string]: WATER_DEEP } as CSSProperties;

  const scenery = <div ref={world} className="pb" dir="ltr" data-pb-stage="" data-portrait={fit.portrait} onPointerDown={pageDown} style={vars}>
    <div className="pb-room" aria-hidden="true" data-play-depth="3"><img src={KIT_ROOM.src} alt="" draggable={false} decoding="async" /></div>
    <div className="pb-scaler" style={{ inlineSize: box.w, blockSize: box.h, bottom: fit.h - fit.base, transform: `translate(-50%, ${(-cam.current.rise).toFixed(1)}px) translateX(${(-pan * scale + (order.mirror ? fit.side : -fit.side) / 2).toFixed(2)}px) scale(${scale.toFixed(4)})` }}>
      <div className="pb-persp" style={{ left: box.cx - SPREAD_W / 2, top: box.cy - PAGE_D / 2, width: SPREAD_W, height: PAGE_D, perspective: BOOK_PERSPECTIVE }}>
        <div ref={bookEl} className="pb-book" data-mirror={order.mirror} data-pb-position={position.current.toFixed(3)} style={{ width: SPREAD_W, height: PAGE_D, transform: `rotateX(${bookTilt.toFixed(3)}deg) rotateY(${bookYaw.toFixed(3)}deg)${order.mirror ? ' scaleX(-1)' : ''}` }}>
          <span className="pb-tabletop" aria-hidden="true" style={{ backgroundImage: `url(${KIT_TABLE.src})` }} />
          <span className="pb-light" aria-hidden="true" />
          <span className="pb-under" aria-hidden="true" data-side={covered ? 'right' : closingNow ? 'left' : 'both'} />
          {!covered && <span className="pb-board pb-board--left" aria-hidden="true" />}
          {!closingNow && <span className="pb-board pb-board--right" aria-hidden="true" />}
          {!covered && <span className="pb-block pb-block--left" aria-hidden="true" style={{ height: 4 + 9 * readK }} />}
          {!closingNow && <span className="pb-block pb-block--right" aria-hidden="true" style={{ height: 4 + 9 * (1 - readK) }} />}
          {!covered && <div className="pb-page pb-page--left">
            {half(closingNow ? 3 : scene.staticLeft, 'left', rise(scene.staticLeft))}
            <span className="pb-page__shade" style={{ opacity: closingNow ? 0.4 * closeK : scene.settled ? 0 : 0.36 * clamp01(scene.fraction * 2 - 1) }} />
          </div>}
          {!closingNow && <div className="pb-page pb-page--right">
            {(!covered || cover.current.at !== null) && half(covered ? 0 : scene.staticRight, 'right', rise(scene.staticRight))}
            <span className="pb-page__shade" style={{ opacity: covered ? 0.5 * (1 - openE) : 0.4 * leafShade * (1 - scene.fraction) }} />
          </div>}
          {lifted && <div className="pb-leaf" style={{ width: PAGE_W, height: PAGE_D, transform: `translateZ(1.6px) rotateY(${leafAngle.toFixed(3)}deg)` }}>
            <div className="pb-face pb-face--front" style={{ visibility: leafK < 0.5 ? 'visible' : 'hidden' }}>
              {leafFront !== null ? half(leafFront as SpreadIndex, 'right') : coverFace(true)}
              <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * leafK * 2 }} />
              <span className="pb-sheen" style={{ opacity: 0.55 * Math.sin(Math.PI * clamp01(leafK * 2)), backgroundPosition: `${(120 - leafK * 260).toFixed(1)}% 0` }} />
            </div>
            <div className="pb-face pb-face--back" style={{ visibility: leafK >= 0.5 ? 'visible' : 'hidden' }}>
              {leafBack !== null ? half(leafBack as SpreadIndex, 'left') : coverFace(false)}
              <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * (1 - leafK) * 2 }} />
              <span className="pb-sheen" style={{ opacity: 0.55 * Math.sin(Math.PI * clamp01((1 - leafK) * 2)), backgroundPosition: `${(leafK * 260 - 140).toFixed(1)}% 0` }} />
            </div>
          </div>}
        </div>
      </div>
    </div>
    <PlayFx ref={fx} layer={3} />
    <div className="pb-overlay">
      {toys.map(({ toy, at }) => <button key={toy.id} type="button" className="pb-toy" data-pb-toy={toy.id} data-kind={toy.kind} style={{ left: at.left, top: at.top }} aria-label={w.toys[toy.kind][0]} onClick={() => poke(toy)} />)}
      {!b.launched && spread === 0 && settled && <button type="button" className="pb-toy pb-toy--boat" data-pb-boat-button="" style={project(boatAt.x, boatAt.y, 14)} aria-label={w.boatLaunch} onPointerDown={boatDown} onClick={event => { if (event.detail === 0) launch(boat.current.x, boat.current.y); }} />}
    </div>
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="paper-boat" title={w.title} instruction={w.instruction} hearIt={`${text[0]} ${text[1]}`}>
    {done
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="pb-root" data-adventure="paper-boat" data-spread={spread} data-settled={settled} data-pb-open={!covered} data-pb-rocks={b.stream.d >= RIVER_END} data-pb-lanterns={b.river.gates} data-pb-course={riverLanterns(b.river).map(item => item.lane).join(',')} data-pb-stream={riverItems(b.stream).filter(item => item.kind === 'rock').map(item => item.lane).join(',')} data-pb-calm={b.storm.calmed} data-pb-docked={b.harbour.docked} data-pb-launched={b.launched} data-pb-home={homeDone} data-pb-turnable={showNext} data-pb-finale={finale} data-pb-hint={showing ?? ''} dir={dir} onKeyDown={keyDown} aria-label={w.book}>
        <PlayStage id="paper-boat" grade={GRADES[shownSpread]} camera={shot} shake={shake} parallax world={scenery}>
          {!opened && <PlayOpening title={w.title} place={w.place} onDone={openBook} />}
          <HudCoach who={coach.who} mood={coach.mood} line={coach.line} onPoke={() => { touch(); sound.current?.tap(); buzz(); flash(w.toys[coach.who][1]); }} pokeLabel={w.crew[coach.who]} />
          <HudQuest label={w.quest} current={covered ? -1 : spread} steps={w.places.map((label, i) => ({ key: `s${i}`, label, done: spreadDone(b, i as SpreadIndex) && (i < 3 || homeDone), icon: questIcons[i] }))} />
          <HudToast show={toast !== null}>{toast}</HudToast>
          <HudDock align={fit.short ? 'end' : 'center'} label={w.wheel}>
            {/* The wheel is an object: its left button is on its left in both languages (the dock itself follows the page). */}
            {wheelOut && (dir === 'rtl' ? <HudButton label={w.steerRight} icon={<RotateCw aria-hidden="true" />} iconOnly disabled={!playable} onClick={() => turnWheel(wheelAngle + 30)} data={{ 'data-pb-steer': 'right' }} /> : <HudButton label={w.steerLeft} icon={<RotateCcw aria-hidden="true" />} iconOnly disabled={!playable} onClick={() => turnWheel(wheelAngle - 30)} data={{ 'data-pb-steer': 'left' }} />)}
            {wheelOut && <PaperWheel angle={wheelAngle} nudge={nudge} enabled={playable} tucked={!playable} marks={wheelSpread === 2 ? 'steadyBand' : 'lanes'} steady={steady || (wheelSpread === 2 && b.storm.calmed)} calm={calmShown.current} aim={aim} label={w.wheel} valueText={valueText} onTurn={turnWheel} onHold={value => { held.current = value; touch(); if (value) { gust.current = null; sound.current?.pick(); buzz(); } }} />}
            {wheelOut && (dir === 'rtl' ? <HudButton label={w.steerLeft} icon={<RotateCcw aria-hidden="true" />} iconOnly disabled={!playable} onClick={() => turnWheel(wheelAngle - 30)} data={{ 'data-pb-steer': 'left' }} /> : <HudButton label={w.steerRight} icon={<RotateCw aria-hidden="true" />} iconOnly disabled={!playable} onClick={() => turnWheel(wheelAngle + 30)} data={{ 'data-pb-steer': 'right' }} />)}
            {showBack && <HudButton label={w.back} icon={<Backward aria-hidden="true" />} iconOnly onClick={() => startTurn('back')} data={{ 'data-pb-turn': 'back' }} />}
            {showNext && <HudButton label={w.next} icon={<Forward aria-hidden="true" />} tone="go" size="l" cue onClick={() => startTurn('next')} data={{ 'data-pb-turn': 'next' }} />}
            {showEnd && <HudButton label={w.end} icon={<BookOpen aria-hidden="true" />} tone="go" size="l" cue onClick={finish} data={{ 'data-pb-turn': 'end' }} />}
          </HudDock>
          <PlaySetPiece active={finale} caption={harbour.lamps >= HARBOUR_LAMPS ? text[1] : undefined} />
          {hand && pose && <span className="pb-hand" aria-hidden="true" style={{ left: hand.left, top: hand.top, opacity: pose.show }}><HintHand press={pose.press} /></span>}
          <p className="pb-sr" role="status" aria-live="polite">{`${line(w.page, spread + 1, 4)}. ${status}`}</p>
        </PlayStage>
      </section>}
  </GameShell>;
}
