import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Camera, Clapperboard, Hand, Play, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  CAMERA_HOME, HudButton, HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, roundSeed, useReducedMotion, useShake,
  type CoachMood, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { CLAY_THEATRE_COPY } from './clayTheatreCopy';
import {
  CREW, FPS, GEL_IDS, GROUND, SHOTS, STEPS, STORIES, TUNES, TUNE_IDS, TWOS, PULL_ENOUGH,
  carriedPose, chaptersDone, chooseStory, clayLine, crewMood, directJobs, drawingAt, drawingPose, filmDone, filmFrames, frameOfKey, heroOf, keyNear, knead, lumpPose, movedEnough,
  newShow, nextAct, nextKnead, nextPull, placeBuddy, premiereAt, pressPrint, pull, pullAmount, setGel, setTune, shapeDone, shoot, showLook, stageLayout, startPose, storiesFor,
  toAnimate, toDirect, toPremiere, toPx, toSet, unshoot,
  type ClayId, type CrewId, type CrewMood, type GelId, type PremierePhase, type Show, type StageLayout, type StoryId, type TuneId,
} from './clayTheatreRules';
import { FULL_PULLS, HEROES, PULL_IDS, heroHit, posePoint, unposePoint, type Pose, type PullId, type Pulls } from './clayBody';
import { LUMP_BODY, type Pt } from './clayShapes';
import { mixRgb, paintClay, paintShadow, readPalette, type Palette, type RGB } from './clayPaint';
import { clayTone, filmView, paintGel, paintScene, type Scene, type View } from './clayScene';
import { createClayTicker } from './clayTicker';
import { GEL_SPOTS, KIT_CREW, KIT_GELS, KIT_LAMP, KIT_LENS, KIT_ROOM, KIT_RUG, KIT_TILES, LENS_SCREEN } from './clayKit';
import '../makerPalette.css';
import './clayTheatre.css';

type Phase = 'opening' | 'play' | 'done';
type Note = 'moveFirst' | 'alive' | 'film' | 'poke' | null;
interface Fly { key: number; clay: ClayId | null; from: Pt; to: Pt }
interface Spring { x: number; v: number }
interface Engine {
  time: number; drawing: number; dirty: boolean;
  pulls: Record<PullId, Spring>; dragPull: { id: PullId; amount: number } | null;
  press: { at: Pt; amount: number; down: boolean };
  tone: Record<'body' | 'trim', { from: RGB | null; id: ClayId | null; k: number }>;
  pose: Pose | null; draft: Pose | null; carrying: boolean; hop: Spring;
  look: Pt | null; lookUntil: number; blinkAt: number; presses: number[];
  film: { frame: number; playing: boolean; rest: number; shown: number };
  premiere: number | null; premiereKey: string; cache: { key: string; back: HTMLCanvasElement | null; front: HTMLCanvasElement | null };
  lastTick: number; dust: number;
}
/** This sitting only (never stored): how many shows have been made, so each replay opens differently. */
const sitting = { shows: 0 };
const freshEngine = (): Engine => ({
  time: 0, drawing: 0, dirty: true, pulls: { front: { x: 0, v: 0 }, back: { x: 0, v: 0 }, top: { x: 0, v: 0 } }, dragPull: null,
  press: { at: [0, 0], amount: 0, down: false }, tone: { body: { from: null, id: null, k: 1 }, trim: { from: null, id: null, k: 1 } },
  pose: null, draft: null, carrying: false, hop: { x: 0, v: 0 }, look: null, lookUntil: 0, blinkAt: 2.4, presses: [],
  film: { frame: 0, playing: false, rest: 0, shown: -1 }, premiere: null, premiereKey: '', cache: { key: '', back: null, front: null }, lastTick: 0, dust: 0,
});
const sizeCanvas = (canvas: HTMLCanvasElement, w: number, h: number): number => {
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1), pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  return dpr;
};
/** A damped spring toward `to`, stepped finely enough to stay steady when a frame runs long. Returns true while it still moves. */
function springTo(s: Spring, to: number, dt: number, stiffness: number, damping: number): boolean {
  if (Math.abs(to - s.x) < 0.002 && Math.abs(s.v) < 0.01) { if (s.x === to) return false; s.x = to; s.v = 0; return true; }
  const steps = Math.max(1, Math.ceil(dt / 0.006)), h = dt / steps;
  for (let i = 0; i < steps; i++) { s.v += ((to - s.x) * stiffness - s.v * damping) * h; s.x += s.v * h; }
  if (!Number.isFinite(s.x) || !Number.isFinite(s.v)) { s.x = to; s.v = 0; }
  return true;
}
const px = (v: number) => `${Math.round(v * 10) / 10}px`;
const boxStyle = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: px(b.x), top: px(b.y), width: px(b.w), height: px(b.h) });

