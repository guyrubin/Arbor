import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowRight, Droplets, Flame, Heart, RotateCcw, RotateCw, Sticker, Sun } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import {
  HudButton, HudChip, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, roundSeed, useReducedMotion, useShake,
  type CoachMood, type PlayCamera, type PlayFxHandle,
} from '../play';
import './bottleLab.css';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import { TURN_STEP, freshBottle, stickersFull, validBottle, type BottleCreation } from './bottleLabRules';
import { createGlassScene, type GlassScene, type SayId, type SceneEvent, type SceneSpots } from './glassScene';
import { createGlassSound, type GlassSound } from './glassSound';
import { CHAPTERS, CHAPTER_WAIT_MS, chapterReady, dealSitting, nextAct, noDeeds, stageLayout, type Act, type Chapter, type Deeds, type StageLayout } from './glassworks';

const fillIn = (template: string, ...values: string[]) => template.replace(/\{(\d)\}/g, (_m, i: string) => values[Number(i)] ?? '');
/** Counted in memory only, so each sitting is dealt differently; nothing about play is stored. */
let sittings = 0;

const MOODS: Readonly<Record<SayId, CoachMood>> = {
  pulled: 'curious', tall: 'happy', round: 'happy', flask: 'happy', tinted: 'wow', frosted: 'happy', polished: 'happy', stuck: 'happy', full: 'wow', peeled: 'curious',
  turned: 'happy', rang: 'happy', aya: 'happy', arch: 'curious', secret: 'wow', behind: 'wow', light: 'happy',
};
const SAY_MS = 2600;
const CAMERAS: Readonly<Record<Act, PlayCamera>> = {
  opening: { x: 0.5, y: 0.56, zoom: 1.22 }, shape: { x: 0.5, y: 0.56, zoom: 1.07 }, colour: { x: 0.5, y: 0.5, zoom: 1 }, dress: { x: 0.5, y: 0.5, zoom: 1 }, finale: { x: 0.5, y: 0.5, zoom: 1 }, done: { x: 0.5, y: 0.5, zoom: 1 },
};
const box = (b: { x: number; y: number; width: number; height: number }): CSSProperties => ({ left: b.x, top: b.y, width: Math.max(1, b.width), height: Math.max(1, b.height) });

export default function BottleLab() {
  const [sitting, setSitting] = useState(0);
  const [reopen, setReopen] = useState<BottleCreation | null>(null);
  return <Glassworks key={sitting} start={reopen} onAgain={() => { setReopen(null); setSitting(n => n + 1); }} onOpen={kept => { setReopen(kept); setSitting(n => n + 1); }} />;
}

