import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Check, RotateCcw, RotateCw, ScanEye } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './bottleLab.css';
import { createBottleAudio, type BottleAudio } from './bottleAudio';
import { StickerArt, TINT_STYLE } from './BottleArt';
import { BottleStage, type StageHandle, type StageProps } from './BottleStage';
import { AXIS_X, BASE_Y, radiusAt, silhouettePath, topY, type ShapeId } from './bottleGeometry';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import {
  BOTTLE_FINISHES, BOTTLE_SHAPES, BOTTLE_STICKERS, BOTTLE_TINTS, TURN_STEP, freshBottle, peelSticker, placeSticker, slotTaken, stickersFull, validBottle,
  type BottleCreation, type BottleSticker, type BottleStickerPlacement,
} from './bottleLabRules';
import { scaleNote } from './bottleToys';

type Step = 'shape' | 'tint' | 'finish' | 'stickers';
const STEPS: readonly Step[] = ['shape', 'tint', 'finish', 'stickers'];
type Phase = 'make' | 'keeping' | 'done';
const fillIn = (template: string, ...values: string[]) => template.replace(/\{(\d)\}/g, (_m, i: string) => values[Number(i)] ?? '');

/** Each sitting starts a little differently: the glassblower hands over a new
 * blank, the lamp stands somewhere else, the sticker sheet is dealt in a new
 * order. Counted in memory only; nothing about play is stored. */
let sittings = 0;
const BLANKS: readonly Pick<BottleCreation, 'shape' | 'tint'>[] = [{ shape: 'round', tint: 'clear' }, { shape: 'tall', tint: 'sea' }, { shape: 'flask', tint: 'rose' }, { shape: 'round', tint: 'amber' }, { shape: 'tall', tint: 'clear' }, { shape: 'flask', tint: 'sea' }];
const LAMP_STARTS = [-48, 50, -58, 42] as const;
const sitting = (n: number) => ({ bottle: { ...freshBottle(), ...BLANKS[n % BLANKS.length] }, lamp: LAMP_STARTS[n % LAMP_STARTS.length], sheet: BOTTLE_STICKERS.map((_, i) => BOTTLE_STICKERS[(i + n * 2) % BOTTLE_STICKERS.length]) });

/** A drag of a sticker from the sheet: where the pointer is and which ring it is over. */
interface Carry { art: BottleSticker; x: number; y: number; hot: number | null; home?: { x: number; y: number } }