export default function ClayTheatre() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en', rtl = lang === 'he';
  const w = CLAY_THEATRE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const reduced = useReducedMotion();
  const [seed] = useState(() => roundSeed() + sitting.shows++ * 7919);
  const look = useMemo(() => showLook(seed), [seed]);
  const offered = useMemo(() => storiesFor(seed), [seed]);
  const [show, setShowState] = useState<Show>(() => newShow(seed));
  const [phase, setPhase] = useState<Phase>('opening');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [camera, setCamera] = useState<PlayCamera>({ x: 0.5, y: 0.36, zoom: 1.45 });
  const [mood, setMood] = useState<CoachMood>('idle');
  const [note, setNote] = useState<Note>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [nod, setNod] = useState(0);
  const [flies, setFlies] = useState<readonly Fly[]>([]);
  const [woke, setWoke] = useState(false);
  const [frame, setFrame] = useState(0);
  const [draft, setDraftState] = useState<Pose | null>(null);
  const [prem, setPrem] = useState<{ phase: PremierePhase; moods: readonly CrewMood[] } | null>(null);
  const [peek, setPeek] = useState<StoryId | null>(null);
  const [shake, bump] = useShake();
  const [ticker] = useState(createClayTicker);
  const layout = useMemo(() => (size ? stageLayout(size.w, size.h) : null), [size]);

  const showRef = useRef(show), layoutRef = useRef<StageLayout | null>(layout), reducedRef = useRef(reduced), phaseRef = useRef(phase);
  const eng = useRef<Engine>(freshEngine()), pal = useRef<Palette | null>(null), dpr = useRef(1);
  const worldRef = useRef<HTMLDivElement | null>(null), canvasRef = useRef<HTMLCanvasElement | null>(null), viewRef = useRef<HTMLCanvasElement | null>(null), screenRef = useRef<HTMLCanvasElement | null>(null);
  const cellRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const fx = useRef<PlayFxHandle | null>(null), sound = useRef<PlaySound | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>()), mounted = useRef(true), keys = useRef(0), lastScrub = useRef(0);
  layoutRef.current = layout; reducedRef.current = reduced; phaseRef.current = phase;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timers.current.delete(id); if (mounted.current) fn(); }, ms);
    timers.current.add(id); return id;
  }, []);
  const commit = useCallback((next: Show) => { if (next !== showRef.current) { showRef.current = next; setShowState(next); eng.current.dirty = true; } return next; }, []);
  const setDraft = useCallback((pose: Pose | null) => { eng.current.draft = pose; eng.current.dirty = true; setDraftState(pose); }, []);
  const say = useCallback((next: Note, feel: CoachMood = 'idle', ms = 3200) => { setNote(next); setMood(feel); if (next) later(() => { setNote(n => (n === next ? null : n)); setMood('idle'); }, ms); }, [later]);
  const burst = useCallback((at: Pt, kind: Parameters<PlayFxHandle['burst']>[2], opts?: Parameters<PlayFxHandle['burst']>[3]) => { const L = layoutRef.current; if (L) fx.current?.burst(at[0] / L.w, at[1] / L.h, kind, opts); }, []);
  const heroPx = useCallback((): Pt => { const L = layoutRef.current, p = eng.current.pose; return L && p ? toPx(L, [p.x, p.y]) : [0, 0]; }, []);

  /* ── the room: size, palette, sound, clean-up ──────────────────────────── */
  useEffect(() => {
    mounted.current = true;
    const el = worldRef.current;
    const measure = () => { if (el && el.offsetWidth && el.offsetHeight) setSize(prev => (prev && prev.w === el.offsetWidth && prev.h === el.offsetHeight ? prev : { w: el.offsetWidth, h: el.offsetHeight })); };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    pal.current = readPalette(el ?? (typeof document !== 'undefined' ? document.documentElement : null));
    const instance = createPlaySound({ key: 'C' }); sound.current = instance;
    const pending = timers.current;
    return () => {
      mounted.current = false; observer?.disconnect();
      for (const id of pending) clearTimeout(id); pending.clear();
      ticker.dispose(); instance.dispose(); sound.current = null;
    };
  }, [ticker]);
  // The opening shot: the camera settles from the windows down onto the stage.
  useEffect(() => { const id = later(() => setCamera(CAMERA_HOME), 60); return () => { clearTimeout(id); timers.current.delete(id); }; }, [later]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && layout) { dpr.current = sizeCanvas(canvas, layout.w, layout.h); eng.current.cache.key = ''; eng.current.dirty = true; }
  }, [layout]);

  /* ── painting ──────────────────────────────────────────────────────────── */
  const sceneNow = (s: Show, e: Engine, palette: Palette, pose: Pose | null, extras: { ghosts?: boolean; drawing?: number } = {}): Scene | null => {
    if (!s.story) return null;
    const story = STORIES[s.story], tone = (part: 'body' | 'trim'): RGB => { const t = e.tone[part], to = clayTone(s[part], palette); return t.from && t.k < 1 ? mixRgb(t.from, to, Math.pow(t.k, 1.4)) : to; };
    const kneading = (['body', 'trim'] as const).find(part => e.tone[part].k < 1);
    const shown: Pulls = { front: e.pulls.front.x, back: e.pulls.back.x, top: e.pulls.top.x };
    const drawing = extras.drawing ?? e.drawing, filming = s.chapter === 'direct' || (s.chapter === 'animate' && filmDone(s)) || s.chapter === 'premiere';
    return {
      story: s.story, look, drawing, gel: s.gel,
      hero: pose ? {
        id: story.hero, body: tone('body'), trim: tone('trim'), pulls: s.chapter === 'shape' ? shown : FULL_PULLS, pose, prints: s.prints,
        press: e.press.amount > 0.02 ? { at: e.press.at, amount: e.press.amount } : null, look: e.look, blink: e.time > e.blinkAt && e.time < e.blinkAt + 0.16,
        marble: kneading ? { tone: clayTone(s[kneading], palette), amount: 1 - e.tone[kneading].k } : null, boil: reducedRef.current ? 0 : filming || e.carrying || e.press.down ? 1 : 0.55,
      } : null,
      ghosts: extras.ghosts && s.chapter === 'animate' && !filmDone(s) ? s.keys.slice(-2) : [],
      buddy: s.buddy ? { id: story.buddy, at: s.buddy.at, act: s.buddy.act, tone: clayTone(s.trim, palette), drawing } : null,
    };
  };
  const paint = () => {
    const canvas = canvasRef.current, L = layoutRef.current, palette = pal.current, s = showRef.current, e = eng.current;
    if (!canvas || !L || !palette) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    const k = dpr.current;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, L.w, L.h);
    if (!s.story || s.chapter === 'cans') return;
    const view: View = { unit: L.unit, ox: L.ox, oy: L.oy, cloth: L.cloth, detail: 1 };
    const filmDrawing = s.keys.length ? drawingAt(e.film.frame, s.keys.length) : 0, rolling = s.chapter === 'direct' || s.chapter === 'premiere' || (s.chapter === 'animate' && filmDone(s));
    const scene = sceneNow(s, e, palette, e.pose, { ghosts: true, drawing: rolling ? filmDrawing : e.drawing });
    if (!scene) return;
    // The cloth and the dressing stand still on the stage and are kept between drawings: only the cast is painted every time.
    const key = `${s.story}|${look.hour}|${L.w}x${L.h}x${k}`;
    const cache = e.cache;
    if (cache.key !== key && typeof document !== 'undefined') {
      for (const part of ['back', 'front'] as const) {
        const layer = cache[part] ?? (cache[part] = document.createElement('canvas')), pass = part === 'back' ? 'backPass' : 'frontPass';
        layer.width = canvas.width; layer.height = canvas.height;
        const lc = layer.getContext('2d');
        if (lc) { lc.setTransform(k, 0, 0, k, 0, 0); lc.clearRect(0, 0, L.w, L.h); paintScene(lc, view, { ...scene, drawing: 0 }, palette, pass); }
      }
      cache.key = key;
    }
    if (cache.back) ctx.drawImage(cache.back, 0, 0, L.w, L.h);
    paintScene(ctx, view, scene, palette, 'castPass');
    if (cache.front) ctx.drawImage(cache.front, 0, 0, L.w, L.h);
    paintGel(ctx, view, s.gel, palette);
  };
  /** A film frame painted into a small canvas: the camera's own screen, a cell of the strip, the premiere's screen. */
  const paintFrame = (canvas: HTMLCanvasElement | null, pose: Pose | null, detail: number, drawing: number) => {
    const palette = pal.current, s = showRef.current;
    if (!canvas || !palette || !s.story || !pose) return;
    const wCss = canvas.offsetWidth, hCss = canvas.offsetHeight; if (!wCss || !hCss) return;
    const k = sizeCanvas(canvas, wCss, hCss);
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, wCss, hCss);
    const scene = sceneNow(s, { ...eng.current, press: { at: [0, 0], amount: 0, down: false } }, palette, pose, { drawing });
    if (scene) paintScene(ctx, filmView({ x: 0, y: 0, w: wCss, h: hCss }, s.keys.length ? s.keys : [pose], detail), { ...scene, hero: scene.hero ? { ...scene.hero, pulls: FULL_PULLS, boil: reducedRef.current ? 0 : 1 } : null }, palette);
  };

  /* ── the one frame loop ────────────────────────────────────────────────── */
  const step = (dt: number) => {
    const e = eng.current, s = showRef.current, L = layoutRef.current, still = reducedRef.current;
    e.time += dt;
    // The film and the premiere keep real time even when a frame runs long.
    const clock = typeof performance !== 'undefined' ? performance.now() : 0, real = e.lastTick && clock ? Math.min(0.5, Math.max(0, (clock - e.lastTick) / 1000)) : dt;
    e.lastTick = clock;
    let dirty = e.dirty; e.dirty = false;
    const drawing = Math.floor(e.time * (FPS / TWOS));
    if (drawing !== e.drawing) {
      e.drawing = drawing;
      if (!still) dirty = true;
      if (s.chapter === 'animate' && !filmDone(s)) paintFrame(viewRef.current, e.draft ?? e.pose, 0.5, drawing);
      // Dust in the rotunda's light: one mote now and then, and more in the projector's beam.
      if (!still && L && e.time > e.dust) { e.dust = e.time + (e.premiere != null ? 0.18 : 1.5); const inBeam = e.premiere != null; fx.current?.trail(inBeam ? 0.3 + Math.random() * 0.4 : 0.55 + Math.random() * 0.4, inBeam ? 0.25 + Math.random() * 0.5 : 0.12 + Math.random() * 0.4, 'dust', { tones: ['white', 'snow'], size: inBeam ? 0.5 : 0.7 }); }
    }
    if (e.time > e.blinkAt + 0.2) { e.blinkAt = e.time + 2.2 + Math.random() * 3; dirty = true; } else if (e.time > e.blinkAt && e.time < e.blinkAt + 0.2) dirty = true;
    if (e.look && e.time > e.lookUntil) { e.look = null; dirty = true; }
    for (const id of PULL_IDS) {
      const p = e.pulls[id], dragging = e.dragPull?.id === id, target = dragging ? e.dragPull!.amount : s.pulls[id];
      if (still || dragging) { if (p.x !== target) { p.x = target; p.v = 0; dirty = true; } }
      else if (springTo(p, target, dt, 210, 13)) dirty = true;
    }
    const pressTo = e.press.down ? 1 : 0;
    if (Math.abs(pressTo - e.press.amount) > 0.004) { e.press.amount = still ? pressTo : e.press.amount + (pressTo - e.press.amount) * Math.min(1, dt * (e.press.down ? 24 : 10)); dirty = true; }
    for (const part of ['body', 'trim'] as const) { const t = e.tone[part]; if (t.k < 1) { t.k = still ? 1 : Math.min(1, t.k + dt / 0.95); dirty = true; } }
    if (still) { if (e.hop.x !== 0 || e.hop.v !== 0) { e.hop.x = 0; e.hop.v = 0; dirty = true; } } else if (springTo(e.hop, 0, dt, 260, 11)) dirty = true;

    /* The film on the stage: it runs once when the sixth frame lands, and loops quietly while the scene is dressed. */
    const total = filmFrames(s.keys.length);
    if (e.film.playing && total > 0 && e.premiere == null) {
      if (e.film.rest > 0) { e.film.rest -= real; if (e.film.rest <= 0) e.film.frame = 0; }
      else {
        e.film.frame += real * FPS;
        if (e.film.frame >= total - 1) { e.film.frame = total - 1; if (s.chapter === 'direct' && !still) e.film.rest = 0.9; else e.film.playing = false; }
      }
    }
    if (e.premiere != null) {
      e.premiere += real;
      const moment = premiereAt(e.premiere, s.keys.length);
      // With motion reduced the film is shown as its six stills, one cut at a time.
      e.film.frame = still ? frameOfKey(keyNear(moment.frame, s.keys.length)) : moment.frame;
      const moods = CREW.map((_, i) => crewMood(i, moment, s.keys)), key = `${moment.phase}|${moods.join()}`;
      if (key !== e.premiereKey) { e.premiereKey = key; premiereBeat(moment.phase, e.premiereKey); setPrem({ phase: moment.phase, moods }); }
      const screen = screenRef.current;
      // The picture comes up with the beam and stays on the screen while the crew clap.
      if (screen) screen.style.opacity = moment.phase === 'dim' ? String(Math.min(1, moment.beam * 1.4)) : '1';
      if (moment.phase === 'over') { e.premiere = null; finish(); }
    }
    const shown = Math.floor(e.film.frame);
    if (shown !== e.film.shown) {
      const was = e.film.shown; e.film.shown = shown; dirty = true;
      if (drawingAt(shown, s.keys.length) !== drawingAt(Math.max(0, was), s.keys.length) || was < 0) {
        if (e.premiere != null) { paintFrame(screenRef.current, drawingPose(s.keys, drawingAt(shown, s.keys.length)), 1, drawingAt(shown, s.keys.length)); filmNote(shown, true); }
        else if (e.film.playing) filmNote(shown, false);
        setFrame(shown);
      }
    }

    /* Where the hero is: the lump on the stage, the pose being carried, or the film's own drawing. */
    let target: Pose | null = null, exact = false;
    if (s.story && s.chapter === 'shape') target = lumpPose({ ...s, pulls: { front: e.pulls.front.x, back: e.pulls.back.x, top: e.pulls.top.x } });
    else if (s.chapter === 'animate' && !filmDone(s)) target = e.draft ?? startPose(s);
    else if (s.keys.length) { target = drawingPose(s.keys, drawingAt(e.film.frame, s.keys.length)); exact = true; }
    if (target) {
      const lifted = { ...target, y: target.y + e.hop.x };
      if (!e.pose || exact || still) { if (!e.pose || e.pose.x !== lifted.x || e.pose.y !== lifted.y || e.pose.rot !== lifted.rot || e.pose.sx !== lifted.sx || e.pose.flip !== lifted.flip) dirty = true; e.pose = lifted; }
      else {
        const k = Math.min(1, dt * (e.carrying ? 30 : 12)), p = e.pose, far = Math.hypot(lifted.x - p.x, lifted.y - p.y);
        if (far > 0.05 || Math.abs(lifted.rot - p.rot) > 0.05 || Math.abs(lifted.sx - p.sx) > 0.002 || p.flip !== lifted.flip) {
          // The clay lags the hand and stretches toward it, then settles.
          const lag = e.carrying ? Math.min(0.12, far / 500) : 0;
          e.pose = { x: p.x + (lifted.x - p.x) * k, y: p.y + (lifted.y - p.y) * k, rot: p.rot + (lifted.rot - p.rot) * k, sx: p.sx + (lifted.sx + lag - p.sx) * k, sy: p.sy + (lifted.sy - lag * 0.6 - p.sy) * k, flip: lifted.flip };
          dirty = true;
        }
      }
    } else if (e.pose) { e.pose = null; dirty = true; }
    // Behind the premiere's screen nothing on the stage needs painting.
    if (dirty && !(e.premiere != null && e.premiereKey && !e.premiereKey.startsWith('dim'))) paint();
    return true;
  };
  const stepRef = useRef(step); stepRef.current = step;
  useEffect(() => ticker.add(dt => stepRef.current(dt)), [ticker]);

  /* ── sound and small answers ───────────────────────────────────────────── */
  const touch = () => { void selectionHaptic(); sound.current?.ambience(PLAY_AMBIENCE.hall); };
  const squelch = (deep = false) => sound.current?.breath({ tone: deep ? 420 : 760, gain: 0.03, length: 0.16 });
  const filmNote = (shown: number, loud: boolean) => {
    const s = showRef.current, perKey = STEPS * TWOS;
    if (shown % perKey !== 0) { if (loud && shown % TWOS === 0) sound.current?.breath({ tone: 3600, gain: 0.006, length: 0.03 }); return; }
    const tune = TUNES[s.tune ?? 'tuneA'], index = Math.round(shown / perKey) % tune.length;
    sound.current?.note(tune[index], { gain: loud ? 0.05 : 0.024, length: loud ? 0.7 : 0.4 });
    if (loud) sound.current?.note(Math.max(0, tune[index] - 5), { gain: 0.022, length: 0.9, at: 0.02 });
  };
  const premiereBeat = (next: PremierePhase, _key: string) => {
    if (next === 'roll') { sound.current?.breath({ tone: 2600, gain: 0.012, length: 0.6 }); }
    if (next === 'hold') sound.current?.note(12, { gain: 0.03, length: 0.5 });
    if (next === 'applause') {
      sound.current?.chapter();
      for (let i = 0; i < 26; i++) sound.current?.breath({ tone: 1500 + (i % 5) * 260, gain: 0.02 + (i % 3) * 0.006, length: 0.05, at: 0.08 * i + (i % 2) * 0.03 });
      if (!reducedRef.current) { bump(); for (let i = 0; i < 5; i++) later(() => fx.current?.burst(0.14 + 0.18 * i, 0.72, 'confetti', { count: 9, angle: -90, arc: 80, spread: 0.9 }), 120 * i); }
    }
  };
  const finish = () => { sound.current?.stop(); setPrem(null); setPhase('done'); };
  /** Outside the Studio (which remounts the game itself): a fresh show on the same stage. */
  const again = () => { eng.current = freshEngine(); commit(newShow(seed)); setDraft(null); setWoke(false); setFrame(0); setNote(null); setMood('idle'); setPhase('play'); };

  /* ── chapter 0: the film cans ──────────────────────────────────────────── */
  const pickCan = (story: StoryId) => {
    if (showRef.current.chapter !== 'cans') return;
    touch(); sound.current?.pick(); sound.current?.place(2);
    const next = commit(chooseStory(showRef.current, story)), L = layoutRef.current;
    eng.current.pose = null;
    if (L) burst([L.w / 2, L.oy + (GROUND - 40) * L.unit], 'dust', { count: 14, spread: 1.4 });
    setMood('happy'); later(() => setMood('idle'), 1200);
    return next;
  };

  /* ── chapter 1: shape and colour ───────────────────────────────────────── */
  const kneadIn = (clay: ClayId) => {
    const s = showRef.current, part = nextKnead(s), next = knead(s, clay);
    if (next === s) { sound.current?.back(); return; }
    const e = eng.current, palette = pal.current;
    if (palette) { const t = e.tone[part], shown = t.from && t.k < 1 ? mixRgb(t.from, clayTone(s[part], palette), t.k) : clayTone(s[part], palette); e.tone[part] = { from: shown, id: clay, k: 0 }; }
    commit(next); sound.current?.place(next.kneads); squelch(true);
    e.hop.v = -90; burst(heroPx(), 'chip', { tones: [palToken(clay)], count: 8, spread: 0.8 });
    afterShape(next);
  };
  const lumpTap = (clay: ClayId, el: HTMLElement | null) => {
    const s = showRef.current;
    if (s.chapter !== 'shape') return;
    touch(); sound.current?.pick();
    const L = layoutRef.current, world = worldRef.current;
    if (reducedRef.current || !L || !world || !el) { kneadIn(clay); return; }
    const box = el.getBoundingClientRect(), room = world.getBoundingClientRect(), scale = room.width / L.w || 1;
    const from: Pt = [(box.left + box.width / 2 - room.left) / scale, (box.top + box.height / 2 - room.top) / scale], key = ++keys.current;
    setFlies(list => [...list, { key, clay, from, to: heroPx() }]);
    later(() => { setFlies(list => list.filter(f => f.key !== key)); kneadIn(clay); }, 380);
  };
  const afterShape = (next: Show) => {
    if (!shapeDone(next) || woke) return;
    setWoke(true);
    later(() => {
      const e = eng.current; e.hop.v = -170; e.blinkAt = e.time + 0.25;
      sound.current?.chapter(); say('alive', 'wow', 4200); void hitPause(60);
      burst(heroPx(), 'sparkle', { count: 16, spread: 1.3 }); burst(heroPx(), 'ring');
      const L = layoutRef.current; if (L && !reducedRef.current) { const [hx, hy] = heroPx(); setCamera({ x: hx / L.w, y: hy / L.h, zoom: 1.16 }); later(() => setCamera(CAMERA_HOME), 1300); }
    }, 420);
  };
  const finishPull = (id: PullId) => {
    const s = showRef.current, next = pull(s, id);
    eng.current.dragPull = null;
    if (next === s) return;
    commit(next); sound.current?.place(3 + PULL_IDS.filter(p => next.pulls[p] >= 1).length); squelch();
    const L = layoutRef.current;
    if (L) { const spec = HEROES[heroOf(next)], pose = lumpPose(next), tip = posePoint(spec.id, pose, [spec.handles[id].at[0] + spec.handles[id].dir[0] * 50, spec.handles[id].at[1] + spec.handles[id].dir[1] * 50]); burst(toPx(L, tip), 'chip', { tones: [next.body ? palToken(next.body) : 'linen'], count: 6 }); }
    afterShape(next);
  };
  const pullGesture = useRef<{ id: PullId; x: number; y: number; dir: Pt; moved: boolean } | null>(null);
  const pullDown = (id: PullId, dir: Pt) => (ev: ReactPointerEvent<HTMLButtonElement>) => {
    if (showRef.current.pulls[id] >= 1) return;
    touch(); squelch();
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* synthetic */ }
    pullGesture.current = { id, x: ev.clientX, y: ev.clientY, dir, moved: false };
  };
  const pullMove = (ev: ReactPointerEvent<HTMLButtonElement>) => {
    const g = pullGesture.current, L = layoutRef.current, world = worldRef.current;
    if (!g || !L || !world) return;
    const scale = (world.getBoundingClientRect().width / L.w || 1) * L.unit, drag: Pt = [(ev.clientX - g.x) / scale, (ev.clientY - g.y) / scale];
    if (Math.hypot(drag[0], drag[1]) > 4) g.moved = true;
    const amount = pullAmount(g.dir, drag), len = Math.hypot(g.dir[0], g.dir[1]) || 1, reach = amount * 46 * L.unit;
    eng.current.dragPull = { id: g.id, amount };
    ev.currentTarget.style.translate = `${(g.dir[0] / len) * reach}px ${(g.dir[1] / len) * reach}px`;
    eng.current.look = toSet(L, pointerAt(ev)); eng.current.lookUntil = eng.current.time + 1.2;
  };
  const pullUp = (ev: ReactPointerEvent<HTMLButtonElement>) => {
    const g = pullGesture.current; pullGesture.current = null;
    ev.currentTarget.style.translate = '';
    if (!g) return;
    const amount = eng.current.dragPull?.amount ?? 0;
    if (!g.moved || amount >= PULL_ENOUGH) { finishPull(g.id); return; }
    // Not far enough: the clay eases back into the lump. Never a failure.
    const p = eng.current.pulls[g.id]; p.x = amount; p.v = 0; eng.current.dragPull = null; sound.current?.back();
  };

  /* ── the set under the finger ──────────────────────────────────────────── */
  const pointerAt = (ev: { clientX: number; clientY: number }): Pt => {
    const L = layoutRef.current, world = worldRef.current;
    if (!L || !world) return [0, 0];
    const room = world.getBoundingClientRect();
    return [((ev.clientX - room.left) / (room.width || 1)) * L.w, ((ev.clientY - room.top) / (room.height || 1)) * L.h];
  };
  const pressHero = (at: Pt) => {
    const s = showRef.current, e = eng.current, hero = heroOf(s);
    if (!e.pose) return;
    const local = unposePoint(hero, e.pose, at);
    e.press = { at: local, amount: e.press.amount, down: true };
    commit(pressPrint(s, local)); sound.current?.note(3 + (s.prints.length % 3) * 2, { gain: 0.04, length: 0.2 }); squelch(true);
    // The secret: three quick presses flatten the hero into a pancake that springs back.
    e.presses = [...e.presses.filter(t => e.time - t < 1.1), e.time];
    if (e.presses.length >= 3) { e.presses = []; e.hop.v = 230; setToast(w.secret); later(() => setToast(null), 2600); sound.current?.note(17, { gain: 0.04, length: 0.5 }); const L = layoutRef.current; if (L) burst(toPx(L, [e.pose.x, e.pose.y]), 'ring'); setMood('wow'); later(() => setMood('idle'), 1500); }
  };
  const gesture = useRef<{ kind: 'hero' | 'buddy' | 'press'; dx: number; dy: number; moved: boolean; x: number; y: number } | null>(null);
  const moveDraft = (x: number, y: number) => {
    const s = showRef.current, L = layoutRef.current, e = eng.current;
    if (!L) return;
    const hero = heroOf(s), last = s.keys[s.keys.length - 1] ?? null, base = e.draft ?? startPose(s);
    const pose = carriedPose(hero, last, x, y, L.field);
    e.draft = last ? pose : { ...pose, flip: base.flip }; e.dirty = true;
  };
  const setDown = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const s = showRef.current, L = layoutRef.current, e = eng.current;
    if (!L || phaseRef.current !== 'play' || !s.story) return;
    touch();
    const at = pointerAt(ev), p = toSet(L, at), hero = heroOf(s);
    e.look = p; e.lookUntil = e.time + 2;
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* synthetic */ }
    const onHero = !!e.pose && heroHit(hero, s.chapter === 'shape' ? { front: e.pulls.front.x, back: e.pulls.back.x, top: e.pulls.top.x } : FULL_PULLS, e.pose, p);
    if (s.chapter === 'animate' && !filmDone(s)) {
      const from = e.draft ?? startPose(s);
      if (onHero) { gesture.current = { kind: 'hero', dx: from.x - p[0], dy: from.y - p[1], moved: false, x: at[0], y: at[1] }; e.carrying = true; sound.current?.pick(); }
      else { moveDraft(p[0], p[1]); setDraftState(e.draft); sound.current?.tap(); burst(at, 'ring', { size: 0.5 }); }
      return;
    }
    if (s.chapter === 'direct' && s.buddy && Math.hypot(p[0] - s.buddy.at[0], p[1] - s.buddy.at[1]) < 40) { gesture.current = { kind: 'buddy', dx: s.buddy.at[0] - p[0], dy: s.buddy.at[1] - p[1], moved: false, x: at[0], y: at[1] }; sound.current?.pick(); return; }
    if (onHero) { gesture.current = { kind: 'press', dx: 0, dy: 0, moved: false, x: at[0], y: at[1] }; pressHero(p); return; }
    sound.current?.tap(); burst(at, 'dust', { count: 4, size: 0.6 });
  };
  const setMove = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current, L = layoutRef.current, e = eng.current;
    if (!L) return;
    const at = pointerAt(ev), p = toSet(L, at);
    e.look = p; e.lookUntil = e.time + 1.6;
    if (!g) return;
    if (Math.hypot(at[0] - g.x, at[1] - g.y) > 6) g.moved = true;
    if (g.kind === 'hero') { moveDraft(p[0] + g.dx, p[1] + g.dy); if (g.moved && !reducedRef.current) fx.current?.trail(at[0] / L.w, at[1] / L.h, 'sparkle', { size: 0.5, tones: ['white', 'butter'] }); }
    else if (g.kind === 'buddy' && g.moved) commit(placeBuddy(showRef.current, [p[0] + g.dx, p[1] + g.dy], L.field));
  };
  const setUp = () => {
    const g = gesture.current, e = eng.current; gesture.current = null;
    e.press.down = false; e.dirty = true;
    if (!g) return;
    if (g.kind === 'hero') { e.carrying = false; setDraftState(e.draft); sound.current?.tap(); e.hop.v = 50; burst(heroPx(), 'dust', { count: 5, size: 0.7 }); }
    if (g.kind === 'buddy') { if (g.moved) sound.current?.place(4); else changeAct(); }
  };
  const heroKey = (ev: ReactKeyboardEvent<HTMLButtonElement>) => {
    const s = showRef.current, step8 = ev.shiftKey ? 30 : 12;
    const move = ev.key === 'ArrowLeft' ? [-step8, 0] : ev.key === 'ArrowRight' ? [step8, 0] : ev.key === 'ArrowUp' ? [0, -step8] : ev.key === 'ArrowDown' ? [0, step8] : null;
    if (!move || s.chapter !== 'animate' || filmDone(s)) return;
    ev.preventDefault();
    const from = eng.current.draft ?? startPose(s);
    moveDraft(from.x + move[0], from.y + move[1]); setDraftState(eng.current.draft); sound.current?.tap();
  };
  const heroClick = () => { const e = eng.current; if (!e.pose) return; touch(); pressHero([e.pose.x, e.pose.y]); later(() => { eng.current.press.down = false; eng.current.dirty = true; }, 180); };

  /* ── chapter 2: animate ────────────────────────────────────────────────── */
  const beginAnimate = () => {
    const next = commit(toAnimate(showRef.current));
    if (next.chapter !== 'animate') return;
    touch(); sound.current?.pick(); setDraft(startPose(next)); setNote(null); setMood('curious'); later(() => setMood('idle'), 1500);
  };
  const cellPx = (index: number): Pt => { const L = layoutRef.current; if (!L) return [0, 0]; const inner = L.strip.w - L.strip.h * 0.9 - 14, cw = inner / SHOTS; return [L.strip.x + 7 + cw * (index + 0.5), L.strip.y + L.strip.h / 2]; };
  const takeShot = () => {
    const s = showRef.current, e = eng.current;
    if (s.chapter !== 'animate' || filmDone(s)) return;
    touch();
    const pose = e.draft ?? startPose(s), next = shoot(s, pose);
    if (next === s) { sound.current?.back(); say('moveFirst', 'curious'); setNod(n => n + 1); e.hop.v = -60; return; }
    commit(next);
    sound.current?.breath({ tone: 5200, gain: 0.05, length: 0.045 }); sound.current?.note(16, { gain: 0.03, length: 0.07 }); sound.current?.place(next.keys.length - 1);
    setFlash(n => n + 1); setNote(null);
    const L = layoutRef.current;
    if (L) { burst([L.lens.x + L.lens.w * 0.5, L.lens.y + L.lens.h * 0.3], 'glint', { count: 4 }); if (!reducedRef.current) { const key = ++keys.current; setFlies(list => [...list, { key, clay: null, from: toPx(L, [pose.x, pose.y]), to: cellPx(next.keys.length - 1) }]); later(() => setFlies(list => list.filter(f => f.key !== key)), 420); } }
    if (filmDone(next)) later(() => {
      const en = eng.current; en.film = { frame: 0, playing: !reducedRef.current, rest: 0, shown: -1 };
      sound.current?.chapter(); say('film', 'wow', 5200); bump(); void hitPause(70);
      const LL = layoutRef.current; if (LL) for (let i = 0; i < SHOTS; i++) later(() => burst(cellPx(i), 'sparkle', { count: 5, size: 0.7 }), i * 70);
    }, 520);
  };
  const undoShot = () => { const s = showRef.current, next = unshoot(s); if (next === s) return; touch(); commit(next); sound.current?.back(); eng.current.film = { frame: 0, playing: false, rest: 0, shown: -1 }; };
  const scrubTo = (to: number) => {
    const s = showRef.current, e = eng.current, total = filmFrames(s.keys.length);
    if (total <= 0) return;
    e.film.playing = false; e.film.rest = 0; e.film.frame = Math.max(0, Math.min(total - 1, to)); e.dirty = true;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (Math.floor(e.film.frame / TWOS) !== Math.floor(Math.max(0, e.film.shown) / TWOS) && now - lastScrub.current > 60) { lastScrub.current = now; sound.current?.tap(); }
  };
  const stripGesture = useRef(false);
  const stripAt = (ev: ReactPointerEvent<HTMLDivElement>) => {
    const s = showRef.current, box = ev.currentTarget.getBoundingClientRect();
    scrubTo(((ev.clientX - box.left) / (box.width || 1)) * (filmFrames(s.keys.length) - 1));
  };
  const stripKey = (ev: ReactKeyboardEvent<HTMLDivElement>) => {
    const by = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? TWOS : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -TWOS : ev.key === 'Home' ? -9999 : ev.key === 'End' ? 9999 : 0;
    if (!by) return;
    ev.preventDefault(); scrubTo(Math.floor(eng.current.film.frame) + by);
  };
  const crank = useRef<{ angle: number } | null>(null);
  const crankAngle = (ev: ReactPointerEvent<HTMLButtonElement>) => { const box = ev.currentTarget.getBoundingClientRect(); return Math.atan2(ev.clientY - (box.top + box.height / 2), ev.clientX - (box.left + box.width / 2)); };
  const crankMove = (ev: ReactPointerEvent<HTMLButtonElement>) => {
    const c = crank.current; if (!c) return;
    const a = crankAngle(ev); let d = a - c.angle; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.02) return;
    c.angle = a; crankMoved.current = true; scrubTo(eng.current.film.frame + (d / (Math.PI * 2)) * FPS * 1.5);
  };
  const crankMoved = useRef(false);
  const playFilm = () => { const s = showRef.current; if (!s.keys.length) return; touch(); sound.current?.pick(); eng.current.film = { frame: 0, playing: true, rest: 0, shown: -1 }; };

  /* ── chapter 3: direct ─────────────────────────────────────────────────── */
  const beginDirect = () => {
    const next = commit(toDirect(showRef.current));
    if (next.chapter !== 'direct') return;
    touch(); sound.current?.pick(); setNote(null); eng.current.film = { frame: 0, playing: !reducedRef.current, rest: 0, shown: -1 };
  };
  const bringFriend = () => {
    const s = showRef.current, L = layoutRef.current;
    if (s.chapter !== 'direct' || s.buddy || !s.story || !L) return;
    touch();
    const next = commit(placeBuddy(s, STORIES[s.story].buddyHome, L.field));
    sound.current?.place(5); squelch(); if (next.buddy) { burst(toPx(L, next.buddy.at), 'sparkle', { count: 10 }); burst(toPx(L, next.buddy.at), 'ring'); }
    setMood('happy'); later(() => setMood('idle'), 1400);
  };
  const changeAct = () => { const next = commit(nextAct(showRef.current)), L = layoutRef.current; if (next.buddy) { sound.current?.note(8 + ['hopAct', 'spinAct', 'swayAct'].indexOf(next.buddy.act) * 2, { gain: 0.04, length: 0.3 }); if (L) burst(toPx(L, next.buddy.at), 'sparkle', { count: 5, size: 0.7 }); } };
  const pickGel = (gel: GelId) => { touch(); const next = commit(setGel(showRef.current, gel)); sound.current?.note(next.gel === 'clearGel' ? 4 : 6 + GEL_IDS.indexOf(gel) * 2, { gain: 0.045, length: 0.6 }); const L = layoutRef.current; if (L && next.gel !== 'clearGel') burst([L.lamp.x + L.lamp.w * 0.3, L.lamp.y + L.lamp.h * 0.2], 'glint', { tones: [gel === 'roseGel' ? 'rose' : gel === 'blueGel' ? 'sky' : 'sun', 'white'], count: 5 }); };
  const pickTune = (tune: TuneId) => { touch(); commit(setTune(showRef.current, tune)); TUNES[tune].forEach((stepNote, i) => sound.current?.note(stepNote, { gain: 0.04, length: 0.34, at: i * 0.15 })); };
  const beginPremiere = () => {
    const next = commit(toPremiere(showRef.current));
    if (next.chapter !== 'premiere') return;
    touch(); sound.current?.setPiece(); setNote(null);
    const e = eng.current; e.film = { frame: 0, playing: false, rest: 0, shown: -1 }; e.premiere = 0; e.premiereKey = '';
    setPrem({ phase: 'dim', moods: CREW.map(() => 'watching') });
  };
  const skipPremiere = () => { const e = eng.current, s = showRef.current; if (e.premiere == null) return; const frames = filmFrames(s.keys.length) / FPS; e.premiere = Math.max(e.premiere, 1.6 + frames * 2 + 0.7 + 0.7); };
  useEffect(() => {
    // The camera pushes in for the second showing and comes back for the applause.
    if (!prem || !layout || reduced) { if (!prem && phase === 'play') setCamera(CAMERA_HOME); return; }
    const focus = { x: (layout.screen.x + layout.screen.w / 2) / layout.w, y: (layout.screen.y + layout.screen.h * 0.7) / layout.h };
    setCamera(prem.phase === 'encore' || prem.phase === 'hold' ? { ...focus, zoom: layout.portrait ? 1.07 : 1.2 } : prem.phase === 'roll' || prem.phase === 'dim' ? { ...focus, zoom: 1.03 } : CAMERA_HOME);
  }, [prem?.phase, layout, reduced, phase]);

  // The strip's cells: each frame the child shot, painted once and again whenever the film's look changes.
  useEffect(() => {
    show.keys.forEach((pose, i) => paintFrame(cellRefs.current[i], pose, 0.4, i * STEPS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show.keys, show.gel, show.buddy, show.body, show.trim, layout, show.chapter]);

  /* ── what is on screen ─────────────────────────────────────────────────── */
  const chapter = show.chapter, story = show.story ? STORIES[show.story] : null, done = chaptersDone(show);
  const premiering = chapter === 'premiere' && phase === 'play';
  const filmed = filmDone(show), jobs = directJobs(show);
  const lineKey: keyof typeof w.coach = phase === 'opening' ? 'welcome' : note ? note : chapter === 'cans' ? 'cans'
    : chapter === 'shape' ? (!show.body ? 'body' : !show.trim ? 'trim' : !shapeDone(show) ? 'pull' : 'alive')
      : chapter === 'animate' ? (filmed ? 'film' : show.keys.length === 0 ? 'first' : show.keys.length >= SHOTS - 2 ? 'nearly' : 'moveIt')
        : !jobs.friend ? 'friend' : !jobs.light ? 'light' : !jobs.tune ? 'tune' : 'ready';
  const line = chapter === 'cans' && phase === 'play' && peek ? w.stories[peek] : w.coach[lineKey];
  const premiereCaption = prem ? (prem.phase === 'dim' ? w.captions.dim : prem.phase === 'roll' ? w.captions.roll : prem.phase === 'hold' || prem.phase === 'encore' ? w.captions.encore : w.captions.applause) : undefined;
  const questIndex = chapter === 'shape' || chapter === 'cans' ? 0 : chapter === 'animate' ? 1 : chapter === 'direct' ? 2 : 3;
  const total = filmFrames(show.keys.length), nowKey = show.keys.length ? keyNear(frame, show.keys.length) : -1;
  const heroBox = layout && story && (chapter === 'shape' ? lumpPose(show) : draft ?? (chapter === 'animate' ? startPose(show) : null));
  const handles = layout && story && chapter === 'shape' ? PULL_IDS.filter(id => show.pulls[id] < 1).map(id => {
    const spec = HEROES[story.hero], pose = lumpPose(show), h = spec.handles[id];
    const at = toPx(layout, posePoint(story.hero, pose, h.at)), tip = toPx(layout, posePoint(story.hero, pose, [h.at[0] + h.dir[0] * 40, h.at[1] + h.dir[1] * 40]));
    return { id, at, dir: [tip[0] - at[0], tip[1] - at[1]] as Pt };
  }) : [];
  const cue = nextPull(show);
  // The next thing to touch is marked: the clay until it has been moved, then the camera.
  const lastKey = show.keys[show.keys.length - 1], carryCue = chapter === 'animate' && !filmed && !!lastKey && !movedEnough(lastKey, draft ?? lastKey);

  return <GameShell fullBleed autoNarrate={false} worldId="clay-theatre" title={w.title} instruction={w.instruction} hearIt={line}>
    <section className="ct" data-adventure="clay-theatre" data-phase={phase} data-chapter={chapter} data-story={show.story ?? ''} data-keys={show.keys.length} data-frame={frame} data-premiere={prem?.phase ?? ''} dir={rtl ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={again} playAgainLabel={shared.again} homeLabel={shared.home} /> : <PlayStage id="clay-theatre" grade="day" camera={camera} shake={shake} parallax
        world={<div className="ct-world" dir="ltr" ref={worldRef} role="group" aria-label={w.stage} data-orient={layout?.portrait ? 'portrait' : 'landscape'}>
          {layout && <img className="ct-room" src={KIT_ROOM.src} alt="" draggable={false} decoding="async" style={boxStyle(layout.room)} data-play-depth="3" />}
          <span className="ct-shaft" aria-hidden="true" />
          <canvas className="ct-set" ref={canvasRef} aria-hidden="true" data-hidden={chapter === 'cans' || (premiering && prem?.phase !== 'dim')} />
          <div className="ct-touch" data-set="" onPointerDown={setDown} onPointerMove={setMove} onPointerUp={setUp} onPointerCancel={setUp} />
          {layout && phase === 'play' && chapter === 'cans' && <div className="ct-cans" role="group" aria-label={w.cans} style={boxStyle(layout.cans)}>
            {offered.map((id, i) => <FilmCan key={id} story={id} index={i} label={clayLine(w.can, w.stories[id])} palette={pal.current} seed={seed} onPick={() => pickCan(id)} onPeek={on => setPeek(on ? id : p => (p === id ? null : p))} />)}
          </div>}
          {layout && story && chapter === 'shape' && <div className="ct-rug" style={boxStyle(layout.rug)} role="group" aria-label={w.lumps} data-away={shapeDone(show) && woke} data-cue={!show.body || !show.trim}>
            <img className="ct-rug__mat" src={KIT_RUG.src} alt="" draggable={false} decoding="async" />
            <div className="ct-rug__lumps">
              {look.lumps.map((id, i) => <button type="button" key={id} className="ct-lump" data-lump={id} data-used={show.body === id || show.trim === id} aria-label={clayLine(w.lump, w.clays[id])} style={{ '--i': i } as CSSProperties}
                onClick={ev => lumpTap(id, ev.currentTarget)}><LumpArt clay={id} palette={pal.current} seed={i * 5 + 3} /></button>)}
            </div>
          </div>}
          {handles.map(h => <button type="button" key={h.id} className="ct-pull" data-pull={h.id} data-cue={cue === h.id && !!show.body} aria-label={w.pulls[h.id]} style={{ left: px(h.at[0]), top: px(h.at[1]), '--dx': px(h.dir[0]), '--dy': px(h.dir[1]) } as CSSProperties}
            onPointerDown={pullDown(h.id, h.dir)}
            onPointerMove={pullMove} onPointerUp={pullUp} onPointerCancel={pullUp} onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); touch(); finishPull(h.id); } }}><i aria-hidden="true" /></button>)}
          {layout && heroBox && (chapter === 'shape' || (chapter === 'animate' && !filmed)) && <button type="button" className="ct-hero" data-hero="" data-cue={carryCue} aria-label={w.hero} onKeyDown={heroKey} onClick={heroClick}
            style={{ left: px(layout.ox + heroBox.x * layout.unit), top: px(layout.oy + heroBox.y * layout.unit), width: px(150 * layout.unit), height: px(96 * layout.unit) }} />}
          {layout && story && (chapter === 'animate' || chapter === 'direct') && <div className="ct-strip" style={boxStyle(layout.strip)} data-live={filmed}>
            <div className="ct-strip__film" role="slider" tabIndex={filmed ? 0 : -1} aria-label={w.strip} aria-valuemin={1} aria-valuemax={Math.max(1, total)} aria-valuenow={Math.min(Math.max(1, total), frame + 1)}
              aria-valuetext={show.keys.length ? clayLine(w.frame, nowKey + 1, show.keys.length) : w.noFrames} aria-disabled={!filmed} data-strip="" onKeyDown={stripKey}
              onPointerDown={ev => { if (!filmed) return; touch(); stripGesture.current = true; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* synthetic */ } stripAt(ev); }}
              onPointerMove={ev => { if (stripGesture.current) stripAt(ev); }} onPointerUp={() => { stripGesture.current = false; }} onPointerCancel={() => { stripGesture.current = false; }}>
              {Array.from({ length: SHOTS }, (_, i) => <span key={i} className="ct-cell" data-shot={i < show.keys.length} data-now={filmed && i === nowKey} data-next={!filmed && i === show.keys.length}>
                <canvas ref={el => { cellRefs.current[i] = el; }} aria-hidden="true" />
              </span>)}
              {filmed && total > 1 && <span className="ct-gate" aria-hidden="true" style={{ left: `${(frame / (total - 1)) * 100}%` }} />}
            </div>
            <button type="button" className="ct-crank" data-crank="" aria-label={w.crank} disabled={!filmed} style={{ '--turn': `${frame * 20}deg` } as CSSProperties}
              onPointerDown={ev => { if (!filmed) return; crankMoved.current = false; crank.current = { angle: crankAngle(ev) }; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* synthetic */ } }}
              onPointerMove={crankMove} onPointerUp={() => { crank.current = null; }} onPointerCancel={() => { crank.current = null; }} onClick={() => { if (!crankMoved.current) playFilm(); crankMoved.current = false; }}><i aria-hidden="true" /></button>
          </div>}
          {layout && chapter === 'animate' && <button type="button" className="ct-lens" data-lens="" data-nod={nod % 2 ? 'a' : nod ? 'b' : undefined} data-cue={!filmed && !carryCue} aria-label={w.lens} disabled={filmed} style={boxStyle(layout.lens)} onClick={takeShot}>
            <img src={KIT_LENS.src} alt="" draggable={false} decoding="async" />
            <span className="ct-lens__screen" style={{ left: `${LENS_SCREEN.left * 100}%`, top: `${LENS_SCREEN.top * 100}%`, width: `${LENS_SCREEN.width * 100}%`, height: `${LENS_SCREEN.height * 100}%` }}><canvas ref={viewRef} aria-label={w.lensView} /></span>
            <i className="ct-lens__shutter" aria-hidden="true" />
          </button>}
          {layout && story && chapter === 'direct' && <>
            <img className="ct-lamp" src={KIT_LAMP.src480} alt="" draggable={false} decoding="async" style={boxStyle(layout.lamp)} data-gel={show.gel} />
            <div className="ct-gels" role="group" aria-label={w.lamp} style={boxStyle(layout.gels)}>
              <img src={KIT_GELS.src480} alt="" draggable={false} decoding="async" />
              {GEL_IDS.map(id => <button type="button" key={id} className="ct-gel" data-gel={id} aria-pressed={show.gel === id} aria-label={w.gels[id]} style={{ left: `${GEL_SPOTS[id as keyof typeof GEL_SPOTS] * 100}%` }} onClick={() => pickGel(id)} />)}
            </div>
            <div className="ct-tiles" role="group" aria-label={w.tuneGroup} style={boxStyle(layout.tiles)}>
              {TUNE_IDS.map(id => <button type="button" key={id} className="ct-tile" data-tune={id} aria-pressed={show.tune === id} aria-label={w.tunes[id]} onClick={() => pickTune(id)}><img src={KIT_TILES[id].src} alt="" draggable={false} decoding="async" /></button>)}
            </div>
            {!show.buddy && <button type="button" className="ct-friend" data-friend="" data-cue="true" aria-label={clayLine(w.friendLump, w.friends[story.buddy])} style={boxStyle(layout.friend)} onClick={bringFriend}><LumpArt clay={show.trim ?? 'yellow'} palette={pal.current} seed={41} /></button>}
            {show.buddy && <button type="button" className="ct-buddy" data-buddy={show.buddy.act} aria-label={clayLine(w.friendOn, `${w.friends[story.buddy]}, ${w.acts[show.buddy.act]}`)} onClick={() => { touch(); changeAct(); }}
              style={{ left: px(layout.ox + show.buddy.at[0] * layout.unit), top: px(layout.oy + show.buddy.at[1] * layout.unit) }} />}
          </>}
          {layout && premiering && prem && <Premiere layout={layout} phase={prem.phase} moods={prem.moods} screenRef={screenRef} words={w} reduced={reduced} />}
          {flies.map(f => <span key={f.key} className="ct-fly" data-kind={f.clay ? 'lump' : 'frame'} aria-hidden="true" style={{ left: px(f.from[0]), top: px(f.from[1]), '--dx': px(f.to[0] - f.from[0]), '--dy': px(f.to[1] - f.from[1]) } as CSSProperties}>{f.clay && <LumpArt clay={f.clay} palette={pal.current} seed={9} />}</span>)}
          <PlayFx ref={fx} layer={7} />
          {flash > 0 && <span key={flash} className="ct-flash" aria-hidden="true" />}
        </div>}>
        {phase === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={() => { setPhase('play'); sound.current?.ambience(PLAY_AMBIENCE.hall); }} />}
        <HudCoach who="bebe" mood={mood} line={line} onPoke={() => { touch(); sound.current?.note(9, { gain: 0.04, length: 0.3 }); say('poke', 'happy'); }} pokeLabel={w.coach.pokeLabel} quiet={premiering} />
        <HudQuest label={w.quest.label} current={questIndex} steps={[
          { key: 'shape', label: w.quest.shape, done: done.shape, icon: <Hand aria-hidden="true" /> },
          { key: 'animate', label: w.quest.animate, done: done.animate, icon: <Camera aria-hidden="true" /> },
          { key: 'direct', label: w.quest.direct, done: done.direct, icon: <Clapperboard aria-hidden="true" /> },
        ]} />
        <HudToast show={!!toast}>{toast}</HudToast>
        <HudDock align={layout && !layout.portrait ? 'end' : 'center'}>
          {phase === 'play' && chapter === 'shape' && shapeDone(show) && woke && <HudButton label={w.next.animate} tone="go" size="l" cue icon={<Camera aria-hidden="true" />} onClick={beginAnimate} data={{ 'data-next': 'animate' }} />}
          {phase === 'play' && chapter === 'animate' && show.keys.length > 0 && !filmed && <HudButton label={w.undo} iconOnly icon={<Undo2 aria-hidden="true" />} onClick={undoShot} data={{ 'data-undo': '' }} />}
          {phase === 'play' && chapter === 'animate' && filmed && <HudButton label={w.next.direct} tone="go" size="l" cue icon={<Clapperboard aria-hidden="true" />} onClick={beginDirect} data={{ 'data-next': 'direct' }} />}
          {phase === 'play' && chapter === 'direct' && jobs.friend && <HudButton label={w.next.premiere} tone="go" size="l" cue={jobs.light && jobs.tune} icon={<Play aria-hidden="true" />} onClick={beginPremiere} data={{ 'data-next': 'premiere' }} />}
        </HudDock>
        <PlaySetPiece active={premiering} caption={layout?.portrait ? undefined : premiereCaption}>
          {/* On a tall stage the caption sits above the screen, clear of the crew. */}
          {layout?.portrait && premiereCaption && <p className="play-setpiece__caption ct-caption" aria-live="polite" key={premiereCaption}>{premiereCaption}</p>}
          {prem && prem.phase !== 'applause' && prem.phase !== 'over' && <button type="button" className="ct-skip" aria-label={w.skip} data-skip="" onClick={skipPremiere} />}
        </PlaySetPiece>
      </PlayStage>}
    </section>
  </GameShell>;
}

