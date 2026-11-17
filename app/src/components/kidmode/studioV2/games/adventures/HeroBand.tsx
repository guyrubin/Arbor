import { useEffect, useRef, useState } from 'react';
import { Check, Eye, Music2, Pause, Pencil, Play, RotateCcw, Sparkles } from 'lucide-react';
import { NEXT_GAME_COPY } from '../../../../../lib/i18nGameNext';
import { selectionHaptic } from '../../../../../lib/native';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx, onKidHush, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useStudioCreations } from '../../studioCreations';
import { AdventureSprout, useAdventureVoice } from './AdventureGuide';
import { BopCheer, BopScene } from './BopArt';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, type Challenge } from './adventureRules';
import { createBandEngine, type BandEngine } from './heroBandAudio';
import { HERO_BAND_COPY } from './heroBandCopy';
import { BAND_GLYPHS } from './heroBandGlyphs';
import { BAND_MOVES, DANCE_TEMPOS, LOOP_STEPS, defaultTempo, emptyLoop, filledSteps, movesFor, phraseFor, phraseMatches, placeMove, tapStep, validDance, type BandMotion, type DanceTempo, type MoveId } from './heroBandRules';
import './heroBand.css';

type Phase = 'ready' | 'show' | 'copy' | 'matched' | 'jam' | 'stage' | 'done';
const COPY_ROUNDS = 2;
const SHOW_STEPS = LOOP_STEPS * 2;
/** The body motion that goes with each pose. It runs on a wrapper, so a hero
 * with one portrait (or Sprout standing in) still visibly dances. */