export default function BottleLab() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = BOTTLE_LAB_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const kept = saved.items.find(item => item.creation.kind === 'bottle')?.creation;
  const uid = `g${useId()}`;

  const [deal] = useState(() => sitting(sittings++));
  const [bottle, setBottle] = useState<BottleCreation>(deal.bottle);
  const [step, setStep] = useState<Step>('shape');
  const [seen, setSeen] = useState<readonly Step[]>([]);
  const [phase, setPhase] = useState<Phase>('make');
  const [picked, setPicked] = useState<BottleSticker | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [nudge, setNudge] = useState<'placed' | 'full' | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [ghost, setGhost] = useState<BottleStickerPlacement | null>(null);
  const [rang, setRang] = useState(false);
  const [note, setNote] = useState<'behind' | 'dark' | null>(null);
  const [low, setLow] = useState(false);

  const stage = useRef<StageHandle>(null);
  const audio = useRef<BottleAudio | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gesture = useRef<{ id: number; x: number; y: number; moved: boolean; art: BottleSticker } | null>(null);
  const dragged = useRef(false);
  const later = (ms: number, run: () => void) => { const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms); timers.current.push(id); };
  useEffect(() => {
    const sound = createBottleAudio(); audio.current = sound;
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; sound.dispose(); audio.current = null; };
  }, []);
  const live = phase === 'make';

  // ── Choices ────────────────────────────────────────────────────────────
  /** The first choice in each part is a small occasion: Aya hops for it. */
  const visit = (part: Step) => { setStep(part); if (!seen.includes(part)) { setSeen(list => list.includes(part) ? list : [...list, part]); return true; } return false; };
  const choose = <K extends 'shape' | 'tint' | 'finish'>(key: K, value: BottleCreation[K], index: number) => {
    if (!live) return;
    void selectionHaptic(); setPicked(null); setNudge(null);
    const first = visit(key);
    if (bottle[key] === value) { audio.current?.play('tick', scaleNote(5 + index)); return; }
    audio.current?.play(key === 'finish' ? 'chime' : 'ring', scaleNote((key === 'shape' ? 6 : key === 'tint' ? 5 : 7) + index), 0.7);
    if (first) later(120, () => audio.current?.play('chime', scaleNote(10), 0.7));
    stage.current?.cheer(first);
    setBottle(b => ({ ...b, [key]: value }));
  };
  const place = (slot: number, art: BottleSticker | null = picked) => {
    if (!art || !live) return;
    const next = placeSticker(bottle.stickers, art, slot);
    if (next === bottle.stickers) { setNudge(stickersFull(bottle.stickers) ? 'full' : null); return; }
    void selectionHaptic(); audio.current?.play('thup');
    // Real vinyl: pressed down, then the air bubble under it is smoothed out to the edge.
    later(220, () => audio.current?.play('smooth'));
    const first = visit('stickers') || bottle.stickers.length === 0;
    stage.current?.cheer(first);
    setBottle(b => ({ ...b, stickers: [...next] })); setNudge('placed'); setFresh(slot);
    later(760, () => setFresh(current => current === slot ? null : current));
    if (stickersFull(next)) setPicked(null);
  };
  const peel = (slot: number) => {
    const off = bottle.stickers.find(s => s.slot === slot);
    if (!live || !off) return;
    void selectionHaptic(); audio.current?.play('peel');
    setGhost(off); later(270, () => setGhost(current => current === off ? null : current));
    setBottle(b => ({ ...b, stickers: [...peelSticker(b.stickers, slot)] })); setNudge(null); setFresh(null);
  };
  const pick = (art: BottleSticker) => {
    if (dragged.current) { dragged.current = false; return; }
    if (!live) return;
    void selectionHaptic(); setStep('stickers');
    if (stickersFull(bottle.stickers)) { setNudge('full'); setPicked(null); audio.current?.play('tick', scaleNote(3)); return; }
    audio.current?.play('tick', scaleNote(7 + BOTTLE_STICKERS.indexOf(art)));
    setPicked(current => current === art ? null : art); setNudge(null);
  };
  const go = (next: Step) => { if (!live) return; void selectionHaptic(); audio.current?.play('tick', scaleNote(5 + STEPS.indexOf(next))); setStep(next); setPicked(null); setCarry(null); setNudge(null); };
  const keep = () => {
    if (!live) return;
    void selectionHaptic(); setPicked(null); setCarry(null); setPhase('keeping');
    setLow(false); stage.current?.keep(() => setPhase('done'));
  };
  const openKept = () => {
    if (!live || !kept || kept.kind !== 'bottle' || !validBottle(kept) || !saved.isCurrent()) return;
    void selectionHaptic(); audio.current?.play('ring', scaleNote(8), 0.7);
    setBottle({ kind: 'bottle', shape: kept.shape, tint: kept.tint, finish: kept.finish, stickers: kept.stickers.map(({ art, slot }) => ({ art, slot })) });
    setSeen(STEPS); setStep('stickers'); stage.current?.cheer(true);
  };
  const onPlay: StageProps['onPlay'] = (what) => {
    if (what === 'ring') setRang(true);
    else if (what === 'behind') setNote('behind');
    else if (what === 'lampOff') setNote('dark');
    else if (what === 'home' || what === 'lampOn') setNote(current => (what === 'home' ? current === 'behind' : current === 'dark') ? null : current);
    else if (what === 'turn' && nudge === 'placed') setNudge(null);
  };

  // ── Carrying a sticker from the sheet to a ring ────────────────────────
  const onTrayDown = (e: ReactPointerEvent<HTMLButtonElement>, art: BottleSticker) => {
    if (!live || e.button > 0) return;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, art };
    dragged.current = false;
  };
  const onTrayMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 9) {
      if (stickersFull(bottle.stickers)) { setNudge('full'); setStep('stickers'); gesture.current = null; return; }
      g.moved = true; e.currentTarget.setPointerCapture?.(e.pointerId); setPicked(g.art); setNudge(null); setStep('stickers');
      void selectionHaptic(); audio.current?.play('peel', 880, 0.6);
      // Peeled off its backing where it lies, so it can drift back there.
      setCarry({ art: g.art, x: e.clientX, y: e.clientY, hot: null, home: { x: g.x, y: g.y } });
    }
    if (g.moved) { const over = stage.current?.hotSlot(e.clientX, e.clientY) ?? null; setCarry(c => c && { ...c, x: e.clientX, y: e.clientY, hot: over }); }
  };
  const onTrayUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    if (!g.moved) return;
    dragged.current = true;
    const over = stage.current?.hotSlot(e.clientX, e.clientY) ?? null;
    if (over !== null) { place(over, g.art); setCarry(null); return; }
    // Not on a ring: the sticker drifts home, no words.
    setCarry(c => c && c.home ? { ...c, x: c.home.x, y: c.home.y, hot: null } : null);
    later(280, () => setCarry(null));
  };

  // ── Words ──────────────────────────────────────────────────────────────
  const full = stickersFull(bottle.stickers);
  const cue = phase !== 'make' ? w.cue.keeping : low ? w.cue.low : !rang ? w.cue.start : note === 'behind' ? w.cue.behind : note === 'dark' ? w.cue.dark
    : step === 'stickers' ? (nudge === 'full' || (full && !picked) ? w.cue.full : picked ? w.cue.aim : nudge === 'placed' ? w.cue.placed : w.cue.pick) : w.cue[step];
  const hear = `${cue} ${w.say[step]} ${w.say.play}`;

  if (phase === 'done') {
    return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction}>
      <section className="bl" data-adventure="bottle-lab" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish creation={{ kind: 'bottle', shape: bottle.shape, tint: bottle.tint, finish: bottle.finish, stickers: bottle.stickers.map(({ art, slot }) => ({ art, slot })) }} title={w.finish} subtitle={w.transfer} onPlayAgain={() => { const next = sitting(sittings++); setBottle(next.bottle); setStep('shape'); setSeen([]); setRang(false); setNote(null); setPhase('make'); }} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  const nextStep = STEPS.find(s => !seen.includes(s) && s !== step);
  const options: Record<Step, ReactNode> = {
    shape: BOTTLE_SHAPES.map((s, i) => <button key={s} type="button" className="bl-swatch" data-bl-shape={s} aria-pressed={bottle.shape === s} disabled={!live} onClick={() => choose('shape', s, i)}>
      <ShapeIcon shape={s} /><span>{w.shapes[s]}</span><Tick /></button>),
    tint: BOTTLE_TINTS.map((t, i) => <button key={t} type="button" className="bl-swatch" data-bl-tint={t} aria-pressed={bottle.tint === t} disabled={!live} onClick={() => choose('tint', t, i)} style={TINT_STYLE[t]}>
      <TintIcon /><span>{w.tints[t]}</span><Tick /></button>),
    finish: BOTTLE_FINISHES.map((f, i) => <button key={f} type="button" className="bl-swatch" data-bl-finish={f} aria-pressed={bottle.finish === f} disabled={!live} onClick={() => choose('finish', f, i)}>
      <FinishIcon frost={f === 'frost'} /><span>{w.finishes[f]}</span><Tick /></button>),
    stickers: deal.sheet.map(a => <button key={a} type="button" className="bl-sticker" data-bl-art={a} aria-pressed={picked === a} aria-label={fillIn(w.stickerPick, w.stickers[a])} disabled={!live} data-carried={carry?.art === a}
      onClick={() => pick(a)} onPointerDown={e => onTrayDown(e, a)} onPointerMove={onTrayMove} onPointerUp={onTrayUp} onPointerCancel={() => { gesture.current = null; setCarry(null); }}>
      <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false"><StickerArt uid={`${uid}t${a}`} art={a} /></svg></button>),
  };
  return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction} hearIt={hear}>
    <section className="bl" data-adventure="bottle-lab" data-step={step} data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'} style={TINT_STYLE[bottle.tint]}>
      <div className="bl-bench">
        {/* The still life never mirrors: light and glass behave the same in both languages. */}
        <div className="bl-window">
          <BottleStage ref={stage} uid={uid} w={w} bottle={bottle} live={live} audio={audio} picked={picked} hot={carry?.hot ?? null} aiming={live && (picked !== null || carry !== null)} fresh={fresh} ghost={ghost}
            start={{ lamp: deal.lamp, rotation: -20 }} onPlace={slot => place(slot)} onPeel={peel} onPlay={onPlay} />
          {/* ViewCheck, the kit's tool for the view from a lower height: the bottle from Aya's eye level. */}
          <button type="button" className="bl-view" data-bl-view="" aria-label={w.viewCheck} aria-pressed={low} disabled={!live} onClick={() => { void selectionHaptic(); setLow(stage.current?.viewCheck() ?? false); }}><ScanEye size={26} aria-hidden="true" /></button>
        </div>

        <div className="bl-side">
          <p className="bl-cue" role="status" key={cue}>{cue}</p>
          <div className="bl-tabs" role="group" aria-label={w.stepsLabel}>
            {STEPS.map(s => <button key={s} type="button" className="bl-tab" data-bl-step={s} aria-current={s === step ? 'step' : undefined} data-done={seen.includes(s)} data-next={s === nextStep} disabled={!live} onClick={() => go(s)}>
              <span className="bl-tab__mark" aria-hidden="true">{seen.includes(s) ? <Check size={12} strokeWidth={3.5} /> : null}</span><span className="bl-tab__name">{w.steps[s]}</span>
            </button>)}
          </div>
          <div className="bl-groups">
            {STEPS.map(s => <div key={s} className="bl-group" role="group" aria-label={w.steps[s]} data-group={s} data-active={s === step}>
              <span className="bl-group__name" aria-hidden="true">{w.steps[s]}{seen.includes(s) && <Check size={13} strokeWidth={3.5} />}</span>
              <div className="bl-options" data-for={s}>{options[s]}</div>
            </div>)}
          </div>
          <div className="bl-actions" dir="ltr">
            {/* The turn buttons follow the picture, which never mirrors. */}
            <button type="button" className="bl-round" data-bl-rotate="prev" aria-label={w.turnLeft} disabled={!live} onClick={() => stage.current?.turnBy(-TURN_STEP)}><RotateCcw size={24} aria-hidden="true" /></button>
            <button type="button" className="bl-keep" data-bl-keep="" disabled={!live} onClick={keep}><Check size={22} aria-hidden="true" /><span dir="auto">{w.done}</span></button>
            <button type="button" className="bl-round" data-bl-rotate="next" aria-label={w.turnRight} disabled={!live} onClick={() => stage.current?.turnBy(TURN_STEP)}><RotateCw size={24} aria-hidden="true" /></button>
            {kept?.kind === 'bottle' && validBottle(kept) && <button type="button" className="bl-open" data-bl-open="" disabled={!live} onClick={openKept}><span dir="auto">{w.open}</span></button>}
          </div>
        </div>
      </div>
      {carry && <span className="bl-carry" aria-hidden="true" data-home={!!carry.home && carry.x === carry.home.x && carry.y === carry.home.y} style={{ '--x': `${carry.x}px`, '--y': `${carry.y}px` } as CSSProperties}>
        <svg viewBox="-24 -24 48 48" focusable="false"><StickerArt uid={`${uid}c`} art={carry.art} lift /></svg></span>}
    </section>
  </GameShell>;
}