/** The palette token a lump's crumbs are thrown in (PlayFx names its tones by token). */
const palToken = (clay: ClayId): string => ({ red: 'poppy', orange: 'orange', yellow: 'amber', green: 'leaf', blue: 'water', purple: 'violet' } as const)[clay];

/** A hand-rolled lump of plasticine on its own small canvas, lit like the room. */
function LumpArt({ clay, palette, seed }: { clay: ClayId; palette: Palette | null; seed: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !palette) return;
    const wCss = canvas.offsetWidth || 64, hCss = canvas.offsetHeight || 56, k = sizeCanvas(canvas, wCss, hCss);
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, wCss, hCss);
    const unit = Math.min(wCss / 150, hCss / 118), turnBy = seed * 0.9, c = Math.cos(turnBy), s = Math.sin(turnBy);
    const points = LUMP_BODY.map(([x, y]) => [wCss / 2 + (x * c - y * s * 0.9) * unit, hCss * 0.5 + (x * s * 0.6 + y * c) * unit * 0.9] as Pt);
    paintShadow(ctx, wCss / 2 - 3, hCss * 0.86, wCss * 0.36, hCss * 0.1, palette, 0.38);
    paintClay(ctx, points, clayTone(clay, palette), palette, { seed: 300 + seed, drawing: 0, unit: unit * 1.1, detail: 1 });
  }, [clay, palette, seed]);
  return <canvas ref={ref} className="ct-lump__art" aria-hidden="true" />;
}

