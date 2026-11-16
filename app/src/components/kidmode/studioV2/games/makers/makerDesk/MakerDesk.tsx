import { useEffect, useRef, useState, type CSSProperties } from 'react';
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
import { DESK_KIT, LID_GLASS, TRAY_SPOTS } from './deskKit';
import { ICON_BOUNCE, ICON_TERMINAL, ICON_THINGS, DeskWallpaper, PixelArt, PixelClock } from './DeskPixels';
import { DeskTerminal } from './DeskTerminal';
import { DeskThing } from './DeskThing';
import { MAKER_DESK_COPY, deskLine } from './makerDeskCopy';
import {
  CREW, NO_DISCOVERY, PLANT_FULL, PROGRAMS, ROOM, STICKERS, TOOLS, allStickers, backTarget, crewAround, growPlant, isThingKind, nextTool, noteCommand, noteLanterns, noteThings,
  openProgram, shelfNews, shelfPlaces, skyPicture, stepBack, stickerLit, switchOn, thingKinds, toolAt,
  type CrewId, type Discovery, type Level, type Program, type Sticker, type TermEffect, type ThingKind, type ToolId,
} from './makerDeskRules';
import '../makerPalette.css';
import './makerDesk.css';

/** The screen wakes, then the view moves into it. Plain timers: the game never
 * waits for an animation to end, so it plays the same with motion off. */
const WARM_MS = 1050;
const WARM_AGAIN_MS = 650;
const ZOOM_BACK_MS = 560;
const AYA_AFTER_MS = [4200, 9000] as const;
const AYA_STAYS_MS = 6500;
/** The ghost hand shows the first tap, and again after this long without a touch. */
const HINT_FIRST_MS = 1500;
const HINT_IDLE_MS = 6000;
/** The finish: the trays ring, the room joins in, ProofLens keeps the picture. */
const PARTY_BEATS_MS = [650, 1300] as const;
export const PARTY_MS = 2300;
const PROGRAM_ICON: Record<Program, readonly string[]> = { bounce: ICON_BOUNCE, things: ICON_THINGS, ask: ICON_TERMINAL };
/** Each desk sticker is a tiny pixel picture of its discovery: a lantern, a star, a prompt. */
const STICKER_ART: Record<Sticker, readonly string[]> = {
  lanterns: ['..aaa..', '.abbba.', '.abyba.', '.abyba.', '.abbba.', '..aaa..', '...a...'],
  things: ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'],
  commands: ['g......', '.g.....', '..g....', '.g.....', 'g......', '.......', '...bbbb'],
};
const TILES = [DESK_KIT.tileYellow, DESK_KIT.tileBlue, DESK_KIT.tilePink] as const;
type Mood = 'watch' | 'unsure' | 'glad';

/** What stood on the show steps when the desk was last open, per child, for
 * this sitting only (in memory: nothing is stored or sent). It lets the desk
 * notice a thing that is new or was made again since then. */
const SHELF_SEEN = new Map<string, Partial<Record<ThingKind, string>>>();

