import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Eye, EyeOff, ArrowDownToLine, RotateCcw, RotateCw, Undo2 } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { defaultChallenge } from '../../adventures/adventureRules';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';
import {
  ALL_SHOWN, BUILD_ROTATION, DRAG_DEG_PER_UNIT, LABELS, LAND_MS, LAND_REST_MS, PIECES, SOCKETS, TURN_STEP,
  complete, convertPlaced, fitsAt, homeFor, isPlaced, landFrame, landKeyframe, modeForChallenge, pieceOf, placeOn, reducedLandMs,
  shownParts, tinyLine, turnBy, unvisited, visit, type BuildMode, type LabelId, type LandStage, type Placed,
} from './tinyBuildersRules';
import { CX, FIBRE, VIEW_H, VIEW_TILT, VIEW_W, fibreAngle, normDeg, project, toRad } from './phageGeometry';
import PhageArt, { PieceArt, fibreTips, type PartsOn } from './PhageArt';
import { CellSurface, ScaleScene, StageBackdrop, Stand } from './TinyScenes';
import { createTinyTones, type TinyTones } from './tinyBuildersAudio';
import '../makerPalette.css';
import './tinyBuilders.css';

type Phase = 'build' | 'explore' | 'land' | 'scale' | 'done';
const PART_POINT: Record<LabelId, { x: number; y: number }> = {
  head: { x: 182, y: 96 }, dna: { x: 222, y: 104 }, collar: { x: 200, y: 167 }, tail: { x: 200, y: 228 }, baseplate: { x: 200, y: 291 }, fibres: { x: 300, y: 330 },
};
const WOBBLE_MS = 520, RETURN_MS = 360, SNAP_MS = 700, SPIN_MS = 2600, TURN_MS = 420, CUT_MS = 650;

