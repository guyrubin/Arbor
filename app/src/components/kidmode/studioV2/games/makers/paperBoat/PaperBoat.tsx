import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidHush, kidSfx } from '../../../../audio/kidAudio';
import { usePrefersReducedMotion } from '../../../../../ui/playkit';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { PAPER_BOAT_COPY } from './paperBoatCopy';
import {
  BOAT_BANK, BOAT_STREAM, BOOK_PERSPECTIVE, BOOK_TILT, HARBOUR_LAMPS, PAGE_D, PAGE_W, RIVER_END, RIVER_GATES, SPREADS, SPREAD_W, STORM_BAND,
  bookScene, canFinish, canTurn, clamp01, clampWheel, createBook, dragFraction, harbourStep, keyIntent, lampsLit, laneForAngle, launchFromDrag, pageOrder,
  projectBookPoint, riverDone, riverStep, setWheel, spreadDone, stormCalm, stormStep, swipeIntent, wheelDetents,
  type BookState, type Dir, type SpreadIndex, type TurnIntent,
} from './paperBoatRules';
import { SpreadHalf, type Live } from './PaperBoatScenes';
import { PaperWheel } from './PaperBoatWheel';
import { createBoatAudio, type BoatAudio } from './paperBoatAudio';
import { PAPER_GRAIN } from './PaperBoatArt';
import '../makerPalette.css';
import './paperBoat.css';

/** The stage the book is drawn on (unscaled px): the open book, its pop-ups
 * standing up off the far edge, and the table around it. Scaled as a whole. */
const STAGE_W = 556, STAGE_H = 332, BOOK_CX = STAGE_W / 2, BOOK_CY = 204;
const TURN_MS = 950;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const line = (template: string, ...values: (string | number)[]) => template.replace(/\{(\d)\}/g, (_m, slot: string) => String(values[Number(slot)] ?? ''));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface TurnAnim { from: number; to: number; start: number; dur: number; settle: SpreadIndex }
interface PageDrag { id: number; intent: TurnIntent | null; x: number; y: number; moved: boolean; fraction: number; fromCorner: boolean }
interface BoatAnim { fx: number; fy: number; tx: number; ty: number; start: number; dur: number; launch: boolean }

