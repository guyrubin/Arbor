import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Eye, EyeOff, Palette, RotateCcw, RotateCw, Search, Undo2, ZoomIn, ZoomOut, ArrowDownToLine } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { BopFriend } from '../../adventures/BopArt';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { defaultChallenge } from '../../adventures/adventureRules';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';
import {
  ALL_SHOWN, BUILD_ROTATION, DRAG_DEG_PER_UNIT, LABELS, LAND_MS, LAND_REST_MS, LAND_TILT, SOCKETS, TURN_STEP,
  coast, complete, convertPlaced, dropAt, fitsAt, homeFor, isPlaced, landFrame, landKeyframe, modeForChallenge, nextPaint, paintForRound, pieceHome, pieceOf, placeOn, pulled, pushFor, reducedLandMs,
  shownParts, tinyLine, trayOrder, unvisited, visit, type BuildMode, type LabelId, type LandStage, type PaintId, type Placed,
} from './tinyBuildersRules';
import { CX, FIBRE, PIECE_BOX, SHEATH_MIN, VIEW_H, VIEW_TILT, VIEW_W, fibreAngle, normDeg, project, toRad } from './phageGeometry';
import PhageArt, { PieceArt, fibreTips, type PartsOn } from './PhageArt';
import { CellScene, CellSurface, LeafScene, SurfaceLip, SwimmerScene, Tag, TouchRings, Turntable } from './TinyScenes';
import { LAST_STOP, SCALE_STOPS, clampStop, zoomMs } from './tinyScale';
import { ART_BEBE_PLEASED, ART_BEBE_WATCHING, ART_MONITOR, ART_PROOFLENS, ART_ROOM, ART_TRAILBENCH, ART_WATER, MONITOR_SCREEN } from './tinyKitArt';
import { createTinyTones, type TinyTones } from './tinyBuildersAudio';
import { createTinyLoop, type TinyLoop } from './tinyLoop';
import '../makerPalette.css';
import './tinyBuilders.css';

type Phase = 'build' | 'explore' | 'journey' | 'land' | 'landed' | 'cheer' | 'done';
type Hint = { kind: 'carry' | 'sideSwipe' | 'press'; x0: number; y0: number; x1: number; y1: number; piece?: string; key: number };
const NO_PARTS: PartsOn = { head: false, collar: false, tail: false, baseplate: false, fibres: [false, false, false, false, false, false] };
const NO_LIFT: readonly number[] = [0, 0, 0, 0, 0, 0];
const PART_POINT: Record<LabelId, { x: number; y: number }> = {
  head: { x: 182, y: 96 }, dna: { x: 222, y: 104 }, collar: { x: 200, y: 167 }, tail: { x: 200, y: 228 }, baseplate: { x: 200, y: 291 }, fibres: { x: 300, y: 330 },
};
const WOBBLE_MS = 520, RETURN_MS = 340, CUT_MS = 620, HINT_MS = 2600, IDLE_MS = 6000, CHEER_MS = 2300, CHEER_STILL_MS = 1500, MOOD_MS = 1300;
/** Play counter for this page only (never stored): each new game starts in the next colours with the tray laid out afresh. */
let rounds = 0;

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
const easeInOut = (u: number) => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const at = (p: { x: number; y: number }): CSSProperties => ({ left: `${p.x / VIEW_W * 100}%`, top: `${p.y / VIEW_H * 100}%` });
const pctOf = (v: number) => `${(v * 100).toFixed(2)}%`;

