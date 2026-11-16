import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, Camera, ChevronsDown, RotateCcw, RotateCw, Search } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { defaultChallenge } from '../../adventures/adventureRules';
import { HudButton, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, roundSeed, useShake, type CoachMood, type HudQuestStep, type PlayCamera, type PlayFxHandle } from '../play';
import { TINY_BUILDERS_COPY } from './tinyBuildersCopy';
import { DIVE_QUEST, LAND_QUEST, PIECES, modeForChallenge, tinyLine, type LandStep, type PieceKind, type Placed } from './tinyBuildersRules';
import { createTinyEngine, type Layout, type Phase, type TinyEngine, type TinyHooks, type Touch } from './tinyEngine';
import '../makerPalette.css';
import './tinyBuilders.css';

/** Tiny Structures (the Game Cut). The world is one canvas the engine paints;
 * this file is the HUD and every real button: the parts on the bench, the
 * model, Aya, the ProofLens, the things in the lens view and the phage are
 * each a `<button>` laid over what the canvas shows, so touch, mouse, keyboard
 * and a screen reader all reach the same play. */

type Say = { who: 'aya' | 'bebe'; mood: CoachMood; key: string; piece?: PieceKind };
/** Play counter for this page only (never stored): each new game wears the next colours. */
let rounds = 0;
const BENCH: readonly Phase[] = ['opening', 'build', 'spin', 'built', 'toLens'];
/** The model's quest pips: its parts in four groups, whichever way they come. */
const GROUPS: readonly { key: string; kinds: readonly PieceKind[]; name: PieceKind }[] = [
  { key: 'head', kinds: ['head'], name: 'head' }, { key: 'tail', kinds: ['tail', 'collar', 'tailCollar'], name: 'tail' },
  { key: 'base', kinds: ['baseplate'], name: 'baseplate' }, { key: 'legs', kinds: ['fibres', 'fibrePair'], name: 'fibres' },
];

export default function TinyBuilders() {
  const [game, setGame] = useState(0);
  return <TinyGame key={game} onAgain={() => setGame(n => n + 1)} />;
}

