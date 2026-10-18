/**
 * v3 FEAT-09 — "Our question" in the care summary (#/consult and #/handoff).
 *
 * The family question the parent selected (ArborContext activeFamilyTopic)
 * can join the summary as ONE line, "Our question: …", only when the parent
 * turns the chip on:
 *   - the chip shows only while a question is selected for this child;
 *   - it is OFF by default and never auto-included (a different question
 *     selected meanwhile is off again);
 *   - ON adds exactly one line to the verbatim preview, the same line Copy
 *     and the PDF carry, through the one guarded seam (serializeForExport /
 *     exportPrintSections), so a "%" in it fails closed like the parent note;
 *   - nothing is copied until "I reviewed" is ticked, and turning the chip on
 *     or off withdraws a tick already given;
 *   - in the PDF the line is a plain line under the title block (a lead
 *     section), not a section heading.
 * And the Care summary page (#/handoff, excludeTeacher): its lede says what
 * the builder does (every line starts ticked; the parent unticks), and it
 * never opens in the teacher branch, even with a teacher stored on this
 * device.
 *
 * Node-only: AskSpecialist runs as a function under slot hooks (the
 * ConsultTarget.egress harness), and its own buttons are pressed through
 * their props. Invented child and question only. EN + HE.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  lang: "en" as "en" | "he",
  t: ((key: string) => key) as (key: string, vars?: Record<string, string | number>) => string,
  topic: null as null | Record<string, unknown>,
  copy: vi.fn(), pdf: vi.fn(), record: vi.fn(), toast: vi.fn(),
  child: { id: "child-1", name: "Noa", age: 5, languages: ["English"], schoolContext: "Kindergarten", challenges: [], strengths: ["Builds towers"], interests: [] },
  empty: [] as any[],
  questions: [{ id: "q1", text: "What helps her settle at bedtime?" }],
}));

vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  const memo = (calculate: () => unknown, deps: unknown[]) => {
    const i = h.cursor++, prev = h.slots[i];
    if (!prev || deps.some((d, n) => !Object.is(d, prev.deps[n]))) h.slots[i] = { deps, value: calculate() };
    return h.slots[i].value;
  };
  return {
    ...actual,
    useState: (initial: any) => {
      const i = h.cursor++;
      if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial;
      return [h.slots[i], (next: any) => { const value = typeof next === "function" ? next(h.slots[i]) : next; if (!Object.is(h.slots[i], value)) { h.slots[i] = value; h.dirty = true; } }];
    },
    useRef: (initial: any) => { const i = h.cursor++; return h.slots[i] ??= { current: initial }; },
    useMemo: memo,
    useCallback: (fn: unknown, deps: unknown[]) => memo(() => fn, deps),
    useId: () => "synthetic-id",
    useSyncExternalStore: () => 0,
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const i = h.cursor++, prev = h.slots[i];
      if (prev && deps.every((d, n) => Object.is(d, prev.deps[n]))) return;
      const slot = { deps, cleanup: undefined as any };
      h.slots[i] = slot;
      h.effects.push(() => { prev?.cleanup?.(); slot.cleanup = effect(); });
    },
  };
});

function noop() {}
vi.mock("../../context/ArborContext", () => ({
  useArborOptional: () => null,
  useArbor: () => ({
    childProfile: h.child, behaviorLogs: h.empty, milestones: h.empty, actionPlans: h.empty, approvedMemoryItems: h.empty, actionLoop: h.empty,
    setActiveTab: noop, openPaywall: noop, pendingConsultPrefill: null, consumeConsultPrefill: noop,
    activeFamilyTopic: h.topic,
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: h.t }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_child: string, name: string) => ({ items: name === "apptQuestions" ? h.questions : h.empty, loaded: true, upsert: noop, remove: noop }),
}));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: noop, trackShareCompleted: noop }));
vi.mock("./Reports", () => ({ REPORTS: [], useReportExport: () => noop, useConsultPdf: () => h.pdf }));
vi.mock("../../consult/exportHistory", () => ({ getLastExportedAt: () => null, recordExport: (...args: any[]) => h.record(...args) }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: noop, step: null }) }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("motion/react", async (original) => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => false }));

import { translate } from "../../lib/i18n";
import { renderPrintableHtml } from "../../lib/reportExport";
import AskSpecialist from "./AskSpecialist";
import {
  buildConsultPacket,
  buildPacketInput,
  exportPrintSections,
  insertFamilyQuestion,
  serializeForExport,
  TeacherEgressError,
} from "../../consult/packet";
import { exportPlainLines } from "../../consult/plainText";
import { ClinicalLanguageError } from "../../lib/clinicalScan";
import { noticeCarePacket } from "../../lib/noticeSources";

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as El;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const byId = (node: React.ReactNode, id: string) => elements(node).find((el) => el.props["data-testid"] === id);

describe("B-GROWTH-44 · targeted observation through the existing Care egress", () => {
  const source = { childId: "child-1", id: "milestones:m1", kind: "answer" as const, label: "Saved answer", source: "Parent response", at: "2026-10-16", text: "Points to ask · Not sure" };
  const packet = () => noticeCarePacket([source], "Noa", "2026-10-18T08:00:00Z", false);
  const choose = (tree: React.ReactNode) => elements(tree).find(element => element.props.testId === "consult-packet-item")!.props.check.props.onClick();

  it("starts unselected, keeps unrelated record data out, and exports only after selection and review", async () => {
    h.topic = topic("en");
    const props = { noticePacket: packet(), noticeRevision: {}, excludeTeacher: true, egressGuard: { isCurrent: () => true } };
    let tree = render(props);
    expect(byId(tree, "consult-copy")!.props.disabled).toBe(true);
    expect(byId(tree, "consult-include-topic")).toBeUndefined();
    expect(textOf(tree)).not.toContain(h.questions[0].text);
    expect(textOf(tree)).not.toContain("Builds towers");
    choose(tree); tree = render(props);
    await byId(tree, "consult-copy")!.props.onClick(); expect(h.copy).not.toHaveBeenCalled();
    byId(tree, "consult-reviewed")!.props.onClick(); tree = render(props);
    await byId(tree, "consult-copy")!.props.onClick();
    expect(h.copy).toHaveBeenCalledTimes(1);
    const copy = String(h.copy.mock.calls[0][0]);
    expect(props.noticePacket.sections[0].items[0].id).toBe("milestones:m1");
    expect(copy).toContain("Points to ask · Not sure"); expect(copy).not.toContain("milestones:m1"); expect(copy).toContain("2026-10-16");
    expect(copy).not.toContain(h.questions[0].text); expect(copy).not.toContain("Builds towers");
  });

  it("blocks captured Copy/PDF/Send callbacks when a source is revoked before render", async () => {
    let current = true;
    const props = { noticePacket: packet(), noticeRevision: {}, excludeTeacher: true, egressGuard: { isCurrent: () => current } };
    choose(render(props)); byId(render(props), "consult-reviewed")!.props.onClick(); const held = render(props);
    current = false;
    await byId(held, "consult-copy")!.props.onClick(); byId(held, "consult-pdf")!.props.onClick(); byId(held, "consult-send-trusted")!.props.onClick();
    expect(h.copy).not.toHaveBeenCalled(); expect(h.pdf).not.toHaveBeenCalled(); expect(h.record).not.toHaveBeenCalled();
  });

  it("a changed source withdraws both item selection and review while retaining the parent's draft", async () => {
    const props = { noticePacket: packet(), noticeRevision: {}, excludeTeacher: true, egressGuard: { isCurrent: () => true } };
    choose(render(props)); byId(render(props), "consult-reason-input")!.props.onChange({ target: { value: "Could we discuss this?" } });
    byId(render(props), "consult-reviewed")!.props.onClick(); const held = render(props);
    const next = { ...props, noticeRevision: {}, noticePacket: noticeCarePacket([{ ...source, text: "Points to ask · Not yet" }], "Noa", "2026-10-18T08:00:00Z", false) };
    const changed = render(next);
    expect(byId(changed, "consult-reviewed")!.props["aria-pressed"]).toBe(false);
    const item = elements(changed).find(element => element.props.testId === "consult-packet-item" && String(element.key).includes("milestones"))!;
    expect(item.props.check.props["aria-pressed"]).toBe(false);
    expect(byId(changed, "consult-reason-input")!.props.value).toBe("Could we discuss this?");
    await byId(held, "consult-copy")!.props.onClick(); expect(h.copy).not.toHaveBeenCalled();
  });
});

function render(props: object = {}): React.ReactNode {
  for (let n = 0; n < 12; n++) {
    h.dirty = false;
    h.cursor = 0;
    const tree = (AskSpecialist as unknown as (p: object) => React.ReactNode)(props);
    h.effects.splice(0).forEach((effect) => effect());
    if (!h.dirty) return tree;
  }
  throw Error("render did not settle");
}

/** The verbatim preview, line by line (what Copy carries). */
const previewLines = (tree: React.ReactNode) =>
  elements(byId(tree, "consult-export-preview"))
    .filter((el) => el.props["data-line-role"])
    .map((el) => ({ role: el.props["data-line-role"] as string, text: (React.Children.toArray(el.props.children)[0] as El).props.text as string }));

