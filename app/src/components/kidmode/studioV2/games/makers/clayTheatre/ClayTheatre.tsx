import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
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
  CUES, FPS, REEL_SECONDS, allWatched, captionAt, chooseReel, clayLine, cuesCrossed, frameAt, lastFrame, momentOf, pause, play, reelsFor, seekFrame,
  setDirection, startTransport, stepFrame, stepHop, tick, toStart, timeOf, type ReelId, type Transport,
} from './clayTheatreRules';
import { CLAYS, CLAY_IDS, chalky, type ClayId } from './clayInk';
import { createClayAudio, type ClayAudio } from './clayAudio';
import { ClayScene } from './ClayScene';
import '../makerPalette.css';
import './clayTheatre.css';

type Clay = { body: ClayId; trim: ClayId };
/** The frame each film can shows in its little window. */
const CAN_FRAME: Readonly<Record<ReelId, number>> = { rocket: 50, jump: 46, frog: 22 };

export default function ClayTheatre() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en', rtl = lang === 'he';
  const w = CLAY_THEATRE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const reduced = usePrefersReducedMotion();
  const offered = useMemo(() => reelsFor(stageFor(child)), [child]);
  const [view, setView] = useState<Transport>(() => startTransport('rocket'));
  const [clay, setClay] = useState<Clay>({ body: 'blue', trim: 'yellow' });
  const [picking, setPicking] = useState(true);
  const [done, setDone] = useState(false);
  const live = useRef(view);
  const audio = useRef<ClayAudio | null>(null);

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
    if (frameAt(next.t) !== before) audio.current?.tick();
  }, [commit]);
  const halt = useCallback(() => commit(pause(live.current)), [commit]);

  useEffect(() => {
    const instance = createClayAudio(); audio.current = instance;
    const unhush = onKidHush(() => commit(pause(live.current)));
    const hidden = () => { if (document.visibilityState === 'hidden') commit(pause(live.current)); };
    document.addEventListener('visibilitychange', hidden);
    return () => { unhush(); document.removeEventListener('visibilitychange', hidden); instance.dispose(); audio.current = null; };
  }, [commit]);
  // The projector purrs only while the film runs and sound is on.
  useEffect(() => { audio.current?.purr(view.playing && !muted); }, [view.playing, muted]);
  // Playback: one rAF loop while playing; cues sound when their time is crossed.
  useEffect(() => {
    if (!view.playing) return;
    let raf = 0, last = -1;
    const step = (now: number) => {
      const dt = last < 0 ? 0 : Math.min(0.1, (now - last) / 1000); last = now;
      const prev = live.current, next = tick(prev, dt);
      for (const kind of cuesCrossed(CUES[prev.reel], prev.t, next.t, prev.playing)) audio.current?.cue(kind);
      commit(next);
      if (next.playing) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [view.playing, view.reel, commit]);

  const roll = (reel: ReelId) => { void selectionHaptic(); const next = chooseReel(live.current, reel); commit(reduced ? next : play(next)); };
  const pick = (reel: ReelId) => {
    if (reel === live.current.reel) return;
    setPicking(false); roll(reel);
  };
  const toggle = () => { void selectionHaptic(); commit(live.current.playing ? pause(live.current) : play(live.current)); };
  const curtain = () => { void selectionHaptic(); halt(); audio.current?.stop(); setDone(true); };
  const again = () => { audio.current?.stop(); const fresh = startTransport('rocket'); live.current = fresh; setView(fresh); setPicking(true); setDone(false); };

  const reel = view.reel, frame = frameAt(view.t, reel), t = timeOf(frame), end = lastFrame(reel);
  const moment = momentOf(reel, t);
  const valueText = moment.kind === 'moment' ? clayLine(w.moment, moment.index, moment.total) : moment.kind === 'hop' ? clayLine(w.hop, moment.index, moment.total) : moment.kind === 'start' ? w.atStart : w.reaching;
  const caption = picking ? w.pick : w.captions[captionAt(reel, t)];
  const ready = !picking && allWatched(view, offered);
  const frog = reel === 'frog';

  return <GameShell fullBleed autoNarrate={false} worldId="clay-theatre" title={w.title} instruction={w.instruction} hearIt={caption}>
    <section className="ct" data-adventure="clay-theatre" data-reel={reel} data-picking={picking} data-playing={view.playing} data-frame={frame} dir={rtl ? 'rtl' : 'ltr'}>
      {done ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={again} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div className="ct-col ct-col--main">
        <div className="ct-stage" data-stage="">
          <ClayScene reel={reel} frame={frame} body={clay.body} trim={clay.trim} label={`${w.stage}: ${w.reels[reel]}, ${valueText}`} />
          <span className="ct-grain" aria-hidden="true" />
          {view.backwards && !picking && <span className="ct-badge" data-backwards=""><Rewind size={15} aria-hidden="true" className="ct-flip" />{w.backwards}</span>}
        </div>
        <p className="ct-caption" aria-live="polite">{caption}</p>
          {!picking && <FilmStrip reel={reel} frame={frame} end={end} rtl={rtl} label={w.strip} valueText={valueText} body={clay.body} trim={clay.trim}
            onSeek={next => scrubTo(seekFrame(live.current, next))} />}
        </div>
        <div className="ct-col ct-col--side">
        <div className="ct-cans" role="group" aria-label={w.cans}>
          {offered.map(id => {
            const watched = view.watched.includes(id);
            return <button type="button" key={id} className="ct-can" data-reel-can={id} data-watched={watched} aria-pressed={id === reel} aria-label={clayLine(watched ? w.canWatched : w.canNew, w.reels[id])} onClick={() => pick(id)}>
              <span className="ct-can__tin" aria-hidden="true">
                <span className="ct-can__window"><CanFrame reel={id} body={clay.body} trim={clay.trim} /></span>
                {watched && <span className="ct-can__star" data-can-star={id} />}
              </span>
              <span className="ct-can__name">{w.reels[id]}</span>
            </button>;
          })}
          {reel !== 'frog' && <button type="button" className="ct-can ct-can--clay" data-control="clay" aria-pressed={picking} aria-label={w.recolour} onClick={() => { void selectionHaptic(); if (picking) { setPicking(false); return; } commit(toStart(live.current)); setPicking(true); }}>
            <span className="ct-can__tin ct-can__tin--clay" aria-hidden="true"><Lump colour={CLAYS[clay.body]} seed={2} /><Lump colour={CLAYS[clay.trim]} seed={9} /></span>
            <span className="ct-can__name">{w.clayButton}</span>
          </button>}
        </div>
        {picking ? <ClayPicker clay={clay} onChange={setClay} onRoll={() => { setPicking(false); roll(live.current.reel); }} words={w} /> : <>
          <div className="ct-transport" role="group" aria-label={w.title}>
            <button type="button" className="ct-key" data-control="start" aria-label={w.toStart} onClick={() => scrubTo(toStart(live.current))}><SkipBack size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key" data-control="back" aria-label={frog ? w.hopBack : w.frameBack} disabled={frame === 0} onClick={() => scrubTo(frog ? stepHop(live.current, -1) : stepFrame(live.current, -1))}><StepBack size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key ct-key--play" data-control="play" aria-label={view.playing ? w.pause : w.play} onClick={toggle}>{view.playing ? <Pause size={28} aria-hidden="true" /> : <Play size={28} aria-hidden="true" className="ct-flip" />}</button>
            <button type="button" className="ct-key" data-control="on" aria-label={frog ? w.hopOn : w.frameOn} disabled={frame === end} onClick={() => scrubTo(frog ? stepHop(live.current, 1) : stepFrame(live.current, 1))}><StepForward size={22} aria-hidden="true" className="ct-flip" /></button>
            <button type="button" className="ct-key ct-key--dir" data-control="direction" aria-pressed={view.backwards} aria-label={w.direction} onClick={() => { void selectionHaptic(); commit(setDirection(live.current, !live.current.backwards)); }}>
              <Rewind size={22} aria-hidden="true" className="ct-flip" />
            </button>
          </div>
        </>}
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

/** The little frame in each film can's window (no proscenium, no filters). */
const CanFrame = memo(function CanFrame({ reel, body, trim }: { reel: ReelId; body: ClayId; trim: ClayId }) {
  return <ClayScene reel={reel} frame={CAN_FRAME[reel]} body={body} trim={trim} lite />;
});

/** The film strip is the scrubber: tiny real frames of the film, sprocket
 * holes, and the gold gate that marks the frame on stage. Drag, tap, or use
 * the arrow keys. Time runs in reading direction (right to left in Hebrew);
 * the scene inside stays as it is. */
function FilmStrip({ reel, frame, end, rtl, label, valueText, body, trim, onSeek }: { reel: ReelId; frame: number; end: number; rtl: boolean; label: string; valueText: string; body: ClayId; trim: ClayId; onSeek: (frame: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const fromPointer = (x: number) => {
    const box = track.current?.getBoundingClientRect(); if (!box || box.width <= 0) return;
    const k = Math.min(1, Math.max(0, (x - box.left) / box.width));
    onSeek(Math.round((rtl ? 1 - k : k) * end));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.focus(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic */ } fromPointer(e.clientX); };
  const move = (e: PointerEvent<HTMLDivElement>) => { if (e.buttons === 0 && e.pointerType === 'mouse') return; if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return; fromPointer(e.clientX); };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const ahead = rtl ? 'ArrowLeft' : 'ArrowRight', behind = rtl ? 'ArrowRight' : 'ArrowLeft';
    const by: Record<string, number> = { [ahead]: 1, [behind]: -1, ArrowUp: 1, ArrowDown: -1, PageUp: FPS, PageDown: -FPS };
    if (e.key === 'Home') { e.preventDefault(); onSeek(0); return; }
    if (e.key === 'End') { e.preventDefault(); onSeek(end); return; }
    if (e.key in by) { e.preventDefault(); onSeek(Math.max(0, Math.min(end, frame + by[e.key]))); }
  };
  return <div className="ct-strip" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={end} aria-valuenow={frame} aria-valuetext={valueText} aria-orientation="horizontal"
    data-strip="" onPointerDown={down} onPointerMove={move} onKeyDown={key}>
    <span className="ct-strip__holes" aria-hidden="true" />
    <div className="ct-strip__track" ref={track}>
      <StripFrames reel={reel} body={body} trim={trim} />
      <span className="ct-strip__done" style={{ inlineSize: `${(frame / end) * 100}%` }} aria-hidden="true" />
      <span className="ct-strip__gate" style={{ insetInlineStart: `${(frame / end) * 100}%` }} aria-hidden="true" />
    </div>
    <span className="ct-strip__holes" aria-hidden="true" />
  </div>;
}
/** One tiny frame a second, rendered by the same function as the stage. */
const StripFrames = memo(function StripFrames({ reel, body, trim }: { reel: ReelId; body: ClayId; trim: ClayId }) {
  const cells = Math.round(REEL_SECONDS[reel]);
  return <span className="ct-strip__frames" aria-hidden="true">
    {Array.from({ length: cells }, (_, i) => <span key={i} className="ct-strip__cell"><ClayScene reel={reel} frame={Math.round((i + 0.5) * FPS)} body={body} trim={trim} lite /></span>)}
  </span>;
});

/** Before the first film: two rows of six clay lumps, one for the body, one for the trim. */
function ClayPicker({ clay, onChange, onRoll, words }: { clay: Clay; onChange: (next: Clay) => void; onRoll: () => void; words: typeof CLAY_THEATRE_COPY['en'] | typeof CLAY_THEATRE_COPY['he'] }) {
  const row = (part: 'body' | 'trim', title: string) => <div className="ct-pick__row" role="radiogroup" aria-label={title}>
    <span className="ct-pick__title" aria-hidden="true">{title}</span>
    <div className="ct-pick__lumps">
      {CLAY_IDS.map(id => <button type="button" key={id} role="radio" aria-checked={clay[part] === id} aria-label={`${title}: ${words.clays[id]}`} className="ct-lump" data-clay={id} data-part={part}
        onClick={() => { void selectionHaptic(); onChange({ ...clay, [part]: id }); }}>
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
/** A hand-rolled lump of plasticine, each a little different. */
function Lump({ colour, seed }: { colour: string; seed: number }) {
  const id = `ctl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (i: number) => 15 + ((seed * 7 + i * 13) % 5) * 0.8;
  const d = `M${24 - r(0)} 27C${22 - r(0)} 16 16 ${9 - (seed % 3)} 25 9C35 8 ${24 + r(2)} 15 ${25 + r(2)} 26C${26 + r(3)} 35 31 38 24 38C15 38 ${26 - r(0)} 36 ${24 - r(0)} 27Z`;
  const fill = chalky(colour);
  return <svg viewBox="0 0 48 44" aria-hidden="true" focusable="false" className="ct-lump__art">
    <defs><radialGradient id={id} cx=".36" cy=".3" r=".8"><stop offset="0" style={{ stopColor: `color-mix(in srgb, ${fill} 55%, var(--mk-white))` }} /><stop offset=".5" style={{ stopColor: fill }} /><stop offset="1" style={{ stopColor: `color-mix(in srgb, ${fill} 70%, var(--mk-shadow))` }} /></radialGradient></defs>
    <ellipse cx="24" cy="39" rx="15" ry="3" style={{ fill: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)' }} />
    <path d={d} style={{ fill: `url(#${id})` }} />
    <path d="M27 22a5 4 0 0 1 8 2M28.5 25a3 2.4 0 0 1 4.6 1.2" fill="none" strokeLinecap="round" style={{ stroke: 'color-mix(in srgb, var(--mk-shadow) 22%, transparent)', strokeWidth: 1 }} />
  </svg>;
}
