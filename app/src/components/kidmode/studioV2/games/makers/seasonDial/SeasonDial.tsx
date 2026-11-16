import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { kidSfx, useKidReadAloudMuted } from '../../../../audio/kidAudio';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { SEASON_DIAL_COPY } from './seasonDialCopy';
import {
  LAP_CUT_MS, LAP_MS, REST_MS, SEASONS, SEASON_CENTERS, TURN_MS, angleDelta, angleToYear, detent, detentAt, easeInOut, fullYear, nextSeasonCenter,
  phaseAt, pointerAngle, restStart, restStep, seasonAt, seasonLine, shortestTurn, turnAt, wrapYear, YEAR_STEP, type RestState, type Season,
} from './seasonDialRules';
import { createSeasonAudio, type SeasonAudio } from './seasonDialAudio';
import { SceneGrain, SeasonScene } from './SeasonScene';
import { SeasonWeather } from './SeasonWeather';
import { DialArt, QUARTER_FILL, SeasonArt } from './SeasonDialFace';
import '../makerPalette.css';
import './seasonDial.css';

/** play → (all four badges lit) lap → ready (Done shows) → done. */
type Phase = 'play' | 'lap' | 'ready' | 'done';
/** The toy opens on spring in full blossom. */
const START_YEAR = SEASON_CENTERS[0];

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