const textOf = (node: React.ReactNode): string =>
  elements(node).flatMap((el) => React.Children.toArray(el.props.children).filter((c) => typeof c === "string" || typeof c === "number")).join("") +
  elements(node).map((el) => (typeof el.props.text === "string" ? el.props.text : "")).join("");

const QUESTION = {
  en: "How do we make mornings calmer?",
  he: "איך עושים את הבקרים רגועים יותר?",
};
const topic = (lang: "en" | "he", over: Record<string, unknown> = {}) => ({
  id: "topic-1", childId: "child-1", title: QUESTION[lang], intent: "understand", status: "active",
  observationIds: [], createdAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z", ...over,
});
const lineFor = (lang: "en" | "he", title = QUESTION[lang]) => translate(lang, "elev.consult.topic.line", { title });

let storage = new Map<string, string>();
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.lang = "en"; h.topic = null;
  h.t = (key, vars) => translate(h.lang, key, vars);
  for (const mock of [h.copy, h.pdf, h.record, h.toast]) mock.mockReset();
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
  vi.stubGlobal("navigator", { clipboard: { writeText: h.copy } });
});
afterEach(() => { h.slots.forEach((slot) => slot?.cleanup?.()); vi.unstubAllGlobals(); });

describe("v3 FEAT-09 · Our question — the chip", () => {
  it("does not render without a selected family question", () => {
    const tree = render();
    expect(byId(tree, "consult-reason-section")).toBeDefined();
    expect(byId(tree, "consult-include-topic")).toBeUndefined();
  });

  it("does not offer another child's question, nor a finished one", () => {
    h.topic = topic("en", { childId: "child-2" });
    expect(byId(render(), "consult-include-topic")).toBeUndefined();
    h.slots = []; h.topic = topic("en", { status: "archived" });
    expect(byId(render(), "consult-include-topic")).toBeUndefined();
  });

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: is off by default, names the question, and is a 44 px toggle on the shipped bookmark glyph`, () => {
      h.lang = lang; h.topic = topic(lang);
      const tree = render();
      const chip = byId(tree, "consult-include-topic")!;
      expect(chip).toBeDefined();
      expect(chip.type).toBe("button");
      expect(chip.props.type).toBe("button");
      expect(chip.props["aria-pressed"]).toBe(false);
      expect(chip.props.className).toContain("min-h-[44px]");
      expect(chip.props.className).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
      const glyphs = elements(chip).filter((el) => typeof el.props.name === "string").map((el) => el.props.name);
      expect(glyphs).toEqual(["bookmark"]);
      const label = textOf(chip);
      expect(label).toContain(translate(lang, "elev.consult.topic.include"));
      expect(label).toContain(QUESTION[lang]);
      // the chip sits in step 2 ("What changed"), not in the packet card
      // (Children.toArray clones elements, so this checks by test id, not identity)
      expect(byId(byId(tree, "consult-reason-section"), "consult-include-topic")).toBeDefined();
      expect(byId(byId(tree, "consult-review-export"), "consult-include-topic")).toBeUndefined();
      // off: the preview carries no question line
      expect(previewLines(tree).map((l) => l.text)).not.toContain(lineFor(lang));
    });

    it(`${lang}: on adds exactly one preview line, under the title, and off removes it`, () => {
      h.lang = lang; h.topic = topic(lang);
      const off = previewLines(render());
      byId(render(), "consult-include-topic")!.props.onClick();
      const tree = render();
      expect(byId(tree, "consult-include-topic")!.props["aria-pressed"]).toBe(true);
      const on = previewLines(tree);
      expect(on.length).toBe(off.length + 1);
      const added = on.filter((l) => !off.some((o) => o.text === l.text && o.role === l.role));
      expect(added).toEqual([{ role: "body", text: lineFor(lang) }]);
      // directly after the title block (title, prepared line)
      expect(on[0].role).toBe("title");
      expect(on.findIndex((l) => l.text === lineFor(lang))).toBe(2);
      byId(tree, "consult-include-topic")!.props.onClick();
      expect(previewLines(render())).toEqual(off);
    });
  }

  it("nothing is copied, saved or sent until I reviewed is ticked; then Copy carries the line", async () => {
    h.topic = topic("en");
    byId(render(), "consult-include-topic")!.props.onClick();
    let tree = render();
    for (const id of ["consult-copy", "consult-pdf", "consult-send-trusted"]) expect(byId(tree, id)!.props.disabled, id).toBe(true);
    await byId(tree, "consult-copy")!.props.onClick();
    byId(tree, "consult-pdf")!.props.onClick();
    expect(h.copy).not.toHaveBeenCalled();
    expect(h.pdf).not.toHaveBeenCalled();
    expect(h.record).not.toHaveBeenCalled();

    byId(render(), "consult-reviewed")!.props.onClick();
    tree = render();
    expect(byId(tree, "consult-reviewed")!.props["aria-pressed"]).toBe(true);
    expect(byId(tree, "consult-copy")!.props.disabled).toBe(false);
    await byId(tree, "consult-copy")!.props.onClick();
    expect(h.copy).toHaveBeenCalledTimes(1);
    const copied = String(h.copy.mock.calls[0][0]);
    expect(copied.split("\n").filter((l) => l === lineFor("en"))).toHaveLength(1);
    // the PDF carries the same line, through the same seam
    byId(render(), "consult-pdf")!.props.onClick();
    expect(h.pdf).toHaveBeenCalledTimes(1);
    const sections = h.pdf.mock.calls[0][1] as { heading: string; body: string[]; lead?: boolean }[];
    expect(sections.filter((s) => s.lead && s.body.join("") === lineFor("en"))).toHaveLength(1);
    expect(sections.some((s) => s.heading === lineFor("en"))).toBe(false);
  });

  it("turning the chip on or off withdraws a tick already given", () => {
    h.topic = topic("en");
    byId(render(), "consult-reviewed")!.props.onClick();
    expect(byId(render(), "consult-reviewed")!.props["aria-pressed"]).toBe(true);
    byId(render(), "consult-include-topic")!.props.onClick();
    let tree = render();
    expect(byId(tree, "consult-reviewed")!.props["aria-pressed"]).toBe(false);
    expect(byId(tree, "consult-copy")!.props.disabled).toBe(true);
    byId(tree, "consult-reviewed")!.props.onClick();
    expect(byId(render(), "consult-reviewed")!.props["aria-pressed"]).toBe(true);
    byId(render(), "consult-include-topic")!.props.onClick();
    tree = render();
    expect(byId(tree, "consult-reviewed")!.props["aria-pressed"]).toBe(false);
    expect(byId(tree, "consult-copy")!.props.disabled).toBe(true);
  });

  it("is never auto-included: another question selected meanwhile is off", () => {
    h.topic = topic("en");
    byId(render(), "consult-include-topic")!.props.onClick();
    expect(previewLines(render()).map((l) => l.text)).toContain(lineFor("en"));
    h.topic = topic("en", { id: "topic-2", title: "Why is the car seat hard?" });
    const tree = render();
    expect(byId(tree, "consult-include-topic")!.props["aria-pressed"]).toBe(false);
    const texts = previewLines(tree).map((l) => l.text);
    expect(texts).not.toContain(lineFor("en"));
    expect(texts).not.toContain(lineFor("en", "Why is the car seat hard?"));
  });

  it("fails closed like the parent note: a percentage in the question blocks every verb", () => {
    h.topic = topic("en", { title: "Is 30% of her speech clear?" });
    byId(render(), "consult-include-topic")!.props.onClick();
    const tree = render();
    expect(byId(tree, "consult-export-preview")).toBeUndefined();
    expect(textOf(byId(tree, "consult-preview"))).toContain(translate("en", "elev.carehonesty.consult.blocked.generic"));
    for (const id of ["consult-copy", "consult-pdf", "consult-send-trusted"]) expect(byId(tree, id)!.props.disabled, id).toBe(true);
  });
});

describe("v3 FEAT-09 · Our question — the export seam", () => {
  const packet = buildConsultPacket({
    ...buildPacketInput(
      { profile: { name: "Noa", age: 5, languages: ["English"], schoolContext: "Kindergarten", strengths: ["Builds towers"], challenges: [] }, logs: [], milestones: [], plans: [], memory: [] },
      Date.UTC(2026, 9, 1),
    ),
    questions: ["What helps her settle at bedtime?"],
  });
  const LINE = "Our question: How do we make mornings calmer?";

  it("an empty line leaves the text unchanged; a line lands once, after the title block", () => {
    const md = serializeForExport("pediatrician", packet);
    expect(insertFamilyQuestion(md, "")).toBe(md);
    expect(insertFamilyQuestion(md, "   ")).toBe(md);
    expect(serializeForExport("pediatrician", packet, new Set(), "", "Parent note", "en", "")).toBe(md);
    const withLine = serializeForExport("pediatrician", packet, new Set(), "", "Parent note", "en", LINE);
    const before = exportPlainLines(md), after = exportPlainLines(withLine);
    expect(after.length).toBe(before.length + 1);
    expect(after[2]).toEqual({ text: LINE, role: "body" });
    expect(withLine.split("\n").filter((l) => l === LINE)).toHaveLength(1);
  });

  it("collapses a multi-line title to one line", () => {
    expect(insertFamilyQuestion("# T\n_p_\n\n## S\n- a\n", "Our question:\n  two\nlines")).toBe("# T\n_p_\nOur question: two lines\n\n## S\n- a\n");
    expect(insertFamilyQuestion("# T\n_p_\n", "Our question: x")).toBe("# T\n_p_\nOur question: x\n");
  });

  it("the PDF carries the same line first, as a plain line, not a heading; self and clinician audiences alike", () => {
    for (const audience of ["pediatrician", "self"] as const) {
      const sections = exportPrintSections(audience, packet, new Set(), "", "Parent note", "en", LINE);
      expect(sections[0]).toEqual({ heading: "", body: [LINE], lead: true });
      expect(sections.filter((s) => s.body.includes(LINE))).toHaveLength(1);
      expect(sections.some((s) => s.heading === LINE)).toBe(false);
      const without = exportPrintSections(audience, packet, new Set(), "", "Parent note", "en");
      expect(without.some((s) => s.lead || s.body.includes(LINE))).toBe(false);
    }
  });

  it("the print shell renders the lead line as a body paragraph under the title block, never an h2", () => {
    const sections = exportPrintSections("pediatrician", packet, new Set(), "", "Parent note", "en", LINE);
    const html = renderPrintableHtml({ title: "Summary", subtitle: "Noa, 5", sections }, "Noa", "en");
    expect(html).toContain(`<p class="lead" dir="auto">${LINE}</p>`);
    expect(html).not.toContain(`<h2>${LINE}</h2>`);
    expect(html).not.toMatch(/<h2><\/h2>/);
    // under the title block (h1, subtitle, meta), before the first section
    const at = html.indexOf('<p class="lead"');
    expect(at).toBeGreaterThan(html.indexOf('<p class="meta">'));
    expect(at).toBeLessThan(html.indexOf("<section>"));
    // NEGATIVE CONTROL: the earlier shape, a heading-only section, printed an h2 over an empty dash
    const old = renderPrintableHtml({ title: "Summary", sections: [{ heading: LINE, body: [] }] }, "Noa", "en");
    expect(old).toContain(`<h2>${LINE}</h2><p class="muted">—</p>`);
  });

  it("the same guards cover it: % fails closed for every audience, a teacher never gets the packet", () => {
    const pct = "Our question: is 30% of her speech clear?";
    for (const audience of ["pediatrician", "slp", "self"] as const) {
      expect(() => serializeForExport(audience, packet, new Set(), "", "Parent note", "en", pct)).toThrow(ClinicalLanguageError);
      expect(() => exportPrintSections(audience, packet, new Set(), "", "Parent note", "en", pct)).toThrow(ClinicalLanguageError);
    }
    expect(() => serializeForExport("teacher", packet, new Set(), "", "Parent note", "en", LINE)).toThrow(TeacherEgressError);
    expect(() => exportPrintSections("teacher", packet, new Set(), "", "Parent note", "en", LINE)).toThrow(TeacherEgressError);
  });
});

describe("v3 FEAT-09 · the Care summary page (#/handoff)", () => {
  const audienceChips = (tree: React.ReactNode) => elements(byId(tree, "consult-audience-row")).filter((el) => el.props.role === "radio");
  const chipText = (el: El) => textOf(el);

  it("the lede says what the builder does: every line starts ticked, so the parent unticks, never picks", () => {
    // Default inclusion state, as the parent first meets it.
    const tree = render({ excludeTeacher: true });
    const rows = elements(tree).filter((el) => el.props.testId === "consult-packet-item");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.props.excluded).toBe(false);
      expect(row.props.check.props["aria-pressed"]).toBe(true);
    }
    // The prepared questions ride in without a pick, and the page says so.
    expect(textOf(byId(tree, "consult-reason-section"))).toContain(translate("en", "elev.learnCare.appt.questions.toPacket"));
    // So the lede asks for an untick and makes no opt-in claim, in EN and HE.
    const en = translate("en", "elev.consult.summary.lede");
    const he = translate("he", "elev.consult.summary.lede");
    expect(en).toMatch(/^Untick\b/);
    expect(en).not.toMatch(/\bonly\b|\bpick|\bselect|\bchoose/i);
    expect(he.startsWith("הסירו את הסימון")).toBe(true);
    expect(he).not.toMatch(/(^|\s)רק(\s|$)|שתבחרו/);
    expect(he).not.toMatch(/[A-Za-z]/);
    // NEGATIVE CONTROL: the earlier lede claimed an opt-in the builder never had.
    expect("Only the moments and questions you pick go in. Nothing leaves until you share it.").toMatch(/\bonly\b|\bpick/i);
  });

  it("a teacher stored on this device does not open the teacher branch; the builder shows, without a teacher chip", () => {
    storage.set("arbor.consultExportAudience", "teacher");
    const tree = render({ excludeTeacher: true });
    expect(byId(tree, "consult-reason-section")).toBeDefined();
    expect(byId(tree, "consult-teacher-branch")).toBeUndefined();
    expect(byId(tree, "consult-build")).toBeDefined();
    const chips = audienceChips(tree);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.map(chipText)).not.toContain(translate("en", "elev.carehonesty.consult.audience.teacher"));
    // It starts at the default professional, and the stored choice is not overwritten.
    const on = chips.filter((el) => el.props["aria-checked"] === true);
    expect(on.map(chipText)).toEqual([translate("en", "elev.carehonesty.consult.audience.pediatrician")]);
    expect(storage.get("arbor.consultExportAudience")).toBe("teacher");
  });

  it("a teacher anchor (a teacher visit) does not open the teacher branch either", () => {
    const tree = render({ excludeTeacher: true, anchorAudience: "teacher" });
    expect(byId(tree, "consult-reason-section")).toBeDefined();
    expect(byId(tree, "consult-teacher-branch")).toBeUndefined();
  });

  it("NEGATIVE CONTROL: on #/consult a stored teacher still opens the teacher branch, with the teacher chip", () => {
    storage.set("arbor.consultExportAudience", "teacher");
    const tree = render();
    expect(byId(tree, "consult-teacher-branch")).toBeDefined();
    expect(byId(tree, "consult-reason-section")).toBeUndefined();
    expect(audienceChips(tree).map(chipText)).toContain(translate("en", "elev.carehonesty.consult.audience.teacher"));
  });
});
