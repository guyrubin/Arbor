import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Play } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  CAMERA_HOME, PLAY_AMBIENCE, HudButton, HudChip, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, roundSeed, useReducedMotion, useShake,
  type CoachMood, type FxKind, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { SEASON_DIAL_COPY } from './seasonDialCopy';
import {
  COAST_MAX, COAST_STOP, HINT_FIRST_MS, HINT_IDLE_MS, HINT_MS, REST_MS, SEASONS, SEASON_CENTERS, TURN_MS, YEAR_STEP,
  angleDelta, angleToYear, coastStep, crewAt, detent, detentAt, easeInOut, friendsAt, fullYear, hintAt, isLit, labLevel, lapStep, marksCrossed, nextSeasonCenter, phaseAt, pointerAngle,
  restStart, restStep, restingYear, seasonAt, seasonLine, shortestTurn, springTo, startYear, turnAt, turnsToAngle, wrapYear, yearKind, type RestState, type Season,
} from './seasonDialRules';
import {
  ASK_HOLD_MS, ECHO_KNOCKS, LAPSE_HOLD_MS, LAPSE_MS, addMark, askMet, askNudge, conductProgress, conductQuarters, fallAt, labRead, lapseAt, lapseStills, rainbowAt, roundPlan,
  skyBlow, skyStart, skyStep, skyTap, stageLayout, type Mark, type SkyState, type Spot,
} from './seasonDialPlay';
import { createSeasonAudio, type SeasonAudio } from './seasonDialAudio';
import { SeasonWorld, type WorldHandle, type WorldLive, type WorldTouch } from './SeasonWorld';
import { LeafLabGauges } from './SeasonLeafLab';
import { DialArt, HintHand, SeasonArt } from './SeasonDialFace';
import { CAST_PICTURES, PLANTER_PICTURES, type CastPicture } from './seasonDialKit';
import '../makerPalette.css';
import './seasonDial.css';

/** The arc: the opening shot, three chapters (meet the seasons, grow the
 * seedling, conduct a year), the child's choice of season, the film of
 * their year, and its last frame held before the Studio's finish. */
type Phase = 'actOpen' | 'meet' | 'meetDone' | 'grow' | 'growDone' | 'conduct' | 'choose' | 'film' | 'filmHeld' | 'done';
const CHAPTER: Record<Phase, 0 | 1 | 2> = { actOpen: 0, meet: 0, meetDone: 0, grow: 1, growDone: 1, conduct: 2, choose: 2, film: 2, filmHeld: 2, done: 2 };
/** How many times the toy has been opened since the page loaded: each play
 * is a different year and opens on the next season. Kept in memory only. */
let plays = 0;
/** Once the dial has been turned, the showing hand never comes back. */
let dialLearned = false;
const dayNumber = () => Math.floor(Date.now() / 86_400_000);
const FLOURISH_MS = 2600;
type CastId = keyof typeof CAST_PICTURES;
const CAST_SPOT: Record<CastId, 'a' | 'b' | 'c'> = { ayaSpring: 'a', ayaWinter: 'a', chockSummer: 'b', pepAutumn: 'a', gobgobRain: 'b', bebeSnow: 'c' };
/** The season's own stuff, for the particles a touch throws up. */
const SEASON_FX: readonly { kind: FxKind; tones: string[] }[] = [
  { kind: 'petal', tones: ['blossom', 'white', 'rose'] }, { kind: 'petal', tones: ['leaf', 'spring', 'leaf-deep'] },
  { kind: 'petal', tones: ['orange', 'amber', 'red'] }, { kind: 'dust', tones: ['snow', 'white', 'snow-shade'] },
];

