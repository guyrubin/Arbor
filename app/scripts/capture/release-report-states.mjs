import { scrollConversationTranscript, checkConversationFrame } from './conversation-frame.mjs';

/** Actual rendered disclosure checks. API fixtures are explicitly synthetic. */
export const REPORT_DISCLOSURES = ['opening', 'understanding', 'details', 'document', 'help', 'actions', 'council', 'sources'];
export const REPORT_CAPTURE_STATES = ['report-fixture', ...REPORT_DISCLOSURES.flatMap(section => [`report-${section}-closed`, `report-${section}-open`]), 'report-all-fields-once', 'report-footer', 'report-go-deeper', 'report-urgent-priority', 'report-text-only', 'report-close-return'];

export function completeReportFixture(base, lang) {
  const result = structuredClone(base);
  const he = lang === 'he';
  const choose = (en, hebrew) => he ? hebrew : en;
  result.contract.text = result.text = Array.from({ length: 4 }, (_, n) => `${choose('This invented capture paragraph gives context for a small shared-reading invitation and preserves the full explanation for review.', 'הפסקה המומצאת הזו מוסיפה הקשר להזמנה קטנה לקריאה משותפת ושומרת את ההסבר המלא לעיון של ההורה.')} ${n + 1}.`).join(' ');
  result.contract.handoffNotes = { teacher: choose('Invented teacher note.', 'פתק מומצא למורה.'), professional: choose('Invented professional note.', 'פתק מומצא לאיש מקצוע.') };
  result.contract.document.handoffNote = choose('Invented document handoff context.', 'הקשר מומצא להעברת מסמך.');
  result.contract.document.suggestedMemory = [choose('The invented family likes reading together.', 'המשפחה המומצאת אוהבת לקרוא יחד.')];
  return result;
}

/** Exact provider payload text stays in memory; artifacts receive counts only. */
export function preservedReportFields(response) {
  const c = response.contract;
  return [c.text, ...c.todayPlan, c.parentScript, ...c.nonDiagnosticHypotheses.flatMap(item => [item.label, item.rationale]), ...c.observe, ...c.avoid, ...c.escalateIf,
    ...c.document.keyPoints, ...c.document.questionsForProfessional, c.document.handoffNote, ...c.document.suggestedMemory,
    ...c.sourceCards.map(item => item.title), ...response.council.flatMap(item => [item.name, item.concept, item.takeaway, item.suggestion])].filter(Boolean);
}

/** Scope each value to its semantic field, so a short phrase reused inside
 * another sentence is not mistaken for a duplicate rendering of this field. */
export function reportFieldGroups(response) {
  const c = response.contract;
  const group = (id, selector, expected) => ({ id, selector, expected });
  return [
    group('opening', '[data-testid="coach-report-opening"] .coach-report__lead', [c.text]),
    group('steps', '.coach-report__step-content > p', c.todayPlan),
    group('script', '[data-testid="say-this"] p', [`“${c.parentScript}”`]),
    group('hypothesis-labels', '[data-testid="coach-report-understanding"] li > strong', c.nonDiagnosticHypotheses.map(item => item.label)),
    group('hypothesis-reasons', '[data-testid="coach-report-understanding"] li > p', c.nonDiagnosticHypotheses.map(item => item.rationale).filter(Boolean)),
    group('observe', '[data-testid="coach-report-observe"] li', c.observe),
    group('avoid', '[data-testid="coach-report-avoid"] li', c.avoid),
    group('help', '[data-testid="coach-report-help"] li', c.escalateIf),
    group('document-points', '.coach-report__document > section:nth-of-type(1) > ul > li', c.document.keyPoints),
    group('document-questions', '.coach-report__document > section:nth-of-type(2) > ul > li', c.document.questionsForProfessional),
    group('document-note', '.coach-report__document > p', [c.document.handoffNote]),
    group('document-memory', '[data-testid="coach-doc-memory"] > li > p', c.document.suggestedMemory),
    group('source-titles', '[data-testid="coach-report-sources"] li > span:first-child', c.sourceCards.map(item => item.title)),
    group('council-names', '[data-testid="coach-report-council"] li > strong', response.council.map(item => item.name)),
    group('council-concepts', '[data-testid="coach-report-council"] li > span', response.council.map(item => ` · ${item.concept}`)),
    group('council-advice', '[data-testid="coach-report-council"] li > p', response.council.flatMap(item => [item.takeaway, item.suggestion].filter(Boolean))),
  ];
}

