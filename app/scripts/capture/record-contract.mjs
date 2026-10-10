/** Pure synthetic record contract. No browser, app, model or network imports. */
import { BEHAVIOR_RECORD_STATES } from './record-behaviors.mjs';
export const RECORD_STATES = Object.freeze([
  ...BEHAVIOR_RECORD_STATES,
  ...['kept-closed', 'kept-reader', 'filter-said', 'filter-firsts', 'filter-independent', 'filter-keyboard-all',
    'item-review', 'item-close-focus', 'item-repeat-review', 'reviewed-send-sandbox', 'month-review-unfiltered', 'month-print',
    'stale-final-send', 'stale-open-repeat', 'child-switch', 'child-return', 'kept-empty', 'kept-error', 'kept-retry',
    'kept-incomplete', 'kept-load-more', 'preserved-firsts', 'preserved-tree', 'retired-development'].map(state => ({ route: 'development', state })),
  { route: 'timeline', state: 'preserved-timeline-months' },
  { route: 'language', state: 'preserved-said-page' },
  { route: 'milestones', state: 'preserved-milestone-editor' },
  { route: 'consult', state: 'professional-quote-record' },
  ...['overview', 'memory'].map(route => ({ route, state: `retired-${route}` })),
  ...['milestones', 'language', 'timeline'].flatMap(route => [
    { route: 'shell', state: `search-${route}-label` }, { route, state: `search-${route}-arrived` },
  ]),
]);
export const RECORD_LIMITATIONS = Object.freeze([
  { state: 'sustained-loading', status: 'not-exercised', reason: 'Local history reads are synchronous effect reads; no source loading-delay seam exists. No hook or confirmation metadata is replaced.' },
  { state: 'remote-cache-only', status: 'not-exercised', reason: 'The local sandbox has no Firestore snapshot metadata. Remote confirmed/cache transitions remain covered by source tests only.' },
  { state: 'account-switch', status: 'not-exercised', reason: 'No real account or auth provider is used. Actual in-app synthetic child switching is captured separately.' },
  { state: 'native-share-and-native-print', status: 'not-exercised', reason: 'Reviewed Send reaches a labeled browser-only sink; print uses the actual web download/popup shell. Neither proves an OS destination or printer.' },
]);
export const RETIRED_MONTH_IDS = Object.freeze(['growth-month-in-review', 'month-keepsake', 'memory-first-month']);
export const RECORD_SOURCE_NAMES = Object.freeze(['behaviorLogs', 'milestones', 'keepsakes', 'langObs']);
export const SEARCH_ROUTES = Object.freeze([
  { route: 'milestones', en: 'Milestones', he: 'אבני דרך', contentSelector: '[data-testid="ms-header"]' },
  { route: 'language', en: 'Language & Communication', he: 'שפה ותקשורת', contentSelector: '[data-module="language-capture"]' },
  { route: 'timeline', en: 'Story', he: 'סיפור', contentSelector: '[data-testid="timeline-context-group"]' },
]);

/** Keep the real provenance-negative fixture in storage. This checks only
 * quote projections: incident/practice records can legitimately appear in
 * other professional sections, but must not become a child's quote. */
export function recordQuoteProjection(text, fixture) {
  const negative = fixture.collections.keepsakes.find(row => row.id === 'capture-record-ai');
  return { genuinePresent: typeof text === 'string' && text.includes(fixture.text.quote),
    generatedAbsent: typeof text === 'string' && !!negative && !text.includes(negative.note),
    negativeFixtureIntact: negative?.source === 'ai_proposed_parent_confirmed' && negative?.note === fixture.text.forbidden[1] };
}

/** Horizontal usability includes every filter, and the actual focus outline
 * inside clipping ancestors. A hittable center alone can hide the first glyph. */
export function recordFiltersFit(frame) {
  return frame?.buttons?.length === 4 && frame.buttons.every(button => {
    const values = [frame.width, frame.reader?.left, frame.reader?.right, button.left, button.right, button.clipLeft, button.clipRight, button.outline];
    return values.every(Number.isFinite) && button.right > button.left && button.outline >= 0
      && button.left >= Math.max(0, frame.reader.left) && button.right <= Math.min(frame.width, frame.reader.right)
      && button.left - button.outline >= button.clipLeft && button.right + button.outline <= button.clipRight;
  });
}

