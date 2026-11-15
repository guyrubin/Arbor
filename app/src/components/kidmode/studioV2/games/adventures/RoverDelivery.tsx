import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Play } from 'lucide-react';
import { selectionHaptic } from '../../../../../lib/native';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx } from '../../../audio/kidAudio';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useAdventureVoice } from './AdventureGuide';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, type Challenge } from './adventureRules';
import { BopFriend, BopScene, BopSprite } from './BopArt';
import { createBopTones, type BopTones } from './bopTones';
import { ROVER_DELIVERY_COPY, roverLine, type RoverDeliveryWords } from './roverDeliveryCopy';
import { ARRIVED_MS, HINT_AFTER, OOPS_MS, PRESS_MS, RETURN_MS, ROVER_ROUNDS, STEP_MS, cellColumn, cellRow, faceToward, headingOf, initialTurns, levelFor, roverAtStart, roverHint, roverTone, runRover, type RoverHint, type RoverLevel, type RoverPlace, type RoverRun } from './roverDeliveryRules';
import './roverDelivery.css';

type Phase = 'ready' | 'plan' | 'drive' | 'parked' | 'arrived' | 'done';
type Pose = 'idle' | 'hold-up' | 'oops';
/** Where a toy sits on the board and how far it is turned. The board reads
 * these as plain numbers, so the picture glides or jumps as motion allows. */
function placed(cell: number, size: number, turn: number): CSSProperties {
  return { '--rover-col': cellColumn(cell, size), '--rover-row': cellRow(cell, size), '--rover-turn': turn } as CSSProperties;
}

