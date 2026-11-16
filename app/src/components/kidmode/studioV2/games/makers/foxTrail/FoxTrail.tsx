import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronsUp, RotateCw, Sparkles } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { FOX_TRAIL_COPY } from './foxTrailCopy';
import {
  BOUNCERS, LOGS, OFFER_T, ROLL_RADIUS, ROLL_T, RUN_MAX, SEEDS, SEED_IDS, STEP_DT, STONES, STREAM, TALL_GRASS, TUNNEL, WAKE_T, WORLD_H, WORLD_W,
  canOffer, cameraFollow, carriedCount, clamp, inTunnel, inWater, initialFoxState, nearStone, step, surfaceAt, upOnRoof, wakeRadius,
  type FoxInput, type FoxState, type SeedId, type SeedStatus, type WorldPhase,
} from './foxTrailRules';
import { STRIDE, applyPepPose, pepPose, type PuppetParts } from './pepPuppet';
import { burstMotes, createGrass, drawGrass, glowSprite, pawprint, puff, updateGrass, type GrassField, type GrassPalette, type Rgb } from './foxGrass';
import {
  CAN_X, COURSE, DOME, FAR, FLOWER_XS, GARDENS, GROUND_Y, LAMP_XS, NOOK, PARALLAX, PEP_SIDE, PETAL_ART, PLANTER, PLANTER_H, PLATES, POOL, PULSEPOD, SPRITES, STATIONS, SUN, TRAIL_W, WALL,
  layerWidth, pepParts, type FriendId, type Tone,
} from './foxKit';
import { createFoxSounds, type FoxSounds } from './foxTrailAudio';
import '../makerPalette.css';
import './foxTrail.css';

type Lang = 'en' | 'he';
type Words = (typeof FOX_TRAIL_COPY)[Lang];
type HintKey = 'hintStart' | 'hintGrass' | 'hintStream' | 'hintTunnel' | 'hintSeed' | 'hintStone' | 'hintReady' | 'hintWaking' | 'hintNight' | 'hintStar' | '';
type Move = 'right' | 'roll' | 'jump' | '';
/** The least trail (world units) a window shows across (a phone, then anything wider), and the most of the scene's height it shows. */
const MIN_VIEW = 340, WIDE_VIEW = 460, VIEW_H = 350;
/** The bottom of the scene (plain paving) that no window shows. */
const CROP = 40;
const TAU = Math.PI * 2;
const PEP = pepParts();
const FINALE_MS = 2300;
/** In memory only: each new sitting hangs the floating petal over another tile. Nothing is stored. */
let sittings = 0;

export default function FoxTrail() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = FOX_TRAIL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const [sitting, setSitting] = useState(() => sittings++);
  const [hint, setHint] = useState('');
  return <GameShell fullBleed autoNarrate={false} worldId="fox-trail" title={w.title} instruction={w.instruction} hearIt={hint || w.instruction}>
    <section className="ft" data-adventure="fox-trail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setHint(''); setSitting(sittings++); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <FoxTrailPlay key={sitting} variant={sitting} w={w} onHint={setHint} onDone={() => setDone(true)} />}
    </section>
  </GameShell>;
}

/** Reads the palette once: every colour the canvases paint comes from the maker tokens. */
function readPalette(probe: HTMLElement): GrassPalette {
  // No transition on the probe: a page-wide reduced-motion rule turns transitions
  // into a near-zero duration, and a computed colour would read the start of it.
  probe.style.setProperty('transition', 'none', 'important');
  const rgb = (value: string): Rgb => {
    probe.style.setProperty('color', value, 'important');
    const out = getComputedStyle(probe).color;
    const nums = (out.match(/-?[\d.]+/g) ?? ['0', '0', '0']).map(Number);
    // `color(srgb r g b)` comes back as 0..1 channels; the classic form as 0..255.
    const unit = out.trim().startsWith('color(');
    const [r, g, b] = unit ? nums.slice(0, 3).map(v => Math.round(v * 255)) : nums.slice(0, 3);
    return [r || 0, g || 0, b || 0];
  };
  const mix = (a: string, b: string, p: number) => rgb(`color-mix(in srgb, var(${a}) ${p}%, var(${b}))`);
  return {
    back: { dusk: [mix('--mk-leaf-deep', '--mk-plum', 64), mix('--mk-leaf-deep', '--mk-rose-deep', 70), mix('--mk-leaf', '--mk-plum', 64)], night: [mix('--mk-teal-deep', '--mk-night', 45), mix('--mk-leaf-deep', '--mk-indigo-deep', 42), mix('--mk-celadon-deep', '--mk-indigo', 40)] },
    front: { dusk: [mix('--mk-leaf-deep', '--mk-plum', 70), mix('--mk-leaf', '--mk-plum', 70), mix('--mk-leaf', '--mk-rose-deep', 66)], night: [mix('--mk-teal-deep', '--mk-night', 50), mix('--mk-leaf-deep', '--mk-indigo-deep', 46), mix('--mk-celadon', '--mk-indigo', 42)] },
    fore: { dusk: [mix('--mk-leaf-deep', '--mk-plum', 48), mix('--mk-leaf-deep', '--mk-umber', 55), mix('--mk-moss', '--mk-plum', 52)], night: [mix('--mk-night', '--mk-teal-deep', 68), mix('--mk-night', '--mk-leaf-deep', 62), mix('--mk-indigo-deep', '--mk-teal-deep', 60)] },
    flower: { dusk: [mix('--mk-lilac', '--mk-rose', 62), mix('--mk-bluebell', '--mk-rose', 58), mix('--mk-blossom', '--mk-rose', 60)], night: [mix('--mk-lilac', '--mk-indigo', 62), mix('--mk-bluebell', '--mk-indigo', 56), mix('--mk-snow-shade', '--mk-indigo', 62)] },
    moon: mix('--mk-snow', '--mk-sky-pale', 70), moonCore: rgb('var(--mk-butter)'), bud: mix('--mk-sage', '--mk-plum', 60),
    fluff: mix('--mk-butter', '--mk-white', 50), firefly: rgb('var(--mk-butter)'), sparkleDusk: mix('--mk-blossom', '--mk-white', 50), sparkleNight: rgb('var(--mk-snow)'),
    ring: mix('--mk-snow', '--mk-sky', 70), mote: rgb('var(--mk-sun)'), dust: mix('--mk-snow', '--mk-linen', 60), drop: mix('--mk-sky-pale', '--mk-white', 60), paw: mix('--mk-sea', '--mk-snow', 62),
  };
}

