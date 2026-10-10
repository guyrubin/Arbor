import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { KEPT_SEARCH_STATES, KEPT_SEARCH_LIMITATIONS, KEPT_SEARCH_LEARN, KEPT_SEARCH_QUERIES, keptSearchFixture } from './capture/kept-search-contract.mjs';
import { installKeptCaptureProbe, finishKeptCaptureProbe } from './capture/kept-capture-states.mjs';
import { releaseMatrix, releaseCell, captureDeadlineMs, RELEASE_MATRIX } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { CONFIRMED_ACTION_STATES } from './capture/confirmed-actions-contract.mjs';
import { RECORD_STATES } from './capture/record-contract.mjs';
import { CDC_MILESTONES } from '../src/lib/milestoneData';
import { CHILD_SUBCOLLECTIONS } from '../src/lib/childData';
import { keptThings } from '../src/lib/kept/keptThings';
import { parentWritten } from '../src/lib/kept/parentWritten';
import { normalizeSearchText } from '../src/lib/searchNormalize';
import { searchLearnCards } from '../src/learn/learnLibrary';
import { LEARN_CARDS } from '../src/learn/learnCards';
import { searchCatalog, getSearchIndex } from '../src/lib/searchIndex';
import { placeForTab } from '../src/lib/companionPlaces';
import { HASH_ALIASES, RETIRED_ROUTES, ROUTE_IDS } from '../src/lib/routes';
import { translate } from '../src/lib/i18n';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const body = () => ({ child: { id: 'synthetic-child', name: 'Capture Child', demo: true, age: 4, birthDate: '2022-01-01' }, collections: { behaviorLogs: [], milestones: [{ ...CDC_MILESTONES[0] }], actionLoops: [], keepsakes: [], langObs: [] } });
const bundle = () => ({ parent: { demo: true }, ...body(), version: 'synthetic', seededAt: '2026-10-10', locales: { en: body(), he: body() } });
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };

