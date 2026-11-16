import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Play, RotateCcw, RotateCw } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './windupRace.css';
import { TinCar, coilPath, gaugeAngle } from './windupCar';
import { ChalkMarks, Cushion, DOMINO_COLOURS, Domino, Flag, SceneDefs, ShelfLayer, StartLine, Table, TrackBack, TrackFloor, TunnelBack, TunnelFront, WallLayer, WoolBall, trackLine } from './windupRaceArt';
import { createRacerSound, type RacerSound } from './windupRaceAudio';
import { WINDUP_RACE_COPY } from './windupRaceCopy';
import { AXLE_HALF, CAR_HALF, MAX_CLICKS, TRACKS, TRACK_COUNT, WHEEL_R, addChalk, dragKey, nextTrack, pointAt, sampleAt, shapeOf, simulate, tension, wind, type RunResult, type Track } from './windupRaceRules';

/** wind → run → (flag → swap → wind of the next track) or (rest → return → wind). */
type Phase = 'wind' | 'run' | 'rest' | 'return' | 'flag' | 'swap' | 'done';
type Note = 'none' | 'nowind' | 'full';

/** The car sits at rest a moment, the chalk mark appears, then it rolls home. */
const REST_MS = 1700;
const RETURN_S = 0.9;
/** The flag flies and the bell rings this long before the next track. */
const FLAG_MS = 2100;
const SWAP_MS = 950;
const KEY_REST = 20;
const PARALLAX = { wall: 0.3, shelf: 0.62 } as const;
const DOMINO_GAP_S = 0.075, DOMINO_FALL_S = 0.18;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
const ease = (f: number) => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f));
const fillLine = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));

/** Where the car's centre is and how it leans: the midpoint of its two wheels. */
function carPose(track: Track, s: number) {
  const rear = pointAt(track, s - AXLE_HALF), front = pointAt(track, s + AXLE_HALF);
  return { x: (rear.x + front.x) / 2, y: -(rear.y + front.y) / 2, lean: Math.atan2(front.y - rear.y, front.x - rear.x) };
}

