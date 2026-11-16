import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Bird, Check, Cog, Eye, EyeOff, Hand, Pause, Play, RotateCw, Spline, Tag } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { CRANK_WORKS_COPY } from './crankWorksCopy';
import {
  CALM_PUSH, HAND_TURN_GOAL, KEY_STEP, MACHINES, MACHINE_PARTS, SPEEDS, SPEED_OMEGA, START, TAU, TRACE_BINS,
  angleDelta, badgesOf, canFinish, canSelect, carrySelection, coast, cueFor, easeMotor, lookedInside, metPart, pointerAngle,
  push, releaseSpeed, sawMachine, strokePlace, sweepBins, topCentresCrossed, turnedByHand, wrapAngle,
  type Explore, type MachineId, type PartId, type Speed, type TurnSample,
} from './crankWorksRules';
import { CrankDefs, EngineArt, SX, SY, ToyArt, VIEW_H, VIEW_W, VIEW_X, Workshop, poseOf, tagFor, BELL_LIP } from './crankArt';
import { createCrankSound, type CrankSound } from './crankAudio';
import '../makerPalette.css';
import './crankWorks.css';

type Lang = 'en' | 'he';
type Words = (typeof CRANK_WORKS_COPY)[Lang];
/** The wheel can be grabbed anywhere within this distance of the shaft. */
const GRAB_RADIUS = 104;
/** The case wipes open or shut in this long. */
const WIPE_S = 0.6;
/** Where the machine stands at the start: mid-stroke, the rod leaning. */
const START_THETA = 2.1;

export default function CrankWorks() {
  const { uiLang } = useLanguage(); const lang: Lang = uiLang === 'he' ? 'he' : 'en';
  const w = CRANK_WORKS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  return <GameShell fullBleed autoNarrate={false} worldId="crank-works" title={w.title} instruction={w.instruction}>
    <section className="adventure ck" data-adventure="crank-works" dir={lang === 'he' ? 'rtl' : 'ltr'} data-done={done}>
      {done
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setDone(false); setRun(n => n + 1); }} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <Bench key={run} lang={lang} w={w} onDone={() => setDone(true)} />}
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