/** Only safe group IDs, lengths and booleans are retained as artifact evidence. */
export function reportFieldEvidence(groups, actual) {
  const norm = text => String(text).replace(/\s+/g, ' ').trim();
  return groups.map((group, index) => ({ id: group.id, expectedCount: group.expected.length, actualCount: actual[index]?.length ?? 0,
    exactMatch: Array.isArray(actual[index]) && actual[index].length === group.expected.length && actual[index].every((text, i) => norm(text) === norm(group.expected[i])) }));
}

/** Measure the control against the actual conversation scrollport, not just
 * CSS visibility. Only geometry and hit-test booleans enter artifact evidence. */
export function reportControlFrame(el) {
  const scrollport = el.closest('[data-companion-scroll="true"]');
  const view = el.ownerDocument.defaultView;
  if (!scrollport || !view) return { scrollportFound: false, fullyWithinScrollport: false, unoccluded: false, probeCount: 0 };
  const box = el.getBoundingClientRect();
  const frame = scrollport.getBoundingClientRect();
  const target = { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  const clip = {
    left: Math.max(0, frame.left + scrollport.clientLeft),
    top: Math.max(0, frame.top + scrollport.clientTop),
    right: Math.min(view.innerWidth, frame.left + scrollport.clientLeft + scrollport.clientWidth),
    bottom: Math.min(view.innerHeight, frame.top + scrollport.clientTop + scrollport.clientHeight),
  };
  const scrollportScrollable = /^(auto|scroll)$/.test(view.getComputedStyle(scrollport).overflowY);
  const finite = [...Object.values(target), ...Object.values(clip)].every(Number.isFinite);
  const fullyWithinScrollport = finite && scrollportScrollable && target.width > 0 && target.height > 0
    && clip.right > clip.left && clip.bottom > clip.top && target.left >= clip.left && target.right <= clip.right
    && target.top >= clip.top && target.bottom <= clip.bottom;
  const insetX = Math.min(8, target.width / 4), insetY = Math.min(8, target.height / 4);
  const probes = fullyWithinScrollport ? [
    [target.left + target.width / 2, target.top + target.height / 2],
    [target.left + insetX, target.top + insetY], [target.right - insetX, target.top + insetY],
    [target.left + insetX, target.bottom - insetY], [target.right - insetX, target.bottom - insetY],
  ] : [];
  const hits = probes.map(([x, y]) => {
    const hit = el.ownerDocument.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit));
  });
  const unoccluded = hits.length === 5 && hits.every(Boolean);
  return { scrollportFound: true, scrollportScrollable, target, scrollport: clip, fullyWithinScrollport, unoccluded, probeCount: probes.length };
}

/** Scroll and observe only. The council/provider action must never be invoked
 * merely to obtain a screenshot of its control. */
export async function exposeReportGoDeeper(target, cell, { visible, check }) {
  await target.evaluate(scrollConversationTranscript);
  await visible(cell, 'GO_DEEPER_REACHABLE_WITHOUT_INVOKING', target);
  const frame = await target.evaluate(reportControlFrame);
  cell.reportControlFrame = frame;
  check(cell, 'GO_DEEPER_REAL_SCROLLPORT_FOUND', frame.scrollportFound === true && frame.scrollportScrollable === true);
  check(cell, 'GO_DEEPER_WITHIN_SCROLLPORT', frame.fullyWithinScrollport === true);
  check(cell, 'GO_DEEPER_NOT_OCCLUDED', frame.unoccluded === true);
}

