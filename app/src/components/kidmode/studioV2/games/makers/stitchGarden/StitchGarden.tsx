import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, FolderOpen, Undo2 } from 'lucide-react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../../context/ArborContext';
import { selectionHaptic } from '../../../../../../lib/native';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { useStudioCreations } from '../../../studioCreations';
import { AdventureHeading } from '../../adventures/AdventureShared';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { STITCH_GARDEN_COPY, sgLine } from './stitchGardenCopy';
import { TEXTILE_CLOTHS, TEXTILE_COLUMNS, TEXTILE_FLOWERS, TEXTILE_MAX_MOTIFS, TEXTILE_THREADS, cellColumn, cellRow, freeCells, plant, reopenTextile, storyLines, textileOf, unpick, type TextileCloth, type TextileFlower, type TextileMotif } from './stitchGardenRules';
import { ART_H, ART_W, STITCH_MS, TICK_EVERY, UNPICK_MS, cellTarget, stitchesFor } from './stitchGardenStitches';
import { createStitchSounds, type StitchSounds } from './stitchGardenAudio';
import { ClothPatch, FlowerSwatch, PARKED_NEEDLE, Spool, TextileScene, type NeedlePose, type SceneMotif, type StoryRim } from './StitchArt';
import './stitchGarden.css';

type Phase = 'play' | 'lifting' | 'done';
/** The needle at work on one flower: stitching it in (`from` 0 up to all of
 * its stitches) or pulling it out (back down to none). */
interface Run { mode: 'stitch' | 'unpick'; motif: TextileMotif; from: number; to: number; per: number; start: number }
interface Drag { flower: TextileFlower; x: number; y: number; over: number | null; home: { x: number; y: number }; back: boolean }

