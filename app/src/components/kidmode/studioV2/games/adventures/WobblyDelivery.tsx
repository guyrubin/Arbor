import { useEffect, useRef, useState } from 'react';
import { Ear, Play } from 'lucide-react';
import { selectionHaptic } from '../../../../../lib/native';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useAdventureVoice } from './AdventureGuide';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, type Challenge } from './adventureRules';
import { BopFriend, BopScene, BopSprite } from './BopArt';
import { createBopTones, type BopTones } from './bopTones';
import { WOBBLY_DELIVERY_COPY, requestLine, type WobblyDeliveryWords } from './wobblyDeliveryCopy';
import { ASK_CARD_MS, BLOOM_MS, CARRY_MS, CARRY_STEP_MS, DELIVERY_FRIENDS, DELIVERY_ROUNDS, DELIVERY_TILES, OOPS_MS, THANKS_MS, askMs, cardsStayUp, deliveryPick, requestFor, shelfFor, tileTone, type DeliveryItem } from './wobblyDeliveryRules';
import './wobblyDelivery.css';

type Phase = 'ready' | 'ask' | 'fetch' | 'carry' | 'thanks' | 'bloom' | 'done';
/** Where the hero stands: 0 is home by the shelf, then one stop a tile, then the rug. */
const HOME = 0;
const RUG = DELIVERY_TILES.length + 1;
/** One small arc a step. Decoration only: the timers below move the game. */
const HOP: Keyframe[] = [{ transform: 'translateY(0)' }, { transform: 'translateY(-13%)', offset: .45 }, { transform: 'translateY(0)' }];

