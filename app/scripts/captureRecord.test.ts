import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RECORD_LIMITATIONS, RECORD_STATES, RETIRED_MONTH_IDS, RECORD_SOURCE_NAMES, recordFixture, recordVariant } from './capture/record-contract.mjs';
import { collisionFixture } from './capture/record-behaviors.mjs';
import { validateRecordPrintHtml, validRecordPrintReceipt } from './capture/record-print.mjs';
import { releaseMatrix, RELEASE_MATRIX, releaseCell, captureDeadlineMs } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates, missingReleaseInteractionEvidence } from './capture/release-interactions.mjs';
import { keptThings, keptByMonth } from '../src/lib/kept/keptThings';
import { renderPrintableHtml } from '../src/lib/reportExport';
import { readTimeline } from '../src/lib/timelineFold';
import { journalRecordSignals } from '../src/lib/journalRecordSignals';
import { matchesJournalFilter } from '../src/lib/journalFilters';
const root = path.resolve(__dirname, '../..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const body = () => ({ child: { id: 'synthetic-capture-child', name: 'Capture Child', demo: true }, collections: { milestones: [{ id: 'm', title: 'First noticed', domain: 'sensory_motor_patterns', checked: false }], actionLoops: [] } });
const bundle = () => ({ parent: { demo: true }, ...body(), version: 'capture', seededAt: '2026-10-10', locales: { en: body(), he: body() } });
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const receipt = () => ({ ...identity, passed: true, delivery: 'download-html', media: 'print', fontMode: 'source-platform-serif', paper: 'A4', exactAppPayload: true,
  htmlSha256: 'c'.repeat(64), htmlBytes: 4000, expectedRows: 4, renderedRows: 4, textMatches: true, viewport: { width: 794, height: 1123 },
  fonts: [{ familyName: 'Liberation Serif', glyphCount: 10, isCustomFont: false }], html: 'print/kept-month.mobile-he.html', shot: 'print/kept-month.mobile-he.png' });

describe('bounded record capture pure contracts; no browser or sockets', () => {
  it('adds four prioritized shards while preserving every baseline cell', () => {
    expect(RELEASE_MATRIX).toHaveLength(8);
    const matrix = releaseMatrix('record-release'); expect(matrix).toHaveLength(12);
    expect(matrix.slice(4)).toEqual(RELEASE_MATRIX); expect(matrix.slice(0, 4)).toEqual(releaseMatrix('record-only'));
    for (const spec of matrix.slice(0, 4)) {
      const cell = releaseCell(spec); expect(captureDeadlineMs(cell)).toBe(600_000);
      expect(expectedReleaseInteractionStates('record', cell.viewport)).toHaveLength(45);
      expect(new Set(RECORD_STATES.map(item => `${item.route}:${item.state}`)).size).toBe(45);
      expect(missingReleaseInteractionEvidence([], { group: 'record', viewport: cell.viewport, ...identity })).toHaveLength(45);
    }
    for (const state of ['kept-reader', 'item-review', 'month-print', 'stale-final-send', 'child-switch', 'kept-incomplete', 'preserved-firsts', 'preserved-tree', 'preserved-timeline-months', 'preserved-said-page', 'hard-review-cancel', 'hard-confirm', 'journal-detail-edit', 'journal-collision-second']) expect(RECORD_STATES.some(item => item.state === state), state).toBe(true);
  });
  it('exercises the real selector and UTC boundary with synthetic sources', () => {
    for (const lang of ['en', 'he']) {
      const original = bundle(); const initial = JSON.stringify(original); const fixture = recordFixture(original, lang);
      expect(JSON.stringify(original)).toBe(initial); expect(Object.keys(fixture.collections)).toEqual(RECORD_SOURCE_NAMES);
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
  it('requires actual app print HTML/pixels/hash and separately labeled source-system fonts', () => {
    const fixture = recordFixture(bundle(), 'he');
    const html = renderPrintableHtml({ presentation: 'kept-month', title: fixture.childName, subtitle: 'אוקטובר', sections: [], keptItems: fixture.expected.octoberText.map(text => ({ text, date: '4 באוק׳', language: 'he' })) }, fixture.childName, 'he');
    expect(validateRecordPrintHtml(html)).toBe(true); expect(html).toContain('&lt;שלום&gt; &amp;');
    expect(validateRecordPrintHtml(html.replace('</body>', '<img src="https://example.com/private"></body>'))).toBe(false);
    expect(validateRecordPrintHtml(html.replace('size: A4;', 'size: Letter;'))).toBe(false);
    const r = receipt(); const files = [r.html, r.shot]; const hashes = { [r.html]: r.htmlSha256 };
    expect(validRecordPrintReceipt(r, identity, files, hashes)).toBe(true);
    for (const patch of [{ passed: false }, { sourceTreeSha: 'd'.repeat(40) }, { exactAppPayload: false }, { fontMode: 'exact' }, { delivery: 'rebuilt' }, { textMatches: false }, { renderedRows: 3 }, { fonts: [] }, { html: '../private.html' }]) expect(validRecordPrintReceipt({ ...r, ...patch }, identity, files, hashes)).toBe(false);
    expect(validRecordPrintReceipt(r, identity, files, {})).toBe(false); expect(validRecordPrintReceipt(r, identity, [r.html], hashes)).toBe(false);
    const capture = read('app/scripts/capture/record-print.mjs');
    expect(capture).toContain("page.waitForEvent('download'"); expect(capture).toContain("page.waitForEvent('popup'");
    expect(capture).not.toMatch(/renderPrintableHtml|monthPageDoc|window\.open\s*=|window\.print\s*=|setContent/); expect(capture).toContain('body: emitted.html');
  });
  it('has a nonvacuous same-minute collision fixture retaining both editable identities', () => {
    const logs = collisionFixture(); const folded = readTimeline({ behaviorLogs: logs as any }); expect(folded.filter(signal => signal.kind === 'moment')).toHaveLength(1);
    const records = journalRecordSignals(folded, logs as any); expect(records.map(signal => signal.id)).toEqual(['moment-capture-collision-second', 'moment-capture-collision-first']);
    const logsById = new Map(logs.map(log => [log.id, log]));
    expect(records.filter(signal => matchesJournalFilter(signal, { filter: 'hard', query: 'CAPTURE SECOND NOTE', type: 'Transition Refusal', intensity: '3', status: 'resolved', logsById: logsById as any, keptIds: new Set(), labelOf: () => 'Refusal' })).map(signal => signal.id)).toEqual(['moment-capture-collision-second']);
  });
  it('pins retired names and the real preserved firsts/tree/editor/Timeline doors', () => {
    expect(RETIRED_MONTH_IDS).toEqual(['growth-month-in-review', 'month-keepsake', 'memory-first-month']);
    const collector = read('app/scripts/capture/record-states.mjs');
    for (const id of ['portrait-keepsakes', 'growth-arbor-tree', 'timeline-months-disclosure', 'said-page-door', 'first-keepsake-sheet']) expect(collector).toContain(id);
    const app = read('app/src/components/companion/PortraitKeepsakes.tsx'); expect(app).toContain('<KeptThingsPage key={childProfile.id} />');
    expect(app).toContain('<DevScoreCard />'); expect(app).toContain('<ArborTreeCard />'); expect(read('app/src/components/tabs/StoryTimelineTab.tsx')).toContain('<MonthsSpine');
  });
});
