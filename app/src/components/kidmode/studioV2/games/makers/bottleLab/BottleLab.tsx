import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Droplets, Lightbulb, LightbulbOff, RotateCcw, RotateCw } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import '../makerPalette.css';
import './bottleLab.css';
import { createBottleAudio, type BottleAudio } from './bottleAudio';
import { Backdrop, BottleDefs, Cap, GlassFront, GlassInside, GlassLight, Lamp, LampLight, SlotRings, StickerArt, StickerLayer, TINT_STYLE, TableShadow, WaterSurface, ids, slotPlace } from './BottleArt';
import { AXIS_X, BASE_Y, SCENE_H, SCENE_W, bottomY, maxRadius, radiusAt, silhouettePath, topY, type ShapeId } from './bottleGeometry';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import {
  BOTTLE_FINISHES, BOTTLE_SHAPES, BOTTLE_STICKERS, BOTTLE_TINTS, LAMP_MAX, LAMP_MIN, LAMP_START, LAMP_STEP, MAX_BUBBLES, TURN_STEP,
  burstCount, clampLamp, dragTurn, freshBottle, lampAngleAt, lampPosition, peelSticker, placeSticker, reachableSlots, riseBubble, slotTaken, snapRotation,
  spawnBubble, stickersFull, validBottle, type Bubble, type BottleCreation, type BottleSticker,
} from './bottleLabRules';
import { refractionMap } from './bottleRefraction';

type Step = 'shape' | 'tint' | 'finish' | 'stickers' | 'light';
const STEPS: readonly Step[] = ['shape', 'tint', 'finish', 'stickers', 'light'];
type Phase = 'make' | 'turning' | 'done';
/** The keeping turn: one slow full revolution before the result card. */
const TURN_MS = 3600;
const REDUCED_KEEP_MS = 900;
const fillIn = (template: string, ...values: string[]) => template.replace(/\{(\d)\}/g, (_m, i: string) => values[Number(i)] ?? '');
const pct = (n: number, of: number) => `${(n / of * 100).toFixed(3)}%`;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A drag of a sticker from the tray: where the pointer is and which ring it is over. */
interface Carry { art: BottleSticker; x: number; y: number; hot: number | null; home?: { x: number; y: number } }