export default function SeasonDial() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = SEASON_DIAL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const childId = useArborOptional()?.childProfile?.id ?? '';
  const muted = useKidReadAloudMuted(childId);
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [phase, setPhaseState] = useState<Phase>('play');
  const [turns, setTurns] = useState(START_YEAR);
  const [lit, setLit] = useState(0);
  const [paused, setPaused] = useState(false);
  const [announce, setAnnounce] = useState('');

  const phaseRef = useRef<Phase>('play');
  const turnsRef = useRef(START_YEAR);
  const frame = useRef(0);
  const anim = useRef<{ frame: number; timers: ReturnType<typeof setTimeout>[] }>({ frame: 0, timers: [] });
  const rest = useRef<RestState | null>(null);
  const audio = useRef<SeasonAudio | null>(null);
  const wasSounding = useRef(false);
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const drag = useRef<{ id: number; last: number; raw: number; moved: number; at: Season | null; x: number; y: number } | null>(null);
  const dialEl = useRef<HTMLDivElement>(null);
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next); };

  /** Every change of the year goes through here: the scene is drawn on the
   * next frame, the sound follows at once. */
  const commit = useCallback((next: number) => {
    turnsRef.current = next;
    audio.current?.setYear(wrapYear(next));
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setTurns(turnsRef.current); });
  }, []);
  const cancelMotion = () => {
    cancelAnimationFrame(anim.current.frame); anim.current.frame = 0;
    for (const id of anim.current.timers) clearTimeout(id);
    anim.current.timers = [];
  };
  const wake = () => {
    if (!rest.current) rest.current = restStart(wrapYear(turnsRef.current), performance.now());
    wasSounding.current = audio.current?.wake() ?? false;
    audio.current?.setYear(wrapYear(turnsRef.current));
  };
  /** Any hand on the toy ends the self-turning lap; Done stays offered. */
  const handOn = () => {
    cancelMotion();
    if (phaseRef.current === 'lap') setPhase('ready');
    wake();
  };

  useEffect(() => {
    const instance = createSeasonAudio(); audio.current = instance;
    const visible = () => {
      if (document.visibilityState === 'hidden') { instance.stop(); return; }
      if (wasSounding.current) { wasSounding.current = instance.wake(); instance.setYear(wrapYear(turnsRef.current)); }
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      document.removeEventListener('visibilitychange', visible);
      cancelAnimationFrame(frame.current); frame.current = 0;
      cancelAnimationFrame(anim.current.frame);
      for (const id of anim.current.timers) clearTimeout(id);
      anim.current = { frame: 0, timers: [] };
      instance.dispose(); audio.current = null;
    };
  }, [round]);
  useEffect(() => { if (muted) { audio.current?.stop(); wasSounding.current = false; } }, [muted]);

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
      kidSfx('tap', 0.6);
      if (fullYear(after.lit)) startLap();
    }, 200);
    return () => clearInterval(id);
  }, [phase, lang]);

  /** All four lit: a beat, then the pointer goes once round the year by itself. */
  const startLap = () => {
    setPhase('lap'); setAnnounce(`${w.full} ${w.fullLine}`); kidSfx('correct');
    cancelMotion();
    const from = turnsRef.current;
    const begin = setTimeout(() => {
      if (reducedRef.current) {
        // Reduced motion: four still pictures, one per season, then back where it was.
        const start = seasonAt(wrapYear(from));
        for (let i = 1; i <= 4; i++) {
          anim.current.timers.push(setTimeout(() => {
            const target = i === 4 ? wrapYear(from) : SEASON_CENTERS[(start + i) % 4];
            commit(turnsRef.current + shortestTurn(wrapYear(turnsRef.current), target));
            if (i === 4) setPhase('ready');
          }, (i - 1) * LAP_CUT_MS));
        }
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / LAP_MS);
        commit(from + easeInOut(t));
        if (t < 1) anim.current.frame = requestAnimationFrame(step);
        else { anim.current.frame = 0; setPhase('ready'); }
      };
      anim.current.frame = requestAnimationFrame(step);
    }, 700);
    anim.current.timers.push(begin);
  };

  /** A season button, PageUp/PageDown or a tap on the dial: the short way round. */
  const goTo = (target: number) => {
    handOn();
    const from = turnsRef.current;
    if (reducedRef.current) { commit(from + shortestTurn(wrapYear(from), target)); return; }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TURN_MS);
      commit(turnAt(from, target, t));
      anim.current.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    anim.current.frame = requestAnimationFrame(step);
  };
  const nudge = (steps: number) => { handOn(); void selectionHaptic(); commit(turnsRef.current + steps * YEAR_STEP); };

  const angleOf = (e: { clientX: number; clientY: number }) => {
    const box = dialEl.current?.getBoundingClientRect();
    if (!box) return null;
    const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2);
    return { deg: pointerAngle(dx, dy), near: Math.hypot(dx, dy) < box.width * 0.12 };
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || drag.current) return;
    const at = angleOf(e); if (!at) return;
    handOn();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
    drag.current = { id: e.pointerId, last: at.deg, raw: turnsRef.current, moved: 0, at: detentAt(wrapYear(turnsRef.current)), x: e.clientX, y: e.clientY };
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const at = angleOf(e); if (!at) return;
    if (at.near) { d.last = at.deg; return; } // too close to the hub to tell a direction
    const delta = angleDelta(d.last, at.deg);
    d.last = at.deg; d.raw += delta; d.moved += Math.abs(delta);
    const y = wrapYear(d.raw);
    const shown = d.raw + shortestTurn(y, detent(y));
    commit(shown);
    const s = detentAt(wrapYear(shown));
    if (s !== null && s !== d.at) { audio.current?.click(); void selectionHaptic(); }
    d.at = s;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    // A tap (no turn, no travel) sends the pointer to where the finger touched.
    if (d.moved < 0.01 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) {
      const at = angleOf(e);
      if (at && !at.near) goTo(angleToYear(at.deg));
    }
  };
  const cancel = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current?.id === e.pointerId) drag.current = null; };
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
    cancelMotion(); rest.current = null; drag.current = null; turnsRef.current = START_YEAR;
    setTurns(START_YEAR); setLit(0); setPaused(false); setAnnounce(''); setPhase('play'); setRound(r => r + 1);
  };

  const year = wrapYear(turns), season = seasonAt(year), phaseText = w.phases[phaseAt(year)];
  const still = paused || reduced;

  return <GameShell fullBleed autoNarrate={false} worldId="season-dial" title={w.title} instruction={w.instruction}>
    {phase === 'done'
      ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={replay} playAgainLabel={shared.again} homeLabel={shared.home} />
      : <section className="adventure sd" data-adventure="season-dial" data-phase={phase} data-season={season} data-paused={still} dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="sd-layout">
          <div className="sd-scene" role="img" aria-label={`${w.scene}. ${phaseText}`}>
            <SeasonScene year={Math.round(year * 2000) / 2000} />
            <SeasonWeather year={year} still={still} />
            <SceneGrain />
            <span className="sd-plate" aria-hidden="true"><span className="sd-plate__dot" style={{ background: QUARTER_FILL[season] }} />{w.seasons[season]}</span>
            {phase !== 'play' && <span className="sd-ribbon" aria-hidden="true">{w.full}</span>}
          </div>
          <div className="sd-console">
            {/* The dial is an object, not text: it keeps its turn and its corners in Hebrew too. */}
            <div className="sd-dialbox" dir="ltr">
              <div ref={dialEl} className="sd-dial" data-sd-dial="" role="slider" tabIndex={0} aria-label={w.dial} aria-orientation="horizontal"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(year * 100)} aria-valuetext={phaseText}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
                <DialArt turns={turns} lit={lit} glow={phase !== 'play'} />
              </div>
              {SEASONS.map(s => <button type="button" key={s} className="sd-season" data-season={s} aria-pressed={season === s} aria-label={seasonLine(w.goTo, w.seasons[s])}
                style={{ background: QUARTER_FILL[s] }} onClick={() => { void selectionHaptic(); goTo(SEASON_CENTERS[s]); }}>
                <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false"><SeasonArt season={s} /></svg>
              </button>)}
            </div>
            <div className="sd-controls">
              <button type="button" className="sd-control" aria-label={w.back} onClick={() => nudge(-1)}><RotateCcw size={26} aria-hidden="true" /></button>
              <button type="button" className="sd-control sd-control--pause" aria-pressed={paused} onClick={() => setPaused(p => !p)}>
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
