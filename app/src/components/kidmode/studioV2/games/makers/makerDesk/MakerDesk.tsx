import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Gamepad2, Power, RotateCcw, Terminal, Zap } from 'lucide-react';
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
import {
  CAMERA_HOME, HudButton, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, createPlaySound, hitPause, prefersReducedMotion, roundSeed, seededRandom, useShake,
  type CoachMood, type FxKind, type FxOptions, type PlayCamera, type PlayFxHandle, type PlaySound,
} from '../play';
import { createDeskAudio, type DeskAudio } from './deskAudio';
import { DeskBounce, type BounceControls } from './DeskBounce';
import { DESK_KIT, FRONT_BAR, LID_CENTRE, LID_GLASS, TRAY_SPOTS, WINDOWS_TALL, WINDOWS_WIDE, type KitPicture } from './deskKit';
import { ICON_BOUNCE, ICON_TERMINAL, DeskWallpaper, PixelArt, PixelClock } from './DeskPixels';
import { DeskTerminal } from './DeskTerminal';
import { DeskThing } from './DeskThing';
import { MAKER_DESK_COPY, deskLine } from './makerDeskCopy';
import {
  CHAPTERS, CREW, MAGIC_WORD, NEW_QUEST, PLANT_FULL, POWER_UP, POWER_UP_REDUCED, PROGRAMS, ROOM, TOOLS, TOOLS_TO_WAKE, backTarget, benchAwake, chapterDone, chapterNow, crewAround, deskRound, growPlant, isThingKind,
  noteCommand, noteLanterns, openProgram, questDone, shelfNews, shelfPlaces, skyPicture, stepBack, switchOn, thingKinds, toolOrder, wakeTool,
  type Chapter, type CrewId, type DeskRound, type Level, type Program, type Quest, type TermEffect, type ThingKind, type ToolId,
} from './makerDeskRules';
import '../makerPalette.css';
import './makerDesk.css';

/** The Maker Desk, as a game. The TrailBench fills the room like a cockpit and
 * it is asleep. Chapter one wakes it, tool by tool. Chapter two is inside its
 * screen: the camera pushes into the lid until the glass is the whole display,
 * and Bounce is played there. Chapter three talks to the machine. Then the
 * whole bench powers up. Everything is driven by plain timers and state: no
 * step waits for an animation, so it plays the same with motion off. */
const DIVE_MS = 640;
const DIVE_REDUCED_MS = 90;
const SURFACE_MS = 420;
const AYA_AFTER_MS = [5200, 11000] as const;
const AYA_STAYS_MS = 6500;
/** The ghost hand shows the first touch, and again after this long without one. */
const HINT_FIRST_MS = 2200;
const HINT_IDLE_MS = 6000;
const TOAST_MS = 2600;
const HELD_MS = 1500;
/** PulsePod amber: how long everything waits before it turns cyan again by itself. */
export const WAIT_MS = 3200;
const PROGRAM_ICON: Record<Program, readonly string[]> = { bounce: ICON_BOUNCE, ask: ICON_TERMINAL };
const CHAPTER_ICON: Record<Chapter, typeof Zap> = { wake: Zap, play: Gamepad2, ask: Terminal };
const TOOL_ART: Record<ToolId, KitPicture> = { proofLens: DESK_KIT.toolProofLens, viewCheck: DESK_KIT.toolViewCheck, pulsePod: DESK_KIT.toolPulsePod, leafLab: DESK_KIT.toolLeafLab, clearPatch: DESK_KIT.toolClearPatch };
const TOOL_TONES: Record<ToolId, readonly string[]> = { proofLens: ['white', 'sky'], viewCheck: ['sea', 'white'], pulsePod: ['amber', 'sea'], leafLab: ['spring', 'white'], clearPatch: ['sky-pale', 'white'] };
const PLANTER = [DESK_KIT.planterBud, DESK_KIT.planterBud, DESK_KIT.planterBudding, DESK_KIT.planterBloom] as const;
const TILES = [DESK_KIT.tileYellow, DESK_KIT.tileBlue, DESK_KIT.tilePink] as const;
type Mood = 'watch' | 'unsure' | 'glad' | 'wow';
type Phase = 'opening' | 'play' | 'powerUp';
const COACH_MOOD: Record<Mood, CoachMood> = { watch: 'idle', unsure: 'curious', glad: 'happy', wow: 'wow' };
/** The opening shot starts on the valley through the windows and settles on the bench. */
const CAMERA_OPENING: PlayCamera = { x: 0.5, y: 0.26, zoom: 1.5 };

/** What stood on the shelf when the desk was last open, per child, for this
 * sitting only (in memory: nothing is stored or sent). It lets the desk
 * notice a thing that is new or was made again since then. */
const SHELF_SEEN = new Map<string, Partial<Record<ThingKind, string>>>();

const pic = (art: { src: string }) => ({ src: art.src, alt: '', draggable: false, decoding: 'async' as const });
const artVar = (art: { src: string }) => `url("${art.src}")`;