function prefersReduced(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
const easeInOut = (u: number) => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const at = (p: { x: number; y: number }): CSSProperties => ({ left: `${p.x / VIEW_W * 100}%`, top: `${p.y / VIEW_H * 100}%` });

export default function TinyBuilders() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = TINY_BUILDERS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [mode, setMode] = useState<BuildMode>(() => modeForChallenge(defaultChallenge(child)));
  const [phase, setPhase] = useState<Phase>('build');
  const [placed, setPlaced] = useState<Placed>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [wobble, setWobble] = useState<string | null>(null);
  const [snapped, setSnapped] = useState<string | null>(null);
  const [lastPlaced, setLastPlaced] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ piece: string; x: number; y: number; back: boolean } | null>(null);
  const [rotation, setRotation] = useState(BUILD_ROTATION);
  const [cutOn, setCutOn] = useState(false);
  const [cut, setCut] = useState(0);
  const [visited, setVisited] = useState<readonly LabelId[]>([]);
  const [lit, setLit] = useState<LabelId | null>(null);
  const [landT, setLandT] = useState(0);
  const [reduced, setReduced] = useState(prefersReduced);

  const stageRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const tones = useRef<TinyTones | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafs = useRef<Record<string, number>>({});
  const rotationRef = useRef(rotation); rotationRef.current = rotation;
  const cutRef = useRef(cut); cutRef.current = cut;
  const press = useRef<{ id: number; x: number; y: number; piece?: string; part?: LabelId | null; rotation: number; moved: boolean } | null>(null);
  /** A drag ends with a click on the same piece; that click must not pick it again. */
  const suppressClick = useRef({ piece: '', until: 0 });
  const landClock = useRef({ elapsed: 0, last: 0, stage: 'drift' as LandStage, fired: new Set<string>() });

  const later = (ms: number, run: () => void) => {
    const handle = setTimeout(() => { timers.current = timers.current.filter(t => t !== handle); run(); }, ms);
    timers.current.push(handle);
  };
  const stopRaf = (key: string) => { const h = rafs.current[key]; if (h !== undefined) cancelAnimationFrame(h); delete rafs.current[key]; };
  /** A short eased tween on a number, by frames; with motion reduced it is a cut. */
  const tween = (key: string, from: number, to: number, ms: number, set: (v: number) => void) => {
    stopRaf(key);
    if (reduced || ms <= 0 || typeof requestAnimationFrame !== 'function') { set(to); return; }
    const start = performance.now();
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / ms);
      set(from + (to - from) * easeInOut(u));
      if (u < 1) rafs.current[key] = requestAnimationFrame(step); else delete rafs.current[key];
    };
    rafs.current[key] = requestAnimationFrame(step);
  };

  useEffect(() => {
    const instance = createTinyTones(); tones.current = instance;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(!!query?.matches);
    query?.addEventListener?.('change', onChange);
    return () => {
      for (const t of timers.current) clearTimeout(t); timers.current = [];
      for (const key of Object.keys(rafs.current)) cancelAnimationFrame(rafs.current[key]); rafs.current = {};
      query?.removeEventListener?.('change', onChange);
      instance.dispose(); tones.current = null;
    };
  }, []);
  const sound = (name: Parameters<TinyTones['play']>[0], step?: number) => { tones.current?.play(name, step); };

  /* ---------------- building ---------------- */
  const shake = (piece: string) => { setWobble(piece); later(WOBBLE_MS, () => setWobble(c => c === piece ? null : c)); };
  const place = (socketId: string, pieceId: string) => {
    const next = { ...placed, [socketId]: pieceId };
    setPlaced(next); setSelected(null); setSnapped(socketId); setLastPlaced(pieceId);
    later(SNAP_MS, () => setSnapped(c => c === socketId ? null : c));
    sound('snap'); void selectionHaptic();
    if (complete(mode, next)) {
      later(420, () => {
        setPhase('explore'); sound('whole');
        const from = rotationRef.current;
        tween('rotation', from, from - 360, SPIN_MS, v => setRotation(v));
      });
    } else {
      // Keyboard: on to the next piece still on the tray.
      later(30, () => {
        const nextPiece = PIECES[mode].find(p => !isPlaced(next, p.id));
        const el = nextPiece && trayRef.current?.querySelector<HTMLButtonElement>(`[data-piece="${nextPiece.id}"]`);
        if (el && trayRef.current?.contains(document.activeElement)) el.focus({ preventScroll: true });
      });
    }
  };
  const toScene = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const inside = clientX >= rect.left - 12 && clientX <= rect.right + 12 && clientY >= rect.top - 12 && clientY <= rect.bottom + 12;
    return inside ? { x: (clientX - rect.left) / rect.width * VIEW_W, y: (clientY - rect.top) / rect.height * VIEW_H } : null;
  };
  /** A piece let go (or a tap on the blueprint with a piece picked). */
  const tryAt = (pieceId: string, point: { x: number; y: number } | null) => {
    const piece = pieceOf(mode, pieceId);
    const target = piece && point ? fitsAt(mode, piece, point, placed) : null;
    if (target) { place(target, pieceId); return true; }
    shake(pieceId); return false;
  };
  const pick = (pieceId: string, keyboard: boolean) => {
    if (phase !== 'build' || isPlaced(placed, pieceId)) return;
    const next = selected === pieceId ? null : pieceId;
    setSelected(next); setLastPlaced(null);
    if (next && keyboard) later(30, () => {
      const home = homeFor(mode, next, placed);
      stageRef.current?.querySelector<HTMLButtonElement>(`[data-socket="${home}"]`)?.focus({ preventScroll: true });
    });
  };
  const onPiecePointerDown = (e: ReactPointerEvent<HTMLButtonElement>, pieceId: string) => {
    if (phase !== 'build' || isPlaced(placed, pieceId) || e.button > 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, piece: pieceId, rotation: 0, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Not capturable; the drag still follows. */ }
  };
  const onPiecePointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || !p.piece) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
    if (!p.moved) { p.moved = true; setSelected(p.piece); setLastPlaced(null); }
    setDrag({ piece: p.piece, x: e.clientX, y: e.clientY, back: false });
  };
  const onPiecePointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || !p.piece) return;
    press.current = null;
    if (!p.moved) return; // a tap: the click picks it
    suppressClick.current = { piece: p.piece, until: performance.now() + 400 };
    const pieceId = p.piece;
    if (tryAt(pieceId, toScene(e.clientX, e.clientY))) { setDrag(null); return; }
    // Drifts back to its place on the tray.
    const home = trayRef.current?.querySelector<HTMLElement>(`[data-piece="${pieceId}"]`)?.getBoundingClientRect();
    setDrag({ piece: pieceId, x: home ? home.left + home.width / 2 : e.clientX, y: home ? home.top + home.height / 2 : e.clientY, back: true });
    later(RETURN_MS, () => setDrag(d => d?.piece === pieceId ? null : d));
  };
  const onPieceCancel = () => { press.current = null; setDrag(null); };
  const onPieceClick = (e: ReactMouseEvent, pieceId: string) => {
    const skip = suppressClick.current; suppressClick.current = { piece: '', until: 0 };
    if (e.detail > 0 && skip.piece === pieceId && performance.now() < skip.until) return;
    pick(pieceId, e.detail === 0);
  };
  const switchMode = (next: BuildMode) => {
    if (next === mode || phase !== 'build') return;
    setPlaced(convertPlaced(mode, next, placed)); setMode(next); setSelected(null); setLastPlaced(null);
  };

  /* ---------------- turning, opening, naming ---------------- */
  const turn = (deg: number) => {
    const from = rotationRef.current;
    tween('rotation', from, from + deg, TURN_MS, v => setRotation(v));
  };
  const toggleCut = () => {
    const next = !cutOn; setCutOn(next);
    if (!next && lit === 'dna') setLit(null);
    tween('cut', cutRef.current, next ? 1 : 0, CUT_MS, v => setCut(v));
  };
  const name = (label: LabelId) => {
    if (label === 'dna' && !cutOn) return;
    setLit(label); setVisited(v => visit(v, label, cutOn));
    sound('glass', LABELS.indexOf(label));
  };
  const onStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    if (phase === 'explore') {
      stopRaf('rotation');
      const part = (e.target as Element).closest?.('[data-part]')?.getAttribute('data-part') as LabelId | null;
      press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, part, rotation: rotationRef.current, moved: false };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Fine without capture. */ }
    }
  };
  const onStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId || phase !== 'explore' || p.piece) return;
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    const dx = (e.clientX - p.x) / rect.width * VIEW_W;
    if (!p.moved && Math.abs(e.clientX - p.x) < 6) return;
    p.moved = true;
    setRotation(p.rotation - dx * DRAG_DEG_PER_UNIT);
  };
  const onStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (phase === 'build') {
      if (!selected || drag) return;
      tryAt(selected, toScene(e.clientX, e.clientY));
      return;
    }
    if (!p || p.id !== e.pointerId || p.piece) return;
    press.current = null;
    if (!p.moved && p.part) name(p.part);
  };
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (phase !== 'explore') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(TURN_STEP); }
    if (e.key === 'ArrowRight') { e.preventDefault(); turn(-TURN_STEP); }
  };

  /* ---------------- landing ---------------- */
  const startLanding = () => {
    setPhase('land'); setLit(null); setLandT(0);
    if (!cutOn) { setCutOn(true); tween('cut', cutRef.current, 1, CUT_MS, v => setCut(v)); }
    const clock = landClock.current;
    clock.elapsed = 0; clock.last = 0; clock.stage = 'drift'; clock.fired = new Set();
    const total = reduced ? reducedLandMs() : LAND_MS;
    stopRaf('land');
    const step = (now: number) => {
      // Frames stop while the tab is hidden; a long gap counts as one short step, so the landing pauses.
      const dt = clock.last ? Math.min(250, now - clock.last) : 16;
      clock.last = now; clock.elapsed += dt;
      const t = reduced ? landKeyframe(clock.elapsed) : Math.min(1, clock.elapsed / LAND_MS);
      setLandT(t);
      const f = landFrame(t);
      const cue = (key: string, when: boolean, name: Parameters<TinyTones['play']>[0]) => { if (when && !clock.fired.has(key)) { clock.fired.add(key); sound(name); } };
      cue('touch', t >= 0.3, 'touch'); cue('whumph', f.settle >= 26, 'whumph'); cue('squeeze', t >= 0.52, 'squeeze'); cue('slide', t >= 0.7, 'slide');
      if (clock.elapsed >= total + LAND_REST_MS) { delete rafs.current.land; setPhase('scale'); sound('glass', 4); return; }
      rafs.current.land = requestAnimationFrame(step);
    };
    rafs.current.land = requestAnimationFrame(step);
  };
  const reset = () => {
    for (const t of timers.current) clearTimeout(t); timers.current = [];
    for (const key of Object.keys(rafs.current)) cancelAnimationFrame(rafs.current[key]); rafs.current = {};
    tones.current?.stop();
    setPhase('build'); setPlaced({}); setSelected(null); setWobble(null); setSnapped(null); setLastPlaced(null); setDrag(null);
    setRotation(BUILD_ROTATION); setCutOn(false); setCut(0); setVisited([]); setLit(null); setLandT(0);
  };

  /* ---------------- what is drawn ---------------- */
  const building = phase === 'build';
  const shown = building ? shownParts(mode, placed) : ALL_SHOWN;
  const home = building && selected && mode === 'assisted' ? homeFor(mode, selected, placed) : null;
  const glow: PartsOn = home ? shownParts(mode, { [home]: '1' }) : { head: false, collar: false, tail: false, baseplate: false, fibres: [false, false, false, false, false, false] };
  const frame = landFrame(phase === 'land' || phase === 'scale' ? landT : 0);
  const landing = phase === 'land' || phase === 'scale';
  const tilt = landing ? frame.tilt : VIEW_TILT;
  const rot = normDeg(rotation);
  const missing = unvisited(visited);
  const front = (() => { // the fibre nearest the eye, for the keyboard target
    let best = 0, near = -2;
    for (let i = 0; i < 6; i++) { const n = Math.sin(toRad(fibreAngle(i, rot))); if (n > near) { near = n; best = i; } }
    const p = project(FIBRE.knee.r * 0.5 + FIBRE.tip.r * 0.5, fibreAngle(best, 0), (FIBRE.knee.y + FIBRE.tip.y) / 2, rot, VIEW_TILT);
    return { x: p.sx, y: p.sy };
  })();
  const partPoint = (label: LabelId) => label === 'fibres' ? front : label === 'head' && cutOn ? { x: 176, y: 100 } : label === 'head' ? { x: CX, y: 100 } : PART_POINT[label];

  const cue = phase === 'build' ? w.build : phase === 'explore' ? w.whole : phase === 'land' ? w.landing : w.scaleTitle;
  const pieceName = (id: string) => { const p = pieceOf(mode, id); return p ? w.pieces[p.kind] : ''; };
  const status = phase === 'build'
    ? selected ? tinyLine(mode === 'assisted' ? w.chosen : w.chosenFull, pieceName(selected))
      : lastPlaced ? tinyLine(w.placed, pieceName(lastPlaced)) : mode === 'assisted' ? w.buildAssisted : w.buildFull
    : phase === 'explore'
      ? !lit ? w.turnHint : missing.length === 0 ? w.nameAll : missing.length === 1 && missing[0] === 'dna' && !cutOn ? w.lookForDna : w.nameNext
      : phase === 'land' ? w[frame.stage === 'drift' ? 'drift' : frame.stage] : '';
  const tips = fibreTips(rot, tilt);

  return <GameShell fullBleed autoNarrate={false} worldId="tiny-builders" title={w.title} instruction={w.instruction}>
    <section className="adventure tiny" data-adventure="tiny-builders" data-phase={phase} data-mode={mode} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <AdventureHeading focusKey={phase}>{cue}</AdventureHeading>
        <div className="tiny-layout">
          <div className="tiny-stage-wrap">
            <div ref={stageRef} className="tiny-stage" data-phase={phase} data-dragging={!!drag || undefined}
              role="group" aria-label={phase === 'build' ? w.blueprint : phase === 'explore' ? `${w.model} ${tinyLine(w.modelTurned, Math.round(rot))}` : phase === 'land' ? w.landArt : w.scaleArt}
              tabIndex={phase === 'explore' ? 0 : undefined}
              onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onPointerCancel={() => { press.current = null; }} onKeyDown={onStageKey}>
              <svg className="tiny-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" style={{ direction: 'ltr' }} aria-hidden="true" focusable="false">
                <StageBackdrop grid={building} />
                <g transform={`translate(0 ${(-frame.camera).toFixed(2)})`}>
                  {(!landing || frame.stand > 0) && <Stand rotation={rot} tilt={tilt} tips={tips} opacity={landing ? frame.stand : 1} faint={building} />}
                  {landing && <CellSurface opacity={frame.surface} />}
                  <g transform={`translate(0 ${frame.descent.toFixed(2)})`}>
                    <PhageArt rotation={rot} tilt={tilt} on={shown} ghost={building ? ALL_SHOWN : undefined} glow={glow} cut={cut}
                      sheath={frame.sheath} settle={frame.settle} dna={frame.dna} thread={landing} lit={phase === 'explore' ? lit : null} interactive={phase === 'explore'} />
                  </g>
                </g>
                {snapped && building && (() => { const s = SOCKETS[mode].find(k => k.id === snapped); return s ? <circle className="tiny-snap" cx={s.at.x} cy={s.at.y} r={30} /> : null; })()}
              </svg>
              {phase === 'scale' && <ScaleScene words={w} />}
              {building && selected && SOCKETS[mode].map(s => <button type="button" key={s.id} className="tiny-spot" data-socket={s.id} style={at(s.at)}
                aria-label={placed[s.id] ? tinyLine(w.placeFilled, w.pieces[s.kind]) : tinyLine(w.placeHere, w.pieces[s.kind])} aria-disabled={!!placed[s.id]}
                onClick={e => { e.stopPropagation(); if (!selected || placed[s.id]) return; const next = placeOn(mode, placed, selected, s.id); if (next) place(s.id, selected); else shake(selected); }} />)}
              {phase === 'explore' && LABELS.filter(l => l !== 'dna' || cutOn).map(l => <button type="button" key={l} className="tiny-spot" data-label-spot={l} style={at(partPoint(l))}
                aria-label={w.labels[l].name} aria-pressed={lit === l} onClick={e => { e.stopPropagation(); name(l); }} />)}
            </div>
            {phase === 'explore' && <div className="tiny-turns" dir="ltr">
              <button type="button" className="tiny-turn" data-turn="left" aria-label={w.turnLeft} title={w.turnLeft} onClick={() => turn(TURN_STEP)}><RotateCcw size={24} aria-hidden="true" /></button>
              <button type="button" className="tiny-turn" data-turn="right" aria-label={w.turnRight} title={w.turnRight} onClick={() => turn(-TURN_STEP)}><RotateCw size={24} aria-hidden="true" /></button>
            </div>}
          </div>
          <div className="tiny-panel">
            {phase === 'build' && <>
              <div className="adventure-challenge tiny-modes" role="group" aria-label={w.modes}>
                {(['assisted', 'full'] as const).map(m => <button type="button" key={m} aria-pressed={mode === m} onClick={() => switchMode(m)}>{w[m]}</button>)}
              </div>
              <div ref={trayRef} className="tiny-tray" role="group" aria-label={w.tray} data-count={PIECES[mode].length}>
                {PIECES[mode].map(p => {
                  const done = isPlaced(placed, p.id), name = w.pieces[p.kind];
                  return <button type="button" key={p.id} className="tiny-piece" data-piece={p.id} data-kind={p.kind} data-done={done} data-selected={selected === p.id} data-wobble={wobble === p.id}
                    data-lifted={drag?.piece === p.id || undefined} aria-pressed={selected === p.id} aria-disabled={done}
                    aria-label={done ? tinyLine(w.pieceDone, name) : selected === p.id ? tinyLine(w.pieceChosen, name) : tinyLine(w.pieceReady, name)}
                    onPointerDown={e => onPiecePointerDown(e, p.id)} onPointerMove={onPiecePointerMove} onPointerUp={onPiecePointerUp} onPointerCancel={onPieceCancel} onClick={e => onPieceClick(e, p.id)}>
                    <span className="tiny-piece__well">{!done && <PieceArt kind={p.kind} rotation={BUILD_ROTATION} tilt={VIEW_TILT} />}</span>
                    <span className="tiny-piece__name">{name}</span>
                  </button>;
                })}
              </div>
            </>}
            {phase === 'explore' && <>
              <div className="tiny-label" data-open={!!lit} aria-live="polite">
                {lit ? <><p className="tiny-label__name">{w.labels[lit].name}{lit === 'dna' && <span className="tiny-label__where">{w.insideHead}</span>}</p><p className="tiny-label__text">{w.labels[lit].text}</p></>
                  : <p className="tiny-label__text tiny-label__text--hint">{w.turnHint}</p>}
                <div className="tiny-dots" role="img" aria-label={missing.length ? tinyLine(w.stillToFind, missing.map(l => w.labels[l].name).join(', ')) : w.allNamed}>
                  {LABELS.map(l => <span key={l} data-label={l} data-seen={visited.includes(l)} data-lit={lit === l} data-hidden={l === 'dna' && !cutOn} />)}
                </div>
              </div>
              <div className="adventure-actions tiny-actions">
                <button type="button" aria-pressed={cutOn} data-control="inside" onClick={toggleCut}>{cutOn ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}{cutOn ? w.close : w.lookInside}</button>
                <button type="button" className="adventure-go" data-control="land" onClick={startLanding}><ArrowDownToLine size={20} aria-hidden="true" />{w.land}</button>
              </div>
            </>}
            {phase === 'land' && <div className="tiny-label tiny-label--land" data-open="true"><p className="tiny-label__text" aria-live="polite">{status}</p>
              <ol className="tiny-steps" aria-hidden="true">{(['touch', 'settle', 'squeeze', 'inside'] as const).map(s => <li key={s} data-on={['touch', 'settle', 'squeeze', 'inside'].indexOf(frame.stage) >= ['touch', 'settle', 'squeeze', 'inside'].indexOf(s)} />)}</ol>
            </div>}
            {phase === 'scale' && <>
              <div className="tiny-label" data-open="true">
                <p className="tiny-label__text">{w.scale}</p>
                <p className="tiny-label__note">{w.colours}</p>
              </div>
              <div className="adventure-actions tiny-actions">
                <button type="button" onClick={startLanding}><Undo2 size={20} aria-hidden="true" />{w.again}</button>
                <button type="button" className="adventure-go" data-control="done" onClick={() => setPhase('done')}><Check size={20} aria-hidden="true" />{w.done}</button>
              </div>
            </>}
          </div>
        </div>
        <p className="adventure-status tiny-status" role="status">{phase === 'land' ? '' : status}</p>
        {drag && <span className="tiny-float" data-back={drag.back} style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }} aria-hidden="true">
          <PieceArt kind={pieceOf(mode, drag.piece)?.kind ?? 'head'} rotation={BUILD_ROTATION} tilt={VIEW_TILT} />
        </span>}
      </>}
    </section>
  </GameShell>;
}
