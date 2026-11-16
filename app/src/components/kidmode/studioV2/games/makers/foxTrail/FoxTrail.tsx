import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { ChevronsDown, ChevronsUp, Flower2, Play, Waves, Wind } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, roundSeed, useReducedMotion, useShake,
  type CoachMood, type CoachWho, type FxKind, type FxOptions, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { FOX_TRAIL_COPY } from './foxTrailCopy';
import {
  ROLL_T, STEP_DT, buildCourse, cameraX, chainNote, clamp, duskDepth, initialRun, step, suggest, sweepX, warmth,
  type Course, type Hurdle, type Lamp, type Move, type RunEvent, type RunInput, type RunState,
} from './foxTrailRules';
import { STRIDE, applyPepPose, pepPose, type PuppetParts } from './pepPuppet';
import { BLOOMS, DOME_SUN, FERNS, FRIENDS, GATHER, HORIZON, LAYERS, LEAD, PEP_SIDE, PLATES, SKY, SPRITES, STATION_CREW, WALL, pepParts, type FriendId } from './foxKit';
import '../makerPalette.css';
import './foxTrail.css';

type Lang = 'en' | 'he';
type Words = (typeof FOX_TRAIL_COPY)[Lang];
type LineKey = Extract<keyof Words, `line${string}`>;
type Act = 'opening' | 'running' | 'resting' | 'finale';
type Fin = '' | 'arrive' | 'charge' | 'wave' | 'crew';
const TAU = Math.PI * 2;
const PEP = pepParts();
const ROLL_RADIUS = 34;
const INTRO_RUN = 560, INTRO_S = 1.7;
const SWEEP_S = 3.8;
const SWIPE_WAIT_MS = 70;
/** How far the lights have come back: 0 none, 1 the trail, then one valley layer at a time (near to far), last the sky. */
const GLOW_ALL = LAYERS.length + 2, NEAR = LAYERS[LAYERS.length - 1];
const HOSTS: readonly CoachWho[] = ['aya', 'chock', 'gobgob'];
/** The finale's beats, in milliseconds from Pep's stop at the Dome. */
const FIN_MS = { charge: 1300, flash: 2200, sweep: 2600, cut: 7200, end: 10200, reducedEnd: 5200 } as const;
const bg = (src: string) => `url(${src})`;
/** Dust in dusk light: lilac and shaded snow, never a white puff. */
/** Clouds on the sky plate: left, top, width (percent of the plate) and how many seconds one drift takes. */
const CLOUDS: readonly (readonly [number, number, number, number])[] = [[30, 84, 20, 90], [56, 81, 14, 120], [16, 86.5, 12, 150], [64, 77.5, 16, 110], [40, 72, 13, 140]];
const DUST = ['linen-shade', 'sand', 'lilac'] as const;

export default function FoxTrail() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = FOX_TRAIL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  // A fresh seed every sitting: the planters, bunting, pads, the tune and the star's updraft all move.
  const [seed, setSeed] = useState(roundSeed);
  const [said, setSaid] = useState('');
  return <GameShell fullBleed autoNarrate={false} worldId="fox-trail" title={w.title} instruction={w.instruction} hearIt={said || w.instruction}>
    <section className="ft" data-adventure="fox-trail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setSaid(''); setSeed(roundSeed()); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <TrailRun key={seed} seed={seed} w={w} onSay={setSaid} onDone={() => setDone(true)} />}
    </section>
  </GameShell>;
}

