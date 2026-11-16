import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { AudioWaveform, Bell, Cog, Eye, Flower2, Hand, RotateCw, Wrench } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  HudButton, HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, roundSeed, useReducedMotion, useShake,
  type CoachMood, type FxKind, type FxOptions, type PlayFxHandle, type PlaySound,
} from '../play';
import { CRANK_WORKS_COPY } from './crankWorksCopy';
import {
  CALM_PUSH, CHAPTERS, FLOW_START, HAND_TURN_GOAL, KEY_STEP, LENS_DWELL, LENS_PARTS, SHOW_START_GOAL, SPEED_OMEGA, TAU,
  angleDelta, beatsCrossed, builtOf, chaptersDone, detentSteps, easeMotor, flowReduce, follow, nearestPart, partsLeft, planOf, pointerAngle, push, releaseSpeed, stepOf, strokePlace, swing, topCentresCrossed, wrapAngle,
  type Beat, type Chapter, type Flow, type FlowEvent, type PartId, type Point, type TurnSample,
} from './crankWorksRules';
import {
  BELL, CRATE_SLOT, PART_KINDS, PUCK, SHOTS, SOCKET, SOCKET_REACH, WHEEL, anchorsAt, beadAt, easeView, frameView, handleAt, hitAt, jointAt, knobAt, roomRect, shotFor, stemTop, toScreen, toWorld,
  type PartKind, type Shot, type View,
} from './crankGeometry';
import { paintHint, paintLens, paintScene, readPalette, type PaintImages, type Palette, type Scene } from './crankPaint';
import { KIT_ANCHORCHECK, KIT_BENCH, KIT_CHOCK, KIT_COMPANION, KIT_ROOM } from './crankKit';
import { createCrankSound, type CrankSound } from './crankAudio';
import '../makerPalette.css';
import './crankWorks.css';

type Lang = 'en' | 'he';
type Words = (typeof CRANK_WORKS_COPY)[Lang];
type Voice = 'hand' | 'motor' | 'quiet';
const PART_OF: Partial<Record<Chapter, PartKind>> = { flowerCh: 'flowerPart', waveCh: 'beadsPart', finaleCh: 'bellPart' };
const BLOOM_TONES: readonly (readonly string[])[] = [['rose', 'blossom', 'white'], ['sun', 'butter', 'white'], ['lilac', 'violet', 'white'], ['poppy', 'clay-light', 'white']];
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = clamp01(n); return p * p * (3 - 2 * p); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function CrankWorks() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = CRANK_WORKS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const [seed] = useState(roundSeed);
  return <GameShell fullBleed autoNarrate={false} worldId="crank-works" title={w.title} instruction={w.instruction}>
    <section data-adventure="crank-works" dir={lang === 'he' ? 'rtl' : 'ltr'} data-done={done}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setRun(n => n + 1); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <Bench key={run} w={w} lang={lang} seed={seed + run * 7919} onDone={() => setDone(true)} />}
    </section>
  </GameShell>;
}

interface Grab { kind: 'wheel' | 'lensGrab' | 'partGrab' | 'tapLook'; id: number; x0: number; y0: number; active: boolean; angle: number; dx: number; dy: number; part: PartKind | null }
interface Sim {
  theta: number; omega: number; motor: number; calm: number; guide: number; target: number; loose: boolean; looseHand: boolean; hand: number; turnedEver: boolean;
  demo: { t: number; from: number } | null; pod: boolean; idle: number; time: number; glint: number;
  w: number; h: number; dpr: number; view: View | null;
  flower: number; beads: number; bell: number; reveal: [number, number, number]; revealTo: [number, number, number];
  bellSwing: number; bellVel: number; beadPop: number[]; bloomPop: number; knobPop: number;
  chock: { y: number; vy: number; squash: number; lean: number; enter: number; hops: number };
  lens: { out: boolean; home: boolean; held: boolean; x: number; y: number; tx: number; ty: number; grow: number; idle: number; stay: number; cand: PartId | null; named: PartId | null; dwell: number; lit: number; trail: PartId | null };
  carry: { kind: PartKind; mode: 'inHand' | 'fly' | 'goBack'; x: number; y: number; tilt: number; t: number; fromX: number; fromY: number } | null;
  tool: { show: number; clamp: number }; tape: number;
  test: { t: number; stage: number; end: number } | null;
  show: { t: number; fast: boolean; burst: boolean; over: boolean } | null;
  opening: number;
}

