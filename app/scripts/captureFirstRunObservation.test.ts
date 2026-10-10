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
    for (const [field, key] of Object.entries({ chosen: 'ob.first.observation.chosen', answer: 'ob.first.observation.answer', suggested: 'elev.closeloop.entry.suggested', parentAuthor: 'journal.manual', notice: 'ob.first.notice', keep: 'ob.first.observation.keep', purpose: 'ob.first.observation.purpose', receipt: 'ob.first.observation.saved', open: 'ob.first.observation.open', history: 'ob.first.observation.history.completed', try: 'ob.first.try' })) expect(text[field as keyof typeof text]).toBe(translate(lang, key));
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
  it('the actual guide capture counts the visible outer disclosure without counting nested Sources', async () => {
    const source = read('./capture/first-run-preview-states.mjs');
    const marker = "await run('hard-moment-card', async cell => {";
    const start = source.indexOf(marker) + marker.length;
    const body = source.slice(start, source.indexOf("\n  });", start));
    // This is the existing runtime's real nested structure, not a new guide.
    expect(read('../src/components/auth/OnboardingFlow.tsx')).toContain('<details><summary>');
    expect(read('../src/components/behaviors/HardMomentsSection.tsx')).toContain('<summary className="min-h-11');
    const run = async (script: string, visible = true, outerCount = 1) => {
      const checks: Record<string, boolean> = {};
      const locator = (selector: string) => ({
        click: async () => {}, selectOption: async () => {}, isVisible: async () => true,
        count: async () => selector === 'details summary' ? 2 : outerCount,
      });
      const env = { back: () => locator('back'), step: async () => {}, worry: () => ({ locator }), primary: () => ({ ...locator('primary'), innerText: async () => 'Try' }),
        ready: async () => {}, card: () => ({ locator }), element: async () => ({ visible, reachable: visible }), text: { try: 'Try' }, actions: async () => [],
        check: (_cell: unknown, id: string, passed: boolean) => { checks[id] = passed; } };
      await new Function(...Object.keys(env), `return async cell => {${script}}`)(...Object.values(env))({});
      return checks;
    };
    expect((await run(body)).HARD_MOMENT_GUIDE_VISIBLE).toBe(true);
    expect((await run(body.replace("locator('.first-run-authored-card > details > summary')", "locator('details summary')"))).HARD_MOMENT_GUIDE_VISIBLE).toBe(false);
    expect((await run(body, false)).HARD_MOMENT_GUIDE_VISIBLE).toBe(false);
    expect((await run(body, true, 0)).HARD_MOMENT_GUIDE_VISIBLE).toBe(false);
    expect((await run(body, true, 2)).HARD_MOMENT_GUIDE_VISIBLE).toBe(false);
  });
  it('the actual multiline capture restores module scroll after Tab and still requires the full question', async () => {
    const source = read('./capture/first-run-preview-states.mjs');
    const marker = "await run('observation-multiline', async cell => {";
    const start = source.indexOf(marker) + marker.length;
    const body = source.slice(start, source.indexOf("\n  }, observationFrame);", start));
    const run = async (script: string) => {
      const events: string[] = []; let scrolled = false, focused = false;
      const env = { text: { words: 'One\nTwo', keep: 'Keep' }, answer: () => ({ fill: async () => { events.push('fill'); }, focus: async () => { events.push('focus'); }, inputValue: async () => 'One\nTwo' }),
        page: { keyboard: { press: async (key: string) => { events.push(key); focused = key === 'Tab'; } } },
        stepModule: () => ({ scrollIntoViewIfNeeded: async () => { events.push('scroll-module'); scrolled = true; } }),
        element: async () => { events.push('observe-save'); return { focused, reachable: true, text: 'Keep' }; }, save: () => ({ isDisabled: async () => false }),
        fullQuestion: async () => { events.push('observe-full-question'); if (!scrolled) throw new Error('QUESTION_ABOVE_VIEWPORT'); },
        check: (_cell: unknown, _id: string, passed: boolean) => { if (!passed) throw new Error('ASSERTION_FAILED'); }, oneMove: async () => {}, noEfficacy: async () => {}, noReceipt: async () => {} };
      await new Function(...Object.keys(env), `return async cell => {${script}}`)(...Object.values(env))({});
      return events;
    };
    expect(await run(body)).toEqual(['fill', 'focus', 'Tab', 'scroll-module', 'observe-save', 'observe-full-question']);
    await expect(run(body.replace('await stepModule().scrollIntoViewIfNeeded();', ''))).rejects.toThrow('QUESTION_ABOVE_VIEWPORT');
    expect(body).toContain('await fullQuestion(cell)');
  });
  it('the actual blank capture selects the unique purpose rather than the new required-words hint', async () => {
    const source = read('./capture/first-run-preview-states.mjs'), marker = "await run('observation-blank', async cell => {";
    const start = source.indexOf(marker) + marker.length, body = source.slice(start, source.indexOf("\n  }, observationFrame);", start));
    const runtime = read('../src/components/companion/NowView.tsx');
    expect(runtime).toContain('id={`${id}-observation-purpose`}');
    expect(runtime).toContain('data-testid="now-observation-required"');
    const run = async (script: string) => {
      const checks: Record<string, boolean> = {};
      const env = { stepModule: () => ({ scrollIntoViewIfNeeded: async () => {} }), fullQuestion: async () => {}, text: { purpose: 'Purpose' },
        element: async (selector: string) => { if (!selector.includes('observation-purpose')) throw new Error('STRICT_DUPLICATE_PURPOSE_AND_HINT'); return { visible: true, reachable: true, text: 'Purpose' }; },
        page: { locator: () => ({ count: async () => 1 }) }, answer: () => ({ inputValue: async () => '', fill: async () => {} }), save: () => ({ isDisabled: async () => true }),
        check: (_cell: unknown, id: string, passed: boolean) => { checks[id] = passed; }, oneMove: async () => {}, noEfficacy: async () => {}, noReceipt: async () => {} };
      await new Function(...Object.keys(env), `return async cell => {${script}}`)(...Object.values(env))({}); return checks;
    };
    expect((await run(body)).OBSERVATION_PURPOSE_EXACT).toBe(true);
    await expect(run(body.replace('form > p[id$="-observation-purpose"]', 'form > p'))).rejects.toThrow('STRICT_DUPLICATE_PURPOSE_AND_HINT');
  });
  it.each(['en', 'he'] as const)('%s actual history capture requires separate raw fields, local attribution and preserved whitespace', async lang => {
    const source = read('./capture/first-run-preview-states.mjs'), marker = "await run('observation-history-details', async cell => {";
    const start = source.indexOf(marker) + marker.length, body = source.slice(start, source.indexOf('\n  }, { selector:', start));
    const runtime = read('../src/components/journal/JournalEntrySheet.tsx');
    expect(runtime).toContain('data-testid="journal-entry-observation-prompt"'); expect(runtime).toContain('data-testid="journal-entry-observation-words"');
    expect(runtime).toContain('whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{signal.refTitle}</dd>');
    expect(runtime).toContain('whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{signal.detail}</dd>');
    const text = firstRunPreviewText(lang);
    const run = async (script = body, patch: Record<string, unknown> = {}) => {
      const checks: Record<string, boolean> = {};
      const promptSection = '[role="dialog"] [data-testid="journal-entry-observation-prompt"]', wordsSection = '[role="dialog"] [data-testid="journal-entry-observation-words"]';
      const frame = (rawText: string) => ({ visible: true, reachable: true, rawText, whiteSpace: 'pre-wrap' });
      const frames: Record<string, any> = { [`${promptSection} > dd`]: frame(text.recommendation), [`${wordsSection} > dd`]: { ...frame(text.words), ...patch },
        [`${promptSection} > dt`]: frame(text.chosen), [`${wordsSection} > dt`]: frame(text.answer),
        [`${promptSection} > dt > span`]: frame(text.suggested), [`${wordsSection} > dt > span`]: frame(text.parentAuthor) };
      const dialog = { count: async () => 1, innerText: async () => text.history, locator: () => ({ count: async () => 0 }) };
      const env = { text, rowSelector: () => 'row', ready: async () => {}, noHistoryGrade: async () => {},
        element: async (selector: string) => { if (!frames[selector]) throw new Error('OLD_MIXED_PARAGRAPH_ABSENT'); return frames[selector]; },
        page: { getByRole: () => dialog, locator: (selector: string) => ({ click: async () => {}, count: async () => 1,
          innerText: async () => selector.startsWith(promptSection) ? `${text.chosen}\n${text.suggested}` : `${text.answer}\n${text.parentAuthor}` }) },
        check: (_cell: unknown, id: string, passed: boolean) => { checks[id] = passed; } };
      await new Function(...Object.keys(env), `return async cell => {${script}}`)(...Object.values(env))({}); return checks;
    };
    expect(await run()).toMatchObject({ FULL_HISTORY_QUESTION_AND_WORDS_VISIBLE: true, HISTORY_RAW_TEXT_WHITESPACE: true, HISTORY_SEPARATE_ATTRIBUTION: true });
    await expect(run(body.replace('`${promptSection} > dd`', '\'[role="dialog"] p[dir="auto"]:nth-of-type(2)\''))).rejects.toThrow('OLD_MIXED_PARAGRAPH_ABSENT');
    expect((await run(body, { rawText: text.words.replace('\n', ' ') })).FULL_HISTORY_QUESTION_AND_WORDS_VISIBLE).toBe(false);
    expect((await run(body, { whiteSpace: 'normal' })).HISTORY_RAW_TEXT_WHITESPACE).toBe(false);
    expect((await run(body, { visible: false })).FULL_HISTORY_QUESTION_AND_WORDS_VISIBLE).toBe(false);
    expect((await run(body.replace('promptSource.rawText === text.suggested', 'promptSource.rawText === text.parentAuthor'))).HISTORY_SEPARATE_ATTRIBUTION).toBe(false);
  });
  it('requires real visible check glyphs and rejects occlusion, clipping, hidden and inert frames', () => {
    const box = { left: 20, right: 320, top: 30, bottom: 80, width: 300, height: 50 };
    const style: any = { display: 'block', visibility: 'visible', opacity: '1', whiteSpace: 'pre-wrap', overflowX: 'visible', overflowY: 'visible' };
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
    expect(observe()).toMatchObject({ visible: true, reachable: true, focused: true, pressed: 'true', glyph: 'check', checkVisible: true, rawText: 'checkEnglish', whiteSpace: 'pre-wrap' });
    hit = {}; expect(observe().reachable).toBe(false); hit = el;
    parent.inert = true; expect(observe().visible).toBe(false); parent.inert = false;
    style.opacity = '0.5'; expect(observe().visible).toBe(false); style.opacity = '1';
    box.top = -1; expect(observe().visible).toBe(false); box.top = 30;
    style.overflowY = 'hidden'; parent.getBoundingClientRect = () => ({ left: 0, right: 375, top: 40, bottom: 812 });
    expect(observe().visible).toBe(false); style.overflowY = 'visible';
    el.scrollHeight = 100; expect(observe().visible).toBe(false);
  });
});