export default function MakerDesk() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = MAKER_DESK_COPY[lang], shared = ADVENTURE_COPY[lang], studio = studioCopy(lang);
  const childId = useArborOptional()?.childProfile?.id ?? '';
  const muted = useKidReadAloudMuted(childId);
  // Only the current child's own creations: the hook scopes them to owner and child.
  const saved = useStudioCreations(childId);
  const hero = useStudioHero();
  const [round, setRound] = useState<DeskRound>(() => deskRound(seededRandom(roundSeed())));
  const [phase, setPhase] = useState<Phase>('opening');
  const [level, setLevelState] = useState<Level>(ROOM);
  const [camera, setCamera] = useState<PlayCamera>(CAMERA_OPENING);
  const [diving, setDiving] = useState(false);
  const [surfacing, setSurfacing] = useState(false);
  const [quest, setQuest] = useState<Quest>(NEW_QUEST);
  const [light, setLight] = useState<'day' | 'evening'>('day');
  const [blind, setBlind] = useState<'open' | 'closed'>('open');
  const [bird, setBird] = useState(false);
  const [shelfLit, setShelfLit] = useState(false);
  const [toast, setToast] = useState('');
  const [finished, setFinished] = useState(false);
  // Toys and feedback. A `tick` restarts a flourish; the state beside it is what stays.
  const [shown, setShown] = useState<ThingKind | null>(null);
  const [fresh, setFresh] = useState<readonly ThingKind[]>([]);
  const [hop, setHop] = useState(0);
  const [plant, setPlant] = useState(0);
  const [water, setWater] = useState(0);
  const [tool, setTool] = useState<{ id: ToolId; tick: number } | null>(null);
  const [held, setHeld] = useState<{ id: ToolId; tick: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [seam, setSeam] = useState(false);
  const [pips, setPips] = useState(false);
  const [snap, setSnap] = useState(0);
  const [chock, setChock] = useState<{ mood: Mood; tick: number }>({ mood: 'watch', tick: 0 });
  const [look, setLook] = useState(0);
  const [aya, setAya] = useState(0);
  const [tile, setTile] = useState<{ at: number; tick: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [woke, setWoke] = useState(0);
  const [sleepy, setSleepy] = useState(0);
  const [beat, setBeat] = useState(0);
  const [lit, setLit] = useState<readonly ToolId[]>([]);
  const [glowing, setGlowing] = useState(false);
  const [skyFlip, setSkyFlip] = useState(false);
  const [shake, bump] = useShake();
  const levelRef = useRef<Level>(level), questRef = useRef(quest), phaseRef = useRef<Phase>(phase), busy = useRef(false), shownRef = useRef<ThingKind | null>(null);
  levelRef.current = level; questRef.current = quest; phaseRef.current = phase; shownRef.current = shown;
  const audio = useRef<DeskAudio | null>(null), sound = useRef<PlaySound | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null), toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null), pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const backButton = useRef<HTMLElement | null>(null), lidButton = useRef<HTMLButtonElement>(null), showClose = useRef<HTMLButtonElement>(null);
  const world = useRef<HTMLDivElement>(null), glass = useRef<HTMLDivElement>(null);
  const fx = useRef<PlayFxHandle>(null), glassFx = useRef<PlayFxHandle>(null);
  const bounce = useRef<BounceControls | null>(null);
  const moved = useRef(false), arrived = useRef(false), dived = useRef(false), touched = useRef(false);

  const later = (ms: number, act: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); act(); }, ms);
    timers.current.push(id);
  };
  const setLevel = (next: Level) => { levelRef.current = next; moved.current = true; setLevelState(next); };
  const say = (text: string, ms = TOAST_MS) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = text ? setTimeout(() => { toastTimer.current = null; setToast(''); }, ms) : null;
  };
  useEffect(() => {
    const desk = createDeskAudio(), play = createPlaySound({ key: 'C' }); audio.current = desk; sound.current = play;
    // The opening shot: the camera lets go of the valley and settles on the bench.
    const settle = setTimeout(() => setCamera(now => (now === CAMERA_OPENING ? CAMERA_HOME : now)), 60);
    return () => {
      clearTimeout(settle); for (const id of timers.current) clearTimeout(id); timers.current = [];
      if (moodTimer.current) clearTimeout(moodTimer.current); if (toastTimer.current) clearTimeout(toastTimer.current); if (pauseTimer.current) clearTimeout(pauseTimer.current);
      desk.dispose(); play.dispose(); audio.current = null; sound.current = null;
    };
  }, []);
  // The quiet bed: the room's air outside, a low hum inside the screen. Both wait for a first touch.
  useEffect(() => {
    audio.current?.hum(level.at !== 'study' && !muted && touched.current);
    if (touched.current && !muted) sound.current?.ambience(level.at === 'study' ? 'hall' : 'night');
  }, [level.at, muted]);
  useEffect(() => { if (muted) { audio.current?.stop(); sound.current?.stop(); } }, [muted]);

  /** Where a thing is on the stage, as the fractions the particle layer wants. */
  const spotOf = (el: Element | null | undefined, layer: Element | null) => {
    const box = el?.getBoundingClientRect?.(), frame = layer?.getBoundingClientRect?.();
    if (!box || !frame || !frame.width || !frame.height) return null;
    return { x: (box.left + box.width / 2 - frame.left) / frame.width, y: (box.top + box.height / 2 - frame.top) / frame.height };
  };
  const burstAt = (selector: string, kind: FxKind, opts?: FxOptions) => {
    const at = spotOf(world.current?.querySelector?.(selector), world.current);
    if (at) fx.current?.burst(at.x, at.y, kind, opts);
  };

  /** Chock is in the play: he cheers the good moments and tilts his head at the odd ones. */
  const chockFeels = (mood: Mood, ms = 1600) => {
    setChock(now => ({ mood, tick: now.tick + 1 }));
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => { moodTimer.current = null; setChock(now => ({ mood: 'watch', tick: now.tick })); }, ms);
  };
  /** Every touch in the room answers where it lands, and Chock turns to look. */
  const touchRoom = (e: ReactPointerEvent<HTMLDivElement>) => {
    const frame = e.currentTarget.getBoundingClientRect?.();
    if (!frame || !frame.width) return;
    const x = (e.clientX - frame.left) / frame.width, y = (e.clientY - frame.top) / frame.height;
    fx.current?.burst(x, y, 'ring', { size: 0.6, tones: ['white'] });
    setLook(Math.max(-1, Math.min(1, (x - 0.5) * 2)));
    // A touch on the bare room still has a sound of its own (the things in it bring theirs).
    if (!(e.target as Element | null)?.closest?.('button')) sound.current?.tap();
    if (!touched.current) { touched.current = true; if (!muted) sound.current?.ambience('hall'); }
  };

  /** One step back: program → desktop → room. Leaving the screen pulls the camera back out of the lid. */
  const back = () => {
    const now = levelRef.current;
    if (now.at === 'study' || busy.current) return;
    void selectionHaptic(); sound.current?.back();
    const next = stepBack(now);
    say(''); setGlowing(false);
    if (next.at === 'study') { setSurfacing(true); setCamera(CAMERA_HOME); later(prefersReducedMotion() ? 40 : SURFACE_MS, () => setSurfacing(false)); }
    setLevel(next);
  };
  const backRef = useRef(back); backRef.current = back;
  // Escape steps back too. The Kid Mode overlay swallows Escape at the
  // document, so this listens on the window, first, and lets it carry on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shownRef.current) { setShown(null); return; }
      if (levelRef.current.at !== 'study') backRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  // Focus follows the level: the step-back button inside the screen, the lid in the room.
  useEffect(() => {
    if (!moved.current) return;
    if (level.at === 'study') lidButton.current?.focus({ preventScroll: true });
    else (glass.current?.closest?.('[data-play-stage]')?.querySelector?.('[data-back-to]') as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [level]);
  useEffect(() => { if (shown) showClose.current?.focus({ preventScroll: true }); }, [shown]);
  // Now and then Aya peeks over the lid.
  useEffect(() => {
    if (level.at !== 'study' || finished || phase !== 'play') { if (phase !== 'powerUp') setBird(false); return; }
    let timer: ReturnType<typeof setTimeout>;
    const land = () => { setBird(true); timer = setTimeout(leave, AYA_STAYS_MS); };
    const leave = () => { setBird(false); timer = setTimeout(land, AYA_AFTER_MS[0] + Math.random() * (AYA_AFTER_MS[1] - AYA_AFTER_MS[0])); };
    timer = setTimeout(land, AYA_AFTER_MS[0] + Math.random() * (AYA_AFTER_MS[1] - AYA_AFTER_MS[0]));
    return () => clearTimeout(timer);
  }, [level.at, finished, phase]);
  // Show, don't tell: a ghost hand touches the next thing (a tool, then the
  // woken screen). It comes back after a quiet while and is gone for good once
  // the child has dived into the screen.
  const hintFor: 'tool' | 'lid' | null = phase !== 'play' || level.at !== 'study' || finished || diving ? null : !benchAwake(quest) ? (quest.woken.length ? null : 'tool') : dived.current ? null : 'lid';
  useEffect(() => {
    if (!hintFor) { setHint(false); return; }
    let timer = setTimeout(() => setHint(true), HINT_FIRST_MS);
    const quiet = () => { setHint(false); clearTimeout(timer); timer = setTimeout(() => setHint(true), HINT_IDLE_MS); };
    window.addEventListener('pointerdown', quiet, true); window.addEventListener('keydown', quiet, true);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', quiet, true); window.removeEventListener('keydown', quiet, true); };
  }, [hintFor]);

  const items = saved.items.filter(item => isThingKind(item.creation.kind));
  const byKind = new Map<ThingKind, StudioCreation>(items.map(item => [item.creation.kind as ThingKind, item.creation]));
  const kinds = thingKinds(items.map(item => item.creation.kind));
  const kindsRef = useRef(kinds); kindsRef.current = kinds;
  // Arriving: the things on the shelf say hello, and one that is new since the
  // desk was last open this sitting is marked and named.
  useEffect(() => {
    if (!saved.loaded || arrived.current) return;
    arrived.current = true;
    const marks: Partial<Record<ThingKind, string>> = {};
    for (const [kind, creation] of byKind) marks[kind] = JSON.stringify(creation);
    const news = shelfNews(SHELF_SEEN.get(childId) ?? null, marks);
    SHELF_SEEN.set(childId, marks);
    if (!kindsRef.current.length) return;
    later(3400, () => {
      setHop(n => n + 1);
      if (news.length) { setFresh(news); setShelfLit(true); chockFeels('glad'); say(deskLine(w.shelfNew, news.map(kind => w.kinds[kind]).join(', ')), 3600); }
    });
  }, [saved.loaded]);

  /** A chapter ends: a flourish on the quest strip, a chord, and Chock is thrilled. */
  const advance = (next: Quest) => {
    const before = questRef.current;
    if (next === before) return;
    questRef.current = next; setQuest(next);
    const won = CHAPTERS.find(chapter => !chapterDone(before, chapter) && chapterDone(next, chapter));
    if (!won) return;
    sound.current?.chapter(); chockFeels('wow', 2200);
    if (won === 'wake') {
      // The bench wakes: the lid flickers on, every light answers, the room feels it.
      setWoke(n => n + 1); audio.current?.power(); bump(); void hitPause(70);
      later(120, () => { burstAt('[data-spot="pc"]', 'sparkle', { count: 18, spread: 1.4, tones: ['sea', 'white', 'sky'] }); burstAt('[data-spot="pc"]', 'ring', { size: 2.2, tones: ['sea'] }); });
      later(500, () => { setBird(true); setAya(n => n + 1); });
    }
    if (questDone(next)) later(400, () => audio.current?.fanfare());
  };

  /** Each docked tool wakes at a touch and does its one real thing from the kit. */
  const touchTool = (id: ToolId) => {
    if (phaseRef.current !== 'play') return;
    void selectionHaptic();
    const first = !questRef.current.woken.includes(id);
    setTool(now => ({ id, tick: (now?.tick ?? 0) + 1 })); setHeld(now => ({ id, tick: (now?.tick ?? 0) + 1 }));
    later(HELD_MS, () => setHeld(now => (now?.id === id ? null : now)));
    if (first) sound.current?.place(questRef.current.woken.length * 2); else sound.current?.pick();
    burstAt(`[data-tool="${id}"]`, 'ring', { size: 1.3, tones: [TOOL_TONES[id][0]] });
    burstAt(`[data-tool="${id}"]`, 'glint', { count: 4, tones: TOOL_TONES[id] });
    if (id === 'proofLens') { audio.current?.click(); setSnap(n => n + 1); }
    else if (id === 'viewCheck') { setCamera({ x: 0.5, y: 0.82, zoom: 1.55 }); later(1700, () => { if (levelRef.current.at === 'study' && !busy.current) setCamera(CAMERA_HOME); }); }
    else if (id === 'pulsePod') {
      // Amber: everything waits, the way the WaitRing shows it. Then cyan, ready, by itself (or at a second touch).
      const wait = !pausedRef.current; pausedRef.current = wait; setPaused(wait);
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
      pauseTimer.current = wait ? setTimeout(() => { pauseTimer.current = null; pausedRef.current = false; setPaused(false); sound.current?.place(4); burstAt('[data-tool="pulsePod"]', 'ring', { size: 1.6, tones: ['sea'] }); say(w.toolDo.pulsePodReady); }, WAIT_MS) : null;
    }
    else if (id === 'leafLab') { setPips(true); later(2600, () => setPips(false)); }
    else setSeam(true);
    const did = id === 'pulsePod' ? (pausedRef.current ? w.toolDo.pulsePodWait : w.toolDo.pulsePodReady) : id === 'leafLab' ? (plant > 0 ? w.toolDo.leafLabGood : w.toolDo.leafLabDry) : w.toolDo[id];
    say(did, 3000);
    advance(wakeTool(questRef.current, id));
  };

  /** Touching the lid. Asleep, it only stirs. Awake, the camera pushes into it
   * until the glass is the whole display. */
  const tapLid = () => {
    if (levelRef.current.at !== 'study' || busy.current || phaseRef.current !== 'play') return;
    void selectionHaptic();
    if (!benchAwake(questRef.current)) {
      // A soft return, never a refusal: the screen stirs and the tools glow to say where to go.
      setSleepy(n => n + 1); sound.current?.back(); chockFeels('unsure', 1400); say(w.screenAsleep);
      return;
    }
    busy.current = true; dived.current = true; setDiving(true); setShown(null); say('');
    audio.current?.key(); sound.current?.pick();
    // The lid's glass sits at a known place in the bench picture; the camera aims at its middle.
    const box = lidButton.current?.getBoundingClientRect?.(), frame = world.current?.getBoundingClientRect?.();
    const at = box && frame && frame.width ? { x: (box.left + box.width * LID_CENTRE[0] / 100 - frame.left) / frame.width, y: (box.top + box.height * LID_CENTRE[1] / 100 - frame.top) / frame.height } : null;
    setCamera({ x: at?.x ?? 0.5, y: at?.y ?? 0.4, zoom: 3 });
    later(prefersReducedMotion() ? DIVE_REDUCED_MS : DIVE_MS, () => { busy.current = false; setDiving(false); setLevel(switchOn(levelRef.current)); });
  };
  const flipLamp = () => { const next = light === 'day' ? 'evening' : 'day'; setLight(next); return next; };
  const tapLamp = () => { void selectionHaptic(); audio.current?.click(); burstAt('[data-spot="lamp"]', 'glint', { tones: ['butter', 'white'] }); say(flipLamp() === 'evening' ? w.roomEvening : ''); };
  const tapWindow = () => { void selectionHaptic(); audio.current?.glass(blind !== 'open'); setBlind(now => (now === 'open' ? 'closed' : 'open')); };
  const tapShelf = () => {
    void selectionHaptic();
    const next = !shelfLit; setShelfLit(next); setHop(n => n + 1);
    if (kinds.length) audio.current?.run(kinds.length); else audio.current?.note(5, true);
    burstAt('[data-spot="shelf"]', 'sparkle', { count: 8, tones: ['sea', 'white'] });
    say(kinds.length ? kinds.map(kind => w.kinds[kind]).join(' · ') : w.thingsEmpty, 3200);
  };
  const showThing = (kind: ThingKind, at: number) => {
    void selectionHaptic(); audio.current?.note(5 + at); chockFeels('glad');
    setFresh(now => now.filter(item => item !== kind)); setShown(kind); say('');
  };
  const tapPlant = () => {
    void selectionHaptic();
    const next = growPlant(plant), bloom = next === PLANT_FULL && plant < PLANT_FULL;
    setPlant(next); setWater(n => n + 1); audio.current?.drops(bloom);
    later(260, () => burstAt('[data-spot="flower"]', 'drop', { count: 9, angle: 90, arc: 50, spread: 0.5 }));
    if (bloom) later(760, () => { burstAt('[data-spot="flower"]', 'petal', { count: 12, tones: ['blossom', 'rose', 'white'] }); chockFeels('glad'); });
    say(plant >= PLANT_FULL ? w.plantHappy : bloom ? w.plantBloom : w.plantGrow);
  };
  const tapChock = () => { void selectionHaptic(); audio.current?.woof(); chockFeels('glad'); burstAt('[data-spot="chock"]', 'sparkle', { count: 6, tones: ['butter', 'white'] }); say(w.chockPat); };
  const tapAya = () => { void selectionHaptic(); audio.current?.chirp(); setAya(n => n + 1); burstAt('[data-spot="aya"]', 'sparkle', { count: 6, tones: ['sky', 'white'] }); say(w.ayaHello); };
  const tapTile = (at: number) => {
    void selectionHaptic(); audio.current?.note([5, 7, 8][at] ?? 5); setTile(now => ({ at, tick: (now?.tick ?? 0) + 1 }));
    burstAt(`[data-spot="tile-${at}"]`, 'ring', { tones: [['sun', 'sky', 'blossom'][at] ?? 'white'] });
  };
  const tapCrew = (id: CrewId, here: boolean) => { void selectionHaptic(); audio.current?.note(5 + CREW.indexOf(id), !here); say(here ? deskLine(w.crewHere, w.crewNames[id]) : w.crewAway[id], 3200); if (id === 'chock') chockFeels('glad'); };
  const open = (program: Program) => {
    void selectionHaptic(); audio.current?.key(); sound.current?.pick();
    setLevel(openProgram(levelRef.current, program)); say('');
  };
  const onCommand = (command: string | null, effect: TermEffect = null) => {
    const before = questRef.current;
    advance(noteCommand(before, command));
    if (effect === 'lamp') flipLamp();
    // The secret: the magic word rains stars over the whole glass.
    if (command === MAGIC_WORD) { glassFx.current?.burst(0.5, 0.36, 'sparkle', { count: 34, spread: 2.2, tones: ['butter', 'white', 'sea'] }); glassFx.current?.burst(0.5, 0.36, 'ring', { size: 3, tones: ['butter'] }); chockFeels('wow', 2200); }
    if (!command) chockFeels('unsure', 1200); else if (['hello', 'dance', 'sing', 'crew'].includes(command)) chockFeels('glad');
  };
  const onMoment = (moment: 'row' | 'cloud' | 'allLit' | 'chain') => {
    if (moment === 'chain') { say(w.chain, 1800); chockFeels('glad', 1200); return; }
    chockFeels(moment === 'cloud' ? 'unsure' : moment === 'allLit' ? 'wow' : 'glad', moment === 'allLit' ? 2800 : 1300);
    if (moment === 'allLit') { bump(); glassFx.current?.burst(0.5, 0.4, 'confetti', { count: 30, tones: ['amber', 'rose', 'sea', 'spring', 'lilac'] }); }
  };

  /** The set-piece. The whole bench powers up: a hush, then every tool lights
   * in turn, the screen blooms, the room joins in, and ProofLens keeps a true
   * picture of it. About eight seconds, on plain timers. Then the Studio takes over. */
  const powerUp = () => {
    if (phaseRef.current !== 'play' || !questDone(questRef.current) || busy.current) return;
    void selectionHaptic(); busy.current = true; phaseRef.current = 'powerUp';
    const reduced = prefersReducedMotion(), plan = reduced ? POWER_UP_REDUCED : POWER_UP;
    const inside = levelRef.current.at !== 'study';
    setShown(null); say(''); setPaused(false); pausedRef.current = false; if (pauseTimer.current) clearTimeout(pauseTimer.current); setGlowing(false); setLight('day'); setLit([]);
    if (inside) { setSurfacing(true); setLevel(ROOM); later(reduced ? 40 : SURFACE_MS, () => setSurfacing(false)); }
    setPhase('powerUp'); setBeat(1); setCamera({ x: 0.5, y: 0.62, zoom: 1.28 });
    sound.current?.ambience('hall'); audio.current?.hm();
    toolOrder(round.order).forEach((id, index) => later(plan.tools + index * plan.toolGap, () => {
      setLit(now => [...now, id]); setHeld(now => ({ id, tick: (now?.tick ?? 0) + 1 })); sound.current?.place(index * 2);
      burstAt(`[data-tool="${id}"]`, 'ring', { size: 1.5, tones: [TOOL_TONES[id][0]] }); burstAt(`[data-tool="${id}"]`, 'sparkle', { count: 7, tones: TOOL_TONES[id] });
    }));
    later(plan.screen, () => {
      setBeat(2); setHeld(null); setCamera({ x: 0.5, y: 0.4, zoom: 1.4 }); sound.current?.setPiece(); bump(); void hitPause(80);
      burstAt('[data-spot="pc"]', 'ring', { size: 3, tones: ['sea'] }); burstAt('[data-spot="pc"]', 'sparkle', { count: 22, spread: 1.6, tones: ['sea', 'white', 'butter'] });
    });
    later(plan.room, () => {
      setBeat(3); setCamera(CAMERA_HOME); setShelfLit(true); setHop(n => n + 1); setPlant(PLANT_FULL); setBird(true); setAya(n => n + 1); chockFeels('wow', 4200);
      audio.current?.finale(); bump();
      fx.current?.burst(0.5, 0.3, 'confetti', { count: 40, spread: 1.5, tones: ['sea', 'sun', 'rose', 'spring', 'white'] });
      burstAt('[data-spot="shelf"]', 'sparkle', { count: 12, tones: ['sea', 'white'] }); burstAt('[data-spot="flower"]', 'petal', { count: 12 });
      later(600, () => fx.current?.burst(0.22, 0.42, 'confetti', { count: 22, tones: ['amber', 'sea', 'white'] }));
      later(1000, () => fx.current?.burst(0.78, 0.42, 'confetti', { count: 22, tones: ['rose', 'lilac', 'white'] }));
    });
    later(plan.picture, () => { setBeat(4); audio.current?.click(); burstAt('[data-tool="proofLens"]', 'glint', { count: 5 }); });
    later(plan.end, () => setFinished(true));
  };
  const reset = () => {
    for (const id of timers.current) clearTimeout(id); timers.current = []; busy.current = false; dived.current = false; phaseRef.current = 'opening';
    setRound(deskRound(seededRandom(roundSeed()))); setPhase('opening'); setLevel(ROOM); setCamera(CAMERA_HOME); setDiving(false); setSurfacing(false);
    setQuest(NEW_QUEST); questRef.current = NEW_QUEST; setLight('day'); setBlind('open'); setBird(false); setShelfLit(false); setShown(null); say(''); setFinished(false);
    setPlant(0); setPaused(false); pausedRef.current = false; setSeam(false); setPips(false); setTool(null); setHeld(null); setBeat(0); setLit([]); setFresh([]); setGlowing(false);
  };

  const greet = { word: studio.hello, noName: studio.helloNoName, name: hero.name && hero.name !== HERO_NAME_FALLBACK ? hero.name : null };
  const awake = benchAwake(quest), done = questDone(quest), now = chapterNow(quest);
  const clock = skyPicture(new Date().getHours());
  const sky = skyFlip ? (clock === 'day' ? 'night' : 'day') : clock;
  const target = backTarget(level);
  const targetName = target === 'study' ? w.toDesk : w.toDesktop;
  const program = level.at === 'program' ? level.program : null;
  const inside = level.at !== 'study';
  const around = crewAround(round.guest, bird);
  const powering = phase === 'powerUp';
  // One line from the host for the moment: what this step invites.
  const line = phase === 'opening' ? w.opening : powering ? w.powerCaption
    : done ? w.allDone
    : diving ? w.playCue
    : !inside ? (!awake ? (quest.woken.length === 0 ? w.wakeCue : quest.woken.length === TOOLS_TO_WAKE - 1 ? w.wakeLast : w.wakeMore) : !dived.current ? w.screenAwake : !quest.lanterns ? w.roomPlay : w.roomAsk)
    : program === 'bounce' ? (quest.lanterns ? w.allLit : w.bounceCue)
    : program === 'ask' ? (chapterDone(quest, 'ask') ? w.freePlay : quest.commands.length ? w.askOne : w.terminalCue)
    : !quest.lanterns ? w.playCue : !chapterDone(quest, 'ask') ? w.askCue : w.desktopCue;
  const power = powering ? (beat >= 2 ? 1 : lit.length / TOOLS.length) : Math.min(1, quest.woken.length / TOOLS_TO_WAKE);
  const screen = powering ? (beat >= 2 ? 'on' : 'off') : awake ? 'on' : 'off';
  const toolOn = (id: ToolId) => (powering ? lit.includes(id) : quest.woken.includes(id));
  const lidGlass: CSSProperties = { clipPath: `polygon(${LID_GLASS})` };
  const grade = powering && beat < 3 ? 'dusk' : light === 'evening' ? 'dusk' : round.light;
  const next: Program | null = !quest.lanterns ? 'bounce' : !chapterDone(quest, 'ask') ? 'ask' : null;
  const roomArt = { '--md-room-tall': artVar(DESK_KIT.room), '--md-room-wide': artVar(DESK_KIT.roomWide), '--md-power': power, '--md-look': look } as CSSProperties;
  const windows = (set: readonly (readonly [number, number, number, number])[], shape: 'tall' | 'wide') => set.map(([x, y, bw, bh], at) => <button type="button" key={`${shape}${at}`} className={`md-window md-window--${shape}`}
    data-spot={shape === 'tall' && at === 0 ? 'window' : undefined} data-frost={blind === 'closed'} aria-pressed={blind === 'open'} aria-label={blind === 'open' ? w.windowOpen : w.windowClosed}
    style={{ insetInlineStart: `${x}%`, insetBlockStart: `${y}%`, inlineSize: `${bw}%`, blockSize: `${bh}%` }} onClick={tapWindow} />);

  const room = <div className="md-room" ref={world} dir="ltr" style={roomArt} data-power={awake || (powering && beat >= 2) ? 'awake' : quest.woken.length || lit.length ? 'stirring' : 'asleep'} data-light={light} data-paused={paused} data-inside={inside}
    data-diving={diving} data-beat={beat} data-phase={phase} onPointerDown={touchRoom}>
    <div className="md-plane" data-play-depth="3">{windows(WINDOWS_TALL, 'tall')}{windows(WINDOWS_WIDE, 'wide')}</div>
    <span className="md-sunbeam" aria-hidden="true" />

    {/* Wide rooms have floor to spare: three music pads in front of the bench. */}
    {TILES.map((art, at) => <button type="button" key={at} className="md-tile" data-spot={`tile-${at}`} data-at={at} aria-label={w.tileSpot} onClick={() => tapTile(at)}>
      <img key={tile?.at === at ? tile.tick : 0} data-press={tile?.at === at} {...pic(art)} />
    </button>)}

    {/* The TrailBench: the desk, its lid screen, the five tools in its trays, the lamp, and Aya behind it. */}
    <div className="md-bench" data-play-depth="2" data-screen={screen}>
      <span className="md-bench__shadow" aria-hidden="true" />
      <span className="md-aya" data-here={bird} aria-hidden="true"><span key={aya} className="md-aya__hop" data-hello={aya > 0}><img className="md-aya__pose md-aya__pose--idle" {...pic(DESK_KIT.ayaPeek)} /><img className="md-aya__pose md-aya__pose--happy" {...pic(DESK_KIT.ayaGlad)} /></span></span>
      <img className="md-lamp" data-lit={light === 'evening'} {...pic(DESK_KIT.lamp)} />
      <img className="md-bench__art" {...pic(DESK_KIT.benchHd)} />
      <span className="md-bench__ao" aria-hidden="true" style={{ '--md-bench-mask': `url("${DESK_KIT.bench.src480}")` } as CSSProperties} />
      <span className="md-bench__lights" aria-hidden="true" style={{ '--md-lights': artVar(DESK_KIT.benchLights) } as CSSProperties}><i /><i /></span>
      <span key={`w${woke}`} className="md-lid" data-screen={screen} data-woke={woke > 0} style={lidGlass} aria-hidden="true">
        <span className="md-lid__zz"><i>z</i><i>z</i><i>z</i></span>
        <span className="md-lid__live"><PixelArt rows={ICON_BOUNCE} className="md-lid__icon" /><PixelArt rows={ICON_TERMINAL} className="md-lid__icon" /></span>
        <span className="md-lid__dots" data-on={powering && beat >= 3}><i /><i /><i /><i /><i /></span>
        {seam && <i className="md-lid__seam" />}
        <span key={`s${sleepy}`} className="md-lid__stir" data-on={sleepy > 0} />
      </span>
      <span className="md-lamp__pool" data-lit={light === 'evening'} aria-hidden="true" />
      <div className="md-trays" role="group" aria-label={w.traysSpot}>
        {TOOLS.map((id, at) => <button type="button" key={id} className="md-tool" data-tool={id} data-on={toolOn(id)} data-cue={!awake && !powering} data-state={id === 'pulsePod' ? (paused ? 'wait' : 'ready') : undefined} aria-pressed={toolOn(id)}
          aria-label={`${w.toolNames[id]}. ${w.toolLines[id]}`} style={{ insetInlineStart: `${TRAY_SPOTS[at][0]}%`, insetBlockStart: `${TRAY_SPOTS[at][1]}%`, '--at': at } as CSSProperties}
          onClick={() => touchTool(id)}>
          <span className="md-tool__light" aria-hidden="true" />
          {tool?.id === id && <span key={`r${tool.tick}`} className="md-tool__ring" aria-hidden="true" />}
          {held?.id === id && <span key={`h${held.tick}`} className="md-tool__held" aria-hidden="true"><img {...pic(TOOL_ART[id])} /></span>}
        </button>)}
      </div>
      <button type="button" className="md-frontbar" data-spot="powerBar" data-ready={done && !powering} aria-label={w.powerUp} disabled={!done || powering} style={{ insetInlineStart: `${FRONT_BAR[0]}%`, insetBlockStart: `${FRONT_BAR[1]}%` }} onClick={powerUp}><i /><i /><i /></button>
      <button type="button" ref={lidButton} className="md-lidspot" data-spot="pc" data-awake={awake} aria-label={awake ? w.computer : w.computerWarm} style={lidGlass} onClick={tapLid} />
      <button type="button" className="md-lampspot" data-spot="lamp" aria-pressed={light === 'evening'} aria-label={light === 'day' ? w.lampDay : w.lampEvening} onClick={tapLamp} />
      {bird && <button type="button" className="md-ayaspot" data-spot="aya" aria-label={w.ayaSpot} onClick={tapAya} />}
      {hint && hintFor && <span className="md-ghost" data-for={hintFor} style={hintFor === 'tool' ? { insetInlineStart: `${TRAY_SPOTS[TOOLS.indexOf(round.hint)][0]}%`, insetBlockStart: `${TRAY_SPOTS[TOOLS.indexOf(round.hint)][1]}%` } : undefined} aria-hidden="true"><GhostHand /></span>}
      {snap > 0 && <span key={`p${snap}`} className="md-snap" aria-hidden="true"><i className="md-snap__flash" /><span className="md-snap__card"><img {...pic(DESK_KIT.room)} /><img className="md-snap__bench" {...pic(DESK_KIT.bench)} /></span></span>}
    </div>

    {/* Chock, on the floor beside the bench. He turns to what is touched. */}
    <button type="button" className="md-chock" data-play-depth="1" data-spot="chock" data-mood={chock.mood} aria-label={w.chockSpot} onClick={tapChock}>
      <span className="md-chock__shadow" aria-hidden="true" />
      <span key={chock.tick} className="md-chock__body" data-mood={chock.mood}>
        <img className="md-chock__pose md-chock__pose--idle" {...pic(DESK_KIT.chockIdle)} />
        <img className="md-chock__pose md-chock__pose--happy" {...pic(DESK_KIT.chockHappy)} />
      </span>
    </button>

    {/* The lit shelf: the planter, and the child's real creations as objects. */}
    <div className="md-shelf" data-play-depth="1" data-lit={shelfLit} data-rows={kinds.length > 3 ? 2 : 1}>
      <span className="md-shelf__shadow" aria-hidden="true" />
      <span className="md-shelf__box md-shelf__box--back" aria-hidden="true"><i /></span>
      <span className="md-shelf__box md-shelf__box--front" aria-hidden="true"><i /></span>
      <button type="button" className="md-shelf__spot" data-spot="shelf" aria-pressed={shelfLit} aria-label={kinds.length ? `${w.shelf}: ${kinds.map(kind => w.kinds[kind]).join(', ')}` : `${w.shelfEmpty}. ${w.shelfTag}`} onClick={tapShelf} />
      {shelfPlaces(kinds).map((kind, index) => {
        const creation = kind ? byKind.get(kind) : undefined;
        return <span key={index} className="md-shelf__place" data-kind={kind ?? 'empty'} data-row={index < 3 ? 'front' : 'back'} data-fresh={!!kind && fresh.includes(kind)} style={{ '--col': index % 3, '--at': index } as CSSProperties}>
          <span className="md-shelf__pool" aria-hidden="true" />
          {creation && kind && <button type="button" className="md-shelf__thing" data-shelf-thing={kind} aria-label={deskLine(w.thingOpen, w.kinds[kind])} onClick={() => showThing(kind, index)}><span key={hop} className="md-shelf__hop" data-hop={hop > 0}><DeskThing creation={creation} label={w.kinds[kind]} /></span></button>}
        </span>;
      })}
      <button type="button" className="md-planter" data-spot="flower" data-stage={plant} aria-label={w.flowerSpot} onClick={tapPlant}>
        <span key={water} className="md-planter__stem" data-watered={water > 0}>{PLANTER.map((art, stage) => <img key={stage} data-stage={stage} data-on={stage === plant} {...pic(art)} />)}</span>
        {water > 0 && <span key={`c${water}`} className="md-can"><img {...pic(DESK_KIT.can)} /></span>}
        <span className="md-pips" data-on={pips} data-wet={plant > 0} aria-hidden="true"><i /><i /><i /></span>
      </button>
    </div>

    <span className="md-evening" data-on={light === 'evening'} aria-hidden="true" />
    <span className="md-wait" data-on={paused} aria-hidden="true" />
    <span key={`f${beat}`} className="md-flash" data-on={beat === 2 || beat === 4} aria-hidden="true" />
    {beat >= 4 && <span className="md-keepsake" aria-hidden="true"><span className="md-keepsake__card"><img {...pic(DESK_KIT.room)} /><img className="md-keepsake__bench" {...pic(DESK_KIT.bench)} /><img className="md-keepsake__chock" {...pic(DESK_KIT.chockHappy)} /></span></span>}
    <PlayFx ref={fx} layer={8} />
  </div>;

  const insideView = <div className="md-glass" ref={glass} data-program={program ?? 'desktop'} data-sky={sky} data-glowing={glowing} dir={lang === 'he' ? 'rtl' : 'ltr'}>
    <div className="md-glass__screen">
      {level.at === 'desktop' && <DeskWallpaper sky={sky} />}
      {level.at === 'desktop' && <div className="md-desktop">
        <button type="button" className="md-clockbtn" data-sky={sky} aria-label={sky === 'day' ? w.skyDay : w.skyNight} onClick={() => { void selectionHaptic(); audio.current?.note(sky === 'day' ? 5 : 8, true); setSkyFlip(flip => !flip); }}><PixelClock sky={sky} /></button>
        <div className="md-programs" role="group" aria-label={w.programs}>
          {PROGRAMS.map(id => <button type="button" key={id} className="md-icon" data-program={id} data-next={next === id} data-done={id === 'bounce' ? quest.lanterns : chapterDone(quest, 'ask')} onClick={() => open(id)}>
            <span className="md-icon__tile"><PixelArt rows={PROGRAM_ICON[id]} className="md-icon__art" /></span><span className="md-icon__name">{w[id]}</span>
          </button>)}
        </div>
        <div className="md-crew" role="group" aria-label={w.crewLink}>
          {CREW.map(id => <button type="button" key={id} className="md-crew__dot" data-crew={id} data-here={around[id]} aria-label={deskLine(around[id] ? w.crewDotHere : w.crewDotAway, w.crewNames[id])} onClick={() => tapCrew(id, around[id])}>
            <i aria-hidden="true" /><span>{w.crewNames[id]}</span>
          </button>)}
        </div>
      </div>}
      {program === 'bounce' && <DeskBounce w={w} audio={audio.current} reduced={prefersReducedMotion()} firstLayout={round.layout} controls={bounce} onStatus={text => say(text, 1600)} onAllLit={() => advance(noteLanterns(questRef.current))} onMoment={onMoment} onGlowing={setGlowing} />}
      {program === 'ask' && <DeskTerminal w={w} lang={lang} things={kinds} hello={greet} riddle={round.riddle} audio={audio.current} onCommand={onCommand} />}
    </div>
    <span className="md-glass__curve" aria-hidden="true" />
    <span className="md-glass__frame" aria-hidden="true"><i /><i /><i /><i /></span>
    <PlayFx ref={glassFx} layer={4} />
  </div>;

  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture?.(e.pointerId); void selectionHaptic(); bounce.current?.hold(dir); },
    onPointerUp: () => bounce.current?.release(dir), onPointerCancel: () => bounce.current?.release(dir), onLostPointerCapture: () => bounce.current?.release(dir),
    // A keyboard press (no pointer) nudges the paddle one step.
    onClick: (e: { detail: number }) => { if (e.detail === 0) bounce.current?.nudge(dir); },
  });

  return <GameShell fullBleed autoNarrate={false} worldId="maker-desk" title={w.title} instruction={w.instruction} hearIt={line}>
    {finished
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="md" data-adventure="maker-desk" data-level={level.at} data-program={program ?? 'none'} data-light={light} data-phase={phase} data-chapter={CHAPTERS[now] ?? 'done'} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <PlayStage id="maker-desk" grade={grade} camera={camera} shake={shake} parallax={!inside} world={room}>
          {inside && insideView}
          {surfacing && <span className="md-surface" aria-hidden="true" />}
          <HudCoach who="chock" mood={COACH_MOOD[chock.mood]} line={line} quiet={powering} onPoke={phase === 'play' ? tapChock : undefined} pokeLabel={w.chockSpot} />
          <HudQuest label={w.quest} current={now} steps={CHAPTERS.map(chapter => { const Icon = CHAPTER_ICON[chapter]; return { key: chapter, label: w.chapters[chapter], done: chapterDone(quest, chapter), icon: <Icon aria-hidden="true" /> }; })} />
          <HudToast show={!!toast && phase === 'play'}>{toast}</HudToast>
          <HudDock label={w.title}>
            {inside && <HudButton label={targetName} icon={<ArrowLeft data-flip="" aria-hidden="true" />} tone="paper" size="l" iconOnly={program === 'bounce'} onClick={back} data={{ 'data-back-to': target ?? 'none' }} />}
            {/* The paddle's arrows stay physically left and right: in a right-to-left HUD they are handed over in the other order. */}
            {program === 'bounce' && (lang === 'he' ? [1, -1] as const : [-1, 1] as const).map(dir => <button type="button" key={dir} className="play-button md-hold" data-tone="paper" data-size="l" data-icon-only="" data-control={dir < 0 ? 'left' : 'right'}
              aria-label={dir < 0 ? w.left : w.right} {...hold(dir)}>{dir < 0 ? <ChevronLeft size={30} strokeWidth={3} aria-hidden="true" /> : <ChevronRight size={30} strokeWidth={3} aria-hidden="true" />}</button>)}
            {program === 'bounce' && glowing && <HudButton label={w.again} icon={<RotateCcw aria-hidden="true" />} tone={done ? 'paper' : 'go'} size="l" iconOnly={done} onClick={() => { void selectionHaptic(); setGlowing(false); bounce.current?.again(); }} data={{ 'data-control': 'again' }} />}
            {done && phase === 'play' && <HudButton label={w.powerUp} icon={<Power aria-hidden="true" />} tone="go" size="l" cue onClick={powerUp} data={{ 'data-maker-desk-power': '' }} />}
          </HudDock>
          {phase === 'opening' && <PlayOpening title={w.title} place={w.place} onDone={() => { phaseRef.current = 'play'; setPhase('play'); setCamera(CAMERA_HOME); }} />}
          <PlaySetPiece active={powering} caption={beat >= 4 ? w.powerPicture : w.powerCaption} />
          {shown && byKind.get(shown) && <div className="md-show" role="group" aria-label={w.kinds[shown]} onClick={e => { if (e.target === e.currentTarget) setShown(null); }}>
            <div className="md-show__card">
              <div className="md-large" dir={lang === 'he' ? 'rtl' : 'ltr'}><CreationPreview creation={byKind.get(shown)!} childId={childId} /></div>
              <button type="button" ref={showClose} className="play-button" data-tone="paper" data-show-close="" onClick={() => { void selectionHaptic(); setShown(null); }}>{w.showClose}</button>
            </div>
          </div>}
        </PlayStage>
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
