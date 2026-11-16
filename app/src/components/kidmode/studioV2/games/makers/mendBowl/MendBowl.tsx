import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { RotateCcw, RotateCw, Sparkles } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidSfx } from '../../../../audio/kidAudio';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './mendBowl.css';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import {
  BOWL_GLAZES, HOME, ROTATE_STEP, SEAM_COVER, SEAM_TOLERANCE_PX, allPlaced, allTraced, assist, coverage, coverageDash, fits, flowFrom, markCoverage,
  normalizeDeg, pickPattern, pointInPolygon, rotate, samplePolyline, seamNear, tapPose, tipPose, traceSeam,
  type BowlCreation, type BowlGlaze, type BowlPattern, type BowlPiece, type BowlSeam, type Point, type Pose,
} from './mendBowlRules';
import { BOWL_PATTERNS, OUTLINE_D, OUTLINE_POINTS, RIM, STAGE, TIP_PIVOT, polyD } from './mendBowlPatterns';
import { BowlBody, GLAZE_TONES, GoldDefs, GoldRibbon, LinenCloth, ribbonD } from './BowlArt';
import { createBowlSounds, type BowlSounds } from './mendBowlAudio';

type Phase = 'choose' | 'tip' | 'break' | 'fit' | 'gold' | 'admire' | 'done';
/** How a piece moves to its next pose: each is one CSS transition (or none). */
type Motion = 'none' | 'drag' | 'tip' | 'scatter' | 'glide' | 'snap' | 'turn';
const VIEW = `0 0 ${STAGE.w} ${STAGE.h}`;
const TIP_MS = 320, SCATTER_MS = 900, BROKE_HOLD_MS = 1500, GLIDE_MS = 380, ALL_IN_MS = 750, TAP_FLOW_MS = 900, TRACE_FLOW_MS = 520, ADMIRE_MS = 3200, ADMIRE_STILL_MS = 1600;
const NUDGE = 12;
/** The last break pattern, so Play again (a fresh mount) never repeats it. */
let lastPattern: BowlPattern | null = null;

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fill = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
const poseTransform = (pose: Pose, lift = 0) => `translate(${pose.x.toFixed(2)}px, ${(pose.y - lift).toFixed(2)}px) rotate(${pose.r.toFixed(2)}deg)`;
const pct = (v: number, of: number) => `${(v / of * 100).toFixed(3)}%`;
const midpoint = (seam: BowlSeam): Point => { const s = samplePolyline(seam.points); return s[Math.floor(s.length / 2)]; };

interface PieceProps { index: number; piece: BowlPiece; seams: readonly BowlSeam[]; glaze: BowlGlaze; pose: Pose; motion: Motion; placed: boolean; selected: boolean; dragging: boolean; wobble: number; label: string; interactive: boolean; uid: string;
  onPointerDown: (index: number, e: PointerEvent<HTMLButtonElement>) => void; onKey: (index: number, e: KeyboardEvent<HTMLButtonElement>) => void; onKeyClick: (index: number, e: MouseEvent<HTMLButtonElement>) => void }
/** One shard: the whole bowl drawing clipped to the piece's outline, so the
 * glaze, the rim and the foot line up exactly when it is home. */
