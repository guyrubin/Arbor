import { NEXT_GAME_COPY } from "../../../../../lib/i18nGameNext";
import { useEffect, useRef, useState } from 'react';
import { AdventureSprout, useAdventureVoice } from './AdventureGuide';
import { InstrumentSprite } from './AdventureSprite';
import { StudioAdventureScene } from '../../StudioAdventureScene';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useStudioCreations } from '../../studioCreations';
import { Check, Droplet, Eye, Triangle, Music2, Pause, Play, Star, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx, onKidHush, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, melodyFor, melodyMatches, type Challenge, type NoteId } from './adventureRules';
import { createGardenAudio, type GardenAudio } from './gardenAudio';

const NOTE_GLYPHS = [Star, Droplet, Triangle];
export default function RhythmGarden() {
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"]; const lang = uiLang === 'he' ? 'he' : 'en'; const w = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile; const muted = useKidReadAloudMuted(child?.id ?? '');
  const saved = useStudioCreations(child?.id ?? '');
  const [tempo, setTempo] = useState(760);
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [round, setRound] = useState(0); const [target, setTarget] = useState<NoteId[]>(() => melodyFor(defaultChallenge(child), 0));
  const [phase, setPhase] = useState<'ready' | 'copy' | 'matched' | 'compose' | 'done'>('ready');
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false); const [lit, setLit] = useState<number | null>(null);
  const [played, setPlayed] = useState<NoteId[]>([]); const [composition, setComposition] = useState<NoteId[]>([]);
  const [showPattern, setShowPattern] = useState(false); const [status, setStatus] = useState(''); const [unavailable, setUnavailable] = useState(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<GardenAudio | null>(null); const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(false); const input = useRef<NoteId[]>([]); const phaseRef = useRef(phase); phaseRef.current = phase;
  const stop = () => { if (tapTimer.current) clearTimeout(tapTimer.current); timers.current.forEach(clearTimeout); timers.current = []; active.current = false; audio.current?.stop(); setPlaying(false); setLit(null); };
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => {
    const instance = createGardenAudio(); audio.current = instance;
    const unlisten = onKidHush(() => stopRef.current());
    const hidden = () => { if (document.visibilityState === 'hidden') stopRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { if (tapTimer.current) clearTimeout(tapTimer.current); timers.current.forEach(clearTimeout); timers.current = []; active.current = false; instance.dispose(); audio.current = null; unlisten(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (muted) stopRef.current(); }, [muted]);
  const sound = (note: NoteId) => { const ok = audio.current?.play(note) ?? false; if (!muted && !ok) setUnavailable(true); };
  const play = (notes: readonly NoteId[], toCopy: boolean) => {
    stop(); guide.cancel(); if (!notes.length) return;
    active.current = true; setPlaying(true); setStatus('');
    const scheduled = audio.current?.sequence(notes, tempo) ?? false;
    setUnavailable(!muted && !scheduled);
    if (toCopy) { setPhase('copy'); phaseRef.current = 'copy'; input.current = []; setPlayed([]); }
    notes.forEach((note, i) => {
      const strike = () => { if (!active.current) return; setLit(note); setBeat(value => value + 1); };
      // Visual feedback is best-effort; audio was scheduled above inside the gesture.
      if (i === 0) strike(); else timers.current.push(setTimeout(strike, i * tempo));
      timers.current.push(setTimeout(() => { if (active.current) setLit(null); }, i * tempo + Math.min(460, tempo - 80)));
    });
    timers.current.push(setTimeout(() => { active.current = false; setPlaying(false); setLit(null); timers.current = []; }, notes.length * tempo));
  };
  const tap = (note: NoteId) => {
    if (active.current || !['ready', 'copy', 'compose'].includes(phaseRef.current)) return;
    guide.cancel();
    if (phaseRef.current === 'compose' && input.current.length >= 8) { setStatus(w.fullTune); return; }
    if (tapTimer.current) clearTimeout(tapTimer.current);
    setLit(note); setBeat(value => value + 1);
    tapTimer.current = setTimeout(() => setLit(null), 420);
    if (phaseRef.current === 'ready') { sound(note); return; }
    if (phaseRef.current === 'compose') {
      const next = [...input.current, note]; input.current = next; setComposition(next); sound(note); return;
    }
    const next = [...input.current, note]; sound(note);
    if (note !== target[next.length - 1]) { input.current = []; setPlayed([]); setStatus(w.rhythmRetry); setShowPattern(true); return; }
    input.current = next; setPlayed(next); setStatus('');
    if (melodyMatches(target, next)) { phaseRef.current = 'matched'; setPhase('matched'); kidSfx('correct'); }
  };
  const reset = (level: Challenge) => { stop(); setChallenge(level); setRound(0); setTarget(melodyFor(level, 0)); setPhase('ready'); phaseRef.current = 'ready'; input.current = []; setPlayed([]); setComposition([]); setShowPattern(false); setStatus(''); };
  const next = () => {
    stop(); input.current = []; setPlayed([]); setShowPattern(false); setStatus('');
    if (round === 2) { setPhase('compose'); phaseRef.current = 'compose'; }
    else { setRound(value => value + 1); setTarget(melodyFor(challenge, round + 1)); setPhase('ready'); phaseRef.current = 'ready'; }
  };
  const cue = playing ? w.watch : phase === 'matched' ? w.rhythmMatch : phase === 'compose' ? w.rhythmCompose : phase === 'ready' ? w.watch : w.yourTurn;
  const narration = status || (phase === 'compose' ? `${cue} ${w.rhythmComposeHelp}` : phase === 'ready' ? `${w.rhythmInstruction} ${cue}` : cue);
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${round}:${phase}:${playing}:${status}`, enabled: !playing && phase !== 'done' });
  return <GameShell fullBleed autoNarrate={false} worldId="rhythm-garden" title={w.rhythm} instruction={w.rhythmInstruction} hearIt={narration}>
    <section className="adventure adventure--rhythm" data-adventure="rhythm-garden" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish creation={{ kind: 'melody', notes: composition, tempo }} title={w.rhythmFinish} subtitle={w.rhythmTransfer} onPlayAgain={() => reset(challenge)} playAgainLabel={w.again} homeLabel={w.home} /> : <>
        <div className="adventure-toolbar"><ChallengePicker value={challenge} onChange={reset} words={w} />{phase !== 'compose' && <AdventureSteps done={round} />}</div>
        {(phase === 'ready' || phase === 'compose') && <div className="adventure-actions rhythm-workshop-actions">
          <button type="button" className="studio-game-button-v2" onClick={() => { stop(); input.current = []; setComposition([]); setPhase('compose'); phaseRef.current = 'compose'; setStatus(''); }}>{nextWords.freeTune}</button>
          {saved.items.find(item => item.creation.kind === 'melody') && <button type="button" className="studio-game-button-v2" onClick={() => {
            const kept = saved.items.find(item => item.creation.kind === 'melody')?.creation;
            if (!saved.isCurrent() || kept?.kind !== 'melody') return;
            stop(); input.current = [...kept.notes]; setComposition([...kept.notes]); setTempo(kept.tempo); setPhase('compose'); phaseRef.current = 'compose'; setStatus('');
          }}>{nextWords.openTune}</button>}
        </div>}
        {phase === 'compose' && <div className="adventure-challenge rhythm-tempo" role="group" aria-label={nextWords.tuneSpeed}>
          {([1000, 760, 500] as const).map((value, index) => <button type="button" key={value} aria-pressed={tempo === value} onClick={() => { stop(); setTempo(value); }}>{[nextWords.slow, nextWords.flowing, nextWords.bouncy][index]}</button>)}
        </div>}
        <AdventureHeading focusKey={`${round}:${phase}:${playing}`} onHear={guide.replay} muted={guide.muted || playing}>{cue}</AdventureHeading>
        <div className="rhythm-stage" data-phase={phase} data-active-note={lit ?? 'none'}><StudioAdventureScene activityId="rhythm-garden" /><div className="rhythm-conductor"><span className="rhythm-halo" aria-hidden="true" /><StudioPlayHero size={270} kick={beat} pose={lit === 0 ? 'hold-up' : lit === 1 ? 'freeze-a' : lit === 2 ? 'freeze-b' : 'idle'} celebrate={phase === 'matched'} /><AdventureSprout className="rhythm-sprout" size={125} speaking={guide.speaking} beat={beat} action={phase === 'matched' ? 'celebrate' : playing ? 'show' : phase === 'copy' ? 'listen' : 'welcome'} /></div><div className="rhythm-pods" role="group" aria-label={w.rhythm}>
          {([0, 1, 2] as const).map(note => {
            return <button type="button" key={note} data-note={note} data-lit={lit === note} className="rhythm-pod" aria-label={w.notes[note]} disabled={playing || phase === 'matched'} onClick={() => tap(note)}>
              <span className="rhythm-pad"><InstrumentSprite note={note} lit={lit === note} /></span><span className="rhythm-pedestal" aria-hidden="true" /><span className="rhythm-name">{w.notes[note]}</span>
            </button>;
          })}
        </div></div>
        <div className="rhythm-pattern" role="group" aria-label={w.tune}>
          {(phase === 'compose' ? composition : target).map((note, i) => {
            const Glyph = NOTE_GLYPHS[note]; const visible = phase === 'compose' || showPattern || i < played.length || phase === 'matched';
            return <span key={i} data-filled={phase === 'compose' || i < played.length} aria-label={`${w.note} ${i + 1}: ${visible ? w.notes[note] : w.emptyNote}`}>{visible ? <Glyph size={23} aria-hidden="true" /> : <span aria-hidden="true">·</span>}</span>;
          })}
          {phase === 'compose' && composition.length === 0 && <p>{w.rhythmComposeHelp}</p>}
        </div>
        {(muted || unavailable) && <p className="adventure-quiet">{muted ? w.visual : w.rhythmUnavailable}</p>}
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions">
          {playing ? <button type="button" className="studio-game-button-v2" onClick={stop}><Pause size={20} aria-hidden="true" />{w.stop}</button> : phase === 'matched' ? <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={next}>{w.next}<Check size={20} aria-hidden="true" /></button> : phase === 'compose' ? <>
            <button type="button" className="studio-game-button-v2" disabled={!composition.length} onClick={() => { const nextTune = input.current.slice(0, -1); input.current = nextTune; setComposition(nextTune); setStatus(''); }}><Undo2 size={20} aria-hidden="true" />{w.undo}</button>
            <button type="button" className="studio-game-button-v2" disabled={!composition.length} onClick={() => play(composition, false)}><Play size={20} aria-hidden="true" />{w.rhythmPlay}</button>
            <button type="button" disabled={!composition.length} className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={() => { stop(); setPhase('done'); }}><Music2 size={20} aria-hidden="true" />{w.finish}</button>
          </> : <>
            <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={() => play(target, true)}><Play size={21} aria-hidden="true" />{phase === 'ready' ? w.listen : w.replay}</button>
            <button type="button" className="studio-game-button-v2" aria-pressed={showPattern} onClick={() => setShowPattern(value => !value)}><Eye size={20} aria-hidden="true" />{showPattern ? w.hideMemory : w.memory}</button>
          </>}
        </div>
        {phase === 'compose' && <p className="adventure-transfer">{w.rhythmTransfer}</p>}
      </>}
    </section>
  </GameShell>;
}
