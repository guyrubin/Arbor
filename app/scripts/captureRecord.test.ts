import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RECORD_LIMITATIONS, RECORD_STATES, RETIRED_MONTH_IDS, RECORD_SOURCE_NAMES, recordFixture, recordVariant, recordQuoteProjection, recordFiltersFit, SEARCH_ROUTES } from './capture/record-contract.mjs';
import { collisionFixture, JOURNAL_EMPTY_SOURCES, journalControlAtFirstFold, observeJournalCaptureFocus } from './capture/record-behaviors.mjs';
import { validateRecordPrintHtml, validRecordPrintReceipt } from './capture/record-print.mjs';
import { releaseMatrix, RELEASE_MATRIX, releaseCell, captureDeadlineMs } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { keptThings, keptByMonth } from '../src/lib/kept/keptThings';
import { renderPrintableHtml } from '../src/lib/reportExport';
import { readTimeline } from '../src/lib/timelineFold';
import { journalRecordSignals } from '../src/lib/journalRecordSignals';
import { matchesJournalFilter } from '../src/lib/journalFilters';
import { CDC_MILESTONES } from '../src/lib/milestoneData';
import { quotesFromDocs } from '../src/lib/loop/tonight';
import { saidSendText, saidPrintDoc } from '../src/components/growth/SaidPage';
import { buildIntakePacket } from '../src/consult/packet';
import { CHILD_SUBCOLLECTIONS } from '../src/lib/childData';
import { observeRecordChildFrame, observeRecordDestinationFrame, observeRecordKeepsakeEditor } from './capture/record-child-frame.mjs';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const body = () => ({ child: { id: 'synthetic-capture-child', name: 'Capture Child', demo: true }, collections: { milestones: [{ ...CDC_MILESTONES[0], checked: false }], actionLoops: [] } });
const bundle = () => ({ parent: { demo: true }, ...body(), version: 'capture', seededAt: '2026-10-10', locales: { en: body(), he: body() } });
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const receipt = () => ({ ...identity, passed: true, delivery: 'download-html', media: 'print', fontMode: 'source-platform-serif', paper: 'A4', exactAppPayload: true,
  rendering: 'print-media-viewport', pdfRendering: 'chromium-paginated-css-page', preferCSSPageSize: true, pdfValid: true, pdfBytes: 8000, pdfSha256: 'd'.repeat(64), pdf: 'print/kept-month.mobile-he.pdf',
  htmlSha256: 'c'.repeat(64), htmlBytes: 4000, expectedRows: 4, renderedRows: 4, textMatches: true, viewport: { width: 794, height: 1123 },
  fonts: [{ familyName: 'Liberation Serif', glyphCount: 10, isCustomFont: false }], html: 'print/kept-month.mobile-he.html', shot: 'print/kept-month.mobile-he.png' });
afterEach(() => vi.unstubAllGlobals());