const BowlShard = memo(function BowlShard({ index, piece, seams, glaze, pose, motion, placed, selected, dragging, wobble, label, interactive, uid, onPointerDown, onKey, onKeyClick }: PieceProps) {
  const d = useMemo(() => polyD(piece.polygon, true), [piece]);
  const origin = `${piece.centroid.x.toFixed(2)}px ${piece.centroid.y.toFixed(2)}px`;
  const lifted = (selected || dragging) && !placed;
  const delay = motion === 'scatter' ? `${index * 45}ms` : '0ms';
  return <button type="button" className="mb-piece" data-piece={index} data-placed={placed} data-selected={selected} data-dragging={dragging} data-motion={motion}
    style={{ zIndex: dragging ? 6 : selected ? 5 : placed ? 1 : 2, '--mb-delay': delay } as CSSProperties} aria-label={label} aria-pressed={selected}
    disabled={!interactive || placed} onPointerDown={e => onPointerDown(index, e)} onKeyDown={e => onKey(index, e)} onClick={e => onKeyClick(index, e)}>
    <svg viewBox={VIEW} className="mb-layer" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${uid}-clip`}><path d={d} /></clipPath>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={lifted ? 6 : 3.5} /></filter>
      </defs>
      {!placed && <g className="mb-piece__shadow" style={{ transform: poseTransform({ ...pose, x: pose.x + (lifted ? 10 : 5), y: pose.y + (lifted ? 18 : 9) }), transformOrigin: origin }}>
        <path d={d} filter={`url(#${uid}-soft)`} style={{ fill: 'var(--mk-shadow)' }} opacity={lifted ? 0.26 : 0.34} />
      </g>}
      <g className="mb-piece__body" style={{ transform: poseTransform(pose, lifted ? 7 : 0), transformOrigin: origin }}>
        <g className="mb-piece__wobble" key={wobble} data-wobble={wobble > 0} style={{ transformOrigin: origin }}>
          <g clipPath={`url(#${uid}-clip)`}>
            <BowlBody glaze={glaze} uid={uid} shadow={false} />
            {/* The broken edge shows the pale clay body under the glaze. */}
            <g className="mb-piece__edge">{piece.seams.map(s => <path key={s} d={polyD(seams[s].points)} fill="none" strokeWidth="5.5" strokeLinejoin="round" style={{ stroke: 'var(--mk-clay-pale)' }} />)}</g>
          </g>
          <path className="mb-piece__ring" d={d} fill="none" strokeWidth="3" strokeLinejoin="round" />
          <path className="mb-piece__hit" d={d} />
        </g>
      </g>
    </svg>
  </button>;
});

