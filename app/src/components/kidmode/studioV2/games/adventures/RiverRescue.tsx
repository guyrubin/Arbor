import { useEffect, useRef, useState } from 'react';
import { StudioPlayHero } from '../../StudioPlayHero';
import { useKidTheme } from '../../../../../hooks/useKidTheme';
import { kidArt, kidArtSrcSet } from '../../../../../lib/kidThemeManifest';
import { Anchor, Check, Lightbulb, Mountain, Package, Sailboat, Undo2, Waves } from 'lucide-react';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx } from '../../../audio/kidAudio';
import { AdventureHeading, AdventureSteps, ChallengePicker } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, makeRiverMap, riverComplete, riverHint, riverMove, type Challenge } from './adventureRules';

export default function RiverRescue() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en'; const w = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile;
  const theme = useKidTheme(); const scene = kidArt(theme, 'world.river-rescue.tile');
  const [challenge, setChallenge] = useState<Challenge>(() => defaultChallenge(child));
  const [variation] = useState(() => Math.floor(Math.random() * 8));
  const [round, setRound] = useState(0);
  const map = makeRiverMap(challenge, round, variation + round);
  const [path, setPath] = useState<number[]>(() => [map.start]);
  const [phase, setPhase] = useState<'plan' | 'sail' | 'arrived' | 'done'>('plan');
  const [boatStep, setBoatStep] = useState(0); const [hint, setHint] = useState<number | null>(null); const [status, setStatus] = useState('');
  const pathRef = useRef(path); pathRef.current = path;
  useEffect(() => {
    if (phase !== 'sail') return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const move = () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') { timer = setTimeout(move, 400); return; }
      setBoatStep(previous => previous + 1);
    };
    timer = setTimeout(move, 380);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, boatStep]);
  useEffect(() => { if (phase === 'sail' && boatStep >= path.length - 1) { setPhase('arrived'); kidSfx('correct'); } }, [phase, boatStep, path.length]);
  const reset = (level = challenge, nextRound = round) => {
    setChallenge(level); setRound(nextRound); const next = [makeRiverMap(level, nextRound, variation + nextRound).start];
    pathRef.current = next; setPath(next); setBoatStep(0); setPhase('plan'); setHint(null); setStatus('');
  };
  const choose = (cell: number) => {
    if (phase !== 'plan') return;
    const current = pathRef.current; const result = riverMove(map, current, cell);
    const errors = { near: w.riverNear, used: w.riverUsed, rock: w.riverRock, parcels: w.riverParcels };
    if (result !== 'ok') { setStatus(errors[result]); return; }
    const next = [...current, cell]; pathRef.current = next; setPath(next); setHint(null); setStatus('');
  };
  const ready = riverComplete(map, path);
  const boat = phase === 'plan' ? map.start : path[Math.min(boatStep, path.length - 1)];
  const label = phase === 'arrived' ? w.riverArrived : phase === 'sail' ? w.riverSailing : ready ? w.riverReady : w.riverPlan;
  return <GameShell worldId="river-rescue" title={w.river} instruction={w.riverInstruction} hearIt={`${w.riverInstruction} ${label}`}>
    <section className="adventure adventure--river" dir={lang === 'he' ? 'rtl' : 'ltr'} data-adventure="river-rescue">
      {phase === 'done' ? <GameFinish title={w.riverFinish} subtitle={w.riverTransfer} onPlayAgain={() => reset(challenge, 0)} playAgainLabel={w.again} homeLabel={w.home} /> : <>
        <div className="adventure-toolbar"><ChallengePicker value={challenge} onChange={level => reset(level, 0)} words={w} /><AdventureSteps done={round} /></div>
        <AdventureHeading focusKey={`${round}:${phase}`}>{label}</AdventureHeading>
        <div className="river-landscape">{scene && !scene.hasHero && <img className="river-scene" src={scene.src} srcSet={kidArtSrcSet(scene)} sizes="(max-width: 700px) 100vw, 1000px" alt="" draggable={false} />}<div className="river-bank" aria-hidden="true"><span>✿</span><span>❋</span><span>✿</span></div>
          <div className="river-board" role="group" aria-label={w.riverBoard} dir="ltr" style={{ gridTemplateColumns: `repeat(${map.size}, 1fr)` }}>
            {Array.from({ length: map.size * map.size }, (_, cell) => {
              const isRock = map.rocks.includes(cell), isParcel = map.parcels.includes(cell), isDock = cell === map.dock;
              const visited = path.includes(cell), collected = isParcel && visited;
              const Glyph = cell === boat ? Sailboat : isRock ? Mountain : isDock ? Anchor : isParcel ? Package : Waves;
              const name = cell === boat ? w.boat : isRock ? w.rock : isDock ? w.dock : isParcel ? w.parcel : w.water;
              return <button type="button" key={cell} className="river-cell" data-cell={cell} data-path={visited} data-rock={isRock} data-hint={hint === cell} data-dock={isDock} data-parcel={isParcel} data-boat={cell === boat}
                disabled={phase !== 'plan'} aria-pressed={visited} aria-label={`${w.row} ${Math.floor(cell / map.size) + 1}, ${w.column} ${cell % map.size + 1}: ${name}`} onClick={() => choose(cell)}>
                <Glyph aria-hidden="true" strokeWidth={1.8} />{collected && <Check className="river-collected" size={16} aria-hidden="true" />}
                {visited && cell !== boat && !isParcel && !isDock && <span className="river-trail" aria-hidden="true" />}
              </button>;
            })}
            <span className="river-vessel" aria-hidden="true" style={{ left: `${(boat % map.size + .5) * 100 / map.size}%`, top: `${(Math.floor(boat / map.size) + .5) * 100 / map.size}%`, width: `${80 / map.size}%`, height: `${80 / map.size}%` }}>
              <StudioPlayHero size={42} celebrate={phase === 'arrived'} /><Sailboat strokeWidth={1.5} />
            </span>
          </div><div className="river-bank river-bank--bottom" aria-hidden="true"><span>✿</span><span>❋</span><span>✿</span></div>
        </div>
        <div className="river-cargo" aria-label={w.parcel}>{map.parcels.map(cell => <span key={cell} data-collected={path.includes(cell)}><Package size={22} aria-hidden="true" />{path.includes(cell) && <Check size={15} aria-hidden="true" />}</span>)}</div>
        <p className="adventure-status" role="status">{status || '\u00a0'}</p>
        <div className="adventure-actions">
          {phase === 'plan' && <>
            <button type="button" className="studio-game-button-v2" disabled={path.length < 2} onClick={() => { const next = pathRef.current.slice(0, -1); pathRef.current = next; setPath(next); setHint(null); setStatus(''); }}><Undo2 size={20} aria-hidden="true" />{w.undo}</button>
            <button type="button" className="studio-game-button-v2" disabled={ready} onClick={() => { const next = riverHint(map, path); setHint(next); setStatus(next === null ? w.riverUndoHint : w.riverHint); }}><Lightbulb size={20} aria-hidden="true" />{w.hint}</button>
            <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" disabled={!ready} onClick={() => { if (riverComplete(map, pathRef.current)) { setPhase('sail'); setBoatStep(0); setStatus(''); } }}><Sailboat size={23} aria-hidden="true" />{w.sail}</button>
          </>}
          {phase === 'arrived' && <button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={() => round === 2 ? setPhase('done') : reset(challenge, round + 1)}>{round === 2 ? w.finish : w.next}<Check size={20} aria-hidden="true" /></button>}
        </div>
        {phase === 'arrived' && round === 2 && <p className="adventure-transfer">{w.riverTransfer}</p>}
      </>}
    </section>
  </GameShell>;
}
