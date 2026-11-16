import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderOpen, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { STITCH_GARDEN_COPY, sgLine } from './stitchGardenCopy';
import { TEXTILE_CLOTHS, TEXTILE_COLUMNS, TEXTILE_FLOWERS, TEXTILE_MAX_MOTIFS, TEXTILE_THREADS, cellColumn, cellRow, freeCells, plant, reopenTextile, storyLines, textileOf, unpick, type TextileCloth, type TextileFlower, type TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, HOOP_CX, HOOP_CY, cellCentre, cellTarget, stitchesFor } from './stitchGardenStitches';
import { PARKED_NEEDLE, landsAt, needleAt, ringAngle, walkTo, type NeedlePlan, type NeedlePose } from './stitchGardenMotion';
import { createStitchSounds, type StitchSounds } from './stitchGardenAudio';
import type { VisitorKind } from './stitchGardenCritters';
import { ClothPatch, FlowerSwatch, TextileScene, ThreadDot, type FlowerFx, type NeedleHandle, type SceneFx, type SceneMotif, type StoryRim } from './StitchArt';
import { AYA_BODY, Aya, BUG_HOME, BUG_PEEK, Bud, GOBGOB_HERE, GobGobWaiting, HintHand, Ladybird, LeafLab, PLACES, Pincushion, RING_R, Visitor, WateringCan, type BugPose, type VisitorPose } from './StitchFriends';
import './stitchGarden.css';

type Phase = 'play' | 'lifting' | 'done';
/** The needle at work: stitching a flower in, pulling one out, or hopping in its cushion. */
interface Run { plan: NeedlePlan; motif: TextileMotif | null; start: number }
interface Drag { flower: TextileFlower; x: number; y: number; over: number | null; home: { x: number; y: number }; back: boolean }
interface Hint { step: 0 | 1 | 2 | 3 | 4; from: { x: number; y: number }; to: { x: number; y: number }; cell: number }
interface Fx { flowers: Record<number, FlowerFx>; shimmer: Record<number, { n: number; delay: number }>; beam: number; dew: SceneFx['dew']; screw: number }

/** The finish: the hoop is held up to the light, each flower catches it in turn, and it is set down. */
const HELD_SHIMMER_MS = 420, SET_DOWN_MS = 1500, FINISH_MS = 2350, FINISH_STILL_MS = 650;
const FADE_MS = 700, WOBBLE_MS = 420, DRIFT_MS = 260, DRAG_START_PX = 9, GLAD_MS = 1150;
const HINT_FIRST_MS = 1100, HINT_AGAIN_MS = 6000;
/** Which visitor comes to which cloth. */
const VISITORS: Record<TextileCloth, VisitorKind> = { linen: 'honeyBee', indigo: 'fireFly', sage: 'butterFly' };
/** The story's beats on the table, by how many flowers are stitched. */
const BEAT = { water: 2, light: 3, visitor: 5, peek: 6, breeze: 7, whole: 8 } as const;
const BUD_GROWS = 4, BUD_OPENS = 7;

/** Not saved anywhere: how many times the hoop has been taken up since the app opened (so a new sitting starts with another cloth, flower and thread), and whether the showing hand has done its job. */
let sittings = 0;
let handShown = false;

const stillMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const pct = (n: number, of: number) => `${(n / of * 100).toFixed(2)}%`;

