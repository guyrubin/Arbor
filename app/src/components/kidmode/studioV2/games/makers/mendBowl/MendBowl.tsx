import { useState } from 'react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import { BOWL_SEAM_COUNTS, type BowlCreation } from './mendBowlRules';
import MendBowlCover from './MendBowlCover';

/** Placeholder play: one button finishes, so intro → play → result → replay
 * → back is testable before the game is built. Replaced by the builder. */
export default function MendBowl() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = MEND_BOWL_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const made: BowlCreation = { kind: 'bowl', glaze: 'celadon', pattern: 0, seams: Array.from({ length: BOWL_SEAM_COUNTS[0] }, (_, i) => i) };
  return <GameShell fullBleed autoNarrate={false} worldId="mend-bowl" title={w.title} instruction={w.instruction}>
    <section className="adventure" data-adventure="mend-bowl" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done ? <GameFinish creation={made} title={w.finish} subtitle={w.transfer} onPlayAgain={() => setDone(false)} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div style={{ inlineSize: '100%', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden' }}><MendBowlCover size="card" /></div>
        <p className="adventure-status">{w.instruction}</p>
        <div className="adventure-actions"><button type="button" data-maker-stub-finish="" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={() => setDone(true)}>{w.done}</button></div>
      </>}
    </section>
  </GameShell>;
}
