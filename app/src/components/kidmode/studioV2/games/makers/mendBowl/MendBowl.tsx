import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { ArrowUpFromLine, Droplet, Puzzle, RotateCcw, RotateCw, Sparkles } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidSfx } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import {
  HudButton, HudCoach, HudDock, HudQuest, HudToast, PLAY_AMBIENCE, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, prefersReducedMotion,
  type CoachMood, type FxKind, type FxOptions, type PlayFxHandle, type PlayGrade, type PlaySound,
} from '../play';
import './mendBowl.css';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import {
  ASSIST_DIST, BOWL_GLAZES, HOME, ROTATE_STEP, SEAM_COVER, SEAM_TOLERANCE_PX, allPlaced, allTraced, assist, coverage, coverageDash, fits, flowFrom, markCoverage,
  normalizeDeg, pickPattern, pointInPolygon, rotate, samplePolyline, seamNear, tapPose, tipPose, traceSeam,
  type BowlCreation, type BowlGlaze, type BowlPattern, type BowlPiece, type BowlSeam, type Point, type Pose,
} from './mendBowlRules';
import { BOWL_CENTRE, BOWL_PATTERNS, BOWL_R, LINEN_R, OUTLINE_POINTS, polyD } from './mendBowlPatterns';
import {
  GLAZE_SPOTS, LIGHTS, SHORT_STAGE, TEAS, arrange, easeFlow, easiestPiece, liftCompletes, mostTurned, nearestSample, pointAlong, stageView, tableLayout, toUnits, traceStep, turnToward, unitsPerPixel, waitsForTurn,
  type StageView, type TableSpot,
} from './mendBowlPlay';
import { BowlBody } from './BowlArt';
import { HintHand, TableGround, type TablePokes } from './MendScene';
import { MendedLayer, emptyHandles, seamMiddle, type GoldHandles } from './MendGold';
import { KIT_FLOOR, KIT_ROLLER, ROLLER_CONTACT } from './mendKit';
import { createBowlSounds, type BowlSounds, type BowlToy } from './mendBowlAudio';
import { warmBowlTextures } from './bowlTexture';

/** The arc: an opening shot, three chapters (glaze, fit, gold) with the slip
 * between the first two, the set-piece (the mended bowl is lit and filled
 * with tea), then the Studio's finish. */
type Phase = 'open' | 'choose' | 'slip' | 'break' | 'fit' | 'gold' | 'finale' | 'done';
/** How a piece moves to its next pose: each is one CSS transition (or none). */
type Motion = 'none' | 'drag' | 'scatter' | 'glide' | 'snap' | 'turn';
type Note = 'fitFirst' | 'fitTurn' | 'fitMore' | 'whole' | 'goldFirst' | 'goldFlow' | 'goldMore' | null;
type Lesson = 'glaze' | 'fit' | 'gold';
type Tea = 'none' | 'pour' | 'full';
const LIFT_MS = 300, SWAY_MS = 210, DROP_MS = 230, SCATTER_MS = 900, BROKE_HOLD_MS = 1500, GLIDE_MS = 380, ALL_IN_MS = 1500, TAP_FLOW_MS = 900, TRACE_FLOW_MS = 560, SING_MS = 900;
/** The set-piece: the seams light one by one, the tea is poured, the steam rises. About nine seconds; a short still beat when motion is reduced. */
const FINALE_LIGHT_MS = 700, FINALE_SEAM_MS = 240, FINALE_POUR_MS = 2600, FINALE_HOLD_MS = 2900, FINALE_STILL_MS = 2600;
const HINT_FIRST_MS = 1300, HINT_AGAIN_MS = 6000, NUDGE = 12, MOTE_MS = 2600;
/** Kept across Play again (a fresh mount): the last break, how many sittings, and what the child has already shown they know. */
let lastPattern: BowlPattern | null = null, sittings = 0;
const taught = new Set<Lesson>();
/** Each glaze's own chips and drops (palette token names). */
const GLAZE_FX: Record<BowlGlaze, readonly string[]> = { celadon: ['celadon', 'celadon-deep', 'white'], indigo: ['bluebell', 'indigo', 'sky-pale'], rose: ['rose', 'blossom', 'white'], cream: ['cream', 'sand', 'white'] };
const GOLD_FX = ['gold-light', 'white', 'sun'] as const;

const fill = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
const poseTransform = (pose: Pose, lift = 0) => `translate(${(pose.x - lift * 0.6).toFixed(2)}px, ${(pose.y - lift).toFixed(2)}px) rotate(${pose.r.toFixed(2)}deg)`;
const pct = (v: number, of: number) => `${(v / of * 100).toFixed(3)}%`;
const setOne = <T,>(list: T[], index: number, value: T) => list.map((v, i) => i === index ? value : v);

interface PieceProps { index: number; piece: BowlPiece; seams: readonly BowlSeam[]; glaze: BowlGlaze; pose: Pose; motion: Motion; placed: boolean; selected: boolean; dragging: boolean; wobble: number; label: string; interactive: boolean; uid: string; viewBox: string;
  onPointerDown: (index: number, e: PointerEvent<HTMLButtonElement>) => void; onKey: (index: number, e: KeyboardEvent<HTMLButtonElement>) => void; onKeyClick: (index: number, e: MouseEvent<HTMLButtonElement>) => void }
/** One shard: the whole bowl clipped to the piece's outline, so the glaze,
 * the rim and the light line up exactly when it is home. It has thickness:
 * the pale clay of the break shows along its edges and it casts its own
 * shadow to the lower right, longer while it is held above the table. */
const BowlShard = memo(function BowlShard({ index, piece, seams, glaze, pose, motion, placed, selected, dragging, wobble, label, interactive, uid, viewBox, onPointerDown, onKey, onKeyClick }: PieceProps) {
  const d = useMemo(() => polyD(piece.polygon, true), [piece]);
  const origin = `${piece.centroid.x.toFixed(2)}px ${piece.centroid.y.toFixed(2)}px`;
  const lifted = (selected || dragging) && !placed;
  const delay = motion === 'scatter' ? `${index * 45}ms` : '0ms';
  return <button type="button" className="mb-piece" data-piece={index} data-placed={placed} data-selected={selected} data-dragging={dragging} data-motion={motion}
    style={{ zIndex: dragging ? 6 : selected ? 5 : placed ? 1 : 2, '--mb-delay': delay } as CSSProperties} aria-label={label} aria-pressed={selected}
    disabled={!interactive || placed} onPointerDown={e => onPointerDown(index, e)} onKeyDown={e => onKey(index, e)} onClick={e => onKeyClick(index, e)}>
    <svg viewBox={viewBox} className="mb-layer" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${uid}-clip`}><path d={d} /></clipPath>
        <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={lifted ? 6 : 3.2} /></filter>
      </defs>
      {/* The table's light comes from the upper left, so every shadow falls to the lower right. */}
      {!placed && <g className="mb-piece__shadow" style={{ transform: poseTransform({ ...pose, x: pose.x + (lifted ? 11 : 5), y: pose.y + (lifted ? 14 : 6) }), transformOrigin: origin }}>
        <path d={d} filter={`url(#${uid}-soft)`} style={{ fill: 'var(--mk-shadow)' }} opacity={lifted ? 0.24 : 0.36} />
      </g>}
      <g className="mb-piece__body" style={{ transform: poseTransform(pose, lifted ? 6 : 0), transformOrigin: origin }}>
        <g className="mb-piece__wobble" key={wobble} data-wobble={wobble > 0} style={{ transformOrigin: origin }}>
          {/* The shard's thickness: the fired clay under the glaze, seen on the edges that face away from the light. */}
          {!placed && <path className="mb-piece__side" d={d} transform="translate(1.5 2.1)" />}
          <g clipPath={`url(#${uid}-clip)`}>
            <BowlBody glaze={glaze} uid={uid} shadow={false} />
            {/* The broken edge shows the pale clay body under the glaze. */}
            <g className="mb-piece__edge">{piece.seams.map(s => <path key={s} d={polyD(seams[s].points)} fill="none" strokeWidth="5" strokeLinejoin="round" style={{ stroke: 'var(--mk-clay-pale)' }} />)}</g>
          </g>
          <path className="mb-piece__ring mb-piece__ring--under" d={d} fill="none" strokeLinejoin="round" />
          <path className="mb-piece__ring" d={d} fill="none" strokeLinejoin="round" />
          <path className="mb-piece__flash" d={d} fill="none" strokeLinejoin="round" />
          <path className="mb-piece__hit" d={d} />
        </g>
      </g>
    </svg>
  </button>;
});