/** A film can standing on its edge: a steel tin whose paper label shows the film's hero, in clay. */
function FilmCan({ story, index, label, palette, seed, onPick, onPeek }: { story: StoryId; index: number; label: string; palette: Palette | null; seed: number; onPick: () => void; onPeek: (on: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !palette) return;
    const wCss = canvas.offsetWidth || 80, hCss = canvas.offsetHeight || 80, k = sizeCanvas(canvas, wCss, hCss);
    let ctx: CanvasRenderingContext2D | null = null;
    try { ctx = canvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) return;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, wCss, hCss);
    const spec = STORIES[story], show: Show = { ...newShow(seed), story, chapter: 'animate', pulls: FULL_PULLS, body: spec.clay[0], trim: spec.clay[1] }, base = startPose(show);
    const pose: Pose = { ...base, x: 200, y: base.y - (spec.hero === 'whale' ? 46 : spec.hero === 'rocket' ? 30 : 0), rot: spec.hero === 'whale' ? -18 : 0, flip: 1 };
    const scene: Scene = { story, look: { ...showLook(seed), hour: 0 }, drawing: 0, gel: 'clearGel', hero: { id: spec.hero, body: clayTone(spec.clay[0], palette), trim: clayTone(spec.clay[1], palette), pulls: FULL_PULLS, pose, boil: 0 } };
    const unit = wCss / 230;
    paintScene(ctx, { unit, ox: wCss / 2 - 200 * unit, oy: hCss * 0.62 - pose.y * unit, frame: { x: 0, y: 0, w: wCss, h: hCss }, detail: 0.7 }, scene, palette);
  }, [story, palette, seed]);
  return <button type="button" className="ct-can" data-can={story} aria-label={label} style={{ '--i': index } as CSSProperties} onClick={onPick} onPointerEnter={() => onPeek(true)} onPointerLeave={() => onPeek(false)} onFocus={() => onPeek(true)} onBlur={() => onPeek(false)}>
    <span className="ct-can__tin" aria-hidden="true" /><span className="ct-can__label" aria-hidden="true"><canvas ref={ref} /></span><span className="ct-can__glint" aria-hidden="true" />
  </button>;
}