function TinyGame({ onAgain }: { onAgain: () => void }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = TINY_BUILDERS_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [round] = useState(() => rounds++);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mode = useMemo(() => modeForChallenge(defaultChallenge(child)), []);
  const seed = useMemo(() => roundSeed(), []);
  const [phase, setPhase] = useState<Phase>('opening');
  const [placed, setPlaced] = useState<Placed>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [found, setFound] = useState(0);
  const [landDone, setLandDone] = useState<readonly LandStep[]>([]);
  const [coach, setCoach] = useState<Say>({ who: 'aya', mood: 'happy', key: 'openLine' });
  const [toast, setToast] = useState<{ key: string; arg?: string } | null>(null);
  const [caption, setCaption] = useState(0);
  const [canRecord, setCanRecord] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [shake, bump] = useShake();
  const [camera, setCamera] = useState<PlayCamera | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement | null>(null), engineRef = useRef<TinyEngine | null>(null), fxRef = useRef<PlayFxHandle | null>(null);
  const targetRef = useRef<HTMLButtonElement | null>(null), secretRef = useRef<HTMLButtonElement | null>(null), phageRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const spots = { target: targetRef, secret: secretRef, phage: phageRef };
    const hooks: TinyHooks = {
      phase: setPhase, placed: setPlaced, selected: setSelected, found: setFound, landed: setLandDone,
      say: (who, mood, key, piece) => setCoach({ who, mood, key, piece }),
      notice: (key, arg) => setToast(key ? { key, arg } : null),
      caption: setCaption, canRecord: setCanRecord, layout: setLayout, shake: bump, haptic: () => { void selectionHaptic(); }, camera: to => setCamera(to ?? undefined),
      burst: (x, y, kind, opts) => fxRef.current?.burst(x, y, kind, opts),
      spot: (role, box) => {
        const el = spots[role].current; if (!el) return;
        if (!box) { if (!el.hidden) el.hidden = true; return; }
        if (el.hidden) el.hidden = false;
        el.style.transform = `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`; el.style.inlineSize = `${box.w.toFixed(1)}px`; el.style.blockSize = `${box.h.toFixed(1)}px`;
      },
    };
    const engine = createTinyEngine(canvas, { mode, seed, round, hooks });
    engineRef.current = engine;
    return () => { engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const engine = () => engineRef.current;
  const local = (e: ReactPointerEvent<Element>): Touch => {
    const c = canvasRef.current; if (!c) return { id: e.pointerId, x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { id: e.pointerId, x: (e.clientX - r.left) * (c.clientWidth / (r.width || 1)), y: (e.clientY - r.top) * (c.clientHeight / (r.height || 1)), touch: e.pointerType !== 'mouse' };
  };
  const capture = (e: ReactPointerEvent<Element>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* The pointer is already gone. */ } };
  /** A button over a thing on the canvas: it forwards the pointer, so a drag that starts on it is the same drag. */
  const forward = (down: (t: Touch) => void) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { capture(e); down(local(e)); },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => { const t = local(e); engine()?.hover(t.x, t.y); engine()?.move(t); },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => engine()?.up(local(e)),
    onPointerCancel: (e: ReactPointerEvent<HTMLButtonElement>) => engine()?.up(local(e)),
  });
  const place = (box: { x: number; y: number; w: number; h: number }) => ({ transform: `translate(${box.x.toFixed(1)}px, ${box.y.toFixed(1)}px)`, inlineSize: box.w, blockSize: box.h });

  const bench = BENCH.includes(phase), chapter = bench ? 'build' : phase === 'land' || phase === 'setPiece' ? 'land' : 'dive';
  const line = coach.key === 'openLine' ? w.openLine : coach.key === 'picked' && coach.piece ? w.picked[coach.piece] : coach.key === 'clicked' && coach.piece ? w.clicked[coach.piece] : (w.say as Readonly<Record<string, string>>)[coach.key] ?? '';
  const steps: HudQuestStep[] = chapter === 'build'
    ? [...GROUPS.map(g => ({ key: g.key, label: w.pieces[g.name], done: PIECES[mode].filter(p => g.kinds.includes(p.kind)).every(p => placed.includes(p.id)) })), { key: 'spin', label: w.steps.spin, done: phase === 'built' || phase === 'toLens' }]
    : chapter === 'dive' ? DIVE_QUEST.map((key, i) => ({ key, label: w.steps[key], done: found > i }))
      : LAND_QUEST.map(key => ({ key, label: w.steps[key], done: landDone.includes(key) }));
  const current = steps.findIndex(s => !s.done);
  const toastText = toast ? tinyLine((w.toast as Readonly<Record<string, string>>)[toast.key] ?? '', Number(toast.arg ?? 0).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB')) : '';
  const floating = phase === 'land' && !landDone.includes('legs'), squeezing = phase === 'land' && landDone.includes('pad') && !landDone.includes('squeeze');
  const nextThing = found < DIVE_QUEST.length ? w.steps[DIVE_QUEST[found]] : '';

  const onModelKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); engine()?.keyTurn(-45); } else if (e.key === 'ArrowRight') { e.preventDefault(); engine()?.keyTurn(45); }
  };
  const onPhageKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); engine()?.turn(1); } else if (e.key === 'ArrowRight') { e.preventDefault(); engine()?.turn(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); engine()?.lower(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (squeezing) engine()?.squeeze(); else engine()?.lower(); }
  };

  const turnLeft = <HudButton iconOnly label={w.turnLeft} icon={<RotateCcw aria-hidden="true" />} onClick={() => engine()?.turn(1)} data={{ 'data-tiny-turn': 'left' }} />;
  const turnRight = <HudButton iconOnly label={w.turnRight} icon={<RotateCw aria-hidden="true" />} onClick={() => engine()?.turn(-1)} data={{ 'data-tiny-turn': 'right' }} />;
  const world = <div className="tiny-world" dir="ltr">
    <canvas ref={canvasRef} className="tiny-world__canvas" role="img" aria-label={w.scene} data-tiny-canvas="" />
    <PlayFx ref={fxRef} layer={3} />
    <div className="tiny-world__touch" data-tiny-touch="" data-phase={phase}
      onPointerDown={e => { capture(e); engine()?.down(local(e)); }}
      onPointerMove={e => { const t = local(e); engine()?.hover(t.x, t.y); engine()?.move(t); }}
      onPointerUp={e => engine()?.up(local(e))} onPointerCancel={e => engine()?.up(local(e))}
      onWheel={e => engine()?.wheel(e.deltaY)} />
    {bench && layout && phase !== 'opening' && phase !== 'toLens' && <button type="button" className="tiny-hit" data-tiny-aya="" style={place(layout.aya)} aria-label={w.aya} onClick={() => engine()?.pokeAya()} />}
    {(phase === 'spin' || phase === 'built') && layout && <button type="button" className="tiny-hit tiny-hit--drag" data-tiny-model="" style={place(layout.model)} aria-label={w.model} onKeyDown={onModelKey}
      {...forward(t => engine()?.down(t))} onClick={e => { if (e.detail === 0) engine()?.pokeModel(); }} />}
    {phase === 'build' && layout && Object.keys(layout.parts).map(id => PIECES[mode].find(p => p.id === id)).map(p => {
      const box = p && !placed.includes(p.id) ? layout.parts[p.id] : null; if (!p || !box) return null;
      const picked = selected === p.id;
      return <button key={p.id} type="button" className="tiny-hit tiny-hit--drag" data-tiny-piece={p.id} data-selected={picked || undefined} style={place(box)} aria-pressed={picked}
        aria-label={tinyLine(picked ? w.pieceChosen : w.pieceReady, w.pieces[p.kind])} {...forward(t => { if (!engine()?.grabAt(t)) engine()?.grab(p.id, t); })} onClick={e => { if (e.detail === 0) engine()?.tapPart(p.id); }} />;
    })}
    {phase === 'built' && layout && <button type="button" className="tiny-hit" data-tiny-lens="" style={place(layout.lens)} aria-label={w.lens} onClick={() => engine()?.toLens()} />}
    <button ref={targetRef} type="button" className="tiny-hit tiny-hit--round" data-tiny-target="" hidden aria-label={tinyLine(w.thing, nextThing)} onClick={() => engine()?.record()} />
    <button ref={secretRef} type="button" className="tiny-hit tiny-hit--round" data-tiny-secret="" hidden aria-label={w.secretThing} onClick={() => engine()?.secret()} />
    <button ref={phageRef} type="button" className="tiny-hit tiny-hit--drag" data-tiny-phage="" hidden aria-label={w.realPhage} onKeyDown={onPhageKey} {...forward(t => engine()?.phageDown(t))} />
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="tiny-builders" title={w.title} instruction={w.instruction}>
    <div className="tiny-builders" data-adventure="tiny-builders" data-phase={phase} data-chapter={chapter} data-mode={mode}>
      {phase === 'done'
        ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={onAgain} playAgainLabel={shared.again} homeLabel={shared.home} />
        : <PlayStage id="tiny-builders" className="tiny-stage" shake={shake} camera={camera} setPiece={phase === 'setPiece'} world={world}>
          <HudCoach who={coach.who} mood={coach.mood} line={line} quiet={phase === 'setPiece'} onPoke={bench && phase !== 'opening' ? () => engine()?.pokeAya() : undefined} pokeLabel={w.aya} />
          <HudQuest steps={steps} current={current} label={w.quest[chapter]} />
          <HudToast show={!!toast && phase !== 'setPiece'}>{toastText}</HudToast>
          {phase === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={() => engine()?.begin()} />}
          <HudDock label={w.quest[chapter]}>
            {phase === 'built' && <HudButton tone="go" size="l" cue label={w.find} icon={<Search aria-hidden="true" />} onClick={() => engine()?.toLens()} data={{ 'data-tiny-find': '' }} />}
            {phase === 'dive' && <>
              <HudButton iconOnly label={w.diveUp} icon={<ArrowUp aria-hidden="true" />} onClick={() => engine()?.dive(-1)} data={{ 'data-tiny-up': '' }} />
              {canRecord
                ? <HudButton tone="go" size="l" cue label={w.record} icon={<Camera aria-hidden="true" />} onClick={() => engine()?.record()} data={{ 'data-tiny-record': '' }} />
                : <HudButton tone="go" size="l" label={w.diveDown} icon={<ArrowDown aria-hidden="true" />} onClick={() => engine()?.dive(1)} data={{ 'data-tiny-dive': '' }} />}
            </>}
            {phase === 'found' && <HudButton tone="go" size="l" cue label={w.landGo} icon={<ArrowDownToLine aria-hidden="true" />} onClick={() => engine()?.toLand()} data={{ 'data-tiny-land': '' }} />}
            {/* The two turns stay physically left and right: the scene never mirrors, so in Hebrew they are handed over reversed. */}
            {floating && <>
              {lang === 'he' ? turnRight : turnLeft}
              <HudButton tone="go" label={w.lower} icon={<ArrowDown aria-hidden="true" />} onClick={() => engine()?.lower()} data={{ 'data-tiny-lower': '' }} />
              {lang === 'he' ? turnLeft : turnRight}
            </>}
            {squeezing && <HudButton tone="go" size="l" label={w.squeeze} icon={<ChevronsDown aria-hidden="true" />} onClick={() => engine()?.squeeze()} data={{ 'data-tiny-squeeze': '' }} />}
          </HudDock>
          <PlaySetPiece active={phase === 'setPiece'} caption={w.captions[caption]} />
        </PlayStage>}
    </div>
  </GameShell>;
}
