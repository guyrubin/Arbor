import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Maximize2, Minus, Plus, RotateCw, X } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidSfx, useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { ICE_AGE_FRIEND_COPY } from './iceAgeFriendCopy';
import { DISCOVERIES, ZOOM_MAX, ZOOM_MIN, allFound, discover, type DiscoveryId } from './iceAgeFriendRules';
import { createMammothEngine, type MammothEngine } from './mammothEngine';
import { createMammothSound, type MammothSound } from './mammothAudio';
import { SnowBadge, SteppeBackdrop } from './SteppeArt';
import '../makerPalette.css';
import './iceAgeFriend.css';

type Stage = 'explore' | 'call' | 'free';
const fill = (template: string, value: string) => template.replace('{0}', value);
const reducedNow = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Woolly Mammoth: look around a mammoth, zoom into its coat, stroke it, and
 * find five things that kept it warm. Finding all five makes it lift its
 * trunk and call; then the child may keep looking, or say goodbye. Nothing
 * about how the child played is kept. */
export default function IceAgeFriend() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = ICE_AGE_FRIEND_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const [found, setFound] = useState<DiscoveryId[]>([]);
  const [tag, setTag] = useState<DiscoveryId | 'final' | null>(null);
  const [stage, setStage] = useState<Stage>('explore');
  const [zoom, setZoom] = useState(1);
  const [done, setDone] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layers = useRef(new Map<number, SVGGElement>());
  const rings = useRef<Partial<Record<DiscoveryId, HTMLButtonElement | null>>>({});
  const tagRef = useRef<HTMLDivElement>(null);
  const engine = useRef<MammothEngine | null>(null);
  const sound = useRef<MammothSound | null>(null);
  const foundRef = useRef(found); foundRef.current = found;
  const stageState = useRef(stage); stageState.current = stage;

  useEffect(() => {
    const host = stageRef.current, canvas = canvasRef.current, svg = svgRef.current;
    if (done || !host || !canvas || !svg) return;
    const audio = createMammothSound(); sound.current = audio;
    const live = createMammothEngine(
      { stage: host, canvas, backdrop: svg, layers: [...layers.current].map(([depth, node]) => ({ node, depth })), rings: rings.current },
      { onZoom: value => setZoom(value), onGesture: () => { audio.start(); } },
      audio, reducedNow(),
    );
    engine.current = live;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => live.setReduced(!!query?.matches);
    query?.addEventListener?.('change', onMotion);
    return () => { query?.removeEventListener?.('change', onMotion); live.dispose(); audio.dispose(); engine.current = null; sound.current = null; };
  }, [done]);
  useEffect(() => { if (muted) sound.current?.stop(); }, [muted]);
  // The card takes focus when it opens, so its words are read and Escape or Tab reach Close.
  useEffect(() => { if (tag) tagRef.current?.focus(); }, [tag]);

  const open = (id: DiscoveryId) => {
    void selectionHaptic();
    const card = stageRef.current ? Math.min(stageRef.current.clientHeight * 0.42, 190) : 0;
    engine.current?.focus(id, card);
    const isNew = !foundRef.current.includes(id);
    setFound(list => discover(list, id));
    setTag(id);
    kidSfx(isNew ? 'correct' : 'tap', isNew ? 0.55 : 0.6);
  };
  const closeTag = () => {
    const was = tag;
    setTag(null);
    // Back to the whole animal, so the next glowing ring is in sight.
    if (was && was !== 'final') engine.current?.whole();
    if (was && was !== 'final' && allFound(foundRef.current) && stageState.current === 'explore') {
      setStage('call');
      engine.current?.whole();
      engine.current?.finale(() => { sound.current?.trumpet(); }, () => { setStage('free'); setTag('final'); });
    }
    if (was && was !== 'final') rings.current[was]?.focus();
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

  const cue = stage === 'call' ? w.cueCall : stage === 'free' ? w.cueFree : found.length ? w.cueMore : w.cueStart;
  const fact = tag && tag !== 'final' ? w.facts[tag] : null;
  const end = lang === 'he' ? 'left' : 'right';

  return <GameShell fullBleed autoNarrate={false} worldId="ice-age-friend" title={w.title} instruction={w.instruction}>
    <section className="iaf" data-adventure="ice-age-friend" data-stage={stage} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setFound([]); setTag(null); setStage('explore'); setZoom(1); setDone(false); }} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div className="iaf-top">
          <p className="iaf-cue" role="status">{cue}</p>
          <ul className="iaf-flakes" aria-label={w.flakes}>
            {DISCOVERIES.map(id => <li key={id} data-found={found.includes(id)} aria-label={`${w.facts[id].title}: ${found.includes(id) ? w.found : w.notYet}`}><SnowBadge lit={found.includes(id)} /></li>)}
          </ul>
        </div>
        <div ref={stageRef} className="iaf-stage" dir="ltr" tabIndex={0} role="group" aria-label={w.stage} aria-describedby="iaf-keys" onKeyDown={onKey} data-zoom={zoom >= 2.5 ? 'close' : zoom > 1.05 ? 'near' : 'whole'}>
          <SteppeBackdrop svgRef={svgRef} layerRef={depth => node => { if (node) layers.current.set(depth, node); else layers.current.delete(depth); }} />
          <canvas ref={canvasRef} className="iaf-canvas" aria-hidden="true" />
          <span id="iaf-keys" className="iaf-sr">{w.keys}</span>
          {DISCOVERIES.map(id => <button key={id} type="button" ref={node => { rings.current[id] = node; }} className="iaf-ring" data-ring={id} data-found={found.includes(id)} data-open={tag === id} aria-label={fill(w.ring, w.places[id])} onClick={() => open(id)}>
            <span className="iaf-ring__pulse" aria-hidden="true" /><span className="iaf-ring__dot" aria-hidden="true" />
          </button>)}
          <div className="iaf-zoom" data-side={end} dir={lang === 'he' ? 'rtl' : 'ltr'}>
            <button type="button" className="iaf-round" aria-label={w.zoomIn} disabled={zoom >= ZOOM_MAX - 0.01} onClick={() => engine.current?.zoomBy(1.5)}><Plus size={26} aria-hidden="true" /></button>
            <button type="button" className="iaf-round" aria-label={w.zoomOut} disabled={zoom <= ZOOM_MIN + 0.01} onClick={() => engine.current?.zoomBy(1 / 1.5)}><Minus size={26} aria-hidden="true" /></button>
          </div>
          {tag && <div ref={tagRef} className="iaf-tag" data-iaf-tag={tag} data-side={end} dir={lang === 'he' ? 'rtl' : 'ltr'} role="dialog" aria-modal="false" aria-labelledby="iaf-tag-title" tabIndex={-1} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); closeTag(); } }}>
            <span className="iaf-tag__flake" aria-hidden="true"><SnowBadge lit /></span>
            <div className="iaf-tag__words">
              <h3 id="iaf-tag-title" className="iaf-tag__title">{fact ? fact.title : w.finalTitle}</h3>
              <p className="iaf-tag__text">{fact ? fact.text : w.extinct}</p>
              {tag === 'final' && <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary iaf-done" onClick={() => setDone(true)}>{w.done}<Check size={20} aria-hidden="true" /></button>}
            </div>
            <button type="button" className="iaf-tag__close" aria-label={w.close} onClick={closeTag}><X size={22} aria-hidden="true" /></button>
          </div>}
        </div>
        <div className="iaf-actions">
          <button type="button" className="studio-game-button-v2 iaf-action" onClick={() => engine.current?.whole()} disabled={zoom <= ZOOM_MIN + 0.01}><Maximize2 size={20} aria-hidden="true" />{w.whole}</button>
          <button type="button" className="studio-game-button-v2 iaf-action" onClick={() => { void selectionHaptic(); engine.current?.turn(); }}><RotateCw size={20} aria-hidden="true" />{w.turn}</button>
          {stage === 'free' && <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary iaf-action iaf-action--done" onClick={() => setDone(true)}>{w.done}<Check size={20} aria-hidden="true" /></button>}
        </div>
      </>}
    </section>
  </GameShell>;
}
