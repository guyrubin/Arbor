import { useState } from 'react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { WINDUP_RACE_COPY } from './windupRaceCopy';
import WindupRaceCover from './WindupRaceCover';

/** Placeholder play: one button finishes, so intro → play → result → replay
 * → back is testable before the game is built. Replaced by the builder. */
export default function WindupRace() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = WINDUP_RACE_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  return <GameShell fullBleed autoNarrate={false} worldId="windup-race" title={w.title} instruction={w.instruction}>
    <section className="adventure" data-adventure="windup-race" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done ? <GameFinish title={w.finish} subtitle={w.transfer} onPlayAgain={() => setDone(false)} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div style={{ inlineSize: '100%', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden' }}><WindupRaceCover size="card" /></div>
        <p className="adventure-status">{w.instruction}</p>
        <div className="adventure-actions"><button type="button" data-maker-stub-finish="" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={() => setDone(true)}>{w.done}</button></div>
      </>}
    </section>
  </GameShell>;
}