export default function WobblyDelivery() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = WOBBLY_DELIVERY_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile; const muted = useKidReadAloudMuted(child?.id ?? '');
  const [challenge, setChallengeState] = useState<Challenge>(() => defaultChallenge(child));
  const [round, setRoundState] = useState(0);
  const [request, setRequestState] = useState<DeliveryItem[]>(() => requestFor(defaultChallenge(child), 0));
  const [phase, setPhaseState] = useState<Phase>('ready');
  const [delivered, setDeliveredState] = useState<DeliveryItem[]>([]);
  const [others, setOthersState] = useState(0);
  const [shown, setShown] = useState(0);
  const [carried, setCarried] = useState<DeliveryItem | null>(null);
  const [stop, setStop] = useState(HOME);
  const [hops, setHops] = useState(0);
  const [oops, setOops] = useState(false);
  const [wobble, setWobble] = useState<DeliveryItem | null>(null);
  const [turn, setTurn] = useState(0);
  const [roundsDone, setRoundsDone] = useState(0);
  const [status, setStatus] = useState('');
  const tones = useRef<BopTones | null>(null);
  const hopper = useRef<HTMLSpanElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const oopsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timers outlive the render that set them, so they read the game from refs.
  const phaseRef = useRef<Phase>(phase), challengeRef = useRef<Challenge>(challenge), roundRef = useRef(round);
  const requestRef = useRef<DeliveryItem[]>(request), deliveredRef = useRef<DeliveryItem[]>(delivered), othersRef = useRef(others);
  const mutedRef = useRef(muted), wordsRef = useRef<WobblyDeliveryWords>(w);
  mutedRef.current = muted; wordsRef.current = w;
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };
  const setDelivered = (next: DeliveryItem[]) => { deliveredRef.current = next; setDeliveredState(next); };
  const setOthers = (next: number) => { othersRef.current = next; setOthersState(next); };
  /** A round: who waits, what they need, and an empty rug. */
  const setPlan = (level: Challenge, at: number, items: DeliveryItem[]) => {
    challengeRef.current = level; roundRef.current = at; requestRef.current = items;
    setChallengeState(level); setRoundState(at); setRequestState(items); setDelivered([]); setOthers(0);
  };

  const clearTimers = () => {
    timers.current.forEach(id => clearTimeout(id)); timers.current = [];
    if (oopsTimer.current !== null) clearTimeout(oopsTimer.current);
    oopsTimer.current = null;
  };
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

  /** One step of the carry: the hero moves to the next place and hops once. */
  const hopTo = (place: number) => {
    setStop(place); setHops(count => count + 1);
    const node = hopper.current;
    if (!node || typeof node.animate !== 'function' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    node.animate(HOP, { duration: CARRY_STEP_MS, easing: 'ease-out' });
  };
  /** Turns the cards face up, then face down again. The first time they come
   * one by one with the spoken request; when asked again they are all there. */
  const showRequest = (items: readonly DeliveryItem[], again: boolean) => {
    clearTimers(); setOops(false); setWobble(null); setCarried(null); setStop(HOME); setStatus('');
    setShown(again ? items.length : 1); setPhase('ask');
    if (!again) for (let card = 1; card < items.length; card++) later(() => setShown(card + 1), ASK_CARD_MS * card);
    later(() => { if (again) setStatus(wordsRef.current.goodAsking); setPhase('fetch'); }, askMs(items.length, mutedRef.current));
  };
  const begin = () => {
    if (phaseRef.current !== 'ready') return;
    void selectionHaptic(); kidSfx('tap'); showRequest(requestRef.current, false);
  };
  /** Asking is the clever move here: no limit, and nothing is taken away. */
  const askAgain = () => {
    if (phaseRef.current !== 'fetch') return;
    void selectionHaptic(); kidSfx('tap'); setTurn(count => count + 1); showRequest(requestRef.current, true);
  };
  const afterThanks = () => {
    const at = roundRef.current + 1;
    if (at >= DELIVERY_ROUNDS) { setPhase('bloom'); later(() => setPhase('done'), BLOOM_MS); return; }
    const items = requestFor(challengeRef.current, at);
    setPlan(challengeRef.current, at, items); showRequest(items, false);
  };
  const land = (item: DeliveryItem, last: boolean) => {
    setCarried(null); setDelivered([...deliveredRef.current, item]);
    if (!last) { setStop(HOME); setPhase('fetch'); return; }
    kidSfx('correct'); setRoundsDone(roundRef.current + 1); setPhase('thanks'); later(afterThanks, THANKS_MS);
  };
  const pick = (item: DeliveryItem) => {
    if (phaseRef.current !== 'fetch') return;
    void selectionHaptic();
    const result = deliveryPick(requestRef.current, deliveredRef.current, item);
    if (result === 'repeat' || result === 'other') {
      // Nothing is lost and nothing locks: the toy wobbles, the hero shrugs
      // it off, and the same request is still waiting.
      if (result === 'other') setOthers(othersRef.current + 1);
      kidSfx('tryAgain'); setStatus(w.notYet); setTurn(count => count + 1); setWobble(item); setOops(true);
      if (oopsTimer.current !== null) clearTimeout(oopsTimer.current);
      oopsTimer.current = setTimeout(() => { oopsTimer.current = null; setOops(false); setWobble(null); }, OOPS_MS);
      return;
    }
    clearTimers(); kidSfx('tap'); setOops(false); setWobble(null); setStatus('');
    setCarried(item); setPhase('carry'); setHops(count => count + 1);
    const before = deliveredRef.current.length;
    DELIVERY_TILES.forEach((_, tile) => later(() => { hopTo(tile + 1); tones.current?.play(tileTone(before, tile)); }, CARRY_STEP_MS * (tile + 1)));
    later(() => hopTo(RUG), CARRY_STEP_MS * RUG);
    later(() => land(item, result === 'complete'), CARRY_MS);
  };
  const reset = (level: Challenge) => {
    clearTimers(); tones.current?.stop(); setPlan(level, 0, requestFor(level, 0));
    setShown(0); setCarried(null); setStop(HOME); setOops(false); setWobble(null); setRoundsDone(0); setStatus(''); setPhase('ready');
  };

  const shelf = shelfFor(challenge, round);
  const friend = DELIVERY_FRIENDS[round], nextFriend = round + 1 < DELIVERY_ROUNDS ? DELIVERY_FRIENDS[round + 1] : null;
  const celebrate = phase === 'thanks' || phase === 'bloom';
  // Short beats that the tones and the stage carry: the voice waits for the next prompt.
  const busy = phase === 'carry' || celebrate;
  const cardsUp = cardsStayUp(others) || celebrate;
  const left = request.length - delivered.length;
  // The heading carries the request only while the cards are up: during the
  // fetch it asks, so the cards and the Ask again button do the remembering.
  const cue = phase === 'ready' ? w.ready : phase === 'ask' ? requestLine(w, round, request) : phase === 'thanks' ? w.thanks[round] : phase === 'bloom' ? w.bloom : phase === 'done' ? w.finishTitle
    : delivered.length === 0 ? w.fetchFirst[round] : left === 1 ? w.fetchLast : w.fetchNext;
  const narration = status || cue;
  const guide = useAdventureVoice({ childId: child?.id ?? '', lang, text: narration, cueKey: `${round}:${phase}:${turn}:${status}`, enabled: !busy && phase !== 'done' });

  return <GameShell fullBleed autoNarrate={false} worldId="memory" title={w.title} instruction={w.instruction} hearIt={narration}>
    {phase === 'done'
      ? <GameFinish title={w.finishTitle} subtitle={w.transfer} onPlayAgain={() => reset(challenge)} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure adventure--bop adventure--delivery" data-adventure="delivery" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="adventure-toolbar">{phase === 'ready' && <ChallengePicker value={challenge} onChange={reset} words={shared} />}<AdventureSteps done={roundsDone} total={DELIVERY_ROUNDS} /></div>
        <AdventureHeading focusKey={`${round}:${phase === 'carry' ? 'fetch' : phase}`} onHear={guide.replay} muted={guide.muted || busy}>{cue}</AdventureHeading>
        <div className="bop-stage delivery-stage" data-phase={phase} data-shelf={shelf.length}>
          <BopScene scene="scene-delivery" />
          <div className="delivery-board">
            <div className="delivery-shelf" role="group" aria-label={w.shelf}>
              {shelf.map(item => <button type="button" key={item} className="bop-piece delivery-item" data-item={item} data-away={carried === item || delivered.includes(item)} data-wobble={wobble === item}
                disabled={phase !== 'fetch' && phase !== 'carry'} aria-disabled={phase !== 'fetch'} aria-label={delivered.includes(item) ? `${w.items[item]}. ${w.onRug}` : w.items[item]} onClick={() => pick(item)}>
                <BopSprite name={item} />
              </button>)}
            </div>
            {DELIVERY_TILES.map((tile, index) => <span key={tile} className="delivery-tile" data-tile={index} data-lit={phase === 'carry' && stop === index + 1} aria-hidden="true"><BopSprite name={tile} flat /></span>)}
            <span className="delivery-flower" data-open={phase === 'bloom'} aria-hidden="true">
              <BopSprite name="flower-folded" className="delivery-flower__folded" />
              <BopSprite name="flower-open" className="delivery-flower__open" />
            </span>
            <span className="delivery-rug" aria-hidden="true"><BopSprite name="rest-rug" flat /></span>
            <BopFriend friend={friend} mood={celebrate ? 'happy' : 'idle'} size={46} className="delivery-friend" />
            <div className="delivery-landed" role="img" aria-label={`${w.rug[round]}: ${delivered.length ? delivered.map(item => w.items[item]).join(w.listJoin) : w.rugEmpty}`}>
              {delivered.map((item, slot) => <span key={item} data-slot={slot}><BopSprite name={item} /></span>)}
            </div>
            {phase !== 'ready' && <div className="delivery-cards" data-cards={request.length} role="group" aria-label={w.cards}>
              {request.map((item, index) => {
                if (phase === 'ask' && index >= shown) return <span key={index} className="delivery-card" data-up={false} data-waiting={true} aria-hidden="true"><b className="bop-chip">{index + 1}</b></span>;
                const up = phase === 'ask' || cardsUp || index < delivered.length;
                return <span key={index} className="delivery-card" data-up={up} data-done={index < delivered.length} data-next={phase === 'fetch' && index === delivered.length} role="img" aria-label={`${w.card} ${index + 1}: ${up ? w.items[item] : w.faceDown}`}>
                  <b className="bop-chip" aria-hidden="true">{index + 1}</b>
                  {up ? <BopSprite name={item} flat /> : <i className="delivery-card__back" aria-hidden="true" />}
                </span>;
              })}
            </div>}
            <span className="delivery-hero" data-stop={stop} aria-hidden="true">
              <span className="delivery-hopper" ref={hopper}>
                <StudioPlayHero size={100} kick={hops} pose={phase === 'carry' ? 'hold-up' : oops ? 'oops' : 'idle'} celebrate={celebrate} />
                {carried !== null && <span className="delivery-carried"><BopSprite name={carried} /></span>}
              </span>
            </span>
            {/* The next pictures are fetched ahead, so a happy friend never arrives late. */}
            <span className="delivery-ahead" aria-hidden="true">
              <BopSprite name={`${friend}-happy`} flat />
              {nextFriend !== null && <BopSprite name={`${nextFriend}-idle`} flat />}
            </span>
          </div>
        </div>
        {muted && <p className="adventure-quiet">{w.quiet}</p>}
        <p className="adventure-status" role="status">{status}</p>
        <div className="adventure-actions">
          {phase === 'ready'
            ? <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" aria-label={w.start} onClick={begin}><Play size={21} aria-hidden="true" />{w.start}</button>
            : <button type="button" className="studio-game-button-v2 delivery-ask" aria-label={w.askAgain} data-hint={phase === 'fetch' && status === w.notYet} disabled={phase !== 'fetch' && phase !== 'carry'} aria-disabled={phase !== 'fetch'} onClick={askAgain}><Ear size={20} aria-hidden="true" />{w.askAgain}</button>}
        </div>
      </section>}
  </GameShell>;
}
