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
import { BopCheer, BopFriend, BopScene, BopSprite } from './BopArt';
import { createBopTones, type BopTones } from './bopTones';
import { OOPS_BUTTON_COPY, oopsLine } from './oopsButtonCopy';
import { BLOOM_MS, OOPS_ROUNDS, OPEN_MS, PETALS, PETAL_ART, SETTLE_MS, WATCH_LEAD_MS, WOBBLE_MS, copyPress, orderFor, toyJams, undoCheck, undoHint, watchMs, type PetalId } from './oopsButtonRules';
import './oopsButton.css';

/** `jam` → pause → `undo` (petals back, last one first) → `reset` → restart → `watch` again. */
type Phase = 'ready' | 'watch' | 'copy' | 'bloom' | 'jam' | 'undo' | 'reset' | 'done';

export default function OopsButton() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = OOPS_BUTTON_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<readonly PetalId[]>([]);
  /** Petals that are open now, in the order they opened. A petal that jammed
   * half-way is the last of them, so it is the first to go back. */
  const [opened, setOpened] = useState<readonly PetalId[]>([]);
  /** While the toy shows its order: how many petals it has opened, and whether they have closed again. */
  const [shown, setShown] = useState(0);
  const [folded, setFolded] = useState(false);
  const [stuck, setStuck] = useState<PetalId | null>(null);
  const [wobble, setWobble] = useState<PetalId | null>(null);
  /** True when the jam was the toy's own doing, so the words say so. */
  const [jamByToy, setJamByToy] = useState(false);
  const [waits, setWaits] = useState(0);
  const [nudge, setNudge] = useState(false);
  const [undone, setUndone] = useState(0);
  /** How many times this round's order has been shown again after a restart. */
  const [attempt, setAttempt] = useState(0);
  const [blooms, setBlooms] = useState(0);
  const [presses, setPresses] = useState(0);
  const phaseRef = useRef<Phase>(phase);
  /** The toy's own jam happens once a sitting; Play again allows one more. */
  const jamUsed = useRef(false);
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

  /** The toy opens its petals one by one, holds, closes them, then it is the child's turn. */
  const showOrder = (sequence: readonly PetalId[]) => {
    clearTimers();
    setOpened([]); setStuck(null); setWobble(null); setShown(0); setFolded(false); setPhase('watch');
    sequence.forEach((petal, index) => later(WATCH_LEAD_MS + index * OPEN_MS, () => { setShown(index + 1); tones.current?.play(petal); }));
    later(watchMs(sequence.length), () => setFolded(true));
    later(watchMs(sequence.length) + SETTLE_MS, () => setPhase('copy'));
  };
  const startRound = (next: number, level: Challenge, previous: readonly PetalId[]) => {
    const sequence = orderFor(level, next, Math.random, previous);
    setRound(next); setOrder(sequence); setAttempt(0); showOrder(sequence);
  };
  const begin = () => {
    if (phaseRef.current !== 'ready') return;
    void selectionHaptic(); startRound(0, challenge, []);
  };
  const shake = (petal: PetalId) => { setWobble(petal); later(WOBBLE_MS, () => setWobble(current => current === petal ? null : current)); };
  const press = (petal: PetalId) => {
    if (phaseRef.current === 'copy') {
      const result = copyPress(order, opened, petal);
      if (result === 'again') return;
      void selectionHaptic(); setPresses(count => count + 1);
      const open = [...opened, petal]; setOpened(open);
      if (result === 'jam') {
        // Nothing is taken away and nothing is counted: the petal sticks half-way and pause is the next step.
        setStuck(petal); setJamByToy(false); kidSfx('tryAgain'); setPhase('jam'); return;
      }
      tones.current?.play(petal);
      if (result === 'bloom') {
        setBlooms(count => count + 1); kidSfx('correct'); setPhase('bloom');
        later(BLOOM_MS, () => { if (round + 1 >= OOPS_ROUNDS) setPhase('done'); else startRound(round + 1, challenge, order); });
        return;
      }
      if (toyJams(round, open.length, jamUsed.current)) { jamUsed.current = true; setStuck(petal); setJamByToy(true); kidSfx('tryAgain'); setPhase('jam'); }
      return;
    }
    if (phaseRef.current !== 'undo') return;
    const result = undoCheck(opened, petal);
    if (result === 'closed') return;
    void selectionHaptic(); setPresses(count => count + 1);
    if (result === 'wait') { setWaits(count => count + 1); setNudge(true); shake(petal); kidSfx('tryAgain'); return; }
    const open = opened.slice(0, -1);
    setOpened(open); setNudge(false); setUndone(count => count + 1); tones.current?.play(petal);
    if (stuck === petal) setStuck(null);
    if (open.length === 0) setPhase('reset');
  };
  const pause = () => {
    if (phaseRef.current !== 'jam') return;
    void selectionHaptic(); setWaits(0); setNudge(false); setUndone(0); setWobble(null); setPhase('undo');
  };
  const restart = () => {
    if (phaseRef.current !== 'reset') return;
    void selectionHaptic(); setAttempt(count => count + 1); showOrder(order);
  };
  const reset = (level: Challenge) => {
    clearTimers(); tones.current?.stop(); jamUsed.current = false;
    setChallenge(level); setRound(0); setOrder([]); setOpened([]); setShown(0); setFolded(false); setStuck(null); setWobble(null);
    setJamByToy(false); setWaits(0); setNudge(false); setUndone(0); setAttempt(0); setBlooms(0); setPhase('ready');
  };

  const step = Math.min(shown, order.length);
  const cues: Record<Phase, string> = {
    ready: w.ready, watch: attempt > 0 ? w.watchAgain : w.watch, copy: w.copy, bloom: w.bloom,
    jam: w.jamCue, undo: w.undo, reset: w.resetCue, done: w.finishTitle,
  };
  /** The line under the stage always says the next small step. */
  const lines: Record<Phase, string> = {
    ready: w.readyNext,
    watch: step > 0 ? oopsLine(w.watchStep, step, order.length, w.petals[order[step - 1]]) : w.watchNext,
    copy: opened.length > 0 ? oopsLine(w.copyNext, opened.length, order.length) : w.copyFirst,
    bloom: round + 1 < OOPS_ROUNDS ? w.bloomNext : w.bloomLast,
    jam: jamByToy ? w.jamToy : w.jam,
    // The petal to press next is the newest open one; its number is on it.
    undo: oopsLine(nudge ? w.undoWait : undone > 0 ? w.undoNext : w.undoFirst, opened.length),
    reset: w.reset, done: w.transfer,
  };
  const cue = cues[phase], status = lines[phase];
  // The showing is carried by the petals, their numerals and their tones; the bloom is a short beat.
  const quietBeat = phase === 'watch' || phase === 'bloom';
  const narration = phase === 'jam' || phase === 'reset' || (phase === 'undo' && (nudge || undone > 0)) ? status : cue;
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${round}:${phase}:${attempt}:${waits}`, enabled: phase !== 'done' && !quietBeat });
  const hinted = phase === 'undo' ? undoHint(opened, waits) : null;

  return <GameShell fullBleed autoNarrate={false} worldId="puzzle" title={w.title} instruction={w.instruction} hearIt={narration}>
    {phase === 'done'
      ? <GameFinish title={w.finishTitle} subtitle={w.transfer} onPlayAgain={() => reset(challenge)} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure adventure--bop adventure--oops" data-adventure="oops" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="adventure-toolbar">{phase === 'ready' && <ChallengePicker value={challenge} onChange={reset} words={shared} />}<AdventureSteps done={blooms} total={OOPS_ROUNDS} /></div>
        <AdventureHeading focusKey={`${round}:${phase}:${attempt}`} onHear={guide.replay} muted={guide.muted || quietBeat} hearLabel={w.hear}>{cue}</AdventureHeading>
        <div className="bop-stage oops-stage">
          <BopCheer beat={phase === 'bloom' ? blooms : null} big={phase === 'bloom' && blooms >= OOPS_ROUNDS} />
          <BopScene scene="scene-table" />
          <div className="oops-board">
            <span className="oops-hero" aria-hidden="true"><StudioPlayHero size={96} kick={presses} pose={phase === 'jam' ? 'oops' : 'idle'} celebrate={phase === 'bloom'} /></span>
            <BopFriend className="oops-friend" friend="chock" mood={phase === 'bloom' ? 'happy' : 'idle'} size={42} />
            {/* The toy is the same way round in both reading directions: petal 0 is always at the top, then clockwise. */}
            <div className="oops-toy" dir="ltr" role="group" aria-label={w.toy} data-bloom={phase === 'bloom'}>
              {PETALS.map(petal => {
                const place = order.indexOf(petal);
                const showing = phase === 'watch' && !folded && place > -1 && place < shown;
                const open = showing || phase === 'bloom' || opened.includes(petal);
                const half = stuck === petal;
                const live = phase === 'copy' ? !open : phase === 'undo' && open;
                return <button type="button" key={petal} className="bop-piece oops-petal" style={{ '--petal': petal } as CSSProperties} data-petal={petal} data-open={open} data-half={half} data-wobble={wobble === petal || (phase === 'jam' && half)} data-hint={hinted === petal} disabled={phase !== 'copy' && phase !== 'undo'} aria-disabled={!live} aria-pressed={open} aria-label={oopsLine(half ? w.petalStuck : open ? w.petalOpen : w.petalClosed, w.petals[petal])} onClick={() => press(petal)}>
                  {open && <i className="oops-pop" aria-hidden="true" />}
                  <BopSprite name={PETAL_ART[petal]} size={54} className="oops-petal__art" flat />
                  {showing && <span className="bop-chip oops-petal__chip">{String(place + 1)}</span>}
                  {/* B-GAME-46: while the petals go back, each open one shows when it opened, so "biggest number first" can be seen. */}
                  {(phase === 'jam' || phase === 'undo') && open && <span className="bop-chip oops-petal__chip" data-undo-number={opened.indexOf(petal) + 1}>{String(opened.indexOf(petal) + 1)}</span>}
                </button>;
              })}
              {/* B-GAME-46: the bloom has no rays (no glow in the kid register): the hub's teal ring and Chock's hop carry it. */}
              <span className="oops-hub" aria-hidden="true"><BopSprite name="oops-hub" size="100%" /></span>
            </div>
            <span className="oops-ahead" aria-hidden="true"><BopSprite name="chock-happy" size={1} flat /></span>
          </div>
        </div>
        {guide.muted && <p className="adventure-quiet">{w.quiet}</p>}
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions">
          {phase === 'ready'
            ? <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" aria-label={w.start} onClick={begin}><Play size={21} aria-hidden="true" />{w.start}</button>
            : <>
              <button type="button" className="oops-control" data-control="oops-pause" data-ready={phase === 'jam'} disabled={phase !== 'jam'} aria-label={w.pause} onClick={pause}>
                <span className="oops-control__pad"><BopSprite name="oops-pause" size={64} /></span><span className="oops-control__label">{w.pause}</span>
              </button>
              <button type="button" className="oops-control" data-control="oops-restart" data-ready={phase === 'reset'} disabled={phase !== 'reset'} aria-label={w.restart} onClick={restart}>
                <span className="oops-control__pad"><BopSprite name="oops-restart" size={64} /></span><span className="oops-control__label">{w.restart}</span>
              </button>
            </>}
        </div>
      </section>}
  </GameShell>;
}
