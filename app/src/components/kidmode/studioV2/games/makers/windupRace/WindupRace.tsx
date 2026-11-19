import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Play, RotateCw, Wind } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './windupRace.css';
import {
  HudButton, HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, roundSeed, useReducedMotion, useShake,
  type CoachMood, type PlayFxHandle, type PlaySound,
} from '../play';
import { ROVER_BEARING, lerp, project, roverView, shotCamera, type Camera, type Shot } from './windupCamera';
import { ROVER_FRONT, ROVER_MARKS } from './windupKit';
import { createRacerSound, type RacerSound } from './windupRaceAudio';
import { WINDUP_RACE_COPY } from './windupRaceCopy';
import {
  CHAPTERS, MAX_CLICKS, STEP, buildPlay, daylight, dragKey, placeReached, startRun, stepRun, tension, turnsLeft, wheelAngle, wind,
  type Course, type Line, type RunEvent, type RunState,
} from './windupRaceRules';
import { Fx, LINE_Z, Palette, World, buildScenery, sunFor, type Frame, type PepPose, type Scenery, type Sun } from './windupWorld';

/** openShot → winding → crouching → running → (resting → winding …) → flourish → travelling → scoutPan → winding … → finale → finished. */
type Phase = 'openShot' | 'scoutPan' | 'winding' | 'crouching' | 'running' | 'resting' | 'flourish' | 'travelling' | 'finale' | 'finished';