const LIFT_MS = 1300, LIFT_STILL_MS = 650, FADE_MS = 700, WOBBLE_MS = 420, DRIFT_MS = 260, DRAG_START_PX = 9;
const stillMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export default function StitchGarden() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = STITCH_GARDEN_COPY[lang], shared = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? '');
  const [phase, setPhase] = useState<Phase>('play');
  const [cloth, setCloth] = useState<TextileCloth>('linen');
  const [flower, setFlower] = useState<TextileFlower>('daisy');
  const [thread, setThread] = useState(0);
  const [motifs, setMotifsState] = useState<TextileMotif[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [shown, setShown] = useState(0);
  /** A flower being pulled out: no longer on the cloth, still visible. */
  const [leaving, setLeaving] = useState<TextileMotif | null>(null);
  /** The hem line of an unpicked flower, fading away. */
  const [fading, setFading] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [wobble, setWobble] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [reopened, setReopened] = useState(false);
  const motifsRef = useRef<TextileMotif[]>(motifs);
  const runRef = useRef<Run | null>(null);
  const sounds = useRef<StitchSounds | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const press = useRef<{ flower: TextileFlower; id: number; x: number; y: number; started: boolean; home: { x: number; y: number } } | null>(null);
  const swallowClick = useRef(false);
  const setMotifs = (next: TextileMotif[]) => { motifsRef.current = next; setMotifsState(next); };
  const startRun = (next: Run | null) => { runRef.current = next; setRun(next); setShown(next ? next.from : 0); };

  const later = (ms: number, task: () => void) => {
    const id = setTimeout(() => { timers.current = timers.current.filter(item => item !== id); task(); }, ms);
    timers.current.push(id);
  };
  useEffect(() => {
    const instance = createStitchSounds(); sounds.current = instance;
    return () => { for (const id of timers.current) clearTimeout(id); timers.current = []; instance.dispose(); sounds.current = null; };
  }, []);

  /** A hidden tab or a reduced-motion switch never leaves the needle mid-flower:
   * whatever it was doing is simply done. */
  const settle = () => {
    const current = runRef.current;
    if (current?.mode === 'unpick') setLeaving(null);
    if (current) startRun(null);
    sounds.current?.stop();
  };
  const settleRef = useRef(settle); settleRef.current = settle;
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') settleRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  /** The needle's clock: one stitch at a time, drawn by the frame. */
  useEffect(() => {
    if (!run) return;
    let frame = 0, ticked = -1;
    const total = Math.abs(run.to - run.from), dir = run.to >= run.from ? 1 : -1;
    const step = () => {
      const done = Math.min(total, Math.floor((now() - run.start) / run.per) + 1);
      const at = run.from + dir * done;
      setShown(at);
      if (run.mode === 'stitch') {
        const beat = Math.floor(done / TICK_EVERY);
        if (beat !== ticked) { ticked = beat; sounds.current?.tick(run.motif.thread); }
      }
      if (done >= total) {
        if (runRef.current === run) {
          if (run.mode === 'unpick') setLeaving(null);
          else setNote(w.story[motifsRef.current.length - 1] ?? '');
          startRun(null);
        }
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [run]);

  const busy = phase !== 'play';
  const plantAt = (cell: number, pick: TextileFlower = flower) => {
    if (busy) return;
    const next = plant(motifsRef.current, pick, cell, thread);
    if (!next) { setWobble(true); later(WOBBLE_MS, () => setWobble(false)); return; }
    void selectionHaptic();
    // A flower still being stitched is finished at once; the needle moves on.
    if (runRef.current?.mode === 'unpick') setLeaving(null);
    setMotifs(next);
    const motif = next[next.length - 1];
    if (stillMotion()) { startRun(null); setNote(w.story[next.length - 1] ?? ''); sounds.current?.tick(thread); return; }
    const count = stitchesFor(motif.flower, motif.cell).length;
    setNote(w.stitching);
    startRun({ mode: 'stitch', motif, from: 0, to: count, per: STITCH_MS / count, start: now() });
  };
  const takeOut = () => {
    if (busy || motifsRef.current.length === 0) return;
    void selectionHaptic();
    const last = motifsRef.current[motifsRef.current.length - 1];
    const total = stitchesFor(last.flower, last.cell).length;
    const current = runRef.current;
    const from = current?.mode === 'stitch' && current.motif.cell === last.cell ? shown : total;
    const wasTold = !(current?.mode === 'stitch' && current.motif.cell === last.cell);
    setMotifs(unpick(motifsRef.current));
    sounds.current?.pull();
    setNote(w.unpicked);
    if (wasTold) { const index = motifsRef.current.length; setFading(index); later(FADE_MS, () => setFading(value => value === index ? null : value)); }
    if (stillMotion()) { setLeaving(null); startRun(null); return; }
    setLeaving(last);
    startRun({ mode: 'unpick', motif: last, from, to: 0, per: UNPICK_MS / total, start: now() });
  };
  const finish = () => {
    if (busy || motifsRef.current.length === 0) return;
    void selectionHaptic();
    settle(); setLeaving(null); setFading(null); setNote(''); setPhase('lifting');
    later(stillMotion() ? LIFT_STILL_MS : LIFT_MS, () => setPhase('done'));
  };
  const reopen = () => {
    const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
    const open = kept && saved.isCurrent() ? reopenTextile(kept) : null;
    if (!open || busy || motifsRef.current.length > 0) return;
    void selectionHaptic();
    setCloth(open.cloth); setMotifs(open.motifs); setReopened(true); setNote(w.story[open.motifs.length - 1] ?? '');
  };
  const reset = () => {
    for (const id of timers.current) clearTimeout(id); timers.current = [];
    settle(); setMotifs([]); setLeaving(null); setFading(null); setNote(''); setWobble(false); setDrag(null); setReopened(false);
    setCloth('linen'); setFlower('daisy'); setThread(0); setPhase('play');
  };

  /** Drag a pattern card onto the cloth. A tap still just picks the flower. */
  const spotAt = (x: number, y: number): number | null => {
    if (typeof document === 'undefined' || !document.elementsFromPoint) return null;
    for (const el of document.elementsFromPoint(x, y)) {
      const spot = (el as HTMLElement).closest?.('[data-sg-spot]') as HTMLElement | null;
      if (spot && !(spot as HTMLButtonElement).disabled) return Number(spot.dataset.sgSpot);
    }
    return null;
  };
  const onCardDown = (pick: TextileFlower) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const box = e.currentTarget.getBoundingClientRect();
    press.current = { flower: pick, id: e.pointerId, x: e.clientX, y: e.clientY, started: false, home: { x: box.left + box.width / 2, y: box.top + box.height / 2 } };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Capture is a nicety. */ }
  };
  const onCardMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId) return;
    if (!p.started) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
      p.started = true; setFlower(p.flower);
    }
    setDrag({ flower: p.flower, x: e.clientX, y: e.clientY, over: spotAt(e.clientX, e.clientY), home: p.home, back: false });
  };
  const onCardUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.started) return;
    swallowClick.current = true; later(0, () => { swallowClick.current = false; });
    const over = spotAt(e.clientX, e.clientY);
    if (over !== null) { setDrag(null); plantAt(over, p.flower); return; }
    // Not over a free cross: the card drifts back to the tray.
    setDrag({ flower: p.flower, x: p.home.x, y: p.home.y, over: null, home: p.home, back: true });
    later(stillMotion() ? 0 : DRIFT_MS, () => setDrag(null));
  };
  const onCardCancel = () => { press.current = null; setDrag(null); };

  const free = phase === 'play' ? freeCells(motifs) : [];
  const stitching = run?.mode === 'stitch' ? run : null;
  const storyCount = motifs.length - (stitching ? 1 : 0);
  const lines = storyLines(w.story, storyCount);
  const rim: StoryRim[] = [];
  if (lines.length > 0) rim.push({ text: lines[lines.length - 1], key: `l${lines.length - 1}` });
  if (fading !== null && w.story[fading]) rim.push({ text: w.story[fading], key: `f${fading}`, leaving: true });
  const scene: SceneMotif[] = motifs.map(motif => ({ motif, count: stitching && stitching.motif.cell === motif.cell ? shown : undefined }));
  if (leaving && run?.mode === 'unpick') scene.push({ motif: leaving, count: shown, leaving: true });

  const workStitches = useMemo(() => run ? stitchesFor(run.motif.flower, run.motif.cell) : [], [run]);
  const needle: NeedlePose | null = phase === 'play' ? (() => {
    if (!run || workStitches.length === 0) return PARKED_NEEDLE;
    const index = Math.max(0, Math.min(workStitches.length - 1, shown - 1));
    const s = workStitches[index];
    const prev = workStitches[Math.max(0, index - 1)];
    const ax = s.knot ? s.x1 - prev.x1 : s.x2 - s.x1, ay = s.knot ? s.y1 - prev.y1 : s.y2 - s.y1;
    const angle = Math.hypot(ax, ay) < 0.01 ? -55 : Math.atan2(ay, ax) * 180 / Math.PI;
    return { x: s.knot || shown === 0 ? s.x1 : s.x2, y: s.knot || shown === 0 ? s.y1 : s.y2, angle, working: true };
  })() : null;

  const cue = phase === 'lifting' ? w.cueLifting : stitching ? sgLine(w.cueStitching, w.flowers[stitching.motif.flower])
    : motifs.length === 0 ? w.cueStart : motifs.length >= TEXTILE_MAX_MOTIFS ? w.cueFull : w.cueMore;
  const kept = saved.items.find(item => item.creation.kind === 'textile')?.creation;
  const canReopen = !reopened && motifs.length === 0 && !leaving && phase === 'play' && !!kept && !!reopenTextile(kept);
  // Spots follow the reading direction for the keyboard; on the cloth they stay put.
  const spotOrder = lang === 'he' ? [...free].sort((a, b) => cellRow(a) - cellRow(b) || cellColumn(b) - cellColumn(a)) : free;
  const made = textileOf(cloth, motifs);

  return <GameShell fullBleed autoNarrate={false} worldId="stitch-garden" title={w.title} instruction={w.instruction}>
    <section className="adventure adventure--stitch" data-adventure="stitch-garden" data-phase={phase} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' && made ? <GameFinish creation={made} title={w.finish} subtitle={w.transfer} onPlayAgain={reset} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <AdventureHeading focusKey={phase}>{cue}</AdventureHeading>
        <div className="sg-cloths" role="group" aria-label={w.clothLabel}>
          {TEXTILE_CLOTHS.map(id => <button type="button" key={id} className="sg-cloth" data-cloth={id} aria-pressed={cloth === id} disabled={busy} onClick={() => { void selectionHaptic(); setCloth(id); }}>
            <ClothPatch cloth={id} /><span>{w.cloths[id]}</span>
          </button>)}
        </div>
        <div className="sg-stage" data-wobble={wobble} data-phase={phase}>
          <TextileScene cloth={cloth} motifs={scene} hoop={phase === 'play' ? 'on' : 'lifting'} story={rim} lang={lang} crosses={free} needle={needle} needleThread={run ? run.motif.thread : thread} aim={drag?.over ?? null} />
          <div className="sg-spots" dir="ltr" role="group" aria-label={w.hoopLabel}>
            {spotOrder.map(cell => { const t = cellTarget(cell);
              return <button type="button" key={cell} className="sg-spot" data-sg-spot={cell} data-aim={drag?.over === cell} style={{ insetInlineStart: `${t.x / ART_W * 100}%`, insetBlockStart: `${t.y / ART_H * 100}%` }}
                aria-label={`${sgLine(w.spot, w.flowers[flower])}, ${w.spotPlace[cellRow(cell)]} ${lang === 'he' ? TEXTILE_COLUMNS - cellColumn(cell) : cellColumn(cell) + 1}`} onClick={() => plantAt(cell)} />; })}
          </div>
        </div>
        <div className="sg-tray">
          <div className="sg-flowers" role="group" aria-label={w.flowerLabel}>
            {TEXTILE_FLOWERS.map(id => <button type="button" key={id} className="sg-card" data-flower={id} aria-pressed={flower === id} disabled={busy}
              onPointerDown={onCardDown(id)} onPointerMove={onCardMove} onPointerUp={onCardUp} onPointerCancel={onCardCancel}
              onClick={() => { if (swallowClick.current) return; void selectionHaptic(); setFlower(id); }}>
              <FlowerSwatch flower={id} thread={thread} cloth={cloth} /><span>{w.flowerNames[id]}</span>
            </button>)}
          </div>
          <div className="sg-threads" role="group" aria-label={w.threadLabel}>
            {Array.from({ length: TEXTILE_THREADS }, (_, index) => <button type="button" key={index} className="sg-thread" data-thread={index} aria-pressed={thread === index} aria-label={w.threads[index]} disabled={busy} onClick={() => { void selectionHaptic(); setThread(index); }}>
              <Spool thread={index} />
            </button>)}
          </div>
        </div>
        <p className="adventure-status sg-note" role="status">{note}</p>
        <div className="adventure-actions sg-actions">
          {canReopen && <button type="button" className="studio-game-button-v2" onClick={reopen}><FolderOpen size={20} aria-hidden="true" />{w.reopen}</button>}
          <button type="button" className="studio-game-button-v2" data-sg-unpick="" disabled={busy || motifs.length === 0} onClick={takeOut}><Undo2 size={20} aria-hidden="true" />{w.unpick}</button>
          <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" data-sg-finish="" disabled={busy || motifs.length === 0} onClick={finish}><Check size={20} aria-hidden="true" />{w.done}</button>
        </div>
        {(lines.length > 0 || fading !== null) && <ol className="sg-story" aria-label={w.storyLabel}>
          {lines.map((line, index) => <li key={`l${index}`} data-newest={index === lines.length - 1}>{line}</li>)}
          {fading !== null && w.story[fading] && <li key={`f${fading}`} data-leaving="true" aria-hidden="true">{w.story[fading]}</li>}
        </ol>}
      </>}
      {drag && typeof document !== 'undefined' && createPortal(<span className="sg-ghost" data-back={drag.back} style={{ transform: `translate3d(${drag.x}px, ${drag.y}px, 0)` }} aria-hidden="true"><FlowerSwatch flower={drag.flower} thread={thread} cloth={cloth} size="ghost" /></span>, document.body)}
    </section>
  </GameShell>;
}
