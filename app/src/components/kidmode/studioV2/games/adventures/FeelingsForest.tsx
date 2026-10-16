import { NEXT_GAME_COPY } from "../../../../../lib/i18nGameNext";
import { useState } from 'react';
import { AdventureSprout, useAdventureVoice } from './AdventureGuide';
import { FeelingSprite } from './AdventureSprite';
import { StudioAdventureScene } from '../../StudioAdventureScene';
import { StoryProp } from './StoryProp';
import { StudioPlayHero } from '../../StudioPlayHero';
import { ArrowRight, Theater, HandHeart, Heart, HelpCircle, Volume2 } from 'lucide-react';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSfx } from '../../../audio/kidAudio';
import { AdventureHeading, AdventureSteps } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, shuffled } from './adventureRules';
import { ACTION_NAMES, FEELING_NAMES, FOREST_STORIES, type Feeling, type KindAction } from './forestStories';

const ACTION_GLYPHS = { together: Heart, space: HandHeart, help: HelpCircle };
export default function FeelingsForest() {
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"]; const lang = uiLang === 'he' ? 'he' : 'en'; const w = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile; const childId = child?.id ?? '';
  const [stories, setStories] = useState(() => shuffled(FOREST_STORIES).slice(0, 3));
  const [round, setRound] = useState(0); const [phase, setPhase] = useState<'feeling' | 'support' | 'outcome' | 'done'>('feeling');
  const [action, setAction] = useState<KindAction>('together'); const [status, setStatus] = useState('');
  const story = stories[round];
  const joyful = story.feeling === 'excited' || story.feeling === 'proud';
  const ActionGlyph = ACTION_GLYPHS[action];
  const [order] = useState(() => shuffled<Feeling>(['sad', 'worried', 'angry', 'excited', 'proud', 'lonely']));
  const choiceCount = defaultChallenge(child) === 'gentle' ? 3 : 4;
  const choices = order.filter(feeling => feeling === story.feeling || order.filter(f => f !== story.feeling).slice(0, choiceCount - 1).includes(feeling));
  const text = phase === 'outcome' ? story.responses[action][lang] : story.story[lang];
  const cue = phase === 'feeling' ? w.forestQuestion : phase === 'support' ? w.forestKind : w.forestAll;
  const narration = phase === 'support' ? `${status} ${cue}`.trim() : `${status ? status + ' ' : ''}${text} ${cue}`;
  const guide = useAdventureVoice({ childId, lang, text: narration, cueKey: `${round}:${phase}:${status}`, enabled: phase !== 'done' });
  const next = () => { if (round === 2) setPhase('done'); else { setRound(value => value + 1); setPhase('feeling'); setStatus(''); } };
  return <GameShell fullBleed autoNarrate={false} worldId="feelings-forest" title={w.forest} instruction={w.forestInstruction} hearIt={narration}>
    <section className="adventure adventure--forest" data-adventure="feelings-forest" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish title={w.forestFinish} subtitle={w.forestTransfer} onPlayAgain={() => { setStories(shuffled(FOREST_STORIES).slice(0, 3)); setRound(0); setPhase('feeling'); setStatus(''); }} playAgainLabel={w.again} homeLabel={w.home} /> : <>
        <div className="adventure-toolbar"><span className="adventure-eyebrow"><Theater size={18} aria-hidden="true" />{w.forest}</span><AdventureSteps done={round} /></div>
        <div className="forest-stage" data-phase={phase} data-action={phase === 'outcome' ? action : undefined}><div className="forest-visual"><StudioAdventureScene activityId="feelings-forest" /><div className="forest-friends"><div className="forest-prop" key={story.id} aria-hidden="true"><StoryProp story={story.id} /></div><StudioPlayHero size={280} pose={phase === 'outcome' && action === 'help' ? 'hold-up' : 'idle'} celebrate={phase === 'outcome' && action === 'together' && joyful} /><div className="forest-response" aria-hidden="true">{phase === 'outcome' ? <ActionGlyph size={38} /> : <FeelingSprite feeling={story.feeling} />}</div><div className="forest-mascot"><AdventureSprout size={180} speaking={guide.speaking} action={phase === 'outcome' ? joyful && action !== 'space' ? 'celebrate' : 'comfort' : phase === 'support' ? 'listen' : joyful ? 'celebrate' : 'think'} /></div></div></div>
          <div className="forest-story"><p>{text}</p><button type="button" disabled={guide.muted} className="adventure-hear" aria-label={w.hear} onClick={guide.replay}><Volume2 size={23} aria-hidden="true" /></button></div>
        </div>
        <AdventureHeading focusKey={`${round}:${phase}`}>{cue}</AdventureHeading>
        {phase === 'feeling' && <div className="forest-choices" role="group" aria-label={w.forestQuestion}>{choices.map(feeling => {
          return <button type="button" key={feeling} data-feeling={feeling} onClick={() => {
            if (feeling === story.feeling) { setPhase('support'); setStatus(w.forestSame); kidSfx('correct'); } else setStatus(w.forestOther);
          }}><FeelingSprite feeling={feeling} /><span>{FEELING_NAMES[feeling][lang]}</span></button>;
        })}</div>}
        {phase === 'support' && <div className="forest-choices forest-choices--support" role="group" aria-label={w.forestKind}>{(['together', 'space', 'help'] as const).map(choice => {
          const Glyph = ACTION_GLYPHS[choice]; return <button type="button" key={choice} onClick={() => { setAction(choice); setPhase('outcome'); setStatus(''); }}><Glyph size={32} aria-hidden="true" /><span>{ACTION_NAMES[choice][lang]}</span></button>;
        })}</div>}
        <p className="adventure-status" role="status">{status}</p>
        {phase === 'outcome' && <div className="adventure-actions"><button type="button" className="studio-game-button-v2" onClick={() => { setPhase('support'); setStatus(''); }}>{nextWords.otherHelp}</button><button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={next}>{round === 2 ? w.finish : w.forestNext}<ArrowRight size={20} aria-hidden="true" /></button></div>}
        {phase === 'outcome' && round === 2 && <p className="adventure-transfer">{w.forestTransfer}</p>}
      </>}
    </section>
  </GameShell>;
}