const CROUCH_S = 0.36, REST_S = 1.9, FLOURISH_S = 2.6, TRAVEL_S = 0.5, SCOUT_S = 2.5, FINALE_S = 4.2, OPEN_S = 2.8;
const SLOW_RATE = 0.2, BREATH_RATE = 0.55;
const TWO_PI = Math.PI * 2;
/** What this visit has already shown: the hand never returns for a gesture the child has made. */
const taught = { key: false };
/** Plays begun this visit: the daylight moves on with each. */
const visit = { plays: 0 };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const fillLine = (template: string, ...values: string[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => values[Number(slot)] ?? '');

interface Game {
  phase: Phase; phaseT: number; clock: number;
  chapter: number; course: Course; scenery: Scenery; sun: Sun;
  clicks: number; turn: number; keyAngle: number; keyVel: number; backTurns: number;
  run: RunState | null; restX: number; line: Line; lean: boolean; leanK: number; balls: RunState['balls'] | undefined;
  roverZ: number; sx: number; sy: number; svx: number; svy: number; tremble: number; glow: number; pitch: number; hop: number; hopV: number;
  blooms: number[]; goalBloom: number; chain: number; cushion: number; signTurn: number;
  shot: Shot | null; camX: number; camY: number; kick: number; shake: number; flash: number; fade: number; freeze: number; rate: number;
  pep: { x: number; z: number; y: number; vy: number; pose: PepPose; faceRight: boolean; goal: number; sx: number; sy: number; poke: number };
  fx: Fx; ribbon: { x: number; y: number; z: number }[]; rainbow: boolean; shafts: number;
  acc: number; dustAt: number; streakAt: number; quiet: number; px: number; py: number;
  drag: { id: number; angle: number; moved: number; startX: number; startY: number; teeth: number } | null;
  cam: Camera | null; keyAt: { x: number; y: number; u: number } | null;
  lastGust: number; told: Set<string>; bounce: number | null;
}

export default function WindupRace() {
  // Play again outside the Studio (the Studio remounts the game itself): a fresh round, a fresh seed.
  const [round, setRound] = useState(0);
  return <WindupRound key={round} onAgain={() => setRound(n => n + 1)} />;
}

export function WindupRound({ onAgain }: { onAgain: () => void }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = WINDUP_RACE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const reduced = useReducedMotion();
  const [seed] = useState(() => roundSeed());
  const [light] = useState(() => daylight(visit.plays++));
  const courses = useMemo(() => buildPlay(seed), [seed]);
  const [phase, setPhaseState] = useState<Phase>('openShot');
  const [chapter, setChapter] = useState(0);
  const [clicks, setClicksState] = useState(0);
  const [coach, setCoachState] = useState<{ line: string; mood: CoachMood }>({ line: w.hello, mood: 'happy' });
  const [toast, setToast] = useState<{ text: string; show: boolean }>({ text: '', show: false });
  const [line, setLineState] = useState<Line>('low');
  const [leanHeld, setLeanHeld] = useState(false);
  const [gusty, setGusty] = useState(0);
  const [locked, setLocked] = useState(false);
  const [finished, setFinished] = useState(false);
  const [shake, bump] = useShake();

  const canvasRef = useRef<HTMLCanvasElement | null>(null), keyRef = useRef<HTMLButtonElement | null>(null), handRef = useRef<HTMLDivElement | null>(null);
  const fxRef = useRef<PlayFxHandle | null>(null);
  const sound = useRef<RacerSound | null>(null), play = useRef<PlaySound | null>(null);
  const world = useRef<World | null>(null), palette = useRef<Palette | null>(null);
  const size = useRef({ w: 390, h: 700, dpr: 1 });
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const wRef = useRef(w); wRef.current = w;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const frame = useRef(0), lastTime = useRef(0), alive = useRef(true), broken = useRef(false);

  const game = useRef<Game | null>(null);
  if (!game.current) {
    const course = courses[0];
    game.current = {
      phase: 'openShot', phaseT: 0, clock: 0, chapter: 0, course, scenery: buildScenery(course), sun: sunFor(light),
      clicks: 0, turn: 0, keyAngle: 0.5, keyVel: 0, backTurns: 0, run: null, restX: course.start, line: 'low', lean: false, leanK: 0, balls: undefined,
      roverZ: 0, sx: 1, sy: 1, svx: 0, svy: 0, tremble: 0, glow: 0.2, pitch: 0, hop: 0, hopV: 0,
      blooms: course.blooms.map(() => 0), goalBloom: 0, chain: 0, cushion: 0, signTurn: -0.6,
      shot: null, camX: course.start, camY: 0.45, kick: 0, shake: 0, flash: 0, fade: 0, freeze: 0, rate: 1,
      pep: { x: course.start + 1.4, z: 4.4, y: 0, vy: 0, pose: 'sit', faceRight: false, goal: course.start + 1.4, sx: 1, sy: 1, poke: 0 },
      fx: new Fx(), ribbon: [], rainbow: false, shafts: 0, acc: 0, dustAt: 0, streakAt: 0, quiet: 0, px: 0, py: 0, drag: null, cam: null, keyAt: null, lastGust: -1, told: new Set(), bounce: null,
    };
  }
  const G = game.current;

  const later = useCallback((ms: number, run: () => void) => { const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); if (alive.current) run(); }, ms); timers.current.push(id); }, []);
  const say = useCallback((text: string, mood: CoachMood = 'idle') => setCoachState(prev => (prev.line === text && prev.mood === mood ? prev : { line: text, mood })), []);
  const flashToast = useCallback((text: string, ms = 2200) => { setToast({ text, show: true }); later(ms, () => setToast(prev => (prev.text === text ? { text, show: false } : prev))); }, [later]);
  const setPhase = useCallback((next: Phase) => { G.phase = next; G.phaseT = 0; setPhaseState(next); }, [G]);
  const setClicks = useCallback((next: number) => { G.clicks = next; setClicksState(next); }, [G]);
  const setLine = useCallback((next: Line) => { G.line = next; setLineState(next); }, [G]);

  /* ---------- sound ---------- */
  useEffect(() => {
    alive.current = true;
    sound.current = createRacerSound(); play.current = createPlaySound({ key: 'D' });
    return () => {
      alive.current = false;
      for (const id of timers.current) clearTimeout(id); timers.current = [];
      sound.current?.dispose(); sound.current = null; play.current?.dispose(); play.current = null;
    };
  }, []);
  const ambience = useCallback(() => { const zone = G.course.zones.find(z => G.restX >= z.from && G.restX < z.to)?.kind; play.current?.ambience(zone === 'terrace' ? PLAY_AMBIENCE.wind : PLAY_AMBIENCE.hall); }, [G]);

  /* ---------- chapters ---------- */
  const enterChapter = useCallback((index: number) => {
    const course = courses[index];
    G.chapter = index; G.course = course; G.scenery = buildScenery(course);
    G.run = null; G.restX = course.start; G.balls = undefined; G.roverZ = 0; G.pitch = 0;
    G.blooms = course.blooms.map(() => 0); G.goalBloom = 0; G.chain = 0; G.cushion = 0;
    G.pep.x = course.start + (size.current.h > size.current.w ? 0.2 : 1.4); G.pep.goal = G.pep.x; G.pep.pose = 'sit'; G.pep.y = 0;
    G.fx.clear(); G.ribbon = []; G.camX = course.goal; G.lastGust = -1;
    G.clicks = 0; G.turn = 0; setClicksState(0); setChapter(index); setLocked(false); setGusty(0);
    G.line = 'low'; setLineState('low');
  }, [G, courses]);

  const beginWinding = useCallback(() => {
    setPhase('winding'); G.quiet = 0;
    const W = wRef.current;
    if (G.chapter === 3) say(W.allTheWay, 'curious');
    else if (G.course.fork && G.restX < G.course.fork.at - 1 && !G.told.has('fork')) { G.told.add('fork'); say(W.fork, 'curious'); }
    else say(W.wind, 'idle');
    ambience();
  }, [G, ambience, say, setPhase]);

  /* ---------- the key ---------- */
  const afterWind = useCallback((made: number, total: number) => {
    if (!made) return;
    taught.key = true; G.quiet = 0;
    sound.current?.tick(total); void selectionHaptic();
    setClicks(total);
    G.svx += 0.5; G.svy -= 0.7; G.keyVel += 2.5;
    const at = G.keyAt, s = size.current;
    if (at) fxRef.current?.burst(at.x / s.w, (at.y - at.u * 0.5) / s.h, 'ring', { tones: ['gold-light', 'white'] });
    const W = wRef.current;
    if (total >= MAX_CLICKS) { sound.current?.stop(); say(W.full, 'wow'); G.shake = Math.max(G.shake, 3); }
    else if (total >= 3 && G.chapter !== 3) say(W.windMore, 'happy');
  }, [G, say, setClicks]);
  const tapWind = useCallback(() => {
    if (G.phase !== 'winding') return;
    if (G.clicks >= MAX_CLICKS) { sound.current?.stop(); G.shake = Math.max(G.shake, 3); say(wRef.current.full, 'wow'); return; }
    const next = wind(G.clicks); G.turn = 0;
    afterWind(1, next);
  }, [G, afterWind, say]);

  const go = useCallback(() => {
    if (G.phase !== 'winding') return;
    if (G.clicks === 0) { say(wRef.current.noWind, 'curious'); play.current?.back(); G.svx += 0.4; return; }
    // The set-piece wants the whole spring.
    if (G.chapter === 3 && G.clicks < MAX_CLICKS) { say(wRef.current.allTheWay, 'curious'); play.current?.back(); G.svx += 0.4; return; }
    setPhase('crouching'); sound.current?.crouch(); void selectionHaptic();
    say(wRef.current.go, 'wow');
  }, [G, say, setPhase]);

  const launch = useCallback(() => {
    G.run = startRun(G.course, G.restX, G.clicks, G.line, G.balls);
    G.acc = 0; G.rate = 1; G.kick = 1; G.flash = reducedRef.current ? 0 : 0.35; G.shake = 9; G.freeze = reducedRef.current ? 0 : 0.06;
    G.svx = -2.4; G.svy = 2; G.ribbon = [];
    G.fx.dust(G.restX - 0.5, G.roverZ, 14, 3);
    sound.current?.sproing(); bump(); void selectionHaptic();
    G.pep.pose = 'bow';
    setPhase('running'); setClicks(G.clicks);
  }, [G, bump, setClicks, setPhase]);

  /* ---------- touches during a run ---------- */
  const setLean = useCallback((on: boolean) => {
    if (G.lean === on) return;
    G.lean = on; setLeanHeld(on);
    if (on) { play.current?.tap(); void selectionHaptic(); if (G.run && G.run.gust < 0) say(wRef.current.leaning, 'happy'); }
  }, [G, say]);
  const chooseLine = useCallback((next: Line) => {
    if (!G.course.fork || (G.run && G.run.lineLocked) || (G.restX > G.course.fork.at && G.restX < G.course.fork.rejoin)) { play.current?.back(); return; }
    if (G.line === next) return;
    setLine(next); play.current?.pick(); void selectionHaptic();
    say(next === 'high' ? wRef.current.lineHigh : wRef.current.lineLow, 'happy');
  }, [G, say, setLine]);
  const horn = useCallback(() => { sound.current?.horn(false); G.hopV = 2.6; G.glow = 1; void selectionHaptic(); }, [G]);
  const pokePep = useCallback(() => { G.pep.vy = 4.2; G.pep.poke = 0.5; sound.current?.squeak(); void selectionHaptic(); say(wRef.current.woof, 'happy'); }, [G, say]);

  /* ---------- what a run's events do ---------- */
  const onEvents = useCallback((events: RunEvent[]) => {
    const W = wRef.current, run = G.run!;
    for (const event of events) {
      if (event.kind === 'bloom') {
        G.blooms[event.value] = Math.max(G.blooms[event.value], 0.001);
        play.current?.place(G.chain++);
        const x = G.course.blooms[event.value], z = 2.25 + (event.value % 2) * 0.55;
        G.fx.petals(x, 1.5, z, reducedRef.current ? 2 : 5, run.v * 0.12);
      } else if (event.kind === 'gust') {
        const head = event.value < 0;
        setGusty(head ? -1 : 1);
        sound.current?.rustle();
        if (head) say(W.gustHead, 'curious'); else say(W.gustTail, 'happy');
      } else if (event.kind === 'calm') setGusty(0);
      else if (event.kind === 'ramp') { say(W.ramp, 'wow'); sound.current?.knock(0.6); }
      else if (event.kind === 'air') {
        say(W.air, 'wow'); play.current?.pick(); G.fx.dust(run.x - 0.4, G.roverZ, 8, 2);
        if (G.chapter === 3 && !reducedRef.current) { G.rate = SLOW_RATE; G.shafts = 1; if (!G.told.has('swell')) { G.told.add('swell'); play.current?.setPiece(); } }
      } else if (event.kind === 'apex') { if (G.chapter !== 3 && !reducedRef.current) G.rate = BREATH_RATE; G.fx.glints(run.x, run.y + 0.5, G.roverZ, 6, 0.6); }
      else if (event.kind === 'land') {
        G.rate = 1; G.svx = 3.2; G.svy = -4.2 - Math.min(3, event.value); G.shake = 6 + Math.min(8, event.value * 1.6); G.freeze = reducedRef.current ? 0 : 0.05;
        G.fx.dust(run.x, G.roverZ, 14, 1.5); sound.current?.knock(1); sound.current?.thump(); bump(); void selectionHaptic();
      } else if (event.kind === 'rollback') say(W.rollback, 'curious');
      else if (event.kind === 'fork') { setLocked(true); say(event.value ? W.lineHigh : W.lineLow, 'happy'); }
      else if (event.kind === 'rug') sound.current?.rustle();
      else if (event.kind === 'ball') { sound.current?.thump(); G.svx += 0.8; }
      else if (event.kind === 'goal') {
        G.goalBloom = 0.001; sound.current?.bell(); say(W.goal, 'wow');
        G.fx.petals(G.course.goal + 1.2, 3.4, 3.1, 16, 1.2); G.fx.glints(G.course.goal + 1.2, 3.6, 3.1, 10, 1.2);
      } else if (event.kind === 'cushion') { G.cushion = 1; sound.current?.thump(); G.shake = Math.max(G.shake, 4); }
    }
  }, [G, bump, say]);

  const endRun = useCallback(() => {
    const run = G.run!, W = wRef.current;
    G.restX = run.x; G.balls = run.balls; G.line = run.line; G.rate = 1; G.lean = false; setLeanHeld(false); setGusty(0);
    sound.current?.quiet();
    G.run = null; setClicks(0); G.turn = 0;
    setLocked(!!G.course.fork && run.x > G.course.fork.at && run.x < G.course.fork.rejoin);
    G.pep.goal = run.goal ? run.x - (run.cushioned ? 1.7 : 0) - 1.8 : run.x + (size.current.h > size.current.w ? 0.2 : 1.5); G.pep.pose = 'side';
    if (run.goal) {
      setPhase('flourish'); play.current?.chapter(); G.bounce = run.cushioned ? run.x : null; if (run.cushioned) sound.current?.boing(3); say(G.chapter === 3 ? W.finale : W.goal, 'wow');
      for (let i = 0; i < G.blooms.length; i++) if (!G.blooms[i]) G.blooms[i] = 0.001 + i * 1e-4;
      fxRef.current?.burst(0.5, 0.42, 'confetti', { tones: ['poppy', 'amber', 'teal', 'white', 'rose'] });
    } else {
      setPhase('resting'); play.current?.place(2);
      say(fillLine(W.stopped, W.places[placeReached(G.course, run.x)]), 'happy');
    }
  }, [G, say, setClicks, setPhase]);

  /* ---------- one frame ---------- */
  const shots = useCallback(() => {
    const s = size.current, portrait = s.h > s.w * 1.05;
    const roverPx = clamp(Math.min(s.w * 0.44, s.h * 0.34), 110, 230), Z = roverPx / ROVER_FRONT.wide;
    return { Z, portrait, ax: portrait ? 0.48 : 0.42, ay: portrait ? 0.6 : 0.66 };
  }, []);

  const tick = useCallback((dtReal: number) => {
    const W = wRef.current, still = reducedRef.current;
    const dt = Math.min(0.05, dtReal);
    G.clock += dt; G.phaseT += dt;
    const { Z, portrait, ax, ay } = shots();
    const course = G.course;
    G.pep.z = portrait ? 5.6 : 4.4;

    // -- the run, stepped at the rules' own pace --
    if (G.freeze > 0) G.freeze -= dt;
    else if (G.phase === 'running' && G.run) {
      const run = G.run, events: RunEvent[] = [];
      G.acc += dt * G.rate;
      let guard = 40;
      while (G.acc >= STEP && !run.done && guard-- > 0) { stepRun(course, run, { lean: G.lean, line: G.line }, events); G.acc -= STEP; }
      if (events.length) onEvents(events);
      if (run.line !== G.line && run.lineLocked) setLine(run.line);
      const speedK = clamp(run.v / 13);
      sound.current?.whirr(speedK, clamp(turnsLeft(run) / MAX_CLICKS));
      // Dust behind the wheels, streaks of wind, the ribbon.
      if (!run.air && run.v > 2 && G.clock > G.dustAt) { G.dustAt = G.clock + (still ? 0.3 : 0.07 - speedK * 0.035); G.fx.dust(run.x - 0.45, G.roverZ, 1, run.v * 0.2); }
      if (run.gust !== 0 && G.clock > G.streakAt && !still) {
        G.streakAt = G.clock + 0.06; const dir = Math.sign(run.gust), n = G.fx.list.length;
        G.fx.streak(run.x + (dir < 0 ? 9 : -6) * (0.4 + ((n * 0.37) % 1)), 0.3 + ((n * 0.61) % 1) * 2, -1.6 + ((n * 0.83) % 1) * 5, dir * (14 + ((n * 0.29) % 1) * 6));
        if (n % 4 === 0) G.fx.add(1, run.x + (dir < 0 ? 8 : -5), 0.5 + ((n * 0.47) % 1) * 1.6, 0.5 + ((n * 0.71) % 1) * 3.5, dir * 9, 0.6, 0, 1.4, 0.15, n % 5);
      }
      if (G.rainbow) { G.ribbon.unshift({ x: run.x - 0.45, y: run.y, z: G.roverZ }); if (G.ribbon.length > 36) G.ribbon.pop(); }
      if (G.rate < 1 && run.air && !still && Math.floor(G.clock * 20) !== Math.floor((G.clock - dt) * 20)) {
        G.fx.glints(run.x, run.y + 0.4, G.roverZ, 1, 0.7);
        // Dust in the sunbeam.
        const n = G.fx.list.length; for (let i = 0; i < 2; i++) G.fx.add(4, run.x + ((n * 0.37 + i * 0.5) % 1) * 7 - 2, 0.2 + ((n * 0.61 + i * 0.3) % 1) * 3.4, -1.5 + ((n * 0.83 + i * 0.7) % 1) * 5, 0.15, 0.08, 0, 1.6, 1);
      }
      if (run.done) endRun();
    }
    const run = G.run;
    const rx = run ? run.x : G.restX, ry = run ? run.y : 0, rv = run ? run.v : 0;
    const speedK = clamp(rv / 13);

    // -- Rover's body: a spring on its squash, its hop, its lean, its line across the track --
    const targetZ = course.fork && rx > course.fork.at - 8 && rx < course.fork.rejoin + 4
      ? (G.line === 'high' ? 1 : -1) * LINE_Z * Math.min(ease((rx - (course.fork.at - 8)) / 6), 1 - ease((rx - course.fork.rejoin) / 4)) : 0;
    G.roverZ += (targetZ - G.roverZ) * Math.min(1, dt * 6);
    const wound = G.clicks / MAX_CLICKS + G.turn / MAX_CLICKS;
    let restX = 1, restY = 1;
    if (G.phase === 'winding') { restX = 1 + wound * 0.05; restY = 1 - wound * 0.07; }
    if (G.phase === 'crouching') { const k = ease(G.phaseT / CROUCH_S); restX = 1.09 + wound * 0.03; restY = 0.84 - 0.04 * k; }
    if (run?.air) { restX = 0.95; restY = 1.07; }
    G.svx += ((restX - G.sx) * 260 - G.svx * 16) * dt; G.svy += ((restY - G.sy) * 260 - G.svy * 16) * dt;
    G.sx = clamp(G.sx + G.svx * dt, 0.7, 1.3); G.sy = clamp(G.sy + G.svy * dt, 0.7, 1.3);
    G.hopV -= 16 * dt; G.hop = Math.max(0, G.hop + G.hopV * dt); if (G.hop === 0 && G.hopV < 0) G.hopV = 0;
    G.tremble = still ? 0 : G.phase === 'winding' ? Math.max(0, wound - 0.3) * 1.5 : G.phase === 'crouching' ? 2.2 : 0;
    G.leanK += ((G.lean && G.phase === 'running' ? 1 : 0) - G.leanK) * Math.min(1, dt * 12);
    // The knit rug is bumpy: Rover wobbles over it.
    const wobble = run?.onRug && !still ? Math.sin(G.clock * 38) * 0.035 * clamp(rv / 4) : 0;
    G.pitch += ((run ? run.pitch + wobble : G.phase === 'crouching' ? -0.05 : 0) - G.pitch) * Math.min(1, dt * 14);
    G.glow += ((G.phase === 'winding' || G.phase === 'crouching' ? 0.15 + wound * 0.85 : 0.3) - G.glow) * Math.min(1, dt * 5);
    // The key: it follows the wind, and spins back as the spring lets go.
    if (run) G.keyAngle -= (turnsLeft(run) > 0.05 ? 26 : 2 * speedK) * dt * G.rate;
    else { G.keyVel *= Math.exp(-6 * dt); G.keyAngle += G.keyVel * dt; }

    // -- flowers, cushion, signpost --
    for (let i = 0; i < G.blooms.length; i++) if (G.blooms[i] > 0 && G.blooms[i] < 1) G.blooms[i] = Math.min(1, G.blooms[i] + dt / (still ? 0.1 : 0.42));
    if (G.goalBloom > 0 && G.goalBloom < 1) G.goalBloom = Math.min(1, G.goalBloom + dt / (still ? 0.1 : 0.6));
    G.cushion *= Math.exp(-5 * dt);
    G.signTurn += ((G.line === 'high' ? 0.6 : -0.6) - G.signTurn) * Math.min(1, dt * 9);
    G.shafts += ((G.rate < 0.5 ? 1 : 0) - G.shafts) * Math.min(1, dt * 4);

    // -- Pep --
    const pep = G.pep;
    // He chases; in the slow moment of the big jump he stops and watches.
    if (G.phase === 'running' && run && !(G.chapter === 3 && run.air)) pep.goal = run.x - (G.chapter === 3 ? 4.5 : 2.2);
    const gap = pep.goal - pep.x;
    if (Math.abs(gap) > 0.25) {
      // He bounds: each hop carries him forward, with a squash where he lands.
      pep.pose = 'side'; pep.faceRight = gap > 0;
      const pace = Math.min(10.5, 2.5 + Math.abs(gap) * 2.2);
      pep.x += Math.sign(gap) * Math.min(Math.abs(gap), pace * dt);
      if (pep.y <= 0 && !still) { pep.vy = 3.4 + Math.min(1.6, Math.abs(gap) * 0.15); pep.sy = 0.86; pep.sx = 1.1; }
    } else if (pep.pose === 'side') { pep.pose = G.phase === 'flourish' || G.phase === 'finale' || G.phase === 'resting' ? 'bow' : 'sit'; pep.x = pep.goal; }
    if ((G.phase === 'flourish' || G.phase === 'finale') && pep.pose !== 'side' && pep.y <= 0 && !still) pep.vy = 3;
    if (G.phase === 'winding' && pep.pose === 'bow' && G.phaseT > 1.2) pep.pose = 'sit';
    pep.vy -= 15 * dt; pep.y = Math.max(0, pep.y + pep.vy * dt); if (pep.y === 0 && pep.vy < 0) pep.vy = 0;
    pep.sx += (1 - pep.sx) * Math.min(1, dt * 12); pep.sy += (1 + (still ? 0 : Math.sin(G.clock * 2.2) * 0.012) - pep.sy) * Math.min(1, dt * 12);

    // The cushion gives Rover back: it rolls out again, so its face shows for the flourish.
    if (G.bounce !== null && G.phase === 'flourish') { const k = clamp(G.phaseT / 0.6), out = 1 - (1 - k) * (1 - k); G.restX = G.bounce - 1.7 * out; if (k >= 1) G.bounce = null; }
    // -- the phases --
    if (G.phase === 'scoutPan' && G.phaseT >= (still ? 0.8 : SCOUT_S)) beginWinding();
    else if (G.phase === 'crouching' && G.phaseT >= CROUCH_S) launch();
    else if (G.phase === 'resting' && G.phaseT >= REST_S) beginWinding();
    else if (G.phase === 'flourish' && G.phaseT >= FLOURISH_S) {
      if (G.chapter >= CHAPTERS.length - 1) { setPhase('finale'); if (!G.told.has('swell')) { G.told.add('swell'); play.current?.setPiece(); } sound.current?.fanfare(); say(W.finale, 'wow'); G.fx.petals(rx, 3.5, 1.5, 24, 0); }
      else setPhase('travelling');
    } else if (G.phase === 'travelling') {
      G.fade = clamp(G.phaseT / TRAVEL_S);
      if (G.phaseT >= TRAVEL_S) {
        enterChapter(G.chapter + 1); setPhase('scoutPan');
        say(W.intro[CHAPTERS[G.chapter]], G.chapter === 3 ? 'wow' : 'curious'); flashToast(W.chapters[CHAPTERS[G.chapter]], 2400); ambience();
      }
    } else if (G.phase === 'finale') {
      if (!still && Math.floor(G.phaseT * 3) !== Math.floor((G.phaseT - dt) * 3)) { G.fx.petals(rx + (Math.sin(G.clock * 7) * 3), 4, 1 + Math.cos(G.clock * 5) * 2, 4, 0); fxRef.current?.burst(0.2 + ((G.clock * 0.37) % 0.6), 0.3, 'sparkle', { tones: ['gold-light', 'white'] }); }
      if (G.phaseT >= (still ? 1.6 : FINALE_S)) { setPhase('finished'); setFinished(true); }
    }
    if (G.phase !== 'travelling' && G.fade > 0) G.fade = Math.max(0, G.fade - dt * 2.4);
    if (G.phase === 'winding') G.quiet += dt;

    // -- the camera (a new chapter may have just been laid: read the course afresh) --
    const laid = G.course;
    const windShot: Shot = { bearing: ROVER_BEARING, elevation: portrait ? 0.27 : 0.3, distance: (portrait ? 4.4 : 5.2) - wound * 0.35, zoom: Z * (1 + wound * 0.08), ax: portrait ? ax : 0.33, ay, lead: 0 };
    let target: Shot = windShot, subjectX = rx, cut = false;
    if (G.phase === 'openShot') {
      const k = still ? 1 : ease(G.phaseT / (OPEN_S - 0.4));
      target = { bearing: lerp(0.9, ROVER_BEARING, k), elevation: lerp(portrait ? 0.46 : 0.33, 0.27, k), distance: lerp(13, 4.4, k), zoom: Z * lerp(0.4, 1, k), ax: lerp(0.5, ax, k), ay: lerp(portrait ? 0.56 : 0.7, ay, k), lead: lerp(5, 0, k) };
      cut = true;
    } else if (G.phase === 'scoutPan') {
      const k = still ? 1 : ease(G.phaseT / SCOUT_S);
      subjectX = lerp(Math.min(laid.goal, laid.start + 46), laid.start, k);
      target = { bearing: ROVER_BEARING, elevation: lerp(0.4, 0.27, k), distance: lerp(9, 4.4, k), zoom: Z * lerp(0.52, 1, k), ax, ay, lead: 0 };
      cut = true; G.camX = subjectX;
    } else if (G.phase === 'crouching') target = { ...windShot, distance: 3.9, zoom: Z * 1.14 };
    else if (G.phase === 'running' && run) {
      if (G.rate <= SLOW_RATE + 0.01 && run.air) target = { bearing: ROVER_BEARING, elevation: 0.11, distance: 4.6, zoom: Z * 0.98, ax: 0.5, ay: 0.52, lead: 0.4 };
      else if (run.air) target = { bearing: -ROVER_BEARING * 0.85, elevation: 0.12, distance: 5.4, zoom: Z * 0.72, ax: portrait ? 0.4 : 0.34, ay: 0.56, lead: portrait ? 0.3 : 0.8 };
      else target = { bearing: -(ROVER_BEARING + (portrait ? 0.26 : 0.1) * speedK), elevation: 0.25 - 0.03 * speedK, distance: 4.6 + 1.7 * speedK, zoom: Z * (0.94 - 0.2 * speedK), ax: portrait ? 0.36 : 0.3, ay: portrait ? 0.66 : 0.68, lead: portrait ? 0.15 + 0.35 * speedK : 0.3 + 1.3 * speedK };
    } else if (G.phase === 'resting') target = { ...windShot, distance: 4.9, zoom: Z * 0.92 };
    else if (G.phase === 'flourish' || G.phase === 'travelling') target = { bearing: ROVER_BEARING + 0.1, elevation: 0.3, distance: 6.2, zoom: Z * 0.72, ax: 0.44, ay: 0.64, lead: 0.6 };
    else if (G.phase === 'finale' || G.phase === 'finished') target = { bearing: ROVER_BEARING + (still ? 0.1 : Math.min(0.35, G.phaseT * 0.07)), elevation: 0.3, distance: 7.2, zoom: Z * 0.62, ax: 0.46, ay: 0.64, lead: 0.4 };
    if (!G.shot || cut || still || Math.sign(G.shot.bearing) !== Math.sign(target.bearing)) G.shot = { ...target };
    else {
      const k = Math.min(1, dt * (G.phase === 'running' ? 3.2 : 4.5)), s = G.shot;
      s.bearing = lerp(s.bearing, target.bearing, k); s.elevation = lerp(s.elevation, target.elevation, k); s.distance = lerp(s.distance, target.distance, k);
      s.zoom = lerp(s.zoom, target.zoom, k); s.ax = lerp(s.ax, target.ax, k); s.ay = lerp(s.ay, target.ay, k); s.lead = lerp(s.lead, target.lead, k);
    }
    if (G.phase !== 'scoutPan') G.camX += (subjectX - G.camX) * Math.min(1, dt * (G.phase === 'running' ? 11 : 6));
    if (Math.abs(subjectX - G.camX) > 30) G.camX = subjectX;
    const beauty = G.phase === 'running' && !!run?.air && G.rate <= SLOW_RATE + 0.01;
    G.camY += ((0.45 + ry * (beauty ? 0.72 : 0.55)) - G.camY) * Math.min(1, dt * (beauty ? 14 : 8));
    G.kick = Math.max(0, G.kick - dt * 1.8); G.shake *= Math.exp(-7 * dt); G.flash = Math.max(0, G.flash - dt * 4);
    const shot = { ...G.shot };
    if (!still) {
      // The launch widens the lens for a moment; the pointer nudges the view.
      shot.distance *= 1 - 0.16 * G.kick; shot.zoom /= 1 - 0.1 * G.kick;
      shot.bearing += G.px * 0.035; shot.elevation = Math.max(0.04, shot.elevation - G.py * 0.02);
    }
    const s = size.current;
    const cam = shotCamera(shot, { x: G.camX, y: G.camY, z: G.roverZ * 0.5 }, s.w, s.h);
    if (!still && G.shake > 0.05) { cam.cx += Math.sin(G.clock * 97) * G.shake; cam.cy += Math.cos(G.clock * 83) * G.shake * 0.8; }
    if (!still && G.phase === 'running' && speedK > 0.5) { cam.cy += Math.sin(G.clock * 61) * (speedK - 0.5) * 1.6; }
    G.cam = cam;
    G.fx.step(dt * (G.phase === 'running' ? Math.max(0.3, G.rate) : 1));

    // -- draw --
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d') ?? null;
    const view = roverView(cam);
    if (canvas && ctx && world.current) {
      ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      const f: Frame = {
        width: s.w, height: s.h, time: G.clock, cam, course: laid, scenery: G.scenery, sun: G.sun, reduced: still,
        rover: { x: rx, y: ry + G.hop, z: G.roverZ, pitch: G.pitch, sx: G.sx, sy: G.sy, rear: view.face === 'rear', flip: view.flip, glow: G.glow, keyAngle: G.keyAngle, keySpin: run && turnsLeft(run) > 0.05 ? 1 : 0, tight: wound, tremble: G.tremble, lean: G.leanK, wheel: wheelAngle(rx), roll: clamp(rv / 7) },
        pep: { x: pep.x, y: pep.y, z: pep.z, pose: pep.pose, flip: pep.pose === 'side' ? pep.faceRight === cam.rx > 0 : cam.rx < 0, sx: pep.sx, sy: pep.sy, show: true },
        blooms: G.blooms, goalBloom: G.goalBloom, balls: (run ? run.balls : G.balls ?? laid.balls.map(b => ({ x: b.at, line: b.line }))).map(b => ({ x: b.x, z: b.line === 'low' ? -LINE_Z : b.line === 'high' ? LINE_Z : 0 })),
        cushion: G.cushion, signTurn: G.signTurn, line: G.line, speed: G.phase === 'running' ? clamp((rv - 5) / 8) : 0, flash: G.flash, fade: G.fade,
        ribbon: G.rainbow && G.ribbon.length ? G.ribbon : null, shafts: G.shafts, fx: G.fx,
      };
      world.current.draw(ctx, f);
    }
    // -- the key's touch target and the hint hand follow the picture --
    const base = project(cam, rx, ry + G.hop, G.roverZ);
    if (base) {
      const k = ROVER_FRONT.wide * base.scale / ROVER_FRONT.w, sign = view.flip ? -1 : 1;
      const kx = base.x + (ROVER_MARKS.buttonX - ROVER_FRONT.footX) * k * sign, ky = base.y + (ROVER_MARKS.buttonY - ROVER_FRONT.footY) * k - base.scale * 0.45;
      G.keyAt = { x: kx, y: ky, u: base.scale };
      const button = keyRef.current;
      if (button) { const d = clamp(base.scale * 1.5, 132, 300); button.style.transform = `translate(${(kx - d / 2).toFixed(1)}px, ${(ky - d / 2 + base.scale * 0.1).toFixed(1)}px)`; button.style.width = `${d.toFixed(0)}px`; button.style.height = `${d.toFixed(0)}px`; }
      const hand = handRef.current;
      if (hand) {
        const show = G.phase === 'winding' && !G.drag && !taught.key && G.quiet > 1.4 || (G.phase === 'winding' && !G.drag && G.clicks === 0 && G.quiet > 7);
        hand.style.opacity = show ? '1' : '0';
        if (show) { const a = still ? -0.6 : G.clock * 3.2, r = base.scale * 0.52; hand.style.transform = `translate(${(kx + Math.cos(a) * r).toFixed(1)}px, ${(ky + Math.sin(a) * r * 0.62).toFixed(1)}px)`; }
      }
    }
  }, [G, ambience, beginWinding, endRun, enterChapter, flashToast, launch, onEvents, say, setLine, setPhase, shots]);

  /* ---------- the loop ---------- */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    palette.current = new Palette(canvas.parentElement ?? document.body); world.current = new World(palette.current);
    const measure = () => {
      const wide = canvas.offsetWidth, tall = canvas.offsetHeight; if (!wide || !tall) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: wide, h: tall, dpr };
      const pw = Math.round(wide * dpr), ph = Math.round(tall * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(canvas);
    const loop = (time: number) => {
      frame.current = 0;
      if (!alive.current) return;
      const dt = lastTime.current ? (time - lastTime.current) / 1000 : 1 / 60; lastTime.current = time;
      // A frame that throws must not stop the game: the next one draws again.
      try { tick(dt); } catch (error) { if (!broken.current) { broken.current = true; console.error(error); } }
      if (document.visibilityState !== 'hidden') frame.current = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; lastTime.current = 0; sound.current?.quiet(); G.lean = false; }
      else if (!frame.current) frame.current = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVisibility);
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current); frame.current = 0; lastTime.current = 0;
      observer?.disconnect(); document.removeEventListener('visibilitychange', onVisibility);
      palette.current?.dispose(); palette.current = null; world.current = null;
    };
  }, [G, tick]);

  /* ---------- pointers ---------- */
  const angleTo = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current, at = G.keyAt; if (!canvas || !at) return 0;
    const box = canvas.getBoundingClientRect(), kx = box.left + at.x * (box.width / size.current.w), ky = box.top + at.y * (box.height / size.current.h);
    return Math.atan2((clientY - ky) / 0.7, clientX - kx);
  };
  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (G.phase !== 'winding') return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* No capture: the drag still works while over the target. */ }
    G.drag = { id: event.pointerId, angle: angleTo(event.clientX, event.clientY), moved: 0, startX: event.clientX, startY: event.clientY, teeth: 0 };
    G.quiet = 0; play.current?.tap();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = G.drag; if (!drag || drag.id !== event.pointerId || G.phase !== 'winding') return;
    const now = angleTo(event.clientX, event.clientY);
    let delta = now - drag.angle; if (delta > Math.PI) delta -= TWO_PI; if (delta < -Math.PI) delta += TWO_PI;
    drag.angle = now; drag.moved += Math.hypot(event.movementX || 0, event.movementY || 0) + Math.abs(delta) * 20;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6 && Math.abs(delta) < 0.02) return;
    const turns = delta / TWO_PI;
    if (turns > 0) {
      G.backTurns = 0;
      const before = G.clicks, result = dragKey(G.clicks, G.turn, turns);
      G.turn = result.turn; G.keyAngle += delta * (result.clicks >= MAX_CLICKS && !result.made ? 0.05 : 0.5 + 0.5 / (1 + before * 0.09));
      drag.teeth += turns * 8; if (drag.teeth >= 1 && before < MAX_CLICKS) { drag.teeth = 0; sound.current?.tooth(); }
      if (result.made) { G.clicks = result.clicks; afterWind(result.made, result.clicks); }
      else if (before >= MAX_CLICKS && drag.teeth >= 1) { drag.teeth = 0; sound.current?.stop(); G.shake = Math.max(G.shake, 2); }
      G.quiet = 0;
    } else if (turns < 0) {
      // The ratchet holds a backward turn. A whole one, though, and the key plays its tune.
      G.backTurns -= turns; G.keyAngle += delta * 0.04;
      if (G.backTurns >= 1 && !G.rainbow) {
        G.rainbow = true; G.backTurns = 0; say(wRef.current.secret, 'wow');
        [0, 2, 4, 5, 7, 9].forEach((step, i) => play.current?.note(5 + step, { at: i * 0.12, gain: 0.04, length: 0.5 }));
        const at = G.keyAt, s = size.current;
        if (at) fxRef.current?.burst(at.x / s.w, at.y / s.h, 'sparkle', { tones: ['poppy', 'amber', 'leaf', 'sea', 'violet'] });
        G.fx.petals(G.restX, 1.4, G.roverZ, 12, 0); void selectionHaptic();
      }
    }
  };
  const endDrag = (event: ReactPointerEvent<HTMLElement>, tap: boolean) => {
    const drag = G.drag; if (!drag || drag.id !== event.pointerId) return;
    G.drag = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    if (tap && drag.moved < 8) tapWind();
  };
  const onCanvasDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas || !world.current) return;
    const box = canvas.getBoundingClientRect(), x = (event.clientX - box.left) * (size.current.w / box.width), y = (event.clientY - box.top) * (size.current.h / box.height);
    // Nearest toy under the finger, if any.
    let best: { id: string; d: number } | null = null;
    for (const hit of world.current.hits) { const d = Math.hypot(hit.x - x, hit.y - y) / hit.r; if (d < 1 && (!best || d < best.d)) best = { id: hit.id, d }; }
    if (G.phase === 'running') {
      if (best?.id === 'signDisc') { chooseLine(G.line === 'high' ? 'low' : 'high'); return; }
      if (G.course.gusts.length) { try { canvas.setPointerCapture(event.pointerId); } catch { /* Fine without. */ } setLean(true); }
      else horn();
      return;
    }
    if (best) {
      const id = best.id;
      if (id === 'pepDog') pokePep();
      else if (id === 'signDisc') chooseLine(G.line === 'high' ? 'low' : 'high');
      else if (id === 'roverCar') { if (G.phase === 'winding') startDrag(event); else horn(); }
      else if (id === 'cushion') { G.cushion = 1; sound.current?.thump(); void selectionHaptic(); }
      else if (id === 'woolBall') { sound.current?.boing(4); void selectionHaptic(); G.fx.glints(G.restX + 2, 0.6, 0, 3, 0.4); }
      else if (id === 'goalFlower') { G.fx.petals(G.course.goal + 1.2, 3.2, 3.1, 6, 0); sound.current?.plink(6); void selectionHaptic(); }
      else if (id.startsWith('bloom')) {
        const i = Number(id.slice(5)), bx = G.course.blooms[i];
        if (Number.isFinite(bx)) { G.fx.petals(bx, 1.5, 2.25 + (i % 2) * 0.55, 4, 0); sound.current?.plink(i % 8); void selectionHaptic(); if (G.blooms[i] >= 1) G.blooms[i] = 0.5; }
      }
      return;
    }
    if (G.phase === 'winding') startDrag(event);
    else if (G.phase === 'openShot') { /* The opening owns the first tap. */ }
    else { play.current?.tap(); G.fx.glints(G.restX, 1.2, G.roverZ, 2, 0.5); }
  };
  const onCanvasUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (G.drag) endDrag(event, false);
    if (G.lean) { setLean(false); try { canvasRef.current?.releasePointerCapture(event.pointerId); } catch { /* Already released. */ } }
  };
  const onStageMove = (event: ReactPointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect(); if (!box.width) return;
    G.px = ((event.clientX - box.left) / box.width) * 2 - 1; G.py = ((event.clientY - box.top) / box.height) * 2 - 1;
  };

  /* ---------- keys ---------- */
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select')) return;
      const onButton = !!target?.closest('button');
      if (event.key === ' ' || event.code === 'Space') {
        if (G.phase === 'winding' && !onButton) { event.preventDefault(); if (!event.repeat) tapWind(); }
        else if (G.phase === 'running') { event.preventDefault(); setLean(true); }
      } else if (event.key === 'Enter' && !onButton) { if (G.phase === 'winding') { event.preventDefault(); go(); } }
      else if (event.key === 'ArrowUp') { if (G.course.fork) { event.preventDefault(); chooseLine('high'); } }
      else if (event.key === 'ArrowDown') { if (G.course.fork) { event.preventDefault(); chooseLine('low'); } }
      else if ((event.key === 'h' || event.key === 'H') && !event.repeat) horn();
    };
    const up = (event: KeyboardEvent) => { if (event.key === ' ' || event.code === 'Space') setLean(false); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [G, chooseLine, go, horn, setLean, tapWind]);

  const openingDone = useCallback(() => {
    if (G.phase !== 'openShot') return;
    flashToast(wRef.current.chapters[CHAPTERS[G.chapter]], 2400);
    beginWinding();
  }, [G, beginWinding, flashToast]);

  if (finished) {
    return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction}>
      <section className="wr" data-adventure="windup-race" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={onAgain} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  // The set-piece run is framed like a film: bars in, the HUD out of the way, until Rover is at rest.
  const framed = chapter === 3 && (phase === 'crouching' || phase === 'running');
  const steps = CHAPTERS.map((id, index) => ({ key: id, label: w.chapters[id], done: index < chapter || (index === chapter && (phase === 'flourish' || phase === 'travelling' || phase === 'finale')), icon: <ChapterMark index={index} /> }));
  const windingNow = phase === 'winding';
  const forkOpen = !!courses[chapter].fork && !locked && (windingNow || phase === 'running') && G.restX < (courses[chapter].fork?.at ?? 0);
  const needFull = chapter === 3;
  const canGo = windingNow && clicks > 0 && (!needFull || clicks >= MAX_CLICKS);
  const hearIt = `${coach.line} ${w.instruction} ${w.keys}`;

  return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction} hearIt={hearIt}>
    <section className="wr" data-adventure="windup-race" data-phase={phase} data-chapter={CHAPTERS[chapter]} data-clicks={clicks} data-line={line} data-light={light} data-gust={gusty < 0 ? 'head' : gusty > 0 ? 'tail' : undefined} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <PlayStage id="windup-race" grade="day" shake={shake} setPiece={framed}
        world={<div className="play-layer wr-world" dir="ltr" onPointerMove={onStageMove}>
          <canvas ref={canvasRef} className="play-layer wr-canvas" role="img" aria-label={w.scene}
            onPointerDown={onCanvasDown} onPointerMove={moveDrag} onPointerUp={onCanvasUp} onPointerCancel={onCanvasUp} />
          <button ref={keyRef} type="button" className="wr-key" data-wr-key="" hidden={!windingNow} aria-label={fillLine(w.key, w.tension[tension(clicks)])}
            onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={event => endDrag(event, true)} onPointerCancel={event => endDrag(event, false)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!event.repeat) tapWind(); } }} />
          <div ref={handRef} className="wr-hand" aria-hidden="true"><HintHand /></div>
          <PlayFx ref={fxRef} layer={6} />
        </div>}>
        <HudCoach who="pep" mood={coach.mood} line={phase === 'openShot' ? w.hello : coach.line} onPoke={pokePep} pokeLabel={w.pep} quiet={framed} />
        <HudQuest steps={steps} current={chapter} label={w.quest} />
        <HudToast show={toast.show}>{toast.text}</HudToast>
        <HudDock label={w.title}>
          {windingNow && <HudButton label={w.windButton} icon={<RotateCw />} tone="paper" size="l" onClick={tapWind} cue={clicks === 0} data={{ 'data-wr-wind': '' }} />}
          {canGo && <HudButton label={w.goButton} icon={<Play data-flip="" />} tone="go" size="l" onClick={go} data={{ 'data-wr-go': '' }} />}
          {forkOpen && <HudButton label={line === 'high' ? w.linePlank : w.lineRug} icon={line === 'high' ? <ArrowUpFromLine /> : <ArrowDownToLine />} tone="chosen" onClick={() => chooseLine(line === 'high' ? 'low' : 'high')} data={{ 'data-wr-line': line }} />}
          {phase === 'running' && courses[chapter].gusts.length > 0 && <button type="button" className="play-button wr-lean" data-tone={leanHeld ? 'chosen' : 'paper'} data-size="l" data-cue={gusty < 0 && !leanHeld ? '' : undefined} data-wr-lean="" aria-pressed={leanHeld}
            onPointerDown={event => { try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Fine without. */ } setLean(true); }} onPointerUp={() => setLean(false)} onPointerCancel={() => setLean(false)} onLostPointerCapture={() => setLean(false)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setLean(true); } }} onKeyUp={() => setLean(false)} onBlur={() => setLean(false)} onContextMenu={event => event.preventDefault()}>
            <span className="play-button__icon" aria-hidden="true"><Wind /></span><span className="play-button__label">{w.lean}</span>
          </button>}
        </HudDock>
        {phase === 'openShot' && <PlayOpening title={w.title} place={w.place} onDone={openingDone} holdMs={reduced ? 1400 : OPEN_S * 1000} />}
        <PlaySetPiece active={framed} caption={w.caption} />
      </PlayStage>
    </section>
  </GameShell>;
}

