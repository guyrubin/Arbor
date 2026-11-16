import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type UIEvent } from 'react';
import { createPortal } from 'react-dom';
import { Flower2, FolderOpen, Sparkles, Sprout, Sun, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { CAMERA_HOME, PLAY_AMBIENCE, HudButton, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, roundSeed, useShake, type CoachMood, type FxKind, type PlayCamera, type PlayFxHandle, type PlaySound } from '../play';
import { STITCH_GARDEN_COPY, sgFill, sgLine } from './stitchGardenCopy';
import { TEXTILE_CLOTHS, TEXTILE_COLUMNS, TEXTILE_FLOWERS, TEXTILE_MAX_MOTIFS, TEXTILE_THREADS, cellColumn, cellRow, freeCells, plant, reopenTextile, storyLines, textileOf, unpick, type TextileCloth, type TextileFlower, type TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, HOOP_CX, HOOP_CY, cellCentre, cellTarget, stitchesFor, type Stitch } from './stitchGardenStitches';
import { PARKED_NEEDLE, heldPose, landsAt, needleAt, passSpan, ringAngle, walkTo, type NeedlePlan, type NeedlePose } from './stitchGardenMotion';
import { CHAPTERS, FLOWER_LIKES, chapterAfter, hoopCentre, layoutStage, openCells, passEnds, planRound, ringLights, stagePoint, suits, wantAt, type RoundPlan, type Want } from './stitchGardenPlay';
import { createStitchSounds, type StitchSounds } from './stitchGardenAudio';
import type { VisitorKind } from './stitchGardenCritters';
import { TABLE } from './stitchGardenKit';
import { FlowerSwatch, TextileScene, type FlowerFx, type NeedleHandle, type SceneFx, type SceneMotif, type StoryRim } from './StitchArt';
import { BUG_HOME, BUG_PEEK, Fern, GOBGOB_HERE, GobGobRing, HintHand, Ladybird, LeafLab, PLACES, Pincushion, RING_R, Visitor, WaitRing, fernPlace, type BugPose, type VisitorPose } from './StitchFriends';
import { BasketArt, ClothPile, PacketArt, SpoolArt, WoodTop } from './StitchTable';
import './stitchGarden.css';

type Act = 'opening' | 'play' | 'setPiece' | 'done';
/** The needle at work: one pull of the thread, a flower coming out, or a hop in its cushion. */
interface Run { plan: NeedlePlan; motif: TextileMotif | null; start: number; landed: boolean }
/** The flower on the needle: its stitches, where each pull ends, and how many pulls are done. */
interface Sewing { motif: TextileMotif; stitches: Stitch[]; ends: number[]; pass: number }
interface Drag { flower: TextileFlower; x: number; y: number; over: number | null; home: { x: number; y: number }; back: boolean }
interface Hint { step: 1 | 2 | 3 | 4; from: { x: number; y: number }; to: { x: number; y: number } }
interface Fx { flowers: Record<number, FlowerFx>; shimmer: Record<number, { n: number; delay: number }>; beam: number; dew: SceneFx['dew']; screw: number }
interface Say { line: string; mood: CoachMood }

const FADE_MS = 700, WOBBLE_MS = 420, DRIFT_MS = 260, DRAG_START_PX = 9, HOLD_REPEAT_MS = 560;
const HINT_FIRST_MS = 1200, HINT_AGAIN_MS = 6000, HINT_PULL_MS = 1500;
/** The set-piece, in ms from its start: the light crosses, the flowers bloom up one by one, the petals drift, the ring closes, the hoop is set down, the cloth is kept. */
const SET = { light: 500, lift: 1300, liftEvery: 260, drift: 900, ring: 1500, ringEvery: 240, down: 3300, kept: 4300, end: 5600, still: 1700 } as const;
/** Which visitor comes to which cloth, and when. */
const VISITORS: Record<TextileCloth, VisitorKind> = { linen: 'honeyBee', indigo: 'fireFly', sage: 'butterFly' };
const VISITOR_AT = 4;
/** Particle tones for each thread, as palette names. */
const THREAD_TONES: readonly (readonly string[])[] = [['poppy', 'rose', 'white'], ['amber', 'sun', 'white'], ['rose', 'blossom', 'white'], ['water', 'sky', 'white'], ['white', 'snow', 'butter']];
const WANT_TONES: Record<Want, readonly string[]> = { sunSpot: ['sun', 'butter', 'white'], dewSpot: ['sky', 'sea', 'white'], fernShade: ['leaf', 'spring', 'sage'] };
const CHAPTER_ICONS = [<Sprout key="a" />, <Sun key="b" />, <Flower2 key="c" />];

/** Not saved anywhere: how many times the hoop has been taken up since the app opened (so a new sitting starts with another cloth, flower and thread), and whether the showing hand has done its two jobs. */
let sittings = 0;
let handPlanted = false, handPulled = false;

const stillMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const pct = (n: number, of: number) => `${(n / of * 100).toFixed(2)}%`;
const px = (box: { x: number; y: number; w: number; h: number }): CSSProperties => ({ left: box.x, top: box.y, width: box.w, height: box.h });

export default function StitchGarden() {
  const [round, setRound] = useState(0);
  return <StitchGardenRound key={round} onAgain={() => setRound(n => n + 1)} />;
}

function StitchGardenRound({ onAgain }: { onAgain: () => void }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = STITCH_GARDEN_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const [plan] = useState<RoundPlan>(() => planRound(roundSeed(), sittings));
  const [act, setActState] = useState<Act>('opening');
  const [chapter, setChapterState] = useState(0);
  const [held, setHeld] = useState<0 | 1 | 2>(0);
  const [cloths, setCloths] = useState<TextileCloth[]>(() => { const at = TEXTILE_CLOTHS.indexOf(plan.cloth); return TEXTILE_CLOTHS.map((_, i) => TEXTILE_CLOTHS[(at + i) % TEXTILE_CLOTHS.length]); });
  const cloth = cloths[0];
  const [flower, setFlower] = useState<TextileFlower>(plan.flower);
  const [thread, setThread] = useState(plan.thread);
  const [motifs, setMotifsState] = useState<TextileMotif[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [sewing, setSewingState] = useState<Sewing | null>(null);
  const [shown, setShownState] = useState(0);
  /** A flower being pulled out: no longer on the cloth, still visible. */
  const [leaving, setLeaving] = useState<TextileMotif | null>(null);
  /** The hem line of an unpicked flower, fading away. */
  const [fading, setFading] = useState<number | null>(null);
  const [say, setSay] = useState<Say | null>(null);
  const [toast, setToast] = useState('');
  const [wobble, setWobble] = useState(false);
  const [press, setPress] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reopened, setReopened] = useState(false);
  const [fx, setFx] = useState<Fx>({ flowers: {}, shimmer: {}, beam: 0, dew: null, screw: 0 });
  const [tug, setTug] = useState<{ x: number; y: number; n: number } | null>(null);
  const [lifted, setLifted] = useState<number[]>([]);
  const [ring, setRing] = useState(-1);
  const [caption, setCaption] = useState('');
  const [pings, setPings] = useState({ fern: 0, lab: 0, pin: 0, pile: 0 });
  const [thrum, setThrum] = useState(0);
  const [visitor, setVisitorState] = useState<(VisitorPose & { cell: number }) | null>(null);
  const [bug, setBugState] = useState<BugPose>({ theta: BUG_HOME, ms: 0, walking: false, out: false, hop: 0, dir: 1 });
  const [hint, setHint] = useState<Hint | null>(null);
  const [size, setSize] = useState({ w: 390, h: 760 });
  const [shake, bumpShake] = useShake();

  const actRef = useRef<Act>(act);
  const chapterRef = useRef(0);
  const motifsRef = useRef<TextileMotif[]>(motifs);
  const runRef = useRef<Run | null>(null);
  const sewRef = useRef<Sewing | null>(null);
  const shownRef = useRef(0);
  const visitorRef = useRef(visitor);
  const bugRef = useRef(bug);
  const poseRef = useRef<NeedlePose>(PARKED_NEEDLE);
  const needleRef = useRef<NeedleHandle>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<PlayFxHandle>(null);
  const sounds = useRef<StitchSounds | null>(null);
  const play = useRef<PlaySound | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressRef = useRef<{ flower: TextileFlower; id: number; x: number; y: number; started: boolean; home: { x: number; y: number } } | null>(null);
  const swallowClick = useRef(false);
  const chain = useRef(0), secretFound = useRef(false), bedOn = useRef(false), ayaTurn = useRef(0);

  const layout = useMemo(() => layoutStage(size.w, size.h, plan.packetTurns), [size.w, size.h, plan]);
  const layoutRef = useRef(layout); layoutRef.current = layout;

  const setAct = (next: Act) => { actRef.current = next; setActState(next); };
  const setChapter = (next: number) => { chapterRef.current = next; setChapterState(next); };
  const setMotifs = (next: TextileMotif[]) => { motifsRef.current = next; setMotifsState(next); };
  const setShown = (n: number) => { shownRef.current = n; setShownState(n); };
  const setSewing = (next: Sewing | null) => { sewRef.current = next; setSewingState(next); };
  const setVisitor = (next: (VisitorPose & { cell: number }) | null) => { visitorRef.current = next; setVisitorState(next); };
  const setBug = (next: BugPose) => { bugRef.current = next; setBugState(next); };
  const parkNeedle = (pose: NeedlePose = PARKED_NEEDLE) => { poseRef.current = pose; needleRef.current?.set(pose); };
  const startRun = (next: Run | null) => { runRef.current = next; setRun(next); };
  const later = (ms: number, task: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); task(); }, ms);
    timers.current.push(id);
  };
  const stopHold = () => { if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; } };

  useEffect(() => {
    const stitched = createStitchSounds(), kit = createPlaySound({ key: 'C' });
    sounds.current = stitched; play.current = kit;
    return () => {
      for (const id of [...timers.current, ...hintTimers.current]) clearTimeout(id);
      timers.current = []; hintTimers.current = [];
      for (const t of [sayTimer.current, toastTimer.current, visitTimer.current]) if (t) clearTimeout(t);
      if (holdTimer.current) clearInterval(holdTimer.current);
      stitched.dispose(); kit.dispose(); sounds.current = null; play.current = null; sittings += 1;
    };
  }, []);
  /* Air in the room: now and then a mote of dust drifts up through the window light. Decoration only; never under reduced motion or in a hidden tab. */
  useEffect(() => {
    const id = setInterval(() => {
      if (stillMotion() || document.visibilityState === 'hidden' || actRef.current === 'done') return;
      fxRef.current?.burst(0.06 + Math.random() * 0.6, 0.08 + Math.random() * 0.55, 'dust', { tones: ['white', 'butter'], count: 1, size: 0.5, spread: 0.6 });
    }, 1700);
    return () => clearInterval(id);
  }, []);
  /* The stage's own size: the table is laid out again whenever it changes. */
  useEffect(() => {
    const el = worldRef.current; if (!el) return;
    const measure = () => { const mw = el.clientWidth, mh = el.clientHeight; if (mw && mh) setSize(prev => (prev.w === mw && prev.h === mh ? prev : { w: mw, h: mh })); };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [act === 'done']);

  /* ── small moments on the table ───────────────────────────────────────── */

  const speak = (line: string, mood: CoachMood = 'happy', ms = 3200) => {
    setSay({ line, mood });
    if (sayTimer.current) clearTimeout(sayTimer.current);
    sayTimer.current = setTimeout(() => { sayTimer.current = null; setSay(null); }, ms);
  };
  const showToast = (text: string, ms = 2400) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { toastTimer.current = null; setToast(''); }, ms);
  };
  /** A burst of particles at a point of the hoop drawing. */
  const burstAt = (x: number, y: number, kind: FxKind, tones: readonly string[], count?: number, spread?: number) => {
    const p = stagePoint(layoutRef.current, x, y);
    fxRef.current?.burst(p.x, p.y, kind, { tones, count, spread });
  };
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
  /** Drops of water settle on the leaves of every flower on the cloth. */
  const dewNow = () => setFx(f => {
    const drops: { x: number; y: number; delay: number }[] = [];
    for (const m of motifsRef.current) {
      const leaves = stitchesFor(m.flower, m.cell).filter(s => s.part === 'leaf');
      for (const i of [1, leaves.length - 2]) { const s = leaves[i]; if (s && drops.length < 14) drops.push({ x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2, delay: drops.length * 60 }); }
    }
    return { ...f, dew: { n: (f.dew?.n ?? 0) + 1, drops } };
  });
  const beamNow = () => setFx(f => ({ ...f, beam: f.beam + 1 }));

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
      if (!here || here.away || actRef.current !== 'play') return;
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
    if (!secretFound.current) { secretFound.current = true; showToast(w.secret, 3000); play.current?.chapter(); }
  };

  /* ── the needle's clock ───────────────────────────────────────────────── */

  /** A hidden tab or the finish never leaves the needle mid-pull: whatever it was doing is simply done. */
  const settle = () => {
    const current = runRef.current;
    if (current?.plan.mode === 'unpick') setLeaving(null);
    if (current?.plan.mode === 'stitch' && !current.landed) { setShown(passSpan(current.plan).hi); landRef.current(current); }
    startRun(null); stopHold();
    // Between two pulls the needle stays over its flower, the thread still held; otherwise it is back in its cushion.
    if (current) parkNeedle(sewRef.current && current.plan.mode === 'stitch' && current.plan.tieOff === false ? heldPose(current.plan) : PARKED_NEEDLE);
    sounds.current?.stop();
  };
  const settleRef = useRef(settle); settleRef.current = settle;
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') settleRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  /** A flower is whole: it settles with a bounce and a burst of petals, its line is sewn on the hem and spoken, and the table answers. */
  const flowerLanded = (motif: TextileMotif) => {
    const count = motifsRef.current.length, c = cellCentre(motif.cell), cells = motifsRef.current.map(m => m.cell);
    const want = wantAt(plan, motif.cell), glad = suits(plan, motif.flower, motif.cell);
    flowerFx([motif.cell], 'bloom'); sounds.current?.bloom(motif.thread); void selectionHaptic();
    void hitPause(70);
    burstAt(c.x, c.y - 14, 'petal', THREAD_TONES[motif.thread], 12, 0.9); burstAt(c.x, c.y - 14, 'sparkle', ['white', 'butter'], 8);
    speak(want ? (glad ? w.suitsLine[want] : w.growsLine) : w.stories[cloths[0]][count - 1] ?? '', glad ? 'wow' : 'happy');
    // The flower the spot was hoping for: the table shows what it was offering.
    if (want && glad) {
      if (want === 'sunSpot') { beamNow(); later(stillMotion() ? 0 : 380, () => shimmerFx([...cells].sort((a, b) => cellCentre(a).x - cellCentre(b).x), 150)); sounds.current?.toy('sunbeam'); burstAt(c.x, c.y - 10, 'glint', WANT_TONES.sunSpot, 9); }
      if (want === 'dewSpot') { dewNow(); sounds.current?.toy('water'); burstAt(c.x, c.y - 4, 'drop', WANT_TONES.dewSpot, 12); }
      if (want === 'fernShade') { flowerFx(cells, 'sway', 70); sounds.current?.toy('breeze'); setPings(p => ({ ...p, fern: p.fern + 1 })); burstAt(c.x, c.y - 10, 'petal', WANT_TONES.fernShade, 9, 0.7); }
    }
    if (count >= VISITOR_AT && !visitorRef.current) visitorArrives(motif.cell);
    else if (visitorRef.current && !visitorRef.current.away) flyTo(motif.cell);
    if (count === TEXTILE_MAX_MOTIFS) { flowerFx(cells, 'bloom', 90); shimmerFx(cells, 90); }
    // A chapter ends: a flourish, a pip, and the next part of the garden opens.
    const before = chapterRef.current, after = chapterAfter(plan, before, motifsRef.current);
    if (after > before) {
      setChapter(after);
      later(stillMotion() ? 0 : 520, () => {
        play.current?.chapter(); bumpShake(); showToast(w.chapterDone[before] ?? '');
        const centre = hoopCentre(layoutRef.current);
        fxRef.current?.burst(centre.x, centre.y, 'ring', { tones: ['white', 'butter'] }); fxRef.current?.burst(centre.x, centre.y, 'petal', { tones: ['poppy', 'amber', 'rose', 'sky', 'white'], count: 22, spread: 1.7, size: 1.3 }); fxRef.current?.burst(centre.x, centre.y, 'sparkle', { tones: ['white', 'butter'], count: 10, spread: 1.5 });
        shimmerFx(cells, 90);
      });
      later(stillMotion() ? 600 : 2600, () => { if (actRef.current === 'play' && !sewRef.current) speak(after === 1 ? w.cueRow : w.cueBorder, 'curious', 3600); });
    }
  };
  /** One pull has landed: the cloth is tugged, a glint flies off the stitch, the note climbs, GobGob's ring lights one more. */
  const passLanded = (done: Run) => {
    const sew = sewRef.current; if (!sew || !done.motif) return;
    const pass = sew.pass + 1, whole = pass >= sew.ends.length, at = sew.stitches[Math.max(0, sew.ends[sew.pass] - 1)];
    const end = at.knot ? { x: at.x1, y: at.y1 } : { x: at.x2, y: at.y2 };
    setTug(t => ({ x: end.x, y: end.y, n: (t?.n ?? 0) + 1 }));
    burstAt(end.x, end.y, 'sparkle', THREAD_TONES[sew.motif.thread], 5, 0.6);
    play.current?.place(chain.current++); void selectionHaptic();
    if (whole) { setSewing(null); stopHold(); flowerLanded(sew.motif); }
    else { setSewing({ ...sew, pass }); if (pass === 1) setSay(null); }
  };
  const landRef = useRef((_run: Run) => {});
  landRef.current = (done: Run) => {
    done.landed = true;
    if (done.plan.mode === 'unpick') setLeaving(null);
    else if (done.plan.mode === 'stitch') passLanded(done);
  };
  /** One frame loop, only while the needle moves: it reads the clock, asks where the needle is, and shows that. */
  useEffect(() => {
    if (!run) return;
    let frame = 0, lastCount = -1, lastBeat = -99;
    const lands = landsAt(run.plan);
    const step = () => {
      const t = now() - run.start, f = needleAt(run.plan, t);
      poseRef.current = f.pose; needleRef.current?.set(f.pose);
      if (f.count !== lastCount) { lastCount = f.count; setShown(f.count); }
      if (run.plan.mode === 'stitch' && f.phase === 'atWork' && f.beat !== lastBeat && run.motif) {
        lastBeat = f.beat;
        const s = run.plan.stitches[Math.max(0, f.count - 1)];
        sounds.current?.stitch(run.motif.thread, f.beat + chain.current, s.part);
        setTug(tg => ({ x: f.pose.x, y: f.pose.y, n: (tg?.n ?? 0) + 1 }));
      }
      if (!run.landed && run.plan.mode !== 'flick' && t >= lands && runRef.current === run) landRef.current(run);
      if (f.phase === 'done') {
        if (runRef.current === run) { startRun(null); if (!(run.plan.mode === 'stitch' && run.plan.tieOff === false)) parkNeedle(); }
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  /* ── the showing hand ─────────────────────────────────────────────────── */

  const clearHint = () => { for (const id of hintTimers.current) clearTimeout(id); hintTimers.current = []; };
  const hintLater = (ms: number, task: () => void) => { hintTimers.current.push(setTimeout(task, ms)); };
  const spotPoint = (cell: number) => { const t = cellTarget(cell), l = layoutRef.current; return { x: l.hoop.x + t.x * l.k, y: l.hoop.y + t.y * l.k }; };
  const showHow = () => {
    if (actRef.current !== 'play') return;
    const sew = sewRef.current, l = layoutRef.current;
    if (sew) {
      // A flower waits for its first pull: the hand taps the cloth where it grows.
      if (handPulled || sew.pass > 0) return;
      const to = spotPoint(sew.motif.cell);
      setHint({ step: 3, from: to, to });
      return;
    }
    if (handPlanted || motifsRef.current.length > 0) return;
    const cell = openCells(plan, chapterRef.current, freeCells(motifsRef.current))[0];
    const box = l.packets[TEXTILE_FLOWERS.indexOf(flowerRef.current)];
    if (cell === undefined || !box) return;
    const from = { x: box.x + box.w / 2, y: box.y + box.h * 0.45 }, to = spotPoint(cell);
    const again = () => { setHint(null); hintLater(HINT_AGAIN_MS, () => showHowRef.current()); };
    if (stillMotion()) { setHint({ step: 3, from, to }); hintLater(1800, again); return; }
    setHint({ step: 1, from, to });
    hintLater(420, () => setHint(h => h && { ...h, step: 2 }));
    hintLater(1420, () => setHint(h => h && { ...h, step: 3 }));
    hintLater(2750, () => setHint(h => h && { ...h, step: 4 }));
    hintLater(3150, again);
  };
  const flowerRef = useRef(flower); flowerRef.current = flower;
  const showHowRef = useRef(showHow); showHowRef.current = showHow;
  useEffect(() => clearHint, []);
  /** Any touch or key puts the hand away and wakes the garden's air; the hand comes back after a quiet while, until its job is done. */
  const onAnyInput = () => {
    if (!bedOn.current && actRef.current !== 'done') bedOn.current = !!play.current?.ambience(PLAY_AMBIENCE.garden);
    if (handPlanted && handPulled) return;
    clearHint(); setHint(null);
    hintLater(sewRef.current ? HINT_PULL_MS * 2 : HINT_AGAIN_MS, () => showHowRef.current());
  };

  /* ── what the child does ──────────────────────────────────────────────── */

  const begin = () => {
    if (actRef.current !== 'opening') return;
    setAct('play'); speak(w.hello, 'happy', 2600);
    hintLater(HINT_FIRST_MS, () => showHowRef.current());
  };
  /** One pull of the thread: the next part of the flower is sewn (stem, leaves, petals, heart). A pull while the needle is still moving finishes that part at once and starts the next. */
  const pull = () => {
    if (actRef.current !== 'play' || !sewRef.current) return;
    handPulled = true; clearHint(); setHint(null);
    const current = runRef.current;
    if (current?.plan.mode === 'stitch') {
      setShown(passSpan(current.plan).hi);
      startRun(null); parkNeedle(current.plan.tieOff === false ? heldPose(current.plan) : PARKED_NEEDLE);
      if (!current.landed) landRef.current(current);
    }
    const sew = sewRef.current; if (!sew || sew.pass >= sew.ends.length) return;
    const first = sew.pass === 0 ? 0 : sew.ends[sew.pass - 1], last = sew.ends[sew.pass], tieOff = sew.pass === sew.ends.length - 1;
    const next: Run = { plan: { mode: 'stitch', stitches: sew.stitches, from: poseRef.current, startCount: first, first, last, tieOff }, motif: sew.motif, start: now(), landed: false };
    play.current?.tap();
    if (stillMotion()) { setShown(last); landRef.current(next); return; }
    startRun(next);
  };
  const pullRef = useRef(pull); pullRef.current = pull;
  const onSewDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pull(); stopHold();
    // Holding keeps the needle going, one pull after another.
    holdTimer.current = setInterval(() => { if (sewRef.current) pullRef.current(); else stopHold(); }, HOLD_REPEAT_MS);
  };
  /** The keyboard's pull (a pointer's is taken on the way down, so it answers at once). */
  const onSewClick = (e: ReactMouseEvent<HTMLButtonElement>) => { if (e.detail === 0) pull(); };

  const busy = act !== 'play';
  const plantAt = (cell: number, pick: TextileFlower = flower) => {
    if (busy || sewRef.current) return;
    const open = openCells(plan, chapterRef.current, freeCells(motifsRef.current));
    const next = open.includes(cell) ? plant(motifsRef.current, pick, cell, thread) : null;
    if (!next) { play.current?.back(); setWobble(true); later(WOBBLE_MS, () => setWobble(false)); return; }
    void selectionHaptic(); handPlanted = true; clearHint(); setHint(null);
    if (runRef.current?.plan.mode === 'unpick') setLeaving(null);
    startRun(null); setMotifs(next); setShown(0);
    const motif = next[next.length - 1], stitches = stitchesFor(motif.flower, motif.cell);
    setSewing({ motif, stitches, ends: passEnds(stitches), pass: 0 });
    const c = cellCentre(cell);
    play.current?.pick(); burstAt(c.x, c.y, 'dust', ['chalk', 'white'], 7, 0.5);
    setSay(null);
    if (!handPulled) hintLater(HINT_PULL_MS, () => showHowRef.current());
  };
  const takeOut = () => {
    if (busy || motifsRef.current.length === 0) return;
    void selectionHaptic(); stopHold();
    const last = motifsRef.current[motifsRef.current.length - 1];
    const stitches = stitchesFor(last.flower, last.cell);
    const midway = sewRef.current?.motif.cell === last.cell;
    const from = midway ? shownRef.current : stitches.length;
    setSewing(null); setMotifs(unpick(motifsRef.current));
    sounds.current?.pull(); play.current?.back(); chain.current = 0;
    speak(w.unpicked, 'curious', 2200);
    if (!midway) { const index = motifsRef.current.length; setFading(index); later(FADE_MS, () => setFading(value => value === index ? null : value)); }
    const here = visitorRef.current;
    if (here && !here.away && here.cell === last.cell) { const stay = motifsRef.current[motifsRef.current.length - 1]; if (stay) flyTo(stay.cell); else visitorLeaves(); }
    if (stillMotion() || from === 0) { setLeaving(null); startRun(null); parkNeedle(); return; }
    setLeaving(last); setShown(from);
    startRun({ plan: { mode: 'unpick', stitches, from: poseRef.current, startCount: from }, motif: last, start: now(), landed: false });
  };
  /** The set-piece: the hoop is lifted to the daylight, the garden blooms up off the cloth, petals cross the picture, GobGob's WaitRing closes its loop, and the cloth is set down to keep. */
  const finish = () => {
    if (busy || sewRef.current || motifsRef.current.length === 0) return;
    void selectionHaptic();
    settle(); parkNeedle(); setLeaving(null); setFading(null); setSay(null); setToast(''); clearHint(); setHint(null); handPlanted = true; handPulled = true;
    if (visitTimer.current) clearTimeout(visitTimer.current);
    visitorLeaves();
    setAct('setPiece'); setHeld(1); setCaption(w.captions[0]);
    play.current?.setPiece();
    const cells = [...motifsRef.current].sort((a, b) => cellCentre(a.cell).x - cellCentre(b.cell).x);
    if (stillMotion()) { setLifted(cells.map(m => m.cell)); setRing(4); setHeld(2); later(SET.still, () => setAct('done')); return; }
    later(SET.light, () => { beamNow(); shimmerFx(cells.map(m => m.cell), 110); });
    cells.forEach((m, i) => later(SET.lift + i * SET.liftEvery, () => {
      setLifted(up => [...up, m.cell]);
      const c = cellCentre(m.cell);
      burstAt(c.x, c.y - 12, 'petal', THREAD_TONES[m.thread], 14, 1.1); burstAt(c.x, c.y - 12, 'glint', ['white', 'butter'], 5);
      play.current?.note(5 + i, { gain: 0.045, length: 0.7 });
    }));
    const lifts = SET.lift + cells.length * SET.liftEvery;
    // Petals drift across the camera on the air from the window.
    for (let i = 0; i < 9; i++) later(lifts + i * (SET.drift / 9), () => {
      const m = cells[i % cells.length];
      fxRef.current?.burst(0.08 + (i % 5) * 0.2, 0.18 + ((i * 37) % 60) / 100, 'petal', { tones: THREAD_TONES[m.thread], angle: 20, arc: 50, spread: 1.6, size: 1.5 });
    });
    later(lifts + 200, () => bumpShake());
    const ringAt = lifts + SET.ring;
    later(ringAt - 300, () => { setRing(0); setCaption(w.captions[1]); });
    for (let i = 1; i <= 4; i++) later(ringAt + i * SET.ringEvery, () => { setRing(i); play.current?.note(8 + i * 2, { gain: 0.04, length: i === 4 ? 1.2 : 0.4 }); if (i === 4) { const centre = hoopCentre(layoutRef.current); fxRef.current?.burst(centre.x, centre.y, 'ring', { tones: ['sea', 'white'] }); void hitPause(90); } });
    later(lifts + SET.down, () => { setLifted([]); setHeld(2); flowerFx(cells.map(m => m.cell), 'bloom', 50); setFx(f => ({ ...f, screw: f.screw + 2 })); sounds.current?.toy('screw'); });
    later(lifts + SET.kept, () => { setRing(-1); setCaption(w.captions[2]); const centre = hoopCentre(layoutRef.current); fxRef.current?.burst(centre.x, centre.y, 'sparkle', { tones: ['white', 'butter', 'gold-light'] }); play.current?.chapter(); });
    later(lifts + SET.end, () => setAct('done'));
  };
  const reopen = () => {
    const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
    const open = kept && saved.isCurrent() ? reopenTextile(kept) : null;
    if (!open || busy || motifsRef.current.length > 0) return;
    void selectionHaptic(); handPlanted = true; handPulled = true; clearHint(); setHint(null);
    const at = TEXTILE_CLOTHS.indexOf(open.cloth);
    setCloths(TEXTILE_CLOTHS.map((_, i) => TEXTILE_CLOTHS[(at + i) % TEXTILE_CLOTHS.length]));
    setMotifs(open.motifs); setReopened(true); setChapter(CHAPTERS.length - 1);
    speak(w.stories[open.cloth][open.motifs.length - 1] ?? '', 'happy');
    play.current?.chapter(); shimmerFx(open.motifs.map(m => m.cell), 80);
  };

  /* ── the pickers ──────────────────────────────────────────────────────── */

  const pickThread = (index: number) => { void selectionHaptic(); sounds.current?.pick(index); setThread(index); };
  const pickFlower = (id: TextileFlower, index: number) => { void selectionHaptic(); sounds.current?.card(index); setFlower(id); };
  /** The pile: the top cloth goes into the hoop, and the one that was there comes back folded underneath. */
  const nextCloth = () => {
    if (busy) return;
    void selectionHaptic(); sounds.current?.cloth(TEXTILE_CLOTHS.indexOf(cloths[1]));
    setCloths(c => [c[1], c[2], c[0]]); setPings(p => ({ ...p, pile: p.pile + 1 })); setThrum(n => n + 1);
    const centre = hoopCentre(layoutRef.current); fxRef.current?.burst(centre.x, centre.y, 'dust', { tones: ['white', 'chalk'] });
  };

  /* ── toys: nothing here is needed, all of it answers ──────────────────── */

  const touchFlower = (motif: TextileMotif) => {
    void selectionHaptic();
    flowerFx([motif.cell], 'sway'); shimmerFx([motif.cell]);
    sounds.current?.sing(motif.thread, TEXTILE_FLOWERS.indexOf(motif.flower));
    const c = cellCentre(motif.cell); burstAt(c.x, c.y - 14, 'petal', THREAD_TONES[motif.thread], 4, 0.5);
    if (visitorRef.current && !visitorRef.current.away && visitorRef.current.cell !== motif.cell) flyTo(motif.cell);
  };
  const pokeAya = () => { void selectionHaptic(); sounds.current?.toy('aya'); speak(w.ayaSays[ayaTurn.current++ % w.ayaSays.length], 'happy', 2600); };
  const touchFern = () => {
    void selectionHaptic(); setPings(p => ({ ...p, fern: p.fern + 1 })); sounds.current?.toy('breeze'); play.current?.breath({ tone: 3200, gain: 0.018, length: 0.5 });
    const b = fernPlace(plan.fernSide); burstAt(b.x + b.w / 2, b.y + b.h / 2, 'petal', WANT_TONES.fernShade, 6, 0.6);
    flowerFx(motifsRef.current.map(m => m.cell), 'sway', 60);
  };
  const touchLab = () => { void selectionHaptic(); setPings(p => ({ ...p, lab: p.lab + 1 })); sounds.current?.pick(3); dewNow(); speak(w.labReads, 'curious', 2600); };
  const touchNeedle = () => {
    void selectionHaptic(); setPings(p => ({ ...p, pin: p.pin + 1 })); sounds.current?.toy('needle');
    if (busy || runRef.current || sewRef.current || stillMotion()) return;
    startRun({ plan: { mode: 'flick', stitches: [], from: PARKED_NEEDLE, startCount: 0 }, motif: null, start: now(), landed: false });
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
  const onHoopDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || (e.target as HTMLElement).closest('button')) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width * ART_W - HOOP_CX, y = (e.clientY - box.top) / box.height * ART_H - HOOP_CY;
    if (Math.abs(Math.hypot(x, y) - RING_R) > 17) return;
    void selectionHaptic(); sounds.current?.toy('ladybird');
    walkBug(ringAngle(x, y));
  };

  /** Drag a seed packet onto the cloth. A tap still just picks the flower. */
  const spotAt = (x: number, y: number): number | null => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    for (const el of document.elementsFromPoint(x, y)) {
      const spot = (el as HTMLElement).closest?.('[data-sg-spot]') as HTMLElement | null;
      if (spot && !(spot as HTMLButtonElement).disabled) return Number(spot.dataset.sgSpot);
    }
    return null;
  };
  const onPacketDown = (pick: TextileFlower) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy || sewRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const box = e.currentTarget.getBoundingClientRect();
    pressRef.current = { flower: pick, id: e.pointerId, x: e.clientX, y: e.clientY, started: false, home: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
  };
  const onPacketMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pressRef.current; if (!p || p.id !== e.pointerId) return;
    if (!p.started) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      p.started = true; setFlower(p.flower); play.current?.pick();
    }
    setDrag({ flower: p.flower, x: e.clientX, y: e.clientY, over: spotAt(e.clientX, e.clientY), home: p.home, back: false });
  };
  const onPacketUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = pressRef.current; if (!p || p.id !== e.pointerId) return;
    pressRef.current = null;
    if (!p.started) return;
    swallowClick.current = true; later(0, () => { swallowClick.current = false; });
    const over = spotAt(e.clientX, e.clientY);
    if (over !== null) { setDrag(null); plantAt(over, p.flower); return; }
    // Not over an open mark: the packet drifts back to its place on the table.
    play.current?.back();
    setDrag({ flower: p.flower, x: p.home.x, y: p.home.y, over: null, home: p.home, back: true });
    later(stillMotion() ? 0 : DRIFT_MS, () => setDrag(null));
  };
  const onPacketCancel = () => { pressRef.current = null; setDrag(null); };

  /** The camera moves the world, nothing else may: a focus that lands on something out of frame must not scroll the stage. */
  const keepStill = (e: UIEvent<HTMLElement>) => { const el = e.target as HTMLElement; if (el !== e.currentTarget && el.closest?.('[data-play-stage]') && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0; } };

  /* ── what is shown ────────────────────────────────────────────────────── */

  const story = w.stories[cloth];
  const free = act === 'play' && !sewing ? openCells(plan, chapter, freeCells(motifs)) : [];
  const settled = motifs.length - (sewing ? 1 : 0);
  const lines = storyLines(story, settled);
  const rim: StoryRim[] = [];
  if (lines.length > 0) rim.push({ text: lines[lines.length - 1], key: `${cloth}${lines.length - 1}` });
  if (fading !== null && story[fading]) rim.push({ text: story[fading], key: `f${fading}`, leaving: true });
  const scene: SceneMotif[] = motifs.map(motif => ({ motif, count: sewing && sewing.motif.cell === motif.cell ? shown : undefined }));
  if (leaving && run?.plan.mode === 'unpick') scene.push({ motif: leaving, count: shown, leaving: true });
  const ghost = sewing ? sewing.motif : null;
  const sceneFx = useMemo<SceneFx>(() => ({ ...fx, ghost }), [fx, ghost]);
  const used = new Set(motifs.map(m => m.cell));
  const spots = chapter >= 1 ? plan.row.map(spot => ({ ...spot, open: !used.has(spot.cell), calling: chapter === 1 && !sewing && !used.has(spot.cell) && FLOWER_LIKES[flower] === spot.want })) : [];
  const lights = sewing ? ringLights(sewing.pass, sewing.ends.length) : 0;

  const cue = sewing ? (sewing.pass === 0 ? w.cuePull : w.cuePullMore)
    : act === 'opening' ? w.hello : act === 'setPiece' ? w.cueSetPiece
    : motifs.length >= TEXTILE_MAX_MOTIFS ? w.cueFull : chapter === 0 ? w.cueSpot : chapter === 1 ? w.cueRow : motifs.length > 4 ? w.cueMore : w.cueBorder;
  const line = say?.line || cue;
  const mood: CoachMood = say?.mood ?? (act === 'setPiece' ? 'wow' : sewing ? 'curious' : 'idle');
  const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
  const canReopen = !reopened && motifs.length === 0 && !leaving && act === 'play' && !!kept && !!reopenTextile(kept);
  // Marks follow the reading direction for the keyboard; on the cloth they stay put.
  const spotOrder = lang === 'he' ? [...free].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(b) - cellColumn(a)) : free;
  const made = textileOf(cloth, motifs);
  const at = (x: number, y: number): CSSProperties => ({ left: pct(x, ART_W), top: pct(y, ART_H) });
  const over = (box: { x: number; y: number; w: number; h: number }): CSSProperties => ({ ...at(box.x + box.w / 2, box.y + box.h / 2), width: `max(var(--studio-tap), ${pct(box.w, ART_W)})`, height: `max(var(--studio-tap), ${pct(box.h, ART_H)})` });
  const bugAt = { x: HOOP_CX + Math.cos(bug.theta * Math.PI / 180) * RING_R, y: HOOP_CY + Math.sin(bug.theta * Math.PI / 180) * RING_R };
  const fern = fernPlace(plan.fernSide);
  const fernTouch = { x: Math.max(4, Math.min(ART_W - 60, fern.x + fern.w * 0.2)), y: 0, w: 60, h: 60 };

  const centre = hoopCentre(layout);
  const sewAt = sewing ? stagePoint(layout, cellCentre(sewing.motif.cell).x, cellCentre(sewing.motif.cell).y - 6) : null;
  const camera: PlayCamera = act === 'opening' ? { x: centre.x, y: centre.y, zoom: 1.32 }
    : act === 'setPiece' ? { x: centre.x, y: centre.y, zoom: lifted.length > 0 ? (layout.tall ? 1.12 : 1.3) : 1.04 }
    : sewAt ? { x: sewAt.x, y: sewAt.y, zoom: layout.tall ? 2.1 : 1.9 } : CAMERA_HOME;
  const tableScale = layout.table.ring / TABLE.r;
  /** The mat is the kit table's linen top, cut round just outside its teal edge. */
  const matR = (TABLE.r + 9) * tableScale;
  const steps = CHAPTERS.map((key, i) => ({ key, label: w.chapters[i], done: i < chapter || (i === chapter && (act === 'setPiece' || act === 'done')), icon: CHAPTER_ICONS[i] }));

  const world = <div className="sg-world" ref={worldRef} dir="ltr" data-cloth={cloth} data-tall={layout.tall}>
    <WoodTop w={layout.w} h={layout.h} />
    <div className="sg-bars" />
    <div className="sg-mat" style={{ left: layout.table.cx - matR, top: layout.table.cy - matR, width: matR * 2, height: matR * 2 }}>
      <img src={TABLE.src} alt="" draggable={false} style={{ left: matR - TABLE.cx * tableScale, top: matR - TABLE.cy * tableScale, width: TABLE.width * tableScale, height: TABLE.height * tableScale }} />
    </div>
    <div className="sg-daylight" />

    {/* While a flower is on the needle the camera is close on it: the things on the table wait, out of reach of touch and focus. */}
    <div className="sg-things" inert={sewing ? true : undefined}>
    <div className="sg-basket" style={px(layout.basket)}><BasketArt /></div>
    <div role="group" aria-label={w.threadLabel}>
      {layout.spools.map((box, index) => <button type="button" key={index} className="sg-pick sg-pick--spool" data-sg-thread={index} aria-pressed={thread === index} aria-label={w.threads[index]} disabled={busy}
        style={{ ...px(box), animationDelay: `${index * 50}ms` }} onClick={() => pickThread(index)}><SpoolArt thread={index} /></button>)}
    </div>
    <div role="group" aria-label={w.flowerLabel}>
      {TEXTILE_FLOWERS.map((id, index) => { const box = layout.packets[index];
        return <button type="button" key={id} className="sg-pick sg-pick--packet" data-sg-flower={id} aria-pressed={flower === id} disabled={busy}
          data-wants={chapter === 1 && !sewing && flower !== id && plan.row.some(s => !used.has(s.cell) && s.want === FLOWER_LIKES[id]) || undefined}
          aria-label={sgFill(w.packet, { flower: w.flowerNames[id], likes: w.likes[FLOWER_LIKES[id]] })}
          style={{ ...px(box), '--sg-turn': `${box.turn}deg`, animationDelay: `${120 + index * 60}ms` } as CSSProperties}
          onPointerDown={onPacketDown(id)} onPointerMove={onPacketMove} onPointerUp={onPacketUp} onPointerCancel={onPacketCancel}
          onClick={() => { if (swallowClick.current) return; pickFlower(id, index); }}><PacketArt flower={id} thread={thread} cloth={cloth} /></button>; })}
    </div>
    <button type="button" className="sg-pick sg-pick--pile" data-sg-pile={cloths[1]} disabled={busy} aria-label={sgFill(w.pile, { cloth: w.cloths[cloths[1]] })}
      style={{ ...px(layout.cloths), '--sg-turn': `${layout.cloths.turn}deg`, animationDelay: '420ms' } as CSSProperties} onClick={nextCloth}><ClothPile next={cloths[1]} under={cloths[2]} flip={pings.pile} /></button>
    </div>

    <div className="sg-hoopbox" style={px(layout.hoop)} data-wobble={wobble} data-thrum={thrum ? thrum % 2 : undefined} onPointerDown={onHoopDown}>
      <TextileScene cloth={cloth} motifs={scene} view="play" held={held} story={rim} lang={lang} crosses={free} aim={drag?.over ?? null} press={press} needle={needleRef} needleThread={run?.motif ? run.motif.thread : sewing ? sewing.motif.thread : thread} needleAway={act === 'setPiece'}
        needleWaiting={!!sewing && !run} spots={spots} lifted={lifted} tug={tug} fx={sceneFx}>
        <Fern side={plan.fernSide} rustle={pings.fern} />
        <Pincushion ping={pings.pin} />
        <LeafLab ping={pings.lab} />
        <Ladybird pose={bug} />
        {visitor && <Visitor kind={VISITORS[cloth]} pose={visitor} />}
      </TextileScene>
      <div className="sg-spots" role="group" aria-label={w.hoopLabel}>
        {spotOrder.map(cell => { const t = cellTarget(cell), want = chapter >= 1 ? wantAt(plan, cell) : null;
          return <button type="button" key={cell} className="sg-spot" data-sg-spot={cell} data-aim={drag?.over === cell} style={at(t.x, t.y)}
            aria-label={`${sgLine(w.spot, w.flowers[flower])}, ${w.spotPlace[cellRow(cell)]} ${lang === 'he' ? TEXTILE_COLUMNS - cellColumn(cell) : cellColumn(cell) + 1}${want ? `, ${w.wantNames[want]}` : ''}`}
            onPointerDown={() => setPress(cell)} onPointerUp={() => setPress(null)} onPointerLeave={() => setPress(null)} onPointerCancel={() => setPress(null)} onClick={() => plantAt(cell)} />; })}
        {act === 'play' && !sewing && motifs.map(motif => { const t = cellTarget(motif.cell);
          return <button type="button" key={`b${motif.cell}`} className="sg-spot sg-spot--bloom" data-sg-bloom={motif.cell} style={at(t.x, t.y)} aria-label={`${w.flowerNames[motif.flower]}, ${w.threads[motif.thread]}`} onClick={() => touchFlower(motif)} />; })}
      </div>
      {act === 'play' && !sewing && <div className="sg-toys" role="group" aria-label={w.tableLabel}>
        {/* The two that wander come first, so the things that stay put are never covered by them. */}
        {bug.out && <button type="button" className="sg-toy sg-toy--small" data-toy="ladybird" style={at(bugAt.x, bugAt.y)} aria-label={w.toys.ladybird} onClick={touchBug} />}
        {visitor && !visitor.away && <button type="button" className="sg-toy sg-toy--small" data-toy="visitor" style={at(visitor.x, visitor.y)} aria-label={w.visitors[VISITORS[cloth]]} onClick={touchVisitor} />}
        <button type="button" className="sg-toy" data-toy="hoopScrew" style={over(PLACES.screw)} aria-label={w.toys.screw} onClick={touchScrew} />
        <button type="button" className="sg-toy" data-toy="fern" style={over(fernTouch)} aria-label={w.fern} onClick={touchFern} />
        {PLACES.leafLab && <button type="button" className="sg-toy" data-toy="leafLab" style={over(PLACES.leafLab)} aria-label={w.toys.leafLab} onClick={touchLab} />}
        <button type="button" className="sg-toy" data-toy="pincushion" style={over(PLACES.pincushion)} aria-label={w.toys.pincushion} onClick={touchNeedle} />
      </div>}
      {act === 'play' && sewing && <button type="button" className="sg-sew" data-sg-sew={sewing.pass} aria-label={sgLine(w.pull, w.flowers[sewing.motif.flower])}
        onPointerDown={onSewDown} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={onSewClick} />}
    </div>

    <PlayFx ref={fxRef} layer={5} />
    {hint && act === 'play' && <HintHand step={hint.step} from={hint.from} to={hint.to} />}
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="stitch-garden" title={w.title} instruction={w.instruction}>
    <section className="sg-root" data-adventure="stitch-garden" data-phase={act} data-chapter={chapter} dir={lang === 'he' ? 'rtl' : 'ltr'} onPointerDownCapture={onAnyInput} onKeyDownCapture={onAnyInput} onScrollCapture={keepStill}>
      {act === 'done' && made ? <GameFinish creation={made} title={w.finish} subtitle={w.transfer} onPlayAgain={onAgain} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <PlayStage id="stitch-garden" grade={cloth === 'indigo' ? 'cool' : 'day'} camera={camera} shake={shake} parallax world={world}>
          {act === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={begin} />}
          <HudCoach who="aya" mood={mood} line={line} onPoke={act === 'play' ? pokeAya : undefined} pokeLabel={w.toys.aya} />
          <HudQuest steps={steps} current={act === 'play' ? chapter : -1} label={w.questLabel} />
          {sewing && act === 'play' && <div className="sg-ringchip" data-sg-lights={lights}><WaitRing lights={lights} /></div>}
          <HudToast show={!!toast}>{toast}</HudToast>
          <HudDock label={w.tableLabel} align={layout.tall ? 'center' : 'end'}>
            {act === 'play' && canReopen && <HudButton label={w.reopen} icon={<FolderOpen />} onClick={reopen} />}
            {act === 'play' && motifs.length > 0 && <HudButton label={w.unpick} icon={<Undo2 data-flip="" />} iconOnly onClick={takeOut} data={{ 'data-sg-unpick': '' }} />}
            {act === 'play' && chapter >= CHAPTERS.length - 1 && !sewing && motifs.length > 0 && <HudButton label={w.finishGo} icon={<Sparkles />} tone="go" size="l" cue={motifs.length >= TEXTILE_MAX_MOTIFS} onClick={finish} data={{ 'data-sg-finish': '' }} />}
          </HudDock>
          <PlaySetPiece active={act === 'setPiece'} caption={caption}>
            {GOBGOB_HERE && ring >= 0 && <GobGobRing lights={ring} />}
          </PlaySetPiece>
        </PlayStage>}
      {drag && typeof document !== 'undefined' && createPortal(<span className="sg-ghost" data-back={drag.back} style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` }} aria-hidden="true"><FlowerSwatch flower={drag.flower} thread={thread} cloth={cloth} size="ghost" /></span>, document.body)}
    </section>
  </GameShell>;
}