export default function StitchGarden() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = STITCH_GARDEN_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const [sitting, setSitting] = useState(() => sittings);
  const [phase, setPhase] = useState<Phase>('play');
  const [held, setHeld] = useState<0 | 1 | 2>(0);
  const [cloth, setCloth] = useState<TextileCloth>(() => TEXTILE_CLOTHS[sitting % TEXTILE_CLOTHS.length]);
  const [flower, setFlower] = useState<TextileFlower>(() => TEXTILE_FLOWERS[(sitting * 2) % TEXTILE_FLOWERS.length]);
  const [thread, setThread] = useState(() => (sitting * 3) % TEXTILE_THREADS);
  const [motifs, setMotifsState] = useState<TextileMotif[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShownState] = useState(0);
  /** The flower the needle is on is whole; the needle still has its tie-off and its way home. */
  const [landed, setLandedState] = useState(false);
  /** A flower being pulled out: no longer on the cloth, still visible. */
  const [leaving, setLeaving] = useState<TextileMotif | null>(null);
  /** The hem line of an unpicked flower, fading away. */
  const [fading, setFading] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [wobble, setWobble] = useState(false);
  const [press, setPress] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reopened, setReopened] = useState(false);
  const [fx, setFx] = useState<Fx>({ flowers: {}, shimmer: {}, beam: 0, dew: null, screw: 0 });
  const [aya, setAya] = useState({ glad: false, hop: 0 });
  const [pour, setPour] = useState(0);
  const [budNudge, setBudNudge] = useState(0);
  const [labPing, setLabPing] = useState(0);
  const [gob, setGob] = useState({ nudge: 0, curious: false });
  const [thrum, setThrum] = useState(0);
  const [visitor, setVisitorState] = useState<(VisitorPose & { cell: number }) | null>(null);
  const [bug, setBugState] = useState<BugPose>({ theta: BUG_HOME, ms: 0, walking: false, out: false, hop: 0, dir: 1 });
  const [hint, setHint] = useState<Hint | null>(null);

  const motifsRef = useRef<TextileMotif[]>(motifs);
  const runRef = useRef<Run | null>(null);
  const shownRef = useRef(0);
  const landedRef = useRef(false);
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const visitorRef = useRef(visitor);
  const bugRef = useRef(bug);
  const poseRef = useRef<NeedlePose>(PARKED_NEEDLE);
  const needleRef = useRef<NeedleHandle>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sounds = useRef<StitchSounds | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gladTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = useRef<{ flower: TextileFlower; id: number; x: number; y: number; started: boolean; home: { x: number; y: number } } | null>(null);
  const swallowClick = useRef(false);

  const setMotifs = (next: TextileMotif[]) => { motifsRef.current = next; setMotifsState(next); };
  const setShown = (n: number) => { shownRef.current = n; setShownState(n); };
  const setLanded = (on: boolean) => { landedRef.current = on; setLandedState(on); };
  const setVisitor = (next: (VisitorPose & { cell: number }) | null) => { visitorRef.current = next; setVisitorState(next); };
  const setBug = (next: BugPose) => { bugRef.current = next; setBugState(next); };
  const startRun = (next: Run | null) => {
    runRef.current = next; setRun(next); setLanded(false);
    setShown(next ? (next.plan.mode === 'stitch' ? 0 : next.plan.startCount) : 0);
    if (!next) { poseRef.current = PARKED_NEEDLE; needleRef.current?.set(PARKED_NEEDLE); }
  };
  const later = (ms: number, task: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); task(); }, ms);
    timers.current.push(id);
  };

  useEffect(() => {
    const instance = createStitchSounds(); sounds.current = instance;
    return () => {
      for (const id of [...timers.current, ...hintTimers.current]) clearTimeout(id);
      timers.current = []; hintTimers.current = [];
      if (gladTimer.current) clearTimeout(gladTimer.current);
      if (visitTimer.current) clearTimeout(visitTimer.current);
      instance.dispose(); sounds.current = null; sittings += 1;
    };
  }, []);

  /* ── small moments on the table ───────────────────────────────────────── */

  const flowerFx = (cells: readonly number[], kind: FlowerFx['kind'], stagger = 0) => setFx(f => {
    const flowers = { ...f.flowers };
    cells.forEach((cell, i) => { flowers[cell] = { kind, n: (flowers[cell]?.n ?? 0) + 1, delay: i * stagger }; });
    return { ...f, flowers };
  });
  const shimmerFx = (cells: readonly number[], stagger = 0) => setFx(f => {
    const shimmer = { ...f.shimmer };
    cells.forEach((cell, i) => { shimmer[cell] = { n: (shimmer[cell]?.n ?? 0) + 1, delay: i * stagger }; });
    return { ...f, shimmer };
  });
  const cheer = (ms = GLAD_MS) => {
    setAya(a => ({ glad: true, hop: a.hop + 1 }));
    if (gladTimer.current) clearTimeout(gladTimer.current);
    gladTimer.current = setTimeout(() => { gladTimer.current = null; setAya(a => ({ ...a, glad: false })); }, ms);
  };
  /** Drops of water settle on the leaves of every flower on the cloth. */
  const dewNow = () => setFx(f => {
    const drops: { x: number; y: number; delay: number }[] = [];
    for (const m of motifsRef.current) {
      const leaves = stitchesFor(m.flower, m.cell).filter(s => s.part === 'leaf');
      for (const i of [1, leaves.length - 2]) { const s = leaves[i]; if (s && drops.length < 14) drops.push({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, delay: drops.length * 60 }); }
    }
    return { ...f, dew: { n: (f.dew?.n ?? 0) + 1, drops } };
  });
  const pourWater = () => { setPour(n => n + 1); sounds.current?.toy('water'); later(stillMotion() ? 0 : 560, dewNow); };

  const restOn = (cell: number) => { const c = cellCentre(cell); return { x: c.x + 15, y: c.y - 30 }; };
  const flyTo = (cell: number, ms = 950) => {
    const from = visitorRef.current, to = restOn(cell);
    setVisitor({ x: to.x, y: to.y, face: !from || to.x >= from.x ? 1 : -1, ms: stillMotion() ? 0 : ms, loop: from?.loop ?? 0, away: false, cell });
  };
  /** Now and then the visitor moves to another flower by itself. */
  const wander = () => {
    if (visitTimer.current) clearTimeout(visitTimer.current);
    visitTimer.current = setTimeout(() => {
      visitTimer.current = null;
      const here = visitorRef.current, garden = motifsRef.current;
      if (!here || here.away || phaseRef.current !== 'play') return;
      const others = garden.filter(m => m.cell !== here.cell);
      if (others.length > 0 && document.visibilityState !== 'hidden') flyTo(others[Math.floor(Math.random() * others.length)].cell, 1300);
      wander();
    }, 7000 + Math.random() * 4000);
  };
  const visitorArrives = (cell: number) => {
    setVisitor({ x: ART_W + 40, y: 40, face: -1, ms: 0, loop: 0, away: false, cell });
    later(60, () => flyTo(cell, 1200));
    sounds.current?.toy('visitor'); wander();
  };
  const visitorLeaves = () => {
    const here = visitorRef.current; if (!here) return;
    setVisitor({ ...here, x: ART_W + 50, y: 20, face: 1, ms: stillMotion() ? 0 : 900, away: true });
    later(950, () => { if (visitorRef.current?.away) setVisitor(null); });
  };
  const walkBug = (toTheta: number) => {
    const from = bugRef.current, theta = walkTo(from.theta, toTheta), turn = theta - from.theta;
    const ms = stillMotion() ? 0 : Math.max(320, Math.min(2800, Math.abs(turn) * 15));
    setBug({ ...from, theta, ms, walking: ms > 0, out: true, dir: turn >= 0 ? 1 : -1 });
    if (ms > 0) later(ms, () => { if (bugRef.current.theta === theta) setBug({ ...bugRef.current, walking: false }); });
  };

  /* ── the needle's clock ───────────────────────────────────────────────── */

  /** A hidden tab or the finish never leaves the needle mid-flower: whatever it was doing is simply done. */
  const settle = () => {
    const current = runRef.current;
    if (current?.plan.mode === 'unpick') setLeaving(null);
    startRun(null);
    sounds.current?.stop();
  };
  const settleRef = useRef(settle); settleRef.current = settle;
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') settleRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  const story = w.stories[cloth];
  /** A flower is whole: its line is sewn on the hem, it settles with a small bounce, and the table answers. */
  const flowerLanded = (motif: TextileMotif, count: number) => {
    setLanded(true);
    setNote(w.stories[cloth][count - 1] ?? '');
    flowerFx([motif.cell], 'bloom'); sounds.current?.bloom(motif.thread); cheer();
    const cells = motifsRef.current.map(m => m.cell);
    if (count === BEAT.water) pourWater();
    // The sun crosses the cloth from the window side, and each flower's threads catch it as it passes.
    if (count === BEAT.light) { setFx(f => ({ ...f, beam: f.beam + 1 })); later(stillMotion() ? 0 : 380, () => shimmerFx([...cells].sort((a, b) => cellCentre(a).x - cellCentre(b).x), 170)); sounds.current?.toy('sunbeam'); }
    if (count === BUD_GROWS || count === BUD_OPENS) setBudNudge(n => n + 1);
    if (count >= BEAT.visitor && !visitorRef.current) visitorArrives(motif.cell);
    else if (visitorRef.current && !visitorRef.current.away) flyTo(motif.cell);
    if (count === BEAT.peek && !bugRef.current.out) walkBug(BUG_PEEK);
    if (count === BEAT.breeze) { flowerFx(cells, 'sway', 70); sounds.current?.toy('breeze'); }
    if (count === BEAT.whole) { flowerFx(cells, 'bloom', 90); shimmerFx(cells, 90); }
  };
  const landRef = useRef((_run: Run) => {});
  landRef.current = (done: Run) => {
    if (done.plan.mode === 'unpick') setLeaving(null);
    else if (done.motif) flowerLanded(done.motif, motifsRef.current.length);
  };
  /** One frame loop, only while the needle moves: it reads the clock, asks where the needle is, and shows that. */
  useEffect(() => {
    if (!run) return;
    let frame = 0, lastCount = -1, lastBeat = -99, down = false;
    const lands = landsAt(run.plan);
    const step = () => {
      const t = now() - run.start, f = needleAt(run.plan, t);
      poseRef.current = f.pose; needleRef.current?.set(f.pose);
      if (f.count !== lastCount) { lastCount = f.count; setShown(f.count); }
      if (run.plan.mode === 'stitch' && f.phase === 'atWork' && f.beat !== lastBeat && run.motif) {
        lastBeat = f.beat;
        sounds.current?.stitch(run.motif.thread, f.beat, run.plan.stitches[Math.max(0, f.count - 1)].part);
      }
      if (!down && run.plan.mode !== 'flick' && t >= lands) { down = true; if (runRef.current === run) landRef.current(run); }
      if (f.phase === 'done') { if (runRef.current === run) startRun(null); return; }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  /* ── the showing hand ─────────────────────────────────────────────────── */

  const clearHint = () => { for (const id of hintTimers.current) clearTimeout(id); hintTimers.current = []; };
  const hintLater = (ms: number, task: () => void) => { hintTimers.current.push(setTimeout(task, ms)); };
  const showHow = () => {
    const root = sectionRef.current;
    if (handShown || !root || motifsRef.current.length > 0 || phaseRef.current !== 'play') return;
    const cell = freeCells(motifsRef.current).find(c => c === 5 || c === 6) ?? freeCells(motifsRef.current)[0];
    const card = root.querySelector<HTMLElement>('.sg-card[aria-pressed="true"]'), spot = root.querySelector<HTMLElement>(`[data-sg-spot="${cell}"]`);
    if (!card || !spot) return;
    const base = root.getBoundingClientRect(), a = card.getBoundingClientRect(), b = spot.getBoundingClientRect();
    const from = { x: a.left + a.width / 2 - base.left, y: a.top + a.height * 0.4 - base.top }, to = { x: b.left + b.width / 2 - base.left, y: b.top + b.height / 2 - base.top };
    const again = () => { setHint(null); hintLater(HINT_AGAIN_MS, showHow); };
    if (stillMotion()) { setHint({ step: 3, from, to, cell }); hintLater(1800, again); return; }
    setHint({ step: 1, from, to, cell });
    hintLater(420, () => setHint(h => h && { ...h, step: 2 }));
    hintLater(1420, () => setHint(h => h && { ...h, step: 3 }));
    hintLater(2750, () => setHint(h => h && { ...h, step: 4 }));
    hintLater(3150, again);
  };
  const showHowRef = useRef(showHow); showHowRef.current = showHow;
  useEffect(() => { if (!handShown) hintLater(HINT_FIRST_MS, () => showHowRef.current()); return clearHint; }, []);
  /** Any touch or key puts the hand away; it comes back after a quiet while, until the first flower is planted. */
  const onAnyInput = () => {
    if (handShown) return;
    clearHint(); setHint(null);
    hintLater(HINT_AGAIN_MS, () => showHowRef.current());
  };
  const handDone = () => { handShown = true; clearHint(); setHint(null); };

  /* ── what the child does ──────────────────────────────────────────────── */

  const busy = phase !== 'play';
  const plantAt = (cell: number, pick: TextileFlower = flower) => {
    if (busy) return;
    const next = plant(motifsRef.current, pick, cell, thread);
    if (!next) { sounds.current?.nudge(); setWobble(true); later(WOBBLE_MS, () => setWobble(false)); return; }
    void selectionHaptic(); handDone();
    // A flower still being stitched is finished at once; the needle moves on.
    const current = runRef.current;
    if (current?.plan.mode === 'unpick') setLeaving(null);
    if (current?.plan.mode === 'stitch' && current.motif && !landedRef.current) flowerFx([current.motif.cell], 'bloom');
    setMotifs(next);
    const motif = next[next.length - 1];
    if (stillMotion()) { startRun(null); flowerLanded(motif, next.length); return; }
    setNote(w.stitching);
    startRun({ plan: { mode: 'stitch', stitches: stitchesFor(motif.flower, motif.cell), from: poseRef.current, startCount: 0 }, motif, start: now() });
  };
  const takeOut = () => {
    if (busy || motifsRef.current.length === 0) return;
    void selectionHaptic();
    const last = motifsRef.current[motifsRef.current.length - 1];
    const stitches = stitchesFor(last.flower, last.cell);
    const current = runRef.current;
    const midway = current?.plan.mode === 'stitch' && current.motif?.cell === last.cell && !landedRef.current;
    const from = midway ? shownRef.current : stitches.length;
    setMotifs(unpick(motifsRef.current));
    sounds.current?.pull();
    setNote(w.unpicked);
    if (!midway) { const index = motifsRef.current.length; setFading(index); later(FADE_MS, () => setFading(value => value === index ? null : value)); }
    const here = visitorRef.current;
    if (here && !here.away && here.cell === last.cell) { const stay = motifsRef.current[motifsRef.current.length - 1]; if (stay) flyTo(stay.cell); else visitorLeaves(); }
    if (stillMotion()) { setLeaving(null); startRun(null); return; }
    setLeaving(last);
    startRun({ plan: { mode: 'unpick', stitches, from: poseRef.current, startCount: from }, motif: last, start: now() });
  };
  const finish = () => {
    if (busy || motifsRef.current.length === 0) return;
    void selectionHaptic();
    settle(); setLeaving(null); setFading(null); setNote(''); handDone();
    if (visitTimer.current) clearTimeout(visitTimer.current);
    visitorLeaves();
    setPhase('lifting'); setHeld(1);
    const cells = motifsRef.current.map(m => m.cell);
    if (stillMotion()) { setHeld(2); later(FINISH_STILL_MS, () => setPhase('done')); return; }
    cheer(FINISH_MS);
    const every = Math.min(120, 840 / cells.length);
    later(HELD_SHIMMER_MS, () => { shimmerFx(cells, every); sounds.current?.finish(cells.length, every, SET_DOWN_MS - HELD_SHIMMER_MS); });
    later(SET_DOWN_MS, () => { setHeld(2); flowerFx(cells, 'bloom', 40); });
    later(FINISH_MS, () => setPhase('done'));
  };
  const reopen = () => {
    const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
    const open = kept && saved.isCurrent() ? reopenTextile(kept) : null;
    if (!open || busy || motifsRef.current.length > 0) return;
    void selectionHaptic(); handDone();
    setCloth(open.cloth); setMotifs(open.motifs); setReopened(true); setNote(w.stories[open.cloth][open.motifs.length - 1] ?? '');
    shimmerFx(open.motifs.map(m => m.cell), 80);
  };
  const reset = () => {
    for (const id of timers.current) clearTimeout(id); timers.current = [];
    if (visitTimer.current) clearTimeout(visitTimer.current);
    const next = sitting + 1;
    settle(); setMotifs([]); setLeaving(null); setFading(null); setNote(''); setWobble(false); setDrag(null); setReopened(false); setHeld(0);
    setFx({ flowers: {}, shimmer: {}, beam: 0, dew: null, screw: 0 }); setVisitor(null); setBug({ theta: BUG_HOME, ms: 0, walking: false, out: false, hop: 0, dir: 1 }); setAya({ glad: false, hop: 0 });
    setSitting(next); setCloth(TEXTILE_CLOTHS[next % TEXTILE_CLOTHS.length]); setFlower(TEXTILE_FLOWERS[(next * 2) % TEXTILE_FLOWERS.length]); setThread((next * 3) % TEXTILE_THREADS); setPhase('play');
  };

  /* ── toys: nothing here is needed, all of it answers ──────────────────── */

  const touchFlower = (motif: TextileMotif) => {
    void selectionHaptic();
    flowerFx([motif.cell], 'sway'); shimmerFx([motif.cell]);
    sounds.current?.sing(motif.thread, TEXTILE_FLOWERS.indexOf(motif.flower));
    if (visitorRef.current && !visitorRef.current.away && visitorRef.current.cell !== motif.cell) flyTo(motif.cell);
  };
  const touchAya = () => { void selectionHaptic(); cheer(); sounds.current?.toy('aya'); };
  const touchCan = () => { void selectionHaptic(); pourWater(); };
  const touchBud = () => { void selectionHaptic(); setBudNudge(n => n + 1); if (budStage === 2) sounds.current?.bloom(2); else sounds.current?.card(budStage); };
  const touchLab = () => { void selectionHaptic(); setLabPing(n => n + 1); sounds.current?.pick(3); dewNow(); };
  const touchGob = () => { void selectionHaptic(); setGob(g => ({ nudge: g.nudge + 1, curious: true })); later(1100, () => setGob(g => ({ ...g, curious: false }))); sounds.current?.toy('aya'); };
  const touchNeedle = () => {
    if (busy || runRef.current) return;
    void selectionHaptic(); sounds.current?.toy('needle');
    if (stillMotion()) return;
    startRun({ plan: { mode: 'flick', stitches: [], from: PARKED_NEEDLE, startCount: 0 }, motif: null, start: now() });
  };
  const touchScrew = () => {
    void selectionHaptic(); sounds.current?.toy('screw');
    setFx(f => ({ ...f, screw: f.screw + 1 })); setThrum(n => n + 1);
    if (!bugRef.current.out) walkBug(BUG_PEEK);
  };
  const touchVisitor = () => {
    const here = visitorRef.current; if (!here || here.away) return;
    void selectionHaptic(); sounds.current?.toy('visitor');
    setVisitor({ ...here, loop: here.loop + 1 });
    const others = motifsRef.current.filter(m => m.cell !== here.cell);
    if (others.length > 0) later(stillMotion() ? 0 : 620, () => { if (visitorRef.current && !visitorRef.current.away) flyTo(others[Math.floor(Math.random() * others.length)].cell); });
  };
  const touchBug = () => {
    void selectionHaptic(); sounds.current?.toy('ladybird');
    setBug({ ...bugRef.current, hop: bugRef.current.hop + 1 });
    later(stillMotion() ? 0 : 260, () => walkBug(bugRef.current.theta + 46 * bugRef.current.dir));
  };
  /** A tap on the hoop's wood calls the ladybird there. */
  const onStageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || (e.target as HTMLElement).closest('button')) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * ART_W - HOOP_CX, y = (e.clientY - box.top) / box.height * ART_H - HOOP_CY;
    if (Math.abs(Math.hypot(x, y) - RING_R) > 17) return;
    void selectionHaptic(); sounds.current?.toy('ladybird');
    walkBug(ringAngle(x, y));
  };

  /** Drag a pattern card onto the cloth. A tap still just picks the flower. */
  const spotAt = (x: number, y: number): number | null => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    for (const el of document.elementsFromPoint(x, y)) {
      const spot = (el as HTMLElement).closest?.('[data-sg-spot]') as HTMLElement | null;
      if (spot && !(spot as HTMLButtonElement).disabled) return Number(spot.dataset.sgSpot);
    }
    return null;
  };
  const onCardDown = (pick: TextileFlower) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const box = e.currentTarget.getBoundingClientRect();
    pressRef.current = { flower: pick, id: e.pointerId, x: e.clientX, y: e.clientY, started: false, home: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
  };
  const onCardMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pressRef.current; if (!p || p.id !== e.pointerId) return;
    if (!p.started) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      p.started = true; setFlower(p.flower);
    }
    setDrag({ flower: p.flower, x: e.clientX, y: e.clientY, over: spotAt(e.clientX, e.clientY), home: p.home, back: false });
  };
  const onCardUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pressRef.current; if (!p || p.id !== e.pointerId) return;
    pressRef.current = null;
    if (!p.started) return;
    swallowClick.current = true; later(0, () => { swallowClick.current = false; });
    const over = spotAt(e.clientX, e.clientY);
    if (over !== null) { setDrag(null); plantAt(over, p.flower); return; }
    // Not over a free cross: the card drifts back to the tray.
    setDrag({ flower: p.flower, x: p.home.x, y: p.home.y, over: null, home: p.home, back: true });
    later(stillMotion() ? 0 : DRIFT_MS, () => setDrag(null));
  };
  const onCardCancel = () => { pressRef.current = null; setDrag(null); };

  /* ── what is shown ────────────────────────────────────────────────────── */

  const free = phase === 'play' ? freeCells(motifs) : [];
  const stitching = run?.plan.mode === 'stitch' && run.motif && !landed ? run : null;
  const settled = motifs.length - (stitching ? 1 : 0);
  const budStage: 0 | 1 | 2 = settled >= BUD_OPENS ? 2 : settled >= BUD_GROWS ? 1 : 0;
  const lines = storyLines(story, settled);
  const rim: StoryRim[] = [];
  if (lines.length > 0) rim.push({ text: lines[lines.length - 1], key: `${cloth}${lines.length - 1}` });
  if (fading !== null && story[fading]) rim.push({ text: story[fading], key: `f${fading}`, leaving: true });
  const scene: SceneMotif[] = motifs.map(motif => ({ motif, count: stitching && stitching.motif?.cell === motif.cell ? shown : undefined }));
  if (leaving && run?.plan.mode === 'unpick') scene.push({ motif: leaving, count: shown, leaving: true });
  const ghost = hint?.step === 3 ? { flower, cell: hint.cell, thread } : null;
  const sceneFx = useMemo<SceneFx>(() => ({ ...fx, ghost }), [fx, ghost?.cell, ghost?.flower, ghost?.thread]);
  /** GobGob's WaitRing: one more light for each quarter of the flower the needle has stitched. */
  const lights = stitching ? Math.min(3, Math.floor(shown / Math.max(1, stitching.plan.stitches.length) * 4)) : aya.glad && phase === 'play' ? 4 : 0;

  const cue = phase === 'lifting' ? w.cueLifting : stitching?.motif ? sgLine(w.cueStitching, w.flowers[stitching.motif.flower])
    : motifs.length === 0 ? w.cueStart : motifs.length >= TEXTILE_MAX_MOTIFS ? w.cueFull : w.cueMore;
  const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
  const canReopen = !reopened && motifs.length === 0 && !leaving && phase === 'play' && !!kept && !!reopenTextile(kept);
  // Spots follow the reading direction for the keyboard; on the cloth they stay put.
  const spotOrder = lang === 'he' ? [...free].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(b) - cellColumn(a)) : free;
  const made = textileOf(cloth, motifs);
  const at = (x: number, y: number) => ({ insetInlineStart: pct(x, ART_W), insetBlockStart: pct(y, ART_H) });
  const over = (box: { x: number; y: number; w: number; h: number }) => ({ ...at(box.x + box.w / 2, box.y + box.h / 2), inlineSize: `max(var(--studio-tap), ${pct(box.w, ART_W)})`, blockSize: `max(var(--studio-tap), ${pct(box.h, ART_H)})` });
  const bugAt = { x: HOOP_CX + Math.cos(bug.theta * Math.PI / 180) * RING_R, y: HOOP_CY + Math.sin(bug.theta * Math.PI / 180) * RING_R };

  return <GameShell fullBleed autoNarrate={false} worldId="stitch-garden" title={w.title} instruction={w.instruction}>
    <section className="adventure adventure--stitch" ref={sectionRef} data-adventure="stitch-garden" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'} onPointerDownCapture={onAnyInput} onKeyDownCapture={onAnyInput}>
      {phase === 'done' && made ? <GameFinish creation={made} title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div className="sg-top" data-gob={GOBGOB_HERE}>
          {GOBGOB_HERE && <button type="button" className="sg-gob-button" aria-label={w.toys.gobgob} onClick={touchGob}><GobGobWaiting mood={aya.glad ? 'glad' : gob.curious ? 'curious' : 'waiting'} lights={lights} nudge={gob.nudge} /></button>}
          <AdventureHeading focusKey={phase}>{cue}</AdventureHeading>
        </div>
        <div className="sg-cloths" role="group" aria-label={w.clothLabel}>
          {TEXTILE_CLOTHS.map((id, index) => <button type="button" key={id} className="sg-cloth" data-cloth={id} aria-pressed={cloth === id} disabled={busy} onClick={() => { void selectionHaptic(); sounds.current?.cloth(index); setCloth(id); }}>
            <ClothPatch cloth={id} /><span>{w.cloths[id]}</span>
          </button>)}
        </div>
        <div className="sg-stage" ref={stageRef} data-wobble={wobble} data-phase={phase} data-thrum={thrum ? thrum % 2 : undefined} onPointerDown={onStageDown}>
          <TextileScene cloth={cloth} motifs={scene} view="table" held={held} story={rim} lang={lang} crosses={free} aim={drag?.over ?? null} press={press} needle={needleRef} needleThread={run?.motif ? run.motif.thread : thread} needleAway={busy} fx={sceneFx}>
            <WateringCan pour={pour} />
            <Bud stage={budStage} nudge={budNudge} />
            <Pincushion />
            <LeafLab ping={labPing} />
            <Ladybird pose={bug} />
            <Aya glad={aya.glad} hop={aya.hop} />
            {visitor && <Visitor kind={VISITORS[cloth]} pose={visitor} />}
          </TextileScene>
          <div className="sg-spots" dir="ltr" role="group" aria-label={w.hoopLabel}>
            {spotOrder.map(cell => { const t = cellTarget(cell);
              return <button type="button" key={cell} className="sg-spot" data-sg-spot={cell} data-aim={drag?.over === cell} style={at(t.x, t.y)}
                aria-label={`${sgLine(w.spot, w.flowers[flower])}, ${w.spotPlace[cellRow(cell)]} ${lang === 'he' ? TEXTILE_COLUMNS - cellColumn(cell) : cellColumn(cell) + 1}`}
                onPointerDown={() => setPress(cell)} onPointerUp={() => setPress(null)} onPointerLeave={() => setPress(null)} onPointerCancel={() => setPress(null)} onClick={() => plantAt(cell)} />; })}
            {phase === 'play' && motifs.map(motif => { const t = cellTarget(motif.cell);
              return <button type="button" key={`b${motif.cell}`} className="sg-spot sg-spot--bloom" data-sg-bloom={motif.cell} style={at(t.x, t.y)} aria-label={`${w.flowerNames[motif.flower]}, ${w.threads[motif.thread]}`} onClick={() => touchFlower(motif)} />; })}
          </div>
          {phase === 'play' && <div className="sg-toys" dir="ltr" role="group" aria-label={w.tableLabel}>
            {/* The two that wander come first, so the things that stay put are never covered by them. */}
            {bug.out && <button type="button" className="sg-toy sg-toy--small" data-toy="ladybird" style={at(bugAt.x, bugAt.y)} aria-label={w.toys.ladybird} onClick={touchBug} />}
            {visitor && !visitor.away && <button type="button" className="sg-toy sg-toy--small" data-toy="visitor" style={at(visitor.x, visitor.y)} aria-label={w.visitors[VISITORS[cloth]]} onClick={touchVisitor} />}
            <button type="button" className="sg-toy" data-toy="wateringCan" style={over(PLACES.wateringCan)} aria-label={w.toys.wateringCan} onClick={touchCan} />
            <button type="button" className="sg-toy" data-toy="hoopScrew" style={over(PLACES.screw)} aria-label={w.toys.screw} onClick={touchScrew} />
            <button type="button" className="sg-toy" data-toy="bud" style={over(PLACES.bud)} aria-label={w.toys.bud} onClick={touchBud} />
            <button type="button" className="sg-toy" data-toy="aya" style={over(AYA_BODY)} aria-label={w.toys.aya} onClick={touchAya} />
            {PLACES.leafLab && <button type="button" className="sg-toy" data-toy="leafLab" style={over(PLACES.leafLab)} aria-label={w.toys.leafLab} onClick={touchLab} />}
            <button type="button" className="sg-toy" data-toy="pincushion" style={over(PLACES.pincushion)} aria-label={w.toys.pincushion} onClick={touchNeedle} />
          </div>}
        </div>
        <div className="sg-tray">
          <div className="sg-flowers" role="group" aria-label={w.flowerLabel}>
            {TEXTILE_FLOWERS.map((id, index) => <button type="button" key={id} className="sg-card" data-flower={id} aria-pressed={flower === id} disabled={busy}
              onPointerDown={onCardDown(id)} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerCancel={onCardCancel}
              onClick={() => { if (swallowClick.current) return; void selectionHaptic(); sounds.current?.card(index); setFlower(id); }}>
              <FlowerSwatch flower={id} thread={thread} cloth={cloth} /><span>{w.flowerNames[id]}</span>
            </button>)}
          </div>
          <div className="sg-threads" role="group" aria-label={w.threadLabel}>
            {Array.from({ length: TEXTILE_THREADS }, (_, index) => <button type="button" key={index} className="sg-thread" data-thread={index} aria-pressed={thread === index} aria-label={w.threads[index]} disabled={busy} onClick={() => { void selectionHaptic(); sounds.current?.pick(index); setThread(index); }}>
              <ThreadDot thread={index} />
            </button>)}
          </div>
        </div>
        <p className="adventure-status sg-note" role="status">{note}</p>
        <div className="adventure-actions sg-actions">
          {canReopen && <button type="button" className="studio-game-button-v2" onClick={reopen}><FolderOpen size={20} aria-hidden="true" />{w.reopen}</button>}
          <button type="button" className="studio-game-button-v2" data-sg-unpick="" disabled={busy || motifs.length === 0} onClick={takeOut}><Undo2 size={20} aria-hidden="true" />{w.unpick}</button>
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" data-sg-finish="" disabled={busy || motifs.length === 0} onClick={finish}><Check size={20} aria-hidden="true" />{w.done}</button>
        </div>
        {(lines.length > 0 || fading !== null) && <ol className="sg-story" aria-label={w.storyLabel}>
          {lines.map((line, index) => <li key={`l${index}`} data-newest={index === lines.length - 1}>{line}</li>)}
          {fading !== null && story[fading] && <li key={`f${fading}`} data-leaving="true" aria-hidden="true">{story[fading]}</li>}
        </ol>}
        {hint && <HintHand step={hint.step} from={hint.from} to={hint.to} />}
      </>}
      {drag && typeof document !== 'undefined' && createPortal(<span className="sg-ghost" data-back={drag.back} style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` }} aria-hidden="true"><FlowerSwatch flower={drag.flower} thread={thread} cloth={cloth} size="ghost" /></span>, document.body)}
    </section>
  </GameShell>;
}
