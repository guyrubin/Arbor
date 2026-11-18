/** CI-only fixture around the actual legacy reader. Child/profile/storage are
 * synthetic; the book's real static files, routing, words and choices are not
 * stubbed. Narration availability is separately controlled by the browser. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { PreviewProvider, configurePreviewChild, useLanguage } from './adapters';
import HeroJourneyTab from '../../src/components/tabs/HeroJourneyTab';
import { ToastProvider } from '../../src/context/ToastContext';
import { KidStage } from '../../src/components/kidmode/KidStage';
import { useKidSurfaceTitle } from '../../src/components/kidmode/kidSurfaceTitle';
import { KidSoundToggle } from '../../src/components/kidmode/kidReadAloud';
import { HoldExitButton } from '../../src/components/kidmode/HoldExitButton';
import { setKidAudioChild, setKidReadAloudMuted, closeKidAudio } from '../../src/components/kidmode/audio/kidAudio';
import { Icon } from '../../src/components/ui/Icon';
import { setAuthTokenProvider } from '../../src/lib/api';
import { JOSEPH_STORY_ID } from '../../src/lib/storyPlateArt';

const CHILD_ID = 'joseph-synthetic-review';
// Deliberately geometric test identity, never a real person's likeness.
const HERO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="20" fill="#eff7f4"/><circle cx="80" cy="52" r="29" fill="#287e76"/><path d="M35 144V112a45 45 0 0 1 90 0v32" fill="#315c82"/><path d="m67 55 10 9 20-24" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>');

function JosephReview() {
  const { uiLang, t } = useLanguage();
  const surfaceTitle = useKidSurfaceTitle();
  const [closed, setClosed] = useState(false);
  useEffect(() => { setKidAudioChild(CHILD_ID); return () => closeKidAudio(); }, []);
  const close = () => { closeKidAudio(); setClosed(true); };
  return <div className="arbor-play" data-kid-staged="" data-joseph-review="" dir={uiLang === 'he' ? 'rtl' : 'ltr'}
    style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--arbor-paper)', overflow: 'hidden' }}>
    <KidStage scene={{ kind: 'story', storyId: JOSEPH_STORY_ID }} />
    <header style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, paddingInline: 12, paddingBlock: 10, flexShrink: 0, background: 'var(--arbor-paper-elevated)', borderBottom: '1px solid var(--arbor-rule)', boxShadow: 'var(--shadow-xs)' }}>
      <button type="button" data-joseph-review-exit="" onClick={close} aria-label={t('kid.back.homeAria')}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, borderRadius: 'var(--r)', background: 'var(--arbor-paper-deep)', color: 'var(--arbor-clay)', border: '1px solid var(--arbor-rule)' }}><Icon name="chevron_left" size={20} className="rtl:-scale-x-100" /></button>
      <span data-kid-bar-title="" style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 'var(--kid-t-say)', lineHeight: 1.15, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', color: 'var(--arbor-clay)', flex: '1 1 0%', minWidth: 0 }}>{surfaceTitle ?? (uiLang === 'he' ? 'הספרים שלי' : 'My books')}</span>
      <KidSoundToggle childId={CHILD_ID} lang={uiLang} />
      <HoldExitButton onExit={close} idleLabel={t('kid.exit.backToParent')} ariaIdle={t('kid.exit.backToParentAria')} />
    </header>
    <div data-joseph-review-scroll="" style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingInline: 20, paddingBlock: 24, minHeight: 0 }}>
      {closed ? <p data-joseph-review-closed="">{uiLang === 'he' ? 'התצוגה נסגרה' : 'Review closed'}</p> : <HeroJourneyTab initialStoryId={JOSEPH_STORY_ID} pinNonce={1} />}
    </div>
  </div>;
}

export function mountJosephReview(root: HTMLElement): void {
  const query = new URLSearchParams(location.search);
  const lang = query.get('lang') === 'he' ? 'he' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  configurePreviewChild({ id: CHILD_ID, name: lang === 'he' ? 'נועה' : 'Noa', nameLatin: 'Noa', age: 7, ageMonths: 84, ageMonthsAsOf: '2026-11-18', gender: query.get('gender') === 'boy' ? 'boy' : 'girl', kidTheme: 'film3d', primaryLanguage: lang, languages: ['en', 'he'], avatar: { source: 'descriptor', style: 'comichero' }, photoUrl: HERO });
  setAuthTokenProvider(async () => 'synthetic-joseph-reader');
  setKidReadAloudMuted(CHILD_ID, true);
  Object.assign(window, { josephReviewFixture: { childId: CHILD_ID, heroUrl: HERO, synthetic: true, narration: 'unavailable' } });
  createRoot(root).render(<PreviewProvider><ToastProvider><MotionConfig reducedMotion="user"><JosephReview /></MotionConfig></ToastProvider></PreviewProvider>);
}