interface Flow { from: 0 | 1; ms: number; on: boolean }
export default function MendBowl() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = MEND_BOWL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [phase, setPhaseState] = useState<Phase>('choose');
  const [glaze, setGlaze] = useState<BowlGlaze>('celadon');
  const [pattern, setPattern] = useState<BowlPattern>(0);
  const [poses, setPosesState] = useState<Pose[]>([]);
  const [placed, setPlacedState] = useState<boolean[]>([]);
  const [motion, setMotion] = useState<Motion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [wobble, setWobble] = useState<number[]>([]);
  const [note, setNote] = useState<'fitFirst' | 'fitTurn' | 'fitMore' | 'goldFirst' | 'goldFlow' | 'goldMore' | null>(null);
  const [order, setOrderState] = useState<number[]>([]);
  const [dash, setDash] = useState<string[]>([]);
  const [flows, setFlows] = useState<Record<number, Flow>>({});
  const [trail, setTrail] = useState<Point[]>([]);
  const phaseRef = useRef<Phase>(phase), posesRef = useRef(poses), placedRef = useRef(placed), orderRef = useRef(order), selectedRef = useRef(selected);
  selectedRef.current = selected;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const setPoses = (next: Pose[]) => { posesRef.current = next; setPosesState(next); };
  const setPlaced = (next: boolean[]) => { placedRef.current = next; setPlacedState(next); };
  const setOrder = (next: number[]) => { orderRef.current = next; setOrderState(next); };
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; id: number; x: number; y: number; from: Pose; moved: boolean; wasSelected: boolean } | null>(null);
  const keyFrom = useRef<Pose | null>(null);
  const trace = useRef<{ id: number; points: Point[]; moved: boolean; x: number; y: number } | null>(null);
  const covered = useRef<boolean[][]>([]);
  const samples = useRef<Point[][]>([]);
  const sounds = useRef<BowlSounds | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, run: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms);
    timers.current.push(id);
  };
  useEffect(() => {
    const instance = createBowlSounds(); sounds.current = instance;
    const hidden = () => { if (document.visibilityState === 'hidden') sounds.current?.stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { for (const t of timers.current) clearTimeout(t); timers.current = []; instance.dispose(); sounds.current = null; document.removeEventListener('visibilitychange', hidden); };
  }, []);

  const data = BOWL_PATTERNS[pattern];
  const units = (clientX: number, clientY: number): Point => {
    const box = stage.current?.getBoundingClientRect();
    if (!box || !box.width) return { x: 0, y: 0 };
    return { x: (clientX - box.left) / box.width * STAGE.w, y: (clientY - box.top) / box.height * STAGE.h };
  };
  const tolerance = () => { const width = stage.current?.getBoundingClientRect().width || STAGE.w; return SEAM_TOLERANCE_PX * STAGE.w / width; };
  const setOne = <T,>(list: T[], index: number, value: T) => list.map((v, i) => i === index ? value : v);

  /* ---------- choose → break ---------- */
  const breakBowl = () => {
    if (phaseRef.current !== 'choose') return;
    void selectionHaptic();
    const next = pickPattern(Math.random(), lastPattern); lastPattern = next;
    const pieces = BOWL_PATTERNS[next].pieces, n = pieces.length;
    setPattern(next); setPlaced(Array(n).fill(false)); setWobble(Array(n).fill(0)); setSelected(null); setNote(null);
    covered.current = BOWL_PATTERNS[next].seams.map(s => samplePolyline(s.points).map(() => false));
    samples.current = BOWL_PATTERNS[next].seams.map(s => samplePolyline(s.points));
    setDash(BOWL_PATTERNS[next].seams.map(() => '0 1'));
    if (reducedMotion()) {
      // Motion off: a cut straight to the pieces lying on the cloth.
      setPoses(pieces.map(p => p.start)); setMotion(Array(n).fill('none')); setPhase('break'); sounds.current?.tok();
      later(BROKE_HOLD_MS, () => setPhase('fit'));
      return;
    }
    setPoses(pieces.map(() => HOME)); setMotion(Array(n).fill('none')); setPhase('tip');
    later(30, () => { setMotion(Array(n).fill('tip')); setPoses(pieces.map(p => tipPose(p, TIP_PIVOT, 9, { x: 4, y: -10 }))); });
    later(30 + TIP_MS, () => { setMotion(Array(n).fill('scatter')); setPoses(pieces.map(p => p.start)); setPhase('break'); sounds.current?.tok(); });
    later(30 + TIP_MS + Math.max(SCATTER_MS, BROKE_HOLD_MS), () => setPhase('fit'));
  };

  /* ---------- fit ---------- */
  const snapHome = (index: number) => {
    const nextPlaced = setOne(placedRef.current, index, true);
    setMotion(m => setOne(m, index, 'snap')); setPoses(setOne(posesRef.current, index, HOME)); setPlaced(nextPlaced);
    setSelected(null); setDragging(null); keyFrom.current = null;
    sounds.current?.tap(1 + index * 0.04); void selectionHaptic();
    if (allPlaced(nextPlaced, BOWL_PATTERNS[pattern])) { setNote(null); later(ALL_IN_MS, () => { setPhase('gold'); setNote('goldFirst'); }); }
    else setNote('fitMore');
  };
  /** A pose that does not fit: the piece is shown there, then drifts back with a wobble. No sound, no words. */
  const driftBack = (index: number, from: Pose) => {
    setMotion(m => setOne(m, index, 'glide')); setPoses(setOne(posesRef.current, index, from));
    setWobble(list => setOne(list, index, (list[index] ?? 0) + 1));
  };
  const drop = (index: number, pose: Pose, from: Pose) => {
    if (fits(BOWL_PATTERNS[pattern].pieces[index], pose)) snapHome(index); else driftBack(index, from);
  };
  /** Tap path: the chosen piece glides to the tapped point, and either clicks in or drifts back. */
  const sendTo = (index: number, point: Point) => {
    const from = posesRef.current[index], target = assist(tapPose(BOWL_PATTERNS[pattern], index, point, from.r));
    if (fits(BOWL_PATTERNS[pattern].pieces[index], target)) { snapHome(index); return; }
    setMotion(m => setOne(m, index, 'glide')); setPoses(setOne(posesRef.current, index, target));
    later(GLIDE_MS + 60, () => { if (phaseRef.current === 'fit' && !placedRef.current[index]) driftBack(index, from); });
  };
  const turn = (step: number) => {
    const index = selectedRef.current;
    if (index === null || phaseRef.current !== 'fit') return;
    setMotion(m => setOne(m, index, 'turn')); setPoses(setOne(posesRef.current, index, rotate(posesRef.current[index], step)));
    sounds.current?.tap(0.8, 0.4);
  };
  const choose = (index: number | null) => { setSelected(index); setNote(index === null ? 'fitFirst' : 'fitTurn'); };

  const onPiecePointerDown = (index: number, e: PointerEvent<HTMLButtonElement>) => {
    if (phaseRef.current !== 'fit' || placedRef.current[index] || drag.current) return;
    e.stopPropagation(); e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
    drag.current = { index, id: e.pointerId, x: e.clientX, y: e.clientY, from: posesRef.current[index], moved: false, wasSelected: selectedRef.current === index };
    keyFrom.current = null;
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

  /* ---------- gold ---------- */
  const startFlow = (seam: number, from: 0 | 1, ms: number) => {
    if (orderRef.current.includes(seam)) return;
    const next = traceSeam(orderRef.current, seam); setOrder(next);
    setFlows(f => ({ ...f, [seam]: { from, ms, on: false } }));
    later(30, () => setFlows(f => f[seam] ? { ...f, [seam]: { ...f[seam], on: true } } : f));
    sounds.current?.shimmer(ms); setNote('goldFlow');
    later(ms + 80, () => {
      if (allTraced(orderRef.current, BOWL_PATTERNS[pattern])) {
        later(450, () => { setPhase('admire'); setNote(null); kidSfx('correct'); later(reducedMotion() ? ADMIRE_STILL_MS : ADMIRE_MS, () => setPhase('done')); });
      } else setNote('goldMore');
    });
  };
  const traceTo = (point: Point) => {
    const t = trace.current; if (!t) return;
    const prev = t.points[t.points.length - 1]; t.points.push(point);
    const tol = tolerance(), pat = BOWL_PATTERNS[pattern];
    let changed = false;
    pat.seams.forEach((seam, s) => {
      if (orderRef.current.includes(s)) return;
      const before = covered.current[s], next = markCoverage(samples.current[s], before, prev, point, tol);
      if (next.some((v, i) => v !== before[i])) { covered.current[s] = next; changed = true; }
      if (coverage(next) >= SEAM_COVER) {
        // The gold runs on from the end where the finger started.
        startFlow(s, flowFrom(seam, t.points[0]), TRACE_FLOW_MS);
      }
    });
    if (changed) setDash(covered.current.map(c => coverageDash(c)));
    setTrail(t.points.slice(-48));
  };
  const onStagePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const now = phaseRef.current;
    if (now === 'gold') {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
      trace.current = { id: e.pointerId, points: [units(e.clientX, e.clientY)], moved: false, x: e.clientX, y: e.clientY };
      return;
    }
    if (now === 'fit' || now === 'choose') trace.current = { id: e.pointerId, points: [units(e.clientX, e.clientY)], moved: false, x: e.clientX, y: e.clientY };
  };
  const onStagePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      if (!d.moved) { d.moved = true; setDragging(d.index); setMotion(m => setOne(m, d.index, 'drag')); }
      const a = units(d.x, d.y), b = units(e.clientX, e.clientY);
      setPoses(setOne(posesRef.current, d.index, assist({ x: d.from.x + b.x - a.x, y: d.from.y + b.y - a.y, r: d.from.r })));
      return;
    }
    const t = trace.current;
    if (!t || t.id !== e.pointerId || phaseRef.current !== 'gold') return;
    if (!t.moved && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 6) return;
    t.moved = true; traceTo(units(e.clientX, e.clientY));
  };
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
    const point = t.points[0], now = phaseRef.current;
    if (now === 'choose' && !t.moved && pointInPolygon(point, OUTLINE_POINTS)) { breakBowl(); return; }
    if (now === 'fit' && !t.moved) {
      const index = selectedRef.current;
      if (index !== null) sendTo(index, point);
      return;
    }
    if (now === 'gold') {
      setTrail([]);
      if (!t.moved) { const s = seamNear(BOWL_PATTERNS[pattern], point, tolerance(), orderRef.current); if (s >= 0) startFlow(s, flowFrom(BOWL_PATTERNS[pattern].seams[s], point), TAP_FLOW_MS); }
    }
  };
  const onStagePointerCancel = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) { drag.current = null; setDragging(null); if (d.moved) driftBack(d.index, d.from); }
    if (trace.current?.id === e.pointerId) { trace.current = null; setTrail([]); }
  };

  /** Outside the Studio (which remounts the game), Play again starts over here. */
  const reset = () => {
    for (const t of timers.current) clearTimeout(t); timers.current = []; sounds.current?.stop();
    drag.current = null; trace.current = null; keyFrom.current = null; covered.current = []; samples.current = [];
    setGlaze('celadon'); setPoses([]); setPlaced([]); setMotion([]); setSelected(null); setDragging(null); setWobble([]); setNote(null);
    setOrder([]); setDash([]); setFlows({}); setTrail([]); setPhase('choose');
  };

  /* ---------- words ---------- */
  const cue = phase === 'choose' ? w.choose : phase === 'tip' || phase === 'break' ? w.broke : phase === 'fit' ? w.fit : phase === 'gold' ? w.gold : w.admire;
  const status = phase === 'choose' ? w.chooseNext : phase === 'tip' || phase === 'break' ? w.brokeNext : phase === 'admire' || phase === 'done' ? w.admireNext
    : note === 'fitTurn' ? (selected !== null && Math.abs(normalizeDeg(poses[selected]?.r ?? 0)) <= 25 ? w.fitPlace : w.fitTurn) : note === 'fitMore' ? w.fitMore : note === 'goldMore' ? w.goldMore : note === 'goldFlow' ? w.goldFlow : phase === 'gold' ? w.goldFirst : w.fitFirst;
  const creation: BowlCreation = { kind: 'bowl', glaze, pattern, seams: order };

  const showPieces = phase === 'tip' || phase === 'break' || phase === 'fit';
  const chosenPiece = selected !== null && phase === 'fit' && !placed[selected] ? data.pieces[selected] : null;
  const chosenPose = selected !== null ? poses[selected] : HOME;
  /** The two turn buttons sit either side of the chosen piece, on whichever
   * axis keeps them clear of the other loose pieces. */
  const turnSpots = useMemo((): [CSSProperties, CSSProperties] | null => {
    if (!chosenPiece || selected === null) return null;
    const c = { x: chosenPiece.centroid.x + chosenPose.x, y: chosenPiece.centroid.y + chosenPose.y }, reach = chosenPiece.radius * 0.72 + 34;
    const others = data.pieces.map((piece, i) => ({ piece, i })).filter(({ i }) => i !== selected && !placed[i])
      .map(({ piece, i }) => ({ x: piece.centroid.x + (poses[i]?.x ?? 0), y: piece.centroid.y + (poses[i]?.y ?? 0), r: piece.radius * 0.55 }));
    const clamp = (p: Point) => ({ x: Math.min(STAGE.w - 30, Math.max(30, p.x)), y: Math.min(STAGE.h - 30, Math.max(30, p.y)) });
    let best: [Point, Point] | null = null, bestScore = -Infinity;
    for (const [dx, dy] of [[1, 0], [0, 1], [0.71, 0.71], [0.71, -0.71]] as const) {
      const a = clamp({ x: c.x - dx * reach, y: c.y - dy * reach }), b = clamp({ x: c.x + dx * reach, y: c.y + dy * reach });
      const clear = Math.min(...[a, b].flatMap(p => others.map(o => Math.hypot(p.x - o.x, p.y - o.y) - o.r)), 999);
      const squeezed = [a, b].reduce((sum, p, k) => sum + Math.max(0, reach - Math.hypot(p.x - c.x, p.y - c.y)) * (k + 1), 0);
      const score = Math.min(clear, 60) - squeezed * 1.5 - (dx === 1 ? 0 : 4);
      if (score > bestScore) { bestScore = score; best = [a, b]; }
    }
    return best ? [{ left: pct(best[0].x, STAGE.w), top: pct(best[0].y, STAGE.h) }, { left: pct(best[1].x, STAGE.w), top: pct(best[1].y, STAGE.h) }] : null;
  }, [chosenPiece, chosenPose, selected, data, placed, poses]);
  const pieceLabel = (i: number) => `${fill(w.piece, i + 1)}, ${placed[i] ? w.placed : Math.abs(normalizeDeg(poses[i]?.r ?? 0)) <= 25 ? w.upright : w.tilted}${selected === i ? `, ${w.chosen}` : ''}`;

  return <GameShell fullBleed autoNarrate={false} worldId="mend-bowl" title={w.title} instruction={w.instruction} hearIt={`${cue} ${status}`}>
    {phase === 'done'
      ? <GameFinish creation={creation} title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure mb" data-adventure="mend-bowl" data-phase={phase} data-pattern={pattern} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <AdventureHeading focusKey={phase}>{cue}</AdventureHeading>
        {/* The scene keeps its own left and right in both languages; only the chrome mirrors. */}
        <div className="mb-stage" ref={stage} dir="ltr" role="group" aria-label={w.stage} aria-describedby={phase === 'fit' ? `${uid}-keys` : undefined} data-phase={phase}
          onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onPointerCancel={onStagePointerCancel}>
          <svg viewBox={VIEW} className="mb-layer mb-ground" aria-hidden="true" focusable="false">
            <LinenCloth uid={`${uid}-cloth`} />
            {showPieces && <g className="mb-ghost">
              <path d={OUTLINE_D} />
              <ellipse cx={RIM.cx} cy={RIM.cy} rx={RIM.rx} ry={RIM.ry} />
            </g>}
          </svg>
          {phase === 'choose' && <svg viewBox={VIEW} className="mb-layer mb-whole" aria-hidden="true" focusable="false"><BowlBody glaze={glaze} uid={`${uid}-whole`} /></svg>}
          {showPieces && data.pieces.map((piece, i) => <BowlShard key={`${pattern}-${i}`} index={i} piece={piece} seams={data.seams} glaze={glaze} pose={poses[i] ?? HOME} motion={motion[i] ?? 'none'}
            placed={!!placed[i]} selected={selected === i} dragging={dragging === i} wobble={wobble[i] ?? 0} label={pieceLabel(i)} interactive={phase === 'fit'} uid={`${uid}-p${i}`}
            onPointerDown={onPiecePointerDown} onKey={onPieceKey} onKeyClick={onPieceKeyClick} />)}
          {(phase === 'gold' || phase === 'admire') && <MendedLayer uid={`${uid}-gold`} glaze={glaze} pattern={pattern} order={order} dash={dash} flows={flows} trail={trail} admire={phase === 'admire'} />}
          {chosenPiece && dragging === null && <>
            <button type="button" className="mb-turn" data-turn="left" style={turnSpots?.[0]} aria-label={w.turnLeft} onPointerDown={e => e.stopPropagation()} onClick={() => turn(-ROTATE_STEP)}><RotateCcw size={24} aria-hidden="true" /></button>
            <button type="button" className="mb-turn" data-turn="right" style={turnSpots?.[1]} aria-label={w.turnRight} onPointerDown={e => e.stopPropagation()} onClick={() => turn(ROTATE_STEP)}><RotateCw size={24} aria-hidden="true" /></button>
          </>}
          {/* Keyboard and screen-reader places: invisible until focused. */}
          {chosenPiece && data.pieces.map((piece, i) => placed[i] ? null : <button type="button" key={`place-${i}`} className="mb-spot" data-place={i} style={{ left: pct(piece.centroid.x, STAGE.w), top: pct(piece.centroid.y, STAGE.h) }}
            aria-label={fill(w.place, i + 1)} onPointerDown={e => e.stopPropagation()} onClick={() => { if (selectedRef.current !== null) sendTo(selectedRef.current, piece.centroid); }} />)}
          {phase === 'gold' && data.seams.map((seam, i) => { const m = midpoint(seam); return <button type="button" key={`seam-${i}`} className="mb-spot mb-spot--seam" data-seam={i} style={{ left: pct(m.x, STAGE.w), top: pct(m.y, STAGE.h) }}
            aria-label={`${fill(w.crack, i + 1)}${order.includes(i) ? `, ${w.golden}` : ''}`} disabled={order.includes(i)} onPointerDown={e => e.stopPropagation()} onClick={() => startFlow(i, 0, TAP_FLOW_MS)} />; })}
        </div>
        <p className="adventure-status mb-status" role="status">{status}</p>
        <p className="mb-sr" id={`${uid}-keys`}>{w.keys}</p>
        {phase === 'choose' && <div className="adventure-actions mb-actions">
          <div className="mb-glazes" role="group" aria-label={w.glazes}>
            {BOWL_GLAZES.map(g => <button type="button" key={g} className="mb-swatch" data-glaze={g} aria-pressed={glaze === g} onClick={() => { setGlaze(g); sounds.current?.tap(0.9, 0.5); }}>
              <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><Swatch glaze={g} uid={`${uid}-sw-${g}`} /></svg>
              <span>{w.glazeNames[g]}</span>
            </button>)}
          </div>
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go mb-ready" data-mend-ready="" onClick={breakBowl}><Sparkles size={20} aria-hidden="true" />{w.ready}</button>
        </div>}
      </section>}
  </GameShell>;
}

