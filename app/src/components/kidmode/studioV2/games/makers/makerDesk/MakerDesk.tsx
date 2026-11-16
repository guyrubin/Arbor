import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { HERO_NAME_FALLBACK } from '../../../../../../lib/heroNameFallback';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { studioCopy } from '../../../studioCopy';
import { useStudioCreations, type StudioCreation } from '../../../studioCreations';
import { CreationPreview } from '../../../StudioCreationResult';
import { useStudioHero } from '../../../useStudioHero';
import { createDeskAudio, type DeskAudio } from './deskAudio';
import { DeskBounce } from './DeskBounce';
import { ICON_BOUNCE, ICON_TERMINAL, ICON_THINGS, DeskWallpaper, PixelArt, PixelClock } from './DeskPixels';
import { DeskRoomArt } from './DeskRoomArt';
import { DeskTerminal } from './DeskTerminal';
import { DeskThing } from './DeskThing';
import { MAKER_DESK_COPY, deskLine } from './makerDeskCopy';
import {
  NO_DISCOVERY, PROGRAMS, ROOM, STICKERS, allStickers, backTarget, isThingKind, noteCommand, noteLanterns, noteThings, openProgram, shelfPlaces, skyPicture,
  stepBack, stickerLit, switchOn, thingKinds, type Discovery, type Level, type Program, type Sticker, type ThingKind,
} from './makerDeskRules';
import '../makerPalette.css';
import './makerDesk.css';

/** Warm-up glow, then the zoom into the screen. Plain timers: the game never
 * waits for an animation to end, so it plays the same with motion off. */
const WARM_MS = 1050;
const WARM_AGAIN_MS = 650;
const ZOOM_BACK_MS = 560;
const BIRD_AFTER_MS = [3500, 7500] as const;
const BIRD_STAYS_MS = 6000;
const PROGRAM_ICON: Record<Program, readonly string[]> = { bounce: ICON_BOUNCE, things: ICON_THINGS, ask: ICON_TERMINAL };
/** The six shelf places on the drawing (360 by 420): two planks, three each. */
const SHELF_SLOTS = [[220, 172], [270, 172], [320, 172], [220, 238], [270, 238], [320, 238]] as const;
/** Each desk sticker is a tiny pixel picture of its discovery: a lantern, a star, a prompt. */
const STICKER_ART: Record<Sticker, readonly string[]> = {
  lanterns: ['..aaa..', '.abbba.', '.abyba.', '.abyba.', '.abbba.', '..aaa..', '...a...'],
  things: ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'],
  commands: ['g......', '.g.....', '..g....', '.g.....', 'g......', '.......', '...bbbb'],
};