export default function SeasonDial() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = SEASON_DIAL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const childId = useArborOptional()?.childProfile?.id ?? '';
  const muted = useKidReadAloudMuted(childId);
  const reduced = useReducedMotion();
  const [play, setPlay] = useState(() => plays++);
  const [seed, setSeed] = useState(roundSeed);
  const plan = useMemo(() => roundPlan(seed), [seed]);
  const kind = useMemo(() => yearKind(dayNumber(), play), [play]);
  const [phase, setPhaseState] = useState<Phase>('actOpen');
  const [turns, setTurns] = useState(() => startYear(play));
  const [lit, setLit] = useState(0);
  const [grown, setGrown] = useState(0);
  const [quarters, setQuarters] = useState(0);
  const [lab, setLab] = useState(() => labRead(wrapYear(startYear(play)), skyStart(wrapYear(startYear(play)))));
  const [coach, setCoach] = useState<{ line: string; mood: CoachMood }>({ line: w.hello, mood: 'happy' });
  const [toast, setToast] = useState('');
  const [echo, setEcho] = useState(false);
  const [held, setHeld] = useState(false);
  const [awake, setAwake] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [look, setLook] = useState(0);
  const [camera, setCamera] = useState<PlayCamera>({ x: 0.5, y: 0.42, zoom: 1.28 });
  const [caption, setCaption] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [shake, bump] = useShake();
  /** The showing hand: how far through one showing (null: not showing). */
  const [hint, setHint] = useState<number | null>(null);

  const phaseRef = useRef<Phase>('actOpen');
  const turnsRef = useRef(turns);
  const live = useRef<WorldLive>({ year: turns, sky: skyStart(wrapYear(turns)), hour: null, gold: 0 });
  const frame = useRef(0);
  const anim = useRef<{ frame: number; timers: ReturnType<typeof setTimeout>[] }>({ frame: 0, timers: [] });
  const fxTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintRun = useRef<{ frame: number; timer: ReturnType<typeof setTimeout> | null }>({ frame: 0, timer: null });
  const rest = useRef<RestState | null>(null);
  const audio = useRef<SeasonAudio | null>(null);
  const sound = useRef<PlaySound | null>(null);
  const wasSounding = useRef(false);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const drag = useRef<{ id: number; last: number; raw: number; moved: number; at: Season | null; x: number; y: number; speed: number; time: number } | null>(null);
  const swipe = useRef<{ id: number; x0: number; y0: number; x: number; y: number; t0: number; moved: number; blown: boolean; trail: number } | null>(null);
  const heart = useRef<{ season: Season | null; time: number }>({ season: null, time: 0 });
  const buzz = useRef(0);
  const dialEl = useRef<HTMLDivElement>(null);
  const rootEl = useRef<HTMLElement>(null);
  const world = useRef<WorldHandle>(null);
  const fx = useRef<PlayFxHandle>(null);
  const grownRef = useRef(0), askHeld = useRef(0), nudgeAt = useRef(0), lastNudge = useRef('');
  const conduct = useRef({ from: 0, far: 0, step: -1 });
  const marks = useRef<Mark[]>([]);
  const knocks = useRef(0), sawRainbow = useRef(false), fell = useRef({ rain: false, snow: false });
  const words = useRef(w); words.current = w;
  const planRef = useRef(plan); planRef.current = plan;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const layout = useMemo(() => stageLayout(size.w || 390, size.h || 760), [size]);
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const later = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); fxTimers.current.push(id); if (fxTimers.current.length > 40) fxTimers.current.splice(0, 20); return id; };
  const say = (line: string, mood: CoachMood = 'idle') => setCoach(prev => (prev.line === line && prev.mood === mood ? prev : { line, mood }));
  const flash = (text: string, ms = 2400) => { setToast(text); later(() => setToast(t => (t === text ? '' : t)), ms); };
  const cheerNow = () => setCheer(n => n + 1);
  /** Stage px → the particle layer's fractions. */
  const burst = (x: number, y: number, fxKind: FxKind, tones: string[], count?: number, scale?: number) => { const L = layoutRef.current; fx.current?.burst(x / L.w, y / L.h, fxKind, { tones, count, size: scale, spread: scale }); };

  /** Every change of the year goes through here: the world reads it on its
   * next frame, the dial is drawn on the next React frame, the sound follows at once. */
  const commit = useCallback((next: number) => {
    turnsRef.current = next; live.current.year = next;
    audio.current?.setYear(wrapYear(next));
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setTurns(turnsRef.current); });
  }, []);
  const softHaptic = () => { const now = performance.now(); if (now - buzz.current > 55) { buzz.current = now; void selectionHaptic(); } };
  /** The pointer drops onto a season's heart: the heavy click, once. */
  const landOn = (season: Season) => {
    const now = performance.now();
    if (heart.current.season === season && now - heart.current.time < 420) return false;
    heart.current = { season, time: now };
    audio.current?.click(season); void selectionHaptic();
    return true;
  };
  /** Conducting: every step the dial is carried forward plays the next note of this round's tune. */
  const conducted = (next: number) => {
    if (phaseRef.current !== 'conduct') return;
    const c = conduct.current;
    if (next <= c.far) return;
    c.far = next;
    const step = lapStep(c.from, Math.min(next, c.from + 0.9999));
    if (step > c.step) { c.step = step; audio.current?.lapNote(step, planRef.current.tune); }
    const done = conductQuarters(conductProgress(c.from, c.far));
    setQuarters(q => {
      if (done <= q) return q;
      sound.current?.place(done * 2); cheerNow(); if (done < 4) say(words.current.conducting, 'happy');
      const at = world.current?.crown(); if (at) burst(at.x, at.y, SEASON_FX[seasonAt(wrapYear(next))].kind, SEASON_FX[seasonAt(wrapYear(next))].tones, 18, 1.2);
      return done;
    });
    if (done >= 4) later(() => { if (phaseRef.current === 'conduct') { setPhase('choose'); say(words.current.rest, 'curious'); sound.current?.chapter(); } }, 500);
  };
  /** Moves the dial and sounds every mark it passes. */
  const travel = (next: number) => {
    const crossed = marksCrossed(turnsRef.current, next);
    if (crossed.ticks) { audio.current?.tick(); softHaptic(); }
    for (const s of crossed.seasons) landOn(s);
    conducted(next);
    commit(next);
  };
  const cancelMotion = () => {
    cancelAnimationFrame(anim.current.frame); anim.current.frame = 0;
    for (const id of anim.current.timers) clearTimeout(id);
    anim.current.timers = [];
  };
  const wake = () => {
    if (!rest.current) { rest.current = restStart(wrapYear(turnsRef.current), performance.now()); setAwake(true); }
    wasSounding.current = audio.current?.wake() ?? false;
    audio.current?.setYear(wrapYear(turnsRef.current));
    sound.current?.ambience(PLAY_AMBIENCE.garden);
  };
  const playing = () => { const p = phaseRef.current; return p === 'meet' || p === 'meetDone' || p === 'grow' || p === 'growDone' || p === 'conduct' || p === 'choose'; };
  const handOn = () => { cancelMotion(); wake(); };

  /* ── the showing hand ── */
  const stopHint = () => {
    cancelAnimationFrame(hintRun.current.frame); hintRun.current.frame = 0;
    if (hintRun.current.timer) clearTimeout(hintRun.current.timer);
    hintRun.current.timer = null;
    setHint(null);
  };
  const queueHint = (after: number) => {
    if (hintRun.current.timer) clearTimeout(hintRun.current.timer);
    hintRun.current.timer = null;
    if (dialLearned) return;
    hintRun.current.timer = setTimeout(() => {
      hintRun.current.timer = null;
      if (dialLearned) return;
      if (phaseRef.current !== 'meet' || drag.current || anim.current.frame) { queueHint(HINT_IDLE_MS); return; }
      if (reducedRef.current) {
        // Reduced motion: the hand and its arrow stand still for a while, then go.
        setHint(0.5);
        hintRun.current.timer = setTimeout(() => { setHint(null); queueHint(HINT_IDLE_MS); }, HINT_MS);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = (now - t0) / HINT_MS;
        if (t >= 1) { hintRun.current.frame = 0; setHint(null); queueHint(HINT_IDLE_MS); return; }
        setHint(t);
        hintRun.current.frame = requestAnimationFrame(step);
      };
      hintRun.current.frame = requestAnimationFrame(step);
    }, after);
  };
  /** Any touch or key quiets the hand and starts its wait again. */
  const noteInput = () => { if (dialLearned) return; stopHint(); queueHint(HINT_IDLE_MS); };
  const learned = () => { if (dialLearned) return; dialLearned = true; stopHint(); };

  /* ── mount: sound, the stage's size, the opening camera ── */
  useEffect(() => {
    const instance = createSeasonAudio(); audio.current = instance;
    const kit = createPlaySound({ key: 'C' }); sound.current = kit;
    const visible = () => {
      if (document.visibilityState === 'hidden') { instance.stop(); return; }
      if (wasSounding.current) { wasSounding.current = instance.wake(); instance.setYear(wrapYear(turnsRef.current)); }
    };
    document.addEventListener('visibilitychange', visible);
    const run = hintRun.current;
    const settle = setTimeout(() => setCamera(CAMERA_HOME), 80);
    return () => {
      clearTimeout(settle);
      document.removeEventListener('visibilitychange', visible);
      cancelAnimationFrame(frame.current); frame.current = 0;
      cancelAnimationFrame(anim.current.frame);
      for (const id of anim.current.timers) clearTimeout(id);
      anim.current = { frame: 0, timers: [] };
      for (const id of fxTimers.current) clearTimeout(id);
      fxTimers.current = [];
      cancelAnimationFrame(run.frame); run.frame = 0;
      if (run.timer) clearTimeout(run.timer);
      run.timer = null;
      instance.dispose(); audio.current = null;
      kit.dispose(); sound.current = null;
    };
  }, [play]);
  useEffect(() => { if (muted) { audio.current?.stop(); sound.current?.stop(); wasSounding.current = false; } }, [muted]);
  useEffect(() => {
    const el = rootEl.current; if (!el) return;
    const measure = () => { const cw = el.clientWidth, ch = el.clientHeight; if (cw && ch) setSize(prev => (prev.w === cw && prev.h === ch ? prev : { w: cw, h: ch })); };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [phase === 'done']);

  /* ── chapter ends ── */
  const flourish = (line: string, next: string, then: () => void) => {
    sound.current?.chapter(); cheerNow(); bump(); void hitPause(80);
    say(line, 'wow'); flash(next, FLOURISH_MS - 200);
    const L = layoutRef.current, at = world.current?.crown();
    if (at) for (let i = 0; i < 4; i++) later(() => burst(at.x + (i - 1.5) * at.rx * 0.5, at.y - at.ry * 0.2 * (i % 2), 'sparkle', ['gold-light', 'white', 'sun'], 16, 1.3), i * 140);
    if (!reducedRef.current) { setCamera({ x: L.tree.x / L.w, y: (L.tree.y - L.tree.h * 0.5) / L.h, zoom: 1.14 }); later(() => setCamera(CAMERA_HOME), 1500); }
    later(then, FLOURISH_MS);
  };
  const beginGrow = () => { setPhase('grow'); askHeld.current = 0; lastNudge.current = ''; nudgeAt.current = performance.now() + 5200; say(words.current.seedling, 'curious'); };
  const beginConduct = () => { setPhase('conduct'); conduct.current = { from: turnsRef.current, far: turnsRef.current, step: -1 }; marks.current = []; setQuarters(0); say(words.current.conduct, 'happy'); };

  /** Chapter one: a season the dial stays in for REST_MS is met. */
  useEffect(() => {
    if (phase !== 'meet') return;
    const id = setInterval(() => {
      const before = rest.current; if (!before || drag.current) return;
      const after = restStep(before, wrapYear(turnsRef.current), performance.now(), REST_MS);
      rest.current = after;
      if (after.lit === before.lit) return;
      const season = after.season, count = SEASONS.filter(s => isLit(after.lit, s)).length;
      setLit(after.lit);
      audio.current?.badge(season); sound.current?.place(count * 2); void selectionHaptic(); cheerNow();
      const at = world.current?.crown(); if (at) burst(at.x, at.y, SEASON_FX[season].kind, SEASON_FX[season].tones, 22, 1.3);
      if (fullYear(after.lit)) flourish(words.current.metAll, words.current.chapters[1], beginGrow);
      else say(words.current.meet[season], 'happy');
    }, 160);
    return () => clearInterval(id);
  }, [phase]);

  /** The sky's own life, ten times a second: clouds thin, rain soaks, the
   * LeafLab follows; in chapter two the seedling grows when its ask is held. */
  useEffect(() => {
    if (phase === 'done' || phase === 'film' || phase === 'filmHeld') return;
    const id = setInterval(() => {
      const year = wrapYear(turnsRef.current), W = words.current;
      const sky = skyStep(live.current.sky, year, 0.1); live.current.sky = sky;
      const read = labRead(year, sky), fall = fallAt(year, sky);
      setLab(prev => (Math.abs(prev.moisture - read.moisture) + Math.abs(prev.light - read.light) + Math.abs(prev.warmth - read.warmth) < 0.012 ? prev : read));
      audio.current?.setMix({ rain: fall.rain, wind: Math.min(1, sky.clouds < -0.1 ? -sky.clouds : 0) });
      // The child's own weather is named once each time it starts.
      if (sky.clouds > 0.2 && fall.rain > 0.3 && !fell.current.rain) { fell.current.rain = true; if (phaseRef.current !== 'grow') say(W.rainMade, 'wow'); }
      else if (fall.rain < 0.05) fell.current.rain = false;
      if (sky.clouds > 0.2 && fall.snow > 0.6 && !fell.current.snow) { fell.current.snow = true; if (phaseRef.current !== 'grow') say(W.snowMade, 'wow'); }
      else if (sky.clouds < 0.1) fell.current.snow = false;
      if (rainbowAt(year, sky) > 0.55) { if (!sawRainbow.current) { sawRainbow.current = true; say(W.rainbow, 'wow'); flash(W.rainbow); sound.current?.note(9); sound.current?.note(12, { at: 0.12 }); sound.current?.note(14, { at: 0.24 }); cheerNow(); } }
      else if (sky.mist < 0.05) sawRainbow.current = false;
      if (phaseRef.current !== 'grow') return;
      const ask = planRef.current.asks[grownRef.current]; if (!ask) return;
      const met = askMet(ask, read);
      if (met.all) {
        askHeld.current += 100;
        if (askHeld.current === 300) say(W.hold, 'happy');
        if (askHeld.current >= ASK_HOLD_MS) {
          askHeld.current = 0; lastNudge.current = '';
          const done = grownRef.current + 1; grownRef.current = done; setGrown(done);
          sound.current?.place(done * 3); void selectionHaptic(); cheerNow();
          const L = layoutRef.current, p = L.spots.planter;
          burst(p.x, p.y - p.h * 0.7, 'sparkle', ['gold-light', 'white', 'spring'], 22, 1.2); burst(p.x, p.y - p.h * 0.6, 'petal', ['blossom', 'rose', 'white'], 12);
          if (done >= planRef.current.asks.length) flourish(W.bloomed, W.chapters[2], beginConduct);
          else { say(W.grew, 'wow'); nudgeAt.current = performance.now() + 2400; }
        }
        return;
      }
      askHeld.current = 0;
      // Aya says what the seedling asks for, then which way to nudge the gauge that is off.
      const now = performance.now(); if (now < nudgeAt.current) return;
      const nudge = askNudge(ask, read), key = nudge ? `${nudge.gauge}${nudge.way > 0 ? 'Up' : 'Down'}` as keyof typeof W.nudges : null;
      const first = lastNudge.current !== `ask${grownRef.current}` && !lastNudge.current.startsWith(`n${grownRef.current}`);
      if (first) { lastNudge.current = `ask${grownRef.current}`; say(W.asks[ask.id as keyof typeof W.asks], 'curious'); nudgeAt.current = now + 4200; }
      else if (key) { lastNudge.current = `n${grownRef.current}${key}`; say(W.nudges[key], 'idle'); nudgeAt.current = now + 1800; }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  /* ── the dial ── */
  /** A tap on the dial, PageUp/PageDown: the short way round, with the pointer's weight. */
  const goTo = (target: number) => {
    handOn(); learned();
    const from = turnsRef.current;
    if (reducedRef.current) { travel(from + shortestTurn(wrapYear(from), target)); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TURN_MS);
      travel(turnAt(from, target, t));
      anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  const nudge = (steps: number) => { handOn(); learned(); void selectionHaptic(); travel(turnsRef.current + steps * YEAR_STEP); };
  /** The hub: the whole year flies once round under the finger. */
  const whirl = () => {
    handOn(); learned();
    const from = turnsRef.current;
    if (reducedRef.current) { travel(from + shortestTurn(wrapYear(from), nextSeasonCenter(wrapYear(from), 1))); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 1800);
      travel(from + easeInOut(t));
      anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  /** Let go: the dial coasts on its own weight, then drops into a heart if one is near. */
  const letGo = (speed: number) => {
    const settle = () => {
      const from = turnsRef.current, target = restingYear(wrapYear(from)), gap = shortestTurn(wrapYear(from), target);
      if (Math.abs(gap) < 1e-5) { anim.current.frame = 0; return; }
      const season = detentAt(target, 0.0001);
      if (season !== null) landOn(season);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 340);
        commit(from + gap * springTo(t, 0.5));
        anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
      };
      anim.current.frame = requestAnimationFrame(step);
    };
    if (reducedRef.current) { const from = turnsRef.current; commit(from + shortestTurn(wrapYear(from), restingYear(wrapYear(from)))); return; }
    let v = Math.min(COAST_MAX, Math.max(-COAST_MAX, speed));
    if (Math.abs(v) <= COAST_STOP * 4) { settle(); return; }
    let last = performance.now();
    const step = (now: number) => {
      const out = coastStep(v, Math.min(50, now - last)); last = now; v = out.speed;
      travel(turnsRef.current + out.advance);
      if (Math.abs(v) > COAST_STOP) anim.current.frame = requestAnimationFrame(step);
      else settle();
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  const angleOf = (e: { clientX: number; clientY: number }) => {
    const box = dialEl.current?.getBoundingClientRect();
    if (!box) return null;
    const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2);
    return { deg: pointerAngle(dx, dy), near: Math.hypot(dx, dy) < box.width * 0.11 };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || drag.current || !playing()) return;
    const at = angleOf(e); if (!at) return;
    e.stopPropagation();
    handOn(); setHeld(true);
    audio.current?.tick(); sound.current?.pick(); void selectionHaptic();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    drag.current = { id: e.pointerId, last: at.deg, raw: turnsRef.current, moved: 0, at: detentAt(wrapYear(turnsRef.current)), x: e.clientX, y: e.clientY, speed: 0, time: performance.now() };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const at = angleOf(e); if (!at) return;
    if (at.near) { d.last = at.deg; return; } // too close to the hub to tell a direction
    const delta = angleDelta(d.last, at.deg), now = performance.now(), dt = Math.max(4, now - d.time);
    d.last = at.deg; d.raw += delta; d.moved += Math.abs(delta);
    d.speed = d.speed * 0.6 + ((delta / dt) * 1000) * 0.4; d.time = now;
    if (d.moved > 0.012) learned();
    const y = wrapYear(d.raw);
    const shown = d.raw + shortestTurn(y, detent(y));
    const crossed = marksCrossed(turnsRef.current, shown);
    if (crossed.ticks) { audio.current?.tick(); softHaptic(); }
    conducted(shown);
    commit(shown);
    const s = detentAt(wrapYear(shown));
    if (s !== null && s !== d.at) landOn(s);
    else for (const passed of crossed.seasons) landOn(passed);
    d.at = s;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null; setHeld(false);
    // The rest that meets a season begins when the hand lets go.
    if (rest.current) rest.current = { ...rest.current, season: seasonAt(wrapYear(turnsRef.current)), since: performance.now() };
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    // A tap (no turn, no travel) sends the pointer to where the finger touched; a tap on the hub spins the year.
    if (d.moved < 0.01 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
      const at = angleOf(e);
      if (at?.near) whirl(); else if (at) goTo(angleToYear(at.deg));
      return;
    }
    letGo(performance.now() - d.time > 90 ? 0 : d.speed);
  };
  const cancel = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current?.id === e.pointerId) { drag.current = null; setHeld(false); } };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!playing()) return;
    const y = wrapYear(turnsRef.current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-1);
    else if (e.key === 'PageUp') goTo(nextSeasonCenter(y, 1));
    else if (e.key === 'PageDown') goTo(nextSeasonCenter(y, -1));
    else if (e.key === 'Home') goTo(SEASON_CENTERS[0]);
    else if (e.key === 'End') goTo(SEASON_CENTERS[3]);
    else return;
    e.preventDefault();
  };

  /* ── touching the world ── */
  const remember = (markKind: Mark['kind'], x: number, y: number) => { if (phaseRef.current === 'conduct') marks.current = addMark(marks.current, { year: wrapYear(turnsRef.current), x, y, kind: markKind }); };
  const gather = (x: number, y: number) => {
    live.current.sky = skyTap(live.current.sky);
    burst(x, y + 14, 'drop', ['water', 'sky', 'white'], 10); audio.current?.toy('cloudPuff', seasonAt(wrapYear(turnsRef.current)));
    remember('tapSky', x, y);
  };
  const shine = (x: number, y: number) => {
    live.current.sky = skyBlow(live.current.sky, 0.8);
    burst(x, y, 'glint', ['sun', 'gold-light', 'white'], 14, 1.3); audio.current?.toy('sunDisc', seasonAt(wrapYear(turnsRef.current)));
    remember('tapSky', x, y);
  };
  const blow = (dir: number, x: number, y: number) => {
    const season = seasonAt(wrapYear(turnsRef.current));
    world.current?.gust(dir, 1); live.current.sky = skyBlow(live.current.sky);
    sound.current?.breath({ tone: 700, gain: 0.05, length: 0.9 }); void selectionHaptic();
    for (let i = 0; i < 5; i++) later(() => burst(x + dir * i * 46, y + (i % 2 ? -12 : 10), SEASON_FX[season].kind, SEASON_FX[season].tones, 6), i * 45);
    if (live.current.sky.clouds < -0.15 && phaseRef.current !== 'grow') say(words.current.blown, 'happy');
    remember('blow', x, y);
  };
  const touch = (x: number, y: number, what?: WorldTouch) => {
    const hit = what ?? world.current?.touchAt(x, y) ?? 'openSky', year = wrapYear(turnsRef.current), season = seasonAt(year);
    const gave = world.current?.answer(hit, x, y) ?? 0;
    fx.current?.burst(x / layoutRef.current.w, y / layoutRef.current.h, 'ring', { tones: ['white'] });
    void selectionHaptic(); setLook(x);
    if (hit === 'cloudPuff') gather(x, y);
    else if (hit === 'sunDisc') shine(x, y);
    else if (hit === 'treeCrown') {
      burst(x, y, SEASON_FX[season].kind, SEASON_FX[season].tones, season === 3 && gave > 1 ? 30 : 16, season === 3 ? 1.5 : 1.15);
      if (gave >= 3) { bump(); void hitPause(60); }
      audio.current?.toy('appleTree', season, gave >= 4 ? 1 : 0); cheerNow(); remember('tapTree', x, y);
    } else if (hit === 'knotHole') { audio.current?.toy('knotHole', season); burst(x, y, 'glint', ['butter', 'white'], 6); }
    else if (hit === 'snowFriend') { audio.current?.toy('snowFriend', season); burst(x, y - 30, 'dust', ['snow', 'white'], 14); }
    else if (hit === 'floorPuddle') { audio.current?.toy('terraceFloor', season, 0); burst(x, y, 'drop', ['water', 'sky', 'white'], 20, 1.3); remember('tapFloor', x, y); }
    else if (hit === 'farMountain') {
      knocks.current++; sound.current?.note(4 + knocks.current * 2, { gain: 0.05 }); burst(x, y, 'sparkle', ['white', 'sky-pale'], 6);
      if (knocks.current === ECHO_KNOCKS) {
        setEcho(true); world.current?.flock(); say(words.current.echo, 'wow');
        for (let i = 0; i < 4; i++) sound.current?.note(12 - i * 2, { gain: 0.05 - i * 0.01, at: 0.5 + i * 0.42, length: 0.5 });
      }
    } else if (hit === 'terraceFloor') { audio.current?.toy('terraceFloor', season, season === 3 ? 1 : season === 2 ? 2 : 3); burst(x, y, SEASON_FX[season].kind, SEASON_FX[season].tones, 9); remember('tapFloor', x, y); }
    else gather(x, y);
  };
  const stagePoint = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const box = e.currentTarget.getBoundingClientRect(), L = layoutRef.current;
    return { x: ((e.clientX - box.left) / (box.width || 1)) * L.w, y: ((e.clientY - box.top) / (box.height || 1)) * L.h };
  };
  const worldDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || swipe.current || !playing() || (e.target as Element).closest?.('button')) return;
    const p = stagePoint(e); wake();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    swipe.current = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y, t0: performance.now(), moved: 0, blown: false, trail: 0 };
  };
  const worldMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current; if (!s || s.id !== e.pointerId) return;
    const p = stagePoint(e), step = Math.hypot(p.x - s.x, p.y - s.y);
    s.moved += step; s.trail += step; s.x = p.x; s.y = p.y;
    const brushed = world.current?.brush(p.x, p.y) ?? 0;
    if (brushed) { burst(p.x, p.y, 'dust', ['snow', 'white', 'snow-shade'], 5 + brushed * 2); sound.current?.breath({ tone: 2400, gain: 0.025, length: 0.12 }); softHaptic(); }
    if (s.trail > 34) { s.trail = 0; const season = seasonAt(wrapYear(turnsRef.current)); fx.current?.trail(p.x / layoutRef.current.w, p.y / layoutRef.current.h, SEASON_FX[season].kind, { tones: SEASON_FX[season].tones }); }
    const dx = p.x - s.x0, dy = p.y - s.y0;
    if (!s.blown && Math.abs(dx) > Math.max(64, layoutRef.current.w * 0.09) && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - s.t0 < 700) { s.blown = true; blow(dx > 0 ? 1 : -1, s.x0, s.y0); }
    else if (performance.now() - s.t0 > 700 && !s.blown) { s.x0 = p.x; s.y0 = p.y; s.t0 = performance.now(); }
  };
  const worldUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = swipe.current; if (!s || s.id !== e.pointerId) return;
    swipe.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (s.moved < 12) touch(s.x, s.y);
  };
  const worldCancel = (e: ReactPointerEvent<HTMLDivElement>) => { if (swipe.current?.id === e.pointerId) swipe.current = null; };
  const pokeFriend = (spot: Spot) => {
    wake(); cheerNow(); void selectionHaptic();
    audio.current?.toy('valleyFriend', seasonAt(wrapYear(turnsRef.current)));
    burst(spot.x, spot.y - spot.h * 0.8, 'sparkle', ['gold-light', 'white'], 8);
    setCoach(c => ({ ...c, mood: 'happy' }));
  };

  /* ── the set-piece: the film of the year ── */
  const endFilm = (season: Season) => {
    const W = words.current;
    setPhase('filmHeld'); setCaption(seasonLine(W.filmEnd, W.seasons[season]));
    audio.current?.fanfare(); cheerNow(); bump();
    const at = world.current?.crown(), L = layoutRef.current;
    for (let i = 0; i < 6; i++) later(() => burst(L.w * (0.12 + 0.15 * i), (at?.y ?? L.h * 0.3) + (i % 2 ? 30 : -20), SEASON_FX[season].kind, SEASON_FX[season].tones, 16, 1.4), i * 160);
    later(() => { audio.current?.stop(); sound.current?.stop(); setPhase('done'); }, LAPSE_HOLD_MS);
  };
  const startFilm = () => {
    if (phaseRef.current !== 'choose') return;
    cancelMotion(); stopHint(); wake(); void selectionHaptic();
    const W = words.current, from = conduct.current.from, season = seasonAt(wrapYear(turnsRef.current)), L = layoutRef.current;
    setPhase('film'); setCaption(W.film); sound.current?.setPiece();
    live.current.sky = { clouds: 0, wet: live.current.sky.wet, mist: 0 }; audio.current?.setMix({});
    if (reducedRef.current) {
      // Reduced motion: five still pictures, the last at golden hour.
      const stills = lapseStills(from, season);
      stills.forEach((still, i) => anim.current.timers.push(setTimeout(() => {
        live.current.gold = still.gold; live.current.hour = still.gold ? 0.86 : null;
        commit(turnsRef.current + shortestTurn(wrapYear(turnsRef.current), still.year));
        audio.current?.lapNote(i * 3, planRef.current.tune);
        if (i === stills.length - 1) endFilm(season);
      }, i * 1100)));
      return;
    }
    const focus = { x: L.tree.x / L.w, y: (L.tree.y - L.tree.h * 0.45) / L.h };
    setCamera({ ...focus, zoom: 1.5 });
    for (const [at, zoom] of [[0.2, 1.34], [0.42, 1.18], [0.62, 1]] as const) anim.current.timers.push(setTimeout(() => setCamera(zoom === 1 ? CAMERA_HOME : { ...focus, zoom }), LAPSE_MS * at));
    const t0 = performance.now(), played = new Set<number>();
    let lastStep = -1;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / LAPSE_MS), f = lapseAt(t, from, season);
      live.current.hour = f.hour; live.current.gold = f.gold;
      const crossed = marksCrossed(turnsRef.current, f.turns);
      if (crossed.ticks) audio.current?.tick();
      commit(f.turns);
      const lap = f.turns - from;
      if (lap <= 1) {
        const at = lapStep(from, Math.min(f.turns, from + 0.9999));
        if (at > lastStep) { lastStep = at; audio.current?.lapNote(at, planRef.current.tune); }
        // Every touch the child made while conducting comes back at its own point of the year.
        marks.current.forEach((m, i) => {
          if (played.has(i) || wrapYear(m.year - from) > lap) return;
          played.add(i);
          const s = seasonAt(m.year);
          if (m.kind === 'blow') world.current?.gust(1, 0.8); else if (m.kind !== 'tapSky') world.current?.answer(m.kind === 'tapTree' ? 'treeCrown' : 'terraceFloor', m.x, m.y);
          burst(m.x, m.y, m.kind === 'tapSky' ? 'drop' : SEASON_FX[s].kind, m.kind === 'tapSky' ? ['water', 'sky', 'white'] : SEASON_FX[s].tones, 14, 1.2);
        });
      }
      if (t < 1) anim.current.frame = requestAnimationFrame(step);
      else { anim.current.frame = 0; endFilm(season); }
    };
    anim.current.frame = requestAnimationFrame(step);
  };

  const begin = () => { if (phaseRef.current !== 'actOpen') return; setPhase('meet'); setCamera(CAMERA_HOME); queueHint(HINT_FIRST_MS); };
  const replay = () => {
    const next = plays++;
    cancelMotion(); stopHint(); rest.current = null; drag.current = null; swipe.current = null; turnsRef.current = startYear(next);
    live.current = { year: startYear(next), sky: skyStart(wrapYear(startYear(next))), hour: null, gold: 0 };
    grownRef.current = 0; askHeld.current = 0; knocks.current = 0; marks.current = []; sawRainbow.current = false;
    setTurns(startYear(next)); setLit(0); setGrown(0); setQuarters(0); setToast(''); setEcho(false); setAwake(false); setHeld(false); setCheer(0); setCaption('');
    setCoach({ line: w.hello, mood: 'happy' }); setCamera({ x: 0.5, y: 0.42, zoom: 1.28 });
    setSeed(roundSeed()); setPhase('actOpen'); setPlay(next);
  };

  // While the hand shows the turn, the dial and the valley really follow it.
  const showing = hint === null ? null : hintAt(reduced ? 0.4 : hint);
  const shownTurns = turns + (showing && !reduced ? showing.offset : 0);
  live.current.year = shownTurns;
  const year = wrapYear(shownTurns), season = seasonAt(year), phaseText = w.phases[phaseAt(wrapYear(turns))];
  const chapter = CHAPTER[phase], filming = phase === 'film' || phase === 'filmHeld';
  const resting = phase === 'meet' && awake && !held && !isLit(lit, season) ? season : null;
  const ask = phase === 'grow' ? plan.asks[grown] ?? null : null;
  const labWords = `${w.lab}: ${w.labMoisture[labLevel(lab.moisture)]}, ${w.labLight[labLevel(lab.light)]}, ${w.labWarmth[labLevel(lab.warmth)]}.`;
  const friends = friendsAt(year), crew = crewAt(year);
  const shows: Record<CastId, number> = { ...friends, ...crew };
  if (chapter === 1) { shows.ayaSpring = 1; shows.ayaWinter = 0; }
  const steps = chapter === 0
    ? SEASONS.map(s => ({ key: `season${s}`, label: w.seasons[s], done: isLit(lit, s), icon: <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false"><SeasonArt season={s} /></svg> }))
    : chapter === 1 ? w.steps.map((label, i) => ({ key: `step${i}`, label, done: grown > i }))
      : w.quarters.map((label, i) => ({ key: `quarter${i}`, label, done: quarters > i }));
  const current = chapter === 0 ? (isLit(lit, season) ? SEASONS.findIndex(s => !isLit(lit, s)) : season) : chapter === 1 ? grown : quarters;
  // The seedling: a tight bud, the bud swelling (and swelling again), then the flower with the chapter's last step.
  const planter = PLANTER_PICTURES[grown >= 3 ? 2 : Math.min(1, grown)], planterTall = layout.spots.planter.h * [0.84, 0.94, 1.04, 1.16][Math.min(3, grown)];
  const sprite = (id: CastId, picture: CastPicture, spot: Spot) => {
    const show = shows[id]; if (show <= 0.02) return null;
    const ratio = picture.width / picture.height, h = spot.h * picture.tall;
    const toward = look ? (look < spot.x ? -1 : 1) : (layout.tree.x < spot.x ? -1 : 1), flip = picture.faces !== 0 && picture.faces !== toward;
    return <button type="button" key={id} className="sd-friend" data-sd-friend={id} aria-label={w.friends[id]} onClick={() => pokeFriend(spot)}
      style={{ left: spot.x, top: spot.y, inlineSize: h * ratio, blockSize: h, opacity: Math.min(1, show * 1.4), '--sd-in': show.toFixed(3) } as CSSProperties}>
      <span className="sd-friend__shadow" aria-hidden="true" />
      <span key={cheer} className="sd-friend__body" data-cheer={cheer > 0 || undefined}><img src={h > 240 ? picture.src : picture.src480 ?? picture.src} alt="" draggable={false} decoding="async" style={flip ? { transform: 'scaleX(-1)' } : undefined} /></span>
    </button>;
  };
  const d = layout.dial;

  return <GameShell fullBleed autoNarrate={false} worldId="season-dial" title={w.title} instruction={w.instruction}>
    {phase === 'done'
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={replay} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section ref={rootEl} className="sd sd-root" data-adventure="season-dial" data-phase={phase} data-chapter={chapter + 1} data-season={season} data-seed={seed} dir={lang === 'he' ? 'rtl' : 'ltr'}
        onPointerDownCapture={noteInput} onKeyDownCapture={noteInput}>
        <PlayStage id="season-dial" grade="day" camera={camera} shake={shake} parallax setPiece={filming}
          world={<div className="sd-touch" data-sd-scene="" dir="ltr" role="group" aria-label={`${w.scene}. ${phaseText}`}
            onPointerDown={worldDown} onPointerMove={worldMove} onPointerUp={worldUp} onPointerCancel={worldCancel} onLostPointerCapture={worldCancel}>
            <SeasonWorld ref={world} layout={layout} live={live} still={reduced} kind={kind} cloudSeed={plan.cloudSeed} drift={plan.drift}>
              {(Object.keys(CAST_PICTURES) as CastId[]).map(id => sprite(id, CAST_PICTURES[id], layout.spots[CAST_SPOT[id]]))}
              {chapter === 1 && <button type="button" className="sd-friend sd-planter" data-sd-planter={grown} aria-label={w.friends.planter} onClick={() => pokeFriend(layout.spots.planter)}
                style={{ left: layout.spots.planter.x, top: layout.spots.planter.y, inlineSize: planterTall * (planter.width / planter.height), blockSize: planterTall }}>
                <span className="sd-friend__shadow" aria-hidden="true" />
                <span key={`${grown}`} className="sd-friend__body" data-cheer="true" data-full={grown >= 3 || undefined}><img src={planter.src} alt="" draggable={false} decoding="async" /></span>
              </button>}
            </SeasonWorld>
            <PlayFx ref={fx} layer={6} />
            {/* The same touches for a keyboard: real buttons where the things are. */}
            {playing() && <div className="sd-keys">
              <button type="button" className="sd-key" style={{ left: '22%', top: '14%' }} aria-label={w.gather} onClick={() => { wake(); const L = layoutRef.current; touch(L.w * 0.22, L.horizon * 0.3, 'cloudPuff'); }} />
              <button type="button" className="sd-key" style={{ left: '50%', top: '8%' }} aria-label={w.shine} onClick={() => { wake(); const L = layoutRef.current; touch(L.w * 0.5, L.horizon * 0.2, 'sunDisc'); }} />
              <button type="button" className="sd-key" style={{ left: layout.tree.x, top: layout.tree.y - layout.tree.h * 0.6 }} aria-label={w.shake} onClick={() => { wake(); const at = world.current?.crown(); if (at) touch(at.x, at.y, 'treeCrown'); }} />
              <button type="button" className="sd-key" style={{ left: '78%', top: '26%' }} aria-label={w.blow} onClick={() => { wake(); const L = layoutRef.current; blow(1, L.w * 0.3, L.horizon * 0.5); }} />
            </div>}
          </div>}>
          {phase === 'actOpen' && <PlayOpening title={w.title} place={w.place} onDone={begin} />}
          <HudCoach who="aya" mood={coach.mood} line={coach.line} onPoke={() => { wake(); sound.current?.tap(); setCoach(c => ({ ...c, mood: c.mood === 'happy' ? 'wow' : 'happy' })); }} pokeLabel={w.aya} />
          <HudQuest steps={steps} current={current} label={w.chapters[chapter]} />
          <button type="button" className="sd-lab" data-sd-lab="" data-ask={ask?.id} aria-label={ask ? `${w.asks[ask.id as keyof typeof w.asks]} ${labWords}` : labWords}
            onClick={() => { wake(); void selectionHaptic(); audio.current?.lab(lab.moisture, lab.light, lab.warmth); }}>
            <LeafLabGauges lab={lab} ask={ask} />
          </button>
          {/* The dial is an object, not text: it keeps its turn and its corner in Hebrew too. */}
          <div className="sd-dialbox" dir="ltr" style={{ left: d.cx - d.r, top: d.cy - d.r, inlineSize: d.r * 2, blockSize: d.r * 2 }}>
            <span className="sd-rail" aria-hidden="true" />
            <div ref={dialEl} className="sd-dial" data-sd-dial="" data-held={held || undefined} role="slider" tabIndex={0} aria-label={w.dial} aria-orientation="horizontal"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(wrapYear(turns) * 100)} aria-valuetext={phaseText}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
              <DialArt turns={shownTurns} lit={lit} glow={chapter > 0} season={season} resting={resting} lapFrom={chapter === 2 ? conduct.current.from : null} />
              <span className="sd-dial__sheen" aria-hidden="true" style={{ transform: `rotate(${(turnsToAngle(shownTurns) * 0.25).toFixed(1)}deg)` }} />
            </div>
            {showing && <HintHand angle={turnsToAngle(shownTurns)} from={turnsToAngle(turns)} show={reduced ? 1 : showing.show} press={reduced ? 0 : showing.press} />}
          </div>
          {echo && <span className="sd-secret"><HudChip tone="chosen">{w.echoChip}</HudChip></span>}
          <HudToast show={!!toast}>{toast}</HudToast>
          <HudDock align={lang === 'he' ? 'end' : 'start'} label={w.chapters[chapter]}>
            {phase === 'choose' && <HudButton label={w.playYear} tone="go" size="l" cue icon={<Play aria-hidden="true" />} onClick={startFilm} data={{ 'data-sd-film': '' }} />}
          </HudDock>
          <PlaySetPiece active={filming} caption={caption} />
          <p className="sd-live" role="status">{filming ? caption : seasonLine(w.lit, w.seasons[season])}</p>
        </PlayStage>
      </section>}
  </GameShell>;
}