interface Run { seam: number; from: 0 | 1; ms: number; t0: number; last: number; done: boolean }
interface Hint { steps: { p: Point; pressed: boolean; ms: number }[]; at: number }

export default function MendBowl() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = MEND_BOWL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [phase, setPhaseState] = useState<Phase>('open');
  // A new sitting starts on the next glaze, so Play again does not open on the same bowl.
  const [glaze, setGlazeState] = useState<BowlGlaze>(() => BOWL_GLAZES[sittings % BOWL_GLAZES.length]);
  const [was, setWas] = useState<BowlGlaze | null>(null);
  const [pattern, setPattern] = useState<BowlPattern>(0);
  const [poses, setPosesState] = useState<Pose[]>([]);
  const [placed, setPlacedState] = useState<boolean[]>([]);
  const [motion, setMotion] = useState<Motion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [wobble, setWobble] = useState<number[]>([]);
  const [waiting, setWaiting] = useState<number | null>(null);
  const [nearSlot, setNearSlot] = useState<number | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [slip, setSlip] = useState(0);
  const [order, setOrderState] = useState<number[]>([]);
  const [dash, setDash] = useState<string[]>([]);
  const [flows, setFlows] = useState<Record<number, 0 | 1>>({});
  const [sealed, setSealed] = useState<number[]>([]);
  const [lit, setLit] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [lamp, setLamp] = useState(false);
  const [bloom, setBloom] = useState(false);
  const [petal, setPetal] = useState(false);
  const [pokes, setPokes] = useState<TablePokes>({ fern: 0, gold: 0, lamp: 0, bloom: 0, dish: 0 });
  const [rollerPoke, setRollerPoke] = useState(0);
  const [held, setHeld] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [touched, setTouched] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [settled, setSettled] = useState(false);
  const [mood, setMoodState] = useState<CoachMood>('idle');
  const [say, setSay] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [tea, setTea] = useState<Tea>('none');
  const [push, setPush] = useState(false);
  const [caption, setCaption] = useState('');
  const [round, setRound] = useState(sittings);
  const phaseRef = useRef<Phase>(phase), posesRef = useRef(poses), placedRef = useRef(placed), orderRef = useRef(order), selectedRef = useRef(selected), glazeRef = useRef(glaze), patternRef = useRef(pattern);
  selectedRef.current = selected; patternRef.current = pattern;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const setPoses = (next: Pose[]) => { posesRef.current = next; setPosesState(next); };
  const setPlaced = (next: boolean[]) => { placedRef.current = next; setPlacedState(next); };
  const setOrder = (next: number[]) => { orderRef.current = next; setOrderState(next); };
  const setGlaze = (next: BowlGlaze) => { glazeRef.current = next; setGlazeState(next); };
  const stage = useRef<HTMLDivElement>(null), roller = useRef<HTMLImageElement>(null), fx = useRef<PlayFxHandle>(null);
  const view = useMemo(() => stageView(box.w, box.h), [box]);
  const viewRef = useRef<StageView>(view); viewRef.current = view;
  const drag = useRef<{ index: number; id: number; x: number; y: number; from: Pose; moved: boolean; wasSelected: boolean } | null>(null);
  const keyFrom = useRef<Pose | null>(null);
  const trace = useRef<{ id: number; points: Point[]; moved: boolean; x: number; y: number } | null>(null);
  const covered = useRef<boolean[][]>([]), samples = useRef<Point[][]>([]), steps = useRef<number[]>([]);
  const sounds = useRef<BowlSounds | null>(null), play = useRef<PlaySound | null>(null);
  const handles = useRef<GoldHandles>(emptyHandles());
  const runs = useRef<Run[]>([]), frame = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]), hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const variant = useRef(sittings), moodId = useRef(0), sayId = useRef(0), toastId = useRef(0), hostTaps = useRef(0), moteAt = useRef(0), bed = useRef(false), petalRef = useRef(false);
  const later = (ms: number, run: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms);
    timers.current.push(id);
  };
  /** This sitting's table, light and tea: a replay finds them changed. */
  const spots = useMemo(() => tableLayout(round), [round]);
  const spotsRef = useRef(spots); spotsRef.current = spots;
  const brew = TEAS[round % TEAS.length], light: PlayGrade = LIGHTS[round % LIGHTS.length];

  /* ---------- effects on the shared particle layer (stage units in, stage fractions out) ---------- */
  const spark = (at: Point, kind: FxKind, opts?: FxOptions) => { const v = viewRef.current; fx.current?.burst((at.x - v.x) / v.w, (at.y - v.y) / v.h, kind, opts); };
  const trailAt = (at: Point, kind: FxKind, opts?: FxOptions) => { const v = viewRef.current; fx.current?.trail((at.x - v.x) / v.w, (at.y - v.y) / v.h, kind, opts); };
  /** The host answers a moment with a face, then settles. */
  const feel = (next: CoachMood, ms = 1400) => { const id = ++moodId.current; setMoodState(next); later(ms, () => { if (moodId.current === id) setMoodState('idle'); }); };
  const speak = (line: string, ms = 2200) => { const id = ++sayId.current; setSay(line); later(ms, () => { if (sayId.current === id) setSay(null); }); };
  const announce = (line: string, ms = 1900) => { const id = ++toastId.current; setToast(line); later(ms, () => { if (toastId.current === id) setToast(null); }); };

  /* ---------- one frame loop: gold running and its bright head ---------- */
  const tick = (now: number) => {
    frame.current = 0;
    const h = handles.current; let busy = false;
    for (const run of runs.current) {
      if (run.done) continue;
      const path = h.flow[run.seam], line = samples.current[run.seam];
      if (!path || !line) { busy = true; continue; }
      if (!run.t0) run.t0 = now;
      const raw = Math.min(1, (now - run.t0) / run.ms), e = easeFlow(raw), head = h.head[run.seam], comet = h.comet[run.seam];
      const at = pointAlong(line, run.from === 1 ? 1 - e : e);
      path.style.strokeDashoffset = String(1 - e);
      if (comet) { comet.style.strokeDashoffset = String(0.16 - e); comet.style.opacity = raw < 1 ? '1' : '0'; }
      if (head) { head.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) scale(${(0.8 + 0.4 * Math.sin(raw * Math.PI)).toFixed(2)})`; head.style.opacity = raw < 1 ? '1' : '0'; }
      if (raw < 1 && now - run.last > 46) { run.last = now; trailAt(at, 'sparkle', { tones: GOLD_FX, size: 0.55 }); }
      if (raw >= 1) run.done = true; else busy = true;
    }
    runs.current = runs.current.filter(r => !r.done);
    if (busy) kick();
  };
  const kick = () => { if (!frame.current && typeof document !== 'undefined' && typeof requestAnimationFrame === 'function' && document.visibilityState !== 'hidden') frame.current = requestAnimationFrame(tick); };
  const stopFrames = () => { if (frame.current && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame.current); frame.current = 0; };

  useEffect(() => {
    const instance = createBowlSounds(), kit = createPlaySound({ key: 'D' }); sounds.current = instance; play.current = kit; sittings += 1;
    warmBowlTextures(glazeRef.current);
    const page = typeof document === 'undefined' ? null : document;
    const visibility = () => { if (page?.visibilityState === 'hidden') { sounds.current?.stop(); stopFrames(); } else kick(); };
    page?.addEventListener('visibilitychange', visibility);
    // Idle life: a mote of dust drifts through the window's light now and then.
    const motes = setInterval(() => {
      if (page?.visibilityState === 'hidden' || prefersReducedMotion()) return;
      const v = viewRef.current, k = moteAt.current++;
      fx.current?.trail(0.2 + ((k * 0.37) % 0.6), (BOWL_CENTRE.y - 150 + ((k * 53) % 240) - v.y) / v.h, 'dust', { tones: ['white', 'butter'], size: 0.5 });
    }, MOTE_MS);
    return () => {
      for (const t of [...timers.current, ...hintTimers.current]) clearTimeout(t); timers.current = []; hintTimers.current = [];
      clearInterval(motes); stopFrames(); runs.current = []; fx.current?.clear();
      instance.dispose(); kit.dispose(); sounds.current = null; play.current = null; page?.removeEventListener('visibilitychange', visibility);
    };
    // The frame loop and its helpers only read refs: binding them once is right.
  }, []);
  /* The world is measured so the table can be framed for it. Layout size, not the camera's: the zoom never changes the framing. */
  const gone = phase === 'done';
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const read = () => { const bw = el.offsetWidth, bh = el.offsetHeight; setBox(b => Math.abs(b.w - bw) < 0.5 && Math.abs(b.h - bh) < 0.5 ? b : { w: bw, h: bh }); };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(read); observer.observe(el);
    return () => observer.disconnect();
  }, [gone]);
  /* The opening shot: the camera starts close on the bowl and settles back over the table. */
  useEffect(() => { later(140, () => setSettled(true)); }, []);

  const data = BOWL_PATTERNS[pattern];
  const units = (clientX: number, clientY: number): Point => {
    const r = stage.current?.getBoundingClientRect();
    return r && r.width ? toUnits(viewRef.current, r.width, r.height, clientX - r.left, clientY - r.top) : { ...BOWL_CENTRE };
  };
  const tolerance = () => { const r = stage.current?.getBoundingClientRect(); return SEAM_TOLERANCE_PX * (r ? unitsPerPixel(viewRef.current, r.width, r.height) : 1); };
  const scale = box.w > 0 ? Math.min(box.w / view.w, box.h / view.h) : 1;
  const px = (p: Point): Point => ({ x: (p.x - view.x) * scale, y: (p.y - view.y) * scale });
  const spotStyle = (spot: TableSpot, grow = 1): CSSProperties => ({ left: pct(spot.x - view.x, view.w), top: pct(spot.y - view.y, view.h), inlineSize: pct(spot.size * grow, view.w) });

  /* ---------- the hint: an authored hand shows the gesture, and steps aside for good once the child has done it ---------- */
  const stopHint = () => { for (const t of hintTimers.current) clearTimeout(t); hintTimers.current = []; setHint(null); };
  const planHint = (ms: number) => { stopHint(); hintTimers.current.push(setTimeout(showHint, ms)); };
  const showHint = () => {
    const now = phaseRef.current, pat = BOWL_PATTERNS[patternRef.current];
    let path: { p: Point; pressed: boolean; ms: number }[] | null = null;
    if (now === 'choose' && !taught.has('glaze')) {
      const next = GLAZE_SPOTS[(BOWL_GLAZES.indexOf(glazeRef.current) + 1) % GLAZE_SPOTS.length];
      path = [{ p: { x: next.x + 16, y: next.y + 22 }, pressed: false, ms: 0 }, { p: next, pressed: false, ms: 420 }, { p: next, pressed: true, ms: 160 }, { p: next, pressed: false, ms: 260 }, { p: next, pressed: true, ms: 160 }, { p: next, pressed: false, ms: 420 }];
    } else if (now === 'fit' && !taught.has('fit') && !drag.current) {
      const i = easiestPiece(posesRef.current, placedRef.current);
      if (i >= 0) {
        const home = pat.pieces[i].centroid, from = { x: home.x + posesRef.current[i].x, y: home.y + posesRef.current[i].y };
        path = [{ p: { x: from.x + 14, y: from.y + 20 }, pressed: false, ms: 0 }, { p: from, pressed: false, ms: 420 }, { p: from, pressed: true, ms: 220 }, { p: home, pressed: true, ms: 900 }, { p: home, pressed: false, ms: 420 }];
      }
    } else if (now === 'gold' && !taught.has('gold') && !trace.current) {
      const s = pat.seams.findIndex((_seam, i) => !orderRef.current.includes(i)), line = s >= 0 ? samples.current[s] : null;
      if (line) path = [{ p: line[0], pressed: false, ms: 0 }, { p: line[0], pressed: true, ms: 260 }, ...[0.25, 0.5, 0.75, 1].map(t => ({ p: pointAlong(line, t), pressed: true, ms: 300 })), { p: line[line.length - 1], pressed: false, ms: 420 }];
    }
    if (!path) { if ((now === 'fit' && !taught.has('fit')) || (now === 'gold' && !taught.has('gold'))) planHint(HINT_AGAIN_MS); return; }
    const sequence = path; let wait = 0;
    setHint({ steps: sequence, at: 0 });
    sequence.forEach((step, k) => { if (k === 0) return; wait += Math.max(120, sequence[k - 1].ms || 260); hintTimers.current.push(setTimeout(() => setHint(h => h ? { ...h, at: k } : h), wait)); });
    hintTimers.current.push(setTimeout(() => { setHint(null); planHint(HINT_AGAIN_MS); }, wait + sequence[sequence.length - 1].ms + 300));
  };
  /** Any touch or key: the hand steps aside at once and waits its turn again; the room's quiet bed starts with the first one. */
  const noteInput = () => {
    if (!touched) setTouched(true);
    if (!bed.current) bed.current = !!play.current?.ambience(PLAY_AMBIENCE.room);
    planHint(HINT_AGAIN_MS);
  };
  const learn = (lesson: Lesson) => { taught.add(lesson); };
  useEffect(() => {
    if (phase === 'choose' || phase === 'fit' || phase === 'gold') planHint(HINT_FIRST_MS); else stopHint();
    return stopHint;
    // The hint is planned once per stage of the mend.
  }, [phase]);

  /* ---------- the roller: it rests by the gold, and follows the finger along a crack ---------- */
  const rollerSize = spots.roller.size * scale, rollerTall = rollerSize * KIT_ROLLER.h / KIT_ROLLER.w;
  const seatRoller = (at: Point | null) => {
    const el = roller.current; if (!el || !box.w) return;
    const rest = px(spotsRef.current.roller), p = at ? px(at) : null;
    el.style.transform = p ? `translate(${(p.x - rollerSize * ROLLER_CONTACT.x).toFixed(1)}px, ${(p.y - rollerTall * ROLLER_CONTACT.y).toFixed(1)}px)` : `translate(${(rest.x - rollerSize / 2).toFixed(1)}px, ${(rest.y - rollerTall / 2).toFixed(1)}px)`;
  };
  // Re-seated whenever the table is re-framed.
  useEffect(() => { if (!held) seatRoller(null); }, [held, box, view, phase, spots]);

  /* ---------- the opening ---------- */
  const begin = () => { if (phaseRef.current !== 'open') return; setSettled(true); setPhase('choose'); play.current?.tap(); };

  /* ---------- chapter one: the glaze ---------- */
  const chooseGlaze = (next: BowlGlaze) => {
    const index = BOWL_GLAZES.indexOf(next), dish = GLAZE_SPOTS[index];
    if (next !== glazeRef.current) { setWas(glazeRef.current); later(520, () => setWas(null)); }
    setGlaze(next); learn('glaze'); setPulse(n => n + 1); setPokes(p => ({ ...p, dish: p.dish + 1 }));
    sounds.current?.dish(index); void selectionHaptic(); feel('happy', 900);
    // The glaze leaps from its dish and lands in the bowl.
    const toBowl = Math.atan2(BOWL_CENTRE.y - dish.y, BOWL_CENTRE.x - dish.x) * 180 / Math.PI;
    spark(dish, 'drop', { tones: GLAZE_FX[next], angle: toBowl, arc: 34, count: 9, spread: 0.9 });
    later(170, () => { spark(BOWL_CENTRE, 'ring', { tones: [GLAZE_FX[next][0]], size: 2 }); spark(BOWL_CENTRE, 'drop', { tones: GLAZE_FX[next], count: 8, spread: 0.5 }); });
  };
  /** A fingertip on the bowl rings it: a toy, never the break. */
  const ringBowl = (at: Point) => {
    sounds.current?.ring(BOWL_GLAZES.indexOf(glazeRef.current)); void selectionHaptic();
    setPulse(n => n + 1); spark(at, 'ring', { tones: ['white'], size: 0.9 });
  };
  /** A fingertip on the bare table: the linen answers too. */
  const tapTable = (at: Point) => { play.current?.tap(); spark(at, 'dust', { tones: ['white', 'linen'], count: 4, size: 0.7 }); };
  const breakBowl = () => {
    if (phaseRef.current !== 'choose') return;
    void selectionHaptic(); learn('glaze');
    const next = pickPattern(Math.random(), lastPattern); lastPattern = next;
    const pat = BOWL_PATTERNS[next], n = pat.pieces.length, starts = arrange(pat, variant.current, BOWL_CENTRE);
    setPattern(next); patternRef.current = next; setPlaced(Array(n).fill(false)); setWobble(Array(n).fill(0)); setSelected(null); setNote(null); setWaiting(null);
    samples.current = pat.seams.map(s => samplePolyline(s.points)); covered.current = samples.current.map(line => line.map(() => false)); steps.current = pat.seams.map(() => 0);
    setDash(pat.seams.map(() => '0 1'));
    // The landing is the big moment: a held breath, a shake, chips of glaze and a ring of dust off the linen.
    const land = () => {
      sounds.current?.slip(); void selectionHaptic(); void hitPause(70); setShake(k => k + 1); feel('wow', 1500);
      spark(BOWL_CENTRE, 'chip', { tones: [...GLAZE_FX[glazeRef.current], 'clay-pale'], count: 16, spread: 1.1 });
      spark(BOWL_CENTRE, 'dust', { tones: ['white', 'linen'], count: 12, spread: 1.6, size: 1.3 });
      spark(BOWL_CENTRE, 'ring', { tones: ['white'], size: 3.2 });
    };
    if (prefersReducedMotion()) {
      // Motion off: a cut straight to the pieces lying on the linen.
      setPoses(starts); setMotion(Array(n).fill('none')); setPhase('break'); land();
      later(BROKE_HOLD_MS, () => { setPhase('fit'); setNote('fitFirst'); });
      return;
    }
    // A gentle accident: the bowl is lifted to be looked at, wobbles, and slips back onto the linen.
    setPoses(pat.pieces.map(() => HOME)); setMotion(Array(n).fill('none')); setPhase('slip'); setSlip(1); sounds.current?.lift(); play.current?.pick();
    later(LIFT_MS, () => setSlip(2)); later(LIFT_MS + SWAY_MS, () => { setSlip(3); setMoodState('curious'); }); later(LIFT_MS + SWAY_MS * 2, () => setSlip(4));
    const down = LIFT_MS + SWAY_MS * 2 + DROP_MS;
    later(down, () => {
      setPoses(pat.pieces.map(p => tipPose(p, BOWL_CENTRE, 2, { x: 4, y: 3 }))); setPhase('break'); setSlip(0); land();
      later(40, () => { setMotion(Array(n).fill('scatter')); setPoses(starts); });
    });
    later(down + Math.max(SCATTER_MS, BROKE_HOLD_MS), () => { setPhase('fit'); setNote('fitFirst'); });
  };

  /* ---------- chapter two: the fit ---------- */
  const snapHome = (index: number) => {
    const nextPlaced = setOne(placedRef.current, index, true), count = nextPlaced.filter(Boolean).length, pat = BOWL_PATTERNS[patternRef.current];
    setMotion(m => setOne(m, index, 'snap')); setPoses(setOne(posesRef.current, index, HOME)); setPlaced(nextPlaced);
    setSelected(null); setDragging(null); setWaiting(null); setNearSlot(null); keyFrom.current = null; learn('fit');
    // Each piece home is one step up the scale, a puff off the linen and a glint along its edge.
    play.current?.place(count); void selectionHaptic(); feel('happy', 1100);
    spark(pat.pieces[index].centroid, 'ring', { tones: ['white'], size: 1.1 }); spark(pat.pieces[index].centroid, 'dust', { tones: ['white', 'linen'], count: 6 });
    if (allPlaced(nextPlaced, pat)) {
      setNote('whole');
      later(380, () => {
        play.current?.chapter(); void selectionHaptic(); setPulse(n => n + 1); announce(w.wholeToast);
        spark(BOWL_CENTRE, 'ring', { tones: ['white'], size: 2.8 }); spark(BOWL_CENTRE, 'sparkle', { tones: ['white', ...GLAZE_FX[glazeRef.current]], count: 14, spread: 1.3 });
      });
      later(ALL_IN_MS, () => { setPhase('gold'); setNote('goldFirst'); });
    } else setNote('fitMore');
  };
  /** A pose that does not fit: the piece is shown there, then drifts back with a wobble and the soft return. No words. */
  const driftBack = (index: number, from: Pose) => {
    setMotion(m => setOne(m, index, 'glide')); setPoses(setOne(posesRef.current, index, from));
    setWobble(list => setOne(list, index, (list[index] ?? 0) + 1)); setNearSlot(null); play.current?.back();
  };
  /** At its place but still turned: it waits there, chosen, and the turn that helps is lit. */
  const park = (index: number, pose: Pose) => {
    setMotion(m => setOne(m, index, 'glide')); setPoses(setOne(posesRef.current, index, { x: 0, y: 0, r: normalizeDeg(pose.r) }));
    setSelected(index); setWaiting(index); setNote('fitTurn'); setNearSlot(null); sounds.current?.press();
  };
  const drop = (index: number, pose: Pose, from: Pose) => {
    if (fits(BOWL_PATTERNS[patternRef.current].pieces[index], pose)) snapHome(index);
    else if (waitsForTurn(pose)) park(index, pose);
    else driftBack(index, from);
  };
  /** Tap path: the chosen piece glides to the tapped point, and either clicks in, waits for a turn, or drifts back. */
  const sendTo = (index: number, point: Point) => {
    const pat = BOWL_PATTERNS[patternRef.current], from = posesRef.current[index], target = assist(tapPose(pat, index, point, from.r));
    if (fits(pat.pieces[index], target)) { snapHome(index); return; }
    if (waitsForTurn(target)) { park(index, target); return; }
    setMotion(m => setOne(m, index, 'glide')); setPoses(setOne(posesRef.current, index, target));
    later(GLIDE_MS + 60, () => { if (phaseRef.current === 'fit' && !placedRef.current[index]) driftBack(index, from); });
  };
  const choose = (index: number | null) => { setSelected(index); setWaiting(null); setNote(index === null ? 'fitFirst' : 'fitTurn'); };
  const turn = (step: number) => {
    if (phaseRef.current !== 'fit') return;
    // With nothing chosen, a turn button picks up the most turned loose piece: it is never a dead control.
    const index = selectedRef.current ?? mostTurned(posesRef.current, placedRef.current);
    if (index < 0 || placedRef.current[index]) return;
    if (selectedRef.current !== index) { setSelected(index); setNote('fitTurn'); }
    const next = assist(rotate(posesRef.current[index], step));
    setMotion(m => setOne(m, index, 'turn')); setPoses(setOne(posesRef.current, index, next));
    sounds.current?.turn(step); void selectionHaptic();
    if (fits(BOWL_PATTERNS[patternRef.current].pieces[index], next)) later(210, () => { if (phaseRef.current === 'fit' && !placedRef.current[index]) snapHome(index); });
  };

  const onPiecePointerDown = (index: number, e: PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'fit' || placedRef.current[index] || drag.current) return;
    e.stopPropagation(); e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
    drag.current = { index, id: e.pointerId, x: e.clientX, y: e.clientY, from: posesRef.current[index], moved: false, wasSelected: selectedRef.current === index };
    keyFrom.current = null; play.current?.pick(); void selectionHaptic();
    if (selectedRef.current !== index) choose(index);
  };
  const onPieceKey = (index: number, e: KeyboardEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'fit' || placedRef.current[index]) return;
    const move: Record<string, [number, number]> = { ArrowLeft: [-NUDGE, 0], ArrowRight: [NUDGE, 0], ArrowUp: [0, -NUDGE], ArrowDown: [0, NUDGE] };
    if (move[e.key]) {
      e.preventDefault();
      if (selectedRef.current !== index) choose(index);
      if (!keyFrom.current) keyFrom.current = posesRef.current[index];
      const pose = posesRef.current[index], [dx, dy] = move[e.key];
      setMotion(m => setOne(m, index, 'turn')); setPoses(setOne(posesRef.current, index, assist({ ...pose, x: pose.x + dx, y: pose.y + dy, r: pose.r })));
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && keyFrom.current) {
      e.preventDefault(); const from = keyFrom.current; keyFrom.current = null; drop(index, assist(posesRef.current[index]), from); return;
    }
    if (e.key === '[' || e.key === ']') { e.preventDefault(); if (selectedRef.current !== index) choose(index); turn(e.key === '[' ? -ROTATE_STEP : ROTATE_STEP); return; }
    if (e.key === 'Escape') { if (keyFrom.current) { driftBack(index, keyFrom.current); keyFrom.current = null; } choose(null); }
  };
  /** Keyboard activation only (a pointer tap is handled by the pointer events). */
  const onPieceKeyClick = (index: number, e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail !== 0 || phaseRef.current !== 'fit') return;
    choose(selectedRef.current === index ? null : index);
  };

  /* ---------- chapter three: the gold; then the set-piece ---------- */
  const finishMend = () => {
    setPhase('finale'); setNote(null); setHeld(false); setLamp(true); setCaption(w.lit); play.current?.setPiece();
    const done = orderRef.current, seams = BOWL_PATTERNS[patternRef.current].seams;
    if (prefersReducedMotion()) {
      // Motion off: one still frame of the lit, filled bowl, then the Studio is told.
      setLit(done.length); setTea('full'); setCaption(w.admire); kidSfx('correct', 0.7);
      later(FINALE_STILL_MS, () => setPhase('done')); return;
    }
    later(260, () => setPush(true));
    // The light runs along every seam in the order the child laid them, one rising note each.
    done.forEach((s, k) => later(FINALE_LIGHT_MS + k * FINALE_SEAM_MS, () => {
      setLit(k + 1); sounds.current?.glint(k);
      const line = samples.current[s]; if (line) [0.2, 0.5, 0.8].forEach(t => spark(pointAlong(line, t), 'glint', { tones: GOLD_FX, count: 1, size: 0.7 })); else spark(seamMiddle(seams[s]), 'glint', { tones: GOLD_FX });
    }));
    const pour = FINALE_LIGHT_MS + done.length * FINALE_SEAM_MS + 500;
    // Then the tea: poured into the well, rising up the wall, the seams still in sight.
    later(pour, () => { setTea('pour'); setCaption(w.tea); play.current?.breath({ tone: 1400, gain: 0.02, length: FINALE_POUR_MS / 1000 }); });
    for (let k = 0; k < 7; k++) later(pour + k * 330, () => { spark(BOWL_CENTRE, 'drop', { tones: [brew.light, 'white'], count: 4, spread: 0.45, size: 0.9 }); if (k % 2 === 0) spark(BOWL_CENTRE, 'ring', { tones: ['white'], size: 0.45 + k * 0.05 }); play.current?.note(9 - k, { gain: 0.022, length: 0.3 }); });
    later(pour + FINALE_POUR_MS, () => {
      setTea('full'); setCaption(w.admire); setPulse(n => n + 1); kidSfx('correct', 0.7); void selectionHaptic();
      spark(BOWL_CENTRE, 'sparkle', { tones: GOLD_FX, count: 22, spread: 1.5 });
      // The secret: whoever woke the knit bloom finds one of its petals afloat in the tea.
      if (petalRef.current) { announce(w.secret, 2400); spark({ x: BOWL_CENTRE.x - 22, y: BOWL_CENTRE.y + 14 }, 'petal', { tones: ['rose', 'blossom'], count: 6, spread: 0.6 }); }
    });
    later(pour + FINALE_POUR_MS + FINALE_HOLD_MS, () => setPhase('done'));
  };
  const startFlow = (seam: number, from: 0 | 1, ms: number) => {
    if (orderRef.current.includes(seam) || phaseRef.current !== 'gold') return;
    const count = orderRef.current.length, pat = BOWL_PATTERNS[patternRef.current], still = prefersReducedMotion();
    setOrder(traceSeam(orderRef.current, seam)); learn('gold'); stopHint();
    setFlows(f => ({ ...f, [seam]: from })); setNote('goldFlow');
    sounds.current?.pour(ms, count); void selectionHaptic();
    if (still) setSealed(list => list.includes(seam) ? list : [...list, seam]);
    else { runs.current.push({ seam, from, ms, t0: 0, last: 0, done: false }); kick(); }
    later(ms, () => {
      const line = samples.current[seam], end = line ? line[from === 1 ? 0 : line.length - 1] : seamMiddle(pat.seams[seam]);
      if (!still) setSealed(list => list.includes(seam) ? list : [...list, seam]);
      sounds.current?.seal(count); void selectionHaptic(); setPulse(n => n + 1); feel('happy', 900);
      spark(end, 'ring', { tones: ['gold-light'], size: 1 }); spark(end, 'sparkle', { tones: GOLD_FX, count: 9 });
    });
    later(ms + 90, () => {
      if (!allTraced(orderRef.current, pat)) { setNote('goldMore'); return; }
      // The last seam closes: the bowl rings whole, then the set-piece.
      sounds.current?.sing(); play.current?.chapter(); setNote(null); announce(w.goldToast, 1300); setMoodState('wow');
      later(SING_MS, finishMend);
    });
  };
  const beadTo = (point: Point | null) => {
    const bead = handles.current.bead; if (!bead) return;
    if (!point) { bead.style.opacity = '0'; return; }
    // The bead leans onto the nearest crack still waiting, so a small finger feels the line pull.
    let at = point, best = tolerance();
    samples.current.forEach((line, s) => { if (orderRef.current.includes(s)) return; const near = nearestSample(line, point); if (near.index >= 0 && near.distance < best) { best = near.distance; at = line[near.index]; } });
    bead.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`; bead.style.opacity = '1';
    seatRoller(at);
  };
  const traceTo = (point: Point) => {
    const t = trace.current; if (!t) return;
    const prev = t.points[t.points.length - 1]; t.points.push(point);
    const tol = tolerance(), pat = BOWL_PATTERNS[patternRef.current];
    let changed = false;
    pat.seams.forEach((seam, s) => {
      if (orderRef.current.includes(s)) return;
      const before = covered.current[s], next = markCoverage(samples.current[s], before, prev, point, tol);
      if (next.some((v, i) => v !== before[i])) {
        covered.current[s] = next; changed = true;
        // Each stretch of crack covered plays the next step of a rising run and sheds a little gold.
        const step = traceStep(coverage(next));
        if (step > steps.current[s]) { steps.current[s] = step; sounds.current?.trace(step + orderRef.current.length); void selectionHaptic(); spark(point, 'sparkle', { tones: GOLD_FX, count: 3, size: 0.6, spread: 0.6 }); }
      }
      // The gold runs on from the end where the finger started.
      if (coverage(next) >= SEAM_COVER) startFlow(s, flowFrom(seam, t.points[0]), TRACE_FLOW_MS);
    });
    if (changed) setDash(covered.current.map(c => coverageDash(c)));
    beadTo(point);
    handles.current.trail?.setAttribute('d', polyD(t.points.slice(-40)));
  };
  const onStagePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const now = phaseRef.current;
    if (now !== 'gold' && now !== 'fit' && now !== 'choose' && now !== 'finale') return;
    const point = units(e.clientX, e.clientY);
    trace.current = { id: e.pointerId, points: [point], moved: false, x: e.clientX, y: e.clientY };
    if (now !== 'gold') return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
    setHeld(true); beadTo(point); sounds.current?.press();
  };
  const onStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      if (!d.moved) { d.moved = true; setDragging(d.index); setWaiting(null); setMotion(m => setOne(m, d.index, 'drag')); }
      const a = units(d.x, d.y), b = units(e.clientX, e.clientY), pose = assist({ x: d.from.x + b.x - a.x, y: d.from.y + b.y - a.y, r: d.from.r });
      setPoses(setOne(posesRef.current, d.index, pose));
      // Getting warm: the piece's own place lights as it comes near.
      setNearSlot(Math.hypot(pose.x, pose.y) < ASSIST_DIST * 0.8 ? d.index : null);
      return;
    }
    const t = trace.current;
    if (!t || t.id !== e.pointerId || phaseRef.current !== 'gold') return;
    if (!t.moved && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 6) return;
    t.moved = true; traceTo(units(e.clientX, e.clientY));
  };
  const endTrace = () => { beadTo(null); handles.current.trail?.setAttribute('d', ''); later(500, () => { if (!trace.current) setHeld(false); }); };
  const onStagePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      drag.current = null; setDragging(null);
      if (d.moved) drop(d.index, posesRef.current[d.index], d.from);
      else if (d.wasSelected) choose(null);
      return;
    }
    const t = trace.current; trace.current = null;
    if (!t || t.id !== e.pointerId) return;
    const point = t.points[0], now = phaseRef.current, onBowl = pointInPolygon(point, OUTLINE_POINTS);
    const onLinen = Math.hypot(point.x - BOWL_CENTRE.x, point.y - BOWL_CENTRE.y) < LINEN_R;
    if (now === 'choose' || now === 'finale') { if (!t.moved && onBowl) ringBowl(point); else if (!t.moved && onLinen) tapTable(point); return; }
    if (now === 'fit') { if (!t.moved && selectedRef.current !== null) sendTo(selectedRef.current, point); else if (!t.moved && onLinen) tapTable(point); return; }
    if (now !== 'gold') return;
    endTrace();
    const pat = BOWL_PATTERNS[patternRef.current];
    if (!t.moved) {
      const s = seamNear(pat, point, tolerance(), orderRef.current);
      if (s >= 0) startFlow(s, flowFrom(pat.seams[s], point), TAP_FLOW_MS); else if (onBowl) ringBowl(point); else if (onLinen) tapTable(point);
      return;
    }
    // A finger that lifts with half a crack covered has done enough: the gold runs on by itself.
    pat.seams.forEach((seam, s) => { if (!orderRef.current.includes(s) && liftCompletes(coverage(covered.current[s]))) startFlow(s, flowFrom(seam, t.points[0]), TRACE_FLOW_MS); });
  };
  const onStagePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) { drag.current = null; setDragging(null); if (d.moved) driftBack(d.index, d.from); }
    if (trace.current?.id === e.pointerId) { trace.current = null; if (phaseRef.current === 'gold') endTrace(); }
  };

  /* ---------- the things on the table that answer a touch ---------- */
  const toy = (kind: BowlToy, turnCount = 0) => { sounds.current?.toy(kind, turnCount); void selectionHaptic(); };
  /** The host is a toy too: a pat, and now and then a word. */
  const patHost = () => { hostTaps.current += 1; toy('chockPat'); feel('happy', 1500); if (hostTaps.current % 3 === 0) { speak(w.hostPat); later(260, () => play.current?.chapter()); } };
  const flipLamp = () => {
    const on = !lamp; setLamp(on); setPokes(p => ({ ...p, lamp: p.lamp + 1 })); toy(on ? 'lampOn' : 'lampOff');
    if (on) { setPulse(n => n + 1); spark(spotsRef.current.lamp, 'glint', { tones: ['white', 'butter'], count: 4 }); sealed.forEach(s => { const line = samples.current[s]; if (line) spark(pointAlong(line, 0.5), 'glint', { tones: GOLD_FX, count: 1 }); }); }
  };
  const rustleFern = () => { setPokes(p => ({ ...p, fern: p.fern + 1 })); toy('fernRustle', pokes.fern); spark(spotsRef.current.fern, 'petal', { tones: ['leaf', 'spring', 'sage'], count: 4, spread: 0.6, size: 0.8 }); };
  const flipBloom = () => {
    const open = !bloom; setBloom(open); setPokes(p => ({ ...p, bloom: p.bloom + 1 })); toy(open ? 'bloomOpen' : 'bloomFold');
    // Waking the bloom is the secret: one of its petals will be in the tea.
    if (open) { petalRef.current = true; setPetal(true); spark(spotsRef.current.bloom, 'petal', { tones: ['rose', 'blossom', 'poppy'], count: 9 }); }
  };
  const dipGold = () => { setPokes(p => ({ ...p, gold: p.gold + 1 })); toy('goldDip', pokes.gold); spark(spotsRef.current.gold, 'ring', { tones: ['gold-light'], size: 0.9 }); spark(spotsRef.current.gold, 'sparkle', { tones: GOLD_FX, count: 6, spread: 0.7 }); };
  const rollRoller = () => { setRollerPoke(n => n + 1); toy('goldDip', rollerPoke + 2); };

  /** Outside the Studio (which remounts the game), Play again starts over here. */
  const reset = () => {
    for (const t of [...timers.current, ...hintTimers.current]) clearTimeout(t); timers.current = []; hintTimers.current = []; sounds.current?.stop(); play.current?.stop(); bed.current = false;
    stopFrames(); runs.current = []; handles.current = emptyHandles(); fx.current?.clear();
    drag.current = null; trace.current = null; keyFrom.current = null; covered.current = []; samples.current = []; steps.current = [];
    sittings += 1; variant.current += 1; setRound(variant.current);
    setGlaze(BOWL_GLAZES[variant.current % BOWL_GLAZES.length]); setWas(null); setPoses([]); setPlaced([]); setMotion([]); setSelected(null); setDragging(null); setWobble([]); setWaiting(null); setNearSlot(null); setNote(null);
    setSlip(0); setOrder([]); setDash([]); setFlows({}); setSealed([]); setLit(0); setHeld(false); setHint(null); setLamp(false); setBloom(false); petalRef.current = false; setPetal(false); setTea('none'); setPush(false); setCaption('');
    setMoodState('idle'); setSay(null); setToast(null); setPhase('choose');
  };

  /* ---------- words ---------- */
  const upright = (i: number) => Math.abs(normalizeDeg(poses[i]?.r ?? 0)) <= 25;
  const chapter = phase === 'open' || phase === 'choose' ? 0 : phase === 'slip' || phase === 'break' || phase === 'fit' ? 1 : phase === 'gold' ? 2 : 3;
  /** The host's line: what this moment asks, eight words or fewer. */
  const cue = phase === 'open' ? w.welcome : phase === 'choose' ? (taught.has('glaze') && touched ? w.chooseThen : w.choose) : phase === 'slip' || phase === 'break' ? w.broke
    : phase === 'fit' ? (note === 'fitTurn' ? (waiting !== null ? w.fitTurn : w.fitPlace) : note === 'fitMore' ? w.fitMore : note === 'whole' ? w.whole : w.fit)
      : phase === 'gold' ? (note === 'goldMore' ? w.goldMore : note === 'goldFlow' ? w.goldFlow : w.gold) : w.admire;
  /** The same moment for a screen reader, with what to do next. */
  const status = phase === 'open' || phase === 'choose' ? w.chooseNext : phase === 'slip' || phase === 'break' ? w.brokeNext : phase === 'finale' || phase === 'done' ? w.admireNext
    : note === 'fitTurn' ? (waiting !== null ? w.fitTurn : w.fitPlace) : note === 'fitMore' ? w.fitMore : note === 'goldMore' ? w.goldMore : note === 'goldFlow' ? w.goldFlow : phase === 'gold' ? w.goldFirst : w.fitFirst;
  const creation: BowlCreation = { kind: 'bowl', glaze, pattern, seams: order };

  const viewBox = `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`;
  const showPieces = phase === 'break' || phase === 'fit';
  /** The gold and the roller are brought to the table once there is something to mend. */
  const tools = phase !== 'open' && phase !== 'choose' && phase !== 'slip';
  const chosenPiece = selected !== null && phase === 'fit' && !placed[selected] ? data.pieces[selected] : null;
  const pieceLabel = (i: number) => `${fill(w.piece, i + 1)}, ${placed[i] ? w.placed : upright(i) ? w.upright : w.tilted}${selected === i ? `, ${w.chosen}` : ''}`;
  const slotD = nearSlot !== null && phase === 'fit' && !placed[nearSlot] ? polyD(data.pieces[nearSlot].polygon, true) : null;
  const helps = waiting !== null && !placed[waiting] ? turnToward(poses[waiting] ?? HOME) : 0;
  const placedCount = placed.filter(Boolean).length;
  const progress = phase === 'fit' || phase === 'break' ? fill(w.piecesDone, placedCount, data.pieces.length) : phase === 'gold' || phase === 'finale' ? fill(w.seamsDone, sealed.length, data.seams.length) : '';
  const step = hint ? hint.steps[hint.at] : null, hand = step ? px(step.p) : null;

  /* ---------- the camera: close on the bowl to open, wide for the table, in again for the gold and the tea ---------- */
  const wide = box.w >= box.h, short = wide && box.h > 0 && box.h < SHORT_STAGE;
  const bowlPx = BOWL_R * 2 * scale, room = Math.min(box.w, box.h) || 1;
  const near = Math.min(1.45, Math.max(1, 0.62 * room / (bowlPx || 1)));
  const focus = { x: view.w ? (BOWL_CENTRE.x - view.x) / view.w : 0.5, y: view.h ? (BOWL_CENTRE.y - view.y) / view.h : 0.5 };
  const zoom = phase === 'open' ? (settled ? 1 : 1.42) : phase === 'slip' ? 1.12 : phase === 'fit' && note === 'whole' ? 1.14 : phase === 'gold' ? near : phase === 'finale' ? (push ? Math.min(1.6, near * (short ? 1 : 1.12)) : 1.02) : 1;
  // In the set-piece the bowl rides a little high, so the caption sits under it and never on it.
  const camera = { x: focus.x, y: focus.y + (phase === 'finale' && push ? (short ? 0.07 : 0.05) : 0), zoom };
  const host = phase === 'gold' ? 'bebe' as const : 'chock' as const;
  const turns = [
    <HudButton key="l" label={w.turnLeft} icon={<RotateCcw aria-hidden="true" />} iconOnly size="l" cue={helps < 0} onClick={() => turn(-ROTATE_STEP)} data={{ 'data-turn': 'left' }} />,
    <HudButton key="r" label={w.turnRight} icon={<RotateCw aria-hidden="true" />} iconOnly size="l" cue={helps > 0} onClick={() => turn(ROTATE_STEP)} data={{ 'data-turn': 'right' }} />,
  ];

  const world = <div className="mb-world" ref={stage} dir="ltr" role="group" aria-label={w.stage} aria-describedby={phase === 'fit' ? `${uid}-keys` : undefined} data-phase={phase} data-held={held} data-short={short}
    onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onPointerCancel={onStagePointerCancel}>
    {/* The workshop floor (shipped, from above) fills the screen; the window's light drifts across it. */}
    <div className="mb-floor" data-play-depth="3" aria-hidden="true"><img src={KIT_FLOOR.src} alt="" draggable={false} decoding="async" /></div>
    <TableGround viewBox={viewBox} uid={`${uid}-t`} glaze={glaze} spots={spots} dishes={phase === 'open' || phase === 'choose'} tools={tools} ghost={showPieces} slotD={slotD} lamp={lamp} bloom={bloom} pokes={pokes} />
    <div className="mb-sun" aria-hidden="true" />
    {(phase === 'open' || phase === 'choose' || phase === 'slip') && <svg viewBox={viewBox} className="mb-layer mb-whole" aria-hidden="true" focusable="false" data-slip={slip}>
      <defs><radialGradient id={`${uid}-wc`} gradientUnits="userSpaceOnUse" cx={BOWL_CENTRE.x + 9} cy={BOWL_CENTRE.y + 11} r={BOWL_R + 16}>
        <stop offset="0" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.5 }} /><stop offset=".8" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.44 }} /><stop offset=".92" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0.17 }} /><stop offset="1" style={{ stopColor: 'var(--mk-shadow)', stopOpacity: 0 }} />
      </radialGradient></defs>
      <circle className="mb-whole__shade" cx={BOWL_CENTRE.x + 9} cy={BOWL_CENTRE.y + 11} r={BOWL_R + 16} fill={`url(#${uid}-wc)`} />
      <g className="mb-whole__lift"><g className="mb-whole__body" data-pulse={pulse > 0 ? (pulse % 2 ? 'a' : 'b') : undefined}>
        <BowlBody glaze={glaze} uid={`${uid}-whole`} shadow={false} />
        {/* The glaze before this one washes away from the well outward. */}
        {was && <g className="mb-whole__was" key={`${was}-${pulse}`}><BowlBody glaze={was} uid={`${uid}-was`} shadow={false} /></g>}
      </g></g>
    </svg>}
    {showPieces && data.pieces.map((piece, i) => <BowlShard key={`${pattern}-${i}`} index={i} piece={piece} seams={data.seams} glaze={glaze} pose={poses[i] ?? HOME} motion={motion[i] ?? 'none'}
      placed={!!placed[i]} selected={selected === i} dragging={dragging === i} wobble={wobble[i] ?? 0} label={pieceLabel(i)} interactive={phase === 'fit'} uid={`${uid}-p${i}`} viewBox={viewBox}
      onPointerDown={onPiecePointerDown} onKey={onPieceKey} onKeyClick={onPieceKeyClick} />)}
    {(phase === 'gold' || phase === 'finale') && <MendedLayer uid={`${uid}-gold`} viewBox={viewBox} glaze={glaze} pattern={pattern} order={order} dash={dash} flows={flows} sealed={sealed} lit={lit} finale={phase === 'finale'} lamp={lamp} pulse={pulse}
      tea={tea} teaLight={brew.light} teaDeep={brew.deep} petal={petal} handles={handles} />}

    {/* Things on the table that answer a touch. The task needs none of them. */}
    <button type="button" className="mb-toy" data-toy="lamp" aria-pressed={lamp} aria-label={w.lamp} style={spotStyle(spots.lamp)} onPointerDown={e => e.stopPropagation()} onClick={flipLamp} />
    <button type="button" className="mb-toy" data-toy="fern" aria-label={w.fern} style={spotStyle(spots.fern, 0.9)} onPointerDown={e => e.stopPropagation()} onClick={rustleFern} />
    <button type="button" className="mb-toy" data-toy="bloom" aria-pressed={bloom} aria-label={w.bloom} style={spotStyle(spots.bloom, 1.2)} onPointerDown={e => e.stopPropagation()} onClick={flipBloom} />
    {tools && <button type="button" className="mb-toy" data-toy="gold" aria-label={w.goldDish} style={spotStyle(spots.gold)} onPointerDown={e => e.stopPropagation()} onClick={dipGold} />}
    {tools && <button type="button" className="mb-toy" data-toy="roller" aria-label={w.roller} style={spotStyle(spots.roller, 0.9)} onPointerDown={e => e.stopPropagation()} onClick={rollRoller} />}
    <img ref={roller} className="mb-roller" data-shown={tools && phase !== 'finale'} data-held={held} data-poke={rollerPoke > 0 ? (rollerPoke % 2 ? 'a' : 'b') : undefined} src={KIT_ROLLER.src} alt="" draggable={false} decoding="async" style={{ inlineSize: rollerSize || undefined }} />

    {phase === 'choose' && <div className="mb-glazes" role="group" aria-label={w.glazes}>
      {BOWL_GLAZES.map((g, i) => <button type="button" key={g} className="mb-glaze" data-glaze={g} aria-pressed={glaze === g} aria-label={w.glazeNames[g]} style={spotStyle(GLAZE_SPOTS[i])} onPointerDown={e => e.stopPropagation()} onClick={() => chooseGlaze(g)} />)}
    </div>}
    {/* Keyboard and screen-reader places: invisible until focused. */}
    {chosenPiece && data.pieces.map((piece, i) => placed[i] ? null : <button type="button" key={`place-${i}`} className="mb-spot" data-place={i} style={{ left: pct(piece.centroid.x - view.x, view.w), top: pct(piece.centroid.y - view.y, view.h) }}
      aria-label={fill(w.place, i + 1)} onPointerDown={e => e.stopPropagation()} onClick={() => { if (selectedRef.current !== null) sendTo(selectedRef.current, piece.centroid); }} />)}
    {phase === 'gold' && data.seams.map((seam, i) => { const m = seamMiddle(seam); return <button type="button" key={`seam-${i}`} className="mb-spot mb-spot--seam" data-seam={i} style={{ left: pct(m.x - view.x, view.w), top: pct(m.y - view.y, view.h) }}
      aria-label={`${fill(w.crack, i + 1)}${order.includes(i) ? `, ${w.golden}` : ''}`} disabled={order.includes(i)} onPointerDown={e => e.stopPropagation()} onClick={() => startFlow(i, 0, TAP_FLOW_MS)} />; })}
    <PlayFx ref={fx} layer={7} />
    {hand && step && <HintHand x={hand.x} y={hand.y} pressed={step.pressed} shown ms={step.ms} />}
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="mend-bowl" title={w.title} instruction={w.instruction} hearIt={`${cue} ${status}`}>
    {phase === 'done'
      ? <GameFinish creation={creation} title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="mb" data-adventure="mend-bowl" data-phase={phase} data-pattern={pattern} data-round={round % 3} dir={lang === 'he' ? 'rtl' : 'ltr'} onPointerDownCapture={noteInput} onKeyDownCapture={noteInput}>
        {/* The scene keeps its own left and right in both languages; only the HUD follows the reading direction. */}
        <PlayStage id="mend-bowl" grade={phase === 'finale' ? 'warm' : light} camera={camera} shake={shake} parallax world={world}>
          {phase === 'open' && <PlayOpening title={w.title} place={w.where} onDone={begin} />}
          <HudCoach who={host} mood={mood} line={say ?? cue} onPoke={patHost} pokeLabel={host === 'bebe' ? w.bebe : w.chock} />
          <HudQuest label={w.questName} current={chapter} steps={[
            { key: 'glaze-job', label: w.questGlaze, done: chapter > 0, icon: <Droplet aria-hidden="true" /> },
            { key: 'fit-job', label: w.questFit, done: chapter > 1, icon: <Puzzle aria-hidden="true" /> },
            { key: 'gold-job', label: w.questGold, done: chapter > 2, icon: <Sparkles aria-hidden="true" /> },
          ]} />
          <HudToast show={toast !== null}>{toast}</HudToast>
          <HudDock align={wide ? 'end' : 'center'}>
            {phase === 'choose' && <HudButton label={w.ready} tone="go" size="l" icon={<ArrowUpFromLine aria-hidden="true" />} cue={touched && taught.has('glaze')} onClick={breakBowl} data={{ 'data-mend-ready': '' }} />}
            {/* Turn left sits on the left and turn right on the right in both languages: they are directions, not reading order. */}
            {phase === 'fit' && (lang === 'he' ? [...turns].reverse() : turns)}
          </HudDock>
          <PlaySetPiece active={phase === 'finale'} caption={caption} />
        </PlayStage>
        <p className="mb-sr mb-status">{status}</p>
        <p className="mb-sr" role="status">{progress}</p>
        <p className="mb-sr" id={`${uid}-keys`}>{w.keys}</p>
      </section>}
  </GameShell>;
}
