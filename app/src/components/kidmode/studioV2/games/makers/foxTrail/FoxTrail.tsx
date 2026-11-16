import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronsUp, RotateCw, Sparkles } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { FOX_TRAIL_COPY } from './foxTrailCopy';
import {
  MIRROR_H, ROLL_RADIUS, ROLL_T, RUN_MAX, SEEDS, SEED_IDS, STEP_DT, STONE_X, STREAM, WAKE_T, WORLD_H, WORLD_W,
  canOffer, cameraFollow, carriedCount, clamp, inTunnel, inWater, initialFoxState, nearStone, step, surfaceAt, wakeRadius,
  type FoxInput, type FoxState, type SeedStatus, type WorldPhase,
} from './foxTrailRules';
import { FoxFigure, applyFoxPose, type FoxPartRefs } from './foxArt';
import { STRIDE, foxGait, tailTarget } from './foxGait';
import { burstMotes, createGrass, drawGrass, glowSprite, updateGrass, type GrassField, type GrassPalette, type Rgb } from './foxGrass';
import { FernsLayer, HillsLayer, LanternSeed, MirrorStone, OakFront, PARALLAX, SkyLayer, TRAIL_W, TrailLayer, TreesLayer, layerWidth } from './foxScenery';
import { createFoxSounds, type FoxSounds } from './foxTrailAudio';
import '../makerPalette.css';
import './foxTrail.css';

type Lang = 'en' | 'he';
type Words = (typeof FOX_TRAIL_COPY)[Lang];
type HintKey = 'hintStart' | 'hintGrass' | 'hintStream' | 'hintTunnel' | 'hintSeed' | 'hintStone' | 'hintReady' | 'hintWaking' | 'hintNight' | '';
const FOX_SCALE = 0.86;
/** The least trail (world units) a window shows across. */
const MIN_VIEW = 430;
const TAU = Math.PI * 2;

export default function FoxTrail() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = FOX_TRAIL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const [sitting, setSitting] = useState(0);
  const [hint, setHint] = useState('');
  return <GameShell fullBleed autoNarrate={false} worldId="fox-trail" title={w.title} instruction={w.instruction} hearIt={hint || w.instruction}>
    <section className="ft" data-adventure="fox-trail" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setHint(''); setSitting(n => n + 1); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <FoxTrailPlay key={sitting} w={w} onHint={setHint} onDone={() => setDone(true)} />}
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
    back: { dusk: [mix('--mk-moss', '--mk-plum', 62), mix('--mk-moss', '--mk-rust', 70), mix('--mk-amber', '--mk-moss', 38)], night: [mix('--mk-teal-deep', '--mk-indigo-deep', 55), mix('--mk-teal-deep', '--mk-indigo', 50), mix('--mk-celadon-deep', '--mk-slate', 55)] },
    front: { dusk: [mix('--mk-moss', '--mk-umber', 70), mix('--mk-leaf-deep', '--mk-moss', 55), mix('--mk-amber', '--mk-moss', 48)], night: [mix('--mk-teal-deep', '--mk-night', 60), mix('--mk-indigo-deep', '--mk-teal-deep', 50), mix('--mk-celadon', '--mk-teal-deep', 40)] },
    fore: { dusk: [mix('--mk-plum', '--mk-umber', 55), mix('--mk-rust', '--mk-plum', 28), mix('--mk-rust', '--mk-umber', 35)], night: [mix('--mk-night', '--mk-teal-deep', 70), mix('--mk-night', '--mk-indigo-deep', 50), mix('--mk-shadow', '--mk-teal-deep', 70)] },
    flower: { dusk: [rgb('var(--mk-amber)'), rgb('var(--mk-rose)'), rgb('var(--mk-butter)')], night: [mix('--mk-lilac', '--mk-indigo', 70), mix('--mk-bluebell', '--mk-indigo', 60), mix('--mk-snow-shade', '--mk-indigo', 70)] },
    moon: mix('--mk-snow', '--mk-sky-pale', 70), moonCore: rgb('var(--mk-butter)'), bud: mix('--mk-sage', '--mk-plum', 60),
    fluff: mix('--mk-butter', '--mk-white', 50), firefly: rgb('var(--mk-butter)'), sparkleDusk: rgb('var(--mk-sun)'), sparkleNight: rgb('var(--mk-snow)'),
    ring: mix('--mk-snow', '--mk-sky', 70), mote: rgb('var(--mk-sun)'),
  };
}