/** Where the three kinds of ground begin and end along the course. */
function zonesOf(course: Course) {
  const [gardens, bridge] = course.stretches;
  const bridgeFrom = gardens.station + 330, bridgeTo = bridge.station + 330, basinTo = course.length - 330;
  // The causeway of float pads: the basin's path, broken at every gap.
  const pads: { from: number; to: number }[] = [];
  let from = bridgeTo;
  for (const h of course.hurdles) {
    if (h.kind !== 'padGap') continue;
    pads.push({ from, to: h.x - h.w / 2 }); from = h.x + h.w / 2;
  }
  pads.push({ from, to: basinTo });
  return { bridgeFrom, bridgeTo, basinTo, pads, end: course.length + 1700 };
}
const smooth = (lo: number, hi: number, v: number) => { const t = clamp((v - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t); };

interface Geometry { W: number; H: number; k: number; gy: number; viewW: number; lead: number; skyTop: number; skyW: number; /** Where the flower bed at the camera's feet begins, in units below the path. */ bedTop: number }

function TrailRun({ w, seed, onSay, onDone }: { w: Words; seed: number; onSay: (text: string) => void; onDone: () => void }) {
  const course = useMemo(() => buildCourse(seed), [seed]);
  const zones = useMemo(() => zonesOf(course), [course]);
  const reduced = useReducedMotion(); const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const [shake, bumpShake] = useShake();
  const [act, setAct] = useState<Act>('opening');
  const [stretch, setStretch] = useState(0);
  const [reached, setReached] = useState(0);
  const [say, setSay] = useState<{ who: CoachWho; mood: CoachMood; key: LineKey }>({ who: 'aya', mood: 'idle', key: 'lineOpen' });
  const [cue, setCue] = useState<Move | ''>('');
  const [win, setWin] = useState(0);
  const [glow, setGlow] = useState(0);
  const [camera, setCamera] = useState<PlayCamera>({ x: 0.4, y: 0.66, zoom: 1.18 });
  const [fin, setFin] = useState<Fin>('');
  const [flash, setFlash] = useState(0);
  const [starToast, setStarToast] = useState(false);
  const [view, setView] = useState({ w: 900, lead: LEAD.wide as number });

  const rootRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailRef = useRef<HTMLDivElement>(null);
  const domeRef = useRef<HTMLDivElement>(null);
  const bloomRef = useRef<HTMLDivElement>(null);
  const fernRef = useRef<HTMLDivElement>(null);
  const deepRef = useRef<HTMLElement>(null);
  const warmRef = useRef<HTMLElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const pepRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const camLightRef = useRef<HTMLElement>(null);
  const streakRef = useRef<HTMLElement>(null);
  const starRef = useRef<HTMLSpanElement>(null);
  const parts = useRef<PuppetParts>({}).current;
  const mirrorParts = useRef<PuppetParts>({}).current;
  const lampEls = useRef(new Map<number, HTMLElement>()).current;
  const hurdleEls = useRef(new Map<number, HTMLElement>()).current;
  const friendEls = useRef(new Map<string, HTMLElement>()).current;
  const fx = useRef<PlayFxHandle>(null);
  const sound = useRef<PlaySound | null>(null);
  const state = useRef<RunState>(initialRun(course));
  const keys = useRef({ hold: false, pointer: -1, downY: 0, downX: 0, swiped: false, pending: 0 });
  const edges = useRef<RunInput>({});
  const geo = useRef<Geometry>({ W: 0, H: 0, k: 1, gy: 0, viewW: 900, lead: LEAD.wide, skyTop: 0, skyW: 0, bedTop: 58 });
  /** What the loop and the finale share without a render. */
  const live = useRef({ t: 0, cam: 0, front: Infinity, sweepAt: -1, allLit: false, introAt: 0, joy: 0, shake: 0, flip: -1, sayUntil: 0, lastCue: '' as Move | '', gather: false });
  /** Beats still to come, on the loop's own clock: a slow frame or a hidden tab delays them with the picture, never ahead of it. */
  const beats = useRef<{ at: number; run: () => void }[]>([]);
  const later = (ms: number, run: () => void) => { const at = live.current.t + ms / 1000, list = beats.current; let i = list.length; while (i > 0 && list[i - 1].at > at) i--; list.splice(i, 0, { at, run }); };

  const tell = (key: LineKey, mood: CoachMood, hold = 2.4, who?: CoachWho, force = true) => {
    const L = live.current;
    if (!force && L.t < L.sayUntil) return;
    L.sayUntil = L.t + hold;
    setSay(prev => ({ who: who ?? prev.who, mood, key })); onSay(w[key]);
  };
  /** A burst at a place in the world (units; y up from the path). */
  const spark = (x: number, y: number, kind: FxKind, opts?: FxOptions) => {
    const G = geo.current; if (!G.W) return;
    fx.current?.burst((x - live.current.cam) * G.k / G.W, (G.gy - y * G.k) / G.H, kind, opts);
  };
  const lampRef = (id: number) => (el: HTMLElement | null) => { if (el) lampEls.set(id, el); else lampEls.delete(id); };
  const hurdleRef = (id: number) => (el: HTMLElement | null) => { if (el) hurdleEls.set(id, el); else hurdleEls.delete(id); };
  const friendRef = (id: string) => (el: HTMLElement | null) => { if (el) friendEls.set(id, el); else friendEls.delete(id); };
  /** Restarts a one-shot CSS answer on an element (a wobble, a hop): the attribute flips between two twins. */
  const nudge = (el: HTMLElement | undefined | null, name: string) => { if (el) el.dataset[name] = el.dataset[name] === 'a' ? 'b' : 'a'; };
  const cheer = (who: FriendId | 'sun') => nudge(friendEls.get(who), 'cheer');

  // The one loop: fixed-step simulation, then everything moved by hand (no React render per frame).
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    const play = createPlaySound({ key: 'D' }); sound.current = play;
    const L = live.current;
    const A = { acc: 0, last: 0, camY: 0, lastVx: 0, accel: 0, tuck: 0, spin: 0, squash: 0, stretch: 0, foot: 0, rise: 0, deep: -1, warm: -1, speed: -1, win: -99, starX: 0, starY: 0, lastStretch: -1, sit: 0, sweepNote: 0, cheered: new Set<number>(), mirrorOn: false, trailAt: 0, airAt: 1.5 };

    const resize = () => {
      const W = root.offsetWidth, H = root.offsetHeight; if (!W || !H) return;
      const narrow = W < H * 0.95;
      const k = narrow ? W / 455 : Math.max(H / 470, W / 1050);
      const gy = H * (narrow ? 0.735 : 0.75), viewW = W / k, lead = narrow ? LEAD.narrow : LEAD.wide;
      // The sky plate: big enough to cover the view above the lake line and the whole of its slow drift.
      const ks = Math.max(k * (narrow ? SKY.narrow : SKY.wide), W * 1.56 / PLATES.sky.dusk.w, (gy - HORIZON * k + 40) / (PLATES.sky.dusk.h * SKY.lakeRow));
      const skyTop = gy - HORIZON * k - PLATES.sky.dusk.h * SKY.lakeRow * ks;
      geo.current = { W, H, k, gy, viewW, lead, skyTop, skyW: PLATES.sky.dusk.w * ks, bedTop: Math.max(58, (H - gy) / k - PLATES.blooms.dusk.h * BLOOMS.k + 6) };
      if (skyRef.current) { skyRef.current.style.width = `${(PLATES.sky.dusk.w * ks).toFixed(0)}px`; skyRef.current.style.height = `${(PLATES.sky.dusk.h * ks).toFixed(0)}px`; }
      setView(prev => (Math.abs(prev.w - viewW) < 1 && prev.lead === lead ? prev : { w: viewW, lead }));
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(root);

    const input = (): RunInput => { const e = edges.current; edges.current = {}; return { ...e, hold: keys.current.hold }; };
    const stretchSay = (n: number) => { tell(n === 0 ? 'lineStart' : n === 1 ? 'lineBridge' : 'lineBasin', 'idle', 3, HOSTS[n]); };

    const handle = (s: RunState, events: readonly RunEvent[]) => {
      for (const ev of events) {
        switch (ev.kind) {
          case 'setOff': {
            play.pick(); play.ambience(s.stretch === 0 ? PLAY_AMBIENCE.garden : s.stretch === 1 ? PLAY_AMBIENCE.wind : PLAY_AMBIENCE.water);
            setAct('running'); setStretch(s.stretch); stretchSay(s.stretch); A.stretch = 0.8; spark(s.x - 20, 4, 'dust', { tones: DUST,  angle: 180, arc: 70, count: 8 });
            break;
          }
          case 'jumpUp': play.note(8, { gain: 0.03, length: 0.16 }); play.breath({ tone: 1500, gain: 0.016, length: 0.12 }); A.stretch = 1; spark(s.x - 14, Math.max(0, s.y), s.wading ? 'drop' : 'dust', { tones: DUST,  count: 5, angle: 200, arc: 80, spread: 0.7 }); break;
          case 'touchDown': play.breath({ tone: 480, gain: 0.03, length: 0.1 }); A.squash = 1; spark(s.x, 2, 'dust', { tones: DUST,  count: 7, angle: 180, arc: 150, spread: 0.8 }); break;
          case 'rollIn': play.breath({ tone: 1100, gain: 0.03, length: 0.34 }); play.note(4, { gain: 0.022, length: 0.2 }); spark(s.x - 10, 6, 'dust', { tones: DUST,  count: 6, angle: 180, arc: 60 }); break;
          case 'rollOut': if (s.onGround) spark(s.x + 10, 4, 'dust', { tones: DUST,  count: 4, angle: 0, arc: 80, spread: 0.6 }); break;
          case 'diveIn': play.breath({ tone: 1900, gain: 0.02, length: 0.22 }); break;
          case 'softBump': {
            const h = course.hurdles[ev.id ?? 0];
            // A soft bounce and a laugh: three quick high notes, never a buzzer.
            play.back(); [13, 15, 13].forEach((n, i) => play.note(n, { at: 0.14 + i * 0.085, gain: 0.03, length: 0.09 }));
            nudge(hurdleEls.get(h.id), 'hit'); void selectionHaptic(); bumpShake();
            if (h.kind === 'planterBox') { L.flip = L.t; spark(h.x, h.h, 'petal', { count: 9, tones: ['blossom', 'rose', 'leaf'] }); tell('lineBounce', 'curious', 2.2); }
            else { spark(h.x, h.h, 'chip', { count: 8, tones: ['sun', 'rose', 'sky', 'white'] }); tell('lineFlop', 'curious', 2.2); }
            break;
          }
          case 'waterSplash': play.breath({ tone: 1700, gain: 0.045, length: 0.36 }); play.note(3, { gain: 0.03, length: 0.3 }); spark(s.x, 0, 'drop', { count: 14, angle: 270, arc: 120, spread: 1.2 }); spark(s.x, -2, 'ring', { tones: ['white'] }); if (ev.id != null && ev.id >= 0) tell('lineSplash', 'curious', 2.2); void selectionHaptic(); break;
          case 'climbOut': L.shake = 1; spark(s.x, 20, 'drop', { count: 10, spread: 0.8 }); play.breath({ tone: 2600, gain: 0.02, length: 0.3 }); break;
          case 'cleanPass': nudge(hurdleEls.get(ev.id ?? -1), 'pass'); break;
          case 'lampLit': {
            const l = course.lamps[ev.id ?? 0], el = lampEls.get(l.id);
            if (el) el.dataset.lit = 'true';
            const n = ev.n ?? 1;
            play.note(chainNote(course, n), { gain: 0.052, length: 0.55 }); play.note(chainNote(course, n) + 5, { gain: 0.012, length: 0.2, at: 0.012 });
            spark(l.x, l.tier === 'pathLamp' ? 84 : l.y, 'sparkle', { count: n > 6 ? 12 : 8, tones: ['butter', 'gold-light', 'white'], size: l.tier === 'pathLamp' ? 0.8 : 1 });
            if (n === 2 && s.stretch === 0 && s.bumps === 0) tell('lineLamp', 'happy', 2.6, undefined, false);
            else if (n === 6) tell('lineTune', 'happy', 2.4, undefined, false);
            else if (n > 6 && n % 8 === 0) tell('lineTuneMore', 'wow', 2.4, undefined, false);
            break;
          }
          case 'lampWaits': play.note(2, { gain: 0.012, length: 0.14 }); nudge(lampEls.get(ev.id ?? -1), 'blink'); break;
          case 'liftOff': play.breath({ tone: 720, gain: 0.03, length: 1 }); tell('lineLift', 'happy', 2.2, undefined, false); break;
          case 'starFound': [12, 14, 16, 19].forEach((n, i) => play.note(n, { at: i * 0.09, gain: 0.04, length: 0.5 })); spark(course.star.x, course.star.y, 'sparkle', { count: 20, tones: ['white', 'butter', 'sky-pale'], size: 1.3 }); tell('lineStar', 'wow', 3); setStarToast(true); later(3200, () => setStarToast(false)); L.joy = 1; void selectionHaptic(); break;
          case 'skidIn': play.breath({ tone: 900, gain: 0.03, length: 0.4 }); spark(s.x + 30, 2, 'dust', { tones: DUST,  count: 12, angle: 0, arc: 50, spread: 1.3 }); break;
          case 'stationIn': {
            const n = ev.n ?? 0;
            play.chapter(); L.shake = 1; L.joy = 1; setAct('resting'); setReached(n + 1); void selectionHaptic();
            for (const who of STATION_CREW[n]) cheer(who);
            tell(n === 0 ? 'lineAya' : 'lineChock', 'happy', 2.6, HOSTS[n]);
            spark(s.x + 60, 70, 'sparkle', { count: 14, tones: ['butter', 'white', 'studio-teal'] });
            later(2600, () => { if (state.current.mode === 'atStation') tell('lineGoOn', 'idle', 1, HOSTS[n + 1] ?? HOSTS[n]); });
            // A child who has wandered off: Pep sets off again by himself.
            later(8000, () => { if (state.current.mode === 'atStation' && state.current.stretch === n) edges.current.go = true; });
            break;
          }
          case 'homeIn': startFinale(); break;
          case 'lessonCue': tell(ev.n === 1 ? 'lineRoll' : course.hurdles[s.nextHurdle]?.big ? 'lineLong' : s.stretch === 2 ? 'lineBasin' : 'lineStart', 'curious', 3); break;
          default: break;
        }
      }
    };

    /** The set-piece: Pep at the Dome, the ScoutCam's flash, and the lights sweeping back over the whole run. */
    const startFinale = () => {
      const G = geo.current, rm = reducedRef.current;
      setAct('finale'); setReached(3); setFin('arrive'); setCue(''); L.shake = 1; L.joy = 1; play.chapter();
      for (const who of STATION_CREW[2]) cheer(who);
      onSay(w.lineHome);
      const px = G.lead + 0.04, py = (G.gy - 70 * G.k) / G.H;
      later(500, () => setCamera({ x: px, y: py, zoom: rm ? 1 : 1.45 }));
      later(FIN_MS.charge, () => { setFin('charge'); onSay(w.lineFlash); play.note(10, { gain: 0.03, length: 0.8, attack: 0.4 }); });
      later(FIN_MS.flash, () => {
        setFlash(n => n + 1); bumpShake(); void hitPause(110); void selectionHaptic(); play.setPiece(); play.ambience(PLAY_AMBIENCE.night);
        setGlow(rm ? GLOW_ALL : 1); cheer('sun'); setCamera({ x: 0.5, y: 0.5, zoom: 1 }); setFin('wave'); onSay(w.lineWave);
        spark(state.current.x - 10, 96, 'ring', { tones: ['white'], size: 2.4 }); spark(state.current.x, 90, 'sparkle', { count: 26, tones: ['white', 'butter', 'sky-pale'], size: 1.4, spread: 1.6 });
        if (rm) { L.allLit = true; L.front = -Infinity; }
      });
      if (rm) {
        later(FIN_MS.flash + 500, () => { L.gather = true; setFin('crew'); onSay(w.finish); for (const who of ['aya', 'chock', 'gobgob', 'bebe'] as const) cheer(who); });
        later(FIN_MS.reducedEnd, onDone);
        return;
      }
      later(FIN_MS.sweep, () => { L.sweepAt = L.t; });
      LAYERS.forEach((_layer, i) => later(3000 + i * 600, () => setGlow(i + 2))); later(3000 + LAYERS.length * 600, () => setGlow(GLOW_ALL));
      later(FIN_MS.cut, () => {
        // The ScoutCam's second flash is the cut back to Pep and the whole crew at the Dome.
        setFlash(n => n + 1); L.sweepAt = -1; L.allLit = true; L.front = -Infinity; L.gather = true; setFin('crew'); onSay(w.finish);
        play.chapter(); L.joy = 1; L.shake = 0.8;
        for (const who of ['aya', 'chock', 'gobgob', 'bebe'] as const) cheer(who);
        const s = state.current;
        [0, 500, 1100, 1700].forEach((ms, i) => later(ms + 200, () => { spark(s.x + 60 + i * 70, 150 + (i % 2) * 60, 'sparkle', { count: 16, tones: ['butter', 'white', 'studio-teal', 'rose'], size: 1.2, spread: 1.4 }); L.joy = 1; play.note(10 + i * 2, { gain: 0.04, length: 0.5 }); for (const who of ['aya', 'chock', 'gobgob', 'bebe'] as const) cheer(who); }));
      });
      later(FIN_MS.end, onDone);
    };

    const syncUi = (s: RunState) => {
      const due = L.sweepAt >= 0 || s.mode !== 'onTheRun' ? '' : suggest(course, s);
      if (due !== L.lastCue) { L.lastCue = due; setCue(due); }
      const at = Math.floor(L.cam / 700);
      if (at !== A.win) { A.win = at; setWin(at); }
    };

    const render = (dt: number) => {
      const s = state.current, G = geo.current, rm = reducedRef.current, { k, W, H, gy, viewW, lead } = G;
      L.t += dt;
      while (beats.current.length && beats.current[0].at <= L.t) beats.current.shift()?.run();
      // The opening: Pep runs in from the left and skids to his mark while the camera settles.
      const introP = clamp((L.t - L.introAt) / INTRO_S, 0, 1), introOff = rm ? 0 : INTRO_RUN * (1 - introP) * (1 - introP);
      const pepX = s.x - introOff, running = introP < 1 && !rm ? (introP < 0.92 ? 0.8 : 0.2) : s.vx / 320;

      // camera: Pep keeps his place in the view; the finale's sweep flies it back over the run
      const home = cameraX(s.x, viewW, lead);
      if (L.sweepAt >= 0) {
        const p = (L.t - L.sweepAt) / SWEEP_S;
        L.cam = sweepX(course, viewW, lead, p); L.front = L.cam + viewW * 0.62;
        // the wave plays the valley's lamps like a harp as it passes them
        if (p < 1 && L.t > A.sweepNote) { A.sweepNote = L.t + 0.085; play.note(5 + Math.floor(p * 40) % 14, { gain: 0.022, length: 0.3 }); }
        course.stretches.forEach((st, i) => { if (!A.cheered.has(i) && L.front < st.station + 200) { A.cheered.add(i); for (const who of STATION_CREW[i]) cheer(who); } });
      } else L.cam = home;
      const cam = L.cam;
      // the camera rises with him only as far as the view needs: a tall phone has sky to spare, a short wide one does not
      const liftGoal = L.sweepAt >= 0 ? 0 : clamp(s.y + 150 - (gy / k) * 0.64, 0, 300) * k;
      A.camY = rm ? liftGoal : A.camY + (liftGoal - A.camY) * Math.min(1, dt * 7);
      const camY = A.camY;
      // up on the skybridge the valley sinks away below
      const focus = cam + viewW * lead;
      A.rise = smooth(zones.bridgeFrom - 500, zones.bridgeFrom + 250, focus) * (1 - smooth(zones.bridgeTo - 250, zones.bridgeTo + 500, focus));
      // the mountain drifts slowly across the view over the whole run
      const skyX = W * (SKY.from + (SKY.to - SKY.from) * clamp(cam / course.length, 0, 1)) - G.skyW * SKY.peak;
      // whole pixels: a big plate on a fractional offset shows hairlines between its raster tiles
      if (skyRef.current) skyRef.current.style.transform = `translate3d(${Math.round(skyX)}px,${Math.round(G.skyTop + camY * 0.12)}px,0)`;
      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i]; if (!el) return;
        const tile = PLATES[layer.art].dusk.w * layer.k;
        el.style.transform = `translate3d(${(-((cam * layer.f) % tile) * k).toFixed(1)}px,${(gy + camY * (0.25 + i * 0.17) + layer.sink * A.rise * k).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
      });
      if (domeRef.current) domeRef.current.style.transform = `translate3d(${(-cam * NEAR.f * k).toFixed(1)}px,${(gy + camY * 0.76 + NEAR.sink * A.rise * k).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
      if (trailRef.current) trailRef.current.style.transform = `translate3d(${(-cam * k).toFixed(1)}px,${(gy + camY).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
      if (bloomRef.current) bloomRef.current.style.transform = `translate3d(${(-((cam * BLOOMS.f) % (PLATES.blooms.dusk.w * BLOOMS.k)) * k).toFixed(1)}px,${(gy + G.bedTop * k + camY * 1.3).toFixed(1)}px,0) scale(${k.toFixed(4)})`;
      if (fernRef.current) fernRef.current.style.transform = `translate3d(${(-((cam * FERNS.f) % (FERNS.every * 3)) * k).toFixed(1)}px,${(H + camY * 1.6).toFixed(1)}px,0) scale(${k.toFixed(4)})`;

      // Pep
      const accel = (s.vx - A.lastVx) / Math.max(dt, 1e-3); A.lastVx = s.vx;
      A.accel += (accel - A.accel) * Math.min(1, dt * 8);
      const rolling = s.roll > 0 || s.dive;
      const r = 1 - s.roll / ROLL_T;
      const tuckGoal = s.dive ? 1 : s.roll > 0 ? (r < 0.1 ? r / 0.1 : s.roll < 0.1 ? s.roll / 0.1 : 1) : 0;
      A.tuck += (tuckGoal - A.tuck) * Math.min(1, dt * 22);
      if (rolling) A.spin += Math.max(180, s.vx) * dt / ROLL_RADIUS;
      else if (A.spin > 0) { const goal = Math.ceil(A.spin / TAU - 1e-3) * TAU; A.spin = Math.min(goal, A.spin + dt * 17); if (A.spin >= goal - 1e-3) A.spin = 0; }
      // a soft bump over a planter is one happy somersault
      let flip = 0;
      if (L.flip >= 0 && !rm) { const p = (L.t - L.flip) / 0.5; if (p >= 1 || rolling) L.flip = -1; else flip = p * p * (3 - 2 * p) * TAU; }
      A.squash = Math.max(0, A.squash - dt * 5.5); A.stretch = Math.max(0, A.stretch - dt * 4.5);
      L.shake = Math.max(0, L.shake - dt * 1.3); L.joy = Math.max(0, L.joy - dt * 1.5);
      const resting = s.mode === 'atStation' || (s.mode === 'atStart' && introP >= 1);
      A.sit += (((resting && s.rest > 2.6 && L.joy <= 0) ? 1 : 0) - A.sit) * Math.min(1, dt * 5);
      const dist = s.dist + (INTRO_RUN - introOff);
      const legPhase = dist / STRIDE * TAU;
      const joyHop = rm ? 0 : Math.abs(Math.sin((1 - L.joy) * 9)) * 26 * L.joy;
      const pose = pepPose({ phase: legPhase, speed: rolling ? 0 : running, accel: A.accel, air: (!s.onGround && !rolling) || joyHop > 5, vy: joyHop > 5 ? Math.cos((1 - L.joy) * 9) * 240 : s.vy, tuck: A.tuck, spin: A.spin + flip, squash: A.squash, stretch: A.stretch, sit: A.sit, shake: L.shake, t: L.t, reduced: rm });
      // a kite on the updraft: he rocks on the wind
      if (s.lifted && !rm) pose.pitch += Math.sin(L.t * 5) * 0.09;
      pose.lift += joyHop;
      applyPepPose(parts, pose);
      const py = -s.y;
      if (pepRef.current) pepRef.current.style.transform = `translate3d(${pepX.toFixed(1)}px,${py.toFixed(1)}px,0)`;
      if (shadowRef.current) {
        const up = clamp((s.y + pose.lift) / 220, 0, 1);
        shadowRef.current.style.transform = `translate3d(${pepX.toFixed(1)}px,0,0) scale(${(1 - up * 0.5).toFixed(3)},1)`;
        shadowRef.current.style.opacity = (s.wading || s.y < -2 ? 0 : 0.55 * (1 - up * 0.7)).toFixed(2);
      }
      // the basin mirrors him
      const overBasin = pepX > zones.bridgeTo - 80 && pepX < zones.basinTo + 80;
      if (mirrorRef.current) {
        if (overBasin !== A.mirrorOn) { A.mirrorOn = overBasin; mirrorRef.current.style.display = overBasin ? '' : 'none'; }
        if (overBasin) { applyPepPose(mirrorParts, pose); mirrorRef.current.style.transform = `translate3d(${pepX.toFixed(1)}px,${(22 + Math.max(0, s.y) * 0.9).toFixed(1)}px,0) scale(1,-1)`; }
      }
      // ScoutCam: its light burns with his speed and trails behind him
      const pace = clamp(running, 0, 1.2);
      if (streakRef.current) { streakRef.current.style.opacity = (rm ? 0 : clamp(pace - 0.45, 0, 0.7) * (rolling ? 1.4 : 1)).toFixed(2); streakRef.current.style.transform = `scale(${(0.4 + pace * 0.9).toFixed(2)},1)`; }
      if (camLightRef.current) camLightRef.current.style.opacity = (0.55 + 0.45 * Math.sin(L.t * 6)).toFixed(2);
      if (!rm && pace > 0.7 && L.t > A.trailAt && L.sweepAt < 0) { A.trailAt = L.t + 0.07; fx.current?.trail((pepX - 26 - cam) * k / W, (gy + camY - (s.y + 84) * k) / H, 'glint', { tones: ['sky-pale', 'white'], size: 0.5 }); }

      // the star: asleep over its updraft, then at Pep's shoulder
      if (starRef.current) {
        if (s.star) {
          const gx = pepX - 70 + (rm ? 0 : Math.cos(L.t * 2.1) * 14), gyy = s.y + 150 + (rm ? 0 : Math.sin(L.t * 2.7) * 10);
          A.starX += (gx - A.starX) * Math.min(1, dt * 4); A.starY += (gyy - A.starY) * Math.min(1, dt * 4);
        } else { A.starX = course.star.x; A.starY = course.star.y; }
        starRef.current.style.transform = `translate3d(${A.starX.toFixed(1)}px,${(-A.starY).toFixed(1)}px,0)`;
      }

      // footfalls on the run cycle, and a puff of dust at full pace
      const foot = Math.floor(legPhase / Math.PI);
      if (foot !== A.foot) {
        A.foot = foot;
        if (s.onGround && !rolling && s.vx > 60 && L.sweepAt < 0) {
          play.breath({ tone: s.wading ? 1500 : 420 + (foot % 2) * 60, gain: 0.011, length: 0.05 });
          if (s.wading) spark(pepX, 0, 'drop', { count: 3, angle: 250, arc: 60, spread: 0.6 });
          else if (foot % 2 === 0) spark(pepX - 30, 2, 'dust', { tones: DUST,  count: 2, angle: 190, arc: 40, spread: 0.6, size: 0.7 });
        }
      }

      // the evening's own air: petals on the breeze, or the first fireflies (never both, and some evenings neither)
      if (!rm && L.t > A.airAt && course.air !== 'stillAir') {
        A.airAt = L.t + 0.7 + Math.random() * 1.1;
        if (course.air === 'petalAir') fx.current?.burst(1.03, 0.12 + Math.random() * 0.5, 'petal', { count: 1, angle: 172, arc: 26, spread: 2.4, tones: ['blossom', 'rose', 'snow'] });
        else fx.current?.burst(0.1 + Math.random() * 0.85, 0.3 + Math.random() * 0.45, 'glint', { count: 1, size: 0.34, tones: ['butter', 'gold-light'] });
      }

      // the finale's wave wakes every lamp it passes
      if (L.front < Infinity) for (const [id, el] of lampEls) { if (course.lamps[id].x >= L.front && el.dataset.lit !== 'true') el.dataset.lit = 'true'; }

      // dusk deepens along the run; each lamp Pep wakes warms it again
      const deep = L.allLit ? 0 : duskDepth(course, s.x) * (1 - 0.5 * warmth(course, s)), warm = warmth(course, s);
      if (deepRef.current && Math.abs(deep - A.deep) > 0.004) { A.deep = deep; deepRef.current.style.opacity = (0.1 + deep * 0.62).toFixed(3); }
      if (warmRef.current && Math.abs(warm - A.warm) > 0.004) { A.warm = warm; warmRef.current.style.opacity = (L.allLit ? 0.5 : warm * 0.75).toFixed(3); }
      const lines = rm || L.sweepAt >= 0 ? 0 : clamp((s.vx - 230) / 110, 0, 1) * (s.slow < 1 ? 0.2 : 1);
      if (speedRef.current && Math.abs(lines - A.speed) > 0.02) { A.speed = lines; speedRef.current.style.opacity = lines.toFixed(2); }
    };

    let raf = 0, alive = false;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = A.last ? clamp((now - A.last) / 1000, 0, 0.05) : 1 / 60;
      A.last = now; A.acc += dt;
      let guard = 0;
      while (A.acc >= STEP_DT && guard++ < 12) {
        const next = step(course, state.current, input(), STEP_DT);
        state.current = next;
        if (next.events.length) handle(next, next.events);
        A.acc -= STEP_DT;
      }
      if (guard >= 12) A.acc = 0;
      syncUi(state.current);
      render(dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (alive) return; alive = true; A.last = 0; raf = requestAnimationFrame(tick); };
    const stop = () => { alive = false; cancelAnimationFrame(raf); };
    const release = () => { keys.current.hold = false; keys.current.pointer = -1; };
    const visibility = () => { if (document.hidden) { stop(); release(); } else start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', release);

    // keyboard: Space or ↑ jumps (hold for a longer jump), ↓ rolls, Enter sets off
    const ours = (e: KeyboardEvent) => { const el = e.target as HTMLElement | null; return !el || el === document.body || !!el.closest?.('[data-adventure="fox-trail"]'); };
    const down = (e: KeyboardEvent) => {
      if (!ours(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!e.repeat) edges.current.roll = true; return; }
      if ((e.key === ' ' && !onButton) || e.key === 'ArrowUp') { e.preventDefault(); keys.current.hold = true; if (!e.repeat) { edges.current.jump = true; edges.current.go = true; } return; }
      if (e.key === 'Enter' && !onButton && !e.repeat) edges.current.go = true;
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'ArrowUp') keys.current.hold = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const pending = beats.current;
    return () => {
      stop(); observer?.disconnect(); release();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', release);
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      pending.length = 0; window.clearTimeout(keys.current.pending);
      play.dispose(); sound.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The opening shot: the camera settles as Pep runs in.
  useEffect(() => { const id = window.setTimeout(() => setCamera({ x: 0.5, y: 0.5, zoom: 1 }), 80); return () => window.clearTimeout(id); }, []);
  const openingDone = () => {
    if (act !== 'opening') return;
    setAct('resting'); live.current.introAt = Math.min(live.current.introAt, live.current.t - INTRO_S * 0.8); onSay(w.lineOpen);
    // Pep sets off by himself: the first lamps are free, the first planter comes in slow motion.
    later(1100, () => { if (state.current.mode === 'atStart') edges.current.go = true; });
  };

  /* ── input: one thumb on the picture ── */
  const pressJump = () => { edges.current.jump = true; edges.current.go = true; keys.current.hold = true; sound.current?.tap(); void selectionHaptic(); };
  const pressRoll = () => { edges.current.roll = true; keys.current.hold = false; void selectionHaptic(); };
  const worldDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (act === 'opening' || act === 'finale') return;
    keys.current.pointer = e.pointerId; keys.current.downX = e.clientX; keys.current.downY = e.clientY; keys.current.swiped = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    // A touch is a jump unless it turns out to be the start of a swipe down: it waits a blink to see.
    window.clearTimeout(keys.current.pending);
    if (state.current.mode === 'onTheRun') keys.current.pending = window.setTimeout(() => { keys.current.pending = 0; if (keys.current.pointer === e.pointerId && !keys.current.swiped) pressJump(); }, SWIPE_WAIT_MS);
    else pressJump();
    // the touch answers where it lands
    const box = e.currentTarget.getBoundingClientRect();
    fx.current?.burst((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height, 'ring', { tones: ['white'], size: 0.5 });
  };
  const worldMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const key = keys.current;
    if (key.pointer !== e.pointerId || key.swiped) return;
    const dy = e.clientY - key.downY, dx = e.clientX - key.downX;
    if (dy > 9 && dy > Math.abs(dx) && key.pending) { window.clearTimeout(key.pending); key.pending = 0; key.swiped = true; pressRoll(); }
    else if (dy > 24 && dy > Math.abs(dx) * 1.1) { key.swiped = true; pressRoll(); }
  };
  const worldUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const key = keys.current; if (key.pointer !== e.pointerId) return;
    // let go before the blink was over: a quick tap, so the hop happens now
    if (key.pending) { window.clearTimeout(key.pending); key.pending = 0; if (!key.swiped) pressJump(); }
    key.pointer = -1; key.hold = false;
  };
  const keyProps = (what: 'jump' | 'roll') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse' && e.button !== 0) return; if (what === 'jump') pressJump(); else pressRoll(); },
    onPointerUp: () => { keys.current.hold = false; }, onPointerCancel: () => { keys.current.hold = false; }, onPointerLeave: () => { keys.current.hold = false; },
    // Keyboard (Enter or Space on the key).
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => { if (e.detail === 0) { if (what === 'jump') { pressJump(); keys.current.hold = false; } else pressRoll(); } },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  const go = () => { edges.current.go = true; sound.current?.tap(); void selectionHaptic(); };
  const poke = () => { sound.current?.note(9, { gain: 0.04, length: 0.12 }); sound.current?.note(12, { gain: 0.04, length: 0.16, at: 0.1 }); live.current.joy = Math.max(live.current.joy, 0.6); tell('lineCrew', 'happy', 1.6); };

  /* ── the picture ── */
  const lit = glow >= 1;
  const x0 = win * 700 - 900, x1 = win * 700 + view.w + 1700;
  const seen = (x: number, pad = 0) => x + pad >= x0 && x - pad <= x1;
  const L = live.current, run = state.current;
  const lampLit = (l: Lamp) => run.lamps[l.id] === 1 || L.allLit || l.x >= L.front;
  const strip = (art: keyof typeof PLATES, k: number, foot: number, width: number) => {
    const plate = PLATES[art], tile = plate.dusk.w * k, height = plate.dusk.h * k;
    const size = `${tile.toFixed(1)}px ${height.toFixed(1)}px`;
    return <div className="ft-strip" style={{ left: -tile, top: foot - height, width: width + tile * 3, height }}>
      <i className="ft-tone" style={{ backgroundImage: bg(plate.dusk.src), backgroundSize: size }} />
      <i className="ft-tone ft-tone--night" style={{ backgroundImage: bg(plate.night.src), backgroundSize: size }} />
    </div>;
  };
  const wallSize = `${(PLATES.wall.dusk.w * WALL.k).toFixed(0)}px ${(PLATES.wall.dusk.h * WALL.k).toFixed(0)}px`;
  const wallH = PLATES.wall.dusk.h * WALL.k, wallTop = -WALL.floorRow * WALL.k;
  const paving = (from: number, to: number) => <div className="ft-paving" key={from} style={{ left: from, top: wallTop, width: to - from, height: wallH }}>
    {(['', ' ft-tone--night'] as const).map(tone => <i key={tone} className={`ft-tone${tone}`} style={{ backgroundImage: bg(PLATES.wall[tone ? 'night' : 'dusk'].src), backgroundSize: wallSize }} />)}
    <span className="ft-paving__under" style={{ top: wallH - 1, height: wallH }}>
      {(['', ' ft-tone--night'] as const).map(tone => <i key={tone} className={`ft-tone${tone}`} style={{ backgroundImage: bg(PLATES.wall[tone ? 'night' : 'dusk'].src), backgroundSize: wallSize }} />)}
    </span>
  </div>;
  const mirrorSize = `${(PLATES.terrace.dusk.w * NEAR.k).toFixed(0)}px 100%`;
  const stations = course.stretches.map(st => st.station);
  const domeLeft = cameraX(course.length, view.w, view.lead) * NEAR.f + view.w * 0.3;
  const quest = [
    { key: 'gardens', label: w.stretchGardens, done: reached > 0, icon: <Flower2 aria-hidden="true" /> },
    { key: 'bridge', label: w.stretchBridge, done: reached > 1, icon: <Wind aria-hidden="true" /> },
    { key: 'basin', label: w.stretchBasin, done: reached > 2, icon: <Waves aria-hidden="true" /> },
  ];

  const world = <div className="ft-world" ref={rootRef} dir="ltr" data-glow={glow} data-fin={fin || undefined} data-air={course.air} data-act={act} data-stretch={stretch} data-cue={cue || undefined} role="group" aria-label={glow >= GLOW_ALL ? w.sceneLit : w.scene}
    onPointerDown={worldDown} onPointerMove={worldMove} onPointerUp={worldUp} onPointerCancel={worldUp}>
    <div className="ft-sky" ref={skyRef} data-lit={glow >= GLOW_ALL} data-play-depth="3">
      <i className="ft-tone" style={{ backgroundImage: bg(PLATES.sky.dusk.src) }} />
      <i className="ft-tone ft-tone--night" style={{ backgroundImage: bg(PLATES.sky.night.src) }} />
      {/* the last clouds of the day, drifting */}
      {CLOUDS.map((c, n) => <i key={n} className="ft-cloud" style={{ left: `${c[0]}%`, top: `${c[1]}%`, width: `${c[2]}%`, animationDuration: `${c[3]}s`, animationDelay: `${-c[3] * 0.37 * n}s` }} />)}
    </div>
    {LAYERS.map((layer, i) => <div key={layer.id} className="ft-layer" data-layer={layer.id} data-play-depth={i < 2 ? '3' : '2'} data-lit={glow >= LAYERS.length + 1 - i} ref={el => { layerRefs.current[i] = el; }}>
      {strip(layer.art, layer.k, layer.foot - HORIZON, view.w)}
    </div>)}
    {/* Horizon Dome: the great glass pavilion that waits at the end of the run */}
    <div className="ft-layer" data-layer="horizonDome" data-lit={glow >= 2} ref={domeRef}>
      <div className="ft-dome" style={{ left: domeLeft, top: NEAR.foot - HORIZON - PLATES.dome.dusk.h * 1.05 + 8, width: PLATES.dome.dusk.w * 1.05, height: PLATES.dome.dusk.h * 1.05 }}>
        <i className="ft-tone" style={{ backgroundImage: bg(PLATES.dome.dusk.src) }} /><i className="ft-tone ft-tone--night" style={{ backgroundImage: bg(PLATES.dome.night.src) }} />
      </div>
    </div>

    <div className="ft-layer ft-trail" ref={trailRef} data-lit={lit}>
      {paving(-1400, zones.bridgeFrom)}
      {paving(zones.basinTo, zones.end)}
      {/* the Glass Grove skybridge: a white deck, a glass rail, slim pylons into the mist */}
      <div className="ft-bridge" style={{ left: zones.bridgeFrom, width: zones.bridgeTo - zones.bridgeFrom }}>
        <i className="ft-bridge__mist" /><i className="ft-bridge__pylons" /><i className="ft-bridge__rail" /><i className="ft-bridge__deck" />
      </div>
      <i className="ft-abutment" style={{ left: zones.bridgeFrom - 34 }} /><i className="ft-abutment" style={{ left: zones.bridgeTo - 30 }} />
      {/* the Reflection Basin and its causeway of float pads */}
      <div className="ft-basin" style={{ left: zones.bridgeTo, width: zones.basinTo - zones.bridgeTo }}>
        <i className="ft-basin__water" />
        {/* the terraces on the far bank, mirrored in the water */}
        <span className="ft-basin__mirror">
          <i className="ft-tone" style={{ backgroundImage: bg(PLATES.terrace.dusk.src), backgroundSize: mirrorSize }} /><i className="ft-tone ft-tone--night" style={{ backgroundImage: bg(PLATES.terrace.night.src), backgroundSize: mirrorSize }} />
        </span>
        <i className="ft-basin__shimmer" />
      </div>
      {zones.pads.filter(p => seen((p.from + p.to) / 2, (p.to - p.from) / 2)).map(p => <i key={p.from} className="ft-pad" style={{ left: p.from, width: p.to - p.from }} />)}
      <i className="ft-abutment ft-abutment--quay" style={{ left: zones.basinTo - 26 }} />

      {course.updrafts.filter(u => seen((u.from + u.to) / 2, 200)).map(u => <span key={u.id} className="ft-updraft" style={{ left: u.from, width: u.to - u.from }}>
        <i className="ft-updraft__vent" />{[0, 1, 2, 3, 4, 5].map(n => <i key={n} className="ft-updraft__streak" style={{ left: `${8 + n * 16}%`, animationDelay: `${(-n * 0.37).toFixed(2)}s` }} />)}
      </span>)}
      {course.hurdles.filter(h => h.kind === 'buntingLine' && seen(h.x, 120)).map(h => <BuntingPosts key={h.id} h={h} />)}
      {course.lamps.filter(l => seen(l.x, 100)).map(l => <TrailLamp key={l.id} lamp={l} lit={lampLit(l)} refTo={lampRef(l.id)} />)}
      {course.hurdles.filter(h => h.kind === 'planterBox' && seen(h.x, 80)).map(h => {
        const art = h.big ? SPRITES.planterBloom : SPRITES.planterBud, height = h.big ? 102 : 80, width = height * art.w / art.h;
        return <img key={h.id} className="ft-planter" ref={hurdleRef(h.id)} src={art.src} alt="" draggable={false} style={{ left: h.x - width / 2, top: -height + 3, width, height }} />;
      })}
      {/* the Dome's sun on its tall stand, and the crew at their stations in front of it */}
      {seen(course.length, 900) && <>
        <span className="ft-sun" ref={friendRef('sun')} data-lit={lit} style={{ left: course.length + DOME_SUN.dx }}>
          <i className="ft-sun__stand" style={{ height: DOME_SUN.y - 30, top: -(DOME_SUN.y - 30) }} />
          <span className="ft-sun__head" style={{ top: -DOME_SUN.y - DOME_SUN.size / 2, left: -DOME_SUN.size / 2, width: DOME_SUN.size, height: DOME_SUN.size }}>
            <i className="ft-sun__halo" /><img src={SPRITES.sunUnlit.src} alt="" draggable={false} /><img className="ft-sun__on" src={SPRITES.sunLit.src} alt="" draggable={false} />
          </span>
        </span>
        <img className="ft-bench" src={SPRITES.trailBench.src} alt="" draggable={false} style={{ left: course.length + 470, top: -110, width: 206, height: 104 }} />
        {L.gather && GATHER.map(g => <Crew key={`${g.who}-home`} who={g.who} x={course.length + g.dx} back={g.back} refTo={friendRef(g.who)} arrive />)}
      </>}
      {stations.map((sx, n) => seen(sx, 700) && STATION_CREW[n].map(who => <Crew key={who} who={who} x={sx + FRIENDS[who].dx} refTo={friendRef(who)} />))}
      {seen(course.start, 900) && <img className="ft-can" src={SPRITES.can.src} alt="" draggable={false} style={{ left: course.start - 190, top: -44, width: 62, height: 46 }} />}
      <span className="ft-star" ref={starRef} data-found={run.star}><i className="ft-star__halo" /><i className="ft-star__core" /></span>

      {/* Pep, his shadow and (over the basin) his reflection */}
      <div className="ft-mirror" ref={mirrorRef} style={{ display: 'none' }}><PepBody parts={mirrorParts} /></div>
      <div className="ft-shadow" ref={shadowRef} />
      <div className="ft-pep" ref={pepRef} data-charge={fin === 'charge'}>
        <PepBody parts={parts} camLight={camLightRef} streak={streakRef} />
      </div>

      {/* in front of Pep: the water he paddles in, and the bunting he rolls under */}
      <div className="ft-basin ft-basin--front" style={{ left: zones.bridgeTo, width: zones.basinTo - zones.bridgeTo }}><i className="ft-basin__lap" /></div>
      {zones.pads.filter(p => seen((p.from + p.to) / 2, (p.to - p.from) / 2)).map(p => <i key={p.from} className="ft-pad ft-pad--lip" style={{ left: p.from, width: p.to - p.from }} />)}
      {course.hurdles.filter(h => h.kind === 'buntingLine' && seen(h.x, 120)).map(h => <Bunting key={h.id} h={h} refTo={hurdleRef(h.id)} />)}
    </div>

    <PlayFx ref={fx} layer={6} />
    <div className="ft-layer ft-blooms" ref={bloomRef} data-lit={lit} data-play-depth="1">{strip('blooms', BLOOMS.k, PLATES.blooms.dusk.h * BLOOMS.k, view.w)}</div>
    <div className="ft-layer ft-ferns" ref={fernRef} data-lit={lit}>
      {[0, 1, 2, 3, 4, 5].map(n => <img key={n} className="ft-fern" src={SPRITES.fern.src} alt="" draggable={false} style={{ left: n * FERNS.every + (n % 3) * 260, top: -FERNS.w * 0.3 - (n % 3) * 14, width: FERNS.w, height: FERNS.w * SPRITES.fern.h / SPRITES.fern.w, transform: `rotate(${[9, -14, 24][n % 3]}deg) scaleX(${n % 3 === 1 ? -1 : 1})` }} />)}
    </div>
    <i className="ft-deep" ref={deepRef} /><i className="ft-warm" ref={warmRef} />
    <div className="ft-speed" ref={speedRef}>{[0, 1, 2, 3, 4].map(n => <i key={n} style={{ top: `${12 + n * 17}%`, animationDelay: `${(-n * 0.23).toFixed(2)}s`, animationDuration: `${(0.5 + (n % 3) * 0.14).toFixed(2)}s` }} />)}</div>
    {flash > 0 && <i key={flash} className="ft-flash" />}
  </div>;

  const host = say.who;
  return <PlayStage id="fox-trail" grade="day" camera={camera} shake={shake} parallax world={world}>
    <HudCoach who={host} mood={say.mood} line={act === 'opening' ? '' : w[say.key]} quiet={act === 'opening'} onPoke={poke} pokeLabel={w.coachPoke} />
    <HudQuest steps={quest} current={act === 'finale' ? 3 : stretch} label={w.quest} />
    <HudToast show={starToast}>{w.star}</HudToast>
    <HudDock align="end" label={w.controls}>
      {act === 'resting' && run.mode === 'atStation' && <button type="button" className="play-button" data-tone="go" data-size="l" data-cue="" data-ft-go="" onClick={go}><span className="play-button__icon" data-flip="" aria-hidden="true"><Play /></span><span className="play-button__label">{w.go}</span></button>}
      {act === 'running' && <>
        <button type="button" className="play-button ft-key" data-tone="paper" data-icon-only="" data-cue={cue === 'rollNow' ? '' : undefined} data-ft-key="roll" aria-label={w.roll} {...keyProps('roll')}><span className="play-button__icon" aria-hidden="true"><ChevronsDown /></span></button>
        <button type="button" className="play-button ft-key" data-tone="paper" data-icon-only="" data-cue={cue === 'jumpNow' || cue === 'holdNow' ? '' : undefined} data-ft-key="jump" aria-label={w.jump} {...keyProps('jump')}><span className="play-button__icon" aria-hidden="true"><ChevronsUp /></span></button>
      </>}
    </HudDock>
    {/* the ghost hand: the first move of each kind is shown on the picture itself, in slow motion */}
    {act === 'running' && cue && !run.learned[cue === 'holdNow' ? 'jumpNow' : cue] && <GhostHand move={cue} />}
    {act === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={openingDone} />}
    <PlaySetPiece active={act === 'finale'} caption={fin === 'arrive' ? w.lineHome : fin === 'charge' ? w.lineFlash : fin === 'wave' ? w.lineWave : fin === 'crew' ? w.finish : undefined} />
  </PlayStage>;
}

/** Pep: the kit's side view in his scout harness, worked as a puppet. The picture faces left; the run goes right. */
function PepBody({ parts, camLight, streak }: { parts: PuppetParts; camLight?: RefObject<HTMLElement | null>; streak?: RefObject<HTMLElement | null> }) {
  const part = (clip: string, origin: string, fadeAt?: readonly [number, number]): CSSProperties => {
    const mask = fadeAt ? `linear-gradient(to bottom, transparent ${fadeAt[0].toFixed(1)}%, var(--mk-shadow) ${fadeAt[1].toFixed(1)}%)` : undefined;
    return { backgroundImage: bg(PEP_SIDE.src), clipPath: clip, transformOrigin: origin, maskImage: mask, WebkitMaskImage: mask };
  };
  return <div className="ft-pep__face">
    <div className="ft-pep__sq" ref={el => { parts.sq = el; }} style={{ left: -PEP.foot[0] * PEP.w, top: -PEP.foot[1] * PEP.h, width: PEP.w, height: PEP.h, transformOrigin: `${(PEP.foot[0] * 100).toFixed(1)}% ${(PEP.foot[1] * 100).toFixed(1)}%` }}>
      <div className="ft-pep__spin" ref={el => { parts.spin = el; }} style={{ transformOrigin: PEP.centre }}>
        {streak && <i className="ft-pep__streak" ref={streak} style={{ left: `${PEP.cam[0].toFixed(1)}%`, top: `${PEP.cam[1].toFixed(1)}%` }} />}
        <i className="ft-pep__part ft-pep__part--far" ref={el => { parts.hindFar = el; }} style={part(PEP.hind, PEP.hip, PEP.hindFade)} />
        <i className="ft-pep__part ft-pep__part--far" ref={el => { parts.foreFar = el; }} style={part(PEP.fore, PEP.shoulder, PEP.foreFade)} />
        <i className="ft-pep__part" style={part(PEP.body, PEP.centre)} />
        <i className="ft-pep__part" ref={el => { parts.head = el; }} style={part(PEP.head, PEP.neck)} />
        <i className="ft-pep__part" ref={el => { parts.hind = el; }} style={part(PEP.hind, PEP.hip, PEP.hindFade)} />
        <i className="ft-pep__part" ref={el => { parts.fore = el; }} style={part(PEP.fore, PEP.shoulder, PEP.foreFade)} />
        {camLight && <i className="ft-pep__cam" ref={camLight} style={{ left: `${PEP.cam[0].toFixed(1)}%`, top: `${PEP.cam[1].toFixed(1)}%` }} />}
      </div>
    </div>
  </div>;
}

/** A lamp on the path, a light-flower on its stalk at jump height, or one adrift in an updraft. */
const TrailLamp = memo(function TrailLamp({ lamp, lit, refTo }: { lamp: Lamp; lit: boolean; refTo: (el: HTMLElement | null) => void }) {
  if (lamp.tier === 'pathLamp') return <span className="ft-lamp" data-tier="path" data-lit={lit} ref={refTo} style={{ left: lamp.x }}>
    <i className="ft-lamp__pool" /><i className="ft-lamp__halo" />
    <img className="ft-lamp__img" src={SPRITES.lamp.src} alt="" draggable={false} style={lamp.id % 2 ? { transform: 'scaleX(-1)' } : undefined} />
  </span>;
  const size = lamp.tier === 'skyLight' ? 58 : 52;
  return <span className="ft-lamp" data-tier={lamp.tier === 'skyLight' ? 'sky' : 'leap'} data-lit={lit} ref={refTo} style={{ left: lamp.x }}>
    {lamp.tier === 'leapLight' && <i className="ft-lamp__stem" style={{ top: -lamp.y + 10, height: lamp.y - 10 }} />}
    <span className="ft-lamp__bloom" style={{ left: -size / 2, top: -lamp.y - size / 2, width: size, height: size, animationDelay: `${(-(lamp.id % 7) * 0.4).toFixed(1)}s` }}>
      <i className="ft-lamp__halo" /><img src={SPRITES.sunUnlit.src} alt="" draggable={false} /><img className="ft-lamp__on" src={SPRITES.sunLit.src} alt="" draggable={false} />
    </span>
  </span>;
});

const FLAG_TONES = ['--mk-sun', '--mk-rose', '--mk-sky', '--mk-snow', '--mk-teal', '--mk-blossom', '--mk-butter'] as const;
const POST_H = 196;
function BuntingPosts({ h }: { h: Hurdle }) {
  return <>{[-1, 1].map(side => <i key={side} className="ft-post" style={{ left: h.x + side * (h.w / 2 + 12) - 4, top: -POST_H, height: POST_H }} />)}</>;
}
/** A line of bunting strung along the path between two posts. It sags to just over a rolling dog. */
function Bunting({ h, refTo }: { h: Hurdle; refTo: (el: HTMLElement | null) => void }) {
  const width = h.w + 24, low = POST_H - h.h - 26, flags = 7;
  // the rope is a quadratic from post top to post top through its lowest point
  const rope = (t: number) => ({ x: t * width, y: 6 + (low - 6) * 4 * t * (1 - t) });
  return <span className="ft-bunting" ref={refTo} style={{ left: h.x - width / 2, top: -POST_H, width, height: POST_H }}>
    <svg viewBox={`0 0 ${width} ${POST_H}`} aria-hidden="true" focusable="false">
      <path d={`M0 6 Q${width / 2} ${2 * low - 6} ${width} 6`} fill="none" strokeWidth="1.6" style={{ stroke: 'var(--mk-linen-shade)' }} />
      {Array.from({ length: flags }, (_, i) => {
        const p = rope((i + 1) / (flags + 1)), tone = FLAG_TONES[(i + h.id) % FLAG_TONES.length];
        return <g key={i} className="ft-flag" style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDelay: `${(-i * 0.21).toFixed(2)}s` }}>
          <path d={`M${p.x - 10} ${p.y} L${p.x + 10} ${p.y} L${p.x} ${p.y + 26} Z`} style={{ fill: `var(${tone})` }} />
          <path d={`M${p.x} ${p.y} L${p.x + 10} ${p.y} L${p.x} ${p.y + 26} Z`} style={{ fill: 'var(--mk-shadow)' }} opacity="0.16" />
          <path d={`M${p.x - 10} ${p.y} L${p.x + 10} ${p.y}`} strokeWidth="1.4" style={{ stroke: 'var(--mk-white)' }} opacity="0.6" />
        </g>;
      })}
    </svg>
  </span>;
}

function Crew({ who, x, refTo, arrive = false, back = 0 }: { who: FriendId; x: number; refTo: (el: HTMLElement | null) => void; arrive?: boolean; /** Units farther from the camera (up the paving, and a little smaller). */ back?: number }) {
  const friend = FRIENDS[who], height = friend.h * (1 - back / 180), width = height * friend.art.w / friend.art.h;
  return <span className="ft-friend" data-who={who} data-arrive={arrive || undefined} ref={refTo} style={{ left: x - width / 2, top: -height + 4 - back, width, height }}>
    <i className="ft-friend__shadow" /><img src={friend.art.src} alt="" draggable={false} style={friend.flip ? { scale: '-1 1' } : undefined} />
  </span>;
}

/** The ghost hand: it shows the move on the picture (a tap, a held tap, a swipe down), never takes a touch,
 * and is gone for good once the child has made that move. */
function GhostHand({ move }: { move: Move }) {
  return <span className="ft-ghost" data-move={move} aria-hidden="true">
    <i className="ft-ghost__ring" />
    <svg viewBox="0 0 48 60" focusable="false">
      <path className="ft-ghost__hand" d="M18 30 V11 a5 5 0 0 1 10 0 V26 l9 2.2 a6 6 0 0 1 4.6 6.6 l-1.8 11.6 A9 9 0 0 1 31 54 H22 a9 9 0 0 1 -7.4 -3.9 L7.4 39.6 a4.2 4.2 0 0 1 6.6 -5.2 Z" />
    </svg>
  </span>;
}
