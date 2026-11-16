import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Pause, Play, Rewind, SkipBack, Sparkles, StepBack, StepForward } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { stageFor } from '../../../../../../lib/age/forChild';
import { selectionHaptic } from '../../../../../../lib/native';
import { usePrefersReducedMotion } from '../../../../../ui/playkit';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { onKidHush, useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { CLAY_THEATRE_COPY } from './clayTheatreCopy';
import {
  CUES, FPS, PORTHOLE_SLOTS, FRESH_HANDS, REELS, allWatched, captionAt, chooseReel, clayLine, cuesPassed, frameAt, lastFrame, momentOf, pause, play, reelsFor, rocketFilm,
  seekFrame, setDirection, setPorthole, showFor, startTransport, stepFrame, stepHop, tick, toStart, timeOf, type Hands, type ReelId, type Transport,
} from './clayTheatreRules';
import {
  CALL_SECONDS, FRIENDS, PORTHOLE_FROM, addTouch, allStarsSwinging, curtainCall, friendMoods, heroPlace, liftTouch, liveTouches, pressInto, pruneTouches, toyAt, toySpots,
  type FriendId, type LiveTouch, type Touch, type ToyKind, type ToySpot,
} from './clayHands';
import { placePoint } from './clayShapes';
import { CLAYS, CLAY_IDS, chalky, type ClayId } from './clayInk';
import { createClayAudio, type ClayAudio } from './clayAudio';
import { createClayTicker, type ClayTicker } from './clayTicker';
import { ClayScene, CurtainCallScene } from './ClayScene';
import { FilmStrip, GhostHand } from './FilmStrip';
import { KIT_AUDIENCE, KIT_PADS, KIT_POSTERS, KIT_PROOFLENS, KIT_ROOM, kitPad } from './clayKit';
import '../makerPalette.css';
import './clayTheatre.css';

type Clay = { body: ClayId; trim: ClayId };
type Phase = 'film' | 'call' | 'done';
type Hint = 'press' | 'drag' | null;
/** The frame each reel shows in the little window on its pad. */
const PAD_FRAME: Readonly<Record<ReelId, number>> = { rocket: 50, jump: 46, ayaSeed: 92, frog: 22 };
/** The clay a show opens with (body, trim), as places in the row of lumps: a different pair each replay. */
const OPENING_CLAY: readonly (readonly [number, number])[] = [[4, 2], [0, 2], [3, 1], [5, 2], [1, 4]];
/** This sitting only (never stored): which show this is, and which first gestures the child has already made. */
const sitting = { shows: 0, pressed: false, dragged: false };
/** The first frame of the call on which the curtain is fully drawn: the film is swapped for the cast behind it. */
const CALL_CLOSED = 6;
const HINT_FIRST = 1400, HINT_SHOWS = 2600, HINT_EVERY = 6000;
/** The toys a keyboard or a screen reader can reach by name. */
const NAMED: readonly ToyKind[] = ['clayHero', 'wireStar', 'nightMoon', 'daySun', 'padLeaf', 'puffCloud', 'lotusBloom', 'gardenBloom'];

export default function ClayTheatre() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en', rtl = lang === 'he';
  const w = CLAY_THEATRE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const reduced = usePrefersReducedMotion();
  const offered = useMemo(() => reelsFor(stageFor(child)), [child]);
  const [round] = useState(() => sitting.shows++);
  const show = useMemo(() => showFor(round), [round]);
  const [view, setView] = useState<Transport>(() => startTransport('rocket'));
  const [clay, setClay] = useState<Clay>(() => { const [b, t] = OPENING_CLAY[round % OPENING_CLAY.length]; return { body: CLAY_IDS[b], trim: CLAY_IDS[t] }; });
  const [picking, setPicking] = useState(true);
  const [phase, setPhase] = useState<Phase>('film');
  const [hands, setHandsState] = useState<Hands>(FRESH_HANDS);
  const [hand, setHand] = useState<{ frame: number; touches: readonly Touch[] }>({ frame: 0, touches: [] });
  const [marks, setMarks] = useState<readonly { key: number; x: number; y: number }[]>([]);
  const [callFrame, setCallFrame] = useState(0);
  const [hint, setHint] = useState<Hint>(null);
  const live = useRef(view), handsRef = useRef(hands), reducedRef = useRef(reduced);
  const audio = useRef<ClayAudio | null>(null);
  const [ticker] = useState<ClayTicker>(createClayTicker);
  const clock = useRef({ seconds: 0, frame: 0, touches: [] as readonly Touch[], riding: null as (() => void) | null });
  const keys = useRef(0), holds = useRef(new Map<number, number>()), timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const idleAt = useRef(0), mounted = useRef(true);
  reducedRef.current = reduced;

  const later = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => { timers.current.delete(id); if (mounted.current) fn(); }, ms);
    timers.current.add(id); return id;
  }, []);
  const setHands = useCallback((next: Hands) => { handsRef.current = next; setHandsState(next); }, []);
  /** Every change goes through here; React only re-renders when the frame on
   * screen (or a control) actually changes, so play renders at 12 fps. */
  const commit = useCallback((next: Transport) => {
    const prev = live.current; live.current = next;
    if (frameAt(prev.t) !== frameAt(next.t) || prev.playing !== next.playing || prev.reel !== next.reel || prev.backwards !== next.backwards || prev.watched !== next.watched) setView(next);
  }, []);
  /** A move the child makes with the strip or the step buttons: silent except one soft tick per new frame. */
  const scrubTo = useCallback((next: Transport) => {
    const before = frameAt(live.current.t);
    commit(next);
    if (frameAt(next.t) !== before) audio.current?.tick(frameAt(next.t) % FPS === 0);
  }, [commit]);
  const halt = useCallback(() => commit(pause(live.current)), [commit]);

  useEffect(() => {
    mounted.current = true; idleAt.current = performance.now();
    const instance = createClayAudio(); audio.current = instance;
    const unhush = onKidHush(() => commit(pause(live.current)));
    const hidden = () => { if (document.visibilityState === 'hidden') commit(pause(live.current)); };
    document.addEventListener('visibilitychange', hidden);
    const pending = timers.current, hands0 = clock.current;
    return () => {
      mounted.current = false; unhush(); document.removeEventListener('visibilitychange', hidden);
      for (const id of pending) clearTimeout(id); pending.clear();
      hands0.riding = null; ticker.dispose(); instance.dispose(); audio.current = null;
    };
  }, [commit, ticker]);
  // The projector purrs only while the film runs and sound is on.
  useEffect(() => { audio.current?.purr(view.playing && !muted && phase === 'film'); }, [view.playing, muted, phase]);
  // Playback rides the one frame loop; cues sound when their time is crossed.
  useEffect(() => {
    if (!view.playing || phase !== 'film') return;
    return ticker.add(dt => {
      const prev = live.current, next = tick(prev, dt);
      for (const cue of cuesPassed(CUES[prev.reel], prev.t, next.t, prev.playing)) audio.current?.cue(cue);
      commit(next);
      return next.playing;
    });
  }, [view.playing, view.reel, phase, commit, ticker]);

  /* ── the hands' clock: touches and what they are doing now ─────────────── */
  const showTouches = useCallback(() => { const c = clock.current; setHand({ frame: c.frame, touches: c.touches }); }, []);
  const ride = useCallback(() => {
    const c = clock.current;
    if (c.riding) return;
    c.riding = ticker.add(dt => {
      c.seconds += dt;
      const f = Math.floor(c.seconds * FPS);
      if (f !== c.frame) { c.frame = f; c.touches = pruneTouches(c.touches, f); showTouches(); }
      if (c.touches.length === 0) { c.riding = null; return false; }
      return true;
    });
  }, [showTouches, ticker]);
  const touch = useCallback((toy: ToyKind, index: number, x: number, y: number, dir: 1 | -1, hold: boolean) => {
    const c = clock.current, key = ++keys.current;
    c.touches = addTouch(c.touches, { key, toy, index, x, y, dir, born: c.frame, lifted: hold && !reducedRef.current ? null : c.frame });
    showTouches();
    // With motion reduced the answer is a cut: shown at once, cleared a moment later, nothing animated between.
    if (reducedRef.current) later(() => { c.touches = c.touches.filter(t => t.key !== key); showTouches(); }, 520); else ride();
    return key;
  }, [later, ride, showTouches]);
  const lift = useCallback((key: number) => { const c = clock.current; c.touches = liftTouch(c.touches, key, c.frame); showTouches(); }, [showTouches]);
  const mark = useCallback((x: number, y: number) => {
    const key = ++keys.current;
    setMarks(list => [...list.slice(-3), { key, x, y }]);
    later(() => setMarks(list => list.filter(m => m.key !== key)), 460);
  }, [later]);
  const noteInput = useCallback(() => { idleAt.current = performance.now(); setHint(null); }, []);

  /** A hand lands on the stage at (x, y) in stage units. Every touch answers: a mark, a sound, a haptic, and the thing itself. */
  const poke = useCallback((x: number, y: number, pointerId?: number) => {
    const s = live.current, t = timeOf(frameAt(s.t, s.reel)), spot = toyAt(s.reel, t, x, y, handsRef.current, show);
    void selectionHaptic(); audio.current?.toy(spot.toy, spot.index); mark(x, y);
    if (spot.toy === 'clayHero') { sitting.pressed = true; setHands(pressInto(handsRef.current, s.reel, t, x, y)); }
    const dir: 1 | -1 = spot.toy === 'wireStar' ? (x < spot.x ? -1 : 1) : Math.round(x) % 2 ? 1 : -1;
    const key = touch(spot.toy, spot.index, x, y, dir, spot.toy === 'clayHero' && pointerId !== undefined);
    if (pointerId !== undefined && spot.toy === 'clayHero') holds.current.set(pointerId, key);
    if (spot.toy === 'wireStar' && allStarsSwinging(clock.current.touches, clock.current.frame)) { touch('cometWish', 0, 0, 0, 1, false); audio.current?.toy('cometWish'); }
  }, [mark, setHands, show, touch]);
  const finish = useCallback(() => { audio.current?.stop(); setPhase('done'); }, []);
  const stageDown = (e: PointerEvent<HTMLDivElement>) => {
    if (phase === 'call') { finish(); return; }
    if (e.target instanceof Element && e.target.closest('button')) return;
    const box = e.currentTarget.getBoundingClientRect(); if (box.width <= 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    poke(((e.clientX - box.left) / box.width) * 400, ((e.clientY - box.top) / box.height) * 300, e.pointerId);
  };
  const stageUp = (e: PointerEvent<HTMLDivElement>) => { const key = holds.current.get(e.pointerId); if (key !== undefined) { holds.current.delete(e.pointerId); lift(key); } };
  const pat = (index: number) => { void selectionHaptic(); audio.current?.toy('kitFriend', index); touch('kitFriend', index, 0, 0, 1, false); };
  const nudge = (toy: 'proofLens' | 'wallPoster', index: number) => { void selectionHaptic(); audio.current?.toy(toy, index); touch(toy, index, 0, 0, index % 2 ? -1 : 1, false); };

  /* ── the projectionist's controls ──────────────────────────────────────── */
  const roll = (reel: ReelId) => { void selectionHaptic(); audio.current?.reel(REELS.indexOf(reel)); const next = chooseReel(live.current, reel); commit(reduced ? next : play(next)); };
  const pick = (reel: ReelId) => { setPicking(false); roll(reel); };
  const toggle = () => { void selectionHaptic(); commit(live.current.playing ? pause(live.current) : play(live.current)); };
  const again = () => { audio.current?.stop(); const fresh = startTransport('rocket'); live.current = fresh; setView(fresh); setPicking(true); setPhase('film'); setHands(FRESH_HANDS); };
  const choose = (part: 'body' | 'trim', id: ClayId) => { void selectionHaptic(); audio.current?.lump(CLAY_IDS.indexOf(id)); setClay(c => ({ ...c, [part]: id })); touch('clayHero', 0, 200, 170, 1, false); };
  const moveWindow = (slot: number) => { void selectionHaptic(); audio.current?.toy('clayHero'); setHands(setPorthole(handsRef.current, slot)); const h = heroPlace('rocket', timeOf(frameAt(live.current.t, 'rocket')), handsRef.current); touch('clayHero', 0, h.cx, h.cy, 1, false); };

  // A reel watched to its end for the first time: the audience is glad, three notes rise.
  const seen = view.watched.length, seenBefore = useRef(0);
  useEffect(() => {
    if (seen > seenBefore.current) { audio.current?.reelDone(); touch('reelDone', 0, 0, 0, 1, false); void selectionHaptic(); }
    seenBefore.current = seen;
  }, [seen, touch]);

  /* ── the curtain call ──────────────────────────────────────────────────── */
  const curtain = () => {
    void selectionHaptic(); halt(); audio.current?.stop(); audio.current?.curtainCall();
    setCallFrame(reduced ? Math.round(CALL_SECONDS * FPS) : 0); setPhase('call');
  };
  useEffect(() => {
    if (phase !== 'call') return;
    // The call is over when its time is up; a timer says so, never an animation's end.
    const done = later(finish, reduced ? 1750 : CALL_SECONDS * 1000 + 1500);
    const hidden = () => { if (document.visibilityState === 'hidden') finish(); };
    document.addEventListener('visibilitychange', hidden);
    let c = 0;
    const off = reduced ? undefined : ticker.add(dt => { c += dt; setCallFrame(Math.min(Math.round(CALL_SECONDS * FPS), Math.floor(c * FPS))); if (c >= CALL_SECONDS + 0.12) { finish(); return false; } return true; });
    return () => { clearTimeout(done); timers.current.delete(done); document.removeEventListener('visibilitychange', hidden); off?.(); };
  }, [phase, reduced, later, finish, ticker]);

  /* ── the first gestures, shown by a ghost hand until the child has made them ── */
  useEffect(() => {
    if (phase !== 'film') { setHint(null); return; }
    const id = setInterval(() => {
      const want: Hint = live.current.playing ? null : picking ? (sitting.pressed ? null : 'press') : !sitting.dragged ? 'drag' : !sitting.pressed ? 'press' : null;
      const idle = performance.now() - idleAt.current - HINT_FIRST;
      setHint(want && idle >= 0 && idle % (HINT_SHOWS + HINT_EVERY) < HINT_SHOWS ? want : null);
    }, 200);
    return () => clearInterval(id);
  }, [picking, phase]);
  // The ghost hand really presses the clay (silently, leaving no print), so the child sees what a press does.
  useEffect(() => {
    if (hint !== 'press' || reduced) return;
    let key = 0;
    const press = later(() => { const s = live.current, h = heroPlace(s.reel, timeOf(frameAt(s.t, s.reel)), handsRef.current); key = touch('clayHero', 0, h.cx + 6, h.cy - 4, 1, true); }, 700);
    const letGo = later(() => { if (key) lift(key); }, 1500);
    return () => { clearTimeout(press); clearTimeout(letGo); timers.current.delete(press); timers.current.delete(letGo); if (key) lift(key); };
  }, [hint, reduced, later, touch, lift]);

  const reel = view.reel, frame = frameAt(view.t, reel), t = timeOf(frame), end = lastFrame(reel);
  const moment = momentOf(reel, t);
  const valueText = moment.kind === 'moment' ? clayLine(w.moment, moment.index, moment.total) : moment.kind === 'hop' ? clayLine(w.hop, moment.index, moment.total) : moment.kind === 'start' ? w.atStart : w.reaching;
  const caption = phase === 'call' ? w.finish : picking ? w.pick : view.backwards && view.playing ? w.backwardsNote : w.captions[captionAt(reel, t)];
  const ready = !picking && phase === 'film' && allWatched(view, offered);
  const frog = reel === 'frog';
  const touches: readonly LiveTouch[] = useMemo(() => liveTouches(hand.touches, hand.frame), [hand]);
  const look = useMemo(() => ({ body: clay.body, trim: clay.trim, hands, show }), [clay, hands, show]);
  const moods = friendMoods(reel, t, touches);
  const spots = phase === 'film' ? toySpots(reel, t, hands, show).filter(s => NAMED.includes(s.toy)) : [];
  const hero = spots.find(s => s.toy === 'clayHero');
  // Paused on the finished rocket, the other places its porthole could go are ringed.
  const rocketStill = phase === 'film' && reel === 'rocket' && !view.playing && !picking && t < 6.2 && rocketFilm(t, hands).morph >= Math.max(PORTHOLE_FROM, 1.9);
  const slots = rocketStill ? PORTHOLE_SLOTS.map((x, slot) => ({ slot, at: (() => { const h = heroPlace('rocket', t, hands); return placePoint([x, 0], h.cx, h.cy, h.rot, h.sx, h.sy); })() })).filter(s => s.slot !== hands.porthole) : [];
  const pct = (x: number, y: number): CSSProperties => ({ left: `${x / 4}%`, top: `${y / 3}%` });
  const lensOn = touches.some(l => l.toy === 'proofLens');

  return <GameShell fullBleed autoNarrate={false} worldId="clay-theatre" title={w.title} instruction={w.instruction} hearIt={caption}>
    <section className="ct" data-adventure="clay-theatre" data-reel={reel} data-picking={picking} data-playing={view.playing} data-frame={frame} data-phase={phase} data-ready={ready} dir={rtl ? 'rtl' : 'ltr'}
      onPointerDownCapture={noteInput} onKeyDownCapture={noteInput}>
      {phase === 'done' ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={again} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        {/* The room: the Mirror Quarter's glass rotunda, the toy theatre on its round stage, the audience in front. */}
        <div className="ct-room" data-room="" role="group" aria-label={w.room}>
          <img className="ct-room__back" src={KIT_ROOM.src480} srcSet={`${KIT_ROOM.src480} 480w, ${KIT_ROOM.src} ${KIT_ROOM.width}w`} sizes="(min-width: 900px) 760px, 100vw" alt="" draggable={false} decoding="async" />
          {KIT_POSTERS.map((poster, i) => <button type="button" key={poster.src} className="ct-poster" data-poster={i} data-swing={touches.some(l => l.toy === 'wallPoster' && l.index === i)} aria-label={w.posters[i]} onClick={() => nudge('wallPoster', i)}>
            <img src={poster.src480} alt="" draggable={false} decoding="async" />
          </button>)}
          <div className="ct-theatre">
            <div className="ct-box">
              <div className="ct-stage" data-stage="" data-call={phase === 'call'} onPointerDown={stageDown} onPointerUp={stageUp} onPointerCancel={stageUp}>
                {phase === 'call' && callFrame >= CALL_CLOSED
                  ? <CurtainCallScene frame={callFrame} body={clay.body} trim={clay.trim} hands={hands} frogToo={offered.includes('frog')} label={w.callStage} />
                  : <ClayScene reel={reel} frame={frame} body={clay.body} trim={clay.trim} hands={hands} show={show} touches={touches} drapes={phase === 'call' ? curtainCall(timeOf(callFrame)).drapes : 0} label={`${w.stage}: ${w.reels[reel]}, ${valueText}`} />}
                <span className="ct-grain" aria-hidden="true" />
                {/* The toys by name, for a keyboard or a screen reader; a finger goes straight to the stage under them. */}
                {spots.map(s => <button type="button" key={`${s.toy}${s.index}`} className="ct-toy" data-toy={s.toy} tabIndex={s.toy === 'clayHero' ? 0 : -1} aria-label={w.toys[s.toy as keyof typeof w.toys]}
                  style={{ ...pct(s.x, s.y), inlineSize: `${s.rx / 2}%`, blockSize: `${(s.ry * 2) / 3}%` }} onClick={() => poke(s.x, s.y)} />)}
                {slots.map(s => <button type="button" key={s.slot} className="ct-slot" data-porthole-slot={s.slot} aria-label={w.toys.porthole} style={pct(s.at[0], s.at[1])} tabIndex={-1} onClick={() => moveWindow(s.slot)} />)}
                {marks.map(m => <span key={m.key} className="ct-mark" style={pct(m.x, m.y)} aria-hidden="true" />)}
                {hint === 'press' && hero && <span className="ct-ghost ct-ghost--press" style={pct(hero.x + 6, hero.y - 4)} aria-hidden="true"><GhostHand /></span>}
                {view.backwards && !picking && phase === 'film' && <span className="ct-badge" data-backwards=""><Rewind size={15} aria-hidden="true" className="ct-flip" />{w.backwards}</span>}
                {phase === 'call' && <button type="button" className="ct-skip" aria-label={w.skipCall} onClick={finish} />}
              </div>
              <span className="ct-pips" aria-hidden="true">{offered.map(id => <i key={id} data-on={view.watched.includes(id)} />)}</span>
            </div>
            <button type="button" className="ct-lens" data-lens="" data-on={lensOn} aria-label={w.lens} onClick={() => nudge('proofLens', 0)}>
              <img src={KIT_PROOFLENS.src480} alt="" draggable={false} decoding="async" /><i aria-hidden="true" />
            </button>
            <div className="ct-plinth">
              <FilmStrip reel={reel} frame={frame} end={end} rtl={rtl} playing={view.playing} reduced={reduced} label={w.strip} valueText={valueText} look={look} ticker={ticker} hint={hint === 'drag'}
                onGrab={() => { sitting.dragged = true; if (picking) setPicking(false); halt(); }} onSeek={next => scrubTo(seekFrame(live.current, next))} onBeat={() => undefined} />
            </div>
          </div>
          <div className="ct-audience">
            {FRIENDS.map((id, i) => <Friend key={id} id={id} mood={phase === 'call' && callFrame > 13 ? 'glad' : moods[id]} label={clayLine(w.friendWatching, w.friends[id])} onPat={() => pat(i)} />)}
          </div>
        </div>
        <p className="ct-caption" aria-live="polite">{caption}</p>
        <div className="ct-desk" data-idle={phase !== 'film'}>
          <div className="ct-cans" role="group" aria-label={w.cans} data-hidden={picking}>
            {offered.map(id => {
              const watched = view.watched.includes(id);
              return <button type="button" key={id} className="ct-can" data-reel-can={id} data-watched={watched} aria-pressed={id === reel && !picking} aria-label={clayLine(watched ? w.canWatched : w.canNew, w.reels[id])} disabled={phase !== 'film'} onClick={() => pick(id)}>
                <span className="ct-can__pad" aria-hidden="true">
                  <img src={kitPad(KIT_PADS[id])} alt="" draggable={false} decoding="async" />
                  <span className="ct-can__window"><PadFrame reel={id} body={clay.body} trim={clay.trim} hands={hands} /></span>
                  {watched && <span className="ct-can__done" data-can-star={id} />}
                </span>
                <span className="ct-can__name">{w.reels[id]}</span>
              </button>;
            })}
            <button type="button" className="ct-can ct-can--clay" data-control="clay" aria-pressed={picking} aria-label={w.recolour} disabled={phase !== 'film'} onClick={() => { void selectionHaptic(); if (picking) { setPicking(false); return; } commit(toStart(chooseReel(live.current, 'rocket'))); setPicking(true); }}>
              <span className="ct-can__pad" aria-hidden="true"><img src={kitPad(KIT_PADS.clay)} alt="" draggable={false} decoding="async" /><span className="ct-can__lumps"><Lump colour={CLAYS[clay.body]} seed={2} /><Lump colour={CLAYS[clay.trim]} seed={9} /></span></span>
              <span className="ct-can__name">{w.clayButton}</span>
            </button>
          </div>
          {picking ? <ClayPicker clay={clay} onChoose={choose} onRoll={() => { setPicking(false); roll(live.current.reel); }} words={w} /> : <div className="ct-transport" role="group" aria-label={w.title}>
            <button type="button" className="ct-key" data-control="start" aria-label={w.toStart} disabled={phase !== 'film'} onClick={() => scrubTo(toStart(live.current))}><SkipBack size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key" data-control="back" aria-label={frog ? w.hopBack : w.frameBack} disabled={frame === 0 || phase !== 'film'} onClick={() => scrubTo(frog ? stepHop(live.current, -1) : stepFrame(live.current, -1))}><StepBack size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key ct-key--play" data-control="play" data-backwards={view.backwards} aria-label={view.playing ? w.pause : w.play} disabled={phase !== 'film'} onClick={toggle}>{view.playing ? <Pause size={28} aria-hidden="true" /> : <Play size={28} aria-hidden="true" className="ct-flip ct-play" />}</button>
            <button type="button" className="ct-key" data-control="on" aria-label={frog ? w.hopOn : w.frameOn} disabled={frame === end || phase !== 'film'} onClick={() => scrubTo(frog ? stepHop(live.current, 1) : stepFrame(live.current, 1))}><StepForward size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key ct-key--dir" data-control="direction" aria-pressed={view.backwards} aria-label={w.direction} disabled={phase !== 'film'} onClick={() => { void selectionHaptic(); commit(setDirection(live.current, !live.current.backwards)); }}>
              <Rewind size={22} aria-hidden="true" className="ct-flip" />
            </button>
          </div>}
          {(muted || reduced) && <p className="ct-note">{muted ? w.quiet : w.stillNote}</p>}
          {ready && <div className="ct-curtain">
            <p className="ct-curtain__line">{w.curtainReady}</p>
            <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary" data-control="curtain" onClick={curtain}><Sparkles size={20} aria-hidden="true" />{w.curtain}</button>
          </div>}
        </div>
      </>}
    </section>
  </GameShell>;
}