interface Held { left: Set<number>; right: Set<number>; keys: Set<string> }

function FoxTrailPlay({ w, onHint, onDone }: { w: Words; onHint: (text: string) => void; onDone: () => void }) {
  const [seeds, setSeeds] = useState<Record<string, SeedStatus>>(() => ({ ...initialFoxState().seeds }));
  const [phase, setPhase] = useState<WorldPhase>('dusk');
  const [offerable, setOfferable] = useState(false);
  const [near, setNear] = useState(false);
  const [hintKey, setHintKey] = useState<HintKey>('hintStart');
  const [suggestRoll, setSuggestRoll] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [doneReady, setDoneReady] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const moveRefs = useRef<{ el: HTMLElement; f: number }[]>([]);
  const nightRefs = useRef<HTMLDivElement[]>([]);
  const duskRefs = useRef<HTMLDivElement[]>([]);
  const backCanvas = useRef<HTMLCanvasElement>(null);
  const frontCanvas = useRef<HTMLCanvasElement>(null);
  const foxRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const popRef = useRef<SVGGElement>(null);
  const swooshRef = useRef<SVGGElement>(null);
  const parts = useRef<FoxPartRefs>({}).current;
  const state = useRef<FoxState>(initialFoxState());
  const held = useRef<Held>({ left: new Set(), right: new Set(), keys: new Set() });
  const edges = useRef<Pick<FoxInput, 'jump' | 'roll' | 'offer' | 'target'>>({});
  const sounds = useRef<FoxSounds | null>(null);
  const reduced = useRef(false);
  const size = useRef({ w: 0, h: 0, scale: 1, viewW: 800, dpr: 1, top: 0 });
  const ui = useRef({ seedAt: -10, blockedAt: -10, hum: -10 });
  const camRef = useRef(0);

  const reg = (f: number) => (el: HTMLElement | null) => { if (el && !moveRefs.current.some(m => m.el === el)) moveRefs.current.push({ el, f }); };
  const regNight = (el: HTMLDivElement | null) => { if (el && !nightRefs.current.includes(el)) nightRefs.current.push(el); };
  const regDusk = (el: HTMLDivElement | null) => { if (el && !duskRefs.current.includes(el)) duskRefs.current.push(el); };

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced.current = !!media?.matches;
    const change = () => { reduced.current = !!media?.matches; };
    media?.addEventListener?.('change', change);
    return () => media?.removeEventListener?.('change', change);
  }, []);

  // The one loop: fixed-step simulation, then everything drawn by hand (no React render per frame).
  useEffect(() => {
    const stage = stageRef.current, probe = probeRef.current;
    if (!stage || !probe) return;
    const fox = createFoxSounds(); sounds.current = fox;
    const palette = readPalette(probe);
    const glow = glowSprite(palette.firefly);
    const grass: GrassField = createGrass();
    const backCtx = backCanvas.current?.getContext('2d') ?? null, frontCtx = frontCanvas.current?.getContext('2d') ?? null;
    const anim = {
      cam: 0, snapped: false, acc: 0, last: 0, t: 0, lastVx: 0, accel: 0,
      tailA: -0.42, tailAV: 0, tailB: -0.2, tailBV: 0, sit: 0, facing: 1, spin: 0, tuck: 0, squash: 0,
      blink: 0, blinkAt: 2.5, flick: 0, flickAt: 3, earSide: 0 as 0 | 1, foot: 0, cricketAt: 0, nightShown: false,
      lastHint: '' as HintKey, lastOffer: false, lastNear: false, lastSuggest: false, lastPhase: 'dusk' as WorldPhase, doneAt: -1,
    };

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // A tall phone window would zoom in until the fox fills it: keep at least
      // MIN_VIEW of trail in view and let the sky run on above the wood instead.
      const scale = Math.min(rect.height / WORLD_H, rect.width / MIN_VIEW) || 1;
      const top = Math.max(0, rect.height - WORLD_H * scale);
      size.current = { w: rect.width, h: rect.height, scale, viewW: Math.min(WORLD_W, rect.width / scale), dpr, top };
      stage.style.setProperty('--ft-scale', String(scale));
      stage.style.setProperty('--ft-top', `${top.toFixed(1)}px`);
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

    const handleEvents = (s: FoxState) => {
      for (const ev of s.events) {
        if (ev === 'seed') {
          const id = SEED_IDS.find(k => s.seeds[k] === 'carried' && state.current.seeds[k] !== 'carried') ?? 'grass';
          fox.chime(carriedCount(s) - 1);
          burstMotes(grass, s.seedX[id], WORLD_H - surfaceAt(s.seedX[id]) - 18, 1, 16);
          ui.current.seedAt = s.t; void selectionHaptic();
        } else if (ev === 'shake') { fox.shake(); burstMotes(grass, SEEDS.grass.x, WORLD_H - surfaceAt(SEEDS.grass.x) - 40, 0, 10); }
        else if (ev === 'hum') { fox.hum(); ui.current.hum = s.t; setPulse(p => p + 1); }
        else if (ev === 'blocked') ui.current.blockedAt = s.t;
        else if (ev === 'wake') { fox.wake(); void selectionHaptic(); }
        else if (ev === 'hop' || ev === 'jump') fox.hop();
        else if (ev === 'land') { fox.land(false); anim.squash = 1; }
        else if (ev === 'splash') { fox.land(true); anim.squash = Math.max(anim.squash, 0.5); }
        else if (ev === 'roll') fox.roll();
      }
    };

    const syncUi = (s: FoxState) => {
      if (s.seeds.grass !== seedsRef.grass || s.seeds.stone !== seedsRef.stone || s.seeds.hollow !== seedsRef.hollow) { seedsRef = { ...s.seeds }; setSeeds(seedsRef); }
      if (s.phase !== anim.lastPhase) { anim.lastPhase = s.phase; setPhase(s.phase); if (s.phase === 'night') anim.doneAt = s.t + 1.2; }
      if (anim.doneAt > 0 && s.t >= anim.doneAt) { anim.doneAt = -1; setDoneReady(true); }
      const offer = canOffer(s); if (offer !== anim.lastOffer) { anim.lastOffer = offer; setOfferable(offer); }
      const nearNow = nearStone(s) && s.phase === 'dusk'; if (nearNow !== anim.lastNear) { anim.lastNear = nearNow; setNear(nearNow); }
      const blocked = s.t - ui.current.blockedAt < 4.5;
      const grassNear = s.seeds.grass === 'hidden' && Math.abs(s.x - SEEDS.grass.x) < 280;
      const suggest = s.phase === 'dusk' && (blocked || grassNear);
      if (suggest !== anim.lastSuggest) { anim.lastSuggest = suggest; setSuggestRoll(suggest); }
      let key: HintKey = '';
      if (s.phase === 'waking') key = 'hintWaking';
      else if (s.phase === 'night') key = 'hintNight';
      else if (s.t - ui.current.seedAt < 2.6) key = 'hintSeed';
      else if (blocked) key = 'hintTunnel';
      else if (nearStone(s)) key = carriedCount(s) === 3 ? 'hintReady' : 'hintStone';
      else if (grassNear) key = 'hintGrass';
      else if (s.seeds.stone === 'resting' && Math.abs(s.x - SEEDS.stone.x) < 420) key = 'hintStream';
      else if (s.dist < 160 && s.t < 12) key = 'hintStart';
      if (key !== anim.lastHint) { anim.lastHint = key; setHintKey(key); }
    };
    let seedsRef = { ...state.current.seeds };

    const render = (dt: number) => {
      const s = state.current, { scale, viewW, dpr, top } = size.current, rm = reduced.current;
      anim.t += dt;
      // camera
      anim.cam = cameraFollow(anim.cam, s.x, s.facing, viewW, dt, !anim.snapped); anim.snapped = true;
      const cam = anim.cam; camRef.current = cam;
      for (const m of moveRefs.current) {
        const f = rm && m.f < 0.9 ? 0 : m.f;
        m.el.style.transform = `translate3d(${(-cam * f * scale).toFixed(1)}px,0,0)`;
      }
      // the night: a ring of light from the mirror (a cross-fade with motion reduced)
      const mx = (STONE_X - cam) * scale, my = top + (WORLD_H - surfaceAt(STONE_X) - MIRROR_H) * scale;
      const radius = wakeRadius(s.phase, s.wake) * scale;
      const fade = s.phase === 'night' ? 1 : s.phase === 'waking' ? clamp(s.wake / (WAKE_T * 0.55), 0, 1) : 0;
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

      // the fox
      const speed = Math.abs(s.vx) / RUN_MAX;
      const accel = (s.vx - anim.lastVx) / Math.max(dt, 1e-3) * s.facing; anim.lastVx = s.vx;
      anim.accel += (accel - anim.accel) * Math.min(1, dt * 8);
      anim.facing += (s.facing - anim.facing) * Math.min(1, dt * (rm ? 30 : 16));
      const rollingNow = s.roll > 0;
      const r = 1 - s.roll / ROLL_T;
      const tuckGoal = rollingNow ? (inTunnel(s.x) ? 1 : r < 0.12 ? r / 0.12 : r > 0.84 ? (1 - r) / 0.16 : 1) : 0;
      anim.tuck += (tuckGoal - anim.tuck) * Math.min(1, dt * 22);
      if (rollingNow) anim.spin += Math.abs(s.vx) * dt / ROLL_RADIUS;
      else if (anim.spin > 0) { const goal = Math.ceil(anim.spin / TAU - 1e-3) * TAU; anim.spin = Math.min(goal, anim.spin + dt * 16); if (anim.spin >= goal - 1e-3) anim.spin = 0; }
      anim.sit += ((s.still > 3 && s.phase !== 'waking' ? 1 : 0) - anim.sit) * Math.min(1, dt * 3.2);
      if (s.phase === 'waking') anim.sit += (0.7 - anim.sit) * Math.min(1, dt * 2);
      anim.squash = Math.max(0, anim.squash - dt * 5);
      if (anim.t > anim.blinkAt) { anim.blink = 1; anim.blinkAt = anim.t + 2.4 + ((anim.t * 7.31) % 1) * 3; }
      anim.blink = Math.max(0, anim.blink - dt * 7);
      if (anim.t > anim.flickAt) { anim.flick = 1; anim.earSide = anim.earSide ? 0 : 1; anim.flickAt = anim.t + 2.8 + ((anim.t * 3.7) % 1) * 3.5; }
      anim.flick = Math.max(0, anim.flick - dt * 5);
      const air = !s.onGround;
      const [tA, tB] = tailTarget({ speed, air, vy: s.vy, sit: anim.sit, tuck: anim.tuck, t: anim.t, reduced: rm });
      // the tail follows with lag: a spring pulled by the body's own acceleration
      anim.tailAV += (60 * (tA - anim.tailA) - 8.5 * anim.tailAV - anim.accel * 0.00055 + (air ? -s.vy * 0.004 : 0)) * dt;
      anim.tailA += anim.tailAV * dt;
      anim.tailBV += (34 * (tB + (anim.tailA - tA) * 0.8 - anim.tailB) - 5.5 * anim.tailBV) * dt;
      anim.tailB += anim.tailBV * dt;
      const legPhase = s.dist / STRIDE * TAU;
      const pose = foxGait({
        phase: legPhase, speed: rollingNow ? 0 : speed, accel: anim.accel, air: air && !rollingNow, vy: s.vy, tuck: anim.tuck, spin: anim.spin, sit: anim.sit, t: anim.t,
        earFlick: anim.flick, earSide: anim.earSide, blink: anim.blink, squash: anim.squash, tailBase: anim.tailA, tailTip: anim.tailB, reduced: rm,
      });
      applyFoxPose(parts, pose);
      swooshRef.current?.setAttribute('opacity', (rm ? 0 : anim.tuck * clamp(Math.abs(s.vx) / 400, 0, 1) * 0.85).toFixed(2));
      const fy = WORLD_H - s.y;
      foxRef.current?.setAttribute('transform', `translate(${s.x.toFixed(1)} ${fy.toFixed(1)}) scale(${(anim.facing * FOX_SCALE).toFixed(3)} ${FOX_SCALE})`);
      const ground = surfaceAt(s.x), lift = clamp((s.y - ground) / 160, 0, 1);
      shadowRef.current?.setAttribute('transform', `translate(${s.x.toFixed(1)} ${(WORLD_H - ground + 2).toFixed(1)}) scale(${(1 - lift * 0.6).toFixed(3)} 1)`);
      shadowRef.current?.setAttribute('opacity', (0.42 * (1 - lift * 0.7)).toFixed(2));
      // the grass seed shaken loose: a little arc out of the tall grass
      if (popRef.current) {
        const p = s.seeds.grass === 'popping' ? clamp(s.pop / 0.7, 0, 1) : s.seeds.grass === 'hidden' ? 0 : 1;
        const px = SEEDS.grass.x + (s.seedX.grass - SEEDS.grass.x) * p;
        const py = WORLD_H - surfaceAt(px) - Math.sin(Math.PI * p) * 95 - (s.seeds.grass === 'hidden' ? 4 : 0);
        popRef.current.setAttribute('transform', `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
      }

      // footfalls on the run cycle; the grass swish and the stream follow the fox
      const foot = Math.floor(legPhase / Math.PI);
      if (foot !== anim.foot) { if (s.onGround && !rollingNow && speed > 0.05) fox.footfall(inWater(s.x, s.y), 0.4 + speed * 0.6); anim.foot = foot; }
      const frame = { t: anim.t, dt, cam, viewW, scale: scale * dpr, top: top * dpr, fox: { x: s.x, y: s.y, vx: s.vx, rolling: rollingNow, rollDir: s.rollDir }, reduced: rm, night: nightAt, wakeAge: s.phase === 'dusk' ? 0 : s.wake, isNight: s.phase === 'night' };
      const swish = updateGrass(grass, frame);
      const streamNear = 1 - clamp(Math.abs(s.x - (STREAM.from + STREAM.to) / 2) / 650, 0, 1);
      fox.beds(Math.min(1, swish * (0.4 + speed)), streamNear, s.phase === 'night');
      if (s.phase === 'night' && anim.t > anim.cricketAt) { fox.cricket(); anim.cricketAt = anim.t + 0.6 + ((anim.t * 5.13) % 1) * 1.6; }
      if (backCtx) drawGrass(backCtx, grass, frame, palette, 'back');
      if (frontCtx) {
        const ringA = s.phase === 'waking' && !rm ? clamp(1 - s.wake / WAKE_T, 0, 1) ** 0.6 : 0;
        drawGrass(frontCtx, grass, frame, palette, 'front', { glow, ring: { x: mx * dpr, y: my * dpr, r: radius * dpr, a: ringA } });
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
        const before = state.current;
        const next = step(before, input(), STEP_DT);
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

  /* ── input ── */
  const hold = (side: 'left' | 'right') => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      held.current[side].add(e.pointerId); edges.current.target = null;
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
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse' && e.button !== 0) return; edges.current[what] = true; },
    onClick: (e: ReactMouseEvent<HTMLButtonElement>) => { if (e.detail === 0) edges.current[what] = true; },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  });
  const tapTrail = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    edges.current.target = camRef.current + (e.clientX - rect.left) / size.current.scale;
  };
  const offer = () => { edges.current.offer = true; };

  const carried = SEED_IDS.filter(id => seeds[id] === 'carried').length;
  const awake = phase !== 'dusk';
  const toneNight = awake ? 'ft-tone--night' : 'ft-tone--dusk';
  const lw = (f: number) => ({ '--lw': layerWidth(f) } as CSSProperties);
  const backLayers = (tone: 'dusk' | 'night') => <>
    <SkyLayer tone={tone} />
    <div className="ft-move" ref={reg(PARALLAX.hills)} style={lw(PARALLAX.hills)}><HillsLayer /></div>
    <div className="ft-move" ref={reg(PARALLAX.trees)} style={lw(PARALLAX.trees)}><TreesLayer /></div>
    <div className="ft-move" ref={reg(PARALLAX.ferns)} style={lw(PARALLAX.ferns)}><FernsLayer /></div>
    <div className="ft-move" ref={reg(1)} style={{ '--lw': TRAIL_W } as CSSProperties}><TrailLayer /></div>
  </>;

  return <div className="ft-play" data-phase={phase}>
    <div className="ft-stage" ref={stageRef} role="group" aria-label={awake ? w.sceneNight : w.scene} onPointerDown={tapTrail}>
      <span ref={probeRef} className="ft-probe" aria-hidden="true" />
      <div className="ft-tone ft-tone--dusk ft-world" ref={regDusk} aria-hidden="true">{backLayers('dusk')}</div>
      <div className="ft-tone ft-tone--night ft-world ft-night" ref={regNight} aria-hidden="true" style={{ display: 'none' }}>{backLayers('night')}</div>
      <canvas className="ft-canvas" ref={backCanvas} aria-hidden="true" />
      <div className={`ft-tone ${toneNight} ft-move ft-objects`} ref={reg(1)} style={{ '--lw': WORLD_W } as CSSProperties} aria-hidden="true">
        <svg className="ft-layer-art" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="none" focusable="false">
          <MirrorStone awake={awake} near={near} />
          {SEED_IDS.filter(id => id !== 'grass').map(id => seeds[id] !== 'carried' && <g key={id} transform={`translate(${SEEDS[id].x} ${WORLD_H - surfaceAt(SEEDS[id].x)})`}><g className="ft-seed"><LanternSeed /></g></g>)}
          <g ref={popRef} transform={`translate(${SEEDS.grass.x} ${WORLD_H - surfaceAt(SEEDS.grass.x)})`}>
            {seeds.grass !== 'carried' && <g className="ft-seed" data-hidden={seeds.grass === 'hidden'}><LanternSeed hidden={seeds.grass === 'hidden'} /></g>}
          </g>
          <ellipse ref={shadowRef} rx="48" ry="7" className="ft-fox-shadow" />
          <g ref={foxRef} className="ft-fox" transform={`translate(${initialFoxState().x} ${WORLD_H - initialFoxState().y}) scale(${FOX_SCALE})`}>
            <g ref={swooshRef} className="ft-swoosh" opacity="0"><path d="M -50 -6 A 44 44 0 0 1 -26 -68" /><path d="M -62 -18 A 52 52 0 0 1 -44 -64" /></g>
            <FoxFigure refs={parts} carried={carried} night={awake} />
          </g>
        </svg>
      </div>
      <div className="ft-tone ft-tone--dusk ft-world ft-front" ref={regDusk} aria-hidden="true"><div className="ft-move" ref={reg(1)} style={{ '--lw': TRAIL_W } as CSSProperties}><OakFront /></div></div>
      <div className="ft-tone ft-tone--night ft-world ft-front ft-night" ref={regNight} aria-hidden="true" style={{ display: 'none' }}><div className="ft-move" ref={reg(1)} style={{ '--lw': TRAIL_W } as CSSProperties}><OakFront /></div></div>
      <canvas className="ft-canvas ft-canvas--front" ref={frontCanvas} aria-hidden="true" />

      <div className="ft-hud">
        <div className="ft-pips" role="img" aria-label={`${w.seeds}: ${SEED_IDS.map(id => seeds[id] === 'carried' ? w.seedFound : w.seedSleeping).join(', ')}`} data-pulse={pulse % 2} key={`pips${pulse}`}>
          {SEED_IDS.map(id => <span key={id} className="ft-pip" data-lit={seeds[id] === 'carried'} data-missing={near && seeds[id] !== 'carried'} />)}
        </div>
        {hintText && <p className="ft-hint" role="status">{hintText}</p>}
        {!hintText && <p className="ft-hint ft-hint--empty" role="status" />}
        {offerable && <button type="button" className="ft-cta" data-ft-offer="" onClick={offer}><Sparkles size={22} aria-hidden="true" />{w.offer}</button>}
        {phase === 'night' && doneReady && <button type="button" className="ft-cta" data-ft-done="" onClick={onDone}><Check size={22} aria-hidden="true" />{w.done}</button>}
      </div>
    </div>
    <div className="ft-deck" role="group" aria-label={w.controls}>
      <div className="ft-deck__pads" dir="ltr">
        <button type="button" className="ft-pad" data-ft-control="left" aria-label={w.left} {...hold('left')}><ArrowLeft size={30} aria-hidden="true" /></button>
        <button type="button" className="ft-pad" data-ft-control="right" aria-label={w.right} {...hold('right')}><ArrowRight size={30} aria-hidden="true" /></button>
      </div>
      <div className="ft-deck__acts">
        <button type="button" className="ft-act" data-ft-control="jump" aria-label={w.jump} {...press('jump')}><ChevronsUp size={26} aria-hidden="true" /><span>{w.jump}</span></button>
        <button type="button" className="ft-act" data-ft-control="roll" data-suggest={suggestRoll} aria-label={w.roll} {...press('roll')}><RotateCw size={26} aria-hidden="true" /><span>{w.roll}</span></button>
      </div>
    </div>
  </div>;
}

