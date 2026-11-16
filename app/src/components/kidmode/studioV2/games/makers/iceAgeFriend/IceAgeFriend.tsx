import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Camera, Check, Eye, Focus, Maximize2, Minus, Plus, RotateCw, Ruler, X } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { ICE_AGE_FRIEND_COPY } from './iceAgeFriendCopy';
import { DISCOVERIES, ZOOM_MAX, ZOOM_MIN, allFound, discover, type DiscoveryId } from './iceAgeFriendRules';
import { pickDay, type DayId } from './mammothPlayRules';
import { createMammothEngine, type MammothEngine, type Phase } from './mammothEngine';
import { createMammothSound, type MammothSound } from './mammothAudio';
import { FloorLayer, HallLayer, HintHand, PhotoBadge, SteppeLayer } from './HallArt';
import type { FriendId } from './mammothArt';
import '../makerPalette.css';
import './iceAgeFriend.css';

type Stage = 'explore' | 'call' | 'free' | 'leave';
const fill = (template: string, value: string) => template.replace('{0}', value);
const reducedNow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** The crew's tool for each discovery, as a small control glyph beside its name. */
const TOOL_ICON = { coats: Camera, ears: Camera, tusks: Ruler, trunk: Focus, hump: Eye } as const;
/** The day the hall last showed, kept only while the app is open, so the next visit looks different. Nothing about the child. */
let lastDay: DayId | null = null;

/** Woolly Mammoth: the giant behind the glass. In the great glass hall of
 * Horizon Dome a woolly mammoth stands out on the Ice Age steppe. The child
 * touches the glass to say hello; befriended, it steps into the hall, where
 * its coat can be stroked, the snow brushed off its back, a bunch of grass
 * offered, and five things that kept it warm found with the crew's tools.
 * Finding all five makes it lift its trunk and call, and the herd answers.
 * Nothing about how the child played is kept. */
