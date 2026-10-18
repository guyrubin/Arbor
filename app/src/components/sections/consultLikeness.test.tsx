/**
 * B-CAREPRO-52 — a professional document carries the child's picture only
 * when the parent chooses it, for THIS export and audience.
 *
 *   - default off: the PDF handed to the print shell has no hero and the
 *     rendered export contains no <img>; the preview shows no picture;
 *   - explicit on: the stylized hero rides on the PDF, the rendered export
 *     carries it, and the preview shows the SAME image (preview = export);
 *   - the choice is per export: a different audience or child resets it, it is
 *     never written to localStorage, and toggling withdraws "I reviewed";
 *   - a real photo (avatar.source !== "descriptor") is never offered;
 *   - the Reports seam (`useConsultPdf`) embeds no hero unless told to.
 *
 * Node-only: AskSpecialist runs as a function under slot hooks (the
 * consultFamilyQuestion harness). The REAL `useConsultPdf` runs; only the
 * print shell's window-opening act is captured. Invented child only. EN + HE.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HERO = "data:image/png;base64,QUJD";

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], dirty: false,
  lang: "en" as "en" | "he",
  hero: { url: "data:image/png;base64,QUJD" as string | null, isGenerated: true },
  print: vi.fn(), copy: vi.fn(), record: vi.fn(), toast: vi.fn(),
  child: { id: "child-1", name: "Noa Levi", age: 5, languages: ["English"], schoolContext: "Kindergarten", challenges: [], strengths: ["Builds towers"], interests: [] },
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
    setActiveTab: noop, openPaywall: noop, pendingConsultPrefill: null, consumeConsultPrefill: noop, requestConsultPrefill: noop,
    activeFamilyTopic: null, checkedMilestones: 0, totalMilestones: 0,
  }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (_child: string, name: string) => ({ items: name === "apptQuestions" ? h.questions : h.empty, loaded: true, upsert: noop, remove: noop }),
}));
vi.mock("../ui/HeroAvatar", () => ({ useHeroAvatar: () => ({ url: h.hero.url, isGenerated: h.hero.isGenerated, hasHero: !!h.hero.url, name: "Noa" }) }));
vi.mock("../../lib/loopEvents", () => ({ trackShareInitiated: noop, trackShareCompleted: noop }));
// The REAL Reports seam runs; only the act that opens a window is captured.
vi.mock("../../lib/reportExport", async (original) => ({ ...await original<typeof import("../../lib/reportExport")>(), openPrintableReport: (...args: any[]) => h.print(...args) }));
vi.mock("../../consult/exportHistory", () => ({ getLastExportedAt: () => null, recordExport: (...args: any[]) => h.record(...args) }));
vi.mock("../kidmode/useKidModeEntry", () => ({ useKidModeEntry: () => ({ request: noop, step: null }) }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
vi.mock("motion/react", async (original) => ({ ...await original<typeof import("motion/react")>(), useReducedMotion: () => false }));

import { translate } from "../../lib/i18n";
import { renderPrintableHtml, type ReportDoc } from "../../lib/reportExport";
import AskSpecialist from "./AskSpecialist";

type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Record<string, any>>(node)) return [];
  const element = node as El;
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}
const byId = (node: React.ReactNode, id: string) => elements(node).find((el) => el.props["data-testid"] === id);
const textOf = (node: React.ReactNode): string =>
  elements(node).flatMap((el) => React.Children.toArray(el.props.children).filter((c) => typeof c === "string" || typeof c === "number")).join("");

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
const setAudience = (audience: string) => {
  elements(render()).find((el) => el.props.role === "radio" && React.Children.toArray(el.props.children).includes(translate(h.lang, `elev.carehonesty.consult.audience.${audience}`)))!.props.onClick();
  return render();
};
const review = () => { byId(render(), "consult-reviewed")!.props.onClick(); return render(); };
const savePdf = () => { byId(render(), "consult-pdf")!.props.onClick(); return h.print.mock.calls.at(-1)![0] as ReportDoc; };
/** What the preview shows and what the file carries — compared as one shape. */
const previewImage = (tree: React.ReactNode) => byId(tree, "consult-preview-likeness")?.props.src as string | undefined;
const exportImage = (doc: ReportDoc) => {
  const html = renderPrintableHtml(doc, h.child.name, h.lang);
  const m = /<img class="hero" src="([^"]*)"/.exec(html);
  expect(html.includes("<img")).toBe(!!m);
  return m?.[1];
};

let storage: Map<string, string>;
beforeEach(() => {
  h.cursor = 0; h.slots = []; h.effects = []; h.dirty = false; h.lang = "en";
  h.hero = { url: HERO, isGenerated: true };
  for (const mock of [h.print, h.copy, h.record, h.toast]) mock.mockReset();
  storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
  vi.stubGlobal("navigator", { clipboard: { writeText: h.copy } });
  vi.stubGlobal("document", { getElementById: () => null });
});
afterEach(() => { h.slots.forEach((slot) => slot?.cleanup?.()); vi.unstubAllGlobals(); });