/** One of the audience, seen from behind (the kit's own render). They watch,
 * lean in, prick up and hop with transforms only; a pat makes them hop. */
function Friend({ id, mood, label, onPat }: { id: FriendId; mood: string; label: string; onPat: () => void }) {
  const art = KIT_AUDIENCE[id];
  return <button type="button" className="ct-friend" data-friend={id} data-mood={mood} aria-label={label} onClick={onPat} style={{ '--show': art.show, '--ratio': art.width / art.height } as CSSProperties}>
    <span className="ct-friend__seat"><img src={art.src} alt="" width={art.width} height={art.height} draggable={false} decoding="async" /></span>
  </button>;
}
/** The little frame in each reel's window (no curtain, no filters). */
const PadFrame = memo(function PadFrame({ reel, body, trim, hands }: { reel: ReelId; body: ClayId; trim: ClayId; hands: Hands }) {
  return <ClayScene reel={reel} frame={PAD_FRAME[reel]} body={body} trim={trim} hands={hands} lite />;
});

/** Before the first film: two rows of six clay lumps, one for the body, one for the trim. */
function ClayPicker({ clay, onChoose, onRoll, words }: { clay: Clay; onChoose: (part: 'body' | 'trim', id: ClayId) => void; onRoll: () => void; words: typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he'] }) {
  const row = (part: 'body' | 'trim', title: string) => <div className="ct-pick__row" role="radiogroup" aria-label={title}>
    <span className="ct-pick__title" aria-hidden="true">{title}</span>
    <div className="ct-pick__lumps">
      {CLAY_IDS.map(id => <button type="button" key={id} role="radio" aria-checked={clay[part] === id} aria-label={`${title}: ${words.clays[id]}`} className="ct-lump" data-clay={id} data-part={part} onClick={() => onChoose(part, id)}>
        <Lump colour={CLAYS[id]} seed={CLAY_IDS.indexOf(id) + (part === 'trim' ? 6 : 0)} />
      </button>)}
    </div>
  </div>;
  return <div className="ct-pick">
    {row('body', words.bodyClay)}
    {row('trim', words.trimClay)}
    <div className="ct-roll"><button type="button" className="studio-game-button-v2 studio-game-button-v2--primary" data-control="roll" onClick={onRoll}><Play size={21} aria-hidden="true" />{words.roll}</button></div>
  </div>;
}
/** A hand-rolled lump of plasticine, each a little different, lit from the upper left like the room. */
function Lump({ colour, seed }: { colour: string; seed: number }) {
  const id = `ctl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (i: number) => 15 + ((seed * 7 + i * 13) % 5) * 0.8;
  const d = `M${24 - r(0)} 27C${22 - r(0)} 16 16 ${9 - (seed % 3)} 25 9C35 8 ${24 + r(2)} 15 ${25 + r(2)} 26C${26 + r(3)} 35 31 38 24 38C15 38 ${26 - r(0)} 36 ${24 - r(0)} 27Z`;
  const fill = chalky(colour);
  return <svg viewBox="0 0 48 44" aria-hidden="true" focusable="false" className="ct-lump__art">
    <defs><radialGradient id={id} cx=".36" cy=".3" r=".8"><stop offset="0" style={{ stopColor: `color-mix(in srgb, ${fill} 55%, var(--mk-white))` }} /><stop offset=".5" style={{ stopColor: fill }} /><stop offset="1" style={{ stopColor: `color-mix(in srgb, ${fill} 70%, var(--mk-shadow))` }} /></radialGradient></defs>
    <ellipse cx="25" cy="39" rx="16" ry="3" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <path d={d} style={{ fill: `url(#${id})` }} />
    <path d="M27 22a5 4 0 0 1 8 2M28.5 25a3 2.4 0 0 1 4.6 1.2" fill="none" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)', strokeWidth: 1 }} />
    <path d="M15 18a9 8 0 0 1 7-6" fill="none" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--mk-white) 55%, transparent)', strokeWidth: 1.6 }} />
  </svg>;
}