/** A small glazed tile for the glaze buttons: the same tones as the bowl. */
function Swatch({ glaze, uid }: { glaze: BowlGlaze; uid: string }) {
  const t = GLAZE_TONES[glaze];
  return <>
    <defs><radialGradient id={uid} cx=".35" cy=".3" r=".8"><stop offset="0" style={{ stopColor: t.light }} /><stop offset=".55" style={{ stopColor: t.base }} /><stop offset="1" style={{ stopColor: t.deep }} /></radialGradient></defs>
    <circle cx="24" cy="25" r="20" fill={`url(#${uid})`} />
    <ellipse cx="17" cy="16" rx="6" ry="3.4" transform="rotate(-28 17 16)" opacity=".55" style={{ fill: 'var(--mk-white)' }} />
  </>;
}

/** The whole bowl once every piece is home: the dark cracks, the gold as it
 * flows, the finger's wet brush, and the slow turn at the end. */
const MendedLayer = memo(function MendedLayer({ uid, glaze, pattern, order, dash, flows, trail, admire }: { uid: string; glaze: BowlGlaze; pattern: BowlPattern; order: readonly number[]; dash: readonly string[]; flows: Record<number, Flow>; trail: readonly Point[]; admire: boolean }) {
  const seams = BOWL_PATTERNS[pattern].seams;
  return <svg viewBox={VIEW} className="mb-layer mb-mended" aria-hidden="true" focusable="false" data-admire={admire}>
    <defs>
      <GoldDefs uid={uid} />
      <clipPath id={`${uid}-clip`}><path d={OUTLINE_D} /></clipPath>
      <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} /><stop offset=".5" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0.85 }} /><stop offset="1" style={{ stopColor: 'var(--mk-white)', stopOpacity: 0 }} />
      </linearGradient>
      {seams.map((seam, i) => {
        const flow = flows[i], d = polyD(flow?.from === 1 ? [...seam.points].reverse() : seam.points);
        return <mask key={i} id={`${uid}-m${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width={STAGE.w} height={STAGE.h}>
          {/* Butt ends: a round cap would paint a dot where a dash has no length yet. */}
          {dash[i] && dash[i] !== '0 1' && <path d={polyD(seam.points)} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray={dash[i]} style={{ stroke: 'var(--mk-white)' }} />}
          {flow && <path className="mb-flow" d={d} pathLength={1} fill="none" strokeWidth="12" strokeLinejoin="round" strokeDasharray="1 2" strokeDashoffset={flow.on ? 0 : 1} style={{ stroke: 'var(--mk-white)', transitionDuration: `${flow.ms}ms` }} />}
        </mask>;
      })}
      <mask id={`${uid}-gm`} maskUnits="userSpaceOnUse" x="0" y="0" width={STAGE.w} height={STAGE.h}>{seams.map((seam, i) => <path key={i} d={ribbonD(seam.points, i + pattern * 7)} style={{ fill: 'var(--mk-white)' }} />)}</mask>
    </defs>
    <g className="mb-turn-body"><BowlBody glaze={glaze} uid={`${uid}-b`} /></g>
    <g className="mb-turn-marks" clipPath={`url(#${uid}-clip)`}>
      {seams.map((seam, i) => <g key={i} className="mb-crack" data-gold={order.includes(i)}>
        <path d={polyD(seam.points)} fill="none" strokeWidth="1.5" strokeLinejoin="round" style={{ stroke: 'color-mix(in srgb, var(--mk-umber) 70%, var(--mk-shadow))' }} />
        <path d={polyD(seam.points)} fill="none" strokeWidth=".7" strokeLinejoin="round" transform="translate(-.8 -.6)" opacity=".7" style={{ stroke: 'var(--mk-clay-pale)' }} />
      </g>)}
      {seams.map((seam, i) => <g key={i} mask={`url(#${uid}-m${i})`}><GoldRibbon points={seam.points} seed={i + pattern * 7} uid={uid} /></g>)}
      {admire && <g mask={`url(#${uid}-gm)`}><rect className="mb-sheen" x="-150" y="60" width="150" height="240" fill={`url(#${uid}-sheen)`} /></g>}
      {admire && <g className="mb-glints">{order.map((s, k) => { const m = midpoint(seams[s]); return <path key={s} className="mb-glint" style={{ animationDelay: `${600 + k * 260}ms` }} d={`M${m.x} ${m.y - 7}L${m.x + 1.6} ${m.y - 1.6}L${m.x + 7} ${m.y}L${m.x + 1.6} ${m.y + 1.6}L${m.x} ${m.y + 7}L${m.x - 1.6} ${m.y + 1.6}L${m.x - 7} ${m.y}L${m.x - 1.6} ${m.y - 1.6}Z`} />; })}</g>}
    </g>
    {trail.length > 1 && <path className="mb-trail" d={polyD(trail)} fill="none" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />}
  </svg>;
});