export async function collectReportStates(h) {
  const { page, screen, lang, check, visible, byId, composer, load, openConversation, closeConversation, syntheticReleaseReport, setReportFixture } = h;
  const fixture = completeReportFixture(syntheticReleaseReport(lang), lang);
  const he = lang === 'he';
  let report, frameBaseline;
  const conversation = () => page.locator('.companion-conversation:not([hidden])');
  // Every report frame receives final chrome/ancestor evidence, including a
  // failed interaction. A request also observes app behavior before we scroll.
  const reportScreen = (route, state, action) => screen(route, state, async cell => {
    try { await action(cell); }
    finally { await checkConversationFrame(conversation(), cell, { check, baseline: frameBaseline, phase: 'AFTER_INTERACTION' }); }
  });
  async function requestFixture(response, cell) {
    await load('coach'); await openConversation(); setReportFixture(response);
    frameBaseline = await checkConversationFrame(conversation(), cell, { check, phase: 'BEFORE_SEND' });
    const before = await byId('coach-answer-cards').count();
    await composer().locator('textarea').fill(he ? 'נא להציג את הדוגמה המומצאת לצילום.' : 'Show the invented capture example.');
    await composer().locator('[data-testid="coach-send"]').click();
    report = byId('coach-answer-cards').nth(before);
    await report.waitFor({ state: 'visible', timeout: 30000 });
    await checkConversationFrame(conversation(), cell, { check, baseline: frameBaseline, phase: 'AFTER_RESPONSE' });
    await report.evaluate(scrollConversationTranscript);
  }
  const baseline = await reportScreen('shell', 'report-fixture', async cell => {
    await requestFixture(fixture, cell);
    cell.fixture = 'bilingual-report-presentation-fixture';
    await visible(cell, 'FIRST_STEP_VISIBLE', report.locator('[data-testid="coach-report-next"]'));
    await visible(cell, 'SCRIPT_INITIALLY_VISIBLE', report.locator('[data-testid="say-this"]'));
    check(cell, 'ONLY_FIRST_STEP_LEADS', await report.locator('[data-testid="coach-report-next"] ol > li').count() === 1);
    check(cell, 'REPORT_DIRECTION', await report.getAttribute('dir') === (he ? 'rtl' : 'ltr'));
    for (const section of REPORT_DISCLOSURES) check(cell, `INITIAL_${section.toUpperCase()}_COLLAPSED`, await report.locator(`[data-testid="coach-report-${section}"] > button`).getAttribute('aria-expanded') === 'false');
  });
  for (const section of REPORT_DISCLOSURES) for (const open of [false, true]) await reportScreen('shell', `report-${section}-${open ? 'open' : 'closed'}`, async cell => {
    if (!baseline) throw new Error('DEPENDENT_STATE_UNREACHED');
    cell.fixture = 'bilingual-report-presentation-fixture';
    const target = report.locator(`[data-testid="coach-report-${section}"]`);
    const toggle = target.locator(':scope > button');
    await toggle.evaluate(scrollConversationTranscript);
    const frame = await toggle.evaluate(reportControlFrame);
    check(cell, 'DISCLOSURE_TOGGLE_IN_SCROLLPORT', frame.fullyWithinScrollport === true && frame.unoccluded === true);
    if (open) await toggle.click();
    const panelId = await toggle.getAttribute('aria-controls');
    check(cell, 'DISCLOSURE_PANEL_ID_PRESENT', !!panelId);
    const panel = target.locator('.coach-report__disclosure-body');
    check(cell, 'DISCLOSURE_SINGLE_PANEL', await panel.count() === 1 && await panel.getAttribute('id') === panelId);
    check(cell, 'DISCLOSURE_EXPANDED_STATE', await toggle.getAttribute('aria-expanded') === String(open));
    check(cell, 'DISCLOSURE_CONTENT_VISIBILITY', await panel.isVisible() === open);
    if (open && section === 'details') {
      check(cell, 'ALL_REMAINING_STEPS_VISIBLE', await panel.locator('ol > li').count() === fixture.contract.todayPlan.length - 1);
      await visible(cell, 'OBSERVE_REACHABLE', panel.locator('[data-testid="coach-report-observe"]'));
      await visible(cell, 'AVOID_REACHABLE', panel.locator('[data-testid="coach-report-avoid"]'));
    }
    if (open && section === 'actions') {
      for (const id of ['coach-plan-door', 'coach-professional-note', 'coach-doc-handoff']) await visible(cell, `ACTION_${id}_PRESERVED`, panel.locator(`[data-testid="${id}"]`));
      check(cell, 'KEEP_ROWS_PRESERVED', await panel.locator('.coach-report__save-row').count() > 0);
      check(cell, 'TEACHER_HANDOFF_PRESERVED', await panel.getByRole('button', { name: he ? /למורה/ : /teacher/i }).count() === 1);
    }
  });
  await reportScreen('shell', 'report-all-fields-once', async cell => {
    if (!baseline) throw new Error('DEPENDENT_STATE_UNREACHED');
    for (const section of REPORT_DISCLOSURES) await visible(cell, `ALL_${section.toUpperCase()}_EXPOSED`, report.locator(`[data-testid="coach-report-${section}"] .coach-report__disclosure-body`));
    const groups = reportFieldGroups(fixture);
    // Text is compared transiently in memory, never added to the evidence JSON.
    const actual = await Promise.all(groups.map(group => report.locator(group.selector).allTextContents()));
    const evidence = reportFieldEvidence(groups, actual);
    check(cell, 'EVERY_SUPPLIED_VISIBLE_FIELD_ONCE', evidence.every(field => field.exactMatch), evidence);
  });
  await reportScreen('shell', 'report-footer', async cell => { if (!baseline) throw new Error('DEPENDENT_STATE_UNREACHED'); const footer = report.locator('[data-testid="coach-answer-footer"]'); await footer.evaluate(scrollConversationTranscript); await visible(cell, 'FOOTER_PRESERVED', footer); });
  await reportScreen('shell', 'report-go-deeper', async cell => {
    await requestFixture({ ...structuredClone(fixture), council: [] }, cell);
    const actions = report.locator('[data-testid="coach-report-actions"] > button');
    await actions.evaluate(scrollConversationTranscript);
    const frame = await actions.evaluate(reportControlFrame);
    check(cell, 'ACTIONS_TOGGLE_IN_SCROLLPORT', frame.fullyWithinScrollport === true && frame.unoccluded === true);
    await actions.click();
    await exposeReportGoDeeper(report.locator('[data-testid="coach-go-deeper"]'), cell, { visible, check });
  });
  await reportScreen('shell', 'report-urgent-priority', async cell => {
    const urgent = structuredClone(fixture); urgent.contract.riskLevel = 'High';
    await requestFixture(urgent, cell);
    const help = report.locator('[data-testid="coach-report-urgent-help"]');
    await visible(cell, 'URGENT_HELP_IMMEDIATELY_EXPOSED', help);
    check(cell, 'URGENT_HELP_NO_DISCLOSURE_GATE', await help.locator('button[aria-expanded]').count() === 0);
    check(cell, 'URGENT_HELP_PRECEDES_FIRST_STEP', await report.evaluate(el => {
      const help = el.querySelector('[data-testid="coach-report-urgent-help"]');
      const next = el.querySelector('[data-testid="coach-report-next"]');
      return !!help && !!next && !!(help.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
    check(cell, 'ROUTINE_HELP_NOT_DUPLICATED', await report.locator('[data-testid="coach-report-help"]').count() === 0);
  });
  await reportScreen('shell', 'report-text-only', async cell => {
    const decline = structuredClone(fixture);
    Object.assign(decline.contract, { todayPlan: [], parentScript: '', nonDiagnosticHypotheses: [], observe: [], avoid: [], escalateIf: [], document: undefined, handoffNotes: { teacher: '', professional: '' }, sourceCards: [], sourceCardsUsed: [] });
    decline.council = [];
    await requestFixture(decline, cell);
    const opening = report.locator('[data-testid="coach-report-opening"]');
    await visible(cell, 'TEXT_ONLY_EXPLANATION_EXPOSED', opening);
    check(cell, 'TEXT_ONLY_NO_DISCLOSURE_GATE', await opening.locator('button[aria-expanded]').count() === 0);
    check(cell, 'NO_INVENTED_STEP', await report.locator('[data-testid="coach-report-next"]').count() === 0);
  });
  await screen('shell', 'report-close-return', async cell => {
    await checkConversationFrame(conversation(), cell, { check, baseline: frameBaseline, phase: 'BEFORE_CLOSE' });
    await closeConversation();
    const launcher = byId('companion-launcher').locator('.companion-launch-main');
    await visible(cell, 'REPORT_CLOSE_RETURNS_TO_LAUNCHER', launcher);
    await page.waitForFunction(() => document.activeElement?.matches('.companion-launch-main'));
    check(cell, 'REPORT_CLOSE_FOCUS_RETURNS_TO_LAUNCHER', await launcher.evaluate(el => document.activeElement === el));
    check(cell, 'REPORT_PANEL_CLOSED', await conversation().count() === 0);
  });

}