export default function BottleLab() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = BOTTLE_LAB_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const kept = saved.items.find(item => item.creation.kind === 'bottle')?.creation;
  const uid = `g${useId()}`;

  const [bottle, setBottle] = useState<BottleCreation>(freshBottle);
  const [step, setStep] = useState<Step>('shape');
  const [phase, setPhase] = useState<Phase>('make');
  const [rotation, setRotationState] = useState(-20);
  const [lamp, setLamp] = useState(LAMP_START);
  const [lampOn, setLampOn] = useState(true);
  const [picked, setPicked] = useState<BottleSticker | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const [slosh, setSlosh] = useState(0);
  const [shakes, setShakes] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);
  const [reduced, setReduced] = useState(reducedMotion);
  const [stillBubbles, setStillBubbles] = useState(0);

  const stage = useRef<HTMLDivElement>(null);
  const audio = useRef<BottleAudio | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rotationRef = useRef(rotation), targetRef = useRef(rotation), turnFrame = useRef(0), sloshFrame = useRef(0);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const gesture = useRef<{ kind: 'bottle' | 'lamp' | 'tray'; id: number; x: number; y: number; start: number; moved: boolean; slot: boolean; art?: BottleSticker } | null>(null);
  const dragged = useRef(false);

  const later = (ms: number, run: () => void) => { const id = setTimeout(() => { timers.current = timers.current.filter(t => t !== id); run(); }, ms); timers.current.push(id); };
  useEffect(() => {
    const sound = createBottleAudio(); audio.current = sound;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMedia = () => setReduced(!!media?.matches);
    media?.addEventListener?.('change', onMedia);
    return () => {
      for (const id of timers.current) clearTimeout(id); timers.current = [];
      cancelAnimationFrame(turnFrame.current); cancelAnimationFrame(sloshFrame.current);
      sound.dispose(); audio.current = null;
      media?.removeEventListener?.('change', onMedia);
    };
  }, []);

  // ── Turning the bottle ────────────────────────────────────────────────
  const setRotation = (value: number) => { rotationRef.current = value; setRotationState(value); };
  /** Eases toward the target; with motion reduced it cuts straight there. */
  const turnTo = (target: number) => {
    targetRef.current = target;
    cancelAnimationFrame(turnFrame.current);
    if (reducedRef.current) { setRotation(target); return; }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const gap = targetRef.current - rotationRef.current;
      if (Math.abs(gap) < 0.3) { setRotation(targetRef.current); return; }
      setRotation(rotationRef.current + gap * Math.min(1, dt * 9));
      turnFrame.current = requestAnimationFrame(tick);
    };
    turnFrame.current = requestAnimationFrame(tick);
  };
  const turnBy = (delta: number) => { void selectionHaptic(); turnTo(snapRotation(targetRef.current) + delta); };

  // ── Bubbles: a small simulation drawn straight into the SVG ────────────
  const bubbleEls = useRef<(SVGCircleElement | null)[]>([]);
  const popEls = useRef<(SVGCircleElement | null)[]>([]);
  const sim = useRef({ bubbles: [] as Bubble[], pops: [] as { x: number; y: number; age: number }[], t: 0, nextTrickle: 0.4, burst: 0, id: 0, slosh: 0 });
  useEffect(() => {
    const s = sim.current; s.bubbles = []; s.pops = []; s.burst = 0;
    if (reduced) { for (const el of [...bubbleEls.current, ...popEls.current]) el?.setAttribute('visibility', 'hidden'); return; }
    let frame = 0, last = 0, running = true;
    const shape = bottle.shape;
    const draw = () => {
      for (let i = 0; i < MAX_BUBBLES; i++) {
        const el = bubbleEls.current[i], b = s.bubbles[i];
        if (!el) continue;
        if (!b) { el.setAttribute('visibility', 'hidden'); continue; }
        el.setAttribute('visibility', 'visible'); el.setAttribute('cx', b.x.toFixed(2)); el.setAttribute('cy', b.y.toFixed(2)); el.setAttribute('r', b.r.toFixed(2));
      }
      for (let i = 0; i < popEls.current.length; i++) {
        const el = popEls.current[i], p = s.pops[i];
        if (!el) continue;
        if (!p) { el.setAttribute('visibility', 'hidden'); continue; }
        el.setAttribute('visibility', 'visible'); el.setAttribute('cx', p.x.toFixed(1)); el.setAttribute('cy', p.y.toFixed(1));
        el.setAttribute('r', (2 + p.age * 16).toFixed(2)); el.setAttribute('opacity', Math.max(0, 0.9 - p.age * 2.6).toFixed(2));
      }
    };
    const tick = (now: number) => {
      if (!running) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now; s.t += dt;
      if (s.bubbles.length < 7 && s.t > s.nextTrickle) { s.bubbles.push(spawnBubble(shape, s.id++, Math.random)); s.nextTrickle = s.t + 0.55 + Math.random() * 0.9; }
      while (s.burst > 0 && s.bubbles.length < MAX_BUBBLES) { s.bubbles.push(spawnBubble(shape, s.id++, Math.random, AXIS_X, true)); s.burst--; }
      s.burst = 0;
      const next: Bubble[] = [];
      for (const b of s.bubbles) { const moved = riseBubble(shape, b, s.t, dt); if (moved) next.push(moved); else if (s.pops.length < 6) s.pops.push({ x: b.x, y: b.y - b.r, age: 0 }); }
      s.bubbles = next;
      s.pops = s.pops.map(p => ({ ...p, age: p.age + dt })).filter(p => p.age < 0.35);
      draw();
      frame = requestAnimationFrame(tick);
    };
    const start = () => { if (!running) return; cancelAnimationFrame(frame); last = 0; frame = requestAnimationFrame(tick); };
    const onVisible = () => { if (document.visibilityState === 'hidden') { cancelAnimationFrame(frame); audio.current?.stop(); } else start(); };
    document.addEventListener('visibilitychange', onVisible);
    start();
    return () => { running = false; cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisible); };
  }, [bottle.shape, reduced]);

  /** A tap on the glass: a tink, a little shake, a burst of bubbles, the water sloshing. */
  const shake = () => {
    void selectionHaptic();
    audio.current?.play('tink');
    setShakes(n => n + 1);
    if (reducedRef.current) { setStillBubbles(n => n + 1); return; }
    const count = burstCount(sim.current.bubbles.length);
    sim.current.burst = count;
    if (count) later(90, () => audio.current?.play('fizz', 0.4 + count / 24));
    const begin = performance.now();
    cancelAnimationFrame(sloshFrame.current);
    const wave = (now: number) => {
      const t = (now - begin) / 1000;
      if (t > 1.6) { setSlosh(0); return; }
      setSlosh(7 * Math.exp(-2.8 * t) * Math.sin(t * 13));
      sloshFrame.current = requestAnimationFrame(wave);
    };
    sloshFrame.current = requestAnimationFrame(wave);
  };

  // ── Choices ────────────────────────────────────────────────────────────
  const choose = <K extends 'shape' | 'tint' | 'finish'>(key: K, value: BottleCreation[K]) => {
    if (phase !== 'make' || bottle[key] === value) return;
    void selectionHaptic(); audio.current?.play('tink', 0.6);
    setBottle(b => ({ ...b, [key]: value }));
  };
  const place = (slot: number, art: BottleSticker | null = picked) => {
    if (!art || phase !== 'make') return;
    const next = placeSticker(bottle.stickers, art, slot);
    if (next === bottle.stickers) { setNudge(stickersFull(bottle.stickers) ? 'full' : null); return; }
    void selectionHaptic(); audio.current?.play('thup');
    setBottle(b => ({ ...b, stickers: [...next] })); setNudge('placed');
    if (stickersFull(next)) setPicked(null);
  };
  const peel = (slot: number) => {
    if (phase !== 'make' || !slotTaken(bottle.stickers, slot)) return;
    void selectionHaptic(); audio.current?.play('thup', 0.5);
    setBottle(b => ({ ...b, stickers: [...peelSticker(b.stickers, slot)] })); setNudge(null);
  };
  const pick = (art: BottleSticker) => {
    if (dragged.current) { dragged.current = false; return; }
    void selectionHaptic();
    if (stickersFull(bottle.stickers)) { setNudge('full'); setPicked(null); return; }
    setPicked(current => current === art ? null : art); setNudge(null);
  };
  const go = (next: Step) => { void selectionHaptic(); setStep(next); setPicked(null); setCarry(null); setNudge(null); if (next === 'stickers' || next === 'light') turnTo(snapRotation(targetRef.current)); };
  const stepIndex = STEPS.indexOf(step);
  const keep = () => {
    if (phase !== 'make') return;
    void selectionHaptic(); setPicked(null); setPhase('turning'); setLampOn(true);
    if (reducedRef.current) { later(REDUCED_KEEP_MS, () => setPhase('done')); return; }
    const from = rotationRef.current, begin = performance.now();
    cancelAnimationFrame(turnFrame.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / TURN_MS), ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      setRotation(from + 360 * ease);
      if (t < 1) turnFrame.current = requestAnimationFrame(tick);
    };
    turnFrame.current = requestAnimationFrame(tick);
    // The finish is a timer, not the animation's end: it comes even if frames stop.
    later(TURN_MS + 250, () => { cancelAnimationFrame(turnFrame.current); setPhase('done'); });
  };
  const openKept = () => {
    if (!kept || kept.kind !== 'bottle' || !validBottle(kept) || !saved.isCurrent()) return;
    void selectionHaptic(); audio.current?.play('tink', 0.7);
    setBottle({ kind: 'bottle', shape: kept.shape, tint: kept.tint, finish: kept.finish, stickers: kept.stickers.map(({ art, slot }) => ({ art, slot })) });
    setStep('light');
  };

  // ── Pointer: turn the bottle, aim the lamp, carry a sticker ────────────
  const toScene = (clientX: number, clientY: number) => {
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    return { x: (clientX - rect.left) / rect.width * SCENE_W, y: (clientY - rect.top) / rect.height * SCENE_H, inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom, scale: rect.width / SCENE_W };
  };
  const reach = useMemo(() => reachableSlots(snapRotation(rotation)).filter(slot => Math.abs(rotation - snapRotation(rotation)) < 8), [rotation]);
  const freeReach = reach.filter(slot => !slotTaken(bottle.stickers, slot));
  const hotSlot = (clientX: number, clientY: number) => {
    const p = toScene(clientX, clientY);
    if (!p?.inside) return null;
    let best: number | null = null, dist = 42;
    for (const slot of freeReach) { const q = slotPlace(bottle.shape, slot, rotation), d = Math.hypot(q.cx - p.x, q.cy - p.y); if (d < dist) { best = slot; dist = d; } }
    return best;
  };
  const onStageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== 'make' || e.button > 0) return;
    const target = e.target as Element;
    const kind = target.closest('[data-bl-lamp]') ? 'lamp' : target.closest('[data-bl-bottle]') || target.closest('[data-bl-slot]') ? 'bottle' : null;
    if (!kind) return;
    gesture.current = { kind, id: e.pointerId, x: e.clientX, y: e.clientY, start: rotationRef.current, moved: false, slot: !!target.closest('[data-bl-slot]') };
    if (kind === 'lamp') { e.currentTarget.setPointerCapture?.(e.pointerId); gesture.current.moved = true; }
  };
  const onStageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.kind === 'tray') return;
    if (g.kind === 'lamp') { const p = toScene(e.clientX, e.clientY); if (p) setLamp(Math.round(lampAngleAt(p.x, p.y))); return; }
    const dx = e.clientX - g.x;
    if (!g.moved && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(e.clientY - g.y)) { g.moved = true; e.currentTarget.setPointerCapture?.(e.pointerId); cancelAnimationFrame(turnFrame.current); }
    if (g.moved) {
      const rect = stage.current?.getBoundingClientRect(); const width = rect ? maxRadius(bottle.shape) * 2 * rect.width / SCENE_W : 1;
      const value = g.start + dragTurn(dx, width); targetRef.current = value; setRotation(value);
    }
  };
  const onStageUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId || g.kind === 'tray') return;
    gesture.current = null;
    if (g.kind === 'lamp') { audio.current?.play('tink', 0.3); return; }
    if (g.moved) { turnTo(snapRotation(rotationRef.current)); return; }
    if (!g.slot) shake();
  };
  const onTrayDown = (e: ReactPointerEvent<HTMLButtonElement>, art: BottleSticker) => {
    if (phase !== 'make' || e.button > 0) return;
    gesture.current = { kind: 'tray', id: e.pointerId, x: e.clientX, y: e.clientY, start: 0, moved: false, slot: false, art };
    dragged.current = false;
  };
  const onTrayMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.kind !== 'tray' || g.id !== e.pointerId || !g.art) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 9) {
      if (stickersFull(bottle.stickers)) { setNudge('full'); gesture.current = null; return; }
      g.moved = true; e.currentTarget.setPointerCapture?.(e.pointerId); setPicked(g.art); setNudge(null);
      // Pick up the sticker where it lies, so it can drift back there.
      setCarry({ art: g.art, x: e.clientX, y: e.clientY, hot: null, home: { x: g.x, y: g.y } });
    }
    if (g.moved) setCarry(c => c && { ...c, x: e.clientX, y: e.clientY, hot: hotSlot(e.clientX, e.clientY) });
  };
  const onTrayUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g || g.kind !== 'tray' || g.id !== e.pointerId) return;
    gesture.current = null;
    if (!g.moved || !g.art) return;
    dragged.current = true;
    const hot = hotSlot(e.clientX, e.clientY);
    if (hot !== null) { place(hot, g.art); setCarry(null); return; }
    // Not on a ring: the sticker drifts home, no words.
    setCarry(c => c && c.home ? { ...c, x: c.home.x, y: c.home.y, hot: null } : null);
    later(reducedRef.current ? 0 : 280, () => setCarry(null));
  };

  // ── Keyboard ───────────────────────────────────────────────────────────
  const onBottleKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); turnBy(-TURN_STEP); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); turnBy(TURN_STEP); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shake(); }
  };
  const moveLamp = (delta: number) => { void selectionHaptic(); setLamp(a => clampLamp(a + delta)); };
  const onLampKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); moveLamp(-LAMP_STEP); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); moveLamp(LAMP_STEP); }
    else if (e.key === 'Home') { e.preventDefault(); setLamp(LAMP_MIN); }
    else if (e.key === 'End') { e.preventDefault(); setLamp(LAMP_MAX); }
  };

  // ── Words ──────────────────────────────────────────────────────────────
  const ask = phase === 'turning' ? w.ask.turning : w.ask[step];
  const line = phase === 'turning' ? w.line.turning
    : step === 'stickers' ? (nudge === 'full' || (stickersFull(bottle.stickers) && !picked) ? w.line.full : picked ? w.line.aim : nudge === 'placed' ? w.line.placed : w.line.pick)
    : step === 'light' ? (lampOn ? w.line.light : w.line.dark) : w.line[step];
  const lampText = lamp < -12 ? w.lampAt.left : lamp > 12 ? w.lampAt.right : w.lampAt.above;
  const map = useMemo(() => refractionMap(bottle.shape, bottle.finish === 'frost'), [bottle.shape, bottle.finish]);

  if (phase === 'done') {
    return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction}>
      <section className="bl" data-adventure="bottle-lab" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <GameFinish creation={{ kind: 'bottle', shape: bottle.shape, tint: bottle.tint, finish: bottle.finish, stickers: bottle.stickers.map(({ art, slot }) => ({ art, slot })) }} title={w.finish} subtitle={w.transfer} onPlayAgain={() => { setBottle(freshBottle()); setStep('shape'); setPhase('make'); setRotation(-20); targetRef.current = -20; }} playAgainLabel={shared.again} homeLabel={shared.home} />
      </section>
    </GameShell>;
  }

  const shape = bottle.shape, top = topY(shape), half = maxRadius(shape);
  const showRings = step === 'stickers' && phase === 'make' && (picked !== null || carry !== null);
  const lampPos = lampPosition(lamp);
  const rowName = (slot: number) => w.rows[Math.floor(slot / 4)];
  return <GameShell fullBleed autoNarrate={false} worldId="bottle-lab" title={w.title} instruction={w.instruction} hearIt={ask}>
    <section className="bl" data-adventure="bottle-lab" data-step={step} data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'} style={TINT_STYLE[bottle.tint]}>
      <div className="bl-bench">
        {/* The still life never mirrors: light and glass behave the same in both languages. */}
        <div className="bl-window">
          <div ref={stage} className="bl-stage" dir="ltr" data-bl-stage="" data-shape={shape} data-tint={bottle.tint} data-finish={bottle.finish} data-lamp={lampOn ? 'on' : 'off'}
            onPointerDown={onStageDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={() => { gesture.current = null; turnTo(snapRotation(rotationRef.current)); }}>
            <StaticLayer uid={uid} shape={shape} finish={bottle.finish} map={map} />
            <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
              <LampLight uid={uid} angle={lamp} on={lampOn} />
              <TableShadow uid={uid} shape={shape} angle={lamp} on={lampOn} />
              <Lamp uid={uid} angle={lamp} on={lampOn} />
            </svg>
            <div className="bl-glass" key={`shake${shakes}`} data-shaking={shakes > 0 && !reduced}>
              <InsideLayer uid={uid} shape={shape} finish={bottle.finish} />
              <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
                <g clipPath={ids(uid).url('inner')}>
                  {Array.from({ length: MAX_BUBBLES }, (_, i) => <circle key={i} ref={el => { bubbleEls.current[i] = el; }} r="0" visibility="hidden" style={{ fill: ids(uid).url('bubble') }} />)}
                  {Array.from({ length: 6 }, (_, i) => <circle key={`p${i}`} ref={el => { popEls.current[i] = el; }} r="0" visibility="hidden" style={{ fill: 'none', stroke: 'var(--mk-white)', strokeWidth: 1.1 }} />)}
                  {reduced && <StillBubbleSet shape={shape} seed={stillBubbles} uid={uid} />}
                </g>
              </svg>
              <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false" data-rotation={Math.round(rotation)}>
                <StickerLayer uid={uid} shape={shape} stickers={bottle.stickers} rotation={rotation} side="back" />
                <GlassFront uid={uid} shape={shape} finish={bottle.finish} />
                <WaterSurface uid={uid} shape={shape} slosh={slosh} />
                <StickerLayer uid={uid} shape={shape} stickers={bottle.stickers} rotation={rotation} side="front" />
                <GlassLight uid={uid} shape={shape} finish={bottle.finish} angle={lamp} on={lampOn} />
                <Cap uid={uid} shape={shape} rotation={rotation} angle={lamp} on={lampOn} />
                {showRings && <SlotRings uid={uid} shape={shape} slots={freeReach} rotation={rotation} hot={carry?.hot ?? null} />}
              </svg>
            </div>
            {/* Touch and keyboard targets over the picture. */}
            <div className="bl-hit" data-bl-bottle="" role="slider" tabIndex={0} aria-label={w.bottle} aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(((rotation % 360) + 540) % 360 - 180)} aria-valuetext={w.bottle}
              onKeyDown={onBottleKey}
              style={{ left: pct(AXIS_X - half - 6, SCENE_W), width: pct(half * 2 + 12, SCENE_W), top: pct(top - 36, SCENE_H), height: pct(bottomY(shape) - top + 44, SCENE_H) }} />
            {step === 'stickers' && phase === 'make' && reach.map(slot => {
              const taken = bottle.stickers.find(s => s.slot === slot);
              if (!taken && !picked) return null;
              const p = slotPlace(shape, slot, rotation);
              return <button key={slot} type="button" className="bl-slot" data-bl-slot={slot} data-free={!taken} style={{ left: pct(p.cx, SCENE_W), top: pct(p.cy, SCENE_H) }}
                aria-label={taken ? fillIn(w.slotPeel, w.stickers[taken.art], rowName(slot)) : fillIn(w.slotFree, w.stickers[picked ?? 'star'], rowName(slot))}
                onClick={() => taken ? peel(slot) : place(slot)} />;
            })}
            <div className="bl-lamp" data-bl-lamp="" role="slider" tabIndex={0} aria-label={w.lamp} aria-valuemin={LAMP_MIN} aria-valuemax={LAMP_MAX} aria-valuenow={lamp} aria-valuetext={lampText}
              onKeyDown={onLampKey} style={{ left: pct(lampPos.x, SCENE_W), top: pct(lampPos.y, SCENE_H) }} />
            <div className="bl-turns">
              <button type="button" className="bl-round" data-bl-rotate="prev" aria-label={w.turnLeft} disabled={phase !== 'make'} onClick={() => turnBy(-TURN_STEP)}><RotateCcw size={24} aria-hidden="true" /></button>
              <button type="button" className="bl-round" data-bl-rotate="next" aria-label={w.turnRight} disabled={phase !== 'make'} onClick={() => turnBy(TURN_STEP)}><RotateCw size={24} aria-hidden="true" /></button>
            </div>
          </div>
        </div>

        <div className="bl-side">
          <ol className="bl-steps" aria-label={w.stepsLabel}>
            {STEPS.map((s, i) => <li key={s}><button type="button" className="bl-step" data-bl-step={s} aria-current={s === step ? 'step' : undefined} data-done={i < stepIndex} disabled={phase !== 'make'} onClick={() => go(s)}>
              <span className="bl-step__dot" aria-hidden="true">{i < stepIndex ? <Check size={14} strokeWidth={3} /> : null}</span><span className="bl-step__name">{w.steps[s]}</span>
            </button></li>)}
          </ol>
          <h2 className="bl-ask" key={`${step}${phase}`}>{ask}</h2>
          <p className="bl-line" role="status">{line}</p>

          <div className="bl-options" data-for={step} aria-disabled={phase !== 'make'}>
            {step === 'shape' && <>
              {BOTTLE_SHAPES.map(s => <button key={s} type="button" className="bl-swatch" data-bl-shape={s} aria-pressed={bottle.shape === s} disabled={phase !== 'make'} onClick={() => choose('shape', s)}>
                <ShapeIcon shape={s} /><span>{w.shapes[s]}</span></button>)}
              {kept?.kind === 'bottle' && validBottle(kept) && <button type="button" className="bl-open" data-bl-open="" onClick={openKept}>{w.open}</button>}
            </>}
            {step === 'tint' && BOTTLE_TINTS.map(t => <button key={t} type="button" className="bl-swatch" data-bl-tint={t} aria-pressed={bottle.tint === t} disabled={phase !== 'make'} onClick={() => choose('tint', t)} style={TINT_STYLE[t]}>
              <TintIcon /><span>{w.tints[t]}</span></button>)}
            {step === 'finish' && BOTTLE_FINISHES.map(f => <button key={f} type="button" className="bl-swatch bl-swatch--wide" data-bl-finish={f} aria-pressed={bottle.finish === f} disabled={phase !== 'make'} onClick={() => choose('finish', f)}>
              <FinishIcon frost={f === 'frost'} /><span>{w.finishes[f]}</span></button>)}
            {step === 'stickers' && BOTTLE_STICKERS.map(a => <button key={a} type="button" className="bl-sticker" data-bl-art={a} aria-pressed={picked === a} aria-label={fillIn(w.stickerPick, w.stickers[a])} disabled={phase !== 'make'} data-carried={carry?.art === a}
              onClick={() => pick(a)} onPointerDown={e => onTrayDown(e, a)} onPointerMove={onTrayMove} onPointerUp={onTrayUp} onPointerCancel={() => { gesture.current = null; setCarry(null); }}>
              <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false"><StickerArt uid={`${uid}t`} art={a} /></svg></button>)}
            {step === 'light' && <div className="bl-lightbar">
              {/* The lamp's controls follow the picture, which never mirrors. */}
              <div className="bl-lampbar" dir="ltr" role="group" aria-label={w.lamp}>
                <button type="button" className="bl-round" data-bl-lamp-move="left" aria-label={w.lampLeft} disabled={phase !== 'make' || lamp <= LAMP_MIN} onClick={() => moveLamp(-LAMP_STEP)}><ChevronLeft size={26} aria-hidden="true" /></button>
                <button type="button" className="bl-round bl-bulb" data-bl-lamp-switch="" aria-label={w.lampSwitch} aria-pressed={lampOn} disabled={phase !== 'make'} onClick={() => { void selectionHaptic(); setLampOn(v => !v); }}>
                  {lampOn ? <Lightbulb size={24} aria-hidden="true" /> : <LightbulbOff size={24} aria-hidden="true" />}</button>
                <button type="button" className="bl-round" data-bl-lamp-move="right" aria-label={w.lampRight} disabled={phase !== 'make' || lamp >= LAMP_MAX} onClick={() => moveLamp(LAMP_STEP)}><ChevronRight size={26} aria-hidden="true" /></button>
              </div>
              <button type="button" className="bl-switch" data-bl-shake="" aria-label={w.shake} disabled={phase !== 'make'} onClick={shake}><Droplets size={24} aria-hidden="true" /><span>{w.bubbles}</span></button>
            </div>}
          </div>

          <div className="bl-nav">
            <button type="button" className="bl-nav__back" data-bl-back="" disabled={phase !== 'make' || stepIndex === 0} onClick={() => go(STEPS[Math.max(0, stepIndex - 1)])}>
              <ChevronLeft size={22} aria-hidden="true" className="bl-flip" /><span>{w.back}</span></button>
            {step === 'light'
              ? <button type="button" className="bl-nav__go" data-bl-keep="" disabled={phase !== 'make'} onClick={keep}><Check size={22} aria-hidden="true" /><span>{w.done}</span></button>
              : <button type="button" className="bl-nav__go" data-bl-next="" disabled={phase !== 'make'} onClick={() => go(STEPS[stepIndex + 1])}><span>{w.next}</span><ChevronRight size={22} aria-hidden="true" className="bl-flip" /></button>}
          </div>
        </div>
      </div>
      {carry && <span className="bl-carry" aria-hidden="true" data-home={!!carry.home && carry.x === carry.home.x && carry.y === carry.home.y} style={{ '--x': `${carry.x}px`, '--y': `${carry.y}px` } as CSSProperties}>
        <svg viewBox="-24 -24 48 48" focusable="false"><StickerArt uid={`${uid}c`} art={carry.art} lift /></svg></span>}
    </section>
  </GameShell>;
}

/** The room and the bent view through the glass do not move with the lamp or
 * the turning, so they are drawn once per shape and finish. */
const StaticLayer = memo(function StaticLayer({ uid, shape, finish, map }: { uid: string; shape: ShapeId; finish: BottleCreation['finish']; map: ReturnType<typeof refractionMap> }) {
  return <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
    <BottleDefs uid={uid} shape={shape} finish={finish} map={map} />
    <Backdrop uid={uid} />
  </svg>;
});
const InsideLayer = memo(function InsideLayer({ uid, shape, finish }: { uid: string; shape: ShapeId; finish: BottleCreation['finish'] }) {
  return <svg className="bl-layer" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
    <GlassInside uid={uid} shape={shape} finish={finish} />
  </svg>;
});

/** With motion reduced, bubbles are a still handful; a shake cuts to a new handful. */
function StillBubbleSet({ uid, shape, seed }: { uid: string; shape: ShapeId; seed: number }) {
  let s = 97 + seed * 131;
  const roll = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const list = Array.from({ length: seed ? 14 : 7 }, (_, i) => spawnBubble(shape, i, roll, AXIS_X, true));
  return <>{list.map(b => <circle key={b.id} cx={b.x} cy={b.y} r={b.r} style={{ fill: ids(uid).url('bubble') }} />)}</>;
}

// ── Swatch art ─────────────────────────────────────────────────────────────

function ShapeIcon({ shape }: { shape: ShapeId }) {
  const top = topY(shape) - 26;
  return <svg className="bl-swatch__art" viewBox={`${AXIS_X - 100} ${top} 200 ${BASE_Y + 22 - top}`} aria-hidden="true" focusable="false">
    <path d={silhouettePath(shape)} style={{ fill: 'color-mix(in srgb, var(--bl-glass) 55%, var(--mk-white))' }} />
    <path d={silhouettePath(shape, 0.72)} style={{ fill: 'var(--mk-white)', opacity: 0.45 }} />
    <path d={silhouettePath(shape)} style={{ fill: 'none', stroke: 'var(--bl-edge)', strokeOpacity: 0.55, strokeWidth: 6 }} />
    <rect x={AXIS_X - radiusAt(shape, topY(shape)) - 5} y={topY(shape) - 22} width={(radiusAt(shape, topY(shape)) + 5) * 2} height="28" rx="6" style={{ fill: 'var(--mk-steel)' }} />
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
