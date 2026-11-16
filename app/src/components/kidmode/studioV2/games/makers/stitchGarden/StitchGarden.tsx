import { useState } from 'react';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { GameFinish, GameShell } from '../../../../game/GameShell';
import { ADVENTURE_COPY } from '../../adventures/adventureCopy';
import { STITCH_GARDEN_COPY } from './stitchGardenCopy';
import type { TextileCreation } from './stitchGardenRules';
import StitchGardenCover from './StitchGardenCover';

/** Placeholder play: one button finishes, so intro → play → result → replay
 * → back is testable before the game is built. Replaced by the builder. */
export default function StitchGarden() {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = STITCH_GARDEN_COPY[lang], shared = ADVENTURE_COPY[lang];
  const [done, setDone] = useState(false);
  const made: TextileCreation = { kind: 'textile', cloth: 'linen', motifs: [{ flower: 'daisy', cell: 0, thread: 0 }] };
  return <GameShell fullBleed autoNarrate={false} worldId="stitch-garden" title={w.title} instruction={w.instruction}>
    <section className="adventure" data-adventure="stitch-garden" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {done ? <GameFinish creation={made} title={w.finish} subtitle={w.transfer} onPlayAgain={() => setDone(false)} playAgainLabel={shared.again} homeLabel={shared.home} /> : <>
        <div style={{ inlineSize: '100%', aspectRatio: '4 / 3', borderRadius: 16, overflow: 'hidden' }}><StitchGardenCover size="card" /></div>
        <p className="adventure-status">{w.instruction}</p>
        <div className="adventure-actions"><button type="button" data-maker-stub-finish="" className="studio-game-button-v2 studio-game-button-v2--primary" onClick={() => setDone(true)}>{w.done}</button></div>
      </>}
    </section>
  </GameShell>;
}