function Bench({ w, lang, seed, onDone }: { w: Words; lang: Lang; seed: number; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [plan] = useState(() => planOf(seed));
  const [flow, setFlow] = useState<Flow>(FLOW_START);
  const [phase, setPhase] = useState<'opening' | 'playing'>('opening');
  const [tag, setTag] = useState<{ part: PartId; fresh: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cheer, setCheer] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [deg, setDeg] = useState(0);
  const [shake, bump] = useShake();

  const world = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), fx = useRef<PlayFxHandle>(null);
  const wheelHandle = useRef<HTMLDivElement>(null), lensHandle = useRef<HTMLButtonElement>(null), partHandle = useRef<HTMLButtonElement>(null), tagEl = useRef<HTMLDivElement>(null);
  const glass = useRef<HTMLCanvasElement | null>(null), palette = useRef<Palette | null>(null);
  const images = useRef<PaintImages>({ roomImg: null, bench: null, chock: null, tool: null });
  const sim = useRef<Sim>({
    theta: plan.rest, omega: 0, motor: 0, calm: 0, guide: 0, target: 0, loose: false, looseHand: false, hand: 0, turnedEver: false, demo: null, pod: false, idle: 0, time: 0, glint: 2,
    w: 0, h: 0, dpr: 1, view: null, flower: 0, beads: 0, bell: 0, reveal: [0, 0, 0], revealTo: [0, 0, 0], bellSwing: 0, bellVel: 0, beadPop: [0, 0, 0, 0, 0, 0], bloomPop: 0, knobPop: 0,
    chock: { y: 0, vy: 0, squash: 0, lean: 0, enter: 1, hops: 0 },
    lens: { out: false, home: false, held: false, x: 0, y: 0, tx: 0, ty: 0, grow: 0, idle: 0, stay: 1.6, cand: null, named: null, dwell: 0, lit: 0, trail: null },
    carry: null, tool: { show: 0, clamp: 0 }, tape: 0, test: null, show: null, opening: 0,
  });
  const flowRef = useRef(flow), phaseRef = useRef(phase), reducedRef = useRef(reduced);
  phaseRef.current = phase; reducedRef.current = reduced;
  const grab = useRef<Grab | null>(null), samples = useRef<TurnSample[]>([]);
  const raf = useRef(0), last = useRef(0), buzzed = useRef(0), degSeen = useRef(-1);
  const crank = useRef<CrankSound | null>(null), play = useRef<PlaySound | null>(null), bedOn = useRef(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const done = useRef(onDone); done.current = onDone;
  const words = useRef(w); words.current = w;

  const later = useCallback((fn: () => void, ms: number) => { const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms); timers.current.add(t); return t; }, []);
  const buzz = useCallback((gap = 0) => { const now = performance.now(); if (now - buzzed.current < gap) return; buzzed.current = now; void selectionHaptic(); }, []);
  const say = useCallback((line: string, ms = 2400) => { setToast(line); later(() => setToast(t => (t === line ? null : t)), ms); }, [later]);
  const fxAt = useCallback((p: Point, kind: FxKind, opts?: FxOptions) => {
    const S = sim.current; if (!S.view || !S.w) return;
    const at = toScreen(S.view, p); fx.current?.burst(at.x / S.w, at.y / S.h, kind, opts);
  }, []);
  const stagePoint = (p: Point): [number, number] => { const S = sim.current, at = S.view ? toScreen(S.view, p) : { x: 0, y: 0 }; return [at.x / (S.w || 1), at.y / (S.h || 1)]; };
  const hop = useCallback((power = 1) => { const C = sim.current.chock; if (reducedRef.current) { C.squash = 0.05; return; } if (C.y <= 0.5) C.vy = 250 * power; }, []);

  /* ------------------------------------------------------------ the arc */
  const dispatch = useCallback((event: FlowEvent) => {
    const before = flowRef.current, next = flowReduce(before, event);
    if (next === before) return;
    flowRef.current = next; setFlow(next);
    if (next.chapter === before.chapter && next.step === before.step && !next.over) return;
    const S = sim.current, W = words.current; S.hand = 0; S.idle = 0; setNudge(false);
    if (stepOf(before) === 'lookIn') { S.lens.stay = 1.1; S.lens.idle = 0; S.lens.trail = null; }
    if (next.chapter !== before.chapter || next.over) {
      // A chapter ends: a small flourish that belongs to what was just understood.
      play.current?.chapter(); hop(1.15); buzz();
      setCheer(W.cheers[before.chapter]); later(() => setCheer(c => (c === W.cheers[before.chapter] ? null : c)), 2800);
      const at = before.chapter === 'pistonCh' ? knobAt(S.theta) : before.chapter === 'flowerCh' ? stemTop(S.theta) : before.chapter === 'waveCh' ? beadAt(3, S.theta) : BELL;
      fxAt(at, 'sparkle', { count: 16, spread: 1.3 }); fxAt(at, 'ring', { tones: ['gold-light'] });
    }
    if (next.over) { later(() => done.current(), 300); return; }
    const step = stepOf(next);
    if (step === 'testJoint') { S.revealTo[0] = 1; crank.current?.chime('open'); S.omega = 0; S.loose = false; S.pod = false; }
    if (step === 'bigShow') {
      S.show = { t: 0, fast: false, burst: false, over: false }; S.motor = Math.max(1.5, Math.abs(S.omega)); S.pod = false; S.calm = 0; S.guide = 0; S.loose = false; grab.current = null; setGrabbing(null);
      S.lens.home = true; setShowing(true); play.current?.setPiece(); hop(1.3);
    }
  }, [buzz, fxAt, hop, later]);

  /** Something topped out: the tick, the bloom, a bead's note, the bell. */
  const onBeat = useCallback((beat: Beat, pace: number, voice: Voice) => {
    const S = sim.current, show = !!S.show;
    if (beat.kind === 'pistonTop') {
      crank.current?.tick(pace); S.knobPop = 1; if (voice === 'hand') buzz();
      const knob = knobAt(S.theta); fxAt({ x: knob.x, y: knob.y + 12 }, 'dust', { tones: ['white', 'sky-pale'], count: show ? 5 : 3, size: 0.55, angle: -90, arc: 80 }); if (show) fxAt(knob, 'glint', { count: 2, size: 0.6 });
    }
    else if (beat.kind === 'bloomTop') {
      if (S.flower < 1) return;
      S.bloomPop = 1; play.current?.note(12, { gain: 0.028, length: 0.5 });
      const top = stemTop(S.theta); fxAt({ x: top.x, y: top.y - 16 }, show ? 'petal' : 'sparkle', { tones: BLOOM_TONES[plan.bloom], count: show ? 9 : 4, size: 0.7, spread: 0.8 });
    } else if (beat.kind === 'beadTop') {
      if (S.beads < 1) return;
      S.beadPop[beat.index] = 1; crank.current?.note(plan.tune[beat.index]);
      if (show) fxAt(beadAt(beat.index, S.theta), 'glint', { count: 1, size: 0.5 });
    } else if (S.bell >= 1) {
      crank.current?.bell(); S.bellVel += 5.5; fxAt({ x: BELL.x, y: BELL.y + 16 }, 'ring', { tones: ['gold-light'], size: 0.7 }); hop(show ? 1 : 0.7);
      if (S.show?.fast) { bump(); crank.current?.toy('woof'); }
    }
  }, [bump, buzz, fxAt, hop, plan]);

  /** Every change of angle comes through here. */
  const moved = useCallback((from: number, to: number, voice: Voice) => {
    if (from === to) return;
    const S = sim.current, flowNow = flowRef.current, pace = Math.min(1, Math.abs(voice === 'motor' ? S.motor : S.omega) / SPEED_OMEGA.quick);
    if (voice !== 'quiet') {
      for (const beat of beatsCrossed(from, to)) onBeat(beat, pace, voice);
      if (topCentresCrossed(from - Math.PI, to - Math.PI) > 0) crank.current?.tock(pace);
      if (voice === 'hand') { const steps = detentSteps(from, to); if (steps.length) { if (S.beads < 1) crank.current?.step(steps[steps.length - 1]); buzz(70); if (Math.abs(S.omega) > 3) fx.current?.trail(...stagePoint(handleAt(to)), 'glint', { size: 0.4 }); } }
    }
    if (voice !== 'hand') return;
    S.hand += Math.abs(to - from);
    if (S.hand > 0.5) S.turnedEver = true;
    if (stepOf(flowNow) === 'turnIt') { const goal = flowNow.chapter === 'finaleCh' ? SHOW_START_GOAL : HAND_TURN_GOAL; if (S.hand >= goal - 1e-6) dispatch({ type: 'turned', amount: goal }); }
  }, [buzz, dispatch, onBeat]);

  const placePart = useCallback((kind: PartKind) => {
    const S = sim.current, W = words.current; S.carry = null;
    play.current?.place(CHAPTERS.indexOf(flowRef.current.chapter) * 2); buzz(); hop(0.9);
    fxAt(SOCKET[kind], 'sparkle', { count: 12 }); fxAt(SOCKET[kind], 'dust', { count: 6 });
    if (kind === 'beadsPart') plan.tune.forEach((note, i) => later(() => { crank.current?.note(note); sim.current.beadPop[i] = 1; }, 260 + i * 150));
    if (kind === 'bellPart') later(() => { crank.current?.bell(); sim.current.bellVel += 5; }, 520);
    else later(() => { say(W.joined, 2200); crank.current?.chime('swap'); }, 700);
    dispatch({ type: 'placed' });
  }, [buzz, dispatch, fxAt, hop, later, plan, say]);
  const flyPart = useCallback((kind: PartKind) => {
    const S = sim.current; if (S.carry || stepOf(flowRef.current) !== 'pickUp' || PART_OF[flowRef.current.chapter] !== kind) return;
    const slot = CRATE_SLOT[kind]; S.carry = { kind, mode: 'fly', x: slot.x, y: slot.y, tilt: 0, t: 0, fromX: slot.x, fromY: slot.y };
    play.current?.pick(); buzz();
  }, [buzz]);

  /* ------------------------------------------------------- the frame loop */
  const frame = useCallback((now: number) => {
    raf.current = requestAnimationFrame(frame);
    const S = sim.current, node = canvas.current, P = palette.current;
    const dt = last.current ? Math.min(0.05, Math.max(0, (now - last.current) / 1000)) : 0; last.current = now;
    if (!node || !P || !S.w || !S.h) return;
    const RM = reducedRef.current, flowNow = flowRef.current, step = stepOf(flowNow), built = builtOf(flowNow), opening = phaseRef.current === 'opening';
    const ease = (tau: number) => (RM ? 1 : 1 - Math.exp(-dt / tau));
    S.time += dt; S.idle += dt;

    // Who turns the wheel this frame.
    const from = S.theta, g = grab.current, dragging = g?.kind === 'wheel' && g.active;
    if (S.show) {
      const T = S.show; T.t += dt;
      const end = RM ? 4.6 : 7.8, speed = RM ? SPEED_OMEGA.slow : T.t < 3.4 ? TAU * 0.6 : T.t < end ? TAU * 1.1 : 0;
      S.motor = easeMotor(S.motor, speed, dt * (T.t >= end ? 0.22 : 0.5)); S.theta += S.motor * dt; S.omega = S.motor;
      moved(from, S.theta, 'motor');
      if (T.t > (RM ? 2 : 3.4) && !T.fast) { T.fast = true; S.revealTo = [1, 1, 1]; hop(1.5); crank.current?.toy('woof'); crank.current?.chime('aha'); }
      if (T.t > end && !T.burst) {
        T.burst = true; bump(); crank.current?.chime('finish'); hop(1.7);
        fxAt(stemTop(S.theta), 'petal', { tones: BLOOM_TONES[plan.bloom], count: 22, spread: 1.5 }); fxAt(BELL, 'sparkle', { count: 20, spread: 1.6 }); fxAt(knobAt(S.theta), 'glint', { count: 5 });
        fxAt({ x: 380, y: 60 }, 'confetti', { tones: ['gold-light', 'white', 'sea', 'rose', 'sun'], count: 30, spread: 1.2, angle: 90, arc: 150 });
      }
      if (T.t > end + 1.9 && !T.over) { T.over = true; dispatch({ type: 'shown' }); }
    } else if (dragging) {
      if (RM) { S.theta = S.target; S.omega = 0; } else { const n = follow({ theta: S.theta, omega: S.omega }, S.target, dt); S.theta = n.theta; S.omega = n.omega; }
      moved(from, S.theta, 'hand');
      samples.current = [...samples.current.filter(x => now - x.t < 200), { t: now, theta: S.theta }];
    } else if (S.test && S.test.stage < 3 && S.guide > 0) {
      const d = Math.min(S.guide, 2.3 * dt); S.theta += d; S.guide -= d; S.omega = 2.3; moved(from, S.theta, 'motor');
      if (S.guide <= 0) S.omega = 0;
    } else if (S.demo) {
      const d = S.demo; d.t += dt;
      if (!RM) { S.theta = d.from + smooth((d.t - 0.7) / 1.1) * 1.3; moved(from, S.theta, 'quiet'); }
      if (d.t > 2.4) { S.demo = null; S.loose = true; S.looseHand = false; S.omega = 0; S.idle = 0; }
    } else if (S.pod) {
      S.motor = easeMotor(S.motor, RM ? SPEED_OMEGA.slow : SPEED_OMEGA.steady, dt); S.theta += S.motor * dt; S.omega = S.motor; moved(from, S.theta, 'motor');
    } else if (S.calm > 0) {
      const d = S.calm - SPEED_OMEGA.slow * dt < 1e-4 ? S.calm : SPEED_OMEGA.slow * dt; S.calm = Math.max(0, S.calm - d); S.theta += d; moved(from, S.theta, 'hand');
    } else if (S.loose && !RM) {
      const n = swing({ theta: S.theta, omega: S.omega }, dt); S.theta = n.theta; S.omega = n.omega;
      moved(from, S.theta, S.looseHand ? 'hand' : 'quiet');
      if (n.omega === 0) { S.loose = false; S.looseHand = false; }
    }
    // The showing hand: after a quiet moment, until the child has turned the wheel.
    if (!opening && step === 'turnIt' && !S.turnedEver && !S.demo && !dragging && !S.loose && S.idle > 4.5 && !S.show) { S.demo = { t: 0, from: S.theta }; S.omega = 0; }
    if (!opening && S.idle > 7 && step !== 'bigShow') { S.idle = 2; setNudge(true); }

    // Things arriving, settling, fading.
    if (built.flower && S.flower < 1) S.flower = RM ? 1 : Math.min(1, S.flower + dt / 0.9);
    if (built.beads && S.beads < 1) S.beads = RM ? 1 : Math.min(1, S.beads + dt / 1.5);
    if (built.bell && S.bell < 1) S.bell = RM ? 1 : Math.min(1, S.bell + dt / 0.7);
    for (let i = 0; i < 3; i++) S.reveal[i] += (S.revealTo[i] - S.reveal[i]) * ease(0.2);
    S.knobPop = Math.max(0, S.knobPop - dt * 5); S.bloomPop = Math.max(0, S.bloomPop - dt * 3);
    for (let i = 0; i < S.beadPop.length; i++) S.beadPop[i] = Math.max(0, S.beadPop[i] - dt * 3.2);
    if (RM) { S.bellSwing = 0; S.bellVel = 0; } else { S.bellVel += (-S.bellSwing * 90 - S.bellVel * 3.4) * dt; S.bellSwing += S.bellVel * dt; }
    const C = S.chock, L0 = S.lens;
    if (C.y > 0 || C.vy > 0) { C.vy -= 980 * dt; C.y += C.vy * dt; if (C.y <= 0) { C.y = 0; C.vy = 0; C.squash = 0.1; fxAt({ x: 700, y: 262 }, 'dust', { count: 3, size: 0.6 }); } }
    C.squash += (0 - C.squash) * ease(0.12);
    // He leans in toward whatever the child has hold of, and sways along once the whole machine is going.
    C.lean += ((S.show?.fast ? -0.05 + Math.sin(S.time * 9) * 0.02 : dragging || L0.held || S.carry ? -0.04 : 0) - C.lean) * ease(0.15);
    if (C.enter > 0) { C.enter = RM ? 0 : Math.max(0, C.enter - dt / 1.5); if (!RM && C.hops < 2 && C.enter < 0.72 - C.hops * 0.4) { C.hops++; hop(0.8); } }

    // The camera.
    const shot: Shot = opening ? 'wideShot' : S.show ? (S.show.t < 3.4 || RM ? 'buildShot' : S.show.t < 7.4 ? (S.w < S.h ? 'bellShot' : 'buildShot') : 'wideShot') : S.test && S.w <= S.h * 1.15 ? 'pistonShot' : shotFor(flowNow.chapter, step, S.w > S.h * 1.15);
    const aim = frameView(SHOTS[shot], S.w, S.h, opening ? 0.34 : 0);
    if (opening) {
      // The opening shot: the camera drifts in on the bench and settles.
      S.opening = Math.min(1, S.opening + dt / 2.6);
      const wide = SHOTS.wideShot, k = RM ? 0 : (1 - smooth(S.opening)) * 0.16, grow = { x0: wide.x0 - 780 * k / 2, x1: wide.x1 + 780 * k / 2, y0: wide.y0 - 582 * k, y1: wide.y1 };
      S.view = frameView(grow, S.w, S.h, 0.34);
    } else S.view = S.view ? easeView(S.view, aim, ease(S.show ? 0.9 : 0.42)) : aim;
    const view = S.view!;

    // The ProofLens.
    const L = S.lens, lensR = Math.max(54, Math.min(96, Math.min(S.w, S.h) * 0.15)), mag = Math.max(1.12, Math.min(2.3, 1.95 / view.s));
    if (L.out) {
      const homeAt = toScreen(view, PUCK);
      if (!L.held) { L.idle += dt; if (!L.home && L.idle > L.stay && step !== 'lookIn') L.home = true; if (!L.home && L.idle > Math.max(L.stay, 6)) L.home = true; }
      if (L.trail && !L.held && !L.home) { const a = anchorsAt(S.theta, { flower: S.flower >= 1, beads: S.beads >= 1 }).find(x => x.part === L.trail); if (a) { const p = toScreen(view, a); L.tx = p.x; L.ty = p.y; } }
      if (L.home) { L.tx = homeAt.x; L.ty = homeAt.y; }
      const k = L.held ? ease(0.035) : ease(0.11); L.x += (L.tx - L.x) * k; L.y += (L.ty - L.y) * k;
      L.grow += ((L.home ? 0 : 1) - L.grow) * ease(0.1);
      if (L.home && Math.hypot(L.x - homeAt.x, L.y - homeAt.y) < 10 && L.grow < 0.14) { L.out = false; L.home = false; L.cand = null; L.named = null; setTag(null); }
      else if (!L.home) {
        const at = toWorld(view, L.x, L.y), part = nearestPart(at, anchorsAt(S.theta, { flower: S.flower >= 1, beads: S.beads >= 1 }), lensR / (view.s * mag) * 0.78);
        if (part !== L.cand) { L.cand = part; L.dwell = 0; if (!part) { L.named = null; setTag(null); } }
        else if (part && L.named !== part) {
          L.dwell += dt;
          if (L.dwell >= LENS_DWELL) {
            L.named = part; const fresh = !flowRef.current.met.includes(part);
            setTag({ part, fresh });
            if (fresh) { const n = flowRef.current.met.length; play.current?.place(n); buzz(); fx.current?.burst(L.x / S.w, (L.y - lensR) / S.h, 'sparkle', { count: 8, size: 0.7 }); dispatch({ type: 'met', part }); }
            else play.current?.tap();
          }
        }
        L.lit += ((part ? 1 : 0) - L.lit) * ease(0.12);
      }
    }

    // A part in the air.
    const carry = S.carry;
    if (carry && carry.mode !== 'inHand') {
      const to = carry.mode === 'fly' ? SOCKET[carry.kind] : CRATE_SLOT[carry.kind];
      carry.t += dt / (RM ? 0.01 : carry.mode === 'fly' ? 0.8 : 0.34); const p = smooth(carry.t);
      carry.x = lerp(carry.fromX, to.x, p); carry.y = lerp(carry.fromY, to.y, p) - (carry.mode === 'fly' ? Math.sin(p * Math.PI) * 54 : 0); carry.tilt = Math.sin(p * Math.PI) * (carry.mode === 'fly' ? -0.35 : 0.2);
      if (carry.t >= 1) { if (carry.mode === 'fly') placePart(carry.kind); else S.carry = null; }
    }

    // AnchorCheck's test.
    const tool = S.tool, joint = jointAt(S.theta);
    if (S.test) {
      const T = S.test; T.t += dt;
      tool.show += (1 - tool.show) * ease(0.12); tool.clamp = clamp01((T.t - 0.55) / 0.9); S.tape += ((T.t > 0.9 ? 1 : 0) - S.tape) * ease(0.16);
      if (T.stage === 0 && T.t > 0.55) { T.stage = 1; [0, 2, 4].forEach((n, i) => later(() => crank.current?.note(n), i * 110)); buzz(); }
      if (T.stage === 1 && T.t > 1.5) { T.stage = 2; S.guide = TAU; }
      if (T.stage === 2 && S.guide <= 0) {
        T.stage = 3; T.end = T.t; crank.current?.chime('earned'); fxAt(joint, 'ring', { tones: ['studio-teal'] }); fxAt(joint, 'sparkle', { count: 10 }); say(words.current.holds, 2600); dispatch({ type: 'tested' });
      }
      if (T.stage === 3 && T.t > T.end + 1.5) { S.test = null; S.revealTo[0] = 0; }
    } else { tool.show += (0 - tool.show) * ease(0.1); tool.clamp = 0; S.tape += (0 - S.tape) * ease(0.1); }

    // Brass catches the daylight now and then, by itself.
    S.glint -= dt;
    if (S.glint <= 0 && !RM && !opening) { S.glint = 1.6 + Math.random() * 2.2; const a = Math.random() * TAU; fxAt(Math.random() < 0.6 ? { x: WHEEL.x + Math.sin(a) * WHEEL.r * 0.9, y: WHEEL.y - Math.abs(Math.cos(a)) * WHEEL.r * 0.9 } : knobAt(S.theta), 'glint', { count: 1, size: 0.5 }); }

    // Paint.
    const lookCue = step === 'lookIn' && !L.out, scene: Scene = {
      theta: S.theta, omega: S.omega, time: S.time, plan, room: roomRect(view, S.w, S.h), flower: S.flower, beads: S.beads, bell: S.bell,
      waiting: PART_KINDS.filter(kind => !(kind === 'flowerPart' ? built.flower : kind === 'beadsPart' ? built.beads : built.bell) && carry?.kind !== kind),
      ask: step === 'pickUp' && !carry ? PART_OF[flowNow.chapter] ?? null : null,
      carry: carry ? { kind: carry.kind, x: carry.x, y: carry.y, tilt: carry.tilt } : null,
      reveal: S.reveal, bellSwing: S.bellSwing, beadPop: S.beadPop, bloomPop: S.bloomPop, knobPop: S.knobPop,
      chock: { hop: C.y, squash: C.squash, lean: C.lean, dx: smooth(C.enter) * 230 },
      tool: tool.show > 0.02 ? { x: joint.x - (1 - smooth(tool.show)) * 70, y: joint.y + (1 - smooth(tool.show)) * 60, show: tool.show, clamp: tool.clamp } : null,
      tape: S.tape, held: !!dragging, jointCue: step === 'testJoint' && !S.test ? 1 : 0, puckCue: lookCue ? 1 : 0, lensOut: L.out, podOn: S.pod,
      wheelCue: !opening && step === 'turnIt' && !dragging && !S.show && Math.abs(S.omega) < 0.6 ? 1 : 0, wheelFocus: !S.show && document.activeElement === wheelHandle.current,
    };
    const c = node.getContext('2d'); if (!c) return;
    const d = S.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, node.width, node.height);
    c.setTransform(d * view.s, 0, 0, d * view.s, d * view.ox, d * view.oy); paintScene(c, P, images.current, scene);
    c.setTransform(d, 0, 0, d, 0, 0);
    if (S.demo) { const at = toScreen(view, handleAt(S.theta)), t = S.demo.t; paintHint(c, P, at.x + 5, at.y + 7, clamp01((t - 0.45) / 0.2) * clamp01((2 - t) / 0.2), clamp01(t / 0.35) * clamp01((2.4 - t) / 0.35)); }
    if (L.out && L.grow > 0.03) {
      // The same world, painted again with every housing clear, larger, in the lens's own glass.
      const inner = Math.ceil(lensR * 0.86), size = Math.ceil(inner * 2 * d);
      const pane = glass.current ?? (glass.current = document.createElement('canvas'));
      if (pane.width !== size) { pane.width = size; pane.height = size; }
      const gc = pane.getContext('2d'), at = toWorld(view, L.x, L.y), zoom = view.s * mag;
      if (gc) { gc.setTransform(d * zoom, 0, 0, d * zoom, d * (inner - at.x * zoom), d * (inner - at.y * zoom)); paintScene(gc, P, images.current, { ...scene, reveal: [1, 1, 1], carry: null, tool: null, puckCue: 0, wheelCue: 0, jointCue: 0, wheelFocus: false }); }
      paintLens(c, P, L.x, L.y, lensR, gc ? pane : null, L.lit, S.time, lerp(0.42, 1, clamp01(L.grow)));
    }

    // The keyboard handles and the lens's tag sit exactly over their things.
    const put = (el: HTMLElement | null, p: Point, size: number) => { if (!el) return; el.style.translate = `${(p.x - size / 2).toFixed(1)}px ${(p.y - size / 2).toFixed(1)}px`; el.style.inlineSize = `${size.toFixed(0)}px`; el.style.blockSize = `${size.toFixed(0)}px`; };
    put(wheelHandle.current, toScreen(view, WHEEL), WHEEL.r * 2 * view.s);
    put(lensHandle.current, L.out ? { x: L.x, y: L.y } : toScreen(view, PUCK), L.out ? lensR * 2 : 56);
    if (scene.ask) put(partHandle.current, toScreen(view, CRATE_SLOT[scene.ask]), 56);
    if (tagEl.current && L.out) {
      const el = tagEl.current, tw = el.offsetWidth, th = el.offsetHeight;
      let x = L.x - tw / 2, y = L.y + lensR + 12;
      // Under the lens where there is room; on a short stage beside it; otherwise above.
      if (y + th > S.h - 112) { if (S.h < 430) { x = L.x + lensR + 12 + tw < S.w - 8 ? L.x + lensR + 12 : L.x - lensR - 12 - tw; y = L.y - th / 2; } else y = L.y - lensR - 12 - th; }
      el.style.translate = `${Math.max(8, Math.min(S.w - tw - 8, x)).toFixed(1)}px ${Math.max(8, Math.min(S.h - th - 8, y)).toFixed(1)}px`;
    }
    const nowDeg = Math.round(wrapAngle(S.theta) * 180 / Math.PI / 15) * 15 % 360;
    if (nowDeg !== degSeen.current && Math.abs(S.omega) < 0.2) { degSeen.current = nowDeg; setDeg(nowDeg); }
  }, [bump, buzz, dispatch, fxAt, hop, later, moved, placePart, plan, say]);

  /* --------------------------------------------------------- life cycle */
  useEffect(() => {
    const node = world.current, cv = canvas.current; if (!node || !cv) return;
    palette.current = readPalette(node);
    const S = sim.current;
    const measure = () => {
      const wide = node.clientWidth, tall = node.clientHeight; if (!wide || !tall) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      S.w = wide; S.h = tall; S.dpr = dpr; cv.width = Math.round(wide * dpr); cv.height = Math.round(tall * dpr);
      // A new shape is a cut, not a glide.
      S.view = frameView(SHOTS[phaseRef.current === 'opening' ? 'wideShot' : shotFor(flowRef.current.chapter, stepOf(flowRef.current), wide > tall * 1.15)], wide, tall, phaseRef.current === 'opening' ? 0.34 : 0);
    };
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(node); window.addEventListener('resize', measure);
    const load = (key: keyof PaintImages, src: string) => { const im = new Image(); im.decoding = 'async'; im.onload = () => { images.current[key] = im; }; im.src = src; };
    load('roomImg', KIT_ROOM.src); load('bench', KIT_BENCH.src); load('chock', KIT_CHOCK.src); load('tool', KIT_ANCHORCHECK.src);
    const crankSound = createCrankSound(), playSound = createPlaySound({ key: 'C' }); crank.current = crankSound; play.current = playSound;
    const pending = timers.current;
    const hidden = () => {
      if (document.visibilityState === 'hidden') { S.omega = 0; S.pod = false; S.loose = false; S.calm = 0; grab.current = null; crankSound.stop(); if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; last.current = 0; }
      else if (!raf.current) raf.current = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', hidden);
    raf.current = requestAnimationFrame(frame);
    return () => {
      document.removeEventListener('visibilitychange', hidden); window.removeEventListener('resize', measure); watch?.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0; last.current = 0;
      for (const t of pending) clearTimeout(t); pending.clear();
      crankSound.dispose(); playSound.dispose(); crank.current = null; play.current = null;
    };
  }, [frame]);

  /* -------------------------------------------------------------- input */
  const stir = () => {
    const S = sim.current; S.idle = 0; setNudge(false);
    if (S.demo) { S.demo = null; S.loose = true; S.looseHand = false; }
    if (!bedOn.current) bedOn.current = !!play.current?.ambience(PLAY_AMBIENCE.room);
  };
  const local = (e: { clientX: number; clientY: number }) => { const box = world.current!.getBoundingClientRect(); return { x: e.clientX - box.left, y: e.clientY - box.top }; };
  const lensFree = flow.chapter !== 'pistonCh' || flow.step >= 1;
  const busy = () => phaseRef.current !== 'playing' || !!sim.current.show;
  /** AnchorCheck holds the wheel only while it is testing; once it has its answer the child is free again. */
  const testing = () => { const T = sim.current.test; return !!T && T.stage < 3; };
  const handTakesOver = () => { const S = sim.current; S.pod = false; S.motor = 0; S.calm = 0; S.demo = null; };
  const takeLens = () => {
    const S = sim.current, L = S.lens; if (!S.view) return;
    if (!L.out) { const at = toScreen(S.view, PUCK); L.out = true; L.x = at.x; L.y = at.y; L.tx = at.x; L.ty = at.y; L.grow = 0.1; L.cand = null; L.named = null; L.dwell = 0; play.current?.pick(); buzz(); }
    L.home = false; L.idle = 0; L.trail = null;
  };
  const turn = () => {
    const S = sim.current; if (busy() || testing()) return;
    stir(); buzz();
    const pending = S.calm, spinning = S.loose ? S.omega : 0; handTakesOver();
    if (reducedRef.current) S.calm = Math.min(TAU, pending + CALM_PUSH); else { S.omega = push(spinning); S.loose = true; S.looseHand = true; }
  };
  const lookNext = () => {
    const S = sim.current; if (busy() || testing() || !lensFree || !S.view) return;
    stir();
    const left = partsLeft(flowRef.current), want = left[0] ?? LENS_PARTS[flowRef.current.chapter][0] ?? 'rodBar';
    takeLens(); S.lens.trail = want; S.lens.stay = 3.2; S.lens.cand = null; S.lens.named = null;
  };
  const testJoint = () => {
    const S = sim.current; if (busy() || S.test || stepOf(flowRef.current) !== 'testJoint') return;
    stir(); buzz(); handTakesOver(); S.omega = 0; S.loose = false; S.lens.home = true;
    S.test = { t: 0, stage: 0, end: 0 }; play.current?.pick();
  };
  const poke = (hit: string) => {
    const S = sim.current, W = words.current; buzz();
    if (hit === 'knobHit') { S.knobPop = 1; crank.current?.toy('boing'); fxAt(knobAt(S.theta), 'glint', { count: 2, size: 0.6 }); }
    else if (hit === 'bloomHit') { S.bloomPop = 1; crank.current?.toy('giggle'); fxAt(stemTop(S.theta), 'petal', { tones: BLOOM_TONES[plan.bloom], count: 6, size: 0.8 }); }
    else if (hit === 'bellHit') { crank.current?.bell(); S.bellVel += 6; fxAt({ x: BELL.x, y: BELL.y + 16 }, 'ring', { tones: ['gold-light'], size: 0.7 }); hop(0.7); }
    else if (hit === 'chockHit') { hop(1.2); crank.current?.toy('woof'); say(W.woof, 1100); }
    else if (hit === 'podHit') { S.pod = !S.pod; S.calm = 0; S.loose = !S.pod; S.looseHand = false; if (S.pod) S.motor = Math.max(0, S.omega); crank.current?.toy('pod'); say(S.pod ? W.podOn : W.podOff, 2200); fxAt({ x: 339, y: 262 }, 'ring', { tones: ['sea'], size: 0.6 }); }
    else if (hit === 'puckHit') { crank.current?.toy('peek'); fxAt(PUCK, 'glint', { count: 2, size: 0.6 }); }
    else { play.current?.back(); say(W.notYet, 1400); }
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const S = sim.current; if (busy() || !S.view || grab.current) return;
    stir();
    const at = local(e), L = S.lens, lensR = Math.max(54, Math.min(96, Math.min(S.w, S.h) * 0.15)), touch = e.pointerType === 'touch';
    const base: Grab = { kind: 'wheel', id: e.pointerId, x0: at.x, y0: at.y, active: false, angle: 0, dx: 0, dy: 0, part: null };
    const hold = (g: Grab) => { grab.current = g; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ } };
    if (testing()) return;
    if (L.out && !L.home && Math.hypot(at.x - L.x, at.y - L.y) <= lensR + 8) { L.held = true; L.trail = null; hold({ ...base, kind: 'lensGrab', active: true, dx: L.x - at.x, dy: L.y - at.y }); setGrabbing('lens'); return; }
    const p = toWorld(S.view, at.x, at.y), built = builtOf(flowRef.current), ask = stepOf(flowRef.current) === 'pickUp' ? PART_OF[flowRef.current.chapter] : null;
    const waiting = PART_KINDS.filter(kind => !(kind === 'flowerPart' ? built.flower : kind === 'beadsPart' ? built.beads : built.bell));
    if (stepOf(flowRef.current) === 'testJoint' && Math.hypot(p.x - jointAt(S.theta).x, p.y - jointAt(S.theta).y) < 26) { testJoint(); return; }
    const hit = hitAt(p, S.theta, waiting, { flower: S.flower >= 1, bell: S.bell >= 1 });
    if (hit === 'flowerPart' || hit === 'beadsPart' || hit === 'bellPart') { if (hit === ask && !S.carry) hold({ ...base, kind: 'partGrab', part: hit }); else if (hit !== ask) poke('soon'); return; }
    if (hit === 'wheelHit' && stepOf(flowRef.current) !== 'testJoint') { hold({ ...base, angle: pointerAngle(p.x - WHEEL.x, p.y - WHEEL.y) }); return; }
    if (hit === 'puckHit' && lensFree) { takeLens(); L.held = true; hold({ ...base, kind: 'lensGrab', active: true, dx: 0, dy: touch ? -lensR * 0.9 : 0 }); L.tx = at.x; L.ty = at.y + (touch ? -lensR * 0.9 : 0); setGrabbing('lens'); return; }
    if (hit) { poke(hit); return; }
    if (lensFree && p.y < 250 && p.x > 150 && p.x < 540) hold({ ...base, kind: 'tapLook' });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grab.current, S = sim.current; if (!g || g.id !== e.pointerId || !S.view) return;
    const at = local(e), far = Math.hypot(at.x - g.x0, at.y - g.y0) > 6; S.idle = 0;
    if (g.kind === 'lensGrab') { S.lens.tx = at.x + g.dx; S.lens.ty = at.y + g.dy; S.lens.idle = 0; return; }
    const p = toWorld(S.view, at.x, at.y);
    if (g.kind === 'partGrab' && g.part) {
      if (!g.active) { if (!far) return; g.active = true; S.carry = { kind: g.part, mode: 'inHand', x: p.x, y: p.y, tilt: 0, t: 0, fromX: p.x, fromY: p.y }; play.current?.pick(); buzz(); setGrabbing('part'); }
      const carry = S.carry; if (!carry) return;
      const lift = e.pointerType === 'touch' ? 34 / S.view.s : 6; carry.tilt = Math.max(-0.4, Math.min(0.4, (p.x - carry.x) * 0.05)); carry.x = p.x; carry.y = p.y - lift; return;
    }
    if (g.kind !== 'wheel') return;
    if (!g.active) { if (!far) return; g.active = true; handTakesOver(); S.loose = false; S.target = S.theta; samples.current = []; buzz(); setGrabbing('wheel'); }
    const dx = p.x - WHEEL.x, dy = p.y - WHEEL.y; if (Math.hypot(dx, dy) < 9) return; // too near the shaft to tell which way
    const angle = pointerAngle(dx, dy); S.target += angleDelta(g.angle, angle); g.angle = angle;
    // The wheel has weight: the finger may lead it, but never by more than a third of a turn.
    S.target = Math.max(S.theta - TAU / 3, Math.min(S.theta + TAU / 3, S.target));
  };
  const endGrab = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = grab.current, S = sim.current; if (!g || g.id !== e.pointerId) return;
    grab.current = null; setGrabbing(null);
    if (g.kind === 'lensGrab') { S.lens.held = false; S.lens.idle = 0; S.lens.stay = 1.8; return; }
    if (g.kind === 'partGrab' && g.part) {
      const carry = S.carry;
      if (!g.active) { if (!cancelled) flyPart(g.part); return; }
      if (!carry) return;
      const home = SOCKET[g.part];
      if (!cancelled && Math.hypot(carry.x - home.x, carry.y - home.y) <= SOCKET_REACH) { carry.mode = 'fly'; carry.t = 0.72; carry.fromX = carry.x; carry.fromY = carry.y; }
      else { carry.mode = 'goBack'; carry.t = 0; carry.fromX = carry.x; carry.fromY = carry.y; play.current?.back(); }
      return;
    }
    if (g.kind === 'tapLook') { if (cancelled) return; const at = local(e); takeLens(); S.lens.tx = at.x; S.lens.ty = at.y; S.lens.stay = 3; return; }
    if (g.active) { S.omega = cancelled || reducedRef.current ? 0 : releaseSpeed(samples.current, performance.now()); S.loose = !reducedRef.current; S.looseHand = true; return; }
    if (!cancelled) turn();
  };
  const onWheelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const S = sim.current; if (busy() || testing()) return;
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (dir) { e.preventDefault(); stir(); handTakesOver(); S.omega = 0; S.loose = false; const from = S.theta; S.theta += dir * KEY_STEP; moved(from, S.theta, 'hand'); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(); }
  };
  const onLensKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const S = sim.current; if (busy() || !lensFree) return;
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0, dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!dx && !dy) return;
    e.preventDefault(); stir(); takeLens(); S.lens.tx = Math.max(40, Math.min(S.w - 40, S.lens.tx + dx * 18)); S.lens.ty = Math.max(60, Math.min(S.h - 60, S.lens.ty + dy * 18)); S.lens.stay = 4;
  };

  /* ------------------------------------------------------------- render */
  const step = stepOf(flow), doneMap = chaptersDone(flow), ask = step === 'pickUp' ? PART_OF[flow.chapter] ?? null : null;
  const opening = phase === 'opening';
  const metHere = LENS_PARTS[flow.chapter].filter(p => flow.met.includes(p)).length;
  const cues = w.cues[flow.chapter] as Record<string, string>;
  const line = opening ? w.hello : cheer ?? (step === 'lookIn' && metHere > 0 ? w.more : cues[step]);
  const mood: CoachMood = showing ? 'wow' : cheer ? 'happy' : step === 'lookIn' || step === 'testJoint' ? 'curious' : 'idle';
  const icons = { pistonCh: <Cog />, flowerCh: <Flower2 />, waveCh: <AudioWaveform />, finaleCh: <Bell /> };
  const partWords = tag ? w.parts[tag.part] : null;

  return <PlayStage id="crank-works" grade="day" shake={shake} setPiece={showing} world={
    <div ref={world} className="ck-world" dir="ltr" data-grab={grabbing ?? undefined} data-crank-chapter={flow.chapter} data-crank-step={step} data-crank-phase={phase} role="group" aria-label={w.stage}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => endGrab(e, false)} onPointerCancel={e => endGrab(e, true)} onKeyDownCapture={stir}>
      <canvas ref={canvas} className="ck-canvas" aria-hidden="true" />
      <PlayFx ref={fx} layer={3} />
      <div ref={wheelHandle} className="ck-handle" data-kind="wheel" data-crank-wheel="" role="slider" tabIndex={opening || showing ? -1 : 0} aria-label={w.wheelLabel} aria-valuemin={0} aria-valuemax={359} aria-valuenow={deg}
        aria-valuetext={w.strokes[strokePlace(deg * Math.PI / 180)]} onKeyDown={onWheelKey} />
      {lensFree && !showing && <button ref={lensHandle} type="button" className="ck-handle" data-kind="lens" data-crank-lens="" aria-label={w.lensLabel} onClick={lookNext} onKeyDown={onLensKey} />}
      {ask && !showing && <button ref={partHandle} type="button" className="ck-handle" data-kind="part" data-crank-part={ask} aria-label={w.pick[ask]} onClick={() => { stir(); flyPart(ask); }} />}
    </div>}>
    <HudCoach who={KIT_COMPANION} mood={mood} line={line} onPoke={() => { stir(); poke('chockHit'); }} pokeLabel={w.chockLabel} />
    <HudQuest label={w.questLabel} current={CHAPTERS.indexOf(flow.chapter)} steps={CHAPTERS.map(ch => ({ key: ch, label: w.chapters[ch], done: doneMap[ch], icon: icons[ch] }))} />
    <HudToast show={!!toast && !showing}>{toast}</HudToast>
    {/* The tag follows the lens across the picture, so it is placed in the picture's own (unmirrored) space. */}
    <div className="ck-tagbox" dir="ltr"><div ref={tagEl} className="ck-tag" data-show={!!tag && !showing} data-new={!!tag?.fresh}><p dir={lang === 'he' ? 'rtl' : 'ltr'} aria-live="polite">{partWords && <><strong>{partWords.name}</strong>{partWords.line}</>}</p></div></div>
    <HudDock label={w.dock}>
      {!opening && (step === 'turnIt' || step === 'lookIn' || step === 'pickUp') && <HudButton label={w.turn} icon={<RotateCw />} tone={step === 'turnIt' ? 'go' : 'paper'} size={step === 'turnIt' ? 'l' : 'm'} cue={nudge && step === 'turnIt'} onClick={turn} data={{ 'data-crank-turn': '' }} />}
      {!opening && step === 'lookIn' && <HudButton label={w.look} icon={<Eye />} tone="go" size="l" cue={nudge} onClick={lookNext} data={{ 'data-crank-look': '' }} />}
      {!opening && step === 'testJoint' && <HudButton label={w.test} icon={<Wrench />} tone="go" size="l" cue={nudge} onClick={testJoint} data={{ 'data-crank-test': '' }} />}
      {!opening && ask && <HudButton label={w.placeIt[ask]} icon={<Hand />} tone="go" size="l" cue={nudge} onClick={() => { stir(); flyPart(ask); }} data={{ 'data-crank-place': '' }} />}
    </HudDock>
    {opening && <PlayOpening title={w.title} place={w.place} onDone={() => { sim.current.idle = 0; setPhase('playing'); }} />}
    <PlaySetPiece active={showing} caption={w.caption} />
  </PlayStage>;
}
