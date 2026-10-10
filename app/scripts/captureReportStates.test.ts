import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { completeReportFixture, preservedReportFields, reportFieldGroups, reportFieldEvidence, reportControlFrame, exposeReportGoDeeper, REPORT_CAPTURE_STATES, REPORT_DISCLOSURES } from './capture/release-report-states.mjs';
import { expectedReleaseInteractionStates, syntheticReleaseReport } from './capture/release-interactions.mjs';

const source = readFileSync(new URL('./capture/release-report-states.mjs', import.meta.url), 'utf8');

describe('release report disclosure contracts, no browser or provider', () => {
  it('exercises every named disclosure closed and open in all focused viewport/language cells', () => {
    expect(REPORT_DISCLOSURES).toEqual(['opening', 'understanding', 'details', 'document', 'help', 'actions', 'council', 'sources']);
    for (const lang of ['en', 'he']) for (const w of [375, 1280]) {
      const states = expectedReleaseInteractionStates('focused', { w, h: w === 375 ? 812 : 800, lang }).map(item => item.state);
      for (const state of REPORT_CAPTURE_STATES) expect(states.filter(item => item === state)).toHaveLength(1);
    }
    for (const section of REPORT_DISCLOSURES) for (const suffix of ['closed', 'open']) expect(REPORT_CAPTURE_STATES).toContain(`report-${section}-${suffix}`);
  });

  it('uses bounded invented fixtures with real optional fields and a long opening in both languages', () => {
    for (const lang of ['en', 'he']) {
      const base = syntheticReleaseReport(lang);
      const original = structuredClone(base);
      const report = completeReportFixture(base, lang);
      expect(base).toEqual(original);
      expect(report.contract.text.length).toBeGreaterThan(360);
      expect(report.text).toBe(report.contract.text);
      expect(report.contract.handoffNotes.teacher).toBeTruthy();
      expect(report.contract.handoffNotes.professional).toBeTruthy();
      expect(report.contract.document.handoffNote).toBeTruthy();
      expect(report.contract.document.suggestedMemory).toHaveLength(1);
      const fields = preservedReportFields(report);
      expect(new Set(fields).size).toBe(fields.length);
      for (const value of [report.contract.text, ...report.contract.todayPlan, report.contract.parentScript, ...report.contract.observe, ...report.contract.avoid, ...report.contract.escalateIf, ...report.contract.document.keyPoints, ...report.contract.document.questionsForProfessional, ...report.contract.document.suggestedMemory, report.contract.document.handoffNote, report.council[0].suggestion]) expect(fields).toContain(value);
      expect(JSON.stringify(report)).not.toMatch(/https?:|data:|apiKey|accessToken|attachments/);
      expect(JSON.stringify(report).length).toBeLessThan(6500);
    }
  });

  it('allows Hebrew phrase collisions across fields but rejects duplicate, missing or changed semantic fields', () => {
    const fixture = completeReportFixture(syntheticReleaseReport('he'), 'he');
    const concept = fixture.council[0].concept;
    const flattened = preservedReportFields(fixture).join(' ');
    // Negative control for the old whole-report substring algorithm.
    expect(flattened.split(concept).length - 1).toBe(6);
    const groups = reportFieldGroups(fixture);
    const actual = groups.map(group => [...group.expected]);
    expect(reportFieldEvidence(groups, actual).every(field => field.exactMatch)).toBe(true);
    const index = groups.findIndex(group => group.id === 'council-concepts');
    for (const changed of [[...actual[index], actual[index][0]], [], ['different field value']]) {
      const bad = actual.map(values => [...values]); bad[index] = changed;
      expect(reportFieldEvidence(groups, bad)[index].exactMatch).toBe(false);
    }
    expect(JSON.stringify(reportFieldEvidence(groups, actual))).not.toContain(concept);
    expect(source).not.toContain('text.split(field');
  });

  it('requires real disclosed content, once-only fields and ungated urgent/text-only explanations', () => {
    for (const required of ['ONLY_FIRST_STEP_LEADS', 'SCRIPT_INITIALLY_VISIBLE', 'DISCLOSURE_PANEL_ID_PRESENT', 'DISCLOSURE_EXPANDED_STATE', 'DISCLOSURE_CONTENT_VISIBILITY', 'ALL_REMAINING_STEPS_VISIBLE', 'EVERY_SUPPLIED_VISIBLE_FIELD_ONCE', 'URGENT_HELP_PRECEDES_FIRST_STEP', 'URGENT_HELP_NO_DISCLOSURE_GATE', 'ROUTINE_HELP_NOT_DUPLICATED', 'TEXT_ONLY_NO_DISCLOSURE_GATE', 'NO_INVENTED_STEP']) expect(source).toContain(required);
    expect(source).toContain('evidence.every(field => field.exactMatch), evidence');
    expect(source).toContain('ALL_${section.toUpperCase()}_EXPOSED');
    expect(source).not.toMatch(/setContent|innerHTML\s*=|addStyleTag|\.coach-report__council/);
    expect(source).not.toMatch(/(?:coach-plan-door|coach-professional-note|coach-doc-handoff|coach-go-deeper).*\.click\(/);
    expect(source).toContain("await load('coach'); await openConversation(); setReportFixture(response)");
  });
});


/** DOM-shaped measurements only: these tests do not launch a browser. */
describe('Go deeper capture requires actual scrollport and hit-test evidence', () => {
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height });
  const fixture = (targetBox = rect(24, 200, 210, 44)) => {
    const scrollport = { getBoundingClientRect: () => rect(0, 80, 375, 500), clientLeft: 0, clientTop: 0, clientWidth: 375, clientHeight: 500 };
    const child = {};
    const view = { innerWidth: 375, innerHeight: 812, getComputedStyle: vi.fn(() => ({ overflowY: 'auto' })) };
    const element: any = { closest: vi.fn(() => scrollport), getBoundingClientRect: () => targetBox, contains: (hit: unknown) => hit === child };
    element.ownerDocument = { defaultView: view, elementFromPoint: vi.fn(() => child) };
    return { element, scrollport, view };
  };

  it('requires the entire control inside the real scrollport, not just inside the window', () => {
    const good = fixture();
    expect(reportControlFrame(good.element)).toMatchObject({ scrollportFound: true, scrollportScrollable: true, fullyWithinScrollport: true, unoccluded: true, probeCount: 5 });
    expect(good.element.closest).toHaveBeenCalledWith('[data-companion-scroll="true"]');
    expect(good.element.ownerDocument.elementFromPoint).toHaveBeenCalledTimes(5);
    // Both controls can satisfy Playwright isVisible and lie in the 812px
    // window, while being partly or wholly below the 580px transcript edge.
    for (const box of [rect(24, 560, 210, 44), rect(24, 650, 210, 44), rect(-1, 200, 210, 44), rect(24, 200, 0, 44), rect(24, NaN, 210, 44)]) {
      expect(reportControlFrame(fixture(box).element)).toMatchObject({ fullyWithinScrollport: false, unoccluded: false, probeCount: 0 });
    }
    const clippedByWindow = fixture(); clippedByWindow.view.innerHeight = 220;
    expect(reportControlFrame(clippedByWindow.element).fullyWithinScrollport).toBe(false);
    const notScrollable = fixture(); notScrollable.view.getComputedStyle.mockReturnValue({ overflowY: 'visible' });
    expect(reportControlFrame(notScrollable.element).fullyWithinScrollport).toBe(false);
    const missing = fixture(); missing.element.closest.mockReturnValue(null);
    expect(reportControlFrame(missing.element).scrollportFound).toBe(false);
  });

  it('rejects center or edge occlusion instead of blessing CSS visibility alone', () => {
    for (const blockedProbe of [1, 4]) {
      const { element } = fixture(); let calls = 0;
      const child = element.ownerDocument.elementFromPoint();
      element.ownerDocument.elementFromPoint.mockClear();
      element.ownerDocument.elementFromPoint.mockImplementation(() => ++calls === blockedProbe ? {} : child);
      const frame = reportControlFrame(element);
      expect(frame.fullyWithinScrollport).toBe(true);
      expect(frame.unoccluded).toBe(false);
      expect(element.ownerDocument.elementFromPoint).toHaveBeenCalledTimes(5);
    }
  });

  it('scrolls then measures and checks before capture, without invoking Go deeper', async () => {
    const calls: string[] = [];
    const cell: any = {};
    const target = {
      scrollIntoViewIfNeeded: vi.fn(async () => { calls.push('scroll'); }),
      evaluate: vi.fn(async (read: typeof reportControlFrame) => { calls.push('measure'); return read(fixture().element); }),
      click: vi.fn(),
    };
    const visible = vi.fn(async () => { calls.push('visible'); });
    const check = vi.fn((_cell: any, id: string, passed: boolean) => { calls.push(id); expect(passed).toBe(true); });
    await exposeReportGoDeeper(target, cell, { visible, check });
    calls.push('capture');
    expect(calls).toEqual(['scroll', 'visible', 'measure', 'GO_DEEPER_REAL_SCROLLPORT_FOUND', 'GO_DEEPER_WITHIN_SCROLLPORT', 'GO_DEEPER_NOT_OCCLUDED', 'capture']);
    expect(target.click).not.toHaveBeenCalled();
    expect(target.evaluate).toHaveBeenCalledWith(reportControlFrame);
    expect(cell.reportControlFrame.unoccluded).toBe(true);
    const block = source.slice(source.indexOf("await screen('shell', 'report-go-deeper'"), source.indexOf("await screen('shell', 'report-urgent-priority'"));
    expect(block).toContain("await exposeReportGoDeeper(report.locator('[data-testid=\"coach-go-deeper\"]'), cell, { visible, check })");
    expect(block).not.toContain("await visible(cell, 'GO_DEEPER_REACHABLE_WITHOUT_INVOKING'");
  });
});
