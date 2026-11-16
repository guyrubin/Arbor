import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AudioWaveform, Check, Cog, Eye, EyeOff, Flower2, Hand, Pause, Play, Rabbit, RotateCw, Snail, Tag, Turtle } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { CRANK_WORKS_COPY } from './crankWorksCopy';
import {
  CALM_PUSH, FEED, HAND_TURN_GOAL, KEY_STEP, MACHINES, MACHINE_PARTS, REST_TURN, SPEEDS, SPEED_OMEGA, TAU, TRACE_BINS,
  angleDelta, badgesOf, canFinish, canSelect, carrySelection, cueFor, detentSteps, easeMotor, follow, loadTurn, lookedInside, metPart, pointerAngle,
  push, releaseSpeed, sawMachine, startOn, strokePlace, sweepBins, swing, topCentresCrossed, turnedByHand, wrapAngle, writeInk,
  type Explore, type Ink, type MachineId, type PartId, type Speed, type TurnSample,
} from './crankWorksRules';
import { CrankDefs, EngineArt, GRAB, INKS, SHAFT, STAGE_BOX, ToyArt, VIEW_H, VIEW_W, WaveGlass, WriterArt, moverOf, poseOf, tagFor } from './crankArt';
import { AnchorCheck, Companion, GhostHand, Insight, PartTags, Sparks, Traces, WaveLine, handSpot, type Spark } from './crankFx';
import { KIT_STAGE } from './crankKit';
import { createCrankSound, type CrankSound } from './crankAudio';
import '../makerPalette.css';
import './crankWorks.css';

type Lang = 'en' | 'he';
type Words = (typeof CRANK_WORKS_COPY)[Lang];
type Voice = 'hand' | 'motor' | 'guide' | 'quiet';
/** The frost wipes off or back in this long. */
const WIPE_S = 0.6;
/** The showing hand turns the wheel this far, then lets it swing back. */
const DEMO_TURN = 1.35;
/** How long each short effect lasts (seconds); an age past its end is at rest. */
const REST = 99;
const AGE_END = { bounce: 0.6, peek: 2.6, hop: 0.7, cheer: 1.5, insight: 6.2, arrive: 0.36, tool: 0.9, pod: 0.7 } as const;
type Ages = Record<keyof typeof AGE_END, number>;
/** Where AnchorCheck lies when no part is chosen: by the bench's trays. */
const TOOL_DOCK = { x: 26, y: 448 } as const;
/** The bench's own PulsePod (amber pause, cyan ready), in the stage picture. */
const POD = { x: 108, y: 424 } as const;
/** Each visit opens a little differently; kept only while the app is open. */
let visits = 0;

export default function CrankWorks() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = CRANK_WORKS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const [visit] = useState(() => visits++);
  return <GameShell fullBleed autoNarrate={false} worldId="crank-works" title={w.title} instruction={w.instruction}>
    <section className="adventure ck" data-adventure="crank-works" dir={lang === 'he' ? 'rtl' : 'ltr'} data-done={done}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setRun(n => n + 1); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <Bench key={run} lang={lang} w={w} visit={visit + run} onDone={() => setDone(true)} />}
    </section>
  </GameShell>;
}

function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, []);
  return reduced;
}

interface Grab { id: number; x0: number; y0: number; angle: number; inWheel: boolean; active: boolean; target: Element | null }
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = clamp01(n); return p * p * (3 - 2 * p); };