describe('bounded additive kept capture and search contract, no browser', () => {
  it('adds precisely 116 cells while preserving every previous release manifest', () => {
    expect(KEPT_SEARCH_STATES).toHaveLength(29);
    expect(new Set(KEPT_SEARCH_STATES.map((s: any) => s.state)).size).toBe(29);
    expect(RELEASE_MATRIX).toHaveLength(8);
    expect(RECORD_STATES).toHaveLength(49);
    expect(CONFIRMED_ACTION_STATES).toHaveLength(49);
    expect(releaseMatrix('confirmed-actions-release')).toHaveLength(16);
    const matrix = releaseMatrix('kept-search-only');
    expect(matrix.map((s: any) => s.viewport)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    expect(releaseMatrix('kept-search-release')).toEqual([...matrix, ...releaseMatrix('confirmed-actions-release')]);
    for (const spec of matrix) {
      const cell = releaseCell(spec);
      expect(captureDeadlineMs(cell)).toBe(600000);
      expect(expectedReleaseInteractionStates('kept-search', cell.viewport)).toHaveLength(29);
    }
  });
  it('cannot pass missing, failed, wrong-source, or screenshot-only evidence', () => {
    const viewport = releaseCell(releaseMatrix('kept-search-only')[0]).viewport;
    const expected = expectedReleaseInteractionStates('kept-search', viewport);
    const cells = expected.map((row: any) => ({ ...row, ...identity, lang: viewport.lang, viewport: `${viewport.w}x${viewport.h}`, reached: true, shot: `shots/${row.state}.png`, assertions: [{ id: 'ACTUAL_CONTROL_RESULT', passed: true }], failures: [] }));
    const args = { group: 'kept-search', viewport, ...identity };
    expect(missingReleaseInteractionEvidence(cells, args)).toEqual([]);
    for (const patch of [{ shot: null }, { reached: false }, { assertions: [] }, { failures: ['BAD_DESTINATION'] }, { sourceSha: 'c'.repeat(40) }, { assertions: [{ passed: false }] }]) expect(missingReleaseInteractionEvidence([{ ...cells[0], ...patch }, ...cells.slice(1)], args)).toHaveLength(1);
    expect(missingReleaseInteractionEvidence([], args)).toHaveLength(29);
    for (const state of ['journal-ai-edit-confirm', 'kept-stale-final-send', 'search-normalized-empty', 'search-visit-arrival', 'learn-normalized-arrival']) expect(missingReleaseInteractionEvidence(cells.filter((c: any) => c.state !== state), args)[0].state).toBe(state);
  });
  for (const lang of ['en', 'he'] as const) it(`${lang}: fixture is isolated, bilingual and retains genuine negative controls`, () => {
    const original = bundle(), before = JSON.stringify(original), fixture = keptSearchFixture(original, lang);
    expect(JSON.stringify(original)).toBe(before);
    expect(fixture.parsed.locales[lang].collections).toBe(fixture.collections);
    expect(Object.keys(fixture.collections).every(key => CHILD_SUBCOLLECTIONS.includes(key as any))).toBe(true);
    expect(fixture.parsed.locales[lang].siblings[0].collections.behaviorLogs).toEqual([]);
    const [parent, ai, unknown, search] = fixture.collections.behaviorLogs;
    expect(parentWritten(parent)).toBe(true);
    expect(ai).toMatchObject({ contentSource: 'ai_draft', kept: 'said' });
    expect(unknown).toMatchObject({ contentSource: 'unverified', kept: 'said' });
    expect(parentWritten(ai)).toBe(false); expect(parentWritten(unknown)).toBe(false);
    expect(keptThings(fixture.collections, fixture.parsed.locales[lang].child).map(item => item.text)).toEqual([fixture.words.parent]);
    expect(keptThings({ ...fixture.collections, behaviorLogs: [{ ...ai, trigger: fixture.words.editedAi }, { ...unknown, trigger: fixture.words.editedUnverified }] }, fixture.parsed.locales[lang].child)).toEqual([]);
    expect(fixture.sourceLabels.ai_draft).toBe(translate(lang as any, 'kept.capture.source.ai_draft'));
    expect(fixture.sourceLabels.unverified).toBe(translate(lang as any, 'kept.capture.source.unverified'));
    const text = normalizeSearchText(search.trigger);
    for (const key of ['hebrew', 'latin', 'punctuation', 'bidi']) expect(text.includes(normalizeSearchText(KEPT_SEARCH_QUERIES[key]))).toBe(true);
    for (const key of ['punctuationNegative', 'bidiNegative']) expect(text.includes(normalizeSearchText(KEPT_SEARCH_QUERIES[key]))).toBe(false);
    expect(normalizeSearchText(KEPT_SEARCH_QUERIES.empty)).toBe('');
    const spec = KEPT_SEARCH_LEARN[lang];
    expect(searchLearnCards(LEARN_CARDS, spec.query, lang === 'he').some(card => card.id === 'executive-function' && card.title[lang] === spec.title)).toBe(true);
    const query = lang === 'he' ? 'בִּיקוּרִימ' : 'VÍSIT';
    const prepare = lang === 'he' ? 'מִתְכּוֹנְנִים לַפְּגִישָׁה' : 'PRÉPARE FOR A VISIT';
    expect(searchCatalog(query)[0].tab).toBe('appointments');
    expect(searchCatalog(prepare)[0].tab).toBe('consult');
    for (const route of ['appointments', 'consult']) {
      const entry = getSearchIndex().find(e => e.id === `route:${route}`)!;
      expect(entry.sub[lang]).toBe(placeForTab(route as any)[lang]);
      expect(entry.title[lang]).toBe(translate(lang as any, `nav.tab.${route}`));
    }
    expect(ROUTE_IDS).toHaveLength(43);
    expect(getSearchIndex().filter(entry => entry.kind === 'route' && entry.tab in RETIRED_ROUTES)).toEqual([]);
  });
  it('reuses isolated exact-font CI and the shared fail-closed aggregate without deployment or font uploads', () => {
    const workflow = read('.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('"codex/parent-capture-search-release" ]]; then scope=kept-search-only;');
    expect(workflow).toContain('"codex/parent-confirmed-action-loops" ]]; then scope=confirmed-actions-release;');
    for (const gate of ['docker create --network none', 'CAPTURE_DISPOSABLE_CI=true', 'ARBOR_CAPTURE_FONT_MODE=exact', 'persist-credentials: false', 'contents: read']) expect(workflow).toContain(gate);
    expect(workflow).not.toMatch(/secrets\.|workflow_dispatch|id-token:|docker push|firebase deploy|--privileged|--network host/);
    const collector = read('app/scripts/capture/release-interactions.mjs');
    expect(collector).toContain("'kept-search': KEPT_SEARCH_STATES");
    expect(collector).toContain('keptSearch?.parsed ?? confirmed?.parsed');
    expect(collector).toContain('if (record || confirmed || keptSearch) await context.addInitScript(installRecordShareSink)');
    expect(collector).toContain('doc.keptSearchBoundaries = KEPT_SEARCH_LIMITATIONS');
    expect(collector).toContain('await collectKeptSearchStates(');
  });
  it('keeps all fixture boundaries explicit and uses corrected native clocks before any load', () => {
    expect(KEPT_SEARCH_LIMITATIONS.map((row: any) => row.state)).toEqual(['lineage', 'persistence', 'share', 'child-switch', 'normalized-empty', 'prior-release']);
    const helpers = read('app/scripts/capture/kept-search-states.mjs');
    expect(helpers.indexOf('await page.addInitScript(installConfirmedDate')).toBeLessThan(helpers.indexOf("await load('journal')"));
    expect(helpers).toContain('Date.parse(KEPT_SEARCH_NOW) + (++sequence * 1000)');
    expect(helpers).toContain('waitConfirmedFrame');
    expect(helpers).toContain('restoreConfirmedDate');
    expect(helpers).not.toMatch(/page\.clock|performance\.now\s*=|requestAnimationFrame\s*=|finish\(\)|cancel\(\)/);
    for (const file of ['kept-search-states', 'kept-capture-states', 'normalized-search-states']) {
      const code = read(`app/scripts/capture/${file}.mjs`);
      expect(code).not.toMatch(/force:\s*true|dispatchEvent|__react|page\.route|route\.fulfill|evaluate\(\s*el\s*=>\s*el\.click\(/);
    }
  });
  it('source-selects actual capture, Journal, text Send and kept freshness controls', () => {
    const code = read('app/scripts/capture/kept-capture-states.mjs');
    for (const id of ['quicklog-moment-form', 'quicklog-keep-as', 'quicklog-reply-open', 'journal-entry-content-source', 'journal-entry-edit', 'journal-entry-delete', 'send-sheet-send', 'kept-item-send']) expect(code).toContain(id);
    expect(code).toContain("click({ clickCount: 2 })");
    expect(code).toContain("sent.lastText === text");
    expect(code).toContain('updated.timestamp === original.timestamp');
    expect(code).toContain('updated.contentSource === source');
    expect(code).toContain("await close('quicklog-moment-form');\n    await childSwitch");
    expect(code).toContain("'ACTUAL_FINAL_GUARD_REJECTS_CHANGED_SOURCE'");
    expect(translate('en', 'elev.keepsake.journal.share')).toBe('Keep as a card');
    expect(translate('he', 'elev.keepsake.journal.share')).toBe('שמרו ככרטיס');
    const quick = read('app/src/components/overview/QuickLogModal.tsx');
    expect(quick).toContain('data-kept-kind={kind} aria-pressed={kept === kind}');
    expect(quick).toContain('onSubmit={saveMoment}');
    const share = read('app/src/components/journal/JournalEntrySheet.tsx');
    expect(share).toContain('...(contentSourceLabel ? { sub: contentSourceLabel } : {})');
  });
  it('source-selects both global controls and actual Journal/Learn destinations, never a Kids action', () => {
    const code = read('app/scripts/capture/normalized-search-states.mjs');
    expect(code).toContain("page.keyboard.press('Control+k')");
    expect(code).toContain('input[aria-controls="topbar-search-results"]');
    expect(code).toContain("'journal-search'");
    expect(code).toContain("'learn-reader-heading'");
    expect(code).toContain("history.state?.arborLearnCard");
    expect(code).toContain("'MARKS_ONLY_NEVER_ENUMERATES_SYNTHETIC_PRIVATE_ROWS'");
    expect(code).not.toMatch(/kidMode|kid-mode|requestKid|search-ask-row.*click\(/);
    const normalize = read('app/src/lib/searchNormalize.ts');
    expect(normalize).not.toMatch(/^import /m);
    const hook = read('app/src/components/search/useSearchResults.ts');
    expect(hook.indexOf('if (!needle) return [];')).toBeLessThan(hook.indexOf('for (const l of behaviorLogs)'));
  });
  it('enters the current Journal feed through its real shelf control before inspecting rows', () => {
    const helpers = read('app/scripts/capture/kept-search-states.mjs');
    const capture = read('app/scripts/capture/kept-capture-states.mjs');
    const search = read('app/scripts/capture/normalized-search-states.mjs');
    expect(read('app/src/components/journal/ShelfGrid.tsx')).toContain('data-testid="shelf-all-by-date"');
    expect(read('app/src/components/journal/JournalShelves.tsx')).toContain('onOpenAll={() => goToRoute("journal", { view: "all" })}');
    expect(helpers).toContain("byId('shelf-all-by-date').click()");
    expect(capture).toContain("await byId('quicklog-reply-open').click();");
    expect(capture).toContain('await journalFeed(cell);');
    expect(search).toContain('await reset(); await journalFeed(cell);');
    expect(search).toContain("await arrive(cell, privateResult(), 'journal?view=all')");
    expect(search).toContain("const route = destination.split('?')[0]");
  });
  it('uses the stable dialog checkbox across actual moment/incident form replacement', () => {
    const code = read('app/scripts/capture/kept-capture-states.mjs');
    expect(code).toContain("page.getByRole('dialog').getByRole('checkbox')");
    expect(code).not.toContain("form().locator('input[type=\"checkbox\"]')");
    expect(code).not.toContain("incident.locator('input[type=\"checkbox\"]')");
    expect(read('app/src/components/overview/QuickLogModal.tsx')).toContain('onChange={(e) => toggleHardMoment(e.target.checked)}');
  });
  it('keeps Learn on its current route and checks the actual default Consult audience', () => {
    const code = read('app/scripts/capture/normalized-search-states.mjs');
    expect(KEPT_SEARCH_STATES.filter((row: any) => row.state.startsWith('learn-')).map((row: any) => row.route)).toEqual(['learn', 'learn']);
    expect(HASH_ALIASES.academy).toBe('masterclasses');
    expect(code).toContain("await load('learn')");
    expect(code).toContain("new URL(page.url()).hash === '#/learn'");
    expect(code).toContain("byId('consult-audience-row').getByRole('radio'");
    expect(code).toContain("'ACTUAL_DEFAULT_AUDIENCE_SELECTED'");
    expect(code).toContain('Prepare for the pediatrician');
    expect(code).toContain('מתכוננים לפגישה עם רופא/ת ילדים');
    expect(read('app/src/consult/packet.ts')).toContain('DEFAULT_EXPORT_AUDIENCE: ExportAudience = "pediatrician"');
    expect(read('app/src/components/sections/AskSpecialist.tsx')).toContain('onAudienceChange?.(audience)');
    for (const lang of ['en', 'he'] as const) {
      const audience = translate(lang, 'elev.carehonesty.consult.audience.pediatrician');
      expect(translate(lang, 'elev.consult.h1.audience', { audience: lang === 'en' ? audience.toLowerCase() : audience })).toBe(lang === 'en' ? 'Prepare for the pediatrician' : 'מתכוננים לפגישה עם רופא/ת ילדים');
    }
  });
  it('distinguishes desktop empty-input dismissal from the existing modal command catalogue', () => {
    const code = read('app/scripts/capture/normalized-search-states.mjs');
    expect(read('app/src/components/search/TopbarSearch.tsx')).toContain('const showOverlay = open && query.trim().length > 0');
    expect(code).toContain("'DESKTOP_TRUE_EMPTY_DISMISSES_EXISTING_OVERLAY'");
    expect(code).toContain("const commands = page.getByRole('dialog')");
    expect(code).toContain("commands.locator('button.group')");
    expect(code).toContain("'TRUE_EMPTY_PUBLIC_COMMANDS_KEEP_THREE_PLACES'");
    expect(code).toContain("await commands.getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click()");
  });
  it('retains passive bounded evidence when a repeated native click lands outside a resized receipt', () => {
    const listeners = new Map<string, (event: any) => void>();
    let receipt = false;
    const dialog = { getBoundingClientRect: () => ({ x: 16, y: receipt ? 260 : 100, width: 343, height: receipt ? 300 : 600 }) };
    const doc = {
      querySelector: (selector: string) => selector === '[role="dialog"]' ? dialog : selector.includes('quicklog-moment-form') ? !receipt : selector.includes('quicklog-reply') ? receipt : null,
      addEventListener: (name: string, listener: any, capture: boolean) => { expect(capture).toBe(true); listeners.set(name, listener); },
      removeEventListener: (name: string, listener: any, capture: boolean) => { expect(capture).toBe(true); expect(listeners.get(name)).toBe(listener); listeners.delete(name); },
    };
    const target = (submit: boolean, backdrop = false) => ({ matches: () => submit, getAttribute: () => null, hasAttribute: () => backdrop, tagName: submit ? 'BUTTON' : 'DIV' });
    const event = (type: string, node: any, detail: number) => ({ type, target: node, detail, isTrusted: true,
      preventDefault: () => { throw new Error('passive probe cannot cancel'); }, stopPropagation: () => { throw new Error('passive probe cannot intercept'); } });
    vi.stubGlobal('window', {}); vi.stubGlobal('document', doc);
    try {
      installKeptCaptureProbe();
      listeners.get('click')!(event('click', target(true), 1));
      listeners.get('submit')!(event('submit', target(false), 0));
      receipt = true;
      listeners.get('click')!(event('click', target(false, true), 2));
      for (let n = 0; n < 15; n++) listeners.get('click')!(event('click', target(false), 1));
      const result = finishKeptCaptureProbe();
      expect(result.events).toHaveLength(12);
      expect(result).toMatchObject({ observed: 18, omitted: 6, formPresent: false, receiptPresent: true });
      expect(result.events[0]).toMatchObject({ trusted: true, target: 'submit', detail: 1, formPresent: true, receiptPresent: false, dialog: { height: 600 } });
      expect(result.events[2]).toMatchObject({ trusted: true, target: 'modal-backdrop', detail: 2, formPresent: false, receiptPresent: true, dialog: { height: 300 } });
      expect(listeners.size).toBe(0);
      expect((window as any).__arborKeptCaptureProbe).toBeUndefined();
      expect(finishKeptCaptureProbe()).toEqual({ unavailable: true });
    } finally { vi.unstubAllGlobals(); }
    const code = read('app/scripts/capture/kept-capture-states.mjs');
    expect(code).toContain('finally { cell.captureEvents = await page.evaluate(finishKeptCaptureProbe); }');
    expect(code).toContain("click({ clickCount: 2 })");
    expect(code).toContain("cell.captureStage = 'actual-receipt-done'");
  });
});
