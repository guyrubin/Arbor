/** CI-only access to retained activity routes using the real production hosts.
 * There is no completion adapter: tests must operate each activity's controls. */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewProvider, configurePreviewChild, useLanguage } from './adapters';
import StudioGame from '../../src/components/kidmode/studioV2/StudioGame';
import StudioWorld from '../../src/components/kidmode/studioV2/StudioWorld';
import { studioActivity, studioSurfaceFor, type StudioActivityId } from '../../src/components/kidmode/studioV2/studioCatalog';
import { studioCopy } from '../../src/components/kidmode/studioV2/studioCopy';
import { setKidAudioChild, kidHush, closeKidAudio } from '../../src/components/kidmode/audio/kidAudio';
import { setKidHome, useKidStage } from '../../src/components/kidmode/kidChrome';
import { KidStage } from '../../src/components/kidmode/KidStage';
import { kidStageFor } from '../../src/components/kidmode/kidStageArt';
import { KidSoundToggle } from '../../src/components/kidmode/kidReadAloud';
import { HoldExitButton } from '../../src/components/kidmode/HoldExitButton';
import { ArrowLeft } from 'lucide-react';
const HeroArcade = lazy(() => import('../../src/components/practice/HeroArcade'));

const childId = 'studio-v2-synthetic-review';
function ActivityReview({ initial }: { initial: StudioActivityId }) {
  const { uiLang } = useLanguage();
  const [activityId, setActivityId] = useState(initial);
  const [world, setWorld] = useState(false);
  const activity = studioActivity(activityId)!;
  const copy = studioCopy(uiLang);
  const stage = useKidStage();
  const arcade = studioSurfaceFor(activityId) === 'arcade';
  useEffect(() => {
    setKidAudioChild(childId);
    setKidHome(() => setWorld(true));
    return () => { setKidHome(null); closeKidAudio(); };
  }, []);
  useEffect(() => { kidHush(); }, [world, activityId]);
  return <main className="arbor-play studio-review" data-kid-studio="" data-activity-review={activityId} dir={uiLang === 'he' ? 'rtl' : 'ltr'} style={{ position: 'relative', isolation: 'isolate' }}>
    {!world && arcade && <KidStage scene={stage ?? kidStageFor('arcade', activityId)} />}
    <header className="studio-v2-bar review-bar">
      <button type="button" data-review-back="" onClick={() => setWorld(true)} aria-label={uiLang === 'he' ? 'חזרה' : 'Back'}><ArrowLeft /></button>
      <strong data-kid-bar-title="">{world ? copy.worlds[activity.worldId].title : copy.activities[activityId].title}</strong>
      <KidSoundToggle childId={childId} lang={uiLang} />
      <HoldExitButton onExit={() => setWorld(true)} />
    </header>
    {world ? <StudioWorld worldId={activity.worldId} onActivity={id => { setActivityId(id); setWorld(false); }} onBooks={() => {}} />
      : studioSurfaceFor(activityId) === 'studio-game'
        ? <StudioGame activityId={activityId} onBack={() => setWorld(true)} />
        : <section className="studio-retained-activity" style={{ position: 'relative', zIndex: 1, padding: 20 }}><Suspense fallback={<p role="status">{uiLang === 'he' ? 'רגע…' : 'One moment…'}</p>}><HeroArcade initialWorldId={activityId} /></Suspense></section>}
  </main>;
}

export function mountActivityReview(root: HTMLElement) {
  const id = new URLSearchParams(location.search).get('activityReview') ?? '';
  if (!studioActivity(id)) throw new Error('Unknown review activity');
  configurePreviewChild({ id: childId, name: 'Noa', age: 7, ageMonths: 86, ageMonthsAsOf: '2026-11-19', kidTheme: 'film3d' });
  createRoot(root).render(<PreviewProvider><ActivityReview initial={id as StudioActivityId} /></PreviewProvider>);
}