export function recordFixture(bundle, lang) {
  const parsed = JSON.parse(typeof bundle === 'string' ? bundle : JSON.stringify(bundle));
  const body = parsed?.locales?.[lang] ?? parsed;
  if (!['en', 'he'].includes(lang) || parsed?.parent?.demo !== true || body?.child?.demo !== true || !/^[\w-]{1,100}$/.test(body.child.id ?? '') || !Array.isArray(body.collections?.milestones) || !body.collections.milestones.length) throw new Error('SYNTHETIC_RECORD_FIXTURE_REQUIRED');
  const he = lang === 'he';
  const text = {
    boundary: he ? 'אור בספטמבר' : 'September moon', word: he ? 'עוד ספר' : 'Another book',
    quote: he ? 'הירח אמר <שלום> & "לילה טוב"' : 'The moon said <hello> & "good night"',
    first: he ? 'שלושה צעדים אליי' : 'Three steps toward me',
    alone: he ? 'לבשתי את המעיל לבד' : 'I put my coat on myself',
    forbidden: ['CAPTURE INCIDENT MUST STAY OUT', 'CAPTURE AI QUOTE MUST STAY OUT', 'CAPTURE PRACTICE MUST STAY OUT', 'CAPTURE UNKNOWN MUST STAY OUT', 'CAPTURE COPARENT MUST STAY OUT'],
  };
  const milestone = { ...body.collections.milestones[0], id: 'capture-record-first', custom: true, checked: true, observationStatus: 'yes', observedAt: '2026-10-04T12:00:00Z', observationUpdatedAt: '2026-10-04T12:00:00Z' };
  const moment = (id, trigger, patch = {}) => ({ id, timestamp: '2026-10-06T12:00:00Z', behaviorType: 'Moment', durationMinutes: 0, trigger, kept: 'by_herself', ...patch });
  const collections = {
    behaviorLogs: [moment('capture-record-alone', text.alone), moment('capture-record-incident', text.forbidden[0], { behaviorType: 'Food Refusal', kept: 'said' }), moment('capture-record-unknown', text.forbidden[3], { behaviorType: 'Future problem', kept: 'said' }), moment('capture-record-coparent', text.forbidden[4], { captureSource: 'co_parent', kept: 'said' }), moment('capture-record-practice', text.forbidden[2], { source: 'kid_practice', kept: 'said' })],
    milestones: [milestone],
    keepsakes: [
      { id: milestone.id, milestoneId: milestone.id, note: text.first, noticedOn: '2026-10-04', createdAt: '2026-10-04', updatedAt: '2026-10-04' },
      { id: 'capture-record-quote', kind: 'quote', note: text.quote, noticedOn: '2026-10-03', createdAt: '2026-10-03', updatedAt: '2026-10-03' },
      { id: 'capture-record-ai', kind: 'quote', note: text.forbidden[1], noticedOn: '2026-10-05', source: 'ai_proposed_parent_confirmed' },
    ],
    langObs: [
      { id: 'capture-record-september', phrase: text.boundary, language: he ? 'Hebrew' : 'English', timestamp: '2026-10-01T01:00:00+03:00' },
      { id: 'capture-record-october', phrase: text.word, language: he ? 'Hebrew' : 'English', timestamp: '2026-10-02T12:00:00Z' },
    ],
  };
  body.collections = { ...body.collections, ...collections };
  const sibling = { child: { ...body.child, id: 'capture-record-sibling', name: he ? 'מירה' : 'Mira', demo: true }, collections: Object.fromEntries(Object.keys(body.collections).map(key => [key, []])) };
  body.siblings = [sibling];
  return { parsed, collections, childId: body.child.id, childName: body.child.name.split(' ')[0], siblingId: sibling.child.id, siblingName: sibling.child.name, text,
    expected: { all: 5, said: 3, first: 1, by_herself: 1, months: 2, octoberText: [text.word, text.quote, text.first, text.alone], octoberLanguages: [lang, 'und', 'und', 'und'] } };
}

export function recordVariant(fixture, variant) {
  const collections = JSON.parse(JSON.stringify(fixture.collections));
  if (variant === 'complete') return collections;
  if (variant === 'empty') return Object.fromEntries(RECORD_SOURCE_NAMES.map(name => [name, []]));
  if (variant === 'incomplete') {
    collections.langObs = Array.from({ length: 201 }, (_, index) => ({ id: `capture-page-${String(index).padStart(3, '0')}`, phrase: `CAPTURE PAGE ${index + 1}`, language: 'English', timestamp: '2026-10-02T12:00:00Z' }));
    return collections;
  }
  throw new Error('RECORD_VARIANT_INVALID');
}

/** Install only at the egress seam. All real UI and beforeSend guards still run.
 * Never mutates source data, metadata, hook state, DOM or React internals. */
export function installRecordShareSink() {
  const sink = { kind: 'synthetic-browser-share-sink', calls: 0, clipboardCalls: 0, lastText: null, keys: [] };
  window.__arborRecordShareSink = sink;
  Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { sink.calls++; sink.lastText = payload.text ?? null; sink.keys = Object.keys(payload).sort(); } });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { sink.clipboardCalls++; throw new Error('CAPTURE_CLIPBOARD_DENIED'); } } });
}