export default function IceAgeFriend() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = ICE_AGE_FRIEND_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const [day] = useState<DayId>(() => { lastDay = pickDay(Math.random, lastDay); return lastDay; });
  const [found, setFound] = useState<DiscoveryId[]>([]);
  const [tag, setTag] = useState<DiscoveryId | 'final' | null>(null);
  const [stage, setStage] = useState<Stage>('explore');
  const [phase, setPhase] = useState<Phase>('meet');
  const [zoom, setZoom] = useState(1);
  const [cheer, setCheer] = useState({ key: 0, big: false });
  const [tall, setTall] = useState(false);
  const [done, setDone] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const rings = useRef<Partial<Record<DiscoveryId, HTMLButtonElement | null>>>({});
  const photos = useRef<Partial<Record<DiscoveryId, HTMLCanvasElement | null>>>({});
  const ghostRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const basketRef = useRef<HTMLButtonElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const engine = useRef<MammothEngine | null>(null);
  const sound = useRef<MammothSound | null>(null);
  const foundRef = useRef(found); foundRef.current = found;
  const stageState = useRef(stage); stageState.current = stage;

  useEffect(() => {
    const host = stageRef.current, canvas = canvasRef.current;
    if (done || !host || !canvas) return;
    const audio = createMammothSound(); sound.current = audio;
    const live = createMammothEngine(
      { stage: host, canvas, layers: layers.current.filter((node): node is HTMLDivElement => !!node), rings: rings.current, ghost: ghostRef.current, basket: basketRef.current, ripple: rippleRef.current },
      {
        onZoom: value => setZoom(value), onGesture: () => { audio.start(); }, onPhase: next => setPhase(next),
        onCheer: big => setCheer(now => ({ key: now.key + 1, big })), onTick: () => { void selectionHaptic(); },
      },
      audio, { reduced: reducedNow(), day, faceRight: lang === 'he' },
    );
    engine.current = live;
    const shape = () => setTall(host.clientHeight > host.clientWidth * 1.1);
    shape();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(shape) : null;
    watch?.observe(host);
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => live.setReduced(!!query?.matches);
    query?.addEventListener?.('change', onMotion);
    return () => { query?.removeEventListener?.('change', onMotion); watch?.disconnect(); live.dispose(); audio.dispose(); engine.current = null; sound.current = null; };
    // The scene is built once per visit; the language of a visit does not change under it.
  }, [done, day]);
  useEffect(() => { if (muted) sound.current?.stop(); }, [muted]);
  // The card takes focus when it opens, so its words are read and Escape or Tab reach Close.
  useEffect(() => { if (tag) tagRef.current?.focus(); engine.current?.hold(!!tag); }, [tag]);

  const open = (id: DiscoveryId) => {
    void selectionHaptic();
    const host = stageRef.current;
    // The card opens over the floor on a wide stage and over the dome on a tall one; the camera keeps the spot clear of it.
    const card = host ? Math.min(host.clientHeight * 0.42, 190) * (tall ? -0.8 : 1) : 0;
    const isNew = !foundRef.current.includes(id);
    engine.current?.focus(id, card, isNew, photos.current[id] ?? null);
    setFound(list => discover(list, id));
    setTag(id);
  };
  const closeTag = () => {
    const was = tag;
    setTag(null);
    engine.current?.release();
    // Back to the whole animal, so the next ring is in sight.
    if (was && was !== 'final') engine.current?.whole();
    if (was && was !== 'final' && allFound(foundRef.current) && stageState.current === 'explore') {
      setStage('call');
      engine.current?.finale(() => { setStage('free'); setTag('final'); });
    }
    if (was && was !== 'final') rings.current[was]?.focus();
  };
  const goodbye = () => {
    if (stageState.current === 'leave') return;
    setTag(null); setStage('leave');
    const live = engine.current;
    if (live) live.farewell(() => setDone(true)); else setDone(true);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const live = engine.current; if (!live || e.target !== e.currentTarget) return;
    const step = 60;
    const keys: Record<string, () => void> = {
      ArrowLeft: () => live.pan(-step, 0), ArrowRight: () => live.pan(step, 0), ArrowUp: () => live.pan(0, -step), ArrowDown: () => live.pan(0, step),
      '+': () => live.zoomBy(1.5), '=': () => live.zoomBy(1.5), '-': () => live.zoomBy(1 / 1.5), _: () => live.zoomBy(1 / 1.5),
      '0': () => live.whole(), Home: () => live.whole(), Enter: () => live.comb(), ' ': () => live.comb(),
    };
    const run = keys[e.key]; if (!run) return;
    e.preventDefault(); run();
  };

  const exploring = phase === 'explore' && (stage === 'explore' || stage === 'free');
  const cue = phase === 'meet' ? w.cueMeet : phase === 'enter' ? w.cueEnter : stage === 'leave' ? w.cueLeave : stage === 'call' ? w.cueCall : stage === 'free' ? w.cueFree : found.length ? w.cueMore : w.cueStart;
  const fact = tag && tag !== 'final' ? w.facts[tag] : null;
  const ToolIcon = tag && tag !== 'final' ? TOOL_ICON[tag] : Camera;
  const end = lang === 'he' ? 'left' : 'right';
  const layer = (index: number) => (node: HTMLDivElement | null) => { layers.current[index] = node; };

  return <GameShell fullBleed autoNarrate={false} worldId="ice-age-friend" title={w.title} instruction={w.instruction}>
    <section className="iaf" data-adventure="ice-age-friend" data-stage={stage} data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setFound([]); setTag(null); setStage('explore'); setPhase('meet'); setZoom(1); setDone(false); }} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div className="iaf-top">
          <p className="iaf-cue" role="status">{cue}</p>
          <ul className="iaf-photos" aria-label={w.photos}>
            {DISCOVERIES.map(id => <li key={id} data-found={found.includes(id)} aria-label={`${w.facts[id].title}: ${found.includes(id) ? w.found : w.notYet}`}><PhotoBadge lit={found.includes(id)} canvasRef={node => { photos.current[id] = node; }} /></li>)}
          </ul>
        </div>
        <div ref={stageRef} className="iaf-stage" dir="ltr" tabIndex={0} role="group" aria-label={w.stage} aria-describedby="iaf-keys" onKeyDown={onKey} data-day={day} data-zoom={zoom >= 2.5 ? 'close' : zoom > 1.05 ? 'near' : 'whole'}>
          <SteppeLayer layerRef={layer(0)} />
          <canvas ref={canvasRef} className="iaf-canvas" aria-hidden="true" />
          <HallLayer layerRef={layer(1)} />
          <FloorLayer layerRef={layer(2)} basketRef={basketRef} names={w.friends} grassLabel={w.grass} cheer={cheer} side={lang === 'he' ? 'right' : 'left'}
            onFriend={(id: FriendId) => { void selectionHaptic(); engine.current?.greet(id); }} onGrass={() => { void selectionHaptic(); engine.current?.feed(); }} />
          <span id="iaf-keys" className="iaf-sr">{w.keys}</span>
          {DISCOVERIES.map(id => <button key={id} type="button" ref={node => { rings.current[id] = node; }} className="iaf-ring" data-ring={id} data-found={found.includes(id)} data-open={tag === id} aria-label={fill(w.ring, w.places[id])} hidden={!exploring && tag !== id} onClick={() => open(id)}>
            <span className="iaf-ring__pulse" aria-hidden="true" /><span className="iaf-ring__dot" aria-hidden="true">{found.includes(id) && <Check size={13} strokeWidth={3.6} />}</span>
          </button>)}
          <span ref={rippleRef} className="iaf-ripple" aria-hidden="true" />
          <HintHand handRef={ghostRef} />
          {exploring && <div className="iaf-zoom" data-side={end} dir={lang === 'he' ? 'rtl' : 'ltr'}>
            <button type="button" className="iaf-round" aria-label={w.zoomOut} disabled={zoom <= ZOOM_MIN + 0.01} onClick={() => engine.current?.zoomBy(1 / 1.5)}><Minus size={24} aria-hidden="true" /></button>
            <button type="button" className="iaf-round" aria-label={w.zoomIn} disabled={zoom >= ZOOM_MAX - 0.01} onClick={() => engine.current?.zoomBy(1.5)}><Plus size={24} aria-hidden="true" /></button>
            <button type="button" className="iaf-round" aria-label={w.whole} disabled={zoom <= ZOOM_MIN + 0.01} onClick={() => engine.current?.whole()}><Maximize2 size={21} aria-hidden="true" /></button>
          </div>}
          {tag && <div ref={tagRef} className="iaf-tag" data-iaf-tag={tag} data-side={end} data-at={tall ? 'top' : 'bottom'} dir={lang === 'he' ? 'rtl' : 'ltr'} role="dialog" aria-modal="false" aria-labelledby="iaf-tag-title" tabIndex={-1} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closeTag(); } }}>
            <span className="iaf-tag__tool" aria-hidden="true">{tag === 'final' ? <Check size={22} strokeWidth={3} /> : <ToolIcon size={22} />}</span>
            <div className="iaf-tag__words">
              <h3 id="iaf-tag-title" className="iaf-tag__title">{fact ? fact.title : w.finalTitle}</h3>
              <p className="iaf-tag__text">{fact ? fact.text : w.extinct}</p>
              {tag !== 'final' && <p className="iaf-tag__how">{w.tools[tag]}</p>}
              {tag === 'final' && <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary iaf-done" onClick={goodbye}>{w.done}<Check size={20} aria-hidden="true" /></button>}
            </div>
            <button type="button" className="iaf-tag__close" aria-label={w.close} onClick={closeTag}><X size={22} aria-hidden="true" /></button>
          </div>}
        </div>
        <div className="iaf-actions">
          <button type="button" className="studio-game-button-v2 iaf-action" disabled={!exploring} onClick={() => { void selectionHaptic(); engine.current?.turn(); }}><RotateCw size={20} aria-hidden="true" />{w.turn}</button>
          {stage === 'free' && <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary iaf-action iaf-action--done" onClick={goodbye}>{w.done}<Check size={20} aria-hidden="true" /></button>}
        </div>
      </>}
    </section>
  </GameShell>;
}