export default function TinyBuilders() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = TINY_BUILDERS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [round, setRound] = useState(() => rounds++);
  const [mode, setMode] = useState<BuildMode>(() => modeForChallenge(defaultChallenge(child)));
  const [phase, setPhase] = useState<Phase>('build');
  const [paint, setPaint] = useState<PaintId>(() => paintForRound(round));
  const [placed, setPlaced] = useState<Placed>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [wobble, setWobble] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ parts: PartsOn; dx: number; dy: number; nonce: number } | null>(null);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ piece: string; target: string | null; back: boolean } | null>(null);
  const [rotation, setRotation] = useState(BUILD_ROTATION);
  const [cutOn, setCutOn] = useState(false);
  const [cut, setCut] = useState(0);
  const [visited, setVisited] = useState<readonly LabelId[]>([]);
  const [lit, setLit] = useState<LabelId | null>(null);
  const [poke, setPoke] = useState<{ part: LabelId; nonce: number } | null>(null);
  const [toy, setToy] = useState<{ sheath: number; lift: readonly number[] }>({ sheath: 1, lift: NO_LIFT });
  const [landT, setLandT] = useState(0);
  const [stop, setStop] = useState(0);
  const [zoom, setZoom] = useState<{ from: number; to: number } | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy'>('idle');
  const [said, setSaid] = useState('');
  const [hint, setHint] = useState<Hint | null>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [stageW, setStageW] = useState(360);
  const [reduced, setReduced] = useState(prefersReduced);

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLSpanElement>(null);
  const tones = useRef<TinyTones | null>(null);
  const loop = useRef<TinyLoop | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rotationRef = useRef(rotation); rotationRef.current = rotation;
  const cutRef = useRef(cut); cutRef.current = cut;
  const spin = useRef({ v: 0, tick: BUILD_ROTATION });
  const press = useRef<{ id: number; x: number; y: number; piece?: string; part?: LabelId | null; rotation: number; moved: boolean; lastX: number; lastT: number; v: number } | null>(null);
  const carry = useRef<{ piece: string; x: number; y: number; target: string | null } | null>(null);
  /** A drag ends with a click on the same piece; that click must not pick it again. */
  const suppressClick = useRef({ piece: '', until: 0 });
  const landClock = useRef({ elapsed: 0, stage: 'drift' as LandStage, fired: new Set<string>() });
  const taught = useRef({ build: false, turn: false, name: false });
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counters = useRef({ nonce: 1, ripple: 1, friend: 0, placedCount: 0 });
  const live = useRef({ phase, mode, placed, selected, reduced, zoom, stop });
  live.current = { phase, mode, placed, selected, reduced, zoom, stop };

  const later = (ms: number, run: () => void) => {
    const handle = setTimeout(() => { timers.current = timers.current.filter(t => t !== handle); run(); }, ms);
    timers.current.push(handle);
    return handle;
  };
  /** A short eased tween on a number, on the one frame loop; with motion reduced it is a cut. */
  const tween = (key: string, from: number, to: number, ms: number, set: (v: number) => void, done?: () => void) => {
    loop.current?.drop(key);
    if (reduced || ms <= 0 || !loop.current) { set(to); done?.(); return; }
    let elapsed = 0;
    loop.current.run(key, dt => {
      elapsed += dt * 1000;
      const u = Math.min(1, elapsed / ms);
      set(from + (to - from) * easeInOut(u));
      if (u >= 1) { done?.(); return false; }
      return true;
    });
  };
  const sound = (name: Parameters<TinyTones['play']>[0], step?: number) => { tones.current?.play(name, step); };
  const feel = () => { void selectionHaptic(); };

  useEffect(() => {
    const instance = createTinyTones(); tones.current = instance;
    const frames = createTinyLoop(); loop.current = frames;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(!!query?.matches);
    query?.addEventListener?.('change', onChange);
    const stage = stageRef.current;
    const measure = () => { const width = stageRef.current?.getBoundingClientRect().width; if (width) setStageW(width); };
    measure();
    const watcher = typeof ResizeObserver === 'function' && stage ? new ResizeObserver(measure) : null;
    if (stage) watcher?.observe(stage);
    return () => {
      for (const t of timers.current) clearTimeout(t); timers.current = [];
      if (hintTimer.current) clearTimeout(hintTimer.current);
      frames.stop(); loop.current = null;
      watcher?.disconnect();
      query?.removeEventListener?.('change', onChange);
      instance.dispose(); tones.current = null;
    };
  }, []);

  /* ---------------- the ghost hand: shows the first gesture, never blocks ---------------- */
  const pointOnStage = (x: number, y: number) => {
    const s = stageRef.current?.getBoundingClientRect(), r = rootRef.current?.getBoundingClientRect();
    return s && r ? { x: s.left - r.left + x / VIEW_W * s.width, y: s.top - r.top + y / VIEW_H * s.height } : null;
  };
  const showHint = () => {
    const now = live.current, root = rootRef.current?.getBoundingClientRect();
    if (!root || press.current || carry.current) return;
    const key = counters.current.nonce++;
    if (now.phase === 'build' && !taught.current.build) {
      const pieceId = now.selected ?? trayOrder(now.mode, round).find(p => !isPlaced(now.placed, p.id))?.id;
      const piece = pieceId ? pieceOf(now.mode, pieceId) : undefined;
      const well = pieceId ? trayRef.current?.querySelector<HTMLElement>(`[data-piece="${pieceId}"] .tiny-piece__well`)?.getBoundingClientRect() : null;
      const home = piece ? pointOnStage(pieceHome(piece.kind).x, pieceHome(piece.kind).y) : null;
      if (!piece || !well || !home) return;
      const from = { x: well.left + well.width / 2 - root.left, y: well.top + well.height / 2 - root.top };
      setHint(now.selected ? { kind: 'press', x0: home.x, y0: home.y, x1: home.x, y1: home.y, key } : { kind: 'carry', x0: from.x, y0: from.y, x1: home.x, y1: home.y, piece: piece.kind, key });
    } else if (now.phase === 'explore' && !taught.current.turn) {
      const a = pointOnStage(262, 226), b = pointOnStage(138, 226);
      if (!a || !b) return;
      setHint({ kind: 'sideSwipe', x0: a.x, y0: a.y, x1: b.x, y1: b.y, key });
      // The hand really turns the table a little, so the gesture shows what it does.
      if (!now.reduced) later(700, () => { if (live.current.phase === 'explore' && !press.current) pushTable(pushFor(50)); });
    } else if (now.phase === 'explore' && !taught.current.name) {
      const a = pointOnStage(PART_POINT.head.x, PART_POINT.head.y);
      if (!a) return;
      setHint({ kind: 'press', x0: a.x, y0: a.y, x1: a.x, y1: a.y, key });
    } else return;
    later(HINT_MS, () => setHint(h => h?.key === key ? null : h));
  };
  const armHint = (ms: number) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => { showHint(); armHint(HINT_MS + IDLE_MS); }, ms);
  };
  /** Any touch or key: the hand goes away and waits for six quiet seconds. */
  const noteInput = () => { setHint(null); armHint(IDLE_MS); };
  useEffect(() => { armHint(phase === 'build' ? 1100 : 3600); return () => { if (hintTimer.current) clearTimeout(hintTimer.current); }; }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- Aya, and the small answers of the room ---------------- */
  const cheerFriend = () => { setMood('happy'); later(MOOD_MS, () => setMood('idle')); };
  const tapFriend = () => {
    counters.current.friend++;
    cheerFriend(); sound('friendHop'); feel(); setSaid(w.friendHops);
    // A small secret: the third hello sets the model's six legs dancing.
    if (counters.current.friend % 3 === 0 && phase === 'explore') dance();
  };
  const ripple = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    const id = counters.current.ripple++, x = (clientX - rect.left) / rect.width, y = (clientY - rect.top) / rect.height;
    setRipples(list => [...list.slice(-3), { id, x, y }]);
    later(700, () => setRipples(list => list.filter(r => r.id !== id)));
    sound('stageTap', Math.round((1 - y) * 8)); feel();
  };

  /* ---------------- building ---------------- */
  const shake = (piece: string) => { setWobble(piece); sound('noFit'); later(WOBBLE_MS, () => setWobble(c => c === piece ? null : c)); };
  const freshParts = (socketId: string): PartsOn => {
    const before = shownParts(mode, placed), after = shownParts(mode, { ...placed, [socketId]: '1' });
    return { head: after.head && !before.head, collar: after.collar && !before.collar, tail: after.tail && !before.tail, baseplate: after.baseplate && !before.baseplate, fibres: after.fibres.map((on, i) => on && !before.fibres[i]) };
  };
  /** The piece clicks on: it flies the last little way from (dx, dy), settles, and the room answers. */
  const place = (socketId: string, pieceId: string, from: { dx: number; dy: number }) => {
    const next = { ...placed, [socketId]: pieceId };
    taught.current.build = true; setHint(null);
    setFresh({ parts: freshParts(socketId), dx: from.dx, dy: from.dy, nonce: counters.current.nonce++ });
    setPlaced(next); setSelected(null); setLastPlaced(pieceId);
    sound('snapOn', counters.current.placedCount++); feel();
    if (complete(mode, next)) {
      later(460, () => {
        setPhase('explore'); sound('whole'); cheerFriend(); setFresh(null);
        spin.current.v = reduced ? 0 : -pushFor(360); runSpin();
      });
    } else {
      // Keyboard: on to the next piece still on the tray.
      later(30, () => {
        const nextPiece = trayOrder(mode, round).find(p => !isPlaced(next, p.id));
        const el = nextPiece && trayRef.current?.querySelector<HTMLButtonElement>(`[data-piece="${nextPiece.id}"]`);
        if (el && trayRef.current?.contains(document.activeElement)) el.focus({ preventScroll: true });
      });
    }
  };
  const toScene = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return { x: (clientX - rect.left) / rect.width * VIEW_W, y: (clientY - rect.top) / rect.height * VIEW_H, inside: clientX >= rect.left - 16 && clientX <= rect.right + 16 && clientY >= rect.top - 16 && clientY <= rect.bottom + 16 };
  };
  /** From the tray's side: a tapped piece flies in from where the tray lies. */
  const fromTray = (pieceId: string, kind: Parameters<typeof pieceHome>[0]) => {
    const well = trayRef.current?.querySelector<HTMLElement>(`[data-piece="${pieceId}"]`)?.getBoundingClientRect();
    const p = well ? toScene(well.left + well.width / 2, well.top + well.height / 2) : null, home = pieceHome(kind);
    if (!p) return { dx: 0, dy: 60 };
    const dx = p.x - home.x, dy = p.y - home.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 110);
    return { dx: dx / d * reach, dy: dy / d * reach };
  };
  /** A tap on the model with a piece picked. */
  const tryTap = (pieceId: string, point: { x: number; y: number } | null) => {
    const piece = pieceOf(mode, pieceId);
    const target = piece && point ? fitsAt(mode, piece, point, placed) : null;
    if (piece && target) { place(target, pieceId, fromTray(pieceId, piece.kind)); return true; }
    shake(pieceId); return false;
  };
  const pick = (pieceId: string, keyboard: boolean) => {
    if (phase !== 'build') return;
    if (isPlaced(placed, pieceId)) { // an empty well: show where its piece went
      const socket = Object.keys(placed).find(k => placed[k] === pieceId);
      if (socket) { setFresh({ parts: shownPartsOf(socket), dx: 0, dy: -10, nonce: counters.current.nonce++ }); sound('pickUp', 2); }
      return;
    }
    const next = selected === pieceId ? null : pieceId;
    setSelected(next); setLastPlaced(null);
    if (next && keyboard) later(30, () => {
      const home = homeFor(mode, next, placed);
      stageRef.current?.querySelector<HTMLButtonElement>(`[data-socket="${home}"]`)?.focus({ preventScroll: true });
    });
  };
  const shownPartsOf = (socketId: string): PartsOn => { const s = shownParts(mode, { [socketId]: '1' }); return { ...s }; };
  /** Where the carried piece is, and where it is drawn: lifted off the finger, at the model's own size, pulled by its place. */
  const moveCarry = (clientX: number, clientY: number, lift: number) => {
    const c = carry.current, rect = stageRef.current?.getBoundingClientRect(), el = floatRef.current;
    const piece = c && pieceOf(mode, c.piece);
    if (!c || !rect || !piece) return null;
    const k = rect.width / VIEW_W;
    const centre = { x: (clientX - rect.left) / k, y: (clientY - lift - rect.top) / k };
    const drop = dropAt(mode, piece, centre, placed), shown = pulled(centre, drop);
    const x = rect.left + shown.x * k, y = rect.top + shown.y * k;
    c.x = x; c.y = y;
    if (el) { el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; el.dataset.held = drop && drop.pull > 0.5 ? 'true' : 'false'; }
    const target = drop?.socket ?? null;
    if (target !== c.target) { c.target = target; setDrag({ piece: c.piece, target, back: false }); if (target && drop && drop.pull > 0) feel(); }
    return { drop, shown };
  };
  const onPiecePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, pieceId: string) => {
    noteInput();
    if (phase !== 'build' || e.button > 0) return;
    sound('pickUp', trayOrder(mode, round).findIndex(p => p.id === pieceId)); feel();
    if (isPlaced(placed, pieceId)) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, piece: pieceId, rotation: 0, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Not capturable; the drag still follows. */ }
  };
  const liftOf = (p: { x: number; y: number }, e: { clientX: number; clientY: number }) => Math.min(34, Math.hypot(e.clientX - p.x, e.clientY - p.y) * 0.5);
  const onPiecePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || !p.piece) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
    if (!p.moved) {
      p.moved = true; setSelected(p.piece); setLastPlaced(null);
      carry.current = { piece: p.piece, x: e.clientX, y: e.clientY, target: null };
      setDrag({ piece: p.piece, target: null, back: false });
    }
    moveCarry(e.clientX, e.clientY, liftOf(p, e));
  };
  const onPiecePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || !p.piece) return;
    press.current = null;
    if (!p.moved) return; // a tap: the click picks it
    suppressClick.current = { piece: p.piece, until: performance.now() + 400 };
    const pieceId = p.piece, piece = pieceOf(mode, pieceId);
    const result = moveCarry(e.clientX, e.clientY, liftOf(p, e));
    carry.current = null;
    if (piece && result?.drop) {
      const home = pieceHome(piece.kind);
      setDrag(null); place(result.drop.socket, pieceId, { dx: result.shown.x - home.x, dy: result.shown.y - home.y });
      return;
    }
    // Drifts back to its place on the tray.
    shake(pieceId);
    const well = trayRef.current?.querySelector<HTMLElement>(`[data-piece="${pieceId}"]`)?.getBoundingClientRect(), el = floatRef.current;
    if (el && well) el.style.transform = `translate(${(well.left + well.width / 2).toFixed(1)}px, ${(well.top + well.height / 2 - 8).toFixed(1)}px) scale(.4)`;
    setDrag({ piece: pieceId, target: null, back: true });
    later(reduced ? 0 : RETURN_MS, () => setDrag(d => d?.piece === pieceId && d.back ? null : d));
  };
  const onPieceCancel = () => { press.current = null; carry.current = null; setDrag(null); };
  const onPieceClick = (e: ReactMouseEvent, pieceId: string) => {
    const skip = suppressClick.current; suppressClick.current = { piece: '', until: 0 };
    if (e.detail > 0 && skip.piece === pieceId && performance.now() < skip.until) return;
    if (e.detail === 0) { noteInput(); sound('pickUp', 1); }
    pick(pieceId, e.detail === 0);
  };
  const switchMode = (next: BuildMode) => {
    if (next === mode || phase !== 'build') return;
    sound('pickUp', next === 'full' ? 4 : 0); feel();
    setPlaced(convertPlaced(mode, next, placed)); setMode(next); setSelected(null); setLastPlaced(null); setFresh(null);
  };

  /* ---------------- the turntable: weight, coast, marks that tick ---------------- */
  const runSpin = () => {
    loop.current?.run('spin', dt => {
      const next = coast(spin.current.v, dt);
      spin.current.v = next.velocity;
      const angle = rotationRef.current + next.turn;
      rotationRef.current = angle; setRotation(angle);
      const mark = Math.floor(angle / 15);
      if (mark !== spin.current.tick) { spin.current.tick = mark; sound('turnTick', mark); }
      return next.velocity !== 0;
    });
  };
  const pushTable = (push: number) => {
    if (reduced) { const angle = rotationRef.current + push / pushFor(1); rotationRef.current = angle; setRotation(angle); return; }
    spin.current.v += push; runSpin();
  };
  const turn = (deg: number) => { taught.current.turn = true; sound('turnPush'); feel(); pushTable(pushFor(deg)); };
  const toggleCut = () => {
    const next = !cutOn; setCutOn(next);
    sound(next ? 'cutOpen' : 'cutClose'); feel();
    if (!next && lit === 'dna') setLit(null);
    tween('cut', cutRef.current, next ? 1 : 0, CUT_MS, v => setCut(v));
  };
  /** The model's own little answers when a part is poked again. */
  const dance = () => {
    sound('legDance');
    if (reduced || !loop.current) return;
    let elapsed = 0;
    loop.current.run('toy', dt => {
      elapsed += dt;
      const lift = Array.from({ length: 6 }, (_, i) => { const u = (elapsed - i * 0.075) / 0.3; return u > 0 && u < 1 ? Math.sin(u * Math.PI) * 15 : 0; });
      const over = elapsed > 0.8;
      setToy(t => ({ sheath: t.sheath, lift: over ? NO_LIFT : lift }));
      return !over;
    });
  };
  const spring = () => {
    sound('tailSpring');
    if (reduced || !loop.current) return;
    let elapsed = 0;
    loop.current.run('toy', dt => {
      elapsed += dt;
      const u = Math.min(1, elapsed / 0.62);
      // Squeeze quickly, then spring back with one small overshoot.
      const squeeze = u < 0.3 ? easeInOut(u / 0.3) : Math.max(0, 1 - (u - 0.3) / 0.7) * Math.cos((u - 0.3) * 9);
      setToy({ sheath: 1 - 0.3 * Math.max(-0.08, squeeze), lift: NO_LIFT });
      if (u >= 1) { setToy({ sheath: 1, lift: NO_LIFT }); return false; }
      return true;
    });
  };
  const name = (label: LabelId) => {
    if (label === 'dna' && !cutOn) { setSaid(w.lookForDna); setPoke({ part: 'head', nonce: counters.current.nonce++ }); sound('noFit'); return; }
    taught.current.name = true; setHint(null);
    const again = lit === label, before = visited.length;
    const seen = visit(visited, label, cutOn);
    setLit(label); setVisited(seen); feel();
    sound('glassNote', LABELS.indexOf(label));
    if (again || visited.includes(label)) { if (label === 'tail') spring(); else if (label === 'fibres') dance(); else setPoke({ part: label, nonce: counters.current.nonce++ }); }
    if (seen.length > before && unvisited(seen).length === 0) later(350, () => { sound('whole'); cheerFriend(); });
  };
  const repaint = () => { setPaint(p => nextPaint(p)); sound('rePaint', counters.current.nonce); feel(); setSaid(w.repainted); setPoke({ part: 'head', nonce: counters.current.nonce++ }); };
  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    noteInput();
    if (e.button > 0 || (e.target as Element).closest?.('button')) return;
    if (phase === 'explore') {
      loop.current?.drop('spin'); spin.current.v = 0;
      const part = (e.target as Element).closest?.('[data-part]')?.getAttribute('data-part') as LabelId | null;
      press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, part, rotation: rotationRef.current, moved: false, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Fine without capture. */ }
    }
  };
  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || phase !== 'explore' || p.piece) return;
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    if (!p.moved && Math.abs(e.clientX - p.x) < 6) return;
    p.moved = true; taught.current.turn = true;
    const perPx = VIEW_W / rect.width * DRAG_DEG_PER_UNIT;
    const angle = p.rotation - (e.clientX - p.x) * perPx;
    const dt = Math.max(1, e.timeStamp - p.lastT) / 1000;
    // The speed of the hand, smoothed: what the table keeps when it is let go.
    p.v = p.v * 0.6 + (-(e.clientX - p.lastX) * perPx / dt) * 0.4; p.lastX = e.clientX; p.lastT = e.timeStamp;
    rotationRef.current = angle; setRotation(angle);
    const mark = Math.floor(angle / 15);
    if (mark !== spin.current.tick) { spin.current.tick = mark; sound('turnTick', mark); }
  };
  const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest?.('button')) { press.current = null; return; }
    const p = press.current;
    if (phase === 'build') {
      if (drag) return;
      if (selected) { tryTap(selected, toScene(e.clientX, e.clientY)); return; }
      // Nothing picked yet: the room answers, and the tray's pieces give a little hop to show where to start.
      ripple(e.clientX, e.clientY); setWobble('all'); later(WOBBLE_MS, () => setWobble(c => c === 'all' ? null : c));
      return;
    }
    if (phase !== 'explore') { if (!zoom) ripple(e.clientX, e.clientY); return; }
    if (!p || p.id !== e.pointerId || p.piece) return;
    press.current = null;
    if (p.moved) { if (!reduced && e.timeStamp - p.lastT < 90 && Math.abs(p.v) > 30) { spin.current.v = p.v; runSpin(); } return; }
    if (p.part) { name(p.part); return; }
    const point = toScene(e.clientX, e.clientY);
    // The turntable itself is a toy: a tap on it gives it a push.
    if (point && point.y > FIBRE.tip.y - 26 && point.y < FIBRE.tip.y + 46) { sound('turnPush'); feel(); pushTable(pushFor(point.x < CX ? 120 : -120)); taught.current.turn = true; return; }
    ripple(e.clientX, e.clientY);
  };
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== 'explore' || e.target !== e.currentTarget) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); noteInput(); turn(TURN_STEP); }
    if (e.key === 'ArrowRight') { e.preventDefault(); noteInput(); turn(-TURN_STEP); }
  };

  /* ---------------- the zoom: from the bench into the drop ---------------- */
  const startJourney = () => {
    loop.current?.drop('spin'); loop.current?.drop('toy'); spin.current.v = 0;
    setToy({ sheath: 1, lift: NO_LIFT }); setLit(null); setHint(null); setSaid('');
    setStop(0); setZoom(null); setLandT(0); setPhase('journey');
    sound('arrive', 0); feel();
  };
  const zoomTo = (to: number) => {
    const target = clampStop(to);
    if (zoom || target === stop || (phase !== 'journey' && phase !== 'landed')) return;
    const from = stop, step = target > from ? from + 1 : from - 1;
    feel(); sound(step > from ? 'zoomDive' : 'zoomRise');
    if (phase === 'landed') { setPhase('journey'); setLandT(0); }
    const arrive = () => { setStop(step); setZoom(null); sound('arrive', step); if (step === LAST_STOP) cheerFriend(); };
    if (reduced) { arrive(); return; }
    setZoom({ from, to: step });
    later(zoomMs(Math.min(from, step)), arrive);
  };

  /* ---------------- landing ---------------- */
  const startLanding = () => {
    setPhase('land'); setLandT(0); setSaid(''); feel();
    if (!cutOn) setCutOn(true);
    tween('cut', cutRef.current, 1, CUT_MS, v => setCut(v));
    const clock = landClock.current;
    clock.elapsed = 0; clock.stage = 'drift'; clock.fired = new Set();
    const total = reduced ? reducedLandMs() : LAND_MS;
    loop.current?.run('land', dt => {
      clock.elapsed += dt * 1000;
      const t = reduced ? landKeyframe(clock.elapsed) : Math.min(1, clock.elapsed / LAND_MS);
      setLandT(t);
      const f = landFrame(t);
      const cue = (key: string, when: boolean, run: () => void) => { if (when && !clock.fired.has(key)) { clock.fired.add(key); run(); } };
      cue('touch', t >= 0.3, () => { sound('feetTouch'); feel(); });
      cue('whumph', f.settle >= 26, () => { sound('whumph'); feel(); });
      cue('squeeze', t >= 0.52, () => sound('squeeze'));
      cue('slide', t >= 0.7, () => sound('threadSlide'));
      cue('in', f.dna >= 0.98, () => { sound('threadIn'); cheerFriend(); });
      if (clock.elapsed >= total + LAND_REST_MS) { setPhase('landed'); return false; }
      return true;
    });
  };
  /* ---------------- the finish: back on the bench, a turn, six dancing legs ---------------- */
  const startCheer = () => {
    loop.current?.drop('land');
    setPhase('cheer'); setCutOn(false); setCut(0); setLit(null); setZoom(null); setMood('happy'); feel();
    sound('cheerUp');
    if (!reduced) {
      spin.current.v = -pushFor(300); runSpin();
      later(260, () => { if (!loop.current) return; let elapsed = 0; loop.current.run('toy', dt => {
        elapsed += dt;
        const lift = Array.from({ length: 6 }, (_, i) => { const u = (elapsed - i * 0.09) / 0.34; return u > 0 && u < 1 ? Math.sin(u * Math.PI) * 18 : 0; });
        const over = elapsed > 0.95;
        setToy({ sheath: 1, lift: over ? NO_LIFT : lift });
        return !over;
      }); });
    }
    later(reduced ? CHEER_STILL_MS : CHEER_MS, () => setPhase('done'));
  };
  const reset = () => {
    for (const t of timers.current) clearTimeout(t); timers.current = [];
    for (const key of ['spin', 'toy', 'land', 'cut']) loop.current?.drop(key);
    tones.current?.stop();
    const next = rounds++;
    taught.current = { build: false, turn: false, name: false }; counters.current.placedCount = 0; spin.current.v = 0;
    setRound(next); setPaint(paintForRound(next));
    setPhase('build'); setPlaced({}); setSelected(null); setWobble(null); setFresh(null); setLastPlaced(null); setDrag(null);
    rotationRef.current = BUILD_ROTATION; setRotation(BUILD_ROTATION); setCutOn(false); setCut(0); setVisited([]); setLit(null); setPoke(null);
    setToy({ sheath: 1, lift: NO_LIFT }); setLandT(0); setStop(0); setZoom(null); setMood('idle'); setSaid(''); setHint(null); setRipples([]);
  };

  /* ---------------- what is drawn ---------------- */
  const building = phase === 'build';
  const onBench = phase === 'build' || phase === 'explore' || phase === 'cheer';
  const landing = phase === 'land' || phase === 'landed';
  const rot = normDeg(rotation);
  const shown = useMemo(() => building ? shownParts(mode, placed) : ALL_SHOWN, [building, mode, placed]);
  const target = building ? drag?.target ?? (selected && mode === 'assisted' ? homeFor(mode, selected, placed) : null) : null;
  const glow = useMemo<PartsOn>(() => target ? shownParts(mode, { [target]: '1' }) : NO_PARTS, [mode, target]);
  const frame = landFrame(landing ? landT : 0);
  const benchTips = useMemo(() => fibreTips(rot, VIEW_TILT), [rot]);
  const landTips = useMemo(() => fibreTips(BUILD_ROTATION, frame.tilt), [frame.tilt]);
  const missing = unvisited(visited);
  const front = (() => { // the fibre nearest the eye, for the hand's and the keyboard's aim
    let best = 0, near = -2;
    for (let i = 0; i < 6; i++) { const n = Math.sin(toRad(fibreAngle(i, rot))); if (n > near) { near = n; best = i; } }
    const p = project(FIBRE.knee.r * 0.5 + FIBRE.tip.r * 0.5, fibreAngle(best, 0), (FIBRE.knee.y + FIBRE.tip.y) / 2, rot, VIEW_TILT);
    return { x: p.sx, y: p.sy };
  })();
  void front;
  const pieces = trayOrder(mode, round);
  const here = SCALE_STOPS[clampStop(stop)];
  const cue = phase === 'build' ? w.build : phase === 'explore' ? w.whole : phase === 'journey' ? w.journey : phase === 'land' ? w.landing : phase === 'landed' ? w.landed : w.cheer;
  const pieceName = (id: string) => { const p = pieceOf(mode, id); return p ? w.pieces[p.kind] : ''; };
  const status = phase === 'build'
    ? selected ? tinyLine(mode === 'assisted' ? w.chosen : w.chosenFull, pieceName(selected))
      : lastPlaced ? tinyLine(w.placed, pieceName(lastPlaced)) : mode === 'assisted' ? w.buildAssisted : w.buildFull
    : phase === 'explore'
      ? said || (!lit ? w.turnHint : missing.length === 0 ? w.nameAll : missing.length === 1 && missing[0] === 'dna' && !cutOn ? w.lookForDna : w.nameNext)
      : phase === 'land' ? w[frame.stage === 'drift' ? 'drift' : frame.stage] : '';
  const k = stageW / VIEW_W;
  const dragPiece = drag ? pieceOf(mode, drag.piece) : undefined;
  const dragBox = dragPiece ? PIECE_BOX[dragPiece.kind] : null;
  const pairOf = (socket: string | null | undefined) => socket?.startsWith('fibres-') ? Number(socket.slice(7)) : 0;
  const view = onBench ? 'bench' : phase === 'journey' && stop === 0 && !zoom ? 'lensDesk' : 'screen';
  // The two pictures of a zoom: the one being left and the one arriving.
  const layerState = (index: number): string | undefined => {
    if (zoom) return zoom.from === index ? (zoom.to > zoom.from ? 'leave-in' : 'leave-out') : zoom.to === index ? (zoom.to > zoom.from ? 'arrive-in' : 'arrive-out') : undefined;
    return !onBench && stop === index ? 'here' : undefined;
  };
  // The first dive goes into the screen of the picture (it sits in the upper part of the stage); the rest into the ringed thing.
  const ringOf = (index: number) => index === 0 ? { x: CX, y: 134, r: 30 } : SCALE_STOPS[Math.min(index, LAST_STOP)].ring ?? { x: CX, y: 220, r: 30 };
  const zoomOrigin = zoom ? ringOf(Math.min(zoom.from, zoom.to)) : null;
  const zoomStyle = zoom && zoomOrigin ? { '--tiny-fx': `${zoomOrigin.x / VIEW_W * 100}%`, '--tiny-fy': `${zoomOrigin.y / VIEW_H * 100}%`, '--tiny-zoom-ms': `${zoomMs(Math.min(zoom.from, zoom.to))}ms` } as CSSProperties : undefined;
  const screenClip = `polygon(${MONITOR_SCREEN.map(([x, y]) => `${pctOf(x)} ${pctOf(y)}`).join(', ')})`;
  const friendSize = Math.round(stageW * (onBench ? 0.19 : 0.13));

  return <GameShell fullBleed autoNarrate={false} worldId="tiny-builders" title={w.title} instruction={w.instruction}>
    <section ref={rootRef} className="adventure adventure--bop tiny" data-adventure="tiny-builders" data-phase={phase} data-mode={mode} dir={lang === 'he' ? 'rtl' : 'ltr'} onKeyDownCapture={noteInput}>
      {phase === 'done' ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <AdventureHeading focusKey={phase}>{cue}</AdventureHeading>
        <div className="tiny-layout">
          <div className="tiny-stage-wrap">
            <div ref={stageRef} className="tiny-stage bop-stage" data-phase={phase} data-view={view} data-dragging={!!drag || undefined} data-zooming={!!zoom || undefined} style={zoomStyle}
              role="group" aria-label={onBench ? (building ? w.blueprint : `${w.model} ${tinyLine(w.modelTurned, Math.round(rot))}`) : landing ? w.landArt : view === 'lensDesk' ? w.desk : `${w.screen}: ${w.stopNames[here.id]}`}
              tabIndex={phase === 'explore' ? 0 : undefined}
              onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onPointerCancel={() => { press.current = null; }} onKeyDown={onStageKey}>
              {/* The bench: the Wonderworks room, the TrailBench, the turntable and the model. */}
              <div className="tiny-bench" data-on={onBench} aria-hidden="true">
                <img className="tiny-room" src={ART_ROOM.src480} srcSet={`${ART_ROOM.src480} 480w, ${ART_ROOM.src} 1024w`} sizes="(min-width: 800px) 520px, 100vw" alt="" draggable={false} decoding="async" />
                <img className="tiny-trailbench" src={ART_TRAILBENCH.src} alt="" draggable={false} decoding="async" />
                {onBench && <svg className="tiny-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" style={{ direction: 'ltr' }} focusable="false">
                  <Turntable rotation={rot} tilt={VIEW_TILT} tips={building ? [] : benchTips} faint={building} cheer={phase === 'cheer' || (phase === 'explore' && missing.length === 0)} />
                  <PhageArt rotation={rot} tilt={VIEW_TILT} on={shown} ghost={building ? ALL_SHOWN : undefined} glow={glow} cut={cut} paint={paint}
                    sheath={toy.sheath} lift={toy.lift} fresh={building || phase === 'explore' ? fresh : null} poke={phase === 'explore' ? poke : null}
                    lit={phase === 'explore' ? lit : null} interactive={phase === 'explore'} />
                  {phase === 'cheer' && <g className="tiny-facets">{Array.from({ length: 12 }, (_, i) => {
                    const a = i / 12 * Math.PI * 2, r = 46 + (i % 3) * 16, x = CX + Math.cos(a) * r, y = 100 + Math.sin(a) * r * 0.7;
                    return <polygon key={i} points={`${x},${y - 5} ${x + 5},${y + 4} ${x - 5},${y + 4}`} style={{ fill: i % 2 ? 'var(--mk-white)' : 'var(--studio-teal)', animationDelay: `${300 + i * 60}ms`, '--tiny-fly-x': `${(Math.cos(a) * 34).toFixed(0)}px`, '--tiny-fly-y': `${(Math.sin(a) * 26 - 30).toFixed(0)}px` } as CSSProperties} />;
                  })}</g>}
                </svg>}
              </div>
              {/* The ProofLens before its screen: where the zoom begins. */}
              {!onBench && <div className="tiny-zoom__layer tiny-desk" data-state={layerState(0)} aria-hidden="true">
                <img className="tiny-desk__picture" src={ART_MONITOR.src} alt="" draggable={false} decoding="async" />
                <div className="tiny-desk__screen" style={{ clipPath: screenClip }}><div className="tiny-desk__view"><LeafScene dropName={w.dropTag} dropNote={w.dropNote} /></div></div>
              </div>}
              {/* The screen, filling the view: what the lens finds in the drop. */}
              {!onBench && <div className="tiny-screen" data-on={view === 'screen' || !!zoom} aria-hidden="true">
                <img className="tiny-water" src={ART_WATER.src} alt="" draggable={false} decoding="async" />
                <div className="tiny-zoom__layer" data-state={layerState(1)} data-toy="swimmer"><SwimmerScene swimmerName={w.swimmerTag} swimmerNote={w.swimmerNote} cellName={w.specksTag} /></div>
                <div className="tiny-zoom__layer" data-state={layerState(2)}><CellScene cellName={w.cellTag} cellNote={w.cellNote} phageName={w.phageTag} phageNote={w.phageNote} /></div>
                <div className="tiny-zoom__layer" data-state={layerState(3)}>
                  <svg className="tiny-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid slice" style={{ direction: 'ltr' }} focusable="false">
                    <g transform={`translate(0 ${(-frame.camera).toFixed(2)})`}>
                      <CellSurface tilt={frame.tilt} arrived={landing ? Math.max(0, (frame.dna - 0.7) / 0.3) : 0} />
                      <g className={landing ? undefined : 'tiny-hover'}><g transform={`translate(0 ${frame.descent.toFixed(2)})`}>
                        <PhageArt rotation={BUILD_ROTATION} tilt={frame.tilt} cut={landing ? cut : 0} paint="real" sheath={frame.sheath} settle={frame.settle} dna={frame.dna} thread={landing}
                          under={landing && frame.descent > 53 ? <g transform={`translate(0 ${(-frame.descent).toFixed(2)})`}><SurfaceLip tilt={frame.tilt} /></g> : null} />
                      </g></g>
                      {landing && frame.stage !== 'drift' && <TouchRings tips={landTips.map(t => ({ x: t.x, y: t.y + 54 }))} nonce={1} />}
                    </g>
                  </svg>
                  {phase === 'journey' && stop === LAST_STOP && !zoom && <Tag x={CX + 78} y={96} name={w.phageTag} note={w.phageNote} />}
                </div>
                <span className="tiny-screen__frame" />
                {zoom && <span className="tiny-dive" data-dir={zoom.to > zoom.from ? 'in' : 'out'}>{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--tiny-a': `${i * 40 + 12}deg`, animationDelay: `${i * 70}ms` } as CSSProperties} />)}</span>}
              </div>}
              {/* Bebe watches his ProofLens's screen (the kit's own render, flipped to face it). */}
              {!onBench && <img className="tiny-watcher" data-pleased={mood === 'happy' || phase === 'landed' || undefined} src={mood === 'happy' || phase === 'landed' ? ART_BEBE_PLEASED.src480 : ART_BEBE_WATCHING.src480} alt="" draggable={false} decoding="async" />}
              {ripples.map(r => <span key={r.id} className="tiny-ripple" style={{ left: pctOf(r.x), top: pctOf(r.y) }} aria-hidden="true" />)}
              {phase !== 'cheer' && <button type="button" className="tiny-friend" data-toy="friend" aria-label={w.friend} onClick={e => { e.stopPropagation(); tapFriend(); }}><BopFriend friend="aya" mood={mood} size={friendSize} /></button>}
              {phase === 'cheer' && <span className="tiny-friend" aria-hidden="true"><BopFriend friend="aya" mood="happy" size={friendSize} /></span>}
              {phase === 'explore' && <button type="button" className="tiny-lens" data-control="lens" data-next={missing.length === 0 || undefined} aria-label={w.find} title={w.find} onClick={e => { e.stopPropagation(); startJourney(); }}><img src={ART_PROOFLENS.src} alt="" draggable={false} /></button>}
              {building && selected && SOCKETS[mode].map(s => <button type="button" key={s.id} className="tiny-spot" data-socket={s.id} style={at(s.at)}
                aria-label={placed[s.id] ? tinyLine(w.placeFilled, w.pieces[s.kind]) : tinyLine(w.placeHere, w.pieces[s.kind])} aria-disabled={!!placed[s.id]}
                onClick={e => { e.stopPropagation(); if (!selected || placed[s.id]) return; const piece = pieceOf(mode, selected); if (piece && placeOn(mode, placed, selected, s.id)) place(s.id, selected, fromTray(selected, piece.kind)); else shake(selected); }} />)}
            </div>
            {phase === 'explore' && <div className="tiny-corners" data-kind="turn" dir="ltr">
              <button type="button" className="tiny-round" data-turn="left" aria-label={w.turnLeft} title={w.turnLeft} onClick={() => turn(TURN_STEP)}><RotateCcw size={24} aria-hidden="true" /></button>
              <button type="button" className="tiny-round" data-turn="right" aria-label={w.turnRight} title={w.turnRight} onClick={() => turn(-TURN_STEP)}><RotateCw size={24} aria-hidden="true" /></button>
            </div>}
            {phase === 'explore' && <button type="button" className="tiny-round tiny-paint" data-control="paint" aria-label={w.repaint} title={w.repaint} onClick={repaint}><Palette size={24} aria-hidden="true" /></button>}
            {(phase === 'journey' || phase === 'landed') && <div className="tiny-corners" dir="ltr">
              <button type="button" className="tiny-round" data-zoom="out" aria-label={w.zoomOut} title={w.zoomOut} disabled={stop === 0 || !!zoom} onClick={() => zoomTo(stop - 1)}><ZoomOut size={24} aria-hidden="true" /></button>
              <button type="button" className="tiny-round" data-zoom="in" aria-label={w.zoomIn} title={w.zoomIn} disabled={stop === LAST_STOP || !!zoom} onClick={() => zoomTo(stop + 1)}><ZoomIn size={24} aria-hidden="true" /></button>
            </div>}
          </div>
          <div className="tiny-panel">
            {phase === 'build' && <>
              <div ref={trayRef} className="tiny-tray" role="group" aria-label={w.tray} data-count={pieces.length} data-hop={wobble === 'all' || undefined}>
                {pieces.map((p, i) => {
                  const done = isPlaced(placed, p.id), label = w.pieces[p.kind];
                  return <button type="button" key={p.id} className="tiny-piece" data-piece={p.id} data-kind={p.kind} data-done={done} data-selected={selected === p.id} data-wobble={wobble === p.id}
                    data-lifted={drag?.piece === p.id || undefined} aria-pressed={selected === p.id} aria-disabled={done} style={{ '--tiny-i': i } as CSSProperties}
                    aria-label={done ? tinyLine(w.pieceDone, label) : selected === p.id ? tinyLine(w.pieceChosen, label) : tinyLine(w.pieceReady, label)}
                    onPointerDown={e => onPiecePointerDown(e, p.id)} onPointerMove={onPiecePointerMove} onPointerUp={onPiecePointerUp} onPointerCancel={onPieceCancel} onClick={e => onPieceClick(e, p.id)}>
                    <span className="tiny-piece__well">{!done && <PieceArt kind={p.kind} rotation={BUILD_ROTATION} tilt={VIEW_TILT} paint={paint} />}{done && <Check className="tiny-piece__tick" size={22} aria-hidden="true" />}</span>
                    <span className="tiny-piece__name">{label}</span>
                  </button>;
                })}
              </div>
              <p className="adventure-status tiny-status" role="status">{status}</p>
              <div className="adventure-challenge tiny-modes" role="group" aria-label={w.modes}>
                {(['assisted', 'full'] as const).map(m => <button type="button" key={m} aria-pressed={mode === m} onClick={() => switchMode(m)}>{w[m]}</button>)}
              </div>
            </>}
            {phase === 'explore' && <>
              <div className="tiny-label" data-open={!!lit} aria-live="polite">
                {lit ? <><p className="tiny-label__name">{w.labels[lit].name}{lit === 'dna' && <span className="tiny-label__where">{w.insideHead}</span>}</p><p className="tiny-label__text">{w.labels[lit].text}</p></>
                  : <p className="tiny-label__text tiny-label__text--hint">{w.turnHint}</p>}
              </div>
              <div className="tiny-parts" role="group" aria-label={w.parts}>
                {LABELS.map(l => {
                  const seen = visited.includes(l), hidden = l === 'dna' && !cutOn;
                  return <button type="button" key={l} className="tiny-part" data-label={l} data-seen={seen} data-lit={lit === l} data-hidden={hidden || undefined} aria-pressed={lit === l}
                    aria-label={seen ? w.labels[l].name : hidden ? w.partHidden : w.partUnknown} onClick={() => name(l)}>
                    <span className="tiny-part__well"><PieceArt kind={l === 'fibres' ? 'fibres' : l} rotation={BUILD_ROTATION} tilt={VIEW_TILT} paint={paint} className="tiny-part__art" />{seen && <Check className="tiny-part__tick" size={14} aria-hidden="true" />}</span>
                    <span className="tiny-part__name">{seen ? w.labels[l].name : ''}</span>
                  </button>;
                })}
              </div>
              <div className="adventure-actions tiny-actions">
                <button type="button" aria-pressed={cutOn} data-control="inside" onClick={toggleCut}>{cutOn ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}{cutOn ? w.close : w.lookInside}</button>
                <button type="button" className="adventure-go" data-control="find" onClick={startJourney}><Search size={20} aria-hidden="true" />{w.find}</button>
              </div>
              <p className="adventure-status tiny-status tiny-status--quiet" role="status">{lit ? status : ''}</p>
            </>}
            {(phase === 'journey' || phase === 'landed') && <>
              <div className="tiny-label" data-open="true" aria-live="polite">
                {phase === 'journey' ? <><p className="tiny-label__name">{w.stopNames[here.id]}</p><p className="tiny-label__text">{w.stopText[here.id]}</p><p className="tiny-label__note">{here.id === 'phage' ? w.beyond : here.id === 'leaf' ? '' : w.approx}</p></>
                  : <><p className="tiny-label__text">{w.scale}</p><p className="tiny-label__note">{w.colours}</p></>}
              </div>
              <div className="tiny-ladder" role="group" aria-label={w.stops}>
                {SCALE_STOPS.map((s, i) => <button type="button" key={s.id} className="tiny-rung" data-stop={s.id} data-here={i === stop} data-seen={i <= stop} aria-pressed={i === stop} disabled={!!zoom} onClick={() => zoomTo(i)}>
                  <span className="tiny-rung__dot" /><span className="tiny-rung__name">{w.stopNames[s.id]}</span>
                </button>)}
              </div>
              <div className="adventure-actions tiny-actions">
                {phase === 'journey' && stop < LAST_STOP && <button type="button" className="adventure-go" data-control="zoom" disabled={!!zoom} onClick={() => zoomTo(stop + 1)}><ZoomIn size={20} aria-hidden="true" />{w.zoomIn}</button>}
                {phase === 'journey' && stop === LAST_STOP && <button type="button" className="adventure-go" data-control="land" disabled={!!zoom} onClick={startLanding}><ArrowDownToLine size={20} aria-hidden="true" />{w.land}</button>}
                {phase === 'landed' && <>
                  <button type="button" data-control="again" onClick={startLanding}><Undo2 size={20} aria-hidden="true" />{w.again}</button>
                  <button type="button" className="adventure-go" data-control="done" onClick={startCheer}><Check size={20} aria-hidden="true" />{w.done}</button>
                </>}
              </div>
            </>}
            {phase === 'land' && <div className="tiny-label tiny-label--land" data-open="true"><p className="tiny-label__text" aria-live="polite">{status}</p>
              <ol className="tiny-steps" aria-hidden="true">{(['touch', 'settle', 'squeeze', 'inside'] as const).map((s, i, all) => <li key={s} data-on={all.indexOf(frame.stage as typeof s) >= i} />)}</ol>
            </div>}
          </div>
        </div>
        {drag && dragBox && <span ref={floatRef} className="tiny-float" data-back={drag.back} style={{ inlineSize: dragBox[2] * k, blockSize: dragBox[3] * k, marginInlineStart: -dragBox[2] * k / 2, marginBlockStart: -dragBox[3] * k / 2, transform: carry.current ? `translate(${carry.current.x.toFixed(1)}px, ${carry.current.y.toFixed(1)}px)` : undefined }} aria-hidden="true">
          <PieceArt kind={dragPiece?.kind ?? 'head'} rotation={BUILD_ROTATION} tilt={VIEW_TILT} paint={paint} pair={pairOf(drag.target ?? homeFor(mode, drag.piece, placed))} />
        </span>}
        {hint && <span key={hint.key} className="tiny-hand" data-kind={hint.kind} style={{ '--tiny-x0': `${hint.x0.toFixed(0)}px`, '--tiny-y0': `${hint.y0.toFixed(0)}px`, '--tiny-x1': `${hint.x1.toFixed(0)}px`, '--tiny-y1': `${hint.y1.toFixed(0)}px` } as CSSProperties} aria-hidden="true">
          {hint.piece && <PieceArt kind={hint.piece} rotation={BUILD_ROTATION} tilt={VIEW_TILT} paint={paint} className="tiny-hand__piece" />}
          <svg className="tiny-hand__art" viewBox="0 0 48 56" focusable="false">
            <path d="M17 4c3 0 5 2 5 5v15l2-1c2-1 4 0 5 2l1 0c2-1 4 0 5 2l1 1c3-1 5 1 5 4v8c0 8-5 14-13 14h-3c-5 0-8-2-11-7L6 34c-2-3-1-6 1-7s4 0 6 2v-20c0-3 2-5 4-5Z" style={{ fill: 'var(--studio-surface)', stroke: 'var(--studio-graphite)', strokeWidth: 2.2, strokeLinejoin: 'round' }} />
            <path d="M22 24v8M29 26v7M35 29v6" style={{ fill: 'none', stroke: 'var(--studio-graphite-soft)', strokeWidth: 1.6, strokeLinecap: 'round' }} />
          </svg>
        </span>}
      </>}
    </section>
  </GameShell>;
}
// The landing view rests at this tilt; the bench keeps the model's own.
void LAND_TILT; void SHEATH_MIN;
