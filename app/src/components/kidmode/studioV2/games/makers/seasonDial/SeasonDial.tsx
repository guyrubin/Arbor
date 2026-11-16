import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { SEASON_DIAL_COPY } from './seasonDialCopy';
import {
  COAST_MAX, COAST_STOP, FINALE_MS, HINT_FIRST_MS, HINT_IDLE_MS, HINT_MS, LAP_CUT_MS, LAP_LEAD_MS, LAP_MS, REST_MS, SEASONS, SEASON_CENTERS, TURN_MS, YEAR_STEP,
  angleDelta, angleToYear, coastStep, detent, detentAt, easeInOut, fullYear, hintAt, isLit, labLevel, lapStep, lapTurns, leafLab, marksCrossed, nextSeasonCenter, phaseAt, pointerAngle,
  restStart, restStep, restingYear, seasonAt, seasonLine, shortestTurn, springTo, startYear, turnAt, turnsToAngle, wrapYear, yearKind, type RestState, type Season,
} from './seasonDialRules';
import { createSeasonAudio, type SeasonAudio } from './seasonDialAudio';
import { SeasonScene, type LiveToys } from './SeasonScene';
import { SeasonWeather } from './SeasonWeather';
import { LeafLabGauges } from './SeasonLeafLab';
import { DialArt, HintHand, QUARTER_FILL, SeasonArt } from './SeasonDialFace';
import { CLOUDS, CROWN_AT, SCENE_H, SCENE_W, livePokes, meadowAnswer, shakeYield, shakenApples, toyAt, toyMs, type Poke, type Toy } from './seasonDialToys';
import { DIAL_PLINTH } from './seasonDialKit';
import '../makerPalette.css';
import './seasonDial.css';

/** play → (all four badges lit) lap → finale → ready (Done shows) → done. */
type Phase = 'play' | 'lap' | 'finale' | 'ready' | 'done';
/** How many times the toy has been opened since the page loaded: each play
 * is a different year and opens on the next season. Kept in memory only. */
let plays = 0;
/** Once the dial has been turned, the showing hand never comes back. */
let dialLearned = false;

const motionQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => !!motionQuery()?.matches);
  useEffect(() => {
    const query = motionQuery(); if (!query) return;
    const change = () => setReduced(query.matches);
    query.addEventListener?.('change', change);
    return () => query.removeEventListener?.('change', change);
  }, []);
  return reduced;
}
const dayNumber = () => Math.floor(Date.now() / 86_400_000);

