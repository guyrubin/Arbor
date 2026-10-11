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
 *     or off withdraws a tick already given.
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

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as El;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const byId = (node: React.ReactNode, id: string) => elements(node).find((el) => el.props["data-testid"] === id);

function render(): React.ReactNode {
  for (let n = 0; n < 12; n++) {
    h.dirty = false;
    h.cursor = 0;
    const tree = (AskSpecialist as unknown as (p: object) => React.ReactNode)({});
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

beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.lang = "en"; h.topic = null;
  h.t = (key, vars) => translate(h.lang, key, vars);
  for (const mock of [h.copy, h.pdf, h.record, h.toast]) mock.mockReset();
  const storage = new Map<string, string>();
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
      expect(elements(byId(tree, "consult-reason-section")).includes(chip)).toBe(true);
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
    const sections = h.pdf.mock.calls[0][1] as { heading: string; body: string[] }[];
    expect(sections.filter((s) => s.heading === lineFor("en"))).toHaveLength(1);
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

  it("the PDF carries the same line first; self and clinician audiences alike", () => {
    for (const audience of ["pediatrician", "self"] as const) {
      const sections = exportPrintSections(audience, packet, new Set(), "", "Parent note", "en", LINE);
      expect(sections[0]).toEqual({ heading: LINE, body: [] });
      expect(sections.filter((s) => s.heading === LINE)).toHaveLength(1);
      expect(exportPrintSections(audience, packet, new Set(), "", "Parent note", "en").some((s) => s.heading === LINE)).toBe(false);
    }
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