// ── Swatch art: what the choice looks like, in the glass's own colours ─────

const Tick = () => <span className="bl-tick" aria-hidden="true"><Check size={12} strokeWidth={3.5} /></span>;
function ShapeIcon({ shape }: { shape: ShapeId }) {
  const top = topY(shape) - 26;
  return <svg className="bl-swatch__art" viewBox={`${AXIS_X - 100} ${top} 200 ${BASE_Y + 22 - top}`} aria-hidden="true" focusable="false">
    <path d={silhouettePath(shape)} style={{ fill: 'color-mix(in srgb, var(--bl-glass) 55%, var(--mk-white))' }} />
    <path d={silhouettePath(shape, 0.72)} style={{ fill: 'var(--mk-white)', opacity: 0.45 }} />
    <path d={silhouettePath(shape)} style={{ fill: 'none', stroke: 'var(--bl-edge)', strokeOpacity: 0.55, strokeWidth: 6 }} />
    <rect x={AXIS_X - radiusAt(shape, topY(shape)) - 5} y={topY(shape) - 22} width={(radiusAt(shape, topY(shape)) + 5) * 2} height="28" rx="6" style={{ fill: 'var(--mk-wood-light)' }} />
    <rect x={AXIS_X - radiusAt(shape, topY(shape)) - 5} y={topY(shape) - 1} width={(radiusAt(shape, topY(shape)) + 5) * 2} height="7" rx="2" style={{ fill: 'var(--mk-teal)' }} />
  </svg>;
}
function TintIcon() {
  return <svg className="bl-swatch__art" viewBox="-30 -30 60 60" aria-hidden="true" focusable="false">
    <circle r="26" style={{ fill: 'var(--bl-glass)', opacity: 0.55 }} />
    <circle r="26" style={{ fill: 'none', stroke: 'var(--bl-edge)', strokeWidth: 7, opacity: 0.8 }} />
    <circle r="22.5" style={{ fill: 'none', stroke: 'var(--bl-light)', strokeWidth: 1.6, opacity: 0.9 }} />
    <path d="M-15 -8C-12 -15 -6 -18 0 -19" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 4, strokeLinecap: 'round' }} />
  </svg>;
}
function FinishIcon({ frost }: { frost: boolean }) {
  return <svg className="bl-swatch__art" viewBox="-30 -30 60 60" aria-hidden="true" focusable="false">
    <circle r="26" style={{ fill: frost ? 'color-mix(in srgb, var(--bl-glass) 40%, var(--mk-snow))' : 'color-mix(in srgb, var(--bl-glass) 60%, transparent)' }} />
    {[-14, -5, 4, 13].map(y => <rect key={y} x="-26" y={y - 2.5} width="52" height="5" style={{ fill: 'var(--mk-ink-soft)', opacity: frost ? 0.18 : 0.42, filter: frost ? 'blur(1.6px)' : undefined }} />)}
    <circle r="26" style={{ fill: 'none', stroke: 'var(--bl-edge)', strokeWidth: 4, opacity: 0.6 }} />
    {frost ? <circle r="17" cx="-6" cy="-7" style={{ fill: 'var(--mk-white)', opacity: 0.35, filter: 'blur(4px)' }} /> : <path d="M-14 -10C-11 -16 -6 -19 1 -20" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 4.5, strokeLinecap: 'round' }} />}
  </svg>;
}
