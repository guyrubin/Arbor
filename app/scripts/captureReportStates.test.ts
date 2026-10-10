import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { completeReportFixture, preservedReportFields, REPORT_CAPTURE_STATES, REPORT_DISCLOSURES } from './capture/release-report-states.mjs';
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

  it('requires real disclosed content, once-only fields and ungated urgent/text-only explanations', () => {
    for (const required of ['ONLY_FIRST_STEP_LEADS', 'SCRIPT_INITIALLY_VISIBLE', 'DISCLOSURE_PANEL_ID_PRESENT', 'DISCLOSURE_EXPANDED_STATE', 'DISCLOSURE_CONTENT_VISIBILITY', 'ALL_REMAINING_STEPS_VISIBLE', 'EVERY_SUPPLIED_VISIBLE_FIELD_ONCE', 'URGENT_HELP_PRECEDES_FIRST_STEP', 'URGENT_HELP_NO_DISCLOSURE_GATE', 'ROUTINE_HELP_NOT_DUPLICATED', 'TEXT_ONLY_NO_DISCLOSURE_GATE', 'NO_INVENTED_STEP']) expect(source).toContain(required);
    expect(source).toContain('counts.every(count => count === 1), counts');
    expect(source).toContain('ALL_${section.toUpperCase()}_EXPOSED');
    expect(source).not.toMatch(/setContent|innerHTML\s*=|addStyleTag|\.coach-report__council/);
    expect(source).not.toMatch(/(?:coach-plan-door|coach-professional-note|coach-doc-handoff|coach-go-deeper).*\.click\(/);
    expect(source).toContain("await load('coach'); await openConversation(); setReportFixture(response)");
  });
});