export default function PaperBoat() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = PAPER_BOAT_COPY[lang], shared = ADVENTURE_COPY[lang];
  const dir: Dir = lang === 'he' ? 'rtl' : 'ltr', order = pageOrder(dir);
  const reduced = usePrefersReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, '');
  const [, setFrame] = useState(0);
  const redraw = () => setFrame(n => (n + 1) % 1_000_000);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('');
  const [scale, setScale] = useState(0.66);

  const book = useRef<BookState>(createBook());
  const position = useRef(0);
  const turn = useRef<TurnAnim | null>(null);
  const pageDrag = useRef<PageDrag | null>(null);
  const boat = useRef({ x: BOAT_BANK.x, y: BOAT_BANK.y, anim: null as BoatAnim | null, dragging: false });
  const held = useRef(false);
  const gust = useRef<number | null>(null);
  const arches = useRef<Record<string, number>>({});
  const waiting = useRef<string | null>(null);
  const waitingQuay = useRef(false);
  const dockAt = useRef<number | null>(null);
  const calmShown = useRef(0);
  const clock = useRef(0);
  const rumbleAt = useRef(0);
  const rainLevel = useRef(-1);
  const audio = useRef<BoatAudio | null>(null);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const bookEl = useRef<HTMLDivElement>(null);
  const live = useRef({ dir, reduced, w, scale });
  live.current = { dir, reduced, w, scale };

  const say = (text: string) => setStatus(text);
  const hint = (spread: SpreadIndex) => w.hints[spread][spreadDone(book.current, spread) ? 1 : 0];

  /* ── sound for each spread ─────────────────────────────────────────────── */
  const enter = (spread: SpreadIndex) => {
    rainLevel.current = -1;
    if (spread === 1) audio.current?.lap();
    if (spread === 2) rumbleAt.current = clock.current + 2.2;
    say(hint(spread));
  };
  /** A page change stops the hear-it voice and the old spread's sounds. */
  const leave = () => { kidHush(); audio.current?.stopAll(); rainLevel.current = -1; };

  /* ── turning ───────────────────────────────────────────────────────────── */
  const settle = (spread: SpreadIndex) => {
    position.current = spread;
    const changed = book.current.spread !== spread;
    book.current = { ...book.current, spread };
    if (changed && live.current.reduced) bookEl.current?.animate?.([{ opacity: 0.2 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    enter(spread);
  };
  const animateTo = (target: SpreadIndex) => {
    const from = position.current;
    if (live.current.reduced) { turn.current = null; settle(target); redraw(); return; }
    turn.current = { from, to: target, start: now(), dur: Math.max(220, TURN_MS * Math.abs(target - from)), settle: target };
  };
  const startTurn = (intent: TurnIntent) => {
    if (turn.current || pageDrag.current?.moved || !canTurn(book.current, intent)) return;
    leave(); audio.current?.swish();
    animateTo((book.current.spread + (intent === 'next' ? 1 : -1)) as SpreadIndex);
  };
  const finish = () => {
    if (!canFinish(book.current) || turn.current) return;
    leave(); kidSfx('correct'); setDone(true);
  };

  /** A finger on a page corner (or anywhere on the book, as a swipe) carries the leaf with it. */
  const pageDown = (event: ReactPointerEvent<HTMLElement>, intent: TurnIntent | null) => {
    if (turn.current || pageDrag.current || done) return;
    if (intent && !canTurn(book.current, intent)) return;
    const drag: PageDrag = { id: event.pointerId, intent, x: event.clientX, y: event.clientY, moved: false, fraction: 0, fromCorner: intent !== null };
    pageDrag.current = drag;
    const width = Math.max(160, (stage.current?.getBoundingClientRect().width ?? 360) * 0.62);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved) {
        if (Math.abs(dx) < 10) return;
        if (!drag.intent) {
          if (Math.abs(dy) > Math.abs(dx)) { stop(); return; }
          const wanted = swipeIntent(dx, live.current.dir, 10);
          if (!wanted || !canTurn(book.current, wanted)) { stop(); return; }
          drag.intent = wanted;
        }
        drag.moved = true; leave(); audio.current?.swish();
      }
      drag.fraction = dragFraction(dx, width, live.current.dir, drag.intent!);
      position.current = book.current.spread + (drag.intent === 'next' ? drag.fraction : -drag.fraction);
      redraw();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return;
      const { moved, intent: going, fraction, fromCorner } = drag;
      stop();
      if (!moved) { if (fromCorner && going) startTurn(going); return; }
      const target = (book.current.spread + (fraction > 0.3 ? (going === 'next' ? 1 : -1) : 0)) as SpreadIndex;
      if (target === book.current.spread) { if (live.current.reduced) { settle(target); redraw(); } else turn.current = { from: position.current, to: target, start: now(), dur: 320, settle: target }; return; }
      if (live.current.reduced) { settle(target); redraw(); return; }
      turn.current = { from: position.current, to: target, start: now(), dur: Math.max(240, TURN_MS * Math.abs(target - position.current)), settle: target };
    };
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (pageDrag.current === drag) pageDrag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  /* ── spread one: the boat on the bank ──────────────────────────────────── */
  const launch = (fromX: number, fromY: number) => {
    const b = boat.current;
    if (book.current.launched || b.anim?.launch) return;
    if (live.current.reduced) { b.x = BOAT_STREAM.x; b.y = BOAT_STREAM.y; book.current = { ...book.current, launched: true }; audio.current?.lap(); kidSfx('correct'); say(hint(0)); redraw(); return; }
    b.anim = { fx: fromX, fy: fromY, tx: BOAT_STREAM.x, ty: BOAT_STREAM.y, start: now(), dur: 700, launch: true };
  };
  const boatDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (book.current.launched || boat.current.anim || turn.current || book.current.spread !== 0) return;
    const b = boat.current, sx = event.clientX, sy = event.clientY, id = event.pointerId;
    const mirror = live.current.dir === 'rtl', s = live.current.scale, lean = Math.cos((BOOK_TILT * Math.PI) / 180);
    let moved = false, ox = 0, oy = 0;
    b.dragging = true;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = (e.clientX - sx) / s, dy = (e.clientY - sy) / s;
      if (Math.hypot(dx, dy) > 4) moved = true;
      ox = Math.max(-40, Math.min(80, (mirror ? -dx : dx))); oy = Math.max(-50, Math.min(20, dy / lean));
      b.x = BOAT_BANK.x + ox; b.y = BOAT_BANK.y + oy; redraw();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      b.dragging = false;
      // A tap, or a pull towards the water, launches the boat; a little nudge lets it drift back.
      if (!moved || launchFromDrag(ox, -oy)) { launch(b.x, b.y); return; }
      if (live.current.reduced) { b.x = BOAT_BANK.x; b.y = BOAT_BANK.y; redraw(); return; }
      b.anim = { fx: b.x, fy: b.y, tx: BOAT_BANK.x, ty: BOAT_BANK.y, start: now(), dur: 380, launch: false };
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  /* ── the wheel ─────────────────────────────────────────────────────────── */
  const turnWheel = (angle: number) => {
    const spread = book.current.spread;
    if (spread === 0 || turn.current) return;
    const before = book.current.wheel[spread], next = clampWheel(angle);
    if (wheelDetents(before, next) > 0) audio.current?.tick();
    gust.current = null;
    book.current = setWheel(book.current, spread, next);
    redraw();
  };

  /* ── one frame of the book ─────────────────────────────────────────────── */
  const step = (t: number, dt: number) => {
    const { dir: d, reduced: still, w: words } = live.current;
    clock.current += dt;
    let dirty = false;
    const tr = turn.current;
    if (tr) {
      const k = clamp01((t - tr.start) / tr.dur);
      position.current = tr.from + (tr.to - tr.from) * ease(k); dirty = true;
      if (k >= 1) { turn.current = null; settle(tr.settle); }
    }
    if (turn.current || pageDrag.current?.moved || !bookScene(position.current).settled) return dirty;
    const b = book.current;
    if (b.spread === 0) {
      const anim = boat.current.anim;
      if (anim) {
        const k = clamp01((t - anim.start) / anim.dur), e = ease(k);
        boat.current.x = anim.fx + (anim.tx - anim.fx) * e; boat.current.y = anim.fy + (anim.ty - anim.fy) * e - (anim.launch ? Math.sin(Math.PI * k) * 14 : 0);
        if (k >= 1) {
          boat.current.anim = null;
          if (anim.launch) { book.current = { ...b, launched: true }; audio.current?.lap(); kidSfx('correct'); say(hint(0)); }
        }
        return true;
      }
      return !still && (b.launched || settledHint());
    }
    if (b.spread === 1) {
      if (riverDone(b.river) && b.river.d >= RIVER_END) { waiting.current = null; return !still; }
      const result = riverStep(b.river, dt, laneForAngle(b.wheel[1], d));
      book.current = { ...b, river: result.river };
      waiting.current = result.events.includes('held') ? RIVER_GATES[result.river.gates]?.id ?? null : null;
      if (result.events.includes('bump')) { audio.current?.bump(); say(words.nudge); }
      if (result.events.includes('gate')) {
        const passed = RIVER_GATES[result.river.gates - 1];
        if (passed) arches.current = { ...arches.current, [passed.id]: clock.current };
        audio.current?.chime(result.river.gates - 1);
        if (riverDone(result.river)) { kidSfx('correct'); say(words.hints[1][1]); } else say(words.arch);
      }
      return true;
    }
    if (b.spread === 2) {
      let wheel = b.wheel[2];
      if (gust.current !== null) {
        const target = gust.current;
        wheel = still ? target : wheel + (target - wheel) * Math.min(1, dt * 5);
        if (Math.abs(target - wheel) < 0.5) { wheel = target; gust.current = null; }
      }
      const wasCalm = b.storm.calmed;
      const result = stormStep(b.storm, dt, wheel, held.current);
      book.current = { ...setWheel(b, 2, wheel), storm: result.storm };
      if (result.gust) audio.current?.gust();
      if (result.push) gust.current = clampWheel(wheel + result.push);
      const calm = stormCalm(result.storm);
      calmShown.current = still ? calm : calmShown.current + (calm - calmShown.current) * Math.min(1, dt * 1.6);
      if (!wasCalm && result.storm.calmed) { audio.current?.rain(0); kidSfx('correct'); say(words.calm); }
      const rain = result.storm.calmed ? 0 : 1 - calmShown.current * 0.8;
      if (Math.abs(rain - rainLevel.current) > 0.05) { rainLevel.current = rain; audio.current?.rain(rain); }
      if (!result.storm.calmed && calm < 0.6 && clock.current >= rumbleAt.current) { audio.current?.rumble(); rumbleAt.current = clock.current + 7.5; }
      return true;
    }
    // the harbour
    if (!b.harbour.docked) {
      const result = harbourStep(b.harbour, dt, laneForAngle(b.wheel[3], d));
      book.current = { ...b, harbour: result.harbour };
      waitingQuay.current = result.held;
      if (result.docked) { dockAt.current = clock.current; waitingQuay.current = false; audio.current?.bell(); say(words.docked); }
      return true;
    }
    if (b.harbour.lamps < HARBOUR_LAMPS) {
      const lit = dockAt.current === null ? HARBOUR_LAMPS : lampsLit((clock.current - dockAt.current) * 1000);
      if (lit > b.harbour.lamps) {
        for (let i = b.harbour.lamps; i < lit; i++) audio.current?.lamp(i);
        book.current = { ...b, harbour: { ...b.harbour, lamps: lit } };
        if (lit >= HARBOUR_LAMPS) { audio.current?.bell(); say(words.hints[3][1]); }
      }
      return true;
    }
    return !still;
  };
  const stepRef = useRef(step); stepRef.current = step;
  function settledHint() { return !book.current.launched && !boat.current.dragging; }

  useEffect(() => {
    const instance = createBoatAudio(); audio.current = instance;
    let raf = 0, last = now();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (stepRef.current(t, dt)) redraw();
    };
    raf = requestAnimationFrame(loop);
    const visibility = () => { if (document.hidden) { instance.stopAll(); rainLevel.current = -1; } };
    document.addEventListener('visibilitychange', visibility);
    say(w.hints[0][0]);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', visibility); instance.dispose(); audio.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── the book scales to the room it is given ───────────────────────────── */
  useLayoutEffect(() => {
    const node = section.current; if (!node) return;
    const fit = () => {
      const width = node.clientWidth - 8;
      // Everything but the book (label, wheel, padding) keeps its size; the book takes the rest of the screen.
      const top = node.getBoundingClientRect().top + (window.scrollY || 0);
      const rest = node.scrollHeight - (stage.current?.offsetHeight ?? 0);
      const room = window.innerHeight - top - rest - 12;
      setScale(Math.max(0.45, Math.min(1.45, width / STAGE_W, Math.max(300, room) / STAGE_H)));
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(node); window.addEventListener('resize', fit);
    return () => { observer?.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest?.('[data-pb-wheel]')) return;
    const intent = keyIntent(event.key, dir);
    if (!intent) return;
    event.preventDefault();
    startTurn(intent);
  };
  const reset = () => {
    leave(); turn.current = null; pageDrag.current = null;
    book.current = createBook(); position.current = 0; boat.current = { x: BOAT_BANK.x, y: BOAT_BANK.y, anim: null, dragging: false };
    arches.current = {}; waiting.current = null; waitingQuay.current = false; dockAt.current = null; calmShown.current = 0; gust.current = null; held.current = false;
    setDone(false); say(w.hints[0][0]);
  };

  /* ── render ────────────────────────────────────────────────────────────── */
  const b = book.current, scene = bookScene(position.current), settled = scene.settled && !turn.current && !pageDrag.current?.moved;
  const spread = b.spread, shownSpread = (settled ? spread : Math.round(position.current)) as SpreadIndex;
  const text = w.spreads[spread];
  const harbour = b.harbour;
  const liveScene: Live = {
    time: clock.current, reduced, mirror: order.mirror,
    boat0: { x: b.launched ? BOAT_STREAM.x : boat.current.x, y: b.launched ? BOAT_STREAM.y : boat.current.y, afloat: b.launched || !!boat.current.anim?.launch, hint: !b.launched && !boat.current.anim && !boat.current.dragging && settled && spread === 0 },
    boatControl: !b.launched && spread === 0 && settled ? { label: w.boatLaunch, onPointerDown: boatDown, onClick: event => { if (event.detail === 0) launch(boat.current.x, boat.current.y); } } : null,
    river: b.river, steer1: laneForAngle(b.wheel[1], dir), arches: arches.current, waiting: settled ? waiting.current : null,
    calm: calmShown.current, wheel2: b.wheel[2],
    harbour, steer3: laneForAngle(b.wheel[3], dir), rope: !harbour.docked ? 0 : dockAt.current === null || reduced ? 1 : clamp01((clock.current - dockAt.current - 0.2) / 0.45), waitingQuay: settled && waitingQuay.current,
  };
  const wheelSpread = shownSpread;
  const wheelAngle = b.wheel[wheelSpread];
  const steady = wheelSpread === 2 && Math.abs(wheelAngle) <= STORM_BAND;
  const valueText = wheelSpread === 2 ? (b.storm.calmed || steady ? w.steady : w.windy) : w.lanes[laneForAngle(wheelAngle, dir)];
  const project = (x: number) => { const p = projectBookPoint(x, PAGE_D, order.mirror); return { left: (BOOK_CX + p.x) * scale, top: (BOOK_CY + p.y) * scale }; };
  const nextAt = project(SPREAD_W), backAt = project(0);
  const showNext = settled && canTurn(b, 'next');
  const showBack = settled && canTurn(b, 'back');
  const showEnd = settled && canFinish(b);
  const Forward = dir === 'rtl' ? ArrowLeft : ArrowRight, Backward = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const corner = (at: { left: number; top: number }, side: 'next' | 'back') => {
    // The corner tab sits on the page's outer front corner, tucked inside the book.
    const inward = (side === 'next') === (order.nextCorner === 'right') ? -1 : 1;
    return { left: at.left + inward * 34 - 30, top: at.top + 2 };
  };
  const leafShade = scene.settled ? 0 : Math.sin(Math.PI * scene.fraction);

  return <GameShell fullBleed autoNarrate={false} worldId="paper-boat" title={w.title} instruction={w.instruction} hearIt={`${text[0]} ${text[1]}`}>
    {done
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section ref={section} className="pb" data-adventure="paper-boat" data-spread={spread} data-settled={settled} data-pb-arches={b.river.gates} data-pb-calm={b.storm.calmed} data-pb-docked={b.harbour.docked} data-pb-launched={b.launched} dir={dir} onKeyDown={keyDown} aria-label={w.book} style={{ ['--pb-grain' as string]: PAPER_GRAIN }}>
        <div className="pb-label" key={spread} data-pb-label="">
          <span className="pb-label__pin" aria-hidden="true" />
          <p lang={lang}><span>{text[0]}</span><span>{text[1]}</span></p>
          <span className="pb-label__pages" aria-label={line(w.page, spread + 1, SPREADS)}>{Array.from({ length: SPREADS }, (_, i) => <i key={i} data-on={i === spread} />)}</span>
        </div>
        <div ref={stage} className="pb-stage" data-pb-stage="" style={{ blockSize: STAGE_H * scale }} onPointerDown={event => pageDown(event, null)}>
          <div className="pb-scaler" dir="ltr" style={{ inlineSize: STAGE_W, blockSize: STAGE_H, transform: `translateX(-50%) scale(${scale})` }}>
            <span className="pb-table" aria-hidden="true" />
            <div className="pb-persp" style={{ left: BOOK_CX - SPREAD_W / 2, top: BOOK_CY - PAGE_D / 2, width: SPREAD_W, height: PAGE_D, perspective: BOOK_PERSPECTIVE }}>
              <div ref={bookEl} className="pb-book" data-mirror={order.mirror} data-pb-position={position.current.toFixed(3)} style={{ width: SPREAD_W, height: PAGE_D, transform: `rotateX(${BOOK_TILT}deg)${order.mirror ? ' scaleX(-1)' : ''}` }}>
                <span className="pb-board" aria-hidden="true" />
                <span className="pb-block pb-block--front" aria-hidden="true" />
                <div className="pb-page pb-page--left">
                  <SpreadHalf spread={scene.staticLeft} side="left" progress={scene.progress[scene.staticLeft]} live={liveScene} uid={uid} />
                  <span className="pb-page__shade" style={{ opacity: scene.settled ? 0 : 0.32 * clamp01(scene.fraction * 2 - 1) }} />
                </div>
                <div className="pb-page pb-page--right">
                  <SpreadHalf spread={scene.staticRight} side="right" progress={scene.progress[scene.staticRight]} live={liveScene} uid={uid} />
                  <span className="pb-page__shade" style={{ opacity: 0.36 * leafShade * (1 - scene.fraction) }} />
                </div>
                {!scene.settled && scene.leafFront !== null && scene.leafBack !== null && <div className="pb-leaf" style={{ width: PAGE_W, height: PAGE_D, transform: `translateZ(1.6px) rotateY(${scene.leafAngle}deg)` }}>
                  <div className="pb-face pb-face--front" style={{ visibility: scene.fraction < 0.5 ? 'visible' : 'hidden' }}>
                    <SpreadHalf spread={scene.leafFront} side="right" progress={scene.progress[scene.leafFront]} live={liveScene} uid={`${uid}l`} />
                    <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * scene.fraction * 2 }} />
                  </div>
                  <div className="pb-face pb-face--back" style={{ visibility: scene.fraction >= 0.5 ? 'visible' : 'hidden' }}>
                    <SpreadHalf spread={scene.leafBack} side="left" progress={scene.progress[scene.leafBack]} live={liveScene} uid={`${uid}l`} />
                    <span className="pb-page__shade pb-page__shade--leaf" style={{ opacity: 0.3 * (1 - scene.fraction) * 2 }} />
                  </div>
                </div>}
              </div>
            </div>
          </div>
          <div className="pb-overlay" style={{ inlineSize: STAGE_W * scale }}>
          {showBack && <button type="button" className="pb-corner pb-corner--back" data-pb-turn="back" style={corner(backAt, 'back')} aria-label={w.back} onPointerDown={event => { event.stopPropagation(); pageDown(event, 'back'); }} onClick={event => { if (event.detail === 0) startTurn('back'); }}><Backward size={24} aria-hidden="true" /></button>}
          {showNext && <button type="button" className="pb-corner pb-corner--next" data-pb-turn="next" style={corner(nextAt, 'next')} aria-label={w.next} onPointerDown={event => { event.stopPropagation(); pageDown(event, 'next'); }} onClick={event => { if (event.detail === 0) startTurn('next'); }}><Forward size={26} aria-hidden="true" /></button>}
          {showEnd && <button type="button" className="pb-corner pb-corner--end" data-pb-turn="end" style={{ ...corner(nextAt, 'next'), ...(order.nextCorner === 'right' ? { translate: '-84px 0' } : {}) }} onPointerDown={event => event.stopPropagation()} onClick={finish}><BookOpen size={22} aria-hidden="true" /><span>{w.end}</span></button>}
          </div>
        </div>
        <div className="pb-controls" data-spread={wheelSpread}>
          <PaperWheel angle={wheelAngle} enabled={settled && spread > 0 && !(spread === 3 && harbour.docked)} tucked={wheelSpread === 0 || (wheelSpread === 3 && harbour.docked)} marks={wheelSpread === 2 ? 'storm' : 'lanes'} steady={steady || (wheelSpread === 2 && b.storm.calmed)} label={w.wheel} valueText={valueText} leftLabel={w.steerLeft} rightLabel={w.steerRight} onTurn={turnWheel} onHold={value => { held.current = value; if (value) gust.current = null; }} />
        </div>
        <p className="pb-sr" role="status" aria-live="polite">{status}</p>
      </section>}
  </GameShell>;
}
