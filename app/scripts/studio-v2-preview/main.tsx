import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Languages } from 'lucide-react';
import { PreviewProvider, useLanguage } from './adapters';
import StudioHome from '../../src/components/kidmode/studioV2/StudioHome';
import StudioWorld from '../../src/components/kidmode/studioV2/StudioWorld';
import StudioGame from '../../src/components/kidmode/studioV2/StudioGame';
import StudioCollection from '../../src/components/kidmode/studioV2/StudioCollection';
import StudioQuest from '../../src/components/kidmode/studioV2/StudioQuest';
import { setKidAudioChild, kidHush, kidAudioVisibility, closeKidAudio } from '../../src/components/kidmode/audio/kidAudio';
import { HoldExitButton } from '../../src/components/kidmode/HoldExitButton';
import { KidHearItButton, KidSoundToggle } from '../../src/components/kidmode/kidReadAloud';
import { studioActivity, type StudioActivityId, type StudioWorldId } from '../../src/components/kidmode/studioV2/studioCatalog';
import { studioCopy } from '../../src/components/kidmode/studioV2/studioCopy';
import '../../src/index.css';
import './preview.css';
type View = 'home' | 'world' | 'game' | 'collection' | 'quest' | 'books';
function Preview() {
  const { uiLang, setUiLang } = useLanguage();
  const [view, setView] = useState<View>('home');
  const [world, setWorld] = useState<StudioWorldId>('playbank');
  const [game, setGame] = useState<StudioActivityId>('river-rescue');
  useEffect(() => {
    setKidAudioChild('studio-v2-synthetic-review');
    const visibility = () => kidAudioVisibility(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', visibility);
    return () => { document.removeEventListener('visibilitychange', visibility); closeKidAudio(); };
  }, []);
  useEffect(() => { kidHush(); }, [view, game]);
  const copy = studioCopy(uiLang);
  const openGame = (id: StudioActivityId) => { setGame(id); setWorld(studioActivity(id)?.worldId ?? 'playbank'); setView('game'); window.scrollTo(0,0); };
  const home = () => { setView('home'); window.scrollTo(0,0); };
  const title = view === 'game' ? copy.activities[game].title : view === 'world' ? copy.worlds[world].title : view === 'quest' ? (uiLang === 'he' ? 'פינה נעימה' : 'A cozy corner') : copy.collection;
  const back = () => { setView(view === 'game' ? 'world' : 'home'); window.scrollTo(0,0); };
  return <>
    <main className="arbor-play studio-review" dir={uiLang === 'he' ? 'rtl' : 'ltr'}>
      {view !== 'home' && <header className="studio-v2-bar review-bar"><button onClick={back} aria-label={uiLang === 'he' ? 'חזרה' : 'Back'}><ArrowLeft /></button><strong data-kid-bar-title="">{title}</strong><KidHearItButton /><KidSoundToggle childId="studio-v2-synthetic-review" lang={uiLang} /><HoldExitButton onExit={home} /></header>}
      {view === 'home' && <StudioHome onWorld={id => {setWorld(id);setView('world');}} onCollection={() => setView('collection')} onQuest={() => setView('quest')} onExit={home} />}
      {view === 'world' && <StudioWorld worldId={world} onActivity={openGame} onBooks={() => setView('books')} />}
      {view === 'game' && <StudioGame activityId={game} onBack={() => setView('world')} />}
      {view === 'collection' && <StudioCollection onActivity={openGame} onBooks={() => setView('books')} onQuest={() => setView('quest')} onHome={home} />}
      {view === 'quest' && <StudioQuest onHome={home} />}
      {view === 'books' && <section className="review-books"><h1>{copy.books}</h1><p>{uiLang === 'he' ? 'הספרים האישיים מופיעים באפליקציה שלך.' : 'Your personal books appear in the Arbor app.'}</p><button className="studio-game-button-v2" onClick={home}>{uiLang === 'he' ? 'לשמיים שלי' : 'Back to my sky'}</button></section>}
    </main>
    <footer className="review-tools"><span>{uiLang === 'he' ? 'תצוגת עיצוב • נבט מלווה כאן. באפליקציה מופיע האווטאר המאושר של הילד.' : 'Design preview • Sprout stands in here. The app uses your child’s approved avatar.'}</span><button onClick={() => setUiLang(uiLang === 'he' ? 'en' : 'he')}><Languages size={18} />{uiLang === 'he' ? 'English' : 'עברית'}</button></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<PreviewProvider><Preview /></PreviewProvider>);