export default function WindupRace() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = WINDUP_RACE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const [trackIndex, setTrackIndex] = useState(0);
  const track = TRACKS[trackIndex];
  const [phase, setPhaseState] = useState<Phase>('wind');
  const [clicks, setClicksState] = useState(0);
  const [marks, setMarks] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<'none' | 'short' | 'back'>('none');
  const [note, setNote] = useState<Note>('none');
  const [flagUp, setFlagUp] = useState(false);
  const [finished, setFinished] = useState(0);
  const [size, setSize] = useState({ w: 360, h: 460 });

  const phaseRef = useRef<Phase>('wind'), clicksRef = useRef(0), turnRef = useRef(0), trackRef = useRef(track), trackIndexRef = useRef(0);
  trackRef.current = track;
  const sizeRef = useRef(size); sizeRef.current = size;
  const runRef = useRef<RunResult | null>(null), clockRef = useRef(0), eventRef = useRef(0), clackRef = useRef(0);
  const returnRef = useRef({ from: 0, t: 0 });
  const keyShown = useRef(KEY_REST), dragging = useRef(false);
  const camK = useRef(0), flagK = useRef(0), page = useRef<{ fx: number; fy: number } | null>(null);
  const rock = useRef({ at: -10, amp: 0 }), shiver = useRef(-10), time = useRef(0);
  const coilLevel = useRef(-1);
  const raf = useRef(0), last = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sound = useRef<RacerSound | null>(null);
  const reduced = useRef(reducedMotion());

  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<SVGGElement>(null), wall = useRef<SVGGElement>(null), shelf = useRef<SVGGElement>(null);
  const car = useRef<SVGGElement>(null), body = useRef<SVGGElement>(null), rear = useRef<SVGGElement>(null), front = useRef<SVGGElement>(null);
  const key = useRef<SVGGElement>(null), coil = useRef<SVGGElement>(null), coilD = useRef<SVGPathElement>(null), needle = useRef<SVGGElement>(null);
  const ball = useRef<SVGGElement>(null), ballSpin = useRef<SVGGElement>(null), squash = useRef<SVGGElement>(null);
  const dominoes = useRef<(SVGGElement | null)[]>([]);
  const keyHit = useRef<HTMLButtonElement>(null), mapCar = useRef<SVGCircleElement>(null);

  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); kick(); };
  const setClicks = (next: number) => { clicksRef.current = next; setClicksState(next); };
  const later = (ms: number, run: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); run(); }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => { for (const id of timers.current) clearTimeout(id); timers.current = []; };
  const bump = (amp: number) => { rock.current = { at: time.current, amp }; kick(); };

  /* ---------- the picture, every frame, straight from the refs ---------- */

  const paint = () => {
    const t = trackRef.current, { w: W, h: H } = sizeRef.current, ph = phaseRef.current, run = runRef.current;
    let s = t.start, turns = clicksRef.current + turnRef.current, ballAt = t.ball, clock = -1;
    if (run && (ph === 'run' || ph === 'rest' || ph === 'flag' || ph === 'swap')) {
      clock = clockRef.current;
      const sample = sampleAt(run, clock); s = sample.s; turns = sample.turns; ballAt = sample.ball;
    } else if (ph === 'return') {
      s = lerp(returnRef.current.from, t.start, ease(returnRef.current.t / RETURN_S)); turns = 0;
    }
    const pose = carPose(t, s);
    const reduce = reduced.current;

    // Camera: close on the car while winding, pulled back to follow the run.
    const z0 = Math.max(0.55, Math.min(1.5, Math.min(H / 430, W / 400)));
    const zw = Math.max(z0 * 1.3, Math.min(z0 * 2.4, W * 0.66 / 124, H * 0.5 / 96));
    const k = ease(camK.current);
    let fx = lerp(pose.x - 4, pose.x, k), fy = lerp(pose.y - 30, pose.y * 0.4, k);
    let sx = lerp(W * 0.5, W * 0.36, k), sy = lerp(H * 0.6, H * 0.7, k);
    let z = lerp(zw, z0, k);
    // At the flag the camera frames the flag and the car together.
    const fk = ease(flagK.current);
    if (fk > 0) {
      const flagAt = pointAt(t, t.flag), mid = (flagAt.x + pose.x) / 2, span = Math.abs(flagAt.x - pose.x) + 240;
      const zf = Math.min(z0, W * 0.9 / span);
      fx = lerp(fx, mid, fk); fy = lerp(fy, Math.min(pose.y, -flagAt.y) * 0.4, fk); sx = lerp(sx, W * 0.5, fk); z = lerp(z, zf, fk);
    }
    if (reduce && k >= 1 && fk === 0) {
      // With motion reduced the camera does not glide: it cuts a page on when the car nears the edge.
      const p = page.current, screenX = p ? (pose.x - p.fx) * z + W * 0.36 : -1;
      if (!p || screenX > W * 0.84 || screenX < W * 0.1) page.current = { fx: pose.x + (W * 0.36 - W * 0.22) / z, fy: pose.y * 0.4 };
      fx = page.current!.fx; fy = page.current!.fy; sx = W * 0.36; sy = H * 0.7;
    }
    const ox = sx - fx * z, oy = sy - fy * z;
    world.current?.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${z.toFixed(4)})`);
    const centre = (W / 2 - ox) / z;
    for (const [layer, depth] of [[wall, PARALLAX.wall], [shelf, PARALLAX.shelf]] as const) {
      const shift = reduce ? 0 : centre * (1 - depth) * z;
      layer.current?.setAttribute('transform', `translate(${(ox + shift).toFixed(2)} ${oy.toFixed(2)}) scale(${z.toFixed(4)})`);
    }

    // The car: position, lean, a rock on bumps, wheels by distance, the key by spring.
    const leanDeg = -pose.lean * 180 / Math.PI;
    car.current?.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${leanDeg.toFixed(2)})`);
    const since = time.current - rock.current.at, shake = time.current - shiver.current;
    let tilt = reduce || since > 1.4 ? 0 : rock.current.amp * Math.exp(-5 * since) * Math.sin(since * 22);
    if (!reduce && shake < 0.45) tilt += 1.6 * Math.sin(shake * 60) * (1 - shake / 0.45);
    body.current?.setAttribute('transform', `rotate(${tilt.toFixed(2)} -30 -13)`);
    const spin = (s / WHEEL_R) * 180 / Math.PI;
    rear.current?.setAttribute('transform', `rotate(${spin.toFixed(1)})`);
    front.current?.setAttribute('transform', `rotate(${spin.toFixed(1)})`);
    // A tight spring fights the finger: the key trembles a little as it is turned.
    const strain = !reduce && dragging.current && clicksRef.current > 5 ? Math.sin(time.current * 90) * (clicksRef.current - 5) * 0.35 : 0;
    const keyAngle = ph === 'wind' ? keyShown.current + strain : KEY_REST + turns * 360;
    key.current?.setAttribute('transform', `rotate(${keyAngle.toFixed(1)})`);
    const tight = Math.max(0, Math.min(1, turns / MAX_CLICKS)), level = Math.round(tight * 36);
    if (level !== coilLevel.current) { coilLevel.current = level; coilD.current?.setAttribute('d', coilPath(level / 36)); }
    coil.current?.setAttribute('transform', `rotate(${(keyAngle * 0.5).toFixed(1)})`);
    needle.current?.setAttribute('transform', `rotate(${gaugeAngle(turns).toFixed(1)})`);

    // The key's touch target follows the key on screen.
    const hit = keyHit.current;
    if (hit) {
      const c = Math.cos(-pose.lean), sn = Math.sin(-pose.lean), lx = -33, ly = -33;
      const hx = (pose.x + lx * c - ly * sn) * z + ox, hy = (pose.y + lx * sn + ly * c) * z + oy;
      const r = Math.max(40, 34 * z);
      hit.style.inlineSize = hit.style.blockSize = `${(r * 2).toFixed(0)}px`;
      hit.style.transform = `translate(${(hx - r).toFixed(1)}px, ${(hy - r).toFixed(1)}px)`;
    }

    // Things on the track that move: the wool ball, the dominoes, the cushion.
    if (t.ball !== null && ballAt !== null && ball.current) {
      const rolled = Math.max(0, ballAt - t.ball), off = Math.min(1, rolled / 240);
      const p = pointAt(t, ballAt);
      ball.current.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y - 18 * off).toFixed(1)}) scale(${(1 - 0.16 * off).toFixed(3)})`);
      ballSpin.current?.setAttribute('transform', `rotate(${(rolled / 20 * 180 / Math.PI).toFixed(1)})`);
    }
    const at = run?.dominoesAt ?? null;
    t.dominoes.forEach((d, i) => {
      const node = dominoes.current[i]; if (!node) return;
      const start = at === null || clock < 0 ? Infinity : at + i * DOMINO_GAP_S;
      const f = clock < start ? 0 : reduce ? 1 : Math.min(1, ((clock - start) / DOMINO_FALL_S) ** 2);
      const p = pointAt(t, d);
      node.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y - 14).toFixed(1)}) rotate(${(f * (i === t.dominoes.length - 1 ? 84 : 40)).toFixed(1)})`);
    });
    if (squash.current) {
      const depth = Math.max(0, s + CAR_HALF - t.cushion), sq = Math.max(0.55, 1 - depth / 80);
      squash.current.setAttribute('transform', `translate(90 0) scale(${sq.toFixed(3)} ${(1 + (1 - sq) * 0.25).toFixed(3)}) translate(-90 0)`);
    }
    if (mapCar.current) mapCar.current.setAttribute('cx', (s + CAR_HALF * 0.4).toFixed(1));
  };

  /* ---------- the clock ---------- */

  const finishRun = () => {
    const run = runRef.current; if (!run) return;
    sound.current?.whirr(0, 0);
    if (run.finished) {
      setPhase('flag'); setFinished(count => Math.max(count, trackIndexRef.current + 1));
      later(FLAG_MS, () => {
        const next = nextTrack(trackIndexRef.current);
        if (next === null) { setPhase('done'); return; }
        setPhase('swap');
        later(SWAP_MS * 0.48, () => {
          trackIndexRef.current = next; setTrackIndex(next); runRef.current = null; clockRef.current = 0; page.current = null;
          setMarks([]); setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; camK.current = 0; flagK.current = 0; setFlagUp(false); setOutcome('none'); setNote('none');
        });
        later(SWAP_MS, () => setPhase('wind'));
      });
      return;
    }
    setMarks(current => addChalk(current, run.reach));
    setOutcome(run.events.some(event => event.kind === 'turnback') ? 'back' : 'short');
    setPhase('rest');
    later(REST_MS, startReturn);
  };
  const startReturn = () => {
    if (phaseRef.current !== 'rest') return;
    clearTimers();
    const run = runRef.current;
    returnRef.current = { from: run ? run.stop : trackRef.current.start, t: reduced.current ? RETURN_S : 0 };
    runRef.current = null; clockRef.current = 0;
    setPhase('return');
  };
  const endReturn = () => {
    setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; page.current = null;
    setPhase('wind');
  };
  const advance = (dt: number) => {
    time.current += dt;
    const ph = phaseRef.current, run = runRef.current;
    const wantK = ph === 'swap' ? camK.current : ph === 'run' || ph === 'rest' || ph === 'flag' || ph === 'return' ? 1 : 0;
    if (reduced.current) camK.current = wantK;
    else camK.current = wantK > camK.current ? Math.min(1, camK.current + dt / 0.75) : Math.max(0, camK.current - dt / 0.6);
    const wantF = ph === 'flag' || (ph === 'swap' && flagK.current > 0) ? 1 : 0;
    flagK.current = reduced.current ? wantF : wantF > flagK.current ? Math.min(1, flagK.current + dt / 0.8) : Math.max(0, flagK.current - dt / 0.4);
    if (ph === 'wind' && !dragging.current) {
      const target = KEY_REST + (clicksRef.current + turnRef.current) * 360;
      keyShown.current = reduced.current ? target : lerp(keyShown.current, target, Math.min(1, dt * 14));
      if (Math.abs(keyShown.current - target) < 0.3) keyShown.current = target;
    }
    if (ph === 'return') {
      returnRef.current.t += dt;
      if (returnRef.current.t >= RETURN_S) endReturn();
    }
    if (ph === 'run' && run) {
      clockRef.current += dt;
      const clock = clockRef.current;
      while (eventRef.current < run.events.length && run.events[eventRef.current].t <= clock) {
        const event = run.events[eventRef.current++];
        if (event.kind === 'bump') { sound.current?.knock(); bump(4); }
        else if (event.kind === 'ball') { sound.current?.thump(); bump(2.5); }
        else if (event.kind === 'tunnel') sound.current?.knock(0.35);
        else if (event.kind === 'dominoes') bump(2);
        else if (event.kind === 'flag') { sound.current?.bell(); setFlagUp(true); }
        else if (event.kind === 'cushion') { sound.current?.thump(); bump(3); }
        else if (event.kind === 'stop') { sound.current?.knock(0.5); bump(2.2); }
      }
      if (run.dominoesAt !== null) {
        const t = trackRef.current;
        while (clackRef.current < t.dominoes.length && clock >= run.dominoesAt + clackRef.current * DOMINO_GAP_S + DOMINO_FALL_S) sound.current?.clack(clackRef.current++);
      }
      const sample = sampleAt(run, clock);
      sound.current?.whirr(Math.abs(sample.v) / 780, sample.turns / MAX_CLICKS);
      if (clock >= run.duration + 0.05) finishRun();
    }
  };
  const busy = () => {
    const ph = phaseRef.current;
    if (ph === 'run' || ph === 'return' || (dragging.current && clicksRef.current > 5)) return true;
    const wantK = ph === 'swap' ? camK.current : ph === 'wind' ? 0 : 1;
    if (Math.abs(camK.current - wantK) > 0.0001) return true;
    if (flagK.current > 0 && flagK.current < 1 && ph === 'flag') return true;
    if (ph === 'wind' && Math.abs(keyShown.current - (KEY_REST + (clicksRef.current + turnRef.current) * 360)) > 0.01) return true;
    return time.current - rock.current.at < 1.4 || time.current - shiver.current < 0.5;
  };
  const frame = (now: number) => {
    raf.current = 0;
    const dt = last.current ? Math.min(0.05, Math.max(0, (now - last.current) / 1000)) : 1 / 60;
    last.current = now;
    advance(dt); paint();
    if (busy() && document.visibilityState !== 'hidden') raf.current = requestAnimationFrame(frame);
    else last.current = 0;
  };
  const frameRef = useRef(frame); frameRef.current = frame;
  const kick = () => { if (!raf.current && typeof requestAnimationFrame === 'function') raf.current = requestAnimationFrame(now => frameRef.current(now)); };

  useEffect(() => {
    const instance = createRacerSound(); sound.current = instance;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () => { reduced.current = !!media?.matches; kick(); };
    media?.addEventListener?.('change', motion);
    const visible = () => { if (document.visibilityState === 'hidden') { instance.quiet(); } else { last.current = 0; kick(); } };
    document.addEventListener('visibilitychange', visible);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0;
      for (const id of timers.current) clearTimeout(id); timers.current = [];
      media?.removeEventListener?.('change', motion);
      document.removeEventListener('visibilitychange', visible);
      instance.dispose(); sound.current = null;
    };
  }, []);
  useEffect(() => { if (muted) sound.current?.quiet(); }, [muted]);

  useLayoutEffect(() => {
    const node = stage.current; if (!node) return;
    const measure = () => { const r = node.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize(prev => (Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height })); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Repaint whenever React has redrawn the scene (size, track, marks, phase).
  useLayoutEffect(() => { paint(); kick(); });

  /* ---------- the child's actions ---------- */

  const windOnce = () => {
    if (phaseRef.current !== 'wind') return;
    if (clicksRef.current >= MAX_CLICKS) { sound.current?.stop(); shiver.current = time.current; setNote('full'); kick(); return; }
    const next = wind(clicksRef.current);
    turnRef.current = 0; setClicks(next); setNote(next >= MAX_CLICKS ? 'full' : 'none'); setOutcome('none');
    sound.current?.tick(next / MAX_CLICKS); void selectionHaptic(); kick();
  };
  const go = () => {
    if (phaseRef.current !== 'wind') return;
    if (clicksRef.current === 0) { shiver.current = time.current; setNote('nowind'); sound.current?.knock(0.4); kick(); return; }
    clearTimers();
    runRef.current = simulate(trackRef.current, clicksRef.current);
    clockRef.current = 0; eventRef.current = 0; clackRef.current = 0; turnRef.current = 0; page.current = null;
    setNote('none'); setOutcome('none'); setFlagUp(false);
    void selectionHaptic();
    setPhase('run');
  };
  /** Back to start: everything as it was before Go, the spring still wound. */
  const reset = () => {
    const ph = phaseRef.current;
    if (ph === 'rest') { startReturn(); return; }
    if (ph !== 'run') return;
    const run = runRef.current;
    clearTimers(); sound.current?.whirr(0, 0);
    runRef.current = null; clockRef.current = 0; eventRef.current = 0; clackRef.current = 0; page.current = null;
    const wound = run ? Math.round(run.samples[0].turns) : 0;
    setClicks(wound); turnRef.current = 0; keyShown.current = KEY_REST + wound * 360;
    setFlagUp(false); setOutcome('none'); setNote('none');
    setPhase('wind');
  };

  // Turning the key by dragging round its hub. A short touch without a turn is one click.
  const drag = useRef<{ id: number; cx: number; cy: number; angle: number; moved: number; at: number } | null>(null);
  const keyDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'wind') return;
    const r = event.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    drag.current = { id: event.pointerId, cx, cy, angle: Math.atan2(event.clientY - cy, event.clientX - cx), moved: 0, at: performance.now() };
    dragging.current = true;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* capture is a nicety */ }
  };
  const keyMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.id !== event.pointerId || phaseRef.current !== 'wind') return;
    const angle = Math.atan2(event.clientY - d.cy, event.clientX - d.cx);
    if (Math.hypot(event.clientX - d.cx, event.clientY - d.cy) < 6) return;
    let delta = angle - d.angle;
    if (delta > Math.PI) delta -= Math.PI * 2; else if (delta < -Math.PI) delta += Math.PI * 2;
    d.angle = angle; d.moved += Math.abs(delta);
    if (delta <= 0) return; // the ratchet holds a backwards turn
    if (clicksRef.current >= MAX_CLICKS) {
      if (time.current - shiver.current > 0.6) { shiver.current = time.current; sound.current?.stop(); setNote('full'); kick(); }
      return;
    }
    const result = dragKey(clicksRef.current, turnRef.current, delta / (Math.PI * 2));
    turnRef.current = result.turn;
    if (result.made > 0) {
      for (let i = 0; i < result.made; i++) sound.current?.tick((clicksRef.current + i + 1) / MAX_CLICKS);
      setClicks(result.clicks); setNote(result.clicks >= MAX_CLICKS ? 'full' : 'none'); setOutcome('none'); void selectionHaptic();
    }
    keyShown.current = KEY_REST + (clicksRef.current + turnRef.current) * 360;
    kick();
  };
  const keyUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current; if (!d || d.id !== event.pointerId) return;
    drag.current = null; dragging.current = false;
    if (d.moved < 0.6 && performance.now() - d.at < 500) windOnce();
    // Let go mid-turn: the ratchet holds the clicks made, the part-turn springs back.
    turnRef.current = 0; kick();
  };

  // Keyboard: Space winds, Enter lets go (when no other control has focus).
  const keysRef = useRef({ windOnce, go }); keysRef.current = { windOnce, go };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('button, a, input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); keysRef.current.windOnce(); }
      else if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); keysRef.current.go(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- words ---------- */

  const windCue = note === 'nowind' ? w.noWind : note === 'full' || clicks >= MAX_CLICKS ? w.full : outcome !== 'none' ? w.again : clicks > 0 ? w.windMore : w.wind;
  const cue = phase === 'wind' ? windCue : phase === 'run' ? w.running : phase === 'rest' ? (outcome === 'back' ? w.rolledBack : w.stopped)
    : phase === 'return' ? w.again : phase === 'flag' ? w.flag : phase === 'swap' ? w.nextTrack : w.finish;
  const line = w.trackLines[trackIndex];
  const total = shapeOf(track).total;
  const flagPoint = pointAt(track, track.flag), cushionPoint = pointAt(track, track.cushion);
  const width = total + 1800;
  const running = phase === 'run' || phase === 'rest';
  const sceneKey = `${trackIndex}`;
  const setDomino = useCallback((i: number) => (node: SVGGElement | null) => { dominoes.current[i] = node; }, []);

  /** Outside the Studio (which remounts the game instead), Play again starts at track one. */
  const restart = () => {
    clearTimers(); sound.current?.quiet();
    trackIndexRef.current = 0; setTrackIndex(0); runRef.current = null; clockRef.current = 0; page.current = null; camK.current = 0; flagK.current = 0;
    setMarks([]); setClicks(0); turnRef.current = 0; keyShown.current = KEY_REST; setFlagUp(false); setOutcome('none'); setNote('none'); setFinished(0);
    setPhase('wind');
  };

  if (phase === 'done') {
    return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction}>
      <section className="adventure wr" data-adventure="windup-race" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={restart} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction} hearIt={`${cue} ${w.instruction}`}>
    <section className="adventure wr" data-adventure="windup-race" data-phase={phase} data-track={track.id} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="wr-top">
        <ol className="wr-flags" aria-label={fillLine(w.progress, trackIndex + 1, TRACK_COUNT)}>
          {TRACKS.map((item, i) => <li key={item.id} className="wr-flags__pip" data-done={i < finished} data-now={i === trackIndex} aria-hidden="true">
            <svg viewBox="0 0 24 28" aria-hidden="true" focusable="false"><rect x="3" y="2" width="2.4" height="25" rx="1.2" className="wr-flags__pole" /><path d="M5.4 3L22 8.5L5.4 14Z" className="wr-flags__cloth" /></svg>
          </li>)}
        </ol>
        <p className="wr-top__track"><strong>{w.tracks[trackIndex]}</strong><span>{line}</span></p>
      </div>
      <p className="wr-cue" aria-live="polite">{cue}</p>
      {/* The scene reads left to right in both languages: physics and track are never mirrored. */}
      <div className="wr-stage" ref={stage} data-swap={phase === 'swap'} data-flag={flagUp} dir="ltr">
        <div className="wr-scene">
        <svg className="wr-svg" key={sceneKey} viewBox={`0 0 ${size.w.toFixed(0)} ${size.h.toFixed(0)}`} width="100%" height="100%" role="img" aria-label={w.scene}>
          <SceneDefs id="wr-" />
          <g ref={wall}><WallLayer width={width} id="wr-" /></g>
          <g ref={shelf}><ShelfLayer width={width} /></g>
          <g ref={world}>
            <Table from={-900} to={total + 900} id="wr-" />
            <TrackBack track={track} />
            {track.tunnel && <TunnelBack from={pointAt(track, track.tunnel[0]).x} to={pointAt(track, track.tunnel[1]).x} />}
            {track.dominoes.map((_, i) => <Domino key={i} colour={DOMINO_COLOURS[i % DOMINO_COLOURS.length]} dominoRef={setDomino(i)} />)}
            <StartLine track={track} />
            <Flag x={flagPoint.x} y={-flagPoint.y + 2} flying={flagUp} />
            <TrackFloor track={track} />
            <ChalkMarks track={track} marks={marks} />
            {track.ball !== null && <WoolBall ballRef={ball} spinRef={ballSpin} />}
            <g ref={car}><TinCar parts={{ body, rear, front, key, coil, coilPath: coilD, needle }} /></g>
            {track.tunnel && <TunnelFront from={pointAt(track, track.tunnel[0]).x} to={pointAt(track, track.tunnel[1]).x} />}
            <Cushion x={cushionPoint.x} y={-cushionPoint.y} squashRef={squash} />
          </g>
        </svg>
        <svg className="wr-map" viewBox={`-40 -150 ${track.cushion + 180} 175`} role="img" aria-label={w.map} key={`map${sceneKey}`} style={{ aspectRatio: `${track.cushion + 180} / 175` }}>
          <path d={trackLine(track)} className="wr-map__line" vectorEffect="non-scaling-stroke" />
          {marks.map((m, i) => <rect key={`${i}:${m}`} x={m - 5} y={-pointAt(track, m).y - 40} width="10" height="44" className="wr-map__chalk" data-fresh={i === marks.length - 1} />)}
          <path d={`M${track.flag} ${-flagPoint.y}V${-flagPoint.y - 120}l60 25l-60 25`} className="wr-map__flag" vectorEffect="non-scaling-stroke" />
          <circle ref={mapCar} cx={track.start} cy={-12} r="34" className="wr-map__car" />
        </svg>
        </div>
        <button type="button" ref={keyHit} className="wr-key" data-wr-key="" hidden={phase !== 'wind'}
          aria-label={fillLine(w.key, w.tension[tension(clicks)])} aria-describedby="wr-keys"
          onPointerDown={keyDown} onPointerMove={keyMove} onPointerUp={keyUp} onPointerCancel={keyUp}
          onClick={event => { if (event.detail === 0) windOnce(); }} />
      </div>
      <p id="wr-keys" className="wr-sr">{w.keys}</p>
      {muted && <p className="adventure-quiet wr-quiet">{w.quiet}</p>}
      <div className="wr-controls">
        {running
          ? <button type="button" className="wr-button" data-wr-control="reset" onClick={reset}><RotateCcw size={22} aria-hidden="true" />{w.reset}</button>
          : <>
            <button type="button" className="wr-button wr-button--wind" data-wr-control="wind" disabled={phase !== 'wind'} data-full={clicks >= MAX_CLICKS} onClick={windOnce}><RotateCw size={22} aria-hidden="true" />{w.windButton}</button>
            <button type="button" className="wr-button wr-button--go" data-wr-control="go" disabled={phase !== 'wind'} data-ready={phase === 'wind' && clicks > 0} onClick={go}><Play size={22} aria-hidden="true" />{w.go}</button>
          </>}
      </div>
    </section>
  </GameShell>;
}