/** The premiere: the rotunda goes dark, the screen comes down, the beam cuts
 * through the dust, and the crew (the kit's own back, side and front views)
 * watch, lean in, turn to each other and turn round to clap. */
function Premiere({ layout, phase, moods, screenRef, words, reduced }: { layout: StageLayout; phase: PremierePhase; moods: readonly CrewMood[]; screenRef: { current: HTMLCanvasElement | null }; words: typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he']; reduced: boolean }) {
  const lit = phase === 'applause' || phase === 'over', s = layout.screen, [bx, by] = layout.beamFrom;
  const beam = `${bx - 6},${by} ${s.x + s.w * 0.04},${s.y + s.h} ${s.x + s.w * 0.96},${s.y + s.h} ${bx + 6},${by}`;
  const order: readonly CrewId[] = ['aya', 'chock', 'bebe', 'gobgob', 'pep'], places = layout.portrait ? [-2.5, -1.62, -0.72, 0.78, 1.72] : [-2.65, -1.8, -0.95, 1, 1.9], slot = Math.min(layout.w / 5.3, layout.crewH * 0.62);
  return <div className="ct-premiere" data-phase={phase} data-lit={lit} data-reduced={reduced || undefined}>
    <span className="ct-dark" aria-hidden="true" />
    <span className="ct-screen" style={boxStyle(s)} role="img" aria-label={words.screen}><canvas ref={screenRef} /><i aria-hidden="true" /></span>
    <svg className="ct-beam" viewBox={`0 0 ${layout.w} ${layout.h}`} preserveAspectRatio="none" aria-hidden="true"><polygon points={beam} /></svg>
    <span className="ct-projector" aria-hidden="true" style={{ left: px(bx), top: px(by) }}><img src={KIT_LENS.src480} alt="" draggable={false} decoding="async" /></span>
    <div className="ct-crew" role="group" aria-label={words.crewRow}>
      {order.map((id, i) => {
        const art = KIT_CREW[id], mood = moods[CREW.indexOf(id)] ?? 'watching', height = layout.crewH * (0.62 + 0.38 * art.tall) * (i % 2 ? 0.94 : 1.04);
        // They turn toward a neighbour: even places look right, odd places look left.
        const toward: 1 | -1 = i === 0 || i === 3 ? 1 : i === 2 || i === 4 ? -1 : (phase === 'lights' ? 1 : -1), view = mood === 'cheering' ? 'front' : mood === 'turning' ? 'side' : 'back';
        const x = layout.w / 2 + places[i] * slot;
        return <span key={id} className="ct-seat" data-crew={id} data-mood={mood} data-view={view} role="img" aria-label={words.crew[id]} style={{ left: px(x), top: px(layout.crewY), height: px(height), '--i': i } as CSSProperties}>
          <img className="ct-seat__back" src={art.back.src480} alt="" draggable={false} decoding="async" />
          <img className="ct-seat__side" src={art.side.src480} alt="" draggable={false} decoding="async" style={{ transform: `scaleX(${art.faces * toward})` }} />
          <img className="ct-seat__front" src={art.front.src480} alt="" draggable={false} decoding="async" />
        </span>;
      })}
    </div>
  </div>;
}