interface Held { left: Set<number>; right: Set<number>; keys: Set<string> }
/** A toy the child can tap: where it is (world units, y down) and how near a tap must land. */
interface Toy { id: string; kind: 'pad' | 'cushion' | 'tile' | 'flower' | 'lamp' | 'friend' | 'can' | 'sun'; x: number; y: number; r: number; n: number }
const FRIENDS = new Set<string>(STATIONS.map(st => st.id));
const TOYS: readonly Toy[] = [
  ...BOUNCERS.map((cap, n): Toy => ({ id: `pad${n}`, kind: 'pad', x: cap.x, y: GROUND_Y - 14, r: 48, n })),
  ...LOGS.map((log, n): Toy => ({ id: `cushion${n}`, kind: 'cushion', x: log.x, y: GROUND_Y - 20, r: 48, n })),
  ...STONES.map((stone, n): Toy => ({ id: `tile${n}`, kind: 'tile', x: stone.x, y: GROUND_Y - 8, r: 42, n })),
  ...FLOWER_XS.map((x, n): Toy => ({ id: `flower${n}`, kind: 'flower', x, y: GROUND_Y - 50, r: 44, n })),
  ...LAMP_XS.map((x, n): Toy => ({ id: `lamp${n}`, kind: 'lamp', x, y: GROUND_Y - 52, r: 44, n })),
  ...STATIONS.map((st, n): Toy => ({ id: st.id, kind: 'friend', x: st.x, y: GROUND_Y - st.h * 0.55, r: Math.max(50, st.h * 0.6), n })),
  { id: 'can', kind: 'can', x: CAN_X, y: GROUND_Y - 20, r: 36, n: 0 },
  { id: 'sun', kind: 'sun', x: SUN.x, y: SUN.y, r: 74, n: 0 },
];

