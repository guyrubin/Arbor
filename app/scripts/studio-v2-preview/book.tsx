/** CI-only synthetic book open. Uses the production reader and image loader;
 * the operated-browser harness answers the real first-party image endpoint. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BookReader } from '../../src/components/library/BookReader';
import { PLAN_FIXTURE_BOOKS } from '../../src/lib/library/plans/planBooks';
import { fiveSmoothStones } from '../../src/lib/library/books/fiveSmoothStones';
import { bookFlowReducer, initialBookFlow } from '../../src/lib/library/bookFlow';
import { setAuthTokenProvider } from '../../src/lib/api';

export function mountBookReview(root: HTMLElement) {
  const query = new URLSearchParams(window.location.search);
  const lang = query.get('lang') === 'he' ? 'he' : 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  setAuthTokenProvider(async () => 'synthetic-book-picture');
  // No family lookup, fixture mutation, generated artwork or narration.
  const book = query.get('bookReview') === 'five-smooth-stones' ? fiveSmoothStones : PLAN_FIXTURE_BOOKS['plan-poo-sit--demo'];
  const initialState = query.has('cover') ? initialBookFlow() : bookFlowReducer(book, initialBookFlow(), { type: 'open' });
  createRoot(root).render(<div className="arbor-play" data-synthetic-book-review="">
    <BookReader book={book} lang={lang} child={{ id: 'synthetic-book-review', name: 'Noa', gender: 'girl' }} onClose={() => {}} dev={false} narration="off" sheet={null} assets={{ files: {}, cues: {} }} initialState={initialState} />
  </div>);
}
