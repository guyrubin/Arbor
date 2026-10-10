import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { firstRunObservationRecordMatches, observeFirstRunElement } from './capture/first-run-observation-evidence.mjs';
import { FIRST_RUN_PREVIEW_BOUNDARY, FIRST_RUN_PREVIEW_LIMITATIONS, FIRST_RUN_PREVIEW_STATES, firstRunPreviewRequiredAssertions, firstRunPreviewText } from './capture/first-run-preview-contract.mjs';
import { firstRunCard, initialFirstRunState } from '../src/lib/onboardingFirstRun';
import { translate } from '../src/lib/i18n';
import { completeObservation } from '../src/actionLoop/model';
import { buildTimeline, signalDetail, signalTitle, signalMeta } from '../src/lib/signalTimeline';
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
const accepted: any = { id: 'today.child-1234567890123.2026-10-10', source: 'onboarding', observation: true, recommendation: 'Question\nFull details', capacity: 'tiny', status: 'accepted', acceptedAt: '2026-10-10T12:00:00.000Z', acceptanceKey: 'onboarding-v1.child-1234567890123.test' };
afterEach(() => vi.unstubAllGlobals());
describe('fresh first-run observation capture evidence', () => {
  it('has exactly 26 real-control states, retaining the old 14 and adding 12 bounded checks', () => {
    const states = FIRST_RUN_PREVIEW_STATES.map((row: any) => row.state);
    const source = read('./capture/first-run-preview-states.mjs');
    const collected = [...source.matchAll(/await run\('([^']+)'/g)].map(match => match[1]);
    expect(collected).toEqual(states); expect(states).toHaveLength(26);
    expect(firstRunPreviewRequiredAssertions('about-consent-required')).toEqual(expect.arrayContaining(['ENGLISH_SELECTION_CHECK_VISIBLE', 'HEBREW_SELECTION_CHECK_VISIBLE']));
    expect(firstRunPreviewRequiredAssertions('worry-repeat-same-child')).toContain('NOTHING_SELECTION_CHECK_VISIBLE');
    expect(firstRunPreviewRequiredAssertions('worry-moving-selected')).toContain('MOVING_SELECTION_CHECK_VISIBLE');
    expect(firstRunPreviewRequiredAssertions('observation-local-receipt')).toEqual(expect.arrayContaining(['LOCAL_HANDLER_RECEIPT_ONLY', 'EXACT_COMPLETED_OBSERVATION', 'SAVED_WORDS_VISIBLE', 'FIRST_RUN_FINAL_NETWORK_GUARD']));
  });
  it.each(['en', 'he'] as const)('%s pins full source question, say-back and all observation text', lang => {
    const text = firstRunPreviewText(lang);
    const state = { ...initialFirstRunState(), name: text.name, birthMonth: '2022-10', languages: ['Hebrew', 'English'], worry: { step: 3 as const, choice: 'talking' as const, words: '', quote: text.quote, hardMomentId: '' } };
    const card = firstRunCard(state, lang, new Date('2026-10-10T12:00:00Z'));
    expect(card).toMatchObject({ observation: true, recommendation: text.recommendation, notice: text.neutral });
    expect(`${card.sayBack!.heading} ${card.sayBack!.line}`).toBe(text.sayBack);
    for (const [field, key] of Object.entries({ notice: 'ob.first.notice', keep: 'ob.first.observation.keep', purpose: 'ob.first.observation.purpose', receipt: 'ob.first.observation.saved', open: 'ob.first.observation.open', history: 'ob.first.observation.history.completed', try: 'ob.first.try' })) expect(text[field as keyof typeof text]).toBe(translate(lang, key));
  });
  it('accepts only one completed row with exact original identity, question and submitted words', () => {
    const words = 'He said ball.\nThen rolled it to me.';
    const completed = completeObservation(accepted, words);
    expect(firstRunObservationRecordMatches([completed], accepted, words)).toBe(true);
    for (const patch of [{ outcome: 'helped' }, { outcome: undefined }, { outcomeAt: undefined }, { id: 'other' }, { recommendation: 'Shortened' }, { whatHappened: 'invented' }, { source: 'practice' }, { capacity: 'small' }, { acceptanceKey: 'other' }, { completedAt: '' }, { completedAt: 'garbage' }, { status: 'accepted' }, { durationMinutes: 2 }]) expect(firstRunObservationRecordMatches([{ ...completed, ...patch }], accepted, words)).toBe(false);
    expect(firstRunObservationRecordMatches([completed, completed], accepted, words)).toBe(false);
    expect(firstRunObservationRecordMatches([], accepted, words)).toBe(false);
    expect(firstRunObservationRecordMatches([completed], { ...accepted, observation: undefined }, words)).toBe(false);
  });
  it.each(['en', 'he'] as const)('%s history uses factual observation wording, complete text and no dose', lang => {
    const text = firstRunPreviewText(lang);
    const row = completeObservation({ ...accepted, recommendation: text.recommendation }, text.words);
    const signal = buildTimeline({ actionOutcomes: [row] }).find(item => item.id === `action-${row.id}`)!;
    const t = (key: string, vars?: any) => translate(lang, key, vars);
    expect(signalTitle(signal, t)).toBe(text.history);
    expect(signalDetail(signal, t)).toBe(`${text.recommendation}\n\n${text.words}`);
    expect(signalMeta(signal, t)).toBeUndefined();
  });
  it('labels the immediate local receipt and unsupported failure/pending/production gates explicitly', () => {
    expect(FIRST_RUN_PREVIEW_BOUNDARY.observationReceipt).toContain('not a remote acknowledgement');
    expect(FIRST_RUN_PREVIEW_BOUNDARY.remoteAcknowledgementVerified).toBe(false);
    expect(FIRST_RUN_PREVIEW_LIMITATIONS.find((row: any) => row.state === 'observation-server-rejection-retry')?.status).toBe('offline-source-tests-only');
    expect(FIRST_RUN_PREVIEW_LIMITATIONS.find((row: any) => row.state === 'owner-selection-aba-and-pending-close')?.status).toBe('offline-source-tests-only');
    expect(FIRST_RUN_PREVIEW_LIMITATIONS.find((row: any) => row.state === 'first-run-close')?.status).toBe('not-implemented');
    const source = read('./capture/first-run-preview-states.mjs') + read('./capture/first-run-observation-evidence.mjs');
    expect(source).not.toMatch(/force:\s*true|dispatchEvent|requestSubmit|__react|\.setItem\(|\.removeItem\(|addStyleTag|setContent|setExtraHTTPHeaders|page\.route\(|route\.fulfill\(/);
    expect(source).toContain("await page.keyboard.press('Tab')");
    expect(source).toContain("await page.keyboard.press('Enter')");
    expect(source).toContain("await page.getByRole('dialog').locator('button[aria-label]').first().click()");
  });
  it('requires real visible check glyphs and rejects occlusion, clipping, hidden and inert frames', () => {
    const box = { left: 20, right: 320, top: 30, bottom: 80, width: 300, height: 50 };
    const style: any = { display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible' };
    const parent: any = { parentElement: null, getBoundingClientRect: () => ({ left: 0, right: 375, top: 0, bottom: 812 }) };
    const mark: any = { getBoundingClientRect: () => ({ left: 25, right: 41, top: 40, bottom: 56, width: 16, height: 16 }) };
    const el: any = { parentElement: parent, isConnected: true, textContent: 'checkEnglish', scrollHeight: 50, clientHeight: 50, scrollWidth: 300, clientWidth: 300,
      getBoundingClientRect: () => box, contains: (other: any) => other === el || other === mark, getAttribute: () => 'true',
      querySelector: (selector: string) => selector.includes('.msr') ? { textContent: 'check' } : mark, querySelectorAll: () => [mark] };
    let hit: any = el;
    vi.stubGlobal('document', { querySelector: () => el, elementFromPoint: () => hit, activeElement: el });
    vi.stubGlobal('getComputedStyle', () => style); vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812);
    const observe = () => {
      const frame = observeFirstRunElement({ selector: '[data-language="English"]' });
      if (typeof frame === 'boolean') throw new Error('Expected a DOM evidence frame');
      return frame;
    };
    expect(observe()).toMatchObject({ visible: true, reachable: true, focused: true, pressed: 'true', glyph: 'check', checkVisible: true });
    hit = {}; expect(observe().reachable).toBe(false); hit = el;
    parent.inert = true; expect(observe().visible).toBe(false); parent.inert = false;
    style.opacity = '0.5'; expect(observe().visible).toBe(false); style.opacity = '1';
    box.top = -1; expect(observe().visible).toBe(false); box.top = 30;
    style.overflowY = 'hidden'; parent.getBoundingClientRect = () => ({ left: 0, right: 375, top: 40, bottom: 812 });
    expect(observe().visible).toBe(false); style.overflowY = 'visible';
    el.scrollHeight = 100; expect(observe().visible).toBe(false);
  });
});