function reducedMotion(): boolean {
  try { return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
const pic = (art: { src: string }) => ({ src: art.src, alt: '', draggable: false, decoding: 'async' as const });

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
  // Toys and feedback. A `tick` restarts a flourish; the state beside it is what stays.
  const [shown, setShown] = useState<ThingKind | null>(null);
  const [fresh, setFresh] = useState<readonly ThingKind[]>([]);
  const [hop, setHop] = useState(0);
  const [plant, setPlant] = useState(0);
  const [water, setWater] = useState(0);
  const [tool, setTool] = useState<{ id: ToolId; tick: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [seam, setSeam] = useState(false);
  const [low, setLow] = useState(false);
  const [pips, setPips] = useState(false);
  const [chock, setChock] = useState<{ mood: Mood; tick: number }>({ mood: 'watch', tick: 0 });
  const [aya, setAya] = useState(0);
  const [tile, setTile] = useState<{ at: number; tick: number } | null>(null);
  const [earned, setEarned] = useState<{ sticker: Sticker; tick: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [party, setParty] = useState(0);
  const [skyFlip, setSkyFlip] = useState(false);
  const [guest] = useState(() => Math.floor(Math.random() * 3));
  const levelRef = useRef<Level>(level), discoveryRef = useRef(discovery), warmingRef = useRef(false), openedRef = useRef<ThingKind | null>(null), shownRef = useRef<ThingKind | null>(null);
  levelRef.current = level; discoveryRef.current = discovery; openedRef.current = opened; shownRef.current = shown;
  const audio = useRef<DeskAudio | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backTab = useRef<HTMLButtonElement>(null), computerButton = useRef<HTMLButtonElement>(null), showClose = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const moved = useRef(false), arrived = useRef(false), partyRef = useRef(false);

  const later = (ms: number, act: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); act(); }, ms);
    timers.current.push(id);
  };
  const setLevel = (next: Level) => { levelRef.current = next; moved.current = true; setLevelState(next); };
  useEffect(() => {
    const instance = createDeskAudio(); audio.current = instance;
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; if (moodTimer.current) clearTimeout(moodTimer.current); instance.dispose(); audio.current = null; };
  }, []);
  // The quiet hum, only while the screen fills the view and sound is on.
  useEffect(() => { audio.current?.hum(level.at !== 'study' && !muted); }, [level.at, muted]);
  useEffect(() => { if (muted) audio.current?.stop(); }, [muted]);

  /** Chock is part of the play: he cheers at the good moments and tilts his head at the odd ones. */
  const chockFeels = (mood: Mood, ms = 1500) => {
    setChock(now => ({ mood, tick: now.tick + 1 }));
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => { moodTimer.current = null; setChock(now => ({ mood: 'watch', tick: now.tick })); }, ms);
  };

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
      if (shownRef.current) { setShown(null); return; }
      if (openedRef.current) { setOpened(null); return; }
      if (levelRef.current.at !== 'study') backRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Focus follows the level: the step-back tab inside the computer, the screen in the room.
  useEffect(() => {
    if (!moved.current) return;
    (level.at === 'study' ? computerButton.current : backTab.current)?.focus({ preventScroll: true });
  }, [level]);
  useEffect(() => { if (shown) showClose.current?.focus({ preventScroll: true }); }, [shown]);
  // Now and then Aya peeks over the lid, while the glass is clear.
  useEffect(() => {
    if (blind !== 'open' || level.at !== 'study' || finished) { setBird(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    const land = () => { setBird(true); setStatus(w.bird); timer = setTimeout(leave, AYA_STAYS_MS); };
    const leave = () => { setBird(false); timer = setTimeout(land, AYA_AFTER_MS[0] + Math.random() * (AYA_AFTER_MS[1] - AYA_AFTER_MS[0])); };
    timer = setTimeout(land, AYA_AFTER_MS[0] + Math.random() * (AYA_AFTER_MS[1] - AYA_AFTER_MS[0]));
    return () => clearTimeout(timer);
  }, [blind, level.at, finished, w.bird]);
  // The first five seconds: a ghost hand taps the sleeping screen. It comes
  // back after a quiet while and is gone for good once the screen has woken.
  useEffect(() => {
    if (computerOn || level.at !== 'study' || finished) { setHint(false); return; }
    let timer = setTimeout(() => setHint(true), HINT_FIRST_MS);
    const quiet = () => { setHint(false); clearTimeout(timer); timer = setTimeout(() => setHint(true), HINT_IDLE_MS); };
    window.addEventListener('pointerdown', quiet, true); window.addEventListener('keydown', quiet, true);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', quiet, true); window.removeEventListener('keydown', quiet, true); };
  }, [computerOn, level.at, finished]);

  const items = saved.items.filter(item => isThingKind(item.creation.kind));
  const byKind = new Map<ThingKind, StudioCreation>(items.map(item => [item.creation.kind as ThingKind, item.creation]));
  const kinds = thingKinds(items.map(item => item.creation.kind));
  const kindsRef = useRef(kinds); kindsRef.current = kinds;
  // Arriving: the things on the show steps say hello, and one that is new
  // since the desk was last open this sitting is marked and named.
  useEffect(() => {
    if (!saved.loaded || arrived.current) return;
    arrived.current = true;
    const marks: Partial<Record<ThingKind, string>> = {};
    for (const [kind, creation] of byKind) marks[kind] = JSON.stringify(creation);
    const news = shelfNews(SHELF_SEEN.get(childId) ?? null, marks);
    SHELF_SEEN.set(childId, marks);
    if (!kindsRef.current.length) return;
    later(700, () => {
      setHop(n => n + 1); audio.current?.run(kindsRef.current.length);
      if (news.length) { setFresh(news); chockFeels('glad'); setStatus(deskLine(w.shelfNew, news.map(kind => w.kinds[kind]).join(', '))); }
    });
  }, [saved.loaded]);

  const discover = (next: Discovery) => {
    const before = discoveryRef.current;
    if (next === before) return;
    discoveryRef.current = next; setDiscovery(next);
    const won = STICKERS.find(sticker => !stickerLit(before, sticker) && stickerLit(next, sticker));
    if (won) { setEarned(now => ({ sticker: won, tick: (now?.tick ?? 0) + 1 })); chockFeels('glad'); if (!allStickers(next)) audio.current?.run(3, 7); }
    if (!allStickers(before) && allStickers(next)) {
      // The computer plays its tiny fanfare and Done appears in the studio.
      later(levelRef.current.at === 'program' && levelRef.current.program === 'bounce' ? 2600 : 200, () => { audio.current?.fanfare(); setStatus(levelRef.current.at === 'study' ? w.allStickers : w.doneWaiting); });
    }
  };

  const tapComputer = () => {
    if (levelRef.current.at !== 'study' || warmingRef.current || partyRef.current) return;
    void selectionHaptic(); warmingRef.current = true; setWarming(true); setShelfOpen(false); setShown(null); setStatus(w.switching);
    if (!computerOn) audio.current?.power(); else audio.current?.key();
    setComputerOn(true);
    later(reducedMotion() ? 120 : computerOn ? WARM_AGAIN_MS : WARM_MS, () => { warmingRef.current = false; setWarming(false); setStatus(''); setLevel(switchOn(levelRef.current)); });
  };
  const flipLamp = () => {
    const next = light === 'day' ? 'evening' : 'day';
    setLight(next); return next;
  };
  const tapLamp = () => { void selectionHaptic(); audio.current?.click(); setStatus(flipLamp() === 'evening' ? w.roomEvening : ''); };
  const tapWindow = () => { void selectionHaptic(); audio.current?.glass(blind !== 'open'); setBlind(now => now === 'open' ? 'closed' : 'open'); setStatus(''); };
  const tapShelf = () => {
    void selectionHaptic();
    const next = !shelfOpen; setShelfOpen(next); setHop(n => n + 1);
    if (kinds.length) audio.current?.run(kinds.length); else audio.current?.note(5, true);
    setStatus(!next ? '' : kinds.length ? kinds.map(kind => w.kinds[kind]).join(' · ') : w.shelfTag);
  };
  const showThing = (kind: ThingKind, at: number) => {
    void selectionHaptic(); audio.current?.note(5 + at); chockFeels('glad');
    setFresh(now => now.filter(item => item !== kind)); setShown(kind); setStatus('');
  };
  const tapPlant = () => {
    void selectionHaptic();
    const next = growPlant(plant), bloom = next === PLANT_FULL && plant < PLANT_FULL;
    setPlant(next); setWater(n => n + 1); audio.current?.drops(bloom);
    setStatus(plant >= PLANT_FULL ? w.plantHappy : bloom ? w.plantBloom : w.plantGrow);
    if (bloom) later(700, () => chockFeels('glad'));
  };
  /** A tap on the trays uses the tool under the finger; a keyboard press takes the next one along. */
  const tapTrays = (e?: { clientX?: number; detail?: number; currentTarget?: { getBoundingClientRect?: () => { left: number; width: number } } }) => {
    void selectionHaptic();
    const box = e?.detail && typeof e.clientX === 'number' ? e.currentTarget?.getBoundingClientRect?.() : undefined;
    const id = box && box.width > 0 ? toolAt((e!.clientX! - box.left) / box.width) : nextTool(tool?.id ?? null);
    setTool(now => ({ id, tick: (now?.tick ?? 0) + 1 }));
    audio.current?.note(5 + TOOLS.indexOf(id));
    if (id === 'proofLens') { audio.current?.click(); setStatus(w.toolDo.proofLens); }
    else if (id === 'viewCheck') { setLow(true); later(1500, () => setLow(false)); setStatus(w.toolDo.viewCheck); }
    else if (id === 'pulsePod') { const wait = !paused; setPaused(wait); setStatus(wait ? w.toolDo.pulsePodWait : w.toolDo.pulsePodReady); }
    else if (id === 'leafLab') { setPips(true); later(2600, () => setPips(false)); setStatus(plant > 0 ? w.toolDo.leafLabGood : w.toolDo.leafLabDry); }
    else { setSeam(true); setStatus(w.toolDo.clearPatch); }
  };
  const tapChock = () => { void selectionHaptic(); audio.current?.woof(); chockFeels('glad'); setStatus(w.chockPat); };
  const tapAya = () => { void selectionHaptic(); audio.current?.chirp(); setAya(n => n + 1); setStatus(w.ayaHello); };
  const tapTile = (at: number) => { void selectionHaptic(); audio.current?.note([5, 7, 8][at] ?? 5); setTile(now => ({ at, tick: (now?.tick ?? 0) + 1 })); };
  const tapSticker = (sticker: Sticker, at: number) => {
    void selectionHaptic(); const on = stickerLit(discoveryRef.current, sticker);
    audio.current?.note(on ? 10 + at : 5 + at, !on);
    setEarned(now => ({ sticker, tick: (now?.tick ?? 0) + 1 }));
    setStatus(deskLine(on ? w.stickerLit : w.stickerDim, w.stickerNames[sticker]));
  };
  const tapCrew = (id: CrewId, here: boolean) => { void selectionHaptic(); audio.current?.note(5 + CREW.indexOf(id), !here); setStatus(here ? deskLine(w.crewHere, w.crewNames[id]) : w.crewAway[id]); if (id === 'chock') chockFeels('glad'); };
  const open = (program: Program) => {
    void selectionHaptic(); audio.current?.key();
    setLevel(openProgram(levelRef.current, program)); setStatus('');
    if (program === 'things') discover(noteThings(discoveryRef.current));
  };
  const onCommand = (command: string | null, effect: TermEffect = null) => {
    discover(noteCommand(discoveryRef.current, command));
    if (effect === 'lamp') flipLamp();
    if (!command) chockFeels('unsure', 1200); else if (['hello', 'dance', 'sing', 'crew'].includes(command)) chockFeels('glad');
  };
  const onMoment = (moment: 'row' | 'cloud' | 'allLit') => { chockFeels(moment === 'cloud' ? 'unsure' : 'glad', moment === 'allLit' ? 2600 : 1300); };
  const onBall = (across: number) => { stage.current?.style.setProperty('--md-look', across.toFixed(2)); };
  /** The finish belongs to the bench: the five tools ring in turn, the room
   * joins in, and ProofLens keeps a true picture of the desk. Then the Studio takes over. */
  const finish = () => {
    if (partyRef.current) return;
    void selectionHaptic(); partyRef.current = true;
    setShown(null); setShelfOpen(false); setComputerOn(true); setPaused(false); setParty(1); setStatus(w.finish);
    audio.current?.finale();
    later(PARTY_BEATS_MS[0], () => { setParty(2); setHop(n => n + 1); setPlant(PLANT_FULL); setBird(true); setAya(n => n + 1); chockFeels('glad', 2000); });
    later(PARTY_BEATS_MS[1], () => { setParty(3); audio.current?.click(); });
    later(PARTY_MS, () => setFinished(true));
  };
  const reset = () => {
    for (const id of timers.current) clearTimeout(id); timers.current = []; warmingRef.current = false; partyRef.current = false;
    setLevel(ROOM); setWarming(false); setComputerOn(false); setZoomBack(false); setLight('day'); setBlind('open'); setBird(false);
    setShelfOpen(false); setOpened(null); setShown(null); setDiscovery(NO_DISCOVERY); discoveryRef.current = NO_DISCOVERY; setStatus(''); setFinished(false);
    setPlant(0); setPaused(false); setSeam(false); setLow(false); setPips(false); setTool(null); setParty(0); setEarned(null); setFresh([]);
  };

  const greet = { word: studio.hello, noName: studio.helloNoName, name: hero.name && hero.name !== HERO_NAME_FALLBACK ? hero.name : null };
  const done = allStickers(discovery);
  const clock = skyPicture(new Date().getHours());
  const sky = skyFlip ? (clock === 'day' ? 'night' : 'day') : clock;
  const target = backTarget(level);
  const targetName = target === 'study' ? w.toDesk : w.toDesktop;
  const program = level.at === 'program' ? level.program : null;
  const around = crewAround(guest, bird);
  const cue = level.at === 'study' ? (done ? w.allStickers : light === 'evening' ? w.roomEvening : w.roomCue)
    : program === 'bounce' ? w.bounceCue : program === 'things' ? w.thingsCue : program === 'ask' ? w.terminalCue : w.desktopCue;
  const screen = warming ? 'warming' : computerOn ? 'on' : 'off';
  const lidGlass: CSSProperties = { clipPath: `polygon(${LID_GLASS})` };

  const stickers = (where: 'onRoom' | 'onDeck') => <div className={`md-stickers md-stickers--${where}`} role="group" aria-label={w.stickers}>
    {STICKERS.map((sticker, at) => {
      const on = stickerLit(discovery, sticker);
      return <button type="button" key={sticker} className="md-sticker" data-sticker={sticker} data-lit={on} aria-label={deskLine(on ? w.stickerLit : w.stickerDim, w.stickerNames[sticker])} onClick={() => tapSticker(sticker, at)}>
        <span key={earned?.sticker === sticker ? earned.tick : 0} className="md-sticker__face" data-pop={earned?.sticker === sticker}><PixelArt rows={STICKER_ART[sticker]} className="md-sticker__art" /></span>
        {on && <span className="md-sticker__tick" aria-hidden="true"><Check size={12} strokeWidth={4} /></span>}
      </button>;
    })}
  </div>;

  const chockToy = (where: 'inRoom' | 'onDeck') => <button type="button" className={`md-chock md-chock--${where}`} data-spot="chock" data-mood={chock.mood} aria-label={w.chockSpot} onClick={tapChock}>
    <span key={chock.tick} className="md-chock__body" data-mood={chock.mood}>
      <img className="md-chock__pose md-chock__pose--idle" {...pic(DESK_KIT.chockIdle)} />
      <img className="md-chock__pose md-chock__pose--happy" {...pic(DESK_KIT.chockHappy)} />
      <img className="md-chock__bust md-chock__bust--watch" {...pic(DESK_KIT.chockWatch)} />
      <img className="md-chock__bust md-chock__bust--unsure" {...pic(DESK_KIT.chockUnsure)} />
      <img className="md-chock__bust md-chock__bust--glad" {...pic(DESK_KIT.chockGlad)} />
    </span>
  </button>;

  const room = () => <div className="md-room" data-warming={warming} data-zoom-back={zoomBack} data-party={party} data-paused={paused} data-low={low} data-light={light}>
    <div className="md-room__scene" dir="ltr">
      <img className="md-backdrop" {...pic(DESK_KIT.room)} />
      <span className="md-frost" data-on={blind === 'closed'} aria-hidden="true"><i /><i /><i /></span>
      <button type="button" className="md-spot md-at md-at--window" data-spot="window" aria-pressed={blind === 'open'} aria-label={blind === 'open' ? w.windowOpen : w.windowClosed} onClick={tapWindow} />

      {/* The knit flower among the ferns, and the watering can under it. */}
      <span className="md-at md-at--flower md-flower" data-stage={plant} aria-hidden="true">
        <span key={water} className="md-flower__stem" data-watered={water > 0}>
          <img className="md-flower__pose md-flower__pose--folded" {...pic(DESK_KIT.flowerFolded)} />
          <img className="md-flower__pose md-flower__pose--open" {...pic(DESK_KIT.flowerOpen)} />
        </span>
        {water > 0 && <span key={`d${water}`} className="md-drops"><i /><i /><i /></span>}
        <span className="md-pips" data-on={pips} data-wet={plant > 0}><i /><i /><i /></span>
      </span>
      <span className="md-at md-at--can md-can" aria-hidden="true"><img key={water} data-pour={water > 0} {...pic(DESK_KIT.can)} /></span>
      <button type="button" className="md-spot md-at md-at--flowerSpot" data-spot="flower" aria-label={w.flowerSpot} onClick={tapPlant} />
      <button type="button" className="md-spot md-at md-at--canSpot" data-spot="can" aria-label={w.canSpot} onClick={tapPlant} />

      {/* The TrailBench: the desk, its lid screen, the tools in its trays, the lamp, and Aya behind it. */}
      <div className="md-at md-at--bench md-bench" data-screen={screen}>
        <span className="md-aya" data-here={bird} aria-hidden="true"><span key={aya} className="md-aya__hop" data-hello={aya > 0}><img className="md-aya__pose md-aya__pose--idle" {...pic(DESK_KIT.ayaPeek)} /><img className="md-aya__pose md-aya__pose--happy" {...pic(DESK_KIT.ayaGlad)} /></span></span>
        <img className="md-bench__art" {...pic(DESK_KIT.bench)} />
        <span className="md-lid" data-screen={screen} style={lidGlass} aria-hidden="true">{seam && <i className="md-lid__seam" />}</span>
        <span className="md-crewdots" data-on={party >= 2} aria-hidden="true"><i /><i /><i /><i /><i /></span>
        <img className="md-lamp" data-lit={light === 'evening'} {...pic(DESK_KIT.lamp)} />
        {tool && <span key={tool.tick} className="md-toolring" data-tool={tool.id} style={{ insetInlineStart: `${TRAY_SPOTS[TOOLS.indexOf(tool.id)][0]}%`, insetBlockStart: `${TRAY_SPOTS[TOOLS.indexOf(tool.id)][1]}%` }} aria-hidden="true" />}
        <span className="md-pod" data-state={paused ? 'wait' : 'ready'} style={{ insetInlineStart: `${TRAY_SPOTS[2][0]}%`, insetBlockStart: `${TRAY_SPOTS[2][1]}%` }} aria-hidden="true" />
        {party >= 1 && <span className="md-trayparty" aria-hidden="true">{TRAY_SPOTS.map(([x, y], at) => <i key={at} style={{ insetInlineStart: `${x}%`, insetBlockStart: `${y}%`, animationDelay: `${at * 110}ms` }} />)}</span>}
        {tool?.id === 'proofLens' && <span key={`s${tool.tick}`} className="md-snap" aria-hidden="true"><img {...pic(DESK_KIT.room)} /></span>}
        <button type="button" ref={computerButton} className="md-spot md-spot--computer" data-spot="pc" aria-label={warming ? w.computerWarm : w.computer} onClick={tapComputer} />
        <button type="button" className="md-spot md-spot--trays" data-spot="trays" aria-label={w.traysSpot} onClick={tapTrays} />
        <button type="button" className="md-spot md-spot--lamp" data-spot="lamp" aria-pressed={light === 'evening'} aria-label={light === 'day' ? w.lampDay : w.lampEvening} onClick={tapLamp} />
        {bird && <button type="button" className="md-spot md-spot--aya" data-spot="aya" aria-label={w.ayaSpot} onClick={tapAya} />}
        {hint && <span className="md-ghost" aria-hidden="true"><GhostHand /></span>}
      </div>

      {/* The show steps: the child's real creations, nearest the front. */}
      <div className="md-at md-at--riser md-riser" data-open={shelfOpen}>
        <span className="md-riser__step md-riser__step--back" aria-hidden="true" />
        <span className="md-riser__step md-riser__step--front" aria-hidden="true"><span className="md-riser__tag" dir={lang === 'he' ? 'rtl' : 'ltr'}>{w.shelfTag}</span></span>
        <button type="button" className="md-spot md-spot--shelf" data-spot="shelf" aria-pressed={shelfOpen} aria-label={kinds.length ? `${shelfOpen ? w.shelfOpen : w.shelf}: ${kinds.map(kind => w.kinds[kind]).join(', ')}` : `${w.shelfEmpty}. ${w.shelfTag}`} onClick={tapShelf} />
        {shelfPlaces(kinds).map((kind, index) => {
          const creation = kind ? byKind.get(kind) : undefined;
          return <span key={index} className="md-shelf__place" data-kind={kind ?? 'empty'} data-row={index < 3 ? 'front' : 'back'} data-fresh={!!kind && fresh.includes(kind)} style={{ '--col': index % 3, '--at': index } as CSSProperties}>
            {creation && kind
              ? <button type="button" className="md-shelf__thing" data-shelf-thing={kind} aria-label={deskLine(w.thingOpen, w.kinds[kind])} onClick={() => showThing(kind, index)}><span key={hop} className="md-shelf__hop" data-hop={hop > 0}><DeskThing creation={creation} label={w.kinds[kind]} /></span></button>
              : <span className="md-shelf__stand" aria-hidden="true" />}
          </span>;
        })}
      </div>

      {/* Wide rooms have floor to spare: three music pads, and a rug for Chock. */}
      <img className="md-at md-at--rug md-rug" {...pic(DESK_KIT.rug)} />
      {TILES.map((art, at) => <button type="button" key={at} className={`md-spot md-at md-at--tile${at} md-tile`} data-spot={`tile-${at}`} aria-label={w.tileSpot} onClick={() => tapTile(at)}>
        <img key={tile?.at === at ? tile.tick : 0} data-press={tile?.at === at} {...pic(art)} />
      </button>)}
      {chockToy('inRoom')}

      <span className="md-evening" data-on={light === 'evening'} aria-hidden="true" />
      <span className="md-at md-at--bench md-glows" data-screen={screen} data-lit={light === 'evening'} aria-hidden="true"><i className="md-glows__lid" style={lidGlass} /><i className="md-glows__lamp" /></span>
      {party >= 3 && <span className="md-keepsake" aria-hidden="true"><span className="md-keepsake__flash" /><span className="md-keepsake__card"><img {...pic(DESK_KIT.room)} /><img className="md-keepsake__bench" {...pic(DESK_KIT.bench)} /></span></span>}
    </div>
    {stickers('onRoom')}
    {shown && byKind.get(shown) && <div className="md-show" role="group" aria-label={w.kinds[shown]} onClick={e => { if (e.target === e.currentTarget) setShown(null); }}>
      <div className="md-show__card">
        <div className="md-large" dir={lang === 'he' ? 'rtl' : 'ltr'}><CreationPreview creation={byKind.get(shown)!} childId={childId} /></div>
        <button type="button" ref={showClose} className="md-key md-key--word" data-show-close="" onClick={() => { void selectionHaptic(); setShown(null); }}>{w.showClose}</button>
      </div>
    </div>}
  </div>;

  const thingsWindow = () => {
    const large = opened ? byKind.get(opened) : undefined;
    if (opened && large) return <div className="md-things md-things--one">
      <div className="md-large" dir={lang === 'he' ? 'rtl' : 'ltr'}><CreationPreview creation={large} childId={childId} /></div>
      <button type="button" className="md-key md-key--word md-things__close" onClick={() => setOpened(null)}>{w.thingClose}</button>
    </div>;
    if (!kinds.length) return <div className="md-things md-things--empty">
      <PixelArt rows={ICON_THINGS} className="md-things__empty-art" />
      <p>{w.thingsEmpty}</p>
    </div>;
    return <ul className="md-things" aria-label={w.thingsList}>
      {kinds.map((kind, at) => <li key={kind}><button type="button" className="md-things__tile" data-thing={kind} aria-label={deskLine(w.thingOpen, w.kinds[kind])} onClick={() => { void selectionHaptic(); audio.current?.note(5 + at); chockFeels('glad'); setOpened(kind); }}>
        <span className="md-things__art">{byKind.get(kind) && <DeskThing creation={byKind.get(kind)!} label={w.kinds[kind]} />}</span>
        <span className="md-things__name">{w.kinds[kind]}</span>
      </button></li>)}
    </ul>;
  };

  const monitor = () => <div className="md-inside">
    <img className="md-inside__room" {...pic(DESK_KIT.room)} />
    <div className="md-monitor">
      <div className="md-monitor__screen" data-program={program ?? 'desktop'}>
        {level.at === 'desktop' && <DeskWallpaper sky={sky} />}
        <div className="md-bar">
          <button type="button" ref={backTab} className="md-backtab" data-back-to={target ?? 'none'} aria-label={deskLine(w.backTo, targetName)} onClick={back}><ArrowLeft size={20} strokeWidth={3} aria-hidden="true" /><span>{targetName}</span></button>
          {program ? <span className="md-bar__title"><PixelArt rows={PROGRAM_ICON[program]} className="md-bar__icon" />{w[program]}</span> : <span className="md-bar__title">{w.title}</span>}
          <button type="button" className="md-clockbtn" data-sky={sky} aria-label={sky === 'day' ? w.skyDay : w.skyNight} onClick={() => { void selectionHaptic(); audio.current?.note(sky === 'day' ? 5 : 8, true); setSkyFlip(now => !now); }}><PixelClock sky={sky} /></button>
        </div>
        {level.at === 'desktop' && <div className="md-desktop" role="group" aria-label={w.programs}>
          {PROGRAMS.map(id => <button type="button" key={id} className="md-icon" data-program={id} onClick={() => open(id)}>
            <PixelArt rows={PROGRAM_ICON[id]} className="md-icon__art" /><span className="md-icon__name">{w[id]}</span>
          </button>)}
        </div>}
        {level.at === 'desktop' && <div className="md-crew" role="group" aria-label={w.crewLink}>
          {CREW.map(id => <button type="button" key={id} className="md-crew__dot" data-crew={id} data-here={around[id]} aria-label={deskLine(around[id] ? w.crewDotHere : w.crewDotAway, w.crewNames[id])} onClick={() => tapCrew(id, around[id])}>
            <i aria-hidden="true" /><span>{w.crewNames[id]}</span>
          </button>)}
        </div>}
        {program && <div className="md-window" data-program={program}>
          {program === 'bounce' && <DeskBounce w={w} audio={audio.current} reduced={reducedMotion()} onStatus={setStatus} onAllLit={() => discover(noteLanterns(discoveryRef.current))} onMoment={onMoment} onBall={onBall} />}
          {program === 'things' && thingsWindow()}
          {program === 'ask' && <DeskTerminal w={w} lang={lang} things={kinds} hello={greet} audio={audio.current} onCommand={onCommand} />}
        </div>}
        <span className="md-monitor__scan" aria-hidden="true" />
      </div>
    </div>
    <div className="md-deck">{stickers('onDeck')}{chockToy('onDeck')}</div>
  </div>;

  return <GameShell fullBleed autoNarrate={false} worldId="maker-desk" title={w.title} instruction={w.instruction} hearIt={cue}>
    {finished
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="md" data-adventure="maker-desk" data-level={level.at} data-program={program ?? 'none'} data-light={light} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <p className="md-cue">{cue}</p>
        <div className="md-stagecol"><div className="md-stage" ref={stage} data-level={level.at}>
          {level.at === 'study' ? room() : monitor()}
        </div></div>
        <div className="md-foot">
          <p className="md-status" role="status">{status}</p>
          {level.at === 'study' && done && party === 0 && <button type="button" className="md-done" data-maker-desk-done="" onClick={finish}><Check size={20} strokeWidth={3} aria-hidden="true" />{w.done}</button>}
        </div>
      </section>}
  </GameShell>;
}

/** The authored hint hand: a soft pearl mitten with one finger out, tapping. */
function GhostHand() {
  return <svg viewBox="0 0 60 72" aria-hidden="true" focusable="false">
    <ellipse className="md-ghost__ring" cx="22" cy="12" rx="13" ry="13" />
    <path className="md-ghost__hand" d="M22 8c4 0 6 3 6 7v15l12 3c7 2 10 7 9 14l-2 12c-1 6-5 9-11 9H26c-5 0-8-2-11-6L5 48c-3-4 0-9 5-7l6 3V15c0-4 2-7 6-7z" />
  </svg>;
}