const MOTION: Record<BandMotion | 'rest', Keyframe[]> = {
  jump: [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(-17%) scale(.96,1.05)', offset: .4 }, { transform: 'translateY(0) scale(1.05,.94)', offset: .82 }, { transform: 'translateY(0) scale(1,1)' }],
  zoom: [{ transform: 'translateX(0) skewX(0)' }, { transform: 'translateX(15%) skewX(-9deg)', offset: .35 }, { transform: 'translateX(-4%) skewX(4deg)', offset: .75 }, { transform: 'translateX(0) skewX(0)' }],
  snap: [{ transform: 'scale(1)' }, { transform: 'scale(1.16)', offset: .25 }, { transform: 'scale(1)' }],
  wobble: [{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg)', offset: .25 }, { transform: 'rotate(9deg)', offset: .6 }, { transform: 'rotate(0)' }],
  hop: [{ transform: 'translateY(0)' }, { transform: 'translateY(-8%)', offset: .25 }, { transform: 'translateY(0)', offset: .5 }, { transform: 'translateY(-8%)', offset: .75 }, { transform: 'translateY(0)' }],
  spin: [{ transform: 'rotateY(0)' }, { transform: 'rotateY(360deg)' }],
  rest: [{ transform: 'scale(1,1)' }, { transform: 'scale(1.02,.97)', offset: .4 }, { transform: 'scale(1,1)' }],
};

export default function HeroBand() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = HERO_BAND_COPY[lang], shared = ADVENTURE_COPY[lang], speeds = NEXT_GAME_COPY[lang];
  const child = useArborOptional()?.childProfile; const muted = useKidReadAloudMuted(child?.id ?? '');
  const saved = useStudioCreations(child?.id ?? '');
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<MoveId[]>(() => phraseFor(defaultChallenge(child), 0));
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [tempo, setTempoState] = useState<DanceTempo>(() => defaultTempo(defaultChallenge(child)));
  const [loop, setLoopState] = useState<(MoveId | null)[]>(emptyLoop);
  const [played, setPlayed] = useState<MoveId[]>([]);
  const [move, setMove] = useState<MoveId | null>(null);
  const [beat, setBeat] = useState(0);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [showPattern, setShowPattern] = useState(false);
  const [status, setStatus] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const engine = useRef<BandEngine | null>(null);
  const dancer = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>(phase), loopRef = useRef(loop), tempoRef = useRef(tempo), input = useRef<MoveId[]>([]), mutedRef = useRef(muted);
  mutedRef.current = muted;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const setLoop = (next: (MoveId | null)[]) => { loopRef.current = next; setLoopState(next); };
  const setTempo = (next: DanceTempo) => { tempoRef.current = next; setTempoState(next); };

  /** One step of dancing: the pose changes and the body moves, together. */
  const strike = (next: MoveId | null) => {
    setMove(next); setBeat(value => value + 1);
    const node = dancer.current;
    if (!node?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const motion = next === null ? 'rest' : BAND_MOVES[next].motion;
    const frames = motion === 'zoom' && lang === 'he' ? MOTION.zoom.map(frame => ({ ...frame, transform: String(frame.transform).replace('15%', '-15%').replace('-4%', '4%') })) : MOTION[motion];
    node.animate(frames, { duration: Math.min(380, tempoRef.current * .8), easing: 'cubic-bezier(.3,.7,.3,1)' });
  };
  const stopBeat = () => {
    engine.current?.stop(); setPlaying(false); setCursor(-1);
    if (phaseRef.current === 'show') setPhase('ready');
    if (phaseRef.current === 'stage') setPhase('jam');
  };
  const stopRef = useRef(stopBeat); stopRef.current = stopBeat;
  useEffect(() => {
    const instance = createBandEngine(); engine.current = instance;
    const unlisten = onKidHush(() => stopRef.current());
    const hidden = () => { if (document.visibilityState === 'hidden') stopRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { instance.dispose(); engine.current = null; unlisten(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (muted) stopRef.current(); }, [muted]);

  const begin = (run: Parameters<BandEngine['start']>[0]) => {
    guide.cancel(); setStatus(''); setPlaying(true);
    const sounding = engine.current?.start(run) ?? false;
    setUnavailable(!mutedRef.current && !sounding);
  };
  const hit = (id: MoveId) => { const sounding = engine.current?.hit(id) ?? false; if (!mutedRef.current && !sounding) setUnavailable(true); void selectionHaptic(); };

  const showDance = () => {
    input.current = []; setPlayed([]); setPhase('show');
    const phrase = [...target, ...emptyLoop()].slice(0, LOOP_STEPS);
    begin({ tempo: tempoRef.current, loop: () => phrase, steps: target.length, onStep: step => { setCursor(step); strike(phrase[step]); },
      onEnd: () => { setPlaying(false); setCursor(-1); setMove(null); setPhase('copy'); } });
  };
  const startJam = () => begin({ tempo: tempoRef.current, loop: () => loopRef.current,
    onStep: (step, _absolute, quiet) => { setCursor(step); if (!quiet) strike(loopRef.current[step]); } });
  const showTime = () => {
    setPhase('stage');
    begin({ tempo: tempoRef.current, loop: () => loopRef.current, steps: SHOW_STEPS, onStep: step => { setCursor(step); strike(loopRef.current[step]); },
      onEnd: () => { setPlaying(false); setCursor(-1); kidSfx('finish'); setPhase('done'); } });
  };
  const openJam = (moves: (MoveId | null)[] = emptyLoop(), speed: DanceTempo = tempoRef.current) => {
    stopBeat(); setLoop(moves); setTempo(speed); setMove(null); setShowPattern(false); setStatus(''); setPhase('jam');
  };
  const tap = (id: MoveId) => {
    const now = phaseRef.current;
    // B-GAME-46: before the first dance the pads are live and only make the hero move: nothing is recorded.
    if (now === 'ready') { guide.cancel(); hit(id); strike(id); return; }
    if (now === 'copy') {
      guide.cancel(); hit(id); strike(id);
      const next = [...input.current, id];
      // B-GAME-46: a different move keeps the moves already danced; the ring shows the step to try.
      if (id !== target[next.length - 1]) { kidSfx('tryAgain'); setStatus(w.retry); setShowPattern(true); return; }
      input.current = next; setPlayed(next); setStatus('');
      if (phraseMatches(target, next)) { setPhase('matched'); kidSfx('correct'); }
      return;
    }
    if (now !== 'jam') return;
    guide.cancel(); hit(id); strike(id);
    const band = engine.current;
    if (band?.running()) {
      const at = tapStep(band.elapsed(), tempoRef.current);
      if (at.upcoming) band.played(at.absolute);
      setLoop(placeMove(loopRef.current, at.step, id)); setStatus(''); return;
    }
    // With the beat paused, moves fill the steps in order: the same dance can
    // be built without any timing at all.
    const free = loopRef.current.indexOf(null);
    if (free < 0) { setStatus(w.full); return; }
    setLoop(placeMove(loopRef.current, free, id)); setStatus('');
  };
  const reset = (level: Challenge) => {
    stopBeat(); setChallenge(level); setRound(0); setTarget(phraseFor(level, 0)); setTempo(defaultTempo(level)); setLoop(emptyLoop());
    input.current = []; setPlayed([]); setMove(null); setShowPattern(false); setStatus(''); setPhase('ready');
  };
  const next = () => {
    input.current = []; setPlayed([]); setShowPattern(false); setStatus(''); setMove(null);
    if (round + 1 >= COPY_ROUNDS) { setRound(COPY_ROUNDS); openJam(); return; }
    setRound(round + 1); setTarget(phraseFor(challenge, round + 1)); setPhase('ready');
  };

  const kept = saved.items.find(item => item.creation.kind === 'dance')?.creation;
  const jamming = phase === 'jam' || phase === 'stage';
  const cue = phase === 'ready' ? w.ready : phase === 'show' ? w.watching : phase === 'copy' ? w.yourTurn : phase === 'matched' ? w.matched : phase === 'stage' ? w.stage : playing ? w.jamRunning : filledSteps(loop) ? w.jam : w.jamPaused;
  const narration = status || cue;
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${round}:${phase}:${status}`, enabled: !playing && phase !== 'done' });
  const pads = movesFor(challenge);
  const cells: (MoveId | null)[] = jamming ? loop : target;
  const pose = move === null ? 'idle' : BAND_MOVES[move].pose;

  return <GameShell fullBleed autoNarrate={false} worldId="rhythm-garden" title={w.title} instruction={w.instruction} hearIt={narration}>
    <section className="adventure adventure--band" data-adventure="hero-band" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish creation={{ kind: 'dance', moves: [...loop], tempo }} title={w.finish} subtitle={w.transfer} onPlayAgain={() => reset(challenge)} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        {!jamming && <div className="adventure-toolbar">{phase === 'ready' && <ChallengePicker value={challenge} onChange={reset} words={shared} />}<AdventureSteps done={round} total={COPY_ROUNDS + 1} /></div>}
        <AdventureHeading focusKey={`${round}:${phase}`} onHear={guide.replay} muted={guide.muted || playing} hearLabel={w.hear}>{cue}</AdventureHeading>
        <div className="band-stage" data-phase={phase} data-move={move ?? 'none'} data-playing={playing}>
          <BopScene scene="scene-band" />
          {/* B-GAME-45: the show gets its lights: three beams sweep the stage. */}
          {phase === 'stage' && <span className="band-beams" aria-hidden="true"><i /><i /><i /></span>}
          <BopCheer beat={phase === 'matched' ? round : phase === 'stage' ? 'stage' : null} big={phase === 'stage'} />
          <div className="band-floor">
            {/* Every move sends a note up from the dancer, on the beat. */}
            {move !== null && <span className="band-note" key={beat} data-move={move} aria-hidden="true"><Music2 size={phase === 'stage' ? 30 : 24} /></span>}
            <span className="band-dancer" ref={dancer}><StudioPlayHero size={phase === 'stage' ? 250 : 190} kick={beat} pose={pose} celebrate={phase === 'matched'} /></span>
            <AdventureSprout className="band-sprout" size={84} speaking={guide.speaking} beat={beat} action={phase === 'matched' ? 'celebrate' : phase === 'show' ? 'show' : phase === 'copy' ? 'listen' : 'welcome'} />
          </div>
          <div className="band-track" role="group" aria-label={jamming ? w.track : w.pattern} data-steps={cells.length}>
            {cells.map((id, index) => {
              const visible = jamming || showPattern || phase === 'show' || phase === 'matched' || index < played.length;
              const Glyph = id !== null && visible ? BAND_GLYPHS[id] : null;
              const name = id === null ? w.empty : visible ? w.moves[id] : w.hidden;
              const attrs = { 'data-move': visible && id !== null ? id : 'none', 'data-now': index === cursor, 'data-next': phase === 'copy' && index === played.length };
              return phase === 'jam'
                ? <button type="button" key={index} className="band-step" {...attrs} aria-disabled={id === null} aria-label={`${w.step} ${index + 1}: ${name}${id === null ? '' : `. ${w.takeOut}`}`} onClick={() => { if (id === null) return; setLoop(placeMove(loopRef.current, index, null)); setStatus(''); }}>{Glyph ? <Glyph size={20} aria-hidden="true" /> : <i aria-hidden="true" />}</button>
                : <span key={index} className="band-step" {...attrs} role="img" aria-label={`${w.step} ${index + 1}: ${name}`}>{Glyph ? <Glyph size={20} aria-hidden="true" /> : <i aria-hidden="true" />}</span>;
            })}
          </div>
          {phase !== 'stage' && <div className="band-pads" role="group" aria-label={w.pads} data-count={pads.length}>
            {pads.map(id => {
              const Glyph = BAND_GLYPHS[id];
              return <button type="button" key={id} className="band-pad" aria-label={w.moves[id]} data-move={id} data-lit={move === id} disabled={phase === 'show' || phase === 'matched'} onClick={() => tap(id)}>
                {move === id && <i className="band-ripple" key={beat} aria-hidden="true" />}
                <span className="band-pad__hero"><StudioPlayHero size={54} pose={BAND_MOVES[id].pose} /></span>
                <span className="band-pad__name"><Glyph size={16} aria-hidden="true" />{w.moves[id]}</span>
              </button>;
            })}
          </div>}
        </div>
        {phase === 'jam' && <div className="adventure-challenge band-tempo" role="group" aria-label={w.speed}>
          {DANCE_TEMPOS.map((value, index) => <button type="button" key={value} aria-pressed={tempo === value} onClick={() => { const running = engine.current?.running(); setTempo(value); if (running) startJam(); }}>{[speeds.slow, speeds.flowing, speeds.bouncy][index]}</button>)}
        </div>}
        {(muted || unavailable) && <p className="adventure-quiet">{muted ? w.quiet : w.unavailable}</p>}
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions">
          {phase === 'show' ? <button type="button" className="studio-game-button-v2" onClick={stopBeat}><Pause size={20} aria-hidden="true" />{w.pause}</button>
            : phase === 'matched' ? <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={next}>{round + 1 >= COPY_ROUNDS ? w.own : w.next}<Check size={20} aria-hidden="true" /></button>
            : phase === 'stage' ? <button type="button" className="studio-game-button-v2" onClick={stopBeat}><Pencil size={20} aria-hidden="true" />{w.back}</button>
            : phase === 'jam' ? <>
              {playing ? <button type="button" className="studio-game-button-v2" onClick={stopBeat}><Pause size={20} aria-hidden="true" />{w.pause}</button>
                : <button type="button" className={`studio-game-button-v2${filledSteps(loop) ? '' : ' studio-game-button-v2--primary adventure-go'}`} onClick={startJam}><Play size={20} aria-hidden="true" />{w.startBeat}</button>}
              <button type="button" className="studio-game-button-v2" disabled={!filledSteps(loop)} onClick={() => { setLoop(emptyLoop()); setMove(null); setStatus(''); }}><RotateCcw size={20} aria-hidden="true" />{w.clear}</button>
              <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" disabled={!filledSteps(loop)} onClick={showTime}><Sparkles size={20} aria-hidden="true" />{w.showTime}</button>
            </> : <>
              <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={showDance}><Play size={21} aria-hidden="true" />{phase === 'ready' ? w.showMe : w.showAgain}</button>
              {phase === 'copy' && <button type="button" className="studio-game-button-v2" aria-pressed={showPattern} onClick={() => setShowPattern(value => !value)}><Eye size={20} aria-hidden="true" />{showPattern ? w.hideMemory : w.memory}</button>}
              <button type="button" className="studio-game-button-v2" onClick={() => openJam()}>{w.own}</button>
              {kept?.kind === 'dance' && validDance(kept.moves, kept.tempo) && <button type="button" className="studio-game-button-v2" onClick={() => { if (saved.isCurrent()) openJam([...kept.moves], kept.tempo as DanceTempo); }}>{w.open}</button>}
            </>}
        </div>
        {jamming && <p className="adventure-transfer">{w.transfer}</p>}
      </>}
    </section>
  </GameShell>;
}