function Bench({ lang, w, onDone }: { lang: Lang; w: Words; onDone: () => void }) {
  const id = useId().replace(/:/g, '');
  const reduced = useReducedMotion();
  const [machine, setMachine] = useState<MachineId>('engine');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [playing, setPlayingState] = useState(false);
  const [speed, setSpeedState] = useState<Speed>('slow');
  const [trace, setTrace] = useState(false);
  const [explore, setExplore] = useState<Explore>(START);
  const [wheelFocus, setWheelFocus] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [, setFrame] = useState(0);

  const svg = useRef<SVGSVGElement>(null);
  const theta = useRef(START_THETA);
  const omega = useRef(0);            // a hand's spin, coasting down
  const motor = useRef(0);            // the motor's present speed
  const calm = useRef(0);             // reduced motion: what is left of a gentle push
  const openP = useRef(0);
  const swingAge = useRef(9);
  const grab = useRef<Grab | null>(null);
  const samples = useRef<TurnSample[]>([]);
  const hand = useRef(0);
  const bins = useRef<boolean[]>(Array<boolean>(TRACE_BINS).fill(false));
  const span = useRef<[number, number] | null>(null);
  const raf = useRef(0), last = useRef(0);
  const sound = useRef<CrankSound | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live copies for the frame loop.
  const live = useRef({ playing, speed, open, machine, trace, reduced });
  live.current = { playing, speed, open, machine, trace, reduced };

  const setPlaying = (next: boolean) => { live.current.playing = next; setPlayingState(next); };
  const targetSpeed = () => SPEED_OMEGA[live.current.reduced ? 'slow' : live.current.speed];

  /** Every change of angle comes through here: ticks, the bell, the traces
   * and the hand's share of the turning. */
  const moved = useCallback((from: number, to: number, byHand: boolean) => {
    if (from === to) return;
    if (topCentresCrossed(from, to) > 0) {
      const pace = Math.min(1, Math.abs(live.current.playing ? motor.current : omega.current) / SPEED_OMEGA.quick);
      sound.current?.tick(pace);
      if (live.current.machine === 'toy') { sound.current?.bell(); swingAge.current = 0; }
    }
    if (live.current.trace) {
      bins.current = sweepBins(bins.current, from, to);
      const a = SY - poseOf(from).wristY, b = SY - poseOf(to).wristY;
      const [lo, hi] = span.current ?? [a, a];
      span.current = [Math.min(lo, a, b), Math.max(hi, a, b)];
    }
    if (byHand) {
      const before = hand.current;
      hand.current += Math.abs(to - from);
      if (before < HAND_TURN_GOAL - 1e-6 && hand.current >= HAND_TURN_GOAL - 1e-6) setExplore(e => turnedByHand(e, HAND_TURN_GOAL));
    }
  }, []);

  const step = useCallback((now: number) => {
    raf.current = 0;
    const dt = last.current ? Math.min(0.05, Math.max(0, (now - last.current) / 1000)) : 0;
    last.current = now;
    const from = theta.current;
    const dragging = !!grab.current?.active;
    if (!dragging) {
      if (live.current.playing) {
        motor.current = easeMotor(motor.current, targetSpeed(), dt);
        theta.current += motor.current * dt;
        moved(from, theta.current, false);
      } else if (calm.current > 0) {
        // The last sliver goes too, so four quarter pushes make one whole turn.
        const d = calm.current - SPEED_OMEGA.slow * dt < 1e-4 ? calm.current : SPEED_OMEGA.slow * dt;
        calm.current -= d; theta.current += d;
        if (calm.current <= 0) calm.current = 0;
        moved(from, theta.current, true);
      } else if (omega.current !== 0) {
        omega.current = coast(omega.current, dt);
        theta.current += omega.current * dt;
        moved(from, theta.current, true);
      }
    }
    const goal = live.current.open ? 1 : 0;
    if (openP.current !== goal) openP.current = live.current.reduced ? goal : goal > openP.current ? Math.min(1, openP.current + dt / WIPE_S) : Math.max(0, openP.current - dt / WIPE_S);
    if (swingAge.current < 9) swingAge.current += dt;
    // Keep theta small without moving the machine (a whole turn changes nothing).
    if (Math.abs(theta.current) > TAU * 1000) theta.current = wrapAngle(theta.current);
    setFrame(f => (f + 1) % 1e6);
    const busy = dragging || live.current.playing || calm.current > 0 || omega.current !== 0 || openP.current !== goal || swingAge.current < 1.6;
    if (busy) { raf.current = requestAnimationFrame(step); } else last.current = 0;
  }, [moved]);
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(step); }, [step]);

  /** Everything stops: the motor, any spin, any push. The angle stays exactly where it is. */
  const freeze = useCallback(() => {
    live.current.playing = false; setPlayingState(false);
    motor.current = 0; omega.current = 0; calm.current = 0; swingAge.current = 9;
    if (grab.current) grab.current.active = false;
    grab.current = null;
    kick();
  }, [kick]);

  useEffect(() => {
    const instance = createCrankSound(); sound.current = instance;
    const hidden = () => { if (document.visibilityState === 'hidden') { freeze(); instance.stop(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
      instance.dispose(); sound.current = null;
    };
  }, [freeze]);
  useEffect(() => { kick(); }, [open, reduced, kick]);

  /* ------------------------------------------------------------- input */
  const toSvg = (clientX: number, clientY: number) => {
    const node = svg.current, ctm = node?.getScreenCTM();
    if (!node || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x - SX, y: p.y - SY };
  };
  const handTakesOver = () => {
    if (live.current.playing) { live.current.playing = false; setPlayingState(false); }
    motor.current = 0; calm.current = 0;
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = toSvg(e.clientX, e.clientY); if (!p) return;
    const inWheel = Math.hypot(p.x, p.y) <= GRAB_RADIUS;
    grab.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, angle: pointerAngle(p.x, p.y), inWheel, active: false, target: e.target as Element };
    if (inWheel) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ } }
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.active) {
      if (!g.inWheel || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return;
      g.active = true; handTakesOver(); omega.current = 0; samples.current = [];
      kick();
    }
    const p = toSvg(e.clientX, e.clientY);
    if (!p || Math.hypot(p.x, p.y) < 14) return; // too near the shaft to tell which way
    const angle = pointerAngle(p.x, p.y), from = theta.current;
    theta.current += angleDelta(g.angle, angle); g.angle = angle;
    moved(from, theta.current, true);
    const now = performance.now();
    samples.current = [...samples.current.filter(s => now - s.t < 200), { t: now, theta: theta.current }];
  };
  const endGrab = (e: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    grab.current = null;
    if (g.active) {
      omega.current = cancelled || live.current.reduced ? 0 : releaseSpeed(samples.current, performance.now());
      kick(); return;
    }
    if (!cancelled) tap(g.target);
  };
  const tap = (target: Element | null) => {
    const part = target?.closest?.('[data-crank-part]')?.getAttribute('data-crank-part') as PartId | null | undefined;
    if (!live.current.open) {
      if (part) { setNudge(true); if (nudgeTimer.current) clearTimeout(nudgeTimer.current); nudgeTimer.current = setTimeout(() => setNudge(false), 1400); }
      return;
    }
    if (canSelect(machine, part, true)) choose(part); else if (!part) setSelected(null);
  };
  const choose = (part: PartId) => {
    void selectionHaptic();
    if (part !== selected) { bins.current = Array<boolean>(TRACE_BINS).fill(false); span.current = null; }
    setSelected(part); setExplore(e => metPart(e, part));
  };
  const onWheelKey = (e: KeyboardEvent<SVGGElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (dir) {
      e.preventDefault(); handTakesOver(); omega.current = 0;
      const from = theta.current; theta.current += dir * KEY_STEP;
      moved(from, theta.current, true); kick(); return;
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); turn(); }
  };
  const turn = () => {
    void selectionHaptic();
    // The hand takes over from the motor; pushes in a row add up.
    const pending = calm.current; handTakesOver();
    if (live.current.reduced) calm.current = Math.min(TAU, pending + CALM_PUSH);
    else omega.current = push(omega.current);
    kick();
  };
  const togglePlay = () => {
    if (live.current.playing) { freeze(); return; }
    motor.current = Math.max(0, omega.current); omega.current = 0; calm.current = 0;
    setPlaying(true); kick();
  };
  const chooseSpeed = (next: Speed) => { live.current.speed = next; setSpeedState(next); kick(); };
  const toggleOpen = () => {
    const next = !open;
    live.current.open = next; setOpen(next); setNudge(false);
    if (next) setExplore(lookedInside);
    else { setSelected(null); setTrace(false); }
    kick();
  };
  const chooseMachine = (next: MachineId) => {
    if (next === machine) return;
    live.current.machine = next; setMachine(next);
    setSelected(s => carrySelection(s, next)); setExplore(e => sawMachine(e, next));
  };
  const toggleTrace = () => {
    bins.current = Array<boolean>(TRACE_BINS).fill(false); span.current = null;
    live.current.trace = !trace; setTrace(t => !t);
  };

  /* ------------------------------------------------------------- render */
  const pose = poseOf(theta.current);
  const openNow = openP.current;
  const badges = badgesOf(explore);
  const finished = canFinish(explore);
  const cue = w.cues[cueFor(explore, open, machine)][machine];
  const age = swingAge.current;
  const swing = reduced || age > 1.6 ? 0 : 10 * Math.exp(-age * 3) * Math.sin(age * 20);
  const parts = MACHINE_PARTS[machine];
  const partWords = (part: PartId) => (w.parts[machine] as Record<string, { name: string; line: string }>)[part];
  const shown = selected && open ? selected : null;
  const placeWords = w.place[machine][strokePlace(theta.current)];
  const deg = Math.round(wrapAngle(theta.current) * 180 / Math.PI) % 360;

  return <div className="ck-bench" data-machine={machine} data-open={open} data-playing={playing}>
    <div className="adventure-toolbar ck-bar">
      <div className="ck-switch" role="group" aria-label={w.machineGroup}>
        {MACHINES.map(m => <button type="button" key={m} data-crank-machine={m} aria-pressed={machine === m} onClick={() => chooseMachine(m)}>
          {m === 'engine' ? <Cog size={18} aria-hidden="true" /> : <Bird size={18} aria-hidden="true" />}<span>{w.machines[m]}</span>
        </button>)}
      </div>
      {finished
        ? <button type="button" className="ck-done" data-crank-done="" onClick={() => { freeze(); onDone(); }}><Check size={20} aria-hidden="true" />{w.done}</button>
        : <ul className="ck-badges" aria-label={w.badgesGroup}>
        {(['turned', 'inside', 'parts'] as const).map(b => {
          const Icon = b === 'turned' ? Hand : b === 'inside' ? Eye : Tag;
          return <li key={b} className="ck-badge" data-lit={badges[b]} data-crank-badge={b} aria-label={`${w.badges[b]}: ${badges[b] ? w.badgeLit : w.badgeDim}`}>
            <span className="ck-badge__medal" aria-hidden="true"><Icon size={18} /></span><span className="ck-badge__name" aria-hidden="true">{w.badges[b]}</span>
          </li>;
        })}
      </ul>}
    </div>
    {/* The heading never takes focus: a child turning the wheel by keyboard
        keeps it. The words are announced politely instead. */}
    <AdventureHeading focusKey="crank-works"><span aria-live="polite" className={shown ? 'ck-said' : undefined}>{shown
      ? <><strong>{partWords(shown).name}.</strong> {partWords(shown).line}</>
      : cue}</span></AdventureHeading>

    <div className="ck-stage">
      <svg ref={svg} className="ck-svg" viewBox={`${VIEW_X} 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMax meet" role="group" aria-label={w.stage[machine]}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => endGrab(e, false)} onPointerCancel={e => endGrab(e, true)}>
        <CrankDefs id={id} />
        <Workshop id={id} />
        <g role="slider" tabIndex={0} aria-label={w.wheelLabel[machine]} aria-valuemin={0} aria-valuemax={359} aria-valuenow={deg} aria-valuetext={placeWords}
          onKeyDown={onWheelKey} onFocus={() => setWheelFocus(true)} onBlur={() => setWheelFocus(false)} className="ck-wheel-focus">
          <circle data-crank-wheel="" cx={SX} cy={SY} r={GRAB_RADIUS} className="ck-grab" />
        </g>
        {machine === 'engine'
          ? <EngineArt id={id} pose={pose} open={openNow} selected={shown} />
          : <ToyArt id={id} pose={pose} open={openNow} selected={shown} swing={swing} />}
        {machine === 'toy' && reduced && age < 0.5 && <circle cx={BELL_LIP.x + 8} cy={BELL_LIP.y - 12} r="22" className="ck-ring" style={{ opacity: 1 - age * 2 }} />}
        {shown && trace && <Traces pose={pose} bins={bins.current} span={span.current} />}
        {shown && <PartTag part={shown} pose={pose} name={partWords(shown).name} lang={lang} />}
        {wheelFocus && <circle cx={SX} cy={SY} r={GRAB_RADIUS - 2} className="ck-focus-ring" />}
      </svg>
    </div>

    <div className="ck-parts" data-open={open}>
      {open
        ? <div className="ck-chips" key={machine} role="group" aria-label={w.partsGroup}>
          {parts.map(p => <button type="button" key={p} className="ck-chip" data-crank-chip={p} data-part={`${machine}-${p}`} aria-pressed={selected === p} data-met={explore.met.includes(p)} onClick={() => choose(p)}>
            <i aria-hidden="true" />{partWords(p).name}{explore.met.includes(p) && <Check size={14} aria-hidden="true" className="ck-chip__met" />}
          </button>)}
        </div>
        : <p className="ck-closed">{w.closedNote}</p>}
    </div>

    <div className="adventure-actions ck-controls">
      <button type="button" className="ck-btn" data-crank-turn="" onClick={turn}><RotateCw size={20} aria-hidden="true" />{w.turn}</button>
      <button type="button" className="ck-btn" data-crank-play="" aria-pressed={playing} onClick={togglePlay}>{playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}{playing ? w.pause : w.play}</button>
      <button type="button" className="ck-btn" data-crank-inside="" aria-pressed={open} data-nudge={nudge} onClick={toggleOpen}>{open ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}{open ? w.close : w.inside}</button>
    </div>
    <div className="ck-row">
      {!reduced && <div className="ck-lever" role="group" aria-label={w.speed} data-speed={speed}>
        <span className="ck-lever__slot" aria-hidden="true"><span className="ck-lever__knob" /></span>
        {SPEEDS.map(s => <button type="button" key={s} data-crank-speed={s} aria-pressed={speed === s} onClick={() => chooseSpeed(s)}>{w.speeds[s]}</button>)}
      </div>}
      {shown && <button type="button" className="ck-btn ck-paths" data-crank-trace="" aria-pressed={trace} aria-label={trace ? w.hidePaths : w.paths} title={trace ? w.hidePaths : w.paths} onClick={toggleTrace}><Spline size={20} aria-hidden="true" /><span className="ck-paths__label">{trace ? w.hidePaths : w.paths}</span></button>}
    </div>
  </div>;
}

/** The two motions side by side: the crank pin's circle and the piston's line,
 * drawn only where the parts have actually been since the paths were shown. */
function Traces({ pose, bins, span }: { pose: ReturnType<typeof poseOf>; bins: readonly boolean[]; span: readonly [number, number] | null }) {
  const r = Math.hypot(pose.pin.x - SX, pose.pin.y - SY);
  const step = 360 / TRACE_BINS;
  const point = (a: number) => { const rad = a * Math.PI / 180; return `${(SX + r * Math.sin(rad)).toFixed(2)} ${(SY - r * Math.cos(rad)).toFixed(2)}`; };
  let circle = '';
  bins.forEach((on, i) => { if (on) circle += `M${point(i * step)}A${r} ${r} 0 0 1 ${point((i + 1) * step)}`; });
  return <g className="ck-trace" aria-hidden="true">
    {circle && <path d={circle} className="ck-trace__circle" />}
    {span && <path d={`M${SX} ${SY - span[1]}V${SY - span[0]}M${SX - 7} ${SY - span[1]}h14M${SX - 7} ${SY - span[0]}h14`} className="ck-trace__line" />}
    <circle cx={pose.pin.x} cy={pose.pin.y} r="4.5" className="ck-trace__dot" />
    <circle cx={SX} cy={pose.wristY} r="4.5" className="ck-trace__dot ck-trace__dot--line" />
  </g>;
}

function PartTag({ part, pose, name, lang }: { part: PartId; pose: ReturnType<typeof poseOf>; name: string; lang: Lang }) {
  const { tag, at } = tagFor(part, pose);
  const width = Math.max(64, name.length * (lang === 'he' ? 9.4 : 9) + 28);
  const toward = at.x > tag.x ? 1 : -1;
  const sx = tag.x + toward * width / 2;
  return <g className="ck-tag" aria-hidden="true">
    <path d={`M${sx} ${tag.y}L${at.x} ${at.y}`} className="ck-tag__leader" />
    <circle cx={at.x} cy={at.y} r="5" className="ck-tag__dot" />
    <rect x={tag.x - width / 2 + 1.5} y={tag.y - 15} width={width} height="32" rx="11" className="ck-tag__shade" />
    <rect x={tag.x - width / 2} y={tag.y - 17} width={width} height="32" rx="11" className="ck-tag__card" />
    <circle cx={sx} cy={tag.y} r="3.2" className="ck-tag__pin" />
    <text x={tag.x} y={tag.y + 5.5} textAnchor="middle" direction={lang === 'he' ? 'rtl' : 'ltr'} className="ck-tag__text">{name}</text>
  </g>;
}