export default function SeasonDial() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = SEASON_DIAL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const childId = useArborOptional()?.childProfile?.id ?? '';
  const muted = useKidReadAloudMuted(childId);
  const reduced = useReducedMotion();
  const [play, setPlay] = useState(() => plays++);
  const kind = useMemo(() => yearKind(dayNumber(), play), [play]);
  const [phase, setPhaseState] = useState<Phase>('play');
  const [turns, setTurns] = useState(() => startYear(play));
  const [lit, setLit] = useState(0);
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [awake, setAwake] = useState(false);
  const [held, setHeld] = useState(false);
  const [pokes, setPokes] = useState<readonly Poke[]>([]);
  const [cheer, setCheer] = useState<number | undefined>(undefined);
  const [tap, setTap] = useState<{ id: number; x: number; y: number } | null>(null);
  /** The showing hand: how far through one showing (null: not showing). */
  const [hint, setHint] = useState<number | null>(null);
  const [lapFrom, setLapFrom] = useState<number | null>(null);

  const phaseRef = useRef<Phase>('play');
  const turnsRef = useRef(turns);
  const frame = useRef(0);
  const anim = useRef<{ frame: number; timers: ReturnType<typeof setTimeout>[] }>({ frame: 0, timers: [] });
  const toyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintRun = useRef<{ frame: number; timer: ReturnType<typeof setTimeout> | null }>({ frame: 0, timer: null });
  const rest = useRef<RestState | null>(null);
  const audio = useRef<SeasonAudio | null>(null);
  const wasSounding = useRef(false);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const kindRef = useRef(kind); kindRef.current = kind;
  const drag = useRef<{ id: number; last: number; raw: number; moved: number; at: Season | null; x: number; y: number; speed: number; time: number } | null>(null);
  const heart = useRef<{ season: Season | null; time: number }>({ season: null, time: 0 });
  const buzz = useRef(0);
  const pokeId = useRef(0);
  const dialEl = useRef<HTMLDivElement>(null);
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };

  /** Every change of the year goes through here: the scene is drawn on the
   * next frame, the sound follows at once. */
  const commit = useCallback((next: number) => {
    turnsRef.current = next;
    audio.current?.setYear(wrapYear(next));
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setTurns(turnsRef.current); });
  }, []);
  const softHaptic = () => { const now = performance.now(); if (now - buzz.current > 55) { buzz.current = now; void selectionHaptic(); } };
  /** The pointer drops onto a season's heart: the heavy click, once. */
  const landOn = (season: Season) => {
    const now = performance.now();
    if (heart.current.season === season && now - heart.current.time < 420) return false;
    heart.current = { season, time: now };
    audio.current?.click(season); void selectionHaptic();
    return true;
  };
  /** Moves the dial and sounds every mark it passes. */
  const travel = (next: number, onHeart?: (season: Season) => void) => {
    const marks = marksCrossed(turnsRef.current, next);
    if (marks.ticks) { audio.current?.tick(); softHaptic(); }
    for (const s of marks.seasons) if (landOn(s)) onHeart?.(s);
    commit(next);
  };
  const cancelMotion = () => {
    cancelAnimationFrame(anim.current.frame); anim.current.frame = 0;
    for (const id of anim.current.timers) clearTimeout(id);
    anim.current.timers = [];
  };
  const wake = () => {
    if (!rest.current) { rest.current = restStart(wrapYear(turnsRef.current), performance.now()); setAwake(true); }
    wasSounding.current = audio.current?.wake() ?? false;
    audio.current?.setYear(wrapYear(turnsRef.current));
  };
  /** Any hand on the dial ends the self-turning lap; Done stays offered. */
  const handOn = () => {
    cancelMotion();
    if (phaseRef.current === 'lap' || phaseRef.current === 'finale') { setPhase('ready'); setLapFrom(null); }
    wake();
  };

  /* ── the showing hand ── */
  const stopHint = () => {
    cancelAnimationFrame(hintRun.current.frame); hintRun.current.frame = 0;
    if (hintRun.current.timer) clearTimeout(hintRun.current.timer);
    hintRun.current.timer = null;
    setHint(null);
  };
  const queueHint = (after: number) => {
    if (hintRun.current.timer) clearTimeout(hintRun.current.timer);
    hintRun.current.timer = null;
    if (dialLearned) return;
    hintRun.current.timer = setTimeout(() => {
      hintRun.current.timer = null;
      if (dialLearned) return;
      if (phaseRef.current !== 'play' || drag.current || anim.current.frame) { queueHint(HINT_IDLE_MS); return; }
      if (reducedRef.current) {
        // Reduced motion: the hand and its arrow stand still for a while, then go.
        setHint(0.5);
        hintRun.current.timer = setTimeout(() => { setHint(null); queueHint(HINT_IDLE_MS); }, HINT_MS);
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = (now - t0) / HINT_MS;
        if (t >= 1) { hintRun.current.frame = 0; setHint(null); queueHint(HINT_IDLE_MS); return; }
        setHint(t);
        hintRun.current.frame = requestAnimationFrame(step);
      };
      hintRun.current.frame = requestAnimationFrame(step);
    }, after);
  };
  /** Any touch or key quiets the hand and starts its wait again. */
  const noteInput = () => { if (dialLearned) return; stopHint(); queueHint(HINT_IDLE_MS); };
  const learned = () => { if (dialLearned) return; dialLearned = true; stopHint(); };

  useEffect(() => {
    const instance = createSeasonAudio(); audio.current = instance;
    const visible = () => {
      if (document.visibilityState === 'hidden') { instance.stop(); return; }
      if (wasSounding.current) { wasSounding.current = instance.wake(); instance.setYear(wrapYear(turnsRef.current)); }
    };
    document.addEventListener('visibilitychange', visible);
    queueHint(HINT_FIRST_MS);
    const run = hintRun.current;
    return () => {
      document.removeEventListener('visibilitychange', visible);
      cancelAnimationFrame(frame.current); frame.current = 0;
      cancelAnimationFrame(anim.current.frame);
      for (const id of anim.current.timers) clearTimeout(id);
      anim.current = { frame: 0, timers: [] };
      for (const id of toyTimers.current) clearTimeout(id);
      toyTimers.current = [];
      cancelAnimationFrame(run.frame); run.frame = 0;
      if (run.timer) clearTimeout(run.timer);
      run.timer = null;
      instance.dispose(); audio.current = null;
    };
  }, [play]);
  useEffect(() => { if (muted) { audio.current?.stop(); wasSounding.current = false; } }, [muted]);

  /* ── the toys in the scene ── */
  const prune = () => setPokes(prev => { const live = livePokes(prev, performance.now()); return live.length === prev.length ? prev : live; });
  const poke = (toy: Toy, x: number, y: number, quiet = false) => {
    const now = performance.now(), year = wrapYear(turnsRef.current);
    const made: Poke = { toy, x, y, at: now, seed: Math.random(), id: ++pokeId.current };
    setPokes(prev => [...livePokes(prev, now).filter(p => p.toy !== toy), made]);
    toyTimers.current.push(setTimeout(prune, toyMs(toy) + 40));
    if (toyTimers.current.length > 24) toyTimers.current.splice(0, 12);
    if (quiet) return;
    const detail = toy === 'appleTree' ? shakeYield(year).apples : toy === 'terraceFloor' ? meadowAnswer(x, y, year) : 0;
    audio.current?.toy(toy, seasonAt(year), detail);
    void selectionHaptic();
  };
  const cheerNow = () => {
    const id = ++pokeId.current;
    setCheer(id);
    toyTimers.current.push(setTimeout(() => setCheer(c => (c === id ? undefined : c)), 1300));
  };
  const sceneDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    const box = e.currentTarget.getBoundingClientRect();
    const k = Math.max(box.width / SCENE_W, box.height / SCENE_H);
    const x = (e.clientX - box.left - (box.width - SCENE_W * k) / 2) / k, y = (e.clientY - box.top - (box.height - SCENE_H * k) / 2) / k;
    wake();
    const id = pokeId.current + 1;
    setTap({ id, x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 });
    toyTimers.current.push(setTimeout(() => setTap(t => (t?.id === id ? null : t)), 520));
    poke(toyAt(x, y, wrapYear(turnsRef.current)), x, y);
  };
  const shakeTree = () => { wake(); poke('appleTree', CROWN_AT.x, CROWN_AT.y); };
  const [labBeat, setLabBeat] = useState(0);
  const readLab = () => {
    wake(); void selectionHaptic();
    const lab = leafLab(wrapYear(turnsRef.current));
    audio.current?.lab(lab.moisture, lab.light, lab.warmth);
    setLabBeat(b => b + 1);
  };

  /** Resting: a season the dial stays in for REST_MS lights its badge. */
  useEffect(() => {
    if (phase !== 'play') return;
    const id = setInterval(() => {
      const before = rest.current; if (!before) return;
      const after = restStep(before, wrapYear(turnsRef.current), performance.now(), REST_MS);
      rest.current = after;
      if (after.lit === before.lit) return;
      const season = after.season;
      setLit(after.lit);
      setAnnounce(seasonLine(w.lit, w.seasons[season]));
      // A beat that changes the scene: the badge rings, the tree gives the season's shower, the friend hops.
      audio.current?.badge(season); void selectionHaptic();
      poke('appleTree', CROWN_AT.x, CROWN_AT.y, true); cheerNow();
      if (fullYear(after.lit)) startLap();
    }, 200);
    return () => clearInterval(id);
  }, [phase, lang]);

  /** All four lit: the badges ring in turn, the pointer winds back, then goes
   * once round the year by itself with its music box; then the finale. */
  const finale = () => {
    setPhase('finale'); cheerNow();
    audio.current?.fanfare();
    poke('wholeYear', CROWN_AT.x, CROWN_AT.y, true);
    anim.current.timers.push(setTimeout(() => { if (phaseRef.current === 'finale') setPhase('ready'); }, FINALE_MS));
  };
  const startLap = () => {
    setPhase('lap'); setAnnounce(`${w.full} ${w.fullLine}`);
    cancelMotion(); stopHint();
    const from = turnsRef.current, first = seasonAt(wrapYear(from));
    setLapFrom(from);
    for (let i = 0; i < 4; i++) anim.current.timers.push(setTimeout(() => { audio.current?.click(((first + i) % 4) as Season); }, 120 + i * 170));
    const begin = setTimeout(() => {
      const passing = (season: Season) => { poke('appleTree', CROWN_AT.x, CROWN_AT.y, true); setAnnounce(w.phases[phaseAt(SEASON_CENTERS[season])]); };
      if (reducedRef.current) {
        // Reduced motion: four still pictures, one per season, then back where it was.
        for (let i = 1; i <= 4; i++) {
          anim.current.timers.push(setTimeout(() => {
            const season = ((first + i) % 4) as Season;
            const target = i === 4 ? wrapYear(from) : SEASON_CENTERS[season];
            commit(turnsRef.current + shortestTurn(wrapYear(turnsRef.current), target));
            audio.current?.lapNote(i * 4 - 1, kindRef.current);
            if (i < 4) passing(season); else finale();
          }, (i - 1) * LAP_CUT_MS));
        }
        return;
      }
      const t0 = performance.now();
      let lastStep = -1;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / LAP_MS);
        const next = lapTurns(from, t);
        travel(next, t > 0.09 ? passing : undefined); // the wind-up may brush the heart it starts on: that is not a season passed
        const at = lapStep(from, next);
        if (at > lastStep) { lastStep = at; audio.current?.lapNote(at, kindRef.current); }
        if (t < 1) anim.current.frame = requestAnimationFrame(step);
        else { anim.current.frame = 0; commit(from + 1); finale(); }
      };
      anim.current.frame = requestAnimationFrame(step);
    }, LAP_LEAD_MS);
    anim.current.timers.push(begin);
  };

  /** A season button, PageUp/PageDown or a tap on the dial: the short way
   * round, with the pointer's weight (it passes the heart by a hair and settles). */
  const goTo = (target: number) => {
    handOn(); learned();
    const from = turnsRef.current;
    if (reducedRef.current) { travel(from + shortestTurn(wrapYear(from), target)); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TURN_MS);
      travel(turnAt(from, target, t));
      anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  const nudge = (steps: number) => { handOn(); learned(); void selectionHaptic(); travel(turnsRef.current + steps * YEAR_STEP); };
  /** The hub: the whole year flies once round under the finger. */
  const whirl = () => {
    handOn(); learned();
    const from = turnsRef.current;
    if (reducedRef.current) { travel(from + shortestTurn(wrapYear(from), nextSeasonCenter(wrapYear(from), 1))); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 1800);
      travel(from + easeInOut(t));
      anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  /** Let go: the dial coasts on its own weight, then drops into a heart if one is near. */
  const letGo = (speed: number) => {
    const settle = () => {
      const from = turnsRef.current, target = restingYear(wrapYear(from)), gap = shortestTurn(wrapYear(from), target);
      if (Math.abs(gap) < 1e-5) { anim.current.frame = 0; return; }
      const season = detentAt(target, 0.0001);
      if (season !== null) landOn(season);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / 340);
        commit(from + gap * springTo(t, 0.5));
        anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
      };
      anim.current.frame = requestAnimationFrame(step);
    };
    if (reducedRef.current) { const from = turnsRef.current; commit(from + shortestTurn(wrapYear(from), restingYear(wrapYear(from)))); return; }
    let v = Math.min(COAST_MAX, Math.max(-COAST_MAX, speed));
    if (Math.abs(v) <= COAST_STOP * 4) { settle(); return; }
    let last = performance.now();
    const step = (now: number) => {
      const out = coastStep(v, Math.min(50, now - last)); last = now; v = out.speed;
      travel(turnsRef.current + out.advance);
      if (Math.abs(v) > COAST_STOP) anim.current.frame = requestAnimationFrame(step);
      else settle();
    };
    anim.current.frame = requestAnimationFrame(step);
  };

  const angleOf = (e: { clientX: number; clientY: number }) => {
    const box = dialEl.current?.getBoundingClientRect();
    if (!box) return null;
    const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2);
    return { deg: pointerAngle(dx, dy), near: Math.hypot(dx, dy) < box.width * 0.11 };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || drag.current) return;
    const at = angleOf(e); if (!at) return;
    handOn(); setHeld(true);
    audio.current?.tick(); void selectionHaptic();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    drag.current = { id: e.pointerId, last: at.deg, raw: turnsRef.current, moved: 0, at: detentAt(wrapYear(turnsRef.current)), x: e.clientX, y: e.clientY, speed: 0, time: performance.now() };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const at = angleOf(e); if (!at) return;
    if (at.near) { d.last = at.deg; return; } // too close to the hub to tell a direction
    const delta = angleDelta(d.last, at.deg), now = performance.now(), dt = Math.max(4, now - d.time);
    d.last = at.deg; d.raw += delta; d.moved += Math.abs(delta);
    d.speed = d.speed * 0.6 + ((delta / dt) * 1000) * 0.4; d.time = now;
    if (d.moved > 0.012) learned();
    const y = wrapYear(d.raw);
    const shown = d.raw + shortestTurn(y, detent(y));
    const marks = marksCrossed(turnsRef.current, shown);
    if (marks.ticks) { audio.current?.tick(); softHaptic(); }
    commit(shown);
    const s = detentAt(wrapYear(shown));
    if (s !== null && s !== d.at) landOn(s);
    else for (const passed of marks.seasons) landOn(passed);
    d.at = s;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null; setHeld(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    // A tap (no turn, no travel) sends the pointer to where the finger touched; a tap on the hub spins the year.
    if (d.moved < 0.01 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
      const at = angleOf(e);
      if (at?.near) whirl(); else if (at) goTo(angleToYear(at.deg));
      return;
    }
    letGo(performance.now() - d.time > 90 ? 0 : d.speed);
  };
  const cancel = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current?.id === e.pointerId) { drag.current = null; setHeld(false); } };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const y = wrapYear(turnsRef.current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-1);
    else if (e.key === 'PageUp') goTo(nextSeasonCenter(y, 1));
    else if (e.key === 'PageDown') goTo(nextSeasonCenter(y, -1));
    else if (e.key === 'Home') goTo(SEASON_CENTERS[0]);
    else if (e.key === 'End') goTo(SEASON_CENTERS[3]);
    else return;
    e.preventDefault();
  };
  const replay = () => {
    const next = plays++;
    cancelMotion(); stopHint(); rest.current = null; drag.current = null; turnsRef.current = startYear(next);
    setTurns(startYear(next)); setLit(0); setPaused(false); setAnnounce(''); setAwake(false); setHeld(false); setPokes([]); setCheer(undefined); setTap(null); setLapFrom(null);
    setPhase('play'); setPlay(next);
  };

  // While the hand shows the turn, the dial and the valley really follow it.
  const showing = hint === null ? null : hintAt(reduced ? 0.4 : hint);
  const shownTurns = turns + (showing && !reduced ? showing.offset : 0);
  const year = wrapYear(shownTurns), season = seasonAt(year), phaseText = w.phases[phaseAt(wrapYear(turns))];
  const sceneYear = Math.round(year * 2000) / 2000;
  const still = paused || reduced;
  const resting = phase === 'play' && awake && !isLit(lit, season) ? season : null;
  const live = useMemo<LiveToys>(() => {
    const now = performance.now(), by = new Map(livePokes(pokes, now).map(p => [p.toy, p]));
    const tree = by.get('appleTree'), cloud = by.get('cloudPuff');
    let index = 0;
    if (cloud) CLOUDS.forEach((c, i) => { if (Math.abs(c.x - cloud.x) < Math.abs(CLOUDS[index].x - cloud.x)) index = i; });
    return {
      tree: tree?.id, sun: by.get('sunDisc')?.id, birds: by.get('perchBirds')?.id, friend: by.get('valleyFriend')?.id, snowman: by.get('snowFriend')?.id, knot: by.get('knotHole')?.id,
      cloud: cloud ? { id: cloud.id, index } : undefined, apples: tree ? shakenApples(tree.seed, sceneYear) : undefined, cheer,
    };
  }, [pokes, sceneYear, cheer]);
  const celebrating = phase === 'lap' || phase === 'finale' || phase === 'ready';
  const lab = leafLab(sceneYear);
  const labWords = `${w.lab}: ${w.labMoisture[labLevel(lab.moisture)]}, ${w.labLight[labLevel(lab.light)]}, ${w.labWarmth[labLevel(lab.warmth)]}.`;

  return <GameShell fullBleed autoNarrate={false} worldId="season-dial" title={w.title} instruction={w.instruction}>
    {phase === 'done'
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={replay} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure sd" data-adventure="season-dial" data-phase={phase} data-season={season} data-paused={still} data-kind={kind} dir={lang === 'he' ? 'rtl' : 'ltr'}
        onPointerDownCapture={noteInput} onKeyDownCapture={noteInput}>
        <div className="sd-layout">
          <div className="sd-scene" data-sd-scene="" role="group" aria-label={`${w.scene}. ${phaseText}`} onPointerDown={sceneDown}>
            <SeasonScene year={sceneYear} live={live} kind={kind} />
            <SeasonWeather year={year} still={still} pokes={pokes} kind={kind} />

            <span key={`plate${season}`} className="sd-plate" aria-hidden="true"><span className="sd-plate__dot" style={{ background: QUARTER_FILL[season] }} />{w.seasons[season]}</span>
            {(phase === 'finale' || phase === 'ready') && <span className="sd-garland" aria-hidden="true">
              <span className="sd-garland__row" dir="ltr">{SEASONS.map(s => <svg key={s} className="sd-garland__gem" viewBox="-24 -24 48 48" focusable="false" style={{ background: QUARTER_FILL[s], animationDelay: `${s * 110}ms` }}><SeasonArt season={s} /></svg>)}</span>
              <span className="sd-garland__words">{w.full}</span>
            </span>}
            {/* Scene things, placed by the picture and never by the reading direction. */}
            <div className="sd-placed" dir="ltr">
              {tap && <span key={tap.id} className="sd-tap" aria-hidden="true" style={{ insetInlineStart: `${tap.x}%`, insetBlockStart: `${tap.y}%` }} />}
              <button type="button" className="sd-shake" aria-label={w.shake} onClick={shakeTree} onPointerDown={e => e.stopPropagation()} />
            </div>
            <button type="button" key={`lab${labBeat}`} className="sd-lab" data-sd-lab="" data-read={labBeat ? true : undefined} aria-label={labWords} onClick={readLab} onPointerDown={e => e.stopPropagation()}>
              <LeafLabGauges year={Math.round(year * 200) / 200} />
            </button>
          </div>
          <div className="sd-console">
            {/* The dial is an object, not text: it keeps its turn and its corners in Hebrew too. */}
            <div className="sd-dialbox" dir="ltr">
              <span className="sd-plinth" aria-hidden="true"><img src={DIAL_PLINTH.src480 ?? DIAL_PLINTH.src} srcSet={`${DIAL_PLINTH.src480} 480w, ${DIAL_PLINTH.src} ${DIAL_PLINTH.width}w`} sizes="(min-width: 900px) 440px, 360px" alt="" draggable={false} decoding="async" /></span>
              <div ref={dialEl} className="sd-dial" data-sd-dial="" data-held={held || undefined} role="slider" tabIndex={0} aria-label={w.dial} aria-orientation="horizontal"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(wrapYear(turns) * 100)} aria-valuetext={phaseText}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
                <DialArt turns={shownTurns} lit={lit} glow={celebrating} season={season} resting={resting} lapFrom={celebrating ? lapFrom : null} />
              </div>
              {showing && <HintHand angle={turnsToAngle(shownTurns)} from={turnsToAngle(turns)} show={reduced ? 1 : showing.show} press={reduced ? 0 : showing.press} />}
              {SEASONS.map(s => <button type="button" key={s} className="sd-season" data-season={s} data-visited={isLit(lit, s) || undefined} aria-pressed={season === s} aria-label={seasonLine(w.goTo, w.seasons[s])}
                onClick={() => { void selectionHaptic(); goTo(SEASON_CENTERS[s]); }}>
                <span className="sd-season__enamel" style={{ background: QUARTER_FILL[s] }}><svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false"><SeasonArt season={s} /></svg></span>
                {isLit(lit, s) && <span className="sd-season__tick" aria-hidden="true"><Check size={13} strokeWidth={3.4} /></span>}
              </button>)}
            </div>
            <p className="sd-cue" data-on={showing ? true : undefined} aria-hidden="true">{w.cue}</p>
            <div className="sd-controls">
              <button type="button" className="sd-control" aria-label={w.back} onClick={() => nudge(-1)}><RotateCcw size={26} aria-hidden="true" /></button>
              <button type="button" className="sd-control sd-control--pause" aria-pressed={paused} onClick={() => { void selectionHaptic(); setPaused(p => !p); }}>
                {paused ? <Play size={22} aria-hidden="true" /> : <Pause size={22} aria-hidden="true" />}<span>{paused ? w.play : w.pause}</span>
              </button>
              <button type="button" className="sd-control" aria-label={w.on} onClick={() => nudge(1)}><RotateCw size={26} aria-hidden="true" /></button>
            </div>
            {phase === 'ready' && <div className="adventure-actions sd-done">
              <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" data-sd-done="" onClick={() => { cancelMotion(); audio.current?.stop(); setPhase('done'); }}><Check size={22} aria-hidden="true" />{w.done}</button>
            </div>}
            <p className="sd-live" role="status">{announce}</p>
          </div>
        </div>
      </section>}
  </GameShell>;
}