export default function RoverDelivery() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = ROVER_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [challenge, setChallengeState] = useState<Challenge>(() => defaultChallenge(child));
  const [round, setRoundState] = useState(0);
  /** Quarter turns of each sign, counted up, so a sign only ever turns clockwise. */
  const [turns, setTurnsState] = useState<number[]>(() => initialTurns(levelFor(defaultChallenge(child), 0)));
  const [folded, setFoldedState] = useState(false);
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [car, setCarState] = useState<RoverPlace>(() => roverAtStart(levelFor(defaultChallenge(child), 0)));
  const [trail, setTrail] = useState<number[]>([]);
  const [parks, setParksState] = useState(0);
  const [hint, setHint] = useState<RoverHint>(null);
  const [levelsDone, setLevelsDone] = useState(0);
  const [status, setStatus] = useState('');
  const [pose, setPose] = useState<Pose>('idle');
  const [runs, setRuns] = useState(0);
  const [changes, setChanges] = useState(0);
  const tones = useRef<BopTones | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Timers outlive the render that set them, so they read the game from refs.
  const phaseRef = useRef<Phase>(phase), challengeRef = useRef<Challenge>(challenge), roundRef = useRef(round);
  const turnsRef = useRef<number[]>(turns), foldedRef = useRef(folded), carRef = useRef<RoverPlace>(car), parksRef = useRef(parks);
  const wordsRef = useRef<RoverDeliveryWords>(w);
  wordsRef.current = w;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const setTurns = (next: number[]) => { turnsRef.current = next; setTurnsState(next); };
  const setFolded = (next: boolean) => { foldedRef.current = next; setFoldedState(next); };
  const setCar = (next: RoverPlace) => { carRef.current = next; setCarState(next); };
  const setParks = (next: number) => { parksRef.current = next; setParksState(next); };
  const floor = (): RoverLevel => levelFor(challengeRef.current, roundRef.current);
  /** The rover at its start, turned the short way to face its first heading. */
  const home = (level: RoverLevel): RoverPlace => ({ cell: level.start, turn: faceToward(carRef.current.turn, level.heading) });

  const clearTimers = () => { timers.current.forEach(id => clearTimeout(id)); timers.current = []; };
  /** Every wait in the game goes through here, so leaving or playing again
   * leaves nothing running. The game never waits for a sound or an animation. */
  const later = (run: () => void, ms: number) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(other => other !== id); run(); }, ms);
    timers.current.push(id);
  };
  useEffect(() => {
    const instance = createBopTones(); tones.current = instance;
    return () => { clearTimers(); instance.dispose(); tones.current = null; };
  }, []);

  /** A fresh floor: its signs as first set, the flower open, the rover at its start. */
  const load = (level: Challenge, at: number) => {
    const next = levelFor(level, at);
    challengeRef.current = level; roundRef.current = at;
    setChallengeState(level); setRoundState(at); setTurns(initialTurns(next)); setFolded(false); setCar(roverAtStart(next));
    setTrail([]); setParks(0); setHint(null); setStatus(''); setPose('idle');
  };
  const reset = (level: Challenge) => {
    clearTimers(); tones.current?.stop(); load(level, 0); setLevelsDone(0); setRuns(0); setChanges(0); setPhase('ready');
  };
  const advance = () => {
    const at = roundRef.current + 1;
    if (at >= ROVER_ROUNDS) { setPhase('done'); return; }
    load(challengeRef.current, at); setPhase('plan');
  };
  /** The end of a run. On the rug the floor is done. Anywhere else the rover
   * simply stays there: nothing is lost, and the words name what happened. */
  const land = (level: RoverLevel, run: RoverRun) => {
    const end = run.end;
    if (end === 'goal') {
      kidSfx('correct'); setLevelsDone(roundRef.current + 1); setStatus(''); setPhase('arrived'); later(advance, ARRIVED_MS);
      return;
    }
    const count = parksRef.current + 1;
    kidSfx('tryAgain'); setParks(count); setPose('oops'); later(() => setPose('idle'), OOPS_MS);
    setHint(count >= HINT_AFTER ? roverHint(level, turnsRef.current.map(headingOf), foldedRef.current) : null);
    setStatus(wordsRef.current.ends[end]); setPhase('parked');
  };
  const planning = () => phaseRef.current === 'ready' || phaseRef.current === 'plan' || phaseRef.current === 'parked';
  /** Any change to the plan: the same rover waits at its start again. */
  const replan = (line: string) => {
    void selectionHaptic(); kidSfx('tap');
    setCar(home(floor())); setStatus(line); setChanges(count => count + 1); setPhase('plan');
  };
  const turn = (index: number) => {
    if (!planning()) return;
    const next = turnsRef.current.map((value, at) => at === index ? value + 1 : value);
    setTurns(next); replan(roverLine(w.signNow, w.directions[headingOf(next[index])]));
  };
  const fold = () => {
    if (!planning()) return;
    const next = !foldedRef.current;
    setFolded(next); replan(next ? w.bloomNowFolded : w.bloomNowOpen);
  };
  const go = () => {
    if (!planning()) return;
    void selectionHaptic(); kidSfx('tap'); clearTimers();
    const level = floor(), run = runRover(level, turnsRef.current.map(headingOf), foldedRef.current);
    // A rover parked somewhere else rolls back to its start first, then drives.
    const lead = carRef.current.cell === level.start ? 0 : RETURN_MS;
    setCar(home(level)); setTrail([level.start]); setHint(null); setStatus(''); setRuns(count => count + 1);
    setPose('hold-up'); later(() => setPose('idle'), PRESS_MS); setPhase('drive');
    for (let move = 1; move < run.path.length; move++) later(() => {
      setCar({ cell: run.path[move], turn: faceToward(carRef.current.turn, run.headings[move]) });
      setTrail(run.path.slice(0, move + 1)); tones.current?.play(roverTone(move - 1));
    }, lead + STEP_MS * move);
    later(() => land(level, run), lead + STEP_MS * run.path.length);
  };

  const level = levelFor(challenge, round), cells = Array.from({ length: level.size * level.size }, (_, cell) => cell);
  // Short beats that the tones and the board carry: the voice waits for the next prompt.
  const busy = phase === 'drive' || phase === 'arrived';
  const cue = phase === 'done' ? w.finishTitle : phase === 'arrived' ? w.arrived : phase === 'drive' ? w.drive : phase === 'parked' ? w.parked : parks > 0 ? w.replan : w.plan;
  const narration = status || cue;
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${round}:${phase}:${runs}:${changes}`, enabled: !busy && phase !== 'done' });

  return <GameShell fullBleed autoNarrate={false} worldId="river-rescue" title={w.title} instruction={w.instruction} hearIt={narration}>
    {phase === 'done'
      ? <GameFinish title={w.finishTitle} subtitle={w.transfer} onPlayAgain={() => reset(challenge)} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure adventure--bop adventure--rover" data-adventure="rover" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="adventure-toolbar">{phase === 'ready' && <ChallengePicker value={challenge} onChange={reset} words={shared} />}<AdventureSteps done={levelsDone} total={ROVER_ROUNDS} /></div>
        <AdventureHeading focusKey={`${round}:${runs}:${busy ? phase : 'plan'}`} onHear={guide.replay} muted={guide.muted || busy}>{cue}</AdventureHeading>
        <div className="bop-stage rover-stage" data-phase={phase} data-size={level.size}>
          <BopScene scene="scene-floor" />
          {/* The floor is a map: it keeps its own left and right in every language. */}
          <div className="rover-board" dir="ltr" role="group" aria-label={w.board} style={{ '--rover-n': level.size } as CSSProperties}>
            {cells.map(cell => {
              const sign = level.signs.findIndex(item => item.cell === cell), driven = trail.includes(cell);
              if (sign >= 0) {
                const heading = headingOf(turns[sign]), hinted = hint === sign && !busy && heading !== level.signs[sign].fix;
                return <button type="button" key={cell} className="bop-piece rover-cell rover-sign" data-cell={cell} data-sign={sign} data-heading={heading} data-trail={driven} data-hint={hinted}
                  disabled={busy} aria-disabled={busy} aria-label={`${roverLine(w.sign, w.directions[heading])}${hinted ? ` ${w.hintHere}` : ''}`} onClick={() => turn(sign)}>
                  <span className="rover-spin" style={{ '--rover-turn': turns[sign] } as CSSProperties}><BopSprite name="rover-sign" /></span>
                </button>;
              }
              if (cell === level.bloom) {
                const hinted = hint === 'bloom' && !busy && !folded;
                return <button type="button" key={cell} className="bop-piece rover-cell rover-bloom" data-cell={cell} data-folded={folded} data-trail={driven} data-hint={hinted}
                  disabled={busy} aria-disabled={busy} aria-pressed={folded} aria-label={`${folded ? w.bloomFolded : w.bloomOpen}${hinted ? ` ${w.hintHere}` : ''}`} onClick={fold}>
                  <BopSprite name={folded ? 'rover-bloom-folded' : 'rover-bloom-open'} />
                </button>;
              }
              if (level.planters.includes(cell)) return <span key={cell} className="rover-cell rover-planter" data-cell={cell} role="img" aria-label={w.planter}><BopSprite name="rover-planter" /></span>;
              if (cell === level.goal) return <span key={cell} className="rover-cell rover-goal" data-cell={cell} data-trail={driven} role="img" aria-label={w.goal}><BopSprite name="rover-rug" flat /></span>;
              if (cell === level.start) return <span key={cell} className="rover-cell rover-start" data-cell={cell} data-trail={driven} role="img" aria-label={w.startMat}><i className="rover-mat" aria-hidden="true" /></span>;
              return <span key={cell} className="rover-cell" data-cell={cell} data-trail={driven} aria-hidden="true" />;
            })}
            <span className="rover-car" data-at={car.cell} data-heading={headingOf(car.turn)} data-parked={phase === 'parked'} role="img" aria-label={roverLine(w.rover, w.directions[headingOf(car.turn)])} style={placed(car.cell, level.size, car.turn)}>
              <span className="rover-spin"><BopSprite name="rover-car" /></span>
            </span>
            {/* Pep waits on the rug, in front of the rover when it pulls up. */}
            <span className="rover-pep" aria-hidden="true" style={placed(level.goal, level.size, 0)}>
              <BopFriend friend="pep" mood={phase === 'arrived' ? 'happy' : 'idle'} size={level.size === 3 ? 44 : 34} />
            </span>
            {/* The next pictures are fetched ahead, so a happy Pep never arrives late. */}
            <span className="rover-ahead" aria-hidden="true">
              <BopSprite name="pep-happy" flat />
              {level.bloom !== undefined && <BopSprite name="rover-bloom-folded" flat />}
            </span>
          </div>
        </div>
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions rover-actions">
          <StudioPlayHero size={84} kick={runs} pose={pose} celebrate={phase === 'arrived'} />
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" aria-label={w.start} disabled={busy} aria-disabled={busy} onClick={go}><Play size={21} aria-hidden="true" />{w.start}</button>
        </div>
      </section>}
  </GameShell>;
}