/** The quest strip's four marks: a straight, a gust, a fork, the sun in an arch. */
function ChapterMark({ index }: { index: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg viewBox="0 0 18 18" aria-hidden="true">
    {index === 0 && <path d="M2.5 9h10m-3.2-3.4L12.8 9l-3.5 3.4" {...common} />}
    {index === 1 && <path d="M2.5 6.6h7.2a2 2 0 1 0-2-2M2.5 11.4h10a2.1 2.1 0 1 1-2.1 2.1" {...common} />}
    {index === 2 && <path d="M2.5 9h4.2c2.4 0 2.6-4.2 5-4.2h3.6M6.7 9c2.4 0 2.6 4.2 5 4.2h3.6" {...common} />}
    {index === 3 && <><path d="M3.4 15.5V9a5.6 5.6 0 0 1 11.2 0v6.5" {...common} /><circle cx="9" cy="10.2" r="2" {...common} /></>}
  </svg>;
}
/** The hint hand that circles the key until the child has turned it. */
function HintHand() {
  return <svg viewBox="0 0 40 46" width="40" height="46" aria-hidden="true">
    <path d="M15 4.5c0-1.9 1.4-3.2 3.1-3.2s3.1 1.3 3.1 3.2v13l7.6 1.7c3.2.7 5.4 3.5 5.2 6.8l-.5 8.4c-.3 5.2-4.6 9.3-9.8 9.3h-3.900c-3.300 0-6.400-1.700-8.200-4.400l-7-10.700c-1-1.600-.6-3.600.900-4.700 1.400-1 3.300-.8 4.500.4l5 5z" className="wr-hand__glove" />
  </svg>;
}