describe('bounded record capture pure contracts; no browser or sockets', () => {
  it('adds four prioritized shards while preserving every baseline cell', () => {
    expect(RELEASE_MATRIX).toHaveLength(8);
    const matrix = releaseMatrix('record-release'); expect(matrix).toHaveLength(12);
    expect(matrix.slice(4)).toEqual(RELEASE_MATRIX); expect(matrix.slice(0, 4)).toEqual(releaseMatrix('record-only'));
    for (const spec of matrix.slice(0, 4)) {
      const cell = releaseCell(spec); expect(captureDeadlineMs(cell)).toBe(600_000);
      expect(expectedReleaseInteractionStates('record', cell.viewport)).toHaveLength(49);
      expect(new Set(RECORD_STATES.map(item => `${item.route}:${item.state}`)).size).toBe(49);
      expect(missingReleaseInteractionEvidence([], { group: 'record', viewport: cell.viewport, ...identity })).toHaveLength(49);
    }
    for (const state of ['kept-reader', 'item-review', 'month-print', 'stale-final-send', 'child-switch', 'kept-incomplete', 'preserved-firsts', 'preserved-tree', 'preserved-timeline-months', 'preserved-said-page', 'hard-review-cancel', 'hard-confirm', 'journal-detail-edit', 'journal-collision-second', 'journal-context-expanded', 'journal-context-last-entry', 'journal-empty-first-fold', 'professional-quote-record']) expect(RECORD_STATES.some(item => item.state === state), state).toBe(true);
  });
  it('exercises the real selector and UTC boundary with synthetic sources', () => {
    for (const lang of ['en', 'he']) {
      const original = bundle(); const initial = JSON.stringify(original); const fixture = recordFixture(original, lang);
      expect(JSON.stringify(original)).toBe(initial); expect(Object.keys(fixture.collections)).toEqual(RECORD_SOURCE_NAMES);
      expect(fixture.collections.milestones[0].source).toEqual(body().collections.milestones[0].source);
      expect(fixture.collections.milestones[0].source).toEqual(CDC_MILESTONES[0].source);
      expect(fixture.collections.milestones[0].source?.org).toBe('CDC');
      expect(fixture.expected.octoberLanguages).toEqual([lang, 'und', 'und', 'und']);
      const items = keptThings(fixture.collections as any, { id: fixture.childId }); expect(items).toHaveLength(5);
      expect(items.map(item => item.text).sort()).toEqual([fixture.text.boundary, ...fixture.expected.octoberText].sort());
      const months = keptByMonth(items); expect(months.map(month => month.monthKey)).toEqual(['2026-10', '2026-09']);
      expect(months[0].items.slice().reverse().map(item => item.text)).toEqual(fixture.expected.octoberText);
      expect(items.filter(item => item.kind === 'said')).toHaveLength(3); expect(items.filter(item => item.kind === 'first')).toHaveLength(1); expect(items.filter(item => item.kind === 'by_herself')).toHaveLength(1);
      expect(fixture.text.forbidden.every(text => !items.some(item => item.text === text))).toBe(true);
      expect(fixture.parsed.locales[lang].siblings[0].child.demo).toBe(true);
    }
    expect(() => recordFixture({ ...bundle(), parent: { demo: false } }, 'en')).toThrow('SYNTHETIC_RECORD_FIXTURE_REQUIRED');
    expect(() => recordFixture(bundle(), 'fr')).toThrow();
  });
  it('uses true source pagination with honest unsupported remote boundaries', () => {
    const fixture = recordFixture(bundle(), 'en'); expect(recordVariant(fixture, 'incomplete').langObs).toHaveLength(201);
    expect(keptThings(recordVariant(fixture, 'incomplete') as any, { id: fixture.childId })).toHaveLength(204);
    expect(recordVariant(fixture, 'empty')).toEqual(Object.fromEntries(RECORD_SOURCE_NAMES.map(name => [name, []])));
    expect(() => recordVariant(fixture, 'confirmed')).toThrow('RECORD_VARIANT_INVALID');
    expect(RECORD_LIMITATIONS.map(item => item.state)).toEqual(['sustained-loading', 'remote-cache-only', 'account-switch', 'native-share-and-native-print']);
    const capture = read('app/scripts/capture/record-states.mjs');
    expect(capture).not.toMatch(/__react|\.isCurrent\s*=|confirmed:\s*true|fromCache:\s*false|dispatchEvent|\.setContent\(/);
    expect(capture).toContain("'{invalid-synthetic-json'");
    expect(capture).toContain('same-document-storage-deletion-existing-context-retained-until-refresh');
  });
  it('retains the generated provenance negative through real Said and professional consumers', () => {
    for (const lang of ['en', 'he'] as const) {
      const fixture = recordFixture(bundle(), lang);
      const negative = fixture.collections.keepsakes.find((row: any) => row.id === 'capture-record-ai');
      expect(negative).toMatchObject({ source: 'ai_proposed_parent_confirmed', kind: 'quote', note: fixture.text.forbidden[1] });
      const quotes = quotesFromDocs(fixture.collections.keepsakes);
      expect(quotes.map(quote => quote.note)).toEqual([fixture.text.quote]);
      const send = saidSendText(quotes, { lang, closing: 'Synthetic close' });
      const print = saidPrintDoc(quotes, { lang, title: fixture.childName, subtitle: '', month: '2026-10' });
      const packet = buildIntakePacket('slp', { child: { id: fixture.childId, name: fixture.childName, demo: true },
        milestones: fixture.collections.milestones, behaviorLogs: fixture.collections.behaviorLogs as Parameters<typeof buildIntakePacket>[1]['behaviorLogs'], actionLoops: [], quotes, lang, nowMs: Date.parse('2026-10-10T12:00:00Z') });
      for (const projected of [send, JSON.stringify(print), JSON.stringify(packet)]) {
        expect(recordQuoteProjection(projected.replaceAll('\\"', '"'), fixture)).toEqual({ genuinePresent: true, generatedAbsent: true, negativeFixtureIntact: true });
      }
      expect(renderPrintableHtml(print, fixture.childName, lang)).not.toContain(negative.note);
      expect(recordQuoteProjection(`${fixture.text.quote} ${negative.note}`, fixture).generatedAbsent).toBe(false);
      expect(recordQuoteProjection('', fixture).genuinePresent).toBe(false);
      const stripped = { ...fixture, collections: { ...fixture.collections, keepsakes: fixture.collections.keepsakes.filter((row: any) => row.id !== negative.id) } };
      expect(recordQuoteProjection(fixture.text.quote, stripped).negativeFixtureIntact).toBe(false);
    }
    const collector = read('app/scripts/capture/record-states.mjs');
    for (const id of ['SAID_SANDBOX_EXPORT_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', 'MILESTONE_CONTEXT_EXCLUDES_GENERATED_QUOTE', 'PROFESSIONAL_PREVIEW_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED']) expect(collector).toContain(id);
  });
  it('requires actual app print HTML/pixels/hash and separately labeled source-system fonts', () => {
    const fixture = recordFixture(bundle(), 'he');
    const html = renderPrintableHtml({ presentation: 'kept-month', title: fixture.childName, subtitle: 'אוקטובר', sections: [], keptItems: fixture.expected.octoberText.map(text => ({ text, date: '4 באוק׳', language: 'he' })) }, fixture.childName, 'he');
    expect(validateRecordPrintHtml(html)).toBe(true); expect(html).toContain('&lt;שלום&gt; &amp;');
    expect(validateRecordPrintHtml(html.replace('</body>', '<img src="https://example.com/private"></body>'))).toBe(false);
    expect(validateRecordPrintHtml(html.replace('size: A4;', 'size: Letter;'))).toBe(false);
    const r = receipt(); const files = [r.html, r.shot, r.pdf]; const hashes = { [r.html]: r.htmlSha256, [r.pdf]: r.pdfSha256 };
    expect(validRecordPrintReceipt(r, identity, files, hashes)).toBe(true);
    for (const patch of [{ passed: false }, { sourceTreeSha: 'd'.repeat(40) }, { exactAppPayload: false }, { fontMode: 'exact' }, { delivery: 'rebuilt' }, { textMatches: false }, { renderedRows: 3 }, { fonts: [] }, { html: '../private.html' }, { pdfValid: false }, { preferCSSPageSize: false }, { rendering: 'paginated-pixels' }, { pdfRendering: 'rebuilt' }, { pdfBytes: 0 }, { pdfSha256: 'e'.repeat(64) }]) expect(validRecordPrintReceipt({ ...r, ...patch }, identity, files, hashes)).toBe(false);
    expect(validRecordPrintReceipt(r, identity, [r.html, r.shot], hashes)).toBe(false);
    expect(validRecordPrintReceipt(r, identity, files, {})).toBe(false); expect(validRecordPrintReceipt(r, identity, [r.html], hashes)).toBe(false);
    const capture = read('app/scripts/capture/record-print.mjs');
    expect(capture).toContain("page.waitForEvent('download'"); expect(capture).toContain("page.waitForEvent('popup'");
    expect(capture).not.toMatch(/renderPrintableHtml|monthPageDoc|window\.open\s*=|window\.print\s*=|setContent/); expect(capture).toContain('body: emitted.html');
    expect(capture).toContain('await print.pdf('); expect(capture).toContain('preferCSSPageSize: true');
    expect(read('.github/workflows/arbor-parent-release-capture.yml')).toContain('/arbor-parent-release/print/*.pdf');
    expect(read('app/scripts/capture/summarize-release.mjs')).toContain('html|png|pdf');
  });
  it('has a nonvacuous same-minute collision fixture retaining both editable identities', () => {
    const logs = collisionFixture(); const folded = readTimeline({ behaviorLogs: logs as any }); expect(folded.filter(signal => signal.kind === 'moment')).toHaveLength(1);
    const records = journalRecordSignals(folded, logs as any); expect(records.map(signal => signal.id)).toEqual(['moment-capture-collision-second', 'moment-capture-collision-first']);
    const logsById = new Map(logs.map(log => [log.id, log]));
    expect(records.filter(signal => matchesJournalFilter(signal, { filter: 'hard', query: 'CAPTURE SECOND NOTE', type: 'Transition Refusal', intensity: '3', status: 'resolved', logsById: logsById as any, keptIds: new Set(), labelOf: () => 'Refusal' })).map(signal => signal.id)).toEqual(['moment-capture-collision-second']);
  });
  it('requires actual unscrolled, unobscured first-fold controls and bounds the empty sibling sources', () => {
    const frame = { row: { top: 530, bottom: 640, left: 16, right: 359 }, main: { top: 0, bottom: 812 }, rail: { top: 690, bottom: 720 }, nav: { top: 720, bottom: 812 }, width: 375, height: 812, bottomLimit: 690, scrollTop: 0, hit: true };
    expect(journalControlAtFirstFold(frame)).toBe(true);
    for (const patch of [{ scrollTop: 120 }, { hit: false }, { bottomLimit: 600 }, { row: { ...frame.row, bottom: 825 } }, { row: { ...frame.row, right: 390 } }, { row: { ...frame.row, bottom: 550 } }, { row: { ...frame.row, top: -1 } }, { rail: { top: 620, bottom: 720 } }, { rail: null }]) expect(journalControlAtFirstFold({ ...frame, ...patch })).toBe(false);
    // The center remains visible/hittable, but its bottom is hidden by Ask/Keep.
    expect(journalControlAtFirstFold({ ...frame, row: { ...frame.row, bottom: 700 } })).toBe(false);
    // Exact observed translated DOMRect subtraction for a CSS min-height44 CTA.
    expect(journalControlAtFirstFold({ ...frame, row: { ...frame.row, top: 484.1438293457031, bottom: 528.143798828125 } })).toBe(true);
    for (const height of [43.99, 43]) expect(journalControlAtFirstFold({ ...frame, row: { ...frame.row, bottom: frame.row.top + height } })).toBe(false);
    // The tiny size tolerance must not relax any viewport or rail bound.
    expect(journalControlAtFirstFold({ ...frame, row: { ...frame.row, bottom: frame.rail.top + 0.00001 } })).toBe(false);
    expect(journalControlAtFirstFold({})).toBe(false);
    expect(JOURNAL_EMPTY_SOURCES.every(name => CHILD_SUBCOLLECTIONS.includes(name))).toBe(true);
    expect(JOURNAL_EMPTY_SOURCES).toContain('actionPlans'); // prevent the sandbox fallback plan from masquerading as an empty record
    const capture = read('app/scripts/capture/record-behaviors.mjs');
    const arrival = capture.slice(capture.indexOf("'journal-hard-arrival', async"), capture.indexOf("'journal-context-expanded', async"));
    expect(arrival).toContain('firstFoldFrame'); expect(arrival).not.toMatch(/scrollIntoView|scrollTo\(/);
    expect(capture).toContain("page.keyboard.press('Enter')"); expect(capture).toContain("page.keyboard.press('Space')");
    expect(capture).toContain('SYNTHETIC_EMPTY_SIBLING_REQUIRED');
    expect(capture).toContain("load('journal?view=all')");
    expect(capture).toContain("hash === '#/journal?view=all'");
    expect(capture).toContain("await byId('journal-empty-cta').click()");
    expect(capture).toContain('EMPTY_CTA_DESTINATION_OPENS_REAL_CAPTURE');
    expect(capture).toContain('EMPTY_CAPTURE_CANCEL_WRITES_NOTHING');
    const runner = read('app/scripts/capture/release-interactions.mjs');
    expect(runner.indexOf('await afterCapture(cell)')).toBeGreaterThan(runner.indexOf('await captureScreenshot(page'));
    expect(runner).toContain('afterCapture && cell.shot && cell.failures.length === 0');
  });
  it('rejects outgoing, faded, moving or wrong-child frames before font sampling', () => {
    const setup = () => {
      const motion: any = { parentElement: null, style: {} };
      const heading = { getBoundingClientRect: () => ({ top: 120, bottom: 150, width: 250, height: 30 }) };
      const route: any = { parentElement: motion, querySelector: vi.fn(() => heading) };
      const outgoing = { isConnected: false };
      const main = { scrollTop: 0, getBoundingClientRect: () => ({ top: 74, bottom: 720 }) };
      const storage = { getItem: vi.fn(() => 'capture-child') };
      const document = { querySelector: vi.fn(() => main), querySelectorAll: vi.fn(() => [route]) };
      vi.stubGlobal('document', document); vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('getComputedStyle', (el: any) => ({ opacity: '1', transform: 'none', visibility: 'visible', display: 'block', ...el.style }));
      return { outgoing, childId: 'capture-child', motion, route, heading, storage, document };
    };
    let f = setup(); expect(observeRecordChildFrame(f)).toMatchObject({ ready: true, outgoingRetired: true, replacementMounted: true });
    f.heading.getBoundingClientRect = () => ({ top: -120, bottom: -90, width: 250, height: 30 });
    expect(observeRecordChildFrame(f)).toMatchObject({ ready: true, headingRendered: true, headingWithinMain: false });
    for (const change of [
      (f: any) => { f.outgoing.isConnected = true; },
      (f: any) => { f.motion.style.opacity = '0.5'; },
      (f: any) => { f.motion.style.transform = 'matrix(1, 0, 0, 1, 0, 10)'; },
      (f: any) => { f.motion.style.visibility = 'hidden'; },
      (f: any) => f.storage.getItem.mockReturnValue('other-child'),
      (f: any) => f.route.querySelector.mockReturnValue(null),
      (f: any) => f.document.querySelectorAll.mockReturnValue([]),
      (f: any) => f.document.querySelectorAll.mockReturnValue([f.route, f.route]),
    ]) { f = setup(); change(f); const observed = observeRecordChildFrame(f); expect(observed).not.toBe(false); if (observed === false) throw new Error('EXPECTED_DIAGNOSTIC_FRAME'); expect(observed.ready).toBe(false); expect(observeRecordChildFrame({ ...f, waitUntilReady: true })).toBe(false); }
    const capture = read('app/scripts/capture/record-states.mjs');
    expect(capture).toContain('cell.childTransition.lastObserved');
    expect(capture).toContain('waitUntilReady: true }, { timeout: 10000 }');
    expect(capture).not.toContain("getByText(he ? 'תמונת ההתפתחות' : 'Growth picture', { exact: true })");
    expect(capture).toContain(".portrait-keepsakes-body > section");
  });
  it('pins retired names and the real preserved firsts/tree/editor/Timeline doors', () => {
    expect(RETIRED_MONTH_IDS).toEqual(['growth-month-in-review', 'month-keepsake', 'memory-first-month']);
    const collector = read('app/scripts/capture/record-states.mjs');
    for (const id of ['portrait-keepsakes', 'growth-arbor-tree', 'timeline-months-disclosure', 'said-page-door', 'first-keepsake-sheet']) expect(collector).toContain(id);
    const app = read('app/src/components/companion/PortraitKeepsakes.tsx'); expect(app).toContain('<KeptThingsPage key={childProfile.id} />');
    expect(app).toContain('<DevScoreCard />'); expect(app).toContain('<ArborTreeCard />'); expect(read('app/src/components/tabs/StoryTimelineTab.tsx')).toContain('<MonthsSpine');
  });
  it('requires a retired outgoing route and settled destination content after the real search click', () => {
    const setup = () => {
      const motion: any = { parentElement: null, style: {} };
      const content: any = { parentElement: motion, textContent: 'Actual destination record', getBoundingClientRect: () => ({ top: 140, bottom: 270, left: 16, right: 359, width: 343, height: 130 }) };
      const route = { getAttribute: () => 'language', querySelectorAll: vi.fn(() => [content]) };
      const outgoing = { isConnected: false };
      const main = { scrollTop: 0, getBoundingClientRect: () => ({ top: 74, bottom: 720, left: 0, right: 375 }) };
      const storage = { getItem: vi.fn(() => 'capture-child') };
      const document = { querySelector: vi.fn(() => main), querySelectorAll: vi.fn(() => [route]) };
      const location = { hash: '#/language' };
      vi.stubGlobal('document', document); vi.stubGlobal('localStorage', storage); vi.stubGlobal('location', location);
      vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812);
      vi.stubGlobal('getComputedStyle', (el: any) => ({ opacity: '1', transform: 'none', visibility: 'visible', display: 'block', ...el.style }));
      return { outgoing, childId: 'capture-child', routeName: 'language', contentSelector: '[data-module="language-capture"]', motion, route, content, storage, document, location };
    };
    expect(observeRecordDestinationFrame(setup())).toMatchObject({ ready: true, replacementMounted: true, contentCount: 1 });
    for (const change of [
      (f: ReturnType<typeof setup>) => { f.outgoing.isConnected = true; },
      (f: ReturnType<typeof setup>) => { f.content.textContent = ''; },
      (f: ReturnType<typeof setup>) => { f.content.getBoundingClientRect = () => ({ top: 850, bottom: 980, left: 16, right: 359, width: 343, height: 130 }); },
      (f: ReturnType<typeof setup>) => { f.motion.style.opacity = '0'; },
      (f: ReturnType<typeof setup>) => { f.motion.style.transform = 'matrix(1, 0, 0, 1, 0, 10)'; },
      (f: ReturnType<typeof setup>) => { f.content.style = { display: 'none' }; },
      (f: ReturnType<typeof setup>) => { f.location.hash = '#/overview'; },
      (f: ReturnType<typeof setup>) => f.storage.getItem.mockReturnValue('other-child'),
      (f: ReturnType<typeof setup>) => f.route.querySelectorAll.mockReturnValue([]),
      (f: ReturnType<typeof setup>) => f.document.querySelectorAll.mockReturnValue([f.route, f.route]),
    ]) {
      const f = setup(); change(f);
      expect(observeRecordDestinationFrame({ ...f, waitUntilReady: true })).toBe(false);
      expect(observeRecordDestinationFrame(f)).toMatchObject({ ready: false });
    }
    expect(new Set(SEARCH_ROUTES.map(route => route.contentSelector)).size).toBe(3);
    const collector = read('app/scripts/capture/record-states.mjs');
    const arrival = collector.slice(collector.indexOf('`search-${entry.route}-arrived`'));
    expect(arrival).toContain('await result().click()'); expect(arrival).toContain('cell.searchTransition.lastObserved');
    expect(arrival).not.toMatch(/await load\(|page.goto|scrollIntoView|setTimeout|waitForTimeout/);
  });
  it('rejects clipped filter labels and focus outlines even with a visible center', () => {
    const frame = { width: 375, reader: { left: 16, right: 359 }, buttons: Array.from({ length: 4 }, (_, index) => ({ left: 24 + index % 2 * 130, right: 124 + index % 2 * 130, clipLeft: 16, clipRight: 359, outline: index === 0 ? 4 : 0 })) };
    expect(recordFiltersFit(frame)).toBe(true);
    for (const patch of [{ left: 14 }, { right: 360 }, { clipLeft: 27 }, { clipRight: 121 }, { outline: 10 }, { outline: NaN }]) {
      expect(recordFiltersFit({ ...frame, buttons: [{ ...frame.buttons[0], ...patch }, ...frame.buttons.slice(1)] })).toBe(false);
    }
    expect(recordFiltersFit({ ...frame, buttons: frame.buttons.slice(1) })).toBe(false);
    expect(read('app/scripts/capture/record-states.mjs')).toContain('ALL_FILTER_LABELS_AND_FOCUS_OUTLINES_UNCLIPPED');
  });
  it('observes the actual first compose tile before deliberately choosing safe text capture', () => {
    const tiles = ['voice', 'photo', 'text'].map(mode => ({ getAttribute: (name: string) => name === 'data-capture-tile' ? mode : null }));
    const document = { querySelectorAll: vi.fn(() => tiles), activeElement: tiles[0] };
    vi.stubGlobal('document', document);
    expect(observeJournalCaptureFocus()).toMatchObject({ ready: true, firstMode: 'voice', activeMode: 'voice', tileCount: 3 });
    document.activeElement = tiles[2];
    expect(observeJournalCaptureFocus({ waitUntilReady: true })).toBe(false);
    expect(observeJournalCaptureFocus()).toMatchObject({ ready: false, firstMode: 'voice', activeMode: 'text' });
    document.querySelectorAll.mockReturnValue([]);
    expect(observeJournalCaptureFocus({ waitUntilReady: true })).toBe(false);
    const collector = read('app/scripts/capture/record-behaviors.mjs');
    expect(collector).toContain('cell.emptyActivation.lastObserved');
    const followThrough = collector.slice(collector.indexOf("cell.shotPhase = 'unscrolled-empty-before-activation'"));
    expect(followThrough).not.toMatch(/getUserMedia|dispatchEvent|\.focus\(/);
    expect(collector).toContain('const tile = page.locator(\'#main [data-capture-bar] [data-capture-tile="text"]\')');
  });
  it('waits for actual effect-seeded editor values without changing the controls', () => {
    const note = { value: '' }; const date = { value: '' };
    const sheet = { querySelector: (selector: string) => selector.includes('-note') ? note : date };
    const document = { querySelectorAll: vi.fn(() => [sheet]) };
    vi.stubGlobal('document', document);
    const args = { expectedNote: 'Three steps toward me', expectedDate: '2026-10-04' };
    expect(observeRecordKeepsakeEditor(args)).toMatchObject({ ready: false, note: '', date: '' });
    expect(observeRecordKeepsakeEditor({ ...args, waitUntilReady: true })).toBe(false);
    note.value = args.expectedNote; date.value = args.expectedDate;
    expect(observeRecordKeepsakeEditor(args)).toMatchObject({ ready: true, note: args.expectedNote, date: args.expectedDate });
    date.value = '2026-10-05';
    expect(observeRecordKeepsakeEditor({ ...args, waitUntilReady: true })).toBe(false);
    date.value = args.expectedDate; document.querySelectorAll.mockReturnValue([sheet, sheet]);
    expect(observeRecordKeepsakeEditor({ ...args, waitUntilReady: true })).toBe(false);
    const collector = read('app/scripts/capture/record-states.mjs');
    const editor = collector.slice(collector.indexOf("'preserved-milestone-editor'"), collector.indexOf("'professional-quote-record'"));
    expect(editor).toContain('cell.keepsakeEditor.lastObserved');
    expect(editor).not.toMatch(/\.fill\(|setTimeout|waitForTimeout/);
  });
});