describe("B-CAREPRO-52 · the child's picture leaves on a professional PDF only by the parent's per-export choice", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: default off — no picture in the preview, none in the rendered export; the toggle is a 44 px aria-pressed button in the family's language`, () => {
      h.lang = lang;
      setAudience("pediatrician");
      const tree = render();
      const chip = byId(tree, "consult-include-likeness")!;
      expect(chip).toBeDefined();
      expect(chip.type).toBe("button");
      expect(chip.props["aria-pressed"]).toBe(false);
      expect(chip.props.className).toContain("min-h-[44px]");
      expect(textOf(chip)).toBe(translate(lang, "elev.carehonesty.consult.likeness.off", { name: "Noa" }));
      // no English fallback in Hebrew: the child's name and the "PDF" term
      // (the same term the shipped HE "Save as PDF" uses) are the only Latin text
      if (lang === "he") expect(textOf(chip).replace(/Noa|PDF/g, "")).not.toMatch(/[A-Za-z]/);
      expect(previewImage(tree)).toBeUndefined();
      review();
      const doc = savePdf();
      expect(doc.heroImageUrl).toBeUndefined();
      expect(exportImage(doc)).toBeUndefined();
      expect(h.record).toHaveBeenCalledTimes(1);
    });

    it(`${lang}: explicit on — the stylized hero is in the preview and in the rendered export, the same image`, () => {
      h.lang = lang;
      setAudience("pediatrician");
      byId(render(), "consult-include-likeness")!.props.onClick();
      const tree = render();
      expect(byId(tree, "consult-include-likeness")!.props["aria-pressed"]).toBe(true);
      expect(textOf(byId(tree, "consult-include-likeness")!)).toBe(translate(lang, "elev.carehonesty.consult.likeness.on", { name: "Noa" }));
      expect(previewImage(tree)).toBe(HERO);
      review();
      const doc = savePdf();
      expect(doc.heroImageUrl).toBe(HERO);
      expect(exportImage(doc)).toBe(HERO);
      // preview = export
      expect(previewImage(render())).toBe(exportImage(doc));
    });
  }

  it("the choice is scoped to this export: toggling withdraws review, a different audience resets it, nothing is persisted", () => {
    setAudience("pediatrician");
    review();
    expect(byId(render(), "consult-reviewed")!.props["aria-pressed"]).toBe(true);
    byId(render(), "consult-include-likeness")!.props.onClick();
    let tree = render();
    expect(byId(tree, "consult-reviewed")!.props["aria-pressed"]).toBe(false);
    expect(byId(tree, "consult-pdf")!.props.disabled).toBe(true);
    // another audience: off again, and the preview follows
    tree = setAudience("slp");
    expect(byId(tree, "consult-include-likeness")!.props["aria-pressed"]).toBe(false);
    expect(previewImage(tree)).toBeUndefined();
    review();
    expect(savePdf().heroImageUrl).toBeUndefined();
    // the choice lives in the screen only
    for (const [, v] of storage) expect(v).not.toMatch(/likeness|hero/i);
  });

  it("a real photo is never offered: no toggle, no picture, no img in the export", () => {
    h.hero = { url: "https://storage.example/real-face.jpg", isGenerated: false };
    setAudience("pediatrician");
    const tree = render();
    expect(byId(tree, "consult-include-likeness")).toBeUndefined();
    expect(previewImage(tree)).toBeUndefined();
    review();
    const doc = savePdf();
    expect(doc.heroImageUrl).toBeUndefined();
    expect(exportImage(doc)).toBeUndefined();
  });

  it("the Reports seam itself embeds no hero unless the caller passes likeness: true", async () => {
    const { useConsultPdf } = await import("./Reports");
    h.cursor = 0; h.slots = [];
    const print = useConsultPdf();
    const sections = [{ heading: "Reason for visit", body: ["Sleep"] }];
    print("pediatrician", sections);
    expect((h.print.mock.calls.at(-1)![0] as ReportDoc).heroImageUrl).toBeUndefined();
    print("pediatrician", sections, {});
    expect((h.print.mock.calls.at(-1)![0] as ReportDoc).heroImageUrl).toBeUndefined();
    print("pediatrician", sections, { likeness: true });
    expect((h.print.mock.calls.at(-1)![0] as ReportDoc).heroImageUrl).toBe(HERO);
    h.hero = { url: "https://storage.example/real-face.jpg", isGenerated: false };
    h.cursor = 0;
    useConsultPdf()("pediatrician", sections, { likeness: true });
    expect((h.print.mock.calls.at(-1)![0] as ReportDoc).heroImageUrl).toBeUndefined();
  });
});
