import { NEXT_GAME_COPY } from "../../../../../lib/i18nGameNext";
import { useEffect, useRef, useState } from 'react';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useStudioCreations } from '../../studioCreations';
import { Check, Droplet, Eye, Leaf, Music2, Pause, Play, Star, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx, onKidHush, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { AdventureHeading, AdventureSteps, ChallengePicker, GardenScenery } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, melodyFor, melodyMatches, type Challenge, type NoteId } from './adventureRules';
import { createGardenAudio, type GardenAudio } from './gardenAudio';

const NOTE_GLYPHS = [Star, Droplet, Leaf];
export default function RhythmGarden() {
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"]; const lang = uiLang === 'he' ? 'he' : 'en'; const w = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile; const muted = useKidReadAloudMuted(child?.id ?? '');
  const saved = useStudioCreations(child?.id ?? '');
  const [tempo, setTempo] = useState(760);
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [round, setRound] = useState(0); const [target, setTarget] = useState<NoteId[]>(() => melodyFor(defaultChallenge(child), 0));
  const [phase, setPhase] = useState<'ready' | 'copy' | 'matched' | 'compose' | 'done'>('ready');
  const [playing, setPlaying] = useState(false); const [lit, setLit] = useState<number | null>(null);
  const [played, setPlayed] = useState<NoteId[]>([]); const [composition, setComposition] = useState<NoteId[]>([]);
  const [showPattern, setShowPattern] = useState(false); const [status, setStatus] = useState(''); const [unavailable, setUnavailable] = useState(false);
  const audio = useRef<GardenAudio | null>(null); const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const active = useRef(false); const input = useRef<NoteId[]>([]); const phaseRef = useRef(phase); phaseRef.current = phase;
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; active.current = false; audio.current?.stop(); setPlaying(false); setLit(null); };
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => {
    const instance = createGardenAudio(); audio.current = instance;
    const unlisten = onKidHush(() => stopRef.current());
    const hidden = () => { if (document.visibilityState === 'hidden') stopRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { timers.current.forEach(clearTimeout); timers.current = []; active.current = false; instance.dispose(); audio.current = null; unlisten(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (muted) stopRef.current(); }, [muted]);
  const sound = (note: NoteId) => { const ok = audio.current?.play(note) ?? false; if (!muted && !ok) setUnavailable(true); };
  const play = (notes: readonly NoteId[], toCopy: boolean) => {
    stop(); if (!notes.length) return;
    active.current = true; setPlaying(true); setStatus('');
    if (toCopy) { setPhase('copy'); phaseRef.current = 'copy'; input.current = []; setPlayed([]); }
    notes.forEach((note, i) => {
      const strike = () => { if (!active.current) return; setLit(note); sound(note); };
      // First note stays inside the gesture for Safari's audio unlock.
      if (i === 0) strike(); else timers.current.push(setTimeout(strike, i * tempo));
      timers.current.push(setTimeout(() => { if (active.current) setLit(null); }, i * tempo + Math.min(460, tempo - 80)));
    });
    timers.current.push(setTimeout(() => { active.current = false; setPlaying(false); setLit(null); timers.current = []; }, notes.length * tempo));
  };
  const tap = (note: NoteId) => {
    if (active.current || !['copy', 'compose'].includes(phaseRef.current)) return;
    if (phaseRef.current === 'compose') {
      if (input.current.length >= 8) { setStatus(w.fullTune); return; }
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
  return <GameShell worldId="rhythm-garden" title={w.rhythm} instruction={w.rhythmInstruction} hearIt={phase === 'compose' ? `${w.rhythmCompose} ${w.rhythmComposeHelp}` : `${w.rhythmInstruction} ${cue}`}>
    <section className="adventure adventure--rhythm" data-adventure="rhythm-garden" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish creation={{ kind: 'melody', notes: composition, tempo }} title={w.rhythmFinish} subtitle={w.rhythmTransfer} onPlayAgain={() => reset(challenge)} playAgainLabel={w.again} homeLabel={w.home} /> : <>
        <div className="adventure-toolbar"><ChallengePicker value={challenge} onChange={reset} words={w} /><AdventureSteps done={phase === 'compose' ? 3 : round} /></div>
        {(phase === 'ready' || phase === 'compose') && <div className="adventure-actions rhythm-workshop-actions">
          <button type="button" onClick={() => { stop(); input.current = []; setComposition([]); setPhase('compose'); phaseRef.current = 'compose'; setStatus(''); }}>{nextWords.freeTune}</button>
          {saved.items.find(item => item.creation.kind === 'melody') && <button type="button" onClick={() => {
            const kept = saved.items.find(item => item.creation.kind === 'melody')?.creation;
            if (!saved.isCurrent() || kept?.kind !== 'melody') return;
            stop(); input.current = [...kept.notes]; setComposition([...kept.notes]); setTempo(kept.tempo); setPhase('compose'); phaseRef.current = 'compose'; setStatus('');
          }}>{nextWords.openTune}</button>}
        </div>}
        {phase === 'compose' && <div className="adventure-challenge rhythm-tempo" role="group" aria-label={nextWords.tuneSpeed}>
          {([1000, 760, 500] as const).map((value, index) => <button type="button" key={value} aria-pressed={tempo === value} onClick={() => { stop(); setTempo(value); }}>{[nextWords.slow, nextWords.flowing, nextWords.bouncy][index]}</button>)}
        </div>}
        <AdventureHeading focusKey={`${round}:${phase}:${playing}`}>{cue}</AdventureHeading>
        <div className="rhythm-stage"><GardenScenery night /><div className="rhythm-conductor"><StudioPlayHero size={92} celebrate={phase === 'matched'} /></div><div className="rhythm-flowers" role="group" aria-label={w.rhythm}>
          {([0, 1, 2] as const).map(note => {
            const Glyph = NOTE_GLYPHS[note]; return <button type="button" key={note} data-note={note} data-lit={lit === note} className="rhythm-flower" aria-label={w.notes[note]} disabled={playing || phase === 'ready' || phase === 'matched'} onClick={() => tap(note)}>
              <span className="rhythm-bloom"><Glyph size={42} aria-hidden="true" fill="currentColor" /></span><span className="rhythm-stem" aria-hidden="true" /><span className="rhythm-name">{w.notes[note]}</span>
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
        <p className="adventure-status" role="status">{status || '\u00a0'}</p>
        <div className="adventure-actions">
          {playing ? <button type="button" onClick={stop}><Pause size={20} aria-hidden="true" />{w.stop}</button> : phase === 'matched' ? <button type="button" className="adventure-go" onClick={next}>{w.next}<Check size={20} aria-hidden="true" /></button> : phase === 'compose' ? <>
            <button type="button" disabled={!composition.length} onClick={() => { const nextTune = input.current.slice(0, -1); input.current = nextTune; setComposition(nextTune); setStatus(''); }}><Undo2 size={20} aria-hidden="true" />{w.undo}</button>
            <button type="button" disabled={!composition.length} onClick={() => play(composition, false)}><Play size={20} aria-hidden="true" />{w.rhythmPlay}</button>
            <button type="button" disabled={!composition.length} className="adventure-go" onClick={() => { stop(); setPhase('done'); }}><Music2 size={20} aria-hidden="true" />{w.finish}</button>
          </> : <>
            <button type="button" className="adventure-go" onClick={() => play(target, true)}><Play size={21} aria-hidden="true" />{phase === 'ready' ? w.listen : w.replay}</button>
            <button type="button" aria-pressed={showPattern} onClick={() => setShowPattern(value => !value)}><Eye size={20} aria-hidden="true" />{showPattern ? w.hideMemory : w.memory}</button>
          </>}
        </div>
        {phase === 'compose' && <p className="adventure-transfer">{w.rhythmTransfer}</p>}
      </>}
    </section>
  </GameShell>;
}
