/** Catalogue-wide operated-reader fixture. Uses the real readers and authored
 * manuscripts. Only identity, storage, narration and plan image availability
 * are synthetic; these fixtures never grant a real family book eligibility. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { PreviewProvider, configurePreviewChild, useLanguage } from './adapters';
import HeroJourneyTab from '../../src/components/tabs/HeroJourneyTab';
import { BookReader } from '../../src/components/library/BookReader';
import { ToastProvider } from '../../src/context/ToastContext';
import { KidStage } from '../../src/components/kidmode/KidStage';
import { useKidSurfaceTitle } from '../../src/components/kidmode/kidSurfaceTitle';
import { KidSoundToggle } from '../../src/components/kidmode/kidReadAloud';
import { HoldExitButton } from '../../src/components/kidmode/HoldExitButton';
import { setKidAudioChild, setKidReadAloudMuted, closeKidAudio } from '../../src/components/kidmode/audio/kidAudio';
import { Icon } from '../../src/components/ui/Icon';
import { setAuthTokenProvider } from '../../src/lib/api';
import { KID_SHELF_STORIES } from '../../src/lib/heroJourneys';
import { authoredScene, authoredChoice } from '../../src/lib/heroJourneyRender';
import { LIBRARY_BOOKS } from '../../src/lib/library/books';
import { PLAN_FIXTURE_BOOKS, authoredPatterns } from '../../src/lib/library/plans/planBooks';
import { bookChoices } from '../../src/lib/library/bookShape';
import { bookPoseIds } from '../../src/lib/library/bookPoses';
import { readPath } from '../../src/lib/library/bookFlow';
import { fillHero, heGender, pageParagraphs } from '../../src/lib/library/bookText';
import type { AnyBook, BookReaderChild } from '../../src/lib/library/types';
import type { HeroSheet } from '../../src/lib/library/heroSheet';

const CHILD_ID = 'catalogue-synthetic-review';
// Deliberately geometric, never a person's likeness or an alternative hero.
const HERO = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160"><circle cx="60" cy="38" r="27" fill="#287e76"/><path d="M22 151V98a38 38 0 0 1 76 0v53" fill="#315c82"/><path d="m47 39 10 9 20-24" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/></svg>');

function LegacyReview({ storyId }: { storyId: string }) {
  const { uiLang, t } = useLanguage();
  const title = useKidSurfaceTitle();
  const [closed, setClosed] = useState(false);
  useEffect(() => { setKidAudioChild(CHILD_ID); return () => closeKidAudio(); }, []);
  const close = () => { closeKidAudio(); setClosed(true); };
  return <div className="arbor-play" data-kid-staged="" data-story-catalogue-review="legacy" dir={uiLang === 'he' ? 'rtl' : 'ltr'}
    style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--arbor-paper)', overflow: 'hidden' }}>
    <KidStage scene={{ kind: 'story', storyId }} />
    <header className="studio-v2-bar" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <button type="button" data-catalogue-exit="" onClick={close} aria-label={t('kid.back.homeAria')}><Icon name="chevron_left" size={20} className="rtl:-scale-x-100" /></button>
      <strong data-kid-bar-title="" style={{ flex: '1 1 0%', minWidth: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', lineHeight: 1.15 }}>{title ?? (uiLang === 'he' ? 'הספרים שלי' : 'My books')}</strong>
      <KidSoundToggle childId={CHILD_ID} lang={uiLang} />
      <HoldExitButton onExit={close} idleLabel={t('kid.exit.backToParent')} ariaIdle={t('kid.exit.backToParentAria')} />
    </header>
    <div data-catalogue-scroll="" style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingInline: 20, paddingBlock: 24, minHeight: 0 }}>
      {closed ? <p data-catalogue-closed="">{uiLang === 'he' ? 'התצוגה נסגרה' : 'Review closed'}</p> : <HeroJourneyTab initialStoryId={storyId} pinNonce={1} />}
    </div>
  </div>;
}

function CanonicalReview({ book, lang, child, sheet, onComplete }: { book: AnyBook; lang: 'en' | 'he'; child: BookReaderChild; sheet: HeroSheet; onComplete: () => void }) {
  const [closed, setClosed] = useState(false);
  useEffect(() => { setKidAudioChild(CHILD_ID); return () => closeKidAudio(); }, []);
  return <div className="arbor-play" data-story-catalogue-review={book.kind === 'plan' ? 'plan' : 'book'}>
    {closed ? <p data-catalogue-closed="">{lang === 'he' ? 'התצוגה נסגרה' : 'Review closed'}</p> : <BookReader book={book} lang={lang} child={child} onClose={() => { closeKidAudio(); setClosed(true); }} onComplete={onComplete}
      dev={false} narration="off" sheet={sheet} assets={{ files: {}, cues: {} }} />}
  </div>;
}

export function mountStoryCatalogueReview(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const kind = params.get('storyCatalogue');
  const id = params.get('id') ?? '';
  const lang = params.get('lang') === 'he' ? 'he' : 'en';
  const gender = params.get('gender') === 'boy' ? 'boy' : 'girl';
  const name = lang === 'he' ? 'נועה' : 'Noa';
  const child: BookReaderChild = { id: CHILD_ID, name, gender };
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  setAuthTokenProvider(async () => 'synthetic-story-catalogue');
  setKidReadAloudMuted(CHILD_ID, true);
  const catalogue = { legacy: KID_SHELF_STORIES.map(s => s.id), books: Object.keys(LIBRARY_BOOKS), plans: authoredPatterns().map(p => p.id) };
  const evidence = { kind, id, childId: CHILD_ID, lang, gender, hero: HERO, synthetic: true, catalogue, completed: 0, narration: 'unavailable' };
  let view: React.ReactNode;
  if (kind === 'legacy') {
    const story = KID_SHELF_STORIES.find(s => s.id === id);
    if (!story) throw new Error('Only eligible legacy catalogue definitions may enter this fixture');
    const profile = { ...child, nameLatin: 'Noa', age: story.ageRange[0], ageMonths: story.ageRange[0] * 12, ageMonthsAsOf: '2026-11-19', kidTheme: 'film3d', primaryLanguage: lang, languages: ['en', 'he'], avatar: { source: 'descriptor', style: 'comichero' }, photoUrl: HERO };
    configurePreviewChild(profile);
    const choices = (story.beats.find(b => b.id === 'decision')?.choices ?? []).map(c => authoredChoice(c, lang, profile));
    const paths = choices.map(choice => ({ choice: choice.id, label: choice.label, pages: story.beats.map(beat => ({ id: beat.id, text: beat.id === 'consequence' ? choice.consequence : authoredScene(beat, lang, undefined, profile).narration })) }));
    Object.assign(window, { storyCatalogueFixture: { ...evidence, title: lang === 'he' ? story.titleHe : story.title, paths, artwork: id === 'joseph-and-his-brothers' ? 'reviewed static cover and eight plates' : 'existing title card and seeded illustration; no new page art' } });
    view = <LegacyReview storyId={id} />;
  } else {
    const book = kind === 'book' ? LIBRARY_BOOKS[id] : kind === 'plan' ? PLAN_FIXTURE_BOOKS[`${id}--demo`] : undefined;
    if (!book) throw new Error('Only real canonical books or authored plan-pattern fixtures may enter this fixture');
    const choices = bookChoices(book);
    const paths = (choices.length ? choices.map(c => c.id) : [null]).map(choice => ({ choice, pages: readPath(book, choice).map(page => {
      const items = page.repair?.items.map(item => item.id) ?? [];
      const paragraphs = (done: string[]) => pageParagraphs(page, { lang, gender: heGender(gender), choiceId: choice, repaired: done }).map(text => fillHero(text, name, lang));
      return { id: page.id, hero: Boolean(page.hero), plateId: page.plateId, text: paragraphs([]), repaired: items.map((item, index) => ({ item, text: paragraphs(items.slice(0, index + 1)) })), artStates: page.artStates?.map(state => state.id) ?? [] };
    }) }));
    const sheet: HeroSheet = { id: 'synthetic-catalogue-sheet', poses: Object.fromEntries(bookPoseIds(book).map(pose => [pose, HERO])), anchors: Object.fromEntries(bookPoseIds(book).map(pose => [pose, { aspect: .75, footX: .5, footW: .5 }])) };
    const info = { ...evidence, title: book.title[lang], paths, artwork: kind === 'book' ? 'real committed child-free plates; geometric synthetic pose sheet' : 'synthetic geometric plan plates and pose sheet; not production art acceptance' };
    Object.assign(window, { storyCatalogueFixture: info });
    view = <CanonicalReview book={book} lang={lang} child={child} sheet={sheet} onComplete={() => { info.completed++; }} />;
  }
  createRoot(root).render(<PreviewProvider><ToastProvider><MotionConfig reducedMotion="user">{view}</MotionConfig></ToastProvider></PreviewProvider>);
}