function Glassworks({ start, onAgain, onOpen }: { start: BottleCreation | null; onAgain: () => void; onOpen: (kept: BottleCreation) => void }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = BOTTLE_LAB_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const kept = saved.items.find(item => item.creation.kind === 'bottle')?.creation;
  const reduced = useReducedMotion();
  const [deal] = useState(() => dealSitting(roundSeed(), sittings++));

  const [act, setAct] = useState<Act>('opening');
  const [bottle, setBottle] = useState<BottleCreation>(() => start ?? freshBottle());
  const [deeds, setDeeds] = useState<Deeds>(noDeeds);
  const [waited, setWaited] = useState(false);
  const [said, setSaid] = useState<SayId | null>(null);
  const [free, setFree] = useState(false);
  const [toast, setToast] = useState<Chapter | null>(null);
  const [layout, setLayout] = useState<StageLayout>(() => stageLayout(390, 700, deal.ayaLeft));
  const [spots, setSpots] = useState<SceneSpots | null>(null);
  const [shake, bump] = useShake();

  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<GlassScene | null>(null);
  const fx = useRef<PlayFxHandle>(null);
  const sound = useRef<GlassSound | null>(null);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((ms: number, run: () => void) => { const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms); timers.current.push(id); return id; }, []);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEvent = useRef<(event: SceneEvent) => void>(() => undefined);
  onEvent.current = event => {
    if (event.type === 'bottle') setBottle(event.bottle);
    else if (event.type === 'deed') setDeeds(d => ({ ...d, [event.deed]: d[event.deed] + 1 }));
    else if (event.type === 'spots') { const s = scene.current; if (s) setSpots(s.spots()); }
    else if (event.type === 'free') setFree(true);
    else if (event.type === 'beat') bump();
    else if (event.type === 'say') {
      setSaid(event.say);
      if (sayTimer.current) clearTimeout(sayTimer.current);
      sayTimer.current = setTimeout(() => { sayTimer.current = null; setSaid(null); }, SAY_MS);
    }
  };

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const voice = createGlassSound(); sound.current = voice;
    const made = createGlassScene({ canvas: el, fx: () => fx.current, sound: voice, emit: event => onEvent.current(event), sitting: deal, reduced: () => reducedRef.current, start });
    scene.current = made;
    const measure = () => { const width = el.clientWidth, height = el.clientHeight; if (width > 0 && height > 0 && made) { made.resize(width, height); setLayout(made.layout()); } };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure);
      for (const id of timers.current) clearTimeout(id); timers.current = [];
      if (sayTimer.current) clearTimeout(sayTimer.current);
      made?.dispose(); scene.current = null; voice.dispose(); sound.current = null;
    };
  }, [deal, start]);

  /** One act ends and the next begins: a flourish, a quest pip, the camera moves. */
  const enter = useCallback((next: Act) => {
    setAct(next); setWaited(false); setSaid(null);
    scene.current?.setAct(next);
  }, []);
  const advance = () => {
    if (act === 'opening' || act === 'done') return;
    void selectionHaptic();
    if (act === 'finale') { enter('done'); return; }
    const chapter = act, next = nextAct(act);
    sound.current?.chapter(); bump();
    const base = layout.base;
    fx.current?.burst(base.x / layout.width, (base.y - 120 * layout.unit) / layout.height, 'sparkle', { tones: ['white', 'sun', 'sky-pale'], count: 22, spread: 1.6 });
    fx.current?.burst(base.x / layout.width, base.y / layout.height, 'ring', { tones: ['white'], size: 2.4 });
    setToast(chapter); later(1900, () => setToast(current => current === chapter ? null : current));
    enter(next);
  };
  // A chapter's action also shows after a patient wait, so nobody is ever held at a gate.
  useEffect(() => {
    if (act !== 'shape' && act !== 'colour' && act !== 'dress') return;
    const id = setTimeout(() => setWaited(true), CHAPTER_WAIT_MS);
    return () => clearTimeout(id);
  }, [act]);

  // ── Touch: the canvas is the world; every pointer goes to the scene ──────
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => { if (e.button > 0) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* A synthetic pointer. */ } scene.current?.down(e.clientX, e.clientY, e.pointerId); };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => scene.current?.move(e.clientX, e.clientY, e.pointerId);
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => scene.current?.up(e.clientX, e.clientY, e.pointerId);
  const glassKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const s = scene.current; if (!s) return;
    const side = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (act === 'shape') {
      if (e.key === 'ArrowUp') s.command({ do: 'shape', dir: 'up' }); else if (e.key === 'ArrowDown') s.command({ do: 'shape', dir: 'down' }); else if (side) s.command({ do: 'shape', dir: 'side' }); else return;
    } else if (act === 'dress' && side) s.command({ do: 'turn', by: side * TURN_STEP });
    else if (act === 'finale' && side) s.command({ do: 'light', by: side * 0.25 });
    else return;
    e.preventDefault();
  };

  // ── Words ────────────────────────────────────────────────────────────────
  const chapter = act === 'shape' || act === 'colour' || act === 'dress' ? act : null;
  const ready = chapter ? chapterReady(chapter, deeds, waited ? CHAPTER_WAIT_MS : 0) : false;
  const standing = act === 'opening' ? w.line.opening
    : act === 'shape' ? (deeds.shaped ? w.line.shapeReady : w.line.shapeStart)
    : act === 'colour' ? (!deeds.coloured ? w.line.colourStart : !deeds.rubbed ? w.line.rubNext : w.line.colourReady)
    : act === 'dress' ? (!deeds.stuck ? w.line.dressStart : stickersFull(bottle.stickers) ? w.line.full : !deeds.turned ? w.line.turnNext : w.line.dressReady)
    : free ? w.line.finaleFree : w.line.finaleStart;
  const line = said ? w.line[said] : standing;
  const mood: CoachMood = said ? MOODS[said] : act === 'opening' ? 'happy' : act === 'finale' ? 'wow' : ready ? 'happy' : 'idle';
  const steps = useMemo(() => CHAPTERS.map(key => ({ key, label: w.quest[key], done: CHAPTERS.indexOf(key) < (act === 'opening' ? 0 : act === 'finale' || act === 'done' ? 3 : CHAPTERS.indexOf(act as Chapter)), icon: key === 'shape' ? <Flame /> : key === 'colour' ? <Droplets /> : <Sticker /> })), [act, w]);

  if (act === 'done') {
    return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction}>
      <section className="bl" data-adventure="bottle-lab" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish creation={{ kind: 'bottle', shape: bottle.shape, tint: bottle.tint, finish: bottle.finish, stickers: bottle.stickers.map(({ art, slot }) => ({ art, slot })) }} title={w.finish} subtitle={w.transfer} onPlayAgain={onAgain} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  const s = scene.current, live = act !== 'opening';
  const finaleLine = said === 'behind' || said === 'secret' || said === 'rang' || said === 'light' ? w.line[said] : free ? w.line.finaleFree : w.caption;
  const keep = <HudButton tone="go" size="l" cue label={w.go.finale} icon={<Heart />} onClick={advance} data={{ 'data-bl-keep': '' }} />;
  const glassLabel = act === 'shape' ? w.reach.glassShape : act === 'dress' ? w.reach.glassTurn : act === 'finale' ? w.reach.glassLight : w.reach.glassRing;
  const canOpen = act === 'shape' && !start && kept?.kind === 'bottle' && validBottle(kept) && saved.isCurrent();
  return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction} hearIt={`${line} ${w.instruction}`}>
    <section className="bl" data-adventure="bottle-lab" data-act={act} data-shape={bottle.shape} data-tint={bottle.tint} data-finish={bottle.finish} data-stickers={bottle.stickers.length} data-free={free || undefined} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <PlayStage id="bottle-lab" grade="day" camera={CAMERAS[act]} shake={shake}
        world={<>
          {/* The picture never mirrors: light and glass behave the same in both languages. */}
          <canvas ref={canvas} className="bl-world" data-bl-canvas="" dir="ltr" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => scene.current?.cancel()} />
          <PlayFx ref={fx} layer={3} />
          {/* The same things as real buttons, for a keyboard, a switch or a screen reader. Touch goes to the picture itself. */}
          {live && spots && <div className="bl-reach" dir="ltr" role="group" aria-label={w.reach.things}>
            <button type="button" className="bl-reach__spot" data-bl-glass="" style={box(spots.bottle)} aria-label={glassLabel} onKeyDown={glassKey}
              onClick={() => s?.command(act === 'shape' ? { do: 'shape' } : { do: 'ring' })} />
            {act === 'colour' && deal.discs.map((tint, i) => <button key={tint} type="button" className="bl-reach__spot" data-bl-disc={tint} aria-pressed={bottle.tint === tint}
              style={box({ x: layout.discs[i].x - layout.discWidth / 2, y: layout.discs[i].y - 28, width: layout.discWidth, height: 56 })} aria-label={fillIn(w.reach.disc, w.tints[tint])} onClick={() => s?.command({ do: 'disc', tint })} />)}
            <button type="button" className="bl-reach__spot" data-bl-aya="" style={box(spots.aya)} aria-label={act === 'colour' ? fillIn(w.reach.rub, w.finishes[bottle.finish]) : w.reach.aya}
              onClick={() => s?.command(act === 'colour' ? { do: 'finish' } : { do: 'aya' })} />
            {act === 'dress' && deal.card.map((art, i) => <button key={art} type="button" className="bl-reach__spot" data-bl-art={art}
              style={box({ x: layout.card.stickers[i].x - layout.card.size / 2, y: layout.card.stickers[i].y - layout.card.size / 2, width: layout.card.size, height: layout.card.size })} aria-label={fillIn(w.reach.sticker, w.stickers[art])} onClick={() => s?.command({ do: 'stickOn', art })} />)}
            {act === 'dress' && spots.stickers.map(placed => <button key={placed.slot} type="button" className="bl-reach__spot" data-bl-peel={placed.slot}
              style={box({ x: placed.x - placed.size / 2, y: placed.y - placed.size / 2, width: placed.size, height: placed.size })} aria-label={fillIn(w.reach.peel, w.stickers[placed.art], w.rows[Math.floor(placed.slot / 4)])} onClick={() => s?.command({ do: 'peel', slot: placed.slot })} />)}
            {layout.arches.map((arch, i) => <button key={i} type="button" className="bl-reach__spot" data-bl-arch={i} style={box({ ...arch, height: Math.max(40, arch.height * 0.5) })} aria-label={w.reach.arch[i]} onClick={() => s?.command({ do: 'arch', index: i })} />)}
          </div>}
        </>}>
        <HudCoach who="aya" mood={mood} line={line} onPoke={live ? () => scene.current?.command({ do: 'aya' }) : undefined} pokeLabel={w.reach.aya} quiet={act === 'finale' && !free && !said} />
        <HudQuest steps={steps} current={chapter ? CHAPTERS.indexOf(chapter) : act === 'opening' ? -1 : 3} label={w.questLabel} />
        <HudToast show={toast !== null}>{toast ? w.done[toast] : ''}</HudToast>
        <HudDock>
          {act === 'dress' && <span className="bl-turn" dir="ltr">
            <HudButton label={w.reach.turnLeft} icon={<RotateCcw />} iconOnly onClick={() => scene.current?.command({ do: 'turn', by: -TURN_STEP })} data={{ 'data-bl-turn': 'left' }} />
            <HudButton label={w.reach.turnRight} icon={<RotateCw />} iconOnly onClick={() => scene.current?.command({ do: 'turn', by: TURN_STEP })} data={{ 'data-bl-turn': 'right' }} />
          </span>}
          {chapter && ready && <HudButton tone="go" size={chapter === 'dress' && layout.portrait ? 'm' : 'l'} cue label={w.go[chapter]} icon={chapter === 'dress' ? <Sun /> : <span data-flip=""><ArrowRight /></span>} onClick={advance} data={{ 'data-bl-next': chapter }} />}
          {canOpen && kept?.kind === 'bottle' && <HudChip onClick={() => onOpen({ kind: 'bottle', shape: kept.shape, tint: kept.tint, finish: kept.finish, stickers: kept.stickers.map(({ art, slot }) => ({ art, slot })) })} label={w.open}>{w.open}</HudChip>}
        </HudDock>
        {act === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={() => enter(start ? 'dress' : 'shape')} />}
        {/* The finale's words and its one action sit clear of the bottle: under it on a tall stage, beside it on a wide one. */}
        <PlaySetPiece active={act === 'finale'} caption={layout.portrait ? finaleLine : undefined}>
          {layout.portrait ? free && keep : <div className="bl-finale"><HudChip>{finaleLine}</HudChip>{free && keep}</div>}
        </PlaySetPiece>
      </PlayStage>
    </section>
  </GameShell>;
}