function Bench({ lang, w, visit, onDone }: { lang: Lang; w: Words; visit: number; onDone: () => void }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const first = MACHINES[visit % MACHINES.length];
  const [machine, setMachine] = useState<MachineId>(first);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [playing, setPlayingState] = useState(false);
  const [speed, setSpeedState] = useState<Speed>('slow');
  const [explore, setExplore] = useState<Explore>(() => startOn(first));
  const [wheelFocus, setWheelFocus] = useState(false);
  const [focusPart, setFocusPart] = useState<PartId | null>(null);
  const [nudge, setNudge] = useState(false);
  const [aha, setAha] = useState(false);
  const [chain, setChain] = useState<PartId | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [ink, setInkState] = useState(visit % INKS.length);
  const [finale, setFinale] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [, setFrame] = useState(0);

  const bench = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLImageElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const theta = useRef(Math.PI - 0.9 - (visit % 3) * 0.5);
  const omega = useRef(0);            // the wheel's own spin, in a hand or let go
  const motor = useRef(0);            // the motor's present speed
  const calm = useRef(0);             // reduced motion: what is left of a gentle push
  const guide = useRef(0);            // what is left of a shown turn (the encore)
  const target = useRef(0);           // where the finger is asking the wheel to be
  const loose = useRef(true);         // let go: the load may swing it
  const looseHand = useRef(false);    // ... and that swing is still the hand's doing
  const openP = useRef(0);
  const ages = useRef<Ages>({ bounce: REST, peek: REST, hop: REST, cheer: REST, insight: REST, arrive: REST, tool: REST, pod: REST });
  const encore = useRef(true);
  const demo = useRef<{ t: number; from: number } | null>(null);
  const finaleT = useRef(-1);
  const sparks = useRef<Spark[]>([]);
  const tool = useRef<{ x: number; y: number }>({ x: TOOL_DOCK.x, y: TOOL_DOCK.y });
  const grab = useRef<Grab | null>(null);
  const samples = useRef<TurnSample[]>([]);
  const hand = useRef(0);
  const bins = useRef<boolean[]>(Array<boolean>(TRACE_BINS).fill(false));
  const span = useRef<[number, number] | null>(null);
  const marks = useRef<Ink[]>([]);
  const raf = useRef(0), last = useRef(0), buzzed = useRef(0);
  const sound = useRef<CrankSound | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone); done.current = onDone;
  // Live copies for the frame loop.
  const live = useRef({ playing, speed, open, machine, selected, reduced, ink, finale, hinted });
  live.current = { playing, speed, open, machine, selected, reduced, ink, finale, hinted };

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t); return t;
  }, []);
  const buzz = useCallback((gap = 0) => {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - buzzed.current < gap) return;
    buzzed.current = now; void selectionHaptic();
  }, []);
  const setPlaying = (next: boolean) => { live.current.playing = next; setPlayingState(next); };
  const targetSpeed = () => SPEED_OMEGA[live.current.reduced ? 'slow' : live.current.speed];
  const cheer = useCallback(() => { ages.current.hop = 0; ages.current.cheer = 0; }, []);
  const earn = useCallback((badge: string) => {
    setPop(badge); later(() => setPop(p => (p === badge ? null : p)), 900);
    sound.current?.chime('earned'); cheer();
  }, [cheer, later]);

  /** Every change of angle comes through here: the tick at the top and the
   * tock at the bottom, the wheel's soft stops, the traces, the writer's line
   * and the hand's share of the turning. */
  const moved = useCallback((from: number, to: number, voice: Voice) => {
    if (from === to) return;
    const L = live.current, byHand = voice === 'hand', quiet = voice === 'quiet';
    const pace = Math.min(1, Math.abs(voice === 'motor' ? motor.current : omega.current) / SPEED_OMEGA.quick);
    if (topCentresCrossed(from, to) > 0) {
      ages.current.bounce = 0;
      if (!quiet) { sound.current?.tick(pace); if (L.machine === 'toy') sound.current?.bell(); }
      if (byHand) buzz();
      if (L.finale && !L.reduced) burst(to);
    }
    if (!quiet && topCentresCrossed(from - Math.PI, to - Math.PI) > 0) sound.current?.tock(pace);
    if (byHand || voice === 'guide') {
      const steps = detentSteps(from, to);
      if (steps.length) { sound.current?.step(steps[steps.length - 1]); if (byHand) buzz(70); }
    }
    if (L.selected) {
      bins.current = sweepBins(bins.current, from, to);
      const a = SHAFT[L.machine].y - poseOf(from, L.machine).wristY, b = SHAFT[L.machine].y - poseOf(to, L.machine).wristY;
      const [lo, hi] = span.current ?? [a, a];
      span.current = [Math.min(lo, a, b), Math.max(hi, a, b)];
    }
    if (L.machine === 'writer') marks.current = writeInk(marks.current, from, to, L.ink);
    if (byHand) {
      const before = hand.current;
      hand.current += Math.abs(to - from);
      if (!L.hinted && hand.current > 0.5) { live.current.hinted = true; setHinted(true); }
      if (before < HAND_TURN_GOAL - 1e-6 && hand.current >= HAND_TURN_GOAL - 1e-6) {
        setExplore(e => turnedByHand(e, HAND_TURN_GOAL));
        // The staged moment: round and round, up and down, drawn side by side.
        ages.current.insight = 0; encore.current = false;
        setAha(true); later(() => setAha(false), 6000);
        sound.current?.chime('aha'); earn('turned');
      }
    }
    // `burst` and `earn` are stable; the loop below reads everything else from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The finish throws a handful of cogs and beads from the top of the stroke. */
  const burst = (at: number) => {
    const from = moverOf(poseOf(at, live.current.machine));
    const fresh: Spark[] = Array.from({ length: 12 }, (_, i) => ({
      x: from.x, y: Math.max(96, from.y - 6), vx: (Math.random() - 0.5) * 280, vy: -150 - Math.random() * 170, turn: Math.random() * 360, spin: (Math.random() - 0.5) * 520,
      age: 0, life: 0.9 + Math.random() * 0.5, kind: i % 3, hue: (i + Math.floor(Math.random() * 5)) % 5,
    }));
    sparks.current = [...sparks.current.slice(-22), ...fresh];
  };

  const step = useCallback((now: number) => {
    raf.current = 0;
    const dt = last.current ? Math.min(0.05, Math.max(0, (now - last.current) / 1000)) : 0;
    last.current = now;
    const L = live.current, A = ages.current, from = theta.current;
    const dragging = !!grab.current?.active;
    if (finaleT.current >= 0) {
      finaleT.current += dt;
      if (!L.reduced) { motor.current = easeMotor(motor.current, TAU * 1.45, dt * 0.5); theta.current += motor.current * dt; moved(from, theta.current, 'motor'); }
    } else if (dragging) {
      if (L.reduced) { theta.current = target.current; omega.current = 0; }
      else { const s = follow({ theta: theta.current, omega: omega.current }, target.current, dt); theta.current = s.theta; omega.current = s.omega; }
      moved(from, theta.current, 'hand');
      samples.current = [...samples.current.filter(s => now - s.t < 200), { t: now, theta: theta.current }];
    } else if (demo.current) {
      const d = demo.current; d.t += dt;
      if (!L.reduced) { theta.current = d.from + smooth((d.t - 0.75) / 1.15) * DEMO_TURN; moved(from, theta.current, 'quiet'); }
      if (d.t > 2.5) { demo.current = null; loose.current = true; looseHand.current = false; omega.current = 0; armHint(6000); }
    } else if (L.playing) {
      motor.current = easeMotor(motor.current, targetSpeed(), dt);
      theta.current += motor.current * dt;
      moved(from, theta.current, 'motor');
    } else if (guide.current > 0) {
      const speed = Math.min(2.5, 0.9 + guide.current * 1.5), d = Math.min(guide.current, speed * dt);
      theta.current += d; guide.current -= d;
      moved(from, theta.current, 'guide');
      if (guide.current <= 0) { loose.current = true; looseHand.current = false; omega.current = 0.9; }
    } else if (calm.current > 0) {
      // The last sliver goes too, so four quarter pushes make one whole turn.
      const d = calm.current - SPEED_OMEGA.slow * dt < 1e-4 ? calm.current : SPEED_OMEGA.slow * dt;
      calm.current -= d; theta.current += d;
      if (calm.current <= 0) calm.current = 0;
      moved(from, theta.current, 'hand');
    } else if (loose.current && !L.reduced) {
      const s = swing({ theta: theta.current, omega: omega.current }, dt);
      theta.current = s.theta; omega.current = s.omega;
      moved(from, theta.current, looseHand.current ? 'hand' : 'quiet');
      if (s.omega === 0 && Math.abs(loadTurn(s.theta)) < REST_TURN) { loose.current = false; looseHand.current = false; }
    }
    const resting = !dragging && !demo.current && !L.playing && guide.current <= 0 && calm.current <= 0 && !(loose.current && !L.reduced) && finaleT.current < 0;
    // The staged turn: once the hand has let go, the machine shows it once more, slowly.
    if (!encore.current && A.insight > 1.1 && A.insight < 4.6 && resting && !L.reduced) { encore.current = true; guide.current = TAU; }
    const goal = L.open ? 1 : 0;
    if (openP.current !== goal) openP.current = L.reduced ? goal : goal > openP.current ? Math.min(1, openP.current + dt / WIPE_S) : Math.max(0, openP.current - dt / WIPE_S);
    let aging = false;
    for (const key of Object.keys(AGE_END) as (keyof Ages)[]) if (A[key] < REST) { A[key] += dt; if (A[key] > AGE_END[key]) A[key] = REST; else aging = true; }
    // AnchorCheck glides to the chosen part's joint (or back to its tray).
    const want = L.selected && L.open ? tagFor(L.selected, poseOf(theta.current, L.machine)).at : TOOL_DOCK;
    const k = L.reduced ? 1 : 1 - Math.exp(-dt / 0.07);
    const gap = Math.hypot(want.x - tool.current.x, want.y - tool.current.y);
    tool.current = { x: tool.current.x + (want.x - tool.current.x) * k, y: tool.current.y + (want.y - tool.current.y) * k };
    if (sparks.current.length) {
      const pull = L.reduced ? 0 : 420;
      sparks.current = sparks.current.map(s => ({ ...s, age: s.age + dt, x: s.x + s.vx * dt, y: s.y + s.vy * dt, vy: s.vy + pull * dt, turn: s.turn + s.spin * dt })).filter(s => s.age < s.life);
    }
    // Keep theta small without moving the machine (a whole turn changes nothing).
    if (Math.abs(theta.current) > TAU * 1000 && L.machine !== 'writer') theta.current = wrapAngle(theta.current);
    setFrame(f => (f + 1) % 1e6);
    const busy = !resting || openP.current !== goal || aging || gap > 0.4 || sparks.current.length > 0;
    if (busy) { raf.current = requestAnimationFrame(step); } else last.current = 0;
    // `armHint` is declared below and stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moved]);
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(step); }, [step]);

  /** The showing hand: it comes after a quiet moment, and never once the child has turned the wheel. */
  const armHint = useCallback((ms: number) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = null;
    if (live.current.hinted) return;
    hintTimer.current = setTimeout(() => {
      hintTimer.current = null;
      const L = live.current;
      if (L.hinted || L.finale) return;
      if (L.playing || grab.current || guide.current > 0 || calm.current > 0 || (looseHand.current && omega.current !== 0)) { armHint(3000); return; }
      demo.current = { t: 0, from: theta.current }; loose.current = false; omega.current = 0;
      kick();
    }, ms);
  }, [kick]);
  /** Any touch or key: the showing hand steps aside at once and waits again. */
  const stir = useCallback(() => {
    if (demo.current) { demo.current = null; loose.current = true; looseHand.current = false; }
    armHint(6000);
  }, [armHint]);

  /** Everything stops: the motor, any spin, any push. The angle stays exactly where it is. */
  const freeze = useCallback(() => {
    live.current.playing = false; setPlayingState(false);
    motor.current = 0; omega.current = 0; calm.current = 0; guide.current = 0; loose.current = false; looseHand.current = false; demo.current = null;
    if (grab.current) grab.current.active = false;
    grab.current = null;
    kick();
  }, [kick]);

  useEffect(() => {
    const instance = createCrankSound(); sound.current = instance;
    const pending = timers.current;
    const hidden = () => { if (document.visibilityState === 'hidden') { freeze(); instance.stop(); } };
    document.addEventListener('visibilitychange', hidden);
    armHint(1500);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      for (const t of pending) clearTimeout(t);
      pending.clear();
      if (hintTimer.current) clearTimeout(hintTimer.current);
      instance.dispose(); sound.current = null;
    };
  }, [freeze, armHint]);
  useEffect(() => { kick(); }, [open, reduced, selected, machine, kick]);

  /* The play area fills what is left of the screen under the Studio's bar, so
     the page never scrolls during play; the stage picture is laid under the
     drawing in the drawing's own units, so the machine always stands on the
     bench whatever shape the stage is. */
  useLayoutEffect(() => {
    const node = bench.current, box = stage.current;
    if (!node || !box) return;
    const fit = () => {
      const view = node.closest('.studio-game-view'), card = node.closest('.adventure');
      const pad = (view ? parseFloat(getComputedStyle(view).paddingBottom) || 0 : 12) + (card ? (parseFloat(getComputedStyle(card).paddingBottom) || 0) + 2 : 0);
      const top = node.getBoundingClientRect().top + window.scrollY;
      node.style.setProperty('--ck-fit', `${Math.max(400, Math.round(window.innerHeight - top - pad))}px`);
      const { width, height } = box.getBoundingClientRect(), img = backdrop.current;
      if (!img || !width || !height) return;
      const u = Math.min(width / VIEW_W, height / VIEW_H);
      img.style.width = `${(STAGE_BOX.w * u).toFixed(1)}px`;
      img.style.left = `${(width / 2 + (STAGE_BOX.x - VIEW_W / 2) * u).toFixed(1)}px`;
      img.style.bottom = `${((VIEW_H - STAGE_BOX.y - STAGE_BOX.h) * u).toFixed(1)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    watch?.observe(box);
    return () => { window.removeEventListener('resize', fit); watch?.disconnect(); };
  }, []);

  /* ------------------------------------------------------------- input */
  const toSvg = (clientX: number, clientY: number) => {
    const node = svg.current, ctm = node?.getScreenCTM();
    if (!node || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x - SHAFT[live.current.machine].x, y: p.y - SHAFT[live.current.machine].y };
  };
  const handTakesOver = () => {
    if (live.current.playing) { live.current.playing = false; setPlayingState(false); }
    motor.current = 0; calm.current = 0; guide.current = 0; demo.current = null;
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (live.current.finale) return;
    stir();
    const p = toSvg(e.clientX, e.clientY); if (!p) return;
    const inWheel = Math.hypot(p.x, p.y) <= GRAB[live.current.machine];
    grab.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, angle: pointerAngle(p.x, p.y), inWheel, active: false, target: e.target as Element };
    if (inWheel) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ } }
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.active) {
      if (!g.inWheel || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return;
      g.active = true; handTakesOver(); loose.current = false; target.current = theta.current; samples.current = [];
      buzz(); kick();
    }
    const p = toSvg(e.clientX, e.clientY);
    if (!p || Math.hypot(p.x, p.y) < 12) return; // too near the shaft to tell which way
    const angle = pointerAngle(p.x, p.y);
    target.current += angleDelta(g.angle, angle); g.angle = angle;
    // The wheel has weight: the finger may lead it, but never by more than a third of a turn.
    target.current = Math.max(theta.current - TAU / 3, Math.min(theta.current + TAU / 3, target.current));
    kick();
  };
  const endGrab = (e: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    grab.current = null;
    if (g.active) {
      const now = performance.now();
      omega.current = cancelled || live.current.reduced ? 0 : releaseSpeed(samples.current, now);
      loose.current = !live.current.reduced; looseHand.current = true;
      kick(); return;
    }
    if (!cancelled) tap(g.target);
  };
  const hintLook = () => { setNudge(true); later(() => setNudge(false), 1500); };
  const poke = (toy: string) => {
    buzz();
    if (toy === 'knob') { ages.current.bounce = 0; sound.current?.toy('boing'); }
    else if (toy === 'flower') { ages.current.bounce = 0; sound.current?.toy('giggle'); }
    else if (toy === 'glass') { ages.current.peek = 0; sound.current?.toy('peek'); hintLook(); }
    else if (toy === 'friend') { cheer(); sound.current?.toy('woof'); }
    else if (toy === 'pod') { ages.current.pod = 0; sound.current?.toy('pod'); togglePlay(); }
    kick();
  };
  const tap = (hit: Element | null) => {
    const toy = hit?.closest?.('[data-crank-toy]')?.getAttribute('data-crank-toy');
    const part = hit?.closest?.('[data-crank-part]')?.getAttribute('data-crank-part') as PartId | null | undefined;
    if (canSelect(machine, part, live.current.open)) { choose(part); if (toy === 'knob' || toy === 'flower') poke(toy); return; }
    if (toy) { poke(toy); return; }
    if (!live.current.open) { if (part) hintLook(); return; }
    setSelected(null);
  };
  const choose = (part: PartId) => {
    buzz();
    if (part !== selected) { bins.current = Array<boolean>(TRACE_BINS).fill(false); span.current = null; ages.current.tool = 0; }
    sound.current?.note(MACHINE_PARTS[machine].indexOf(part));
    live.current.selected = part; setSelected(part);
    const before = badgesOf(explore).parts, next = metPart(explore, part);
    setExplore(next);
    if (!before && badgesOf(next).parts) later(() => { earn('parts'); runChain(); }, 650);
    kick();
  };
  /** Every part met: the machine shows the chain once, hand to wheel to crank to rod to slide. */
  const runChain = () => {
    const order = MACHINE_PARTS[live.current.machine];
    order.forEach((part, i) => later(() => { setChain(part); sound.current?.note(i + 2); kick(); }, i * 330));
    later(() => setChain(null), order.length * 330 + 260);
  };
  const onWheelKey = (e: KeyboardEvent<SVGGElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (dir) {
      e.preventDefault(); stir(); handTakesOver(); omega.current = 0; loose.current = false;
      const from = theta.current; theta.current += dir * KEY_STEP;
      moved(from, theta.current, 'hand'); kick(); return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(); }
  };
  const turn = () => {
    buzz(); stir();
    // The hand takes over from the motor; pushes in a row add up.
    const pending = calm.current, spinning = loose.current ? omega.current : 0; handTakesOver();
    if (live.current.reduced) calm.current = Math.min(TAU, pending + CALM_PUSH);
    else { omega.current = push(spinning); loose.current = true; looseHand.current = true; }
    kick();
  };
  const togglePlay = () => {
    stir();
    if (live.current.playing) { freeze(); return; }
    motor.current = Math.max(0, omega.current); omega.current = 0; calm.current = 0; guide.current = 0; loose.current = false;
    setPlaying(true); kick();
  };
  const chooseSpeed = (next: Speed) => { buzz(); sound.current?.note(SPEEDS.indexOf(next) * 2); live.current.speed = next; setSpeedState(next); kick(); };
  const toggleOpen = () => {
    const next = !open; stir(); buzz();
    live.current.open = next; setOpen(next); setNudge(false);
    sound.current?.chime(next ? 'open' : 'shut');
    if (next) { if (!explore.inside) later(() => earn('inside'), 500); setExplore(lookedInside); }
    else { live.current.selected = null; setSelected(null); }
    kick();
  };
  const chooseMachine = (next: MachineId) => {
    if (next === machine) return;
    stir(); buzz();
    live.current.machine = next; setMachine(next); ages.current.arrive = 0;
    sound.current?.chime('swap');
    const kept = carrySelection(selected, next);
    live.current.selected = kept; setSelected(kept); bins.current = Array<boolean>(TRACE_BINS).fill(false); span.current = null;
    if (!explore.seen.includes(next)) cheer();
    setExplore(e => sawMachine(e, next));
    if (!live.current.playing && !live.current.reduced) { loose.current = true; looseHand.current = false; }
    kick();
  };
  const chooseInk = (next: number) => { buzz(); sound.current?.toy('ink'); live.current.ink = next; setInkState(next); ages.current.bounce = 0; kick(); };
  const finish = () => {
    freeze(); buzz();
    live.current.finale = true; setFinale(true); live.current.selected = null; setSelected(null);
    finaleT.current = 0; motor.current = TAU * 0.4;
    sound.current?.chime('finish'); cheer();
    // Motion reduced: the cogs are simply there, spread out, and fade.
    if (reduced) { burst(theta.current); sparks.current = sparks.current.map(s => ({ ...s, x: s.x + s.vx * 0.3, y: s.y + s.vy * 0.3 + 18, vx: 0, vy: 0, spin: 0 })); }
    later(() => { ages.current.hop = 0; ages.current.cheer = 0; kick(); }, 900);
    // The celebration is timed, never waited on: completion always arrives.
    later(() => done.current(), reduced ? 1500 : 2300);
    kick();
  };

  /* ------------------------------------------------------------- render */
  const pose = poseOf(theta.current, machine);
  const openNow = openP.current, A = ages.current;
  const badges = badgesOf(explore);
  const finished = canFinish(explore);
  const cueId = aha ? 'aha' : cueFor(explore, open, machine);
  const cue = w.cues[cueId][machine];
  const parts = MACHINE_PARTS[machine];
  const partWords = (part: PartId) => (w.parts[machine] as Record<string, { name: string; line: string }>)[part];
  const shown = chain ?? (selected && open ? selected : null);
  const placeWords = w.place[machine][strokePlace(theta.current)];
  const deg = Math.round(wrapAngle(theta.current) * 180 / Math.PI) % 360;
  const bounce = A.bounce < REST && !reduced ? Math.exp(-A.bounce * 7) * Math.sin(A.bounce * 26) : 0;
  const peek = A.peek < REST ? clamp01(A.peek / 0.18) * clamp01((AGE_END.peek - A.peek) / 0.3) : 0;
  const arrive = A.arrive < REST && !reduced ? 1 - A.arrive / AGE_END.arrive : 0;
  const lift = arrive > 0 ? -16 * arrive * arrive : 0;
  const insight = A.insight < REST ? clamp01(A.insight / 0.35) * clamp01((AGE_END.insight - A.insight) / 0.8) : 0;
  const pod = A.pod < REST ? A.pod / AGE_END.pod : -1;
  const d = demo.current;
  const handAt = d ? handSpot(pose, reduced ? 0 : theta.current - d.from) : null;
  const handShow = d ? clamp01(d.t / 0.35) * clamp01((2.5 - d.t) / 0.4) : 0;
  const handPress = d ? (reduced ? 0.6 : clamp01((d.t - 0.5) / 0.2) * clamp01((2.05 - d.t) / 0.15)) : 0;
  const handOff = d && !reduced ? (1 - smooth(d.t / 0.55)) * 26 + smooth((d.t - 2.05) / 0.4) * 20 : 0;
  const toolAt = shown && open ? tagFor(shown, pose) : null;
  const nextCue = !finished && !aha && cueId !== 'turn' ? cueId : null;
  const next = badges.turned ? (badges.inside ? (badges.parts ? null : 'parts') : 'inside') : 'turned';
  const art = { id, pose, open: openNow, selected: shown, peek, live: playing || finale, bounce };

  return <div ref={bench} className="ck-bench" data-machine={machine} data-open={open} data-playing={playing} data-finale={finale} onKeyDownCapture={stir}>
    <div className="adventure-toolbar ck-bar">
      <div className="ck-switch" role="group" aria-label={w.machineGroup}>
        {MACHINES.map(m => <button type="button" key={m} data-crank-machine={m} aria-pressed={machine === m} data-next={nextCue === 'other' && !explore.seen.includes(m)} onClick={() => chooseMachine(m)}>
          {m === 'engine' ? <Cog size={19} aria-hidden="true" /> : m === 'toy' ? <Flower2 size={19} aria-hidden="true" /> : <AudioWaveform size={19} aria-hidden="true" />}<span>{w.machines[m]}</span>
        </button>)}
      </div>
      <ul className="ck-badges" aria-label={w.badgesGroup}>
        {(['turned', 'inside', 'parts'] as const).map(b => {
          const Icon = b === 'turned' ? Hand : b === 'inside' ? Eye : Tag;
          return <li key={b} className="ck-badge" data-lit={badges[b]} data-next={!finished && next === b} data-pop={pop === b} data-crank-badge={b} aria-label={`${w.badges[b]}: ${badges[b] ? w.badgeLit : w.badgeDim}`}>
            <span className="ck-badge__mark" aria-hidden="true">{badges[b] ? <Check size={16} strokeWidth={3.2} /> : <Icon size={16} />}</span><span className="ck-badge__name" aria-hidden="true">{w.badges[b]}</span>
          </li>;
        })}
      </ul>
    </div>
    {/* The heading never takes focus: a child turning the wheel by keyboard
        keeps it. The words are announced politely instead. */}
    <div className="ck-say" data-ready={finished}>
      <AdventureHeading focusKey="crank-works"><span aria-live="polite" className={shown ? 'ck-said' : 'ck-cue'}>{shown
        ? <><strong>{partWords(shown).name}.</strong> {partWords(shown).line}</>
        : cue}</span></AdventureHeading>
      {finished && <button type="button" className="ck-done" data-crank-done="" disabled={finale} onClick={finish}><Check size={22} strokeWidth={3} aria-hidden="true" /><span>{w.done}</span></button>}
    </div>

    <div ref={stage} className="ck-stage">
      <img ref={backdrop} className="ck-backdrop" src={KIT_STAGE.src} width={KIT_STAGE.width} height={KIT_STAGE.height} alt="" draggable={false} decoding="async" />
      <svg ref={svg} className="ck-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet" role="group" aria-label={w.stage[machine]}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => endGrab(e, false)} onPointerCancel={e => endGrab(e, true)}>
        <CrankDefs id={id} />
        <g role="slider" tabIndex={0} aria-label={w.wheelLabel[machine]} aria-valuemin={0} aria-valuemax={359} aria-valuenow={deg} aria-valuetext={placeWords}
          onKeyDown={onWheelKey} onFocus={() => setWheelFocus(true)} onBlur={() => setWheelFocus(false)} className="ck-wheel-focus">
          <circle data-crank-wheel="" cx={pose.sx} cy={pose.sy} r={GRAB[machine]} className="ck-grab" />
        </g>
        <g transform={lift ? `translate(0 ${lift.toFixed(2)})` : undefined}>
          {machine === 'writer' && <WaveGlass id={id} feed={FEED * theta.current}><WaveLine marks={marks.current} pose={pose} /></WaveGlass>}
          {machine === 'engine' ? <EngineArt {...art} /> : machine === 'toy' ? <ToyArt {...art} /> : <WriterArt {...art} ink={ink} />}
          {shown && open && <Traces pose={pose} bins={bins.current} span={span.current} round={shown !== 'piston' && shown !== 'cylinder' && shown !== 'bloom' && shown !== 'tracer'} line={shown !== 'wheel' && shown !== 'handle' && shown !== 'crank'} />}
        </g>
        {insight > 0 && <Insight pose={pose} show={insight} draw={reduced ? 1 : A.insight / 0.9} />}
        <circle data-crank-toy="pod" cx={POD.x} cy={POD.y} r="21" className="ck-grab" />
        {pod >= 0 && <g aria-hidden="true" style={{ opacity: 1 - pod }}>
          <circle cx={POD.x - 5} cy={POD.y - 2} r={6 + pod * 16} className="ck-pod ck-pod--amber" />
          <circle cx={POD.x + 7} cy={POD.y + 1} r={5 + pod * 12} className="ck-pod ck-pod--cyan" />
        </g>}
        <Companion cheer={A.cheer < REST} hop={reduced ? 9 : A.hop} nod={reduced ? 0 : pose.lift01 - 0.5} />
        {openNow > 0 && !finale && <PartTags parts={parts} pose={pose} selected={shown} met={explore.met} names={p => partWords(p).name} lang={lang} show={openNow} focus={focusPart} />}
        {openNow > 0 && !finale && <AnchorCheck x={tool.current.x} y={tool.current.y} flip={!!toolAt && toolAt.tag.x > toolAt.at.x} show={openNow} age={shown ? A.tool : 9} />}
        {sparks.current.length > 0 && <Sparks sparks={sparks.current} />}
        {handAt && handShow > 0 && <GhostHand x={handAt.x + handOff} y={handAt.y + handOff * 0.7} press={handPress} show={handShow} still={reduced} arc={reduced ? handAt.arc : null} />}
        {wheelFocus && <circle cx={pose.sx} cy={pose.sy} r={GRAB[machine] - 2} className="ck-focus-ring" />}
      </svg>
      {machine === 'writer' && <div className="ck-inks" role="group" aria-label={w.inkGroup}>
        {INKS.map((colour, i) => <button type="button" key={i} data-crank-ink={i} aria-pressed={ink === i} aria-label={w.inks[i]} onClick={() => chooseInk(i)}><i aria-hidden="true" style={{ background: colour }} /></button>)}
      </div>}
    </div>

    {/* The parts as buttons too: the keyboard and switch way to meet them. */}
    <div className="ck-chips" role="group" aria-label={w.partsGroup} data-open={open} key={machine}>
      {open && parts.map(p => <button type="button" key={p} className="ck-chip" data-crank-chip={p} aria-pressed={selected === p} data-met={explore.met.includes(p)} aria-label={explore.met.includes(p) ? `${partWords(p).name}, ${w.partMet}` : partWords(p).name}
        onFocus={() => setFocusPart(p)} onBlur={() => setFocusPart(null)} onClick={() => choose(p)}>
        <span>{partWords(p).name}</span>{explore.met.includes(p) && <Check size={14} strokeWidth={3} aria-hidden="true" />}
      </button>)}
    </div>

    <div className="adventure-actions ck-dock">
      {playing && !reduced
        ? <div className="ck-lever" role="group" aria-label={w.speed} data-speed={speed}>
          <span className="ck-lever__knob" aria-hidden="true" />
          {SPEEDS.map(s => <button type="button" key={s} data-crank-speed={s} aria-pressed={speed === s} aria-label={w.speeds[s]} title={w.speeds[s]} onClick={() => chooseSpeed(s)}>
            {s === 'slow' ? <Snail size={22} aria-hidden="true" /> : s === 'steady' ? <Turtle size={22} aria-hidden="true" /> : <Rabbit size={22} aria-hidden="true" />}<span>{w.speeds[s]}</span>
          </button>)}
        </div>
        : <button type="button" className="ck-btn" data-crank-turn="" disabled={finale} onClick={turn}><RotateCw size={22} aria-hidden="true" /><span>{w.turn}</span></button>}
      <button type="button" className="ck-btn" data-crank-play="" aria-pressed={playing} disabled={finale} onClick={togglePlay}>{playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}<span>{playing ? w.pause : w.play}</span></button>
      <button type="button" className="ck-btn" data-crank-inside="" aria-pressed={open} data-next={nextCue === 'look'} data-nudge={nudge} disabled={finale} onClick={toggleOpen}>{open ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}<span>{open ? w.close : w.inside}</span></button>
    </div>
  </div>;
}
