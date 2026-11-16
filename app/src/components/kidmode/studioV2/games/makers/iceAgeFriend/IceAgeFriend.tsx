import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, Binoculars, Camera, DoorOpen, Footprints, Hand, Moon, Ruler, Snowflake, Wheat, Wind, type LucideIcon } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import {
  CAMERA_HOME, HudButton, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, prefersReducedMotion, roundSeed, useShake,
  type CoachMood, type CoachWho, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { ICE_AGE_FRIEND_COPY } from './iceAgeFriendCopy';
import { DISCOVERIES, discover, type DiscoveryId } from './iceAgeFriendRules';
import { STEP_FACT, chapterOf, endsChapter, finishStep, nextStep, planRound, questFor, type Round, type StepId } from './mammothStory';
import { createMammothEngine, type Cue, type FxKind, type MammothEngine } from './mammothEngine';
import { createMammothSound, type MammothSound } from './mammothAudio';
import { CrewLayer, HallLayer, HintHand, Photo, Print, Watchers } from './HallArt';
import type { FriendId } from './mammothArt';
import '../makerPalette.css';
import './iceAgeFriend.css';

type Phase = 'opening' | 'play' | 'setPiece';
type Note = { who: CoachWho; mood: CoachMood; line: string };
type CaptionId = 'call' | 'answer' | 'aurora' | 'stars';
/** Who speaks for each step: the tool's owner, or the friend whose way of being it is. */
const STEP_COACH: Readonly<Record<StepId, { who: CoachWho; mood: CoachMood }>> = {
  frost: { who: 'bebe', mood: 'curious' }, hello: { who: 'gobgob', mood: 'curious' }, trace: { who: 'bebe', mood: 'idle' },
  brush: { who: 'aya', mood: 'curious' }, feed: { who: 'gobgob', mood: 'idle' }, part: { who: 'bebe', mood: 'curious' },
  scout: { who: 'pep', mood: 'curious' }, walk: { who: 'chock', mood: 'idle' }, low: { who: 'bebe', mood: 'curious' },
};
const STEP_ICON: Readonly<Record<StepId, LucideIcon>> = { frost: Snowflake, hello: Hand, trace: Ruler, brush: Wind, feed: Wheat, part: Camera, scout: Binoculars, walk: Footprints, low: ArrowDownToLine };
/** What each kind of small thing is made of here: frost, snow, ice and dry grass. */
const FX_TONES: Readonly<Record<FxKind, readonly string[]>> = {
  sparkle: ['white', 'butter', 'sky-pale'], dust: ['snow', 'white', 'snow-shade'], drop: ['sky-pale', 'white', 'sky'], glint: ['white', 'butter'], ring: ['white'], petal: ['sand', 'wood-light', 'butter'],
};
/** The last visit's weather and stars, kept only while the app is open, so the next visit looks different. Nothing about the child. */
let lastRound: Round | null = null;

/** Woolly Mammoth: the giant behind the glass. In the dim glass hall of
 * Horizon Dome the child wipes the frost from a great pane and an eye looks
 * back. They say hello through the glass and measure its tusk; the glass
 * gives way to the Ice Age steppe, where they brush the snow from its back,
 * offer it grass and photograph its two coats; then they find its herd, walk
 * with it there and look up at it from a calf's height. At night the herd
 * answers its call, the aurora comes, and the child's five pictures hang in
 * the sky. Nothing about how the child played is kept. */
export default function IceAgeFriend() {
  const [visit, setVisit] = useState(0);
  return <Visit key={visit} onAgain={() => setVisit(n => n + 1)} />;
}

function Visit({ onAgain }: { onAgain(): void }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en', rtl = lang === 'he';
  const w = ICE_AGE_FRIEND_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const muted = useKidReadAloudMuted(child?.id ?? '');
  const round = useMemo(() => { lastRound = planRound(roundSeed(), lastRound); return lastRound; }, []);
  const [phase, setPhase] = useState<Phase>('opening');
  const [step, setStep] = useState<StepId | null>(null);
  const [chapterStep, setChapterStep] = useState<StepId>('frost');
  const [doneSteps, setDoneSteps] = useState<StepId[]>([]);
  const [found, setFound] = useState<DiscoveryId[]>([]);
  const [print, setPrint] = useState<DiscoveryId | null>(null);
  const [gate, setGate] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  const [lensReady, setLensReady] = useState(false);
  const [secret, setSecret] = useState(false);
  const [caption, setCaption] = useState<CaptionId>('call');
  const [nightReady, setNightReady] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [stageCam, setStageCam] = useState<PlayCamera>(CAMERA_HOME);
  const [outside, setOutside] = useState(false);
  const [shake, bump] = useShake();
  const [done, setDone] = useState(false);
  const worldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const fx = useRef<PlayFxHandle>(null);
  const engine = useRef<MammothEngine | null>(null);
  const sound = useRef<MammothSound | null>(null);
  const play = useRef<PlaySound | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printNow = useRef<DiscoveryId | null>(null);
  const waiting = useRef<StepId | null>(null);
  const chain = useRef(0);

  const later = (run: () => void, ms: number) => { const id = setTimeout(() => { timers.current.delete(id); run(); }, ms); timers.current.add(id); };
  const say = (next: Note, ms = 3600) => {
    setNote(next);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), ms);
  };
  const startStep = (next: StepId) => {
    setNote(null); setLensReady(false); setStep(next); setChapterStep(next);
    engine.current?.task(next);
  };
  /** A step is over: its pip fills, the crew is glad, and the story moves on. */
  const advance = (finished: StepId) => {
    setDoneSteps(list => finishStep(list, finished));
    setStep(null); setCheer(n => n + 1);
    play.current?.place(chain.current++);
    if (!endsChapter(finished)) {
      if (finished === 'hello') say({ who: 'gobgob', mood: 'happy', line: w.say.helloDone }, 1500);
      if (finished === 'brush') say({ who: 'aya', mood: 'happy', line: w.say.brushDone }, 1700);
      const next = nextStep(finished);
      if (next) later(() => startStep(next), finished === 'frost' ? 900 : 1500);
      return;
    }
    // The end of a chapter: a flourish, and the way on.
    play.current?.chapter(); fx.current?.burst(0.5, 0.4, 'sparkle', { count: 22, spread: 1.8, tones: FX_TONES.sparkle });
    const chapter = chapterOf(finished);
    if (chapter === 'meet') { setGate(true); return; }
    if (chapter === 'care') { say({ who: 'aya', mood: 'happy', line: w.say.careDone }, 2400); later(() => startStep('scout'), 2400); return; }
    later(() => {
      setPhase('setPiece'); setCaption('call'); play.current?.ambience('night'); play.current?.setPiece();
      engine.current?.task('finale');
    }, 900);
  };
  const handlers = useRef({
    step: (_finished: StepId) => {}, shot: (_id: DiscoveryId) => {}, eye: () => {}, secret: () => {}, cue: (_cue: Cue, _index?: number) => {},
  });
  handlers.current = {
    step: finished => {
      // A step that ends in a picture waits for the child to keep the print.
      if (printNow.current) { waiting.current = finished; return; }
      advance(finished);
    },
    shot: id => {
      printNow.current = id;
      setFound(list => discover(list, id)); setPrint(id); setLensReady(false);
      engine.current?.hold(true);
      play.current?.pick();
    },
    eye: () => {
      // The moment of awe: everything holds its breath, and the camera leans in.
      void hitPause(140); bump();
      say({ who: 'bebe', mood: 'wow', line: w.say.eye }, 3800);
      if (!prefersReducedMotion()) { setStageCam({ x: 0.5, y: 0.4, zoom: 1.22 }); later(() => setStageCam(CAMERA_HOME), 2100); }
      play.current?.note(5, { gain: 0.05, length: 1.6, attack: 0.06 }); play.current?.note(8, { gain: 0.035, length: 1.4, attack: 0.06, at: 0.12 });
    },
    secret: () => { setSecret(true); say({ who: 'aya', mood: 'wow', line: w.say.secret }, 4200); later(() => setSecret(false), 6500); },
    cue: (cue, index) => {
      switch (cue) {
        case 'thump': bump(); break;
        case 'waiting': say({ who: 'gobgob', mood: 'idle', line: w.say.waiting }, 5000); break;
        case 'lensReady': setLensReady(true); say({ who: 'bebe', mood: 'wow', line: w.say.lensReady }, 6000); break;
        case 'calf': say({ who: 'pep', mood: 'wow', line: w.say.calf }, 3200); break;
        case 'throughHalf': setStageCam(CAMERA_HOME); setOutside(true); play.current?.ambience('wind'); break;
        case 'steppe': say({ who: 'aya', mood: 'wow', line: w.say.steppe }, 2200); break;
        case 'call': bump(); setCaption('call'); break;
        case 'answer': setCaption('answer'); break;
        case 'aurora': setCaption('aurora'); break;
        case 'star': setCaption('stars'); play.current?.place(index ?? 0); break;
        case 'finaleReady': setNightReady(true); break;
      }
    },
  };

  useEffect(() => {
    const host = worldRef.current, canvas = canvasRef.current;
    if (done || !host || !canvas) return;
    const audio = createMammothSound(), kit = createPlaySound({ key: 'D' });
    sound.current = audio; play.current = kit;
    let started = false;
    host.style.setProperty('--iaf-light', '0');
    const live = createMammothEngine({ stage: host, canvas, ghost: ghostRef.current, ripple: rippleRef.current }, {
      onGesture: () => { if (!started) { started = audio.start(); if (started) kit.ambience(live.scene() === 'hall' ? 'hall' : 'wind'); } },
      onTick: () => { void selectionHaptic(); },
      onStep: finished => handlers.current.step(finished),
      onShot: id => handlers.current.shot(id),
      onEye: () => handlers.current.eye(),
      onSecret: () => handlers.current.secret(),
      onCue: (cue, index) => handlers.current.cue(cue, index),
      onFx: (kind, x, y, count) => fx.current?.burst(x, y, kind, { count, tones: FX_TONES[kind] }),
      onLight: level => host.style.setProperty('--iaf-light', level.toFixed(3)),
    }, audio, { reduced: prefersReducedMotion(), round, faceRight: rtl, rtl });
    engine.current = live;
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => live.setReduced(!!query?.matches);
    query?.addEventListener?.('change', onMotion);
    const pending = timers.current;
    return () => {
      query?.removeEventListener?.('change', onMotion);
      for (const id of pending) clearTimeout(id);
      pending.clear();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      live.dispose(); audio.dispose(); kit.dispose(); engine.current = null; sound.current = null; play.current = null;
    };
    // The scene is built once for a visit; the language of a visit does not change under it.
  }, [done, round]);
  useEffect(() => { if (muted) sound.current?.stop(); }, [muted]);

  const keepPrint = () => {
    if (!printNow.current) return;
    printNow.current = null; setPrint(null);
    engine.current?.hold(false);
    play.current?.place(chain.current);
    const finished = waiting.current; waiting.current = null;
    if (finished) advance(finished);
  };
  const goThrough = () => {
    if (!gate) return;
    setGate(false); void selectionHaptic(); play.current?.pick();
    if (!prefersReducedMotion()) setStageCam({ x: 0.5, y: 0.44, zoom: 1.7 });
    engine.current?.through(() => startStep('brush'));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const live = engine.current; if (!live || e.target !== e.currentTarget) return;
    const keys: Record<string, () => void> = {
      Enter: () => live.step(), ' ': () => live.step(),
      ArrowLeft: () => live.nudge(-1, 0), ArrowRight: () => live.nudge(1, 0), ArrowUp: () => live.nudge(0, -1), ArrowDown: () => live.nudge(0, 1),
    };
    const run = keys[e.key]; if (!run) return;
    e.preventDefault(); run();
  };

  const quest = questFor(step ?? chapterStep, doneSteps);
  const base: Note = phase === 'opening' ? { who: 'bebe', mood: 'curious', line: w.say.opening }
    : print ? { who: STEP_COACH[chapterStep].who, mood: 'happy', line: w.say.print }
      : gate ? { who: 'aya', mood: 'happy', line: w.say.through }
        : step ? { ...STEP_COACH[step], line: w.say[step] }
          : { ...STEP_COACH[chapterStep], mood: 'happy', line: '' };
  const coach = !print && note ? note : base;
  const fact = print ? w.facts[print] : null;
  const side = rtl ? 'right' : 'left';

  return <GameShell fullBleed autoNarrate={false} worldId="ice-age-friend" title={w.title} instruction={w.instruction}>
    <section data-adventure="ice-age-friend" data-iaf-phase={phase} data-iaf-step={step ?? ''} dir={rtl ? 'rtl' : 'ltr'}>
      {done ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={onAgain} playAgainLabel={shared.again} homeLabel={shared.home} /> : <PlayStage id="ice-age-friend" grade="day" camera={stageCam} shake={shake} parallax
        world={<>
          <div ref={worldRef} className="iaf-world" dir="ltr" tabIndex={0} role="group" aria-label={w.stage} aria-describedby="iaf-keys" onKeyDown={onKey} data-outside={outside || undefined}>
            <canvas ref={canvasRef} className="iaf-canvas" aria-hidden="true" />
            <HallLayer />
            <CrewLayer names={w.friends} cheer={cheer} side={side} onFriend={(id: FriendId) => { void selectionHaptic(); engine.current?.greet(id); }} />
            {phase === 'setPiece' && <Watchers side={side} />}
            <span id="iaf-keys" className="iaf-sr">{w.keys}</span>
            <span ref={rippleRef} className="iaf-ripple" aria-hidden="true" />
            <HintHand handRef={ghostRef} />
          </div>
          <PlayFx ref={fx} layer={6} />
        </>}>
        {phase === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={() => { setPhase('play'); startStep('frost'); }} />}
        <HudCoach who={coach.who} mood={coach.mood} line={coach.line} pokeLabel={w.friends[coach.who]} onPoke={() => { void selectionHaptic(); play.current?.tap(); engine.current?.greet(coach.who); setCheer(n => n + 1); }} />
        <HudQuest label={w.questLabel} current={quest.current} steps={quest.steps.map(item => { const Icon = STEP_ICON[item.id]; return { key: item.id, label: w.steps[item.id], done: item.done, icon: <Icon aria-hidden="true" /> }; })} />
        {found.length > 0 && !print && phase !== 'setPiece' && <ul className="iaf-album" aria-label={w.album} dir={rtl ? 'rtl' : 'ltr'}>
          {DISCOVERIES.filter(id => found.includes(id)).map(id => <li key={id} aria-label={w.facts[id].title}><Photo source={engine.current?.photo(id) ?? null} size={96} /></li>)}
        </ul>}
        <HudToast show={secret && phase !== 'setPiece' && !print}>{w.secretNote}</HudToast>
        {print && fact && <button type="button" className="iaf-print-wrap" onClick={keepPrint} aria-label={w.dock.keep}>
          <Print id={print} source={engine.current?.photo(print) ?? null} title={fact.title} text={fact.text} tool={w.tools[print]} rtl={rtl} />
        </button>}
        <HudDock>
          {print && <HudButton label={w.dock.keep} tone="go" size="l" onClick={keepPrint} data={{ 'data-iaf-keep': '' }} />}
          {!print && gate && <HudButton label={w.dock.through} tone="go" size="l" cue icon={<DoorOpen aria-hidden="true" />} onClick={goThrough} data={{ 'data-iaf-through': '' }} />}
          {!print && step === 'part' && lensReady && <HudButton label={w.dock.snap} tone="go" size="l" cue icon={<Camera aria-hidden="true" />} onClick={() => { void selectionHaptic(); engine.current?.snap(); }} data={{ 'data-iaf-snap': '' }} />}
          {!print && step === 'walk' && <HudButton label={w.dock.walk} tone="paper" icon={<Footprints aria-hidden="true" />} onClick={() => { void selectionHaptic(); engine.current?.step(); }} data={{ 'data-iaf-walk': '' }} />}
          {!print && step === 'low' && <HudButton label={w.dock.lower} tone="paper" icon={<ArrowDownToLine aria-hidden="true" />} onClick={() => { void selectionHaptic(); engine.current?.step(); }} data={{ 'data-iaf-lower': '' }} />}
        </HudDock>
        <PlaySetPiece active={phase === 'setPiece'} caption={w.captions[caption]}>
          {nightReady && <HudButton label={w.dock.night} tone="go" size="l" icon={<Moon aria-hidden="true" />} onClick={() => { void selectionHaptic(); setDone(true); }} data={{ 'data-iaf-night': '' }} />}
        </PlaySetPiece>
      </PlayStage>}
    </section>
  </GameShell>;
}
