import { NEXT_GAME_COPY } from "../../../../../lib/i18nGameNext";
import { useEffect, useState } from 'react';
import { stopVoice } from '../../../../../lib/voice';
import { StoryProp } from './StoryProp';
import { StudioPlayHero } from '../../StudioPlayHero';
import { ArrowRight, Theater, Cloud, CloudRain, HandHeart, Heart, HelpCircle, Leaf, Sparkles, Sun, Volume2, Wind } from 'lucide-react';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useArborOptional } from '../../../../../context/ArborContext';
import { ArborMascot } from '../../../../ui/ArborMascot';
import { GameShell, GameFinish } from '../../../game/GameShell';
import { kidSay, kidSfx, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { AdventureHeading, AdventureSteps, AdventureScenery } from './AdventureShared';
import { ADVENTURE_COPY } from './adventureCopy';
import { defaultChallenge, shuffled } from './adventureRules';
import { ACTION_NAMES, FEELING_NAMES, FOREST_STORIES, type Feeling, type KindAction } from './forestStories';

const FEELING_GLYPHS = { sad: CloudRain, worried: Cloud, angry: Wind, excited: Sparkles, proud: Sun, lonely: Leaf };
const ACTION_GLYPHS = { together: Heart, space: HandHeart, help: HelpCircle };
export default function FeelingsForest() {
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"]; const lang = uiLang === 'he' ? 'he' : 'en'; const w = ADVENTURE_COPY[lang];
  const child = useArborOptional()?.childProfile; const childId = child?.id ?? ''; const muted = useKidReadAloudMuted(childId);
  const [stories, setStories] = useState(() => shuffled(FOREST_STORIES).slice(0, 3));
  const [round, setRound] = useState(0); const [phase, setPhase] = useState<'feeling' | 'support' | 'outcome' | 'done'>('feeling');
  const [action, setAction] = useState<KindAction>('together'); const [status, setStatus] = useState('');
  const story = stories[round];
  const FeelingGlyph = FEELING_GLYPHS[story.feeling];
  const ActionGlyph = ACTION_GLYPHS[action];
  const [order] = useState(() => shuffled<Feeling>(['sad', 'worried', 'angry', 'excited', 'proud', 'lonely']));
  const choiceCount = defaultChallenge(child) === 'gentle' ? 3 : 4;
  const choices = order.filter(feeling => feeling === story.feeling || order.filter(f => f !== story.feeling).slice(0, choiceCount - 1).includes(feeling));
  const text = phase === 'outcome' ? story.responses[action][lang] : story.story[lang];
  useEffect(() => () => stopVoice(), [text]);
  const next = () => { if (round === 2) setPhase('done'); else { setRound(value => value + 1); setPhase('feeling'); setStatus(''); } };
  return <GameShell fullBleed worldId="feelings-forest" title={w.forest} instruction={w.forestInstruction} hearIt={`${text} ${phase === 'feeling' ? w.forestQuestion : phase === 'support' ? w.forestKind : ''}`}>
    <section className="adventure adventure--forest" data-adventure="feelings-forest" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {phase === 'done' ? <GameFinish title={w.forestFinish} subtitle={w.forestTransfer} onPlayAgain={() => { setStories(shuffled(FOREST_STORIES).slice(0, 3)); setRound(0); setPhase('feeling'); setStatus(''); }} playAgainLabel={w.again} homeLabel={w.home} /> : <>
        <div className="adventure-toolbar"><span className="adventure-eyebrow"><Theater size={18} aria-hidden="true" />{w.forest}</span><AdventureSteps done={round} /></div>
        <div className="forest-stage" data-phase={phase} data-action={phase === 'outcome' ? action : undefined}><AdventureScenery world="story-theater" /><div className="forest-friends"><div className="forest-prop" key={story.id} aria-hidden="true"><StoryProp story={story.id} /></div><StudioPlayHero size={170} pose={phase === 'outcome' ? 'hold-up' : 'idle'} /><div className="forest-response" aria-hidden="true">{phase === 'outcome' ? <ActionGlyph size={38} /> : <FeelingGlyph size={38} />}</div><div className="forest-mascot"><ArborMascot size={170} mood={phase === 'outcome' ? 'wave' : 'calm'} animate={false} /></div></div>
          <div className="forest-story"><p>{text}</p><button type="button" disabled={muted} className="adventure-hear" aria-label={w.hear} onClick={() => kidSay(childId, text, lang)}><Volume2 size={23} aria-hidden="true" /></button></div>
        </div>
        <AdventureHeading focusKey={`${round}:${phase}`}>{phase === 'feeling' ? w.forestQuestion : phase === 'support' ? w.forestKind : w.forestAll}</AdventureHeading>
        {phase === 'feeling' && <div className="forest-choices" role="group" aria-label={w.forestQuestion}>{choices.map(feeling => {
          const Glyph = FEELING_GLYPHS[feeling]; return <button type="button" key={feeling} data-feeling={feeling} onClick={() => {
            if (feeling === story.feeling) { setPhase('support'); setStatus(w.forestSame); kidSfx('correct'); } else setStatus(w.forestOther);
          }}><Glyph aria-hidden="true" size={32} /><span>{FEELING_NAMES[feeling][lang]}</span></button>;
        })}</div>}
        {phase === 'support' && <div className="forest-choices forest-choices--support" role="group" aria-label={w.forestKind}>{(['together', 'space', 'help'] as const).map(choice => {
          const Glyph = ACTION_GLYPHS[choice]; return <button type="button" key={choice} onClick={() => { setAction(choice); setPhase('outcome'); setStatus(''); }}><Glyph size={32} aria-hidden="true" /><span>{ACTION_NAMES[choice][lang]}</span></button>;
        })}</div>}
        <p className="adventure-status" role="status">{status || '\u00a0'}</p>
        {phase === 'outcome' && <div className="adventure-actions"><button type="button" className="studio-game-button-v2" onClick={() => { setPhase('support'); setStatus(''); }}>{nextWords.otherHelp}</button><button type="button" className="studio-game-button-v2 studio-game-button-v2--primary adventure-go" onClick={next}>{round === 2 ? w.finish : w.forestNext}<ArrowRight size={20} aria-hidden="true" /></button></div>}
        {phase === 'outcome' && round === 2 && <p className="adventure-transfer">{w.forestTransfer}</p>}
      </>}
    </section>
  </GameShell>;
}
