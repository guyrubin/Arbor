import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Play, RotateCw } from 'lucide-react';
import { selectionHaptic } from '../../../../../lib/native';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx } from '../../../audio/kidAudio';
import { StudioPlayHero } from '../../StudioPlayHero';
import { AdventureSprout, useAdventureVoice } from './AdventureGuide';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, type Challenge } from './adventureRules';
import { BopFriend, BopScene, BopSprite } from './BopArt';
import { createBopTones, type BopTones } from './bopTones';
import { FIVE_FRIEND_SUN_COPY, countAlong, countOnLine, sunLine, turnLine } from './fiveFriendSunCopy';
import { CHOCK_SEAT, FRIEND_TOTAL, HOP_MS, JOIN_MS, PADS, PATH_END, SEAT_PADS, SUN_MS, SUN_SEATS, WOBBLE_MS, hintShown, hopCheck, nextArrival, padCell, spinFor } from './fiveFriendSunRules';
import './fiveFriendSun.css';

/** `make-room` is the beat where the child brings Chock's far pad into the circle. */
type Phase = 'ready' | 'spin' | 'count' | 'hop' | 'make-room' | 'sun' | 'done';

export default function FiveFriendSun() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = FIVE_FRIEND_SUN_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [phase, setPhaseState] = useState<Phase>('ready');
  /** The pad the hero has landed on; `at` runs ahead of it, pad by pad, during a hop. */
  const [position, setPosition] = useState(0);
  const [at, setAt] = useState(0);
  const [spin, setSpin] = useState(0);
  const [seated, setSeated] = useState(0);
  /** The seat that was filled a moment ago, so its friend can show it. */
  const [fresh, setFresh] = useState<number | null>(null);
  const [misses, setMisses] = useState(0);
  const [wobble, setWobble] = useState(0);
  const [status, setStatus] = useState('');
  const phaseRef = useRef<Phase>(phase);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tones = useRef<BopTones | null>(null);
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };

  /** Every step of the game is a plain timeout, so it plays the same with
   * motion off, and nothing is left running after the game closes. */
  const later = (ms: number, run: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); run(); }, ms);
    timers.current.push(id);
  };
  const clearTimers = () => { for (const id of timers.current) clearTimeout(id); timers.current = []; };
  useEffect(() => {
    const instance = createBopTones(); tones.current = instance;
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; instance.dispose(); tones.current = null; };
  }, []);

  /** After a landing or a new seat: fill the circle one seat at a time, in
   * order, then hand the turn back to the spinner. */
  const settle = (to: number, have: number) => {
    const next = nextArrival(to, have);
    if (next === 'none') { setFresh(null); setSpin(0); setPhase(to >= PATH_END ? 'done' : 'spin'); return; }
    if (next === 'make-room') { setFresh(null); setSpin(0); setPhase('make-room'); return; }
    setSeated(have + 1); setFresh(have); setSpin(0); kidSfx('correct');
    if (next === 'sun') { setPhase('sun'); later(SUN_MS, () => setPhase('done')); return; }
    setPhase('hop'); later(JOIN_MS, () => settle(to, have + 1));
  };
  const turn = () => {
    if (phaseRef.current !== 'spin') return;
    const next = spinFor(challenge, position);
    if (next < 1) return;
    void selectionHaptic(); setSpin(next); setMisses(0); setWobble(0); setStatus(''); setPhase('count');
  };
  const tapPad = (pad: number) => {
    if (phaseRef.current !== 'count') return;
    void selectionHaptic();
    if (hopCheck(position, spin, pad) !== 'land') {
      // Nothing moves and nothing is taken away: the count itself is the next step.
      setMisses(value => value + 1); setWobble(pad); later(WOBBLE_MS, () => setWobble(0));
      setStatus(countOnLine(w, position, spin)); kidSfx('tryAgain'); return;
    }
    const from = position, hops = spin, have = seated;
    const step = (count: number) => { setAt(from + count); setStatus(countAlong(w, from, count, hops)); tones.current?.play(count - 1); };
    setWobble(0); setPhase('hop'); step(1);
    for (let count = 2; count <= hops; count++) later((count - 1) * HOP_MS, () => step(count));
    later(hops * HOP_MS, () => { setPosition(from + hops); settle(from + hops, have); });
  };
  const bring = () => {
    if (phaseRef.current !== 'make-room') return;
    void selectionHaptic(); setSeated(CHOCK_SEAT + 1); setFresh(CHOCK_SEAT); setStatus(''); kidSfx('correct'); setPhase('hop');
    later(JOIN_MS, () => settle(position, CHOCK_SEAT + 1));
  };
  const reset = (level: Challenge) => {
    clearTimers(); tones.current?.stop();
    setChallenge(level); setPosition(0); setAt(0); setSpin(0); setSeated(0); setFresh(null); setMisses(0); setWobble(0); setStatus(''); setPhase('ready');
  };

  const hopping = phase === 'hop' && fresh === null;
  const cue = phase === 'ready' ? w.ready : phase === 'make-room' ? w.roomCue : phase === 'sun' || phase === 'done' ? w.sun
    : fresh !== null ? w.arrived[Math.min(fresh, w.arrived.length - 1)] : turnLine(w, position, spin);
  // A hop is counted by its tones and the written count; the voice waits for the landing.
  const narration = phase === 'count' && status ? status : cue;
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${phase}:${position}:${spin}:${fresh ?? -1}:${misses}`, enabled: phase !== 'done' && !hopping });
  const hinted = phase === 'count' && hintShown(challenge, misses) ? position + spin : 0;
  const here = padCell(at), before = padCell(Math.max(0, at - 1));

  return <GameShell fullBleed autoNarrate={false} worldId="pattern" title={w.title} instruction={w.instruction} hearIt={narration}>
    {phase === 'done'
      ? <GameFinish title={w.finishTitle} subtitle={w.transfer} onPlayAgain={() => reset(challenge)} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure adventure--bop adventure--sun" data-adventure="sun" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="adventure-toolbar">{phase === 'ready' && <ChallengePicker value={challenge} onChange={reset} words={shared} />}<AdventureSteps done={seated} total={FRIEND_TOTAL} /></div>
        <AdventureHeading focusKey={`${phase}:${position}:${spin}:${fresh ?? -1}`} onHear={guide.replay} muted={guide.muted || hopping}>{cue}</AdventureHeading>
        <div className="bop-stage sun-stage">
          <BopScene scene="scene-sun" />
          <div className="sun-board">
            <div className="sun-ring">
              <div className="sun-flower" data-lit={seated} style={{ '--sun-lit': seated } as CSSProperties}>
                <BopSprite name="sun-unlit" size="100%" flat />
                <BopSprite name="sun-lit" size="100%" flat className="sun-flower__lit" />
                <span className="sun-count">{sunLine(w.friendsHere, seated)}</span>
              </div>
              {SUN_SEATS.map((who, seat) => {
                const sitting = seat < seated, glad = fresh === seat || phase === 'sun';
                return <span key={who} className="sun-seat" data-seat={seat} data-here={sitting} data-fresh={fresh === seat} data-gap={seat === CHOCK_SEAT && phase === 'make-room'} aria-hidden="true">
                  {(sitting || seat !== CHOCK_SEAT) && <BopSprite name={SEAT_PADS[seat]} size={44} className="sun-seat__pad" />}
                  {sitting && (who === 'sprout' ? <AdventureSprout className="sun-seat__friend" size={48} speaking={guide.speaking} action={glad ? 'celebrate' : 'listen'} />
                    : who === 'hero' ? <StudioPlayHero className="sun-seat__friend" size={58} pose="cheer" celebrate />
                    : <BopFriend className="sun-seat__friend" friend={who} mood={glad ? 'happy' : 'idle'} size={26} />)}
                </span>;
              })}
              {seated <= CHOCK_SEAT && <div className="sun-far">
                <BopFriend className="sun-far__friend" friend="chock" size={26} />
                <button type="button" className="bop-piece sun-far__pad" data-hint={phase === 'make-room'} disabled={phase !== 'make-room'} aria-label={w.farPad} onClick={bring}><BopSprite name="pad-white" size={44} /></button>
              </div>}
            </div>
            <div className="sun-path" role="group" aria-label={w.path} data-position={position}>
              <span className="sun-mat" role="img" aria-label={w.mat} />
              {PADS.map(pad => {
                const cell = padCell(pad);
                return <button type="button" key={pad} className="bop-piece sun-pad" style={{ gridColumn: cell.column + 1, gridRow: 2 - cell.row }} data-pad={pad} data-row={cell.row} data-here={pad === at} data-hint={pad === hinted} data-wobble={pad === wobble} disabled={phase !== 'count'} aria-label={sunLine(pad === at ? w.padHero : w.pad, pad)} onClick={() => tapPad(pad)}>
                  <BopSprite name="pad-cream" size={50} flat />
                  <span className="bop-chip sun-pad__chip">{String(pad)}</span>
                </button>;
              })}
              {phase !== 'sun' && <span className="sun-walker" style={{ gridColumn: here.column + 1, gridRow: 2 - here.row, '--hop-x': before.column - here.column, '--hop-y': here.row - before.row } as CSSProperties} data-row={here.row} data-beat={at ? at % 2 : undefined} aria-hidden="true">
                <StudioPlayHero size={52} kick={at} pose={hopping ? 'dash' : fresh === CHOCK_SEAT ? 'hold-up' : 'idle'} celebrate={fresh !== null && fresh !== CHOCK_SEAT} />
              </span>}
            </div>
          </div>
        </div>
        {guide.muted && <p className="adventure-quiet">{w.quiet}</p>}
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions">
          {phase === 'ready'
            ? <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={() => setPhase('spin')}><Play size={21} aria-hidden="true" />{w.start}</button>
            : <button type="button" className="sun-spinner" data-face={spin} data-ready={phase === 'spin'} disabled={phase !== 'spin'} aria-label={spin ? sunLine(w.spinnerShows, spin) : w.spinner} onClick={turn}>
              {spin ? <span className="sun-spinner__pips" aria-hidden="true">{Array.from({ length: spin }, (_, index) => <i key={index} />)}</span> : <RotateCw size={38} aria-hidden="true" />}
              {spin > 0 && <span className="bop-chip sun-spinner__count">{String(spin)}</span>}
            </button>}
        </div>
      </section>}
  </GameShell>;
}