function reducedMotion(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export default function MakerDesk() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = MAKER_DESK_COPY[lang], shared = ADVENTURE_COPY[lang], studio = studioCopy(lang);
  const childId = useArborOptional()?.childProfile?.id ?? '';
  const muted = useKidReadAloudMuted(childId);
  // Only the current child's own creations: the hook scopes them to owner and child.
  const saved = useStudioCreations(childId);
  const hero = useStudioHero();
  const [level, setLevelState] = useState<Level>(ROOM);
  const [warming, setWarming] = useState(false);
  const [computerOn, setComputerOn] = useState(false);
  const [zoomBack, setZoomBack] = useState(false);
  const [light, setLight] = useState<'day' | 'evening'>('day');
  const [blind, setBlind] = useState<'open' | 'closed'>('open');
  const [bird, setBird] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [opened, setOpened] = useState<ThingKind | null>(null);
  const [discovery, setDiscovery] = useState<Discovery>(NO_DISCOVERY);
  const [status, setStatus] = useState('');
  const [finished, setFinished] = useState(false);
  const levelRef = useRef<Level>(level), discoveryRef = useRef(discovery), warmingRef = useRef(false), openedRef = useRef<ThingKind | null>(null);
  levelRef.current = level; discoveryRef.current = discovery; openedRef.current = opened;
  const audio = useRef<DeskAudio | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const backTab = useRef<HTMLButtonElement>(null), computerButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  const later = (ms: number, act: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); act(); }, ms);
    timers.current.push(id);
  };
  const setLevel = (next: Level) => { levelRef.current = next; moved.current = true; setLevelState(next); };
  useEffect(() => {
    const instance = createDeskAudio(); audio.current = instance;
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; instance.dispose(); audio.current = null; };
  }, []);
  // The quiet CRT hum, only while the computer fills the view and sound is on.
  useEffect(() => { audio.current?.hum(level.at !== 'study' && !muted); }, [level.at, muted]);
  useEffect(() => { if (muted) audio.current?.stop(); }, [muted]);

  /** One step back: program → desktop → room. */
  const back = () => {
    const now = levelRef.current;
    if (now.at === 'study') return;
    void selectionHaptic();
    const next = stepBack(now);
    setOpened(null); setStatus('');
    if (next.at === 'study') { setZoomBack(!reducedMotion()); later(ZOOM_BACK_MS, () => setZoomBack(false)); }
    setLevel(next);
  };
  const backRef = useRef(back); backRef.current = back;
  // Escape steps back too. The Kid Mode overlay swallows Escape at the
  // document, so this listens on the window, first, and lets it carry on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (openedRef.current) { setOpened(null); return; }
      if (levelRef.current.at !== 'study') backRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Focus follows the level: the step-back tab inside the computer, the computer in the room.
  useEffect(() => {
    if (!moved.current) return;
    (level.at === 'study' ? computerButton.current : backTab.current)?.focus({ preventScroll: true });
  }, [level]);
  // Now and then a bird lands outside the open window.
  useEffect(() => {
    if (blind !== 'open' || level.at !== 'study' || finished) { setBird(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    const land = () => { setBird(true); setStatus(w.bird); timer = setTimeout(leave, BIRD_STAYS_MS); };
    const leave = () => { setBird(false); timer = setTimeout(land, BIRD_AFTER_MS[0] + Math.random() * (BIRD_AFTER_MS[1] - BIRD_AFTER_MS[0])); };
    timer = setTimeout(land, BIRD_AFTER_MS[0] + Math.random() * (BIRD_AFTER_MS[1] - BIRD_AFTER_MS[0]));
    return () => clearTimeout(timer);
  }, [blind, level.at, finished, w.bird]);

  const discover = (next: Discovery) => {
    const before = discoveryRef.current;
    if (next === before) return;
    discoveryRef.current = next; setDiscovery(next);
    if (!allStickers(before) && allStickers(next)) {
      // The computer plays its tiny fanfare and the Done tab appears in the room.
      later(levelRef.current.at === 'program' && levelRef.current.program === 'bounce' ? 2600 : 200, () => { audio.current?.fanfare(); setStatus(levelRef.current.at === 'study' ? w.allStickers : w.doneWaiting); });
    }
  };

  const tapComputer = () => {
    if (levelRef.current.at !== 'study' || warmingRef.current) return;
    void selectionHaptic(); warmingRef.current = true; setWarming(true); setShelfOpen(false); setStatus(w.switching);
    if (!computerOn) audio.current?.power(); else audio.current?.key();
    setComputerOn(true);
    later(reducedMotion() ? 120 : computerOn ? WARM_AGAIN_MS : WARM_MS, () => { warmingRef.current = false; setWarming(false); setStatus(''); setLevel(switchOn(levelRef.current)); });
  };
  const tapLamp = () => {
    void selectionHaptic(); audio.current?.key();
    const next = light === 'day' ? 'evening' : 'day';
    setLight(next); setStatus(next === 'evening' ? w.roomEvening : '');
  };
  const tapWindow = () => { void selectionHaptic(); setBlind(now => now === 'open' ? 'closed' : 'open'); setStatus(''); };
  const tapShelf = () => {
    void selectionHaptic(); audio.current?.key();
    const next = !shelfOpen; setShelfOpen(next);
    setStatus(!next ? '' : kinds.length ? kinds.map(kind => w.kinds[kind]).join(' · ') : w.shelfTag);
  };
  const open = (program: Program) => {
    void selectionHaptic(); audio.current?.key();
    setLevel(openProgram(levelRef.current, program)); setStatus('');
    if (program === 'things') discover(noteThings(discoveryRef.current));
  };
  const reset = () => {
    for (const id of timers.current) clearTimeout(id); timers.current = []; warmingRef.current = false;
    setLevel(ROOM); setWarming(false); setComputerOn(false); setZoomBack(false); setLight('day'); setBlind('open'); setBird(false);
    setShelfOpen(false); setOpened(null); setDiscovery(NO_DISCOVERY); discoveryRef.current = NO_DISCOVERY; setStatus(''); setFinished(false);
  };

  const items = saved.items.filter(item => isThingKind(item.creation.kind));
  const byKind = new Map<ThingKind, StudioCreation>(items.map(item => [item.creation.kind as ThingKind, item.creation]));
  const kinds = thingKinds(items.map(item => item.creation.kind));
  const greet = { word: studio.hello, noName: studio.helloNoName, name: hero.name && hero.name !== HERO_NAME_FALLBACK ? hero.name : null };
  const done = allStickers(discovery);
  const sky = skyPicture(new Date().getHours());
  const target = backTarget(level);
  const targetName = target === 'study' ? w.toDesk : w.toDesktop;
  const program = level.at === 'program' ? level.program : null;
  const cue = level.at === 'study' ? (done ? w.allStickers : light === 'evening' ? w.roomEvening : w.roomCue)
    : program === 'bounce' ? w.bounceCue : program === 'things' ? w.thingsCue : program === 'ask' ? w.terminalCue : w.desktopCue;

  const stickers = (where: 'onDesk' | 'onChin') => <div className={`md-stickers md-stickers--${where}`} role="group" aria-label={w.stickers}>
    {STICKERS.map(sticker => {
      const on = stickerLit(discovery, sticker);
      return <span key={sticker} className="md-sticker" data-sticker={sticker} data-lit={on} role="img" aria-label={deskLine(on ? w.stickerLit : w.stickerDim, w.stickerNames[sticker])}>
        <PixelArt rows={STICKER_ART[sticker]} className="md-sticker__art" />
      </span>;
    })}
    {where === 'onDesk' && done && <button type="button" className="md-done" data-maker-desk-done="" onClick={() => { void selectionHaptic(); setFinished(true); }}><Check size={20} strokeWidth={3} aria-hidden="true" />{w.done}</button>}
  </div>;

  const room = () => <div className="md-room" data-warming={warming} data-zoom-back={zoomBack}>
    <div className="md-room__scene" dir="ltr">
      <DeskRoomArt look={{ light, blind, bird, screen: warming ? 'warming' : computerOn ? 'on' : 'off' }} />
      <div className="md-shelf" data-open={shelfOpen} aria-hidden="true">
        {shelfPlaces(kinds).map((kind, index) => {
          const [x, y] = SHELF_SLOTS[index];
          const creation = kind ? byKind.get(kind) : undefined;
          return <span key={index} className="md-shelf__place" data-kind={kind ?? 'empty'} style={{ insetInlineStart: `${(x - 24) / 3.6}%`, insetBlockStart: `${(y - 50) / 4.2}%` }}>
            {creation && kind ? <DeskThing creation={creation} label={w.kinds[kind]} /> : <span className="md-shelf__stand" />}
          </span>;
        })}
        <span className="md-shelf__tag"><span dir={lang === 'he' ? 'rtl' : 'ltr'}>{w.shelfTag}</span></span>
      </div>
      {stickers('onDesk')}
      <button type="button" ref={computerButton} className="md-spot md-spot--computer" data-spot="pc" data-hint={!computerOn} aria-label={warming ? w.computerWarm : w.computer} onClick={tapComputer} />
      <button type="button" className="md-spot md-spot--shelf" data-spot="shelf" aria-pressed={shelfOpen} aria-label={kinds.length ? `${shelfOpen ? w.shelfOpen : w.shelf}: ${kinds.map(kind => w.kinds[kind]).join(', ')}` : `${w.shelfEmpty}. ${w.shelfTag}`} onClick={tapShelf} />
      <button type="button" className="md-spot md-spot--lamp" data-spot="lamp" aria-pressed={light === 'evening'} aria-label={light === 'day' ? w.lampDay : w.lampEvening} onClick={tapLamp} />
      <button type="button" className="md-spot md-spot--window" data-spot="window" aria-pressed={blind === 'open'} aria-label={blind === 'open' ? w.windowOpen : w.windowClosed} onClick={tapWindow} />
    </div>
  </div>;

  const thingsWindow = () => {
    const shown = opened ? byKind.get(opened) : undefined;
    if (opened && shown) return <div className="md-things md-things--one">
      <div className="md-things__large" dir={lang === 'he' ? 'rtl' : 'ltr'}><CreationPreview creation={shown} childId={childId} /></div>
      <button type="button" className="md-key md-key--word md-things__close" onClick={() => setOpened(null)}>{w.thingClose}</button>
    </div>;
    if (!kinds.length) return <div className="md-things md-things--empty">
      <PixelArt rows={ICON_THINGS} className="md-things__empty-art" />
      <p>{w.thingsEmpty}</p>
    </div>;
    return <ul className="md-things" aria-label={w.thingsList}>
      {kinds.map(kind => <li key={kind}><button type="button" className="md-things__tile" data-thing={kind} aria-label={deskLine(w.thingOpen, w.kinds[kind])} onClick={() => { void selectionHaptic(); audio.current?.key(); setOpened(kind); }}>
        <span className="md-things__art">{byKind.get(kind) && <DeskThing creation={byKind.get(kind)!} label={w.kinds[kind]} />}</span>
        <span className="md-things__name">{w.kinds[kind]}</span>
      </button></li>)}
    </ul>;
  };

  const monitor = () => <div className="md-monitor">
    <div className="md-monitor__screen" data-program={program ?? 'desktop'}>
      {level.at === 'desktop' && <DeskWallpaper sky={sky} />}
      <div className="md-bar">
        <button type="button" ref={backTab} className="md-backtab" data-back-to={target ?? 'none'} aria-label={deskLine(w.backTo, targetName)} onClick={back}><ArrowLeft size={20} strokeWidth={3} aria-hidden="true" /><span>{targetName}</span></button>
        {program ? <span className="md-bar__title"><PixelArt rows={PROGRAM_ICON[program]} className="md-bar__icon" />{w[program]}</span> : <span className="md-bar__title">{w.title}</span>}
        <PixelClock sky={sky} label={sky === 'day' ? w.skyDay : w.skyNight} />
      </div>
      {level.at === 'desktop' && <div className="md-desktop" role="group" aria-label={w.programs}>
        {PROGRAMS.map(id => <button type="button" key={id} className="md-icon" data-program={id} onClick={() => open(id)}>
          <PixelArt rows={PROGRAM_ICON[id]} className="md-icon__art" /><span className="md-icon__name">{w[id]}</span>
        </button>)}
      </div>}
      {program && <div className="md-window" data-program={program}>
        {program === 'bounce' && <DeskBounce w={w} audio={audio.current} reduced={reducedMotion()} onStatus={setStatus} onAllLit={() => discover(noteLanterns(discoveryRef.current))} />}
        {program === 'things' && thingsWindow()}
        {program === 'ask' && <DeskTerminal w={w} lang={lang} things={kinds} hello={greet} audio={audio.current} onCommand={command => discover(noteCommand(discoveryRef.current, command))} />}
      </div>}
      <span className="md-monitor__scan" aria-hidden="true" />
    </div>
    <div className="md-monitor__chin"><span className="md-monitor__stripe" aria-hidden="true" />{stickers('onChin')}<span className="md-monitor__led" aria-hidden="true" /></div>
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="maker-desk" title={w.title} instruction={w.instruction} hearIt={cue}>
    {finished
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="md" data-adventure="maker-desk" data-level={level.at} data-program={program ?? 'none'} data-light={light} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <p className="md-cue">{cue}</p>
        <div className="md-stagecol"><div className="md-stage" data-level={level.at}>
          {level.at === 'study' ? room() : monitor()}
        </div></div>
        <p className="md-status" role="status">{status}</p>
      </section>}
  </GameShell>;
}