function FoxTrailPlay({ w, variant, onHint, onDone }: { w: Words; variant: number; onHint: (text: string) => void; onDone: () => void }) {
  const [seeds, setSeeds] = useState<Record<string, SeedStatus>>(() => ({ ...initialFoxState(variant).seeds }));
  const [phase, setPhase] = useState<WorldPhase>('dusk');
  const [offerable, setOfferable] = useState(false);
  const [near, setNear] = useState(false);
  const [hintKey, setHintKey] = useState<HintKey>('hintStart');
  const [suggest, setSuggest] = useState<Move>('');
  const [ghost, setGhost] = useState<Move>('');
  const [pulse, setPulse] = useState(0);
  const [doneReady, setDoneReady] = useState(false);
  const [finale, setFinale] = useState(false);
  const [sunLit, setSunLit] = useState(false);
  const [homed, setHomed] = useState(0);
  const [scout, setScout] = useState<{ src: string; near: boolean } | null>(null);
  const [tapMark, setTapMark] = useState<{ x: number; y: number; n: number } | null>(null);
  const podX = useRef(initialFoxState(variant).seedX.stone).current;

  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const moveRefs = useRef<{ el: HTMLElement; f: number }[]>([]);
  const nightRefs = useRef<HTMLDivElement[]>([]);
  const duskRefs = useRef<HTMLDivElement[]>([]);
  const backCanvas = useRef<HTMLCanvasElement>(null);
  const frontCanvas = useRef<HTMLCanvasElement>(null);
  const pepRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const beaconRef = useRef<HTMLElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const parts = useRef<PuppetParts>({}).current;
  const followers = useRef<(HTMLImageElement | null)[]>([]).current;
  const toyEls = useRef(new Map<string, HTMLElement>()).current;
  const state = useRef<FoxState>(initialFoxState(variant));
  const held = useRef<Held>({ left: new Set(), right: new Set(), keys: new Set() });
  const edges = useRef<Pick<FoxInput, 'jump' | 'roll' | 'offer' | 'target'>>({});
  const sounds = useRef<FoxSounds | null>(null);
  const reduced = useRef(false);
  const size = useRef({ w: 0, h: 0, scale: 1, viewW: 800, dpr: 1, top: 0 });
  const ui = useRef({ seedAt: -10, blockedAt: -10, starAt: -10, finaleAt: -1 });
  const kicks = useRef(new Map<string, number>()).current;
  const camRef = useRef({ x: 0, y: 0 });
  const clock = useRef(0);
  const moodTimers = useRef<number[]>([]);

  const reg = (f: number) => (el: HTMLElement | null) => { if (el && !moveRefs.current.some(m => m.el === el)) moveRefs.current.push({ el, f }); };
  const regNight = (el: HTMLDivElement | null) => { if (el && !nightRefs.current.includes(el)) nightRefs.current.push(el); };
  const regDusk = (el: HTMLDivElement | null) => { if (el && !duskRefs.current.includes(el)) duskRefs.current.push(el); };
  const toyRef = (id: string) => (el: HTMLElement | null) => { if (el) toyEls.set(id, el); else toyEls.delete(id); };
  /** A toy answers: a quick squash-and-spring made with transforms. */
  const kick = (id: string) => { kicks.set(id, clock.current); };
  /** A friend at a station is glad: a hop made with transforms, in their own voice. */
  const cheer = (who: FriendId, quiet = false) => { kick(who); if (!quiet) sounds.current?.friend(STATIONS.find(st => st.id === who)?.low ?? false); };

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced.current = !!media?.matches;
    const change = () => { reduced.current = !!media?.matches; };
    media?.addEventListener?.('change', change);
    const timers = moodTimers.current;
    return () => { media?.removeEventListener?.('change', change); timers.forEach(id => window.clearTimeout(id)); };
  }, []);

  // The one loop: fixed-step simulation, then everything moved by hand (no React render per frame).
  useEffect(() => {
    const stage = stageRef.current, probe = probeRef.current;
    if (!stage || !probe) return;
    const fox = createFoxSounds(); sounds.current = fox;
    const palette = readPalette(probe);
    const glow = glowSprite(palette.firefly);
    const grass: GrassField = createGrass();
    const backCtx = backCanvas.current?.getContext('2d') ?? null, frontCtx = frontCanvas.current?.getContext('2d') ?? null;
    const anim = {
      cam: 0, camY: 0, snapped: false, acc: 0, last: 0, t: 0, lastVx: 0, accel: 0,
      sit: 0, facing: 1, spin: 0, tuck: 0, squash: 0, stretch: 0, shake: 0, joy: 0, foot: 0, cricketAt: 0, nightShown: false,
      lastHint: '' as HintKey, lastOffer: false, lastNear: false, lastSuggest: '' as Move, lastGhost: '' as Move, lastPhase: 'dusk' as WorldPhase, doneAt: -1,
      learned: { run: false, roll: false, jump: false }, lastScout: '', homed: 0, sunLit: false,
      opened: new Set<number>(), met: new Set<string>(), starX: NOOK.x, starY: NOOK.y,
    };
    /** Where Pep has just been: the petals of light follow along it. */
    const wake: { x: number; y: number }[] = [];

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Pep is the hero: a wide window shows VIEW_H of the scene's height, a narrow
      // one at least MIN_VIEW of trail (the sky then runs on above the gardens).
      const scale = Math.min(rect.height / VIEW_H, rect.width / (rect.width > 600 ? WIDE_VIEW : MIN_VIEW)) || 1;
      const top = rect.height - (WORLD_H - CROP) * scale;
      const viewW = Math.min(WORLD_W, rect.width / scale);
      size.current = { w: rect.width, h: rect.height, scale, viewW, dpr, top };
      const farW = Math.max(FAR.minW, viewW + 220), farH = farW * FAR.aspect;
      stage.style.setProperty('--ft-scale', String(scale));
      stage.style.setProperty('--ft-top', `${top.toFixed(1)}px`);
      stage.style.setProperty('--ft-farw', `${farW.toFixed(0)}px`);
      stage.style.setProperty('--ft-farh', `${farH.toFixed(0)}px`);
      stage.style.setProperty('--ft-fartop', `${(FAR.lake - farH * FAR.lakeRow).toFixed(0)}px`);
      for (const c of [backCanvas.current, frontCanvas.current]) {
        if (!c) continue;
        c.width = Math.max(1, Math.round(rect.width * dpr)); c.height = Math.max(1, Math.round(rect.height * dpr));
      }
      anim.snapped = false;
    };
    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(stage);

    const input = (): FoxInput => {
      const h = held.current;
      const right = h.right.size > 0 || h.keys.has('right'), left = h.left.size > 0 || h.keys.has('left');
      const e = edges.current; edges.current = {};
      return { dir: right === left ? 0 : right ? 1 : -1, ...e };
    };
    const feetY = (s: FoxState) => WORLD_H - s.y;

    const handleEvents = (s: FoxState) => {
      for (const ev of s.events) {
        if (ev === 'seed') {
          const id = SEED_IDS.find(k => s.seeds[k] === 'carried' && state.current.seeds[k] !== 'carried') ?? 'tallGrass';
          fox.chime(carriedCount(s) - 1);
          burstMotes(grass, s.seedX[id], WORLD_H - surfaceAt(s.seedX[id]) - SEEDS[id].lift - 18, 1, 18);
          ui.current.seedAt = s.t; anim.joy = 1; void selectionHaptic();
        } else if (ev === 'shake') { fox.shake(); burstMotes(grass, SEEDS.tallGrass.x, GROUND_Y - 40, 0, 12); cheer('aya', true); }
        else if (ev === 'hum') { fox.hum(); kick('sun'); setPulse(p => p + 1); }
        else if (ev === 'blocked') ui.current.blockedAt = s.t;
        else if (ev === 'wake') { fox.wake(); void selectionHaptic(); cheer('gobgob', true); }
        else if (ev === 'hop') { fox.hop(); anim.stretch = 0.7; const i = LOGS.findIndex(l => Math.abs(l.x - s.x) < l.r + 40); if (i >= 0) kick(`cushion${i}`); }
        else if (ev === 'jump') { fox.hop(); anim.stretch = 1; anim.learned.jump = true; if (!inWater(s.x, s.y - 2)) puff(grass, s.x, feetY(s), 2, 5); }
        else if (ev === 'land') {
          fox.land(false); anim.squash = 1; puff(grass, s.x, feetY(s), 2, 7);
          const tile = STONES.findIndex(st => Math.abs(st.x - s.x) < st.w / 2);
          if (tile >= 0 && s.y > surfaceAt(STREAM.from - 60) - 6) { fox.tile(tile); kick(`tile${tile}`); if (s.phase === 'night') burstMotes(grass, s.x, feetY(s) - 4, 1, 8); }
        } else if (ev === 'splash') { fox.land(true); anim.squash = Math.max(anim.squash, 0.5); puff(grass, s.x, POOL.line, 3, 6); }
        else if (ev === 'roll') { fox.roll(); anim.learned.roll = true; if (s.onGround) puff(grass, s.x, feetY(s), 2, 6, -s.rollDir); }
        else if (ev === 'rollEnd') { if (s.onGround) puff(grass, s.x, feetY(s), 2, 4, s.rollDir); }
        else if (ev === 'skid') { fox.skid(); puff(grass, s.x, feetY(s), 2, 8, Math.sign(s.vx)); }
        else if (ev === 'bounce') { fox.bounce(s.bounces); anim.squash = 0.6; anim.stretch = 1; kick(`pad${s.bouncer}`); puff(grass, s.x, feetY(s), 2, 5); if (s.phase === 'night') burstMotes(grass, s.x, feetY(s) - 4, 1, 10); if (s.bounces === 3) { void selectionHaptic(); if (s.bouncer === 1) cheer('chock', true); } }
        else if (ev === 'shakeDry') { fox.dry(); anim.shake = 1; puff(grass, s.x, feetY(s) - 36, 3, 14); cheer('bebe', true); }
        else if (ev === 'fallenStar') { fox.starlet(); ui.current.starAt = s.t; anim.joy = 1; burstMotes(grass, NOOK.x, NOOK.y, 1, 18); void selectionHaptic(); }
      }
    };

    /** What the ScoutCam shows: the next thing worth finding ahead of Pep. */
    const scoutFor = (s: FoxState): { key: string; src: string; near: boolean } | null => {
      if (s.phase !== 'dusk') return null;
      let best: { key: string; src: string; d: number } | null = null;
      for (const id of SEED_IDS) {
        if (s.seeds[id] === 'carried') continue;
        const d = Math.abs(s.seedX[id] - s.x);
        if (!best || d < best.d) best = { key: id, src: PETAL_ART[id].src, d };
      }
      if (!best) return { key: 'sun', src: SPRITES.sunUnlit.src, near: nearStone(s) };
      return { key: best.key, src: best.src, near: best.d < 300 };
    };

    const syncUi = (s: FoxState) => {
      if (s.seeds.tallGrass !== seedsRef.tallGrass || s.seeds.stone !== seedsRef.stone || s.seeds.hollow !== seedsRef.hollow) { seedsRef = { ...s.seeds }; setSeeds(seedsRef); }
      if (s.phase !== anim.lastPhase) { anim.lastPhase = s.phase; setPhase(s.phase); if (s.phase === 'night') anim.doneAt = s.t + 1.2; }
      if (anim.doneAt > 0 && s.t >= anim.doneAt) { anim.doneAt = -1; setDoneReady(true); }
      const offer = canOffer(s); if (offer !== anim.lastOffer) { anim.lastOffer = offer; setOfferable(offer); }
      const nearNow = nearStone(s) && s.phase === 'dusk'; if (nearNow !== anim.lastNear) { anim.lastNear = nearNow; setNear(nearNow); }
      if (s.dist > 60) anim.learned.run = true;
      const blocked = s.t - ui.current.blockedAt < 4.5;
      const grassNear = s.seeds.tallGrass === 'hidden' && s.x > TALL_GRASS.from - 60 && s.x < TALL_GRASS.to + 40;
      const podNear = s.seeds.stone === 'resting' && Math.abs(s.x - s.seedX.stone) < 80;
      const sug: Move = s.phase !== 'dusk' ? '' : blocked || grassNear ? 'roll' : podNear ? 'jump' : '';
      if (sug !== anim.lastSuggest) { anim.lastSuggest = sug; setSuggest(sug); }
      // The ghost hand shows a move on the real control until the child has made that move once.
      const g: Move = s.phase !== 'dusk' ? '' : !anim.learned.run ? (s.t > 1.1 ? 'right' : '') : sug === 'roll' && !anim.learned.roll ? 'roll' : sug === 'jump' && !anim.learned.jump ? 'jump' : '';
      if (g !== anim.lastGhost) { anim.lastGhost = g; setGhost(g); }
      const sc = scoutFor(s), scKey = sc ? `${sc.key}${sc.near ? '!' : ''}` : '';
      if (scKey !== anim.lastScout) { anim.lastScout = scKey; setScout(sc ? { src: sc.src, near: sc.near } : null); }
      let key: HintKey = '';
      if (s.phase === 'waking') key = 'hintWaking';
      else if (s.phase === 'night') key = s.t - ui.current.starAt < 2.8 ? 'hintStar' : 'hintNight';
      else if (s.t - ui.current.starAt < 2.8) key = 'hintStar';
      else if (s.t - ui.current.seedAt < 2.6) key = 'hintSeed';
      else if (blocked) key = 'hintTunnel';
      else if (nearStone(s)) key = carriedCount(s) === 3 ? 'hintReady' : 'hintStone';
      else if (grassNear) key = 'hintGrass';
      else if (podNear || (s.seeds.stone === 'resting' && s.x > STREAM.from - 200 && s.x < STREAM.to)) key = 'hintStream';
      else if (!anim.learned.run) key = 'hintStart';
      if (key !== anim.lastHint) { anim.lastHint = key; setHintKey(key); }
    };
    let seedsRef = { ...state.current.seeds };

    const render = (dt: number) => {
      const s = state.current, { scale, viewW, dpr, top, h } = size.current, rm = reduced.current;
      anim.t += dt; clock.current = anim.t;
      const finaleAge = ui.current.finaleAt >= 0 ? anim.t - ui.current.finaleAt : -1;
      // camera: follows along the trail, and lifts when a bounce carries Pep high
      anim.cam = cameraFollow(anim.cam, s.x, s.facing, viewW, dt, !anim.snapped);
      const seen = h / scale, camGoal = clamp(s.y - CROP + 150 - seen, 0, Math.max(0, WORLD_H + 200 - seen));
      anim.camY = anim.snapped && !rm ? anim.camY + (camGoal - anim.camY) * Math.min(1, dt * 5) : camGoal;
      anim.snapped = true;
      const cam = anim.cam, camY = anim.camY; camRef.current = { x: cam, y: camY };
      for (const m of moveRefs.current) {
        const f = rm && m.f < 0.9 ? 0 : m.f;
        m.el.style.transform = `translate3d(${(-cam * f * scale).toFixed(1)}px,${(camY * scale * (m.f < 0.1 ? 0.3 : m.f < 0.9 ? 0.7 : 1)).toFixed(1)}px,0)`;
      }
      // the lights come back: a ring from the Dome's sun (a cross-fade with motion reduced)
      const mx = (SUN.x - cam) * scale, my = top + (SUN.y + camY) * scale;
      const radius = wakeRadius(s.phase, s.wake) * scale;
      const fade = s.phase === 'night' ? 1 : s.phase === 'waking' ? clamp((s.wake - OFFER_T) / ((WAKE_T - OFFER_T) * 0.55), 0, 1) : 0;
      for (const el of nightRefs.current) {
        if (s.phase === 'dusk') { el.style.display = 'none'; continue; }
        el.style.display = '';
        if (rm || s.phase === 'night') { el.style.clipPath = ''; el.style.opacity = String(rm ? fade : 1); }
        else { el.style.opacity = '1'; el.style.clipPath = `circle(${radius.toFixed(0)}px at ${mx.toFixed(0)}px ${my.toFixed(0)}px)`; }
      }
      if (s.phase === 'night' && !anim.nightShown) { anim.nightShown = true; for (const el of duskRefs.current) el.style.visibility = 'hidden'; }
      const nightAt = (sx: number, sy: number) => {
        if (s.phase === 'dusk') return 0;
        if (s.phase === 'night') return 1;
        if (rm) return fade;
        const d = Math.hypot(sx - mx * dpr, sy - my * dpr);
        return clamp((radius * dpr - d) / (50 * dpr), 0, 1);
      };

      // Pep
      const speed = Math.abs(s.vx) / RUN_MAX;
      const accel = (s.vx - anim.lastVx) / Math.max(dt, 1e-3) * s.facing; anim.lastVx = s.vx;
      anim.accel += (accel - anim.accel) * Math.min(1, dt * 8);
      anim.facing += (s.facing - anim.facing) * Math.min(1, dt * (rm ? 30 : 18));
      const rollingNow = s.roll > 0;
      const r = 1 - s.roll / ROLL_T;
      const tuckGoal = rollingNow ? (inTunnel(s.x) && !upOnRoof(s.x, s.y) ? 1 : r < 0.12 ? r / 0.12 : r > 0.84 ? (1 - r) / 0.16 : 1) : 0;
      anim.tuck += (tuckGoal - anim.tuck) * Math.min(1, dt * 22);
      if (rollingNow) anim.spin += Math.abs(s.vx) * dt / ROLL_RADIUS;
      else if (anim.spin > 0) { const goal = Math.ceil(anim.spin / TAU - 1e-3) * TAU; anim.spin = Math.min(goal, anim.spin + dt * 16); if (anim.spin >= goal - 1e-3) anim.spin = 0; }
      const sitting = (s.still > 3 || s.phase === 'waking') && finaleAge < 0;
      anim.sit += ((sitting ? 1 : 0) - anim.sit) * Math.min(1, dt * 5);
      anim.squash = Math.max(0, anim.squash - dt * 5.5); anim.stretch = Math.max(0, anim.stretch - dt * 4.5);
      anim.shake = Math.max(0, anim.shake - dt * 1.5); anim.joy = Math.max(0, anim.joy - dt * 1.6);
      const air = !s.onGround;
      const legPhase = s.dist / STRIDE * TAU;
      // a found petal: one happy hop made with the body, no pose change
      const joyHop = rm ? 0 : Math.sin(Math.min(1, (1 - anim.joy) * 1.6) * Math.PI) * 9 * (anim.joy > 0 ? 1 : 0);
      // the last celebration: three happy hops on the spot
      const hopPhase = finaleAge >= 0 && !rm ? finaleAge * 5.4 : 0, hopFinale = finaleAge >= 0 && !rm ? Math.abs(Math.sin(hopPhase)) * 20 * Math.max(0, 1 - finaleAge / 2.3) : 0;
      const pose = pepPose({ phase: legPhase, speed: rollingNow ? 0 : speed, accel: anim.accel, air: (air && !rollingNow) || hopFinale > 3, vy: hopFinale > 3 ? Math.cos(hopPhase) * Math.sign(Math.sin(hopPhase)) * 300 : s.vy, tuck: anim.tuck, spin: anim.spin, squash: Math.max(anim.squash, finaleAge >= 0 && hopFinale < 3 ? 0.6 : 0), stretch: anim.stretch, sit: anim.sit, shake: anim.shake, t: anim.t, reduced: rm });
      pose.lift += joyHop + hopFinale;
      applyPepPose(parts, pose);
      if (faceRef.current) faceRef.current.style.transform = `scale(${(-anim.facing).toFixed(3)},1)`;
      const fy = feetY(s);
      if (pepRef.current) pepRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px,${fy.toFixed(1)}px,0)`;
      const floor = upOnRoof(s.x, s.y) ? s.y : surfaceAt(s.x), lift = clamp((s.y - floor) / 160, 0, 1);
      if (shadowRef.current) {
        shadowRef.current.style.transform = `translate3d(${s.x.toFixed(1)}px,${(WORLD_H - floor).toFixed(1)}px,0) scale(${(1 - lift * 0.55).toFixed(3)},1)`;
        shadowRef.current.style.opacity = (inWater(s.x, s.y) ? 0 : 0.5 * (1 - lift * 0.7)).toFixed(2);
      }
      // TraceBeacon: the light on Pep's harness wakes when something worth finding is near
      const nearest = SEED_IDS.reduce((d, id) => s.seeds[id] === 'carried' ? d : Math.min(d, Math.abs(s.seedX[id] - s.x)), 9999);
      const trace = s.phase === 'dusk' ? clamp(1 - nearest / 320, 0, 1) : 0;
      if (beaconRef.current) beaconRef.current.style.opacity = (trace * (rm ? 0.9 : 0.6 + 0.4 * Math.sin(anim.t * (4 + trace * 8)))).toFixed(2);

      // the petal shaken out of the lavender: a little arc
      if (popRef.current) {
        const p = s.seeds.tallGrass === 'popping' ? clamp(s.pop / 0.7, 0, 1) : s.seeds.tallGrass === 'hidden' ? 0 : 1;
        const px = SEEDS.tallGrass.x + (s.seedX.tallGrass - SEEDS.tallGrass.x) * p;
        const py = GROUND_Y - Math.sin(Math.PI * p) * 95 - (s.seeds.tallGrass === 'hidden' ? 4 : 0);
        popRef.current.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`;
      }
      // petals of light follow where Pep has been, then fly home to the Dome's sun
      wake.unshift({ x: s.x - s.facing * 26, y: fy - 62 }); if (wake.length > 90) wake.length = 90;
      const carried = SEED_IDS.filter(id => s.seeds[id] === 'carried');
      const lights: { x: number; y: number; r: number; a: number }[] = [];
      for (let i = 0; i < 3; i++) {
        const el = followers[i]; if (!el) continue;
        if (i >= carried.length || s.phase === 'night') { el.style.opacity = '0'; continue; }
        const trail = wake[Math.min(wake.length - 1, Math.round((0.16 + i * 0.13) / Math.max(dt, 1 / 120)))] ?? wake[wake.length - 1];
        let x = trail.x - s.facing * i * 6, y = trail.y - i * 5 + (rm ? 0 : Math.sin(anim.t * 3 + i * 1.7) * 4), a = 1, k = 1;
        if (s.phase === 'waking') {
          const p = clamp((s.wake - 0.1 - i * 0.3) / 0.42, 0, 1), e = p * p * (3 - 2 * p);
          x += (SUN.x - x) * e; y += (SUN.y - y) * e - Math.sin(Math.PI * p) * 46; k = 1 - e * 0.4; a = p >= 1 ? 0 : 1;
          if (p >= 1 && anim.homed <= i) { anim.homed = i + 1; setHomed(i + 1); fox.petalHome(i); kick('sun'); burstMotes(grass, SUN.x, SUN.y, 1, 12); }
        }
        el.style.opacity = String(a);
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${k.toFixed(2)})`;
        if (a > 0) lights.push({ x, y, r: 26, a: 0.55 });
      }
      if (s.phase !== 'dusk' && s.wake >= OFFER_T && !anim.sunLit) { anim.sunLit = true; setSunLit(true); }

      // the fallen star: asleep in the ferns on the planter, then at Pep's shoulder
      if (s.star === 'awake') {
        const gx = s.x - s.facing * 44 + (rm ? 0 : Math.cos(anim.t * 2.1) * 12), gy = fy - 96 + (rm ? 0 : Math.sin(anim.t * 2.7) * 9);
        anim.starX += (gx - anim.starX) * Math.min(1, dt * 3.4); anim.starY += (gy - anim.starY) * Math.min(1, dt * 3.4);
      }
      const twinkle = rm ? 0.8 : 0.6 + 0.4 * Math.sin(anim.t * (s.star === 'awake' ? 5 : 1.6));
      lights.push({ x: anim.starX, y: anim.starY, r: s.star === 'awake' ? 32 : 30, a: twinkle * (s.star === 'awake' ? 1 : 0.85) });
      lights.push({ x: anim.starX, y: anim.starY, r: 9, a: 1 });
      // the last celebration: the valley's lights spiral up around Pep
      if (finaleAge >= 0) {
        const n = rm ? 6 : 14;
        for (let i = 0; i < n; i++) {
          const p = clamp(finaleAge / 2.1 - i * 0.03, 0, 1), ang = i * (TAU / n) + (rm ? 0 : finaleAge * 3.2), rad = 30 + p * 80;
          lights.push({ x: s.x + Math.cos(ang) * rad, y: fy - 40 - p * 150 + Math.sin(ang) * rad * 0.35, r: 20 + (i % 3) * 5, a: Math.sin(Math.PI * Math.min(1, p * 1.05)) });
        }
      }

      // toys: each answers a tap or a touch with a damped spring
      for (const [id, at] of kicks) {
        const el = toyEls.get(id), age = anim.t - at;
        if (!el || age > 0.9) { kicks.delete(id); if (el) el.style.transform = ''; continue; }
        const v = rm ? 0 : Math.exp(-age * 5.5) * Math.cos(age * 24);
        const friend = FRIENDS.has(id), squashy = friend || id.startsWith('pad') || id.startsWith('cushion') || id.startsWith('tile');
        el.style.transform = squashy
          ? `translate3d(0,${(friend ? -Math.abs(v) * 12 : 0).toFixed(1)}px,0) scale(${(1 + (friend ? 0.05 : 0.13) * v).toFixed(3)},${(1 - (friend ? 0.08 : 0.22) * v).toFixed(3)})`
          : id === 'sun' ? `rotate(${(v * 14).toFixed(1)}deg) scale(${(1 + 0.06 * Math.abs(v)).toFixed(3)})` : `rotate(${(v * 11).toFixed(1)}deg)`;
      }
      // knit flowers open as Pep goes by; Aya looks up the first time
      for (let i = 0; i < FLOWER_XS.length; i++) {
        if (anim.opened.has(i) || Math.abs(FLOWER_XS[i] - s.x) > 62) continue;
        anim.opened.add(i); const el = toyEls.get(`flower${i}`); if (el) el.dataset.open = 'true';
        kick(`flower${i}`); fox.flower(i);
      }
      // each friend looks up and hops the first time Pep reaches their station
      for (const st of STATIONS) if (!anim.met.has(st.id) && Math.abs(st.x - s.x) < 80 && s.dist > 100) { anim.met.add(st.id); cheer(st.id); }

      // footfalls on the run cycle; the swish and the pool follow Pep
      const foot = Math.floor(legPhase / Math.PI);
      if (foot !== anim.foot) {
        if (s.onGround && !rollingNow && speed > 0.05) {
          const wet = inWater(s.x, s.y);
          fox.footfall(wet, 0.4 + speed * 0.6);
          if (s.phase === 'night' && !wet && !upOnRoof(s.x, s.y) && surfaceAt(s.x) < s.y + 2) pawprint(grass, s.x - s.facing * 8, fy + 3 + (foot % 2) * 3, anim.t);
          if (speed > 0.92 && foot % 2 === 0) puff(grass, s.x - s.facing * 30, fy, 2, 1, -s.facing);
        }
        anim.foot = foot;
      }
      const frame = { t: anim.t, dt, cam, viewW, scale: scale * dpr, top: (top + camY * scale) * dpr, fox: { x: s.x, y: s.y, vx: s.vx, rolling: rollingNow, rollDir: s.rollDir }, reduced: rm, night: nightAt, wakeAge: s.phase === 'dusk' ? 0 : Math.max(0, s.wake - OFFER_T), isNight: s.phase === 'night' };
      const swish = updateGrass(grass, frame);
      const streamNear = 1 - clamp(Math.abs(s.x - (STREAM.from + STREAM.to) / 2) / 650, 0, 1);
      fox.beds(Math.min(1, swish * (0.4 + speed)), streamNear, s.phase === 'night');
      if (s.phase === 'night' && anim.t > anim.cricketAt) { fox.cricket(); anim.cricketAt = anim.t + 0.7 + ((anim.t * 5.13) % 1) * 1.8; }
      if (backCtx) drawGrass(backCtx, grass, frame, palette, 'back');
      if (frontCtx) {
        const ringA = s.phase === 'waking' && !rm && s.wake > OFFER_T ? clamp(1 - (s.wake - OFFER_T) / (WAKE_T - OFFER_T), 0, 1) ** 0.6 : 0;
        drawGrass(frontCtx, grass, frame, palette, 'front', { glow, lights, ring: { x: mx * dpr, y: my * dpr, r: radius * dpr, a: ringA } });
      }
    };

    let raf = 0, running = false;
    const tick = (now: number) => {
      if (!running) return;
      const dt = anim.last ? Math.min(0.05, (now - anim.last) / 1000) : 1 / 60;
      anim.last = now;
      anim.acc += dt;
      let guard = 0;
      while (anim.acc >= STEP_DT && guard++ < 12) {
        const next = step(state.current, input(), STEP_DT);
        if (next.events.length) handleEvents(next);
        state.current = next;
        anim.acc -= STEP_DT;
      }
      if (guard >= 12) anim.acc = 0;
      syncUi(state.current);
      render(dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (running) return; running = true; anim.last = 0; raf = requestAnimationFrame(tick); };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const release = () => { held.current.left.clear(); held.current.right.clear(); held.current.keys.clear(); };
    const visibility = () => { if (document.hidden) { stop(); release(); fox.stop(); } else start(); };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', release);

    // keyboard: ← → run, ↓ or Shift roll, Space or ↑ jump
    const ours = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      return !el || el === document.body || !!el.closest?.('[data-adventure="fox-trail"]');
    };
    const down = (e: KeyboardEvent) => {
      if (!ours(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      const onButton = (e.target as HTMLElement | null)?.tagName === 'BUTTON';
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); held.current.keys.add(k === 'ArrowLeft' ? 'left' : 'right'); return; }
      if (e.repeat) return;
      if (k === 'ArrowDown' || k === 'Shift') { e.preventDefault(); edges.current.roll = true; return; }
      if ((k === ' ' && !onButton) || k === 'ArrowUp') { e.preventDefault(); edges.current.jump = true; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') held.current.keys.delete('left');
      if (e.key === 'ArrowRight') held.current.keys.delete('right');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      stop(); observer?.disconnect(); release();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', release);
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      fox.dispose(); sounds.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hintText = hintKey ? w[hintKey] : '';
  useEffect(() => { onHint(hintText); }, [hintText]); // eslint-disable-line react-hooks/exhaustive-deps

  // The finish: two seconds that belong to this trail, then the Studio takes over.
  useEffect(() => {
    if (!finale) return;
    const id = window.setTimeout(onDone, reduced.current ? 1500 : FINALE_MS);
    return () => window.clearTimeout(id);
  }, [finale]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── input ── */
  const hold = (side: 'left' | 'right') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      held.current[side].add(e.pointerId); edges.current.target = null; void selectionHaptic();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => { held.current[side].delete(e.pointerId); },
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => { held.current[side].delete(e.pointerId); },
    onLostPointerCapture: (e: ReactPointerEvent<HTMLButtonElement>) => { held.current[side].delete(e.pointerId); },
    // Keyboard (Enter / Space on the pad): a few trotting steps that way.
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => { if (e.detail === 0) edges.current.target = state.current.x + (side === 'right' ? 220 : -220); },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  const press = (what: 'jump' | 'roll') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse' && e.button !== 0) return; edges.current[what] = true; void selectionHaptic(); },
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => { if (e.detail === 0) edges.current[what] = true; },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  /** A tap in the picture: the toy under it answers at once, and Pep trots over. */
  const tapTrail = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect(), { scale, top } = size.current;
    const wx = camRef.current.x + (e.clientX - rect.left) / scale, wy = (e.clientY - rect.top - top) / scale - camRef.current.y;
    let hit: Toy | null = null, best = Infinity;
    for (const toy of TOYS) { const d = Math.hypot(toy.x - wx, (toy.y - wy) * 0.8); if (d < toy.r && d < best) { best = d; hit = toy; } }
    const fox = sounds.current;
    if (hit) {
      kick(hit.id); void selectionHaptic();
      if (hit.kind === 'pad') fox?.bounce(1 + hit.n);
      else if (hit.kind === 'tile') fox?.tile(hit.n);
      else if (hit.kind === 'flower') { const el = toyEls.get(hit.id); if (el) el.dataset.open = el.dataset.open === 'true' ? 'false' : 'true'; fox?.flower(hit.n); }
      else if (hit.kind === 'friend') cheer(hit.id as FriendId);
      else if (hit.kind === 'sun') fox?.hum();
      else if (hit.kind === 'lamp') { const el = toyEls.get(hit.id); if (el) { el.dataset.blink = 'true'; moodTimers.current.push(window.setTimeout(() => { el.dataset.blink = 'false'; }, 900)); } fox?.flower(hit.n + 3); }
      else fox?.tick();
    } else fox?.tick();
    setTapMark(mark => ({ x: e.clientX - rect.left, y: e.clientY - rect.top, n: (mark?.n ?? 0) + 1 }));
    edges.current.target = wx;
  };
  const offer = () => { edges.current.offer = true; void selectionHaptic(); };
  const finish = () => { if (finale) return; ui.current.finaleAt = clock.current; setFinale(true); sounds.current?.finale(); void selectionHaptic(); for (const st of STATIONS) cheer(st.id, true); };

  const awake = phase !== 'dusk';
  const tone: Tone = awake ? 'night' : 'dusk';
  const lw = (f: number) => ({ '--lw': layerWidth(f) } as CSSProperties);
  const bg = (src: string) => `url(${src})`;
  const plates = (t: Tone) => <>
    <div className="ft-move" ref={reg(PARALLAX.far)} style={lw(PARALLAX.far)}><div className="ft-u"><div className="ft-far" style={{ backgroundImage: bg(PLATES.far[t].src) }} /></div></div>
    <div className="ft-move" ref={reg(PARALLAX.gardens)} style={lw(PARALLAX.gardens)}><div className="ft-u">
      <div className="ft-strip" style={{ top: GARDENS.top, height: PLATES.gardens[t].h * GARDENS.k, backgroundImage: bg(PLATES.gardens[t].src), backgroundSize: `${PLATES.gardens[t].w * GARDENS.k}px 100%` }} />
      <div className="ft-strip ft-strip--one" style={{ left: DOME.x, top: DOME.top, width: PLATES.dome[t].w * DOME.k, height: PLATES.dome[t].h * DOME.k, backgroundImage: bg(PLATES.dome[t].src) }} />
    </div></div>
    <div className="ft-move" ref={reg(1)} style={{ '--lw': TRAIL_W } as CSSProperties}><div className="ft-u">
      <div className="ft-strip" style={{ left: -420, top: WALL.top, height: PLATES.wall[t].h * WALL.k, backgroundImage: bg(PLATES.wall[t].src), backgroundSize: `${PLATES.wall[t].w * WALL.k}px 100%` }} />
    </div></div>
  </>;
  const foot = (x: number, width: number, art: { w: number; h: number }, up = 0, squash = 1): CSSProperties => ({ left: x - width / 2, top: GROUND_Y - up - (width * art.h / art.w) * squash, width, height: (width * art.h / art.w) * squash });
  const carriedIds = SEED_IDS.filter(id => seeds[id] === 'carried');
  const petal = (id: SeedId) => PETAL_ART[id];
  const partStyle = (clip: string, origin: string, fadeAt?: readonly [number, number]): CSSProperties => {
    const mask = fadeAt ? `linear-gradient(to bottom, transparent ${fadeAt[0].toFixed(1)}%, var(--mk-shadow) ${fadeAt[1].toFixed(1)}%)` : undefined;
    return { backgroundImage: bg(PEP_SIDE.src), clipPath: clip, transformOrigin: origin, maskImage: mask, WebkitMaskImage: mask };
  };

  return <div className="ft-play" data-phase={phase} data-finale={finale}>
    <div className="ft-stage" ref={stageRef} role="group" aria-label={awake ? w.sceneNight : w.scene} onPointerDown={tapTrail}>
      <span ref={probeRef} className="ft-probe" aria-hidden="true" />
      <div className="ft-world ft-tone--dusk" ref={regDusk} aria-hidden="true">{plates('dusk')}</div>
      <div className="ft-world ft-tone--night ft-night" ref={regNight} aria-hidden="true" style={{ display: 'none' }}>{plates('night')}</div>
      <canvas className="ft-canvas" ref={backCanvas} aria-hidden="true" />
      <div className={`ft-move ft-objects ft-tone--${tone}`} ref={reg(1)} style={{ '--lw': WORLD_W } as CSSProperties} aria-hidden="true">
        <div className="ft-u">
          {/* the pool, the posts of the raised planter, the Dome's sun on its stand */}
          <div className="ft-pool" style={{ left: POOL.x, top: POOL.top, width: POOL.w, height: WORLD_H - POOL.top + 60, backgroundImage: bg(PLATES.water[tone].src) }} />
          {[TUNNEL.from - 22, TUNNEL.to + 8].map(x => <i key={x} className="ft-post" style={{ left: x, top: PLANTER.top + PLANTER_H - 6, width: 14, height: GROUND_Y - PLANTER.top - PLANTER_H + 8 }} />)}
          <i className="ft-post ft-post--stand" style={{ left: SUN.x - 5, top: SUN.y + 10, width: 10, height: GROUND_Y - SUN.y - 8 }} />
          {LAMP_XS.map((x, i) => <span key={x} className="ft-lamp" ref={toyRef(`lamp${i}`)} style={foot(x, 46, SPRITES.lamp, 6)}><i className="ft-lamp__glow" /><img className="ft-prop" src={SPRITES.lamp.src} alt="" draggable={false} style={i % 2 ? { transform: 'scaleX(-1)' } : undefined} /></span>)}
          {FLOWER_XS.map((x, i) => <span key={x} className="ft-flower" ref={toyRef(`flower${i}`)} data-open="false" style={foot(x, 40, SPRITES.flowerOpen, 4)}>
            <img className="ft-prop ft-flower__folded" src={SPRITES.flowerFolded.src} alt="" draggable={false} /><img className="ft-prop ft-flower__open" src={SPRITES.flowerOpen.src} alt="" draggable={false} />
          </span>)}
          <img className="ft-prop ft-toy" ref={toyRef('can')} src={SPRITES.can.src} alt="" draggable={false} style={foot(CAN_X, 50, SPRITES.can, 2)} />
          {STATIONS.map(st => <span key={st.id} className="ft-friend ft-toy" ref={toyRef(st.id)} style={foot(st.x, st.h * st.art.w / st.art.h, st.art, 5)}>
            <img className="ft-prop" src={st.art.src} alt="" draggable={false} />
            {st.id === 'gobgob' && <i className="ft-pod" data-ready={offerable || awake} style={{ left: `${PULSEPOD[0] * 100}%`, top: `${PULSEPOD[1] * 100}%` }} />}
          </span>)}
          <span className="ft-sun" ref={toyRef('sun')} data-lit={sunLit} data-near={near} data-homed={homed} style={{ left: SUN.x - SUN.size / 2, top: SUN.y - SUN.size / 2, width: SUN.size, height: SUN.size }}>
            <i className="ft-sun__glow" /><img className="ft-prop" src={SPRITES.sunUnlit.src} alt="" draggable={false} /><img className="ft-sun__lit" src={SPRITES.sunLit.src} alt="" draggable={false} />
          </span>
          {COURSE.map(p => <img key={p.id} className="ft-prop ft-toy" ref={toyRef(p.id)} src={p.art.src} alt="" draggable={false} style={foot(p.x, p.w, p.art, p.up ?? 0, p.squash ?? 1)} />)}
          {/* the petals of light that are still lost */}
          {(['stone', 'hollow'] as const).map(id => seeds[id] !== 'carried' && <span key={id} className="ft-petal" data-float={id === 'stone'} style={{ left: (id === 'stone' ? podX : SEEDS[id].x) - 13, top: GROUND_Y - (surfaceAt(id === 'stone' ? podX : SEEDS[id].x) - (WORLD_H - GROUND_Y)) - SEEDS[id].lift - 46 }}>
            <i className="ft-petal__glow" /><img src={petal(id).src} alt="" draggable={false} />
          </span>)}
          <div className="ft-pop" ref={popRef}>{seeds.tallGrass !== 'carried' && <span className="ft-petal" data-hidden={seeds.tallGrass === 'hidden'} style={{ left: -13, top: -46 }}><i className="ft-petal__glow" /><img src={petal('tallGrass').src} alt="" draggable={false} /></span>}</div>
          <div className="ft-shadow" ref={shadowRef} />
          {/* Pep: the kit's side view in his scout harness, worked as a puppet */}
          <div className="ft-pep" ref={pepRef} style={{ transform: `translate3d(${initialFoxState().x}px,${GROUND_Y}px,0)` }}>
            <div className="ft-pep__face" ref={faceRef} style={{ transform: 'scale(-1,1)' }}>
              <div className="ft-pep__sq" ref={el => { parts.sq = el; }} style={{ left: -PEP.foot[0] * PEP.w, top: -PEP.foot[1] * PEP.h, width: PEP.w, height: PEP.h, transformOrigin: `${(PEP.foot[0] * 100).toFixed(1)}% ${(PEP.foot[1] * 100).toFixed(1)}%` }}>
                <div className="ft-pep__spin" ref={el => { parts.spin = el; }} style={{ transformOrigin: PEP.centre }}>
                  <i className="ft-pep__part ft-pep__part--far" ref={el => { parts.hindFar = el; }} style={partStyle(PEP.hind, PEP.hip, PEP.hindFade)} />
                  <i className="ft-pep__part ft-pep__part--far" ref={el => { parts.foreFar = el; }} style={partStyle(PEP.fore, PEP.shoulder, PEP.foreFade)} />
                  <i className="ft-pep__part" style={partStyle(PEP.body, PEP.centre)} />
                  <i className="ft-pep__part" ref={el => { parts.hind = el; }} style={partStyle(PEP.hind, PEP.hip, PEP.hindFade)} />
                  <i className="ft-pep__part" ref={el => { parts.fore = el; }} style={partStyle(PEP.fore, PEP.shoulder, PEP.foreFade)} />
                  <i className="ft-pep__beacon" ref={beaconRef} style={{ left: `${PEP.beacon[0].toFixed(1)}%`, top: `${PEP.beacon[1].toFixed(1)}%` }} />
                </div>
              </div>
            </div>
          </div>
          {[0, 1, 2].map(i => <img key={i} className="ft-follower" ref={el => { followers[i] = el; }} src={petal(carriedIds[i] ?? 'tallGrass').src} alt="" draggable={false} style={{ opacity: 0 }} />)}
          {/* in front of Pep: the water he wades through, and the raised planter he rolls under */}
          <div className="ft-pool ft-pool--front" style={{ left: POOL.x, top: POOL.line, width: POOL.w, height: WORLD_H - POOL.line + 60, backgroundImage: bg(PLATES.water[tone].src) }} />
          <img className="ft-planter" src={PLATES.planter[tone].src} alt="" draggable={false} style={{ left: PLANTER.x, top: PLANTER.top, width: PLANTER.w, height: PLANTER_H }} />
        </div>
      </div>
      <canvas className="ft-canvas ft-canvas--front" ref={frontCanvas} aria-hidden="true" />
      {tapMark && <span key={tapMark.n} className="ft-tapmark" style={{ left: tapMark.x, top: tapMark.y }} aria-hidden="true" />}

      <div className="ft-hud">
        <div className="ft-pips" role="img" aria-label={`${w.seeds}: ${SEED_IDS.map(id => seeds[id] === 'carried' ? w.seedFound : w.seedSleeping).join(', ')}`} key={`pips${pulse}`}>
          {SEED_IDS.map(id => <span key={id} className="ft-pip" data-lit={seeds[id] === 'carried'} data-missing={near && seeds[id] !== 'carried'} />)}
        </div>
        {scout && <div className="ft-scout" role="img" aria-label={w.scoutcam} data-near={scout.near}><img src={scout.src} alt="" draggable={false} /></div>}
        {hintText && <p className="ft-hint" role="status">{hintText}</p>}
        {!hintText && <p className="ft-hint ft-hint--empty" role="status" />}
        {offerable && <button type="button" className="ft-cta" data-ft-offer="" onClick={offer}><Sparkles size={22} aria-hidden="true" />{w.offer}</button>}
        {phase === 'night' && doneReady && !finale && <button type="button" className="ft-cta" data-ft-done="" onClick={finish}><Check size={22} aria-hidden="true" />{w.done}</button>}
      </div>
    </div>
    <div className="ft-deck" role="group" aria-label={w.controls}>
      <div className="ft-deck__pads" dir="ltr">
        <button type="button" className="ft-key" data-ft-control="left" aria-label={w.left} {...hold('left')}><ArrowLeft size={30} aria-hidden="true" /></button>
        <button type="button" className="ft-key" data-ft-control="right" data-suggest={ghost === 'right'} aria-label={w.right} {...hold('right')}><ArrowRight size={30} aria-hidden="true" />{ghost === 'right' && <GhostHand holds />}</button>
      </div>
      <div className="ft-deck__acts">
        <button type="button" className="ft-key ft-key--act" data-ft-control="jump" data-suggest={suggest === 'jump'} aria-label={w.jump} {...press('jump')}><ChevronsUp size={26} aria-hidden="true" /><span>{w.jump}</span>{ghost === 'jump' && <GhostHand />}</button>
        <button type="button" className="ft-key ft-key--act" data-ft-control="roll" data-suggest={suggest === 'roll'} aria-label={w.roll} {...press('roll')}><RotateCw size={26} aria-hidden="true" /><span>{w.roll}</span>{ghost === 'roll' && <GhostHand />}</button>
      </div>
    </div>
  </div>;
}

/** The ghost hand: it shows the move on the real control, never takes a touch,
 * comes back every six seconds, and is gone for good once the child has done it. */
function GhostHand({ holds = false }: { holds?: boolean }) {
  return <span className="ft-ghost" data-holds={holds} aria-hidden="true">
    <svg viewBox="0 0 48 60" focusable="false">
      <path className="ft-ghost__hand" d="M18 30 V11 a5 5 0 0 1 10 0 V26 l9 2.2 a6 6 0 0 1 4.6 6.6 l-1.8 11.6 A9 9 0 0 1 31 54 H22 a9 9 0 0 1 -7.4 -3.9 L7.4 39.6 a4.2 4.2 0 0 1 6.6 -5.2 Z" />
    </svg>
  </span>;
}
