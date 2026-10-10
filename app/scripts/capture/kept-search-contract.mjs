/** Bounded additive acceptance. Pure manifest/fixtures; no browser or I/O. */
import { recordFixture } from './record-contract.mjs';
export const KEPT_SEARCH_NOW = '2026-10-10T06:00:00.000Z';
const rows = (route, states) => states.map(state => ({ route, state }));
export const KEPT_SEARCH_STATES = Object.freeze([
  ...rows('journal', ['capture-optional', 'capture-plain-saved', 'capture-quote-default', 'capture-manual-choice',
    'capture-cancel-repeat', 'capture-required-fields',
    'journal-parent-lineage', 'journal-ai-lineage', 'journal-unverified-lineage', 'journal-ai-edit-confirm', 'journal-unverified-edit-confirm',
    'capture-child-return', 'journal-normalized-search']),
  ...rows('development', ['capture-manual-first-saved', 'capture-manual-independent-saved', 'kept-projection', 'kept-review-cancel-repeat', 'kept-stale-final-send', 'kept-stale-open-repeat']),
  ...rows('shell', ['search-private-normalized', 'search-punctuation-bidi', 'search-normalized-empty', 'search-visit-current', 'search-prepare-current']),
  ...rows('journal', ['search-private-arrival']),
  ...rows('appointments', ['search-visit-arrival']),
  ...rows('consult', ['search-prepare-arrival']),
  ...rows('academy', ['learn-normalized-search', 'learn-normalized-arrival']),
]);
export const KEPT_SEARCH_LIMITATIONS = Object.freeze([
  { state: 'lineage', status: 'synthetic-preload', reason: 'AI-draft and unverified rows are preloaded fixtures with dormant kept markers. Real edit/confirm, Journal projection and final text Send are exercised; no model extraction, transcription, provider quality or authorship inference is claimed.' },
  { state: 'persistence', status: 'local-only', reason: 'All writes are to the isolated synthetic child localStorage. No real child, remote acknowledgement, Firestore metadata, provider, credentials or external recipient is used.' },
  { state: 'share', status: 'synthetic-egress-only', reason: 'Actual final Send reaches the existing synthetic browser text-share sink only. Final source-freshness guards are tested on the Kept reader, not claimed for the generic Journal ShareButton.' },
  { state: 'child-switch', status: 'actual-close-switch-return', reason: 'Dialogs close through their real controls before the real child switcher is used. No clicks behind a modal, React mutation or forced hidden actions manufacture a stale continuation.' },
  { state: 'normalized-empty', status: 'scope-specific', reason: 'Global marks-only search must not enumerate private records. Journal and Learn retain their existing unfiltered empty-query semantics.' },
  { state: 'prior-release', status: 'preserved-separate', reason: 'The previous 858-cell confirmed-actions-release manifest is unchanged. This bounded additive group is not a rerun or a visual/native-Hebrew approval of those states.' },
]);
export const KEPT_SEARCH_QUERIES = Object.freeze({ hebrew: 'שלומ', latin: 'CAFE', punctuation: 'אב־גד', punctuationNegative: 'אב גד', bidi: '\u2067סוד\u2069', bidiNegative: 'ס\u2067וד', empty: '\u05b0\u05b7' });
export const KEPT_SEARCH_LEARN = Object.freeze({
  en: { query: 'EXÉCUTIVE FUNCTION', title: "Executive function: the brain's air-traffic control" },
  he: { query: 'תִּפְקוּדִימ נִיהוּלִיִּימ', title: 'תפקודים ניהוליים: מגדל הפיקוח של המוח' },
});
export function keptSearchFixture(bundle, lang) {
  const fixture = recordFixture(bundle, lang);
  const body = fixture.parsed.locales?.[lang] ?? fixture.parsed;
  const he = lang === 'he';
  const words = {
    plain: he ? 'בחרנו ספר יחד' : 'We chose a book',
    quote: he ? '"עוד ספר בבקשה"' : '"Another book please"',
    first: he ? 'עליתי על המדרגה' : 'I climbed the step',
    independent: he ? 'לבשתי מעיל בעצמי' : 'I put on my coat',
    cancelled: he ? 'רגע מומצא שלא נשמר' : 'An invented unsaved moment',
    parent: he ? 'מילים מקוריות של ההורה' : 'Original parent words',
    ai: he ? 'ניסוח מומצא מארבור' : 'Invented Arbor wording',
    unverified: he ? 'ניסוח מומצא שמקורו לא אומת' : 'Invented unverified wording',
    editedAi: he ? '"ניסוח ארבור אחרי עריכה"' : '"Edited Arbor wording"',
    editedUnverified: he ? '"מקור לא מאומת אחרי עריכה"' : '"Edited unverified wording"',
    search: 'שָׁלוֹם Café אב־גד \u2067סוד\u2069',
  };
  const row = (id, trigger, patch = {}) => ({ id, timestamp: '2026-10-09T10:00:00.000Z', behaviorType: 'Moment', trigger, durationMinutes: 0, kept: 'said', ...patch });
  const collections = Object.fromEntries(Object.keys(body.collections).map(name => [name, []]));
  collections.behaviorLogs = [
    row('capture-lineage-parent', words.parent),
    row('capture-lineage-ai', words.ai, { contentSource: 'ai_draft' }),
    row('capture-lineage-unverified', words.unverified, { contentSource: 'unverified' }),
    row('capture-search-private', words.search, { kept: undefined }),
  ];
  body.collections = collections;
  body.siblings[0].collections = Object.fromEntries(Object.keys(collections).map(name => [name, []]));
  return { ...fixture, collections, words, lang, sourceLabels: he
    ? { ai_draft: 'כולל ניסוח שנכתב על ידי ארבור', unverified: 'מקור הטקסט לא אומת' }
    : { ai_draft: 'Contains wording drafted by Arbor', unverified: 'Text source not verified' } };
}
